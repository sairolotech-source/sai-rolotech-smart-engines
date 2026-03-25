import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Cpu, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Lightbulb,
  ShieldCheck, ShieldAlert, ShieldX, Loader2,
} from "lucide-react";
import { useCncStore, type DesignScoreSubScore } from "../../store/useCncStore";
import { useAccuracyScoring } from "../../hooks/useAccuracyScoring";

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-red-400";
}

function scoreRingColor(score: number) {
  if (score >= 85) return "#22c55e";
  if (score >= 70) return "#f59e0b";
  return "#ef4444";
}

function gradeLabel(grade: string) {
  const map: Record<string, string> = {
    A: "Excellent", B: "Good", C: "Fair", D: "Poor", F: "Critical",
  };
  return map[grade] ?? grade;
}

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = scoreRingColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
          <circle
            cx="55" cy="55" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
          />
          <circle
            cx="55" cy="55" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-extrabold tabular-nums ${scoreColor(score)}`} style={{ lineHeight: 1 }}>
            {score}
          </span>
          <span className="text-[10px] text-zinc-500 mt-0.5 font-medium">/ 100</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full border"
          style={{ color, borderColor: `${color}40`, background: `${color}15` }}
        >
          Grade {grade}
        </span>
        <span className={`text-[11px] ${scoreColor(score)}`}>{gradeLabel(grade)}</span>
      </div>
    </div>
  );
}

function SubScoreBar({ sub }: { sub: DesignScoreSubScore }) {
  const [expanded, setExpanded] = useState(false);
  const hasTips = sub.tips && sub.tips.length > 0;

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => hasTips && setExpanded(e => !e)}
        className={`w-full text-left ${hasTips ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-zinc-400 truncate">{sub.dimension}</span>
            {sub.weight !== undefined && (
              <span className="text-[9px] text-zinc-600 flex-shrink-0">×{sub.weight}%</span>
            )}
            {hasTips && (
              <span className="flex-shrink-0">
                {expanded
                  ? <ChevronUp className="w-2.5 h-2.5 text-zinc-600" />
                  : <ChevronDown className="w-2.5 h-2.5 text-zinc-600" />
                }
              </span>
            )}
          </div>
          <span className={`text-[10px] font-semibold tabular-nums ml-2 flex-shrink-0 ${scoreColor(sub.score)}`}>
            {sub.score}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              sub.score >= 85 ? "bg-emerald-500" : sub.score >= 70 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${sub.score}%` }}
          />
        </div>
        {sub.value && (
          <p className="text-[9px] text-zinc-600 mt-0.5 truncate">{sub.value}</p>
        )}
      </button>
      {expanded && hasTips && (
        <div className="pl-2 space-y-1 pt-1">
          {sub.tips!.map((tip, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <Lightbulb className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-200/80 leading-snug">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildDesignPayload(state: ReturnType<typeof useCncStore.getState>) {
  const {
    materialType, materialThickness, numStations, lineSpeed,
    rollDiameter, shaftDiameter, stations, rollTooling, rollGaps,
  } = state;

  const flowerStation = stations[0];
  const recommendedStations = flowerStation ? Math.max(numStations, stations.length) : numStations;
  const totalBends = stations.length > 0
    ? stations[stations.length - 1]?.bendAngles?.length ?? 0
    : 0;
  const K_FACTOR_MAP: Record<string, number> = {
    GI: 0.44, CR: 0.44, HR: 0.42, SS: 0.50, AL: 0.43,
    MS: 0.44, CU: 0.44, TI: 0.50, PP: 0.44, HSLA: 0.45,
  };
  const kFactor = K_FACTOR_MAP[materialType] ?? 0.44;
  const maxThinningRatio = stations.length > 0 ? 0.93 : 1.0;
  const springbackFactor: Record<string, number> = {
    GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15, MS: 1.06,
    PP: 1.06, TI: 1.25, CU: 1.08, HSLA: 1.14,  // FIX: PP 1.05→1.06, TI 1.30→1.25, CU 1.03→1.08, HSLA 1.18→1.14 (per useCncStore canonical values)
  };

  const firstRoll = rollTooling[0]?.rollProfile;
  const grooveDepth = firstRoll?.grooveDepth ?? 0;
  const rollGapNominal  = rollGaps[0]?.nominalGap ?? -1;
  const rollGapSpringback = rollGaps[0]?.springbackGap ?? -1;

  const calibrationPassCount = stations.filter(s => s.isCalibrationPass).length;
  const stationData = stations.map(s => ({
    bendAngles: s.bendAngles ?? [],
    thinningRatio: 0.93,
  }));

  const avgBendAnglePerStation = stationData.length > 0
    ? stationData.reduce((sum, s) => sum + s.bendAngles.reduce((a: number, b: number) => a + Math.abs(b), 0), 0) / stationData.length
    : 0;

  return {
    materialType,
    thickness: materialThickness,
    numStations,
    recommendedStations,
    totalBends,
    kFactor,
    maxThinningRatio,
    springbackFactor: springbackFactor[materialType] ?? 1.05,
    lineSpeed,
    rollDiameter,
    shaftDiameter,
    grooveDepth,
    profileComplexity: totalBends >= 5 ? "complex" : "simple",
    avgBendAnglePerStation,
    stationData,
    calibrationPassCount,
    rollGapNominal,
    rollGapSpringback,
  };
}

export function AIDesignScore() {
  const store = useCncStore();
  const { designScore, materialType, materialThickness, numStations, lineSpeed, stations, rollTooling } = store;
  const { scoreDesign } = useAccuracyScoring();

  const [showTips, setShowTips] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runScore = useCallback(async () => {
    const payload = buildDesignPayload(useCncStore.getState());
    await scoreDesign(payload);
  }, [scoreDesign]);

  const debouncedScore = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runScore();
    }, 1200);
  }, [runScore]);

  useEffect(() => {
    debouncedScore();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [materialType, materialThickness, numStations, lineSpeed, stations.length, rollTooling.length]);

  const isLoading = designScore?.isLoading ?? false;
  const rawScore = designScore?.overallScore ?? null;
  const score = rawScore !== null && rawScore >= 0 ? rawScore : null;
  const grade = designScore?.grade ?? "F";

  return (
    <div className="rt-card border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
          score === null ? "bg-zinc-600" :
          score >= 85 ? "bg-emerald-400" :
          score >= 70 ? "bg-amber-400" : "bg-red-400"
        }`} />
        <Cpu className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[11px] font-semibold text-zinc-300 flex-1 text-left">AI Design Score</span>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
          {score !== null && !isLoading && (
            <span className={`text-[11px] font-bold tabular-nums ${scoreColor(score)}`}>
              {score}% · {grade}
            </span>
          )}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-white/[0.06]">
          {isLoading && score === null ? (
            <div className="px-4 py-6 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <p className="text-[11px] text-zinc-500">Calculating design score…</p>
            </div>
          ) : score === null ? (
            <div className="px-4 py-6 text-center">
              <Cpu className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-500">No design score yet</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                Set material, thickness, and stations to compute a design quality score
              </p>
              <button
                onClick={runScore}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold
                           text-blue-400 bg-blue-500/10 border border-blue-500/20
                           hover:bg-blue-500/20 transition-all mx-auto"
              >
                <RefreshCw className="w-3 h-3" /> Score Design
              </button>
            </div>
          ) : (
            <div className="px-3 pb-3 space-y-3">
              {/* Score Gauge */}
              <div className="flex flex-col items-center pt-3 pb-1">
                <ScoreGauge score={score} grade={grade} />
              </div>

              {/* Sub-score bars */}
              {designScore!.subScores.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Sub-Scores</p>
                  {designScore!.subScores.map((sub, i) => (
                    <SubScoreBar key={i} sub={sub as DesignScoreSubScore} />
                  ))}
                </div>
              )}

              {/* Warnings */}
              {designScore!.warnings.length > 0 && (
                <div className="space-y-1">
                  {designScore!.warnings.slice(0, 3).map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 px-2 py-1 rounded bg-amber-500/8 border border-amber-500/15">
                      <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-300 leading-tight">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Improvement tips — expandable */}
              {designScore!.improvementTips.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowTips(t => !t)}
                    className="flex items-center gap-1.5 text-[10px] text-amber-400/80 hover:text-amber-300 transition-colors"
                  >
                    <Lightbulb className="w-3 h-3" />
                    {showTips ? "Hide" : "Show"} improvement tips ({designScore!.improvementTips.length})
                    {showTips ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                  </button>
                  {showTips && (
                    <div className="mt-2 space-y-1.5">
                      {designScore!.improvementTips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-blue-500/6 border border-blue-500/12">
                          <Lightbulb className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
                          <p className="text-[10px] text-blue-200/80 leading-snug">{tip}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                <span className="text-[9px] text-zinc-600">
                  {designScore?.timestamp ? new Date(designScore.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                </span>
                <button
                  onClick={runScore}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium
                             text-blue-400 bg-blue-500/8 border border-blue-500/15
                             hover:bg-blue-500/15 transition-all disabled:opacity-50"
                >
                  {isLoading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RefreshCw className="w-3 h-3" />
                  }
                  Rescore
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
