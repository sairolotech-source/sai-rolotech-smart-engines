import React, { useState, useEffect, useCallback } from "react";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import {
  Wrench, Search, Plus, Trash2, Edit3, ChevronRight, Loader2,
  RotateCw, Filter, Layers, Circle, Scissors, Hash, Drill, Box,
  Save, X, ChevronDown,
} from "lucide-react";

interface Tool {
  id: string;
  name: string;
  category: string;
  subType: string;
  isoDesignation?: string;
  diameter?: number;
  fluteCount?: number;
  helixAngle?: number;
  fluteLength?: number;
  overallLength?: number;
  cornerRadius?: number;
  noseRadius?: number;
  noseAngle?: number;
  reliefAngle?: number;
  icDiameter?: number;
  chipBreaker?: string;
  coatingType?: string;
  gradeCode?: string;
  holderCode?: string;
  holderReach?: number;
  holderOverhang?: number;
  insertThickness?: number;
  cuttingEdgeCount?: number;
  notes?: string;
}

const CATEGORIES = [
  { id: "all", label: "All Tools", icon: <Wrench className="w-3.5 h-3.5" /> },
  { id: "turning", label: "Turning", icon: <RotateCw className="w-3.5 h-3.5" /> },
  { id: "milling", label: "Milling", icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "drilling", label: "Drilling", icon: <Drill className="w-3.5 h-3.5" /> },
];

const SUB_TYPES: Record<string, { label: string; icon: React.ReactNode }> = {
  od_roughing: { label: "OD Roughing", icon: <Box className="w-3 h-3" /> },
  od_finishing: { label: "OD Finishing", icon: <Circle className="w-3 h-3" /> },
  profiling: { label: "Profiling", icon: <ChevronRight className="w-3 h-3" /> },
  boring: { label: "Boring", icon: <Circle className="w-3 h-3" /> },
  grooving: { label: "Grooving", icon: <Scissors className="w-3 h-3" /> },
  cutoff: { label: "Cutoff", icon: <Scissors className="w-3 h-3" /> },
  threading: { label: "Threading", icon: <Hash className="w-3 h-3" /> },
  chamfering: { label: "Chamfering", icon: <ChevronRight className="w-3 h-3" /> },
  freeturn: { label: "FreeTurn/HDT", icon: <RotateCw className="w-3 h-3" /> },
  end_mill: { label: "End Mill", icon: <Layers className="w-3 h-3" /> },
  face_mill: { label: "Face Mill", icon: <Layers className="w-3 h-3" /> },
  ball_nose: { label: "Ball Nose", icon: <Circle className="w-3 h-3" /> },
  chamfer_mill: { label: "Chamfer Mill", icon: <ChevronRight className="w-3 h-3" /> },
  twist_drill: { label: "Twist Drill", icon: <Drill className="w-3 h-3" /> },
  carbide_drill: { label: "Carbide Drill", icon: <Drill className="w-3 h-3" /> },
  tap: { label: "Tap", icon: <Hash className="w-3 h-3" /> },
  reamer: { label: "Reamer", icon: <Circle className="w-3 h-3" /> },
};

