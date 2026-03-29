import React, { useState } from "react";
import type { RollToolingResult } from "../../store/useCncStore";

type BomCategory = "roll" | "shaft" | "spacer" | "keyway" | "hardware" | "bearing" | "collar";

const CAT_COLOR: Record<BomCategory, string> = {
  roll:     "text-blue-300 bg-blue-500/10 border-blue-500/20",
  shaft:    "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  spacer:   "text-amber-300 bg-amber-500/10 border-amber-500/20",
  keyway:   "text-violet-300 bg-violet-500/10 border-violet-500/20",
  hardware: "text-zinc-300 bg-zinc-500/10 border-zinc-500/20",
  bearing:  "text-pink-300 bg-pink-500/10 border-pink-500/20",
  collar:   "text-purple-300 bg-purple-500/10 border-purple-500/20",
};
const CAT_ICON: Record<BomCategory, string> = {
  roll: "⚙", shaft: "—", spacer: "◈", keyway: "⬣", hardware: "🔩", bearing: "◎", collar: "◉",
};

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(items: BomItem[]) {
  const header = "Item No,Description,Part Number,Material,Qty,Unit,Dimensions,Weight(kg),Category,Notes";
  const rows = items.map(i =>
    `${i.itemNo},"${i.description}","${i.partNumber}","${i.material}",${i.qty},"${i.unit}","${i.dimensions}",${i.weightKg},"${i.category}","${i.notes}"`
  );
  downloadFile([header, ...rows].join("\n"), "ROLL_TOOLING_BOM.csv");
}

function downloadTxt(items: BomItem[], totalWt: number, totalRolls: number, rollMat: string, shaftMat: string) {
  const lines = [
    "═══════════════════════════════════════════════════════════════",
    "  ROLL TOOLING — BILL OF MATERIALS (BOM)",
    `  Generated: ${new Date().toISOString().split("T")[0]}`,
    "═══════════════════════════════════════════════════════════════",
    `  Total Rolls  : ${totalRolls} nos`,
    `  Total Weight : ${totalWt.toFixed(1)} kg`,
    `  Roll Material: ${rollMat}`,
    `  Shaft Material: ${shaftMat}`,
    "",
    "ITEM  DESCRIPTION                              P/N            MAT            QTY  DIM                    WT(kg) NOTES",
    "─".repeat(130),
    ...items.map(i =>
      `${String(i.itemNo).padEnd(5)} ${i.description.padEnd(40)} ${i.partNumber.padEnd(14)} ${i.material.padEnd(14)} ${String(i.qty).padEnd(4)} ${i.dimensions.padEnd(22)} ${String(i.weightKg).padEnd(6)} ${i.notes}`
    ),
    "",
    `TOTAL WEIGHT: ${totalWt.toFixed(1)} kg`,
  ];
  downloadFile(lines.join("\n"), "ROLL_TOOLING_BOM.txt");
}

interface BomItem {
  itemNo: number;
  description: string;
  partNumber: string;
  material: string;
  qty: number;
  unit: string;
  dimensions: string;
  weightKg: number;
  category: BomCategory;
  notes: string;
}

