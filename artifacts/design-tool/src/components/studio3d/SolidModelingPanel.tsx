import React, { useState } from "react";
import { use3DStudioStore } from "./use3DStudioStore";

type ModelingTool = "revolve" | "sweep" | "loft" | "shell" | "fillet" | "chamfer";

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
      {label}
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-zinc-500 block mb-0.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="text-[10px] text-zinc-500 block mb-0.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step || 0.1}
        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
      />
    </div>
  );
}

function RevolvePanel() {
  const { addRevolve } = use3DStudioStore();
  const [profileType, setProfileType] = useState<"rect" | "circle" | "l-shape">("rect");
  const [profileSize, setProfileSize] = useState(1);
  const [axis, setAxis] = useState<"x" | "y">("y");
  const [angle, setAngle] = useState(360);

  return (
    <div className="space-y-2">
      <SectionHeader label="Revolve" />
      <SelectInput
        label="Profile"
        value={profileType}
        options={[
          { value: "rect", label: "Rectangle" },
          { value: "circle", label: "Circle" },
          { value: "l-shape", label: "L-Shape" },
        ]}
        onChange={(v) => setProfileType(v as "rect" | "circle" | "l-shape")}
      />
      <NumberInput
        label="Profile Size"
        value={profileSize}
        onChange={setProfileSize}
        min={0.1}
        max={10}
        step={0.1}
      />
      <SelectInput
        label="Axis"
        value={axis}
        options={[
          { value: "y", label: "Y Axis" },
          { value: "x", label: "X Axis" },
        ]}
        onChange={(v) => setAxis(v as "x" | "y")}
      />
      <NumberInput
        label="Angle (°)"
        value={angle}
        onChange={setAngle}
        min={1}
        max={360}
        step={1}
      />
      <button
        onClick={() => addRevolve({ profileType, profileSize, axis, angle })}
        className="w-full py-1.5 rounded text-[11px] font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-all"
      >
        Create Revolve
      </button>
    </div>
  );
}

function SweepPanel() {
  const { addSweep } = use3DStudioStore();
  const [profileType, setProfileType] = useState<"rect" | "circle" | "l-shape">("circle");
  const [profileSize, setProfileSize] = useState(0.5);
  const [pathType, setPathType] = useState<"line" | "arc" | "helix">("arc");
  const [pathLength, setPathLength] = useState(5);

  return (
    <div className="space-y-2">
      <SectionHeader label="Sweep" />
      <SelectInput
        label="Profile"
        value={profileType}
        options={[
          { value: "rect", label: "Rectangle" },
          { value: "circle", label: "Circle" },
          { value: "l-shape", label: "L-Shape" },
        ]}
        onChange={(v) => setProfileType(v as "rect" | "circle" | "l-shape")}
      />
      <NumberInput
        label="Profile Size"
        value={profileSize}
        onChange={setProfileSize}
        min={0.1}
        max={5}
        step={0.1}
      />
      <SelectInput
        label="Path"
        value={pathType}
        options={[
          { value: "line", label: "Straight Line" },
          { value: "arc", label: "Arc" },
          { value: "helix", label: "Helix" },
        ]}
        onChange={(v) => setPathType(v as "line" | "arc" | "helix")}
      />
      <NumberInput
        label="Path Length"
        value={pathLength}
        onChange={setPathLength}
        min={1}
        max={20}
        step={0.5}
      />
      <button
        onClick={() => addSweep({ profileType, profileSize, pathType, pathLength })}
        className="w-full py-1.5 rounded text-[11px] font-semibold bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-all"
      >
        Create Sweep
      </button>
    </div>
  );
}

function LoftPanel() {
  const { addLoft } = use3DStudioStore();
  const [profile1Type, setProfile1Type] = useState<"rect" | "circle">("rect");
  const [profile1Size, setProfile1Size] = useState(2);
  const [profile2Type, setProfile2Type] = useState<"rect" | "circle">("circle");
  const [profile2Size, setProfile2Size] = useState(1);
  const [height, setHeight] = useState(3);

  return (
    <div className="space-y-2">
      <SectionHeader label="Loft" />
      <div className="text-[9px] text-zinc-600 mb-1">Bottom Profile</div>
      <SelectInput
        label="Shape"
        value={profile1Type}
        options={[
          { value: "rect", label: "Rectangle" },
          { value: "circle", label: "Circle" },
        ]}
        onChange={(v) => setProfile1Type(v as "rect" | "circle")}
      />
      <NumberInput
        label="Size"
        value={profile1Size}
        onChange={setProfile1Size}
        min={0.5}
        max={10}
        step={0.5}
      />
      <div className="text-[9px] text-zinc-600 mb-1 mt-2">Top Profile</div>
      <SelectInput
        label="Shape"
        value={profile2Type}
        options={[
          { value: "rect", label: "Rectangle" },
          { value: "circle", label: "Circle" },
        ]}
        onChange={(v) => setProfile2Type(v as "rect" | "circle")}
      />
      <NumberInput
        label="Size"
        value={profile2Size}
        onChange={setProfile2Size}
        min={0.5}
        max={10}
        step={0.5}
      />
      <NumberInput
        label="Height"
        value={height}
        onChange={setHeight}
        min={0.5}
        max={20}
        step={0.5}
      />
      <button
        onClick={() =>
          addLoft({ profile1Type, profile1Size, profile2Type, profile2Size, height })
        }
        className="w-full py-1.5 rounded text-[11px] font-semibold bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 transition-all"
      >
        Create Loft
      </button>
    </div>
  );
}

