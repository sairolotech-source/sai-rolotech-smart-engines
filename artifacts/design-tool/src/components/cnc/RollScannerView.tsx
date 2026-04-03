import React, { useState, useMemo } from "react";
import {
  ScanLine, Check, X, AlertTriangle, Download, RefreshCw,
  ChevronDown, Target, BarChart3, Wrench, Layers
} from "lucide-react";

interface RollScanResult {
  angle: number;
  nominalR: number;
  measuredR: number;
  deviation: number;
  wear: number;
  withinSpec: boolean;
}

interface ScanComparison {
  rollId: string;
  station: number;
  outerDia: number;
  bore: number;
  width: number;
  contourPoints: RollScanResult[];
  maxWear: number;
  avgWear: number;
  regrindAllowance: number;
  regrindPossible: boolean;
  totalScans: number;
  operatingHours: number;
}

function generateRollScan(
  station: number,
  outerDia: number,
  bore: number,
  width: number,
  operatingHours: number,
  wearFactor: number
): ScanComparison {
  const points: RollScanResult[] = [];
  const numPoints = 72;
  const R = outerDia / 2;

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 360;
    const angleRad = angle * Math.PI / 180;

    const profileVariation = Math.sin(angleRad * 4) * 2;
    const nomR = R + profileVariation;

    const wearBase = operatingHours * wearFactor * 0.001;
    const wearVariation = Math.sin(angleRad * 2 + 1.5) * wearBase * 0.5 + wearBase;
    const wear = Math.max(0, wearVariation);
    const measR = nomR - wear;

    const deviation = measR - nomR;
    const withinSpec = Math.abs(deviation) < 0.05;

    points.push({
      angle: Math.round(angle),
      nominalR: Math.round(nomR * 1000) / 1000,
      measuredR: Math.round(measR * 1000) / 1000,
      deviation: Math.round(deviation * 1000) / 1000,
      wear: Math.round(wear * 1000) / 1000,
      withinSpec,
    });
  }

  const wears = points.map(p => p.wear);
  const maxWear = Math.max(...wears);
  const avgWear = wears.reduce((a, w) => a + w, 0) / wears.length;
  const regrindAllowance = 2.0;
  const regrindPossible = maxWear < regrindAllowance;

  return {
    rollId: `R-${station.toString().padStart(2, "0")}-U`,
    station,
    outerDia,
    bore,
    width,
    contourPoints: points,
    maxWear: Math.round(maxWear * 1000) / 1000,
    avgWear: Math.round(avgWear * 1000) / 1000,
    regrindAllowance,
    regrindPossible,
    totalScans: Math.floor(operatingHours / 200) + 1,
    operatingHours,
  };
}

