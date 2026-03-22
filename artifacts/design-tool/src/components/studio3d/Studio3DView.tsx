import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Box, Circle, Cylinder, Triangle, PenLine, Layers,
  Cpu, Eye, EyeOff, Wrench, MessageSquare, RotateCcw,
  Plus, Minus, Hexagon, Spline, Blend, Shell,
  GitBranch, Download,
} from "lucide-react";
import { Viewport3D } from "./Viewport3D";
import { RollFormingViewport3D } from "./RollFormingViewport3D";
import { SketchCanvas } from "./SketchCanvas";
import { SceneTree } from "./SceneTree";
import { FeatureTree } from "./FeatureTree";
import { PropertiesPanel } from "./PropertiesPanel";
import { CAMPanel } from "./CAMPanel";
import { AIChatPanel } from "./AIChatPanel";
import { SolidModelingPanel } from "./SolidModelingPanel";
import { AssemblyDesignView } from "../assembly/AssemblyDesignView";
import { use3DStudioStore } from "./use3DStudioStore";
import { useCncStore } from "../../store/useCncStore";
import type { PrimitiveType } from "./use3DStudioStore";

type RightPanelTab = "properties" | "cam" | "ai" | "modeling";
type LeftPanelTab = "scene" | "features";
type ViewportMode = "generic" | "rollforming" | "assembly";

const PRIMITIVES: { type: PrimitiveType; label: string; icon: React.ReactNode }[] = [
  { type: "box", label: "Box", icon: <Box className="w-3.5 h-3.5" /> },
  { type: "cylinder", label: "Cylinder", icon: <Cylinder className="w-3.5 h-3.5" /> },
  { type: "sphere", label: "Sphere", icon: <Circle className="w-3.5 h-3.5" /> },
  { type: "cone", label: "Cone", icon: <Triangle className="w-3.5 h-3.5" /> },
];

