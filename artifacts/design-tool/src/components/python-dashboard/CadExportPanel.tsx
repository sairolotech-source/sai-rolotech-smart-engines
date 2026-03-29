import React, { useState } from 'react';

interface FileManifestEntry {
  type: string;
  filename: string;
  path: string;
  purpose: string;
}

interface CadExportResult {
  status: string;
  session_id: string;
  total_files: number;
  file_manifest: FileManifestEntry[];
  errors: string[];
  summary: {
    dxf_files: number;
    step_files: number;
    roll_count: number;
    shaft_dia_mm: number;
    stand_count: number;
  };
}

interface RollSpec {
  roll_label: string;
  station_no: number;
  stage_type: string;
  od_mm: number;
  bore_mm: number;
  face_width_mm: number;
  profile_depth_mm: number;
  hardness_hrc: number;
  roll_material: string;
  operations?: any[];
}

interface CamPrepResult {
  status: string;
  roll_material: string;
  hardness_hrc: number;
  shaft_dia_mm: number;
  roll_od_mm: number;
  total_rolls: number;
  rolls: RollSpec[];
  keyway: Record<string, any>;
  general_notes: string[];
  solidcam_bridge: Record<string, any>;
}

interface Props {
  cadExport: CadExportResult | null;
  camPrep: CamPrepResult | null;
  isLoading?: boolean;
  onRequestExport?: () => void;
}

const FILE_ICON: Record<string, string> = {
  DXF:  '📐',
  STEP: '🔩',
  PDF:  '📄',
};

const OP_COLORS: Record<number, string> = {
  10: 'bg-blue-500/20 text-blue-300',
  20: 'bg-indigo-500/20 text-indigo-300',
  30: 'bg-violet-500/20 text-violet-300',
  40: 'bg-purple-500/20 text-purple-300',
  50: 'bg-pink-500/20 text-pink-300',
  60: 'bg-orange-500/20 text-orange-300',
  70: 'bg-green-500/20 text-green-300',
  80: 'bg-emerald-500/20 text-emerald-300',
};