export function RollScannerView() {
  const [numStations, setNumStations] = useState(12);
  const [outerDia, setOuterDia] = useState(200);
  const [bore, setBore] = useState(50);
  const [rollWidth, setRollWidth] = useState(140);
  const [operatingHours, setOperatingHours] = useState(500);
  const [wearFactor, setWearFactor] = useState(1.0);
  const [selectedStation, setSelectedStation] = useState(1);

  const scans = useMemo(() => {
    const results: ScanComparison[] = [];
    for (let i = 1; i <= numStations; i++) {
      const dia = outerDia + (i % 2 === 0 ? 20 : 0);
      const hours = operatingHours * (1 + Math.random() * 0.3 - 0.15);
      results.push(generateRollScan(i, dia, bore, rollWidth, hours, wearFactor));
    }
    return results;
  }, [numStations, outerDia, bore, rollWidth, operatingHours, wearFactor]);

  const selectedScan = scans.find(s => s.station === selectedStation);
  const regrindCount = scans.filter(s => !s.regrindPossible).length;

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-sky-500/5 to-transparent">
        <ScanLine className="w-5 h-5 text-sky-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RollScanner</div>
          <div className="text-[10px] text-zinc-500">Automatic Roll Tool Contour Inspection & Wear Tracking</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {regrindCount > 0 ? (
            <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {regrindCount} Need Replacement
            </span>
          ) : (
            <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> All Regrindable
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[260px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Scan Parameters</div>
          {[
            { label: "Stations", value: numStations, set: setNumStations, unit: "" },
            { label: "Roll OD", value: outerDia, set: setOuterDia, unit: "mm" },
            { label: "Bore", value: bore, set: setBore, unit: "mm" },
            { label: "Width", value: rollWidth, set: setRollWidth, unit: "mm" },
            { label: "Op. Hours", value: operatingHours, set: setOperatingHours, unit: "hr" },
            { label: "Wear Factor", value: wearFactor, set: setWearFactor, unit: "" },
          ].map(({ label, value, set, unit }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={value}
                onChange={e => set(parseFloat(e.target.value) || 0)}
                step={label === "Wear Factor" ? 0.1 : 1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              {unit && <span className="text-[9px] text-zinc-600 w-6">{unit}</span>}
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-3">Roll Inventory</div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {scans.map(s => (
              <button key={s.station} onClick={() => setSelectedStation(s.station)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${
                  selectedStation === s.station ? "bg-sky-500/20 border border-sky-500/30" : "hover:bg-white/[0.03] border border-transparent"}`}>
                {s.regrindPossible ? <Check className="w-3 h-3 text-green-400" /> : <AlertTriangle className="w-3 h-3 text-red-400" />}
                <div className="flex-1">
                  <div className="text-[10px] text-zinc-300">{s.rollId}</div>
                  <div className="text-[8px] text-zinc-600">Wear: {s.maxWear}mm | {s.operatingHours.toFixed(0)}hr</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedScan && (
            <>
              <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-sky-400" />
                {selectedScan.rollId} — Contour Comparison
                {selectedScan.regrindPossible
                  ? <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 ml-2">Regrindable</span>
                  : <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 ml-2">Replace</span>}
              </div>

              <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4 mb-4">
                <svg viewBox="-120 -120 240 240" className="w-full h-56 mx-auto max-w-[400px]">
                  <circle cx={0} cy={0} r={3} fill="#444" />
                  {[20, 40, 60, 80, 100].map(r => (
                    <circle key={r} cx={0} cy={0} r={r} fill="none" stroke="#222" strokeWidth={0.3} />
                  ))}

                  <path d={selectedScan.contourPoints.map((p, i) => {
                    const r = (p.nominalR / (selectedScan.outerDia / 2)) * 90;
                    const a = (p.angle - 90) * Math.PI / 180;
                    return `${i === 0 ? "M" : "L"} ${r * Math.cos(a)} ${r * Math.sin(a)}`;
                  }).join(" ") + " Z"}
                    fill="none" stroke="#3b82f6" strokeWidth={1} opacity={0.5} />

                  <path d={selectedScan.contourPoints.map((p, i) => {
                    const r = (p.measuredR / (selectedScan.outerDia / 2)) * 90;
                    const a = (p.angle - 90) * Math.PI / 180;
                    return `${i === 0 ? "M" : "L"} ${r * Math.cos(a)} ${r * Math.sin(a)}`;
                  }).join(" ") + " Z"}
                    fill="none" stroke="#0ea5e9" strokeWidth={1.5} />

                  {selectedScan.contourPoints.filter(p => !p.withinSpec).map((p, i) => {
                    const r = (p.measuredR / (selectedScan.outerDia / 2)) * 90;
                    const a = (p.angle - 90) * Math.PI / 180;
                    return <circle key={i} cx={r * Math.cos(a)} cy={r * Math.sin(a)} r={2} fill="#ef4444" />;
                  })}

                  <text x={-110} y={-105} fill="#3b82f6" fontSize={7}>Nominal</text>
                  <text x={-110} y={-95} fill="#0ea5e9" fontSize={7}>Measured</text>
                  <text x={-110} y={-85} fill="#ef4444" fontSize={7}>Out of spec</text>
                </svg>
              </div>

              <div className="grid grid-cols-5 gap-2 mb-4">
                {[
                  { label: "Max Wear", value: `${selectedScan.maxWear}mm`, color: selectedScan.maxWear > 0.1 ? "text-red-400" : "text-green-400" },
                  { label: "Avg Wear", value: `${selectedScan.avgWear}mm`, color: "text-sky-400" },
                  { label: "Regrind Left", value: `${(selectedScan.regrindAllowance - selectedScan.maxWear).toFixed(3)}mm`, color: "text-amber-400" },
                  { label: "Op. Hours", value: `${selectedScan.operatingHours.toFixed(0)}h`, color: "text-zinc-300" },
                  { label: "Scans Done", value: `${selectedScan.totalScans}`, color: "text-zinc-300" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                    <div className="text-[8px] text-zinc-500">{label}</div>
                    <div className={`text-sm font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="text-[11px] font-bold text-zinc-400 mb-2">All Rolls — Wear Comparison</div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {["Roll ID", "OD", "Max Wear", "Avg Wear", "Regrind Left", "Hours", "Status"].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scans.map(s => (
                    <tr key={s.station}
                      onClick={() => setSelectedStation(s.station)}
                      className={`border-b border-white/[0.04] cursor-pointer ${selectedStation === s.station ? "bg-sky-500/10" : "hover:bg-white/[0.02]"}`}>
                      <td className="px-2 py-1 text-zinc-300">{s.rollId}</td>
                      <td className="px-2 py-1 text-zinc-300">{s.outerDia}mm</td>
                      <td className={`px-2 py-1 ${s.maxWear > 0.1 ? "text-red-300" : "text-green-300"}`}>{s.maxWear}mm</td>
                      <td className="px-2 py-1 text-zinc-300">{s.avgWear}mm</td>
                      <td className="px-2 py-1 text-amber-300">{(s.regrindAllowance - s.maxWear).toFixed(3)}mm</td>
                      <td className="px-2 py-1 text-zinc-400">{s.operatingHours.toFixed(0)}h</td>
                      <td className="px-2 py-1">
                        {s.regrindPossible
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">OK</span>
                          : <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Replace</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
