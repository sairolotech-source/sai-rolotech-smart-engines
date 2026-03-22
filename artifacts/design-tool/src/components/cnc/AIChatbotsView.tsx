import React, { useState, useRef, useEffect, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Send, Bot, CheckCircle2, XCircle, AlertTriangle, FileText,
  Loader2, MessageCircle, ArrowLeft, Shield, Wifi, WifiOff,
  BarChart3, Sparkles,
} from "lucide-react";

type ChatbotCategory = "design" | "manufacturing" | "material" | "quality" | "process";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode?: "online" | "offline";
  provider?: string;
  sourceTag?: "Offline" | "Cloud" | "Edge";
}

interface QualityCheck {
  category: ChatbotCategory;
  name: string;
  icon: string;
  score: number;
  status: "pass" | "fail" | "warning";
  findings: string[];
  recommendations: string[];
}

interface QualityReport {
  overallScore: number;
  overallStatus: "pass" | "fail" | "warning";
  passCount: number;
  failCount: number;
  warningCount: number;
  checks: QualityCheck[];
  reportSummary: string;
  timestamp: string;
}

const CHATBOTS: { id: ChatbotCategory; name: string; nameHi: string; icon: string; color: string; desc: string }[] = [
  { id: "design", name: "Design Expert", nameHi: "डिज़ाइन एक्सपर्ट", icon: "✏️", color: "#3b82f6", desc: "Profile design, DXF, bend analysis" },
  { id: "manufacturing", name: "Manufacturing Expert", nameHi: "मैन्युफैक्चरिंग एक्सपर्ट", icon: "⚙️", color: "#f59e0b", desc: "G-code, CNC, machining" },
  { id: "material", name: "Material Expert", nameHi: "मटीरियल एक्सपर्ट", icon: "🔩", color: "#10b981", desc: "Steel grades, coatings, tools" },
  { id: "quality", name: "Quality Inspector", nameHi: "क्वालिटी इंस्पेक्टर", icon: "🔍", color: "#ef4444", desc: "Defects, tolerances, inspection" },
  { id: "process", name: "Process Optimizer", nameHi: "प्रोसेस ऑप्टिमाइज़र", icon: "📊", color: "#8b5cf6", desc: "Speed, efficiency, cost" },
];

type ViewMode = "chatbots" | "chat" | "quality-check" | "report";

