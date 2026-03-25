import React, { useState, useMemo } from "react";
import {
  Circle, Square, ArrowRight, Check, AlertTriangle,
  ChevronDown, ChevronRight, Layers, Settings
} from "lucide-react";

interface DieSpec {
  inputShape: "round" | "rectangular";
  outputShape: "rectangular" | "shaped" | "oval";
  inputDia: number;
  outputWidth: number;
  outputHeight: number;
  outputCornerR: number;
  thickness: number;
  material: string;
  yieldStrength: number;
  numStages: number;
  reductionPerPass: number;
}

interface DieStage {
  stage: number;
  width: number;
  height: number;
  cornerR: number;
  area: number;
  reduction: number;
  perimeter: number;
  drawForce: number;
  description: string;
}

function calcTransitionStages(spec: DieSpec): DieStage[] {
  const stages: DieStage[] = [];
  const { inputDia, outputWidth, outputHeight, outputCornerR, numStages, yieldStrength, thickness } = spec;
  const t = thickness;

  const inputR = inputDia / 2;
  const inputArea = Math.PI * inputR * inputR;
  const inputPerimeter = Math.PI * inputDia;

  const outR = outputCornerR || t * 2;
  const finalArea = outputWidth * outputHeight - (4 - Math.PI) * outR * outR;
  const finalPerimeter = 2 * (outputWidth + outputHeight) - 8 * outR + 2 * Math.PI * outR;

  for (let i = 0; i <= numStages; i++) {
    const progress = i / numStages;
    const eased = Math.pow(progress, 0.8);

    const currentArea = inputArea + (finalArea - inputArea) * eased;
    const currentPerimeter = inputPerimeter + (finalPerimeter - inputPerimeter) * eased;

    let w: number, h: number, cr: number;
    if (i === 0) {
      w = inputDia;
      h = inputDia;
      cr = inputR;
    } else if (i === numStages) {
      w = outputWidth;
      h = outputHeight;
      cr = outR;
    } else {
      const aspectStart = 1;
      const aspectEnd = outputWidth / outputHeight;
      const aspect = aspectStart + (aspectEnd - aspectStart) * eased;
      h = Math.sqrt(currentArea / aspect);
      w = h * aspect;
      cr = inputR + (outR - inputR) * eased;
    }

    const prevArea = i > 0 ? stages[i - 1].area : inputArea;
    const reduction = prevArea > 0 ? ((prevArea - currentArea) / prevArea) * 100 : 0;

    const drawStress = reduction > 0 ? yieldStrength * Math.log(prevArea / currentArea) : 0;
    const drawForce = drawStress * currentPerimeter * t;

    let desc: string;
    if (i === 0) desc = "Input (Round)";
    else if (i === numStages) desc = "Final Shape";
    else if (progress < 0.3) desc = "Initial Transition";
    else if (progress < 0.7) desc = "Intermediate";
    else desc = "Near-Final";

    stages.push({
      stage: i,
      width: Math.round(w * 10) / 10,
      height: Math.round(h * 10) / 10,
      cornerR: Math.round(cr * 10) / 10,
      area: Math.round(currentArea * 10) / 10,
      reduction: Math.round(reduction * 100) / 100,
      perimeter: Math.round(currentPerimeter * 10) / 10,
      drawForce: Math.round(drawForce),
      description: desc,
    });
  }

  return stages;
}

