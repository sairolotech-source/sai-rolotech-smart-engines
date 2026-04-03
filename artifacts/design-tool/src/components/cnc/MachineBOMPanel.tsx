import React, { useState, useCallback } from "react";
import { useCncStore, MATERIAL_DATABASE } from "../../store/useCncStore";
import { Package, Download, RefreshCw, Loader2, ChevronDown, ChevronUp } from "lucide-react";

export interface BOMLineItem {
  no: number;
  description: string;
  spec: string;
  material: string;
  qty: number;
  unit: string;
  notes: string;
  category: "shaft" | "bearing" | "roll" | "motor" | "frame" | "guide" | "hardware";
}

export function generateBOM(store: ReturnType<typeof useCncStore.getState>): BOMLineItem[] {
  const { rollTooling, stations, materialType, materialThickness, rollDiameter, shaftDiameter, lineSpeed, numStations, motorPower, motorRPM } = store;

  const stationCount = Math.max(rollTooling.length, numStations, stations.length, 4);
  const matProps = MATERIAL_DATABASE[materialType as keyof typeof MATERIAL_DATABASE];
  const isHeavy = materialThickness >= 3.0;
  const isHighSpeed = lineSpeed >= 25;

  const items: BOMLineItem[] = [];
  let no = 1;

  // ── SHAFTS ─────────────────────────────────────────────────────────────────
  const shaftOD = shaftDiameter || 40;
  const shaftLen = 300 + stationCount * 5;
  items.push({
    no: no++, category: "shaft",
    description: "Upper Drive Shaft",
    spec: `Ø${shaftOD}mm × ${shaftLen}mm L, keyway ${shaftOD >= 50 ? "16×10" : "12×8"}mm`,
    material: "EN8 (AISI 1045) — HT 28-32 HRC",
    qty: stationCount, unit: "pcs",
    notes: "Ground finish to h6 tolerance. Keyway both ends.",
  });
  items.push({
    no: no++, category: "shaft",
    description: "Lower Idle Shaft",
    spec: `Ø${shaftOD}mm × ${shaftLen}mm L`,
    material: "EN8 (AISI 1045) — HT 28-32 HRC",
    qty: stationCount, unit: "pcs",
    notes: "Ground finish. Lower shaft — no keyway unless driven.",
  });

  // ── BEARINGS ──────────────────────────────────────────────────────────────
  const bearingType = shaftOD <= 30 ? "6206-2RS" : shaftOD <= 40 ? "6208-2RS" : shaftOD <= 50 ? "6210-2RS" : "6212-2RS";
  const bearingBrand = isHeavy ? "SKF (heavy duty)" : "FAG / NSK";
  items.push({
    no: no++, category: "bearing",
    description: "Shaft End Bearing — Deep Groove Ball",
    spec: `${bearingType}, Ø${shaftOD}mm ID, sealed`,
    material: `${bearingBrand}`,
    qty: stationCount * 4, unit: "pcs",
    notes: "2 per shaft end × 2 shafts per station. Grease lubricated, IP54 seal.",
  });
  const pillowType = shaftOD <= 40 ? "UCP208" : shaftOD <= 50 ? "UCP210" : "UCP212";
  items.push({
    no: no++, category: "bearing",
    description: "Plummer / Pillow Block Housing",
    spec: `${pillowType}, cast iron, for Ø${shaftOD}mm shaft`,
    material: "CI Grade 250, electrocoated",
    qty: stationCount * 4, unit: "pcs",
    notes: "Bolt pattern to match base frame. Grease nipple included.",
  });

  // ── ROLLS ──────────────────────────────────────────────────────────────────
  const rollMat = isHeavy ? "D2 Tool Steel (HRC 58-62)" : "D2 Tool Steel (HRC 55-60)";
  const rollOD = rollDiameter || 150;
  items.push({
    no: no++, category: "roll",
    description: "Upper Forming Roll Set",
    spec: `Ø${rollOD}mm OD × Ø${shaftOD}mm bore, per-station profile`,
    material: rollMat,
    qty: stationCount, unit: "sets",
    notes: "CNC turned to per-station flower geometry. TiN coated for wear resistance.",
  });
  items.push({
    no: no++, category: "roll",
    description: "Lower Forming Roll Set",
    spec: `Ø${rollOD}mm OD × Ø${shaftOD}mm bore, mating profile`,
    material: rollMat,
    qty: stationCount, unit: "sets",
    notes: "Matched pair to upper roll. Finish grind after heat treatment.",
  });
  items.push({
    no: no++, category: "roll",
    description: "Side Guide Roll (Vertical)",
    spec: `Ø60mm × 30mm wide, Ø${shaftOD - 5}mm bore`,
    material: "EN31 (AISI 52100) — HRC 60",
    qty: stationCount * 2, unit: "pcs",
    notes: "Adjustable lateral guide. Entry and mid-section stations.",
  });
  items.push({
    no: no++, category: "roll",
    description: "Spacer Ring / Collar",
    spec: `Ø${shaftOD + 20}mm OD × Ø${shaftOD}mm ID, width as required`,
    material: "1018 Mild Steel — stress relieved",
    qty: stationCount * 6, unit: "pcs",
    notes: "Position rolls on shaft. Width per station drawing.",
  });

  // ── MOTOR & DRIVE ──────────────────────────────────────────────────────────
  const kW = motorPower || Math.round(stationCount * 0.75 + materialThickness * 2);
  const rpm = motorRPM || 1440;
  items.push({
    no: no++, category: "motor",
    description: "Main Drive Motor",
    spec: `${kW} kW, ${rpm} RPM, 415V 3-phase 50Hz, TEFC IP55`,
    material: "IE2 / IE3 efficiency class",
    qty: 1, unit: "pcs",
    notes: `Flange mount. Matched to ${lineSpeed} m/min line speed. Add VFD for speed control.`,
  });
  items.push({
    no: no++, category: "motor",
    description: "Variable Frequency Drive (VFD)",
    spec: `${kW * 1.25} kW rated, 0–60Hz, RS485 Modbus`,
    material: "Siemens / ABB / Delta",
    qty: 1, unit: "pcs",
    notes: "Provides line speed control 5–100%. EMC filter included.",
  });
  const gearRatio = Math.round((rpm * 3.14159 * rollOD / 1000) / lineSpeed);
  items.push({
    no: no++, category: "motor",
    description: "Helical Gearbox",
    spec: `Ratio 1:${Math.max(5, gearRatio)}, input ${rpm} RPM, ${kW * 1.2} kW, foot mount`,
    material: "Cast iron housing, case-hardened gears",
    qty: 1, unit: "pcs",
    notes: "Right-angle or inline configuration. Oil splash lubrication.",
  });
  items.push({
    no: no++, category: "motor",
    description: "Gear Coupling / Jaw Coupling",
    spec: `GE-90 or equivalent, max torque ${Math.round(kW * 9550 / rpm)} Nm`,
    material: "Alloy steel hubs, polyurethane spider",
    qty: stationCount, unit: "sets",
    notes: "Connects gearbox to shaft chain drive. Replace spider every 5000 hrs.",
  });

  // ── FRAME & HOUSING ────────────────────────────────────────────────────────
  const standSpacing = Math.round(200 + materialThickness * 50);
  items.push({
    no: no++, category: "frame",
    description: "Roll Forming Stand / Housing",
    spec: `C-frame, ${standSpacing}mm between shaft centerlines, 20mm plate`,
    material: "IS 2062 Gr.B structural steel — shot blasted",
    qty: stationCount, unit: "pcs",
    notes: `Stand center spacing: ${standSpacing}mm. Drilled for ${pillowType} bearing housings.`,
  });
  items.push({
    no: no++, category: "frame",
    description: "Main Base Frame",
    spec: `ISMC200 channels, length ${stationCount * (standSpacing + 100)}mm, leveling pads`,
    material: "IS 2062 Mild Steel, primer + epoxy coated",
    qty: 1, unit: "pcs",
    notes: "Anchor bolted to floor. M20 leveling feet at corners.",
  });
  items.push({
    no: no++, category: "frame",
    description: "Adjustable Pass Line Support",
    spec: "Height-adjustable screw mechanism ±30mm",
    material: "EN8 screws, brass nuts",
    qty: stationCount, unit: "pcs",
    notes: "Allows fine vertical adjustment per station for pass line alignment.",
  });

  // ── ENTRY/EXIT GUIDES ──────────────────────────────────────────────────────
  const profileW = 100;
  items.push({
    no: no++, category: "guide",
    description: "Entry Guide / Feed Table",
    spec: `Width: ${profileW + 50}mm, length: 600mm, with edge guide rollers`,
    material: "Mild steel frame, UHMWPE liner",
    qty: 1, unit: "pcs",
    notes: "Adjustable edge guides for coil width. Greased guide rollers.",
  });
  items.push({
    no: no++, category: "guide",
    description: "Exit Run-Out Table",
    spec: `Width: ${profileW + 50}mm, length: 1200mm, roller conveyor`,
    material: "Mild steel frame, galvanized rollers",
    qty: 1, unit: "pcs",
    notes: "Supports formed profile after exit. Roller pitch 100mm.",
  });
  items.push({
    no: no++, category: "guide",
    description: "Strip Edge Guide Roll (Entry)",
    spec: `Ø50mm × 25mm, adjustable bracket, Ø20mm bore`,
    material: "Hardened steel EN31 — HRC 58",
    qty: 4, unit: "pcs",
    notes: "Prevents lateral strip wander at entry. Adjust to strip width.",
  });
  items.push({
    no: no++, category: "guide",
    description: "Anti-Twist / Straightener Roll Set",
    spec: `3-roll straightener, adjustable, for ${materialThickness}mm material`,
    material: "Chrome-plated D2 rolls",
    qty: 1, unit: "sets",
    notes: "Corrects coil set and bow before forming. Must be used with coil reel.",
  });

  // ── HARDWARE ───────────────────────────────────────────────────────────────
  items.push({
    no: no++, category: "hardware",
    description: "Roll Locking Collar / Locking Ring",
    spec: `Ø${shaftOD + 5}mm, split type, with M8 screws`,
    material: "1018 steel, zinc plated",
    qty: stationCount * 4, unit: "pcs",
    notes: "Locks roll axial position on shaft.",
  });
  items.push({
    no: no++, category: "hardware",
    description: "Grease Nipple (Alemite/Zerk) M6",
    spec: "M6 × 1.0, 45° or straight, DIN 71412",
    material: "Zinc plated steel",
    qty: stationCount * 8, unit: "pcs",
    notes: "One per bearing. Lubricate every 500 production hours.",
  });
  items.push({
    no: no++, category: "hardware",
    description: "Hex Head Bolt Set — Stand to Frame",
    spec: "M16 × 60mm, GR 8.8, with flat washer & spring washer",
    material: "Alloy steel GR8.8, hot-dip galvanized",
    qty: stationCount * 4, unit: "sets",
    notes: "Torque to 130 Nm. Check annually.",
  });
  items.push({
    no: no++, category: "hardware",
    description: "Safety Guard / Cover Panels",
    spec: "Perforated sheet, 1.5mm thick, hinged access doors",
    material: "Mild steel 1.5mm + yellow powder coat",
    qty: stationCount * 2, unit: "pcs",
    notes: "CE compliant machine guarding. Interlocked with E-stop.",
  });
  items.push({
    no: no++, category: "hardware",
    description: "Electrical Control Panel",
    spec: `IP54 cabinet, 415V, E-stop, speed display, VFD interface`,
    material: "Powder-coated mild steel enclosure",
    qty: 1, unit: "pcs",
    notes: `Controls: Start/Stop, speed 0–${lineSpeed + 5} m/min, forward/reverse jog.`,
  });

  return items;
}

