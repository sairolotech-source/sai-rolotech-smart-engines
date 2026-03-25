import React, { useState, useMemo, useRef, useEffect } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Flame, Download, TrendingUp } from "lucide-react";

/**
 * FIX: FormingEnergyView MAT_PROPS corrections:
 * - CR/HR yieldStrength SWAPPED (CR:250↔HR:350) — CRITICAL; correct: CR=340, HR=250
 * - AL yield 110→270 (6061-T4); kFactor 0.38→0.43
 * - TI kFactor 0.52→0.50; E 116→115 GPa
 * - CU kFactor 0.40→0.44
 * - PP ys:35/E:1500 was polypropylene → pre-painted steel (roll forming context: ys=280, E=200000)
 * - HSLA kFactor 0.50→0.45 (DIN 6935)
 * Source: deep-accuracy-engine.ts MATERIAL_PROPS (authoritative)
 */
const MAT_PROPS: Record<string, { yieldStrength: number; elasticModulus: number; kFactor: number; density: number }> = {
  GI:   { yieldStrength: 280, elasticModulus: 200000, kFactor: 0.44, density: 7850 },
  CR:   { yieldStrength: 340, elasticModulus: 200000, kFactor: 0.44, density: 7850 },  // FIX: was 250 (swapped with HR)
  HR:   { yieldStrength: 250, elasticModulus: 200000, kFactor: 0.42, density: 7850 },  // FIX: was 350 (swapped with CR), kf 0.48→0.42
  SS:   { yieldStrength: 520, elasticModulus: 193000, kFactor: 0.50, density: 7930 },
  AL:   { yieldStrength: 270, elasticModulus: 69000,  kFactor: 0.43, density: 2700 },  // FIX: yield 110→270, kf 0.38→0.43
  MS:   { yieldStrength: 250, elasticModulus: 200000, kFactor: 0.42, density: 7850 },
  CU:   { yieldStrength: 200, elasticModulus: 117000, kFactor: 0.44, density: 8960 },  // FIX: kf 0.40→0.44
  TI:   { yieldStrength: 880, elasticModulus: 115000, kFactor: 0.50, density: 4510 },  // FIX: kf 0.52→0.50, E 116→115
  PP:   { yieldStrength: 280, elasticModulus: 200000, kFactor: 0.44, density: 7850 },  // FIX: was polypropylene; PP=pre-painted steel in roll forming
  HSLA: { yieldStrength: 550, elasticModulus: 205000, kFactor: 0.45, density: 7850 },  // FIX: kf 0.50→0.45
};

interface EnergyStation {
  station: number;
  bendEnergy: number;
  frictionEnergy: number;
  redundantEnergy: number;
  totalEnergy: number;
  cumulativeEnergy: number;
  maxAngle: number;
  formingForce: number;
  torque: number;
}

