import type { ProfileGeometry, Segment } from "./dxf-parser-util.js";
import { resolveMaterialInput, type MaterialModel, type ResolvedMaterialModel } from "./material-model.js";
import type { FlowerPassPhysics, FlowerStation } from "./power-pattern.js";

export type RollRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Phase2RollToolingInput {
  flowerStations: FlowerStation[];
  flowerPasses?: FlowerPassPhysics[];
  profileGeometry?: ProfileGeometry;
  material?: string;
  thickness: number;
  toleranceMm?: number;
  clearanceMm?: number;
}

export interface Phase2RollStation {
  pass: number;
  stationId: string;
  phaseZone: "ENTRY" | "FORMING" | "SIZING";
  neutralRadius: number;
  rollRadius: number;
  gap: number;
  tolerance: number;
  clearance: number;
  shaftPosition: number;
  lowerShaftPosition: number;
  centerlineError: number;
  strain: number;
  strainLimit: number;
  riskLevel: RollRiskLevel;
}

export interface RollGeometryPoint {
  x: number;
  y: number;
}

export interface RollGeometrySegmentMap {
  segmentIndex: number;
  segmentType: Segment["type"];
  stripContactPath: RollGeometryPoint[];
  upperRoll: RollGeometryPoint[];
  lowerRoll: RollGeometryPoint[];
}

export interface Phase2RollGeometry {
  stationId: string;
  pass: number;
  upperRoll: RollGeometryPoint[];
  lowerRoll: RollGeometryPoint[];
  stripContactPath: RollGeometryPoint[];
  mappedSegments: RollGeometrySegmentMap[];
}

export interface Phase2AlignmentReport {
  centerlineTarget: number;
  maxCenterlineError: number;
  alignmentTolerance: number;
  withinTolerance: boolean;
}

export interface Phase2ValidationReport {
  isEngineeringValid: boolean;
  warnings: string[];
}

export interface Phase2MaterialReport extends MaterialModel {
  materialUsed: string;
}

export interface Phase2RollToolingResult {
  materialUsed: string;
  materialModel: Phase2MaterialReport;
  rollStations: Phase2RollStation[];
  rollGeometryByStation: Phase2RollGeometry[];
  alignment: Phase2AlignmentReport;
  validation: Phase2ValidationReport;
  sampleRollSet: Phase2RollStation[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: number, precision = 4): number {
  return parseFloat(value.toFixed(precision));
}

function stationZone(index: number, total: number): "ENTRY" | "FORMING" | "SIZING" {
  if (total <= 1) return "FORMING";
  const progress = index / Math.max(1, total - 1);
  if (progress < 0.25) return "ENTRY";
  if (progress >= 0.85) return "SIZING";
  return "FORMING";
}

function defaultTolerance(material: ResolvedMaterialModel, thickness: number): number {
  const hardnessFactor = material.maxStrain < 0.12 ? 1.3 : material.maxStrain < 0.18 ? 1.15 : 1.0;
  return clamp(thickness * 0.04 * hardnessFactor, 0.02, 0.35);
}

function defaultClearance(material: ResolvedMaterialModel, thickness: number): number {
  const springbackFactor = material.maxStrain < 0.12 ? 1.12 : material.maxStrain < 0.18 ? 1.06 : 1.0;
  return clamp(thickness * 0.06 * springbackFactor, 0.03, 0.50);
}

function stationFactor(zone: "ENTRY" | "FORMING" | "SIZING"): { tolerance: number; clearance: number } {
  if (zone === "ENTRY") return { tolerance: 1.08, clearance: 1.08 };
  if (zone === "SIZING") return { tolerance: 0.90, clearance: 0.94 };
  return { tolerance: 1.0, clearance: 1.0 };
}

function findPass(stationId: string, passes?: FlowerPassPhysics[]): FlowerPassPhysics | undefined {
  if (!passes || passes.length === 0) return undefined;
  return passes.find(pass => pass.stationId === stationId);
}

function inferNeutralRadius(
  station: FlowerStation,
  pass: FlowerPassPhysics | undefined,
  thickness: number,
): number {
  if (pass && pass.neutralAxisRadius > 0) return pass.neutralAxisRadius;
  if (typeof station.neutralAxisRadius === "number" && station.neutralAxisRadius > 0) return station.neutralAxisRadius;
  if (typeof station.bendRadius === "number" && station.bendRadius > 0) return station.bendRadius + thickness / 2;
  const fallbackBendRadius = Math.max(thickness * 1.5, (station.rollDiameter || 80) * 0.05);
  return fallbackBendRadius + thickness / 2;
}

function inferStrain(station: FlowerStation, pass: FlowerPassPhysics | undefined, thickness: number, neutralRadius: number): number {
  if (pass && pass.strain > 0) return pass.strain;
  if (typeof station.strain === "number" && station.strain > 0) return station.strain;
  const bendRadius = Math.max(0.001, neutralRadius - thickness / 2);
  return thickness / (2 * bendRadius);
}

function inferRisk(
  station: FlowerStation,
  pass: FlowerPassPhysics | undefined,
  strain: number,
  strainLimit: number,
): RollRiskLevel {
  const fromPass = pass?.riskLevel;
  if (fromPass === "LOW" || fromPass === "MEDIUM" || fromPass === "HIGH") return fromPass;
  const fromStation = station.riskLevel;
  if (fromStation === "LOW" || fromStation === "MEDIUM" || fromStation === "HIGH") return fromStation;
  if (strain < strainLimit * 0.6) return "LOW";
  if (strain < strainLimit * 0.85) return "MEDIUM";
  return "HIGH";
}

function interpolateArc(segment: Segment): RollGeometryPoint[] {
  if (
    segment.type !== "arc" ||
    typeof segment.cx !== "number" ||
    typeof segment.cy !== "number" ||
    typeof segment.radius !== "number" ||
    segment.radius <= 0
  ) {
    return [
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
    ];
  }

  const startAngle = typeof segment.startAngle === "number"
    ? segment.startAngle
    : (Math.atan2(segment.y1 - segment.cy, segment.x1 - segment.cx) * 180) / Math.PI;
  const rawEndAngle = typeof segment.endAngle === "number"
    ? segment.endAngle
    : (Math.atan2(segment.y2 - segment.cy, segment.x2 - segment.cx) * 180) / Math.PI;

  let sweep = rawEndAngle - startAngle;
  if (sweep <= 0) sweep += 360;
  const sampleCount = Math.max(6, Math.ceil(Math.abs(sweep) / 15));
  const points: RollGeometryPoint[] = [];

  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = startAngle + (sweep * index) / sampleCount;
    const rad = (angle * Math.PI) / 180;
    points.push({
      x: segment.cx + segment.radius * Math.cos(rad),
      y: segment.cy + segment.radius * Math.sin(rad),
    });
  }
  return points;
}

