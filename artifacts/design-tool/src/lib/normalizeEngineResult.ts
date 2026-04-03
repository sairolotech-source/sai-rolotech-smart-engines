/**
 * SAI Rolotech — Normalization Layer
 * Strict data contract for all pipeline outputs.
 * Every UI component must consume only data through this normalizer.
 */

export interface NormalizedGeometry {
  segments: NormalizedSegment[];
  bendPoints: NormalizedBendPoint[];
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface NormalizedSegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
}

export interface NormalizedBendPoint {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface NormalizedStation {
  stationIndex: number;
  name: string;
  bendAngles: number[];
  segmentLengths: number[];
  springbackAngles: number[];
  totalAngle: number;
}

export interface NormalizedPipelineResult {
  stripWidth: number;
  developedLength: number;
  dimensions: unknown[];
  bends: unknown[];
  angles: number[];
  material: { type: string; thickness: number; kFactor: number };
  thickness: number;
  profileSegments: NormalizedSegment[];
  warnings: string[];
  errors: string[];
}

/** Make any raw geometry object safe for rendering. */
export function normalizeGeometry(raw: unknown): NormalizedGeometry {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawSegs = Array.isArray(r.segments) ? r.segments : [];
  const rawBPs = Array.isArray(r.bendPoints) ? r.bendPoints : [];
  const bb = (r.boundingBox ?? {}) as Record<string, number>;

  const segments: NormalizedSegment[] = rawSegs.map((s: unknown) => {
    const seg = (s ?? {}) as Record<string, number>;
    const sX = seg.startX ?? seg.x1 ?? 0;
    const sY = seg.startY ?? seg.y1 ?? 0;
    const eX = seg.endX ?? seg.x2 ?? 0;
    const eY = seg.endY ?? seg.y2 ?? 0;
    return {
      startX: sX,
      startY: sY,
      endX: eX,
      endY: eY,
      length: seg.length ?? Math.hypot(eX - sX, eY - sY),
    };
  });

  const bendPoints: NormalizedBendPoint[] = rawBPs.map((b: unknown) => {
    const bp = (b ?? {}) as Record<string, number>;
    return {
      x: bp.x ?? 0,
      y: bp.y ?? 0,
      angle: bp.angle ?? 0,
      radius: bp.radius ?? 0,
    };
  });

  return {
    segments,
    bendPoints,
    boundingBox: {
      minX: bb.minX ?? 0,
      minY: bb.minY ?? 0,
      maxX: bb.maxX ?? 0,
      maxY: bb.maxY ?? 0,
    },
  };
}

/** Make any raw station object safe. */
export function normalizeStation(raw: unknown): NormalizedStation {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    stationIndex: typeof r.stationIndex === "number" ? r.stationIndex : 0,
    name: typeof r.name === "string" ? r.name : "S0",
    bendAngles: Array.isArray(r.bendAngles) ? r.bendAngles.map(Number) : [],
    segmentLengths: Array.isArray(r.segmentLengths) ? r.segmentLengths.map(Number) : [],
    springbackAngles: Array.isArray(r.springbackAngles) ? r.springbackAngles.map(Number) : [],
    totalAngle: typeof r.totalAngle === "number" ? r.totalAngle : 0,
  };
}

/** Normalize the full pipeline result from any engine output. */
export function normalizePipelineResult(raw: unknown): NormalizedPipelineResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const geo = normalizeGeometry(r.geometry);
  return {
    stripWidth: typeof r.stripWidth === "number" && !isNaN(r.stripWidth) ? r.stripWidth : 0,
    developedLength: typeof r.developedLength === "number" && !isNaN(r.developedLength) ? r.developedLength : 0,
    dimensions: Array.isArray(r.dimensions) ? r.dimensions : [],
    bends: Array.isArray(r.bends) ? r.bends : [],
    angles: Array.isArray(r.angles) ? r.angles.map(Number) : [],
    material: {
      type: typeof (r.material as Record<string, unknown>)?.type === "string" ? (r.material as Record<string, string>).type : "GI",
      thickness: typeof (r.material as Record<string, unknown>)?.thickness === "number" ? (r.material as Record<string, number>).thickness : 0,
      kFactor: typeof (r.material as Record<string, unknown>)?.kFactor === "number" ? (r.material as Record<string, number>).kFactor : 0.44,
    },
    thickness: typeof r.thickness === "number" && !isNaN(r.thickness) ? r.thickness : 0,
    profileSegments: geo.segments,
    warnings: Array.isArray(r.warnings) ? r.warnings.map(String) : [],
    errors: Array.isArray(r.errors) ? r.errors.map(String) : [],
  };
}

/** Safe number helper — returns 0 for NaN/null/undefined. */
export function safeNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

/** Safe array helper — returns [] for non-array values. */
export function safeArr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
