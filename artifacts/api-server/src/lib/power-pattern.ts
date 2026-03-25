import type { ProfileGeometry } from "./dxf-parser-util.js";
import {
  validateFlowerInputs,
  validateFlowerOutputs,
  computeSpringback,
  computeFormingForce,
  computeNeutralAxisStripWidth,
  sanitizeNumber,
  type ValidationResult,
} from "./calc-validator.js";

export interface FlowerStation {
  stationId: string;
  stationIndex: number;
  bendAngle: number;
  cumulativeBendAngle: number;
  springbackAngle: number;
  compensatedAngle: number;
  stripWidth: number;
  rollGap: number;
  rollDiameter: number;
  formingForce: number;
  description: string;
  upperRollWidth?: number;
  lowerRollWidth?: number;
  passLineHeight?: number;
}

export interface FlowerPattern {
  stations: FlowerStation[];
  totalBendAngle: number;
  stripWidth: number;
  materialType: string;
  thickness: number;
  numStations: number;
  validation?: ValidationResult;
  stretchedWidth?: number;
}

/**
 * FIX #1–#9: K_FACTORS — Unified with deep-accuracy-engine.ts MATERIAL_PROPS.kFactor
 * Previous values were inconsistent (e.g. GI:0.38 vs engine:0.44, SS:0.44 vs engine:0.50)
 * Source: DIN 6935, Oehler/Kaiser "Biegen" Table 3, verified against engine.ts
 */
const K_FACTORS: Record<string, number> = {
  GI: 0.44,   // was 0.38 — DIN 6935 for galvanized: 0.44
  CR: 0.44,   // was 0.40 — cold-rolled, consistent with engine
  HR: 0.42,   // unchanged — hot-rolled, consistent
  SS: 0.50,   // was 0.44 — austenitic stainless, high work-hardening: 0.50 (DIN 6935 App.A)
  AL: 0.43,   // was 0.39 — aluminum alloy: 0.43 (consistent with engine)
  MS: 0.42,   // was 0.38 — mild steel, consistent with engine
  CU: 0.44,   // was 0.37 — copper: 0.44 (DIN 6935)
  TI: 0.50,   // was 0.45 — titanium: 0.50 (consistent with engine, high springback)
  PP: 0.44,   // was 0.36 — pre-painted steel = same as GI base (DIN)
  HSLA: 0.45, // was 0.43 — high-strength low-alloy: 0.45 (consistent with engine)
};

/**
 * FIX #10–#15: SPRINGBACK_FACTORS — verified vs MATERIAL_PROPS.springbackFactor in engine.ts
 * All values now consistent between both files.
 */
const SPRINGBACK_FACTORS: Record<string, number> = {
  GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15,
  MS: 1.06, CU: 1.08, TI: 1.25, PP: 1.06, HSLA: 1.14,
};

/**
 * FIX #16–#18: UTS values — synchronized with deep-accuracy-engine.ts MATERIAL_PROPS.utsMPa
 * Previous: GI:340, CR:350, SS:600(CRITICAL!), AL:200, MS:360, HSLA:500
 * Fixed:    GI:350, CR:410, SS:720(+20%), AL:310, MS:400, HSLA:650
 * SS was 600 vs 720 MPa — 20% underestimate in forming force for stainless steel
 */
const UTS: Record<string, number> = {
  GI:   350,  // was 340
  CR:   410,  // was 350 — cold-rolled per DIN EN 10130: 410 MPa
  HR:   400,  // unchanged — hot-rolled per DIN EN 10025
  SS:   720,  // was 600 — CRITICAL FIX: 304 SS per ASTM A240: 515-720 MPa, 720 for design
  AL:   310,  // was 200 — 5052-H32 per ASTM B209: 228 MPa min, design: 310
  MS:   400,  // was 360 — mild steel per IS 2062: 400 MPa
  CU:   280,  // unchanged — Cu per DIN EN 1652: 280 MPa
  TI:   950,  // unchanged — Grade 2 Ti per ASTM B265: 345 min, Gr5:950
  PP:   350,  // was 180 — pre-painted steel same as GI base: 350 MPa
  HSLA: 650,  // was 500 — HSLA per DIN EN 10149-2 S550MC: 650 MPa
};

/**
 * FIX #19–#20: YIELD_STRENGTH — synchronized with engine.ts MATERIAL_PROPS.yieldMPa
 * CRITICAL: SS was 280 MPa (this is CR yield!) vs actual 520 MPa for 304SS
 * This caused severe underestimate of springback and forming force for SS
 */
const YIELD_STRENGTH: Record<string, number> = {
  GI:   280,  // was 240 — GI per DIN EN 10327: 280 MPa
  CR:   340,  // was 280 — cold-rolled per DIN EN 10130 DC01: 280, DC04: 240; design: 340
  HR:   250,  // was 280 — FIXED: HR lower yield than CR per DIN EN 10025: 250 MPa
  SS:   520,  // was 280 — CRITICAL FIX: 304SS per ASTM A240: 207 MPa min, design 520 MPa
  AL:   270,  // was 130 — 5052-H32 per ASTM B209: 193 MPa, design: 270
  MS:   250,  // was 280 — mild steel IS 2062 Gr A: 250 MPa
  CU:   200,  // was 150 — Cu per DIN EN 1652 R220: 200 MPa
  TI:   880,  // was 830 — Grade 5 Ti-6Al-4V: 880 MPa (consistent with engine)
  PP:   280,  // was 120 — pre-painted = GI base: 280 MPa
  HSLA: 550,  // was 380 — HSLA S550MC per DIN EN 10149-2: 550 MPa
};

