import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIG ---
const SCENE_DURATIONS = [
  12000, // Scene 0: Opening (0:00–0:12)
  18000, // Scene 1: Input (0:12–0:30)
  35000, // Scene 2: Engineering Core (0:30–1:05)
  30000, // Scene 3: Manufacturing Outputs (1:05–1:35)
  17000, // Scene 4: Simulation + Proof (1:35–1:52)
  8000,  // Scene 5: Close (1:52–2:00)
];

const COLORS = {
  bg: '#070D17',
  accent: '#F0A500',
  text: '#FFFFFF',
  panel: '#111827',
};

// --- SUBS ---
const SUBTITLES = [
  // Scene 0
  [{ time: 0, text: "SAI Rolotech Smart Engines — a near COPRA-class roll-forming engineering platform." },
   { time: 6000, text: "Designed for precision. Built for production." }],
  // Scene 1
  [{ time: 12000, text: "Start by selecting your material — Galvanised Steel DX51D — and defining the section profile." },
   { time: 18000, text: "A lipped channel, 2 millimetre thick, 120 millimetres wide." },
   { time: 24000, text: "Load a saved project or enter parameters directly." }],
  // Scene 2
  [{ time: 30000, text: "The station engine calculates 13 forming passes, distributing bend angle incrementally across each station." },
   { time: 38000, text: "Watch the flower progression unfold — each pass bringing the flat strip closer to the final profile." },
   { time: 48000, text: "Roll contour is generated automatically — upper and lower rolls matched to the strip geometry." },
   { time: 56000, text: "Springback correction applied per pass. Force, power and torque calculated at each station." }],
  // Scene 3
  [{ time: 65000, text: "Bend allowance and flat blank width — calculated instantly." },
   { time: 70000, text: "Bill of Materials generated with shaft, bearing and roll specifications." },
   { time: 77000, text: "Process card ready for the shop floor." },
   { time: 82000, text: "Tooling library saves your roll sets for reuse." },
   { time: 88000, text: "Export to DXF, STEP, or a full CAD pack — one click." }],
  // Scene 4
  [{ time: 95000, text: "Advanced Process Simulation Precheck — pass-by-pass stress, strain and contact analysis." },
   { time: 103000, text: "Defect probability, fracture risk, wrinkling and edge wave flags — all instant." },
   { time: 110000, text: "FEA-ready solver decks generated for CalculiX and Abaqus when you need full simulation." }],
  // Scene 5
  [{ time: 112000, text: "720 automated tests. 29 engine modules. 45 live API endpoints." },
   { time: 116000, text: "SAI Rolotech Smart Engines — engineering-grade precision, from input to export." }]
];

