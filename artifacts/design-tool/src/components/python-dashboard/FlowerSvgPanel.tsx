import React, { useState, useCallback } from 'react';
import { Loader2, Flower2, AlertTriangle, ZoomIn, ZoomOut, CheckCircle2 } from 'lucide-react';
import { type ManualModePayload } from '@/services/pythonApi';

interface FlowerSvgResult {
  status: string;
  svg_string: string;
  station_count: number;
  flat_strip_mm: number;
  final_width_mm: number;
  profile_type: string;
  shapely_used: boolean;
  reason?: string;
}

interface StationPolygon {
  pass_no: number;
  angle_deg: number;
  stage_type: string;
  polygon_area_mm2: number;
  point_count: number;
  has_self_intersection: boolean;
}

interface ProfileDimensions {
  web_mm?: number;
  flange_mm?: number;
  thickness_mm?: number;
  inner_radius_mm?: number;
  flat_strip_mm?: number;
  bend_allowance_mm?: number;
  unit?: string;
}

interface FlowerValidation {
  monotonic_angles?: boolean;
  any_self_intersection?: boolean;
  area_variation_pct?: number;
  thickness_consistent?: boolean;
  forming_angles?: number[];
}

interface PipelineFlowerData {
  status?: string;
  station_polygons?: StationPolygon[];
  profile_dimensions?: ProfileDimensions;
  validation?: FlowerValidation;
  station_count?: number;
}

interface Props {
  payload: ManualModePayload | null;
  pipelineData?: PipelineFlowerData | null;
}

const GRADE_BADGE = (
  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-mono">
    manufacturing-grade
  </span>
);

