import type { Point, DrawEntity, Layer } from "./ManualDrawingEngine";
import { worldToCanvas } from "./ManualDrawingEngine";

export type PaperSize = "A4" | "A3" | "A2" | "A1" | "Letter" | "Legal" | "Tabloid";

export interface PaperDimensions {
  width: number;
  height: number;
  label: string;
}

export const PAPER_SIZES: Record<PaperSize, PaperDimensions> = {
  A4: { width: 210, height: 297, label: "A4 (210×297 mm)" },
  A3: { width: 297, height: 420, label: "A3 (297×420 mm)" },
  A2: { width: 420, height: 594, label: "A2 (420×594 mm)" },
  A1: { width: 594, height: 841, label: "A1 (594×841 mm)" },
  Letter: { width: 215.9, height: 279.4, label: "Letter (8.5×11 in)" },
  Legal: { width: 215.9, height: 355.6, label: "Legal (8.5×14 in)" },
  Tabloid: { width: 279.4, height: 431.8, label: "Tabloid (11×17 in)" },
};

export type PlotOrientation = "portrait" | "landscape";

export interface ViewportConfig {
  centerX: number;
  centerY: number;
  scale: number;
  width: number;
  height: number;
}

export interface PrintLayoutConfig {
  paperSize: PaperSize;
  orientation: PlotOrientation;
  margins: { top: number; right: number; bottom: number; left: number };
  titleBlock: boolean;
  titleBlockData: TitleBlockData;
  viewport: ViewportConfig;
  scaleToFit: boolean;
  plotScale: number;
  lineWeightScale: number;
}

export interface TitleBlockData {
  title: string;
  projectName: string;
  drawnBy: string;
  checkedBy: string;
  date: string;
  scale: string;
  sheetNumber: string;
  revision: string;
  company: string;
}

export const DEFAULT_TITLE_BLOCK: TitleBlockData = {
  title: "UNTITLED",
  projectName: "",
  drawnBy: "",
  checkedBy: "",
  date: new Date().toISOString().split("T")[0],
  scale: "1:1",
  sheetNumber: "1 of 1",
  revision: "A",
  company: "",
};

export function getDefaultPrintConfig(): PrintLayoutConfig {
  return {
    paperSize: "A4",
    orientation: "landscape",
    margins: { top: 10, right: 10, bottom: 10, left: 20 },
    titleBlock: true,
    titleBlockData: { ...DEFAULT_TITLE_BLOCK },
    viewport: { centerX: 0, centerY: 0, scale: 1, width: 0, height: 0 },
    scaleToFit: true,
    plotScale: 1,
    lineWeightScale: 1,
  };
}

function getEffectivePaperSize(config: PrintLayoutConfig): { w: number; h: number } {
  const paper = PAPER_SIZES[config.paperSize];
  if (config.orientation === "landscape") {
    return { w: Math.max(paper.width, paper.height), h: Math.min(paper.width, paper.height) };
  }
  return { w: Math.min(paper.width, paper.height), h: Math.max(paper.width, paper.height) };
}

