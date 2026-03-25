import type { FlowerStation } from "./power-pattern.js";
import type { Segment } from "./dxf-parser-util.js";

export interface GcodeProfile {
  name: string;
  controller: string;
  spindleDirection: "M3" | "M4";
  useCSS: boolean;
  useDwell: boolean;
  useCoolant: boolean;
  toolChangeFormat: string;
  maxSpindleCmd?: string;
  maxSpindleRpm?: number;
  safeZ?: number;
  toolChangeSafety?: string[];
  feedUnit?: string;
  endCode?: string;
  [key: string]: unknown;
}

export const DEFAULT_GCODE_PROFILE: GcodeProfile = {
  name: "Fanuc",
  controller: "Fanuc",
  spindleDirection: "M3",
  useCSS: true,
  useDwell: true,
  useCoolant: true,
  toolChangeFormat: "T{tool:02d}{tool:02d}",
};

export const DELTA_GCODE_PROFILE: GcodeProfile = {
  name: "Delta 2X",
  controller: "Delta 2X",
  spindleDirection: "M4",
  useCSS: false,
  useDwell: false,
  useCoolant: false,
  toolChangeFormat: "T{tool:04d} ()",
};

export interface BearingSpec {
  designation: string;
  boreMm: number;
  odMm: number;
  widthMm: number;
  C_kN: number;
  C0_kN: number;
  massKg: number;
}

export interface KeywaySpec {
  widthMm: number;
  heightMm: number;
  shaftDepthT1Mm: number;
  hubDepthT2Mm: number;
  standard: string;
  length: string;
}

export interface ShaftCalcResult {
  requiredDiaMm: number;
  selectedDiaMm: number;
  bendingMomentNm: number;
  torqueNm: number;
  combinedStressMpa: number;
  safetyFactor: number;
  deflectionMm: number;
  keyway: KeywaySpec;
  toleranceFit: { shaft: string; bore: string; interference: string };
  surfaceFinish: { bearingSeat: string; keywaySurface: string; rollBody: string };
  recommendedMaterial: string;
  locknuts: string;
  stressConcentrationKf: number;
  shaftYieldMpa: number;
}

export interface RollODResult {
  upperOD: number;
  lowerOD: number;
  profileDepth: number;
  minWallThickness: number;
  formula: string;
}

export interface StandPitchResult {
  pitchMm: number;
  rollWidthMm: number;
  bearingWidthMm: number;
  locknuts: number;
  housingClearance: number;
  formula: string;
}

export type RollTypeCode = "GUIDE" | "BREAKDOWN" | "FORMING" | "GROOVE" | "FINPASS" | "SIZING" | "SIDE";

export interface RollTypeInfo {
  code: RollTypeCode;
  name: string;
  description: string;
  grooveShape: "flat" | "shallow-v" | "v-groove" | "u-groove" | "deep-groove" | "fin";
  grooveAngleDeg: number;
  grooveDepthFraction: number;
  filletRadiusMm: number;
  phase: "ENTRY" | "FORMING" | "CLOSING" | "SIZING";
  color: string;
}

export interface RollMaterialRec {
  toolSteel: string;
  hardnessHRC: string;
  surfaceTreatment: string;
  treatmentNote: string;
  alternativeMaterial: string;
  lubricantRecommended: string;
  lifeHrs: number;
}

export interface RollToolingResult {
  stationId: string;
  stationIndex: number;
  upperRollOD: number;
  upperRollID: number;
  upperRollWidth: number;
  lowerRollOD: number;
  lowerRollID: number;
  lowerRollWidth: number;
  rollGap: number;
  passLineHeight: number;
  kFactor: number;
  neutralAxis: number;
  deflection: number;
  concentricityTolerance: number;
  material: string;
  description: string;
  shaftCalc: ShaftCalcResult;
  bearing: BearingSpec;
  rollODCalc: RollODResult;
  standPitch: StandPitchResult;
  profileDepthMm: number;
  rollType: RollTypeInfo;
  rollMaterial: RollMaterialRec;
}

/**
 * FIX: K_FACTORS synchronized with deep-accuracy-engine.ts MATERIAL_PROPS.kFactor
 * Previous: GI:0.38, SS:0.44, CU:0.37, PP:0.36, AL:0.39 — inconsistent with engine.ts
 * Source: DIN 6935 Table 3 / MATERIAL_PROPS in deep-accuracy-engine.ts
 */
const K_FACTORS: Record<string, number> = {
  GI:   0.44,   // was 0.38
  CR:   0.44,   // was 0.40
  HR:   0.42,   // unchanged
  SS:   0.50,   // was 0.44 — austenitic SS high work-hardening (DIN 6935 App.A)
  AL:   0.43,   // was 0.39
  MS:   0.42,   // was 0.38
  CU:   0.44,   // was 0.37
  TI:   0.50,   // was 0.45
  PP:   0.44,   // was 0.36 — pre-painted = GI base
  HSLA: 0.45,   // was 0.43
};

const SHAFT_YIELD_MPA: Record<string, number> = {
  C45: 400, "En8": 380, "En24": 540, "En36": 580, "42CrMo4": 650, "SCM440": 640,
};
const DEFAULT_SHAFT_YIELD = 400;

