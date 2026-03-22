import React, { useState, useMemo } from "react";
import {
  Box, ArrowRight, Settings, Check, AlertTriangle,
  ChevronDown, Layers, BarChart3, Circle
} from "lucide-react";

interface CageSpec {
  tubeDia: number;
  wallThickness: number;
  cageLength: number;
  numCageRolls: number;
  finPassCount: number;
  sizingCount: number;
  material: string;
  yieldStrength: number;
  stripWidth: number;
  lineSpeed: number;
}

interface CageStation {
  station: number;
  type: "breakdown" | "cage" | "fin-pass" | "sizing" | "weld";
  angle: number;
  rollDia: number;
  gap: number;
  force: number;
  description: string;
}

function calcCageStations(spec: CageSpec): CageStation[] {
  const { tubeDia, wallThickness, numCageRolls, finPassCount, sizingCount, yieldStrength } = spec;
  const t = wallThickness;
  const stations: CageStation[] = [];
  let stationNum = 1;

  const breakdownCount = 4;
  for (let i = 1; i <= breakdownCount; i++) {
    const progress = i / breakdownCount;
    stations.push({
      station: stationNum++,
      type: "breakdown",
      angle: Math.round(progress * 60 * 10) / 10,
      rollDia: 250,
      gap: t + 0.2,
      force: Math.round(yieldStrength * t * t / 4 * progress),
      description: `Breakdown #${i} — Edge forming ${Math.round(progress * 60)}°`,
    });
  }

  for (let i = 1; i <= numCageRolls; i++) {
    const progress = i / numCageRolls;
    const angle = 60 + progress * 100;
    stations.push({
      station: stationNum++,
      type: "cage",
      angle: Math.round(angle * 10) / 10,
      rollDia: 120,
      gap: t + 0.1,
      force: Math.round(yieldStrength * t * t / 6 * (0.5 + 0.5 * progress)),
      description: `Cage Roll #${i} — Linear cage forming ${Math.round(angle)}°`,
    });
  }

  for (let i = 1; i <= finPassCount; i++) {
    const progress = i / finPassCount;
    stations.push({
      station: stationNum++,
      type: "fin-pass",
      angle: Math.round((160 + progress * 18) * 10) / 10,
      rollDia: 300,
      gap: t + 0.05,
      force: Math.round(yieldStrength * t * t / 3 * (0.7 + 0.3 * progress)),
      description: `Fin Pass #${i} — Edge closing & alignment`,
    });
  }

  stations.push({
    station: stationNum++,
    type: "weld",
    angle: 180,
    rollDia: 280,
    gap: 0,
    force: 0,
    description: "Weld Station — HF/TIG/Laser weld",
  });

  for (let i = 1; i <= sizingCount; i++) {
    stations.push({
      station: stationNum++,
      type: "sizing",
      angle: 180,
      rollDia: 300,
      gap: t,
      force: Math.round(yieldStrength * t * tubeDia * 0.02),
      description: `Sizing #${i} — Final diameter calibration`,
    });
  }

  return stations;
}

