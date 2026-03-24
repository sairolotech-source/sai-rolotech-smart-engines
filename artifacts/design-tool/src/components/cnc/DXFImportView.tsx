import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload, ZoomIn, ZoomOut, Move, Maximize2, Layers, Info, Download, RefreshCw, Eye, EyeOff, Grid } from "lucide-react";

// ─── DXF Entity Types ─────────────────────────────────────────────────────────

interface DXFLine { type: "LINE"; layer: string; x1: number; y1: number; x2: number; y2: number; color?: number; }
interface DXFArc  { type: "ARC";  layer: string; cx: number; cy: number; radius: number; startAngle: number; endAngle: number; color?: number; }
interface DXFCircle { type: "CIRCLE"; layer: string; cx: number; cy: number; radius: number; color?: number; }
interface DXFPoly { type: "LWPOLYLINE"; layer: string; pts: { x: number; y: number }[]; closed: boolean; color?: number; }
interface DXFText { type: "TEXT"; layer: string; x: number; y: number; text: string; height: number; color?: number; }

type DXFEntity = DXFLine | DXFArc | DXFCircle | DXFPoly | DXFText;

interface DXFLayer { name: string; color: number; visible: boolean; entityCount: number; }
interface DXFStats { entities: number; lines: number; arcs: number; circles: number; polylines: number; texts: number; layers: number; width: number; height: number; }

// ─── AutoCAD color map ────────────────────────────────────────────────────────

const ACI_COLORS: Record<number, string> = {
  0: "#ffffff", 1: "#ff0000", 2: "#ffff00", 3: "#00ff00",
  4: "#00ffff", 5: "#0000ff", 6: "#ff00ff", 7: "#ffffff",
  8: "#808080", 9: "#c0c0c0", 30: "#ff8000", 40: "#ffaa00",
  50: "#ffd700", 70: "#00ff80", 140: "#00aaff", 190: "#aa00ff",
  250: "#404040", 251: "#606060", 252: "#808080", 253: "#a0a0a0",
  254: "#c0c0c0", 255: "#e0e0e0",
};

function getColor(n: number): string {
  return ACI_COLORS[n] ?? "#e4e4e7";
}

// ─── DXF Parser ───────────────────────────────────────────────────────────────

