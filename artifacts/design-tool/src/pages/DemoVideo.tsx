import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cog, FileCode2, Layers, Cpu, Zap, Star, Shield, BarChart3, GitBranch, ChevronRight, CheckCircle2 } from 'lucide-react';

const COLORS = {
  primary: '#f59e0b',
  accent: '#06b6d4',
  secondary: '#a78bfa',
  bg: '#04060e',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.1)',
  textMain: '#ffffff',
  textMuted: '#9ca3af',
  success: '#22c55e',
};

const SCENE_DURATION = 6000;
const TOTAL_SCENES = 10;

export default function DemoVideo() {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    // Inject fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentScene((prev) => (prev + 1) % TOTAL_SCENES);
    }, SCENE_DURATION);
    return () => clearInterval(timer);
  }, []);

  const styles = {
    container: {
      width: '100%',
      height: '100%',
      background: COLORS.bg,
      overflow: 'hidden',
      position: 'relative' as const,
      fontFamily: "'Space Grotesk', sans-serif",
      color: COLORS.textMain,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  };

  return (
    <div style={styles.container}>
      {/* Background Ambient Layers */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none' }}>
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '80vw', height: '80vh', background: `radial-gradient(circle, ${COLORS.primary}20 0%, transparent 70%)`
        }} />
      </div>
      
      {/* Dynamic Background elements outside AnimatePresence for continuity */}
      <motion.div
        animate={{
          scale: currentScene % 2 === 0 ? 1 : 1.1,
          opacity: currentScene === 0 ? 0.3 : 0.1
        }}
        transition={{ duration: 6, ease: "linear" }}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(circle at 80% 20%, rgba(6,182,212,0.1) 0%, transparent 50%)'
        }}
      />
      
      {/* Scene Content */}
      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 10 }}>
        <AnimatePresence mode="wait">
          {currentScene === 0 && <Scene1Intro key="scene-1" />}
          {currentScene === 1 && <Scene2Dxf key="scene-2" />}
          {currentScene === 2 && <Scene3Flower key="scene-3" />}
          {currentScene === 3 && <Scene4Roll key="scene-4" />}
          {currentScene === 4 && <Scene5GCode key="scene-5" />}
          {currentScene === 5 && <Scene6Accuracy key="scene-6" />}
          {currentScene === 6 && <Scene7Machine key="scene-7" />}
          {currentScene === 7 && <Scene8Features key="scene-8" />}
          {currentScene === 8 && <Scene9Pipeline key="scene-9" />}
          {currentScene === 9 && <Scene10Benchmark key="scene-10" />}
        </AnimatePresence>
      </div>

      {/* Progress Bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', zIndex: 20 }}>
        <motion.div
          key={currentScene}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: SCENE_DURATION / 1000, ease: 'linear' }}
          style={{ height: '100%', background: COLORS.primary }}
        />
      </div>
    </div>
  );
}

// SCENE 1: INTRO
function Scene1Intro() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }} transition={{ duration: 0.8 }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div
        initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
        style={{ marginBottom: '2rem' }}
      >
        <div style={{ position: 'relative' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 10, ease: "linear" }}>
            <Cog size={120} color={COLORS.primary} strokeWidth={1} />
          </motion.div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `2px solid ${COLORS.primary}` }} />
          </div>
        </div>
      </motion.div>
      <motion.h1 
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}
        style={{ fontSize: '3rem', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 1rem 0', color: '#fff' }}
      >
        AI-Driven Precision Roll Forming
      </motion.h1>
      <motion.div 
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }}
        style={{ display: 'flex', gap: '1rem', color: COLORS.textMuted, fontSize: '1.2rem', fontFamily: "'JetBrains Mono', monospace" }}
      >
        <span>v2.2.20</span>
        <span>·</span>
        <span>7 Modules</span>
        <span>·</span>
        <span style={{ color: COLORS.accent }}>500+ Profiles</span>
      </motion.div>
    </motion.div>
  );
}

// SCENE 2: DXF IMPORT
function Scene2Dxf() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.6 }} style={{ width: '100%', height: '100%', padding: '4rem', display: 'flex', alignItems: 'center', gap: '4rem' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <motion.div 
          initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', delay: 0.2 }}
          style={{ width: '140px', height: '180px', border: `2px dashed ${COLORS.accent}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,182,212,0.05)' }}
        >
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
            <FileCode2 size={48} color={COLORS.accent} style={{ marginBottom: '1rem' }} />
          </motion.div>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: '1rem', color: COLORS.accent }}>.dxf</span>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 }} style={{ background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, padding: '1.5rem', borderRadius: '12px', fontFamily: "'JetBrains Mono'" }}>
          <div style={{ color: COLORS.textMuted, marginBottom: '1rem', fontSize: '0.9rem' }}>PARSED DATA</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Type:</span> <span style={{ color: COLORS.primary }}>C-Purlin</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Width:</span> <span>150mm</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Flanges:</span> <span>50mm</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>t:</span> <span>2.0mm</span></div>
        </motion.div>
      </div>
      <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '24px', padding: '3rem', border: '1px solid rgba(255,255,255,0.05)' }}>
        <svg viewBox="0 0 300 200" style={{ width: '100%', maxWidth: '500px' }}>
          {/* Grid */}
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
          <rect width="300" height="200" fill="url(#grid)" />
          
          <motion.path 
            d="M 50 150 L 50 50 L 250 50 L 250 150" 
            fill="none" stroke={COLORS.primary} strokeWidth="4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
          />
          <motion.path 
            d="M 40 150 L 40 40 L 260 40 L 260 150" 
            fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
          />
          {/* Dimensions */}
          <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }} x="150" y="30" fill={COLORS.textMuted} fontSize="12" textAnchor="middle" fontFamily="JetBrains Mono">150mm</motion.text>
          <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }} x="30" y="100" fill={COLORS.textMuted} fontSize="12" textAnchor="middle" transform="rotate(-90 30,100)" fontFamily="JetBrains Mono">50mm</motion.text>
        </svg>
      </div>
    </motion.div>
  );
}

