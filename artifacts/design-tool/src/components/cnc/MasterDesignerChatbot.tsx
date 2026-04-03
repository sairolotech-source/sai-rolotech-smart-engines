import React, { useState, useRef, useEffect, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Send, Bot, Loader2, ArrowLeft, Sparkles, Wifi, WifiOff, AlertTriangle,
  Wrench, Shield, Cpu, ChevronDown,
} from "lucide-react";
import { getAllKeysForFallback, markKeyFailedById, getDeepseekKey } from "../../hooks/usePersonalAIKey";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode?: "online" | "offline";
  provider?: string;
  sourceTag?: "Offline" | "Cloud" | "Edge";
}

/**
 * Builds a structured project context object passed to the Master Designer AI.
 * This provides the AI with real-time access to all project entities:
 * geometry, stations (flower), roll tooling, G-code, validation, BOM, dimensions.
 */
function buildProjectContext(store: ReturnType<typeof useCncStore.getState>): string {
  const ctx = {
    sectionModel: store.sectionModel ?? "not-selected",
    profileType: store.openSectionType ?? "unknown",
    material: {
      type: store.materialType,
      thicknessMm: store.materialThickness,
      kFactor: store.kFactor ?? "auto",
      bendMethod: store.bendAllowanceMethod,
    },
    machine: {
      rollDiameterMm: store.rollDiameter,
      shaftDiameterMm: store.shaftDiameter,
      arborLengthMm: store.arborLength,
      lineSpeedMpm: store.lineSpeed,
      motorPowerKw: store.motorPower,
      motorRpm: store.motorRPM,
    },
    geometry: store.geometry ? {
      segments: (store.geometry.segments ?? []).length,
      bendPoints: (store.geometry.bendPoints ?? []).length,
      widthMm: parseFloat((store.geometry.boundingBox.maxX - store.geometry.boundingBox.minX).toFixed(2)),
      heightMm: parseFloat((store.geometry.boundingBox.maxY - store.geometry.boundingBox.minY).toFixed(2)),
    } : null,
    validation: {
      approved: store.validationApproved,
      layers: store.validationResults.map(r => ({
        id: r.layerId,
        score: r.score,
        status: r.status,
      })),
    },
    confirmedDimensions: store.confirmedDimensions
      .filter(d => d.confirmed)
      .slice(0, 10)
      .map(d => ({
        type: d.type,
        value: d.override ?? d.value,
        unit: d.type === "angular" ? "deg" : "mm",
        label: d.text,
      })),
    stations: store.stations.slice(0, 8).map(st => ({
      number: st.stationNumber,
      label: st.label,
      totalAngleDeg: parseFloat((Math.abs(st.totalAngle) * 180 / Math.PI).toFixed(2)),
      bendCount: st.bendAngles.length,
      passZone: st.passZone,
      springbackCompDeg: st.springbackCompensationAngle
        ? parseFloat(st.springbackCompensationAngle.toFixed(3))
        : null,
      hasTooling: store.rollTooling.some(rt => rt.stationNumber === st.stationNumber),
      hasGcode: store.gcodeOutputs.some(g => g.stationNumber === st.stationNumber),
    })),
    rollTooling: store.rollTooling.slice(0, 6).filter(rt => !!rt.rollProfile).map(rt => ({
      station: rt.stationNumber,
      rollDiameterMm: rt.rollProfile!.rollDiameter,
      rollWidthMm: parseFloat(rt.rollProfile!.rollWidth.toFixed(2)),
      grooveDepthMm: parseFloat(rt.rollProfile!.grooveDepth.toFixed(2)),
      gapMm: parseFloat(rt.rollProfile!.gap.toFixed(3)),
      kFactor: parseFloat(rt.rollProfile!.kFactor.toFixed(4)),
    })),
    designScore: store.designScore ? {
      score: store.designScore.overallScore,
      grade: store.designScore.grade,
      warnings: store.designScore.warnings?.slice(0, 3) ?? [],
    } : null,
  };

  return JSON.stringify(ctx, null, 2);
}

function buildContextString(store: ReturnType<typeof useCncStore.getState>): string {
  return buildProjectContext(store);
}

const QUICK_PROMPTS = [
  "What's the optimal number of forming stations for my current profile?",
  "Review my flower pattern and identify any springback risks",
  "What roll material should I use for this gauge and material?",
  "Check my G-code for potential issues",
  "What common defects should I watch for with this profile?",
  "How should I set the roll gap for this material thickness?",
];

