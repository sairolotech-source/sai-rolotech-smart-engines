import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Download, Bot, User, Send, Loader2, Trash2,
  AlertTriangle, CheckCircle2, Cpu, WifiOff,
  RefreshCw, Brain,
} from "lucide-react";
import { useWebLLM } from "../../hooks/useWebLLM";

interface LocalChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

function ModelDownloadCard({
  onInitialize,
  progress,
  progressText,
  status,
  error,
  timeoutCountdown,
  vramWarning,
}: {
  onInitialize: () => void;
  progress: number;
  progressText: string;
  status: string;
  error: string | null;
  timeoutCountdown: number | null;
  vramWarning: string | null;
}) {
  const isDownloading = status === "downloading" || status === "checking" || status === "loading";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
        <Brain className="w-8 h-8 text-indigo-400" />
      </div>

      <div className="text-center max-w-sm">
        <h3 className="text-base font-semibold text-zinc-100 mb-1">Local AI Model</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Phi-3.5 Mini — a powerful 3.8B parameter language model that runs 100% in your browser.
          Download once (~2 GB), then use offline forever. No internet required after download.
        </p>
      </div>

      {vramWarning && (
        <div className="w-full max-w-sm bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-300 mb-0.5">Low GPU Memory</p>
            <p className="text-[11px] text-amber-400/80 leading-relaxed">{vramWarning}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="w-full max-w-sm bg-red-500/10 border border-red-500/25 rounded-xl p-3 flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-red-300 mb-0.5">Error</p>
            <p className="text-[11px] text-red-400/80 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {isDownloading && (
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">{progressText || "Loading…"}</span>
            <div className="flex items-center gap-2">
              {timeoutCountdown !== null && timeoutCountdown > 0 && (
                <span className="text-[10px] font-mono text-amber-400/70">
                  {Math.floor(timeoutCountdown / 60)}:{(timeoutCountdown % 60).toString().padStart(2, "0")}
                </span>
              )}
              <span className="text-xs font-mono text-zinc-300">{progress}%</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5 text-center">
            {status === "downloading"
              ? "Downloading model files — this may take several minutes on first run"
              : status === "loading"
              ? "Loading model into WebGPU memory…"
              : "Checking browser capabilities…"}
          </p>
        </div>
      )}

      {!isDownloading && (
        <button
          onClick={onInitialize}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600/80 border border-indigo-500/40
                     text-sm font-semibold text-white hover:bg-indigo-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          {error ? "Retry Download" : "Download AI Model"}
        </button>
      )}

      <div className="flex items-center gap-4 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> WebGPU Accelerated</span>
        <span className="flex items-center gap-1"><WifiOff className="w-3 h-3" /> 100% Offline</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cached in Browser</span>
      </div>
    </div>
  );
}

function UnsupportedCard() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-6">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-amber-400" />
      </div>
      <div className="text-center max-w-sm">
        <h3 className="text-base font-semibold text-zinc-100 mb-2">Device Not Supported</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">
          Your device does not support local AI. WebGPU is required to run language models in the browser.
        </p>
        <ul className="mt-3 text-[11px] text-zinc-600 space-y-1 text-left list-disc list-inside">
          <li>Use Chrome 113+ or Edge 113+ on a desktop</li>
          <li>Mobile devices are not supported</li>
          <li>Ensure hardware acceleration is enabled</li>
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          You can still use the <strong className="text-zinc-300">Online AI Chat</strong> tab for full AI capabilities.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ msg, aiStatus }: { msg: LocalChatMessage; aiStatus?: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"} mb-3`}>
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
        isUser ? "bg-blue-500/20 border border-blue-500/30" : "bg-indigo-500/20 border border-indigo-500/30"
      }`}>
        {isUser ? <User className="w-3.5 h-3.5 text-blue-400" /> : <Bot className="w-3.5 h-3.5 text-indigo-400" />}
      </div>
      <div className={`max-w-[78%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-blue-600/25 border border-blue-500/20 text-zinc-100"
            : "bg-white/[0.04] border border-white/[0.06] text-zinc-200"
        }`}>
          {msg.content}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-700">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            aiStatus === "ready_cpu" ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400"
          }`}>
            {aiStatus === "ready_cpu" ? "CPU AI" : "Local AI"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OfflineAIPanel() {
  const { state, isSupported, initialize, chat, reset } = useWebLLM();
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, generating]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || generating || (state.status !== "ready" && state.status !== "ready_cpu")) return;

    const userMsg: LocalChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setGenerating(true);

    try {
      const history = messages.slice(-8).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const response = await chat(text, history);

      const assistantMsg: LocalChatMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: LocalChatMessage = {
        id: `${Date.now()}-err`,
        role: "assistant",
        content: `Sai Rolotech AI — Response generate nahi ho saka. ${err instanceof Error ? err.message : "Please try again."}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }

    setGenerating(false);
    inputRef.current?.focus();
  }, [input, generating, state.status, chat, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (!confirm("Clear local AI chat history?")) return;
    setMessages([]);
  };

  if (state.status === "idle" || state.status === "not_downloaded" || state.status === "downloading" || state.status === "checking" || state.status === "loading" || state.status === "error" || state.status === "not_supported") {
    return (
      <ModelDownloadCard
        onInitialize={initialize}
        progress={state.progress}
        progressText={state.progressText}
        status={state.status}
        error={state.error}
        timeoutCountdown={state.timeoutCountdown}
        vramWarning={state.vramWarning}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-zinc-100">Local AI</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            state.status === "ready_cpu"
              ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
              : "bg-indigo-500/10 border border-indigo-500/25 text-indigo-400"
          }`}>
            {state.status === "ready_cpu" ? "CPU Mode · Knowledge Engine" : "Phi-3.5 Mini · 100% Offline"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            title="Unload model"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
          <button
            onClick={clearChat}
            title="Clear chat"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400 bg-red-500/8 border border-red-500/15 hover:bg-red-500/15 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2">
            <Bot className="w-8 h-8 text-zinc-700" />
            <p>Local AI ready — ask anything</p>
            <p className="text-[11px] text-center leading-relaxed">
              Roll forming defects · TurnAxis CAM G-code · CNC turning · Materials · Hindi/Urdu/English
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} aiStatus={state.status} />
        ))}
        {generating && (
          <div className="flex gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-white/[0.06]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything in Hindi, Urdu, or English… (Enter to send)"
            rows={2}
            disabled={generating}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5
                       text-sm text-zinc-200 placeholder-zinc-600 resize-none
                       focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06]
                       disabled:opacity-50 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={generating || !input.trim()}
            className="w-10 h-10 rounded-xl bg-indigo-600/80 border border-indigo-500/40
                       flex items-center justify-center text-white
                       hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex-shrink-0"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 mt-1.5">
          Running locally on your device · No internet · No data sent anywhere
        </p>
      </div>
    </div>
  );
}
