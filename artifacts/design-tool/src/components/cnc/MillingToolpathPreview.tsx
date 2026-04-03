import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import type { ToolpathPoint } from "./MillingGcodeGenerator";

interface Props {
  toolpath: ToolpathPoint[];
  toolDiameter: number;
}

const COLOR_MAP: Record<ToolpathPoint["type"], string> = {
  rapid: "#facc15",
  cut: "#3b82f6",
  arc: "#a78bfa",
  entry: "#22c55e",
  exit: "#f97316",
  plunge: "#ef4444",
};

const DASH_MAP: Record<ToolpathPoint["type"], string | undefined> = {
  rapid: "6,4",
  cut: undefined,
  arc: undefined,
  entry: "3,3",
  exit: "3,3",
  plunge: "2,2",
};

export function MillingToolpathPreview({ toolpath, toolDiameter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 300 });
  const [progress, setProgress] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const animRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(animRef.current); return; }
    lastTimeRef.current = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      setProgress(prev => {
        const next = prev + dt * 0.08 * speed;
        if (next >= 1) { setIsPlaying(false); return 1; }
        return next;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, speed]);

  if (toolpath.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        No toolpath data — select an operation and generate
      </div>
    );
  }

  const w = dims.w;
  const h = dims.h;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of toolpath) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const pad = 40;
  const gw = maxX - minX || 1;
  const gh = maxY - minY || 1;
  const scale = Math.min((w - pad * 2) / gw, (h - pad * 2) / gh) * 0.85;
  const ox = pad + ((w - pad * 2) - gw * scale) / 2 - minX * scale;
  const oy = pad + ((h - pad * 2) - gh * scale) / 2 - minY * scale;
  const toX = (x: number) => x * scale + ox;
  const toY = (y: number) => h - (y * scale + oy);

  const endIdx = Math.floor(progress * (toolpath.length - 1));
  const cp = endIdx >= 0 && endIdx < toolpath.length ? toolpath[endIdx] : null;
  const toolR = Math.max(3, (toolDiameter / 2) * scale);

  const legend: [string, string][] = [
    ["Rapid (G0)", "#facc15"],
    ["Cut (G1)", "#3b82f6"],
    ["Arc", "#a78bfa"],
    ["Entry/Helix", "#22c55e"],
    ["Plunge", "#ef4444"],
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-700">
        <span className="text-[10px] text-zinc-400 font-semibold mr-1">2D TOOLPATH</span>
        <button onClick={() => { if (progress >= 1) setProgress(0); setIsPlaying(!isPlaying); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { setIsPlaying(false); setProgress(0); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { setProgress(1); setIsPlaying(false); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
          <SkipForward className="w-3.5 h-3.5" />
        </button>
        <input type="range" min={0} max={1} step={0.001} value={progress}
          onChange={e => { setProgress(parseFloat(e.target.value)); setIsPlaying(false); }}
          className="flex-1 h-1 accent-blue-500" />
        <select value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
          className="bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-[10px] text-zinc-300">
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>
      <div ref={containerRef} className="flex-1 w-full" style={{ minHeight: 200 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#0a0a0f" }}>
          {toolpath.map((cur, i) => {
            if (i === 0) return null;
            const prev = toolpath[i - 1];
            return (
              <line key={`g${i}`} x1={toX(prev.x)} y1={toY(prev.y)} x2={toX(cur.x)} y2={toY(cur.y)}
                stroke={COLOR_MAP[cur.type] || "#3b82f6"} strokeWidth={1} opacity={0.15}
                strokeDasharray={DASH_MAP[cur.type]} />
            );
          })}

          {endIdx > 0 && toolpath.slice(1, endIdx + 1).map((cur, i) => {
            const prev = toolpath[i];
            return (
              <line key={`a${i}`} x1={toX(prev.x)} y1={toY(prev.y)} x2={toX(cur.x)} y2={toY(cur.y)}
                stroke={COLOR_MAP[cur.type] || "#3b82f6"} strokeWidth={cur.type === "rapid" ? 1 : 2}
                strokeDasharray={DASH_MAP[cur.type]} />
            );
          })}

          {cp && (
            <>
              <circle cx={toX(cp.x)} cy={toY(cp.y)} r={toolR} fill="rgba(96,165,250,0.3)" stroke="#60a5fa" strokeWidth={1.5} />
              <circle cx={toX(cp.x)} cy={toY(cp.y)} r={3} fill="#ef4444" stroke="#fff" strokeWidth={1} />
            </>
          )}

          <text x={w - pad} y={toY(0) + 14} fill="#52525b" fontSize="10" fontFamily="monospace">X →</text>
          <text x={toX(0) + 4} y={pad - 4} fill="#52525b" fontSize="10" fontFamily="monospace">Y ↑</text>
          {cp && <text x={8} y={h - 8} fill="#71717a" fontSize="10" fontFamily="monospace">X: {cp.x.toFixed(3)}  Y: {cp.y.toFixed(3)}  Z: {cp.z.toFixed(3)}</text>}
          <text x={w - 8} y={h - 8} fill="#71717a" fontSize="10" fontFamily="monospace" textAnchor="end">{Math.round(progress * 100)}%</text>

          {legend.map(([label, color], i) => (
            <g key={label}>
              <rect x={8} y={pad + i * 12 - 6} width={12} height={3} fill={color} />
              <text x={24} y={pad + i * 12} fill="#71717a" fontSize="9" fontFamily="monospace">{label}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
