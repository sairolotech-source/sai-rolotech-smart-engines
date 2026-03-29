/**
 * geometry-dimension-engine.ts — P0.C Auto-Dimension Engine
 *
 * Extracts engineering dimensions from normalized geometry:
 *   - Straight segment lengths + bearings
 *   - Bend angles, inside/center/outside radii
 *   - Profile overall width and height
 *   - Cumulative strip width (flat blank development)
 *   - Flange lengths, web length
 *   - Auto-labels for canvas overlay
 */

import type { Segment, BendInfo, ProfileGeometry } from "./dxf-parser-util";

export interface SegmentDimension {
  index: number;
  type: "line" | "arc";
  length: number;
  angle?: number;
  bendAngleDeg?: number;
  insideRadius?: number;
  centerRadius?: number;
  outsideRadius?: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label: string;
  role: "web" | "flange" | "lip" | "bend" | "unknown";
}

export interface ProfileDimensions {
  overallWidth: number;
  overallHeight: number;
  totalLength: number;
  stripWidth: number;
  webLength: number;
  flanges: { side: "left" | "right" | "top" | "bottom"; length: number }[];
  lips: { length: number; angle: number }[];
  bends: {
    index: number;
    angle: number;
    insideRadius: number;
    centerRadius: number;
    outsideRadius: number;
    direction: "up" | "down";
    side: "left" | "right";
    x: number;
    y: number;
  }[];
  segments: SegmentDimension[];
  labels: {
    x: number;
    y: number;
    text: string;
    type: "dimension" | "angle" | "radius" | "length" | "info";
  }[];
  blocked: boolean;
  blockReason?: string;
}

