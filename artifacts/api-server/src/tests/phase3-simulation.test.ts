import type { ProfileGeometry } from "../lib/dxf-parser-util.js";
import { generateFlowerPattern } from "../lib/power-pattern.js";
import { generatePhase2RollTooling } from "../lib/phase2-roll-tooling-engine.js";
import { generatePhase3Simulation } from "../lib/phase3-simulation-engine.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    // eslint-disable-next-line no-console
    console.log(`  PASS ${name}`);
    passed += 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`  FAIL ${name}`);
    // eslint-disable-next-line no-console
    console.error(`    -> ${message}`);
    failed += 1;
  }
}

const GEO_U_PROFILE: ProfileGeometry = {
  segments: [
    { type: "line", x1: 0, y1: 40, x2: 0, y2: 10, length: 30 },
    { type: "arc", x1: 0, y1: 10, x2: 10, y2: 0, radius: 10, cx: 10, cy: 10, startAngle: 180, endAngle: 270, length: Math.PI * 10 / 2 },
    { type: "line", x1: 10, y1: 0, x2: 50, y2: 0, length: 40 },
    { type: "arc", x1: 50, y1: 0, x2: 60, y2: 10, radius: 10, cx: 50, cy: 10, startAngle: 270, endAngle: 360, length: Math.PI * 10 / 2 },
    { type: "line", x1: 60, y1: 10, x2: 60, y2: 40, length: 30 },
  ],
  bends: [
    { angle: 90, radius: 10, segmentIndex: 1, side: "left", direction: "up" },
    { angle: 90, radius: 10, segmentIndex: 3, side: "right", direction: "up" },
  ],
  totalLength: 131.416,
  boundingBox: { minX: 0, minY: 0, maxX: 60, maxY: 40, width: 60, height: 40 },
};

// eslint-disable-next-line no-console
console.log("\nPHASE-3 TEST: Simulation Engine");

test("runs pass-by-pass simulation with springback and strain accumulation", () => {
  const flower = generateFlowerPattern(GEO_U_PROFILE, 6, "P", "CRCA", 1.2);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_U_PROFILE,
    material: "CRCA",
    thickness: 1.2,
  });
  const phase3 = generatePhase3Simulation({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    rollStations: phase2.rollStations,
    rollGeometryByStation: phase2.rollGeometryByStation,
    material: "CRCA",
    thickness: 1.2,
  });

  assert(phase3.stationSimulation.length === 6, "station simulation count mismatch");
  assert(phase3.passSimulation.length === 6, "passSimulation output count mismatch");
  assert(phase3.materialModel.code === "CR", "material alias CRCA should resolve to CR");
  assert(phase3.springbackAdjusted.passes.length === 6, "springbackAdjusted output count mismatch");
  assert(phase3.strainMap.length === 6, "strainMap output count mismatch");
  assert(phase3.pressureZones.length === 6, "pressureZones output count mismatch");

  let previousCumulativeAngle = 0;
  let previousCumulativeStrain = 0;
  for (const station of phase3.stationSimulation) {
    assert(station.commandedAngle >= station.targetBendAngle, `${station.stationId}: commanded angle must include compensation`);
    assert(station.effectiveBendAngle > 0, `${station.stationId}: effective bend angle must be positive`);
    assert(station.contactPressureMPa > 0, `${station.stationId}: contact pressure must be positive`);
    assert(station.cumulativeEffectiveAngle > previousCumulativeAngle, `${station.stationId}: cumulative effective angle should increase`);
    assert(station.cumulativeStrain > previousCumulativeStrain, `${station.stationId}: cumulative strain should increase`);
    previousCumulativeAngle = station.cumulativeEffectiveAngle;
    previousCumulativeStrain = station.cumulativeStrain;
  }

  for (const springback of phase3.springbackAdjusted.passes) {
    assert(springback.finalAngle < springback.inputAngle, `${springback.stationId}: springback should reduce final angle`);
  }
});

test("produces shape evolution paths from roll geometry", () => {
  const flower = generateFlowerPattern(GEO_U_PROFILE, 5, "S", "GI", 1.0);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_U_PROFILE,
    material: "GI",
    thickness: 1.0,
  });
  const phase3 = generatePhase3Simulation({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    rollStations: phase2.rollStations,
    rollGeometryByStation: phase2.rollGeometryByStation,
    material: "GI",
    thickness: 1.0,
  });

  assert(phase3.shapeEvolution.length === 5, "shape evolution count mismatch");
  assert(phase3.finalProfile !== null, "finalProfile should be available when geometry exists");
  const lastShape = phase3.shapeEvolution[phase3.shapeEvolution.length - 1];
  if (!lastShape) throw new Error("missing final shape evolution");
  assert(lastShape.formedPath.length > GEO_U_PROFILE.segments.length, "formed path should be sampled");

  const changedPoint = lastShape.formedPath.find((point, index) => {
    const post = lastShape.afterSpringbackPath[index];
    if (!post) return false;
    return Math.abs(post.y - point.y) > 1e-4;
  });
  assert(Boolean(changedPoint), "springback-adjusted shape should differ from formed path");
});

test("flags overstrain and elevated risk in high-strain titanium case", () => {
  const flower = generateFlowerPattern(GEO_U_PROFILE, 4, "T", "TI", 2.8);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_U_PROFILE,
    material: "TI",
    thickness: 2.8,
  });

  const tunedRollStations = phase2.rollStations.map((station, index) => {
    if (index === 0) {
      return {
        ...station,
        neutralRadius: 2.2,
        strain: 0.11,
      };
    }
    return station;
  });

  const phase3 = generatePhase3Simulation({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    rollStations: tunedRollStations,
    rollGeometryByStation: phase2.rollGeometryByStation,
    material: "TI",
    thickness: 2.8,
  });

  assert(phase3.defectSummary.overstrainStations.length > 0, "expected overstrain detection");
  assert(phase3.defectSummary.edgeCrackingStations.length > 0, "expected edge cracking warning");
  assert(phase3.defects.some(defect => defect.type === "OVERSTRAIN"), "expected flattened overstrain defect output");
  assert(phase3.pressureZones.some(zone => zone.isHighPressure), "expected high-pressure zone marking");
  assert(phase3.overallRisk === "HIGH", "overall risk should escalate to HIGH");
});

// eslint-disable-next-line no-console
console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
