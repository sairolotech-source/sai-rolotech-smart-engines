import React, { useState, useMemo } from "react";
import { Zap, Cog, Shield, Activity, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Download } from "lucide-react";
import { useCncStore } from "../../store/useCncStore";

// ─── Material Database ────────────────────────────────────────────────────────

const MATERIALS: Record<string, { label: string; yield: number; k: number; uts: number; }> = {
  "MS":   { label: "Mild Steel (MS)",       yield: 250, k: 1.7, uts: 410 },
  "HRCA": { label: "HRCA / HR Steel",       yield: 250, k: 1.6, uts: 400 },
  "CRCA": { label: "CRCA / CR Steel",       yield: 310, k: 2.0, uts: 450 },
  "GI":   { label: "Galvanized (GI)",       yield: 280, k: 1.8, uts: 420 },
  "SS304":{ label: "SS 304",                yield: 310, k: 2.5, uts: 620 },
  "SS316":{ label: "SS 316",                yield: 290, k: 2.6, uts: 580 },
  "AL":   { label: "Aluminium 6063",        yield: 215, k: 1.4, uts: 270 },
  "HSLA": { label: "HSLA (High Strength)",  yield: 550, k: 2.3, uts: 650 },
  "PP":   { label: "Pre-Painted Steel",     yield: 280, k: 1.8, uts: 420 },
  "CU":   { label: "Copper",               yield: 200, k: 1.4, uts: 300 },
};

// ─── Standard Motor Sizes (HP & kW) ──────────────────────────────────────────

const MOTOR_SIZES = [
  { hp: 1,  kw: 0.75,  rpm: 1440 }, { hp: 1.5,kw: 1.1,   rpm: 1440 },
  { hp: 2,  kw: 1.5,   rpm: 1440 }, { hp: 3,  kw: 2.2,   rpm: 1440 },
  { hp: 5,  kw: 3.7,   rpm: 1440 }, { hp: 7.5,kw: 5.5,   rpm: 1440 },
  { hp: 10, kw: 7.5,   rpm: 1440 }, { hp: 15, kw: 11,    rpm: 1440 },
  { hp: 20, kw: 15,    rpm: 1440 }, { hp: 25, kw: 18.5,  rpm: 960  },
  { hp: 30, kw: 22,    rpm: 960  }, { hp: 40, kw: 30,    rpm: 960  },
  { hp: 50, kw: 37,    rpm: 960  }, { hp: 60, kw: 45,    rpm: 720  },
  { hp: 75, kw: 55,    rpm: 720  }, { hp: 100,kw: 75,    rpm: 720  },
];

// ─── Bearing Catalog (SKF / FAG standard) ────────────────────────────────────

interface BearingSpec {
  series: string;
  code: string;
  bore: number;   // mm
  OD: number;     // mm
  B: number;      // width mm
  C: number;      // dynamic load kN
  C0: number;     // static load kN
  type: string;   // "deep groove" | "cylindrical" | "tapered"
  brand: string;
}

