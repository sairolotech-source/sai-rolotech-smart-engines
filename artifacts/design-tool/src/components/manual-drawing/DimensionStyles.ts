import type { Point, DrawEntity } from "./ManualDrawingEngine";
import { newEntityId, worldToCanvas } from "./ManualDrawingEngine";

export type ArrowheadType = "closed" | "open" | "dot" | "tick" | "none";

export type ToleranceDisplay = "none" | "deviation" | "limits" | "symmetric";

export interface DimensionStyle {
  name: string;
  arrowheadType: ArrowheadType;
  arrowSize: number;
  textHeight: number;
  textOffset: number;
  textColor: string;
  lineColor: string;
  extensionLineOffset: number;
  extensionLineExtend: number;
  toleranceDisplay: ToleranceDisplay;
  toleranceUpper: number;
  toleranceLower: number;
  precision: number;
  prefix: string;
  suffix: string;
  fontFamily: string;
}

export const DEFAULT_DIM_STYLE: DimensionStyle = {
  name: "Standard",
  arrowheadType: "closed",
  arrowSize: 2.5,
  textHeight: 2.5,
  textOffset: 0.625,
  textColor: "#ffcc00",
  lineColor: "#ffcc00",
  extensionLineOffset: 1.25,
  extensionLineExtend: 1.25,
  toleranceDisplay: "none",
  toleranceUpper: 0,
  toleranceLower: 0,
  precision: 3,
  prefix: "",
  suffix: "",
  fontFamily: "monospace",
};

export function createDimStyleManager(): DimensionStyle[] {
  return [
    { ...DEFAULT_DIM_STYLE },
    {
      ...DEFAULT_DIM_STYLE,
      name: "Annotative",
      arrowheadType: "open",
      arrowSize: 3,
      textHeight: 3,
    },
    {
      ...DEFAULT_DIM_STYLE,
      name: "Mechanical",
      arrowheadType: "closed",
      arrowSize: 2,
      textHeight: 2.5,
      toleranceDisplay: "deviation",
      toleranceUpper: 0.05,
      toleranceLower: -0.05,
      precision: 2,
    },
    {
      ...DEFAULT_DIM_STYLE,
      name: "Architectural",
      arrowheadType: "tick",
      arrowSize: 2,
      textHeight: 2,
    },
  ];
}

export function createLeaderEntity(
  points: Point[],
  text: string,
  layer: string,
  color: string,
  style: DimensionStyle
): DrawEntity {
  return {
    id: newEntityId("leader"),
    type: "leader" as any,
    layer,
    color,
    lineType: "Continuous",
    lineWeight: 0.18,
    data: {
      points,
      text,
      arrowheadType: style.arrowheadType,
      arrowSize: style.arrowSize,
      textHeight: style.textHeight,
      textColor: style.textColor,
      fontFamily: style.fontFamily,
    },
  };
}

export function formatDimValue(
  value: number,
  style: DimensionStyle
): string {
  let text = `${style.prefix}${value.toFixed(style.precision)}${style.suffix}`;

  if (style.toleranceDisplay === "symmetric") {
    text += ` ±${Math.abs(style.toleranceUpper).toFixed(style.precision)}`;
  } else if (style.toleranceDisplay === "deviation") {
    const up = style.toleranceUpper >= 0 ? `+${style.toleranceUpper.toFixed(style.precision)}` : style.toleranceUpper.toFixed(style.precision);
    const lo = style.toleranceLower >= 0 ? `+${style.toleranceLower.toFixed(style.precision)}` : style.toleranceLower.toFixed(style.precision);
    text += ` (${up}/${lo})`;
  } else if (style.toleranceDisplay === "limits") {
    const upper = (value + style.toleranceUpper).toFixed(style.precision);
    const lower = (value + style.toleranceLower).toFixed(style.precision);
    text = `${style.prefix}${upper}/${lower}${style.suffix}`;
  }

  return text;
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number, tipY: number,
  angle: number,
  size: number,
  type: ArrowheadType,
  zoom: number
): void {
  const sz = size * zoom;
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);

  switch (type) {
    case "closed":
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-sz * 3, sz);
      ctx.lineTo(-sz * 3, -sz);
      ctx.closePath();
      ctx.fill();
      break;
    case "open":
      ctx.beginPath();
      ctx.moveTo(-sz * 3, sz);
      ctx.lineTo(0, 0);
      ctx.lineTo(-sz * 3, -sz);
      ctx.stroke();
      break;
    case "dot":
      ctx.beginPath();
      ctx.arc(0, 0, sz, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "tick":
      ctx.beginPath();
      ctx.moveTo(-sz, -sz);
      ctx.lineTo(sz, sz);
      ctx.stroke();
      break;
    case "none":
      break;
  }

  ctx.restore();
}

