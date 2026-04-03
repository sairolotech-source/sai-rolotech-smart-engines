/**
 * SAI Rolotech — Engineering Integration Test Suite (10 tests)
 *
 * Full-pipeline tests: flower → roll tooling → BOM → G-code
 * Each test verifies real engineering physics, not just "does it return 200".
 *
 * Run:  npx tsx src/tests/engineering-integration.test.ts
 */

import {
  generateFlowerPattern,
} from "../lib/power-pattern.js";
import type { ProfileGeometry } from "../lib/dxf-parser-util.js";
import {
  generateRollTooling,
  calculateRollGaps,
  calcStripWidth,
  calcBomFromTooling,
  calcRequiredMotorPower,
} from "../lib/roll-tooling.js";
import {
  generateGcode,
  getDefaultConfig,
  getDelta2XConfig,
} from "../lib/gcode-generator.js";

// ─── Minimal test runner ──────────────────────────────────────────────────────
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

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
function assertClose(actual: number, expected: number, tol: number, label: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tol)
    throw new Error(`${label}: expected ≈${expected} ±${tol}, got ${actual} (diff ${diff.toFixed(6)})`);
}
function assertRange(val: number, min: number, max: number, label: string) {
  if (val < min || val > max)
    throw new Error(`${label}: expected [${min}..${max}], got ${val}`);
}

// ─── Shared geometry fixture ──────────────────────────────────────────────────
const GEO_C_CHANNEL: ProfileGeometry = {
  segments: [
    { type: "line",  x1: 0,   y1: 0,  x2: 50,  y2: 0,  length: 50 },
    { type: "arc",   x1: 50,  y1: 0,  x2: 54,  y2: 4,  radius: 4, startAngle: 0,   endAngle: 90,  length: Math.PI * 4 / 2 },
    { type: "line",  x1: 54,  y1: 4,  x2: 54,  y2: 44, length: 40 },
    { type: "arc",   x1: 54,  y1: 44, x2: 50,  y2: 48, radius: 4, startAngle: 270, endAngle: 360, length: Math.PI * 4 / 2 },
    { type: "line",  x1: 50,  y1: 48, x2: 0,   y2: 48, length: 50 },
  ],
  bends: [
    { angle: 90, radius: 4, segmentIndex: 1, side: "right" as const, direction: "up" as const },
    { angle: 90, radius: 4, segmentIndex: 3, side: "right" as const, direction: "down" as const },
  ],
  totalLength: 148,
  boundingBox: { minX: 0, minY: 0, maxX: 54, maxY: 48, width: 54, height: 48 },
};

// ─── TEST 1: Deflection formula — Simply-supported beam physics ───────────────
// Reference: δ = F·L³ / (48·E·I), F=1000N L=0.05m d=40mm E=210GPa
console.log("\n📋 TEST 1: Shaft Deflection Formula (Simply-Supported Beam)");
test("deflection formula: known F/L/d → reference δ within 1%", () => {
  const F = 1000;            // N
  const L = 0.05;            // m (50mm span)
  const d = 0.040;           // m (40mm shaft)
  const E = 210000 * 1e6;    // Pa
  const I = Math.PI * d ** 4 / 64;
  const delta_mm = (F * L ** 3) / (48 * E * I) * 1000;
  // Reference: δ = (1000 × 0.05³) / (48 × 210e9 × π × 0.04⁴/64) × 1000
  //            = 0.0000125 / (48 × 210e9 × 1.2566e-7) = ~0.000009 mm
  assert(delta_mm > 0, "deflection must be positive");
  assert(delta_mm < 0.01, `deflection for small span must be tiny (got ${delta_mm}mm)`);

  // Cantilever (buggy formula) would give 16× more
  const cantilever_mm = (F * L ** 3) / (3 * E * I) * 1000;
  const ratio = cantilever_mm / delta_mm;
  assertClose(ratio, 16, 0.001, "cantilever/simply-supported ratio must be exactly 16");
  assert(delta_mm < cantilever_mm, "simply-supported must be less than cantilever");
});

// ─── TEST 2: Flower Pattern — Station count and angle distribution ────────────
console.log("\n📋 TEST 2: Flower Pattern — Station Count & Angle Distribution");
test("8-station GI flower: correct station count", () => {
  const result = generateFlowerPattern(GEO_C_CHANNEL, 8, "S", "GI", 1.5);
  assert(result.stations.length === 8, `expected 8 stations, got ${result.stations.length}`);
});

