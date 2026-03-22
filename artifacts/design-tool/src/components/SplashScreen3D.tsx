import { useRef, useMemo, useState, useEffect, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, Vignette, SMAA } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { onDownloadProgress, initSWDownloadManager } from "@/lib/sw-download-manager";

// ─── WebGL availability check ─────────────────────────────────────────────────
// Fast check — no renderer creation, no GPU timeout risk
function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl")
    ) as WebGLRenderingContext | null;
    if (!gl) return false;

    // WEBGL_debug_renderer_info is only exposed in real GPU environments.
    // Headless / sandboxed browsers (preview, CI) don't expose it.
    const dbg = gl.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_VENDOR_WEBGL: number;
      UNMASKED_RENDERER_WEBGL: number;
    } | null;

    if (!dbg) {
      // No debug info → assume sandboxed / no real GPU → use 2D
      canvas.remove();
      return false;
    }

    const vendor: string   = (gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)   as string) ?? "";
    const renderer: string = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string) ?? "";
    canvas.remove();

    if (!vendor || !renderer) return false;

    const combined = (vendor + " " + renderer).toLowerCase();
    return !(
      combined.includes("swiftshader") ||
      combined.includes("llvmpipe")    ||
      combined.includes("virtualbox")  ||
      combined.includes("vmware")      ||
      combined.includes("microsoft basic render")
    );
  } catch {
    return false;
  }
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
interface EBState { error: boolean }
class CanvasErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, EBState> {
  state: EBState = { error: false };
  static getDerivedStateFromError(): EBState { return { error: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

interface SplashScreen3DProps {
  onComplete: () => void;
  minDuration?: number;
}

// ─── Rolling Torus Ring ────────────────────────────────────────────────────────
function RollFormingRing({
  radius = 1.2,
  tube = 0.28,
  color = "#b87333",
  emissive = "#7a3a00",
  speed = 0.4,
  orbitRadius = 0,
  orbitSpeed = 0,
  orbitTilt = 0,
  delay = 0,
}: {
  radius?: number; tube?: number; color?: string; emissive?: string;
  speed?: number; orbitRadius?: number; orbitSpeed?: number; orbitTilt?: number; delay?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const t0 = useRef(delay);

  useFrame((_, dt) => {
    t0.current += dt;
    const t = t0.current;
    if (ref.current) {
      ref.current.rotation.x += dt * speed * 0.7;
      ref.current.rotation.y += dt * speed;
    }
    if (groupRef.current && orbitRadius > 0) {
      groupRef.current.rotation.y += dt * orbitSpeed;
      groupRef.current.rotation.x = orbitTilt;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh
        ref={ref}
        position={[orbitRadius, 0, 0]}
        castShadow
        receiveShadow
      >
        <torusGeometry args={[radius, tube, 64, 128]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={0.35}
          metalness={0.95}
          roughness={0.08}
          envMapIntensity={2.5}
        />
      </mesh>
    </group>
  );
}

// ─── Central Engine Core ───────────────────────────────────────────────────────
function EngineCore({ phase }: { phase: number }) {
  const innerRef = useRef<THREE.Mesh>(null!);
  const outerRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.PointLight>(null!);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (innerRef.current) {
      innerRef.current.rotation.y = t * 0.6;
      innerRef.current.rotation.z = t * 0.25;
    }
    if (outerRef.current) {
      outerRef.current.rotation.y = -t * 0.35;
      outerRef.current.rotation.x = t * 0.15;
    }
    if (glowRef.current) {
      glowRef.current.intensity = 3.5 + Math.sin(t * 2.4) * 1.2;
    }
  });

  return (
    <group>
      {/* Outer shell */}
      <mesh ref={outerRef} castShadow>
        <icosahedronGeometry args={[0.85, 4]} />
        <meshStandardMaterial
          color="#c8a96e"
          emissive="#4a2800"
          emissiveIntensity={0.4 + phase * 0.3}
          metalness={1}
          roughness={0.06}
          wireframe={false}
          envMapIntensity={3}
        />
      </mesh>
      {/* Inner glowing core */}
      <mesh ref={innerRef}>
        <octahedronGeometry args={[0.45, 2]} />
        <meshStandardMaterial
          color="#ff9900"
          emissive="#ff6600"
          emissiveIntensity={2.5 + phase * 2}
          metalness={0.2}
          roughness={0.1}
          toneMapped={false}
        />
      </mesh>
      {/* Core light */}
      <pointLight ref={glowRef} color="#ff9900" intensity={4} distance={6} />
    </group>
  );
}

// ─── Metal Shavings Particles ──────────────────────────────────────────────────
function MetalParticles({ count = 600 }) {
  const geo = useRef<THREE.BufferGeometry>(null!);
  const mat = useRef<THREE.PointsMaterial>(null!);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.8 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  const speeds = useMemo(() => Float32Array.from({ length: count }, () => 0.3 + Math.random() * 0.8), [count]);
  const radii = useMemo(() => Float32Array.from({ length: count }, (_, i) => {
    const idx = i * 3;
    return Math.sqrt(positions[idx] ** 2 + positions[idx + 1] ** 2 + positions[idx + 2] ** 2);
  }), [count, positions]);
  const angles = useMemo(() => Float32Array.from({ length: count }, () => Math.random() * Math.PI * 2), [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pos = geo.current?.attributes.position?.array as Float32Array;
    if (!pos) return;
    for (let i = 0; i < count; i++) {
      const a = angles[i] + t * speeds[i] * 0.25;
      const r = radii[i];
      const orig_y = positions[i * 3 + 1];
      pos[i * 3] = r * Math.cos(a);
      pos[i * 3 + 1] = orig_y + Math.sin(t * speeds[i] + i) * 0.08;
      pos[i * 3 + 2] = r * Math.sin(a);
    }
    geo.current.attributes.position.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geo}>
        <bufferAttribute attach="attributes-position" args={[positions.slice(), 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        size={0.025}
        color="#ffd080"
        sizeAttenuation
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ─── Shockwave Ring ────────────────────────────────────────────────────────────
function ShockwaveRing({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const scaleRef = useRef(0);

  useFrame((_, dt) => {
    if (!active || !ref.current) return;
    scaleRef.current = Math.min(scaleRef.current + dt * 1.8, 6);
    ref.current.scale.setScalar(scaleRef.current);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.7 - scaleRef.current / 8);
  });

  if (!active) return null;
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1.1, 64]} />
      <meshBasicMaterial color="#ff9900" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Camera Cinematic Dolly ────────────────────────────────────────────────────
function CinematicCamera({ phase }: { phase: number }) {
  const { camera } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const targetZ = phase < 0.5 ? 7 - phase * 4 : 5;
    const targetY = Math.sin(t * 0.15) * 0.4;
    const targetX = Math.sin(t * 0.1) * 0.3;
    camera.position.z += (targetZ - camera.position.z) * 0.015;
    camera.position.y += (targetY - camera.position.y) * 0.02;
    camera.position.x += (targetX - camera.position.x) * 0.02;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ─── 3D Grid Floor ─────────────────────────────────────────────────────────────
function GridFloor() {
  const ref = useRef<THREE.GridHelper>(null!);
  useFrame((state) => {
    if (ref.current) {
      const mat = ref.current.material as THREE.Material;
      (mat as any).opacity = 0.12 + Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
    }
  });
  return (
    <primitive
      ref={ref}
      object={new THREE.GridHelper(20, 40, "#334466", "#223355")}
      position={[0, -3, 0]}
    />
  );
}

// ─── HTML Text Overlay ─────────────────────────────────────────────────────────
function TextReveal({ phase, swKb, swFile, progress }: {
  phase: number; swKb: number; swFile: string; progress: number;
}) {
  const title1 = "SAI ROLOTECH";
  const title2 = "SMART ENGINES";
  const tag = "PRECISION ROLL FORMING SUITE  ·  v2.2.0";

  const chars1 = phase > 0.65 ? Math.floor((phase - 0.65) / 0.35 * title1.length * 1.5) : 0;
  const chars2 = phase > 0.78 ? Math.floor((phase - 0.78) / 0.22 * title2.length * 1.5) : 0;
  const showTag = phase > 0.88;
  const showBar = phase > 0.3;

  const isReady = progress >= 95;

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-end",
      pointerEvents: "none",
      paddingBottom: 60,
    }}>
      {/* Brand name */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          fontSize: "clamp(2rem, 6vw, 3.8rem)",
          fontWeight: 900,
          letterSpacing: "0.18em",
          fontFamily: "'Inter', system-ui, sans-serif",
          lineHeight: 1.1,
          minHeight: "1.2em",
        }}>
          <span style={{
            background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 40%, #d97706 70%, #ffffff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 24px rgba(245,158,11,0.8)) drop-shadow(0 0 8px rgba(255,200,50,0.5))",
            display: "block",
          }}>
            {title1.slice(0, Math.min(chars1, title1.length))}
            {chars1 > 0 && chars1 <= title1.length && (
              <span style={{ opacity: 0.6, animation: "blink 0.5s step-end infinite" }}>|</span>
            )}
          </span>
          {chars2 > 0 && (
            <span style={{
              color: "rgba(255,255,255,0.92)",
              display: "block",
              fontSize: "0.62em",
              letterSpacing: "0.3em",
              fontWeight: 700,
              textShadow: "0 0 30px rgba(200,200,255,0.4)",
              marginTop: 4,
            }}>
              {title2.slice(0, Math.min(chars2, title2.length))}
            </span>
          )}
        </div>
        {showTag && (
          <p style={{
            fontSize: "0.62rem",
            color: "rgba(156,163,175,0.75)",
            letterSpacing: "0.22em",
            fontFamily: "monospace",
            marginTop: 10,
            animation: "fadeUp 0.6s ease-out both",
          }}>
            {tag}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {showBar && (
        <div style={{ width: "min(400px, 80vw)", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{
              fontFamily: "monospace", fontSize: "9px",
              color: "rgba(156,163,175,0.6)", letterSpacing: "0.08em",
              maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {swFile ? `↓ ${swFile}` : isReady ? "All systems online" : "Initializing systems..."}
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
              height: "100%",
              width: `${progress}%`,
              background: isReady
                ? "linear-gradient(90deg,#22c55e,#4ade80)"
                : "linear-gradient(90deg,#f59e0b,#f97316,#fbbf24)",
              borderRadius: 3,
              transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
              boxShadow: `0 0 12px 2px ${isReady ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.5)"}`,
            }} />
          </div>

          {/* Module dots */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 4 }}>
            {[
              { label: "Roll Design", pct: 25 },
              { label: "CNC/CAM", pct: 40 },
              { label: "Offline AI", pct: 65 },
              { label: "3D Engine", pct: 80 },
              { label: "Hardware", pct: 55 },
            ].map((m, i) => {
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
                    letterSpacing: "0.03em",
                    transition: "color 0.4s ease",
                  }}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── 3D Scene ──────────────────────────────────────────────────────────────────
function Scene({ phase }: { phase: number }) {
  const shockwave = phase > 0.58 && phase < 0.85;

  return (
    <>
      <CinematicCamera phase={phase} />

      {/* Ambient & directional */}
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        color="#ffe8b0"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-far={30}
        shadow-camera-near={0.1}
      />
      <directionalLight position={[-6, -3, -4]} intensity={0.4} color="#4488ff" />
      <pointLight position={[0, 4, 2]} intensity={1.5} color="#ff9900" distance={10} />

      <GridFloor />

      {/* Central engine */}
      <EngineCore phase={phase} />

      {/* Main ring — large outer torus */}
      <RollFormingRing radius={2.2} tube={0.18} color="#c0a060" emissive="#5a3000" speed={0.22} />

      {/* Orbiting rings */}
      <RollFormingRing radius={1.0} tube={0.14} color="#d4af37" emissive="#6b4000" speed={0.7} orbitRadius={3.2} orbitSpeed={0.28} orbitTilt={0.5} delay={0} />
      <RollFormingRing radius={0.7} tube={0.11} color="#b8860b" emissive="#3d2200" speed={1.1} orbitRadius={2.6} orbitSpeed={-0.4} orbitTilt={1.0} delay={1.2} />
      <RollFormingRing radius={0.55} tube={0.09} color="#ffd700" emissive="#7a5000" speed={1.6} orbitRadius={3.8} orbitSpeed={0.18} orbitTilt={1.6} delay={0.7} />
      <RollFormingRing radius={0.4} tube={0.07} color="#e8c870" emissive="#4a3000" speed={2.0} orbitRadius={2.0} orbitSpeed={-0.55} orbitTilt={2.2} delay={2.1} />

      {/* Sparkle particles */}
      <Sparkles
        count={180}
        scale={7}
        size={1.2}
        speed={0.3}
        opacity={0.6}
        color="#ffd080"
      />
      <MetalParticles count={500} />

      <ShockwaveRing active={shockwave} />

      {/* Post-processing — game engine quality */}
      <EffectComposer multisampling={0}>
        <SMAA />
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.6}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={new THREE.Vector2(0.0008, 0.0008)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.35} darkness={0.85} />
      </EffectComposer>
    </>
  );
}

// ─── 2D CSS Fallback Splash (no GPU needed) ────────────────────────────────────
function SplashScreen2D({ onComplete, minDuration = 4000 }: SplashScreen3DProps) {
  const [progress, setProgress] = useState(5);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(elapsed / minDuration, 1);
      setProgress(Math.round(5 + p * 90));
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(() => { setVisible(false); setTimeout(onComplete, 500); }, 200);
    };
    requestAnimationFrame(tick);
  }, [onComplete, minDuration]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 40%, #0d1428 0%, #050810 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: visible ? 1 : 0, transition: "opacity 0.5s ease",
    }}>
      {/* Animated rings (CSS only) */}
      <div style={{ position: "relative", width: 180, height: 180, marginBottom: 40 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: "absolute", inset: i * 22, borderRadius: "50%",
            border: `2px solid rgba(245,158,11,${0.8 - i * 0.25})`,
            animation: `spin${i % 2 === 0 ? "cw" : "ccw"} ${2 + i}s linear infinite`,
          }} />
        ))}
        <div style={{
          position: "absolute", inset: 66, borderRadius: "50%",
          background: "radial-gradient(circle, #f59e0b 0%, #d97706 60%, #7c3a00 100%)",
          boxShadow: "0 0 30px 8px rgba(245,158,11,0.5)",
          animation: "pulse 2s ease-in-out infinite",
        }} />
      </div>

      {/* Brand */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          fontSize: "2.4rem", fontWeight: 900, letterSpacing: "0.15em",
          background: "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706, #fff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          fontFamily: "'Inter', system-ui, sans-serif",
          filter: "drop-shadow(0 0 20px rgba(245,158,11,0.6))",
        }}>SAI ROLOTECH</div>
        <div style={{
          fontSize: "1rem", fontWeight: 700, letterSpacing: "0.35em",
          color: "rgba(255,255,255,0.85)", marginTop: 6,
        }}>SMART ENGINES</div>
        <div style={{
          fontSize: "0.58rem", color: "rgba(156,163,175,0.6)", marginTop: 8,
          letterSpacing: "0.2em", fontFamily: "monospace",
        }}>PRECISION ROLL FORMING SUITE  ·  v2.2.0</div>
      </div>

      {/* Progress */}
      <div style={{ width: 320 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: "9px", color: "rgba(156,163,175,0.5)" }}>
            Initializing systems...
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "9px", color: "rgba(245,158,11,0.9)", fontWeight: 700 }}>
            {progress}%
          </span>
        </div>
        <div style={{
          width: "100%", height: 3, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: "linear-gradient(90deg, #f59e0b, #f97316, #fbbf24)",
            borderRadius: 3, transition: "width 0.3s ease",
            boxShadow: "0 0 10px 2px rgba(245,158,11,0.4)",
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spincw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spinccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 30px 8px rgba(245,158,11,0.5); }
          50% { box-shadow: 0 0 50px 16px rgba(245,158,11,0.8); }
        }
      `}</style>
    </div>
  );
}

// ─── 3D Splash internals ───────────────────────────────────────────────────────
function SplashScreen3DInner({ onComplete, minDuration = 4000 }: SplashScreen3DProps) {
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(5);
  const [swKb, setSwKb] = useState(0);
  const [swFile, setSwFile] = useState("");
  const [canvasError, setCanvasError] = useState(false);

  // Phase animation — 0 → 1 over minDuration ms
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(elapsed / minDuration, 1);
      setPhase(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setVisible(false);
          setTimeout(onComplete, 700);
        }, 200);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete, minDuration]);

  // Real SW progress
  useEffect(() => {
    initSWDownloadManager();
    const unsub = onDownloadProgress((p) => {
      if (p.phase === "idle") return;
      if (p.progress > 0) setProgress(Math.max(5, Math.min(95, p.progress)));
      if (p.kb > 0) setSwKb(p.kb);
      if (p.currentFile) setSwFile(p.currentFile);
      if (p.phase === "complete") {
        setProgress(100);
        setSwFile("");
      }
    });

    // Animate fake progress when SW not active
    let fakeTimer: ReturnType<typeof setInterval>;
    fakeTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) { clearInterval(fakeTimer); return prev; }
        return prev + Math.random() * 4;
      });
    }, 400);

    return () => { unsub(); clearInterval(fakeTimer); };
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#020008",
        transition: "opacity 0.7s ease, transform 0.7s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(1.04)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <CanvasErrorBoundary onError={() => setCanvasError(true)}>
        <Canvas
          gl={{
            antialias: false,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.35,
            alpha: false,
            powerPreference: "high-performance",
          }}
          dpr={window.devicePixelRatio ?? 1}
          shadows="soft"
          camera={{ position: [0, 0.8, 7], fov: 52, near: 0.1, far: 100 }}
          style={{ width: "100%", height: "100%" }}
        >
          <Suspense fallback={null}>
            <Environment preset="studio" />
            <Scene phase={phase} />
          </Suspense>
        </Canvas>
      </CanvasErrorBoundary>

      <TextReveal phase={phase} swKb={swKb} swFile={swFile} progress={Math.round(progress)} />
    </div>
  );
}

// ─── Main Export — always use 2D splash for reliability ──────────────────────
export function SplashScreen3D(props: SplashScreen3DProps) {
  return <SplashScreen2D {...props} minDuration={Math.min(props.minDuration ?? 4000, 4000)} />;
}
