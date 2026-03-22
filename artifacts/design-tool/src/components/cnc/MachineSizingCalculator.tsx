import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type MaterialType = "GI" | "CR" | "HR" | "SS" | "AL" | "MS" | "CU" | "TI" | "PP" | "HSLA";

const MATERIAL_OPTIONS: { value: MaterialType; label: string }[] = [
  { value: "GI", label: "GI — Galvanized Iron" },
  { value: "CR", label: "CR — Cold Rolled" },
  { value: "HR", label: "HR — Hot Rolled" },
  { value: "SS", label: "SS — Stainless Steel" },
  { value: "AL", label: "AL — Aluminium" },
  { value: "MS", label: "MS — Mild Steel" },
  { value: "CU", label: "CU — Copper" },
  { value: "TI", label: "TI — Titanium" },
  { value: "PP", label: "PP — Pre-Painted Steel" },
  { value: "HSLA", label: "HSLA — High-Strength Low-Alloy" },
];

const THICKNESS_REFERENCE: { thickness: number; rollDia: number; shaftDia: number }[] = [
  { thickness: 0.5, rollDia: 50, shaftDia: 25 },
  { thickness: 0.8, rollDia: 55, shaftDia: 28 },
  { thickness: 1.0, rollDia: 60, shaftDia: 30 },
  { thickness: 1.2, rollDia: 65, shaftDia: 32 },
  { thickness: 1.5, rollDia: 80, shaftDia: 40 },
  { thickness: 2.0, rollDia: 100, shaftDia: 50 },
  { thickness: 2.5, rollDia: 120, shaftDia: 55 },
  { thickness: 3.0, rollDia: 140, shaftDia: 60 },
  { thickness: 4.0, rollDia: 170, shaftDia: 75 },
  { thickness: 5.0, rollDia: 200, shaftDia: 90 },
  { thickness: 6.0, rollDia: 250, shaftDia: 100 },
  { thickness: 8.0, rollDia: 300, shaftDia: 120 },
];

function getMotorClassification(kw: number): { label: string; color: string } {
  if (kw <= 5) return { label: "Light", color: "text-green-400" };
  if (kw <= 15) return { label: "Medium", color: "text-amber-400" };
  return { label: "Heavy", color: "text-red-400" };
}

function getShaftMaterial(shaftDia: number): string {
  if (shaftDia <= 50) return "EN8";
  return "EN19";
}