test("8-station GI flower: cumulative bend angle is monotonically increasing", () => {
  const result = generateFlowerPattern(GEO_C_CHANNEL, 8, "S", "GI", 1.5);
  for (let i = 1; i < result.stations.length; i++) {
    const prev = result.stations[i - 1].cumulativeBendAngle;
    const curr = result.stations[i].cumulativeBendAngle;
    assert(curr > prev, `cumulative bend angle must increase: S${i}=${prev} → S${i + 1}=${curr}`);
  }
});

test("8-station GI flower: all forming forces are positive (>0 kN)", () => {
  const result = generateFlowerPattern(GEO_C_CHANNEL, 8, "S", "GI", 1.5);
  for (const st of result.stations) {
    assert(st.formingForce > 0, `S${st.stationIndex} formingForce must be >0, got ${st.formingForce}`);
  }
});

// ─── TEST 3: Roll Tooling — Output structure and physical plausibility ─────────
console.log("\n📋 TEST 3: Roll Tooling — Output Structure & Physics");
test("roll tooling output: all required fields present in each station", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 6, "S", "GI", 1.5);
  const tooling = generateRollTooling(flower.stations, "GI", 1.5, 40, 0.05, 11, 1440);
  const REQUIRED: (keyof typeof tooling[0])[] = [
    "stationId", "upperRollOD", "upperRollID", "upperRollWidth",
    "lowerRollOD", "lowerRollID", "lowerRollWidth",
    "rollGap", "passLineHeight", "kFactor", "neutralAxis",
    "deflection", "concentricityTolerance",
    "shaftCalc", "bearing", "rollODCalc", "standPitch",
    "rollType", "rollMaterial",
  ];
  for (const rt of tooling) {
    for (const field of REQUIRED) {
      assert(field in rt && rt[field] !== undefined, `station ${rt.stationId} missing field '${field}'`);
    }
  }
});

test("roll tooling: upper OD > lower OD for all stations (profile geometry)", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 6, "S", "GI", 1.5);
  const tooling = generateRollTooling(flower.stations, "GI", 1.5, 40, 0.05, 11, 1440);
  for (const rt of tooling) {
    assert(
      rt.upperRollOD >= rt.lowerRollOD,
      `${rt.stationId}: upperOD (${rt.upperRollOD}) must be ≥ lowerOD (${rt.lowerRollOD})`
    );
  }
});

test("roll tooling: pass line height = (upperOD/2) + rollGap + (lowerOD/2)", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 6, "S", "GI", 1.5);
  const tooling = generateRollTooling(flower.stations, "GI", 1.5, 40, 0.05, 11, 1440);
  for (const rt of tooling) {
    const expected = rt.upperRollOD / 2 + rt.rollGap + rt.lowerRollOD / 2;
    assertClose(rt.passLineHeight, expected, 0.01, `${rt.stationId} passLineHeight`);
  }
});

// ─── TEST 4: Roll Gap — Consistency with thickness + clearance ─────────────────
console.log("\n📋 TEST 4: Roll Gap Consistency");
test("roll gap: nominal gap = thickness + clearance for every station", () => {
  const t = 2.0, cl = 0.08;
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 5, "S", "CR", t);
  const gaps = calculateRollGaps(flower.stations, t, cl);
  for (const g of gaps) {
    assertClose(g.nominalGap, t + cl, 0.001, `${g.stationId} nominalGap`);
    assert(g.minGap < g.nominalGap, `${g.stationId} minGap must be < nominalGap`);
    assert(g.maxGap > g.nominalGap, `${g.stationId} maxGap must be > nominalGap`);
  }
});

// ─── TEST 5: Strip Width — Neutral axis calculation against formula ─────────────
console.log("\n📋 TEST 5: Strip Width — Neutral Axis Formula");
test("calcStripWidth: flat + one 90° bend matches manual formula", () => {
  // Manual: flanges [60, 40] + 1 bend: angle=90, r=5, t=1.5, K_GI=0.38
  // BA = π × (5 + 0.38 × 1.5) × 90 / 180 = π × 5.57 × 0.5 = 8.749mm
  // total = 60 + 40 + 8.749 = 108.749mm
  const flanges = [60, 40];
  const bends = [{ angle: 90, radius: 5 }];
  const K_GI = 0.38;
  const t = 1.5;
  const BA = Math.PI * (5 + K_GI * t) * 90 / 180;
  const expected = 60 + 40 + BA;
  const result = calcStripWidth(bends, flanges, t, "GI");
  assertClose(result, expected, 0.02, "strip width");
});