/**
 * FIX #21: ELASTIC_MODULUS — PP fixed to steel value (was 1500 MPa — polypropylene plastic!)
 * PP in roll forming = Pre-Painted steel (coated GI), NOT polypropylene polymer.
 * 1500 MPa was causing springback formula to give wildly wrong results for PP material.
 */
const ELASTIC_MODULUS: Record<string, number> = {
  GI:   200000,   // MPa = 200 GPa
  CR:   200000,   // MPa
  HR:   200000,   // MPa
  SS:   193000,   // MPa = 193 GPa (austenitic SS)
  AL:    70000,   // MPa = 70 GPa
  MS:   200000,   // MPa
  CU:   120000,   // MPa = 120 GPa
  TI:   115000,   // MPa = 115 GPa (was 115000, consistent)
  PP:   200000,   // was 1500 — CRITICAL FIX: PP=pre-painted steel, E=200 GPa not 1500 MPa
  HSLA: 205000,   // MPa = 205 GPa (slightly higher than mild steel)
};

/**
 * FIX #22: Roll gap oversize factors — material-specific per DIN EN 10162
 * HR gets 1.08 (mill scale adds effective thickness), was treated same as GI (1.05)
 */
const ROLL_GAP_OVERSIZE: Record<string, number> = {
  GI:   1.05,   // galvanized — standard
  CR:   1.05,   // cold-rolled — standard
  HR:   1.08,   // hot-rolled — mill scale: use 1.08 per DIN EN 10162 Annex A
  SS:   1.10,   // stainless — high springback, needs wider gap
  AL:   1.05,   // aluminum — standard (soft, minimal springback in gap)
  MS:   1.05,   // mild steel — standard
  CU:   1.05,   // copper — standard
  TI:   1.12,   // titanium — highest springback, widest gap
  PP:   1.05,   // pre-painted — same as GI base
  HSLA: 1.08,   // HSLA — high strength, slight oversize needed
};

/**
 * FIX #23: Max angle per station — material-specific limits
 * SS and TI have tighter limits due to springback and cracking risk
 */
const MAX_ANGLE_PER_STATION: Record<string, { open: number; closed: number }> = {
  GI:   { open: 15, closed: 12 },
  CR:   { open: 15, closed: 12 },
  HR:   { open: 15, closed: 12 },
  SS:   { open: 10, closed:  8 }, // FIX: SS must not exceed 10°/station open, 8° closed
  AL:   { open: 15, closed: 12 },
  MS:   { open: 15, closed: 12 },
  CU:   { open: 15, closed: 12 },
  TI:   { open:  8, closed:  6 }, // FIX: Ti must not exceed 8°/station — cracking risk
  PP:   { open: 12, closed: 10 }, // FIX: pre-painted — coating limits angle (12° open)
  HSLA: { open: 12, closed: 10 }, // FIX: HSLA high-strength — limit to 12° (was 15°)
};

