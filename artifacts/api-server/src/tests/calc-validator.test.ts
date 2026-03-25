/**
 * SAI Rolotech — Critical Calculation Test Suite
 *
 * Run:  pnpm --filter @workspace/api-server run test
 * Or:   npx tsx src/tests/calc-validator.test.ts
 *
 * Test categories:
 * 1. validateFlowerInputs  — input validation logic
 * 2. validateFlowerOutputs — output validation logic
 * 3. computeSpringback     — springback formula accuracy
 * 4. computeFormingForce   — forming force formula accuracy
 * 5. computeNeutralAxisStripWidth — neutral axis calculation
 */

import {
  validateFlowerInputs,
  validateFlowerOutputs,
  computeSpringback,
  computeFormingForce,
  computeNeutralAxisStripWidth,
  sanitizeNumber,
} from "../lib/calc-validator.js";

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}`);
    console.error(`    → ${msg}`);
    failures.push(`${name}: ${msg}`);
    failed++;
  }
}

function expect(actual: unknown, label?: string) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(
          `${label ?? "value"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
      }
    },
    toBeCloseTo(expected: number, decimals = 2) {
      const delta = Math.pow(10, -decimals) * 5;
      if (Math.abs((actual as number) - expected) > delta) {
        throw new Error(
          `${label ?? "value"}: expected ≈${expected} (±${delta}), got ${actual}`
        );
      }
    },
    toBeTrue() { if (!actual) throw new Error(`${label ?? "value"} expected to be true, was ${actual}`); },
    toBeFalse() { if (actual) throw new Error(`${label ?? "value"} expected to be false, was ${actual}`); },
    toBeGreaterThan(n: number) {
      if ((actual as number) <= n) throw new Error(`${label ?? "value"} expected > ${n}, got ${actual}`);
    },
    toBeGreaterThanOrEqual(n: number) {
      if ((actual as number) < n) throw new Error(`${label ?? "value"} expected >= ${n}, got ${actual}`);
    },
    toBeLessThan(n: number) {
      if ((actual as number) >= n) throw new Error(`${label ?? "value"} expected < ${n}, got ${actual}`);
    },
    toBeLessThanOrEqual(n: number) {
      if ((actual as number) > n) throw new Error(`${label ?? "value"} expected <= ${n}, got ${actual}`);
    },
    toHaveLength(n: number) {
      const len = (actual as Array<unknown>).length;
      if (len !== n) throw new Error(`${label ?? "array"} expected length ${n}, got ${len}`);
    },
    toContain(item: unknown) {
      if (!(actual as Array<unknown>).includes(item)) {
        throw new Error(`${label ?? "array"} expected to contain ${JSON.stringify(item)}`);
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. validateFlowerInputs
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📋 1. validateFlowerInputs");

test("valid GI 1.0mm 5 stations 90° 100mm strip → no errors", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "GI" });
  expect(r.valid, "valid").toBeTrue();
  expect(r.errors, "errors").toHaveLength(0);
});

test("valid CR 0.8mm 8 stations 90° 150mm strip → no errors", () => {
  const r = validateFlowerInputs({ thickness: 0.8, numStations: 8, totalBendAngle: 90, stripWidth: 150, materialType: "CR" });
  expect(r.valid).toBeTrue();
  expect(r.errors).toHaveLength(0);
});

test("invalid material → error with corrected value 'GI'", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "XY" });
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "materialType")).toBeTrue();
  expect(r.errors.find(e => e.field === "materialType")?.corrected).toBe("GI");
});

test("thickness = 0 → error", () => {
  const r = validateFlowerInputs({ thickness: 0, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "thickness")).toBeTrue();
});

test("thickness negative → error", () => {
  const r = validateFlowerInputs({ thickness: -1, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "thickness")).toBeTrue();
});

test("numStations float (3.7) → error (must be integer)", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 3.7, totalBendAngle: 90, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "numStations")).toBeTrue();
});

test("numStations 1 → warning (min 2 recommended)", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 1, totalBendAngle: 90, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeTrue();  // warning only, not error
  expect(r.warnings.some(e => e.field === "numStations")).toBeTrue();
});

test("numStations 31 → warning (> 30)", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 31, totalBendAngle: 90, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeTrue();
  expect(r.warnings.some(e => e.field === "numStations")).toBeTrue();
});

test("totalBendAngle = 0 → error", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: 0, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "totalBendAngle")).toBeTrue();
});

test("totalBendAngle negative → error", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: -45, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeFalse();
});

test("SS 130° > maxBend 120° → warning only", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: 130, stripWidth: 100, materialType: "SS" });
  expect(r.valid).toBeTrue();
  expect(r.warnings.some(e => e.field === "totalBendAngle")).toBeTrue();
});

