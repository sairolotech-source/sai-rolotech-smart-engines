import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  ScanLine, Check, AlertTriangle, X, Camera, Download,
  ChevronDown, Target, BarChart3, Layers
} from "lucide-react";

interface ScanPoint {
  x: number;
  y: number;
  deviation: number;
  withinTol: boolean;
}

interface ScanResult {
  station: number;
  points: ScanPoint[];
  maxDeviation: number;
  avgDeviation: number;
  pass: boolean;
  cpk: number;
}

function generateScanData(
  profileWidth: number,
  profileHeight: number,
  numStations: number,
  tolerance: number
): ScanResult[] {
  const results: ScanResult[] = [];

  for (let s = 1; s <= numStations; s++) {
    const points: ScanPoint[] = [];
    const numPoints = 50;
    const progress = s / numStations;

    for (let i = 0; i < numPoints; i++) {
      const frac = i / (numPoints - 1);
      const x = -profileWidth / 2 + frac * profileWidth;
      const bendZone = Math.abs(Math.sin(frac * Math.PI * 4));

      const baseY = Math.sin(frac * Math.PI) * profileHeight * progress;
      const noise = (Math.random() - 0.5) * 2;
      const systematicError = bendZone * 0.3 * (1 - progress * 0.5);
      const deviation = noise * 0.1 + systematicError * 0.2;

      const y = baseY + deviation;
      const withinTol = Math.abs(deviation) <= tolerance;

      points.push({
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        deviation: Math.round(deviation * 1000) / 1000,
        withinTol,
      });
    }

    const deviations = points.map(p => Math.abs(p.deviation));
    const maxDev = Math.max(...deviations);
    const avgDev = deviations.reduce((a, d) => a + d, 0) / deviations.length;
    const stdDev = Math.sqrt(deviations.reduce((a, d) => a + (d - avgDev) ** 2, 0) / deviations.length);
    const cpk = stdDev > 0 ? (tolerance - avgDev) / (3 * stdDev) : 99;

    results.push({
      station: s,
      points,
      maxDeviation: Math.round(maxDev * 1000) / 1000,
      avgDeviation: Math.round(avgDev * 1000) / 1000,
      pass: maxDev <= tolerance,
      cpk: Math.round(cpk * 100) / 100,
    });
  }

  return results;
}

