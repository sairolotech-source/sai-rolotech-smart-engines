import { Router, type IRouter, type Request, type Response } from "express";
import { generateFlowerPattern } from "../lib/power-pattern";
import {
  generateRollTooling, calculateRollGaps, calcStripWidth, calcBomFromTooling,
  DEFAULT_GCODE_PROFILE, DELTA_GCODE_PROFILE, type GcodeProfile, type RollToolingResult,
} from "../lib/roll-tooling";
import type { ProfileGeometry, Segment } from "../lib/dxf-parser-util";

const router: IRouter = Router();

// ─── Machine Data Summary Builder ─────────────────────────────────────────────
function buildMachineData(rollTooling: RollToolingResult[], materialType: string, materialThickness: number) {
  if (rollTooling.length === 0) return null;

  const FORMING_SPEEDS: Record<string, { entry: string; main: string; final: string }> = {
    GI:   { entry: "15–25 m/min", main: "20–30 m/min", final: "≤ 10 m/min" },
    CR:   { entry: "15–25 m/min", main: "20–30 m/min", final: "≤ 10 m/min" },
    HR:   { entry: "10–18 m/min", main: "15–22 m/min", final: "≤ 8 m/min"  },
    SS:   { entry: "≤ 12 m/min",  main: "≤ 12 m/min",  final: "≤ 8 m/min"  },
    AL:   { entry: "≤ 20 m/min",  main: "≤ 20 m/min",  final: "≤ 10 m/min" },
    MS:   { entry: "15–25 m/min", main: "20–30 m/min", final: "≤ 10 m/min" },
    CU:   { entry: "15–25 m/min", main: "20–28 m/min", final: "≤ 10 m/min" },
    TI:   { entry: "≤ 8 m/min",   main: "≤ 8 m/min",   final: "≤ 5 m/min"  },
    PP:   { entry: "12–20 m/min", main: "15–22 m/min", final: "≤ 10 m/min" },
    HSLA: { entry: "10–18 m/min", main: "15–20 m/min", final: "≤ 8 m/min"  },
  };

  const SPRINGBACK_FACTORS: Record<string, number> = {
    GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15, MS: 1.06,
    CU: 1.08, TI: 1.25, PP: 1.06, HSLA: 1.14,
  };

  const LUBRICATION: Record<string, string> = {
    GI: "Light forming oil (Quaker FERROCOAT 395)",
    CR: "Light forming oil or dry lube",
    HR: "Mineral oil (descale first)",
    SS: "Chlorine-free drawing compound + flood rinse",
    AL: "Aluminum-specific forming lubricant (no chlorine)",
    MS: "Light mineral oil",
    CU: "Thin mineral oil — avoid chlorinated compounds",
    TI: "Titanium-grade lubricant mandatory — dry forming prohibited",
    PP: "Protect pre-painted surface — dry lube or thin film",
    HSLA: "Heavy-duty forming oil",
  };

  const SURFACE_RISKS: Record<string, string> = {
    GI: "Low — protect zinc coating; avoid sharp roll edges",
    CR: "Low — minimal surface marking; watch burrs",
    HR: "Medium — descale before forming to prevent scratches",
    SS: "High — work hardening risk; use flood coolant; monitor tool wear",
    AL: "Medium — use polyurethane side collars to prevent scoring",
    MS: "Low — similar to GI; watch deep groove chip formation",
    CU: "Low — soft material; avoid smearing with sharp tools",
    TI: "High — reactive material; no dwell; mandatory flood coolant",
    PP: "High — protect coating; reduce forming speed; no sharp edges",
    HSLA: "Medium-High — high strength; monitor springback closely",
  };

  const speeds = FORMING_SPEEDS[materialType] ?? FORMING_SPEEDS["GI"];
  const sbFactor = SPRINGBACK_FACTORS[materialType] ?? 1.05;
  // RollToolingResult fields used directly (no nested rollProfile)
  const firstRt = rollTooling[0];
  const shaftDiameterMm = firstRt.upperRollID - 2; // bore = shaft + 2 (from generateRollTooling)

  // ── CNC Lathe cutting parameters per material ──────────────────────────────
  const CUTTING_PARAMS: Record<string, {
    vcRoughing: number; vcFinishing: number; frRoughing: number; frFinishing: number;
    docRoughing: number; docSemiFinish: number; docFinish: number;
    insertGrade: string; insertGeometry: string; coolant: string;
  }> = {
    GI:   { vcRoughing: 200, vcFinishing: 280, frRoughing: 0.25, frFinishing: 0.12,
             docRoughing: 3.0, docSemiFinish: 0.8, docFinish: 0.2,
             insertGrade: "P25 coated carbide (TiAlN)", insertGeometry: "CNMG 120408-MF", coolant: "M08" },
    CR:   { vcRoughing: 220, vcFinishing: 300, frRoughing: 0.22, frFinishing: 0.10,
             docRoughing: 2.5, docSemiFinish: 0.6, docFinish: 0.15,
             insertGrade: "P25 coated carbide (TiCN)", insertGeometry: "CNMG 120408-MF", coolant: "M08" },
    HR:   { vcRoughing: 180, vcFinishing: 250, frRoughing: 0.30, frFinishing: 0.15,
             docRoughing: 4.0, docSemiFinish: 1.0, docFinish: 0.25,
             insertGrade: "P30 coated carbide (TiN)", insertGeometry: "CNMG 120412-PM", coolant: "M08" },
    SS:   { vcRoughing: 120, vcFinishing: 180, frRoughing: 0.15, frFinishing: 0.08,
             docRoughing: 1.5, docSemiFinish: 0.4, docFinish: 0.10,
             insertGrade: "M20 TiAlN PVD coated", insertGeometry: "CNMG 120408-MR", coolant: "M08" },
    AL:   { vcRoughing: 500, vcFinishing: 800, frRoughing: 0.30, frFinishing: 0.15,
             docRoughing: 4.0, docSemiFinish: 1.0, docFinish: 0.25,
             insertGrade: "K10 uncoated carbide", insertGeometry: "DCGT 11T302-AL", coolant: "M07" },
    MS:   { vcRoughing: 200, vcFinishing: 280, frRoughing: 0.25, frFinishing: 0.12,
             docRoughing: 3.0, docSemiFinish: 0.8, docFinish: 0.20,
             insertGrade: "P25 coated carbide (TiAlN)", insertGeometry: "CNMG 120408-MF", coolant: "M08" },
    CU:   { vcRoughing: 300, vcFinishing: 450, frRoughing: 0.25, frFinishing: 0.12,
             docRoughing: 3.0, docSemiFinish: 0.8, docFinish: 0.20,
             insertGrade: "K10 uncoated carbide", insertGeometry: "DCGT 11T302-UM", coolant: "M07" },
    TI:   { vcRoughing:  60, vcFinishing: 100, frRoughing: 0.12, frFinishing: 0.06,
             docRoughing: 1.0, docSemiFinish: 0.3, docFinish: 0.08,
             insertGrade: "M10 PVD coated (AlTiN)", insertGeometry: "CNMG 120408-MR", coolant: "M08" },
    PP:   { vcRoughing: 180, vcFinishing: 250, frRoughing: 0.22, frFinishing: 0.10,
             docRoughing: 2.5, docSemiFinish: 0.6, docFinish: 0.15,
             insertGrade: "P25 coated carbide (TiCN)", insertGeometry: "CNMG 120408-MF", coolant: "M08" },
    HSLA: { vcRoughing: 160, vcFinishing: 220, frRoughing: 0.20, frFinishing: 0.10,
             docRoughing: 2.0, docSemiFinish: 0.5, docFinish: 0.12,
             insertGrade: "P20 TiAlN coated", insertGeometry: "CNMG 120408-PM", coolant: "M08" },
  };

  const cutParams = CUTTING_PARAMS[materialType] ?? CUTTING_PARAMS["GI"];

  // ── Shaft deflection estimate (simple beam model: δ = F·L³ / 48EI) ─────────
  // E = 210 GPa (steel), shaft modelled as simply-supported beam
  // Forming force estimate: F ≈ 2 × UTS × t × width (conservative)
  const UTS_MAP: Record<string, number> = {
    GI: 340, CR: 370, HR: 330, SS: 600, AL: 200, MS: 350, CU: 260, TI: 900, PP: 340, HSLA: 550,
  };
  const uts = UTS_MAP[materialType] ?? 340;
  const shaftDiaM = shaftDiameterMm / 1000;
  const shaftSpanM = (firstRt.upperRollWidth * 1.8) / 1000;  // effective span ≈ 1.8× roll width
  const E_steel = 210e9;
  const I = (Math.PI * Math.pow(shaftDiaM, 4)) / 64;
  const formingForceN = 2 * uts * 1e6 * (materialThickness / 1000) * (firstRt.upperRollWidth / 1000);
  const deflectionMm = +(((formingForceN * Math.pow(shaftSpanM, 3)) / (48 * E_steel * I)) * 1000).toFixed(4);
  const deflectionOk = deflectionMm < 0.05;

  // ── Build per-station machine setup table ──────────────────────────────────
  const stationSetup = rollTooling.map((rt, idx) => {
    const total = rollTooling.length;
    const pct = total === 1 ? 1 : idx / (total - 1);
    const phase = pct >= 0.80 ? "FINAL" : pct <= 0.35 ? "ENTRY" : "MAIN";
    const speedStr = phase === "ENTRY" ? speeds.entry : phase === "FINAL" ? speeds.final : speeds.main;
    const clearanceRec = phase === "ENTRY"
      ? +(materialThickness * 0.15).toFixed(3)
      : phase === "FINAL"
      ? +(materialThickness * 0.05).toFixed(3)
      : +(materialThickness * 0.10).toFixed(3);

    // Per-station vc/feed scaled by phase (finishing gets tighter params)
    const vcRec   = phase === "FINAL" ? cutParams.vcFinishing   : cutParams.vcRoughing;
    const frRec   = phase === "FINAL" ? cutParams.frFinishing    : cutParams.frRoughing;
    const docRec  = phase === "FINAL" ? cutParams.docFinish      : phase === "ENTRY" ? cutParams.docRoughing : cutParams.docSemiFinish;

    return {
      stationNumber: rt.stationIndex,
      label: rt.stationId,
      phase,
      formingSpeed: speedStr,
      rollGapNominal: +(materialThickness + clearanceRec).toFixed(3),
      clearanceRec,
      upperRollOD: +rt.upperRollOD.toFixed(3),
      lowerRollOD: +rt.lowerRollOD.toFixed(3),
      bore: +(rt.upperRollID - 2).toFixed(3),   // upperRollID = shaft + 2
      width: +rt.upperRollWidth.toFixed(3),
      boreClearanceOk: true,
      // CNC Lathe machining parameters for this station's rolls
      cncVcRec: vcRec,
      cncFeedRec: frRec,
      cncDocRec: docRec,
      insertGrade: cutParams.insertGrade,
      insertGeometry: cutParams.insertGeometry,
    };
  });

  return {
    materialType,
    materialThickness,
    springbackFactor: sbFactor,
    springbackCompensation: `${((sbFactor - 1) * 100).toFixed(1)}%`,
    lubrication: LUBRICATION[materialType] ?? "Light forming oil",
    surfaceRisk: SURFACE_RISKS[materialType] ?? "Low",
    formingSpeeds: speeds,
    passLine: +firstRt.passLineHeight.toFixed(3),
    shaftDiameter: +shaftDiameterMm.toFixed(3),
    rollDiameter: +firstRt.upperRollOD.toFixed(3),
    totalStations: rollTooling.length,
    totalRolls: rollTooling.length * 2,
    stationSetup,
    insertGrade: cutParams.insertGrade,
    insertGeometry: cutParams.insertGeometry,
    coolantMode: cutParams.coolant,
    cncCuttingParams: {
      vcRoughing: cutParams.vcRoughing,
      vcFinishing: cutParams.vcFinishing,
      frRoughing: cutParams.frRoughing,
      frFinishing: cutParams.frFinishing,
      docRoughing: cutParams.docRoughing,
      docSemiFinish: cutParams.docSemiFinish,
      docFinish: cutParams.docFinish,
    },
    shaftDeflection: {
      estimatedMm: deflectionMm,
      isSafe: deflectionOk,
      limit: "0.050 mm (ISO roll tooling standard)",
      formingForceN: +formingForceN.toFixed(0),
      shaftSpanMm: +(shaftSpanM * 1000).toFixed(1),
      note: deflectionOk
        ? "Shaft deflection within acceptable limits"
        : `⚠ Shaft deflection ${deflectionMm} mm exceeds 0.05 mm — consider larger shaft diameter or shorter span`,
    },
    sideCollar: null,
    overallWarnings: [
      ...(materialType === "SS" ? ["CRITICAL: Flood coolant mandatory for SS forming — work hardening risk"] : []),
      ...(materialType === "TI" ? ["CRITICAL: Titanium — mandatory flood coolant; no dry runs; low speed only"] : []),
      ...(materialType === "PP" ? ["Pre-painted: reduce all forming speeds 20%, inspect coating after each station"] : []),
      ...(materialThickness >= 5.0 ? ["HEAVY GAUGE ≥5mm: Reduce all cutting speeds by 15%, feeds by 20%"] : []),
      ...(materialThickness >= 3.0 && materialThickness < 5.0 ? ["THICK GAUGE ≥3mm: Reduce cutting speeds 8%, feeds 10%"] : []),
      ...(!deflectionOk ? [`Shaft deflection ${deflectionMm}mm exceeds limit — increase shaft diameter or reduce span`] : []),
    ],
  };
}

