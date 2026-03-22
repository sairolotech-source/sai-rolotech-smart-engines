import type { ProfileGeometry } from "./dxf-parser-util.js";

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

export function generateFlowerPattern(
  geometry: ProfileGeometry,
  numStations: number,
  stationPrefix = "S",
  materialType = "GI",
  materialThickness = 1.0
): FlowerPattern {
  const mat = materialType.toUpperCase();
  const t = parseFloat(String(materialThickness)) || 1.0;
  const n = Math.max(1, parseInt(String(numStations)));

  const K = K_FACTORS[mat] ?? 0.38;
  const sbFactor = SPRINGBACK_FACTORS[mat] ?? 1.05;
  const uts = UTS[mat] ?? 350;

  const totalBendAngle = geometry.bends.reduce((sum, b) => sum + (b.angle || 0), 0) || n * 15;
  const anglePerStation = totalBendAngle / n;

  const baseRollOD = Math.max(80, t * 60);
  const baseStripWidth = geometry.totalLength > 0 ? geometry.totalLength : 100 + t * 5;

  const stations: FlowerStation[] = [];

  for (let i = 1; i <= n; i++) {
    const bendAngle = anglePerStation;
    const cumulativeBendAngle = anglePerStation * i;
    const springbackAngle = (bendAngle * (sbFactor - 1));
    const compensatedAngle = bendAngle + springbackAngle;

    const progress = i / n;
    const rollDiameter = baseRollOD + (i - 1) * 2;
    const rollGap = t * (1 + 0.02 * (n - i));

    // Karnezis forming force model
    const contactArc = Math.sqrt(rollDiameter * t * 0.5);
    const w = baseStripWidth * 0.001;
    const formingForce = Math.round(1.5 * uts * t * t * w / (2 * 0.005) * 0.001);

    let description = "";
    if (i <= Math.ceil(n * 0.15)) description = `Entry — initial ${bendAngle.toFixed(1)}° forming`;
    else if (i <= Math.ceil(n * 0.75)) description = `Major — progressive ${bendAngle.toFixed(1)}° bend`;
    else if (i < n) description = `Calibration — shape correction`;
    else description = `Final — profile lock and size`;

    stations.push({
      stationId: `${stationPrefix}${i}`,
      stationIndex: i,
      bendAngle: parseFloat(bendAngle.toFixed(2)),
      cumulativeBendAngle: parseFloat(cumulativeBendAngle.toFixed(2)),
      springbackAngle: parseFloat(springbackAngle.toFixed(2)),
      compensatedAngle: parseFloat(compensatedAngle.toFixed(2)),
      stripWidth: parseFloat((baseStripWidth - (i - 1) * 0.1).toFixed(2)),
      rollGap: parseFloat(rollGap.toFixed(3)),
      rollDiameter: parseFloat(rollDiameter.toFixed(1)),
      formingForce,
      description,
    });
  }

  return {
    stations,
    totalBendAngle: parseFloat(totalBendAngle.toFixed(2)),
    stripWidth: parseFloat(baseStripWidth.toFixed(2)),
    materialType: mat,
    thickness: t,
    numStations: n,
  };
}
