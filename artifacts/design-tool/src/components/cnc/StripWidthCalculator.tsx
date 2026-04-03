import React, { useState, useCallback } from "react";
import { useCncStore, MATERIAL_DATABASE, type MaterialType } from "../../store/useCncStore";
import { Calculator, ChevronDown, ChevronRight, Info } from "lucide-react";

const MATERIAL_FULL_PROPS: Record<MaterialType, {
  name: string;
  tensile: string;
  yield: string;
  kFactor: number;
  springback: string;
  minRadius: string;
  density: string;
  notes: string;
}> = {
  // FIX: kFactor corrections (DIN 6935 roll forming values):
  // CR 0.42→0.44, HR 0.38→0.42, SS 0.40→0.50 (CRITICAL), TI 0.38→0.50 (CRITICAL), HSLA 0.40→0.45
  // GI/CR tensile and yield strings also updated to match deep-accuracy-engine.ts
  GI:   { name: "Galvanized Iron", tensile: "380 MPa", yield: "280 MPa", kFactor: 0.44, springback: "5%", minRadius: "1.0×t", density: "7.85 g/cm³", notes: "Zinc coating may flake at r/t < 1.0" },
  CR:   { name: "Cold Rolled Steel", tensile: "440 MPa", yield: "340 MPa", kFactor: 0.44, springback: "8%", minRadius: "0.5×t", density: "7.85 g/cm³", notes: "Excellent formability; low springback" },  // FIX: kf 0.42→0.44, yield 280→340
  HR:   { name: "Hot Rolled Steel", tensile: "420 MPa", yield: "250 MPa", kFactor: 0.42, springback: "12%", minRadius: "1.5×t", density: "7.85 g/cm³", notes: "Descale before forming; higher springback" },  // FIX: kf 0.38→0.42
  SS:   { name: "Stainless Steel 304", tensile: "720 MPa", yield: "310 MPa", kFactor: 0.50, springback: "20%", minRadius: "2.0×t", density: "7.93 g/cm³", notes: "CRITICAL: work hardening risk; flood coolant mandatory" },  // FIX: kf 0.40→0.50 (DIN 6935)
  AL:   { name: "Aluminium", tensile: "310 MPa", yield: "270 MPa", kFactor: 0.43, springback: "15%", minRadius: "1.0×t", density: "2.70 g/cm³", notes: "Low force but high springback; scratch risk. Typical grades: 3003, 5052" },
  MS:   { name: "Mild Steel", tensile: "410 MPa", yield: "250 MPa", kFactor: 0.44, springback: "6%", minRadius: "0.8×t", density: "7.85 g/cm³", notes: "Most predictable material for roll forming" },  // FIX: kf 0.42→0.44 (DIN 6935; 0.42 is HR's value)
  CU:   { name: "Copper", tensile: "300 MPa", yield: "200 MPa", kFactor: 0.44, springback: "8%", minRadius: "0.5×t", density: "8.96 g/cm³", notes: "Very soft, excellent formability. Surface scratch risk — polished rolls required" },  // FIX: tensile 280→300 MPa (C110 H02 half-hard)
  TI:   { name: "Titanium Ti-6Al-4V", tensile: "950 MPa", yield: "880 MPa", kFactor: 0.50, springback: "25%", minRadius: "3.0×t", density: "4.51 g/cm³", notes: "CRITICAL: very high springback, reactive. Slow speed, flood coolant, large radii" },  // FIX: kf 0.38→0.50
  PP:   { name: "Pre-Painted Steel", tensile: "370 MPa", yield: "280 MPa", kFactor: 0.44, springback: "6%", minRadius: "1.5×t", density: "7.85 g/cm³", notes: "Coating protection critical — no sharp edges, protective film during forming" },
  HSLA: { name: "High-Strength Low-Alloy", tensile: "650 MPa", yield: "550 MPa", kFactor: 0.45, springback: "14%", minRadius: "2.0×t", density: "7.85 g/cm³", notes: "High strength, significant springback. Calibration stands essential" },  // FIX: kf 0.40→0.45
};

interface BendEntry {
  id: number;
  angle: number;
  innerRadius: number;
  flangeLength: number;
}

