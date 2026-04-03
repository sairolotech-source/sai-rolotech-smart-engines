import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, GizmoHelper, GizmoViewport, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  Play, Pause, SkipBack, SkipForward, Upload, Zap,
  ChevronRight, AlertTriangle, CheckCircle, RotateCcw,
  Crosshair, Layers, Activity, Settings2, Download,
  Cpu, Link2,
} from "lucide-react";
import { useCncStore } from "../../store/useCncStore";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Move {
  lineNo: number;
  type: "G00" | "G01" | "G02" | "G03" | "G28" | "OTHER";
  x: number; y: number; z: number;
  f: number; s: number;
  r?: number; i?: number; j?: number; k?: number;
  isRapid: boolean; raw: string;
  dist: number;
  timeMs: number;
  tool: number;
}

interface Alarm { level: "error" | "warn" | "info"; msg: string; line: number; }

type ViewMode = "3d" | "top" | "front" | "right";
type MachineMode = "lathe" | "milling";

// ─── G-Code Parser ─────────────────────────────────────────────────────────────

function parseGCode(code: string): { moves: Move[]; alarms: Alarm[] } {
  const lines = code.split("\n");
  const moves: Move[] = [];
  const alarms: Alarm[] = [];
  let cx = 0, cy = 0, cz = 100, cf = 200, cs = 1000;
  let modal: "G00" | "G01" | "G02" | "G03" = "G00";
  let currentTool = 1;
  let prevZ = cz;
  let cumTime = 0;

  const num = (upper: string, re: RegExp): number | undefined => {
    const m = upper.match(re);
    return m ? parseFloat(m[1]) : undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("%") || raw.match(/^O\d+/)) continue;
    const upper = raw.toUpperCase().replace(/\(.*?\)/g, "").replace(/;.*/g, "").trim();
    if (!upper) continue;

    const allG = [...upper.matchAll(/G0*(\d+\.?\d*)/g)].map(m => parseFloat(m[1]));
    const xv = num(upper, /X(-?\d+\.?\d*)/);
    const yv = num(upper, /Y(-?\d+\.?\d*)/);
    const zv = num(upper, /Z(-?\d+\.?\d*)/);
    const fv = num(upper, /F(\d+\.?\d*)/);
    const sv = num(upper, /S(\d+)/);
    const rv = num(upper, /R(-?\d+\.?\d*)/);
    const iv = num(upper, /I(-?\d+\.?\d*)/);
    const jv = num(upper, /J(-?\d+\.?\d*)/);
    const kv = num(upper, /K(-?\d+\.?\d*)/);
    const tv = num(upper, /T(\d+)/);

    if (fv !== undefined) cf = fv;
    if (sv !== undefined) cs = sv;
    if (tv !== undefined) currentTool = Math.floor(tv / 100) || Math.floor(tv);

    for (const gn of allG) {
      if (gn === 0) modal = "G00";
      else if (gn === 1) modal = "G01";
      else if (gn === 2) modal = "G02";
      else if (gn === 3) modal = "G03";
    }

    if (allG.includes(28)) {
      moves.push({ lineNo: i + 1, type: "G28", x: 0, y: 0, z: 0, f: cf, s: cs, isRapid: true, raw, dist: 0, timeMs: 0, tool: currentTool });
      cx = 0; cy = 0; cz = 0;
      continue;
    }

    const newX = xv ?? cx;
    const newY = yv ?? cy;
    const newZ = zv ?? cz;
    const moved = newX !== cx || newY !== cy || newZ !== cz;
    if (!moved) continue;

    const dx = newX - cx, dy = newY - cy, dz = newZ - cz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const feedMmMin = modal === "G00" ? 5000 : (cf > 10 ? cf * 1000 : cf * 1000);
    const timeMs = (dist / Math.max(feedMmMin, 1)) * 60000;
    cumTime += timeMs;

    if (modal === "G01" && newX < 0) alarms.push({ level: "warn", msg: `Negative X diameter at line ${i + 1}`, line: i + 1 });
    if (newZ > prevZ + 20 && modal === "G01") alarms.push({ level: "info", msg: `Large Z retract at line ${i + 1}`, line: i + 1 });

    moves.push({ lineNo: i + 1, type: modal, x: newX, y: newY, z: newZ, f: cf, s: cs, r: rv, i: iv, j: jv, k: kv, isRapid: modal === "G00", raw, dist, timeMs, tool: currentTool });
    cx = newX; cy = newY; cz = newZ; prevZ = cz;
  }

  const totalCycleTime = moves.reduce((a, b) => a + b.timeMs, 0);
  if (totalCycleTime > 3600000) alarms.push({ level: "warn", msg: "Cycle time > 1 hour — check feed rates", line: 0 });

  return { moves, alarms };
}

// ─── Arc interpolation (for G02/G03) ─────────────────────────────────────────

