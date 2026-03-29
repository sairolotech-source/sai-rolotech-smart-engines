/**
 * BenchmarkValidationPanel.tsx — 5-Profile Benchmark Validation Dashboard
 * Sai Rolotech Smart Engines v2.4.0
 *
 * Runs all 5 benchmark profiles through Engineering Risk + Deformation APIs.
 * Shows pass/fail matrix with scores, springback, confidence.
 */

import React, { useState, useCallback } from "react";
import {
  FlaskConical, Play, CheckCircle2, XCircle, Clock,
  RefreshCw, ChevronDown, ChevronRight, AlertTriangle,
} from "lucide-react";

interface BenchmarkProfile {
  name:               string;
  label:              string;
  material:           string;
  thickness_mm:       number;
  section_width_mm:   number;
  section_height_mm:  number;
  target_angle_deg:   number;
  n_stations:         number;
  is_symmetric:       boolean;
}

interface BenchmarkResult {
  profile:             BenchmarkProfile;
  status:              "pending" | "running" | "pass" | "fail";
  risk_score?:         number;
  risk_level?:         string;
  deform_score?:       number;
  deform_level?:       string;
  worst_mode?:         string;
  confidence?:         number;
  calibration_needed?: boolean;
  springback_deg?:     number;
  error?:              string;
  elapsed_ms?:         number;
}

const BENCHMARKS: BenchmarkProfile[] = [
  { name:"170x50x3_MS",  label:"170×50×3 MS — C-channel",    material:"MS", thickness_mm:3.0, section_width_mm:170, section_height_mm:50,  target_angle_deg:90, n_stations:8,  is_symmetric:true },
  { name:"100x40x1_GI",  label:"100×40×1.2 GI — Z-section",  material:"GI", thickness_mm:1.2, section_width_mm:100, section_height_mm:40,  target_angle_deg:90, n_stations:7,  is_symmetric:false},
  { name:"250x75x2_SS",  label:"250×75×2 SS — Hat section",   material:"SS", thickness_mm:2.0, section_width_mm:250, section_height_mm:75,  target_angle_deg:85, n_stations:10, is_symmetric:true },
  { name:"60x25x0_8_CR", label:"60×25×0.8 CR — Lipped chan.", material:"CR", thickness_mm:0.8, section_width_mm:60,  section_height_mm:25,  target_angle_deg:90, n_stations:6,  is_symmetric:true },
  { name:"300x100x4_SS", label:"300×100×4 SS — Stress case",  material:"SS", thickness_mm:4.0, section_width_mm:300, section_height_mm:100, target_angle_deg:88, n_stations:12, is_symmetric:false},
];

function makePasses(profile: BenchmarkProfile) {
  const n = profile.n_stations;
  const stages = ["flat","pre_bend",
    ...Array(n - 4).fill("progressive_forming"),
    "final_form","calibration"].slice(0, n);
  return Array.from({ length: n }, (_, i) => {
    const ratio = i / Math.max(n - 1, 1);
    return {
      pass_no:          i + 1,
      stage_type:       stages[i],
      target_angle_deg: Math.round(profile.target_angle_deg * ratio * 10) / 10,
      roll_gap_mm:      Math.round(profile.thickness_mm * (1.0 - 0.02 * ratio) * 1000) / 1000,
      forming_depth_mm: Math.round(profile.section_height_mm * ratio * 0.9 * 100) / 100,
    };
  });
}

const LEVEL_COLOR: Record<string, string> = {
  LOW:      "text-green-400",
  MODERATE: "text-yellow-400",
  HIGH:     "text-orange-400",
  SEVERE:   "text-red-400",
};

function ScorePill({ score, level }: { score?: number; level?: string }) {
  if (score === undefined || !level) return <span className="text-slate-500">—</span>;
  return (
    <span className={`font-bold ${LEVEL_COLOR[level] ?? "text-slate-400"}`}>
      {score.toFixed(1)} <span className="text-xs font-normal">{level}</span>
    </span>
  );
}

