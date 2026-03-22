import React, { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { useCncStore } from "../../store/useCncStore";
import type { RollToolingResult, StationProfile } from "../../store/useCncStore";
import { getQualitySettings, isDedicatedGPU, type QualitySettings } from "../../lib/gpu-tier";
import {
  type EngineeringScale,
  ENGINEERING_SCALES,
  getScaleFactor,
  formatMM,
  formatAngle,
  getGapSeverity,
  getGapColor,
  getGapHexColor,
  getCameraPresets,
  type CameraPreset,
  type GapSeverity,
} from "../../lib/engineering-scale";

type OrbitControlsRef = React.ComponentRef<typeof OrbitControls>;

const UPPER_ROLL_COLOR = "#3b82f6";
const LOWER_ROLL_COLOR = "#f97316";
const SHAFT_COLOR = "#334155";
const FRAME_COLOR = "#1e293b";
const STRIP_COLOR = "#fbbf24";
const BED_COLOR = "#111827";

const STATION_SPACING_MM = 300;
const SHAFT_EXTENSION_MM = 150;
const FRAME_OFFSET_MM = 50;
const FRAME_THICKNESS_MM = 30;
const FRAME_DEPTH_MM = 60;
const BED_Y_OFFSET_MM = -250;
const BED_THICKNESS_MM = 30;
const FLOOR_Y_MM = -264;
const PROFILE_POINTS = 16;

function RollStation({
  rt,
  stationIndex,
  isActive,
  quality,
  gapSeverity,
}: {
  rt: RollToolingResult;
  stationIndex: number;
  isActive: boolean;
  quality: QualitySettings;
  gapSeverity: GapSeverity | null;
}) {
  const rp = rt.rollProfile;
  if (!rp) return null;
  const rollRadius = (rp.rollDiameter ?? 100) * 0.5;
  const shaftRadius = (rp.shaftDiameter ?? 40) * 0.5;
  const rollWidth = rp.rollWidth ?? 80;
  const gap = rp.gap ?? 1.5;

  const zPos = stationIndex * STATION_SPACING_MM;
  const upperCenterY = rollRadius + gap * 0.5;
  const lowerCenterY = -rollRadius - gap * 0.5;
  const shaftLen = SHAFT_EXTENSION_MM;

  const emissiveIntensity = isActive ? 0.3 : 0;
  const gapColorHex = gapSeverity ? getGapHexColor(gapSeverity) : 0x22c55e;

  return (
    <group position={[0, 0, zPos]}>
      <group position={[0, upperCenterY, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow={quality.enableShadows}>
          <cylinderGeometry args={[rollRadius, rollRadius, rollWidth, quality.cylinderSegments]} />
          <meshStandardMaterial color={UPPER_ROLL_COLOR} roughness={0.3} metalness={0.7} emissive={UPPER_ROLL_COLOR} emissiveIntensity={emissiveIntensity} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[shaftRadius, shaftRadius, rollWidth + shaftLen, Math.round(quality.cylinderSegments / 2)]} />
          <meshStandardMaterial color={SHAFT_COLOR} roughness={0.5} metalness={0.8} />
        </mesh>
        <mesh position={[0, shaftLen * 0.5, 0]}>
          <cylinderGeometry args={[shaftRadius * 0.8, shaftRadius * 0.8, shaftLen, Math.round(quality.cylinderSegments / 2.5)]} />
          <meshStandardMaterial color={SHAFT_COLOR} roughness={0.5} metalness={0.8} />
        </mesh>
      </group>

      <group position={[0, lowerCenterY, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow={quality.enableShadows}>
          <cylinderGeometry args={[rollRadius, rollRadius, rollWidth, quality.cylinderSegments]} />
          <meshStandardMaterial color={LOWER_ROLL_COLOR} roughness={0.3} metalness={0.7} emissive={LOWER_ROLL_COLOR} emissiveIntensity={emissiveIntensity} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[shaftRadius, shaftRadius, rollWidth + shaftLen, Math.round(quality.cylinderSegments / 2)]} />
          <meshStandardMaterial color={SHAFT_COLOR} roughness={0.5} metalness={0.8} />
        </mesh>
        <mesh position={[0, -shaftLen * 0.5, 0]}>
          <cylinderGeometry args={[shaftRadius * 0.8, shaftRadius * 0.8, shaftLen, Math.round(quality.cylinderSegments / 2.5)]} />
          <meshStandardMaterial color={SHAFT_COLOR} roughness={0.5} metalness={0.8} />
        </mesh>
      </group>

      <group>
        <mesh position={[-(rollWidth * 0.5 + FRAME_OFFSET_MM), 0, 0]} castShadow>
          <boxGeometry args={[FRAME_THICKNESS_MM, (rollRadius + shaftLen) * 2 + gap, FRAME_DEPTH_MM]} />
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} metalness={0.5} />
        </mesh>
        <mesh position={[(rollWidth * 0.5 + FRAME_OFFSET_MM), 0, 0]} castShadow>
          <boxGeometry args={[FRAME_THICKNESS_MM, (rollRadius + shaftLen) * 2 + gap, FRAME_DEPTH_MM]} />
          <meshStandardMaterial color={FRAME_COLOR} roughness={0.6} metalness={0.5} />
        </mesh>
      </group>

      {gapSeverity && (
        <mesh position={[rollWidth * 0.5 + FRAME_OFFSET_MM * 2.5, 0, 0]}>
          <boxGeometry args={[15, gap + rollRadius * 0.3, 15]} />
          <meshStandardMaterial color={new THREE.Color(gapColorHex)} emissive={new THREE.Color(gapColorHex)} emissiveIntensity={0.5} transparent opacity={0.7} />
        </mesh>
      )}

      {isActive && (
        <Html position={[0, upperCenterY + rollRadius + 80, 0]} center>
          <div className="bg-blue-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">
            {rt.label} · Ø{formatMM(rp.rollDiameter)}mm
          </div>
          <div className="bg-black/70 text-[9px] font-mono px-1.5 py-0.5 rounded mt-0.5 text-center whitespace-nowrap">
            Gap: <span style={{ color: gapSeverity ? getGapColor(gapSeverity) : "#22c55e" }}>
              {formatMM(rp.gap)}mm
            </span>
            {gapSeverity && (
              <span style={{ color: getGapColor(gapSeverity), marginLeft: 4 }}>
                [{gapSeverity.toUpperCase()}]
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

function ProfileCrossSectionOverlay({
  station,
  stationIndex,
}: {
  station: StationProfile;
  stationIndex: number;
}) {
  const zPos = stationIndex * STATION_SPACING_MM;

  const points = useMemo(() => {
    if (!station.segments || station.segments.length === 0) return [];
    const pts = station.segments.map(seg => new THREE.Vector3(seg.startX, seg.startY, 0));
    const lastSeg = station.segments[station.segments.length - 1];
    if (lastSeg) {
      pts.push(new THREE.Vector3(lastSeg.endX, lastSeg.endY, 0));
    }
    return pts;
  }, [station.segments]);

  if (points.length === 0) return null;

  return (
    <group position={[0, 0, zPos]} rotation={[0, Math.PI / 2, 0]}>
      <Line
        points={points.map(p => [p.x, p.y, p.z] as [number, number, number])}
        color="#22d3ee"
        lineWidth={2}
      />
      <Html position={[0, points.reduce((max, p) => Math.max(max, p.y), -Infinity) + 20, 0]} center>
        <div className="bg-cyan-900/80 text-cyan-300 text-[8px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap">
          {station.bendAngles.map((a, i) => (
            <span key={i}>{i > 0 ? " · " : ""}B{i + 1}:{formatAngle(a)}</span>
          ))}
        </div>
        {station.segmentLengths && station.segmentLengths.length > 0 && (
          <div className="bg-cyan-900/60 text-cyan-200 text-[7px] font-mono px-1 py-0.5 rounded mt-0.5 whitespace-nowrap">
            {station.segmentLengths.map((l, i) => (
              <span key={i}>{i > 0 ? " · " : ""}L{i + 1}:{formatMM(l)}</span>
            ))}
          </div>
        )}
      </Html>
    </group>
  );
}

function MachineBed({
  totalStations,
  rollWidth,
}: {
  totalStations: number;
  rollWidth: number;
}) {
  const length = (totalStations - 1) * STATION_SPACING_MM + 400;
  const width = rollWidth + 300;
  const zCenter = ((totalStations - 1) * STATION_SPACING_MM) / 2;

  return (
    <mesh position={[0, BED_Y_OFFSET_MM, zCenter]} receiveShadow>
      <boxGeometry args={[width, BED_THICKNESS_MM, length]} />
      <meshStandardMaterial color={BED_COLOR} roughness={0.8} metalness={0.3} />
    </mesh>
  );
}

function sampleProfileAtT(segments: { startX: number; startY: number; endX: number; endY: number }[], t: number): { x: number; y: number } {
  if (segments.length === 0) return { x: 0, y: 0 };
  const totalLen = segments.length;
  const pos = t * totalLen;
  const idx = Math.min(Math.floor(pos), totalLen - 1);
  const localT = pos - idx;
  const seg = segments[idx];
  return {
    x: seg.startX + (seg.endX - seg.startX) * localT,
    y: seg.startY + (seg.endY - seg.startY) * localT,
  };
}

function buildStripGeometry(
  stations: StationProfile[],
  totalStationCount: number,
  progress: number,
  stripLength: number
): THREE.BufferGeometry {
  const segmentsPerStation = 20;
  const totalSegments = (totalStationCount - 1) * segmentsPerStation;

  const stripHeadZ = -200 + progress * stripLength;
  const stripTailZ = stripHeadZ - stripLength * 0.6;

  const vertices: number[] = [];
  const indices: number[] = [];
  let prevRingStart = -1;

  for (let i = 0; i <= totalSegments; i++) {
    const t = i / totalSegments;
    const z = t * (totalStationCount - 1) * STATION_SPACING_MM;

    if (z < stripTailZ || z > stripHeadZ) continue;

    const stationFloat = t * (stations.length - 1);
    const stIdx = Math.min(Math.floor(stationFloat), Math.max(0, stations.length - 2));
    const blend = stationFloat - stIdx;

    const st0 = stations[stIdx];
    const st1 = stations[Math.min(stIdx + 1, stations.length - 1)];
    if (!st0 || !st1 || st0.segments.length === 0) continue;

    const ringStart = vertices.length / 3;
    for (let p = 0; p <= PROFILE_POINTS; p++) {
      const pt = p / PROFILE_POINTS;
      const p0 = sampleProfileAtT(st0.segments, pt);
      const p1 = sampleProfileAtT(st1.segments, pt);
      const x = p0.x + (p1.x - p0.x) * blend;
      const y = p0.y + (p1.y - p0.y) * blend;
      vertices.push(x, y, z);
    }

    const ringPointCount = PROFILE_POINTS + 1;
    if (prevRingStart >= 0) {
      for (let p = 0; p < ringPointCount - 1; p++) {
        const a = prevRingStart + p;
        const b = prevRingStart + p + 1;
        const c = ringStart + p;
        const d = ringStart + p + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    prevRingStart = ringStart;
  }

  const geo = new THREE.BufferGeometry();
  if (vertices.length > 0) {
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    if (indices.length > 0) geo.setIndex(indices);
    geo.computeVertexNormals();
  }
  return geo;
}

function AnimatedStrip({
  stations,
  totalStations,
  isPlaying,
  speed,
  onActiveStationChange,
}: {
  stations: StationProfile[];
  totalStations: number;
  isPlaying: boolean;
  speed: number;
  onActiveStationChange: (station: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0.5);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const frameCounter = useRef(0);
  const lastBuiltProgress = useRef(-999);
  const lastReportedStation = useRef(-1);

  useFrame((_, delta) => {
    if (!isPlaying) return;
    progressRef.current += delta * speed * 0.15;
    if (progressRef.current > 1.3) progressRef.current = -0.3;
    frameCounter.current++;

    const stripLength = (totalStations - 1) * STATION_SPACING_MM + 400;
    const stripHeadZ = -200 + progressRef.current * stripLength;
    const currentStation = Math.max(0, Math.min(
      totalStations - 1,
      Math.round(stripHeadZ / STATION_SPACING_MM)
    ));
    if (currentStation !== lastReportedStation.current) {
      lastReportedStation.current = currentStation;
      onActiveStationChange(currentStation);
    }

    if (frameCounter.current % 3 !== 0) return;
    const diff = Math.abs(progressRef.current - lastBuiltProgress.current);
    if (diff < 0.005) return;
    if (stations.length < 2 || !meshRef.current) return;

    const oldGeo = geometryRef.current;
    const newGeo = buildStripGeometry(stations, totalStations, progressRef.current, stripLength);
    meshRef.current.geometry = newGeo;
    geometryRef.current = newGeo;
    lastBuiltProgress.current = progressRef.current;
    if (oldGeo) oldGeo.dispose();
  });

  const initialGeometry = useMemo(() => {
    if (stations.length < 2) return new THREE.BufferGeometry();
    const stripLength = (totalStations - 1) * STATION_SPACING_MM + 400;
    const geo = buildStripGeometry(stations, totalStations, 0.5, stripLength);
    geometryRef.current = geo;
    lastBuiltProgress.current = 0.5;
    return geo;
  }, [stations, totalStations]);

  useEffect(() => {
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
        geometryRef.current = null;
      }
    };
  }, []);

  if (stations.length < 2) {
    const stripLength = (totalStations - 1) * STATION_SPACING_MM + 400;
    const zCenter = ((totalStations - 1) * STATION_SPACING_MM) / 2;
    return (
      <mesh position={[0, 0, zCenter]}>
        <boxGeometry args={[150, 2, stripLength]} />
        <meshStandardMaterial color={STRIP_COLOR} roughness={0.4} metalness={0.6} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  return (
    <mesh ref={meshRef} geometry={initialGeometry}>
      <meshStandardMaterial color={STRIP_COLOR} roughness={0.4} metalness={0.6} transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

function CameraFollower({
  enabled,
  activeStation,
  controlsRef,
}: {
  enabled: boolean;
  activeStation: number;
  controlsRef: React.RefObject<OrbitControlsRef | null>;
}) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!enabled) return;
    const zTarget = activeStation * STATION_SPACING_MM;
    targetPos.current.set(500, 300, zTarget);
    targetLook.current.set(0, 0, zTarget);
    camera.position.lerp(targetPos.current, 0.03);
    const controls = controlsRef.current;
    if (controls && "target" in controls && "update" in controls) {
      (controls.target as THREE.Vector3).lerp(targetLook.current, 0.03);
      (controls as { update: () => void }).update();
    }
  });

  return null;
}

function MeasurementAnnotation({
  points,
}: {
  points: THREE.Vector3[];
}) {
  if (points.length < 2) return null;
  const p1 = points[points.length - 2];
  const p2 = points[points.length - 1];
  const midPoint = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
  const distMM = p1.distanceTo(p2);

  return (
    <group>
      <Line
        points={[[p1.x, p1.y, p1.z], [p2.x, p2.y, p2.z]]}
        color="#ff6b6b"
        lineWidth={2}
        dashed
        dashSize={20}
        gapSize={10}
      />
      <mesh position={[p1.x, p1.y, p1.z]}>
        <sphereGeometry args={[8, 8, 8]} />
        <meshBasicMaterial color="#ff6b6b" />
      </mesh>
      <mesh position={[p2.x, p2.y, p2.z]}>
        <sphereGeometry args={[8, 8, 8]} />
        <meshBasicMaterial color="#ff6b6b" />
      </mesh>
      <Html position={[midPoint.x, midPoint.y + 30, midPoint.z]} center>
        <div className="bg-red-900/90 text-red-200 text-[10px] font-mono font-bold px-2 py-1 rounded border border-red-700/50 whitespace-nowrap">
          {formatMM(distMM)}mm
        </div>
      </Html>
    </group>
  );
}

function ScaleZoomApplier({
  scaleFactor,
  controlsRef,
  zCenter,
}: {
  scaleFactor: number;
  controlsRef: React.RefObject<OrbitControlsRef | null>;
  zCenter: number;
}) {
  const { camera } = useThree();
  const prevScaleRef = useRef(scaleFactor);

  useEffect(() => {
    if (prevScaleRef.current === scaleFactor) return;
    const ratio = prevScaleRef.current / scaleFactor;
    const target = new THREE.Vector3(0, 0, zCenter);
    const offset = camera.position.clone().sub(target);
    offset.multiplyScalar(ratio);
    camera.position.copy(target.clone().add(offset));
    const controls = controlsRef.current;
    if (controls && "update" in controls) {
      (controls as { update: () => void }).update();
    }
    prevScaleRef.current = scaleFactor;
  }, [scaleFactor, camera, controlsRef, zCenter]);

  return null;
}

interface PlaybackState {
  isPlaying: boolean;
  speed: number;
  followCamera: boolean;
  activeStation: number;
}

function PlaybackHUD({
  state,
  totalStations,
  stationLabels,
  onTogglePlay,
  onSpeedChange,
  onToggleFollow,
}: {
  state: PlaybackState;
  totalStations: number;
  stationLabels: string[];
  onTogglePlay: () => void;
  onSpeedChange: (s: number) => void;
  onToggleFollow: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2.5 z-10">
      <button
        onClick={onTogglePlay}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
          state.isPlaying ? "bg-red-600/80 hover:bg-red-500 text-white" : "bg-green-600/80 hover:bg-green-500 text-white"
        }`}
      >
        {state.isPlaying ? "⏸ Pause" : "▶ Play"}
      </button>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-400 font-mono">Speed:</span>
        <input type="range" min={0.25} max={4} step={0.25} value={state.speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))} className="w-20 h-1 accent-blue-500" />
        <span className="text-[10px] text-zinc-300 font-mono w-8">{state.speed}x</span>
      </div>
      <div className="w-px h-5 bg-white/10" />
      <button onClick={onToggleFollow}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-medium border transition-all ${
          state.followCamera ? "bg-blue-500/20 border-blue-500/30 text-blue-300" : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {state.followCamera ? "Following" : "Follow Cam"}
      </button>
      <div className="w-px h-5 bg-white/10" />
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-500 font-mono">Station:</span>
        <span className="text-[11px] text-amber-400 font-bold font-mono">
          {stationLabels[state.activeStation] || `${state.activeStation + 1}/${totalStations}`}
        </span>
      </div>
    </div>
  );
}

function CameraPresetsInScene({
  presets,
  controlsRef,
}: {
  presets: CameraPreset[];
  controlsRef: React.RefObject<OrbitControlsRef | null>;
}) {
  const { camera } = useThree();

  const setPreset = useCallback((preset: CameraPreset) => {
    camera.position.set(...preset.position);
    const controls = controlsRef.current;
    if (controls && "target" in controls && "update" in controls) {
      (controls.target as THREE.Vector3).set(...preset.target);
      (controls as { update: () => void }).update();
    }
  }, [camera, controlsRef]);

  return (
    <Html position={[0, 0, 0]} style={{ pointerEvents: "none" }} zIndexRange={[100, 0]}>
      <div style={{ position: "fixed", top: 8, right: 100, pointerEvents: "auto" }}>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button key={p.key} onClick={() => setPreset(p)}
              className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[9px] font-mono px-2 py-1 rounded border border-zinc-600/50"
              title={p.name}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </Html>
  );
}

function ExportButton({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `rollforming-viewport-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
  }, [canvasRef]);

  return (
    <button onClick={handleExport}
      className="bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[10px] font-mono px-2 py-1 rounded border border-zinc-600/50"
      title="Export viewport as PNG"
    >
      Export PNG
    </button>
  );
}

export function RollFormingViewport3D() {
  const { rollTooling, stations, rollGaps, materialThickness } = useCncStore();
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const quality = useMemo(() => getQualitySettings(), []);

  const [engineeringScale, setEngineeringScale] = useState<EngineeringScale>("1:1");
  const [showCrossSections, setShowCrossSections] = useState(true);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);

  const scaleFactor = useMemo(() => getScaleFactor(engineeringScale), [engineeringScale]);

  const totalStations = rollTooling.length;
  const zCenter = ((totalStations - 1) * STATION_SPACING_MM) / 2;

  const initialStation = useMemo(() => {
    const stripLength = (rollTooling.length - 1) * STATION_SPACING_MM + 400;
    const stripHeadZ = -200 + 0.5 * stripLength;
    return Math.max(0, Math.min(rollTooling.length - 1, Math.round(stripHeadZ / STATION_SPACING_MM)));
  }, [rollTooling.length]);

  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    speed: 1,
    followCamera: false,
    activeStation: initialStation,
  });

  const handleActiveStationChange = useCallback((station: number) => {
    setPlayback((p) => p.activeStation === station ? p : { ...p, activeStation: station });
  }, []);

  const handleMeasurePoint = useCallback((point: THREE.Vector3) => {
    setMeasurePoints(prev => prev.length >= 2 ? [point] : [...prev, point]);
  }, []);

  const stationLabels = useMemo(() => rollTooling.map((rt) => rt.label ?? `Station ${rt.stationNumber ?? ""}`), [rollTooling]);

  const gapSeverities = useMemo(() => {
    return rollTooling.map((_, i) => {
      const gap = rollGaps[i];
      if (!gap) return null;
      return getGapSeverity(gap.springbackGap, materialThickness);
    });
  }, [rollTooling, rollGaps, materialThickness]);

  const cameraPresets = useMemo(() => {
    const dist = Math.max(500, totalStations * STATION_SPACING_MM * 0.4);
    return getCameraPresets(0, 0, zCenter, dist);
  }, [zCenter, totalStations]);

  const initialCamDist = Math.max(500, totalStations * STATION_SPACING_MM * 0.3);

  return (
    <div className="w-full h-full bg-[#0a0a16] relative">
      <Canvas
        ref={canvasRef}
        shadows={quality.enableShadows}
        camera={{
          position: [initialCamDist * 0.8, initialCamDist * 0.6, zCenter - initialCamDist * 0.4],
          fov: 50,
          near: 1,
          far: 100000,
        }}
        gl={{
          antialias: quality.antialias,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: isDedicatedGPU() ? 1.2 : 1.0,
          preserveDrawingBuffer: true,
          powerPreference: isDedicatedGPU() ? "high-performance" : "default",
          stencil: isDedicatedGPU(),
          depth: true,
          logarithmicDepthBuffer: isDedicatedGPU(),
        }}
        dpr={quality.pixelRatio}
        style={{ background: "#080812" }}
      >
        <color attach="background" args={["#080812"]} />
        <fog attach="fog" args={["#080812", 3000, 15000]} />

        <ambientLight intensity={0.35} />
        <directionalLight
          position={[1000, 1500, 800]}
          intensity={1.2}
          castShadow={quality.enableShadows}
          shadow-mapSize-width={quality.shadowMapSize}
          shadow-mapSize-height={quality.shadowMapSize}
          shadow-camera-far={6000}
          shadow-camera-left={-1500}
          shadow-camera-right={1500}
          shadow-camera-top={1500}
          shadow-camera-bottom={-1500}
        />
        <pointLight position={[-500, 500, -500]} intensity={0.4} color="#4488ff" />
        {quality.maxLights >= 3 && (
          <pointLight position={[500, 200, totalStations * STATION_SPACING_MM]} intensity={0.3} color="#ff8844" />
        )}

        {rollTooling.map((rt, idx) => (
          <RollStation
            key={rt.stationNumber}
            rt={rt}
            stationIndex={idx}
            isActive={idx === playback.activeStation}
            quality={quality}
            gapSeverity={gapSeverities[idx]}
          />
        ))}

        {showCrossSections && stations.map((st, idx) => (
          <ProfileCrossSectionOverlay key={st.stationNumber} station={st} stationIndex={idx} />
        ))}

        <MachineBed totalStations={totalStations} rollWidth={rollTooling[0]?.rollProfile?.rollWidth ?? 100} />

        <AnimatedStrip
          stations={stations}
          totalStations={totalStations}
          isPlaying={playback.isPlaying}
          speed={playback.speed}
          onActiveStationChange={handleActiveStationChange}
        />

        <CameraFollower enabled={playback.followCamera} activeStation={playback.activeStation} controlsRef={controlsRef} />

        <ScaleZoomApplier scaleFactor={scaleFactor} controlsRef={controlsRef} zCenter={zCenter} />

        {measurePoints.length >= 2 && <MeasurementAnnotation points={measurePoints} />}

        {measureMode && (
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, zCenter]}
            visible={false}
            onClick={(e) => { e.stopPropagation(); handleMeasurePoint(e.point.clone()); }}
          >
            <planeGeometry args={[10000, 10000]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y_MM, zCenter]} receiveShadow>
          <planeGeometry args={[5000, 5000]} />
          <meshStandardMaterial color="#0d0d1a" roughness={1} metalness={0} />
        </mesh>

        <Grid
          args={[5000, 5000]}
          position={[0, FLOOR_Y_MM + 0.1, zCenter]}
          cellColor="#1a1a2e"
          sectionColor="#2a2a44"
          sectionSize={100}
          cellSize={10}
          fadeDistance={3000}
          fadeStrength={1.5}
          infiniteGrid
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          panSpeed={0.8}
          zoomSpeed={1.2}
          rotateSpeed={0.7}
          target={[0, 0, zCenter]}
        />

        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport axisColors={["#ff4444", "#44ff44", "#4488ff"]} labelColor="white" />
        </GizmoHelper>

        <CameraPresetsInScene presets={cameraPresets} controlsRef={controlsRef} />
      </Canvas>

      <PlaybackHUD
        state={playback}
        totalStations={totalStations}
        stationLabels={stationLabels}
        onTogglePlay={() => setPlayback((p) => ({ ...p, isPlaying: !p.isPlaying }))}
        onSpeedChange={(speed) => setPlayback((p) => ({ ...p, speed }))}
        onToggleFollow={() => setPlayback((p) => ({ ...p, followCamera: !p.followCamera }))}
      />

      <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 font-mono">Scale:</span>
            <select
              value={engineeringScale}
              onChange={(e) => setEngineeringScale(e.target.value as EngineeringScale)}
              className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-[10px] font-mono rounded px-1.5 py-0.5"
            >
              {ENGINEERING_SCALES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowCrossSections(!showCrossSections)}
            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
              showCrossSections ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300" : "bg-zinc-800/80 border-zinc-600/50 text-zinc-400"
            }`}
          >
            Profiles
          </button>
          <button
            onClick={() => { setMeasureMode(!measureMode); if (!measureMode) setMeasurePoints([]); }}
            className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
              measureMode ? "bg-red-500/20 border-red-500/30 text-red-300" : "bg-zinc-800/80 border-zinc-600/50 text-zinc-400"
            }`}
          >
            Measure
          </button>
          <ExportButton canvasRef={canvasRef} />
        </div>

        <div className="text-[10px] text-zinc-600 font-mono bg-black/40 px-2 py-1 rounded pointer-events-none">
          {totalStations} stations · {totalStations * 2} rolls · Scale: {engineeringScale} · 1 unit = 1mm · Quality: {quality.tier}
        </div>
        <div className="text-[10px] text-zinc-600 font-mono bg-black/40 px-2 py-1 rounded pointer-events-none">
          Orbit: LMB | Pan: RMB | Zoom: Scroll{measureMode ? " | Click to measure" : ""} · Grid: 10mm/100mm
        </div>
        {measurePoints.length === 2 && (
          <div className="text-[10px] text-red-400 font-mono bg-black/60 px-2 py-1 rounded pointer-events-none">
            Distance: {formatMM(measurePoints[0].distanceTo(measurePoints[1]))}mm
          </div>
        )}
      </div>

      {rollGaps.length > 0 && (
        <div className="absolute top-3 right-3 flex flex-col gap-1 z-10 pointer-events-none">
          <div className="text-[10px] font-mono bg-black/60 px-2 py-1 rounded">
            <span className="text-zinc-400">Gap: </span>
            <span className="text-green-400">■ Safe </span>
            <span className="text-yellow-400">■ Tight </span>
            <span className="text-red-400">■ Critical</span>
          </div>
          {rollGaps.map((gap, i) => {
            const severity = gapSeverities[i];
            if (!severity) return null;
            return (
              <div key={gap.stationNumber} className="text-[9px] font-mono bg-black/50 px-2 py-0.5 rounded flex justify-between gap-3">
                <span className="text-zinc-500">{gap.label}</span>
                <span style={{ color: getGapColor(severity) }}>
                  {formatMM(gap.springbackGap)}mm [{severity}]
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
