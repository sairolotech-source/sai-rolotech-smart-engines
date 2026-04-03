import type { Point, DrawEntity } from "./ManualDrawingEngine";
import { newEntityId, worldToCanvas } from "./ManualDrawingEngine";

export interface TextStyle {
  name: string;
  fontFamily: string;
  height: number;
  widthFactor: number;
  oblique: number;
  bold: boolean;
  italic: boolean;
}

export type TextJustification =
  | "left" | "center" | "right"
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export const DEFAULT_TEXT_STYLE: TextStyle = {
  name: "Standard",
  fontFamily: "monospace",
  height: 2.5,
  widthFactor: 1,
  oblique: 0,
  bold: false,
  italic: false,
};

export const AVAILABLE_FONTS = [
  "monospace",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Impact",
];

export function createTextStyleManager(): TextStyle[] {
  return [
    { ...DEFAULT_TEXT_STYLE },
    {
      name: "Romans",
      fontFamily: "Times New Roman",
      height: 2.5,
      widthFactor: 1,
      oblique: 0,
      bold: false,
      italic: false,
    },
    {
      name: "Gothic",
      fontFamily: "Arial",
      height: 3.0,
      widthFactor: 1,
      oblique: 0,
      bold: true,
      italic: false,
    },
    {
      name: "Italic",
      fontFamily: "Arial",
      height: 2.5,
      widthFactor: 1,
      oblique: 15,
      bold: false,
      italic: true,
    },
  ];
}

export function buildFontString(style: TextStyle, zoom: number): string {
  const size = Math.max(8, style.height * zoom);
  let font = "";
  if (style.italic) font += "italic ";
  if (style.bold) font += "bold ";
  font += `${size}px ${style.fontFamily}`;
  return font;
}

export function createMTextEntity(
  insertPoint: Point,
  text: string,
  style: TextStyle,
  justification: TextJustification,
  width: number,
  layer: string,
  color: string
): DrawEntity {
  return {
    id: newEntityId("mtext"),
    type: "mtext",
    layer,
    color,
    lineType: "Continuous",
    lineWeight: 0.18,
    data: {
      x: insertPoint.x,
      y: insertPoint.y,
      text,
      height: style.height,
      fontFamily: style.fontFamily,
      bold: style.bold,
      italic: style.italic,
      widthFactor: style.widthFactor,
      oblique: style.oblique,
      justification,
      width,
      rotation: 0,
      styleName: style.name,
    },
  };
}

export function renderTextEntity(
  ctx: CanvasRenderingContext2D,
  entity: DrawEntity,
  panX: number,
  panY: number,
  zoom: number,
  canvasH: number,
  preview: boolean = false
): void {
  const { data, color } = entity;

  if (entity.type === "text") {
    const { x, y, text, height, rotation, fontFamily, bold, italic } = data;
    const cp = worldToCanvas(x, y, panX, panY, zoom, canvasH);
    ctx.save();
    ctx.translate(cp.cx, cp.cy);
    ctx.rotate((-(rotation || 0) * Math.PI) / 180);
    ctx.fillStyle = preview ? "#60a5fa" : color;
    const fontSize = Math.max(8, (height || 2.5) * zoom);
    let font = "";
    if (italic) font += "italic ";
    if (bold) font += "bold ";
    font += `${fontSize}px ${fontFamily || "monospace"}`;
    ctx.font = font;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else if (entity.type === "mtext") {
    const { x, y, text, height, fontFamily, bold, italic, justification, width: textWidth, rotation } = data;
    const cp = worldToCanvas(x, y, panX, panY, zoom, canvasH);
    ctx.save();
    ctx.translate(cp.cx, cp.cy);
    ctx.rotate((-(rotation || 0) * Math.PI) / 180);
    ctx.fillStyle = preview ? "#60a5fa" : color;
    const fontSize = Math.max(8, (height || 2.5) * zoom);
    let font = "";
    if (italic) font += "italic ";
    if (bold) font += "bold ";
    font += `${fontSize}px ${fontFamily || "monospace"}`;
    ctx.font = font;

    const just = justification || "left";
    if (just.includes("center")) ctx.textAlign = "center";
    else if (just.includes("right")) ctx.textAlign = "right";
    else ctx.textAlign = "left";

    const lines = text.split("\n");
    const lineHeight = fontSize * 1.3;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 0, i * lineHeight);
    }

    ctx.textAlign = "left";
    ctx.restore();
  }
}