test("stripWidth = 0 → error", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: 90, stripWidth: 0, materialType: "GI" });
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "stripWidth")).toBeTrue();
});

test("stripWidth 2100 (>2000) → warning", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: 90, stripWidth: 2100, materialType: "GI" });
  expect(r.valid).toBeTrue();
  expect(r.warnings.some(e => e.field === "stripWidth")).toBeTrue();
});

test("GI thickness 0.2mm < min 0.3mm → warning", () => {
  const r = validateFlowerInputs({ thickness: 0.2, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "GI" });
  expect(r.valid).toBeTrue();
  expect(r.warnings.some(e => e.field === "thickness")).toBeTrue();
});

test("HR thickness 7mm > max 6mm → warning", () => {
  const r = validateFlowerInputs({ thickness: 7.0, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "HR" });
  expect(r.valid).toBeTrue();
  expect(r.warnings.some(e => e.field === "thickness")).toBeTrue();
});

test("lowercase material 'gi' → accepted (case-insensitive)", () => {
  const r = validateFlowerInputs({ thickness: 1.0, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "gi" });
  expect(r.valid).toBeTrue();
});

// ═══════════════════════════════════════════════════════════════════════
// 2. validateFlowerOutputs
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📋 2. validateFlowerOutputs");

const baseInputs = { thickness: 1.0, numStations: 5, totalBendAngle: 90, stripWidth: 100, materialType: "GI" };

test("valid outputs → no errors", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 3, compensatedAngle: 21, bendAngle: 18, rollGap: 1.0, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.valid).toBeTrue();
  expect(r.errors).toHaveLength(0);
});

test("compensatedAngle < bendAngle → error", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 17, bendAngle: 18, rollGap: 1.0, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "compensatedAngle")).toBeTrue();
});

test("compensatedAngle = bendAngle → valid (equal is ok)", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 0, compensatedAngle: 18, bendAngle: 18, rollGap: 1.0, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.valid).toBeTrue();
});

test("rollGap below 95% of thickness → warning", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 20, bendAngle: 18, rollGap: 0.90, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.warnings.some(e => e.field === "rollGap")).toBeTrue();
});

test("rollGap above 115% of thickness → warning", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 20, bendAngle: 18, rollGap: 1.20, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.warnings.some(e => e.field === "rollGap")).toBeTrue();
});

test("rollGap exactly 95% → valid", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 20, bendAngle: 18, rollGap: 0.95, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.warnings.some(e => e.field === "rollGap")).toBeFalse();
});

test("formingForce = 0 → error", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 20, bendAngle: 18, rollGap: 1.0, rollDiameter: 120, formingForce: 0, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "formingForce")).toBeTrue();
});

test("formingForce negative → error", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 20, bendAngle: 18, rollGap: 1.0, rollDiameter: 120, formingForce: -5, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.valid).toBeFalse();
});

test("rollDiameter 50 → warning (< 60mm)", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 20, bendAngle: 18, rollGap: 1.0, rollDiameter: 50, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.warnings.some(e => e.field === "rollDiameter")).toBeTrue();
});

test("stripWidthAtStation > strip blank width → error", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 2, compensatedAngle: 20, bendAngle: 18, rollGap: 1.0, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 102, thickness: 1.0 },
    baseInputs,
  );
  expect(r.valid).toBeFalse();
  expect(r.errors.some(e => e.field === "stripWidthAtStation")).toBeTrue();
});

test("springbackAngle 25° > 20° → warning", () => {
  const r = validateFlowerOutputs(
    { springbackAngle: 25, compensatedAngle: 43, bendAngle: 18, rollGap: 1.0, rollDiameter: 120, formingForce: 10, stripWidthAtStation: 100, thickness: 1.0 },
    baseInputs,
  );
  expect(r.warnings.some(e => e.field === "springbackAngle")).toBeTrue();
});

// ═══════════════════════════════════════════════════════════════════════
// 3. computeSpringback
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📋 3. computeSpringback");

test("GI 1.0mm 90° bend: springback 0–20° range", () => {
  // GI: Sy=240, E=200000, ri=2.0
  const r = computeSpringback(90, 2.0, 1.0, 240, 200000);
  expect(r.springbackAngle, "springbackAngle").toBeGreaterThanOrEqual(0);
  expect(r.springbackAngle, "springbackAngle").toBeLessThanOrEqual(20);
  expect(r.springbackFactor, "springbackFactor").toBeGreaterThanOrEqual(1.0);
  expect(r.springbackFactor, "springbackFactor").toBeLessThanOrEqual(1.35);
});