function parseDXF(text: string): { entities: DXFEntity[]; layers: DXFLayer[]; stats: DXFStats } {
  const lines = text.split(/\r?\n/);
  const entities: DXFEntity[] = [];
  const layerMap = new Map<string, DXFLayer>();
  let i = 0;

  const readGroup = (): [string, string] => {
    while (i < lines.length && !lines[i]?.trim()) i++;
    const code = lines[i]?.trim() ?? "";
    const val = lines[i + 1]?.trim() ?? "";
    i += 2;
    return [code, val];
  };

  const ensureLayer = (name: string, color = 7) => {
    if (!layerMap.has(name)) layerMap.set(name, { name, color, visible: true, entityCount: 0 });
    layerMap.get(name)!.entityCount++;
  };

  // Quick entity section scan
  const entityStart = text.indexOf("ENTITIES");
  if (entityStart < 0) {
    // Try to parse as simplified DXF
  }

  // Parse layers from TABLES section
  let layerSection = false;
  const textLines = text.split(/\r?\n/);
  for (let li = 0; li < textLines.length; li++) {
    const code = textLines[li]?.trim();
    const val = textLines[li + 1]?.trim();
    if (code === "0" && val === "LAYER") layerSection = true;
    if (layerSection && code === "2" && val && !["LTYPE", "STYLE", "BLOCK"].includes(val)) {
      const layerName = val;
      let lColor = 7;
      for (let lj = li + 2; lj < Math.min(li + 20, textLines.length); lj++) {
        if (textLines[lj]?.trim() === "62") { lColor = parseInt(textLines[lj + 1]?.trim() ?? "7") || 7; break; }
      }
      ensureLayer(layerName, Math.abs(lColor));
      layerSection = false;
    }
  }

  // Parse entities
  i = 0;
  let inEntities = false;
  while (i < textLines.length) {
    const code = textLines[i]?.trim();
    const val = textLines[i + 1]?.trim();
    i += 2;
    if (!code && !val) continue;
    if (code === "0" && val === "SECTION") continue;
    if (code === "2" && val === "ENTITIES") { inEntities = true; continue; }
    if (code === "0" && val === "ENDSEC") { inEntities = false; continue; }
    if (!inEntities) continue;

    if (code === "0" && val === "LINE") {
      let layer = "0", x1 = 0, y1 = 0, x2 = 0, y2 = 0, color = 7;
      while (i < textLines.length) {
        const c = textLines[i]?.trim(), v = textLines[i+1]?.trim() ?? "";
        if (c === "0") break; i += 2;
        if (c === "8") layer = v;
        else if (c === "10") x1 = parseFloat(v) || 0;
        else if (c === "20") y1 = parseFloat(v) || 0;
        else if (c === "11") x2 = parseFloat(v) || 0;
        else if (c === "21") y2 = parseFloat(v) || 0;
        else if (c === "62") color = Math.abs(parseInt(v) || 7);
      }
      ensureLayer(layer, color);
      entities.push({ type: "LINE", layer, x1, y1, x2, y2, color });
    } else if (code === "0" && val === "ARC") {
      let layer = "0", cx = 0, cy = 0, radius = 1, start = 0, end = 360, color = 7;
      while (i < textLines.length) {
        const c = textLines[i]?.trim(), v = textLines[i+1]?.trim() ?? "";
        if (c === "0") break; i += 2;
        if (c === "8") layer = v;
        else if (c === "10") cx = parseFloat(v) || 0;
        else if (c === "20") cy = parseFloat(v) || 0;
        else if (c === "40") radius = parseFloat(v) || 1;
        else if (c === "50") start = parseFloat(v) || 0;
        else if (c === "51") end = parseFloat(v) || 360;
        else if (c === "62") color = Math.abs(parseInt(v) || 7);
      }
      ensureLayer(layer, color);
      entities.push({ type: "ARC", layer, cx, cy, radius, startAngle: start, endAngle: end, color });
    } else if (code === "0" && val === "CIRCLE") {
      let layer = "0", cx = 0, cy = 0, radius = 1, color = 7;
      while (i < textLines.length) {
        const c = textLines[i]?.trim(), v = textLines[i+1]?.trim() ?? "";
        if (c === "0") break; i += 2;
        if (c === "8") layer = v;
        else if (c === "10") cx = parseFloat(v) || 0;
        else if (c === "20") cy = parseFloat(v) || 0;
        else if (c === "40") radius = parseFloat(v) || 1;
        else if (c === "62") color = Math.abs(parseInt(v) || 7);
      }
      ensureLayer(layer, color);
      entities.push({ type: "CIRCLE", layer, cx, cy, radius, color });
    } else if (code === "0" && val === "LWPOLYLINE") {
      let layer = "0", pts: { x: number; y: number }[] = [], closed = false, color = 7;
      let cx = 0, cy = 0, expectY = false;
      while (i < textLines.length) {
        const c = textLines[i]?.trim(), v = textLines[i+1]?.trim() ?? "";
        if (c === "0") break; i += 2;
        if (c === "8") layer = v;
        else if (c === "70") closed = (parseInt(v) & 1) === 1;
        else if (c === "10") { cx = parseFloat(v) || 0; expectY = true; }
        else if (c === "20" && expectY) { cy = parseFloat(v) || 0; pts.push({ x: cx, y: cy }); expectY = false; }
        else if (c === "62") color = Math.abs(parseInt(v) || 7);
      }
      ensureLayer(layer, color);
      if (pts.length > 0) entities.push({ type: "LWPOLYLINE", layer, pts, closed, color });
    } else if (code === "0" && (val === "TEXT" || val === "MTEXT")) {
      let layer = "0", x = 0, y = 0, text = "", height = 2.5, color = 7;
      while (i < textLines.length) {
        const c = textLines[i]?.trim(), v = textLines[i+1]?.trim() ?? "";
        if (c === "0") break; i += 2;
        if (c === "8") layer = v;
        else if (c === "10") x = parseFloat(v) || 0;
        else if (c === "20") y = parseFloat(v) || 0;
        else if (c === "40") height = parseFloat(v) || 2.5;
        else if (c === "1") text = v.replace(/\\P/g, " ").replace(/\\[a-zA-Z][^;]*;/g, "");
        else if (c === "62") color = Math.abs(parseInt(v) || 7);
      }
      ensureLayer(layer, color);
      if (text) entities.push({ type: "TEXT", layer, x, y, text, height, color });
    }
  }

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  entities.forEach(e => {
    if (e.type === "LINE") { minX=Math.min(minX,e.x1,e.x2); minY=Math.min(minY,e.y1,e.y2); maxX=Math.max(maxX,e.x1,e.x2); maxY=Math.max(maxY,e.y1,e.y2); }
    else if (e.type === "ARC" || e.type === "CIRCLE") { minX=Math.min(minX,e.cx-e.radius); minY=Math.min(minY,e.cy-e.radius); maxX=Math.max(maxX,e.cx+e.radius); maxY=Math.max(maxY,e.cy+e.radius); }
    else if (e.type === "LWPOLYLINE") { e.pts.forEach(p => { minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); }); }
    else if (e.type === "TEXT") { minX=Math.min(minX,e.x); minY=Math.min(minY,e.y); maxX=Math.max(maxX,e.x+e.text.length*e.height*0.6); maxY=Math.max(maxY,e.y+e.height); }
  });

  const layers = Array.from(layerMap.values());
  const stats: DXFStats = {
    entities: entities.length, layers: layers.length,
    lines: entities.filter(e => e.type === "LINE").length,
    arcs: entities.filter(e => e.type === "ARC").length,
    circles: entities.filter(e => e.type === "CIRCLE").length,
    polylines: entities.filter(e => e.type === "LWPOLYLINE").length,
    texts: entities.filter(e => e.type === "TEXT").length,
    width: isFinite(maxX - minX) ? maxX - minX : 0,
    height: isFinite(maxY - minY) ? maxY - minY : 0,
  };

  return { entities, layers, stats };
}