const BEARING_CATALOG: BearingSpec[] = [
  // 62xx series — standard deep groove
  { series: "6204", code: "6204",  bore: 20,  OD: 47,  B: 14, C: 9.95,  C0: 6.55,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6205", code: "6205",  bore: 25,  OD: 52,  B: 15, C: 11.2,  C0: 7.34,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6206", code: "6206",  bore: 30,  OD: 62,  B: 16, C: 15.3,  C0: 10.2,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6207", code: "6207",  bore: 35,  OD: 72,  B: 17, C: 20.4,  C0: 13.7,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6208", code: "6208",  bore: 40,  OD: 80,  B: 18, C: 25.5,  C0: 17.8,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6209", code: "6209",  bore: 45,  OD: 85,  B: 19, C: 27.0,  C0: 18.6,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6210", code: "6210",  bore: 50,  OD: 90,  B: 20, C: 34.0,  C0: 22.4,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6211", code: "6211",  bore: 55,  OD: 100, B: 21, C: 43.0,  C0: 29.0,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6212", code: "6212",  bore: 60,  OD: 110, B: 22, C: 48.0,  C0: 33.5,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6213", code: "6213",  bore: 65,  OD: 120, B: 23, C: 57.0,  C0: 40.0,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6214", code: "6214",  bore: 70,  OD: 125, B: 24, C: 62.0,  C0: 44.0,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6215", code: "6215",  bore: 75,  OD: 130, B: 25, C: 66.0,  C0: 49.5,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6216", code: "6216",  bore: 80,  OD: 140, B: 26, C: 71.5,  C0: 53.0,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6218", code: "6218",  bore: 90,  OD: 160, B: 30, C: 96.0,  C0: 73.0,  type: "Deep Groove",    brand: "SKF/FAG" },
  { series: "6220", code: "6220",  bore: 100, OD: 180, B: 34, C: 108.0, C0: 85.0,  type: "Deep Groove",    brand: "SKF/FAG" },
  // 63xx heavy series
  { series: "6306", code: "6306",  bore: 30,  OD: 72,  B: 19, C: 22.0,  C0: 15.0,  type: "Deep Groove Heavy", brand: "SKF/FAG" },
  { series: "6308", code: "6308",  bore: 40,  OD: 90,  B: 23, C: 40.0,  C0: 28.0,  type: "Deep Groove Heavy", brand: "SKF/FAG" },
  { series: "6310", code: "6310",  bore: 50,  OD: 110, B: 27, C: 61.8,  C0: 44.0,  type: "Deep Groove Heavy", brand: "SKF/FAG" },
  { series: "6312", code: "6312",  bore: 60,  OD: 130, B: 31, C: 81.9,  C0: 60.0,  type: "Deep Groove Heavy", brand: "SKF/FAG" },
  { series: "6314", code: "6314",  bore: 70,  OD: 150, B: 35, C: 104.0, C0: 79.0,  type: "Deep Groove Heavy", brand: "SKF/FAG" },
  { series: "6316", code: "6316",  bore: 80,  OD: 170, B: 39, C: 123.0, C0: 98.0,  type: "Deep Groove Heavy", brand: "SKF/FAG" },
  // NU Cylindrical (high radial load)
  { series: "NU210", code: "NU210", bore: 50,  OD: 90,  B: 20, C: 68.0,  C0: 55.0,  type: "Cylindrical Roller", brand: "SKF" },
  { series: "NU211", code: "NU211", bore: 55,  OD: 100, B: 21, C: 83.0,  C0: 70.0,  type: "Cylindrical Roller", brand: "SKF" },
  { series: "NU212", code: "NU212", bore: 60,  OD: 110, B: 22, C: 95.0,  C0: 83.0,  type: "Cylindrical Roller", brand: "SKF" },
  { series: "NU214", code: "NU214", bore: 70,  OD: 125, B: 24, C: 118.0, C0: 105.0, type: "Cylindrical Roller", brand: "SKF" },
  { series: "NU216", code: "NU216", bore: 80,  OD: 140, B: 26, C: 137.0, C0: 125.0, type: "Cylindrical Roller", brand: "SKF" },
  // 32xx Tapered
  { series: "32008", code: "32008X",bore: 40,  OD: 68,  B: 19, C: 44.0,  C0: 55.0,  type: "Tapered Roller",   brand: "SKF/TIMKEN" },
  { series: "32010", code: "32010X",bore: 50,  OD: 80,  B: 20, C: 57.0,  C0: 72.0,  type: "Tapered Roller",   brand: "SKF/TIMKEN" },
  { series: "32012", code: "32012X",bore: 60,  OD: 95,  B: 23, C: 77.0,  C0: 100.0, type: "Tapered Roller",   brand: "SKF/TIMKEN" },
  { series: "32014", code: "32014X",bore: 70,  OD: 110, B: 25, C: 93.0,  C0: 125.0, type: "Tapered Roller",   brand: "SKF/TIMKEN" },
  { series: "32016", code: "32016X",bore: 80,  OD: 125, B: 29, C: 118.0, C0: 160.0, type: "Tapered Roller",   brand: "SKF/TIMKEN" },
];

// ─── Standard Gearbox Ratios ──────────────────────────────────────────────────

const STD_RATIOS = [5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 80, 100];

function nearestStdRatio(ratio: number) {
  return STD_RATIOS.reduce((a, b) => Math.abs(b - ratio) < Math.abs(a - ratio) ? b : a);
}

function nearestMotor(kwRequired: number) {
  return MOTOR_SIZES.find(m => m.kw >= kwRequired) || MOTOR_SIZES[MOTOR_SIZES.length - 1];
}

function selectBearing(bore: number, radialLoadKN: number, rpm: number): {
  recommended: BearingSpec; alternate: BearingSpec | null; life: number; safetyRatio: number;
} {
  // Filter by bore size (±5mm tolerance) and sorted by C rating
  const candidates = BEARING_CATALOG
    .filter(b => b.bore >= bore - 5 && b.bore <= bore + 15)
    .sort((a, b) => a.C - b.C);

  // Equivalent load P = radialLoad (no axial for roll forming typically)
  const P = radialLoadKN;

  // Find minimum required C for L10 = 30000 hours (roll forming standard)
  // L10 = (C/P)^3 × (10^6 / (60×n))  → C_min = P × (L10 × 60 × n / 10^6)^(1/3)
  const L10_target = 30000; // hours
  const C_min = P * Math.pow((L10_target * 60 * rpm) / 1e6, 1 / 3);

  const recommended = candidates.find(b => b.C >= C_min) || candidates[candidates.length - 1];
  const alternateIdx = candidates.indexOf(recommended) + 1;
  const alternate = candidates[alternateIdx] || null;

  // Actual L10 for recommended
  const life = recommended
    ? (Math.pow(recommended.C / Math.max(P, 0.001), 3) * 1e6) / (60 * Math.max(rpm, 1))
    : 0;
  const safetyRatio = recommended ? recommended.C / Math.max(P, 0.001) : 0;

  return { recommended, alternate, life, safetyRatio };
}

// ─── Calculation Core ─────────────────────────────────────────────────────────

function calculate(inp: {
  material: string; thickness: number; stripWidth: number;
  numStands: number; lineSpeed: number; motorRPM: number;
  shaftDia: number; safetyFactor: number; bearingsPerStand: number;
  anglePerPass: number;
}) {
  const mat = MATERIALS[inp.material] || MATERIALS["MS"];
  const { thickness: t, stripWidth: W, numStands: n, lineSpeed: v,
    motorRPM, shaftDia, safetyFactor, bearingsPerStand, anglePerPass } = inp;

  // ── Forming Force ──
  const perPassForce_N = mat.k * W * t * t * 1000; // Newtons
  const perPassForce_kN = perPassForce_N / 1000;
  const totalForce_kN = perPassForce_kN * n;
  const designForce_kN = totalForce_kN * safetyFactor;

  // ── Bending Moment ──
  const bendingMoment = (mat.yield * t * t * W) / 6; // N·mm
  const rollRadius = shaftDia / 2;
  const shaftBendMoment = designForce_kN * 1000 * (rollRadius / 1000); // N·m

  // ── Power ──
  const powerIdeal_kW = (totalForce_kN * 1000 * v) / (60 * 1000);
  const powerRequired_kW = powerIdeal_kW * safetyFactor;
  const powerRequired_HP = powerRequired_kW * 1.341;

  // ── Motor Selection ──
  const motor = nearestMotor(powerRequired_kW);

  // ── Roll RPM ──
  const rollRPM = (1000 * v) / (Math.PI * shaftDia);

  // ── Gear Ratio ──
  const gearRatioIdeal = motorRPM / rollRPM;
  const gearRatioStd = nearestStdRatio(gearRatioIdeal);

  // ── Output Torque ──
  const outputTorque_Nm = (9550 * motor.kw) / Math.max(rollRPM, 1);
  const inputTorque_Nm = outputTorque_Nm / gearRatioStd;

  // ── Bearing Selection ──
  const radialLoadPerBearing_kN = designForce_kN / (2 * n * bearingsPerStand);
  const bearing = selectBearing(shaftDia, radialLoadPerBearing_kN, rollRPM);

  // ── Shaft Check ──
  const shaftMoment_Nm = (perPassForce_kN * 1000 * (shaftDia / 2)) / 1000;
  const shaftSection_mm3 = (Math.PI * Math.pow(shaftDia, 3)) / 32;
  const shaftStress_MPa = (shaftMoment_Nm * 1000) / shaftSection_mm3;
  const shaftSafe = shaftStress_MPa < 80; // safe bending stress for C45

  return {
    mat,
    perPassForce_kN, totalForce_kN, designForce_kN, bendingMoment,
    powerIdeal_kW, powerRequired_kW, powerRequired_HP,
    motor, rollRPM, gearRatioIdeal, gearRatioStd, outputTorque_Nm, inputTorque_Nm,
    radialLoadPerBearing_kN, bearing,
    shaftMoment_Nm, shaftStress_MPa, shaftSafe,
  };
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, color, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden ${color === "blue" ? "border-blue-500/25 bg-blue-500/5" : color === "green" ? "border-green-500/25 bg-green-500/5" : color === "violet" ? "border-violet-500/25 bg-violet-500/5" : "border-amber-500/25 bg-amber-500/5"}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
        {icon}
        <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest">{title}</span>
        <span className="ml-auto">{open ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}</span>
      </button>
      {open && <div className="px-3 pb-3 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

function Row({ label, value, unit, highlight, warn, tip }: {
  label: string; value: string; unit?: string; highlight?: boolean; warn?: boolean; tip?: string;
}) {
  return (
    <div className={`flex items-center gap-2 py-1.5 border-b border-white/[0.04] last:border-0 ${highlight ? "bg-white/[0.03] rounded px-1" : ""}`}>
      <span className="text-[10px] text-zinc-500 w-44 shrink-0">{label}</span>
      <span className={`text-[11px] font-bold ml-auto ${warn ? "text-amber-400" : highlight ? "text-emerald-300" : "text-zinc-200"}`}>{value}</span>
      {unit && <span className="text-[9px] text-zinc-600 w-10 shrink-0">{unit}</span>}
      {tip && <span className="text-[8px] text-zinc-600 hidden xl:block max-w-[120px] leading-tight">{tip}</span>}
    </div>
  );
}

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold ${ok ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-red-500/15 text-red-400 border border-red-500/30"}`}>
      {ok ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
      {text}
    </span>
  );
}

function inp(label: string, value: number, set: (v: number) => void, min: number, max: number, step: number, unit: string) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-zinc-500 w-32 shrink-0">{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => set(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))}
        className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-zinc-200 focus:border-blue-500 focus:outline-none" />
      <span className="text-[9px] text-zinc-600 w-8 shrink-0">{unit}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MachineLoadCalculator() {
  const store = useCncStore();

  const [material,        setMaterial]        = useState("CRCA");
  const [thickness,       setThickness]       = useState(store.materialThickness || 1.5);
  const [stripWidth,      setStripWidth]      = useState(200);
  const [numStands,       setNumStands]       = useState(store.stations?.length || 12);
  const [lineSpeed,       setLineSpeed]       = useState(store.lineSpeed || 15);
  const [motorRPM,        setMotorRPM]        = useState(1440);
  const [shaftDia,        setShaftDia]        = useState(60);
  const [safetyFactor,    setSafetyFactor]    = useState(1.5);
  const [bearingsPerStand,setBearingsPerStand]= useState(2);
  const [anglePerPass,    setAnglePerPass]    = useState(15);

  const r = useMemo(() => calculate({
    material, thickness, stripWidth, numStands, lineSpeed, motorRPM, shaftDia, safetyFactor, bearingsPerStand, anglePerPass,
  }), [material, thickness, stripWidth, numStands, lineSpeed, motorRPM, shaftDia, safetyFactor, bearingsPerStand, anglePerPass]);

  const exportReport = () => {
    const lines = [
      "SAI ROLOTECH SMART ENGINES — MACHINE LOAD REPORT",
      "=".repeat(55),
      "",
      "INPUTS",
      `  Material       : ${r.mat.label}`,
      `  Thickness      : ${thickness} mm`,
      `  Strip Width    : ${stripWidth} mm`,
      `  No. of Stands  : ${numStands}`,
      `  Line Speed     : ${lineSpeed} m/min`,
      `  Motor RPM      : ${motorRPM} RPM`,
      `  Shaft Dia      : ${shaftDia} mm`,
      `  Safety Factor  : ${safetyFactor}x`,
      "",
      "FORMING LOAD",
      `  Per-pass Force : ${r.perPassForce_kN.toFixed(2)} kN`,
      `  Total Force    : ${r.totalForce_kN.toFixed(2)} kN`,
      `  Design Force   : ${r.designForce_kN.toFixed(2)} kN (with ${safetyFactor}x SF)`,
      `  Bending Moment : ${(r.bendingMoment / 1000).toFixed(2)} N·m`,
      "",
      "MOTOR SELECTION",
      `  Required Power : ${r.powerRequired_kW.toFixed(2)} kW (${r.powerRequired_HP.toFixed(1)} HP)`,
      `  Recommended    : ${r.motor.hp} HP / ${r.motor.kw} kW — ${r.motor.rpm} RPM`,
      `  Roll RPM       : ${r.rollRPM.toFixed(1)} RPM`,
      "",
      "GEARBOX / DRIVE",
      `  Ideal Ratio    : ${r.gearRatioIdeal.toFixed(2)} : 1`,
      `  Standard Ratio : ${r.gearRatioStd} : 1`,
      `  Output Torque  : ${r.outputTorque_Nm.toFixed(1)} N·m`,
      `  Input Torque   : ${r.inputTorque_Nm.toFixed(1)} N·m`,
      "",
      "BEARING SELECTION",
      `  Load per Brg   : ${r.radialLoadPerBearing_kN.toFixed(3)} kN`,
      `  Recommended    : ${r.bearing.recommended?.code || "N/A"} (${r.bearing.recommended?.type})`,
      `  Bore / OD / W  : ${r.bearing.recommended?.bore}mm × ${r.bearing.recommended?.OD}mm × ${r.bearing.recommended?.B}mm`,
      `  Dynamic C      : ${r.bearing.recommended?.C} kN`,
      `  Safety Ratio   : ${r.bearing.safetyRatio.toFixed(1)} : 1`,
      `  Bearing Life   : ${r.bearing.life.toFixed(0)} hrs (L10)`,
      "",
      "SHAFT CHECK",
      `  Bending Stress : ${r.shaftStress_MPa.toFixed(1)} MPa`,
      `  Status         : ${r.shaftSafe ? "SAFE" : "OVERLOADED — increase shaft diameter"}`,
      "",
      "Generated by SAI ROLOTECH SMART ENGINES v2.2.6",
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `machine_load_report_${material}_${thickness}mm.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const iCls = "flex flex-col gap-1.5 py-2";

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/50 shrink-0">
        <Activity className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-bold text-zinc-200">Machine Load Calculator</span>
        <span className="text-[9px] text-zinc-500 hidden sm:block">Motor HP · Gear Ratio · Bearing Number · Forming Force</span>
        <button onClick={exportReport} className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded border bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25 text-[10px] font-bold transition-all">
          <Download className="w-3 h-3" /> Export Report
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* ── INPUTS ── */}
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3">
          <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Info className="w-3 h-3" /> Inputs
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-1">

            {/* Material */}
            <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-1">
              <span className="text-[9px] text-zinc-500 w-32 shrink-0">Material</span>
              <select value={material} onChange={e => setMaterial(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-zinc-200 focus:border-blue-500 focus:outline-none">
                {Object.entries(MATERIALS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {inp("Thickness",         thickness,        setThickness,        0.4, 10,   0.1, "mm")}
            {inp("Strip Width",       stripWidth,       setStripWidth,       50,  2000, 10,  "mm")}
            {inp("No. of Stands",     numStands,        setNumStands,        2,   40,   1,   "")}
            {inp("Line Speed",        lineSpeed,        setLineSpeed,        1,   100,  1,   "m/min")}
            {inp("Motor RPM",         motorRPM,         setMotorRPM,         500, 3000, 60,  "RPM")}
            {inp("Shaft Diameter",    shaftDia,         setShaftDia,         20,  200,  5,   "mm")}
            {inp("Safety Factor",     safetyFactor,     setSafetyFactor,     1.0, 3.0,  0.1, "×")}
            {inp("Bearings / Stand",  bearingsPerStand, setBearingsPerStand, 1,   4,    1,   "")}
            {inp("Angle / Pass",      anglePerPass,     setAnglePerPass,     1,   45,   1,   "°")}
          </div>

          {/* Material info bar */}
          <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-zinc-500">
            <span className="bg-zinc-800 rounded px-2 py-0.5">Yield: <b className="text-zinc-300">{r.mat.yield} MPa</b></span>
            <span className="bg-zinc-800 rounded px-2 py-0.5">UTS: <b className="text-zinc-300">{r.mat.uts} MPa</b></span>
            <span className="bg-zinc-800 rounded px-2 py-0.5">k-Factor: <b className="text-zinc-300">{r.mat.k}</b></span>
          </div>
        </div>

        {/* ── FORMING LOAD ── */}
        <SectionCard title="1. Forming Load" icon={<Zap className="w-3.5 h-3.5 text-blue-400" />} color="blue">
          <div className={iCls}>
            <Row label="Per-pass forming force" value={r.perPassForce_kN.toFixed(2)} unit="kN" />
            <Row label={`Total force (${numStands} stands)`} value={r.totalForce_kN.toFixed(2)} unit="kN" />
            <Row label={`Design force (SF ${safetyFactor}×)`} value={r.designForce_kN.toFixed(2)} unit="kN" highlight />
            <Row label="Bending moment per roll" value={(r.bendingMoment / 1000).toFixed(2)} unit="N·m" />
            <Row label="Shaft bending moment" value={r.shaftMoment_Nm.toFixed(1)} unit="N·m" />
            <div className="mt-2 text-[9px] text-zinc-500 bg-blue-500/5 border border-blue-500/15 rounded p-2 leading-relaxed">
              Formula: F = k × W × t² × 1000 &nbsp;|&nbsp; Total = F × N stands<br />
              k-Factor: {r.mat.k} (material forming constant) &nbsp;|&nbsp; SF: {safetyFactor}×
            </div>
          </div>
        </SectionCard>

        {/* ── MOTOR ── */}
        <SectionCard title="2. Motor Selection" icon={<Zap className="w-3.5 h-3.5 text-green-400" />} color="green">
          <div className={iCls}>
            <Row label="Ideal power" value={r.powerIdeal_kW.toFixed(2)} unit="kW" />
            <Row label="Required power (with SF)" value={r.powerRequired_kW.toFixed(2)} unit="kW" />
            <Row label="Required power" value={r.powerRequired_HP.toFixed(1)} unit="HP" />
            <div className="my-1 h-px bg-white/[0.06]" />
            <Row label="✅ Recommended Motor" value={`${r.motor.hp} HP / ${r.motor.kw} kW`} highlight />
            <Row label="Motor Speed" value={`${r.motor.rpm}`} unit="RPM" />
            <Row label="Roll Speed (calculated)" value={r.rollRPM.toFixed(1)} unit="RPM" />
            <div className="mt-2 flex flex-wrap gap-1">
              {MOTOR_SIZES.filter(m => m.kw >= r.powerRequired_kW * 0.8 && m.kw <= r.powerRequired_kW * 4).map(m => (
                <span key={m.hp} className={`px-2 py-0.5 rounded text-[9px] border ${m.kw === r.motor.kw ? "bg-green-500/25 border-green-500/50 text-green-300 font-bold" : "bg-zinc-800/40 border-zinc-700/30 text-zinc-500"}`}>
                  {m.hp} HP / {m.kw} kW
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-[9px] text-zinc-500 bg-green-500/5 border border-green-500/15 rounded p-2 leading-relaxed">
              P = (F × v) / 60000 kW &nbsp;|&nbsp; Roll RPM = (1000 × v) / (π × D)<br />
              Always use VFD (Variable Frequency Drive) for smooth start and speed control
            </div>
          </div>
        </SectionCard>

        {/* ── GEARBOX ── */}
        <SectionCard title="3. Gearbox / Drive System" icon={<Cog className="w-3.5 h-3.5 text-violet-400" />} color="violet">
          <div className={iCls}>
            <Row label="Roll RPM" value={r.rollRPM.toFixed(1)} unit="RPM" />
            <Row label="Motor RPM" value={`${motorRPM}`} unit="RPM" />
            <Row label="Ideal gear ratio" value={`${r.gearRatioIdeal.toFixed(2)} : 1`} />
            <Row label="✅ Standard ratio" value={`${r.gearRatioStd} : 1`} highlight
              warn={r.gearRatioStd < 10 || r.gearRatioStd > 80} />
            <div className="my-1 h-px bg-white/[0.06]" />
            <Row label="Output torque (at roll)" value={r.outputTorque_Nm.toFixed(1)} unit="N·m" />
            <Row label="Input torque (at motor)" value={r.inputTorque_Nm.toFixed(1)} unit="N·m" />
            <div className="mt-2 flex flex-wrap gap-1">
              {STD_RATIOS.map(ratio => (
                <span key={ratio} className={`px-2 py-0.5 rounded text-[9px] border ${ratio === r.gearRatioStd ? "bg-violet-500/25 border-violet-500/50 text-violet-300 font-bold" : Math.abs(ratio - r.gearRatioIdeal) < 5 ? "bg-violet-500/10 border-violet-500/20 text-violet-400" : "bg-zinc-800/40 border-zinc-700/30 text-zinc-600"}`}>
                  {ratio}:1
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-[9px] text-zinc-500 bg-violet-500/5 border border-violet-500/15 rounded p-2 leading-relaxed">
              Ratio = Motor RPM / Roll RPM &nbsp;|&nbsp; Output Torque = 9550 × kW / Roll RPM<br />
              Practical range: 10:1 to 50:1 &nbsp;|&nbsp; Size gearbox for 1.5× rated torque
            </div>
          </div>
        </SectionCard>

        {/* ── BEARING ── */}
        <SectionCard title="4. Bearing Selection" icon={<Shield className="w-3.5 h-3.5 text-amber-400" />} color="amber">
          <div className={iCls}>
            <Row label="Design force total" value={r.designForce_kN.toFixed(2)} unit="kN" />
            <Row label="Bearings (2 shafts × per stand)" value={`${2 * bearingsPerStand} per stand`} />
            <Row label="Radial load per bearing" value={r.radialLoadPerBearing_kN.toFixed(3)} unit="kN" />
            <div className="my-1 h-px bg-white/[0.06]" />

            {r.bearing.recommended && (
              <>
                <div className="mt-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-300">Recommended Bearing</span>
                    <StatusBadge ok={r.bearing.safetyRatio >= 2} text={`C/P = ${r.bearing.safetyRatio.toFixed(1)} : 1`} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <span className="text-[8px] text-zinc-600">Bearing Number</span>
                      <div className="text-lg font-black text-amber-300">{r.bearing.recommended.code}</div>
                      <div className="text-[9px] text-zinc-500">{r.bearing.recommended.brand}</div>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-600">Type</span>
                      <div className="text-[11px] font-bold text-zinc-300 mt-0.5">{r.bearing.recommended.type}</div>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-600">Dimensions (d × D × B)</span>
                      <div className="text-[11px] font-bold text-zinc-200 mt-0.5">
                        {r.bearing.recommended.bore} × {r.bearing.recommended.OD} × {r.bearing.recommended.B} mm
                      </div>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-600">Dynamic Load C</span>
                      <div className="text-[11px] font-bold text-zinc-200 mt-0.5">{r.bearing.recommended.C} kN</div>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-600">Static Load C₀</span>
                      <div className="text-[11px] font-bold text-zinc-200 mt-0.5">{r.bearing.recommended.C0} kN</div>
                    </div>
                    <div>
                      <span className="text-[8px] text-zinc-600">L10 Life</span>
                      <div className={`text-[11px] font-bold mt-0.5 ${r.bearing.life >= 30000 ? "text-green-400" : r.bearing.life >= 15000 ? "text-amber-400" : "text-red-400"}`}>
                        {r.bearing.life.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} hrs
                        {r.bearing.life >= 30000 ? " ✓" : " ⚠"}
                      </div>
                    </div>
                  </div>
                </div>

                {r.bearing.alternate && (
                  <div className="mt-1.5 bg-zinc-900/60 border border-zinc-700/40 rounded p-2">
                    <div className="text-[9px] text-zinc-500 mb-1">Alternate (Heavy Load)</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-zinc-400">{r.bearing.alternate.code}</span>
                      <span className="text-[9px] text-zinc-600">{r.bearing.alternate.type}</span>
                      <span className="text-[9px] text-zinc-600">{r.bearing.alternate.bore}×{r.bearing.alternate.OD}mm</span>
                      <span className="text-[9px] text-zinc-600">C={r.bearing.alternate.C} kN</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-1.5 text-[9px] text-zinc-500 bg-amber-500/5 border border-amber-500/15 rounded p-2 leading-relaxed">
              L10 = (C/P)³ × 10⁶ / (60 × n) hours &nbsp;|&nbsp; Target: 30,000 hrs minimum<br />
              Deep Groove → general use &nbsp;|&nbsp; Cylindrical NU → heavy radial &nbsp;|&nbsp; Tapered → combined loads
            </div>
          </div>
        </SectionCard>

        {/* ── SHAFT CHECK ── */}
        <div className={`rounded-xl border p-3 ${r.shaftSafe ? "border-green-500/25 bg-green-500/5" : "border-red-500/35 bg-red-500/8"}`}>
          <div className="flex items-center gap-2 mb-2">
            {r.shaftSafe
              ? <CheckCircle className="w-4 h-4 text-green-400" />
              : <AlertTriangle className="w-4 h-4 text-red-400" />}
            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">5. Shaft Stress Check (C45 Steel)</span>
            <StatusBadge ok={r.shaftSafe} text={r.shaftSafe ? "SAFE" : "OVERLOADED"} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <div className="text-[8px] text-zinc-600">Shaft Diameter</div>
              <div className="text-[13px] font-black text-zinc-200">{shaftDia} mm</div>
            </div>
            <div>
              <div className="text-[8px] text-zinc-600">Bending Stress</div>
              <div className={`text-[13px] font-black ${r.shaftSafe ? "text-green-300" : "text-red-400"}`}>
                {r.shaftStress_MPa.toFixed(1)} MPa
              </div>
            </div>
            <div>
              <div className="text-[8px] text-zinc-600">Safe Limit (C45)</div>
              <div className="text-[13px] font-black text-zinc-400">80 MPa</div>
            </div>
          </div>
          {!r.shaftSafe && (
            <div className="mt-2 text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
              ⚠ Shaft ki diameter badhaao — {shaftDia + 10} mm ya {shaftDia + 20} mm try karo
            </div>
          )}
        </div>

        {/* ── SUMMARY CARD ── */}
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-3">
          <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">Quick Summary — Specification Sheet</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
              <div className="text-[8px] text-zinc-500">Total Force</div>
              <div className="text-[16px] font-black text-blue-300">{r.designForce_kN.toFixed(1)}</div>
              <div className="text-[8px] text-zinc-500">kN</div>
            </div>
            <div className="text-center bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              <div className="text-[8px] text-zinc-500">Motor</div>
              <div className="text-[16px] font-black text-green-300">{r.motor.hp}</div>
              <div className="text-[8px] text-zinc-500">HP</div>
            </div>
            <div className="text-center bg-violet-500/10 border border-violet-500/20 rounded-lg p-2">
              <div className="text-[8px] text-zinc-500">Gear Ratio</div>
              <div className="text-[16px] font-black text-violet-300">{r.gearRatioStd}</div>
              <div className="text-[8px] text-zinc-500">: 1</div>
            </div>
            <div className="text-center bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
              <div className="text-[8px] text-zinc-500">Bearing</div>
              <div className="text-[14px] font-black text-amber-300">{r.bearing.recommended?.code || "—"}</div>
              <div className="text-[8px] text-zinc-500">{r.bearing.recommended?.type?.split(" ")[0]}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
