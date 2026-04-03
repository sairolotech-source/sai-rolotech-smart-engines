import React, { useState, useEffect, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import { useDesignHistory, type SavedDesign } from "../../hooks/useDesignHistory";
import { Save, Trash2, Download, RefreshCw } from "lucide-react";

export function DesignHistory({ onClose }: { onClose?: () => void }) {
  const store = useCncStore();
  const { getAll, save, remove, clear } = useDesignHistory();
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [saveName, setSaveName] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [search, setSearch] = useState("");

  const reload = useCallback(() => setDesigns(getAll()), [getAll]);

  useEffect(() => { reload(); }, [reload]);

  const handleSave = () => {
    const name = saveName.trim() || store.profileName || `Design ${new Date().toLocaleDateString()}`;
    save({
      name,
      materialType: store.materialType,
      materialThickness: store.materialThickness,
      numStations: store.numStations,
      stationPrefix: store.stationPrefix,
      profileName: store.profileName,
      rollDiameter: store.rollDiameter,
      shaftDiameter: store.shaftDiameter,
      clearance: store.clearance,
      rollTooling: store.rollTooling,
      stations: store.stations,
      rollGaps: store.rollGaps,
    });
    setJustSaved(true);
    setSaveName("");
    reload();
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleLoad = (d: SavedDesign) => {
    store.setMaterialType(d.materialType as any);
    store.setMaterialThickness(d.materialThickness);
    store.setNumStations(d.numStations);
    store.setStationPrefix(d.stationPrefix);
    store.setProfileName(d.profileName);
    store.setRollDiameter(d.rollDiameter);
    store.setShaftDiameter(d.shaftDiameter);
    if (store.setClearance) store.setClearance(d.clearance);
    store.setRollTooling(d.rollTooling);
    store.setStations(d.stations);
    store.setRollGaps(d.rollGaps);
    if (onClose) onClose();
  };

  const handleDelete = (id: string) => {
    remove(id);
    reload();
  };

  const handleClearAll = () => {
    if (confirmClear) { clear(); reload(); setConfirmClear(false); }
    else setConfirmClear(true);
  };

  const filtered = designs.filter((d) =>
    search === "" ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.materialType.toLowerCase().includes(search.toLowerCase()) ||
    d.profileName.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  const matColor: Record<string, string> = {
    GI: "text-cyan-400", CR: "text-blue-400", HR: "text-orange-400",
    SS: "text-emerald-400", AL: "text-amber-400", MS: "text-red-400",
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="flex-shrink-0 px-5 py-3 bg-zinc-900 border-b border-zinc-700 flex items-center gap-3">
        <RefreshCw className="w-4 h-4 text-zinc-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">Design History</div>
          <div className="text-xs text-zinc-400">{designs.length} saved designs · stored locally</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs">✕ Close</button>
        )}
      </div>

      {/* Save current design */}
      <div className="flex-shrink-0 px-5 py-2 border-b border-zinc-800 flex items-center gap-2">
        <input
          type="text"
          placeholder={`Save name (e.g. "${store.profileName || "Shutter 82mm GI"}")`}
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSave}
          className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${justSaved ? "bg-green-700 text-white" : "bg-blue-700 hover:bg-blue-600 text-white"}`}
        >
          <Save className="w-3 h-3" />
          {justSaved ? "Saved!" : "Save Current"}
        </button>
      </div>

      {designs.length > 0 && (
        <div className="flex-shrink-0 px-5 py-2 border-b border-zinc-800 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search designs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-3 py-1.5 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleClearAll}
            className={`px-2 py-1.5 rounded text-xs flex items-center gap-1 transition-colors ${confirmClear ? "bg-red-700 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"}`}
          >
            <Trash2 className="w-3 h-3" />
            {confirmClear ? "Confirm Delete All" : "Clear All"}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <RefreshCw className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">{designs.length === 0 ? "No saved designs yet" : "No matching designs"}</p>
            <p className="text-xs mt-1">{designs.length === 0 ? "Save your current design using the field above" : "Try a different search term"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => (
              <div key={d.id} className="bg-zinc-900 border border-zinc-700 hover:border-zinc-500 rounded-lg p-3 flex items-start gap-3 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-zinc-100 truncate">{d.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/30 ${matColor[d.materialType] ?? "text-zinc-400"}`}>{d.materialType}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 grid grid-cols-4 gap-x-4 gap-y-0.5 font-mono">
                    <span>Profile: <span className="text-zinc-300">{d.profileName || "—"}</span></span>
                    <span>Thick: <span className="text-zinc-300">{d.materialThickness}mm</span></span>
                    <span>Stations: <span className="text-zinc-300">{d.numStations}</span></span>
                    <span>Rolls: <span className="text-zinc-300">{d.rollTooling.length * 2}</span></span>
                    <span>OD: <span className="text-zinc-300">{d.rollDiameter}mm</span></span>
                    <span>Shaft: <span className="text-zinc-300">{d.shaftDiameter}mm</span></span>
                    <span className="col-span-2">Saved: <span className="text-zinc-300">{fmt(d.date)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleLoad(d)}
                    className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" /> Load
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="px-2 py-1.5 bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 rounded text-xs transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-5 py-2 bg-zinc-900/50 border-t border-zinc-800 text-xs text-zinc-500 text-center">
        Designs are saved in your browser — no cloud needed. Load to restore all settings + roll tooling.
      </div>
    </div>
  );
}
