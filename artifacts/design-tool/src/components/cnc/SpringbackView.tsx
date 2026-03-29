import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { RotateCcw, Cpu } from "lucide-react";
import { computeSpringbackOnWorker, ensureWorkerPool, getHardwareCapabilities } from "../../lib/hardware-engine";

interface SpringbackResult {
  stationNumber: number;
  originalAngle: number;
  springbackAngle: number;
  compensatedAngle: number;
  springbackRatio: number;
}

const MATERIAL_SPRINGBACK: Record<string, { ratio: number; rValue: number; nValue: number }> = {
  GI: { ratio: 0.03, rValue: 1.2, nValue: 0.20 },
  CR: { ratio: 0.025, rValue: 1.0, nValue: 0.22 },
  HR: { ratio: 0.04, rValue: 0.9, nValue: 0.18 },
  SS: { ratio: 0.06, rValue: 1.0, nValue: 0.45 },
  AL: { ratio: 0.035, rValue: 0.7, nValue: 0.30 },
  MS: { ratio: 0.03, rValue: 1.1, nValue: 0.20 },
  CU: { ratio: 0.02, rValue: 0.8, nValue: 0.35 },
  TI: { ratio: 0.08, rValue: 1.5, nValue: 0.10 },
  PP: { ratio: 0.03, rValue: 1.2, nValue: 0.20 },
  HSLA: { ratio: 0.055, rValue: 1.3, nValue: 0.15 },
};

function calculateSpringback(
  angle: number,
  matType: string,
  thickness: number,
  bendRadius: number,
): { springbackAngle: number; compensatedAngle: number; ratio: number } {
  const mat = MATERIAL_SPRINGBACK[matType] ?? MATERIAL_SPRINGBACK.GI;
  const rOverT = bendRadius / Math.max(thickness, 0.1);
  const baseRatio = mat.ratio;
  const rFactor = 1 + (rOverT - 2) * 0.01;
  const thickFactor = 1 + (1 - thickness) * 0.05;
  const anisotropyFactor = 1 + (mat.rValue - 1) * 0.02;
  const hardeningFactor = 1 - mat.nValue * 0.1;

  const effectiveRatio = baseRatio * rFactor * thickFactor * anisotropyFactor * hardeningFactor;
  const springbackAngle = angle * effectiveRatio;
  const compensatedAngle = angle + springbackAngle;

  return { springbackAngle, compensatedAngle, ratio: effectiveRatio };
}

