import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Box, Eye, EyeOff, RotateCcw, Settings2, Layers3,
} from "lucide-react";

// ─── Scale + constants ────────────────────────────────────────────────────────
const S = 0.065;              // 1 unit ≈ 15 mm
const STATION_Z = 22;         // units between stations (≈ 340 mm)
const ROLL_SEGS = 40;         // cylinder smoothness

const STAGE_COL: Record<string, string> = {
  flat:                "#94a3b8",
  pre_bend:            "#a78bfa",
  initial_bend:        "#818cf8",
  progressive_forming: "#60a5fa",
  lip_forming:         "#f472b6",
  calibration:         "#4ade80",
  forming:             "#60a5fa",
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface PassData {
  pass_no:              number;
  station_label:        string;
  target_angle_deg:     number;
  roll_gap_mm:          number;
  forming_depth_mm:     number;
  pass_progress_pct:    number;
  stage_type:           string;
  upper_roll_radius_mm: number;
  lower_roll_radius_mm: number;
  roll_width_mm:        number;
  groove_depth_mm:      number;
}

interface RollContourData {
  passes?:           PassData[];
  forming_summary?:  { flat_strip_width_mm?: number };
  thickness_mm?:     number;
  material?:         string;
}

interface Props {
  rollContour:  RollContourData | null;
  webMm?:       number;
  flangeMm?:    number;
  thicknessMm?: number;
  material?:    string;
}

// ─── 3-D helpers ─────────────────────────────────────────────────────────────

function Roll({
  radius, width, posY, stationZ, color, emissiveColor, emissiveIntensity = 0,
}: {
  radius: number; width: number; posY: number; stationZ: number;
  color: string; emissiveColor: string; emissiveIntensity?: number;
}) {
  return (
    <mesh
      position={[0, posY, stationZ]}
      rotation={[0, 0, Math.PI / 2]}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, width, ROLL_SEGS]} />
      <meshStandardMaterial
        color={color}
        metalness={0.85}
        roughness={0.15}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function RollShaft({ stationZ, upperY, lowerY }: { stationZ: number; upperY: number; lowerY: number }) {
  const h = Math.abs(upperY - lowerY);
  return (
    <mesh position={[0, (upperY + lowerY) / 2, stationZ]} castShadow>
      <cylinderGeometry args={[0.25, 0.25, h, 12]} />
      <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
    </mesh>
  );
}

function StripSection({
  angle_deg, webMm, flangeMm, thicknessMm, stationZ, color, opacity = 1,
}: {
  angle_deg: number; webMm: number; flangeMm: number; thicknessMm: number;
  stationZ: number; color: string; opacity?: number;
}) {
  const t  = thicknessMm * S;
  const w  = webMm * S;
  const f  = flangeMm * S;
  const d  = 4.5;             // extrusion along X (roll face depth)
  const th = (angle_deg * Math.PI) / 180;

  const lx = -(w / 2 + Math.cos(th) * f / 2);
  const ly =  Math.sin(th) * f / 2;
  const rx =   w / 2 + Math.cos(th) * f / 2;
  const ry =  Math.sin(th) * f / 2;

  const mat = (
    <meshStandardMaterial
      color={color}
      metalness={0.55}
      roughness={0.45}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );

  return (
    <group position={[0, 0, stationZ]}>
      {/* Web */}
      <mesh castShadow>
        <boxGeometry args={[d, t, w]} />
        {mat}
      </mesh>
      {/* Left flange */}
      <mesh position={[0, ly, lx]} rotation={[-(Math.PI / 2 - th), 0, 0]} castShadow>
        <boxGeometry args={[d, t, f]} />
        {mat}
      </mesh>
      {/* Right flange */}
      <mesh position={[0, ry, rx]} rotation={[Math.PI / 2 - th, 0, 0]} castShadow>
        <boxGeometry args={[d, t, f]} />
        {mat}
      </mesh>
    </group>
  );
}

function StationLabel({ label, stationZ, isActive, stageColor }: {
  label: string; stationZ: number; isActive: boolean; stageColor: string;
}) {
  return (
    <Text
      position={[0, -9, stationZ]}
      fontSize={0.9}
      color={isActive ? stageColor : "#475569"}
      anchorX="center"
      anchorY="top"
      fontWeight={isActive ? "bold" : "normal"}
      renderOrder={1}
    >
      {label}
    </Text>
  );
}

function MachineBed({ totalZ }: { totalZ: number }) {
  return (
    <mesh position={[0, -10.5, totalZ / 2]} receiveShadow>
      <boxGeometry args={[20, 0.6, totalZ + 20]} />
      <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.8} />
    </mesh>
  );
}

