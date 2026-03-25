import React, { useMemo, useState } from "react";
import { useCncStore } from "../../store/useCncStore";
import { AlertTriangle, TrendingUp, ArrowLeftRight, Waves, Minimize2, Fingerprint, BarChart2, ChevronDown, ChevronRight } from "lucide-react";

interface DefectRisk {
  id: string;
  defect: string;
  icon: React.ReactNode;
  risk: "none" | "low" | "medium" | "high" | "critical";
  probability: number;
  causes: string[];
  prevention: string[];
  detection: string;
}

const SPRINGBACK_MAP: Record<string, number> = {
  GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15,
  MS: 1.06, CU: 1.08, TI: 1.25, PP: 1.06, HSLA: 1.14,
};

const YIELD_MAP: Record<string, number> = {
  GI: 280, CR: 340, HR: 250, SS: 310, AL: 270,
  MS: 250, CU: 200, TI: 880, PP: 280, HSLA: 550,
};

function predictDefects(
  materialType: string,
  thickness: number,
  minT: number,
  maxT: number,
  bendRadius: number,
  numStations: number,
): DefectRisk[] {
  const sb = SPRINGBACK_MAP[materialType] ?? 1.05;
  const yld = YIELD_MAP[materialType] ?? 280;
  const defects: DefectRisk[] = [];
  const rOverT = bendRadius / thickness;
  const thicknessRatio = minT > 0 ? maxT / minT : 1.0;
  const avgAnglePerPass = 90 / Math.max(numStations - 1, 1);

  let twistProb = 0;
  if (sb >= 1.20) twistProb += 40;
  else if (sb >= 1.12) twistProb += 20;
  else twistProb += 5;
  if (yld > 500) twistProb += 15;
  if (numStations < 6) twistProb += 10;
  twistProb = Math.min(twistProb, 95);

  defects.push({
    id: "D001", defect: "Twist",
    icon: <ArrowLeftRight className="w-5 h-5" />,
    risk: twistProb >= 60 ? "critical" : twistProb >= 40 ? "high" : twistProb >= 20 ? "medium" : "low",
    probability: twistProb,
    causes: [
      sb >= 1.15 ? `High springback (${sb}×) creates uneven stress release` : "Springback within normal range",
      yld > 500 ? `High yield strength (${yld} MPa) amplifies residual stress` : "Yield strength manageable",
      "Asymmetric profile geometry can worsen twist",
      "Unbalanced left-right forming sequence"
    ].filter(Boolean),
    prevention: [
      "Use symmetric forming sequence (both flanges rise equally per station)",
      "Add twist correction rolls at exit section",
      `Apply ${((sb - 1) * 100).toFixed(0)}% springback compensation at every station`,
      "Consider post-forming straightening pass",
    ],
    detection: "Visual inspection at exit — rotate profile 360° and check for spiral deviation",
  });

  let edgeWaveProb = 0;
  if (thickness < 0.6) edgeWaveProb += 30;
  else if (thickness < 1.0) edgeWaveProb += 15;
  if (avgAnglePerPass > 15) edgeWaveProb += 20;
  if (rOverT < 1.5) edgeWaveProb += 15;
  if (yld > 400) edgeWaveProb += 10;
  edgeWaveProb = Math.min(edgeWaveProb, 95);

  defects.push({
    id: "D002", defect: "Edge Wave",
    icon: <Waves className="w-5 h-5" />,
    risk: edgeWaveProb >= 50 ? "critical" : edgeWaveProb >= 35 ? "high" : edgeWaveProb >= 15 ? "medium" : "low",
    probability: edgeWaveProb,
    causes: [
      thickness < 1.0 ? `Thin material (${thickness}mm) susceptible to edge buckling` : "Thickness adequate",
      avgAnglePerPass > 15 ? `Aggressive forming (${avgAnglePerPass.toFixed(1)}°/pass) stretches edges` : "Pass angle progression OK",
      "Longitudinal edge stress exceeds compressive limit",
      "Wide flange relative to thickness amplifies effect",
    ],
    prevention: [
      "Reduce pass angle increment (add more stations)",
      "Use soft progression (slow start, gradual increase)",
      "Add edge guide rolls to constrain flange edges",
      "Consider edge pre-conditioning (slight tension)",
    ],
    detection: "Run straight edge along flange edge — wave amplitude > 1mm/meter indicates problem",
  });

  let flareProb = 0;
  if (sb >= 1.15) flareProb += 25;
  if (rOverT < 1.0) flareProb += 20;
  if (numStations < 5) flareProb += 15;
  if (yld > 400) flareProb += 10;
  flareProb = Math.min(flareProb, 95);

  defects.push({
    id: "D003", defect: "Flare (End Spread)",
    icon: <TrendingUp className="w-5 h-5" />,
    risk: flareProb >= 50 ? "critical" : flareProb >= 35 ? "high" : flareProb >= 15 ? "medium" : "low",
    probability: flareProb,
    causes: [
      sb >= 1.15 ? `High springback (${sb}×) causes flanges to open at cut ends` : "Springback manageable",
      "Insufficient overbend at final stations",
      "Cut-off stress release causes dimensional change",
      "Residual longitudinal stress in flanges",
    ],
    prevention: [
      "Apply extra overbend at last 2 stations (flare compensation)",
      "Use rotary shear instead of flying die for cut-off",
      "Add calibration pass after final forming station",
      "Consider post-cut re-striking at critical dimensions",
    ],
    detection: "Measure flange angle at cut end vs 200mm inside — difference > 1° indicates flare",
  });

  let wrinkleProb = 0;
  if (thickness < 0.5) wrinkleProb += 35;
  else if (thickness < 0.8) wrinkleProb += 15;
  if (rOverT < 1.0) wrinkleProb += 20;
  if (avgAnglePerPass > 18) wrinkleProb += 15;
  wrinkleProb = Math.min(wrinkleProb, 95);

  defects.push({
    id: "D004", defect: "Wrinkling",
    icon: <Minimize2 className="w-5 h-5" />,
    risk: wrinkleProb >= 50 ? "critical" : wrinkleProb >= 30 ? "high" : wrinkleProb >= 15 ? "medium" : "low",
    probability: wrinkleProb,
    causes: [
      thickness < 0.8 ? `Thin gauge (${thickness}mm) has low buckling resistance` : "Thickness OK for buckling",
      rOverT < 1.0 ? `Tight bend R/T ratio (${rOverT.toFixed(1)}) creates compressive stress on inside` : "R/T ratio adequate",
      "Compressive stress on inner radius exceeds critical buckling load",
      "Long unsupported web sections amplify effect",
    ],
    prevention: [
      "Increase bend radius to at least 1.5× thickness",
      "Add pressure rolls or ironing rolls at bend zones",
      "Reduce forming speed for thin gauges",
      "Use mandrel support for internal bends on thin material",
    ],
    detection: "Visual: ripples or puckers at bend interior. Tactile: run finger along inside of bend",
  });

  let markingProb = 0;
  if (materialType === "SS" || materialType === "AL" || materialType === "PP") markingProb += 30;
  if (thickness < 0.8) markingProb += 15;
  if (avgAnglePerPass > 15) markingProb += 10;
  markingProb = Math.min(markingProb, 95);

  defects.push({
    id: "D005", defect: "Surface Marking / Scratching",
    icon: <Fingerprint className="w-5 h-5" />,
    risk: markingProb >= 50 ? "high" : markingProb >= 25 ? "medium" : "low",
    probability: markingProb,
    causes: [
      (materialType === "SS" || materialType === "AL" || materialType === "PP")
        ? `${materialType} has decorative/coated surface — very sensitive to marking` : "Material surface not critical",
      "Roll surface roughness transfers to strip",
      "Debris or scale on rolls causes scratching",
      "Excessive forming pressure on flat sections",
    ],
    prevention: [
      "Polish rolls to Ra ≤ 0.4 μm for decorative materials",
      "Use protective film on strip (PE film for SS/AL)",
      "Apply roll forming lubricant — avoid dry forming",
      "Keep rolls clean — regular wipe-down during production",
      "Use chrome-plated or nitrided rolls for abrasive materials",
    ],
    detection: "Visual inspection under angled light. For coated materials, check coating adhesion at bend zones.",
  });

  let camberProb = 0;
  if (thicknessRatio > 1.20) camberProb += 25;
  if (sb >= 1.12) camberProb += 15;
  if (yld > 400) camberProb += 10;
  camberProb = Math.min(camberProb, 95);

  defects.push({
    id: "D006", defect: "Camber (Bow / Sweep)",
    icon: <BarChart2 className="w-5 h-5" />,
    risk: camberProb >= 45 ? "high" : camberProb >= 25 ? "medium" : "low",
    probability: camberProb,
    causes: [
      thicknessRatio > 1.20 ? `Wide thickness range (${thicknessRatio.toFixed(2)}×) creates uneven forming` : "Thickness range OK",
      "Unequal residual stress across width",
      "Coil set from raw material not corrected",
      "Asymmetric profile with unequal flange lengths",
    ],
    prevention: [
      "Use straightener/leveler before forming",
      "Balance forming forces left-right",
      "Add camber correction rolls after forming",
      "Adjust roll gaps precisely — even 0.05mm difference matters",
    ],
    detection: "Place profile on flat surface — measure gap at center. Max bow: 1mm per meter length.",
  });

  let overFormProb = 0;
  if (avgAnglePerPass > 20) overFormProb += 30;
  if (rOverT < 1.0) overFormProb += 20;
  if (numStations < 5) overFormProb += 15;
  overFormProb = Math.min(overFormProb, 95);

  defects.push({
    id: "D007", defect: "Local Over-Forming",
    icon: <AlertTriangle className="w-5 h-5" />,
    risk: overFormProb >= 50 ? "critical" : overFormProb >= 30 ? "high" : overFormProb >= 15 ? "medium" : "low",
    probability: overFormProb,
    causes: [
      avgAnglePerPass > 20 ? `Very aggressive pass angle (${avgAnglePerPass.toFixed(1)}°/pass)` : "Pass angles OK",
      rOverT < 1.0 ? `Very tight bend (R/T = ${rOverT.toFixed(1)})` : "Bend ratio adequate",
      "Too much forming in single pass exceeds material ductility",
      "First/last stations carry disproportionate forming load",
    ],
    prevention: [
      "Use gradual progression — no single station > 15° for most materials",
      "Add idle/calibration stations between heavy forming passes",
      "Use pre-notching for complex features that require sharp bends",
      "Monitor forming force per station — should be roughly uniform",
    ],
    detection: "Measure actual angle at each station — compare to design. Deviation > 2° indicates over-forming.",
  });

  return defects;
}

