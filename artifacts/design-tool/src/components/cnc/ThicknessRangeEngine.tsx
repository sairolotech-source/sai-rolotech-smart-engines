import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { AlertTriangle, CheckCircle2, XCircle, Info, Layers, Wrench } from "lucide-react";

interface ThicknessResult {
  rollGapMin: number;
  rollGapMax: number;
  rollGapNominal: number;
  ratio: number;
  shimThickness: number;
  passLineAdjust: number;
  status: "green" | "yellow" | "red";
  statusMsg: string;
  overloadRisk: string;
  spacerNote: string;
  recommendation: string;
}

const MATERIAL_THRESHOLDS: Record<string, { safeRatio: number; warnRatio: number; minRadius: number }> = {
  GI:   { safeRatio: 1.20, warnRatio: 1.35, minRadius: 1.0 },
  CR:   { safeRatio: 1.20, warnRatio: 1.35, minRadius: 1.0 },
  HR:   { safeRatio: 1.25, warnRatio: 1.40, minRadius: 1.5 },
  SS:   { safeRatio: 1.15, warnRatio: 1.25, minRadius: 1.5 },
  AL:   { safeRatio: 1.25, warnRatio: 1.40, minRadius: 0.8 },
  MS:   { safeRatio: 1.20, warnRatio: 1.35, minRadius: 1.0 },
  CU:   { safeRatio: 1.20, warnRatio: 1.35, minRadius: 0.5 },
  TI:   { safeRatio: 1.12, warnRatio: 1.20, minRadius: 2.0 },
  PP:   { safeRatio: 1.20, warnRatio: 1.35, minRadius: 1.0 },
  HSLA: { safeRatio: 1.15, warnRatio: 1.28, minRadius: 1.5 },
};

function calcThickness(
  minT: number,
  nomT: number,
  maxT: number,
  material: string
): ThicknessResult {
  const thresh = MATERIAL_THRESHOLDS[material] ?? MATERIAL_THRESHOLDS["GI"]!;
  const ratio = maxT / Math.max(minT, 0.01);
  const shimThickness = parseFloat((maxT - minT).toFixed(3));
  const rollGapNominal = nomT * 1.02;
  const rollGapMin = minT * 1.01;
  const rollGapMax = maxT * 1.03;
  const passLineAdjust = parseFloat(((maxT - nomT) / 2).toFixed(3));

  let status: ThicknessResult["status"];
  let statusMsg: string;
  let overloadRisk: string;
  let spacerNote: string;
  let recommendation: string;

  if (ratio <= thresh.safeRatio) {
    status = "green";
    statusMsg = "Same tooling usable — thickness range within safe limits";
    overloadRisk = "Low — no overload expected";
    spacerNote = shimThickness > 0
      ? `Add ${shimThickness.toFixed(2)}mm shim under bottom shaft bearing for max thickness setting`
      : "No shimming required";
    recommendation = `Roll gap: Set to ${rollGapNominal.toFixed(3)}mm for nominal. Fine-tune per batch. No tooling change needed.`;
  } else if (ratio <= thresh.warnRatio) {
    status = "yellow";
    statusMsg = "Review required — thickness range borderline for same tooling";
    overloadRisk = "Medium — monitor top roll pressure carefully";
    spacerNote = `Shim ${shimThickness.toFixed(2)}mm needed. Use precision shim plates — DIN 2093 tolerance ±0.01mm. Check bearing load.`;
    recommendation = `Separate setup for min and max thickness recommended. Adjust roll gap by ${passLineAdjust.toFixed(3)}mm between runs.`;
  } else {
    status = "red";
    statusMsg = "DANGER — Different tooling required for this thickness range";
    overloadRisk = "HIGH — tooling overload / underload risk. Machine damage possible";
    spacerNote = `${shimThickness.toFixed(2)}mm difference too large. Separate tooling sets mandatory.`;
    recommendation = `Split into two setups: one for ${minT}–${nomT}mm, one for ${nomT}–${maxT}mm. Do NOT run full range on same tooling.`;
  }

  return {
    rollGapMin, rollGapMax, rollGapNominal,
    ratio, shimThickness, passLineAdjust,
    status, statusMsg, overloadRisk, spacerNote, recommendation,
  };
}