export default function CadExportPanel({ cadExport, camPrep, isLoading, onRequestExport }: Props) {
  const [activeTab, setActiveTab] = useState<'files' | 'cam' | 'solidcam'>('files');
  const [selectedRoll, setSelectedRoll] = useState<number>(0);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const handleDownload = async (entry: FileManifestEntry) => {
    setDownloadingFile(entry.filename);
    try {
      const resp = await fetch(`/papi/api/download-file?path=${encodeURIComponent(entry.path)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Download failed: ${e}`);
    } finally {
      setDownloadingFile(null);
    }
  };

  const tabs = [
    { id: 'files',    label: '📁 Files' },
    { id: 'cam',      label: '🔧 CAM Prep' },
    { id: 'solidcam', label: '🏭 SolidCAM' },
  ] as const;

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">CAD/CAM Export Pack</h3>
          <p className="text-slate-400 text-xs mt-0.5">DXF drawings · STEP files · SolidCAM bridge</p>
        </div>
        {onRequestExport && (
          <button
            onClick={onRequestExport}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {isLoading ? '⏳ Generating…' : '⚙️ Generate Pack'}
          </button>
        )}
      </div>

      {/* Summary bar */}
      {cadExport && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'DXF Files',    value: cadExport.summary.dxf_files,   color: 'text-blue-400' },
            { label: 'STEP Files',   value: cadExport.summary.step_files,  color: 'text-purple-400' },
            { label: 'Roll Count',   value: cadExport.summary.roll_count,  color: 'text-yellow-400' },
            { label: 'Shaft Ø',      value: `${cadExport.summary.shaft_dia_mm} mm`, color: 'text-green-400' },
            { label: 'Stands',       value: cadExport.summary.stand_count, color: 'text-cyan-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-900 rounded-lg p-2 text-center">
              <div className="text-xs text-slate-400">{label}</div>
              <div className={`font-bold text-sm ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── FILES TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'files' && (
        <div className="space-y-2">
          {!cadExport && !isLoading && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <div className="text-3xl mb-2">📦</div>
              Click <strong>Generate Pack</strong> to create DXF drawings and STEP files.
            </div>
          )}
          {isLoading && (
            <div className="text-center py-8 text-slate-400 text-sm">
              <div className="animate-spin text-3xl mb-2">⚙️</div>
              Generating CAD files…
            </div>
          )}
          {cadExport?.file_manifest.map((entry, idx) => (
            <div key={idx} className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-3 border border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{FILE_ICON[entry.type] || '📄'}</span>
                <div>
                  <div className="text-white text-sm font-medium">{entry.filename}</div>
                  <div className="text-slate-400 text-xs">{entry.purpose} · {entry.type}</div>
                </div>
              </div>
              <button
                onClick={() => handleDownload(entry)}
                disabled={downloadingFile === entry.filename}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                {downloadingFile === entry.filename ? '⏳' : '⬇ Download'}
              </button>
            </div>
          ))}
          {cadExport?.errors && cadExport.errors.length > 0 && (
            <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-xs text-red-300">
              <div className="font-semibold mb-1">⚠ Partial errors:</div>
              {cadExport.errors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ── CAM PREP TAB ──────────────────────────────────────────────── */}
      {activeTab === 'cam' && camPrep && (
        <div className="space-y-4">
          {/* Roll selector */}
          <div className="flex flex-wrap gap-2">
            {camPrep.rolls.map((r, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedRoll(idx)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                  idx === selectedRoll
                    ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                    : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                S{r.station_no}
              </button>
            ))}
          </div>

          {/* Roll detail */}
          {camPrep.rolls[selectedRoll] && (() => {
            const roll = camPrep.rolls[selectedRoll];
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {[
                    { label: 'Roll OD', value: `${roll.od_mm} mm` },
                    { label: 'Bore',    value: `${roll.bore_mm} mm` },
                    { label: 'Face W',  value: `${roll.face_width_mm} mm` },
                    { label: 'Hardness', value: `HRC ${roll.hardness_hrc}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-900 rounded-lg p-2 text-center border border-slate-700">
                      <div className="text-slate-400">{label}</div>
                      <div className="text-white font-semibold mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="text-xs font-semibold text-slate-300 mt-2">Machining Operations — {roll.roll_label}</div>
                <div className="space-y-2">
                  {(roll.operations || []).map((op: any) => (
                    <div key={op.op_no} className={`rounded-lg p-3 text-xs ${OP_COLORS[op.op_no] || 'bg-slate-900 text-slate-300'}`}>
                      <div className="flex justify-between items-center">
                        <div className="font-semibold">{op.op_no} — {op.operation}</div>
                        {op.rpm && <div className="text-slate-300">{op.rpm} RPM</div>}
                      </div>
                      <div className="mt-1 text-slate-300 opacity-80">{op.note}</div>
                      {op.feed_mm_rev && (
                        <div className="mt-1 flex gap-4">
                          <span>Feed: {op.feed_mm_rev} mm/rev</span>
                          {op.doc_mm && <span>DOC: {op.doc_mm} mm</span>}
                          {op.cutting_speed_mpm && <span>Speed: {op.cutting_speed_mpm} m/min</span>}
                        </div>
                      )}
                      <div className="mt-1 opacity-70">Tool: {op.tool}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Keyway */}
          {camPrep.keyway && (
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
              <div className="text-xs font-semibold text-slate-300 mb-2">Keyway Spec — {camPrep.keyway.standard}</div>
              <div className="flex gap-4 text-xs text-slate-300">
                <span>b = {camPrep.keyway.b} mm</span>
                <span>h = {camPrep.keyway.h} mm</span>
                <span>t1 = {camPrep.keyway.t1} mm</span>
                <span>t2 = {camPrep.keyway.t2} mm</span>
              </div>
            </div>
          )}

          {/* General notes */}
          <div className="text-xs space-y-1">
            <div className="text-slate-400 font-semibold mb-1">General Notes:</div>
            {camPrep.general_notes.map((n, i) => (
              <div key={i} className="text-slate-300">• {n}</div>
            ))}
          </div>
        </div>
      )}

      {/* ── SOLIDCAM TAB ──────────────────────────────────────────────── */}
      {activeTab === 'solidcam' && camPrep?.solidcam_bridge && (() => {
        const sc = camPrep.solidcam_bridge;
        return (
          <div className="space-y-4 text-xs">
            <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-lg p-4">
              <div className="text-indigo-300 font-semibold text-sm mb-2">🏭 SolidCAM / SolidWorks Workflow</div>
              <div className="text-slate-300">{sc.cam_software}</div>
              <div className="text-slate-400 mt-1">{sc.material_handoff}</div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Stock OD',     value: `${sc.stock_od_mm} mm` },
                { label: 'Stock Bore',   value: `${sc.stock_bore_mm} mm` },
                { label: 'Stock Length', value: `${sc.stock_length_mm} mm` },
                { label: 'Tolerance',   value: `±${sc.finish_tolerance_mm} mm` },
                { label: 'Surface Ra',  value: `${sc.surface_finish_ra} μm` },
                { label: 'Strategy',    value: sc.toolpath_strategy.split('.')[0] },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-900 rounded-lg p-2 border border-slate-700">
                  <div className="text-slate-400">{label}</div>
                  <div className="text-white font-semibold mt-0.5">{value}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-slate-400 font-semibold mb-2">Operations Sequence:</div>
              <div className="space-y-1">
                {sc.operations_sequence.map((op: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-slate-600 text-[10px] flex items-center justify-center text-slate-200 flex-shrink-0">
                      {i + 1}
                    </span>
                    {op}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-3 text-green-300">
              <div className="font-semibold mb-1">✅ Toolpath Strategy</div>
              <div>{sc.toolpath_strategy}</div>
            </div>
          </div>
        );
      })()}

      {activeTab !== 'files' && !camPrep && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Run the pipeline to generate CAM prep data.
        </div>
      )}
    </div>
  );
}
