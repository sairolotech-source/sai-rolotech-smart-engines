import React, { useState, useEffect, useCallback } from "react";
import { useCncStore, type DxfDimension } from "../../store/useCncStore";
import {
  Ruler, CheckCircle2, XCircle, AlertTriangle, Edit3, Save, RefreshCw, Info,
} from "lucide-react";

type ConfirmedDim = DxfDimension & { confirmed: boolean; override?: number; id: string };

const DIM_TYPE_LABEL: Record<DxfDimension["type"], string> = {
  linear: "Linear",
  aligned: "Aligned",
  angular: "Angular",
  radial: "Radius",
  diameter: "Diameter",
  ordinate: "Ordinate",
};

const DIM_UNIT: Record<DxfDimension["type"], string> = {
  linear: "mm",
  aligned: "mm",
  angular: "°",
  radial: "mm",
  diameter: "mm",
  ordinate: "mm",
};

function buildFromGeometry(geometry: ReturnType<typeof useCncStore.getState>["geometry"]): DxfDimension[] {
  if (!geometry) return [];
  const dims = geometry.dimensions;
  if (dims && dims.length > 0) return dims;

  // Synthesize dimension entries from geometry bounding box + bend points
  const synthetic: DxfDimension[] = [];
  const bb = geometry.boundingBox;

  synthetic.push({
    type: "linear",
    value: Math.abs(bb.maxX - bb.minX),
    text: `W=${Math.abs(bb.maxX - bb.minX).toFixed(2)}`,
    defPoint1: { x: bb.minX, y: bb.minY },
    defPoint2: { x: bb.maxX, y: bb.minY },
    textPosition: { x: (bb.minX + bb.maxX) / 2, y: bb.minY - 5 },
    layer: "0",
    rotation: 0,
  });

  synthetic.push({
    type: "linear",
    value: Math.abs(bb.maxY - bb.minY),
    text: `H=${Math.abs(bb.maxY - bb.minY).toFixed(2)}`,
    defPoint1: { x: bb.minX, y: bb.minY },
    defPoint2: { x: bb.minX, y: bb.maxY },
    textPosition: { x: bb.minX - 8, y: (bb.minY + bb.maxY) / 2 },
    layer: "0",
    rotation: 90,
  });

  geometry.bendPoints.forEach((bp, i) => {
    if (bp.radius > 0) {
      synthetic.push({
        type: "radial",
        value: bp.radius,
        text: `R${bp.radius.toFixed(2)}`,
        defPoint1: { x: bp.x, y: bp.y },
        defPoint2: { x: bp.x + bp.radius, y: bp.y },
        textPosition: { x: bp.x, y: bp.y + bp.radius + 3 },
        layer: "0",
        rotation: 0,
      });
    }
    if (bp.angle !== 0) {
      synthetic.push({
        type: "angular",
        value: Math.abs(bp.angle * 180 / Math.PI),
        text: `∠${Math.abs(bp.angle * 180 / Math.PI).toFixed(1)}°`,
        defPoint1: { x: bp.x, y: bp.y },
        defPoint2: { x: bp.x + 10, y: bp.y },
        textPosition: { x: bp.x + 5, y: bp.y + 5 },
        layer: "0",
        rotation: bp.angle,
      });
    }
  });

  geometry.segments.forEach((seg) => {
    const len = Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY);
    if (seg.type === "line" && len > 0.01) {
      synthetic.push({
        type: "linear",
        value: len,
        text: `L=${len.toFixed(2)}`,
        defPoint1: { x: seg.startX, y: seg.startY },
        defPoint2: { x: seg.endX, y: seg.endY },
        textPosition: { x: (seg.startX + seg.endX) / 2, y: (seg.startY + seg.endY) / 2 + 4 },
        layer: "0",
        rotation: Math.atan2(seg.endY - seg.startY, seg.endX - seg.startX) * 180 / Math.PI,
      });
    }
  });

  return synthetic;
}

