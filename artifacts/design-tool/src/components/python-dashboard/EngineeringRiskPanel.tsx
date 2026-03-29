/**
 * EngineeringRiskPanel.tsx — Per-station engineering risk visualization
 * Displays bend severity index, edge buckling risk, twist risk,
 * calibration need, and deformation confidence per forming sequence.
 * All values labeled: [Formula] [Rule] [Estimate] [Table]
 * Sai Rolotech Smart Engines v2.4.0
 */
import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Zap,
  BarChart2, RefreshCw, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import HelpTooltip from "@/components/ui/HelpTooltip";

interface PassData {
  pass_no:          number;
  stage_type:       string;
  target_angle_deg: number;
  roll_gap_mm:      number;
  strip_width_mm:   number;
  forming_depth_mm: number;
}

interface Props {
  passes:             PassData[];
  material:           string;
  thickness:          number;
  sectionHeight:      number;
  sectionWidth:       number;
  isSymmetric?:       boolean;
  hasCalibrationPass?: boolean;
  bendRadius?:        number;
  className?:         string;
}

type RiskLevel = "OK" | "CAUTION" | "WARNING" | "CRITICAL";

const RISK_COLOR: Record<RiskLevel, string> = {
  OK:       "text-emerald-400",
  CAUTION:  "text-yellow-400",
  WARNING:  "text-orange-400",
  CRITICAL: "text-red-400",
};

const RISK_BG: Record<RiskLevel, string> = {
  OK:       "bg-emerald-900/30 border-emerald-700/40",
  CAUTION:  "bg-yellow-900/30 border-yellow-700/40",
  WARNING:  "bg-orange-900/30 border-orange-700/40",
  CRITICAL: "bg-red-900/30 border-red-700/40",
};

const RISK_BAR: Record<RiskLevel, string> = {
  OK:       "bg-emerald-500",
  CAUTION:  "bg-yellow-500",
  WARNING:  "bg-orange-500",
  CRITICAL: "bg-red-500",
};

function RiskIcon({ level }: { level: RiskLevel }) {
  if (level === "OK")       return <ShieldCheck size={13} className="text-emerald-400" />;
  if (level === "CAUTION")  return <Info size={13} className="text-yellow-400" />;
  if (level === "WARNING")  return <AlertTriangle size={13} className="text-orange-400" />;
  return <ShieldAlert size={13} className="text-red-400" />;
}

