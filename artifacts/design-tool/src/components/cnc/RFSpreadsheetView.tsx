import React, { useState, useMemo, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Table, Save, Download, RefreshCw, Plus, Trash2, ArrowUp, ArrowDown,
  Lock, Unlock, ChevronDown, Copy, Check
} from "lucide-react";

interface SpreadsheetRow {
  station: number;
  bendAngle: number;
  radius: number;
  springback: number;
  overbend: number;
  topAngle: number;
  bottomAngle: number;
  sideAngle: number;
  rollGap: number;
  locked: boolean;
}

function generateRows(numStations: number, thickness: number, yieldStrength: number, elasticModulus: number, totalAngle: number): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [];
  for (let i = 1; i <= numStations; i++) {
    const progress = i / numStations;
    const angle = progress * totalAngle;
    const r = thickness * 2;
    const k = yieldStrength / elasticModulus;
    const sb = k * (r / thickness) * 3 * (180 / Math.PI);
    const overbend = angle > 0 ? sb * (angle / totalAngle) : 0;
    rows.push({
      station: i,
      bendAngle: Math.round(angle * 10) / 10,
      radius: r,
      springback: Math.round(sb * 100) / 100,
      overbend: Math.round(overbend * 100) / 100,
      topAngle: Math.round(angle * 10) / 10,
      bottomAngle: Math.round(Math.min(angle * 1.05, totalAngle) * 10) / 10,
      sideAngle: Math.round(Math.max(0, angle - 5) * 10) / 10,
      rollGap: Math.round((thickness + (numStations - i) * 0.03) * 100) / 100,
      locked: false,
    });
  }
  return rows;
}

