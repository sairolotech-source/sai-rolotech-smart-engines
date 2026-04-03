import React, { useState } from "react";
import { Download, Play, Wrench, ChevronDown } from "lucide-react";
import { use3DStudioStore } from "./use3DStudioStore";
import type { ToolType } from "./use3DStudioStore";
import { saveAs } from "file-saver";

const TOOLS: { id: ToolType; label: string; desc: string }[] = [
  { id: "end_mill", label: "End Mill", desc: "General milling" },
  { id: "drill", label: "Drill", desc: "Hole drilling" },
  { id: "face_mill", label: "Face Mill", desc: "Surface facing" },
  { id: "ball_nose", label: "Ball Nose", desc: "3D contours" },
];

export function CAMPanel() {
  const { camSettings, setCamSettings, generateGcode, generatedGcode, objects, selectedObjectId } = use3DStudioStore();
  const [showGcode, setShowGcode] = useState(false);

  const selectedObj = selectedObjectId ? objects.find(o => o.id === selectedObjectId) : objects[0];

  const handleGenerate = () => {
    generateGcode();
    setShowGcode(true);
  };

  const handleDownload = () => {
    if (!generatedGcode) return;
    const blob = new Blob([generatedGcode], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "toolpath.nc");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <Wrench className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold text-zinc-400">CAM — Toolpath</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {objects.length === 0 && (
          <div className="text-[10px] text-zinc-700 text-center py-4">
            Add a 3D object first to generate toolpath.
          </div>
        )}

        {selectedObj && (
          <div className="text-[10px] text-zinc-500 bg-white/[0.02] rounded px-2 py-1.5 border border-white/[0.04]">
            Target: <span className="text-zinc-300">{selectedObj.name}</span>
          </div>
        )}

        <div>
          <label className="text-[10px] text-zinc-500 block mb-1.5 font-medium">Tool Type</label>
          <div className="grid grid-cols-2 gap-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setCamSettings({ toolType: t.id })}
                className={`px-2 py-1.5 rounded text-[10px] text-left border transition-all ${
                  camSettings.toolType === t.id
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    : "bg-white/[0.02] border-white/[0.05] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <div className="font-medium">{t.label}</div>
                <div className="text-[9px] opacity-60">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Ø Tool (mm)</label>
            <input
              type="number"
              value={camSettings.toolDiameter}
              onChange={(e) => setCamSettings({ toolDiameter: parseFloat(e.target.value) || 6 })}
              min={0.5}
              max={50}
              step={0.5}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Cut Depth (mm)</label>
            <input
              type="number"
              value={camSettings.cutDepth}
              onChange={(e) => setCamSettings({ cutDepth: parseFloat(e.target.value) || 1 })}
              min={0.1}
              max={50}
              step={0.5}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Feed (mm/min)</label>
            <input
              type="number"
              value={camSettings.feedRate}
              onChange={(e) => setCamSettings({ feedRate: parseFloat(e.target.value) || 1200 })}
              min={10}
              max={10000}
              step={100}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500/40"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Spindle (RPM)</label>
            <input
              type="number"
              value={camSettings.spindleSpeed}
              onChange={(e) => setCamSettings({ spindleSpeed: parseFloat(e.target.value) || 18000 })}
              min={100}
              max={60000}
              step={500}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-500/40"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[10px] text-zinc-500 font-medium">Coolant</label>
          <button
            onClick={() => setCamSettings({ coolant: !camSettings.coolant })}
            className={`w-8 h-4 rounded-full transition-all relative ${
              camSettings.coolant ? "bg-amber-500/60" : "bg-white/10"
            }`}
          >
            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${
              camSettings.coolant ? "left-4" : "left-0.5"
            }`} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={objects.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold
                       bg-amber-500/15 border border-amber-500/25 text-amber-300
                       hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Play className="w-3 h-3" />
            Generate Toolpath
          </button>
          {generatedGcode && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-medium
                         bg-emerald-500/10 border border-emerald-500/20 text-emerald-400
                         hover:bg-emerald-500/20 transition-all"
            >
              <Download className="w-3 h-3" />
              .nc
            </button>
          )}
        </div>

        {generatedGcode && (
          <div>
            <button
              onClick={() => setShowGcode(!showGcode)}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors mb-1"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showGcode ? "" : "-rotate-90"}`} />
              G-Code Preview
            </button>
            {showGcode && (
              <pre className="text-[9px] text-emerald-400/80 bg-black/40 rounded p-2 overflow-auto max-h-48 font-mono leading-relaxed border border-white/[0.04]">
                {generatedGcode}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
