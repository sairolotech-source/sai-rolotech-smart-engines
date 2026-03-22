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

const K_FACTORS: Record<string, number> = {
  GI: 0.38, CR: 0.40, HR: 0.42, SS: 0.44, AL: 0.39,
  MS: 0.38, CU: 0.37, TI: 0.45, PP: 0.36, HSLA: 0.43,
};

const SPRINGBACK_FACTORS: Record<string, number> = {
  GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15,
  MS: 1.06, CU: 1.08, TI: 1.25, PP: 1.06, HSLA: 1.14,
};

const UTS: Record<string, number> = {
  GI: 340, CR: 350, HR: 400, SS: 600, AL: 200,
  MS: 360, CU: 250, TI: 950, PP: 180, HSLA: 500,
};

const YIELD_STRENGTH: Record<string, number> = {
  GI: 240, CR: 280, HR: 280, SS: 280, AL: 130,
  MS: 280, CU: 150, TI: 830, PP: 120, HSLA: 380,
};

const ELASTIC_MODULUS: Record<string, number> = {
  GI: 200000, CR: 200000, HR: 200000, SS: 193000, AL: 70000,
  MS: 200000, CU: 120000, TI: 115000, PP: 1500, HSLA: 205000,
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

  const K  = K_FACTORS[mat]  ?? 0.38;
  const sbFactor = SPRINGBACK_FACTORS[mat] ?? 1.05;
  const uts = UTS[mat] ?? 350;
  const Sy  = YIELD_STRENGTH[mat]  ?? 280;
  const E   = ELASTIC_MODULUS[mat] ?? 200000;

  const rawTotalBend = geometry.bends.reduce((sum, b) => sum + Math.abs(b.angle || 0), 0);
  const totalBendAngle = rawTotalBend > 0 ? rawTotalBend : n * 15;
  const anglePerStation = totalBendAngle / n;

  const baseRollOD = Math.max(80, t * 60);

  let baseStripWidth: number;
  if (geometry.bends.length > 0 && geometry.segments.length > 0) {
    const flanges = geometry.segments.map(s => s.length ?? 0);
    const bends = geometry.bends.map(b => ({
      angle: Math.abs(b.angle || 0),
      innerRadius: b.radius ?? t * 1.5,
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

    const progress = i / n;
    const rollDiameter = parseFloat((baseRollOD + (i - 1) * 2).toFixed(1));
    const bendRadius = rollDiameter * 0.5 * 0.1;

    const { springbackAngle, springbackFactor } = computeSpringback(
      bendAngle,
      bendRadius,
      t,
      Sy,
      E,
    );
    const compensatedAngle = parseFloat((bendAngle * springbackFactor).toFixed(3));

    const rollGap = parseFloat((t * (1 + 0.02 * (n - i))).toFixed(4));

    const stationBendRadius = Math.max(t * 1.5, rollDiameter * 0.5 * 0.15);
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
