import React, { useRef, useEffect, useState, useCallback } from "react";
import { useCncStore, type RollToolingResult, type StationProfile, type RollGapInfo } from "../../store/useCncStore";
import {
  type EngineeringScale,
  ENGINEERING_SCALES,
  getScaleFactor,
  formatMM,
  formatAngle,
  getGapSeverity,
  getGapColor,
  type GapSeverity,
} from "../../lib/engineering-scale";

const UPPER_COLOR = "#3b82f6";
const LOWER_COLOR = "#f97316";
const PASS_LINE_COLOR = "#22c55e";
const STRIP_COLOR = "#fbbf24";

function MiniProfile({ segments, width = 60, height = 40 }: {
  segments: { startX: number; startY: number; endX: number; endY: number }[];
  width?: number;
  height?: number;
}) {
  if (segments.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of segments) {
    minX = Math.min(minX, s.startX, s.endX); maxX = Math.max(maxX, s.startX, s.endX);
    minY = Math.min(minY, s.startY, s.endY); maxY = Math.max(maxY, s.startY, s.endY);
  }
  const pw = maxX - minX || 1, ph = maxY - minY || 1;
  const scale = Math.min((width - 8) / pw, (height - 8) / ph) * 0.85;
  const ox = (width - pw * scale) / 2 - minX * scale;
  const oy = (height - ph * scale) / 2 - minY * scale;
  const tx = (x: number) => x * scale + ox;
  const ty = (y: number) => height - (y * scale + oy);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill="#0f172a" rx={2} />
      {segments.map((seg, i) => (
        <line key={i} x1={tx(seg.startX)} y1={ty(seg.startY)} x2={tx(seg.endX)} y2={ty(seg.endY)}
          stroke={STRIP_COLOR} strokeWidth={1.5} strokeLinecap="round" />
      ))}
    </svg>
  );
}

