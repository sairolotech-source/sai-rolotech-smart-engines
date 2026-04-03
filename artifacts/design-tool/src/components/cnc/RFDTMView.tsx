import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Activity, ArrowRight, AlertTriangle, Check, TrendingUp,
  RefreshCw, ChevronDown, Layers, BarChart3, Zap
} from "lucide-react";

interface DTMResult {
  station: number;
  longitudinalStrain: number;
  transverseStrain: number;
  shearStrain: number;
  vonMises: number;
  edgeStrain: number;
  centerStrain: number;
  thinning: number;
  feasible: boolean;
  riskLevel: "low" | "medium" | "high" | "critical";
}

function calcDTM(
  profileWidth: number,
  thickness: number,
  numStations: number,
  yieldStrength: number,
  bendRadius: number
): DTMResult[] {
  const results: DTMResult[] = [];
  const t = thickness;
  const r = bendRadius;
  const W = profileWidth;

  for (let i = 1; i <= numStations; i++) {
    const progress = i / numStations;
    const angle = progress * 90;
    const angleRad = angle * Math.PI / 180;

    const outerFiber = t / (2 * (r + t / 2));
    const longStrain = outerFiber * Math.sin(angleRad) * 100;

    const transStrain = -longStrain * 0.3;

    const edgeElongation = (1 / Math.cos(angleRad) - 1) * 100;
    const shear = edgeElongation * 0.15;

    const vm = Math.sqrt(longStrain ** 2 + transStrain ** 2 - longStrain * transStrain + 3 * shear ** 2);

    const edgeStr = edgeElongation * (W / (2 * r));
    const centerStr = longStrain * 0.3;

    const thinPct = t * (1 - Math.cos(angleRad / 2)) / t * 100;

    const maxAllowable = (yieldStrength / 210000) * 100 * 3;
    const feasible = vm < maxAllowable;
    const riskLevel: DTMResult["riskLevel"] =
      vm < maxAllowable * 0.5 ? "low" :
      vm < maxAllowable * 0.75 ? "medium" :
      vm < maxAllowable ? "high" : "critical";

    results.push({
      station: i,
      longitudinalStrain: Math.round(longStrain * 1000) / 1000,
      transverseStrain: Math.round(transStrain * 1000) / 1000,
      shearStrain: Math.round(shear * 1000) / 1000,
      vonMises: Math.round(vm * 1000) / 1000,
      edgeStrain: Math.round(edgeStr * 1000) / 1000,
      centerStrain: Math.round(centerStr * 1000) / 1000,
      thinning: Math.round(thinPct * 100) / 100,
      feasible,
      riskLevel,
    });
  }

  return results;
}

