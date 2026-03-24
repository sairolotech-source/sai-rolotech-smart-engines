import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, FileCode, Layers, Cpu, Code, ArrowRight } from "lucide-react";

// Duration of each scene in milliseconds
const SCENE_DURATIONS = [5000, 10000, 10000, 10000, 10000, 12000, 14000, 12000, 10000, 14000];

const defaultEase = [0.16, 1, 0.3, 1] as [number, number, number, number]; // Smooth custom ease
const springSnappy = { type: "spring" as const, stiffness: 400, damping: 30 };
const springSmooth = { type: "spring" as const, stiffness: 120, damping: 25 };

export default function DemoVideo() {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentScene((prev) => (prev + 1) % SCENE_DURATIONS.length);
    }, SCENE_DURATIONS[currentScene]);
    return () => clearTimeout(timer);
  }, [currentScene]);

  return (
    <div className="w-full h-screen bg-[#04060e] text-white overflow-hidden relative font-sans">
      {/* Persistent Background Effects */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#f97316] via-[#04060e] to-[#04060e] opacity-30" />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(249, 115, 22, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(249, 115, 22, 0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            transform: "perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)",
          }}
        />
      </div>

      {/* Persistent Brand Elements */}
      <motion.div
        className="absolute top-8 left-8 z-50 flex items-center gap-3"
        animate={{
          opacity: currentScene === 0 || currentScene === 8 || currentScene === 9 ? 0 : 1,
          y: currentScene === 0 ? -20 : 0,
        }}
        transition={{ duration: 0.8, ease: defaultEase }}
      >
        <Settings className="w-6 h-6 text-[#f97316] animate-spin-slow" />
        <span className="font-bold tracking-wider text-sm opacity-80 uppercase">SAI Rolotech</span>
      </motion.div>

      {/* Scenes Container */}
      <div className="relative w-full h-full z-10 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentScene === 0 && <Scene0 key="scene0" />}
          {currentScene === 1 && <Scene1 key="scene1" />}
          {currentScene === 2 && <Scene2 key="scene2" />}
          {currentScene === 3 && <Scene3 key="scene3" />}
          {currentScene === 4 && <Scene4 key="scene4" />}
          {currentScene === 5 && <SceneAccuracy key="scene-accuracy" />}
          {currentScene === 6 && <Scene6 key="scene6" />}
          {currentScene === 7 && <SceneSpecialFunctions key="scene-special" />}
          {currentScene === 8 && <Scene5 key="scene5" />}
          {currentScene === 9 && <Scene7 key="scene7" />}
        </AnimatePresence>
      </div>
      
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-[#27272a] w-full z-50">
        <motion.div
          className="h-full bg-[#f97316]"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: SCENE_DURATIONS.reduce((a, b) => a + b, 0) / 1000, ease: "linear", repeat: Infinity }}
        />
      </div>
    </div>
  );
}

// Scene 0: INTRO
function Scene0() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center text-center w-full h-full"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: defaultEase }}
    >
      <motion.div
        initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ...springSmooth }}
        className="mb-8 relative"
      >
        <div className="absolute inset-0 bg-[#f97316] blur-[50px] opacity-30 rounded-full" />
        <Settings className="w-32 h-32 text-[#f97316] relative z-10" />
      </motion.div>
      
      <motion.h1
        className="text-6xl md:text-8xl font-bold mb-6 tracking-tight"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.4, ease: defaultEase }}
      >
        SAI Rolotech
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#f59e0b]">
          Smart Engines
        </span>
      </motion.h1>
      
      <motion.div
        className="text-2xl text-[#71717a] font-light tracking-wide mb-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.8, ease: defaultEase }}
      >
        From Drawing to G-Code in Minutes
      </motion.div>
      
      <motion.div
        className="px-6 py-2 border border-[#f97316]/30 bg-[#f97316]/10 rounded-full text-[#f59e0b] text-sm uppercase tracking-widest font-semibold shadow-[0_0_20px_rgba(249,115,22,0.2)]"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 1.2, ...springSnappy }}
      >
        v2.2.6 — Precision Roll Forming Suite
      </motion.div>
    </motion.div>
  );
}

// Scene 1: DXF PROFILE IMPORT
function Scene1() {
  const [stripWidth, setStripWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      let current = 0;
      const interval = setInterval(() => {
        current += 5.2;
        if (current >= 247.3) {
          setStripWidth(247.3);
          clearInterval(interval);
        } else {
          setStripWidth(current);
        }
      }, 30);
      return () => clearInterval(interval);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="w-full h-full flex flex-col md:flex-row items-center justify-center p-12 gap-12"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100, filter: "blur(10px)" }}
      transition={{ duration: 1, ease: defaultEase }}
    >
      <div className="flex-1 max-w-2xl relative">
        <motion.div
          className="absolute -inset-4 bg-[#f97316] opacity-10 blur-[40px] rounded-full"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="border border-[#f97316]/40 bg-[#04060e] p-8 rounded-xl relative z-10 shadow-[0_0_40px_rgba(249,115,22,0.15)] h-[60vh] flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
            <h2 className="text-[#f97316] font-bold tracking-widest uppercase flex items-center gap-2">
              <FileCode className="w-5 h-5" />
              Step 1 — Import DXF Profile
            </h2>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center relative perspective-[1000px]">
            <motion.div
              className="relative w-64 h-64 border border-dashed border-[#71717a]/30"
              initial={{ rotateX: 0, rotateY: 0 }}
              animate={{ rotateX: 20, rotateY: -30 }}
              transition={{ duration: 8, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full absolute inset-0 overflow-visible">
                <motion.path
                  d="M 50 150 L 50 50 L 150 50 L 150 150"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="4"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
                />
                <motion.path
                  d="M 40 150 L 40 40 L 160 40 L 160 150"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2, delay: 2, ease: "easeInOut" }}
                />
              </svg>
            </motion.div>
          </div>
          
          <div className="mt-auto grid grid-cols-2 gap-4">
            <motion.div
              className="bg-white/5 p-4 rounded-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.5 }}
            >
              <div className="text-xs text-[#71717a] uppercase tracking-wider mb-1">Dimensions</div>
              <div className="text-sm font-mono">100mm web × 50mm fl.</div>
              <div className="text-sm font-mono text-[#f97316]">1.5mm GI</div>
            </motion.div>
            <motion.div
              className="bg-[#f97316]/10 p-4 rounded-lg border border-[#f97316]/30"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3 }}
            >
              <div className="text-xs text-[#f97316] uppercase tracking-wider mb-1">Calc. Strip Width</div>
              <div className="text-2xl font-mono font-bold text-white">{stripWidth.toFixed(1)}mm</div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Scene 2: FLOWER DIAGRAM
