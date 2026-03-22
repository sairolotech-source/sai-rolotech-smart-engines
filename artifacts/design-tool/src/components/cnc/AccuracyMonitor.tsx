import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, ShieldX, Trash2, AlertTriangle, Download } from "lucide-react";
import { useCncStore, type AccuracyEntry } from "../../store/useCncStore";

const TASK_LABELS: Record<string, string> = {
  flower: "Power Pattern",
  tooling: "Roll Tooling",
  gcode: "G-Code",
  "ai-diagnosis": "AI Diagnosis",
  "design-score": "AI Design Score",
};

const TASK_COLORS: Record<string, string> = {
  flower: "#3b82f6",
  tooling: "#f97316",
  gcode: "#a855f7",
  "ai-diagnosis": "#22c55e",
  "design-score": "#06b6d4",
};

function ScoreIcon({ score, cls = "w-4 h-4" }: { score: number; cls?: string }) {
  if (score >= 85) return <ShieldCheck className={`${cls} text-emerald-400`} />;
  if (score >= 70) return <ShieldAlert className={`${cls} text-amber-400`} />;
  return <ShieldX className={`${cls} text-red-400`} />;
}

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 85) return "bg-emerald-500/10 border-emerald-500/25";
  if (score >= 70) return "bg-amber-500/10 border-amber-500/25";
  return "bg-red-500/10 border-red-500/25";
}

interface AccuracyMonitorProps {
  collapsed?: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { taskType: string } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const tt = payload[0].payload.taskType;
  return (
    <div className="rt-card-elevated px-3 py-2 text-[11px] shadow-xl">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className={`font-bold text-sm ${scoreColor(v)}`}>{v}%</p>
      <p className="text-zinc-500">{TASK_LABELS[tt] ?? tt}</p>
    </div>
  );
}