function interpolateArc(from: THREE.Vector3, to: THREE.Vector3, i: number, j: number, cw: boolean, segments = 32): THREE.Vector3[] {
  const cx = from.x + i;
  const cz = from.z + j;
  const r = Math.sqrt(i * i + j * j);
  const startAngle = Math.atan2(from.z - cz, from.x - cx);
  let endAngle = Math.atan2(to.z - cz, to.x - cx);
  if (cw && endAngle > startAngle) endAngle -= Math.PI * 2;
  if (!cw && endAngle < startAngle) endAngle += Math.PI * 2;
  const pts: THREE.Vector3[] = [];
  for (let s = 0; s <= segments; s++) {
    const angle = startAngle + (endAngle - startAngle) * (s / segments);
    pts.push(new THREE.Vector3(cx + r * Math.cos(angle), from.y, cz + r * Math.sin(angle)));
  }
  return pts;
}

// ─── Build 3D toolpath points ────────────────────────────────────────────────

function buildToolpathPoints(moves: Move[]): { points: THREE.Vector3[]; colors: THREE.Color[]; moveIndex: number[] } {
  const points: THREE.Vector3[] = [];
  const colors: THREE.Color[] = [];
  const moveIndex: number[] = [];
  const rapidCol = new THREE.Color("#f59e0b");
  const feedCol = new THREE.Color("#34d399");
  const arcCol = new THREE.Color("#60a5fa");
  const homeCol = new THREE.Color("#f87171");

  let prev = new THREE.Vector3(0, 0, 100);

  for (let mi = 0; mi < moves.length; mi++) {
    const m = moves[mi];
    const cur = new THREE.Vector3(m.x, m.y, m.z);
    const col = m.type === "G00" ? rapidCol : m.type === "G28" ? homeCol : (m.type === "G02" || m.type === "G03") ? arcCol : feedCol;

    if ((m.type === "G02" || m.type === "G03") && m.i !== undefined && m.j !== undefined) {
      const arcPts = interpolateArc(prev, cur, m.i, 0, m.type === "G02");
      for (const ap of arcPts) { points.push(ap); colors.push(col); moveIndex.push(mi); }
    } else {
      points.push(prev.clone()); colors.push(col); moveIndex.push(mi);
      points.push(cur.clone()); colors.push(col); moveIndex.push(mi);
    }
    prev = cur;
  }
  return { points, colors, moveIndex };
}

// ─── Accuracy metrics ─────────────────────────────────────────────────────────

function computeAccuracy(moves: Move[]): {
  totalDist: number; rapidDist: number; cutDist: number;
  cycleTimeSec: number; rapidTimeSec: number; cutTimeSec: number;
  surfaceRa: number; maxX: number; maxZ: number; minZ: number;
  toolChanges: number; arcMoves: number; linearMoves: number;
  estimatedRemovedVolume: number;
} {
  let totalDist = 0, rapidDist = 0, cutDist = 0;
  let cycleTimeMs = 0, rapidTimeMs = 0, cutTimeMs = 0;
  let maxX = 0, maxZ = -Infinity, minZ = Infinity;
  let toolChanges = 0, arcMoves = 0, linearMoves = 0;
  let lastTool = -1;

  moves.forEach(m => {
    totalDist += m.dist;
    cycleTimeMs += m.timeMs;
    if (m.isRapid) { rapidDist += m.dist; rapidTimeMs += m.timeMs; }
    else { cutDist += m.dist; cutTimeMs += m.timeMs; }
    maxX = Math.max(maxX, m.x);
    maxZ = Math.max(maxZ, m.z);
    minZ = Math.min(minZ, m.z);
    if (m.tool !== lastTool && lastTool !== -1) toolChanges++;
    lastTool = m.tool;
    if (m.type === "G02" || m.type === "G03") arcMoves++;
    if (m.type === "G01") linearMoves++;
  });

  const avgFeed = moves.filter(m => !m.isRapid).reduce((a, b) => a + b.f, 0) / Math.max(linearMoves + arcMoves, 1);
  const avgS = moves.filter(m => m.s > 0).reduce((a, b) => a + b.s, 0) / Math.max(moves.length, 1);
  const surfaceRa = avgFeed > 0 && avgS > 0 ? (avgFeed * avgFeed) / (8 * 0.4 * 1000) : 0.8;

  return {
    totalDist, rapidDist, cutDist,
    cycleTimeSec: cycleTimeMs / 1000, rapidTimeSec: rapidTimeMs / 1000, cutTimeSec: cutTimeMs / 1000,
    surfaceRa, maxX, maxZ, minZ,
    toolChanges, arcMoves, linearMoves,
    estimatedRemovedVolume: Math.PI * (maxX / 2) ** 2 * Math.abs(minZ),
  };
}

// ─── 3D Scene Components ──────────────────────────────────────────────────────

