import React, { useState, useMemo } from "react";
import {
  Layers, ArrowRight, Settings, ChevronDown, ChevronRight, Triangle,
  RotateCcw, Download, Check, AlertTriangle, Zap
} from "lucide-react";

type ProfileType = "trapezoidal" | "corrugated" | "standing-seam" | "sandwich";

interface TrapezeSpec {
  profileType: ProfileType;
  pitch: number;
  depth: number;
  topWidth: number;
  bottomWidth: number;
  thickness: number;
  material: string;
  yieldStrength: number;
  corrugationRadius: number;
  coverWidth: number;
  overlap: number;
}

interface BendStep {
  station: number;
  angle: number;
  description: string;
  zone: string;
  rollDia: number;
  force: number;
  strain: number;
}

function calcBendSequence(spec: TrapezeSpec): BendStep[] {
  const { profileType, depth, thickness, pitch, yieldStrength, topWidth, bottomWidth, corrugationRadius } = spec;
  const t = thickness;
  const steps: BendStep[] = [];

  const webAngle = Math.atan2(depth, (bottomWidth - topWidth) / 2) * (180 / Math.PI);
  const totalBends = profileType === "corrugated" ? 2 : 4;

  let numStations: number;
  if (profileType === "corrugated") {
    numStations = depth > 30 ? 12 : depth > 15 ? 8 : 6;
  } else if (profileType === "standing-seam") {
    numStations = 14;
  } else if (profileType === "sandwich") {
    numStations = 10;
  } else {
    numStations = webAngle > 75 ? 14 : webAngle > 60 ? 12 : 10;
  }

  const bendPerStation = webAngle / numStations;

  for (let i = 1; i <= numStations; i++) {
    const progress = i / numStations;
    const currentAngle = Math.min(progress * webAngle * 1.05, webAngle);

    let zone: string;
    if (progress <= 0.25) zone = "Pre-Bend";
    else if (progress <= 0.6) zone = "Major Forming";
    else if (progress <= 0.85) zone = "Finishing";
    else zone = "Calibration";

    const r = corrugationRadius || t * 3;
    const outerStrain = t / (2 * (r + t / 2)) * 100;
    const bendForce = (yieldStrength * t * t * pitch) / (6 * r * 1000);

    steps.push({
      station: i,
      angle: Math.round(currentAngle * 10) / 10,
      description: profileType === "corrugated"
        ? `Corrugation forming ${(currentAngle).toFixed(0)}°`
        : `Web bend ${(currentAngle).toFixed(0)}°`,
      zone,
      rollDia: 180 + (i % 2 === 0 ? 20 : 0),
      force: Math.round(bendForce * (0.6 + 0.4 * progress)),
      strain: Math.round(outerStrain * progress * 100) / 100,
    });
  }

  return steps;
}

