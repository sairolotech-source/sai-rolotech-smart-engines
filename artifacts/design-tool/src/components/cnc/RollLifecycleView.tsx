/**
 * RollLifecycleView — FormAxis RLM (Roll Lifecycle Management)
 *
 * Production-grade: No seeded random data.
 * Records are persisted in localStorage under key "sai_roll_inventory".
 * Users can add rolls, log hours, log regrind events, and change status.
 * Records are keyed by roll ID — deterministic, repeatable, auditable.
 */
import React, { useState, useMemo, useCallback } from "react";
import {
  Database, Search, Check, AlertTriangle, Clock, Wrench,
  Plus, Trash2, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RollRecord {
  id: string;
  station: number;
  material: string;
  outerDia: number;
  bore: number;
  width: number;
  hardness: string;
  operatingHours: number;
  lastRegrind: string;    // ISO date or "Never"
  regrindCount: number;
  maxRegrinds: number;
  wearMm: number;
  status: "active" | "storage" | "regrind" | "retired";
  profile: string;
  createdDate: string;    // ISO date
  notes: string;
}

// ─── localStorage persistence ─────────────────────────────────────────────────

const STORAGE_KEY = "sai_roll_inventory";

function loadRecords(): RollRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RollRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: RollRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    console.error("[RollLifecycle] Failed to persist records to localStorage");
  }
}

function nextId(records: RollRecord[]): string {
  const ids = records.map(r => parseInt(r.id.replace("R-", ""), 10)).filter(n => !isNaN(n));
  const max = ids.length ? Math.max(...ids) : 999;
  return `R-${max + 1}`;
}

// ─── Add Roll Form ────────────────────────────────────────────────────────────

const HARDNESS_BY_MATERIAL: Record<string, string> = {
  D2:    "58-62 HRC",
  EN8:   "28-32 HRC",
  SKD11: "55-60 HRC",
  SUJ2:  "60-64 HRC",
  EN31:  "60-65 HRC",
  H13:   "48-52 HRC",
};

const MAX_REGRINDS_BY_MATERIAL: Record<string, number> = {
  D2: 5, EN8: 3, SKD11: 5, SUJ2: 4, EN31: 5, H13: 4,
};

