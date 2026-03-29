/**
 * SAI Rolotech — Center Line → Sheet Profile Converter
 *
 * Takes a raw center-line polyline (segments[]) and offsets it
 * by ±thickness to produce a full closed sheet-profile geometry
 * with proper corner miters and end caps.
 */

import type { Segment, BendPoint, ProfileGeometry } from "../store/useCncStore";

export type OffsetMode = "both" | "inside" | "outside";

export interface ConversionInput {
  segments: Segment[];
  thickness: number;
  offsetMode: OffsetMode;
  bendRadius?: number;   // default = thickness * 1.0
  kFactor?: number;      // default = 0.44
}

export interface ConversionResult {
  geometry: ProfileGeometry;
  developedLength: number;
  bendCount: number;
  warnings: string[];
}

// ─── Vector helpers ───────────────────────────────────────────────────────────

function segDir(seg: Segment): { dx: number; dy: number; len: number } {
  const dx = (seg.endX ?? 0) - (seg.startX ?? 0);
  const dy = (seg.endY ?? 0) - (seg.startY ?? 0);
  const len = Math.hypot(dx, dy);
  return { dx, dy, len };
}

function perpNormal(dx: number, dy: number, len: number): { nx: number; ny: number } {
  if (len < 1e-9) return { nx: 0, ny: 1 };
  return { nx: -dy / len, ny: dx / len };
}

/** Offset a single segment perpendicular by `dist`. */
function offsetSeg(seg: Segment, dist: number): Segment {
  const { dx, dy, len } = segDir(seg);
  const { nx, ny } = perpNormal(dx, dy, len);
  return {
    type: "line",
    startX: (seg.startX ?? 0) + nx * dist,
    startY: (seg.startY ?? 0) + ny * dist,
    endX: (seg.endX ?? 0) + nx * dist,
    endY: (seg.endY ?? 0) + ny * dist,
  };
}

/** Find the intersection point of two infinite lines defined by two segments. */
function lineIntersect(
  a1x: number, a1y: number, a2x: number, a2y: number,
  b1x: number, b1y: number, b2x: number, b2y: number
): { x: number; y: number } | null {
  const dax = a2x - a1x, day = a2y - a1y;
  const dbx = b2x - b1x, dby = b2y - b1y;
  const denom = dax * dby - day * dbx;
  if (Math.abs(denom) < 1e-9) return null; // parallel
  const t = ((b1x - a1x) * dby - (b1y - a1y) * dbx) / denom;
  return { x: a1x + t * dax, y: a1y + t * day };
}

// ─── Core converter ──────────────────────────────────────────────────────────

