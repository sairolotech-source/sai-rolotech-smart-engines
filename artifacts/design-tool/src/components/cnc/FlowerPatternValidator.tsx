import React, { useState, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";

interface ValidationIssue {
  stationIdx: number;
  stationLabel: string;
  severity: "error" | "warning" | "info";
  category: string;
  message: string;
  fix: string;
}

interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  stationResults: { label: string; status: "pass" | "warn" | "fail" }[];
  summary: string;
}

const SPRINGBACK: Record<string, number> = { GI: 0.05, CR: 0.08, HR: 0.12, SS: 0.20, AL: 0.15, MS: 0.06 };
const MIN_RADIUS: Record<string, number> = { GI: 1.0, CR: 0.5, HR: 1.5, SS: 2.0, AL: 1.0, MS: 0.8 };
const MAX_ANGLE_PER_STATION = 15;

function runValidation(stations: ReturnType<typeof useCncStore.getState>["stations"], materialType: string, thickness: number): ValidationResult {
  const issues: ValidationIssue[] = [];
  const stationResults: { label: string; status: "pass" | "warn" | "fail" }[] = [];
  const sb = SPRINGBACK[materialType] ?? 0.08;
  const minR = MIN_RADIUS[materialType] ?? 1.0;
  const minRadius = minR * thickness;

  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    let stationFailed = false;
    let stationWarned = false;

    // 1. Angle continuity — each station should progress smoothly
    if (i > 0) {
      const prevSt = stations[i - 1];
      const prevTotal = prevSt.totalAngle;
      const currTotal = st.totalAngle;
      const delta = Math.abs(currTotal - prevTotal);
      const maxDelta = MAX_ANGLE_PER_STATION * (st.bendAngles.length || 1);
      if (delta > maxDelta * (Math.PI / 180) * 1.2) {
        issues.push({
          stationIdx: i, stationLabel: st.label, severity: "error",
          category: "Angle Progression",
          message: `Angle jump from Station ${prevSt.label} to ${st.label} is too large (${(delta * 180 / Math.PI).toFixed(1)}° — max ${maxDelta}°)`,
          fix: `Add intermediate station between ${prevSt.label} and ${st.label} to distribute the angle change`,
        });
        stationFailed = true;
      }
    }

    // 2. Bend angle per station > 15°
    for (let bi = 0; bi < st.bendAngles.length; bi++) {
      const angleDeg = Math.abs(st.bendAngles[bi]) * (180 / Math.PI);
      if (angleDeg > MAX_ANGLE_PER_STATION) {
        issues.push({
          stationIdx: i, stationLabel: st.label, severity: "warning",
          category: "Bend Increment",
          message: `Station ${st.label} Bend #${bi + 1}: angle per pass is ${angleDeg.toFixed(1)}° (max recommended: ${MAX_ANGLE_PER_STATION}°)`,
          fix: `Reduce bend angle increment — add extra stations or split into sub-passes`,
        });
        stationWarned = true;
      }
    }

    // 3. Springback compensation check
    if (st.springbackAngles) {
      const totalAngleDeg = Math.abs(st.totalAngle) * (180 / Math.PI);
      const springbackCompensation = totalAngleDeg * sb;
      const hasSpringbackComp = st.springbackAngles.some(a => Math.abs(a) > 0.01);
      if (!hasSpringbackComp && i === stations.length - 1 && springbackCompensation > 1) {
        issues.push({
          stationIdx: i, stationLabel: st.label, severity: "warning",
          category: "Springback",
          message: `Final station ${st.label}: springback compensation of +${springbackCompensation.toFixed(1)}° (${(sb * 100).toFixed(0)}% for ${materialType}) not applied`,
          fix: `Apply ${(sb * 100).toFixed(0)}% overbend at calibration stations for ${materialType} to hit target angle`,
        });
        stationWarned = true;
      }
    }

    // 4. Check segment lengths for potential overlap
    for (let si = 0; si < st.segmentLengths.length; si++) {
      if (st.segmentLengths[si] < 0.1) {
        issues.push({
          stationIdx: i, stationLabel: st.label, severity: "error",
          category: "Overlap / Geometry",
          message: `Station ${st.label} Segment #${si + 1}: length ${st.segmentLengths[si].toFixed(3)} mm is near zero — possible overlap`,
          fix: `Check profile geometry at station ${st.label} — adjacent segments may overlap. Reduce bend angle or increase radius`,
        });
        stationFailed = true;
      }
    }

    // 5. Inner radius vs material minimum
    for (const seg of st.segments) {
      if (seg.type === "arc" && seg.radius !== undefined && seg.radius < minRadius) {
        issues.push({
          stationIdx: i, stationLabel: st.label, severity: "error",
          category: "Minimum Bend Radius",
          message: `Station ${st.label}: arc radius ${seg.radius.toFixed(2)} mm < minimum ${minRadius.toFixed(2)} mm for ${materialType}`,
          fix: `Increase inner bend radius to at least ${minRadius.toFixed(1)} mm (${minR}×t for ${materialType})`,
        });
        stationFailed = true;
        break;
      }
    }

    stationResults.push({
      label: st.label,
      status: stationFailed ? "fail" : stationWarned ? "warn" : "pass",
    });
  }

  // Check final station angles match full profile
  const lastStation = stations[stations.length - 1];
  if (lastStation) {
    const finalTotalDeg = Math.abs(lastStation.totalAngle) * (180 / Math.PI);
    if (finalTotalDeg < 1 && stations.length > 1) {
      issues.push({
        stationIdx: stations.length - 1, stationLabel: lastStation.label, severity: "warning",
        category: "Final Station",
        message: `Final station has very low total angle (${finalTotalDeg.toFixed(1)}°) — may not fully form profile`,
        fix: `Ensure final calibration station fully closes all bends to design angle`,
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warnCount = issues.filter(i => i.severity === "warning").length;
  const passed = errorCount === 0;
  const score = Math.max(0, 100 - errorCount * 15 - warnCount * 5);

  const summary = passed
    ? `✅ Power pattern validated — ${stations.length} stations, ${warnCount > 0 ? warnCount + " warning(s)" : "all clear"}`
    : `❌ ${errorCount} error(s) found — fix before manufacturing`;

  return { passed, score, issues, stationResults, summary };
}

export function FlowerPatternValidator() {
  const { stations, materialType, materialThickness } = useCncStore();
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [running, setRunning] = useState(false);

  const validate = useCallback(() => {
    if (stations.length === 0) return;
    setRunning(true);
    setTimeout(() => {
      const r = runValidation(stations, materialType, materialThickness);
      setResult(r);
      setRunning(false);
    }, 600);
  }, [stations, materialType, materialThickness]);

  if (stations.length === 0) return null;

  return (
    <div className="mt-3 border border-white/[0.07] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.02]">
        <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">AI Flower Validator</span>
        <button
          onClick={validate}
          disabled={running}
          className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
          {running ? "Validating..." : "Run Validation"}
        </button>
      </div>

      {result && (
        <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">
          {/* Score */}
          <div className={`p-2.5 rounded-lg border ${result.passed ? "bg-emerald-950/20 border-emerald-500/30" : "bg-red-950/20 border-red-500/30"}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">{result.summary}</span>
              <span className={`text-lg font-black font-mono ${result.score >= 90 ? "text-emerald-400" : result.score >= 70 ? "text-amber-400" : "text-red-400"}`}>
                {result.score}%
              </span>
            </div>
          </div>

          {/* Station Results Row */}
          <div className="flex flex-wrap gap-1.5">
            {result.stationResults.map((sr) => (
              <div key={sr.label} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono
                ${sr.status === "pass" ? "bg-emerald-900/30 text-emerald-300 border border-emerald-500/20" :
                  sr.status === "warn" ? "bg-amber-900/30 text-amber-300 border border-amber-500/20" :
                  "bg-red-900/30 text-red-300 border border-red-500/20"}`}>
                {sr.status === "pass" ? "✓" : sr.status === "warn" ? "⚠" : "✕"}
                {" "}{sr.label}
              </div>
            ))}
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Issues Found</div>
              {result.issues.map((issue, i) => (
                <div key={i} className={`p-2 rounded-lg border text-[10px] space-y-1
                  ${issue.severity === "error" ? "bg-red-950/20 border-red-500/20" :
                    issue.severity === "warning" ? "bg-amber-950/20 border-amber-500/20" :
                    "bg-blue-950/20 border-blue-500/20"}`}>
                  <div className="flex items-center gap-1.5">
                    {issue.severity === "error" ? <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" /> :
                     issue.severity === "warning" ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" /> :
                     <CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                    <span className={`font-semibold ${issue.severity === "error" ? "text-red-300" : issue.severity === "warning" ? "text-amber-300" : "text-blue-300"}`}>
                      [{issue.category}] {issue.stationLabel}
                    </span>
                  </div>
                  <div className="text-zinc-300">{issue.message}</div>
                  <div className="text-emerald-300/80 italic">Fix: {issue.fix}</div>
                </div>
              ))}
            </div>
          )}

          {result.issues.length === 0 && (
            <div className="text-center text-xs text-emerald-400 py-2">
              ✅ All stations passed validation — power pattern is ready for manufacturing
            </div>
          )}
        </div>
      )}
    </div>
  );
}
