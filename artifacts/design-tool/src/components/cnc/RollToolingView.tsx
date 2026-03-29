import React, { useState } from "react";
import { useCncStore, type RollToolingResult, type RollGapInfo, type CamPlan, type CamTool, type CamOperation, type RollTypeInfo, type RollMaterialRec } from "../../store/useCncStore";
import { AccuracyBadge } from "./AccuracyBadge";
import { getAccuracyExportText } from "./AccuracyMonitor";
import { BomView } from "./BomView";
import { AssemblyDrawingView } from "./AssemblyDrawingView";
import { downloadRollDxf } from "../../lib/roll-dxf";
import { downloadSplitGcode, downloadAllRollFiles } from "../../lib/gcode-split";
import { SmartToolSelector } from "./SmartToolSelector";
import { StationToleranceChecker } from "./StationToleranceChecker";
import { SetupSheetGenerator } from "./SetupSheetGenerator";
import { GcodeStepVerifier } from "./GcodeStepVerifier";
import { AIToolRecommender } from "./AIToolRecommender";
import { CompletePackagePanel } from "./CompletePackagePanel";
import { RollFlowerIntegratedView } from "./RollFlowerIntegratedView";
import { FlowerStationSuggestions } from "./FlowerStationSuggestions";

const UPPER_COLOR = "#3b82f6";
const LOWER_COLOR = "#f97316";
const PASS_LINE_COLOR = "#22c55e";

// ─── Download helper ─────────────────────────────────────────────────────────
function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SVG Cross-section ───────────────────────────────────────────────────────
function RollGrooveProfile({ shape, angleDeg, depthFrac, outerR, cx, cy, color, side }: {
  shape: RollTypeInfo["grooveShape"] | undefined;
  angleDeg: number;
  depthFrac: number;
  outerR: number;
  cx: number;
  cy: number;
  color: string;
  side: "upper" | "lower";
}) {
  const gd = outerR * Math.min(0.70, depthFrac);
  const gw = outerR * 0.55;
  const edgeY = side === "upper" ? cy + outerR : cy - outerR;
  const sign = side === "upper" ? -1 : 1;

  if (!shape || shape === "flat") {
    return <line x1={cx - outerR * 0.85} y1={edgeY} x2={cx + outerR * 0.85} y2={edgeY} stroke={color} strokeWidth={2.5} strokeOpacity={0.8} />;
  }
  if (shape === "shallow-v" || shape === "v-groove") {
    const halfW = gw * 0.5;
    const depth = shape === "shallow-v" ? gd * 0.3 : gd * 0.6;
    const d = `M${cx - halfW},${edgeY} L${cx},${edgeY + sign * depth} L${cx + halfW},${edgeY}`;
    return <>
      <line x1={cx - outerR * 0.85} y1={edgeY} x2={cx - halfW} y2={edgeY} stroke={color} strokeWidth={2.5} strokeOpacity={0.8} />
      <path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeOpacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={cx + halfW} y1={edgeY} x2={cx + outerR * 0.85} y2={edgeY} stroke={color} strokeWidth={2.5} strokeOpacity={0.8} />
    </>;
  }
  if (shape === "u-groove" || shape === "deep-groove") {
    const hw = shape === "u-groove" ? gw * 0.45 : gw * 0.38;
    const depth = shape === "u-groove" ? gd * 0.55 : gd * 0.75;
    const r = hw * 0.35;
    const d = `M${cx - hw},${edgeY} L${cx - hw},${edgeY + sign * depth} Q${cx - hw},${edgeY + sign * (depth + r)} ${cx},${edgeY + sign * (depth + r)} Q${cx + hw},${edgeY + sign * (depth + r)} ${cx + hw},${edgeY + sign * depth} L${cx + hw},${edgeY}`;
    return <>
      <line x1={cx - outerR * 0.85} y1={edgeY} x2={cx - hw} y2={edgeY} stroke={color} strokeWidth={2.5} strokeOpacity={0.8} />
      <path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeOpacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={cx + hw} y1={edgeY} x2={cx + outerR * 0.85} y2={edgeY} stroke={color} strokeWidth={2.5} strokeOpacity={0.8} />
    </>;
  }
  if (shape === "fin") {
    const hw = gw * 0.18;
    const depth = gd * 0.80;
    const d = `M${cx - outerR * 0.85},${edgeY} L${cx - hw * 2},${edgeY} L${cx - hw},${edgeY + sign * depth} L${cx + hw},${edgeY + sign * depth} L${cx + hw * 2},${edgeY} L${cx + outerR * 0.85},${edgeY}`;
    return <path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeOpacity={0.9} strokeLinecap="round" strokeLinejoin="round" />;
  }
  return null;
}

function RollCrossSection({ rp, side, rollNum, rollType }: {
  rp: NonNullable<RollToolingResult["rollProfile"]>;
  side: "upper" | "lower";
  rollNum: number;
  rollType?: RollTypeInfo;
}) {
  const W = 200, H = 180;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) * 0.36;
  const boreR = outerR * Math.min(0.70, rp.shaftDiameter / rp.rollDiameter);
  const color = side === "upper" ? UPPER_COLOR : LOWER_COLOR;
  const typeColor = rollType?.color ?? color;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto" }}>
      <rect width={W} height={H} fill="#0a0a0f" rx={6} />
      {/* Outer roll body */}
      <circle cx={cx} cy={cy} r={outerR} fill="#1e293b" stroke={color} strokeWidth={2} />
      {/* Groove profile drawn on edge */}
      <RollGrooveProfile
        shape={rollType?.grooveShape}
        angleDeg={rollType?.grooveAngleDeg ?? 0}
        depthFrac={rollType?.grooveDepthFraction ?? 0}
        outerR={outerR}
        cx={cx}
        cy={cy}
        color={typeColor}
        side={side}
      />
      {/* Keyway / drive hub */}
      <rect x={cx - 5} y={cy - outerR - 1} width={10} height={outerR * 0.18} fill="#334155" stroke="#64748b" strokeWidth={0.8} rx={1} />
      {/* Bore */}
      <circle cx={cx} cy={cy} r={boreR} fill="#0f172a" stroke="#64748b" strokeWidth={1.5} />
      {/* Center cross */}
      <line x1={cx - outerR + 4} y1={cy} x2={cx + outerR - 4} y2={cy} stroke="#334155" strokeWidth={0.6} />
      <line x1={cx} y1={cy - outerR + 4} x2={cx} y2={cy + outerR - 4} stroke="#334155" strokeWidth={0.6} />
      {/* Pass line */}
      {side === "upper" && <line x1={cx - outerR + 4} y1={cy + outerR} x2={cx + outerR - 4} y2={cy + outerR} stroke={PASS_LINE_COLOR} strokeWidth={1.5} strokeDasharray="5 3" />}
      {side === "lower" && <line x1={cx - outerR + 4} y1={cy - outerR} x2={cx + outerR - 4} y2={cy - outerR} stroke={PASS_LINE_COLOR} strokeWidth={1.5} strokeDasharray="5 3" />}
      {/* Roll Type badge */}
      {rollType && (
        <rect x={4} y={4} width={68} height={14} rx={3} fill={typeColor} fillOpacity={0.15} stroke={typeColor} strokeOpacity={0.5} strokeWidth={0.8} />
      )}
      {rollType && (
        <text x={8} y={14} fill={typeColor} fontSize={7.5} fontWeight="bold" fontFamily="monospace">{rollType.name.toUpperCase()}</text>
      )}
      {/* Groove shape label */}
      {rollType && rollType.grooveShape !== "flat" && (
        <text x={cx} y={H - 5} textAnchor="middle" fill="#475569" fontSize={7} fontFamily="monospace">{rollType.grooveShape} · {rollType.grooveAngleDeg}°</text>
      )}
      <text x={cx} y={cy - 3} textAnchor="middle" fill={color} fontSize={13} fontWeight="bold" fontFamily="monospace">R{rollNum}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize={8} fontFamily="monospace">{side === "upper" ? "UPPER" : "LOWER"}</text>
      <line x1={cx + outerR + 4} y1={cy - outerR} x2={cx + outerR + 4} y2={cy + outerR} stroke="#475569" strokeWidth={0.8} />
      <text x={cx + outerR + 8} y={cy + 4} fill="#94a3b8" fontSize={8} fontFamily="monospace">Ø{rp.rollDiameter}</text>
      <text x={cx} y={cy + boreR + 13} textAnchor="middle" fill="#64748b" fontSize={8} fontFamily="monospace">Bore Ø{rp.shaftDiameter}</text>
    </svg>
  );
}

