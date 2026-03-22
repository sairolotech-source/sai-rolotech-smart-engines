import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Ruler, Layers2, AlertTriangle, CheckCircle2, Info, ArrowRight, Calculator, BookOpen, Cog
} from "lucide-react";

type SubTab = "od-gap" | "pass-compress" | "station-rolls" | "rules";

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

interface StationRollData {
  station: string;
  name: string;
  angle: string;
  lowerDesc: string;
  upperDesc: string;
  designLogic: string;
  sketchType: "flat" | "light" | "first-bend" | "mid" | "main" | "pre-close" | "close" | "calibrate";
}

const STATION_ROLL_DATA: StationRollData[] = [
  {
    station: "S1", name: "Entry / Trap Pass", angle: "0°",
    lowerDesc: "Almost flat support surface. Beech me web support, side par halka locating shoulder / shallow groove.",
    upperDesc: "Mostly flat ya very shallow matching land. Purpose: bend dena nahi, strip ko seat karna.",
    designLogic: "Yeh station 'forming' se zyada centering ka hota hai. Entry guide + first pass trap milkar strip ko square rakhte hain. Agar yahan strip off-center ghusi, to aage sari line me problem snowball hogi.",
    sketchType: "flat",
  },
  {
    station: "S2", name: "Light Preform", angle: "10–15°",
    lowerDesc: "Web seat flat rahegi. Dono edges par halka utha hua radius/ramp. Flange ko 10–15° start karne ke liye side pockets.",
    upperDesc: "Edge ke upar se light touch dene wali contour. Poore bend ko crush nahi karegi — sirf strip ko 'invite' karegi ki edge uthe.",
    designLogic: "Is station me edge ko bas jagao, force mat karo. Entry ke turant baad aggressive forming → wandering aur marking badhegi.",
    sketchType: "light",
  },
  {
    station: "S3", name: "First Real Bend", angle: "25–30°",
    lowerDesc: "Web abhi bhi stable flat support par. Side contour ab deeper — flange angle 25–30° tak lane ke liye smooth radius.",
    upperDesc: "Matching male contour jo edge ko niche se lower contour ke against guide kare. Contact line smooth honi chahiye, point contact nahi.",
    designLogic: "Actual forming start. Upper-lower rolls ko aisa socho ki material ko pakad ke modne ke bajay flow karne de rahe ho.",
    sketchType: "first-bend",
  },
  {
    station: "S4", name: "Mid Forming", angle: "40–45°",
    lowerDesc: "Side walls clearly shape dene lagenge. Web pocket defined hoga. Bend radius consistent rakho.",
    upperDesc: "Lower ke opposite support. Edges ko bend line par support. Web par unnecessary pressure nahi.",
    designLogic: "Common galti: web ko unnecessarily pinch kar dena → marks ya tracking issue. Focus bend line ke around support par hona chahiye.",
    sketchType: "mid",
  },
  {
    station: "S5", name: "Main Forming", angle: "55–65°",
    lowerDesc: "Section shape close to channel dikhegi. Web floor fixed. Flanges ke liye deeper side groove.",
    upperDesc: "Flange outer side ko support dene wala contour. Bend radius area me smooth wrap. Side relief rakho.",
    designLogic: "Yahin se roll fight ya interference ka risk badhta hai. Contour mismatch ho to strip pull, marks aur twist aane lagte hain.",
    sketchType: "main",
  },
  {
    station: "S6", name: "Pre-Close Pass", angle: "75–82°",
    lowerDesc: "Almost full channel support. Web pocket exact width ke paas. Near-vertical contour for flanges.",
    upperDesc: "Flange outside ko controlled push. Top corners par relief zaroor. Sharp corner collision check zaroori.",
    designLogic: "Critical station. Yahin flare, twist aur springback behavior clearly dekhne lagta hai. Alignment + bearing condition strongly affect karti hai.",
    sketchType: "pre-close",
  },
  {
    station: "S7", name: "Close / Slight Overbend", angle: "90–92°",
    lowerDesc: "Final channel cavity ke very close. Web width almost final. Side walls final angle ke paas.",
    upperDesc: "Matching contour jo flange ko 90° ya slight overbend 91–92° tak le ja sake. Contour crisp ho sakta hai, knife-edge bilkul nahi.",
    designLogic: "Springback ko dekhte hue slight overbend useful. Stronger materials me springback zyada hoti hai — final angle running trial se set hota hai.",
    sketchType: "close",
  },
  {
    station: "S8", name: "Calibration / Sizing", angle: "90° (lock)",
    lowerDesc: "Final cavity. Web width + corner radius lock. Side walls full support.",
    upperDesc: "Final top restraint. Angle hold + squareness correction. Very controlled contact.",
    designLogic: "Sirf 'last bend' mat samjho — ye SIZING station hai. Yahan part ki final width, straightness, twist correction aur repeatability lock hoti hai.",
    sketchType: "calibrate",
  },
];

