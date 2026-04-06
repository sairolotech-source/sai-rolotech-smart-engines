import { resolveMaterialInput } from "./material-model.js";
import type { FlowerPassPhysics, FlowerStation } from "./power-pattern.js";
import type { Phase2RollGeometry, Phase2RollStation, RollRiskLevel } from "./phase2-roll-tooling-engine.js";
import { generatePhase3Simulation, type Phase3SimulationResult } from "./phase3-simulation-engine.js";

export interface Phase4OptimizationInput {
  flowerStations: FlowerStation[];
  flowerPasses?: FlowerPassPhysics[];
  rollStations: Phase2RollStation[];
  rollGeometryByStation?: Phase2RollGeometry[];
  material?: string;
  thickness: number;
}

export interface OptimizedPass {
  stationId: string;
  pass: number;
  originalAngle: number;
  optimizedAngle: number;
  deltaAngle: number;
  baseStrain: number;
  predictedStrain: number;
  strainLimit: number;
  riskLevel: RollRiskLevel;
}

export interface OptimizationMetrics {
  totalAngle: number;
  peakPredictedStrain: number;
  averagePredictedStrain: number;
  highRiskPasses: number;
}

export interface OptimizationSummary {
  totalAngleBefore: number;
  totalAngleAfter: number;
  angleConserved: boolean;
  wasCappedByStationLimit: boolean;
  peakStrainBefore: number;
  peakStrainAfter: number;
  peakReductionPct: number;
  highRiskBefore: number;
  highRiskAfter: number;
}

export interface Phase4OptimizationResult {
  model: "phase4_optimization_engine_v1";
  materialUsed: string;
  optimizedPasses: OptimizedPass[];
  optimizedFlower: {
    stations: FlowerStation[];
    passes: FlowerPassPhysics[];
  };
  originalMetrics: OptimizationMetrics;
  optimizedMetrics: OptimizationMetrics;
  summary: OptimizationSummary;
  recommendations: string[];
  beforeSimulation: Phase3SimulationResult;
  afterSimulation: Phase3SimulationResult;
}

interface OptimizationRow {
  stationId: string;
  pass: number;
  phaseZone: "ENTRY" | "FORMING" | "SIZING";
  originalAngle: number;
  baseStrain: number;
  strainLimit: number;
  riskLevel: RollRiskLevel;
  bendRadius: number;
  neutralAxisRadius: number;
  originalStation?: FlowerStation;
  originalPass?: FlowerPassPhysics;
}

const MAX_ANGLE_BY_MATERIAL: Record<string, number> = {
  GI: 15,
  CR: 15,
  HR: 15,
  SS: 10,
  AL: 15,
  MS: 15,
  CU: 15,
  TI: 8,
  PP: 12,
  HSLA: 12,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: number, precision = 4): number {
  return parseFloat(value.toFixed(precision));
}

function findStation(stationId: string, stations: FlowerStation[]): FlowerStation | undefined {
  return stations.find(station => station.stationId === stationId);
}

function findPass(stationId: string, passes?: FlowerPassPhysics[]): FlowerPassPhysics | undefined {
  if (!passes || passes.length === 0) return undefined;
  return passes.find(pass => pass.stationId === stationId);
}

function inferRiskLevel(predictedStrain: number, strainLimit: number): RollRiskLevel {
  if (predictedStrain < strainLimit * 0.6) return "LOW";
  if (predictedStrain < strainLimit * 0.85) return "MEDIUM";
  return "HIGH";
}

function inferBendRadius(
  thickness: number,
  rollStation: Phase2RollStation,
  station: FlowerStation | undefined,
  pass: FlowerPassPhysics | undefined,
): number {
  if (pass && pass.bendRadius > 0) return pass.bendRadius;
  if (station && typeof station.bendRadius === "number" && station.bendRadius > 0) return station.bendRadius;
  return Math.max(thickness, rollStation.neutralRadius - thickness / 2);
}

function inferStrain(
  thickness: number,
  rollStation: Phase2RollStation,
  station: FlowerStation | undefined,
  pass: FlowerPassPhysics | undefined,
  bendRadius: number,
): number {
  if (pass && pass.strain > 0) return pass.strain;
  if (station && typeof station.strain === "number" && station.strain > 0) return station.strain;
  if (rollStation.strain > 0) return rollStation.strain;
  return thickness / (2 * Math.max(0.001, bendRadius));
}

function inferStrainLimit(
  defaultLimit: number,
  station: FlowerStation | undefined,
  pass: FlowerPassPhysics | undefined,
): number {
  if (pass && pass.strainLimit > 0) return pass.strainLimit;
  if (station && typeof station.strainLimit === "number" && station.strainLimit > 0) return station.strainLimit;
  return defaultLimit;
}

