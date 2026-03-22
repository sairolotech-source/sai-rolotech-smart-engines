import React, { useState, useMemo } from "react";
import {
  Minus, ArrowRight, Settings, Check, AlertTriangle,
  Layers, BarChart3, Circle, Hexagon
} from "lucide-react";

interface WireSpec {
  inputShape: "round" | "square";
  inputDia: number;
  outputProfile: "round" | "flat" | "shaped" | "hex" | "custom";
  outputWidth: number;
  outputHeight: number;
  material: string;
  yieldStrength: number;
  tensileStrength: number;
  numStations: number;
  rollSpeed: number;
  friction: number;
}

interface WireStation {
  station: number;
  width: number;
  height: number;
  area: number;
  reduction: number;
  cumulativeReduction: number;
  rollingForce: number;
  torque: number;
  speed: number;
  elongation: number;
  description: string;
}

function calcWireStations(spec: WireSpec): WireStation[] {
  const { inputDia, outputWidth, outputHeight, numStations, yieldStrength, rollSpeed, friction } = spec;
  const stations: WireStation[] = [];

  const inputArea = spec.inputShape === "round"
    ? Math.PI * (inputDia / 2) ** 2
    : inputDia * inputDia;
  const outputArea = spec.outputProfile === "round"
    ? Math.PI * (outputWidth / 2) ** 2
    : spec.outputProfile === "hex"
    ? (3 * Math.sqrt(3) / 2) * (outputWidth / 2) ** 2
    : outputWidth * outputHeight;

  for (let i = 0; i <= numStations; i++) {
    const progress = i / numStations;
    const eased = 1 - Math.pow(1 - progress, 1.3);

    const currentArea = inputArea + (outputArea - inputArea) * eased;
    const prevArea = i > 0 ? stations[i - 1].area : inputArea;
    const localReduction = prevArea > 0 ? (1 - currentArea / prevArea) * 100 : 0;
    const totalReduction = (1 - currentArea / inputArea) * 100;

    const aspectRatio = outputWidth / (outputHeight || outputWidth);
    const currentAspect = 1 + (aspectRatio - 1) * eased;
    const h = Math.sqrt(currentArea / currentAspect);
    const w = h * currentAspect;

    const contactLength = Math.sqrt((prevArea - currentArea) / (Math.PI * 0.5));
    const meanYS = yieldStrength * (1 + 0.5 * totalReduction / 100);
    const force = meanYS * contactLength * w * (1 + friction * contactLength / (2 * h));
    const rollR = 100;
    const torque = force * contactLength / 2;

    const elongation = prevArea > 0 ? (prevArea / currentArea - 1) * 100 : 0;
    const speedFactor = inputArea / currentArea;

    stations.push({
      station: i,
      width: Math.round(w * 100) / 100,
      height: Math.round(h * 100) / 100,
      area: Math.round(currentArea * 100) / 100,
      reduction: Math.round(localReduction * 100) / 100,
      cumulativeReduction: Math.round(totalReduction * 100) / 100,
      rollingForce: Math.round(force),
      torque: Math.round(torque),
      speed: Math.round(rollSpeed * speedFactor * 10) / 10,
      elongation: Math.round(elongation * 100) / 100,
      description: i === 0 ? "Input" : i === numStations ? "Final" : `Pass ${i}`,
    });
  }

  return stations;
}

