import React, { useState, useEffect, useRef } from "react";
import {
  Cog, Layers, Cpu, ArrowRight, CheckCircle2,
  Zap, Shield, BarChart3, Box, FileCode2,
  Star, Sparkles, Wrench, Monitor, Factory,
  ChevronRight, Globe, Settings2, Gauge, Award,
} from "lucide-react";
import { useAppVersion } from "@/lib/appVersion";

/* ─────────────────── Animation CSS ─────────────────────── */
const ANIM_CSS = `
@keyframes sai-fade-up {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sai-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sai-scale-in {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes sai-slide-right {
  from { opacity: 0; transform: translateX(-24px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes sai-slide-left {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes sai-glow-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}
@keyframes sai-spin-slow {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes sai-counter-bar {
  from { width: 0%; }
  to   { width: var(--bar-w); }
}
.sai-layer { opacity: 0; animation-fill-mode: forwards; }
.sai-layer.visible { animation: sai-fade-up 0.65s cubic-bezier(0.22,1,0.36,1) forwards; }
`;

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
}

function Layer({ children, delay = 0, className = "", style = {} }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  return (
    <div
      ref={ref}
      className={`sai-layer${visible ? " visible" : ""} ${className}`}
      style={{ animationDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}

/* ─────────────────── Floating BG particles ──────────────── */
function BackgroundMesh() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Large ambient blobs */}
      <div style={{ position: "absolute", top: "-8%", left: "18%", width: 900, height: 700,
        background: "radial-gradient(ellipse, rgba(245,158,11,0.10) 0%, transparent 65%)",
        filter: "blur(120px)", animation: "sai-glow-pulse 6s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "30%", right: "-8%", width: 600, height: 600,
        background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 65%)",
        filter: "blur(100px)", animation: "sai-glow-pulse 8s ease-in-out infinite 2s" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "-5%", width: 700, height: 500,
        background: "radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 65%)",
        filter: "blur(110px)", animation: "sai-glow-pulse 7s ease-in-out infinite 4s" }} />
      {/* Grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.018 }}>
        <defs>
          <pattern id="sai-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#ffffff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sai-grid)" />
      </svg>
      {/* Diagonal accent line */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04 }}>
        <line x1="0" y1="60%" x2="100%" y2="30%" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 8" />
        <line x1="0" y1="70%" x2="100%" y2="45%" stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="4 12" />
      </svg>
    </div>
  );
}

/* ─────────────────── Nav ─────────────────────────────────── */
function Nav({ appVersion }: { appVersion: string }) {
  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 40px", height: 64,
      background: "rgba(4,6,14,0.72)",
      backdropFilter: "blur(32px) saturate(1.8)",
      WebkitBackdropFilter: "blur(32px) saturate(1.8)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 12,
            background: "rgba(245,158,11,0.3)", filter: "blur(14px)" }} />
          <div style={{
            position: "relative", width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
          }}>
            <Cog style={{ width: 20, height: 20, color: "#fff", animation: "sai-spin-slow 12s linear infinite" }} />
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: "-0.01em" }}>
            SAI Rolotech
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#52525b" }}>
            Smart Engineering
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399",
            animation: "sai-glow-pulse 2s infinite" }} />
          <span style={{ fontSize: 11, color: "#34d399", fontWeight: 600 }}>{appVersion}</span>
        </div>
        <a href="https://www.sairolotech.com" target="_blank" rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            color: "#a1a1aa", textDecoration: "none",
          }}>
          <Globe style={{ width: 13, height: 13 }} />
          sairolotech.com
        </a>
      </div>
    </nav>
  );
}

