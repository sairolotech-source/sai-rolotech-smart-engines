import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  Download, ZoomIn, ZoomOut, Maximize2, FileText, Image as ImageIcon,
  Layers, Grid, Ruler, RefreshCw, Settings, ChevronDown, ChevronUp, Info,
  Sparkles, Send, Bot, Loader2, X, CheckCircle2, Zap
} from "lucide-react";
import { useCncStore, type Segment } from "../../store/useCncStore";

// ─── Auto Mode Types ──────────────────────────────────────────────────────────
interface AutoMsg {
  role: "ai" | "user";
  text: string;
  actions?: { key: string; value: string }[];
}

// Parse [ACTION:key:value] tags from AI response
function parseActions(text: string): { cleaned: string; actions: { key: string; value: string }[] } {
  const actions: { key: string; value: string }[] = [];
  const cleaned = text.replace(/\[ACTION:([^:]+):([^\]]+)\]/g, (_, key, value) => {
    actions.push({ key: key.trim(), value: value.trim() });
    return "";
  }).trim();
  return { cleaned, actions };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; }
interface DimLinear { type: "linear"; p1: Point; p2: Point; offset: number; axis: "h" | "v"; value: number; }
interface DimRadius { type: "radius"; cx: number; cy: number; r: number; angle: number; value: number; }
interface DimAngular { type: "angular"; vertex: Point; p1: Point; p2: Point; radius: number; value: number; }
type Dimension = DimLinear | DimRadius | DimAngular;

interface DrawState {
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  showDims: boolean;
  showTitleBlock: boolean;
  showCenterLines: boolean;
  paperSize: "A4" | "A3" | "A2";
  scale: string;
  dimStyle: "standard" | "compact";
  dimColor: string;
  geomColor: string;
  centerColor: string;
}

// ─── Paper sizes (mm) ─────────────────────────────────────────────────────────

const PAPER = {
  A4: { w: 297, h: 210 },
  A3: { w: 420, h: 297 },
  A2: { w: 594, h: 420 },
};
const MARGIN = 20;
const TITLE_H = 40;
const TITLE_W = 180;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function segToPoints(seg: Segment): Point[] {
  const pts: Point[] = [];
  if (seg.type === "line") {
    pts.push({ x: seg.startX, y: seg.startY }, { x: seg.endX, y: seg.endY });
  } else if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
    const sa = (seg.startAngle || 0) * (Math.PI / 180);
    const ea = (seg.endAngle || 360) * (Math.PI / 180);
    let sweep = ea - sa;
    if (sweep <= 0) sweep += Math.PI * 2;
    for (let i = 0; i <= 16; i++) {
      const t = sa + (sweep * i) / 16;
      pts.push({ x: seg.centerX + seg.radius * Math.cos(t), y: seg.centerY + seg.radius * Math.sin(t) });
    }
  }
  return pts;
}

function getBounds(segs: Segment[]): { minX: number; maxX: number; minY: number; maxY: number; w: number; h: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  segs.forEach(s => {
    segToPoints(s).forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
  });
  if (!isFinite(minX)) { minX = -100; maxX = 100; minY = -50; maxY = 50; }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}


function fmt(v: number, dec = 2) { return v.toFixed(dec); }


// ─── Auto-dimension generator ─────────────────────────────────────────────────

function generateDimensions(segs: Segment[], bounds: ReturnType<typeof getBounds>): Dimension[] {
  const dims: Dimension[] = [];
  const { minX, maxX, minY, maxY, w, h } = bounds;
  const offsetStep = Math.max(w, h) * 0.12;

  // Overall width
  dims.push({
    type: "linear", axis: "h",
    p1: { x: minX, y: minY }, p2: { x: maxX, y: minY },
    offset: -(offsetStep * 1.8), value: w,
  });

  // Overall height
  dims.push({
    type: "linear", axis: "v",
    p1: { x: maxX, y: minY }, p2: { x: maxX, y: maxY },
    offset: offsetStep * 1.8, value: h,
  });

  // Per-segment dimensions
  let dimOffsetH = -(offsetStep * 0.8);
  let dimOffsetV = offsetStep * 0.8;

  segs.forEach((seg, i) => {
    if (seg.type === "line") {
      const segW = Math.abs(seg.endX - seg.startX);
      const segH = Math.abs(seg.endY - seg.startY);

      // Horizontal partial dimension
      if (segW > w * 0.05 && segH < w * 0.05) {
        dims.push({
          type: "linear", axis: "h",
          p1: { x: Math.min(seg.startX, seg.endX), y: minY },
          p2: { x: Math.max(seg.startX, seg.endX), y: minY },
          offset: dimOffsetH, value: segW,
        });
        dimOffsetH -= offsetStep * 0.6;
      }

      // Vertical partial dimension
      if (segH > h * 0.05 && segW < h * 0.05) {
        dims.push({
          type: "linear", axis: "v",
          p1: { x: maxX, y: Math.min(seg.startY, seg.endY) },
          p2: { x: maxX, y: Math.max(seg.startY, seg.endY) },
          offset: dimOffsetV, value: segH,
        });
        dimOffsetV += offsetStep * 0.6;
      }

      // Diagonal length
      const diagLen = Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY);
      if (segW > w * 0.05 && segH > h * 0.05 && diagLen > 2) {
        const midX = (seg.startX + seg.endX) / 2;
        const midY = (seg.startY + seg.endY) / 2;
        // mark as linear h with diagonal indicator
        dims.push({
          type: "linear", axis: "h",
          p1: { x: seg.startX, y: seg.startY },
          p2: { x: seg.endX, y: seg.endY },
          offset: 0, value: diagLen,
        });
      }

    } else if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
      const sa = (seg.startAngle || 0) * (Math.PI / 180);
      const ea = (seg.endAngle || 360) * (Math.PI / 180);
      let sweep = ea - sa;
      if (sweep <= 0) sweep += Math.PI * 2;
      const midAngle = sa + sweep / 2;
      const angDeg = sweep * 180 / Math.PI;

      // Radius dimension
      dims.push({
        type: "radius",
        cx: seg.centerX, cy: seg.centerY, r: seg.radius,
        angle: midAngle * 180 / Math.PI,
        value: seg.radius,
      });

      // Angular dimension if notable
      if (angDeg < 350 && angDeg > 5) {
        dims.push({
          type: "angular",
          vertex: { x: seg.centerX, y: seg.centerY },
          p1: { x: seg.centerX + seg.radius * Math.cos(sa), y: seg.centerY + seg.radius * Math.sin(sa) },
          p2: { x: seg.centerX + seg.radius * Math.cos(ea), y: seg.centerY + seg.radius * Math.sin(ea) },
          radius: seg.radius * 0.6,
          value: angDeg,
        });
      }
    }
  });

  return dims;
}

