import React, { useState } from "react";
import { Key, Eye, EyeOff, CheckCircle2, Trash2, X, ExternalLink, ShieldCheck, Plus, RefreshCw, Star } from "lucide-react";
import { usePersonalAIKey, getDeepseekKey, saveDeepseekKey, clearDeepseekKey } from "@/hooks/usePersonalAIKey";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ErrorCode = "INVALID_KEY" | "QUOTA_EXCEEDED" | "NETWORK" | "PERMISSION" | "UNKNOWN";

function parseGeminiError(status: number, body: string): { code: ErrorCode; message: string; suggestion: string } {
  if (status === 400 || status === 401) return {
    code: "INVALID_KEY",
    message: "Key galat hai ya invalid format mein hai",
    suggestion: "Google AI Studio se nai key lein: aistudio.google.com",
  };
  if (status === 429) return {
    code: "QUOTA_EXCEEDED",
    message: "Is key ki limit khatam ho gayi (Rate limit ya daily quota)",
    suggestion: "Dusri key use karein ya kal try karein",
  };
  if (status === 403) return {
    code: "PERMISSION",
    message: "Gemini API is key ke liye enable nahi hai",
    suggestion: "Google AI Studio mein API enable karein",
  };
  if (body.includes("quota")) return {
    code: "QUOTA_EXCEEDED",
    message: "Monthly quota khatam ho gayi",
    suggestion: "Dusri key switch karein (Key Swap karein)",
  };
  return {
    code: "UNKNOWN",
    message: `Server error ${status}`,
    suggestion: "Thodi der baad try karein ya key badlein",
  };
}

