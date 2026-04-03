import React, { useState, useRef } from "react";
import { Shield, AlertTriangle, CheckCircle, Info, Upload, X, ChevronDown, ChevronRight, FileCode } from "lucide-react";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";

interface SafetyIssue {
  line: number;
  code: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  fix: string;
}

interface SafetyStats {
  programNumber: string;
  toolsUsed: string[];
  maxSpindleFound: number;
  maxFeedFound: number;
  safeZFound: number;
  hasM30: boolean;
  hasG28: boolean;
  hasM1: boolean;
  lineCount: number;
}

interface SafetyResult {
  passed: boolean;
  score: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: SafetyIssue[];
  summary: string[];
  stats: SafetyStats;
}

const SEV_CONFIG = {
  CRITICAL: { color: "text-red-400", bg: "bg-red-900/15", border: "border-red-500/30", icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />, label: "CRITICAL" },
  WARNING:  { color: "text-amber-400", bg: "bg-amber-900/15", border: "border-amber-500/30", icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />, label: "WARNING" },
  INFO:     { color: "text-blue-400", bg: "bg-blue-900/10", border: "border-blue-500/20", icon: <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />, label: "INFO" },
};

export function GcodeSafetyChecker() {
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "INFO">("ALL");
  const fileRef = useRef<HTMLInputElement>(null);

  const runCheck = async (gcode: string, name: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(name);
    try {
      const resp = await authFetch(getApiUrl("/gcode-safety-check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gcode }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Check failed");
      setResult(data.result as SafetyResult);
      setExpandedIssues(new Set(
        data.result.issues
          .filter((i: SafetyIssue) => i.severity === "CRITICAL")
          .map((_: SafetyIssue, idx: number) => idx)
      ));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Server error");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      runCheck(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const scoreColor = result
    ? result.score >= 90 ? "text-emerald-400" : result.score >= 70 ? "text-amber-400" : "text-red-400"
    : "text-zinc-400";

  const filteredIssues = result?.issues.filter(i =>
    filter === "ALL" || i.severity === filter
  ) ?? [];

  const toggleIssue = (idx: number) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-zinc-700/50 hover:border-cyan-500/40 rounded-xl p-4 text-center cursor-pointer transition-colors bg-zinc-900/30"
      >
        <input ref={fileRef} type="file" accept=".tap,.nc,.gcode,.txt" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <Upload className="w-5 h-5 text-zinc-500 mx-auto mb-1.5" />
        <div className="text-[11px] text-zinc-400 font-semibold">
          {loading ? "Checking..." : "TAP / NC / G-Code File Drop Karo"}
        </div>
        <div className="text-[10px] text-zinc-600 mt-0.5">.TAP .NC .GCODE supported — Delta 2X format</div>
      </div>

      {error && (
        <div className="text-[10px] text-red-400 flex items-center gap-1.5 p-2 rounded-lg bg-red-900/10 border border-red-500/20">
          <AlertTriangle className="w-3 h-3 shrink-0" />{error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className={`p-3 rounded-xl border ${result.passed ? "bg-emerald-950/20 border-emerald-500/30" : "bg-red-950/20 border-red-500/30"}`}>
            <div className="flex items-center gap-3 mb-2.5">
              {result.passed
                ? <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                : <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
              <div className="flex-1">
                <div className={`text-[13px] font-bold ${result.passed ? "text-emerald-300" : "text-red-300"}`}>
                  {result.passed ? "SAFETY CHECK PASSED" : "SAFETY CHECK FAILED"}
                </div>
                {fileName && <div className="text-[10px] text-zinc-500 flex items-center gap-1"><FileCode className="w-3 h-3" />{fileName}</div>}
              </div>
              <div className={`text-2xl font-black font-mono ${scoreColor}`}>{result.score}<span className="text-sm">/100</span></div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="text-center p-2 rounded-lg bg-red-900/20 border border-red-500/20">
                <div className="text-red-400 font-black text-lg">{result.criticalCount}</div>
                <div className="text-zinc-500">Critical</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-amber-900/20 border border-amber-500/20">
                <div className="text-amber-400 font-black text-lg">{result.warningCount}</div>
                <div className="text-zinc-500">Warning</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-blue-900/15 border border-blue-500/20">
                <div className="text-blue-400 font-black text-lg">{result.infoCount}</div>
                <div className="text-zinc-500">Info</div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-700/30 space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 mb-1.5">Program Info</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              {result.summary.map((s, i) => (
                <div key={i} className="text-zinc-400 font-mono">{s}</div>
              ))}
            </div>
          </div>

          {result.issues.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-zinc-400">Filter:</span>
                {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold transition-all ${filter === f
                      ? f === "CRITICAL" ? "bg-red-900/40 border-red-500/50 text-red-300"
                        : f === "WARNING" ? "bg-amber-900/40 border-amber-500/50 text-amber-300"
                        : f === "INFO" ? "bg-blue-900/30 border-blue-500/40 text-blue-300"
                        : "bg-zinc-700/50 border-zinc-600/50 text-zinc-200"
                      : "bg-transparent border-zinc-700/30 text-zinc-500 hover:text-zinc-300"}`}>
                    {f} {f !== "ALL" && `(${result.issues.filter(i => i.severity === f).length})`}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                {filteredIssues.map((issue, idx) => {
                  const cfg = SEV_CONFIG[issue.severity];
                  const isOpen = expandedIssues.has(idx);
                  return (
                    <div key={idx} className={`rounded-lg border overflow-hidden ${cfg.bg} ${cfg.border}`}>
                      <button
                        onClick={() => toggleIssue(idx)}
                        className="w-full flex items-start gap-2 px-2.5 py-2 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        {cfg.icon}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                            <span className="text-[9px] text-zinc-500 font-mono">{issue.code}</span>
                            <span className="text-[9px] text-zinc-600 ml-auto">Line {issue.line}</span>
                          </div>
                          <div className={`text-[10px] font-semibold ${cfg.color} leading-tight`}>{issue.message}</div>
                        </div>
                        {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" /> : <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />}
                      </button>
                      {isOpen && (
                        <div className="px-2.5 pb-2 border-t border-white/[0.04]">
                          <div className="text-[10px] text-emerald-300/80 mt-1.5 flex items-start gap-1.5">
                            <CheckCircle className="w-3 h-3 shrink-0 mt-0.5 text-emerald-400" />
                            <span><span className="font-semibold text-emerald-400">Fix:</span> {issue.fix}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result.issues.length === 0 && (
            <div className="text-[11px] text-emerald-400 flex items-center gap-2 p-3 rounded-lg bg-emerald-950/15 border border-emerald-500/20">
              <CheckCircle className="w-4 h-4" /> Koi safety issue nahi mili — G-code clean hai
            </div>
          )}

          <button
            onClick={() => { setResult(null); setFileName(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="w-full text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center justify-center gap-1 py-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}