function buildRows(input: Phase4OptimizationInput): OptimizationRow[] {
  const material = resolveMaterialInput(input.material);
  return input.rollStations.map((rollStation, index) => {
    const station = findStation(rollStation.stationId, input.flowerStations);
    const pass = findPass(rollStation.stationId, input.flowerPasses);
    const originalAngle = pass?.bendAngle ?? station?.bendAngle ?? 0;
    const bendRadius = inferBendRadius(input.thickness, rollStation, station, pass);
    const baseStrain = inferStrain(input.thickness, rollStation, station, pass, bendRadius);
    const strainLimit = inferStrainLimit(material.maxStrain, station, pass);

    return {
      stationId: rollStation.stationId,
      pass: rollStation.pass || index + 1,
      phaseZone: rollStation.phaseZone,
      originalAngle,
      baseStrain,
      strainLimit,
      riskLevel: rollStation.riskLevel,
      bendRadius,
      neutralAxisRadius: rollStation.neutralRadius,
      originalStation: station,
      originalPass: pass,
    };
  });
}

function stationWeight(index: number, count: number): number {
  const center = (count - 1) / 2;
  const width = Math.max(1, count * 0.35);
  const x = (index - center) / width;
  const bell = Math.exp(-0.5 * x * x);
  const edgeScale = index === 0 || index === count - 1 ? 0.82 : 1.0;
  return Math.max(0.1, (0.25 + bell) * edgeScale);
}

function riskModifier(risk: RollRiskLevel): number {
  if (risk === "LOW") return 1.08;
  if (risk === "MEDIUM") return 1.0;
  return 0.82;
}

function zoneModifier(zone: "ENTRY" | "FORMING" | "SIZING"): number {
  if (zone === "ENTRY") return 0.88;
  if (zone === "SIZING") return 0.94;
  return 1.08;
}

function riskBalanceModifier(risk: RollRiskLevel): number {
  if (risk === "HIGH") return 0.72;
  if (risk === "MEDIUM") return 0.98;
  return 1.08;
}

function allocateAnglesByWeight(totalAngle: number, weights: number[]): number[] {
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  return weights.map(weight => (totalAngle * weight) / weightSum);
}

function enforceMaxAngle(
  allocatedAngles: number[],
  targetTotalAngle: number,
  maxAngle: number,
  weights: number[],
): { angles: number[]; capped: boolean } {
  const angles = allocatedAngles.map(angle => Math.min(maxAngle, Math.max(0, angle)));
  let remaining = targetTotalAngle - angles.reduce((sum, value) => sum + value, 0);
  let capped = false;
  let guard = 0;

  while (remaining > 1e-8 && guard < 24) {
    const availableIndices = angles
      .map((value, index) => ({ value, index }))
      .filter(item => maxAngle - item.value > 1e-8)
      .map(item => item.index);
    if (availableIndices.length === 0) {
      capped = true;
      break;
    }

    const activeWeight = availableIndices.reduce((sum, index) => sum + (weights[index] ?? 0), 0);
    if (activeWeight <= 0) {
      capped = true;
      break;
    }

    let distributed = 0;
    for (const index of availableIndices) {
      const room = maxAngle - (angles[index] ?? 0);
      const share = remaining * ((weights[index] ?? 0) / activeWeight);
      const add = Math.min(room, share);
      if (add > 0) {
        angles[index] = (angles[index] ?? 0) + add;
        distributed += add;
      }
    }
    if (distributed <= 1e-9) {
      capped = true;
      break;
    }
    remaining = targetTotalAngle - angles.reduce((sum, value) => sum + value, 0);
    guard += 1;
  }

  return { angles, capped };
}

function smoothAngles(angles: number[], iterations = 2): number[] {
  if (angles.length <= 2) return [...angles];
  let current = [...angles];
  for (let pass = 0; pass < iterations; pass += 1) {
    const next = [...current];
    for (let index = 0; index < current.length; index += 1) {
      const value = current[index] ?? 0;
      if (index === 0) {
        next[index] = value * 0.75 + (current[index + 1] ?? value) * 0.25;
      } else if (index === current.length - 1) {
        next[index] = value * 0.75 + (current[index - 1] ?? value) * 0.25;
      } else {
        const neighborAvg = ((current[index - 1] ?? value) + (current[index + 1] ?? value)) / 2;
        next[index] = value * 0.6 + neighborAvg * 0.4;
      }
    }
    current = next;
  }
  return current;
}

