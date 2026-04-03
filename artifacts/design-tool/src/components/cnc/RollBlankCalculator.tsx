import React, { useState, useMemo, useCallback } from "react";
import {
  Calculator, Download, Info, ChevronDown, ChevronUp,
  RotateCcw, CheckCircle, AlertTriangle, Layers,
  Ruler, Box, Package, Zap, ClipboardList,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type MaterialGrade = "D2" | "H13" | "A2" | "S7" | "EN31" | "EN8" | "CAST_IRON" | "SS440C";
type MachiningProcess = "turn_only" | "turn_grind" | "turn_hardturn";
type ProfileComplexity = "simple" | "medium" | "complex" | "very_complex";
type RollPart = "upper" | "lower" | "custom";

interface RollEntry {
  id: string;
  name: string;
  part: RollPart;
  finalOD: number;
  faceWidth: number;
  shaftDia: number;
  shaftLen: number;
  profileHeight: number;
  material: MaterialGrade;
  machining: MachiningProcess;
  complexity: ProfileComplexity;
  qty: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STANDARD_OD_SIZES = [
  60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120,
  125, 130, 135, 140, 145, 150, 160, 170, 175, 180, 190,
  200, 210, 220, 230, 240, 250, 260, 275, 280, 300,
  320, 325, 350, 375, 400, 425, 450, 500,
];

const STANDARD_LENGTHS = [
  100, 120, 150, 175, 200, 225, 250, 275, 300, 325, 350,
  375, 400, 425, 450, 475, 500, 550, 600, 650, 700, 750,
  800, 850, 900, 950, 1000, 1100, 1200,
];

const MATERIAL_DB: Record<MaterialGrade, {
  name: string; density: number; ratePerKg: number;
  hardness: string; treatment: string; application: string; color: string;
}> = {
  D2: {
    name: "D2 Tool Steel",
    density: 7.85, ratePerKg: 350,
    hardness: "HRC 60-62 (after HT)",
    treatment: "Harden 1010°C → Air cool → Temper 180°C",
    application: "Standard GI / CR strip, high wear",
    color: "#60a5fa",
  },
  H13: {
    name: "H13 Hot Work Steel",
    density: 7.80, ratePerKg: 420,
    hardness: "HRC 44-50 (after HT)",
    treatment: "Harden 1020°C → Air cool → Temper 580°C",
    application: "SS / Titanium / HR steel, thermal shock",
    color: "#f97316",
  },
  A2: {
    name: "A2 Air Hardening Steel",
    density: 7.86, ratePerKg: 310,
    hardness: "HRC 57-62 (after HT)",
    treatment: "Harden 940°C → Air cool → Temper 175°C",
    application: "Aluminium / Low-carbon strip, less distortion",
    color: "#a78bfa",
  },
  S7: {
    name: "S7 Shock Resistant Steel",
    density: 7.87, ratePerKg: 380,
    hardness: "HRC 54-56 (after HT)",
    treatment: "Harden 940°C → Air cool → Temper 200°C",
    application: "Impact-prone profiles, heavy gauge",
    color: "#34d399",
  },
  EN31: {
    name: "EN31 Bearing Steel",
    density: 7.85, ratePerKg: 120,
    hardness: "HRC 58-62 (after HT)",
    treatment: "Harden 850°C → Oil quench → Temper 160°C",
    application: "Light-duty / prototype rolls, low cost",
    color: "#fbbf24",
  },
  EN8: {
    name: "EN8 Carbon Steel",
    density: 7.85, ratePerKg: 75,
    hardness: "HB 170-200 (normalized)",
    treatment: "Normalize 840°C → Air cool (no hardening)",
    application: "Spacers / flanges / non-critical parts",
    color: "#94a3b8",
  },
  CAST_IRON: {
    name: "Cast Iron FG300",
    density: 7.20, ratePerKg: 80,
    hardness: "HB 200-250 (as-cast)",
    treatment: "Stress relief anneal 550°C (optional)",
    application: "Prototype rolls, non-abrasive strip",
    color: "#6b7280",
  },
  SS440C: {
    name: "SS 440C (Stainless Tool)",
    density: 7.70, ratePerKg: 680,
    hardness: "HRC 58-60 (after HT)",
    treatment: "Harden 1010°C → Air cool → Cryo → Temper 150°C",
    application: "Corrosion-prone environment, food/pharma",
    color: "#e2e8f0",
  },
};

const MACHINING_DB: Record<MachiningProcess, {
  name: string; turnAllowance: number; finishAllowance: number;
  lengthAllowance: number; note: string;
}> = {
  turn_only: {
    name: "CNC Turning Only",
    turnAllowance: 8,
    finishAllowance: 0,
    lengthAllowance: 6,
    note: "Total on Ø: +8mm (4 per side). For standard rolls where grinding is not required.",
  },
  turn_grind: {
    name: "CNC Turning + OD Grinding",
    turnAllowance: 10,
    finishAllowance: 2,
    lengthAllowance: 8,
    note: "Total on Ø: +12mm. Grind to final size. Best surface finish Ra ≤0.8µm.",
  },
  turn_hardturn: {
    name: "CNC Turning + Hard Turning (CBN)",
    turnAllowance: 8,
    finishAllowance: 1,
    lengthAllowance: 6,
    note: "Total on Ø: +9mm. Hard turn after hardening. Ra ≤1.6µm.",
  },
};

const COMPLEXITY_DB: Record<ProfileComplexity, { name: string; sideMargin: number; note: string }> = {
  simple:       { name: "Simple (flat/mild bend)",    sideMargin: 3,  note: "Flat rolls, mild angles ≤30°" },
  medium:       { name: "Medium (C/Z/L profile)",     sideMargin: 5,  note: "C-channel, Z-profile, L-angle" },
  complex:      { name: "Complex (Hat/Omega)",         sideMargin: 8,  note: "Hat section, Omega profile" },
  very_complex: { name: "Very Complex (Closed tube)",  sideMargin: 12, note: "Square tube, closed section" },
};

// ─── Calculation ──────────────────────────────────────────────────────────────

function calcBlank(entry: RollEntry) {
  const mat   = MATERIAL_DB[entry.material];
  const mach  = MACHINING_DB[entry.machining];
  const comp  = COMPLEXITY_DB[entry.complexity];

  const totalDiameterAllowance = mach.turnAllowance + mach.finishAllowance;
  const roughOD = entry.finalOD + totalDiameterAllowance;
  const rawOD   = STANDARD_OD_SIZES.find(s => s >= roughOD) ?? roughOD + 10;

  const sideMargin   = comp.sideMargin;
  const facingStock  = mach.lengthAllowance / 2;
  const totalLength  = entry.faceWidth + 2 * entry.shaftLen + 2 * facingStock;
  const rawLength    = STANDARD_LENGTHS.find(l => l >= totalLength) ?? totalLength + 50;

  const rawR  = rawOD / 2 / 1000;
  const rawL  = rawLength / 1000;
  const vol   = Math.PI * rawR * rawR * rawL;
  const wt    = vol * mat.density * 1000;
  const cost  = wt * mat.ratePerKg * entry.qty;

  const finishedR = entry.finalOD / 2 / 1000;
  const finishedL = entry.faceWidth / 1000;
  const finishedVol = Math.PI * finishedR * finishedR * finishedL;
  const finishedWt  = finishedVol * mat.density * 1000;
  const wasteWt     = wt - finishedWt;

  return {
    roughOD, rawOD, rawLength, totalLength, sideMargin,
    facingStock, wt, cost, wasteWt, finishedWt,
    mat, mach, comp, totalDiameterAllowance,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newEntry(overrides?: Partial<RollEntry>): RollEntry {
  return {
    id: `roll-${Date.now()}`,
    name: "Upper Roll — St.1",
    part: "upper",
    finalOD: 150,
    faceWidth: 180,
    shaftDia: 40,
    shaftLen: 80,
    profileHeight: 25,
    material: "D2",
    machining: "turn_grind",
    complexity: "medium",
    qty: 1,
    ...overrides,
  };
}

function fmm(v: number, d = 1) { return v.toFixed(d); }
function fkg(v: number) { return v.toFixed(3); }
function finr(v: number) { return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function LabelVal({ label, val, color = "text-zinc-100", unit = "" }: {
  label: string; val: string | number; color?: string; unit?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px] border-b border-zinc-800/60 last:border-0">
      <span className="text-[11px] text-zinc-400 shrink-0">{label}</span>
      <span className={`text-[12px] font-mono font-semibold ${color} ml-auto`}>
        {val}{unit ? <span className="text-zinc-500 text-[10px] ml-1">{unit}</span> : null}
      </span>
    </div>
  );
}

function SectionHead({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 mb-3 pb-1.5 border-b ${color}`}>
      {icon}
      <span className="text-[11px] font-semibold tracking-wider uppercase text-zinc-300">{title}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RollBlankCalculator() {
  const [entries, setEntries] = useState<RollEntry[]>([
    newEntry({ name: "Upper Roll — St.1", part: "upper", finalOD: 150, faceWidth: 180, shaftLen: 80, qty: 1 }),
    newEntry({ id: `roll-${Date.now() + 1}`, name: "Lower Roll — St.1", part: "lower", finalOD: 150, faceWidth: 180, shaftLen: 80, qty: 1 }),
  ]);
  const [activeId, setActiveId] = useState(entries[0].id);
  const [showInfo, setShowInfo] = useState(false);

  const active = entries.find(e => e.id === activeId) ?? entries[0];
  const result = useMemo(() => calcBlank(active), [active]);

  const update = useCallback((patch: Partial<RollEntry>) => {
    setEntries(prev => prev.map(e => e.id === activeId ? { ...e, ...patch } : e));
  }, [activeId]);

  const addEntry = () => {
    const e = newEntry({ id: `roll-${Date.now()}`, name: `Roll — St.${entries.length + 1}` });
    setEntries(prev => [...prev, e]);
    setActiveId(e.id);
  };

  const removeEntry = (id: string) => {
    if (entries.length === 1) return;
    setEntries(prev => prev.filter(e => e.id !== id));
    setActiveId(entries.find(e => e.id !== id)?.id ?? entries[0].id);
  };

  const allResults = useMemo(() => entries.map(e => ({ entry: e, result: calcBlank(e) })), [entries]);
  const grandTotalCost = allResults.reduce((s, r) => s + r.result.cost, 0);
  const grandTotalWt   = allResults.reduce((s, r) => s + r.result.wt * r.entry.qty, 0);

  const exportReport = () => {
    const lines = [
      "═══════════════════════════════════════════════════════════",
      "         SAI ROLOTECH SMART ENGINES  —  Roll Blank Sizes",
      `         Generated: ${new Date().toLocaleString("en-IN")}`,
      "═══════════════════════════════════════════════════════════",
      "",
      `${"Roll Name".padEnd(20)} ${"Mat".padEnd(10)} ${"Final Ø".padEnd(10)} ${"Raw Ø".padEnd(8)} ${"Raw L".padEnd(8)} ${"Side+".padEnd(7)} ${"Wt(kg)".padEnd(9)} ${"Cost (₹)"}`,
      "─".repeat(90),
      ...allResults.map(({ entry: e, result: r }) =>
        `${e.name.padEnd(20)} ${MATERIAL_DB[e.material].name.slice(0,10).padEnd(10)} ${fmm(e.finalOD).padEnd(10)} ${String(r.rawOD).padEnd(8)} ${String(r.rawLength).padEnd(8)} ${String(r.sideMargin).padEnd(7)} ${fkg(r.wt * e.qty).padEnd(9)} ${finr(r.cost)}`
      ),
      "─".repeat(90),
      `${"TOTAL".padEnd(60)} ${fkg(grandTotalWt).padEnd(9)} ${finr(grandTotalCost)}`,
      "",
      "─── Per-Roll Detail ───────────────────────────────────────",
      ...allResults.flatMap(({ entry: e, result: r }) => [
        "",
        `ROLL: ${e.name}  (Qty: ${e.qty})`,
        `  Final OD         : ${fmm(e.finalOD)} mm`,
        `  Rough OD (calc.) : ${fmm(r.roughOD)} mm  (Final + ${r.totalDiameterAllowance}mm machining allowance)`,
        `  Raw OD (std.)    : ${r.rawOD} mm  ← ORDER THIS SIZE`,
        `  Face Width       : ${fmm(e.faceWidth)} mm`,
        `  Shaft Length×2   : ${fmm(e.shaftLen * 2)} mm  (${e.shaftLen} per side)`,
        `  Facing Stock×2   : ${fmm(r.facingStock * 2)} mm  (${r.facingStock} per side)`,
        `  Total Length     : ${fmm(r.totalLength)} mm`,
        `  Raw Length (std.): ${r.rawLength} mm  ← ORDER THIS LENGTH`,
        `  Side Extra/side  : +${r.sideMargin} mm  (${r.comp.note})`,
        `  Material         : ${r.mat.name}`,
        `  Heat Treatment   : ${r.mat.treatment}`,
        `  Hardness         : ${r.mat.hardness}`,
        `  Blank Weight     : ${fkg(r.wt)} kg/pc  (×${e.qty} = ${fkg(r.wt * e.qty)} kg)`,
        `  Material Cost    : ${finr(r.cost)}  (@₹${r.mat.ratePerKg}/kg)`,
        `  Machining Note   : ${r.mach.note}`,
      ]),
      "",
      "═══════════════════════════════════════════════════════════",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `RollBlank_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };

  const inp = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:border-amber-500 outline-none";
  const sel = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs focus:border-amber-500 outline-none";
  const lbl = "block text-[10px] text-zinc-400 mb-1";

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Ruler className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100">Roll Blank Size Calculator</div>
            <div className="text-[10px] text-zinc-500">Raw OD · Final OD · Length · Side Margin · Material</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInfo(v => !v)} className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200">
            <Info className="w-3.5 h-3.5" />
          </button>
          <button onClick={exportReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold">
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* ── Info Banner ── */}
      {showInfo && (
        <div className="mx-4 mt-3 p-3 rounded-lg bg-blue-500/8 border border-blue-500/20 text-[11px] text-blue-300 shrink-0">
          <strong>Machining Allowances:</strong> CNC Turn only = +8mm Ø · Turn+Grind = +12mm Ø · Turn+Hard Turn = +9mm Ø<br />
          <strong>Side Margin (profile extra):</strong> Simple = 3mm/side · Medium (C/Z/L) = 5mm/side · Complex (Hat/Omega) = 8mm/side · Closed section = 12mm/side<br />
          <strong>Length formula:</strong> Raw Length = Face Width + (2 × Shaft Length) + facing stock per process
        </div>
      )}

      {/* ── Roll Tabs ── */}
      <div className="flex items-center gap-1 px-4 pt-3 shrink-0 overflow-x-auto">
        {entries.map(e => (
          <button
            key={e.id}
            onClick={() => setActiveId(e.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors ${
              e.id === activeId
                ? "border-amber-500 bg-zinc-900 text-amber-400"
                : "border-transparent bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${e.part === "upper" ? "bg-blue-400" : e.part === "lower" ? "bg-green-400" : "bg-amber-400"}`} />
            {e.name}
          </button>
        ))}
        <button onClick={addEntry} className="px-3 py-1.5 rounded-t-lg text-[11px] bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent whitespace-nowrap">
          + Add Roll
        </button>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-4 pt-3 min-h-0" style={{ gridTemplateColumns: "1fr 1fr" }}>

          {/* ── Left: Input Form ── */}
          <div className="space-y-4">

            {/* Roll Identity */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <SectionHead icon={<Box className="w-3.5 h-3.5 text-amber-400" />} title="Roll Identity" color="border-amber-500/30" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Roll Name</label>
                  <input className={inp} value={active.name} onChange={e => update({ name: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Roll Part</label>
                  <select className={sel} value={active.part} onChange={e => update({ part: e.target.value as RollPart })}>
                    <option value="upper">Upper Roll</option>
                    <option value="lower">Lower Roll</option>
                    <option value="custom">Custom / Spacer</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Quantity (pcs)</label>
                  <input type="number" className={inp} min={1} max={20} value={active.qty}
                    onChange={e => update({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
                </div>
                {entries.length > 1 && (
                  <div className="flex items-end">
                    <button onClick={() => removeEntry(active.id)}
                      className="w-full py-1.5 rounded bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 text-red-400 text-[11px]">
                      Remove Roll
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Dimensions */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <SectionHead icon={<Ruler className="w-3.5 h-3.5 text-blue-400" />} title="Roll Dimensions (Final Sizes)" color="border-blue-500/30" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Final OD (Finished) — mm</label>
                  <input type="number" className={inp} min={50} max={600} step={5} value={active.finalOD}
                    onChange={e => update({ finalOD: parseFloat(e.target.value) || 150 })} />
                  <div className="text-[9px] text-zinc-500 mt-0.5">After all machining + grinding</div>
                </div>
                <div>
                  <label className={lbl}>Face Width — mm</label>
                  <input type="number" className={inp} min={20} max={500} step={5} value={active.faceWidth}
                    onChange={e => update({ faceWidth: parseFloat(e.target.value) || 180 })} />
                  <div className="text-[9px] text-zinc-500 mt-0.5">Roll working face (not shaft)</div>
                </div>
                <div>
                  <label className={lbl}>Shaft Diameter — mm</label>
                  <input type="number" className={inp} min={20} max={200} step={2} value={active.shaftDia}
                    onChange={e => update({ shaftDia: parseFloat(e.target.value) || 40 })} />
                </div>
                <div>
                  <label className={lbl}>Shaft Length per side — mm</label>
                  <input type="number" className={inp} min={20} max={300} step={5} value={active.shaftLen}
                    onChange={e => update({ shaftLen: parseFloat(e.target.value) || 80 })} />
                  <div className="text-[9px] text-zinc-500 mt-0.5">One side only</div>
                </div>
                <div>
                  <label className={lbl}>Profile Height — mm</label>
                  <input type="number" className={inp} min={0} max={200} step={1} value={active.profileHeight}
                    onChange={e => update({ profileHeight: parseFloat(e.target.value) || 25 })} />
                </div>
              </div>
            </div>

            {/* Process + Material */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <SectionHead icon={<Zap className="w-3.5 h-3.5 text-green-400" />} title="Material + Process" color="border-green-500/30" />
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Roll Material Grade</label>
                  <select className={sel} value={active.material} onChange={e => update({ material: e.target.value as MaterialGrade })}>
                    {(Object.keys(MATERIAL_DB) as MaterialGrade[]).map(k => (
                      <option key={k} value={k}>{MATERIAL_DB[k].name}  —  {MATERIAL_DB[k].hardness}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Machining Process</label>
                  <select className={sel} value={active.machining} onChange={e => update({ machining: e.target.value as MachiningProcess })}>
                    {(Object.keys(MACHINING_DB) as MachiningProcess[]).map(k => (
                      <option key={k} value={k}>{MACHINING_DB[k].name}  (+{MACHINING_DB[k].turnAllowance + MACHINING_DB[k].finishAllowance}mm Ø)</option>
                    ))}
                  </select>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{MACHINING_DB[active.machining].note}</div>
                </div>
                <div>
                  <label className={lbl}>Profile Complexity (Side Margin)</label>
                  <select className={sel} value={active.complexity} onChange={e => update({ complexity: e.target.value as ProfileComplexity })}>
                    {(Object.keys(COMPLEXITY_DB) as ProfileComplexity[]).map(k => (
                      <option key={k} value={k}>{COMPLEXITY_DB[k].name}  (+{COMPLEXITY_DB[k].sideMargin}mm/side)</option>
                    ))}
                  </select>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{COMPLEXITY_DB[active.complexity].note}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Results ── */}
          <div className="space-y-4">

            {/* Raw Material Size — PRIMARY RESULT */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-amber-500/40">
              <SectionHead icon={<Package className="w-3.5 h-3.5 text-amber-400" />} title="Raw Material to Order" color="border-amber-500/30" />

              {/* Big highlight boxes */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center">
                  <div className="text-[9px] text-zinc-400 mb-1 uppercase tracking-widest">Raw OD (Order Size)</div>
                  <div className="text-3xl font-black text-amber-400">{result.rawOD}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">mm diameter</div>
                  <div className="text-[9px] text-zinc-500 mt-1">Calculated rough: Ø{fmm(result.roughOD)}</div>
                </div>
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-center">
                  <div className="text-[9px] text-zinc-400 mb-1 uppercase tracking-widest">Raw Length (Order Size)</div>
                  <div className="text-3xl font-black text-blue-400">{result.rawLength}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">mm length</div>
                  <div className="text-[9px] text-zinc-500 mt-1">Total needed: {fmm(result.totalLength)} mm</div>
                </div>
              </div>

              {/* Allowance breakdown */}
              <div className="rounded-lg bg-zinc-800/60 p-3 space-y-[2px]">
                <div className="text-[9px] text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Diameter Breakdown</div>
                <LabelVal label="Final OD (finished)" val={fmm(active.finalOD)} unit="mm" color="text-green-400" />
                <LabelVal label="Turning allowance (on Ø)" val={`+${MACHINING_DB[active.machining].turnAllowance}`} unit="mm" color="text-yellow-400" />
                {MACHINING_DB[active.machining].finishAllowance > 0 && (
                  <LabelVal label="Grind/finish allowance (on Ø)" val={`+${MACHINING_DB[active.machining].finishAllowance}`} unit="mm" color="text-yellow-400" />
                )}
                <LabelVal label="Rough OD (calculated)" val={fmm(result.roughOD)} unit="mm" color="text-orange-400" />
                <LabelVal label="Raw OD (std. size to buy)" val={result.rawOD} unit="mm" color="text-amber-300 font-bold" />
              </div>

              <div className="rounded-lg bg-zinc-800/60 p-3 space-y-[2px] mt-3">
                <div className="text-[9px] text-zinc-500 mb-2 font-semibold uppercase tracking-widest">Length Breakdown</div>
                <LabelVal label="Face Width" val={fmm(active.faceWidth)} unit="mm" color="text-green-400" />
                <LabelVal label="Shaft (×2 sides)" val={`${fmm(active.shaftLen * 2)}`} unit={`mm (${active.shaftLen} per side)`} color="text-blue-400" />
                <LabelVal label="Facing stock (×2)" val={`+${fmm(result.facingStock * 2)}`} unit="mm" color="text-yellow-400" />
                <LabelVal label="Total length (needed)" val={fmm(result.totalLength)} unit="mm" color="text-orange-400" />
                <LabelVal label="Raw Length (std. size to buy)" val={result.rawLength} unit="mm" color="text-blue-300 font-bold" />
              </div>
            </div>

            {/* Side Margin — Profile Extra */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-green-500/30">
              <SectionHead icon={<Layers className="w-3.5 h-3.5 text-green-400" />} title="Profile Side Margin (Extra Material)" color="border-green-500/30" />
              <div className="rounded-lg bg-green-500/8 border border-green-500/20 p-3 text-center mb-3">
                <div className="text-[9px] text-zinc-400 uppercase tracking-widest mb-1">Extra Per Side for Profile</div>
                <div className="text-4xl font-black text-green-400">+{result.sideMargin}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">mm per side</div>
                <div className="text-[9px] text-zinc-500 mt-1">Total extra width: +{result.sideMargin * 2} mm</div>
              </div>
              <div className="text-[11px] text-zinc-300 bg-zinc-800/50 rounded-lg p-3">
                <div className="font-semibold text-green-400 mb-1">{result.comp.name}</div>
                <div className="text-zinc-400">{result.comp.note}</div>
                <div className="mt-2 text-zinc-400">
                  <strong className="text-zinc-300">Face Width order:</strong> {active.faceWidth} mm (working) +{" "}
                  <strong className="text-green-400">{result.sideMargin * 2} mm</strong> (profile extra) ={" "}
                  <strong className="text-amber-400">{active.faceWidth + result.sideMargin * 2} mm</strong> minimum blank face
                </div>
              </div>
            </div>

            {/* Material Info */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-purple-500/30">
              <SectionHead icon={<Calculator className="w-3.5 h-3.5 text-purple-400" />} title="Material + Cost" color="border-purple-500/30" />
              <LabelVal label="Material" val={result.mat.name} color="text-zinc-100" />
              <LabelVal label="Hardness" val={result.mat.hardness} color="text-amber-400" />
              <LabelVal label="Heat Treatment" val={result.mat.treatment} color="text-orange-300" />
              <LabelVal label="Rate (approx)" val={`₹${result.mat.ratePerKg}/kg`} color="text-zinc-300" />
              <LabelVal label="Blank weight (1 pc)" val={`${fkg(result.wt)} kg`} color="text-blue-400" />
              <LabelVal label={`Total weight (×${active.qty})`} val={`${fkg(result.wt * active.qty)} kg`} color="text-blue-300" />
              <LabelVal label="Material waste" val={`~${fkg(result.wasteWt)} kg/pc`} color="text-red-400" />
              <div className="mt-3 rounded-lg bg-purple-500/10 border border-purple-500/20 p-2.5 text-center">
                <div className="text-[9px] text-zinc-400 uppercase tracking-widest">Estimated Material Cost</div>
                <div className="text-2xl font-black text-purple-400 mt-1">{finr(result.cost)}</div>
                <div className="text-[9px] text-zinc-500">for {active.qty} pc(s) — raw material only</div>
              </div>
              <div className="mt-2 text-[10px] text-zinc-500 bg-zinc-800/40 rounded p-2">
                <strong className="text-zinc-400">Application:</strong> {result.mat.application}
              </div>
            </div>
          </div>
        </div>

        {/* ── All Rolls Summary Table ── */}
        {entries.length > 1 && (
          <div className="mt-4 bg-zinc-900 rounded-xl p-4 border border-zinc-700">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-300">All Rolls — Purchase Summary</span>
              <span className="ml-auto text-[10px] text-zinc-500">Grand Total: {finr(grandTotalCost)}  |  {fkg(grandTotalWt)} kg</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="text-left py-1.5 px-2">Roll Name</th>
                    <th className="text-right px-2">Final Ø</th>
                    <th className="text-right px-2 text-amber-400">Raw Ø (buy)</th>
                    <th className="text-right px-2 text-blue-400">Raw L (buy)</th>
                    <th className="text-right px-2 text-green-400">Side+</th>
                    <th className="text-right px-2">Material</th>
                    <th className="text-right px-2">Qty</th>
                    <th className="text-right px-2">Wt(kg)</th>
                    <th className="text-right px-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {allResults.map(({ entry: e, result: r }) => (
                    <tr key={e.id}
                      onClick={() => setActiveId(e.id)}
                      className={`border-b border-zinc-800/60 cursor-pointer hover:bg-zinc-800/40 ${e.id === activeId ? "bg-zinc-800/60" : ""}`}>
                      <td className="py-1.5 px-2 text-zinc-200">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${e.part === "upper" ? "bg-blue-400" : e.part === "lower" ? "bg-green-400" : "bg-amber-400"}`} />
                        {e.name}
                      </td>
                      <td className="px-2 text-right text-zinc-300">Ø{fmm(e.finalOD)}</td>
                      <td className="px-2 text-right text-amber-400 font-bold">Ø{r.rawOD}</td>
                      <td className="px-2 text-right text-blue-400 font-bold">{r.rawLength}</td>
                      <td className="px-2 text-right text-green-400">+{r.sideMargin}</td>
                      <td className="px-2 text-right text-zinc-400">{MATERIAL_DB[e.material].name.split(" ").slice(0, 2).join(" ")}</td>
                      <td className="px-2 text-right text-zinc-300">{e.qty}</td>
                      <td className="px-2 text-right text-zinc-300">{fkg(r.wt * e.qty)}</td>
                      <td className="px-2 text-right text-purple-400">{finr(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-600 text-zinc-300 font-semibold">
                    <td colSpan={7} className="py-2 px-2">TOTAL</td>
                    <td className="px-2 text-right text-blue-300">{fkg(grandTotalWt)}</td>
                    <td className="px-2 text-right text-purple-300">{finr(grandTotalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
