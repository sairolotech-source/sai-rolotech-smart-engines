import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  TrendingDown, ArrowRight, Check, AlertTriangle,
  BarChart3, Layers, RefreshCw, Settings
} from "lucide-react";

interface DownhillResult {
  station: number;
  conventionalAngle: number;
  downhillAngle: number;
  edgeElongation: number;
  downhillElongation: number;
  improvementPct: number;
  edgePath: number;
  conventionalEdgePath: number;
}

function calcDownhillForming(
  numStations: number,
  totalAngle: number,
  profileWidth: number,
  thickness: number,
  downhillFactor: number
): DownhillResult[] {
  const results: DownhillResult[] = [];
  const W = profileWidth;
  const t = thickness;

  for (let i = 1; i <= numStations; i++) {
    const progress = i / numStations;

    const convAngle = progress * totalAngle;

    const dhProgress = Math.pow(progress, 0.65 + downhillFactor * 0.2);
    const dhAngle = dhProgress * totalAngle;

    const convAngleRad = convAngle * Math.PI / 180;
    const dhAngleRad = dhAngle * Math.PI / 180;

    const convElongation = (1 / Math.cos(convAngleRad / 2) - 1) * (W / (2 * (t * 3))) * 100;
    const dhElongation = (1 / Math.cos(dhAngleRad / 2) - 1) * (W / (2 * (t * 3))) * 100 * (1 - downhillFactor * 0.3);

    const improvement = convElongation > 0 ? ((convElongation - dhElongation) / convElongation) * 100 : 0;

    const convEdgePath = W / 2 * (1 / Math.cos(convAngleRad) - 1);
    const dhEdgePath = W / 2 * (1 / Math.cos(dhAngleRad) - 1) * (1 - downhillFactor * 0.25);

    results.push({
      station: i,
      conventionalAngle: Math.round(convAngle * 10) / 10,
      downhillAngle: Math.round(dhAngle * 10) / 10,
      edgeElongation: Math.round(convElongation * 1000) / 1000,
      downhillElongation: Math.round(dhElongation * 1000) / 1000,
      improvementPct: Math.round(improvement * 10) / 10,
      edgePath: Math.round(dhEdgePath * 100) / 100,
      conventionalEdgePath: Math.round(convEdgePath * 100) / 100,
    });
  }

  return results;
}

