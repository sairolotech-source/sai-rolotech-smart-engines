import React, { useState, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import {
  Brain, Loader2, ChevronDown, ChevronUp, AlertTriangle, AlertOctagon,
  Info, Lightbulb, Sparkles,
} from "lucide-react";

interface DesignIssue {
  severity: string;
  title: string;
  detail: string;
  recommendation: string;
}

interface DesignAnalysis {
  summary: string;
  manufacturabilityScore: number;
  issues: DesignIssue[];
  optimizations: string[];
  materialNotes: string;
}

export function AIDesignAnalyzer() {
  const { materialType, materialThickness, numStations, stations, rollDiameter, shaftDiameter, lineSpeed } = useCncStore();
  const [analysis, setAnalysis] = useState<DesignAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"online" | "offline">("offline");
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalBends = stations.length > 0 ? (stations[stations.length - 1]?.bendAngles?.length ?? 0) : 0;
  const bendAngles = stations.length > 0 ? (stations[stations.length - 1]?.bendAngles ?? []) : [];
  const complexity = totalBends >= 5 ? "complex" : "simple";

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(getApiUrl("/ai/analyze-design"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialType,
          thickness: materialThickness,
          numStations,
          totalBends,
          bendAngles,
          rollDiameter,
          shaftDiameter,
          lineSpeed,
          profileComplexity: complexity,
          kFactor: 0.44,
          maxThinningRatio: 0.93,
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        const a = data.analysis;
        setAnalysis({
          manufacturabilityScore: a.manufacturabilityScore ?? 0,
          summary: a.summary ?? "",
          issues: Array.isArray(a.issues) ? a.issues : [],
          optimizations: Array.isArray(a.optimizations) ? a.optimizations : [],
          materialNotes: a.materialNotes ?? "",
        });
        setMode(data.mode ?? "offline");
      } else {
        setError(data.error ?? "Analysis failed");
      }
    } catch {
      setError("Failed to connect to smart engine service");
    } finally {
      setLoading(false);
    }
  }, [materialType, materialThickness, numStations, totalBends, bendAngles, rollDiameter, shaftDiameter, lineSpeed, complexity]);

  const score = analysis?.manufacturabilityScore ?? 0;
  const scoreColor = score >= 85 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-red-400";
  const scoreBg = score >= 85 ? "bg-emerald-900/20 border-emerald-500/20" : score >= 70 ? "bg-amber-900/20 border-amber-500/20" : "bg-red-900/20 border-red-500/20";

  return (
    <div className="rt-card border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <Brain className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[11px] font-semibold text-zinc-300 flex-1 text-left">AI Design Analyzer</span>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />}
          {analysis && !loading && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${scoreBg} ${scoreColor}`}>
              {score}% · {mode === "online" ? "GPT" : "Offline"}
            </span>
          )}
          {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-3 space-y-3">
          {!analysis && !loading && (
            <div className="text-center space-y-2">
              <Brain className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-[11px] text-zinc-500">Get Smart manufacturability analysis of your profile design</p>
              <button
                onClick={runAnalysis}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold
                  text-violet-400 bg-violet-500/10 border border-violet-500/20
                  hover:bg-violet-500/20 transition-all mx-auto"
              >
                <Sparkles className="w-3 h-3" /> Analyze Design
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              <p className="text-[11px] text-zinc-500">Running smart analysis…</p>
            </div>
          )}

          {error && (
            <div className="px-2 py-2 rounded bg-red-950/20 border border-red-500/20 text-[10px] text-red-300">{error}</div>
          )}

          {analysis && !loading && (
            <>
              <div className={`p-2.5 rounded-lg border ${scoreBg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-zinc-300">Manufacturability Score</span>
                  <span className={`text-lg font-black font-mono ${scoreColor}`}>{score}%</span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-snug">{analysis.summary}</p>
              </div>

              {analysis.issues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Issues Found</p>
                  {analysis.issues.map((issue, i) => (
                    <div key={i} className={`p-2 rounded-lg border text-[10px] space-y-1
                      ${issue.severity === "critical" ? "bg-red-950/20 border-red-500/20" :
                        issue.severity === "warning" ? "bg-amber-950/20 border-amber-500/20" :
                        "bg-blue-950/20 border-blue-500/20"}`}>
                      <div className="flex items-center gap-1.5">
                        {issue.severity === "critical"
                          ? <AlertOctagon className="w-3 h-3 text-red-400 flex-shrink-0" />
                          : issue.severity === "warning"
                          ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          : <Info className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                        <span className={`font-semibold ${issue.severity === "critical" ? "text-red-300" : issue.severity === "warning" ? "text-amber-300" : "text-blue-300"}`}>
                          {issue.title}
                        </span>
                      </div>
                      <p className="text-zinc-400">{issue.detail}</p>
                      <p className="text-emerald-300/80 italic">→ {issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}

              {analysis.optimizations.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Optimizations</p>
                  {analysis.optimizations.map((opt, i) => (
                    <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-violet-500/6 border border-violet-500/12">
                      <Lightbulb className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-violet-200/80 leading-snug">{opt}</p>
                    </div>
                  ))}
                </div>
              )}

              {analysis.materialNotes && (
                <div className="px-2 py-1.5 rounded bg-cyan-500/6 border border-cyan-500/12">
                  <p className="text-[10px] text-cyan-300/80">{analysis.materialNotes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
                <span className="text-[9px] text-zinc-600">
                  {mode === "online" ? "Powered by GPT-4o-mini" : "Offline rule-based analysis"}
                </span>
                <button
                  onClick={runAnalysis}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium
                    text-violet-400 bg-violet-500/8 border border-violet-500/15
                    hover:bg-violet-500/15 transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" /> Re-analyze
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
