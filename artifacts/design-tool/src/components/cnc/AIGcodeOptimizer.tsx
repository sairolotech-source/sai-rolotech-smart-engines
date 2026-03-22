import React, { useState, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import {
  Zap, Loader2, ChevronDown, ChevronRight, Shield, Gauge, Gem,
  AlertTriangle, AlertOctagon, Info,
} from "lucide-react";

interface GcodeSuggestion {
  category: string;
  severity: string;
  title: string;
  detail: string;
  currentValue: string;
  suggestedValue: string;
  confidence?: number;
}

interface GcodeOptimization {
  summary: string;
  safetyScore: number;
  suggestions: GcodeSuggestion[];
  estimatedImprovement: string;
}

const categoryIcon = (cat: string) => {
  if (cat === "safety") return <Shield className="w-3 h-3 text-red-400 flex-shrink-0" />;
  if (cat === "performance") return <Gauge className="w-3 h-3 text-amber-400 flex-shrink-0" />;
  return <Gem className="w-3 h-3 text-blue-400 flex-shrink-0" />;
};

export function AIGcodeOptimizer() {
  const { gcodeOutputs, materialType, rollDiameter } = useCncStore();
  const [optimization, setOptimization] = useState<GcodeOptimization | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"online" | "offline">("offline");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (gcodeOutputs.length === 0) return null;

  const runOptimize = useCallback(async () => {
    const gco = gcodeOutputs[selectedIdx];
    if (!gco) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(getApiUrl("/ai/optimize-gcode"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gcode: gco.gcode,
          materialType,
          machineType: "Delta 2X (Sai Rolotech Smart Engines — 2X_DELTA2 controller)",
          rollDiameter,
        }),
      });
      const data = await res.json();
      if (data.success && data.optimization) {
        const o = data.optimization;
        setOptimization({
          safetyScore: o.safetyScore ?? 0,
          summary: o.summary ?? "",
          suggestions: Array.isArray(o.suggestions) ? o.suggestions : [],
          estimatedImprovement: o.estimatedImprovement ?? "",
        });
        setMode(data.mode ?? "offline");
      } else {
        setError(data.error ?? "Optimization failed");
      }
    } catch {
      setError("Failed to connect to AI service");
    } finally {
      setLoading(false);
    }
  }, [gcodeOutputs, selectedIdx, materialType, rollDiameter]);

  const safetyScore = optimization?.safetyScore ?? 0;
  const safetyColor = safetyScore >= 85 ? "text-emerald-400" : safetyScore >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">AI G-Code Optimizer</span>
        {optimization && (
          <span className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 ${safetyColor}`}>
            Safety: {safetyScore}%
          </span>
        )}
        <span className="ml-auto">
          {expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-zinc-500 block mb-1">G-Code Program</label>
              <select
                value={selectedIdx}
                onChange={e => setSelectedIdx(parseInt(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-yellow-500 focus:outline-none"
              >
                {gcodeOutputs.map((go, idx) => (
                  <option key={idx} value={idx}>{go.label} ({go.lineCount} lines)</option>
                ))}
              </select>
            </div>
            <button
              onClick={runOptimize}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-yellow-900/40 hover:bg-yellow-900/60 border border-yellow-500/30 text-yellow-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {loading ? "Analyzing..." : "AI Optimize"}
            </button>
          </div>

          {error && (
            <div className="px-2 py-2 rounded bg-red-950/20 border border-red-500/20 text-[10px] text-red-300">{error}</div>
          )}

          {optimization && (
            <>
              <div className={`p-2.5 rounded-lg border ${safetyScore >= 85 ? "bg-emerald-950/20 border-emerald-500/20" : safetyScore >= 70 ? "bg-amber-950/20 border-amber-500/20" : "bg-red-950/20 border-red-500/20"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-zinc-300">Safety Score</span>
                  <span className={`text-lg font-black font-mono ${safetyColor}`}>{safetyScore}%</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-snug">{optimization.summary}</p>
              </div>

              {optimization.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
                    Suggestions ({optimization.suggestions.length})
                  </p>
                  {optimization.suggestions.map((s, i) => {
                    const conf = typeof s.confidence === "number" ? s.confidence : null;
                    const confColor = conf !== null
                      ? conf >= 85 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : conf >= 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                      : "";
                    return (
                    <div key={i} className={`p-2 rounded-lg border text-[10px] space-y-1
                      ${s.severity === "critical" ? "bg-red-950/20 border-red-500/20" :
                        s.severity === "warning" ? "bg-amber-950/20 border-amber-500/20" :
                        "bg-blue-950/20 border-blue-500/20"}`}>
                      <div className="flex items-center gap-1.5">
                        {s.severity === "critical"
                          ? <AlertOctagon className="w-3 h-3 text-red-400 flex-shrink-0" />
                          : s.severity === "warning"
                          ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          : <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                        <span className="font-semibold text-zinc-200">{s.title}</span>
                        {categoryIcon(s.category)}
                        {conf !== null && (
                          <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded border ${confColor}`}>
                            {conf}% confident
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-400">{s.detail}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-red-300/70 font-mono">Now: {s.currentValue}</span>
                        <span className="text-zinc-600">→</span>
                        <span className="text-emerald-300/80 font-mono">Use: {s.suggestedValue}</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {optimization.suggestions.length === 0 && (
                <div className="text-center text-xs text-emerald-400 py-2">
                  No issues found — G-code looks good
                </div>
              )}

              {optimization.estimatedImprovement && (
                <div className="px-2 py-1.5 rounded bg-yellow-500/6 border border-yellow-500/12">
                  <p className="text-[10px] text-yellow-300/80">{optimization.estimatedImprovement}</p>
                </div>
              )}

              <div className="text-[9px] text-zinc-600 text-right">
                {mode === "online" ? "Powered by GPT-4o-mini" : "Offline rule-based analysis"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