export function DimensionConfirmationPanel() {
  const { geometry, dxfDimensions, setDxfDimensions, confirmedDimensions, setConfirmedDimensions } = useCncStore();

  const [dims, setDims] = useState<ConfirmedDim[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [filter, setFilter] = useState<DxfDimension["type"] | "all">("all");

  // Manual dimension entry state
  const [manualLabel, setManualLabel] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [manualType, setManualType] = useState<DxfDimension["type"]>("linear");
  const [showManualForm, setShowManualForm] = useState(false);

  const addManualDimension = useCallback(() => {
    const val = parseFloat(manualValue);
    if (isNaN(val) || !manualLabel.trim()) return;
    const id = `manual-${Date.now()}-${manualType}`;
    const newDim: ConfirmedDim = {
      id,
      type: manualType,
      value: val,
      text: manualLabel.trim(),
      defPoint1: { x: 0, y: 0 },
      defPoint2: { x: val, y: 0 },
      textPosition: { x: val / 2, y: 5 },
      layer: "manual",
      rotation: 0,
      confirmed: true, // Manual entries are auto-confirmed
      override: val,
    };
    setDims(prev => {
      const updated = [...prev, newDim];
      setConfirmedDimensions(updated);
      return updated;
    });
    setManualLabel("");
    setManualValue("");
    setShowManualForm(false);
  }, [manualLabel, manualValue, manualType, setConfirmedDimensions]);

  useEffect(() => {
    const source = (dxfDimensions.length > 0 ? dxfDimensions : buildFromGeometry(geometry));
    const built: ConfirmedDim[] = source.map((d, i) => ({
      ...d,
      confirmed: false,
      id: `dim-${i}-${d.type}-${d.value.toFixed(3)}`,
    }));
    setDims(built);
  }, [geometry, dxfDimensions]);

  const effectiveDims = filter === "all" ? dims : dims.filter(d => d.type === filter);

  const confirmAll = useCallback(() => {
    const updated = dims.map(d => ({ ...d, confirmed: true }));
    setDims(updated);
    setConfirmedDimensions(updated);
  }, [dims, setConfirmedDimensions]);

  const resetAll = useCallback(() => {
    const updated = dims.map(d => ({ ...d, confirmed: false, override: undefined }));
    setDims(updated);
    setConfirmedDimensions([]);
  }, [dims, setConfirmedDimensions]);

  const confirmDim = useCallback((id: string) => {
    setDims(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, confirmed: true } : d);
      setConfirmedDimensions(updated);
      return updated;
    });
  }, [setConfirmedDimensions]);

  const rejectDim = useCallback((id: string) => {
    setDims(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, confirmed: false } : d);
      setConfirmedDimensions(updated);
      return updated;
    });
  }, [setConfirmedDimensions]);

  const startEdit = (dim: ConfirmedDim) => {
    setEditingId(dim.id);
    setEditVal(String(dim.override ?? dim.value.toFixed(3)));
  };

  const saveEdit = useCallback((id: string) => {
    const val = parseFloat(editVal);
    if (isNaN(val)) { setEditingId(null); return; }
    setDims(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, override: val, confirmed: true } : d);
      setConfirmedDimensions(updated);
      return updated;
    });
    setEditingId(null);
  }, [editVal, setConfirmedDimensions]);

  const confirmedCount = dims.filter(d => d.confirmed).length;
  const allConfirmed = dims.length > 0 && confirmedCount === dims.length;

  const types = Array.from(new Set(dims.map(d => d.type)));

  const ManualEntryForm = () => (
    <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
      <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-1">Manual Dimension Entry</div>
      <div className="flex gap-2">
        <input
          type="text"
          value={manualLabel}
          onChange={e => setManualLabel(e.target.value)}
          placeholder="Label (e.g. Flange Width)"
          className="flex-1 text-[11px] bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/40"
        />
        <input
          type="number"
          value={manualValue}
          onChange={e => setManualValue(e.target.value)}
          placeholder="mm"
          className="w-20 text-[11px] bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={manualType}
          onChange={e => setManualType(e.target.value as DxfDimension["type"])}
          className="flex-1 text-[11px] bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-zinc-300 focus:outline-none focus:border-blue-500/40"
        >
          <option value="linear">Linear (mm)</option>
          <option value="aligned">Aligned (mm)</option>
          <option value="angular">Angular (°)</option>
          <option value="radial">Radius (mm)</option>
          <option value="diameter">Diameter (mm)</option>
        </select>
        <button onClick={addManualDimension}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-colors">
          Add
        </button>
        <button onClick={() => setShowManualForm(false)}
          className="px-2 py-1.5 rounded-lg text-[10px] text-zinc-600 hover:text-zinc-400">
          Cancel
        </button>
      </div>
    </div>
  );

  if (!geometry) {
    return (
      <div className="flex flex-col h-full bg-[#080812] overflow-hidden">
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center flex-shrink-0">
            <Ruler className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Dimension Entry</div>
            <div className="text-[10px] text-zinc-500">Add dimensions manually for profiles without DXF</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center gap-3 py-4 text-center mb-4">
            <Info className="w-8 h-8 text-zinc-700" />
            <div className="text-sm font-semibold text-zinc-500">No Profile Loaded</div>
            <div className="text-xs text-zinc-600 max-w-xs">
              Upload a DXF file in Setup to auto-extract dimensions, or enter profile dimensions manually below. Note: geometry generation requires a profile — manual dimensions confirm and annotate that geometry.
            </div>
          </div>
          {!showManualForm ? (
            <button onClick={() => setShowManualForm(true)}
              className="w-full py-2 rounded-xl border border-blue-500/20 bg-blue-500/8 text-[11px] text-blue-400 font-semibold hover:bg-blue-500/12 transition-colors">
              + Add Manual Dimension
            </button>
          ) : (
            <ManualEntryForm />
          )}
          {dims.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="text-[10px] text-zinc-500 font-semibold">Manually Entered ({dims.length}):</div>
              {dims.map(d => (
                <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-zinc-300 flex-1">{d.text}</span>
                  <span className="text-zinc-500 font-mono">{(d.override ?? d.value).toFixed(3)}{d.type === "angular" ? "°" : "mm"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#080812] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center flex-shrink-0">
          <Ruler className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">DXF Dimension Confirmation</div>
          <div className="text-[10px] text-zinc-500">
            Auto-extracted dimensions — confirm or override before proceeding
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{
              background: allConfirmed ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.1)",
              color: allConfirmed ? "#22c55e" : "#f59e0b",
              border: `1px solid ${allConfirmed ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.25)"}`,
            }}>
            {confirmedCount}/{dims.length} confirmed
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.05] flex items-center gap-2 flex-wrap">
        <button
          onClick={confirmAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Confirm All
        </button>
        <button
          onClick={() => setShowManualForm(prev => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <Edit3 className="w-3.5 h-3.5" />
          + Manual
        </button>
        <button
          onClick={resetAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ background: "rgba(255,255,255,0.04)", color: "#71717a", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {(["all", ...types] as (DxfDimension["type"] | "all")[]).map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors"
              style={{
                background: filter === t ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                color: filter === t ? "#818cf8" : "#52525b",
                border: `1px solid ${filter === t ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {t === "all" ? "All" : DIM_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Dimension list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {showManualForm && (
          <ManualEntryForm />
        )}
        {effectiveDims.length === 0 && !showManualForm && (
          <div className="text-center py-8 text-xs text-zinc-600">No dimensions found for this filter</div>
        )}
        {effectiveDims.map(dim => {
          const isEditing = editingId === dim.id;
          const hasOverride = dim.override !== undefined;
          const displayVal = hasOverride ? dim.override! : dim.value;

          return (
            <div
              key={dim.id}
              className="rounded-xl border px-3 py-2.5 transition-all"
              style={{
                background: dim.confirmed ? "rgba(34,197,94,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${dim.confirmed ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <div className="flex items-center gap-2">
                {/* Type badge */}
                <div className="flex-shrink-0">
                  <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      color: "#818cf8",
                      border: "1px solid rgba(99,102,241,0.2)",
                    }}>
                    {DIM_TYPE_LABEL[dim.type]}
                  </div>
                </div>

                {/* Value / edit */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(dim.id); if (e.key === "Escape") setEditingId(null); }}
                        autoFocus
                        className="w-24 bg-zinc-900 border border-indigo-500/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                      />
                      <span className="text-[10px] text-zinc-500">{DIM_UNIT[dim.type]}</span>
                      <button onClick={() => saveEdit(dim.id)} className="p-0.5 text-emerald-400 hover:text-emerald-300">
                        <Save className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white tabular-nums">
                        {displayVal.toFixed(dim.type === "angular" ? 2 : 3)}{DIM_UNIT[dim.type]}
                      </span>
                      {hasOverride && (
                        <span className="text-[9px] text-amber-400 line-through opacity-60">
                          {dim.value.toFixed(3)}{DIM_UNIT[dim.type]}
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-600 truncate">{dim.text}</span>
                    </div>
                  )}
                </div>

                {/* Layer */}
                {dim.layer && dim.layer !== "0" && (
                  <span className="text-[9px] text-zinc-600 hidden sm:block">L:{dim.layer}</span>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(dim)}
                      title="Override value"
                      className="p-1 rounded hover:bg-white/[0.06] text-zinc-600 hover:text-zinc-300 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => dim.confirmed ? rejectDim(dim.id) : confirmDim(dim.id)}
                    className="p-1 rounded transition-colors"
                    title={dim.confirmed ? "Click to un-confirm" : "Confirm dimension"}
                    style={{ color: dim.confirmed ? "#22c55e" : "#52525b" }}
                  >
                    {dim.confirmed
                      ? <CheckCircle2 className="w-4 h-4" />
                      : <XCircle className="w-4 h-4 hover:text-red-400" />
                    }
                  </button>
                </div>
              </div>

              {/* Coordinate info */}
              <div className="mt-1 text-[9px] text-zinc-700 flex gap-3 flex-wrap">
                <span>P1: ({dim.defPoint1.x.toFixed(1)}, {dim.defPoint1.y.toFixed(1)})</span>
                <span>P2: ({dim.defPoint2.x.toFixed(1)}, {dim.defPoint2.y.toFixed(1)})</span>
                {hasOverride && (
                  <span className="text-amber-700">overridden</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="flex-shrink-0 border-t border-white/[0.06] px-4 py-3">
        {!allConfirmed && dims.length > 0 && (
          <div className="flex items-center gap-2 mb-2 text-[10px] text-amber-500/80">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            {dims.length - confirmedCount} dimension{dims.length - confirmedCount !== 1 ? "s" : ""} not yet confirmed — review before running validation.
          </div>
        )}
        {allConfirmed && (
          <div className="flex items-center gap-2 text-[10px] text-emerald-500">
            <CheckCircle2 className="w-3 h-3" />
            All {dims.length} dimensions confirmed — ready for validation pipeline.
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { label: "Total", value: dims.length },
            { label: "Confirmed", value: confirmedCount },
            { label: "Overridden", value: dims.filter(d => d.override !== undefined).length },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-sm font-bold text-white">{value}</div>
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
