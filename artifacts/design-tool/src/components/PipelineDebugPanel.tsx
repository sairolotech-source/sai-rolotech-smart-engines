import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SkipForward,
  ChevronDown,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  FileText,
  Layers,
  Ruler,
  FlaskConical,
  Flower,
  Settings2,
  Gauge,
  Zap,
  ClipboardList,
} from "lucide-react";
import { runAutoPipeline } from "../lib/api";
import type { ProfileGeometry } from "../store/useCncStore";

type StepStatus = "pass" | "fail" | "warn" | "skip" | "pending";

interface PipelineStep {
  step: number;
  id: string;
  label: string;
  status: StepStatus;
  reason?: string;
  data?: Record<string, unknown>;
}

interface PipelineSummary {
  import_status: string;
  profile_status: string;
  section_width_mm: number;
  section_height_mm: number;
  sheet_thickness_mm: number;
  material: string;
  bend_count: number;
  total_length_mm: number;
  strip_width_mm: number;
  flower_pattern_generated: boolean;
  estimated_stations: number;
  shaft_diameter_mm: number;
  bearing_type: string;
  motor_kw: number;
  forming_force_max_kn: number;
  profile_complexity: string;
  section_type: string;
  notes: string[];
  accuracy_score: number;
}

interface PipelineResult {
  pipeline_status: "pass" | "fail" | "partial";
  steps: PipelineStep[];
  summary: PipelineSummary;
  errors: string[];
  warnings: string[];
  flower_stations?: unknown[];
}

interface PipelineDebugPanelProps {
  geometry: ProfileGeometry | null;
  thickness: number;
  material: string;
  sectionModel?: "open" | "closed";
  onFlowerStationsReady?: (stations: unknown[]) => void;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  import:        <FileText className="w-3.5 h-3.5" />,
  profile:       <Layers className="w-3.5 h-3.5" />,
  thickness:     <Ruler className="w-3.5 h-3.5" />,
  material:      <FlaskConical className="w-3.5 h-3.5" />,
  "strip-width": <Ruler className="w-3.5 h-3.5" />,
  "station-count": <Layers className="w-3.5 h-3.5" />,
  flower:        <Flower className="w-3.5 h-3.5" />,
  "shaft-bearing": <Settings2 className="w-3.5 h-3.5" />,
  motor:         <Zap className="w-3.5 h-3.5" />,
  report:        <ClipboardList className="w-3.5 h-3.5" />,
};

const STATUS_COLORS: Record<string, string> = {
  pass:    "text-emerald-400",
  fail:    "text-red-400",
  warn:    "text-amber-400",
  skip:    "text-gray-500",
  pending: "text-gray-600",
};

const STATUS_BG: Record<string, string> = {
  pass:    "bg-emerald-500/10 border-emerald-500/20",
  fail:    "bg-red-500/10 border-red-500/20",
  warn:    "bg-amber-500/10 border-amber-500/20",
  skip:    "bg-gray-800/30 border-gray-700/20",
  pending: "bg-gray-900/30 border-gray-800/20",
};

function StatusIcon({ status }: { status: StepStatus }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  switch (status) {
    case "pass": return <CheckCircle2 className={`${cls} text-emerald-400`} />;
    case "fail": return <XCircle className={`${cls} text-red-400`} />;
    case "warn": return <AlertTriangle className={`${cls} text-amber-400`} />;
    case "skip": return <SkipForward className={`${cls} text-gray-500`} />;
    default:     return <div className={`${cls} rounded-full border border-gray-700`} />;
  }
}

function AccuracyBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : score >= 50 ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-red-400 border-red-500/30 bg-red-500/10";
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${color}`}>
      {score}/100
    </span>
  );
}

function PipelineStatusBadge({ status }: { status: "pass" | "fail" | "partial" }) {
  if (status === "pass") return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">PASS</span>;
  if (status === "fail") return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 border border-red-500/30 text-red-400">FAIL</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">PARTIAL</span>;
}

function StepRow({ step }: { step: PipelineStep }) {
  const [open, setOpen] = useState(false);
  const hasDetail = !!(step.reason || (step.data && Object.keys(step.data).length > 0));

  return (
    <div className={`rounded border px-2.5 py-1.5 text-[11px] ${STATUS_BG[step.status] ?? STATUS_BG.pending}`}>
      <button
        className="w-full flex items-center gap-2 text-left"
        onClick={() => hasDetail && setOpen(o => !o)}
        disabled={!hasDetail}
      >
        <span className="text-gray-600 w-4 shrink-0 text-right">{step.step}.</span>
        <span className="text-gray-400">{STEP_ICONS[step.id] ?? <div className="w-3.5 h-3.5" />}</span>
        <span className={`flex-1 font-medium ${STATUS_COLORS[step.status]}`}>{step.label}</span>
        <StatusIcon status={step.status} />
        {hasDetail && (
          open
            ? <ChevronDown className="w-3 h-3 text-gray-600" />
            : <ChevronRight className="w-3 h-3 text-gray-600" />
        )}
      </button>

      {open && hasDetail && (
        <div className="mt-1.5 ml-9 space-y-1">
          {step.reason && (
            <p className="text-gray-400 leading-tight">{step.reason}</p>
          )}
          {step.data && Object.keys(step.data).length > 0 && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {Object.entries(step.data).map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <span className="text-gray-600 shrink-0">{k.replace(/_/g, " ")}:</span>
                  <span className="text-gray-300 font-mono truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineDebugPanel({
  geometry,
  thickness,
  material,
  sectionModel = "open",
  onFlowerStationsReady,
}: PipelineDebugPanelProps) {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!geometry) {
      setError("No geometry loaded. Import a DXF/DWG file or draw a profile first.");
      return;
    }
    if (!thickness || thickness <= 0) {
      setError("Sheet thickness must be greater than 0.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await runAutoPipeline({ geometry, thickness, material, sectionModel });
      setResult(data);
      if (data.flower_stations?.length && onFlowerStationsReady) {
        onFlowerStationsReady(data.flower_stations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setLoading(false);
    }
  };

  const summary = result?.summary;

  return (
    <div className="flex flex-col gap-3 text-[11px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-violet-400" />
          <span className="font-semibold text-gray-300 text-[12px]">Auto Pipeline Debug</span>
        </div>
        {result && <PipelineStatusBadge status={result.pipeline_status} />}
      </div>

      <button
        onClick={run}
        disabled={loading || !geometry}
        className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-[11px] font-medium transition-colors"
      >
        {loading
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Running Pipeline…</>
          : result
            ? <><RefreshCw className="w-3.5 h-3.5" />Re-run Pipeline</>
            : <><Play className="w-3.5 h-3.5" />Run Full Pipeline</>
        }
      </button>

      {error && (
        <div className="flex gap-2 items-start p-2 rounded border border-red-500/25 bg-red-500/8 text-red-300">
          <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <>
          {/* Step-by-step debug log */}
          <div className="space-y-1">
            {result.steps.map(step => <StepRow key={step.id} step={step} />)}
          </div>

          {/* Summary card */}
          {summary && (
            <div className="rounded border border-gray-700/50 bg-gray-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-300">Engineering Summary</span>
                <AccuracyBadge score={summary.accuracy_score} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px]">
                <div className="flex justify-between"><span className="text-gray-500">Width</span><span className="text-gray-300 font-mono">{summary.section_width_mm}mm</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Height</span><span className="text-gray-300 font-mono">{summary.section_height_mm}mm</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Thickness</span><span className="text-gray-300 font-mono">{summary.sheet_thickness_mm}mm</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Material</span><span className="text-gray-300 font-mono">{summary.material}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Bends</span><span className="text-gray-300 font-mono">{summary.bend_count}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Strip Width</span><span className="text-gray-300 font-mono">{summary.strip_width_mm}mm</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Stations</span><span className="text-gray-300 font-mono">{summary.estimated_stations}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Shaft Dia.</span><span className="text-gray-300 font-mono">{summary.shaft_diameter_mm}mm</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Bearing</span><span className="text-gray-300 font-mono">{summary.bearing_type}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Max Force</span><span className="text-gray-300 font-mono">{summary.forming_force_max_kn}kN</span></div>
              </div>
              <div className="pt-1 border-t border-gray-800 text-[10px] text-amber-400 font-medium">{summary.profile_complexity}</div>
              {summary.notes.length > 0 && (
                <ul className="space-y-0.5">
                  {summary.notes.map((n, i) => (
                    <li key={i} className="flex gap-1.5 text-[10px] text-gray-400">
                      <span className="text-violet-500 shrink-0">•</span>
                      {n}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-0.5">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex gap-1.5 text-[10px] text-amber-400/80">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />{w}
                </div>
              ))}
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="space-y-0.5">
              {result.errors.map((e, i) => (
                <div key={i} className="flex gap-1.5 text-[10px] text-red-400">
                  <XCircle className="w-3 h-3 shrink-0 mt-px" />{e}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
