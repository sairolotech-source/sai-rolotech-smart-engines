import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = {
  bg: '#0a0f1a',
  gold: '#f59e0b',
  cyan: '#06b6d4',
  text: '#ffffff',
  textMuted: '#9ca3af'
};

const SCENE_DURATIONS = [
  8000,  // Scene 0: Brand Opening
  10000, // Scene 1: The Problem
  12000, // Scene 2: DXF Import
  15000, // Scene 3: Flower Pattern
  15000, // Scene 4: 3D Roll Simulation
  12000, // Scene 5: G-Code
  8000,  // Scene 6: Features
  10000, // Scene 7: CTA Closing
];

const VOICE_SCRIPTS = [
  "SAI Rolotech Smart Engines. Precision roll forming engineering since 2020.",
  "Complex roll forming profiles demand precision at every stage. One mistake costs everything.",
  "Simply import any D X F profile. Instant parsing. No manual drafting required.",
  "Automated flower pattern generation. Visualize every bend stage, from flat sheet to final profile.",
  "Full 3D roll simulation. See your machine work before manufacturing a single roll.",
  "Instant CNC G-code output. From profile to machine path in milliseconds. Ready for production.",
  "A complete engineering suite. A I assistant. D X F import. 3D visualization. G-code output. All in one platform.",
  "SAI Rolotech Smart Engines. Precision you can trust. Visit sairolotech dot com.",
];

function startAmbientMusic(ctx: AudioContext, masterGain: GainNode): () => void {
  const nodes: AudioNode[] = [];

  const osc1 = ctx.createOscillator();
  const osc1Gain = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 55;
  osc1Gain.gain.value = 0.28;
  osc1.connect(osc1Gain);
  osc1Gain.connect(masterGain);
  osc1.start();
  nodes.push(osc1);

  const osc2 = ctx.createOscillator();
  const osc2Gain = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.value = 110;
  osc2Gain.gain.value = 0.08;
  const lpFilter = ctx.createBiquadFilter();
  lpFilter.type = 'lowpass';
  lpFilter.frequency.value = 280;
  lpFilter.Q.value = 2;
  osc2.connect(osc2Gain);
  osc2Gain.connect(lpFilter);
  lpFilter.connect(masterGain);
  osc2.start();
  nodes.push(osc2);

  const osc3 = ctx.createOscillator();
  const osc3Gain = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.value = 82.5;
  osc3Gain.gain.value = 0.12;
  osc3.connect(osc3Gain);
  osc3Gain.connect(masterGain);
  osc3.start();
  nodes.push(osc3);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 0.06;
  lfo.connect(lfoGain);
  lfoGain.connect(osc1Gain.gain);
  lfo.start();
  nodes.push(lfo);

  const bufSize = ctx.sampleRate * 4;
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) nd[i] = (Math.random() * 2 - 1) * 0.6;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 90;
  nf.Q.value = 0.4;
  const ng = ctx.createGain();
  ng.gain.value = 0.025;
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(masterGain);
  noise.start();
  nodes.push(noise);

  return () => {
    nodes.forEach(n => { try { (n as OscillatorNode).stop(); } catch {} });
  };
}

function speakScene(index: number) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const text = VOICE_SCRIPTS[index];
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.82;
  utterance.pitch = 0.88;
  utterance.volume = 1.0;
  const trySpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find(v => v.lang.startsWith('en') && /male|david|alex|daniel|james/i.test(v.name)) ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en')) ||
      null;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  };
  if (window.speechSynthesis.getVoices().length > 0) trySpeak();
  else { window.speechSynthesis.onvoiceschanged = trySpeak; }
}

