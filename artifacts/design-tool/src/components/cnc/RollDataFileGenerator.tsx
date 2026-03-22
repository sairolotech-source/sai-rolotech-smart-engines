import React, { useState, useMemo, useCallback } from "react";
import JSZip from "jszip";
import {
  Download, FileText, Package, ChevronLeft, ChevronRight, Eye,
  Layers, Info, CheckCircle, AlertTriangle, Settings, RefreshCw
} from "lucide-react";
import { useCncStore, type Segment, type RollToolingResult } from "../../store/useCncStore";

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function segToSVGPath(segs: Segment[], scale: number, dx: number, dy: number, flipY = false): string {
  if (!segs || segs.length === 0) return "";
  const pts: string[] = [];
  let first = true;

  segs.forEach(seg => {
    if (seg.type === "line") {
      const x1 = dx + seg.startX * scale;
      const y1 = dy + (flipY ? -seg.startY : seg.startY) * scale;
      const x2 = dx + seg.endX * scale;
      const y2 = dy + (flipY ? -seg.endY : seg.endY) * scale;
      if (first) { pts.push(`M ${x1.toFixed(2)} ${y1.toFixed(2)}`); first = false; }
      pts.push(`L ${x2.toFixed(2)} ${y2.toFixed(2)}`);

    } else if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
      const cx = dx + seg.centerX * scale;
      const cy = dy + (flipY ? -seg.centerY : seg.centerY) * scale;
      const r = seg.radius * scale;
      const sa = (seg.startAngle || 0) * (Math.PI / 180);
      const ea = (seg.endAngle || 360) * (Math.PI / 180);
      const startX = cx + r * Math.cos(sa);
      const startY = cy + (flipY ? r * Math.sin(sa) : -r * Math.sin(sa));
      const endX   = cx + r * Math.cos(ea);
      const endY   = cy + (flipY ? r * Math.sin(ea) : -r * Math.sin(ea));
      let sweep = ea - sa;
      if (sweep < 0) sweep += Math.PI * 2;
      const large = sweep > Math.PI ? 1 : 0;
      const sweepFlag = flipY ? 1 : 0;
      if (first) { pts.push(`M ${startX.toFixed(2)} ${startY.toFixed(2)}`); first = false; }
      else pts.push(`L ${startX.toFixed(2)} ${startY.toFixed(2)}`);
      pts.push(`A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} ${sweepFlag} ${endX.toFixed(2)} ${endY.toFixed(2)}`);
    }
  });
  return pts.join(" ");
}

function getBounds(segs: Segment[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  segs.forEach(s => {
    const pts = getSegPoints(s);
    pts.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
  });
  if (!isFinite(minX)) { return { minX: -50, maxX: 50, minY: -10, maxY: 10, w: 100, h: 20 }; }
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

function getSegPoints(seg: Segment): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  if (seg.type === "line") {
    pts.push({ x: seg.startX, y: seg.startY }, { x: seg.endX, y: seg.endY });
  } else if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
    const sa = (seg.startAngle || 0) * Math.PI / 180;
    const ea = (seg.endAngle || 360) * Math.PI / 180;
    let sweep = ea - sa;
    if (sweep <= 0) sweep += Math.PI * 2;
    for (let i = 0; i <= 12; i++) {
      const t = sa + sweep * i / 12;
      pts.push({ x: seg.centerX + seg.radius * Math.cos(t), y: seg.centerY + seg.radius * Math.sin(t) });
    }
  }
  return pts;
}

function fmt(v: number, d = 2) { return isFinite(v) ? v.toFixed(d) : "—"; }

// ─── Station SVG builder ──────────────────────────────────────────────────────