function emptyForm(): Omit<RollRecord, "id" | "createdDate" | "operatingHours" | "regrindCount" | "lastRegrind" | "wearMm"> {
  return {
    station: 1, material: "D2", outerDia: 200, bore: 50, width: 120,
    hardness: HARDNESS_BY_MATERIAL["D2"]!, maxRegrinds: 5,
    status: "active", profile: "", notes: "",
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RollLifecycleView() {
  const [records, setRecords] = useState<RollRecord[]>(() => loadRecords());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMaterial, setFilterMaterial] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("station");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm());
  const [logHoursInput, setLogHoursInput] = useState<string>("");
  const [logWearInput, setLogWearInput] = useState<string>("");
  const [saveFlash, setSaveFlash] = useState<string | null>(null);

  const persist = useCallback((updated: RollRecord[]) => {
    setRecords(updated);
    saveRecords(updated);
  }, []);

  const flash = (msg: string) => {
    setSaveFlash(msg);
    setTimeout(() => setSaveFlash(null), 2000);
  };

  // ── Filtered / sorted view ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = records;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.id.toLowerCase().includes(q) ||
        r.profile.toLowerCase().includes(q) ||
        String(r.station).includes(q)
      );
    }
    if (filterStatus !== "all") result = result.filter(r => r.status === filterStatus);
    if (filterMaterial !== "all") result = result.filter(r => r.material === filterMaterial);
    return [...result].sort((a, b) => {
      if (sortBy === "station") return a.station - b.station;
      if (sortBy === "hours") return b.operatingHours - a.operatingHours;
      if (sortBy === "wear") return b.wearMm - a.wearMm;
      if (sortBy === "id") return a.id.localeCompare(b.id);
      return 0;
    });
  }, [records, searchQuery, filterStatus, filterMaterial, sortBy]);

  const selected = records.find(r => r.id === selectedId) ?? null;

  const statsDisplay = useMemo(() => ({
    active:  records.filter(r => r.status === "active").length,
    storage: records.filter(r => r.status === "storage").length,
    regrind: records.filter(r => r.status === "regrind").length,
    retired: records.filter(r => r.status === "retired").length,
  }), [records]);

  // ── Mutators ───────────────────────────────────────────────────────────────

  const handleAddRoll = () => {
    if (!addForm.profile.trim()) { flash("✕ Profile name required"); return; }
    const today = new Date().toISOString().split("T")[0]!;
    const newRecord: RollRecord = {
      ...addForm,
      id: nextId(records),
      createdDate: today,
      operatingHours: 0,
      regrindCount: 0,
      lastRegrind: "Never",
      wearMm: 0,
    };
    const updated = [...records, newRecord];
    persist(updated);
    setSelectedId(newRecord.id);
    setShowAddForm(false);
    setAddForm(emptyForm());
    flash(`✓ Roll ${newRecord.id} added`);
  };

  const handleLogHours = () => {
    if (!selected) return;
    const h = parseFloat(logHoursInput);
    if (isNaN(h) || h <= 0) { flash("✕ Enter valid hours > 0"); return; }
    const updated = records.map(r =>
      r.id === selected.id ? { ...r, operatingHours: parseFloat((r.operatingHours + h).toFixed(1)) } : r
    );
    persist(updated);
    setLogHoursInput("");
    flash(`✓ +${h}h logged to ${selected.id}`);
  };

  const handleLogWear = () => {
    if (!selected) return;
    const w = parseFloat(logWearInput);
    if (isNaN(w) || w < 0) { flash("✕ Enter valid wear reading ≥ 0"); return; }
    const updated = records.map(r =>
      r.id === selected.id ? { ...r, wearMm: parseFloat(w.toFixed(3)) } : r
    );
    persist(updated);
    setLogWearInput("");
    flash(`✓ Wear updated for ${selected.id}: ${w}mm`);
  };

  const handleRegrind = () => {
    if (!selected) return;
    if (selected.regrindCount >= selected.maxRegrinds) {
      flash(`✕ Max regrinds (${selected.maxRegrinds}) reached — retire roll`);
      return;
    }
    const today = new Date().toISOString().split("T")[0]!;
    const updated = records.map(r =>
      r.id === selected.id
        ? { ...r, regrindCount: r.regrindCount + 1, lastRegrind: today, wearMm: 0, status: "active" as const }
        : r
    );
    persist(updated);
    flash(`✓ Regrind logged for ${selected.id} (${selected.regrindCount + 1}/${selected.maxRegrinds})`);
  };

  const handleStatusChange = (newStatus: RollRecord["status"]) => {
    if (!selected) return;
    const updated = records.map(r =>
      r.id === selected.id ? { ...r, status: newStatus } : r
    );
    persist(updated);
    flash(`✓ ${selected.id} → ${newStatus}`);
  };

  const handleDelete = () => {
    if (!selected) return;
    if (!window.confirm(`Delete roll ${selected.id}? This cannot be undone.`)) return;
    const updated = records.filter(r => r.id !== selected.id);
    persist(updated);
    setSelectedId(null);
    flash(`Roll ${selected.id} deleted`);
  };

  // ── Style helpers ──────────────────────────────────────────────────────────

  const statusColor = (s: string) =>
    s === "active"  ? "bg-green-500/10 text-green-400 border-green-700/30" :
    s === "storage" ? "bg-blue-500/10 text-blue-400 border-blue-700/30" :
    s === "regrind" ? "bg-amber-500/10 text-amber-400 border-amber-700/30" :
                     "bg-red-500/10 text-red-400 border-red-700/30";

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-blue-500";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200 text-[11px]">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-indigo-500/5 to-transparent flex-shrink-0">
        <Database className="w-5 h-5 text-indigo-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RLM — Roll Lifecycle Management</div>
          <div className="text-[10px] text-zinc-500">Wear tracking, regrind logging, and status management — persisted locally</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            {records.length} Rolls
          </span>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-500/10 border border-green-700/40 text-green-400 hover:bg-green-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Roll
          </button>
        </div>
      </div>

      {/* Flash */}
      {saveFlash && (
        <div className={`px-4 py-1.5 text-[10px] font-medium flex-shrink-0 ${
          saveFlash.startsWith("✓") ? "bg-green-900/40 text-green-400" :
          saveFlash.startsWith("✕") ? "bg-red-900/40 text-red-400" :
          "bg-zinc-800 text-zinc-300"
        }`}>
          {saveFlash}
        </div>
      )}

      {/* Add Roll Form */}
      {showAddForm && (
        <div className="px-4 py-3 border-b border-white/[0.06] bg-zinc-900/50 flex-shrink-0 space-y-2">
          <div className="text-[10px] font-bold text-zinc-400">New Roll Record</div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Station #</label>
              <input type="number" min={1} value={addForm.station}
                onChange={e => setAddForm(f => ({ ...f, station: parseInt(e.target.value) || 1 }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Material</label>
              <select value={addForm.material}
                onChange={e => setAddForm(f => ({
                  ...f,
                  material: e.target.value,
                  hardness: HARDNESS_BY_MATERIAL[e.target.value] ?? "N/A",
                  maxRegrinds: MAX_REGRINDS_BY_MATERIAL[e.target.value] ?? 3,
                }))}
                className={inputCls}>
                {Object.keys(HARDNESS_BY_MATERIAL).map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Outer Ø (mm)</label>
              <input type="number" min={50} value={addForm.outerDia}
                onChange={e => setAddForm(f => ({ ...f, outerDia: parseFloat(e.target.value) || 200 }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Width (mm)</label>
              <input type="number" min={10} value={addForm.width}
                onChange={e => setAddForm(f => ({ ...f, width: parseFloat(e.target.value) || 120 }))}
                className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Profile Name</label>
              <input type="text" placeholder="e.g. C-Channel 100x50" value={addForm.profile}
                onChange={e => setAddForm(f => ({ ...f, profile: e.target.value }))}
                className={inputCls} />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Notes</label>
              <input type="text" placeholder="Optional" value={addForm.notes}
                onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddRoll}
              className="px-3 py-1 rounded bg-green-700/40 border border-green-700/50 text-green-300 hover:bg-green-700/60 text-[10px] transition-colors">
              Add Roll
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-3 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 text-[10px] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search + Filter Bar */}
      <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1 flex-1">
          <Search className="w-3.5 h-3.5 text-zinc-500" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search — Roll ID, profile name, station..."
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
          {Object.keys(HARDNESS_BY_MATERIAL).map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="bg-black/30 border border-white/[0.08] rounded px-2 py-0.5 text-[10px] text-zinc-300">
          <option value="station">Sort: Station</option>
          <option value="hours">Sort: Hours</option>
          <option value="wear">Sort: Wear</option>
          <option value="id">Sort: ID</option>
        </select>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3 px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        {[
          { label: "Active",       count: statsDisplay.active,  color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Storage",      count: statsDisplay.storage, color: "text-blue-400",  bg: "bg-blue-500/10"  },
          { label: "Regrind Queue",count: statsDisplay.regrind, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Retired",      count: statsDisplay.retired, color: "text-red-400",   bg: "bg-red-500/10"   },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`p-2 rounded ${bg} text-center`}>
            <div className={`text-lg font-bold ${color}`}>{count}</div>
            <div className="text-[9px] text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Content: Table + Detail Panel */}
      <div className="flex flex-1 overflow-hidden">

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
              <Database className="w-10 h-10 opacity-30" />
              <div className="text-[12px] font-medium">No rolls recorded yet</div>
              <div className="text-[10px]">Click "Add Roll" to register your first roll set</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
              <Search className="w-8 h-8 opacity-30" />
              <div className="text-[11px]">No rolls match the current filters</div>
            </div>
          ) : (
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-[#0c0c1a] z-10">
                <tr className="border-b border-white/[0.08]">
                  {["ID", "Stn", "Profile", "Material", "OD", "Wear", "Hours", "Regrinds", "Status"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}
                    onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                    className={`border-b border-white/[0.04] cursor-pointer ${selectedId === r.id ? "bg-indigo-500/10" : "hover:bg-white/[0.02]"}`}>
                    <td className="px-2 py-1 font-mono text-zinc-400">{r.id}</td>
                    <td className="px-2 py-1 text-zinc-300">{r.station}</td>
                    <td className="px-2 py-1 text-zinc-300 truncate max-w-[120px]">{r.profile || <span className="text-zinc-600">—</span>}</td>
                    <td className="px-2 py-1 text-zinc-300">{r.material}</td>
                    <td className="px-2 py-1 text-zinc-300">{r.outerDia}mm</td>
                    <td className={`px-2 py-1 ${r.wearMm > 0.5 ? "text-red-300" : r.wearMm > 0.2 ? "text-amber-300" : "text-green-300"}`}>{r.wearMm.toFixed(3)}mm</td>
                    <td className="px-2 py-1 text-zinc-300">{r.operatingHours}h</td>
                    <td className={`px-2 py-1 ${r.regrindCount >= r.maxRegrinds ? "text-red-400" : "text-zinc-300"}`}>{r.regrindCount}/{r.maxRegrinds}</td>
                    <td className="px-2 py-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border capitalize ${statusColor(r.status)}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-[300px] flex-shrink-0 border-l border-white/[0.06] p-3 overflow-y-auto bg-[#0a0a18] space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-indigo-400" />
                {selected.id}
              </div>
              <button onClick={handleDelete} title="Delete roll" className="text-red-500 hover:text-red-300 text-[10px]">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Info grid */}
            <div className="space-y-0.5">
              {[
                ["Station",     selected.station],
                ["Profile",     selected.profile || "—"],
                ["Material",    `${selected.material} (${selected.hardness})`],
                ["Outer Ø",     `${selected.outerDia}mm`],
                ["Bore",        `${selected.bore}mm`],
                ["Width",       `${selected.width}mm`],
                ["Op. Hours",   `${selected.operatingHours}h`],
                ["Wear",        `${selected.wearMm.toFixed(3)}mm`],
                ["Regrinds",    `${selected.regrindCount} / ${selected.maxRegrinds}`],
                ["Last Regrind",selected.lastRegrind],
                ["Created",     selected.createdDate],
                ["Notes",       selected.notes || "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between text-[10px]">
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-300 text-right max-w-[160px] truncate">{String(value)}</span>
                </div>
              ))}
            </div>

            {/* Regrind allowance bar */}
            <div>
              <div className="text-[10px] font-bold text-zinc-400 mb-1">Regrind Allowance</div>
              <div className="w-full h-2.5 bg-black/30 rounded overflow-hidden">
                <div className={`h-full rounded ${selected.regrindCount >= selected.maxRegrinds ? "bg-red-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(100, (selected.regrindCount / selected.maxRegrinds) * 100)}%` }} />
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">
                {selected.maxRegrinds - selected.regrindCount} regrinds remaining
              </div>
            </div>

            {/* Wear bar */}
            <div>
              <div className="text-[10px] font-bold text-zinc-400 mb-1">Wear Level</div>
              <div className="w-full h-2.5 bg-black/30 rounded overflow-hidden">
                <div className={`h-full rounded ${selected.wearMm > 0.5 ? "bg-red-500" : selected.wearMm > 0.2 ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(100, (selected.wearMm / 1.0) * 100)}%` }} />
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">Limit: 1.0mm total wear</div>
            </div>

            {/* Status change */}
            <div>
              <div className="text-[10px] font-bold text-zinc-400 mb-1">Set Status</div>
              <div className="grid grid-cols-2 gap-1">
                {(["active", "storage", "regrind", "retired"] as const).map(s => (
                  <button key={s} onClick={() => handleStatusChange(s)}
                    className={`text-[9px] px-2 py-1 rounded border capitalize transition-colors ${
                      selected.status === s
                        ? statusColor(s)
                        : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Log hours */}
            <div>
              <div className="text-[10px] font-bold text-zinc-400 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Log Hours</div>
              <div className="flex gap-1">
                <input type="number" min={0.1} step={0.5} placeholder="Hours to add"
                  value={logHoursInput} onChange={e => setLogHoursInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-500" />
                <button onClick={handleLogHours}
                  className="px-2 py-1 rounded bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-800/40 text-[10px] transition-colors">
                  <Check className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Log wear */}
            <div>
              <div className="text-[10px] font-bold text-zinc-400 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> Update Wear Reading</div>
              <div className="flex gap-1">
                <input type="number" min={0} step={0.001} placeholder="Wear (mm)"
                  value={logWearInput} onChange={e => setLogWearInput(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[11px] outline-none focus:border-blue-500" />
                <button onClick={handleLogWear}
                  className="px-2 py-1 rounded bg-amber-900/40 border border-amber-700/50 text-amber-300 hover:bg-amber-800/40 text-[10px] transition-colors">
                  <Check className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Log regrind */}
            <div>
              <div className="text-[10px] font-bold text-zinc-400 mb-1 flex items-center gap-1"><RefreshCw className="w-3 h-3 text-green-400" /> Log Regrind Event</div>
              <button onClick={handleRegrind}
                disabled={selected.regrindCount >= selected.maxRegrinds}
                className="w-full py-1.5 rounded border text-[10px] transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed
                  bg-green-900/20 border-green-700/40 text-green-300 hover:bg-green-800/30">
                Record Regrind ({selected.regrindCount}/{selected.maxRegrinds})
              </button>
              <div className="text-[9px] text-zinc-600 mt-0.5">Resets wear to 0, updates last regrind date</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
