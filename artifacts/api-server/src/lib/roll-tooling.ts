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

export interface ShaftCalcResult {
  requiredDiaMm: number;
  selectedDiaMm: number;
  bendingMomentNm: number;
  torqueNm: number;
  combinedStressMpa: number;
  safetyFactor: number;
  deflectionMm: number;
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

const K_FACTORS: Record<string, number> = {
  GI: 0.38, CR: 0.40, HR: 0.42, SS: 0.44, AL: 0.39,
  MS: 0.38, CU: 0.37, TI: 0.45, PP: 0.36, HSLA: 0.43,
};

const SHAFT_YIELD_MPA: Record<string, number> = {
  C45: 400, "En8": 380, "En24": 540, "En36": 580, "42CrMo4": 650, "SCM440": 640,
};
const DEFAULT_SHAFT_YIELD = 400;

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
  safetyFactor = 2.0,
): ShaftCalcResult {
  const rollWidthM = rollWidthMm / 1000;
  const tau_allow = (shaftYieldMpa / (safetyFactor * 2));

  const M_Nm = (formingForceN * rollWidthM) / 4;
  const P_W = motorKw * 1000;
  // T(Nm) = P(W) / ω = P(W) × 9.55 / rpm   [correct: P_W not P_kW here]
  const T_Nm = rpm > 0 ? (P_W * 9.55) / rpm : (formingForceN * 0.05);

  const combinedMoment = Math.sqrt(M_Nm * M_Nm + T_Nm * T_Nm);
  const d_req_m = Math.pow((16 * combinedMoment) / (Math.PI * tau_allow * 1e6), 1 / 3);
  const d_req_mm = d_req_m * 1000;

  const standard = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100];
  const selected = standard.find(d => d >= d_req_mm) ?? 100;

  const I = Math.PI * Math.pow(selected / 1000, 4) / 64;
  const E = 210e9;
  const deflection_mm = (formingForceN * Math.pow(rollWidthM, 3)) / (48 * E * I) * 1000;

  const combinedStress = (32 * combinedMoment) / (Math.PI * Math.pow(selected / 1000, 3)) / 1e6;

  return {
    requiredDiaMm: parseFloat(d_req_mm.toFixed(2)),
    selectedDiaMm: selected,
    bendingMomentNm: parseFloat(M_Nm.toFixed(2)),
    torqueNm: parseFloat(T_Nm.toFixed(2)),
    combinedStressMpa: parseFloat(combinedStress.toFixed(2)),
    safetyFactor: parseFloat((tau_allow / combinedStress).toFixed(2)),
    deflectionMm: parseFloat(deflection_mm.toFixed(4)),
  };
}

function calcRollOD(
  shaftDiaMm: number,
  profileDepthMm: number,
  materialThicknessMm: number,
  stationIndex: number,
  totalStations: number,
): RollODResult {
  const minWall = Math.max(6, shaftDiaMm * 0.15);
  const bore = shaftDiaMm + 2;
  const profileContrib = profileDepthMm * (stationIndex / totalStations);
  const rawOD = bore + 2 * minWall + 2 * profileContrib + 2 * materialThicknessMm;
  const upperOD = Math.max(rawOD, shaftDiaMm * 2.5, 80);
  const lowerOD = upperOD + 2 * materialThicknessMm;

  return {
    upperOD: parseFloat(upperOD.toFixed(1)),
    lowerOD: parseFloat(lowerOD.toFixed(1)),
    profileDepth: parseFloat(profileContrib.toFixed(2)),
    minWallThickness: parseFloat(minWall.toFixed(2)),
    formula: `OD = bore(${bore.toFixed(0)}) + 2×wall(${minWall.toFixed(1)}) + 2×profileDepth(${profileContrib.toFixed(1)}) + 2×t(${materialThicknessMm}) = ${upperOD.toFixed(1)}mm`,
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
  const K = K_FACTORS[mat] ?? 0.38;
  const n = stations.length;

  return stations.map((station, i) => {
    const formingForceN = station.formingForce * 1000;

    const shaftCalc = calcShaftDiameter(
      formingForceN,
      station.stripWidth * 0.3,
      motorKw,
      rpm,
      DEFAULT_SHAFT_YIELD,
      2.0,
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

    const E = 210000;
    const L = rollWidth / 1000;
    const F = formingForceN;
    const I_shaft = Math.PI * (effectiveShaft / 1000) ** 4 / 64;
    const deflection = (F * L ** 3) / (3 * E * 1e6 * I_shaft) * 1000;

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
  const K = K_FACTORS[mat] ?? 0.38;

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
    bom.push({
      item: `Upper Roll ${t.stationId} [${t.rollType.name}]`,
      qty: 1,
      spec: `OD${t.upperRollOD}×ID${t.upperRollID}×W${t.upperRollWidth} | Shaft Ø${t.shaftCalc.selectedDiaMm} | ${t.bearing.designation} | Pitch ${t.standPitch.pitchMm}mm | Groove:${t.rollType.grooveShape} ${t.rollType.grooveAngleDeg}°`,
      material: matSpec,
    });
    bom.push({
      item: `Lower Roll ${t.stationId} [${t.rollType.name}]`,
      qty: 1,
      spec: `OD${t.lowerRollOD}×ID${t.lowerRollID}×W${t.lowerRollWidth} | Shaft Ø${t.shaftCalc.selectedDiaMm} | Groove:${t.rollType.grooveShape} ${t.rollType.grooveAngleDeg}°`,
      material: matSpec,
    });
    bom.push({
      item: `Bearing Set ${t.stationId}`,
      qty: 4,
      spec: `SKF/FAG ${t.bearing.designation} | Ø${t.bearing.boreMm}×${t.bearing.odMm}×${t.bearing.widthMm}mm | C=${t.bearing.C_kN}kN`,
      material: "Bearing Steel 52100",
    });
  }
  return bom;
}
