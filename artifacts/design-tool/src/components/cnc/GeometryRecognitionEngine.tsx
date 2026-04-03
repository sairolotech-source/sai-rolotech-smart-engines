import React, { useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  CheckCircle2, AlertTriangle, XCircle, AlertOctagon,
  Layers, RotateCcw, Maximize2, Eye, Zap, ArrowLeftRight
} from "lucide-react";

type DifficultyLevel = "easy" | "medium" | "complex" | "expert";
type RiskLevel = "none" | "low" | "medium" | "high";

interface BendInfo {
  angle: number;
  type: "right-angle" | "acute" | "obtuse" | "flat";
}

interface GeometryResult {
  bendCount: number;
  bends: BendInfo[];
  rightAngleCount: number;
  acuteCount: number;
  obtuseCount: number;
  isSymmetric: boolean;
  isClosed: boolean;
  hasLip: boolean;
  webWidth: number;
  maxFlangeHeight: number;
  difficultyLevel: DifficultyLevel;
  difficultyScore: number;
  recommendedStations: number;
  risks: {
    springback: RiskLevel;
    twist: RiskLevel;
    edgeWave: RiskLevel;
    cracking: RiskLevel;
    overloading: RiskLevel;
  };
  riskNotes: string[];
  tips: string[];
}

const SPRINGBACK_FACTORS: Record<string, number> = {
  GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15,
  MS: 1.06, CU: 1.08, TI: 1.25, PP: 1.06, HSLA: 1.14,
};

const MIN_RADIUS_MULT: Record<string, number> = {
  GI: 1.0, CR: 1.0, HR: 1.5, SS: 1.5, AL: 0.8,
  MS: 1.0, CU: 0.5, TI: 2.0, PP: 1.0, HSLA: 1.5,
};

function analyzeBendType(angle: number): BendInfo["type"] {
  if (angle >= 85 && angle <= 95) return "right-angle";
  if (angle < 85) return "acute";
  if (angle > 95 && angle <= 170) return "obtuse";
  return "flat";
}

function analyzeGeometry(
  stations: ReturnType<typeof useCncStore.getState>["stations"],
  materialType: string,
  materialThickness: number,
  bendRadius: number
): GeometryResult {
  const allBendAngles: number[] = [];
  for (const st of stations) {
    for (const angle of st.bendAngles) {
      if (angle > 0) allBendAngles.push(angle);
    }
  }

  const bends: BendInfo[] = allBendAngles.map(a => ({
    angle: a,
    type: analyzeBendType(a),
  }));

  const bendCount = bends.length;
  const rightAngleCount = bends.filter(b => b.type === "right-angle").length;
  const acuteCount = bends.filter(b => b.type === "acute").length;
  const obtuseCount = bends.filter(b => b.type === "obtuse").length;

  const leftAngles = allBendAngles.filter((_, i) => i % 2 === 0);
  const rightAngles = allBendAngles.filter((_, i) => i % 2 === 1);
  const leftSum = leftAngles.reduce((s, a) => s + a, 0);
  const rightSum = rightAngles.reduce((s, a) => s + a, 0);
  const isSymmetric = Math.abs(leftSum - rightSum) < 15 && leftAngles.length === rightAngles.length;

  const isClosed = allBendAngles.reduce((s, a) => s + a, 0) >= 340;
  const hasLip = acuteCount > 0 || (bendCount >= 6 && rightAngleCount >= 4);

  const webWidth = materialThickness * 10;
  const maxFlangeHeight = materialThickness * 8;

  let score = 0;
  score += Math.min(bendCount * 8, 40);
  score += acuteCount * 12;
  score += (isClosed ? 20 : 0);
  score += (!isSymmetric ? 10 : 0);
  score += (obtuseCount * 4);

  let difficultyLevel: DifficultyLevel;
  if (score < 25) difficultyLevel = "easy";
  else if (score < 50) difficultyLevel = "medium";
  else if (score < 75) difficultyLevel = "complex";
  else difficultyLevel = "expert";

  const baseStations = 6;
  const stationMult = { easy: 1.0, medium: 1.5, complex: 2.0, expert: 2.8 }[difficultyLevel];
  const recommendedStations = Math.max(6, Math.round(baseStations + bendCount * stationMult));

  const sbFactor = SPRINGBACK_FACTORS[materialType] ?? 1.05;
  const minRadiusMult = MIN_RADIUS_MULT[materialType] ?? 1.0;
  const minAllowedRadius = materialThickness * minRadiusMult;

  const risks: GeometryResult["risks"] = {
    springback: sbFactor >= 1.20 ? "high" : sbFactor >= 1.12 ? "medium" : "low",
    twist: !isSymmetric ? (acuteCount > 0 ? "high" : "medium") : "low",
    edgeWave: (maxFlangeHeight / materialThickness > 10) ? "high" : (maxFlangeHeight / materialThickness > 7) ? "medium" : "low",
    cracking: bendRadius < minAllowedRadius ? "high" : bendRadius < minAllowedRadius * 1.5 ? "medium" : "low",
    overloading: (bendCount > 12) ? "high" : (bendCount > 8) ? "medium" : "low",
  };

  const riskNotes: string[] = [];
  if (risks.springback === "high") riskNotes.push(`High springback (${materialType} = ${sbFactor}×) — add ${Math.round((sbFactor - 1) * 100)}% overbend compensation`);
  if (risks.twist === "high") riskNotes.push("Asymmetric profile — twist risk high. Use side roll guides in first 3 stations");
  if (risks.twist === "medium") riskNotes.push("Slight asymmetry detected — monitor camber during setup");
  if (risks.edgeWave === "high") riskNotes.push("Flange height/thickness ratio > 10 — edge wave likely. Add pre-flange pass");
  if (risks.cracking === "high") riskNotes.push(`Bend radius ${bendRadius.toFixed(1)}mm < minimum ${minAllowedRadius.toFixed(1)}mm for ${materialType} — CRACKING RISK`);
  if (risks.overloading === "high") riskNotes.push("High bend count — verify machine tonnage rating for full forming load");
  if (isClosed) riskNotes.push("Closed section detected — special entry/exit tooling required. Flower must close symmetrically");
  if (hasLip) riskNotes.push("Lip/return detected — add dedicated pre-lip forming pass before final station");
  if (acuteCount > 0) riskNotes.push(`${acuteCount} acute bend(s) detected — maximum 8° per station pass for acute bends`);

  const tips: string[] = [];
  if (difficultyLevel === "easy") tips.push("Simple profile — linear angle progression works well. 12-15° per pass.");
  if (difficultyLevel === "medium") tips.push("Use progressive (non-linear) forming. Heavier bends in middle stations.");
  if (difficultyLevel === "complex") tips.push("Calibration passes needed in last 2 stations. Consider side rolls.");
  if (difficultyLevel === "expert") tips.push("Consult experienced roll forming engineer. Simulation required before tooling order.");
  if (isSymmetric) tips.push("Symmetric profile — form both sides simultaneously for best stability.");
  else tips.push("Asymmetric — form the higher flange first to control twist.");

  return {
    bendCount, bends, rightAngleCount, acuteCount, obtuseCount,
    isSymmetric, isClosed, hasLip, webWidth, maxFlangeHeight,
    difficultyLevel, difficultyScore: score, recommendedStations,
    risks, riskNotes, tips,
  };
}

