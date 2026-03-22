import React from "react";
import { use3DStudioStore } from "./use3DStudioStore";

function NumInput({
  label,
  value,
  onChange,
  step = 0.1,
  min = -100,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[9px] text-zinc-600 w-3 text-center font-bold">{label}</label>
      <input
        type="number"
        value={Number(value.toFixed(3))}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none focus:border-blue-500/40 min-w-0"
      />
    </div>
  );
}

function VecInput({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <div className="text-[10px] text-zinc-500 mb-1 font-medium">{label}</div>
      <div className="flex gap-1">
        {(["X", "Y", "Z"] as const).map((axis, i) => (
          <NumInput
            key={axis}
            label={axis}
            value={value[i]}
            step={step}
            min={min}
            max={max}
            onChange={(v) => {
              const next = [...value] as [number, number, number];
              next[i] = v;
              onChange(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function PropertiesPanel() {
  const { objects, selectedObjectId, updateObject } = use3DStudioStore();
  const obj = selectedObjectId ? objects.find((o) => o.id === selectedObjectId) : null;

  if (!obj) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-white/[0.06]">
          <span className="text-[11px] font-semibold text-zinc-400">Properties</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-zinc-700">Select an object</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold text-zinc-400">Properties</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1 font-medium">Name</label>
          <input
            type="text"
            value={obj.name}
            onChange={(e) => updateObject(obj.id, { name: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
          />
        </div>

        <VecInput
          label="Position"
          value={obj.position}
          step={0.1}
          min={-20}
          max={20}
          onChange={(v) => updateObject(obj.id, { position: v })}
        />

        <VecInput
          label="Scale"
          value={obj.scale}
          step={0.1}
          min={0.01}
          max={20}
          onChange={(v) => updateObject(obj.id, { scale: v })}
        />

        <VecInput
          label="Rotation (rad)"
          value={obj.rotation}
          step={0.1}
          min={-Math.PI * 2}
          max={Math.PI * 2}
          onChange={(v) => updateObject(obj.id, { rotation: v })}
        />

        <div>
          <label className="text-[10px] text-zinc-500 block mb-1 font-medium">Color</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={obj.color}
              onChange={(e) => updateObject(obj.id, { color: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
            />
            <span className="text-[10px] text-zinc-500 font-mono">{obj.color}</span>
          </div>
        </div>

        <div className="pt-1 border-t border-white/[0.06]">
          <div className="text-[9px] text-zinc-700 font-mono space-y-0.5">
            <div>Type: <span className="text-zinc-500">{obj.type}</span></div>
            <div>ID: <span className="text-zinc-600">{obj.id.slice(0, 8)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
