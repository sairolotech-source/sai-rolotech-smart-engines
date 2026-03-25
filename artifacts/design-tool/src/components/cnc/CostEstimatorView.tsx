import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { DollarSign, Package, Clock, Wrench, BarChart3 } from "lucide-react";

const MATERIAL_PRICES: Record<string, { pricePerKg: number; density: number; scrapRate: number }> = {
  GI: { pricePerKg: 0.85, density: 7850, scrapRate: 0.03 },
  CR: { pricePerKg: 0.75, density: 7850, scrapRate: 0.025 },
  HR: { pricePerKg: 0.65, density: 7850, scrapRate: 0.04 },
  SS: { pricePerKg: 3.20, density: 7930, scrapRate: 0.02 },
  AL: { pricePerKg: 2.50, density: 2700, scrapRate: 0.03 },
  MS: { pricePerKg: 0.70, density: 7850, scrapRate: 0.035 },
  CU: { pricePerKg: 8.50, density: 8960, scrapRate: 0.02 },
  TI: { pricePerKg: 25.00, density: 4510, scrapRate: 0.015 },
  PP: { pricePerKg: 0.95, density: 7850, scrapRate: 0.03 },
  HSLA: { pricePerKg: 1.10, density: 7850, scrapRate: 0.025 },
};

const ROLL_MATERIAL_COSTS: Record<string, number> = {
  "D2 Tool Steel": 18.0,
  "H13 Tool Steel": 22.0,
  "EN8 Steel": 8.0,
  "EN31 Steel": 12.0,
  "Carbide": 45.0,
};

