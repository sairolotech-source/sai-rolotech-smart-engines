import React, { useState } from "react";
import { Mail, ArrowLeft, KeyRound, Send, CheckCircle, Cog } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";

interface Props {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: Props) {
  const { resetPassword, loading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Email address dalein"); return; }
    setError(null);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error hua";
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#04060e] flex items-center justify-center px-4 relative overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#fff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-orange-500/6 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-[400px]">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Cog className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Sai Rolotech Smart Engines</h1>
            <p className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">Smart Engines</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
              <KeyRound className="w-7 h-7 text-orange-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Password Reset</h2>
            <p className="text-sm text-zinc-500 mt-1 text-center">
              Email par password reset link bhejenge
            </p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
              </div>
              <div>
                <p className="text-sm text-zinc-200 font-semibold">Reset link bhej diya!</p>
                <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                  <span className="text-orange-400 font-medium">{email}</span> par password reset ka email bheja gaya hai.
                  Apna inbox check karein aur link par click karke naya password set karein.
                </p>
              </div>
              <p className="text-[11px] text-zinc-600">Email nahi aaya? Spam folder check karein.</p>
            </div>
          ) : (
            <form onSubmit={handleSendReset} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="you@company.com"
                    autoFocus
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 bg-red-500/8 border border-red-500/20 text-red-300 text-xs leading-relaxed">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center text-[10px]">!</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Bhej raha hoon...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Reset Link
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <button
          onClick={onBack}
          className="w-full mt-4 py-2.5 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-orange-400 transition-colors rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>
      </div>
    </div>
  );
}