export function ThicknessRangeEngine() {
  const { materialType, materialThickness } = useCncStore();

  const [minT, setMinT] = useState(parseFloat((materialThickness * 0.9).toFixed(2)));
  const [nomT, setNomT] = useState(materialThickness);
  const [maxT, setMaxT] = useState(parseFloat((materialThickness * 1.1).toFixed(2)));

  const result = useMemo(() => {
    if (minT <= 0 || nomT <= 0 || maxT <= 0) return null;
    if (minT > nomT || nomT > maxT) return null;
    return calcThickness(minT, nomT, maxT, materialType);
  }, [minT, nomT, maxT, materialType]);

  const statusColors = {
    green:  { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400", icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> },
    yellow: { bg: "bg-amber-500/10",   border: "border-amber-500/40",   text: "text-amber-400",   icon: <AlertTriangle className="w-5 h-5 text-amber-400" /> },
    red:    { bg: "bg-red-500/10",      border: "border-red-500/40",     text: "text-red-400",     icon: <XCircle className="w-5 h-5 text-red-400" /> },
  };

  const sc = result ? statusColors[result.status] : null;

  const handleNomChange = (v: number) => {
    setNomT(v);
    if (v < minT) setMinT(parseFloat((v * 0.9).toFixed(2)));
    if (v > maxT) setMaxT(parseFloat((v * 1.1).toFixed(2)));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1117] text-white p-4 gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <Layers className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Thickness Range Engine</h2>
          <p className="text-xs text-gray-400">Min / Nominal / Max — roll gap & tooling compatibility analysis</p>
        </div>
        <div className="ml-auto px-3 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-xs text-blue-300 font-mono">
          {materialType}
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Thickness Inputs (mm)</div>

        {[
          { label: "Minimum Thickness", value: minT, set: setMinT, color: "text-blue-300", min: 0.1, max: nomT },
          { label: "Nominal Thickness", value: nomT, set: handleNomChange, color: "text-emerald-300", min: minT, max: maxT },
          { label: "Maximum Thickness", value: maxT, set: setMaxT, color: "text-amber-300", min: nomT, max: 10 },
        ].map(({ label, value, set, color, min, max }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="w-40 text-sm text-gray-300 flex-shrink-0">{label}</div>
            <input
              type="range"
              min={min} max={max} step={0.01}
              value={value}
              onChange={e => set(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <input
              type="number"
              min={min} max={max} step={0.01}
              value={value}
              onChange={e => set(parseFloat(e.target.value) || value)}
              className={`w-20 bg-white/10 border border-white/15 rounded-lg px-2 py-1 text-sm font-mono text-right ${color}`}
            />
            <span className="text-xs text-gray-500 w-6">mm</span>
          </div>
        ))}

        {minT > nomT || nomT > maxT ? (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Invalid range: min ≤ nominal ≤ max required
          </div>
        ) : null}
      </div>

      {/* Status Banner */}
      {result && sc && (
        <div className={`rounded-xl border ${sc.border} ${sc.bg} p-4`}>
          <div className="flex items-center gap-3">
            {sc.icon}
            <div>
              <div className={`font-semibold ${sc.text}`}>{result.statusMsg}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Thickness ratio: {result.ratio.toFixed(3)}× (max/min) — Material: {materialType}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {result && (
        <div className="grid grid-cols-2 gap-3">

          {/* Roll Gap Range */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 col-span-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Roll Gap Range (DIN EN 10162)
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Gap @ Min Thickness", value: result.rollGapMin, color: "text-blue-300" },
                { label: "Gap @ Nominal", value: result.rollGapNominal, color: "text-emerald-300" },
                { label: "Gap @ Max Thickness", value: result.rollGapMax, color: "text-amber-300" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className={`text-2xl font-bold font-mono ${color}`}>{value.toFixed(3)}</div>
                  <div className="text-xs text-gray-400 mt-1">mm</div>
                  <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Total gap adjustment range:</span>
                <span className="font-mono text-white">{(result.rollGapMax - result.rollGapMin).toFixed(3)} mm</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
                <span>Pass line compensation (±):</span>
                <span className="font-mono text-amber-300">±{result.passLineAdjust.toFixed(3)} mm</span>
              </div>
            </div>
          </div>

          {/* Shim / Spacer */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-purple-400" />
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shim / Spacer</div>
            </div>
            <div className="text-3xl font-bold font-mono text-purple-300">
              {result.shimThickness.toFixed(2)} <span className="text-base text-gray-400">mm</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">{result.spacerNote}</div>
          </div>

          {/* Overload Risk */}
          <div className={`rounded-xl border p-4 ${
            result.status === "green"  ? "border-emerald-500/30 bg-emerald-500/5" :
            result.status === "yellow" ? "border-amber-500/30 bg-amber-500/5" :
                                         "border-red-500/30 bg-red-500/5"
          }`}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Overload Risk</div>
            <div className={`text-sm font-medium ${
              result.status === "green" ? "text-emerald-300" :
              result.status === "yellow" ? "text-amber-300" : "text-red-300"
            }`}>
              {result.overloadRisk}
            </div>
          </div>

          {/* Recommendation */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 col-span-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-1">Engineering Recommendation</div>
                <div className="text-sm text-gray-300">{result.recommendation}</div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* DIN Reference */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">Standards Reference: </span>
        DIN EN 10162 (tolerance roll formed sections) · DIN 6935 (cold bending) · Material thresholds per ASTM A240/A653/A792
      </div>

    </div>
  );
}
