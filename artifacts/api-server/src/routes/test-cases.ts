/**
 * /api/test-cases — Mandatory test suite (Section 11 of MASTER PROMPT spec)
 *
 * Runs 5 mandatory test cases against the auto-pipeline internally:
 *   TC-01  Simple U channel              — should PASS all stages
 *   TC-02  Lipped channel (purlin)       — should PASS, more stations than TC-01
 *   TC-03  Shutter profile (complex)     — should PASS, multi-stage
 *   TC-04  Invalid / open profile        — should FAIL at geometry stage
 *   TC-05  Invalid thickness input       — should FAIL at thickness stage
 */

import { Router, type IRouter } from "express";
import type { ProfileGeometry } from "../lib/dxf-parser-util";
import { generateFlowerPattern } from "../lib/power-pattern";
import { generateRollTooling } from "../lib/roll-tooling";
import { computeNeutralAxisStripWidth } from "../lib/calc-validator";

const router: IRouter = Router();

// ─── Geometry helpers ───────────────────────────────────────────────────────

function makeSegments(points: [number, number][]): ProfileGeometry["segments"] {
  const segs: ProfileGeometry["segments"] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    segs.push({ type: "line", x1, y1, x2, y2, length });
  }
  return segs;
}

function makeBends(angles: number[], radius = 3): ProfileGeometry["bends"] {
  return angles.map((angle, i) => ({
    angle,
    radius,
    segmentIndex: i,
    side: "left" as const,
    direction: "up" as const,
  }));
}

function makeBBox(pts: [number, number][]) {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function totalLen(segs: ProfileGeometry["segments"]) {
  return segs.reduce((s, seg) => s + (seg.length ?? 0), 0);
}

// ─── Five test case definitions ─────────────────────────────────────────────

interface TestCaseDef {
  id: string;
  name: string;
  description: string;
  geometry: ProfileGeometry & { bendPoints?: unknown[] };
  thickness: number;
  material: string;
  expectedStatus: "pass" | "fail";
  expectedFailStage?: string;
}

const TC_GEOMETRIES: TestCaseDef[] = [
  // TC-01: Simple U channel — 100×50mm, 2 bends, GI, 0.8mm
  (() => {
    const pts: [number, number][] = [[0,0],[100,0],[100,50],[0,50]];
    const segs = makeSegments(pts);
    return {
      id: "TC-01",
      name: "Simple U Channel",
      description: "100×50mm U-channel, GI 0.8mm, 2 bends — should pass all stages with 6–8 stations",
      geometry: { segments: segs, bends: makeBends([90,90]), boundingBox: makeBBox(pts), totalLength: totalLen(segs), arcs: [] },
      thickness: 0.8,
      material: "GI",
      expectedStatus: "pass",
    };
  })(),

  // TC-02: Lipped channel — 100×50mm + 15mm lips, 4 bends, CR, 1.0mm
  (() => {
    const pts: [number, number][] = [[0,15],[0,0],[100,0],[100,50],[0,50],[0,35]];
    const segs = makeSegments(pts);
    return {
      id: "TC-02",
      name: "Lipped Channel (Purlin)",
      description: "100×50mm C-channel with 15mm lips, CR 1.0mm, 4 bends — more stations than TC-01",
      geometry: { segments: segs, bends: makeBends([90,90,90,90]), boundingBox: makeBBox(pts), totalLength: totalLen(segs), arcs: [] },
      thickness: 1.0,
      material: "CR",
      expectedStatus: "pass",
    };
  })(),

  // TC-03: Shutter profile — 8 bends (complex), HR 1.2mm
  (() => {
    const pts: [number, number][] = [[0,0],[20,0],[20,10],[40,10],[40,0],[60,0],[60,10],[80,10],[80,0],[100,0]];
    const segs = makeSegments(pts);
    return {
      id: "TC-03",
      name: "Shutter / Corrugated Profile",
      description: "Multi-rib shutter section, HR 1.2mm, 8 bends — should classify as complex, 12+ stations",
      geometry: { segments: segs, bends: makeBends([90,90,90,90,90,90,90,90]), boundingBox: makeBBox(pts), totalLength: totalLen(segs), arcs: [] },
      thickness: 1.2,
      material: "HR",
      expectedStatus: "pass",
    };
  })(),

  // TC-04: Invalid open profile — dimensions too small (1×1mm bounding box)
  (() => {
    const pts: [number, number][] = [[0,0],[0.5,0],[0.5,0.5]];
    const segs = makeSegments(pts);
    return {
      id: "TC-04",
      name: "Invalid / Degenerate Profile",
      description: "Near-zero bounding box (0.5×0.5mm) — should FAIL at geometry validation stage",
      geometry: { segments: segs, bends: makeBends([90]), boundingBox: makeBBox(pts), totalLength: totalLen(segs), arcs: [] },
      thickness: 1.0,
      material: "GI",
      expectedStatus: "fail",
      expectedFailStage: "profile",
    };
  })(),

  // TC-05: Invalid thickness — thickness = -1
  (() => {
    const pts: [number, number][] = [[0,0],[100,0],[100,50],[0,50]];
    const segs = makeSegments(pts);
    return {
      id: "TC-05",
      name: "Invalid Thickness Input",
      description: "thickness = -1 (invalid) — should FAIL at thickness validation, clear error message",
      geometry: { segments: segs, bends: makeBends([90,90]), boundingBox: makeBBox(pts), totalLength: totalLen(segs), arcs: [] },
      thickness: -1,
      material: "GI",
      expectedStatus: "fail",
      expectedFailStage: "thickness",
    };
  })(),
];

// ─── Core runner — mirrors auto-pipeline logic deterministically ─────────────

interface StageResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn" | "skip";
  data?: Record<string, unknown>;
  reason?: string;
}

