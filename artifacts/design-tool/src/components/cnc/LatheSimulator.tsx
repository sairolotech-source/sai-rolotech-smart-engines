import React, { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause, RotateCcw, SkipForward, AlertTriangle } from "lucide-react";

export interface LatheToolMove {
  x: number;
  z: number;
  type: "rapid" | "cut";
}

interface LatheSimulatorProps {
  moves: LatheToolMove[];
  stockDiameter: number;
  stockLength: number;
  chuckLength?: number;
  cycleTimeSec?: number;
}

function buildDemoMoves(stockRadius: number, stockLength: number): LatheToolMove[] {
  const moves: LatheToolMove[] = [];
  const finishRadius = stockRadius * 0.72;
  const roughSteps = 4;
  const zEnd = -stockLength * 0.9;

  moves.push({ x: stockRadius + 5, z: 5, type: "rapid" });
  for (let i = 0; i <= 5; i++) {
    const z = -i * 1;
    moves.push({ x: stockRadius + 1, z, type: i === 0 ? "rapid" : "cut" });
    moves.push({ x: 0, z, type: "cut" });
    moves.push({ x: stockRadius + 1, z, type: "rapid" });
  }

  for (let p = 0; p < roughSteps; p++) {
    const r = stockRadius - p * (stockRadius - finishRadius) / roughSteps;
    moves.push({ x: r + 1, z: -5, type: "rapid" });
    moves.push({ x: r, z: -5, type: "rapid" });
    moves.push({ x: r, z: zEnd, type: "cut" });
    moves.push({ x: r + 1, z: zEnd, type: "rapid" });
  }

  moves.push({ x: finishRadius, z: -5, type: "rapid" });
  moves.push({ x: finishRadius, z: zEnd, type: "cut" });

  const grooveZ = zEnd * 0.5;
  moves.push({ x: finishRadius + 2, z: grooveZ, type: "rapid" });
  moves.push({ x: finishRadius - 3, z: grooveZ, type: "cut" });
  moves.push({ x: finishRadius + 2, z: grooveZ, type: "rapid" });

  moves.push({ x: finishRadius + 5, z: 5, type: "rapid" });

  return moves;
}

