import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useCncStore, type Segment } from "../../store/useCncStore";
import { Play, Pause, RotateCcw, Camera } from "lucide-react";

interface ToolMove {
  x: number;
  z: number;
  type: "rapid" | "feed";
}

interface AccuracyResult {
  segmentIndex: number;
  label: string;
  targetRadius: number;
  simulatedRadius: number;
  deviationUm: number;
  badge: "green" | "yellow" | "red";
}

function parseGcode(gcode: string, xDiameterMode: boolean): ToolMove[] {
  const moves: ToolMove[] = [];
  let curX = 0;
  let curZ = 0;
  let motionCode = 0;

  const numRe = /([XZIJRF])([-\d.]+)/gi;

  for (const rawLine of gcode.split("\n")) {
    const line = rawLine.replace(/\s*;.*$/, "").trim().toUpperCase();
    if (!line || line.startsWith("%") || line.startsWith("O") || line.startsWith("(")) continue;

    const g0 = /\bG0\b/.test(line);
    const g1 = /\bG1\b/.test(line);
    const g2 = /\bG2\b/.test(line);
    const g3 = /\bG3\b/.test(line);

    if (g0) motionCode = 0;
    else if (g1) motionCode = 1;
    else if (g2) motionCode = 2;
    else if (g3) motionCode = 3;

    const words: Record<string, number> = {};
    let m: RegExpExecArray | null;
    numRe.lastIndex = 0;
    while ((m = numRe.exec(line)) !== null) {
      words[m[1]] = parseFloat(m[2]);
    }

    if (!("X" in words) && !("Z" in words)) continue;

    const rawX = "X" in words ? words["X"] : curX * (xDiameterMode ? 2 : 1);
    const newX = xDiameterMode ? rawX / 2 : rawX;
    const newZ = "Z" in words ? words["Z"] : curZ;

    if (motionCode === 0) {
      moves.push({ x: newX, z: newZ, type: "rapid" });
    } else if (motionCode === 1) {
      const STEPS = 4;
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        moves.push({
          x: curX + (newX - curX) * t,
          z: curZ + (newZ - curZ) * t,
          type: "feed",
        });
      }
    } else if (motionCode === 2 || motionCode === 3) {
      const r = words["R"];
      if (r !== undefined) {
        const dx = newX - curX;
        const dz = newZ - curZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const h = Math.sqrt(Math.max(0, r * r - (dist / 2) ** 2));
        const mx = (curX + newX) / 2;
        const mz = (curZ + newZ) / 2;
        const sign = motionCode === 2 ? 1 : -1;
        const cx = mx + sign * h * (-dz / dist);
        const cz = mz + sign * h * (dx / dist);
        let sa = Math.atan2(curX - cx, curZ - cz);
        let ea = Math.atan2(newX - cx, newZ - cz);
        if (motionCode === 2 && ea > sa) ea -= Math.PI * 2;
        if (motionCode === 3 && ea < sa) ea += Math.PI * 2;
        const STEPS = 16;
        for (let i = 1; i <= STEPS; i++) {
          const angle = sa + ((ea - sa) * i) / STEPS;
          moves.push({
            x: cx + r * Math.sin(angle),
            z: cz + r * Math.cos(angle),
            type: "feed",
          });
        }
      }
    }

    curX = newX;
    curZ = newZ;
  }

  return moves;
}

