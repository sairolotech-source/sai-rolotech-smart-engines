import React, { useState, useMemo } from "react";
import {
  Database, Search, Check, AlertTriangle, Clock, Wrench,
  BarChart3, RefreshCw, Plus, Trash2, Filter
} from "lucide-react";

interface RollRecord {
  id: string;
  station: number;
  material: string;
  outerDia: number;
  bore: number;
  width: number;
  hardness: string;
  operatingHours: number;
  lastRegrind: string;
  regrindCount: number;
  maxRegrinds: number;
  wearMm: number;
  status: "active" | "storage" | "regrind" | "retired";
  profile: string;
  createdDate: string;
  similarity: number;
}

function generateRollInventory(count: number): RollRecord[] {
  const materials = ["D2", "EN8", "SKD11", "SUJ2"];
  const statuses: RollRecord["status"][] = ["active", "storage", "regrind", "retired"];
  const profiles = ["C-Channel 100x50", "Z-Purlin 150x65", "Hat Section 80x40", "U-Channel 75x38", "Angle 50x50"];
  const records: RollRecord[] = [];

  for (let i = 0; i < count; i++) {
    const station = (i % 12) + 1;
    const mat = materials[i % materials.length];
    const dia = 180 + (i % 3) * 20;
    const status = statuses[Math.floor(Math.random() * 4)];
    const regrindCount = Math.floor(Math.random() * 5);
    const hours = Math.floor(Math.random() * 2000);

    records.push({
      id: `R-${(1000 + i).toString()}`,
      station,
      material: mat,
      outerDia: dia,
      bore: 50,
      width: 120 + (i % 3) * 20,
      hardness: mat === "D2" ? "58-62 HRC" : mat === "SKD11" ? "55-60 HRC" : "28-32 HRC",
      operatingHours: hours,
      lastRegrind: regrindCount > 0 ? `2025-${(1 + (i % 12)).toString().padStart(2, "0")}-15` : "Never",
      regrindCount,
      maxRegrinds: mat === "D2" ? 5 : 3,
      wearMm: Math.round(Math.random() * 0.8 * 1000) / 1000,
      status,
      profile: profiles[i % profiles.length],
      createdDate: `2024-${(1 + (i % 12)).toString().padStart(2, "0")}-01`,
      similarity: Math.round(70 + Math.random() * 30),
    });
  }

  return records;
}