/* ─────────────────── Hero ────────────────────────────────── */
function Hero({ onGetStarted, onPreload }: { onGetStarted: () => void; onPreload: () => void }) {
  return (
    <section style={{ position: "relative", zIndex: 10, padding: "80px 40px 60px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Badge */}
      <Layer delay={0} style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 18px", borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)",
          color: "#f59e0b", backdropFilter: "blur(12px)",
        }}>
          <Award style={{ width: 13, height: 13 }} />
          Precision Manufacturing & Engineering — Since 2020
        </div>
      </Layer>

      {/* Headline */}
      <Layer delay={80} style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{
          fontSize: "clamp(42px,7vw,84px)", fontWeight: 900, lineHeight: 1.05,
          letterSpacing: "-0.03em", color: "#fff", margin: 0,
        }}>
          SAI Rolotech
          <span style={{
            display: "block", marginTop: 4,
            background: "linear-gradient(135deg,#f59e0b 0%,#fbbf24 40%,#f97316 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Smart Engines
          </span>
        </h1>
      </Layer>

      {/* Subheadline */}
      <Layer delay={160} style={{ textAlign: "center", marginBottom: 48 }}>
        <p style={{ fontSize: 17, color: "#71717a", maxWidth: 620, margin: "0 auto", lineHeight: 1.65 }}>
          World-class Roll Forming Machines built with German precision — paired with an
          AI-powered Design Engine that takes your profile from DXF to G-Code in minutes.
        </p>
      </Layer>

      {/* Stats row */}
      <Layer delay={240}>
        <div style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 0,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, overflow: "hidden", marginBottom: 56, backdropFilter: "blur(16px)",
        }}>
          {[
            { val: "99.7%", label: "Profile Accuracy" },
            { val: "500+", label: "Profiles Tested" },
            { val: "10×", label: "Faster Than Manual" },
            { val: "100%", label: "Offline Capable" },
          ].map((s, i) => (
            <div key={i} style={{
              flex: "1 1 140px", padding: "24px 16px", textAlign: "center",
              borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>{s.val}</div>
              <div style={{ fontSize: 11, color: "#52525b", marginTop: 4, fontWeight: 600, letterSpacing: "0.04em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Layer>

      {/* ── TWO MAIN CHOICE CARDS ── */}
      <Layer delay={320}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
          maxWidth: 900, margin: "0 auto",
        }}
          className="sai-choice-grid">
          {/* MACHINE CARD */}
          <a
            href="https://www.sairolotech.com"
            target="_blank"
            rel="noopener noreferrer"
            className="sai-card-machine"
            style={{
              display: "flex", flexDirection: "column", textDecoration: "none",
              padding: 36, borderRadius: 24, cursor: "pointer",
              background: "linear-gradient(145deg,rgba(245,158,11,0.12) 0%,rgba(217,119,6,0.06) 100%)",
              border: "1px solid rgba(245,158,11,0.3)",
              boxShadow: "0 8px 40px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
              transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
              position: "relative", overflow: "hidden",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(-4px) scale(1.01)";
              el.style.boxShadow = "0 20px 60px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.08)";
              el.style.borderColor = "rgba(245,158,11,0.6)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "";
              el.style.boxShadow = "0 8px 40px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.06)";
              el.style.borderColor = "rgba(245,158,11,0.3)";
            }}
          >
            {/* Glow */}
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200,
              background: "radial-gradient(circle, rgba(245,158,11,0.18) 0%, transparent 70%)",
              filter: "blur(40px)", pointerEvents: "none" }} />

            {/* Icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 16, marginBottom: 20,
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(245,158,11,0.35)",
            }}>
              <Factory style={{ width: 28, height: 28, color: "#fff" }} />
            </div>

            {/* Label */}
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
              color: "#f59e0b", marginBottom: 8,
            }}>Machine</div>

            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>
              Roll Forming<br />Machines
            </h2>

            <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.65, flex: 1, margin: 0 }}>
              Precision-engineered roll forming machines for every profile — C-channels, guardrails, tubes, purlins.
              Built with German-grade steel, servo control, and 20+ years of manufacturing excellence.
            </p>

            <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Servo Controlled", "Custom Profile", "Delta 2X CNC", "Full Support"].map(t => (
                <span key={t} style={{
                  fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b",
                }}>
                  {t}
                </span>
              ))}
            </div>

            <div style={{
              marginTop: 28, display: "flex", alignItems: "center", gap: 8,
              padding: "12px 20px", borderRadius: 12,
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              boxShadow: "0 4px 16px rgba(245,158,11,0.35)",
            }}>
              <Globe style={{ width: 16, height: 16 }} />
              Visit sairolotech.com
              <ArrowRight style={{ width: 16, height: 16, marginLeft: "auto" }} />
            </div>
          </a>

          {/* SOFTWARE CARD */}
          <button
            onClick={() => { onPreload(); onGetStarted(); }}
            className="sai-card-software"
            style={{
              display: "flex", flexDirection: "column",
              padding: 36, borderRadius: 24, cursor: "pointer", textAlign: "left",
              background: "linear-gradient(145deg,rgba(6,182,212,0.10) 0%,rgba(59,130,246,0.06) 100%)",
              border: "1px solid rgba(6,182,212,0.25)",
              boxShadow: "0 8px 40px rgba(6,182,212,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
              transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
              position: "relative", overflow: "hidden",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(-4px) scale(1.01)";
              el.style.boxShadow = "0 20px 60px rgba(6,182,212,0.16), inset 0 1px 0 rgba(255,255,255,0.08)";
              el.style.borderColor = "rgba(6,182,212,0.5)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "";
              el.style.boxShadow = "0 8px 40px rgba(6,182,212,0.06), inset 0 1px 0 rgba(255,255,255,0.05)";
              el.style.borderColor = "rgba(6,182,212,0.25)";
            }}
          >
            {/* Glow */}
            <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200,
              background: "radial-gradient(circle, rgba(6,182,212,0.16) 0%, transparent 70%)",
              filter: "blur(40px)", pointerEvents: "none" }} />

            {/* Icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 16, marginBottom: 20,
              background: "linear-gradient(135deg,#06b6d4,#0284c7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 24px rgba(6,182,212,0.35)",
            }}>
              <Settings2 style={{ width: 28, height: 28, color: "#fff" }} />
            </div>

            {/* Label */}
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase",
              color: "#06b6d4", marginBottom: 8,
            }}>Software</div>

            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 0 12px", lineHeight: 1.2 }}>
              Design Engine<br />v2.2
            </h2>

            <p style={{ fontSize: 13, color: "#a1a1aa", lineHeight: 1.65, flex: 1, margin: 0 }}>
              AI-powered precision roll forming suite — DXF import, power pattern design, 3D visualization,
              G-code generation with pre-flight safety check. From blank to production in minutes.
            </p>

            <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["DXF Import", "G-Code Ready", "3D Viewer", "AI Analysis", "Offline"].map(t => (
                <span key={t} style={{
                  fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                  background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#22d3ee",
                }}>
                  {t}
                </span>
              ))}
            </div>

            <div style={{
              marginTop: 28, display: "flex", alignItems: "center", gap: 8,
              padding: "12px 20px", borderRadius: 12,
              background: "linear-gradient(135deg,#06b6d4,#0284c7)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              boxShadow: "0 4px 16px rgba(6,182,212,0.35)",
            }}>
              <Monitor style={{ width: 16, height: 16 }} />
              Enter Software
              <ArrowRight style={{ width: 16, height: 16, marginLeft: "auto" }} />
            </div>
          </button>
        </div>
      </Layer>
    </section>
  );
}

