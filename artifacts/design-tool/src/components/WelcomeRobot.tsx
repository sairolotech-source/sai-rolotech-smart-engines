import { useState, useEffect } from "react";

interface WelcomeRobotProps {
  userName?: string;
  onDismiss: () => void;
}

function RobotSVG({ phase }: { phase: string }) {
  const isWaving = phase === "wave" || phase === "talk";
  const isTalking = phase === "talk" || phase === "ready";

  return (
    <svg viewBox="0 0 200 240" width="120" height="150" className="shrink-0"
      style={{ willChange: "transform", filter: "drop-shadow(0 0 8px rgba(245,158,11,0.15))" }}>
      <defs>
        <filter id="robotGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1f36" />
          <stop offset="100%" stopColor="#14152a" />
        </linearGradient>
        <linearGradient id="headGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#111225" />
          <stop offset="100%" stopColor="#0a0b18" />
        </linearGradient>
      </defs>

      {Array.from({ length: 8 }, (_, i) => (
        <circle key={i} cx={30 + (i * 20)} cy={20 + (i * 25)} r={1 + (i % 3) * 0.4}
          fill="#f59e0b" opacity="0">
          <animate attributeName="opacity" values="0;0.12;0.04;0.1;0"
            dur={`${3 + i % 3}s`} begin={`${i * 0.3}s`} repeatCount="indefinite" />
        </circle>
      ))}

      <g>
        <animateTransform attributeName="transform" type="translate"
          values="0,0;0,-3;0,0;0,2;0,0" dur="2s" repeatCount="indefinite" />

        <rect x="70" y="100" width="60" height="70" rx="12" fill="url(#bodyGrad)"
          stroke="#f59e0b" strokeWidth="2" />
        <rect x="80" y="115" width="40" height="8" rx="2" fill="#f59e0b" opacity="0.13" />
        <rect x="80" y="128" width="40" height="8" rx="2" fill="#f59e0b" opacity="0.13" />
        <rect x="80" y="141" width="40" height="8" rx="2" fill="#f59e0b" opacity="0.13" />

        <g>
          <animateTransform attributeName="transform" type="translate"
            values="0,0;0,-2;0,0;0,1;0,0" dur="2.5s" repeatCount="indefinite" />

          <rect x="72" y="45" width="56" height="45" rx="14" fill="url(#headGrad)"
            stroke="#06b6d4" strokeWidth="2" />

          <rect x="82" y="60" width="12" height="10" rx="3" fill="#06b6d4" filter="url(#robotGlow)">
            <animate attributeName="height" values="10;2;10" dur="4s"
              keyTimes="0;0.48;0.52" repeatCount="indefinite" />
          </rect>
          <rect x="106" y="60" width="12" height="10" rx="3" fill="#06b6d4" filter="url(#robotGlow)">
            <animate attributeName="height" values="10;2;10" dur="4s"
              keyTimes="0;0.48;0.52" repeatCount="indefinite" />
          </rect>

          <circle cx="88" cy="64" r="2" fill="white" opacity="0.9">
            <animate attributeName="cx" values="87;89;87" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="112" cy="64" r="2" fill="white" opacity="0.9">
            <animate attributeName="cx" values="111;113;111" dur="3s" repeatCount="indefinite" />
          </circle>

          {isTalking && (
            <rect x="92" y="78" width="16" height="4" rx="2" fill="#f59e0b">
              <animate attributeName="width" values="16;10;20;12;16" dur="0.4s" repeatCount="indefinite" />
              <animate attributeName="x" values="92;95;90;94;92" dur="0.4s" repeatCount="indefinite" />
            </rect>
          )}

          <circle cx="100" cy="37" r="4" fill="#06b6d4" filter="url(#robotGlow)">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <line x1="100" y1="41" x2="100" y2="45" stroke="#06b6d4" strokeWidth="1" opacity="0.3" />
        </g>

        <g transform="translate(65,110)">
          {isWaving ? (
            <g>
              <animateTransform attributeName="transform" type="rotate"
                values="-30;-70;-30" dur="0.4s" repeatCount="indefinite"
                additive="sum" />
              <rect x="-5" y="0" width="10" height="40" rx="5" fill="#1a1b2e"
                stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="0" cy="42" r="6" fill="#06b6d4" />
            </g>
          ) : (
            <g>
              <animateTransform attributeName="transform" type="rotate"
                values="-15;-20;-15" dur="3s" repeatCount="indefinite"
                additive="sum" />
              <rect x="-5" y="0" width="10" height="40" rx="5" fill="#1a1b2e"
                stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="0" cy="42" r="6" fill="#06b6d4" />
            </g>
          )}
        </g>

        <g transform="translate(135,110)">
          <animateTransform attributeName="transform" type="rotate"
            values="15;20;15" dur="3s" repeatCount="indefinite"
            additive="sum" />
          <rect x="-5" y="0" width="10" height="40" rx="5" fill="#1a1b2e"
            stroke="#f59e0b" strokeWidth="1.5" />
          <circle cx="0" cy="42" r="6" fill="#06b6d4" />
        </g>

        <rect x="80" y="172" width="14" height="30" rx="5" fill="#1a1b2e"
          stroke="#f59e0b" strokeWidth="1" opacity="0.6" />
        <rect x="106" y="172" width="14" height="30" rx="5" fill="#1a1b2e"
          stroke="#f59e0b" strokeWidth="1" opacity="0.6" />
        <rect x="78" y="203" width="18" height="8" rx="4" fill="#06b6d4" />
        <rect x="104" y="203" width="18" height="8" rx="4" fill="#06b6d4" />
      </g>
    </svg>
  );
}