const GOLDEN_RULES = [
  { title: "1. Web ko stable rakho", desc: "Har station me web ke liye ek clear support philosophy honi chahiye. Web kabhi flat, kabhi floating, kabhi pinch me aa gaya → tracking + marks dono badhenge." },
  { title: "2. Bend line ke paas support do", desc: "Forming ka target bend zone hai. Poore strip ko crush karne se quality improve nahi hoti — incremental = controlled local deformation." },
  { title: "3. Side relief zaroor do", desc: "Jab flange close hota hai, upper-lower roll shoulders ke paas mechanical collision ka risk. CAD overlay me station-wise minimum clearance check karo." },
  { title: "4. Early soft, late tight", desc: "S2–S3 me profile ko gently start karo. S6–S8 me contour closer aur more controlling ho sakta hai. Yehi smooth progression defects kam karta hai." },
  { title: "5. S7 aur S8 ko alag kaam do", desc: "S7 = close / overbend. S8 = size / calibrate. Dono ko ek hi hard pass me combine karne se repeatability kharab ho sakti hai." },
  { title: "6. Entry guides ko ignore mat karo", desc: "Agar entry guide weak hai to best rolls bhi stable product nahi denge. Proper roll forming ki shuruaat entry guide se hoti hai." },
  { title: "7. Mill alignment check karo", desc: "Base level, shaft parallelism, shoulder alignment, entry table aur side units ki alignment — misalignment se twist, poor tracking repeated issues aate hain." },
];