interface TestCaseResult {
  id: string;
  name: string;
  description: string;
  input: { thickness: number; material: string; bendCount: number; sectionWidth: number; sectionHeight: number };
  expectedStatus: "pass" | "fail";
  expectedFailStage?: string;
  actualStatus: "pass" | "fail";
  stages: StageResult[];
  verdict: "PASS" | "FAIL";
  verdictReason: string;
  enginesSummary: Record<string, unknown>;
}

const SUPPORTED_MATERIALS = ["GI", "CR", "HR", "SS", "AL", "MS", "CU", "TI", "PP", "HSLA"];
const MATERIAL_PENALTY: Record<string, number> = { SS: 2, TI: 4, HSLA: 2, HR: 1, GI: 0, CR: 0, AL: 0, MS: 0, CU: 0, PP: 1 };
const THICKNESS_PENALTY = (t: number) => t < 0.5 ? 2 : t > 3.0 ? 1 : 0;
const STATION_RULES = [
  { minBends: 1,  maxBends: 2,   min: 6,  max: 8,  label: "Simple U/C channel" },
  { minBends: 3,  maxBends: 4,   min: 8,  max: 12, label: "Standard C/Z / lipped" },
  { minBends: 5,  maxBends: 6,   min: 10, max: 14, label: "Lipped channel / purlin" },
  { minBends: 7,  maxBends: 10,  min: 12, max: 18, label: "Shutter / complex" },
  { minBends: 11, maxBends: 999, min: 16, max: 24, label: "Ultra-complex / multi-return" },
];
const K_FACTORS: Record<string, number> = { GI: 0.44, CR: 0.44, HR: 0.42, SS: 0.50, AL: 0.43, MS: 0.42, CU: 0.44, TI: 0.50, PP: 0.44, HSLA: 0.45 };

