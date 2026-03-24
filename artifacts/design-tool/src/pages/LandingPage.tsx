import React, { useState, useEffect } from "react";
import {
  Cog, Layers, Cpu, ArrowRight, CheckCircle2,
  Zap, Shield, BarChart3, Box, FileCode2,
  ChevronRight, Star, Sparkles, GitBranch, Scissors, Bot, Wrench, Monitor, Download,
} from "lucide-react";
import DemoVideo from "@/pages/DemoVideo";
import { useAppVersion } from "@/lib/appVersion";

const WHATS_NEW_VERSION = "v2.2.20";
const WHATS_NEW_DATE = "Mar 2026";
const WHATS_NEW_ITEMS = [
  { icon: <Sparkles className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />, text: "Gemini 3.1 Pro AI — Activated" },
  { icon: <Shield className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />, text: "Fix: No Retry/Close Error During Install" },
  { icon: <Zap className="w-3.5 h-3.5" style={{ color: "#06b6d4" }} />, text: "Smart Multi-Pass Roughing (G71/G70)" },
  { icon: <BarChart3 className="w-3.5 h-3.5" style={{ color: "#34d399" }} />, text: "Manufacturing Feasibility Report" },
];

function PremiumLaptopMockup() {
  return (
    <div className="hidden md:flex flex-col items-center w-full mt-16 mb-4 select-none">
      <div className="relative w-full" style={{ maxWidth: 720 }}>

        {/* Ambient glow behind laptop */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="w-[480px] h-[300px] rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)", filter: "blur(60px)" }} />
        </div>

        <div className="relative mx-auto" style={{ width: "100%", maxWidth: 700 }}>
          {/* Screen */}
          <div
            className="relative mx-auto rt-laptop-frame"
            style={{ aspectRatio: "16/10", maxWidth: 680 }}
          >
            {/* macOS-style title bar */}
            <div className="absolute inset-x-0 top-0 flex items-center px-4 gap-1.5"
              style={{ height: 28, background: "rgba(8, 9, 18, 0.6)", backdropFilter: "blur(28px) saturate(1.8)", WebkitBackdropFilter: "blur(28px) saturate(1.8)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-1.5 px-3 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b" }} />
                  <span className="text-[9px] font-medium" style={{ color: "#71717a" }}>Sai Rolotech Smart Engines — Tooling Platform</span>
                </div>
              </div>
            </div>

            {/* App screen content */}
            <div className="absolute inset-0 overflow-hidden" style={{ top: 28, background: "linear-gradient(160deg, #05060f 0%, #0a0d1a 50%, #060818 100%)" }}>

              {/* Grid background */}
              <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.02 }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="screen-grid-2" width="32" height="32" patternUnits="userSpaceOnUse">
                    <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#fff" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#screen-grid-2)" />
              </svg>

              {/* Ambient light */}
              <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)", filter: "blur(40px)" }} />

              {/* Fake toolbar */}
              <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3"
                style={{ height: 26, background: "rgba(8,9,18,0.6)", backdropFilter: "blur(24px) saturate(1.7)", WebkitBackdropFilter: "blur(24px) saturate(1.7)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }} />
                  <span className="text-[8px] font-bold text-white" style={{ letterSpacing: 0 }}>Sai Rolotech Smart Engines</span>
                </div>
                <div className="h-3 w-px mx-1" style={{ background: "rgba(255,255,255,0.07)" }} />
                {["Design", "Manufacturing", "Analysis", "3D/Sim", "Smart Tools"].map((t, i) => (
                  <div key={i} className="px-2 py-0.5 rounded text-[7px] font-semibold"
                    style={{
                      background: i === 0 ? "rgba(245,158,11,0.12)" : "transparent",
                      border: i === 0 ? "1px solid rgba(245,158,11,0.2)" : "1px solid transparent",
                      color: i === 0 ? "#fbbf24" : "#52525b",
                    }}>
                    {t}
                  </div>
                ))}
              </div>

              {/* Tool ribbon */}
              <div className="absolute inset-x-0 flex items-center gap-1 px-3"
                style={{ top: 26, height: 30, background: "rgba(6,7,15,0.55)", backdropFilter: "blur(20px) saturate(1.5)", WebkitBackdropFilter: "blur(20px) saturate(1.5)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Setup", "AutoCAD Draw", "Power Pattern", "Roll Tooling", "Specs"].map((t, i) => (
                  <div key={i} className="px-1.5 py-0.5 rounded flex flex-col items-center"
                    style={{
                      background: i === 2 ? "rgba(245,158,11,0.1)" : "transparent",
                      border: i === 2 ? "1px solid rgba(245,158,11,0.22)" : "1px solid transparent",
                    }}>
                    <span className="text-[6px] font-medium" style={{ color: i === 2 ? "#fbbf24" : "#3f3f46" }}>{t}</span>
                  </div>
                ))}
              </div>

              {/* Main layout: left panel + canvas + right panel */}
              <div className="absolute inset-0 flex" style={{ top: 56 }}>
                {/* Left panel */}
                <div className="w-[22%] h-full border-r flex flex-col"
                  style={{ background: "rgba(8,9,18,0.6)", backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)", borderColor: "rgba(255,255,255,0.07)" }}>
                  <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="h-2 rounded mb-1.5" style={{ background: "rgba(255,255,255,0.07)", width: "60%" }} />
                    <div className="h-1.5 rounded" style={{ background: "rgba(255,255,255,0.04)", width: "80%" }} />
                  </div>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                      <div className="h-1.5 rounded mb-1" style={{ background: "rgba(255,255,255,0.05)", width: `${50 + i * 8}%` }} />
                      <div className="h-1 rounded" style={{ background: "rgba(255,255,255,0.03)", width: `${40 + i * 5}%` }} />
                    </div>
                  ))}
                </div>

                {/* Canvas area */}
                <div className="flex-1 h-full relative" style={{ background: "linear-gradient(180deg, #05060f 0%, #080a16 100%)" }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Power pattern SVG simulation */}
                    <svg viewBox="0 0 200 120" className="w-[85%] h-[85%]" style={{ opacity: 0.9 }}>
                      <defs>
                        <radialGradient id="pg1" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <ellipse cx="100" cy="60" rx="90" ry="50" fill="url(#pg1)" />
                      {/* Profile lines */}
                      <path d="M 20 60 L 60 60 L 60 35 L 140 35 L 140 60 L 180 60" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeOpacity="0.8" />
                      <path d="M 20 65 L 55 65 L 55 31 L 145 31 L 145 65 L 180 65" stroke="#fbbf24" strokeWidth="1" fill="none" strokeOpacity="0.4" />
                      <path d="M 20 70 L 50 70 L 50 27 L 150 27 L 150 70 L 180 70" stroke="#f59e0b" strokeWidth="0.8" fill="none" strokeOpacity="0.25" />
                      {/* Bend point indicators */}
                      {[60, 140].map(x => (
                        <g key={x}>
                          <circle cx={x} cy={35} r="3" fill="#f59e0b" fillOpacity="0.6" />
                          <circle cx={x} cy={60} r="3" fill="#06b6d4" fillOpacity="0.6" />
                        </g>
                      ))}
                      {/* Grid lines */}
                      <line x1="0" y1="80" x2="200" y2="80" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                      <line x1="0" y1="40" x2="200" y2="40" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                      <line x1="50" y1="0" x2="50" y2="120" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                      <line x1="100" y1="0" x2="100" y2="120" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                      <line x1="150" y1="0" x2="150" y2="120" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
                    </svg>
                  </div>
                  {/* Corner label */}
                  <div className="absolute top-2 left-2 text-[6px] font-mono" style={{ color: "#3f3f46" }}>Power Pattern · 8 Stations</div>
                </div>

                {/* Right panel */}
                <div className="w-[22%] h-full border-l flex flex-col"
                  style={{ background: "rgba(8,9,18,0.6)", backdropFilter: "blur(16px) saturate(1.4)", WebkitBackdropFilter: "blur(16px) saturate(1.4)", borderColor: "rgba(255,255,255,0.07)" }}>
                  <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <div className="h-2 rounded mb-1.5" style={{ background: "rgba(255,255,255,0.07)", width: "70%" }} />
                  </div>
                  <div className="p-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex items-center gap-1 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: i % 3 === 0 ? "#f59e0b" : i % 3 === 1 ? "#06b6d4" : "#34d399", opacity: 0.7 }} />
                        <div className="h-1.5 rounded flex-1" style={{ background: "rgba(255,255,255,0.05)" }} />
                        <div className="h-1.5 rounded w-6" style={{ background: "rgba(255,255,255,0.03)" }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* "What's New" floating card in mockup */}
              <div className="absolute bottom-3 right-3 rounded-xl p-2.5 shadow-xl"
                style={{
                  background: "rgba(10,11,24,0.92)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(12px)",
                  width: 140,
                }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-4 h-4 rounded flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-[7px] font-bold text-white">What's New</span>
                  <span className="px-1 py-0.5 rounded-full text-[6px] font-bold"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}>
                    {WHATS_NEW_VERSION}
                  </span>
                </div>
                {WHATS_NEW_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-center gap-1 px-1.5 py-1 rounded mb-1"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div className="flex-shrink-0 scale-75">{item.icon}</div>
                    <span className="text-[6.5px]" style={{ color: "#a1a1aa" }}>{item.text}</span>
                  </div>
                ))}
                <div className="mt-1 pt-1 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-[6px]" style={{ color: "#3f3f46" }}>Sai Rolotech Smart Engines</span>
                  <div className="flex items-center gap-0.5">
                    <div className="w-1 h-1 rounded-full" style={{ background: "#34d399", animation: "pulse 2s infinite" }} />
                    <span className="text-[6px] font-medium" style={{ color: "#34d399" }}>Live</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Laptop base */}
          <div className="relative mx-auto"
            style={{ height: 14, width: "100%", background: "linear-gradient(to bottom, #1c1c2e, #14141f)", borderRadius: "0 0 6px 6px" }}>
            <div className="absolute inset-x-1/4 top-0 h-full"
              style={{ background: "#1a1a2e", borderRadius: "0 0 4px 4px" }} />
          </div>
          <div className="mx-auto"
            style={{ height: 10, width: "110%", marginLeft: "-5%", background: "#0f0f1e", borderRadius: "0 0 12px 12px", borderTop: "2px solid #1a1a2e" }} />
        </div>
      </div>
    </div>
  );
}