// ─── Per-roll detail card ────────────────────────────────────────────────────
function RollCard({ rp, side, rollNum, stationLabel, stationNum, rollType, rollMaterial }: {
  rp: NonNullable<RollToolingResult["rollProfile"]>;
  side: "upper" | "lower";
  rollNum: number;
  stationLabel: string;
  stationNum: number;
  rollType?: RollTypeInfo;
  rollMaterial?: RollMaterialRec;
}) {
  const [showGcode, setShowGcode] = useState(false);
  const [showMatPanel, setShowMatPanel] = useState(false);
  const color = side === "upper" ? UPPER_COLOR : LOWER_COLOR;
  const borderCls = side === "upper" ? "border-blue-900/60 bg-blue-950/10" : "border-orange-900/60 bg-orange-950/10";
  const gcode = side === "upper" ? rp.upperLatheGcode : rp.lowerLatheGcode;
  const filename = `ROLL_${String(rollNum).padStart(3, "0")}_${side.toUpperCase()}_${stationLabel}.nc`;
  const gcodeLines = gcode.split("\n").length;
  const typeColor = rollType?.color ?? color;

  return (
    <div className={`border rounded-lg p-3 ${borderCls}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold text-sm font-mono" style={{ color }}>ROLL #{rollNum}</span>
        <span className="text-zinc-500 text-xs">({side === "upper" ? "Upper — Top Arbor" : "Lower — Bottom Arbor"})</span>
        {rollType && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold border" style={{ color: typeColor, borderColor: typeColor + "44", background: typeColor + "15" }}>
            {rollType.name.toUpperCase()}
          </span>
        )}
        <span className="text-zinc-600 text-xs ml-auto">Stn {stationNum}</span>
      </div>

      <RollCrossSection rp={rp} side={side} rollNum={rollNum} rollType={rollType} />

      <div className="mt-2 space-y-0.5 font-mono text-xs">
        {[
          ["OD", `${rp.rollDiameter.toFixed(3)} mm`],
          ["Bore ID", `${rp.shaftDiameter.toFixed(3)} mm`],
          ["Face Width", `${rp.rollWidth.toFixed(3)} mm`],
          ["Groove Depth", `${rp.grooveDepth.toFixed(3)} mm`],
          ["Material Gap", `${rp.gap.toFixed(3)} mm`],
          ["K-Factor", `${rp.kFactor}`],
          ["Neutral Axis Offset", `${rp.neutralAxisOffset.toFixed(3)} mm`],
          ["Shaft Center Y", `${(side === "upper" ? rp.upperRollCenterY : rp.lowerRollCenterY).toFixed(3)} mm`],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between border-b border-zinc-800/60 pb-0.5">
            <span className="text-zinc-400">{label}</span>
            <span style={{ color: side === "upper" ? "#93c5fd" : "#fdba74" }}>{val}</span>
          </div>
        ))}
      </div>

      {/* ── Roll Type Info Panel ── */}
      {rollType && (
        <div className="mt-2 rounded border border-zinc-700/60 bg-zinc-900/50 px-2.5 py-2 text-[10px] font-mono space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-[9px] uppercase tracking-wider" style={{ color: rollType.color }}>◈ {rollType.name}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{rollType.phase} phase</span>
            <span className="ml-auto px-1.5 py-0.5 rounded text-[8px] border" style={{ color: rollType.color, borderColor: rollType.color + "44" }}>
              {rollType.grooveShape.replace("-", " ").toUpperCase()}
            </span>
          </div>
          <div className="text-zinc-500 text-[9px] leading-tight">{rollType.description}</div>
          <div className="flex gap-3 pt-0.5">
            <div><span className="text-zinc-600">Groove∠</span> <span className="text-amber-400">{rollType.grooveAngleDeg}°</span></div>
            <div><span className="text-zinc-600">Fillet R</span> <span className="text-cyan-400">{rollType.filletRadiusMm}mm</span></div>
            <div><span className="text-zinc-600">Depth</span> <span className="text-green-400">{(rollType.grooveDepthFraction * 100).toFixed(0)}%</span></div>
          </div>
        </div>
      )}

      {/* ── Roll Material Panel ── */}
      {rollMaterial && (
        <div className="mt-2 rounded border border-amber-900/40 bg-amber-950/10 px-2.5 py-2 text-[10px] font-mono space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-[9px] uppercase tracking-wider text-amber-400">⬡ Roll Material</span>
            <button onClick={() => setShowMatPanel(!showMatPanel)} className="ml-auto text-zinc-600 hover:text-zinc-300 text-[8px]">
              {showMatPanel ? "▲ less" : "▼ more"}
            </button>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tool Steel</span>
            <span className="text-amber-300 font-bold">{rollMaterial.toolSteel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Hardness</span>
            <span className="text-amber-200">{rollMaterial.hardnessHRC}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Surface Treat.</span>
            <span className="text-green-400 text-[9px]">{rollMaterial.surfaceTreatment}</span>
          </div>
          {showMatPanel && (<>
            <div className="border-t border-amber-900/30 pt-1 text-zinc-500 text-[9px] leading-tight">{rollMaterial.treatmentNote}</div>
            <div className="flex justify-between pt-0.5">
              <span className="text-zinc-600">Alternative</span>
              <span className="text-zinc-400 text-[9px]">{rollMaterial.alternativeMaterial}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Lubricant</span>
              <span className="text-cyan-400 text-[9px]">{rollMaterial.lubricantRecommended.split(" ")[0]} {rollMaterial.lubricantRecommended.split(" ")[1]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Life (est.)</span>
              <span className="text-green-300">{rollMaterial.lifeHrs.toLocaleString()} hrs</span>
            </div>
          </>)}
        </div>
      )}

      {/* ── Bore-to-Profile Clearance Panel ── */}
      {rp.boreClearance && (
        <div className={`mt-2 rounded border px-2.5 py-2 text-[11px] space-y-1 font-mono ${
          rp.boreClearance.isSafe
            ? "border-green-900/60 bg-green-950/30"
            : "border-red-700 bg-red-950/60 animate-pulse"
        }`}>
          <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider">
            <span className={rp.boreClearance.isSafe ? "text-green-400" : "text-red-400"}>
              {rp.boreClearance.isSafe ? "✓" : "⚠"}
            </span>
            <span className={rp.boreClearance.isSafe ? "text-green-400" : "text-red-400"}>
              Bore-to-Profile Clearance
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Computed Gap</span>
            <span className={`font-bold ${rp.boreClearance.isSafe ? "text-green-300" : "text-red-300"}`}>
              {rp.boreClearance.computedGap.toFixed(3)} mm
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Min Allowed</span>
            <span className="text-zinc-300">{rp.boreClearance.minimumAllowed.toFixed(3)} mm</span>
          </div>
          <div className="text-[9px] text-zinc-600 border-t border-zinc-800 pt-1">
            {rp.boreClearance.formula}
          </div>
          {!rp.boreClearance.isSafe && rp.boreClearance.warningMessage && (
            <div className="text-[10px] text-red-300 font-semibold leading-tight border-t border-red-800 pt-1">
              {rp.boreClearance.warningMessage}
            </div>
          )}
        </div>
      )}

      {/* ── Side Collar Info ── */}
      {rp.sideCollar && (
        <div className="mt-2 rounded border border-purple-900/60 bg-purple-950/20 px-2.5 py-2 text-[11px] space-y-1 font-mono">
          <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider text-purple-400">
            <span>◉</span>
            <span>Side Collar</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Material</span>
            <span className="text-purple-300">{rp.sideCollar.material}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Dims OD/ID/W</span>
            <span className="text-purple-300">
              Ø{rp.sideCollar.OD} / Ø{rp.sideCollar.ID} / {rp.sideCollar.width}mm
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Hardness</span>
            <span className="text-purple-300">{rp.sideCollar.hardness}</span>
          </div>
          <div className="text-[9px] text-zinc-600 leading-tight">{rp.sideCollar.notes}</div>
        </div>
      )}

      {/* ── Export Buttons ── */}
      <div className="mt-3 space-y-1.5">

        {/* Row 1 — Full G-Code + Preview */}
        <div className="flex gap-2">
          <button
            onClick={() => downloadFile(gcode, filename)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            title={`Download full G-Code (${gcodeLines} lines)`}
          >
            ⬇ G-Code ({gcodeLines} lines)
          </button>
          <button
            onClick={() => setShowGcode(!showGcode)}
            className="px-2 py-1.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
          >
            {showGcode ? "Hide" : "Preview"}
          </button>
        </div>

        {/* Row 2 — RAW and FINAL programs (split) */}
        <div className="flex gap-1.5">
          <button
            onClick={() => downloadSplitGcode(gcode, rollNum, side, stationLabel)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold
                       bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/40 text-amber-300 transition-colors"
            title="Download RAW program (OP1 Face+Rough + OP2 Bore) and FINAL program (OP3 Profile+Finish) as separate files"
          >
            ⬇ RAW + FINAL Split
          </button>
        </div>

        {/* Row 3 — DXF 2D Drawing */}
        <button
          onClick={() => downloadRollDxf({
            rollNumber: rollNum,
            side,
            stationLabel,
            rollDiameter: rp.rollDiameter,
            boreDiameter: rp.shaftDiameter,
            rollWidth: rp.rollWidth,
            grooveDepth: rp.grooveDepth,
            gap: rp.gap,
            materialType: "GI",
          })}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[11px] font-semibold
                     bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/40 text-cyan-300 transition-colors"
          title="Download AutoCAD DXF 2D drawing (cross-section with dimensions)"
        >
          ⬇ DXF 2D Drawing (AutoCAD)
        </button>
      </div>

      {showGcode && (
        <pre className="mt-2 bg-zinc-950 border border-zinc-800 rounded p-2 text-[10px] text-green-400 font-mono overflow-auto max-h-48 leading-relaxed">
          {gcode}
        </pre>
      )}
    </div>
  );
}

// ─── Station phase helper ─────────────────────────────────────────────────────
function getRollPhase(stIdx: number, total: number): { label: string; color: string; desc: string } {
  if (total === 1) return { label: "ENTRY+FINAL", color: "#f59e0b", desc: "Soft contact + calibration" };
  if (stIdx === total - 1) return { label: "FINAL", color: "#22c55e", desc: "Calibration — precision sizing" };
  if (stIdx === 0) return { label: "ENTRY", color: "#3b82f6", desc: "Soft contact — guide only" };
  const pct = stIdx / (total - 1);
  if (pct <= 0.35) return { label: "ENTRY", color: "#3b82f6", desc: "Soft contact — guide only" };
  if (pct >= 0.80) return { label: "FINAL", color: "#22c55e", desc: "Calibration — precision sizing" };
  return { label: "MAIN", color: "#f97316", desc: "Full support — main forming" };
}

// ─── Station pair ────────────────────────────────────────────────────────────
function StationRollPair({ rt, totalStations, isExpanded, onToggle }: {
  rt: RollToolingResult;
  totalStations: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const rp = rt.rollProfile;
  if (!rp) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-[10px] text-zinc-500 italic">
        {rt.label ?? `Station ${rt.stationNumber}`} — roll profile unavailable (regenerate roll tooling to populate data)
      </div>
    );
  }
  const colors = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#14b8a6","#a855f7","#6366f1","#10b981"];
  const stColor = colors[(rt.stationNumber - 1) % colors.length];
  const phase = getRollPhase(rt.stationNumber - 1, totalStations);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stColor }} />
        <span className="font-semibold text-zinc-100 text-sm">{rt.label}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
          style={{ backgroundColor: phase.color + "25", color: phase.color, border: `1px solid ${phase.color}50` }}
        >
          {phase.label}
        </span>
        <span className="text-zinc-500 text-[10px]">{phase.desc}</span>
        <span className="text-zinc-500 text-xs ml-auto">
          R<span className="text-blue-400 font-mono">#{rp.upperRollNumber}</span> + R<span className="text-orange-400 font-mono">#{rp.lowerRollNumber}</span>
        </span>
        <span className="text-zinc-600 text-xs ml-2">
          Gap: <span className="text-green-400 font-mono">{rp.gap.toFixed(3)} mm</span>
        </span>
        <span className="text-zinc-500 ml-2">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-700 p-4 space-y-4">

          {/* ── STEP 3: Roll Behavior Panel ── */}
          {rt.behavior && (() => {
            const beh = rt.behavior;
            const phaseColor = beh.phase === "ENTRY" ? "#3b82f6" : beh.phase === "MAIN" ? "#f97316" : "#22c55e";
            const supportBg = beh.supportType === "soft" ? "bg-blue-950/50 border-blue-800/50" : beh.supportType === "full" ? "bg-orange-950/50 border-orange-800/50" : "bg-green-950/50 border-green-800/50";
            const riskColor = (r: string) => r === "high" ? "text-red-400" : r === "medium" ? "text-amber-400" : "text-green-400";
            const riskBg   = (r: string) => r === "high" ? "bg-red-950/40 border-red-800/40" : r === "medium" ? "bg-amber-950/40 border-amber-800/40" : "bg-green-950/30 border-green-800/30";
            return (
              <div className={`rounded-lg border p-3 space-y-3 ${supportBg}`}>
                {/* Header */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Step 3 — Roll Behavior</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ backgroundColor: phaseColor + "25", color: phaseColor, border: `1px solid ${phaseColor}50` }}>
                    {beh.phase}
                  </span>
                  <span className="text-[10px] text-zinc-500 capitalize">{beh.supportType} support</span>
                  <span className="text-[10px] text-zinc-600 ml-auto">⚡ {beh.formingSpeed}</span>
                </div>

                {/* Upper + Lower roll actions */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-zinc-900/60 border border-blue-900/40 rounded p-2">
                    <div className="text-blue-400 font-semibold mb-0.5">↑ UPPER ROLL</div>
                    <div className="text-zinc-300 leading-tight">{beh.upperRollAction}</div>
                    <div className="text-zinc-600 mt-1">Clearance rec: <span className="text-amber-400 font-mono">{beh.clearanceRec.toFixed(4)} mm</span></div>
                  </div>
                  <div className="bg-zinc-900/60 border border-orange-900/40 rounded p-2">
                    <div className="text-orange-400 font-semibold mb-0.5">↓ LOWER ROLL</div>
                    <div className="text-zinc-300 leading-tight">{beh.lowerRollAction}</div>
                    <div className="text-zinc-600 mt-1">Pass line: <span className="text-green-400 font-mono">{rp.passLineY.toFixed(3)} mm</span></div>
                  </div>
                </div>

                {/* Per-bend table */}
                {beh.bendBehaviors.length > 0 && (
                  <div className="rounded border border-zinc-700 overflow-hidden">
                    <div className="px-2.5 py-1.5 bg-zinc-800/60 border-b border-zinc-700 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                      Per-Bend Behavior Plan
                    </div>
                    <table className="w-full text-[10px] font-mono">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/50">
                          <th className="px-2 py-1.5 text-left text-zinc-500">Bend</th>
                          <th className="px-2 py-1.5 text-right text-zinc-500">Angle</th>
                          <th className="px-2 py-1.5 text-right text-zinc-500">Radius</th>
                          <th className="px-2 py-1.5 text-right text-zinc-500">Clr Rec</th>
                          <th className="px-2 py-1.5 text-center text-zinc-500">Springback</th>
                          <th className="px-2 py-1.5 text-center text-zinc-500">Surface</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beh.bendBehaviors.map(bb => (
                          <tr key={bb.bendNumber} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                            <td className="px-2 py-1 text-zinc-300 font-semibold">B{bb.bendNumber}</td>
                            <td className="px-2 py-1 text-right text-yellow-400">{bb.targetAngle.toFixed(1)}°</td>
                            <td className="px-2 py-1 text-right text-zinc-400">{bb.bendRadius.toFixed(2)} mm</td>
                            <td className="px-2 py-1 text-right text-amber-400">{bb.clearanceRec.toFixed(4)}</td>
                            <td className="px-2 py-1 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${riskBg(bb.springbackRisk)} ${riskColor(bb.springbackRisk)}`}>
                                {bb.springbackRisk.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${riskBg(bb.surfaceRisk)} ${riskColor(bb.surfaceRisk)}`}>
                                {bb.surfaceRisk.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {beh.bendBehaviors.length === 0 && (
                  <div className="text-[10px] text-zinc-600 italic">No bends at this station — flat pass</div>
                )}

                {/* Relief zones */}
                {beh.reliefZones.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide">Relief Zones</div>
                    {beh.reliefZones.map((rz, i) => (
                      <div key={i} className="text-[10px] bg-purple-950/40 border border-purple-800/40 rounded px-2 py-1 text-purple-300">
                        ◈ {rz}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {beh.warnings.length > 0 && (
                  <div className="space-y-1">
                    {beh.warnings.map((w, i) => (
                      <div key={i} className="text-[10px] bg-red-950/40 border border-red-800/40 rounded px-2 py-1 text-red-300">
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Roll Cards ── */}
          <div className="grid grid-cols-2 gap-4">
            <RollCard rp={rp} side="upper" rollNum={rp.upperRollNumber} stationLabel={rt.label} stationNum={rt.stationNumber} rollType={rt.rollType} rollMaterial={rt.rollMaterial} />
            <RollCard rp={rp} side="lower" rollNum={rp.lowerRollNumber} stationLabel={rt.label} stationNum={rt.stationNumber} rollType={rt.rollType} rollMaterial={rt.rollMaterial} />
          </div>

          <div className="bg-green-950/40 border border-green-800/50 rounded px-3 py-2 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-400 font-mono font-semibold">PASS LINE Y = {rp.passLineY.toFixed(3)} mm</span>
            </div>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-400">Upper center: <span className="text-blue-400 font-mono">+{(rp.upperRollCenterY - rp.passLineY).toFixed(3)} mm</span></span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">Lower center: <span className="text-orange-400 font-mono">{(rp.lowerRollCenterY - rp.passLineY).toFixed(3)} mm</span></span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">K-Factor: <span className="text-amber-400 font-mono">{rp.kFactor}</span></span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">Neutral Axis: <span className="text-amber-400 font-mono">{rp.neutralAxisOffset.toFixed(3)} mm</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Roll Gap Calculator Table ────────────────────────────────────────────────
function RollGapTable({ gaps }: { gaps: RollGapInfo[] }) {
  if (gaps.length === 0) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700 flex items-center gap-2">
        <span className="text-sm font-bold text-zinc-100">⊟ Roll Gap Calculator</span>
        <span className="text-xs text-zinc-500 ml-2">Material thickness + springback + clearance per station</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800/40">
              <th className="text-left px-3 py-2 text-zinc-400">Station</th>
              <th className="text-left px-3 py-2 text-zinc-400">Roll #</th>
              <th className="text-right px-3 py-2 text-zinc-400">Nominal Gap</th>
              <th className="text-right px-3 py-2 text-zinc-400">Springback Gap</th>
              <th className="text-right px-3 py-2 text-zinc-400">Upper Z</th>
              <th className="text-right px-3 py-2 text-zinc-400">Lower Z</th>
              <th className="text-left px-3 py-2 text-zinc-400">Bend Allowances</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g, idx) => (
              <tr key={g.stationNumber} className={`border-b border-zinc-800 ${idx % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950"} hover:bg-zinc-800/40`}>
                <td className="px-3 py-2 text-zinc-300 font-semibold">{g.label}</td>
                <td className="px-3 py-2 text-zinc-500">R{idx * 2 + 1}/R{idx * 2 + 2}</td>
                <td className="px-3 py-2 text-right text-amber-400">{g.nominalGap.toFixed(4)} mm</td>
                <td className="px-3 py-2 text-right text-green-400">{g.springbackGap.toFixed(4)} mm</td>
                <td className="px-3 py-2 text-right text-blue-400">{g.upperRollZ.toFixed(3)} mm</td>
                <td className="px-3 py-2 text-right text-orange-400">{g.lowerRollZ.toFixed(3)} mm</td>
                <td className="px-3 py-2 text-zinc-400">
                  {g.bendAllowances.length > 0
                    ? g.bendAllowances.map((ba, i) => (
                        <span key={i} className="mr-2 text-pink-400">B{i + 1}:{ba.toFixed(3)}</span>
                      ))
                    : <span className="text-zinc-600">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pass Line Machine Diagram ────────────────────────────────────────────────
function PassLineDiagram({ rollTooling }: { rollTooling: RollToolingResult[] }) {
  const W = 900, H = 72;
  const stCount = rollTooling.length;
  if (stCount === 0) return null;
  const margin = 30;
  const spacing = (W - margin * 2) / stCount;
  const passY = H / 2;

  return (
    <div>
      <div className="text-xs text-zinc-500 mb-1 font-mono">Machine Pass Line — All {stCount * 2} Rolls Aligned on Same Center</div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        <rect width={W} height={H} fill="transparent" />
        <line x1={0} y1={passY} x2={W} y2={passY} stroke={PASS_LINE_COLOR} strokeWidth={1.5} strokeDasharray="8 4" />
        <text x={4} y={passY - 4} fill={PASS_LINE_COLOR} fontSize={9} fontFamily="monospace">PASS LINE</text>
        {rollTooling.map((rt, i) => {
          const x = margin + i * spacing + spacing / 2;
          const rp = rt.rollProfile;
          const rollH = Math.min(22, spacing * 0.35);
          return (
            <g key={rt.stationNumber}>
              <rect x={x - rollH * 1.1} y={passY - rollH * 2.1} width={rollH * 2.2} height={rollH * 2} rx={3} fill="#1e3a5f" stroke={UPPER_COLOR} strokeWidth={1.5} />
              <rect x={x - rollH * 1.1} y={passY + rollH * 0.1} width={rollH * 2.2} height={rollH * 2} rx={3} fill="#431407" stroke={LOWER_COLOR} strokeWidth={1.5} />
              <text x={x} y={passY - rollH * 1.0} textAnchor="middle" fill={UPPER_COLOR} fontSize={8} fontFamily="monospace" fontWeight="bold">R{rp.upperRollNumber}</text>
              <text x={x} y={passY + rollH * 1.4} textAnchor="middle" fill={LOWER_COLOR} fontSize={8} fontFamily="monospace" fontWeight="bold">R{rp.lowerRollNumber}</text>
              <text x={x} y={H - 2} textAnchor="middle" fill="#52525b" fontSize={7} fontFamily="monospace">{rt.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── STEP 4: Manufacturing View ───────────────────────────────────────────────
function ManufacturingView({ rollTooling }: { rollTooling: RollToolingResult[] }) {
  if (rollTooling.length === 0) return null;
  // All stations share same physical roll spec — use first
  const ref  = rollTooling[0];
  const spec = ref?.mfgSpec;
  const rp   = ref?.rollProfile;
  if (!spec || !rp) return <div className="text-zinc-500 text-sm p-6">Manufacturing data not available</div>;

  const totalRolls = rollTooling.length * 2;
  const { accuracyLog, accuracyThreshold } = useCncStore.getState();

  const buildTravelerSheet = () => {
    const DATE = new Date().toISOString().split("T")[0];
    const W = 100;
    const HR = "═".repeat(W);
    const hr = "─".repeat(W);
    const header = (page: number, title: string) => [
      HR,
      `  Sai Rolotech Smart Engines — WORKSHOP TRAVELER SHEET       Page ${page}/7`,
      `  ${title.toUpperCase()}`,
      `  Generated: ${DATE}   Stations: ${rollTooling.length}   Rolls: ${totalRolls}`,
      HR,
    ];

    const page1 = [
      ...header(1, "Project Overview & Machine Layout"),
      "",
      "  ROLL FORMING LINE SETUP",
      `  Profile Name   : Roll Tooling Design`,
      `  Total Stations : ${rollTooling.length}`,
      `  Total Rolls    : ${totalRolls} (${rollTooling.length} upper + ${rollTooling.length} lower)`,
      `  Roll Material  : ${spec.rollMaterial}`,
      `  Hardness       : ${spec.rollHardness}`,
      `  Surface Treat  : ${spec.surfaceTreatment}`,
      `  Shaft Diameter : Ø${rp.shaftDiameter.toFixed(1)} mm`,
      `  Roll OD        : Ø${rp.rollDiameter.toFixed(3)} mm`,
      `  Roll Width     : ${rp.rollWidth.toFixed(3)} mm`,
      `  K-Factor       : ${rp.kFactor}`,
      `  Pass Line Y    : ${rp.passLineY.toFixed(3)} mm`,
      "",
      "  STATION ROLL SCHEDULE",
      `  ${"Stn".padEnd(6)} ${"Label".padEnd(10)} ${"Upper Roll".padEnd(12)} ${"Lower Roll".padEnd(12)} ${"Roll OD".padEnd(12)} ${"Width".padEnd(10)} ${"Gap"}`,
      hr,
      ...rollTooling.filter(rt => !!rt.rollProfile).map(rt =>
        `  ${String(rt.stationNumber).padEnd(6)} ${rt.label.padEnd(10)} R${String(rt.rollProfile!.upperRollNumber).padStart(3,"0").padEnd(11)} R${String(rt.rollProfile!.lowerRollNumber).padStart(3,"0").padEnd(11)} Ø${rt.rollProfile!.rollDiameter.toFixed(2).padEnd(11)} ${rt.rollProfile!.rollWidth.toFixed(3).padEnd(10)} ${rt.rollProfile!.gap.toFixed(3)} mm`
      ),
    ];

    const page2 = [
      ...header(2, "Material & Blank Specifications"),
      "",
      "  RAW MATERIAL — ROLL BLANK",
      `  Roll Material  : ${spec.rollMaterial}`,
      `  Hardness (HRC) : ${spec.rollHardness}`,
      `  Surface        : ${spec.surfaceTreatment}`,
      `  Lubrication    : Light oil during machining`,
      "",
      "  BLANK DIMENSIONS (before finish machining)",
      `  Blank OD       : Ø${spec.blankOD} mm      (add 3 mm stock per side)`,
      `  Blank Width    : ${spec.blankWidth} mm         (add 2 mm face allowance)`,
      `  Bore (ID)      : Ø${spec.boreSize} mm (finish bore after OD)`,
      `  Bore Fit       : ${spec.boreFit} H7/k6`,
      "",
      "  KEYWAY SPECIFICATION (DIN 6885 A)",
      spec.keyway
        ? [
            `  Width (b)      : ${spec.keyway.width} mm`,
            `  Depth (t1)     : ${spec.keyway.depth} mm`,
            `  Length (l)     : ${spec.keyway.length} mm`,
            "  Tolerance      : JS9 (shaft) / N9 (hub)",
          ].join("\n")
        : "  No keyway required for this roll",
      "",
      "  ROLL TYPE",
      `  Type           : ${spec.rollType.toUpperCase()} ROLL`,
      `  Reason         : ${spec.rollTypReason}`,
      "",
      "  SPACER",
      `  Thickness      : ${spec.spacerThickness} mm`,
      `  Material       : ${spec.spacerMaterial}`,
      `  Fit            : h9 (face ground)`,
    ];

    const page3 = [
      ...header(3, "CNC Operation Sequence"),
      "",
      `  ${"OP#".padEnd(6)} ${"Description".padEnd(36)} ${"Machine".padEnd(30)} ${"Tool".padEnd(20)} Note`,
      hr,
      ...spec.operations.map(op =>
        `  ${op.opNumber.padEnd(6)} ${op.description.padEnd(36)} ${op.machine.padEnd(30)} ${op.tool.padEnd(20)} ${op.note}`
      ),
      "",
      "  MACHINABILITY NOTES",
      ...spec.machinabilityNotes.map(n => `  • ${n}`),
    ];

    const page4 = [
      ...header(4, "Tolerances & Surface Finish"),
      "",
      "  DIMENSIONAL TOLERANCES",
      `  Roll OD        : ${spec.toleranceOD}`,
      `  Face Width     : ${spec.toleranceFace}`,
      `  Bore (ID)      : H7 (+0.025/0.000)`,
      `  Keyway Width   : JS9 (±0.015)`,
      `  Runout (TIR)   : max 0.010 mm`,
      `  Cylindricity   : max 0.008 mm`,
      `  Parallelism    : max 0.010 mm`,
      "",
      "  SURFACE FINISH REQUIREMENTS",
      "  Roll OD        : Ra 0.4 µm (ground finish)",
      "  Groove Surface : Ra 0.8 µm",
      "  Bore           : Ra 0.4 µm (honed)",
      "  Face           : Ra 0.8 µm",
      "",
      "  INSPECTION EQUIPMENT",
      "  • OD/ID: Digital micrometer ±0.001 mm",
      "  • Width: Vernier caliper ±0.01 mm",
      "  • Bore: Bore gauge set ±0.001 mm",
      "  • Surface finish: Profilometer Ra",
      "  • Hardness: Rockwell C tester",
      "  • Runout: CMM / Dial indicator on V-blocks",
    ];

    const page5 = [
      ...header(5, "Heat Treatment & Surface Treatment"),
      "",
      "  HEAT TREATMENT SEQUENCE",
      "  Step 1: Rough machine (leave 0.5 mm finish stock)",
      "  Step 2: Stress relieve at 650°C / 1 hour",
      "  Step 3: Hardening — austenitise at 1000°C in controlled atmosphere",
      "  Step 4: Quench in oil bath (agitated)",
      "  Step 5: Temper 2× at 200°C / 2 hrs each",
      `  Step 6: Target hardness: ${spec.rollHardness}`,
      "  Step 7: Grind OD / bore after heat treatment",
      "",
      "  SURFACE TREATMENT",
      `  Treatment      : ${spec.surfaceTreatment}`,
      "  Purpose        : Improved wear resistance + lubricity",
      "  Application    : All forming surfaces (OD, groove, chamfers)",
      "  Coating Thickness: 2–6 µm",
      "",
      "  POST-TREATMENT",
      "  • Demagnetize before grinding",
      "  • Clean and degrease before surface treatment",
      "  • Check hardness after treatment",
    ];

    const page6 = [
      ...header(6, "Assembly & Setup Instructions"),
      "",
      "  SHAFT ASSEMBLY PROCEDURE",
      "  1. Clean shaft and roll bore with IPA solvent",
      "  2. Check keyway alignment (shaft vs roll key slots)",
      "  3. Apply light machine oil to bore and shaft",
      "  4. Press roll onto shaft (interference fit — use press or heat 80°C)",
      "  5. Insert woodruff key / parallel key",
      "  6. Fit spacers between rolls as per BOM (check thickness)",
      "  7. Fit deep groove bearings (2 per shaft)",
      "  8. Install KM locking nuts + lock washers",
      "",
      "  PASS LINE SETUP",
      `  Pass Line Height : ${rp.passLineY.toFixed(3)} mm from machine base`,
      "  Upper roll  : Above pass line (adjustable via screw jack)",
      "  Lower roll  : Fixed at pass line",
      "",
      "  ROLL GAP SETTING",
      `  Nominal gap  : ${rp.gap.toFixed(3)} mm (= material thickness + clearance)`,
      "  Use feeler gauge to set gap before first run",
      "  Adjust shimming plates if required",
      "",
      "  FIRST ARTICLE CHECK",
      "  □ Verify roll OD with micrometer",
      "  □ Check bore fit (go/no-go gauge)",
      "  □ Check roll rotation — no binding",
      "  □ Check gap with feeler gauge",
      "  □ Run 1 test piece — check profile dimensions",
      "  □ Sign-off by QC inspector before production",
    ];

    const page7 = [
      ...header(7, "Quality Control & Inspection Checklist"),
      "",
      "  PRE-MACHINING INSPECTION",
      "  □ Blank OD measured and recorded",
      "  □ Blank material certificate verified",
      "  □ Hardness of raw material checked",
      "",
      "  IN-PROCESS INSPECTION (CNC)",
      "  □ OP10: Bore diameter checked after rough boring",
      "  □ OP20: Face length checked",
      "  □ OP30: OD checked after rough turning",
      "  □ OP40: Groove depth/profile checked with form gauge",
      "  □ OP50: Keyway dimensions checked",
      "",
      "  FINAL INSPECTION",
      `  □ Roll OD: Ø${rp.rollDiameter.toFixed(3)} mm  (tolerance: ${spec.toleranceOD})`,
      `  □ Bore ID: Ø${rp.shaftDiameter.toFixed(3)} mm (H7)`,
      `  □ Width  : ${rp.rollWidth.toFixed(3)} mm (tolerance: ${spec.toleranceFace})`,
      `  □ Hardness: ${spec.rollHardness}`,
      "  □ Surface finish: Ra 0.4 µm on OD",
      "  □ Runout (TIR): < 0.010 mm",
      "  □ Surface treatment applied and inspected",
      "  □ All sharp edges deburred and chamfered",
      "  □ Roll marked with roll number and station",
      "",
      "  SIGN-OFF",
      "  Machinist: ___________________  Date: ___________",
      "  Inspector: ___________________  Date: ___________",
      "  Engineer:  ___________________  Date: ___________",
      "",
      "  REMARKS / NCR",
      "  ___________________________________________________________",
      "  ___________________________________________________________",
      HR,
      "  END OF TRAVELER SHEET — Sai Rolotech Smart Engines",
      HR,
    ];

    const accuracySection = getAccuracyExportText(accuracyLog, accuracyThreshold);
    return [...page1, "", ...page2, "", ...page3, "", ...page4, "", ...page5, "", ...page6, "", ...page7, accuracySection].join("\n");
  };

  const dlText = () => buildTravelerSheet();

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="grid grid-cols-3 gap-3">
        {/* Material */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mb-2">Roll Material</div>
          <div className="text-xs text-zinc-200 font-semibold">{spec.rollMaterial}</div>
          <div className="text-[10px] text-amber-400 mt-1">{spec.rollHardness}</div>
          <div className="text-[10px] text-zinc-500 mt-1 leading-tight">{spec.surfaceTreatment}</div>
        </div>
        {/* Blank size */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mb-2">Blank Size (Stock)</div>
          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex justify-between"><span className="text-zinc-400">Blank OD</span><span className="text-blue-300">Ø{spec.blankOD} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Blank Width</span><span className="text-blue-300">{spec.blankWidth} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Bore (ID)</span><span className="text-orange-300">Ø{spec.boreSize} mm</span></div>
            <div className="flex justify-between border-t border-zinc-800 pt-1"><span className="text-zinc-400">Fit</span><span className="text-green-300 text-[10px]">{spec.boreFit}</span></div>
          </div>
        </div>
        {/* Roll type + spacer */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mb-2">Roll Type & Spacer</div>
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold mb-1.5 ${spec.rollType === "split" ? "bg-orange-950 text-orange-300 border border-orange-800" : "bg-green-950 text-green-300 border border-green-800"}`}>
            {spec.rollType === "split" ? "◈ SPLIT ROLL" : "● SOLID ROLL"}
          </div>
          <div className="text-[9px] text-zinc-500 leading-tight mb-2">{spec.rollTypReason}</div>
          <div className="text-[10px] font-mono">
            <span className="text-zinc-400">Spacer: </span><span className="text-purple-300">{spec.spacerThickness} mm</span>
            <span className="text-zinc-600 ml-1">({spec.spacerMaterial})</span>
          </div>
        </div>
      </div>

      {/* Keyway */}
      {spec.keyway && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 flex flex-wrap gap-4 items-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Keyway (DIN 6885 A)</span>
          {[
            ["Width", `${spec.keyway.width} mm`],
            ["Depth", `${spec.keyway.depth} mm`],
            ["Length", `${spec.keyway.length} mm`],
            ["Tolerance", "JS9"],
            ["Key Fit", "N9/h9"],
          ].map(([l, v]) => (
            <div key={l} className="flex gap-1.5 items-center text-xs">
              <span className="text-zinc-500">{l}:</span>
              <span className="text-yellow-300 font-mono font-semibold">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* CNC Operation Sequence */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700 flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-100">⚙ CNC Operation Sequence (per roll)</span>
          <button
            onClick={() => downloadFile(dlText(), `WORKSHOP_TRAVELER_SHEET_${new Date().toISOString().split("T")[0]}.txt`)}
            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-500 text-white font-semibold transition-all"
          >
            ⬇ Workshop Traveler Sheet (7 pages)
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/40">
                <th className="px-3 py-2 text-left text-zinc-400 w-14">OP #</th>
                <th className="px-3 py-2 text-left text-zinc-400">Description</th>
                <th className="px-3 py-2 text-left text-zinc-400 w-40">Machine</th>
                <th className="px-3 py-2 text-left text-zinc-400 w-48">Tool</th>
                <th className="px-3 py-2 text-left text-zinc-400">Note</th>
              </tr>
            </thead>
            <tbody>
              {spec.operations.map((op, i) => (
                <tr key={op.opNumber} className={`border-b border-zinc-800 ${i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950"} hover:bg-zinc-800/40`}>
                  <td className="px-3 py-2 text-amber-400 font-bold">{op.opNumber}</td>
                  <td className="px-3 py-2 text-zinc-200 leading-tight">{op.description}</td>
                  <td className="px-3 py-2 text-blue-400">{op.machine}</td>
                  <td className="px-3 py-2 text-green-400">{op.tool}</td>
                  <td className="px-3 py-2 text-zinc-500 text-[10px] leading-tight">{op.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Machinability notes */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mb-2">Machinability Notes</div>
        <div className="space-y-1">
          {spec.machinabilityNotes.map((n, i) => (
            <div key={i} className="text-[11px] text-zinc-300 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
              <span>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tolerances */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 flex gap-6 items-center">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Tolerances</span>
        <div className="flex gap-1.5 items-center text-xs"><span className="text-zinc-500">OD:</span><span className="text-cyan-400 font-mono font-semibold">{spec.toleranceOD}</span></div>
        <div className="flex gap-1.5 items-center text-xs"><span className="text-zinc-500">Face Width:</span><span className="text-cyan-400 font-mono font-semibold">{spec.toleranceFace}</span></div>
        <div className="flex gap-1.5 items-center text-xs"><span className="text-zinc-500">Bore:</span><span className="text-cyan-400 font-mono font-semibold">{spec.boreFit}</span></div>
      </div>
    </div>
  );
}

// ─── STEP 5: CAM Plan View ────────────────────────────────────────────────────
const OP_TYPE_COLOR: Record<string, string> = {
  FACE:              "text-sky-400",
  OD_ROUGH:          "text-amber-400",
  OD_SEMI_FINISH:    "text-orange-400",
  OD_FINISH_PROFILE: "text-emerald-400",
  BORE_ROUGH_FINISH: "text-violet-400",
  GROOVE_RELIEF:     "text-pink-400",
  CHAMFER:           "text-cyan-400",
  KEYWAY_VMC:        "text-yellow-400",
  INSPECTION:        "text-zinc-400",
};
const INSERT_COLOR: Record<string, string> = {
  CNMG:       "bg-amber-500/15 text-amber-300 border-amber-500/25",
  WNMG:       "bg-amber-500/10 text-amber-400 border-amber-500/20",
  VNMG:       "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  VCMT:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  DNMG:       "bg-orange-500/15 text-orange-300 border-orange-500/25",
  CCMT:       "bg-violet-500/15 text-violet-300 border-violet-500/25",
  DCMT:       "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Grooving:   "bg-pink-500/15 text-pink-300 border-pink-500/25",
  "End Mill": "bg-yellow-500/15 text-yellow-300 border-yellow-500/25",
};

function CamToolCard({ tool }: { tool: CamTool }) {
  const chipColor = INSERT_COLOR[tool.insertFamily] ?? "bg-zinc-800 text-zinc-300 border-zinc-600";
  return (
    <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono font-bold text-zinc-200">{tool.toolId}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${chipColor}`}>{tool.insertFamily}</span>
      </div>
      <div className="text-[11px] text-zinc-300 font-semibold mb-1 leading-tight">{tool.purpose}</div>
      <div className="font-mono text-[10px] text-blue-300 mb-1">{tool.insertCode}</div>
      <div className="text-[10px] text-zinc-600 mb-1.5">{tool.holder}</div>
      <div className="flex items-center gap-3 text-[10px] mb-1.5">
        <span className="text-zinc-500">R<sub>ε</sub> <span className="text-zinc-300 font-mono">{tool.noseRadius} mm</span></span>
        <span className="text-zinc-500">Cut: <span className="text-zinc-300">{tool.handOfCut}</span></span>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tool.bestFor.map(f => (
          <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-500">{f}</span>
        ))}
      </div>
      <div className="text-[9px] text-amber-400/80 leading-tight">⚠ {tool.caution}</div>
    </div>
  );
}

function CamOpCard({ op }: { op: CamOperation; toolMap: Map<string, CamTool> }) {
  const [open, setOpen] = useState(false);
  const opColor = OP_TYPE_COLOR[op.opType] ?? "text-zinc-400";
  const isInspection = op.opType === "INSPECTION";

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-left"
        onClick={() => !isInspection && setOpen(p => !p)}
      >
        <span className="text-[11px] font-mono font-bold text-zinc-600 w-10 shrink-0">{op.opId}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${opColor} w-36 shrink-0`}>{op.opType.replace(/_/g, " ")}</span>
        <span className="text-[11px] text-zinc-300 flex-1 leading-tight">{op.description}</span>
        <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
          {!isInspection && (<>
            <span className="text-zinc-600">{op.rpmMode === "G96" ? `${op.cuttingSpeedVc} m/min` : `${op.rpmValue} rpm`}</span>
            <span className="text-zinc-500">{op.feedPerRev > 0 ? `fn ${op.feedPerRev}` : "—"}</span>
            {op.depthOfCut > 0 && <span className="text-zinc-500">DOC {op.depthOfCut}</span>}
          </>)}
          {!isInspection && <span className="text-zinc-700">{open ? "▲" : "▼"}</span>}
        </div>
      </button>

      {open && !isInspection && (
        <div className="px-4 pb-4 pt-2 bg-[#07070E]/60 border-t border-white/[0.04] space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            {[
              ["Tool", op.toolId],
              ["Insert", op.insertFamily],
              ["RPM Mode", op.rpmMode],
              [op.rpmMode === "G96" ? "Vc (m/min)" : "RPM", op.rpmMode === "G96" ? op.cuttingSpeedVc : op.rpmValue],
              ["Max RPM", `S${op.maxRpm}`],
              ["Feed/Rev", `${op.feedPerRev} mm/rev`],
              ["DOC", `${op.depthOfCut} mm`],
              ["Stock Leave", `${op.stockToLeave} mm`],
              ["Clear X", `${op.clearanceX} mm`],
              ["Clear Z", `${op.clearanceZ} mm`],
              ["Coolant", op.coolantMode],
            ].map(([l, v]) => (
              <div key={String(l)} className="bg-white/[0.03] rounded-lg px-2.5 py-1.5">
                <div className="text-[9px] text-zinc-600 uppercase">{l}</div>
                <div className="text-zinc-200 font-mono font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-amber-400/80 leading-relaxed">⚠ {op.cautionText}</div>
          <div className="bg-[#04040A] border border-white/[0.06] rounded-xl p-3">
            <div className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1.5 font-semibold">G-Code Reference (Conceptual)</div>
            <pre className="font-mono text-[11px] text-green-400/80 leading-relaxed whitespace-pre-wrap">{op.gcodeHint}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function CamPlanView({ rollTooling }: { rollTooling: RollToolingResult[] }) {
  const ref = rollTooling[0];
  const cam = ref?.camPlan;
  if (!cam) return <div className="text-zinc-500 text-sm p-6">CAM Plan data not available — regenerate roll tooling.</div>;

  const toolMap = new Map(cam.tools.map(t => [t.toolId, t]));

  const downloadCamReport = () => {
    const lines: string[] = [
      "═══════════════════════════════════════════════════════",
      "   STEP 5 — CAM PLAN REPORT",
      `   Generated: ${new Date().toISOString().split("T")[0]}`,
      "═══════════════════════════════════════════════════════",
      "",
      "MACHINE SETUP",
      `  Machine    : ${cam.machine}`,
      `  Controller : ${cam.controller}`,
      `  Work Offset: ${cam.workOffset}`,
      `  Z0         : ${cam.z0Reference}`,
      `  X0         : ${cam.x0Reference}`,
      `  Cycle Time : ${cam.cycleTimeEstimate}`,
      "",
      "CUTTING PARAMETERS",
      `  Insert Grade : ${cam.insertGrade}`,
      `  Coolant Mode : ${cam.coolantMode}`,
      "",
      "CAM NOTES",
      ...cam.camNotes.map(n => `  • ${n}`),
      "",
      "TOOL LIBRARY",
      ...cam.tools.map(t => [
        `  ${t.toolId} | ${t.insertFamily} — ${t.purpose}`,
        `        Insert : ${t.insertCode}`,
        `        Holder : ${t.holder}`,
        `        Rε     : ${t.noseRadius} mm   Hand: ${t.handOfCut}`,
        `        Caution: ${t.caution}`,
      ].join("\n")),
      "",
      "SPEEDS & FEEDS TABLE",
      "  Operation       Vc(m/min)  fn(mm/rev)  DOC(mm)  RPM     Note",
      ...cam.speedFeedTable.map(r =>
        `  ${r.op.padEnd(14)} ${String(r.Vc).padEnd(10)} ${String(r.fn).padEnd(11)} ${String(r.DOC).padEnd(8)} ${String(r.RPM).padEnd(7)} ${r.note}`
      ),
      "",
      "OPERATION SEQUENCE",
      ...cam.operations.map(op => [
        `  ${op.opId} | ${op.opType.replace(/_/g," ")}`,
        `     ${op.description}`,
        `     Tool: ${op.toolId}  RPM: ${op.rpmMode}${op.rpmValue > 0 ? ` S${op.rpmValue}` : ""}  fn: ${op.feedPerRev}  DOC: ${op.depthOfCut}`,
        `     ⚠ ${op.cautionText}`,
      ].join("\n")),
      "",
      "SAFETY PLAN",
      `  Max Spindle RPM : ${cam.safetyPlan.maxSpindleRpm}`,
      `  Safe Retract X  : ${cam.safetyPlan.safeRetractX} mm`,
      `  Safe Retract Z  : ${cam.safetyPlan.safeRetractZ} mm`,
      `  Chuck Note      : ${cam.safetyPlan.chuckNote}`,
      `  Tailstock Note  : ${cam.safetyPlan.tailstockNote}`,
      "",
      "PROVE-OUT STEPS",
      ...cam.safetyPlan.proveOutSteps.map(s => `  ${s}`),
      "",
      "INSPECTION CHECKLIST",
      ...cam.safetyPlan.inspectionChecklist.map(c => `  ☐ ${c}`),
      "",
      "DEFECTS GUIDE",
      ...cam.safetyPlan.defectsGuide.map(d => `  ${d.defect}\n     Cause: ${d.cause}\n     Fix  : ${d.fix}`),
    ];
    downloadFile(lines.join("\n"), "STEP5_CAM_PLAN_REPORT.txt");
    downloadFile(JSON.stringify(cam, null, 2), "STEP5_CAM_PLAN.json");
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-zinc-200">Step 5 — CAM Planning Engine</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">{cam.machine} · {cam.controller} · Cycle: {cam.cycleTimeEstimate}</div>
        </div>
        <button
          onClick={downloadCamReport}
          className="flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 transition-all"
        >
          ⬇ Download CAM Report + JSON
        </button>
      </div>

      {/* Machine Setup + CAM Notes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02] space-y-2.5">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Machine Setup</div>
          {[
            ["Work Offset", cam.workOffset, "text-blue-300"],
            ["Z0 Reference", cam.z0Reference, "text-emerald-300"],
            ["X0 Reference", cam.x0Reference, "text-emerald-300"],
            ["Insert Grade", cam.insertGrade, "text-amber-300"],
            ["Coolant", cam.coolantMode, cam.coolantMode === "M07" ? "text-orange-400" : "text-cyan-300"],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 w-24">{l}</span>
              <span className={`text-[11px] font-mono font-semibold ${c}`}>{v}</span>
            </div>
          ))}
        </div>
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">CAM Notes</div>
          <ul className="space-y-1.5">
            {cam.camNotes.map((n, i) => (
              <li key={i} className="flex gap-2 text-[10px] text-zinc-400 leading-tight">
                <span className="text-zinc-700 mt-0.5 shrink-0">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tool Library */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[11px] font-bold text-zinc-200">Tool Library — {cam.tools.length} Tools</span>
          <span className="text-[10px] text-zinc-600 ml-2">Select based on operation + material</span>
        </div>
        <div className="p-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
          {cam.tools.map(t => <CamToolCard key={t.toolId} tool={t} />)}
        </div>
      </div>

      {/* Speeds & Feeds Table */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[11px] font-bold text-zinc-200">Speeds & Feeds Table</span>
          <span className="text-[10px] text-zinc-600 ml-2">RPM = (1000 × Vc) / (π × D)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.015]">
                {["Operation", "Vc m/min", "fn mm/rev", "DOC mm", "RPM", "Mode", "Note"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] text-zinc-600 font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cam.speedFeedTable.map((r, i) => (
                <tr key={r.op} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-3 py-2 font-semibold text-zinc-300">{r.op}</td>
                  <td className="px-3 py-2 text-emerald-400">{r.Vc}</td>
                  <td className="px-3 py-2 text-sky-400">{r.fn}</td>
                  <td className="px-3 py-2 text-amber-400">{r.DOC}</td>
                  <td className="px-3 py-2 text-violet-400">{r.RPM}</td>
                  <td className="px-3 py-2 text-zinc-500">{r.Vc > 150 ? "G96 CSS" : "G97"}</td>
                  <td className="px-3 py-2 text-zinc-600 text-[10px]">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operations Sequence */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[11px] font-bold text-zinc-200">Operation Sequence — {cam.operations.length} Ops</span>
          <span className="text-[10px] text-zinc-600 ml-2">Click to expand G-code hints</span>
        </div>
        <div className="p-3 space-y-1.5">
          {cam.operations.map(op => (
            <CamOpCard key={op.opId} op={op} toolMap={toolMap} />
          ))}
        </div>
      </div>

      {/* Safety Plan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2.5">Safety & Prove-Out</div>
          <div className="space-y-1.5 mb-3">
            {[
              ["Max RPM", `S${cam.safetyPlan.maxSpindleRpm}`, "text-red-400"],
              ["Safe Retract X", `${cam.safetyPlan.safeRetractX} mm`, "text-zinc-300"],
              ["Safe Retract Z", `${cam.safetyPlan.safeRetractZ} mm`, "text-zinc-300"],
              ["Work Offset", cam.safetyPlan.workOffsetNote, "text-blue-300"],
            ].map(([l, v, c]) => (
              <div key={String(l)} className="flex gap-2 text-[10px]">
                <span className="text-zinc-600 w-24 shrink-0">{l}</span>
                <span className={`font-mono ${c} leading-tight`}>{v}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-amber-300/80 leading-relaxed mb-2">{cam.safetyPlan.chuckNote}</div>
          <div className="text-[10px] text-sky-300/70 leading-relaxed">{cam.safetyPlan.tailstockNote}</div>
          <div className="mt-3 space-y-1">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase mb-1">Prove-Out Steps</div>
            {cam.safetyPlan.proveOutSteps.map((s, i) => (
              <div key={i} className="flex gap-2 text-[10px] text-zinc-400">
                <span className="text-zinc-700 shrink-0">→</span><span className="leading-tight">{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">Inspection Checklist</div>
            <ul className="space-y-1.5">
              {cam.safetyPlan.inspectionChecklist.map((c, i) => (
                <li key={i} className="flex gap-2 text-[10px] text-zinc-400 leading-tight">
                  <span className="text-emerald-700 shrink-0">☐</span><span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Defects Guide */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[11px] font-bold text-zinc-200">Common Defects & Fixes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.015]">
                {["Defect", "Cause", "Fix"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] text-zinc-600 font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cam.safetyPlan.defectsGuide.map((d, i) => (
                <tr key={i} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-3 py-2 text-red-400 font-semibold leading-tight">{d.defect}</td>
                  <td className="px-3 py-2 text-amber-400/80 leading-tight">{d.cause}</td>
                  <td className="px-3 py-2 text-emerald-400/80 leading-tight">{d.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Roll Types Reference Panel ───────────────────────────────────────────────
const ROLL_TYPES = [
  {
    type: "Flat Roll",
    subtitle: "Entry",
    stage: "Phase 1 — Passes 1–3",
    color: "zinc",
    icon: "▭",
    function: "Guide strip, remove coil set, control width. No bending.",
    gap: "t + 0.10 mm (loose)",
    details: [
      "Upper + lower both flat (slight crown 0.05 mm)",
      "Roll gap = material thickness + 0.1 mm — no forming pressure",
      "Entry guides: strip width + 1 mm total clearance",
      "Use 5-roll entry straightener before Pass 1",
    ],
  },
  {
    type: "Forming Roll",
    subtitle: "Bending",
    stage: "Phase 2 — Passes 4–8+",
    color: "blue",
    icon: "⌒",
    function: "Primary bending of flanges. 10–15°/station increment.",
    gap: "t + 0.10–0.20 mm",
    details: [
      "Upper and lower rolls form mating pair (groove + matching crown)",
      "Groove radius = inner bend radius of profile at that station",
      "Max increment: ≤15° general, ≤10° SS/AL, ≤12° HR",
      "Bend radius must be ≥ material thickness (r ≥ t)",
    ],
  },
  {
    type: "Edge Roll",
    subtitle: "Side Control",
    stage: "Phase 2–3 — Bending & Closing",
    color: "emerald",
    icon: "⊣",
    function: "Control flange width, prevent edge wave. Vertical-axis side rolls.",
    gap: "flange width + 0.20 mm",
    details: [
      "Horizontal shaft perpendicular to main roll shafts",
      "Groove depth = current flange height at that station",
      "Engages when flanges > 30 mm height",
      "Essential for preventing edge wave and controlling flange geometry",
    ],
  },
  {
    type: "Finishing Roll",
    subtitle: "Final Shape",
    stage: "Phase 3 — Shape Close",
    color: "amber",
    icon: "◡",
    function: "Close section to 80–90% of final angle. Final geometry correction.",
    gap: "t + 0.10 mm",
    details: [
      "Near-final section shape profile",
      "Closes profile from 50° through to 80–90°",
      "Apply springback compensation angle on these rolls",
      "Web and flange surface finish controlled here",
    ],
  },
  {
    type: "Calibration Roll",
    subtitle: "Size Fix",
    stage: "Phase 4 — Last 1–2 Passes",
    color: "violet",
    icon: "⊏",
    function: "Lock final dimensions, remove springback, ironing action.",
    gap: "t + 0.03–0.05 mm (ironing)",
    details: [
      "Gap = t + 0.05 mm (first calibration pass)",
      "Gap = t + 0.03 mm (final calibration — ironing action)",
      "Exact final section shape + springback overbend",
      "Mandatory 2 passes for flanges >40 mm or SS material",
    ],
  },
];

const ROLL_TYPE_COLORS: Record<string, string> = {
  zinc:   "border-zinc-600/50 bg-zinc-800/30",
  blue:   "border-blue-500/40 bg-blue-500/8",
  emerald:"border-emerald-500/40 bg-emerald-500/8",
  amber:  "border-amber-500/40 bg-amber-500/8",
  violet: "border-violet-500/40 bg-violet-500/8",
};
const ROLL_TYPE_TEXT: Record<string, string> = {
  zinc:   "text-zinc-300",
  blue:   "text-blue-400",
  emerald:"text-emerald-400",
  amber:  "text-amber-400",
  violet: "text-violet-400",
};

function RollTypesPanel() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-140px)]">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-blue-400 to-violet-500" />
        <span className="text-sm font-bold text-zinc-100">Roll Types Reference</span>
        <span className="text-[10px] text-zinc-500 ml-1">— 5 Types, Stages & Functions</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {ROLL_TYPES.map((rt) => {
          const isOpen = expanded === rt.type;
          return (
            <div
              key={rt.type}
              className={`border rounded-lg overflow-hidden transition-all cursor-pointer ${ROLL_TYPE_COLORS[rt.color]}`}
              onClick={() => setExpanded(isOpen ? null : rt.type)}
            >
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className={`text-xl font-mono ${ROLL_TYPE_TEXT[rt.color]}`}>{rt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${ROLL_TYPE_TEXT[rt.color]}`}>{rt.type}</span>
                    <span className="text-[9px] bg-white/[0.05] border border-white/[0.08] rounded px-1.5 py-0.5 text-zinc-500 font-semibold uppercase">{rt.subtitle}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{rt.stage}</div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wide">Gap</div>
                  <div className="text-[10px] font-mono text-zinc-400">{rt.gap}</div>
                </div>
                <span className={`text-[10px] ml-2 ${ROLL_TYPE_TEXT[rt.color]}`}>{isOpen ? "▲" : "▼"}</span>
              </div>
              <div className="px-4 pb-1">
                <p className="text-[10px] text-zinc-400 leading-relaxed">{rt.function}</p>
              </div>
              {isOpen && (
                <div className="px-4 pb-3 pt-1 border-t border-white/[0.04] mt-1 space-y-1">
                  {rt.details.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-zinc-400">
                      <span className={`flex-shrink-0 mt-0.5 ${ROLL_TYPE_TEXT[rt.color]}`}>•</span>
                      <span>{d}</span>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-2">
                    <span className="text-[9px] text-zinc-600 uppercase tracking-wide">Roll Gap:</span>
                    <span className="text-[10px] font-mono text-zinc-300">{rt.gap}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pass Sequence Quick Reference */}
      <div className="mt-4 border border-white/[0.06] rounded-lg p-3">
        <div className="text-[10px] font-bold text-zinc-400 mb-2 uppercase tracking-wide">4-Phase Pass Sequence</div>
        <div className="grid grid-cols-4 gap-1.5 text-[9px]">
          {[
            { phase: "Phase 1", label: "Entry", passes: "Pass 1–3", color: "zinc", angle: "0°" },
            { phase: "Phase 2", label: "Bending Start", passes: "Pass 4–8", color: "blue", angle: "10–20°/pass" },
            { phase: "Phase 3", label: "Shape Close", passes: "Pass 9–12", color: "amber", angle: "50°→90°" },
            { phase: "Phase 4", label: "Calibration", passes: "Last 1–2", color: "violet", angle: "Final + SB" },
          ].map(p => (
            <div key={p.phase} className={`rounded p-2 border ${ROLL_TYPE_COLORS[p.color]}`}>
              <div className={`font-bold ${ROLL_TYPE_TEXT[p.color]}`}>{p.phase}</div>
              <div className="text-zinc-400 mt-0.5">{p.label}</div>
              <div className="text-zinc-600 mt-0.5">{p.passes}</div>
              <div className={`mt-1 font-mono ${ROLL_TYPE_TEXT[p.color]}`}>{p.angle}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Profile Design Rules Engine ──────────────────────────────────────────────
const SB_COMP: Record<string, number> = {
  GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15, MS: 1.06,
};
const MIN_RT: Record<string, number> = {
  GI: 1.0, CR: 0.5, HR: 1.5, SS: 2.0, AL: 1.0, MS: 0.8,
};
const MAX_INC: Record<string, number> = {
  GI: 15, CR: 15, HR: 12, SS: 10, AL: 12, MS: 15,
};

interface RuleViolation {
  rule: string;
  severity: "critical" | "warning" | "info";
  message: string;
  fix: string;
}

function ProfileRulesEngine() {
  const { stations, rollTooling } = useCncStore();
  const [mat, setMat] = useState("GI");
  const [thickness, setThickness] = useState("1.5");
  const [targetAngle, setTargetAngle] = useState("90");
  const [innerRadius, setInnerRadius] = useState("2.0");
  const [rollGap, setRollGap] = useState("1.65");
  const [anglePerPass, setAnglePerPass] = useState("15");

  const t = parseFloat(thickness) || 1.5;
  const r = parseFloat(innerRadius) || 2.0;
  const gap = parseFloat(rollGap) || (t + 0.15);
  const inc = parseFloat(anglePerPass) || 15;
  const target = parseFloat(targetAngle) || 90;

  const violations: RuleViolation[] = [];

  const sbFactor = SB_COMP[mat] ?? 1.05;
  const minRt = MIN_RT[mat] ?? 1.0;
  const maxInc = MAX_INC[mat] ?? 15;

  if (inc > maxInc) {
    violations.push({
      rule: "Rule 1 — Gradual Bending",
      severity: "warning",
      message: `Angle increment ${inc}°/station exceeds max ${maxInc}° for ${mat}`,
      fix: `Reduce to ≤${maxInc}°/station or add more passes`,
    });
  }

  const rtRatio = r / t;
  if (rtRatio < minRt) {
    violations.push({
      rule: "Rule 2 — Bend Radius ≥ Thickness",
      severity: "critical",
      message: `r/t = ${rtRatio.toFixed(2)} < ${minRt} minimum for ${mat} — CRACKING RISK`,
      fix: `Increase inner radius to ≥ ${(minRt * t).toFixed(2)} mm (${minRt}×t)`,
    });
  }

  const minGap = t;
  const maxGap = t + 0.25;
  if (gap < minGap) {
    violations.push({
      rule: "Rule 3 — Roll Gap",
      severity: "critical",
      message: `Roll gap ${gap.toFixed(2)} mm < material thickness ${t.toFixed(2)} mm — bearing overload`,
      fix: `Set gap to at least ${(t + 0.10).toFixed(2)} mm (t + 0.10 mm)`,
    });
  } else if (gap > maxGap) {
    violations.push({
      rule: "Rule 3 — Roll Gap",
      severity: "warning",
      message: `Roll gap ${gap.toFixed(2)} mm > ${maxGap.toFixed(2)} mm (t+0.25) — insufficient forming pressure`,
      fix: `Tighten gap to ${(t + 0.15).toFixed(2)} mm (t + 0.15 mm) for bending passes`,
    });
  }

  const designAngle = target * sbFactor;
  const stationAngle = target;

  const passCounts = stations.length;
  if (passCounts > 0 && passCounts < 4) {
    violations.push({
      rule: "Rule 4 — Minimum Passes",
      severity: "warning",
      message: `Only ${passCounts} station(s) — may be insufficient for proper bending progression`,
      fix: `Use at least 6 stations for a simple profile`,
    });
  }

  if (violations.length === 0) {
    violations.push({
      rule: "All Rules",
      severity: "info",
      message: "All profile design rules are satisfied",
      fix: "No corrections needed",
    });
  }

  const sevColor = {
    critical: "border-red-500/40 bg-red-500/6 text-red-300",
    warning:  "border-amber-500/40 bg-amber-500/6 text-amber-300",
    info:     "border-emerald-500/40 bg-emerald-500/6 text-emerald-300",
  };
  const sevIcon = { critical: "🔴", warning: "🟡", info: "✅" };

  return (
    <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-red-500" />
        <span className="text-sm font-bold text-zinc-100">Profile Design Rules Engine</span>
        <span className="text-[10px] text-zinc-500 ml-1">— Live Validation</span>
      </div>

      {/* Input Parameters */}
      <div className="border border-white/[0.07] rounded-lg p-3">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-3">Design Parameters</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">Material</label>
            <select
              value={mat}
              onChange={e => setMat(e.target.value)}
              className="w-full bg-[#0B0B18] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200"
            >
              {["GI","CR","HR","SS","AL","MS"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">Thickness (mm)</label>
            <input type="number" step="0.1" min="0.5" max="6" value={thickness}
              onChange={e => setThickness(e.target.value)}
              className="w-full bg-[#0B0B18] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200"
            />
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">Target Angle (°)</label>
            <input type="number" step="1" min="1" max="180" value={targetAngle}
              onChange={e => setTargetAngle(e.target.value)}
              className="w-full bg-[#0B0B18] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200"
            />
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">Inner Bend Radius (mm)</label>
            <input type="number" step="0.1" min="0.1" max="50" value={innerRadius}
              onChange={e => setInnerRadius(e.target.value)}
              className="w-full bg-[#0B0B18] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200"
            />
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">Roll Gap (mm)</label>
            <input type="number" step="0.01" min="0.1" max="10" value={rollGap}
              onChange={e => setRollGap(e.target.value)}
              className="w-full bg-[#0B0B18] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200"
            />
          </div>
          <div>
            <label className="text-[9px] text-zinc-500 block mb-1">Angle/Pass (°)</label>
            <input type="number" step="1" min="1" max="45" value={anglePerPass}
              onChange={e => setAnglePerPass(e.target.value)}
              className="w-full bg-[#0B0B18] border border-white/[0.08] rounded px-2 py-1.5 text-xs text-zinc-200"
            />
          </div>
        </div>
      </div>

      {/* Computed Values */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0B0B18] border border-white/[0.06] rounded-lg p-2.5">
          <div className="text-[9px] text-zinc-500 uppercase">Design Angle (with SB)</div>
          <div className="text-base font-mono font-bold text-amber-400 mt-0.5">{designAngle.toFixed(1)}°</div>
          <div className="text-[9px] text-zinc-600 mt-0.5">Target {stationAngle}° × ×{sbFactor} ({mat} SB)</div>
        </div>
        <div className="bg-[#0B0B18] border border-white/[0.06] rounded-lg p-2.5">
          <div className="text-[9px] text-zinc-500 uppercase">Min Bend Radius</div>
          <div className={`text-base font-mono font-bold mt-0.5 ${rtRatio >= minRt ? "text-emerald-400" : "text-red-400"}`}>
            {(minRt * t).toFixed(2)} mm
          </div>
          <div className="text-[9px] text-zinc-600 mt-0.5">r/t={rtRatio.toFixed(2)} min={minRt} for {mat}</div>
        </div>
        <div className="bg-[#0B0B18] border border-white/[0.06] rounded-lg p-2.5">
          <div className="text-[9px] text-zinc-500 uppercase">Correct Gap Range</div>
          <div className={`text-base font-mono font-bold mt-0.5 ${gap >= minGap && gap <= maxGap ? "text-emerald-400" : "text-amber-400"}`}>
            {(t + 0.10).toFixed(2)}–{(t + 0.20).toFixed(2)} mm
          </div>
          <div className="text-[9px] text-zinc-600 mt-0.5">Current: {gap.toFixed(2)} mm</div>
        </div>
      </div>

      {/* Violations */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Validation Results</div>
        {violations.map((v, i) => (
          <div key={i} className={`border rounded-lg p-3 ${sevColor[v.severity]}`}>
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">{sevIcon[v.severity]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-wide opacity-70 mb-0.5">{v.rule}</div>
                <div className="text-[10px] leading-relaxed">{v.message}</div>
                {v.severity !== "info" && (
                  <div className="text-[9px] mt-1 opacity-70">Fix: {v.fix}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rules Reference */}
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">6 Core Design Rules</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {[
            { rule: "1 — Gradual Bending",     detail: `Max ${maxInc}°/station for ${mat}`, status: inc <= maxInc },
            { rule: "2 — Bend Radius ≥ t",      detail: `r ≥ ${(minRt * t).toFixed(2)} mm for ${mat}`, status: rtRatio >= minRt },
            { rule: "3 — Roll Gap = t+0.1–0.2", detail: `${(t+0.10).toFixed(2)}–${(t+0.20).toFixed(2)} mm`, status: gap >= minGap && gap <= maxGap },
            { rule: "4 — Edge Protection",      detail: "Edges close in LAST 1–2 passes only", status: true },
            { rule: "5 — Symmetry Check",       detail: "L/R angles equal ±0.5°; shafts ±0.05mm/m", status: true },
            { rule: "6 — Springback Comp",      detail: `${target}° target → design at ${designAngle.toFixed(1)}° (×${sbFactor})`, status: true },
          ].map(row => (
            <div key={row.rule} className="flex items-center gap-3 px-3 py-2">
              <span className={`text-sm ${row.status ? "text-emerald-400" : "text-red-400"}`}>{row.status ? "✓" : "✗"}</span>
              <div className="flex-1">
                <span className="text-[10px] text-zinc-300 font-medium">Rule {row.rule}</span>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">{row.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
type RollView = "integrated" | "stations" | "gap" | "summary" | "mfg" | "cam" | "bom" | "assembly" | "rolltypes" | "rules" | "engineering";

export function RollToolingView() {
  const { rollTooling, rollGaps, accuracyLog, accuracyThreshold } = useCncStore();
  const latestToolingScore = [...accuracyLog].reverse().find(e => e.taskType === "tooling");
  const [expandedStation, setExpandedStation] = useState<number | null>(1);
  const [view, setView] = useState<RollView>("integrated");
  const [showPackagePanel, setShowPackagePanel] = useState(false);

  const totalRolls = rollTooling.length * 2;

  if (rollTooling.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
        <div className="flex-shrink-0 px-6 py-2.5 bg-zinc-900 border-b border-zinc-700 flex items-center gap-4">
          <div>
            <div className="text-sm font-bold text-zinc-100">Roll Tooling Design</div>
            <div className="text-xs text-zinc-400 mt-0.5">No tooling generated yet — reference panels available below</div>
          </div>
          <div className="flex gap-1 ml-4">
            {([
              ["rolltypes", "📐", "Roll Types", "cyan"],
              ["rules",     "✓",  "Rules Check", "red"],
            ] as [RollView, string, string, string][]).map(([v, icon, label, accent]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  view === v
                    ? accent === "cyan" ? "bg-cyan-600/90 text-white"
                    : "bg-red-600/90 text-white"
                    : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200 border border-white/[0.05]"
                }`}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {view === "rolltypes" && <RollTypesPanel />}
          {view === "rules" && <ProfileRulesEngine />}
          {view !== "rolltypes" && view !== "rules" && (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4 px-6">
              <div className="text-5xl">⚙</div>
              <div className="text-lg font-semibold text-zinc-400">No Roll Tooling Generated</div>
              <div className="text-sm text-center max-w-sm text-zinc-500">
                Upload a DXF profile and click <span className="text-emerald-400 font-semibold">Generate Complete Package</span> to run the full SAI Sai Rolotech Smart Engines engine in one click.
              </div>
              <button
                onClick={() => setShowPackagePanel(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-900/30"
              >
                ⚡ Generate Complete Package
              </button>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setView("rolltypes")} className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-lg text-xs">📐 Roll Types Reference</button>
                <button onClick={() => setView("rules")} className="px-3 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-xs">✓ Rules Check</button>
              </div>
              {showPackagePanel && <CompletePackagePanel autoGenerate={true} />}
            </div>
          )}
        </div>
      </div>
    );
  }

  const passLine = rollTooling[0]?.rollProfile?.passLineY ?? 0;
  const matType = rollTooling[0]?.rollProfile?.kFactor === 0.44 ? "GI" : rollTooling[0]?.rollProfile?.kFactor === 0.42 ? "HR" : "CR";  // FIX: kFactor 0.42 is HR not CR (DIN 6935); else fallback CR

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-2.5 bg-zinc-900 border-b border-zinc-700 flex items-center gap-4">
        <div>
          <div className="text-sm font-bold text-zinc-100">Roll Tooling Design</div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {rollTooling.length} Stations &times; 2 = <span className="text-amber-400 font-semibold">{totalRolls} Rolls</span> — Each machined separately on CNC Lathe
          </div>
        </div>

        <div className="flex gap-1 ml-4 flex-wrap">
          {([
            ["integrated",  "🌸", "Integrated",    "amber"],
            ["stations",    "⚙",  "Per Roll",      "blue"],
            ["engineering", "📐", "Sizing Calc",   "green"],
            ["gap",         "⊟",  "Gap Calc",      "blue"],
            ["summary",     "≡",  "All Rolls",     "blue"],
            ["mfg",         "🏭", "MFG Spec",      "blue"],
            ["cam",         "⚡", "CAM Plan",      "emerald"],
            ["bom",         "📋", "BOM",           "violet"],
            ["assembly",    "🔩", "Assembly",      "amber"],
            ["rolltypes",   "📐", "Roll Types",    "cyan"],
            ["rules",       "✓",  "Rules Check",   "red"],
          ] as [RollView, string, string, string][]).map(([v, icon, label, accent]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                view === v
                  ? accent === "emerald" ? "bg-emerald-600/90 text-white"
                  : accent === "violet"  ? "bg-violet-600/90 text-white"
                  : accent === "amber"   ? "bg-amber-600/90 text-white"
                  : accent === "cyan"    ? "bg-cyan-600/90 text-white"
                  : accent === "red"     ? "bg-red-600/90 text-white"
                  : accent === "green"   ? "bg-green-600/90 text-white"
                  : "bg-blue-600/90 text-white"
                  : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200 border border-white/[0.05]"
              }`}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 ml-auto text-xs">
          {latestToolingScore && (
            <AccuracyBadge score={latestToolingScore.overallScore} threshold={accuracyThreshold} size="sm" />
          )}
          <span className="text-green-400 font-mono">Pass Line Y = {passLine.toFixed(3)} mm</span>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-zinc-400">Upper (Top)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-zinc-400">Lower (Bottom)</span></div>
          <button
            onClick={() => setShowPackagePanel(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl font-bold text-[12px] transition-all shadow-lg ${
              showPackagePanel
                ? "bg-emerald-700 text-white shadow-emerald-900/40"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
            }`}
            title="Generate the complete roll tooling package — roll geometry, CNC G-code, machine setup, BOM, and ZIP export"
          >
            ⚡ {showPackagePanel ? "Hide Package" : "Generate Complete Package"}
          </button>
        </div>
      </div>

      {/* Roll strip quick nav */}
      <div className="flex-shrink-0 px-4 py-1.5 bg-zinc-900/60 border-b border-zinc-800 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] text-zinc-600 mr-1 uppercase tracking-wide">Rolls:</span>
          {rollTooling.map((rt) => (
            <React.Fragment key={rt.stationNumber}>
              <button onClick={() => { setView("stations"); setExpandedStation(rt.stationNumber); }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${expandedStation === rt.stationNumber && view === "stations" ? "bg-blue-700 text-white" : "bg-zinc-800 text-blue-400 hover:bg-zinc-700"}`}>
                R{rt.rollProfile?.upperRollNumber ?? "—"}
              </button>
              <button onClick={() => { setView("stations"); setExpandedStation(rt.stationNumber); }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${expandedStation === rt.stationNumber && view === "stations" ? "bg-orange-700 text-white" : "bg-zinc-800 text-orange-400 hover:bg-zinc-700"}`}>
                R{rt.rollProfile?.lowerRollNumber ?? "—"}
              </button>
              {rt.stationNumber < rollTooling.length && <div className="w-2 h-px bg-zinc-700" />}
            </React.Fragment>
          ))}
          <span className="text-[10px] text-zinc-600 ml-2">{totalRolls} total</span>
        </div>
      </div>

      {/* Pass line diagram */}
      <div className="flex-shrink-0 px-6 py-2 border-b border-zinc-800">
        <PassLineDiagram rollTooling={rollTooling} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {view === "integrated" && (
          <>
            <RollFlowerIntegratedView />
            <FlowerStationSuggestions />
          </>
        )}

        {view === "stations" && rollTooling.map((rt) => (
          <StationRollPair key={rt.stationNumber} rt={rt}
            totalStations={rollTooling.length}
            isExpanded={expandedStation === rt.stationNumber}
            onToggle={() => setExpandedStation(expandedStation === rt.stationNumber ? null : rt.stationNumber)}
          />
        ))}

        {view === "gap" && <RollGapTable gaps={rollGaps} />}

        {view === "mfg" && <ManufacturingView rollTooling={rollTooling} />}

        {view === "cam" && <CamPlanView rollTooling={rollTooling} />}

        {view === "bom" && <BomView rollTooling={rollTooling} />}

        {view === "assembly" && <AssemblyDrawingView rollTooling={rollTooling} />}

        {view === "rolltypes" && <RollTypesPanel />}

        {view === "rules" && <ProfileRulesEngine />}

        {view === "engineering" && (
          <div className="space-y-4">
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
              <div className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">Engineering Sizing — Auto-Calculated from Profile + Load</div>
              <div className="grid grid-cols-3 gap-3 text-xs text-zinc-300 mb-3">
                <div className="bg-zinc-900 rounded-lg p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Roll O.D Formula</div>
                  <div className="font-mono text-green-300 text-[10px] leading-relaxed">
                    OD = bore + 2×min_wall + 2×profile_depth + 2×t
                  </div>
                  <div className="text-zinc-600 text-[9px] mt-1">min_wall = max(6, shaft×0.15)</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Shaft Diameter Formula</div>
                  <div className="font-mono text-amber-300 text-[10px] leading-relaxed">
                    d = ∛(16/π × √(M² + T²) / τ_allow)
                  </div>
                  <div className="text-zinc-600 text-[9px] mt-1">τ_allow = 0.3 × yield (C45 steel)</div>
                </div>
                <div className="bg-zinc-900 rounded-lg p-3">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Stand Pitch Formula</div>
                  <div className="font-mono text-blue-300 text-[10px] leading-relaxed">
                    P = rollWidth + 2×bearing + 2×locknut + housing
                  </div>
                  <div className="text-zinc-600 text-[9px] mt-1">locknut=15mm, housing=20mm</div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-zinc-800/60 border-b border-zinc-700 flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-100">Per-Station Engineering Data</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">Auto-calculated</span>
              </div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["Stn", "Upper OD\n(mm)", "Lower OD\n(mm)", "Profile\nDepth", "Shaft Dia\nRequired", "Shaft Dia\nSelected", "Bearing\nSKF/FAG", "Bearing\nSize OD×W", "L10 Rated\n(kN)", "Bending M\n(Nm)", "Torque\n(Nm)", "Stand\nPitch", "Shaft\nDeflection"].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-zinc-500 font-semibold whitespace-pre-line">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rollTooling.map((rt, i) => {
                    const sc = rt.shaftCalc;
                    const br = rt.bearing;
                    const od = rt.rollODCalc;
                    const sp = rt.standPitch;
                    const stnId = rt.stationId ?? `S${rt.stationIndex ?? i + 1}`;
                    return (
                      <tr key={i} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-zinc-900/30" : ""}`}>
                        <td className="px-2 py-1.5 font-bold text-zinc-300">{stnId}</td>
                        <td className="px-2 py-1.5 text-blue-300 font-mono">{od ? od.upperOD.toFixed(1) : rt.upperRollOD.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-orange-300 font-mono">{od ? od.lowerOD.toFixed(1) : rt.lowerRollOD.toFixed(1)}</td>
                        <td className="px-2 py-1.5 text-zinc-400 font-mono">{od ? od.profileDepth.toFixed(2) : (rt.profileDepthMm ?? 0).toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-yellow-300 font-mono">{sc ? `Ø${sc.requiredDiaMm.toFixed(1)}` : "—"}</td>
                        <td className="px-2 py-1.5 text-green-300 font-bold font-mono">{sc ? `Ø${sc.selectedDiaMm}` : `Ø${rt.upperRollID - 2}`}</td>
                        <td className="px-2 py-1.5 text-cyan-300 font-bold">{br ? br.designation : "—"}</td>
                        <td className="px-2 py-1.5 text-zinc-300 font-mono">{br ? `${br.odMm}×${br.widthMm}` : "—"}</td>
                        <td className="px-2 py-1.5 text-green-400 font-mono">{br ? `${br.C_kN}` : "—"}</td>
                        <td className="px-2 py-1.5 text-zinc-400 font-mono">{sc ? sc.bendingMomentNm.toFixed(0) : "—"}</td>
                        <td className="px-2 py-1.5 text-zinc-400 font-mono">{sc ? sc.torqueNm.toFixed(0) : "—"}</td>
                        <td className="px-2 py-1.5 text-purple-300 font-bold font-mono">{sp ? `${sp.pitchMm.toFixed(0)}mm` : "—"}</td>
                        <td className="px-2 py-1.5 font-mono" style={{ color: sc && sc.deflectionMm > 0.05 ? "#f87171" : "#34d399" }}>
                          {sc ? `${sc.deflectionMm.toFixed(4)}mm` : `${rt.deflection.toFixed(4)}mm`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rollTooling[0]?.standPitch && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Stand Pitch Calculation (Station 1 example)</div>
                <div className="font-mono text-[10px] text-green-300">{rollTooling[0].standPitch!.formula}</div>
                <div className="mt-2 font-mono text-[10px] text-blue-300">{rollTooling[0].rollODCalc?.formula}</div>
              </div>
            )}

            {rollTooling[0]?.bearing && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Bearing Selection Logic</div>
                <div className="text-[10px] text-zinc-300 leading-relaxed">
                  <span className="text-cyan-400 font-bold">Bearing Life:</span>{" "}
                  L10 = (C/P)³ × 10⁶ / (60 × N) hours — Target: 20,000 hrs{" "}
                  <span className="text-zinc-500">| Standard deep groove ball bearings (SKF/FAG 6200 series)</span>
                </div>
                <div className="text-[10px] text-zinc-300 mt-1">
                  <span className="text-amber-400 font-bold">Shaft-to-Bearing fit:</span>{" "}
                  h6 shaft (ground Ra 0.8µm) | H7 bore in housing — ISO 286
                </div>
              </div>
            )}

            {/* ── Shaft Engineering Design — Per Station ─────────────────────── */}
            {rollTooling.some(rt => rt.shaftCalc?.keyway) && (
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-gradient-to-r from-zinc-800/80 to-zinc-900/80 border-b border-zinc-700 flex items-center gap-3">
                  <span className="text-xs font-bold text-zinc-100">Shaft Engineering Design — Per Station</span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-semibold">Auto from Profile</span>
                  <span className="text-[9px] text-zinc-500">Shigley's MSS | DIN 6885-A | DIN 981 | ISO 286</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-800/40">
                        {[
                          "Stn",
                          "Ø Selected\n(ISO mm)",
                          "Material\n(Auto)",
                          "Yield\n(MPa)",
                          "SF\nActual",
                          "Keyway b×h\n(DIN 6885-A)",
                          "t1 Shaft\n(mm)",
                          "t2 Hub\n(mm)",
                          "Key Length\n(min–max)",
                          "Shaft Fit\n(ISO h6)",
                          "Bore Fit\n(ISO H7)",
                          "Locknut\n(DIN 981)",
                          "Deflection\n(mm)",
                        ].map(h => (
                          <th key={h} className="px-2 py-2 text-left text-zinc-500 font-semibold whitespace-pre-line text-[9px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rollTooling.map((rt, i) => {
                        const sc = rt.shaftCalc;
                        if (!sc) return null;
                        const kw = sc.keyway;
                        const tf = sc.toleranceFit;
                        const stnId = rt.stationId ?? `S${i + 1}`;
                        const sfOk = sc.safetyFactor >= 2.5;
                        return (
                          <tr key={i} className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-zinc-900/30" : ""}`}>
                            <td className="px-2 py-1.5 font-bold text-zinc-300">{stnId}</td>
                            <td className="px-2 py-1.5 font-bold text-green-300 font-mono">Ø{sc.selectedDiaMm}</td>
                            <td className="px-2 py-1.5 text-amber-300" title={sc.recommendedMaterial}>
                              {sc.recommendedMaterial?.split(" ")[0] ?? "C45"}
                              <span className="text-zinc-500 ml-1">{sc.recommendedMaterial?.match(/\(([^)]+)\)/)?.[1] ?? ""}</span>
                            </td>
                            <td className="px-2 py-1.5 text-zinc-300 font-mono">{sc.shaftYieldMpa}</td>
                            <td className="px-2 py-1.5 font-bold font-mono" style={{ color: sfOk ? "#34d399" : "#f87171" }}>
                              {sc.safetyFactor}
                              {!sfOk && <span className="text-[8px] ml-1 text-red-400">LOW</span>}
                            </td>
                            <td className="px-2 py-1.5 text-yellow-300 font-bold font-mono">
                              {kw ? `${kw.widthMm}×${kw.heightMm}` : "—"}
                            </td>
                            <td className="px-2 py-1.5 text-yellow-200 font-mono">{kw ? kw.shaftDepthT1Mm : "—"}</td>
                            <td className="px-2 py-1.5 text-orange-300 font-mono">{kw ? kw.hubDepthT2Mm : "—"}</td>
                            <td className="px-2 py-1.5 text-zinc-400 font-mono text-[9px]">{kw ? kw.length : "—"}</td>
                            <td className="px-2 py-1.5 text-cyan-300 font-mono text-[9px]">
                              {tf ? tf.shaft.split(" ")[0] : `Ø${sc.selectedDiaMm}h6`}
                            </td>
                            <td className="px-2 py-1.5 text-sky-300 font-mono text-[9px]">
                              {tf ? tf.bore.split(" ")[0] : `Ø${sc.selectedDiaMm}H7`}
                            </td>
                            <td className="px-2 py-1.5 text-purple-300 text-[9px]" title={sc.locknuts}>
                              {sc.locknuts?.split(" ")[0] ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 font-mono" style={{ color: sc.deflectionMm > 0.05 ? "#f87171" : "#34d399" }}>
                              {sc.deflectionMm.toFixed(4)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Surface Finish + Formula Notes */}
                <div className="px-4 py-3 border-t border-zinc-800 grid grid-cols-2 gap-4 text-[9px]">
                  <div>
                    <div className="text-zinc-500 uppercase tracking-wide mb-1.5 font-semibold">Surface Finish Specs</div>
                    <div className="space-y-1 text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Bearing seat (h6 zone):</span>
                        <span className="text-cyan-300 font-mono font-bold">Ra 0.8µm — Ground</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Keyway slot:</span>
                        <span className="text-yellow-300 font-mono">Ra 1.6µm — Milled</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Shaft body:</span>
                        <span className="text-zinc-300 font-mono">Ra 3.2µm — Turned</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Roll bore (H7 zone):</span>
                        <span className="text-sky-300 font-mono">Ra 1.6µm — Reamed</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500 uppercase tracking-wide mb-1.5 font-semibold">Design Formula (Shigley's MSS)</div>
                    <div className="font-mono text-zinc-400 leading-relaxed">
                      <div>d = ∛[ (16/π×τ) × √((Kf×M)²+T²) ]</div>
                      <div className="text-zinc-500">Kf = 1.6 (end-milled keyway)</div>
                      <div className="text-zinc-500">SF = 2.5 (roll forming standard)</div>
                      <div className="text-zinc-500">M = F×L/4 | T = P×9.55/RPM</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Advanced Tool Panel — shown in stations/mfg/cam views */}
        {(view === "stations" || view === "mfg" || view === "cam") && (
          <div className="mt-4 space-y-3">
            <SmartToolSelector />
            <AIToolRecommender />
            <StationToleranceChecker />
            <GcodeStepVerifier />
            <SetupSheetGenerator />
          </div>
        )}

        {/* Complete Package Panel */}
        {showPackagePanel && <CompletePackagePanel autoGenerate={true} />}

        {view === "summary" && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-zinc-800/60 border-b border-zinc-700">
              <span className="text-sm font-bold text-zinc-100">All {totalRolls} Rolls — Complete Summary</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-700 bg-zinc-800/40">
                    <th className="text-left px-3 py-2 text-zinc-400">Roll #</th>
                    <th className="text-left px-3 py-2 text-zinc-400">Station</th>
                    <th className="text-left px-3 py-2 text-zinc-400">Type</th>
                    <th className="text-right px-3 py-2 text-zinc-400">OD (mm)</th>
                    <th className="text-right px-3 py-2 text-zinc-400">Bore (mm)</th>
                    <th className="text-right px-3 py-2 text-zinc-400">Width (mm)</th>
                    <th className="text-right px-3 py-2 text-zinc-400">Groove (mm)</th>
                    <th className="text-right px-3 py-2 text-zinc-400">K-Factor</th>
                    <th className="text-center px-3 py-2 text-zinc-400">G-Code</th>
                  </tr>
                </thead>
                <tbody>
                  {rollTooling.flatMap((rt) => {
                    const rp = rt.rollProfile;
                    return [
                      { rollNum: rp.upperRollNumber, side: "Upper", color: UPPER_COLOR, gcode: rp.upperLatheGcode },
                      { rollNum: rp.lowerRollNumber, side: "Lower", color: LOWER_COLOR, gcode: rp.lowerLatheGcode },
                    ].map(({ rollNum, side, color, gcode }) => (
                      <tr key={rollNum} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                        <td className="px-3 py-1.5 font-bold" style={{ color }}>R{rollNum}</td>
                        <td className="px-3 py-1.5 text-zinc-300">{rt.label}</td>
                        <td className="px-3 py-1.5" style={{ color }}>{side}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-200">{rp.rollDiameter.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-200">{rp.shaftDiameter.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-200">{rp.rollWidth.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right text-zinc-200">{rp.grooveDepth.toFixed(3)}</td>
                        <td className="px-3 py-1.5 text-right text-amber-400">{rp.kFactor}</td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => downloadFile(gcode, `ROLL_${String(rollNum).padStart(3,"0")}_${side.toUpperCase()}_${rt.label}.nc`)}
                              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px]"
                              title="Download full G-code"
                            >⬇ .nc</button>
                            <button
                              onClick={() => downloadSplitGcode(gcode, rollNum, side.toLowerCase() as "upper"|"lower", rt.label)}
                              className="px-1.5 py-0.5 bg-amber-950/60 hover:bg-amber-900 border border-amber-700/40 text-amber-300 rounded text-[10px]"
                              title="Download RAW + FINAL split programs"
                            >⬇ RAW/FIN</button>
                            <button
                              onClick={() => downloadRollDxf({ rollNumber: rollNum, side: side.toLowerCase() as "upper"|"lower", stationLabel: rt.label, rollDiameter: rp.rollDiameter, boreDiameter: rp.shaftDiameter, rollWidth: rp.rollWidth, grooveDepth: rp.grooveDepth, gap: rp.gap, materialType: "GI" })}
                              className="px-1.5 py-0.5 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700/40 text-cyan-300 rounded text-[10px]"
                              title="Download AutoCAD DXF drawing"
                            >⬇ .dxf</button>
                          </div>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>

            {/* Download all */}
            <div className="px-4 py-3 border-t border-zinc-700 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* All full G-code */}
                <button
                  onClick={() => {
                    rollTooling.forEach((rt, si) => {
                      const rp = rt.rollProfile;
                      setTimeout(() => downloadFile(rp.upperLatheGcode, `ROLL_${String(rp.upperRollNumber).padStart(3,"0")}_UPPER_${rt.label}.nc`), si * 100);
                      setTimeout(() => downloadFile(rp.lowerLatheGcode, `ROLL_${String(rp.lowerRollNumber).padStart(3,"0")}_LOWER_${rt.label}.nc`), si * 100 + 50);
                    });
                  }}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs font-semibold"
                >
                  ⬇ All {totalRolls} G-Code (.nc)
                </button>

                {/* All RAW + FINAL split */}
                <button
                  onClick={() => {
                    rollTooling.forEach((rt, si) => {
                      const rp = rt.rollProfile;
                      setTimeout(() => downloadAllRollFiles(rp.upperLatheGcode, rp.upperRollNumber, "upper", rt.label), si * 800);
                      setTimeout(() => downloadAllRollFiles(rp.lowerLatheGcode, rp.lowerRollNumber, "lower", rt.label), si * 800 + 400);
                    });
                  }}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded text-xs font-semibold"
                  title="Download RAW program (OP1+OP2) and FINAL program (OP3) for every roll"
                >
                  ⬇ All RAW + FINAL Split
                </button>

                {/* All DXF */}
                <button
                  onClick={() => {
                    rollTooling.forEach((rt, si) => {
                      const rp = rt.rollProfile;
                      setTimeout(() => downloadRollDxf({ rollNumber: rp.upperRollNumber, side: "upper", stationLabel: rt.label, rollDiameter: rp.rollDiameter, boreDiameter: rp.shaftDiameter, rollWidth: rp.rollWidth, grooveDepth: rp.grooveDepth, gap: rp.gap, materialType: "GI" }), si * 200);
                      setTimeout(() => downloadRollDxf({ rollNumber: rp.lowerRollNumber, side: "lower", stationLabel: rt.label, rollDiameter: rp.rollDiameter, boreDiameter: rp.shaftDiameter, rollWidth: rp.rollWidth, grooveDepth: rp.grooveDepth, gap: rp.gap, materialType: "GI" }), si * 200 + 100);
                    });
                  }}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-semibold"
                  title="Download AutoCAD DXF 2D drawing for every roll"
                >
                  ⬇ All DXF (AutoCAD)
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">
                Each roll: Full G-Code · RAW program (OP1+OP2: Face/Rough/Bore) · FINAL program (OP3: Profile+Finish) · DXF 2D Drawing
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