function buildToolpathFromSegments(segments: Segment[]): ToolMove[] {
  const moves: ToolMove[] = [];
  if (segments.length === 0) return moves;
  moves.push({ x: segments[0].startX, z: segments[0].startY, type: "rapid" });
  for (const seg of segments) {
    if (seg.type === "line") {
      const STEPS = 12;
      for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        moves.push({
          x: seg.startX + (seg.endX - seg.startX) * t,
          z: seg.startY + (seg.endY - seg.startY) * t,
          type: "feed",
        });
      }
    } else if (
      seg.type === "arc" &&
      seg.centerX !== undefined &&
      seg.centerY !== undefined &&
      seg.radius !== undefined
    ) {
      const cx = seg.centerX;
      const cy = seg.centerY;
      const r = seg.radius;
      let sa = ((seg.startAngle ?? 0) * Math.PI) / 180;
      let ea = ((seg.endAngle ?? 360) * Math.PI) / 180;
      let sweep = ea - sa;
      if (sweep <= 0) sweep += Math.PI * 2;
      const STEPS = 20;
      for (let i = 1; i <= STEPS; i++) {
        const angle = sa + (sweep * i) / STEPS;
        moves.push({
          x: cx + r * Math.cos(angle),
          z: cy + r * Math.sin(angle),
          type: "feed",
        });
      }
    }
  }
  return moves;
}

function computeAccuracy(
  segments: Segment[],
  moves: ToolMove[],
  feedMmRev: number,
  noseRadiusMm: number
): AccuracyResult[] {
  const hasMoves = moves.length > 0;

  return segments.map((seg, i) => {
    const targetRadius = (Math.abs(seg.startX) + Math.abs(seg.endX)) / 2;
    const midZ = (seg.startY + seg.endY) / 2;

    let simulatedRadius: number;

    if (hasMoves) {
      let best = moves[0];
      let bestDist = Math.abs(moves[0].z - midZ);
      for (const mv of moves) {
        const d = Math.abs(mv.z - midZ);
        if (d < bestDist) { bestDist = d; best = mv; }
      }
      simulatedRadius = Math.abs(best.x);
    } else {
      const cuspMm = noseRadiusMm > 0 ? (feedMmRev ** 2) / (8 * noseRadiusMm) : 0;
      simulatedRadius = targetRadius + cuspMm;
    }

    const deviationUm = Math.abs(targetRadius - simulatedRadius) * 1000;

    let badge: "green" | "yellow" | "red" = "green";
    if (deviationUm > 20) badge = "red";
    else if (deviationUm > 5) badge = "yellow";

    return {
      segmentIndex: i,
      label: seg.type === "arc" ? `Arc ${i + 1}` : `Seg ${i + 1}`,
      targetRadius,
      simulatedRadius,
      deviationUm,
      badge,
    };
  });
}

function estimateCycleTime(moves: ToolMove[], feedMmMin: number): number {
  const RAPID_RATE = 3000;
  let totalSec = 0;
  for (let i = 1; i < moves.length; i++) {
    const dx = moves[i].x - moves[i - 1].x;
    const dz = moves[i].z - moves[i - 1].z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const rate = moves[i].type === "rapid" ? RAPID_RATE : (feedMmMin > 0 ? feedMmMin : 150);
    totalSec += (dist / rate) * 60;
  }
  return totalSec;
}

function surfaceFinishRa(feedMmRev: number, noseRadiusMm: number): number {
  if (noseRadiusMm <= 0 || feedMmRev <= 0) return 0;
  return (feedMmRev * feedMmRev) / (8 * noseRadiusMm) * 1000;
}