// Generate BOM directly from store data (no API needed)
function buildBomFromStore(rollTooling: RollToolingResult[], shaftDia: number): {
  items: BomItem[];
  totalWeightKg: number;
  totalRolls: number;
  rollMaterial: string;
  shaftMaterial: string;
  summary: { category: string; qty: number; weightKg: number }[];
} {
  const items: BomItem[] = [];
  let itemNo = 1;
  const DENSITY = 7.85e-6; // kg/mm³

  const matType = rollTooling[0]?.mfgSpec?.rollMaterial?.includes("EN31")
    ? "SS" : rollTooling[0]?.mfgSpec?.rollMaterial?.includes("EN8") ? "AL" : "other";
  const rollMat = rollTooling[0]?.mfgSpec?.rollMaterial ?? "D2 Tool Steel";
  const shaftMat = "EN19 Alloy Steel (ground & polished)";

  for (const rt of rollTooling) {
    const rp = rt.rollProfile;
    if (!rp) continue;
    const spec = rt.mfgSpec;

    for (const [side, rollNum] of [["Upper", rp.upperRollNumber], ["Lower", rp.lowerRollNumber]] as [string, number][]) {
      const OD = rp.rollDiameter;
      const ID = rp.shaftDiameter;
      const W = rp.rollWidth;
      const blankOD = spec?.blankOD ?? Math.ceil(OD + 4);
      const vol = Math.PI / 4 * (OD * OD - ID * ID) * W;
      const wt = Math.round(vol * DENSITY * 1000) / 1000;
      const rollType = spec?.rollType === "split" ? "SPLIT" : "SOLID";
      items.push({
        itemNo: itemNo++,
        description: `Roll R${String(rollNum).padStart(3,"0")} — ${side} | ${rt.label} [${rollType}]`,
        partNumber: `ROLL-${String(rollNum).padStart(3,"0")}-${side[0]}`,
        material: rollMat,
        qty: 1, unit: "EA",
        dimensions: `Ø${blankOD}×Ø${ID.toFixed(1)}×W${W.toFixed(2)} mm`,
        weightKg: wt,
        category: "roll",
        notes: `${spec?.rollHardness ?? "58–62 HRC"} | ${spec?.surfaceTreatment ?? "TD coat"} | Bore: ${spec?.boreFit ?? "H7/k6"}`,
      });
    }

    // Shafts (upper + lower)
    const shaftLen = rp.rollWidth + 220;
    const shaftVol = Math.PI / 4 * shaftDia * shaftDia * shaftLen;
    const shaftWt = Math.round(shaftVol * DENSITY * 1000) / 1000;
    for (const side of ["Upper", "Lower"]) {
      items.push({
        itemNo: itemNo++,
        description: `Drive Shaft — ${side} | ${rt.label}`,
        partNumber: `SHAFT-ST${String(rt.stationNumber).padStart(2,"0")}-${side[0]}`,
        material: shaftMat,
        qty: 1, unit: "EA",
        dimensions: `Ø${shaftDia.toFixed(0)} k6 × L${shaftLen.toFixed(0)} mm`,
        weightKg: shaftWt,
        category: "shaft",
        notes: "Keyway milled, ends threaded for KM nut",
      });
    }

    // Spacer
    if (spec && spec.spacerThickness > 0) {
      const spOD = Math.round(shaftDia * 1.6);
      const spVol = Math.PI / 4 * (spOD * spOD - shaftDia * shaftDia) * spec.spacerThickness;
      const spWt = Math.round(spVol * DENSITY * 100) / 100;
      items.push({
        itemNo: itemNo++,
        description: `Roll Spacer — Station ${rt.stationNumber}`,
        partNumber: `SPACER-${String(rt.stationNumber).padStart(2,"0")}`,
        material: spec.spacerMaterial ?? "EN8",
        qty: 2, unit: "EA",
        dimensions: `Ø${spOD}×Ø${shaftDia}×T${spec.spacerThickness.toFixed(2)} mm`,
        weightKg: spWt,
        category: "spacer",
        notes: "Fit: h9 | Face ground | Both shaft sides",
      });
    }

    // Keyway key
    if (spec?.keyway) {
      items.push({
        itemNo: itemNo++,
        description: `Parallel Key DIN 6885 A — ${rt.label}`,
        partNumber: `KEY-${String(rt.stationNumber).padStart(2,"0")}`,
        material: "C45 key steel",
        qty: 4, unit: "EA",
        dimensions: `${spec.keyway.width}×${spec.keyway.depth}×${spec.keyway.length} mm`,
        weightKg: 0.08,
        category: "keyway",
        notes: "Fit: N9/h9 | Roll + shaft keyways",
      });
    }

    // Side Collar (auto-suggested per station — qty × 2 shafts: upper + lower)
    if (rp.sideCollar) {
      const collar = rp.sideCollar;
      const colVol = Math.PI / 4 * (collar.OD * collar.OD - collar.ID * collar.ID) * collar.width;
      // Rubber density ~1.2 kg/L, steel ~7.85 kg/L
      const colDensity = collar.material.toLowerCase().includes("rubber") ? 1.2e-6 : 7.85e-6;
      const colWt = Math.round(colVol * colDensity * 1000) / 1000;
      // collar.qty is per-roll (2 per roll); × 2 shafts (upper + lower) per station
      const collarQty = collar.qty * 2;
      items.push({
        itemNo: itemNo++,
        description: `Side Collar — ${rt.label} (${collar.material})`,
        partNumber: `COLLAR-ST${String(rt.stationNumber).padStart(2,"0")}`,
        material: collar.material,
        qty: collarQty, unit: "EA",
        dimensions: `Ø${collar.OD}×Ø${collar.ID}×W${collar.width} mm`,
        weightKg: colWt,
        category: "collar",
        notes: `Hardness: ${collar.hardness} | ${collar.notes}`,
      });
    }
  }

  const nSt = rollTooling.length;
  const shaftD = rollTooling[0]?.rollProfile?.shaftDiameter ?? shaftDia;
  const brgCode = shaftD <= 40 ? "6208" : shaftD <= 50 ? "6210" : "6212";
  items.push({
    itemNo: itemNo++, description: `Deep Groove Bearing SKF ${brgCode} (2RS)`,
    partNumber: `BRG-SKF${brgCode}`, material: "GCr15 chrome steel",
    qty: nSt * 4, unit: "EA",
    dimensions: `${brgCode} — see SKF catalogue`,
    weightKg: 0.28, category: "bearing",
    notes: "Sealed both sides, grease-lubricated",
  });

  items.push({
    itemNo: itemNo++, description: "Locking Nut KM + Lock Washer MB",
    partNumber: `NUT-KM${shaftD >= 45 ? 9 : 8}`,
    material: "Alloy steel 10.9",
    qty: nSt * 4, unit: "SET",
    dimensions: `M${shaftD.toFixed(0)}×P1.5`,
    weightKg: 0.12, category: "hardware",
    notes: "Roll shaft end retention",
  });

  items.push({
    itemNo: itemNo++, description: "Roll Clamping Bolt M12×80 Gr 10.9 + Spring Washer",
    partNumber: "BOLT-M12-80-GR10",
    material: "Grade 10.9 alloy steel",
    qty: nSt * 8, unit: "EA",
    dimensions: "M12×80 mm hex head",
    weightKg: 0.07, category: "hardware",
    notes: "Roll-to-shaft clamping",
  });

  const totalWeightKg = Math.round(items.reduce((s, i) => s + i.weightKg * i.qty, 0) * 10) / 10;
  const catMap = new Map<string, { qty: number; weightKg: number }>();
  for (const item of items) {
    const ex = catMap.get(item.category) ?? { qty: 0, weightKg: 0 };
    catMap.set(item.category, { qty: ex.qty + item.qty, weightKg: Math.round((ex.weightKg + item.weightKg * item.qty) * 100) / 100 });
  }
  const summary = Array.from(catMap.entries()).map(([category, d]) => ({ category, ...d }));
  return { items, totalWeightKg, totalRolls: nSt * 2, rollMaterial: rollMat, shaftMaterial: shaftMat, summary };
}

