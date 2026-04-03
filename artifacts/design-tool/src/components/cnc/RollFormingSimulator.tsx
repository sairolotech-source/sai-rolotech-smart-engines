import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useCncStore, type RollTypeInfo, type RollToolingResult } from "../../store/useCncStore";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  RefreshCw, Settings, BarChart3, AlertTriangle, CheckCircle2,
  Download, Copy, Layers, Activity, Eye, EyeOff, Ruler, Target,
  TrendingUp, ArrowUpDown, Info, Zap, Edit3, RotateCcw, Table,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const UPPER_COLOR = "#60a5fa";
const LOWER_COLOR = "#fb923c";
const STRIP_COLOR = "#e2e8f0";
const STRIP_EDGE_COLOR = "#94a3b8";
const PASS_LINE_COLOR = "#facc15";

const MATERIAL_PROPS: Record<string, { yield: number; uts: number; elongation: number; color: string }> = {
  GI:   { yield: 280,  uts: 380,  elongation: 22, color: "#b0bec5" },  // FIX: ys 250→280, uts 320→380 (IS 277 Z275)
  CR:   { yield: 340,  uts: 440,  elongation: 28, color: "#90a4ae" },  // FIX: ys 280→340, uts 350→440 (IS 513 CR4)
  HR:   { yield: 250,  uts: 420,  elongation: 22, color: "#a1887f" },  // FIX: ys 220→250, uts 300→420 (SPHC)
  SS:   { yield: 310,  uts: 620,  elongation: 40, color: "#e0e0e0" },  // FIX: uts 600→620 (ASTM A240 2B)
  AL:   { yield: 270,  uts: 310,  elongation: 16, color: "#fff8e1" },
  MS:   { yield: 250,  uts: 410,  elongation: 20, color: "#bdbdbd" },
  CU:   { yield: 200,  uts: 300,  elongation: 35, color: "#ffcc80" },  // FIX: ys 210→200 (C110 H02)
  TI:   { yield: 880,  uts: 950,  elongation: 14, color: "#ffe0b2" },  // FIX: ys 900→880, uts 1000→950 (Ti-6Al-4V)
  HSLA: { yield: 550,  uts: 650,  elongation: 15, color: "#b0bec5" },
  PP:   { yield: 280,  uts: 370,  elongation: 28, color: "#f3e5f5" },  // FIX: ys 35→280, uts 55→370, elong 60→28 (Pre-Painted Steel, not polypropylene)
};