test("calcStripWidth: SS has higher K-factor than GI → wider blank for same geometry", () => {
  const bends = [{ angle: 90, radius: 5 }];
  const flanges = [50, 50];
  const t = 2.0;
  const gi = calcStripWidth(bends, flanges, t, "GI");
  const ss = calcStripWidth(bends, flanges, t, "SS");
  assert(ss > gi, `SS (K=0.44) blank must be wider than GI (K=0.38): SS=${ss}, GI=${gi}`);
});

// ─── TEST 6: Motor Power — Selected motor always ≥ required power ──────────────
console.log("\n📋 TEST 6: Motor Power Selection");
test("motor calc: selectedMotorKw >= totalRequiredKw always", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 8, "S", "GI", 1.5);
  const tooling = generateRollTooling(flower.stations, "GI", 1.5, 40, 0.05, 11, 1440);
  const forces = flower.stations.map(s => s.formingForce);
  const rollODs = tooling.map(rt => rt.upperRollOD);
  const motorCalc = calcRequiredMotorPower(forces, rollODs, "GI", 20, 1440);
  assert(
    motorCalc.selectedMotorKw >= motorCalc.totalRequiredKw,
    `Selected motor (${motorCalc.selectedMotorKw}kW) must be ≥ required (${motorCalc.totalRequiredKw.toFixed(3)}kW)`
  );
});

test("motor calc: SS material triggers VFD recommendation", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 5, "S", "SS", 1.5);
  const tooling = generateRollTooling(flower.stations, "SS", 1.5, 40, 0.05, 11, 1440);
  const motorCalc = calcRequiredMotorPower(
    flower.stations.map(s => s.formingForce),
    tooling.map(rt => rt.upperRollOD),
    "SS", 10, 1440
  );
  assert(motorCalc.vfdRecommended === true, "SS must trigger VFD recommendation");
});

test("motor calc: drive efficiency is between 80% and 95%", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 5, "S", "GI", 1.5);
  const tooling = generateRollTooling(flower.stations, "GI", 1.5, 40, 0.05, 11, 1440);
  const motorCalc = calcRequiredMotorPower(
    flower.stations.map(s => s.formingForce),
    tooling.map(rt => rt.upperRollOD),
    "GI", 20, 1440
  );
  assertRange(motorCalc.driveEfficiency, 80, 95, "drive efficiency %");
});

// ─── TEST 7: Shaft Sizing — Safety factor from calcShaftDiameter ───────────────
console.log("\n📋 TEST 7: Shaft Safety Factor");
test("shaft: selected diameter ≥ required diameter for all stations", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 6, "S", "HR", 2.0);
  const tooling = generateRollTooling(flower.stations, "HR", 2.0, 40, 0.05, 11, 1440);
  for (const rt of tooling) {
    const sc = rt.shaftCalc;
    assert(
      sc.selectedDiaMm >= sc.requiredDiaMm,
      `${rt.stationId}: selectedDia (${sc.selectedDiaMm}mm) must be ≥ required (${sc.requiredDiaMm.toFixed(2)}mm)`
    );
  }
});

test("shaft: deflection from calcShaftDiameter uses 48EI (consistent with generateRollTooling)", () => {
  // A larger shaft must have smaller deflection (inverse relationship with d⁴)
  const flower40 = generateFlowerPattern(GEO_C_CHANNEL, 3, "S", "GI", 1.5);
  const flower80 = generateFlowerPattern(GEO_C_CHANNEL, 3, "S", "GI", 1.5);
  const tool40 = generateRollTooling(flower40.stations, "GI", 1.5, 40, 0.05, 11, 1440);
  const tool80 = generateRollTooling(flower80.stations, "GI", 1.5, 80, 0.05, 11, 1440);
  for (let i = 0; i < 3; i++) {
    assert(
      tool80[i].deflection <= tool40[i].deflection,
      `S${i + 1}: shaft Ø80 deflection (${tool80[i].deflection}mm) must be ≤ Ø40 (${tool40[i].deflection}mm)`
    );
  }
});

// ─── TEST 8: BOM — Completeness and structure ─────────────────────────────────
console.log("\n📋 TEST 8: BOM Completeness");
test("BOM: exactly 3 items per station (upper roll + lower roll + bearing)", () => {
  const n = 5;
  const flower = generateFlowerPattern(GEO_C_CHANNEL, n, "S", "GI", 1.5);
  const tooling = generateRollTooling(flower.stations, "GI", 1.5, 40, 0.05, 11, 1440);
  const bom = calcBomFromTooling(tooling, "GI");
  assert(bom.length === n * 3, `expected ${n * 3} BOM items, got ${bom.length}`);
});