function ScoreBar({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all ${RISK_BAR[level]}`}
        style={{ width: `${(score / 10) * 100}%` }}
      />
    </div>
  );
}

export function EngineeringRiskPanel({
  passes, material, thickness, sectionHeight, sectionWidth,
  isSymmetric = true, hasCalibrationPass = true, bendRadius, className = "",
}: Props) {
  const [report, setReport]       = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState(true);
  const [showPasses, setShowPasses] = useState(false);

  const runAnalysis = useCallback(async () => {
    if (!passes || passes.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/papi/api/engineering-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passes,
          material,
          thickness_mm:      thickness,
          section_height_mm: sectionHeight,
          section_width_mm:  sectionWidth,
          is_symmetric:      isSymmetric,
          has_calibration_pass: hasCalibrationPass,
          bend_radius_mm:    bendRadius ?? null,
        }),
      });
      const data = await res.json();
      if (data.status === "pass") {
        setReport(data.engineering_risk_engine);
      } else {
        setError(data.reason ?? "Analysis failed");
      }
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  }, [passes, material, thickness, sectionHeight, sectionWidth, isSymmetric, hasCalibrationPass, bendRadius]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const overallLevel: RiskLevel = report?.overall_risk_level ?? "OK";
  const confidence = report?.confidence;
  const twist = report?.twist_risk;
  const calNeed = report?.calibration_need;
  const perPass: any[] = report?.per_pass ?? [];
  const recs: string[] = report?.recommendations ?? [];

  return (
    <div className={`border border-slate-700/60 rounded-xl bg-slate-900/60 ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Engineering Risk Analysis</span>
          {report && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${RISK_BG[overallLevel]} ${RISK_COLOR[overallLevel]}`}>
              {overallLevel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); runAnalysis(); }}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Re-run analysis"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/60 px-4 py-3 space-y-3">

          {loading && (
            <div className="text-center py-6 text-slate-400 text-sm">
              <RefreshCw size={16} className="animate-spin mx-auto mb-2" />
              Running engineering risk analysis...
            </div>
          )}

          {error && (
            <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded p-2">
              {error}
            </div>
          )}

          {report && !loading && (
            <>
              {/* Overall summary row */}
              <div className="grid grid-cols-3 gap-2">
                {/* Overall Risk */}
                <div className={`rounded-lg border p-2 ${RISK_BG[overallLevel]}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <RiskIcon level={overallLevel} />
                    <span className="text-[10px] text-slate-400 font-medium">Overall Risk</span>
                  </div>
                  <div className={`text-sm font-bold ${RISK_COLOR[overallLevel]}`}>{overallLevel}</div>
                  <div className="text-[10px] text-slate-500">Score: {report.overall_score}/10</div>
                </div>

                {/* Confidence */}
                {confidence && (
                  <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-medium">Calc Confidence</span>
                      <HelpTooltip
                        title="Deformation Confidence"
                        body="Reliability of engineering calculations. Reduced by thin material, extreme angles, tight radii. NOT an FEA accuracy measure."
                        method="Estimate"
                        range="20% – 100%"
                        side="top"
                      />
                    </div>
                    <div className={`text-sm font-bold mt-1 ${
                      confidence.confidence_pct >= 75 ? "text-emerald-400" :
                      confidence.confidence_pct >= 50 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      {confidence.confidence_pct}%
                    </div>
                    <div className="text-[10px] text-slate-500">{confidence.confidence_level}</div>
                  </div>
                )}

                {/* Pass summary */}
                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-2">
                  <div className="text-[10px] text-slate-400 font-medium mb-1">Passes</div>
                  <div className="text-sm font-bold text-white">{report.summary?.total_passes ?? passes.length}</div>
                  <div className="text-[10px] space-y-0.5">
                    {report.summary?.critical_passes > 0 && <div className="text-red-400">⚠ {report.summary.critical_passes} critical</div>}
                    {report.summary?.warning_passes > 0  && <div className="text-orange-400">! {report.summary.warning_passes} warning</div>}
                    {report.summary?.caution_passes > 0  && <div className="text-yellow-400">· {report.summary.caution_passes} caution</div>}
                    {!report.summary?.critical_passes && !report.summary?.warning_passes && (
                      <div className="text-emerald-400">All clear</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Twist risk + Calibration row */}
              <div className="grid grid-cols-2 gap-2">
                {twist && (
                  <div className={`rounded-lg border p-2 ${RISK_BG[twist.risk_level as RiskLevel]}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <Zap size={11} className="text-purple-400" />
                      <span className="text-[10px] text-slate-400 font-medium">Twist Risk</span>
                      <HelpTooltip
                        title="Profile Twist Risk"
                        body="Risk of torsional instability based on height/width aspect ratio and profile symmetry. Asymmetric profiles are 1.8× more prone to twist."
                        method="Rule"
                        range="Aspect ratio limit: 0.6"
                        side="top"
                      />
                    </div>
                    <div className={`text-xs font-bold ${RISK_COLOR[twist.risk_level as RiskLevel]}`}>
                      {twist.risk_level}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      h/w = {twist.aspect_ratio?.toFixed(2)} {twist.is_symmetric ? "(sym)" : "(asym)"}
                    </div>
                  </div>
                )}

                {calNeed && (
                  <div className={`rounded-lg border p-2 ${RISK_BG[calNeed.level as RiskLevel]}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <ShieldCheck size={11} className="text-emerald-400" />
                      <span className="text-[10px] text-slate-400 font-medium">Calibration Need</span>
                      <HelpTooltip
                        title="Calibration Urgency"
                        body="How much final sizing/calibration pass is needed. Based on material springback factor, target angle, and number of forming passes."
                        method="Table"
                        side="top"
                      />
                    </div>
                    <div className={`text-xs font-bold ${RISK_COLOR[calNeed.level as RiskLevel]}`}>
                      {calNeed.level}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Score: {calNeed.urgency_score}/10
                      {!calNeed.has_calibration_pass && <span className="text-orange-400 ml-1">· No cal pass!</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {recs.length > 0 && (
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-amber-300 mb-2 flex items-center gap-1">
                    <AlertTriangle size={11} /> Engineering Recommendations
                  </div>
                  <ul className="space-y-1">
                    {recs.slice(0, 6).map((r, i) => (
                      <li key={i} className="text-[10px] text-amber-200/80 flex gap-1">
                        <span className="text-amber-500 flex-shrink-0">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                    {recs.length > 6 && (
                      <li className="text-[10px] text-slate-500">...and {recs.length - 6} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Per-pass detail toggle */}
              {perPass.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowPasses(v => !v)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPasses ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    Per-station detail ({perPass.length} stations)
                  </button>

                  {showPasses && (
                    <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                      {perPass.map((p: any) => {
                        const passLevel: RiskLevel = p.pass_risk_level ?? "OK";
                        const sevScore = p.severity?.score ?? 0;
                        return (
                          <div
                            key={p.pass_no}
                            className={`rounded-lg border px-3 py-2 ${RISK_BG[passLevel]}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <RiskIcon level={passLevel} />
                                <span className="text-[11px] font-semibold text-white">
                                  St.{p.pass_no} — {p.stage_type?.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span>{p.target_angle_deg?.toFixed(1)}°</span>
                                <span className={`font-bold ${RISK_COLOR[passLevel]}`}>{passLevel}</span>
                              </div>
                            </div>
                            <ScoreBar score={sevScore} level={passLevel} />
                            <div className="flex gap-3 mt-1 text-[9px] text-slate-500">
                              <span>Severity: {sevScore.toFixed(1)}/10</span>
                              {p.severity?.angle_increment_deg !== undefined && (
                                <span className={p.severity.increment_over_limit ? "text-orange-400" : ""}>
                                  Δθ: {p.severity.angle_increment_deg.toFixed(1)}°
                                  {p.severity.increment_over_limit && " ⚠"}
                                </span>
                              )}
                              {p.edge_buckling?.at_risk && (
                                <span className="text-orange-400">Edge buckling risk</span>
                              )}
                              {p.over_compression?.at_risk && (
                                <span className="text-red-400">
                                  {p.over_compression.too_tight ? "Gap too tight" : "Gap too loose"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Disclaimer */}
              <div className="text-[9px] text-slate-600 italic border-t border-slate-800 pt-2">
                {report.disclaimer}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default EngineeringRiskPanel;