interface KeywayRow { minDia: number; maxDia: number; b: number; h: number; t1: number; t2: number }
const DIN6885_KEYWAY: KeywayRow[] = [
  { minDia:  6, maxDia: 8,   b: 2,  h: 2,  t1: 1.2, t2: 1.0 },
  { minDia:  8, maxDia: 10,  b: 3,  h: 3,  t1: 1.8, t2: 1.4 },
  { minDia: 10, maxDia: 12,  b: 4,  h: 4,  t1: 2.5, t2: 1.8 },
  { minDia: 12, maxDia: 17,  b: 5,  h: 5,  t1: 3.0, t2: 2.3 },
  { minDia: 17, maxDia: 22,  b: 6,  h: 6,  t1: 3.5, t2: 2.8 },
  { minDia: 22, maxDia: 30,  b: 8,  h: 7,  t1: 4.0, t2: 3.3 },
  { minDia: 30, maxDia: 38,  b: 10, h: 8,  t1: 5.0, t2: 3.3 },
  { minDia: 38, maxDia: 44,  b: 12, h: 8,  t1: 5.0, t2: 3.3 },
  { minDia: 44, maxDia: 50,  b: 14, h: 9,  t1: 5.5, t2: 3.8 },
  { minDia: 50, maxDia: 58,  b: 16, h: 10, t1: 6.0, t2: 4.3 },
  { minDia: 58, maxDia: 65,  b: 18, h: 11, t1: 7.0, t2: 4.4 },
  { minDia: 65, maxDia: 75,  b: 20, h: 12, t1: 7.5, t2: 4.9 },
  { minDia: 75, maxDia: 85,  b: 22, h: 14, t1: 9.0, t2: 5.4 },
  { minDia: 85, maxDia: 95,  b: 25, h: 14, t1: 9.0, t2: 5.4 },
  { minDia: 95, maxDia: 110, b: 28, h: 16, t1:10.0, t2: 6.4 },
  { minDia: 110, maxDia: 130,b: 32, h: 18, t1:11.0, t2: 7.4 },
];

interface LocknusRow { minDia: number; maxDia: number; thread: string; nut: string }
const DIN981_LOCKNUT: LocknusRow[] = [
  { minDia: 20, maxDia: 25, thread: "M20×1.5",  nut: "KM4"  },
  { minDia: 25, maxDia: 30, thread: "M25×1.5",  nut: "KM5"  },
  { minDia: 30, maxDia: 35, thread: "M30×1.5",  nut: "KM6"  },
  { minDia: 35, maxDia: 40, thread: "M35×1.5",  nut: "KM7"  },
  { minDia: 40, maxDia: 45, thread: "M40×1.5",  nut: "KM8"  },
  { minDia: 45, maxDia: 50, thread: "M45×1.5",  nut: "KM9"  },
  { minDia: 50, maxDia: 55, thread: "M50×1.5",  nut: "KM10" },
  { minDia: 55, maxDia: 60, thread: "M55×2",    nut: "KM11" },
  { minDia: 60, maxDia: 65, thread: "M60×2",    nut: "KM12" },
  { minDia: 65, maxDia: 70, thread: "M65×2",    nut: "KM13" },
  { minDia: 70, maxDia: 75, thread: "M70×2",    nut: "KM14" },
  { minDia: 75, maxDia: 80, thread: "M75×2",    nut: "KM15" },
  { minDia: 80, maxDia: 90, thread: "M80×2",    nut: "KM16" },
  { minDia: 90, maxDia:100, thread: "M90×2",    nut: "KM18" },
  { minDia:100, maxDia:120, thread: "M100×2",   nut: "KM20" },
];

function getKeyway(diaMm: number): KeywaySpec {
  const row = DIN6885_KEYWAY.find(r => diaMm >= r.minDia && diaMm <= r.maxDia)
    ?? DIN6885_KEYWAY[DIN6885_KEYWAY.length - 1]!;
  return {
    widthMm: row.b,
    heightMm: row.h,
    shaftDepthT1Mm: row.t1,
    hubDepthT2Mm: row.t2,
    standard: "DIN 6885-A (Parallel Key)",
    length: `Min ${Math.round(diaMm * 1.5)}mm — Max ${Math.round(diaMm * 2.5)}mm`,
  };
}

function getLocknut(diaMm: number): string {
  const row = DIN981_LOCKNUT.find(r => diaMm >= r.minDia && diaMm < r.maxDia)
    ?? DIN981_LOCKNUT[DIN981_LOCKNUT.length - 1]!;
  return `${row.thread} (DIN 981 ${row.nut} + Tab Washer MB${row.nut.replace("KM","")})`;
}

function recommendShaftMaterial(combinedMomentNm: number): { material: string; yieldMpa: number } {
  if (combinedMomentNm < 50)   return { material: "C45 (EN8) — Normalized", yieldMpa: 400 };
  if (combinedMomentNm < 200)  return { material: "C45 (EN8) — Induction Hardened", yieldMpa: 550 };
  if (combinedMomentNm < 600)  return { material: "42CrMo4 (EN19) — Q&T", yieldMpa: 650 };
  return { material: "34CrNiMo6 (EN24) — Q&T", yieldMpa: 800 };
}

