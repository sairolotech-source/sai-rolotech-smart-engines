import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Settings2, Zap, Bot, RotateCcw, ChevronDown, ChevronUp,
  Calculator, AlertTriangle, CheckCircle, Download, Info,
  Layers, Circle, Box, Wrench, BookOpen, Activity,
  AlertCircle, TrendingUp, Shield, HardDrive,
} from "lucide-react";
import { useCncStore, getKeywaySizeForShaft } from "../../store/useCncStore";

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = "manual" | "semi" | "full";
type ResultTab = "rolls" | "bearings" | "material" | "report";

type MaterialType = "GI" | "CR" | "HR" | "SS" | "AL" | "MS" | "PP" | "TI" | "HSLA";
type RollMaterial = "D2" | "H13" | "A2" | "S7" | "CAST_IRON" | "POLYURETHANE" | "CARBIDE";
type ProfileType = "C_CHANNEL" | "Z_PROFILE" | "L_ANGLE" | "U_CHANNEL" | "HAT" | "OMEGA" | "SQUARE_TUBE" | "CUSTOM";
type BearingLoad = "light" | "medium" | "heavy";

interface StationRoll {
  station: number;
  rollOD: number;
  rollWidth: number;
  boreDia: number;
  grooveDepth: number;
  faceWidth: number;
  bendAngle: number;
  keyway: { width: number; height: number };
}

interface BearingSpec {
  designation: string;
  series: string;
  boreDia: number;
  outerDia: number;
  width: number;
  dynamicC: number;
  staticC0: number;
  massKg: number;
  L10Hours: number;
  radialLoad: number;
}

interface CalcResults {
  rollOD: number;
  shaftDia: number;
  rollWidth: number;
  faceWidth: number;
  grooveDepth: number;
  keyway: { width: number; height: number };
  torquePerStation: number;
  bendingForce: number;
  powerRequired: number;
  bearings: BearingSpec[];
  recommendedBearing: BearingSpec | null;
  stationRolls: StationRoll[];
  safetyFactor: number;
  recommendedMaterial: RollMaterial;
  hardnessHRC: number;
  heatTreatment: string;
  warnings: string[];
  passInfo: string;
}

// ─── Standard Bearing Database (SKF/FAG) ─────────────────────────────────────

const BEARING_DB: Omit<BearingSpec, "L10Hours" | "radialLoad">[] = [
  { designation: "6205", series: "6200",  boreDia: 25, outerDia: 52,  width: 15, dynamicC: 14.0, staticC0: 7.85,  massKg: 0.104 },
  { designation: "6206", series: "6200",  boreDia: 30, outerDia: 62,  width: 16, dynamicC: 19.5, staticC0: 11.2,  massKg: 0.168 },
  { designation: "6207", series: "6200",  boreDia: 35, outerDia: 72,  width: 17, dynamicC: 25.5, staticC0: 15.3,  massKg: 0.248 },
  { designation: "6208", series: "6200",  boreDia: 40, outerDia: 80,  width: 18, dynamicC: 29.0, staticC0: 17.8,  massKg: 0.305 },
  { designation: "6209", series: "6200",  boreDia: 45, outerDia: 85,  width: 19, dynamicC: 31.5, staticC0: 20.0,  massKg: 0.340 },
  { designation: "6210", series: "6200",  boreDia: 50, outerDia: 90,  width: 20, dynamicC: 35.0, staticC0: 23.2,  massKg: 0.395 },
  { designation: "6211", series: "6200",  boreDia: 55, outerDia: 100, width: 21, dynamicC: 43.0, staticC0: 30.0,  massKg: 0.550 },
  { designation: "6212", series: "6200",  boreDia: 60, outerDia: 110, width: 22, dynamicC: 52.0, staticC0: 37.5,  massKg: 0.700 },
  { designation: "6213", series: "6200",  boreDia: 65, outerDia: 120, width: 23, dynamicC: 57.0, staticC0: 43.0,  massKg: 0.900 },
  { designation: "6214", series: "6200",  boreDia: 70, outerDia: 125, width: 24, dynamicC: 61.8, staticC0: 47.5,  massKg: 1.00 },
  { designation: "6215", series: "6200",  boreDia: 75, outerDia: 130, width: 25, dynamicC: 66.3, staticC0: 52.0,  massKg: 1.10 },
  { designation: "6216", series: "6200",  boreDia: 80, outerDia: 140, width: 26, dynamicC: 71.5, staticC0: 58.5,  massKg: 1.38 },
  { designation: "6305", series: "6300",  boreDia: 25, outerDia: 62,  width: 17, dynamicC: 20.8, staticC0: 11.2,  massKg: 0.188 },
  { designation: "6306", series: "6300",  boreDia: 30, outerDia: 72,  width: 19, dynamicC: 28.1, staticC0: 16.0,  massKg: 0.290 },
  { designation: "6307", series: "6300",  boreDia: 35, outerDia: 80,  width: 21, dynamicC: 33.2, staticC0: 19.6,  massKg: 0.375 },
  { designation: "6308", series: "6300",  boreDia: 40, outerDia: 90,  width: 23, dynamicC: 42.3, staticC0: 25.5,  massKg: 0.490 },
  { designation: "6309", series: "6300",  boreDia: 45, outerDia: 100, width: 25, dynamicC: 52.7, staticC0: 33.0,  massKg: 0.660 },
  { designation: "6310", series: "6300",  boreDia: 50, outerDia: 110, width: 27, dynamicC: 61.8, staticC0: 40.0,  massKg: 0.860 },
  { designation: "6311", series: "6300",  boreDia: 55, outerDia: 120, width: 29, dynamicC: 71.5, staticC0: 48.0,  massKg: 1.08 },
  { designation: "6312", series: "6300",  boreDia: 60, outerDia: 130, width: 31, dynamicC: 81.9, staticC0: 55.0,  massKg: 1.35 },
  { designation: "NU205", series: "NU200", boreDia: 25, outerDia: 52, width: 15, dynamicC: 18.0, staticC0: 13.2, massKg: 0.100 },
  { designation: "NU206", series: "NU200", boreDia: 30, outerDia: 62, width: 16, dynamicC: 24.5, staticC0: 18.0, massKg: 0.162 },
  { designation: "NU207", series: "NU200", boreDia: 35, outerDia: 72, width: 17, dynamicC: 30.0, staticC0: 22.5, massKg: 0.240 },
  { designation: "NU208", series: "NU200", boreDia: 40, outerDia: 80, width: 18, dynamicC: 38.0, staticC0: 29.5, massKg: 0.295 },
  { designation: "NU210", series: "NU200", boreDia: 50, outerDia: 90, width: 20, dynamicC: 51.0, staticC0: 42.5, massKg: 0.380 },
  { designation: "NU212", series: "NU200", boreDia: 60, outerDia: 110, width: 22, dynamicC: 71.5, staticC0: 62.0, massKg: 0.680 },
];

// ─── Roll Material Database ───────────────────────────────────────────────────