export function AIChatbotsView() {
  const [viewMode, setViewMode] = useState<ViewMode>("chatbots");
  const [activeBot, setActiveBot] = useState<ChatbotCategory>("design");
  const [chatHistories, setChatHistories] = useState<Record<ChatbotCategory, ChatMessage[]>>({
    design: [], manufacturing: [], material: [], quality: [], process: [],
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { geometry, stations, materialType, materialThickness, rollTooling } = useCncStore();
  const thickness = materialThickness;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistories, activeBot, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { role: "user", content: msg, timestamp: new Date().toISOString() };
    setChatHistories(prev => ({
      ...prev,
      [activeBot]: [...prev[activeBot], userMsg],
    }));

    try {
      const res = await fetch(`/api/ai/chatbot/${activeBot}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: msg,
          history: chatHistories[activeBot],
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const data = await res.json();

      const providerMap: Record<string, string> = {
        "gemini-flash": "Gemini Flash",
        "claude-haiku": "Claude Haiku",
        "openrouter-llama": "OpenRouter Llama",
        "sambanova-llama": "SambaNova Llama",
        "kimi-moonshot": "Kimi Moonshot",
        "nvidia-llama-3.1": "NVIDIA Llama 3.1",
        "gpt-5-mini": "GPT-5 Mini",
        "offline-engine": "Offline Engine",
      };
      const providerLabel = providerMap[data.provider] ?? (data.mode === "online" ? "AI" : "Offline");

      const edgeProviders = ["sambanova-llama", "nvidia-llama-3.1"];
      const sourceTag: "Offline" | "Cloud" | "Edge" =
        data.mode === "offline" || data.provider === "offline-engine"
          ? "Offline"
          : edgeProviders.includes(data.provider)
          ? "Edge"
          : "Cloud";

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString(),
        mode: data.mode,
        provider: providerLabel,
        sourceTag,
      };
      setChatHistories(prev => ({
        ...prev,
        [activeBot]: [...prev[activeBot], assistantMsg],
      }));
    } catch {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: "Connection error. Please try again.",
        timestamp: new Date().toISOString(),
        mode: "offline",
        sourceTag: "Offline",
      };
      setChatHistories(prev => ({
        ...prev,
        [activeBot]: [...prev[activeBot], errorMsg],
      }));
    } finally {
      setLoading(false);
    }
  };

  const runQualityCheck = async () => {
    setQualityLoading(true);
    setQualityReport(null);

    try {
      const totalBends = geometry?.bendPoints?.length
        ? geometry.bendPoints.reduce((sum, bp) => sum + Math.abs(bp.angle), 0)
        : stations.length * 10;

      const bendAngles = geometry?.bendPoints?.map(bp => Math.abs(bp.angle));

      const res = await fetch("/api/ai/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          materialType: materialType || "Mild Steel",
          thickness: thickness || 1.5,
          numStations: stations.length || 8,
          totalBends: totalBends || 90,
          bendAngles,
          rollDiameter: ((rollTooling?.[0] as unknown) as Record<string, number> | undefined)?.upperRollOD || 150,
          lineSpeed: 15,
          profileComplexity: geometry ? "medium" : "simple",
        }),
      });

      if (!res.ok) throw new Error("Quality check failed");
      const data: QualityReport = await res.json();
      setQualityReport(data);
      setViewMode("report");
    } catch {
      setQualityReport(null);
    } finally {
      setQualityLoading(false);
    }
  };

  const openChat = (botId: ChatbotCategory) => {
    setActiveBot(botId);
    setViewMode("chat");
  };

  const activeBotConfig = CHATBOTS.find(b => b.id === activeBot)!;

  const statusColor = (s: string) =>
    s === "pass" ? "text-emerald-400" : s === "fail" ? "text-red-400" : "text-amber-400";
  const statusBg = (s: string) =>
    s === "pass" ? "bg-emerald-500/10 border-emerald-500/30" : s === "fail" ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30";
  const statusIcon = (s: string) =>
    s === "pass" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : s === "fail" ? <XCircle className="w-4 h-4 text-red-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />;

  if (viewMode === "report" && qualityReport) {
    return (
      <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center gap-3">
          <button onClick={() => setViewMode("chatbots")} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <Shield className="w-5 h-5 text-orange-400" />
          <div>
            <div className="text-sm font-bold text-white">Quality Check Report</div>
            <div className="text-[10px] text-zinc-500">5 Smart Experts — Final Analysis</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className={`rounded-xl border p-5 ${statusBg(qualityReport.overallStatus)}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {statusIcon(qualityReport.overallStatus)}
                <span className={`text-lg font-bold ${statusColor(qualityReport.overallStatus)}`}>
                  {qualityReport.overallStatus.toUpperCase()}
                </span>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-white">{qualityReport.overallScore}%</div>
                <div className="text-[10px] text-zinc-500">Overall Score</div>
              </div>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-emerald-400">✓ {qualityReport.passCount} Passed</span>
              <span className="text-amber-400">⚠ {qualityReport.warningCount} Warnings</span>
              <span className="text-red-400">✕ {qualityReport.failCount} Failed</span>
            </div>
          </div>

          {qualityReport.checks.map((check) => (
            <div key={check.category} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{check.icon}</span>
                  <span className="text-sm font-semibold text-white">{check.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {statusIcon(check.status)}
                  <span className={`text-sm font-bold ${statusColor(check.status)}`}>{check.score}%</span>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full bg-white/[0.06] mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    check.status === "pass" ? "bg-emerald-500" : check.status === "fail" ? "bg-red-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${check.score}%` }}
                />
              </div>

              {check.findings.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Findings</div>
                  {check.findings.map((f, i) => (
                    <div key={i} className="text-xs text-zinc-300 flex items-start gap-1.5 mb-1">
                      <span className="text-zinc-600 mt-0.5">•</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {check.recommendations.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Recommendations</div>
                  {check.recommendations.map((r, i) => (
                    <div key={i} className="text-xs text-blue-300 flex items-start gap-1.5 mb-1">
                      <span className="text-blue-600 mt-0.5">→</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-orange-400" />
              <span className="text-xs font-semibold text-zinc-400">Full Report (Offline Smart Engine)</span>
            </div>
            <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
              {qualityReport.reportSummary}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === "chat") {
    const messages = chatHistories[activeBot];
    return (
      <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center gap-3">
          <button onClick={() => setViewMode("chatbots")} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <span className="text-xl">{activeBotConfig.icon}</span>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">{activeBotConfig.name}</div>
            <div className="text-[10px] text-zinc-500">{activeBotConfig.nameHi} — {activeBotConfig.desc}</div>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
            <Sparkles className="w-2.5 h-2.5" />
            Smart Powered
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-60">
              <span className="text-4xl mb-3">{activeBotConfig.icon}</span>
              <div className="text-sm font-semibold text-zinc-400 mb-1">{activeBotConfig.name}</div>
              <div className="text-xs text-zinc-600 max-w-xs">
                Ask me anything about {activeBotConfig.desc.toLowerCase()}. I give you expert-level answers.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
                msg.role === "user"
                  ? "bg-blue-600/20 border border-blue-500/30 text-blue-100"
                  : "bg-white/[0.04] border border-white/[0.08] text-zinc-300"
              }`}>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="text-xs">{activeBotConfig.icon}</span>
                    <span className="text-[10px] font-semibold text-zinc-500">{activeBotConfig.name}</span>
                    {msg.provider && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                        msg.mode === "online"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                      }`}>
                        {msg.mode === "online" ? <Wifi className="w-2 h-2 inline mr-0.5" /> : <WifiOff className="w-2 h-2 inline mr-0.5" />}
                        {msg.provider}
                      </span>
                    )}
                    {msg.sourceTag && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        msg.sourceTag === "Cloud"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/25"
                          : msg.sourceTag === "Edge"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/25"
                          : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/25"
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
                <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                <span className="text-xs text-zinc-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-shrink-0 p-3 border-t border-white/[0.07]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`Ask ${activeBotConfig.name}...`}
              className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/40 transition-colors"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-orange-500/25 blur-md" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <Bot className="w-4.5 h-4.5 text-white" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-white">AI Expert Chatbots</div>
            <div className="text-[10px] text-zinc-500">5 Specialized Smart Experts — Quality Check System</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3">
          {CHATBOTS.map((bot) => {
            const msgCount = chatHistories[bot.id].length;
            return (
              <button
                key={bot.id}
                onClick={() => openChat(bot.id)}
                className="group w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: bot.color + "18", border: `1px solid ${bot.color}40` }}
                  >
                    {bot.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{bot.name}</span>
                      {msgCount > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400">
                          {msgCount} msgs
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{bot.nameHi}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{bot.desc}</div>
                  </div>
                  <MessageCircle className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-2">
          <button
            onClick={runQualityCheck}
            disabled={qualityLoading}
            className="w-full rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:from-orange-500/20 hover:to-amber-500/20 transition-all p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                {qualityLoading ? (
                  <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                ) : (
                  <BarChart3 className="w-5 h-5 text-orange-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-orange-300">
                  {qualityLoading ? "Running Quality Check..." : "Run Quality Check"}
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  All 5 Smart experts analyze your current design and generate a final report
                </div>
              </div>
              <Shield className="w-5 h-5 text-orange-500/50 flex-shrink-0" />
            </div>
          </button>
        </div>

        {qualityReport && (
          <button
            onClick={() => setViewMode("report")}
            className="w-full rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] transition-all p-3 flex items-center gap-3"
          >
            <FileText className="w-4 h-4 text-orange-400" />
            <div className="flex-1 text-left">
              <div className="text-xs font-semibold text-zinc-300">View Last Report</div>
              <div className="text-[10px] text-zinc-500">
                Score: {qualityReport.overallScore}% — {qualityReport.overallStatus.toUpperCase()}
              </div>
            </div>
            <span className={`text-xs font-bold ${statusColor(qualityReport.overallStatus)}`}>
              {qualityReport.overallScore}%
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
