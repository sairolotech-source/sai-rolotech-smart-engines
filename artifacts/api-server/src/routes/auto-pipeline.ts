import { Router, type IRouter, type Request, type Response } from "express";
import type { ProfileGeometry } from "../lib/dxf-parser-util";
import { generateFlowerPattern } from "../lib/power-pattern";
import { generateRollTooling, calcRequiredMotorPower } from "../lib/roll-tooling";
import { validateFlowerInputs, computeNeutralAxisStripWidth } from "../lib/calc-validator";
import { verifyFlowerPattern } from "../lib/deep-accuracy-engine";
import {
  SUPPORTED_MATERIALS,
  K_FACTORS,
  estimateStationsRuleBook,
  calcDutyClass,
  SHAFT_DIAMETER_MM,
  selectBearingForShaft,
  detectEngineeringWarnings,
  thicknessCategory,
  MATERIAL_FORMING_DIFFICULTY,
  MATERIAL_STATION_CORRECTION,
  thicknessStationCorrection,
  classifyComplexity,
  COMPLEXITY_LABELS,
} from "../lib/engineering-rules";

const router: IRouter = Router();

type StepStatus = "pass" | "fail" | "skip" | "warn";

interface PipelineStep {
  step: number;
  id: string;
  label: string;
  status: StepStatus;
  reason?: string;
  data?: Record<string, unknown>;
}

// Section 8 named-engine output format (per MASTER PROMPT spec)
interface EngineOutput {
  import_engine: { status: StepStatus; segments?: number; notes: string[] };
  geometry_engine: { status: StepStatus; profile_type: string; section_width_mm: number; section_height_mm: number; bend_count: number; total_length_mm: number; open_profile: boolean; notes: string[] };
  input_engine: { status: StepStatus; sheet_thickness_mm: number; material: string; thickness_category: string; forming_difficulty: string };
  flower_pattern_engine: { status: StepStatus; complexity: string; estimated_forming_passes: number; accuracy_score: number; reason?: string };
  station_engine: { status: StepStatus; recommended_station_count: number; minimum_station_count: number; maximum_station_count: number; material_penalty: number; thickness_penalty: number };
  roll_logic_engine: { status: StepStatus; roll_design_stage: string; strip_width_mm: number; k_factor: number; method: string; notes: string[] };
  mechanical_engine: { status: StepStatus; duty_class: string; suggested_shaft_diameter_mm: number; suggested_bearing_type: string; max_forming_force_kn: number; motor_kw: number; reason?: string };
  final_summary: { status: StepStatus; warnings: string[]; assumptions: string[]; accuracy_score: number };
}

interface PipelineResult {
  pipeline_status: "pass" | "fail" | "partial";
  steps: PipelineStep[];
  engines: EngineOutput;
  summary: {
    import_status: StepStatus;
    profile_status: StepStatus;
    section_width_mm: number;
    section_height_mm: number;
    sheet_thickness_mm: number;
    material: string;
    bend_count: number;
    total_length_mm: number;
    strip_width_mm: number;
    flower_pattern_generated: boolean;
    estimated_stations: number;
    shaft_diameter_mm: number;
    bearing_type: string;
    motor_kw: number;
    forming_force_max_kn: number;
    profile_complexity: string;
    section_type: string;
    notes: string[];
    accuracy_score: number;
  };
  flower_stations?: unknown[];
  roll_tooling?: unknown[];
  errors: string[];
  warnings: string[];
}

// All engineering rules imported from lib/engineering-rules.ts (single source of truth)

interface AutoPipelineBody {
  geometry: ProfileGeometry & {
    bendPoints?: Array<{ angle: number; radius?: number; segmentIndex?: number; side?: string; direction?: string }>;
  };
  thickness: number | string;
  material: string;
  sectionModel?: "open" | "closed";
  motorKw?: number;
  rpm?: number;
  shaftDiameter?: number;
}