function ShellPanel() {
  const { applyShell, selectedObjectId } = use3DStudioStore();
  const [thickness, setThickness] = useState(0.1);

  return (
    <div className="space-y-2">
      <SectionHeader label="Shell" />
      <NumberInput
        label="Wall Thickness"
        value={thickness}
        onChange={setThickness}
        min={0.01}
        max={2}
        step={0.01}
      />
      <button
        onClick={() => applyShell(thickness)}
        disabled={!selectedObjectId}
        className="w-full py-1.5 rounded text-[11px] font-semibold bg-teal-500/20 border border-teal-500/30 text-teal-300 hover:bg-teal-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        Apply Shell
      </button>
      <div className="text-[9px] text-zinc-600">
        Select an object first, then apply shell to hollow it out.
      </div>
    </div>
  );
}

function FilletChamferPanel() {
  const { applyFillet, applyChamfer, selectedObjectId } = use3DStudioStore();
  const [filletRadius, setFilletRadius] = useState(0.1);
  const [chamferDistance, setChamferDistance] = useState(0.1);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <SectionHeader label="Fillet" />
        <NumberInput
          label="Radius"
          value={filletRadius}
          onChange={setFilletRadius}
          min={0.01}
          max={2}
          step={0.01}
        />
        <button
          onClick={() => applyFillet(filletRadius)}
          disabled={!selectedObjectId}
          className="w-full py-1.5 rounded text-[11px] font-semibold bg-pink-500/20 border border-pink-500/30 text-pink-300 hover:bg-pink-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Apply Fillet
        </button>
      </div>

      <div className="border-t border-white/[0.06] pt-3 space-y-2">
        <SectionHeader label="Chamfer" />
        <NumberInput
          label="Distance"
          value={chamferDistance}
          onChange={setChamferDistance}
          min={0.01}
          max={2}
          step={0.01}
        />
        <button
          onClick={() => applyChamfer(chamferDistance)}
          disabled={!selectedObjectId}
          className="w-full py-1.5 rounded text-[11px] font-semibold bg-lime-500/20 border border-lime-500/30 text-lime-300 hover:bg-lime-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          Apply Chamfer
        </button>
      </div>
      <div className="text-[9px] text-zinc-600">
        Select an object first, then apply fillet or chamfer to round or bevel edges.
      </div>
    </div>
  );
}

const TOOLS: { id: ModelingTool; label: string; color: string }[] = [
  { id: "revolve", label: "Revolve", color: "blue" },
  { id: "sweep", label: "Sweep", color: "purple" },
  { id: "loft", label: "Loft", color: "orange" },
  { id: "shell", label: "Shell", color: "teal" },
  { id: "fillet", label: "Fillet/Chamfer", color: "pink" },
];

export function SolidModelingPanel() {
  const [activeTool, setActiveTool] = useState<ModelingTool>("revolve");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold text-zinc-400">
          Solid Modeling
        </span>
      </div>

      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-white/[0.06]">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={`px-2 py-1 rounded text-[10px] font-medium border transition-all ${
              activeTool === tool.id
                ? `bg-${tool.color}-500/20 border-${tool.color}-500/30 text-${tool.color}-300`
                : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            }`}
            style={
              activeTool === tool.id
                ? {
                    backgroundColor: `color-mix(in srgb, ${tool.color === "blue" ? "#3b82f6" : tool.color === "purple" ? "#a855f7" : tool.color === "orange" ? "#f97316" : tool.color === "teal" ? "#14b8a6" : "#ec4899"} 20%, transparent)`,
                    borderColor: `color-mix(in srgb, ${tool.color === "blue" ? "#3b82f6" : tool.color === "purple" ? "#a855f7" : tool.color === "orange" ? "#f97316" : tool.color === "teal" ? "#14b8a6" : "#ec4899"} 30%, transparent)`,
                  }
                : {}
            }
          >
            {tool.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {activeTool === "revolve" && <RevolvePanel />}
        {activeTool === "sweep" && <SweepPanel />}
        {activeTool === "loft" && <LoftPanel />}
        {activeTool === "shell" && <ShellPanel />}
        {activeTool === "fillet" && <FilletChamferPanel />}
      </div>

      <div className="px-3 py-2 border-t border-white/[0.06]">
        <div className="text-[9px] text-zinc-700 leading-relaxed">
          CSG: Use toolbar Union/Subtract/Intersect buttons.
          <br />
          Select primary object, then Shift+Click second object.
        </div>
      </div>
    </div>
  );
}