export function PersonalAIKeyModal({ open, onClose }: Props) {
  const { keys, activeId, hasKey, addKey, removeKey, setActive } = usePersonalAIKey();
  const [newLabel, setNewLabel] = useState("");
  const [newKeyVal, setNewKeyVal] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [deepseekKey, setDeepseekKeyState] = useState<string>(() => getDeepseekKey());
  const [newDeepseekVal, setNewDeepseekVal] = useState("");
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [testingDeepseek, setTestingDeepseek] = useState(false);
  const [deepseekTestResult, setDeepseekTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!open) return null;

  const handleAdd = () => {
    const val = newKeyVal.trim();
    if (!val) {
      toast({ title: "Key Daalo", description: "API key field khali hai", variant: "destructive" });
      return;
    }
    if (!val.startsWith("AIza")) {
      toast({ title: "Format Galat", description: "Gemini key 'AIza' se shuru hoti hai", variant: "destructive" });
      return;
    }
    addKey(newLabel || `Key ${keys.length + 1}`, val);
    setNewLabel("");
    setNewKeyVal("");
    setShowAddForm(false);
    toast({ title: "Key Add Ho Gayi ✅", description: `"${newLabel || `Key ${keys.length + 1}`}" save ho gayi` });
  };

  const handleTest = async (id: string, key: string) => {
    setTesting(id);
    setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: "Testing..." } }));
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: "gemini-2.5-flash", messages: [{ role: "user", content: "OK" }], max_tokens: 5 }),
          signal: AbortSignal.timeout(12000),
        }
      );
      if (res.ok) {
        setTestResults(prev => ({ ...prev, [id]: { ok: true, msg: "✅ Chal rahi hai" } }));
        toast({ title: "Key Theek Hai ✅", description: "Gemini se connected!" });
      } else {
        const body = await res.text();
        const { message, suggestion } = parseGeminiError(res.status, body);
        setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: `❌ ${message}` } }));
        toast({ title: "Key Kaam Nahi Kar Rahi", description: `${message} — ${suggestion}`, variant: "destructive" });
      }
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, msg: "❌ Internet ya key check karein" } }));
      toast({ title: "Connection Error", description: "Network ya key check karein", variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const handleSwap = (id: string, label: string) => {
    setActive(id);
    toast({ title: `"${label}" Active Ho Gayi 🔄`, description: "Ab ye key use hogi" });
  };

  const handleSaveDeepseek = () => {
    const val = newDeepseekVal.trim();
    if (!val) { toast({ title: "Key Daalo", description: "DeepSeek key field khali hai", variant: "destructive" }); return; }
    if (!val.startsWith("sk-")) { toast({ title: "Format Galat", description: "DeepSeek key 'sk-' se shuru hoti hai", variant: "destructive" }); return; }
    saveDeepseekKey(val);
    setDeepseekKeyState(val);
    setNewDeepseekVal("");
    setDeepseekTestResult(null);
    toast({ title: "DeepSeek Key Save Ho Gayi ✅", description: "Ab AI chat mein DeepSeek bhi fallback karega" });
  };

  const handleTestDeepseek = async (key: string) => {
    setTestingDeepseek(true);
    setDeepseekTestResult({ ok: false, msg: "Testing..." });
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: "OK" }], max_tokens: 5 }),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        setDeepseekTestResult({ ok: true, msg: "✅ DeepSeek chal rahi hai" });
        toast({ title: "DeepSeek Key Theek Hai ✅", description: "Connected!" });
      } else {
        setDeepseekTestResult({ ok: false, msg: `❌ Error ${res.status} — platform.deepseek.com se check karein` });
        toast({ title: "DeepSeek Key Kaam Nahi Kar Rahi", description: `HTTP ${res.status}`, variant: "destructive" });
      }
    } catch {
      setDeepseekTestResult({ ok: false, msg: "❌ Network error ya key check karein" });
    } finally {
      setTestingDeepseek(false);
    }
  };

  const handleClearDeepseek = () => {
    clearDeepseekKey();
    setDeepseekKeyState("");
    setDeepseekTestResult(null);
    toast({ title: "DeepSeek Key Hata Di" });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0a0a12] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Gemini Keys</h3>
              <p className="text-[10px] text-white/40">Multiple keys — jab ek khatam ho dusri lagao</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              Sabki key sirf <strong>aapke browser</strong> mein save hoti hai — server pe nahi. Family member ki key lagao, switch karo jab zarurat ho.
            </p>
          </div>

          {keys.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Saved Keys ({keys.length})</p>
              {keys.map((k) => {
                const isActive = k.id === activeId;
                const result = testResults[k.id];
                return (
                  <div key={k.id} className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${
                    isActive ? "border-amber-500/30 bg-amber-500/5" : "border-white/8 bg-white/2"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isActive && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        <span className="text-xs font-semibold text-white">{k.label}</span>
                        {isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">ACTIVE</span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/30">{k.addedAt}</span>
                    </div>
                    <div className="font-mono text-[10px] text-white/30 bg-white/3 rounded-lg px-2 py-1">
                      {k.key.slice(0, 8)}••••••••••••••••{k.key.slice(-4)}
                    </div>
                    {result && (
                      <p className={`text-[10px] ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.msg}</p>
                    )}
                    <div className="flex gap-1.5">
                      {!isActive && (
                        <button
                          onClick={() => handleSwap(k.id, k.label)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Swap (Use This)
                        </button>
                      )}
                      <button
                        onClick={() => handleTest(k.id, k.key)}
                        disabled={testing === k.id}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/8 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
                      >
                        {testing === k.id ? "Testing..." : "Test"}
                      </button>
                      <button
                        onClick={() => { removeKey(k.id); toast({ title: `"${k.label}" Delete Ho Gayi` }); }}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] bg-red-500/5 border border-red-500/15 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/15 hover:border-amber-500/30 text-white/40 hover:text-amber-400 text-xs font-medium transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nai Key Add Karo
            </button>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/3 p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white/60">Nai Key Add Karo</p>
                <button onClick={() => setShowAddForm(false)} className="text-white/30 hover:text-white/60">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Label (jaise: Meri Key, Bhai Ki Key, Office Key)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
              <div className="relative">
                <input
                  type={showNewKey ? "text" : "password"}
                  value={newKeyVal}
                  onChange={e => setNewKeyVal(e.target.value)}
                  placeholder="AIzaSy... (Google AI Studio se)"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 pr-10 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 transition-colors font-mono"
                />
                <button
                  onClick={() => setShowNewKey(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showNewKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="flex gap-2">
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Key Kahan Se Milegi? <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={handleAdd}
                  disabled={!newKeyVal.trim()}
                  className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save Karo
                </button>
              </div>
            </div>
          )}

          {keys.length === 0 && !showAddForm && (
            <div className="text-center py-4 text-white/25 text-xs">
              Koi key save nahi — "Nai Key Add Karo" dabayein
            </div>
          )}

          <div className="mt-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-cyan-500/20 flex items-center justify-center">
                <span className="text-[10px]">🤖</span>
              </div>
              <p className="text-xs font-semibold text-cyan-300">DeepSeek API Key</p>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-medium">AI Fallback</span>
            </div>

            {deepseekKey ? (
              <div className="flex flex-col gap-2">
                <div className="font-mono text-[10px] text-white/30 bg-white/3 rounded-lg px-2 py-1">
                  {deepseekKey.slice(0, 5)}••••••••••••••••{deepseekKey.slice(-4)}
                </div>
                {deepseekTestResult && (
                  <p className={`text-[10px] ${deepseekTestResult.ok ? "text-emerald-400" : "text-red-400"}`}>{deepseekTestResult.msg}</p>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleTestDeepseek(deepseekKey)}
                    disabled={testingDeepseek}
                    className="flex-1 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/8 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
                  >
                    {testingDeepseek ? "Testing..." : "Test Karo"}
                  </button>
                  <button
                    onClick={handleClearDeepseek}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] bg-red-500/5 border border-red-500/15 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-white/35 leading-relaxed">
                  platform.deepseek.com se free key lo — AI chat mein Gemini ke baad DeepSeek try hoga
                </p>
                <div className="relative">
                  <input
                    type={showDeepseekKey ? "text" : "password"}
                    value={newDeepseekVal}
                    onChange={e => setNewDeepseekVal(e.target.value)}
                    placeholder="sk-... (DeepSeek Platform se)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 pr-10 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors font-mono"
                  />
                  <button
                    onClick={() => setShowDeepseekKey(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showDeepseekKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300">
                    Key Kahan Se Milegi? <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={handleSaveDeepseek}
                    disabled={!newDeepseekVal.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save Karo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