function WorkpieceLatheMesh({ maxX, minZ, maxZ }: { maxX: number; minZ: number; maxZ: number }) {
  const r = Math.max(maxX / 2, 10);
  const len = Math.max(Math.abs(minZ) + Math.abs(maxZ), 20);
  return (
    <mesh position={[0, 0, minZ + len / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, len, 48, 1, false]} />
      <meshStandardMaterial color="#b87333" metalness={0.6} roughness={0.3} transparent opacity={0.18} wireframe={false} />
    </mesh>
  );
}

function ToolMesh({ position, isRapid }: { position: THREE.Vector3; isRapid: boolean }) {
  const meshRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.set(position.x, position.y, position.z);
    }
  });
  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, -4]}>
        <cylinderGeometry args={[1.2, 1.2, 8, 16]} />
        <meshStandardMaterial color={isRapid ? "#f59e0b" : "#22d3ee"} metalness={0.8} roughness={0.2} emissive={isRapid ? "#f59e0b" : "#0891b2"} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.5]}>
        <coneGeometry args={[1.2, 3, 16]} />
        <meshStandardMaterial color="#e4e4e7" metalness={0.9} roughness={0.1} />
      </mesh>
      {!isRapid && (
        <pointLight color="#22d3ee" intensity={2} distance={30} />
      )}
    </group>
  );
}

function ToolpathLines({ moves, currentIdx, tpData }: {
  moves: Move[]; currentIdx: number;
  tpData: { points: THREE.Vector3[]; colors: THREE.Color[]; moveIndex: number[] };
}) {
  const trailPoints = useMemo(() => {
    const cutoff = tpData.moveIndex.findIndex(mi => mi > currentIdx);
    const end = cutoff === -1 ? tpData.points.length : cutoff;
    return { visited: tpData.points.slice(0, end), future: tpData.points.slice(end) };
  }, [tpData, currentIdx]);

  if (tpData.points.length === 0) return null;
  return (
    <>
      {trailPoints.visited.length >= 2 && (
        <Line points={trailPoints.visited} color="#34d399" lineWidth={2} />
      )}
      {trailPoints.future.length >= 2 && (
        <Line points={trailPoints.future} color="rgba(100,100,100,0.3)" lineWidth={1} />
      )}
    </>
  );
}

function SceneSetup({ viewMode }: { viewMode: ViewMode }) {
  const { camera } = useThree();
  useEffect(() => {
    if (viewMode === "3d") { camera.position.set(80, 80, 120); }
    else if (viewMode === "top") { camera.position.set(0, 200, 0); }
    else if (viewMode === "front") { camera.position.set(0, 0, 200); }
    else if (viewMode === "right") { camera.position.set(200, 0, 0); }
    camera.lookAt(0, 0, 0);
  }, [viewMode, camera]);
  return null;
}

function SimScene({ moves, currentIdx, viewMode, showWorkpiece }: {
  moves: Move[]; currentIdx: number; viewMode: ViewMode; showWorkpiece: boolean;
}) {
  const tpData = useMemo(() => buildToolpathPoints(moves), [moves]);
  const cm = currentIdx >= 0 && currentIdx < moves.length ? moves[currentIdx] : null;
  const toolPos = cm ? new THREE.Vector3(cm.x, cm.y, cm.z) : new THREE.Vector3(0, 0, 100);
  const acc = useMemo(() => moves.length > 0 ? computeAccuracy(moves) : null, [moves]);

  return (
    <>
      <SceneSetup viewMode={viewMode} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[100, 150, 100]} intensity={1.2} castShadow />
      <pointLight position={[-80, 80, -80]} intensity={0.6} color="#60a5fa" />

      <gridHelper args={[200, 20, "#1e293b", "#0f172a"]} position={[0, -2, 0]} />
      <axesHelper args={[30]} />

      {showWorkpiece && acc && (
        <WorkpieceLatheMesh maxX={acc.maxX || 80} minZ={acc.minZ || -90} maxZ={acc.maxZ || 5} />
      )}

      <ToolpathLines moves={moves} currentIdx={currentIdx} tpData={tpData} />

      {cm && <ToolMesh position={toolPos} isRapid={cm.isRapid} />}

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={["#ef4444", "#22c55e", "#3b82f6"]} labelColor="white" />
      </GizmoHelper>

      <OrbitControls enableDamping dampingFactor={0.08} />
    </>
  );
}

// ─── Sample G-code ─────────────────────────────────────────────────────────────