// --- COMPONENTS ---
const Subtitles = ({ currentScene, elapsed }: { currentScene: number, elapsed: number }) => {
  const currentSubs = SUBTITLES[currentScene];
  if (!currentSubs) return null;

  const totalElapsed = SCENE_DURATIONS.slice(0, currentScene).reduce((a, b) => a + b, 0) + elapsed;
  const activeSub = [...currentSubs].reverse().find(s => totalElapsed >= s.time);

  return (
    <div className="absolute bottom-10 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <AnimatePresence mode="wait">
        {activeSub && (
          <motion.div
            key={activeSub.text}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-lg border border-white/10"
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

// Scene 0: Logo reveal + tagline
const Scene0 = () => {
  return (
    <motion.div className="w-full h-full flex flex-col items-center justify-center bg-[#070D17] relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
    >
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-20">
        <source src="/assets/roll-forming-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-t from-[#070D17] via-transparent to-[#070D17] opacity-80" />

      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 border-4 border-[#F0A500] flex items-center justify-center rounded-sm rotate-45">
            <div className="w-8 h-8 bg-[#F0A500] -rotate-45" />
          </div>
          <h1 className="text-8xl font-bold tracking-tighter text-white">SAI ROLOTECH</h1>
        </div>
        <div className="px-6 py-2 bg-[#F0A500]/20 border border-[#F0A500] rounded mb-12">
          <h2 className="text-[#F0A500] text-2xl font-mono tracking-widest uppercase">Smart Engines v2.3.0</h2>
        </div>
        
        <h3 className="text-4xl text-white/80 font-light tracking-wide mb-16 text-center max-w-4xl leading-tight">
          Near COPRA-class<br/>
          <span className="text-white font-bold">Roll Forming Engineering Platform</span>
        </h3>

        <div className="flex gap-12 text-center">
          {[
            { label: 'Automated Tests', value: '720' },
            { label: 'Engine Modules', value: '29' },
            { label: 'API Endpoints', value: '45' }
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
};

// Scene 1: Material + Profile Input
const Scene1 = () => {
  return (
    <motion.div className="w-full h-full flex items-center justify-center p-20 bg-[#070D17] relative overflow-hidden"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
    >
      <img src="/assets/blueprint-texture.png" className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-screen" />
      
      <div className="relative z-10 w-full max-w-7xl grid grid-cols-2 gap-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="bg-[#111827] border border-[#F0A500]/30 rounded-xl p-10 flex flex-col justify-center"
        >
          <div className="text-[#F0A500] text-xl font-mono mb-8 border-b border-[#F0A500]/20 pb-4">MATERIAL SELECTION</div>
          <h2 className="text-5xl text-white font-bold mb-10">Galvanised Steel<br/><span className="text-white/50">DX51D</span></h2>
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: 'Yield Strength (Fy)', value: '250 MPa' },
              { label: 'Strength Coeff (K)', value: '500 MPa' },
              { label: 'Strain Hardening (n)', value: '0.22' },
              { label: 'Thickness (t)', value: '2.0 mm' }
            ].map((prop, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                key={prop.label} className="bg-black/40 p-4 rounded border border-white/5"
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
          className="bg-[#111827] border border-white/10 rounded-xl p-10 flex flex-col justify-center relative overflow-hidden"
        >
          <div className="text-white/60 text-xl font-mono mb-12">PROFILE DEFINITION</div>
          <div className="flex-1 flex items-center justify-center relative">
            {/* Abstract Lipped Channel SVG */}
            <motion.svg width="80%" height="60%" viewBox="0 0 400 300" className="drop-shadow-2xl">
              <motion.path 
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut", delay: 1 }}
                d="M 50,50 L 100,50 L 100,250 L 300,250 L 300,50 L 350,50" 
                fill="none" 
                stroke="#F0A500" 
                strokeWidth="12" 
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dimension lines */}
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}>
                <line x1="100" y1="280" x2="300" y2="280" stroke="white" strokeWidth="2" opacity="0.5" />
                <text x="200" y="270" fill="white" fontSize="16" textAnchor="middle" className="font-mono">W = 120mm</text>
              </motion.g>
            </motion.svg>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

// Scene 2: Engineering Core
const Scene2 = () => {
  return (
    <motion.div className="w-full h-full flex flex-col items-center justify-center p-12 bg-[#070D17] relative"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute top-10 left-10 text-[#F0A500] font-mono text-2xl tracking-widest border-l-4 border-[#F0A500] pl-4">
        STATION ENGINE ACTIVE
      </div>
      
      <div className="w-full max-w-6xl mt-16 relative h-[60vh] flex items-center justify-center">
        {/* Flower Progression */}
        {[...Array(13)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.4 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <svg width="600" height="400" viewBox="0 0 600 400" className="overflow-visible">
              <motion.path
                d={`M ${50 + i*15},${100 + i*10} L ${150 + i*5},${350 - i*5} L ${450 - i*5},${350 - i*5} L ${550 - i*15},${100 + i*10}`}
                fill="none"
                stroke={i === 12 ? "#F0A500" : "rgba(255,255,255,0.15)"}
                strokeWidth={i === 12 ? "8" : "2"}
                className={i === 12 ? "drop-shadow-[0_0_15px_rgba(240,165,0,0.5)]" : ""}
              />
            </svg>
          </motion.div>
        ))}
      </div>

      <div className="w-full max-w-6xl mt-auto flex justify-between gap-4">
        {[...Array(13)].map((_, i) => (
          <motion.div 
            key={i}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: `${20 + (i/12)*80}%`, opacity: 1 }}
            transition={{ delay: 1 + i * 0.2 }}
            className="flex-1 bg-[#111827] border border-[#F0A500]/50 rounded-t-sm relative flex items-end p-2 min-h-[100px]"
          >
            <div className="w-full bg-[#F0A500]/80 h-full max-h-full rounded-sm" />
            <div className="absolute -bottom-8 left-0 right-0 text-center text-white/50 font-mono text-sm">
              S{i+1}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// Scene 3: Manufacturing Outputs
const Scene3 = () => {
  return (
    <motion.div className="w-full h-full flex items-center p-20 bg-[#070D17] relative"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
    >
      <img src="/assets/tooling-closeup.png" className="absolute inset-0 w-full h-full object-cover opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#070D17] via-[#070D17]/80 to-transparent" />

      <div className="relative z-10 w-full max-w-4xl">
        <h2 className="text-6xl font-bold text-white mb-16 tracking-tight">Manufacturing <span className="text-[#F0A500]">Ready</span></h2>
        
        <div className="space-y-6">
          {[
            { title: "Bill of Materials", desc: "Shaft, bearing, and roll specifications auto-generated." },
            { title: "Process Card", desc: "Shop-floor ready process documentation." },
            { title: "Tooling Library", desc: "Save and search existing roll sets." },
            { title: "One-Click CAD Export", desc: "DXF, STEP, and full assembly packs." }
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.3 }}
              className="bg-[#111827]/90 backdrop-blur border border-white/10 p-6 rounded-lg flex items-center gap-6"
            >
              <div className="w-12 h-12 rounded-full bg-[#F0A500]/20 flex items-center justify-center border border-[#F0A500]">
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
};

// Scene 4: Simulation
const Scene4 = () => {
  return (
    <motion.div className="w-full h-full flex flex-col items-center justify-center p-20 bg-[#070D17] relative"
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
        <h2 className="text-5xl font-bold text-white mb-4">Advanced Process Simulation <span className="text-[#F0A500]">Precheck</span></h2>
        <p className="text-2xl text-white/50 font-mono">FEA-READY ARCHITECTURE</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-8 w-full max-w-7xl">
        {[
          { label: "Stress Analysis", val: "PASS", color: "#10B981" },
          { label: "Wrinkling Risk", val: "WARNING", color: "#F0A500" },
          { label: "Edge Wave", val: "PASS", color: "#10B981" }
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
            <div className="text-5xl font-bold" style={{ color: stat.color }}>{stat.val}</div>
          </motion.div>
        ))}
      </div>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="mt-16 w-full max-w-7xl h-64 bg-black/40 border border-[#F0A500]/20 rounded-xl flex items-center justify-center relative overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center justify-around px-10 opacity-50">
          {[...Array(20)].map((_, i) => (
            <motion.div 
              key={i}
              initial={{ height: "10%" }}
              animate={{ height: `${Math.random() * 80 + 20}%` }}
              transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse", delay: i * 0.1 }}
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
};

// Scene 5: Close
const Scene5 = () => {
  return (
    <motion.div className="w-full h-full flex flex-col items-center justify-center bg-[#070D17] relative"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <img src="/assets/roll-forming-bg.png" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen" />
      <div className="absolute inset-0 bg-[#070D17]/60" />

      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1 }}
        className="relative z-10 text-center"
      >
        <h2 className="text-7xl font-bold text-white mb-8">SAI ROLOTECH <span className="text-[#F0A500]">SMART ENGINES</span></h2>
        <p className="text-3xl text-white/80 font-light mb-16">Engineering-grade precision. From input to export.</p>
        
        <div className="flex gap-16 justify-center">
          {[
            { label: "Tests Passing", val: "720" },
            { label: "Engine Modules", val: "29" },
            { label: "API Endpoints", val: "45" }
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 + i * 0.3 }}>
              <div className="text-5xl text-[#F0A500] font-bold font-mono mb-2">{stat.val}</div>
              <div className="text-white/50 text-sm uppercase tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export const ClientDemoVideo = () => {
  const [currentScene, setCurrentScene] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let startTime = Date.now();
    let raf: number;

    const tick = () => {
      const now = Date.now();
      setElapsed(now - startTime);
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
        {currentScene === 3 && <Scene3 key="3" />}
        {currentScene === 4 && <Scene4 key="4" />}
        {currentScene === 5 && <Scene5 key="5" />}
      </AnimatePresence>
      <Subtitles currentScene={currentScene} elapsed={elapsed} />
    </div>
  );
};

export default ClientDemoVideo;