function BaseFrame({ stationZ }: { stationZ: number }) {
  return (
    <group position={[0, 0, stationZ]}>
      {/* Left upright */}
      <mesh position={[-6, -2.5, 0]}>
        <boxGeometry args={[1, 15, 1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Right upright */}
      <mesh position={[6, -2.5, 0]}>
        <boxGeometry args={[1, 15, 1]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Cross beam top */}
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[14, 0.8, 0.9]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function PassLine({ stationZ }: { stationZ: number; gap_mm: number }) {
  return (
    <mesh position={[0, 0, stationZ]}>
      <boxGeometry args={[9, 0.04, 0.06]} />
      <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
    </mesh>
  );
}

// ─── Camera rig ───────────────────────────────────────────────────────────────
function CameraRig({ targetZ, autoRotate }: { targetZ: number; autoRotate: boolean }) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 0, targetZ));
  const angleRef  = useRef(0);

  useFrame((_, delta) => {
    targetRef.current.lerp(new THREE.Vector3(0, 0, targetZ), 0.06);
    camera.lookAt(targetRef.current);

    if (autoRotate) {
      angleRef.current += delta * 0.25;
      const rx = Math.cos(angleRef.current) * 28;
      const rz = Math.sin(angleRef.current) * 28 + targetRef.current.z;
      camera.position.lerp(new THREE.Vector3(rx, 18, rz), 0.04);
    }
  });
  return null;
}

// ─── Full scene ───────────────────────────────────────────────────────────────
function Scene({
  passes, webMm, flangeMm, thicknessMm, activeIdx,
  showStrip, showRolls, autoRotate,
}: {
  passes: PassData[]; webMm: number; flangeMm: number; thicknessMm: number;
  activeIdx: number; showStrip: boolean; showRolls: boolean; autoRotate: boolean;
}) {
  const n = passes.length;
  if (!n) return null;
  const totalZ = (n - 1) * STATION_Z;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[20, 30, 10]} intensity={1.2} castShadow />
      <directionalLight position={[-15, 20, -10]} intensity={0.5} color="#b0c4de" />
      <pointLight position={[0, 10, totalZ / 2]} intensity={0.8} color="#4488ff" />

      {/* Floor grid */}
      <Grid
        args={[200, 200]}
        position={[0, -11, totalZ / 2]}
        cellColor="#1e293b"
        sectionColor="#1e3a5f"
        cellSize={5}
        sectionSize={STATION_Z}
        infiniteGrid={false}
        fadeDistance={120}
      />

      {/* Machine bed */}
      <MachineBed totalZ={totalZ} />

      {/* Camera rig */}
      <CameraRig targetZ={activeIdx * STATION_Z} autoRotate={autoRotate} />

      {/* Per-station objects */}
      {passes.map((pass, i) => {
        const z       = i * STATION_Z;
        const isActive = i === activeIdx;
        const stageCol = STAGE_COL[pass.stage_type] ?? "#60a5fa";
        const uR = Math.max(pass.upper_roll_radius_mm, 10) * S;
        const lR = Math.max(pass.lower_roll_radius_mm, 10) * S;
        const rW = Math.max(pass.roll_width_mm, webMm + 20) * S;
        const gap = pass.roll_gap_mm * S;
        const uY  = gap / 2 + uR;
        const lY  = -(gap / 2 + lR);
        const stripCol = STAGE_COL[pass.stage_type] ?? "#94a3b8";

        return (
          <Suspense key={i} fallback={null}>
            {/* Base frame */}
            <BaseFrame stationZ={z} />

            {/* Rolls */}
            {showRolls && (
              <>
                <Roll
                  radius={uR} width={rW}
                  posY={uY} stationZ={z}
                  color={isActive ? "#3b82f6" : "#1e40af"}
                  emissiveColor={isActive ? "#2040ff" : "#000000"}
                  emissiveIntensity={isActive ? 0.5 : 0}
                />
                <Roll
                  radius={lR} width={rW}
                  posY={lY} stationZ={z}
                  color={isActive ? "#22c55e" : "#14532d"}
                  emissiveColor={isActive ? "#106030" : "#000000"}
                  emissiveIntensity={isActive ? 0.45 : 0}
                />
                <RollShaft stationZ={z} upperY={uY} lowerY={lY} />
              </>
            )}

            {/* Pass line */}
            <PassLine stationZ={z} gap_mm={pass.roll_gap_mm} />

            {/* Strip section */}
            {showStrip && (
              <StripSection
                angle_deg={pass.target_angle_deg}
                webMm={webMm}
                flangeMm={flangeMm}
                thicknessMm={thicknessMm}
                stationZ={z}
                color={isActive ? "#f8fafc" : stripCol}
                opacity={isActive ? 1 : 0.35}
              />
            )}

            {/* Station label */}
            <StationLabel
              label={`S${pass.pass_no}\n${pass.target_angle_deg.toFixed(0)}°`}
              stationZ={z}
              isActive={isActive}
              stageColor={stageCol}
            />
          </Suspense>
        );
      })}

      {/* Highlighted station glow ring */}
      {(() => {
        const pass = passes[activeIdx];
        if (!pass) return null;
        const z  = activeIdx * STATION_Z;
        const uR = Math.max(pass.upper_roll_radius_mm, 10) * S + 0.6;
        return (
          <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[uR + 2, 0.12, 12, 80]} />
            <meshStandardMaterial
              color={STAGE_COL[pass.stage_type] ?? "#60a5fa"}
              emissive={STAGE_COL[pass.stage_type] ?? "#60a5fa"}
              emissiveIntensity={1.2}
              transparent opacity={0.7}
            />
          </mesh>
        );
      })()}
    </>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
