import React, { useState, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import {
  Flower2, Loader2, ChevronDown, ChevronRight, AlertTriangle, Sparkles,
} from "lucide-react";

interface AngleZone {
  zone: string;
  stations: string;
  maxAnglePerPass: number;
  notes: string;
}

interface DefectRisk {
  defect: string;
  risk: string;
  cause: string;
  prevention: string;
}

interface FlowerAdvice {
  summary: string;
  recommendedStations: number;
  stationStrategy: string;
  angleDistribution: AngleZone[];
  defectRisks: DefectRisk[];
  materialAdvice: string;
}

export function AIFlowerAdvisor() {
  const { materialType, materialThickness, stations, numStations } = useCncStore();
  const [advice, setAdvice] = useState<FlowerAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"online" | "offline">("offline");
  const [error, setError] = useState<string | null>(null);

  const lastStation = stations.length > 0 ? stations[stations.length - 1] : null;
  const totalBends = lastStation?.bendAngles?.length ?? 0;
  const bendAngles = lastStation?.bendAngles ?? [];
  const segmentLengths = lastStation?.segmentLengths ?? [];
  const complexity = totalBends >= 5 ? "complex" : "simple";

  const runAdvise = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(getApiUrl("/ai/advise-flower"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialType,
          thickness: materialThickness,
          totalBends,
          bendAngles,
          flangeHeights: segmentLengths,
          profileComplexity: complexity,
        }),
      });
      const data = await res.json();
      if (data.success && data.advice) {
        const a = data.advice;
        setAdvice({
          summary: a.summary ?? "",
          recommendedStations: a.recommendedStations ?? 0,
          stationStrategy: a.stationStrategy ?? "",
          angleDistribution: Array.isArray(a.angleDistribution) ? a.angleDistribution : [],
          defectRisks: Array.isArray(a.defectRisks) ? a.defectRisks : [],
          materialAdvice: a.materialAdvice ?? "",
        });
        setMode(data.mode ?? "offline");
      } else {
        setError(data.error ?? "Advice failed");
      }
    } catch {
      setError("Failed to connect to smart engine service");
    } finally {
      setLoading(false);
    }
  }, [materialType, materialThickness, totalBends, bendAngles, segmentLengths, complexity]);

  const riskColor = (risk: string) => {
    if (risk === "high") return "text-red-400 bg-red-950/20 border-red-500/20";
    if (risk === "medium") return "text-amber-400 bg-amber-950/20 border-amber-500/20";
    return "text-emerald-400 bg-emerald-950/20 border-emerald-500/20";
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Flower2 className="w-3.5 h-3.5 text-pink-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">AI Flower Advisor</span>
        {advice && (
          <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-pink-300">
            {advice.recommendedStations} stn · {mode === "online" ? "GPT" : "Offline"}
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
              {materialType} · {materialThickness}mm · {totalBends} bends · {numStations} stations
            </div>
            <button
              onClick={runAdvise}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-pink-900/40 hover:bg-pink-900/60 border border-pink-500/30 text-pink-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {loading ? "Analyzing..." : "Get Advice"}
            </button>
          </div>

          {error && (
            <div className="px-2 py-2 rounded bg-red-950/20 border border-red-500/20 text-[10px] text-red-300">{error}</div>
          )}

          {advice && (
            <>
              <div className="p-2.5 rounded-lg bg-pink-950/15 border border-pink-500/20">
                <p className="text-[10px] text-zinc-300 leading-snug">{advice.summary}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="text-center">
                    <div className="text-lg font-black font-mono text-pink-300">{advice.recommendedStations}</div>
                    <div className="text-[9px] text-zinc-500">Recommended Stations</div>
                  </div>
                  <div className="flex-1 text-[10px] text-zinc-400">{advice.stationStrategy}</div>
                </div>
              </div>

              {advice && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Current vs Recommended</p>
                  <div className="rounded-lg border border-white/[0.08] overflow-hidden">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-white/[0.03]">
                          <th className="px-2.5 py-1.5 text-left text-zinc-500 font-medium">Parameter</th>
                          <th className="px-2.5 py-1.5 text-center text-zinc-500 font-medium">Current</th>
                          <th className="px-2.5 py-1.5 text-center text-zinc-500 font-medium">Recommended</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        <tr>
                          <td className="px-2.5 py-1.5 text-zinc-400">Stations</td>
                          <td className={`px-2.5 py-1.5 text-center font-mono ${numStations !== advice.recommendedStations ? "text-red-300" : "text-zinc-300"}`}>{numStations}</td>
                          <td className={`px-2.5 py-1.5 text-center font-mono ${numStations !== advice.recommendedStations ? "text-emerald-300" : "text-zinc-300"}`}>{advice.recommendedStations}</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-zinc-400">Avg °/pass</td>
                          <td className="px-2.5 py-1.5 text-center font-mono text-red-300">
                            {totalBends > 0 && numStations > 0 ? (totalBends / numStations * (180 / Math.PI)).toFixed(1) + "°" : "N/A"}
                          </td>
                          <td className="px-2.5 py-1.5 text-center font-mono text-emerald-300">
                            {totalBends > 0 && advice.recommendedStations > 0 ? (totalBends / advice.recommendedStations * (180 / Math.PI)).toFixed(1) + "°" : "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-zinc-400">Strategy</td>
                          <td className="px-2.5 py-1.5 text-center text-zinc-500">Manual</td>
                          <td className="px-2.5 py-1.5 text-center text-emerald-300/80">{advice.stationStrategy.split(" ").slice(0, 3).join(" ")}</td>
                        </tr>
                        <tr>
                          <td className="px-2.5 py-1.5 text-zinc-400">Material</td>
                          <td className="px-2.5 py-1.5 text-center font-mono text-zinc-300" colSpan={2}>{materialType} · {materialThickness}mm</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {advice.angleDistribution.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Angle Distribution</p>
                  <div className="grid gap-1.5">
                    {advice.angleDistribution.map((zone, i) => (
                      <div key={i} className="p-2 rounded bg-zinc-900/60 border border-zinc-700/40 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-pink-300">{zone.zone}</span>
                          <span className="font-mono text-zinc-400">Stn {zone.stations}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-zinc-500">Max angle/pass: <span className="text-zinc-300 font-mono">{zone.maxAnglePerPass}°</span></span>
                        </div>
                        <p className="text-zinc-500 mt-0.5">{zone.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {advice.defectRisks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">Defect Risks</p>
                  {advice.defectRisks.map((dr, i) => (
                    <div key={i} className={`p-2 rounded-lg border text-[10px] space-y-1 ${riskColor(dr.risk)}`}>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span className="font-semibold">{dr.defect}</span>
                        <span className={`ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          dr.risk === "high" ? "bg-red-500/20 text-red-300" :
                          dr.risk === "medium" ? "bg-amber-500/20 text-amber-300" :
                          "bg-emerald-500/20 text-emerald-300"
                        }`}>{dr.risk}</span>
                      </div>
                      <p className="text-zinc-400">{dr.cause}</p>
                      <p className="text-emerald-300/80 italic">→ {dr.prevention}</p>
                    </div>
                  ))}
                </div>
              )}

              {advice.materialAdvice && (
                <div className="px-2 py-1.5 rounded bg-pink-500/6 border border-pink-500/12">
                  <p className="text-[10px] text-pink-300/80">{advice.materialAdvice}</p>
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