export function renderDimensionEntity(
  ctx: CanvasRenderingContext2D,
  entity: DrawEntity,
  panX: number,
  panY: number,
  zoom: number,
  canvasH: number,
  style: DimensionStyle,
  preview: boolean = false
): void {
  if (!entity.type || (!entity.type.startsWith("dimension_") && (entity.type as string) !== "leader")) return;

  if ((entity.type as string) === "leader") {
    renderLeader(ctx, entity, panX, panY, zoom, canvasH, style, preview);
    return;
  }

  const { p1, p2, location, value } = entity.data;
  if (!p1 || !p2) return;

  const cp1 = worldToCanvas(p1.x, p1.y, panX, panY, zoom, canvasH);
  const cp2 = worldToCanvas(p2.x, p2.y, panX, panY, zoom, canvasH);

  const lineColor = preview ? "#60a5fa" : style.lineColor;
  const textColor = preview ? "#60a5fa" : style.textColor;
  const fontSize = Math.max(8, style.textHeight * zoom);

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.fillStyle = lineColor;
  ctx.lineWidth = preview ? 1 : Math.max(0.5, 0.5 * zoom * 0.4);

  if (entity.type === "dimension_radius" || entity.type === "dimension_diameter") {
    const cx = p1.x;
    const cy = p1.y;
    const r = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const cc = worldToCanvas(cx, cy, panX, panY, zoom, canvasH);
    const rPx = r * zoom;

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cc.cx, cc.cy);
    ctx.lineTo(cp2.cx, cp2.cy);
    ctx.stroke();

    const angle = Math.atan2(cp2.cy - cc.cy, cp2.cx - cc.cx);
    drawArrowhead(ctx, cp2.cx, cp2.cy, angle + Math.PI, style.arrowSize, style.arrowheadType, zoom);

    if (entity.type === "dimension_diameter") {
      const oppX = cc.cx - (cp2.cx - cc.cx);
      const oppY = cc.cy - (cp2.cy - cc.cy);
      ctx.beginPath();
      ctx.moveTo(cc.cx, cc.cy);
      ctx.lineTo(oppX, oppY);
      ctx.stroke();
      drawArrowhead(ctx, oppX, oppY, angle, style.arrowSize, style.arrowheadType, zoom);
    }

    const dist = parseFloat(value) || r;
    const prefix = entity.type === "dimension_diameter" ? "⌀" : "R";
    const dimText = prefix + formatDimValue(dist, style);
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    const midX = (cc.cx + cp2.cx) / 2;
    const midY = (cc.cy + cp2.cy) / 2;
    ctx.fillText(dimText, midX, midY - style.textOffset * zoom - 3);
    ctx.textAlign = "left";
  } else if (entity.type === "dimension_angular") {
    const cloc = location ? worldToCanvas(location.x, location.y, panX, panY, zoom, canvasH) : cp2;

    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(cp1.cx, cp1.cy);
    ctx.lineTo(cloc.cx, cloc.cy);
    ctx.moveTo(cp2.cx, cp2.cy);
    ctx.lineTo(cloc.cx, cloc.cy);
    ctx.stroke();
    ctx.setLineDash([]);

    const r = Math.min(40, 30 * zoom);
    const a1 = Math.atan2(cp1.cy - cloc.cy, cp1.cx - cloc.cx);
    const a2 = Math.atan2(cp2.cy - cloc.cy, cp2.cx - cloc.cx);
    ctx.beginPath();
    ctx.arc(cloc.cx, cloc.cy, r, a1, a2);
    ctx.stroke();

    drawArrowhead(ctx, cloc.cx + r * Math.cos(a1), cloc.cy + r * Math.sin(a1), a1 + Math.PI / 2, style.arrowSize, style.arrowheadType, zoom);
    drawArrowhead(ctx, cloc.cx + r * Math.cos(a2), cloc.cy + r * Math.sin(a2), a2 - Math.PI / 2, style.arrowSize, style.arrowheadType, zoom);

    const dimText = formatDimValue(parseFloat(value) || 0, style) + "°";
    const midAngle = (a1 + a2) / 2;
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText(dimText, cloc.cx + (r + 12) * Math.cos(midAngle), cloc.cy + (r + 12) * Math.sin(midAngle));
    ctx.textAlign = "left";
  } else {
    if (!location) { ctx.restore(); return; }
    const cloc = worldToCanvas(location.x, location.y, panX, panY, zoom, canvasH);

    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(cp1.cx, cp1.cy); ctx.lineTo(cp1.cx, cloc.cy);
    ctx.moveTo(cp2.cx, cp2.cy); ctx.lineTo(cp2.cx, cloc.cy);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cp1.cx, cloc.cy); ctx.lineTo(cp2.cx, cloc.cy);
    ctx.stroke();

    const angle1 = Math.atan2(0, cp2.cx - cp1.cx);
    const angle2 = Math.atan2(0, cp1.cx - cp2.cx);
    drawArrowhead(ctx, cp1.cx, cloc.cy, angle1, style.arrowSize, style.arrowheadType, zoom);
    drawArrowhead(ctx, cp2.cx, cloc.cy, angle2, style.arrowSize, style.arrowheadType, zoom);

    const dist = parseFloat(value) || 0;
    const dimText = formatDimValue(dist, style);
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${style.fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText(dimText, (cp1.cx + cp2.cx) / 2, cloc.cy - style.textOffset * zoom - 3);
    ctx.textAlign = "left";
  }

  ctx.restore();
}