const ROLL_MATERIAL_DB: Record<RollMaterial, {
  label: string; hardnessHRC: string; tensile: number; yieldStr: number;
  heatTreat: string; cost: number; volumeLife: string; color: string;
  recommended: MaterialType[]; notes: string;
}> = {
  D2: {
    label: "D2 Tool Steel", hardnessHRC: "60–62", tensile: 2050, yieldStr: 1750,
    heatTreat: "Harden 1010°C, Oil quench, Temper 150–200°C (2×)",
    cost: 4, volumeLife: ">500k parts", color: "#f59e0b",
    recommended: ["GI","CR","HR","MS","PP","HSLA"],
    notes: "Best for standard roll forming. High wear resistance. Industry standard."
  },
  H13: {
    label: "H13 Hot Work Steel", hardnessHRC: "44–50", tensile: 1800, yieldStr: 1500,
    heatTreat: "Harden 1020°C, Air cool, Temper 550–600°C",
    cost: 5, volumeLife: ">300k parts", color: "#3b82f6",
    recommended: ["SS","TI","HSLA"],
    notes: "Best for high-temp / high-strength materials. Good toughness + thermal resistance."
  },
  A2: {
    label: "A2 Tool Steel", hardnessHRC: "57–62", tensile: 1950, yieldStr: 1600,
    heatTreat: "Harden 960°C, Air quench, Temper 175°C",
    cost: 3, volumeLife: ">200k parts", color: "#22c55e",
    recommended: ["AL","CR","HR","MS"],
    notes: "Easier to machine than D2. Good toughness. Lower wear resistance."
  },
  S7: {
    label: "S7 Shock Resistant", hardnessHRC: "54–56", tensile: 1760, yieldStr: 1450,
    heatTreat: "Harden 940°C, Air or oil quench, Temper 175–315°C",
    cost: 4, volumeLife: ">150k parts", color: "#8b5cf6",
    recommended: ["HR","HSLA"],
    notes: "Excellent impact toughness. Use when cracking or chipping is a problem."
  },
  CAST_IRON: {
    label: "Cast Iron GG25", hardnessHRC: "180–250 HB", tensile: 250, yieldStr: 180,
    heatTreat: "Stress relief only 550–600°C",
    cost: 1, volumeLife: "<50k parts", color: "#94a3b8",
    recommended: ["GI","CR"],
    notes: "Simple profiles only. Low cost but limited life. Good for prototypes."
  },
  POLYURETHANE: {
    label: "Polyurethane 90A", hardnessHRC: "90 Shore A", tensile: 45, yieldStr: 30,
    heatTreat: "Cast to shape, no heat treatment",
    cost: 2, volumeLife: "<20k parts", color: "#ec4899",
    recommended: ["PP","AL"],
    notes: "Essential for pre-painted / coated materials. Prevents surface scratching."
  },
  CARBIDE: {
    label: "Tungsten Carbide", hardnessHRC: "70–78 (HRA)", tensile: 3100, yieldStr: 2800,
    heatTreat: "Sintered, no further heat treatment",
    cost: 10, volumeLife: ">2M parts", color: "#06b6d4",
    recommended: ["SS","TI","HSLA"],
    notes: "Maximum life for high-volume / abrasive materials. Very expensive tooling cost."
  },
};

// ─── Material Properties ──────────────────────────────────────────────────────

const STRIP_MATERIAL_DB: Record<MaterialType, {
  label: string; yieldStr: number; tensile: number;
  thickRange: [number, number]; kFactor: number; bendRadFactor: number;
}> = {
  GI:   { label: "Galvanized Steel",  yieldStr: 280, tensile: 380, thickRange: [0.3, 3.0], kFactor: 0.47, bendRadFactor: 1.0 },
  CR:   { label: "Cold Rolled Steel", yieldStr: 350, tensile: 440, thickRange: [0.5, 4.0], kFactor: 0.44, bendRadFactor: 0.8 },
  HR:   { label: "Hot Rolled Steel",  yieldStr: 250, tensile: 380, thickRange: [1.5, 6.0], kFactor: 0.50, bendRadFactor: 1.2 },
  SS:   { label: "Stainless 304",     yieldStr: 310, tensile: 620, thickRange: [0.5, 3.0], kFactor: 0.50, bendRadFactor: 1.5 },
  AL:   { label: "Aluminium 6061",    yieldStr: 276, tensile: 310, thickRange: [0.5, 5.0], kFactor: 0.41, bendRadFactor: 0.8 },
  MS:   { label: "Mild Steel",        yieldStr: 250, tensile: 400, thickRange: [0.8, 4.0], kFactor: 0.50, bendRadFactor: 1.2 },
  PP:   { label: "Pre-Painted Steel", yieldStr: 300, tensile: 390, thickRange: [0.4, 1.5], kFactor: 0.47, bendRadFactor: 1.0 },
  TI:   { label: "Titanium Alloy",    yieldStr: 900, tensile: 1000, thickRange: [0.5, 3.0], kFactor: 0.50, bendRadFactor: 3.0 },
  HSLA: { label: "HSLA Steel S355",   yieldStr: 355, tensile: 490, thickRange: [1.5, 8.0], kFactor: 0.48, bendRadFactor: 2.0 },
};

const STANDARD_SHAFT_SIZES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100];
const STANDARD_ROLL_OD = [80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 250, 280, 300];
const PROFILE_TYPES: Record<ProfileType, { label: string; rollWidthFactor: number; grooveFactor: number }> = {
  C_CHANNEL:   { label: "C-Channel",     rollWidthFactor: 1.30, grooveFactor: 0.20 },
  Z_PROFILE:   { label: "Z-Profile",     rollWidthFactor: 1.25, grooveFactor: 0.18 },
  L_ANGLE:     { label: "L-Angle",       rollWidthFactor: 1.20, grooveFactor: 0.15 },
  U_CHANNEL:   { label: "U-Channel",     rollWidthFactor: 1.35, grooveFactor: 0.22 },
  HAT:         { label: "Hat Section",   rollWidthFactor: 1.40, grooveFactor: 0.25 },
  OMEGA:       { label: "Omega Profile", rollWidthFactor: 1.40, grooveFactor: 0.26 },
  SQUARE_TUBE: { label: "Square Tube",   rollWidthFactor: 1.50, grooveFactor: 0.30 },
  CUSTOM:      { label: "Custom",        rollWidthFactor: 1.30, grooveFactor: 0.20 },
};

// ─── Core Calculation Engine ──────────────────────────────────────────────────

function roundToStandard(value: number, standards: number[]): number {
  return standards.find(s => s >= value) ?? standards[standards.length - 1];
}

// ISO 281:2007 — Ball bearings: p=3, Roller/NU bearings: p=10/3
function calcL10(C_kN: number, P_kN: number, n_rpm: number, isRoller = false): number {
  if (P_kN <= 0 || n_rpm <= 0) return Infinity;
  const p = isRoller ? 10 / 3 : 3;
  return Math.pow(C_kN / P_kN, p) * 1e6 / (60 * n_rpm);
}

