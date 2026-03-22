import React, { useState } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Gauge, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ToleranceRow {
  label: string;
  nominal: number;
  actual: number;
  tolerance: number;
  unit: string;
  inTolerance: boolean;
  deviation: number;
}

function getToleranceRows(
  st: ReturnType<typeof useCncStore.getState>["stations"][0],
  prevSt: ReturnType<typeof useCncStore.getState>["stations"][0] | null,
  rollData: ReturnType<typeof useCncStore.getState>["rollTooling"][0] | null,
  tolerance: number
): ToleranceRow[] {
  const rows: ToleranceRow[] = [];

  const totalAngleDeg = st.totalAngle * (180 / Math.PI);

  const springbackTotal = (st.springbackAngles ?? []).reduce((s, a) => s + Math.abs(a * (180 / Math.PI)), 0);
  const actualAngle = totalAngleDeg - springbackTotal;
  rows.push({
    label: "Total Bend Angle (after springback)",
    nominal: Math.round(totalAngleDeg * 100) / 100,
    actual: Math.round(actualAngle * 100) / 100,
    tolerance: tolerance * 10,
    unit: "°",
    inTolerance: springbackTotal <= tolerance * 10,
    deviation: Math.round(springbackTotal * 100) / 100,
  });

  if (prevSt && st.segmentLengths.length === prevSt.segmentLengths.length) {
    for (let i = 0; i < st.segmentLengths.length; i++) {
      const nominal = st.segmentLengths[i];
      const prevLen = prevSt.segmentLengths[i];
      const deviation = Math.abs(nominal - prevLen);
      rows.push({
        label: `Seg ${i + 1} Length (vs prev station)`,
        nominal: Math.round(nominal * 100) / 100,
        actual: Math.round(prevLen * 100) / 100,
        tolerance,
        unit: "mm",
        inTolerance: deviation <= tolerance,
        deviation: Math.round(deviation * 1000) / 1000,
      });
    }
  } else {
    for (let i = 0; i < st.segmentLengths.length; i++) {
      const nominal = st.segmentLengths[i];
      rows.push({
        label: `Segment ${i + 1} Length`,
        nominal: Math.round(nominal * 100) / 100,
        actual: Math.round(nominal * 100) / 100,
        tolerance,
        unit: "mm",
        inTolerance: true,
        deviation: 0,
      });
    }
  }

  for (let i = 0; i < st.bendAngles.length; i++) {
    const angleDeg = Math.abs(st.bendAngles[i] * (180 / Math.PI));
    const sbAngle = st.springbackAngles?.[i] ? Math.abs(st.springbackAngles[i] * (180 / Math.PI)) : 0;
    const actualBend = angleDeg - sbAngle;
    rows.push({
      label: `Bend ${i + 1} Angle`,
      nominal: Math.round(angleDeg * 100) / 100,
      actual: Math.round(actualBend * 100) / 100,
      tolerance: tolerance * 8,
      unit: "°",
      inTolerance: sbAngle <= tolerance * 8,
      deviation: Math.round(sbAngle * 100) / 100,
    });
  }

  if (rollData) {
    const rp = rollData.rollProfile;
    if (rp.rollDiameter > 0 && rp.shaftDiameter > 0) {
      const wallThickness = (rp.rollDiameter - rp.shaftDiameter) / 2;
      const minWall = 8;
      rows.push({
        label: "Roll Wall Thickness",
        nominal: minWall,
        actual: Math.round(wallThickness * 100) / 100,
        tolerance: tolerance * 20,
        unit: "mm",
        inTolerance: wallThickness >= minWall - tolerance * 20,
        deviation: Math.round(Math.max(0, minWall - wallThickness) * 100) / 100,
      });
    }
  }

  return rows;
}

