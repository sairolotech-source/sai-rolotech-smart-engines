import { useState, useEffect, useRef, useMemo } from "react";
import { onDownloadProgress, initSWDownloadManager } from "@/lib/sw-download-manager";
import { useAppVersion } from "@/lib/appVersion";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

function DeepStarField() {
  const layers = useMemo(() => {
    const createLayer = (count: number, minSize: number, maxSize: number, speed: number, colors: string[]) =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (i * 137.508 + Math.sin(i * 0.7) * 30 + 50) % 100,
        y: (i * 97.31 + Math.cos(i * 0.9) * 25 + 50) % 100,
        size: minSize + (i % 7) * ((maxSize - minSize) / 7),
        color: colors[i % colors.length],
        opacity: 0.3 + (i % 5) * 0.14,
        twinkleDur: 1.5 + (i % 8) * 0.6,
        twinkleDelay: (i * 0.13) % 6,
        speed,
      }));

    return [
      createLayer(180, 0.3, 0.8, 0.3, ["#ffffff", "#cce5ff", "#ffe4cc"]),
      createLayer(60, 0.8, 1.6, 0.6, ["#ffd700", "#87ceeb", "#ff9966", "#ffffff"]),
      createLayer(15, 1.8, 3.0, 1.0, ["#ffd700", "#ff6b6b", "#87ceeb", "#c084fc"]),
    ];
  }, []);

  return (
    <>
      {layers.map((layer, li) => (
        <svg key={li} className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          {li === 2 && (
            <defs>
              <filter id="starGlow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          )}
          {layer.map(s => (
            <circle
              key={s.id}
              cx={`${s.x}%`}
              cy={`${s.y}%`}
              r={s.size}
              fill={s.color}
              opacity={s.opacity}
              filter={li === 2 ? "url(#starGlow)" : undefined}
            >
              <animate
                attributeName="opacity"
                values={`${s.opacity};${s.opacity * 0.1};${s.opacity}`}
                dur={`${s.twinkleDur}s`}
                begin={`${s.twinkleDelay}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
        </svg>
      ))}
    </>
  );
}

function Planet({ size, x, y, color1, color2, ringColor, hasRing, delay, shadowAngle }: {
  size: number; x: string; y: string;
  color1: string; color2: string;
  ringColor?: string; hasRing?: boolean;
  delay: number; shadowAngle?: number;
}) {
  const angle = shadowAngle ?? 135;
  return (
    <div
      className="absolute"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        animation: `planetFloat 12s ease-in-out ${delay}s infinite, planetReveal 1.5s ease-out ${delay * 0.5}s both`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at ${30 + Math.cos(angle * Math.PI / 180) * 20}% ${30 + Math.sin(angle * Math.PI / 180) * 20}%, ${color1} 0%, ${color2} 60%, rgba(0,0,0,0.9) 100%)`,
          boxShadow: `inset -${size * 0.15}px -${size * 0.1}px ${size * 0.3}px rgba(0,0,0,0.8), 0 0 ${size * 0.4}px ${size * 0.08}px ${color1}33`,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: "35%",
          height: "20%",
          top: "15%",
          left: "20%",
          background: `radial-gradient(ellipse, rgba(255,255,255,0.25) 0%, transparent 70%)`,
          transform: "rotate(-20deg)",
          filter: "blur(2px)",
        }}
      />
      {hasRing && (
        <div
          className="absolute"
          style={{
            width: size * 1.8,
            height: size * 0.45,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%) rotateX(72deg)",
            borderRadius: "50%",
            border: `2px solid ${ringColor || "rgba(200,180,150,0.4)"}`,
            boxShadow: `0 0 ${size * 0.15}px ${ringColor || "rgba(200,180,150,0.2)"}`,
            background: `radial-gradient(ellipse, transparent 45%, ${ringColor || "rgba(200,180,150,0.12)"} 50%, ${ringColor || "rgba(200,180,150,0.06)"} 60%, transparent 65%)`,
          }}
        />
      )}
    </div>
  );
}

function ShootingStar({ delay }: { delay: number }) {
  const angle = -30 + Math.random() * 20;
  const startX = 10 + Math.random() * 60;
  return (
    <div
      className="absolute"
      style={{
        left: `${startX}%`,
        top: "-5%",
        width: 120,
        height: 1.5,
        background: "linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 40%, transparent 100%)",
        transform: `rotate(${angle}deg)`,
        opacity: 0,
        animation: `shootingStar 1.2s ease-out ${delay}s forwards`,
        filter: "blur(0.3px)",
        boxShadow: "0 0 6px 1px rgba(255,255,255,0.4)",
      }}
    />
  );
}

function Nebula() {
  return (
    <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
      <div className="absolute" style={{
        width: "60%", height: "60%", top: "10%", left: "-10%",
        background: "radial-gradient(ellipse, rgba(109,40,217,0.12) 0%, rgba(109,40,217,0.04) 40%, transparent 70%)",
        filter: "blur(60px)",
        animation: "nebulaShift 20s ease-in-out infinite",
      }} />
      <div className="absolute" style={{
        width: "50%", height: "50%", bottom: "5%", right: "-5%",
        background: "radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0.03) 40%, transparent 70%)",
        filter: "blur(50px)",
        animation: "nebulaShift 18s ease-in-out 3s infinite reverse",
      }} />
      <div className="absolute" style={{
        width: "40%", height: "40%", top: "30%", right: "20%",
        background: "radial-gradient(ellipse, rgba(245,158,11,0.06) 0%, transparent 60%)",
        filter: "blur(40px)",
        animation: "nebulaShift 15s ease-in-out 6s infinite",
      }} />
    </div>
  );
}

function WarpLines({ active }: { active: boolean }) {
  if (!active) return null;
  const lines = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: 10 + (i * 3.1) % 80,
    y: 10 + (i * 7.3) % 80,
    len: 20 + (i % 5) * 15,
    angle: Math.atan2(((i * 7.3) % 80) - 50, ((i * 3.1) % 80) - 50) * (180 / Math.PI),
    delay: i * 0.05,
    opacity: 0.15 + (i % 4) * 0.08,
  }));

  return (
    <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
      {lines.map(l => (
        <div
          key={l.id}
          className="absolute"
          style={{
            left: `${l.x}%`,
            top: `${l.y}%`,
            width: l.len,
            height: 1,
            background: `linear-gradient(90deg, transparent 0%, rgba(200,220,255,${l.opacity}) 50%, transparent 100%)`,
            transform: `rotate(${l.angle}deg)`,
            animation: `warpStretch 0.8s ease-out ${l.delay}s both`,
          }}
        />
      ))}
    </div>
  );
}

export function SplashScreen({ onComplete, minDuration = 5500 }: SplashScreenProps) {
  const appVersion = useAppVersion();
  const [phase, setPhase] = useState<"init" | "space" | "planets" | "brand" | "loading" | "warp" | "fadeout">("init");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Entering orbit...");
  const [videoError, setVideoError] = useState(false);
  const [shootingStars, setShootingStars] = useState<number[]>([]);
  const [swKb, setSwKb] = useState(0);
  const [swFile, setSwFile] = useState("");
  const [swActive, setSwActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const swDoneRef = useRef(false);

  useEffect(() => {
    // --- Visual phase timeline (always runs) ---
    const steps = [
      { at: 300,  phase: "space"    as const, text: "Entering orbit...",                           progress: 0  },
      { at: 1000, phase: "planets"  as const, text: "Scanning galaxy systems...",                  progress: 8  },
      { at: 1800, phase: "brand"    as const, text: "Locking navigation coordinates...",           progress: 15 },
      { at: 2500, phase: "loading"  as const, text: "Detecting CPU & GPU cores...",                progress: 25 },
      { at: 3000, phase: "loading"  as const, text: "Initializing quantum worker pool...",         progress: 40 },
      { at: 3400, phase: "loading"  as const, text: "Loading material database (33 alloys)...",    progress: 55 },
      { at: 3800, phase: "loading"  as const, text: "Calibrating AI neural engine...",             progress: 70 },
      { at: 4200, phase: "loading"  as const, text: "Loading roll forming modules...",             progress: 85 },
      { at: 4600, phase: "warp"     as const, text: "All systems online — launching...",           progress: 100 },
      { at: 5200, phase: "fadeout"  as const, text: "",                                            progress: 100 },
    ];

    const timers = steps.map(s =>
      setTimeout(() => {
        setPhase(s.phase);
        if (s.text) setStatusText(s.text);
        // Only set fake progress if SW hasn't taken over
        if (!swDoneRef.current) setProgress(s.progress);
      }, s.at)
    );

    const starTimers = [1500, 2800, 4000].map((t, i) =>
      setTimeout(() => setShootingStars(prev => [...prev, i]), t)
    );

    const completeTimer = setTimeout(onComplete, minDuration);

    // --- Real SW download progress ---
    initSWDownloadManager();
    const unsub = onDownloadProgress((p) => {
      if (p.phase === "idle") return;

      setSwActive(true);
      swDoneRef.current = p.phase === "complete";

      if (p.progress > 0) {
        // Map SW progress (0-100) to loading phase range (25-95)
        const mapped = 25 + Math.round(p.progress * 0.7);
        setProgress(Math.max(progress, mapped));
      }
      if (p.kb > 0) setSwKb(p.kb);
      if (p.currentFile) setSwFile(p.currentFile);

      if (p.phase === "downloading" && p.currentFile) {
        setStatusText(`Downloading ${p.currentFile}…`);
      } else if (p.phase === "complete") {
        setStatusText(`All modules loaded — ${p.kb} KB cached`);
      }
    });

    return () => {
      timers.forEach(clearTimeout);
      starTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
      unsub();
    };
  }, [onComplete, minDuration]);

  const showPlanets = ["planets", "brand", "loading", "warp", "fadeout"].includes(phase);
  const showBrand = ["brand", "loading", "warp", "fadeout"].includes(phase);
  const showLoader = ["loading", "warp", "fadeout"].includes(phase);
  const isWarp = phase === "warp" || phase === "fadeout";
  const isReady = isWarp;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-all duration-700 ${phase === "fadeout" ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"}`}
      style={{ background: "#010005" }}
    >
      <style>{`
        @keyframes planetFloat {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50%      { transform: translate(-50%, -50%) translateY(-12px); }
        }
        @keyframes planetReveal {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); filter: blur(10px); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: blur(0); }
        }
        @keyframes nebulaShift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(3%, -2%) scale(1.05); }
          66%      { transform: translate(-2%, 3%) scale(0.97); }
        }
        @keyframes shootingStar {
          0%   { opacity: 0; transform: rotate(var(--angle, -25deg)) translateX(0); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--angle, -25deg)) translateX(300px); }
        }
        @keyframes cosmicReveal {
          0%   { opacity: 0; transform: scale(0.5) translateY(30px); filter: blur(25px); }
          60%  { filter: blur(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        @keyframes wordSlide {
          0%   { opacity: 0; transform: translateY(24px) skewY(4deg); filter: blur(6px); }
          100% { opacity: 1; transform: translateY(0) skewY(0deg); filter: blur(0); }
        }
        @keyframes tagFade {
          0%   { opacity: 0; letter-spacing: 0.5em; }
          100% { opacity: 1; letter-spacing: 0.25em; }
        }
        @keyframes warpStretch {
          0%   { opacity: 0; transform: rotate(var(--angle, 0deg)) scaleX(0); }
          50%  { opacity: 1; }
          100% { opacity: 0; transform: rotate(var(--angle, 0deg)) scaleX(3) translateX(80px); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(245,158,11,0.15), 0 0 80px 20px rgba(109,40,217,0.1); }
          50%      { box-shadow: 0 0 70px 25px rgba(245,158,11,0.3), 0 0 120px 40px rgba(109,40,217,0.2); }
        }
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 8px 2px rgba(245,158,11,0.4); }
          50%      { box-shadow: 0 0 16px 6px rgba(245,158,11,0.7); }
        }
        @keyframes scanLine {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
        @keyframes starPop {
          0%   { opacity: 0; transform: scale(0); }
          70%  { opacity: 1; transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes lensFlare {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          30%  { opacity: 0.6; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(2.5); }
        }
        @keyframes atmosphereGlow {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.7; }
        }
      `}</style>

      {!videoError && (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.45, mixBlendMode: "screen", filter: "saturate(1.3) contrast(1.1)" }}
          src="/galaxy_splash_bg.mp4"
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoError(true)}
        />
      )}

      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 50%, rgba(8,3,20,0.3) 0%, rgba(2,0,8,0.7) 50%, rgba(1,0,5,0.95) 100%)"
      }} />

      <DeepStarField />
      <Nebula />

      {shootingStars.map(i => (
        <ShootingStar key={i} delay={0} />
      ))}

      {showPlanets && (
        <>
          <Planet
            size={180}
            x="85%"
            y="25%"
            color1="#c2956a"
            color2="#5c3d2e"
            hasRing
            ringColor="rgba(210,185,140,0.35)"
            delay={0.2}
            shadowAngle={150}
          />
          <Planet
            size={60}
            x="12%"
            y="70%"
            color1="#6b8cce"
            color2="#1a2a4a"
            delay={0.5}
            shadowAngle={120}
          />
          <Planet
            size={35}
            x="25%"
            y="20%"
            color1="#e87461"
            color2="#5c1a12"
            delay={0.8}
            shadowAngle={140}
          />
          <Planet
            size={90}
            x="8%"
            y="35%"
            color1="#8fc3a8"
            color2="#1a3a2a"
            hasRing
            ringColor="rgba(140,200,170,0.2)"
            delay={0.4}
            shadowAngle={160}
          />
          <Planet
            size={22}
            x="70%"
            y="78%"
            color1="#ddd5c4"
            color2="#4a4438"
            delay={1.0}
            shadowAngle={130}
          />
          <Planet
            size={110}
            x="92%"
            y="72%"
            color1="#d4956b"
            color2="#7a3a1a"
            delay={0.6}
            shadowAngle={145}
          />

          <div className="absolute" style={{
            width: 6,
            height: 6,
            left: "85%",
            top: "25%",
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            opacity: 0,
            background: "radial-gradient(circle, rgba(255,255,255,0.9), rgba(200,220,255,0.3), transparent)",
            animation: "lensFlare 3s ease-out 1.2s forwards",
            filter: "blur(1px)",
          }} />
        </>
      )}

      <WarpLines active={isWarp} />

      {showBrand && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            width: 500,
            height: 500,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -55%)",
            background: "radial-gradient(circle, rgba(245,158,11,0.06) 0%, rgba(109,40,217,0.04) 30%, transparent 60%)",
            animation: "glowPulse 3s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-7 px-8" style={{ marginTop: "-20px" }}>
        {showBrand && (
          <div
            className="flex flex-col items-center gap-5"
            style={{ animation: "cosmicReveal 1.2s cubic-bezier(0.16,1,0.3,1) forwards" }}
          >
            <div
              className="relative flex items-center justify-center"
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                background: "linear-gradient(135deg, #0a0514 0%, #1a0a2e 50%, #0a0514 100%)",
                border: "1.5px solid rgba(245,158,11,0.45)",
                boxShadow: "0 0 40px 12px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div className="absolute inset-0 overflow-hidden rounded-[26px] pointer-events-none" style={{ opacity: 0.2 }}>
                <div style={{
                  position: "absolute", width: "100%", height: "30%",
                  background: "linear-gradient(180deg, transparent, rgba(245,158,11,0.3), transparent)",
                  animation: "scanLine 2.5s ease-in-out infinite",
                }} />
              </div>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="gearGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                </defs>
                <circle cx="12" cy="12" r="3" stroke="url(#gearGrad)" strokeWidth="2" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="url(#gearGrad)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {[
                { top: 6, left: 6 }, { top: 6, right: 6 },
                { bottom: 6, left: 6 }, { bottom: 6, right: 6 },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-amber-500"
                  style={{ ...pos, opacity: 0.5, animation: `starPop 0.4s ease-out ${i * 80 + 400}ms both` }}
                />
              ))}
            </div>

            <div className="text-center flex flex-col items-center gap-2">
              <div className="overflow-hidden">
                <h1
                  className="font-black tracking-tight"
                  style={{
                    fontSize: "clamp(2rem, 5.5vw, 3.2rem)",
                    color: "white",
                    animation: "wordSlide 0.8s cubic-bezier(0.16,1,0.3,1) 0.15s both",
                    lineHeight: 1.1,
                    textShadow: "0 0 40px rgba(245,158,11,0.2)",
                  }}
                >
                  Sai Rolotech{" "}
                  <span style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #f97316 40%, #fbbf24 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 15px rgba(245,158,11,0.4))",
                  }}>
                    Smart Engines
                  </span>
                </h1>
              </div>

              <p style={{
                fontSize: "0.65rem",
                color: "rgba(156,163,175,0.85)",
                letterSpacing: "0.25em",
                fontWeight: 600,
                fontFamily: "monospace",
                textTransform: "uppercase",
                animation: "tagFade 0.8s ease-out 0.3s both",
              }}>
                Precision Roll Forming Engineering Suite
              </p>
            </div>
          </div>
        )}

        {showLoader && (
          <div
            className="flex flex-col items-center gap-4 w-full"
            style={{ maxWidth: 420, animation: "wordSlide 0.5s ease-out both" }}
          >
            <div className="w-full h-px" style={{
              background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.25), transparent)"
            }} />

            <div className="w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-[10px]" style={{ color: "rgba(156,163,175,0.65)" }}>
                  {statusText}
                </span>
                <span
                  className="font-mono text-[10px] font-bold"
                  style={{ color: isReady ? "#22c55e" : "rgba(245,158,11,0.8)" }}
                >
                  {progress}%
                </span>
              </div>

              <div className="w-full rounded-full overflow-hidden" style={{
                height: 3,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div className="h-full rounded-full" style={{
                  width: `${progress}%`,
                  background: isReady
                    ? "linear-gradient(90deg, #22c55e, #4ade80)"
                    : "linear-gradient(90deg, #f59e0b, #f97316, #fbbf24)",
                  transition: "width 0.6s cubic-bezier(0.4,0,0.2,1), background 0.5s ease",
                  animation: "progressGlow 1.5s ease-in-out infinite",
                }} />
              </div>
            </div>

            <div className="flex gap-4 mt-1">
              {[
                { label: "Roll Design", icon: "⚙", threshold: 25 },
                { label: "CNC/CAM",    icon: "🔧", threshold: 40 },
                { label: "Offline AI", icon: "🧠", threshold: 70 },
                { label: "3D Engine",  icon: "📐", threshold: 85 },
                { label: "Hardware",   icon: "💻", threshold: 55 },
              ].map((m, i) => {
                const active = progress >= m.threshold;
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1rem",
                      transition: "all 0.4s ease",
                      background: active ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.06)"}`,
                      transform: active ? "scale(1.12)" : "scale(1)",
                      boxShadow: active ? "0 0 12px 2px rgba(245,158,11,0.15)" : "none",
                    }}>
                      {m.icon}
                    </div>
                    <span style={{
                      fontSize: "8px", fontWeight: 600,
                      color: active ? "rgba(245,158,11,0.85)" : "rgba(156,163,175,0.35)",
                      transition: "color 0.4s ease",
                      letterSpacing: "0.05em",
                    }}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 100,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              marginTop: 4,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: isReady ? "#22c55e" : "#f59e0b",
                boxShadow: `0 0 6px 2px ${isReady ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.5)"}`,
              }} />
              <span style={{
                fontSize: "9px", fontFamily: "monospace",
                color: "rgba(156,163,175,0.5)",
                letterSpacing: "0.08em",
              }}>
                {appVersion} Ultra Pro Max — Hardware-First Architecture
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(1,0,5,0.6) 100%)",
      }} />
    </div>
  );
}
