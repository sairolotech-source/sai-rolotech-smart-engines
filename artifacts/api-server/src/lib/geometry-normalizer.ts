/**
 * geometry-normalizer.ts — P0.A Geometry Normalization Layer
 *
 * Validates and normalizes parsed DXF geometry before any downstream engine consumes it.
 * Detects: gaps, duplicates, reversed segments, open contours, CW/CCW ordering issues.
 */

import type { Segment, ProfileGeometry } from "./dxf-parser-util";

export type NormalizationSeverity = "ok" | "warning" | "error" | "blocked";

export interface GeometryIssue {
  code: string;
  severity: NormalizationSeverity;
  message: string;
  affectedIndices?: number[];
}

export interface GeometryHealth {
  isValid: boolean;
  overallSeverity: NormalizationSeverity;
  issues: GeometryIssue[];
  gapCount: number;
  duplicateCount: number;
  reversedCount: number;
  windingOrder: "CW" | "CCW" | "unknown" | "open";
  isClosedContour: boolean;
  contourBreaks: number[];
  dimensionBlocked: boolean;
  message: string;
}

const GAP_TOLERANCE = 1e-3;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

/** Signed area using the Shoelace formula — positive = CCW, negative = CW */
function computeSignedArea(segs: Segment[]): number {
  let area = 0;
  for (const s of segs) {
    area += (s.x1 * s.y2 - s.x2 * s.y1);
  }
  return area / 2;
}

/** Check if two segments are effectively the same (within tolerance) */
function areDuplicates(a: Segment, b: Segment): boolean {
  const tol = GAP_TOLERANCE;
  const fwd =
    dist(a.x1, a.y1, b.x1, b.y1) < tol &&
    dist(a.x2, a.y2, b.x2, b.y2) < tol;
  const rev =
    dist(a.x1, a.y1, b.x2, b.y2) < tol &&
    dist(a.x2, a.y2, b.x1, b.y1) < tol;
  return fwd || rev;
}

/** Detect gap between end of segment i and start of segment i+1 */
function detectGaps(segs: Segment[]): { indices: number[]; breaks: number[] } {
  const indices: number[] = [];
  const breaks: number[] = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const s1 = segs[i]!;
    const s2 = segs[i + 1]!;
    const d = dist(s1.x2, s1.y2, s2.x1, s2.y1);
    if (d > GAP_TOLERANCE) {
      indices.push(i);
      breaks.push(i + 1);
    }
  }
  return { indices, breaks };
}

/** Detect duplicate segments */
function detectDuplicates(segs: Segment[]): number[] {
  const dupIdx: number[] = [];
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (areDuplicates(segs[i]!, segs[j]!)) {
        if (!dupIdx.includes(j)) dupIdx.push(j);
      }
    }
  }
  return dupIdx;
}

/** Remove duplicate segments (keep first occurrence) */
function removeDuplicates(segs: Segment[]): { cleaned: Segment[]; removed: number } {
  const dupIdx = detectDuplicates(segs);
  const dupSet = new Set(dupIdx);
  return {
    cleaned: segs.filter((_, i) => !dupSet.has(i)),
    removed: dupIdx.length,
  };
}

/** Check if contour is closed (last segment end ≈ first segment start) */
function isContourClosed(segs: Segment[]): boolean {
  if (segs.length < 2) return false;
  const first = segs[0]!;
  const last = segs[segs.length - 1]!;
  return dist(last.x2, last.y2, first.x1, first.y1) < GAP_TOLERANCE;
}

/** Detect tiny/degenerate segments (length < threshold) */
function detectDegenerateSegments(segs: Segment[]): number[] {
  const MIN_LENGTH = 0.01;
  return segs.map((s, i) => (s.length < MIN_LENGTH ? i : -1)).filter(i => i >= 0);
}

/** Force CCW winding by reversing all segments if CW */
function forceCounterClockwise(segs: Segment[]): { reordered: Segment[]; wasReversed: boolean } {
  const area = computeSignedArea(segs);
  if (area < 0) {
    // CW — reverse the entire chain and flip each segment
    const reordered: Segment[] = [...segs].reverse().map(s => ({
      ...s,
      x1: s.x2, y1: s.y2,
      x2: s.x1, y2: s.y1,
      startAngle: s.endAngle,
      endAngle: s.startAngle,
    }));
    return { reordered, wasReversed: true };
  }
  return { reordered: segs, wasReversed: false };
}

/** Try to re-chain segments into a continuous path by matching endpoints */
function rechainSegments(segs: Segment[]): { chained: Segment[]; gapsRemaining: number } {
  if (segs.length === 0) return { chained: [], gapsRemaining: 0 };

  const used = new Array(segs.length).fill(false);
  const result: Segment[] = [segs[0]!];
  used[0] = true;

  let gapsRemaining = 0;

  for (let step = 1; step < segs.length; step++) {
    const last = result[result.length - 1]!;
    let bestIdx = -1;
    let bestDist = Infinity;

    for (let j = 0; j < segs.length; j++) {
      if (used[j]) continue;
      const s = segs[j]!;
      const dFwd = dist(last.x2, last.y2, s.x1, s.y1);
      const dRev = dist(last.x2, last.y2, s.x2, s.y2);

      if (dFwd < bestDist) { bestDist = dFwd; bestIdx = j; }
      if (dRev < bestDist) { bestDist = dRev; bestIdx = -(j + 1); }
    }

    if (bestIdx === 0 && bestDist === Infinity) break;

    if (bestIdx < 0) {
      // Need to reverse
      const j = -(bestIdx + 1);
      const s = segs[j]!;
      const reversed: Segment = {
        ...s,
        x1: s.x2, y1: s.y2,
        x2: s.x1, y2: s.y1,
        startAngle: s.endAngle,
        endAngle: s.startAngle,
      };
      result.push(reversed);
      used[j] = true;
    } else {
      result.push(segs[bestIdx]!);
      used[bestIdx] = true;
    }

    if (bestDist > GAP_TOLERANCE) gapsRemaining++;
  }

  return { chained: result, gapsRemaining };
}

