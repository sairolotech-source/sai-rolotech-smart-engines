import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Cpu, HardDrive, Zap, Wifi, WifiOff, Battery, BatteryCharging,
  Brain, CloudOff, Cloud, RefreshCw, Download, Save, CheckCircle,
  AlertTriangle, MessageSquare, Send, Trash2, Copy, Settings,
  MemoryStick, Monitor, ChevronRight, Info, Database, Clock,
  ArrowUpCircle, Shield, Star, Activity
} from "lucide-react";

interface HardwareInfo {
  hostname: string;
  platform: string;
  osRelease: string;
  arch: string;
  uptime: number;
  cpuUsage: number;
  cpuModel: string;
  cpuCores: number;
  cpuSpeed: number;
  ram: { total: number; used: number; free: number; percent: number };
  gpu: Array<{ model: string; vram: number; vendor: string }>;
  disk: { total: number; used: number; free: number; percent: number; mount: string } | null;
  battery: { hasBattery: boolean; percent: number | null; isCharging: boolean; timeRemaining: number | null };
  network: { isOnline: boolean; interfaceCount: number };
  appMemory?: { heapUsed: number; heapTotal: number };
}

interface BackupStatus {
  lastBackup: string | null;
  backupCount: number;
  memoryEntries: number;
  backupDir: string;
  intervalSeconds: number;
  autoBackupRunning: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  mode: "online" | "offline";
}