const DEEP_GROOVE_BEARINGS: BearingSpec[] = [
  { designation: "6205", boreMm: 25, odMm: 52, widthMm: 15, C_kN: 14.0, C0_kN: 7.8, massKg: 0.10 },
  { designation: "6206", boreMm: 30, odMm: 62, widthMm: 16, C_kN: 19.5, C0_kN: 11.2, massKg: 0.16 },
  { designation: "6207", boreMm: 35, odMm: 72, widthMm: 17, C_kN: 25.5, C0_kN: 15.3, massKg: 0.23 },
  { designation: "6208", boreMm: 40, odMm: 80, widthMm: 18, C_kN: 29.0, C0_kN: 17.8, massKg: 0.30 },
  { designation: "6209", boreMm: 45, odMm: 85, widthMm: 19, C_kN: 32.5, C0_kN: 21.2, massKg: 0.35 },
  { designation: "6210", boreMm: 50, odMm: 90, widthMm: 20, C_kN: 35.0, C0_kN: 23.2, massKg: 0.42 },
  { designation: "6211", boreMm: 55, odMm: 100, widthMm: 21, C_kN: 43.5, C0_kN: 29.0, massKg: 0.55 },
  { designation: "6212", boreMm: 60, odMm: 110, widthMm: 22, C_kN: 52.5, C0_kN: 36.5, massKg: 0.72 },
  { designation: "6213", boreMm: 65, odMm: 120, widthMm: 23, C_kN: 57.5, C0_kN: 40.0, massKg: 0.88 },
  { designation: "6214", boreMm: 70, odMm: 125, widthMm: 24, C_kN: 62.0, C0_kN: 44.0, massKg: 1.00 },
  { designation: "6215", boreMm: 75, odMm: 130, widthMm: 25, C_kN: 66.0, C0_kN: 49.0, massKg: 1.10 },
  { designation: "6216", boreMm: 80, odMm: 140, widthMm: 26, C_kN: 71.5, C0_kN: 53.0, massKg: 1.30 },
  { designation: "6220", boreMm: 100, odMm: 180, widthMm: 34, C_kN: 122.0, C0_kN: 97.0, massKg: 3.10 },
];

function selectBearing(shaftDiaMm: number, radialLoadN: number, rpm: number, targetLifeHrs = 20000): BearingSpec {
  const candidates = DEEP_GROOVE_BEARINGS.filter(b => b.boreMm >= shaftDiaMm);
  const bearing = candidates[0] ?? DEEP_GROOVE_BEARINGS[DEEP_GROOVE_BEARINGS.length - 1];

  for (const b of candidates) {
    const P = Math.max(radialLoadN, 1);
    const L10 = Math.pow(b.C_kN * 1000 / P, 3) * 1e6 / (60 * Math.max(rpm, 1));
    if (L10 >= targetLifeHrs) return b;
  }
  return candidates[candidates.length - 1] ?? bearing;
}

function calcShaftDiameter(
  formingForceN: number,
  rollWidthMm: number,
  motorKw: number,
  rpm: number,
  shaftYieldMpa = DEFAULT_SHAFT_YIELD,
  safetyFactor = 2.5,          // SF=2.5 per roll forming industry standard (shock + fatigue)
): ShaftCalcResult {
  const rollWidthM = rollWidthMm / 1000;

  // Bending moment: simply supported beam, central point load
  const M_Nm = (formingForceN * rollWidthM) / 4;

  // Torque from motor power
  const P_W = motorKw * 1000;
  const T_Nm = rpm > 0 ? (P_W * 9.55) / rpm : (formingForceN * 0.05);

  // Auto-recommend material based on load before stress calc
  const combinedMomentRaw = Math.sqrt(M_Nm * M_Nm + T_Nm * T_Nm);
  const matRec = recommendShaftMaterial(combinedMomentRaw);
  const effectiveYield = Math.max(shaftYieldMpa, matRec.yieldMpa);

  // Allowable shear stress (Maximum Shear Stress theory — Shigley's Eq 6-41)
  const tau_allow = effectiveYield / (safetyFactor * 2);

  // Keyway stress concentration factor Kf = 1.6 (ASME end-milled keyway)
  const Kf = 1.6;

  // Combined loading with Kf on bending side (Kf × M for fatigue, T static)
  // d³ = (16/π × τ_allow) × √((Kf×M)² + T²)   [Shigley's Eq 6-41 variant]
  const M_eff = Kf * M_Nm;
  const combinedMoment = Math.sqrt(M_eff * M_eff + T_Nm * T_Nm);
  const d_req_m = Math.pow((16 * combinedMoment) / (Math.PI * tau_allow * 1e6), 1 / 3);
  const d_req_mm = d_req_m * 1000;

  // Round up to nearest standard ISO shaft size
  const standard = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120];
  const selected = standard.find(d => d >= d_req_mm) ?? 120;

  // Deflection check: simply supported shaft, central load (L/1000 limit per ISO)
  const I = Math.PI * Math.pow(selected / 1000, 4) / 64;
  const E = 210e9;   // Steel Young's modulus
  const deflection_mm = (formingForceN * Math.pow(rollWidthM, 3)) / (48 * E * I) * 1000;

  // Actual combined equivalent stress at selected diameter (von Mises MSS form)
  // σ_eq = (32/πd³) × √((Kf×M)² + T²)  [equivalent bending stress — Shigley's basis]
  const combinedStress = (32 * combinedMoment) / (Math.PI * Math.pow(selected / 1000, 3)) / 1e6;
  // Actual SF = σ_yield / σ_eq  (how many times above yield we are)
  const actualSF = parseFloat((effectiveYield / combinedStress).toFixed(2));

  // ISO 286 IT6/IT7 tolerance lookup (µm) for shaft h6 and bore H7
  const iso286It: { max: number; it6: number; it7: number }[] = [
    { max:  18, it6:  11, it7:  18 },
    { max:  30, it6:  13, it7:  21 },
    { max:  50, it6:  16, it7:  25 },
    { max:  80, it6:  19, it7:  30 },
    { max: 120, it6:  22, it7:  35 },
    { max: 180, it6:  25, it7:  40 },
  ];
  const isoRow = iso286It.find(r => selected <= r.max) ?? iso286It[iso286It.length - 1]!;
  const it6 = isoRow.it6;   // h6 shaft: 0/−IT6
  const it7 = isoRow.it7;   // H7 bore:  +IT7/0

  return {
    requiredDiaMm: parseFloat(d_req_mm.toFixed(2)),
    selectedDiaMm: selected,
    bendingMomentNm: parseFloat(M_Nm.toFixed(2)),
    torqueNm: parseFloat(T_Nm.toFixed(2)),
    combinedStressMpa: parseFloat(combinedStress.toFixed(2)),
    safetyFactor: actualSF,
    deflectionMm: parseFloat(deflection_mm.toFixed(4)),
    keyway: getKeyway(selected),
    toleranceFit: {
      shaft: `Ø${selected}h6 (0/−${it6}µm) — bearing seat ground to Ra 0.8µm`,
      bore: `Ø${selected}H7 (+${it7}/0µm) — roll bore reamed/finished`,
      interference: "H7/h6 = Clearance-to-transition fit — assembly by hand/light press",
    },
    surfaceFinish: {
      bearingSeat: "Ra 0.8µm (Rz 3.2µm) — ground finish",
      keywaySurface: "Ra 1.6µm (Rz 6.3µm) — milled",
      rollBody: "Ra 3.2µm (Rz 12.5µm) — turned",
    },
    recommendedMaterial: matRec.material,
    locknuts: getLocknut(selected),
    stressConcentrationKf: Kf,
    shaftYieldMpa: effectiveYield,
  };
}

