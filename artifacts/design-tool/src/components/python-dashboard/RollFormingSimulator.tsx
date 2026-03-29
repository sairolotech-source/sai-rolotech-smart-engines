import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Activity, Zap, AlertTriangle, CheckCircle, Info, Layers,
  Bot, ShieldCheck, ShieldAlert, ShieldOff, Plus, Wrench,
  GitBranch, Link2, Cpu, Settings2,
} from "lucide-react";
import { getStationExplanation, getManufacturabilityWarnings } from "@/lib/stationLogicEngine";

interface ProfilePoint { x: number; y: number; }
interface RollProfile   { x: number; y: number; }

interface Defect {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  icon: string;
  message: string;
}

interface SimPass {
  pass_no: number;
  station_label: string;
  stage_type: string;
  stage_color: string;
  pass_progress_pct: number;
  target_angle_deg: number;
  springback_deg: number;
  corrected_angle_deg: number;
  strain: number;
  forming_force_kn: number;
  motor_power_kw: number;
  strip_width_mm: number;
  roll_gap_mm: number;
  forming_depth_mm: number;
  defects: Defect[];
  profile_points: ProfilePoint[];
  upper_roll_profile?: RollProfile[] | null;
  lower_roll_profile?: RollProfile[] | null;
}

interface SimData {
  status: string;
  engine: string;
  note: string;
  material: string;
  thickness_mm: number;
  bend_radius_mm: number;
  springback_factor: number;
  strip_speed_mpm: number;
  total_passes: number;
  quality: { score: number; label: string; high_defects: number; med_defects: number };
  simulation_passes: SimPass[];
}

interface OptimizerCorrection {
  stand: number;
  action: string;
  detail: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

interface OptimizerData {
  optimization_score: number;
  optimization_label: string;
  suggestions: string[];
  corrections: OptimizerCorrection[];
  pass_distribution_notes: string[];
  recommended_station_count: number;
  optimised_station_count: number;
  stations_added: number;
  material: string;
}

interface DecisionData {
  decision: "acceptable_for_preliminary_export" | "semi_auto_rework" | "manual_review";
  traffic_light: "GREEN" | "YELLOW" | "RED";
  recommended_action: string;
  readiness_pct: number;
  summary: string[];
  blocking_defects: string[];
  optimizer_score: number;
  quality_score: number;
}

interface Props {
  data: SimData | null;
  optimizerData?: OptimizerData | null;
  decisionData?: DecisionData | null;
  loading?: boolean;
  rollOD?: number;
  bore?: number;
  faceWidth?: number;
}

type AnimSpeed = "slow" | "normal" | "fast";
const SPEED_MS: Record<AnimSpeed, number> = { slow: 1600, normal: 900, fast: 400 };

const STAGE_LABEL: Record<string, string> = {
  flat:                "Flat Strip",
  pre_bend:            "Pre-Bend",
  initial_bend:        "Initial Bend",
  progressive_forming: "Progressive Forming",
  lip_forming:         "Lip Forming",
  calibration:         "Calibration",
};

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:   "text-red-400 bg-red-500/10 border-red-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW:    "text-blue-400 bg-blue-500/10 border-blue-500/30",
};

// ─── SVG PROFILE RENDERER ───────────────────────────────────────────────────

