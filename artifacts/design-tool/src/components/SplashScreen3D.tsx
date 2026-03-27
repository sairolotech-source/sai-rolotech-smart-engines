import { useState, useEffect, useRef } from "react";
import { onDownloadProgress, initSWDownloadManager } from "@/lib/sw-download-manager";

interface SplashScreen3DProps {
  onComplete: () => void;
  minDuration?: number;
}

// ─── Welcome to SAI Rolotech Family — full-screen, CSS only, zero Three.js ────
export function SplashScreen3D({ onComplete, minDuration = 1200 }: SplashScreen3DProps) {
  const [progress, setProgress]     = useState(0);
  const [swFile, setSwFile]         = useState("");
  const [swDone, setSwDone]         = useState(0);
  const [swTotal, setSwTotal]       = useState(0);
  const [phase, setPhase]           = useState<"welcome"|"loading"|"done">("welcome");
  const [visible, setVisible]       = useState(true);
  const doneRef                     = useRef(false);

  // ── Timer: always completes in max 1.6s — SW progress cannot block this ─────
  useEffect(() => {
    // Prefetch next screens in background
    const prefetch = setTimeout(() => {
      [
        () => import("@/components/auth/LicenseKeyScreen"),
        () => import("@/pages/Home"),
        () => import("@/pages/Dashboard"),
      ].forEach(fn => { try { fn().catch(() => {}); } catch {} });
    }, 400);

    // Welcome phase → loading phase after 700ms
    const welcomeTimer = setTimeout(() => setPhase("loading"), 700);

    // Smooth progress from 0→100 over minDuration
    const cap = Math.min(minDuration, 1400);
    const start = Date.now();

    // setInterval works even in background tabs — unlike requestAnimationFrame
    const iv = setInterval(() => {
      const p = Math.min((Date.now() - start) / cap, 1);
      setProgress(Math.round(p * 100));
      if (p >= 1 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(iv);
        setPhase("done");
        setVisible(false);
        setTimeout(onComplete, 500);
      }
    }, 30);

    return () => {
      clearTimeout(prefetch);
      clearTimeout(welcomeTimer);
      clearInterval(iv);
    };
  }, [onComplete, minDuration]);

  // ── SW progress: background info only, never blocks completion ───────────────
  useEffect(() => {
    initSWDownloadManager();
    const unsub = onDownloadProgress((p) => {
      if (p.phase === "idle") return;
      if (p.currentFile) setSwFile(p.currentFile);
      if (p.done > 0)    setSwDone(p.done);
      if (p.total > 0)   setSwTotal(p.total);
    });
    return unsub;
  }, []);

  const isReady = progress >= 98;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 38%, #0c1322 0%, #040709 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.6s ease",
      pointerEvents: visible ? "auto" : "none",
      overflow: "hidden",
    }}>

      {/* Background glow circles */}
      <div style={{
        position: "absolute", width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        animation: "sai-bgpulse 3s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Animated rings */}
      <div style={{ position: "relative", width: 160, height: 160, marginBottom: 36 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            position: "absolute",
            inset: i * 16,
            borderRadius: "50%",
            border: `${Math.max(1, 2 - i * 0.4)}px solid rgba(245,158,11,${0.9 - i * 0.2})`,
            animation: `sai-spin-${i % 2 === 0 ? "cw" : "ccw"} ${1.6 + i * 0.8}s linear infinite`,
          }} />
        ))}
        {/* Core */}
        <div style={{
          position: "absolute", inset: 52, borderRadius: "50%",
          background: "radial-gradient(circle, #fbbf24 0%, #f59e0b 45%, #b45309 100%)",
          boxShadow: "0 0 40px 12px rgba(245,158,11,0.6), 0 0 80px 24px rgba(249,115,22,0.3)",
          animation: "sai-pulse 2s ease-in-out infinite",
        }} />
      </div>

      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          fontSize: "clamp(2rem,5.5vw,3.4rem)",
          fontWeight: 900, letterSpacing: "0.18em",
          background: "linear-gradient(135deg,#fbbf24 0%,#f59e0b 38%,#d97706 68%,#fff 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          fontFamily: "'Inter',system-ui,sans-serif",
          filter: "drop-shadow(0 0 28px rgba(245,158,11,0.8))",
          lineHeight: 1.05,
          animation: "sai-brand-in 0.8s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          SAI ROLOTECH
        </div>
        <div style={{
          fontSize: "clamp(0.7rem,2vw,0.95rem)", fontWeight: 700,
          letterSpacing: "0.34em", color: "rgba(255,255,255,0.85)",
          marginTop: 6, fontFamily: "'Inter',system-ui,sans-serif",
          animation: "sai-brand-in 0.8s 0.15s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          SMART ENGINES
        </div>
        <div style={{
          fontSize: "0.56rem", color: "rgba(156,163,175,0.5)",
          marginTop: 8, letterSpacing: "0.22em", fontFamily: "monospace",
          animation: "sai-brand-in 0.8s 0.3s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          PRECISION ROLL FORMING SUITE · v2.2.20
        </div>
      </div>

      {/* ── WELCOME MESSAGE (phase = welcome | loading) ── */}
      <div style={{
        textAlign: "center", marginBottom: 32,
        opacity: phase === "done" ? 0 : 1,
        transition: "opacity 0.5s ease",
        animation: "sai-welcome-in 0.7s 0.4s cubic-bezier(0.22,1,0.36,1) both",
      }}>
        <div style={{
          fontSize: "clamp(1rem,3vw,1.35rem)",
          fontWeight: 600, letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.92)",
          fontFamily: "'Inter',system-ui,sans-serif",
          lineHeight: 1.5,
        }}>
          Welcome to <span style={{
            background: "linear-gradient(90deg,#fbbf24,#f97316)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontWeight: 800,
          }}>SAI Rolotech</span> Family
        </div>
        <div style={{
          fontSize: "0.75rem", color: "rgba(156,163,175,0.6)",
          marginTop: 6, letterSpacing: "0.12em",
          fontFamily: "monospace",
        }}>
          {phase === "welcome"
            ? "Aapka swagat hai · Preparing your workspace..."
            : swFile
              ? `↓ ${swFile}${swTotal > 0 ? `  (${swDone}/${swTotal})` : ""}`
              : "Loading modules in background..."}
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div style={{ width: "min(380px, 82vw)" }}>
        {/* Bar */}
        <div style={{
          width: "100%", height: 4, borderRadius: 4,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.04)",
          overflow: "hidden",
          animation: "sai-brand-in 0.8s 0.5s cubic-bezier(0.22,1,0.36,1) both",
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: isReady
              ? "linear-gradient(90deg,#22c55e,#4ade80)"
              : "linear-gradient(90deg,#f59e0b,#f97316,#fbbf24)",
            borderRadius: 4,
            transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: `0 0 14px 3px ${isReady ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.5)"}`,
          }} />
        </div>

        {/* Percent + status */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 8, alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {["Roll Design","CNC/CAM","AI Engine","3D Studio","Hardware"].map((m, i) => {
              const on = progress >= (i + 1) * 18;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: on ? "#f59e0b" : "rgba(255,255,255,0.08)",
                    boxShadow: on ? "0 0 6px 2px rgba(245,158,11,0.6)" : "none",
                    transition: "all 0.4s ease",
                  }} />
                  <span style={{
                    fontSize: "6px", fontFamily: "monospace",
                    color: on ? "rgba(245,158,11,0.65)" : "rgba(255,255,255,0.18)",
                    letterSpacing: "0.02em",
                  }}>{m}</span>
                </div>
              );
            })}
          </div>
          <span style={{
            fontFamily: "monospace", fontSize: "10px", fontWeight: 700,
            color: isReady ? "#22c55e" : "rgba(245,158,11,0.9)",
            minWidth: 36, textAlign: "right",
          }}>
            {progress}%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes sai-spin-cw  { to { transform: rotate(360deg);  } }
        @keyframes sai-spin-ccw { to { transform: rotate(-360deg); } }
        @keyframes sai-pulse {
          0%,100% { box-shadow:0 0 40px 12px rgba(245,158,11,.6),0 0 80px 24px rgba(249,115,22,.3); }
          50%      { box-shadow:0 0 56px 18px rgba(245,158,11,.8),0 0 100px 32px rgba(249,115,22,.5); }
        }
        @keyframes sai-bgpulse {
          0%,100% { opacity:0.6; transform:translate(-50%,-50%) scale(1); }
          50%      { opacity:1;   transform:translate(-50%,-50%) scale(1.15); }
        }
        @keyframes sai-brand-in {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes sai-welcome-in {
          from { opacity:0; transform:translateY(12px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
