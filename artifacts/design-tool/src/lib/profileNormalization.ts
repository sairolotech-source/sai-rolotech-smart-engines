/**
 * profileNormalization.ts — Sai Rolotech Smart Engines v2.2.0+
 *
 * Geometry normalization layer.
 * Called AFTER DXF import and BEFORE flower / roll-tooling generation.
 *
 * Rules by profileSourceType:
 *  centerline   → no offset — profile IS the neutral axis (or expand ±t/2 via convertCenterLineToSheet)
 *  inner_face   → offset all segments outward (away from concave side) by `thickness`
 *  outer_face   → offset all segments inward (toward concave side) by `thickness`
 *  sheet_profile→ no offset — profile is already full-sheet; use directly
 *  null         → no offset — pass through unchanged (caller should warn user)
 */

import type { Segment, ProfileGeometry } from "../store/useCncStore";
import type { ProfileSourceType } from "./engineContract";

// ─── Offset helpers ───────────────────────────────────────────────────────────

function segDir(seg: Segment) {
  const dx = (seg.endX ?? 0) - (seg.startX ?? 0);
  const dy = (seg.endY ?? 0) - (seg.startY ?? 0);
  const len = Math.hypot(dx, dy);
  return { dx, dy, len };
}

function offsetSegment(seg: Segment, dist: number): Segment {
  const { dx, dy, len } = segDir(seg);
  if (len < 1e-9) return { ...seg };
  const nx = -dy / len;
  const ny =  dx / len;
  return {
    ...seg,
    startX: (seg.startX ?? 0) + nx * dist,
    startY: (seg.startY ?? 0) + ny * dist,
    endX:   (seg.endX   ?? 0) + nx * dist,
    endY:   (seg.endY   ?? 0) + ny * dist,
  };
}

/**
 * Compute the dominant "inside" normal for a polyline chain.
 * For roll-forming profiles, inner face is typically on the concave side.
 * Returns +1 if offset should be in normal direction, -1 if reversed.
 */
function dominantOffsetSign(segments: Segment[]): number {
  // Signed area of the polyline: positive → CCW (normal points left = outward)
  let area = 0;
  for (const seg of segments) {
    const x1 = seg.startX ?? 0, y1 = seg.startY ?? 0;
    const x2 = seg.endX   ?? 0, y2 = seg.endY   ?? 0;
    area += (x1 * y2 - x2 * y1);
  }
  // CCW → signed area > 0 → perpendicular normal (−dy, dx) points outward → use +1
  return area >= 0 ? 1 : -1;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface NormalizationResult {
  geometry: ProfileGeometry;
  wasOffsetApplied: boolean;
  offsetDistanceMm: number;
  offsetDirection: "none" | "outward" | "inward";
  profileSourceType: ProfileSourceType;
  warning?: string;
}

/**
 * Apply profile-source offset to a geometry.
 * Returns a NEW geometry object (does not mutate).
 */
export function applyProfileSourceOffset(
  geometry: ProfileGeometry,
  profileSourceType: ProfileSourceType,
  thickness: number
): NormalizationResult {
  const segs = geometry.segments ?? [];

  // No-op cases
  if (!segs.length) {
    return {
      geometry,
      wasOffsetApplied: false,
      offsetDistanceMm: 0,
      offsetDirection: "none",
      profileSourceType,
      warning: "No segments — cannot apply offset",
    };
  }

  if (profileSourceType === "centerline" || profileSourceType === "sheet_profile" || profileSourceType === null) {
    return {
      geometry,
      wasOffsetApplied: false,
      offsetDistanceMm: 0,
      offsetDirection: "none",
      profileSourceType,
      warning: profileSourceType === null ? "Profile source type not set — no offset applied; set source type before generating" : undefined,
    };
  }

  // Determine offset distance and direction
  const sign = dominantOffsetSign(segs);
  let dist: number;
  let dir: "outward" | "inward";

  if (profileSourceType === "inner_face") {
    // Inner face → offset outward by full thickness to get the neutral axis at t/2
    // For strip-width / flower calculation we want the center, so offset by t/2
    dist = sign * (thickness / 2);
    dir = "outward";
  } else {
    // outer_face → offset inward by t/2
    dist = -sign * (thickness / 2);
    dir = "inward";
  }

  const normalizedSegments = segs.map(seg => offsetSegment(seg, dist));

  return {
    geometry: {
      ...geometry,
      segments: normalizedSegments,
    },
    wasOffsetApplied: true,
    offsetDistanceMm: Math.abs(dist),
    offsetDirection: dir,
    profileSourceType,
  };
}

/**
 * Quick helper: returns the geometry to use for flower/roll generation.
 * If profileSourceType is inner_face or outer_face, applies the offset.
 * Otherwise returns geometry unchanged.
 *
 * This is the single entry point to call before any engine generation.
 */
export function resolveGeometryForEngine(
  geometry: ProfileGeometry,
  profileSourceType: ProfileSourceType,
  thickness: number
): ProfileGeometry {
  const result = applyProfileSourceOffset(geometry, profileSourceType, thickness);
  return result.geometry;
}