// ─── Sample DXF (Roll Tooling Cross Section) ──────────────────────────────────

const SAMPLE_DXF = `  0
SECTION
  2
ENTITIES
  0
LINE
  8
PROFILE
 62
     1
 10
0.0
 20
0.0
 11
50.0
 21
0.0
  0
LINE
  8
PROFILE
 62
     1
 10
50.0
 20
0.0
 11
50.0
 21
20.0
  0
ARC
  8
PROFILE
 62
     3
 10
45.0
 20
20.0
 40
5.0
 50
0.0
 51
90.0
  0
LINE
  8
PROFILE
 62
     1
 10
45.0
 20
25.0
 11
5.0
 21
25.0
  0
ARC
  8
PROFILE
 62
     3
 10
5.0
 20
20.0
 40
5.0
 50
90.0
 51
180.0
  0
LINE
  8
PROFILE
 62
     1
 10
0.0
 20
20.0
 11
0.0
 21
0.0
  0
LINE
  8
DIMENSION
 62
     9
 10
-5.0
 20
0.0
 11
-5.0
 21
25.0
  0
LINE
  8
DIMENSION
 62
     9
 10
0.0
 20
-5.0
 11
50.0
 21
-5.0
  0
CIRCLE
  8
CENTER_MARKS
 62
     8
 10
25.0
 20
12.5
 40
0.5
  0
LINE
  8
HIDDEN
 62
     8
 10
10.0
 20
5.0
 11
40.0
 21
5.0
  0
LINE
  8
HIDDEN
 62
     8
 10
10.0
 20
20.0
 11
40.0
 21
20.0
  0
TEXT
  8
ANNOTATION
 62
     7
 10
18.0
 20
-9.0
 40
3.0
  1
50mm C-CHANNEL OP1
  0
TEXT
  8
ANNOTATION
 62
     7
 10
2.0
 20
10.0
 40
2.5
  1
25H
  0
LWPOLYLINE
  8
HATCH_BOUNDARY
 62
     2
 70
     1
 10
10.0
 20
0.0
 10
40.0
 20
0.0
 10
40.0
 20
5.0
 10
10.0
 20
5.0
  0
ENDSEC
  0
EOF`;

