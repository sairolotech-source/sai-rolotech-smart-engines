import React, { useState, useEffect, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import { Database, Search, ChevronRight, Atom, Zap, Loader2, RefreshCw } from "lucide-react";

interface MaterialData {
  id: string;
  code: string;
  name: string;
  category: string;
  isoGroup: string;
  isoGroupLetter: string;
  hardnessMin: number | null;
  hardnessMax: number | null;
  hardnessScale: string | null;
  yieldStrength: number | null;
  tensileStrength: number | null;
  elasticModulus: number | null;
  density: number | null;
  elongation: number | null;
  thermalExpansion: number | null;
  kFactor: number | null;
  springbackRatio: number | null;
  maxBendAngle: number | null;
  minBendRadius: number | null;
  machinability: number | null;
  roughingVc: number | null;
  roughingFeed: number | null;
  roughingDoc: number | null;
  finishingVc: number | null;
  finishingFeed: number | null;
  finishingDoc: number | null;
  maxSurfaceSpeed: number | null;
  minSurfaceSpeed: number | null;
  hardnessFactor: number | null;
  color: string | null;
}

const FALLBACK_MATERIALS: MaterialData[] = [
  { id: "f1", code: "GI", name: "Galvanized Iron", category: "Coated Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 110, hardnessMax: 160, hardnessScale: "HB", yieldStrength: 280, tensileStrength: 380, elasticModulus: 200000, density: 7850, elongation: 22, thermalExpansion: 12.0, kFactor: 0.45, springbackRatio: 3.0, maxBendAngle: 160, minBendRadius: 1.0, machinability: 65, roughingVc: 180, roughingFeed: 0.30, roughingDoc: 3.0, finishingVc: 220, finishingFeed: 0.08, finishingDoc: 0.30, maxSurfaceSpeed: 220, minSurfaceSpeed: 120, hardnessFactor: 1.0, color: "#6b7280" },
  { id: "f2", code: "CR", name: "Cold Rolled Steel", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 90, hardnessMax: 130, hardnessScale: "HB", yieldStrength: 250, tensileStrength: 340, elasticModulus: 200000, density: 7850, elongation: 28, thermalExpansion: 12.0, kFactor: 0.42, springbackRatio: 2.5, maxBendAngle: 170, minBendRadius: 0.8, machinability: 72, roughingVc: 200, roughingFeed: 0.28, roughingDoc: 2.5, finishingVc: 240, finishingFeed: 0.07, finishingDoc: 0.25, maxSurfaceSpeed: 240, minSurfaceSpeed: 140, hardnessFactor: 0.95, color: "#9ca3af" },
  { id: "f3", code: "MS", name: "Mild Steel", category: "Carbon Steel", isoGroup: "Non-alloy steel", isoGroupLetter: "P", hardnessMin: 115, hardnessMax: 155, hardnessScale: "HB", yieldStrength: 300, tensileStrength: 400, elasticModulus: 200000, density: 7850, elongation: 25, thermalExpansion: 12.0, kFactor: 0.44, springbackRatio: 3.0, maxBendAngle: 165, minBendRadius: 1.0, machinability: 70, roughingVc: 160, roughingFeed: 0.30, roughingDoc: 3.0, finishingVc: 200, finishingFeed: 0.08, finishingDoc: 0.30, maxSurfaceSpeed: 200, minSurfaceSpeed: 100, hardnessFactor: 1.0, color: "#a8a29e" },
];

const ISO_GROUP_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  P: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "P - Steel" },
  M: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20", label: "M - Stainless" },
  K: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", label: "K - Cast Iron" },
  N: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", label: "N - Non-Ferrous" },
  S: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", label: "S - Superalloy/Ti" },
  H: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", label: "H - Hard Steel" },
};

