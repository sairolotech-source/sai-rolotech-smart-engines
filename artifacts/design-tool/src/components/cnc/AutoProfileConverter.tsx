import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, RotateCcw, Download, Info, ChevronUp, ChevronDown } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────── */
interface Segment {
  id: string;
  length: number;       // mm
  turnAngle: number;    // degrees — positive = CCW (left), negative = CW (right)
  bendRadius: number;   // inside bend radius at end corner
}

interface Point { x: number; y: number; }
interface Path { points: Point[]; closed: boolean; }

/* ─── Math helpers ──────────────────────────────────────────────────────── */
const DEG = Math.PI / 180;

function buildCenterPath(segs: Segment[]): Point[] {
  if (!segs.length) return [];
  const pts: Point[] = [{ x: 0, y: 0 }];
  let angle = 0; // starts going right
  let x = 0; let y = 0;
  for (const seg of segs) {
    x += seg.length * Math.cos(angle * DEG);
    y += seg.length * Math.sin(angle * DEG);
    pts.push({ x, y });
    angle += seg.turnAngle;
  }
  return pts;
}

function offsetPolyline(pts: Point[], offset: number, segs: Segment[], kFactor: number, thickness: number): Point[] {
  if (pts.length < 2) return [];
  const out: Point[] = [];

  for (let i = 0; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];

    if (!prev && !next) { out.push(cur); continue; }

    if (!prev) {
      // first point — use direction of first segment
      const dx = next.x - cur.x;
      const dy = next.y - cur.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      out.push({ x: cur.x - (dy / len) * offset, y: cur.y + (dx / len) * offset });
      continue;
    }
    if (!next) {
      // last point
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      out.push({ x: cur.x - (dy / len) * offset, y: cur.y + (dx / len) * offset });
      continue;
    }

    // interior point — miter
    const d1x = cur.x - prev.x; const d1y = cur.y - prev.y;
    const d2x = next.x - cur.x; const d2y = next.y - cur.y;
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
    const n1x = -d1y / len1; const n1y = d1x / len1;
    const n2x = -d2y / len2; const n2y = d2x / len2;
    const bx = (n1x + n2x); const by = (n1y + n2y);
    const blen = Math.sqrt(bx * bx + by * by);
    if (blen < 0.001) { out.push({ x: cur.x + n1x * offset, y: cur.y + n1y * offset }); continue; }
    const cross = n1x * n2y - n1y * n2x;
    const dot = n1x * n2x + n1y * n2y;
    const miterLen = offset / (blen / 2);
    out.push({ x: cur.x + (bx / blen) * miterLen, y: cur.y + (by / blen) * miterLen });
  }
  return out;
}

function svgPath(pts: Point[]): string {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");
}