function sampleSegmentPoints(segment: Segment): RollGeometryPoint[] {
  if (segment.type === "line") {
    return [
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
    ];
  }
  return interpolateArc(segment);
}

function mapPointToRollContour(
  point: RollGeometryPoint,
  centroid: RollGeometryPoint,
  progress: number,
  gap: number,
): { strip: RollGeometryPoint; upper: RollGeometryPoint; lower: RollGeometryPoint } {
  const x = point.x - centroid.x;
  const yBase = point.y - centroid.y;
  const stripY = yBase * progress;

  // Upper roll mirrors strip path, lower roll follows strip path.
  return {
    strip: { x: toNumber(x), y: toNumber(stripY) },
    upper: { x: toNumber(x), y: toNumber(-stripY + gap / 2) },
    lower: { x: toNumber(x), y: toNumber(stripY - gap / 2) },
  };
}

function appendUniquePoint(target: RollGeometryPoint[], point: RollGeometryPoint): void {
  const last = target[target.length - 1];
  if (!last || Math.abs(last.x - point.x) > 1e-6 || Math.abs(last.y - point.y) > 1e-6) {
    target.push(point);
  }
}

function buildStationRollGeometry(
  stationId: string,
  pass: number,
  profileGeometry: ProfileGeometry | undefined,
  progress: number,
  gap: number,
): Phase2RollGeometry | null {
  if (!profileGeometry || !Array.isArray(profileGeometry.segments) || profileGeometry.segments.length === 0) {
    return null;
  }

  const centroid = profileGeometry.centroid
    ? { x: profileGeometry.centroid.x, y: profileGeometry.centroid.y }
    : {
      x: (profileGeometry.boundingBox.minX + profileGeometry.boundingBox.maxX) / 2,
      y: (profileGeometry.boundingBox.minY + profileGeometry.boundingBox.maxY) / 2,
    };

  const mappedSegments: RollGeometrySegmentMap[] = [];
  const upperRoll: RollGeometryPoint[] = [];
  const lowerRoll: RollGeometryPoint[] = [];
  const stripContactPath: RollGeometryPoint[] = [];

  profileGeometry.segments.forEach((segment, segmentIndex) => {
    const sampled = sampleSegmentPoints(segment);
    const upperSegment: RollGeometryPoint[] = [];
    const lowerSegment: RollGeometryPoint[] = [];
    const stripSegment: RollGeometryPoint[] = [];

    for (const point of sampled) {
      const mapped = mapPointToRollContour(point, centroid, progress, gap);
      upperSegment.push(mapped.upper);
      lowerSegment.push(mapped.lower);
      stripSegment.push(mapped.strip);
      appendUniquePoint(upperRoll, mapped.upper);
      appendUniquePoint(lowerRoll, mapped.lower);
      appendUniquePoint(stripContactPath, mapped.strip);
    }

    mappedSegments.push({
      segmentIndex,
      segmentType: segment.type,
      stripContactPath: stripSegment,
      upperRoll: upperSegment,
      lowerRoll: lowerSegment,
    });
  });

  return {
    stationId,
    pass,
    upperRoll,
    lowerRoll,
    stripContactPath,
    mappedSegments,
  };
}

