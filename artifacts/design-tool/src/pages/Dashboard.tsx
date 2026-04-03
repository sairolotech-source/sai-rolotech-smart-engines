import React, { useState, useEffect } from "react";
import {
  Plus, Clock, ArrowRight, Zap, FileCode2,
  Wrench, Layers, Box, Star, Cpu,
  Upload, Folder, TrendingUp, Activity, Sparkles, PlayCircle,
} from "lucide-react";
import { useCncStore, type AppTab } from "../store/useCncStore";
import { WelcomeRobot } from "../components/WelcomeRobot";

const ROBOT_SHOWN_KEY = "sai-rolotech-robot-shown-session";

interface Props {
  onOpenWorkspace: (tab?: AppTab) => void;
}

const QUICK_START_TEMPLATES = [
  {
    id: "u-channel",
    name: "U-Channel",
    desc: "Simple U-profile with equal flanges",
    icon: <span className="text-xl font-black" style={{ color: "#f59e0b" }}>U</span>,
    stations: 6,
    accentColor: "rgba(245, 158, 11, 0.14)",
    borderColor: "rgba(245, 158, 11, 0.22)",
    glowColor: "rgba(245, 158, 11, 0.08)",
  },
  {
    id: "c-channel",
    name: "C-Channel",
    desc: "C-profile with top flanges",
    icon: <span className="text-xl font-black" style={{ color: "#06b6d4" }}>C</span>,
    stations: 8,
    accentColor: "rgba(6, 182, 212, 0.14)",
    borderColor: "rgba(6, 182, 212, 0.22)",
    glowColor: "rgba(6, 182, 212, 0.07)",
  },
  {
    id: "z-profile",
    name: "Z-Profile",
    desc: "Z-section with opposing flanges",
    icon: <span className="text-xl font-black" style={{ color: "#a78bfa" }}>Z</span>,
    stations: 7,
    accentColor: "rgba(167, 139, 250, 0.14)",
    borderColor: "rgba(167, 139, 250, 0.22)",
    glowColor: "rgba(167, 139, 250, 0.07)",
  },
  {
    id: "hat-section",
    name: "Hat Section",
    desc: "Hat/omega profile with stiffeners",
    icon: <span className="text-xl font-black" style={{ color: "#34d399" }}>Ω</span>,
    stations: 10,
    accentColor: "rgba(52, 211, 153, 0.14)",
    borderColor: "rgba(52, 211, 153, 0.22)",
    glowColor: "rgba(52, 211, 153, 0.07)",
  },
  {
    id: "shutter-patti",
    name: "Shutter Patti",
    desc: "Rolling shutter slat profile",
    icon: <span className="text-xl font-black" style={{ color: "#f87171" }}>S</span>,
    stations: 5,
    accentColor: "rgba(248, 113, 113, 0.14)",
    borderColor: "rgba(248, 113, 113, 0.22)",
    glowColor: "rgba(248, 113, 113, 0.07)",
  },
  {
    id: "custom",
    name: "Custom Profile",
    desc: "Upload your own DXF file",
    icon: <Upload className="w-5 h-5" style={{ color: "#60a5fa" }} />,
    stations: 0,
    accentColor: "rgba(96, 165, 250, 0.14)",
    borderColor: "rgba(96, 165, 250, 0.22)",
    glowColor: "rgba(96, 165, 250, 0.07)",
  },
];

const WHATS_NEW = [
  { version: "v2.1", title: "Figma-Level Premium UI", desc: "Deep glassmorphism, premium dark theme, laptop-optimized layout" },
  { version: "v2.0", title: "Commercial UI/UX Overhaul", desc: "New landing page, dashboard, and polished workspace experience" },
  { version: "v1.9", title: "3D Studio & Digital Twin", desc: "Full 3D CAD/CAM workspace with real-time machine visualization" },
];

const QUICK_ACTIONS = [
  {
    id: "setup", label: "New Design", icon: <Plus className="w-5 h-5" />, desc: "Start from scratch",
    color: "#f59e0b", glow: "rgba(245,158,11,0.2)", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)",
  },
  {
    id: "wizard", label: "Wizard Mode", icon: <Star className="w-5 h-5" />, desc: "Step-by-step guide",
    color: "#60a5fa", glow: "rgba(96,165,250,0.2)", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)",
  },
  {
    id: "factory", label: "Factory Smart", icon: <Cpu className="w-5 h-5" />, desc: "Smart diagnostics",
    color: "#a78bfa", glow: "rgba(167,139,250,0.2)", bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.2)",
  },
  {
    id: "studio3d", label: "3D Studio", icon: <Box className="w-5 h-5" />, desc: "CAD + CAM",
    color: "#34d399", glow: "rgba(52,211,153,0.2)", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)",
  },
  {
    id: "demo-videos", label: "Demo Videos", icon: <PlayCircle className="w-5 h-5" />, desc: "Feature walkthroughs",
    color: "#f43f5e", glow: "rgba(244,63,94,0.2)", bg: "rgba(244,63,94,0.1)", border: "rgba(244,63,94,0.2)",
  },
];

