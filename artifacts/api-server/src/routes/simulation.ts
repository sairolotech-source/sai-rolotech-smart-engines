import { Router, type IRouter, type Request, type Response } from "express";
import type { ProfileGeometry } from "../lib/dxf-parser-util.js";
import { generateFlowerPattern, type FlowerPassPhysics, type FlowerStation } from "../lib/power-pattern.js";
import {
  generatePhase2RollTooling,
  type Phase2RollGeometry,
  type Phase2RollStation,
} from "../lib/phase2-roll-tooling-engine.js";
import { generatePhase3Simulation } from "../lib/phase3-simulation-engine.js";
import { optimizeFlowerDistribution } from "../lib/phase4-optimization-engine.js";

const router: IRouter = Router();

interface SimulationBody {
  geometry?: ProfileGeometry;
  flower?: {
    stations?: FlowerStation[];
    passes?: FlowerPassPhysics[];
  };
  phase2?: {
    rollStations?: Phase2RollStation[];
    rollGeometryByStation?: Phase2RollGeometry[];
  };
  numStations?: number | string;
  stationPrefix?: string;
  material?: string;
  materialType?: string;
  materialThickness?: number | string;
  toleranceMm?: number | string;
  clearanceMm?: number | string;
}

interface PreparedPipelineInput {
  requestedMaterial: string;
  thickness: number;
  flowerStations: FlowerStation[];
  flowerPasses: FlowerPassPhysics[] | undefined;
  rollStations: Phase2RollStation[];
  rollGeometryByStation: Phase2RollGeometry[] | undefined;
}

function preparePipelineInputs(body: SimulationBody): PreparedPipelineInput {
  const requestedMaterial = String(body.material || body.materialType || "GI");
  const thickness = parseFloat(String(body.materialThickness)) || 1.0;
  const stationsRequested = Math.max(1, Math.min(30, parseInt(String(body.numStations ?? 5), 10) || 5));
  const stationPrefix = String(body.stationPrefix || "S");
  const tolerance = Number.isFinite(parseFloat(String(body.toleranceMm)))
    ? parseFloat(String(body.toleranceMm))
    : undefined;
  const clearance = Number.isFinite(parseFloat(String(body.clearanceMm)))
    ? parseFloat(String(body.clearanceMm))
    : undefined;

  let flowerStations: FlowerStation[] = [];
  let flowerPasses: FlowerPassPhysics[] | undefined;
  if (body.flower && Array.isArray(body.flower.stations) && body.flower.stations.length > 0) {
    flowerStations = body.flower.stations;
    flowerPasses = Array.isArray(body.flower.passes) ? body.flower.passes : undefined;
  } else if (body.geometry && Array.isArray(body.geometry.segments) && body.geometry.segments.length > 0) {
    const flower = generateFlowerPattern(
      body.geometry,
      stationsRequested,
      stationPrefix,
      requestedMaterial,
      thickness,
    );
    flowerStations = flower.stations;
    flowerPasses = flower.passes;
  } else {
    throw new Error("Provide flower.stations or geometry for simulation pipeline");
  }

  let rollStations: Phase2RollStation[] = [];
  let rollGeometryByStation: Phase2RollGeometry[] | undefined;
  if (body.phase2 && Array.isArray(body.phase2.rollStations) && body.phase2.rollStations.length > 0) {
    rollStations = body.phase2.rollStations;
    rollGeometryByStation = Array.isArray(body.phase2.rollGeometryByStation)
      ? body.phase2.rollGeometryByStation
      : undefined;
  } else {
    const phase2 = generatePhase2RollTooling({
      flowerStations,
      flowerPasses,
      profileGeometry: body.geometry,
      material: requestedMaterial,
      thickness,
      toleranceMm: tolerance,
      clearanceMm: clearance,
    });
    rollStations = phase2.rollStations;
    rollGeometryByStation = phase2.rollGeometryByStation;
  }

  return {
    requestedMaterial,
    thickness,
    flowerStations,
    flowerPasses,
    rollStations,
    rollGeometryByStation,
  };
}

router.post("/simulate-phase3", (req: Request<unknown, unknown, SimulationBody>, res: Response) => {
  try {
    const prepared = preparePipelineInputs(req.body);
    const phase3 = generatePhase3Simulation({
      flowerStations: prepared.flowerStations,
      flowerPasses: prepared.flowerPasses,
      rollStations: prepared.rollStations,
      rollGeometryByStation: prepared.rollGeometryByStation,
      material: prepared.requestedMaterial,
      thickness: prepared.thickness,
    });

    res.json({
      success: true,
      ...phase3,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Phase-3 simulation failed";
    res.status(400).json({ error: message });
  }
});

router.post("/optimize-design", (req: Request<unknown, unknown, SimulationBody>, res: Response) => {
  try {
    const prepared = preparePipelineInputs(req.body);
    const optimized = optimizeFlowerDistribution({
      flowerStations: prepared.flowerStations,
      flowerPasses: prepared.flowerPasses,
      rollStations: prepared.rollStations,
      rollGeometryByStation: prepared.rollGeometryByStation,
      material: prepared.requestedMaterial,
      thickness: prepared.thickness,
    });

    res.json({
      success: true,
      ...optimized,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Design optimization failed";
    res.status(400).json({ error: message });
  }
});

export default router;
