import React, { useState } from "react";
import type { RollToolingResult } from "../../store/useCncStore";

const UPPER_COLOR = "#3b82f6";
const LOWER_COLOR = "#f97316";
const SHAFT_COLOR = "#64748b";
const SPACER_COLOR = "#a855f7";
const KEYWAY_COLOR = "#f59e0b";
const BEARING_COLOR = "#10b981";
const COLLAR_COLOR = "#c084fc";

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Pure data → SVG string builder (exported for PDF report use)
export function buildShaftElevationSVGString(rollTooling: RollToolingResult[], side: "upper" | "lower"): string {
  if (rollTooling.length === 0) return "";
  const rollColor = side === "upper" ? UPPER_COLOR : LOWER_COLOR;
  const SCALE = 1.2;
  const shaftDia = rollTooling[0].rollProfile.shaftDiameter;
  const bearingW = 30;
  const nutW = 18;
  const endGap = 15;
  let xCursor = bearingW + nutW + endGap;

  type Part = { type: string; label: string; width: number; OD: number; color: string; x: number };
  const parts: Part[] = [];

  parts.push({ type: "bearing", label: "BRG", width: bearingW, OD: shaftDia * 2.1, color: BEARING_COLOR, x: xCursor - bearingW - nutW });
  parts.push({ type: "nut", label: "KM", width: nutW, OD: shaftDia * 1.5, color: "#78716c", x: xCursor - nutW });

  for (let i = 0; i < rollTooling.length; i++) {
    const rt = rollTooling[i];
    const rp = rt.rollProfile;
    const spec = rt.mfgSpec;
    const rollNum = side === "upper" ? rp.upperRollNumber : rp.lowerRollNumber;
    if (rp.sideCollar) {
      parts.push({ type: "collar", label: "CLR", width: rp.sideCollar.width, OD: rp.sideCollar.OD, color: COLLAR_COLOR, x: xCursor });
      xCursor += rp.sideCollar.width;
    }
    parts.push({ type: "roll", label: `R${rollNum} ${rt.label}`, width: rp.rollWidth, OD: rp.rollDiameter, color: rollColor, x: xCursor });
    xCursor += rp.rollWidth;
    if (rp.sideCollar) {
      parts.push({ type: "collar", label: "CLR", width: rp.sideCollar.width, OD: rp.sideCollar.OD, color: COLLAR_COLOR, x: xCursor });
      xCursor += rp.sideCollar.width;
    }
    if (i < rollTooling.length - 1 && spec && spec.spacerThickness > 0) {
      parts.push({ type: "spacer", label: `SP ${spec.spacerThickness.toFixed(1)}`, width: spec.spacerThickness, OD: shaftDia * 1.6, color: SPACER_COLOR, x: xCursor });
      xCursor += spec.spacerThickness;
    }
  }
  parts.push({ type: "nut", label: "KM", width: nutW, OD: shaftDia * 1.5, color: "#78716c", x: xCursor });
  xCursor += nutW;
  parts.push({ type: "bearing", label: "BRG", width: bearingW, OD: shaftDia * 2.1, color: BEARING_COLOR, x: xCursor });
  xCursor += bearingW + endGap;

  const svgW = Math.max(800, xCursor * SCALE + 40);
  const svgH = 220;
  const midY = 110;
  const shaftR = (shaftDia / 2) * SCALE;

  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}">`;
  out += `<rect width="${svgW}" height="${svgH}" fill="#06060E"/>`;
  out += `<line x1="10" y1="${midY}" x2="${svgW - 10}" y2="${midY}" stroke="#334155" stroke-width="1" stroke-dasharray="4 4"/>`;
  out += `<rect x="10" y="${midY - shaftR}" width="${svgW - 20}" height="${shaftR * 2}" fill="${SHAFT_COLOR}" fill-opacity="0.35" rx="2"/>`;
  out += `<defs><marker id="arr" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto"><path d="M0,0 L0,5 L5,2.5 Z" fill="#64748b"/></marker></defs>`;

  for (const p of parts) {
    const px = p.x * SCALE + 20;
    const pw = Math.max(3, p.width * SCALE);
    const pr = (p.OD / 2) * SCALE;
    const isRoll = p.type === "roll";
    out += `<rect x="${px}" y="${midY - pr}" width="${pw}" height="${pr * 2}" fill="${p.color}" fill-opacity="${isRoll ? 0.75 : 0.4}" stroke="${p.color}" stroke-width="${isRoll ? 1.5 : 0.8}" stroke-opacity="0.8" rx="${isRoll ? 2 : 1}"/>`;
    out += `<rect x="${px}" y="${midY - shaftR}" width="${pw}" height="${shaftR * 2}" fill="${SHAFT_COLOR}" fill-opacity="0.4"/>`;
    if (isRoll) {
      out += `<rect x="${px + pw / 2 - 2}" y="${midY - shaftR - 3}" width="4" height="6" fill="${KEYWAY_COLOR}" fill-opacity="0.9" rx="1"/>`;
      out += `<line x1="${px}" y1="${midY - pr - 14}" x2="${px + pw}" y2="${midY - pr - 14}" stroke="#64748b" stroke-width="0.5" marker-end="url(#arr)"/>`;
      out += `<text x="${px + pw / 2}" y="${midY - pr - 18}" text-anchor="middle" font-size="8" fill="#94a3b8">${p.width.toFixed(1)}mm</text>`;
    }
    out += `<text x="${px + pw / 2}" y="${midY + pr + 12}" text-anchor="middle" font-size="7" fill="${p.color}" fill-opacity="0.9">${p.label}</text>`;
  }

  const legendItems: [string, string][] = [
    [rollColor, side === "upper" ? "Upper Roll" : "Lower Roll"],
    [SHAFT_COLOR, "Shaft"], [SPACER_COLOR, "Spacer"], [BEARING_COLOR, "Bearing"], [KEYWAY_COLOR, "Keyway"],
  ];
  legendItems.forEach(([color, label], i) => {
    const lx = svgW - 110;
    const ly = 10 + i * 14;
    out += `<rect x="${lx}" y="${ly}" width="10" height="8" fill="${color}" fill-opacity="0.7" rx="1"/>`;
    out += `<text x="${lx + 13}" y="${ly + 7.5}" font-size="7.5" fill="#94a3b8">${label}</text>`;
  });

  out += `</svg>`;
  return out;
}