function segAngle(s: Segment): number {
  return (Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI;
}

function midpoint(x1: number, y1: number, x2: number, y2: number) {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

function classifySegmentRole(
  seg: Segment,
  index: number,
  bends: BendInfo[],
  totalLength: number,
): SegmentDimension["role"] {
  // Is this segment an arc → it's a bend
  if (seg.type === "arc") return "bend";

  const isBendAdjacent = bends.some(b => Math.abs(b.segmentIndex - index) <= 1);
  if (isBendAdjacent) return "flange";

  // Short segments near extremes → lip
  if (seg.length < totalLength * 0.1) return "lip";

  // Long segment → web
  if (seg.length > totalLength * 0.25) return "web";

  return "flange";
}

export function extractDimensions(
  geometry: ProfileGeometry,
  thickness: number = 0,
): ProfileDimensions {
  const { segments, bends, totalLength, boundingBox } = geometry;

  if (!segments || segments.length === 0) {
    return {
      overallWidth: 0,
      overallHeight: 0,
      totalLength: 0,
      stripWidth: 0,
      webLength: 0,
      flanges: [],
      lips: [],
      bends: [],
      segments: [],
      labels: [],
      blocked: true,
      blockReason: "No segments in geometry",
    };
  }

  // --- Segment dimensions ---
  const segDims: SegmentDimension[] = segments.map((s, i) => {
    const role = classifySegmentRole(s, i, bends, totalLength);
    const angle = segAngle(s);

    const dim: SegmentDimension = {
      index: i,
      type: s.type,
      length: parseFloat(s.length.toFixed(3)),
      startX: s.x1,
      startY: s.y1,
      endX: s.x2,
      endY: s.y2,
      role,
      label: "",
    };

    if (s.type === "arc") {
      const insideR = Math.max(0, (s.radius ?? 0) - thickness / 2);
      const centerR = s.radius ?? 0;
      const outsideR = centerR + thickness / 2;
      let arcAngle = (s.endAngle ?? 0) - (s.startAngle ?? 0);
      if (arcAngle < 0) arcAngle += 360;
      dim.bendAngleDeg = parseFloat(arcAngle.toFixed(2));
      dim.insideRadius = parseFloat(insideR.toFixed(3));
      dim.centerRadius = parseFloat(centerR.toFixed(3));
      dim.outsideRadius = parseFloat(outsideR.toFixed(3));
      dim.label = `R${centerR.toFixed(1)} / ${arcAngle.toFixed(0)}°`;
    } else {
      dim.angle = parseFloat(angle.toFixed(2));
      dim.label = `${s.length.toFixed(1)} mm`;
    }

    return dim;
  });

  // --- Bend dimensions ---
  const bendDims = bends.map((b, idx) => {
    const seg = segments[b.segmentIndex];
    const x = seg ? (seg.x1 + seg.x2) / 2 : 0;
    const y = seg ? (seg.y1 + seg.y2) / 2 : 0;
    const t = thickness || 1.5;
    return {
      index: idx,
      angle: parseFloat(b.angle.toFixed(2)),
      insideRadius: parseFloat(Math.max(0, b.radius - t / 2).toFixed(3)),
      centerRadius: parseFloat(b.radius.toFixed(3)),
      outsideRadius: parseFloat((b.radius + t / 2).toFixed(3)),
      direction: b.direction,
      side: b.side,
      x,
      y,
    };
  });

  // --- Strip width (flat blank development length) ---
  // For each bend: add bend allowance = π × insideRadius × angle/180
  let stripWidth = 0;
  for (const seg of segments) {
    if (seg.type === "line") {
      stripWidth += seg.length;
    } else if (seg.type === "arc") {
      // Bend allowance at midplane (neutral axis ≈ t/2 from inside)
      const neutralR = Math.max(0.5, (seg.radius ?? 2) - thickness / 2) + thickness * 0.45;
      let arcAngle = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
      if (arcAngle < 0) arcAngle += 360;
      stripWidth += (Math.PI * neutralR * arcAngle) / 180;
    }
  }

  // --- Web, flanges, lips ---
  const webSegs = segDims.filter(s => s.role === "web");
  const webLength = webSegs.reduce((sum, s) => sum + s.length, 0);

  const flangeSegs = segDims.filter(s => s.role === "flange");
  const leftFlanges = flangeSegs.filter(s => s.startX <= boundingBox.minX + boundingBox.width * 0.3);
  const rightFlanges = flangeSegs.filter(s => s.startX >= boundingBox.minX + boundingBox.width * 0.7);
  const topFlanges = flangeSegs.filter(s => s.startY >= boundingBox.minY + boundingBox.height * 0.7);
  const botFlanges = flangeSegs.filter(s => s.startY <= boundingBox.minY + boundingBox.height * 0.3);

  const flanges: ProfileDimensions["flanges"] = [
    ...leftFlanges.map(s => ({ side: "left" as const, length: s.length })),
    ...rightFlanges.map(s => ({ side: "right" as const, length: s.length })),
    ...topFlanges.map(s => ({ side: "top" as const, length: s.length })),
    ...botFlanges.map(s => ({ side: "bottom" as const, length: s.length })),
  ];

  const lipSegs = segDims.filter(s => s.role === "lip");
  const lips = lipSegs.map(s => ({
    length: s.length,
    angle: s.angle ?? 0,
  }));

  // --- Auto-labels for canvas ---
  const labels: ProfileDimensions["labels"] = [];

  // Overall width/height
  const cx = (boundingBox.minX + boundingBox.maxX) / 2;
  const cy = (boundingBox.minY + boundingBox.maxY) / 2;

  labels.push({
    x: cx,
    y: boundingBox.minY - 8,
    text: `W: ${boundingBox.width.toFixed(1)} mm`,
    type: "dimension",
  });
  labels.push({
    x: boundingBox.maxX + 8,
    y: cy,
    text: `H: ${boundingBox.height.toFixed(1)} mm`,
    type: "dimension",
  });
  labels.push({
    x: cx,
    y: boundingBox.maxY + 8,
    text: `Strip: ${stripWidth.toFixed(1)} mm`,
    type: "info",
  });

  // Segment labels
  for (const sd of segDims) {
    const mid = midpoint(sd.startX, sd.startY, sd.endX, sd.endY);
    if (sd.type === "arc") {
      labels.push({ x: mid.x + 4, y: mid.y, text: sd.label, type: "radius" });
    } else if (sd.length > 2) {
      labels.push({ x: mid.x, y: mid.y - 5, text: sd.label, type: "length" });
    }
  }

  // Bend angle labels
  for (const bd of bendDims) {
    labels.push({
      x: bd.x,
      y: bd.y + 4,
      text: `∠${bd.angle.toFixed(0)}°`,
      type: "angle",
    });
  }

  return {
    overallWidth: parseFloat(boundingBox.width.toFixed(3)),
    overallHeight: parseFloat(boundingBox.height.toFixed(3)),
    totalLength: parseFloat(totalLength.toFixed(3)),
    stripWidth: parseFloat(stripWidth.toFixed(3)),
    webLength: parseFloat(webLength.toFixed(3)),
    flanges,
    lips,
    bends: bendDims,
    segments: segDims,
    labels,
    blocked: false,
  };
}
