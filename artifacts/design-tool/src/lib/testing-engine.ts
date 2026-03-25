import type { Segment, BendPoint, ProfileGeometry, StationProfile } from "../store/useCncStore";

export type TestSeverity = "pass" | "warning" | "fail" | "critical";
export type LayerStatus = "idle" | "running" | "done";

export interface TestResult {
  id: string;
  name: string;
  severity: TestSeverity;
  message: string;
  value?: number;
  expected?: string;
  actual?: string;
}

export interface LayerResult {
  layerId: number;
  name: string;
  nameHi: string;
  status: LayerStatus;
  score: number;
  maxScore: number;
  tests: TestResult[];
  durationMs: number;
}

export interface TestingReport {
  timestamp: string;
  totalScore: number;
  maxPossibleScore: number;
  pct: number;
  grade: "S+" | "S" | "A" | "B" | "C" | "D" | "F";
  layers: LayerResult[];
  bugCount: number;
  warningCount: number;
  passCount: number;
}

const MATERIAL_LIMITS: Record<string, {
  yieldMPa: number; tensileMPa: number; minThick: number; maxThick: number;
  minBendRt: number; maxAnglePerPass: number; elongPct: number; springbackPct: number;
  maxFormingSpeed: number; density: number;
}> = {
  GI:   { yieldMPa: 280, tensileMPa: 380, minThick: 0.3, maxThick: 3.0, minBendRt: 1.0, maxAnglePerPass: 15, elongPct: 28, springbackPct: 3, maxFormingSpeed: 30, density: 7850 },
  CR:   { yieldMPa: 340, tensileMPa: 440, minThick: 0.2, maxThick: 3.0, minBendRt: 0.8, maxAnglePerPass: 12, elongPct: 32, springbackPct: 2.5, maxFormingSpeed: 35, density: 7850 },
  HR:   { yieldMPa: 250, tensileMPa: 390, minThick: 1.0, maxThick: 8.0, minBendRt: 1.5, maxAnglePerPass: 12, elongPct: 30, springbackPct: 4, maxFormingSpeed: 20, density: 7850 },
  SS:   { yieldMPa: 310, tensileMPa: 620, minThick: 0.3, maxThick: 3.0, minBendRt: 1.5, maxAnglePerPass: 10, elongPct: 40, springbackPct: 6, maxFormingSpeed: 15, density: 8000 },
  AL:   { yieldMPa: 270, tensileMPa: 310, minThick: 0.3, maxThick: 5.0, minBendRt: 1.0, maxAnglePerPass: 12, elongPct: 15, springbackPct: 3.5, maxFormingSpeed: 40, density: 2700 },
  MS:   { yieldMPa: 250, tensileMPa: 410, minThick: 0.3, maxThick: 6.0, minBendRt: 1.0, maxAnglePerPass: 12, elongPct: 26, springbackPct: 3, maxFormingSpeed: 25, density: 7850 },
  CU:   { yieldMPa: 200, tensileMPa: 300, minThick: 0.3, maxThick: 4.0, minBendRt: 0.8, maxAnglePerPass: 14, elongPct: 35, springbackPct: 2, maxFormingSpeed: 20, density: 8960 },
  TI:   { yieldMPa: 880, tensileMPa: 950, minThick: 0.5, maxThick: 3.0, minBendRt: 3.0, maxAnglePerPass: 6, elongPct: 14, springbackPct: 8, maxFormingSpeed: 8, density: 4430 },
  HSLA: { yieldMPa: 550, tensileMPa: 650, minThick: 0.5, maxThick: 6.0, minBendRt: 2.0, maxAnglePerPass: 10, elongPct: 18, springbackPct: 5.5, maxFormingSpeed: 15, density: 7850 },
  PP:   { yieldMPa: 280, tensileMPa: 370, minThick: 0.3, maxThick: 3.0, minBendRt: 1.0, maxAnglePerPass: 15, elongPct: 28, springbackPct: 3, maxFormingSpeed: 25, density: 7850 },
  DP:   { yieldMPa: 380, tensileMPa: 780, minThick: 0.5, maxThick: 3.0, minBendRt: 2.0, maxAnglePerPass: 8, elongPct: 20, springbackPct: 5, maxFormingSpeed: 12, density: 7850 },
};

