import React, { useState, Suspense, lazy } from "react";
import { Flower, Box, Columns2, ChevronLeft, ChevronRight, Info } from "lucide-react";

const FlowerPatternView = lazy(() =>
  import("./FlowerPatternView").then(m => ({ default: m.FlowerPatternView }))
);
const FlowerPattern3DView = lazy(() =>
  import("./FlowerPattern3DView").then(m => ({ default: m.FlowerPattern3DView }))
);

type ViewMode = "2d" | "3d" | "both";

function Shimmer() {
  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-500 text-[11px] gap-2">
      <div className="w-4 h-4 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
      Loading...
    </div>
  );
}

export function FlowerPatternCombined() {
  const [mode, setMode] = useState<ViewMode>("both");
  const [splitRatio, setSplitRatio] = useState(50);

  const MODES: { id: ViewMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "2d", label: "2D Flower", icon: <Flower className="w-3.5 h-3.5" />, desc: "Station-wise 2D flower pattern with progression view" },
    { id: "3d", label: "3D Flower", icon: <Box className="w-3.5 h-3.5" />, desc: "Interactive 3D animated station cross-sections" },
    { id: "both", label: "2D + 3D", icon: <Columns2 className="w-3.5 h-3.5" />, desc: "Dono ek saath — 2D upar, 3D neeche" },
  ];

  const adjustSplit = (delta: number) => {
    setSplitRatio(prev => Math.min(75, Math.max(25, prev + delta)));
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60 bg-zinc-900/50 shrink-0">
        <Flower className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-bold text-zinc-200">Flower Pattern</span>
        <span className="text-[9px] text-zinc-500 hidden sm:block">
          {MODES.find(m => m.id === mode)?.desc}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {/* Mode Toggle Buttons */}
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                mode === m.id
                  ? m.id === "2d"
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                    : m.id === "3d"
                      ? "bg-violet-500/20 border-violet-500/50 text-violet-300"
                      : "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                  : "bg-zinc-800/40 border-zinc-700/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}

          {/* Split ratio controls (only in both mode) */}
          {mode === "both" && (
            <div className="flex items-center gap-1 ml-2 border-l border-zinc-700/40 pl-2">
              <button onClick={() => adjustSplit(-10)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                title="2D zyada">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-[9px] text-zinc-500 min-w-[28px] text-center">{splitRatio}%</span>
              <button onClick={() => adjustSplit(10)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                title="3D zyada">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info bar — both mode */}
      {mode === "both" && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/30 border-b border-zinc-800/30 shrink-0">
          <Info className="w-3 h-3 text-zinc-600 shrink-0" />
          <span className="text-[9px] text-zinc-600">
            ← / → buttons se split adjust karo • 2D me station select karo = 3D me bhi highlight hoga (same store)
          </span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">

        {/* 2D only */}
        {mode === "2d" && (
          <div className="h-full">
            <Suspense fallback={<Shimmer />}>
              <FlowerPatternView />
            </Suspense>
          </div>
        )}

        {/* 3D only */}
        {mode === "3d" && (
          <div className="h-full">
            <Suspense fallback={<Shimmer />}>
              <FlowerPattern3DView />
            </Suspense>
          </div>
        )}

        {/* Both — vertically split */}
        {mode === "both" && (
          <div className="h-full flex flex-col">
            {/* 2D panel — top */}
            <div
              className="overflow-hidden border-b border-zinc-700/50 relative"
              style={{ height: `${splitRatio}%` }}
            >
              <div className="absolute top-1.5 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 pointer-events-none">
                <Flower className="w-3 h-3 text-cyan-400" />
                <span className="text-[9px] font-bold text-cyan-300">2D Flower Pattern</span>
              </div>
              <Suspense fallback={<Shimmer />}>
                <FlowerPatternView />
              </Suspense>
            </div>

            {/* Divider handle */}
            <div className="flex items-center justify-center h-1.5 bg-zinc-800/60 border-y border-zinc-700/40 shrink-0 group cursor-row-resize select-none">
              <div className="w-10 h-0.5 rounded-full bg-zinc-600 group-hover:bg-emerald-500/60 transition-colors" />
            </div>

            {/* 3D panel — bottom */}
            <div
              className="overflow-hidden relative"
              style={{ height: `${100 - splitRatio - 0.5}%` }}
            >
              <div className="absolute top-1.5 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-violet-500/20 border border-violet-500/30 pointer-events-none">
                <Box className="w-3 h-3 text-violet-400" />
                <span className="text-[9px] font-bold text-violet-300">3D Flower Pattern</span>
              </div>
              <Suspense fallback={<Shimmer />}>
                <FlowerPattern3DView />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
