import type { ProfileGeometry } from "../lib/dxf-parser-util.js";
import { generateFlowerPattern } from "../lib/power-pattern.js";
import { generatePhase2RollTooling } from "../lib/phase2-roll-tooling-engine.js";
import { optimizeFlowerDistribution } from "../lib/phase4-optimization-engine.js";

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

const GEO_L_PROFILE: ProfileGeometry = {
  segments: [
    { type: "line", x1: 0, y1: 0, x2: 60, y2: 0, length: 60 },
    { type: "arc", x1: 60, y1: 0, x2: 70, y2: 10, radius: 10, cx: 60, cy: 10, startAngle: 270, endAngle: 360, length: Math.PI * 10 / 2 },
    { type: "line", x1: 70, y1: 10, x2: 70, y2: 70, length: 60 },
  ],
  bends: [
    { angle: 90, radius: 10, segmentIndex: 1, side: "left", direction: "up" },
  ],
  totalLength: 135.708,
  boundingBox: { minX: 0, minY: 0, maxX: 70, maxY: 70, width: 70, height: 70 },
};

// eslint-disable-next-line no-console
console.log("\nPHASE-4 TEST: Auto Optimization Engine");

test("conserves total bend angle and respects material pass limits", () => {
  const flower = generateFlowerPattern(GEO_U_PROFILE, 6, "S", "SS304", 1.2);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_U_PROFILE,
    material: "SS304",
    thickness: 1.2,
  });

  const result = optimizeFlowerDistribution({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    rollStations: phase2.rollStations,
    rollGeometryByStation: phase2.rollGeometryByStation,
    material: "SS304",
    thickness: 1.2,
  });

  assert(result.optimizedPasses.length === 6, "optimized pass count mismatch");
  assert(result.summary.angleConserved, "total bend angle should be conserved");
  assert(result.optimizedPasses.every(pass => pass.optimizedAngle <= 10.001), "SS pass angle limit exceeded");
});

test("reduces peak strain in high-risk station distribution", () => {
  const flower = generateFlowerPattern(GEO_L_PROFILE, 8, "R", "CRCA", 1.6);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_L_PROFILE,
    material: "CRCA",
    thickness: 1.6,
  });

  const customPasses = (flower.passes ?? []).map((pass, index) => {
    if (index === 4) {
      return {
        ...pass,
        strain: 0.16,
        strainLimit: 0.18,
        riskLevel: "HIGH" as const,
      };
    }
    return {
      ...pass,
      strain: 0.06,
      strainLimit: 0.18,
      riskLevel: "LOW" as const,
    };
  });

  const tunedRollStations = phase2.rollStations.map((station, index) => {
    if (index === 4) {
      return {
        ...station,
        strain: 0.16,
        neutralRadius: 2.8,
        riskLevel: "HIGH" as const,
      };
    }
    return station;
  });

  const result = optimizeFlowerDistribution({
    flowerStations: flower.stations,
    flowerPasses: customPasses,
    rollStations: tunedRollStations,
    rollGeometryByStation: phase2.rollGeometryByStation,
    material: "CRCA",
    thickness: 1.6,
  });

  assert(result.optimizedMetrics.peakPredictedStrain < result.originalMetrics.peakPredictedStrain, "peak strain should reduce");
  assert(result.summary.peakReductionPct > 0, "peak reduction should be positive");
  assert(result.summary.highRiskAfter <= result.summary.highRiskBefore, "high-risk pass count should not increase");
});

test("returns before/after simulation snapshots with required outputs", () => {
  const flower = generateFlowerPattern(GEO_U_PROFILE, 5, "P", "CRCA", 1.1);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_U_PROFILE,
    material: "CRCA",
    thickness: 1.1,
  });

  const result = optimizeFlowerDistribution({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    rollStations: phase2.rollStations,
    rollGeometryByStation: phase2.rollGeometryByStation,
    material: "CRCA",
    thickness: 1.1,
  });

  assert(result.beforeSimulation.passSimulation.length === 5, "before simulation pass output missing");
  assert(result.afterSimulation.passSimulation.length === 5, "after simulation pass output missing");
  assert(result.afterSimulation.strainMap.length === 5, "after simulation strain map missing");
  assert(result.afterSimulation.pressureZones.length === 5, "after simulation pressure map missing");
});

// eslint-disable-next-line no-console
console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