function calcRollOD(
  shaftDiaMm: number,
  profileDepthMm: number,
  materialThicknessMm: number,
  stationIndex: number,
  totalStations: number,
): RollODResult {
  // FIX: minWall was max(6, dia*0.15) — too thin for hardened D2/H13 tooling steel
  // Corrected to max(8, dia*0.20) per "Roll Forming Handbook" (Halmos, Table 4.3)
  const minWall = Math.max(8, shaftDiaMm * 0.20);
  const bore = shaftDiaMm + 2;
  const profileContrib = profileDepthMm * (stationIndex / totalStations);
  const rawOD = bore + 2 * minWall + 2 * profileContrib + 2 * materialThicknessMm;
  const upperOD = Math.max(rawOD, shaftDiaMm * 2.5, 80);
  // Lower roll is the counter (web) roll — it fits INSIDE the profile groove.
  // Its OD is the upper roll OD minus 2× profile depth minus 2× material thickness.
  // Clamped so lowerOD is always ≤ upperOD and ≥ shaft * 2 (minimum usable roll).
  const lowerOD = Math.max(
    upperOD - 2 * profileContrib - 2 * materialThicknessMm,
    Math.max(shaftDiaMm * 2.0, 60),
  );

  return {
    upperOD: parseFloat(upperOD.toFixed(1)),
    lowerOD: parseFloat(lowerOD.toFixed(1)),
    profileDepth: parseFloat(profileContrib.toFixed(2)),
    minWallThickness: parseFloat(minWall.toFixed(2)),
    formula: `upperOD = bore(${bore.toFixed(0)}) + 2×wall(${minWall.toFixed(1)}) + 2×profileDepth(${profileContrib.toFixed(1)}) + 2×t(${materialThicknessMm}) = ${upperOD.toFixed(1)}mm | lowerOD = upperOD − 2×profileDepth − 2×t = ${lowerOD.toFixed(1)}mm`,
  };
}

function calcStandPitch(rollWidthMm: number, bearingWidthMm: number): StandPitchResult {
  const locknuts = 15;
  const housingClearance = 20;
  const pitchMm = rollWidthMm + 2 * bearingWidthMm + 2 * locknuts + housingClearance;

  return {
    pitchMm: parseFloat(pitchMm.toFixed(1)),
    rollWidthMm: parseFloat(rollWidthMm.toFixed(1)),
    bearingWidthMm,
    locknuts,
    housingClearance,
    formula: `Pitch = rollWidth(${rollWidthMm.toFixed(0)}) + 2×bearing(${bearingWidthMm}) + 2×locknut(${locknuts}) + housing(${housingClearance}) = ${pitchMm.toFixed(1)}mm`,
  };
}

function estimateProfileDepth(
  station: FlowerStation,
  index: number,
  totalStations: number,
): number {
  const progressFraction = (index + 1) / totalStations;
  const angleRad = (station.cumulativeBendAngle * Math.PI) / 180;
  const halfWidth = station.stripWidth * 0.5;
  const geometricDepth = halfWidth * Math.sin(Math.min(angleRad, Math.PI / 2));
  return Math.max(0, geometricDepth * progressFraction);
}

// ─── Roll Type Classification ─────────────────────────────────────────────────