function TurnerSimSVG({ w, h, moves, progress, rotation }: {
  w: number; h: number; moves: ToolMove[]; progress: number; rotation: number;
}) {
  if (moves.length < 2) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#09090f", display: "block" }}>
        <text x={w / 2} y={h / 2} fill="#3f3f46" fontSize="14" fontFamily="monospace" textAnchor="middle">
          No toolpath data — generate G-code or configure a station
        </text>
      </svg>
    );
  }

  let minZ = Infinity, maxZ = -Infinity, maxX = -Infinity;
  for (const m of moves) {
    minZ = Math.min(minZ, m.z);
    maxZ = Math.max(maxZ, m.z);
    maxX = Math.max(maxX, Math.abs(m.x));
  }
  const rangeZ = maxZ - minZ || 1;

  const PAD = 40;
  const canvasW = w - PAD * 2;
  const canvasH = h - PAD * 2;
  const scale = Math.min(canvasW / rangeZ, canvasH / (maxX * 2 || 1)) * 0.80;

  const originZ = PAD + (canvasW - rangeZ * scale) / 2 - minZ * scale;
  const originX = h / 2;

  const toX = (z: number) => originZ + z * scale;
  const toY = (x: number) => originX - x * scale;

  const endIdx = Math.floor(progress * (moves.length - 1));
  const toolPos = moves[Math.min(endIdx, moves.length - 1)];

  const upperProfile = moves.map(m => `${toX(m.z)},${toY(m.x)}`).join(" ");
  const lowerProfile = [...moves].reverse().map(m => `${toX(m.z)},${toY(-m.x)}`).join(" ");
  const fullSilhouette = `${toX(moves[0].z)},${toY(0)} ${upperProfile} ${lowerProfile}`;

  let cutPathUpper = `${toX(moves[0].z)},${toY(0)}`;
  let cutPathLower = `${toX(moves[0].z)},${toY(0)}`;
  if (endIdx > 0) {
    for (let i = 0; i <= endIdx; i++) {
      cutPathUpper += ` ${toX(moves[i].z)},${toY(moves[i].x)}`;
      cutPathLower += ` ${toX(moves[i].z)},${toY(-moves[i].x)}`;
    }
    cutPathUpper += ` ${toX(toolPos.z)},${toY(0)}`;
    cutPathLower += ` ${toX(toolPos.z)},${toY(0)}`;
  }

  const spinRadius = maxX * scale * 0.95;
  const spinCX = toX(maxZ);
  const spinCY = originX;

  const TS = Math.max(12, scale * 1.2);
  const iSz = TS * 0.55;
  const tx = toX(toolPos.z);
  const ty = toY(toolPos.x);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: "#09090f", display: "block" }}>
      {Array.from({ length: Math.ceil((w - PAD * 2) / 10) }, (_, i) => (
        <line key={`gx${i}`} x1={PAD + i * 10} y1={PAD} x2={PAD + i * 10} y2={h - PAD} stroke="#1c1c2e" strokeWidth={0.5} />
      ))}
      {Array.from({ length: Math.ceil((h - PAD * 2) / 10) }, (_, i) => (
        <line key={`gy${i}`} x1={PAD} y1={PAD + i * 10} x2={w - PAD} y2={PAD + i * 10} stroke="#1c1c2e" strokeWidth={0.5} />
      ))}

      <line x1={PAD} y1={originX} x2={w - PAD} y2={originX} stroke="#374151" strokeWidth={1} strokeDasharray="8,4" />

      <polygon points={fullSilhouette} fill="#4b5563" stroke="#6b7280" strokeWidth={1} />

      {endIdx > 0 && (
        <>
          <polygon points={cutPathUpper} fill="#09090f" />
          <polygon points={cutPathLower} fill="#09090f" />
        </>
      )}

      {moves.map((cur, i) => {
        if (i === 0) return null;
        const prev = moves[i - 1];
        return (
          <line key={`gh${i}`}
            x1={toX(prev.z)} y1={toY(prev.x)} x2={toX(cur.z)} y2={toY(cur.x)}
            stroke={cur.type === "rapid" ? "rgba(96,165,250,0.18)" : "rgba(34,197,94,0.13)"}
            strokeWidth={1} strokeDasharray={cur.type === "rapid" ? "4,4" : undefined} />
        );
      })}

      {endIdx > 0 && moves.slice(1, endIdx + 1).map((cur, i) => {
        const prev = moves[i];
        return (
          <line key={`ex${i}`}
            x1={toX(prev.z)} y1={toY(prev.x)} x2={toX(cur.z)} y2={toY(cur.x)}
            stroke={cur.type === "rapid" ? "#60a5fa" : "#22c55e"}
            strokeWidth={cur.type === "rapid" ? 1.5 : 2}
            strokeDasharray={cur.type === "rapid" ? "5,3" : undefined} />
        );
      })}

      <g opacity={0.10}>
        {Array.from({ length: 6 }, (_, i) => {
          const angle = rotation + (i * Math.PI) / 6;
          return (
            <line key={`sp${i}`}
              x1={spinCX - spinRadius * Math.cos(angle)} y1={spinCY - spinRadius * Math.sin(angle)}
              x2={spinCX + spinRadius * Math.cos(angle)} y2={spinCY + spinRadius * Math.sin(angle)}
              stroke="#a1a1aa" strokeWidth={1} />
          );
        })}
      </g>

      <g transform={`translate(${tx},${ty})`}>
        <rect x={-TS * 0.3} y={-TS * 0.6} width={TS * 1.2} height={TS * 1.2}
          fill="#78716c" stroke="#a8a29e" strokeWidth={1} />
        <polygon points={`0,${-iSz} ${iSz * 0.55},0 0,${iSz} ${-iSz * 0.55},0`}
          fill="#eab308" stroke="#fde047" strokeWidth={1} />
        <circle cx={0} cy={-iSz + 3} r={2} fill="#fef08a" />
      </g>

      <text x={w - PAD - 24} y={originX + 14} fill="#6b7280" fontSize="10" fontFamily="monospace">Z →</text>
      <text x={PAD} y={PAD - 6} fill="#6b7280" fontSize="10" fontFamily="monospace">X ↑</text>
      <text x={w - 8} y={h - 8} fill="#52525b" fontSize="10" fontFamily="monospace" textAnchor="end">
        Progress: {Math.round(progress * 100)}%
      </text>
      <text x={8} y={h - 8} fill="#52525b" fontSize="10" fontFamily="monospace">
        Z: {toolPos.z.toFixed(3)}  X: {toolPos.x.toFixed(3)}
      </text>
    </svg>
  );
}

