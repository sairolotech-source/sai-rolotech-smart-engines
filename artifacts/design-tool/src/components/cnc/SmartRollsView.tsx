import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Wand2, Wrench, ArrowRight, Check, AlertTriangle, Copy, RefreshCw,
  Layers, ChevronDown, ChevronRight, Download, Settings, Zap, Move
} from "lucide-react";

interface RollDesign {
  station: number;
  upperProfile: { x: number; y: number }[];
  lowerProfile: { x: number; y: number }[];
  upperDia: number;
  lowerDia: number;
  shaftDia: number;
  bore: number;
  keyway: { width: number; depth: number };
  material: string;
  hardness: string;
  weight: number;
  width: number;
}

function autoGenerateRolls(
  profileWidth: number,
  thickness: number,
  totalStations: number,
  rollMaterial: string
): RollDesign[] {
  const rolls: RollDesign[] = [];
  const t = thickness || 1.2;
  const pw = profileWidth || 200;

  for (let i = 1; i <= totalStations; i++) {
    const progress = i / totalStations;
    const formAngle = progress * 90;

    const upperPts: { x: number; y: number }[] = [];
    const lowerPts: { x: number; y: number }[] = [];
    const halfW = pw / 2;
    const numPts = 20;

    for (let j = 0; j <= numPts; j++) {
      const frac = j / numPts;
      const x = -halfW + frac * pw;
      const bendDepth = Math.sin(formAngle * Math.PI / 180) * Math.abs(Math.sin(frac * Math.PI * 2)) * (pw / 8);
      upperPts.push({ x, y: -bendDepth });
      lowerPts.push({ x, y: -bendDepth - t });
    }

    const upperDia = 200 + (i % 2 === 0 ? 20 : 0);
    const lowerDia = upperDia - 10;
    const shaftDia = upperDia > 200 ? 60 : 50;
    const bore = shaftDia;
    const rollWidth = pw * 0.7 + 20;
    const volume = Math.PI * ((upperDia / 2) ** 2 - (bore / 2) ** 2) * rollWidth / 1e6;
    const density = rollMaterial === "EN8" ? 7.85 : rollMaterial === "D2" ? 7.7 : 7.85;
    const weight = volume * density;

    rolls.push({
      station: i,
      upperProfile: upperPts,
      lowerProfile: lowerPts,
      upperDia,
      lowerDia,
      shaftDia,
      bore,
      keyway: { width: shaftDia > 50 ? 16 : 12, depth: shaftDia > 50 ? 6 : 5 },
      material: rollMaterial,
      hardness: rollMaterial === "D2" ? "58-62 HRC" : rollMaterial === "EN8" ? "28-32 HRC" : "55-60 HRC",
      weight: Math.round(weight * 10) / 10,
      width: Math.round(rollWidth),
    });
  }

  return rolls;
}