const SAMPLE_GCODE = `%
O0001 (SAI ROLOTECH — ROLL SHAFT TURNING PRO)
(MATERIAL: EN8 STEEL | MACHINE: DELTA 2X | TOOL: CNMG120408)
G21 G18 G40 G97 G99
T0101 (OD ROUGH CNMG120408)
G96 S140 M03
G00 X85.0 Z5.0
G71 U1.5 R0.5
G71 P10 Q20 U0.4 W0.1 F0.3
N10 G00 X35.0
G01 Z0.0 F0.15
G01 X38.0 Z-2.0
G01 Z-15.0
G01 X44.0 Z-18.0
G01 Z-30.0
G01 X55.0 Z-33.0
G01 Z-45.0
G02 X63.0 Z-49.0 I4.0 J0.0
G01 Z-65.0
G01 X72.0 Z-68.0
G01 Z-88.0
G01 X80.0
N20 G00 X85.0
T0202 (OD FINISH VCMT160408)
G96 S220 M03
G00 X35.0 Z2.0
G70 P10 Q20
G00 X150.0 Z150.0
T0303 (GROOVE 3MM)
G97 S800 M03
G00 X55.0 Z-30.0
G75 R0.5
G75 X30.0 Z-33.0 P3000 Q0 F0.08
G00 X80.0
T0404 (THREAD M38x1.5)
G97 S600 M03
G00 X40.0 Z5.0
G76 P011060 Q100 R0.05
G76 X36.05 Z-14.0 P975 Q300 F1.5
G00 X150.0 Z150.0
M05
G28 U0. W0.
M30
%`;

// ─── Color syntax highlighter ─────────────────────────────────────────────────