// ─── CAD Viewer Canvas ────────────────────────────────────────────────────────

function CADCanvas({ entities, layers, showGrid, hiddenLayers, onMeasure }:
  { entities: DXFEntity[]; layers: DXFLayer[]; showGrid: boolean; hiddenLayers: Set<string>; onMeasure: (msg: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const [cursor, setCursor] = useState("default");
  const [measurePt, setMeasurePt] = useState<{ x: number; y: number } | null>(null);

  const W = 800, H = 520;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  entities.forEach(e => {
    if (e.type === "LINE") { minX=Math.min(minX,e.x1,e.x2); minY=Math.min(minY,e.y1,e.y2); maxX=Math.max(maxX,e.x1,e.x2); maxY=Math.max(maxY,e.y1,e.y2); }
    else if (e.type === "ARC"||e.type==="CIRCLE") { minX=Math.min(minX,e.cx-e.radius); minY=Math.min(minY,e.cy-e.radius); maxX=Math.max(maxX,e.cx+e.radius); maxY=Math.max(maxY,e.cy+e.radius); }
    else if (e.type === "LWPOLYLINE") e.pts.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});
    else if (e.type === "TEXT") { minX=Math.min(minX,e.x); minY=Math.min(minY,e.y); }
  });

  const dw = maxX - minX || 100, dh = maxY - minY || 100;
  const scaleX = (W * 0.85) / dw, scaleY = (H * 0.85) / dh;
  const baseScale = Math.min(scaleX, scaleY);
  const scale = baseScale * zoom;
  const ox = pan.x + (W - dw * scale) / 2 - minX * scale;
  const oy = pan.y + (H + dh * scale) / 2 + minY * scale;

  const tx = (x: number) => ox + x * scale;
  const ty = (y: number) => oy - y * scale;

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    setZoom(z => Math.max(0.05, Math.min(50, z * factor)));
  }, []);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setCursor("grabbing");
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setPan(p => ({
      x: p.x + e.clientX - lastPosRef.current.x,
      y: p.y + e.clientY - lastPosRef.current.y,
    }));
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }, [dragging]);
  const onMouseUp = useCallback(() => { setDragging(false); setCursor("grab"); }, []);

  const onClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (scale <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;
    const worldX = (svgX - ox) / scale;
    const worldY = -(svgY - oy) / scale;
    if (measurePt) {
      const dist = Math.hypot(worldX - measurePt.x, worldY - measurePt.y);
      onMeasure(`Distance: ${dist.toFixed(3)} mm  (${measurePt.x.toFixed(2)},${measurePt.y.toFixed(2)}) → (${worldX.toFixed(2)},${worldY.toFixed(2)})`);
      setMeasurePt(null);
    } else {
      setMeasurePt({ x: worldX, y: worldY });
      onMeasure(`Point: (${worldX.toFixed(2)}, ${worldY.toFixed(2)}) — click another point to measure distance`);
    }
  }, [measurePt, onMeasure, ox, oy, scale]);

  const gridLines: React.ReactNode[] = [];
  if (showGrid) {
    const gridSize = Math.max(1, Math.round(20 / zoom)) * zoom;
    for (let x = ((pan.x % gridSize) + W) % gridSize; x < W; x += gridSize) {
      gridLines.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />);
    }
    for (let y = ((pan.y % gridSize) + H) % gridSize; y < H; y += gridSize) {
      gridLines.push(<line key={`gy${y}`} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />);
    }
    gridLines.push(<line key="ax" x1={pan.x} y1={0} x2={pan.x} y2={H} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />);
    gridLines.push(<line key="ay" x1={0} y1={pan.y} x2={W} y2={pan.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />);
  }

  const barWorld = Math.round(Math.max(10, dw / 5) / 10) * 10;
  const barPx = barWorld * scale;
  const bx = 20, by = H - 20;

  return (
    <svg viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "100%", borderRadius: 10, display: "block", cursor, userSelect: "none", background: "#07090f" }}
      onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp} onClick={onClick}
    >
      {gridLines}

      {entities.map((e, i) => {
        if (hiddenLayers.has(e.layer)) return null;
        const col = getColor(e.color ?? 7);

        if (e.type === "LINE") {
          const layerName = e.layer.toLowerCase();
          const sw = layerName.includes("hidden") ? 0.8 : layerName.includes("dimension") ? 0.7 : 1.5;
          const dash = layerName.includes("hidden") ? "4,3" : layerName.includes("dimension") ? "2,4" : undefined;
          return <line key={i} x1={tx(e.x1)} y1={ty(e.y1)} x2={tx(e.x2)} y2={ty(e.y2)} stroke={col} strokeWidth={sw} strokeDasharray={dash} />;
        } else if (e.type === "ARC") {
          const r = e.radius * scale;
          const sa = -(e.startAngle * Math.PI / 180);
          const ea = -(e.endAngle * Math.PI / 180);
          const cx = tx(e.cx), cy2 = ty(e.cy);
          const sx = cx + r * Math.cos(ea), sy = cy2 + r * Math.sin(ea);
          const ex = cx + r * Math.cos(sa), ey = cy2 + r * Math.sin(sa);
          let sweep = ea - sa;
          if (sweep < 0) sweep += Math.PI * 2;
          const largeArc = sweep > Math.PI ? 1 : 0;
          return <path key={i} d={`M${sx},${sy} A${r},${r} 0 ${largeArc},0 ${ex},${ey}`} fill="none" stroke={col} strokeWidth={1.5} />;
        } else if (e.type === "CIRCLE") {
          const r = e.radius * scale;
          return <circle key={i} cx={tx(e.cx)} cy={ty(e.cy)} r={r} fill="none" stroke={col} strokeWidth={r < 3 ? 1 : 1.5} />;
        } else if (e.type === "LWPOLYLINE") {
          const d = e.pts.map((p, j) => `${j === 0 ? "M" : "L"}${tx(p.x)},${ty(p.y)}`).join(" ") + (e.closed ? " Z" : "");
          return <path key={i} d={d} fill="none" stroke={col} strokeWidth={1.5} />;
        } else if (e.type === "TEXT") {
          const fs = Math.max(8, Math.min(e.height * scale, 24));
          return <text key={i} x={tx(e.x)} y={ty(e.y)} fill={col} fontSize={fs} fontFamily="sans-serif">{e.text}</text>;
        }
        return null;
      })}

      {measurePt && (
        <circle cx={tx(measurePt.x)} cy={ty(measurePt.y)} r={5} fill="#f59e0b" />
      )}

      <line x1={bx} y1={by} x2={bx + barPx} y2={by} stroke="#52525b" strokeWidth={1.5} />
      <line x1={bx} y1={by - 4} x2={bx} y2={by + 4} stroke="#52525b" strokeWidth={1.5} />
      <line x1={bx + barPx} y1={by - 4} x2={bx + barPx} y2={by + 4} stroke="#52525b" strokeWidth={1.5} />
      <text x={bx + barPx / 2} y={by - 6} fill="#52525b" fontSize="10" fontFamily="sans-serif" textAnchor="middle">{barWorld}mm</text>

      <text x={W - 45} y={H - 8} fill="#3f3f46" fontSize="10" fontFamily="sans-serif">{(zoom * 100).toFixed(0)}%</text>
    </svg>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DXFImportView() {
  const [entities, setEntities] = useState<DXFEntity[]>([]);
  const [layers, setLayers] = useState<DXFLayer[]>([]);
  const [stats, setStats] = useState<DXFStats | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  const [showGrid, setShowGrid] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [filename, setFilename] = useState("");
  const [activePanel, setActivePanel] = useState<"layers" | "entities" | "info">("layers");
  const [measureMsg, setMeasureMsg] = useState("");

  function loadDXF(text: string, name: string) {
    const result = parseDXF(text);
    setEntities(result.entities);
    setLayers(result.layers);
    setStats(result.stats);
    setFilename(name);
    setLoaded(true);
    setHiddenLayers(new Set());
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => loadDXF(ev.target?.result as string, f.name);
    reader.readAsText(f);
  }

  function toggleLayer(name: string) {
    setHiddenLayers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  const visibleEntities = entities.filter(e => !hiddenLayers.has(e.layer));

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#070710", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#b45309,#92400e)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(180,83,9,0.35)" }}>
            <span style={{ fontSize: 18, color: "#fff" }}>⬢</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>DXF Native Import — CAD Viewer</div>
            <div style={{ fontSize: 10, color: "#52525b" }}>AutoCAD DXF — LINE · ARC · CIRCLE · LWPOLYLINE · TEXT · Layers</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => setShowGrid(g => !g)}
            style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${showGrid ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`, background: showGrid ? "rgba(245,158,11,0.1)" : "transparent", color: showGrid ? "#fbbf24" : "#52525b", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Grid style={{ width: 11, height: 11 }} />Grid
          </button>
          <button onClick={() => loadDXF(SAMPLE_DXF, "C-Channel_CrossSection.dxf")}
            style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#a1a1aa", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Load Sample
          </button>
          <label style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#b45309,#92400e)", color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Upload style={{ width: 13, height: 13 }} />Open DXF File
            <input type="file" accept=".dxf,.DXF" style={{ display: "none" }} onChange={handleUpload} />
          </label>
        </div>
      </div>

      {!loaded ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 72, opacity: 0.15 }}>⬢</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#3f3f46" }}>No DXF Loaded</div>
          <div style={{ fontSize: 13, color: "#3f3f46", textAlign: "center", maxWidth: 320 }}>
            Upload an AutoCAD .dxf file or click "Load Sample" to see the C-Channel cross-section
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {["LINE entities", "ARC / CIRCLE", "LWPOLYLINE", "TEXT", "Layers", "Zoom + Pan"].map((f, i) => (
              <div key={i} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#52525b" }}>✓ {f}</div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr", overflow: "hidden" }}>
          {/* Left panel */}
          <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 3, flexShrink: 0 }}>
              {(["layers", "entities", "info"] as const).map(p => (
                <button key={p} onClick={() => setActivePanel(p)}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", background: activePanel === p ? "rgba(180,83,9,0.2)" : "transparent", color: activePanel === p ? "#fbbf24" : "#52525b" }}>
                  {p}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto" }}>
              {activePanel === "layers" && (
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#52525b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{layers.length} Layers</div>
                  {layers.map(layer => (
                    <div key={layer.name} onClick={() => toggleLayer(layer.name)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", borderRadius: 8, marginBottom: 3, background: hiddenLayers.has(layer.name) ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)", cursor: "pointer", border: "1px solid rgba(255,255,255,0.04)", opacity: hiddenLayers.has(layer.name) ? 0.4 : 1 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: getColor(layer.color), flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#e4e4e7" }}>{layer.name}</div>
                        <div style={{ fontSize: 9, color: "#52525b" }}>{layer.entityCount} entities</div>
                      </div>
                      {hiddenLayers.has(layer.name) ? <EyeOff style={{ width: 11, height: 11, color: "#3f3f46" }} /> : <Eye style={{ width: 11, height: 11, color: "#52525b" }} />}
                    </div>
                  ))}
                </div>
              )}

              {activePanel === "entities" && (
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#52525b", marginBottom: 6, textTransform: "uppercase" }}>{visibleEntities.length} Visible</div>
                  {visibleEntities.slice(0, 80).map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 6px", borderRadius: 6, marginBottom: 2, background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: getColor(e.color ?? 7), flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#a1a1aa", width: 70 }}>{e.type}</span>
                      <span style={{ fontSize: 9, color: "#52525b" }}>{e.layer}</span>
                    </div>
                  ))}
                  {visibleEntities.length > 80 && <div style={{ fontSize: 10, color: "#3f3f46", padding: 6 }}>+{visibleEntities.length - 80} more...</div>}
                </div>
              )}

              {activePanel === "info" && stats && (() => {
                // Smart validation & profile detection
                const ratio = stats.height > 0 ? stats.width / stats.height : 0;
                const hasArcs = stats.arcs > 0;
                const profileGuess = ratio > 3 ? "U-Section / Hat" : ratio > 1.5 ? "C-Section / Z-Section" : ratio > 0.5 ? "Sigma / Omega" : "Closed / Tube";
                const warnings: { icon: string; msg: string; color: string }[] = [];
                if (stats.entities < 3) warnings.push({ icon: "⚠️", msg: "Bahut kam entities — incomplete DXF", color: "#ef4444" });
                if (stats.layers > 20) warnings.push({ icon: "⚠️", msg: `${stats.layers} layers — complex drawing`, color: "#f59e0b" });
                if (!hasArcs) warnings.push({ icon: "ℹ️", msg: "No arcs found — sharp corners only", color: "#06b6d4" });
                if (stats.width > 500) warnings.push({ icon: "ℹ️", msg: "Wide profile — verify scale (mm)", color: "#8b5cf6" });
                const qualityScore = Math.min(100, Math.round(
                  (stats.entities > 5 ? 30 : 10) +
                  (hasArcs ? 20 : 0) +
                  (stats.layers > 0 && stats.layers < 15 ? 20 : 10) +
                  (stats.width > 0 && stats.height > 0 ? 30 : 0)
                ));
                const qColor = qualityScore >= 80 ? "#16a34a" : qualityScore >= 50 ? "#f59e0b" : "#ef4444";

                return (
                  <div style={{ padding: "12px 10px" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", marginBottom: 10 }}>{filename}</div>

                    {/* Quality score */}
                    <div style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 8, background: `${qColor}11`, border: `1px solid ${qColor}33` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>DXF Quality Score</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: qColor }}>{qualityScore}/100</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, marginTop: 6 }}>
                        <div style={{ height: "100%", width: `${qualityScore}%`, background: qColor, borderRadius: 4, transition: "width 1s ease" }} />
                      </div>
                    </div>

                    {/* Profile guess */}
                    <div style={{ marginBottom: 12, padding: "7px 10px", borderRadius: 7, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>🔍 Detected Profile: </span>
                      <span style={{ fontSize: 10, color: "#fff" }}>{profileGuess}</span>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                        Aspect ratio: {ratio.toFixed(2)} ({stats.width.toFixed(1)}×{stats.height.toFixed(1)}mm)
                      </div>
                    </div>

                    {/* Warnings */}
                    {warnings.length > 0 && (
                      <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                        {warnings.map((w, i) => (
                          <div key={i} style={{ fontSize: 10, padding: "5px 8px", borderRadius: 6, background: `${w.color}11`, border: `1px solid ${w.color}33`, color: w.color }}>
                            {w.icon} {w.msg}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stats */}
                    {[
                      { l: "Total Entities", v: stats.entities.toString(), c: "#60a5fa" },
                      { l: "Lines", v: stats.lines.toString(), c: "#e4e4e7" },
                      { l: "Arcs", v: stats.arcs.toString(), c: "#34d399" },
                      { l: "Circles", v: stats.circles.toString(), c: "#a78bfa" },
                      { l: "Polylines", v: stats.polylines.toString(), c: "#fbbf24" },
                      { l: "Texts", v: stats.texts.toString(), c: "#71717a" },
                      { l: "Layers", v: stats.layers.toString(), c: "#f59e0b" },
                      { l: "Width (X)", v: `${stats.width.toFixed(2)} mm`, c: "#e4e4e7" },
                      { l: "Height (Y)", v: `${stats.height.toFixed(2)} mm`, c: "#e4e4e7" },
                    ].map((s, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ fontSize: 11, color: "#71717a" }}>{s.l}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: s.c }}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Canvas */}
          <div style={{ position: "relative", overflow: "hidden" }}>
            <CADCanvas entities={entities} layers={layers} showGrid={showGrid} hiddenLayers={hiddenLayers} onMeasure={setMeasureMsg} />
            <div style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(0,0,0,0.5)", fontSize: 10, color: "#52525b" }}>
              🖱 Scroll = Zoom · Drag = Pan · {filename}
            </div>
            {stats && (
              <div style={{ position: "absolute", top: 10, right: 10, padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.6)", display: "flex", gap: 12 }}>
                {[
                  { l: "Lines", v: stats.lines, c: "#e4e4e7" },
                  { l: "Arcs", v: stats.arcs, c: "#34d399" },
                  { l: "Circles", v: stats.circles, c: "#a78bfa" },
                  { l: "Polys", v: stats.polylines, c: "#fbbf24" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: "#52525b" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