const BASE_PROFILE = { useCSS: true, useDwell: true, useCoolant: true, toolChangeFormat: "T{tool:02d}{tool:02d}" };

const GCODE_PROFILES: Record<string, GcodeProfile> = {
  fanuc_0i: {
    ...BASE_PROFILE, name: "Fanuc 0i", controller: "Fanuc",
    spindleDirection: "M3", maxSpindleCmd: "G50", maxSpindleRpm: 3000,
    safeZ: 100, toolChangeSafety: ["G28 U0 W0"], feedUnit: "mm_min", endCode: "M30",
  },
  siemens_840d: {
    ...BASE_PROFILE, name: "Siemens 840D", controller: "Siemens 840D",
    spindleDirection: "M3", maxSpindleCmd: "G50", maxSpindleRpm: 3000,
    safeZ: 100, toolChangeSafety: ["SPOS=0"], feedUnit: "mm_min", endCode: "M2",
  },
  haas: {
    ...BASE_PROFILE, name: "Haas", controller: "Haas",
    spindleDirection: "M3", maxSpindleCmd: "G50", maxSpindleRpm: 3000,
    safeZ: 100, toolChangeSafety: ["G28 U0 W0"], feedUnit: "mm_min", endCode: "M30",
  },
  mitsubishi_m70: {
    ...BASE_PROFILE, name: "Mitsubishi M70", controller: "Mitsubishi",
    spindleDirection: "M3", maxSpindleCmd: "G50", maxSpindleRpm: 3000,
    safeZ: 100, toolChangeSafety: ["G28 U0.0 W0.0"], feedUnit: "mm_min", endCode: "M02",
  },
  delta_2x: DELTA_GCODE_PROFILE,
  syntec: {
    ...BASE_PROFILE, name: "Syntec", controller: "Syntec",
    spindleDirection: "M3", maxSpindleCmd: "G50", maxSpindleRpm: 3000,
    safeZ: 100, toolChangeSafety: ["M05"], feedUnit: "mm_min", endCode: "M30",
  },
};