export default function FlowerSvgPanel({ payload, pipelineData }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlowerSvgResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showValidation, setShowValidation] = useState(false);

  const generate = useCallback(async () => {
    if (!payload) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/papi/api/flower-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      setResult(data);
      if (data.status !== 'pass') {
        setError(data.reason ?? 'Flower SVG generation failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [payload]);

  const pd = pipelineData?.profile_dimensions;
  const val = pipelineData?.validation;
  const polys = pipelineData?.station_polygons ?? [];
  const hasPipelineData = pipelineData?.status === 'pass' && polys.length > 0;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-[#0d1117] p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Flower2 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-gray-200">Flower Pattern</span>
          {hasPipelineData && GRADE_BADGE}
          {result?.shapely_used && !hasPipelineData && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20 font-mono">
              shapely
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {result?.svg_string && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 rounded text-gray-400 hover:text-gray-200 transition-colors" title="Zoom out">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-gray-500 font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 rounded text-gray-400 hover:text-gray-200 transition-colors" title="Zoom in">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={generate}
            disabled={!payload || loading}
            className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 text-violet-300 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flower2 className="w-3.5 h-3.5" />}
            {loading ? 'Generating…' : 'Generate Flower SVG'}
          </button>
        </div>
      </div>

      {/* ── Manufacturing-Grade Profile Dimensions (from pipeline) ── */}
      {hasPipelineData && pd && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-900/10 px-3 py-2 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold uppercase tracking-wide">
            <CheckCircle2 className="w-3 h-3" />
            Auto-Dimensioned Profile
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px] font-mono">
            <span className="text-gray-500">Web</span>
            <span className="text-yellow-300">{pd.web_mm} mm</span>
            <span className="text-gray-500">Flange</span>
            <span className="text-yellow-300">{pd.flange_mm} mm</span>
            <span className="text-gray-500">Thickness</span>
            <span className="text-blue-300">{pd.thickness_mm} mm</span>
            <span className="text-gray-500">Inner r</span>
            <span className="text-blue-300">{pd.inner_radius_mm} mm</span>
            <span className="text-gray-500">Flat strip</span>
            <span className="text-emerald-300 font-bold">{pd.flat_strip_mm} mm</span>
            <span className="text-gray-500">Bend allow.</span>
            <span className="text-emerald-300">{pd.bend_allowance_mm} mm</span>
          </div>
        </div>
      )}

      {/* ── Validation summary ── */}
      {hasPipelineData && val && (
        <div>
          <button
            onClick={() => setShowValidation(v => !v)}
            className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
          >
            <span>{showValidation ? '▾' : '▸'}</span>
            <span>Shapely Validation</span>
            <span className={`ml-1 px-1.5 py-0.5 rounded font-mono ${
              val.any_self_intersection ? 'bg-red-700/30 text-red-300' : 'bg-emerald-700/30 text-emerald-300'
            }`}>
              {val.any_self_intersection ? '⚠ issue' : '✓ pass'}
            </span>
          </button>
          {showValidation && (
            <div className="mt-2 rounded-lg border border-gray-700/40 bg-[#0a0f1e] px-3 py-2 space-y-1.5">
              <Row label="Stations" val={`${polys.length}`} ok />
              <Row label="Monotonic angles" val={val.monotonic_angles ? 'Yes' : 'No'} ok={!!val.monotonic_angles} />
              <Row label="Self-intersection" val={val.any_self_intersection ? 'DETECTED' : 'None'} ok={!val.any_self_intersection} />
              <Row label="Area variation" val={`${val.area_variation_pct?.toFixed(1)}%`} ok={(val.area_variation_pct ?? 99) < 5} />
              <Row label="Thickness consistent" val={val.thickness_consistent ? 'Yes' : 'No'} ok={!!val.thickness_consistent} />
              {val.forming_angles && (
                <div className="text-[9px] text-gray-500 font-mono pt-1">
                  Angles: [{val.forming_angles.join(', ')}]°
                </div>
              )}
              {/* Per-station polygon table */}
              <div className="mt-2 overflow-x-auto">
                <table className="text-[9px] font-mono w-full">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700/40">
                      <th className="text-left pb-1 pr-2">Pass</th>
                      <th className="text-left pb-1 pr-2">Stage</th>
                      <th className="text-right pb-1 pr-2">Angle</th>
                      <th className="text-right pb-1 pr-2">Area mm²</th>
                      <th className="text-right pb-1">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polys.map(p => (
                      <tr key={p.pass_no} className={`border-b border-gray-800/30 ${p.has_self_intersection ? 'text-red-300' : 'text-gray-300'}`}>
                        <td className="py-0.5 pr-2">{p.pass_no}</td>
                        <td className="py-0.5 pr-2 text-gray-500">{p.stage_type.replace(/_/g, ' ')}</td>
                        <td className="py-0.5 pr-2 text-right text-violet-300">{p.angle_deg}°</td>
                        <td className="py-0.5 pr-2 text-right">{p.polygon_area_mm2}</td>
                        <td className="py-0.5 text-right">{p.point_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!payload && !result && !hasPipelineData && (
        <div className="text-xs text-gray-500 italic">Run the pipeline first to generate the flower pattern.</div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result?.status === 'pass' && result.svg_string && (
        <>
          <div className="flex flex-wrap gap-4 text-[10px] font-mono text-gray-400">
            <span>Profile: <span className="text-violet-300">{result.profile_type}</span></span>
            <span>Stations: <span className="text-emerald-300">{result.station_count}</span></span>
            <span>Flat strip: <span className="text-yellow-300">{result.flat_strip_mm} mm</span></span>
            <span>Final width: <span className="text-blue-300">{result.final_width_mm} mm</span></span>
          </div>
          <div className="w-full overflow-auto rounded-lg border border-gray-700/40 bg-[#0a0f1e]">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', transition: 'transform 0.15s' }}
              dangerouslySetInnerHTML={{ __html: result.svg_string }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, val, ok }: { label: string; val: string; ok: boolean }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-gray-500">{label}</span>
      <span className={ok ? 'text-emerald-300' : 'text-red-300'}>{val}</span>
    </div>
  );
}
