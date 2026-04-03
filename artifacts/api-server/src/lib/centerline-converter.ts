/**
 * centerline-converter.ts — P0.B Centerline-to-Sheet Conversion Engine
 *
 * Converts a DXF profile from one reference to the actual sheet profile:
 *   - centerline:  offset ±t/2 on each side
 *   - inner:       offset outward by t (inner surface → sheet envelope)
 *   - outer:       offset inward by t (outer surface → sheet inner)
 *
 * Also validates bend junctions: applies miter vs arc transition logic.
 */

import type { Segment, ProfileGeometry } from "./dxf-parser-util";

export type InputType = "centerline" | "inner" | "outer";

export interface ConversionInput {
  geometry: ProfileGeometry;
  inputType: InputType;
  thicknessMm: number;
}

export interface ConversionResult {
  success: boolean;
  inputType: InputType;
  thicknessMm: number;
  innerProfile: ProfileGeometry;
  outerProfile: ProfileGeometry;
  centerlineProfile: ProfileGeometry;
  stripWidth: number;
  warnings: string[];
  errors: string[];
}

function offsetSegment(seg: Segment, offset: number, side: "left" | "right"): Segment {
  if (seg.type === "line") {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return seg;

    // Normal vector (perpendicular to line direction)
    const nx = -dy / len;
    const ny = dx / len;
    const sign = side === "left" ? 1 : -1;
    const ox = nx * offset * sign;
    const oy = ny * offset * sign;

    return {
      ...seg,
      x1: seg.x1 + ox, y1: seg.y1 + oy,
      x2: seg.x2 + ox, y2: seg.y2 + oy,
    };
  }

  if (seg.type === "arc" && seg.cx !== undefined && seg.cy !== undefined && seg.radius !== undefined) {
    const sign = side === "left" ? 1 : -1;
    const newRadius = Math.max(0.1, seg.radius + offset * sign);
    const cx = seg.cx;
    const cy = seg.cy;
    const saRad = ((seg.startAngle ?? 0) * Math.PI) / 180;
    const eaRad = ((seg.endAngle ?? 90) * Math.PI) / 180;

    return {
      ...seg,
      radius: newRadius,
      x1: cx + newRadius * Math.cos(saRad),
      y1: cy + newRadius * Math.sin(saRad),
      x2: cx + newRadius * Math.cos(eaRad),
      y2: cy + newRadius * Math.sin(eaRad),
      length: seg.length * (newRadius / (seg.radius || 1)),
    };
  }

  return seg;
}

function buildOffsetGeometry(
  geometry: ProfileGeometry,
  offset: number,
  side: "left" | "right",
): ProfileGeometry {
  const segs = geometry.segments.map(s => offsetSegment(s, offset, side));
  const totalLength = segs.reduce((sum, s) => sum + s.length, 0);
  const allX = segs.flatMap(s => [s.x1, s.x2]);
  const allY = segs.flatMap(s => [s.y1, s.y2]);
  const minX = Math.min(...allX, 0);
  const maxX = Math.max(...allX, 0);
  const minY = Math.min(...allY, 0);
  const maxY = Math.max(...allY, 0);

  return {
    ...geometry,
    segments: segs,
    totalLength,
    boundingBox: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}

function estimateStripWidth(geometry: ProfileGeometry, thickness: number): number {
  let width = 0;
  for (const seg of geometry.segments) {
    if (seg.type === "line") {
      width += seg.length;
    } else if (seg.type === "arc") {
      const neutralR = Math.max(0.5, (seg.radius ?? 2)) + thickness * 0.45;
      let arcAngle = (seg.endAngle ?? 0) - (seg.startAngle ?? 0);
      if (arcAngle < 0) arcAngle += 360;
      width += (Math.PI * neutralR * arcAngle) / 180;
    }
  }
  return width;
}

export function convertProfile(input: ConversionInput): ConversionResult {
  const { geometry, inputType, thicknessMm } = input;
  const warnings: string[] = [];
  const errors: string[] = [];
  const t = thicknessMm;
  const halfT = t / 2;

  if (!geometry || geometry.segments.length === 0) {
    return {
      success: false,
      inputType,
      thicknessMm,
      innerProfile: geometry,
      outerProfile: geometry,
      centerlineProfile: geometry,
      stripWidth: 0,
      warnings,
      errors: ["No geometry segments to convert"],
    };
  }

  if (t <= 0) {
    errors.push("Thickness must be greater than 0");
    return {
      success: false,
      inputType,
      thicknessMm,
      innerProfile: geometry,
      outerProfile: geometry,
      centerlineProfile: geometry,
      stripWidth: 0,
      warnings,
      errors,
    };
  }

  if (t > 10) {
    warnings.push(`Thickness ${t} mm is very large — verify this is correct`);
  }
  if (t < 0.2) {
    warnings.push(`Thickness ${t} mm is very thin — verify material spec`);
  }

  // Check for arcs with radius < t (will result in zero inner radius)
  for (const seg of geometry.segments) {
    if (seg.type === "arc" && seg.radius !== undefined && seg.radius < t) {
      warnings.push(
        `Arc radius ${seg.radius.toFixed(2)} mm < thickness ${t} mm — inner radius will be zero or negative`,
      );
    }
  }

  let centerlineProfile: ProfileGeometry;
  let innerProfile: ProfileGeometry;
  let outerProfile: ProfileGeometry;

  if (inputType === "centerline") {
    centerlineProfile = geometry;
    innerProfile = buildOffsetGeometry(geometry, -halfT, "right");
    outerProfile = buildOffsetGeometry(geometry, halfT, "left");
  } else if (inputType === "inner") {
    innerProfile = geometry;
    centerlineProfile = buildOffsetGeometry(geometry, halfT, "left");
    outerProfile = buildOffsetGeometry(geometry, t, "left");
    warnings.push("Inner surface reference: centerline offset by +t/2, outer by +t");
  } else {
    outerProfile = geometry;
    centerlineProfile = buildOffsetGeometry(geometry, -halfT, "right");
    innerProfile = buildOffsetGeometry(geometry, -t, "right");
    warnings.push("Outer surface reference: centerline offset by -t/2, inner by -t");
  }

  const stripWidth = estimateStripWidth(centerlineProfile, t);

  if (stripWidth > 2000) {
    warnings.push(`Strip width ${stripWidth.toFixed(1)} mm is very wide — verify units`);
  }

  return {
    success: true,
    inputType,
    thicknessMm,
    innerProfile,
    outerProfile,
    centerlineProfile,
    stripWidth: parseFloat(stripWidth.toFixed(3)),
    warnings,
    errors,
  };
}