function InsertSVGPreview({ tool }: { tool: Tool }) {
  const w = 180, h = 140;
  const cx = w / 2, cy = h / 2;

  if (tool.category === "milling" || tool.category === "drilling") {
    const dia = tool.diameter || 10;
    const fl = tool.fluteLength || 25;
    const ol = tool.overallLength || 75;
    const scale = Math.min(50 / dia, 100 / ol) * 0.9;
    const dS = dia * scale;
    const flS = fl * scale;
    const olS = ol * scale;
    const shankD = dS * 0.85;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        <rect x={cx - shankD / 2} y={cy - olS / 2} width={shankD} height={olS - flS} fill="#555" stroke="#888" strokeWidth="0.5" rx="1" />
        <rect x={cx - dS / 2} y={cy - olS / 2 + (olS - flS)} width={dS} height={flS} fill="#4a90d9" stroke="#6ab0ff" strokeWidth="0.8" rx="1" />
        {tool.subType === "ball_nose" && (
          <ellipse cx={cx} cy={cy + olS / 2} rx={dS / 2} ry={dS / 4} fill="#4a90d9" stroke="#6ab0ff" strokeWidth="0.8" />
        )}
        {tool.fluteCount && Array.from({ length: Math.min(tool.fluteCount, 6) }).map((_, i) => {
          const spacing = flS / (tool.fluteCount! + 1);
          const yp = cy - olS / 2 + (olS - flS) + spacing * (i + 1);
          return <line key={i} x1={cx - dS / 2 + 1} y1={yp} x2={cx + dS / 2 - 1} y2={yp - 3} stroke="#2563eb" strokeWidth="0.5" opacity="0.6" />;
        })}
        <text x={cx} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="7">Ø{dia} × {ol}mm</text>
      </svg>
    );
  }

  const noseAngle = tool.noseAngle || 80;
  const ic = tool.icDiameter || 12.7;
  const nr = tool.noseRadius || 0.4;
  const angleRad = (noseAngle * Math.PI) / 180;
  const scale = Math.min(4, 50 / ic);
  const r = (ic / 2) * scale;

  if (tool.subType === "grooving" || tool.subType === "cutoff") {
    const bladeW = (tool.diameter || 3) * scale * 2;
    const bladeH = 30;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        <rect x={cx - bladeW / 2} y={cy - bladeH} width={bladeW} height={bladeH * 2} fill="#4a90d9" stroke="#6ab0ff" strokeWidth="0.8" rx="1" />
        <rect x={cx - bladeW / 2 - 10} y={cy - 8} width={10} height={16} fill="#555" stroke="#888" strokeWidth="0.5" />
        <text x={cx} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="7">{tool.isoDesignation || tool.name}</text>
      </svg>
    );
  }

  if (tool.subType === "threading") {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        <polygon points={`${cx},${cy - r * 0.8} ${cx + r * 0.6},${cy + r * 0.4} ${cx - r * 0.6},${cy + r * 0.4}`} fill="#4a90d9" stroke="#6ab0ff" strokeWidth="0.8" />
        <line x1={cx} y1={cy + r * 0.4} x2={cx} y2={cy + r * 0.4 + 5} stroke="#888" strokeWidth="0.5" strokeDasharray="2,1" />
        <text x={cx} y={cy - r * 0.8 - 5} textAnchor="middle" fill="#6ab0ff" fontSize="6">60°</text>
        <text x={cx} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="7">{tool.isoDesignation || tool.name}</text>
      </svg>
    );
  }

  const pts: [number, number][] = [];
  const sides = noseAngle <= 35 ? 3 : noseAngle <= 60 ? 4 : noseAngle <= 80 ? 4 : 6;
  const intAngle = ((sides - 2) * Math.PI) / sides;
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides - Math.PI / 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const ptStr = pts.map(p => p.join(",")).join(" ");
  const nrScaled = nr * scale * 3;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      <polygon points={ptStr} fill="#4a90d9" stroke="#6ab0ff" strokeWidth="0.8" fillOpacity="0.3" />
      <polygon points={ptStr} fill="none" stroke="#6ab0ff" strokeWidth="1.2" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={nrScaled} fill="none" stroke="#fbbf24" strokeWidth="0.6" />
      ))}
      <circle cx={cx} cy={cy} r={2} fill="#6ab0ff" />
      {tool.icDiameter && (
        <>
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#888" strokeWidth="0.4" strokeDasharray="2,1" />
          <text x={cx} y={cy + r + 12} textAnchor="middle" fill="#71717a" fontSize="6">IC Ø{tool.icDiameter}mm</text>
        </>
      )}
      <text x={cx} y={h - 4} textAnchor="middle" fill="#71717a" fontSize="7">{tool.isoDesignation || tool.name}</text>
      {tool.noseAngle && <text x={cx + r + 5} y={cy - r + 5} fill="#fbbf24" fontSize="6">{tool.noseAngle}°</text>}
    </svg>
  );
}

