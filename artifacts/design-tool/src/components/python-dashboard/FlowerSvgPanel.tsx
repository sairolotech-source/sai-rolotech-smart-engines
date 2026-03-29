import React, { useState, useCallback } from 'react';
import { Loader2, Flower2, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
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

interface Props {
  payload: ManualModePayload | null;
}

export default function FlowerSvgPanel({ payload }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FlowerSvgResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

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

  return (
    <div className="rounded-xl border border-violet-500/20 bg-[#0d1117] p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Flower2 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-gray-200">Flower Pattern</span>
          {result?.shapely_used && (
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

      {!payload && !result && (
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