export function MachineSizingCalculator() {
  const [thickness, setThickness] = useState(1.5);
  const [numStands, setNumStands] = useState(6);
  const [material, setMaterial] = useState<MaterialType>("GI");
  const [refTableExpanded, setRefTableExpanded] = useState(false);

  const results = useMemo(() => {
    const rawRollDia = Math.round(40 * thickness);
    const rollDia = Math.max(50, rawRollDia);
    const rollDiaMin = Math.max(50, Math.round(38 * thickness));
    const rollDiaMax = Math.max(50, Math.round(42 * thickness));

    const shaftDia = Math.max(25, Math.round(0.48 * rollDia));

    const thicknessFactor = thickness <= 1.5 ? 1.0 : thickness <= 3.0 ? 1.3 : 1.6;
    const materialMultiplier: Record<MaterialType, number> = {
      GI: 1.0, CR: 1.0, HR: 1.2, SS: 1.5, AL: 0.7, MS: 1.0, CU: 0.6, TI: 1.8, PP: 1.0, HSLA: 1.4,
    };
    const basePowerPerStand = 1.75;
    const totalPower = parseFloat(
      (basePowerPerStand * numStands * thicknessFactor * materialMultiplier[material]).toFixed(2)
    );

    const motorClass = getMotorClassification(totalPower);
    const shaftMaterial = getShaftMaterial(shaftDia);

    return {
      rollDia,
      rollDiaMin,
      rollDiaMax,
      shaftDia,
      totalPower,
      motorClass,
      shaftMaterial,
    };
  }, [thickness, numStands, material]);

  const inputCls =
    "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">
            Thickness (mm)
          </label>
          <input
            type="number"
            min={0.3}
            max={10}
            step={0.1}
            value={thickness}
            onChange={(e) =>
              setThickness(Math.max(0.1, parseFloat(e.target.value) || 1))
            }
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block mb-0.5">
            No. of Stands
          </label>
          <input
            type="number"
            min={1}
            max={40}
            step={1}
            value={numStands}
            onChange={(e) =>
              setNumStands(Math.max(1, parseInt(e.target.value) || 1))
            }
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-zinc-500 block mb-0.5">
          Material Type
        </label>
        <div className="grid grid-cols-2 gap-1">
          {MATERIAL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMaterial(opt.value)}
              className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-all text-left ${
                material === opt.value
                  ? "bg-amber-900/60 border-amber-600 text-amber-300"
                  : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
              }`}
            >
              {opt.value}
              {opt.value === "SS" && (
                <span className="ml-1 text-[9px] font-normal text-red-400">
                  1.5×
                </span>
              )}
            </button>
          ))}
        </div>
        {material === "SS" && (
          <div className="mt-1.5 text-[10px] text-red-400 bg-red-950/30 border border-red-800/50 rounded px-2 py-1">
            ⚠ Stainless Steel: 1.5× power multiplier applied
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
          Calculated Results
        </div>

        <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-400">Roll Diameter</span>
            <span className="text-lg font-black text-amber-300 font-mono">
              {results.rollDia} mm
            </span>
          </div>
          <div className="text-[10px] text-zinc-500">
            Formula: 40 × {thickness} mm
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-zinc-600">Range Band:</span>
            <span className="font-mono text-amber-400">
              {results.rollDiaMin} – {results.rollDiaMax} mm
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-cyan-800/40 bg-cyan-950/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-400">Shaft Diameter</span>
            <span className="text-lg font-black text-cyan-300 font-mono">
              {results.shaftDia} mm
            </span>
          </div>
          <div className="text-[10px] text-zinc-500">
            Formula: 0.5 × {results.rollDia} mm
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-zinc-600">Recommended Material:</span>
            <span className="font-mono font-bold text-cyan-400">
              {results.shaftMaterial}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-purple-800/40 bg-purple-950/20 p-2.5 space-y-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-400">Motor Power</span>
            <span className="text-lg font-black text-purple-300 font-mono">
              {results.totalPower} kW
            </span>
          </div>
          <div className="text-[10px] text-zinc-500">
            1.75 kW × {numStands} stands
            {material === "SS" ? " × 1.5 (SS)" : ""}
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-zinc-600">Classification:</span>
            <span className={`font-bold ${results.motorClass.color}`}>
              {results.motorClass.label}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
        <button
          onClick={() => setRefTableExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors"
        >
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            Reference Table
          </span>
          <span className="text-zinc-600">
            {refTableExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        </button>
        {refTableExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-800/20">
                  <th className="text-left px-2 py-1.5 text-zinc-500 font-semibold">
                    Thickness
                  </th>
                  <th className="text-right px-2 py-1.5 text-zinc-500 font-semibold">
                    Roll Dia
                  </th>
                  <th className="text-right px-2 py-1.5 text-zinc-500 font-semibold">
                    Shaft Dia
                  </th>
                </tr>
              </thead>
              <tbody>
                {THICKNESS_REFERENCE.map((row) => {
                  const isActive =
                    Math.abs(row.thickness - thickness) <
                    0.05 + (row.thickness === 0.5 ? 0.1 : 0);
                  return (
                    <tr
                      key={row.thickness}
                      onClick={() => setThickness(row.thickness)}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        isActive
                          ? "bg-amber-950/30 border-amber-800/30"
                          : "hover:bg-zinc-800/30"
                      }`}
                    >
                      <td
                        className={`px-2 py-1.5 font-mono ${
                          isActive ? "text-amber-300 font-bold" : "text-zinc-400"
                        }`}
                      >
                        {row.thickness} mm
                      </td>
                      <td
                        className={`px-2 py-1.5 font-mono text-right ${
                          isActive ? "text-amber-300 font-bold" : "text-zinc-400"
                        }`}
                      >
                        {row.rollDia} mm
                      </td>
                      <td
                        className={`px-2 py-1.5 font-mono text-right ${
                          isActive ? "text-cyan-300 font-bold" : "text-zinc-500"
                        }`}
                      >
                        {row.shaftDia} mm
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-2 py-1.5 text-[9px] text-zinc-600 italic border-t border-white/[0.04]">
              Click a row to apply that thickness. Roll Dia = 40×t, Shaft Dia = 0.5×Roll.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