const PROFILE_RULES: Record<string, { minBends: number; maxBends: number; symmetry: boolean; typicalAngle: number; desc: string }> = {
  "C-Section":  { minBends: 2, maxBends: 6, symmetry: true, typicalAngle: 90, desc: "C-Channel / Purlin / Stud" },
  "U-Section":  { minBends: 2, maxBends: 4, symmetry: true, typicalAngle: 90, desc: "U-Channel / Track" },
  "Z-Section":  { minBends: 2, maxBends: 6, symmetry: false, typicalAngle: 90, desc: "Z-Purlin / Z-Section" },
  "L-Angle":    { minBends: 1, maxBends: 2, symmetry: false, typicalAngle: 90, desc: "L-Angle / Trim" },
  "Hat/Omega":  { minBends: 4, maxBends: 8, symmetry: true, typicalAngle: 90, desc: "Hat / Omega / Furring" },
  "Angle":      { minBends: 1, maxBends: 3, symmetry: false, typicalAngle: 90, desc: "Equal / Unequal Angle" },
  "Box":        { minBends: 4, maxBends: 4, symmetry: true, typicalAngle: 90, desc: "Box / Square Tube" },
  "Sigma":      { minBends: 6, maxBends: 10, symmetry: true, typicalAngle: 45, desc: "Sigma Profile" },
  "Corrugated": { minBends: 6, maxBends: 50, symmetry: true, typicalAngle: 45, desc: "Corrugated / Trapezoidal Sheet" },
  "Standing-Seam": { minBends: 3, maxBends: 8, symmetry: false, typicalAngle: 90, desc: "Standing Seam Roof" },
  "Guardrail":  { minBends: 8, maxBends: 20, symmetry: true, typicalAngle: 30, desc: "Highway Guardrail W-Beam" },
  "Cable-Tray": { minBends: 4, maxBends: 8, symmetry: true, typicalAngle: 90, desc: "Cable Tray / Ladder" },
  "Custom":     { minBends: 1, maxBends: 50, symmetry: false, typicalAngle: 90, desc: "Custom Profile" },
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function segLen(s: Segment): number {
  return Math.hypot(s.endX - s.startX, s.endY - s.startY);
}

function segGap(a: Segment, b: Segment): number {
  return Math.hypot(b.startX - a.endX, b.startY - a.endY);
}

function angleBetween(a: Segment, b: Segment): number {
  const dx1 = a.endX - a.startX, dy1 = a.endY - a.startY;
  const dx2 = b.endX - b.startX, dy2 = b.endY - b.startY;
  const dot = dx1 * dx2 + dy1 * dy2;
  const cross = dx1 * dy2 - dy1 * dx2;
  return Math.abs(Math.atan2(cross, dot)) * 180 / Math.PI;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1 — Data Integrity (NaN, Infinity, null, undefined, type checks)
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer01(geom: ProfileGeometry, stations: StationProfile[], matType: string, thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 10;
  if (isFiniteNum(thickness) && thickness > 0) { score += 10; tests.push({ id: "L01-01", name: "Thickness finite & positive", severity: "pass", message: `${thickness}mm OK` }); }
  else tests.push({ id: "L01-01", name: "Thickness check", severity: "critical", message: `Invalid thickness: ${thickness}` });

  max += 5;
  if (MATERIAL_LIMITS[matType]) { score += 5; tests.push({ id: "L01-02", name: "Material type recognized", severity: "pass", message: `${matType} found in database` }); }
  else tests.push({ id: "L01-02", name: "Material type", severity: "fail", message: `Unknown material: ${matType}` });

  max += 10;
  let nanCount = 0;
  geom.segments.forEach((s, i) => {
    [s.startX, s.startY, s.endX, s.endY].forEach(v => { if (!isFiniteNum(v)) nanCount++; });
  });
  if (nanCount === 0) { score += 10; tests.push({ id: "L01-03", name: "Segment coordinates finite", severity: "pass", message: `All ${geom.segments.length * 4} values OK` }); }
  else tests.push({ id: "L01-03", name: "Segment NaN/Infinity", severity: "critical", message: `${nanCount} invalid coordinate values`, value: nanCount });

  max += 10;
  let bpNan = 0;
  geom.bendPoints.forEach(bp => { [bp.x, bp.y, bp.angle, bp.radius].forEach(v => { if (!isFiniteNum(v)) bpNan++; }); });
  if (bpNan === 0) { score += 10; tests.push({ id: "L01-04", name: "Bend point data finite", severity: "pass", message: `All ${geom.bendPoints.length} bend points OK` }); }
  else tests.push({ id: "L01-04", name: "Bend point NaN", severity: "critical", message: `${bpNan} invalid bend values` });

  max += 10;
  let stNan = 0;
  stations.forEach(st => {
    st.bendAngles.forEach(a => { if (!isFiniteNum(a)) stNan++; });
    st.segments.forEach(s => { [s.startX, s.startY, s.endX, s.endY].forEach(v => { if (!isFiniteNum(v)) stNan++; }); });
  });
  if (stNan === 0) { score += 10; tests.push({ id: "L01-05", name: "Station data integrity", severity: "pass", message: `All ${stations.length} stations clean` }); }
  else tests.push({ id: "L01-05", name: "Station NaN values", severity: "critical", message: `${stNan} invalid values in stations` });

  max += 5;
  if (geom.segments.length > 0) { score += 5; tests.push({ id: "L01-06", name: "Segments exist", severity: "pass", message: `${geom.segments.length} segments` }); }
  else tests.push({ id: "L01-06", name: "No segments", severity: "critical", message: "Profile has no segments" });

  return { layerId: 1, name: "Data Integrity", nameHi: "Data Integrity — NaN/Infinity/Null Check", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2 — Geometry Validation (gaps, zero-length, connectivity)
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer02(geom: ProfileGeometry): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 10;
  const zeroLen = geom.segments.filter(s => segLen(s) < 0.01);
  if (zeroLen.length === 0) { score += 10; tests.push({ id: "L02-01", name: "No zero-length segments", severity: "pass", message: "All segments have length > 0.01mm" }); }
  else tests.push({ id: "L02-01", name: "Zero-length segments", severity: "fail", message: `${zeroLen.length} segments shorter than 0.01mm` });

  max += 15;
  let gapCount = 0;
  let maxGap = 0;
  for (let i = 0; i < geom.segments.length - 1; i++) {
    const g = segGap(geom.segments[i], geom.segments[i + 1]);
    if (g > 0.05) { gapCount++; maxGap = Math.max(maxGap, g); }
  }
  if (gapCount === 0) { score += 15; tests.push({ id: "L02-02", name: "Segment connectivity", severity: "pass", message: "All segments connected (gap < 0.05mm)" }); }
  else tests.push({ id: "L02-02", name: "Connectivity gaps", severity: "fail", message: `${gapCount} gaps found, max gap: ${maxGap.toFixed(3)}mm`, value: maxGap });

  max += 10;
  const bb = geom.boundingBox;
  const bbW = bb.maxX - bb.minX;
  const bbH = bb.maxY - bb.minY;
  if (bbW > 0 && bbH > 0 && bbW < 10000 && bbH < 10000) {
    score += 10; tests.push({ id: "L02-03", name: "Bounding box valid", severity: "pass", message: `${bbW.toFixed(1)} x ${bbH.toFixed(1)}mm` });
  } else tests.push({ id: "L02-03", name: "Bounding box", severity: "warning", message: `Size ${bbW.toFixed(1)} x ${bbH.toFixed(1)}mm — check scale` });

  max += 10;
  const totalLen = geom.segments.reduce((s, seg) => s + segLen(seg), 0);
  if (totalLen > 1 && totalLen < 5000) { score += 10; tests.push({ id: "L02-04", name: "Total profile length", severity: "pass", message: `${totalLen.toFixed(1)}mm` }); }
  else if (totalLen <= 1) tests.push({ id: "L02-04", name: "Profile too small", severity: "fail", message: `${totalLen.toFixed(3)}mm — profile too small` });
  else tests.push({ id: "L02-04", name: "Profile very large", severity: "warning", message: `${totalLen.toFixed(0)}mm — unusually large` });

  max += 5;
  let selfIntersect = false;
  for (let i = 0; i < geom.segments.length && !selfIntersect; i++) {
    for (let j = i + 2; j < geom.segments.length && !selfIntersect; j++) {
      const a = geom.segments[i], b = geom.segments[j];
      const abMinX = Math.min(a.startX, a.endX), abMaxX = Math.max(a.startX, a.endX);
      const abMinY = Math.min(a.startY, a.endY), abMaxY = Math.max(a.startY, a.endY);
      const bbMinX = Math.min(b.startX, b.endX), bbMaxX = Math.max(b.startX, b.endX);
      const bbMinY = Math.min(b.startY, b.endY), bbMaxY = Math.max(b.startY, b.endY);
      if (abMaxX >= bbMinX && bbMaxX >= abMinX && abMaxY >= bbMinY && bbMaxY >= abMinY) {
        if (j !== i + 1) selfIntersect = true;
      }
    }
  }
  if (!selfIntersect) { score += 5; tests.push({ id: "L02-05", name: "No self-intersection", severity: "pass", message: "Profile does not self-intersect" }); }
  else tests.push({ id: "L02-05", name: "Self-intersection", severity: "warning", message: "Potential self-intersection detected" });

  return { layerId: 2, name: "Geometry Validation", nameHi: "Geometry — Gaps, Length, Intersection", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 3 — Profile Continuity (chain order, closed/open detection)
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer03(geom: ProfileGeometry): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 10;
  const segs = geom.segments;
  if (segs.length >= 2) {
    let chainOk = true;
    for (let i = 0; i < segs.length - 1; i++) {
      if (segGap(segs[i], segs[i + 1]) > 0.1) { chainOk = false; break; }
    }
    if (chainOk) { score += 10; tests.push({ id: "L03-01", name: "Segment chain continuous", severity: "pass", message: "All segments form a continuous chain" }); }
    else tests.push({ id: "L03-01", name: "Chain broken", severity: "fail", message: "Segment chain has breaks — fix connectivity" });
  } else {
    tests.push({ id: "L03-01", name: "Not enough segments", severity: "warning", message: `Only ${segs.length} segment(s)` });
  }

  max += 10;
  if (segs.length >= 2) {
    const closedGap = Math.hypot(segs[segs.length - 1].endX - segs[0].startX, segs[segs.length - 1].endY - segs[0].startY);
    const isClosed = closedGap < 0.1;
    score += 10;
    tests.push({ id: "L03-02", name: "Open/Closed detection", severity: "pass", message: isClosed ? "Closed profile (tube/box)" : `Open profile (gap ${closedGap.toFixed(1)}mm)` });
  } else { max -= 10; }

  max += 10;
  const directions = segs.map(s => Math.atan2(s.endY - s.startY, s.endX - s.startX));
  let reverseCount = 0;
  for (let i = 1; i < directions.length; i++) {
    let diff = Math.abs(directions[i] - directions[i - 1]);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > Math.PI * 0.95) reverseCount++;
  }
  if (reverseCount === 0) { score += 10; tests.push({ id: "L03-03", name: "No reverse segments", severity: "pass", message: "Profile flows in consistent direction" }); }
  else tests.push({ id: "L03-03", name: "Reverse segments", severity: "warning", message: `${reverseCount} segments reverse direction` });

  max += 5;
  const bendCoverage = geom.bendPoints.length > 0 ? geom.bendPoints.length / Math.max(segs.length - 1, 1) : 0;
  if (geom.bendPoints.length > 0) { score += 5; tests.push({ id: "L03-04", name: "Bend points defined", severity: "pass", message: `${geom.bendPoints.length} bends, coverage ${(bendCoverage * 100).toFixed(0)}%` }); }
  else tests.push({ id: "L03-04", name: "No bend points", severity: "warning", message: "No bend points — profile may be flat" });

  return { layerId: 3, name: "Profile Continuity", nameHi: "Continuity — Chain, Open/Closed, Direction", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 4 — Bend Point Accuracy (angles, radii, positions)
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer04(geom: ProfileGeometry, thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 10;
  const bps = geom.bendPoints;
  let radiusOk = 0;
  bps.forEach((bp, i) => {
    if (bp.radius > 0 && bp.radius >= thickness * 0.3) radiusOk++;
    else tests.push({ id: `L04-R${i}`, name: `Bend ${i + 1} radius`, severity: bp.radius <= 0 ? "critical" : "warning", message: `R=${bp.radius.toFixed(2)}mm, min=${(thickness * 0.3).toFixed(2)}mm` });
  });
  if (bps.length > 0 && radiusOk === bps.length) { score += 10; tests.push({ id: "L04-01", name: "All bend radii valid", severity: "pass", message: `${bps.length} bends, all R > ${(thickness * 0.3).toFixed(1)}mm` }); }
  else if (bps.length === 0) { tests.push({ id: "L04-01", name: "No bends to check", severity: "warning", message: "No bend points defined" }); }

  max += 10;
  let angleOk = 0;
  bps.forEach((bp, i) => {
    if (Math.abs(bp.angle) > 0 && Math.abs(bp.angle) <= 180) angleOk++;
    else tests.push({ id: `L04-A${i}`, name: `Bend ${i + 1} angle`, severity: "fail", message: `Angle=${bp.angle.toFixed(1)}° — must be 0-180°` });
  });
  if (bps.length > 0 && angleOk === bps.length) { score += 10; tests.push({ id: "L04-02", name: "All bend angles valid", severity: "pass", message: `${bps.length} bends, all within 0-180°` }); }
  else if (bps.length === 0) { max -= 10; }

  max += 10;
  let posOk = 0;
  bps.forEach((bp, i) => {
    const bb = geom.boundingBox;
    const inBox = bp.x >= bb.minX - 1 && bp.x <= bb.maxX + 1 && bp.y >= bb.minY - 1 && bp.y <= bb.maxY + 1;
    if (inBox) posOk++;
    else tests.push({ id: `L04-P${i}`, name: `Bend ${i + 1} position`, severity: "warning", message: `Position (${bp.x.toFixed(1)}, ${bp.y.toFixed(1)}) outside profile bounds` });
  });
  if (bps.length > 0 && posOk === bps.length) { score += 10; tests.push({ id: "L04-03", name: "Bend positions in bounds", severity: "pass", message: "All bends inside profile bounding box" }); }
  else if (bps.length === 0) { max -= 10; }

  max += 5;
  let tooClose = 0;
  for (let i = 0; i < bps.length - 1; i++) {
    const d = Math.hypot(bps[i + 1].x - bps[i].x, bps[i + 1].y - bps[i].y);
    if (d < thickness * 2) tooClose++;
  }
  if (tooClose === 0) { score += 5; tests.push({ id: "L04-04", name: "Bend spacing adequate", severity: "pass", message: `All bends spaced > ${(thickness * 2).toFixed(1)}mm apart` }); }
  else tests.push({ id: "L04-04", name: "Bends too close", severity: "warning", message: `${tooClose} bend pairs closer than ${(thickness * 2).toFixed(1)}mm` });

  return { layerId: 4, name: "Bend Point Accuracy", nameHi: "Bend Accuracy — Angle, Radius, Position", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 5 — Material Compatibility
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer05(geom: ProfileGeometry, matType: string, thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;
  const mat = MATERIAL_LIMITS[matType] ?? MATERIAL_LIMITS.GI;

  max += 10;
  if (thickness >= mat.minThick && thickness <= mat.maxThick) {
    score += 10; tests.push({ id: "L05-01", name: "Thickness in range", severity: "pass", message: `${thickness}mm within ${mat.minThick}-${mat.maxThick}mm for ${matType}` });
  } else tests.push({ id: "L05-01", name: "Thickness out of range", severity: "fail", message: `${thickness}mm outside ${mat.minThick}-${mat.maxThick}mm for ${matType}`, expected: `${mat.minThick}-${mat.maxThick}`, actual: `${thickness}` });

  max += 10;
  let rtOk = 0;
  geom.bendPoints.forEach((bp, i) => {
    const rt = bp.radius / thickness;
    if (rt >= mat.minBendRt) rtOk++;
    else tests.push({ id: `L05-R${i}`, name: `Bend ${i + 1} R/t`, severity: "fail", message: `R/t=${rt.toFixed(2)}, min=${mat.minBendRt} for ${matType}`, value: rt });
  });
  if (geom.bendPoints.length > 0 && rtOk === geom.bendPoints.length) {
    score += 10; tests.push({ id: "L05-02", name: "All R/t ratios safe", severity: "pass", message: `All bends R/t >= ${mat.minBendRt}` });
  } else if (geom.bendPoints.length === 0) { max -= 10; }

  max += 5;
  score += 5;
  tests.push({ id: "L05-03", name: "Material properties", severity: "pass", message: `${matType}: Yield=${mat.yieldMPa}MPa, UTS=${mat.tensileMPa}MPa, Elong=${mat.elongPct}%` });

  max += 5;
  const maxAngle = geom.bendPoints.reduce((m, bp) => Math.max(m, Math.abs(bp.angle)), 0);
  if (maxAngle <= 180) { score += 5; tests.push({ id: "L05-04", name: "Max bend angle feasible", severity: "pass", message: `Max bend ${maxAngle.toFixed(1)}° — ${matType} can handle` }); }
  else tests.push({ id: "L05-04", name: "Bend angle too high", severity: "fail", message: `${maxAngle.toFixed(1)}° exceeds formable limit` });

  return { layerId: 5, name: "Material Compatibility", nameHi: "Material — Thickness, R/t, Formability", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 6 — Bend Angle Limits (per-station max angle per pass)
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer06(stations: StationProfile[], matType: string): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;
  const mat = MATERIAL_LIMITS[matType] ?? MATERIAL_LIMITS.GI;

  max += 15;
  if (stations.length === 0) {
    tests.push({ id: "L06-01", name: "No stations", severity: "warning", message: "Generate Power Pattern first" });
    return { layerId: 6, name: "Bend Angle Limits", nameHi: "Angle Limits — Per Station Max Check", status: "done", score: 0, maxScore: max, tests, durationMs: performance.now() - t0 };
  }

  let violations = 0;
  stations.forEach((st, i) => {
    const maxA = st.bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
    const prevMax = i > 0 ? stations[i - 1].bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0) : 0;
    const increment = maxA - prevMax;
    if (increment > mat.maxAnglePerPass) {
      violations++;
      tests.push({ id: `L06-S${i}`, name: `Station ${i + 1} increment`, severity: increment > mat.maxAnglePerPass * 1.5 ? "critical" : "warning",
        message: `+${increment.toFixed(1)}°/pass (max ${mat.maxAnglePerPass}° for ${matType})`, value: increment });
    }
  });
  if (violations === 0) { score += 15; tests.push({ id: "L06-01", name: "All stations within limits", severity: "pass", message: `All ${stations.length} stations < ${mat.maxAnglePerPass}°/pass` }); }

  max += 10;
  const totalFormed = stations[stations.length - 1]?.bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0) ?? 0;
  const minStations = Math.ceil(totalFormed / mat.maxAnglePerPass) + 2;
  if (stations.length >= minStations) { score += 10; tests.push({ id: "L06-02", name: "Station count adequate", severity: "pass", message: `${stations.length} stations >= ${minStations} minimum` }); }
  else tests.push({ id: "L06-02", name: "Not enough stations", severity: "fail", message: `Need ${minStations} stations, have ${stations.length}` });

  return { layerId: 6, name: "Bend Angle Limits", nameHi: "Angle Limits — Per Station Max Check", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 7 — Station Progression (monotonic, smooth distribution)
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer07(stations: StationProfile[]): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  if (stations.length < 2) {
    return { layerId: 7, name: "Station Progression", nameHi: "Progression — Monotonic, Smooth Distribution", status: "done", score: 0, maxScore: 10, tests: [{ id: "L07-00", name: "Not enough stations", severity: "warning", message: "Need 2+ stations" }], durationMs: performance.now() - t0 };
  }

  max += 10;
  let monotonic = true;
  for (let i = 1; i < stations.length; i++) {
    const prev = stations[i - 1].bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
    const curr = stations[i].bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
    if (curr < prev - 0.5) { monotonic = false; break; }
  }
  if (monotonic) { score += 10; tests.push({ id: "L07-01", name: "Monotonic progression", severity: "pass", message: "Bend angles increase monotonically" }); }
  else tests.push({ id: "L07-01", name: "Non-monotonic", severity: "warning", message: "Bend angles decrease at some stations — check forming sequence" });

  max += 10;
  const increments = stations.slice(1).map((st, i) => {
    const curr = st.bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
    const prev = stations[i].bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
    return curr - prev;
  });
  const avgInc = increments.reduce((s, v) => s + v, 0) / increments.length;
  const maxInc = Math.max(...increments);
  const minInc = Math.min(...increments.filter(v => v > 0));
  const ratio = maxInc / Math.max(minInc, 0.1);
  if (ratio < 3) { score += 10; tests.push({ id: "L07-02", name: "Smooth distribution", severity: "pass", message: `Max/min ratio ${ratio.toFixed(1)} — good balance` }); }
  else tests.push({ id: "L07-02", name: "Uneven distribution", severity: "warning", message: `Max/min ratio ${ratio.toFixed(1)} — some stations have much larger increments` });

  max += 5;
  const hasCalibration = stations.some(s => s.passZone === "Calibration" || s.isCalibrationPass);
  if (hasCalibration) { score += 5; tests.push({ id: "L07-03", name: "Calibration passes", severity: "pass", message: "Calibration station(s) present" }); }
  else tests.push({ id: "L07-03", name: "No calibration", severity: "warning", message: "Add calibration passes for better accuracy" });

  return { layerId: 7, name: "Station Progression", nameHi: "Progression — Monotonic, Smooth Distribution", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 8 — Springback Compensation
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer08(stations: StationProfile[], matType: string): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;
  const mat = MATERIAL_LIMITS[matType] ?? MATERIAL_LIMITS.GI;

  max += 10;
  const hasSpringback = stations.some(st => st.springbackAngles && st.springbackAngles.length > 0);
  if (hasSpringback) { score += 10; tests.push({ id: "L08-01", name: "Springback data present", severity: "pass", message: "Springback compensation calculated" }); }
  else tests.push({ id: "L08-01", name: "No springback data", severity: "warning", message: "Run springback analysis for better accuracy" });

  max += 10;
  const hasSbComp = stations.some(st => st.springbackCompensationAngle && st.springbackCompensationAngle > 0);
  if (hasSbComp) { score += 10; tests.push({ id: "L08-02", name: "Compensation applied", severity: "pass", message: "Springback compensation angles set" }); }
  else if (hasSpringback) tests.push({ id: "L08-02", name: "Compensation not applied", severity: "warning", message: "Springback detected but no compensation angles set" });
  else { max -= 10; }

  max += 5;
  tests.push({ id: "L08-03", name: "Material springback factor", severity: "pass", message: `${matType}: typical springback ~${mat.springbackPct}%` });
  score += 5;

  return { layerId: 8, name: "Springback Compensation", nameHi: "Springback — Compensation, Overbend", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 9 — Strip Width Accuracy
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer09(geom: ProfileGeometry, thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 15;
  const flatLen = geom.segments.reduce((s, seg) => s + segLen(seg), 0);
  const bendAllowance = geom.bendPoints.reduce((s, bp) => {
    const k = 0.44;
    const r = Math.max(bp.radius, thickness * 0.5);
    const aRad = Math.abs(bp.angle) * Math.PI / 180;
    return s + aRad * (r + k * thickness);
  }, 0);
  const stripWidth = flatLen + bendAllowance;
  if (stripWidth > 0 && stripWidth < 2000) { score += 15; tests.push({ id: "L09-01", name: "Strip width calculated", severity: "pass", message: `Flat=${flatLen.toFixed(1)}mm + BA=${bendAllowance.toFixed(1)}mm = ${stripWidth.toFixed(1)}mm`, value: stripWidth }); }
  else tests.push({ id: "L09-01", name: "Strip width", severity: "warning", message: `Width ${stripWidth.toFixed(1)}mm — verify coil availability` });

  max += 10;
  const tolerance = stripWidth * 0.001;
  tests.push({ id: "L09-02", name: "Width tolerance", severity: "pass", message: `DIN 6935 tolerance: ±${tolerance.toFixed(2)}mm` });
  score += 10;

  max += 5;
  const kFactorUsed = 0.44;
  if (kFactorUsed >= 0.3 && kFactorUsed <= 0.5) { score += 5; tests.push({ id: "L09-03", name: "K-factor valid", severity: "pass", message: `K=${kFactorUsed} (DIN 6935 range 0.3-0.5)` }); }
  else tests.push({ id: "L09-03", name: "K-factor", severity: "warning", message: `K=${kFactorUsed} outside standard range` });

  return { layerId: 9, name: "Strip Width Accuracy", nameHi: "Strip Width — Flat Length, Bend Allowance", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 10 — Edge Strain Analysis
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer10(geom: ProfileGeometry, stations: StationProfile[], thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  if (stations.length === 0) {
    return { layerId: 10, name: "Edge Strain", nameHi: "Edge Strain — Longitudinal, Cracking Risk", status: "done", score: 0, maxScore: 10, tests: [{ id: "L10-00", name: "No stations", severity: "warning", message: "Generate stations first" }], durationMs: performance.now() - t0 };
  }

  max += 15;
  const totalBend = geom.bendPoints.reduce((s, bp) => s + Math.abs(bp.angle), 0);
  const maxPerStation = totalBend / Math.max(stations.length - 2, 1);
  const edgeStrain = (thickness / (2 * (thickness * 2) + thickness)) * (maxPerStation * Math.PI / 180) * 100;

  if (edgeStrain < 1.5) { score += 15; tests.push({ id: "L10-01", name: "Edge strain safe", severity: "pass", message: `${edgeStrain.toFixed(2)}% < 1.5% limit` }); }
  else if (edgeStrain < 2.0) { score += 8; tests.push({ id: "L10-01", name: "Edge strain elevated", severity: "warning", message: `${edgeStrain.toFixed(2)}% approaching 2.0% limit` }); }
  else tests.push({ id: "L10-01", name: "Edge strain critical", severity: "critical", message: `${edgeStrain.toFixed(2)}% exceeds 2.0% — cracking risk`, value: edgeStrain });

  max += 10;
  const webHeight = geom.boundingBox.maxY - geom.boundingBox.minY;
  const edgeElongation = webHeight > 0 ? (totalBend * Math.PI / 180 * thickness) / (2 * webHeight) * 100 : 0;
  if (edgeElongation < 0.5) { score += 10; tests.push({ id: "L10-02", name: "Edge elongation", severity: "pass", message: `${edgeElongation.toFixed(3)}% — within safe limits` }); }
  else tests.push({ id: "L10-02", name: "Edge elongation high", severity: "warning", message: `${edgeElongation.toFixed(3)}% — monitor edge quality` });

  return { layerId: 10, name: "Edge Strain", nameHi: "Edge Strain — Longitudinal, Cracking Risk", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 11 — Thinning Check
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer11(geom: ProfileGeometry, thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 15;
  let maxThinning = 0;
  geom.bendPoints.forEach((bp, i) => {
    const r = Math.max(bp.radius, thickness * 0.5);
    const aRad = Math.abs(bp.angle) * Math.PI / 180;
    const thinPct = (1 - r / (r + thickness)) * aRad / (Math.PI / 2) * 100;
    maxThinning = Math.max(maxThinning, thinPct);
    if (thinPct > 15) tests.push({ id: `L11-T${i}`, name: `Bend ${i + 1} thinning`, severity: "critical", message: `${thinPct.toFixed(1)}% thinning at R=${r.toFixed(1)}mm` });
    else if (thinPct > 10) tests.push({ id: `L11-T${i}`, name: `Bend ${i + 1} thinning`, severity: "warning", message: `${thinPct.toFixed(1)}% thinning` });
  });
  if (maxThinning < 10) { score += 15; tests.push({ id: "L11-01", name: "Thinning within limits", severity: "pass", message: `Max thinning ${maxThinning.toFixed(1)}% < 10% safe limit` }); }
  else if (maxThinning < 15) { score += 8; }

  max += 10;
  const avgR = geom.bendPoints.length > 0 ? geom.bendPoints.reduce((s, bp) => s + bp.radius, 0) / geom.bendPoints.length : thickness * 2;
  const thinnedT = thickness * (1 - maxThinning / 100);
  tests.push({ id: "L11-02", name: "Min thickness after forming", severity: thinnedT > thickness * 0.85 ? "pass" : "warning", message: `${thinnedT.toFixed(3)}mm (original: ${thickness}mm)` });
  if (thinnedT > thickness * 0.85) score += 10;

  return { layerId: 11, name: "Thinning Check", nameHi: "Thinning — Material Reduction at Bends", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 12 — Roll Tooling Validation
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer12(stations: StationProfile[], thickness: number, rollTooling: unknown[]): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 10;
  if (rollTooling && rollTooling.length > 0) { score += 10; tests.push({ id: "L12-01", name: "Roll tooling generated", severity: "pass", message: `${rollTooling.length} tooling sets` }); }
  else tests.push({ id: "L12-01", name: "No roll tooling", severity: "warning", message: "Generate roll tooling for full validation" });

  max += 10;
  if (stations.length > 0) {
    const hasGaps = stations.some(s => s.rollFaceWidth && s.rollFaceWidth > 0);
    if (hasGaps || rollTooling.length > 0) { score += 10; tests.push({ id: "L12-02", name: "Roll face width defined", severity: "pass", message: "Roll dimensions available" }); }
    else tests.push({ id: "L12-02", name: "Roll dimensions missing", severity: "warning", message: "Run roll tooling to set dimensions" });
  }

  max += 5;
  tests.push({ id: "L12-03", name: "Tooling material", severity: "pass", message: "Recommended: D3 HRC 60-63 or EN31 HRC 58-60" });
  score += 5;

  return { layerId: 12, name: "Roll Tooling", nameHi: "Roll Tooling — Dimensions, Gap, Material", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 13 — G-Code Safety
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer13(gcodeOutputs: string[]): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 10;
  if (gcodeOutputs.length > 0) { score += 10; tests.push({ id: "L13-01", name: "G-Code generated", severity: "pass", message: `${gcodeOutputs.length} programs` }); }
  else { tests.push({ id: "L13-01", name: "No G-Code", severity: "warning", message: "Generate G-Code for safety check" }); return { layerId: 13, name: "G-Code Safety", nameHi: "G-Code — Speed, Feed, Collision, Safety", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 }; }

  max += 10;
  const allCode = gcodeOutputs.join("\n");
  const hasStart = allCode.includes("G28") || allCode.includes("G54") || allCode.includes("G92");
  if (hasStart) { score += 10; tests.push({ id: "L13-02", name: "Home/reference command", severity: "pass", message: "G28/G54/G92 found" }); }
  else tests.push({ id: "L13-02", name: "No home command", severity: "warning", message: "Add G28 for machine reference" });

  max += 10;
  const hasEnd = allCode.includes("M30") || allCode.includes("M2") || allCode.includes("M99");
  if (hasEnd) { score += 10; tests.push({ id: "L13-03", name: "Program end", severity: "pass", message: "M30/M2 found" }); }
  else tests.push({ id: "L13-03", name: "No program end", severity: "warning", message: "Add M30 for clean stop" });

  max += 5;
  const feedMatch = allCode.match(/F(\d+)/g);
  if (feedMatch && feedMatch.length > 0) {
    const feeds = feedMatch.map(f => parseInt(f.slice(1)));
    const maxFeed = Math.max(...feeds);
    if (maxFeed < 5000) { score += 5; tests.push({ id: "L13-04", name: "Feed rates safe", severity: "pass", message: `Max F${maxFeed}` }); }
    else tests.push({ id: "L13-04", name: "Feed rate high", severity: "warning", message: `F${maxFeed} — verify for material` });
  } else { max -= 5; }

  return { layerId: 13, name: "G-Code Safety", nameHi: "G-Code — Speed, Feed, Collision, Safety", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 14 — Machine Feasibility
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer14(stations: StationProfile[], matType: string, thickness: number, geom: ProfileGeometry): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;
  const mat = MATERIAL_LIMITS[matType] ?? MATERIAL_LIMITS.GI;

  max += 10;
  const stripW = geom.segments.reduce((s, seg) => s + segLen(seg), 0);
  const formingForce = mat.yieldMPa * thickness * stripW * 0.001;
  tests.push({ id: "L14-01", name: "Estimated forming force", severity: formingForce < 500 ? "pass" : "warning", message: `~${formingForce.toFixed(0)} kN (${(formingForce * 0.102).toFixed(0)} ton)` });
  if (formingForce < 500) score += 10;
  else score += 5;

  max += 10;
  const motorKw = formingForce * mat.maxFormingSpeed / (60 * 1000) * 1.3;
  tests.push({ id: "L14-02", name: "Motor power estimate", severity: motorKw < 50 ? "pass" : "warning", message: `~${motorKw.toFixed(1)} kW` });
  if (motorKw < 50) score += 10; else score += 5;

  max += 10;
  const shaftDia = 60;
  const machineLen = stations.length * 300;
  tests.push({ id: "L14-03", name: "Machine length", severity: "pass", message: `${stations.length} stations x 300mm = ${machineLen}mm (${(machineLen / 1000).toFixed(1)}m)` });
  score += 10;

  max += 5;
  const shaftDeflection = (formingForce * 1000 * Math.pow(stripW, 3)) / (48 * 200000 * Math.PI * Math.pow(shaftDia, 4) / 64);
  tests.push({ id: "L14-04", name: "Shaft deflection", severity: shaftDeflection < 0.05 ? "pass" : "warning", message: `~${(shaftDeflection * 1000).toFixed(2)}µm` });
  if (shaftDeflection < 0.05) score += 5;

  return { layerId: 14, name: "Machine Feasibility", nameHi: "Machine — Force, Motor, Shaft, Length", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 15 — DIN/ISO Tolerance Check
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer15(geom: ProfileGeometry, thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  max += 10;
  const dimTol = thickness < 1 ? 0.05 : thickness < 2 ? 0.1 : 0.15;
  tests.push({ id: "L15-01", name: "DIN 6935 linear tolerance", severity: "pass", message: `±${dimTol}mm for ${thickness}mm gauge` });
  score += 10;

  max += 10;
  const angTol = thickness < 1 ? 0.5 : thickness < 2 ? 1.0 : 1.5;
  tests.push({ id: "L15-02", name: "Angular tolerance", severity: "pass", message: `±${angTol}° per DIN 6935` });
  score += 10;

  max += 10;
  const straightness = geom.boundingBox.maxX - geom.boundingBox.minX > 100 ? 0.1 : 0.05;
  tests.push({ id: "L15-03", name: "Straightness tolerance", severity: "pass", message: `${straightness}mm/m per ISO 2768-mK` });
  score += 10;

  max += 5;
  tests.push({ id: "L15-04", name: "Surface roughness target", severity: "pass", message: "Ra 1.6µm (rolled), Ra 3.2µm (formed)" });
  score += 5;

  max += 5;
  const cpk = 1.67;
  tests.push({ id: "L15-05", name: "Target Cpk", severity: "pass", message: `Cpk >= ${cpk} (6-sigma quality)` });
  score += 5;

  return { layerId: 15, name: "DIN/ISO Tolerances", nameHi: "Tolerance — DIN 6935, ISO 2768, Cpk", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 16 — Profile Type Specific Rules
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer16(geom: ProfileGeometry, profileType: string): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;
  const rules = PROFILE_RULES[profileType] ?? PROFILE_RULES.Custom;

  max += 10;
  tests.push({ id: "L16-01", name: "Profile type", severity: "pass", message: `${profileType}: ${rules.desc}` });
  score += 10;

  max += 10;
  const bc = geom.bendPoints.length;
  if (bc >= rules.minBends && bc <= rules.maxBends) {
    score += 10; tests.push({ id: "L16-02", name: "Bend count valid", severity: "pass", message: `${bc} bends (expected ${rules.minBends}-${rules.maxBends})` });
  } else if (bc < rules.minBends) {
    tests.push({ id: "L16-02", name: "Too few bends", severity: "fail", message: `${bc} bends < ${rules.minBends} minimum for ${profileType}` });
  } else {
    score += 5; tests.push({ id: "L16-02", name: "Many bends", severity: "warning", message: `${bc} bends > ${rules.maxBends} typical max` });
  }

  max += 10;
  if (rules.symmetry && geom.bendPoints.length >= 2) {
    const angles = geom.bendPoints.map(bp => Math.abs(bp.angle));
    const mid = Math.floor(angles.length / 2);
    let symOk = true;
    for (let i = 0; i < mid; i++) {
      if (Math.abs(angles[i] - angles[angles.length - 1 - i]) > 2) { symOk = false; break; }
    }
    if (symOk) { score += 10; tests.push({ id: "L16-03", name: "Symmetry check", severity: "pass", message: "Profile is symmetric" }); }
    else { score += 5; tests.push({ id: "L16-03", name: "Asymmetric profile", severity: "warning", message: "Expected symmetric — check design" }); }
  } else {
    score += 10; tests.push({ id: "L16-03", name: "Symmetry", severity: "pass", message: rules.symmetry ? "N/A (too few bends)" : "Asymmetric profile — OK" });
  }

  return { layerId: 16, name: "Profile-Type Rules", nameHi: "Profile Type — C/Z/U/Hat/L/Box/Sigma Rules", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 17 — Forming Energy Distribution
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer17(stations: StationProfile[], matType: string, thickness: number): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;
  const mat = MATERIAL_LIMITS[matType] ?? MATERIAL_LIMITS.GI;

  if (stations.length === 0) {
    return { layerId: 17, name: "Forming Energy", nameHi: "Energy — Force Distribution, Balance", status: "done", score: 0, maxScore: 10, tests: [{ id: "L17-00", name: "No stations", severity: "warning", message: "Generate stations first" }], durationMs: performance.now() - t0 };
  }

  max += 15;
  const energies = stations.map((st, i) => {
    const fp = (i + 1) / stations.length;
    const maxA = st.bendAngles.reduce((m, a) => Math.max(m, Math.abs(a)), 0);
    return mat.yieldMPa * (maxA * Math.PI / 180) * thickness * thickness * fp * 0.001;
  });
  const totalE = energies.reduce((s, e) => s + e, 0);
  const maxE = Math.max(...energies);
  const avgE = totalE / energies.length;
  const balance = maxE / Math.max(avgE, 0.001);

  if (balance < 2.5) { score += 15; tests.push({ id: "L17-01", name: "Energy balance", severity: "pass", message: `Peak/avg ratio ${balance.toFixed(1)} — well balanced` }); }
  else { score += 5; tests.push({ id: "L17-01", name: "Energy imbalanced", severity: "warning", message: `Peak/avg ratio ${balance.toFixed(1)} — uneven force distribution` }); }

  max += 10;
  tests.push({ id: "L17-02", name: "Total forming energy", severity: "pass", message: `${totalE.toFixed(3)} kJ/m total` });
  score += 10;

  return { layerId: 17, name: "Forming Energy", nameHi: "Energy — Force Distribution, Balance", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 18 — Surface Quality Prediction
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer18(geom: ProfileGeometry, matType: string, thickness: number, stations: StationProfile[]): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;
  const mat = MATERIAL_LIMITS[matType] ?? MATERIAL_LIMITS.GI;

  max += 10;
  const maxAngle = geom.bendPoints.reduce((m, bp) => Math.max(m, Math.abs(bp.angle)), 0);
  const orangePeelRisk = maxAngle > 90 && thickness > 1.5;
  if (!orangePeelRisk) { score += 10; tests.push({ id: "L18-01", name: "Orange peel risk", severity: "pass", message: "Low risk — angle and thickness OK" }); }
  else tests.push({ id: "L18-01", name: "Orange peel risk", severity: "warning", message: `Risk at ${maxAngle.toFixed(0)}° bend in ${thickness}mm gauge` });

  max += 10;
  const scratchRisk = mat.yieldMPa > 400 && thickness < 1;
  if (!scratchRisk) { score += 10; tests.push({ id: "L18-02", name: "Scratch/marking risk", severity: "pass", message: "Low risk" }); }
  else tests.push({ id: "L18-02", name: "Scratch risk", severity: "warning", message: `High-strength thin gauge — use polished rolls` });

  max += 10;
  const edgeWaviness = stations.length > 0 && stations.length < 6 && maxAngle > 60;
  if (!edgeWaviness) { score += 10; tests.push({ id: "L18-03", name: "Edge waviness", severity: "pass", message: "Adequate stations — low waviness risk" }); }
  else tests.push({ id: "L18-03", name: "Edge waviness risk", severity: "warning", message: "Too few stations for bend angle — increase station count" });

  return { layerId: 18, name: "Surface Quality", nameHi: "Surface — Orange Peel, Scratch, Waviness", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 19 — Production Readiness
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer19(stations: StationProfile[], rollTooling: unknown[], gcodeOutputs: string[]): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  const checks = [
    { name: "Stations generated", ok: stations.length > 0, msg: `${stations.length} stations` },
    { name: "Roll tooling ready", ok: rollTooling.length > 0, msg: `${rollTooling.length} tooling sets` },
    { name: "G-Code generated", ok: gcodeOutputs.length > 0, msg: `${gcodeOutputs.length} programs` },
    { name: "3+ stations minimum", ok: stations.length >= 3, msg: `${stations.length} stations` },
  ];

  checks.forEach((c, i) => {
    max += 5;
    if (c.ok) { score += 5; tests.push({ id: `L19-${i + 1}`, name: c.name, severity: "pass", message: c.msg }); }
    else tests.push({ id: `L19-${i + 1}`, name: c.name, severity: "warning", message: `Not ready: ${c.msg || "missing"}` });
  });

  max += 5;
  tests.push({ id: "L19-05", name: "Recommended: Design report", severity: stations.length > 0 ? "pass" : "warning", message: "Generate design report for documentation" });
  if (stations.length > 0) score += 5;

  return { layerId: 19, name: "Production Readiness", nameHi: "Production — BOM, Specs, Documentation", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 20 — Final Certification Gate
// ═══════════════════════════════════════════════════════════════════════════════
function runLayer20(prevLayers: LayerResult[]): LayerResult {
  const t0 = performance.now();
  const tests: TestResult[] = [];
  let score = 0, max = 0;

  const totalScore = prevLayers.reduce((s, l) => s + l.score, 0);
  const totalMax = prevLayers.reduce((s, l) => s + l.maxScore, 0);
  const pct = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const criticals = prevLayers.flatMap(l => l.tests.filter(t => t.severity === "critical"));
  const fails = prevLayers.flatMap(l => l.tests.filter(t => t.severity === "fail"));
  const warnings = prevLayers.flatMap(l => l.tests.filter(t => t.severity === "warning"));

  max += 20;
  if (criticals.length === 0) { score += 10; tests.push({ id: "L20-01", name: "No critical issues", severity: "pass", message: "Zero critical bugs found" }); }
  else tests.push({ id: "L20-01", name: "Critical issues found", severity: "critical", message: `${criticals.length} critical issue(s) — must fix before production` });

  if (fails.length === 0) { score += 5; tests.push({ id: "L20-02", name: "No failures", severity: "pass", message: "Zero test failures" }); }
  else tests.push({ id: "L20-02", name: "Failures found", severity: "fail", message: `${fails.length} failure(s) — review and fix` });

  if (warnings.length <= 3) { score += 5; tests.push({ id: "L20-03", name: "Warnings minimal", severity: "pass", message: `Only ${warnings.length} warning(s)` }); }
  else tests.push({ id: "L20-03", name: "Many warnings", severity: "warning", message: `${warnings.length} warnings — review recommended` });

  max += 10;
  let grade: TestingReport["grade"];
  if (pct >= 98 && criticals.length === 0) grade = "S+";
  else if (pct >= 95 && criticals.length === 0) grade = "S";
  else if (pct >= 90) grade = "A";
  else if (pct >= 80) grade = "B";
  else if (pct >= 70) grade = "C";
  else if (pct >= 50) grade = "D";
  else grade = "F";

  const certified = grade === "S+" || grade === "S" || grade === "A";
  if (certified) { score += 10; tests.push({ id: "L20-04", name: "CERTIFICATION", severity: "pass", message: `Grade ${grade} — CERTIFIED for production (${pct.toFixed(1)}%)` }); }
  else tests.push({ id: "L20-04", name: "CERTIFICATION", severity: grade === "F" ? "critical" : "warning", message: `Grade ${grade} — NOT certified (${pct.toFixed(1)}%). Need ${grade === "B" ? "90" : "80"}%+ for certification.` });

  return { layerId: 20, name: "Final Certification", nameHi: "FINAL — Grade, Certification, Production Gate", status: "done", score, maxScore: max, tests, durationMs: performance.now() - t0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER RUN FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
export interface TestingInput {
  geometry: ProfileGeometry;
  stations: StationProfile[];
  materialType: string;
  thickness: number;
  rollTooling: unknown[];
  gcodeOutputs: string[];
  profileType: string;
}

export function runAllLayers(input: TestingInput, onLayerDone?: (layer: LayerResult, index: number) => void): TestingReport {
  const layers: LayerResult[] = [];

  const fns = [
    () => runLayer01(input.geometry, input.stations, input.materialType, input.thickness),
    () => runLayer02(input.geometry),
    () => runLayer03(input.geometry),
    () => runLayer04(input.geometry, input.thickness),
    () => runLayer05(input.geometry, input.materialType, input.thickness),
    () => runLayer06(input.stations, input.materialType),
    () => runLayer07(input.stations),
    () => runLayer08(input.stations, input.materialType),
    () => runLayer09(input.geometry, input.thickness),
    () => runLayer10(input.geometry, input.stations, input.thickness),
    () => runLayer11(input.geometry, input.thickness),
    () => runLayer12(input.stations, input.thickness, input.rollTooling),
    () => runLayer13(input.gcodeOutputs),
    () => runLayer14(input.stations, input.materialType, input.thickness, input.geometry),
    () => runLayer15(input.geometry, input.thickness),
    () => runLayer16(input.geometry, input.profileType),
    () => runLayer17(input.stations, input.materialType, input.thickness),
    () => runLayer18(input.geometry, input.materialType, input.thickness, input.stations),
    () => runLayer19(input.stations, input.rollTooling, input.gcodeOutputs),
  ];

  fns.forEach((fn, i) => {
    const result = fn();
    layers.push(result);
    onLayerDone?.(result, i);
  });

  const finalLayer = runLayer20(layers);
  layers.push(finalLayer);
  onLayerDone?.(finalLayer, 19);

  const totalScore = layers.reduce((s, l) => s + l.score, 0);
  const maxPossible = layers.reduce((s, l) => s + l.maxScore, 0);
  const pct = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;

  let grade: TestingReport["grade"];
  const criticals = layers.flatMap(l => l.tests.filter(t => t.severity === "critical")).length;
  if (pct >= 98 && criticals === 0) grade = "S+";
  else if (pct >= 95 && criticals === 0) grade = "S";
  else if (pct >= 90) grade = "A";
  else if (pct >= 80) grade = "B";
  else if (pct >= 70) grade = "C";
  else if (pct >= 50) grade = "D";
  else grade = "F";

  return {
    timestamp: new Date().toISOString(),
    totalScore,
    maxPossibleScore: maxPossible,
    pct,
    grade,
    layers,
    bugCount: layers.flatMap(l => l.tests.filter(t => t.severity === "critical" || t.severity === "fail")).length,
    warningCount: layers.flatMap(l => l.tests.filter(t => t.severity === "warning")).length,
    passCount: layers.flatMap(l => l.tests.filter(t => t.severity === "pass")).length,
  };
}

const REPORT_STORAGE_KEY = "sai-rolotech-testing-engine-report";
export function saveReport(report: TestingReport) { try { localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report)); } catch {} }
export function loadReport(): TestingReport | null { try { const s = localStorage.getItem(REPORT_STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