// SCENE 3: FLOWER PATTERN
function Scene3Flower() {
  const angles = ['0°', '15°', '35°', '55°', '75°', '90°'];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }} style={{ width: '100%', height: '100%', padding: '4rem', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '4rem' }}>
        <Layers size={32} color={COLORS.primary} />
        <h2 style={{ fontSize: '2rem', margin: 0 }}>Flower Pattern Generator</h2>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, padding: '0 2rem' }}>
        {angles.map((angle, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 50, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.5 + 0.2, type: 'spring' }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div style={{ height: '180px', width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: `2px solid ${COLORS.surfaceBorder}`, position: 'relative' }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', overflow: 'visible' }}>
                <motion.path
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: i * 0.5 + 0.5, duration: 1 }}
                  d={`M 10 ${90 - i * 12} L 30 ${90 - i * 8} L 70 ${90 - i * 8} L 90 ${90 - i * 12}`}
                  fill="none" stroke={i === angles.length - 1 ? COLORS.primary : COLORS.accent} strokeWidth="3"
                />
              </svg>
              {i < angles.length - 1 && (
                <div style={{ position: 'absolute', right: '-50%', top: '50%', transform: 'translateY(-50%)', color: COLORS.surfaceBorder }}>
                  <ChevronRight size={24} />
                </div>
              )}
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.5 + 1.2 }} style={{ marginTop: '1.5rem', fontFamily: "'JetBrains Mono'", fontSize: '1.2rem', color: i === angles.length - 1 ? COLORS.primary : '#fff' }}>
              {angle}
            </motion.div>
            <div style={{ fontSize: '0.9rem', color: COLORS.textMuted, marginTop: '0.5rem', fontFamily: "'JetBrains Mono'" }}>STN {i+1}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// SCENE 4: ROLL TOOLING
