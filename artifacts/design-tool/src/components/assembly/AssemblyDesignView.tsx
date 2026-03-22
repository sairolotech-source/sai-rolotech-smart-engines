import React, { useState, useCallback } from "react";
import {
  Box, Circle, Cylinder, Triangle, Trash2, Copy, Lock, Unlock,
  Layers, Eye, EyeOff, AlertTriangle, Download, Plus, X, Link2, Unlink,
} from "lucide-react";
import { AssemblyViewport3D } from "./AssemblyViewport3D";
import { useAssemblyStore } from "../../store/useAssemblyStore";
import type { MateType, PartPrimitiveType, ViewMode } from "../../store/useAssemblyStore";

const PRIMITIVES: { type: PartPrimitiveType; label: string; icon: React.ReactNode }[] = [
  { type: "box", label: "Block", icon: <Box className="w-3.5 h-3.5" /> },
  { type: "cylinder", label: "Shaft", icon: <Cylinder className="w-3.5 h-3.5" /> },
  { type: "sphere", label: "Ball", icon: <Circle className="w-3.5 h-3.5" /> },
  { type: "cone", label: "Cone", icon: <Triangle className="w-3.5 h-3.5" /> },
];

const MATE_TYPES: { type: MateType; label: string; icon: string }[] = [
  { type: "coincident", label: "Coincident", icon: "⊙" },
  { type: "concentric", label: "Concentric", icon: "◎" },
  { type: "parallel", label: "Parallel", icon: "∥" },
  { type: "perpendicular", label: "Perpendicular", icon: "⊥" },
  { type: "distance", label: "Distance", icon: "↔" },
  { type: "angle", label: "Angle", icon: "∠" },
];

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function PartTreePanel() {
  const {
    assembly, selectedPartId, selectPart, removePart, togglePartLock,
    duplicatePart, insertPart,
  } = useAssemblyStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[11px] font-bold text-zinc-200">Parts ({assembly.parts.length})</span>
        <div className="flex gap-1">
          {PRIMITIVES.map(p => (
            <button
              key={p.type}
              onClick={() => insertPart(p.type)}
              title={`Insert ${p.label}`}
              className="p-1 rounded hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {p.icon}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {assembly.parts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600 text-[11px]">
            <Plus className="w-5 h-5 mb-1" />
            <span>Insert parts to begin</span>
          </div>
        ) : (
          assembly.parts.map(part => (
            <div
              key={part.id}
              onClick={() => selectPart(part.id)}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors border-l-2 ${
                selectedPartId === part.id
                  ? "bg-blue-500/10 border-blue-500 text-zinc-200"
                  : "border-transparent hover:bg-white/[0.03] text-zinc-400"
              }`}
            >
              <div className="w-3 h-3 rounded-sm" style={{ background: part.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium truncate">{part.name}</div>
                <div className="text-[9px] text-zinc-600">{part.material} · {part.weightKg.toFixed(3)} kg</div>
              </div>
              <div className="flex gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); togglePartLock(part.id); }}
                  className="p-0.5 rounded hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-300"
                  title={part.locked ? "Unlock" : "Lock"}
                >
                  {part.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicatePart(part.id); }}
                  className="p-0.5 rounded hover:bg-white/[0.08] text-zinc-600 hover:text-zinc-300"
                  title="Duplicate"
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removePart(part.id); }}
                  className="p-0.5 rounded hover:bg-white/[0.08] text-zinc-600 hover:text-red-400"
                  title="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PartPropertiesPanel() {
  const { assembly, selectedPartId, updatePartProps } = useAssemblyStore();
  const part = assembly.parts.find(p => p.id === selectedPartId);

  if (!part) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-[11px]">
        Select a part to edit
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Name</label>
        <input
          value={part.name}
          onChange={e => updatePartProps(part.id, { name: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200 mt-1"
        />
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Material</label>
        <select
          value={part.material}
          onChange={e => updatePartProps(part.id, { material: e.target.value })}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200 mt-1"
        >
          {["Steel", "Aluminum", "Brass", "Titanium", "ABS Plastic", "Nylon", "Cast Iron", "Copper"].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Dimensions (mm)</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          {["X", "Y", "Z"].map((axis, i) => (
            <div key={axis}>
              <span className="text-[9px] text-zinc-600">{axis}</span>
              <input
                type="number"
                value={part.scale[i]}
                onChange={e => {
                  const newScale = [...part.scale] as [number, number, number];
                  newScale[i] = parseFloat(e.target.value) || 1;
                  updatePartProps(part.id, { scale: newScale });
                }}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-zinc-200 font-mono"
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 uppercase tracking-wide">Color</label>
        <input
          type="color"
          value={part.color}
          onChange={e => updatePartProps(part.id, { color: e.target.value })}
          className="w-8 h-6 rounded border border-white/[0.08] mt-1 cursor-pointer"
        />
      </div>
      <div className="border-t border-white/[0.06] pt-2 text-[10px] text-zinc-500 space-y-1">
        <div>Weight: <span className="text-zinc-300 font-mono">{part.weightKg.toFixed(3)} kg</span></div>
        <div>Type: <span className="text-zinc-300">{part.primitiveType}</span></div>
        <div>Pos: <span className="text-zinc-300 font-mono">[{part.position.map(v => v.toFixed(1)).join(", ")}]</span></div>
      </div>
    </div>
  );
}

function MatesPanel() {
  const {
    assembly, selectedMateId, selectMate, removeMate,
    mateCreationMode, startMateCreation, cancelMateCreation, pendingMateType,
    mateCreationStep, pendingMateValue, setPendingMateValue,
  } = useAssemblyStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <div className="text-[11px] font-bold text-zinc-200 mb-2">Mates ({assembly.mates.length})</div>
        {mateCreationMode ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
            <div className="text-[10px] text-blue-300 font-medium mb-1">
              Creating {pendingMateType} mate
            </div>
            <div className="text-[9px] text-blue-400/70">
              {mateCreationStep === "select-face1" ? "Click first part face..." : "Click second part face..."}
            </div>
            {(pendingMateType === "distance" || pendingMateType === "angle") && (
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-[9px] text-zinc-400">{pendingMateType === "distance" ? "mm:" : "deg:"}</span>
                <input
                  type="number"
                  value={pendingMateValue ?? (pendingMateType === "distance" ? 10 : 90)}
                  onChange={e => setPendingMateValue(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-white/[0.06] border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] text-zinc-200 font-mono"
                />
              </div>
            )}
            <button
              onClick={cancelMateCreation}
              className="mt-1.5 text-[9px] text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {MATE_TYPES.map(mt => (
              <button
                key={mt.type}
                onClick={() => startMateCreation(mt.type)}
                disabled={assembly.parts.length < 2}
                className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="text-sm">{mt.icon}</span>
                <span className="text-[8px]">{mt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {assembly.mates.map(mate => {
          const p1 = assembly.parts.find(p => p.id === mate.face1.partId);
          const p2 = assembly.parts.find(p => p.id === mate.face2.partId);
          const mateInfo = MATE_TYPES.find(m => m.type === mate.type);
          return (
            <div
              key={mate.id}
              onClick={() => selectMate(mate.id)}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors border-l-2 ${
                selectedMateId === mate.id
                  ? "bg-purple-500/10 border-purple-500 text-zinc-200"
                  : "border-transparent hover:bg-white/[0.03] text-zinc-400"
              }`}
            >
              <span className="text-sm">{mateInfo?.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium truncate">
                  {mate.type} {mate.value !== undefined ? `(${mate.value})` : ""}
                </div>
                <div className="text-[8px] text-zinc-600 truncate">
                  {p1?.name || "?"} ↔ {p2?.name || "?"}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${mate.satisfied ? "bg-green-500" : "bg-red-500"}`} />
                <button
                  onClick={(e) => { e.stopPropagation(); removeMate(mate.id); }}
                  className="p-0.5 rounded hover:bg-white/[0.08] text-zinc-600 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BomPanel() {
  const { assembly, getBom } = useAssemblyStore();
  const bom = getBom();
  const totalWeight = bom.reduce((s, i) => s + i.weightKg * i.qty, 0);
  const totalParts = bom.reduce((s, i) => s + i.qty, 0);

  const exportCsv = useCallback(() => {
    const header = "Item,Part Name,Type,Material,Qty,Dimensions,Weight(kg)";
    const rows = bom.map(i =>
      `${i.itemNo},"${i.partName}","${i.primitiveType}","${i.material}",${i.qty},"${i.dimensions}",${i.weightKg}`
    );
    downloadFile([header, ...rows].join("\n"), `${assembly.name.replace(/\s+/g, "_")}_BOM.csv`);
  }, [bom, assembly.name]);

  const exportTxt = useCallback(() => {
    const lines = [
      "═══════════════════════════════════════════════",
      `  ASSEMBLY BOM — ${assembly.name}`,
      `  Generated: ${new Date().toISOString().split("T")[0]}`,
      "═══════════════════════════════════════════════",
      `  Total Parts  : ${totalParts}`,
      `  Total Weight : ${totalWeight.toFixed(3)} kg`,
      "",
      "ITEM  PART NAME                    TYPE         MATERIAL        QTY  DIMENSIONS              WT(kg)",
      "─".repeat(100),
      ...bom.map(i =>
        `${String(i.itemNo).padEnd(5)} ${i.partName.padEnd(28)} ${i.primitiveType.padEnd(12)} ${i.material.padEnd(15)} ${String(i.qty).padEnd(4)} ${i.dimensions.padEnd(24)} ${i.weightKg.toFixed(3)}`
      ),
      "",
      `TOTAL: ${totalParts} parts · ${totalWeight.toFixed(3)} kg`,
    ];
    downloadFile(lines.join("\n"), `${assembly.name.replace(/\s+/g, "_")}_BOM.txt`);
  }, [bom, assembly.name, totalParts, totalWeight]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold text-zinc-200">Assembly BOM</div>
          <div className="text-[9px] text-zinc-500">{totalParts} parts · {totalWeight.toFixed(3)} kg</div>
        </div>
        <div className="flex gap-1">
          <button onClick={exportCsv} className="text-[9px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20">CSV</button>
          <button onClick={exportTxt} className="text-[9px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">TXT</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {bom.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-zinc-600 text-[11px]">No parts in assembly</div>
        ) : (
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                <th className="px-2 py-1.5 text-left text-zinc-600 font-semibold">#</th>
                <th className="px-2 py-1.5 text-left text-zinc-600 font-semibold">Part</th>
                <th className="px-2 py-1.5 text-left text-zinc-600 font-semibold">Mat</th>
                <th className="px-2 py-1.5 text-right text-zinc-600 font-semibold">Qty</th>
                <th className="px-2 py-1.5 text-right text-zinc-600 font-semibold">Wt</th>
              </tr>
            </thead>
            <tbody>
              {bom.map(item => (
                <tr key={item.itemNo} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-2 py-1 text-zinc-600">{item.itemNo}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-sm" style={{ background: item.color }} />
                      <span className="text-zinc-300">{item.partName}</span>
                    </div>
                    <div className="text-[8px] text-zinc-600">{item.dimensions}</div>
                  </td>
                  <td className="px-2 py-1 text-zinc-400">{item.material}</td>
                  <td className="px-2 py-1 text-right text-emerald-400 font-bold">{item.qty}</td>
                  <td className="px-2 py-1 text-right text-amber-400 font-mono">{item.weightKg.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                <td colSpan={3} className="px-2 py-1.5 text-zinc-500 font-semibold">Total</td>
                <td className="px-2 py-1.5 text-right text-emerald-400 font-bold">{totalParts}</td>
                <td className="px-2 py-1.5 text-right text-amber-400 font-mono font-bold">{totalWeight.toFixed(3)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function InterferencePanel() {
  const { interferences, showInterference, setShowInterference, runInterferenceCheck, assembly } = useAssemblyStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-white/[0.06] flex items-center justify-between">
        <div className="text-[11px] font-bold text-zinc-200">Interference</div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowInterference(!showInterference)}
            className={`p-1 rounded ${showInterference ? "bg-red-500/20 text-red-400" : "bg-white/[0.04] text-zinc-500"}`}
          >
            {showInterference ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={runInterferenceCheck}
            disabled={assembly.parts.length < 2}
            className="text-[9px] px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 disabled:opacity-30"
          >
            Run Check
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {interferences.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 text-zinc-600 text-[11px]">
            <AlertTriangle className="w-5 h-5 mb-1 text-zinc-700" />
            <span>{assembly.parts.length < 2 ? "Need 2+ parts" : "No interferences detected"}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {interferences.map((inf, i) => {
              const p1 = assembly.parts.find(p => p.id === inf.partId1);
              const p2 = assembly.parts.find(p => p.id === inf.partId2);
              return (
                <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] font-bold text-red-300">Conflict #{i + 1}</span>
                  </div>
                  <div className="text-[9px] text-zinc-400">
                    <span className="text-zinc-300">{p1?.name}</span> ↔ <span className="text-zinc-300">{p2?.name}</span>
                  </div>
                  <div className="text-[9px] text-red-400 font-mono mt-0.5">
                    Overlap: {inf.overlapVolume.toFixed(1)} mm³
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type LeftTab = "parts" | "mates";
type RightTab = "properties" | "bom" | "interference";

export function AssemblyDesignView() {
  const {
    assembly, viewMode, setViewMode, explosionDistance, setExplosionDistance,
    sectionPlaneY, setSectionPlaneY, sectionPlaneEnabled, setSectionPlaneEnabled,
    setAssemblyName, clearAssembly, solveMates,
  } = useAssemblyStore();

  const [leftTab, setLeftTab] = useState<LeftTab>("parts");
  const [rightTab, setRightTab] = useState<RightTab>("properties");

  return (
    <div className="flex flex-col h-full w-full bg-[#080812] text-zinc-100 overflow-hidden">
      <div className="h-11 flex-shrink-0 flex items-center gap-2 px-3 border-b border-white/[0.06] bg-[#0b0b1a]">
        <div className="flex items-center gap-2 mr-3">
          <Layers className="w-4 h-4 text-purple-400" />
          <input
            value={assembly.name}
            onChange={e => setAssemblyName(e.target.value)}
            className="bg-transparent text-[12px] font-bold text-zinc-200 border-b border-transparent hover:border-white/[0.15] focus:border-purple-500/50 outline-none px-1 py-0.5 w-36"
          />
        </div>

        <div className="w-px h-5 bg-white/[0.07]" />

        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
          {(["normal", "exploded", "section"] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                if (mode === "section") setSectionPlaneEnabled(true);
                else setSectionPlaneEnabled(false);
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
                viewMode === mode
                  ? mode === "exploded" ? "bg-amber-500/20 text-amber-300" : mode === "section" ? "bg-green-500/20 text-green-300" : "bg-white/[0.08] text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {mode === "normal" ? "Normal" : mode === "exploded" ? "Exploded" : "Section"}
            </button>
          ))}
        </div>

        {viewMode === "exploded" && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[9px] text-zinc-500">Distance:</span>
            <input
              type="range"
              min={10}
              max={200}
              value={explosionDistance}
              onChange={e => setExplosionDistance(parseInt(e.target.value))}
              className="w-20 h-1 accent-amber-500"
            />
            <span className="text-[10px] text-amber-400 font-mono w-10">{explosionDistance}mm</span>
          </div>
        )}

        {viewMode === "section" && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-[9px] text-zinc-500">Plane Y:</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={sectionPlaneY}
              onChange={e => setSectionPlaneY(parseInt(e.target.value))}
              className="w-20 h-1 accent-green-500"
            />
            <span className="text-[10px] text-green-400 font-mono w-10">{sectionPlaneY}mm</span>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={solveMates}
          disabled={assembly.mates.length === 0}
          className="text-[10px] font-medium px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 disabled:opacity-30"
        >
          <Link2 className="w-3 h-3 inline mr-1" />
          Solve Mates
        </button>
        <button
          onClick={clearAssembly}
          className="text-[10px] font-medium px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 flex-shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0a0a18]">
          <div className="flex border-b border-white/[0.06]">
            {(["parts", "mates"] as LeftTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className={`flex-1 px-3 py-2 text-[10px] font-semibold transition-all border-b-2 ${
                  leftTab === tab
                    ? "border-purple-500 text-zinc-200"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "parts" ? "Parts" : "Mates"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {leftTab === "parts" ? <PartTreePanel /> : <MatesPanel />}
          </div>
        </div>

        <div className="flex-1 relative">
          <AssemblyViewport3D />
        </div>

        <div className="w-56 flex-shrink-0 border-l border-white/[0.06] flex flex-col bg-[#0a0a18]">
          <div className="flex border-b border-white/[0.06]">
            {(["properties", "bom", "interference"] as RightTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 px-2 py-2 text-[10px] font-semibold transition-all border-b-2 ${
                  rightTab === tab
                    ? "border-purple-500 text-zinc-200"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "properties" ? "Props" : tab === "bom" ? "BOM" : "Check"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {rightTab === "properties" && <PartPropertiesPanel />}
            {rightTab === "bom" && <BomPanel />}
            {rightTab === "interference" && <InterferencePanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
