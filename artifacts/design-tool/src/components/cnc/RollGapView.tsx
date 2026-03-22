import React, { useState, useRef, useEffect, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Target, AlertTriangle, CheckCircle2 } from "lucide-react";

interface GapAnalysis {
  stationNumber: number;
  nominalGap: number;
  actualGap: number;
  clearance: number;
  status: "ok" | "tight" | "loose" | "critical";
  recommendation: string;
}

export function RollGapView() {
  const { stations, materialThickness: thickness, materialType } = useCncStore();
  const [selectedStation, setSelectedStation] = useState(0);
  const [gapTolerance, setGapTolerance] = useState(0.05);
  const [springbackComp, setSpringbackComp] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const springbackFactors: Record<string, number> = {
    GI: 1.03, CR: 1.025, HR: 1.04, SS: 1.06, AL: 1.035,
    MS: 1.03, CU: 1.02, TI: 1.08, PP: 1.15, HSLA: 1.055,
  };
  const sbFactor = springbackComp ? (springbackFactors[materialType] ?? 1.03) : 1.0;

  const gapAnalyses: GapAnalysis[] = useMemo(() => stations.map((st, idx) => {
    const nominalGap = thickness;
    const formingProgress = (idx + 1) / Math.max(stations.length, 1);
    const maxBend = Math.max(...(st.bendAngles.length ? st.bendAngles : [0]));
    const thinning = 1 - 0.02 * formingProgress * (maxBend / 90);
    const effectiveThickness = thickness * thinning;
    const actualGap = effectiveThickness * sbFactor;
    const clearance = nominalGap - actualGap;

    let status: GapAnalysis["status"] = "ok";
    let recommendation = "Gap within tolerance.";
    if (clearance < -gapTolerance) {
      status = "critical";
      recommendation = `Gap too tight by ${Math.abs(clearance).toFixed(3)}mm. Increase roll gap or reduce overbend.`;
    } else if (clearance < 0) {
      status = "tight";
      recommendation = `Slightly tight. Consider ${(Math.abs(clearance) * 1000).toFixed(0)}μm adjustment.`;
    } else if (clearance > thickness * 0.15) {
      status = "loose";
      recommendation = `Gap loose by ${clearance.toFixed(3)}mm. May cause marking or poor forming.`;
    }
    return { stationNumber: idx + 1, nominalGap, actualGap, clearance, status, recommendation };
  }), [stations, thickness, sbFactor, gapTolerance]);

  const current = gapAnalyses[selectedStation];
  const w = dims.w;
  const h = dims.h;
  const cx = w / 2;
  const cy = h / 2;
  const rollRadius = Math.min(w, h) * 0.18;

  const statusColor = current
    ? current.status === "ok" ? "#22c55e"
      : current.status === "tight" ? "#f59e0b"
      : current.status === "loose" ? "#f59e0b"
      : "#ef4444"
    : "#555";

  const gapPx = 25;
  const stripW = rollRadius * 1.6;
  const barY = h - 80;
  const barW = w - 100;
  const barX = 50;

  const okCount = gapAnalyses.filter(g => g.status === "ok").length;
  const critCount = gapAnalyses.filter(g => g.status === "critical").length;

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <Target className="w-4 h-4 text-purple-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Roll Gap Analysis</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">SVG Pro</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full ${okCount === gapAnalyses.length ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
            {okCount}/{gapAnalyses.length} OK
          </span>
          {critCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{critCount} Critical</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 relative">
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#0a0a1a" }}>
            {!current ? (
              <text x={w / 2} y={h / 2} fill="#555" fontSize="14" fontFamily="sans-serif" textAnchor="middle">Generate Power Pattern first</text>
            ) : (
              <>
                <circle cx={cx} cy={cy - rollRadius - 10} r={rollRadius} fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.5)" strokeWidth={2} />
                <text x={cx} y={cy - rollRadius - 10} fill="#3b82f6" fontSize="10" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" dominantBaseline="middle">UPPER ROLL</text>

                <circle cx={cx} cy={cy + rollRadius + 10} r={rollRadius} fill="rgba(34,197,94,0.08)" stroke="rgba(34,197,94,0.5)" strokeWidth={2} />
                <text x={cx} y={cy + rollRadius + 14} fill="#22c55e" fontSize="10" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" dominantBaseline="middle">LOWER ROLL</text>

                <rect x={cx - stripW / 2} y={cy - gapPx / 2 + 2} width={stripW} height={gapPx - 4} fill="rgba(251,191,36,0.2)" stroke="rgba(251,191,36,0.6)" strokeWidth={1.5} />
                <text x={cx - stripW / 2 + 5} y={cy + 3} fill="#fbbf24" fontSize="9" fontFamily="sans-serif">STRIP</text>

                <line x1={cx + stripW / 2 + 20} y1={cy - gapPx / 2} x2={cx + stripW / 2 + 35} y2={cy - gapPx / 2} stroke={statusColor} />
                <line x1={cx + stripW / 2 + 20} y1={cy + gapPx / 2} x2={cx + stripW / 2 + 35} y2={cy + gapPx / 2} stroke={statusColor} />
                <line x1={cx + stripW / 2 + 27} y1={cy - gapPx / 2} x2={cx + stripW / 2 + 27} y2={cy + gapPx / 2} stroke={statusColor} />
                <text x={cx + stripW / 2 + 40} y={cy + 4} fill={statusColor} fontSize="11" fontWeight="bold" fontFamily="sans-serif">{current.nominalGap.toFixed(2)} mm</text>

                <text x={15} y={25} fill="#888" fontSize="10" fontFamily="sans-serif">
                  Station {current.stationNumber} | {materialType} {thickness}mm | Tol: ±{(gapTolerance * 1000).toFixed(0)}μm
                </text>

                <rect x={barX} y={barY} width={barW} height={20} fill="rgba(255,255,255,0.03)" />
                {gapAnalyses.map((ga, i) => {
                  const x = barX + (i / Math.max(gapAnalyses.length - 1, 1)) * barW;
                  const col = ga.status === "ok" ? "#22c55e" : ga.status === "critical" ? "#ef4444" : "#f59e0b";
                  const r = i === selectedStation ? 6 : 4;
                  return (
                    <g key={i}>
                      <circle cx={x} cy={barY + 10} r={r} fill={col} stroke={i === selectedStation ? "#fff" : "none"} strokeWidth={1.5} />
                    </g>
                  );
                })}
                <text x={barX} y={barY + 34} fill="#666" fontSize="9" fontFamily="sans-serif" textAnchor="middle">Station 1</text>
                <text x={barX + barW} y={barY + 34} fill="#666" fontSize="9" fontFamily="sans-serif" textAnchor="middle">Station {gapAnalyses.length}</text>
              </>
            )}
          </svg>
        </div>

        <div className="w-60 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Settings</div>
            <div className="space-y-2">
              <div className="bg-white/[0.03] rounded-lg p-2">
                <label className="text-[9px] text-zinc-500 block mb-1">Gap Tolerance (mm)</label>
                <input type="number" value={gapTolerance} onChange={e => setGapTolerance(parseFloat(e.target.value) || 0.05)} min={0.01} step={0.01} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
              </div>
              <label className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={springbackComp} onChange={e => setSpringbackComp(e.target.checked)} className="accent-purple-500" />
                Include springback
              </label>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Station Select</div>
            <select value={selectedStation} onChange={e => setSelectedStation(parseInt(e.target.value))} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-300">
              {gapAnalyses.map((ga, i) => (
                <option key={i} value={i}>Station {ga.stationNumber} — {ga.status.toUpperCase()}</option>
              ))}
              {!gapAnalyses.length && <option value={0}>No stations</option>}
            </select>
          </div>

          {current && (
            <div>
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Current Gap</div>
              <div className="space-y-2">
                <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                  <span className="text-[10px] text-zinc-500">Nominal</span>
                  <span className="text-[10px] text-zinc-300">{current.nominalGap.toFixed(3)} mm</span>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                  <span className="text-[10px] text-zinc-500">Effective</span>
                  <span className="text-[10px] text-blue-300">{current.actualGap.toFixed(3)} mm</span>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                  <span className="text-[10px] text-zinc-500">Clearance</span>
                  <span className={`text-[10px] font-bold ${current.clearance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {current.clearance >= 0 ? "+" : ""}{current.clearance.toFixed(3)} mm
                  </span>
                </div>
              </div>
              <div className={`mt-2 rounded-lg p-2 text-[10px] ${
                current.status === "ok" ? "bg-emerald-500/10 text-emerald-400" :
                current.status === "critical" ? "bg-red-500/10 text-red-400" :
                "bg-amber-500/10 text-amber-400"
              }`}>
                {current.status === "ok" && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                {current.status === "critical" && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                {current.recommendation}
              </div>
            </div>
          )}

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">All Stations</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {gapAnalyses.map((ga, i) => (
                <button key={i} onClick={() => setSelectedStation(i)} className={`w-full text-left px-2 py-1 rounded text-[10px] flex items-center gap-2 ${
                  i === selectedStation ? "bg-purple-500/10 border border-purple-500/20" : "bg-white/[0.02] hover:bg-white/[0.04]"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    ga.status === "ok" ? "bg-emerald-400" : ga.status === "critical" ? "bg-red-400" : "bg-amber-400"
                  }`} />
                  <span className="text-zinc-400">St {ga.stationNumber}</span>
                  <span className="flex-1 text-right text-zinc-500">{ga.clearance >= 0 ? "+" : ""}{ga.clearance.toFixed(3)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
