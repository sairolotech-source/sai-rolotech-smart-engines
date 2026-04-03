/**
 * RollForming3DPanel.tsx
 * Live 3D roll-forming machine simulation using @react-three/fiber v9.5.0.
 *
 * Data source: pipelineResult.roll_contour_engine.passes[]
 *   Each pass now includes:
 *   - profile_centerline: [{x,y}]  ← REAL geometry from section_centerline()
 *   - contact_points:     [{x,y}]  ← bend vertices (strip↔roll contact)
 *   - upper_roll_profile / lower_roll_profile (2D groove cross-section)
 *   - upper_roll_radius_mm / lower_roll_radius_mm / roll_width_mm / groove_depth_mm
 *
 * Coordinate convention inside each station group (at z = stationZ):
 *   X → roll face width direction
 *   Y → vertical (roll stacking)
 *   Z → cross-section width (profile_centerline.x maps here)
 */

import {
  useState, useRef, useEffect, useCallback, useMemo, Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Box, Eye, EyeOff, RotateCcw, Settings2, Layers3, Camera,
} from "lucide-react";

// ─── Scale ───────────────────────────────────────────────────────────────────
const S          = 0.065;   // 1 unit ≈ 15 mm
const STATION_Z  = 22;      // units between stations
const ROLL_SEGS  = 40;
const FACE_W     = 4.5;     // default roll face half-width (units)

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
interface Pt2  { x: number; y: number }

interface PassData {
  pass_no:              number;
  station_label:        string;
  target_angle_deg:     number;
  roll_gap_mm:          number;
  strip_width_mm?:      number;
  stage_type:           string;
  upper_roll_radius_mm: number;
  lower_roll_radius_mm: number;
  roll_width_mm:        number;
  groove_depth_mm:      number;
  profile_centerline?:  Pt2[];   // ← real geometry
  contact_points?:      Pt2[];   // ← real contact geometry
  upper_roll_profile?:  Pt2[] | null;
  lower_roll_profile?:  Pt2[] | null;
}

interface RollContourData {
  passes?:          PassData[];
  forming_summary?: { flat_strip_width_mm?: number };
  thickness_mm?:    number;
  material?:        string;
}

interface Props {
  rollContour:  RollContourData | null;
  webMm?:       number;
  flangeMm?:    number;
  thicknessMm?: number;
  material?:    string;
}

// ─── Geometry builders ────────────────────────────────────────────────────────

/**
 * Build a thick ribbon THREE.BufferGeometry from a 2D centerline.
 * profile.x → Z axis, profile.y → Y axis, extrusion → X axis [−fw..+fw].
 */