function renderLeader(
  ctx: CanvasRenderingContext2D,
  entity: DrawEntity,
  panX: number,
  panY: number,
  zoom: number,
  canvasH: number,
  style: DimensionStyle,
  preview: boolean
): void {
  const { points, text, arrowheadType, arrowSize, textHeight, textColor, fontFamily } = entity.data;
  if (!points || points.length < 2) return;

  const cPts = points.map((p: Point) => worldToCanvas(p.x, p.y, panX, panY, zoom, canvasH));
  const lineColor = preview ? "#60a5fa" : entity.color;

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.fillStyle = lineColor;
  ctx.lineWidth = Math.max(0.5, 0.5 * zoom * 0.4);

  ctx.beginPath();
  ctx.moveTo(cPts[0].cx, cPts[0].cy);
  for (let i = 1; i < cPts.length; i++) {
    ctx.lineTo(cPts[i].cx, cPts[i].cy);
  }
  ctx.stroke();

  const p0 = cPts[0];
  const p1 = cPts[1];
  const angle = Math.atan2(p0.cy - p1.cy, p0.cx - p1.cx);
  drawArrowhead(ctx, p0.cx, p0.cy, angle + Math.PI, arrowSize || style.arrowSize, arrowheadType || style.arrowheadType, zoom);

  if (text) {
    const lastPt = cPts[cPts.length - 1];
    const fontSize = Math.max(8, (textHeight || style.textHeight) * zoom);
    ctx.fillStyle = preview ? "#60a5fa" : (textColor || style.textColor);
    ctx.font = `${fontSize}px ${fontFamily || style.fontFamily}`;
    ctx.fillText(text, lastPt.cx + 4, lastPt.cy - 4);
  }

  ctx.restore();
}