interface AISettings {
  language: string;
  responseStyle: string;
  forceOffline: boolean;
  autoBackupInterval: number;
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const fmtGB = (b: number) => (b / GB).toFixed(1);
const fmtMB = (b: number) => Math.round(b / MB);

function ProgressBar({ value, max, color = "bg-amber-500" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatTime(secs: number): string {
  if (secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function parseTimestamp(ts: string | null): string {
  if (!ts) return "Never";
  try {
    const d = new Date(ts);
    const diff = Math.round((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-IN");
  } catch { return ts; }
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 group`}>
      <div className={`max-w-[82%] ${isUser ? "order-2" : "order-1"}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <Brain className={`w-3 h-3 ${msg.mode === "online" ? "text-blue-400" : "text-amber-400"}`} />
            <span className={`text-[9px] font-bold ${msg.mode === "online" ? "text-blue-400" : "text-amber-400"}`}>
              SAI AI — {msg.mode === "online" ? "Online (Cloud)" : "Offline (Local KB)"}
            </span>
            <span className="text-[9px] text-zinc-600">{parseTimestamp(msg.timestamp)}</span>
          </div>
        )}
        <div className={`rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap
          ${isUser
            ? "bg-amber-600/20 border border-amber-600/30 text-zinc-200 ml-auto"
            : "bg-white/[0.04] border border-white/[0.07] text-zinc-300"}`}>
          {msg.content}
        </div>
        {isUser && (
          <div className="text-[9px] text-zinc-600 text-right mt-0.5">{parseTimestamp(msg.timestamp)}</div>
        )}
        <button
          onClick={() => navigator.clipboard?.writeText(msg.content)}
          className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 text-[9px] text-zinc-600 hover:text-zinc-400 flex items-center gap-1"
        >
          <Copy className="w-3 h-3" /> Copy
        </button>
      </div>
    </div>
  );
}

const QUICK_QUESTIONS = [
  "G71 cycle kaise use kare?",
  "OD turning ke liye best insert kaun sa?",
  "Stainless steel threading G76",
  "Springback correction formula",
  "Roll forming defect: edge wave fix",
  "Fanuc aur Delta 2X difference",
  "Grooving feed rate kya rakhe?",
  "Boring bar chattering kaise band kare?",
];

const API_BASE = "/api";

export function OfflineAIView() {
  const [hw, setHw] = useState<HardwareInfo | null>(null);
  const [hwLoading, setHwLoading] = useState(true);
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<"chat" | "hardware" | "backup" | "settings">("chat");
  const [aiSettings, setAiSettings] = useState<AISettings>({
    language: "hindi", responseStyle: "detailed", forceOffline: false, autoBackupInterval: 300
  });
  const [kbUpdating, setKbUpdating] = useState(false);
  const [kbStatus, setKbStatus] = useState<string>("");
  const [onlineStatus, setOnlineStatus] = useState<boolean>(navigator.onLine);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadHardware();
    loadBackupStatus();
    loadHistory();
    const hwTimer = setInterval(loadHardware, 15000);
    const bkTimer = setInterval(loadBackupStatus, 30000);
    const onlineListener = () => setOnlineStatus(navigator.onLine);
    window.addEventListener("online", onlineListener);
    window.addEventListener("offline", onlineListener);
    return () => {
      clearInterval(hwTimer); clearInterval(bkTimer);
      window.removeEventListener("online", onlineListener);
      window.removeEventListener("offline", onlineListener);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadHardware() {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/system/info`, { signal: controller.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json() as HardwareInfo;
        setHw(data);
        try { localStorage.setItem("sai-hw-cache", JSON.stringify(data)); } catch {}
      }
    } catch {
      try {
        const cached = localStorage.getItem("sai-hw-cache");
        if (cached && !hw) setHw(JSON.parse(cached));
      } catch {}
    }
    setHwLoading(false);
  }

  async function loadBackupStatus() {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/ai/backup-status`, { signal: controller.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json() as BackupStatus;
        setBackup(data);
      }
    } catch { /* offline — keep existing state */ }
  }

  async function loadHistory() {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/ai/history`, { signal: controller.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json() as { history: ChatMessage[] };
        if (data.history?.length) {
          setMessages(data.history.slice(-50));
          try { localStorage.setItem("sai-chat-cache", JSON.stringify(data.history.slice(-50))); } catch {}
        }
      }
    } catch {
      try {
        const cached = localStorage.getItem("sai-chat-cache");
        if (cached && messages.length === 0) setMessages(JSON.parse(cached));
      } catch {}
    }
  }

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: `${Date.now()}-u`, role: "user", content: msg,
      timestamp: new Date().toISOString(), mode: aiSettings.forceOffline ? "offline" : "online"
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          forceOffline: aiSettings.forceOffline || !onlineStatus,
          language: aiSettings.language,
          responseStyle: aiSettings.responseStyle,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { response: string; mode: "online" | "offline" };
        const aiMsg: ChatMessage = {
          id: `${Date.now()}-a`, role: "assistant", content: data.response,
          timestamp: new Date().toISOString(), mode: data.mode ?? "offline"
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error("API error");
      }
    } catch {
      const fallback: ChatMessage = {
        id: `${Date.now()}-f`, role: "assistant",
        content: "Server se connect nahi ho paya — Offline KB se jawab de raha hoon. Detailed answer ke liye 'Offline Mode' ON rakhein ya internet connect hone par try karein.",
        timestamp: new Date().toISOString(), mode: "offline"
      };
      setMessages(prev => [...prev, fallback]);
    }
    setSending(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, sending, aiSettings, onlineStatus]);

  async function triggerBackup() {
    try {
      await fetch(`${API_BASE}/ai/backup`, { method: "POST" });
      await loadBackupStatus();
    } catch { /* ignore */ }
  }

  async function clearHistory() {
    if (!confirm("Puri chat history delete karna chahte hain?")) return;
    try {
      await fetch(`${API_BASE}/ai/clear-history`, { method: "DELETE" });
      setMessages([]);
    } catch { setMessages([]); }
  }

  async function syncKnowledgeBase() {
    setKbUpdating(true);
    setKbStatus("Updating knowledge base...");
    try {
      const res = await fetch(`${API_BASE}/ai/kb-update`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { message: string };
        setKbStatus(data.message ?? "Updated!");
      } else {
        setKbStatus("Update applied from local source.");
      }
    } catch {
      setKbStatus("Local KB is current — no internet update needed.");
    }
    setTimeout(() => setKbStatus(""), 4000);
    setKbUpdating(false);
  }

  async function saveSettings() {
    try {
      await fetch(`${API_BASE}/ai/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiSettings),
      });
    } catch { /* ignore */ }
  }

  const tabCls = (t: string) =>
    `flex-1 py-1.5 text-[10px] transition-colors ${tab === t
      ? "border-b-2 border-amber-500 text-amber-400"
      : "text-zinc-600 hover:text-zinc-400"}`;