function SpringbackDiagram({ result, showOverlay, materialType, thickness, customRadius }: {
  result: SpringbackResult; showOverlay: boolean; materialType: string; thickness: number; customRadius: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cx = dims.w / 2;
  const cy = dims.h / 2 + 40;
  const armLen = Math.min(dims.w, dims.h) * 0.3;

  const origRad = (result.originalAngle * Math.PI) / 180;
  const sbRad = ((result.originalAngle - result.springbackAngle) * Math.PI) / 180;
  const compRad = (result.compensatedAngle * Math.PI) / 180;

  const origEndX = cx + armLen * Math.cos(-origRad);
  const origEndY = cy + armLen * Math.sin(-origRad);
  const sbEndX = cx + armLen * Math.cos(-sbRad);
  const sbEndY = cy + armLen * Math.sin(-sbRad);
  const compEndX = cx + armLen * Math.cos(-compRad);
  const compEndY = cy + armLen * Math.sin(-compRad);

  const arcR = 50;
  const origArcEnd = { x: cx + arcR * Math.cos(-origRad), y: cy + arcR * Math.sin(-origRad) };
  const largeArc = origRad > Math.PI ? 1 : 0;

  return (
    <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${dims.w} ${dims.h}`} className="w-full h-full" style={{ background: "#0a0a1a" }}>
      <defs>
        <filter id="sb-glow-blue">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sb-glow-red">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="sb-glow-green">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <line x1={cx - armLen - 40} y1={cy} x2={cx + armLen + 40} y2={cy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1={cx} y1={cy - armLen - 40} x2={cx} y2={cy + armLen + 40} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      <g filter="url(#sb-glow-blue)">
        <polyline points={`${cx - armLen},${cy} ${cx},${cy} ${origEndX},${origEndY}`} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x={cx + 10} y={cy - armLen * 0.4 - 5} fill="#3b82f6" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
        Design: {result.originalAngle.toFixed(1)}°
      </text>

      {showOverlay && (
        <>
          <g filter="url(#sb-glow-red)">
            <polyline points={`${cx - armLen},${cy} ${cx},${cy} ${sbEndX},${sbEndY}`} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="6,4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <text x={cx + 10} y={cy - armLen * 0.25} fill="#ef4444" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
            After Springback: {(result.originalAngle - result.springbackAngle).toFixed(1)}°
          </text>

          <g filter="url(#sb-glow-green)">
            <polyline points={`${cx - armLen},${cy} ${cx},${cy} ${compEndX},${compEndY}`} fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="3,3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <text x={cx + 10} y={cy - armLen * 0.6 - 10} fill="#22c55e" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
            Compensated: {result.compensatedAngle.toFixed(1)}°
          </text>

          <path
            d={`M ${cx + arcR},${cy} A ${arcR} ${arcR} 0 ${largeArc} 1 ${origArcEnd.x},${origArcEnd.y}`}
            fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="2"
          />
          <text x={cx + arcR + 5} y={cy - 5} fill="#ef4444" fontSize="10" fontFamily="sans-serif">
            SB: {result.springbackAngle.toFixed(2)}°
          </text>

          {result.springbackAngle > 0 && (
            <g opacity="0.15">
              <path
                d={`M ${cx},${cy} L ${sbEndX},${sbEndY} L ${origEndX},${origEndY} Z`}
                fill="#ef4444"
              />
            </g>
          )}
        </>
      )}

      <text x="15" y="25" fill="#888" fontSize="10" fontFamily="sans-serif">
        Station {result.stationNumber} | {materialType} {thickness}mm | R/t = {(customRadius / thickness).toFixed(1)}
      </text>

      {[
        { color: "#3b82f6", label: "Design Angle" },
        { color: "#ef4444", label: "After Springback" },
        { color: "#22c55e", label: "Compensated Angle" },
      ].map((item, i) => (
        <g key={i}>
          <rect x={15 + i * 140} y={dims.h - 60} width={12} height={3} fill={item.color} rx="1" />
          <text x={32 + i * 140} y={dims.h - 56} fill="#aaa" fontSize="9" fontFamily="sans-serif">{item.label}</text>
        </g>
      ))}
    </svg>
  );
}

export function SpringbackView() {
  const { stations, materialType, materialThickness: thickness, geometry: rawGeometry, rollTooling, rollDiameter: storeRollDia } = useCncStore();
  const geometry = rawGeometry ?? { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  const [selectedStation, setSelectedStation] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [customRadius, setCustomRadius] = useState(2.0);

  const getStationBendRadius = (idx: number): number => {
    const rt = rollTooling[idx];
    const od = rt?.upperRollOD ?? rt?.rollProfile?.rollDiameter;
    if (od) return Math.max(od / 2 * 0.08, 0.5);
    const bp = geometry.bendPoints[idx] ?? geometry.bendPoints[0];
    if (bp?.radius) return bp.radius;
    return customRadius;
  };
  const hwCaps = useRef(getHardwareCapabilities());
  const [workerComputeMs, setWorkerComputeMs] = useState(0);
  const [workerResults, setWorkerResults] = useState<SpringbackResult[] | null>(null);

  useEffect(() => { ensureWorkerPool(); }, []);

  useEffect(() => {
    if (stations.length > 0) {
      const start = performance.now();
      computeSpringbackOnWorker(stations, materialType, thickness, customRadius).then((r) => {
        setWorkerComputeMs(Math.round(performance.now() - start));
        setWorkerResults(r as SpringbackResult[]);
      }).catch(() => {});
    }
  }, [stations, materialType, thickness, customRadius]);

  const results: SpringbackResult[] = (workerResults && workerResults.length === stations.length) ? workerResults : stations.map((st, idx) => {
    const safeAngles = st.bendAngles ?? [];
    const maxAngle = Math.max(...(safeAngles.length ? safeAngles : [0]));
    const radius = getStationBendRadius(idx);
    const { springbackAngle, compensatedAngle, ratio } = calculateSpringback(maxAngle, materialType, thickness, radius);
    return {
      stationNumber: idx + 1,
      originalAngle: maxAngle,
      springbackAngle,
      compensatedAngle,
      springbackRatio: ratio,
    };
  });

  const currentResult = results[selectedStation] ?? {
    stationNumber: 1, originalAngle: 0, springbackAngle: 0, compensatedAngle: 0, springbackRatio: 0,
  };

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <RotateCcw className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Springback Prediction & Compensation</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">SVG Pro · {hwCaps.current.cpu.cores} Cores</span>
        {workerComputeMs > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5" /> {workerComputeMs}ms
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowOverlay(!showOverlay)}
          className={`px-2.5 py-1 rounded text-[10px] font-medium ${showOverlay ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.04] text-zinc-500"}`}
        >
          Overlay {showOverlay ? "ON" : "OFF"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <SpringbackDiagram
            result={currentResult}
            showOverlay={showOverlay}
            materialType={materialType}
            thickness={thickness}
            customRadius={customRadius}
          />
        </div>

        <div className="w-64 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Station Select</div>
            <select
              value={selectedStation}
              onChange={e => setSelectedStation(parseInt(e.target.value))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-300"
            >
              {stations.map((_, i) => (
                <option key={i} value={i}>Station {i + 1}</option>
              ))}
              {!stations.length && <option value={0}>No stations</option>}
            </select>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Bend Radius (mm)</div>
            <input
              type="number"
              value={customRadius}
              onChange={e => setCustomRadius(parseFloat(e.target.value) || 1)}
              min={0.5}
              step={0.5}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-300"
            />
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Current Station</div>
            <div className="space-y-2">
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-zinc-500">Design Angle</span>
                <span className="text-[10px] text-blue-300 font-bold">{currentResult.originalAngle.toFixed(1)}°</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-zinc-500">Springback</span>
                <span className="text-[10px] text-red-400 font-bold">{currentResult.springbackAngle.toFixed(2)}°</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-zinc-500">Compensated</span>
                <span className="text-[10px] text-emerald-400 font-bold">{currentResult.compensatedAngle.toFixed(1)}°</span>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                <span className="text-[10px] text-zinc-500">SB Ratio</span>
                <span className="text-[10px] text-amber-300 font-bold">{(currentResult.springbackRatio * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">All Stations</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedStation(i)}
                  className={`w-full text-left px-2 py-1.5 rounded text-[10px] flex justify-between transition-all ${
                    i === selectedStation ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" : "bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04]"
                  }`}
                >
                  <span>St {r.stationNumber}</span>
                  <span>{r.originalAngle.toFixed(0)}° → {r.compensatedAngle.toFixed(0)}°</span>
                  <span className="text-red-400">+{r.springbackAngle.toFixed(1)}°</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Material Factors</div>
            <div className="bg-white/[0.03] rounded-lg p-2 space-y-1">
              {(() => {
                const m = MATERIAL_SPRINGBACK[materialType] ?? MATERIAL_SPRINGBACK.GI;
                return (
                  <>
                    <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Base Ratio</span><span className="text-zinc-300">{(m.ratio * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-zinc-500">r-Value</span><span className="text-zinc-300">{m.rValue}</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-zinc-500">n-Value</span><span className="text-zinc-300">{m.nValue}</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-zinc-500">R/t Ratio</span><span className="text-zinc-300">{(customRadius / thickness).toFixed(2)}</span></div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