// Smooth-step (Hermite) angle distribution — most accurate for flower pattern
// θᵢ = θ_final × (3t² - 2t³) where t = i/n
// Result: aggressive early forming, gentle final passes — matches Halmos Roll Forming Handbook
function flowerAngle(station: number, totalStations: number, finalAngle: number): number {
  const t = station / totalStations;
  const smoothed = 3 * t * t - 2 * t * t * t; // Hermite smooth step
  return Math.round(smoothed * finalAngle * 10) / 10;
}

// Outside Set-Back (OSSB) and Bend Deduction (BD) — Standard press brake / roll forming formula
// OSSB = tan(θ/2) × (R + T)
// BD   = 2 × OSSB − BA
function calcOSSB(angleDeg: number, innerRadius: number, thickness: number): number {
  return Math.tan((angleDeg / 2) * Math.PI / 180) * (innerRadius + thickness);
}
function calcBD(ba: number, ossb: number): number {
  return 2 * ossb - ba;
}

function calculateResults(
  stripWidth: number, thickness: number, profileHeight: number, profileWidth: number,
  material: MaterialType, profileType: ProfileType, motorPowerKw: number,
  lineSpeedMpm: number, numStations: number, rollOD_manual: number,
  shaftDia_manual: number, rollWidth_manual: number, bearingLoad: BearingLoad,
  mode: Mode
): CalcResults {
  const mat = STRIP_MATERIAL_DB[material];
  const pType = PROFILE_TYPES[profileType];
  const warnings: string[] = [];

  // ── Roll OD ────────────────────────────────────────────────────────────────
  let rollOD: number;
  if (mode === "manual") {
    rollOD = rollOD_manual;
  } else {
    const minOD = Math.max(
      5 * profileHeight,
      3 * stripWidth,
      80
    );
    rollOD = roundToStandard(minOD, STANDARD_ROLL_OD);
    if (rollOD < 4 * profileHeight) warnings.push("Roll OD may be too small for profile height. Increase to avoid grooving issues.");
  }

  // ── Shaft Diameter (Combined Bending + Torsion — Distortion Energy Theory) ──
  // τ_allow = σ_yield / (2 × SF)   [SF = 2.5 for roll forming shafts]
  // d = ∛[ 16/(π×τ) × √(M² + T²) ]  where M,T in N·m
  // M = bending moment from radial force = F_radial × L_eff / 4
  // L_eff ≈ profile strip width / 2 (estimated shaft span)
  let shaftDia: number;
  if (mode === "manual") {
    shaftDia = shaftDia_manual;
  } else {
    const RPM = (lineSpeedMpm * 1000) / (Math.PI * rollOD);
    const T_total_Nm = motorPowerKw > 0 ? (motorPowerKw * 9550) / Math.max(RPM, 1) : 200;
    const T_per_station_Nm = T_total_Nm / Math.max(numStations, 1);
    const F_radial_N = (mat.tensile * thickness * stripWidth) / (4 * 8); // bending force N
    const L_eff_m = (stripWidth / 2) / 1000; // effective span in m
    const M_bending_Nm = F_radial_N * L_eff_m / 4; // simply-supported midspan
    const tau_allow_MPa = mat.yieldStr / (2 * 2.5); // safety factor 2.5
    const combined_Nm = Math.sqrt(M_bending_Nm * M_bending_Nm + T_per_station_Nm * T_per_station_Nm);
    const d_mm = Math.pow((16 * combined_Nm * 1000) / (Math.PI * tau_allow_MPa), 1 / 3);
    shaftDia = roundToStandard(Math.max(d_mm, 25), STANDARD_SHAFT_SIZES);
  }

  if (shaftDia < 0.25 * rollOD) warnings.push(`Shaft Ø${shaftDia} may be too small for roll Ø${rollOD}. Min recommended: Ø${Math.round(0.3 * rollOD)}mm`);
  if (shaftDia > 0.6 * rollOD) warnings.push(`Shaft Ø${shaftDia} is too large. Roll wall too thin. Use Ø${Math.round(0.45 * rollOD)}mm max.`);

  // ── Roll Width ─────────────────────────────────────────────────────────────
  let faceWidth: number;
  let rollWidth: number;
  if (mode === "manual") {
    rollWidth = rollWidth_manual;
    faceWidth = rollWidth - 30;
  } else {
    faceWidth = Math.ceil(stripWidth * pType.rollWidthFactor);
    const mainBearing = BEARING_DB.find(b => b.boreDia === shaftDia);
    const bWidth = mainBearing?.width ?? 20;
    rollWidth = faceWidth + 2 * (bWidth + 5);
  }

  // ── Groove Depth ──────────────────────────────────────────────────────────
  const grooveDepth = Math.round((rollOD / 2) * pType.grooveFactor);

  // ── Keyway ─────────────────────────────────────────────────────────────────
  const keyway = getKeywaySizeForShaft(shaftDia);

  // ── Torque & Force ─────────────────────────────────────────────────────────
  const RPM_calc = (lineSpeedMpm * 1000) / (Math.PI * rollOD);
  const torquePerStation = motorPowerKw > 0
    ? (motorPowerKw * 9550) / (RPM_calc * numStations)
    : (mat.yieldStr * thickness * thickness * stripWidth) / (4 * 2 * thickness * 1000);

  const bendingForce = (mat.tensile * thickness * thickness * stripWidth) / (4 * thickness * 8);
  const powerRequired = (bendingForce * lineSpeedMpm) / (60 * 1000);

  if (powerRequired > motorPowerKw && motorPowerKw > 0) {
    warnings.push(`Estimated power needed: ${powerRequired.toFixed(1)} kW > motor ${motorPowerKw} kW. Consider increasing motor size.`);
  }

  // ── Safety Factor ─────────────────────────────────────────────────────────
  const shaftArea = Math.PI * Math.pow(shaftDia / 2, 2);
  const actualStress = (bendingForce * (shaftDia / 2) * 1000) / (0.098 * Math.pow(shaftDia, 3));
  const safetyFactor = mat.yieldStr / Math.max(actualStress, 1);

  // ── Bearing Calculations ──────────────────────────────────────────────────
  const radialLoadKN = (bendingForce * 2) / 1000;
  const loadFactor = bearingLoad === "light" ? 0.6 : bearingLoad === "medium" ? 1.0 : 1.5;
  const P_kN = radialLoadKN * loadFactor;

  const matchedBearings = BEARING_DB
    .filter(b => b.boreDia === shaftDia)
    .map(b => ({
      ...b,
      L10Hours: calcL10(b.dynamicC, P_kN, RPM_calc, b.series.startsWith("NU")),
      radialLoad: P_kN,
    }));

  if (matchedBearings.length === 0) {
    const nearest = BEARING_DB.reduce((prev, cur) => Math.abs(cur.boreDia - shaftDia) < Math.abs(prev.boreDia - shaftDia) ? cur : prev);
    warnings.push(`No standard bearing for Ø${shaftDia}. Nearest: Ø${nearest.boreDia} (${nearest.designation}).`);
  }

  const recBearing = matchedBearings.reduce<BearingSpec | null>((best, b) => {
    if (!best) return b;
    return b.dynamicC > best.dynamicC ? b : best;
  }, null);

  if (recBearing && recBearing.L10Hours < 20000) {
    warnings.push(`Bearing ${recBearing.designation} L10 life: ${Math.round(recBearing.L10Hours).toLocaleString()} hrs — below 20,000 hr target. Use heavy series or increase shaft diameter.`);
  }

  // ── Roll Material Recommendation ──────────────────────────────────────────
  let recommendedMaterial: RollMaterial = "D2";
  if (material === "PP" || material === "AL") recommendedMaterial = "POLYURETHANE";
  else if (material === "SS" || material === "TI") recommendedMaterial = "H13";
  else if (material === "HSLA") recommendedMaterial = "D2";
  else recommendedMaterial = "D2";

  const rollMat = ROLL_MATERIAL_DB[recommendedMaterial];

  // ── Station Rolls Array (Hermite smooth-step flower angle distribution) ─────
  // θᵢ = θ_final × (3t² − 2t³) — Halmos Roll Forming Handbook method
  // More bending early, gentle approach to final angle → avoids edge buckling
  const stationRolls: StationRoll[] = Array.from({ length: numStations }, (_, i) => {
    const t = (i + 1) / numStations;
    const smoothed = 3 * t * t - 2 * t * t * t; // Hermite interpolation
    const bendAngle = Math.round(smoothed * 90 * 10) / 10;
    const stationGroove = grooveDepth * smoothed;
    return {
      station: i + 1,
      rollOD: rollOD + (i % 2 === 0 ? 0 : -2),
      rollWidth: faceWidth + (i < 2 ? 10 : i < numStations - 2 ? 0 : -5),
      boreDia: shaftDia,
      grooveDepth: Math.round(stationGroove * 10) / 10,
      faceWidth,
      bendAngle,
      keyway,
    };
  });

  // ── Pass info ─────────────────────────────────────────────────────────────
  const passInfo = `${numStations}-pass program | Entry strip: ${stripWidth}×${thickness}mm | Final profile: ${profileWidth}×${profileHeight}mm`;

  return {
    rollOD, shaftDia, rollWidth, faceWidth, grooveDepth, keyway,
    torquePerStation, bendingForce, powerRequired, bearings: matchedBearings,
    recommendedBearing: recBearing, stationRolls, safetyFactor,
    recommendedMaterial, hardnessHRC: parseInt(rollMat.hardnessHRC),
    heatTreatment: rollMat.heatTreat, warnings, passInfo,
  };
}

