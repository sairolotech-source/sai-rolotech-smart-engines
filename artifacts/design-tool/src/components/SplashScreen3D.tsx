import { useState, useEffect } from "react";
import { onDownloadProgress, initSWDownloadManager } from "@/lib/sw-download-manager";

interface SplashScreen3DProps {
  onComplete: () => void;
  minDuration?: number;
}

// ─── Progress Bar UI ──────────────────────────────────────────────────────────
function SplashProgress({ progress, swKb, swFile }: {
  progress: number; swKb: number; swFile: string;
}) {
  const isReady = progress >= 95;
  const modules = [
    { label: "Roll Design", pct: 25 },
    { label: "CNC/CAM",    pct: 40 },
    { label: "Offline AI", pct: 65 },
    { label: "3D Engine",  pct: 80 },
    { label: "Hardware",   pct: 55 },
  ];
  return (
    <div style={{ width: "min(400px, 84vw)", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{
          fontFamily: "monospace", fontSize: "9px",
          color: "rgba(156,163,175,0.6)", letterSpacing: "0.08em",
          maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {swFile
            ? `↓ ${swFile}`
            : isReady
              ? "All modules cached ✓"
              : "Initializing systems..."}
        </span>
        <span style={{
          fontFamily: "monospace", fontSize: "9px", fontWeight: 700,
          color: isReady ? "#22c55e" : "rgba(245,158,11,0.9)",
        }}>
          {swKb > 0 ? `${swKb} KB  ` : ""}{progress}%
        </span>
      </div>

      <div style={{
        width: "100%", height: 3, borderRadius: 3,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: isReady
            ? "linear-gradient(90deg,#22c55e,#4ade80)"
            : "linear-gradient(90deg,#f59e0b,#f97316,#fbbf24)",
          borderRadius: 3,
          transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: `0 0 12px 2px ${isReady ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.5)"}`,
        }} />
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
        {modules.map((m, i) => {
          const on = progress >= m.pct;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: on ? "#f59e0b" : "rgba(255,255,255,0.1)",
                boxShadow: on ? "0 0 6px 2px rgba(245,158,11,0.6)" : "none",
                transition: "all 0.4s ease",
              }} />
              <span style={{
                fontSize: "7px", fontFamily: "monospace",
                color: on ? "rgba(245,158,11,0.7)" : "rgba(255,255,255,0.2)",
                letterSpacing: "0.03em", transition: "color 0.4s ease",
              }}>{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Splash — pure CSS, no Three.js, instant render ─────────────────────
export function SplashScreen3D({ onComplete, minDuration = 1200 }: SplashScreen3DProps) {
  const [progress, setProgress] = useState(5);
  const [swKb, setSwKb]         = useState(0);
  const [swFile, setSwFile]     = useState("");
  const [visible, setVisible]   = useState(true);

  // Service Worker real progress
  useEffect(() => {
    initSWDownloadManager();
    const unsub = onDownloadProgress((p) => {
      if (p.phase === "idle") return;
      if (p.progress > 0) setProgress(prev => Math.max(prev, Math.min(95, p.progress)));
      if (p.kb > 0) setSwKb(p.kb);
      if (p.currentFile) setSwFile(p.currentFile);
      if (p.phase === "complete") { setProgress(100); setSwFile(""); }
    });
    return unsub;
  }, []);

  // Splash timer — runs regardless of SW progress
  useEffect(() => {
    // Prefetch next screens in background while splash is showing
    const t = setTimeout(() => {
      [
        () => import("@/components/auth/LicenseKeyScreen"),
        () => import("@/pages/Home"),
        () => import("@/pages/Dashboard"),
      ].forEach(fn => { try { fn().catch(() => {}); } catch {} });
    }, 300);

    const cap = Math.min(minDuration, 1200);
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(elapsed / cap, 1);
      setProgress(prev => Math.max(prev, Math.round(5 + p * 90)));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVisible(false);
        setTimeout(onComplete, 400);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [onComplete, minDuration]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 38%, #0d1428 0%, #050810 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0,
      transition: "opacity 0.5s ease",
      pointerEvents: visible ? "auto" : "none",
    }}>

      {/* Animated CSS Rings — no GPU, no Three.js */}
      <div style={{ position: "relative", width: 170, height: 170, marginBottom: 44 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            position: "absolute",
            inset: i * 18,
            borderRadius: "50%",
            border: `${2 - i * 0.3}px solid rgba(245,158,11,${0.85 - i * 0.18})`,
            animation: `sai-spin-${i % 2 === 0 ? "cw" : "ccw"} ${1.8 + i * 0.7}s linear infinite`,
          }} />
        ))}
        {/* Center glow core */}
        <div style={{
          position: "absolute", inset: 58, borderRadius: "50%",
          background: "radial-gradient(circle, #fbbf24 0%, #f59e0b 40%, #d97706 70%, #7c3a00 100%)",
          boxShadow: "0 0 32px 10px rgba(245,158,11,0.55), 0 0 60px 20px rgba(249,115,22,0.25)",
          animation: "sai-pulse 2.2s ease-in-out infinite",
        }} />
      </div>

      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{
          fontSize: "clamp(1.8rem,5.5vw,3.2rem)", fontWeight: 900, letterSpacing: "0.18em",
          background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #d97706 72%, #ffffff 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          fontFamily: "'Inter', system-ui, sans-serif",
          filter: "drop-shadow(0 0 24px rgba(245,158,11,0.75))",
          lineHeight: 1.1,
        }}>
          SAI ROLOTECH
        </div>
        <div style={{
          fontSize: "clamp(0.75rem,2vw,1rem)", fontWeight: 700, letterSpacing: "0.34em",
          color: "rgba(255,255,255,0.87)", marginTop: 7,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          SMART ENGINES
        </div>
        <div style={{
          fontSize: "0.57rem", color: "rgba(156,163,175,0.55)", marginTop: 9,
          letterSpacing: "0.22em", fontFamily: "monospace",
        }}>
          PRECISION ROLL FORMING SUITE · v2.2.20
        </div>
      </div>

      {/* Progress */}
      <SplashProgress progress={progress} swKb={swKb} swFile={swFile} />

      <style>{`
        @keyframes sai-spin-cw  { to { transform: rotate(360deg);  } }
        @keyframes sai-spin-ccw { to { transform: rotate(-360deg); } }
        @keyframes sai-pulse {
          0%,100% { box-shadow: 0 0 32px 10px rgba(245,158,11,.55), 0 0 60px 20px rgba(249,115,22,.25); }
          50%      { box-shadow: 0 0 48px 16px rgba(245,158,11,.75), 0 0 80px 28px rgba(249,115,22,.4);  }
        }
      `}</style>
    </div>
  );
}