function ProfileWithAnnotations({ segments, bendAngles, segmentLengths, width = 120, height = 70 }: {
  segments: { startX: number; startY: number; endX: number; endY: number }[];
  bendAngles: number[];
  segmentLengths?: number[];
  width?: number;
  height?: number;
}) {
  if (segments.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of segments) {
    minX = Math.min(minX, s.startX, s.endX); maxX = Math.max(maxX, s.startX, s.endX);
    minY = Math.min(minY, s.startY, s.endY); maxY = Math.max(maxY, s.startY, s.endY);
  }
  const pw = maxX - minX || 1, ph = maxY - minY || 1;
  const scale = Math.min((width - 16) / pw, (height - 16) / ph) * 0.75;
  const ox = (width - pw * scale) / 2 - minX * scale;
  const oy = (height - ph * scale) / 2 - minY * scale;
  const tx = (x: number) => x * scale + ox;
  const ty = (y: number) => height - (y * scale + oy);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill="#0f172a" rx={2} />
      {segments.map((seg, i) => (
        <g key={i}>
          <line x1={tx(seg.startX)} y1={ty(seg.startY)} x2={tx(seg.endX)} y2={ty(seg.endY)}
            stroke={STRIP_COLOR} strokeWidth={1.5} strokeLinecap="round" />
          {segmentLengths && segmentLengths[i] !== undefined && (
            <text
              x={(tx(seg.startX) + tx(seg.endX)) / 2}
              y={(ty(seg.startY) + ty(seg.endY)) / 2 - 3}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize={6}
              fontFamily="monospace"
            >
              {formatMM(segmentLengths[i])}
            </text>
          )}
        </g>
      ))}
      {bendAngles.map((angle, i) => {
        if (i >= segments.length) return null;
        const seg = segments[i];
        return (
          <text
            key={`ba-${i}`}
            x={tx(seg.endX) + 3}
            y={ty(seg.endY) - 3}
            fill="#60a5fa"
            fontSize={6}
            fontFamily="monospace"
          >
            {formatAngle(angle)}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Interference / Collision Warning Panel ──────────────────────────────────
function InterferenceWarningPanel({ rollGaps, rollTooling, materialThickness }: {
  rollGaps: RollGapInfo[];
  rollTooling: RollToolingResult[];
  materialThickness: number;
}) {
  const MIN_SAFE_GAP = materialThickness * 0.05;

  interface IssueEntry {
    label: string;
    stationNumber: number;
    springbackGap: number;
    nominalGap: number;
    severity: "CLASH" | "CRITICAL" | "TIGHT";
  }

  const issues: IssueEntry[] = [];
  for (const gap of rollGaps) {
    const rt = rollTooling.find(r => r.stationNumber === gap.stationNumber);
    const label = rt?.label ?? `Stn ${gap.stationNumber}`;
    if (gap.springbackGap <= 0) {
      issues.push({ label, stationNumber: gap.stationNumber, springbackGap: gap.springbackGap, nominalGap: gap.nominalGap, severity: "CLASH" });
    } else if (gap.springbackGap < MIN_SAFE_GAP) {
      issues.push({ label, stationNumber: gap.stationNumber, springbackGap: gap.springbackGap, nominalGap: gap.nominalGap, severity: "CRITICAL" });
    } else if (gap.springbackGap < materialThickness * 0.5) {
      issues.push({ label, stationNumber: gap.stationNumber, springbackGap: gap.springbackGap, nominalGap: gap.nominalGap, severity: "TIGHT" });
    }
  }

  if (issues.length === 0) return null;

  const SEV_STYLE = {
    CLASH:    { border: "border-red-600/60",    bg: "bg-red-950/30",    text: "text-red-400",    badge: "bg-red-700/50 text-red-200 border-red-600/50",    icon: "🔴", desc: "ROLL CLASH — Interference detected" },
    CRITICAL: { border: "border-red-700/40",    bg: "bg-red-950/20",    text: "text-red-400",    badge: "bg-red-900/50 text-red-300 border-red-700/50",    icon: "🟠", desc: "CRITICAL — Gap below safe minimum" },
    TIGHT:    { border: "border-amber-700/40",  bg: "bg-amber-950/15",  text: "text-amber-400",  badge: "bg-amber-900/40 text-amber-300 border-amber-700/40", icon: "🟡", desc: "TIGHT — Gap near material thickness limit" },
  };

  return (
    <div className="flex-shrink-0 px-5 py-2.5 border-t border-zinc-800">
      <div className="rounded-xl border border-red-800/40 bg-red-950/10 px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold text-red-400 uppercase tracking-widest">⚠ Collision / Interference Warnings</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-red-900/50 text-red-300 border-red-700/50 ml-auto">
            {issues.filter(i => i.severity === "CLASH").length} CLASH · {issues.filter(i => i.severity === "CRITICAL").length} CRITICAL · {issues.filter(i => i.severity === "TIGHT").length} TIGHT
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {issues.map(issue => {
            const sty = SEV_STYLE[issue.severity];
            return (
              <div key={issue.stationNumber} className={`rounded-lg border px-3 py-1.5 ${sty.border} ${sty.bg} flex items-center gap-2`}>
                <span className="text-[11px]">{sty.icon}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-zinc-200">{issue.label}</span>
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded border ${sty.badge}`}>{issue.severity}</span>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-500">
                    nominal: {formatMM(issue.nominalGap)} · springback: <span className={issue.springbackGap <= 0 ? "text-red-400 font-bold" : sty.text}>{formatMM(issue.springbackGap)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[9px] text-zinc-600 mt-2">
          Safe minimum gap = material thickness × 5% = {formatMM(MIN_SAFE_GAP)} mm. Clash → adjust clearance or re-run roll tooling.
        </div>
      </div>
    </div>
  );
}

export function DigitalTwinView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { rollTooling, stations, rollGaps, materialThickness, materialType, lineSpeed, pythonPipelineSyncedAt } = useCncStore();
  const [containerW, setContainerW] = useState(900);
  const [animFrame, setAnimFrame] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedSt, setSelectedSt] = useState<number | null>(null);
  const [svgScale, setSvgScale] = useState<EngineeringScale>("1:10");

  const svgScaleFactor = getScaleFactor(svgScale);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setContainerW(el.clientWidth));
    obs.observe(el);
    setContainerW(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setAnimFrame((f) => (f + 1) % 60);
    }, 50);
    return () => clearInterval(interval);
  }, [isAnimating]);

  const handleExportSVG = useCallback(() => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.download = `digital-twin-${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, []);

  if (rollTooling.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 gap-4">
        <div className="text-5xl">🏭</div>
        <div className="text-lg font-semibold text-zinc-400">No Machine Data</div>
        <div className="text-sm text-center max-w-xs">
          Generate Roll Tooling first to see the Digital Twin machine view.
        </div>
      </div>
    );
  }

  const stCount = rollTooling.length;
  const rollDia = rollTooling[0]?.rollProfile?.rollDiameter ?? 150;
  const shaftDia = rollTooling[0]?.rollProfile?.shaftDiameter ?? 40;

  const SVG_H = 380;
  const marginLeft = 60;
  const marginRight = 40;
  const stationSpacing = Math.max(80, (containerW - marginLeft - marginRight) / stCount);
  const svgW = Math.max(containerW, stCount * stationSpacing + marginLeft + marginRight);

  const passY = SVG_H * 0.45;
  const baseVisualScale = Math.min(0.5, (SVG_H * 0.35) / rollDia);
  const visualScale = baseVisualScale / (svgScaleFactor / 10);
  const rollR = rollDia * visualScale;
  const shaftR = shaftDia * visualScale * 0.5;
  const bedY = Math.min(passY + rollR + 30, SVG_H - 50);

  const stripOffset = isAnimating ? (animFrame / 60) * stationSpacing : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      <div className="flex-shrink-0 px-5 py-2.5 bg-zinc-900 border-b border-zinc-700 flex items-center gap-4">
        <div>
          <div className="text-sm font-bold text-zinc-100">🏭 Digital Twin — Machine Side View</div>
          <div className="text-xs text-zinc-400">
            {stCount} Stations · {stCount * 2} Rolls · Pass Line: {rollTooling[0]?.rollProfile?.passLineY != null && isFinite(rollTooling[0].rollProfile!.passLineY) ? formatMM(rollTooling[0].rollProfile!.passLineY) + " mm" : "N/A"} · 1 unit = 1mm
          </div>
        </div>

        <div className="flex items-center gap-3 ml-4">
          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${isAnimating ? "bg-red-700 hover:bg-red-600 text-white" : "bg-green-700 hover:bg-green-600 text-white"}`}
          >
            {isAnimating ? "⏹ Stop" : "▶ Animate Strip Flow"}
          </button>
          <button onClick={() => setSelectedSt(null)} className="px-2 py-1.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400">Clear Selection</button>
          <button
            onClick={handleExportSVG}
            className="px-2 py-1.5 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
          >
            Export SVG
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 font-mono">View Scale:</span>
            <select
              value={svgScale}
              onChange={(e) => setSvgScale(e.target.value as EngineeringScale)}
              className="bg-zinc-800 border border-zinc-600 text-zinc-200 text-[10px] font-mono rounded px-1.5 py-0.5"
            >
              {ENGINEERING_SCALES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {pythonPipelineSyncedAt && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-900/60 border border-emerald-600/40 text-emerald-300"
              title={`Python pipeline last synced: ${new Date(pythonPipelineSyncedAt).toLocaleTimeString()}`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold tracking-wide">PYTHON SYNCED</span>
              <span className="text-[9px] text-emerald-500 font-mono ml-1">
                {new Date(pythonPipelineSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500" /><span>Upper Roll</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-500" /><span>Lower Roll</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-green-500" /><span>Pass Line</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-amber-400" /><span>Strip</span></div>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-shrink-0 overflow-x-auto border-b border-zinc-800" style={{ background: "#07080d" }}>
        <svg width={svgW} height={SVG_H} style={{ display: "block" }}>
          {Array.from({ length: Math.ceil(svgW / 50) }).map((_, i) => (
            <line key={`gx-${i}`} x1={i * 50} y1={0} x2={i * 50} y2={SVG_H} stroke="#1c1f2e" strokeWidth={0.5} />
          ))}
          {Array.from({ length: Math.ceil(SVG_H / 50) }).map((_, i) => (
            <line key={`gy-${i}`} x1={0} y1={i * 50} x2={svgW} y2={i * 50} stroke="#1c1f2e" strokeWidth={0.5} />
          ))}

          <rect x={0} y={bedY} width={svgW} height={SVG_H - bedY} fill="#111827" stroke="#374151" strokeWidth={1} />
          <text x={8} y={bedY + 14} fill="#4b5563" fontSize={9} fontFamily="monospace">MACHINE BED</text>

          <line x1={0} y1={passY} x2={svgW} y2={passY} stroke={PASS_LINE_COLOR} strokeWidth={1.5} strokeDasharray="10 5" />
          <text x={4} y={passY - 5} fill={PASS_LINE_COLOR} fontSize={9} fontFamily="monospace">{`PASS LINE (${rollTooling[0]?.rollProfile?.passLineY != null && isFinite(rollTooling[0].rollProfile!.passLineY) ? formatMM(rollTooling[0].rollProfile!.passLineY) + "mm" : "N/A"})`}</text>

          <rect x={marginLeft - 40} y={passY - 15} width={20} height={30} fill="#1e293b" stroke="#475569" strokeWidth={1.5} rx={2} />
          <text x={marginLeft - 45} y={passY + 25} fill="#475569" fontSize={8} fontFamily="monospace">ENTRY</text>

          {isAnimating && (
            <g>
              <rect
                x={stripOffset + marginLeft - 50}
                y={passY - materialThickness * visualScale * 5}
                width={stCount * stationSpacing + 100}
                height={materialThickness * visualScale * 10}
                fill={STRIP_COLOR}
                fillOpacity={0.35}
                stroke={STRIP_COLOR}
                strokeWidth={1}
                strokeOpacity={0.6}
              />
              <text x={stripOffset + marginLeft} y={passY - 18} fill={STRIP_COLOR} fontSize={9} fontFamily="monospace">
                ▶ {materialType} · {formatMM(materialThickness)}mm · {lineSpeed} m/min
              </text>
            </g>
          )}

          {!isAnimating && (
            <line x1={marginLeft - 40} y1={passY} x2={svgW - 20} y2={passY} stroke={STRIP_COLOR} strokeWidth={materialThickness * visualScale * 10 || 2} strokeOpacity={0.3} />
          )}

          {rollTooling.map((rt, idx) => {
            const stX = marginLeft + idx * stationSpacing + stationSpacing / 2;
            const rp = rt.rollProfile;
            if (!rp) {
              return (
                <g key={rt.stationNumber} opacity={0.3}>
                  <line x1={stX} y1={passY - 60} x2={stX} y2={bedY} stroke="#475569" strokeWidth={1} strokeDasharray="4 3" />
                  <text x={stX} y={bedY + 16} textAnchor="middle" fill="#6b7280" fontSize={8} fontFamily="monospace">{rt.label}</text>
                  <text x={stX} y={bedY + 26} textAnchor="middle" fill="#dc2626" fontSize={7} fontFamily="monospace">NO PROFILE</text>
                </g>
              );
            }
            const isSelected = selectedSt === rt.stationNumber;
            const alpha = selectedSt === null || isSelected ? 1 : 0.3;
            const gap = rollGaps[idx];
            const gapSeverity: GapSeverity | null = gap ? getGapSeverity(gap.springbackGap, materialThickness) : null;
            const gapCol = gapSeverity ? getGapColor(gapSeverity) : PASS_LINE_COLOR;

            return (
              <g key={rt.stationNumber} opacity={alpha} style={{ cursor: "pointer" }}
                onClick={() => setSelectedSt(isSelected ? null : rt.stationNumber)}>

                <line x1={stX} y1={passY - rollR - 60} x2={stX} y2={passY - rollR} stroke="#475569" strokeWidth={2} />
                <line x1={stX} y1={passY + rollR} x2={stX} y2={bedY} stroke="#475569" strokeWidth={2} />

                <circle cx={stX} cy={passY - rollR} r={rollR} fill="#1e3a5f" stroke={isSelected ? "#60a5fa" : UPPER_COLOR} strokeWidth={isSelected ? 2.5 : 1.5} />
                <circle cx={stX} cy={passY - rollR} r={shaftR} fill="#0f172a" stroke="#475569" strokeWidth={1} />
                <text x={stX} y={passY - rollR + 4} textAnchor="middle" fill={UPPER_COLOR} fontSize={10} fontWeight="bold" fontFamily="monospace">
                  R{rp.upperRollNumber}
                </text>

                <circle cx={stX} cy={passY + rollR} r={rollR} fill="#431407" stroke={isSelected ? "#fb923c" : LOWER_COLOR} strokeWidth={isSelected ? 2.5 : 1.5} />
                <circle cx={stX} cy={passY + rollR} r={shaftR} fill="#0f172a" stroke="#475569" strokeWidth={1} />
                <text x={stX} y={passY + rollR + 4} textAnchor="middle" fill={LOWER_COLOR} fontSize={10} fontWeight="bold" fontFamily="monospace">
                  R{rp.lowerRollNumber}
                </text>

                {gap && (
                  <>
                    <rect x={stX - 16} y={passY - 4} width={32} height={8} fill={gapSeverity === "critical" ? "#450a0a" : gapSeverity === "tight" ? "#422006" : "#052e16"} stroke={gapCol} strokeWidth={0.8} rx={1} />
                    <text x={stX} y={passY + 3.5} textAnchor="middle" fill={gapCol} fontSize={6.5} fontFamily="monospace">
                      {formatMM(gap.springbackGap)}
                    </text>
                  </>
                )}

                <text x={stX} y={bedY + 16} textAnchor="middle" fill={isSelected ? "#e2e8f0" : "#6b7280"} fontSize={9} fontWeight={isSelected ? "bold" : "normal"} fontFamily="monospace">
                  {rt.label}
                </text>

                {stations[idx] && (() => {
                  const mw = 56, mh = 34;
                  return (
                    <foreignObject x={stX - mw / 2} y={passY - rollR - mh - 68} width={mw} height={mh}>
                      <div>
                        <MiniProfile segments={stations[idx].segments} width={mw} height={mh} />
                      </div>
                    </foreignObject>
                  );
                })()}

                {isSelected && (
                  <rect x={stX - stationSpacing * 0.42} y={10} width={stationSpacing * 0.84} height={SVG_H - bedY + bedY - 20} fill="#3b82f6" fillOpacity={0.04} stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 3" rx={4} />
                )}
              </g>
            );
          })}

          <rect x={svgW - marginRight - 10} y={passY - 15} width={20} height={30} fill="#1e293b" stroke="#475569" strokeWidth={1.5} rx={2} />
          <text x={svgW - marginRight - 20} y={passY + 25} fill="#475569" fontSize={8} fontFamily="monospace">EXIT</text>

          <text x={6} y={passY - rollR * 2 - 10} fill="#374151" fontSize={8} fontFamily="monospace">Upper arbor</text>
          <text x={6} y={bedY - 4} fill="#374151" fontSize={8} fontFamily="monospace">Lower arbor</text>
          <line x1={42} y1={passY - rollR * 2 + 2} x2={42} y2={passY + rollR * 2 - 2} stroke="#374151" strokeWidth={0.7} />
          <text x={44} y={passY + 4} fill="#374151" fontSize={8} fontFamily="monospace">Ø{formatMM(rollDia)}mm</text>

          <text x={svgW - 120} y={SVG_H - 8} fill="#374151" fontSize={8} fontFamily="monospace">
            View Scale: {svgScale} · 1 unit = 1mm
          </text>
        </svg>
      </div>

      {/* ── Collision / Interference Warning Panel ── */}
      <InterferenceWarningPanel rollGaps={rollGaps} rollTooling={rollTooling} materialThickness={materialThickness} />

      <div className="flex-1 overflow-y-auto">
        {selectedSt !== null ? (
          <StationDetail
            rt={rollTooling.find((r) => r.stationNumber === selectedSt)!}
            station={stations.find((s) => s.stationNumber === selectedSt)}
            gap={rollGaps.find((g) => g.stationNumber === selectedSt)}
            materialThickness={materialThickness}
          />
        ) : (
          <StationGrid rollTooling={rollTooling} stations={stations} rollGaps={rollGaps}
            onSelect={(n) => setSelectedSt(n)} materialThickness={materialThickness} />
        )}
      </div>
    </div>
  );
}

function StationGrid({ rollTooling, stations, rollGaps, onSelect, materialThickness }: {
  rollTooling: RollToolingResult[];
  stations: StationProfile[];
  rollGaps: RollGapInfo[];
  onSelect: (n: number) => void;
  materialThickness: number;
}) {
  return (
    <div className="px-5 py-3">
      <div className="text-xs text-zinc-500 mb-2">Click a station in the machine view above for details, or click a card below:</div>
      <div className="grid grid-cols-4 gap-2">
        {rollTooling.map((rt: RollToolingResult, i: number) => {
          const gap = rollGaps[i];
          const st = stations[i];
          const gapSeverity: GapSeverity | null = gap ? getGapSeverity(gap.springbackGap, materialThickness) : null;
          const gapCol = gapSeverity ? getGapColor(gapSeverity) : "#22c55e";
          const stColors = ["#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#f97316","#14b8a6","#a855f7","#6366f1","#10b981"];
          const color = stColors[i % stColors.length];
          return (
            <div key={rt.stationNumber}
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 cursor-pointer hover:border-zinc-500 transition-colors"
              onClick={() => onSelect(rt.stationNumber)}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="font-bold text-xs" style={{ color }}>{rt.label}</span>
                <span className="text-zinc-600 text-[10px] ml-auto">R{rt.rollProfile?.upperRollNumber}/R{rt.rollProfile?.lowerRollNumber}</span>
              </div>
              {st && <MiniProfile segments={st.segments} width={80} height={36} />}
              <div className="mt-1.5 space-y-0.5 text-[10px] font-mono text-zinc-400">
                <div className="flex justify-between">
                  <span>OD</span><span className="text-zinc-200">{formatMM(rt.rollProfile?.rollDiameter ?? 0)}mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Gap</span>
                  <span style={{ color: gapCol }}>
                    {formatMM(gap?.springbackGap ?? rt.rollProfile?.gap ?? 0)}mm
                    {gapSeverity && <span className="ml-1 text-[8px]">[{gapSeverity}]</span>}
                  </span>
                </div>
                {st && <div className="flex justify-between">
                  <span>Bends</span><span className="text-blue-400">{st.bendAngles.length}</span>
                </div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StationDetail({ rt, station, gap, materialThickness }: {
  rt: RollToolingResult;
  station: StationProfile | undefined;
  gap: RollGapInfo | undefined;
  materialThickness: number;
}) {
  const rp = rt.rollProfile;
  if (!rp) {
    return (
      <div className="px-5 py-3 text-[11px] text-zinc-500 italic">
        {rt.label} — roll profile not yet generated. Click <span className="text-blue-400 font-semibold">Generate Roll Tooling</span> to populate station data.
      </div>
    );
  }
  const gapSeverity: GapSeverity | null = gap ? getGapSeverity(gap.springbackGap, materialThickness) : null;
  const gapCol = gapSeverity ? getGapColor(gapSeverity) : "#22c55e";

  return (
    <div className="px-5 py-3">
      <div className="text-sm font-bold text-zinc-100 mb-3">{rt.label} — Detailed Station Spec</div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-blue-900/50 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-400 mb-2">Upper Roll R{rp.upperRollNumber}</div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between"><span className="text-zinc-400">OD</span><span className="text-blue-300">{formatMM(rp.rollDiameter)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Bore</span><span className="text-blue-300">{formatMM(rp.shaftDiameter)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Width</span><span className="text-blue-300">{formatMM(rp.rollWidth)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Center Y</span><span className="text-green-400">{formatMM(rp.upperRollCenterY)} mm</span></div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-orange-900/50 rounded-lg p-3">
          <div className="text-xs font-semibold text-orange-400 mb-2">Lower Roll R{rp.lowerRollNumber}</div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between"><span className="text-zinc-400">OD</span><span className="text-orange-300">{formatMM(rp.rollDiameter)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Bore</span><span className="text-orange-300">{formatMM(rp.shaftDiameter)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Width</span><span className="text-orange-300">{formatMM(rp.rollWidth)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Center Y</span><span className="text-green-400">{formatMM(rp.lowerRollCenterY)} mm</span></div>
          </div>
        </div>
        <div className="bg-zinc-900 border border-green-900/50 rounded-lg p-3">
          <div className="text-xs font-semibold text-green-400 mb-2">Pass Line & Gap</div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between"><span className="text-zinc-400">Pass Line</span><span className="text-green-300">{rp.passLineY != null && isFinite(rp.passLineY) ? formatMM(rp.passLineY) + " mm" : "N/A"}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Nominal Gap</span><span className="text-amber-400">{formatMM(gap?.nominalGap ?? rp.gap, 4)} mm</span></div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Springback Gap</span>
              <span style={{ color: gapCol }}>
                {formatMM(gap?.springbackGap ?? rp.gap, 4)} mm
                {gapSeverity && <span className="ml-1 text-[8px]">[{gapSeverity}]</span>}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-zinc-400">K-Factor</span><span className="text-pink-400">{rp.kFactor}</span></div>
            <div className="flex justify-between"><span className="text-zinc-400">Neutral Axis</span><span className="text-pink-400">{formatMM(rp.neutralAxisOffset)} mm</span></div>
          </div>
        </div>
      </div>
      {station && (
        <div className="mt-3 bg-zinc-900 border border-zinc-700 rounded-lg p-3">
          <div className="text-xs font-semibold text-zinc-300 mb-2">Profile at {rt.label}</div>
          <div className="flex items-start gap-4">
            <ProfileWithAnnotations
              segments={station.segments}
              bendAngles={station.bendAngles}
              segmentLengths={station.segmentLengths}
              width={120}
              height={70}
            />
            <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs font-mono">
              {station.bendAngles.map((a: number, i: number) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-zinc-500">Bend {i + 1}</span>
                  <span className="text-blue-400">{formatAngle(a)}</span>
                </div>
              ))}
              {station.segmentLengths?.map((l: number, i: number) => (
                <div key={`l${i}`} className="flex justify-between gap-2">
                  <span className="text-zinc-500">Seg {i + 1}</span>
                  <span className="text-amber-400">{formatMM(l)} mm</span>
                </div>
              ))}
              {gap?.bendAllowances.map((ba: number, i: number) => (
                <div key={`ba${i}`} className="flex justify-between gap-2">
                  <span className="text-zinc-500">BA {i + 1}</span>
                  <span className="text-pink-400">{formatMM(ba)} mm</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