export function DrawingDiesView() {
  const [spec, setSpec] = useState<DieSpec>({
    inputShape: "round",
    outputShape: "rectangular",
    inputDia: 50,
    outputWidth: 60,
    outputHeight: 30,
    outputCornerR: 5,
    thickness: 1.5,
    material: "CR Steel",
    yieldStrength: 340,  // FIX: CR Steel yield 280→340 MPa (IS 513 CR4)
    numStages: 6,
    reductionPerPass: 15,
  });

  const stages = useMemo(() => calcTransitionStages(spec), [spec]);
  const maxForce = Math.max(...stages.map(s => s.drawForce));
  const totalReduction = stages.length > 1
    ? ((stages[0].area - stages[stages.length - 1].area) / stages[0].area * 100)
    : 0;

  const updateSpec = (key: keyof DieSpec, val: any) => setSpec(prev => ({ ...prev, [key]: val }));

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-pink-500/5 to-transparent">
        <Circle className="w-5 h-5 text-pink-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis RF Drawing Dies</div>
          <div className="text-[10px] text-zinc-500">Round-to-Rectangular Tube Transition — Intermediate Stage Calculation</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/20 text-pink-400">
            {spec.numStages + 1} Stages
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400">
            {totalReduction.toFixed(1)}% Total Red.
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-3 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Input Shape</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-20">Input Ø</span>
            <input type="number" value={spec.inputDia} onChange={e => updateSpec("inputDia", parseFloat(e.target.value) || 0)}
              className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
            <span className="text-[9px] text-zinc-600">mm</span>
          </div>

          <div className="text-[10px] font-bold text-zinc-400 mt-2">Output Shape</div>
          {[
            { label: "Width", key: "outputWidth" },
            { label: "Height", key: "outputHeight" },
            { label: "Corner R", key: "outputCornerR" },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={(spec as any)[key]}
                onChange={e => updateSpec(key as any, parseFloat(e.target.value) || 0)}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              <span className="text-[9px] text-zinc-600">mm</span>
            </div>
          ))}

          <div className="text-[10px] font-bold text-zinc-400 mt-2">Process</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-20">Thickness</span>
            <input type="number" value={spec.thickness} onChange={e => updateSpec("thickness", parseFloat(e.target.value) || 0)}
              step={0.1}
              className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
            <span className="text-[9px] text-zinc-600">mm</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-20">Yield (σy)</span>
            <input type="number" value={spec.yieldStrength} onChange={e => updateSpec("yieldStrength", parseFloat(e.target.value) || 0)}
              className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
            <span className="text-[9px] text-zinc-600">MPa</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-20">Stages</span>
            <input type="number" value={spec.numStages} onChange={e => updateSpec("numStages", parseInt(e.target.value) || 3)}
              min={2} max={15}
              className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-pink-400" />
            Shape Transition — Round Ø{spec.inputDia} → Rect {spec.outputWidth}×{spec.outputHeight}
          </div>

          <div className="bg-[#0c0c1a] rounded-lg border border-white/[0.06] p-4 mb-4">
            <svg viewBox="0 0 800 200" className="w-full h-40">
              {stages.map((s, i) => {
                const x = 50 + i * (700 / stages.length);
                const maxDim = Math.max(spec.inputDia, spec.outputWidth, spec.outputHeight);
                const scale = 80 / maxDim;
                const w = s.width * scale;
                const h = s.height * scale;
                const cr = s.cornerR * scale;
                const cx = x;
                const cy = 100;

                if (i === 0) {
                  return (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r={w / 2} fill="none" stroke="#ec4899" strokeWidth={1.5} />
                      <text x={cx} y={160} textAnchor="middle" fill="#666" fontSize={8}>Ø{s.width}</text>
                      <text x={cx} y={172} textAnchor="middle" fill="#888" fontSize={7}>{s.description}</text>
                    </g>
                  );
                }

                return (
                  <g key={i}>
                    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h}
                      rx={cr} ry={cr}
                      fill="none" stroke={i === stages.length - 1 ? "#22c55e" : "#60a5fa"} strokeWidth={1.5} />
                    <text x={cx} y={160} textAnchor="middle" fill="#666" fontSize={7}>
                      {s.width.toFixed(0)}×{s.height.toFixed(0)}
                    </text>
                    <text x={cx} y={172} textAnchor="middle" fill="#888" fontSize={7}>{s.description}</text>
                    {i < stages.length - 1 && (
                      <line x1={cx + w / 2 + 5} y1={cy} x2={cx + (700 / stages.length) - w / 2 - 5} y2={cy}
                        stroke="#444" strokeWidth={0.5} markerEnd="url(#arrowhead)" />
                    )}
                  </g>
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="#666" />
                </marker>
              </defs>
            </svg>
          </div>

          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                {["Stage", "Width", "Height", "Corner R", "Area", "Reduction", "Perim.", "Draw Force", "Type"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left text-zinc-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stages.map(s => (
                <tr key={s.stage} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-2 py-1 font-mono text-zinc-500">{s.stage}</td>
                  <td className="px-2 py-1 text-zinc-300">{s.width}mm</td>
                  <td className="px-2 py-1 text-zinc-300">{s.height}mm</td>
                  <td className="px-2 py-1 text-zinc-300">R{s.cornerR}</td>
                  <td className="px-2 py-1 text-blue-300">{s.area}mm²</td>
                  <td className="px-2 py-1 text-amber-300">{s.reduction}%</td>
                  <td className="px-2 py-1 text-zinc-300">{s.perimeter}mm</td>
                  <td className="px-2 py-1 text-red-300">{s.drawForce}N</td>
                  <td className="px-2 py-1"><span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    s.stage === 0 ? "bg-pink-500/10 text-pink-400" :
                    s.stage === stages.length - 1 ? "bg-green-500/10 text-green-400" :
                    "bg-blue-500/10 text-blue-400"
                  }`}>{s.description}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Max Draw Force</div>
              <div className="text-lg font-bold text-red-400">{(maxForce / 1000).toFixed(1)} kN</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Total Area Reduction</div>
              <div className="text-lg font-bold text-amber-400">{totalReduction.toFixed(1)}%</div>
            </div>
            <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <div className="text-[10px] text-zinc-500 mb-1">Transition Stages</div>
              <div className="text-lg font-bold text-pink-400">{spec.numStages + 1}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