export function WelcomeRobot({ userName = "Vipu", onDismiss }: WelcomeRobotProps) {
  const [phase, setPhase] = useState<"enter" | "wave" | "talk" | "ready" | "exit">("enter");
  const [displayedText, setDisplayedText] = useState("");
  const [showActions, setShowActions] = useState(false);

  const greeting = `Hiii ${userName}! Keso ho? Aaj kya banaye batao — me tayar hu! 🤖`;

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase("wave"), 500),
      setTimeout(() => setPhase("talk"), 1200),
      setTimeout(() => setPhase("ready"), 1200 + greeting.length * 35 + 500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [greeting.length]);

  useEffect(() => {
    if (phase !== "talk" && phase !== "ready") return;
    if (phase === "ready") {
      setDisplayedText(greeting);
      setShowActions(true);
      return;
    }
    let idx = 0;
    const iv = setInterval(() => {
      idx++;
      setDisplayedText(greeting.slice(0, idx));
      if (idx >= greeting.length) {
        clearInterval(iv);
        setTimeout(() => {
          setPhase("ready");
          setShowActions(true);
        }, 400);
      }
    }, 35);
    return () => clearInterval(iv);
  }, [phase, greeting]);

  const handleDismiss = () => {
    setPhase("exit");
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      className={`fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-400 ${
        phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      onClick={handleDismiss}
    >
      <div
        className={`bg-[#0d0e1a] border border-amber-500/20 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl shadow-amber-500/10 transition-all duration-500 ${
          phase === "enter" ? "scale-90 opacity-0" : phase === "exit" ? "scale-90 opacity-0" : "scale-100 opacity-100"
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <RobotSVG phase={phase} />

          <div className="flex-1 min-w-0 pt-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold uppercase tracking-widest">
                Online
              </span>
              <span className="text-zinc-600 text-[10px]">SAI Rolotech AI Assistant</span>
            </div>

            <div className="bg-[#12131f] border border-white/5 rounded-xl p-3 min-h-[60px]">
              <p className="text-white text-sm leading-relaxed">
                {displayedText}
                {phase === "talk" && <span className="animate-pulse text-amber-400">|</span>}
              </p>
            </div>

            {showActions && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-medium">Quick Start</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "C-Channel Design", icon: "📐" },
                    { label: "Z-Purlin Line", icon: "⚙" },
                    { label: "Panel Machine", icon: "🏭" },
                    { label: "Custom Profile", icon: "✏️" },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={handleDismiss}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/20 rounded-lg text-xs text-zinc-300 hover:text-amber-400 transition-all duration-200"
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-full mt-2 px-4 py-2.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-medium transition-all"
                >
                  Chalo Shuru Karte Hai! →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