function EntryRow({ entry, threshold, expanded, onToggle }: {
  entry: AccuracyEntry;
  threshold: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isLow = entry.overallScore < threshold;
  const ts = new Date(entry.timestamp);
  const timeStr = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${scoreBg(entry.overallScore)}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
      >
        <ScoreIcon score={entry.overallScore} cls="w-3.5 h-3.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-200 truncate">
              {TASK_LABELS[entry.taskType] ?? entry.taskType}
            </span>
            {entry.taskLabel && entry.taskLabel !== TASK_LABELS[entry.taskType] && (
              <span className="text-[10px] text-zinc-500 truncate">{entry.taskLabel}</span>
            )}
          </div>
          <span className="text-[10px] text-zinc-600">{timeStr}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isLow && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">
              <AlertTriangle className="w-2.5 h-2.5" /> LOW
            </span>
          )}
          <span className={`text-sm font-bold tabular-nums ${scoreColor(entry.overallScore)}`}>
            {entry.overallScore}%
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/[0.06]">
          {/* Sub-scores */}
          <div className="mt-2 space-y-1">
            {entry.subScores.map((sub, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-zinc-400 truncate">{sub.dimension}</span>
                    <span className={`text-[10px] font-semibold tabular-nums ml-2 flex-shrink-0 ${scoreColor(sub.score)}`}>
                      {sub.score}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${sub.score >= 85 ? "bg-emerald-500" : sub.score >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${sub.score}%` }}
                    />
                  </div>
                  {sub.value !== undefined && (
                    <p className="text-[9px] text-zinc-600 mt-0.5 truncate">{sub.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {entry.warnings.length > 0 && (
            <div className="mt-2 space-y-1">
              {entry.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 px-2 py-1 rounded bg-amber-500/8 border border-amber-500/15">
                  <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-300 leading-tight">{w}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AccuracyMonitor({ collapsed: initialCollapsed = false }: AccuracyMonitorProps) {
  const { accuracyLog, accuracyThreshold, clearAccuracyLog, setAccuracyThreshold } = useCncStore();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const chartData = accuracyLog.map((e, i) => ({
    index: i + 1,
    score: e.overallScore,
    taskType: e.taskType,
    label: `${i + 1}. ${TASK_LABELS[e.taskType] ?? e.taskType}`,
  }));

  const avgScore = accuracyLog.length > 0
    ? Math.round(accuracyLog.reduce((s, e) => s + e.overallScore, 0) / accuracyLog.length)
    : null;

  const lowCount = accuracyLog.filter(e => e.overallScore < accuracyThreshold).length;

  function exportAccuracyText(): string {
    const lines: string[] = [
      "=== ACCURACY MONITOR LOG ===",
      `Generated: ${new Date().toLocaleString()}`,
      `Threshold: ${accuracyThreshold}%`,
      avgScore !== null ? `Session Average: ${avgScore}%` : "",
      `Total Tasks: ${accuracyLog.length} | Low-accuracy: ${lowCount}`,
      "",
    ];
    for (const entry of accuracyLog) {
      lines.push(`[${new Date(entry.timestamp).toLocaleTimeString()}] ${TASK_LABELS[entry.taskType]} — ${entry.overallScore}%`);
      for (const sub of entry.subScores) {
        lines.push(`  • ${sub.dimension}: ${sub.score}%${sub.value ? ` (${sub.value})` : ""}`);
      }
      if (entry.warnings.length > 0) {
        lines.push(`  WARNINGS:`);
        for (const w of entry.warnings) lines.push(`    ⚠ ${w}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  function handleExport() {
    const text = exportAccuracyText();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accuracy-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rt-card border border-white/[0.07] rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${avgScore === null ? "bg-zinc-600" : avgScore >= 85 ? "bg-emerald-400" : avgScore >= 70 ? "bg-amber-400" : "bg-red-400"}`} />
        <span className="text-[11px] font-semibold text-zinc-300 flex-1 text-left">Accuracy Monitor</span>
        {accuracyLog.length > 0 && (
          <div className="flex items-center gap-1.5">
            {avgScore !== null && (
              <span className={`text-[10px] font-bold tabular-nums ${scoreColor(avgScore)}`}>{avgScore}% avg</span>
            )}
            {lowCount > 0 && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-bold">
                {lowCount} low
              </span>
            )}
            <span className="text-[10px] text-zinc-600">{accuracyLog.length} tasks</span>
          </div>
        )}
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />}
      </button>

      {!collapsed && (
        <div className="border-t border-white/[0.06]">
          {accuracyLog.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <ShieldCheck className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-500">No tasks scored yet</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Run Power Pattern, Tooling, G-Code, or AI Diagnosis to see accuracy scores</p>
            </div>
          ) : (
            <>
              {/* Trend Chart */}
              {chartData.length >= 2 && (
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] text-zinc-600 mb-2 font-medium uppercase tracking-wider">Score Trend</p>
                  <div style={{ height: 100 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis
                          dataKey="index"
                          tick={{ fontSize: 9, fill: "#52525b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 9, fill: "#52525b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine
                          y={accuracyThreshold}
                          stroke="rgba(239,68,68,0.4)"
                          strokeDasharray="4 2"
                          label={{ value: `${accuracyThreshold}%`, position: "right", fontSize: 9, fill: "#ef4444" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={(props) => {
                            const { cx, cy, payload } = props;
                            const color = payload.score >= 85 ? "#22c55e" : payload.score >= 70 ? "#f59e0b" : "#ef4444";
                            return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={color} stroke="transparent" />;
                          }}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Threshold control */}
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 flex-shrink-0">Threshold:</span>
                <input
                  type="range"
                  min={50}
                  max={95}
                  step={5}
                  value={accuracyThreshold}
                  onChange={e => setAccuracyThreshold(parseInt(e.target.value))}
                  className="flex-1 accent-blue-500 h-1"
                />
                <span className="text-[10px] text-zinc-400 w-8 tabular-nums text-right">{accuracyThreshold}%</span>
              </div>

              {/* Low-accuracy warning card — auto-shown when latest result is below threshold */}
              {(() => {
                const latest = [...accuracyLog].reverse()[0];
                if (!latest || latest.overallScore >= accuracyThreshold) return null;
                const failedSubs = latest.subScores.filter(s => s.score < accuracyThreshold);
                return (
                  <div className="mx-3 mb-2 p-3 rounded-lg border border-red-500/30 bg-red-500/8">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      <span className="text-[11px] font-bold text-red-300">
                        Low Accuracy — {TASK_LABELS[latest.taskType] ?? latest.taskType} ({latest.overallScore}%)
                      </span>
                    </div>
                    {failedSubs.length > 0 && (
                      <div className="space-y-1 mb-2">
                        <p className="text-[10px] text-red-400/80 font-medium">Failed sub-dimensions:</p>
                        {failedSubs.map((sub, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <span className="text-[10px] text-red-300">{sub.dimension}: <span className="font-mono font-semibold">{sub.score}%</span></span>
                            {sub.value && <span className="text-[9px] text-red-400/60">({sub.value})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {latest.warnings.length > 0 && (
                      <div className="space-y-0.5">
                        {latest.warnings.map((w, i) => (
                          <p key={i} className="text-[10px] text-amber-300/80">⚠ {w}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Log entries */}
              <div className="px-3 pb-3 space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                {[...accuracyLog].reverse().map(entry => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    threshold={accuracyThreshold}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="px-3 pb-3 flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium
                             text-blue-400 bg-blue-500/8 border border-blue-500/15
                             hover:bg-blue-500/15 transition-all"
                >
                  <Download className="w-3 h-3" /> Export Log
                </button>
                <button
                  onClick={clearAccuracyLog}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium
                             text-red-400 bg-red-500/8 border border-red-500/15
                             hover:bg-red-500/15 transition-all ml-auto"
                >
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function getAccuracyExportText(accuracyLog: AccuracyEntry[], threshold: number): string {
  if (accuracyLog.length === 0) return "";
  const avgScore = Math.round(accuracyLog.reduce((s, e) => s + e.overallScore, 0) / accuracyLog.length);
  const lowCount = accuracyLog.filter(e => e.overallScore < threshold).length;
  const lines: string[] = [
    "",
    "═══════════════════════════════════════════════",
    "           ACCURACY AUDIT LOG",
    "═══════════════════════════════════════════════",
    `Session Average: ${avgScore}%   Threshold: ${threshold}%`,
    `Total Tasks: ${accuracyLog.length}   Low-accuracy results: ${lowCount}`,
    "─────────────────────────────────────────────",
  ];
  for (const entry of accuracyLog) {
    const status = entry.overallScore >= threshold ? "PASS" : "⚠ REVIEW";
    lines.push(`${TASK_LABELS[entry.taskType] ?? entry.taskType} — ${entry.overallScore}%   [${status}]  ${new Date(entry.timestamp).toLocaleTimeString()}`);
    for (const sub of entry.subScores) {
      const bar = "█".repeat(Math.round(sub.score / 10)).padEnd(10, "░");
      lines.push(`  ${bar} ${sub.score}%  ${sub.dimension}${sub.value ? `  (${sub.value})` : ""}`);
    }
    if (entry.warnings.length > 0) {
      for (const w of entry.warnings) lines.push(`  ⚠ ${w}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