export function StripWidthCalculator() {
  const { materialType, materialThickness, setMaterialType } = useCncStore();
  const [expanded, setExpanded] = useState(true);
  const [webWidth, setWebWidth] = useState(100);
  const [bends, setBends] = useState<BendEntry[]>([
    { id: 1, angle: 90, innerRadius: 1.5, flangeLength: 25 },
  ]);
  const [result, setResult] = useState<{
    totalStripWidth: number;
    webPart: number;
    bendAllowances: number[];
    ossbValues: number[];
    bdValues: number[];
    flangeTotal: number;
    notes: string[];
  } | null>(null);

  const t = materialThickness;
  const props = MATERIAL_FULL_PROPS[materialType];

  const addBend = () => {
    setBends(prev => [...prev, { id: Date.now(), angle: 90, innerRadius: 1.5, flangeLength: 25 }]);
  };

  const removeBend = (id: number) => {
    setBends(prev => prev.filter(b => b.id !== id));
  };

  const updateBend = (id: number, field: keyof BendEntry, value: number) => {
    setBends(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const calculate = useCallback(() => {
    const kFactor = props.kFactor;
    const notes: string[] = [];
    let bendAllowancesSum = 0;
    const bendAllowances: number[] = [];
    const ossbValues: number[] = [];
    const bdValues: number[] = [];
    let flangeTotal = 0;

    for (const bend of bends) {
      const r = bend.innerRadius;
      const tRatio = r / t;
      if (tRatio < parseFloat(props.minRadius.split("×")[0])) {
        notes.push(`Bend r=${r}mm: radius too tight (min r/t = ${props.minRadius}) for ${materialType}`);
      }
      const angleDeg = Math.abs(bend.angle);
      const angleRad = angleDeg * (Math.PI / 180);
      // BA = θ × (R + K × T)  — Standard K-factor formula (DIN 6935 / SME)
      const ba = angleRad * (r + kFactor * t);
      // OSSB = tan(θ/2) × (R + T)  — Outside Set-Back
      const ossb = Math.tan((angleDeg / 2) * Math.PI / 180) * (r + t);
      // BD = 2 × OSSB − BA  — Bend Deduction
      const bd = 2 * ossb - ba;
      bendAllowances.push(Math.round(ba * 1000) / 1000);
      ossbValues.push(Math.round(ossb * 1000) / 1000);
      bdValues.push(Math.round(bd * 1000) / 1000);
      bendAllowancesSum += ba;
      flangeTotal += bend.flangeLength;
    }

    const totalStripWidth = webWidth + bendAllowancesSum + flangeTotal;

    const springbackPct = parseFloat(props.springback);
    notes.push(`K-Factor: ${kFactor} (${materialType} standard per SME/DIN 6935)`);
    notes.push(`Springback: +${springbackPct}% → add calibration station overbend`);
    if (materialType === "SS") notes.push("SS: Add 3–5% extra width — work hardening stretch risk");
    if (materialType === "TI") notes.push("Ti: Min r/t ≥ 3.0 — brittle failure risk at tight radii");
    if (materialType === "HSLA") notes.push("HSLA: Use max thickness (+) of gauge range to avoid roll interference");

    setResult({
      totalStripWidth: Math.round(totalStripWidth * 100) / 100,
      webPart: webWidth,
      bendAllowances,
      ossbValues,
      bdValues,
      flangeTotal: Math.round(flangeTotal * 100) / 100,
      notes,
    });
  }, [bends, webWidth, materialType, materialThickness, props]);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Calculator className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Strip Width Calculator</span>
        <span className="ml-auto">{expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/[0.06]">

          {/* Material Properties Auto-Fill */}
          <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
            <div className="flex items-center gap-1.5 mb-2">
              <Info className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">Material Properties — {materialType}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              {[
                ["Name", props.name],
                ["Tensile Strength", props.tensile],
                ["Yield Strength", props.yield],
                ["K-Factor", props.kFactor.toString()],
                ["Springback", props.springback],
                ["Min Bend Radius", props.minRadius],
                ["Density", props.density],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b border-emerald-900/40 pb-0.5">
                  <span className="text-zinc-400">{label}</span>
                  <span className="text-emerald-300 font-mono">{val}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-amber-300/70 mt-1.5 italic">{props.notes}</p>
          </div>

          {/* Web Width */}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Web (flat) Width (mm)</label>
            <input
              type="number" min={0} step={0.5} value={webWidth}
              onChange={e => setWebWidth(parseFloat(e.target.value) || 0)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Bends */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Bends</span>
              <button
                onClick={addBend}
                className="text-[10px] px-2 py-0.5 bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 rounded transition-colors"
              >
                + Add Bend
              </button>
            </div>
            <div className="space-y-1.5">
              {bends.map((bend, idx) => (
                <div key={bend.id} className="p-2 rounded bg-zinc-900/60 border border-zinc-700/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 font-mono">Bend #{idx + 1}</span>
                    {bends.length > 1 && (
                      <button onClick={() => removeBend(bend.id)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="text-[9px] text-zinc-500">Angle (°)</label>
                      <input type="number" min={0} max={180} step={0.5} value={bend.angle}
                        onChange={e => updateBend(bend.id, "angle", parseFloat(e.target.value) || 0)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500">Inner r (mm)</label>
                      <input type="number" min={0.1} step={0.1} value={bend.innerRadius}
                        onChange={e => updateBend(bend.id, "innerRadius", parseFloat(e.target.value) || 0.1)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500">Flange (mm)</label>
                      <input type="number" min={0} step={0.5} value={bend.flangeLength}
                        onChange={e => updateBend(bend.id, "flangeLength", parseFloat(e.target.value) || 0)}
                        className="w-full bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={calculate}
            className="w-full py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Calculate Strip Width
          </button>

          {result && (
            <div className="p-2.5 rounded-lg bg-blue-950/20 border border-blue-500/20 space-y-1.5">
              <div className="text-center">
                <div className="text-xs text-zinc-400 mb-0.5">Total Blank Strip Width</div>
                <div className="text-2xl font-black text-blue-300 font-mono">{result.totalStripWidth} mm</div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div className="text-center p-1.5 rounded bg-zinc-800/60">
                  <div className="text-zinc-500">Web</div>
                  <div className="text-zinc-200 font-mono">{result.webPart} mm</div>
                </div>
                <div className="text-center p-1.5 rounded bg-zinc-800/60">
                  <div className="text-zinc-500">Bend Allow.</div>
                  <div className="text-emerald-300 font-mono">{result.bendAllowances.reduce((a, b) => a + b, 0).toFixed(3)} mm</div>
                </div>
                <div className="text-center p-1.5 rounded bg-zinc-800/60">
                  <div className="text-zinc-500">Flanges</div>
                  <div className="text-zinc-200 font-mono">{result.flangeTotal} mm</div>
                </div>
              </div>
              {result.bendAllowances.length >= 1 && (
                <div className="space-y-0.5 mt-1">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Per-Bend Detail (BA / OSSB / BD)</div>
                  {result.bendAllowances.map((ba, i) => (
                    <div key={i} className="flex justify-between text-[10px] bg-zinc-900/40 rounded px-1.5 py-0.5">
                      <span className="text-zinc-500">Bend {i + 1}</span>
                      <span className="text-emerald-300 font-mono">BA {ba.toFixed(3)}</span>
                      <span className="text-blue-300 font-mono">OSSB {result.ossbValues[i]?.toFixed(3)}</span>
                      <span className="text-rose-300 font-mono">BD {result.bdValues[i]?.toFixed(3)}</span>
                    </div>
                  ))}
                  <div className="text-[9px] text-zinc-600 italic mt-1">BA = θ×(R+K×T) | OSSB = tan(θ/2)×(R+T) | BD = 2×OSSB−BA</div>
                </div>
              )}
              {result.notes.map((n, i) => (
                <div key={i} className={`text-[10px] ${n.includes("CRITICAL") || n.includes("too tight") ? "text-red-400" : "text-amber-300/70"} italic`}>
                  {n.includes("CRITICAL") || n.includes("too tight") ? "⚠ " : "ℹ "}{n}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