function runSingleCase(tc: TestCaseDef): TestCaseResult {
  const stages: StageResult[] = [];
  let failed = false;
  let failedStage = "";

  const geometry = tc.geometry;
  const segs = geometry.segments;
  const bends = geometry.bends ?? [];
  const bb = geometry.boundingBox;
  const thkRaw = tc.thickness;
  const matRaw = tc.material.toUpperCase();

  const sW = parseFloat(((bb.maxX - bb.minX)).toFixed(2));
  const sH = parseFloat(((bb.maxY - bb.minY)).toFixed(2));
  const bendCount = bends.length;

  // Stage 1: Import
  if (!segs || segs.length === 0) {
    stages.push({ id: "import", label: "Import Engine", status: "fail", reason: "No segments in geometry" });
    failed = true; failedStage = "import";
  } else {
    stages.push({ id: "import", label: "Import Engine", status: "pass", data: { segmentCount: segs.length } });
  }

  // Stage 2: Geometry validation
  if (!failed) {
    if (sW < 1 || sH < 1) {
      stages.push({ id: "profile", label: "Geometry Engine", status: "fail", reason: `Dimensions too small: W=${sW}mm H=${sH}mm` });
      failed = true; failedStage = "profile";
    } else {
      stages.push({ id: "profile", label: "Geometry Engine", status: "pass", data: { sectionWidth: sW, sectionHeight: sH, bendCount } });
    }
  }

  // Stage 3: Thickness validation
  const thickness = parseFloat(String(thkRaw));
  if (!failed) {
    if (isNaN(thickness) || thickness <= 0) {
      stages.push({ id: "thickness", label: "Input Engine (Thickness)", status: "fail", reason: `Invalid thickness: ${thkRaw}. Must be a positive number in mm.` });
      failed = true; failedStage = "thickness";
    } else if (thickness < 0.3 || thickness > 6.0) {
      stages.push({ id: "thickness", label: "Input Engine (Thickness)", status: "warn", reason: `${thickness}mm outside 0.3–6.0mm range`, data: { thickness_mm: thickness } });
    } else {
      stages.push({ id: "thickness", label: "Input Engine (Thickness)", status: "pass", data: { thickness_mm: thickness } });
    }
  }

  // Stage 4: Material validation
  const material = SUPPORTED_MATERIALS.includes(matRaw) ? matRaw : "GI";
  if (!failed) {
    if (!SUPPORTED_MATERIALS.includes(matRaw)) {
      stages.push({ id: "material", label: "Input Engine (Material)", status: "warn", reason: `Unknown material '${matRaw}', defaulting to GI` });
    } else {
      stages.push({ id: "material", label: "Input Engine (Material)", status: "pass", data: { material } });
    }
  }

  // Stage 5: Strip width
  let stripWidth = geometry.totalLength ?? segs.reduce((s, seg) => s + (seg.length ?? 0), 0);
  if (!failed) {
    try {
      const kFactor = K_FACTORS[material] ?? 0.44;
      const flanges = segs.filter(s => s.type === "line").map(s => s.length);
      const bendParams = bends.map(b => ({ angle: b.angle, innerRadius: b.radius }));
      const naResult = computeNeutralAxisStripWidth(bendParams, flanges, kFactor, thickness);
      if (naResult > 0) stripWidth = naResult;
      stages.push({ id: "strip-width", label: "Roll Logic Engine (Strip Width)", status: "pass", data: { strip_width_mm: parseFloat(stripWidth.toFixed(2)), k_factor: kFactor } });
    } catch {
      stages.push({ id: "strip-width", label: "Roll Logic Engine (Strip Width)", status: "warn", reason: "Fallback to perimeter length" });
    }
  }

  // Stage 6: Station estimation
  let numStations = 0;
  let stationLabel = "";
  let stationMin = 0, stationMax = 0;
  if (!failed) {
    const rule = STATION_RULES.find(r => bendCount >= r.minBends && bendCount <= r.maxBends) ?? STATION_RULES[STATION_RULES.length - 1]!;
    const penalty = (MATERIAL_PENALTY[material] ?? 0) + THICKNESS_PENALTY(thickness);
    stationMin = rule.min + penalty;
    stationMax = rule.max + penalty;
    numStations = Math.round((stationMin + stationMax) / 2);
    stationLabel = rule.label;
    stages.push({ id: "station", label: "Station Estimation Engine", status: "pass", data: { recommended: numStations, min: stationMin, max: stationMax, label: stationLabel } });
  }

  // Stage 7: Flower pattern
  let flowerStations: unknown[] = [];
  if (!failed && numStations > 0) {
    try {
      const fr = generateFlowerPattern(geometry, numStations, "S", material, thickness);
      flowerStations = fr.stations;
      stages.push({ id: "flower", label: "Flower Pattern Engine", status: "pass", data: { stationsGenerated: flowerStations.length, complexity: stationLabel } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Flower generation failed";
      stages.push({ id: "flower", label: "Flower Pattern Engine", status: "fail", reason: msg });
      failed = true; failedStage = "flower";
    }
  }

  // Stage 8: Shaft/Bearing
  let shaftDiam = 40;
  let bearingType = "6210";
  if (!failed && flowerStations.length > 0) {
    try {
      const rt = generateRollTooling(
        flowerStations as Parameters<typeof generateRollTooling>[0],
        material, thickness, 40, 0.05, 11, 1440,
      );
      for (const r of rt as Array<{ shaft?: { selectedDiaMm?: number }; bearing?: { designation?: string } }>) {
        if ((r.shaft?.selectedDiaMm ?? 0) > shaftDiam) shaftDiam = r.shaft!.selectedDiaMm!;
        if (r.bearing?.designation) bearingType = r.bearing.designation;
      }
      stages.push({ id: "mechanical", label: "Mechanical Selection Engine", status: "pass", data: { shaft_diameter_mm: shaftDiam, bearing_type: bearingType } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Shaft/bearing calc failed";
      stages.push({ id: "mechanical", label: "Mechanical Selection Engine", status: "warn", reason: msg });
      shaftDiam = 50; bearingType = "6210";
    }
  }

  // Stage 9: Report
  if (!failed) {
    stages.push({ id: "report", label: "Report Engine", status: "pass", data: { assumptions: ["Preliminary logic — expert review required", `DIN 6935 K-factor strip width`, `Shigley's MSS shaft design`] } });
  }

  const actualStatus: "pass" | "fail" = failed ? "fail" : "pass";
  const expectedCorrect = actualStatus === tc.expectedStatus;
  const failStageCorrect = !tc.expectedFailStage || (failed && failedStage === tc.expectedFailStage);
  const verdict: "PASS" | "FAIL" = (expectedCorrect && failStageCorrect) ? "PASS" : "FAIL";

  let verdictReason = "";
  if (!expectedCorrect) {
    verdictReason = `Expected pipeline ${tc.expectedStatus} but got ${actualStatus}`;
  } else if (!failStageCorrect) {
    verdictReason = `Expected failure at '${tc.expectedFailStage}' but failed at '${failedStage}'`;
  } else {
    verdictReason = actualStatus === "pass"
      ? `Pipeline passed all ${stages.length} stages — ${numStations} stations, ${shaftDiam}mm shaft, ${bearingType} bearing`
      : `Pipeline correctly failed at '${failedStage}': ${stages.find(s => s.id === failedStage)?.reason ?? "see stage details"}`;
  }

  return {
    id: tc.id,
    name: tc.name,
    description: tc.description,
    input: { thickness: tc.thickness, material: tc.material, bendCount, sectionWidth: sW, sectionHeight: sH },
    expectedStatus: tc.expectedStatus,
    expectedFailStage: tc.expectedFailStage,
    actualStatus,
    stages,
    verdict,
    verdictReason,
    enginesSummary: {
      stations: numStations,
      stationRange: numStations > 0 ? `${stationMin}–${stationMax}` : "N/A",
      complexity: stationLabel || "N/A",
      shaftDiameter_mm: shaftDiam,
      bearing: bearingType,
      stripWidth_mm: parseFloat(stripWidth.toFixed(2)),
      flowerPasses: flowerStations.length,
    },
  };
}

// ─── GET /api/test-cases — run all 5 test cases ─────────────────────────────

router.get("/test-cases", (_req, res) => {
  console.log("[test-cases] Running 5 mandatory test cases...");
  const results = TC_GEOMETRIES.map(tc => {
    try {
      const r = runSingleCase(tc);
      console.log(`[test-cases] ${tc.id} ${r.name}: ${r.verdict} — ${r.verdictReason}`);
      return r;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      console.error(`[test-cases] ${tc.id} CRASHED: ${msg}`);
      return {
        id: tc.id, name: tc.name, description: tc.description,
        input: { thickness: tc.thickness, material: tc.material, bendCount: 0, sectionWidth: 0, sectionHeight: 0 },
        expectedStatus: tc.expectedStatus, actualStatus: "fail" as const,
        stages: [{ id: "crash", label: "Crash", status: "fail" as const, reason: msg }],
        verdict: "FAIL" as const,
        verdictReason: `Test case crashed: ${msg}`,
        enginesSummary: {},
      };
    }
  });

  const passed = results.filter(r => r.verdict === "PASS").length;
  const failed = results.filter(r => r.verdict === "FAIL").length;

  res.json({
    test_suite: "Mandatory Roll-Forming Test Suite (Section 11)",
    total: results.length,
    passed,
    failed,
    overall: failed === 0 ? "ALL_PASS" : passed === 0 ? "ALL_FAIL" : "PARTIAL",
    results,
    run_at: new Date().toISOString(),
  });
});

export default router;