const DIFFICULTY_CONFIG = {
  easy:    { label: "Easy",    color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> },
  medium:  { label: "Medium",  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30",     icon: <AlertTriangle className="w-5 h-5 text-amber-400" /> },
  complex: { label: "Complex", color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30",   icon: <XCircle className="w-5 h-5 text-orange-400" /> },
  expert:  { label: "Expert",  color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",         icon: <AlertOctagon className="w-5 h-5 text-red-400" /> },
};

const RISK_COLORS: Record<RiskLevel, { text: string; bg: string; label: string }> = {
  none:   { text: "text-gray-400",    bg: "bg-gray-800",           label: "None" },
  low:    { text: "text-emerald-400", bg: "bg-emerald-500/10",     label: "Low" },
  medium: { text: "text-amber-400",   bg: "bg-amber-500/10",       label: "Medium" },
  high:   { text: "text-red-400",     bg: "bg-red-500/10",         label: "HIGH" },
};

export function GeometryRecognitionEngine() {
  const { stations, materialType, materialThickness, bendRadius } = useCncStore();

  const result = useMemo(() => {
    if (!stations || stations.length === 0) return null;
    return analyzeGeometry(stations, materialType, materialThickness, bendRadius ?? 1.0);
  }, [stations, materialType, materialThickness, bendRadius]);

  if (!result) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#0f1117] text-gray-400 p-8">
        <Eye className="w-12 h-12 mb-4 text-gray-600" />
        <div className="text-lg font-semibold text-white mb-2">No Profile Loaded</div>
        <div className="text-sm text-center">Load or draw a profile first. Then return here for automatic geometry analysis.</div>
      </div>
    );
  }

  const dc = DIFFICULTY_CONFIG[result.difficultyLevel];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1117] text-white p-4 gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
          <Eye className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Geometry Recognition Engine</h2>
          <p className="text-xs text-gray-400">Auto-analysis — bend detection, difficulty classification, risk flags</p>
        </div>
        <div className="ml-auto px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-xs text-purple-300 font-mono">
          {materialType} · {materialThickness}mm
        </div>
      </div>

      {/* Difficulty Badge */}
      <div className={`rounded-xl border ${dc.bg} p-4 flex items-center gap-4`}>
        {dc.icon}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className={`text-xl font-bold ${dc.color}`}>{dc.label}</span>
            <span className="text-gray-400 text-sm">Profile Complexity</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Score: {result.difficultyScore}/100 · Recommended stations: {result.recommendedStations}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-mono text-white">{result.recommendedStations}</div>
          <div className="text-xs text-gray-400">stations</div>
        </div>
      </div>

      {/* Bend Analysis */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bend Analysis</div>
        <div className="grid grid-cols-4 gap-3 text-center mb-3">
          {[
            { label: "Total Bends", value: result.bendCount, icon: <Layers className="w-4 h-4 mx-auto" />, color: "text-white" },
            { label: "Right Angles (90°)", value: result.rightAngleCount, icon: <Maximize2 className="w-4 h-4 mx-auto" />, color: "text-blue-300" },
            { label: "Acute (<90°)", value: result.acuteCount, icon: <AlertTriangle className="w-4 h-4 mx-auto" />, color: "text-amber-300" },
            { label: "Obtuse (>90°)", value: result.obtuseCount, icon: <RotateCcw className="w-4 h-4 mx-auto" />, color: "text-purple-300" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-white/5 rounded-lg p-3">
              <div className={`text-gray-400 mb-1`}>{icon}</div>
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1 leading-tight">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { label: "Symmetry", value: result.isSymmetric ? "Symmetric ✓" : "Asymmetric ⚠", color: result.isSymmetric ? "text-emerald-400" : "text-amber-400" },
            { label: "Section Type", value: result.isClosed ? "Closed Section" : "Open Section", color: result.isClosed ? "text-purple-400" : "text-blue-400" },
            { label: "Lip / Return", value: result.hasLip ? "Detected ⚠" : "Not Detected ✓", color: result.hasLip ? "text-amber-400" : "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/5 rounded-lg p-2">
              <div className="text-gray-500 mb-0.5">{label}</div>
              <div className={`font-semibold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Matrix */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Risk Assessment Matrix</div>
        <div className="space-y-2">
          {[
            { label: "Springback Risk", risk: result.risks.springback, icon: <RotateCcw className="w-4 h-4" /> },
            { label: "Twist Risk", risk: result.risks.twist, icon: <ArrowLeftRight className="w-4 h-4" /> },
            { label: "Edge Wave Risk", risk: result.risks.edgeWave, icon: <Layers className="w-4 h-4" /> },
            { label: "Cracking Risk", risk: result.risks.cracking, icon: <XCircle className="w-4 h-4" /> },
            { label: "Overloading Risk", risk: result.risks.overloading, icon: <Zap className="w-4 h-4" /> },
          ].map(({ label, risk, icon }) => {
            const rc = RISK_COLORS[risk];
            return (
              <div key={label} className="flex items-center gap-3">
                <div className={`${rc.text} w-4 flex-shrink-0`}>{icon}</div>
                <div className="flex-1 text-sm text-gray-300">{label}</div>
                <div className={`px-3 py-0.5 rounded-full text-xs font-semibold ${rc.bg} ${rc.text}`}>
                  {rc.label}
                </div>
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${
                    risk === "high" ? "w-full bg-red-500" :
                    risk === "medium" ? "w-2/3 bg-amber-500" :
                    risk === "low" ? "w-1/3 bg-emerald-500" : "w-0"
                  }`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Notes */}
      {result.riskNotes.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">⚠ Engineering Warnings</div>
          <ul className="space-y-2">
            {result.riskNotes.map((note, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tips */}
      {result.tips.length > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">Engineering Tips</div>
          <ul className="space-y-1.5">
            {result.tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bend Angles Detail */}
      {result.bends.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Individual Bend Details</div>
          <div className="flex flex-wrap gap-2">
            {result.bends.map((b, i) => (
              <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${
                b.type === "right-angle" ? "bg-blue-500/10 border-blue-500/30 text-blue-300" :
                b.type === "acute"       ? "bg-amber-500/10 border-amber-500/30 text-amber-300" :
                b.type === "obtuse"      ? "bg-purple-500/10 border-purple-500/30 text-purple-300" :
                "bg-white/5 border-white/10 text-gray-400"
              }`}>
                B{i + 1}: {b.angle.toFixed(1)}°
                <span className="ml-1 opacity-60">({b.type.replace("-", " ")})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">Standards Reference: </span>
        DIN 6935 · ISO 5173 · ROLLFORM INSTITUTE — Difficulty classification & risk assessment per industry best practice
      </div>

    </div>
  );
}
