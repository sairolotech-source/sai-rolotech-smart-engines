import React, { useState, useMemo, useRef } from "react";
import {
  Layers, Plus, Trash2, Download, RotateCcw, Zap, ChevronDown,
  ChevronRight, AlertTriangle, Check, Info, Copy, FileDown
} from "lucide-react";

type FlangeType = "base" | "edge" | "miter" | "swept" | "lofted";
type HemType = "open" | "closed" | "teardrop" | "rolled" | "flattened";
type BendMethod = "k-factor" | "bend-deduction" | "din" | "ansi";
type MaterialSM = "CR_mild" | "GI_Z275" | "SS304" | "AL5052" | "AL6061" | "CU110" | "HSLA350";

interface BendParams {
  id: string;
  type: "flange" | "hem" | "tab" | "notch" | "louver";
  flangeType?: FlangeType;
  hemType?: HemType;
  length: number;
  angle: number;
  radius: number;
  offset?: number;
  miterAngle?: number;
  hemGap?: number;
  position: "left" | "right" | "top" | "bottom" | "custom";
  edge: number;
}

interface SMSpec {
  material: MaterialSM;
  thickness: number;
  baseWidth: number;
  baseLength: number;
  bendMethod: BendMethod;
  kFactor: number;
  insideBendRadius: number;
  bends: BendParams[];
}

interface UnfoldResult {
  flatWidth: number;
  flatLength: number;
  totalBendDeduction: number;
  totalBendAllowance: number;
  bendDetails: {
    id: string;
    bendAllowance: number;
    bendDeduction: number;
    outsideSetback: number;
    kFactor: number;
  }[];
  area: number;
  weight: number;
  perimeter: number;
}

const SM_MATERIALS: Record<MaterialSM, { label: string; ys: number; ts: number; density: number; defaultK: number; color: string }> = {
  CR_mild: { label: "CR Mild Steel",     ys: 280, ts: 380, density: 7.85, defaultK: 0.33, color: "#94a3b8" },
  GI_Z275: { label: "GI Steel Z275",     ys: 250, ts: 350, density: 7.85, defaultK: 0.35, color: "#a3e635" },
  SS304:   { label: "Stainless 304",     ys: 215, ts: 505, density: 8.0,  defaultK: 0.38, color: "#cbd5e1" },
  AL5052:  { label: "Aluminium 5052",    ys: 193, ts: 228, density: 2.68, defaultK: 0.40, color: "#93c5fd" },
  AL6061:  { label: "Aluminium 6061-T6", ys: 276, ts: 310, density: 2.71, defaultK: 0.40, color: "#7dd3fc" },
  CU110:   { label: "Copper C110",       ys: 69,  ts: 220, density: 8.94, defaultK: 0.42, color: "#fb923c" },
  HSLA350: { label: "HSLA 350",          ys: 350, ts: 450, density: 7.85, defaultK: 0.30, color: "#f59e0b" },
};

function calcBendAllowance(angle: number, radius: number, thickness: number, kFactor: number): number {
  const rad = (angle * Math.PI) / 180;
  return rad * (radius + kFactor * thickness);
}

function calcBendDeduction(angle: number, radius: number, thickness: number, kFactor: number): number {
  const ba = calcBendAllowance(angle, radius, thickness, kFactor);
  const ossb = Math.tan((angle * Math.PI / 180) / 2) * (radius + thickness);
  return 2 * ossb - ba;
}

function calcUnfold(spec: SMSpec): UnfoldResult {
  const mat = SM_MATERIALS[spec.material];
  const k = spec.kFactor;
  const t = spec.thickness;
  const r = spec.insideBendRadius;

  let totalBA = 0;
  let totalBD = 0;
  const bendDetails = spec.bends.map(b => {
    const ba = calcBendAllowance(b.angle, b.radius || r, t, k);
    const bd = calcBendDeduction(b.angle, b.radius || r, t, k);
    const ossb = Math.tan((b.angle * Math.PI / 180) / 2) * ((b.radius || r) + t);
    totalBA += ba;
    totalBD += bd;
    return { id: b.id, bendAllowance: ba, bendDeduction: bd, outsideSetback: ossb, kFactor: k };
  });

  const flangeContribs = spec.bends.reduce((s, b) => {
    if (b.type === "flange") return s + b.length;
    if (b.type === "hem") return s + b.length * 2;
    return s;
  }, 0);

  const flatWidth  = spec.baseWidth  + flangeContribs * 0.3 + totalBA * 0.5;
  const flatLength = spec.baseLength + flangeContribs * 0.7 + totalBA * 0.5;
  const area = flatWidth * flatLength;
  const weight = (area * t * mat.density) / 1e6;

  return { flatWidth, flatLength, totalBendDeduction: totalBD, totalBendAllowance: totalBA, bendDetails, area, weight, perimeter: 2 * (flatWidth + flatLength) };
}

