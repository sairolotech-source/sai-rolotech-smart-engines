/**
 * DeformationPredictorPanel.tsx — Forming Deformation Predictor
 * Sai Rolotech Smart Engines v2.4.0
 *
 * Shows bow/camber, edge wave, wrinkling tendency + station aggressiveness heatmap
 * All values are empirical estimates — NOT FEA.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity, AlertTriangle, CheckCircle, XCircle, Info,
  TrendingUp, Waves, Wind, BarChart2, RefreshCw,
} from "lucide-react";

interface PassData {
  pass_no: number;
  stage_type?: string;
  target_angle_deg?: number;
  roll_gap_mm?: number;
  forming_depth_mm?: number;
}

interface Props {
  passes:           PassData[];
  material:         string;
  thicknessMm:      number;
  sectionWidthMm:   number;
  sectionHeightMm:  number;
  isSymmetric:      boolean;
  bendRadiusMm?:    number;
}

interface DeformReport {
  status: string;
  overall_deformation_score?: number;
  overall_level?: string;
  worst_mode?: string;
  bow_camber?: {
    bow_tendency_score: number;
    camber_tendency_score: number;
    bow_level: string;
    camber_level: string;
    bow_estimate_mm_per_m: number;
    camber_estimate_mm_per_m: number;
    recommendations: string[];
  };
  edge_wave?: {
    edge_wave_score: number;
    edge_wave_level: string;
    critical_width_mm: number;
    actual_width_mm: number;
    at_risk: boolean;
    recommendations: string[];
  };
  wrinkling?: {
    wrinkling_score: number;
    wrinkling_level: string;
    risky_zones: { pass_no: number; risk: string }[];
    at_risk: boolean;
    recommendations: string[];
  };
  aggressiveness_heatmap?: {
    pass_no: number;
    stage_type: string;
    target_angle_deg: number;
    aggressiveness_score: number;
    aggressiveness_level: string;
    angle_increment_deg: number;
  }[];
  top_aggressive_stations?: {
    pass_no: number;
    aggressiveness_score: number;
    aggressiveness_level: string;
  }[];
  all_recommendations?: string[];
  confidence_level?: string;
  disclaimer?: string;
  error?: string;
}

const LEVEL_COLOR: Record<string, string> = {
  LOW:      "text-green-400",
  MODERATE: "text-yellow-400",
  HIGH:     "text-orange-400",
  SEVERE:   "text-red-400",
};

const LEVEL_BG: Record<string, string> = {
  LOW:      "bg-green-900/30 border-green-700",
  MODERATE: "bg-yellow-900/30 border-yellow-700",
  HIGH:     "bg-orange-900/30 border-orange-700",
  SEVERE:   "bg-red-900/30 border-red-700",
};

const HEATMAP_BAR: Record<string, string> = {
  LOW:      "bg-green-500",
  MODERATE: "bg-yellow-500",
  HIGH:     "bg-orange-500",
  SEVERE:   "bg-red-500",
};

function ScoreBar({ score, level }: { score: number; level: string }) {
  const pct = Math.round((score / 10) * 100);
  return (
    <div className="relative h-2 rounded-full bg-slate-700 overflow-hidden">
      <div
        className={`absolute left-0 top-0 h-2 rounded-full transition-all duration-500 ${HEATMAP_BAR[level] ?? "bg-slate-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function LevelBadge({ level, score }: { level: string; score: number }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${LEVEL_COLOR[level] ?? "text-slate-400"}`}>
      {level} {score.toFixed(1)}/10
    </span>
  );
}

export function DeformationPredictorPanel({
  passes, material, thicknessMm, sectionWidthMm, sectionHeightMm, isSymmetric, bendRadiusMm,
}: Props) {
  const [report, setReport]     = useState<DeformReport | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string>("");
  const [section, setSection]   = useState<"overview" | "heatmap" | "recs">("overview");

  const fetchReport = useCallback(async () => {
    if (!passes?.length) return;
    setLoading(true);
    setError("");
    try {
      const body = {
        passes,
        material,
        thickness_mm:      thicknessMm,
        section_width_mm:  sectionWidthMm,
        section_height_mm: sectionHeightMm,
        is_symmetric:      isSymmetric,
        bend_radius_mm:    bendRadiusMm ?? null,
      };
      const res = await fetch("/papi/api/deformation-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.status === "pass" && data.deformation_predictor) {
        setReport(data.deformation_predictor);
      } else if (data.error) {
        setError(data.error);
      } else {
        setReport(data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }, [passes, material, thicknessMm, sectionWidthMm, sectionHeightMm, isSymmetric, bendRadiusMm]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  if (!passes?.length) {
    return (
      <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-cyan-300 uppercase tracking-wider">Deformation Predictor</span>
        </div>
        <p className="text-slate-500 text-xs">No pass data available. Run pipeline first.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-cyan-300 uppercase tracking-wider">Deformation Predictor</span>
          <span className="text-xs bg-cyan-900/40 text-cyan-400 border border-cyan-700 px-1.5 py-0.5 rounded">
            [Estimate]
          </span>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-700 transition-colors"
          title="Re-run prediction"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
          <div className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          Calculating deformation tendencies…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs py-2">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {report && report.status !== "fail" && !loading && (
        <>
          {/* Overall badge */}
          {report.overall_deformation_score !== undefined && report.overall_level && (
            <div className={`rounded-lg border p-3 mb-3 ${LEVEL_BG[report.overall_level] ?? "bg-slate-700 border-slate-600"}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {report.overall_level === "LOW"
                    ? <CheckCircle className="w-4 h-4 text-green-400" />
                    : report.overall_level === "SEVERE"
                    ? <XCircle className="w-4 h-4 text-red-400" />
                    : <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                  <span className="text-xs font-semibold text-white">
                    Worst Mode: {report.worst_mode}
                  </span>
                </div>
                <LevelBadge level={report.overall_level} score={report.overall_deformation_score} />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Confidence: <span className={`font-semibold ${
                  report.confidence_level === "HIGH" ? "text-green-400"
                  : report.confidence_level === "MEDIUM" ? "text-yellow-400"
                  : "text-red-400"
                }`}>{report.confidence_level}</span></span>
              </div>
            </div>
          )}

          {/* Section tabs */}
          <div className="flex gap-1 mb-3">
            {(["overview", "heatmap", "recs"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  section === s
                    ? "bg-cyan-700 text-white"
                    : "bg-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                {s === "overview" ? "Overview" : s === "heatmap" ? "Heatmap" : "Actions"}
              </button>
            ))}
          </div>

          {/* Overview */}
          {section === "overview" && (
            <div className="space-y-3">
              {/* Bow/Camber */}
              {report.bow_camber && (
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-semibold text-slate-200">Bow / Camber</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-400">Bow Tendency</span>
                        <LevelBadge level={report.bow_camber.bow_level} score={report.bow_camber.bow_tendency_score} />
                      </div>
                      <ScoreBar score={report.bow_camber.bow_tendency_score} level={report.bow_camber.bow_level} />
                      <div className="text-xs text-slate-500 mt-0.5">
                        [Estimate] ~{report.bow_camber.bow_estimate_mm_per_m} mm/m
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-slate-400">Camber Tendency</span>
                        <LevelBadge level={report.bow_camber.camber_level} score={report.bow_camber.camber_tendency_score} />
                      </div>
                      <ScoreBar score={report.bow_camber.camber_tendency_score} level={report.bow_camber.camber_level} />
                      <div className="text-xs text-slate-500 mt-0.5">
                        [Estimate] ~{report.bow_camber.camber_estimate_mm_per_m} mm/m
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edge Wave */}
              {report.edge_wave && (
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Waves className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-slate-200">Edge Wave</span>
                    {report.edge_wave.at_risk && (
                      <span className="text-xs text-red-400 font-bold">⚠ AT RISK</span>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">Risk Score</span>
                      <LevelBadge level={report.edge_wave.edge_wave_level} score={report.edge_wave.edge_wave_score} />
                    </div>
                    <ScoreBar score={report.edge_wave.edge_wave_score} level={report.edge_wave.edge_wave_level} />
                    <div className="text-xs text-slate-500 mt-1">
                      [Formula] Critical width: {report.edge_wave.critical_width_mm}mm · Actual: {report.edge_wave.actual_width_mm}mm
                    </div>
                  </div>
                </div>
              )}

              {/* Wrinkling */}
              {report.wrinkling && (
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wind className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-200">Wrinkling</span>
                    {report.wrinkling.at_risk && (
                      <span className="text-xs text-orange-400 font-bold">⚠ MONITOR</span>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-400">Risk Score</span>
                      <LevelBadge level={report.wrinkling.wrinkling_level} score={report.wrinkling.wrinkling_score} />
                    </div>
                    <ScoreBar score={report.wrinkling.wrinkling_score} level={report.wrinkling.wrinkling_level} />
                    {report.wrinkling.risky_zones.length > 0 && (
                      <div className="text-xs text-orange-400 mt-1">
                        ⚠ Risky zones: Pass {report.wrinkling.risky_zones.map(z => z.pass_no).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aggressiveness Heatmap */}
          {section === "heatmap" && report.aggressiveness_heatmap && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-slate-200">Station Aggressiveness [Formula + Rule]</span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {report.aggressiveness_heatmap.map(entry => (
                  <div key={entry.pass_no} className="flex items-center gap-2">
                    <div className="w-7 text-xs text-slate-400 text-right shrink-0">S{entry.pass_no}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 relative h-4 bg-slate-700 rounded">
                          <div
                            className={`h-4 rounded transition-all duration-300 ${HEATMAP_BAR[entry.aggressiveness_level] ?? "bg-slate-500"}`}
                            style={{ width: `${Math.round((entry.aggressiveness_score / 10) * 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-10 shrink-0 ${LEVEL_COLOR[entry.aggressiveness_level] ?? "text-slate-400"}`}>
                          {entry.aggressiveness_score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="w-16 text-xs text-slate-500 shrink-0">{entry.stage_type}</div>
                  </div>
                ))}
              </div>
              {report.top_aggressive_stations && report.top_aggressive_stations.length > 0 && (
                <div className="mt-2 text-xs text-slate-400 border-t border-slate-700 pt-2">
                  Most aggressive: {report.top_aggressive_stations.map(s =>
                    `S${s.pass_no} (${s.aggressiveness_score.toFixed(1)})`
                  ).join(" · ")}
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {section === "recs" && (
            <div className="space-y-2">
              {report.all_recommendations && report.all_recommendations.length > 0 ? (
                report.all_recommendations.map((rec, i) => (
                  <div key={i} className="flex gap-2 text-xs text-slate-300">
                    <span className="text-amber-400 shrink-0 mt-0.5">→</span>
                    <span>{rec}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle className="w-3.5 h-3.5" />
                  No critical recommendations — forming sequence looks balanced.
                </div>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <div className="mt-3 border-t border-slate-700 pt-2 flex items-start gap-1.5">
            <Info className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">{report.disclaimer}</p>
          </div>
        </>
      )}
    </div>
  );
}
