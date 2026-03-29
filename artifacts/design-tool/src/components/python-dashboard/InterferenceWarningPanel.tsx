/**
 * InterferenceWarningPanel.tsx — Roll Interference Visual Warning
 * Sai Rolotech Smart Engines v2.5.0
 *
 * Shows clash detection from two sources:
 *   1. roll_contour_interference — shapely-based, manufacturing-grade (primary)
 *   2. roll_interference_engine  — heuristic AABB (legacy fallback)
 */

import React, { useState } from "react";
import { AlertOctagon, ChevronDown, ChevronRight, Wrench, Info, ShieldCheck } from "lucide-react";

interface InterferenceIssue {
  station?:     number;
  stand?:       number;
  type?:        string;
  description?: string;
  severity?:    string;
  detail?:      string;
}

interface InterferenceResult {
  status?:   string;
  blocking?: boolean;
  issues?:   InterferenceIssue[];
  warnings?: string[];
}

interface StationCheck {
  status:         string;
  pass_no:        number;
  clash_area_mm2: number;
  min_clearance_mm: number;
  blocking:       boolean;
  message?:       string;
}

interface ShapelyInterferenceResult {
  status?:         string;
  confidence?:     string;
  blocking?:       boolean;
  any_clash?:      boolean;
  any_warning?:    boolean;
  clash_count?:    number;
  clear_stations?: number[];
  clash_stations?: number[];
  warning_stations?: number[];
  station_checks?: StationCheck[];
}

interface Props {
  interferenceResult?:  InterferenceResult | null;
  shapelyInterference?: ShapelyInterferenceResult | null;
  selectedStation?:     number;
}

const FIXES: Record<string, string[]> = {
  default: [
    "Increase roll OD to create more clearance between adjacent rolls.",
    "Reduce forming depth per station and add more stations.",
    "Increase station spacing (adjust pass layout).",
    "Reduce strip width contribution per station.",
    "Check roll gap — if too tight, adjacent upper/lower rolls may clash.",
  ],
  od_clash: [
    "Increase roll OD spacing — adjacent roll diameters are overlapping.",
    "Reduce OD of the clashing roll (if structurally permissible).",
    "Split the forming pass across two stations with reduced OD each.",
  ],
  bore_interference: [
    "Verify bore size and wall thickness — wall < 15mm is fragile.",
    "Increase shaft spacing or reduce bore diameter.",
    "Check that bore H7 tolerance does not create size interference.",
  ],
  strip_width: [
    "Reduce strip width per station — edge is entering adjacent roll zone.",
    "Add anti-buckling guide rolls at this station.",
    "Reduce forming angle increment at this station.",
  ],
};

function getFixes(issue: InterferenceIssue): string[] {
  const type = issue.type?.toLowerCase() ?? "";
  if (type.includes("od") || type.includes("diameter")) return FIXES.od_clash;
  if (type.includes("bore"))                             return FIXES.bore_interference;
  if (type.includes("strip") || type.includes("width")) return FIXES.strip_width;
  return FIXES.default;
}

function statusDot(status: string) {
  if (status === "clear")   return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />;
  if (status === "warning") return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />;
}