function getEntitiesBounds(entities: DrawEntity[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasEntities = false;

  for (const ent of entities) {
    hasEntities = true;
    const d = ent.data;
    if (ent.type === "line") {
      minX = Math.min(minX, d.x1, d.x2); maxX = Math.max(maxX, d.x1, d.x2);
      minY = Math.min(minY, d.y1, d.y2); maxY = Math.max(maxY, d.y1, d.y2);
    } else if (ent.type === "circle" || ent.type === "arc") {
      minX = Math.min(minX, d.cx - d.r); maxX = Math.max(maxX, d.cx + d.r);
      minY = Math.min(minY, d.cy - d.r); maxY = Math.max(maxY, d.cy + d.r);
    } else if (ent.type === "polyline") {
      for (const p of (d.points as Point[])) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    } else if (ent.type === "text" || ent.type === "mtext" || ent.type === "point") {
      minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
    }
  }

  if (!hasEntities) return null;
  return { minX, minY, maxX, maxY };
}

export async function exportToPDF(
  entities: DrawEntity[],
  layers: Layer[],
  config: PrintLayoutConfig
): Promise<void> {
  const paper = getEffectivePaperSize(config);
  const mmToPx = 3.7795275591;
  const canvasW = Math.round(paper.w * mmToPx);
  const canvasH = Math.round(paper.h * mmToPx);

  const offscreen = document.createElement("canvas");
  offscreen.width = canvasW;
  offscreen.height = canvasH;
  const ctx = offscreen.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const margL = config.margins.left * mmToPx;
  const margR = config.margins.right * mmToPx;
  const margT = config.margins.top * mmToPx;
  const margB = config.margins.bottom * mmToPx;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(margL, margT, canvasW - margL - margR, canvasH - margT - margB);

  const drawableW = canvasW - margL - margR;
  let drawableH = canvasH - margT - margB;
  const titleBlockH = config.titleBlock ? 60 * mmToPx / 3 : 0;
  drawableH -= titleBlockH;

  const visibleLayers = new Set(layers.filter((l) => l.visible).map((l) => l.name));
  const visibleEntities = entities.filter((e) => visibleLayers.has(e.layer));
  const bounds = getEntitiesBounds(visibleEntities);

  let scale = config.plotScale;
  let offsetX = margL;
  let offsetY = margT;

  if (bounds && config.scaleToFit) {
    const extW = bounds.maxX - bounds.minX || 1;
    const extH = bounds.maxY - bounds.minY || 1;
    scale = Math.min(drawableW / extW, drawableH / extH) * 0.9;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    offsetX = margL + drawableW / 2 - centerX * scale;
    offsetY = margT + drawableH / 2 + centerY * scale;
  }

  const toCanvasX = (wx: number) => offsetX + wx * scale;
  const toCanvasY = (wy: number) => offsetY - wy * scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(margL, margT, drawableW, drawableH);
  ctx.clip();

  for (const ent of visibleEntities) {
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#000000";
    ctx.lineWidth = Math.max(0.5, ent.lineWeight * scale * config.lineWeightScale * 0.5);

    if (ent.type === "line") {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(ent.data.x1), toCanvasY(ent.data.y1));
      ctx.lineTo(toCanvasX(ent.data.x2), toCanvasY(ent.data.y2));
      ctx.stroke();
    } else if (ent.type === "circle") {
      ctx.beginPath();
      ctx.arc(toCanvasX(ent.data.cx), toCanvasY(ent.data.cy), ent.data.r * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ent.type === "arc") {
      ctx.beginPath();
      const sa = (-ent.data.endAngle * Math.PI) / 180;
      const ea = (-ent.data.startAngle * Math.PI) / 180;
      ctx.arc(toCanvasX(ent.data.cx), toCanvasY(ent.data.cy), ent.data.r * scale, sa, ea);
      ctx.stroke();
    } else if (ent.type === "polyline") {
      const pts: Point[] = ent.data.points || [];
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(pts[0].x), toCanvasY(pts[0].y));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(toCanvasX(pts[i].x), toCanvasY(pts[i].y));
        }
        ctx.stroke();
      }
    } else if (ent.type === "text" || ent.type === "mtext") {
      const { x, y, text, height, rotation } = ent.data;
      ctx.save();
      ctx.translate(toCanvasX(x), toCanvasY(y));
      ctx.rotate((-(rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = "#000000";
      ctx.font = `${Math.max(6, (height || 2.5) * scale)}px ${ent.data.fontFamily || "monospace"}`;
      const lines = (text || "").split("\n");
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, i * (height || 2.5) * scale * 1.3);
      }
      ctx.restore();
    } else if (ent.type === "dimension_linear") {
      const { p1, p2, location, value } = ent.data;
      if (p1 && p2 && location) {
        ctx.strokeStyle = "#000000";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(p1.x), toCanvasY(p1.y));
        ctx.lineTo(toCanvasX(p1.x), toCanvasY(location.y));
        ctx.moveTo(toCanvasX(p2.x), toCanvasY(p2.y));
        ctx.lineTo(toCanvasX(p2.x), toCanvasY(location.y));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(p1.x), toCanvasY(location.y));
        ctx.lineTo(toCanvasX(p2.x), toCanvasY(location.y));
        ctx.stroke();
        ctx.fillStyle = "#000000";
        ctx.font = `${Math.max(6, 10 * scale * 0.3)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(value || "", (toCanvasX(p1.x) + toCanvasX(p2.x)) / 2, toCanvasY(location.y) - 5);
        ctx.textAlign = "left";
      }
    } else if (ent.type === "hatch" as any) {
      const hatchLines = ent.data.hatchLines || [];
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = Math.max(0.3, 0.3 * scale * 0.2);
      for (const line of hatchLines) {
        ctx.beginPath();
        ctx.moveTo(toCanvasX(line.x1), toCanvasY(line.y1));
        ctx.lineTo(toCanvasX(line.x2), toCanvasY(line.y2));
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  if (config.titleBlock) {
    drawTitleBlock(ctx, canvasW, canvasH, margL, margR, margB, config.titleBlockData, mmToPx);
  }

  const dataUrl = offscreen.toDataURL("image/png", 1.0);

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const safeTitle = escHtml(config.titleBlockData.title || "Drawing");
    const safeFilename = escHtml((config.titleBlockData.title || "drawing").replace(/[^a-zA-Z0-9_-]/g, "_"));
    const pageSize = config.orientation === "landscape" ? `${paper.w}mm ${paper.h}mm` : `${paper.h}mm ${paper.w}mm`;

    const doc = printWindow.document;
    doc.open();
    doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
    doc.close();

    doc.title = safeTitle + " - Print";

    const style = doc.createElement("style");
    style.textContent = `
      @page { size: ${pageSize}; margin: 0; }
      body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f0f0; }
      img { max-width: 100%; height: auto; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }
      @media print { body { background: white; } img { box-shadow: none; max-width: 100%; } .controls { display: none; } }
      .controls { position: fixed; top: 10px; right: 10px; z-index: 100; display: flex; gap: 8px; }
      .controls button { padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer; font-size: 14px; }
      .controls button:hover { background: #e0e0e0; }
    `;
    doc.head.appendChild(style);

    const controls = doc.createElement("div");
    controls.className = "controls";

    const printBtn = doc.createElement("button");
    printBtn.textContent = "Print / Save PDF";
    printBtn.addEventListener("click", () => printWindow.print());
    controls.appendChild(printBtn);

    const pngBtn = doc.createElement("button");
    pngBtn.textContent = "Download PNG";
    pngBtn.addEventListener("click", () => {
      const a = doc.createElement("a");
      a.href = dataUrl;
      a.download = safeFilename + "_plot.png";
      a.click();
    });
    controls.appendChild(pngBtn);

    doc.body.appendChild(controls);

    const img = doc.createElement("img");
    img.src = dataUrl;
    doc.body.appendChild(img);
  }
}

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  margL: number,
  margR: number,
  margB: number,
  data: TitleBlockData,
  mmToPx: number
): void {
  const blockW = 180 * mmToPx;
  const blockH = 40 * mmToPx;
  const bx = canvasW - margR - blockW;
  const by = canvasH - margB - blockH;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, blockW, blockH);

  const rows = 4;
  const rowH = blockH / rows;
  for (let i = 1; i < rows; i++) {
    ctx.beginPath();
    ctx.moveTo(bx, by + i * rowH);
    ctx.lineTo(bx + blockW, by + i * rowH);
    ctx.stroke();
  }

  const midX = bx + blockW / 2;
  ctx.beginPath();
  ctx.moveTo(midX, by + rowH);
  ctx.lineTo(midX, by + blockH);
  ctx.stroke();

  ctx.fillStyle = "#000000";

  ctx.font = `bold ${Math.max(10, 14)}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(data.title || "UNTITLED", bx + blockW / 2, by + rowH * 0.65);

  ctx.font = `${Math.max(8, 10)}px Arial`;
  ctx.textAlign = "left";

  ctx.fillText(`Project: ${data.projectName}`, bx + 5, by + rowH * 1.65);
  ctx.fillText(`Company: ${data.company}`, midX + 5, by + rowH * 1.65);

  ctx.fillText(`Drawn: ${data.drawnBy}`, bx + 5, by + rowH * 2.65);
  ctx.fillText(`Checked: ${data.checkedBy}`, midX + 5, by + rowH * 2.65);

  ctx.fillText(`Date: ${data.date}`, bx + 5, by + rowH * 3.65);
  ctx.fillText(`Scale: ${data.scale}  Sheet: ${data.sheetNumber}  Rev: ${data.revision}`, midX + 5, by + rowH * 3.65);

  ctx.textAlign = "left";
}