function buildRibbonGeometry(
  pts:       Pt2[],
  thickness: number,   // mm
  faceWidth: number,   // mm (total roll face)
): THREE.BufferGeometry {
  const n  = pts.length;
  if (n < 2) return new THREE.BufferGeometry();

  const t  = (thickness / 2) * S;
  const fw = faceWidth * S;
  const hw = fw / 2;

  // Per-point normals in YZ plane (perpendicular to centerline tangent)
  const ny: number[] = [];
  const nz: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    const dz = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dz * dz + dy * dy) || 1;
    ny.push(-dy / len);
    nz.push(dz / len);
  }

  // 4 vertices per point: [front-inner, front-outer, back-inner, back-outer]
  //   front = x = −hw, back = x = +hw
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    const pz = pts[i].x * S;
    const py = pts[i].y * S;
    positions.push(-hw, py - ny[i] * t, pz - nz[i] * t);  // [0] front-inner
    positions.push(-hw, py + ny[i] * t, pz + nz[i] * t);  // [1] front-outer
    positions.push( hw, py - ny[i] * t, pz - nz[i] * t);  // [2] back-inner
    positions.push( hw, py + ny[i] * t, pz + nz[i] * t);  // [3] back-outer
  }

  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const b = i * 4;
    // outer surface
    indices.push(b+1, b+5, b+3,  b+5, b+7, b+3);
    // inner surface (reversed winding)
    indices.push(b+0, b+2, b+4,  b+0, b+4, b+6);  // wait — need same winding
    // front cap strip (x = −hw)
    indices.push(b+0, b+4, b+5,  b+0, b+5, b+1);
    // back cap strip  (x = +hw)
    indices.push(b+2, b+3, b+7,  b+2, b+7, b+6);
  }
  // left end-cap  (i=0)
  indices.push(0, 1, 3,  0, 3, 2);
  // right end-cap (i=n-1)
  const lb = (n - 1) * 4;
  indices.push(lb+0, lb+2, lb+3,  lb+0, lb+3, lb+1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ─── Scene sub-components ─────────────────────────────────────────────────────

function RibbonMesh({
  pts, thickness, faceWidth, color, opacity = 1,
}: {
  pts: Pt2[]; thickness: number; faceWidth: number; color: string; opacity?: number;
}) {
  const geo = useMemo(
    () => buildRibbonGeometry(pts, thickness, faceWidth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pts.length, thickness, faceWidth, pts.map(p => `${p.x},${p.y}`).join("|")],
  );
  useEffect(() => () => { geo.dispose(); }, [geo]);

  return (
    <mesh geometry={geo} castShadow>
      <meshStandardMaterial
        color={color}
        metalness={0.5}
        roughness={0.45}
        transparent={opacity < 1}
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/** Fallback strip when profile_centerline is not available. */
function FallbackStrip({
  angle_deg, webMm, flangeMm, thicknessMm, color, opacity = 1,
}: {
  angle_deg: number; webMm: number; flangeMm: number; thicknessMm: number;
  color: string; opacity?: number;
}) {
  const t  = thicknessMm * S;
  const w  = webMm * S;
  const f  = flangeMm * S;
  const fw = FACE_W * 2;
  const th = (angle_deg * Math.PI) / 180;
  const lz = -(w / 2 + Math.cos(th) * f / 2);
  const ly =  Math.sin(th) * f / 2;
  const rz =   w / 2 + Math.cos(th) * f / 2;
  const ry =  Math.sin(th) * f / 2;

  const mat = (
    <meshStandardMaterial
      color={color} metalness={0.55} roughness={0.45}
      transparent={opacity < 1} opacity={opacity} />
  );
  return (
    <group>
      <mesh><boxGeometry args={[fw, t, w]} />{mat}</mesh>
      <mesh position={[0, ly, lz]} rotation={[-(Math.PI / 2 - th), 0, 0]}>
        <boxGeometry args={[fw, t, f]} />{mat}
      </mesh>
      <mesh position={[0, ry, rz]} rotation={[Math.PI / 2 - th, 0, 0]}>
        <boxGeometry args={[fw, t, f]} />{mat}
      </mesh>
    </group>
  );
}

function Roll({
  radius, width, posY, color, emissiveColor, emissiveIntensity = 0,
}: {
  radius: number; width: number; posY: number;
  color: string; emissiveColor: string; emissiveIntensity?: number;
}) {
  return (
    <mesh position={[0, posY, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[radius, radius, width, ROLL_SEGS]} />
      <meshStandardMaterial
        color={color} metalness={0.85} roughness={0.15}
        emissive={emissiveColor} emissiveIntensity={emissiveIntensity} />
    </mesh>
  );
}

function RollShaft({ upperY, lowerY }: { upperY: number; lowerY: number }) {
  const h = Math.abs(upperY - lowerY);
  return (
    <mesh position={[0, (upperY + lowerY) / 2, 0]} castShadow>
      <cylinderGeometry args={[0.25, 0.25, h, 12]} />
      <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
    </mesh>
  );
}

/** Translucent band representing the roll gap zone. */
function RollGapBand({
  upperY, lowerY, rollWidth,
}: {
  upperY: number; lowerY: number; rollWidth: number;
}) {
  const bandH  = Math.max(0.02, (upperY - lowerY) * 0.9);
  const midY   = (upperY + lowerY) / 2;
  const bandW  = rollWidth * S * 0.95;
  return (
    <mesh position={[0, midY, 0]}>
      <boxGeometry args={[bandW, bandH, 0.15]} />
      <meshStandardMaterial
        color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3}
        transparent opacity={0.12} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Glowing sphere at each strip↔roll contact point. */
function ContactSpheres({
  pts, thicknessMm, color,
}: {
  pts: Pt2[]; thicknessMm: number; color: string;
}) {
  const r = Math.max(0.18, thicknessMm * S * 0.6);
  return (
    <>
      {pts.map((p, i) => (
        <mesh key={i} position={[0, p.y * S, p.x * S]}>
          <sphereGeometry args={[r, 12, 12]} />
          <meshStandardMaterial
            color={color} emissive={color} emissiveIntensity={1.2}
            transparent opacity={0.9} />
        </mesh>
      ))}
    </>
  );
}

/** Groove engagement arc: a torus ring on the roll surface at the groove. */
function GrooveEngagementArc({
  rollRadius, posY, grooveDepth, color,
}: {
  rollRadius: number; posY: number; grooveDepth: number; color: string;
}) {
  const r  = rollRadius - grooveDepth * S * 0.5;
  if (r <= 0.1) return null;
  return (
    <mesh position={[0, posY, 0]} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[r, 0.08, 8, 60, Math.PI * 0.75]} />
      <meshStandardMaterial
        color={color} emissive={color} emissiveIntensity={0.9}
        transparent opacity={0.65} />
    </mesh>
  );
}

function BaseFrame() {
  return (
    <group>
      {[-6, 6].map(x => (
        <mesh key={x} position={[x, -2.5, 0]}>
          <boxGeometry args={[1, 15, 1]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[14, 0.8, 0.9]} />
        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
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

function RendererRef({ glRef }: { glRef: React.MutableRefObject<THREE.WebGLRenderer | null> }) {
  const { gl } = useThree();
  useEffect(() => { glRef.current = gl; }, [gl, glRef]);
  return null;
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function Scene({
  passes, thicknessMm, fallbackWebMm, fallbackFlangeMm,
  activeIdx, showStrip, showRolls, showContact, autoRotate, glRef,
}: {
  passes:          PassData[];
  thicknessMm:     number;
  fallbackWebMm:   number;
  fallbackFlangeMm: number;
  activeIdx:       number;
  showStrip:       boolean;
  showRolls:       boolean;
  showContact:     boolean;
  autoRotate:      boolean;
  glRef:           React.MutableRefObject<THREE.WebGLRenderer | null>;
}) {
  const n = passes.length;
  if (!n) return null;
  const totalZ = (n - 1) * STATION_Z;

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[20, 30, 10]} intensity={1.2} castShadow />
      <directionalLight position={[-15, 20, -10]} intensity={0.5} color="#b0c4de" />
      <pointLight position={[0, 10, totalZ / 2]} intensity={0.8} color="#4488ff" />

      <Grid
        args={[200, 200]}
        position={[0, -11, totalZ / 2]}
        cellColor="#1e293b" sectionColor="#1e3a5f"
        cellSize={5} sectionSize={STATION_Z}
        infiniteGrid={false} fadeDistance={120}
      />

      <MachineBed totalZ={totalZ} />
      <CameraRig targetZ={activeIdx * STATION_Z} autoRotate={autoRotate} />
      <RendererRef glRef={glRef} />

      {passes.map((pass, i) => {
        const z        = i * STATION_Z;
        const isActive = i === activeIdx;
        const stageCol = STAGE_COL[pass.stage_type] ?? "#60a5fa";
        const uR  = Math.max(pass.upper_roll_radius_mm, 10) * S;
        const lR  = Math.max(pass.lower_roll_radius_mm, 10) * S;
        const rW  = Math.max(pass.roll_width_mm, fallbackWebMm + 20) * S;
        const gap = pass.roll_gap_mm * S;
        const uY  = gap / 2 + uR;
        const lY  = -(gap / 2 + lR);
        const cl  = pass.profile_centerline ?? [];
        const cp  = pass.contact_points    ?? [];
        const hasRealGeometry = cl.length >= 2;

        return (
          <group key={i} position={[0, 0, z]}>
            <BaseFrame />

            {/* ── Rolls ─────────────────────────────────────────────── */}
            {showRolls && (
              <>
                <Roll
                  radius={uR} width={rW} posY={uY}
                  color={isActive ? "#3b82f6" : "#1e40af"}
                  emissiveColor={isActive ? "#2040ff" : "#000"}
                  emissiveIntensity={isActive ? 0.5 : 0}
                />
                <Roll
                  radius={lR} width={rW} posY={lY}
                  color={isActive ? "#22c55e" : "#14532d"}
                  emissiveColor={isActive ? "#106030" : "#000"}
                  emissiveIntensity={isActive ? 0.45 : 0}
                />
                <RollShaft upperY={uY} lowerY={lY} />

                {/* Roll gap band — yellow zone between rolls */}
                <RollGapBand upperY={uY} lowerY={lY} rollWidth={pass.roll_width_mm} />

                {/* Groove engagement arcs */}
                {isActive && (
                  <>
                    <GrooveEngagementArc
                      rollRadius={uR} posY={uY}
                      grooveDepth={pass.groove_depth_mm}
                      color="#3b82f6"
                    />
                    <GrooveEngagementArc
                      rollRadius={lR} posY={lY}
                      grooveDepth={pass.groove_depth_mm}
                      color="#22c55e"
                    />
                  </>
                )}
              </>
            )}

            {/* ── Strip — real geometry if available ─────────────── */}
            {showStrip && (
              hasRealGeometry ? (
                <RibbonMesh
                  pts={cl}
                  thickness={thicknessMm}
                  faceWidth={pass.roll_width_mm}
                  color={isActive ? "#f8fafc" : (stageCol)}
                  opacity={isActive ? 1 : 0.3}
                />
              ) : (
                <FallbackStrip
                  angle_deg={pass.target_angle_deg}
                  webMm={fallbackWebMm}
                  flangeMm={fallbackFlangeMm}
                  thicknessMm={thicknessMm}
                  color={isActive ? "#f8fafc" : stageCol}
                  opacity={isActive ? 1 : 0.3}
                />
              )
            )}

            {/* ── Contact points ─────────────────────────────────── */}
            {showContact && isActive && cp.length > 0 && (
              <ContactSpheres pts={cp} thicknessMm={thicknessMm} color="#ef4444" />
            )}

            {/* ── Pass line ──────────────────────────────────────── */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[9, 0.04, 0.06]} />
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
            </mesh>

            {/* ── Active station glow ring ───────────────────────── */}
            {isActive && (
              <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[uR + 2.5, 0.12, 12, 80]} />
                <meshStandardMaterial
                  color={stageCol} emissive={stageCol} emissiveIntensity={1.2}
                  transparent opacity={0.7} />
              </mesh>
            )}

            {/* ── Station label ──────────────────────────────────── */}
            <Text
              position={[0, -9, 0]}
              fontSize={0.85}
              color={isActive ? stageCol : "#334155"}
              anchorX="center" anchorY="top"
              renderOrder={1}
            >
              {`S${pass.pass_no} ${pass.target_angle_deg.toFixed(0)}°`}
            </Text>

            {/* ── Real geometry badge ────────────────────────────── */}
            {isActive && hasRealGeometry && (
              <Text
                position={[0, -10.5, 0]}
                fontSize={0.55}
                color="#22c55e"
                anchorX="center" anchorY="top"
              >
                ✓ REAL GEOMETRY
              </Text>
            )}
          </group>
        );
      })}
    </>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
type AnimSpeed = "slow" | "normal" | "fast";
const SPEED_MS: Record<AnimSpeed, number> = { slow: 1800, normal: 1000, fast: 450 };

export default function RollForming3DPanel({
  rollContour, webMm = 60, flangeMm = 40, thicknessMm = 1.5, material = "GI",
}: Props) {
  const passes      = rollContour?.passes ?? [];
  const flatStrip   = rollContour?.forming_summary?.flat_strip_width_mm;
  const mat         = rollContour?.material ?? material;
  const n           = passes.length;

  const [activeIdx,   setActiveIdx]   = useState(0);
  const [playing,     setPlaying]     = useState(false);
  const [animSpeed,   setAnimSpeed]   = useState<AnimSpeed>("normal");
  const [showStrip,   setShowStrip]   = useState(true);
  const [showRolls,   setShowRolls]   = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [autoRotate,  setAutoRotate]  = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const glRef       = useRef<THREE.WebGLRenderer | null>(null);

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

  const handleScreenshot = useCallback(() => {
    if (!glRef.current) return;
    const url = glRef.current.domElement.toDataURL("image/png");
    const a   = document.createElement("a");
    a.href    = url;
    a.download = `station-${activeIdx + 1}-3d.png`;
    a.click();
  }, [activeIdx]);

  const cur      = passes[activeIdx];
  const stageCol = cur ? (STAGE_COL[cur.stage_type] ?? "#60a5fa") : "#60a5fa";
  const hasReal  = (cur?.profile_centerline?.length ?? 0) >= 2;

  if (!n) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-[#0a0a14] p-6">
        <div className="flex items-center gap-2 mb-3">
          <Layers3 className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-bold text-violet-300 uppercase tracking-wider">3D Roll Forming Simulation</span>
          <span className="ml-auto text-[10px] text-gray-600 font-mono">Three.js · R3F v9</span>
        </div>
        <div className="h-36 flex flex-col items-center justify-center text-center gap-2 text-gray-600">
          <Box className="w-8 h-8 opacity-30" />
          <p className="text-xs">Run the pipeline to launch the 3D simulation.</p>
          <p className="text-[10px] text-gray-700">Real profile geometry · Contact points · Groove engagement</p>
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
            {hasReal && <span className="ml-2 text-green-500">· REAL GEOMETRY</span>}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setShowStrip(s => !s)}
            className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
              showStrip ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-gray-700 text-gray-600"
            }`}>
            {showStrip ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Strip
          </button>
          <button onClick={() => setShowRolls(s => !s)}
            className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
              showRolls ? "border-blue-500/40 bg-blue-500/10 text-blue-300" : "border-gray-700 text-gray-600"
            }`}>
            {showRolls ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Rolls
          </button>
          <button onClick={() => setShowContact(s => !s)}
            className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
              showContact ? "border-red-500/40 bg-red-500/10 text-red-300" : "border-gray-700 text-gray-600"
            }`}>
            {showContact ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Contact
          </button>
          <button onClick={() => setAutoRotate(s => !s)}
            className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
              autoRotate ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-gray-700 text-gray-600"
            }`}>
            <RotateCcw className="w-3 h-3" /> Orbit
          </button>
          <button onClick={handleScreenshot}
            className="p-1.5 rounded border text-[10px] flex items-center gap-1 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors">
            <Camera className="w-3 h-3" /> PNG
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ height: 460, background: "#07080f" }}>
        <Canvas
          shadows
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          camera={{ position: [0, 18, -20], fov: 52, near: 0.1, far: 500 }}
          style={{ background: "#07080f" }}
        >
          <Suspense fallback={null}>
            <Scene
              passes={passes}
              thicknessMm={thicknessMm}
              fallbackWebMm={webMm}
              fallbackFlangeMm={flangeMm}
              activeIdx={activeIdx}
              showStrip={showStrip}
              showRolls={showRolls}
              showContact={showContact}
              autoRotate={autoRotate}
              glRef={glRef}
            />
          </Suspense>
          <OrbitControls
            enabled={!autoRotate}
            enablePan enableZoom enableRotate
            maxPolarAngle={Math.PI / 1.6}
            minDistance={5} maxDistance={180}
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
          style={{ background: stageCol + "20", color: stageCol, border: `1px solid ${stageCol}40` }}>
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

        <div className="flex-1 mx-2">
          <input type="range" min={0} max={Math.max(0, n - 1)} value={activeIdx}
            onChange={e => { go(Number(e.target.value)); setPlaying(false); }}
            className="w-full cursor-pointer" style={{ accentColor: stageCol }} />
        </div>

        {cur && (
          <div className="text-[10px] font-mono shrink-0 text-right min-w-[110px]">
            <div style={{ color: stageCol }} className="font-semibold">{cur.station_label}</div>
            <div className="text-gray-600">{cur.target_angle_deg.toFixed(1)}° · {activeIdx + 1}/{n}</div>
          </div>
        )}

        <div className="flex items-center gap-0.5 border border-gray-800 rounded px-1.5 py-1 shrink-0">
          <Settings2 className="w-2.5 h-2.5 text-gray-700" />
          {(["slow","normal","fast"] as AnimSpeed[]).map(s => (
            <button key={s} onClick={() => setAnimSpeed(s)}
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                animSpeed === s ? "bg-violet-500/20 text-violet-300" : "text-gray-700 hover:text-gray-400"
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Station pills */}
      <div className="px-4 pb-3 flex gap-1 overflow-x-auto">
        {passes.map((p, i) => {
          const sc = STAGE_COL[p.stage_type] ?? "#60a5fa";
          const hasRealPt = (p.profile_centerline?.length ?? 0) >= 2;
          return (
            <button key={i} onClick={() => { go(i); setPlaying(false); }}
              title={`${p.station_label} — ${p.target_angle_deg.toFixed(0)}° ${hasRealPt ? "✓" : "~"}`}
              className="shrink-0 w-6 h-6 rounded-full text-[8px] font-bold transition-all border relative"
              style={i === activeIdx
                ? { background: sc + "40", borderColor: sc, color: sc }
                : { background: "transparent", borderColor: "#1e293b", color: "#475569" }}>
              {p.pass_no}
              {hasRealPt && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Per-station info grid */}
      {cur && (
        <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            ["Angle",           `${cur.target_angle_deg.toFixed(1)}°`,                     stageCol],
            ["Upper Ø",         `${(cur.upper_roll_radius_mm * 2).toFixed(0)} mm`,         "#60a5fa"],
            ["Lower Ø",         `${(cur.lower_roll_radius_mm * 2).toFixed(0)} mm`,         "#4ade80"],
            ["Roll gap",        `${cur.roll_gap_mm.toFixed(2)} mm`,                        "#fbbf24"],
            ["Groove depth",    `${cur.groove_depth_mm.toFixed(2)} mm`,                    "#a78bfa"],
            ["Roll width",      `${cur.roll_width_mm.toFixed(1)} mm`,                      "#94a3b8"],
            ["Profile pts",     hasReal ? `${cur.profile_centerline!.length} pts (real)` : "fallback", hasReal ? "#22c55e" : "#6b7280"],
            ["Contact pts",     cur.contact_points?.length ? `${cur.contact_points.length} pts` : "—", "#ef4444"],
          ] as [string, string, string][]).map(([label, value, color]) => (
            <div key={label} className="rounded-lg bg-[#0d1117] border border-gray-800 px-2.5 py-1.5">
              <div className="text-[9px] text-gray-600 uppercase tracking-wider">{label}</div>
              <div className="text-xs font-mono font-semibold mt-0.5" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