function LatheSimSVG({ w, h, moves, progress, stockRadius, stockLength, chuckLength }: {
  w: number; h: number; moves: LatheToolMove[]; progress: number;
  stockRadius: number; stockLength: number; chuckLength: number;
}) {
  const allMoves = moves.length > 1 ? moves : buildDemoMoves(stockRadius, stockLength);

  let minZ = Infinity, maxZ = -Infinity, maxX = -Infinity;
  for (const m of allMoves) {
    minZ = Math.min(minZ, m.z);
    maxZ = Math.max(maxZ, m.z);
    maxX = Math.max(maxX, Math.abs(m.x));
  }
  minZ = Math.min(minZ, -stockLength);
  maxZ = Math.max(maxZ, 5);
  maxX = Math.max(maxX, stockRadius + 4);

  const rangeZ = maxZ - minZ || 1;
  const PAD = 44;
  const cW = w - PAD * 2;
  const cH = h - PAD * 2;
  const scale = Math.min(cW / rangeZ, cH / (maxX * 2 || 1)) * 0.82;
  const originZ = PAD + (cW - rangeZ * scale) / 2 - minZ * scale;
  const originX = h / 2;

  const toX = (z: number) => originZ + z * scale;
  const toY = (x: number) => originX - x * scale;

  const endIdx = Math.floor(progress * (allMoves.length - 1));
  const toolPos = allMoves[Math.min(endIdx, allMoves.length - 1)];

  const chuckZ0 = toX(0);
  const chuckW = chuckLength * scale;
  const stockZ0 = toX(-stockLength);
  const stockZ1 = toX(0);
  const stockTop = toY(stockRadius);
  const stockBot = toY(-stockRadius);

  const TS = Math.max(10, scale * 1.0);
  const iS = TS * 0.5;
  const tx = toX(toolPos.z);
  const ty = toY(toolPos.x);

  const cutRects: React.ReactNode[] = [];
  if (endIdx > 0) {
    for (let i = 1; i <= endIdx && i < allMoves.length; i++) {
      const prev = allMoves[i - 1];
      const cur = allMoves[i];
      if (cur.type === "cut") {
        const y0 = Math.min(toY(Math.abs(prev.x)), toY(Math.abs(cur.x)));
        const y1 = Math.max(toY(-Math.abs(prev.x)), toY(-Math.abs(cur.x)));
        const x0 = Math.min(toX(prev.z), toX(cur.z));
        const x1 = Math.max(toX(prev.z), toX(cur.z));
        cutRects.push(
          <rect key={`c${i}`} x={x0} y={y0} width={Math.max(x1 - x0, 1)} height={Math.max(y1 - y0, 1)} fill="#09090f" />
        );
      }
    }
  }

  const isInChuck = toolPos.x < stockRadius && toolPos.z > -chuckLength && toolPos.z < chuckLength;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#09090f", display: "block" }}>
      {Array.from({ length: Math.ceil((w - PAD * 2) / 20) }, (_, i) => (
        <line key={`gx${i}`} x1={PAD + i * 20} y1={PAD} x2={PAD + i * 20} y2={h - PAD} stroke="#1c1c2e" strokeWidth={0.5} />
      ))}
      {Array.from({ length: Math.ceil((h - PAD * 2) / 20) }, (_, i) => (
        <line key={`gy${i}`} x1={PAD} y1={PAD + i * 20} x2={w - PAD} y2={PAD + i * 20} stroke="#1c1c2e" strokeWidth={0.5} />
      ))}

      <line x1={PAD} y1={originX} x2={w - PAD} y2={originX} stroke="#374151" strokeWidth={1} strokeDasharray="8,4" />

      <rect x={chuckZ0} y={originX - (stockRadius + 8) * scale} width={chuckW} height={(stockRadius + 8) * scale * 2}
        fill="#1e293b" stroke="#475569" strokeWidth={1.5} />
      <text x={chuckZ0 + 4} y={originX - (stockRadius + 4) * scale + 12} fill="#0f172a" fontSize="10" fontFamily="monospace">CHUCK</text>

      <rect x={stockZ0} y={stockTop} width={stockZ1 - stockZ0} height={stockBot - stockTop}
        fill="#4b5563" stroke="#9ca3af" strokeWidth={1.5} />

      <defs>
        <clipPath id="stockClip">
          <rect x={stockZ0} y={stockTop} width={stockZ1 - stockZ0} height={stockBot - stockTop} />
        </clipPath>
      </defs>
      <g clipPath="url(#stockClip)">
        {cutRects}
      </g>

      {allMoves.map((cur, i) => {
        if (i === 0) return null;
        const prev = allMoves[i - 1];
        const isExecuted = i <= endIdx;
        return (
          <line key={`tp${i}`}
            x1={toX(prev.z)} y1={toY(prev.x)} x2={toX(cur.z)} y2={toY(cur.x)}
            stroke={cur.type === "rapid"
              ? (isExecuted ? "#facc15" : "rgba(250,204,21,0.2)")
              : (isExecuted ? "#22c55e" : "rgba(34,197,94,0.15)")}
            strokeWidth={isExecuted ? (cur.type === "rapid" ? 1.5 : 2) : 0.8}
            strokeDasharray={cur.type === "rapid" ? "5,4" : undefined} />
        );
      })}

      <g transform={`translate(${tx},${ty})`}>
        <rect x={-TS * 0.25} y={-TS * 0.5} width={TS * 1.0} height={TS * 1.0}
          fill="#78716c" stroke="#a8a29e" strokeWidth={1} />
        <polygon points={`0,${-iS} ${iS * 0.5},0 0,${iS} ${-iS * 0.5},0`}
          fill="#eab308" stroke="#fde047" strokeWidth={1} />
      </g>

      {isInChuck && endIdx > 0 && (
        <line x1={chuckZ0} y1={PAD} x2={chuckZ0} y2={h - PAD} stroke="#ef4444" strokeWidth={2} strokeDasharray="4,2" />
      )}

      <text x={w - PAD - 24} y={originX + 14} fill="#6b7280" fontSize="10" fontFamily="monospace">Z →</text>
      <text x={PAD + 4} y={PAD - 6} fill="#6b7280" fontSize="10" fontFamily="monospace">X ↑</text>
      <text x={w - 8} y={h - 8} fill="#52525b" fontSize="10" fontFamily="monospace" textAnchor="end">
        Z: {toolPos.z.toFixed(2)}  X⌀: {(toolPos.x * 2).toFixed(2)}
      </text>
      <text x={8} y={h - 8} fill="#52525b" fontSize="10" fontFamily="monospace">{Math.round(progress * 100)}%</text>
    </svg>
  );
}

