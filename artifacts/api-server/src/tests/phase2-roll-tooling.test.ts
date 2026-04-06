import type { ProfileGeometry } from "../lib/dxf-parser-util.js";
import { generateFlowerPattern } from "../lib/power-pattern.js";
import { generatePhase2RollTooling } from "../lib/phase2-roll-tooling-engine.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function almostEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${name}`);
    // eslint-disable-next-line no-console
    console.error(`    -> ${message}`);
    failed += 1;
  }
}

const GEO_C_CHANNEL: ProfileGeometry = {
  segments: [
    { type: "line",  x1: 0,  y1: 0,  x2: 55, y2: 0,  length: 55 },
    { type: "arc",   x1: 55, y1: 0,  x2: 60, y2: 5,  radius: 5, startAngle: 0, endAngle: 90, length: Math.PI * 5 / 2 },
    { type: "line",  x1: 60, y1: 5,  x2: 60, y2: 45, length: 40 },
    { type: "arc",   x1: 60, y1: 45, x2: 55, y2: 50, radius: 5, startAngle: 270, endAngle: 360, length: Math.PI * 5 / 2 },
    { type: "line",  x1: 55, y1: 50, x2: 0,  y2: 50, length: 55 },
  ],
  bends: [
    { angle: 90, radius: 5, segmentIndex: 1, side: "left", direction: "up" },
    { angle: 90, radius: 5, segmentIndex: 3, side: "right", direction: "down" },
  ],
  totalLength: 160,
  boundingBox: { minX: 0, minY: 0, maxX: 60, maxY: 50, width: 60, height: 50 },
};

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
console.log("\n📋 PHASE-2 TEST: Roll Tooling Engine");

test("generates station-wise roll model with realistic engineering values", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 6, "R", "CRCA", 1.2);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_C_CHANNEL,
    material: "CRCA",
    thickness: 1.2,
  });

  assert(phase2.rollStations.length === 6, "roll station count mismatch");
  assert(phase2.materialModel.code === "CR", "material alias CRCA should resolve to CR");
  assert(phase2.materialUsed === "CRCA", "materialUsed should preserve request alias");
  assert(phase2.sampleRollSet.length > 0, "sampleRollSet must be present");
  assert(phase2.rollGeometryByStation.length === 6, "roll geometry should be generated for each station");

  for (const station of phase2.rollStations) {
    assert(station.rollRadius > station.neutralRadius, `${station.stationId}: rollRadius must exceed neutralRadius`);
    assert(station.gap > 1.2, `${station.stationId}: gap should be greater than thickness`);
    assert(station.gap < 2.0, `${station.stationId}: gap appears unrealistic`);
    assert(station.shaftPosition > 0, `${station.stationId}: upper shaft position must be positive`);
    assert(station.lowerShaftPosition < 0, `${station.stationId}: lower shaft position must be negative`);
  }

  const firstGeometry = phase2.rollGeometryByStation[0];
  if (!firstGeometry) throw new Error("missing first station roll geometry");
  assert(firstGeometry.mappedSegments.length === GEO_C_CHANNEL.segments.length, "segment mapping count mismatch");
  assert(firstGeometry.upperRoll.length > GEO_C_CHANNEL.segments.length, "upper roll contour must be sampled");
  assert(firstGeometry.lowerRoll.length > GEO_C_CHANNEL.segments.length, "lower roll contour must be sampled");

  const radialDistances = firstGeometry.lowerRoll.map(point => Math.hypot(point.x, point.y));
  const radialMin = Math.min(...radialDistances);
  const radialMax = Math.max(...radialDistances);
  assert(radialMax - radialMin > 5, "contour looks circular; expected profile-based varying radius");
});

test("maintains centerline alignment station-by-station", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 5, "S", "GI", 1.5);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    material: "GI",
    thickness: 1.5,
  });

  assert(phase2.alignment.withinTolerance, "alignment should be within tolerance");
  assert(phase2.alignment.maxCenterlineError <= 0.0001, "centerline error should be near zero for symmetric shafts");

  for (const station of phase2.rollStations) {
    const centerline = (station.shaftPosition + station.lowerShaftPosition) / 2;
    assert(almostEqual(centerline, 0, 0.0001), `${station.stationId}: centerline not preserved`);
  }
});

test("supports explicit tolerance/clearance inputs for manufacturing tuning", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 4, "T", "SS304", 1.0);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    material: "SS304",
    thickness: 1.0,
    toleranceMm: 0.08,
    clearanceMm: 0.10,
  });

  assert(phase2.materialModel.code === "SS", "SS304 alias should resolve to SS");
  const first = phase2.rollStations[0];
  if (!first) throw new Error("missing first roll station");
  assert(first.gap > 1.0, "gap should include provided tolerance");
  assert(first.rollRadius > first.neutralRadius, "roll radius should include provided clearance");
  assert(["LOW", "MEDIUM", "HIGH"].includes(first.riskLevel), "risk level should be valid");
});

test("maps U-profile line+arc segments into roll contour segments", () => {
  const flower = generateFlowerPattern(GEO_U_PROFILE, 5, "U", "GI", 1.0);
  const phase2 = generatePhase2RollTooling({
    flowerStations: flower.stations,
    flowerPasses: flower.passes,
    profileGeometry: GEO_U_PROFILE,
    material: "GI",
    thickness: 1.0,
  });

  const lastGeometry = phase2.rollGeometryByStation[phase2.rollGeometryByStation.length - 1];
  if (!lastGeometry) throw new Error("missing last station geometry");
  assert(lastGeometry.mappedSegments.length === GEO_U_PROFILE.segments.length, "U profile mapping should preserve segment count");

  const mappedTypes = lastGeometry.mappedSegments.map(segment => segment.segmentType);
  const expectedTypes = GEO_U_PROFILE.segments.map(segment => segment.type);
  assert(JSON.stringify(mappedTypes) === JSON.stringify(expectedTypes), "segment type mapping mismatch");

  const arcMappings = lastGeometry.mappedSegments.filter(segment => segment.segmentType === "arc");
  assert(arcMappings.length >= 2, "expected mapped arc segments in U profile");
  assert(arcMappings.every(segment => segment.upperRoll.length > 4), "arc segments should be sampled with multiple points");

  const lineMappings = lastGeometry.mappedSegments.filter(segment => segment.segmentType === "line");
  assert(lineMappings.every(segment => segment.upperRoll.length === 2), "line segments should remain two-point contours");
});

// eslint-disable-next-line no-console
console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