function classifyRollType(
  index: number,
  totalStations: number,
  cumulativeBendAngleDeg: number,
  profileDepthMm: number,
): RollTypeInfo {
  const pct = totalStations <= 1 ? 1 : index / (totalStations - 1);
  const bendAngle = cumulativeBendAngleDeg;

  if (pct === 0) {
    // First station: Guide Roll — minimal forming, sheet entry alignment
    return {
      code: "GUIDE",
      name: "Guide Roll",
      description: "Entry guide — aligns strip, minimal bending, flat contact",
      grooveShape: "flat",
      grooveAngleDeg: 0,
      grooveDepthFraction: 0,
      filletRadiusMm: 5.0,
      phase: "ENTRY",
      color: "#64748b",
    };
  }
  if (pct <= 0.20 && bendAngle <= 30) {
    // Early stations: Breakdown Roll — initial shallow bending
    return {
      code: "BREAKDOWN",
      name: "Breakdown Roll",
      description: "Shallow V-groove — first bend initiation, edge forming begins",
      grooveShape: "shallow-v",
      grooveAngleDeg: Math.round(bendAngle * 0.9),
      grooveDepthFraction: 0.10,
      filletRadiusMm: 4.0,
      phase: "ENTRY",
      color: "#0ea5e9",
    };
  }
  if (pct <= 0.45 && bendAngle <= 60) {
    // Mid-early: Forming Roll — main bending progression
    return {
      code: "FORMING",
      name: "Forming Roll",
      description: "V-groove forming — progressive bend angle increase, side wall development",
      grooveShape: "v-groove",
      grooveAngleDeg: Math.round(bendAngle * 0.95),
      grooveDepthFraction: 0.25,
      filletRadiusMm: 3.0,
      phase: "FORMING",
      color: "#f59e0b",
    };
  }
  if (pct <= 0.70 && bendAngle <= 85) {
    // Mid: Groove Roll — deep contoured groove, main shaping
    return {
      code: "GROOVE",
      name: "Groove Roll",
      description: "Deep contoured groove — profile shaping, both walls fully formed",
      grooveShape: profileDepthMm > 20 ? "deep-groove" : "u-groove",
      grooveAngleDeg: Math.round(bendAngle),
      grooveDepthFraction: 0.45,
      filletRadiusMm: 2.0,
      phase: "FORMING",
      color: "#8b5cf6",
    };
  }
  if (pct <= 0.88) {
    // Near-final: Fin Pass Roll — profile closing, near-net shape
    return {
      code: "FINPASS",
      name: "Fin Pass Roll",
      description: "Fin groove — closing the profile to near-final shape, weld seam prep",
      grooveShape: "fin",
      grooveAngleDeg: Math.min(Math.round(bendAngle), 90),
      grooveDepthFraction: 0.65,
      filletRadiusMm: 1.5,
      phase: "CLOSING",
      color: "#ec4899",
    };
  }
  // Last station(s): Sizing Roll — precision calibration
  return {
    code: "SIZING",
    name: "Sizing Roll",
    description: "Precision sizing — final OD/width calibration, surface finish, tolerancing",
    grooveShape: "u-groove",
    grooveAngleDeg: 90,
    grooveDepthFraction: 0.70,
    filletRadiusMm: 1.0,
    phase: "SIZING",
    color: "#22c55e",
  };
}

// ─── Roll Material Recommendation ────────────────────────────────────────────

const ROLL_MATERIAL_MAP: Record<string, RollMaterialRec> = {
  GI: {
    toolSteel: "D2 Tool Steel",
    hardnessHRC: "HRC 60–62",
    surfaceTreatment: "Gas Nitriding (650 HV)",
    treatmentNote: "Nitriding increases surface hardness, resists zinc pick-up",
    alternativeMaterial: "H11 Tool Steel HRC 56",
    lubricantRecommended: "Quaker FERROCOAT 395 forming oil",
    lifeHrs: 8000,
  },
  CR: {
    toolSteel: "D2 Tool Steel",
    hardnessHRC: "HRC 60–62",
    surfaceTreatment: "Gas Nitriding (650 HV)",
    treatmentNote: "Smooth finish critical — avoid tool marks transferring to CR surface",
    alternativeMaterial: "D3 Tool Steel HRC 62",
    lubricantRecommended: "Light forming oil or dry lube (chlorine-free)",
    lifeHrs: 10000,
  },
  HR: {
    toolSteel: "D2 Tool Steel",
    hardnessHRC: "HRC 58–60",
    surfaceTreatment: "Salt Bath Nitriding (580 HV)",
    treatmentNote: "Descale strip before forming — scale particles cause premature wear",
    alternativeMaterial: "H13 Hot Work Steel HRC 52",
    lubricantRecommended: "Mineral oil EP (ISO VG 32)",
    lifeHrs: 6000,
  },
  SS: {
    toolSteel: "H13 Hot Work Tool Steel",
    hardnessHRC: "HRC 52–54",
    surfaceTreatment: "TiN PVD Coating (2300 HV, 3–5 μm)",
    treatmentNote: "TiN reduces galling risk — SS work hardens rapidly; avoid dwell",
    alternativeMaterial: "D2 + TiAlN Coating",
    lubricantRecommended: "Chlorine-free drawing compound + flood rinse (mandatory)",
    lifeHrs: 3000,
  },
  AL: {
    toolSteel: "D2 Tool Steel",
    hardnessHRC: "HRC 58–60",
    surfaceTreatment: "Hard Chrome Plating (800–1000 HV, 20–30 μm)",
    treatmentNote: "Chrome prevents AL adhesion/pick-up — use polyurethane side collars",
    alternativeMaterial: "Chrome-plated Mild Steel (for light gauge)",
    lubricantRecommended: "Aluminum-specific forming lubricant (no chlorine, no iron)",
    lifeHrs: 5000,
  },
  MS: {
    toolSteel: "D2 Tool Steel",
    hardnessHRC: "HRC 60–62",
    surfaceTreatment: "Gas Nitriding (650 HV)",
    treatmentNote: "Same as GI — standard nitriding for mild steel forming",
    alternativeMaterial: "H11 Tool Steel HRC 56",
    lubricantRecommended: "Light mineral oil (ISO VG 22)",
    lifeHrs: 8000,
  },
  CU: {
    toolSteel: "D2 Tool Steel",
    hardnessHRC: "HRC 58–60",
    surfaceTreatment: "Hard Chrome Plating (800 HV, 15–20 μm)",
    treatmentNote: "Chrome prevents copper smearing — avoid sharp tool edges",
    alternativeMaterial: "Chrome-plated O1 Tool Steel",
    lubricantRecommended: "Thin mineral oil (no chlorinated compounds for copper)",
    lifeHrs: 6000,
  },
  TI: {
    toolSteel: "D2 + TiAlN Coating",
    hardnessHRC: "HRC 60 substrate + TiAlN (2400 HV surface)",
    surfaceTreatment: "TiAlN PVD Coating (2400 HV, 4–6 μm) — mandatory",
    treatmentNote: "Titanium is highly reactive — uncoated rolls cause galling within hours",
    alternativeMaterial: "Carbide-tipped rolls for extreme life",
    lubricantRecommended: "Titanium-grade lubricant mandatory — dry forming strictly prohibited",
    lifeHrs: 1500,
  },
  PP: {
    toolSteel: "D2 Tool Steel (core)",
    hardnessHRC: "HRC 60 core + 60A Shore Polyurethane sleeve",
    surfaceTreatment: "Polyurethane Sleeve (Shore 60A, 5–10 mm thick)",
    treatmentNote: "PU sleeve protects pre-painted/coated strip surface — replace when worn",
    alternativeMaterial: "Chrome-plated D2 (for heavy gauge PP)",
    lubricantRecommended: "Dry lube or thin protective film — no wet oils on painted surface",
    lifeHrs: 2000,
  },
  HSLA: {
    toolSteel: "H13 Hot Work Tool Steel",
    hardnessHRC: "HRC 52–54",
    surfaceTreatment: "TiN PVD Coating (2300 HV)",
    treatmentNote: "HSLA high strength causes rapid tool wear — TiN coating extends life 3×",
    alternativeMaterial: "D2 + TiN Coating (HRC 60–62 + TiN)",
    lubricantRecommended: "Heavy-duty forming oil (EP additive, VG 68)",
    lifeHrs: 2500,
  },
};

