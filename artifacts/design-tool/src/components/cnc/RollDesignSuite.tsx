import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Ruler, Layers2, AlertTriangle, CheckCircle2, Info, ArrowRight, Calculator, BookOpen
} from "lucide-react";

type SubTab = "od-gap" | "pass-compress" | "rules";

const MATERIAL_CLEARANCE: Record<string, { min: number; max: number; label: string }> = {
  GI:   { min: 0.05, max: 0.10, label: "GI / Galvanized" },
  CR:   { min: 0.05, max: 0.10, label: "CR Steel" },
  HR:   { min: 0.05, max: 0.10, label: "HR Steel" },
  MS:   { min: 0.05, max: 0.10, label: "Mild Steel" },
  HSLA: { min: 0.10, max: 0.15, label: "HSLA" },
  SS:   { min: 0.10, max: 0.20, label: "Stainless Steel" },
  AL:   { min: 0.05, max: 0.10, label: "Aluminium" },
  CU:   { min: 0.05, max: 0.08, label: "Copper" },
  TI:   { min: 0.10, max: 0.20, label: "Titanium" },
};

function calcRollOD(thickness: number, profileDepth: number, stations: number): {
  recommended: number; min: number; max: number; shaftMin: number; shaftMax: number;
} {
  const byThickness = thickness * 100;
  const byDepth = profileDepth * 1.5;
  const base = Math.max(byThickness, byDepth, 60);
  const stationFactor = stations <= 8 ? 1.15 : 1.0;
  const recommended = Math.round(base * stationFactor / 5) * 5;
  const min = Math.round(recommended * 0.9 / 5) * 5;
  const max = Math.round(recommended * 1.2 / 5) * 5;
  const shaftMin = recommended <= 120 ? 40 : recommended <= 180 ? 55 : 70;
  const shaftMax = shaftMin + 20;
  return { recommended, min, max, shaftMin, shaftMax };
}

function calcGap(thickness: number, matKey: string): {
  min: number; max: number; optimal: number; sideGap: number;
} {
  const clr = MATERIAL_CLEARANCE[matKey] ?? { min: 0.05, max: 0.10 };
  return {
    min: Math.round((thickness + clr.min) * 1000) / 1000,
    max: Math.round((thickness + clr.max) * 1000) / 1000,
    optimal: Math.round((thickness + (clr.min + clr.max) / 2) * 1000) / 1000,
    sideGap: 0.5,
  };
}

function calcBendAllowance(angle: number, radius: number, thickness: number, kFactor: number): number {
  return (Math.PI / 180) * angle * (radius + kFactor * thickness);
}

const PROFILE_PASSES: Record<string, { passes12: number[]; label: string }> = {
  "C-Channel": { label: "Simple C-Channel / Hat", passes12: [0, 8, 15, 22, 30, 40, 50, 60, 70, 80, 88, 90] },
  "Z-Section": { label: "Z-Section / Asymmetric", passes12: [0, 6, 12, 20, 30, 42, 55, 65, 75, 82, 87, 90] },
  "Lip-C": {    label: "Lip C / Return Flange",  passes12: [0, 8, 16, 25, 35, 45, 55, 65, 72, 80, 87, 90] },
};

function compressPasses(passes12: number[], targetN: number): { station: number; angle: number; role: string }[] {
  if (targetN >= 12) return passes12.map((a, i) => ({ station: i + 1, angle: a, role: i === 0 ? "Entry" : i >= 10 ? "Calibration" : "Forming" }));
  const result: { station: number; angle: number; role: string }[] = [];
  const n = targetN;
  const formingStations = n - 2;
  const formingAngles = passes12.filter((_, i) => i > 0 && i < 11);
  const step = formingAngles.length / formingStations;
  result.push({ station: 1, angle: 0, role: "Entry + Strip Guide" });
  for (let i = 0; i < formingStations; i++) {
    const idx = Math.min(Math.round(i * step + step * 0.5), formingAngles.length - 1);
    const baseAngle = formingAngles[idx] ?? 0;
    const overbend = i === formingStations - 1 ? 2 : 0;
    const finalAngle = Math.min(baseAngle + overbend, 92);
    let role = "Forming";
    if (i === 0) role = "Pre-form";
    else if (i >= formingStations - 2) role = "Pre-close";
    result.push({ station: i + 2, angle: finalAngle, role });
  }
  result.push({ station: n, angle: 90, role: "Sizing / Calibration" });
  return result;
}

