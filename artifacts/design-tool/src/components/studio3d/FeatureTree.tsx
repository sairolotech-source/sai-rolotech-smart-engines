import React from "react";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
  Box,
  Cylinder,
  Circle,
  Triangle,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Spline,
  Blend,
  Shell,
  Radius,
  Hexagon,
} from "lucide-react";
import { use3DStudioStore } from "./use3DStudioStore";
import type { FeatureNode, FeatureType } from "./use3DStudioStore";

function getFeatureIcon(type: FeatureType) {
  switch (type) {
    case "primitive":
      return <Box className="w-3 h-3" />;
    case "extrude":
      return <Layers className="w-3 h-3" />;
    case "csg_union":
      return <Plus className="w-3 h-3" />;
    case "csg_subtract":
      return <Minus className="w-3 h-3" />;
    case "csg_intersect":
      return <Hexagon className="w-3 h-3" />;
    case "revolve":
      return <RotateCcw className="w-3 h-3" />;
    case "sweep":
      return <Spline className="w-3 h-3" />;
    case "loft":
      return <Blend className="w-3 h-3" />;
    case "shell":
      return <Circle className="w-3 h-3" />;
    case "fillet":
      return <Circle className="w-3 h-3" />;
    case "chamfer":
      return <Triangle className="w-3 h-3" />;
    default:
      return <Box className="w-3 h-3" />;
  }
}

function getFeatureColor(type: FeatureType): string {
  switch (type) {
    case "primitive":
      return "#4488ff";
    case "extrude":
      return "#6688ff";
    case "csg_union":
      return "#44ff88";
    case "csg_subtract":
      return "#ff4444";
    case "csg_intersect":
      return "#ffaa44";
    case "revolve":
      return "#88aaff";
    case "sweep":
      return "#aa88ff";
    case "loft":
      return "#ffaa88";
    case "shell":
      return "#88ffaa";
    case "fillet":
      return "#ff88aa";
    case "chamfer":
      return "#aaff88";
    default:
      return "#888888";
  }
}

function FeatureRow({ feature, index, total }: { feature: FeatureNode; index: number; total: number }) {
  const {
    selectedObjectId,
    selectObject,
    toggleFeature,
    deleteFeature,
    reorderFeature,
  } = use3DStudioStore();

  const isSelected = selectedObjectId === feature.objectId;
  const color = getFeatureColor(feature.type);

  return (
    <div
      onClick={() => selectObject(feature.objectId)}
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all text-[11px] ${
        isSelected
          ? "bg-blue-500/15 border border-blue-500/25 text-blue-300"
          : "hover:bg-white/[0.03] border border-transparent text-zinc-400 hover:text-zinc-200"
      }`}
    >
      <span className="flex-shrink-0" style={{ color }}>
        {getFeatureIcon(feature.type)}
      </span>
      <span className="flex-1 truncate font-medium text-[10px]">
        {feature.name}
      </span>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFeature(feature.id);
          }}
          className="text-zinc-500 hover:text-zinc-300 p-0.5"
          title={feature.enabled ? "Disable" : "Enable"}
        >
          {feature.enabled ? (
            <Eye className="w-2.5 h-2.5" />
          ) : (
            <EyeOff className="w-2.5 h-2.5" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            reorderFeature(feature.id, "up");
          }}
          disabled={index === 0}
          className="text-zinc-500 hover:text-zinc-300 p-0.5 disabled:opacity-30"
          title="Move up"
        >
          <ChevronUp className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            reorderFeature(feature.id, "down");
          }}
          disabled={index === total - 1}
          className="text-zinc-500 hover:text-zinc-300 p-0.5 disabled:opacity-30"
          title="Move down"
        >
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            deleteFeature(feature.id);
          }}
          className="text-red-500 hover:text-red-400 p-0.5"
          title="Delete"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

export function FeatureTree() {
  const { featureTree } = use3DStudioStore();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
        <Layers className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[11px] font-semibold text-zinc-400">
          Feature Tree
        </span>
        <span className="ml-auto text-[10px] text-zinc-600">
          {featureTree.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {featureTree.length === 0 && (
          <div className="text-[10px] text-zinc-700 text-center py-8 leading-relaxed">
            No features yet.
            <br />
            Add shapes or apply operations.
          </div>
        )}
        {featureTree.map((feature, idx) => (
          <FeatureRow
            key={feature.id}
            feature={feature}
            index={idx}
            total={featureTree.length}
          />
        ))}
      </div>

      {featureTree.length > 0 && (
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <div className="text-[9px] text-zinc-700 font-mono leading-relaxed">
            {featureTree.filter((f) => f.enabled).length} active /{" "}
            {featureTree.length} total features
          </div>
        </div>
      )}
    </div>
  );
}