// ─── Canvas Renderer ──────────────────────────────────────────────────────────

function renderDrawing(
  ctx: CanvasRenderingContext2D,
  cw: number, ch: number,
  segs: Segment[],
  dims: Dimension[],
  state: DrawState,
  paperMM: { w: number; h: number },
  projectInfo: { name: string; partNo: string; material: string; drawn: string; scale: string; rev: string; sheet: string },
) {
  const { zoom, panX, panY, showGrid, showDims, showTitleBlock, showCenterLines, geomColor, dimColor, centerColor } = state;

  // px per mm
  const PPM = zoom;

  function toCanvas(mx: number, my: number) {
    return { cx: panX + mx * PPM, cy: ch - (panY + my * PPM) };
  }

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, cw, ch);

  // ── Paper sheet ──
  const p0 = toCanvas(0, 0);
  const p1 = toCanvas(paperMM.w, paperMM.h);
  const pW = p1.cx - p0.cx;
  const pH = p0.cy - p1.cy;

  ctx.fillStyle = "#f8f8f0";
  ctx.fillRect(p0.cx, p1.cy, pW, pH);

  // ── Grid ──
  if (showGrid && zoom > 0.5) {
    const gridSpacing = 10; // mm
    ctx.strokeStyle = "rgba(100,120,200,0.12)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= paperMM.w; x += gridSpacing) {
      const { cx } = toCanvas(x, 0);
      ctx.beginPath(); ctx.moveTo(cx, p1.cy); ctx.lineTo(cx, p0.cy); ctx.stroke();
    }
    for (let y = 0; y <= paperMM.h; y += gridSpacing) {
      const { cy } = toCanvas(0, y);
      ctx.beginPath(); ctx.moveTo(p0.cx, cy); ctx.lineTo(p1.cx, cy); ctx.stroke();
    }
  }

  // ── Border ──
  ctx.strokeStyle = "#1a1a2e";
  ctx.lineWidth = 2 * zoom;
  ctx.strokeRect(p0.cx, p1.cy, pW, pH);

  // Inner border
  const bm = MARGIN * zoom;
  ctx.lineWidth = 1 * zoom;
  ctx.strokeRect(p0.cx + bm, p1.cy + bm, pW - 2 * bm, pH - 2 * bm);

  // ── Title block ──
  if (showTitleBlock) {
    const tbX0 = toCanvas(paperMM.w - MARGIN - TITLE_W, 0).cx;
    const tbY0 = toCanvas(0, MARGIN + TITLE_H).cy;
    const tbW = TITLE_W * zoom;
    const tbH = TITLE_H * zoom;

    ctx.fillStyle = "#e8e8e0";
    ctx.fillRect(tbX0, tbY0, tbW, tbH);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.8 * zoom;
    ctx.strokeRect(tbX0, tbY0, tbW, tbH);

    const rows = [
      { label: "PROJECT", value: projectInfo.name, y: 0.05 },
      { label: "PART NO", value: projectInfo.partNo, y: 0.22 },
      { label: "MATERIAL", value: projectInfo.material, y: 0.39 },
      { label: "DRAWN BY", value: projectInfo.drawn, y: 0.56 },
      { label: "SCALE", value: projectInfo.scale, y: 0.73 },
      { label: "REV / SHEET", value: `${projectInfo.rev} / ${projectInfo.sheet}`, y: 0.87 },
    ];

    rows.forEach(row => {
      const ry = tbY0 + row.y * tbH;
      ctx.fillStyle = "#888";
      ctx.font = `${5.5 * zoom}px Arial`;
      ctx.fillText(row.label, tbX0 + 3 * zoom, ry + 6 * zoom);
      ctx.fillStyle = "#111";
      ctx.font = `bold ${6.5 * zoom}px Arial`;
      ctx.fillText(row.value, tbX0 + 3 * zoom, ry + 13 * zoom);
      ctx.strokeStyle = "#bbb";
      ctx.lineWidth = 0.4 * zoom;
      ctx.beginPath(); ctx.moveTo(tbX0, ry + tbH / rows.length); ctx.lineTo(tbX0 + tbW, ry + tbH / rows.length); ctx.stroke();
    });

    // Company name
    ctx.fillStyle = "#1a3a6e";
    ctx.font = `bold ${9 * zoom}px Arial`;
    ctx.fillText("SAI ROLOTECH SMART ENGINES", tbX0 + 3 * zoom, tbY0 - 6 * zoom);
  }

  // ── Compute geometry area ──
  if (segs.length === 0) {
    // Placeholder message
    ctx.fillStyle = "#94a3b8";
    ctx.font = `${14 * zoom}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("Profile not defined", (p0.cx + p1.cx) / 2, (p0.cy + p1.cy) / 2);
    ctx.textAlign = "left";
    return;
  }

  const bounds = getBounds(segs);
  const { minX, maxX, minY, maxY, w: bW, h: bH } = bounds;

  // Drawing area center
  const drawAreaX = MARGIN + 5;
  const drawAreaW = paperMM.w - MARGIN * 2 - 10 - TITLE_W - 5;
  const drawAreaY = MARGIN + 5;
  const drawAreaH = paperMM.h - MARGIN * 2 - 10;
  const drawAreaCX = drawAreaX + drawAreaW / 2;
  const drawAreaCY = drawAreaY + drawAreaH / 2;

  const profilePadding = Math.max(bW, bH) * 0.4;
  const scaleX = drawAreaW / (bW + profilePadding * 2);
  const scaleY = drawAreaH / (bH + profilePadding * 2);
  const autoScale = Math.min(scaleX, scaleY);

  const profileCX = (minX + maxX) / 2;
  const profileCY = (minY + maxY) / 2;

  function profileToMM(px: number, py: number): { mx: number; my: number } {
    return {
      mx: drawAreaCX + (px - profileCX) * autoScale,
      my: drawAreaCY + (py - profileCY) * autoScale,
    };
  }

  // ── Center lines ──
  if (showCenterLines) {
    const { mx: cxMM, my: cyMM } = profileToMM(profileCX, profileCY);
    const { cx: ccx, cy: ccy } = toCanvas(cxMM, cyMM);
    ctx.strokeStyle = centerColor;
    ctx.setLineDash([8 * zoom, 4 * zoom, 2 * zoom, 4 * zoom]);
    ctx.lineWidth = 0.8 * zoom;
    const len = Math.max(drawAreaW, drawAreaH) * 0.6 * zoom;
    ctx.beginPath(); ctx.moveTo(ccx - len, ccy); ctx.lineTo(ccx + len, ccy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ccx, ccy - len); ctx.lineTo(ccx, ccy + len); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Geometry ──
  ctx.strokeStyle = geomColor;
  ctx.lineWidth = 1.8 * zoom;
  ctx.setLineDash([]);

  segs.forEach(seg => {
    if (seg.type === "line") {
      const { mx: x1, my: y1 } = profileToMM(seg.startX, seg.startY);
      const { mx: x2, my: y2 } = profileToMM(seg.endX, seg.endY);
      const { cx: c1x, cy: c1y } = toCanvas(x1, y1);
      const { cx: c2x, cy: c2y } = toCanvas(x2, y2);
      ctx.beginPath();
      ctx.moveTo(c1x, c1y);
      ctx.lineTo(c2x, c2y);
      ctx.stroke();
    } else if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
      const { mx: cmx, my: cmy } = profileToMM(seg.centerX, seg.centerY);
      const { cx: ccx, cy: ccy } = toCanvas(cmx, cmy);
      const rPx = seg.radius * autoScale * zoom;
      const sa = (seg.startAngle || 0) * (Math.PI / 180);
      const ea = (seg.endAngle || 360) * (Math.PI / 180);
      // Canvas Y is flipped
      ctx.beginPath();
      ctx.arc(ccx, ccy, rPx, -ea, -sa, true);
      ctx.stroke();
    }
  });

  // End-points circles
  ctx.fillStyle = "#ef4444";
  segs.forEach(seg => {
    const pts = [{ x: seg.startX, y: seg.startY }, { x: seg.endX, y: seg.endY }];
    pts.forEach(pt => {
      const { mx, my } = profileToMM(pt.x, pt.y);
      const { cx, cy } = toCanvas(mx, my);
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5 * zoom, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // ── Dimensions ──
  if (showDims && dims.length > 0) {
    ctx.strokeStyle = dimColor;
    ctx.fillStyle = dimColor;
    ctx.lineWidth = 0.7 * zoom;
    ctx.font = `${7 * zoom}px Arial`;

    const arrowSize = 4 * zoom;

    function drawArrow(x: number, y: number, angle: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-arrowSize, arrowSize * 0.35);
      ctx.lineTo(-arrowSize, -arrowSize * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    dims.forEach(dim => {
      if (dim.type === "linear") {
        const { p1, p2, offset, axis, value } = dim;
        const { mx: mx1, my: my1 } = profileToMM(p1.x, p1.y);
        const { mx: mx2, my: my2 } = profileToMM(p2.x, p2.y);
        const { cx: cx1, cy: cy1 } = toCanvas(mx1, my1);
        const { cx: cx2, cy: cy2 } = toCanvas(mx2, my2);
        const offPx = offset * autoScale * zoom;

        let dx1: number, dy1: number, dx2: number, dy2: number;
        let textX: number, textY: number, textAngle = 0;

        if (axis === "h") {
          dx1 = cx1; dy1 = cy1 + offPx;
          dx2 = cx2; dy2 = cy2 + offPx;
          // Extension lines
          ctx.beginPath();
          ctx.moveTo(cx1, cy1); ctx.lineTo(dx1, dy1 - 4 * zoom * Math.sign(offPx)); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx2, cy2); ctx.lineTo(dx2, dy2 - 4 * zoom * Math.sign(offPx)); ctx.stroke();
          // Dimension line
          ctx.beginPath(); ctx.moveTo(dx1, dy1); ctx.lineTo(dx2, dy2); ctx.stroke();
          drawArrow(dx1, dy1, 0);
          drawArrow(dx2, dy2, Math.PI);
          textX = (dx1 + dx2) / 2;
          textY = dy1 - 3 * zoom * Math.sign(offPx);
        } else {
          dx1 = cx1 + offPx; dy1 = cy1;
          dx2 = cx2 + offPx; dy2 = cy2;
          ctx.beginPath();
          ctx.moveTo(cx1, cy1); ctx.lineTo(dx1 - 4 * zoom * Math.sign(offPx), dy1); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx2, cy2); ctx.lineTo(dx2 - 4 * zoom * Math.sign(offPx), dy2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(dx1, dy1); ctx.lineTo(dx2, dy2); ctx.stroke();
          drawArrow(dx1, dy1, Math.PI / 2);
          drawArrow(dx2, dy2, -Math.PI / 2);
          textX = dx1 + 4 * zoom;
          textY = (dy1 + dy2) / 2 + 4 * zoom;
          textAngle = -Math.PI / 2;
        }

        const label = `${fmt(value)} mm`;
        ctx.save();
        ctx.translate(textX, textY);
        ctx.rotate(textAngle);
        ctx.fillStyle = "#0a0a20";
        const tw = ctx.measureText(label).width;
        ctx.fillRect(-tw / 2 - 2, -9 * zoom, tw + 4, 11 * zoom);
        ctx.fillStyle = dimColor;
        ctx.textAlign = "center";
        ctx.fillText(label, 0, 0);
        ctx.textAlign = "left";
        ctx.restore();

      } else if (dim.type === "radius") {
        const { mx: cxMM, my: cyMM } = profileToMM(dim.cx, dim.cy);
        const { cx: ccx, cy: ccy } = toCanvas(cxMM, cyMM);
        const rPx = dim.r * autoScale * zoom;
        const ang = dim.angle * Math.PI / 180;
        const ex = ccx + rPx * Math.cos(-ang);
        const ey = ccy + rPx * Math.sin(-ang);
        const lx = ccx + (rPx + 12 * zoom) * Math.cos(-ang);
        const ly = ccy + (rPx + 12 * zoom) * Math.sin(-ang);

        ctx.beginPath(); ctx.moveTo(ccx, ccy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(lx, ly); ctx.stroke();
        drawArrow(ex, ey, -ang);

        const label = `R ${fmt(dim.value)}`;
        ctx.fillStyle = dimColor;
        ctx.textAlign = "center";
        ctx.fillText(label, lx + (Math.cos(-ang) > 0 ? 20 * zoom : -20 * zoom), ly + 4 * zoom);
        ctx.textAlign = "left";

      } else if (dim.type === "angular") {
        const { vertex, p1, p2, radius, value } = dim;
        const { mx: vmx, my: vmy } = profileToMM(vertex.x, vertex.y);
        const { cx: vcx, cy: vcy } = toCanvas(vmx, vmy);
        const { mx: p1mx, my: p1my } = profileToMM(p1.x, p1.y);
        const { cx: p1cx, cy: p1cy } = toCanvas(p1mx, p1my);
        const { mx: p2mx, my: p2my } = profileToMM(p2.x, p2.y);
        const { cx: p2cx, cy: p2cy } = toCanvas(p2mx, p2my);

        const ang1 = Math.atan2(-(p1cy - vcy), p1cx - vcx);
        const ang2 = Math.atan2(-(p2cy - vcy), p2cx - vcx);
        const rPx = radius * autoScale * zoom;

        ctx.beginPath();
        ctx.arc(vcx, vcy, rPx, -ang1, -ang2, false);
        ctx.stroke();

        // Mid angle label
        let midAng = (ang1 + ang2) / 2;
        const lx = vcx + (rPx + 10 * zoom) * Math.cos(midAng);
        const ly = vcy - (rPx + 10 * zoom) * Math.sin(midAng);
        ctx.fillStyle = dimColor;
        ctx.textAlign = "center";
        ctx.fillText(`${fmt(value, 1)}°`, lx, ly);
        ctx.textAlign = "left";
      }
    });
  }

  // ── Scale notation ──
  ctx.fillStyle = "#1a3a6e";
  ctx.font = `bold ${8 * zoom}px Arial`;
  const scaleLabel = `SCALE 1:${(1 / autoScale).toFixed(1)} | `;
  const boundsLabel = `${fmt(bounds.w)} × ${fmt(bounds.h)} mm`;
  const { cx: noteX, cy: noteY } = toCanvas(MARGIN + 5, MARGIN + 8);
  ctx.fillText(scaleLabel + boundsLabel, noteX, noteY);

  // ── View label ──
  const { cx: vlX, cy: vlY } = toCanvas(drawAreaCX - 15, drawAreaY + 4);
  ctx.fillStyle = "#334155";
  ctx.font = `${7 * zoom}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("FRONT VIEW", vlX, vlY);
  ctx.textAlign = "left";
}