function colorizeGCode(line: string): React.ReactNode {
  const trimmed = line.trim();
  if (!trimmed) return <span> </span>;
  if (trimmed.startsWith("(") || trimmed.startsWith(";")) return <span style={{ color: "#52525b" }}>{line}</span>;
  if (trimmed.startsWith("%") || trimmed.match(/^O\d+/)) return <span style={{ color: "#a78bfa" }}>{line}</span>;

  return (
    <span>
      {line.split(/(\bG\d+\.?\d*\b|\bM\d+\b|\bT\d+\b|\bX-?\d+\.?\d*\b|\bZ-?\d+\.?\d*\b|\bF\d+\.?\d*\b|\bS\d+\b|\bN\d+\b)/g).map((part, i) => {
        if (/^G\d/.test(part)) return <span key={i} style={{ color: "#22d3ee" }}>{part}</span>;
        if (/^M\d/.test(part)) return <span key={i} style={{ color: "#f59e0b" }}>{part}</span>;
        if (/^T\d/.test(part)) return <span key={i} style={{ color: "#a78bfa" }}>{part}</span>;
        if (/^[XYZ]-?\d/.test(part)) return <span key={i} style={{ color: "#34d399" }}>{part}</span>;
        if (/^[FIS]\d/.test(part)) return <span key={i} style={{ color: "#fb923c" }}>{part}</span>;
        if (/^N\d/.test(part)) return <span key={i} style={{ color: "#6366f1" }}>{part}</span>;
        return <span key={i} style={{ color: "#71717a" }}>{part}</span>;
      })}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PP_NAMES: Record<string, string> = {
  delta_2x: "Delta 2X (TurnAxis CAM)",
  fanuc: "Fanuc 0i-TD",
  siemens_840d: "Siemens 840D",
  haas: "Haas ST Series",
  mitsubishi_m70: "Mitsubishi M70",
  mazak: "Mazak Nexus",
  okuma: "Okuma OSP",
  syntec: "Syntec",
  brother: "Brother",
  generic: "Generic ISO",
};

export function GCodeSimulatorView() {
  const gcodeOutputs = useCncStore(s => s.gcodeOutputs);
  const postProcessorId = useCncStore(s => s.postProcessorId);

  const [code, setCode] = useState(SAMPLE_GCODE);
  const [moves, setMoves] = useState<Move[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");
  const [machineMode] = useState<MachineMode>("lathe");
  const [loaded, setLoaded] = useState(false);
  const [showWorkpiece, setShowWorkpiece] = useState(true);
  const [tab, setTab] = useState<"stats" | "alarms" | "code">("stats");
  const [showPPPanel, setShowPPPanel] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  function loadFromStore(gco: { gcode: string; label: string }) {
    setCode(gco.gcode);
    setLoaded(false);
    setPlaying(false);
    setMoves([]);
    setCurrentIdx(-1);
    setShowPPPanel(false);
    setTimeout(() => {
      const result = parseGCode(gco.gcode);
      setMoves(result.moves);
      setAlarms(result.alarms);
      setCurrentIdx(0);
      setLoaded(true);
    }, 50);
  }

  const acc = useMemo(() => moves.length > 0 ? computeAccuracy(moves) : null, [moves]);
  const cm = currentIdx >= 0 && currentIdx < moves.length ? moves[currentIdx] : null;
  const progress = moves.length > 0 ? Math.max(0, currentIdx) / (moves.length - 1) : 0;

  function loadMoves() {
    const result = parseGCode(code);
    setMoves(result.moves);
    setAlarms(result.alarms);
    setCurrentIdx(0);
    setLoaded(true);
    setPlaying(false);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => { setCode(ev.target?.result as string ?? ""); setLoaded(false); setPlaying(false); };
    reader.readAsText(f);
  }

  function handleDownloadReport() {
    if (!acc) return;
    const report = [
      "SAI ROLOTECH — CNC SIMULATION ACCURACY REPORT",
      "=".repeat(50),
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "TOOLPATH SUMMARY",
      `Total Distance   : ${acc.totalDist.toFixed(2)} mm`,
      `Cutting Distance : ${acc.cutDist.toFixed(2)} mm`,
      `Rapid Distance   : ${acc.rapidDist.toFixed(2)} mm`,
      "",
      "CYCLE TIME",
      `Total Time       : ${formatTime(acc.cycleTimeSec)}`,
      `Cutting Time     : ${formatTime(acc.cutTimeSec)}`,
      `Rapid Time       : ${formatTime(acc.rapidTimeSec)}`,
      "",
      "QUALITY METRICS",
      `Est. Surface Ra  : ${acc.surfaceRa.toFixed(3)} μm`,
      `Linear Moves     : ${acc.linearMoves}`,
      `Arc Moves        : ${acc.arcMoves}`,
      `Tool Changes     : ${acc.toolChanges}`,
      "",
      "ALARMS",
      ...alarms.map(a => `[${a.level.toUpperCase()}] Line ${a.line}: ${a.msg}`),
    ].join("\n");
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cnc_accuracy_report.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing || moves.length === 0) return;
    intervalRef.current = setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= moves.length - 1) { setPlaying(false); return prev; }
        return prev + 1;
      });
    }, Math.max(8, 150 / speed));
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, moves]);

  useEffect(() => {
    if (!cm) return;
    const el = lineRefs.current[cm.lineNo];
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cm?.lineNo]);

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60); const s = (sec % 60).toFixed(0);
    return `${m}m ${s}s`;
  };

  const qualityScore = useMemo(() => {
    if (!acc) return 0;
    let score = 100;
    if (acc.surfaceRa > 3.2) score -= 20;
    else if (acc.surfaceRa > 1.6) score -= 10;
    if (alarms.some(a => a.level === "error")) score -= 30;
    if (alarms.some(a => a.level === "warn")) score -= 10;
    const rapidRatio = acc.rapidDist / Math.max(acc.totalDist, 1);
    if (rapidRatio > 0.5) score -= 15;
    return Math.max(0, Math.min(100, score));
  }, [acc, alarms]);

  const scoreColor = qualityScore >= 90 ? "#34d399" : qualityScore >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#05060f", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#0891b2,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap style={{ width: 18, height: 18, color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>Pro CNC G-Code Simulator</div>
          <div style={{ fontSize: 10, color: "#52525b" }}>3D Toolpath · Material Removal · Accuracy Verification · {machineMode === "lathe" ? "Lathe (XZ)" : "Milling (XYZ)"}</div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {/* View buttons */}
          {(["3d", "top", "front", "right"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{ padding: "4px 9px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: viewMode === v ? "rgba(8,145,178,0.3)" : "rgba(255,255,255,0.05)", color: viewMode === v ? "#22d3ee" : "#52525b", transition: "all 0.15s" }}>
              {v.toUpperCase()}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
          <button onClick={() => setShowWorkpiece(w => !w)}
            style={{ padding: "4px 9px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: showWorkpiece ? "rgba(180,86,51,0.3)" : "rgba(255,255,255,0.05)", color: showWorkpiece ? "#fb923c" : "#52525b" }}>
            <Layers style={{ width: 10, height: 10, display: "inline", marginRight: 4 }} />Workpiece
          </button>
          {loaded && (
            <button onClick={handleDownloadReport}
              style={{ padding: "4px 9px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "rgba(52,211,153,0.15)", color: "#34d399" }}>
              <Download style={{ width: 10, height: 10, display: "inline", marginRight: 4 }} />Report
            </button>
          )}
          <button onClick={() => setShowPPPanel(p => !p)}
            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${gcodeOutputs.length > 0 ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`, background: gcodeOutputs.length > 0 ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)", color: gcodeOutputs.length > 0 ? "#a78bfa" : "#52525b", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Link2 style={{ width: 10, height: 10 }} />
            {gcodeOutputs.length > 0 ? `Post-Processor (${gcodeOutputs.length})` : "Post-Processor"}
          </button>
        </div>
      </div>

      {/* ── Post-Processor G-Code Loader Panel ── */}
      {showPPPanel && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.06)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Cpu style={{ width: 13, height: 13, color: "#a78bfa" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>
              Post-Processor: {PP_NAMES[postProcessorId] || postProcessorId}
            </span>
            {gcodeOutputs.length === 0 && (
              <span style={{ fontSize: 10, color: "#52525b" }}>— Pehle Roll Tooling → G-Code tab mein G-Code generate karo</span>
            )}
          </div>
          {gcodeOutputs.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {gcodeOutputs.map((gco, i) => (
                <button key={i} onClick={() => loadFromStore(gco)}
                  style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#c4b5fd", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                  <span>{gco.label}</span>
                  <span style={{ fontSize: 9, color: "#6366f1", fontWeight: 400 }}>
                    {gco.lineCount} lines · {gco.toolMoves} moves
                    {gco.estimatedAccuracy ? ` · ${gco.estimatedAccuracy}` : ""}
                  </span>
                </button>
              ))}
              <button onClick={() => { const all = gcodeOutputs.map(g => `; === ${g.label} ===\n${g.gcode}`).join("\n\n"); loadFromStore({ gcode: all, label: "All Stations Combined" }); }}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#fbbf24", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                ★ All Stations Combined
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main Layout ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr 260px", overflow: "hidden" }}>

        {/* ── Left: G-code editor ── */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#070814" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: 1 }}>G-Code Editor</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
              <label style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "#a1a1aa", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Upload style={{ width: 9, height: 9 }} />Open
                <input type="file" accept=".nc,.tap,.txt,.gcode" style={{ display: "none" }} onChange={handleUpload} />
              </label>
              <button onClick={() => { setCode(SAMPLE_GCODE); setLoaded(false); }}
                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#52525b", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Sample</button>
              <button onClick={loadMoves}
                style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "linear-gradient(90deg,#0891b2,#6366f1)", color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                <Play style={{ width: 9, height: 9, display: "inline", marginRight: 3 }} />Load
              </button>
            </div>
          </div>

          <div ref={codeScrollRef} style={{ flex: 1, overflow: "auto", fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: 10.5, lineHeight: "18px" }}>
            {code.split("\n").map((line, i) => {
              const lineNo = i + 1;
              const isCurrent = cm?.lineNo === lineNo;
              const isAlarm = alarms.some(a => a.line === lineNo);
              return (
                <div key={i} ref={el => { lineRefs.current[lineNo] = el; }}
                  style={{ display: "flex", background: isCurrent ? "rgba(8,145,178,0.18)" : isAlarm ? "rgba(239,68,68,0.08)" : "transparent", borderLeft: isCurrent ? "3px solid #0891b2" : isAlarm ? "3px solid rgba(239,68,68,0.5)" : "3px solid transparent", transition: "background 0.1s" }}>
                  <span style={{ width: 32, textAlign: "right", paddingRight: 8, color: "#27272a", fontSize: 9, flexShrink: 0, lineHeight: "18px" }}>{lineNo}</span>
                  <span style={{ flex: 1, paddingRight: 8, whiteSpace: "pre", overflow: "hidden" }}>{colorizeGCode(line)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Center: 3D Viewport ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Canvas
              camera={{ position: [80, 80, 120], fov: 45, near: 0.1, far: 5000 }}
              gl={{ antialias: true, powerPreference: "high-performance" }}
              style={{ background: "#030408" }}>
              <SimScene moves={moves} currentIdx={currentIdx} viewMode={viewMode} showWorkpiece={showWorkpiece} />
            </Canvas>

            {!loaded && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <Crosshair style={{ width: 40, height: 40, color: "#1e293b", marginBottom: 12 }} />
                <div style={{ fontSize: 13, color: "#27272a", fontWeight: 700 }}>Load G-Code to start simulation</div>
                <div style={{ fontSize: 10, color: "#1e293b", marginTop: 4 }}>Supports G00/G01/G02/G03/G28/G71/G70/G75/G76</div>
              </div>
            )}

            {cm && (
              <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(5,6,15,0.85)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", backdropFilter: "blur(8px)" }}>
                <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                  {[["X", cm.x], ["Y", cm.y], ["Z", cm.z]].map(([l, v]) => (
                    <div key={l as string}>
                      <span style={{ color: "#52525b", fontSize: 9 }}>{l} </span>
                      <span style={{ color: "#34d399", fontWeight: 800, fontFamily: "monospace" }}>{(v as number).toFixed(3)}</span>
                    </div>
                  ))}
                  <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", paddingLeft: 12 }}>
                    <span style={{ color: "#52525b", fontSize: 9 }}>F </span>
                    <span style={{ color: "#f59e0b", fontWeight: 800, fontFamily: "monospace" }}>{cm.isRapid ? "RAPID" : cm.f}</span>
                  </div>
                  <div>
                    <span style={{ color: "#52525b", fontSize: 9 }}>S </span>
                    <span style={{ color: "#a78bfa", fontWeight: 800, fontFamily: "monospace" }}>{cm.s} RPM</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Playback Controls ── */}
          <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, background: "#070814" }}>
            {loaded ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#52525b", marginBottom: 4 }}>
                    <span>Move {Math.max(0, currentIdx + 1)} / {moves.length}</span>
                    <span style={{ color: "#22d3ee" }}>{(progress * 100).toFixed(1)}%</span>
                    {acc && <span>{formatTime(acc.cycleTimeSec * progress)} / {formatTime(acc.cycleTimeSec)}</span>}
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: "rgba(255,255,255,0.06)", cursor: "pointer" }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      setCurrentIdx(Math.round(pct * (moves.length - 1)));
                      setPlaying(false);
                    }}>
                    <div style={{ height: "100%", width: `${progress * 100}%`, borderRadius: 99, background: "linear-gradient(90deg,#0891b2,#6366f1,#34d399)", transition: "width 0.05s" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => { setCurrentIdx(0); setPlaying(false); }} style={btnStyle}>
                    <SkipBack style={{ width: 12, height: 12 }} />
                  </button>
                  <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} style={btnStyle}>‹</button>
                  <button onClick={() => setPlaying(p => !p)}
                    style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: playing ? "rgba(239,68,68,0.25)" : "linear-gradient(90deg,#0891b2,#6366f1)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {playing ? <><Pause style={{ width: 13, height: 13 }} />Pause</> : <><Play style={{ width: 13, height: 13 }} />Play</>}
                  </button>
                  <button onClick={() => setCurrentIdx(i => Math.min(moves.length - 1, i + 1))} style={btnStyle}>›</button>
                  <button onClick={() => { setCurrentIdx(moves.length - 1); setPlaying(false); }} style={btnStyle}>
                    <SkipForward style={{ width: 12, height: 12 }} />
                  </button>
                  <button onClick={() => { setCurrentIdx(-1); setPlaying(false); setLoaded(false); setMoves([]); }} style={{ ...btnStyle, color: "#ef4444" }}>
                    <RotateCcw style={{ width: 12, height: 12 }} />
                  </button>

                  <div style={{ marginLeft: 8, display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: "#52525b" }}>Speed:</span>
                    {[1, 5, 10, 25, 100].map(s => (
                      <button key={s} onClick={() => setSpeed(s)}
                        style={{ padding: "3px 7px", borderRadius: 5, border: "none", fontSize: 9, fontWeight: 700, cursor: "pointer", background: speed === s ? "rgba(8,145,178,0.35)" : "rgba(255,255,255,0.05)", color: speed === s ? "#22d3ee" : "#52525b" }}>
                        {s}×
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: "#27272a", fontSize: 11 }}>Click <strong style={{ color: "#0891b2" }}>Load</strong> to parse and simulate G-code</div>
            )}
          </div>
        </div>

        {/* ── Right: Stats / Alarms ── */}
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#070814" }}>
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            {(["stats", "alarms", "code"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: "8px 4px", border: "none", borderBottom: tab === t ? "2px solid #0891b2" : "2px solid transparent", background: "transparent", color: tab === t ? "#22d3ee" : "#52525b", fontSize: 10, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t === "alarms" ? `Alarms${alarms.length ? ` (${alarms.length})` : ""}` : t === "stats" ? "Stats" : "Move"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "10px" }}>
            {tab === "stats" && acc && (
              <>
                {/* Quality Score */}
                <div style={{ textAlign: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{qualityScore}</div>
                  <div style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>QUALITY SCORE</div>
                  <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.05)", margin: "8px auto", maxWidth: 140 }}>
                    <div style={{ height: "100%", width: `${qualityScore}%`, borderRadius: 99, background: scoreColor, transition: "width 0.5s" }} />
                  </div>
                </div>

                {/* Toolpath stats */}
                <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>Toolpath</div>
                {[
                  { l: "Total Distance", v: `${acc.totalDist.toFixed(1)} mm` },
                  { l: "Cutting Distance", v: `${acc.cutDist.toFixed(1)} mm`, c: "#34d399" },
                  { l: "Rapid Distance", v: `${acc.rapidDist.toFixed(1)} mm`, c: "#f59e0b" },
                  { l: "Linear Moves", v: acc.linearMoves.toString() },
                  { l: "Arc Moves (G02/03)", v: acc.arcMoves.toString(), c: "#60a5fa" },
                  { l: "Tool Changes", v: acc.toolChanges.toString() },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 11, color: "#71717a" }}>{s.l}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.c || "#e4e4e7", fontFamily: "monospace" }}>{s.v}</span>
                  </div>
                ))}

                <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 6px", fontWeight: 700 }}>Cycle Time</div>
                {[
                  { l: "Total Time", v: formatTime(acc.cycleTimeSec) },
                  { l: "Cutting Time", v: formatTime(acc.cutTimeSec), c: "#34d399" },
                  { l: "Rapid Time", v: formatTime(acc.rapidTimeSec), c: "#f59e0b" },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 11, color: "#71717a" }}>{s.l}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.c || "#e4e4e7", fontFamily: "monospace" }}>{s.v}</span>
                  </div>
                ))}

                <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: 1, margin: "12px 0 6px", fontWeight: 700 }}>Quality</div>
                {[
                  { l: "Est. Surface Ra", v: `${acc.surfaceRa.toFixed(3)} μm`, c: acc.surfaceRa < 1.6 ? "#34d399" : acc.surfaceRa < 3.2 ? "#f59e0b" : "#ef4444" },
                  { l: "Max Diameter", v: `Ø${acc.maxX.toFixed(2)} mm` },
                  { l: "Part Length", v: `${Math.abs(acc.minZ).toFixed(2)} mm` },
                  { l: "Removed Volume", v: `${(acc.estimatedRemovedVolume / 1000).toFixed(1)} cm³` },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 11, color: "#71717a" }}>{s.l}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.c || "#e4e4e7", fontFamily: "monospace" }}>{s.v}</span>
                  </div>
                ))}
              </>
            )}

            {tab === "stats" && !acc && (
              <div style={{ textAlign: "center", color: "#27272a", paddingTop: 40, fontSize: 12 }}>
                <Activity style={{ width: 32, height: 32, margin: "0 auto 8px", display: "block" }} />
                Load G-Code to see stats
              </div>
            )}

            {tab === "alarms" && (
              <>
                <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>
                  {alarms.length === 0 ? "✓ No Alarms" : `${alarms.length} Alarm(s) Found`}
                </div>
                {alarms.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#34d399", paddingTop: 20 }}>
                    <CheckCircle style={{ width: 28, height: 28, margin: "0 auto 8px", display: "block" }} />
                    <div style={{ fontSize: 12 }}>All checks passed</div>
                  </div>
                ) : alarms.map((a, i) => (
                  <div key={i} style={{ padding: "8px 10px", borderRadius: 7, background: a.level === "error" ? "rgba(239,68,68,0.1)" : a.level === "warn" ? "rgba(245,158,11,0.1)" : "rgba(99,102,241,0.1)", border: `1px solid ${a.level === "error" ? "rgba(239,68,68,0.25)" : a.level === "warn" ? "rgba(245,158,11,0.25)" : "rgba(99,102,241,0.25)"}`, marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <AlertTriangle style={{ width: 11, height: 11, color: a.level === "error" ? "#ef4444" : a.level === "warn" ? "#f59e0b" : "#6366f1" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: a.level === "error" ? "#ef4444" : a.level === "warn" ? "#f59e0b" : "#6366f1", textTransform: "uppercase" }}>{a.level}</span>
                      {a.line > 0 && <span style={{ fontSize: 9, color: "#52525b" }}>Line {a.line}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "#a1a1aa" }}>{a.msg}</div>
                  </div>
                ))}
              </>
            )}

            {tab === "code" && cm && (
              <>
                <div style={{ fontSize: 10, color: "#52525b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Current Move — Line {cm.lineNo}</div>
                <div style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(8,145,178,0.1)", border: "1px solid rgba(8,145,178,0.25)", marginBottom: 10, fontFamily: "monospace", fontSize: 12, color: "#22d3ee" }}>
                  {cm.raw}
                </div>
                {[
                  { l: "Move Type", v: cm.type, c: cm.type === "G00" ? "#f59e0b" : cm.type === "G01" ? "#34d399" : "#60a5fa" },
                  { l: "X Position", v: `${cm.x.toFixed(4)} mm` },
                  { l: "Y Position", v: `${cm.y.toFixed(4)} mm` },
                  { l: "Z Position", v: `${cm.z.toFixed(4)} mm` },
                  { l: "Feed Rate", v: cm.isRapid ? "RAPID" : `${cm.f} mm/r` },
                  { l: "Spindle Speed", v: `${cm.s} RPM` },
                  { l: "Tool Number", v: `T${String(cm.tool).padStart(2, "0")}` },
                  { l: "Move Distance", v: `${cm.dist.toFixed(3)} mm` },
                  { l: "Move Time", v: `${cm.timeMs.toFixed(0)} ms` },
                  ...(cm.r !== undefined ? [{ l: "Radius R", v: `${cm.r} mm` }] : []),
                  ...(cm.i !== undefined ? [{ l: "Arc Center I", v: `${cm.i} mm` }] : []),
                  ...(cm.j !== undefined ? [{ l: "Arc Center J", v: `${cm.j} mm` }] : []),
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ fontSize: 11, color: "#71717a" }}>{s.l}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: (s as any).c || "#e4e4e7", fontFamily: "monospace" }}>{s.v}</span>
                  </div>
                ))}
              </>
            )}

            {tab === "code" && !cm && (
              <div style={{ textAlign: "center", color: "#27272a", paddingTop: 40, fontSize: 12 }}>
                <ChevronRight style={{ width: 32, height: 32, margin: "0 auto 8px", display: "block" }} />
                Play simulation to see move details
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[["G00 Rapid", "#f59e0b"], ["G01 Feed", "#34d399"], ["G02/03 Arc", "#60a5fa"], ["G28 Home", "#f87171"]].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 16, height: 3, borderRadius: 99, background: c }} />
                <span style={{ fontSize: 9, color: "#52525b" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "6px 9px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)", color: "#71717a", cursor: "pointer", display: "flex", alignItems: "center",
};
