import React, { useState } from 'react';

interface ContourPoint { x: number; y: number; }
interface PassData {
  pass_no: number;
  station_label: string;
  target_angle_deg: number;
  roll_gap_mm: number;
  strip_width_mm: number;
  stage_type: string;
  forming_depth_mm: number;
  pass_progress_pct: number;
  upper_roll_profile: ContourPoint[];
  lower_roll_profile: ContourPoint[];
}

interface RollContourResult {
  status: string;
  material: string;
  thickness_mm: number;
  springback_deg: number;
  roll_gap_mm: number;
  bend_radius_mm: number;
  target_angle_deg: number;
  formed_to_deg: number;
  passes: PassData[];
  calibration_pass: PassData;
  forming_summary: Record<string, any>;
}

interface Props { data: RollContourResult | null; }

const STAGE_COLOR: Record<string, string> = {
  pre_bend:           '#3b82f6',
  initial_bend:       '#6366f1',
  progressive_forming:'#8b5cf6',
  lip_forming:        '#ec4899',
  final_form:         '#f59e0b',
  calibration:        '#10b981',
};

function MiniContourSvg({ upper, lower }: { upper: ContourPoint[]; lower: ContourPoint[] }) {
  if (!upper.length) return null;
  const xs = [...upper, ...lower].map(p => p.x);
  const ys = [...upper, ...lower].map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 120, H = 60, pad = 6;
  const scaleX = (v: number) => pad + ((v - minX) / (maxX - minX || 1)) * (W - pad * 2);
  const scaleY = (v: number) => H - pad - ((v - minY) / (maxY - minY || 1)) * (H - pad * 2);
  const toPath = (pts: ContourPoint[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} className="border border-slate-700 rounded bg-slate-900">
      <path d={toPath(upper)} stroke="#60a5fa" strokeWidth="1.5" fill="none" />
      <path d={toPath(lower)} stroke="#34d399" strokeWidth="1.5" fill="none" strokeDasharray="3,2" />
    </svg>
  );
}

export default function RollContourPanel({ data }: Props) {
  const [selectedPass, setSelectedPass] = useState<number>(0);

  if (!data || data.status !== 'pass') {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-2">Roll Contour Engine</h3>
        <p className="text-slate-400 text-sm">No roll contour data. Run the pipeline to generate forming passes.</p>
      </div>
    );
  }

  const allPasses = [...data.passes, data.calibration_pass];
  const current = allPasses[selectedPass] ?? allPasses[0];
  const s = data.forming_summary;

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Roll Contour Engine</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {data.material} · {data.thickness_mm} mm · {allPasses.length} stations
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg text-center">
            <div className="text-xs text-slate-400">Springback</div>
            <div className="text-yellow-400 font-bold text-sm">+{data.springback_deg}°</div>
          </div>
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg text-center">
            <div className="text-xs text-slate-400">Roll Gap</div>
            <div className="text-blue-400 font-bold text-sm">{data.roll_gap_mm} mm</div>
          </div>
          <div className="bg-slate-900 px-3 py-1.5 rounded-lg text-center">
            <div className="text-xs text-slate-400">Bend R</div>
            <div className="text-purple-400 font-bold text-sm">{data.bend_radius_mm} mm</div>
          </div>
        </div>
      </div>

      {/* Springback note */}
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-2 text-xs text-amber-300">
        Forms to <strong>{data.formed_to_deg}°</strong> to compensate springback — springs back to required <strong>{data.target_angle_deg}°</strong>
      </div>

      {/* Pass selector row */}
      <div className="flex flex-wrap gap-2">
        {allPasses.map((p, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedPass(idx)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all border ${
              idx === selectedPass
                ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
            }`}
            style={{ borderLeftColor: STAGE_COLOR[p.stage_type] || '#64748b', borderLeftWidth: 3 }}
          >
            S{p.pass_no} · {p.target_angle_deg}°
          </button>
        ))}
      </div>

      {/* Selected pass detail */}
      {current && (
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-white font-semibold">{current.station_label}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Stage: <span className="font-medium" style={{ color: STAGE_COLOR[current.stage_type] || '#94a3b8' }}>
                  {current.stage_type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <MiniContourSvg upper={current.upper_roll_profile} lower={current.lower_roll_profile} />
          </div>
          <div className="grid grid-cols-4 gap-3 mt-2">
            {[
              { label: 'Target Angle',   value: `${current.target_angle_deg}°`,    color: 'text-blue-300' },
              { label: 'Roll Gap',       value: `${current.roll_gap_mm} mm`,        color: 'text-green-300' },
              { label: 'Strip Width',    value: `${current.strip_width_mm} mm`,     color: 'text-purple-300' },
              { label: 'Form Depth',     value: `${current.forming_depth_mm} mm`,   color: 'text-yellow-300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800 rounded-lg p-2 text-center">
                <div className="text-xs text-slate-400">{label}</div>
                <div className={`font-bold text-sm ${color}`}>{value}</div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Forming progress</span><span>{current.pass_progress_pct}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-purple-500 transition-all"
                style={{ width: `${current.pass_progress_pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Flat strip → final summary */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        {[
          { label: 'Flat Strip Width', value: `${s.flat_strip_width_mm} mm` },
          { label: 'Final Width',      value: `${s.final_section_width_mm} mm` },
          { label: 'Total Stations',   value: s.total_forming_stations },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-900 rounded-lg p-2.5 border border-slate-700">
            <div className="text-slate-400">{label}</div>
            <div className="text-white font-semibold mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      {/* Pass table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              {['Stn', 'Stage', 'Angle°', 'Gap mm', 'Strip mm', 'Depth mm'].map(h => (
                <th key={h} className="text-left text-slate-400 py-1.5 pr-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPasses.map((p, idx) => (
              <tr key={idx}
                onClick={() => setSelectedPass(idx)}
                className={`border-b border-slate-800 cursor-pointer transition-colors ${idx === selectedPass ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}
              >
                <td className="py-1.5 pr-3 text-slate-300 font-medium">S{p.pass_no}</td>
                <td className="py-1.5 pr-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: (STAGE_COLOR[p.stage_type] || '#475569') + '33', color: STAGE_COLOR[p.stage_type] || '#94a3b8' }}>
                    {p.stage_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-blue-300 font-mono">{p.target_angle_deg}°</td>
                <td className="py-1.5 pr-3 text-green-300 font-mono">{p.roll_gap_mm}</td>
                <td className="py-1.5 pr-3 text-purple-300 font-mono">{p.strip_width_mm}</td>
                <td className="py-1.5 pr-3 text-yellow-300 font-mono">{p.forming_depth_mm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