function bounds(pts: Point[]) {
  if (!pts.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/* ─── Default segments (U-channel) ────────────────────────────────────── */
const DEFAULT_SEGS: Segment[] = [
  { id: "s1", length: 25, turnAngle: 90,  bendRadius: 1.5 },
  { id: "s2", length: 50, turnAngle: 90,  bendRadius: 1.5 },
  { id: "s3", length: 25, turnAngle: 0,   bendRadius: 1.5 },
];

let _id = 100;
const uid = () => `s${_id++}`;

/* ─── Component ────────────────────────────────────────────────────────── */
export function AutoProfileConverter() {
  const [thickness, setThickness] = useState(1.2);
  const [kFactor, setKFactor] = useState(0.44);  // FIX: was 0.33 (old ANSI press-brake) — DIN 6935 GI=0.44
  const [segs, setSegs] = useState<Segment[]>(DEFAULT_SEGS);
  const [showLayers, setShowLayers] = useState({ center: true, inner: true, outer: true, dims: true });
  const svgRef = useRef<SVGSVGElement>(null);

  const innerOffset = kFactor * thickness;
  const outerOffset = (1 - kFactor) * thickness;

  const centerPts = useMemo(() => buildCenterPath(segs), [segs]);
  const innerPts  = useMemo(() => offsetPolyline(centerPts, -innerOffset, segs, kFactor, thickness), [centerPts, innerOffset]);
  const outerPts  = useMemo(() => offsetPolyline(centerPts, outerOffset, segs, kFactor, thickness), [centerPts, outerOffset]);

  const allPts = useMemo(() => [...centerPts, ...innerPts, ...outerPts], [centerPts, innerPts, outerPts]);
  const box = useMemo(() => bounds(allPts), [allPts]);
  const pad = Math.max((box.maxX - box.minX), (box.maxY - box.minY)) * 0.15 + 5;
  const vbX = box.minX - pad; const vbY = box.minY - pad;
  const vbW = (box.maxX - box.minX) + pad * 2;
  const vbH = (box.maxY - box.minY) + pad * 2;

  const totalLength = useMemo(() => segs.reduce((s, g) => s + g.length, 0), [segs]);
  const bendCount = useMemo(() => segs.filter(g => Math.abs(g.turnAngle) > 0.1).length, [segs]);
  const totalBA = useMemo(() => segs.reduce((s, g) => {
    if (Math.abs(g.turnAngle) < 0.1) return s;
    return s + (Math.PI / 180) * Math.abs(g.turnAngle) * (g.bendRadius + kFactor * thickness);
  }, 0), [segs, kFactor, thickness]);
  const flatWidth = useMemo(() => totalLength + totalBA, [totalLength, totalBA]);

  const addSeg = () => setSegs(prev => [...prev, { id: uid(), length: 20, turnAngle: 90, bendRadius: 1.5 }]);
  const delSeg = (id: string) => setSegs(prev => prev.filter(s => s.id !== id));
  const moveSeg = (id: string, dir: -1 | 1) => setSegs(prev => {
    const i = prev.findIndex(s => s.id === id);
    if (i < 0) return prev;
    const ni = i + dir;
    if (ni < 0 || ni >= prev.length) return prev;
    const arr = [...prev];
    [arr[i], arr[ni]] = [arr[ni], arr[i]];
    return arr;
  });
  const updateSeg = (id: string, field: keyof Segment, val: number) =>
    setSegs(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));

  const exportSVG = () => {
    if (!svgRef.current) return;
    const blob = new Blob([svgRef.current.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "profile_layers.svg"; a.click();
  };

  const presets = [
    { name: "U-Channel 50×25", segs: [
      { id: uid(), length: 25, turnAngle: 90, bendRadius: 1.5 },
      { id: uid(), length: 50, turnAngle: 90, bendRadius: 1.5 },
      { id: uid(), length: 25, turnAngle: 0, bendRadius: 1.5 },
    ]},
    { name: "C-Channel (Lip)", segs: [
      { id: uid(), length: 10, turnAngle: 90, bendRadius: 1.0 },
      { id: uid(), length: 30, turnAngle: 90, bendRadius: 1.5 },
      { id: uid(), length: 60, turnAngle: 90, bendRadius: 1.5 },
      { id: uid(), length: 30, turnAngle: -90, bendRadius: 1.0 },
      { id: uid(), length: 10, turnAngle: 0, bendRadius: 1.0 },
    ]},
    { name: "Z-Section 25×50×25", segs: [
      { id: uid(), length: 25, turnAngle: 90, bendRadius: 1.5 },
      { id: uid(), length: 50, turnAngle: -90, bendRadius: 1.5 },
      { id: uid(), length: 25, turnAngle: 0, bendRadius: 1.5 },
    ]},
    { name: "Hat / Omega", segs: [
      { id: uid(), length: 15, turnAngle: -90, bendRadius: 1.0 },
      { id: uid(), length: 20, turnAngle: -90, bendRadius: 2.0 },
      { id: uid(), length: 40, turnAngle: -90, bendRadius: 2.0 },
      { id: uid(), length: 20, turnAngle: -90, bendRadius: 1.0 },
      { id: uid(), length: 15, turnAngle: 0, bendRadius: 1.0 },
    ]},
  ];

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden">
      {/* ── Left Panel ── */}
      <div className="w-72 shrink-0 border-r border-zinc-800/60 flex flex-col overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b border-zinc-800/40">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-[11px] font-bold text-zinc-200">Center Line → Profile Converter</span>
          </div>
          <p className="text-[9px] text-zinc-500">Segments define karo → Inner/Outer auto-generate hoga</p>
        </div>

        {/* Material params */}
        <div className="px-3 py-2 border-b border-zinc-800/40 grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">Thickness T (mm)</label>
            <input type="number" value={thickness} min={0.3} max={10} step={0.1}
              onChange={e => setThickness(Number(e.target.value))}
              className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono" />
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">K-Factor (0.3–0.5)</label>
            <input type="number" value={kFactor} min={0.28} max={0.5} step={0.01}
              onChange={e => setKFactor(Number(e.target.value))}
              className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono" />
          </div>
          <div className="col-span-2 text-[9px] text-zinc-500 flex gap-4">
            <span>Inner offset: <span className="text-cyan-400 font-mono">{(kFactor * thickness).toFixed(3)}mm</span></span>
            <span>Outer offset: <span className="text-amber-400 font-mono">{((1 - kFactor) * thickness).toFixed(3)}mm</span></span>
          </div>
        </div>

        {/* Presets */}
        <div className="px-3 py-2 border-b border-zinc-800/40">
          <label className="text-[9px] text-zinc-500 block mb-1">Quick Preset</label>
          <div className="grid grid-cols-2 gap-1">
            {presets.map(p => (
              <button key={p.name} onClick={() => setSegs(p.segs)}
                className="text-[9px] px-2 py-1 rounded bg-zinc-800/60 border border-zinc-700/30 text-zinc-300 hover:bg-violet-500/20 hover:text-violet-300 transition-colors text-left truncate">
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Segments table */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-zinc-300">Profile Segments</span>
            <button onClick={addSeg}
              className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <div className="space-y-2">
            {segs.map((seg, i) => (
              <div key={seg.id} className="rounded-lg border border-zinc-800/50 bg-zinc-900/60 overflow-hidden">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800/30 border-b border-zinc-800/40">
                  <span className="text-[9px] font-mono font-bold text-violet-400 w-14">Seg {i + 1}</span>
                  <span className="flex-1" />
                  <button onClick={() => moveSeg(seg.id, -1)} disabled={i === 0}
                    className="p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => moveSeg(seg.id, 1)} disabled={i === segs.length - 1}
                    className="p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                  <button onClick={() => delSeg(seg.id)} className="p-0.5 text-red-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
                <div className="p-2 grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="text-[8px] text-zinc-500 block">Length (mm)</label>
                    <input type="number" value={seg.length} min={1} max={500} step={0.5}
                      onChange={e => updateSeg(seg.id, "length", Number(e.target.value))}
                      className="w-full bg-zinc-800/60 border border-zinc-700/30 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 font-mono" />
                  </div>
                  <div>
                    <label className="text-[8px] text-zinc-500 block">Turn (°)</label>
                    <input type="number" value={seg.turnAngle} min={-180} max={180} step={1}
                      onChange={e => updateSeg(seg.id, "turnAngle", Number(e.target.value))}
                      className="w-full bg-zinc-800/60 border border-zinc-700/30 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 font-mono" />
                  </div>
                  <div>
                    <label className="text-[8px] text-zinc-500 block">R (mm)</label>
                    <input type="number" value={seg.bendRadius} min={0} max={50} step={0.5}
                      onChange={e => updateSeg(seg.id, "bendRadius", Number(e.target.value))}
                      className="w-full bg-zinc-800/60 border border-zinc-700/30 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 font-mono" />
                  </div>
                </div>
                {Math.abs(seg.turnAngle) > 0.1 && (
                  <div className="px-2 pb-1.5 text-[8px] text-zinc-500">
                    BA = {((Math.PI / 180) * Math.abs(seg.turnAngle) * (seg.bendRadius + kFactor * thickness)).toFixed(3)}mm
                    &nbsp;|&nbsp; Ri={seg.bendRadius}mm &nbsp;|&nbsp; Ro={(seg.bendRadius + thickness).toFixed(1)}mm
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="border-t border-zinc-800/40 px-3 py-2 space-y-1 bg-zinc-900/30">
          <div className="grid grid-cols-2 gap-x-2 text-[9px]">
            <span className="text-zinc-500">Total straight length</span><span className="font-mono text-zinc-200">{totalLength.toFixed(2)} mm</span>
            <span className="text-zinc-500">Bends</span><span className="font-mono text-zinc-200">{bendCount}</span>
            <span className="text-zinc-500">Total bend allowance</span><span className="font-mono text-cyan-400">{totalBA.toFixed(3)} mm</span>
            <span className="text-zinc-500">Flat strip width</span><span className="font-mono text-emerald-300 font-bold">{flatWidth.toFixed(2)} mm</span>
          </div>
        </div>
      </div>

      {/* ── Right Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/40 bg-zinc-900/30">
          <span className="text-[10px] font-semibold text-zinc-400">Layers:</span>
          {[
            { key: "outer", label: "Outer", color: "#f59e0b" },
            { key: "center", label: "Center", color: "#6366f1" },
            { key: "inner", label: "Inner", color: "#22d3ee" },
            { key: "dims", label: "Dimensions", color: "#6b7280" },
          ].map(({ key, label, color }) => (
            <button key={key}
              onClick={() => setShowLayers(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] border transition-all ${
                showLayers[key as keyof typeof showLayers]
                  ? "border-transparent text-zinc-200"
                  : "border-zinc-700/40 text-zinc-600"
              }`}
              style={showLayers[key as keyof typeof showLayers] ? { backgroundColor: color + "25", borderColor: color + "60", color } : {}}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: showLayers[key as keyof typeof showLayers] ? color : "#555" }} />
              {label}
            </button>
          ))}
          <span className="flex-1" />
          <button onClick={() => setSegs(DEFAULT_SEGS)}
            className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-zinc-800/60 border border-zinc-700/30 text-zinc-400 hover:text-zinc-200">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button onClick={exportSVG}
            className="flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30">
            <Download className="w-3 h-3" /> SVG Export
          </button>
        </div>

        {/* SVG Canvas */}
        <div className="flex-1 overflow-hidden bg-zinc-950 relative">
          {centerPts.length < 2 ? (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-sm">
              Koi profile nahi — left panel me segments add karo
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full"
              viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ background: "#09090b" }}>

              {/* Grid */}
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1f2937" strokeWidth="0.2" />
                </pattern>
              </defs>
              <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#grid)" />

              {/* Origin mark */}
              <circle cx={0} cy={0} r={1} fill="#374151" />
              <line x1={-3} y1={0} x2={3} y2={0} stroke="#374151" strokeWidth="0.3" />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="#374151" strokeWidth="0.3" />

              {/* OUTER profile */}
              {showLayers.outer && outerPts.length > 1 && (
                <>
                  <path d={svgPath(outerPts)} fill="none" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3,1.5" />
                  {outerPts.map((p, i) => i > 0 && i < outerPts.length - 1 && (
                    <circle key={i} cx={p.x} cy={p.y} r={0.8} fill="#f59e0b" opacity="0.5" />
                  ))}
                  {outerPts[0] && (
                    <text x={outerPts[0].x - 3} y={outerPts[0].y - 2} fontSize="2.5" fill="#f59e0b" fontFamily="monospace">OUTER</text>
                  )}
                </>
              )}

              {/* INNER profile */}
              {showLayers.inner && innerPts.length > 1 && (
                <>
                  <path d={svgPath(innerPts)} fill="none" stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="3,1.5" />
                  {innerPts.map((p, i) => i > 0 && i < innerPts.length - 1 && (
                    <circle key={i} cx={p.x} cy={p.y} r={0.8} fill="#22d3ee" opacity="0.5" />
                  ))}
                  {innerPts[0] && (
                    <text x={innerPts[0].x + 1} y={innerPts[0].y + 3} fontSize="2.5" fill="#22d3ee" fontFamily="monospace">INNER</text>
                  )}
                </>
              )}

              {/* CENTER LINE */}
              {showLayers.center && centerPts.length > 1 && (
                <>
                  <path d={svgPath(centerPts)} fill="none" stroke="#818cf8" strokeWidth="1.0" strokeDasharray="6,2,1,2" />
                  {centerPts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={1} fill="#818cf8" />
                  ))}
                  {centerPts[0] && (
                    <text x={centerPts[0].x + 1} y={centerPts[0].y - 2} fontSize="2.5" fill="#818cf8" fontFamily="monospace">CENTER</text>
                  )}
                </>
              )}

              {/* Dimension annotations */}
              {showLayers.dims && centerPts.length > 1 && segs.map((seg, i) => {
                const p1 = centerPts[i]; const p2 = centerPts[i + 1];
                if (!p1 || !p2) return null;
                const mx = (p1.x + p2.x) / 2; const my = (p1.y + p2.y) / 2;
                const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const nx = -dy / len; const ny = dx / len;
                return (
                  <g key={seg.id}>
                    <text x={mx + nx * 4} y={my + ny * 4} fontSize="2.5" fill="#a1a1aa" textAnchor="middle" fontFamily="monospace">
                      {seg.length}
                    </text>
                    {Math.abs(seg.turnAngle) > 0.1 && p2 && (
                      <text x={p2.x + 2} y={p2.y - 2} fontSize="2" fill="#d97706" fontFamily="monospace">
                        {seg.turnAngle > 0 ? "+" : ""}{seg.turnAngle}°
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Thickness indicator at first segment */}
              {showLayers.dims && innerPts[0] && outerPts[0] && (
                <g>
                  <line x1={innerPts[0].x} y1={innerPts[0].y}
                        x2={outerPts[0].x} y2={outerPts[0].y}
                        stroke="#6b7280" strokeWidth="0.3" strokeDasharray="0.5,0.5" />
                  <text x={(innerPts[0].x + outerPts[0].x) / 2 + 1}
                        y={(innerPts[0].y + outerPts[0].y) / 2}
                        fontSize="2" fill="#6b7280" fontFamily="monospace">T={thickness}</text>
                </g>
              )}
            </svg>
          )}
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-4 px-4 py-1.5 border-t border-zinc-800/40 bg-zinc-900/20 text-[9px] text-zinc-500">
          <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-amber-400" style={{borderTop:"1px dashed #f59e0b"}} />Outer = CL + {((1-kFactor)*thickness).toFixed(3)}mm</span>
          <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-indigo-400" />Center Line (Design Base)</span>
          <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-cyan-400" style={{borderTop:"1px dashed #22d3ee"}} />Inner = CL - {(kFactor*thickness).toFixed(3)}mm</span>
          <span className="ml-auto text-zinc-600">Flat Strip = {flatWidth.toFixed(2)}mm | Bends = {bendCount} | Segments = {segs.length}</span>
        </div>

        {/* Formula panel */}
        <div className="px-4 py-2 border-t border-zinc-800/40 bg-zinc-900/40 grid grid-cols-3 gap-4 text-[9px]">
          <div>
            <div className="text-zinc-500 mb-1">Inner Offset Formula</div>
            <div className="font-mono text-cyan-300">K × T = {kFactor} × {thickness} = <span className="font-bold">{(kFactor*thickness).toFixed(3)}mm</span></div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">Outer Offset Formula</div>
            <div className="font-mono text-amber-300">(1-K) × T = {(1-kFactor).toFixed(2)} × {thickness} = <span className="font-bold">{((1-kFactor)*thickness).toFixed(3)}mm</span></div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">At each bend</div>
            <div className="font-mono text-zinc-300">Ri = R &nbsp;|&nbsp; Ro = R + T &nbsp;|&nbsp; Rc = R + K×T</div>
          </div>
        </div>
      </div>
    </div>
  );
}