function buildStationSVG(
  stationIndex: number,
  stationLabel: string,
  stripSegs: Segment[],
  rt: RollToolingResult | null,
  projectName: string,
  material: string,
  thickness: number,
) {
  const W = 800;   // SVG canvas width
  const H = 600;   // SVG canvas height
  const MARGIN = 40;
  const TITLE_H = 60;
  const FOOTER_H = 55;
  const drawW = W - MARGIN * 2;
  const drawH = H - TITLE_H - FOOTER_H - MARGIN;

  // 3 zones: UP roll | STRIP | DOWN roll (each 1/3)
  const zoneH = drawH / 3;
  const zoneY0 = TITLE_H + MARGIN / 2;

  // ── Compute bounds ──
  const stripBounds = getBounds(stripSegs);
  const upSegs = rt?.rollProfile?.upperRoll || [];
  const dnSegs = rt?.rollProfile?.lowerRoll || [];
  const upBounds = getBounds(upSegs.length > 0 ? upSegs : stripSegs);
  const dnBounds = getBounds(dnSegs.length > 0 ? dnSegs : stripSegs);

  // Scale to fit each zone
  const stripScaleX = drawW / (stripBounds.w + 40) * 0.8;
  const stripScaleY = zoneH / (stripBounds.h + 20) * 0.75;
  const stripScale = Math.min(stripScaleX, stripScaleY, 3);

  const upScaleX = drawW / (upBounds.w + 40) * 0.8;
  const upScaleY = zoneH / (upBounds.h + 20) * 0.75;
  const upScale = Math.min(upScaleX, upScaleY, 3);

  const dnScaleX = drawW / (dnBounds.w + 40) * 0.8;
  const dnScaleY = zoneH / (dnBounds.h + 20) * 0.75;
  const dnScale = Math.min(dnScaleX, dnScaleY, 3);

  // Centers for each zone
  const zone1CX = W / 2;
  const zone1CY = zoneY0 + zoneH * 0.5;
  const zone2CY = zoneY0 + zoneH * 1.5;
  const zone3CY = zoneY0 + zoneH * 2.5;

  // Profile paths
  const upCX = zone1CX - ((upBounds.minX + upBounds.maxX) / 2) * upScale;
  const upCY = zone1CY - ((upBounds.minY + upBounds.maxY) / 2) * upScale;
  const upPath = segToSVGPath(upSegs.length > 0 ? upSegs : stripSegs, upScale, upCX, upCY, false);

  const stripCX = zone1CX - ((stripBounds.minX + stripBounds.maxX) / 2) * stripScale;
  const stripCY = zone2CY - ((stripBounds.minY + stripBounds.maxY) / 2) * stripScale;
  const stripPath = segToSVGPath(stripSegs, stripScale, stripCX, stripCY, false);

  const dnCX = zone1CX - ((dnBounds.minX + dnBounds.maxX) / 2) * dnScale;
  const dnCY = zone3CY - ((dnBounds.minY + dnBounds.maxY) / 2) * dnScale;
  const dnPath = segToSVGPath(dnSegs.length > 0 ? dnSegs : stripSegs, dnScale, dnCX, dnCY, true);

  // Roll specs
  const stNum = stationIndex + 1;
  const upOD   = rt?.upperRollOD   || rt?.rollProfile?.rollDiameter || 0;
  const upID   = rt?.upperRollID   || rt?.rollProfile?.shaftDiameter || 0;
  const upW    = rt?.upperRollWidth || rt?.rollProfile?.rollWidth || 0;
  const dnOD   = rt?.lowerRollOD   || rt?.rollProfile?.rollDiameter || 0;
  const dnID   = rt?.lowerRollID   || rt?.rollProfile?.shaftDiameter || 0;
  const dnW    = rt?.lowerRollWidth || rt?.rollProfile?.rollWidth || 0;
  const rollGap = rt?.rollGap ?? 0;
  const mfgMat  = rt?.mfgSpec?.rollMaterial || "EN31 / D3";
  const mfgHard = rt?.mfgSpec?.rollHardness || "58–62 HRC";
  const surf    = rt?.mfgSpec?.surfaceTreatment || "Hard Chrome / Nitride";
  const tolOD   = rt?.mfgSpec?.toleranceOD || "±0.02 mm";
  const tolFace = rt?.mfgSpec?.toleranceFace || "±0.01 mm";
  const phase   = rt?.behavior?.phase || "MAIN";
  const upAction = rt?.behavior?.upperRollAction || "Upper forming roll";
  const dnAction = rt?.behavior?.lowerRollAction || "Lower forming roll";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      text { font-family: Arial, sans-serif; }
      .title { font-size:14px; font-weight:bold; fill:#1a2744; }
      .subtitle { font-size:10px; fill:#334155; }
      .label { font-size:9px; fill:#475569; }
      .value { font-size:10px; font-weight:bold; fill:#1e293b; }
      .zone-label { font-size:11px; font-weight:bold; }
      .dim { font-size:8px; fill:#1d4ed8; }
      .warn { font-size:8px; fill:#d97706; }
      .up-roll { stroke:#1d4ed8; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .strip { stroke:#059669; stroke-width:2.5; fill:rgba(16,185,129,0.08); stroke-linecap:round; stroke-linejoin:round; }
      .dn-roll { stroke:#dc2626; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; }
      .centerline { stroke:#94a3b8; stroke-width:0.8; stroke-dasharray:8,4,2,4; }
      .dim-line { stroke:#1d4ed8; stroke-width:0.7; }
      .zone-bg-up { fill:#eff6ff; }
      .zone-bg-strip { fill:#f0fdf4; }
      .zone-bg-dn { fill:#fef2f2; }
      .border { stroke:#1e293b; stroke-width:1.5; fill:white; }
      .inner-border { stroke:#334155; stroke-width:0.8; fill:none; }
      .sep { stroke:#e2e8f0; stroke-width:1; }
      .title-bg { fill:#1e3a5f; }
      .title-text { fill:white; }
    </style>
    <!-- Grid pattern -->
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e8edf4" stroke-width="0.4"/>
    </pattern>
  </defs>

  <!-- Sheet border -->
  <rect x="0" y="0" width="${W}" height="${H}" class="border"/>
  <rect x="8" y="8" width="${W-16}" height="${H-16}" class="inner-border"/>

  <!-- Title bar -->
  <rect x="8" y="8" width="${W-16}" height="${TITLE_H-10}" class="title-bg"/>
  <text x="20" y="30" class="title" fill="white">SAI ROLOTECH SMART ENGINES — ROLL DATA SHEET</text>
  <text x="20" y="48" class="subtitle" fill="#93c5fd">Project: ${projectName}  |  Material: ${material}  |  Thickness: ${fmt(thickness)} mm</text>
  <text x="${W-16}" y="30" text-anchor="end" class="title" fill="#fbbf24">ST-${String(stNum).padStart(2,"0")}</text>
  <text x="${W-16}" y="48" text-anchor="end" class="subtitle" fill="#93c5fd">${stationLabel}  |  Phase: ${phase}</text>

  <!-- Background grid -->
  <rect x="8" y="${TITLE_H}" width="${W-16}" height="${H - TITLE_H - FOOTER_H}" fill="url(#grid)"/>

  <!-- Zone backgrounds -->
  <rect x="8" y="${zoneY0}" width="${W-16}" height="${zoneH}" class="zone-bg-up" opacity="0.6"/>
  <rect x="8" y="${zoneY0 + zoneH}" width="${W-16}" height="${zoneH}" class="zone-bg-strip" opacity="0.6"/>
  <rect x="8" y="${zoneY0 + zoneH*2}" width="${W-16}" height="${zoneH}" class="zone-bg-dn" opacity="0.6"/>

  <!-- Zone separators -->
  <line x1="8" y1="${zoneY0 + zoneH}" x2="${W-8}" y2="${zoneY0 + zoneH}" class="sep"/>
  <line x1="8" y1="${zoneY0 + zoneH*2}" x2="${W-8}" y2="${zoneY0 + zoneH*2}" class="sep"/>

  <!-- Zone labels (left side) -->
  <rect x="8" y="${zoneY0}" width="70" height="${zoneH}" fill="#dbeafe" opacity="0.8"/>
  <text transform="translate(43, ${zoneY0 + zoneH * 0.5}) rotate(-90)" text-anchor="middle" class="zone-label" fill="#1d4ed8">UP-${stNum}</text>
  <rect x="8" y="${zoneY0+zoneH}" width="70" height="${zoneH}" fill="#dcfce7" opacity="0.8"/>
  <text transform="translate(43, ${zoneY0 + zoneH * 1.5}) rotate(-90)" text-anchor="middle" class="zone-label" fill="#059669">STRIP</text>
  <rect x="8" y="${zoneY0+zoneH*2}" width="70" height="${zoneH}" fill="#fee2e2" opacity="0.8"/>
  <text transform="translate(43, ${zoneY0 + zoneH * 2.5}) rotate(-90)" text-anchor="middle" class="zone-label" fill="#dc2626">DN-${stNum}</text>

  <!-- Right spec panel -->
  <rect x="${W-150}" y="${zoneY0}" width="142" height="${zoneH*3}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.8"/>

  <!-- UP Roll specs -->
  <text x="${W-145}" y="${zoneY0+14}" class="label" font-weight="bold" fill="#1d4ed8">UPPER ROLL (UP-${stNum})</text>
  <text x="${W-145}" y="${zoneY0+26}" class="label">OD: <tspan class="value">${fmt(upOD)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+38}" class="label">ID/Bore: <tspan class="value">${fmt(upID)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+50}" class="label">Width: <tspan class="value">${fmt(upW)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+62}" class="label">${upAction.substring(0,25)}</text>

  <!-- Strip specs -->
  <text x="${W-145}" y="${zoneY0+zoneH+14}" class="label" font-weight="bold" fill="#059669">STRIP PROFILE</text>
  <text x="${W-145}" y="${zoneY0+zoneH+26}" class="label">Width: <tspan class="value">${fmt(stripBounds.w)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+zoneH+38}" class="label">Height: <tspan class="value">${fmt(stripBounds.h)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+zoneH+50}" class="label">Roll Gap: <tspan class="value">${fmt(rollGap)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+zoneH+62}" class="label">Pass-line: <tspan class="value">✓</tspan></text>

  <!-- DN Roll specs -->
  <text x="${W-145}" y="${zoneY0+zoneH*2+14}" class="label" font-weight="bold" fill="#dc2626">LOWER ROLL (DN-${stNum})</text>
  <text x="${W-145}" y="${zoneY0+zoneH*2+26}" class="label">OD: <tspan class="value">${fmt(dnOD)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+zoneH*2+38}" class="label">ID/Bore: <tspan class="value">${fmt(dnID)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+zoneH*2+50}" class="label">Width: <tspan class="value">${fmt(dnW)} mm</tspan></text>
  <text x="${W-145}" y="${zoneY0+zoneH*2+62}" class="label">${dnAction.substring(0,25)}</text>

  <!-- Center lines (vertical) -->
  <line x1="${W/2}" y1="${zoneY0}" x2="${W/2}" y2="${zoneY0 + zoneH*3}" class="centerline"/>
  <!-- Center line (horizontal) per zone -->
  <line x1="80" y1="${zone1CY}" x2="${W-152}" y2="${zone1CY}" class="centerline"/>
  <line x1="80" y1="${zone2CY}" x2="${W-152}" y2="${zone2CY}" class="centerline"/>
  <line x1="80" y1="${zone3CY}" x2="${W-152}" y2="${zone3CY}" class="centerline"/>

  <!-- UP Roll profile -->
  ${upPath ? `<path d="${upPath}" class="up-roll"/>` : `<text x="${W/2}" y="${zone1CY+5}" text-anchor="middle" class="label" fill="#94a3b8">Upper Roll Profile (generate roll tooling first)</text>`}

  <!-- Strip cross-section profile -->
  ${stripPath ? `<path d="${stripPath}" class="strip"/>` : `<text x="${W/2}" y="${zone2CY+5}" text-anchor="middle" class="label" fill="#94a3b8">Strip Profile (define profile in Setup)</text>`}

  <!-- DOWN Roll profile -->
  ${dnPath ? `<path d="${dnPath}" class="dn-roll"/>` : `<text x="${W/2}" y="${zone3CY+5}" text-anchor="middle" class="label" fill="#94a3b8">Lower Roll Profile (generate roll tooling first)</text>`}

  <!-- Dimension: UP Roll width -->
  ${upW > 0 ? `
  <line x1="${zone1CX - upW*upScale*0.5}" y1="${zone1CY + zoneH*0.35}" x2="${zone1CX + upW*upScale*0.5}" y2="${zone1CY + zoneH*0.35}" class="dim-line"/>
  <line x1="${zone1CX - upW*upScale*0.5}" y1="${zone1CY + zoneH*0.28}" x2="${zone1CX - upW*upScale*0.5}" y2="${zone1CY + zoneH*0.4}" class="dim-line"/>
  <line x1="${zone1CX + upW*upScale*0.5}" y1="${zone1CY + zoneH*0.28}" x2="${zone1CX + upW*upScale*0.5}" y2="${zone1CY + zoneH*0.4}" class="dim-line"/>
  <text x="${zone1CX}" y="${zone1CY + zoneH*0.35 + 10}" text-anchor="middle" class="dim">Ø${fmt(upOD)} / w:${fmt(upW)}</text>` : ""}

  <!-- Dimension: Strip width -->
  <text x="${zone1CX}" y="${zone2CY + zoneH*0.35}" text-anchor="middle" class="dim">W: ${fmt(stripBounds.w)} mm  H: ${fmt(stripBounds.h)} mm</text>

  <!-- Dimension: DN Roll width -->
  ${dnW > 0 ? `<text x="${zone1CX}" y="${zone3CY - zoneH*0.35}" text-anchor="middle" class="dim">Ø${fmt(dnOD)} / w:${fmt(dnW)}</text>` : ""}

  <!-- Footer / Title Block -->
  <rect x="8" y="${H - FOOTER_H - 2}" width="${W-16}" height="${FOOTER_H}" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="0.8"/>

  <!-- Footer grid (5 cols) -->
  ${[0,1,2,3,4].map(i => `<line x1="${8 + (W-16)*i/5}" y1="${H-FOOTER_H-2}" x2="${8 + (W-16)*i/5}" y2="${H-2}" stroke="#e2e8f0" stroke-width="0.6"/>`).join("")}

  <text x="20" y="${H-FOOTER_H+12}" class="label" fill="#64748b">MATERIAL</text>
  <text x="20" y="${H-FOOTER_H+26}" class="value">${mfgMat}</text>

  <text x="${20+(W-16)*1/5}" y="${H-FOOTER_H+12}" class="label" fill="#64748b">HARDNESS</text>
  <text x="${20+(W-16)*1/5}" y="${H-FOOTER_H+26}" class="value">${mfgHard}</text>

  <text x="${20+(W-16)*2/5}" y="${H-FOOTER_H+12}" class="label" fill="#64748b">SURFACE</text>
  <text x="${20+(W-16)*2/5}" y="${H-FOOTER_H+26}" class="value">${surf}</text>

  <text x="${20+(W-16)*3/5}" y="${H-FOOTER_H+12}" class="label" fill="#64748b">TOL OD / FACE</text>
  <text x="${20+(W-16)*3/5}" y="${H-FOOTER_H+26}" class="value">${tolOD} / ${tolFace}</text>

  <text x="${20+(W-16)*4/5}" y="${H-FOOTER_H+12}" class="label" fill="#64748b">DATE / REV</text>
  <text x="${20+(W-16)*4/5}" y="${H-FOOTER_H+26}" class="value">${new Date().toLocaleDateString("en-IN")} / A</text>

  <!-- Footer bottom row -->
  <text x="20" y="${H-12}" class="label" fill="#94a3b8">SAI ROLOTECH SMART ENGINES v2.2.0  |  Station ${stNum} of ${stationLabel}</text>
  <text x="${W-16}" y="${H-12}" text-anchor="end" class="label" fill="#94a3b8">ST-${String(stNum).padStart(2,"0")}_${stationLabel.replace(/\s+/g,"_").toUpperCase()}.svg</text>
</svg>`;
}

// ─── Preview component ────────────────────────────────────────────────────────

function StationPreviewCard({
  index, label, selected, onClick, hasRollData,
}: {
  index: number; label: string; selected: boolean; onClick: () => void; hasRollData: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${
        selected
          ? "bg-blue-500/20 border-blue-500/50 text-blue-200"
          : "bg-zinc-900/40 border-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
      }`}>
      <span className={`text-[10px] font-black w-8 shrink-0 ${selected ? "text-blue-400" : "text-zinc-600"}`}>
        ST{String(index + 1).padStart(2, "0")}
      </span>
      <span className="text-[10px] truncate">{label}</span>
      <span className={`ml-auto shrink-0 ${hasRollData ? "text-green-500" : "text-zinc-700"}`}>
        {hasRollData ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      </span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RollDataFileGenerator() {
  const { stations, rollTooling, profile, thickness, stripWidth } = useCncStore();

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [projectName, setProjectName] = useState("C-CHANNEL LINE-01");
  const [downloading, setDownloading] = useState(false);
  const [singleDownloading, setSingleDownloading] = useState<number | null>(null);

  // Build SVG for a station
  const buildSVG = useCallback((idx: number) => {
    const station = stations[idx];
    const rt = rollTooling[idx] || null;
    const label = station?.label || `Station ${idx + 1}`;
    const segs = station?.segments || [];
    const mat = profile?.material || "CRCA";
    const thick = thickness || 1.5;
    return buildStationSVG(idx, label, segs, rt, projectName, mat, thick);
  }, [stations, rollTooling, profile, thickness, projectName]);

  // Selected station SVG
  const previewSVG = useMemo(() => {
    if (stations.length === 0) {
      // Demo when no stations
      return buildStationSVG(0, "Demo Station 1",
        [
          { type: "line", startX: -80, startY: 0, endX: -50, endY: 0 },
          { type: "arc", startX: -50, startY: 0, endX: -40, endY: 10, centerX: -50, centerY: 10, radius: 10, startAngle: 270, endAngle: 360 },
          { type: "line", startX: -40, startY: 10, endX: -40, endY: 40 },
          { type: "line", startX: -40, startY: 40, endX: 40, endY: 40 },
          { type: "line", startX: 40, startY: 40, endX: 40, endY: 10 },
          { type: "arc", startX: 40, startY: 10, endX: 50, endY: 0, centerX: 50, centerY: 10, radius: 10, startAngle: 180, endAngle: 270 },
          { type: "line", startX: 50, startY: 0, endX: 80, endY: 0 },
        ],
        null, projectName, "CRCA", 1.5
      );
    }
    return buildSVG(Math.min(selectedIdx, stations.length - 1));
  }, [buildSVG, selectedIdx, stations.length, projectName]);

  // Download single station
  const downloadSingle = useCallback(async (idx: number) => {
    setSingleDownloading(idx);
    try {
      const svg = buildSVG(idx);
      const station = stations[idx];
      const label = (station?.label || `Station_${idx + 1}`).replace(/\s+/g, "_").toUpperCase();
      const filename = `ST${String(idx + 1).padStart(2, "0")}_${label}.svg`;
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setSingleDownloading(null);
    }
  }, [buildSVG, stations]);

  // Download all as ZIP
  const downloadAllZip = useCallback(async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("Roll_Data_Files") as JSZip;

      const count = Math.max(stations.length, 1);
      for (let i = 0; i < count; i++) {
        const svg = buildSVG(i);
        const station = stations[i];
        const label = (station?.label || `Station_${i + 1}`).replace(/\s+/g, "_").toUpperCase();
        const filename = `ST${String(i + 1).padStart(2, "0")}_${label}.svg`;
        folder.file(filename, svg);
      }

      // Add index CSV
      const csvLines = ["Station,Label,Upper OD,Upper ID,Upper Width,Lower OD,Lower ID,Lower Width,Roll Gap,Phase,Material"];
      for (let i = 0; i < stations.length; i++) {
        const rt = rollTooling[i];
        const st = stations[i];
        csvLines.push([
          i + 1, st?.label || `ST-${i + 1}`,
          rt?.upperRollOD || "", rt?.upperRollID || "", rt?.upperRollWidth || "",
          rt?.lowerRollOD || "", rt?.lowerRollID || "", rt?.lowerRollWidth || "",
          rt?.rollGap || "", rt?.behavior?.phase || "MAIN",
          rt?.mfgSpec?.rollMaterial || "EN31",
        ].join(","));
      }
      folder.file("Roll_Data_Index.csv", csvLines.join("\n"));

      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${projectName.replace(/\s+/g, "_")}_Roll_Data_Files.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }, [buildSVG, stations, rollTooling, projectName]);

  const stationCount = Math.max(stations.length, 1);
  const safeIdx = Math.min(selectedIdx, stationCount - 1);

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/50 shrink-0">
        <Layers className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-bold text-zinc-200">Roll Data File Generator</span>
        <span className="text-[9px] text-zinc-500 hidden sm:block">Har station ke liye alag SVG — UP roll / Strip profile / DOWN roll</span>

        <div className="ml-auto flex items-center gap-2">
          <input value={projectName} onChange={e => setProjectName(e.target.value)}
            placeholder="Project name..." className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-0.5 w-40" />
          <button onClick={downloadAllZip} disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1 rounded border bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-bold transition-all disabled:opacity-50">
            {downloading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Package className="w-3 h-3" />}
            Download ZIP (All {stationCount} Files)
          </button>
        </div>
      </div>

      {/* Info bar */}
      {stations.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[9px] text-amber-400">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Demo mode — pehle Setup → Flower Pattern → Roll Tooling generate karo. Tabhi real roll data files export honge.
        </div>
      )}
      {stations.length > 0 && rollTooling.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[9px] text-amber-400">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Stations mil gaye — lekin Roll Tooling abhi generate nahi hua. Roll Tooling tab mein jaake "Generate" karo phir vapas ao.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Station List */}
        <div className="w-44 shrink-0 border-r border-zinc-800/60 bg-zinc-900/30 flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 border-b border-zinc-800/40">
            <span className="text-[9px] text-zinc-500 uppercase tracking-widest">Stations ({stationCount})</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {stations.length > 0 ? stations.map((st, i) => (
              <StationPreviewCard key={i} index={i} label={st.label || `Station ${i + 1}`}
                selected={safeIdx === i} onClick={() => setSelectedIdx(i)}
                hasRollData={!!rollTooling[i]} />
            )) : (
              <StationPreviewCard index={0} label="Demo Station 1"
                selected={true} onClick={() => {}} hasRollData={false} />
            )}
          </div>

          {/* Navigation buttons */}
          <div className="p-2 border-t border-zinc-800/40 flex gap-1">
            <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
              disabled={safeIdx === 0}
              className="flex-1 flex items-center justify-center py-1 rounded border border-zinc-700/40 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[9px] text-zinc-600 flex items-center justify-center w-12">{safeIdx + 1}/{stationCount}</span>
            <button onClick={() => setSelectedIdx(i => Math.min(stationCount - 1, i + 1))}
              disabled={safeIdx === stationCount - 1}
              className="flex-1 flex items-center justify-center py-1 rounded border border-zinc-700/40 text-zinc-500 hover:text-zinc-200 disabled:opacity-30 transition-all">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download current */}
          <button
            onClick={() => downloadSingle(safeIdx)}
            disabled={singleDownloading !== null}
            className="mx-2 mb-2 flex items-center justify-center gap-1.5 py-1.5 rounded border bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25 text-[10px] font-bold transition-all disabled:opacity-50">
            {singleDownloading === safeIdx
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <Download className="w-3 h-3" />}
            Download ST-{String(safeIdx + 1).padStart(2, "0")}
          </button>
        </div>

        {/* Right: SVG Preview */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Preview header */}
          <div className="flex items-center gap-2 px-3 py-1 border-b border-zinc-800/40 bg-zinc-900/20 shrink-0">
            <Eye className="w-3 h-3 text-zinc-500" />
            <span className="text-[9px] text-zinc-500">
              Preview: ST-{String(safeIdx + 1).padStart(2, "0")} — {stations[safeIdx]?.label || "Demo Station"}
            </span>
            <div className="ml-auto flex gap-2 text-[8px] text-zinc-600">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span> UP Roll</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block"></span> Strip</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block"></span> DN Roll</span>
            </div>
          </div>

          {/* SVG Preview */}
          <div className="flex-1 overflow-auto bg-zinc-800/30 p-4 flex items-center justify-center">
            <div
              className="bg-white rounded shadow-2xl max-w-full"
              style={{ maxHeight: "calc(100vh - 160px)" }}
              dangerouslySetInnerHTML={{ __html: previewSVG }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