export function StationToleranceChecker() {
  const { stations, rollTooling } = useCncStore();
  const [expanded, setExpanded] = useState(false);
  const [tolerance, setTolerance] = useState(0.05);
  const [selectedStation, setSelectedStation] = useState<number>(0);

  if (stations.length === 0) return null;

  const st = stations[selectedStation] ?? stations[0];
  const prevSt = selectedStation > 0 ? stations[selectedStation - 1] : null;
  const matchingRoll = rollTooling.find(rt => rt.stationNumber === st.stationNumber) ?? null;
  const rows = getToleranceRows(st, prevSt, matchingRoll, tolerance);
  const outOfTol = rows.filter(r => !r.inTolerance);
  const allPass = outOfTol.length === 0;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Gauge className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Station Tolerance Checker</span>
        <div className="ml-2 flex items-center gap-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${allPass ? "bg-emerald-900/30 text-emerald-300" : "bg-red-900/30 text-red-300"}`}>
            {outOfTol.length === 0 ? "All Pass" : `${outOfTol.length} OOT`}
          </span>
        </div>
        <span className="ml-auto">{expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">
          {/* Controls */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 block mb-1">Station</label>
              <select
                value={selectedStation}
                onChange={e => setSelectedStation(parseInt(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                {stations.map((st, idx) => (
                  <option key={idx} value={idx}>{st.label} (Station {st.stationNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Tolerance (mm)</label>
              <input
                type="number" min={0.01} max={1} step={0.01} value={tolerance}
                onChange={e => setTolerance(parseFloat(e.target.value) || 0.05)}
                className="w-24 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Station summary */}
          <div className={`flex items-center gap-2 p-2 rounded-lg border ${allPass ? "bg-emerald-950/20 border-emerald-500/20" : "bg-red-950/20 border-red-500/20"}`}>
            {allPass ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
            <span className="text-xs text-zinc-300">
              Station <span className="font-mono text-amber-300">{st.label}</span>
              {allPass
                ? " — All dimensions within ±" + tolerance + " mm tolerance"
                : ` — ${outOfTol.length} dimension(s) OUT OF TOLERANCE (±${tolerance} mm)`}
            </span>
          </div>

          {/* Tolerance Table */}
          <div className="overflow-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-700/60">
                  <th className="text-left py-1 pr-2 text-zinc-500 font-medium">Dimension</th>
                  <th className="text-right py-1 px-2 text-zinc-500 font-medium">Nominal</th>
                  <th className="text-right py-1 px-2 text-zinc-500 font-medium">Actual</th>
                  <th className="text-right py-1 px-2 text-zinc-500 font-medium">Deviation</th>
                  <th className="text-right py-1 pl-2 text-zinc-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-zinc-800/40 ${!row.inTolerance ? "bg-red-950/10" : ""}`}>
                    <td className="py-1 pr-2 text-zinc-400">{row.label}</td>
                    <td className="py-1 px-2 text-right font-mono text-zinc-300">{row.nominal}{row.unit}</td>
                    <td className="py-1 px-2 text-right font-mono text-zinc-200">{row.actual}{row.unit}</td>
                    <td className={`py-1 px-2 text-right font-mono ${!row.inTolerance ? "text-red-300 font-bold" : "text-zinc-500"}`}>
                      {row.deviation > 0 ? "+" : ""}{row.deviation}{row.unit}
                    </td>
                    <td className="py-1 pl-2 text-right">
                      {row.inTolerance
                        ? <span className="text-emerald-400">✓ OK</span>
                        : <span className="text-red-400 font-semibold">✗ OOT</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary of all stations */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {stations.map((s, idx) => {
              const sPrev = idx > 0 ? stations[idx - 1] : null;
              const sRoll = rollTooling.find(rt => rt.stationNumber === s.stationNumber) ?? null;
              const sRows = getToleranceRows(s, sPrev, sRoll, tolerance);
              const oot = sRows.filter(r => !r.inTolerance).length;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedStation(idx)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors
                    ${selectedStation === idx ? "ring-1 ring-amber-400/50" : ""}
                    ${oot > 0 ? "bg-red-900/30 text-red-300 border-red-500/20" : "bg-emerald-900/20 text-emerald-300 border-emerald-500/15"}`}
                >
                  {s.label} {oot > 0 ? `(${oot}✗)` : "✓"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
