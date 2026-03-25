import React, { useState, useMemo, useEffect } from "react";
import { Zap, Activity, RotateCcw, Info, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { useCncStore } from "../../store/useCncStore";

const MATERIAL_YIELD: Record<string, number> = {
  GI: 280, CR: 340, HR: 250, SS: 520, AL: 270, MS: 250,  // FIX: CR 310→340
  CU: 200, TI: 880, PP: 280, HSLA: 550,  // FIX: PP 30→280 (pre-painted steel, not polypropylene)
};
const MATERIAL_K: Record<string, number> = {
  GI: 1.8, CR: 2.0, HR: 1.6, SS: 2.5, AL: 1.5, MS: 1.7,
  CU: 1.4, TI: 2.8, PP: 1.8, HSLA: 2.3,  // FIX: PP machine load factor 0.8→1.8 (PP=Pre-Painted Steel ≈ GI, not polypropylene plastic)
};

interface Inputs {
  thickness: number;
  stripWidth: number;
  numStands: number;
  lineSpeed: number;
  kFactor: number;
  rpm: number;
  yieldStrength: number;
  safetyFactor: number;
}

interface Results {
  perPassForce: number;
  totalForce: number;
  idealPower: number;
  recommendedPower: number;
  torque: number;
  bendingMoment: number | null;
}

function calcResults(inputs: Inputs): Results {
  const { thickness, stripWidth, numStands, lineSpeed, kFactor, rpm, yieldStrength, safetyFactor } = inputs;

  const t = thickness;
  const w = stripWidth;
  const n = numStands;
  const v = lineSpeed;
  const k = kFactor;

  const perPassForce = k * w * t * t;
  const totalForce = perPassForce * n;
  const idealPower = (totalForce * v) / 60000;
  const recommendedPower = idealPower * safetyFactor;
  const torque = rpm > 0 ? (9550 * recommendedPower) / rpm : 0;

  const bendingMoment = yieldStrength > 0
    ? (yieldStrength * t * t * w) / 6
    : null;

  return { perPassForce, totalForce, idealPower, recommendedPower, torque, bendingMoment };
}

const FACTOR_TABLE = [
  {
    variable: "Material Thickness (t)",
    effect: "Quadratic — force scales with t²",
    direction: "up",
    detail: "Doubling thickness multiplies force ×4",
    unit: "mm",
  },
  {
    variable: "Strip Width (W)",
    effect: "Linear — force scales directly with W",
    direction: "up",
    detail: "Doubling width doubles force",
    unit: "mm",
  },
  {
    variable: "Material Hardness / k",
    effect: "Linear — higher k → proportionally higher force",
    direction: "up",
    detail: "Soft materials k≈1.5, high-strength steel k≈2.5",
    unit: "—",
  },
  {
    variable: "Line Speed (v)",
    effect: "Linear — power scales directly with speed",
    direction: "up",
    detail: "Affects power but not forming force",
    unit: "m/min",
  },
  {
    variable: "Number of Stands",
    effect: "Linear — total force = per-pass force × stands",
    direction: "up",
    detail: "More stands → higher cumulative machine load",
    unit: "—",
  },
  {
    variable: "RPM",
    effect: "Inverse — higher RPM → lower required torque",
    direction: "down",
    detail: "T = 9550 × P ÷ RPM",
    unit: "rpm",
  },
];

function ResultCard({
  label,
  value,
  unit,
  formula,
  color,
}: {
  label: string;
  value: number | null;
  unit: string;
  formula: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-3.5 space-y-1 ${color}`}>
      <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-2xl font-black font-mono">
        {value !== null ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
        <span className="text-sm font-medium ml-1 opacity-60">{unit}</span>
      </div>
      <div className="text-[10px] opacity-50 font-mono">{formula}</div>
    </div>
  );
}

function SectionToggle({
  label,
  expanded,
  onToggle,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <span>{label}</span>
      {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

export function LoadCalculator() {
  const {
    materialThickness, materialType, lineSpeed: storeLineSpeed,
    motorRPM, numStations, geometry, rollTooling, rollDiameter,
  } = useCncStore();

  const storeStripWidth = useMemo(() => {
    if (geometry?.segments?.length) {
      return geometry.segments.reduce((s, seg) =>
        s + Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY), 0);
    }
    return 200;
  }, [geometry]);

  const [inputs, setInputs] = useState<Inputs>({
    thickness: 1.5,
    stripWidth: 200,
    numStands: 8,
    lineSpeed: 20,
    kFactor: 2.0,
    rpm: 42,
    yieldStrength: 0,
    safetyFactor: 2.5,
  });
  const [storeLinked, setStoreLinked] = useState(false);
  const [showTable, setShowTable] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setInputs(prev => ({
      ...prev,
      thickness: materialThickness || prev.thickness,
      stripWidth: storeStripWidth > 0 ? storeStripWidth : prev.stripWidth,
      numStands: numStations > 0 ? numStations : prev.numStands,
      lineSpeed: storeLineSpeed > 0 ? storeLineSpeed : prev.lineSpeed,
      rpm: motorRPM > 0 ? motorRPM : prev.rpm,
      kFactor: MATERIAL_K[materialType] ?? prev.kFactor,
      yieldStrength: MATERIAL_YIELD[materialType] ?? prev.yieldStrength,
    }));
    setStoreLinked(true);
  }, [materialThickness, materialType, storeLineSpeed, motorRPM, numStations, storeStripWidth]);

  const results = useMemo(() => calcResults(inputs), [inputs]);

  const set = (field: keyof Inputs, val: number) =>
    setInputs((prev) => ({ ...prev, [field]: val }));

  const inputCls =
    "w-full bg-[#0E0E1C] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-blue-500/60 transition-colors";

  const labelCls = "text-[10px] font-semibold text-zinc-500 uppercase tracking-wide block mb-1";

  return (
    <div className="flex-1 overflow-y-auto bg-[#070710] text-zinc-100">
      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-900/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">Load, Power & Torque Calculator</h1>
              {storeLinked && (
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399", fontWeight: 700 }}>
                  <Link2 style={{ width: 8, height: 8, display: "inline", marginRight: 3 }} />
                  Roll Tooling Connected — {materialType} {materialThickness}mm · {numStations} stations
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              Compute bending force, motor power, and shaft torque for roll forming machine drive system sizing.
            </p>
          </div>
        </div>

        {/* ── Two-column layout: Inputs | Outputs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* INPUT PANEL */}
          <div className="bg-[#0B0B18] border border-white/[0.06] rounded-2xl p-5 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Machine Inputs
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Material Thickness (mm)</label>
                <input
                  type="number" step={0.1} min={0.1} max={12}
                  value={inputs.thickness}
                  onChange={(e) => set("thickness", parseFloat(e.target.value) || 0.1)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Strip Width (mm)</label>
                <input
                  type="number" step={1} min={1}
                  value={inputs.stripWidth}
                  onChange={(e) => set("stripWidth", parseFloat(e.target.value) || 1)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Number of Stands</label>
                <input
                  type="number" step={1} min={1} max={50}
                  value={inputs.numStands}
                  onChange={(e) => set("numStands", parseInt(e.target.value) || 1)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Line Speed (m/min)</label>
                <input
                  type="number" step={1} min={1}
                  value={inputs.lineSpeed}
                  onChange={(e) => set("lineSpeed", parseFloat(e.target.value) || 1)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Material Constant k
                  <span className="ml-1 text-zinc-600 normal-case font-normal">(1.5–2.5)</span>
                </label>
                <input
                  type="number" step={0.1} min={1.5} max={2.5}
                  value={inputs.kFactor}
                  onChange={(e) => set("kFactor", parseFloat(e.target.value) || 1.5)}
                  className={inputCls}
                />
                <div className="text-[10px] text-zinc-600 mt-1">
                  Soft: 1.5 · Mid: 2.0 · HighSt: 2.5
                </div>
              </div>
              <div>
                <label className={labelCls}>Shaft RPM</label>
                <input
                  type="number" step={10} min={1}
                  value={inputs.rpm}
                  onChange={(e) => set("rpm", parseFloat(e.target.value) || 1)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Safety Factor
                  <span className="ml-1 text-zinc-600 normal-case font-normal">(2–3×)</span>
                </label>
                <div className="flex gap-1">
                  {[1.5, 2.0, 2.5, 3.0].map((sf) => (
                    <button
                      key={sf}
                      onClick={() => set("safetyFactor", sf)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        inputs.safetyFactor === sf
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                      }`}
                    >
                      {sf}×
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">
                  1.5× minimum · 2× light · 2.5× standard · 3× heavy
                </div>
              </div>
            </div>

            {/* Advanced toggle */}
            <div className="border-t border-white/[0.06] pt-4">
              <SectionToggle
                label="Advanced — Yield Strength (optional)"
                expanded={showAdvanced}
                onToggle={() => setShowAdvanced((v) => !v)}
              />
              {showAdvanced && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className={labelCls}>Yield Strength σ (MPa)</label>
                    <input
                      type="number" step={10} min={0}
                      placeholder="0 = skip bending moment"
                      value={inputs.yieldStrength || ""}
                      onChange={(e) => set("yieldStrength", parseFloat(e.target.value) || 0)}
                      className={inputCls}
                    />
                    <div className="text-[10px] text-zinc-600 mt-1">
                      GI ≈ 280 · CR ≈ 340 · HR ≈ 250 · SS ≈ 520 · AL ≈ 270 MPa
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* OUTPUT PANEL */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Computed Results
            </div>

            <ResultCard
              label="Per-Pass Bending Force"
              value={results.perPassForce}
              unit="N"
              formula="F = k × W × t²"
              color="bg-blue-950/60 border-blue-500/20 text-blue-100"
            />
            <ResultCard
              label="Total Machine Force"
              value={results.totalForce}
              unit="N"
              formula="F_total = F × num_stands"
              color="bg-indigo-950/60 border-indigo-500/20 text-indigo-100"
            />

            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label="Ideal Power"
                value={results.idealPower}
                unit="kW"
                formula="P = (F_total × v) ÷ 60 000"
                color="bg-emerald-950/60 border-emerald-500/20 text-emerald-100"
              />
              <ResultCard
                label="Recommended Motor"
                value={results.recommendedPower}
                unit="kW"
                formula={`P_rec = P × ${inputs.safetyFactor}× safety`}
                color="bg-amber-950/60 border-amber-500/20 text-amber-100"
              />
            </div>

            <ResultCard
              label="Shaft Torque"
              value={results.torque}
              unit="Nm"
              formula="T = (9550 × P_rec) ÷ RPM"
              color="bg-orange-950/60 border-orange-500/20 text-orange-100"
            />

            {inputs.yieldStrength > 0 && (
              <ResultCard
                label="Bending Moment"
                value={results.bendingMoment}
                unit="N·mm"
                formula="M = (σ × t² × W) ÷ 6"
                color="bg-purple-950/60 border-purple-500/20 text-purple-100"
              />
            )}

            {/* Quick summary */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 text-[11px] text-zinc-500 space-y-1">
              <div className="flex justify-between">
                <span>Safety factor applied:</span>
                <span className="text-amber-400 font-semibold">{inputs.safetyFactor}×</span>
              </div>
              <div className="flex justify-between">
                <span>Force per stand:</span>
                <span className="text-zinc-300 font-mono">
                  {results.perPassForce.toLocaleString(undefined, { maximumFractionDigits: 1 })} N
                </span>
              </div>
              <div className="flex justify-between">
                <span>Power density:</span>
                <span className="text-zinc-300 font-mono">
                  {inputs.numStands > 0
                    ? (results.recommendedPower / inputs.numStands).toFixed(2)
                    : "—"} kW / stand
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Factor Insight Table ── */}
        <div className="bg-[#0B0B18] border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <SectionToggle
            label="Factor Insight Table — how each input affects load"
            expanded={showTable}
            onToggle={() => setShowTable((v) => !v)}
          />

          {showTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    <th className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                      Input Variable
                    </th>
                    <th className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                      Effect on Load / Power
                    </th>
                    <th className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                      Direction
                    </th>
                    <th className="text-left py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FACTOR_TABLE.map((row) => (
                    <tr key={row.variable} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 pr-4 text-zinc-200 font-medium whitespace-nowrap">
                        {row.variable}
                        <span className="ml-1.5 text-zinc-600 font-normal text-[10px]">({row.unit})</span>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-400">{row.effect}</td>
                      <td className="py-2.5 pr-4">
                        {row.direction === "up" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400">
                            ▲ Increases
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            ▼ Decreases
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-zinc-600 text-[11px]">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Formula Reference ── */}
        <div className="bg-[#0B0B18] border border-white/[0.06] rounded-2xl p-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-4">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            Formula Reference
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            {[
              {
                name: "Per-Pass Bending Force",
                formula: "F = k × W × t²",
                vars: "k = material constant (1.5–2.5), W = strip width (mm), t = thickness (mm)",
              },
              {
                name: "Total Machine Force",
                formula: "F_total = F × N",
                vars: "N = number of forming stands",
              },
              {
                name: "Ideal Power",
                formula: "P = (F_total × v) ÷ 60 000",
                vars: "F_total = total machine force across all stands (N), v = line speed (m/min), result in kW",
              },
              {
                name: "Recommended Motor Power",
                formula: "P_rec = P × SF",
                vars: "SF = safety factor (2× light / 2.5× standard / 3× heavy duty) — covers friction, acceleration, and drive losses",
              },
              {
                name: "Shaft Torque",
                formula: "T = (9550 × P_rec) ÷ RPM",
                vars: "T in Nm, P_rec in kW, RPM = shaft speed",
              },
              {
                name: "Bending Moment (Advanced)",
                formula: "M = (σ × t² × W) ÷ 6",
                vars: "σ = yield strength (MPa), result in N·mm",
              },
            ].map((f) => (
              <div
                key={f.name}
                className="rounded-xl bg-white/[0.025] border border-white/[0.06] p-3.5 space-y-1.5"
              >
                <div className="text-zinc-300 font-semibold text-[11px]">{f.name}</div>
                <code className="block text-blue-300 font-mono text-sm bg-blue-950/30 rounded px-2 py-1">
                  {f.formula}
                </code>
                <div className="text-zinc-600 text-[10px] leading-relaxed">{f.vars}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