router.post("/auto-pipeline", (req: Request<unknown, unknown, AutoPipelineBody>, res: Response) => {
  const steps: PipelineStep[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  // Engines (Section 8 named-engine output — built progressively through the pipeline)
  const engines: EngineOutput = {
    import_engine: { status: "skip", notes: [] },
    geometry_engine: { status: "skip", profile_type: "", section_width_mm: 0, section_height_mm: 0, bend_count: 0, total_length_mm: 0, open_profile: false, notes: [] },
    input_engine: { status: "skip", sheet_thickness_mm: 0, material: "", thickness_category: "", forming_difficulty: "" },
    flower_pattern_engine: { status: "skip", complexity: "", estimated_forming_passes: 0, accuracy_score: 0 },
    station_engine: { status: "skip", recommended_station_count: 0, minimum_station_count: 0, maximum_station_count: 0, material_penalty: 0, thickness_penalty: 0 },
    roll_logic_engine: { status: "skip", roll_design_stage: "not-started", strip_width_mm: 0, k_factor: 0, method: "", notes: [] },
    mechanical_engine: { status: "skip", duty_class: "", suggested_shaft_diameter_mm: 0, suggested_bearing_type: "", max_forming_force_kn: 0, motor_kw: 0 },
    final_summary: { status: "skip", warnings: [], assumptions: [], accuracy_score: 0 },
  };

  let pipelineFailed = false;

  const fail = (id: string, label: string, stepNum: number, reason: string): PipelineStep => {
    const s: PipelineStep = { step: stepNum, id, label, status: "fail", reason };
    steps.push(s);
    errors.push(`[${id.toUpperCase()}] ${reason}`);
    pipelineFailed = true;
    console.log(`[auto-pipeline] STEP ${stepNum} ${id.toUpperCase()}: FAIL — ${reason}`);
    return s;
  };

  const pass = (id: string, label: string, stepNum: number, data?: Record<string, unknown>): PipelineStep => {
    const s: PipelineStep = { step: stepNum, id, label, status: "pass", data };
    steps.push(s);
    console.log(`[auto-pipeline] STEP ${stepNum} ${id.toUpperCase()}: PASS`);
    return s;
  };

  const warn = (id: string, label: string, stepNum: number, reason: string, data?: Record<string, unknown>): PipelineStep => {
    const s: PipelineStep = { step: stepNum, id, label, status: "warn", reason, data };
    steps.push(s);
    warnings.push(`[${id.toUpperCase()}] ${reason}`);
    console.log(`[auto-pipeline] STEP ${stepNum} ${id.toUpperCase()}: WARN — ${reason}`);
    return s;
  };

  try {
    // ─── STEP 1: Import / Geometry Receive ─────────────────────────────────
    const { geometry, thickness: rawThickness, material: rawMaterial, sectionModel, motorKw = 11, rpm = 1440, shaftDiameter: userShaft } = req.body;

    // Normalize: frontend sends bendPoints, backend DXF parser sends bends — accept both
    if (geometry && !geometry.bends && (geometry as typeof geometry & { bendPoints?: unknown }).bendPoints) {
      const bp = (geometry as typeof geometry & { bendPoints?: Array<{ angle: number; radius?: number; segmentIndex?: number; side?: string; direction?: string }> }).bendPoints ?? [];
      geometry.bends = bp.map(b => ({
        angle: Math.abs(b.angle),
        radius: b.radius ?? 2,
        segmentIndex: b.segmentIndex ?? 0,
        side: (b.side ?? "left") as "left" | "right",
        direction: (b.direction ?? "up") as "up" | "down",
      }));
    }
    geometry.bends = geometry.bends ?? [];

    // Normalize boundingBox: frontend may only send minX/minY/maxX/maxY without width/height
    if (geometry.boundingBox) {
      const bb = geometry.boundingBox as typeof geometry.boundingBox & { width?: number; height?: number };
      if (bb.width === undefined) bb.width = bb.maxX - bb.minX;
      if (bb.height === undefined) bb.height = bb.maxY - bb.minY;
    }

    // Compute totalLength from segments if not provided (frontend geometry doesn't include it)
    if (!geometry.totalLength && geometry.segments?.length) {
      geometry.totalLength = geometry.segments.reduce((s, seg) => s + (seg.length ?? 0), 0);
    }
    geometry.totalLength = geometry.totalLength ?? 0;

    if (!geometry || !geometry.segments) {
      engines.import_engine = { status: "fail", notes: ["No geometry provided. Upload a DXF/DWG file or draw a profile."] };
      fail("import", "Geometry Import", 1, "No geometry provided. Upload a DXF/DWG file or draw a profile.");
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, [], engines));
      return;
    }
    if (geometry.segments.length === 0) {
      engines.import_engine = { status: "fail", notes: ["Geometry has zero segments — profile may use unsupported entities (SPLINE)."] };
      fail("import", "Geometry Import", 1, "Geometry has zero segments. Check DXF file — profile may be empty or use unsupported entities (SPLINE).");
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, [], engines));
      return;
    }
    engines.import_engine = { status: "pass", segments: geometry.segments.length, notes: [] };
    pass("import", "Geometry Import", 1, {
      segmentCount: geometry.segments.length,
      boundingBox: geometry.boundingBox,
    });

    // ─── STEP 2: Profile Validation ────────────────────────────────────────
    const { boundingBox, segments, bends, totalLength } = geometry;
    const sectionWidth = parseFloat((boundingBox.width ?? 0).toFixed(2));
    const sectionHeight = parseFloat((boundingBox.height ?? 0).toFixed(2));
    const bendCount = bends?.length ?? 0;

    const profileComplexity = classifyComplexity(bendCount);
    const profileType = COMPLEXITY_LABELS[profileComplexity];
    const geNotes: string[] = [];
    if (sectionWidth < 1 || sectionHeight < 1) {
      engines.geometry_engine = { status: "fail", profile_type: profileType, section_width_mm: sectionWidth, section_height_mm: sectionHeight, bend_count: bendCount, total_length_mm: parseFloat(totalLength.toFixed(2)), open_profile: sectionModel === "open", notes: [`Dimensions too small: W=${sectionWidth}mm, H=${sectionHeight}mm — check DXF units`] };
      fail("profile", "Profile Validation", 2, `Profile dimensions too small (W=${sectionWidth}mm, H=${sectionHeight}mm). Check DXF units — may need to scale.`);
    } else if (bendCount === 0) {
      geNotes.push("No bends detected — treating as flat strip");
      engines.geometry_engine = { status: "warn", profile_type: "flat-strip", section_width_mm: sectionWidth, section_height_mm: sectionHeight, bend_count: 0, total_length_mm: parseFloat(totalLength.toFixed(2)), open_profile: true, notes: geNotes };
      warn("profile", "Profile Validation", 2, "No bends detected — profile appears to be a flat strip.", {
        sectionWidth, sectionHeight, bendCount, totalLength,
      });
      notes.push("Profile has no bends — treated as flat strip. Verify the profile is correct.");
    } else {
      engines.geometry_engine = { status: "pass", profile_type: profileType, section_width_mm: sectionWidth, section_height_mm: sectionHeight, bend_count: bendCount, total_length_mm: parseFloat(totalLength.toFixed(2)), open_profile: sectionModel === "open", notes: geNotes };
      pass("profile", "Profile Validation", 2, {
        sectionWidth, sectionHeight, bendCount, totalLength: parseFloat(totalLength.toFixed(2)),
      });
    }

    if (pipelineFailed) {
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, [], engines));
      return;
    }

    // ─── STEP 3: Thickness Input Validation ────────────────────────────────
    const thickness = parseFloat(String(rawThickness));
    if (isNaN(thickness) || thickness <= 0) {
      engines.input_engine = { status: "fail", sheet_thickness_mm: 0, material: "", thickness_category: "invalid", forming_difficulty: "unknown" };
      fail("thickness", "Sheet Thickness", 3, "Invalid or missing thickness. Provide a positive number in mm (e.g. 0.8, 1.5, 2.0).");
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, [], engines));
      return;
    }
    if (thickness < 0.3 || thickness > 6.0) {
      warn("thickness", "Sheet Thickness", 3, `Thickness ${thickness}mm is outside typical roll-forming range (0.3–6.0mm). Proceeding with caution.`, { thickness });
    } else {
      pass("thickness", "Sheet Thickness", 3, { thickness_mm: thickness });
    }

    // ─── STEP 4: Material Validation ───────────────────────────────────────
    const SUPPORTED_MATERIALS = ["GI", "CR", "HR", "SS", "AL", "MS", "CU", "TI", "PP", "HSLA"];
    const material = (String(rawMaterial ?? "GI")).toUpperCase().trim();
    if (!SUPPORTED_MATERIALS.includes(material)) {
      warn("material", "Raw Material", 4, `Unknown material '${material}'. Defaulting to GI. Supported: ${SUPPORTED_MATERIALS.join(", ")}.`, { material: "GI" });
      notes.push(`Material '${material}' not recognized — using GI properties.`);
    } else {
      pass("material", "Raw Material", 4, { material });
    }
    const effectiveMaterial = SUPPORTED_MATERIALS.includes(material) ? material : "GI";
    engines.input_engine = {
      status: thickness < 0.3 || thickness > 6.0 ? "warn" : "pass",
      sheet_thickness_mm: thickness,
      material: effectiveMaterial,
      thickness_category: thicknessCategory(thickness),
      forming_difficulty: MATERIAL_FORMING_DIFFICULTY[effectiveMaterial] ?? "medium",
    };

    // ─── STEP 5: Strip Width / Neutral Axis ────────────────────────────────
    // K-factors per DIN 6935 — from engineering-rules.ts (shared source of truth)
    const kFactor = K_FACTORS[effectiveMaterial] ?? 0.44;

    let stripWidth = totalLength;
    try {
      // Estimate flange lengths from straight segments
      const segArr = segments;
      const flanges: number[] = segArr
        .filter(s => s.type === "line")
        .map(s => s.length);
      const bendParams = bends.map(b => ({
        angle: b.angle,
        innerRadius: b.radius,
      }));
      const naResult = computeNeutralAxisStripWidth(bendParams, flanges, kFactor, thickness);
      stripWidth = naResult > 0 ? naResult : totalLength;
      engines.roll_logic_engine = { status: "pass", roll_design_stage: "preliminary", strip_width_mm: parseFloat(stripWidth.toFixed(2)), k_factor: kFactor, method: "DIN 6935 K-factor neutral axis", notes: [`K=${kFactor} for ${effectiveMaterial}`] };
      pass("strip-width", "Neutral Axis / Strip Width", 5, {
        strip_width_mm: parseFloat(stripWidth.toFixed(2)),
        method: "DIN 6935 K-factor neutral axis",
        k_factor: kFactor,
      });
    } catch {
      engines.roll_logic_engine = { status: "warn", roll_design_stage: "preliminary", strip_width_mm: parseFloat(totalLength.toFixed(2)), k_factor: kFactor, method: "fallback to total length", notes: ["Strip width fell back to total profile perimeter"] };
      warn("strip-width", "Neutral Axis / Strip Width", 5, "Strip width calculation fell back to total profile length.", { strip_width_mm: parseFloat(totalLength.toFixed(2)) });
      stripWidth = totalLength;
    }

    // ─── STEP 6: Station Estimation ────────────────────────────────────────
    // Uses rule book formula: stations = bend_count + complexity_factor + thickness_factor + material_factor
    const stationEst = estimateStationsRuleBook(bendCount, effectiveMaterial, thickness);
    const numStations = stationEst.recommended;
    const sectionType = stationEst.complexity;
    notes.push(`Complexity: ${stationEst.complexity} — Formula: ${stationEst.formula}`);
    engines.station_engine = {
      status: "pass",
      recommended_station_count: numStations,
      minimum_station_count: stationEst.minimum,
      maximum_station_count: stationEst.maximum,
      material_penalty: stationEst.materialCorrection,
      thickness_penalty: stationEst.thicknessCorrection,
    };
    pass("station-count", "Station Count Estimation", 6, {
      bend_count: bendCount,
      complexity: stationEst.complexity,
      complexity_label: stationEst.complexityLabel,
      recommended_stations: numStations,
      min_stations: stationEst.minimum,
      max_stations: stationEst.maximum,
      formula: stationEst.formula,
      complexity_correction: stationEst.complexityCorrection,
      thickness_correction: stationEst.thicknessCorrection,
      material_correction: stationEst.materialCorrection,
    });

    // ─── STEP 7: Flower Pattern Generation ─────────────────────────────────
    let flowerStations: unknown[] = [];
    let accuracyScore = 0;
    try {
      const inputVal = validateFlowerInputs({
        thickness,
        numStations,
        totalBendAngle: bends.reduce((s, b) => s + b.angle, 0) || 90,
        stripWidth,
        materialType: effectiveMaterial,
      });
      if (!inputVal.valid) {
        for (const e of inputVal.errors) warnings.push(`[FLOWER-INPUT] ${e.field}: ${e.message}`);
      }

      const flowerResult = generateFlowerPattern(geometry, numStations, "S", effectiveMaterial, thickness);
      flowerStations = flowerResult.stations;

      const deepResult = verifyFlowerPattern({
        materialType: effectiveMaterial,
        thickness,
        numStations,
        totalBendAngle: flowerStations.reduce((s: number, st: unknown) => {
          const station = st as { bendAngle?: number };
          return s + Math.abs(station.bendAngle ?? 0);
        }, 0),
        stripWidth,
        sectionModel: sectionModel ?? "open",
        stations: (flowerStations as Array<{ bendAngle?: number; rollDiameter?: number; rollGap?: number; formingForce?: number; springbackAngle?: number }>).map((st, i) => ({
          stationNumber: i + 1,
          bendAngle: Math.abs(st.bendAngle ?? 0),
          rollDiameter: st.rollDiameter ?? 150,
          rollGap: st.rollGap ?? thickness,
          formingForce: st.formingForce ?? 10,
          springbackAngle: st.springbackAngle,
        })),
      });

      const totalChecks = deepResult.checks.length || 1;
      const passed = deepResult.checks.filter(c => c.status === "ok").length;
      accuracyScore = Math.min(100, Math.round(98 * (passed / totalChecks) + 2));

      if (deepResult.recommendations?.length) {
        for (const rec of deepResult.recommendations.slice(0, 3)) notes.push(rec);
      }

      engines.flower_pattern_engine = {
        status: "pass",
        complexity: stationEst.complexity,
        estimated_forming_passes: flowerStations.length,
        accuracy_score: accuracyScore,
      };
      pass("flower", "Flower Pattern Generation", 7, {
        stations_generated: flowerStations.length,
        accuracy_score: accuracyScore,
        auto_corrections: deepResult.autoCorrections.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Flower pattern generation failed";
      engines.flower_pattern_engine = { status: "fail", complexity: "unknown", estimated_forming_passes: 0, accuracy_score: 0, reason: msg };
      fail("flower", "Flower Pattern Generation", 7, msg);
      res.status(500).json(buildResult("fail", steps, errors, warnings, notes, [], engines));
      return;
    }

    // ─── STEP 8: Shaft & Bearing Calculation ───────────────────────────────
    // PRIMARY: Rule book duty-class table (Section 5 & 6)
    //   LIGHT→40mm→6208 | MEDIUM→50mm→6210 | HEAVY→60mm→6212 | INDUSTRIAL→70mm→6214
    // SECONDARY: Shigley's MSS (generateRollTooling) for forming force estimation only.
    const dutyClass = calcDutyClass(thickness, stationEst.complexity, effectiveMaterial);
    const ruleBookShaft = SHAFT_DIAMETER_MM[dutyClass];
    const ruleBookBearing = selectBearingForShaft(ruleBookShaft);

    let rollToolingResult: unknown[] = [];
    let maxFormingForce = 0;

    // Run Shigley's computation for forming force data (do not override rule-book shaft/bearing)
    try {
      rollToolingResult = generateRollTooling(
        flowerStations as Parameters<typeof generateRollTooling>[0],
        effectiveMaterial,
        thickness,
        ruleBookShaft,
        0.05,
        motorKw,
        rpm,
      );
      for (const rt of rollToolingResult as Array<{ formingForceN?: number }>) {
        if ((rt.formingForceN ?? 0) > maxFormingForce) maxFormingForce = rt.formingForceN!;
      }
    } catch {
      /* roll-tooling is secondary — shaft/bearing already determined by rule book */
    }

    // Detect engineering warnings
    const engWarnings = detectEngineeringWarnings({
      bendCount,
      thickness,
      material: effectiveMaterial,
      sectionWidth,
      sectionHeight,
      isOpen: sectionModel === "open",
    });
    for (const w of engWarnings) warnings.push(`[${w.code}] ${w.message}`);

    notes.push(`Duty class: ${dutyClass} → Shaft: ${ruleBookShaft}mm → Bearing: ${ruleBookBearing} (Rule Book Section 5 & 6).`);
    engines.mechanical_engine = {
      status: "pass",
      duty_class: dutyClass,
      suggested_shaft_diameter_mm: ruleBookShaft,
      suggested_bearing_type: ruleBookBearing,
      max_forming_force_kn: parseFloat((maxFormingForce / 1000).toFixed(2)),
      motor_kw: motorKw,
    };
    pass("shaft-bearing", "Shaft & Bearing Selection", 8, {
      duty_class: dutyClass,
      shaft_diameter_mm: ruleBookShaft,
      bearing_type: ruleBookBearing,
      rule: `${dutyClass} duty → ${ruleBookShaft}mm shaft → ${ruleBookBearing}`,
      max_forming_force_kn: parseFloat((maxFormingForce / 1000).toFixed(2)),
    });
    const maxShaftDiameter = ruleBookShaft;
    const primaryBearing = ruleBookBearing;

    // ─── STEP 9: Motor Power ────────────────────────────────────────────────
    try {
      const stationForces = (rollToolingResult as Array<{ formingForceN?: number }>).map(r => (r.formingForceN ?? 5000) / 1000);
      const rollODs = (rollToolingResult as Array<{ rollOD?: { upperOD?: number } }>).map(r => r.rollOD?.upperOD ?? 150);
      const motorResult = calcRequiredMotorPower(stationForces, rollODs, effectiveMaterial, 20, rpm);
      const recommendedKw = motorResult.totalRequiredKw;
      if (recommendedKw > motorKw) {
        warn("motor", "Motor Power Check", 9, `Motor ${motorKw}kW may be underpowered — estimated need ${recommendedKw.toFixed(1)}kW.`, { recommended_kw: recommendedKw, selected_iec_kw: motorResult.selectedMotorKw });
      } else {
        pass("motor", "Motor Power Check", 9, { input_kw: motorKw, required_kw: recommendedKw, selected_iec_kw: motorResult.selectedMotorKw });
      }
    } catch {
      steps.push({ step: 9, id: "motor", label: "Motor Power Check", status: "skip", reason: "Motor calculation skipped." });
    }

    // ─── STEP 10: Final Pipeline Summary ───────────────────────────────────
    const overallStatus = pipelineFailed ? "fail" : errors.length > 0 ? "partial" : "pass";
    const assumptions = [
      "Preliminary engineering estimates — expert review required before production",
      `Station formula (Rule Book §4): ${stationEst.formula}`,
      `Duty class (Rule Book §7): ${dutyClass} → ${ruleBookShaft}mm shaft (§5) → ${ruleBookBearing} bearing (§6)`,
      `Strip width (DIN 6935): K=${kFactor} neutral axis for ${effectiveMaterial}`,
      "Shigley's MSS used for forming force estimation only — shaft/bearing follow rule book tables",
    ];
    engines.final_summary = {
      status: overallStatus === "fail" ? "fail" : overallStatus === "partial" ? "warn" : "pass",
      warnings: warnings.slice(0, 10),
      assumptions,
      accuracy_score: accuracyScore,
    };
    pass("report", "Engineering Report", 10, { accuracy_score: accuracyScore });

    const result = buildResult(overallStatus, steps, errors, warnings, notes, rollToolingResult, engines);
    result.summary = {
      import_status: pipelineFailed ? "fail" : "pass",
      profile_status: pipelineFailed ? "fail" : "pass",
      section_width_mm: sectionWidth,
      section_height_mm: sectionHeight,
      sheet_thickness_mm: thickness,
      material: effectiveMaterial,
      bend_count: bendCount,
      total_length_mm: parseFloat(totalLength.toFixed(2)),
      strip_width_mm: parseFloat(stripWidth.toFixed(2)),
      flower_pattern_generated: flowerStations.length > 0,
      estimated_stations: numStations,
      shaft_diameter_mm: maxShaftDiameter,
      bearing_type: primaryBearing,
      motor_kw: motorKw,
      forming_force_max_kn: parseFloat((maxFormingForce / 1000).toFixed(2)),
      profile_complexity: stationEst.complexity,
      section_type: sectionType,
      notes,
      accuracy_score: accuracyScore,
    };
    result.flower_stations = flowerStations;

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auto-pipeline failed";
    console.error("[auto-pipeline] Unhandled error:", message);
    errors.push(message);
    res.status(500).json(buildResult("fail", steps, errors, warnings, notes, [], engines));
  }
});