export default function DemoVideo() {
  const [currentScene, setCurrentScene] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const stopMusicRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const playScene = (index: number) => {
      setCurrentScene(index);
      timeout = setTimeout(() => playScene((index + 1) % SCENE_DURATIONS.length), SCENE_DURATIONS[index]);
    };
    playScene(0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!audioEnabled || isMuted) return;
    speakScene(currentScene);
    return () => { window.speechSynthesis?.cancel(); };
  }, [currentScene, audioEnabled, isMuted]);

  useEffect(() => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    masterGainRef.current.gain.setTargetAtTime(
      isMuted ? 0 : 0.45,
      audioCtxRef.current.currentTime,
      0.15
    );
    if (isMuted) window.speechSynthesis?.cancel();
    else if (audioEnabled) speakScene(currentScene);
  }, [isMuted]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      stopMusicRef.current?.();
      audioCtxRef.current?.close();
    };
  }, []);

  const enableAudio = () => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.45;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;
    stopMusicRef.current = startAmbientMusic(ctx, masterGain);
    setAudioEnabled(true);
    setTimeout(() => speakScene(currentScene), 400);
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: COLORS.bg,
      overflow: 'hidden', position: 'relative',
      fontFamily: "'JetBrains Mono', monospace", color: COLORS.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Background Video */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.2, zIndex: 0 }}>
        <video src="/assets/industrial-bg.mp4" autoPlay loop muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at center, transparent 0%, ${COLORS.bg} 100%)` }} />
      </div>

      {/* Animated Grid */}
      <motion.div
        animate={{ backgroundPosition: ['0px 0px', '100px 100px'] }}
        transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
        style={{
          position: 'absolute', inset: 0, zIndex: 1, opacity: 0.05,
          backgroundImage: `linear-gradient(${COLORS.cyan} 1px, transparent 1px), linear-gradient(90deg, ${COLORS.cyan} 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Scene Content */}
      <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 10 }}>
        <AnimatePresence mode="wait">
          {currentScene === 0 && <Scene1Intro key="s1" />}
          {currentScene === 1 && <Scene2Problem key="s2" />}
          {currentScene === 2 && <Scene3Dxf key="s3" />}
          {currentScene === 3 && <Scene4Flower key="s4" />}
          {currentScene === 4 && <Scene5RollSim key="s5" />}
          {currentScene === 5 && <Scene6GCode key="s6" />}
          {currentScene === 6 && <Scene7Features key="s7" />}
          {currentScene === 7 && <Scene8CTA key="s8" />}
        </AnimatePresence>
      </div>

      {/* Progress Bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', zIndex: 20 }}>
        <motion.div
          key={`progress-${currentScene}`}
          initial={{ width: '0%' }} animate={{ width: '100%' }}
          transition={{ duration: SCENE_DURATIONS[currentScene] / 1000, ease: 'linear' }}
          style={{ height: '100%', background: COLORS.gold }}
        />
      </div>

      {/* Scene Indicator */}
      <div style={{ position: 'absolute', bottom: '1.5vh', right: '2vw', zIndex: 21, fontSize: '0.9vw', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
        {currentScene + 1} / {SCENE_DURATIONS.length}
      </div>

      {/* Audio Enable Overlay */}
      <AnimatePresence>
        {!audioEnabled && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={enableAudio}
            style={{
              position: 'absolute', inset: 0, zIndex: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.65)', cursor: 'pointer', backdropFilter: 'blur(6px)'
            }}
          >
            <motion.div
              animate={{ scale: [0.97, 1.03, 0.97], boxShadow: [`0 0 30px ${COLORS.gold}30`, `0 0 60px ${COLORS.gold}60`, `0 0 30px ${COLORS.gold}30`] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2vh',
                background: 'rgba(10,15,26,0.9)', border: `1px solid ${COLORS.gold}50`,
                borderRadius: '2vw', padding: '4vh 6vw', textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '4vw', lineHeight: 1 }}>🔊</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5vw', color: COLORS.gold, letterSpacing: '0.1em' }}>
                CLICK TO START WITH AUDIO
              </div>
              <div style={{ fontSize: '1.1vw', color: COLORS.textMuted }}>
                Voice over + Background music
              </div>
              <div style={{ fontSize: '0.9vw', color: 'rgba(255,255,255,0.2)', marginTop: '0.5vh' }}>
                (video plays silently without audio)
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mute / Unmute Button */}
      <AnimatePresence>
        {audioEnabled && (
          <motion.button
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            onClick={() => setIsMuted(m => !m)}
            style={{
              position: 'absolute', top: '2vh', right: '2vw', zIndex: 50,
              background: isMuted ? 'rgba(245,158,11,0.1)' : 'rgba(6,182,212,0.08)',
              border: `1px solid ${isMuted ? COLORS.gold : COLORS.cyan}50`,
              borderRadius: '0.8vw', padding: '0.8vh 1.8vw', cursor: 'pointer',
              color: COLORS.text, fontSize: '1.2vw', display: 'flex', alignItems: 'center',
              gap: '0.6vw', letterSpacing: '0.1em', fontFamily: "'JetBrains Mono', monospace"
            }}
          >
            <span style={{ fontSize: '1.4vw' }}>{isMuted ? '🔇' : '🔊'}</span>
            {isMuted ? 'MUTED' : 'AUDIO ON'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// SCENE 1: Brand Opening (0-8s)
function Scene1Intro() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 1, type: 'spring', stiffness: 50 }}
        style={{ display: 'flex', alignItems: 'center', gap: '2vw', marginBottom: '2vh' }}
      >
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          style={{ width: '8vw', height: '8vw', border: `0.3vw solid ${COLORS.gold}`, borderRadius: '1vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ width: '4vw', height: '4vw', background: COLORS.gold, borderRadius: '0.5vw' }} />
        </motion.div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '10vw', margin: 0, lineHeight: 0.9, letterSpacing: '0.05em' }}>
          SAI ROLOTECH
        </h1>
      </motion.div>

      <motion.h2 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '4vw', color: COLORS.cyan, margin: '2vh 0 0 0', letterSpacing: '0.1em' }}
      >
        PRECISION ROLL FORMING ENGINEERING
      </motion.h2>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.5, duration: 1 }}
        style={{ marginTop: '4vh', fontSize: '1.5vw', color: COLORS.textMuted, letterSpacing: '0.2em' }}
      >
        SMART ENGINES V2.2.23
      </motion.div>
    </motion.div>
  );
}

