import { AlertCircle, CheckCircle, Layers } from "lucide-react";

interface ConvertedProfile {
  chain_no: number;
  point_count: number;
  centerline: Array<{ x: number; y: number }>;
  outer_profile: Array<{ x: number; y: number }>;
  inner_profile: Array<{ x: number; y: number }>;
  sheet_profile: Array<{ x: number; y: number }>;
}

interface CenterlineConverterResult {
  status: string;
  thickness?: number;
  offset_each_side?: number;
  mode?: string;
  arc_segments?: number;
  chain_count?: number;
  converted_profiles?: ConvertedProfile[];
  confidence?: string;
  blocking?: boolean;
  warnings?: string[];
  assumptions?: string[];
  reason?: string;
}

interface Props {
  data: {
    status: string;
    centerline_converter_engine?: CenterlineConverterResult;
    reason?: string;
    failed_stage?: string;
    result?: { reason?: string };
  } | null;
}

type XY = { x: number; y: number };

function toSvgPoints(pts: XY[], flipY: number): string {
  return pts.map((p) => `${p.x},${flipY - p.y}`).join(" ");
}

function calcViewBox(profiles: XY[][]): string {
  const all = profiles.flat();
  if (all.length === 0) return "0 0 200 100";
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max((maxX - minX) * 0.08, 5);
  return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   "text-emerald-400",
  medium: "text-yellow-400",
  low:    "text-red-400",
};

export default function CenterlineConversionPreview({ data }: Props) {
  if (!data) {
    return (
      <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Centerline Conversion Preview</span>
        </div>
        <div className="text-xs text-neutral-500">
          Upload a centerline DXF and click "Preview Centerline Conversion" to see results.
        </div>
      </div>
    );
  }

  if (data.status === "fail") {
    const reason = data.result?.reason ?? data.reason ?? "Unknown error";
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-red-300">Centerline Conversion Failed</span>
        </div>
        <div className="text-xs text-red-400 font-mono">{reason}</div>
      </div>
    );
  }

  const conv = data.centerline_converter_engine;
  if (!conv || conv.status === "fail") {
    const reason = conv?.reason ?? "Conversion engine returned no data";
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-red-300">Conversion Engine Failed</span>
        </div>
        <div className="text-xs text-red-400 font-mono">{reason}</div>
      </div>
    );
  }

  const profiles = conv.converted_profiles ?? [];
  const first = profiles[0];
  const confidenceClass = CONFIDENCE_COLOR[conv.confidence ?? ""] ?? "text-neutral-400";

  const centerline   = first?.centerline    ?? [];
  const outerProfile = first?.outer_profile ?? [];
  const innerProfile = first?.inner_profile ?? [];
  const sheetProfile = first?.sheet_profile ?? [];

  const allPoints = [centerline, outerProfile, innerProfile, sheetProfile];
  const viewBox = calcViewBox(allPoints);

  // Compute flipY baseline for SVG (max y value to flip coordinate system)
  const allY = allPoints.flat().map((p) => p.y);
  const maxY = allY.length > 0 ? Math.max(...allY) : 0;
  const minY = allY.length > 0 ? Math.min(...allY) : 0;
  const flipY = maxY + minY;

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Centerline Conversion Preview</span>
          {conv.blocking && (
            <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 uppercase tracking-wide">
              Blocking
            </span>
          )}
        </div>
        <div className={`text-xs font-semibold flex items-center gap-1 ${confidenceClass}`}>
          <CheckCircle className="w-3.5 h-3.5" />
          {conv.confidence ?? "—"} confidence
        </div>
      </div>

      {/* SVG Preview */}
      <div className="rounded-lg bg-neutral-950 border border-neutral-700 p-3 overflow-auto">
        <svg
          viewBox={viewBox}
          className="w-full"
          style={{ height: "340px" }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Sheet profile fill */}
          {sheetProfile.length > 2 && (
            <polygon
              points={toSvgPoints(sheetProfile, flipY)}
              fill="rgba(100,200,255,0.06)"
              stroke="none"
            />
          )}

          {/* Sheet profile border */}
          {sheetProfile.length > 1 && (
            <polyline
              points={toSvgPoints(sheetProfile, flipY)}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1.4"
            />
          )}

          {/* Outer profile */}
          {outerProfile.length > 1 && (
            <polyline
              points={toSvgPoints(outerProfile, flipY)}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.1"
            />
          )}

          {/* Inner profile */}
          {innerProfile.length > 1 && (
            <polyline
              points={toSvgPoints(innerProfile, flipY)}
              fill="none"
              stroke="#34d399"
              strokeWidth="1.1"
            />
          )}

          {/* Centerline — red dashed */}
          {centerline.length > 1 && (
            <polyline
              points={toSvgPoints(centerline, flipY)}
              fill="none"
              stroke="#f87171"
              strokeDasharray="4 3"
              strokeWidth="1"
            />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {[
          { color: "bg-red-400",     label: "Centerline (dashed)" },
          { color: "bg-blue-400",    label: "Outer profile" },
          { color: "bg-emerald-400", label: "Inner profile" },
          { color: "bg-slate-200",   label: "Sheet profile" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-neutral-400">
            <div className={`w-3 h-0.5 rounded ${color}`} />
            {label}
          </div>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[
          { label: "Thickness",       val: conv.thickness != null ? `${conv.thickness} mm` : "—" },
          { label: "Offset/Side",     val: conv.offset_each_side != null ? `${conv.offset_each_side} mm` : "—" },
          { label: "Chains",          val: conv.chain_count ?? "—" },
          { label: "Arc Segments",    val: conv.arc_segments ?? "—" },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-lg bg-neutral-800 border border-neutral-700 p-2">
            <div className="text-neutral-500 text-[10px] uppercase tracking-wide mb-0.5">{label}</div>
            <div className="text-white font-mono font-semibold">{val}</div>
          </div>
        ))}
      </div>

      {/* Multiple chains note */}
      {profiles.length > 1 && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
          {profiles.length} chains detected — showing Chain 1 in preview. Remaining chains included in pipeline output.
        </div>
      )}

      {/* Warnings */}
      {conv.warnings && conv.warnings.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Warnings</div>
          {conv.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Assumptions */}
      {conv.assumptions && conv.assumptions.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[10px] text-neutral-500 uppercase tracking-wide">Assumptions</div>
          {conv.assumptions.map((a, i) => (
            <div key={i} className="text-[10px] text-neutral-500 italic">• {a}</div>
          ))}
        </div>
      )}
    </div>
  );
}
