import { Router, type IRouter, type Request, type Response } from "express";
import type { ProfileGeometry } from "../lib/dxf-parser-util";
import { generateFlowerPattern } from "../lib/power-pattern";
import { generateRollTooling, calcRequiredMotorPower } from "../lib/roll-tooling";
import { validateFlowerInputs, computeNeutralAxisStripWidth } from "../lib/calc-validator";
import { verifyFlowerPattern } from "../lib/deep-accuracy-engine";

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

interface PipelineResult {
  pipeline_status: "pass" | "fail" | "partial";
  steps: PipelineStep[];
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

const STATION_RULES: {
  label: string;
  minBends: number;
  maxBends: number;
  minStations: number;
  maxStations: number;
}[] = [
  { label: "Simple U/C channel",      minBends: 1, maxBends: 2,  minStations: 6,  maxStations: 8  },
  { label: "Standard C/Z channel",    minBends: 3, maxBends: 4,  minStations: 8,  maxStations: 12 },
  { label: "Lipped channel / purlin", minBends: 5, maxBends: 6,  minStations: 10, maxStations: 14 },
  { label: "Shutter / complex",       minBends: 7, maxBends: 10, minStations: 12, maxStations: 18 },
  { label: "Ultra-complex / multi-return", minBends: 11, maxBends: 999, minStations: 16, maxStations: 24 },
];

const MATERIAL_STATION_PENALTY: Record<string, number> = {
  SS: 2, TI: 4, HSLA: 2, HR: 1, GI: 0, CR: 0, AL: 0, MS: 0, CU: 0, PP: 1,
};

const THICKNESS_STATION_PENALTY = (t: number): number =>
  t < 0.5 ? 2 : t > 3.0 ? 1 : 0;

function estimateStations(bendCount: number, material: string, thickness: number): {
  min: number; max: number; recommended: number; complexity: string;
} {
  const rule = STATION_RULES.find(r => bendCount >= r.minBends && bendCount <= r.maxBends)
    ?? STATION_RULES[STATION_RULES.length - 1]!;
  const penalty = (MATERIAL_STATION_PENALTY[material.toUpperCase()] ?? 0) + THICKNESS_STATION_PENALTY(thickness);
  return {
    min: rule.minStations + penalty,
    max: rule.maxStations + penalty,
    recommended: Math.round((rule.minStations + rule.maxStations) / 2) + penalty,
    complexity: rule.label,
  };
}

function classifySection(bendCount: number): string {
  if (bendCount <= 2) return "simple";
  if (bendCount <= 4) return "standard";
  if (bendCount <= 6) return "lipped";
  return "complex";
}

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
      fail("import", "Geometry Import", 1, "No geometry provided. Upload a DXF/DWG file or draw a profile.");
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, []));
      return;
    }
    if (geometry.segments.length === 0) {
      fail("import", "Geometry Import", 1, "Geometry has zero segments. Check DXF file — profile may be empty or use unsupported entities (SPLINE).");
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, []));
      return;
    }
    pass("import", "Geometry Import", 1, {
      segmentCount: geometry.segments.length,
      boundingBox: geometry.boundingBox,
    });

    // ─── STEP 2: Profile Validation ────────────────────────────────────────
    const { boundingBox, segments, bends, totalLength } = geometry;
    const sectionWidth = parseFloat((boundingBox.width ?? 0).toFixed(2));
    const sectionHeight = parseFloat((boundingBox.height ?? 0).toFixed(2));
    const bendCount = bends?.length ?? 0;

    if (sectionWidth < 1 || sectionHeight < 1) {
      fail("profile", "Profile Validation", 2, `Profile dimensions too small (W=${sectionWidth}mm, H=${sectionHeight}mm). Check DXF units — may need to scale.`);
    } else if (bendCount === 0) {
      warn("profile", "Profile Validation", 2, "No bends detected — profile appears to be a flat strip.", {
        sectionWidth, sectionHeight, bendCount, totalLength,
      });
      notes.push("Profile has no bends — treated as flat strip. Verify the profile is correct.");
    } else {
      pass("profile", "Profile Validation", 2, {
        sectionWidth, sectionHeight, bendCount, totalLength: parseFloat(totalLength.toFixed(2)),
      });
    }

    if (pipelineFailed) {
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, []));
      return;
    }

    // ─── STEP 3: Thickness Input Validation ────────────────────────────────
    const thickness = parseFloat(String(rawThickness));
    if (isNaN(thickness) || thickness <= 0) {
      fail("thickness", "Sheet Thickness", 3, "Invalid or missing thickness. Provide a positive number in mm (e.g. 0.8, 1.5, 2.0).");
      res.status(400).json(buildResult("fail", steps, errors, warnings, notes, []));
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

    // ─── STEP 5: Strip Width / Neutral Axis ────────────────────────────────
    // K-factors per DIN 6935
    const K_FACTORS_MAP: Record<string, number> = {
      GI: 0.44, CR: 0.44, HR: 0.42, SS: 0.50, AL: 0.43,
      MS: 0.42, CU: 0.44, TI: 0.50, PP: 0.44, HSLA: 0.45,
    };
    const kFactor = K_FACTORS_MAP[effectiveMaterial] ?? 0.44;

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
      pass("strip-width", "Neutral Axis / Strip Width", 5, {
        strip_width_mm: parseFloat(stripWidth.toFixed(2)),
        method: "DIN 6935 K-factor neutral axis",
        k_factor: kFactor,
      });
    } catch {
      warn("strip-width", "Neutral Axis / Strip Width", 5, "Strip width calculation fell back to total profile length.", { strip_width_mm: parseFloat(totalLength.toFixed(2)) });
      stripWidth = totalLength;
    }

    // ─── STEP 6: Station Estimation ────────────────────────────────────────
    const stationEst = estimateStations(bendCount, effectiveMaterial, thickness);
    const numStations = stationEst.recommended;
    const sectionType = classifySection(bendCount);
    notes.push(`Profile type: ${stationEst.complexity} — ${stationEst.min}–${stationEst.max} stations recommended.`);
    pass("station-count", "Station Count Estimation", 6, {
      bend_count: bendCount,
      recommended_stations: numStations,
      min_stations: stationEst.min,
      max_stations: stationEst.max,
      complexity: stationEst.complexity,
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

      pass("flower", "Flower Pattern Generation", 7, {
        stations_generated: flowerStations.length,
        accuracy_score: accuracyScore,
        auto_corrections: deepResult.autoCorrections.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Flower pattern generation failed";
      fail("flower", "Flower Pattern Generation", 7, msg);
      res.status(500).json(buildResult("fail", steps, errors, warnings, notes, []));
      return;
    }

    // ─── STEP 8: Shaft & Bearing Calculation ───────────────────────────────
    let rollToolingResult: unknown[] = [];
    let maxShaftDiameter = 40;
    let primaryBearing = "6210";
    let maxFormingForce = 0;

    try {
      rollToolingResult = generateRollTooling(
        flowerStations as Parameters<typeof generateRollTooling>[0],
        effectiveMaterial,
        thickness,
        userShaft ?? 40,
        0.05,
        motorKw,
        rpm,
      );

      for (const rt of rollToolingResult as Array<{ shaft?: { selectedDiaMm?: number }; bearing?: { designation?: string }; rollOD?: { upperOD?: number }; formingForceN?: number }>) {
        if ((rt.shaft?.selectedDiaMm ?? 0) > maxShaftDiameter) maxShaftDiameter = rt.shaft!.selectedDiaMm!;
        if (rt.bearing?.designation) primaryBearing = rt.bearing.designation;
        if ((rt.formingForceN ?? 0) > maxFormingForce) maxFormingForce = rt.formingForceN!;
      }

      notes.push(`Shaft: ${maxShaftDiameter}mm diameter selected (Shigley's MSS method, SF=2.5).`);
      notes.push(`Bearing: ${primaryBearing} deep-groove (SKF L10 ≥ 20,000hrs verified).`);
      pass("shaft-bearing", "Shaft & Bearing Selection", 8, {
        shaft_diameter_mm: maxShaftDiameter,
        bearing_type: primaryBearing,
        max_forming_force_kn: parseFloat((maxFormingForce / 1000).toFixed(2)),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Shaft/bearing calculation failed";
      warn("shaft-bearing", "Shaft & Bearing Selection", 8, msg, {
        shaft_diameter_mm: 50,
        bearing_type: "6210",
      });
      maxShaftDiameter = 50;
    }

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
    pass("report", "Engineering Report", 10, { accuracy_score: accuracyScore });

    const result = buildResult(overallStatus, steps, errors, warnings, notes, rollToolingResult);
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
    res.status(500).json(buildResult("fail", steps, errors, warnings, notes, []));
  }
});

function buildResult(
  status: "pass" | "fail" | "partial",
  steps: PipelineStep[],
  errors: string[],
  warnings: string[],
  notes: string[],
  rollTooling: unknown[],
): PipelineResult {
  return {
    pipeline_status: status,
    steps,
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