export function CostEstimatorView() {
  const { materialType, materialThickness: thickness, geometry: rawGeometry, stations, rollTooling, rollDiameter: storeRollDia, lineSpeed: storeLSpeed, motorRPM } = useCncStore();
  const geometry = rawGeometry ?? { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };

  const [productionLength, setProductionLength] = useState(1000);
  const [batchSize, setBatchSize] = useState(1000);
  const [lineSpeed, setLineSpeed] = useState(15);
  const [laborRate, setLaborRate] = useState(25);
  const [machineRate, setMachineRate] = useState(80);
  const [rollMaterial, setRollMaterial] = useState("D2 Tool Steel");
  const [currency, setCurrency] = useState("USD");

  const mat = MATERIAL_PRICES[materialType] ?? MATERIAL_PRICES.GI;

  const costs = useMemo(() => {
    const flatLengths = geometry.segments.map(seg =>
      Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY)
    );
    const stripWidth = flatLengths.reduce((s, l) => s + l, 0) || 100;
    const stripWidthM = stripWidth / 1000;
    const thicknessM = thickness / 1000;

    const volumePerMeter = stripWidthM * thicknessM * 1;
    const weightPerMeter = volumePerMeter * mat.density;
    const materialCostPerMeter = weightPerMeter * mat.pricePerKg;
    const scrapCost = materialCostPerMeter * mat.scrapRate;
    const totalMaterialPerMeter = materialCostPerMeter + scrapCost;

    const numStations = Math.max(stations.length, rollTooling.length, 6);
    const rollMatCost = ROLL_MATERIAL_COSTS[rollMaterial] ?? 18;
    let totalToolingCost = 0;
    if (rollTooling.length > 0) {
      rollTooling.forEach(rt => {
        const dia = rt.upperRollOD ?? rt.rollProfile?.rollDiameter ?? storeRollDia ?? 150;
        const w = rt.upperRollWidth ?? rt.rollProfile?.rollWidth ?? 60;
        const topW = Math.PI * Math.pow(dia / 2000, 2) * (w / 1000) * 7850;
        const botDia = dia;
        const botW2 = Math.PI * Math.pow(botDia / 2000, 2) * (w / 1000) * 7850;
        const pairCost = (topW + botW2) * rollMatCost + 240;
        totalToolingCost += pairCost;
      });
    } else {
      const dia = storeRollDia ?? 150;
      const rollWeight = Math.PI * Math.pow(dia / 2000, 2) * 0.06 * 7850;
      const rollCostPer = rollWeight * rollMatCost;
      const machiningCostPer = 120;
      const totalPerRollPair = (rollCostPer + machiningCostPer) * 2;
      totalToolingCost = totalPerRollPair * numStations;
    }

    const shaftCost = numStations * 85;
    const bearingCost = numStations * 2 * 35;
    const assemblyCost = numStations * 50;
    const totalFixtureCost = shaftCost + bearingCost + assemblyCost;

    const metersPerMinute = lineSpeed;
    const metersPerHour = metersPerMinute * 60;
    const totalMeters = productionLength * batchSize;
    const productionHours = totalMeters / Math.max(metersPerHour, 1);
    const setupHours = 2 + numStations * 0.25;
    const totalHours = productionHours + setupHours;

    const laborCost = totalHours * laborRate;
    const machineCost = totalHours * machineRate;

    const totalMaterialCost = totalMaterialPerMeter * totalMeters;
    const totalProductionCost = totalMaterialCost + totalToolingCost + totalFixtureCost + laborCost + machineCost;

    const costPerMeter = totalProductionCost / Math.max(totalMeters, 1);
    const costPerPiece = costPerMeter * productionLength;

    return {
      stripWidth,
      weightPerMeter,
      materialCostPerMeter: totalMaterialPerMeter,
      totalMaterialCost,
      numStations,
      rollCostPer: totalToolingCost / numStations,
      totalToolingCost,
      totalFixtureCost,
      productionHours,
      setupHours,
      totalHours,
      laborCost,
      machineCost,
      totalProductionCost,
      costPerMeter,
      costPerPiece,
      totalMeters,
    };
  }, [materialType, thickness, geometry, stations, rollTooling, storeRollDia, productionLength, batchSize, lineSpeed, laborRate, machineRate, rollMaterial, mat]);

  const formatCost = (val: number) => {
    const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "INR" ? "₹" : "$";
    const multiplier = currency === "INR" ? 83 : currency === "EUR" ? 0.92 : 1;
    return `${sym}${(val * multiplier).toFixed(2)}`;
  };

  const breakdown = [
    { label: "Material", value: costs.totalMaterialCost, color: "bg-blue-500", pct: costs.totalMaterialCost / costs.totalProductionCost * 100 },
    { label: "Roll Tooling", value: costs.totalToolingCost, color: "bg-purple-500", pct: costs.totalToolingCost / costs.totalProductionCost * 100 },
    { label: "Fixtures", value: costs.totalFixtureCost, color: "bg-amber-500", pct: costs.totalFixtureCost / costs.totalProductionCost * 100 },
    { label: "Labor", value: costs.laborCost, color: "bg-emerald-500", pct: costs.laborCost / costs.totalProductionCost * 100 },
    { label: "Machine", value: costs.machineCost, color: "bg-red-500", pct: costs.machineCost / costs.totalProductionCost * 100 },
  ];

  return (
    <div className="flex flex-col h-full bg-[#070710] overflow-hidden">
      <div className="flex-shrink-0 px-4 py-2 border-b border-white/[0.07] flex items-center gap-3">
        <DollarSign className="w-4 h-4 text-yellow-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Production Cost Estimator</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">Pro Grade</span>
        <div className="flex-1" />
        <select
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[10px] text-zinc-300"
        >
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="INR">INR (₹)</option>
        </select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-3">
              <div className="text-[9px] text-blue-400/70 uppercase tracking-widest mb-1">Cost / Meter</div>
              <div className="text-lg font-bold text-blue-300">{formatCost(costs.costPerMeter)}</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-3">
              <div className="text-[9px] text-emerald-400/70 uppercase tracking-widest mb-1">Cost / Piece</div>
              <div className="text-lg font-bold text-emerald-300">{formatCost(costs.costPerPiece)}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-3">
              <div className="text-[9px] text-purple-400/70 uppercase tracking-widest mb-1">Total Cost</div>
              <div className="text-lg font-bold text-purple-300">{formatCost(costs.totalProductionCost)}</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-3">
              <div className="text-[9px] text-amber-400/70 uppercase tracking-widest mb-1">Production Time</div>
              <div className="text-lg font-bold text-amber-300">{costs.totalHours.toFixed(1)} hrs</div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" /> Cost Breakdown
            </div>
            <div className="space-y-2">
              {breakdown.map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-[10px] text-zinc-400 w-20">{item.label}</span>
                  <div className="flex-1 bg-white/[0.04] rounded-full h-4 overflow-hidden">
                    <div className={`${item.color} h-full rounded-full transition-all`} style={{ width: `${Math.max(item.pct, 2)}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-300 w-20 text-right">{formatCost(item.value)}</span>
                  <span className="text-[9px] text-zinc-500 w-10 text-right">{item.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Package className="w-3 h-3 text-blue-400" /> Material
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-zinc-500">Type</span><span className="text-zinc-300">{materialType}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Strip Width</span><span className="text-zinc-300">{costs.stripWidth.toFixed(1)} mm</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Thickness</span><span className="text-zinc-300">{thickness} mm</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Weight/m</span><span className="text-zinc-300">{costs.weightPerMeter.toFixed(2)} kg</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Cost/m</span><span className="text-blue-300">{formatCost(costs.materialCostPerMeter)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Scrap</span><span className="text-red-400">{(mat.scrapRate * 100).toFixed(1)}%</span></div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Wrench className="w-3 h-3 text-purple-400" /> Tooling
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-zinc-500">Stations</span><span className="text-zinc-300">{costs.numStations}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Roll Material</span><span className="text-zinc-300">{rollMaterial}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Per Pair</span><span className="text-zinc-300">{formatCost(costs.rollCostPer)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Total Rolls</span><span className="text-purple-300">{formatCost(costs.totalToolingCost)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Fixtures</span><span className="text-amber-300">{formatCost(costs.totalFixtureCost)}</span></div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-emerald-400" /> Production
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between"><span className="text-zinc-500">Line Speed</span><span className="text-zinc-300">{lineSpeed} m/min</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Setup</span><span className="text-zinc-300">{costs.setupHours.toFixed(1)} hrs</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Running</span><span className="text-zinc-300">{costs.productionHours.toFixed(1)} hrs</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Labor</span><span className="text-emerald-300">{formatCost(costs.laborCost)}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Machine</span><span className="text-red-300">{formatCost(costs.machineCost)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-56 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-3 overflow-y-auto">
          <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">Production Params</div>
          <div className="space-y-2">
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Piece Length (mm)</label>
              <input type="number" value={productionLength} onChange={e => setProductionLength(parseInt(e.target.value) || 1000)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Batch Size (pcs)</label>
              <input type="number" value={batchSize} onChange={e => setBatchSize(parseInt(e.target.value) || 1)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Line Speed (m/min)</label>
              <input type="number" value={lineSpeed} onChange={e => setLineSpeed(parseInt(e.target.value) || 1)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Labor Rate ($/hr)</label>
              <input type="number" value={laborRate} onChange={e => setLaborRate(parseInt(e.target.value) || 1)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Machine Rate ($/hr)</label>
              <input type="number" value={machineRate} onChange={e => setMachineRate(parseInt(e.target.value) || 1)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block mb-0.5">Roll Material</label>
              <select value={rollMaterial} onChange={e => setRollMaterial(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-300">
                {Object.keys(ROLL_MATERIAL_COSTS).map(rm => (
                  <option key={rm} value={rm}>{rm}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mt-4">Quick Stats</div>
          <div className="space-y-1">
            <div className="bg-white/[0.03] rounded p-2 flex justify-between text-[10px]">
              <span className="text-zinc-500">Total Meters</span>
              <span className="text-zinc-300">{costs.totalMeters.toLocaleString()} m</span>
            </div>
            <div className="bg-white/[0.03] rounded p-2 flex justify-between text-[10px]">
              <span className="text-zinc-500">Total Weight</span>
              <span className="text-zinc-300">{(costs.weightPerMeter * costs.totalMeters).toFixed(0)} kg</span>
            </div>
            <div className="bg-white/[0.03] rounded p-2 flex justify-between text-[10px]">
              <span className="text-zinc-500">Tooling / Piece</span>
              <span className="text-zinc-300">{formatCost((costs.totalToolingCost + costs.totalFixtureCost) / batchSize)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