export function generatePhase2RollTooling(input: Phase2RollToolingInput): Phase2RollToolingResult {
  const thickness = input.thickness > 0 ? input.thickness : 1.0;
  const stations = Array.isArray(input.flowerStations) ? input.flowerStations : [];
  if (stations.length === 0) {
    throw new Error("flowerStations[] is required for Phase-2 roll tooling");
  }

  const material = resolveMaterialInput(input.material);
  const toleranceBase = input.toleranceMm && input.toleranceMm > 0
    ? input.toleranceMm
    : defaultTolerance(material, thickness);
  const clearanceBase = input.clearanceMm && input.clearanceMm > 0
    ? input.clearanceMm
    : defaultClearance(material, thickness);
  const maxCumulativeAngle = stations.reduce((max, station) => {
    const value = typeof station.cumulativeBendAngle === "number" ? station.cumulativeBendAngle : 0;
    return Math.max(max, value);
  }, 0);
  const stationProgress: number[] = [];

  const rollStations: Phase2RollStation[] = stations.map((station, index) => {
    const zone = stationZone(index, stations.length);
    const factor = stationFactor(zone);
    const pass = findPass(station.stationId, input.flowerPasses);
    const cumulative = typeof station.cumulativeBendAngle === "number"
      ? station.cumulativeBendAngle
      : pass?.cumulativeBendAngle ?? 0;
    const progress = maxCumulativeAngle > 0
      ? clamp(cumulative / maxCumulativeAngle, 0.15, 1.0)
      : clamp((index + 1) / stations.length, 0.15, 1.0);
    stationProgress.push(progress);

    const neutralRadius = inferNeutralRadius(station, pass, thickness);
    const tolerance = toleranceBase * factor.tolerance;
    const clearance = clearanceBase * factor.clearance;

    // Roll radius relation from engineering brief: Roll Radius ≈ Neutral Radius + clearance.
    const rollRadius = neutralRadius + clearance;
    // Gap relation from engineering brief: Gap = Thickness + tolerance.
    const gap = thickness + tolerance;

    // Centerline alignment: upper and lower shaft positions are symmetric around target centerline y=0.
    const upperShaftY = rollRadius + gap / 2;
    const lowerShaftY = -upperShaftY;
    const centerlineError = Math.abs((upperShaftY + lowerShaftY) / 2);

    const strain = inferStrain(station, pass, thickness, neutralRadius);
    const strainLimit = material.maxStrain;
    const riskLevel = inferRisk(station, pass, strain, strainLimit);

    return {
      pass: index + 1,
      stationId: station.stationId,
      phaseZone: zone,
      neutralRadius: toNumber(neutralRadius),
      rollRadius: toNumber(rollRadius),
      gap: toNumber(gap),
      tolerance: toNumber(tolerance),
      clearance: toNumber(clearance),
      shaftPosition: toNumber(upperShaftY),
      lowerShaftPosition: toNumber(lowerShaftY),
      centerlineError: toNumber(centerlineError, 6),
      strain: toNumber(strain, 6),
      strainLimit: toNumber(strainLimit, 6),
      riskLevel,
    };
  });

  const maxCenterlineError = rollStations.reduce((max, station) => Math.max(max, station.centerlineError), 0);
  const alignmentTolerance = 0.01;
  const warnings: string[] = [];
  const rollGeometryByStation: Phase2RollGeometry[] = [];

  for (const station of rollStations) {
    if (station.rollRadius <= station.neutralRadius) {
      warnings.push(`${station.stationId}: rollRadius must be > neutralRadius`);
    }
    if (station.gap <= thickness) {
      warnings.push(`${station.stationId}: gap must be > thickness`);
    }
    if (station.gap > thickness + 1.5) {
      warnings.push(`${station.stationId}: gap ${station.gap}mm appears too large for thickness ${thickness}mm`);
    }
    if (station.rollRadius > 250) {
      warnings.push(`${station.stationId}: rollRadius ${station.rollRadius}mm is unusually high; verify geometry scaling`);
    }
  }

  if (input.profileGeometry && input.profileGeometry.segments.length > 0) {
    rollStations.forEach((station, index) => {
      const geometry = buildStationRollGeometry(
        station.stationId,
        station.pass,
        input.profileGeometry,
        stationProgress[index] ?? 1,
        station.gap,
      );
      if (geometry) {
        rollGeometryByStation.push(geometry);
      }
    });
  } else {
    warnings.push("Profile geometry not provided — roll contour mapping skipped");
  }

  const alignment: Phase2AlignmentReport = {
    centerlineTarget: 0,
    maxCenterlineError: toNumber(maxCenterlineError, 6),
    alignmentTolerance,
    withinTolerance: maxCenterlineError <= alignmentTolerance,
  };
  if (!alignment.withinTolerance) {
    warnings.push(`Centerline alignment exceeded tolerance ${alignmentTolerance}mm`);
  }

  const validation: Phase2ValidationReport = {
    isEngineeringValid: warnings.length === 0,
    warnings,
  };

  const materialModel: Phase2MaterialReport = {
    ...material,
    materialUsed: material.materialUsed,
  };

  return {
    materialUsed: material.materialUsed,
    materialModel,
    rollStations,
    rollGeometryByStation,
    alignment,
    validation,
    sampleRollSet: rollStations.slice(0, Math.min(3, rollStations.length)),
  };
}