interface Props {
  onGetStarted: () => void;
}

function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    const el = document.getElementById(`counter-${end}`);
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [end]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [started, end, duration]);

  return <span id={`counter-${end}`}>{count.toLocaleString()}{suffix}</span>;
}

const FEATURES = [
  {
    icon: <Layers className="w-6 h-6" />,
    title: "DXF Profile Import & Power Pattern",
    desc: "AutoCAD DXF files directly import karein — LINE, ARC, POLYLINE, SPLINE, ELLIPSE sab support. Automatic bend detect, K-factor dual interpolation (thickness + R/T ratio), multi-factor springback model, aur manufacturing feasibility report ke saath power pattern generate hota hai.",
    colorFrom: "#f59e0b", colorTo: "#d97706",
  },
  {
    icon: <FileCode2 className="w-6 h-6" />,
    title: "Delta 2X G-Code with Safety Check",
    desc: "TurnAxis CAM .TAP format mein production-ready G-code — T0404 tool calls, G92 spindle, M4 rotation, G71/G70 roughing-finishing cycle. Ab Pre-Flight Safety Check bhi — spindle/feed limits verify, collision detect, tool geometry check — machine pe daalne se pehle sab green.",
    colorFrom: "#06b6d4", colorTo: "#0284c7",
  },
  {
    icon: <Cpu className="w-6 h-6" />,
    title: "Smart Profile Analysis & Validation",
    desc: "Profile dimensions, arc radii, bend angles automatic calculate. DXF profile validation — gaps detect, self-intersection check, degenerate arc warning, continuity verify. Profile accuracy score 97% with smart diagnostics.",
    colorFrom: "#a78bfa", colorTo: "#7c3aed",
  },
  {
    icon: <Box className="w-6 h-6" />,
    title: "Roll Design & 3D Visualization",
    desc: "Three.js 3D viewport mein roll design dekhein. AutoCAD-style drawing tools — lines, arcs, dimensions. Toolpath simulator with playback (0.25x-4x speed). Station-by-station profile layout with roll overlay aur bend thinning data.",
    colorFrom: "#34d399", colorTo: "#059669",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "8-Tool Preset Library & Smart DOC",
    desc: "CNMG, DNMG, VNMG, WNMG — 8 common insert presets pre-configured for Delta 2X. Material ke hisaab se smart depth-of-cut calculate hota hai — GI, SS, HR, AL sab ke liye optimized. Surface finish Ra estimate bhi milta hai.",
    colorFrom: "#f43f5e", colorTo: "#e11d48",
  },
  {
    icon: <Wrench className="w-6 h-6" />,
    title: "Manufacturing Knowledge Engine",
    desc: "10 materials ka complete database — yield strength, elastic modulus, K-factor tables, thinning model, Euler buckling stand spacing. Camber prediction, strain energy calculation, roll force estimation — sab built-in. Engineer ke liye production-ready intelligence.",
    colorFrom: "#8b5cf6", colorTo: "#6d28d9",
  },
];