export function RollLifecycleView() {
  const [records] = useState(() => generateRollInventory(48));
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMaterial, setFilterMaterial] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("station");

  const filtered = useMemo(() => {
    let result = records;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.id.toLowerCase().includes(q) || r.profile.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") result = result.filter(r => r.status === filterStatus);
    if (filterMaterial !== "all") result = result.filter(r => r.material === filterMaterial);
    result.sort((a, b) => {
      if (sortBy === "station") return a.station - b.station;
      if (sortBy === "hours") return b.operatingHours - a.operatingHours;
      if (sortBy === "wear") return b.wearMm - a.wearMm;
      if (sortBy === "similarity") return b.similarity - a.similarity;
      return 0;
    });
    return result;
  }, [records, searchQuery, filterStatus, filterMaterial, sortBy]);

  const selected = records.find(r => r.id === selectedId);

  const statusColor = (s: string) =>
    s === "active" ? "bg-green-500/10 text-green-400" :
    s === "storage" ? "bg-blue-500/10 text-blue-400" :
    s === "regrind" ? "bg-amber-500/10 text-amber-400" :
    "bg-red-500/10 text-red-400";

  const activeCount = records.filter(r => r.status === "active").length;
  const storageCount = records.filter(r => r.status === "storage").length;
  const regrindQueue = records.filter(r => r.status === "regrind").length;
  const retiredCount = records.filter(r => r.status === "retired").length;

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-indigo-500/5 to-transparent">
        <Database className="w-5 h-5 text-indigo-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RLM — Roll Lifecycle Management</div>
          <div className="text-[10px] text-zinc-500">SmartSearch, Wear Tracking, Regrind Management & Similarity Matching</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            {records.length} Rolls
          </span>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex items-center gap-3">
        <div className="flex items-center gap-1 flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="SmartSearch — Roll ID, profile name..."
            className="flex-1 bg-transparent border-none outline-none text-[11px] text-zinc-200 placeholder-zinc-600" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded px-2 py-0.5 text-[10px] text-zinc-300">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="storage">Storage</option>
          <option value="regrind">Regrind</option>
          <option value="retired">Retired</option>
        </select>
        <select value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded px-2 py-0.5 text-[10px] text-zinc-300">
          <option value="all">All Materials</option>
          <option value="D2">D2</option>
          <option value="EN8">EN8</option>
          <option value="SKD11">SKD11</option>
          <option value="SUJ2">SUJ2</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded px-2 py-0.5 text-[10px] text-zinc-300">
          <option value="station">Sort: Station</option>
          <option value="hours">Sort: Hours</option>
          <option value="wear">Sort: Wear</option>
          <option value="similarity">Sort: Similarity</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-3 px-4 py-2 border-b border-white/[0.06]">
        {[
          { label: "Active", count: activeCount, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Storage", count: storageCount, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Regrind Queue", count: regrindQueue, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Retired", count: retiredCount, color: "text-red-400", bg: "bg-red-500/10" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`p-2 rounded ${bg} text-center`}>
            <div className={`text-lg font-bold ${color}`}>{count}</div>
            <div className="text-[9px] text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-[#0c0c1a] z-10">
              <tr className="border-b border-white/[0.08]">
                {["ID", "Stn", "Profile", "Material", "OD", "Wear", "Hours", "Regrinds", "Sim.%", "Status"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`border-b border-white/[0.04] cursor-pointer ${selectedId === r.id ? "bg-indigo-500/10" : "hover:bg-white/[0.02]"}`}>
                  <td className="px-2 py-1 font-mono text-zinc-400">{r.id}</td>
                  <td className="px-2 py-1 text-zinc-300">{r.station}</td>
                  <td className="px-2 py-1 text-zinc-300 truncate max-w-[120px]">{r.profile}</td>
                  <td className="px-2 py-1 text-zinc-300">{r.material}</td>
                  <td className="px-2 py-1 text-zinc-300">{r.outerDia}mm</td>
                  <td className={`px-2 py-1 ${r.wearMm > 0.5 ? "text-red-300" : "text-green-300"}`}>{r.wearMm}mm</td>
                  <td className="px-2 py-1 text-zinc-300">{r.operatingHours}h</td>
                  <td className="px-2 py-1 text-zinc-300">{r.regrindCount}/{r.maxRegrinds}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-black/30 rounded overflow-hidden">
                        <div className={`h-full rounded ${r.similarity > 90 ? "bg-green-500" : r.similarity > 80 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${r.similarity}%` }} />
                      </div>
                      <span className="text-zinc-400">{r.similarity}%</span>
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${statusColor(r.status)}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="w-[280px] flex-shrink-0 border-l border-white/[0.06] p-3 overflow-y-auto bg-[#0a0a18]">
            <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-indigo-400" />
              {selected.id} Detail
            </div>
            <div className="space-y-1 text-[10px]">
              {[
                { label: "Roll ID", value: selected.id },
                { label: "Station", value: selected.station },
                { label: "Profile", value: selected.profile },
                { label: "Material", value: `${selected.material} (${selected.hardness})` },
                { label: "Outer Ø", value: `${selected.outerDia}mm` },
                { label: "Bore", value: `${selected.bore}mm` },
                { label: "Width", value: `${selected.width}mm` },
                { label: "Operating Hours", value: `${selected.operatingHours}h` },
                { label: "Wear", value: `${selected.wearMm}mm` },
                { label: "Regrinds", value: `${selected.regrindCount} / ${selected.maxRegrinds}` },
                { label: "Last Regrind", value: selected.lastRegrind },
                { label: "Created", value: selected.createdDate },
                { label: "Similarity", value: `${selected.similarity}%` },
                { label: "Status", value: selected.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-300">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 p-2 rounded border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] font-bold text-zinc-400 mb-1">Wear Timeline</div>
              <div className="h-12 flex items-end gap-0.5">
                {Array.from({ length: 10 }, (_, i) => {
                  const h = (selected.wearMm / selected.maxRegrinds) * (i + 1) * 10;
                  return <div key={i} className="flex-1 bg-indigo-500/50 rounded-t" style={{ height: `${Math.min(h, 100)}%` }} />;
                })}
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[10px] font-bold text-zinc-400 mb-1">Regrind Allowance</div>
              <div className="w-full h-3 bg-black/30 rounded overflow-hidden">
                <div className={`h-full rounded ${selected.regrindCount >= selected.maxRegrinds ? "bg-red-500" : "bg-green-500"}`}
                  style={{ width: `${(selected.regrindCount / selected.maxRegrinds) * 100}%` }} />
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">
                {selected.maxRegrinds - selected.regrindCount} regrinds remaining
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