function Scene4Roll() {
  return (
    <motion.div initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} style={{ width: '100%', height: '100%', display: 'flex', padding: '4rem', gap: '4rem' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem', fontWeight: 300 }}>Roll Tooling Specification</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
          {['120mm', '126mm', '134mm'].map((od, i) => (
            <motion.div 
              key={i}
              initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.3 + 0.5, type: 'spring' }}
              style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '1.8rem', fontFamily: "'JetBrains Mono'", background: COLORS.surface, padding: '1rem', borderRadius: '12px', border: `1px solid ${COLORS.surfaceBorder}` }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: `2px solid ${COLORS.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLORS.accent }} />
              </div>
              OD: <span style={{ color: COLORS.primary }}>{od}</span>
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} style={{ marginTop: '1rem', color: COLORS.textMuted, fontFamily: "'JetBrains Mono'", fontSize: '1.2rem' }}>
            Shaft: ⌀42mm solid steel
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }} style={{ background: 'rgba(245,158,11,0.05)', border: `1px solid ${COLORS.primary}40`, padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ fontFamily: "'JetBrains Mono'", color: COLORS.primary, marginBottom: '1rem', fontSize: '0.9rem', letterSpacing: '0.1em' }}>BOM EXPORT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontFamily: "'JetBrains Mono'" }}>
            <div><span style={{ color: '#fff', fontSize: '1.5rem' }}>16</span> rolls</div>
            <div><span style={{ color: '#fff', fontSize: '1.5rem' }}>8</span> shafts</div>
            <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#fff', fontSize: '1.5rem' }}>16</span> bearings 6308</div>
          </div>
        </motion.div>
      </div>
      
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Abstract Roll Visualization */}
        <motion.div 
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          style={{ width: '400px', height: '400px', borderRadius: '50%', border: `1px solid rgba(255,255,255,0.05)`, position: 'relative' }}
        >
          <div style={{ position: 'absolute', inset: '40px', borderRadius: '50%', border: `2px solid ${COLORS.primary}`, opacity: 0.5 }} />
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4 }} style={{ position: 'absolute', inset: '80px', borderRadius: '50%', border: `4px solid ${COLORS.accent}`, boxShadow: `0 0 30px ${COLORS.accent}40` }} />
          <div style={{ position: 'absolute', inset: '140px', borderRadius: '50%', border: `1px dashed rgba(255,255,255,0.3)` }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '60px', height: '60px', background: '#111', borderRadius: '50%', transform: 'translate(-50%, -50%)', border: `8px solid #333`, boxShadow: 'inset 0 0 10px #000' }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

// SCENE 5: G-CODE
function Scene5GCode() {
  const code = [
    "N010 G90 G21",
    "N020 G28 U0",
    "N030 T0101 M03 S350",
    "N040 G00 X120.000 Z0.000",
    "N050 G01 X120.000 Z-5.000 F0.2",
    "N060 G01 X126.000 Z-10.000",
    "N070 G02 X134.000 Z-15.000 R4.0",
    "N080 G01 X134.000 Z-25.000"
  ];
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.1 }} transition={{ duration: 0.5 }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' }}>
      <div style={{ width: '80%', height: '80%', background: '#0a0a0f', borderRadius: '12px', border: `1px solid #222`, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}>
        <div style={{ height: '40px', background: '#111', display: 'flex', alignItems: 'center', padding: '0 1.5rem', gap: '0.8rem', borderBottom: '1px solid #222' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#eab308' }} />
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e' }} />
          <div style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#888', fontFamily: "'JetBrains Mono'" }}>cnc_export.tap</div>
          <div style={{ marginLeft: 'auto' }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.success, fontSize: '0.8rem', fontFamily: "'JetBrains Mono'" }}>
              <CheckCircle2 size={14} /> Safety Check Passed
            </motion.div>
          </div>
        </div>
        <div style={{ padding: '3rem', fontFamily: "'JetBrains Mono'", fontSize: '1.5rem', lineHeight: '2', color: '#a3be8c' }}>
          {code.map((line, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.4 }}
            >
              <span style={{ color: '#5c6370', marginRight: '1.5rem', display: 'inline-block', width: '50px' }}>{String(i + 1).padStart(2, '0')}</span>
              {line.split(' ').map((part, j) => (
                <span key={j} style={{ color: part.startsWith('G') || part.startsWith('M') ? COLORS.accent : part.startsWith('X') || part.startsWith('Z') ? COLORS.primary : 'inherit' }}>
                  {part}{' '}
                </span>
              ))}
            </motion.div>
          ))}
          <motion.div 
            animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}
            style={{ display: 'inline-block', width: '14px', height: '28px', background: COLORS.success, verticalAlign: 'middle', marginTop: '1rem' }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// SCENE 6: ACCURACY
function Scene6Accuracy() {
  const ratings = [
    { label: "Strip Width", stars: 5 },
    { label: "Roll Gap", stars: 5 },
    { label: "Bearing", stars: 5 },
    { label: "Springback", stars: 4 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.8 }} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '4rem', fontWeight: 300 }}>Quality Validation</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', width: '80%', maxWidth: '1000px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {ratings.map((r, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.3 + 0.3, type: 'spring' }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.2rem', background: COLORS.surface, padding: '1.5rem 2rem', borderRadius: '12px', border: `1px solid ${COLORS.surfaceBorder}` }}
            >
              <span>{r.label}</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[...Array(5)].map((_, j) => (
                  <motion.div key={j} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.3 + j * 0.1 + 0.6 }}>
                    <Star size={24} fill={j < r.stars ? COLORS.primary : 'none'} color={j < r.stars ? COLORS.primary : COLORS.surfaceBorder} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle, ${COLORS.primary}15 0%, transparent 70%)` }}>
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 2, bounce: 0.5 }}>
            <CheckCircle2 size={100} color={COLORS.success} style={{ marginBottom: '2rem' }} />
          </motion.div>
          <div style={{ fontSize: '1.2rem', color: COLORS.textMuted, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Overall Accuracy</div>
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.5 }}
            style={{ fontSize: '6rem', fontWeight: 700, color: COLORS.primary, lineHeight: 1, textShadow: `0 0 40px ${COLORS.primary}40` }}
          >
            99.7%
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// SCENE 7: MACHINE SPEC
function Scene7Machine() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.8 }} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}
        style={{ background: 'linear-gradient(145deg, #1f2937 0%, #111827 100%)', border: `1px solid ${COLORS.primary}40`, borderRadius: '24px', padding: '4rem', width: '700px', boxShadow: `0 30px 60px rgba(0,0,0,0.6), inset 0 1px 0 ${COLORS.primary}40` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
          <Zap size={40} color={COLORS.primary} />
          <h2 style={{ fontSize: '2.2rem', margin: 0, fontWeight: 400 }}>Motor Specification</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', fontFamily: "'JetBrains Mono'", marginBottom: '3rem' }}>
          <div>
            <div style={{ color: COLORS.textMuted, fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Power</div>
            <div style={{ fontSize: '2rem', color: COLORS.textMain }}>15 kW</div>
            <div style={{ fontSize: '1rem', color: COLORS.primary, marginTop: '0.2rem' }}>IEC 160L</div>
          </div>
          <div>
            <div style={{ color: COLORS.textMuted, fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Motor Speed</div>
            <div style={{ fontSize: '2rem', color: COLORS.textMain }}>1440 rpm</div>
          </div>
          <div>
            <div style={{ color: COLORS.textMuted, fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Gearbox</div>
            <div style={{ fontSize: '2rem', color: COLORS.textMain }}>31.5:1</div>
          </div>
          <div>
            <div style={{ color: COLORS.textMuted, fontSize: '1rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Output Speed</div>
            <div style={{ fontSize: '2.5rem', color: COLORS.accent }}>45.7 rpm</div>
          </div>
        </div>

        <div style={{ marginTop: '3rem', padding: '2rem', background: 'rgba(0,0,0,0.3)', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontFamily: "'JetBrains Mono'" }}>
            <span style={{ color: COLORS.textMuted, fontSize: '1.2rem' }}>Line Speed</span>
            <span style={{ color: COLORS.primary, fontSize: '1.2rem', fontWeight: 'bold' }}>20 m/min</span>
          </div>
          <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
            <motion.div 
              initial={{ width: 0 }} animate={{ width: '75%' }} transition={{ duration: 2, delay: 1, ease: 'easeOut' }}
              style={{ height: '100%', background: `linear-gradient(90deg, ${COLORS.primary} 0%, #fbbf24 100%)`, borderRadius: '6px', boxShadow: `0 0 20px ${COLORS.primary}` }}
            />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// SCENE 8: SPECIAL FUNCTIONS
function Scene8Features() {
  const features = [
    { icon: <Shield size={40} />, title: "AI Risk Engine" },
    { icon: <Cpu size={40} />, title: "Gemini 3.1 Pro" },
    { icon: <FileCode2 size={40} />, title: "G-Code Export" },
    { icon: <GitBranch size={40} />, title: "Offline 7/7 Modules" }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h2 style={{ fontSize: '3rem', marginBottom: '5rem', fontWeight: 300 }}>Special Functions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
        {features.map((f, i) => (
          <motion.div 
            key={i}
            initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ delay: i * 0.3 + 0.2, type: 'spring', damping: 15 }}
            style={{ 
              width: '380px', height: '140px', 
              background: `linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(6,182,212,0.15) 100%)`, 
              border: `1px solid rgba(167,139,250,0.4)`, 
              borderRadius: '20px', display: 'flex', alignItems: 'center', padding: '0 2.5rem', gap: '2rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}
          >
            <div style={{ color: COLORS.secondary, padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>{f.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 500, color: '#fff' }}>{f.title}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// SCENE 9: PIPELINE
function Scene9Pipeline() {
  const steps = ["Profile Input", "Flower AI", "Roll Tooling", "G-Code", "PDF Report"];
  return (
    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.8 }} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 4rem' }}>
      <h2 style={{ fontSize: '2.5rem', marginBottom: '6rem', fontWeight: 300 }}>Automated Workflow</h2>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '1200px' }}>
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <motion.div 
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.4 + 0.2, type: 'spring' }}
              style={{ 
                padding: '2rem 2.5rem', background: i === 1 ? COLORS.primary : COLORS.surface, 
                color: i === 1 ? '#000' : '#fff', borderRadius: '12px', border: i !== 1 ? `1px solid ${COLORS.surfaceBorder}` : 'none',
                fontWeight: 600, fontSize: '1.3rem', textAlign: 'center', flexShrink: 0,
                boxShadow: i === 1 ? `0 0 30px ${COLORS.primary}60` : 'none'
              }}
            >
              {step}
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div 
                initial={{ width: 0, opacity: 0 }} animate={{ width: '60px', opacity: 1 }} transition={{ delay: i * 0.4 + 0.4 }}
                style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}
              >
                <ChevronRight color={COLORS.accent} size={48} />
              </motion.div>
            )}
          </React.Fragment>
        ))}
      </div>
    </motion.div>
  );
}

// SCENE 10: BENCHMARK
function Scene10Benchmark() {
  const [val, setVal] = useState(96.0);
  
  useEffect(() => {
    let current = 96.0;
    const interval = setInterval(() => {
      current += 0.1;
      if (current >= 99.7) {
        setVal(99.7);
        clearInterval(interval);
      } else {
        setVal(current);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: 'blur(20px)' }} transition={{ duration: 1 }} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)` }}>
      <motion.div 
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
        style={{ fontSize: '10rem', fontWeight: 700, color: COLORS.primary, lineHeight: 1, marginBottom: '2rem', fontFamily: "'Space Grotesk'", textShadow: `0 0 60px ${COLORS.primary}80` }}
      >
        {val.toFixed(1)}%
      </motion.div>
      <motion.div 
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 2.5 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', color: COLORS.textMuted, fontSize: '1.5rem', letterSpacing: '0.05em' }}
      >
        <span style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 300 }}>Precision Accuracy</span>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontFamily: "'JetBrains Mono'", fontSize: '1.2rem' }}>
          <span style={{ color: COLORS.accent }}>500+ Profiles Validated</span>
          <span>·</span>
          <span>ASTM A653 Reference</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