// SCENE 2: The Problem (8-18s)
function Scene2Problem() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: '-10vw' }}
      transition={{ duration: 1 }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5vw' }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: -1, opacity: 0.3 }}>
        <img src="/assets/precision-machinery.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="bg" />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #0a0f1a, transparent)' }} />
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1 }}
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '5vw', textAlign: 'center', margin: '0 0 5vh 0', textShadow: '0 10px 30px rgba(0,0,0,0.8)' }}
      >
        COMPLEX ROLL FORMING REQUIRES <span style={{ color: COLORS.cyan }}>PRECISION</span> AT EVERY STAGE
      </motion.h2>

      <div style={{ display: 'flex', gap: '3vw', marginTop: '5vh' }}>
        {[
          { name: 'C-CHANNEL', path: 'M 80 20 L 20 20 L 20 80 L 80 80' },
          { name: 'U-CHANNEL', path: 'M 20 20 L 20 80 L 80 80 L 80 20' },
          { name: 'HAT PROFILE', path: 'M 10 80 L 30 80 L 30 20 L 70 20 L 70 80 L 90 80' },
          { name: 'Z-SECTION', path: 'M 20 20 L 50 20 L 50 80 L 80 80' }
        ].map((profile, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.5, rotateY: 90 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ delay: 1 + i * 0.3, duration: 1, type: 'spring' }}
            style={{ width: '15vw', height: '15vw', background: 'rgba(255,255,255,0.02)', border: `1px solid ${COLORS.gold}40`, borderRadius: '1vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg viewBox="0 0 100 100" style={{ width: '60%', height: '60%' }}>
              <motion.path 
                d={profile.path} fill="none" stroke={COLORS.gold} strokeWidth="4"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2 + i * 0.2, duration: 1.5, ease: "easeInOut" }}
              />
            </svg>
            <div style={{ marginTop: '1vh', fontSize: '1vw', color: COLORS.textMuted }}>{profile.name}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// SCENE 3: DXF Import (18-30s)
function Scene3Dxf() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      style={{ width: '100%', height: '100%', display: 'flex', padding: '6vw', gap: '4vw' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <motion.div 
          initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ fontSize: '1.2vw', color: COLORS.cyan, marginBottom: '1vh', letterSpacing: '0.2em' }}
        >
          MODULE 01
        </motion.div>
        <motion.h2
          initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.7 }}
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '6vw', margin: '0 0 2vh 0', lineHeight: 1 }}
        >
          IMPORT ANY <span style={{ color: COLORS.gold }}>DXF PROFILE</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          style={{ fontSize: '1.5vw', color: COLORS.textMuted }}
        >
          Instant precision. No manual drafting required.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}
          style={{ marginTop: '4vh', background: 'rgba(6,182,212,0.05)', border: `1px solid ${COLORS.cyan}40`, padding: '2vw', borderRadius: '1vw' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1vh', marginBottom: '1vh' }}>
            <span>FILE</span><span style={{ color: COLORS.cyan }}>profile_v4.dxf</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1vh', marginBottom: '1vh' }}>
            <span>ENTITIES</span><span style={{ color: COLORS.text }}>24 LINES, 8 ARCS</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>STATUS</span><span style={{ color: COLORS.gold }}>PARSED SUCCESSFULLY</span>
          </div>
        </motion.div>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1, duration: 1.5 }}
          style={{ width: '100%', height: '80%', background: '#050810', borderRadius: '1vw', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}
        >
          {/* Grid */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '4vw 4vw' }} />
          
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
            {/* The DXF Shape */}
            <motion.path 
              d="M 50 150 L 50 50 L 150 50 L 150 150 L 130 150 L 130 70 L 70 70 L 70 150 Z" 
              fill="none" stroke={COLORS.cyan} strokeWidth="2"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2, duration: 3, ease: "easeInOut" }}
            />
            {/* Dimensions */}
            <motion.line x1="50" y1="40" x2="150" y2="40" stroke={COLORS.textMuted} strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4 }} />
            <motion.text x="100" y="35" fill={COLORS.text} fontSize="6" textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.2 }}>100.00</motion.text>
            
            <motion.line x1="40" y1="50" x2="40" y2="150" stroke={COLORS.textMuted} strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.5 }} />
            <motion.text x="35" y="100" fill={COLORS.text} fontSize="6" textAnchor="middle" transform="rotate(-90 35,100)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.7 }}>100.00</motion.text>
          </svg>
        </motion.div>
      </div>
    </motion.div>
  );
}