export function ProfileScanView() {
  const { stations, geometry } = useCncStore();
  const [profileWidth, setProfileWidth] = useState(() => {
    if (geometry?.boundingBox) return Math.round(geometry.boundingBox.maxX - geometry.boundingBox.minX);
    return 200;
  });
  const [profileHeight, setProfileHeight] = useState(40);
  const [numStations, setNumStations] = useState(stations?.length || 12);
  const [tolerance, setTolerance] = useState(0.3);
  const [selectedStation, setSelectedStation] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const scanResults = useMemo(() =>
    generateScanData(profileWidth, profileHeight, numStations, tolerance),
    [profileWidth, profileHeight, numStations, tolerance, refreshKey]
  );

  const selectedResult = scanResults.find(r => r.station === selectedStation);
  const passCount = scanResults.filter(r => r.pass).length;
  const avgCpk = scanResults.reduce((a, r) => a + r.cpk, 0) / scanResults.length;

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-teal-500/5 to-transparent">
        <ScanLine className="w-5 h-5 text-teal-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis ProfileScan Desktop</div>
          <div className="text-[10px] text-zinc-500">Contactless Cross-Section Measurement & Quality Control</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setRefreshKey(k => k + 1)}
            className="text-[9px] flex items-center gap-1 px-2 py-1 rounded bg-teal-500/10 border border-teal-500/20 text-teal-300 hover:bg-teal-500/20">
            <Camera className="w-3 h-3" /> New Scan
          </button>
          <span className={`text-[9px] px-2 py-0.5 rounded border ${passCount === numStations
            ? "bg-green-500/10 border-green-500/20 text-green-400"
            : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
            {passCount}/{numStations} Pass
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[260px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Scan Parameters</div>
          {[
            { label: "Profile Width", value: profileWidth, set: setProfileWidth, unit: "mm" },
            { label: "Profile Height", value: profileHeight, set: setProfileHeight, unit: "mm" },
            { label: "Stations", value: numStations, set: setNumStations, unit: "" },
            { label: "Tolerance ±", value: tolerance, set: setTolerance, unit: "mm" },
          ].map(({ label, value, set, unit }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={value} onChange={e => set(parseFloat(e.target.value) || 0)}
                step={label === "Tolerance ±" ? 0.01 : 1}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              {unit && <span className="text-[9px] text-zinc-600 w-8">{unit}</span>}
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-3">Station Results</div>
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {scanResults.map(r => (
              <button key={r.station} onClick={() => setSelectedStation(r.station)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left ${
                  selectedStation === r.station ? "bg-teal-500/20 border border-teal-500/30" : "hover:bg-white/[0.03] border border-transparent"}`}>
                {r.pass ? <Check className="w-3 h-3 text-green-400" /> : <X className="w-3 h-3 text-red-400" />}
                <div className="flex-1">
                  <div className="text-[10px] text-zinc-300">Station {r.station}</div>
                  <div className="text-[8px] text-zinc-600">Max: ±{r.maxDeviation}mm | Cpk: {r.cpk}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1 mt-2">
            <div className="text-[10px] font-bold text-zinc-400">Overall Quality</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-zinc-500">Pass Rate</span><span className={`text-right ${passCount === numStations ? "text-green-300" : "text-amber-300"}`}>{((passCount / numStations) * 100).toFixed(0)}%</span>
              <span className="text-zinc-500">Avg Cpk</span><span className={`text-right ${avgCpk > 1.33 ? "text-green-300" : avgCpk > 1 ? "text-amber-300" : "text-red-300"}`}>{avgCpk.toFixed(2)}</span>
              <span className="text-zinc-500">Tolerance</span><span className="text-zinc-300 text-right">±{tolerance}mm</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {selectedResult && (
            <>
              <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-teal-400" />
                Station {selectedResult.station} — Cross-Section Scan
                {selectedResult.pass
                  ? <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 ml-2">PASS</span>
                  : <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 ml-2">FAIL</span>}
              </div>

              <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4 mb-4">
                <svg viewBox={`${-profileWidth * 0.6} ${-profileHeight * 1.5} ${profileWidth * 1.2} ${profileHeight * 3.5}`}
                  className="w-full h-48">
                  <line x1={-profileWidth * 0.55} y1={0} x2={profileWidth * 0.55} y2={0} stroke="#333" strokeWidth={0.2} strokeDasharray="2,2" />
                  <line x1={-profileWidth * 0.55} y1={tolerance * 50} x2={profileWidth * 0.55} y2={tolerance * 50}
                    stroke="#22c55e" strokeWidth={0.3} strokeDasharray="3,3" opacity={0.5} />
                  <line x1={-profileWidth * 0.55} y1={-tolerance * 50} x2={profileWidth * 0.55} y2={-tolerance * 50}
                    stroke="#22c55e" strokeWidth={0.3} strokeDasharray="3,3" opacity={0.5} />

                  <path d={selectedResult.points.map((p, i) =>
                    `${i === 0 ? "M" : "L"} ${p.x} ${-p.y}`).join(" ")}
                    fill="none" stroke="#14b8a6" strokeWidth={1} />

                  {selectedResult.points.filter((_, i) => i % 5 === 0).map((p, i) => (
                    <circle key={i} cx={p.x} cy={-p.y} r={1.5}
                      fill={p.withinTol ? "#22c55e" : "#ef4444"} />
                  ))}

                  <text x={-profileWidth * 0.55} y={-profileHeight * 1.2} fill="#22c55e" fontSize={5} opacity={0.7}>
                    +{tolerance}mm tolerance
                  </text>
                </svg>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Max Deviation</div>
                  <div className={`text-sm font-bold ${selectedResult.pass ? "text-green-400" : "text-red-400"}`}>
                    ±{selectedResult.maxDeviation}mm
                  </div>
                </div>
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Avg Deviation</div>
                  <div className="text-sm font-bold text-teal-400">±{selectedResult.avgDeviation}mm</div>
                </div>
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Cpk</div>
                  <div className={`text-sm font-bold ${selectedResult.cpk > 1.33 ? "text-green-400" : selectedResult.cpk > 1 ? "text-amber-400" : "text-red-400"}`}>
                    {selectedResult.cpk}
                  </div>
                </div>
                <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
                  <div className="text-[9px] text-zinc-500">Scan Points</div>
                  <div className="text-sm font-bold text-zinc-300">{selectedResult.points.length}</div>
                </div>
              </div>

              <div className="text-[11px] font-bold text-zinc-400 mb-2">All Stations Summary</div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {["Stn", "Max Dev.", "Avg Dev.", "Cpk", "Points", "Status"].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scanResults.map(r => (
                    <tr key={r.station}
                      onClick={() => setSelectedStation(r.station)}
                      className={`border-b border-white/[0.04] cursor-pointer ${selectedStation === r.station ? "bg-teal-500/10" : "hover:bg-white/[0.02]"}`}>
                      <td className="px-2 py-1 font-mono text-zinc-500">{r.station}</td>
                      <td className="px-2 py-1 text-zinc-300">±{r.maxDeviation}mm</td>
                      <td className="px-2 py-1 text-zinc-300">±{r.avgDeviation}mm</td>
                      <td className={`px-2 py-1 ${r.cpk > 1.33 ? "text-green-300" : r.cpk > 1 ? "text-amber-300" : "text-red-300"}`}>{r.cpk}</td>
                      <td className="px-2 py-1 text-zinc-400">{r.points.length}</td>
                      <td className="px-2 py-1">
                        {r.pass
                          ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">PASS</span>
                          : <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">FAIL</span>}
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
