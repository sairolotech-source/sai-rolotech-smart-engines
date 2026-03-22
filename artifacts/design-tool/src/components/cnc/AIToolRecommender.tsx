import React, { useState, useCallback, useEffect } from "react";
import { useCncStore } from "../../store/useCncStore";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import {
  Wrench, Loader2, ChevronDown, ChevronRight, Sparkles, AlertTriangle, Package, Database,
} from "lucide-react";

interface ToolRec {
  operation: string;
  insert: string;
  holder?: string;
  vc?: number;
  feed?: number;
  doc?: number;
  reason: string;
  fromLibrary?: boolean;
}

interface MaterialRec {
  grade: string;
  reason: string;
  alternatives?: { grade: string; reason: string }[];
}

interface ToolRecommendation {
  summary: string;
  materialRecommendation: MaterialRec;
  toolRecommendations: ToolRec[];
  costEfficiency: string;
  warnings: string[];
}

interface LibraryTool {
  id: string;
  name: string;
  category: string;
  subType: string;
  isoDesignation?: string;
  holderCode?: string;
  gradeCode?: string;
  coatingType?: string;
}

export function AIToolRecommender() {
  const { materialType, materialThickness, rollDiameter, shaftDiameter, stations } = useCncStore();
  const [recommendation, setRecommendation] = useState<ToolRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"online" | "offline" | "library">("offline");
  const [error, setError] = useState<string | null>(null);
  const [libraryToolCount, setLibraryToolCount] = useState(0);

  const totalBends = stations.length > 0 ? (stations[stations.length - 1]?.bendAngles?.length ?? 0) : 0;
  const complexity = totalBends >= 5 ? "complex" : "simple";

  useEffect(() => {
    if (!expanded) return;
    authFetch(getApiUrl("/tools?category=turning"))
      .then(r => r.json())
      .then(data => {
        if (data.success) setLibraryToolCount(data.tools.length);
      })
      .catch(() => {});
  }, [expanded]);

  const runRecommend = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(getApiUrl("/ai/recommend-tools"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialType,
          thickness: materialThickness,
          rollDiameter,
          shaftDiameter,
          profileComplexity: complexity,
          totalBends,
          useToolLibrary: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.recommendation) {
        const r = data.recommendation;

        let toolRecs: ToolRec[] = Array.isArray(r.toolRecommendations) ? r.toolRecommendations : [];

        if (libraryToolCount > 0) {
          try {
            const libRes = await authFetch(getApiUrl("/tools?category=turning"));
            const libData = await libRes.json();
            if (libData.success && libData.tools.length > 0) {
              toolRecs = toolRecs.map(rec => {
                if (!rec.insert) return rec;
                const recFamily = rec.insert.split(" ")[0];
                const exactMatch = libData.tools.find((t: LibraryTool) =>
                  t.isoDesignation && t.isoDesignation === rec.insert
                );
                const familyMatch = !exactMatch ? libData.tools.find((t: LibraryTool) =>
                  t.isoDesignation && t.isoDesignation.startsWith(recFamily + " ")
                ) : null;
                const match = exactMatch || familyMatch;
                if (match) {
                  return {
                    ...rec,
                    insert: match.isoDesignation || match.name,
                    holder: match.holderCode || rec.holder,
                    reason: `${rec.reason} [Matched from your library: ${match.name}]`,
                    fromLibrary: true,
                  };
                }
                return rec;
              });
            }
          } catch { /* continue with AI recommendations */ }
        }

        setRecommendation({
          summary: r.summary ?? "",
          materialRecommendation: r.materialRecommendation ?? { grade: "", reason: "" },
          toolRecommendations: toolRecs,
          costEfficiency: r.costEfficiency ?? "",
          warnings: Array.isArray(r.warnings) ? r.warnings : [],
        });
        setMode(toolRecs.some(t => t.fromLibrary) ? "library" : (data.mode ?? "offline"));
      } else {
        setError(data.error ?? "Recommendation failed");
      }
    } catch {
      setError("Failed to connect to smart engine service");
    } finally {
      setLoading(false);
    }
  }, [materialType, materialThickness, rollDiameter, shaftDiameter, complexity, totalBends, libraryToolCount]);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 text-teal-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">AI Tool Recommender</span>
        {recommendation && (
          <span className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded ${mode === "library" ? "bg-emerald-900/40 text-emerald-300" : "bg-zinc-800 text-teal-300"}`}>
            {mode === "online" ? "GPT" : mode === "library" ? "Library" : "Offline"}
          </span>
        )}
        <span className="ml-auto">
          {expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-zinc-500">
              {materialType} &middot; {materialThickness}mm &middot; Ø{rollDiameter}mm roll
              {libraryToolCount > 0 && (
                <span className="ml-2 text-emerald-400/60">
                  <Database className="w-3 h-3 inline mr-0.5" />{libraryToolCount} library tools
                </span>
              )}
            </div>
            <button
              onClick={runRecommend}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-teal-900/40 hover:bg-teal-900/60 border border-teal-500/30 text-teal-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {loading ? "Analyzing..." : "AI Recommend"}
            </button>
          </div>

          {error && (
            <div className="px-2 py-2 rounded bg-red-950/20 border border-red-500/20 text-[10px] text-red-300">{error}</div>
          )}

          {recommendation && (
            <>
              <div className="p-2.5 rounded-lg bg-teal-950/15 border border-teal-500/20">
                <p className="text-[10px] text-zinc-300 leading-snug">{recommendation.summary}</p>
              </div>

              {recommendation.materialRecommendation?.grade && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Material Grade</p>
                  <div className="p-2.5 rounded-lg bg-teal-950/10 border border-teal-500/15">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-[11px] font-semibold text-teal-300 font-mono">
                        {recommendation.materialRecommendation.grade}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1">{recommendation.materialRecommendation.reason}</p>
                    {recommendation.materialRecommendation.alternatives && recommendation.materialRecommendation.alternatives.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[9px] text-zinc-500 uppercase">Alternatives:</p>
                        {recommendation.materialRecommendation.alternatives.map((alt, i) => (
                          <div key={i} className="text-[10px] text-zinc-500">
                            <span className="text-teal-400/70 font-mono">{alt.grade}</span> — {alt.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {recommendation.toolRecommendations.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">CNC Tooling</p>
                  {recommendation.toolRecommendations.map((tr, i) => (
                    <div key={i} className={`p-2 rounded-lg border text-[10px] space-y-1 ${tr.fromLibrary ? "bg-emerald-900/10 border-emerald-500/20" : "bg-zinc-900/60 border-zinc-700/40"}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-teal-300">{tr.operation}</span>
                        <div className="flex items-center gap-1">
                          {tr.fromLibrary && <Database className="w-3 h-3 text-emerald-400" />}
                          <span className="font-mono bg-teal-900/40 text-teal-200 px-1.5 py-0.5 rounded">{tr.insert}</span>
                        </div>
                      </div>
                      {(tr.vc || tr.feed || tr.doc) && (
                        <div className="flex gap-3 text-zinc-500">
                          {tr.vc && <span>Vc: <span className="text-zinc-300 font-mono">{tr.vc}</span></span>}
                          {tr.feed && <span>Feed: <span className="text-zinc-300 font-mono">{tr.feed}</span></span>}
                          {tr.doc && <span>DOC: <span className="text-zinc-300 font-mono">{tr.doc}</span></span>}
                        </div>
                      )}
                      {tr.holder && <div className="text-zinc-500">{tr.holder}</div>}
                      <div className="text-amber-300/70 italic">{tr.reason}</div>
                    </div>
                  ))}
                </div>
              )}

              {recommendation.warnings && recommendation.warnings.length > 0 && (
                <div className="space-y-1">
                  {recommendation.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 px-2 py-1.5 rounded bg-amber-500/8 border border-amber-500/15">
                      <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-300 leading-snug">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {recommendation.costEfficiency && (
                <div className="px-2 py-1.5 rounded bg-teal-500/6 border border-teal-500/12">
                  <p className="text-[10px] text-teal-300/80">{recommendation.costEfficiency}</p>
                </div>
              )}

              <div className="text-[9px] text-zinc-600 text-right">
                {mode === "online" ? "Powered by GPT-4o-mini" : mode === "library" ? "Using your tool library + rule-based analysis" : "Offline rule-based analysis"}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