export function TurnerSimulation() {
  const { gcodeOutputs, selectedStation, stations, gcodeConfig } = useCncStore();

  const activeStation = useMemo(() => {
    return selectedStation
      ? stations.find((s) => s.stationNumber === selectedStation)
      : stations[0];
  }, [selectedStation, stations]);

  const activeGcode = useMemo(() => {
    return selectedStation
      ? gcodeOutputs.find((o) => o.stationNumber === selectedStation)
      : gcodeOutputs[0];
  }, [selectedStation, gcodeOutputs]);

  const moves = useMemo(() => {
    const xDiameterMode = gcodeConfig?.xDiameterMode ?? true;
    if (activeGcode?.gcode && activeGcode.gcode.trim().length > 0) {
      const parsed = parseGcode(activeGcode.gcode, xDiameterMode);
      if (parsed.length > 1) return parsed;
    }
    return buildToolpathFromSegments(activeStation?.segments ?? []);
  }, [activeGcode, activeStation, gcodeConfig]);

  const isGcodeDriven = useMemo(
    () => !!(activeGcode?.gcode && activeGcode.gcode.trim().length > 0 && moves.length > 1),
    [activeGcode, moves]
  );

  const feedMmRev = useMemo(() => {
    if (!gcodeConfig) return 0.2;
    if (gcodeConfig.feedUnit === "mm_rev") return gcodeConfig.feedRate;
    const rpm = gcodeConfig.spindleSpeed > 0 ? gcodeConfig.spindleSpeed : 300;
    return gcodeConfig.feedRate / rpm;
  }, [gcodeConfig]);

  const feedMmMin = useMemo(() => {
    if (!gcodeConfig) return 150;
    if (gcodeConfig.feedUnit === "mm_min") return gcodeConfig.feedRate;
    const rpm = gcodeConfig.spindleSpeed > 0 ? gcodeConfig.spindleSpeed : 300;
    return gcodeConfig.feedRate * rpm;
  }, [gcodeConfig]);

  const noseRadius = useMemo(() => {
    const tool = gcodeConfig?.tools?.[0];
    return tool && tool.noseRadius > 0 ? tool.noseRadius : 0.4;
  }, [gcodeConfig]);

  const accuracy = useMemo(
    () => computeAccuracy(activeStation?.segments ?? [], moves, feedMmRev, noseRadius),
    [activeStation, moves, feedMmRev, noseRadius]
  );

  const raUm = useMemo(() => surfaceFinishRa(feedMmRev, noseRadius), [feedMmRev, noseRadius]);
  const cycleTimeSec = useMemo(() => estimateCycleTime(moves, feedMmMin), [moves, feedMmMin]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [rotation, setRotation] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

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
      setRotation((r) => r + dt * 6 * speed);
      setProgress((prev) => {
        const next = prev + dt * 0.06 * speed;
        if (next >= 1) { setIsPlaying(false); return 1; }
        return next;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, speed]);

  const handleCapture = () => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = dims.w * 2;
      canvas.height = dims.h * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#09090f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/png");
        a.download = `turner-sim-${Date.now()}.png`;
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleReset = () => { setIsPlaying(false); setProgress(0); setRotation(0); };

  const badgeColor = {
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  const overallBadge: "green" | "yellow" | "red" = accuracy.length === 0
    ? "green"
    : accuracy.some((a) => a.badge === "red") ? "red"
    : accuracy.some((a) => a.badge === "yellow") ? "yellow"
    : "green";

  return (
    <div className="flex flex-col h-full bg-[#070710] text-zinc-100 overflow-hidden">

      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5
                      border-b border-white/[0.06] bg-[#0B0B18]/80">
        <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Turner Sim</span>
        <span className="text-xs text-zinc-600">TurnAxis CAM-style 2D CNC Turning Simulation</span>

        {isGcodeDriven && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border
                           bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
            G-code driven
          </span>
        )}
        {!isGcodeDriven && moves.length > 1 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border
                           bg-zinc-500/10 border-zinc-500/25 text-zinc-500">
            Segment fallback
          </span>
        )}

        {activeStation && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border
                           bg-blue-500/10 border-blue-500/25 text-blue-400">
            Station {activeStation.stationNumber} — {activeStation.label}
          </span>
        )}
        {!activeStation && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border
                           bg-zinc-500/10 border-zinc-500/25 text-zinc-500">
            No station selected
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">

        <div className="flex flex-col flex-1 overflow-hidden">

          <div className="relative flex-1 bg-[#09090f]" ref={containerRef}>
            <TurnerSimSVG w={dims.w} h={dims.h} moves={moves} progress={progress} rotation={rotation} />
          </div>

          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2
                          bg-[#0D0D1A] border-t border-white/[0.06]">
            <button
              onClick={() => {
                if (progress >= 1) { setProgress(0); setRotation(0); }
                setIsPlaying((p) => !p);
              }}
              className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25
                         text-blue-400 hover:bg-blue-500/25 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                         text-zinc-400 hover:bg-white/[0.08] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <input
              type="range" min={0} max={1} step={0.001} value={progress}
              onChange={(e) => { setProgress(parseFloat(e.target.value)); setIsPlaying(false); }}
              className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
            />

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-600">Speed</span>
              <select
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="bg-[#13131F] border border-white/[0.08] rounded px-1.5 py-0.5
                           text-xs text-zinc-300 cursor-pointer"
              >
                <option value={0.5}>0.5×</option>
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={5}>5×</option>
              </select>
            </div>

            <button
              onClick={handleCapture}
              title="Save current frame as PNG"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-amber-500/15 border border-amber-500/30
                         text-amber-400 text-xs font-semibold
                         hover:bg-amber-500/25 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              Capture PNG
            </button>
          </div>
        </div>

        <div className="w-72 flex-shrink-0 flex flex-col border-l border-white/[0.06]
                        bg-[#0B0B18] overflow-y-auto">

          <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-white/[0.06]">
            <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase">Accuracy Calculator</h3>
            <p className="text-[10px] text-zinc-600 mt-0.5">In-browser, zero async delay</p>
          </div>

          <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-3 border-b border-white/[0.06]">

            <div className="bg-[#0F0F1C] border border-white/[0.06] rounded-lg p-2.5">
              <div className="text-[10px] text-zinc-600 mb-1">Surface Finish Ra</div>
              <div className="text-lg font-bold text-emerald-400">{raUm.toFixed(2)}</div>
              <div className="text-[10px] text-zinc-600">µm</div>
              <div className="text-[9px] text-zinc-700 mt-1">
                f={feedMmRev.toFixed(4)} mm/rev · r={noseRadius.toFixed(2)} mm
              </div>
            </div>

            <div className="bg-[#0F0F1C] border border-white/[0.06] rounded-lg p-2.5">
              <div className="text-[10px] text-zinc-600 mb-1">Cycle Time</div>
              <div className="text-lg font-bold text-blue-400">{cycleTimeSec.toFixed(1)}</div>
              <div className="text-[10px] text-zinc-600">seconds</div>
              <div className="text-[9px] text-zinc-700 mt-1">
                {moves.length} moves · {feedMmMin.toFixed(0)} mm/min
              </div>
            </div>

            <div className="col-span-2 bg-[#0F0F1C] border border-white/[0.06] rounded-lg p-2.5
                            flex items-center justify-between">
              <div>
                <div className="text-[10px] text-zinc-600 mb-0.5">Overall Tolerance</div>
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full border inline-block
                                 ${badgeColor[overallBadge]}`}>
                  {overallBadge === "green" ? "≤ 5 µm — PASS"
                    : overallBadge === "yellow" ? "≤ 20 µm — WARN"
                    : "> 20 µm — FAIL"}
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
                               ${overallBadge === "green" ? "bg-emerald-500/20"
                                 : overallBadge === "yellow" ? "bg-amber-500/20"
                                 : "bg-red-500/20"}`}>
                <div className={`w-3 h-3 rounded-full
                                 ${overallBadge === "green" ? "bg-emerald-400"
                                   : overallBadge === "yellow" ? "bg-amber-400"
                                   : "bg-red-400"}`} />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mb-2">
              Per-Segment Deviation
            </div>

            {accuracy.length === 0 && (
              <div className="text-xs text-zinc-600 text-center py-6">
                No segment data.<br />Configure a station first.
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {accuracy.map((item) => (
                <div key={item.segmentIndex}
                     className="bg-[#0F0F1C] border border-white/[0.05] rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-400 font-medium">{item.label}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border
                                     ${badgeColor[item.badge]}`}>
                      {item.badge === "green" ? "PASS" : item.badge === "yellow" ? "WARN" : "FAIL"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[9px] text-zinc-600">
                    <div>
                      <div className="text-zinc-700">Target R</div>
                      <div className="text-zinc-400">{item.targetRadius.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-700">Sim R</div>
                      <div className="text-zinc-400">{item.simulatedRadius.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-700">Δ (µm)</div>
                      <div className={item.badge === "green" ? "text-emerald-400"
                                       : item.badge === "yellow" ? "text-amber-400"
                                       : "text-red-400"}>
                        {item.deviationUm.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all
                                  ${item.badge === "green" ? "bg-emerald-400"
                                    : item.badge === "yellow" ? "bg-amber-400"
                                    : "bg-red-400"}`}
                      style={{ width: `${Math.min(100, (item.deviationUm / 25) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 px-3 py-2 border-t border-white/[0.05]">
            <div className="text-[9px] text-zinc-700 leading-relaxed">
              Ra = f² / (8×r) &nbsp;·&nbsp; f = {feedMmRev.toFixed(4)} mm/rev &nbsp;·&nbsp; r = {noseRadius} mm
            </div>
            <div className="text-[9px] text-zinc-700 mt-0.5">
              Deviation = |target R – sim R| from toolpath at segment Z
            </div>
            <div className="text-[9px] text-zinc-700 mt-0.5">
              Green ≤ 5 µm &nbsp;·&nbsp; Yellow ≤ 20 µm &nbsp;·&nbsp; Red &gt; 20 µm
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
