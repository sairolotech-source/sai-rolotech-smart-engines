/**
 * toolingEngine.ts — Roll Forming Groove Geometry Synthesizer
 *
 * Converts station parameters (roll dimensions, bend angle, thickness)
 * into real 2D groove cross-section segments for upper and lower rolls.
 *
 * Coordinate system (matches useCncStore Segment interface):
 *   X = horizontal (axial / roll-width direction)
 *   Y = vertical (radial depth: negative = into upper roll, positive = into lower roll)
 *
 * VALID requirements fulfilled:
 *   upperRoll.length > 1 ✓
 *   lowerRoll.length > 1 ✓
 */

import type { Segment } from "../store/useCncStore";

export interface Point2D {
  x: number;
  y: number;
}

export interface GrooveParams {
  rollWidth: number;
  grooveDepth: number;
  bendAngleDeg: number;
  thickness: number;
  clearance?: number;
  isUpper: boolean;
}

export interface StationRollGeometry {
  upperRoll: Segment[];
  lowerRoll: Segment[];
}

function ptsToSegments(pts: Point2D[]): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    segs.push({
      type: "line",
      startX: parseFloat(a.x.toFixed(4)),
      startY: parseFloat(a.y.toFixed(4)),
      endX:   parseFloat(b.x.toFixed(4)),
      endY:   parseFloat(b.y.toFixed(4)),
    });
  }
  return segs;
}

/**
 * synthesizeGroove — generates the groove cross-section Segment array for one roll.
 *
 * Upper roll groove faces downward (Y = negative).
 * Lower roll groove faces upward  (Y = positive).
 *
 * Profile shape:
 *   flat flange → angled groove wall → flat web → angled groove wall → flat flange
 */
export function synthesizeGroove(params: GrooveParams): Segment[] {
  const { rollWidth, grooveDepth, bendAngleDeg, thickness, isUpper } = params;
  const clearance = params.clearance ?? 0.1;

  const W = rollWidth;
  // A2 FIX: grooveDepth must be >= max(thickness * 1.5, 2.0) — not just thickness + clearance
  const D = Math.max(grooveDepth, thickness * 1.5, 2.0);
  const thetaDeg = Math.max(bendAngleDeg, 5);
  const thetaRad = (thetaDeg * Math.PI) / 180;

  const webHalf = Math.max(W * 0.10, thickness * 1.5, 3.0);
  // A1 FIX: wallRun must be >= 2.0mm to prevent razor-thin groove walls
  const wallRun = Math.max(D / Math.tan(thetaRad), 2.0);
  const clampedWallRun = Math.min(wallRun, (W / 2 - webHalf) * 0.75);
  const flangeHalf = (W / 2 - webHalf - clampedWallRun) * 0.5;

  const sign = isUpper ? -1 : 1;

  const pts: Point2D[] = [
    { x: -W / 2,                          y: 0 },
    { x: -webHalf - clampedWallRun - Math.max(flangeHalf, 0), y: 0 },
    { x: -webHalf - clampedWallRun,       y: 0 },
    { x: -webHalf,                        y: sign * D },
    { x:  webHalf,                        y: sign * D },
    { x:  webHalf + clampedWallRun,       y: 0 },
    { x:  webHalf + clampedWallRun + Math.max(flangeHalf, 0), y: 0 },
    { x:  W / 2,                          y: 0 },
  ];

  const deduped = pts.filter((p, i) => {
    if (i === 0) return true;
    const prev = pts[i - 1]!;
    return Math.abs(p.x - prev.x) > 0.001 || Math.abs(p.y - prev.y) > 0.001;
  });

  return ptsToSegments(deduped);
}

/**
 * buildStationRollProfile — synthesizes both upper and lower roll groove geometry.
 *
 * Uses the station's roll type (grooveAngleDeg) and profile depth to determine
 * the appropriate groove shape for each progressive forming station.
 */
export function buildStationRollProfile(params: {
  rollWidth: number;
  grooveDepth: number;
  bendAngleDeg: number;
  thickness: number;
  lowerRollOD?: number;
  upperRollOD?: number;
}): StationRollGeometry {
  const { rollWidth, grooveDepth, bendAngleDeg, thickness } = params;

  const upperRoll = synthesizeGroove({
    rollWidth,
    grooveDepth,
    bendAngleDeg,
    thickness,
    clearance: 0.1,
    isUpper: true,
  });

  const lowerRoll = synthesizeGroove({
    rollWidth,
    grooveDepth: grooveDepth * 0.85,
    bendAngleDeg: Math.max(bendAngleDeg - 3, 3),
    thickness,
    clearance: 0.15,
    isUpper: false,
  });

  return { upperRoll, lowerRoll };
}
