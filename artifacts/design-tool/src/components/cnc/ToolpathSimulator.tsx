import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useCncStore, type Segment } from "../../store/useCncStore";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";

interface SimPoint {
  x: number;
  y: number;
  type: "rapid" | "cut" | "arc";
}

function generateSimPoints(segments: Segment[]): SimPoint[] {
  const points: SimPoint[] = [];
  for (const seg of segments) {
    points.push({ x: seg.startX, y: seg.startY, type: "rapid" });
    if (seg.type === "line") {
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        points.push({
          x: seg.startX + (seg.endX - seg.startX) * t,
          y: seg.startY + (seg.endY - seg.startY) * t,
          type: "cut",
        });
      }
    } else if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
      const cx = seg.centerX;
      const cy = seg.centerY;
      const r = seg.radius;
      let sa = (seg.startAngle || 0) * (Math.PI / 180);
      let ea = (seg.endAngle || 360) * (Math.PI / 180);
      let sweep = ea - sa;
      if (sweep <= 0) sweep += Math.PI * 2;
      const steps = 20;
      for (let i = 1; i <= steps; i++) {
        const t = sa + (sweep * i) / steps;
        points.push({
          x: cx + r * Math.cos(t),
          y: cy + r * Math.sin(t),
          type: "arc",
        });
      }
    }
  }
  return points;
}

export function ToolpathSimulator() {
  const { gcodeOutputs, selectedStation } = useCncStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 180 });
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeStation = selectedStation
    ? useCncStore.getState().stations.find((s) => s.stationNumber === selectedStation)
    : useCncStore.getState().stations[0];

  const simPoints = useMemo(() => {
    if (!activeStation) return [];
    return generateSimPoints(activeStation.segments);
  }, [activeStation]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    lastTimeRef.current = performance.now();
    const animate = (time: number) => {
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;
      setProgress((prev) => {
        const next = prev + dt * 0.1 * speed;
        if (next >= 1) { setIsPlaying(false); return 1; }
        return next;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, speed]);

  if (!activeStation || simPoints.length === 0) return null;

  const w = dims.w;
  const h = dims.h;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of simPoints) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  const gw = maxX - minX || 1;
  const gh = maxY - minY || 1;
  const pad = 30;
  const scale = Math.min((w - pad * 2) / gw, (h - pad * 2) / gh) * 0.85;
  const ox = pad + ((w - pad * 2) - gw * scale) / 2 - minX * scale;
  const oy = pad + ((h - pad * 2) - gh * scale) / 2 - minY * scale;
  const toX = (x: number) => x * scale + ox;
  const toY = (y: number) => y * scale + oy;

  const endIdx = Math.floor(progress * simPoints.length);
  const ghostPath = simPoints.map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.x)},${toY(p.y)}`).join(" ");

  const activeLines: React.ReactNode[] = [];
  if (endIdx > 0) {
    for (let i = 1; i <= endIdx && i < simPoints.length; i++) {
      const p = simPoints[i];
      const prev = simPoints[i - 1];
      activeLines.push(
        <line key={i} x1={toX(prev.x)} y1={toY(prev.y)} x2={toX(p.x)} y2={toY(p.y)}
          stroke={p.type === "rapid" ? "#facc15" : "#3b82f6"}
          strokeWidth={p.type === "rapid" ? 1 : 2}
          strokeDasharray={p.type === "rapid" ? "4,4" : undefined} />
      );
    }
  }

  const cp = endIdx > 0 && endIdx < simPoints.length ? simPoints[endIdx] : null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/95 border-t border-zinc-700">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs text-zinc-400 font-semibold mr-2">SIMULATION</span>
        <button onClick={() => { if (progress >= 1) setProgress(0); setIsPlaying(!isPlaying); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={() => { setIsPlaying(false); setProgress(0); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
          <RotateCcw className="w-4 h-4" />
        </button>
        <button onClick={() => { setProgress(1); setIsPlaying(false); }}
          className="p-1 rounded hover:bg-zinc-700 text-zinc-300">
          <SkipForward className="w-4 h-4" />
        </button>
        <input type="range" min={0} max={1} step={0.001} value={progress}
          onChange={(e) => { setProgress(parseFloat(e.target.value)); setIsPlaying(false); }}
          className="flex-1 h-1 accent-blue-500" />
        <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-xs text-zinc-300">
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 180 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#09090b" }}>
          <path d={ghostPath} fill="none" stroke="#27272a" strokeWidth={0.5} />
          {activeLines}
          {cp && (
            <>
              <circle cx={toX(cp.x)} cy={toY(cp.y)} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
            </>
          )}
          <text x={8} y={h - 8} fill="#71717a" fontSize="10" fontFamily="monospace">Progress: {Math.round(progress * 100)}%</text>
          {cp && <text x={8} y={h - 22} fill="#71717a" fontSize="10" fontFamily="monospace">X: {cp.x.toFixed(3)}  Y: {cp.y.toFixed(3)}</text>}
        </svg>
      </div>
    </div>
  );
}
