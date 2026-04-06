import { computeSpringback } from "./calc-validator.js";
import type { MaterialModel } from "./material-model.js";
import { resolveMaterialInput } from "./material-model.js";
import type { FlowerPassPhysics, FlowerStation } from "./power-pattern.js";
import type {
  Phase2RollGeometry,
  Phase2RollStation,
  RollGeometryPoint,
  RollRiskLevel,
} from "./phase2-roll-tooling-engine.js";

export type SimulationDefectType = "WRINKLING" | "EDGE_CRACKING" | "OVERSTRAIN" | "DISTORTION";
export type SimulationSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface SimulationDefect {
  type: SimulationDefectType;
  severity: SimulationSeverity;
  reason: string;
}

export interface SimulationDefectRecord extends SimulationDefect {
  stationId: string;
  pass: number;
}

export interface StationShapeEvolution {
  stationId: string;
  pass: number;
  formedPath: RollGeometryPoint[];
  afterSpringbackPath: RollGeometryPoint[];
}

export interface StationSimulationStep {
  stationId: string;
  pass: number;
  phaseZone: "ENTRY" | "FORMING" | "SIZING";
  targetBendAngle: number;
  commandedAngle: number;
  springbackFactor: number;
  springbackAngle: number;
  residualSpringback: number;
  effectiveBendAngle: number;
  cumulativeEffectiveAngle: number;
  passStrain: number;
  cumulativeStrain: number;
  contactPressureMPa: number;
  riskLevel: RollRiskLevel;
  defects: SimulationDefect[];
}

export interface SimulationDefectSummary {
  wrinklingStations: string[];
  edgeCrackingStations: string[];
  overstrainStations: string[];
  distortionStations: string[];
}

export interface Phase3ValidationReport {
  isSimulationValid: boolean;
  warnings: string[];
}

export interface Phase3MaterialReport extends MaterialModel {
  materialUsed: string;
}

export interface SpringbackAdjustedPass {
  stationId: string;
  pass: number;
  inputAngle: number;
  springbackFactor: number;
  finalAngle: number;
}

export interface StrainMapPoint {
  stationId: string;
  pass: number;
  strainPerPass: number;
  cumulativeStrain: number;
  isPeak: boolean;
}

export interface PressureZonePoint {
  stationId: string;
  pass: number;
  pressureMPa: number;
  zone: "LOW" | "MEDIUM" | "HIGH";
  isHighPressure: boolean;
}

export interface FinalProfileSummary {
  stationId: string;
  pass: number;
  points: RollGeometryPoint[];
}

export interface Phase3SimulationInput {
  flowerStations: FlowerStation[];
  rollStations: Phase2RollStation[];
  flowerPasses?: FlowerPassPhysics[];
  rollGeometryByStation?: Phase2RollGeometry[];
  material?: string;
  thickness: number;
}

export interface Phase3SimulationResult {
  model: "phase3_simulation_engine_v1";
  materialUsed: string;
  materialModel: Phase3MaterialReport;
  stationSimulation: StationSimulationStep[];
  shapeEvolution: StationShapeEvolution[];
  defectSummary: SimulationDefectSummary;
  overallRisk: RollRiskLevel;
  validation: Phase3ValidationReport;
  passSimulation: StationSimulationStep[];
  finalProfile: FinalProfileSummary | null;
  springbackAdjusted: { passes: SpringbackAdjustedPass[] };
  strainMap: StrainMapPoint[];
  pressureZones: PressureZonePoint[];
  defects: SimulationDefectRecord[];
}

interface MutableStrainPoint {
  stationId: string;
  pass: number;
  strainPerPass: number;
  cumulativeStrain: number;
}