function computeMetrics(passes: OptimizedPass[]): OptimizationMetrics {
  const totalAngle = passes.reduce((sum, pass) => sum + pass.optimizedAngle, 0);
  const peakPredictedStrain = passes.reduce((max, pass) => Math.max(max, pass.predictedStrain), 0);
  const avg = passes.length > 0
    ? passes.reduce((sum, pass) => sum + pass.predictedStrain, 0) / passes.length
    : 0;
  const highRiskPasses = passes.filter(pass => pass.riskLevel === "HIGH").length;
  return {
    totalAngle: toNumber(totalAngle),
    peakPredictedStrain: toNumber(peakPredictedStrain, 6),
    averagePredictedStrain: toNumber(avg, 6),
    highRiskPasses,
  };
}

export function optimizeFlowerDistribution(input: Phase4OptimizationInput): Phase4OptimizationResult {
  const material = resolveMaterialInput(input.material);
  const rows = buildRows(input);
  if (rows.length === 0) {
    throw new Error("rollStations[] is required for optimization");
  }

  const totalOriginalAngle = rows.reduce((sum, row) => sum + row.originalAngle, 0);
  const maxAnglePerPass = MAX_ANGLE_BY_MATERIAL[material.code] ?? 15;
  const feasibleMaxTotal = maxAnglePerPass * rows.length;
  const targetTotalAngle = Math.min(totalOriginalAngle, feasibleMaxTotal);

  const weights = rows.map((row, index) => {
    const progressive = stationWeight(index, rows.length);
    const strainCapacity = clamp(row.strainLimit / Math.max(1e-6, row.baseStrain), 0.5, 1.8);
    return progressive * strainCapacity * riskModifier(row.riskLevel) * zoneModifier(row.phaseZone);
  });

  const distributed = allocateAnglesByWeight(targetTotalAngle, weights);
  const smoothed = smoothAngles(distributed, 3);
  const firstEnforced = enforceMaxAngle(smoothed, targetTotalAngle, maxAnglePerPass, weights);
  const riskRebalanced = firstEnforced.angles.map((angle, index) => {
    const row = rows[index];
    return angle * riskBalanceModifier(row?.riskLevel ?? "MEDIUM");
  });
  const secondEnforced = enforceMaxAngle(riskRebalanced, targetTotalAngle, maxAnglePerPass, weights);
  const optimizedAngles = secondEnforced.angles;

  const originalAvgAngle = totalOriginalAngle / Math.max(1, rows.length);
  let cumulativeAngle = 0;
  const optimizedPasses: OptimizedPass[] = rows.map((row, index) => {
    const optimizedAngle = optimizedAngles[index] ?? 0;
    const scaleRef = (row.originalAngle > 0 ? row.originalAngle : Math.max(0.1, originalAvgAngle * 0.5));
    const scale = clamp((optimizedAngle + 0.1) / (scaleRef + 0.1), 0.5, 1.6);
    const predictedStrain = row.baseStrain * scale;
    const riskLevel = inferRiskLevel(predictedStrain, row.strainLimit);

    cumulativeAngle += optimizedAngle;
    return {
      stationId: row.stationId,
      pass: row.pass,
      originalAngle: toNumber(row.originalAngle),
      optimizedAngle: toNumber(optimizedAngle),
      deltaAngle: toNumber(optimizedAngle - row.originalAngle),
      baseStrain: toNumber(row.baseStrain, 6),
      predictedStrain: toNumber(predictedStrain, 6),
      strainLimit: toNumber(row.strainLimit, 6),
      riskLevel,
    };
  });

  const optimizedStations: FlowerStation[] = [];
  const optimizedPassPhysics: FlowerPassPhysics[] = [];
  let runningCumulative = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const optimized = optimizedPasses[index];
    if (!row || !optimized) continue;

    runningCumulative += optimized.optimizedAngle;
    const originalStation = row.originalStation;
    const originalPass = row.originalPass;

    const station: FlowerStation = {
      stationId: row.stationId,
      stationIndex: originalStation?.stationIndex ?? index + 1,
      bendAngle: optimized.optimizedAngle,
      cumulativeBendAngle: toNumber(runningCumulative),
      springbackAngle: originalStation?.springbackAngle ?? 0,
      compensatedAngle: originalStation?.compensatedAngle ?? optimized.optimizedAngle,
      stripWidth: originalStation?.stripWidth ?? 0,
      rollGap: originalStation?.rollGap ?? 0,
      rollDiameter: originalStation?.rollDiameter ?? 0,
      formingForce: originalStation?.formingForce ?? 0,
      description: originalStation?.description ?? `Optimized station ${index + 1}`,
      bendRadius: originalStation?.bendRadius ?? row.bendRadius,
      neutralAxisRadius: originalStation?.neutralAxisRadius ?? row.neutralAxisRadius,
      strain: optimized.predictedStrain,
      strainLimit: optimized.strainLimit,
      riskLevel: optimized.riskLevel,
      upperRollWidth: originalStation?.upperRollWidth,
      lowerRollWidth: originalStation?.lowerRollWidth,
      passLineHeight: originalStation?.passLineHeight,
    };
    optimizedStations.push(station);

    optimizedPassPhysics.push({
      stationIndex: originalPass?.stationIndex ?? station.stationIndex,
      stationId: row.stationId,
      bendAngle: optimized.optimizedAngle,
      cumulativeBendAngle: toNumber(runningCumulative),
      bendRadius: originalPass?.bendRadius ?? row.bendRadius,
      neutralAxisRadius: originalPass?.neutralAxisRadius ?? row.neutralAxisRadius,
      strain: optimized.predictedStrain,
      strainLimit: optimized.strainLimit,
      riskLevel: optimized.riskLevel,
    });
  }

  const originalPassesForMetrics: OptimizedPass[] = rows.map(row => ({
    stationId: row.stationId,
    pass: row.pass,
    originalAngle: toNumber(row.originalAngle),
    optimizedAngle: toNumber(row.originalAngle),
    deltaAngle: 0,
    baseStrain: toNumber(row.baseStrain, 6),
    predictedStrain: toNumber(row.baseStrain, 6),
    strainLimit: toNumber(row.strainLimit, 6),
    riskLevel: inferRiskLevel(row.baseStrain, row.strainLimit),
  }));

  const originalMetrics = computeMetrics(originalPassesForMetrics);
  const optimizedMetrics = computeMetrics(optimizedPasses);

  const beforeSimulation = generatePhase3Simulation({
    flowerStations: input.flowerStations,
    flowerPasses: input.flowerPasses,
    rollStations: input.rollStations,
    rollGeometryByStation: input.rollGeometryByStation,
    material: material.materialUsed,
    thickness: input.thickness,
  });

  const afterSimulation = generatePhase3Simulation({
    flowerStations: optimizedStations,
    flowerPasses: optimizedPassPhysics,
    rollStations: input.rollStations,
    rollGeometryByStation: input.rollGeometryByStation,
    material: material.materialUsed,
    thickness: input.thickness,
  });

  const peakReduction = originalMetrics.peakPredictedStrain > 0
    ? ((originalMetrics.peakPredictedStrain - optimizedMetrics.peakPredictedStrain) / originalMetrics.peakPredictedStrain) * 100
    : 0;

  const summary: OptimizationSummary = {
    totalAngleBefore: originalMetrics.totalAngle,
    totalAngleAfter: optimizedMetrics.totalAngle,
    angleConserved: Math.abs(originalMetrics.totalAngle - optimizedMetrics.totalAngle) <= 0.05,
    wasCappedByStationLimit: firstEnforced.capped || secondEnforced.capped || totalOriginalAngle > feasibleMaxTotal,
    peakStrainBefore: originalMetrics.peakPredictedStrain,
    peakStrainAfter: optimizedMetrics.peakPredictedStrain,
    peakReductionPct: toNumber(Math.max(0, peakReduction), 3),
    highRiskBefore: originalMetrics.highRiskPasses,
    highRiskAfter: optimizedMetrics.highRiskPasses,
  };

  const recommendations: string[] = [];
  if (summary.wasCappedByStationLimit) {
    recommendations.push(`Add stations or reduce target angle; material ${material.code} max is ${maxAnglePerPass}°/pass.`);
  }
  if (summary.peakReductionPct > 0) {
    recommendations.push(`Peak strain reduced by ${summary.peakReductionPct.toFixed(2)}%; prefer optimized pass schedule.`);
  } else {
    recommendations.push("Optimization had limited strain benefit; review roll radii and material thickness.");
  }
  if (afterSimulation.overallRisk === "HIGH") {
    recommendations.push("Overall risk remains HIGH after optimization; increase station count or roll radius.");
  }
  if (afterSimulation.defectSummary.distortionStations.length > 0) {
    recommendations.push("Distortion risk detected; smooth pass transitions or add intermediate calibration pass.");
  }

  return {
    model: "phase4_optimization_engine_v1",
    materialUsed: material.materialUsed,
    optimizedPasses,
    optimizedFlower: {
      stations: optimizedStations,
      passes: optimizedPassPhysics,
    },
    originalMetrics,
    optimizedMetrics,
    summary,
    recommendations,
    beforeSimulation,
    afterSimulation,
  };
}
