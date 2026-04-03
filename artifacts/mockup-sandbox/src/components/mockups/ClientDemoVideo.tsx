import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIG ---
const SCENE_DURATIONS = [
  12000, // Scene 0: Opening (0:00–0:12)
  18000, // Scene 1: Input (0:12–0:30)
  30000, // Scene 2: Flower Progression (0:30–1:00)
  25000, // Scene 2b: Roll Design (1:00–1:25)
  25000, // Scene 3: Manufacturing Outputs (1:25–1:50)
  15000, // Scene 4: Simulation + Proof (1:50–2:05)
  10000, // Scene 5: Close (2:05–2:15)
];

const COLORS = {
  bg: '#070D17',
  accent: '#F0A500',
  text: '#FFFFFF',
  panel: '#111827',
  upper: '#3B82F6',   // blue — upper roll groove
  lower: '#10B981',   // green — lower roll flat
  strip: '#F0A500',   // gold — strip cross-section
};

// --- SUBS ---
const SUBTITLES = [
  // Scene 0
  [{ time: 0,    text: "SAI Rolotech Smart Engines v2.3.0 — a near COPRA-class roll-forming platform." },
   { time: 6000, text: "Designed for precision. Built for production." }],
  // Scene 1
  [{ time: 12000, text: "Select your material — Galvanised Steel DX51D — and define the section profile." },
   { time: 18000, text: "Lipped channel, 2 mm thick, 120 mm wide. 13 forming stations calculated." },
   { time: 24000, text: "Load a saved project or enter parameters directly." }],
  // Scene 2: Flower
  [{ time: 30000, text: "The station engine distributes bend angle incrementally across each forming pass." },
   { time: 38000, text: "Flower progression unfolds — flat strip transforms into the final profile." },
   { time: 48000, text: "Each pass ratio follows an angle-based arc trajectory — not a linear scale." },
   { time: 54000, text: "Springback correction and K-factor applied per pass." }],
  // Scene 2b: Roll Design
  [{ time: 60000, text: "Roll contour generated automatically — station by station." },
   { time: 66000, text: "Upper roll groove wraps the OUTSIDE of the forming profile. Groove depth grows per pass." },
   { time: 74000, text: "Lower roll is a flat cylinder — flanges form UPWARD, away from the lower roll." },
   { time: 80000, text: "Forming gap, groove angle, and springback compensation applied per station." }],
  // Scene 3: Manufacturing
  [{ time: 85000, text: "Bend allowance and flat blank width — calculated instantly from K-factor." },
   { time: 90000, text: "Bill of Materials generated with shaft, bearing and roll specifications." },
   { time: 96000, text: "Process card ready for the shop floor. DXF, STEP, and CAD pack export — one click." }],
  // Scene 4: Simulation
  [{ time: 110000, text: "Advanced Process Simulation — pass-by-pass stress, strain, and contact analysis." },
   { time: 118000, text: "Defect probability, fracture risk, wrinkling, and edge wave — all instant." },
   { time: 124000, text: "FEA-ready solver decks generated for CalculiX and Abaqus." }],
  // Scene 5: Close
  [{ time: 125000, text: "720 automated tests. 29 engine modules. 45 live API endpoints." },
   { time: 130000, text: "SAI Rolotech Smart Engines — engineering-grade precision, from input to export." }],
];

