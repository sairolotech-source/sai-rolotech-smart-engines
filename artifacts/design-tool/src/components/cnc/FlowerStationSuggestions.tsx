import React, { useState, useCallback } from "react";
import {
  Sparkles, Loader2, ChevronDown, ChevronUp,
  Lightbulb, AlertTriangle, RefreshCw, Bot, WifiOff,
} from "lucide-react";
import { useCncStore } from "../../store/useCncStore";
import { getDeepseekKey } from "../../hooks/usePersonalAIKey";

const KEYS_STORAGE = "sai_gemini_keys";
function getAllGeminiKeys(): { id: string; key: string; label: string }[] {
  try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "[]"); } catch { return []; }
}

interface SuggestionCategory {
  id: string;
  label: string;
  icon: string;
  suggestions: string[];
}

interface SuggestionsResult {
  ok: boolean;
  usedAI: boolean;
  stationNum: number;
  categories: SuggestionCategory[];
  error?: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function fetchSuggestions(payload: Record<string, unknown>): Promise<SuggestionsResult> {
  const token = localStorage.getItem("sai_auth_token") ?? "";
  const res = await fetch(`${API_BASE}/api/flower-suggestions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55000),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json() as Promise<SuggestionsResult>;
}

function CategoryPanel({ cat, defaultOpen }: { cat: SuggestionCategory; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      >
        <span className="text-base">{cat.icon}</span>
        <span className="text-[11px] font-semibold text-zinc-200 flex-1 text-left">{cat.label}</span>
        <span className="text-[10px] text-zinc-500 font-mono">{cat.suggestions.length} tips</span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="p-2 space-y-1.5">
          {cat.suggestions.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-amber-500/[0.05] border border-amber-500/10">
              <span className="text-[10px] font-bold text-amber-400 w-4 flex-shrink-0 mt-0.5 text-center">
                {i + 1}
              </span>
              <Lightbulb className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-100/80 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FlowerStationSuggestions() {
  const store = useCncStore();
  const {
    stations, rollTooling, materialType, materialThickness,
    numStations, lineSpeed, rollDiameter, shaftDiameter,
  } = store;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStationIdx, setSelectedStationIdx] = useState(1);
  const [collapsed, setCollapsed] = useState(false);

  const stationOptions = stations.length > 0
    ? stations.map((s, i) => ({ idx: i, label: `Station ${i + 1}${s.label ? ` (${s.label})` : ""}` }))
    : Array.from({ length: Math.max(numStations, 2) }, (_, i) => ({ idx: i, label: `Station ${i + 1}` }));

  const getSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stationIdx = selectedStationIdx;
      const stn = stations[stationIdx];
      const rt = rollTooling[stationIdx];

      const prevAngle = stationIdx > 0
        ? (stations[stationIdx - 1]?.bendAngles?.slice(-1)[0] ?? 0)
        : 0;
      const bendAngle = stn?.bendAngles?.slice(-1)[0] ?? (((stationIdx + 1) / numStations) * 90);
      const finalAngle = stations.length > 0
        ? (stations[stations.length - 1]?.bendAngles?.slice(-1)[0] ?? 90)
        : 90;

      const rollOD = rt?.upperRollOD ?? rollDiameter ?? 150;
      const formingForce = rt?.shaftCalc
        ? Math.round((rt.shaftCalc as { combinedMoment?: number }).combinedMoment ?? 12)
        : 12;
      const stationLabel = rt?.stationId ?? stn?.label ?? `S${String(stationIdx + 1).padStart(2, "0")}`;

      const personalGeminiKeys = getAllGeminiKeys().filter(k => k.key);
      const personalDeepseekKey = getDeepseekKey() || undefined;

      const payload = {
        stationIndex: stationIdx,
        totalStations: Math.max(numStations, stations.length),
        materialType,
        thickness: materialThickness,
        rollOD,
        shaftDia: shaftDiameter,
        bendAngle,
        previousAngle: prevAngle,
        finalAngle,
        formingForce,
        lineSpeed,
        grooveDepth: rt?.rollProfile?.grooveDepth ?? 0,
        stationLabel,
        profileComplexity: stations.length >= 8 ? "complex" : "standard",
        personalGeminiKeys,
        personalDeepseekKey,
      };

      const data = await fetchSuggestions(payload);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — check API server");
    } finally {
      setLoading(false);
    }
  }, [
    selectedStationIdx, stations, rollTooling, materialType, materialThickness,
    numStations, lineSpeed, rollDiameter, shaftDiameter,
  ]);

  const hasKeys = getAllGeminiKeys().length > 0 || !!getDeepseekKey();

  return (
    <div className="rt-card border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${result ? "bg-amber-400" : "bg-zinc-600"}`} />
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] font-semibold text-zinc-300 flex-1 text-left">
          AI Suggestions — Flower Pattern Station
        </span>
        {result && (
          <span className="text-[10px] text-amber-400 font-mono">
            {result.categories.length}×10
          </span>
        )}
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
          : <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
        }
      </button>

      {!collapsed && (
        <div className="border-t border-white/[0.06] p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wide block mb-1">
                Select Station
              </label>
              <select
                value={selectedStationIdx}
                onChange={e => { setSelectedStationIdx(Number(e.target.value)); setResult(null); }}
                className="w-full text-[11px] bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5
                           text-zinc-200 focus:outline-none focus:border-amber-500/40"
              >
                {stationOptions.map(s => (
                  <option key={s.idx} value={s.idx}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-shrink-0 self-end">
              <button
                onClick={getSuggestions}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold
                            transition-all ${loading
                  ? "bg-amber-500/10 text-amber-400/50 border border-amber-500/10 cursor-not-allowed"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25"
                }`}
              >
                {loading
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                  : result
                    ? <><RefreshCw className="w-3 h-3" /> Refresh</>
                    : <><Sparkles className="w-3 h-3" /> Get 10 Suggestions/Category</>
                }
              </button>
            </div>
          </div>

          {!hasKeys && !result && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/[0.07] border border-blue-500/20">
              <WifiOff className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-300/80 leading-relaxed">
                No Gemini / DeepSeek key saved — will use offline engineering database.
                Add keys in <strong>AI Settings</strong> for live Gemini suggestions.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/[0.08] border border-red-500/20">
              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-300 leading-snug">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-2 py-6">
              <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
              <p className="text-[11px] text-zinc-400">
                Gemini generating 10 suggestions × 8 categories…
              </p>
              <p className="text-[10px] text-zinc-600">This may take 15–30 seconds</p>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg
                              bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
                <Bot className="w-3.5 h-3.5 text-amber-400" />
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-amber-300">
                    {result.usedAI ? "Gemini AI" : "Offline Engineering DB"} — Station {result.stationNum} of {Math.max(numStations, stations.length)}
                  </p>
                  <p className="text-[9px] text-zinc-500">
                    {result.categories.length} categories × 10 suggestions = {result.categories.length * 10} total
                  </p>
                </div>
                {result.usedAI && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
                    LIVE AI
                  </span>
                )}
                {!result.usedAI && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/50 border border-zinc-600/40 text-zinc-400 font-semibold">
                    OFFLINE
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                {result.categories.map((cat, i) => (
                  <CategoryPanel key={cat.id} cat={cat} defaultOpen={i < 2} />
                ))}
              </div>
            </div>
          )}

          {!result && !loading && !error && (
            <div className="text-center py-5">
              <Sparkles className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-500">
                Select a station and click <strong className="text-amber-400">Get 10 Suggestions/Category</strong>
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">
                Gemini will analyze station data and give 10 specific engineering
                improvements for 8 categories (80 total)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