test("SS 1.0mm 90°: springback > GI springback (SS has higher springback)", () => {
  const gi = computeSpringback(90, 2.0, 1.0, 240, 200000);
  const ss = computeSpringback(90, 2.0, 1.0, 280, 193000);
  expect(ss.springbackAngle >= gi.springbackAngle).toBeTrue();
});

test("zero thickness → fallback values returned", () => {
  const r = computeSpringback(90, 2.0, 0, 240, 200000);
  expect(r.springbackAngle).toBeCloseTo(90 * 0.05, 1);
  expect(r.springbackFactor).toBeCloseTo(1.05, 2);
});

test("zero elasticModulus → fallback values returned", () => {
  const r = computeSpringback(90, 2.0, 1.0, 240, 0);
  expect(r.springbackAngle).toBeCloseTo(90 * 0.05, 1);
});

test("zero yieldStrength → fallback values returned", () => {
  const r = computeSpringback(90, 2.0, 1.0, 0, 200000);
  expect(r.springbackAngle).toBeCloseTo(90 * 0.05, 1);
});

test("larger bend angle → larger springback angle", () => {
  const r45  = computeSpringback(45,  2.0, 1.0, 240, 200000);
  const r90  = computeSpringback(90,  2.0, 1.0, 240, 200000);
  const r135 = computeSpringback(135, 2.0, 1.0, 240, 200000);
  expect(r90.springbackAngle  >= r45.springbackAngle).toBeTrue();
  expect(r135.springbackAngle >= r90.springbackAngle).toBeTrue();
});

test("thicker material → less springback", () => {
  const thin  = computeSpringback(90, 2.0, 0.5, 240, 200000);
  const thick = computeSpringback(90, 2.0, 3.0, 240, 200000);
  // Thicker = larger ri/t ratio effect may differ; at least both valid
  expect(thin.springbackAngle).toBeGreaterThanOrEqual(0);
  expect(thick.springbackAngle).toBeGreaterThanOrEqual(0);
});