const ROLL_TYPE_COLORS: Record<string, string> = {
  "Guide Roll":     "#64748b",
  "Breakdown Roll": "#0ea5e9",
  "Forming Roll":   "#f59e0b",
  "Groove Roll":    "#8b5cf6",
  "Fin Pass Roll":  "#ec4899",
  "Sizing Roll":    "#22c55e",
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface ManualOverride {
  rollGapMm: number;
  upperOD: number;
  lowerOD: number;
  enabled: boolean;
}

interface CompareRow {
  label: string;
  calculated: string;
  reference: string;
  diff: string;
  ok: boolean;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function degToRad(d: number) { return (d * Math.PI) / 180; }

// ─── Strip Cross-Section SVG ──────────────────────────────────────────────────
function StripCrossSection({
  bendAngleDeg,
  thickness,
  profileWidth,
  rollGapMm,
  upperOD,
  lowerOD,
  rollType,
  stationNum,
  totalStations,
  materialColor,
  showRolls,
  showDimensions,
  showPassLine,
  isFinal,
}: {
  bendAngleDeg: number;
  thickness: number;
  profileWidth: number;
  rollGapMm: number;
  upperOD: number;
  lowerOD: number;
  rollType?: RollTypeInfo;
  stationNum: number;
  totalStations: number;
  materialColor: string;
  showRolls: boolean;
  showDimensions: boolean;
  showPassLine: boolean;
  isFinal: boolean;
}) {
  const W = 440, H = 320;
  const cx = W / 2;
  const passY = H / 2 + 10;

  // Strip geometry: flat center + two angled legs
  const t = Math.max(0.5, Math.min(3, thickness)) * 6; // visual thickness (px)
  const legLen = Math.min(profileWidth * 1.5, 120); // px
  const halfFlat = Math.max(30, Math.min(80, profileWidth * 0.5));
  const angleDeg = Math.min(89, bendAngleDeg);
  const rad = degToRad(angleDeg);

  // Strip points — cross-section view: center flat, two rising sides
  // Outer strip path (bottom face)
  const leftLegDx = -legLen * Math.cos(rad);
  const leftLegDy = -legLen * Math.sin(rad);
  const rightLegDx = legLen * Math.cos(rad);
  const rightLegDy = -legLen * Math.sin(rad);

  // Inner path (shifted by thickness t inward)
  const innerOffX = t * Math.sin(rad);
  const innerOffY = t * Math.cos(rad);

  const pts = {
    // outer bottom
    L0: { x: cx - halfFlat + leftLegDx, y: passY + leftLegDy },
    LC: { x: cx - halfFlat, y: passY },
    RC: { x: cx + halfFlat, y: passY },
    R0: { x: cx + halfFlat + rightLegDx, y: passY + rightLegDy },
    // inner top (strip thickness)
    L0i: { x: cx - halfFlat + leftLegDx + innerOffX, y: passY + leftLegDy - innerOffY },
    LCi: { x: cx - halfFlat + innerOffX, y: passY - t },
    RCi: { x: cx + halfFlat - innerOffX, y: passY - t },
    R0i: { x: cx + halfFlat + rightLegDx - innerOffX, y: passY + rightLegDy - innerOffY },
  };

  const stripPath = `M${pts.L0.x},${pts.L0.y} L${pts.LC.x},${pts.LC.y} L${pts.RC.x},${pts.RC.y} L${pts.R0.x},${pts.R0.y} L${pts.R0i.x},${pts.R0i.y} L${pts.RCi.x},${pts.RCi.y} L${pts.LCi.x},${pts.LCi.y} L${pts.L0i.x},${pts.L0i.y} Z`;
  const stripStrokePath = `M${pts.L0.x},${pts.L0.y} L${pts.LC.x},${pts.LC.y} L${pts.RC.x},${pts.RC.y} L${pts.R0.x},${pts.R0.y}`;

  // ── Roll geometry ──────────────────────────────────────────────────────────
  const upperRollH = 28;
  const lowerRollH = 28;
  const rollW = halfFlat * 2 + legLen * 0.6;
  const rollRx = 4;

  const gapPx = Math.min(rollGapMm * 4, 8);
  const upperTopY = passY - t - gapPx - upperRollH;
  const lowerBotY = passY + gapPx + lowerRollH;

  const typeColor = rollType?.color ?? "#475569";
  const grooveShape = rollType?.grooveShape ?? "flat";

  // Groove SVG on rolls
  function UpperGroovePath() {
    const by = upperTopY + upperRollH; // bottom of upper roll
    const gd = upperRollH * 0.55;
    const gw = halfFlat * 0.7;
    if (grooveShape === "flat") return null;
    if (grooveShape === "shallow-v") {
      const hw = gw * 0.5;
      return <path d={`M${cx - hw},${by} L${cx},${by - gd * 0.3} L${cx + hw},${by}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    if (grooveShape === "v-groove") {
      const hw = gw * 0.55;
      return <path d={`M${cx - hw},${by} L${cx},${by - gd * 0.55} L${cx + hw},${by}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    if (grooveShape === "u-groove" || grooveShape === "deep-groove") {
      const hw = gw * (grooveShape === "u-groove" ? 0.45 : 0.38);
      const d2 = gd * (grooveShape === "u-groove" ? 0.5 : 0.7);
      return <path d={`M${cx - hw},${by} L${cx - hw},${by - d2} Q${cx - hw},${by - d2 - 5} ${cx},${by - d2 - 5} Q${cx + hw},${by - d2 - 5} ${cx + hw},${by - d2} L${cx + hw},${by}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    if (grooveShape === "fin") {
      const hw = gw * 0.14;
      return <path d={`M${cx - hw * 2},${by} L${cx - hw},${by - gd * 0.75} L${cx + hw},${by - gd * 0.75} L${cx + hw * 2},${by}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    return null;
  }

  function LowerGroovePath() {
    const ty = lowerBotY - lowerRollH; // top of lower roll
    const gd = lowerRollH * 0.55;
    const gw = halfFlat * 0.7;
    if (grooveShape === "flat") return null;
    if (grooveShape === "shallow-v") {
      const hw = gw * 0.5;
      return <path d={`M${cx - hw},${ty} L${cx},${ty + gd * 0.3} L${cx + hw},${ty}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    if (grooveShape === "v-groove") {
      const hw = gw * 0.55;
      return <path d={`M${cx - hw},${ty} L${cx},${ty + gd * 0.55} L${cx + hw},${ty}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    if (grooveShape === "u-groove" || grooveShape === "deep-groove") {
      const hw = gw * (grooveShape === "u-groove" ? 0.45 : 0.38);
      const d2 = gd * (grooveShape === "u-groove" ? 0.5 : 0.7);
      return <path d={`M${cx - hw},${ty} L${cx - hw},${ty + d2} Q${cx - hw},${ty + d2 + 5} ${cx},${ty + d2 + 5} Q${cx + hw},${ty + d2 + 5} ${cx + hw},${ty + d2} L${cx + hw},${ty}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    if (grooveShape === "fin") {
      const hw = gw * 0.14;
      return <path d={`M${cx - hw * 2},${ty} L${cx - hw},${ty + gd * 0.75} L${cx + hw},${ty + gd * 0.75} L${cx + hw * 2},${ty}`} stroke={typeColor} strokeWidth={2} fill="none" strokeOpacity={0.9} />;
    }
    return null;
  }

  // Angle annotation
  const annR = 32;
  const annPath = `M${cx + halfFlat},${passY} A${annR},${annR} 0 ${angleDeg > 90 ? 1 : 0},0 ${cx + halfFlat + annR * Math.cos(Math.PI / 2 - rad)},${passY - annR * Math.sin(Math.PI / 2 - rad)}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
      {/* Background */}
      <rect width={W} height={H} fill="#07080f" rx={10} />
      {/* Grid */}
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={`gv${i}`} x1={i * 32} y1={0} x2={i * 32} y2={H} stroke="#1e293b" strokeWidth={0.5} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={`gh${i}`} x1={0} y1={i * 32} x2={W} y2={i * 32} stroke="#1e293b" strokeWidth={0.5} />
      ))}

      {/* Pass line */}
      {showPassLine && (
        <line x1={0} y1={passY} x2={W} y2={passY} stroke={PASS_LINE_COLOR} strokeWidth={1} strokeDasharray="8 6" strokeOpacity={0.5} />
      )}
      {showPassLine && (
        <text x={6} y={passY - 4} fill={PASS_LINE_COLOR} fontSize={8} fontFamily="monospace" fillOpacity={0.7}>PASS LINE</text>
      )}

      {/* Rolls */}
      {showRolls && (<>
        {/* Upper roll body */}
        <rect
          x={cx - rollW / 2} y={upperTopY}
          width={rollW} height={upperRollH}
          rx={rollRx}
          fill="#1e293b" stroke={UPPER_COLOR} strokeWidth={1.5}
        />
        {/* Upper arbor line */}
        <line x1={cx} y1={upperTopY + 2} x2={cx} y2={upperTopY + upperRollH - 2} stroke={UPPER_COLOR} strokeWidth={1} strokeDasharray="3 2" strokeOpacity={0.5} />
        {/* Upper groove */}
        <UpperGroovePath />
        {/* Upper roll label */}
        <text x={cx - rollW / 2 + 6} y={upperTopY + 11} fill={UPPER_COLOR} fontSize={8} fontFamily="monospace" fontWeight="bold">UPPER  Ø{upperOD.toFixed(1)}</text>

        {/* Lower roll body */}
        <rect
          x={cx - rollW / 2} y={lowerBotY - lowerRollH}
          width={rollW} height={lowerRollH}
          rx={rollRx}
          fill="#1e293b" stroke={LOWER_COLOR} strokeWidth={1.5}
        />
        <line x1={cx} y1={lowerBotY - lowerRollH + 2} x2={cx} y2={lowerBotY - 2} stroke={LOWER_COLOR} strokeWidth={1} strokeDasharray="3 2" strokeOpacity={0.5} />
        <LowerGroovePath />
        <text x={cx - rollW / 2 + 6} y={lowerBotY - 4} fill={LOWER_COLOR} fontSize={8} fontFamily="monospace" fontWeight="bold">LOWER  Ø{lowerOD.toFixed(1)}</text>
      </>)}

      {/* Strip */}
      <path d={stripPath} fill={materialColor} fillOpacity={0.25} stroke={STRIP_EDGE_COLOR} strokeWidth={1.5} />
      <path d={stripStrokePath} fill="none" stroke={STRIP_COLOR} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Glow on bend corners */}
      <circle cx={cx - halfFlat} cy={passY} r={4} fill={isFinal ? "#22c55e" : "#f59e0b"} fillOpacity={0.6} />
      <circle cx={cx + halfFlat} cy={passY} r={4} fill={isFinal ? "#22c55e" : "#f59e0b"} fillOpacity={0.6} />

      {/* Dimensions */}
      {showDimensions && (<>
        {/* Bend angle arc */}
        {angleDeg > 2 && (<>
          <path d={annPath} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeOpacity={0.8} />
          <text
            x={cx + halfFlat + annR * 0.7 * Math.cos(Math.PI / 2 - rad / 2) + 4}
            y={passY - annR * 0.7 * Math.sin(Math.PI / 2 - rad / 2) + 4}
            fill="#f59e0b" fontSize={10} fontFamily="monospace" fontWeight="bold"
          >{angleDeg.toFixed(1)}°</text>
        </>)}
        {/* Roll gap arrow */}
        {showRolls && (<>
          <line x1={cx + rollW / 2 + 8} y1={passY - t - gapPx} x2={cx + rollW / 2 + 8} y2={passY} stroke="#94a3b8" strokeWidth={1} />
          <line x1={cx + rollW / 2 + 4} y1={passY - t - gapPx} x2={cx + rollW / 2 + 12} y2={passY - t - gapPx} stroke="#94a3b8" strokeWidth={1} />
          <line x1={cx + rollW / 2 + 4} y1={passY} x2={cx + rollW / 2 + 12} y2={passY} stroke="#94a3b8" strokeWidth={1} />
          <text x={cx + rollW / 2 + 14} y={passY - gapPx / 2 + 3} fill="#94a3b8" fontSize={8} fontFamily="monospace">gap</text>
        </>)}
        {/* Flat width */}
        <line x1={cx - halfFlat} y1={passY + 18} x2={cx + halfFlat} y2={passY + 18} stroke="#64748b" strokeWidth={1} />
        <line x1={cx - halfFlat} y1={passY + 14} x2={cx - halfFlat} y2={passY + 22} stroke="#64748b" strokeWidth={1} />
        <line x1={cx + halfFlat} y1={passY + 14} x2={cx + halfFlat} y2={passY + 22} stroke="#64748b" strokeWidth={1} />
        <text x={cx} y={passY + 28} textAnchor="middle" fill="#64748b" fontSize={8} fontFamily="monospace">flat {(profileWidth).toFixed(0)} mm</text>
      </>)}

      {/* Station progress bar */}
      <rect x={8} y={8} width={W - 16} height={4} rx={2} fill="#1e293b" />
      <rect x={8} y={8} width={(stationNum / totalStations) * (W - 16)} height={4} rx={2} fill={typeColor} />

      {/* Roll type badge */}
      {rollType && (
        <rect x={8} y={18} width={120} height={14} rx={3} fill={typeColor} fillOpacity={0.15} stroke={typeColor} strokeOpacity={0.5} strokeWidth={0.8} />
      )}
      {rollType && (
        <text x={12} y={28} fill={typeColor} fontSize={8} fontWeight="bold" fontFamily="monospace">{rollType.name.toUpperCase()}</text>
      )}

      {/* Station number badge */}
      <rect x={W - 46} y={18} width={38} height={14} rx={3} fill="#1e293b" stroke="#334155" strokeWidth={0.8} />
      <text x={W - 27} y={28} textAnchor="middle" fill="#94a3b8" fontSize={8} fontWeight="bold" fontFamily="monospace">S{stationNum}/{totalStations}</text>

      {/* Completion indicator */}
      {isFinal && (
        <text x={cx} y={H - 10} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight="bold" fontFamily="monospace">✓ FINAL PROFILE</text>
      )}
    </svg>
  );
}

// ─── Side-by-Side 3D Perspective Strip ───────────────────────────────────────
function StationFlowBar({ stations, currentIdx, onSelect, rollTooling }: {
  stations: number[];
  currentIdx: number;
  onSelect: (i: number) => void;
  rollTooling: RollToolingResult[];
}) {
  const n = stations.length;
  return (
    <div className="flex gap-1 items-end overflow-x-auto pb-1 px-1">
      {stations.map((angle, i) => {
        const rt = rollTooling[i];
        const typeColor = rt?.rollType?.color ?? "#475569";
        const isActive = i === currentIdx;
        const heightPct = 20 + (angle / 90) * 36;
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className="flex flex-col items-center gap-0.5 flex-shrink-0 transition-all"
            style={{ opacity: isActive ? 1 : 0.5 }}
          >
            {/* Mini profile bar */}
            <div
              className="rounded-sm transition-all"
              style={{
                width: 18,
                height: heightPct,
                background: isActive ? typeColor : "#334155",
                border: isActive ? `1.5px solid ${typeColor}` : "1.5px solid #475569",
                boxShadow: isActive ? `0 0 6px ${typeColor}60` : "none",
              }}
            />
            <span className="text-[7px] font-mono" style={{ color: isActive ? typeColor : "#4b5563" }}>
              S{i + 1}
            </span>
            <span className="text-[6px] font-mono text-zinc-600">{angle.toFixed(0)}°</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Simulator Component ─────────────────────────────────────────────────
export function RollFormingSimulator() {
  const { rollTooling, stations, materialType, materialThickness, geometry } = useCncStore();
  const stripThickness = materialThickness;
  const profileWidth = geometry ? (geometry.boundingBox.maxX - geometry.boundingBox.minX) : 0;

  const bendAngles = useMemo(() => {
    if (stations.length > 0) return stations.map(s => s.totalAngle ?? 0);
    if (rollTooling.length > 0) {
      const n = rollTooling.length;
      return rollTooling.map((_, i) => Math.round((i / Math.max(n - 1, 1)) * 90));
    }
    return [0, 15, 30, 45, 60, 75, 90]; // demo fallback
  }, [stations, rollTooling]);

  const n = bendAngles.length;
  const matProps = MATERIAL_PROPS[materialType] ?? MATERIAL_PROPS["GI"];
  const thickness = stripThickness > 0 ? stripThickness : 1.5;
  const pWidth = profileWidth > 0 ? profileWidth : 60;

  // ── State ────────────────────────────────────────────────────────────────
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1200); // ms per step
  const [showRolls, setShowRolls] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showPassLine, setShowPassLine] = useState(true);
  const [activeTab, setActiveTab] = useState<"simulate" | "manual" | "compare">("simulate");

  // Manual overrides per station
  const [overrides, setOverrides] = useState<Record<number, ManualOverride>>({});

  // Compare: user-entered reference values per station
  const [refValues, setRefValues] = useState<Record<number, { angle: string; upperOD: string; lowerOD: string; gap: string }>>({});

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Playback ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (playing) {
      timerRef.current = setTimeout(() => {
        setCurrentIdx(prev => {
          if (prev >= n - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, playSpeed);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [playing, currentIdx, n, playSpeed]);

  const handlePlay = useCallback(() => {
    if (currentIdx >= n - 1) setCurrentIdx(0);
    setPlaying(true);
  }, [currentIdx, n]);

  const handlePause = () => setPlaying(false);
  const handleReset = () => { setPlaying(false); setCurrentIdx(0); };
  const handlePrev = () => { setPlaying(false); setCurrentIdx(i => Math.max(0, i - 1)); };
  const handleNext = () => { setPlaying(false); setCurrentIdx(i => Math.min(n - 1, i + 1)); };

  // ── Current station data ──────────────────────────────────────────────────
  const rt = rollTooling[currentIdx];
  const ov = overrides[currentIdx];
  const angle = bendAngles[currentIdx] ?? 0;
  const upperOD = ov?.enabled ? ov.upperOD : (rt?.upperRollOD ?? rt?.rollProfile?.rollDiameter ?? 120);
  const lowerOD = ov?.enabled ? ov.lowerOD : (rt?.lowerRollOD ?? rt?.rollProfile?.rollDiameter ?? 118);
  const rollGap = ov?.enabled ? ov.rollGapMm : (rt?.rollGap ?? rt?.rollProfile?.gap ?? thickness * 1.1);
  const rollType = rt?.rollType;

  function setOverride(idx: number, field: keyof ManualOverride, val: number | boolean) {
    setOverrides(prev => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? { rollGapMm: rollGap, upperOD, lowerOD, enabled: false }), [field]: val },
    }));
  }

  // ── Springback estimate ───────────────────────────────────────────────────
  const springbackDeg = useMemo(() => {
    const st = stations[currentIdx];
    if (st?.springbackAngles?.[0]) return st.springbackAngles[0];
    const E = matProps.yield * 3.2; // rough elastic modulus proxy
    const K = 0.038;
    return parseFloat((angle * K * (matProps.yield / 250)).toFixed(2));
  }, [currentIdx, angle, matProps, stations]);

  const formingForceN = useMemo(() => {
    const w = pWidth;
    const σ = matProps.yield;
    const t = thickness;
    return Math.round(σ * t * w * 0.5);
  }, [pWidth, matProps, thickness]);

  // ── Compare rows ──────────────────────────────────────────────────────────
  const compareRows: CompareRow[] = useMemo(() => {
    const ref = refValues[currentIdx];
    const calcAngle = angle.toFixed(1);
    const calcUpper = upperOD.toFixed(1);
    const calcLower = lowerOD.toFixed(1);
    const calcGap = rollGap.toFixed(3);

    function diff(calc: string, ref: string | undefined): { diff: string; ok: boolean } {
      if (!ref || ref.trim() === "") return { diff: "—", ok: true };
      const d = parseFloat(calc) - parseFloat(ref);
      if (isNaN(d)) return { diff: "N/A", ok: false };
      return { diff: (d > 0 ? "+" : "") + d.toFixed(2), ok: Math.abs(d) < parseFloat(calc) * 0.05 };
    }

    return [
      { label: "Bend Angle (°)", calculated: calcAngle, reference: ref?.angle ?? "", ...diff(calcAngle, ref?.angle) },
      { label: "Upper Roll OD (mm)", calculated: calcUpper, reference: ref?.upperOD ?? "", ...diff(calcUpper, ref?.upperOD) },
      { label: "Lower Roll OD (mm)", calculated: calcLower, reference: ref?.lowerOD ?? "", ...diff(calcLower, ref?.lowerOD) },
      { label: "Roll Gap (mm)", calculated: calcGap, reference: ref?.gap ?? "", ...diff(calcGap, ref?.gap) },
      { label: "Springback (°)", calculated: springbackDeg.toFixed(2), reference: "", diff: "—", ok: true },
      { label: "Forming Force (N)", calculated: formingForceN.toFixed(0), reference: "", diff: "—", ok: true },
    ];
  }, [currentIdx, angle, upperOD, lowerOD, rollGap, springbackDeg, formingForceN, refValues]);

  // ── Export summary ────────────────────────────────────────────────────────
  function exportCSV() {
    const header = "Station,Bend Angle,Upper OD,Lower OD,Roll Gap,Springback,Roll Type,Tool Steel";
    const rows = bendAngles.map((a, i) => {
      const r = rollTooling[i];
      const ov = overrides[i];
      const uOD = ov?.enabled ? ov.upperOD : (r?.upperRollOD ?? r?.rollProfile?.rollDiameter ?? 120);
      const lOD = ov?.enabled ? ov.lowerOD : (r?.lowerRollOD ?? r?.rollProfile?.rollDiameter ?? 118);
      const gap = ov?.enabled ? ov.rollGapMm : (r?.rollGap ?? r?.rollProfile?.gap ?? thickness * 1.1);
      const sb = (a * 0.038 * (matProps.yield / 250)).toFixed(2);
      return `S${i + 1},${a.toFixed(1)},${uOD.toFixed(1)},${lOD.toFixed(1)},${gap.toFixed(3)},${sb},${r?.rollType?.name ?? "—"},${r?.rollMaterial?.toolSteel ?? "—"}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "roll_forming_simulation.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  const warnings: string[] = useMemo(() => {
    const w: string[] = [];
    if (rollGap < thickness * 0.9) w.push(`Roll gap (${rollGap.toFixed(2)} mm) is less than strip thickness (${thickness} mm) — risk of strip pinch`);
    if (rollGap > thickness * 1.35) w.push(`Roll gap (${rollGap.toFixed(2)} mm) is >35% over thickness — poor grip, profile inaccuracy`);
    if (angle > 0 && springbackDeg > angle * 0.1) w.push(`Springback (${springbackDeg.toFixed(1)}°) is >10% of bend angle — increase overbend`);
    if (upperOD < 80) w.push("Upper roll OD < 80 mm — possible insufficient bending torque");
    return w;
  }, [rollGap, thickness, angle, springbackDeg, upperOD]);

  // ── Render ────────────────────────────────────────────────────────────────
  const tabCls = (t: string) => `px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === t ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"}`;

  const noData = rollTooling.length === 0 && stations.length === 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#07080f] text-zinc-200">
      {/* ── Header ── */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3 flex-shrink-0 bg-zinc-900/50 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="font-bold text-sm text-indigo-300">Roll Forming Simulator</span>
          <span className="text-zinc-600 text-xs font-mono">v1.0</span>
        </div>
        <div className="flex gap-1 ml-2">
          {(["simulate", "manual", "compare"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={tabCls(t)}>
              {t === "simulate" ? "Simulation" : t === "manual" ? "Manual Check" : "Comparison"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-zinc-500">Mat: <span className="text-zinc-300">{materialType}</span></span>
          <span className="text-[10px] font-mono text-zinc-500">T: <span className="text-zinc-300">{thickness}mm</span></span>
          <span className="text-[10px] font-mono text-zinc-500">Stn: <span className="text-zinc-300">{n}</span></span>
          <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {/* ── No data banner ── */}
      {noData && (
        <div className="m-4 p-4 rounded-lg border border-amber-700/50 bg-amber-950/20 text-amber-300 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-bold mb-1">Roll Tooling Data Needed</div>
            <div className="text-xs text-amber-400">Pehle "Integrated Roll View" ya "Roll Tooling" tool se roll tooling calculate karein. Simulator demo mode mein chal raha hai.</div>
          </div>
        </div>
      )}

      {/* ── Simulation Tab ── */}
      {activeTab === "simulate" && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 min-h-0">

          {/* Station flow bar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider mb-2">Station Flow (click to jump)</div>
            <StationFlowBar
              stations={bendAngles}
              currentIdx={currentIdx}
              onSelect={i => { setPlaying(false); setCurrentIdx(i); }}
              rollTooling={rollTooling}
            />
          </div>

          {/* Main area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* SVG Viewer */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              {/* View controls */}
              <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-500 font-mono">View:</span>
                <button onClick={() => setShowRolls(v => !v)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${showRolls ? "border-blue-600 text-blue-400 bg-blue-950/30" : "border-zinc-700 text-zinc-500"}`}>
                  {showRolls ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Rolls
                </button>
                <button onClick={() => setShowDimensions(v => !v)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${showDimensions ? "border-amber-600 text-amber-400 bg-amber-950/30" : "border-zinc-700 text-zinc-500"}`}>
                  <Ruler className="w-3 h-3" /> Dims
                </button>
                <button onClick={() => setShowPassLine(v => !v)} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${showPassLine ? "border-yellow-600 text-yellow-400 bg-yellow-950/30" : "border-zinc-700 text-zinc-500"}`}>
                  <Target className="w-3 h-3" /> Pass Line
                </button>
              </div>
              {/* SVG */}
              <div className="p-2">
                <StripCrossSection
                  bendAngleDeg={angle}
                  thickness={thickness}
                  profileWidth={pWidth}
                  rollGapMm={rollGap}
                  upperOD={upperOD}
                  lowerOD={lowerOD}
                  rollType={rollType}
                  stationNum={currentIdx + 1}
                  totalStations={n}
                  materialColor={matProps.color}
                  showRolls={showRolls}
                  showDimensions={showDimensions}
                  showPassLine={showPassLine}
                  isFinal={currentIdx === n - 1}
                />
              </div>
            </div>

            {/* Station info panel */}
            <div className="flex flex-col gap-3">
              {/* Station data */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rollType?.color ?? "#475569" }} />
                  <span className="text-xs font-bold text-zinc-200">Station {currentIdx + 1} — {rt?.label ?? `S${currentIdx + 1}`}</span>
                </div>
                {rollType && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border" style={{ color: rollType.color, borderColor: rollType.color + "44", background: rollType.color + "15" }}>
                      {rollType.name.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-zinc-500">{rollType.grooveShape.replace("-", " ")} · {rollType.grooveAngleDeg}°</span>
                  </div>
                )}
                {[
                  ["Bend Angle", `${angle.toFixed(1)}°`, "#f59e0b"],
                  ["Upper OD", `${upperOD.toFixed(1)} mm`, UPPER_COLOR],
                  ["Lower OD", `${lowerOD.toFixed(1)} mm`, LOWER_COLOR],
                  ["Roll Gap", `${rollGap.toFixed(3)} mm`, "#94a3b8"],
                  ["Springback", `+${springbackDeg.toFixed(2)}°`, "#f87171"],
                  ["Forming Force", `${formingForceN.toLocaleString()} N`, "#4ade80"],
                  ["K-Factor", (rt?.kFactor ?? 0.44).toFixed(3), "#c084fc"],  // FIX: fallback 0.42→0.44 (DIN 6935)
                ].map(([label, val, color]) => (
                  <div key={label as string} className="flex justify-between text-[10px] font-mono border-b border-zinc-800/60 pb-0.5">
                    <span className="text-zinc-500">{label}</span>
                    <span style={{ color: color as string }}>{val}</span>
                  </div>
                ))}
                {rt?.rollMaterial && (
                  <div className="pt-1 border-t border-zinc-800">
                    <div className="text-[9px] text-amber-400 font-bold mb-0.5">⬡ Roll Material</div>
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-zinc-500">Tool Steel</span>
                      <span className="text-amber-300">{rt.rollMaterial.toolSteel}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-zinc-500">Surface</span>
                      <span className="text-green-400 text-[8px]">{rt.rollMaterial.surfaceTreatment.split(" ").slice(0, 2).join(" ")}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-zinc-500">Life</span>
                      <span className="text-cyan-400">{rt.rollMaterial.lifeHrs.toLocaleString()} hrs</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold mb-1">
                    <AlertTriangle className="w-3 h-3" /> Warnings
                  </div>
                  {warnings.map((w, i) => (
                    <div key={i} className="text-[9px] text-red-300 leading-tight">• {w}</div>
                  ))}
                </div>
              )}

              {/* Material info */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Material — {materialType}</div>
                {[
                  ["Yield Strength", `${matProps.yield} MPa`],
                  ["UTS", `${matProps.uts} MPa`],
                  ["Elongation", `${matProps.elongation}%`],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-[9px] font-mono text-zinc-400">
                    <span>{l}</span><span className="text-zinc-200">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Playback controls */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button onClick={handleReset} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200" title="Reset">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={handlePrev} disabled={currentIdx === 0} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {playing ? (
                <button onClick={handlePause} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">
                  <Pause className="w-3.5 h-3.5" /> Pause
                </button>
              ) : (
                <button onClick={handlePlay} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">
                  <Play className="w-3.5 h-3.5" /> {currentIdx >= n - 1 ? "Restart" : "Play"}
                </button>
              )}
              <button onClick={handleNext} disabled={currentIdx === n - 1} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex-1 min-w-[120px]">
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-1">
                <span>Station {currentIdx + 1} / {n}</span>
                <span>{angle.toFixed(1)}° bend</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / n) * 100}%` }} />
              </div>
            </div>

            {/* Speed */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Speed:</span>
              {[2000, 1200, 700, 350].map(s => (
                <button key={s} onClick={() => setPlaySpeed(s)} className={`px-1.5 py-0.5 rounded text-[9px] border ${playSpeed === s ? "border-indigo-600 text-indigo-400" : "border-zinc-700 text-zinc-600 hover:text-zinc-400"}`}>
                  {s === 2000 ? "0.5×" : s === 1200 ? "1×" : s === 700 ? "1.7×" : "3×"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Check Tab ── */}
      {activeTab === "manual" && (
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input panel */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-xs font-bold text-zinc-200 mb-3 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                Manual Roll Check — Station {currentIdx + 1}
              </div>
              <p className="text-[10px] text-zinc-500 mb-4">Roll parameters manually check karein. Calculated values se compare kiya jayega aur deviation dikhega.</p>

              {/* Station selector */}
              <div className="mb-4">
                <label className="text-[10px] text-zinc-500 font-mono">Select Station</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {bendAngles.map((_, i) => (
                    <button key={i} onClick={() => setCurrentIdx(i)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono border ${currentIdx === i ? "border-indigo-600 bg-indigo-950/40 text-indigo-300" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
                      S{i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Override toggle */}
              <div className="flex items-center gap-2 mb-3 p-2 rounded bg-zinc-800 border border-zinc-700">
                <input type="checkbox" id="ov-enable" checked={ov?.enabled ?? false} onChange={e => setOverride(currentIdx, "enabled", e.target.checked)} className="accent-indigo-500" />
                <label htmlFor="ov-enable" className="text-[10px] text-zinc-300 font-mono">Enable manual override for S{currentIdx + 1}</label>
              </div>

              {/* Override inputs */}
              <div className="space-y-3">
                {[
                  { key: "upperOD", label: "Upper Roll OD (mm)", val: ov?.upperOD ?? upperOD, color: UPPER_COLOR },
                  { key: "lowerOD", label: "Lower Roll OD (mm)", val: ov?.lowerOD ?? lowerOD, color: LOWER_COLOR },
                  { key: "rollGapMm", label: "Roll Gap (mm)", val: ov?.rollGapMm ?? rollGap, color: "#94a3b8" },
                ].map(({ key, label, val, color }) => (
                  <div key={key}>
                    <label className="text-[10px] font-mono" style={{ color }}>{label}</label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="number" step="0.01"
                        value={Number(ov?.[key as keyof ManualOverride] ?? val)}
                        onChange={e => setOverride(currentIdx, key as keyof ManualOverride, parseFloat(e.target.value))}
                        disabled={!ov?.enabled}
                        className="w-28 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
                      />
                      <span className="text-[9px] text-zinc-600 font-mono">calc: {(val as number).toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {ov?.enabled && (
                <div className="mt-3 p-2 rounded bg-amber-950/20 border border-amber-800/40 text-[9px] text-amber-300 font-mono">
                  ⚠ Override active — simulation showing manual values for S{currentIdx + 1}
                </div>
              )}
            </div>

            {/* Deviation summary */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="text-xs font-bold text-zinc-200 mb-3 flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-amber-400" />
                Deviation Analysis — All Stations
              </div>
              <div className="space-y-1 overflow-y-auto max-h-80">
                {bendAngles.map((a, i) => {
                  const r = rollTooling[i];
                  const o = overrides[i];
                  const hasOv = o?.enabled;
                  const calUOD = r?.upperRollOD ?? r?.rollProfile?.rollDiameter ?? 120;
                  const manUOD = o?.upperOD ?? calUOD;
                  const devUOD = hasOv ? (manUOD - calUOD).toFixed(2) : null;
                  const calGap = r?.rollGap ?? r?.rollProfile?.gap ?? thickness * 1.1;
                  const manGap = o?.rollGapMm ?? calGap;
                  const devGap = hasOv ? (manGap - calGap).toFixed(3) : null;
                  const typeColor = r?.rollType?.color ?? "#475569";
                  return (
                    <div key={i} className="flex items-center gap-2 text-[9px] font-mono p-1.5 rounded border border-zinc-800 hover:bg-zinc-800/30">
                      <span className="w-5 font-bold" style={{ color: typeColor }}>S{i + 1}</span>
                      <span className="text-zinc-500 w-16 truncate">{a.toFixed(1)}°</span>
                      {devUOD !== null ? (
                        <>
                          <span className={`px-1 rounded text-[8px] ${Math.abs(parseFloat(devUOD)) < 1 ? "text-green-400" : "text-red-400"}`}>
                            OD Δ{devUOD}
                          </span>
                          <span className={`px-1 rounded text-[8px] ${Math.abs(parseFloat(devGap ?? "0")) < 0.05 ? "text-green-400" : "text-amber-400"}`}>
                            Gap Δ{devGap}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-700">no override</span>
                      )}
                      <span className="ml-auto text-zinc-700">{r?.rollType?.name ?? "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Compare Tab ── */}
      {activeTab === "compare" && (
        <div className="flex-1 overflow-y-auto p-4 min-h-0 space-y-4">
          {/* Station selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2">Compare Station</div>
            <div className="flex flex-wrap gap-1">
              {bendAngles.map((_, i) => (
                <button key={i} onClick={() => setCurrentIdx(i)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono border ${currentIdx === i ? "border-indigo-600 bg-indigo-950/40 text-indigo-300" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}>
                  S{i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Reference input */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-xs font-bold text-zinc-200 mb-2 flex items-center gap-2">
              <Table className="w-4 h-4 text-cyan-400" />
              Enter Reference Values — Station {currentIdx + 1}
            </div>
            <p className="text-[10px] text-zinc-500 mb-3">Doosre software (COPRA, Ubeco, Excel, manual calc) ke values yahan enter karein. Difference automatically calculate hoga.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: "angle", label: "Bend Angle (°)", placeholder: `calc: ${angle.toFixed(1)}` },
                { key: "upperOD", label: "Upper OD (mm)", placeholder: `calc: ${upperOD.toFixed(1)}` },
                { key: "lowerOD", label: "Lower OD (mm)", placeholder: `calc: ${lowerOD.toFixed(1)}` },
                { key: "gap", label: "Roll Gap (mm)", placeholder: `calc: ${rollGap.toFixed(3)}` },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-[9px] text-zinc-500 font-mono">{label}</label>
                  <input
                    type="number" step="0.01"
                    placeholder={placeholder}
                    value={refValues[currentIdx]?.[key as "angle" | "upperOD" | "lowerOD" | "gap"] ?? ""}
                    onChange={e => setRefValues(prev => ({
                      ...prev,
                      [currentIdx]: { ...(prev[currentIdx] ?? {}), [key]: e.target.value },
                    }))}
                    className="mt-0.5 w-full px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Comparison table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700 flex items-center gap-3">
              <span className="text-xs font-bold text-zinc-100">Comparison — Station {currentIdx + 1}</span>
              <span className="text-[9px] text-zinc-500 font-mono">Sai Rolotech Smart Engines vs. Reference</span>
              <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-green-950/40 text-green-400 border border-green-800/40">±5% tolerance</span>
            </div>
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="bg-zinc-800/30 border-b border-zinc-800">
                  {["Parameter", "Our Calc", "Reference", "Difference", "Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-zinc-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row, i) => (
                  <tr key={i} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "" : "bg-zinc-800/10"}`}>
                    <td className="px-3 py-1.5 text-zinc-300">{row.label}</td>
                    <td className="px-3 py-1.5 text-indigo-300 font-bold">{row.calculated}</td>
                    <td className="px-3 py-1.5 text-zinc-400">{row.reference || <span className="text-zinc-700">—</span>}</td>
                    <td className="px-3 py-1.5" style={{ color: row.diff === "—" ? "#4b5563" : row.ok ? "#4ade80" : "#f87171" }}>{row.diff}</td>
                    <td className="px-3 py-1.5">
                      {row.reference ? (
                        row.ok
                          ? <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" /> Match</span>
                          : <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" /> Mismatch</span>
                      ) : (
                        <span className="text-zinc-700 text-[9px]">no ref</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* All-stations summary table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700">
              <span className="text-xs font-bold text-zinc-100">All Stations Summary</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[9px] font-mono">
                <thead>
                  <tr className="bg-zinc-800/30 border-b border-zinc-800">
                    {["Stn", "Roll Type", "Bend∠", "Upper OD", "Lower OD", "Gap", "Springback", "Overbend Rec", "Forming Force"].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left text-zinc-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bendAngles.map((a, i) => {
                    const r = rollTooling[i];
                    const o = overrides[i];
                    const uOD = o?.enabled ? (o.upperOD) : (r?.upperRollOD ?? r?.rollProfile?.rollDiameter ?? 120);
                    const lOD = o?.enabled ? (o.lowerOD) : (r?.lowerRollOD ?? r?.rollProfile?.rollDiameter ?? 118);
                    const gap = o?.enabled ? (o.rollGapMm) : (r?.rollGap ?? r?.rollProfile?.gap ?? thickness * 1.1);
                    const sb = (a * 0.038 * (matProps.yield / 250)).toFixed(2);
                    const overbend = a > 0 ? `+${sb}°` : "—";
                    const ff = Math.round(matProps.yield * thickness * pWidth * 0.5);
                    const typeColor = r?.rollType?.color ?? "#475569";
                    return (
                      <tr key={i} className={`border-b border-zinc-800/40 ${i === currentIdx ? "bg-indigo-950/20 border-indigo-800/40" : ""}`}
                        onClick={() => setCurrentIdx(i)} style={{ cursor: "pointer" }}>
                        <td className="px-2 py-1 font-bold text-zinc-300">S{i + 1}</td>
                        <td className="px-2 py-1 text-[8px] whitespace-nowrap" style={{ color: typeColor }}>{r?.rollType?.name ?? "—"}</td>
                        <td className="px-2 py-1 text-amber-400">{a.toFixed(1)}°</td>
                        <td className="px-2 py-1 text-blue-300">{uOD.toFixed(1)}</td>
                        <td className="px-2 py-1 text-orange-300">{lOD.toFixed(1)}</td>
                        <td className="px-2 py-1 text-zinc-300">{gap.toFixed(3)}</td>
                        <td className="px-2 py-1 text-red-400">{sb}°</td>
                        <td className="px-2 py-1 text-pink-400">{overbend}</td>
                        <td className="px-2 py-1 text-green-400">{ff.toLocaleString()} N</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
