import React, { useState, useCallback } from 'react';
import { Loader2, Cog, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { type ManualModePayload } from '@/services/pythonApi';

interface StationSvg {
  station_no: number;
  station_label: string;
  angle_deg: number;
  stage_type: string;
  groove_depth_mm: number;
  upper_roll_radius_mm: number | null;
  lower_roll_radius_mm: number | null;
  roll_width_mm: number | null;
  svg_string: string;
}

interface RollGrooveResult {
  status: string;
  engine: string;
  svg_string: string;
  station_svgs: StationSvg[];
  total_stations: number;
  shapely_used: boolean;
  reason?: string;
}

const STAGE_BADGE: Record<string, string> = {
  pre_bend:            'bg-blue-500/15 text-blue-300 border-blue-500/20',
  initial_bend:        'bg-indigo-500/15 text-indigo-300 border-indigo-500/20',
  progressive_forming: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  final_form:          'bg-amber-500/15 text-amber-300 border-amber-500/20',
  calibration:         'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
};

interface Props {
  payload: ManualModePayload | null;
}

export default function RollGrooveSvgPanel({ payload }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RollGrooveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const generate = useCallback(async () => {
    if (!payload) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/papi/api/roll-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      setResult(data);
      setActiveIdx(0);
      if (data.status !== 'pass') {
        setError(data.reason ?? 'Roll groove SVG generation failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [payload]);

  const stations = result?.station_svgs ?? [];
  const active = stations[activeIdx] ?? null;

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-[#0d1117] p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Cog className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">Roll Groove Detail</span>
          {result?.shapely_used && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 font-mono">
              shapely
            </span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={!payload || loading}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 text-cyan-300 text-xs font-medium px-3 py-1.5 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cog className="w-3.5 h-3.5" />}
          {loading ? 'Generating…' : 'Generate Roll SVGs'}
        </button>
      </div>

      {!payload && !result && (
        <div className="text-xs text-gray-500 italic">Run the pipeline first to generate roll groove diagrams.</div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {stations.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {stations.map((s, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                  i === activeIdx
                    ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-200'
                    : 'bg-gray-800/60 border-gray-700/40 text-gray-400 hover:border-cyan-500/30 hover:text-gray-200'
                }`}
              >
                {s.station_label.replace('Station ', 'S')}
              </button>
            ))}
          </div>

          {active && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div
                className="rounded-lg border border-gray-700/40 bg-[#0a0f1e] overflow-hidden"
                dangerouslySetInnerHTML={{ __html: active.svg_string }}
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-200">{active.station_label}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-mono ${STAGE_BADGE[active.stage_type] ?? 'bg-gray-700/30 text-gray-400 border-gray-600/30'}`}>
                    {active.stage_type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {[
                    ['Angle', `${active.angle_deg.toFixed(1)}°`],
                    ['Groove depth', `${active.groove_depth_mm.toFixed(2)} mm`],
                    ['Upper roll OD', active.upper_roll_radius_mm != null ? `Ø${(active.upper_roll_radius_mm * 2).toFixed(0)} mm` : '—'],
                    ['Upper roll r', active.upper_roll_radius_mm != null ? `${active.upper_roll_radius_mm.toFixed(1)} mm` : '—'],
                    ['Lower roll OD', active.lower_roll_radius_mm != null ? `Ø${(active.lower_roll_radius_mm * 2).toFixed(0)} mm` : '—'],
                    ['Lower roll r', active.lower_roll_radius_mm != null ? `${active.lower_roll_radius_mm.toFixed(1)} mm` : '—'],
                    ['Roll width', active.roll_width_mm != null ? `${active.roll_width_mm.toFixed(1)} mm` : '—'],
                  ].map(([label, value]) => (
                    <React.Fragment key={label}>
                      <span className="text-gray-500">{label}</span>
                      <span className="text-cyan-200 font-mono">{value}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                    disabled={activeIdx === 0}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" /> Prev
                  </button>
                  <span className="text-[10px] text-gray-600 font-mono">{activeIdx + 1} / {stations.length}</span>
                  <button
                    onClick={() => setActiveIdx(i => Math.min(stations.length - 1, i + 1))}
                    disabled={activeIdx === stations.length - 1}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