function generateDXF(result: UnfoldResult, spec: SMSpec): string {
  const w = result.flatWidth;
  const h = result.flatLength;
  return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1014\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n` +
    `0\nLINE\n8\n0\n10\n0.0\n20\n0.0\n30\n0.0\n11\n${w.toFixed(3)}\n21\n0.0\n31\n0.0\n` +
    `0\nLINE\n8\n0\n10\n${w.toFixed(3)}\n20\n0.0\n30\n0.0\n11\n${w.toFixed(3)}\n21\n${h.toFixed(3)}\n31\n0.0\n` +
    `0\nLINE\n8\n0\n10\n${w.toFixed(3)}\n20\n${h.toFixed(3)}\n30\n0.0\n11\n0.0\n21\n${h.toFixed(3)}\n31\n0.0\n` +
    `0\nLINE\n8\n0\n10\n0.0\n20\n${h.toFixed(3)}\n30\n0.0\n11\n0.0\n21\n0.0\n31\n0.0\n` +
    `0\nTEXT\n8\nANNO\n10\n5.0\n20\n${h / 2}\n30\n0.0\n40\n5.0\n1\nFlat Pattern ${w.toFixed(1)} x ${h.toFixed(1)} mm\n` +
    `0\nENDSEC\n0\nEOF`;
}

const FLANGE_TYPES: { id: FlangeType; label: string; desc: string }[] = [
  { id: "base",    label: "Base Flange",  desc: "Primary base flange — full sheet starting point" },
  { id: "edge",    label: "Edge Flange",  desc: "Edge flange — adds material to existing edge" },
  { id: "miter",   label: "Miter Flange", desc: "Miter / angled corner flange for corners" },
  { id: "swept",   label: "Swept Flange", desc: "Swept along a sketched path" },
  { id: "lofted",  label: "Lofted Bend",  desc: "Lofted between two profiles" },
];

const HEM_TYPES: { id: HemType; label: string; desc: string }[] = [
  { id: "open",       label: "Open Hem",       desc: "Open gap hem — edge folded back with gap" },
  { id: "closed",     label: "Closed Hem",      desc: "Fully closed hem — edge fully folded back" },
  { id: "teardrop",   label: "Teardrop Hem",    desc: "Teardrop shape hem — partially closed" },
  { id: "rolled",     label: "Rolled Hem",      desc: "Rolled edge hem with radius" },
  { id: "flattened",  label: "Flattened Hem",   desc: "Fully flattened hem — stamped flat" },
];

let nextId = 1;

export function SheetMetalView() {
  const [spec, setSpec] = useState<SMSpec>({
    material: "CR_mild",
    thickness: 1.5,
    baseWidth: 200,
    baseLength: 300,
    bendMethod: "k-factor",
    kFactor: 0.33,
    insideBendRadius: 2,
    bends: [],
  });
  const [computed, setComputed] = useState(false);
  const [addType, setAddType] = useState<"flange" | "hem">("flange");
  const [expandedBend, setExpandedBend] = useState<string | null>(null);

  const mat = SM_MATERIALS[spec.material];
  const results = useMemo(() => computed ? calcUnfold(spec) : null, [spec, computed]);

  function upd<K extends keyof SMSpec>(k: K, v: SMSpec[K]) {
    setSpec(p => ({ ...p, [k]: v }));
    setComputed(false);
  }

  function addBend(type: "flange" | "hem") {
    const id = `bend-${nextId++}`;
    const newBend: BendParams = {
      id, type,
      flangeType: type === "flange" ? "edge" : undefined,
      hemType: type === "hem" ? "open" : undefined,
      length: 20, angle: 90, radius: spec.insideBendRadius,
      offset: 0, miterAngle: 45, hemGap: 0.5,
      position: "right", edge: 0,
    };
    upd("bends", [...spec.bends, newBend]);
    setExpandedBend(id);
  }

  function removeBend(id: string) {
    upd("bends", spec.bends.filter(b => b.id !== id));
  }

  function updBend(id: string, partial: Partial<BendParams>) {
    upd("bends", spec.bends.map(b => b.id === id ? { ...b, ...partial } : b));
  }

  function exportDXF() {
    if (!results) return;
    const dxf = generateDXF(results, spec);
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "flat-pattern.dxf"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "#05060f", color: "#f4f4f5" }}>
      {/* Config panel */}
      <div className="w-72 flex-shrink-0 overflow-y-auto p-4 space-y-4 border-r border-white/[0.07]" style={{ background: "rgba(9,10,24,0.7)" }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">#7 — Sheet Metal Design</h2>
          </div>
          <p className="text-[10px] text-zinc-600">Flanges · Hems · Flat Pattern · DXF Export</p>
        </div>

        {/* Material */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Material</label>
          <select value={spec.material} onChange={e => { upd("material", e.target.value as MaterialSM); upd("kFactor", SM_MATERIALS[e.target.value as MaterialSM].defaultK); }}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none">
            {Object.entries(SM_MATERIALS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {[
              { l: "YS (MPa)", v: mat.ys, c: "#f59e0b" },
              { l: "Density", v: `${mat.density}g`, c: "#60a5fa" },
              { l: "Default K", v: mat.defaultK, c: "#34d399" },
            ].map(c => (
              <div key={c.l} className="rounded p-1.5 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="font-mono" style={{ color: c.c }}>{c.v}</div>
                <div className="text-zinc-600">{c.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Base sheet */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Base Sheet</label>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">Width (mm)</label>
              <input type="number" value={spec.baseWidth} min={10} max={3000} step={1} onChange={e => upd("baseWidth", +e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">Length (mm)</label>
              <input type="number" value={spec.baseLength} min={10} max={6000} step={1} onChange={e => upd("baseLength", +e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Thickness (mm)</label>
            <input type="number" value={spec.thickness} min={0.5} max={25} step={0.1} onChange={e => upd("thickness", +e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
          </div>
        </div>

        {/* Bend calculation method */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Flat Pattern Method</label>
          <select value={spec.bendMethod} onChange={e => upd("bendMethod", e.target.value as BendMethod)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none">
            <option value="k-factor">K-Factor</option>
            <option value="bend-deduction">Bend Deduction</option>
            <option value="din">DIN 6935</option>
            <option value="ansi">ANSI / Sheet Metal Gauge</option>
          </select>
          {spec.bendMethod === "k-factor" && (
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">K-Factor ({spec.kFactor})</label>
              <input type="range" value={spec.kFactor} min={0.1} max={0.5} step={0.01} onChange={e => upd("kFactor", +e.target.value)}
                className="w-full accent-amber-400" />
              <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                <span>0.1 (hard material)</span><span>0.5 (soft)</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Default Inside Bend Radius (mm)</label>
            <input type="number" value={spec.insideBendRadius} min={0} max={50} step={0.5} onChange={e => upd("insideBendRadius", +e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
          </div>
        </div>

        {/* Add flanges / hems */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Add Features</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => setAddType("flange")}
              className="flex-1 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: addType === "flange" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${addType === "flange" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: addType === "flange" ? "#f59e0b" : "#71717a",
              }}
            >Flange</button>
            <button
              onClick={() => setAddType("hem")}
              className="flex-1 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: addType === "hem" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${addType === "hem" ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: addType === "hem" ? "#f59e0b" : "#71717a",
              }}
            >Hem</button>
          </div>
          <button
            onClick={() => addBend(addType)}
            className="w-full py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#a1a1aa" }}
          >
            <Plus className="w-3.5 h-3.5" /> Add {addType === "flange" ? "Flange" : "Hem"}
          </button>
        </div>

        {/* Bend list */}
        {spec.bends.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Features ({spec.bends.length})</label>
            {spec.bends.map((b, i) => (
              <div key={b.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between px-2.5 py-1.5 cursor-pointer hover:bg-white/[0.02]"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                  onClick={() => setExpandedBend(expandedBend === b.id ? null : b.id)}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-zinc-500">#{i + 1}</span>
                    <span className="text-xs font-medium text-zinc-300 capitalize">{b.flangeType || b.hemType} {b.type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-600">{b.angle}°</span>
                    <button onClick={e => { e.stopPropagation(); removeBend(b.id); }} className="text-zinc-700 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {expandedBend === b.id ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}
                  </div>
                </div>
                {expandedBend === b.id && (
                  <div className="p-2.5 space-y-2">
                    {b.type === "flange" && (
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Flange Type</label>
                        <select value={b.flangeType} onChange={e => updBend(b.id, { flangeType: e.target.value as FlangeType })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none">
                          {FLANGE_TYPES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                        {b.flangeType === "miter" && (
                          <div className="mt-1">
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Miter Angle (°)</label>
                            <input type="number" value={b.miterAngle || 45} min={1} max={89} onChange={e => updBend(b.id, { miterAngle: +e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
                          </div>
                        )}
                      </div>
                    )}
                    {b.type === "hem" && (
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Hem Type</label>
                        <select value={b.hemType} onChange={e => updBend(b.id, { hemType: e.target.value as HemType })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none">
                          {HEM_TYPES.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                        </select>
                        {(b.hemType === "open" || b.hemType === "teardrop") && (
                          <div className="mt-1">
                            <label className="text-[10px] text-zinc-500 block mb-0.5">Hem Gap (mm)</label>
                            <input type="number" value={b.hemGap || 0.5} min={0} max={10} step={0.1} onChange={e => updBend(b.id, { hemGap: +e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Length (mm)</label>
                        <input type="number" value={b.length} min={1} max={1000} step={0.5} onChange={e => updBend(b.id, { length: +e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-0.5">Angle (°)</label>
                        <input type="number" value={b.angle} min={0} max={180} step={1} onChange={e => updBend(b.id, { angle: +e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">Inside Bend Radius (mm)</label>
                      <input type="number" value={b.radius} min={0} max={50} step={0.5} onChange={e => updBend(b.id, { radius: +e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">Position</label>
                      <select value={b.position} onChange={e => updBend(b.id, { position: e.target.value as BendParams["position"] })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none">
                        {["left", "right", "top", "bottom", "custom"].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => setComputed(true)}
          className="w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{ background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.4)", color: "#f59e0b" }}
        >
          <Zap className="w-4 h-4" /> Unfold & Calculate
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {!results ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 space-y-3">
            <Layers className="w-12 h-12 text-zinc-800" />
            <p className="text-sm">Add flanges/hems and click Unfold & Calculate</p>
            <p className="text-xs text-zinc-700">#7 — General Sheet Metal Design — Base/edge/miter flanges, hems, flat pattern unfold, DXF export</p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-700 mt-2 max-w-sm">
              {[
                "Base Flange — primary sheet starting point",
                "Edge Flange — adds material to edge",
                "Miter Flange — angled corner connection",
                "Swept Flange — along sketched path",
                "Open Hem — folded edge with gap",
                "Closed Hem — fully folded back edge",
                "Teardrop Hem — partially closed hem",
                "Flat Pattern — auto unfold with K-factor",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-zinc-700 flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Result summary */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Flat Width",       value: results.flatWidth.toFixed(1),          unit: "mm",  color: "#60a5fa" },
                { label: "Flat Length",      value: results.flatLength.toFixed(1),         unit: "mm",  color: "#a78bfa" },
                { label: "Bend Allowance",   value: results.totalBendAllowance.toFixed(2), unit: "mm",  color: "#f59e0b" },
                { label: "Bend Deduction",   value: results.totalBendDeduction.toFixed(2), unit: "mm",  color: "#fb923c" },
                { label: "Flat Area",        value: (results.area / 1e6).toFixed(4),       unit: "m²",  color: "#34d399" },
                { label: "Part Weight",      value: results.weight.toFixed(3),             unit: "kg",  color: "#4ade80" },
                { label: "Perimeter",        value: results.perimeter.toFixed(1),          unit: "mm",  color: "#e879f9" },
                { label: "Total Features",   value: spec.bends.length,                    unit: "",    color: "#f87171" },
              ].map(c => (
                <div key={c.label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="text-lg font-bold font-mono" style={{ color: c.color }}>{c.value}<span className="text-xs text-zinc-500 ml-0.5">{c.unit}</span></div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Flat pattern visual */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 className="text-xs font-bold text-zinc-400 mb-3">Flat Pattern Preview</h3>
              <div className="flex items-center justify-center bg-zinc-900 rounded-lg p-4" style={{ minHeight: 200 }}>
                {(() => {
                  const maxW = 400; const maxH = 200;
                  const fw = results.flatWidth; const fh = results.flatLength;
                  const scale = Math.min(maxW / fw, maxH / fh, 1);
                  const dw = fw * scale; const dh = fh * scale;
                  return (
                    <svg width={dw + 40} height={dh + 40} style={{ overflow: "visible" }}>
                      <rect x={20} y={20} width={dw} height={dh}
                        fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" rx={2} />
                      {spec.bends.map((b, i) => {
                        const x = b.position === "right" ? 20 + dw : b.position === "left" ? 20 : 20 + dw * 0.3 * i;
                        const y = b.position === "bottom" ? 20 + dh : b.position === "top" ? 20 : 20;
                        const bLen = b.length * scale;
                        const isHoriz = b.position === "top" || b.position === "bottom";
                        return (
                          <rect key={b.id}
                            x={isHoriz ? 20 + dw * 0.2 * i : x}
                            y={isHoriz ? y : 20 + dh * 0.2 * i}
                            width={isHoriz ? bLen : 8}
                            height={isHoriz ? 8 : bLen}
                            fill={b.type === "hem" ? "rgba(96,165,250,0.2)" : "rgba(167,139,250,0.2)"}
                            stroke={b.type === "hem" ? "#60a5fa" : "#a78bfa"}
                            strokeWidth={1} rx={1}
                          />
                        );
                      })}
                      <text x={20 + dw / 2} y={18} textAnchor="middle" fill="#f59e0b" fontSize={10}>{results.flatWidth.toFixed(1)} mm</text>
                      <text x={16} y={20 + dh / 2} textAnchor="middle" fill="#f59e0b" fontSize={10} transform={`rotate(-90, 16, ${20 + dh / 2})`}>{results.flatLength.toFixed(1)} mm</text>
                    </svg>
                  );
                })()}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-600">
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b" }} /> Base Sheet</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "rgba(167,139,250,0.2)", border: "1px solid #a78bfa" }} /> Flanges</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: "rgba(96,165,250,0.2)", border: "1px solid #60a5fa" }} /> Hems</div>
              </div>
            </div>

            {/* Bend details table */}
            {results.bendDetails.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="p-3 text-xs font-semibold text-zinc-400" style={{ background: "rgba(255,255,255,0.03)" }}>
                  Bend Calculation Details
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                      {["#", "Type", "Angle", "Radius", "Bend Allowance", "Bend Deduction", "OSSB", "K-Factor"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-zinc-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spec.bends.map((b, i) => {
                      const det = results.bendDetails[i];
                      return (
                        <tr key={b.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                          <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
                          <td className="px-3 py-2 text-zinc-300 capitalize">{b.flangeType || b.hemType} {b.type}</td>
                          <td className="px-3 py-2 font-mono text-zinc-400">{b.angle}°</td>
                          <td className="px-3 py-2 font-mono text-zinc-400">{b.radius} mm</td>
                          <td className="px-3 py-2 font-mono text-amber-400">{det.bendAllowance.toFixed(3)} mm</td>
                          <td className="px-3 py-2 font-mono text-blue-400">{det.bendDeduction.toFixed(3)} mm</td>
                          <td className="px-3 py-2 font-mono text-zinc-400">{det.outsideSetback.toFixed(3)} mm</td>
                          <td className="px-3 py-2 font-mono text-emerald-400">{det.kFactor}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Export buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportDXF}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}
              >
                <FileDown className="w-3.5 h-3.5" /> Export DXF (Flat Pattern)
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#71717a" }}>
                <Download className="w-3.5 h-3.5" /> Export PDF Report
              </button>
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#71717a" }}>
                <Copy className="w-3.5 h-3.5" /> Copy Flat Dimensions
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