// ─── DXF Generator ────────────────────────────────────────────────────────────

function generateDXF(segs: Segment[], dims: Dimension[], projectInfo: { name: string; partNo: string }): string {
  const lines: string[] = [];
  const h = (g: number, v: string | number) => `  ${g}\n${v}`;

  lines.push(h(0, "SECTION"), h(2, "HEADER"));
  lines.push(h(9, "$ACADVER"), h(1, "AC1015"));
  lines.push(h(9, "$INSUNITS"), h(70, 4));
  lines.push(h(0, "ENDSEC"));

  lines.push(h(0, "SECTION"), h(2, "TABLES"));
  lines.push(h(0, "TABLE"), h(2, "LAYER"), h(70, 4));
  [["GEOMETRY", 7], ["DIMENSIONS", 3], ["CENTER", 1], ["TEXT", 2]].forEach(([name, color]) => {
    lines.push(h(0, "LAYER"), h(2, name), h(70, 0), h(62, color), h(6, "Continuous"));
  });
  lines.push(h(0, "ENDTAB"), h(0, "ENDSEC"));

  lines.push(h(0, "SECTION"), h(2, "BLOCKS"));
  lines.push(h(0, "ENDSEC"));

  lines.push(h(0, "SECTION"), h(2, "ENTITIES"));

  // Geometry entities
  segs.forEach(seg => {
    if (seg.type === "line") {
      lines.push(h(0, "LINE"), h(8, "GEOMETRY"),
        h(10, seg.startX.toFixed(4)), h(20, seg.startY.toFixed(4)), h(30, 0),
        h(11, seg.endX.toFixed(4)), h(21, seg.endY.toFixed(4)), h(31, 0));
    } else if (seg.type === "arc" && seg.centerX !== undefined) {
      lines.push(h(0, "ARC"), h(8, "GEOMETRY"),
        h(10, seg.centerX!.toFixed(4)), h(20, seg.centerY!.toFixed(4)), h(30, 0),
        h(40, (seg.radius || 0).toFixed(4)),
        h(50, (seg.startAngle || 0).toFixed(4)),
        h(51, (seg.endAngle || 360).toFixed(4)));
    }
  });

  // Dimension entities
  dims.forEach((dim, i) => {
    if (dim.type === "linear") {
      lines.push(h(0, "DIMENSION"), h(8, "DIMENSIONS"), h(1, `${fmt(dim.value)} mm`),
        h(70, dim.axis === "h" ? 32 : 33),
        h(10, dim.p1.x.toFixed(4)), h(20, dim.p1.y.toFixed(4)), h(30, 0),
        h(13, dim.p1.x.toFixed(4)), h(23, dim.p1.y.toFixed(4)), h(33, 0),
        h(14, dim.p2.x.toFixed(4)), h(24, dim.p2.y.toFixed(4)), h(34, 0));
    } else if (dim.type === "radius") {
      lines.push(h(0, "DIMENSION"), h(8, "DIMENSIONS"), h(1, `R ${fmt(dim.value)}`),
        h(70, 36),
        h(10, dim.cx.toFixed(4)), h(20, dim.cy.toFixed(4)), h(30, 0));
    }
  });

  // Title block text
  lines.push(h(0, "TEXT"), h(8, "TEXT"),
    h(10, -100), h(20, -20), h(30, 0),
    h(40, 5), h(1, `SAI ROLOTECH | ${projectInfo.name} | ${projectInfo.partNo}`));

  lines.push(h(0, "ENDSEC"), h(0, "EOF"));
  return lines.join("\n");
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AutoCADEngineeringDrawing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const {
    stations, geometry: profile,
    setStations, setRollTooling, setGcodeOutputs,
    setMaterialType, setMaterialThickness, setNumStations, setOpenSectionType,
    numStations, materialType, materialThickness, openSectionType,
    rollDiameter, shaftDiameter, clearance, stationPrefix, gcodeConfig,
  } = useCncStore();

  const [state, setState] = useState<DrawState>({
    zoom: 2.5,
    panX: 60,
    panY: 40,
    showGrid: true,
    showDims: true,
    showTitleBlock: true,
    showCenterLines: true,
    paperSize: "A3",
    scale: "1:1",
    dimStyle: "standard",
    dimColor: "#1d4ed8",
    geomColor: "#1e293b",
    centerColor: "#16a34a",
  });

  const [projectInfo, setProjectInfo] = useState({
    name: "C-CHANNEL PROFILE",
    partNo: "SRE-2024-001",
    material: "HRCA 1.5mm",
    drawn: "SAI ROLOTECH",
    scale: "1:1",
    rev: "A",
    sheet: "1/1",
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  // ─── Segments + dims (declared early so Pro Mode callbacks can use them) ──
  const segs = useMemo<Segment[]>(() => {
    if (!stations || stations.length === 0) {
      return [
        { type: "line", startX: -80, startY: 0, endX: -50, endY: 0 },
        { type: "arc", startX: -50, startY: 0, endX: -40, endY: 10, centerX: -50, centerY: 10, radius: 10, startAngle: 270, endAngle: 360 },
        { type: "line", startX: -40, startY: 10, endX: -40, endY: 40 },
        { type: "arc", startX: -40, startY: 40, endX: -30, endY: 50, centerX: -30, centerY: 40, radius: 10, startAngle: 180, endAngle: 270 },
        { type: "line", startX: -30, startY: 50, endX: 30, endY: 50 },
        { type: "arc", startX: 30, startY: 50, endX: 40, endY: 40, centerX: 30, centerY: 40, radius: 10, startAngle: 270, endAngle: 360 },
        { type: "line", startX: 40, startY: 40, endX: 40, endY: 10 },
        { type: "arc", startX: 40, startY: 10, endX: 50, endY: 0, centerX: 50, centerY: 10, radius: 10, startAngle: 180, endAngle: 270 },
        { type: "line", startX: 50, startY: 0, endX: 80, endY: 0 },
      ];
    }
    const lastStation = stations[stations.length - 1];
    return lastStation?.segments || [];
  }, [stations]);

  const paperMM = PAPER[state.paperSize];
  const dims = useMemo(() => generateDimensions(segs, getBounds(segs)), [segs]);

  // ─── Super Pro Mode state ──────────────────────────────────────────────────
  const [proMode, setProMode] = useState(false);
  const [proChat, setProChat] = useState<AutoMsg[]>([]);
  const [proInput, setProInput] = useState("");
  const [proLoading, setProLoading] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<{
    flower: "idle"|"running"|"done"|"error";
    roll:   "idle"|"running"|"done"|"error";
    gcode:  "idle"|"running"|"done"|"error";
  }>({ flower: "idle", roll: "idle", gcode: "idle" });
  const proEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { proEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [proChat]);

  // ─── Apply action tags from AI response ──────────────────────────────────
  const applyAction = useCallback((key: string, value: string) => {
    switch (key) {
      case "material_type":   setMaterialType(value as any); break;
      case "thickness":       setMaterialThickness(parseFloat(value) || 1.5); break;
      case "num_stations":    setNumStations(parseInt(value) || 6); break;
      case "section_type":    setOpenSectionType(value as any); break;
      case "part_name":       setProjectInfo(p => ({ ...p, name: value.toUpperCase() })); break;
      case "part_no":         setProjectInfo(p => ({ ...p, partNo: value })); break;
      case "material_label":  setProjectInfo(p => ({ ...p, material: value })); break;
      case "drawn_by":        setProjectInfo(p => ({ ...p, drawn: value.toUpperCase() })); break;
      case "revision":        setProjectInfo(p => ({ ...p, rev: value })); break;
      case "paper_size":      setState(p => ({ ...p, paperSize: value as any })); break;
    }
  }, [setMaterialType, setMaterialThickness, setNumStations, setOpenSectionType]);

  // ─── Pipeline runners ─────────────────────────────────────────────────────
  const runFlower = useCallback(async (geo: any, nSt: number, mat: string, thick: number) => {
    setPipelineStatus(p => ({ ...p, flower: "running" }));
    try {
      const { authFetch } = await import("../../lib/auth-fetch");
      const res = await authFetch(`${window.location.origin}/api/generate-flower`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: geo, numStations: nSt, stationPrefix: stationPrefix || "ST", materialType: mat, materialThickness: thick, openSectionType }),
      });
      if (!res.ok) throw new Error("Flower generation failed");
      const data = await res.json() as { stations: any[] };
      setStations(data.stations);
      setPipelineStatus(p => ({ ...p, flower: "done" }));
      return data.stations;
    } catch {
      setPipelineStatus(p => ({ ...p, flower: "error" }));
      return null;
    }
  }, [stationPrefix, openSectionType, setStations]);

  const runRollTooling = useCallback(async (geo: any, nSt: number, mat: string, thick: number) => {
    setPipelineStatus(p => ({ ...p, roll: "running" }));
    try {
      const { authFetch } = await import("../../lib/auth-fetch");
      const res = await authFetch(`${window.location.origin}/api/generate-roll-tooling`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: geo, numStations: nSt, stationPrefix: stationPrefix || "ST", materialThickness: thick, materialType: mat, openSectionType, rollDiameter, shaftDiameter, clearance }),
      });
      if (!res.ok) throw new Error("Roll tooling failed");
      const data = await res.json() as { rollTooling: any[] };
      setRollTooling(data.rollTooling);
      setPipelineStatus(p => ({ ...p, roll: "done" }));
      return data.rollTooling;
    } catch {
      setPipelineStatus(p => ({ ...p, roll: "error" }));
      return null;
    }
  }, [stationPrefix, openSectionType, rollDiameter, shaftDiameter, clearance, setRollTooling]);

  const runGcode = useCallback(async (geo: any, nSt: number) => {
    setPipelineStatus(p => ({ ...p, gcode: "running" }));
    try {
      const { authFetch } = await import("../../lib/auth-fetch");
      const res = await authFetch(`${window.location.origin}/api/generate-gcode`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geometry: geo, numStations: nSt, stationPrefix: stationPrefix || "ST", config: gcodeConfig }),
      });
      if (!res.ok) throw new Error("G-code failed");
      const data = await res.json() as { gcodeOutputs: any[] };
      setGcodeOutputs(data.gcodeOutputs);
      setPipelineStatus(p => ({ ...p, gcode: "done" }));
      return data.gcodeOutputs;
    } catch {
      setPipelineStatus(p => ({ ...p, gcode: "error" }));
      return null;
    }
  }, [stationPrefix, gcodeConfig, setGcodeOutputs]);

  // ─── Send message to Super Pro AI ────────────────────────────────────────
  const sendProMessage = useCallback(async (msgOverride?: string) => {
    const geo = profile || null;
    const b = geo ? getBounds(geo.segments) : null;
    const msg = (msgOverride ?? proInput).trim();
    if (!msg || proLoading) return;
    setProInput("");
    setProLoading(true);
    setProChat(prev => [...prev, { role: "user", text: msg }]);

    const profileCtx = b
      ? `Profile: ${b.w.toFixed(1)}×${b.h.toFixed(1)}mm | ${geo?.segments.length} segments | ${dims.length} auto-dims`
      : "No profile loaded — using drawing canvas data";

    const systemPrompt = `You are SAI Rolotech Super Pro Mode AI — a master roll forming engineer with 50+ years experience, powered by Gemini Pro.
You analyze AutoCAD drawings, diagnose defects, optimize parameters, and automatically execute the complete G-code pipeline.

CURRENT DRAWING DATA (LIVE):
${profileCtx}
Material: ${materialType} @ ${materialThickness}mm
Section Type: ${openSectionType}
Stations: ${numStations}
Paper: ${state.paperSize}
Project: ${projectInfo.name} | ${projectInfo.partNo} | ${projectInfo.material}
Drawn by: ${projectInfo.drawn} | Rev: ${projectInfo.rev} | Sheet: ${projectInfo.sheet}

SMART ANALYSIS RULES:
- When analyzing profile, calculate springback angle (σy/E × bend radius factor)
- For GI/PPGI: Recommend K-factor 0.44–0.50, springback 2–4°
- For HRC/CRC: Recommend K-factor 0.45–0.50, springback 3–7°
- Optimal stations = max_bend_angle / (8–15°) per station
- Always suggest specific numbers, not ranges when possible
- When cost estimating: roll set ~₹8-15K per roll, tooling lead time 2-3 weeks

YOUR POWERS — use these ACTION tags anywhere in your response:
[ACTION:material_type:GI]         → Set material (GI/PPGI/PPGL/HDG/CRC/HRC/SS304/AL6063)
[ACTION:thickness:1.5]            → Set thickness in mm
[ACTION:num_stations:8]           → Set number of forming stations
[ACTION:section_type:C-Section]   → Set section (C-Section/U-Section/Z-Section/Hat/Sigma/Omega)
[ACTION:part_name:C CHANNEL]      → Update drawing title
[ACTION:part_no:SRE-2024-001]     → Update part number
[ACTION:material_label:GI 1.5mm]  → Update material label on drawing
[ACTION:drawn_by:SAI ROLOTECH]    → Update drawn by field
[ACTION:revision:B]               → Update revision
[ACTION:paper_size:A3]            → Set paper size (A4/A3/A2)

PIPELINE TRIGGER COMMANDS — the user can say "run flower", "generate gcode", "full pipeline" etc:
When user asks to run flower → reply with: [ACTION:run_flower]
When user asks to run roll tooling → reply with: [ACTION:run_roll]
When user asks to run gcode → reply with: [ACTION:run_gcode]
When user asks to run all / full pipeline → reply with: [ACTION:run_all]

WORKFLOW:
1. Start by analyzing the profile and giving smart suggestions
2. Ask one question at a time about what they want
3. Apply actions immediately as you get info
4. When profile is ready, offer to run the full pipeline
5. After pipeline runs, summarize results

LANGUAGE: Respond in Hinglish (mix of Hindi + English). Be direct, confident, expert.
Example: "Bhai, yeh profile dekh ke lag raha hai 8 stations perfect rahenge. Material GI 1.5mm set kar deta hun. [ACTION:num_stations:8][ACTION:material_type:GI][ACTION:thickness:1.5]"`;

    try {
      const res = await fetch("/api/chatbot/master-designer", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ message: msg, history: proChat.slice(-8).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })), projectContext: systemPrompt }),
      });
      if (!res.ok) throw new Error("AI error");
      const data = await res.json() as { response: string };
      const { cleaned, actions } = parseActions(data.response);

      // Apply all non-pipeline actions immediately
      const pipelineActions = [];
      for (const act of actions) {
        if (["run_flower", "run_roll", "run_gcode", "run_all"].includes(act.key)) {
          pipelineActions.push(act.key);
        } else {
          applyAction(act.key, act.value);
        }
      }

      setProChat(prev => [...prev, { role: "ai", text: cleaned, actions: actions.filter(a => !["run_flower","run_roll","run_gcode","run_all"].includes(a.key)) }]);

      // Run pipeline steps if requested
      if (pipelineActions.includes("run_all") || (pipelineActions.includes("run_flower") && pipelineActions.includes("run_gcode"))) {
        const currentGeo = profile || null;
        const nSt = numStations;
        const mat = materialType;
        const thick = materialThickness;
        if (currentGeo) {
          setProChat(prev => [...prev, { role: "ai", text: "🔄 Full pipeline shuru kar raha hun — Flower → Roll Tooling → G-Code..." }]);
          const fl = await runFlower(currentGeo, nSt, mat, thick);
          if (fl) {
            setProChat(prev => [...prev, { role: "ai", text: `✅ Flower pattern ready — ${fl.length} stations generated!` }]);
            await runRollTooling(currentGeo, nSt, mat, thick);
            setProChat(prev => [...prev, { role: "ai", text: "✅ Roll tooling dimensions calculate ho gayi!" }]);
            const gc = await runGcode(currentGeo, nSt);
            if (gc) setProChat(prev => [...prev, { role: "ai", text: `✅ G-Code ready — ${gc.length} programs generated! Flower & G-Code tabs mein dekh sakte ho.` }]);
          } else {
            setProChat(prev => [...prev, { role: "ai", text: "❌ Profile geometry nahi mili. Pehle DXF file upload karo Setup tab mein." }]);
          }
        }
      } else if (pipelineActions.includes("run_flower")) {
        const fl = await runFlower(profile!, numStations, materialType, materialThickness);
        if (fl) setProChat(prev => [...prev, { role: "ai", text: `✅ Flower pattern ready — ${fl.length} stations! Flower tab mein dekho.` }]);
      } else if (pipelineActions.includes("run_roll")) {
        await runRollTooling(profile!, numStations, materialType, materialThickness);
        setProChat(prev => [...prev, { role: "ai", text: "✅ Roll tooling dimensions ready! Roll tab mein dekho." }]);
      } else if (pipelineActions.includes("run_gcode")) {
        const gc = await runGcode(profile!, numStations);
        if (gc) setProChat(prev => [...prev, { role: "ai", text: `✅ G-Code ready — ${gc.length} programs! G-Code tab mein dekho.` }]);
      }
    } catch {
      setProChat(prev => [...prev, { role: "ai", text: "Network error aaya — thoda ruko aur dobara try karo." }]);
    } finally {
      setProLoading(false);
    }
  }, [proInput, proLoading, proChat, profile, dims, materialType, materialThickness, openSectionType, numStations, projectInfo, applyAction, runFlower, runRollTooling, runGcode]);

  // ─── Start Super Pro Mode ─────────────────────────────────────────────────
  const startProMode = useCallback(() => {
    setProMode(true);
    setPipelineStatus({ flower: "idle", roll: "idle", gcode: "idle" });
    const b = profile ? getBounds(profile.segments) : null;
    const intro = b
      ? `Bhai! Main aapka **Super Pro Mode AI** hun 🤖\n\nAapka profile dekh liya:\n📐 Size: **${b.w.toFixed(1)} × ${b.h.toFixed(1)} mm**\n🔢 Segments: **${profile!.segments.length}**\n📏 Auto dimensions: **${dims.length}**\n\nMain aapke liye yeh kaam karunga:\n1️⃣ Smart suggestions dunga\n2️⃣ Manual input accept karunga\n3️⃣ Puri G-Code pipeline chalaunga\n\nBatao — is profile ka material aur thickness kya hai? Ya main apne aap suggest karun?`
      : `Bhai! **Super Pro Mode** active hai 🚀\n\nAbhi koi profile load nahi hai. Pehle Setup tab mein DXF upload karo, ya main drawing canvas ke data se kaam shuru karta hun.\n\nKya manual dimensions enter karne hain? Ya DXF load karne ke baad Full Pipeline chalana hai?`;
    setProChat([{ role: "ai", text: intro }]);
  }, [profile, dims]);

  const QUICK_CMDS = [
    "Profile analyze karo aur best settings suggest karo",
    "GI 1.5mm material set karo",
    "8 stations set karo",
    "Full pipeline run karo",
    "G-Code generate karo",
    "Drawing ka part number update karo",
    "Springback calculation karo",
    "Optimal bend radius suggest karo",
    "Machine speed recommend karo",
    "Roll tooling material suggest karo",
    "Cost estimate do",
    "Defect diagnosis karo",
    "Station-wise angle distribution suggest karo",
    "C-Section Z-Section mein convert karo",
  ];

  // Render
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderDrawing(ctx, canvas.width, canvas.height, segs, dims, state, paperMM, projectInfo);
  }, [segs, dims, state, paperMM, projectInfo]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ro = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
      draw();
    });
    ro.observe(container);
    const r = container.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    draw();

    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setState(p => ({ ...p, zoom: Math.min(Math.max(p.zoom * factor, 0.2), 20) }));
    };
    container.addEventListener("wheel", wheelHandler, { passive: false });

    return () => {
      ro.disconnect();
      container.removeEventListener("wheel", wheelHandler);
    };
  }, [draw]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setState(p => ({ ...p, panX: panStart.current!.panX + dx, panY: panStart.current!.panY - dy }));
  };
  const handleMouseUp = () => { setIsPanning(false); panStart.current = null; };


  // Fit to screen
  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.width;
    const ch = canvas.height;
    const scaleX = (cw - 80) / paperMM.w;
    const scaleY = (ch - 80) / paperMM.h;
    const zoom = Math.min(scaleX, scaleY);
    setState(p => ({ ...p, zoom, panX: 40, panY: 40 }));
  }, [paperMM]);

  // Export
  const exportDXF = () => {
    const dxf = generateDXF(segs, dims, { name: projectInfo.name, partNo: projectInfo.partNo });
    const blob = new Blob([dxf], { type: "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${projectInfo.partNo.replace(/[^a-zA-Z0-9]/g, "_")}_engineering_drawing.dxf`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${projectInfo.partNo.replace(/[^a-zA-Z0-9]/g, "_")}_drawing.png`;
    a.click();
  };

  const bounds = useMemo(() => getBounds(segs), [segs]);

  // Pipeline step badge helper
  const PipelineBadge = ({ label, status }: { label: string; status: "idle"|"running"|"done"|"error" }) => {
    const cfg = {
      idle:    { bg: "bg-zinc-800/60",      border: "border-zinc-700/40",    text: "text-zinc-500",   dot: "bg-zinc-600"   },
      running: { bg: "bg-amber-500/10",     border: "border-amber-500/30",   text: "text-amber-400",  dot: "bg-amber-400 animate-pulse" },
      done:    { bg: "bg-emerald-500/10",   border: "border-emerald-500/30", text: "text-emerald-400",dot: "bg-emerald-400" },
      error:   { bg: "bg-red-500/10",       border: "border-red-500/30",     text: "text-red-400",    dot: "bg-red-400"    },
    }[status];
    return (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {label}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/50 shrink-0">
        <Ruler className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-bold text-zinc-200">AutoCAD Engineering Drawing</span>
        <span className="text-[9px] text-zinc-500 hidden sm:block">Full Sheet — Dimensions + Title Block + DXF Export</span>

        <div className="ml-auto flex items-center gap-1 flex-wrap">

          {/* ── SUPER PRO MODE BUTTON ── */}
          <button
            onClick={() => { if (!proMode) startProMode(); else setProMode(false); }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-bold transition-all mr-1 ${
              proMode
                ? "bg-violet-600/30 border-violet-500/50 text-violet-300 shadow-lg shadow-violet-500/20"
                : "bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border-violet-500/40 text-violet-300 hover:from-violet-600/30 hover:to-fuchsia-600/30"
            }`}
          >
            <Zap className={`w-3 h-3 ${proMode ? "animate-pulse" : ""}`} />
            Super Pro Mode
            {proMode && <X className="w-2.5 h-2.5 ml-0.5 opacity-60" />}
          </button>

          <div className="w-px h-4 bg-zinc-700/50" />

          {/* Paper size */}
          <select
            value={state.paperSize}
            onChange={e => setState(p => ({ ...p, paperSize: e.target.value as "A4" | "A3" | "A2" }))}
            className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-1.5 py-0.5"
          >
            <option value="A4">A4 (297×210)</option>
            <option value="A3">A3 (420×297)</option>
            <option value="A2">A2 (594×420)</option>
          </select>

          {/* Toggles */}
          {([
            { key: "showGrid" as const, icon: <Grid className="w-3 h-3" />, label: "Grid", activeClass: "bg-violet-500/20 border-violet-500/40 text-violet-300" },
            { key: "showDims" as const, icon: <Ruler className="w-3 h-3" />, label: "Dims", activeClass: "bg-blue-500/20 border-blue-500/40 text-blue-300" },
            { key: "showCenterLines" as const, icon: <Layers className="w-3 h-3" />, label: "CL", activeClass: "bg-green-500/20 border-green-500/40 text-green-300" },
            { key: "showTitleBlock" as const, icon: <FileText className="w-3 h-3" />, label: "Title", activeClass: "bg-amber-500/20 border-amber-500/40 text-amber-300" },
          ] as const).map(({ key, icon, label, activeClass }) => {
            const active = state[key] as boolean;
            return (
              <button key={key}
                onClick={() => setState(p => ({ ...p, [key]: !p[key] }))}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold transition-all ${active ? activeClass : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500"}`}
              >
                {icon} {label}
              </button>
            );
          })}

          <div className="w-px h-4 bg-zinc-700/50 mx-0.5" />

          <button onClick={() => setState(p => ({ ...p, zoom: Math.min(p.zoom * 1.25, 20) }))}
            className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-all">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setState(p => ({ ...p, zoom: Math.max(p.zoom / 1.25, 0.2) }))}
            className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-all">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={fitToScreen}
            className="p-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-all" title="Fit to screen">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-zinc-700/50 mx-0.5" />
          <button onClick={() => setShowSettings(p => !p)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] transition-all ${showSettings ? "bg-zinc-700 border-zinc-600 text-zinc-200" : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500 hover:text-zinc-300"}`}>
            <Settings className="w-3 h-3" /> {showSettings ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
          <button onClick={exportDXF}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25 text-[10px] font-bold transition-all">
            <Download className="w-3 h-3" /> DXF
          </button>
          <button onClick={exportPNG}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-bold transition-all">
            <ImageIcon className="w-3 h-3" /> PNG
          </button>
        </div>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-900/60 px-3 py-2 flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Project Info</span>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(projectInfo).map(([key, val]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-[8px] text-zinc-600 capitalize">{key}</span>
                  <input value={val} onChange={e => setProjectInfo(p => ({ ...p, [key]: e.target.value }))}
                    className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-1.5 py-0.5 w-32" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Colors</span>
            <div className="flex gap-2">
              {[{ key: "geomColor", label: "Geometry" }, { key: "dimColor", label: "Dimensions" }, { key: "centerColor", label: "Center Lines" }].map(({ key, label }) => (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <span className="text-[8px] text-zinc-600">{label}</span>
                  <input type="color" value={state[key as keyof DrawState] as string}
                    onChange={e => setState(p => ({ ...p, [key]: e.target.value }))}
                    className="w-8 h-6 rounded cursor-pointer border border-zinc-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Info Bar ── */}
      <div className="flex items-center gap-3 px-3 py-1 bg-zinc-900/30 border-b border-zinc-800/30 shrink-0 text-[9px] text-zinc-600">
        <Info className="w-3 h-3 shrink-0" />
        <span>Profile: <b className="text-zinc-400">{fmt(bounds.w)} × {fmt(bounds.h)} mm</b></span>
        <span>Dims: <b className="text-blue-400">{dims.length}</b></span>
        <span>Segs: <b className="text-zinc-400">{segs.length}</b></span>
        <span>Zoom: <b className="text-zinc-400">{(state.zoom).toFixed(1)}×</b></span>
        {proMode && (
          <div className="ml-2 flex items-center gap-1.5">
            <span className="text-violet-500 font-bold">Pipeline:</span>
            <PipelineBadge label="Flower" status={pipelineStatus.flower} />
            <PipelineBadge label="Roll" status={pipelineStatus.roll} />
            <PipelineBadge label="G-Code" status={pipelineStatus.gcode} />
          </div>
        )}
        <span className="ml-auto">Mouse wheel = zoom • Drag = pan</span>
      </div>

      {/* ── Main Area (Canvas + Pro Panel) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Canvas ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* ── Super Pro Mode Panel ── */}
        {proMode && (
          <div className="w-80 shrink-0 flex flex-col border-l border-violet-500/20 bg-[#0a0a14] overflow-hidden">

            {/* Panel Header */}
            <div className="shrink-0 px-3 py-2 border-b border-violet-500/20 bg-violet-500/5">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg bg-violet-500/40 blur-md" />
                  <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-violet-200">Super Pro Mode</div>
                  <div className="text-[9px] text-violet-500">Gemini Pro · AutoCAD → G-Code Pipeline</div>
                </div>
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" />
                  <span className="text-[8px] text-violet-500 font-bold">LIVE</span>
                </div>
              </div>

              {/* Live drawing stats */}
              <div className="mt-2 grid grid-cols-3 gap-1">
                {[
                  { label: "W×H", value: `${fmt(bounds.w)}×${fmt(bounds.h)}mm` },
                  { label: "Material", value: `${materialType} ${materialThickness}mm` },
                  { label: "Stations", value: String(numStations) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-violet-500/5 border border-violet-500/15 rounded px-1.5 py-1 text-center">
                    <div className="text-[8px] text-violet-600 uppercase">{label}</div>
                    <div className="text-[9px] text-violet-300 font-bold truncate">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {proChat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600/20 border border-violet-500/30 text-violet-100"
                      : "bg-white/[0.04] border border-white/[0.07] text-zinc-300"
                  }`}>
                    {msg.role === "ai" && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <Bot className="w-3 h-3 text-violet-400" />
                        <span className="text-[9px] font-bold text-violet-400">Super Pro AI</span>
                        <Sparkles className="w-2.5 h-2.5 text-violet-500" />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    {/* Applied actions badge */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {msg.actions.map((act, ai) => (
                          <span key={ai} className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                            <CheckCircle2 className="w-2.5 h-2.5" /> {act.key}: {act.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {proLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                    <span className="text-[10px] text-zinc-500">Gemini Pro soch raha hai...</span>
                  </div>
                </div>
              )}
              <div ref={proEndRef} />
            </div>

            {/* Quick Commands */}
            {proChat.length <= 1 && !proLoading && (
              <div className="shrink-0 px-2.5 pb-1.5">
                <div className="text-[8px] text-zinc-600 uppercase tracking-wider mb-1">Quick Commands</div>
                <div className="flex flex-wrap gap-1">
                  {QUICK_CMDS.map((cmd, i) => (
                    <button key={i} onClick={() => sendProMessage(cmd)}
                      className="text-[9px] px-2 py-1 rounded-lg border border-violet-500/20 bg-violet-500/5 text-violet-400 hover:text-violet-200 hover:border-violet-500/40 transition-all text-left">
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pipeline Quick Buttons */}
            <div className="shrink-0 px-2.5 py-2 border-t border-white/[0.05] flex gap-1.5 flex-wrap">
              {[
                { label: "Flower", cmd: "Flower pattern generate karo", color: "blue" },
                { label: "Roll Tooling", cmd: "Roll tooling generate karo", color: "amber" },
                { label: "G-Code", cmd: "G-Code generate karo", color: "green" },
                { label: "Full Pipeline", cmd: "Full pipeline run karo — flower, roll tooling, aur gcode sab ek saath", color: "violet" },
              ].map(({ label, cmd, color }) => (
                <button key={label} onClick={() => sendProMessage(cmd)} disabled={proLoading}
                  className={`flex-1 min-w-[60px] px-2 py-1.5 rounded-lg text-[9px] font-bold border transition-all disabled:opacity-40 ${
                    color === "blue"   ? "bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20" :
                    color === "amber"  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20" :
                    color === "green"  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20" :
                    "bg-violet-500/15 border-violet-500/35 text-violet-300 hover:bg-violet-500/25"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="shrink-0 px-2.5 pb-2.5 pt-1 border-t border-white/[0.06]">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={proInput}
                  onChange={e => setProInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendProMessage()}
                  placeholder="Command do ya kuch pucho..."
                  className="flex-1 bg-white/[0.04] border border-violet-500/20 rounded-lg px-3 py-2 text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 transition-colors"
                  disabled={proLoading}
                />
                <button onClick={() => sendProMessage()} disabled={proLoading || !proInput.trim()}
                  className="px-3 py-2 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white disabled:opacity-40 transition-all hover:brightness-110 flex items-center">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[8px] text-zinc-700 mt-1 px-1">
                Gemini Pro · AutoCAD data → Flower → Roll → G-Code
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