export function RFDTMView() {
  const { stations, geometry } = useCncStore();
  const [profileWidth, setProfileWidth] = useState(() => {
    if (geometry?.boundingBox) return Math.round(geometry.boundingBox.maxX - geometry.boundingBox.minX);
    return 200;
  });
  const [thickness, setThickness] = useState(1.2);
  const [numStations, setNumStations] = useState(stations?.length || 12);
  const [yieldStrength, setYieldStrength] = useState(280);
  const [bendRadius, setBendRadius] = useState(3);
  const [viewMode, setViewMode] = useState<"chart" | "table" | "heatmap">("chart");

  const dtmResults = useMemo(() =>
    calcDTM(profileWidth, thickness, numStations, yieldStrength, bendRadius),
    [profileWidth, thickness, numStations, yieldStrength, bendRadius]
  );

  const maxVM = Math.max(...dtmResults.map(d => d.vonMises));
  const maxEdge = Math.max(...dtmResults.map(d => d.edgeStrain));
  const maxThin = Math.max(...dtmResults.map(d => d.thinning));
  const allFeasible = dtmResults.every(d => d.feasible);
  const criticalCount = dtmResults.filter(d => d.riskLevel === "critical").length;
  const highCount = dtmResults.filter(d => d.riskLevel === "high").length;

  const riskColor = (r: DTMResult["riskLevel"]) =>
    r === "low" ? "text-green-400 bg-green-500/10" :
    r === "medium" ? "text-amber-400 bg-amber-500/10" :
    r === "high" ? "text-orange-400 bg-orange-500/10" :
    "text-red-400 bg-red-500/10";

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-cyan-500/5 to-transparent">
        <Activity className="w-5 h-5 text-cyan-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF DTM — Dynamic Deformation Technology</div>
          <div className="text-[10px] text-zinc-500">Real-Time Longitudinal Strain Visualization & Feasibility Analysis</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {allFeasible ? (
            <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> All Feasible
            </span>
          ) : (
            <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {criticalCount} Critical
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-3 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Input Parameters</div>
          {[
            { label: "Profile Width", value: profileWidth, set: setProfileWidth, unit: "mm" },
            { label: "Thickness", value: thickness, set: setThickness, unit: "mm", step: 0.1 },
            { label: "Stations", value: numStations, set: setNumStations, unit: "", step: 1 },
            { label: "Yield Strength", value: yieldStrength, set: setYieldStrength, unit: "MPa" },
            { label: "Bend Radius", value: bendRadius, set: setBendRadius, unit: "mm" },
          ].map(({ label, value, set, unit, step }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-24">{label}</span>
              <input type="number" value={value} onChange={e => set(parseFloat(e.target.value) || 0)}
                step={step || 0.1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              {unit && <span className="text-[9px] text-zinc-600 w-8">{unit}</span>}
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-3">View Mode</div>
          <div className="flex gap-1">
            {(["chart", "table", "heatmap"] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`flex-1 text-[9px] py-1 rounded border ${viewMode === m ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300" : "border-white/[0.06] text-zinc-500"}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1 mt-3">
            <div className="text-[10px] font-bold text-zinc-400">Risk Summary</div>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span className="text-zinc-500">Max Von Mises</span><span className="text-cyan-300">{maxVM.toFixed(3)}%</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Max Edge Strain</span><span className="text-orange-300">{maxEdge.toFixed(3)}%</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Max Thinning</span><span className="text-red-300">{maxThin.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Critical Stations</span><span className={criticalCount > 0 ? "text-red-400" : "text-green-400"}>{criticalCount}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">High-Risk Stations</span><span className={highCount > 0 ? "text-orange-400" : "text-green-400"}>{highCount}</span></div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {viewMode === "chart" && (
            <>
              <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                Strain Distribution — Real-Time DTM Analysis
              </div>
              <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4 mb-4">
                <svg viewBox={`0 0 ${numStations * 50 + 60} 220`} className="w-full h-48">
                  {dtmResults.map((d, i) => {
                    const x = 50 + i * 50;
                    const barH = (d.vonMises / (maxVM * 1.2)) * 150;
                    const edgeH = (Math.abs(d.edgeStrain) / (Math.max(maxEdge, 0.01) * 1.2)) * 150;
                    const color = d.riskLevel === "critical" ? "#ef4444" : d.riskLevel === "high" ? "#f97316" : d.riskLevel === "medium" ? "#f59e0b" : "#22c55e";
                    return (
                      <g key={i}>
                        <rect x={x - 8} y={180 - barH} width={8} height={barH} fill={color} opacity={0.7} rx={1} />
                        <rect x={x + 2} y={180 - edgeH} width={8} height={edgeH} fill="#60a5fa" opacity={0.5} rx={1} />
                        <text x={x} y={195} textAnchor="middle" fill="#666" fontSize={8}>{d.station}</text>
                      </g>
                    );
                  })}
                  <line x1={40} y1={180} x2={numStations * 50 + 50} y2={180} stroke="#333" strokeWidth={0.5} />
                  <text x={15} y={105} fill="#666" fontSize={7} transform="rotate(-90, 15, 105)">Strain %</text>
                  <rect x={numStations * 50 - 60} y={5} width={8} height={8} fill="#22c55e" opacity={0.7} />
                  <text x={numStations * 50 - 48} y={12} fill="#888" fontSize={7}>Von Mises</text>
                  <rect x={numStations * 50 - 60} y={18} width={8} height={8} fill="#60a5fa" opacity={0.5} />
                  <text x={numStations * 50 - 48} y={25} fill="#888" fontSize={7}>Edge Strain</text>
                </svg>
              </div>

              <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4">
                <div className="text-[10px] font-bold text-zinc-400 mb-2">Longitudinal Strain Progression</div>
                <svg viewBox={`0 0 ${numStations * 50 + 60} 120`} className="w-full h-24">
                  <polyline
                    points={dtmResults.map((d, i) => `${50 + i * 50},${100 - (d.longitudinalStrain / (maxVM * 1.2)) * 80}`).join(" ")}
                    fill="none" stroke="#06b6d4" strokeWidth={1.5} />
                  <polyline
                    points={dtmResults.map((d, i) => `${50 + i * 50},${100 - (Math.abs(d.transverseStrain) / (maxVM * 1.2)) * 80}`).join(" ")}
                    fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2" />
                  {dtmResults.map((d, i) => (
                    <circle key={i} cx={50 + i * 50} cy={100 - (d.longitudinalStrain / (maxVM * 1.2)) * 80}
                      r={3} fill={d.riskLevel === "critical" ? "#ef4444" : "#06b6d4"} />
                  ))}
                  <line x1={40} y1={100} x2={numStations * 50 + 50} y2={100} stroke="#333" strokeWidth={0.5} />
                </svg>
              </div>
            </>
          )}

          {viewMode === "heatmap" && (
            <>
              <div className="text-[11px] font-bold text-zinc-400 mb-3">Strain Heatmap — Edge to Center</div>
              <div className="grid grid-cols-1 gap-1">
                {dtmResults.map(d => {
                  const edgeW = Math.min(Math.abs(d.edgeStrain) / (maxEdge || 1) * 100, 100);
                  const centerW = Math.min(d.centerStrain / (maxVM || 1) * 100, 100);
                  return (
                    <div key={d.station} className="flex items-center gap-2">
                      <span className="text-[9px] text-zinc-500 w-8 text-right">S{d.station}</span>
                      <div className="flex-1 h-4 bg-black/30 rounded overflow-hidden flex">
                        <div className="h-full bg-gradient-to-r from-red-500/60 to-orange-500/40" style={{ width: `${edgeW}%` }} />
                        <div className="flex-1 bg-gradient-to-r from-green-500/20 to-green-500/40" style={{ maxWidth: `${centerW}%` }} />
                        <div className="h-full bg-gradient-to-l from-red-500/60 to-orange-500/40" style={{ width: `${edgeW}%` }} />
                      </div>
                      <span className={`text-[8px] px-1 py-0.5 rounded ${riskColor(d.riskLevel)}`}>{d.riskLevel}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {viewMode === "table" && (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {["Stn", "Long.ε%", "Trans.ε%", "Shear%", "VM%", "Edge%", "Thin%", "Risk"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dtmResults.map(d => (
                  <tr key={d.station} className={`border-b border-white/[0.04] ${d.riskLevel === "critical" ? "bg-red-500/5" : ""}`}>
                    <td className="px-2 py-1 font-mono text-zinc-500">{d.station}</td>
                    <td className="px-2 py-1 text-cyan-300">{d.longitudinalStrain.toFixed(3)}</td>
                    <td className="px-2 py-1 text-amber-300">{d.transverseStrain.toFixed(3)}</td>
                    <td className="px-2 py-1 text-zinc-300">{d.shearStrain.toFixed(3)}</td>
                    <td className="px-2 py-1 text-purple-300">{d.vonMises.toFixed(3)}</td>
                    <td className="px-2 py-1 text-orange-300">{d.edgeStrain.toFixed(3)}</td>
                    <td className="px-2 py-1 text-red-300">{d.thinning.toFixed(2)}</td>
                    <td className="px-2 py-1"><span className={`text-[9px] px-1.5 py-0.5 rounded ${riskColor(d.riskLevel)}`}>{d.riskLevel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Max VM Strain</div>
              <div className="text-sm font-bold text-cyan-400">{maxVM.toFixed(3)}%</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Max Edge</div>
              <div className="text-sm font-bold text-orange-400">{maxEdge.toFixed(3)}%</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Max Thinning</div>
              <div className="text-sm font-bold text-red-400">{maxThin.toFixed(2)}%</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Feasibility</div>
              <div className={`text-sm font-bold ${allFeasible ? "text-green-400" : "text-red-400"}`}>
                {allFeasible ? "PASS" : "FAIL"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