export function Studio3DView() {
  const { mode, setMode, addPrimitive, objects, selectedObjectId, secondarySelectionId, performCSGOperation } = use3DStudioStore();
  const { rollTooling } = useCncStore();
  const [rightTab, setRightTab] = useState<RightPanelTab>("properties");
  const [leftTab, setLeftTab] = useState<LeftPanelTab>("features");
  const [showToolpath, setShowToolpath] = useState(false);

  const hasRollData = rollTooling.length > 0;
  const [viewportMode, setViewportMode] = useState<ViewportMode>(
    hasRollData ? "rollforming" : "generic"
  );
  const userExplicitlyChoseGeneric = useRef(false);

  useEffect(() => {
    if (hasRollData && !userExplicitlyChoseGeneric.current && viewportMode !== "assembly") {
      setViewportMode("rollforming");
    }
  }, [hasRollData]);

  const handleSetViewportMode = (m: ViewportMode) => {
    if (m === "generic") userExplicitlyChoseGeneric.current = true;
    if (m === "rollforming") userExplicitlyChoseGeneric.current = false;
    setViewportMode(m);
  };

  const effectiveViewportMode = useMemo(() => {
    if (viewportMode === "rollforming" && !hasRollData) return "generic";
    return viewportMode;
  }, [viewportMode, hasRollData]);

  const isRollForming = effectiveViewportMode === "rollforming";
  const isAssembly = effectiveViewportMode === "assembly";

  const canCSG = selectedObjectId && secondarySelectionId && selectedObjectId !== secondarySelectionId;

  return (
    <div className="flex flex-col h-full w-full bg-[#080812] text-zinc-100 overflow-hidden">

      <div className="h-11 flex-shrink-0 flex items-center gap-1 px-3 border-b border-white/[0.06] bg-[#0b0b1a]">

        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06] mr-2">
          <button
            onClick={() => handleSetViewportMode("generic")}
            title="Generic CAD viewport"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
              !isRollForming && !isAssembly
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>Generic CAD</span>
          </button>
          <button
            onClick={() => handleSetViewportMode("rollforming")}
            title={hasRollData ? "Roll Forming 3D view" : "Generate Roll Tooling first"}
            disabled={!hasRollData}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isRollForming
                ? "bg-orange-500/20 text-orange-300"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Roll Forming</span>
          </button>
          <button
            onClick={() => handleSetViewportMode("assembly")}
            title="Assembly Design"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
              viewportMode === "assembly"
                ? "bg-purple-500/20 text-purple-300"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Assembly</span>
          </button>
        </div>

        <div className="w-px h-5 bg-white/[0.07] mx-1" />

        {!isRollForming && !isAssembly && (
          <>
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[10px] text-zinc-600 mr-1 font-medium">Add:</span>
              {PRIMITIVES.map((p) => (
                <button
                  key={p.type}
                  onClick={() => { addPrimitive(p.type); if (mode !== "3d") setMode("3d"); }}
                  title={`Add ${p.label}`}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium
                             bg-white/[0.03] border border-white/[0.06] text-zinc-400
                             hover:bg-white/[0.07] hover:text-zinc-200 transition-all"
                >
                  {p.icon}
                  <span className="hidden xl:inline">{p.label}</span>
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-white/[0.07] mx-1" />

            <div className="flex items-center gap-1 mr-2">
              <span className="text-[10px] text-zinc-600 mr-1 font-medium">CSG:</span>
              <button
                onClick={() => performCSGOperation("union")}
                disabled={!canCSG}
                title="Union (select 2 objects with Shift+Click)"
                className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium
                           bg-green-500/10 border border-green-500/20 text-green-400
                           hover:bg-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden xl:inline">Union</span>
              </button>
              <button
                onClick={() => performCSGOperation("subtract")}
                disabled={!canCSG}
                title="Subtract (select 2 objects with Shift+Click)"
                className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium
                           bg-red-500/10 border border-red-500/20 text-red-400
                           hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Minus className="w-3 h-3" />
                <span className="hidden xl:inline">Subtract</span>
              </button>
              <button
                onClick={() => performCSGOperation("intersect")}
                disabled={!canCSG}
                title="Intersect (select 2 objects with Shift+Click)"
                className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium
                           bg-amber-500/10 border border-amber-500/20 text-amber-400
                           hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Hexagon className="w-3 h-3" />
                <span className="hidden xl:inline">Intersect</span>
              </button>
            </div>

            <div className="w-px h-5 bg-white/[0.07] mx-1" />

            <button
              onClick={() => setMode(mode === "sketch" ? "3d" : "sketch")}
              title="2D Sketch Mode"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium border transition-all ${
                mode === "sketch"
                  ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                  : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Sketch</span>
            </button>

            <button
              onClick={() => setShowToolpath(!showToolpath)}
              title="Show/hide toolpath"
              disabled={objects.length === 0}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                showToolpath
                  ? "bg-amber-500/15 border-amber-500/25 text-amber-300"
                  : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {showToolpath ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Toolpath</span>
            </button>
          </>
        )}

        <div className="flex-1" />

        {!isRollForming && !isAssembly && (
          <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
            {([
              { id: "properties" as const, icon: <Layers className="w-3 h-3" />, label: "Props" },
              { id: "modeling" as const, icon: <GitBranch className="w-3 h-3" />, label: "Modeling" },
              { id: "cam" as const, icon: <Wrench className="w-3 h-3" />, label: "CAM" },
              { id: "ai" as const, icon: <MessageSquare className="w-3 h-3" />, label: "AI" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  rightTab === tab.id
                    ? "bg-white/[0.08] text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`ml-2 px-2 py-0.5 rounded text-[9px] font-semibold border ${
          isAssembly
            ? "bg-purple-500/15 border-purple-500/25 text-purple-400"
            : isRollForming
              ? "bg-orange-500/15 border-orange-500/25 text-orange-400"
              : mode === "sketch"
                ? "bg-blue-500/15 border-blue-500/25 text-blue-400"
                : "bg-white/[0.03] border-white/[0.05] text-zinc-600"
        }`}>
          {isAssembly ? "ASSEMBLY" : isRollForming ? "ROLL FORMING" : mode === "sketch" ? "SKETCH" : "3D"}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {isAssembly ? (
          <AssemblyDesignView />
        ) : (
          <>
            {!isRollForming && (
              <div className="w-44 flex-shrink-0 border-r border-white/[0.06] bg-[#0b0b1a] flex flex-col overflow-hidden">
                <div className="flex items-center border-b border-white/[0.06]">
                  <button
                    onClick={() => setLeftTab("features")}
                    className={`flex-1 text-[10px] font-medium py-1.5 transition-all ${
                      leftTab === "features"
                        ? "text-zinc-200 bg-white/[0.04]"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    Features
                  </button>
                  <button
                    onClick={() => setLeftTab("scene")}
                    className={`flex-1 text-[10px] font-medium py-1.5 transition-all ${
                      leftTab === "scene"
                        ? "text-zinc-200 bg-white/[0.04]"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    Scene
                  </button>
                </div>
                {leftTab === "features" ? <FeatureTree /> : <SceneTree />}
              </div>
            )}

            <div className="flex-1 relative overflow-hidden">
              {isRollForming ? (
                <RollFormingViewport3D />
              ) : mode === "sketch" ? (
                <SketchCanvas />
              ) : (
                <Viewport3D showToolpath={showToolpath} />
              )}
            </div>

            {!isRollForming && (
              <div className="w-64 flex-shrink-0 border-l border-white/[0.06] bg-[#0b0b1a] flex flex-col overflow-hidden">
                {rightTab === "properties" && <PropertiesPanel />}
                {rightTab === "modeling" && <SolidModelingPanel />}
                {rightTab === "cam" && <CAMPanel />}
                {rightTab === "ai" && <AIChatPanel />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