const Row = ({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) => (
  <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/10">
    <span className="text-[10px] text-zinc-400">{label}</span>
    <span className={`text-[11px] font-mono font-semibold ${color ?? "text-zinc-200"}`}>
      {value}{unit && <span className="text-zinc-500 ml-1 text-[9px]">{unit}</span>}
    </span>
  </div>
);

const Badge = ({ color, text }: { color: string; text: string }) => (
  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${color}`}>{text}</span>
);

export function RollDesignSuite() {
  const { materialThickness: thickness, materialType, stations } = useCncStore();
  const [subTab, setSubTab] = useState<SubTab>("od-gap");
  const [profileDepth, setProfileDepth] = useState(50);
  const [kFactor, setKFactor] = useState(0.35);
  const [bendAngle, setBendAngle] = useState(90);
  const [bendRadius, setBendRadius] = useState(2.0);
  const [targetPasses, setTargetPasses] = useState(8);
  const [profileKey, setProfileKey] = useState<keyof typeof PROFILE_PASSES>("C-Channel");
  const [drawingRef, setDrawingRef] = useState<"center" | "outer" | "inner">("center");

  const od = useMemo(() => calcRollOD(thickness, profileDepth, stations.length || 10), [thickness, profileDepth, stations.length]);
  const gap = useMemo(() => calcGap(thickness, materialType), [thickness, materialType]);
  const ba = useMemo(() => calcBendAllowance(bendAngle, bendRadius, thickness, kFactor), [bendAngle, bendRadius, thickness, kFactor]);

  const matLabel = MATERIAL_CLEARANCE[materialType]?.label ?? materialType;
  const compressed = useMemo(() => {
    const profile = PROFILE_PASSES[profileKey] ?? PROFILE_PASSES["C-Channel"]!;
    return compressPasses(profile.passes12, targetPasses);
  }, [profileKey, targetPasses]);

  const stationCount = stations.length || 10;

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: "od-gap", label: "OD & Gap Designer", icon: <Ruler className="w-3.5 h-3.5" /> },
    { id: "pass-compress", label: "Pass Compressor", icon: <Layers2 className="w-3.5 h-3.5" /> },
    { id: "rules", label: "Design Rules", icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-4 pt-4 pb-0 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-bold text-zinc-200">Roll Design Suite</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">Industry Level</span>
        </div>
        <div className="flex gap-1 pb-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg border-t border-x transition-all ${
                subTab === t.id
                  ? "bg-zinc-900 border-zinc-700/60 text-violet-300"
                  : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* ─── OD & GAP ─── */}
        {subTab === "od-gap" && (
          <div className="space-y-4">
            {/* Inputs */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3">
              <div className="text-[10px] font-semibold text-zinc-400 mb-2">Input Parameters</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Profile Depth (mm)</label>
                  <input type="number" value={profileDepth} min={10} max={300} step={5}
                    onChange={e => setProfileDepth(Number(e.target.value))}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Material Thickness → Store: {thickness}mm</label>
                  <input value={thickness} readOnly
                    className="w-full bg-zinc-800/30 border border-zinc-700/20 rounded px-2 py-1 text-[11px] text-zinc-400 font-mono cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Drawing Reference</label>
                  <select value={drawingRef} onChange={e => setDrawingRef(e.target.value as "center" | "outer" | "inner")}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200">
                    <option value="center">Center Line (Neutral Axis)</option>
                    <option value="outer">Outer Profile</option>
                    <option value="inner">Inner Profile</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Stations → {stationCount}</label>
                  <input value={stationCount} readOnly
                    className="w-full bg-zinc-800/30 border border-zinc-700/20 rounded px-2 py-1 text-[11px] text-zinc-400 font-mono cursor-not-allowed" />
                </div>
              </div>
            </div>

            {/* Thickness Offset Rule */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-300">Drawing Thickness Rule (T = {thickness}mm)</span>
              </div>
              <div className="space-y-1">
                {drawingRef === "center" && (
                  <p className="text-[10px] text-zinc-300">
                    <span className="text-emerald-400 font-semibold">Center Line (✓ Roll Forming Standard):</span>{" "}
                    Offset = <span className="font-mono text-amber-300">+{(thickness/2).toFixed(2)}mm upar</span> aur{" "}
                    <span className="font-mono text-amber-300">+{(thickness/2).toFixed(2)}mm neeche</span> — dono side equal
                  </p>
                )}
                {drawingRef === "outer" && (
                  <p className="text-[10px] text-zinc-300">
                    <span className="text-red-400 font-semibold">Outer Line:</span>{" "}
                    Sirf andar ki taraf <span className="font-mono text-amber-300">{thickness}mm</span> offset karo —
                    center line <span className="font-mono text-amber-300">{(thickness/2).toFixed(2)}mm</span> andar hai
                  </p>
                )}
                {drawingRef === "inner" && (
                  <p className="text-[10px] text-zinc-300">
                    <span className="text-blue-400 font-semibold">Inner Line:</span>{" "}
                    Sirf bahar ki taraf <span className="font-mono text-amber-300">{thickness}mm</span> offset karo —
                    center line <span className="font-mono text-amber-300">{(thickness/2).toFixed(2)}mm</span> bahar hai
                  </p>
                )}
              </div>
            </div>

            {/* Roll OD Results */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-violet-500/10 border-b border-zinc-800/40 flex items-center gap-2">
                <Ruler className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[11px] font-bold text-zinc-200">Roll OD Calculator</span>
                <span className="ml-auto text-[9px] text-zinc-500">Formula: OD ≈ max(T×100, Depth×1.5)</span>
              </div>
              <Row label="Recommended Roll OD" value={`Ø${od.recommended}`} unit="mm" color="text-violet-300" />
              <Row label="Minimum Acceptable OD" value={`Ø${od.min}`} unit="mm" color="text-zinc-300" />
              <Row label="Maximum (if space allows)" value={`Ø${od.max}`} unit="mm" color="text-zinc-400" />
              <Row label="Shaft Diameter" value={`Ø${od.shaftMin} – ${od.shaftMax}`} unit="mm" color="text-cyan-300" />
              <Row label="Roll Face Width" value={`Strip Width + 5–10`} unit="mm" color="text-zinc-400" />
              <Row label="Roll Material" value="EN31 / D2 Steel" color="text-emerald-400" />
              <Row label="Hardness Required" value="58–62 HRC" color="text-emerald-400" />
              {stationCount <= 8 && (
                <div className="px-3 py-2 bg-amber-500/10 border-t border-zinc-800/40">
                  <p className="text-[10px] text-amber-300">
                    ⚠ Fewer stations (≤8) → OD 10–15% larger recommended for smoother forming per pass
                  </p>
                </div>
              )}
            </div>

            {/* Gap Results */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-cyan-500/10 border-b border-zinc-800/40 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-bold text-zinc-200">Gap Calculator — {matLabel}</span>
              </div>
              <Row label="Nominal Thickness" value={thickness.toString()} unit="mm" />
              <Row label="Vertical Gap (Min)" value={gap.min.toFixed(3)} unit="mm" color="text-emerald-300" />
              <Row label="Vertical Gap (Optimal)" value={gap.optimal.toFixed(3)} unit="mm" color="text-cyan-300" />
              <Row label="Vertical Gap (Max)" value={gap.max.toFixed(3)} unit="mm" color="text-zinc-300" />
              <Row label="Side Gap (per side)" value="0.5 – 1.0" unit="mm" color="text-amber-300" />
              <Row label="Total Side Clearance" value="1.0 – 2.0" unit="mm" color="text-zinc-400" />
              <div className="px-3 py-2 bg-zinc-800/20 border-t border-zinc-800/40">
                <p className="text-[10px] text-zinc-500">
                  Rule: Gap = T + Clearance | Mild/GI/CR: +0.05–0.10mm | Hard/SS/TI: +0.10–0.20mm
                </p>
              </div>
            </div>

            {/* Bend Allowance */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-emerald-500/10 border-b border-zinc-800/40 flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold text-zinc-200">Bend Allowance Calculator</span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2 border-b border-zinc-800/30">
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Bend Angle (°)</label>
                  <input type="number" value={bendAngle} min={1} max={180} onChange={e => setBendAngle(Number(e.target.value))}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Bend Radius (mm)</label>
                  <input type="number" value={bendRadius} min={0.1} max={50} step={0.1} onChange={e => setBendRadius(Number(e.target.value))}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">K-Factor (0.3–0.5)</label>
                  <input type="number" value={kFactor} min={0.3} max={0.5} step={0.01} onChange={e => setKFactor(Number(e.target.value))}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono" />
                </div>
              </div>
              <Row label="Bend Allowance (BA)" value={ba.toFixed(3)} unit="mm" color="text-emerald-300" />
              <Row label="Formula" value={`(π/180) × ${bendAngle}° × (${bendRadius} + ${kFactor} × ${thickness})`} color="text-zinc-500" />
              <Row label="Flat Length" value="Σ Straight Parts + Σ BA" color="text-zinc-400" />
            </div>
          </div>
        )}

        {/* ─── PASS COMPRESSOR ─── */}
        {subTab === "pass-compress" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3">
              <div className="text-[10px] font-semibold text-zinc-400 mb-2">Pass Compression Settings</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Profile Type</label>
                  <select value={profileKey} onChange={e => setProfileKey(e.target.value as keyof typeof PROFILE_PASSES)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200">
                    {Object.entries(PROFILE_PASSES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Original Passes</label>
                  <input value={12} readOnly
                    className="w-full bg-zinc-800/30 border border-zinc-700/20 rounded px-2 py-1 text-[11px] text-zinc-400 font-mono cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Target Stations</label>
                  <input type="number" value={targetPasses} min={4} max={12} onChange={e => setTargetPasses(Number(e.target.value))}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1 text-[11px] text-zinc-200 font-mono" />
                </div>
              </div>
            </div>

            {targetPasses < 8 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-red-300">
                  {targetPasses} stations is very risky. Min recommended = 8 for most profiles.
                  Per-pass strain will be very high → edge wave, twist, springback likely.
                </p>
              </div>
            )}

            {targetPasses >= 8 && targetPasses < 10 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-amber-300">
                  {targetPasses} stations — possible but careful. Bigger rolls (OD +10–15%) + slower speed + stronger guides needed.
                  Last 2 stations must be calibration, NOT bending.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-violet-500/10 border-b border-zinc-800/40 flex items-center gap-2">
                <Layers2 className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-[11px] font-bold text-zinc-200">
                  12 → {targetPasses} Pass Compression — {PROFILE_PASSES[profileKey]?.label}
                </span>
              </div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-zinc-800/30 text-zinc-400">
                    <th className="px-3 py-1.5 text-left font-semibold w-16">Station</th>
                    <th className="px-3 py-1.5 text-left font-semibold w-20">Angle</th>
                    <th className="px-3 py-1.5 text-left font-semibold">Role</th>
                    <th className="px-3 py-1.5 text-left font-semibold w-32">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {compressed.map((s) => {
                    const isEntry = s.role.includes("Entry");
                    const isCalib = s.role.includes("Calibration") || s.role.includes("Sizing");
                    const isPreclose = s.role.includes("Pre-close");
                    return (
                      <tr key={s.station} className="hover:bg-zinc-800/20">
                        <td className={`px-3 py-1.5 font-mono font-bold ${isCalib ? "text-amber-400" : isEntry ? "text-emerald-400" : "text-violet-300"}`}>
                          S{s.station}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-zinc-200">{s.angle}°</td>
                        <td className="px-3 py-1.5 text-zinc-300">{s.role}</td>
                        <td className="px-3 py-1.5">
                          {isEntry && <Badge color="bg-emerald-500/20 text-emerald-300" text="Guide" />}
                          {isPreclose && <Badge color="bg-cyan-500/20 text-cyan-300" text="Pre-close" />}
                          {isCalib && <Badge color="bg-amber-500/20 text-amber-300" text="No Bend" />}
                          {s.angle > 87 && s.angle < 93 && !isCalib && <Badge color="bg-red-500/20 text-red-300" text="+2° Overbend" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-3 py-2 bg-zinc-800/20 border-t border-zinc-800/40">
                <p className="text-[9px] text-zinc-500">
                  ⚡ Good merge: 10°+20° → 15–18° | 30°+40° → 34–36° | 50°+60° → 54–57° | Bad merge: 80°+90° never in 1 pass
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-800/30 border-b border-zinc-800/40">
                <span className="text-[11px] font-bold text-zinc-200">Client ko 3 Options do</span>
              </div>
              {[
                { label: "Option A — Best Quality", desc: `12 forming stations — lowest risk, better finish, stable production`, color: "text-emerald-400", badge: "Recommended" },
                { label: "Option B — Compromise", desc: `${targetPasses} stations + slower speed + bigger rolls (OD +15%) + calibration pass — moderate risk, trials required`, color: "text-amber-400", badge: "Possible" },
                { label: "Option C — Profile Simplify", desc: "Bend radius badhao + lip chhota karo + flange length reduce + tolerance relax karo", color: "text-blue-400", badge: "Redesign" },
              ].map(o => (
                <div key={o.label} className="px-3 py-2 border-b border-zinc-800/30 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[11px] font-semibold ${o.color}`}>{o.label}</span>
                    <Badge color={`bg-zinc-700/50 text-zinc-300`} text={o.badge} />
                  </div>
                  <p className="text-[10px] text-zinc-400">{o.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── DESIGN RULES ─── */}
        {subTab === "rules" && (
          <div className="space-y-3">
            {[
              {
                title: "Roll OD Rules", color: "violet",
                rules: [
                  "T 0.5–1mm → OD 80–120mm",
                  "T 1–2mm → OD 120–180mm",
                  "T 2–3mm → OD 180–250mm",
                  "Approx formula: OD ≈ T × 100 mm",
                  "Zyada profile depth → OD bada karo",
                  "Fewer stations → OD +10–15% bada karo",
                  "Upper roll = same ya slightly smaller OD",
                  "Lower roll = main support (heavier/stable)",
                ],
              },
              {
                title: "Gap Design Rules", color: "cyan",
                rules: [
                  "Vertical gap = Material Thickness + Clearance",
                  "Mild Steel / GI / CR: Clearance = +0.05 to +0.10mm",
                  "Hard / SS / TI: Clearance = +0.10 to +0.20mm",
                  "Side gap per side = 0.5mm (small profile) to 1.0mm (big)",
                  "Total side clearance = 1.0–2.0mm",
                  "T=0.8mm GI → Gap = 0.85–0.90mm",
                  "Gap too tight = tool damage + marking",
                  "Gap too loose = poor forming + wave",
                ],
              },
              {
                title: "Pass Compression Rules", color: "amber",
                rules: [
                  "3 zones: Entry/Preform | Main Bending | Closing/Calibration",
                  "Last 2 stations = calibration ONLY (no main bending)",
                  "S7 me thoda overbend (88–92°) — springback correction",
                  "S8 = sizing / calibration / straightening",
                  "Good merge: 10°+20° → ~15°, 30°+40° → ~34°",
                  "BAD merge: 80°+90° KABHI EK PASS ME NAHI",
                  "Lip wale profiles me lip late stations me form karo (S5–S7)",
                  "Kam passes → bigger rolls + stronger guides + slower speed",
                ],
              },
              {
                title: "When 12→8 POSSIBLE", color: "emerald",
                rules: [
                  "Material: Mild steel, GI, CR (soft)",
                  "Thickness: Thin to medium (0.5–1.5mm)",
                  "Profile: Simple C, shallow hat, symmetric",
                  "Bends: Few, smooth, radius generous",
                  "No lip / return lip",
                  "Machine: Rigid, accurate, good guides",
                  "Client: Accepts slightly slower speed",
                ],
              },
              {
                title: "When 12→8 RISKY / NOT RECOMMENDED", color: "red",
                rules: [
                  "AHSS / High-tensile / Stainless steel",
                  "Asymmetrical profile (Z-section etc.)",
                  "Deep C / Z / Hat / Omega with long flange",
                  "Small inside radii",
                  "Lips / return lips zyada",
                  "Perforated / pre-cut / pre-notched strip",
                  "Cosmetic surface critical",
                  "Very low scrap tolerance",
                ],
              },
              {
                title: "Roll Material & Surface", color: "violet",
                rules: [
                  "Roll material: EN31 or D2 steel (forged)",
                  "Hardness: 58–62 HRC after heat treatment",
                  "Surface finish: Mirror finish (Ra ≤ 0.4 μm) = better product",
                  "Roll face width = Strip Width + 5–10mm extra",
                  "Upper & lower rolls: perfectly parallel alignment",
                  "Misalignment → wave, twist, marking on product",
                  "Shaft: OD 100–150mm roll → shaft 40–60mm dia",
                  "Heavy profile → shaft 70–90mm dia",
                ],
              },
            ].map(section => (
              <div key={section.title} className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                <div className={`px-3 py-2 border-b border-zinc-800/40 bg-${section.color}-500/10`}>
                  <span className={`text-[11px] font-bold text-${section.color}-300`}>{section.title}</span>
                </div>
                <div className="p-2 grid grid-cols-1 gap-0.5">
                  {section.rules.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 px-1 py-0.5">
                      <ArrowRight className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                      <span className="text-[10px] text-zinc-300">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