type AnimSpeed = "slow" | "normal" | "fast";
const SPEED_MS: Record<AnimSpeed, number> = { slow: 1800, normal: 1000, fast: 450 };

export default function RollForming3DPanel({
  rollContour, webMm = 60, flangeMm = 40, thicknessMm = 1.5, material = "GI",
}: Props) {
  const passes = rollContour?.passes ?? [];
  const flatStrip = rollContour?.forming_summary?.flat_strip_width_mm;
  const mat = rollContour?.material ?? material;
  const n = passes.length;

  const [activeIdx,   setActiveIdx]   = useState(0);
  const [playing,     setPlaying]     = useState(false);
  const [animSpeed,   setAnimSpeed]   = useState<AnimSpeed>("normal");
  const [showStrip,   setShowStrip]   = useState(true);
  const [showRolls,   setShowRolls]   = useState(true);
  const [autoRotate,  setAutoRotate]  = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((idx: number) => {
    setActiveIdx(Math.max(0, Math.min(n - 1, idx)));
  }, [n]);

  useEffect(() => {
    if (playing && n > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIdx(prev => {
          if (prev >= n - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, SPEED_MS[animSpeed]);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, n, animSpeed]);

  useEffect(() => { setActiveIdx(0); setPlaying(false); }, [passes.length]);

  const cur = passes[activeIdx];
  const stageCol = cur ? (STAGE_COL[cur.stage_type] ?? "#60a5fa") : "#60a5fa";

  if (!n) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-[#0d0d1a] p-6">
        <div className="flex items-center gap-2 mb-3">
          <Layers3 className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-bold text-violet-300 uppercase tracking-wider">3D Roll Forming Simulation</span>
          <span className="ml-auto text-[10px] text-gray-600 font-mono">Three.js · R3F v9</span>
        </div>
        <div className="h-36 flex flex-col items-center justify-center text-center gap-2 text-gray-600">
          <Box className="w-8 h-8 opacity-30" />
          <p className="text-xs">Run the pipeline to launch the 3D simulation.</p>
          <p className="text-[10px] text-gray-700">Full machine layout · Roll geometry · Progressive forming</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-[#0a0a14] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-violet-500/15 flex items-center gap-3 flex-wrap">
        <Layers3 className="w-4 h-4 text-violet-400 shrink-0" />
        <div>
          <div className="text-xs font-bold text-violet-300 uppercase tracking-wider">3D Roll Forming Simulation</div>
          <div className="text-[10px] text-gray-500 font-mono">
            {mat} · {thicknessMm}mm · {n} stations · flat strip {flatStrip ? flatStrip.toFixed(1) : "—"}mm
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {/* Toggle strip */}
          <button
            onClick={() => setShowStrip(s => !s)}
            title="Toggle strip"
            className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
              showStrip ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-gray-700 text-gray-600"
            }`}
          >
            {showStrip ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Strip
          </button>
          {/* Toggle rolls */}
          <button
            onClick={() => setShowRolls(s => !s)}
            title="Toggle rolls"
            className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
              showRolls ? "border-blue-500/40 bg-blue-500/10 text-blue-300" : "border-gray-700 text-gray-600"
            }`}
          >
            {showRolls ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            Rolls
          </button>
          {/* Auto-rotate */}
          <button
            onClick={() => setAutoRotate(s => !s)}
            title="Auto-rotate camera"
            className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
              autoRotate ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-gray-700 text-gray-600"
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            Orbit
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ height: 460, background: "#07080f" }}>
        <Canvas
          shadows
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0, 18, -20], fov: 52, near: 0.1, far: 500 }}
          style={{ background: "#07080f" }}
        >
          <Suspense fallback={null}>
            <Scene
              passes={passes}
              webMm={webMm}
              flangeMm={flangeMm}
              thicknessMm={thicknessMm}
              activeIdx={activeIdx}
              showStrip={showStrip}
              showRolls={showRolls}
              autoRotate={autoRotate}
            />
          </Suspense>
          <OrbitControls
            enabled={!autoRotate}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI / 1.6}
            minDistance={5}
            maxDistance={180}
          />
        </Canvas>
      </div>

      {/* Controls */}
      <div className="px-4 py-2.5 border-t border-violet-500/15 flex items-center gap-2">
        <button onClick={() => { go(0); setPlaying(false); }}
          className="p-1.5 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => go(activeIdx - 1)}
          className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: stageCol + "20",
            color: stageCol,
            border: `1px solid ${stageCol}40`,
          }}
        >
          {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => go(activeIdx + 1)}
          className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { go(n - 1); setPlaying(false); }}
          className="p-1.5 rounded text-gray-600 hover:text-white hover:bg-white/5 transition-colors">
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Slider */}
        <div className="flex-1 mx-2">
          <input
            type="range" min={0} max={Math.max(0, n - 1)} value={activeIdx}
            onChange={e => { go(Number(e.target.value)); setPlaying(false); }}
            className="w-full cursor-pointer"
            style={{ accentColor: stageCol }}
          />
        </div>

        {/* Station info */}
        {cur && (
          <div className="text-[10px] font-mono shrink-0 text-right min-w-[110px]">
            <div style={{ color: stageCol }} className="font-semibold">{cur.station_label}</div>
            <div className="text-gray-600">{cur.target_angle_deg.toFixed(1)}° · {(activeIdx + 1)}/{n}</div>
          </div>
        )}

        {/* Speed */}
        <div className="flex items-center gap-0.5 border border-gray-800 rounded px-1.5 py-1 shrink-0">
          <Settings2 className="w-2.5 h-2.5 text-gray-700" />
          {(["slow", "normal", "fast"] as AnimSpeed[]).map(s => (
            <button
              key={s}
              onClick={() => setAnimSpeed(s)}
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                animSpeed === s ? "bg-violet-500/20 text-violet-300" : "text-gray-700 hover:text-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Station pill strip */}
      <div className="px-4 pb-3 flex gap-1 overflow-x-auto">
        {passes.map((p, i) => {
          const sc = STAGE_COL[p.stage_type] ?? "#60a5fa";
          return (
            <button
              key={i}
              onClick={() => { go(i); setPlaying(false); }}
              title={`${p.station_label} — ${p.target_angle_deg.toFixed(0)}°`}
              className="shrink-0 w-6 h-6 rounded-full text-[8px] font-bold transition-all border"
              style={i === activeIdx ? {
                background: sc + "40", borderColor: sc, color: sc,
              } : {
                background: "transparent", borderColor: "#1e293b", color: "#475569",
              }}
            >
              {p.pass_no}
            </button>
          );
        })}
      </div>

      {/* Per-station info bar */}
      {cur && (
        <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["Angle", `${cur.target_angle_deg.toFixed(1)}°`, stageCol],
            ["Upper Ø", `${(cur.upper_roll_radius_mm * 2).toFixed(0)} mm`, "#60a5fa"],
            ["Lower Ø", `${(cur.lower_roll_radius_mm * 2).toFixed(0)} mm`, "#4ade80"],
            ["Roll gap", `${cur.roll_gap_mm.toFixed(2)} mm`, "#fbbf24"],
            ["Groove depth", `${cur.groove_depth_mm.toFixed(2)} mm`, "#a78bfa"],
            ["Roll width", `${cur.roll_width_mm.toFixed(1)} mm`, "#94a3b8"],
            ["Progress", `${cur.pass_progress_pct.toFixed(0)}%`, stageCol],
            ["Stage", cur.stage_type.replace(/_/g, " "), stageCol],
          ].map(([label, value, color]) => (
            <div key={label as string} className="rounded-lg bg-[#0d1117] border border-gray-800 px-2.5 py-1.5">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">{label}</div>
              <div className="text-xs font-mono font-semibold mt-0.5" style={{ color: color as string }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
