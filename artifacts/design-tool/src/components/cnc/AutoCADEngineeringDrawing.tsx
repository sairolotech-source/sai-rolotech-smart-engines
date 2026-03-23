import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  Download, ZoomIn, ZoomOut, Maximize2, FileText, Image as ImageIcon,
  Layers, Grid, Ruler, RefreshCw, Settings, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { useCncStore, type Segment } from "../../store/useCncStore";

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

  const { stations, geometry: profile } = useCncStore();

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

  // Get segments from active station or all stations
  const segs = useMemo<Segment[]>(() => {
    if (!stations || stations.length === 0) {
      // Demo C-channel profile
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
    // Use last station (final profile)
    const lastStation = stations[stations.length - 1];
    return lastStation?.segments || [];
  }, [stations]);

  const paperMM = PAPER[state.paperSize];

  const dims = useMemo(() => generateDimensions(segs, getBounds(segs)), [segs]);

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

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/50 shrink-0">
        <Ruler className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-bold text-zinc-200">AutoCAD Engineering Drawing</span>
        <span className="text-[9px] text-zinc-500 hidden sm:block">Full Sheet — Dimensions + Title Block + DXF Export</span>

        <div className="ml-auto flex items-center gap-1 flex-wrap">
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
                className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold transition-all ${
                  active
                    ? activeClass
                    : "bg-zinc-800/40 border-zinc-700/40 text-zinc-500"
                }`}
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
                  <input
                    value={val}
                    onChange={e => setProjectInfo(p => ({ ...p, [key]: e.target.value }))}
                    className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-1.5 py-0.5 w-32"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Colors</span>
            <div className="flex gap-2">
              {[
                { key: "geomColor", label: "Geometry" },
                { key: "dimColor", label: "Dimensions" },
                { key: "centerColor", label: "Center Lines" },
              ].map(({ key, label }) => (
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
        <span>Segments: <b className="text-zinc-400">{segs.length}</b></span>
        <span>Zoom: <b className="text-zinc-400">{(state.zoom).toFixed(1)}×</b></span>
        <span className="ml-auto">Mouse wheel = zoom • Drag = pan</span>
      </div>

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
    </div>
  );
}
