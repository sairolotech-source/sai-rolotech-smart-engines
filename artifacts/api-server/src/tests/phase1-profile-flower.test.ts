import { normalizeProfileInput } from "../lib/profile-engine.js";
import { generateFlowerPattern } from "../lib/power-pattern.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
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

function almostEqual(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

// eslint-disable-next-line no-console
console.log("\n📋 PHASE-1 TEST: Profile -> Flower Progressive Output");

test("profile schema accepts line+arc segments and produces normalized JSON", () => {
  const result = normalizeProfileInput({
    thickness: 1.2,
    segments: [
      {
        type: "line",
        start: { x: 0, y: 0 },
        end: { x: 60, y: 0 },
      },
      {
        type: "arc",
        start: { x: 60, y: 0 },
        end: { x: 70, y: 10 },
        center: { x: 60, y: 10 },
      },
      {
        type: "line",
        start: { x: 70, y: 10 },
        end: { x: 70, y: 50 },
      },
      {
        type: "line",
        start: { x: 70, y: 50 },
        end: { x: 0, y: 50 },
      },
    ],
  });

  assert(result.profile.schemaVersion === "phase1.profile.v1", "schema version mismatch");
  assert(result.profile.segments.length === 4, "normalized segment count mismatch");
  assert(result.profile.segments.some(segment => segment.type === "arc"), "arc segment missing in normalized profile");
  assert(result.profile.bendPoints.length > 0, "bend detection returned no bend points");
  assert(result.profile.totalLength > 0, "total length must be positive");
});

test("flower output uses progressive pass distribution (not blind equal split)", () => {
  const profile = normalizeProfileInput({
    thickness: 1.5,
    segments: [
      {
        type: "line",
        start: { x: 0, y: 0 },
        end: { x: 50, y: 0 },
      },
      {
        type: "arc",
        start: { x: 50, y: 0 },
        end: { x: 60, y: 10 },
        center: { x: 50, y: 10 },
      },
      {
        type: "line",
        start: { x: 60, y: 10 },
        end: { x: 60, y: 55 },
      },
      {
        type: "arc",
        start: { x: 60, y: 55 },
        end: { x: 50, y: 65 },
        center: { x: 50, y: 55 },
      },
      {
        type: "line",
        start: { x: 50, y: 65 },
        end: { x: 0, y: 65 },
      },
    ],
  });

  const geometryForFlower = {
    ...profile.profile.geometry,
    bends: [
      { angle: 15, radius: 4, segmentIndex: 0, side: "left" as const, direction: "up" as const },
      { angle: 20, radius: 4, segmentIndex: 1, side: "left" as const, direction: "up" as const },
      { angle: 25, radius: 4, segmentIndex: 2, side: "right" as const, direction: "down" as const },
    ],
  };

  const flower = generateFlowerPattern(geometryForFlower, 5, "P", "GI", 1.5);
  const stationAngles = flower.stations.map(station => station.bendAngle);

  assert(flower.stations.length === 5, "station count mismatch");
  assert(flower._distributionMode === "progressive", "distribution mode should be progressive");
  assert(flower._angleCapped !== true, "test case should avoid station angle clipping");
  assert(stationAngles.every(angle => angle > 0), "all station bend angles must be positive");
  assert(stationAngles.every(angle => angle <= 15), "GI bend angle per station must stay within 15°");

  const uniqueAngles = new Set(stationAngles.map(angle => angle.toFixed(2)));
  assert(uniqueAngles.size > 2, "angles appear equally distributed; expected progressive pattern");

  const mid = stationAngles[2] ?? 0;
  const first = stationAngles[0] ?? 0;
  const last = stationAngles[4] ?? 0;
  assert(mid > first, "middle pass angle must be greater than entry pass");
  assert(mid > last, "middle pass angle must be greater than final pass");

  const sumAngles = stationAngles.reduce((sum, angle) => sum + angle, 0);
  assert(almostEqual(sumAngles, flower.totalBendAngle, 0.02), "sum of station angles must match reported total bend angle");

  for (let index = 1; index < flower.stations.length; index += 1) {
    const previous = flower.stations[index - 1]?.cumulativeBendAngle ?? 0;
    const current = flower.stations[index]?.cumulativeBendAngle ?? 0;
    assert(current > previous, "cumulative bend angle must increase station-by-station");
  }

  assert((flower.passes?.length ?? 0) === 5, "passes[] must exist for Phase-1.5 output");
  assert((flower.strainPerPass?.length ?? 0) === 5, "strainPerPass[] must exist for Phase-1.5 output");
  assert((flower.riskPerPass?.length ?? 0) === 5, "riskPerPass[] must exist for Phase-1.6 output");
  assert(["LOW", "MEDIUM", "HIGH"].includes(flower.riskLevel ?? ""), "riskLevel must be LOW | MEDIUM | HIGH");
  assert(["LOW", "MEDIUM", "HIGH"].includes(flower.overallRisk ?? ""), "overallRisk must be LOW | MEDIUM | HIGH");
  assert(flower.materialUsed === "GI", "materialUsed should echo resolved input material");

  for (let index = 0; index < (flower.passes?.length ?? 0); index += 1) {
    const pass = flower.passes?.[index];
    if (!pass) continue;

    const expectedNeutral = pass.bendRadius + 1.5 / 2;
    const expectedStrain = 1.5 / (2 * pass.bendRadius);
    assert(almostEqual(pass.neutralAxisRadius, expectedNeutral, 0.001), "neutral axis formula mismatch");
    assert(almostEqual(pass.strain, expectedStrain, 0.0005), "strain formula mismatch");
    assert(almostEqual(pass.strain, flower.strainPerPass?.[index] ?? 0, 0.000001), "strainPerPass should mirror pass strain");
    assert(pass.riskLevel === (flower.riskPerPass?.[index] ?? "LOW"), "riskPerPass should mirror pass risk");
  }
});

test("strain risk model flags high-risk material cases", () => {
  const profile = normalizeProfileInput({
    thickness: 1.5,
    segments: [
      { type: "line", start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
      { type: "line", start: { x: 40, y: 0 }, end: { x: 40, y: 40 } },
      { type: "line", start: { x: 40, y: 40 }, end: { x: 0, y: 40 } },
    ],
  });

  const geometryForFlower = {
    ...profile.profile.geometry,
    bends: [
      { angle: 20, radius: 3, segmentIndex: 0, side: "left" as const, direction: "up" as const },
      { angle: 25, radius: 3, segmentIndex: 1, side: "right" as const, direction: "down" as const },
    ],
  };

  const tiFlower = generateFlowerPattern(geometryForFlower, 4, "T", "TI", 1.5);
  assert(tiFlower.riskLevel === "HIGH", "TI case should be classified as HIGH risk");
  assert((tiFlower.passes ?? []).some(pass => pass.riskLevel === "HIGH"), "at least one pass should be HIGH risk");
});

test("material aliases resolve into material-aware limits", () => {
  const profile = normalizeProfileInput({
    thickness: 1.0,
    segments: [
      { type: "line", start: { x: 0, y: 0 }, end: { x: 40, y: 0 } },
      { type: "line", start: { x: 40, y: 0 }, end: { x: 40, y: 20 } },
      { type: "line", start: { x: 40, y: 20 }, end: { x: 0, y: 20 } },
    ],
  });

  const bends = [
    { angle: 10, radius: 3, segmentIndex: 0, side: "left" as const, direction: "up" as const },
    { angle: 12, radius: 3, segmentIndex: 1, side: "right" as const, direction: "down" as const },
  ];

  const crcaFlower = generateFlowerPattern({ ...profile.profile.geometry, bends }, 4, "C", "CRCA", 1.0);
  assert(crcaFlower.materialType === "CR", "CRCA alias should map to canonical CR");
  assert(crcaFlower.materialUsed === "CRCA", "materialUsed should preserve requested alias");
  assert((crcaFlower.passes ?? []).every(pass => almostEqual(pass.strainLimit, 0.18, 0.000001)), "CRCA should use CR max strain limit 0.18");

  const ssFlower = generateFlowerPattern({ ...profile.profile.geometry, bends }, 4, "S", "SS304", 1.0);
  assert(ssFlower.materialType === "SS", "SS304 alias should map to canonical SS");
  assert(ssFlower.materialUsed === "SS304", "materialUsed should preserve requested alias");
  assert((ssFlower.passes ?? []).every(pass => almostEqual(pass.strainLimit, 0.12, 0.000001)), "SS304 should use SS max strain limit 0.12");
});

// eslint-disable-next-line no-console
console.log(`\nTotal: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
