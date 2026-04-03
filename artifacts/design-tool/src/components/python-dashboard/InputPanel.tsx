import { useState } from "react";
import type { ManualModePayload } from "@/services/pythonApi";

const MATERIALS = ["GI", "GP", "CR", "HR", "MS", "SS", "AL", "CU", "HSLA", "TI", "PP"];
const PROFILES = [
  "c_channel",
  "simple_channel",
  "z_purlin",
  "lipped_channel",
  "hat_section",
  "angle_section",
  "box_section",
  "complex_section",
  "shutter_profile",
];

const PROFILE_LABELS: Record<string, string> = {
  c_channel:       "C-section / Channel",
  simple_channel:  "Simple Channel / U",
  z_purlin:        "Z-section / Z-Purlin",
  lipped_channel:  "Lipped Channel (C+lips)",
  hat_section:     "Hat / Omega Section",
  angle_section:   "Simple Angle (L)",
  box_section:     "Box / Hollow Section",
  complex_section: "Complex / Multi-bend",
  shutter_profile: "Shutter / Roller Door",
};

interface Props {
  onRun: (payload: ManualModePayload) => void;
  loading: boolean;
}

export function InputPanel({ onRun, loading }: Props) {
  const [form, setForm] = useState<ManualModePayload>({
    bend_count:        2,
    section_width_mm:  60,
    section_height_mm: 40,
    thickness:         1.5,
    material:          "GI",
    profile_type:      "c_channel",
    return_bends_count: 0,
    lips_present:      false,
  });

  function set<K extends keyof ManualModePayload>(key: K, value: ManualModePayload[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Manual Mode Input</div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-gray-500">Profile Type</span>
          <select
            value={form.profile_type}
            onChange={e => set("profile_type", e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          >
            {PROFILES.map(p => (
              <option key={p} value={p}>{PROFILE_LABELS[p] ?? p}</option>
            ))}
          </select>
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
          <span className="text-[10px] text-gray-500">Thickness (mm)</span>
          <input
            type="number" min={0.3} max={6} step={0.05}
            value={form.thickness}
            onChange={e => set("thickness", Number(e.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          />
        </label>

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
          <span className="text-[10px] text-gray-500">Return Bends</span>
          <input
            type="number" min={0} max={6}
            value={form.return_bends_count ?? 0}
            onChange={e => set("return_bends_count", Number(e.target.value))}
            className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500"
          />
        </label>

        <label className="flex items-center gap-2 col-span-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.lips_present ?? false}
            onChange={e => set("lips_present", e.target.checked)}
            className="w-4 h-4 rounded accent-violet-500"
          />
          <span className="text-sm text-gray-300">Lips / stiffeners present</span>
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