// --- COMPONENTS ---
const Subtitles = ({ currentScene, elapsed }: { currentScene: number; elapsed: number }) => {
  const currentSubs = SUBTITLES[currentScene];
  if (!currentSubs) return null;

  const totalElapsed =
    SCENE_DURATIONS.slice(0, currentScene).reduce((a, b) => a + b, 0) + elapsed;
  const activeSub = [...currentSubs].reverse().find((s) => totalElapsed >= s.time);

  return (
    <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        {activeSub && (
          <motion.div
            key={activeSub.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-lg border border-white/10 max-w-5xl"
          >
            <p className="text-white/90 text-2xl font-mono tracking-wide text-center drop-shadow-md">
              {activeSub.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Scene 0: Logo reveal
const Scene0 = () => (
  <motion.div
    className="w-full h-full flex flex-col items-center justify-center bg-[#070D17] relative overflow-hidden"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0, scale: 1.1 }}
  >
    <div className="absolute inset-0 bg-gradient-to-t from-[#070D17] via-transparent to-[#070D17] opacity-80" />
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      className="relative z-10 flex flex-col items-center"
    >
      <div className="flex items-center gap-6 mb-8">
        <div className="w-20 h-20 border-4 border-[#F0A500] flex items-center justify-center rounded-sm rotate-45">
          <div className="w-8 h-8 bg-[#F0A500] -rotate-45" />
        </div>
        <h1 className="text-8xl font-bold tracking-tighter text-white">SAI ROLOTECH</h1>
      </div>
      <div className="px-6 py-2 bg-[#F0A500]/20 border border-[#F0A500] rounded mb-12">
        <h2 className="text-[#F0A500] text-2xl font-mono tracking-widest uppercase">
          Smart Engines v2.3.0
        </h2>
      </div>
      <h3 className="text-4xl text-white/80 font-light tracking-wide mb-16 text-center max-w-4xl leading-tight">
        Near COPRA-class
        <br />
        <span className="text-white font-bold">Roll Forming Engineering Platform</span>
      </h3>
      <div className="flex gap-12 text-center">
        {[
          { label: 'Automated Tests', value: '720' },
          { label: 'Engine Modules', value: '29' },
          { label: 'API Endpoints', value: '45' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.2 }}
            className="bg-[#111827] border border-white/10 px-8 py-6 rounded-lg min-w-[200px]"
          >
            <div className="text-[#F0A500] text-5xl font-bold mb-2 font-mono">{stat.value}</div>
            <div className="text-white/60 text-sm tracking-wider uppercase">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </motion.div>
);

// Scene 1: Material + Profile Input
const Scene1 = () => (
  <motion.div
    className="w-full h-full flex items-center justify-center p-20 bg-[#070D17] relative overflow-hidden"
    initial={{ opacity: 0, x: 100 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -100 }}
  >
    <div className="relative z-10 w-full max-w-7xl grid grid-cols-2 gap-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-[#111827] border border-[#F0A500]/30 rounded-xl p-10 flex flex-col justify-center"
      >
        <div className="text-[#F0A500] text-xl font-mono mb-8 border-b border-[#F0A500]/20 pb-4">
          MATERIAL SELECTION
        </div>
        <h2 className="text-5xl text-white font-bold mb-10">
          Galvanised Steel
          <br />
          <span className="text-white/50">DX51D</span>
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {[
            { label: 'Yield Strength (Fy)', value: '250 MPa' },
            { label: 'Strength Coeff (K)', value: '500 MPa' },
            { label: 'Strain Hardening (n)', value: '0.22' },
            { label: 'Thickness (t)', value: '2.0 mm' },
          ].map((prop, i) => (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              key={prop.label}
              className="bg-black/40 p-4 rounded border border-white/5"
            >
              <div className="text-white/40 text-xs mb-1 uppercase tracking-wider">{prop.label}</div>
              <div className="text-white text-2xl font-mono">{prop.value}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="bg-[#111827] border border-white/10 rounded-xl p-10 flex flex-col justify-center"
      >
        <div className="text-white/60 text-xl font-mono mb-12">PROFILE DEFINITION</div>
        <div className="flex-1 flex items-center justify-center">
          <motion.svg width="80%" height="60%" viewBox="0 0 400 300" className="drop-shadow-2xl">
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, ease: 'easeInOut', delay: 1 }}
              d="M 50,50 L 100,50 L 100,250 L 300,250 L 300,50 L 350,50"
              fill="none"
              stroke="#F0A500"
              strokeWidth="12"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
              <line x1="100" y1="280" x2="300" y2="280" stroke="white" strokeWidth="2" opacity="0.5" />
              <text x="200" y="270" fill="white" fontSize="16" textAnchor="middle" fontFamily="monospace">
                W = 120mm
              </text>
            </motion.g>
          </motion.svg>
        </div>
      </motion.div>
    </div>
  </motion.div>
);

// Scene 2: Flower Progression
const Scene2 = () => (
  <motion.div
    className="w-full h-full flex flex-col items-center justify-center p-12 bg-[#070D17] relative"
    initial={{ opacity: 0, scale: 1.1 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="absolute top-10 left-10 text-[#F0A500] font-mono text-2xl tracking-widest border-l-4 border-[#F0A500] pl-4">
      STATION ENGINE ACTIVE — 13 PASSES
    </div>

    <div className="w-full max-w-6xl mt-16 relative h-[55vh] flex items-center justify-center">
      {[...Array(13)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.3 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <svg width="600" height="380" viewBox="0 0 600 380" className="overflow-visible">
            {/* Angle-based arc trajectory: flanges follow sin/cos arc */}
            {(() => {
              const ratio = (i + 1) / 13;
              const th = (ratio * Math.PI) / 2;
              const W = 200, H = 100;
              const cx = 300, cy = 250;
              const leftRootX = cx - W / 2;
              const rightRootX = cx + W / 2;
              const leftTipX = leftRootX - Math.cos(th) * H;
              const leftTipY = cy - Math.sin(th) * H;
              const rightTipX = rightRootX + Math.cos(th) * H;
              const rightTipY = cy - Math.sin(th) * H;
              const d = `M ${leftTipX},${leftTipY} L ${leftRootX},${cy} L ${rightRootX},${cy} L ${rightTipX},${rightTipY}`;
              return (
                <motion.path
                  d={d}
                  fill="none"
                  stroke={i === 12 ? '#F0A500' : `rgba(255,255,255,${0.05 + i * 0.06})`}
                  strokeWidth={i === 12 ? 7 : 2}
                  className={i === 12 ? 'drop-shadow-[0_0_15px_rgba(240,165,0,0.5)]' : ''}
                />
              );
            })()}
          </svg>
        </motion.div>
      ))}
    </div>

    <div className="w-full max-w-6xl mt-auto flex justify-between gap-3">
      {[...Array(13)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: `${15 + ((i / 12) * 85)}%`, opacity: 1 }}
          transition={{ delay: 1.5 + i * 0.15 }}
          className="flex-1 bg-[#111827] border border-[#F0A500]/50 rounded-t-sm relative flex items-end p-1 min-h-[80px]"
        >
          <div className="w-full bg-[#F0A500]/70 h-full rounded-sm" />
          <div className="absolute -bottom-7 left-0 right-0 text-center text-white/50 font-mono text-xs">
            S{i + 1}
          </div>
        </motion.div>
      ))}
    </div>
  </motion.div>
);

// Roll groove SVG helper — upper roll (blue groove) + lower roll (green flat) + strip (gold)
const RollGrooveSVG = ({
  ratio,
  stationLabel,
  delay = 0,
}: {
  ratio: number;
  stationLabel: string;
  delay?: number;
}) => {
  const th = (ratio * Math.PI) / 2;
  const sinTh = Math.sin(th);
  const cosTh = Math.cos(th);

  // Strip profile dimensions (normalised for SVG)
  const W = 80;          // web width (half = 40 each side of centre)
  const H = 50;          // max flange height
  const hw = W / 2;
  const gap = 6;         // roll gap pixels
  const shoulder = 18;   // shoulder width

  // Flange tip positions at this forming angle
  const leftTipX  = -hw - cosTh * H;
  const rightTipX =  hw + cosTh * H;
  const flangeY   = -sinTh * H;   // negative = upward in SVG (y-flipped later via transform)

  // Centre of SVG
  const cx = 120, cy = 160;

  // Strip profile (displayed at pass line y=cy)
  const stripPath = `M ${cx + leftTipX},${cy + flangeY} L ${cx - hw},${cy} L ${cx + hw},${cy} L ${cx + rightTipX},${cy + flangeY}`;

  // Upper roll groove (bottom face visible, above strip)
  const grooveFloorY  = cy - gap / 2;         // web contact zone
  const grooveTopY    = cy + flangeY - gap / 2; // above flange tips
  const upperPath = [
    `M ${cx - hw - shoulder},${grooveTopY}`,
    `L ${cx - hw - shoulder},${grooveFloorY}`,
    `L ${cx - hw},${grooveFloorY}`,
    `L ${cx - hw},${grooveTopY}`,
    `L ${cx + hw},${grooveTopY}`,
    `L ${cx + hw},${grooveFloorY}`,
    `L ${cx + hw + shoulder},${grooveFloorY}`,
    `L ${cx + hw + shoulder},${grooveTopY}`,
  ].join(' ');

  // Lower roll flat surface (below strip web)
  const lowerFaceY = cy + gap / 2;
  const lowerBodyY = cy + gap / 2 + 24;
  const lowerPath = `M ${cx - hw - shoulder},${lowerFaceY} L ${cx + hw + shoulder},${lowerFaceY} L ${cx + hw + shoulder},${lowerBodyY} L ${cx - hw - shoulder},${lowerBodyY} Z`;

  const grooveDepthMM = Math.round(sinTh * 50 * 10) / 10;
  const angleDeg = Math.round(ratio * 90);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-[#111827] border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2"
    >
      <div className="text-white/50 font-mono text-sm">{stationLabel}</div>
      <svg width={240} height={200} viewBox="0 0 240 200">
        {/* Upper roll groove (blue) */}
        <path d={upperPath} fill="rgba(59,130,246,0.15)" stroke="#3B82F6" strokeWidth="2" />
        {/* Lower roll flat (green) */}
        <path d={lowerPath} fill="rgba(16,185,129,0.20)" stroke="#10B981" strokeWidth="2" />
        {/* Strip cross-section (gold) */}
        <path d={stripPath} fill="none" stroke="#F0A500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Pass line (dashed) */}
        <line x1="0" y1={cy} x2="240" y2={cy} stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
      </svg>
      <div className="flex gap-4 text-xs font-mono">
        <span className="text-[#3B82F6]">▲ UPPER</span>
        <span className="text-[#F0A500]">— STRIP</span>
        <span className="text-[#10B981]">▼ LOWER</span>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full mt-1">
        <div className="bg-black/40 rounded p-2 text-center">
          <div className="text-white/40 text-xs">Angle</div>
          <div className="text-white font-mono text-lg">{angleDeg}°</div>
        </div>
        <div className="bg-black/40 rounded p-2 text-center">
          <div className="text-white/40 text-xs">Groove</div>
          <div className="text-white font-mono text-lg">{grooveDepthMM}mm</div>
        </div>
      </div>
    </motion.div>
  );
};

// Scene 2b: Roll Design (FIXED v2.3.0)
const Scene2b = () => {
  const STATIONS = [
    { ratio: 0.15, label: 'S1 — Entry' },
    { ratio: 0.35, label: 'S4 — Pre-form' },
    { ratio: 0.60, label: 'S7 — Mid' },
    { ratio: 0.85, label: 'S11 — Late' },
    { ratio: 1.00, label: 'S13 — Final' },
  ];

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center p-10 bg-[#070D17] relative"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
    >
      <div className="absolute top-10 left-10 right-10 flex items-center justify-between">
        <div className="text-[#F0A500] font-mono text-2xl tracking-widest border-l-4 border-[#F0A500] pl-4">
          ROLL CONTOUR ENGINE — v2.3.0
        </div>
        <div className="flex gap-6 text-sm font-mono">
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 bg-[#3B82F6] inline-block rounded-sm" /> Upper Roll — Groove
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 bg-[#F0A500] inline-block rounded-sm" /> Strip Profile
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-2 bg-[#10B981] inline-block rounded-sm" /> Lower Roll — Flat
          </span>
        </div>
      </div>

      <div className="flex gap-6 mt-16 w-full max-w-7xl items-stretch">
        {STATIONS.map((st, i) => (
          <div key={st.label} className="flex-1">
            <RollGrooveSVG ratio={st.ratio} stationLabel={st.label} delay={0.4 + i * 0.35} />
          </div>
        ))}
      </div>

      {/* Fix callouts */}
      <div className="mt-8 w-full max-w-7xl grid grid-cols-3 gap-4">
        {[
          {
            label: 'Arc Trajectory Morphing',
            desc: 'Flange tip: x=root∓cos(θ)×H, y=sin(θ)×H',
            color: '#F0A500',
          },
          {
            label: 'Upper Roll — True Groove',
            desc: 'Groove depth = current flange height. Groove walls at flange roots.',
            color: '#3B82F6',
          },
          {
            label: 'Lower Roll — Flat Cylinder',
            desc: 'No groove: flanges form UPWARD, clear of lower roll surface.',
            color: '#10B981',
          },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5 + i * 0.2 }}
            className="bg-[#111827] border rounded-lg p-4"
            style={{ borderColor: item.color + '40' }}
          >
            <div className="font-mono text-sm mb-1" style={{ color: item.color }}>
              {item.label}
            </div>
            <div className="text-white/50 text-xs">{item.desc}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// Scene 3: Manufacturing Outputs
const Scene3 = () => (
  <motion.div
    className="w-full h-full flex items-center p-20 bg-[#070D17] relative"
    initial={{ opacity: 0, y: 100 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -100 }}
  >
    <div className="relative z-10 w-full max-w-4xl">
      <h2 className="text-6xl font-bold text-white mb-16 tracking-tight">
        Manufacturing <span className="text-[#F0A500]">Ready</span>
      </h2>
      <div className="space-y-6">
        {[
          { title: 'Flat Blank + Bend Allowance', desc: 'K-factor based. Instantly calculated per profile.' },
          { title: 'Bill of Materials', desc: 'Shaft, bearing, and roll specifications auto-generated.' },
          { title: 'Process Card', desc: 'Shop-floor ready process documentation with forming data.' },
          { title: 'One-Click CAD Export', desc: 'DXF, STEP, and full assembly packs ready for tooling.' },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.3 }}
            className="bg-[#111827]/90 backdrop-blur border border-white/10 p-6 rounded-lg flex items-center gap-6"
          >
            <div className="w-12 h-12 rounded-full bg-[#F0A500]/20 flex items-center justify-center border border-[#F0A500] shrink-0">
              <div className="w-4 h-4 bg-[#F0A500] rounded-sm rotate-45" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">{item.title}</h3>
              <p className="text-white/60 text-lg">{item.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </motion.div>
);

// Scene 4: Simulation
const Scene4 = () => (
  <motion.div
    className="w-full h-full flex flex-col items-center justify-center p-20 bg-[#070D17] relative"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="absolute top-0 inset-x-0 h-1 bg-[#F0A500]" />
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-16"
    >
      <h2 className="text-5xl font-bold text-white mb-4">
        Advanced Process Simulation <span className="text-[#F0A500]">Precheck</span>
      </h2>
      <p className="text-2xl text-white/50 font-mono">PASS-BY-PASS PHYSICS ENGINE</p>
    </motion.div>

    <div className="grid grid-cols-3 gap-8 w-full max-w-7xl">
      {[
        { label: 'Stress Analysis', val: 'PASS', color: '#10B981' },
        { label: 'Wrinkling Risk', val: 'WARNING', color: '#F0A500' },
        { label: 'Edge Wave', val: 'PASS', color: '#10B981' },
      ].map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 + i * 0.2 }}
          className="bg-[#111827] border border-white/10 rounded-xl p-8 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: stat.color }} />
          <div className="text-white/60 font-mono text-lg mb-6">{stat.label}</div>
          <div className="text-5xl font-bold" style={{ color: stat.color }}>
            {stat.val}
          </div>
        </motion.div>
      ))}
    </div>

    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2 }}
      className="mt-12 w-full max-w-7xl h-48 bg-black/40 border border-[#F0A500]/20 rounded-xl flex items-center justify-center relative overflow-hidden"
    >
      <div className="absolute inset-0 flex items-center justify-around px-10 opacity-50">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ height: '10%' }}
            animate={{ height: `${Math.random() * 80 + 20}%` }}
            transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse', delay: i * 0.1 }}
            className="w-4 bg-[#F0A500] rounded-sm"
          />
        ))}
      </div>
      <div className="relative z-10 bg-[#070D17] px-8 py-4 rounded border border-[#F0A500] text-[#F0A500] font-mono text-2xl">
        CALCULIX / ABAQUS DECKS READY
      </div>
    </motion.div>
  </motion.div>
);