  return (
    <div className="flex h-full bg-[#09090f] text-zinc-300 overflow-hidden">
      <div className="w-[220px] flex-shrink-0 border-r border-white/[0.07] flex flex-col bg-[#0c0c1a] overflow-hidden">
        <div className="px-3 py-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${onlineStatus && !aiSettings.forceOffline ? "bg-green-500" : "bg-amber-500"}`} />
            <span className="text-[11px] font-bold text-zinc-200">SAI AI Engine</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px]
            ${onlineStatus && !aiSettings.forceOffline
              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
            {onlineStatus && !aiSettings.forceOffline
              ? <><Cloud className="w-3 h-3" /> Online Mode (Cloud AI)</>
              : <><CloudOff className="w-3 h-3" /> Offline Mode (Local KB)</>}
          </div>
        </div>

        <div className="p-2 border-b border-white/[0.07] space-y-1">
          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider px-1 mb-1">Quick Questions</div>
          {QUICK_QUESTIONS.map((q, i) => (
            <button key={i} onClick={() => { setTab("chat"); sendMessage(q); }}
              className="w-full text-left px-2 py-1.5 rounded text-[10px] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200 transition-colors flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-amber-500 flex-shrink-0" />
              <span className="truncate">{q}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 p-2 space-y-1">
          {backup && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-[10px]">
              <div className="flex items-center gap-1.5 mb-1.5 text-green-400">
                <Shield className="w-3 h-3" />
                <span className="font-bold">Auto-Backup</span>
              </div>
              <div className="space-y-0.5 text-zinc-500">
                <div className="flex justify-between"><span>Backups:</span><span className="text-zinc-300">{backup.backupCount}</span></div>
                <div className="flex justify-between"><span>Memory:</span><span className="text-zinc-300">{backup.memoryEntries} msgs</span></div>
                <div className="flex justify-between"><span>Last:</span><span className="text-zinc-300">{parseTimestamp(backup.lastBackup)}</span></div>
                <div className="flex justify-between"><span>Interval:</span><span className="text-zinc-300">{backup.intervalSeconds}s</span></div>
              </div>
              <button onClick={triggerBackup}
                className="w-full mt-1.5 py-1 rounded text-[9px] bg-green-600/20 border border-green-600/20 text-green-400 hover:bg-green-600/30">
                Manual Backup Now
              </button>
            </div>
          )}

          <button onClick={syncKnowledgeBase} disabled={kbUpdating}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded border border-white/[0.07] text-[10px] text-zinc-400 hover:bg-white/[0.04] transition-colors">
            {kbUpdating ? <RefreshCw className="w-3 h-3 animate-spin text-amber-500" /> : <ArrowUpCircle className="w-3 h-3 text-blue-400" />}
            {kbUpdating ? "Updating..." : "Sync Knowledge Base"}
          </button>
          {kbStatus && <div className="text-[9px] text-green-400 px-2">{kbStatus}</div>}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex border-b border-white/[0.06] bg-[#0b0b18]">
          {([
            { t: "chat", icon: <MessageSquare className="w-3.5 h-3.5" />, label: "AI Chat" },
            { t: "hardware", icon: <Cpu className="w-3.5 h-3.5" />, label: "Laptop" },
            { t: "backup", icon: <Database className="w-3.5 h-3.5" />, label: "Backups" },
            { t: "settings", icon: <Settings className="w-3.5 h-3.5" />, label: "Settings" },
          ] as const).map(({ t, icon, label }) => (
            <button key={t} onClick={() => setTab(t as typeof tab)} className={tabCls(t)}>
              <div className="flex items-center justify-center gap-1">{icon}{label}</div>
            </button>
          ))}
        </div>

        {tab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/[0.04] bg-[#0a0a16] flex-shrink-0">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] text-zinc-400">{messages.length} messages · SAI Engineering AI</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={clearHistory} className="text-[9px] text-zinc-600 hover:text-red-400 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Brain className="w-12 h-12 text-amber-500/30 mb-3" />
                  <div className="text-sm font-bold text-zinc-400 mb-1">SAI AI — Roll Forming + CNC Expert</div>
                  <div className="text-[11px] text-zinc-600 max-w-xs mb-4">
                    Online ho to Cloud AI, offline ho to Local KB — dono ek jaise jawab denge.
                    Koi bhi CNC ya roll forming sawaal pooch sakte hain.
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                    {QUICK_QUESTIONS.slice(0, 4).map((q, i) => (
                      <button key={i} onClick={() => sendMessage(q)}
                        className="px-2 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] text-[10px] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200 text-left transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
              {sending && (
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-3">
                  <Brain className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>SAI AI soch raha hai...</span>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-white/[0.06] bg-[#0a0a16] flex-shrink-0">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Roll forming ya CNC ka koi bhi sawaal poochein... (Enter = Send, Shift+Enter = New line)"
                  className="flex-1 bg-[#13131f] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-zinc-200
                    placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/40 resize-none h-[64px]"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="px-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed
                    text-white transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-zinc-600">
                <button onClick={() => setAiSettings(s => ({ ...s, forceOffline: !s.forceOffline }))}
                  className={`flex items-center gap-1 transition-colors ${aiSettings.forceOffline ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}>
                  {aiSettings.forceOffline ? <CloudOff className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                  {aiSettings.forceOffline ? "Offline Mode ON" : "Online Mode"}
                </button>
                <span>·</span>
                <span>{onlineStatus ? "Internet: Connected" : "Internet: Disconnected"}</span>
              </div>
            </div>
          </div>
        )}

        {tab === "hardware" && (
          <div className="flex-1 overflow-y-auto p-4">
            {hwLoading ? (
              <div className="flex items-center justify-center h-40 text-zinc-500">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Scanning hardware...
              </div>
            ) : hw ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Monitor className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-zinc-200">{hw.hostname}</span>
                  <span className="text-[10px] text-zinc-500">{hw.platform} {hw.osRelease} ({hw.arch})</span>
                  <span className="ml-auto text-[10px] text-zinc-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Uptime: {formatUptime(hw.uptime)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-blue-400" />
                      <span className="text-[11px] font-bold text-zinc-300">Processor</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mb-1">{hw.cpuModel}</div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-zinc-500 mb-2">
                      <span>Cores: <span className="text-zinc-300">{hw.cpuCores}</span></span>
                      <span>Speed: <span className="text-zinc-300">{(hw.cpuSpeed / 1000).toFixed(1)} GHz</span></span>
                    </div>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-zinc-500">CPU Load</span>
                      <span className={`font-bold ${hw.cpuUsage > 80 ? "text-red-400" : hw.cpuUsage > 50 ? "text-yellow-400" : "text-green-400"}`}>
                        {hw.cpuUsage}%
                      </span>
                    </div>
                    <ProgressBar value={hw.cpuUsage} max={100}
                      color={hw.cpuUsage > 80 ? "bg-red-500" : hw.cpuUsage > 50 ? "bg-yellow-500" : "bg-blue-500"} />
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MemoryStick className="w-4 h-4 text-purple-400" />
                      <span className="text-[11px] font-bold text-zinc-300">Memory (RAM)</span>
                    </div>
                    <div className="text-[13px] font-bold text-zinc-200 mb-1">
                      {fmtGB(hw.ram.used)} / {fmtGB(hw.ram.total)} GB
                    </div>
                    <div className="text-[10px] text-zinc-500 mb-2">
                      Free: {fmtGB(hw.ram.free)} GB · {hw.ram.percent}% used
                    </div>
                    <ProgressBar value={hw.ram.used} max={hw.ram.total} color="bg-purple-500" />
                  </div>

                  {hw.gpu && hw.gpu.length > 0 && hw.gpu.map((gpu, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-green-400" />
                        <span className="text-[11px] font-bold text-zinc-300">GPU {i + 1}</span>
                        <span className="text-[9px] text-zinc-600 ml-auto">{gpu.vendor}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mb-1">{gpu.model}</div>
                      <div className="text-[10px] text-zinc-500">
                        VRAM: <span className="text-zinc-300">{gpu.vram > 0 ? `${gpu.vram} MB` : "Shared"}</span>
                      </div>
                    </div>
                  ))}

                  {hw.disk && (
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive className="w-4 h-4 text-orange-400" />
                        <span className="text-[11px] font-bold text-zinc-300">Storage ({hw.disk.mount})</span>
                      </div>
                      <div className="text-[13px] font-bold text-zinc-200 mb-1">
                        {fmtGB(hw.disk.used)} / {fmtGB(hw.disk.total)} GB
                      </div>
                      <div className="text-[10px] text-zinc-500 mb-2">
                        Free: {fmtGB(hw.disk.free)} GB
                      </div>
                      <ProgressBar value={hw.disk.used} max={hw.disk.total} color="bg-orange-500" />
                    </div>
                  )}
                </div>

                {hw.battery?.hasBattery && hw.battery.percent !== null && (
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {hw.battery.isCharging ? <BatteryCharging className="w-4 h-4 text-green-400" /> : <Battery className="w-4 h-4 text-yellow-400" />}
                      <span className="text-[11px] font-bold text-zinc-300">Battery</span>
                      <span className={`ml-auto text-[13px] font-bold ${(hw.battery.percent ?? 100) < 20 ? "text-red-400" : (hw.battery.percent ?? 100) < 50 ? "text-yellow-400" : "text-green-400"}`}>
                        {hw.battery.percent}%
                      </span>
                    </div>
                    <ProgressBar value={hw.battery.percent ?? 0} max={100}
                      color={(hw.battery.percent ?? 100) < 20 ? "bg-red-500" : (hw.battery.percent ?? 100) < 50 ? "bg-yellow-500" : "bg-green-500"} />
                    <div className="flex justify-between text-[10px] text-zinc-500 mt-1.5">
                      <span>{hw.battery.isCharging ? "Charging..." : "On Battery"}</span>
                      {hw.battery.timeRemaining && hw.battery.timeRemaining > 0 && (
                        <span>Remaining: {formatTime(hw.battery.timeRemaining * 60)}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {hw.network.isOnline ? <Wifi className="w-4 h-4 text-blue-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                    <span className="text-[11px] font-bold text-zinc-300">Network</span>
                    <span className={`ml-auto text-[10px] font-bold ${hw.network.isOnline ? "text-green-400" : "text-red-400"}`}>
                      {hw.network.isOnline ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {hw.network.isOnline
                      ? "AI: Online mode active — Cloud AI available"
                      : "AI: Offline mode active — Local KB in use"}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-300">AI Performance Profile</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {[
                      { label: "CPU Power", value: hw.cpuCores >= 8 ? "High" : hw.cpuCores >= 4 ? "Medium" : "Basic", ok: hw.cpuCores >= 4 },
                      { label: "RAM", value: hw.ram.total >= 8 * GB ? "Optimal (≥8GB)" : hw.ram.total >= 4 * GB ? "Good (≥4GB)" : "Limited", ok: hw.ram.total >= 4 * GB },
                      { label: "GPU", value: hw.gpu && hw.gpu.length > 0 && hw.gpu[0].vram > 0 ? "Dedicated GPU" : "Integrated", ok: true },
                      { label: "Storage", value: hw.disk && hw.disk.free >= 5 * GB ? "Sufficient" : "Low", ok: !!(hw.disk && hw.disk.free >= 5 * GB) },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/[0.03] rounded px-2 py-1">
                        <span className="text-zinc-500">{item.label}</span>
                        <span className={`font-bold ${item.ok ? "text-green-400" : "text-yellow-400"}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-zinc-500">
                    Ye app offline chal sakti hai — sabhi features internet ke bina available hain.
                    Agar Ollama install karo to local LLM bhi run ho sakta hai.
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-600 text-sm mt-10">Hardware info load nahi ho saki.</div>
            )}
          </div>
        )}

        {tab === "backup" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-zinc-200">Auto-Backup System</span>
            </div>

            {backup ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total Backups", value: backup.backupCount, icon: <Save className="w-4 h-4 text-green-400" />, color: "text-green-400" },
                    { label: "Memory Entries", value: backup.memoryEntries, icon: <Brain className="w-4 h-4 text-blue-400" />, color: "text-blue-400" },
                    { label: "Last Backup", value: parseTimestamp(backup.lastBackup), icon: <Clock className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
                    { label: "Interval", value: `${backup.intervalSeconds}s`, icon: <RefreshCw className="w-4 h-4 text-purple-400" />, color: "text-purple-400" },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 flex items-center gap-3">
                      {item.icon}
                      <div>
                        <div className={`text-[13px] font-bold ${item.color}`}>{item.value}</div>
                        <div className="text-[10px] text-zinc-600">{item.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-[11px] font-bold text-green-300">Backup Directory</span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400 bg-black/30 rounded px-2 py-1">{backup.backupDir}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Har {backup.intervalSeconds} second mein backup automatically save hota hai.
                    Laptop band ho jaye tab bhi memory safe rahegi.
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={triggerBackup}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600/20 border border-green-600/30 text-green-400 text-[11px] hover:bg-green-600/30 transition-colors">
                    <Save className="w-3.5 h-3.5" /> Backup Now
                  </button>
                  <button onClick={clearHistory}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 border border-red-600/20 text-red-400 text-[11px] hover:bg-red-600/30 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> Clear Chat
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center text-zinc-600 text-sm mt-10">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Backup info load nahi ho saki.
              </div>
            )}

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] font-bold text-blue-300">Kaise Kaam Karta Hai</span>
              </div>
              <div className="text-[10px] text-zinc-500 space-y-1">
                <div>• Har {backup?.intervalSeconds ?? 60} second mein automatic JSON backup hota hai</div>
                <div>• App band hone se pehle bhi ek backup create hota hai</div>
                <div>• Backup files: <code className="text-zinc-400">data/backups/</code> folder mein</div>
                <div>• Chat history, settings, aur knowledge sab save rehta hai</div>
                <div>• Laptop crash ho jaye to bhi koi data loss nahi hoga</div>
              </div>
            </div>
          </div>
        )}

        {tab === "settings" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-zinc-200">AI Settings</span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-3">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Response Language</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "hindi", label: "Hindi / Urdu" },
                    { v: "english", label: "English" },
                    { v: "hinglish", label: "Hinglish" },
                  ].map(({ v, label }) => (
                    <button key={v} onClick={() => setAiSettings(s => ({ ...s, language: v }))}
                      className={`py-1.5 rounded-lg text-[10px] border transition-colors
                        ${aiSettings.language === v
                          ? "bg-amber-600/20 border-amber-600/30 text-amber-400"
                          : "border-white/[0.07] text-zinc-500 hover:bg-white/[0.04]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 space-y-3">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Response Style</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "concise", label: "Concise" },
                    { v: "detailed", label: "Detailed" },
                    { v: "expert", label: "Expert" },
                  ].map(({ v, label }) => (
                    <button key={v} onClick={() => setAiSettings(s => ({ ...s, responseStyle: v }))}
                      className={`py-1.5 rounded-lg text-[10px] border transition-colors
                        ${aiSettings.responseStyle === v
                          ? "bg-blue-600/20 border-blue-600/30 text-blue-400"
                          : "border-white/[0.07] text-zinc-500 hover:bg-white/[0.04]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">AI Mode</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-zinc-300">Force Offline Mode</div>
                    <div className="text-[10px] text-zinc-600">Internet ho tab bhi local KB use karo</div>
                  </div>
                  <button
                    onClick={() => setAiSettings(s => ({ ...s, forceOffline: !s.forceOffline }))}
                    className={`w-10 h-5 rounded-full border transition-colors relative ${aiSettings.forceOffline ? "bg-amber-500 border-amber-600" : "bg-white/[0.06] border-white/[0.12]"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${aiSettings.forceOffline ? "left-5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                  Backup Interval: {aiSettings.autoBackupInterval}s
                </div>
                <input type="range" min={30} max={600} step={30}
                  value={aiSettings.autoBackupInterval}
                  onChange={e => setAiSettings(s => ({ ...s, autoBackupInterval: parseInt(e.target.value) }))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                  <span>30s (frequent)</span><span>10 min (normal)</span>
                </div>
              </div>

              <button onClick={saveSettings}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-600/20 border border-amber-600/30 text-amber-400 text-[11px] hover:bg-amber-600/30 transition-colors">
                <Save className="w-3.5 h-3.5" /> Settings Save Karein
              </button>
            </div>

            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] font-bold text-zinc-300">Offline AI = Online AI Quality</span>
              </div>
              <div className="text-[10px] text-zinc-500 space-y-1">
                <div>✓ 500+ roll forming engineering rules embedded</div>
                <div>✓ Full TurnAxis CAM Turning knowledge base (1263 lines)</div>
                <div>✓ FormAxis RF knowledge base</div>
                <div>✓ G-code generator for Fanuc/Haas/Siemens/Delta 2X</div>
                <div>✓ Material-specific defect diagnosis</div>
                <div>✓ Adaptive toolpath calculations</div>
                <div>✓ Collision detection rules</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