export function RFTrapezeView() {
  const [spec, setSpec] = useState<TrapezeSpec>({
    profileType: "trapezoidal",
    pitch: 200,
    depth: 35,
    topWidth: 90,
    bottomWidth: 120,
    thickness: 0.5,
    material: "GI Steel",
    yieldStrength: 280,  // FIX: GI yield 250→280 MPa (IS 277 Z180)
    corrugationRadius: 3,
    coverWidth: 1000,
    overlap: 50,
  });
  const [expandedSection, setExpandedSection] = useState("geometry");

  const bendSteps = useMemo(() => calcBendSequence(spec), [spec]);

  const repeats = Math.floor((spec.coverWidth - spec.overlap) / spec.pitch);
  const effectiveWidth = repeats * spec.pitch + spec.overlap;
  const developedLen = spec.profileType === "corrugated"
    ? spec.pitch * 1.15
    : spec.topWidth + 2 * Math.sqrt(spec.depth * spec.depth + ((spec.bottomWidth - spec.topWidth) / 2) * ((spec.bottomWidth - spec.topWidth) / 2)) + (spec.pitch - spec.bottomWidth);
  const totalStripWidth = developedLen * repeats + spec.overlap;

  const updateSpec = (key: keyof TrapezeSpec, val: any) => setSpec(prev => ({ ...prev, [key]: val }));

  const Section = ({ id, title, icon, children }: any) => (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <button onClick={() => setExpandedSection(expandedSection === id ? "" : id)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04]">
        {icon}
        <span className="text-[11px] font-semibold text-zinc-300 flex-1 text-left">{title}</span>
        {expandedSection === id ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
      </button>
      {expandedSection === id && <div className="p-3 space-y-2 bg-[#0a0a15]">{children}</div>}
    </div>
  );

  const Inp = ({ label, value, onChange, unit }: any) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-28">{label}</span>
      <input type="number" value={value} onChange={(e: any) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200 w-20" step={0.1} />
      {unit && <span className="text-[9px] text-zinc-600 w-10">{unit}</span>}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-orange-500/5 to-transparent">
        <Triangle className="w-5 h-5 text-orange-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF Trapeze / Corrugated</div>
          <div className="text-[10px] text-zinc-500">Automated Bending Sequences for Trapezoidal & Corrugated Profiles</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400">
            {bendSteps.length} Steps
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
            {repeats} Repeats
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[300px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <Section id="geometry" title="Profile Geometry" icon={<Triangle className="w-3.5 h-3.5 text-orange-400" />}>
            <div className="flex gap-1 mb-2">
              {(["trapezoidal", "corrugated", "standing-seam", "sandwich"] as ProfileType[]).map(pt => (
                <button key={pt} onClick={() => updateSpec("profileType", pt)}
                  className={`flex-1 text-[8px] py-1 rounded border ${spec.profileType === pt ? "bg-orange-500/20 border-orange-500/30 text-orange-300" : "border-white/[0.06] text-zinc-500"}`}>
                  {pt.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}
                </button>
              ))}
            </div>
            <Inp label="Pitch" value={spec.pitch} onChange={(v: number) => updateSpec("pitch", v)} unit="mm" />
            <Inp label="Depth" value={spec.depth} onChange={(v: number) => updateSpec("depth", v)} unit="mm" />
            {spec.profileType !== "corrugated" && (
              <>
                <Inp label="Top Width" value={spec.topWidth} onChange={(v: number) => updateSpec("topWidth", v)} unit="mm" />
                <Inp label="Bottom Width" value={spec.bottomWidth} onChange={(v: number) => updateSpec("bottomWidth", v)} unit="mm" />
              </>
            )}
            <Inp label="Thickness" value={spec.thickness} onChange={(v: number) => updateSpec("thickness", v)} unit="mm" />
            <Inp label="Bend Radius" value={spec.corrugationRadius} onChange={(v: number) => updateSpec("corrugationRadius", v)} unit="mm" />
            <Inp label="Cover Width" value={spec.coverWidth} onChange={(v: number) => updateSpec("coverWidth", v)} unit="mm" />
            <Inp label="Overlap" value={spec.overlap} onChange={(v: number) => updateSpec("overlap", v)} unit="mm" />
          </Section>

          <Section id="material" title="Material" icon={<Layers className="w-3.5 h-3.5 text-blue-400" />}>
            <Inp label="Yield Strength" value={spec.yieldStrength} onChange={(v: number) => updateSpec("yieldStrength", v)} unit="MPa" />
          </Section>

          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1">
            <div className="text-[10px] font-bold text-zinc-400">Calculation Summary</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <span className="text-zinc-500">Developed Length</span><span className="text-blue-300 text-right">{developedLen.toFixed(1)} mm</span>
              <span className="text-zinc-500">Strip Width</span><span className="text-orange-300 text-right">{totalStripWidth.toFixed(1)} mm</span>
              <span className="text-zinc-500">Effective Cover</span><span className="text-zinc-300 text-right">{effectiveWidth.toFixed(1)} mm</span>
              <span className="text-zinc-500">Ribs / Sheet</span><span className="text-green-300 text-right">{repeats}</span>
              <span className="text-zinc-500">Web Angle</span><span className="text-amber-300 text-right">{(Math.atan2(spec.depth, (spec.bottomWidth - spec.topWidth) / 2) * 180 / Math.PI).toFixed(1)}°</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
            Bending Sequence — {spec.profileType.charAt(0).toUpperCase() + spec.profileType.slice(1)} Profile
          </div>

          <div className="mb-4">
            <div className="flex items-end gap-1 h-28 px-2">
              {bendSteps.map((s, i) => {
                const maxA = bendSteps[bendSteps.length - 1]?.angle || 90;
                const h = (s.angle / maxA) * 100;
                const c = s.zone === "Pre-Bend" ? "bg-blue-500" : s.zone === "Major Forming" ? "bg-orange-500" : s.zone === "Finishing" ? "bg-amber-500" : "bg-green-500";
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[7px] text-zinc-600">{s.angle}°</span>
                    <div className={`w-full rounded-t ${c}`} style={{ height: `${h}%`, minHeight: 3, opacity: 0.7 }} />
                    <span className="text-[7px] text-zinc-600">{s.station}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {["#", "Zone", "Angle", "Roll Ø", "Force", "Strain"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bendSteps.map(s => (
                <tr key={s.station} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-2 py-1 text-zinc-500 font-mono">{s.station}</td>
                  <td className="px-2 py-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      s.zone === "Pre-Bend" ? "bg-blue-500/10 text-blue-400" :
                      s.zone === "Major Forming" ? "bg-orange-500/10 text-orange-400" :
                      s.zone === "Finishing" ? "bg-amber-500/10 text-amber-400" :
                      "bg-green-500/10 text-green-400"
                    }`}>{s.zone}</span>
                  </td>
                  <td className="px-2 py-1 text-zinc-300 font-mono">{s.angle}°</td>
                  <td className="px-2 py-1 text-zinc-300">{s.rollDia}mm</td>
                  <td className="px-2 py-1 text-amber-300">{s.force}N</td>
                  <td className="px-2 py-1 text-red-300">{s.strain}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Max Forming Force</div>
              <div className="text-lg font-bold text-amber-400">{Math.max(...bendSteps.map(s => s.force))} N</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Max Strain</div>
              <div className="text-lg font-bold text-red-400">{Math.max(...bendSteps.map(s => s.strain)).toFixed(2)}%</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Total Stations</div>
              <div className="text-lg font-bold text-green-400">{bendSteps.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
