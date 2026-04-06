import type { BendInfo, ProfileGeometry, Segment } from "./dxf-parser-util.js";
import { normalizeGeometry, type GeometryHealth } from "./geometry-normalizer.js";

export interface ProfilePoint {
  x: number;
  y: number;
}

export interface ProfileLineSegmentInput {
  type: "line";
  start: ProfilePoint;
  end: ProfilePoint;
}

export interface ProfileArcSegmentInput {
  type: "arc";
  start: ProfilePoint;
  end: ProfilePoint;
  center: ProfilePoint;
}

export type ProfileSegmentInput = ProfileLineSegmentInput | ProfileArcSegmentInput;

export interface ProfileSchemaInput {
  thickness: number;
  segments: ProfileSegmentInput[];
}

export type NormalizedProfileSegment =
  | {
      type: "line";
      start: ProfilePoint;
      end: ProfilePoint;
      length: number;
    }
  | {
      type: "arc";
      start: ProfilePoint;
      end: ProfilePoint;
      center: ProfilePoint;
      radius: number;
      sweepAngleDeg: number;
      length: number;
    };

export interface NormalizedBendPoint {
  index: number;
  angleDeg: number;
  radiusMm: number;
  side: BendInfo["side"];
  direction: BendInfo["direction"];
}

export interface NormalizedProfileJson {
  schemaVersion: "phase1.profile.v1";
  source: "manual" | "dxf";
  thickness: number;
  segments: NormalizedProfileSegment[];
  bendPoints: NormalizedBendPoint[];
  totalLength: number;
  boundingBox: ProfileGeometry["boundingBox"];
  geometry: ProfileGeometry;
}

export interface NormalizeProfileResult {
  profile: NormalizedProfileJson;
  health: GeometryHealth;
  warnings: string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (!isFiniteNumber(value)) {
    throw new Error(`Invalid number at ${field}`);
  }
  return value;
}

function distance(a: ProfilePoint, b: ProfilePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeSweepRad(startRad: number, endRad: number): number {
  let delta = endRad - startRad;
  if (delta <= 0) delta += Math.PI * 2;
  return delta;
}

function createSegmentFromInput(
  input: ProfileSegmentInput,
  index: number,
  warnings: string[],
): Segment {
  if (input.type === "line") {
    const x1 = requireFiniteNumber(input.start.x, `segments[${index}].start.x`);
    const y1 = requireFiniteNumber(input.start.y, `segments[${index}].start.y`);
    const x2 = requireFiniteNumber(input.end.x, `segments[${index}].end.x`);
    const y2 = requireFiniteNumber(input.end.y, `segments[${index}].end.y`);
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length <= 0.0001) {
      warnings.push(`segments[${index}] line has near-zero length`);
    }
    return { type: "line", x1, y1, x2, y2, length };
  }

  const x1 = requireFiniteNumber(input.start.x, `segments[${index}].start.x`);
  const y1 = requireFiniteNumber(input.start.y, `segments[${index}].start.y`);
  const x2 = requireFiniteNumber(input.end.x, `segments[${index}].end.x`);
  const y2 = requireFiniteNumber(input.end.y, `segments[${index}].end.y`);
  const cx = requireFiniteNumber(input.center.x, `segments[${index}].center.x`);
  const cy = requireFiniteNumber(input.center.y, `segments[${index}].center.y`);

  const rs = distance({ x: x1, y: y1 }, { x: cx, y: cy });
  const re = distance({ x: x2, y: y2 }, { x: cx, y: cy });
  const radius = (rs + re) / 2;
  if (Math.abs(rs - re) > 0.2) {
    warnings.push(`segments[${index}] arc endpoints are not equidistant from center`);
  }
  if (radius <= 0.0001) {
    warnings.push(`segments[${index}] arc has invalid radius`);
  }

  const startRad = Math.atan2(y1 - cy, x1 - cx);
  const endRad = Math.atan2(y2 - cy, x2 - cx);
  let sweepRad = normalizeSweepRad(startRad, endRad);
  if (Math.abs(sweepRad) < 1e-6) {
    sweepRad = Math.PI * 2;
    warnings.push(`segments[${index}] arc interpreted as full circle`);
  }

  const length = Math.abs(radius * sweepRad);

  return {
    type: "arc",
    x1,
    y1,
    x2,
    y2,
    cx,
    cy,
    radius,
    startAngle: toDeg(startRad),
    endAngle: toDeg(startRad + sweepRad),
    length,
  };
}

