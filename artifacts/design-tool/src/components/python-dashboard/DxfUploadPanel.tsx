import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Eye, Play, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

const PAPI = "/papi";

interface DxfPreviewResult {
  status: string;
  preview_available?: boolean;
  source_file?: string;
  file_size_bytes?: number;
  entity_summary?: {
    total_entities?: number;
    lines?: number;
    arcs?: number;
    polylines?: number;
  };
  geometry_engine?: {
    status?: string;
    entity_count?: number;
    bounding_box?: Record<string, number>;
    warnings?: string[];
  };
  profile_preview?: {
    status?: string;
    section_width_mm?: number;
    section_height_mm?: number;
    bend_count?: number;
    profile_type?: string;
    return_bends_count?: number;
    warnings?: string[];
  };
  ready_for_full_pipeline?: boolean;
  note?: string;
}

interface Props {
  onPipelineResult?: (result: Record<string, unknown>) => void;
}

const MATERIALS = ["GI", "CR", "HR", "SS", "AL", "MS"];

export default function DxfUploadPanel({ onPipelineResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thickness, setThickness] = useState("1.0");
  const [material, setMaterial] = useState("CR");

  const [previewResult, setPreviewResult] = useState<DxfPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreviewResult(null);
    setError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".dxf")) {
      setFile(f);
      setPreviewResult(null);
      setError(null);
    } else {
      setError("Only .dxf files are accepted");
    }
  }, []);

  const runPreview = async () => {
    if (!file) return;
    setPreviewLoading(true);
    setError(null);
    setPreviewResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${PAPI}/api/preview-dxf`, { method: "POST", body: form });
      const data: DxfPreviewResult = await res.json();
      setPreviewResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview request failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const runFullPipeline = async () => {
    if (!file) return;
    const thick = parseFloat(thickness);
    if (isNaN(thick) || thick <= 0) {
      setPipelineError("Thickness must be a positive number");
      return;
    }
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const url = `${PAPI}/api/auto-mode-dxf?thickness=${thick}&material=${encodeURIComponent(material)}`;
      const res = await fetch(url, { method: "POST", body: form });
      const data = await res.json();
      if (onPipelineResult) onPipelineResult(data);
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : "Pipeline request failed");
    } finally {
      setPipelineLoading(false);
    }
  };

  const bbox = previewResult?.geometry_engine?.bounding_box;
  const profile = previewResult?.profile_preview;
  const entities = previewResult?.entity_summary;

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-white">DXF Upload</span>
        <span className="text-[10px] text-neutral-500 uppercase tracking-wide ml-1">Auto Mode from DXF File</span>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${file ? "border-blue-600 bg-blue-900/10" : "border-neutral-600 hover:border-neutral-500 bg-neutral-800/40"}`}
        onClick={() => fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".dxf"
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <div className="flex flex-col items-center gap-1">
            <FileText className="w-8 h-8 text-blue-400" />
            <div className="text-white text-sm font-mono">{file.name}</div>
            <div className="text-neutral-500 text-xs">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-neutral-500">
            <Upload className="w-7 h-7" />
            <div className="text-sm">Drop a .dxf file here, or click to browse</div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 rounded p-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Preview button */}
      {file && (
        <button
          onClick={runPreview}
          disabled={previewLoading}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-sm transition-colors"
        >
          {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {previewLoading ? "Parsing DXF…" : "Preview DXF"}
        </button>
      )}

      {/* Preview result */}
      {previewResult && (
        <div className="rounded-lg bg-neutral-800 border border-neutral-700 p-3 space-y-3 text-xs">
          <div className="flex items-center gap-2">
            {previewResult.preview_available
              ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
            <span className={previewResult.preview_available ? "text-green-300" : "text-red-300"}>
              {previewResult.preview_available ? "DXF readable — ready for analysis" : "DXF could not be read"}
            </span>
          </div>

          {entities && (
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Total", val: entities.total_entities },
                { label: "Lines", val: entities.lines },
                { label: "Arcs", val: entities.arcs },
                { label: "Polylines", val: entities.polylines },
              ].map(({ label, val }) => (
                <div key={label} className="bg-neutral-700/50 rounded p-1.5">
                  <div className="font-mono font-bold text-white">{val ?? 0}</div>
                  <div className="text-neutral-500 text-[10px]">{label}</div>
                </div>
              ))}
            </div>
          )}

          {bbox && (
            <div>
              <div className="text-neutral-500 text-[10px] uppercase tracking-wide mb-1">Bounding Box</div>
              <div className="grid grid-cols-2 gap-x-4 font-mono text-[10px] text-neutral-300">
                <div>X: {(bbox.min_x ?? 0).toFixed(1)} → {(bbox.max_x ?? 0).toFixed(1)}</div>
                <div>Y: {(bbox.min_y ?? 0).toFixed(1)} → {(bbox.max_y ?? 0).toFixed(1)}</div>
              </div>
            </div>
          )}

          {profile && (
            <div>
              <div className="text-neutral-500 text-[10px] uppercase tracking-wide mb-1">Profile Detection</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                {[
                  ["Width", `${profile.section_width_mm ?? "?"} mm`],
                  ["Height", `${profile.section_height_mm ?? "?"} mm`],
                  ["Bends", profile.bend_count ?? "?"],
                  ["Type", (profile.profile_type ?? "—").replace(/_/g, " ")],
                ].map(([lbl, val]) => (
                  <div key={String(lbl)} className="flex justify-between">
                    <span className="text-neutral-500">{lbl}</span>
                    <span className="text-white font-mono">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewResult.geometry_engine?.warnings && previewResult.geometry_engine.warnings.length > 0 && (
            <div className="space-y-0.5">
              {previewResult.geometry_engine.warnings.map((w, i) => (
                <div key={i} className="text-yellow-400 text-[10px]">⚠ {w}</div>
              ))}
            </div>
          )}

          {previewResult.note && (
            <div className="text-neutral-500 text-[10px] italic">{previewResult.note}</div>
          )}
        </div>
      )}

      {/* Full pipeline inputs & run */}
      {file && previewResult?.ready_for_full_pipeline && (
        <div className="space-y-3 pt-1 border-t border-neutral-700">
          <div className="text-[10px] text-neutral-400 uppercase tracking-wide">Material Inputs for Full Analysis</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-400 text-xs mb-1">Thickness (mm)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-neutral-400 text-xs mb-1">Material</label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                {MATERIALS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {pipelineError && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 rounded p-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {pipelineError}
            </div>
          )}

          <button
            onClick={runFullPipeline}
            disabled={pipelineLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {pipelineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {pipelineLoading ? "Running Full Pipeline…" : "Run Full Engineering Analysis"}
          </button>
        </div>
      )}

      {/* If not ready */}
      {file && previewResult && !previewResult.ready_for_full_pipeline && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 rounded p-2 border border-yellow-700/30">
          DXF profile analysis incomplete — verify the DXF contains usable LINE/ARC/POLYLINE geometry and try again.
        </div>
      )}
    </div>
  );
}
