import React, { useState, useEffect, useRef, useCallback } from "react";
import { Send, Trash2, Bot, User, Wifi, WifiOff, Loader2, Brain } from "lucide-react";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode: "online" | "offline";
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"} mb-3`}>
      <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
        isUser ? "bg-blue-500/20 border border-blue-500/30" : "bg-indigo-500/20 border border-indigo-500/30"
      }`}>
        {isUser ? <User className="w-3.5 h-3.5 text-blue-400" /> : <Bot className="w-3.5 h-3.5 text-indigo-400" />}
      </div>
      <div className={`max-w-[75%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
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
            msg.mode === "online"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-amber-500/10 text-amber-500"
          }`}>
            {msg.mode === "online" ? "Online AI" : "Offline AI"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMemory, setLoadingMemory] = useState(true);
  const [forceOffline, setForceOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const network = useNetworkStatus();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending]);

  const loadMemory = useCallback(async () => {
    try {
      const r = await authFetch(getApiUrl("/ai/memory"));
      const data = await r.json() as { memory: ChatMessage[] };
      if (data.memory && data.memory.length > 0) {
        setMessages(data.memory);
      }
    } catch { /* ok */ }
    setLoadingMemory(false);
  }, []);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  const clearMemory = async () => {
    if (!confirm("Clear all AI memory? This cannot be undone.")) return;
    try {
      await authFetch(getApiUrl("/ai/memory"), { method: "DELETE" });
      setMessages([]);
    } catch { /* ok */ }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
      mode: forceOffline || !network.isOnline ? "offline" : "online",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const r = await authFetch(getApiUrl("/ai/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, forceOffline: forceOffline || !network.isOnline }),
      });
      const data = await r.json() as { response: string; mode: string; assistantEntry: ChatMessage };

      const assistantMsg: ChatMessage = {
        id: data.assistantEntry?.id ?? `${Date.now()}-a`,
        role: "assistant",
        content: data.response,
        timestamp: data.assistantEntry?.timestamp ?? new Date().toISOString(),
        mode: (data.mode as "online" | "offline") ?? "offline",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `${Date.now()}-err`,
        role: "assistant",
        content: "Sorry, I could not connect to the AI engine. Please check your connection and try again.",
        timestamp: new Date().toISOString(),
        mode: "offline",
      };
      setMessages((prev) => [...prev, errMsg]);
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const effectiveMode = forceOffline || !network.isOnline ? "offline" : "online";

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-zinc-100">Ultra AI Chat</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            effectiveMode === "online"
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
              : "bg-amber-500/12 border border-amber-500/30 text-amber-400"
          }`}>
            {effectiveMode === "online" ? (
              <span className="flex items-center gap-1"><Wifi className="w-2.5 h-2.5" /> Online AI</span>
            ) : (
              <span className="flex items-center gap-1"><WifiOff className="w-2.5 h-2.5" /> Offline AI</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div
              onClick={() => setForceOffline(!forceOffline)}
              className={`w-7 h-4 rounded-full transition-colors relative ${forceOffline ? "bg-amber-500/70" : "bg-zinc-700"}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${forceOffline ? "translate-x-3.5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-[10px] text-zinc-500">Force Offline</span>
          </label>
          <button
            onClick={clearMemory}
            title="Clear memory"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-red-400 bg-red-500/8 border border-red-500/15 hover:bg-red-500/15 transition-colors"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {loadingMemory && (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading memory…
          </div>
        )}
        {!loadingMemory && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-sm gap-2">
            <Bot className="w-8 h-8 text-zinc-700" />
            <p>Start a conversation with Ultra AI</p>
            <p className="text-[11px]">Try: "What is roll forming?" or "Show CPU usage tips"</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {sending && (
          <div className="flex gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30">
              <Bot className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
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
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5
                       text-sm text-zinc-200 placeholder-zinc-600 resize-none
                       focus:outline-none focus:border-blue-500/40 focus:bg-white/[0.06]
                       transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-xl bg-blue-600/80 border border-blue-500/40
                       flex items-center justify-center text-white
                       hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-zinc-700 mt-1.5">
          Memory is persistent — conversations saved automatically
        </p>
      </div>
    </div>
  );
}