function detectBendsFromSegments(segments: Segment[]): BendInfo[] {
  const bends: BendInfo[] = [];

  for (let index = 0; index < segments.length; index++) {
    const current = segments[index];
    if (!current) continue;

    if (current.type === "arc") {
      const start = current.startAngle ?? 0;
      const end = current.endAngle ?? start;
      let sweep = end - start;
      if (sweep < 0) sweep += 360;
      if (sweep > 0.5) {
        bends.push({
          angle: parseFloat(sweep.toFixed(3)),
          radius: current.radius ?? 0,
          segmentIndex: index,
          side: "left",
          direction: "up",
        });
      }
      continue;
    }

    if (index >= segments.length - 1) continue;
    const next = segments[index + 1];
    if (!next || next.type !== "line") continue;

    const v1x = current.x2 - current.x1;
    const v1y = current.y2 - current.y1;
    const v2x = next.x2 - next.x1;
    const v2y = next.y2 - next.y1;
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    if (mag1 < 1e-6 || mag2 < 1e-6) continue;

    const dot = (v1x * v2x + v1y * v2y) / (mag1 * mag2);
    const angle = toDeg(Math.acos(clamp(dot, -1, 1)));
    if (angle <= 1) continue;

    const cross = v1x * v2y - v1y * v2x;
    bends.push({
      angle: parseFloat(angle.toFixed(3)),
      radius: 1.5,
      segmentIndex: index,
      side: cross >= 0 ? "left" : "right",
      direction: cross >= 0 ? "up" : "down",
    });
  }

  return bends;
}

function computeBoundingBox(segments: Segment[]): ProfileGeometry["boundingBox"] {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const segment of segments) {
    xs.push(segment.x1, segment.x2);
    ys.push(segment.y1, segment.y2);
    if (segment.type === "arc" && isFiniteNumber(segment.cx) && isFiniteNumber(segment.cy) && isFiniteNumber(segment.radius)) {
      xs.push(segment.cx - segment.radius, segment.cx + segment.radius);
      ys.push(segment.cy - segment.radius, segment.cy + segment.radius);
    }
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function buildNormalizedProfile(
  geometry: ProfileGeometry,
  thickness: number,
  source: "manual" | "dxf",
): NormalizedProfileJson {
  const segments: NormalizedProfileSegment[] = geometry.segments.map((segment) => {
    if (segment.type === "line") {
      return {
        type: "line",
        start: { x: segment.x1, y: segment.y1 },
        end: { x: segment.x2, y: segment.y2 },
        length: parseFloat(segment.length.toFixed(4)),
      };
    }

    const start = segment.startAngle ?? 0;
    const end = segment.endAngle ?? start;
    let sweep = end - start;
    if (sweep < 0) sweep += 360;

    return {
      type: "arc",
      start: { x: segment.x1, y: segment.y1 },
      end: { x: segment.x2, y: segment.y2 },
      center: { x: segment.cx ?? 0, y: segment.cy ?? 0 },
      radius: parseFloat((segment.radius ?? 0).toFixed(4)),
      sweepAngleDeg: parseFloat(sweep.toFixed(4)),
      length: parseFloat(segment.length.toFixed(4)),
    };
  });

  const bendPoints: NormalizedBendPoint[] = geometry.bends.map((bend, index) => ({
    index,
    angleDeg: parseFloat(bend.angle.toFixed(4)),
    radiusMm: parseFloat(bend.radius.toFixed(4)),
    side: bend.side,
    direction: bend.direction,
  }));

  return {
    schemaVersion: "phase1.profile.v1",
    source,
    thickness,
    segments,
    bendPoints,
    totalLength: parseFloat(geometry.totalLength.toFixed(4)),
    boundingBox: geometry.boundingBox,
    geometry,
  };
}

function normalizeFromGeometry(
  geometry: ProfileGeometry,
  thickness: number,
  source: "manual" | "dxf",
): NormalizeProfileResult {
  const { geometry: normalizedGeometry, health } = normalizeGeometry(geometry);
  const profile = buildNormalizedProfile(normalizedGeometry, thickness, source);
  return { profile, health, warnings: [] };
}

export function normalizeProfileInput(input: ProfileSchemaInput): NormalizeProfileResult {
  if (!Array.isArray(input.segments) || input.segments.length === 0) {
    throw new Error("segments[] is required");
  }

  const thickness = requireFiniteNumber(input.thickness, "thickness");
  if (thickness <= 0) {
    throw new Error("thickness must be > 0");
  }

  const warnings: string[] = [];
  const segments = input.segments.map((segment, index) => createSegmentFromInput(segment, index, warnings));
  const bends = detectBendsFromSegments(segments);
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const boundingBox = computeBoundingBox(segments);

  const geometry: ProfileGeometry = {
    segments,
    bends,
    totalLength,
    boundingBox,
  };

  const normalized = normalizeFromGeometry(geometry, thickness, "manual");
  return { ...normalized, warnings: [...warnings, ...normalized.warnings] };
}

export function normalizeProfileGeometryInput(
  geometry: ProfileGeometry,
  thickness: number,
): NormalizeProfileResult {
  const t = Number.isFinite(thickness) && thickness > 0 ? thickness : 1.0;
  return normalizeFromGeometry(geometry, t, "dxf");
}
