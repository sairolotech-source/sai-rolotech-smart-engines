import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  Circle, Square, Hexagon, ArrowRight, Check, AlertTriangle, Settings,
  Download, RotateCcw, Zap, ChevronDown, ChevronRight, Layers
} from "lucide-react";

type TubeType = "round" | "rectangular" | "shaped" | "oval";
type FormingMethod = "conventional" | "cage" | "downhill";
type WeldType = "tig" | "hf" | "laser" | "erw";

interface TubeSpec {
  type: TubeType;
  outerDia: number;
  wallThickness: number;
  width: number;
  height: number;
  cornerRadius: number;
  material: string;
  yieldStrength: number;
  tensileStrength: number;
  elasticModulus: number;
  formingMethod: FormingMethod;
  weldType: WeldType;
  finWidth: number;
  millSpeed: number;
}

interface StationResult {
  station: number;
  description: string;
  topAngle: number;
  bottomAngle: number;
  sideAngle: number;
  rollDia: number;
  gap: number;
  force: number;
}

const TUBE_MATERIALS: Record<string, { ys: number; ts: number; E: number }> = {
  "CR Steel": { ys: 340, ts: 420, E: 210000 },  // FIX: ys 280→340 (IS 513 CR4/CR2)
  "GI Steel": { ys: 280, ts: 380, E: 210000 },  // FIX: ys 250→280 (IS 277 Z180)
  "SS 304": { ys: 310, ts: 620, E: 193000 },    // FIX: ys 215→310, ts 505→620 (ASTM A240 2B)
  "SS 316": { ys: 290, ts: 580, E: 193000 },    // FIX: ys 205→290, ts 515→580 (ASTM A240 316L)
  "AL 6061-T6": { ys: 276, ts: 310, E: 68900 },
  "Copper C110": { ys: 69, ts: 220, E: 117000 },
  "HSLA 350": { ys: 350, ts: 450, E: 210000 },
  "DX51D+Z": { ys: 140, ts: 270, E: 210000 },
};

function calcStripWidth(spec: TubeSpec): number {
  const { type, outerDia, wallThickness, width, height, cornerRadius } = spec;
  const t = wallThickness;
  const r = cornerRadius || t * 2;
  const neutralR = r + t * 0.45;

  if (type === "round") {
    return Math.PI * (outerDia - t);
  } else if (type === "oval") {
    const a = width / 2 - t / 2;
    const b = height / 2 - t / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  } else {
    const flatW = width - 2 * r - 2 * t;
    const flatH = height - 2 * r - 2 * t;
    const bendLen = 4 * (Math.PI / 2) * neutralR;
    return 2 * flatW + 2 * flatH + bendLen;
  }
}

function calcTubeStations(spec: TubeSpec): StationResult[] {
  const { type, outerDia, wallThickness, width, height, cornerRadius, yieldStrength, formingMethod } = spec;
  const t = wallThickness;
  const stations: StationResult[] = [];

  let totalStations: number;
  if (type === "round") {
    const ratio = outerDia / t;
    totalStations = ratio > 50 ? 8 : ratio > 30 ? 10 : 14;
  } else {
    const maxDim = Math.max(width, height);
    const ratio = maxDim / t;
    totalStations = ratio > 60 ? 10 : ratio > 40 ? 14 : 18;
    if (type === "shaped") totalStations += 4;
  }

  if (formingMethod === "downhill") totalStations = Math.ceil(totalStations * 0.85);
  if (formingMethod === "cage") totalStations = Math.ceil(totalStations * 0.7);

  const finalAngle = type === "round" ? 180 : 90;

  for (let i = 1; i <= totalStations; i++) {
    const progress = i / totalStations;
    let topA: number, botA: number, sideA: number;

    if (type === "round") {
      if (formingMethod === "downhill") {
        const p = Math.pow(progress, 0.7);
        topA = p * 180;
        botA = p * 180;
        sideA = p * 180;
      } else {
        topA = progress * 180;
        botA = Math.min(progress * 1.1, 1) * 180;
        sideA = Math.max(0, (progress - 0.1) / 0.9) * 180;
      }
    } else {
      topA = Math.min(progress * 1.2, 1) * 90;
      botA = progress * 90;
      sideA = Math.max(0, (progress - 0.15) / 0.85) * 90;
    }

    const rollDia = 200 + (i % 2 === 0 ? 20 : 0);
    const gap = t + (totalStations - i) * 0.05;
    const bendForce = (yieldStrength * t * t) / (6 * (cornerRadius || outerDia / 4));
    const force = bendForce * (1 + 0.3 * progress);

    let desc = "";
    if (progress <= 0.2) desc = "Initial Forming";
    else if (progress <= 0.5) desc = "Edge Bending";
    else if (progress <= 0.75) desc = "Major Forming";
    else if (progress <= 0.9) desc = "Fin Pass / Closing";
    else desc = "Sizing / Calibration";

    stations.push({
      station: i,
      description: desc,
      topAngle: Math.round(topA * 10) / 10,
      bottomAngle: Math.round(botA * 10) / 10,
      sideAngle: Math.round(sideA * 10) / 10,
      rollDia: Math.round(rollDia),
      gap: Math.round(gap * 100) / 100,
      force: Math.round(force),
    });
  }

  return stations;
}

