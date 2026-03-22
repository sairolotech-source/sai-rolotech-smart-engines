import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { Stage, Layer, Line, Text, Group, Rect, Circle } from "react-konva";
import { useCncStore, type Segment, type PassZoneLabel } from "../../store/useCncStore";
import { AccuracyBadge } from "./AccuracyBadge";
import { FlowerPatternValidator } from "./FlowerPatternValidator";
import { AIFlowerAdvisor } from "./AIFlowerAdvisor";

const STATION_COLORS = [
  "#3b82f6","#ef4444","#22c55e","#f59e0b","#8b5cf6",
  "#ec4899","#06b6d4","#f97316","#14b8a6","#a855f7",
  "#6366f1","#10b981","#e11d48","#0ea5e9","#84cc16",
  "#d946ef","#f43f5e","#2dd4bf","#fbbf24","#818cf8",
  "#fb923c","#34d399","#f472b6","#38bdf8","#a3e635",
  "#c084fc","#fb7185","#67e8f9","#facc15","#4ade80",
];

function segToPoints(seg: Segment): number[] {
  if (seg.type === "line") return [seg.startX, seg.startY, seg.endX, seg.endY];
  if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
    const cx = seg.centerX, cy = seg.centerY, r = seg.radius;
    const sa = (seg.startAngle || 0) * (Math.PI / 180);
    const ea = (seg.endAngle || 360) * (Math.PI / 180);
    let sweep = ea - sa;
    if (sweep <= 0) sweep += Math.PI * 2;
    const pts: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = sa + (sweep * i) / 32;
      pts.push(cx + r * Math.cos(t), cy + r * Math.sin(t));
    }
    return pts;
  }
  return [seg.startX, seg.startY, seg.endX, seg.endY];
}

function getCenter(segs: Segment[]): { cx: number; cy: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const seg of segs) {
    const pts = segToPoints(seg);
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
    }
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

type ViewMode = "flower" | "progression";

function getStationPhase(idx: number, total: number): { label: string; color: string; desc: string } {
  if (total === 1) return { label: "ENTRY+FINAL", color: "#f59e0b", desc: "Single pass calibration" };
  if (idx === total - 1) return { label: "FINAL", color: "#22c55e", desc: "Calibration pass" };
  if (idx === 0) return { label: "ENTRY", color: "#3b82f6", desc: "Low strain — soft contact" };
  const pct = idx / (total - 1);
  if (pct <= 0.35) return { label: "ENTRY", color: "#3b82f6", desc: "Low strain — soft contact" };
  if (pct >= 0.80) return { label: "FINAL", color: "#22c55e", desc: "Calibration pass" };
  return { label: "MAIN", color: "#f97316", desc: "Main forming — full support" };
}

const PASS_ZONE_COLORS: Record<PassZoneLabel, { color: string; bg: string; border: string }> = {
  "Light Bending": { color: "#60a5fa", bg: "#1e3a5f", border: "#3b82f6" },
  "Major Forming": { color: "#fb923c", bg: "#431407", border: "#f97316" },
  "Finishing":     { color: "#a78bfa", bg: "#2e1065", border: "#8b5cf6" },
  "Calibration":   { color: "#4ade80", bg: "#052e16", border: "#22c55e" },
};

function getPassZoneColor(zone: PassZoneLabel | undefined): { color: string; bg: string; border: string } {
  if (!zone) return { color: "#94a3b8", bg: "#1e293b", border: "#334155" };
  return PASS_ZONE_COLORS[zone];
}