export function WireRollingView() {
  const [spec, setSpec] = useState<WireSpec>({
    inputShape: "round",
    inputDia: 8,
    outputProfile: "shaped",
    outputWidth: 12,
    outputHeight: 4,
    material: "Carbon Steel",
    yieldStrength: 400,
    tensileStrength: 550,
    numStations: 8,
    rollSpeed: 5,
    friction: 0.15,
  });

  const stations = useMemo(() => calcWireStations(spec), [spec]);
  const maxForce = Math.max(...stations.map(s => s.rollingForce));
  const totalReduction = stations[stations.length - 1]?.cumulativeReduction || 0;

  const updateSpec = (key: keyof WireSpec, val: any) => setSpec(prev => ({ ...prev, [key]: val }));

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-rose-500/5 to-transparent">
        <Minus className="w-5 h-5 text-rose-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF WireRolling</div>
          <div className="text-[10px] text-zinc-500">Profile Wire Forming — Round/Square → Complex Profile Shapes</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400">
            {spec.numStations} Passes
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
            {totalReduction.toFixed(1)}% Reduction
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Input Wire</div>
          <div className="flex gap-1 mb-1">
            {(["round", "square"] as const).map(s => (
              <button key={s} onClick={() => updateSpec("inputShape", s)}
                className={`flex-1 text-[9px] py-1 rounded border ${spec.inputShape === s ? "bg-rose-500/20 border-rose-500/30 text-rose-300" : "border-white/[0.06] text-zinc-500"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {[
            { label: "Input Ø/Size", key: "inputDia", unit: "mm" },
          ].map(({ label, key, unit }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={(spec as any)[key]}
                onChange={e => updateSpec(key as any, parseFloat(e.target.value) || 0)} step={0.1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              <span className="text-[9px] text-zinc-600 w-8">{unit}</span>
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-2">Output Profile</div>
          <div className="flex gap-1 mb-1">
            {(["round", "flat", "shaped", "hex"] as const).map(p => (
              <button key={p} onClick={() => updateSpec("outputProfile", p)}
                className={`flex-1 text-[8px] py-1 rounded border ${spec.outputProfile === p ? "bg-blue-500/20 border-blue-500/30 text-blue-300" : "border-white/[0.06] text-zinc-500"}`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          {[
            { label: "Output W", key: "outputWidth", unit: "mm" },
            { label: "Output H", key: "outputHeight", unit: "mm" },
          ].map(({ label, key, unit }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={(spec as any)[key]}
                onChange={e => updateSpec(key as any, parseFloat(e.target.value) || 0)} step={0.1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              <span className="text-[9px] text-zinc-600 w-8">{unit}</span>
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-2">Process</div>
          {[
            { label: "Yield (σy)", key: "yieldStrength", unit: "MPa" },
            { label: "Stations", key: "numStations", unit: "" },
            { label: "Roll Speed", key: "rollSpeed", unit: "m/s" },
            { label: "Friction μ", key: "friction", unit: "" },
          ].map(({ label, key, unit }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={(spec as any)[key]}
                onChange={e => updateSpec(key as any, parseFloat(e.target.value) || 0)}
                step={key === "friction" ? 0.01 : key === "rollSpeed" ? 0.5 : 1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              {unit && <span className="text-[9px] text-zinc-600 w-8">{unit}</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
            Wire Rolling Sequence — Ø{spec.inputDia} → {spec.outputWidth}×{spec.outputHeight}
          </div>

          <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4 mb-4">
            <svg viewBox="0 0 800 150" className="w-full h-28">
              {stations.map((s, i) => {
                const x = 40 + i * (720 / stations.length);
                const maxA = stations[0].area;
                const scale = 40 / Math.sqrt(maxA / Math.PI);
                const r = Math.sqrt(s.area / Math.PI) * scale;
                return (
                  <g key={i}>
                    {spec.outputProfile === "round" || i === 0 ? (
                      <circle cx={x} cy={60} r={Math.max(r, 3)} fill="none" stroke={i === 0 ? "#fb7185" : i === stations.length - 1 ? "#22c55e" : "#60a5fa"} strokeWidth={1.2} />
                    ) : (
                      <rect x={x - s.width * scale / 4} y={60 - s.height * scale / 4}
                        width={Math.max(s.width * scale / 2, 4)} height={Math.max(s.height * scale / 2, 4)}
                        rx={1} fill="none" stroke={i === stations.length - 1 ? "#22c55e" : "#60a5fa"} strokeWidth={1.2} />
                    )}
                    <text x={x} y={110} textAnchor="middle" fill="#666" fontSize={7}>P{s.station}</text>
                    <text x={x} y={122} textAnchor="middle" fill="#888" fontSize={6}>{s.reduction.toFixed(1)}%</text>
                    {i < stations.length - 1 && (
                      <line x1={x + r + 5} y1={60} x2={x + (720 / stations.length) - r - 5} y2={60}
                        stroke="#333" strokeWidth={0.5} />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {["Pass", "W×H", "Area", "Red.%", "Cum.%", "Force", "Torque", "Speed", "Elong.%"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map(s => (
                <tr key={s.station} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-2 py-1 font-mono text-zinc-500">{s.station}</td>
                  <td className="px-2 py-1 text-zinc-300">{s.width}×{s.height}</td>
                  <td className="px-2 py-1 text-blue-300">{s.area}mm²</td>
                  <td className="px-2 py-1 text-amber-300">{s.reduction}%</td>
                  <td className="px-2 py-1 text-orange-300">{s.cumulativeReduction}%</td>
                  <td className="px-2 py-1 text-red-300">{s.rollingForce}N</td>
                  <td className="px-2 py-1 text-purple-300">{s.torque}N·m</td>
                  <td className="px-2 py-1 text-zinc-300">{s.speed}m/s</td>
                  <td className="px-2 py-1 text-green-300">{s.elongation}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Max Force</div>
              <div className="text-sm font-bold text-red-400">{(maxForce / 1000).toFixed(1)} kN</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Total Red.</div>
              <div className="text-sm font-bold text-amber-400">{totalReduction.toFixed(1)}%</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Exit Speed</div>
              <div className="text-sm font-bold text-green-400">{stations[stations.length - 1]?.speed || 0} m/s</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Passes</div>
              <div className="text-sm font-bold text-rose-400">{spec.numStations}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
