/**
 * InterferenceWarningPanel.tsx — Roll Interference Visual Warning
 * Sai Rolotech Smart Engines v2.4.0
 *
 * Shows clash detection from roll_interference_engine output.
 * Highlights affected stations, shows recommended fixes.
 */

import React, { useState } from "react";
import { AlertOctagon, ChevronDown, ChevronRight, Wrench, Info } from "lucide-react";

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

interface Props {
  interferenceResult?: InterferenceResult | null;
  selectedStation?:    number;
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

export function InterferenceWarningPanel({ interferenceResult, selectedStation }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!interferenceResult) return null;

  const issues   = interferenceResult.issues ?? [];
  const warnings = interferenceResult.warnings ?? [];
  const blocking = interferenceResult.blocking ?? false;

  const hasProblems = blocking || issues.length > 0 || warnings.length > 0;

  // Filter to selected station if provided
  const relevantIssues = selectedStation != null
    ? issues.filter(i => i.station === selectedStation || i.stand === selectedStation)
    : issues;

  if (!hasProblems) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-800/50 text-xs">
        <Info className="w-3.5 h-3.5 text-green-400 shrink-0" />
        <span className="text-green-400 font-medium">No roll interference detected</span>
        <span className="text-green-600">— All stations clear</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${blocking ? "border-red-700 bg-red-900/20" : "border-orange-700 bg-orange-900/20"}`}>
      {/* Header */}
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
          {/* Issues list */}
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

                    {/* Recommended fixes */}
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

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="text-xs text-orange-300 flex gap-1.5">
                  <span className="shrink-0">⚠</span>{w}
                </div>
              ))}
            </div>
          )}

          {/* Blocking note */}
          {blocking && (
            <div className="border border-red-700 rounded-lg px-3 py-2 bg-red-950/40 text-xs text-red-300">
              <strong>Production blocked:</strong> This interference must be resolved before manufacturing release.
              Re-run the pipeline after making corrections to clear this flag.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