/* ─────────────────── Why SAI section ────────────────────── */
function WhySAI() {
  const items = [
    {
      icon: <Gauge style={{ width: 22, height: 22, color: "#f59e0b" }} />,
      title: "German-Grade Precision",
      desc: "Every machine manufactured with ±0.01mm tolerance using CNC-machined components and hardened steel rolls.",
      accent: "#f59e0b",
    },
    {
      icon: <Cpu style={{ width: 22, height: 22, color: "#06b6d4" }} />,
      title: "AI-Powered Design Engine",
      desc: "Automatic profile analysis, springback prediction, G-code generation — all driven by machine learning models.",
      accent: "#06b6d4",
    },
    {
      icon: <Shield style={{ width: 22, height: 22, color: "#34d399" }} />,
      title: "Full Offline Operation",
      desc: "7 of 7 modules work without internet. Your production never stops, even in zero-connectivity environments.",
      accent: "#34d399",
    },
    {
      icon: <Layers style={{ width: 22, height: 22, color: "#a78bfa" }} />,
      title: "End-to-End Workflow",
      desc: "From DXF profile import to physical roll tooling — one unified platform handles the complete engineering chain.",
      accent: "#a78bfa",
    },
    {
      icon: <FileCode2 style={{ width: 22, height: 22, color: "#f97316" }} />,
      title: "Delta 2X G-Code Output",
      desc: "Production-ready .TAP G-code with pre-flight safety check — spindle limits, collision detection, tool validation.",
      accent: "#f97316",
    },
    {
      icon: <Wrench style={{ width: 22, height: 22, color: "#ec4899" }} />,
      title: "Knowledge Engine Built-in",
      desc: "10-material database with yield strength, K-factor tables, Euler buckling spacing, and surface finish models.",
      accent: "#ec4899",
    },
  ];

  return (
    <section style={{ position: "relative", zIndex: 10, padding: "0 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <Layer delay={0} style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 16px", borderRadius: 999, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase",
          background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa",
          marginBottom: 16,
        }}>
          <Star style={{ width: 12, height: 12 }} />
          Why SAI Rolotech?
        </div>
        <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
          Built for Serious{" "}
          <span style={{
            background: "linear-gradient(135deg,#60a5fa,#06b6d4)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            Roll Forming Engineers
          </span>
        </h2>
      </Layer>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}
        className="sai-features-grid">
        {items.map((item, i) => (
          <Layer key={i} delay={i * 60}>
            <div
              className="sai-feature-card"
              style={{
                padding: 28, borderRadius: 20, height: "100%",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.045)";
                el.style.borderColor = `${item.accent}44`;
                el.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(255,255,255,0.025)";
                el.style.borderColor = "rgba(255,255,255,0.07)";
                el.style.transform = "";
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, marginBottom: 16,
                background: `${item.accent}18`, border: `1px solid ${item.accent}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {item.icon}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: "#71717a", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          </Layer>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────── Comparison Section ─────────────────── */
function Comparison() {
  const rows = [
    { feature: "DXF Profile Import", us: true, them: true },
    { feature: "Power Pattern Generation", us: true, them: true },
    { feature: "Delta 2X G-Code Output", us: true, them: false },
    { feature: "G-Code Pre-Flight Safety Check", us: true, them: false },
    { feature: "8+ Tool Preset Library", us: true, them: false },
    { feature: "Manufacturing Feasibility Report", us: true, them: false },
    { feature: "Offline Operation (7/7 Modules)", us: true, them: false },
    { feature: "Smart Profile Validation", us: true, them: false },
    { feature: "Built-in Knowledge Engine", us: true, them: false },
    { feature: "AI Springback Prediction", us: true, them: false },
  ];

  return (
    <section style={{ position: "relative", zIndex: 10, padding: "0 40px 80px", maxWidth: 900, margin: "0 auto" }}>
      <Layer delay={0} style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 16px", borderRadius: 999, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase",
          background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399",
          marginBottom: 16,
        }}>
          <BarChart3 style={{ width: 12, height: 12 }} />
          Comparison
        </div>
        <h2 style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em" }}>
          SAI vs{" "}
          <span style={{ color: "#3f3f46" }}>Others</span>
        </h2>
      </Layer>

      <Layer delay={80}>
        <div style={{
          borderRadius: 20, overflow: "hidden",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto",
            borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
            <div style={{ padding: "14px 24px", fontSize: 12, fontWeight: 700, color: "#52525b" }}>Feature</div>
            <div style={{ padding: "14px 32px", fontSize: 12, fontWeight: 700, color: "#f59e0b", textAlign: "center", minWidth: 160 }}>SAI Rolotech</div>
            <div style={{ padding: "14px 32px", fontSize: 12, fontWeight: 700, color: "#3f3f46", textAlign: "center", minWidth: 120 }}>Others</div>
          </div>
          {rows.map((row, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr auto auto",
              borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              transition: "background 0.2s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              <div style={{ padding: "11px 24px", fontSize: 13, color: "#d4d4d8" }}>{row.feature}</div>
              <div style={{ padding: "11px 32px", textAlign: "center", minWidth: 160 }}>
                {row.us
                  ? <CheckCircle2 style={{ width: 18, height: 18, color: "#34d399", display: "inline" }} />
                  : <span style={{ color: "#3f3f46" }}>—</span>}
              </div>
              <div style={{ padding: "11px 32px", textAlign: "center", minWidth: 120 }}>
                {row.them
                  ? <CheckCircle2 style={{ width: 18, height: 18, color: "#52525b", display: "inline" }} />
                  : <span style={{ color: "#3f3f46" }}>—</span>}
              </div>
            </div>
          ))}
        </div>
      </Layer>
    </section>
  );
}

/* ─────────────────── CTA Banner ─────────────────────────── */
function CTABanner({ onGetStarted, onPreload }: { onGetStarted: () => void; onPreload: () => void }) {
  return (
    <section style={{ position: "relative", zIndex: 10, padding: "0 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <Layer delay={0}>
        <div style={{
          padding: "56px 48px", borderRadius: 28,
          background: "linear-gradient(135deg,rgba(245,158,11,0.10) 0%,rgba(6,182,212,0.08) 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(24px)",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
            width: 400, height: 200, borderRadius: "50%",
            background: "radial-gradient(ellipse,rgba(245,158,11,0.12),transparent)",
            filter: "blur(40px)", pointerEvents: "none" }} />

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 16px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#f59e0b",
            marginBottom: 20,
          }}>
            <Sparkles style={{ width: 12, height: 12 }} />
            Get Started Today
          </div>

          <h2 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900, color: "#fff",
            margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            Ready to Transform Your Production?
          </h2>

          <p style={{ fontSize: 15, color: "#71717a", maxWidth: 520, margin: "0 0 36px", lineHeight: 1.6 }}>
            Whether you need a machine or the software — SAI Rolotech delivers
            engineering excellence at every step of the roll forming process.
          </p>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <a href="https://www.sairolotech.com" target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "13px 28px", borderRadius: 12, fontWeight: 700, fontSize: 14,
                background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff",
                textDecoration: "none", boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              <Factory style={{ width: 16, height: 16 }} />
              Explore Machines
            </a>
            <button onClick={() => { onPreload(); onGetStarted(); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "13px 28px", borderRadius: 12, fontWeight: 700, fontSize: 14,
                background: "linear-gradient(135deg,#06b6d4,#0284c7)", color: "#fff",
                border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(6,182,212,0.35)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
            >
              <Monitor style={{ width: 16, height: 16 }} />
              Enter Design Software
              <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      </Layer>
    </section>
  );
}

/* ─────────────────── Footer ─────────────────────────────── */
function Footer({ appVersion }: { appVersion: string }) {
  return (
    <footer style={{
      position: "relative", zIndex: 10,
      padding: "24px 40px",
      background: "rgba(4,6,14,0.5)", backdropFilter: "blur(32px)",
      borderTop: "1px solid rgba(255,255,255,0.07)",
      display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8,
          background: "linear-gradient(135deg,#f59e0b,#d97706)",
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Cog style={{ width: 15, height: 15, color: "#fff" }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#52525b" }}>SAI Rolotech Smart Engines</span>
      </div>
      <div style={{ fontSize: 11, color: "#3f3f46", display: "flex", alignItems: "center", gap: 16 }}>
        <span>{appVersion} · 500+ Profiles · Delta 2X Verified</span>
        <a href="https://www.sairolotech.com" target="_blank" rel="noopener noreferrer"
          style={{ color: "#f59e0b", textDecoration: "none", fontWeight: 600 }}>
          sairolotech.com
        </a>
      </div>
    </footer>
  );
}

/* ─────────────────── Responsive styles injected ─────────── */
const RESPONSIVE_CSS = `
@media (max-width: 768px) {
  .sai-choice-grid { grid-template-columns: 1fr !important; }
  .sai-features-grid { grid-template-columns: 1fr !important; }
}
@media (max-width: 640px) {
  .sai-features-grid { grid-template-columns: 1fr !important; }
}
`;

/* ─────────────────── Main Export ────────────────────────── */
interface Props {
  onGetStarted: () => void;
  onPreload: () => void;
}

export function LandingPage({ onGetStarted, onPreload }: Props) {
  const appVersion = useAppVersion();

  useEffect(() => {
    const styleId = "sai-landing-styles";
    if (!document.getElementById(styleId)) {
      const el = document.createElement("style");
      el.id = styleId;
      el.textContent = ANIM_CSS + RESPONSIVE_CSS;
      document.head.appendChild(el);
    }
  }, []);

  return (
    <div style={{
      minHeight: "100vh", color: "#fff", overflowX: "hidden",
      background: "linear-gradient(160deg,#04060e 0%,#080b18 35%,#060717 65%,#04060e 100%)",
    }}>
      <BackgroundMesh />
      <Nav appVersion={appVersion} />
      <Hero onGetStarted={onGetStarted} onPreload={onPreload} />
      <WhySAI />
      <Comparison />
      <CTABanner onGetStarted={onGetStarted} onPreload={onPreload} />
      <Footer appVersion={appVersion} />
    </div>
  );
}

export default LandingPage;