function recommendRollMaterial(materialType: string): RollMaterialRec {
  return ROLL_MATERIAL_MAP[materialType.toUpperCase()] ?? ROLL_MATERIAL_MAP["GI"];
}

// ─── Motor Capacity Calculation ───────────────────────────────────────────────

export interface MotorCalcResult {
  deformationPowerKw: number;
  frictionPowerKw: number;
  shaftPowerKw: number;
  totalRequiredKw: number;
  selectedMotorKw: number;
  motorFrame: string;
  motorRpm: number;
  motorTorqueNm: number;
  driveEfficiency: number;
  serviceFactor: number;
  gearboxRatioRequired: number;
  recommendedGearboxRatio: number;
  outputShaftRpm: number;
  lineSpeedTargetMpm: number;
  lineSpeedActualMpm: number;
  rollCircumferenceMm: number;
  vfdRecommended: boolean;
  powerDensityKwPerStation: number;
  warnings: string[];
}

const MOTOR_FRICTION: Record<string, number> = {
  GI: 0.002, CR: 0.002, HR: 0.0025, SS: 0.002, AL: 0.002,
  MS: 0.002, CU: 0.002, TI: 0.003,  PP: 0.002, HSLA: 0.0025,
};

const MOTOR_SERVICE_FACTOR: Record<string, number> = {
  GI: 1.25, CR: 1.25, HR: 1.35, SS: 1.40, AL: 1.20,
  MS: 1.30, CU: 1.20, TI: 1.50, PP: 1.20, HSLA: 1.40,
};

const IEC_FRAME: Record<number, string> = {
  1.5: "90L", 2.2: "90L", 3: "100L", 4: "112M", 5.5: "132M", 7.5: "132M",
  11: "160M", 15: "160L", 18.5: "180M", 22: "180L", 30: "200L", 37: "200L",
  45: "225M", 55: "250M", 75: "280M", 90: "280M", 110: "315M", 132: "315M",
};