interface CuttingDataEntry {
  id: string;
  toolId: string;
  materialId: string;
  operationType: string;
  vcRough?: number;
  feedRough?: number;
  docRough?: number;
  vcFinish?: number;
  feedFinish?: number;
  docFinish?: number;
  coolant?: string;
  maxRpm?: number;
  notes?: string;
}

interface MaterialOption {
  id: string;
  code: string;
  name: string;
  isoGroupLetter: string;
  roughingVc?: number;
  roughingFeed?: number;
  roughingDoc?: number;
  finishingVc?: number;
  finishingFeed?: number;
  finishingDoc?: number;
}

function CuttingDataSection({ toolId }: { toolId: string }) {
  const [entries, setEntries] = useState<CuttingDataEntry[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({ materialId: "", operationType: "roughing", vcRough: 150, feedRough: 0.25, docRough: 2.5, vcFinish: 200, feedFinish: 0.08, docFinish: 0.3, coolant: "M08", maxRpm: 3000 });

  useEffect(() => {
    Promise.all([
      authFetch(getApiUrl(`/tools/${toolId}/cutting-data`)).then(r => r.json()),
      authFetch(getApiUrl("/materials")).then(r => r.json()),
    ]).then(([cdData, matData]) => {
      if (cdData.success) setEntries(cdData.cuttingData);
      if (matData.success) setMaterials(matData.materials);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [toolId]);

  const getMaterialName = (materialId: string | null) => {
    if (!materialId) return "General";
    const mat = materials.find(m => m.id === materialId);
    return mat ? `${mat.code} (ISO ${mat.isoGroupLetter})` : "Unknown";
  };

  const onMaterialSelect = (materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    if (mat) {
      setNewEntry(n => ({
        ...n,
        materialId,
        vcRough: mat.roughingVc || n.vcRough,
        feedRough: mat.roughingFeed || n.feedRough,
        docRough: mat.roughingDoc || n.docRough,
        vcFinish: mat.finishingVc || n.vcFinish,
        feedFinish: mat.finishingFeed || n.feedFinish,
        docFinish: mat.finishingDoc || n.docFinish,
      }));
    } else {
      setNewEntry(n => ({ ...n, materialId }));
    }
  };

  const addEntry = async () => {
    try {
      const payload = { ...newEntry, materialId: newEntry.materialId || null };
      const res = await authFetch(getApiUrl(`/tools/${toolId}/cutting-data`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setEntries(prev => [...prev, data.cuttingData]);
        setAdding(false);
        setNewEntry({ materialId: "", operationType: "roughing", vcRough: 150, feedRough: 0.25, docRough: 2.5, vcFinish: 200, feedFinish: 0.08, docFinish: 0.3, coolant: "M08", maxRpm: 3000 });
      }
    } catch {}
  };

  const removeEntry = async (cdId: string) => {
    try {
      await authFetch(getApiUrl(`/tools/${toolId}/cutting-data/${cdId}`), { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== cdId));
    } catch {}
  };

  if (loading) return <div className="text-[10px] text-zinc-500 py-2">Loading cutting data...</div>;

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-[10px] text-zinc-200";

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Cutting Data (per Material)</div>
        <button onClick={() => setAdding(!adding)} className="text-[9px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {entries.length === 0 && !adding && (
        <p className="text-[10px] text-zinc-600 italic">No cutting data defined. Add per-material operation parameters.</p>
      )}
      {entries.map(e => (
        <div key={e.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 mb-1.5 text-[10px]">
          <div className="flex justify-between items-center mb-1">
            <div>
              <span className="text-zinc-300 font-semibold capitalize">{e.operationType}</span>
              <span className="text-zinc-500 ml-2">{getMaterialName(e.materialId)}</span>
            </div>
            <button onClick={() => removeEntry(e.id)} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1 text-zinc-500">
            {e.vcRough != null && <span>Vc(R): {e.vcRough}</span>}
            {e.feedRough != null && <span>f(R): {e.feedRough}</span>}
            {e.docRough != null && <span>DOC(R): {e.docRough}</span>}
            {e.vcFinish != null && <span>Vc(F): {e.vcFinish}</span>}
            {e.feedFinish != null && <span>f(F): {e.feedFinish}</span>}
            {e.docFinish != null && <span>DOC(F): {e.docFinish}</span>}
            {e.coolant && <span>Coolant: {e.coolant}</span>}
            {e.maxRpm != null && <span>Max RPM: {e.maxRpm}</span>}
          </div>
        </div>
      ))}
      {adding && (
        <div className="bg-cyan-950/15 border border-cyan-500/15 rounded-lg p-2 mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2"><label className="text-[9px] text-zinc-500 block">Material</label><select value={newEntry.materialId} onChange={e => onMaterialSelect(e.target.value)} className={inputCls}><option value="">General (all materials)</option>{materials.map(m => <option key={m.id} value={m.id}>{m.code} - {m.name} (ISO {m.isoGroupLetter})</option>)}</select></div>
            <div><label className="text-[9px] text-zinc-500 block">Operation</label><select value={newEntry.operationType} onChange={e => setNewEntry(n => ({ ...n, operationType: e.target.value }))} className={inputCls}><option value="roughing">Roughing</option><option value="finishing">Finishing</option><option value="semi-finishing">Semi-Finishing</option></select></div>
            <div><label className="text-[9px] text-zinc-500 block">Vc Rough</label><input type="number" value={newEntry.vcRough} onChange={e => setNewEntry(n => ({ ...n, vcRough: +e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[9px] text-zinc-500 block">Feed Rough</label><input type="number" step="0.01" value={newEntry.feedRough} onChange={e => setNewEntry(n => ({ ...n, feedRough: +e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[9px] text-zinc-500 block">DOC Rough</label><input type="number" step="0.1" value={newEntry.docRough} onChange={e => setNewEntry(n => ({ ...n, docRough: +e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[9px] text-zinc-500 block">Vc Finish</label><input type="number" value={newEntry.vcFinish} onChange={e => setNewEntry(n => ({ ...n, vcFinish: +e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[9px] text-zinc-500 block">Feed Finish</label><input type="number" step="0.01" value={newEntry.feedFinish} onChange={e => setNewEntry(n => ({ ...n, feedFinish: +e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[9px] text-zinc-500 block">DOC Finish</label><input type="number" step="0.1" value={newEntry.docFinish} onChange={e => setNewEntry(n => ({ ...n, docFinish: +e.target.value }))} className={inputCls} /></div>
            <div><label className="text-[9px] text-zinc-500 block">Coolant</label><select value={newEntry.coolant} onChange={e => setNewEntry(n => ({ ...n, coolant: e.target.value }))} className={inputCls}><option value="M08">M08 - Flood</option><option value="M07">M07 - Mist</option><option value="M09">M09 - Off</option></select></div>
            <div><label className="text-[9px] text-zinc-500 block">Max RPM</label><input type="number" value={newEntry.maxRpm} onChange={e => setNewEntry(n => ({ ...n, maxRpm: +e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button onClick={addEntry} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"><Save className="w-3 h-3" /> Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolDetailPanel({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const PropRow = ({ label, value }: { label: string; value: string | number | undefined }) => {
    if (value === undefined || value === null || value === 0) return null;
    return (
      <div className="flex justify-between text-[10px] px-2 py-1 rounded hover:bg-white/[0.02]">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300 font-mono">{value}</span>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-bold text-zinc-200">{tool.name}</h2>
          <p className="text-[10px] text-zinc-500">{tool.category} &bull; {SUB_TYPES[tool.subType]?.label || tool.subType}</p>
          {tool.isoDesignation && <p className="text-[10px] text-cyan-400 font-mono mt-0.5">{tool.isoDesignation}</p>}
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 h-40">
        <InsertSVGPreview tool={tool} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Geometry</div>
          <div className="space-y-0.5">
            <PropRow label="Nose Angle" value={tool.noseAngle ? `${tool.noseAngle}°` : undefined} />
            <PropRow label="Nose Radius" value={tool.noseRadius ? `R${tool.noseRadius}mm` : undefined} />
            <PropRow label="IC Diameter" value={tool.icDiameter ? `${tool.icDiameter}mm` : undefined} />
            <PropRow label="Relief Angle" value={tool.reliefAngle ? `${tool.reliefAngle}°` : undefined} />
            <PropRow label="Diameter" value={tool.diameter ? `Ø${tool.diameter}mm` : undefined} />
            <PropRow label="Flute Count" value={tool.fluteCount || undefined} />
            <PropRow label="Helix Angle" value={tool.helixAngle ? `${tool.helixAngle}°` : undefined} />
            <PropRow label="Flute Length" value={tool.fluteLength ? `${tool.fluteLength}mm` : undefined} />
            <PropRow label="Overall Length" value={tool.overallLength ? `${tool.overallLength}mm` : undefined} />
            <PropRow label="Corner Radius" value={tool.cornerRadius ? `R${tool.cornerRadius}mm` : undefined} />
            <PropRow label="Insert Thickness" value={tool.insertThickness ? `${tool.insertThickness}mm` : undefined} />
            <PropRow label="Cutting Edges" value={tool.cuttingEdgeCount || undefined} />
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
          <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Holder Profile</div>
          <div className="space-y-0.5">
            <PropRow label="Chip Breaker" value={tool.chipBreaker} />
            <PropRow label="Coating" value={tool.coatingType} />
            <PropRow label="Grade" value={tool.gradeCode} />
            <PropRow label="Holder" value={tool.holderCode} />
            <PropRow label="Reach" value={tool.holderReach ? `${tool.holderReach}mm` : undefined} />
            <PropRow label="Overhang" value={tool.holderOverhang ? `${tool.holderOverhang}mm` : undefined} />
          </div>
        </div>
      </div>

      <CuttingDataSection toolId={tool.id} />

      {tool.notes && (
        <div className="bg-amber-950/15 border border-amber-500/20 rounded-xl p-3">
          <div className="text-[9px] font-semibold text-amber-400 uppercase tracking-widest mb-1">Notes</div>
          <p className="text-[10px] text-zinc-400">{tool.notes}</p>
        </div>
      )}
    </div>
  );
}

function ToolEditorModal({ tool, onSave, onCancel }: { tool: Partial<Tool> | null; onSave: (t: Partial<Tool>) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Partial<Tool>>(tool || { category: "turning", subType: "od_roughing", name: "" });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const subTypes = form.category === "turning"
    ? ["od_roughing", "od_finishing", "profiling", "boring", "grooving", "cutoff", "threading", "chamfering", "freeturn"]
    : form.category === "milling"
    ? ["end_mill", "face_mill", "ball_nose", "chamfer_mill"]
    : ["twist_drill", "carbide_drill", "tap", "reamer"];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-[#0c0c1a] border border-white/10 rounded-2xl w-[600px] max-h-[80vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-200">{tool?.id ? "Edit Tool" : "New Tool"}</h3>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Name</label>
            <input value={form.name || ""} onChange={e => set("name", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">ISO Designation</label>
            <input value={form.isoDesignation || ""} onChange={e => set("isoDesignation", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" placeholder="e.g. CNMG 120408" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Category</label>
            <select value={form.category || "turning"} onChange={e => { set("category", e.target.value); set("subType", e.target.value === "turning" ? "od_roughing" : e.target.value === "milling" ? "end_mill" : "twist_drill"); }} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200">
              <option value="turning">Turning</option>
              <option value="milling">Milling</option>
              <option value="drilling">Drilling</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Sub Type</label>
            <select value={form.subType || ""} onChange={e => set("subType", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200">
              {subTypes.map(st => <option key={st} value={st}>{SUB_TYPES[st]?.label || st}</option>)}
            </select>
          </div>
        </div>

        {form.category === "turning" && (
          <>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Insert Geometry</div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-zinc-500 block mb-1">Nose Angle (°)</label><input type="number" value={form.noseAngle || ""} onChange={e => set("noseAngle", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Nose Radius (mm)</label><input type="number" step="0.1" value={form.noseRadius || ""} onChange={e => set("noseRadius", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">IC Diameter (mm)</label><input type="number" step="0.1" value={form.icDiameter || ""} onChange={e => set("icDiameter", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Relief Angle (°)</label><input type="number" value={form.reliefAngle || ""} onChange={e => set("reliefAngle", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Chip Breaker</label><input value={form.chipBreaker || ""} onChange={e => set("chipBreaker", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Insert Thickness (mm)</label><input type="number" step="0.1" value={form.insertThickness || ""} onChange={e => set("insertThickness", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Cutting Edges</label><input type="number" value={form.cuttingEdgeCount || ""} onChange={e => set("cuttingEdgeCount", parseInt(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
            </div>
          </>
        )}

        {(form.category === "milling" || form.category === "drilling") && (
          <>
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Tool Geometry</div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-[10px] text-zinc-500 block mb-1">Diameter (mm)</label><input type="number" step="0.1" value={form.diameter || ""} onChange={e => set("diameter", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Flute Count</label><input type="number" value={form.fluteCount || ""} onChange={e => set("fluteCount", parseInt(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Helix Angle (°)</label><input type="number" value={form.helixAngle || ""} onChange={e => set("helixAngle", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Flute Length (mm)</label><input type="number" step="0.1" value={form.fluteLength || ""} onChange={e => set("fluteLength", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Overall Length (mm)</label><input type="number" step="0.1" value={form.overallLength || ""} onChange={e => set("overallLength", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
              <div><label className="text-[10px] text-zinc-500 block mb-1">Corner Radius (mm)</label><input type="number" step="0.1" value={form.cornerRadius || ""} onChange={e => set("cornerRadius", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
            </div>
          </>
        )}

        <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Holder & Coating</div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-[10px] text-zinc-500 block mb-1">Coating</label><input value={form.coatingType || ""} onChange={e => set("coatingType", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
          <div><label className="text-[10px] text-zinc-500 block mb-1">Grade</label><input value={form.gradeCode || ""} onChange={e => set("gradeCode", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
          <div><label className="text-[10px] text-zinc-500 block mb-1">Holder Code</label><input value={form.holderCode || ""} onChange={e => set("holderCode", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
          <div><label className="text-[10px] text-zinc-500 block mb-1">Holder Reach (mm)</label><input type="number" value={form.holderReach || ""} onChange={e => set("holderReach", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
          <div><label className="text-[10px] text-zinc-500 block mb-1">Overhang (mm)</label><input type="number" value={form.holderOverhang || ""} onChange={e => set("holderOverhang", parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200" /></div>
        </div>

        <div><label className="text-[10px] text-zinc-500 block mb-1">Notes</label><textarea value={form.notes || ""} onChange={e => set("notes", e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 h-16 resize-none" /></div>

        {form.category === "turning" && form.isoDesignation && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 h-36">
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Live Preview</div>
            <InsertSVGPreview tool={form as Tool} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5"><Save className="w-3 h-3" /> Save</button>
        </div>
      </div>
    </div>
  );
}

export function ToolLibraryView() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [editingTool, setEditingTool] = useState<Partial<Tool> | null | "new">(null);

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      const res = await authFetch(getApiUrl(`/tools?${params}`));
      const data = await res.json();
      if (data.success) {
        setTools(data.tools);
        if (data.tools.length === 0) {
          const seedRes = await authFetch(getApiUrl("/tools/seed-defaults"), { method: "POST" });
          const seedData = await seedRes.json();
          if (seedData.success) {
            const res2 = await authFetch(getApiUrl(`/tools?${params}`));
            const data2 = await res2.json();
            if (data2.success) setTools(data2.tools);
          }
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [category, search]);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  const handleSaveTool = async (toolData: Partial<Tool>) => {
    try {
      if (toolData.id) {
        await authFetch(getApiUrl(`/tools/${toolData.id}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toolData) });
      } else {
        await authFetch(getApiUrl("/tools"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toolData) });
      }
      setEditingTool(null);
      fetchTools();
    } catch { /* ignore */ }
  };

  const handleDeleteTool = async (id: string) => {
    try {
      await authFetch(getApiUrl(`/tools/${id}`), { method: "DELETE" });
      if (selectedTool?.id === id) setSelectedTool(null);
      fetchTools();
    } catch { /* ignore */ }
  };

  const grouped = tools.reduce<Record<string, Tool[]>>((acc, t) => {
    const key = t.subType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <Wrench className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Tool Library</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{tools.length} Tools</span>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools..." className="bg-white/[0.04] border border-white/[0.08] rounded pl-7 pr-2 py-1 text-[10px] text-zinc-300 w-44" />
        </div>
        <button onClick={() => setEditingTool("new")} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-900/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5"><Plus className="w-3 h-3" /> New Tool</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 flex-shrink-0 border-r border-white/[0.07] bg-[#0c0c1a] overflow-y-auto">
          <div className="p-2 space-y-0.5">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-[11px] transition-all ${category === cat.id ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20" : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-300"}`}>
                {cat.icon}
                <span>{cat.label}</span>
                <span className="ml-auto text-[9px] text-zinc-600">{cat.id === "all" ? tools.length : tools.filter(t => t.category === cat.id).length}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-white/[0.05] p-2 space-y-0.5 mt-2">
            <div className="text-[9px] text-zinc-600 px-2 mb-1 uppercase tracking-widest">Sub-Types</div>
            {Object.entries(grouped).map(([st, items]) => (
              <div key={st} className="px-2 py-1 text-[10px] flex items-center gap-2">
                {SUB_TYPES[st]?.icon || <Circle className="w-3 h-3" />}
                <span className="text-zinc-500">{SUB_TYPES[st]?.label || st}</span>
                <span className="ml-auto text-[9px] text-zinc-600">{items.length}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className={`${selectedTool ? "w-1/2" : "flex-1"} overflow-y-auto p-3`}>
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
            ) : tools.length === 0 ? (
              <div className="text-center py-10">
                <Wrench className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No tools found. Click "New Tool" to add one.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([st, items]) => (
                  <div key={st}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      {SUB_TYPES[st]?.icon || <Circle className="w-3 h-3 text-zinc-500" />}
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{SUB_TYPES[st]?.label || st}</span>
                      <span className="text-[9px] text-zinc-600">({items.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {items.map(tool => (
                        <button key={tool.id} onClick={() => setSelectedTool(tool)} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-all border ${selectedTool?.id === tool.id ? "bg-cyan-500/10 border-cyan-500/20" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"}`}>
                          <div className="w-8 h-8 bg-white/[0.03] rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg viewBox="0 0 32 32" className="w-6 h-6">
                              {tool.category === "turning" ? (
                                <polygon points="16,4 28,20 4,20" fill="#4a90d9" stroke="#6ab0ff" strokeWidth="1" fillOpacity="0.4" />
                              ) : tool.category === "milling" ? (
                                <rect x="10" y="4" width="12" height="24" fill="#4a90d9" stroke="#6ab0ff" strokeWidth="1" fillOpacity="0.4" rx="2" />
                              ) : (
                                <circle cx="16" cy="16" r="10" fill="none" stroke="#4a90d9" strokeWidth="1.5" />
                              )}
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-zinc-200 font-medium truncate">{tool.name}</div>
                            <div className="text-[9px] text-zinc-500">
                              {tool.isoDesignation || tool.subType}
                              {tool.coatingType && ` · ${tool.coatingType}`}
                              {tool.gradeCode && ` · ${tool.gradeCode}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={e => { e.stopPropagation(); setEditingTool(tool); }} className="p-1 hover:bg-white/[0.05] rounded text-zinc-500 hover:text-zinc-300"><Edit3 className="w-3 h-3" /></button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteTool(tool.id); }} className="p-1 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </div>
                          <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedTool && (
            <div className="w-1/2 border-l border-white/[0.07] bg-[#0a0a16]">
              <ToolDetailPanel tool={selectedTool} onClose={() => setSelectedTool(null)} />
            </div>
          )}
        </div>
      </div>

      {editingTool !== null && (
        <ToolEditorModal
          tool={editingTool === "new" ? null : editingTool as Partial<Tool>}
          onSave={handleSaveTool}
          onCancel={() => setEditingTool(null)}
        />
      )}
    </div>
  );
}