export function LatheSimulator({ moves, stockDiameter, stockLength, chuckLength = 50, cycleTimeSec }: LatheSimulatorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const stockRadius = stockDiameter / 2;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const allMoves = moves.length > 1 ? moves : buildDemoMoves(stockRadius, stockLength);
  const endIdx = Math.floor(progress * (allMoves.length - 1));
  const toolPos = allMoves[Math.min(endIdx, allMoves.length - 1)];
  const collision = toolPos.x < stockRadius && toolPos.z > -chuckLength && toolPos.z < chuckLength && endIdx > 0;

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(animRef.current); return; }
    lastTimeRef.current = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      setProgress((prev) => {
        const next = prev + dt * 0.05 * speed;
        if (next >= 1) { setIsPlaying(false); return 1; }
        return next;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, speed]);

  const handleReset = () => { setIsPlaying(false); setProgress(0); };

  return (
    <div className="flex flex-col h-full bg-[#09090f]">
      <div className="flex-1 relative" ref={containerRef}>
        <LatheSimSVG
          w={dims.w} h={dims.h} moves={moves} progress={progress}
          stockRadius={stockRadius} stockLength={stockLength} chuckLength={chuckLength}
        />
        {collision && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2
                          bg-red-900/80 border border-red-500/60 text-red-300 text-[11px]
                          font-bold px-3 py-1.5 rounded-lg shadow-lg">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            COLLISION — Tool entering chuck zone!
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2
                      bg-[#0D0D1A] border-t border-white/[0.06]">
        <button
          onClick={() => { if (progress >= 1) handleReset(); setIsPlaying((p) => !p); }}
          className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25
                     text-blue-400 hover:bg-blue-500/25 transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button onClick={handleReset}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                     text-zinc-400 hover:bg-white/[0.08] transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>

        <button onClick={() => { setProgress(1); setIsPlaying(false); }}
          className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                     text-zinc-400 hover:bg-white/[0.08] transition-colors">
          <SkipForward className="w-4 h-4" />
        </button>

        <input
          type="range" min={0} max={1} step={0.001} value={progress}
          onChange={(e) => { setProgress(parseFloat(e.target.value)); setIsPlaying(false); }}
          className="flex-1 h-1.5 accent-green-500 cursor-pointer"
        />

        <span className="text-[10px] text-zinc-600 ml-1">Speed</span>
        <select
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="bg-[#13131F] border border-white/[0.08] rounded px-1.5 py-0.5
                     text-xs text-zinc-300"
        >
          <option value={0.25}>0.25×</option>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={5}>5×</option>
        </select>

        {cycleTimeSec !== undefined && progress >= 1 && (
          <span className="text-[11px] font-semibold text-amber-400 ml-2">
            Cycle: {cycleTimeSec.toFixed(1)}s
          </span>
        )}

        <div className="flex items-center gap-2 ml-2 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-yellow-400 inline-block" style={{ borderBottom: "2px dashed" }} />
            Rapid
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-green-500 inline-block" />
            Cut
          </span>
        </div>
      </div>
    </div>
  );
}