export function MasterDesignerChatbot() {
  const store = useCncStore();
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: "assistant",
    content: `Hello — I'm the Master Designer, your roll forming expert with 50 years of deep industry knowledge.\n\nI have full access to your current project data and can help with:\n• Flower pattern optimization and station count\n• Roll tooling design and material selection\n• Springback compensation strategies\n• G-code review and machine parameters\n• Defect diagnosis and root cause analysis\n• Material selection and bend radius guidance\n• Machine BOM and line speed recommendations\n\nWhat would you like to discuss about your roll forming project?`,
    timestamp: new Date().toISOString(),
    mode: "offline",
    sourceTag: "Offline",
    provider: "Master Designer",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (msgText?: string) => {
    const msg = (msgText || input).trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    const contextNote = buildContextString(useCncStore.getState());

    const userMsg: ChatMessage = { role: "user", content: msg, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chatbot/master-designer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10),
          projectContext: contextNote,
          personalGeminiKeys: getAllKeysForFallback(),
          personalDeepseekKey: getDeepseekKey() || undefined,
        }),
      });

      let data: { response: string; mode: string; provider: string; failedKeyIds?: string[] };
      if (!res.ok) throw new Error("API error");
      data = await res.json();
      if (data.failedKeyIds?.length) {
        for (const id of data.failedKeyIds) markKeyFailedById(id);
      }

      const providerMap: Record<string, string> = {
        "gemini-flash": "Gemini Flash", "claude-haiku": "Claude Haiku",
        "openrouter-llama": "OpenRouter Llama", "sambanova-llama": "SambaNova Llama",
        "gpt-5-mini": "GPT-5", "offline-engine": "Offline Engine",
      };
      const edgeProviders = ["sambanova-llama", "nvidia-llama-3.1"];
      const sourceTag: "Offline" | "Cloud" | "Edge" =
        data.mode === "offline" ? "Offline" :
        edgeProviders.includes(data.provider) ? "Edge" : "Cloud";

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
        mode: data.mode as "online" | "offline",
        provider: providerMap[data.provider] ?? data.provider,
        sourceTag,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Network error — switching to offline knowledge base for your response.",
        timestamp: new Date().toISOString(),
        mode: "offline",
        sourceTag: "Offline",
        provider: "Master Designer (Offline)",
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-xl bg-amber-500/30 blur-md" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Master Designer</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 font-semibold flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> 50-Year Expert
              </span>
            </div>
            <div className="text-[10px] text-zinc-500">Roll Forming Master AI — Full project context access</div>
          </div>
          <button
            onClick={() => setShowContext(!showContext)}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors flex items-center gap-1 text-[10px] text-zinc-500"
          >
            <Cpu className="w-3 h-3" />
            <ChevronDown className={`w-3 h-3 transition-transform ${showContext ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showContext && (() => {
          const s = store;
          return (
            <div className="mt-2.5 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1">
              <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">Live Project Context</div>
              {Object.entries({
                "AI Model": s.sectionModel ? (s.sectionModel === "open" ? "Open Section (A)" : "Closed Section (B)") : "Not selected",
                "Section Type": s.openSectionType,
                "Material": `${s.materialType} @ ${s.materialThickness}mm`,
                "Stations": s.stations.length,
                "Roll Sets": s.rollTooling.length,
                "G-Code Programs": s.gcodeOutputs.length,
                "Validation": s.validationApproved ? "APPROVED" : s.validationResults.length > 0 ? `${s.validationResults.filter(r => r.status === "pass").length}/5 layers` : "Not run",
                "Design Score": s.designScore?.overallScore !== undefined ? `${s.designScore.overallScore}/100` : "—",
              }).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600">{k}</span>
                  <span className="text-[10px] text-zinc-300 font-mono">{String(v)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
              msg.role === "user"
                ? "bg-blue-600/20 border border-blue-500/30 text-blue-100"
                : "bg-white/[0.04] border border-white/[0.08] text-zinc-300"
            }`}>
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="text-lg">🧠</span>
                  <span className="text-[10px] font-semibold text-amber-400">Master Designer</span>
                  {msg.provider && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                      msg.mode === "online"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                    }`}>
                      {msg.mode === "online" ? <Wifi className="w-2 h-2" /> : <WifiOff className="w-2 h-2" />}
                      {msg.provider}
                    </span>
                  )}
                  {msg.sourceTag && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      msg.sourceTag === "Cloud" ? "bg-blue-500/10 text-blue-400 border border-blue-500/25" :
                      msg.sourceTag === "Edge" ? "bg-purple-500/10 text-purple-400 border border-purple-500/25" :
                      "bg-zinc-500/10 text-zinc-400 border border-zinc-500/25"
                    }`}>
                      {msg.sourceTag === "Cloud" ? "☁" : msg.sourceTag === "Edge" ? "⚡" : "📴"} {msg.sourceTag}
                    </span>
                  )}
                </div>
              )}
              <div className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
              <span className="text-xs text-zinc-500">Master Designer is analyzing your project...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 2 && !loading && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Quick questions</div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.slice(0, 3).map((prompt, i) => (
              <button
                key={i}
                onClick={() => sendMessage(prompt)}
                className="text-[10px] px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15] transition-all text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-white/[0.07]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask the Master Designer about your roll forming project..."
            className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 transition-colors"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 px-1">
          <Shield className="w-3 h-3 text-zinc-700" />
          <span className="text-[9px] text-zinc-700">Responds with 50-year roll forming expertise using live project data</span>
        </div>
      </div>
    </div>
  );
}