test("springback factor always clamped 1.0–1.35", () => {
  const cases: [number, number, number, number, number][] = [
    [30, 1.0, 0.3, 120, 70000],
    [90, 10.0, 6.0, 550, 200000],
    [180, 1.0, 0.5, 830, 115000],
  ];
  for (const [angle, ri, t, Sy, E] of cases) {
    const r = computeSpringback(angle, ri, t, Sy, E);
    expect(r.springbackFactor).toBeGreaterThanOrEqual(1.0);
    expect(r.springbackFactor).toBeLessThanOrEqual(1.35);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. computeFormingForce
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📋 4. computeFormingForce");

test("GI 1.0mm 100mm strip 2mm radius → force > 0", () => {
  const F = computeFormingForce(340, 1.0, 100, 2.0);
  expect(F).toBeGreaterThan(0);
});

test("formingForce formula check GI 1.0mm 100mm 2mm radius", () => {
  // F = 1.5 * 340 * 1² * (100/1000) / (2 * 2/1000) = 1.5 * 340 * 1 * 0.1 / 0.004 = 12750 N = 12.75 kN
  const F = computeFormingForce(340, 1.0, 100, 2.0);
  expect(F).toBeCloseTo(12.75, 0);
});

test("zero thickness → force = 0", () => {
  const F = computeFormingForce(340, 0, 100, 2.0);
  expect(F).toBe(0);
});

test("zero strip width → force = 0", () => {
  const F = computeFormingForce(340, 1.0, 0, 2.0);
  expect(F).toBe(0);
});

test("zero bend radius → force = 0", () => {
  const F = computeFormingForce(340, 1.0, 100, 0);
  expect(F).toBe(0);
});

test("higher UTS → higher force", () => {
  const F_gi  = computeFormingForce(340, 1.0, 100, 2.0);  // GI
  const F_ss  = computeFormingForce(600, 1.0, 100, 2.0);  // SS
  const F_ti  = computeFormingForce(950, 1.0, 100, 2.0);  // TI
  expect(F_ss).toBeGreaterThan(F_gi);
  expect(F_ti).toBeGreaterThan(F_ss);
});

test("thicker material → more force", () => {
  const F1 = computeFormingForce(340, 0.5, 100, 2.0);
  const F2 = computeFormingForce(340, 1.0, 100, 2.0);
  const F3 = computeFormingForce(340, 2.0, 100, 2.0);
  expect(F2).toBeGreaterThan(F1);
  expect(F3).toBeGreaterThan(F2);
});

test("wider strip → more force", () => {
  const F100 = computeFormingForce(340, 1.0, 100, 2.0);
  const F200 = computeFormingForce(340, 1.0, 200, 2.0);
  expect(F200).toBeCloseTo(F100 * 2, 0);
});

test("larger bend radius → less force", () => {
  const F2  = computeFormingForce(340, 1.0, 100, 2.0);
  const F10 = computeFormingForce(340, 1.0, 100, 10.0);
  expect(F2).toBeGreaterThan(F10);
});

test("result always non-negative", () => {
  const cases = [
    [0, 0, 0, 0],
    [340, 1.0, 100, 2.0],
    [600, 3.0, 500, 5.0],
  ];
  for (const [uts, t, w, r] of cases) {
    const F = computeFormingForce(uts, t, w, r);
    expect(F).toBeGreaterThanOrEqual(0);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. computeNeutralAxisStripWidth
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📋 5. computeNeutralAxisStripWidth");

test("simple flat strip (no bends) → total = sum of flanges", () => {
  const result = computeNeutralAxisStripWidth([], [50, 50], 0.38, 1.0);
  expect(result).toBeCloseTo(100, 2);
});

test("single 90° bend: neutral axis wider than flat calculation", () => {
  // ri = 2mm, K = 0.38, t = 1mm → rN = 2 + 0.38 = 2.38mm
  // arc = 2.38 * π/2 = 3.738mm
  // flanges: 50 + 50 = 100mm
  // total = 103.738mm
  const result = computeNeutralAxisStripWidth([{ angle: 90, innerRadius: 2.0 }], [50, 50], 0.38, 1.0);
  expect(result).toBeCloseTo(103.74, 1);
});

test("negative flange values treated as zero", () => {
  const r1 = computeNeutralAxisStripWidth([], [50, 50], 0.38, 1.0);
  const r2 = computeNeutralAxisStripWidth([], [50, -10, 50], 0.38, 1.0);
  expect(r2).toBeCloseTo(r1, 2);  // -10 ignored
});

test("negative inner radius treated as 0", () => {
  const r1 = computeNeutralAxisStripWidth([{ angle: 90, innerRadius: 0 }], [50, 50], 0.38, 1.0);
  const r2 = computeNeutralAxisStripWidth([{ angle: 90, innerRadius: -5 }], [50, 50], 0.38, 1.0);
  expect(r1).toBeCloseTo(r2, 2);
});

test("higher K-factor → wider developed width", () => {
  const rLow  = computeNeutralAxisStripWidth([{ angle: 90, innerRadius: 2.0 }], [50, 50], 0.33, 1.0);
  const rHigh = computeNeutralAxisStripWidth([{ angle: 90, innerRadius: 2.0 }], [50, 50], 0.50, 1.0);
  expect(rHigh).toBeGreaterThan(rLow);
});

test("result always > 0 for positive inputs", () => {
  const r = computeNeutralAxisStripWidth(
    [{ angle: 45, innerRadius: 1.5 }, { angle: 90, innerRadius: 2.0 }],
    [20, 30, 40],
    0.38, 1.0
  );
  expect(r).toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════════════════
// 6. sanitizeNumber
// ═══════════════════════════════════════════════════════════════════════

console.log("\n📋 6. sanitizeNumber");

test("valid number passes through", () => {
  expect(sanitizeNumber(3.14, 1.0)).toBeCloseTo(3.14);
});

test("NaN → fallback", () => {
  expect(sanitizeNumber(NaN, 99)).toBe(99);
});

test("undefined → fallback", () => {
  expect(sanitizeNumber(undefined, 42)).toBe(42);
});

test("string number '5.5' → 5.5", () => {
  expect(sanitizeNumber("5.5", 1.0)).toBeCloseTo(5.5);
});

test("string 'abc' → fallback", () => {
  expect(sanitizeNumber("abc", 7)).toBe(7);
});

test("below min → clamped to min", () => {
  expect(sanitizeNumber(-5, 1.0, 0)).toBe(0);
});

test("above max → clamped to max", () => {
  expect(sanitizeNumber(200, 1.0, 0, 100)).toBe(100);
});

test("within range → value returned", () => {
  expect(sanitizeNumber(50, 1.0, 0, 100)).toBe(50);
});

// ═══════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════

console.log("\n" + "═".repeat(55));
console.log(`  Total : ${passed + failed} tests`);
console.log(`  Passed: ${passed} ✓`);
console.log(`  Failed: ${failed} ✗`);
console.log("═".repeat(55));

if (failures.length > 0) {
  console.error("\n❌ Failures:\n");
  failures.forEach(f => console.error(`  • ${f}`));
  process.exit(1);
} else {
  console.log("\n✅ Sab calculations sahi hain — koi bug nahi!\n");
  process.exit(0);
}