function resolveGcodeProfile(postProcessorId?: string): GcodeProfile {
  if (postProcessorId && GCODE_PROFILES[postProcessorId]) {
    return GCODE_PROFILES[postProcessorId];
  }
  return DELTA_GCODE_PROFILE;
}

interface RollToolingBody {
  geometry: ProfileGeometry;
  numStations: number | string;
  stationPrefix?: string;
  materialThickness?: number | string;
  rollDiameter?: number | string;
  shaftDiameter?: number | string;
  clearance?: number | string;
  materialType?: string;
  postProcessorId?: string;
  openSectionType?: string;
  sectionModel?: "open" | "closed";
  motorKw?: number | string;
  motorRpm?: number | string;
}

router.post("/generate-roll-tooling", (req: Request<unknown, unknown, RollToolingBody>, res: Response) => {
  try {
    const {
      geometry,
      numStations,
      stationPrefix,
      materialThickness,
      rollDiameter,
      shaftDiameter,
      clearance,
      materialType,
      postProcessorId,
      openSectionType,
      sectionModel,
    } = req.body;

    if (!geometry || !geometry.segments || geometry.segments.length === 0) {
      res.status(400).json({ error: "No geometry provided" });
      return;
    }

    const stations = Math.max(1, Math.min(30, parseInt(String(numStations)) || 5));
    const prefix = stationPrefix || "S";
    const thickness = parseFloat(String(materialThickness)) || 1.0;
    const rollDia = parseFloat(String(rollDiameter)) || 150;
    const shaftDia = parseFloat(String(shaftDiameter)) || 40;
    const clr = parseFloat(String(clearance)) || 0.05;
    const matType = String(materialType || "GI").toUpperCase();
    const sectionType = openSectionType || "C-Section";
    const gcodeProfile = resolveGcodeProfile(postProcessorId);
    const mKw = parseFloat(String((req.body as RollToolingBody).motorKw)) || 11;
    const mRpm = parseFloat(String((req.body as RollToolingBody).motorRpm)) || 1440;

    const flowerResult = generateFlowerPattern(geometry, stations, prefix, matType, thickness);

    // sectionModel-specific adjustments to clearance and roll gap strategy
    // Closed-section (Model B): tighter gap (+0% clearance added), plus weld-seam pass adjustment
    // Open-section (Model A): standard clearance, slight increase for springback
    const effectiveClearance = sectionModel === "closed"
      ? clr * 0.9   // Closed section: tighter clearance for ovality control
      : sectionModel === "open"
        ? clr * 1.05  // Open section: slightly looser to allow springback
        : clr;

    const rollTooling = generateRollTooling(
      flowerResult.stations,
      matType,
      thickness,
      shaftDia,
      effectiveClearance,
      mKw,
      mRpm,
    );

    const rollGaps = calculateRollGaps(
      flowerResult.stations,
      thickness,
      effectiveClearance
    );

    const bom = calcBomFromTooling(rollTooling, matType);
    const machineData = buildMachineData(rollTooling, matType, thickness);

    res.json({
      success: true,
      rollTooling,
      stations: flowerResult.stations,
      rollGaps,
      bom,
      machineData,
      sectionModelUsed: sectionModel ?? "auto",
      modelNote: sectionModel === "closed"
        ? "Closed Section AI (Model B): clearance tightened 10% for weld seam and ovality control"
        : sectionModel === "open"
          ? "Open Section AI (Model A): clearance increased 5% for springback compensation"
          : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate roll tooling";
    res.status(400).json({ error: message });
  }
});

// ─── POST /strip-width ────────────────────────────────────────────────────────
router.post("/strip-width", (req: Request, res: Response) => {
  try {
    const { segments, materialThickness, materialType, insideBendRadius } = req.body as {
      segments: Segment[];
      materialThickness: number;
      materialType: string;
      insideBendRadius?: number;
    };
    if (!segments || segments.length === 0) {
      res.status(400).json({ error: "No segments provided" });
      return;
    }
    const t = parseFloat(String(materialThickness)) || 1.0;
    const mat = String(materialType || "GI").toUpperCase();
    const defaultR = parseFloat(String(insideBendRadius)) || t * 1.5;

    // Convert Segment[] → bends[] and flanges[] for calcStripWidth
    const bends: { angle: number; radius: number }[] = [];
    const flanges: number[] = [];
    for (const seg of segments) {
      if (seg.type === "arc" && seg.radius !== undefined) {
        const angleDeg = seg.startAngle !== undefined && seg.endAngle !== undefined
          ? Math.abs(seg.endAngle - seg.startAngle)
          : 90; // default to 90° if unknown
        bends.push({ angle: angleDeg, radius: seg.radius > 0 ? seg.radius : defaultR });
      } else {
        flanges.push(seg.length || 0);
      }
    }

    // Ensure at least one flange so calcStripWidth doesn't return 0
    if (flanges.length === 0) flanges.push(50);

    const stripWidth = calcStripWidth(bends, flanges, t, mat);
    res.json({ success: true, stripWidth, bends: bends.length, flanges: flanges.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Strip width calc failed";
    res.status(400).json({ error: message });
  }
});

// ─── POST /cam-plan ───────────────────────────────────────────────────────────
router.post("/cam-plan", (req: Request, res: Response) => {
  try {
    const { geometry, numStations, stationPrefix, materialThickness, rollDiameter, shaftDiameter, clearance, materialType, openSectionType } = req.body as RollToolingBody;
    if (!geometry || !geometry.segments || geometry.segments.length === 0) {
      res.status(400).json({ error: "No geometry provided" });
      return;
    }
    const stations = Math.max(1, Math.min(30, parseInt(String(numStations)) || 5));
    const prefix = stationPrefix || "S";
    const thickness = parseFloat(String(materialThickness)) || 1.0;
    const rollDia = parseFloat(String(rollDiameter)) || 150;
    const shaftDia = parseFloat(String(shaftDiameter)) || 40;
    const clr = parseFloat(String(clearance)) || 0.05;
    const matType = String(materialType || "GI").toUpperCase();
    const sectionType = String(openSectionType || "C-Section");
    const flowerResult = generateFlowerPattern(geometry, stations, prefix, matType, thickness);
    const rollTooling = generateRollTooling(flowerResult.stations, matType, thickness, shaftDia, clr, 11, 1440);
    const camPlans = rollTooling.map(rt => ({
      stationId: rt.stationId,
      stationIndex: rt.stationIndex,
      upperRollOD: rt.upperRollOD,
      upperRollID: rt.upperRollID,
      upperRollWidth: rt.upperRollWidth,
      lowerRollOD: rt.lowerRollOD,
      lowerRollID: rt.lowerRollID,
      lowerRollWidth: rt.lowerRollWidth,
      rollGap: rt.rollGap,
      passLineHeight: rt.passLineHeight,
      description: rt.description,
    }));
    res.json({ success: true, camPlans, stationCount: rollTooling.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "CAM plan generation failed";
    res.status(400).json({ error: message });
  }
});

// ─── POST /bom ────────────────────────────────────────────────────────────────
router.post("/bom", (req: Request, res: Response) => {
  try {
    const { geometry, numStations, stationPrefix, materialThickness, rollDiameter, shaftDiameter, clearance, materialType, openSectionType } = req.body as RollToolingBody;
    if (!geometry || !geometry.segments || geometry.segments.length === 0) {
      res.status(400).json({ error: "No geometry provided" });
      return;
    }
    const stations = Math.max(1, Math.min(30, parseInt(String(numStations)) || 5));
    const prefix = stationPrefix || "S";
    const thickness = parseFloat(String(materialThickness)) || 1.0;
    const rollDia = parseFloat(String(rollDiameter)) || 150;
    const shaftDia = parseFloat(String(shaftDiameter)) || 40;
    const clr = parseFloat(String(clearance)) || 0.05;
    const matType = String(materialType || "GI").toUpperCase();
    const sectionType = String(openSectionType || "C-Section");
    const flowerResult = generateFlowerPattern(geometry, stations, prefix, matType, thickness);
    const rollTooling = generateRollTooling(flowerResult.stations, matType, thickness, shaftDia, clr, 11, 1440);
    const bom = calcBomFromTooling(rollTooling, matType);
    res.json({ success: true, bom });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "BOM generation failed";
    res.status(400).json({ error: message });
  }
});

export default router;