/**
 * Main normalization entry point.
 * Returns cleaned geometry + health report.
 */
export function normalizeGeometry(geometry: ProfileGeometry): {
  geometry: ProfileGeometry;
  health: GeometryHealth;
} {
  const issues: GeometryIssue[] = [];
  let segs = [...geometry.segments];

  if (segs.length === 0) {
    return {
      geometry,
      health: {
        isValid: false,
        overallSeverity: "error",
        issues: [{ code: "NO_SEGMENTS", severity: "error", message: "No segments found in geometry" }],
        gapCount: 0,
        duplicateCount: 0,
        reversedCount: 0,
        windingOrder: "unknown",
        isClosedContour: false,
        contourBreaks: [],
        dimensionBlocked: true,
        message: "Geometry is empty — cannot process",
      },
    };
  }

  // 1. Remove duplicates
  const { cleaned: dedupedSegs, removed: dupCount } = removeDuplicates(segs);
  if (dupCount > 0) {
    issues.push({
      code: "DUPLICATE_SEGMENTS",
      severity: "warning",
      message: `Removed ${dupCount} duplicate segment(s)`,
    });
  }
  segs = dedupedSegs;

  // 2. Remove degenerate segments
  const degenerateIdx = detectDegenerateSegments(segs);
  if (degenerateIdx.length > 0) {
    const degSet = new Set(degenerateIdx);
    segs = segs.filter((_, i) => !degSet.has(i));
    issues.push({
      code: "DEGENERATE_SEGMENTS",
      severity: "warning",
      message: `Removed ${degenerateIdx.length} degenerate/zero-length segment(s)`,
      affectedIndices: degenerateIdx,
    });
  }

  // 3. Re-chain segments for continuity
  const { chained, gapsRemaining } = rechainSegments(segs);
  segs = chained;

  // 4. Detect gaps in re-chained result
  const { indices: gapIndices, breaks: contourBreaks } = detectGaps(segs);
  const gapCount = gapIndices.length;

  if (gapCount > 0) {
    issues.push({
      code: "OPEN_CONTOUR_GAPS",
      severity: gapCount > 2 ? "error" : "warning",
      message: `${gapCount} gap(s) detected between segments — open contour likely`,
      affectedIndices: gapIndices,
    });
  }

  // 5. Closed contour check
  const closed = isContourClosed(segs);
  if (!closed && gapCount === 0 && segs.length > 2) {
    issues.push({
      code: "OPEN_PROFILE",
      severity: "warning",
      message: "Profile is an open polyline (not closed). This is normal for roll forming profiles.",
    });
  }

  // 6. Winding order
  let windingOrder: GeometryHealth["windingOrder"] = "unknown";
  let reversedCount = 0;
  if (closed) {
    const area = computeSignedArea(segs);
    if (Math.abs(area) < 1e-6) {
      windingOrder = "unknown";
    } else if (area > 0) {
      windingOrder = "CCW";
    } else {
      windingOrder = "CW";
      const { reordered, wasReversed } = forceCounterClockwise(segs);
      if (wasReversed) {
        segs = reordered;
        reversedCount = segs.length;
        issues.push({
          code: "FORCED_CCW",
          severity: "warning",
          message: "Geometry was CW — reversed to CCW for consistent downstream processing",
        });
      }
    }
  } else {
    windingOrder = "open";
  }

  // 7. Very-small geometry sanity
  const totalLength = segs.reduce((sum, s) => sum + s.length, 0);
  if (totalLength < 1.0) {
    issues.push({
      code: "TINY_GEOMETRY",
      severity: "error",
      message: `Total profile length is ${totalLength.toFixed(3)} mm — likely a scaling issue`,
    });
  }

  // 8. Oversized geometry sanity
  const allX = segs.flatMap(s => [s.x1, s.x2]);
  const allY = segs.flatMap(s => [s.y1, s.y2]);
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const width = maxX - minX, height = maxY - minY;

  if (width > 5000 || height > 5000) {
    issues.push({
      code: "OVERSIZED_GEOMETRY",
      severity: "warning",
      message: `Profile bounding box ${width.toFixed(1)}×${height.toFixed(1)} mm seems very large — check units`,
    });
  }

  // Compute overall severity
  const severityRank: Record<NormalizationSeverity, number> = { ok: 0, warning: 1, error: 2, blocked: 3 };
  let overallSeverity: NormalizationSeverity = "ok";
  for (const issue of issues) {
    if (severityRank[issue.severity] > severityRank[overallSeverity]) {
      overallSeverity = issue.severity;
    }
  }

  const isValid = overallSeverity !== "blocked" && overallSeverity !== "error";
  const dimensionBlocked = overallSeverity === "blocked" || overallSeverity === "error";

  const normalizedGeometry: ProfileGeometry = {
    ...geometry,
    segments: segs,
    bends: geometry.bends,
    totalLength,
    boundingBox: { minX, minY, maxX, maxY, width, height },
  };

  const summary = issues.length === 0
    ? "Geometry is clean — no issues found"
    : issues.map(i => `[${i.code}] ${i.message}`).join("; ");

  return {
    geometry: normalizedGeometry,
    health: {
      isValid,
      overallSeverity,
      issues,
      gapCount,
      duplicateCount: dupCount,
      reversedCount,
      windingOrder,
      isClosedContour: closed,
      contourBreaks,
      dimensionBlocked,
      message: summary,
    },
  };
}