function calcWeldParams(spec: TubeSpec) {
  const { weldType, wallThickness, millSpeed } = spec;
  const t = wallThickness;
  const speed = millSpeed || 20;

  const params: Record<string, any> = {
    weldType,
    speed: speed,
  };

  switch (weldType) {
    case "hf":
      params.frequency = t < 2 ? 400 : t < 4 ? 350 : 300;
      params.power = Math.round(t * speed * 0.8);
      params.veeAngle = t < 2 ? 5 : t < 3 ? 6 : 7;
      params.unit = "kW";
      break;
    case "tig":
      params.current = Math.round(40 + t * 80);
      params.voltage = Math.round(10 + t * 2);
      params.shieldGas = "Argon 99.99%";
      params.flowRate = 12 + t * 2;
      break;
    case "laser":
      params.power = Math.round(t * 1.2 * 1000);
      params.focalLength = 200;
      params.spotSize = 0.3;
      params.unit = "W";
      break;
    case "erw":
      params.frequency = 60;
      params.power = Math.round(t * speed * 1.2);
      params.unit = "kW";
      break;
  }

  return params;
}

export function RFTubesView() {
  const { geometry } = useCncStore();
  const [spec, setSpec] = useState<TubeSpec>({
    type: "round",
    outerDia: 48.3,
    wallThickness: 2.0,
    width: 50,
    height: 30,
    cornerRadius: 4,
    material: "CR Steel",
    yieldStrength: 280,
    tensileStrength: 380,
    elasticModulus: 210000,
    formingMethod: "conventional",
    weldType: "hf",
    finWidth: 5,
    millSpeed: 30,
  });
  const [expandedSection, setExpandedSection] = useState<string>("geometry");

  const stripWidth = useMemo(() => calcStripWidth(spec), [spec]);
  const stations = useMemo(() => calcTubeStations(spec), [spec]);
  const weldParams = useMemo(() => calcWeldParams(spec), [spec]);

  const circumference = spec.type === "round"
    ? Math.PI * spec.outerDia
    : 2 * (spec.width + spec.height) - 8 * (spec.cornerRadius || 4) + 2 * Math.PI * (spec.cornerRadius || 4);

  const updateSpec = (key: keyof TubeSpec, val: any) => {
    setSpec(prev => {
      const next = { ...prev, [key]: val };
      if (key === "material") {
        const m = TUBE_MATERIALS[val as string];
        if (m) {
          next.yieldStrength = m.ys;
          next.tensileStrength = m.ts;
          next.elasticModulus = m.E;
        }
      }
      return next;
    });
  };

  const Section = ({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) => (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <button onClick={() => setExpandedSection(expandedSection === id ? "" : id)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
        {icon}
        <span className="text-[11px] font-semibold text-zinc-300 flex-1 text-left">{title}</span>
        {expandedSection === id ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
      </button>
      {expandedSection === id && <div className="p-3 space-y-2 bg-[#0a0a15]">{children}</div>}
    </div>
  );

  const Input = ({ label, value, onChange, unit, min, max, step }: any) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-24">{label}</span>
      <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min} max={max} step={step || 0.1}
        className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200 w-20" />
      {unit && <span className="text-[9px] text-zinc-600 w-8">{unit}</span>}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-blue-500/5 to-transparent">
        <Circle className="w-5 h-5 text-blue-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF Tubes</div>
          <div className="text-[10px] text-zinc-500">Round, Rectangular & Shaped Tube Mill Design</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
            {stations.length} Stations
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
            Strip: {stripWidth.toFixed(1)}mm
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[320px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <Section id="geometry" title="Tube Geometry" icon={<Circle className="w-3.5 h-3.5 text-blue-400" />}>
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {(["round", "rectangular", "oval", "shaped"] as TubeType[]).map(t => (
                  <button key={t} onClick={() => updateSpec("type", t)}
                    className={`flex-1 text-[9px] py-1 rounded border ${spec.type === t ? "bg-blue-500/20 border-blue-500/30 text-blue-300" : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"}`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              {spec.type === "round" ? (
                <Input label="Outer Diameter" value={spec.outerDia} onChange={(v: number) => updateSpec("outerDia", v)} unit="mm" />
              ) : (
                <>
                  <Input label="Width" value={spec.width} onChange={(v: number) => updateSpec("width", v)} unit="mm" />
                  <Input label="Height" value={spec.height} onChange={(v: number) => updateSpec("height", v)} unit="mm" />
                  <Input label="Corner Radius" value={spec.cornerRadius} onChange={(v: number) => updateSpec("cornerRadius", v)} unit="mm" />
                </>
              )}
              <Input label="Wall Thickness" value={spec.wallThickness} onChange={(v: number) => updateSpec("wallThickness", v)} unit="mm" />
              <Input label="Fin Width" value={spec.finWidth} onChange={(v: number) => updateSpec("finWidth", v)} unit="mm" />
            </div>
          </Section>

          <Section id="material" title="Material" icon={<Layers className="w-3.5 h-3.5 text-orange-400" />}>
            <select value={spec.material} onChange={e => updateSpec("material", e.target.value)}
              className="w-full bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200">
              {Object.keys(TUBE_MATERIALS).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <Input label="Yield (σy)" value={spec.yieldStrength} onChange={(v: number) => updateSpec("yieldStrength", v)} unit="MPa" />
            <Input label="Tensile (σu)" value={spec.tensileStrength} onChange={(v: number) => updateSpec("tensileStrength", v)} unit="MPa" />
            <Input label="Elastic (E)" value={spec.elasticModulus} onChange={(v: number) => updateSpec("elasticModulus", v)} unit="MPa" />
          </Section>

          <Section id="process" title="Forming Process" icon={<Settings className="w-3.5 h-3.5 text-green-400" />}>
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {(["conventional", "cage", "downhill"] as FormingMethod[]).map(m => (
                  <button key={m} onClick={() => updateSpec("formingMethod", m)}
                    className={`flex-1 text-[9px] py-1 rounded border ${spec.formingMethod === m ? "bg-green-500/20 border-green-500/30 text-green-300" : "border-white/[0.06] text-zinc-500"}`}>
                    {m === "downhill" ? "Down-Hill" : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              <div>
                <span className="text-[10px] text-zinc-500">Weld Type</span>
                <div className="flex gap-1 mt-1">
                  {(["hf", "tig", "laser", "erw"] as WeldType[]).map(w => (
                    <button key={w} onClick={() => updateSpec("weldType", w)}
                      className={`flex-1 text-[9px] py-1 rounded border ${spec.weldType === w ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "border-white/[0.06] text-zinc-500"}`}>
                      {w.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Mill Speed" value={spec.millSpeed} onChange={(v: number) => updateSpec("millSpeed", v)} unit="m/min" />
            </div>
          </Section>

          <Section id="weld" title="Weld Parameters" icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}>
            <div className="space-y-1">
              {Object.entries(weldParams).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[10px]">
                  <span className="text-zinc-500">{k}</span>
                  <span className="text-zinc-300">{typeof v === "number" ? v.toFixed(1) : String(v)}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="mt-3 p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1">
            <div className="text-[10px] font-bold text-zinc-400">Summary</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-zinc-500">Strip Width</span><span className="text-blue-300 text-right">{stripWidth.toFixed(2)} mm</span>
              <span className="text-zinc-500">Circumference</span><span className="text-zinc-300 text-right">{circumference.toFixed(2)} mm</span>
              <span className="text-zinc-500">Total Stations</span><span className="text-green-300 text-right">{stations.length}</span>
              <span className="text-zinc-500">Forming</span><span className="text-zinc-300 text-right">{spec.formingMethod}</span>
              <span className="text-zinc-500">D/t Ratio</span><span className="text-amber-300 text-right">{(spec.type === "round" ? spec.outerDia / spec.wallThickness : Math.max(spec.width, spec.height) / spec.wallThickness).toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            Forming Sequence — {stations.length} Stations ({spec.formingMethod === "downhill" ? "Down-Hill Forming" : spec.formingMethod === "cage" ? "Cage Forming" : "Conventional"})
          </div>

          <div className="mb-4">
            <div className="flex items-end gap-1 h-32 px-2">
              {stations.map((s, i) => {
                const maxAngle = spec.type === "round" ? 180 : 90;
                const h = (s.topAngle / maxAngle) * 100;
                const zone = s.description;
                const color = zone.includes("Initial") ? "bg-blue-500" : zone.includes("Edge") ? "bg-cyan-500" : zone.includes("Major") ? "bg-orange-500" : zone.includes("Fin") ? "bg-amber-500" : "bg-green-500";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[8px] text-zinc-600">{s.topAngle}°</span>
                    <div className={`w-full rounded-t ${color} transition-all`} style={{ height: `${h}%`, minHeight: 4, opacity: 0.7 }} />
                    <span className="text-[8px] text-zinc-600">{s.station}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 justify-center">
              {["Initial Forming", "Edge Bending", "Major Forming", "Fin Pass / Closing", "Sizing / Calibration"].map((z, i) => {
                const colors = ["bg-blue-500", "bg-cyan-500", "bg-orange-500", "bg-amber-500", "bg-green-500"];
                return (
                  <div key={z} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-sm ${colors[i]}`} />
                    <span className="text-[8px] text-zinc-600">{z}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  {["#", "Description", "Top°", "Bottom°", "Side°", "Roll Ø", "Gap", "Force"].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stations.map(s => (
                  <tr key={s.station} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-2 py-1 text-zinc-500 font-mono">{s.station}</td>
                    <td className="px-2 py-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        s.description.includes("Initial") ? "bg-blue-500/10 text-blue-400" :
                        s.description.includes("Edge") ? "bg-cyan-500/10 text-cyan-400" :
                        s.description.includes("Major") ? "bg-orange-500/10 text-orange-400" :
                        s.description.includes("Fin") ? "bg-amber-500/10 text-amber-400" :
                        "bg-green-500/10 text-green-400"
                      }`}>{s.description}</span>
                    </td>
                    <td className="px-2 py-1 text-zinc-300 font-mono">{s.topAngle}°</td>
                    <td className="px-2 py-1 text-zinc-300 font-mono">{s.bottomAngle}°</td>
                    <td className="px-2 py-1 text-zinc-300 font-mono">{s.sideAngle}°</td>
                    <td className="px-2 py-1 text-zinc-300">{s.rollDia}mm</td>
                    <td className="px-2 py-1 text-zinc-300">{s.gap}mm</td>
                    <td className="px-2 py-1 text-amber-300">{s.force}N</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Total Forming Force</div>
              <div className="text-lg font-bold text-amber-400">{(stations.reduce((a, s) => a + s.force, 0) / 1000).toFixed(1)} kN</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Strip Width (Calculated)</div>
              <div className="text-lg font-bold text-blue-400">{stripWidth.toFixed(2)} mm</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Production Rate</div>
              <div className="text-lg font-bold text-green-400">{spec.millSpeed} m/min</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