export function MaterialDatabaseView() {
  const { materialType } = useCncStore();
  const [materials, setMaterials] = useState<MaterialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMat, setSelectedMat] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterIso, setFilterIso] = useState("All");

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const seedRes = await authFetch(getApiUrl("/materials/seed"), { method: "POST" });
      await seedRes.json();

      const res = await authFetch(getApiUrl("/materials"));
      const data = await res.json();
      if (data.success && data.materials.length > 0) {
        setMaterials(data.materials);
        const active = data.materials.find((m: MaterialData) => m.code === materialType);
        setSelectedMat(active?.id || data.materials[0].id);
      } else {
        setMaterials(FALLBACK_MATERIALS);
        setSelectedMat(FALLBACK_MATERIALS[0].id);
      }
    } catch {
      setMaterials(FALLBACK_MATERIALS);
      setSelectedMat(FALLBACK_MATERIALS[0].id);
    }
    setLoading(false);
  }, [materialType]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const categories = ["All", ...new Set(materials.map(m => m.category))];
  const isoGroups = ["All", ...new Set(materials.map(m => m.isoGroupLetter))];

  const filtered = materials.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "All" || m.category === filterCategory;
    const matchIso = filterIso === "All" || m.isoGroupLetter === filterIso;
    return matchSearch && matchCat && matchIso;
  });

  const selected = materials.find(m => m.id === selectedMat) ?? materials[0];
  if (!selected) return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>;

  const PropertyRow = ({ label, value, unit, highlight }: { label: string; value: string | number | null | undefined; unit?: string; highlight?: boolean }) => {
    if (value === null || value === undefined) return null;
    return (
      <div className={`flex justify-between text-[10px] px-2 py-1 rounded ${highlight ? "bg-blue-500/5" : ""}`}>
        <span className="text-zinc-500">{label}</span>
        <span className={highlight ? "text-blue-300 font-semibold" : "text-zinc-300"}>{value}{unit ? ` ${unit}` : ""}</span>
      </div>
    );
  };

  const yld = selected.yieldStrength || 0;
  const uts = selected.tensileStrength || 1;
  const strengthRatio = yld / uts;
  const elong = selected.elongation || 0;
  const nVal = selected.kFactor || 0.4;
  const formability = elong * (1 - strengthRatio) * nVal;
  const formabilityRating = formability > 3 ? "Excellent" : formability > 1.5 ? "Good" : formability > 0.5 ? "Fair" : "Poor";

  const isoStyle = ISO_GROUP_COLORS[selected.isoGroupLetter] || ISO_GROUP_COLORS.P;

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <Database className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Material Database</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{materials.length} Materials</span>
        <div className="flex gap-1 ml-2">
          {Object.entries(ISO_GROUP_COLORS).map(([letter, style]) => {
            const count = materials.filter(m => m.isoGroupLetter === letter).length;
            if (count === 0) return null;
            return (
              <button key={letter} onClick={() => setFilterIso(filterIso === letter ? "All" : letter)} className={`px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all ${filterIso === letter ? `${style.bg} ${style.text} ${style.border}` : "text-zinc-600 border-transparent hover:text-zinc-400"}`}>
                {letter}({count})
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-white/[0.04] border border-white/[0.08] rounded pl-7 pr-2 py-1 text-[10px] text-zinc-300 w-40" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 flex-shrink-0 border-r border-white/[0.07] bg-[#0c0c1a] overflow-y-auto">
          <div className="p-2 flex gap-1 flex-wrap border-b border-white/[0.05]">
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-2 py-0.5 rounded text-[9px] ${filterCategory === cat ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"}`}>
                {cat}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>
          ) : (
            <div className="space-y-0.5 p-1">
              {filtered.map(m => {
                const iso = ISO_GROUP_COLORS[m.isoGroupLetter];
                return (
                  <button key={m.id} onClick={() => setSelectedMat(m.id)} className={`w-full text-left px-2 py-2 rounded-lg flex items-center gap-2 transition-all ${selectedMat === m.id ? "bg-cyan-500/10 border border-cyan-500/20" : "hover:bg-white/[0.03]"}`}>
                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: m.color || "#888" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-zinc-300 font-medium truncate">{m.name}</div>
                      <div className="text-[8px] text-zinc-600 flex items-center gap-1">
                        <span>{m.code}</span>
                        {iso && <span className={`px-1 rounded ${iso.bg} ${iso.text}`}>{m.isoGroupLetter}</span>}
                        <span>{m.yieldStrength} MPa</span>
                      </div>
                    </div>
                    {m.code === materialType && (
                      <span className="text-[7px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">ACTIVE</span>
                    )}
                    <ChevronRight className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg border border-white/10" style={{ backgroundColor: selected.color || "#888" }} />
            <div>
              <h2 className="text-sm font-bold text-zinc-200">{selected.name}</h2>
              <p className="text-[10px] text-zinc-500">{selected.category} &bull; {selected.code}</p>
            </div>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${isoStyle.bg} ${isoStyle.text} ${isoStyle.border}`}>
              ISO {selected.isoGroupLetter} &bull; {selected.isoGroup}
            </span>
            {selected.code === materialType && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Currently Active</span>
            )}
          </div>

          {selected.hardnessMin !== null && selected.hardnessMax !== null && (
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Hardness Range</div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/[0.03] rounded-full h-4 overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] text-zinc-400 font-mono z-10">{selected.hardnessMin} — {selected.hardnessMax} {selected.hardnessScale}</div>
                  <div className="h-full bg-gradient-to-r from-cyan-500/30 to-cyan-500/60 rounded-full" style={{ width: `${Math.min(100, ((selected.hardnessMax || 0) / 400) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">{selected.hardnessScale}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-red-400" /> Mechanical
              </div>
              <div className="space-y-0.5">
                <PropertyRow label="Yield Strength (σ_y)" value={selected.yieldStrength} unit="MPa" highlight />
                <PropertyRow label="Tensile Strength (σ_u)" value={selected.tensileStrength} unit="MPa" highlight />
                <PropertyRow label="Elastic Modulus (E)" value={selected.elasticModulus ? `${(selected.elasticModulus / 1000).toFixed(0)}` : null} unit="GPa" />
                <PropertyRow label="Density" value={selected.density} unit="kg/m³" />
                <PropertyRow label="Elongation" value={selected.elongation} unit="%" />
                <PropertyRow label="Machinability" value={selected.machinability} unit="%" />
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Atom className="w-3 h-3 text-blue-400" /> Forming
              </div>
              <div className="space-y-0.5">
                <PropertyRow label="K-Factor" value={selected.kFactor} highlight />
                <PropertyRow label="Springback" value={selected.springbackRatio} unit="%" />
                <PropertyRow label="Max Bend Angle" value={selected.maxBendAngle} unit="°" />
                <PropertyRow label="Min Bend Radius" value={selected.minBendRadius ? `${selected.minBendRadius}×t` : null} />
                <PropertyRow label="σ_y / σ_u Ratio" value={`${(strengthRatio * 100).toFixed(1)}`} unit="%" />
                <PropertyRow label="Thermal Expansion" value={selected.thermalExpansion} unit="μm/m°C" />
                <PropertyRow label="Formability Index" value={formability.toFixed(2)} highlight />
                <PropertyRow label="Formability Rating" value={formabilityRating} />
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Database className="w-3 h-3 text-emerald-400" /> Cutting Data
              </div>
              <div className="space-y-0.5">
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider mb-1">Roughing</div>
                <PropertyRow label="Vc" value={selected.roughingVc} unit="m/min" highlight />
                <PropertyRow label="Feed" value={selected.roughingFeed} unit="mm/rev" />
                <PropertyRow label="DOC" value={selected.roughingDoc} unit="mm" />
                <div className="text-[8px] text-zinc-500 uppercase tracking-wider mb-1 mt-2">Finishing</div>
                <PropertyRow label="Vc" value={selected.finishingVc} unit="m/min" highlight />
                <PropertyRow label="Feed" value={selected.finishingFeed} unit="mm/rev" />
                <PropertyRow label="DOC" value={selected.finishingDoc} unit="mm" />
                <div className="border-t border-white/[0.05] mt-1 pt-1">
                  <PropertyRow label="Surface Speed" value={selected.minSurfaceSpeed && selected.maxSurfaceSpeed ? `${selected.minSurfaceSpeed}–${selected.maxSurfaceSpeed}` : null} unit="m/min" />
                  <PropertyRow label="Hardness Factor" value={selected.hardnessFactor} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Yield Strength Comparison</div>
            <div className="space-y-2">
              {materials.slice(0, 15).map(m => {
                const maxYield = Math.max(...materials.map(mm => mm.yieldStrength || 0));
                const pct = maxYield > 0 ? ((m.yieldStrength || 0) / maxYield) * 100 : 0;
                const iso = ISO_GROUP_COLORS[m.isoGroupLetter];
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className={`text-[8px] px-1 rounded ${iso?.bg || ""} ${iso?.text || "text-zinc-500"}`}>{m.isoGroupLetter}</span>
                    <span className={`text-[9px] w-12 truncate ${m.id === selectedMat ? "text-cyan-300 font-bold" : "text-zinc-500"}`}>{m.code}</span>
                    <div className="flex-1 bg-white/[0.03] rounded-full h-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${m.id === selectedMat ? "bg-cyan-500" : "bg-cyan-500/30"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-[9px] w-16 text-right ${m.id === selectedMat ? "text-cyan-300" : "text-zinc-500"}`}>{m.yieldStrength} MPa</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