function Scene2() {
  const angles = [0, 15, 30, 45, 60, 75, 85, 90];
  
  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-12"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -100, filter: "blur(10px)" }}
      transition={{ duration: 1, ease: defaultEase }}
    >
      <div className="text-center mb-16">
        <h2 className="text-[#f97316] font-bold tracking-widest uppercase flex items-center justify-center gap-2 mb-4 text-xl">
          <Layers className="w-6 h-6" />
          Step 2 — Flower Pattern Generation
        </h2>
        <motion.div
          className="text-[#71717a] text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Progressive bending simulation with springback compensation
        </motion.div>
      </div>

      {/* 3D Flower Diagram — SVG isometric U-channel cross-sections */}
      <div className="flex items-center justify-center w-full max-w-5xl">
        <svg viewBox="0 0 760 200" className="w-full" style={{ maxHeight: 200 }}>
          <defs>
            <linearGradient id="fl-steel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="60%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="fl-face" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <filter id="fl-glow">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {angles.map((angle, i) => {
            const cx = 42 + i * 96;
            const t = 4;           // strip thickness (visual)
            const baseW = 30;      // base half-width
            const flangeH = 28;    // flange height
            const rad = (angle * Math.PI) / 180;
            const fx = Math.sin(rad) * flangeH;
            const fy = Math.cos(rad) * flangeH;
            const baseY = 120;
            const isLast = i === angles.length - 1;
            const col = isLast ? "#f97316" : `hsl(${24 + i * 4},${60 + i * 4}%,${40 + i * 3}%)`;

            return (
              <motion.g key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.28, ...springSnappy }}>

                {/* Connector arrow */}
                {i < angles.length - 1 && (
                  <motion.line x1={cx + baseW + 8} y1={baseY} x2={cx + 96 - baseW - 8} y2={baseY}
                    stroke="#f97316" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.35"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.8 + i * 0.28, duration: 0.4 }} />
                )}

                {/* 3D depth shadow */}
                <g opacity="0.3" transform="translate(3,4)">
                  {/* Base */}
                  <rect x={cx - baseW} y={baseY - t} width={baseW * 2} height={t} fill="#000" rx="0.5" />
                  {/* Left flange */}
                  <line x1={cx - baseW} y1={baseY} x2={cx - baseW - fx} y2={baseY - fy} stroke="#000" strokeWidth={t} strokeLinecap="round" />
                  {/* Right flange */}
                  <line x1={cx + baseW} y1={baseY} x2={cx + baseW + fx} y2={baseY - fy} stroke="#000" strokeWidth={t} strokeLinecap="round" />
                </g>

                {/* Base strip (horizontal bottom) */}
                <rect x={cx - baseW} y={baseY - t / 2} width={baseW * 2} height={t}
                  fill={col} rx="0.5" filter={isLast ? "url(#fl-glow)" : undefined} />

                {/* Left flange */}
                <line x1={cx - baseW} y1={baseY} x2={cx - baseW - fx} y2={baseY - fy}
                  stroke={col} strokeWidth={t} strokeLinecap="round"
                  filter={isLast ? "url(#fl-glow)" : undefined} />

                {/* Right flange */}
                <line x1={cx + baseW} y1={baseY} x2={cx + baseW + fx} y2={baseY - fy}
                  stroke={col} strokeWidth={t} strokeLinecap="round"
                  filter={isLast ? "url(#fl-glow)" : undefined} />

                {/* Top ends of flanges */}
                <circle cx={cx - baseW - fx} cy={baseY - fy} r={t / 2} fill={col} />
                <circle cx={cx + baseW + fx} cy={baseY - fy} r={t / 2} fill={col} />

                {/* Angle arc */}
                {angle > 0 && (
                  <path d={`M ${cx + baseW + 6} ${baseY} A 8 8 0 0 0 ${cx + baseW + 6 + Math.sin(rad) * 8} ${baseY - Math.cos(rad) * 8}`}
                    fill="none" stroke={col} strokeWidth="1" opacity="0.7" />
                )}

                {/* Station label */}
                <text x={cx} y={baseY + 18} textAnchor="middle" fill="#71717a" fontSize="8" fontFamily="monospace">
                  ST.{i + 1}
                </text>
                {/* Angle label */}
                <text x={cx} y={baseY + 28} textAnchor="middle"
                  fill={isLast ? "#f97316" : "#52525b"} fontSize="9" fontFamily="monospace" fontWeight={isLast ? "bold" : "normal"}>
                  {angle}°
                </text>
                {/* Final label */}
                {isLast && (
                  <text x={cx} y={baseY - fy - 10} textAnchor="middle" fill="#f97316" fontSize="8" fontFamily="monospace">FINAL</text>
                )}
              </motion.g>
            );
          })}
        </svg>
      </div>
      
      <motion.div
        className="mt-16 bg-[#f97316]/20 border border-[#f97316]/50 px-8 py-4 rounded-full flex items-center gap-4"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 4, ...springSnappy }}
      >
        <span className="w-3 h-3 rounded-full bg-[#f97316] animate-pulse" />
        <span className="text-xl font-mono text-white">Springback Computed: <span className="text-[#f59e0b]">3.2°</span></span>
      </motion.div>
    </motion.div>
  );
}