export function FlowerPatternView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { stations, geometry, selectedStation, setSelectedStation, accuracyLog, accuracyThreshold } = useCncStore();
  const latestFlowerScore = [...accuracyLog].reverse().find(e => e.taskType === "flower");
  const [dims, setDims] = React.useState({ width: 800, height: 600 });
  const [viewMode, setViewMode] = useState<ViewMode>("flower");
  const [highlightStation, setHighlightStation] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomLevel(z => Math.max(0.2, Math.min(10, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    }
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPanOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const resetView = useCallback(() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setDims({ width: el.clientWidth, height: el.clientHeight }));
    obs.observe(el);
    setDims({ width: el.clientWidth, height: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // For flower view: all stations are centered at same point and overlaid
  const flowerTransform = useMemo(() => {
    if (stations.length === 0) return null;
    let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
    for (const st of stations) {
      for (const seg of st.segments) {
        const pts = segToPoints(seg);
        for (let i = 0; i < pts.length; i += 2) {
          gMinX = Math.min(gMinX, pts[i]); gMaxX = Math.max(gMaxX, pts[i]);
          gMinY = Math.min(gMinY, pts[i + 1]); gMaxY = Math.max(gMaxY, pts[i + 1]);
        }
      }
    }
    if (!isFinite(gMinX)) return null;
    const geoW = gMaxX - gMinX || 1;
    const geoH = gMaxY - gMinY || 1;
    const padding = 80;
    const availW = dims.width - padding * 2;
    const availH = dims.height - padding * 2;
    const scale = Math.min(availW / geoW, availH / geoH) * 0.8;
    const centerX = dims.width / 2;
    const centerY = dims.height / 2;
    const geoCx = (gMinX + gMaxX) / 2;
    const geoCy = (gMinY + gMaxY) / 2;
    return { scale, offsetX: centerX - geoCx * scale, offsetY: centerY - geoCy * scale, geoCx, geoCy };
  }, [stations, dims]);

  // Progression view: side by side with offset (same as current canvas)
  const progressionTransform = useMemo(() => {
    if (stations.length === 0) return null;
    const spacing = 15;
    let currentXOffset = 0;
    let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
    const offsets: number[] = [];
    for (const st of stations) {
      let stMinX = Infinity, stMaxX = -Infinity, stMinY = Infinity, stMaxY = -Infinity;
      for (const seg of st.segments) {
        const pts = segToPoints(seg);
        for (let i = 0; i < pts.length; i += 2) {
          stMinX = Math.min(stMinX, pts[i]); stMaxX = Math.max(stMaxX, pts[i]);
          stMinY = Math.min(stMinY, pts[i + 1]); stMaxY = Math.max(stMaxY, pts[i + 1]);
        }
      }
      offsets.push(currentXOffset);
      gMinX = Math.min(gMinX, stMinX + currentXOffset); gMaxX = Math.max(gMaxX, stMaxX + currentXOffset);
      gMinY = Math.min(gMinY, stMinY); gMaxY = Math.max(gMaxY, stMaxY);
      currentXOffset += (stMaxX - stMinX) + spacing;
    }
    if (!isFinite(gMinX)) return null;
    const geoW = gMaxX - gMinX || 1, geoH = gMaxY - gMinY || 1;
    const padding = 60;
    const availW = dims.width - padding * 2, availH = dims.height - padding * 2;
    const scale = Math.min(availW / geoW, availH / geoH) * 0.85;
    const offsetX = padding + (availW - geoW * scale) / 2 - gMinX * scale;
    const offsetY = padding + (availH - geoH * scale) / 2 - gMinY * scale;
    return { scale, offsetX, offsetY, stationOffsets: offsets };
  }, [stations, dims]);

  if (stations.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 gap-4">
        <div className="text-5xl">🌸</div>
        <div className="text-lg font-semibold text-zinc-400">No Power Pattern Generated</div>
        <div className="text-sm text-center max-w-xs">
          Upload a DXF profile and generate power pattern from <span className="text-blue-400">Station Config</span> section first.
        </div>
      </div>
    );
  }

  const activeHighlight = highlightStation ?? selectedStation;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Top bar */}
      <div className="flex-shrink-0 px-4 py-2 bg-zinc-900 border-b border-zinc-700 flex items-center gap-4">
        <div>
          <div className="text-sm font-bold text-zinc-100">Power Pattern</div>
          <div className="text-xs text-zinc-400">{stations.length} Stations — Profile Forming Progression</div>
        </div>

        <div className="flex gap-2 ml-4">
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === "flower" ? "bg-pink-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            onClick={() => setViewMode("flower")}
          >
            🌸 Flower Overlay
          </button>
          <button
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === "progression" ? "bg-blue-700 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            onClick={() => setViewMode("progression")}
          >
            ▶ Station Progression
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          {latestFlowerScore && (
            <AccuracyBadge score={latestFlowerScore.overallScore} threshold={accuracyThreshold} size="sm" />
          )}
          <span>Click station to highlight</span>
          {activeHighlight !== null && (
            <button
              className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"
              onClick={() => { setHighlightStation(null); setSelectedStation(null); }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative"
          onWheel={handleWheel as any}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/60 rounded-lg px-2 py-1 border border-white/10">
            <button onClick={() => setZoomLevel(z => Math.min(10, z * 1.2))} className="text-xs text-zinc-300 hover:text-white px-1.5 py-0.5">+</button>
            <span className="text-[10px] text-zinc-400 min-w-[40px] text-center">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(z => Math.max(0.2, z * 0.8))} className="text-xs text-zinc-300 hover:text-white px-1.5 py-0.5">-</button>
            <button onClick={resetView} className="text-[10px] text-zinc-500 hover:text-white px-1.5 py-0.5 border-l border-white/10 ml-1">Reset</button>
          </div>
          <Stage width={dims.width} height={dims.height}
            scaleX={zoomLevel} scaleY={zoomLevel}
            x={panOffset.x} y={panOffset.y}
          >
            <Layer>
              <Rect x={0} y={0} width={dims.width} height={dims.height} fill="#09090b" />

              {viewMode === "flower" && flowerTransform && (() => {
                const tr = flowerTransform;
                return (
                  <>
                    {/* Pass line */}
                    <Line
                      points={[0, tr.offsetY + tr.geoCy * tr.scale, dims.width, tr.offsetY + tr.geoCy * tr.scale]}
                      stroke="#22c55e" strokeWidth={1} dash={[8, 6]} opacity={0.4}
                    />
                    <Text x={4} y={tr.offsetY + tr.geoCy * tr.scale - 14} text="PASS LINE" fill="#22c55e" fontSize={9} opacity={0.6} />

                    {stations.map((st, si) => {
                      const color = STATION_COLORS[si % STATION_COLORS.length];
                      const isActive = activeHighlight === st.stationNumber;
                      const opacity = activeHighlight === null ? (si === stations.length - 1 ? 1 : 0.55) : isActive ? 1 : 0.1;
                      const sw = isActive ? 3 : si === stations.length - 1 ? 2.5 : 1.2;

                      return (
                        <Group key={st.stationNumber} opacity={opacity}
                          onClick={() => setHighlightStation(isActive ? null : st.stationNumber)}>
                          {st.segments.map((seg, i) => {
                            const pts = segToPoints(seg);
                            return (
                              <Line key={i}
                                points={pts.map((p, idx) => idx % 2 === 0 ? p * tr.scale + tr.offsetX : p * tr.scale + tr.offsetY)}
                                stroke={color} strokeWidth={sw} lineCap="round" lineJoin="round"
                              />
                            );
                          })}
                          {/* Station label at end of profile */}
                          {st.segments.length > 0 && (() => {
                            const last = st.segments[st.segments.length - 1];
                            const lx = last.endX * tr.scale + tr.offsetX;
                            const ly = last.endY * tr.scale + tr.offsetY;
                            return <Text x={lx + 3} y={ly - 6} text={st.label} fill={color} fontSize={9} fontStyle="bold" />;
                          })()}
                        </Group>
                      );
                    })}

                    {/* Final profile highlight */}
                    <Text
                      x={dims.width / 2 - 50}
                      y={20}
                      text={`FINAL: ${stations[stations.length - 1]?.label}`}
                      fill={STATION_COLORS[(stations.length - 1) % STATION_COLORS.length]}
                      fontSize={11}
                      fontStyle="bold"
                      align="center"
                    />
                  </>
                );
              })()}

              {viewMode === "progression" && progressionTransform && (() => {
                const tr = progressionTransform;
                return stations.map((st, si) => {
                  const color = STATION_COLORS[si % STATION_COLORS.length];
                  const xOff = tr.stationOffsets[si] || 0;
                  const isActive = activeHighlight === st.stationNumber;
                  const opacity = activeHighlight === null || isActive ? 1 : 0.25;
                  const sw = isActive ? 3 : 1.5;

                  // Label position
                  let labelX = dims.width / 2, labelY = 20;
                  if (st.segments.length > 0) {
                    const midSeg = st.segments[Math.floor(st.segments.length / 2)];
                    labelX = ((midSeg.startX + midSeg.endX) / 2 + xOff) * tr.scale + tr.offsetX;
                    const minY = Math.min(...st.segments.map(s => Math.min(s.startY, s.endY)));
                    labelY = minY * tr.scale + tr.offsetY - 16;
                  }

                  return (
                    <Group key={st.stationNumber} opacity={opacity}
                      onClick={() => setHighlightStation(isActive ? null : st.stationNumber)}>
                      {st.segments.map((seg, i) => {
                        const pts = segToPoints(seg);
                        return (
                          <Line key={i}
                            points={pts.map((p, idx) => idx % 2 === 0
                              ? (p + xOff) * tr.scale + tr.offsetX
                              : p * tr.scale + tr.offsetY)}
                            stroke={color} strokeWidth={sw} lineCap="round" lineJoin="round"
                          />
                        );
                      })}
                      <Text x={labelX - 8} y={labelY} text={st.label} fontSize={11} fill={color} fontStyle="bold" />
                      {/* Arrow between stations */}
                      {si < stations.length - 1 && (() => {
                        const next = st.segments[st.segments.length - 1];
                        const ax = (next.endX + xOff) * tr.scale + tr.offsetX + 4;
                        const ay = next.endY * tr.scale + tr.offsetY;
                        return <Text x={ax} y={ay - 5} text="→" fill="#52525b" fontSize={12} />;
                      })()}
                    </Group>
                  );
                });
              })()}

              {stations.length === 0 && (
                <Text x={dims.width / 2 - 100} y={dims.height / 2} text="Generate power pattern first" fontSize={14} fill="#52525b" />
              )}
            </Layer>
          </Stage>
        </div>

        {/* Station legend panel */}
        <div className="w-56 bg-zinc-900 border-l border-zinc-700 overflow-y-auto flex-shrink-0 p-2">
          <div className="text-xs text-zinc-400 font-semibold mb-1 uppercase tracking-wide">Stations</div>

          {/* Pass Zone Legend */}
          <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-zinc-700">
            {(Object.keys(PASS_ZONE_COLORS) as PassZoneLabel[]).map(zone => {
              const zc = PASS_ZONE_COLORS[zone];
              return (
                <span key={zone} className="text-[8px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: zc.bg, color: zc.color, border: `1px solid ${zc.border}` }}>
                  {zone}
                </span>
              );
            })}
          </div>

          {stations.map((st, si) => {
            const color = STATION_COLORS[si % STATION_COLORS.length];
            const isActive = activeHighlight === st.stationNumber;
            const zc = getPassZoneColor(st.passZone);
            return (
              <div
                key={st.stationNumber}
                className={`flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer mb-0.5 transition-colors ${
                  isActive ? "bg-zinc-700" : "hover:bg-zinc-800"
                }`}
                onClick={() => setHighlightStation(isActive ? null : st.stationNumber)}
              >
                <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color }}>{st.label}</span>
                    {st.passZone && (
                      <span className="text-[8px] px-1 rounded font-bold" style={{ backgroundColor: zc.bg, color: zc.color, border: `1px solid ${zc.border}` }}>
                        {st.passZone === "Calibration" ? "CAL" : st.passZone === "Light Bending" ? "LIGHT" : st.passZone === "Major Forming" ? "MAJOR" : "FIN"}
                      </span>
                    )}
                    {st.isCalibrationPass && (
                      <span className="text-[8px] px-1 rounded font-bold bg-green-950 text-green-400 border border-green-700">CAL</span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-600 font-mono">
                    {st.totalAngle.toFixed(1)}° · {st.bendAngles.length}B
                    {st.angleIncrementDeg !== undefined && st.angleIncrementDeg > 0 && (
                      <span className="text-zinc-500"> +{st.angleIncrementDeg.toFixed(1)}°</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Springback & Roll Face Width Info */}
          {stations.length > 0 && (() => {
            const lastSt = stations[stations.length - 1];
            const sbComp = lastSt.springbackCompensationAngle;
            const rfw = lastSt.rollFaceWidth;
            return (
              <div className="mt-3 border-t border-zinc-700 pt-2 space-y-2">
                <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Open Section Info</div>

                {/* Springback Compensation */}
                {sbComp !== undefined && (
                  <div className="bg-amber-950/40 border border-amber-700/40 rounded px-2 py-1.5">
                    <div className="text-[9px] text-amber-400 font-semibold mb-0.5">Springback Compensation</div>
                    <div className="text-[10px] text-amber-300 font-mono">
                      90° → {(90 + sbComp).toFixed(1)}° design angle
                    </div>
                    <div className="text-[9px] text-zinc-500 mt-0.5">Over-bend: +{sbComp.toFixed(1)}°</div>
                  </div>
                )}

                {/* Roll Face Width */}
                {rfw !== undefined && (
                  <div className="bg-cyan-950/40 border border-cyan-700/40 rounded px-2 py-1.5">
                    <div className="text-[9px] text-cyan-400 font-semibold mb-0.5">Roll Face Width</div>
                    <div className="text-[10px] text-cyan-300 font-mono">{rfw.toFixed(1)} mm</div>
                    <div className="text-[9px] text-zinc-500 mt-0.5">Strip width + 3 mm clearance</div>
                  </div>
                )}

                {/* Springback angles from final station */}
                {lastSt.springbackAngles && lastSt.springbackAngles.length > 0 && (
                  <div className="bg-zinc-800/60 rounded px-2 py-1.5">
                    <div className="text-[9px] text-zinc-500 font-semibold mb-0.5">Per-Bend Springback</div>
                    {lastSt.springbackAngles.map((a: number, i: number) => (
                      <div key={i} className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">Bend {i + 1}</span>
                        <span className="text-amber-400 font-mono">{a.toFixed(1)}°</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Smart Power Pattern Advisor — Smart-powered station & defect advice */}
          <div className="mt-3 border-t border-zinc-700 pt-3">
            <AIFlowerAdvisor />
          </div>

          {/* Smart Power Pattern Validator */}
          {stations.length > 0 && (
            <div className="mt-3 border-t border-zinc-700 pt-3">
              <FlowerPatternValidator />
            </div>
          )}
        </div>
      </div>

      {/* C-Channel Pass Breakdown Panel (shown at bottom when stations exist) */}
      {stations.length >= 8 && (() => {
        const zones: { zone: PassZoneLabel; color: string; passes: number[]; desc: string }[] = [
          { zone: "Light Bending", color: "#60a5fa", passes: [], desc: "Pre-bending — strip tracking & entry alignment" },
          { zone: "Major Forming", color: "#fb923c", passes: [], desc: "Main forming — highest roll forces" },
          { zone: "Finishing", color: "#a78bfa", passes: [], desc: "Final angle correction ≤5°/pass" },
          { zone: "Calibration", color: "#4ade80", passes: [], desc: "Calibration — gap = t+0.03mm, ironing action" },
        ];
        stations.forEach((st) => {
          const zone = zones.find(z => z.zone === st.passZone);
          if (zone) zone.passes.push(st.stationNumber);
        });
        const hasZoneData = stations.some(st => st.passZone !== undefined);
        if (!hasZoneData) return null;
        return (
          <div className="flex-shrink-0 bg-zinc-950 border-t border-zinc-700/60 px-4 py-2">
            <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">
              Pass Distribution — C-Channel / Open Section Reference
            </div>
            <div className="flex gap-2 flex-wrap">
              {zones.filter(z => z.passes.length > 0).map(z => {
                const zc = PASS_ZONE_COLORS[z.zone];
                return (
                  <div key={z.zone} className="flex items-center gap-1.5 px-2 py-1 rounded border text-[10px]"
                    style={{ backgroundColor: zc.bg + "99", borderColor: zc.border + "66" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zc.color }} />
                    <div>
                      <span className="font-bold" style={{ color: zc.color }}>{z.zone}</span>
                      <span className="text-zinc-500 ml-1">
                        (Pass {z.passes[0]}{z.passes.length > 1 ? `–${z.passes[z.passes.length - 1]}` : ""})
                      </span>
                      <div className="text-zinc-600">{z.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Bottom station details bar */}
      {activeHighlight !== null && (() => {
        const st = stations.find(s => s.stationNumber === activeHighlight);
        if (!st) return null;
        const zc = getPassZoneColor(st.passZone);
        return (
          <div className="flex-shrink-0 bg-zinc-900 border-t border-zinc-700 px-4 py-2 flex items-center gap-4 text-xs flex-wrap">
            <span className="font-bold" style={{ color: STATION_COLORS[(st.stationNumber - 1) % STATION_COLORS.length] }}>
              {st.label}
            </span>
            {st.passZone && (
              <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ backgroundColor: zc.bg, color: zc.color, border: `1px solid ${zc.border}` }}>
                {st.passZone}
              </span>
            )}
            {st.isCalibrationPass && (
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-green-950 text-green-400 border border-green-700">
                CALIBRATION PASS — Gap = t+0.03mm
              </span>
            )}
            <span className="text-zinc-400">Bends: <span className="text-zinc-200">{st.bendAngles.length}</span></span>
            <span className="text-zinc-400">Total: <span className="text-zinc-200 font-mono">{st.totalAngle.toFixed(1)}°</span></span>
            {st.angleIncrementDeg !== undefined && st.angleIncrementDeg > 0 && (
              <span className="text-zinc-400">+Δ: <span className="text-amber-400 font-mono">{st.angleIncrementDeg.toFixed(1)}°</span></span>
            )}
            {st.springbackCompensationAngle !== undefined && st.springbackCompensationAngle > 0 && (
              <span className="text-zinc-400">SB comp: <span className="text-amber-400 font-mono">+{st.springbackCompensationAngle.toFixed(1)}°</span></span>
            )}
            {st.bendAngles.map((a, i) => (
              <span key={i} className="text-zinc-400">B{i + 1}: <span className="text-blue-400 font-mono">{a.toFixed(1)}°</span></span>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