export function DownhillFormingView() {
  const { stations, geometry } = useCncStore();
  const [numStations, setNumStations] = useState(stations?.length || 12);
  const [totalAngle, setTotalAngle] = useState(90);
  const [profileWidth, setProfileWidth] = useState(() => {
    if (geometry?.boundingBox) return Math.round(geometry.boundingBox.maxX - geometry.boundingBox.minX);
    return 200;
  });
  const [thickness, setThickness] = useState(1.5);
  const [downhillFactor, setDownhillFactor] = useState(0.7);

  const results = useMemo(() =>
    calcDownhillForming(numStations, totalAngle, profileWidth, thickness, downhillFactor),
    [numStations, totalAngle, profileWidth, thickness, downhillFactor]
  );

  const maxConvElong = Math.max(...results.map(r => r.edgeElongation));
  const maxDHElong = Math.max(...results.map(r => r.downhillElongation));
  const avgImprovement = results.reduce((a, r) => a + r.improvementPct, 0) / results.length;
  const totalConvEdge = results.reduce((a, r) => a + r.conventionalEdgePath, 0);
  const totalDHEdge = results.reduce((a, r) => a + r.edgePath, 0);

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-lime-500/5 to-transparent">
        <TrendingDown className="w-5 h-5 text-lime-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF Down-Hill Forming</div>
          <div className="text-[10px] text-zinc-500">Edge Path Optimization — Minimized Longitudinal Elongation</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-lime-500/10 border border-lime-500/20 text-lime-400">
            {avgImprovement.toFixed(1)}% Improvement
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Parameters</div>
          {[
            { label: "Stations", value: numStations, set: setNumStations, step: 1 },
            { label: "Total Angle", value: totalAngle, set: setTotalAngle, step: 5, unit: "°" },
            { label: "Profile Width", value: profileWidth, set: setProfileWidth, step: 1, unit: "mm" },
            { label: "Thickness", value: thickness, set: setThickness, step: 0.1, unit: "mm" },
          ].map(({ label, value, set, step, unit }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-24">{label}</span>
              <input type="number" value={value} onChange={e => set(parseFloat(e.target.value) || 0)}
                step={step}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              {unit && <span className="text-[9px] text-zinc-600 w-6">{unit}</span>}
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-3">Down-Hill Factor</div>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={1} step={0.05} value={downhillFactor}
              onChange={e => setDownhillFactor(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-700 rounded appearance-none" />
            <span className="text-[11px] text-lime-400 w-10 text-right">{(downhillFactor * 100).toFixed(0)}%</span>
          </div>
          <div className="text-[9px] text-zinc-600">Higher = more aggressive down-hill optimization</div>

          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1 mt-3">
            <div className="text-[10px] font-bold text-zinc-400">Comparison</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-zinc-500">Conv. Max ε</span><span className="text-red-300 text-right">{maxConvElong.toFixed(3)}%</span>
              <span className="text-zinc-500">DH Max ε</span><span className="text-green-300 text-right">{maxDHElong.toFixed(3)}%</span>
              <span className="text-zinc-500">Conv. Edge Path</span><span className="text-red-300 text-right">{totalConvEdge.toFixed(2)}mm</span>
              <span className="text-zinc-500">DH Edge Path</span><span className="text-green-300 text-right">{totalDHEdge.toFixed(2)}mm</span>
              <span className="text-zinc-500">Avg Improvement</span><span className="text-lime-300 text-right">{avgImprovement.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-lime-400" />
            Edge Elongation Comparison — Conventional vs Down-Hill
          </div>

          <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4 mb-4">
            <svg viewBox={`0 0 ${numStations * 55 + 80} 180`} className="w-full h-36">
              {results.map((r, i) => {
                const x = 60 + i * 55;
                const maxE = Math.max(maxConvElong, 0.01);
                const convH = (r.edgeElongation / maxE) * 130;
                const dhH = (r.downhillElongation / maxE) * 130;
                return (
                  <g key={i}>
                    <rect x={x - 10} y={150 - convH} width={9} height={convH} fill="#ef4444" opacity={0.5} rx={1} />
                    <rect x={x + 2} y={150 - dhH} width={9} height={dhH} fill="#84cc16" opacity={0.7} rx={1} />
                    <text x={x} y={165} textAnchor="middle" fill="#666" fontSize={8}>{r.station}</text>
                  </g>
                );
              })}
              <line x1={50} y1={150} x2={numStations * 55 + 70} y2={150} stroke="#333" strokeWidth={0.5} />
              <text x={15} y={85} fill="#666" fontSize={7} transform="rotate(-90, 15, 85)">ε%</text>
              <rect x={numStations * 55 - 10} y={5} width={8} height={8} fill="#ef4444" opacity={0.5} />
              <text x={numStations * 55 + 2} y={12} fill="#888" fontSize={7}>Conventional</text>
              <rect x={numStations * 55 - 10} y={18} width={8} height={8} fill="#84cc16" opacity={0.7} />
              <text x={numStations * 55 + 2} y={25} fill="#888" fontSize={7}>Down-Hill</text>
            </svg>
          </div>

          <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4 mb-4">
            <div className="text-[10px] font-bold text-zinc-400 mb-2">Angle Progression</div>
            <svg viewBox={`0 0 ${numStations * 55 + 80} 120`} className="w-full h-24">
              <polyline points={results.map((r, i) => `${60 + i * 55},${100 - (r.conventionalAngle / totalAngle) * 80}`).join(" ")}
                fill="none" stroke="#ef4444" strokeWidth={1} opacity={0.6} />
              <polyline points={results.map((r, i) => `${60 + i * 55},${100 - (r.downhillAngle / totalAngle) * 80}`).join(" ")}
                fill="none" stroke="#84cc16" strokeWidth={1.5} />
              {results.map((r, i) => (
                <circle key={i} cx={60 + i * 55} cy={100 - (r.downhillAngle / totalAngle) * 80}
                  r={2.5} fill="#84cc16" />
              ))}
              <line x1={50} y1={100} x2={numStations * 55 + 70} y2={100} stroke="#333" strokeWidth={0.5} />
            </svg>
          </div>

          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {["Stn", "Conv.°", "DH°", "Conv.ε%", "DH ε%", "Improv.%", "Conv.Edge", "DH Edge"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.station} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-2 py-1 font-mono text-zinc-500">{r.station}</td>
                  <td className="px-2 py-1 text-red-300">{r.conventionalAngle}°</td>
                  <td className="px-2 py-1 text-lime-300">{r.downhillAngle}°</td>
                  <td className="px-2 py-1 text-red-300">{r.edgeElongation.toFixed(3)}</td>
                  <td className="px-2 py-1 text-lime-300">{r.downhillElongation.toFixed(3)}</td>
                  <td className="px-2 py-1 text-green-300">{r.improvementPct}%</td>
                  <td className="px-2 py-1 text-red-300">{r.conventionalEdgePath}mm</td>
                  <td className="px-2 py-1 text-lime-300">{r.edgePath}mm</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Strain Reduction</div>
              <div className="text-lg font-bold text-lime-400">{avgImprovement.toFixed(1)}%</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Edge Path Saved</div>
              <div className="text-lg font-bold text-green-400">{(totalConvEdge - totalDHEdge).toFixed(2)}mm</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">DH Factor</div>
              <div className="text-lg font-bold text-lime-400">{(downhillFactor * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