export function Dashboard({ onOpenWorkspace }: Props) {
  const { geometry, stations, gcodeOutputs, rollTooling, reset } = useCncStore();
  const hasProject = !!geometry;

  const handleNewProject = () => {
    if (hasProject) {
      const ok = window.confirm(
        "Current project data will be cleared.\nStart a fresh New Project?"
      );
      if (!ok) return;
    }
    reset();
    onOpenWorkspace("setup");
  };

  const [showRobot, setShowRobot] = useState(() => {
    return !sessionStorage.getItem(ROBOT_SHOWN_KEY);
  });

  const handleDismissRobot = () => {
    setShowRobot(false);
    sessionStorage.setItem(ROBOT_SHOWN_KEY, "1");
  };

  return (
    <div className="min-h-screen overflow-auto" style={{ background: "#05060f", color: "#f4f4f5" }}>

      {showRobot && <WelcomeRobot userName="Vipu" onDismiss={handleDismissRobot} />}

      {/* Background ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-1/3 right-0 w-[500px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(6,182,212,0.04) 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-8">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4" style={{ color: "#f59e0b" }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(245,158,11,0.7)" }}>
                Dashboard
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h1>
            <p className="text-sm mt-1" style={{ color: "#71717a" }}>Your roll forming design workspace</p>
          </div>
          <button
            onClick={handleNewProject}
            className="rt-cta-amber"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* ── Quick Actions ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => onOpenWorkspace(action.id as AppTab)}
              className="group rt-action-card rt-glow-card flex flex-col items-center gap-3 text-center"
              style={{
                background: action.bg,
                border: `1px solid ${action.border}`,
                ["--card-glow" as string]: action.glow,
              }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: `rgba(255,255,255,0.06)`, color: action.color }}>
                {action.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">{action.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "#52525b" }}>{action.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Current Project Card ─────────────────────────────────── */}
        {hasProject && (
          <div className="mb-10">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "#52525b" }}>
              <Clock className="w-3.5 h-3.5" />
              Current Project
            </h2>
            <div className="rounded-2xl p-5 transition-all"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
              }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.22)" }}>
                    <Folder className="w-6 h-6" style={{ color: "#f59e0b" }} />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white">Active Design</div>
                    <div className="text-xs mt-0.5" style={{ color: "#52525b" }}>
                      {geometry?.segments?.length || 0} segments · {stations.length} stations · {gcodeOutputs.length} G-code outputs
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onOpenWorkspace()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold rt-tool-panel-btn active"
                  style={{ width: "auto" }}
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-5 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { label: "Segments", value: geometry?.segments?.length || 0, color: "#f59e0b" },
                  { label: "Bend Points", value: geometry?.bendPoints?.length || 0, color: "#06b6d4" },
                  { label: "Stations", value: stations.length, color: "#60a5fa" },
                  { label: "Roll Tools", value: rollTooling.length, color: "#a78bfa" },
                ].map((s, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#52525b" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Quick Start Templates ────────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "#52525b" }}>
            <Zap className="w-3.5 h-3.5" />
            Quick Start Templates
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {QUICK_START_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => onOpenWorkspace("setup")}
                className="group rt-template-card rt-glow-card flex flex-col items-center gap-3 text-center"
                style={{
                  background: tmpl.accentColor,
                  border: `1px solid ${tmpl.borderColor}`,
                  ["--card-glow" as string]: tmpl.glowColor,
                }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {tmpl.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200">{tmpl.name}</div>
                  <div className="text-[10px] mt-0.5 leading-tight" style={{ color: "#52525b" }}>{tmpl.desc}</div>
                  {tmpl.stations > 0 && (
                    <div className="text-[10px] mt-1" style={{ color: "#3f3f46" }}>{tmpl.stations} stations</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Stats + What's New ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "#52525b" }}>
              <Activity className="w-3.5 h-3.5" />
              Usage Statistics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Designs Created", value: stations.length > 0 ? "1" : "0", icon: <Layers className="w-4 h-4" />, trend: "+0%", color: "#f59e0b" },
                { label: "G-Code Generated", value: gcodeOutputs.length.toString(), icon: <FileCode2 className="w-4 h-4" />, trend: gcodeOutputs.length > 0 ? "+100%" : "0%", color: "#06b6d4" },
                { label: "Roll Tools", value: rollTooling.length.toString(), icon: <Wrench className="w-4 h-4" />, trend: rollTooling.length > 0 ? "+100%" : "0%", color: "#a78bfa" },
                { label: "Smart Analyses", value: "0", icon: <Cpu className="w-4 h-4" />, trend: "+0%", color: "#34d399" },
              ].map((stat, i) => (
                <div key={i} className="rt-stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <span style={{ color: stat.color }}>{stat.icon}</span>
                    <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: "#34d399" }}>
                      <TrendingUp className="w-3 h-3" />
                      {stat.trend}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#52525b" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "#52525b" }}>
              <Star className="w-3.5 h-3.5" />
              What's New
            </h2>
            <div className="space-y-3">
              {WHATS_NEW.map((item, i) => (
                <div key={i} className="rt-template-card">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                      {item.version}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-zinc-200">{item.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#52525b" }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