export function CageFormingView() {
  const [spec, setSpec] = useState<CageSpec>({
    tubeDia: 48.3,
    wallThickness: 2.0,
    cageLength: 2000,
    numCageRolls: 6,
    finPassCount: 3,
    sizingCount: 3,
    material: "CR Steel",
    yieldStrength: 280,
    stripWidth: 149.5,
    lineSpeed: 30,
  });

  const stations = useMemo(() => calcCageStations(spec), [spec]);
  const totalForce = stations.reduce((a, s) => a + s.force, 0);
  const stripCalc = Math.PI * (spec.tubeDia - spec.wallThickness);

  const updateSpec = (key: keyof CageSpec, val: any) => setSpec(prev => ({ ...prev, [key]: val }));

  const typeColor = (t: string) =>
    t === "breakdown" ? "bg-blue-500/10 text-blue-400" :
    t === "cage" ? "bg-purple-500/10 text-purple-400" :
    t === "fin-pass" ? "bg-amber-500/10 text-amber-400" :
    t === "weld" ? "bg-red-500/10 text-red-400" :
    "bg-green-500/10 text-green-400";

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-violet-500/5 to-transparent">
        <Box className="w-5 h-5 text-violet-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF CageForming</div>
          <div className="text-[10px] text-zinc-500">Linear Cage Forming — Compact Tube Mill Configuration</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400">
            {stations.length} Stations
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
            Strip: {stripCalc.toFixed(1)}mm
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Tube Specification</div>
          {[
            { label: "Tube OD", key: "tubeDia", unit: "mm" },
            { label: "Wall Thick.", key: "wallThickness", unit: "mm" },
            { label: "Cage Length", key: "cageLength", unit: "mm" },
            { label: "Yield (σy)", key: "yieldStrength", unit: "MPa" },
            { label: "Line Speed", key: "lineSpeed", unit: "m/min" },
          ].map(({ label, key, unit }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={(spec as any)[key]}
                onChange={e => updateSpec(key as any, parseFloat(e.target.value) || 0)}
                step={key === "wallThickness" ? 0.1 : 1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              <span className="text-[9px] text-zinc-600 w-10">{unit}</span>
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-3">Station Configuration</div>
          {[
            { label: "Cage Rolls", key: "numCageRolls" },
            { label: "Fin Passes", key: "finPassCount" },
            { label: "Sizing Stands", key: "sizingCount" },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={(spec as any)[key]}
                onChange={e => updateSpec(key as any, parseInt(e.target.value) || 1)}
                min={1} max={12}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
            </div>
          ))}

          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1 mt-3">
            <div className="text-[10px] font-bold text-zinc-400">Process Summary</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-zinc-500">Strip Width</span><span className="text-blue-300 text-right">{stripCalc.toFixed(1)} mm</span>
              <span className="text-zinc-500">Total Stations</span><span className="text-violet-300 text-right">{stations.length}</span>
              <span className="text-zinc-500">Total Force</span><span className="text-amber-300 text-right">{(totalForce / 1000).toFixed(1)} kN</span>
              <span className="text-zinc-500">D/t Ratio</span><span className="text-zinc-300 text-right">{(spec.tubeDia / spec.wallThickness).toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
            Cage Forming Line — Ø{spec.tubeDia} × {spec.wallThickness}t
          </div>

          <div className="mb-4 flex items-center gap-1 p-2 bg-[#0c0c1a] rounded-lg border border-white/[0.06] overflow-x-auto">
            {stations.map((s, i) => {
              const h = 30 + (s.angle / 180) * 50;
              const colors: Record<string, string> = {
                breakdown: "bg-blue-500",
                cage: "bg-purple-500",
                "fin-pass": "bg-amber-500",
                weld: "bg-red-500",
                sizing: "bg-green-500",
              };
              return (
                <div key={i} className="flex flex-col items-center min-w-[28px]">
                  <span className="text-[7px] text-zinc-600 mb-0.5">{s.angle}°</span>
                  <div className={`w-5 rounded-t ${colors[s.type]}`} style={{ height: h, opacity: 0.7 }} />
                  <span className="text-[7px] text-zinc-600 mt-0.5">{s.station}</span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mb-3 justify-center">
            {["breakdown", "cage", "fin-pass", "weld", "sizing"].map(t => (
              <div key={t} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-sm ${
                  t === "breakdown" ? "bg-blue-500" :
                  t === "cage" ? "bg-purple-500" :
                  t === "fin-pass" ? "bg-amber-500" :
                  t === "weld" ? "bg-red-500" : "bg-green-500"
                }`} />
                <span className="text-[8px] text-zinc-500 capitalize">{t.replace("-", " ")}</span>
              </div>
            ))}
          </div>

          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {["#", "Type", "Angle", "Roll Ø", "Gap", "Force", "Description"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stations.map(s => (
                <tr key={s.station} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-2 py-1 font-mono text-zinc-500">{s.station}</td>
                  <td className="px-2 py-1"><span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${typeColor(s.type)}`}>{s.type.replace("-", " ")}</span></td>
                  <td className="px-2 py-1 text-zinc-300 font-mono">{s.angle}°</td>
                  <td className="px-2 py-1 text-zinc-300">{s.rollDia}mm</td>
                  <td className="px-2 py-1 text-zinc-300">{s.gap}mm</td>
                  <td className="px-2 py-1 text-amber-300">{s.force}N</td>
                  <td className="px-2 py-1 text-zinc-400 text-[9px]">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { label: "Breakdown", count: stations.filter(s => s.type === "breakdown").length, color: "text-blue-400" },
              { label: "Cage Rolls", count: stations.filter(s => s.type === "cage").length, color: "text-purple-400" },
              { label: "Fin Passes", count: stations.filter(s => s.type === "fin-pass").length, color: "text-amber-400" },
              { label: "Sizing", count: stations.filter(s => s.type === "sizing").length, color: "text-green-400" },
            ].map(({ label, count, color }) => (
              <div key={label} className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                <div className="text-[9px] text-zinc-500">{label}</div>
                <div className={`text-sm font-bold ${color}`}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