export function SmartRollsView() {
  const { stations, geometry } = useCncStore();
  const [totalStations, setTotalStations] = useState(stations?.length || 12);
  const [profileWidth, setProfileWidth] = useState(() => {
    if (geometry?.boundingBox) return Math.round(geometry.boundingBox.maxX - geometry.boundingBox.minX);
    return 200;
  });
  const [thickness, setThickness] = useState(1.2);
  const [rollMaterial, setRollMaterial] = useState("D2");
  const [selectedStation, setSelectedStation] = useState(1);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneFrom, setCloneFrom] = useState(1);
  const [cloneTo, setCloneTo] = useState(2);

  const rolls = useMemo(() =>
    autoGenerateRolls(profileWidth, thickness, totalStations, rollMaterial),
    [profileWidth, thickness, totalStations, rollMaterial]
  );

  const selectedRoll = rolls.find(r => r.station === selectedStation) || rolls[0];

  const totalWeight = rolls.reduce((a, r) => a + r.weight * 2, 0);
  const totalRolls = rolls.length * 2;

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-purple-500/5 to-transparent">
        <Wand2 className="w-5 h-5 text-purple-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis SmartRolls</div>
          <div className="text-[10px] text-zinc-500">Automatic Roll Design from Profile Cross-Section — Minimal Mouse Clicks</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowCloneDialog(!showCloneDialog)}
            className="text-[9px] flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20">
            <Copy className="w-3 h-3" /> Clone Roll
          </button>
          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
            {totalRolls} Rolls | {totalWeight.toFixed(1)} kg
          </span>
        </div>
      </div>

      {showCloneDialog && (
        <div className="px-4 py-2 border-b border-white/[0.06] bg-purple-500/5 flex items-center gap-3">
          <span className="text-[10px] text-zinc-400">Clone from Station</span>
          <input type="number" value={cloneFrom} onChange={e => setCloneFrom(parseInt(e.target.value) || 1)}
            min={1} max={totalStations}
            className="w-16 bg-black/30 border border-white/[0.08] rounded px-2 py-0.5 text-[11px] text-zinc-200" />
          <ArrowRight className="w-3 h-3 text-zinc-500" />
          <span className="text-[10px] text-zinc-400">to Station</span>
          <input type="number" value={cloneTo} onChange={e => setCloneTo(parseInt(e.target.value) || 2)}
            min={1} max={totalStations}
            className="w-16 bg-black/30 border border-white/[0.08] rounded px-2 py-0.5 text-[11px] text-zinc-200" />
          <button onClick={() => setShowCloneDialog(false)}
            className="text-[9px] px-2 py-1 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30">
            <Check className="w-3 h-3 inline mr-1" />Apply Clone
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-3 border-r border-white/[0.06]">
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-zinc-400">Input Parameters</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-24">Profile Width</span>
              <input type="number" value={profileWidth} onChange={e => setProfileWidth(parseFloat(e.target.value) || 200)}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              <span className="text-[9px] text-zinc-600">mm</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-24">Thickness</span>
              <input type="number" value={thickness} onChange={e => setThickness(parseFloat(e.target.value) || 1)}
                step={0.1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              <span className="text-[9px] text-zinc-600">mm</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-24">Stations</span>
              <input type="number" value={totalStations} onChange={e => setTotalStations(parseInt(e.target.value) || 8)}
                min={4} max={30}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-24">Roll Material</span>
              <select value={rollMaterial} onChange={e => setRollMaterial(e.target.value)}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200">
                <option value="D2">D2 Tool Steel</option>
                <option value="EN8">EN8 Steel</option>
                <option value="SKD11">SKD11</option>
                <option value="SUJ2">SUJ2 Bearing Steel</option>
              </select>
            </div>
          </div>

          <div className="text-[10px] font-bold text-zinc-400 mt-3">Station Browser</div>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {rolls.map(r => (
              <button key={r.station} onClick={() => setSelectedStation(r.station)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${
                  selectedStation === r.station ? "bg-purple-500/20 border border-purple-500/30" : "hover:bg-white/[0.03] border border-transparent"
                }`}>
                <span className="text-[9px] font-mono text-zinc-500 w-5 text-right">{r.station}</span>
                <Wrench className="w-3 h-3 text-purple-400" />
                <div className="flex-1">
                  <div className="text-[10px] text-zinc-300">Station {r.station}</div>
                  <div className="text-[8px] text-zinc-600">Ø{r.upperDia} / Ø{r.lowerDia} | {r.weight}kg</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-purple-400" />
            Station {selectedRoll?.station} — Auto-Generated Roll Design
          </div>

          {selectedRoll && (
            <>
              <div className="mb-4 bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4">
                <svg viewBox={`${-profileWidth * 0.6} -80 ${profileWidth * 1.2} 160`} className="w-full h-40">
                  <line x1={-profileWidth * 0.6} y1={0} x2={profileWidth * 0.6} y2={0} stroke="#333" strokeWidth={0.3} strokeDasharray="3,3" />
                  <path d={selectedRoll.upperProfile.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                    fill="none" stroke="#a855f7" strokeWidth={1.5} />
                  <path d={selectedRoll.lowerProfile.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
                    fill="none" stroke="#60a5fa" strokeWidth={1.5} />
                  <text x={0} y={60} textAnchor="middle" fill="#666" fontSize={8}>
                    Station {selectedRoll.station} | Upper (purple) & Lower (blue) Roll Contour
                  </text>
                  <text x={-profileWidth * 0.55} y={-60} fill="#a855f7" fontSize={7}>Ø{selectedRoll.upperDia}</text>
                  <text x={-profileWidth * 0.55} y={-48} fill="#60a5fa" fontSize={7}>Ø{selectedRoll.lowerDia}</text>
                </svg>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="text-[10px] font-bold text-purple-400 mb-2">Upper Roll</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                    <span className="text-zinc-500">Outer Ø</span><span className="text-zinc-300">{selectedRoll.upperDia} mm</span>
                    <span className="text-zinc-500">Bore Ø</span><span className="text-zinc-300">{selectedRoll.bore} mm</span>
                    <span className="text-zinc-500">Width</span><span className="text-zinc-300">{selectedRoll.width} mm</span>
                    <span className="text-zinc-500">Weight</span><span className="text-amber-300">{selectedRoll.weight} kg</span>
                    <span className="text-zinc-500">Keyway</span><span className="text-zinc-300">{selectedRoll.keyway.width}×{selectedRoll.keyway.depth}</span>
                    <span className="text-zinc-500">Material</span><span className="text-zinc-300">{selectedRoll.material}</span>
                    <span className="text-zinc-500">Hardness</span><span className="text-green-300">{selectedRoll.hardness}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="text-[10px] font-bold text-blue-400 mb-2">Lower Roll</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                    <span className="text-zinc-500">Outer Ø</span><span className="text-zinc-300">{selectedRoll.lowerDia} mm</span>
                    <span className="text-zinc-500">Bore Ø</span><span className="text-zinc-300">{selectedRoll.bore} mm</span>
                    <span className="text-zinc-500">Width</span><span className="text-zinc-300">{selectedRoll.width} mm</span>
                    <span className="text-zinc-500">Weight</span><span className="text-amber-300">{selectedRoll.weight} kg</span>
                    <span className="text-zinc-500">Shaft Ø</span><span className="text-zinc-300">{selectedRoll.shaftDia} mm</span>
                    <span className="text-zinc-500">Material</span><span className="text-zinc-300">{selectedRoll.material}</span>
                    <span className="text-zinc-500">Hardness</span><span className="text-green-300">{selectedRoll.hardness}</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-bold text-zinc-400 mb-2">All Stations Overview</div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {["Stn", "Upper Ø", "Lower Ø", "Bore", "Width", "Material", "Hardness", "Weight"].map(h => (
                      <th key={h} className="px-2 py-1 text-left text-zinc-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rolls.map(r => (
                    <tr key={r.station}
                      onClick={() => setSelectedStation(r.station)}
                      className={`border-b border-white/[0.04] cursor-pointer ${selectedStation === r.station ? "bg-purple-500/10" : "hover:bg-white/[0.02]"}`}>
                      <td className="px-2 py-1 font-mono text-zinc-500">{r.station}</td>
                      <td className="px-2 py-1 text-purple-300">{r.upperDia}mm</td>
                      <td className="px-2 py-1 text-blue-300">{r.lowerDia}mm</td>
                      <td className="px-2 py-1 text-zinc-300">{r.bore}mm</td>
                      <td className="px-2 py-1 text-zinc-300">{r.width}mm</td>
                      <td className="px-2 py-1 text-zinc-300">{r.material}</td>
                      <td className="px-2 py-1 text-green-300">{r.hardness}</td>
                      <td className="px-2 py-1 text-amber-300">{r.weight}kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 grid grid-cols-4 gap-3">
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Total Rolls</div>
                  <div className="text-sm font-bold text-purple-400">{totalRolls}</div>
                </div>
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Total Weight</div>
                  <div className="text-sm font-bold text-amber-400">{totalWeight.toFixed(1)} kg</div>
                </div>
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Stations</div>
                  <div className="text-sm font-bold text-green-400">{totalStations}</div>
                </div>
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Roll Material</div>
                  <div className="text-sm font-bold text-zinc-300">{rollMaterial}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