const RISK_CONFIG = {
  none:     { bg: "bg-gray-500/10",    border: "border-gray-500/20",    text: "text-gray-400",    bar: "bg-gray-500" },
  low:      { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", bar: "bg-emerald-500" },
  medium:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   bar: "bg-amber-500" },
  high:     { bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-400",  bar: "bg-orange-500" },
  critical: { bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-400",     bar: "bg-red-500" },
};

function DefectCard({ defect }: { defect: DefectRisk }) {
  const [open, setOpen] = useState(defect.risk === "high" || defect.risk === "critical");
  const cfg = RISK_CONFIG[defect.risk];

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <span className={cfg.text}>{defect.icon}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
        <span className="flex-1 text-sm text-white font-medium">{defect.defect}</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${defect.probability}%` }} />
          </div>
          <span className={`text-xs font-bold font-mono ${cfg.text}`}>{defect.probability}%</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
            {defect.risk.toUpperCase()}
          </span>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-400 mb-1.5">Root Causes</div>
            <ul className="space-y-1">
              {defect.causes.map((c, i) => (
                <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                  <span className="text-gray-600 mt-0.5">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-400 mb-1.5">Prevention Measures</div>
            <ul className="space-y-1">
              {defect.prevention.map((p, i) => (
                <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                  <span className="text-emerald-600 mt-0.5">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <span className="text-xs font-semibold text-blue-400">Detection Method: </span>
            <span className="text-xs text-gray-400">{defect.detection}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function DefectPredictionEngine() {
  const { materialType, materialThickness, minThickness, maxThickness, bendRadius, numStations } = useCncStore();

  const defects = useMemo(() =>
    predictDefects(materialType, materialThickness, minThickness, maxThickness, bendRadius, numStations),
    [materialType, materialThickness, minThickness, maxThickness, bendRadius, numStations]
  );

  const sortedDefects = useMemo(() =>
    [...defects].sort((a, b) => b.probability - a.probability),
    [defects]
  );

  const highRiskCount = defects.filter(d => d.risk === "high" || d.risk === "critical").length;
  const avgRisk = Math.round(defects.reduce((s, d) => s + d.probability, 0) / defects.length);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1117] text-white p-4 gap-4">

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${highRiskCount > 0 ? "bg-red-600/20 border-red-500/30" : "bg-emerald-600/20 border-emerald-500/30"} border flex items-center justify-center`}>
          <AlertTriangle className={`w-5 h-5 ${highRiskCount > 0 ? "text-red-400" : "text-emerald-400"}`} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Defect Prediction Engine</h2>
          <p className="text-xs text-gray-400">Rule-based forming defect risk assessment — {defects.length} defect types analyzed</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">{materialType}</span>
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">T={materialThickness}mm</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 text-center ${highRiskCount > 0 ? "border-red-500/30 bg-red-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
          <div className="text-xs text-gray-400 mb-1">Risk Defects</div>
          <div className={`text-3xl font-bold font-mono ${highRiskCount > 0 ? "text-red-400" : "text-emerald-400"}`}>{highRiskCount}</div>
          <div className="text-xs text-gray-500">of {defects.length} types</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">Average Risk</div>
          <div className={`text-3xl font-bold font-mono ${avgRisk >= 40 ? "text-red-400" : avgRisk >= 25 ? "text-amber-400" : "text-emerald-400"}`}>{avgRisk}%</div>
          <div className="text-xs text-gray-500">probability</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">Top Risk</div>
          <div className={`text-lg font-bold ${RISK_CONFIG[sortedDefects[0]?.risk ?? "low"].text}`}>
            {sortedDefects[0]?.defect ?? "—"}
          </div>
          <div className="text-xs text-gray-500 font-mono">{sortedDefects[0]?.probability ?? 0}%</div>
        </div>
      </div>

      <div className="space-y-3">
        {sortedDefects.map(d => <DefectCard key={d.id} defect={d} />)}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">Method: </span>
        Rule-based heuristic analysis. Probability scores are indicative — actual risk depends on machine condition,
        coil quality, operator skill, and environmental factors. For critical applications, validate with trial run.
      </div>
    </div>
  );
}