// Scene 5: Close
const Scene5 = () => (
  <motion.div
    className="w-full h-full flex flex-col items-center justify-center bg-[#070D17] relative"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
  >
    <div className="absolute inset-0 bg-[#070D17]/60" />
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1 }}
      className="relative z-10 text-center"
    >
      <h2 className="text-7xl font-bold text-white mb-8">
        SAI ROLOTECH <span className="text-[#F0A500]">SMART ENGINES</span>
      </h2>
      <p className="text-3xl text-white/80 font-light mb-16">
        Engineering-grade precision. From input to export.
      </p>
      <div className="flex gap-16 justify-center">
        {[
          { label: 'Tests Passing', val: '720' },
          { label: 'Engine Modules', val: '29' },
          { label: 'API Endpoints', val: '45' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 + i * 0.3 }}
          >
            <div className="text-5xl text-[#F0A500] font-bold font-mono mb-2">{stat.val}</div>
            <div className="text-white/50 text-sm uppercase tracking-widest">{stat.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </motion.div>
);

export const ClientDemoVideo = () => {
  const [currentScene, setCurrentScene] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let startTime = Date.now();
    let raf: number;
    const tick = () => {
      setElapsed(Date.now() - startTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [currentScene]);

  useEffect(() => {
    const duration = SCENE_DURATIONS[currentScene];
    const timer = setTimeout(() => {
      setCurrentScene((s) => (s + 1) % SCENE_DURATIONS.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentScene]);

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative font-sans select-none">
      <AnimatePresence mode="wait">
        {currentScene === 0 && <Scene0 key="0" />}
        {currentScene === 1 && <Scene1 key="1" />}
        {currentScene === 2 && <Scene2 key="2" />}
        {currentScene === 3 && <Scene2b key="2b" />}
        {currentScene === 4 && <Scene3 key="3" />}
        {currentScene === 5 && <Scene4 key="4" />}
        {currentScene === 6 && <Scene5 key="5" />}
      </AnimatePresence>
      <Subtitles currentScene={currentScene} elapsed={elapsed} />
    </div>
  );
};

export default ClientDemoVideo;