export function BomView({ rollTooling }: { rollTooling: RollToolingResult[] }) {
  const shaftDia = rollTooling[0]?.rollProfile?.shaftDiameter ?? 40;
  const [filterCat, setFilterCat] = useState<BomCategory | "all">("all");
  const [showNotes, setShowNotes] = useState(false);

  if (rollTooling.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
        <div className="text-4xl mb-3">📋</div>
        <div className="text-sm font-semibold text-zinc-500">BOM nahi bani abhi</div>
        <div className="text-xs mt-1">Pehle Roll Tooling generate karein</div>
      </div>
    );
  }

  const { items, totalWeightKg, totalRolls, rollMaterial, shaftMaterial, summary } = buildBomFromStore(rollTooling, shaftDia);
  const filtered = filterCat === "all" ? items : items.filter(i => i.category === filterCat);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-zinc-200">Bill of Materials (BOM)</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {items.length} line items · {totalRolls} rolls · {totalWeightKg.toFixed(1)} kg total
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadCsv(filtered)}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 transition-all"
          >⬇ CSV</button>
          <button
            onClick={() => downloadTxt(items, totalWeightKg, totalRolls, rollMaterial, shaftMaterial)}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all"
          >⬇ TXT Report</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {summary.map(s => {
          const cat = s.category as BomCategory;
          return (
            <button
              key={s.category}
              onClick={() => setFilterCat(filterCat === cat ? "all" : cat)}
              className={`border rounded-xl p-2.5 text-left transition-all ${
                filterCat === cat ? CAT_COLOR[cat] + " border-opacity-50" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{CAT_ICON[cat]}</span>
                <span className="text-[11px] font-semibold text-zinc-300 capitalize">{s.category}</span>
              </div>
              <div className="text-[10px] text-zinc-500">{s.qty} pcs · {s.weightKg.toFixed(1)} kg</div>
            </button>
          );
        })}
        <div className="border border-white/[0.07] rounded-xl p-2.5 bg-white/[0.015]">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Total Weight</div>
          <div className="text-lg font-bold text-zinc-100">{totalWeightKg.toFixed(1)} <span className="text-xs text-zinc-500">kg</span></div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-600">Filter:</span>
        {(["all", "roll", "shaft", "spacer", "keyway", "hardware", "bearing", "collar"] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat as BomCategory | "all")}
            className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all border ${
              filterCat === cat
                ? "bg-zinc-200 text-zinc-900 border-zinc-200"
                : "bg-transparent text-zinc-600 border-white/[0.06] hover:text-zinc-300"
            }`}
          >{cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}</button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
          <input type="checkbox" checked={showNotes} onChange={e => setShowNotes(e.target.checked)} className="w-3 h-3" />
          Show Notes
        </label>
      </div>

      {/* BOM Table */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.015]">
                {["#", "Description", "P/N", "Material", "Qty", "Dimensions", "Wt/ea (kg)", "Cat", ...(showNotes ? ["Notes"] : [])].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] text-zinc-600 font-semibold uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const cc = CAT_COLOR[item.category];
                return (
                  <tr key={item.itemNo} className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-2.5 py-1.5 text-zinc-600">{item.itemNo}</td>
                    <td className="px-2.5 py-1.5 text-zinc-200 font-sans">{item.description}</td>
                    <td className="px-2.5 py-1.5 text-blue-400">{item.partNumber}</td>
                    <td className="px-2.5 py-1.5 text-zinc-400 font-sans">{item.material}</td>
                    <td className="px-2.5 py-1.5 text-emerald-400 font-bold">{item.qty} {item.unit}</td>
                    <td className="px-2.5 py-1.5 text-zinc-300 whitespace-nowrap">{item.dimensions}</td>
                    <td className="px-2.5 py-1.5 text-amber-400">{item.weightKg}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cc}`}>
                        {CAT_ICON[item.category]} {item.category}
                      </span>
                    </td>
                    {showNotes && <td className="px-2.5 py-1.5 text-zinc-600 font-sans text-[10px] max-w-xs">{item.notes}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/[0.08] bg-white/[0.03]">
                <td colSpan={4} className="px-2.5 py-2 text-[10px] text-zinc-500 font-sans font-semibold">
                  TOTAL ({filtered.length} line items)
                </td>
                <td className="px-2.5 py-2 text-emerald-400 font-bold">
                  {filtered.reduce((s, i) => s + i.qty, 0)}
                </td>
                <td />
                <td className="px-2.5 py-2 text-amber-400 font-bold">
                  {filtered.reduce((s, i) => s + i.weightKg * i.qty, 0).toFixed(2)} kg
                </td>
                <td />
                {showNotes && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Material summary */}
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-2">Roll Material</div>
          <div className="font-semibold text-zinc-200">{rollMaterial}</div>
          <div className="text-zinc-600 mt-1">Hardened to 58–62 HRC, TD/PVD coated</div>
        </div>
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wide mb-2">Shaft Material</div>
          <div className="font-semibold text-zinc-200">{shaftMaterial}</div>
          <div className="text-zinc-600 mt-1">Ground & polished, keyway milled</div>
        </div>
      </div>
    </div>
  );
}