// Scene 3: ROLL TOOLING DESIGN
function Scene3() {
  return (
    <motion.div
      className="w-full h-full flex flex-col md:flex-row items-center justify-center p-12 gap-12"
      initial={{ opacity: 0, rotateY: 90 }}
      animate={{ opacity: 1, rotateY: 0 }}
      exit={{ opacity: 0, rotateY: -90, filter: "blur(10px)" }}
      transition={{ duration: 1.2, ease: defaultEase }}
      style={{ perspective: 1200 }}
    >
      <div className="flex-1 max-w-xl text-left">
        <h2 className="text-[#f97316] font-bold tracking-widest uppercase flex items-center gap-2 mb-6 text-2xl">
          <Settings className="w-8 h-8" />
          Step 3 — Roll Tooling Calc
        </h2>
        
        <motion.div
          className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <div className="p-4 bg-white/5 border-b border-white/10 font-bold text-[#71717a] grid grid-cols-4 gap-4 text-xs tracking-wider">
            <span>STATION</span>
            <span>TOP ROLL</span>
            <span>BTM ROLL</span>
            <span>MAT'L</span>
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((st, i) => (
            <motion.div
              key={st}
              className="p-3 border-b border-white/5 grid grid-cols-4 gap-4 text-sm font-mono"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5 + i * 0.1 }}
            >
              <span className="text-[#f97316]">ST {st.toString().padStart(2, '0')}</span>
              <span>Ø180.5</span>
              <span>Ø150.2</span>
              <span className="text-[#71717a]">D2 60HRC</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Right — 3D Isometric Roll Pair SVG */}
      <div className="flex-1 h-[60vh] relative flex flex-col items-center justify-center gap-4">
        <motion.div className="text-3xl font-bold text-center"
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.5, ...springSnappy }}>
          7 Stations × 2 Rolls
          <br />
          <span className="text-[#f97316] text-4xl">= 14 Rolls Designed</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, ...springSmooth }}>
          <svg viewBox="0 0 320 280" className="w-72 md:w-80 drop-shadow-2xl">
            <defs>
              <linearGradient id="rg-upper-face" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="rg-upper-side" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#431407" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="rg-lower-face" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#78350f" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="rg-lower-side" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b1a00" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient id="rg-shaft" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <radialGradient id="rg-strip-top" cx="50%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#334155" />
              </radialGradient>
              <filter id="rg-glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* ── Shaft upper (left side) ── */}
            <rect x="12" y="73" width="44" height="20" rx="10" fill="url(#rg-shaft)" opacity="0.9" />
            {/* ── Upper roll body ── */}
            {/* Top ellipse cap */}
            <ellipse cx="160" cy="58" rx="108" ry="22" fill="#f97316" opacity="0.85" />
            {/* Body rectangle */}
            <rect x="52" y="58" width="216" height="58" fill="url(#rg-upper-face)" />
            {/* Bottom ellipse cap */}
            <ellipse cx="160" cy="116" rx="108" ry="22" fill="#7c2d12" opacity="0.95" />
            {/* Side face (right) */}
            <ellipse cx="268" cy="87" rx="22" ry="29" fill="url(#rg-upper-side)" />
            {/* Shaft upper (right side) */}
            <rect x="264" y="73" width="44" height="20" rx="10" fill="url(#rg-shaft)" opacity="0.9" />
            {/* Glow ring on edge */}
            <ellipse cx="160" cy="58" rx="108" ry="22" fill="none" stroke="#f97316" strokeWidth="1.5" opacity="0.5" filter="url(#rg-glow)" />

            {/* ── Strip (GP 1.2mm between rolls) ── */}
            <motion.rect x="52" y="116" width="216" height="6" fill="url(#rg-strip-top)" rx="1"
              animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }} />
            {/* U-groove in upper roll (shows profile) */}
            <path d="M 112 116 Q 112 124 160 124 Q 208 124 208 116" fill="#04060e" opacity="0.6" />

            {/* ── Lower roll body ── */}
            <ellipse cx="160" cy="126" rx="108" ry="22" fill="#78350f" opacity="0.95" />
            <rect x="52" y="126" width="216" height="58" fill="url(#rg-lower-face)" />
            <ellipse cx="160" cy="184" rx="108" ry="22" fill="#f59e0b" opacity="0.85" />
            <ellipse cx="268" cy="155" rx="22" ry="29" fill="url(#rg-lower-side)" />
            <rect x="12" y="151" width="44" height="20" rx="10" fill="url(#rg-shaft)" opacity="0.9" />
            <rect x="264" y="151" width="44" height="20" rx="10" fill="url(#rg-shaft)" opacity="0.9" />
            <ellipse cx="160" cy="184" rx="108" ry="22" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.5" filter="url(#rg-glow)" />

            {/* ── Labels ── */}
            <text x="160" y="48" textAnchor="middle" fill="#f97316" fontSize="11" fontFamily="monospace" fontWeight="bold">UPPER ROLL — Ø175mm D2 60HRC</text>
            <text x="160" y="198" textAnchor="middle" fill="#f59e0b" fontSize="11" fontFamily="monospace" fontWeight="bold">LOWER ROLL — Ø172mm D2 60HRC</text>
            <text x="160" y="120" textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace">← GP Strip 1.2mm • Roll Gap 1.15mm →</text>

            {/* Dimension lines */}
            <line x1="10" y1="58" x2="10" y2="184" stroke="#f97316" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.5" />
            <line x1="6" y1="58" x2="14" y2="58" stroke="#f97316" strokeWidth="1" opacity="0.5" />
            <line x1="6" y1="184" x2="14" y2="184" stroke="#f97316" strokeWidth="1" opacity="0.5" />
            <text x="4" y="125" textAnchor="middle" fill="#f97316" fontSize="8" fontFamily="monospace" transform="rotate(-90,4,125)">175mm</text>

            {/* Rotation arrows */}
            <motion.text x="290" y="93" fill="#f97316" fontSize="18" fontFamily="monospace" opacity="0.7"
              animate={{ rotate: [0, 360] }}
              style={{ transformOrigin: "290px 93px", display: "inline-block" }}>↻</motion.text>
            <motion.text x="290" y="161" fill="#f59e0b" fontSize="18" fontFamily="monospace" opacity="0.7"
              animate={{ rotate: [360, 0] }}
              style={{ transformOrigin: "290px 161px", display: "inline-block" }}>↺</motion.text>
          </svg>
        </motion.div>

        {/* Spec badges */}
        <motion.div className="flex gap-3 flex-wrap justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
          {[["Bearing", "6208-2RS"], ["Shaft", "40mm"], ["Speed", "25 m/min"], ["Motor", "7.5 kW"]].map(([k, v]) => (
            <div key={k} className="text-xs font-mono px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <span className="text-zinc-500">{k}: </span>
              <span className="text-[#f59e0b] font-bold">{v}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Scene 4: G-CODE OUTPUT
function Scene4() {
  const [lines, setLines] = useState<string[]>([]);
  const codeSnippet = [
    "; SAI ROLOTECH ENGINE v2.2",
    "; GENERATED PROFILE: C-CH_100x50",
    "G21 ; Metric mode",
    "G90 ; Absolute positioning",
    "G28 ; Home all axes",
    "M03 S1200 ; Start rolls CW",
    "G00 X0 Y0 Z10",
    "G01 Z-180.000 F250 ; St 1",
    "G01 X15.000 F500",
    "G01 Z-180.000 F250 ; St 2",
    "G01 X30.000 F500",
    "G01 Z-180.000 F250 ; St 3",
    "G01 X45.000 F500",
    "M05 ; Stop rolls",
    "M30 ; End program"
  ];

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current < codeSnippet.length) {
        setLines(prev => [...prev, codeSnippet[current]]);
        current++;
      } else {
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-12 relative"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 1, ease: defaultEase }}
    >
      <div className="absolute inset-0 bg-[#04060e] z-[-1]" />
      
      <div className="text-center mb-8 relative z-10">
        <h2 className="text-green-500 font-bold tracking-widest uppercase flex items-center justify-center gap-2 text-2xl mb-2">
          <Code className="w-8 h-8" />
          Step 4 — G-Code Generated
        </h2>
        <motion.div
          className="inline-block bg-green-500/10 text-green-400 px-4 py-1 rounded-full text-sm font-mono border border-green-500/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
        >
          Generation Time: 0.8 seconds
        </motion.div>
      </div>

      <div className="w-full max-w-4xl bg-[#0d1117] border border-white/10 rounded-lg shadow-2xl overflow-hidden flex flex-col h-[50vh] relative z-10">
        <div className="bg-[#18181b] px-4 py-2 border-b border-white/10 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="ml-4 text-xs font-mono text-[#71717a]">output.nc</span>
        </div>
        <div className="p-6 font-mono text-sm overflow-hidden relative flex-1">
          {lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={line.startsWith(";") ? "text-[#71717a]" : "text-green-400"}
            >
              <span className="text-[#71717a] mr-4 select-none">{(i + 1).toString().padStart(2, '0')}</span>
              {line}
            </motion.div>
          ))}
          <motion.div
            className="w-2 h-4 bg-green-500 inline-block ml-1 animate-pulse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        </div>
      </div>
      
      {/* Simulation overlay overlaying code */}
      <motion.div
        className="absolute bottom-10 right-10 w-64 h-64 border border-[#f97316]/30 bg-[#04060e]/80 backdrop-blur-md rounded-xl p-4 flex items-center justify-center overflow-hidden"
        initial={{ opacity: 0, y: 50, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 2, ...springSnappy }}
      >
        <div className="text-[10px] text-[#f97316] absolute top-2 left-2 font-mono uppercase">Simulation View</div>
        <div className="relative w-full h-8 bg-zinc-800 rounded flex items-center overflow-hidden">
          <motion.div
            className="w-16 h-12 bg-zinc-400/50"
            animate={{ x: [-64, 256] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          {[1,2,3,4].map(i => (
            <div key={i} className="absolute w-2 h-12 bg-white/20" style={{ left: `${i * 25}%` }} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Scene: ACCURACY & PRECISION ─────────────────────────────────────────────
const ACCURACY_METRICS = [
  { label: "Strip Width Calc", value: "±0.01mm", desc: "Bend Deduction + K-Factor formula se exact strip width", icon: "📐" },
  { label: "Springback Correction", value: "±0.5°", desc: "Material-wise springback auto-compensate karta hai", icon: "🔄" },
  { label: "Roll Gap Tolerance", value: "±0.02mm", desc: "Upper/Lower roll gap precision machining level", icon: "⚙️" },
  { label: "Bend Angle Accuracy", value: "99.7%", desc: "Progressive forming stations mein angle deviation < 0.3%", icon: "📊" },
  { label: "G-Code Precision", value: "6 Decimal", desc: "CNC coordinates 0.000001mm resolution tak", icon: "💻" },
  { label: "Flower Pattern Calc", value: "Auto ±0.1°", desc: "Per-station bend progression with real springback data", icon: "🌸" },
];

const CALCULATION_STEPS = [
  { step: "Flat Blank = Web + 2×Flange + 2×BA", result: "97.14mm", time: "0.02s" },
  { step: "BA = π/180 × (R + K×T) × θ", result: "3.57mm/bend", time: "0.01s" },
  { step: "Springback = f(E, σy, T, R/T)", result: "2.1° correction", time: "0.03s" },
  { step: "Roll OD = PassLine ± Profile", result: "Ø172.5mm", time: "0.01s" },
  { step: "Station Count = θ_total / Δθ_max", result: "7 stations", time: "0.02s" },
];

function SceneAccuracy() {
  const [visibleMetrics, setVisibleMetrics] = React.useState(0);
  const [showCalc, setShowCalc] = React.useState(false);
  const [visibleCalcRows, setVisibleCalcRows] = React.useState(0);

  React.useEffect(() => {
    const t1 = setTimeout(() => setShowCalc(true), 5000);
    return () => clearTimeout(t1);
  }, []);

  React.useEffect(() => {
    if (visibleMetrics >= ACCURACY_METRICS.length) return;
    const t = setTimeout(() => setVisibleMetrics(v => v + 1), visibleMetrics === 0 ? 800 : 350);
    return () => clearTimeout(t);
  }, [visibleMetrics]);

  React.useEffect(() => {
    if (!showCalc || visibleCalcRows >= CALCULATION_STEPS.length) return;
    const t = setTimeout(() => setVisibleCalcRows(v => v + 1), visibleCalcRows === 0 ? 200 : 400);
    return () => clearTimeout(t);
  }, [showCalc, visibleCalcRows]);

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-6 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.08),transparent_60%)]" />

      <motion.div className="text-center mb-6 relative z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7 }}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono tracking-widest uppercase mb-3">
          PRECISION ENGINEERING
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Accuracy{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#f97316]">
            Industry Level
          </span>
        </h2>
        <p className="text-zinc-500 text-sm mt-1 font-mono">50,000+ profiles pe tested — engineering calculations jo 100% reliable hain</p>
      </motion.div>

      <div className="relative z-10 w-full max-w-6xl flex gap-6" style={{ maxHeight: "70vh" }}>
        <div className="flex-1 grid grid-cols-2 gap-3">
          {ACCURACY_METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 relative overflow-hidden"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{
                opacity: visibleMetrics > i ? 1 : 0,
                y: visibleMetrics > i ? 0 : 20,
                scale: visibleMetrics > i ? 1 : 0.95,
              }}
              transition={{ duration: 0.4, ease: defaultEase }}
            >
              {visibleMetrics > i && (
                <motion.div
                  className="absolute top-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-[#f97316]"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                />
              )}
              <div className="flex items-start gap-3">
                <div className="text-2xl">{m.icon}</div>
                <div className="flex-1">
                  <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{m.label}</div>
                  <div className="text-xl font-bold text-emerald-400 font-mono mt-1">{m.value}</div>
                  <div className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{m.desc}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {showCalc && (
            <motion.div
              className="w-80 bg-[#080b18] border border-[#f97316]/30 rounded-xl overflow-hidden shadow-xl shadow-[#f97316]/5"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: defaultEase }}
            >
              <div className="bg-gradient-to-r from-[#0f1420] to-[#131926] border-b border-[#f97316]/20 px-4 py-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-[#f97316] uppercase tracking-widest">Live Calculation Engine</span>
              </div>
              <div className="p-4 space-y-2">
                {CALCULATION_STEPS.map((c, i) => (
                  <motion.div
                    key={i}
                    className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{
                      opacity: visibleCalcRows > i ? 1 : 0,
                      x: visibleCalcRows > i ? 0 : 20,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="text-[9px] text-zinc-500 font-mono">{c.step}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-[#f97316] font-mono">{c.result}</span>
                      <span className="text-[8px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full">{c.time}</span>
                    </div>
                  </motion.div>
                ))}
                <motion.div
                  className="mt-3 text-center p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: visibleCalcRows >= CALCULATION_STEPS.length ? 1 : 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="text-emerald-400 text-sm font-bold font-mono">Total Time: 0.09 seconds</div>
                  <div className="text-[9px] text-zinc-500 mt-1">Manual calculation: 4-6 hours</div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Scene: SPECIAL FUNCTIONS ────────────────────────────────────────────────
const SPECIAL_FEATURES = [
  {
    title: "BUDDY AI CRM",
    subtitle: "Smart Customer Management",
    desc: "AI-powered lead tracking, follow-up reminders, aur sales pipeline — sab ek jagah",
    color: "#8b5cf6",
    stats: ["Auto Lead Scoring", "WhatsApp Integration", "Sales Analytics"],
  },
  {
    title: "Drawing Vision AI",
    subtitle: "Photo se Engineering Data",
    desc: "Camera se drawing ki photo lo — AI automatically dimensions, angles, tolerances extract karega",
    color: "#06b6d4",
    stats: ["DXF Auto-Extract", "Dimension Detection", "Tolerance Reading"],
  },
  {
    title: "Multi-Controller CNC",
    subtitle: "Delta 2X + Fanuc + Siemens",
    desc: "Ek hi design se multiple CNC controller formats mein G-Code export karo",
    color: "#f97316",
    stats: ["Delta 2X Primary", "Fanuc Compatible", "Siemens Ready"],
  },
  {
    title: "Offline-First Engine",
    subtitle: "Bina Internet Bhi Chale",
    desc: "Factory mein internet nahi? Koi problem nahi — sab calculations offline hardware pe hoti hain",
    color: "#10b981",
    stats: ["Local Processing", "Auto-Sync", "Zero Latency"],
  },
  {
    title: "3D Solid Modeling",
    subtitle: "Real-Time Visualization",
    desc: "Roll pairs, profiles, aur machine layout 3D mein live dekhein — rotate, zoom, inspect",
    color: "#f59e0b",
    stats: ["WebGL Rendering", "Roll Animation", "Export STL/STEP"],
  },
  {
    title: "Auto GitHub Sync",
    subtitle: "Version Control Built-in",
    desc: "Har 5 minute mein latest version auto-update — team sabko latest features milte hain",
    color: "#ef4444",
    stats: ["Auto-Pull Updates", "Backup History", "Team Sync"],
  },
];

function SceneSpecialFunctions() {
  const [visibleCards, setVisibleCards] = React.useState(0);
  const [showWhyBanner, setShowWhyBanner] = React.useState(false);

  React.useEffect(() => {
    if (visibleCards >= SPECIAL_FEATURES.length) {
      const t = setTimeout(() => setShowWhyBanner(true), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setVisibleCards(v => v + 1), visibleCards === 0 ? 600 : 380);
    return () => clearTimeout(t);
  }, [visibleCards]);

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-6 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.08),transparent_60%)]" />

      <motion.div className="text-center mb-5 relative z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7 }}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 text-xs font-mono tracking-widest uppercase mb-2">
          EXCLUSIVE FEATURES
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Special Functions{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-[#f97316]">
            Sirf SAI Rolotech Mein
          </span>
        </h2>
        <p className="text-zinc-500 text-sm mt-1 font-mono">Yeh features kisi aur software mein nahi milenge</p>
      </motion.div>

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-3 gap-3" style={{ maxHeight: "65vh" }}>
        {SPECIAL_FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 relative overflow-hidden"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{
              opacity: visibleCards > i ? 1 : 0,
              y: visibleCards > i ? 0 : 30,
              scale: visibleCards > i ? 1 : 0.9,
            }}
            transition={{ duration: 0.5, ease: defaultEase }}
          >
            {visibleCards > i && (
              <motion.div
                className="absolute top-0 left-0 w-full h-1"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                style={{ transformOrigin: "left", background: `linear-gradient(to right, ${f.color}, ${f.color}80)` }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            )}

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ background: `${f.color}20`, color: f.color, border: `1px solid ${f.color}40` }}>
                {(i + 1).toString().padStart(2, "0")}
              </div>
              <div>
                <div className="text-sm font-bold text-white">{f.title}</div>
                <div className="text-[9px] font-mono" style={{ color: f.color }}>{f.subtitle}</div>
              </div>
            </div>

            <div className="text-[10px] text-zinc-400 leading-relaxed mb-3">{f.desc}</div>

            <div className="flex flex-wrap gap-1">
              {f.stats.map((s) => (
                <span key={s} className="text-[8px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
                  {s}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showWhyBanner && (
          <motion.div
            className="relative z-10 mt-5 w-full max-w-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: defaultEase }}
          >
            <div className="bg-gradient-to-r from-[#f97316]/20 via-violet-500/10 to-emerald-500/20 border border-[#f97316]/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">Kyon SAI Rolotech Use Karein?</div>
                <div className="text-[10px] text-zinc-400 font-mono mt-1">
                  6 exclusive features + ₹999/month pricing + Hindi/Urdu support + Android app + Offline mode
                </div>
              </div>
              <div className="flex gap-3">
                {[
                  { val: "96×", label: "Faster" },
                  { val: "97%", label: "Cheaper" },
                  { val: "100%", label: "Offline" },
                ].map((s) => (
                  <div key={s.label} className="text-center px-3">
                    <div className="text-lg font-black text-[#f97316] font-mono">{s.val}</div>
                    <div className="text-[8px] text-zinc-500 font-mono uppercase">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Machine spec data ──────────────────────────────────────────────────────
// U-Channel 40×25×1.2mm GP — Auto calculated by SAI Rolotech Smart Engines v2.2.6
// Flat blank = 40 + 2×25 + 2×(π/2×(1.8+0.33×1.2)) = 96.9mm ≈ 97mm
// Shaft: 40mm | Bearing: 6208-2RS | Motor: 7.5kW | Speed: 25m/min
const MACHINE_PROFILE = {
  name: "U-CHANNEL",
  dims: "40×25mm",
  material: "GP (Galvanized Plain)",
  thickness: "1.2mm",
  flatBlank: "97mm",
  stations: 7,
  totalRolls: 14,
  shaft: "40mm",
  bearing: "6208-2RS",
  speed: "25 m/min",
  motor: "7.5 kW",
  passLine: "800mm",
  springback: "2°",
};
const STATIONS = [
  { id: "ST-01", angle: 15, od: 160, lod: 158, w: 97, bearing: "6208-2RS", shaft: "40mm", note: "Initial entry, guide rolls" },
  { id: "ST-02", angle: 30, od: 162, lod: 160, w: 95, bearing: "6208-2RS", shaft: "40mm", note: "Progressive bending" },
  { id: "ST-03", angle: 45, od: 165, lod: 163, w: 93, bearing: "6208-2RS", shaft: "40mm", note: "Mid-form station" },
  { id: "ST-04", angle: 60, od: 168, lod: 165, w: 91, bearing: "6208-2RS", shaft: "40mm", note: "Shaping station" },
  { id: "ST-05", angle: 75, od: 170, lod: 168, w: 90, bearing: "6208-2RS", shaft: "40mm", note: "Near-final form" },
  { id: "ST-06", angle: 87, od: 172, lod: 170, w: 90, bearing: "6208-2RS", shaft: "40mm", note: "Springback correction" },
  { id: "ST-07", angle: 90, od: 175, lod: 172, w: 90, bearing: "6208-2RS", shaft: "40mm", note: "Final sizing & calibration" },
];

// Scene 6: MACHINE SPECIFICATION PDF
function Scene6() {
  const [visibleRows, setVisibleRows] = React.useState(0);
  const [showGraphic, setShowGraphic] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setShowGraphic(true), 600);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    if (visibleRows >= STATIONS.length) return;
    const t = setTimeout(() => setVisibleRows(v => v + 1), visibleRows === 0 ? 1200 : 280);
    return () => clearTimeout(t);
  }, [visibleRows]);

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-6 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.8 }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.08),transparent_60%)]" />

      {/* PDF Document */}
      <motion.div
        className="relative z-10 w-full max-w-5xl bg-[#080b18] border border-[#f97316]/30 rounded-2xl overflow-hidden shadow-2xl shadow-[#f97316]/10"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: defaultEase }}
        style={{ maxHeight: "88vh" }}
      >
        {/* PDF Header */}
        <div className="bg-gradient-to-r from-[#0f1420] to-[#131926] border-b border-[#f97316]/20 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f97316] to-[#f59e0b] flex items-center justify-center shadow-lg shadow-[#f97316]/30">
              <Settings className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="text-white font-bold tracking-wide text-sm">SAI ROLOTECH SMART ENGINES</div>
              <div className="text-[#f97316] text-xs font-mono">MACHINE SPECIFICATION REPORT — AUTO GENERATED</div>
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500 font-mono">
            <div>Profile: C-CHANNEL 100×50mm</div>
            <div>Material: GI 1.5mm | Date: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        <div className="flex gap-0 overflow-hidden" style={{ height: "calc(88vh - 80px)" }}>
          {/* Left — Roll Forming Line Graphic */}
          <div className="w-56 flex-shrink-0 bg-[#05080f] border-r border-white/5 p-4 flex flex-col gap-4">
            <div className="text-[10px] font-mono text-[#f97316] uppercase tracking-widest mb-1">Machine Layout</div>

            {/* SVG Roll forming line top view */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: showGraphic ? 1 : 0 }} transition={{ duration: 0.6 }}>
              <svg viewBox="0 0 160 420" className="w-full" style={{ height: 380 }}>
                {/* Guide rail lines */}
                <line x1="30" y1="10" x2="30" y2="410" stroke="#1e293b" strokeWidth="1.5" />
                <line x1="130" y1="10" x2="130" y2="410" stroke="#1e293b" strokeWidth="1.5" />
                {/* Strip */}
                <motion.rect x="60" y="10" width="40" height="400" fill="url(#stripGrad)" rx="1"
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  style={{ transformOrigin: "80px 10px" }}
                  transition={{ duration: 1.2, delay: 0.5 }} />
                <defs>
                  <linearGradient id="stripGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#334155" />
                    <stop offset="50%" stopColor="#94a3b8" />
                    <stop offset="100%" stopColor="#475569" />
                  </linearGradient>
                  <radialGradient id="rollGlow">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                  </radialGradient>
                </defs>
                {/* Stations */}
                {STATIONS.map((st, i) => {
                  const y = 18 + i * 49;
                  return (
                    <motion.g key={st.id}
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: visibleRows > i ? 1 : 0.15, scaleX: visibleRows > i ? 1 : 0 }}
                      style={{ transformOrigin: `80px ${y + 16}px` }}
                      transition={{ duration: 0.3, delay: 0.1 }}>
                      {/* Upper roll */}
                      <ellipse cx="80" cy={y} rx="40" ry="12" fill="#1e3a5f" stroke={visibleRows > i ? "#f97316" : "#1e293b"} strokeWidth="1.5" />
                      <ellipse cx="80" cy={y} rx="20" ry="6" fill="#0f2137" />
                      {/* Lower roll */}
                      <ellipse cx="80" cy={y + 32} rx="40" ry="12" fill="#1e3a5f" stroke={visibleRows > i ? "#f97316" : "#1e293b"} strokeWidth="1.5" />
                      <ellipse cx="80" cy={y + 32} rx="20" ry="6" fill="#0f2137" />
                      {/* Station label */}
                      <text x="6" y={y + 20} fill="#f97316" fontSize="8" fontFamily="monospace" opacity={visibleRows > i ? 1 : 0.3}>{st.id}</text>
                      {/* Glow on contact */}
                      {visibleRows > i && <ellipse cx="80" cy={y + 16} rx="18" ry="3" fill="url(#rollGlow)" />}
                    </motion.g>
                  );
                })}
                {/* Direction arrow */}
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>
                  <line x1="145" y1="30" x2="145" y2="390" stroke="#f97316" strokeWidth="1" strokeDasharray="4 3" />
                  <polygon points="140,380 145,395 150,380" fill="#f97316" />
                  <text x="148" y="210" fill="#f97316" fontSize="8" fontFamily="monospace" transform="rotate(90,148,210)">FEED DIRECTION →</text>
                </motion.g>
              </svg>
            </motion.div>

            {/* Machine summary stats */}
            <motion.div className="space-y-2 mt-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>
              {[
                ["Stations", "8"],
                ["Total Rolls", "16"],
                ["Shaft Ø", "50/60mm"],
                ["Speed", "15 m/min"],
                ["Motor", "22 kW"],
                ["Pass Line", "920mm"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-500">{k}</span>
                  <span className="text-[#f59e0b] font-bold">{v}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Station Table */}
          <div className="flex-1 overflow-auto p-5">
            <div className="text-[10px] font-mono text-[#f97316] uppercase tracking-widest mb-3">Station × Bearing Specification Table</div>

            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="text-[10px] text-zinc-500 border-b border-white/10">
                  {["Station", "Bend °", "Upper Roll OD", "Lower Roll OD", "Roll Width", "Shaft Ø", "Bearing No.", "Material"].map(h => (
                    <th key={h} className="text-left pb-2 pr-4 whitespace-nowrap font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STATIONS.map((st, i) => (
                  <motion.tr key={st.id}
                    className={`border-b border-white/[0.04] ${i % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: visibleRows > i ? 1 : 0, x: visibleRows > i ? 0 : -16 }}
                    transition={{ duration: 0.25 }}>
                    <td className="py-2 pr-4 text-[#f97316] font-bold">{st.id}</td>
                    <td className="py-2 pr-4 text-white">{st.angle}°</td>
                    <td className="py-2 pr-4 text-cyan-400">⌀{st.od}mm</td>
                    <td className="py-2 pr-4 text-cyan-400">⌀{st.od - 2}mm</td>
                    <td className="py-2 pr-4 text-white">{st.w}mm</td>
                    <td className="py-2 pr-4 text-amber-400">{st.shaft}</td>
                    <td className="py-2 pr-4">
                      <span className="px-2 py-0.5 bg-[#f97316]/10 border border-[#f97316]/30 rounded text-[#f97316] text-[10px]">{st.bearing}</span>
                    </td>
                    <td className="py-2 pr-4 text-green-400 text-[10px]">D2 Tool Steel 60HRC</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {/* Roll cross-section graphic */}
            <motion.div className="mt-6 p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: visibleRows >= STATIONS.length ? 1 : 0, y: visibleRows >= STATIONS.length ? 0 : 20 }}
              transition={{ duration: 0.6 }}>
              <div className="text-[10px] font-mono text-zinc-400 mb-3">Progressive Bend Cross-Section — Flower Diagram</div>
              <svg viewBox="0 0 720 90" className="w-full">
                {STATIONS.map((st, i) => {
                  const cx = 45 + i * 88;
                  const rad = (st.angle * Math.PI) / 180;
                  const webW = 30;
                  const flangeL = 22;
                  const fx = Math.cos(Math.PI / 2 - rad) * flangeL;
                  const fy = Math.sin(Math.PI / 2 - rad) * flangeL;
                  return (
                    <g key={st.id}>
                      {/* Web */}
                      <line x1={cx - webW / 2} y1="50" x2={cx + webW / 2} y2="50" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                      {/* Left flange */}
                      <line x1={cx - webW / 2} y1="50" x2={cx - webW / 2 - fx} y2={50 - fy} stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
                      {/* Right flange */}
                      <line x1={cx + webW / 2} y1="50" x2={cx + webW / 2 + fx} y2={50 - fy} stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
                      {/* Angle label */}
                      <text x={cx} y="78" textAnchor="middle" fill="#f59e0b" fontSize="8" fontFamily="monospace">{st.angle}°</text>
                      {/* Station label */}
                      <text x={cx} y="88" textAnchor="middle" fill="#52525b" fontSize="7" fontFamily="monospace">{st.id}</text>
                      {/* Connector */}
                      {i < STATIONS.length - 1 && <line x1={cx + 44} y1="50" x2={cx + 47} y2="50" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />}
                    </g>
                  );
                })}
              </svg>
            </motion.div>

            {/* Footer stamp */}
            <motion.div className="mt-4 flex items-center justify-between text-[9px] font-mono text-zinc-600"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }}>
              <span>Generated by SAI Rolotech Smart Engines v2.2.6 — All calculations verified</span>
              <span className="text-[#f97316]/60">CONFIDENTIAL — For client use only</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Scene 5: CLOSING
function Scene5() {
  const steps = [
    { icon: FileCode, label: "DXF Drawing" },
    { icon: Layers, label: "Flower Pattern" },
    { icon: Settings, label: "Roll Tooling" },
    { icon: Code, label: "G-Code Output" }
  ];

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-12 text-center"
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, filter: "blur(20px)" }}
      transition={{ duration: 1.5, ease: defaultEase }}
    >
      <div className="flex items-center justify-center gap-4 md:gap-8 mb-16 w-full max-w-4xl">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.2 }}
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 relative overflow-hidden group">
                <div className="absolute inset-0 bg-[#f97316]/20 translate-y-full group-hover:translate-y-0 transition-transform" />
                <step.icon className="w-8 h-8 md:w-10 md:h-10 text-[#f97316] relative z-10" />
              </div>
              <div className="text-xs md:text-sm font-mono text-[#71717a] uppercase">{step.label}</div>
            </motion.div>
            
            {i < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: 0.7 + i * 0.2 }}
                className="flex-1 h-px bg-gradient-to-r from-transparent via-[#f97316]/50 to-transparent relative"
              >
                <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-[#f97316]" />
              </motion.div>
            )}
          </React.Fragment>
        ))}
      </div>

      <motion.h1
        className="text-5xl md:text-7xl font-bold mb-4 tracking-tight"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, ease: defaultEase }}
      >
        Complete in{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#f59e0b]">
          Under 2 Minutes
        </span>
      </motion.h1>
      
      <motion.p
        className="text-xl md:text-2xl text-[#71717a] mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        What takes engineers 2 days — done instantly.
      </motion.p>

      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 3 }}
      >
        <motion.div
          className="flex items-center gap-3 px-5 py-2 rounded-full mb-2"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 3.2, ...springSnappy }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-emerald-400 font-bold">50,000+ PROFILES TESTED · 99.7% ACCURACY CERTIFIED</span>
        </motion.div>

        <div className="text-2xl font-bold uppercase tracking-widest text-white">SAI Rolotech</div>
        <div className="text-[#f97316] font-mono">www.sairolotech.com | info@sairolotech.com</div>
        
        <motion.div
          className="mt-6 px-8 py-4 bg-[#f97316] text-black font-bold uppercase tracking-widest rounded-full relative overflow-hidden"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="absolute inset-0 bg-white/30 skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]" />
          Visit www.sairolotech.com
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Benchmark data ──────────────────────────────────────────────────────────
const BENCH = [
  { name: "Manual\nCalculation", hrs: 48, cost: "Free", color: "#71717a", tag: "Error prone" },
  { name: "AutoCAD\n+ Excel", hrs: 16, cost: "$8,000/yr", color: "#f59e0b", tag: "Slow & manual" },
  { name: "COPRA RF", hrs: 4, cost: "$45,000", color: "#6366f1", tag: "Expensive" },
  { name: "Profil\nSoftware", hrs: 3, cost: "$35,000", color: "#8b5cf6", tag: "Complex" },
  { name: "SAI ROLOTECH\nSMART ENGINES", hrs: 0.5, cost: "₹999/mo", color: "#f97316", tag: "50K+ Tested ✓" },
];
const FEATURES = [
  { label: "Auto Flower Pattern",    support: [false, false, true,  true,  true ] },
  { label: "Roll OD/ID Calc",        support: [true,  true,  true,  true,  true ] },
  { label: "G-Code Export",          support: [false, true,  true,  true,  true ] },
  { label: "3D Visualization",       support: [false, false, true,  true,  true ] },
  { label: "Springback Correction",  support: [true,  true,  true,  true,  true ] },
  { label: "Machine Spec PDF",       support: [false, false, false, false, true ] },
  { label: "Bearing Number Table",   support: [false, false, false, false, true ] },
  { label: "Offline AI Assistant",   support: [false, false, false, false, true ] },
  { label: "Hindi / Urdu UI",        support: [false, false, false, false, true ] },
  { label: "Android Mobile App",     support: [false, false, false, false, true ] },
  { label: "Affordable Pricing",     support: [true,  false, false, false, true ] },
];

// Scene 7: BENCHMARK — SAI Rolotech vs World
function Scene7() {
  const [phase, setPhase] = React.useState(0);

  React.useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 5500);
    const t3 = setTimeout(() => setPhase(3), 10500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const maxHrs = 48;

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* bg */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.06),transparent_70%)]" />
      <div className="absolute inset-0 opacity-[0.015]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.5) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.5) 40px)" }} />

      {/* Phase 0 → heading */}
      <motion.div className="text-center mb-6 px-6 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7 }}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#f97316]/30 bg-[#f97316]/10 text-[#f97316] text-xs font-mono tracking-widest uppercase mb-3">
          ⚡ Competitive Benchmark Analysis
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          SAI Rolotech vs{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#f59e0b]">
            The World
          </span>
        </h2>
        <p className="text-zinc-500 text-sm mt-1 font-mono">Time to complete full roll forming design — hours</p>
      </motion.div>

      {/* Phase 1 → Bar Chart */}
      <AnimatePresence>
        {phase >= 1 && phase < 3 && (
          <motion.div key="bars"
            className="relative z-10 w-full max-w-3xl px-6 mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}>
            <div className="flex items-end justify-center gap-4 md:gap-6 h-44">
              {BENCH.map((b, i) => {
                const pct = (b.hrs / maxHrs) * 100;
                const isSai = i === BENCH.length - 1;
                return (
                  <motion.div key={b.name} className="flex flex-col items-center gap-1 flex-1 max-w-[110px]">
                    {/* Time label */}
                    <motion.div
                      className={`text-xs font-bold font-mono ${isSai ? "text-[#f97316]" : "text-zinc-400"}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 + i * 0.15 }}>
                      {b.hrs}h
                    </motion.div>
                    {/* Bar */}
                    <div className="w-full flex items-end" style={{ height: 120 }}>
                      <motion.div
                        className="w-full rounded-t-lg relative overflow-hidden"
                        style={{ background: isSai ? `linear-gradient(to top, ${b.color}, #fbbf24)` : b.color, minHeight: 4 }}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(pct, 2)}%` }}
                        transition={{ delay: 0.5 + i * 0.15, duration: 0.9, ease: defaultEase }}>
                        {isSai && (
                          <motion.div className="absolute inset-0 bg-white/20"
                            animate={{ opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 1.5, repeat: Infinity }} />
                        )}
                      </motion.div>
                    </div>
                    {/* Name */}
                    <motion.div
                      className={`text-center text-[9px] md:text-[10px] font-mono leading-tight whitespace-pre-line ${isSai ? "text-[#f97316] font-bold" : "text-zinc-500"}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1 + i * 0.15 }}>
                      {b.name}
                    </motion.div>
                    {/* Tag */}
                    <motion.div
                      className={`text-[8px] font-mono px-1.5 py-0.5 rounded-full ${isSai ? "bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/40" : "bg-white/5 text-zinc-600"}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 + i * 0.15 }}>
                      {b.tag}
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            {/* Cost comparison row */}
            <motion.div className="mt-5 grid grid-cols-5 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5 }}>
              {BENCH.map((b, i) => (
                <div key={i} className={`text-center text-[10px] font-mono p-2 rounded-lg ${i === BENCH.length - 1 ? "bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316] font-bold" : "bg-white/[0.03] text-zinc-500"}`}>
                  {b.cost}
                </div>
              ))}
            </motion.div>
            <div className="text-center text-[9px] text-zinc-600 font-mono mt-1">Annual software cost</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2 → Feature Matrix */}
      <AnimatePresence>
        {phase >= 2 && phase < 3 && (
          <motion.div key="matrix"
            className="relative z-10 w-full max-w-4xl px-6 overflow-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}>
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr>
                  <th className="text-left pb-2 text-zinc-500 font-medium w-44">Feature</th>
                  {BENCH.map((b, i) => (
                    <th key={i} className={`pb-2 text-center whitespace-pre-line text-[9px] leading-tight ${i === BENCH.length - 1 ? "text-[#f97316]" : "text-zinc-600"}`}>
                      {b.name.split("\n")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f, fi) => (
                  <motion.tr key={f.label}
                    className="border-b border-white/[0.04]"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: fi * 0.08, duration: 0.3 }}>
                    <td className="py-1.5 text-zinc-400 pr-4">{f.label}</td>
                    {f.support.map((has, ci) => (
                      <td key={ci} className="py-1.5 text-center">
                        {has
                          ? <span className={ci === f.support.length - 1 ? "text-[#f97316]" : "text-green-500"}>✓</span>
                          : <span className="text-zinc-700">—</span>}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 3 → Winner screen */}
      <AnimatePresence>
        {phase >= 3 && (
          <motion.div key="winner"
            className="absolute inset-0 flex flex-col items-center justify-center z-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: defaultEase }}>
            <div className="absolute inset-0 bg-[#04060e]/80 backdrop-blur-sm" />
            <div className="relative z-10 text-center px-8">
              <motion.div className="text-7xl mb-6" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}>🏆</motion.div>
              <motion.h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-3"
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#f59e0b]">
                  96× Faster.
                </span>
                <br />97% Cheaper.
              </motion.h1>
              <motion.p className="text-zinc-400 text-lg mb-8 font-mono"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                vs Manual Calculation — SAI Rolotech Smart Engines v2.2.6
              </motion.p>
              <motion.div className="flex flex-wrap items-center justify-center gap-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
                {["50,000+ Profiles Tested", "99.7% Accuracy Certified", "₹999/month only", "96× Faster Than Manual", "www.sairolotech.com"].map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#f97316]/10 border border-[#f97316]/30 text-[#f97316] text-xs font-mono">
                    <span className="text-green-400">✓</span> {s}
                  </div>
                ))}
              </motion.div>
              <motion.div className="mt-10 text-2xl font-bold text-white uppercase tracking-widest"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                SAI Rolotech · www.sairolotech.com
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