export function BenchmarkValidationPanel() {
  const [results,  setResults]  = useState<BenchmarkResult[]>(() =>
    BENCHMARKS.map(p => ({ profile: p, status: "pending" as const }))
  );
  const [running,  setRunning]  = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const runAll = useCallback(async () => {
    setRunning(true);
    setResults(BENCHMARKS.map(p => ({ profile: p, status: "running" })));

    const updatedResults: BenchmarkResult[] = [];

    for (let idx = 0; idx < BENCHMARKS.length; idx++) {
      const p = BENCHMARKS[idx];
      const passes = makePasses(p);
      const t0 = Date.now();

      try {
        const [riskRes, deformRes] = await Promise.all([
          fetch("/papi/api/engineering-risk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              passes, material: p.material, thickness_mm: p.thickness_mm,
              section_width_mm: p.section_width_mm, section_height_mm: p.section_height_mm,
              is_symmetric: p.is_symmetric,
            }),
          }).then(r => r.json()),
          fetch("/papi/api/deformation-predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              passes, material: p.material, thickness_mm: p.thickness_mm,
              section_width_mm: p.section_width_mm, section_height_mm: p.section_height_mm,
              is_symmetric: p.is_symmetric,
            }),
          }).then(r => r.json()),
        ]);

        const risk  = riskRes?.engineering_risk_engine;
        const deform = deformRes?.deformation_predictor;

        const result: BenchmarkResult = {
          profile:             p,
          status:              "pass",
          risk_score:          risk?.overall_severity_score,
          risk_level:          risk?.overall_severity_level,
          deform_score:        deform?.overall_deformation_score,
          deform_level:        deform?.overall_level,
          worst_mode:          deform?.worst_mode,
          confidence:          risk?.deformation_confidence_pct,
          calibration_needed:  risk?.calibration_urgency === "URGENT" || risk?.calibration_urgency === "HIGH",
          elapsed_ms:          Date.now() - t0,
        };
        updatedResults.push(result);
      } catch (e: unknown) {
        updatedResults.push({
          profile: p, status: "fail",
          error: e instanceof Error ? e.message : "Network error",
        });
      }

      setResults([
        ...updatedResults,
        ...BENCHMARKS.slice(idx + 1).map(pp => ({ profile: pp, status: "running" as const })),
      ]);
    }

    setResults(updatedResults);
    setRunning(false);
  }, []);

  const passCount = results.filter(r => r.status === "pass").length;
  const failCount = results.filter(r => r.status === "fail").length;

  return (
    <div className="bg-slate-800/70 rounded-xl border border-slate-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300 uppercase tracking-wider">
            Benchmark Validation
          </span>
          <span className="text-xs text-slate-400">5 profiles</span>
        </div>
        <button
          onClick={runAll}
          disabled={running}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {running
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <Play className="w-3 h-3" />
          }
          {running ? "Running…" : "Run All"}
        </button>
      </div>

      {/* Summary bar */}
      {results.some(r => r.status === "pass" || r.status === "fail") && (
        <div className="flex items-center gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {passCount} pass
          </div>
          {failCount > 0 && (
            <div className="flex items-center gap-1 text-red-400">
              <XCircle className="w-3.5 h-3.5" />
              {failCount} fail
            </div>
          )}
        </div>
      )}

      {/* Results table */}
      <div className="space-y-2">
        {results.map(r => {
          const isOpen = expanded === r.profile.name;
          const statusIcon =
            r.status === "pending"  ? <Clock className="w-3.5 h-3.5 text-slate-500" /> :
            r.status === "running"  ? <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" /> :
            r.status === "pass"     ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> :
            <XCircle className="w-3.5 h-3.5 text-red-400" />;

          return (
            <div key={r.profile.name} className="border border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : r.profile.name)}
                className="w-full flex items-center gap-2 p-2.5 text-xs hover:bg-slate-700/40 transition-colors text-left"
              >
                {statusIcon}
                <span className="flex-1 text-slate-200 font-medium">{r.profile.label}</span>

                {r.status === "pass" && (
                  <div className="flex items-center gap-2 shrink-0 text-slate-400">
                    <span>Risk: <ScorePill score={r.risk_score} level={r.risk_level} /></span>
                    <span>Def: <ScorePill score={r.deform_score} level={r.deform_level} /></span>
                    {r.calibration_needed && (
                      <AlertTriangle className="w-3 h-3 text-orange-400" title="Calibration needed" />
                    )}
                  </div>
                )}
                {r.status === "fail" && (
                  <span className="text-red-400 shrink-0">{r.error}</span>
                )}
                {isOpen
                  ? <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                  : <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                }
              </button>

              {isOpen && r.status === "pass" && (
                <div className="border-t border-slate-700 bg-slate-800/60 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="text-slate-400">Material</div>
                  <div className="text-slate-200 font-medium">{r.profile.material}</div>

                  <div className="text-slate-400">Thickness</div>
                  <div className="text-slate-200">{r.profile.thickness_mm}mm</div>

                  <div className="text-slate-400">Section</div>
                  <div className="text-slate-200">{r.profile.section_width_mm}×{r.profile.section_height_mm}mm</div>

                  <div className="text-slate-400">Stations</div>
                  <div className="text-slate-200">{r.profile.n_stations}</div>

                  <div className="text-slate-400">Risk Score</div>
                  <div><ScorePill score={r.risk_score} level={r.risk_level} /></div>

                  <div className="text-slate-400">Deform Score</div>
                  <div><ScorePill score={r.deform_score} level={r.deform_level} /></div>

                  <div className="text-slate-400">Worst Mode</div>
                  <div className="text-slate-200">{r.worst_mode ?? "—"}</div>

                  <div className="text-slate-400">Confidence</div>
                  <div className="text-slate-200">{r.confidence !== undefined ? `${r.confidence.toFixed(1)}%` : "—"}</div>

                  <div className="text-slate-400">Calibration</div>
                  <div className={r.calibration_needed ? "text-orange-400 font-semibold" : "text-green-400"}>
                    {r.calibration_needed ? "⚠ Needed" : "OK"}
                  </div>

                  <div className="text-slate-400">API time</div>
                  <div className="text-slate-400">{r.elapsed_ms}ms</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-slate-500 border-t border-slate-700 pt-2">
        [Estimate] All benchmark scores are empirical approximations. Run trial profiles before production.
      </div>
    </div>
  );
}