// SCENE 4: Flower Pattern (30-45s) - KEY SCENE
function Scene4Flower() {
  const stages = [
    { label: 'FLAT', path: 'M 10 90 L 90 90' },
    { label: 'STN 1', path: 'M 10 85 L 20 90 L 80 90 L 90 85' },
    { label: 'STN 2', path: 'M 15 75 L 30 90 L 70 90 L 85 75' },
    { label: 'STN 3', path: 'M 20 60 L 35 90 L 65 90 L 80 60' },
    { label: 'STN 4', path: 'M 25 40 L 40 90 L 60 90 L 75 40' },
    { label: 'STN 5', path: 'M 30 20 L 45 90 L 55 90 L 70 20' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1.5 }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5vw' }}
    >
      <motion.h2
        initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 1 }}
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '6vw', color: '#fff', margin: '0 0 1vh 0' }}
      >
        AUTOMATED <span style={{ color: COLORS.cyan }}>FLOWER PATTERN</span> GENERATION
      </motion.h2>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        style={{ fontSize: '1.5vw', color: COLORS.textMuted, marginBottom: '6vh' }}
      >
        The core of precision engineering
      </motion.div>

      <div style={{ position: 'relative', width: '80vw', height: '40vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
        <svg viewBox="0 0 100 100" style={{ width: '40vw', height: '40vw', overflow: 'visible' }}>
          {stages.map((stage, i) => (
            <motion.path
              key={i}
              d={stage.path}
              fill="none"
              stroke={i === stages.length - 1 ? COLORS.gold : 'rgba(6,182,212,0.3)'}
              strokeWidth={i === stages.length - 1 ? 2 : 0.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1, filter: i === stages.length -1 ? `drop-shadow(0 0 10px ${COLORS.gold})` : 'none' }}
              transition={{ delay: 1.5 + i * 1.5, duration: 2, ease: "easeInOut" }}
            />
          ))}
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', flexDirection: 'column', gap: '1vh' }}>
          {stages.map((stage, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 + i * 1.5 }}
              style={{ display: 'flex', alignItems: 'center', gap: '1vw', fontSize: '1.2vw', color: i === stages.length -1 ? COLORS.gold : COLORS.textMuted }}
            >
              <div style={{ width: '2vw', height: '2px', background: i === stages.length -1 ? COLORS.gold : 'rgba(6,182,212,0.3)' }} />
              {stage.label}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// SCENE 5: 3D Roll Sim (45-60s) - KEY SCENE
function Scene5RollSim() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <img src="/assets/roll-machine.png" alt="Roll Machine" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #0a0f1a 10%, transparent 50%, #0a0f1a 90%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring', bounce: 0.5 }}
          style={{ width: '6vw', height: '6vw', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: `2px solid ${COLORS.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '3vh', boxShadow: `0 0 30px ${COLORS.gold}60` }}
        >
          <div style={{ fontSize: '2vw' }}>3D</div>
        </motion.div>
        
        <motion.h2
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1 }}
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '7vw', margin: '0 0 2vh 0', textShadow: '0 10px 30px #000' }}
        >
          FULL 3D <span style={{ color: COLORS.gold }}>ROLL SIMULATION</span>
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
          style={{ fontSize: '1.8vw', color: COLORS.textMuted, maxWidth: '60vw' }}
        >
          Visualize metal bending progressively through each station before manufacturing a single roll.
        </motion.p>
      </div>

      {/* Animated Overlay indicating scanning/simulation */}
      <motion.div 
        animate={{ y: ['-50vh', '150vh'] }}
        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
        style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: COLORS.cyan, boxShadow: `0 0 20px 5px ${COLORS.cyan}80`, zIndex: 5 }}
      />
    </motion.div>
  );
}

// SCENE 6: G-Code (60-72s)
function Scene6GCode() {
  const codes = [
    "G90 G21", "G28 U0", "T0101 M03 S350", "G00 X125.340 Z0.000",
    "G01 X125.340 Z-5.000 F0.2", "G01 X110.000 Z-15.000",
    "G02 X86.600 Z-25.000 R100.000", "G01 X86.600 Z-50.000"
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: '10vw' }}
      transition={{ duration: 1 }}
      style={{ width: '100%', height: '100%', display: 'flex', padding: '6vw', gap: '4vw', background: '#050810' }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <motion.h2
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '6vw', margin: '0 0 2vh 0' }}
        >
          INSTANT <span style={{ color: COLORS.cyan }}>CNC G-CODE</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          style={{ fontSize: '1.5vw', color: COLORS.textMuted }}
        >
          From profile to machine path in milliseconds. Export directly to your lathe.
        </motion.p>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1 }}
          style={{ position: 'absolute', inset: 0, background: '#000', border: `1px solid #333`, borderRadius: '1vw', padding: '3vw', overflow: 'hidden' }}
        >
          <div style={{ fontSize: '1vw', color: '#555', borderBottom: '1px solid #333', paddingBottom: '1vh', marginBottom: '2vh' }}>OUTPUT.TAP</div>
          {codes.map((code, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 + i * 0.2 }}
              style={{ fontSize: '1.5vw', color: code.startsWith('G02') || code.startsWith('G01') ? COLORS.gold : COLORS.cyan, marginBottom: '1vh', fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span style={{ color: '#555', marginRight: '2vw' }}>N0{(i+1)*10}</span> {code}
            </motion.div>
          ))}
          <motion.div 
            animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}
            style={{ width: '1vw', height: '2vw', background: COLORS.text, marginTop: '1vh' }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

// SCENE 7: Features (72-80s)
function Scene7Features() {
  const features = [
    { title: "AI Engineering Assistant", color: COLORS.cyan },
    { title: "DXF Import", color: COLORS.gold },
    { title: "3D Visualization", color: COLORS.cyan },
    { title: "G-Code Output", color: COLORS.gold },
    { title: "Flower Pattern", color: COLORS.cyan },
    { title: "Material Database", color: COLORS.gold }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3vw', width: '70vw' }}>
        {features.map((f, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.2, type: 'spring' }}
            style={{ display: 'flex', alignItems: 'center', gap: '2vw', background: 'rgba(255,255,255,0.03)', padding: '2vw', borderRadius: '1vw', borderLeft: `0.5vw solid ${f.color}` }}
          >
            <div style={{ width: '1.5vw', height: '1.5vw', borderRadius: '50%', background: f.color, boxShadow: `0 0 15px ${f.color}` }} />
            <div style={{ fontSize: '1.8vw' }}>{f.title}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// SCENE 8: CTA (80-90s)
function Scene8CTA() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.2 }}>
        <img src="/assets/metal-sheet.png" alt="Metal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent, #0a0f1a)' }} />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1, duration: 2, ease: "easeOut" }}
        style={{ textAlign: 'center', zIndex: 10 }}
      >
        <motion.div 
          animate={{ boxShadow: [`0 0 20px ${COLORS.gold}40`, `0 0 60px ${COLORS.gold}80`, `0 0 20px ${COLORS.gold}40`] }}
          transition={{ repeat: Infinity, duration: 3 }}
          style={{ width: '10vw', height: '10vw', margin: '0 auto 4vh auto', border: `0.4vw solid ${COLORS.gold}`, borderRadius: '1.5vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.1)' }}
        >
          <div style={{ width: '5vw', height: '5vw', background: COLORS.gold, borderRadius: '0.5vw' }} />
        </motion.div>

        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '8vw', margin: '0 0 1vh 0', letterSpacing: '0.05em' }}>
          SAI ROLOTECH SMART ENGINES
        </h1>
        <div style={{ fontSize: '2.5vw', color: COLORS.cyan, marginBottom: '4vh', letterSpacing: '0.1em' }}>
          PRECISION YOU CAN TRUST
        </div>
        <div style={{ fontSize: '2vw', color: COLORS.textMuted, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '2vh', display: 'inline-block', padding: '2vh 4vw' }}>
          sairolotech.com
        </div>
      </motion.div>
    </motion.div>
  );
}