const CATEGORY_LABELS: Record<string, string> = {
  shaft: "Shafts & Arbors",
  bearing: "Bearings & Housings",
  roll: "Roll Tooling Sets",
  motor: "Motor & Drive System",
  frame: "Frame & Structure",
  guide: "Entry / Exit Guides",
  hardware: "Hardware & Electrical",
};

const CATEGORY_COLORS: Record<string, string> = {
  shaft: "#f59e0b",
  bearing: "#06b6d4",
  roll: "#a78bfa",
  motor: "#22c55e",
  frame: "#f87171",
  guide: "#fb923c",
  hardware: "#60a5fa",
};

export function MachineBOMPanel() {
  const store = useCncStore();
  const [bom, setBom] = useState<BOMLineItem[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const generate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      setBom(generateBOM(useCncStore.getState()));
      setGenerating(false);
      setExpandedCat("shaft");
    }, 800);
  }, []);

  const downloadCSV = useCallback(() => {
    if (!bom) return;
    const header = "No,Description,Specification,Material,Qty,Unit,Notes\n";
    const rows = bom.map(item =>
      `${item.no},"${item.description}","${item.spec}","${item.material}",${item.qty},${item.unit},"${item.notes}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "machine-bom.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [bom]);

  const groupedBom = bom ? Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
    cat, label,
    items: bom.filter(i => i.category === cat),
    color: CATEGORY_COLORS[cat],
  })).filter(g => g.items.length > 0) : [];

  return (
    <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Package className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">Machine Requirements BOM</div>
          <div className="text-[10px] text-zinc-500">Full bill of materials for the roll forming line</div>
        </div>
        {bom && (
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!bom && !generating && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Package className="w-8 h-8 text-amber-500/60" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-400 mb-1">Machine BOM Not Generated</div>
              <div className="text-xs text-zinc-600 max-w-xs leading-relaxed">
                Generates a complete bill of materials including shafts, bearings, rolls, motor, frame, guides and all hardware — based on your current design parameters.
              </div>
            </div>
          </div>
        )}

        {generating && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-sm text-zinc-400">Generating machine BOM...</div>
          </div>
        )}

        {bom && !generating && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-center">
                <div className="text-lg font-bold text-amber-400">{bom.length}</div>
                <div className="text-[10px] text-zinc-600">Line Items</div>
              </div>
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-center">
                <div className="text-lg font-bold text-blue-400">{bom.reduce((s, i) => s + i.qty, 0)}</div>
                <div className="text-[10px] text-zinc-600">Total Units</div>
              </div>
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-center">
                <div className="text-lg font-bold text-purple-400">{groupedBom.length}</div>
                <div className="text-[10px] text-zinc-600">Categories</div>
              </div>
            </div>

            {groupedBom.map(({ cat, label, items, color }) => {
              const isExp = expandedCat === cat;
              return (
                <div key={cat} className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  <button
                    onClick={() => setExpandedCat(isExp ? null : cat)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs font-semibold text-zinc-200 flex-1">{label}</span>
                    <span className="text-[10px] text-zinc-600">{items.length} items</span>
                    {isExp ? <ChevronUp className="w-3 h-3 text-zinc-600" /> : <ChevronDown className="w-3 h-3 text-zinc-600" />}
                  </button>
                  {isExp && (
                    <div className="border-t border-white/[0.05]">
                      {items.map((item, i) => (
                        <div key={item.no} className={`px-4 py-3 space-y-1 ${i > 0 ? "border-t border-white/[0.04]" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-zinc-600 w-5">{item.no}.</span>
                              <span className="text-xs font-semibold text-zinc-200">{item.description}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-sm font-bold tabular-nums" style={{ color }}>{item.qty}</span>
                              <span className="text-[10px] text-zinc-600">{item.unit}</span>
                            </div>
                          </div>
                          <div className="pl-7 space-y-0.5">
                            <div className="text-[10px] text-zinc-400">{item.spec}</div>
                            <div className="text-[10px] text-zinc-600 italic">{item.material}</div>
                            <div className="text-[10px] text-blue-400/70">{item.notes}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-white/[0.07]">
        <button
          onClick={generate}
          disabled={generating}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white" }}
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating BOM...</>
          ) : (
            <><RefreshCw className="w-4 h-4" /> {bom ? "Regenerate BOM" : "Generate Machine BOM"}</>
          )}
        </button>
      </div>
    </div>
  );
}