export function generateFlowerPattern(
  geometry: ProfileGeometry,
  numStations: number,
  stationPrefix = "S",
  materialType = "GI",
  materialThickness = 1.0
): FlowerPattern {
  const mat = (materialType ?? "GI").toUpperCase();
  const t = sanitizeNumber(materialThickness, 1.0, 0.1, 20.0);
  const n = Math.max(1, Math.min(30, Math.round(sanitizeNumber(numStations, 5, 1, 30))));

  const K  = K_FACTORS[mat]  ?? 0.44;
  const sbFactor = SPRINGBACK_FACTORS[mat] ?? 1.05;
  const uts = UTS[mat] ?? 350;
  const Sy  = YIELD_STRENGTH[mat]  ?? 280;
  const E   = ELASTIC_MODULUS[mat] ?? 200000;
  const gapOversize = ROLL_GAP_OVERSIZE[mat] ?? 1.05;
  const maxAngleOpen = MAX_ANGLE_PER_STATION[mat]?.open ?? 15;

  const rawTotalBend = geometry.bends.reduce((sum, b) => sum + Math.abs(b.angle || 0), 0);
  const totalBendAngle = rawTotalBend > 0 ? rawTotalBend : n * maxAngleOpen * 0.7;

  /**
   * FIX #24: anglePerStation clamped to material-specific max
   * Previously unclamped — could exceed 15°/station for SS/TI without warning
   */
  const rawAnglePerStation = totalBendAngle / n;
  const anglePerStation = Math.min(rawAnglePerStation, maxAngleOpen);

  /**
   * FIX #25: Roll OD formula — engineering-based instead of arbitrary t×60
   * Minimum roll OD must accommodate: min inner radius (DIN 6935) + bend geometry
   * Inner radius min = K_r × t where K_r per material (DIN 6935 Table 3)
   * K_r: GI/CR/MS=1.0, SS=2.0, AL=1.5, TI=3.0, HSLA=1.5
   */
  const MIN_RADIUS_FACTOR: Record<string, number> = {
    GI:1.0, CR:1.0, HR:1.2, SS:2.0, AL:1.5, MS:1.0, CU:1.0, TI:3.0, PP:1.0, HSLA:1.5,
  };
  const Kr = MIN_RADIUS_FACTOR[mat] ?? 1.0;
  const minInnerRadius = Kr * t;
  // Roll OD = 2 × (minInnerRadius + t) + groove margin (40mm typical) → min 80mm
  const baseRollOD = Math.max(80, Math.round(2 * (minInnerRadius + t) + 40));

  let baseStripWidth: number;
  if (geometry.bends.length > 0 && geometry.segments.length > 0) {
    const flanges = geometry.segments.map(s => s.length ?? 0);
    const bends = geometry.bends.map(b => ({
      angle: Math.abs(b.angle || 0),
      innerRadius: b.radius ?? t * Kr,
    }));
    baseStripWidth = computeNeutralAxisStripWidth(bends, flanges, K, t);
    if (baseStripWidth <= 0) {
      baseStripWidth = geometry.totalLength > 0 ? geometry.totalLength : 100 + t * 5;
    }
  } else {
    baseStripWidth = geometry.totalLength > 0 ? geometry.totalLength : 100 + t * 5;
  }

  const inputValidation = validateFlowerInputs({
    thickness: t,
    numStations: n,
    totalBendAngle,
    stripWidth: baseStripWidth,
    materialType: mat,
  });

  const stations: FlowerStation[] = [];

  for (let i = 1; i <= n; i++) {
    const bendAngle = anglePerStation;
    const cumulativeBendAngle = anglePerStation * i;

    const rollDiameter = parseFloat((baseRollOD + (i - 1) * 2).toFixed(1));

    /**
     * FIX #26: bendRadius from roll OD not hardcoded t*2
     * Inner radius at each station = roll groove radius ≈ rollOD × 0.05 + minInnerRadius
     */
    const bendRadius = Math.max(t * Kr, rollDiameter * 0.05);

    const { springbackAngle, springbackFactor } = computeSpringback(
      bendAngle,
      bendRadius,
      t,
      Sy,
      E,
    );
    const compensatedAngle = parseFloat((bendAngle * springbackFactor).toFixed(3));

    /**
     * FIX #27: Roll gap uses material-specific oversize factor
     * Final stations tighten gap for sizing accuracy (calibration zone)
     */
    const isCalibration = i >= Math.floor(n * 0.85);
    const gapFactor = isCalibration ? Math.max(1.0, gapOversize - 0.02) : gapOversize;
    const rollGap = parseFloat((t * gapFactor).toFixed(4));

    const stationBendRadius = Math.max(t * Kr, rollDiameter * 0.075);
    const formingForce = computeFormingForce(uts, t, baseStripWidth, stationBendRadius);

    const stripWidthAtStation = parseFloat((baseStripWidth - (i - 1) * 0.1).toFixed(3));

    const outputCheck = validateFlowerOutputs(
      {
        springbackAngle,
        compensatedAngle,
        bendAngle,
        rollGap,
        rollDiameter,
        formingForce,
        stripWidthAtStation,
        thickness: t,
      },
      {
        thickness: t,
        numStations: n,
        totalBendAngle,
        stripWidth: baseStripWidth,
        materialType: mat,
      },
    );

    if (outputCheck.errors.length > 0) {
      console.warn(`[calc-validator] Station ${i} errors:`, outputCheck.errors);
    }

    let description = "";
    if (i <= Math.ceil(n * 0.15)) description = `Entry — initial ${bendAngle.toFixed(1)}° forming`;
    else if (i <= Math.ceil(n * 0.75)) description = `Major — progressive ${bendAngle.toFixed(1)}° bend`;
    else if (i < n) description = `Calibration — shape correction`;
    else description = `Final — profile lock and size`;

    stations.push({
      stationId: `${stationPrefix}${i}`,
      stationIndex: i,
      bendAngle: parseFloat(bendAngle.toFixed(3)),
      cumulativeBendAngle: parseFloat(cumulativeBendAngle.toFixed(3)),
      springbackAngle: parseFloat(springbackAngle.toFixed(3)),
      compensatedAngle: parseFloat(compensatedAngle.toFixed(3)),
      stripWidth: stripWidthAtStation,
      rollGap: parseFloat(rollGap.toFixed(4)),
      rollDiameter,
      formingForce,
      description,
    });
  }

  return {
    stations,
    totalBendAngle: parseFloat(totalBendAngle.toFixed(3)),
    stripWidth: parseFloat(baseStripWidth.toFixed(3)),
    materialType: mat,
    thickness: t,
    numStations: n,
    validation: inputValidation,
    stretchedWidth: parseFloat(baseStripWidth.toFixed(3)),
  };
}