export function FormingEnergyView() {
  const { stations, materialType, materialThickness: thickness, geometry: rawGeometry } = useCncStore();
  const geometry = rawGeometry ?? { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  const [lineSpeed, setLineSpeed] = useState(30);
  const [friction, setFriction] = useState(0.12);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mat = MAT_PROPS[materialType] ?? MAT_PROPS.GI;
  const safeThickness = Math.max(thickness, 0.1);
  const allX = geometry.segments.flatMap(s => [s.startX, s.endX]);
  const profileWidth = allX.length > 1 ? Math.max(...allX) - Math.min(...allX) : 100;

  const energyData: EnergyStation[] = useMemo(() => {
    const data = stations.map((st, idx) => {
      const fp = (idx + 1) / Math.max(stations.length, 1);
      const maxAngle = Math.max(...(st.bendAngles.length ? st.bendAngles : [0]));
      const bendRad = (maxAngle * Math.PI) / 180;
      const nBends = st.bendAngles.filter(a => a > 0.5).length || 1;
      const bRadius = Math.max(safeThickness * 2, 1);
      const strainMax = (safeThickness / (2 * bRadius + safeThickness)) * bendRad * fp;
      const bendEnergy = mat.yieldStrength * strainMax * strainMax * safeThickness * (Math.PI / 4) * (1 + mat.kFactor) * nBends * 0.001;
      const frictionEnergy = friction * mat.yieldStrength * safeThickness * profileWidth * 0.001 * fp * 0.0001;
      const redundantEnergy = bendEnergy * 0.15 * (1 + 0.3 * fp);
      const totalEnergy = bendEnergy + frictionEnergy + redundantEnergy;
      const formingForce = mat.yieldStrength * safeThickness * profileWidth * strainMax * 0.001;
      const rollDia = 150;
      const torque = formingForce * (rollDia / 2) * 0.001;
      return { station: idx + 1, bendEnergy, frictionEnergy, redundantEnergy, totalEnergy, cumulativeEnergy: 0, maxAngle, formingForce, torque };
    });
    let cumSum = 0;
    data.forEach(e => { cumSum += e.totalEnergy; e.cumulativeEnergy = cumSum; });
    return data;
  }, [stations, mat, safeThickness, profileWidth, friction]);

  const totalEnergy = energyData.reduce((s, e) => s + e.totalEnergy, 0);
  const peakForce = Math.max(...energyData.map(e => e.formingForce), 0);
  const peakTorque = Math.max(...energyData.map(e => e.torque), 0);
  const powerReq = (totalEnergy * lineSpeed) / 60;

  const w = dims.w;
  const h = dims.h;
  const chartL = 80;
  const chartR = w - 260;
  const chartT = 70;
  const chartB = h / 2 - 20;
  const chartW = Math.max(chartR - chartL, 1);
  const chartH = Math.max(chartB - chartT, 1);
  const maxE = Math.max(...energyData.map(e => e.totalEnergy), 0.001);
  const barW = energyData.length > 0 ? chartW / energyData.length : 1;

  const chart2T = h / 2 + 20;
  const chart2B = h - 50;
  const chart2H = Math.max(chart2B - chart2T, 1);
  const maxForce = Math.max(...energyData.map(e => e.formingForce), 0.1);
  const maxCum = Math.max(...energyData.map(e => e.cumulativeEnergy), 0.001);

  const forceLine = energyData.map((e, i) => {
    const x = chartL + (i / Math.max(energyData.length - 1, 1)) * chartW;
    const y = chart2T + chart2H - (e.formingForce / maxForce) * chart2H;
    return `${x},${y}`;
  }).join(" ");

  const cumLine = energyData.map((e, i) => {
    const x = chartL + (i / Math.max(energyData.length - 1, 1)) * chartW;
    const y = chart2T + chart2H - (e.cumulativeEnergy / maxCum) * chart2H;
    return `${x},${y}`;
  }).join(" ");

  const exportCSV = () => {
    const header = "Station,Bend Energy (kJ/m),Friction Energy,Redundant Energy,Total Energy,Cumulative,Force (kN),Torque (Nm),Max Angle (°)\n";
    const rows = energyData.map(e =>
      `${e.station},${e.bendEnergy.toFixed(5)},${e.frictionEnergy.toFixed(5)},${e.redundantEnergy.toFixed(5)},${e.totalEnergy.toFixed(5)},${e.cumulativeEnergy.toFixed(5)},${e.formingForce.toFixed(2)},${e.torque.toFixed(2)},${e.maxAngle.toFixed(1)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forming_energy.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Forming Energy Analysis</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">SVG Pro</span>
        <div className="flex-1" />
        <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[9px] text-zinc-400">
          <Download className="w-3 h-3" /> Export CSV
        </button>
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

            {!energyData.length ? (
              <text x={w / 2} y={h / 2} fill="#555" fontSize="14" fontFamily="sans-serif" textAnchor="middle">
                Generate Power Pattern to view forming energy
              </text>
            ) : (
              <>
                <text x={20} y={25} fill="#fff" fontSize="12" fontWeight="bold" fontFamily="sans-serif">Forming Energy &amp; Force Analysis</text>
                <text x={20} y={42} fill="#666" fontSize="10" fontFamily="sans-serif">{materialType} {thickness}mm · Width: {profileWidth.toFixed(1)}mm · Speed: {lineSpeed} m/min · μ={friction}</text>

                <rect x={chartL} y={chartT} width={chartW} height={chartH} fill="none" stroke="rgba(255,255,255,0.06)" />
                <text x={chartL} y={chartT - 8} fill="#555" fontSize="9" fontFamily="sans-serif">Energy Breakdown (kJ/m per station)</text>

                {energyData.map((e, i) => {
                  const x = chartL + i * barW;
                  const m = barW * 0.15;
                  const bendH = (e.bendEnergy / maxE) * chartH;
                  const fricH = (e.frictionEnergy / maxE) * chartH;
                  const redH = (e.redundantEnergy / maxE) * chartH;
                  return (
                    <g key={i}>
                      <rect x={x + m} y={chartB - bendH} width={barW - m * 2} height={bendH} fill="rgba(59,130,246,0.7)" />
                      <rect x={x + m} y={chartB - bendH - fricH} width={barW - m * 2} height={fricH} fill="rgba(249,115,22,0.7)" />
                      <rect x={x + m} y={chartB - bendH - fricH - redH} width={barW - m * 2} height={redH} fill="rgba(168,85,247,0.7)" />
                      <text x={x + barW / 2} y={chartB + 12} fill="#555" fontSize="8" fontFamily="sans-serif" textAnchor="middle">{e.station}</text>
                    </g>
                  );
                })}

                <text x={chartL - 4} y={chartT + 8} fill="#555" fontSize="8" fontFamily="sans-serif" textAnchor="end">{maxE.toFixed(3)} kJ/m</text>
                <text x={chartL - 4} y={chartB} fill="#555" fontSize="8" fontFamily="sans-serif" textAnchor="end">0</text>

                {[
                  { color: "rgba(59,130,246,0.7)", label: "Bending" },
                  { color: "rgba(249,115,22,0.7)", label: "Friction" },
                  { color: "rgba(168,85,247,0.7)", label: "Redundant" },
                ].map((item, i) => (
                  <g key={i}>
                    <rect x={chartL + i * 100} y={chartB + 22} width={10} height={10} fill={item.color} />
                    <text x={chartL + i * 100 + 14} y={chartB + 30} fill="#888" fontSize="9" fontFamily="sans-serif">{item.label}</text>
                  </g>
                ))}

                <rect x={chartL} y={chart2T} width={chartW} height={chart2H} fill="none" stroke="rgba(255,255,255,0.06)" />
                <text x={chartL} y={chart2T - 8} fill="#555" fontSize="9" fontFamily="sans-serif">Forming Force (kN) &amp; Cumulative Energy (kJ/m)</text>

                <polyline points={forceLine} fill="none" stroke="#ef4444" strokeWidth="2" />
                {energyData.map((e, i) => {
                  const x = chartL + (i / Math.max(energyData.length - 1, 1)) * chartW;
                  const y = chart2T + chart2H - (e.formingForce / maxForce) * chart2H;
                  return <circle key={`fp${i}`} cx={x} cy={y} r={3} fill="#ef4444" />;
                })}

                <polyline points={cumLine} fill="none" stroke="#22c55e" strokeWidth="2" />

                {[
                  { color: "#ef4444", label: `Force (max ${peakForce.toFixed(1)} kN)` },
                  { color: "#22c55e", label: `Cumulative (${totalEnergy.toFixed(3)} kJ/m)` },
                ].map((item, i) => (
                  <g key={i}>
                    <rect x={chartL + i * 180} y={chart2B + 12} width={10} height={2} fill={item.color} />
                    <text x={chartL + i * 180 + 14} y={chart2B + 16} fill="#888" fontSize="9" fontFamily="sans-serif">{item.label}</text>
                  </g>
                ))}
              </>
            )}
          </svg>
        </div>

        <div className="w-56 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-3 overflow-y-auto">
          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Parameters</div>
            <div className="space-y-2">
              <div>
                <label className="text-[9px] text-zinc-500">Line Speed (m/min)</label>
                <input type="number" value={lineSpeed} onChange={e => setLineSpeed(parseInt(e.target.value) || 1)} min={1} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300 mt-0.5" />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500">Friction Coefficient (μ)</label>
                <input type="number" value={friction} onChange={e => setFriction(parseFloat(e.target.value) || 0.1)} step={0.01} min={0.01} max={0.5} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300 mt-0.5" />
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Summary</div>
            <div className="space-y-1.5">
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[8px] text-zinc-600 mb-0.5">Total Strain Energy</div>
                <div className="text-sm font-bold text-orange-300">{totalEnergy.toFixed(4)} kJ/m</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[8px] text-zinc-600 mb-0.5">Peak Forming Force</div>
                <div className="text-sm font-bold text-red-300">{peakForce.toFixed(1)} kN</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[8px] text-zinc-600 mb-0.5">Peak Roll Torque</div>
                <div className="text-sm font-bold text-purple-300">{peakTorque.toFixed(2)} Nm</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-2">
                <div className="text-[8px] text-zinc-600 mb-0.5">Motor Power Required</div>
                <div className="text-sm font-bold text-blue-300">{powerReq.toFixed(3)} kW</div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">Per Station</div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {energyData.map(e => {
                const pct = totalEnergy > 0 ? (e.totalEnergy / totalEnergy) * 100 : 0;
                return (
                  <div key={e.station} className="flex items-center gap-1.5 text-[9px] px-2 py-1 bg-white/[0.02] rounded">
                    <span className="text-zinc-500 w-8">St {e.station}</span>
                    <div className="flex-1 bg-white/[0.04] rounded-full h-1.5">
                      <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
                    </div>
                    <span className="text-zinc-400 w-16 text-right font-mono">{e.totalEnergy.toFixed(4)}</span>
                    <span className="text-zinc-600 w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5">
              <TrendingUp className="w-3 h-3 inline mr-1" />Machine Sizing
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2 space-y-0.5 text-[9px]">
              <div className="flex justify-between"><span className="text-zinc-500">Min Motor</span><span className="text-zinc-300">{(powerReq * 1.5).toFixed(1)} kW</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Gearbox Ratio</span><span className="text-zinc-300">1:{Math.max(Math.round(30 / lineSpeed * 10), 5)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Frame Load</span><span className="text-zinc-300">{(peakForce * 2.5).toFixed(0)} kN</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Safety Factor</span><span className="text-zinc-300">2.5×</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