// ─── Input Field Component ────────────────────────────────────────────────────

function InputField({
  label, value, onChange, unit, min, max, step = 0.1, disabled = false, highlight = false,
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; min?: number; max?: number; step?: number;
  disabled?: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-2 transition-all ${disabled ? "border-white/[0.04] opacity-60" : highlight ? "border-orange-500/30 bg-orange-500/5" : "border-white/[0.06] hover:border-white/10"}`}>
      <div className="text-[9px] text-zinc-500 mb-1 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          min={min} max={max} step={step}
          className="flex-1 bg-transparent text-sm font-mono font-bold text-white focus:outline-none min-w-0 disabled:cursor-not-allowed"
        />
        {unit && <span className="text-[10px] text-zinc-600 flex-shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({ label, value, color = "text-cyan-400", sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-white/[0.04] last:border-0">
      <div>
        <div className="text-[10px] text-zinc-500">{label}</div>
        {sub && <div className="text-[9px] text-zinc-700 mt-0.5">{sub}</div>}
      </div>
      <div className={`text-sm font-bold font-mono tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RollToolingCalculator() {
  const store = useCncStore(s => ({
    materialThickness: s.materialThickness,
    rollDiameter: s.rollDiameter,
    shaftDiameter: s.shaftDiameter,
    numStations: s.numStations,
  }));

  const [mode, setMode] = useState<Mode>("semi");
  const [resultTab, setResultTab] = useState<ResultTab>("rolls");

  // ── Inputs ─────────────────────────────────────────────────────────────────
  const [stripWidth, setStripWidth]     = useState(200);
  const [thickness, setThickness]       = useState(1.5);
  const [profileHeight, setProfileHeight] = useState(30);
  const [profileWidth, setProfileWidth]  = useState(120);
  const [material, setMaterial]         = useState<MaterialType>("GI");
  const [profileType, setProfileType]   = useState<ProfileType>("C_CHANNEL");
  const [motorPower, setMotorPower]     = useState(15);
  const [lineSpeed, setLineSpeed]       = useState(15);
  const [numStations, setNumStations]   = useState(12);
  const [bearingLoad, setBearingLoad]   = useState<BearingLoad>("medium");

  // Manual overrides
  const [manualRollOD, setManualRollOD]       = useState(150);
  const [manualShaftDia, setManualShaftDia]   = useState(40);
  const [manualRollWidth, setManualRollWidth] = useState(180);

  const [expandedStation, setExpandedStation] = useState<number | null>(null);

  // Fully auto — sync from store
  useEffect(() => {
    if (mode === "full") {
      setThickness(store.materialThickness);
      setNumStations(store.numStations);
      setManualRollOD(store.rollDiameter);
      setManualShaftDia(store.shaftDiameter);
    }
  }, [mode, store.materialThickness, store.rollDiameter, store.shaftDiameter, store.numStations]);

  const results = useMemo(() => calculateResults(
    stripWidth, thickness, profileHeight, profileWidth,
    material, profileType, motorPower, lineSpeed, numStations,
    manualRollOD, manualShaftDia, manualRollWidth,
    bearingLoad, mode
  ), [stripWidth, thickness, profileHeight, profileWidth, material, profileType,
      motorPower, lineSpeed, numStations, manualRollOD, manualShaftDia, manualRollWidth,
      bearingLoad, mode]);

  const rollMat = ROLL_MATERIAL_DB[results.recommendedMaterial];
  const isManual = mode === "manual";
  const isAuto   = mode === "full";

  const handleExportReport = useCallback(() => {
    const lines = [
      "SAI ROLOTECH — ROLL TOOLING CALCULATION REPORT",
      "=".repeat(56),
      `Mode: ${mode.toUpperCase()} | Date: ${new Date().toLocaleDateString("en-GB")}`,
      `Profile Type: ${PROFILE_TYPES[profileType].label}`,
      `Strip: ${stripWidth} × ${thickness}mm | Material: ${STRIP_MATERIAL_DB[material].label}`,
      `Profile: ${profileWidth} × ${profileHeight}mm | Stations: ${numStations}`,
      "",
      "── ROLL DIMENSIONS ──────────────────────────────",
      `Roll OD:          ${results.rollOD} mm`,
      `Face Width:       ${results.faceWidth} mm`,
      `Total Roll Width: ${results.rollWidth} mm`,
      `Groove Depth:     ${results.grooveDepth} mm`,
      `Shaft (Bore):     Ø${results.shaftDia} mm`,
      `Keyway:           ${results.keyway.width}×${results.keyway.height} mm`,
      "",
      "── BEARING SPECIFICATION ────────────────────────",
      ...(results.recommendedBearing ? [
        `Bearing:          ${results.recommendedBearing.designation} (${results.recommendedBearing.series} series)`,
        `Bore × OD × W:    Ø${results.recommendedBearing.boreDia} × Ø${results.recommendedBearing.outerDia} × ${results.recommendedBearing.width}mm`,
        `Dynamic C:        ${results.recommendedBearing.dynamicC} kN`,
        `L10 Life:         ${Math.round(results.recommendedBearing.L10Hours).toLocaleString()} hours`,
      ] : ["No matching bearing found"]),
      "",
      "── ROLL MATERIAL ────────────────────────────────",
      `Material:         ${rollMat.label}`,
      `Hardness:         ${rollMat.hardnessHRC} HRC`,
      `Heat Treatment:   ${rollMat.heatTreat}`,
      `Expected Life:    ${rollMat.volumeLife}`,
      "",
      "── FORCES & POWER ───────────────────────────────",
      `Bending Force:    ${results.bendingForce.toFixed(0)} N`,
      `Torque/Station:   ${results.torquePerStation.toFixed(1)} Nm`,
      `Power Required:   ${results.powerRequired.toFixed(2)} kW`,
      `Safety Factor:    ${results.safetyFactor.toFixed(2)}`,
      "",
      "── WARNINGS ─────────────────────────────────────",
      ...(results.warnings.length ? results.warnings.map(w => `⚠ ${w}`) : ["✓ No issues found"]),
      "",
      "── STATION TABLE ────────────────────────────────",
      "Stn | Roll OD | Width | Bore  | Groove | Bend°",
      "-".repeat(52),
      ...results.stationRolls.map(r =>
        `${String(r.station).padStart(3)} | ${String(r.rollOD).padStart(7)} | ${String(r.rollWidth).padStart(5)} | ${String(r.boreDia).padStart(5)} | ${r.grooveDepth.toFixed(1).padStart(6)} | ${r.bendAngle}°`
      ),
      "",
      "Generated by SAI Rolotech Smart Engines v2.2.11",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `RollToolingCalc_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [results, mode, stripWidth, thickness, profileHeight, profileWidth, material, profileType, numStations, rollMat]);

  return (
    <div className="flex flex-col h-full bg-[#060810] text-white overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#080c14] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Settings2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Roll Tooling Calculator</h1>
            <p className="text-[10px] text-zinc-500">Bearing · Bore · Roll Size · Material — Manual / Semi-Auto / Fully Auto</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Selector */}
          <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5 gap-0.5">
            {([
              { id: "manual", icon: <Settings2 className="w-3.5 h-3.5" />, label: "Manual",      color: "text-amber-400" },
              { id: "semi",   icon: <Calculator className="w-3.5 h-3.5" />, label: "Semi-Auto",  color: "text-cyan-400" },
              { id: "full",   icon: <Bot className="w-3.5 h-3.5" />,        label: "Fully Auto", color: "text-emerald-400" },
            ] as { id: Mode; icon: React.ReactNode; label: string; color: string }[]).map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${mode === m.id ? `${m.color} bg-white/[0.08] border border-white/[0.12]` : "text-zinc-600 hover:text-zinc-400"}`}
              >
                {m.icon}{m.label}
              </button>
            ))}
          </div>

          {/* Warnings badge */}
          {results.warnings.length > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-900/20 border border-yellow-500/20 rounded-lg px-2.5 py-1.5 text-[10px] text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              {results.warnings.length} Warning{results.warnings.length > 1 ? "s" : ""}
            </div>
          )}
          {results.warnings.length === 0 && (
            <div className="flex items-center gap-1.5 bg-green-900/20 border border-green-500/20 rounded-lg px-2.5 py-1.5 text-[10px] text-green-400">
              <CheckCircle className="w-3 h-3" /> Verified
            </div>
          )}

          <button onClick={handleExportReport}
            className="flex items-center gap-1.5 h-8 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs text-white font-semibold transition-colors">
            <Download className="w-3.5 h-3.5" /> Export Report
          </button>
        </div>
      </div>

      {/* ── Mode Info Banner ───────────────────────────────────────────────── */}
      {mode === "full" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-900/10 border-b border-emerald-500/10 flex-shrink-0">
          <Bot className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-[10px] text-emerald-300">
            Fully Auto Mode — Values pulled from active design in store: thickness {store.materialThickness}mm · roll Ø{store.rollDiameter} · shaft Ø{store.shaftDiameter} · {store.numStations} stations
          </span>
        </div>
      )}
      {mode === "semi" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-cyan-900/10 border-b border-cyan-500/10 flex-shrink-0">
          <Calculator className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span className="text-[10px] text-cyan-300">
            Semi-Auto Mode — Enter strip material / profile parameters → Roll OD, Shaft Ø, Roll Width, Bearings auto-calculated
          </span>
        </div>
      )}
      {mode === "manual" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-900/10 border-b border-amber-500/10 flex-shrink-0">
          <Settings2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-[10px] text-amber-300">
            Manual Mode — All values are user-controlled. System verifies and shows safety analysis only.
          </span>
        </div>
      )}

      {/* ── Main Layout ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Input Panel ─────────────────────────────────────────────── */}
        <div className="w-[300px] flex-shrink-0 border-r border-white/[0.06] overflow-y-auto bg-[#070b12] p-3 space-y-4">

          {/* Profile Setup */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Box className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Profile Setup</span>
            </div>

            <div className="mb-2">
              <div className="text-[9px] text-zinc-500 mb-1 uppercase tracking-wide">Profile Type</div>
              <select
                value={profileType}
                onChange={e => setProfileType(e.target.value as ProfileType)}
                disabled={isAuto}
                className="w-full h-8 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 text-xs text-zinc-300 focus:outline-none disabled:opacity-50"
              >
                {Object.entries(PROFILE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <InputField label="Strip Width" value={stripWidth} onChange={setStripWidth} unit="mm" min={50} max={2000} step={5} disabled={isAuto} />
              <InputField label="Thickness" value={thickness} onChange={setThickness} unit="mm" min={0.3} max={12} step={0.1} disabled={isAuto} />
              <InputField label="Profile Height" value={profileHeight} onChange={setProfileHeight} unit="mm" min={5} max={200} step={1} disabled={isAuto} />
              <InputField label="Profile Width" value={profileWidth} onChange={setProfileWidth} unit="mm" min={20} max={500} step={5} disabled={isAuto} />
            </div>
          </div>

          {/* Strip Material */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Strip Material</span>
            </div>
            <select
              value={material}
              onChange={e => setMaterial(e.target.value as MaterialType)}
              disabled={isAuto}
              className="w-full h-8 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 text-xs text-zinc-300 focus:outline-none mb-2 disabled:opacity-50"
            >
              {Object.entries(STRIP_MATERIAL_DB).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({k})</option>
              ))}
            </select>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-[9px] space-y-0.5">
              <div className="flex justify-between"><span className="text-zinc-600">Yield Strength</span><span className="text-zinc-400">{STRIP_MATERIAL_DB[material].yieldStr} MPa</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Tensile Strength</span><span className="text-zinc-400">{STRIP_MATERIAL_DB[material].tensile} MPa</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">K-Factor</span><span className="text-zinc-400">{STRIP_MATERIAL_DB[material].kFactor}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">Min Bend Radius</span><span className="text-zinc-400">{STRIP_MATERIAL_DB[material].bendRadFactor}×t</span></div>
            </div>
          </div>

          {/* Machine Parameters */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Machine Parameters</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <InputField label="Motor Power" value={motorPower} onChange={setMotorPower} unit="kW" min={1} max={200} step={0.5} disabled={isAuto} />
              <InputField label="Line Speed" value={lineSpeed} onChange={setLineSpeed} unit="m/min" min={1} max={100} step={1} disabled={isAuto} />
              <InputField label="No. of Stations" value={numStations} onChange={setNumStations} unit="" min={3} max={30} step={1} disabled={isAuto} />
              <div>
                <div className="text-[9px] text-zinc-500 mb-1 uppercase tracking-wide">Bearing Load</div>
                <select value={bearingLoad} onChange={e => setBearingLoad(e.target.value as BearingLoad)}
                  className="w-full h-[38px] bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 text-xs text-zinc-300 focus:outline-none">
                  <option value="light">Light (0.6×)</option>
                  <option value="medium">Medium (1.0×)</option>
                  <option value="heavy">Heavy (1.5×)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Manual Roll Override */}
          {(mode === "manual" || mode === "full") && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Roll Dimensions (Override)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InputField label="Roll OD" value={manualRollOD} onChange={setManualRollOD} unit="mm" min={50} max={500} step={5} highlight={isManual} />
                <InputField label="Shaft Ø (Bore)" value={manualShaftDia} onChange={setManualShaftDia} unit="mm" min={20} max={150} step={5} highlight={isManual} />
                <InputField label="Roll Width" value={manualRollWidth} onChange={setManualRollWidth} unit="mm" min={30} max={400} step={5} highlight={isManual} />
              </div>
            </div>
          )}

          {/* Warnings */}
          {results.warnings.length > 0 && (
            <div className="space-y-1.5">
              {results.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-yellow-900/10 border border-yellow-500/10 rounded-lg p-2">
                  <AlertCircle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[9px] text-yellow-300">{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Results Panel ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Result Tab Bar */}
          <div className="flex border-b border-white/[0.06] bg-[#080c14] flex-shrink-0">
            {([
              { id: "rolls",    icon: <Circle className="w-3.5 h-3.5" />,     label: "Roll Design" },
              { id: "bearings", icon: <HardDrive className="w-3.5 h-3.5" />,  label: "Bearing Selection" },
              { id: "material", icon: <Wrench className="w-3.5 h-3.5" />,     label: "Roll Material" },
              { id: "report",   icon: <BookOpen className="w-3.5 h-3.5" />,   label: "Station Table" },
            ] as { id: ResultTab; icon: React.ReactNode; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setResultTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold border-b-2 transition-all ${resultTab === t.id ? "text-cyan-400 border-cyan-500 bg-cyan-500/5" : "text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-white/[0.02]"}`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Roll Design Tab ─────────────────────────────────────────────── */}
          {resultTab === "rolls" && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-4">

                {/* Key Results Cards */}
                {[
                  { label: "Roll Outer Diameter", value: `Ø${results.rollOD}`, unit: "mm", color: "from-orange-600 to-amber-600", icon: <Circle className="w-5 h-5" />, sub: `Face Width: ${results.faceWidth}mm` },
                  { label: "Shaft / Bore", value: `Ø${results.shaftDia}`, unit: "mm", color: "from-blue-600 to-cyan-600", icon: <HardDrive className="w-5 h-5" />, sub: `Keyway: ${results.keyway.width}×${results.keyway.height}mm` },
                  { label: "Total Roll Width", value: `${results.rollWidth}`, unit: "mm", color: "from-purple-600 to-violet-600", icon: <Box className="w-5 h-5" />, sub: `Groove Depth: ${results.grooveDepth}mm` },
                ].map(c => (
                  <div key={c.label} className={`rounded-xl bg-gradient-to-br ${c.color} p-px`}>
                    <div className="rounded-[11px] bg-[#080c14] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{c.label}</span>
                        <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-zinc-400">{c.icon}</div>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold text-white tabular-nums">{c.value}</span>
                        <span className="text-zinc-500 text-sm">{c.unit}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1">{c.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Detailed Results */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                {/* Dimensions table */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Circle className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-semibold text-zinc-300">Roll Dimensions</span>
                  </div>
                  {[
                    { label: "Outer Diameter",   value: `Ø${results.rollOD} mm`,         color: "text-orange-400" },
                    { label: "Face Width",        value: `${results.faceWidth} mm`,        color: "text-cyan-400" },
                    { label: "Total Roll Width",  value: `${results.rollWidth} mm`,        color: "text-cyan-400" },
                    { label: "Bore (Shaft Hole)", value: `Ø${results.shaftDia} mm`,        color: "text-blue-400" },
                    { label: "Groove Depth",      value: `${results.grooveDepth} mm`,      color: "text-purple-400" },
                    { label: "Keyway W×H",        value: `${results.keyway.width}×${results.keyway.height} mm`, color: "text-zinc-300" },
                    { label: "Wall Thickness",    value: `${Math.round((results.rollOD - results.shaftDia) / 2)} mm`, color: results.rollOD / results.shaftDia < 2.5 ? "text-red-400" : "text-green-400" },
                  ].map(r => <ResultRow key={r.label} {...r} />)}
                </div>

                {/* Forces & Power */}
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-semibold text-zinc-300">Forces & Power</span>
                  </div>
                  {[
                    { label: "Bending Force",     value: `${results.bendingForce.toFixed(0)} N`,   color: "text-amber-400" },
                    { label: "Torque / Station",  value: `${results.torquePerStation.toFixed(1)} Nm`, color: "text-orange-400" },
                    { label: "Power Required",    value: `${results.powerRequired.toFixed(2)} kW`,  color: results.powerRequired > motorPower ? "text-red-400" : "text-green-400", sub: motorPower > 0 ? `Motor: ${motorPower} kW` : undefined },
                    { label: "Safety Factor",     value: results.safetyFactor.toFixed(2),          color: results.safetyFactor < 2 ? "text-red-400" : results.safetyFactor < 3 ? "text-yellow-400" : "text-green-400" },
                    { label: "Line Speed",        value: `${lineSpeed} m/min`,                     color: "text-cyan-400" },
                    { label: "Roll RPM",          value: `${Math.round((lineSpeed * 1000) / (Math.PI * results.rollOD))} rpm`, color: "text-zinc-300" },
                    { label: "Strip Material",    value: STRIP_MATERIAL_DB[material].label,         color: "text-zinc-400" },
                  ].map(r => <ResultRow key={r.label} {...r} />)}
                </div>
              </div>

              {/* Visual Roll Cross-Section */}
              <div className="mt-4 bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                <div className="text-xs font-semibold text-zinc-300 mb-3">Roll Cross-Section Preview</div>
                <div className="flex gap-8 items-end justify-center py-2">
                  {["upper", "lower"].map(side => {
                    const OD = results.rollOD;
                    const BORE = results.shaftDia;
                    const W = 180, H = 180;
                    const cx = W / 2, cy = H / 2;
                    const scale = (W * 0.42) / (OD / 2);
                    const outerR = (OD / 2) * scale;
                    const boreR = (BORE / 2) * scale;
                    const grooveR = outerR * (1 - results.grooveDepth / (OD / 2));
                    const color = side === "upper" ? "#3b82f6" : "#f97316";
                    return (
                      <div key={side} className="text-center">
                        <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">{side} roll</div>
                        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                          <rect width={W} height={H} fill="#040608" rx={8} />
                          <circle cx={cx} cy={cy} r={outerR} fill="#1e293b" stroke={color} strokeWidth={1.5} />
                          <circle cx={cx} cy={cy} r={grooveR} fill="#0f172a" stroke={color} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 3" />
                          <circle cx={cx} cy={cy} r={boreR} fill="#040608" stroke="#475569" strokeWidth={1.5} />
                          <rect x={cx - results.keyway.width / 2 * scale} y={cy - boreR - results.keyway.height * scale}
                            width={results.keyway.width * scale} height={results.keyway.height * scale}
                            fill="#1e293b" stroke="#64748b" strokeWidth={0.8} rx={1} />
                          <line x1={cx - outerR + 3} y1={cy} x2={cx + outerR - 3} y2={cy} stroke="#1e293b" strokeWidth={0.5} />
                          <line x1={cx} y1={cy - outerR + 3} x2={cx} y2={cy + outerR - 3} stroke="#1e293b" strokeWidth={0.5} />
                          {side === "upper" && <line x1={cx - outerR} y1={cy + outerR} x2={cx + outerR} y2={cy + outerR} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 3" />}
                          {side === "lower" && <line x1={cx - outerR} y1={cy - outerR} x2={cx + outerR} y2={cy - outerR} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 3" />}
                          <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize={11} fontWeight="bold" fontFamily="monospace">Ø{OD}</text>
                          <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace">Bore Ø{BORE}</text>
                        </svg>
                      </div>
                    );
                  })}
                  <div className="flex flex-col gap-1 text-[10px] text-zinc-600 self-center pl-4">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-400/60" /><span>Outer Ø{results.rollOD}</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-blue-400/40 border-dashed" style={{borderTop: "1px dashed"}} /><span>Groove Ø{results.rollOD - results.grooveDepth * 2}</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-zinc-500/60" /><span>Bore Ø{results.shaftDia}</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-green-400/60" style={{borderTop: "1px dashed"}} /><span>Pass Line</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Bearing Selection Tab ──────────────────────────────────────── */}
          {resultTab === "bearings" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Recommended bearing */}
              {results.recommendedBearing && (
                <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-bold text-cyan-300">Recommended Bearing</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1 text-[10px] text-cyan-400">
                      <CheckCircle className="w-3 h-3" /> Best Match
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Designation", value: results.recommendedBearing.designation, color: "text-white text-2xl font-bold" },
                      { label: "Bore × OD × W", value: `Ø${results.recommendedBearing.boreDia}×Ø${results.recommendedBearing.outerDia}×${results.recommendedBearing.width}mm`, color: "text-cyan-400 font-bold" },
                      { label: "Dynamic Load C", value: `${results.recommendedBearing.dynamicC} kN`, color: "text-amber-400 font-bold" },
                      { label: "L10 Life", value: `${results.recommendedBearing.L10Hours > 1e6 ? ">1M" : Math.round(results.recommendedBearing.L10Hours).toLocaleString()} hrs`, color: results.recommendedBearing.L10Hours > 20000 ? "text-green-400 font-bold" : "text-red-400 font-bold" },
                    ].map(c => (
                      <div key={c.label}>
                        <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">{c.label}</div>
                        <div className={c.color}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 bg-white/[0.02] rounded-lg p-2.5 text-[9px] text-zinc-500">
                    Series: {results.recommendedBearing.series} · Static C₀: {results.recommendedBearing.staticC0} kN · Mass: {results.recommendedBearing.massKg} kg · Radial Load Applied: {results.recommendedBearing.radialLoad.toFixed(2)} kN
                  </div>
                </div>
              )}

              {/* All matching bearings table */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[11px] font-semibold text-zinc-300">All Bearings for Shaft Ø{results.shaftDia} mm</span>
                </div>
                {results.bearings.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.04]">
                        {["No.", "Series", "Bore", "OD", "Width", "C (kN)", "C₀ (kN)", "Mass", "L10 Hours", ""].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[9px] text-zinc-600 uppercase tracking-wider font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.bearings.map((b, i) => {
                        const isRec = b.designation === results.recommendedBearing?.designation;
                        return (
                          <tr key={i} className={`border-b border-white/[0.03] transition-colors ${isRec ? "bg-cyan-500/5" : "hover:bg-white/[0.02]"}`}>
                            <td className={`px-3 py-2 font-bold font-mono ${isRec ? "text-cyan-400" : "text-zinc-300"}`}>{b.designation}</td>
                            <td className="px-3 py-2 text-zinc-500">{b.series}</td>
                            <td className="px-3 py-2 text-cyan-400 font-mono">Ø{b.boreDia}</td>
                            <td className="px-3 py-2 text-zinc-400 font-mono">Ø{b.outerDia}</td>
                            <td className="px-3 py-2 text-zinc-400 font-mono">{b.width}mm</td>
                            <td className="px-3 py-2 text-amber-400 font-mono">{b.dynamicC}</td>
                            <td className="px-3 py-2 text-zinc-500 font-mono">{b.staticC0}</td>
                            <td className="px-3 py-2 text-zinc-600 font-mono">{b.massKg}kg</td>
                            <td className={`px-3 py-2 font-mono font-bold ${b.L10Hours > 20000 ? "text-green-400" : "text-red-400"}`}>
                              {b.L10Hours > 1e6 ? ">1M" : Math.round(b.L10Hours).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">{isRec && <span className="text-[8px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 rounded px-1.5 py-0.5">BEST</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-4 py-6 text-center text-zinc-600 text-xs">
                    No standard bearings for Ø{results.shaftDia}mm. Adjust shaft diameter.
                    <div className="mt-1 text-[9px]">Available: {[...new Set(BEARING_DB.map(b => b.boreDia))].sort((a,b) => a-b).join(", ")} mm</div>
                  </div>
                )}
              </div>

              {/* Bearing mounting info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                  <div className="text-[10px] font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Shaft Tolerances</div>
                  {[
                    { label: "Shaft Fit",        value: "k5 / m5 (tight press)" },
                    { label: "Housing Fit",      value: "H7 (sliding)" },
                    { label: "Shaft Roughness",  value: "Ra 0.4–0.8 µm" },
                    { label: "Housing Roughness",value: "Ra 0.8–1.6 µm" },
                    { label: "Shoulder Height",  value: `${Math.round(results.shaftDia * 0.05)} mm` },
                  ].map(r => <ResultRow key={r.label} label={r.label} value={r.value} />)}
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                  <div className="text-[10px] font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Lubrication</div>
                  {[
                    { label: "Lubricant Type",   value: "NLGI-2 Grease" },
                    { label: "Grease Amount",    value: `${Math.round(results.shaftDia * 0.005 * 10) / 10} g / bearing` },
                    { label: "Interval",         value: "500–1000 hours" },
                    { label: "Temp Range",       value: "-20°C to +120°C" },
                    { label: "SKF Equivalent",   value: "LGMT 2 / LGEP 2" },
                  ].map(r => <ResultRow key={r.label} label={r.label} value={r.value} />)}
                </div>
              </div>
            </div>
          )}

          {/* ── Roll Material Tab ──────────────────────────────────────────── */}
          {resultTab === "material" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Recommended */}
              <div className="rounded-xl border p-4" style={{ borderColor: rollMat.color + "40", backgroundColor: rollMat.color + "08" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: rollMat.color }} />
                    <span className="text-sm font-bold text-white">{rollMat.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg border" style={{ borderColor: rollMat.color + "40", color: rollMat.color }}>
                    <Shield className="w-3 h-3" /> Recommended for {material}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: "Hardness",     value: rollMat.hardnessHRC },
                    { label: "Tensile",      value: `${rollMat.tensile} MPa` },
                    { label: "Yield",        value: `${rollMat.yieldStr} MPa` },
                    { label: "Expected Life",value: rollMat.volumeLife },
                    { label: "Relative Cost",value: "★".repeat(rollMat.cost) },
                  ].map(c => (
                    <div key={c.label} className="bg-white/[0.03] rounded-lg p-2.5">
                      <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">{c.label}</div>
                      <div className="text-[11px] font-bold text-white">{c.value}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-white/[0.03] rounded-lg p-2.5 text-[10px] text-zinc-500 mb-2">{rollMat.notes}</div>
                <div className="bg-black/30 rounded-lg p-2.5">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Heat Treatment</div>
                  <div className="text-[11px] text-amber-300 font-mono">{rollMat.heatTreat}</div>
                </div>
              </div>

              {/* All materials comparison */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.04] text-[11px] font-semibold text-zinc-300">Roll Material Comparison</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      {["Material", "Hardness", "Tensile (MPa)", "Expected Life", "Cost", "Best For"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[9px] text-zinc-600 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.entries(ROLL_MATERIAL_DB) as [RollMaterial, typeof ROLL_MATERIAL_DB[RollMaterial]][]).map(([key, m]) => {
                      const isRec = key === results.recommendedMaterial;
                      return (
                        <tr key={key} className={`border-b border-white/[0.03] ${isRec ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"} transition-colors`}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                              <span className={`font-semibold ${isRec ? "text-white" : "text-zinc-400"}`}>{m.label}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-400">{m.hardnessHRC}</td>
                          <td className="px-3 py-2 font-mono text-zinc-400">{m.tensile}</td>
                          <td className="px-3 py-2 text-zinc-400">{m.volumeLife}</td>
                          <td className="px-3 py-2 text-amber-400">{"★".repeat(m.cost)}</td>
                          <td className="px-3 py-2 text-zinc-500 text-[9px]">{m.recommended.join(", ")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Station Table Tab ──────────────────────────────────────────── */}
          {resultTab === "report" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Summary header */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                <div className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider mb-1">Pass Summary</div>
                <div className="text-[11px] text-zinc-400 font-mono">{results.passInfo}</div>
              </div>

              {/* Station table */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-300">Station-by-Station Roll Specifications</span>
                  <span className="text-[9px] text-zinc-600">{numStations} stations total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/[0.05]">
                        {["Stn", "Upper/Lower", "Roll OD (mm)", "Face Width (mm)", "Total Width (mm)", "Bore Ø (mm)", "Groove Depth", "Keyway W×H", "Bend Angle", "Profile Depth"].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[9px] text-zinc-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.stationRolls.map(r => (
                        <React.Fragment key={r.station}>
                          {["Upper", "Lower"].map(side => (
                            <tr key={side} onClick={() => setExpandedStation(expandedStation === r.station ? null : r.station)}
                              className={`border-b border-white/[0.03] cursor-pointer transition-colors ${expandedStation === r.station ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}
                            >
                              {side === "Upper" && (
                                <td className="px-3 py-2 text-orange-400 font-bold font-mono" rowSpan={2}>
                                  S{String(r.station).padStart(2, "0")}
                                </td>
                              )}
                              <td className="px-3 py-2">
                                <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${side === "Upper" ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"}`}>
                                  {side}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-cyan-400 font-mono">Ø{r.rollOD + (side === "Lower" ? 2 : 0)}</td>
                              <td className="px-3 py-2 text-zinc-400 font-mono">{r.faceWidth}</td>
                              <td className="px-3 py-2 text-zinc-400 font-mono">{r.rollWidth}</td>
                              <td className="px-3 py-2 text-blue-400 font-mono">Ø{r.boreDia}</td>
                              <td className="px-3 py-2 text-zinc-400 font-mono">{r.grooveDepth.toFixed(1)}</td>
                              <td className="px-3 py-2 text-zinc-500 font-mono">{r.keyway.width}×{r.keyway.height}</td>
                              {side === "Upper" && (
                                <>
                                  <td className="px-3 py-2 text-amber-400 font-mono" rowSpan={2}>{r.bendAngle}°</td>
                                  <td className="px-3 py-2 text-zinc-500 font-mono" rowSpan={2}>
                                    {(profileHeight * r.station / numStations).toFixed(1)} mm
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                          {expandedStation === r.station && (
                            <tr>
                              <td colSpan={10} className="px-3 py-3 bg-white/[0.02] border-b border-white/[0.04]">
                                <div className="flex gap-6 text-[10px]">
                                  <div>
                                    <div className="text-zinc-600 mb-1 uppercase tracking-wider text-[9px]">Station Notes</div>
                                    <div className="text-zinc-400">Progressive bend: {r.bendAngle}° → {r.bendAngle + Math.round(90 / numStations)}° at next station</div>
                                    <div className="text-zinc-400 mt-0.5">Forming force est.: {Math.round(results.bendingForce * r.station / numStations)} N</div>
                                  </div>
                                  <div>
                                    <div className="text-zinc-600 mb-1 uppercase tracking-wider text-[9px]">G-Code Ref</div>
                                    <div className="text-emerald-300 font-mono text-[9px]">
                                      {`G00 X${(r.rollOD + 5) * 2}.0 Z2.0\nG01 Z-${r.rollWidth}.0 F0.15`}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-zinc-600 mb-1 uppercase tracking-wider text-[9px]">Bearing Info</div>
                                    <div className="text-cyan-300">{results.recommendedBearing?.designation ?? "—"} × 2 per station</div>
                                    <div className="text-zinc-500 mt-0.5">Housing width: {results.recommendedBearing?.width ?? "—"}mm each side</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