// SVG elevation drawing — all rolls + spacers stacked on one shaft
function ShaftElevationSVG({
  rollTooling,
  side,
}: {
  rollTooling: RollToolingResult[];
  side: "upper" | "lower";
}) {
  if (rollTooling.length === 0) return null;

  const SCALE = 1.2; // px per mm
  const shaftDia = rollTooling[0].rollProfile.shaftDiameter;
  const rollColor = side === "upper" ? UPPER_COLOR : LOWER_COLOR;

  // Build shaft layout from left bearing to right bearing
  const bearingW = 30;
  const nutW = 18;
  const endGap = 15;
  let xCursor = bearingW + nutW + endGap;

  type ShaftPart = {
    type: "roll" | "spacer" | "bearing" | "nut" | "shaft" | "collar";
    label: string;
    width: number; // mm
    OD: number;    // mm
    color: string;
    x: number;     // px from left
  };

  const parts: ShaftPart[] = [];
  const totalShaftLen = rollTooling.reduce((s, rt) => {
    const rp = rt.rollProfile;
    const spec = rt.mfgSpec;
    return s + rp.rollWidth + (spec ? spec.spacerThickness : 10);
  }, 0) + 2 * (bearingW + nutW + endGap + 20);

  // Left bearing + nut
  parts.push({ type: "bearing", label: "BRG", width: bearingW, OD: shaftDia * 2.1, color: BEARING_COLOR, x: xCursor - bearingW - nutW });
  parts.push({ type: "nut", label: "KM", width: nutW, OD: shaftDia * 1.5, color: "#78716c", x: xCursor - nutW });

  for (let i = 0; i < rollTooling.length; i++) {
    const rt = rollTooling[i];
    const rp = rt.rollProfile;
    const spec = rt.mfgSpec;
    const rollNum = side === "upper" ? rp.upperRollNumber : rp.lowerRollNumber;

    // Left collar (if present)
    if (rp.sideCollar) {
      const colW = rp.sideCollar.width;
      const colOD = rp.sideCollar.OD;
      parts.push({
        type: "collar",
        label: `CLR\n${rp.sideCollar.material.split(" ")[0]}`,
        width: colW, OD: colOD, color: COLLAR_COLOR, x: xCursor,
      });
      xCursor += colW;
    }

    // Roll
    parts.push({
      type: "roll",
      label: `R${rollNum}\n${rt.label}`,
      width: rp.rollWidth,
      OD: rp.rollDiameter,
      color: rollColor,
      x: xCursor,
    });
    xCursor += rp.rollWidth;

    // Right collar (if present)
    if (rp.sideCollar) {
      const colW = rp.sideCollar.width;
      const colOD = rp.sideCollar.OD;
      parts.push({
        type: "collar",
        label: `CLR\n${rp.sideCollar.width}mm`,
        width: colW, OD: colOD, color: COLLAR_COLOR, x: xCursor,
      });
      xCursor += colW;
    }

    // Spacer (between rolls, except after last)
    if (i < rollTooling.length - 1 && spec && spec.spacerThickness > 0) {
      parts.push({
        type: "spacer",
        label: `SP\n${spec.spacerThickness.toFixed(1)}`,
        width: spec.spacerThickness,
        OD: shaftDia * 1.6,
        color: SPACER_COLOR,
        x: xCursor,
      });
      xCursor += spec.spacerThickness;
    }
  }

  // Right nut + bearing
  parts.push({ type: "nut", label: "KM", width: nutW, OD: shaftDia * 1.5, color: "#78716c", x: xCursor });
  xCursor += nutW;
  parts.push({ type: "bearing", label: "BRG", width: bearingW, OD: shaftDia * 2.1, color: BEARING_COLOR, x: xCursor });
  xCursor += bearingW + endGap;

  const svgW = Math.max(600, xCursor * SCALE + 40);
  const svgH = 220;
  const midY = 110;
  const shaftR = (shaftDia / 2) * SCALE;

  return (
    <svg
      width={svgW}
      height={svgH}
      className="block"
      style={{ minWidth: svgW }}
    >
      {/* Shaft centerline */}
      <line x1={10} y1={midY} x2={svgW - 10} y2={midY}
        stroke="#334155" strokeWidth={1} strokeDasharray="4 4" />

      {/* Shaft body */}
      <rect
        x={10} y={midY - shaftR}
        width={svgW - 20} height={shaftR * 2}
        fill={SHAFT_COLOR} fillOpacity={0.35} rx={2}
      />

      {/* Parts */}
      {parts.map((p, idx) => {
        const px = p.x * SCALE + 20;
        const pw = Math.max(3, p.width * SCALE);
        const pr = (p.OD / 2) * SCALE;
        const isRoll = p.type === "roll";

        return (
          <g key={idx}>
            {/* Part body */}
            <rect
              x={px} y={midY - pr}
              width={pw} height={pr * 2}
              fill={p.color}
              fillOpacity={isRoll ? 0.75 : 0.4}
              stroke={p.color}
              strokeWidth={isRoll ? 1.5 : 0.8}
              strokeOpacity={0.8}
              rx={isRoll ? 2 : 1}
            />
            {/* Bore cutout */}
            <rect
              x={px} y={midY - shaftR}
              width={pw} height={shaftR * 2}
              fill={SHAFT_COLOR} fillOpacity={0.4}
            />
            {/* Keyway (on rolls) */}
            {isRoll && (
              <rect
                x={px + pw / 2 - 2} y={midY - shaftR - 3}
                width={4} height={6}
                fill={KEYWAY_COLOR} fillOpacity={0.9} rx={1}
              />
            )}
            {/* Dimension line */}
            {isRoll && (
              <>
                <line x1={px} y1={midY - pr - 14} x2={px + pw} y2={midY - pr - 14}
                  stroke="#64748b" strokeWidth={0.5} markerEnd="url(#arrow)" />
                <text x={px + pw / 2} y={midY - pr - 18}
                  textAnchor="middle" fontSize={8} fill="#94a3b8">
                  {p.width.toFixed(1)}mm
                </text>
              </>
            )}
            {/* Label */}
            {p.label.split("\n").map((line, li) => (
              <text key={li}
                x={px + pw / 2}
                y={midY + pr + 12 + li * 9}
                textAnchor="middle" fontSize={7}
                fill={p.color} fillOpacity={0.9}
              >{line}</text>
            ))}
          </g>
        );
      })}

      {/* OD dimension */}
      {parts.filter(p => p.type === "roll").slice(0, 1).map((p, idx) => {
        const px = p.x * SCALE + 20;
        const pr = (p.OD / 2) * SCALE;
        return (
          <g key={"od" + idx}>
            <line x1={px - 8} y1={midY - pr} x2={px - 8} y2={midY + pr}
              stroke="#3b82f6" strokeWidth={0.8} />
            <text x={px - 12} y={midY} textAnchor="end" fontSize={7.5} fill="#3b82f6" transform={`rotate(-90,${px - 12},${midY})`}>
              Ø{p.OD.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {[
        [rollColor, side === "upper" ? "Upper Roll" : "Lower Roll"],
        [SHAFT_COLOR, "Drive Shaft"],
        [SPACER_COLOR, "Spacer"],
        [BEARING_COLOR, "Bearing"],
        [KEYWAY_COLOR, "Keyway"],
        [COLLAR_COLOR, "Side Collar"],
      ].map(([color, label], i) => (
        <g key={i} transform={`translate(${svgW - 110}, ${10 + i * 14})`}>
          <rect width={10} height={8} fill={color as string} fillOpacity={0.7} rx={1} />
          <text x={13} y={7.5} fontSize={7.5} fill="#94a3b8">{label as string}</text>
        </g>
      ))}

      {/* Arrow marker */}
      <defs>
        <marker id="arrow" markerWidth={5} markerHeight={5} refX={5} refY={2.5} orient="auto">
          <path d="M0,0 L0,5 L5,2.5 Z" fill="#64748b" />
        </marker>
      </defs>
    </svg>
  );
}

// Cross-section end view of one station
function StationEndViewSVG({
  rt,
}: {
  rt: RollToolingResult;
}) {
  const rp = rt.rollProfile;
  const SCALE = 1.8;
  const maxOD = rp.rollDiameter * SCALE;
  const svgSize = maxOD + 80;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  const upperR = (rp.rollDiameter / 2) * SCALE;
  const lowerR = (rp.rollDiameter / 2) * SCALE;
  const shaftR = (rp.shaftDiameter / 2) * SCALE;
  const gap = (rp.gap ?? 1) * SCALE;
  const grooveR = (rp.grooveDepth ?? 5) * SCALE;

  const upperCy = cy - upperR - gap / 2;
  const lowerCy = cy + lowerR + gap / 2;

  return (
    <svg width={svgSize} height={svgSize * 1.5} className="block mx-auto">
      {/* Pass line */}
      <line x1={10} y1={cy} x2={svgSize - 10} y2={cy}
        stroke="#22c55e" strokeWidth={0.8} strokeDasharray="4 3" opacity={0.7} />
      <text x={12} y={cy - 4} fontSize={7} fill="#22c55e" opacity={0.7}>Pass Line</text>

      {/* Upper roll */}
      <circle cx={cx} cy={upperCy} r={upperR} fill={UPPER_COLOR} fillOpacity={0.15} stroke={UPPER_COLOR} strokeWidth={1.5} />
      <circle cx={cx} cy={upperCy} r={shaftR} fill={SHAFT_COLOR} fillOpacity={0.5} stroke={SHAFT_COLOR} strokeWidth={1} />
      <circle cx={cx} cy={upperCy} r={grooveR} fill={UPPER_COLOR} fillOpacity={0.25} stroke={UPPER_COLOR} strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={cx} y={upperCy + 5} textAnchor="middle" fontSize={8.5} fontWeight="bold" fill={UPPER_COLOR}>R{rp.upperRollNumber}</text>
      <text x={cx} y={upperCy - upperR - 6} textAnchor="middle" fontSize={7} fill={UPPER_COLOR}>Ø{rp.rollDiameter.toFixed(2)}</text>

      {/* Lower roll */}
      <circle cx={cx} cy={lowerCy} r={lowerR} fill={LOWER_COLOR} fillOpacity={0.15} stroke={LOWER_COLOR} strokeWidth={1.5} />
      <circle cx={cx} cy={lowerCy} r={shaftR} fill={SHAFT_COLOR} fillOpacity={0.5} stroke={SHAFT_COLOR} strokeWidth={1} />
      <circle cx={cx} cy={lowerCy} r={grooveR} fill={LOWER_COLOR} fillOpacity={0.25} stroke={LOWER_COLOR} strokeWidth={0.8} strokeDasharray="3 2" />
      <text x={cx} y={lowerCy + 5} textAnchor="middle" fontSize={8.5} fontWeight="bold" fill={LOWER_COLOR}>R{rp.lowerRollNumber}</text>
      <text x={cx} y={lowerCy + lowerR + 12} textAnchor="middle" fontSize={7} fill={LOWER_COLOR}>Ø{rp.rollDiameter.toFixed(2)}</text>

      {/* Gap arrow */}
      <line x1={cx + upperR + 15} y1={upperCy} x2={cx + upperR + 15} y2={lowerCy}
        stroke="#22c55e" strokeWidth={0.8} />
      <text x={cx + upperR + 18} y={(upperCy + lowerCy) / 2 + 3} fontSize={7} fill="#22c55e">
        {(rp.gap ?? 1).toFixed(3)}mm
      </text>

      {/* Station label */}
      <text x={cx} y={svgSize * 1.5 - 8} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#94a3b8">
        {rt.label} — End View
      </text>
    </svg>
  );
}

export function AssemblyDrawingView({ rollTooling }: { rollTooling: RollToolingResult[] }) {
  const [selectedStation, setSelectedStation] = useState(0);
  const [view, setView] = useState<"elevation" | "endview">("elevation");

  if (rollTooling.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
        <div className="text-4xl mb-3">🔩</div>
        <div className="text-sm font-semibold text-zinc-500">Assembly drawing nahi bani</div>
        <div className="text-xs mt-1">Pehle Roll Tooling generate karein</div>
      </div>
    );
  }

  const rt = rollTooling[selectedStation] ?? rollTooling[0];
  const rp = rt.rollProfile;

  const downloadDimSheet = () => {
    const lines = [
      "═══════════════════════════════════════════════",
      "  ROLL ASSEMBLY — DIMENSION SHEET",
      `  Generated: ${new Date().toISOString().split("T")[0]}`,
      "═══════════════════════════════════════════════",
      "",
      "MACHINE LAYOUT",
      `  Total Stations    : ${rollTooling.length}`,
      `  Total Roll Pairs  : ${rollTooling.length}`,
      `  Pass Line Height  : ${rp.passLineY.toFixed(3)} mm`,
      "",
      "ROLL DIMENSIONS (per station)",
      "Station  | Roll# | OD(mm)    | Bore(mm)  | Width(mm) | Groove(mm) | Gap(mm)",
      "─".repeat(80),
      ...rollTooling.flatMap(rt => [
        `${rt.label.padEnd(8)} | R${String(rt.rollProfile.upperRollNumber).padStart(3,"0")} U | Ø${rt.rollProfile.rollDiameter.toFixed(3).padEnd(8)} | Ø${rt.rollProfile.shaftDiameter.toFixed(3).padEnd(8)} | ${rt.rollProfile.rollWidth.toFixed(3).padEnd(8)} | ${rt.rollProfile.grooveDepth.toFixed(3).padEnd(9)} | ${(rt.rollProfile.gap??0).toFixed(3)}`,
        `${" ".repeat(8)} | R${String(rt.rollProfile.lowerRollNumber).padStart(3,"0")} L | Ø${rt.rollProfile.rollDiameter.toFixed(3).padEnd(8)} | Ø${rt.rollProfile.shaftDiameter.toFixed(3).padEnd(8)} | ${rt.rollProfile.rollWidth.toFixed(3).padEnd(8)} | ${rt.rollProfile.grooveDepth.toFixed(3).padEnd(9)} | —`,
      ]),
      "",
      "SHAFT DETAILS",
      ...rollTooling.map(rt => `  ${rt.label}: Ø${rt.rollProfile.shaftDiameter.toFixed(1)} × L${(rt.rollProfile.rollWidth + 220).toFixed(0)} mm`),
      "",
      "SPACER DETAILS",
      ...rollTooling.map(rt => `  ${rt.label}: T${(rt.mfgSpec?.spacerThickness ?? 0).toFixed(2)} mm — ${rt.mfgSpec?.spacerMaterial ?? "EN8"}`),
    ];
    downloadFile(lines.join("\n"), "ROLL_ASSEMBLY_DIMENSION_SHEET.txt");
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-zinc-200">Roll Assembly Drawing</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {rollTooling.length} stations · Pass line Y = {rp.passLineY.toFixed(3)} mm
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView(view === "elevation" ? "endview" : "elevation")}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 transition-all"
          >
            {view === "elevation" ? "End View" : "Elevation View"}
          </button>
          <button
            onClick={downloadDimSheet}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all"
          >⬇ Dimension Sheet</button>
        </div>
      </div>

      {/* View toggle tabs */}
      <div className="flex gap-1.5">
        {(["elevation", "endview"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all ${view === v ? "bg-blue-600/80 text-white" : "bg-white/[0.03] text-zinc-500 hover:text-zinc-200 border border-white/[0.06]"}`}
          >
            {v === "elevation" ? "⊟ Shaft Elevation" : "◎ Station End View"}
          </button>
        ))}
      </div>

      {view === "elevation" ? (
        /* Shaft elevation */
        <div className="space-y-3">
          {(["upper", "lower"] as const).map(side => (
            <div key={side} className="border border-white/[0.07] rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.05] flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: side === "upper" ? UPPER_COLOR : LOWER_COLOR }} />
                <span className="text-[11px] font-bold text-zinc-200 capitalize">{side} Shaft Assembly</span>
                <span className="text-[10px] text-zinc-600 ml-2">
                  Ø{rollTooling[0].rollProfile.shaftDiameter.toFixed(0)} shaft · {rollTooling.length} rolls
                </span>
              </div>
              <div className="p-4 overflow-x-auto bg-[#06060E]">
                <ShaftElevationSVG rollTooling={rollTooling} side={side} />
              </div>
            </div>
          ))}

          {/* Side Collar Specification Table */}
          {rollTooling[0]?.rollProfile.sideCollar && (() => {
            const collar = rollTooling[0].rollProfile.sideCollar!;
            // collar.qty is per-roll (2 per roll); × 2 shafts (upper + lower) per station
            const totalCollarQty = rollTooling.length * collar.qty * 2;
            return (
              <div className="border border-purple-900/60 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-purple-950/20 border-b border-purple-900/40 flex items-center gap-2">
                  <span className="text-purple-400 font-bold text-sm">◉</span>
                  <span className="text-[11px] font-bold text-purple-300">Side Collar Specification</span>
                  <span className="text-[10px] text-purple-600 ml-2">Auto-selected by material type</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-1 bg-purple-950/20 rounded-lg p-2.5">
                      <div className="text-zinc-400 font-semibold uppercase text-[9px] tracking-wider mb-1">Dimensions</div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">OD</span>
                        <span className="text-purple-300 font-mono">Ø{collar.OD} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Bore ID</span>
                        <span className="text-purple-300 font-mono">Ø{collar.ID} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Face Width</span>
                        <span className="text-purple-300 font-mono">{collar.width} mm</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Qty per station</span>
                        <span className="text-purple-300 font-mono">{collar.qty * 2} EA</span>
                      </div>
                      <div className="flex justify-between border-t border-purple-900/40 pt-1 mt-1">
                        <span className="text-zinc-400 font-semibold">Total Qty</span>
                        <span className="text-purple-200 font-bold font-mono">{totalCollarQty} EA</span>
                      </div>
                    </div>
                    <div className="space-y-1 bg-purple-950/20 rounded-lg p-2.5">
                      <div className="text-zinc-400 font-semibold uppercase text-[9px] tracking-wider mb-1">Material & Hardness</div>
                      <div className="text-purple-300 font-semibold">{collar.material}</div>
                      <div className="flex justify-between mt-1">
                        <span className="text-zinc-500">Hardness</span>
                        <span className="text-purple-300 font-mono">{collar.hardness}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1.5 leading-tight">{collar.notes}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-600 bg-zinc-900/50 rounded p-2 leading-tight">
                    Collars shown as purple flanges on both sides of each roll in shaft elevation above.
                    Mount with interference fit on shaft — align flush to roll face.
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* Station end view */
        <div>
          {/* Station selector */}
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {rollTooling.map((rt, i) => (
              <button
                key={rt.stationNumber}
                onClick={() => setSelectedStation(i)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-mono font-semibold transition-all border ${
                  selectedStation === i ? "bg-blue-600 text-white border-blue-600" : "bg-white/[0.03] text-zinc-500 border-white/[0.06] hover:text-zinc-200"
                }`}
              >{rt.label}</button>
            ))}
          </div>

          {/* End view SVG */}
          <div className="border border-white/[0.07] rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.05]">
              <span className="text-[11px] font-bold text-zinc-200">{rt.label} — Cross-Section End View</span>
            </div>
            <div className="p-6 bg-[#06060E] flex items-center justify-center">
              <StationEndViewSVG rt={rt} />
            </div>
          </div>

          {/* Dimension table */}
          <div className="border border-white/[0.07] rounded-xl overflow-hidden mt-3">
            <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.05]">
              <span className="text-[11px] font-bold text-zinc-200">Key Dimensions — {rt.label}</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                ["Roll OD", `Ø${rp.rollDiameter.toFixed(3)} mm`, "text-blue-300"],
                ["Shaft Bore", `Ø${rp.shaftDiameter.toFixed(3)} mm H7`, "text-emerald-300"],
                ["Roll Width", `${rp.rollWidth.toFixed(3)} mm`, "text-amber-300"],
                ["Groove Depth", `${rp.grooveDepth.toFixed(3)} mm`, "text-pink-300"],
                ["Roll Gap", `${(rp.gap ?? 0).toFixed(3)} mm`, "text-cyan-300"],
                ["Pass Line", `${rp.passLineY.toFixed(3)} mm`, "text-green-300"],
                ["K-Factor", `${rp.kFactor}`, "text-violet-300"],
                ["Bore Fit", rt.mfgSpec?.boreFit ?? "H7/k6", "text-zinc-300"],
              ].map(([l, v, c]) => (
                <div key={String(l)} className="border border-white/[0.06] rounded-lg px-3 py-1.5">
                  <div className="text-[9px] text-zinc-600 uppercase">{l}</div>
                  <div className={`text-[11px] font-mono font-semibold ${c}`}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