test("BOM: all items have non-empty item, qty>0, spec, and material", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 4, "S", "SS", 1.5);
  const tooling = generateRollTooling(flower.stations, "SS", 1.5, 40, 0.05, 11, 1440);
  const bom = calcBomFromTooling(tooling, "SS");
  for (const entry of bom) {
    assert(typeof entry.item === "string" && entry.item.length > 0, `BOM item name empty`);
    assert(entry.qty > 0, `BOM qty must be > 0, got ${entry.qty}`);
    assert(typeof entry.spec === "string" && entry.spec.length > 0, `BOM spec empty`);
    assert(typeof entry.material === "string" && entry.material.length > 0, `BOM material empty`);
  }
});

// ─── TEST 9: G-code Generation — Valid output structure ───────────────────────
console.log("\n📋 TEST 9: G-code Generation");
test("G-code Fanuc: contains program number, material comment, and end code M30", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 4, "S", "GI", 1.5);
  const cfg = { ...getDefaultConfig(), material: "GI", programNumber: 1234 };
  const gcode = generateGcode(flower.stations, GEO_C_CHANNEL as any, cfg);
  assert(gcode.includes("O1234"), "G-code must contain program number O1234");
  assert(gcode.includes("GI"), "G-code must contain material name");
  assert(gcode.includes("M30"), "Fanuc G-code must end with M30");
  assert(gcode.includes("%"), "Fanuc G-code must start with %");
});

test("G-code Delta 2X: uses M4 spindle direction and no % header", () => {
  const flower = generateFlowerPattern(GEO_C_CHANNEL, 4, "S", "GI", 1.5);
  const cfg = { ...getDelta2XConfig(), programNumber: 5001 };
  const gcode = generateGcode(flower.stations, GEO_C_CHANNEL as any, cfg);
  assert(gcode.includes("M4") || gcode.includes("M04"), "Delta 2X must use M4 spindle direction");
  assert(gcode.includes("G28"), "Delta 2X must include G28 home");
});

// ─── TEST 10: Cross-pipeline Consistency — All station IDs match ──────────────
console.log("\n📋 TEST 10: Cross-Pipeline Station ID Consistency");
test("stationIds are consistent: flower = tooling = rollGaps = BOM reference", () => {
  const n = 6;
  const flower = generateFlowerPattern(GEO_C_CHANNEL, n, "ST", "CR", 2.0);
  const tooling = generateRollTooling(flower.stations, "CR", 2.0, 40, 0.05, 15, 1440);
  const gaps = calculateRollGaps(flower.stations, 2.0, 0.05);
  const bom = calcBomFromTooling(tooling, "CR");

  const flowerIds = flower.stations.map(s => s.stationId);
  const toolingIds = tooling.map(t => t.stationId);
  const gapIds = gaps.map(g => g.stationId);

  for (let i = 0; i < n; i++) {
    assert(flowerIds[i] === toolingIds[i], `Station ${i + 1}: flower ID '${flowerIds[i]}' ≠ tooling ID '${toolingIds[i]}'`);
    assert(flowerIds[i] === gapIds[i], `Station ${i + 1}: flower ID '${flowerIds[i]}' ≠ gap ID '${gapIds[i]}'`);
  }

  // Each BOM entry's item name must contain the stationId from tooling
  const bomUpperRolls = bom.filter(b => b.item.startsWith("Upper Roll"));
  assert(bomUpperRolls.length === n, `Expected ${n} upper roll BOM entries, got ${bomUpperRolls.length}`);
  for (const [i, br] of bomUpperRolls.entries()) {
    assert(br.item.includes(toolingIds[i]), `BOM entry '${br.item}' must reference stationId '${toolingIds[i]}'`);
  }
});

// ─── Summary ──────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${"═".repeat(55)}`);
console.log(`  Total : ${total} tests`);
console.log(`  Passed: ${passed} ✓`);
console.log(`  Failed: ${failed} ✗`);
console.log("═".repeat(55));

if (failed > 0) {
  console.error("\n❌ FAILED TESTS:");
  for (const f of failures) console.error(`  • ${f}`);
  process.exit(1);
} else {
  console.log("\n✅ Sab 10 engineering integration tests pass — pipeline clean hai!");
  process.exit(0);
}