function calcViewBox(allPasses: SimPass[], padding = 20): { vb: string; scale: number } {
  const allPts = allPasses.flatMap(p => p.profile_points ?? []);
  if (!allPts.length) return { vb: "-100 -60 200 120", scale: 1 };
  const xs = allPts.map(p => p.x);
  const ys = allPts.map(p => p.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = Math.min(560 / w, 260 / h);
  return { vb: `${minX} ${minY} ${w} ${h}`, scale };
}

function toPolyline(pts: ProfilePoint[]): string {
  return pts.map(p => `${p.x},${p.y}`).join(" ");
}

function toPath(pts: ProfilePoint[]): string {
  if (!pts.length) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function RollFormingSimulator({ data, optimizerData, decisionData, loading, rollOD = 100, bore = 50, faceWidth = 60 }: Props) {
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [playing,     setPlaying]     = useState(false);
  const [showFlower,  setShowFlower]  = useState(true);
  const [animSpeed,   setAnimSpeed]   = useState<AnimSpeed>("normal");
  const [showExplain, setShowExplain] = useState(true);
  const [showWarnings,setShowWarnings]= useState(true);
  const [showChain,   setShowChain]   = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const passes = data?.simulation_passes ?? [];
  const total  = passes.length;

  const go = useCallback((idx: number) => {
    setActiveIdx(Math.max(0, Math.min(total - 1, idx)));
  }, [total]);

  // Auto-play with speed control
  useEffect(() => {
    if (playing && total > 1) {
      intervalRef.current = setInterval(() => {
        setActiveIdx(prev => {
          if (prev >= total - 1) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, SPEED_MS[animSpeed]);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, total, animSpeed]);

  useEffect(() => { setActiveIdx(0); setPlaying(false); }, [data]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-[#0d0d1a] p-6 space-y-3">
        <div className="flex items-center gap-2 text-violet-400">
          <Activity className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-semibold">Running Simulation…</span>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-violet-500/40 border-t-violet-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !passes.length) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-[#0d0d1a] p-6">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-violet-400" />
          <span className="text-sm font-bold text-violet-300 uppercase tracking-wider">
            Roll Forming Simulator
          </span>
          <span className="ml-auto text-[10px] text-gray-600 font-mono">v2.3.0</span>
        </div>
        <div className="h-36 flex flex-col items-center justify-center text-center gap-2">
          <Layers className="w-8 h-8 text-gray-700" />
          <p className="text-gray-500 text-xs">Run the pipeline to launch the simulator.</p>
          <p className="text-gray-600 text-[10px]">Station-by-station deformation · Strain · Force · Defect detection</p>
        </div>
      </div>
    );
  }

  const cur   = passes[activeIdx];
  const qual  = data.quality;
  const { vb } = calcViewBox(passes, 25);

  const qualColor = qual.score >= 90 ? "text-green-400" :
                    qual.score >= 75 ? "text-blue-400"  :
                    qual.score >= 55 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-[#0d0d1a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-violet-500/10 flex items-center gap-3 flex-wrap">
        <Layers className="w-5 h-5 text-violet-400 shrink-0" />
        <div>
          <div className="text-sm font-bold text-violet-300 uppercase tracking-wider">
            Roll Forming Simulator
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
            {data.material} · {data.thickness_mm}mm · r={data.bend_radius_mm}mm · {data.strip_speed_mpm}m/min
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Quality badge */}
          <div className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
            qual.score >= 90 ? "border-green-500/30 bg-green-500/10 text-green-400" :
            qual.score >= 75 ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
            qual.score >= 55 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                               "border-red-500/30 bg-red-500/10 text-red-400"
          }`}>
            {qual.label} · {qual.score}%
          </div>
          {/* Chain view button */}
          <button
            onClick={() => setShowChain(s => !s)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
              showChain
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                : "border-gray-700 text-gray-500 hover:border-gray-500"
            }`}
          >
            <Link2 className="w-2.5 h-2.5" /> Chain
          </button>
          {/* Flower toggle */}
          <button
            onClick={() => setShowFlower(s => !s)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${
              showFlower
                ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                : "border-gray-700 text-gray-500 hover:border-gray-500"
            }`}
          >
            🌸 Flower
          </button>
        </div>
      </div>

      {/* ── Workflow Chain Panel ────────────────────────────────────── */}
      {showChain && (
        <WorkflowChain
          cur={cur}
          total={total}
          activeIdx={activeIdx}
          material={data.material}
          thickness={data.thickness_mm}
        />
      )}

      {/* SVG Viewer */}
      <div className="relative bg-[#080810] border-b border-violet-500/10" style={{ height: 280 }}>
        <svg
          viewBox={vb}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid */}
          <defs>
            <pattern id="sim-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1a2e" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x="-9999" y="-9999" width="99999" height="99999" fill="url(#sim-grid)" />

          {/* Centre axis */}
          <line x1="-9999" y1="0" x2="9999" y2="0" stroke="#1e2040" strokeWidth="0.8" strokeDasharray="4,4" />
          <line x1="0" y1="-9999" x2="0" y2="9999" stroke="#1e2040" strokeWidth="0.8" strokeDasharray="4,4" />

          {/* Flower diagram — all passes faded */}
          {showFlower && passes.map((p, i) => {
            if (i === activeIdx) return null;
            const opacity = 0.08 + (i / passes.length) * 0.15;
            return (
              <polyline
                key={`flower-${i}`}
                points={toPolyline(p.profile_points)}
                fill="none"
                stroke={p.stage_color}
                strokeWidth="0.8"
                opacity={opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}

          {/* Active profile — glowing */}
          <polyline
            points={toPolyline(cur.profile_points)}
            fill="none"
            stroke={cur.stage_color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dotted nodes on active profile */}
          {cur.profile_points.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="1.2"
              fill={cur.stage_color} opacity="0.9" />
          ))}

          {/* Roll profiles (upper = orange, lower = blue) */}
          {cur.upper_roll_profile && (
            <polyline
              points={toPolyline(cur.upper_roll_profile as ProfilePoint[])}
              fill="none" stroke="#f97316" strokeWidth="1.2"
              strokeDasharray="3,2" opacity="0.6"
              strokeLinecap="round"
            />
          )}
          {cur.lower_roll_profile && (
            <polyline
              points={toPolyline(cur.lower_roll_profile as ProfilePoint[])}
              fill="none" stroke="#3b82f6" strokeWidth="1.2"
              strokeDasharray="3,2" opacity="0.6"
              strokeLinecap="round"
            />
          )}

          {/* Contact-point red dots — strip↔roll intersections */}
          {cur.profile_points.length > 1 && (() => {
            const pts = cur.profile_points;
            const contactPts: ProfilePoint[] = [];
            // First, last, and bend vertices are key contact points
            contactPts.push(pts[0]);
            contactPts.push(pts[pts.length - 1]);
            // Detect corner/bend vertices (angle change)
            for (let i = 1; i < pts.length - 1; i++) {
              const dx1 = pts[i].x - pts[i-1].x;
              const dy1 = pts[i].y - pts[i-1].y;
              const dx2 = pts[i+1].x - pts[i].x;
              const dy2 = pts[i+1].y - pts[i].y;
              const angle = Math.abs(Math.atan2(dy1*dx2-dx1*dy2, dx1*dx2+dy1*dy2));
              if (angle > 0.12) contactPts.push(pts[i]);
            }
            return contactPts.map((pt, ci) => (
              <g key={`cp-${ci}`}>
                <circle cx={pt.x} cy={pt.y} r="3.5" fill="#ef4444" opacity="0.25" />
                <circle cx={pt.x} cy={pt.y} r="2" fill="#ef4444" opacity="0.9" />
                <circle cx={pt.x} cy={pt.y} r="0.8" fill="#ffffff" opacity="0.9" />
              </g>
            ));
          })()}

          {/* Bend completion annotation */}
          {(() => {
            const finalAngle = passes[total - 1]?.target_angle_deg ?? cur.target_angle_deg;
            const bentPct = finalAngle > 0 ? Math.min(100, (cur.pass_progress_pct)) : 0;
            const remaining = Math.max(0, finalAngle - cur.target_angle_deg);
            return (
              <text x="4" y="-4" fontSize="4" fill="#7c3aed" opacity="0.8" fontFamily="monospace">
                {`✓ ${bentPct.toFixed(0)}% formed · ${remaining.toFixed(1)}° remaining`}
              </text>
            );
          })()}
        </svg>

        {/* Stage badge overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div
            className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: cur.stage_color + "30", color: cur.stage_color, border: `1px solid ${cur.stage_color}50` }}
          >
            {STAGE_LABEL[cur.stage_type] ?? cur.stage_type}
          </div>
          {cur.defects.length > 0 && (
            <div className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              {cur.defects.length} defect{cur.defects.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Legend (top-right) */}
        {cur.upper_roll_profile && (
          <div className="absolute top-3 right-3 text-[9px] space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t border-dashed border-orange-400" />
              <span className="text-gray-500">Upper Roll</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t border-dashed border-blue-400" />
              <span className="text-gray-500">Lower Roll</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 border-t border-solid" style={{ borderColor: cur.stage_color }} />
              <span className="text-gray-500">Sheet Profile</span>
            </div>
          </div>
        )}

        {/* Progress bar (bottom) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${cur.pass_progress_pct}%`,
              backgroundColor: cur.stage_color,
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="px-5 py-3 border-b border-violet-500/10 flex items-center gap-3">
        <button onClick={() => { go(0); setPlaying(false); }}
          className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <SkipBack className="w-4 h-4" />
        </button>
        <button onClick={() => go(activeIdx - 1)}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ backgroundColor: cur.stage_color + "25", color: cur.stage_color, border: `1px solid ${cur.stage_color}40` }}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {playing ? "Pause" : "Animate"}
        </button>
        <button onClick={() => go(activeIdx + 1)}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => { go(total - 1); setPlaying(false); }}
          className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Slider */}
        <div className="flex-1 mx-2">
          <input
            type="range" min={0} max={total - 1} value={activeIdx}
            onChange={e => { go(Number(e.target.value)); setPlaying(false); }}
            className="w-full accent-violet-500 cursor-pointer"
          />
        </div>

        <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
          {cur.station_label} ({activeIdx + 1}/{total})
        </span>

        {/* Speed control */}
        <div className="flex items-center gap-1 border border-gray-700 rounded-lg px-1.5 py-1">
          <Settings2 className="w-3 h-3 text-gray-600" />
          {(["slow","normal","fast"] as AnimSpeed[]).map(s => (
            <button
              key={s}
              onClick={() => setAnimSpeed(s)}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors font-mono ${
                animSpeed === s
                  ? "bg-violet-500/20 text-violet-300"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Station selector pills */}
      <div className="px-5 py-2.5 border-b border-violet-500/10 flex gap-1.5 overflow-x-auto">
        {passes.map((p, i) => (
          <button
            key={i}
            onClick={() => { go(i); setPlaying(false); }}
            title={p.station_label}
            className="shrink-0 w-7 h-7 rounded-full text-[9px] font-bold transition-all border"
            style={i === activeIdx ? {
              backgroundColor: p.stage_color + "40",
              borderColor: p.stage_color,
              color: p.stage_color,
            } : {
              backgroundColor: "transparent",
              borderColor: "#2d2d4a",
              color: "#6b7280",
            }}
          >
            {p.pass_no}
          </button>
        ))}
      </div>

      {/* Engineering metrics row */}
      <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-violet-500/10">
        <MetricCard
          label="Bend Angle"
          value={`${cur.target_angle_deg.toFixed(1)}°`}
          sub={`Corrected: ${cur.corrected_angle_deg.toFixed(1)}°`}
          icon={<Activity className="w-3.5 h-3.5" />}
          color="violet"
        />
        <MetricCard
          label="Outer Strain"
          value={`${(cur.strain * 100).toFixed(2)}%`}
          sub={cur.strain > 0.2 ? "⚠ Near limit" : "✓ In range"}
          icon={<Zap className="w-3.5 h-3.5" />}
          color={cur.strain > 0.2 ? "red" : "green"}
        />
        <MetricCard
          label="Forming Force"
          value={`${cur.forming_force_kn.toFixed(2)} kN`}
          sub={`Power: ${cur.motor_power_kw.toFixed(2)} kW`}
          icon={<Zap className="w-3.5 h-3.5" />}
          color="blue"
        />
        <MetricCard
          label="Strip Width"
          value={`${cur.strip_width_mm.toFixed(1)} mm`}
          sub={`Gap: ${cur.roll_gap_mm.toFixed(2)} mm · Depth: ${cur.forming_depth_mm.toFixed(1)} mm`}
          icon={<Layers className="w-3.5 h-3.5" />}
          color="orange"
        />
      </div>

      {/* Springback row */}
      <div className="px-5 py-2 border-b border-violet-500/10 flex items-center gap-4 text-xs flex-wrap">
        <div className="text-gray-500">
          Springback: <span className="text-yellow-400 font-mono">{cur.springback_deg.toFixed(2)}°</span>
        </div>
        <div className="text-gray-500">
          Progress: <span className="text-violet-400 font-mono">{cur.pass_progress_pct.toFixed(1)}%</span>
        </div>
        <div className="text-gray-500 ml-auto text-[10px] italic opacity-60">{data.note}</div>
      </div>

      {/* Defects */}
      {cur.defects.length > 0 ? (
        <div className="px-5 py-3 space-y-1.5 border-b border-violet-500/10">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Defect Alerts — Station {cur.pass_no}
          </div>
          {cur.defects.map((d, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${SEVERITY_COLOR[d.severity]}`}
            >
              <span>{d.icon}</span>
              <div>
                <span className="font-semibold mr-1">[{d.severity}]</span>
                {d.message}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-2 border-b border-violet-500/10 flex items-center gap-2 text-xs text-green-500/70">
          <CheckCircle className="w-3.5 h-3.5" />
          No defects detected at this station
        </div>
      )}

      {/* Quality summary footer */}
      <div className="px-5 py-3 flex items-center gap-4 flex-wrap border-b border-violet-500/10">
        <div className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
          Forming Quality
        </div>
        <div className={`text-sm font-bold ${qualColor}`}>
          {qual.score}/100 — {qual.label}
        </div>
        {qual.high_defects > 0 && (
          <div className="text-xs text-red-400">
            {qual.high_defects} HIGH severity issue{qual.high_defects > 1 ? "s" : ""}
          </div>
        )}
        {qual.med_defects > 0 && (
          <div className="text-xs text-yellow-400">
            {qual.med_defects} MEDIUM issue{qual.med_defects > 1 ? "s" : ""}
          </div>
        )}
        <div className="ml-auto text-[10px] text-gray-600 font-mono">
          simulation_engine · {data.total_passes} passes
        </div>
      </div>

      {/* ── Station Logic Explanation Box ──────────────────── */}
      <StationLogicBox
        cur={cur}
        allPasses={passes}
        thickness={data.thickness_mm}
        material={data.material}
        open={showExplain}
        onToggle={() => setShowExplain(s => !s)}
      />

      {/* ── Manufacturability Warnings ─────────────────────── */}
      <ManufacturabilityPanel
        passes={passes}
        rollOD={rollOD}
        bore={bore}
        faceWidth={faceWidth}
        thickness={data.thickness_mm}
        material={data.material}
        open={showWarnings}
        onToggle={() => setShowWarnings(s => !s)}
      />

      {/* ── AI Optimizer Panel ──────────────────────────────── */}
      {optimizerData && (
        <AiOptimizerPanel optimizer={optimizerData} />
      )}

      {/* ── Decision Panel ─────────────────────────────────── */}
      {decisionData && (
        <DecisionPanel decision={decisionData} />
      )}
    </div>
  );
}

// ─── WORKFLOW CHAIN PANEL ────────────────────────────────────────────────────

function WorkflowChain({
  cur, total, activeIdx, material, thickness,
}: {
  cur: SimPass; total: number; activeIdx: number; material: string; thickness: number;
}) {
  const steps = [
    { id: "profile",  label: "Input Profile",     icon: "📐", desc: `${material} · ${thickness}mm` },
    { id: "strip",    label: "Developed Strip",    icon: "📏", desc: `Strip width: ${cur.strip_width_mm.toFixed(1)} mm` },
    { id: "flower",   label: "Flower Pattern",     icon: "🌸", desc: `${total} stations · ${cur.pass_progress_pct.toFixed(0)}% formed` },
    { id: "geometry", label: "Station Geometry",   icon: "⚙️", desc: `Station ${cur.pass_no}: ${cur.target_angle_deg.toFixed(1)}°` },
    { id: "contour",  label: "Roll Contour",       icon: "🔵", desc: `Gap: ${cur.roll_gap_mm.toFixed(2)} mm · Depth: ${cur.forming_depth_mm.toFixed(1)} mm` },
    { id: "drawing",  label: "Roll Drawing",       icon: "📄", desc: "Export → SVG / DXF / PDF" },
  ];

  const activeStep = activeIdx < 1 ? 0 :
                     activeIdx < Math.ceil(total * 0.25) ? 1 :
                     activeIdx < Math.ceil(total * 0.75) ? 2 :
                     activeIdx < total - 1 ? 3 :
                     cur.stage_type === "calibration" ? 4 : 5;

  return (
    <div className="px-5 py-3 border-b border-cyan-500/15 bg-cyan-500/3">
      <div className="text-[9px] uppercase tracking-wider text-cyan-600 font-semibold mb-2 flex items-center gap-1">
        <Link2 className="w-3 h-3" /> Profile → Flower → Roll Workflow Chain
      </div>
      <div className="flex items-center gap-0 overflow-x-auto">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center shrink-0">
            <div className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition-all ${
              i === activeStep
                ? "bg-cyan-500/15 border border-cyan-500/40"
                : i < activeStep
                ? "opacity-60"
                : "opacity-30"
            }`}>
              <span className="text-sm leading-none">{step.icon}</span>
              <span className={`text-[9px] font-semibold mt-0.5 ${i === activeStep ? "text-cyan-300" : "text-gray-500"}`}>
                {step.label}
              </span>
              <span className="text-[8px] text-gray-600 max-w-[70px] text-center leading-tight mt-0.5">
                {step.desc}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${i < activeStep ? "bg-cyan-500/60" : "bg-gray-700"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── STATION LOGIC EXPLANATION BOX ───────────────────────────────────────────

function StationLogicBox({
  cur, allPasses, thickness, material, open, onToggle,
}: {
  cur: SimPass; allPasses: SimPass[]; thickness: number; material: string;
  open: boolean; onToggle: () => void;
}) {
  const explain = getStationExplanation(cur, allPasses, thickness, material);

  const riskColors = {
    ok:      { text: "text-green-400", bg: "bg-green-500/8", border: "border-green-500/20" },
    caution: { text: "text-yellow-400", bg: "bg-yellow-500/8", border: "border-yellow-500/20" },
    warning: { text: "text-red-400",   bg: "bg-red-500/8",    border: "border-red-500/20" },
  };
  const riskCfg = riskColors[explain.riskLevel];

  return (
    <div className="border-t border-violet-500/10">
      <button
        onClick={onToggle}
        className="w-full px-5 py-2.5 flex items-center gap-2 hover:bg-white/2 transition-colors"
      >
        <Info className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">
          Station {cur.pass_no} — {STAGE_LABEL[cur.stage_type] ?? cur.stage_type}
        </span>
        <span className="ml-2 text-[9px] text-gray-600">Why does this station exist?</span>
        <ChevronRight className={`ml-auto w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 flex flex-col gap-2.5">
          {/* Purpose */}
          <div className="text-xs text-gray-300 leading-relaxed">
            <span className="text-blue-400 font-semibold">Purpose: </span>{explain.purpose}
          </div>
          {/* Forming detail */}
          <div className="text-xs text-gray-400 leading-relaxed">
            <span className="text-violet-400 font-semibold">Forming: </span>{explain.forming}
          </div>
          {/* Next station note */}
          <div className="text-xs text-gray-500 leading-relaxed">
            <span className="text-gray-400 font-semibold">Next: </span>{explain.incremental}
          </div>
          {/* Technical note */}
          <div className="text-[10px] text-gray-600 font-mono border-t border-white/5 pt-2">
            {explain.noteText}
          </div>
          {/* Risk note */}
          <div className={`text-xs rounded-lg border px-3 py-2 ${riskCfg.text} ${riskCfg.bg} ${riskCfg.border} leading-relaxed`}>
            {explain.riskNote || "✓ No specific risk for this station type."}
          </div>
          {/* What if removed */}
          <div className="text-[10px] text-gray-600 border border-gray-800 rounded-lg px-3 py-2 leading-relaxed">
            <span className="text-gray-500 font-semibold">If removed: </span>
            {cur.stage_type === "calibration"
              ? "Strip will exit with springback error. Final profile angle will be incorrect by " + cur.springback_deg.toFixed(2) + "°."
              : cur.stage_type === "flat"
              ? "Strip entry tracking will be uncontrolled — potential mis-feed into Station 2."
              : `The ${cur.target_angle_deg.toFixed(1)}° angle increment would be transferred to adjacent station, risking excessive single-pass forming.`}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MANUFACTURABILITY WARNINGS PANEL ────────────────────────────────────────

function ManufacturabilityPanel({
  passes, rollOD, bore, faceWidth, thickness, material, open, onToggle,
}: {
  passes: SimPass[]; rollOD: number; bore: number; faceWidth: number;
  thickness: number; material: string; open: boolean; onToggle: () => void;
}) {
  const warnings = getManufacturabilityWarnings(passes, rollOD, bore, faceWidth, thickness, material);
  const highCount = warnings.filter(w => w.severity === "HIGH").length;
  const medCount  = warnings.filter(w => w.severity === "MEDIUM").length;

  const severityColor: Record<string, string> = {
    HIGH:   "text-red-300 bg-red-500/10 border-red-500/25",
    MEDIUM: "text-yellow-300 bg-yellow-500/10 border-yellow-500/25",
    LOW:    "text-blue-300 bg-blue-500/10 border-blue-500/25",
  };

  return (
    <div className="border-t border-orange-500/15">
      <button
        onClick={onToggle}
        className="w-full px-5 py-2.5 flex items-center gap-2 hover:bg-white/2 transition-colors"
      >
        <Cpu className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-orange-300 uppercase tracking-wider">
          Manufacturability Check
        </span>
        {warnings.length === 0 ? (
          <span className="ml-2 text-[9px] text-green-500 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> All clear
          </span>
        ) : (
          <div className="ml-2 flex items-center gap-1.5">
            {highCount > 0 && (
              <span className="text-[9px] bg-red-500/15 text-red-300 border border-red-500/25 rounded-full px-1.5 py-0.5">
                {highCount} HIGH
              </span>
            )}
            {medCount > 0 && (
              <span className="text-[9px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/25 rounded-full px-1.5 py-0.5">
                {medCount} MED
              </span>
            )}
          </div>
        )}
        <ChevronRight className={`ml-auto w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 flex flex-col gap-2">
          {warnings.length === 0 ? (
            <div className="text-xs text-green-400 flex items-center gap-2 py-1">
              <CheckCircle className="w-4 h-4" />
              No manufacturability issues detected. Design is within acceptable geometry bounds.
            </div>
          ) : (
            warnings.map((w, i) => (
              <div key={i} className={`text-xs rounded-lg border px-3 py-2.5 ${severityColor[w.severity]}`}>
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <AlertTriangle className="w-3 h-3" />
                  [{w.severity}] {w.title}
                  {w.station && (
                    <span className="ml-auto text-[9px] opacity-70 font-mono">Station {w.station}</span>
                  )}
                </div>
                <div className="opacity-80 text-[10px] leading-relaxed">{w.detail}</div>
              </div>
            ))
          )}
          <div className="text-[9px] text-gray-600 mt-1 font-mono">
            manufacturability_check_engine · roll_OD={rollOD} bore={bore} face={faceWidth}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI OPTIMIZER PANEL ──────────────────────────────────────────────────────

function AiOptimizerPanel({ optimizer }: { optimizer: OptimizerData }) {
  const [open, setOpen] = useState(true);

  const scoreColor =
    optimizer.optimization_score >= 88 ? "text-green-400" :
    optimizer.optimization_score >= 70 ? "text-yellow-400" : "text-red-400";

  const priorityColor: Record<string, string> = {
    HIGH:   "bg-red-500/10 border-red-500/30 text-red-300",
    MEDIUM: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
    LOW:    "bg-blue-500/10 border-blue-500/30 text-blue-300",
  };

  return (
    <div className="border-t border-violet-500/10">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center gap-2 hover:bg-white/2 transition-colors"
      >
        <Bot className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">
          AI Optimizer
        </span>
        <span className={`ml-2 text-sm font-bold font-mono ${scoreColor}`}>
          {optimizer.optimization_score}/100 — {optimizer.optimization_label}
        </span>
        {optimizer.stations_added > 0 && (
          <span className="ml-2 flex items-center gap-1 text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/20 rounded-full px-2 py-0.5">
            <Plus className="w-2.5 h-2.5" />
            {optimizer.stations_added} station{optimizer.stations_added > 1 ? "s" : ""} recommended
          </span>
        )}
        <ChevronRight className={`ml-auto w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-4 flex flex-col gap-3">
          {/* Station count change */}
          {optimizer.stations_added > 0 && (
            <div className="flex items-center gap-3 text-xs bg-violet-500/8 border border-violet-500/20 rounded-lg px-3 py-2">
              <Layers className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-violet-300">
                Station plan: <strong>{optimizer.recommended_station_count}</strong> original
                → <strong className="text-violet-200">{optimizer.optimised_station_count}</strong> optimised
                <span className="text-violet-500 ml-1">({optimizer.material})</span>
              </span>
            </div>
          )}

          {/* Suggestions */}
          {optimizer.suggestions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Suggestions</div>
              {optimizer.suggestions.map((s, i) => (
                <div key={i} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                  <span className="text-violet-400 mt-0.5">•</span>
                  {s}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-green-400 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5" />
              No issues found — current station plan is optimal
            </div>
          )}

          {/* Corrections */}
          {optimizer.corrections.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">
                Tooling Corrections ({optimizer.corrections.length})
              </div>
              {optimizer.corrections.map((c, i) => (
                <div key={i} className={`text-xs rounded-lg border px-3 py-2 ${priorityColor[c.priority]}`}>
                  <div className="flex items-center gap-1.5 font-semibold mb-0.5">
                    <Wrench className="w-3 h-3" />
                    Stand {c.stand} — {c.action.replace(/_/g, " ").toUpperCase()}
                    <span className="ml-auto text-[9px] opacity-70">{c.priority}</span>
                  </div>
                  <div className="opacity-80 text-[10px]">{c.detail}</div>
                </div>
              ))}
            </div>
          )}

          {/* Pass distribution notes */}
          {optimizer.pass_distribution_notes.length > 0 && (
            <div className="flex flex-col gap-1 text-[10px] text-gray-500 border-t border-white/5 pt-2">
              {optimizer.pass_distribution_notes.map((n, i) => (
                <div key={i}>• {n}</div>
              ))}
            </div>
          )}

          <div className="text-[9px] text-gray-600 mt-1 font-mono">
            ai_optimizer_engine · rule-based approximation — not a ML model
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DECISION PANEL ───────────────────────────────────────────────────────────

function DecisionPanel({ decision }: { decision: DecisionData }) {
  const cfg = {
    acceptable_for_preliminary_export: {
      Icon: ShieldCheck,
      label: "ACCEPTABLE FOR PRELIMINARY EXPORT",
      border: "border-green-500/30",
      bg:     "bg-green-500/8",
      icon:   "text-green-400",
      badge:  "bg-green-500/15 text-green-300 border-green-500/25",
      light:  "bg-green-500",
    },
    semi_auto_rework: {
      Icon: ShieldAlert,
      label: "SEMI-AUTO REWORK REQUIRED",
      border: "border-yellow-500/30",
      bg:     "bg-yellow-500/8",
      icon:   "text-yellow-400",
      badge:  "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
      light:  "bg-yellow-500",
    },
    manual_review: {
      Icon: ShieldOff,
      label: "MANUAL ENGINEERING REVIEW",
      border: "border-red-500/30",
      bg:     "bg-red-500/8",
      icon:   "text-red-400",
      badge:  "bg-red-500/15 text-red-300 border-red-500/25",
      light:  "bg-red-500",
    },
  }[decision.decision];

  const { Icon } = cfg;

  return (
    <div className={`border-t ${cfg.border}`}>
      <div className={`px-5 py-4 ${cfg.bg}`}>
        {/* Header row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Traffic light dot */}
          <div className={`w-3 h-3 rounded-full ${cfg.light} shadow-lg`} style={{ boxShadow: `0 0 8px 2px ${cfg.light.replace("bg-", "")}` }} />
          <Icon className={`w-5 h-5 ${cfg.icon}`} />
          <span className={`text-xs font-bold tracking-wider ${cfg.icon}`}>{cfg.label}</span>
          <span className={`ml-auto text-xs font-bold font-mono border rounded-full px-2.5 py-0.5 ${cfg.badge}`}>
            {decision.readiness_pct}% ready
          </span>
        </div>

        {/* Summary bullets */}
        <div className="flex flex-col gap-1 mb-2">
          {decision.summary.map((s, i) => (
            <div key={i} className="text-xs text-gray-300">{s}</div>
          ))}
        </div>

        {/* Recommended action */}
        <div className={`text-xs rounded-lg border px-3 py-2 ${cfg.badge} opacity-90 leading-relaxed`}>
          {decision.recommended_action}
        </div>

        {/* Scores row */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500 font-mono">
          <span>Optimizer: <strong className="text-gray-400">{decision.optimizer_score}/100</strong></span>
          <span>Quality: <strong className="text-gray-400">{decision.quality_score}/100</strong></span>
          <span className="ml-auto">simulation_decision_engine</span>
        </div>
      </div>
    </div>
  );
}

// ─── METRIC CARD ────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  color: "violet" | "green" | "blue" | "orange" | "red";
}) {
  const colors = {
    violet: "border-violet-500/20 bg-violet-500/5 text-violet-300",
    green:  "border-green-500/20 bg-green-500/5 text-green-300",
    blue:   "border-blue-500/20 bg-blue-500/5 text-blue-300",
    orange: "border-orange-500/20 bg-orange-500/5 text-orange-300",
    red:    "border-red-500/20 bg-red-500/5 text-red-300",
  };
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider opacity-70 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-base font-bold font-mono leading-tight">{value}</div>
      {sub && <div className="text-[9px] opacity-60 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
}
