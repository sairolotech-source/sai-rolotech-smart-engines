import React, { useState } from "react";
import { Key, Eye, EyeOff, CheckCircle2, Trash2, X, ExternalLink, ShieldCheck } from "lucide-react";
import { usePersonalAIKey } from "@/hooks/usePersonalAIKey";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PersonalAIKeyModal({ open, onClose }: Props) {
  const { key, saveKey, clearKey, hasKey } = usePersonalAIKey();
  const [input, setInput] = useState(key ? "••••••••••••••••••••" : "");
  const [editing, setEditing] = useState(!key);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  if (!open) return null;

  const handleSave = () => {
    const val = input.trim();
    if (!val || val.includes("•")) {
      toast({ title: "Key Daalo", description: "Pehle apni Gemini API key enter karein", variant: "destructive" });
      return;
    }
    saveKey(val);
    setEditing(false);
    setInput("••••••••••••••••••••");
    setTestResult(null);
    toast({ title: "Key Save Ho Gayi ✅", description: "Aapki Gemini key browser mein save ho gayi" });
  };

  const handleClear = () => {
    clearKey();
    setInput("");
    setEditing(true);
    setTestResult(null);
    toast({ title: "Key Delete Ho Gayi", description: "Gemini key remove kar di gayi" });
  };

  const handleTest = async () => {
    const testKey = editing && !input.includes("•") ? input.trim() : key;
    if (!testKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${testKey}` },
          body: JSON.stringify({ model: "gemini-2.5-flash", messages: [{ role: "user", content: "OK" }], max_tokens: 5 }),
          signal: AbortSignal.timeout(10000),
        }
      );
      setTestResult(res.ok ? "ok" : "fail");
      if (res.ok) toast({ title: "Key Kaam Kar Rahi Hai ✅", description: "Gemini API connected!" });
      else toast({ title: "Key Galat Hai ❌", description: "Key check karein", variant: "destructive" });
    } catch {
      setTestResult("fail");
      toast({ title: "Connection Error", description: "Internet ya key check karein", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0a0a12]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Personal Gemini Key</h3>
              <p className="text-[10px] text-white/40">Replit ke baghair bhi AI use karo</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-300/80 leading-relaxed">
              Key sirf <strong>aapke browser</strong> mein save hogi — server pe nahi jayegi. App kisi bhi device pe kholo, key daalo, AI chal jayegi.
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-white/50">Gemini API Key</label>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                Key Leni Hai? <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={input}
                onFocus={() => { if (!editing) { setInput(""); setEditing(true); } }}
                onChange={e => setInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-xs text-white/80 placeholder:text-white/20
                  focus:outline-none focus:border-amber-500/40 transition-colors font-mono"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 p-2 rounded-lg text-[11px] ${
              testResult === "ok"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                : "bg-red-500/10 border border-red-500/20 text-red-300"
            }`}>
              {testResult === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              {testResult === "ok" ? "Key sahi hai — Gemini chal rahi hai!" : "Key galat hai — dobara check karein"}
            </div>
          )}

          {hasKey && !editing && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Key save hai — AI features active hain
            </div>
          )}

          <div className="flex gap-2">
            {(editing || !hasKey) && (
              <button
                onClick={handleTest}
                disabled={testing || !input.trim() || input.includes("•")}
                className="flex-1 py-2 rounded-xl text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? "Testing..." : "Test Karo"}
              </button>
            )}
            {hasKey && !editing && (
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex-1 py-2 rounded-xl text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-40"
              >
                {testing ? "Testing..." : "Test Karo"}
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!input.trim() || input.includes("•")}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Karo
            </button>
            {hasKey && (
              <button
                onClick={handleClear}
                className="px-3 py-2 rounded-xl text-xs border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
