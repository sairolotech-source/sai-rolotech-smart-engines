import React, { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Lock, Mail, UserPlus, ArrowRight, Cog, Layers, CircleDot, Terminal, Phone, MessageSquare, Fingerprint, ShieldCheck, X } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import {
  isBiometricSupported,
  isBiometricRegistered,
  isCrossDeviceRegistered,
  checkPlatformAuthenticatorAvailable,
  registerBiometric,
  registerCrossDevice,
  removeBiometricRegistration,
  removeCrossDeviceRegistration,
  getBiometricUser,
} from "../../lib/webauthn";

const IS_DEV = import.meta.env.DEV;

interface Props {
  onForgotPassword?: () => void;
}

export function LoginPage({ onForgotPassword }: Props) {
  const { login, signup, loginWithGoogle, loginWithGitHub, loginWithPhone, verifyOTP, otpConfirmation, devLogin, loginWithBiometric, loginWithCrossDevice, loading, error: storeError } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const [phoneNumber, setPhoneNumber] = useState("+91");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const recaptchaContainerId = "recaptcha-container";

  const [socialLoading, setSocialLoading] = useState<"google" | "github" | null>(null);

  // ── Biometric (platform) state ────────────────────────────────────────────
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [crossDeviceRegistered, setCrossDeviceRegistered] = useState(false);
  const [biometricUser, setBiometricUser] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [crossDeviceLoading, setCrossDeviceLoading] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [setupTab, setSetupTab] = useState<"device" | "mobile">("device");
  const [setupEmail, setSetupEmail] = useState("");

  useEffect(() => {
    if (isBiometricSupported()) {
      checkPlatformAuthenticatorAvailable().then(ok => {
        setBiometricAvailable(ok);
        setBiometricRegistered(isBiometricRegistered());
        setCrossDeviceRegistered(isCrossDeviceRegistered());
        setBiometricUser(getBiometricUser());
      });
    }
  }, []);

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    setLocalError(null);
    const result = await loginWithBiometric();
    setBiometricLoading(false);
    if (!result.ok) setLocalError(result.error ?? "Fingerprint login failed");
  };

  const handleCrossDeviceLogin = async () => {
    setCrossDeviceLoading(true);
    setLocalError(null);
    const result = await loginWithCrossDevice();
    setCrossDeviceLoading(false);
    if (!result.ok) setLocalError(result.error ?? "Mobile login failed");
  };

  const handleBiometricSetup = async () => {
    if (!setupEmail.trim()) { setLocalError("Email enter karo"); return; }
    setBiometricLoading(true);
    setLocalError(null);
    const result = await registerBiometric(setupEmail.trim());
    setBiometricLoading(false);
    if (result.ok) {
      setBiometricRegistered(true);
      setBiometricUser(setupEmail.trim());
      setShowBiometricSetup(false);
      setSuccessMsg("Is device ka fingerprint register ho gaya! Ab sirf fingerprint se login karo.");
    } else {
      setLocalError(result.error ?? "Registration failed");
    }
  };

  const handleCrossDeviceSetup = async () => {
    if (!setupEmail.trim()) { setLocalError("Email enter karo"); return; }
    setCrossDeviceLoading(true);
    setLocalError(null);
    const result = await registerCrossDevice(setupEmail.trim());
    setCrossDeviceLoading(false);
    if (result.ok) {
      setCrossDeviceRegistered(true);
      setBiometricUser(setupEmail.trim());
      setShowBiometricSetup(false);
      setSuccessMsg("Mobile fingerprint register ho gaya! Ab laptop par QR scan karo aur mobile fingerprint se login karo.");
    } else {
      setLocalError(result.error ?? "Cross-device setup failed");
    }
  };

  const error = localError || storeError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Please enter both email and password");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setLocalError("Please enter a valid email address");
      return;
    }

    if (isSignup) {
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setLocalError("Password must be at least 6 characters");
        return;
      }
      try {
        await signup(email.trim(), password.trim());
      } catch {
      }
    } else {
      try {
        await login(email.trim(), password.trim());
      } catch {
      }
    }
  };

  const handleSocialLogin = async (provider: "google" | "github") => {
    setLocalError(null);
    setSuccessMsg(null);
    setSocialLoading(provider);
    try {
      if (provider === "google") {
        await loginWithGoogle();
      } else {
        await loginWithGitHub();
      }
    } catch {
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSendOTP = async () => {
    setLocalError(null);
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setLocalError("Valid phone number enter karein (with country code, e.g. +91XXXXXXXXXX)");
      return;
    }
    try {
      await loginWithPhone(phoneNumber.trim(), recaptchaContainerId);
      setOtpSent(true);
      setSuccessMsg(`OTP bheja gaya: ${phoneNumber}`);
    } catch {
      setLocalError("OTP send nahi ho saka. Phone number check karein.");
    }
  };

  const handleVerifyOTP = async () => {
    setLocalError(null);
    if (!otpCode.trim() || otpCode.length < 4) {
      setLocalError("6-digit OTP enter karein");
      return;
    }
    try {
      await verifyOTP(otpCode.trim());
    } catch {
      setLocalError("OTP galat hai. Dobara try karein.");
    }
  };

  return (
    <div className="min-h-screen bg-[#04060e] flex relative overflow-hidden">

      <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#fff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-orange-500/8 via-amber-500/4 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/6 via-blue-500/3 to-transparent rounded-full blur-[100px] pointer-events-none" />

      <div className="hidden lg:flex flex-1 items-center justify-center relative p-12">
        <div className="max-w-lg relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Cog className="w-6 h-6 text-white animate-[spin_8s_linear_infinite]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Sai Rolotech Smart Engines</h1>
              <p className="text-xs text-zinc-500 font-medium tracking-widest uppercase">Smart Engines Platform</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Precision Roll Forming
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">
              Engineering Suite
            </span>
          </h2>

          <p className="text-zinc-400 text-base leading-relaxed mb-10">
            CNC G-Code Generation, Power Pattern Design, DXF Processing, 3D Visualization — all in one platform.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Multi-Pass Roll Design</p>
                <p className="text-xs text-zinc-500">Station-by-station power pattern generation</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                <CircleDot className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">CNC G-Code Output</p>
                <p className="text-xs text-zinc-500">Production-ready toolpath with compensation</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                <Cog className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Smart Diagnostics</p>
                <p className="text-xs text-zinc-500">Smart analysis for forming defects</p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#04060e] bg-gradient-to-br from-zinc-600 to-zinc-700 flex items-center justify-center">
                  <span className="text-[10px] text-zinc-300 font-bold">{["S", "R", "T", "A"][i]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Trusted by roll forming engineers</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[400px]">

          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Cog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Sai Rolotech Smart Engines</h1>
              <p className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">Smart Engines</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md p-8 shadow-2xl shadow-black/40">

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">
                {isSignup ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                {isSignup ? "Create a new account to get started" : "Sign in with your credentials"}
              </p>
            </div>

            {!isSignup && (
              <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-1 mb-5 gap-1">
                <button
                  type="button"
                  onClick={() => { setLoginMode("email"); setLocalError(null); setOtpSent(false); }}
                  className={`flex-1 h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${loginMode === "email" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode("phone"); setLocalError(null); setOtpSent(false); }}
                  className={`flex-1 h-8 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${loginMode === "phone" ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  <Phone className="w-3.5 h-3.5" /> Phone OTP
                </button>
              </div>
            )}

            {loginMode === "phone" && !isSignup ? (
              <div className="space-y-4">
                <div id={recaptchaContainerId} />
                {!otpSent ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-400">Phone Number</label>
                    <div className="relative group">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => { setPhoneNumber(e.target.value); setLocalError(null); }}
                        placeholder="+91XXXXXXXXXX"
                        className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                      />
                    </div>
                    {error && (
                      <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 bg-red-500/8 border border-red-500/20 text-red-300 text-xs">
                        <span>{error}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="w-full h-11 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><MessageSquare className="w-4 h-4" /> OTP Bhejo</>}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {successMsg && (
                      <div className="flex items-start gap-2 rounded-lg px-3.5 py-3 bg-green-500/8 border border-green-500/20 text-green-300 text-xs mb-2">
                        <span>✓ {successMsg}</span>
                      </div>
                    )}
                    <label className="text-xs font-medium text-zinc-400">6-Digit OTP Code</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setLocalError(null); }}
                      placeholder="XXXXXX"
                      maxLength={6}
                      className="w-full h-11 px-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-lg text-center tracking-[0.5em] placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                    />
                    {error && (
                      <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 bg-red-500/8 border border-red-500/20 text-red-300 text-xs">
                        <span>{error}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleVerifyOTP}
                      disabled={loading || otpCode.length < 6}
                      className="w-full h-11 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight className="w-4 h-4" /> OTP Verify Karo</>}
                    </button>
                    <button type="button" onClick={() => { setOtpSent(false); setOtpCode(""); }} className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-1">
                      Phone number badlo
                    </button>
                  </div>
                )}
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLocalError(null); }}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLocalError(null); }}
                    placeholder="Enter password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    className="w-full h-11 pl-10 pr-11 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isSignup && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-400">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-orange-400 transition-colors" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(null); }}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full h-11 pl-10 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 bg-red-500/8 border border-red-500/20 text-red-300 text-xs leading-relaxed">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center text-[10px]">!</span>
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 bg-green-500/8 border border-green-500/20 text-green-300 text-xs leading-relaxed">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-[10px]">&#10003;</span>
                  <span>{successMsg}</span>
                </div>
              )}

              {!isSignup && onForgotPassword && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-xs text-zinc-500 hover:text-orange-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isSignup ? "Creating account..." : "Signing in..."}
                  </>
                ) : (
                  <>
                    {isSignup ? "Create Account" : "Sign In"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="relative flex items-center justify-center my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
                <span className="relative px-3 text-[11px] text-zinc-600 bg-[#0a0c14]">or</span>
              </div>

              {/* ── Biometric / Fingerprint Login Section ── */}
              {isBiometricSupported() && (
                <div className="mb-2.5 space-y-2">

                  {/* --- Row 1: Platform fingerprint (this device) --- */}
                  {biometricRegistered ? (
                    <button
                      type="button"
                      onClick={handleBiometricLogin}
                      disabled={biometricLoading || loading}
                      className="w-full h-12 rounded-lg border border-green-500/30 bg-green-500/5 text-green-300 text-sm font-semibold flex items-center justify-center gap-3 hover:bg-green-500/10 hover:border-green-500/50 transition-all disabled:opacity-50 group"
                    >
                      {biometricLoading ? (
                        <><div className="w-5 h-5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" /><span>Scanning...</span></>
                      ) : (
                        <><Fingerprint className="w-5 h-5 group-hover:scale-110 transition-transform" /><span>Is Device ka Fingerprint</span>{biometricUser && <span className="text-[10px] text-green-500/60 font-normal">({biometricUser.split("@")[0]})</span>}</>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowBiometricSetup(true); setSetupTab("device"); setLocalError(null); }}
                      className="w-full h-11 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-400 text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-blue-500/10 hover:border-blue-500/35 transition-all group"
                    >
                      <Fingerprint className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Is Device ka Fingerprint Setup
                      <span className="text-[9px] text-blue-500/60 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono">NEW</span>
                    </button>
                  )}

                  {/* --- Row 2: Cross-device (mobile phone QR) --- */}
                  {crossDeviceRegistered ? (
                    <button
                      type="button"
                      onClick={handleCrossDeviceLogin}
                      disabled={crossDeviceLoading || loading}
                      className="w-full h-12 rounded-lg border border-purple-500/30 bg-purple-500/5 text-purple-300 text-sm font-semibold flex items-center justify-center gap-3 hover:bg-purple-500/10 hover:border-purple-500/50 transition-all disabled:opacity-50 group"
                    >
                      {crossDeviceLoading ? (
                        <><div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /><span>Mobile se connect ho raha hai...</span></>
                      ) : (
                        <><span className="text-lg">📱</span><span>Mobile Fingerprint se Login (QR)</span>{biometricUser && <span className="text-[10px] text-purple-500/60 font-normal">({biometricUser.split("@")[0]})</span>}</>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowBiometricSetup(true); setSetupTab("mobile"); setLocalError(null); }}
                      className="w-full h-11 rounded-lg border border-purple-500/15 bg-purple-500/5 text-purple-400/80 text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-purple-500/8 hover:border-purple-500/30 hover:text-purple-300 transition-all group"
                    >
                      <span className="text-base group-hover:scale-110 transition-transform inline-block">📱</span>
                      Laptop pe QR, Mobile se Fingerprint
                      <span className="text-[9px] text-purple-500/50 border border-purple-500/20 px-1.5 py-0.5 rounded font-mono">NEW</span>
                    </button>
                  )}

                  {/* remove links */}
                  {(biometricRegistered || crossDeviceRegistered) && (
                    <div className="flex items-center justify-center gap-4">
                      {biometricRegistered && (
                        <button type="button" onClick={() => { removeBiometricRegistration(); setBiometricRegistered(false); }} className="text-[10px] text-zinc-700 hover:text-zinc-500 flex items-center gap-1"><X className="w-2.5 h-2.5" />Device fingerprint hata do</button>
                      )}
                      {crossDeviceRegistered && (
                        <button type="button" onClick={() => { removeCrossDeviceRegistration(); setCrossDeviceRegistered(false); }} className="text-[10px] text-zinc-700 hover:text-zinc-500 flex items-center gap-1"><X className="w-2.5 h-2.5" />Mobile fingerprint hata do</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Setup Modal ── */}
              {showBiometricSetup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                  <div className="bg-[#0d1117] border border-blue-500/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-blue-500/10">

                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <Fingerprint className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Fingerprint Setup</div>
                        <div className="text-[10px] text-zinc-500">Bina password ke login karo</div>
                      </div>
                      <button onClick={() => { setShowBiometricSetup(false); setLocalError(null); }} className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5 mb-4">
                      <button
                        type="button"
                        onClick={() => { setSetupTab("device"); setLocalError(null); }}
                        className={`flex-1 h-8 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${setupTab === "device" ? "bg-blue-600 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}
                      >
                        <Fingerprint className="w-3 h-3" /> Is Device
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSetupTab("mobile"); setLocalError(null); }}
                        className={`flex-1 h-8 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${setupTab === "mobile" ? "bg-purple-600 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}
                      >
                        <span>📱</span> Mobile Phone
                      </button>
                    </div>

                    {/* Tab content */}
                    {setupTab === "device" ? (
                      <div className="space-y-3">
                        <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3 text-[11px] text-blue-300/80 leading-relaxed">
                          <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5 text-blue-400" />
                          Is laptop/computer ka fingerprint ya Windows Hello register hoga. Sirf isi device pe kaam karega.
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Apna Email</label>
                          <input type="email" value={setupEmail} onChange={e => { setSetupEmail(e.target.value); setLocalError(null); }} placeholder="engineer@sairolotech.local" className="mt-1 w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 transition-all" />
                        </div>
                        {error && <div className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
                        <button type="button" onClick={handleBiometricSetup} disabled={biometricLoading} className="w-full h-11 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50">
                          {biometricLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Scan ho raha hai...</> : <><Fingerprint className="w-4 h-4" /> Fingerprint Register Karo</>}
                        </button>
                        <p className="text-[10px] text-zinc-600 text-center">Button dabane ke baad device fingerprint / Windows Hello maangega</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg p-3 text-[11px] text-purple-300/80 leading-relaxed">
                          <span className="mr-1.5">📱</span>
                          <strong>Kaise kaam karta hai:</strong> Register button dabao → browser QR code dikhayega → mobile se scan karo → phone pe fingerprint lagao → ho gaya! Phir jab bhi login karo, wahi QR + fingerprint se laptop khul jaayega.
                        </div>
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5 text-[10px] text-zinc-500 space-y-1">
                          <div className="flex items-center gap-1.5"><span className="text-green-400">✓</span> Android (Chrome 108+) — fingerprint sensor</div>
                          <div className="flex items-center gap-1.5"><span className="text-green-400">✓</span> iPhone (iOS 16+, Safari) — Face ID / Touch ID</div>
                          <div className="flex items-center gap-1.5"><span className="text-yellow-500">!</span> Mobile aur laptop ek hi WiFi par honge to best result</div>
                        </div>
                        <div>
                          <label className="text-[11px] text-zinc-400 font-medium">Apna Email</label>
                          <input type="email" value={setupEmail} onChange={e => { setSetupEmail(e.target.value); setLocalError(null); }} placeholder="engineer@sairolotech.local" className="mt-1 w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-all" />
                        </div>
                        {error && <div className="text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
                        <button type="button" onClick={handleCrossDeviceSetup} disabled={crossDeviceLoading} className="w-full h-11 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50">
                          {crossDeviceLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> QR code aa raha hai...</> : <><span>📱</span> Mobile se Register Karo (QR Dikhega)</>}
                        </button>
                        <p className="text-[10px] text-zinc-600 text-center">Browser apna QR code dikhayega — mobile camera se scan karo</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleSocialLogin("google")}
                  disabled={loading || socialLoading !== null}
                  className="w-full h-11 rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300 text-sm font-medium flex items-center justify-center gap-3 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {socialLoading === "google" ? (
                    <div className="w-4 h-4 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  {socialLoading === "google" ? "Signing in..." : "Sign in with Google"}
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialLogin("github")}
                  disabled={loading || socialLoading !== null}
                  className="w-full h-11 rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300 text-sm font-medium flex items-center justify-center gap-3 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {socialLoading === "github" ? (
                    <div className="w-4 h-4 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                  )}
                  {socialLoading === "github" ? "Signing in..." : "Sign in with GitHub"}
                </button>
              </div>

              <div className="relative flex items-center justify-center my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.06]" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setIsSignup(!isSignup); setLocalError(null); setSuccessMsg(null); }}
                className="w-full h-10 rounded-lg border border-white/[0.08] bg-white/[0.02] text-zinc-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/[0.04] hover:text-zinc-200 transition-all"
              >
                {isSignup ? (
                  <><ArrowRight className="w-3.5 h-3.5" /> Already have an account? Sign in</>
                ) : (
                  <><UserPlus className="w-3.5 h-3.5" /> Create new account</>
                )}
              </button>

              {IS_DEV && (
                <>
                  <div className="relative flex items-center justify-center my-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-orange-500/20" />
                    </div>
                    <span className="relative px-3 text-[10px] text-orange-500/60 bg-[#0a0e1a] font-mono tracking-widest uppercase">
                      Dev Mode
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={devLogin}
                    className="w-full h-11 rounded-lg border border-orange-500/30 bg-orange-500/5 text-orange-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all"
                  >
                    <Terminal className="w-4 h-4" />
                    Dev Access — Enter as Engineer
                  </button>
                </>
              )}
            </form>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-700 mt-6">
            Secured access — authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
}