export function calcRequiredMotorPower(
  stationForces_kN: number[],
  rollODs_mm: number[],
  materialType: string,
  targetLineSpeed_mpm = 20,
  motorRpm = 1440,
): MotorCalcResult {
  const mat = materialType.toUpperCase();
  const mu = MOTOR_FRICTION[mat] ?? 0.002;
  const SF = MOTOR_SERVICE_FACTOR[mat] ?? 1.25;
  const ETA_DRIVE = 0.92 * 0.95 * 0.99; // motor × gearbox × coupling = ~0.865

  const v_ms = targetLineSpeed_mpm / 60;
  const nStations = stationForces_kN.length;
  const totalForce_N = stationForces_kN.reduce((s, f) => s + f * 1000, 0);
  const avgForce_N = totalForce_N / Math.max(1, nStations);

  // Deformation power: average force × speed × service factor
  const P_deform_W = avgForce_N * v_ms * SF;
  // Friction power: rolling friction at 4 bearing positions per stand
  const P_fric_W = mu * totalForce_N * v_ms * 4;
  const P_shaft_W = P_deform_W + P_fric_W;
  const P_input_W = P_shaft_W / ETA_DRIVE;
  const P_required_kW = P_input_W / 1000;

  // Select standard IEC motor
  const STD_MOTORS = [1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132];
  const selectedKw = STD_MOTORS.find(p => p >= P_required_kW) ?? 132;
  const frame = IEC_FRAME[selectedKw] ?? "315M";
  const motorTorque_Nm = (selectedKw * 1000 * 9.55) / motorRpm;

  // Gearbox ratio
  const avgRollOD_m = rollODs_mm.length > 0
    ? rollODs_mm.reduce((s, d) => s + d, 0) / rollODs_mm.length / 1000
    : 0.12;
  const rollCircumference_m = Math.PI * avgRollOD_m;
  const rawRatio = (rollCircumference_m * motorRpm) / targetLineSpeed_mpm;
  const STD_RATIOS = [10, 12.5, 16, 20, 25, 31.5, 40, 50];
  const gearboxRatio = STD_RATIOS.find(r => r >= rawRatio * 0.95) ?? 50;
  const actualLineSpeed_mpm = (rollCircumference_m * motorRpm) / gearboxRatio;
  const outputRpm = motorRpm / gearboxRatio;

  const warnings: string[] = [];
  if (selectedKw < 3) warnings.push("Small motor (<3 kW) — verify no stall risk during startup");
  if (P_required_kW > 45) warnings.push("High power (>45 kW) — consider multi-motor drive arrangement");
  if (Math.abs(actualLineSpeed_mpm - targetLineSpeed_mpm) > 3)
    warnings.push(`Line speed deviation: target ${targetLineSpeed_mpm} m/min, actual ${actualLineSpeed_mpm.toFixed(1)} m/min — verify gearbox ratio`);
  if (mat === "SS") warnings.push("SS: Work hardening risk — VFD speed control strongly recommended");
  if (mat === "TI") warnings.push("TI: Low forming speed mandatory — install VFD with 20–40% speed range");
  if (mat === "HSLA") warnings.push("HSLA: High strength — VFD with torque-limit control recommended");

  return {
    deformationPowerKw: parseFloat((P_deform_W / 1000).toFixed(3)),
    frictionPowerKw: parseFloat((P_fric_W / 1000).toFixed(3)),
    shaftPowerKw: parseFloat((P_shaft_W / 1000).toFixed(3)),
    totalRequiredKw: parseFloat(P_required_kW.toFixed(3)),
    selectedMotorKw: selectedKw,
    motorFrame: frame,
    motorRpm,
    motorTorqueNm: parseFloat(motorTorque_Nm.toFixed(1)),
    driveEfficiency: parseFloat((ETA_DRIVE * 100).toFixed(1)),
    serviceFactor: SF,
    gearboxRatioRequired: parseFloat(rawRatio.toFixed(2)),
    recommendedGearboxRatio: gearboxRatio,
    outputShaftRpm: parseFloat(outputRpm.toFixed(1)),
    lineSpeedTargetMpm: targetLineSpeed_mpm,
    lineSpeedActualMpm: parseFloat(actualLineSpeed_mpm.toFixed(2)),
    rollCircumferenceMm: parseFloat((rollCircumference_m * 1000).toFixed(1)),
    vfdRecommended: ["SS", "TI", "HSLA", "HR"].includes(mat),
    powerDensityKwPerStation: parseFloat((P_required_kW / Math.max(1, nStations)).toFixed(3)),
    warnings,
  };
}

export function generateRollTooling(
  stations: FlowerStation[],
  materialType: string,
  thickness: number,
  shaftDiameter = 40,
  clearance = 0.05,
  motorKw = 11,
  rpm = 1440,
): RollToolingResult[] {
  const mat = materialType.toUpperCase();
  const t = parseFloat(String(thickness)) || 1.0;
  const cl = parseFloat(String(clearance)) || 0.05;
  const K = K_FACTORS[mat] ?? 0.44;
  const n = stations.length;

  return stations.map((station, i) => {
    const formingForceN = station.formingForce * 1000;

    const shaftCalc = calcShaftDiameter(
      formingForceN,
      station.stripWidth * 0.3,
      motorKw,
      rpm,
      DEFAULT_SHAFT_YIELD,
      2.5,             // SF=2.5 industry standard for roll forming
    );

    const effectiveShaft = Math.max(shaftDiameter, shaftCalc.selectedDiaMm);

    const profileDepth = estimateProfileDepth(station, i, n);
    const rollODCalc = calcRollOD(effectiveShaft, profileDepth, t, i + 1, n);

    const upperRollOD = rollODCalc.upperOD;
    const lowerRollOD = rollODCalc.lowerOD;
    const boreID = effectiveShaft + 2;

    const rollWidth = Math.max(20, station.stripWidth * 0.3);
    const rollGap = t + cl;

    const radialLoad = formingForceN * 0.5;
    const bearing = selectBearing(effectiveShaft, radialLoad, rpm, 20000);

    const standPitch = calcStandPitch(rollWidth, bearing.widthMm);

    // Simply-supported beam model: δ = F·L³ / (48·E·I)
    // E in MPa (×1e6 → Pa), L in m, I in m⁴ → result in m → ×1000 = mm
    const E = 210000;  // MPa (steel elastic modulus)
    const L = rollWidth / 1000;  // m (effective span = roll width)
    const F = formingForceN;
    const I_shaft = Math.PI * (effectiveShaft / 1000) ** 4 / 64;  // m⁴
    const deflection = (F * L ** 3) / (48 * E * 1e6 * I_shaft) * 1000;  // mm

    const concentricityTolerance = 0.02 * upperRollOD / 100;

    const rollType = classifyRollType(i, n, station.cumulativeBendAngle, profileDepth);
    const rollMaterial = recommendRollMaterial(mat);

    return {
      stationId: station.stationId,
      stationIndex: i + 1,
      upperRollOD: parseFloat(upperRollOD.toFixed(2)),
      upperRollID: parseFloat(boreID.toFixed(2)),
      upperRollWidth: parseFloat(rollWidth.toFixed(2)),
      lowerRollOD: parseFloat(lowerRollOD.toFixed(2)),
      lowerRollID: parseFloat(boreID.toFixed(2)),
      lowerRollWidth: parseFloat(rollWidth.toFixed(2)),
      rollGap: parseFloat(rollGap.toFixed(3)),
      passLineHeight: parseFloat((upperRollOD / 2 + rollGap + lowerRollOD / 2).toFixed(2)),
      kFactor: K,
      neutralAxis: parseFloat((K * t).toFixed(3)),
      deflection: parseFloat(deflection.toFixed(4)),
      concentricityTolerance: parseFloat(concentricityTolerance.toFixed(3)),
      material: mat,
      description: station.description,
      shaftCalc,
      bearing,
      rollODCalc,
      standPitch,
      profileDepthMm: parseFloat(profileDepth.toFixed(3)),
      rollType,
      rollMaterial,
    };
  });
}

