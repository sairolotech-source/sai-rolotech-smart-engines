import React from "react";
import {
  Box, Cylinder, Circle, Triangle, Layers, Trash2,
  Plus, Minus, Hexagon, RotateCcw, Spline, Blend,
} from "lucide-react";
import { use3DStudioStore } from "./use3DStudioStore";
import type { SceneObject } from "./use3DStudioStore";

function getIcon(type: SceneObject["type"]) {
  switch (type) {
    case "box": return <Box className="w-3 h-3" />;
    case "cylinder": return <Cylinder className="w-3 h-3" />;
    case "sphere": return <Circle className="w-3 h-3" />;
    case "cone": return <Triangle className="w-3 h-3" />;
    case "extrude": return <Layers className="w-3 h-3" />;
    case "csg_result": return <Plus className="w-3 h-3" />;
    case "revolve": return <RotateCcw className="w-3 h-3" />;
    case "sweep": return <Spline className="w-3 h-3" />;
    case "loft": return <Blend className="w-3 h-3" />;
    case "shell": return <Circle className="w-3 h-3" />;
    case "fillet": return <Circle className="w-3 h-3" />;
    case "chamfer": return <Triangle className="w-3 h-3" />;
    default: return <Box className="w-3 h-3" />;
  }
}

function ObjectRow({ obj }: { obj: SceneObject }) {
  const { selectedObjectId, selectObject, deleteObject, secondarySelectionId, setSecondarySelection } = use3DStudioStore();
  const isSelected = selectedObjectId === obj.id;
  const isSecondary = secondarySelectionId === obj.id;

  return (
    <div
      onClick={(e) => {
        if (e.shiftKey) {
          setSecondarySelection(obj.id);
        } else {
          selectObject(obj.id);
        }
      }}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-[11px] ${
        isSelected
          ? "bg-blue-500/15 border border-blue-500/25 text-blue-300"
          : isSecondary
            ? "bg-green-500/15 border border-green-500/25 text-green-300"
            : "hover:bg-white/[0.03] border border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      <span className="flex-shrink-0" style={{ color: obj.color }}>{getIcon(obj.type)}</span>
      <span className="flex-1 truncate font-medium">{obj.name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); deleteObject(obj.id); }}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all flex-shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export function SceneTree() {
  const { objects } = use3DStudioStore();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Layers className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[11px] font-semibold text-zinc-400">Scene Tree</span>
        <span className="ml-auto text-[10px] text-zinc-600">{objects.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {objects.length === 0 && (
          <div className="text-[10px] text-zinc-700 text-center py-8 leading-relaxed">
            No objects yet.
            <br />Use toolbar to add shapes.
          </div>
        )}
        {objects.map((obj) => (
          <ObjectRow key={obj.id} obj={obj} />
        ))}
      </div>

      <div className="px-3 py-2 border-t border-white/[0.06]">
        <div className="text-[9px] text-zinc-700">
          Shift+Click to select 2nd object for CSG
        </div>
      </div>
    </div>
  );
}
