import React, { useState, useEffect, useRef } from "react";
import { Shield, KeyRound, Clock, AlertTriangle, CheckCircle, Loader2, Lock, Phone, User, ChevronRight, RefreshCw } from "lucide-react";
import {
  getStoredToken,
  getLicenseType,
  getStoredName,
  getDemoRemainingMs,
  activateLicense,
  activateDemo,
  verifyLicense,
  clearLicense,
} from "../../lib/licenseKey";

interface Props {
  onUnlocked: () => void;
}

type Screen = "checking" | "enter-key" | "demo-form" | "key-form" | "blocked" | "demo-expired" | "error";

function formatDemoTime(ms: number): string {
  const total = Math.max(0, ms);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  return `${h} ghante ${m} minute`;
}

function formatKeyInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const parts: string[] = [];
  for (let i = 0; i < clean.length && i < 20; i += 5) {
    parts.push(clean.slice(i, i + 5));
  }
  return parts.join("-");
}

export function LicenseKeyScreen({ onUnlocked }: Props) {
  const [screen, setScreen]   = useState<Screen>("checking");
  const [key, setKey]         = useState("");
  const [name, setName]       = useState("");
  const [mobile, setMobile]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demoMs, setDemoMs]   = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const keyRef = useRef<HTMLInputElement>(null);

  // Startup check
  useEffect(() => {
    (async () => {
      const token = getStoredToken();
      if (!token) { setScreen("enter-key"); return; }

      const result = await verifyLicense();
      if (result.active) {
        const ms = getDemoRemainingMs();
        if (getLicenseType() === "demo") setDemoMs(ms);
        onUnlocked();
      } else if (result.blocked) {
        setScreen("blocked");
      } else if (result.demoExpired) {
        setScreen("demo-expired");
      } else {
        clearLicense();
        setScreen("enter-key");
      }
    })();
  }, [onUnlocked]);

  // Demo countdown ticker
  useEffect(() => {
    if (screen !== "checking") return;
    const t = setInterval(() => setDemoMs(getDemoRemainingMs()), 60000);
    return () => clearInterval(t);
  }, [screen]);

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const formatted = formatKeyInput(e.target.value);
    setKey(formatted);
  };

  const handleActivate = async () => {
    if (!key.trim() || !name.trim() || !mobile.trim()) {
      setError("Sab fields bharo — Key, Naam aur Mobile"); return;
    }
    if (key.replace(/-/g, "").length < 16) {
      setError("Key complete nahi hai — poori key daalo"); return;
    }
    if (mobile.replace(/\D/g, "").length < 10) {
      setError("Valid mobile number daalo (10 digits)"); return;
    }

    setLoading(true); setError(null);
    const result = await activateLicense(key, name, mobile);
    setLoading(false);

    if (result.ok) {
      setSuccess(result.message ?? "Software activate ho gaya!");
      setTimeout(() => onUnlocked(), 1200);
    } else if (result.blocked) {
      setScreen("blocked");
    } else if (result.demoExpired) {
      setScreen("demo-expired");
    } else {
      setError(result.error ?? "Activation fail ho gaya — key check karo");
    }
  };

  const handleDemo = async () => {
    if (!name.trim() || !mobile.trim()) {
      setError("Apna naam aur mobile number daalo"); return;
    }
    if (mobile.replace(/\D/g, "").length < 10) {
      setError("Valid mobile number daalo (10 digits)"); return;
    }

    setLoading(true); setError(null);
    const result = await activateDemo(name, mobile);
    setLoading(false);

    if (result.ok) {
      setSuccess("3-din ka Demo shuru! Poora software access milega.");
      setTimeout(() => onUnlocked(), 1200);
    } else if (result.demoExpired) {
      setScreen("demo-expired");
    } else {
      setError(result.error ?? "Demo activate nahi hua");
    }
  };

  // ── Checking screen ────────────────────────────────────────────────────────
  if (screen === "checking") {
    return (
      <div className="fixed inset-0 bg-[#07080f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">License verify ho raha hai...</p>
        </div>
      </div>
    );
  }

  // ── Blocked screen ─────────────────────────────────────────────────────────
  if (screen === "blocked") {
    return (
      <div className="fixed inset-0 bg-[#07080f] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-400 mb-2">Access Blocked</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Is device ka access admin ne band kar diya hai.
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              Help ke liye contact karein:
              <span className="text-amber-400 block mt-1 font-mono">support@sairolotech.com</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Demo Expired screen ────────────────────────────────────────────────────
  if (screen === "demo-expired") {
    return (
      <div className="fixed inset-0 bg-[#07080f] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto">
            <Clock className="w-7 h-7 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-orange-400 mb-2">Demo Khatam Ho Gaya</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Aapka 3-din ka demo trial pura ho gaya. Full license le kar software chalate rahe.
            </p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs text-amber-400 font-semibold">Full License Lene Ke Liye:</p>
            <p className="text-xs text-zinc-400">📞 +91 — WhatsApp par contact karein</p>
            <p className="text-xs text-zinc-400">📧 support@sairolotech.com</p>
          </div>
          <button
            onClick={() => { clearLicense(); setScreen("key-form"); setShowDemo(false); }}
            className="w-full h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition-all"
          >
            License Key Enter Karo
          </button>
        </div>
      </div>
    );
  }

  // ── Main activation screen ─────────────────────────────────────────────────
  const isKeyForm  = screen === "key-form"  || (screen === "enter-key" && !showDemo);
  const isDemoForm = screen === "demo-form" || (screen === "enter-key" && showDemo);

  return (
    <div className="fixed inset-0 bg-[#07080f] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md py-8">

        {/* Logo + Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
            <Shield className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-white">SAI Rolotech Smart Engines</h1>
          <p className="text-xs text-zinc-500 mt-1">Software Activation Required</p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 mb-6">
          <button
            onClick={() => { setShowDemo(false); setError(null); setScreen("enter-key"); }}
            className={`flex-1 h-9 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all ${!isDemoForm ? "bg-amber-500 text-black shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <KeyRound className="w-3.5 h-3.5" /> License Key
          </button>
          <button
            onClick={() => { setShowDemo(true); setError(null); setScreen("enter-key"); }}
            className={`flex-1 h-9 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all ${isDemoForm ? "bg-blue-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <Clock className="w-3.5 h-3.5" /> 3-Din Demo
          </button>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 space-y-4">

          {/* Info banner */}
          {isDemoForm ? (
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-lg p-3 flex gap-2.5">
              <Clock className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-blue-300/90 leading-relaxed">
                <span className="font-bold">3 din ka free trial</span> — poora software access milega.
                Demo ek machine par sirf <span className="font-bold">ek baar</span> milta hai.
                Trial khatam hone par full license leni hogi.
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/6 border border-amber-500/15 rounded-lg p-3 flex gap-2.5">
              <Shield className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] text-amber-300/80 leading-relaxed">
                License key <span className="font-bold">is device se permanently bind</span> ho jaati hai.
                Update ke waqt dobara key nahi daalni — automatic activate rahega.
              </div>
            </div>
          )}

          {/* Key input — only for license tab */}
          {!isDemoForm && (
            <div>
              <label className="text-[11px] text-zinc-400 font-semibold block mb-1.5">
                License Key <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  ref={keyRef}
                  type="text"
                  value={key}
                  onChange={handleKeyChange}
                  placeholder="SAIR-XXXXX-XXXXX-XXXXX"
                  maxLength={23}
                  className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm font-mono placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-all tracking-wider"
                  onKeyDown={e => e.key === "Enter" && handleActivate()}
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">Format: SAIR-XXXXX-XXXXX-XXXXX</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-[11px] text-zinc-400 font-semibold block mb-1.5">
              Aapka Naam <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                value={name}
                onChange={e => { setName(e.target.value); setError(null); }}
                placeholder="Ramesh Kumar"
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
          </div>

          {/* Mobile */}
          <div>
            <label className="text-[11px] text-zinc-400 font-semibold block mb-1.5">
              Mobile Number <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="tel"
                value={mobile}
                onChange={e => { setMobile(e.target.value); setError(null); }}
                placeholder="+91 98765 43210"
                className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">Registration ke liye zaroori hai</p>
          </div>

          {/* Error / Success */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-lg px-3 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-400 font-medium">{success}</p>
            </div>
          )}

          {/* Action button */}
          {isDemoForm ? (
            <button
              type="button"
              onClick={handleDemo}
              disabled={loading || !!success}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Activate ho raha hai...</>
              ) : (
                <><Clock className="w-4 h-4" /> 3-Din Demo Shuru Karo <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleActivate}
              disabled={loading || !!success}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-black text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verify ho raha hai...</>
              ) : (
                <><KeyRound className="w-4 h-4" /> Software Activate Karo <ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-zinc-700 mt-4">
          Help chahiye? &nbsp;
          <span className="text-zinc-500">support@sairolotech.com</span>
          &nbsp;·&nbsp;
          <button
            onClick={() => { clearLicense(); setScreen("enter-key"); setError(null); setKey(""); }}
            className="text-zinc-600 hover:text-zinc-400 inline-flex items-center gap-0.5 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Reset
          </button>
        </p>
      </div>
    </div>
  );
}
