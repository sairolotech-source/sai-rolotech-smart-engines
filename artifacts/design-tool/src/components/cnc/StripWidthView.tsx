import React, { useState, useRef, useEffect, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Ruler, Copy, Check } from "lucide-react";

interface BendDeduction {
  bendIndex: number;
  angle: number;
  radius: number;
  kFactor: number;
  bendAllowance: number;
  bendDeduction: number;
  neutralAxisShift: number;
  arcLength: number;
}

const K_FACTORS: Record<string, number> = {
  GI: 0.45, CR: 0.42, HR: 0.48, SS: 0.50, AL: 0.38,
  MS: 0.44, CU: 0.40, TI: 0.52, PP: 0.35, HSLA: 0.50,
};

function calcBendAllowance(angle: number, radius: number, thickness: number, kFactor: number): number {
  const rad = (Math.abs(angle) * Math.PI) / 180;
  return rad * (radius + kFactor * thickness);
}

function calcBendDeduction(angle: number, radius: number, thickness: number, kFactor: number): number {
  const ba = calcBendAllowance(angle, radius, thickness, kFactor);
  const ossb = (radius + thickness) * Math.tan(((Math.abs(angle) * Math.PI) / 180) / 2);
  return 2 * ossb - ba;
}

export function StripWidthView() {
  const { geometry: rawGeometry, materialType, materialThickness: thickness } = useCncStore();
  const geometry = rawGeometry ?? { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  const [customBendRadius, setCustomBendRadius] = useState(2.0);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 400 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const kFactor = K_FACTORS[materialType] ?? 0.45;

  const bendDeductions: BendDeduction[] = useMemo(() => geometry.bendPoints.map((bp, i) => {
    const angle = bp.angle;
    const radius = bp.radius > 0 ? bp.radius : customBendRadius;
    const ba = calcBendAllowance(angle, radius, thickness, kFactor);
    const bd = calcBendDeduction(angle, radius, thickness, kFactor);
    const neutralAxis = radius + kFactor * thickness;
    const arcLen = ((Math.abs(angle) * Math.PI) / 180) * neutralAxis;
    return { bendIndex: i + 1, angle, radius, kFactor, bendAllowance: ba, bendDeduction: bd, neutralAxisShift: neutralAxis - radius, arcLength: arcLen };
  }), [geometry.bendPoints, customBendRadius, thickness, kFactor]);

  const flatLengths = useMemo(() => geometry.segments.map(seg => Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY)), [geometry.segments]);

  const totalFlatLength = flatLengths.reduce((s, l) => s + l, 0);
  const totalBendAllowance = bendDeductions.reduce((s, b) => s + b.bendAllowance, 0);
  const totalBendDeduction = bendDeductions.reduce((s, b) => s + b.bendDeduction, 0);
  const stripWidth = totalFlatLength + totalBendAllowance - totalBendDeduction;
  const netStripWidth = Math.max(stripWidth, totalFlatLength);

  const w = dims.w;
  const h = dims.h;
  const margin = 80;
  const totalW = netStripWidth;
  const scale = Math.min((w - 2 * margin) / Math.max(totalW, 1), 5);
  const startX = (w - totalW * scale) / 2;
  const cy = h / 2;
  const stripH = 40;

  const bendMarkers: { x: number; bendW: number; angle: number; idx: number }[] = [];
  let accX = startX;
  flatLengths.forEach((len, i) => {
    const segW = len * scale;
    if (i < bendDeductions.length) {
      const bendX = accX + segW;
      const bw = Math.max(bendDeductions[i].bendAllowance * scale, 4);
      bendMarkers.push({ x: bendX, bendW: bw, angle: bendDeductions[i].angle, idx: i });
      accX = bendX + bw;
    } else {
      accX += segW;
    }
  });

  const copyWidth = () => {
    navigator.clipboard.writeText(netStripWidth.toFixed(2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <Ruler className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Strip Width Calculator</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SVG Pro</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1">
          <span className="text-[10px] text-emerald-400">Strip Width:</span>
          <span className="text-sm font-bold text-emerald-300">{netStripWidth.toFixed(2)} mm</span>
          <button onClick={copyWidth} className="p-0.5 hover:bg-white/[0.1] rounded">
            {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3 text-emerald-400" />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 relative">
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#0a0a1a" }}>
            {Array.from({ length: Math.floor(w / 30) }, (_, i) => (
              <line key={`gv${i}`} x1={i * 30} y1={0} x2={i * 30} y2={h} stroke="rgba(255,255,255,0.03)" />
            ))}
            {Array.from({ length: Math.floor(h / 30) }, (_, i) => (
              <line key={`gh${i}`} x1={0} y1={i * 30} x2={w} y2={i * 30} stroke="rgba(255,255,255,0.03)" />
            ))}

            {!geometry.segments.length ? (
              <text x={w / 2} y={h / 2} fill="#555" fontSize="14" fontFamily="sans-serif" textAnchor="middle">Load a profile to calculate strip width</text>
            ) : (
              <>
                <text x={15} y={25} fill="#888" fontSize="10" fontFamily="sans-serif">{materialType} | t={thickness}mm | K={kFactor} | {geometry.bendPoints.length} bends</text>

                <rect x={startX} y={cy - stripH / 2} width={totalW * scale} height={stripH} rx={3} fill="rgba(59,130,246,0.1)" stroke="rgba(59,130,246,0.4)" strokeWidth={2} />

                {bendMarkers.map(bm => (
                  <g key={bm.idx}>
                    <rect x={bm.x} y={cy - stripH / 2 - 5} width={bm.bendW} height={stripH + 10} fill="rgba(239,68,68,0.15)" />
                    <line x1={bm.x} y1={cy - stripH / 2 - 10} x2={bm.x} y2={cy + stripH / 2 + 10} stroke="rgba(239,68,68,0.6)" strokeWidth={1} strokeDasharray="4,2" />
                    <text x={bm.x + bm.bendW / 2} y={cy - stripH / 2 - 14} fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">B{bm.idx + 1}</text>
                    <text x={bm.x + bm.bendW / 2} y={cy + stripH / 2 + 18} fill="#ef4444" fontSize="8" fontFamily="sans-serif" textAnchor="middle">{bm.angle.toFixed(0)}°</text>
                  </g>
                ))}

                <line x1={startX} y1={cy + stripH / 2 + 30} x2={startX} y2={cy + stripH / 2 + 40} stroke="#22c55e" strokeWidth={1.5} />
                <line x1={startX} y1={cy + stripH / 2 + 35} x2={startX + totalW * scale} y2={cy + stripH / 2 + 35} stroke="#22c55e" strokeWidth={1.5} />
                <line x1={startX + totalW * scale} y1={cy + stripH / 2 + 30} x2={startX + totalW * scale} y2={cy + stripH / 2 + 40} stroke="#22c55e" strokeWidth={1.5} />
                <text x={startX + (totalW * scale) / 2} y={cy + stripH / 2 + 53} fill="#22c55e" fontSize="12" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
                  Strip Width: {netStripWidth.toFixed(2)} mm
                </text>
              </>
            )}
          </svg>
        </div>

        <div className="w-64 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Parameters</div>
            <div className="space-y-2">
              <div className="bg-white/[0.03] rounded-lg p-2">
                <label className="text-[9px] text-zinc-500 block mb-1">Default Bend Radius (mm)</label>
                <input type="number" value={customBendRadius} onChange={e => setCustomBendRadius(parseFloat(e.target.value) || 1)} min={0.5} step={0.5} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 space-y-1">
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Material</span><span className="text-zinc-300">{materialType}</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Thickness</span><span className="text-zinc-300">{thickness} mm</span></div>
                <div className="flex justify-between text-[10px]"><span className="text-zinc-500">K-Factor</span><span className="text-zinc-300">{kFactor}</span></div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Summary</div>
            <div className="space-y-2">
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-zinc-500">Flat Segments</span>
                <span className="text-[10px] text-zinc-300">{totalFlatLength.toFixed(2)} mm</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-zinc-500">Bend Allowance</span>
                <span className="text-[10px] text-blue-300">+{totalBendAllowance.toFixed(2)} mm</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-zinc-500">Bend Deduction</span>
                <span className="text-[10px] text-red-400">-{totalBendDeduction.toFixed(2)} mm</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-emerald-400 font-semibold">Net Strip Width</span>
                <span className="text-sm text-emerald-300 font-bold">{netStripWidth.toFixed(2)} mm</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Bend Details ({bendDeductions.length})</div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {bendDeductions.map((bd, i) => (
                <div key={i} className="bg-white/[0.02] rounded p-2 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-semibold">Bend {bd.bendIndex}</span>
                    <span className="text-zinc-300">{bd.angle.toFixed(1)}° R{bd.radius.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-zinc-600">BA</span><span className="text-blue-400">{bd.bendAllowance.toFixed(3)} mm</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">BD</span><span className="text-red-400">{bd.bendDeduction.toFixed(3)} mm</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">Arc</span><span className="text-zinc-400">{bd.arcLength.toFixed(3)} mm</span></div>
                </div>
              ))}
              {!bendDeductions.length && (
                <div className="text-[10px] text-zinc-600 text-center py-4">No bends detected in profile</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Segment Lengths ({flatLengths.length})</div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {flatLengths.map((len, i) => (
                <div key={i} className="flex justify-between text-[10px] px-2 py-0.5">
                  <span className="text-zinc-500">Seg {i + 1}</span>
                  <span className="text-zinc-300">{len.toFixed(2)} mm</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
