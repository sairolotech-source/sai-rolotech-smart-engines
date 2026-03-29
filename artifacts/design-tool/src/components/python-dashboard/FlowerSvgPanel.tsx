import React, { useState, useCallback } from 'react';
import { Loader2, Flower2, AlertTriangle } from 'lucide-react';

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

interface Props {
  profileResult: Record<string, unknown> | null;
  inputResult: Record<string, unknown> | null;
  rollContourResult: Record<string, unknown> | null;
  stationResult: Record<string, unknown> | null;
}

export default function FlowerSvgPanel({
  profileResult,
  inputResult,
  rollContourResult,
  stationResult,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlowerSvgResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = !!(profileResult && inputResult && rollContourResult);

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/papi/api/flower-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_result: profileResult,
          input_result: inputResult,
          roll_contour_result: rollContourResult,
          station_result: stationResult ?? {},
        }),
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
  }, [canGenerate, profileResult, inputResult, rollContourResult, stationResult]);

  return (
    <div className="rounded-xl border border-violet-500/20 bg-[#0d1117] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flower2 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-gray-200">Flower Pattern</span>
          {result?.shapely_used && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20 font-mono">
              shapely
            </span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={!canGenerate || loading}
          className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 text-violet-300 text-xs font-medium px-3 py-1.5 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flower2 className="w-3.5 h-3.5" />}
          {loading ? 'Generating…' : 'Generate Flower SVG'}
        </button>
      </div>

      {!canGenerate && !result && (
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
          <div
            className="w-full overflow-x-auto rounded-lg border border-gray-700/40 bg-[#0a0f1e]"
            dangerouslySetInnerHTML={{ __html: result.svg_string }}
          />
        </>
      )}
    </div>
  );
}