function RollStationSketch({ type, w, h }: { type: StationRollData["sketchType"]; w: number; h: number }) {
  const cx = w / 2;
  const upperCy = h * 0.22;
  const lowerCy = h * 0.68;
  const rU = h * 0.14;
  const rL = h * 0.16;
  const stripY = h * 0.45;
  const c = "#6366f1";
  const cU = "#818cf8";
  const cL = "#a78bfa";
  const cStrip = "#f59e0b";

  const flangeAngle = type === "flat" ? 0 : type === "light" ? 15 : type === "first-bend" ? 28 : type === "mid" ? 42 : type === "main" ? 60 : type === "pre-close" ? 78 : 90;
  const webW = w * 0.28;
  const flangeLen = h * 0.18;
  const rad = (a: number) => (a * Math.PI) / 180;
  const fDx = Math.sin(rad(flangeAngle)) * flangeLen;
  const fDy = -Math.cos(rad(flangeAngle)) * flangeLen;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="mx-auto">
      <rect width={w} height={h} fill="#09090b" rx="4" />
      <text x={cx} y={14} textAnchor="middle" fill="#71717a" fontSize="9" fontFamily="monospace">
        {type === "flat" ? "Entry — flat" : type === "calibrate" ? "Final sizing fit" : `~${flangeAngle}° forming`}
      </text>

      <ellipse cx={cx} cy={upperCy} rx={rU * 1.3} ry={rU} fill="none" stroke={cU} strokeWidth="1.5" opacity="0.6" />
      <text x={cx} y={upperCy + 3} textAnchor="middle" fill={cU} fontSize="8" fontFamily="monospace">Upper</text>

      {type === "flat" ? (
        <rect x={cx - webW} y={lowerCy - rL * 0.15} width={webW * 2} height={rL * 0.3} rx="2" fill="none" stroke={cL} strokeWidth="1.5" opacity="0.6" />
      ) : type === "calibrate" || type === "close" ? (
        <path d={`M${cx - webW * 0.7} ${lowerCy - flangeLen * 0.9} L${cx - webW * 0.7} ${lowerCy + rL * 0.15} L${cx + webW * 0.7} ${lowerCy + rL * 0.15} L${cx + webW * 0.7} ${lowerCy - flangeLen * 0.9}`}
          fill="none" stroke={cL} strokeWidth="1.5" opacity="0.6" />
      ) : (
        <>
          <line x1={cx - webW} y1={lowerCy} x2={cx + webW} y2={lowerCy} stroke={cL} strokeWidth="1.5" opacity="0.6" />
          <line x1={cx - webW} y1={lowerCy} x2={cx - webW - fDx * 0.6} y2={lowerCy + fDy * 0.6} stroke={cL} strokeWidth="1.5" opacity="0.6" />
          <line x1={cx + webW} y1={lowerCy} x2={cx + webW + fDx * 0.6} y2={lowerCy + fDy * 0.6} stroke={cL} strokeWidth="1.5" opacity="0.6" />
        </>
      )}
      <text x={cx} y={lowerCy + rL * 0.45} textAnchor="middle" fill={cL} fontSize="8" fontFamily="monospace">Lower</text>

      <line x1={cx - webW * 1.2} y1={stripY} x2={cx - webW} y2={stripY} stroke={cStrip} strokeWidth="1.8" strokeDasharray="3,2" />
      <line x1={cx - webW} y1={stripY} x2={cx + webW} y2={stripY} stroke={cStrip} strokeWidth="1.8" />
      <line x1={cx + webW} y1={stripY} x2={cx + webW * 1.2} y2={stripY} stroke={cStrip} strokeWidth="1.8" strokeDasharray="3,2" />
      {flangeAngle > 5 && (
        <>
          <line x1={cx - webW} y1={stripY} x2={cx - webW - fDx * 0.55} y2={stripY + fDy * 0.55} stroke={cStrip} strokeWidth="1.8" />
          <line x1={cx + webW} y1={stripY} x2={cx + webW + fDx * 0.55} y2={stripY + fDy * 0.55} stroke={cStrip} strokeWidth="1.8" />
        </>
      )}
      <text x={cx} y={stripY - 5} textAnchor="middle" fill={cStrip} fontSize="7" fontFamily="monospace" opacity="0.7">strip</text>

      <line x1={w - 25} y1={stripY + 4} x2={w - 25} y2={stripY + 4 + flangeLen * 0.5} stroke="#555" strokeWidth="0.8" />
      {flangeAngle > 5 && (
        <>
          <line x1={w - 25} y1={stripY + 4} x2={w - 25 - fDx * 0.3} y2={stripY + 4 + fDy * 0.3} stroke={c} strokeWidth="0.8" />
          <text x={w - 12} y={stripY + 14} fill="#888" fontSize="7" fontFamily="monospace">{flangeAngle}°</text>
        </>
      )}
    </svg>
  );
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
    { id: "station-rolls", label: "Station Roll Guide", icon: <Cog className="w-3.5 h-3.5" /> },
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

        {/* ─── STATION ROLL GUIDE ─── */}
        {subTab === "station-rolls" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-300">C-Channel Example — Web 40mm, Flange 20+20mm, T=0.8mm, 8 Stations, Mild Steel</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                Har station me upper + lower rolls ka kaam milkar 3 cheeze karta hai: (1) Strip ko guide karna, (2) Shape ko thoda-thoda bend karna, (3) Final stations me angle + width lock karna.
                Roll forming incremental process hai — ek hi pass me zyada hard bend = unstable.
              </p>
            </div>

            {STATION_ROLL_DATA.map((sd) => (
              <div key={sd.station} className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                <div className="px-3 py-2 bg-violet-500/10 border-b border-zinc-800/40 flex items-center gap-2">
                  <span className="text-[12px] font-mono font-bold text-violet-300">{sd.station}</span>
                  <span className="text-[11px] font-semibold text-zinc-200">{sd.name}</span>
                  <span className="ml-auto text-[10px] font-mono text-cyan-400">{sd.angle}</span>
                </div>
                <div className="grid grid-cols-[180px_1fr] gap-0">
                  <div className="p-2 border-r border-zinc-800/30 flex items-center justify-center bg-zinc-950/50">
                    <RollStationSketch type={sd.sketchType} w={170} h={110} />
                  </div>
                  <div className="divide-y divide-zinc-800/30">
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">Lower Roll</span>
                      </div>
                      <p className="text-[10px] text-zinc-300">{sd.lowerDesc}</p>
                    </div>
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold">Upper Roll</span>
                      </div>
                      <p className="text-[10px] text-zinc-300">{sd.upperDesc}</p>
                    </div>
                    <div className="px-3 py-2 bg-zinc-800/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">Design Logic</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 italic">{sd.designLogic}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-300">7 Golden Rules — Roll Contour Design</span>
              </div>
              <div className="divide-y divide-zinc-800/30">
                {GOLDEN_RULES.map((rule, i) => (
                  <div key={i} className="px-3 py-2">
                    <div className="text-[11px] font-semibold text-zinc-200 mb-0.5">{rule.title}</div>
                    <p className="text-[10px] text-zinc-400">{rule.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[11px] font-bold text-red-300">Sabse Badi Practical Mistake</span>
              </div>
              <p className="text-[10px] text-zinc-300">
                Final profile ko har station me copy karke bas thoda-thoda close karna → <span className="text-red-400 font-semibold">GALAT</span>.
              </p>
              <p className="text-[10px] text-zinc-400 mt-1">
                Sahi approach: (1) Metal line socho (2) Support zones socho (3) Non-contact zones socho (4) Relief socho (5) Springback socho — warna roll ban jayega, line stable nahi chalegi.
              </p>
            </div>

            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-cyan-500/10 border-b border-zinc-800/40 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-bold text-zinc-200">CAD Workflow — AutoCAD Roll Design</span>
              </div>
              <div className="p-2 space-y-0.5">
                {[
                  "1. Final profile banao",
                  "2. Flower progression nikalo",
                  "3. Har station ka intermediate section banao",
                  "4. Us section ke hisab se lower roll cavity socho",
                  "5. Upper roll ko mating support contour do",
                  "6. Side relief aur non-contact zones mark karo",
                  "7. Station overlay karke interference check karo",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1">
                    <ArrowRight className="w-3 h-3 text-cyan-500 shrink-0" />
                    <span className="text-[10px] text-zinc-300">{step}</span>
                  </div>
                ))}
              </div>
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
