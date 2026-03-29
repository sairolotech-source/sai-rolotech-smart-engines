import { useState } from "react";
import type { ManualModePayload } from "@/services/pythonApi";

const MATERIALS = ["GI", "GP", "CR", "HR", "MS", "SS", "ALUMINIUM"];
const PROFILES = ["simple_channel", "lipped_channel", "shutter_profile", "complex_profile"];

interface Props {
  onRun: (payload: ManualModePayload) => void;
  loading: boolean;
}

export function InputPanel({ onRun, loading }: Props) {
  const [form, setForm] = useState<ManualModePayload>({
    bend_count: 6,
    section_width_mm: 120,
    section_height_mm: 55,
    thickness: 1.0,
    material: "CR",
    profile_type: "lipped_channel",
  });

  function set(key: keyof ManualModePayload, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Manual Mode Input</div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Bend Count</span>
          <input
            type="number" min={1} max={20}
            value={form.bend_count}
            onChange={e => set("bend_count", Number(e.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Width (mm)</span>
          <input
            type="number" min={10}
            value={form.section_width_mm}
            onChange={e => set("section_width_mm", Number(e.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Height (mm)</span>
          <input
            type="number" min={5}
            value={form.section_height_mm}
            onChange={e => set("section_height_mm", Number(e.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Thickness (mm)</span>
          <input
            type="number" min={0.3} max={4} step={0.05}
            value={form.thickness}
            onChange={e => set("thickness", Number(e.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Material</span>
          <select
            value={form.material}
            onChange={e => set("material", e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          >
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Profile Type</span>
          <select
            value={form.profile_type}
            onChange={e => set("profile_type", e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          >
            {PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <button
        onClick={() => onRun(form)}
        disabled={loading}
        className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2 transition-colors"
      >
        {loading ? "Running…" : "Run Pipeline"}
      </button>
    </div>
  );
}