export function calculateRollGaps(
  stations: FlowerStation[],
  thickness: number,
  clearance = 0.05
): { stationId: string; nominalGap: number; minGap: number; maxGap: number }[] {
  const t = parseFloat(String(thickness)) || 1.0;
  const cl = parseFloat(String(clearance)) || 0.05;
  return stations.map(s => ({
    stationId: s.stationId,
    nominalGap: parseFloat((t + cl).toFixed(3)),
    minGap: parseFloat((t + cl * 0.8).toFixed(3)),
    maxGap: parseFloat((t + cl * 1.2 + t * 0.05).toFixed(3)),
  }));
}

export function calcStripWidth(
  bends: { angle: number; radius: number }[],
  flanges: number[],
  thickness: number,
  materialType = "GI"
): number {
  const mat = materialType.toUpperCase();
  const t = parseFloat(String(thickness)) || 1.0;
  const K = K_FACTORS[mat] ?? 0.44;

  const bendAllowances = bends.map(b => {
    const r = b.radius;
    const theta = b.angle;
    return (Math.PI * (r + K * t) * theta) / 180;
  });

  const flatSum = flanges.reduce((s, f) => s + f, 0);
  const baSum = bendAllowances.reduce((s, ba) => s + ba, 0);
  return parseFloat((flatSum + baSum).toFixed(2));
}

export function calcBomFromTooling(
  tooling: RollToolingResult[],
  materialType: string
): { item: string; qty: number; spec: string; material: string }[] {
  const bom: { item: string; qty: number; spec: string; material: string }[] = [];
  for (const t of tooling) {
    const matSpec = `${t.rollMaterial.toolSteel} ${t.rollMaterial.hardnessHRC} | ${t.rollMaterial.surfaceTreatment}`;
    const sc = t.shaftCalc;
    const kw = sc.keyway;
    const shaftSpec = `Ø${sc.selectedDiaMm}mm ${sc.recommendedMaterial} | ${sc.toleranceFit.shaft} | Keyway ${kw.widthMm}×${kw.heightMm}mm (${kw.standard}) t1=${kw.shaftDepthT1Mm} | ${sc.locknuts} | SF=${sc.safetyFactor}`;
    bom.push({
      item: `Upper Roll ${t.stationId} [${t.rollType.name}]`,
      qty: 1,
      spec: `OD${t.upperRollOD}×ID${t.upperRollID}×W${t.upperRollWidth} | Bore:${sc.toleranceFit.bore} | ${t.bearing.designation} | Pitch ${t.standPitch.pitchMm}mm | Groove:${t.rollType.grooveShape} ${t.rollType.grooveAngleDeg}° | Surface:${sc.surfaceFinish.rollBody}`,
      material: matSpec,
    });
    bom.push({
      item: `Lower Roll ${t.stationId} [${t.rollType.name}]`,
      qty: 1,
      spec: `OD${t.lowerRollOD}×ID${t.lowerRollID}×W${t.lowerRollWidth} | Bore:${sc.toleranceFit.bore} | Groove:${t.rollType.grooveShape} ${t.rollType.grooveAngleDeg}° | Surface:${sc.surfaceFinish.rollBody}`,
      material: matSpec,
    });
    bom.push({
      item: `Shaft ${t.stationId}`,
      qty: 1,
      spec: shaftSpec,
      material: sc.recommendedMaterial,
    });
    bom.push({
      item: `Bearing Set ${t.stationId}`,
      qty: 4,
      spec: `SKF/FAG ${t.bearing.designation} | Ø${t.bearing.boreMm}×${t.bearing.odMm}×${t.bearing.widthMm}mm | C=${t.bearing.C_kN}kN | Seat:${sc.surfaceFinish.bearingSeat}`,
      material: "Bearing Steel 52100 (2RS Sealed)",
    });
  }
  return bom;
}