export function InterferenceWarningPanel({ interferenceResult, shapelyInterference, selectedStation }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showShapely, setShowShapely] = useState(false);

  // ── Shapely manufacturing-grade section ──────────────────────────────────
  const hasShapely = !!shapelyInterference?.status;
  const shapelyOk  = hasShapely && !shapelyInterference?.any_clash && !shapelyInterference?.blocking;

  // ── Heuristic fallback section ───────────────────────────────────────────
  if (!interferenceResult && !hasShapely) return null;

  const issues   = interferenceResult?.issues ?? [];
  const warnings = interferenceResult?.warnings ?? [];
  const blocking = interferenceResult?.blocking ?? false;
  const hasProblems = blocking || issues.length > 0 || warnings.length > 0;

  const relevantIssues = selectedStation != null
    ? issues.filter(i => i.station === selectedStation || i.stand === selectedStation)
    : issues;

  const stationChecks = shapelyInterference?.station_checks ?? [];

  return (
    <div className="space-y-2">
      {/* ── Shapely Manufacturing-Grade Panel ── */}
      {hasShapely && (
        <div className={`rounded-xl border ${
          shapelyOk
            ? "border-emerald-700/50 bg-emerald-900/10"
            : "border-red-700 bg-red-900/20"
        }`}>
          <button
            onClick={() => setShowShapely(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
          >
            {shapelyOk
              ? <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              : <AlertOctagon className="w-4 h-4 shrink-0 text-red-400" />
            }
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold ${shapelyOk ? "text-emerald-300" : "text-red-300"}`}>
                  {shapelyOk ? "✓ All stations clear" : "⛔ Interference detected"}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-mono">
                  manufacturing-grade
                </span>
                {shapelyInterference?.confidence && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 font-mono">
                    confidence: {shapelyInterference.confidence}
                  </span>
                )}
                <span className="text-[9px] text-gray-500 font-mono">
                  {stationChecks.length} stations · {shapelyInterference?.clash_count ?? 0} clashes
                </span>
              </div>
            </div>
            {showShapely
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            }
          </button>

          {showShapely && stationChecks.length > 0 && (
            <div className="border-t border-emerald-800/40 px-3 py-2 space-y-2">
              <div className="text-[9px] text-gray-500 font-mono mb-1">
                Method: shapely polygon intersection · envelopes clipped at ±half_gap
              </div>
              <div className="overflow-x-auto">
                <table className="text-[9px] font-mono w-full">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700/40">
                      <th className="text-left pb-1 pr-3">Pass</th>
                      <th className="text-left pb-1 pr-3">Status</th>
                      <th className="text-right pb-1 pr-3">Clearance</th>
                      <th className="text-right pb-1">Clash mm²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stationChecks.map(c => {
                      const highlight = selectedStation != null && c.pass_no === selectedStation;
                      return (
                        <tr key={c.pass_no} className={`border-b border-gray-800/30 ${highlight ? 'bg-blue-900/20' : ''}`}>
                          <td className="py-0.5 pr-3 text-gray-400">{c.pass_no}</td>
                          <td className="py-0.5 pr-3">
                            {statusDot(c.status)}
                            <span className={
                              c.status === "clear"   ? "text-emerald-300" :
                              c.status === "warning" ? "text-amber-300"   : "text-red-300"
                            }>{c.status}</span>
                          </td>
                          <td className="py-0.5 pr-3 text-right text-blue-300">{c.min_clearance_mm.toFixed(3)} mm</td>
                          <td className="py-0.5 text-right text-gray-400">{c.clash_area_mm2.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Heuristic fallback / legacy panel ── */}
      {interferenceResult && (
        <div>
          {!hasProblems ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/40 border border-gray-700/40 text-xs">
              <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-400">Heuristic check: no issues</span>
              <span className="text-[9px] text-gray-600 font-mono ml-1">heuristic-fallback</span>
            </div>
          ) : (
            <div className={`rounded-xl border ${blocking ? "border-red-700 bg-red-900/20" : "border-orange-700 bg-orange-900/20"}`}>
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
              >
                <AlertOctagon className={`w-4 h-4 shrink-0 ${blocking ? "text-red-400" : "text-orange-400"}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${blocking ? "text-red-300" : "text-orange-300"}`}>
                      {blocking ? "⛔ ROLL INTERFERENCE — PRODUCTION BLOCKING" : "⚠ Roll Interference Warning"}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                      blocking ? "bg-red-800 text-red-200" : "bg-orange-800 text-orange-200"
                    }`}>
                      {issues.length} {issues.length === 1 ? "issue" : "issues"}
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">heuristic-fallback</span>
                  </div>
                  {selectedStation != null && relevantIssues.length > 0 && (
                    <div className="text-xs text-red-400 mt-0.5">
                      Station {selectedStation}: {relevantIssues.length} clash(es)
                    </div>
                  )}
                </div>
                {expanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                }
              </button>

              {expanded && (
                <div className="border-t border-red-800/40 px-3 py-2 space-y-3">
                  {issues.length > 0 && (
                    <div className="space-y-2">
                      {issues.map((issue, idx) => {
                        const isSelected = selectedStation != null &&
                          (issue.station === selectedStation || issue.stand === selectedStation);
                        const fixes = getFixes(issue);
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg p-2.5 border ${
                              isSelected
                                ? "border-red-600 bg-red-950/60"
                                : "border-slate-700 bg-slate-800/60"
                            }`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                                issue.severity === "critical" || blocking
                                  ? "bg-red-700 text-red-100"
                                  : "bg-orange-700 text-orange-100"
                              }`}>
                                {issue.station != null ? `St.${issue.station}` : issue.stand != null ? `Stand ${issue.stand}` : "Global"}
                              </span>
                              <div>
                                <div className="text-xs text-slate-200 font-medium">
                                  {issue.description ?? issue.type ?? "Interference detected"}
                                </div>
                                {issue.detail && (
                                  <div className="text-xs text-slate-400 mt-0.5">{issue.detail}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-1.5">
                              <Wrench className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                {fixes.slice(0, 3).map((fix, fi) => (
                                  <div key={fi} className="text-xs text-amber-300">→ {fix}</div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="space-y-1">
                      {warnings.map((w, i) => (
                        <div key={i} className="text-xs text-orange-300 flex gap-1.5">
                          <span className="shrink-0">⚠</span>{w}
                        </div>
                      ))}
                    </div>
                  )}
                  {blocking && (
                    <div className="border border-red-700 rounded-lg px-3 py-2 bg-red-950/40 text-xs text-red-300">
                      <strong>Production blocked:</strong> This interference must be resolved before manufacturing release.
                      Re-run the pipeline after making corrections to clear this flag.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