function toNumber(value: number, precision = 4): number {
  return parseFloat(value.toFixed(precision));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function findPass(stationId: string, passes?: FlowerPassPhysics[]): FlowerPassPhysics | undefined {
  if (!passes || passes.length === 0) return undefined;
  return passes.find(pass => pass.stationId === stationId);
}

function findStation(stationId: string, stations: FlowerStation[]): FlowerStation | undefined {
  return stations.find(station => station.stationId === stationId);
}

function findGeometry(stationId: string, geometries?: Phase2RollGeometry[]): Phase2RollGeometry | undefined {
  if (!geometries || geometries.length === 0) return undefined;
  return geometries.find(geometry => geometry.stationId === stationId);
}

function inferBendAngle(station: FlowerStation | undefined, pass: FlowerPassPhysics | undefined): number {
  if (pass && pass.bendAngle > 0) return pass.bendAngle;
  if (station && station.bendAngle > 0) return station.bendAngle;
  return 0;
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

function inferPassStrain(
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

function inferRiskLevel(score: number, defects: SimulationDefect[]): RollRiskLevel {
  if (defects.some(defect => defect.severity === "HIGH")) return "HIGH";
  if (score < 0.45) return "LOW";
  if (score < 0.78) return "MEDIUM";
  return "HIGH";
}

function pushUniqueStation(target: string[], stationId: string): void {
  if (!target.includes(stationId)) target.push(stationId);
}

function detectPressureZone(pressureMPa: number, yieldStrengthMPa: number): PressureZonePoint["zone"] {
  if (pressureMPa < yieldStrengthMPa * 0.25) return "LOW";
  if (pressureMPa < yieldStrengthMPa * 0.45) return "MEDIUM";
  return "HIGH";
}

function mapShapeEvolution(
  geometry: Phase2RollGeometry,
  progression: number,
  springbackRatio: number,
): StationShapeEvolution {
  const formedPath: RollGeometryPoint[] = [];
  const afterSpringbackPath: RollGeometryPoint[] = [];
  const formedScale = clamp(progression, 0.08, 1.2);
  const springbackScale = clamp(1 - springbackRatio, 0.72, 1);

  for (const point of geometry.stripContactPath) {
    formedPath.push({
      x: toNumber(point.x, 4),
      y: toNumber(point.y * formedScale, 4),
    });
    afterSpringbackPath.push({
      x: toNumber(point.x, 4),
      y: toNumber(point.y * formedScale * springbackScale, 4),
    });
  }

  return {
    stationId: geometry.stationId,
    pass: geometry.pass,
    formedPath,
    afterSpringbackPath,
  };
}

export function generatePhase3Simulation(input: Phase3SimulationInput): Phase3SimulationResult {
  const rollStations = Array.isArray(input.rollStations) ? input.rollStations : [];
  if (rollStations.length === 0) {
    throw new Error("rollStations[] is required for Phase-3 simulation");
  }

  const thickness = input.thickness > 0 ? input.thickness : 1;
  const material = resolveMaterialInput(input.material);
  const totalTargetAngle = rollStations.reduce((sum, station) => {
    const flowerStation = findStation(station.stationId, input.flowerStations);
    const pass = findPass(station.stationId, input.flowerPasses);
    return sum + inferBendAngle(flowerStation, pass);
  }, 0);

  const warnings: string[] = [];
  const stationSimulation: StationSimulationStep[] = [];
  const shapeEvolution: StationShapeEvolution[] = [];
  const springbackPasses: SpringbackAdjustedPass[] = [];
  const strainMapRaw: MutableStrainPoint[] = [];
  const pressureZones: PressureZonePoint[] = [];
  const defects: SimulationDefectRecord[] = [];

  const defectSummary: SimulationDefectSummary = {
    wrinklingStations: [],
    edgeCrackingStations: [],
    overstrainStations: [],
    distortionStations: [],
  };

  let cumulativeStrain = 0;
  let cumulativeEffectiveAngle = 0;
  let previousPassStrain = 0;

  for (const rollStation of rollStations) {
    const flowerStation = findStation(rollStation.stationId, input.flowerStations);
    const pass = findPass(rollStation.stationId, input.flowerPasses);
    const targetAngle = inferBendAngle(flowerStation, pass);
    const bendRadius = inferBendRadius(thickness, rollStation, flowerStation, pass);
    const passStrain = inferPassStrain(thickness, rollStation, flowerStation, pass, bendRadius);

    const classicSpringback = computeSpringback(
      targetAngle,
      bendRadius,
      thickness,
      material.yieldStrengthMPa,
      material.elasticModulusMPa,
    );
    const ratioYe = material.yieldStrengthMPa / Math.max(1, material.elasticModulusMPa);
    const radiusFactor = clamp(bendRadius / Math.max(0.25, thickness), 1, 4);
    const simplifiedSpringback = clamp(ratioYe * radiusFactor * 2.2, 0.005, 0.22);
    const springbackFactor = clamp(
      simplifiedSpringback + (classicSpringback.springbackFactor - 1) * 0.55,
      0.005,
      0.28,
    );
    const effectiveBendAngle = Math.max(0, targetAngle * (1 - springbackFactor));
    const commandedAngle = targetAngle * (1 + springbackFactor * 0.55);
    const residualSpringback = Math.max(0, targetAngle - effectiveBendAngle);

    cumulativeStrain += passStrain;
    cumulativeEffectiveAngle += effectiveBendAngle;

    const thicknessFactor = 1 + thickness / 2;
    const contactPressureMPa = passStrain * material.elasticModulusMPa * (0.02 + targetAngle / 5000) * thicknessFactor;
    const pressureZone = detectPressureZone(contactPressureMPa, material.yieldStrengthMPa);
    const springbackRatio = residualSpringback / Math.max(1e-6, targetAngle || 1);

    const stationDefects: SimulationDefect[] = [];
    const strainRatio = passStrain / Math.max(1e-6, material.maxStrain);
    const cumulativeRatio = cumulativeStrain / Math.max(1e-6, material.maxStrain);

    if (strainRatio >= 1.0 || cumulativeRatio >= 1.8) {
      const defect: SimulationDefect = {
        type: "OVERSTRAIN",
        severity: strainRatio >= 1.1 ? "HIGH" : "MEDIUM",
        reason: `strain ratio ${toNumber(strainRatio, 3)} exceeds material envelope`,
      };
      stationDefects.push(defect);
      defects.push({ stationId: rollStation.stationId, pass: rollStation.pass, ...defect });
      pushUniqueStation(defectSummary.overstrainStations, rollStation.stationId);
    }

    const materialSensitive = material.code === "SS" || material.code === "TI" || material.code === "HSLA";
    if ((materialSensitive && strainRatio > 0.92) || (bendRadius < thickness * 1.8 && strainRatio > 0.8)) {
      const defect: SimulationDefect = {
        type: "EDGE_CRACKING",
        severity: strainRatio > 1 ? "HIGH" : "MEDIUM",
        reason: `small bend radius ${toNumber(bendRadius, 3)}mm with elevated strain`,
      };
      stationDefects.push(defect);
      defects.push({ stationId: rollStation.stationId, pass: rollStation.pass, ...defect });
      pushUniqueStation(defectSummary.edgeCrackingStations, rollStation.stationId);
    }

    if (targetAngle >= 8 && pressureZone === "LOW" && springbackFactor > 0.06) {
      const defect: SimulationDefect = {
        type: "WRINKLING",
        severity: "MEDIUM",
        reason: `low pressure zone with higher springback factor ${toNumber(springbackFactor, 4)}`,
      };
      stationDefects.push(defect);
      defects.push({ stationId: rollStation.stationId, pass: rollStation.pass, ...defect });
      pushUniqueStation(defectSummary.wrinklingStations, rollStation.stationId);
    }

    if (previousPassStrain > 0) {
      const unevenRatio = Math.abs(passStrain - previousPassStrain) / previousPassStrain;
      if (unevenRatio > 0.35) {
        const defect: SimulationDefect = {
          type: "DISTORTION",
          severity: unevenRatio > 0.6 ? "HIGH" : "MEDIUM",
          reason: `uneven strain jump ${toNumber(unevenRatio, 3)} between adjacent passes`,
        };
        stationDefects.push(defect);
        defects.push({ stationId: rollStation.stationId, pass: rollStation.pass, ...defect });
        pushUniqueStation(defectSummary.distortionStations, rollStation.stationId);
      }
    }
    previousPassStrain = passStrain;

    const riskScore = clamp(
      strainRatio * 0.5 + cumulativeRatio * 0.25 + clamp(springbackFactor * 3, 0, 1.2) * 0.25,
      0,
      1.5,
    );
    const riskLevel = inferRiskLevel(riskScore, stationDefects);

    strainMapRaw.push({
      stationId: rollStation.stationId,
      pass: rollStation.pass,
      strainPerPass: toNumber(passStrain, 6),
      cumulativeStrain: toNumber(cumulativeStrain, 6),
    });
    pressureZones.push({
      stationId: rollStation.stationId,
      pass: rollStation.pass,
      pressureMPa: toNumber(contactPressureMPa),
      zone: pressureZone,
      isHighPressure: pressureZone === "HIGH",
    });
    springbackPasses.push({
      stationId: rollStation.stationId,
      pass: rollStation.pass,
      inputAngle: toNumber(targetAngle),
      springbackFactor: toNumber(springbackFactor, 6),
      finalAngle: toNumber(effectiveBendAngle),
    });

    const geometry = findGeometry(rollStation.stationId, input.rollGeometryByStation);
    const progression = totalTargetAngle > 0 ? cumulativeEffectiveAngle / totalTargetAngle : 1;
    if (geometry) {
      shapeEvolution.push(mapShapeEvolution(geometry, progression, springbackFactor));
    }

    stationSimulation.push({
      stationId: rollStation.stationId,
      pass: rollStation.pass,
      phaseZone: rollStation.phaseZone,
      targetBendAngle: toNumber(targetAngle),
      commandedAngle: toNumber(commandedAngle),
      springbackFactor: toNumber(springbackFactor, 6),
      springbackAngle: toNumber(classicSpringback.springbackAngle),
      residualSpringback: toNumber(residualSpringback),
      effectiveBendAngle: toNumber(effectiveBendAngle),
      cumulativeEffectiveAngle: toNumber(cumulativeEffectiveAngle),
      passStrain: toNumber(passStrain, 6),
      cumulativeStrain: toNumber(cumulativeStrain, 6),
      contactPressureMPa: toNumber(contactPressureMPa),
      riskLevel,
      defects: stationDefects,
    });
  }

  const peakStrain = strainMapRaw.reduce((max, point) => Math.max(max, point.strainPerPass), 0);
  const strainMap: StrainMapPoint[] = strainMapRaw.map(point => ({
    ...point,
    isPeak: Math.abs(point.strainPerPass - peakStrain) < 1e-9,
  }));

  const overallRisk: RollRiskLevel = stationSimulation.some(station => station.riskLevel === "HIGH")
    ? "HIGH"
    : stationSimulation.some(station => station.riskLevel === "MEDIUM")
    ? "MEDIUM"
    : "LOW";

  if (!input.rollGeometryByStation || input.rollGeometryByStation.length === 0) {
    warnings.push("Roll geometry missing - shape evolution reduced to scalar strain simulation");
  } else if (shapeEvolution.length !== stationSimulation.length) {
    warnings.push("Some stations are missing rollGeometry entries - shape evolution is partial");
  }
  if (!pressureZones.some(zone => zone.isHighPressure)) {
    warnings.push("No high-pressure zones detected; verify pressure scaling for this profile/material");
  }
  if (!defects.some(defect => defect.severity !== "LOW")) {
    warnings.push("No major defects detected in this run; validate with heavier profile/material combinations");
  }

  const finalShape = shapeEvolution[shapeEvolution.length - 1];
  const finalProfile: FinalProfileSummary | null = finalShape
    ? {
      stationId: finalShape.stationId,
      pass: finalShape.pass,
      points: finalShape.afterSpringbackPath,
    }
    : null;

  const materialModel: Phase3MaterialReport = {
    ...material,
    materialUsed: material.materialUsed,
  };

  return {
    model: "phase3_simulation_engine_v1",
    materialUsed: material.materialUsed,
    materialModel,
    stationSimulation,
    shapeEvolution,
    defectSummary,
    overallRisk,
    validation: {
      isSimulationValid: warnings.length === 0,
      warnings,
    },
    passSimulation: stationSimulation,
    finalProfile,
    springbackAdjusted: { passes: springbackPasses },
    strainMap,
    pressureZones,
    defects,
  };
}