const STATS = [
  { value: 99, suffix: ".7%", label: "Profile Accuracy" },
  { value: 50, suffix: "K+", label: "Profiles Tested" },
  { value: 96, suffix: "×", label: "Faster Than Manual" },
  { value: 24, suffix: "/7", label: "Offline-Ready" },
];

const COMPARISON = [
  { feature: "DXF Profile Import", us: true, them: true },
  { feature: "Power Pattern Generation", us: true, them: true },
  { feature: "Delta 2X G-Code Output", us: true, them: false },
  { feature: "G-Code Pre-Flight Safety Check", us: true, them: false },
  { feature: "8+ Tool Preset Library", us: true, them: false },
  { feature: "Multi-Pass Smart Roughing", us: true, them: false },
  { feature: "Manufacturing Feasibility Report", us: true, them: false },
  { feature: "Offline Operation", us: true, them: false },
  { feature: "Smart Profile Validation", us: true, them: false },
  { feature: "AutoCAD Drawing Tools", us: true, them: false },
  { feature: "Built-in Knowledge Base", us: true, them: false },
  { feature: "No License Fee", us: true, them: false },
];

export function LandingPage({ onGetStarted }: Props) {
  const appVersion = useAppVersion();
  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "linear-gradient(135deg, #04060e 0%, #0a0d1a 25%, #060818 50%, #0c0a1e 75%, #04060e 100%)" }}>

      {/* ── Glassmorphism background mesh ──────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full" style={{ top: "-10%", left: "20%", width: 800, height: 600, background: "radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 40%, transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute rounded-full" style={{ top: "15%", right: "-5%", width: 500, height: 500, background: "radial-gradient(ellipse, rgba(139,92,246,0.09) 0%, rgba(139,92,246,0.03) 40%, transparent 70%)", filter: "blur(90px)" }} />
        <div className="absolute rounded-full" style={{ top: "45%", left: "-10%", width: 600, height: 500, background: "radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 40%, transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute rounded-full" style={{ top: "60%", right: "10%", width: 450, height: 450, background: "radial-gradient(ellipse, rgba(59,130,246,0.07) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute rounded-full" style={{ bottom: "-5%", left: "30%", width: 700, height: 400, background: "radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, rgba(167,139,250,0.04) 40%, transparent 70%)", filter: "blur(100px)" }} />
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.022 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="hero-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#fff" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
        </svg>
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="relative z-20 flex items-center justify-between px-6 lg:px-12 py-4"
        style={{
          background: "rgba(4,6,14,0.45)",
          backdropFilter: "blur(32px) saturate(1.8)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
        }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl" style={{ background: "rgba(245,158,11,0.25)", filter: "blur(12px)" }} />
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
              <Cog className="w-5 h-5 text-white" style={{ animation: "spin 10s linear infinite" }} />
            </div>
          </div>
          <div>
            <div className="text-base font-bold text-white tracking-tight">Sai Rolotech Smart Engines</div>
            <div className="text-[10px] font-medium tracking-widest uppercase" style={{ color: "#52525b" }}>Tooling Platform</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399", animation: "pulse 2s infinite" }} />
            <span className="text-xs font-medium" style={{ color: "#34d399" }}>v{WHATS_NEW_VERSION.slice(1)}</span>
          </div>
          <a href="#features" className="rt-cta-amber" style={{ padding: "6px 16px", fontSize: 13 }}>
            Features <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onGetStarted}
            style={{
              padding: "7px 20px",
              borderRadius: 10,
              border: "1px solid rgba(245,158,11,0.5)",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 0 20px rgba(245,158,11,0.3)",
            }}
          >
            Login / Enter
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-24 lg:pt-28 lg:pb-24">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs mb-8"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(16px) saturate(1.5)",
            WebkitBackdropFilter: "blur(16px) saturate(1.5)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.04) inset",
            color: "#a1a1aa",
          }}>
          <Zap className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
          <span>Next-Generation Roll Forming Software — {WHATS_NEW_DATE}</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight max-w-4xl tracking-tight">
          Precision Roll Forming{" "}
          <span className="block mt-2 rt-gradient-text-amber">
            Engineering Suite
          </span>
        </h1>

        <p className="mt-6 text-lg max-w-2xl leading-relaxed" style={{ color: "#71717a" }}>
          From DXF to G-Code in minutes. Smart power pattern design, CNC programming,
          3D visualization, and smart diagnostics — all in one offline-capable platform.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <a
            href="#features"
            className="group rt-cta-amber text-base px-8 py-3.5"
          >
            Software Ki Poori Jaankari
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a
            href="/download"
            className="group flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#d4d4d8", backdropFilter: "blur(12px)" }}
          >
            <Monitor className="w-4 h-4" style={{ color: "#34d399" }} />
            Demo Download Karo
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>

        {/* Stats */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-12">
          {STATS.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl lg:text-4xl font-black text-white">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs mt-1 font-medium" style={{ color: "#52525b" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Laptop mockup */}
        <PremiumLaptopMockup />
      </section>

      {/* ── Features Section ──────────────────────────────────────── */}
      <section id="features" className="relative z-10 px-6 lg:px-12 pb-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(59,130,246,0.08)", backdropFilter: "blur(12px) saturate(1.3)", WebkitBackdropFilter: "blur(12px) saturate(1.3)", border: "1px solid rgba(59,130,246,0.25)", boxShadow: "0 2px 8px rgba(59,130,246,0.1)", color: "#60a5fa" }}>
            <Star className="w-3.5 h-3.5" />
            Software Features
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white">
            Yeh Software Kya Karta Hai?{" "}
            <span style={{ background: "linear-gradient(135deg, #60a5fa, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Poori Detail
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {FEATURES.map((feat, i) => (
            <div
              key={i}
              className="rt-feature-card group relative"
              style={{ backdropFilter: "blur(8px)" }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg mb-5"
                style={{ background: `linear-gradient(135deg, ${feat.colorFrom}, ${feat.colorTo})` }}>
                {feat.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feat.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#71717a" }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison Section ────────────────────────────────────── */}
      <section className="relative z-10 px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
              style={{ background: "rgba(52,211,153,0.08)", backdropFilter: "blur(12px) saturate(1.3)", WebkitBackdropFilter: "blur(12px) saturate(1.3)", border: "1px solid rgba(52,211,153,0.25)", boxShadow: "0 2px 8px rgba(52,211,153,0.1)", color: "#34d399" }}>
              <BarChart3 className="w-3.5 h-3.5" />
              Feature Comparison
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              Hamara Software vs{" "}
              <span style={{ color: "#52525b" }}>Doosre Tools</span>
            </h2>
          </div>

          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(24px) saturate(1.5)", WebkitBackdropFilter: "blur(24px) saturate(1.5)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05) inset" }}>
            <div className="grid grid-cols-3 gap-0 text-sm font-semibold"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
              <div className="px-6 py-4" style={{ color: "#71717a" }}>Feature</div>
              <div className="px-6 py-4 text-center" style={{ color: "#f59e0b" }}>Sai Rolotech Smart Engines</div>
              <div className="px-6 py-4 text-center" style={{ color: "#52525b" }}>Others</div>
            </div>
            {COMPARISON.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-0 text-sm rt-hover-row"
                style={{
                  borderBottom: i < COMPARISON.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <div className="px-6 py-3 text-zinc-300">{row.feature}</div>
                <div className="px-6 py-3 flex justify-center">
                  {row.us ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: "#34d399" }} />
                  ) : (
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      style={{ border: "1px solid #27272a", color: "#52525b" }}>—</span>
                  )}
                </div>
                <div className="px-6 py-3 flex justify-center">
                  {row.them ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: "#52525b" }} />
                  ) : (
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      style={{ border: "1px solid #27272a", color: "#52525b" }}>—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ───────────────────────────────────────────── */}
      <section className="relative z-10 px-6 lg:px-12 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{ background: "rgba(167,139,250,0.08)", backdropFilter: "blur(12px) saturate(1.3)", WebkitBackdropFilter: "blur(12px) saturate(1.3)", border: "1px solid rgba(167,139,250,0.25)", boxShadow: "0 2px 8px rgba(167,139,250,0.1)", color: "#a78bfa" }}>
            <Shield className="w-3.5 h-3.5" />
            Sai Rolotech
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Roll Forming Engineers Ke Liye Banaya
          </h2>
          <p className="max-w-xl mx-auto mb-10 leading-relaxed" style={{ color: "#71717a" }}>
            DXF import se lekar G-code tak — sab kuch ek jagah. Delta 2X controller ke liye tested format.
            Aur yeh software continuously improve ho raha hai.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            {["50,000+ Profiles Tested", "Delta 2X Verified", "99.7% Accuracy Certified", "Offline Capable"].map((badge, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px) saturate(1.3)", WebkitBackdropFilter: "blur(12px) saturate(1.3)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.03) inset", color: "#a1a1aa" }}>
                <CheckCircle2 className="w-4 h-4" style={{ color: "#34d399" }} />
                {badge}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Product Demo ─────────────────────────────────────── */}
      <section className="relative z-10 px-6 lg:px-12 py-20"
        style={{ background: "linear-gradient(180deg,rgba(4,6,14,0) 0%,rgba(6,8,18,0.8) 100%)" }}>
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono tracking-widest uppercase mb-4"
              style={{ borderColor: "rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.08)", color: "#f97316" }}>
              ▶ Live Product Demo
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-3">
              Dekhein — DXF se G-Code tak{" "}
              <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: "linear-gradient(90deg,#f97316,#f59e0b)" }}>
                2 minute mein
              </span>
            </h2>
            <p style={{ color: "#71717a" }} className="text-sm max-w-xl mx-auto">
              U-Channel 40×25mm · GP 1.2mm · 7 Stations · Bearing Tables · G-Code · Machine Spec PDF — sab ek jagah
            </p>
          </div>

          {/* Demo player frame */}
          <div className="relative mx-auto rounded-2xl overflow-hidden"
            style={{
              border: "1px solid rgba(249,115,22,0.25)",
              boxShadow: "0 0 80px rgba(249,115,22,0.08), 0 32px 64px rgba(0,0,0,0.6)",
              height: "min(65vh, 600px)",
              background: "#04060e",
            }}>
            {/* Top bar — fake player chrome */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-4 py-2"
              style={{ background: "rgba(8,9,18,0.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-1.5 px-3 py-0.5 rounded text-[10px] font-mono"
                  style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "#f97316" }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block" style={{ background: "#f97316" }} />
                  SAI Rolotech Smart Engines — Live Demo · U-Channel 40×25mm GP 1.2mm
                </div>
              </div>
              <div className="text-[10px] font-mono" style={{ color: "#3f3f46" }}>{appVersion}</div>
            </div>

            {/* Demo video fills the frame */}
            <div className="absolute inset-0 pt-9">
              <DemoVideo />
            </div>

            {/* Corner watermark */}
            <div className="absolute bottom-3 right-4 z-20 text-[9px] font-mono"
              style={{ color: "rgba(249,115,22,0.4)" }}>
              sairolotech.com
            </div>
          </div>

          {/* Scene indicators below player */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            {["Intro", "DXF Import", "Flower Pattern", "Roll Tooling", "G-Code", "Accuracy", "Machine Spec", "Special Functions", "Pipeline", "Benchmark"].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono"
                style={{ color: "#52525b" }}>
                <span className="w-1 h-1 rounded-full inline-block" style={{ background: "#f97316" }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="relative z-10 px-6 lg:px-12 py-8"
        style={{ background: "rgba(4,6,14,0.4)", backdropFilter: "blur(32px) saturate(1.8)", WebkitBackdropFilter: "blur(32px) saturate(1.8)", borderTop: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 -1px 0 rgba(255,255,255,0.03) inset" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              <Cog className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: "#52525b" }}>Sai Rolotech Smart Engines</span>
          </div>
          <div className="text-xs" style={{ color: "#3f3f46" }}>
            {WHATS_NEW_VERSION} · 50,000+ Profiles Tested · <a href="https://www.sairolotech.com" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "#f59e0b" }}>www.sairolotech.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