export function RFSpreadsheetView() {
  const { stations, geometry } = useCncStore();
  const [numStations, setNumStations] = useState(stations?.length || 12);
  const [thickness, setThickness] = useState(1.2);
  const [yieldStrength, setYieldStrength] = useState(280);
  const [elasticModulus, setElasticModulus] = useState(210000);
  const [totalAngle, setTotalAngle] = useState(90);
  const [rows, setRows] = useState<SpreadsheetRow[]>(() =>
    generateRows(numStations, thickness, yieldStrength, elasticModulus, totalAngle)
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const regenerate = useCallback(() => {
    setRows(generateRows(numStations, thickness, yieldStrength, elasticModulus, totalAngle));
  }, [numStations, thickness, yieldStrength, elasticModulus, totalAngle]);

  const updateCell = (stationIdx: number, col: string, value: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== stationIdx || r.locked) return r;
      const updated = { ...r, [col]: value };
      if (col === "bendAngle") {
        const sb = (yieldStrength / elasticModulus) * (r.radius / thickness) * 3 * (180 / Math.PI);
        updated.springback = Math.round(sb * 100) / 100;
        updated.overbend = Math.round(sb * (value / totalAngle) * 100) / 100;
        updated.topAngle = value;
      }
      return updated;
    }));
    setSelectedCell(null);
  };

  const addStation = () => {
    const last = rows[rows.length - 1];
    setRows(prev => [...prev, {
      station: prev.length + 1,
      bendAngle: last ? last.bendAngle + 5 : 10,
      radius: thickness * 2,
      springback: last?.springback || 1,
      overbend: last?.overbend || 0.5,
      topAngle: last ? last.topAngle + 5 : 10,
      bottomAngle: last ? last.bottomAngle + 5 : 10,
      sideAngle: last ? last.sideAngle + 5 : 5,
      rollGap: thickness,
      locked: false,
    }]);
  };

  const deleteStation = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, station: i + 1 })));
  };

  const toggleLock = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, locked: !r.locked } : r));
  };

  const moveStation = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= rows.length) return;
    setRows(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((r, i) => ({ ...r, station: i + 1 }));
    });
  };

  const columns = [
    { key: "station", label: "#", width: "w-10", editable: false },
    { key: "bendAngle", label: "Bend°", width: "w-16", editable: true },
    { key: "radius", label: "R (mm)", width: "w-14", editable: true },
    { key: "springback", label: "SB°", width: "w-14", editable: false },
    { key: "overbend", label: "OB°", width: "w-14", editable: false },
    { key: "topAngle", label: "Top°", width: "w-14", editable: true },
    { key: "bottomAngle", label: "Bot°", width: "w-14", editable: true },
    { key: "sideAngle", label: "Side°", width: "w-14", editable: true },
    { key: "rollGap", label: "Gap", width: "w-14", editable: true },
  ];

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-emerald-500/5 to-transparent">
        <Table className="w-5 h-5 text-emerald-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF Spreadsheet</div>
          <div className="text-[10px] text-zinc-500">Parametric Flower Design — Table-Based Station Editor</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={regenerate}
            className="text-[9px] flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20">
            <RefreshCw className="w-3 h-3" /> Recalculate
          </button>
          <button onClick={addStation}
            className="text-[9px] flex items-center gap-1 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 hover:bg-blue-500/20">
            <Plus className="w-3 h-3" /> Add Station
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex items-center gap-4">
        {[
          { label: "Stations", value: numStations, set: setNumStations, step: 1 },
          { label: "Thickness (mm)", value: thickness, set: setThickness, step: 0.1 },
          { label: "Yield (MPa)", value: yieldStrength, set: setYieldStrength, step: 10 },
          { label: "E (MPa)", value: elasticModulus, set: setElasticModulus, step: 1000 },
          { label: "Total Angle°", value: totalAngle, set: setTotalAngle, step: 5 },
        ].map(({ label, value, set, step }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-500">{label}</span>
            <input type="number" value={value} onChange={e => set(parseFloat(e.target.value) || 0)}
              step={step}
              className="w-16 bg-black/30 border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-zinc-200" />
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-[10px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0c0c1a]">
              <th className="px-1 py-1.5 text-zinc-500 font-medium w-8"></th>
              {columns.map(c => (
                <th key={c.key} className={`px-2 py-1.5 text-left text-zinc-500 font-medium ${c.width}`}>{c.label}</th>
              ))}
              <th className="px-1 py-1.5 text-zinc-500 font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={`border-b border-white/[0.04] ${row.locked ? "bg-amber-500/5" : "hover:bg-white/[0.02]"}`}>
                <td className="px-1 py-0.5 text-center">
                  <button onClick={() => toggleLock(idx)} className="text-zinc-600 hover:text-zinc-300">
                    {row.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </td>
                {columns.map(col => {
                  const val = (row as any)[col.key];
                  const isEditing = selectedCell?.row === idx && selectedCell?.col === col.key;
                  return (
                    <td key={col.key} className={`px-2 py-0.5 ${col.width}`}
                      onDoubleClick={() => {
                        if (col.editable && !row.locked) {
                          setSelectedCell({ row: idx, col: col.key });
                          setEditValue(String(val));
                        }
                      }}>
                      {isEditing ? (
                        <input autoFocus value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => updateCell(idx, col.key, parseFloat(editValue) || 0)}
                          onKeyDown={e => { if (e.key === "Enter") updateCell(idx, col.key, parseFloat(editValue) || 0); if (e.key === "Escape") setSelectedCell(null); }}
                          className="w-full bg-blue-500/10 border border-blue-500/30 rounded px-1 py-0 text-[10px] text-blue-200 outline-none" />
                      ) : (
                        <span className={`font-mono ${
                          col.key === "station" ? "text-zinc-600" :
                          col.key === "springback" ? "text-amber-300" :
                          col.key === "overbend" ? "text-red-300" :
                          col.editable ? "text-zinc-200 cursor-pointer" : "text-zinc-400"
                        }`}>
                          {typeof val === "number" ? val : val}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-1 py-0.5">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => moveStation(idx, -1)} className="text-zinc-600 hover:text-zinc-300 p-0.5"><ArrowUp className="w-3 h-3" /></button>
                    <button onClick={() => moveStation(idx, 1)} className="text-zinc-600 hover:text-zinc-300 p-0.5"><ArrowDown className="w-3 h-3" /></button>
                    <button onClick={() => deleteStation(idx)} className="text-zinc-600 hover:text-red-400 p-0.5"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex items-center gap-3 text-[9px] text-zinc-600">
          <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-amber-400" /> Locked rows won't update on recalculate</span>
          <span>Double-click editable cells to modify</span>
          <span>Springback & Overbend auto-calculated</span>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-3">
          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
            <div className="text-[9px] text-zinc-500">Stations</div>
            <div className="text-sm font-bold text-emerald-400">{rows.length}</div>
          </div>
          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
            <div className="text-[9px] text-zinc-500">Max Bend</div>
            <div className="text-sm font-bold text-zinc-300">{Math.max(...rows.map(r => r.bendAngle)).toFixed(1)}°</div>
          </div>
          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
            <div className="text-[9px] text-zinc-500">Avg SB</div>
            <div className="text-sm font-bold text-amber-400">{(rows.reduce((a, r) => a + r.springback, 0) / rows.length).toFixed(2)}°</div>
          </div>
          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
            <div className="text-[9px] text-zinc-500">Min Gap</div>
            <div className="text-sm font-bold text-blue-400">{Math.min(...rows.map(r => r.rollGap)).toFixed(2)}mm</div>
          </div>
          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
            <div className="text-[9px] text-zinc-500">Locked</div>
            <div className="text-sm font-bold text-zinc-400">{rows.filter(r => r.locked).length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
