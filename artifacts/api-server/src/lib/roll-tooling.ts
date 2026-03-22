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
  const T_Nm = rpm > 0 ? (P_W * 9550) / (rpm * 1000) * 1000 : (formingForceN * 0.05);

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
    bom.push({
      item: `Upper Roll ${t.stationId}`,
      qty: 1,
      spec: `OD${t.upperRollOD}×ID${t.upperRollID}×W${t.upperRollWidth} | Shaft Ø${t.shaftCalc.selectedDiaMm} | ${t.bearing.designation} | Pitch ${t.standPitch.pitchMm}mm`,
      material: "D2 Tool Steel HRC60-62",
    });
    bom.push({
      item: `Lower Roll ${t.stationId}`,
      qty: 1,
      spec: `OD${t.lowerRollOD}×ID${t.lowerRollID}×W${t.lowerRollWidth} | Shaft Ø${t.shaftCalc.selectedDiaMm}`,
      material: "D2 Tool Steel HRC60-62",
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