const DEFAULT_ENGINES: EngineOutput = {
  import_engine: { status: "skip", notes: [] },
  geometry_engine: { status: "skip", profile_type: "", section_width_mm: 0, section_height_mm: 0, bend_count: 0, total_length_mm: 0, open_profile: false, notes: [] },
  input_engine: { status: "skip", sheet_thickness_mm: 0, material: "", thickness_category: "", forming_difficulty: "" },
  flower_pattern_engine: { status: "skip", complexity: "", estimated_forming_passes: 0, accuracy_score: 0 },
  station_engine: { status: "skip", recommended_station_count: 0, minimum_station_count: 0, maximum_station_count: 0, material_penalty: 0, thickness_penalty: 0 },
  roll_logic_engine: { status: "skip", roll_design_stage: "not-started", strip_width_mm: 0, k_factor: 0, method: "", notes: [] },
  mechanical_engine: { status: "skip", duty_class: "", suggested_shaft_diameter_mm: 0, suggested_bearing_type: "", max_forming_force_kn: 0, motor_kw: 0 },
  final_summary: { status: "skip", warnings: [], assumptions: [], accuracy_score: 0 },
};

function buildResult(
  status: "pass" | "fail" | "partial",
  steps: PipelineStep[],
  errors: string[],
  warnings: string[],
  notes: string[],
  rollTooling: unknown[],
  engines: EngineOutput = DEFAULT_ENGINES,
): PipelineResult {
  return {
    pipeline_status: status,
    steps,
    engines,
    summary: {
      import_status: "skip",
      profile_status: "skip",
      section_width_mm: 0,
      section_height_mm: 0,
      sheet_thickness_mm: 0,
      material: "",
      bend_count: 0,
      total_length_mm: 0,
      strip_width_mm: 0,
      flower_pattern_generated: false,
      estimated_stations: 0,
      shaft_diameter_mm: 0,
      bearing_type: "",
      motor_kw: 0,
      forming_force_max_kn: 0,
      profile_complexity: "",
      section_type: "",
      notes,
      accuracy_score: 0,
    },
    flower_stations: [],
    roll_tooling: rollTooling,
    errors,
    warnings,
  };
}

export default router;