export function convertCenterLineToSheet(input: ConversionInput): ConversionResult {
  const { segments: rawSegs, thickness, offsetMode } = input;
  const warnings: string[] = [];

  const segs = rawSegs.filter(s => {
    const { len } = segDir(s);
    return len > 0.001;
  });

  if (segs.length === 0) {
    warnings.push("No valid segments found in center-line geometry.");
    return {
      geometry: { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } },
      developedLength: 0,
      bendCount: 0,
      warnings,
    };
  }

  // Determine offsets
  let outerDist: number;
  let innerDist: number;
  if (offsetMode === "both") {
    outerDist = thickness / 2;
    innerDist = -thickness / 2;
  } else if (offsetMode === "outside") {
    outerDist = thickness;
    innerDist = 0;
  } else {
    // inside
    outerDist = 0;
    innerDist = -thickness;
  }

  // Build outer and inner offset chains
  const outerRaw = segs.map(s => offsetSeg(s, outerDist));
  const innerRaw = segs.map(s => offsetSeg(s, innerDist));

  // Miter-join adjacent offset segments (correct corners)
  function miterChain(chain: Segment[]): Segment[] {
    if (chain.length === 0) return [];
    if (chain.length === 1) return [...chain];

    const result: Segment[] = [];
    for (let i = 0; i < chain.length; i++) {
      const cur = { ...chain[i] };
      if (i > 0) {
        const prev = result[result.length - 1];
        const pt = lineIntersect(
          prev.startX, prev.startY, prev.endX, prev.endY,
          cur.startX, cur.startY, cur.endX, cur.endY
        );
        if (pt) {
          prev.endX = pt.x;
          prev.endY = pt.y;
          cur.startX = pt.x;
          cur.startY = pt.y;
        } else {
          cur.startX = prev.endX;
          cur.startY = prev.endY;
        }
      }
      result.push(cur);
    }
    return result;
  }

  const outer = miterChain(outerRaw);
  const inner = miterChain(innerRaw);

  // Build full closed profile: outer → (right cap) → reversed inner → (left cap)
  const allSegs: Segment[] = [];

  // Outer wall (start to end)
  for (const s of outer) allSegs.push(s);

  // Right end cap: outer end → inner end
  allSegs.push({
    type: "line",
    startX: outer[outer.length - 1].endX,
    startY: outer[outer.length - 1].endY,
    endX: inner[inner.length - 1].endX,
    endY: inner[inner.length - 1].endY,
  });

  // Inner wall (end to start — reversed)
  for (let i = inner.length - 1; i >= 0; i--) {
    allSegs.push({
      type: "line",
      startX: inner[i].endX,
      startY: inner[i].endY,
      endX: inner[i].startX,
      endY: inner[i].startY,
    });
  }

  // Left end cap: inner start → outer start
  allSegs.push({
    type: "line",
    startX: inner[0].startX,
    startY: inner[0].startY,
    endX: outer[0].startX,
    endY: outer[0].startY,
  });

  // ── Compute bounding box ────────────────────────────────────────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of allSegs) {
    minX = Math.min(minX, s.startX, s.endX);
    minY = Math.min(minY, s.startY, s.endY);
    maxX = Math.max(maxX, s.startX, s.endX);
    maxY = Math.max(maxY, s.startY, s.endY);
  }

  // ── Extract bend points from center-line corners ──────────────────────────
  const bendPoints: BendPoint[] = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const cur = segs[i];
    const nxt = segs[i + 1];
    const d1 = segDir(cur);
    const d2 = segDir(nxt);
    if (d1.len < 1e-9 || d2.len < 1e-9) continue;

    const dot = (d1.dx * d2.dx + d1.dy * d2.dy) / (d1.len * d2.len);
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const angleDeg = Math.acos(clampedDot) * (180 / Math.PI);

    if (angleDeg > 1.0) {
      bendPoints.push({
        x: cur.endX,
        y: cur.endY,
        angle: angleDeg,
        radius: input.bendRadius ?? thickness,
        segmentIndex: i,
      });
    }
  }

  // ── Developed length (flat strip width) ───────────────────────────────────
  const kFactor = input.kFactor ?? 0.44;
  let developedLength = 0;
  for (const s of segs) {
    developedLength += segDir(s).len;
  }
  for (const bp of bendPoints) {
    const r = bp.radius;
    const anglRad = (bp.angle * Math.PI) / 180;
    const bendAllowance = anglRad * (r + kFactor * thickness);
    const bendDeduction = 2 * (r + thickness) * Math.tan(anglRad / 2) - bendAllowance;
    developedLength -= bendDeduction;
  }
  developedLength = Math.max(0, developedLength);

  return {
    geometry: {
      segments: allSegs,
      bendPoints,
      boundingBox: { minX, minY, maxX, maxY },
    },
    developedLength,
    bendCount: bendPoints.length,
    warnings,
  };
}

/** Detect if a geometry looks like a center-line (thin single chain) or a sheet profile. */
export function detectProfileSourceType(segments: Segment[]): "centerline" | "sheetProfile" | "unknown" {
  if (!segments || segments.length === 0) return "unknown";

  // Compute bounding box aspect — center lines tend to be much longer than wide
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let totalLen = 0;
  for (const s of segments) {
    const { len } = segDir(s);
    totalLen += len;
    minX = Math.min(minX, s.startX ?? 0, s.endX ?? 0);
    minY = Math.min(minY, s.startY ?? 0, s.endY ?? 0);
    maxX = Math.max(maxX, s.startX ?? 0, s.endX ?? 0);
    maxY = Math.max(maxY, s.startY ?? 0, s.endY ?? 0);
  }

  const bbW = maxX - minX;
  const bbH = maxY - minY;

  // Check if the geometry is "closed" — first start matches last end
  const first = segments[0];
  const last = segments[segments.length - 1];
  const isClosed =
    Math.hypot(
      (first.startX ?? 0) - (last.endX ?? 0),
      (first.startY ?? 0) - (last.endY ?? 0)
    ) < 2.0;

  // A closed profile with decent area is likely already a sheet profile
  const area = bbW * bbH;
  if (isClosed && area > 100) return "sheetProfile";

  // A single open chain with high aspect ratio → likely center line
  const aspect = Math.max(bbW, bbH) / (Math.min(bbW, bbH) || 1);
  if (!isClosed && aspect > 2.0) return "centerline";

  // Small segment count open chain
  if (!isClosed && segments.length <= 12) return "centerline";

  return "sheetProfile";
}
