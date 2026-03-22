import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { Stage, Layer, Line, Circle, Text, Group, Rect } from "react-konva";
import { useCncStore, type Segment } from "../../store/useCncStore";

const STATION_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#a855f7",
  "#6366f1", "#10b981", "#e11d48", "#0ea5e9", "#84cc16",
  "#d946ef", "#f43f5e", "#2dd4bf", "#fbbf24", "#818cf8",
  "#fb923c", "#34d399", "#f472b6", "#38bdf8", "#a3e635",
  "#c084fc", "#fb7185", "#67e8f9", "#facc15", "#4ade80",
];

function segmentToPoints(seg: Segment): number[] {
  if (seg.type === "line") {
    return [seg.startX, seg.startY, seg.endX, seg.endY];
  }
  if (seg.type === "arc" && seg.centerX !== undefined && seg.centerY !== undefined && seg.radius !== undefined) {
    const cx = seg.centerX;
    const cy = seg.centerY;
    const r = seg.radius;
    const sa = (seg.startAngle || 0) * (Math.PI / 180);
    const ea = (seg.endAngle || 360) * (Math.PI / 180);

    const points: number[] = [];
    const steps = 32;
    let sweep = ea - sa;
    if (sweep <= 0) sweep += Math.PI * 2;

    for (let i = 0; i <= steps; i++) {
      const t = sa + (sweep * i) / steps;
      points.push(cx + r * Math.cos(t), cy + r * Math.sin(t));
    }
    return points;
  }
  return [seg.startX, seg.startY, seg.endX, seg.endY];
}

interface StationBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  xOffset: number;
}

function getSegmentsBounds(segments: Segment[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const seg of segments) {
    const pts = segmentToPoints(seg);
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i]);
      maxX = Math.max(maxX, pts[i]);
      minY = Math.min(minY, pts[i + 1]);
      maxY = Math.max(maxY, pts[i + 1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

export function ProfileCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { geometry, stations, selectedStation, setSelectedStation, rollTooling } = useCncStore();
  const [dims, setDims] = React.useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDims({ width: el.clientWidth, height: el.clientHeight });
    });
    obs.observe(el);
    setDims({ width: el.clientWidth, height: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  const transform = useMemo(() => {
    if (!geometry) return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
    const bb = geometry.boundingBox;
    const geoW = bb.maxX - bb.minX || 1;
    const geoH = bb.maxY - bb.minY || 1;
    const padding = 80;
    const availW = dims.width - padding * 2;
    const availH = dims.height - padding * 2;
    const scale = Math.min(availW / geoW, availH / geoH) * 0.8;
    const offsetX = padding + (availW - geoW * scale) / 2 - bb.minX * scale;
    const offsetY = padding + (availH - geoH * scale) / 2 - bb.minY * scale;
    return { scaleX: scale, scaleY: scale, offsetX, offsetY };
  }, [geometry, dims]);

  const stationLayout = useMemo(() => {
    if (stations.length === 0) return { transform, stationBounds: [] as StationBounds[] };

    let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
    const stationSpacing = 20;
    const stationBounds: StationBounds[] = [];

    let currentXOffset = 0;
    for (let si = 0; si < stations.length; si++) {
      const bounds = getSegmentsBounds(stations[si].segments);
      const width = bounds.maxX - bounds.minX || 1;
      stationBounds.push({ ...bounds, xOffset: currentXOffset });

      gMinX = Math.min(gMinX, bounds.minX + currentXOffset);
      gMaxX = Math.max(gMaxX, bounds.maxX + currentXOffset);
      gMinY = Math.min(gMinY, bounds.minY);
      gMaxY = Math.max(gMaxY, bounds.maxY);

      currentXOffset += width + stationSpacing;
    }

    if (!isFinite(gMinX)) return { transform, stationBounds: [] as StationBounds[] };

    const geoW = gMaxX - gMinX || 1;
    const geoH = gMaxY - gMinY || 1;
    const padding = 60;
    const availW = dims.width - padding * 2;
    const availH = dims.height - padding * 2;
    const scale = Math.min(availW / geoW, availH / geoH) * 0.85;
    const offsetX = padding + (availW - geoW * scale) / 2 - gMinX * scale;
    const offsetY = padding + (availH - geoH * scale) / 2 - gMinY * scale;

    return {
      transform: { scaleX: scale, scaleY: scale, offsetX, offsetY },
      stationBounds,
    };
  }, [stations, dims, transform]);

  const renderSegments = useCallback(
    (segments: Segment[], color: string, strokeWidth: number = 2, xOffset: number = 0, usedTransform = transform) => {
      return segments.map((seg, i) => {
        const pts = segmentToPoints(seg);
        return (
          <Line
            key={i}
            points={pts.map((p, idx) =>
              idx % 2 === 0
                ? (p + xOffset) * usedTransform.scaleX + usedTransform.offsetX
                : p * usedTransform.scaleY + usedTransform.offsetY
            )}
            stroke={color}
            strokeWidth={strokeWidth}
            lineCap="round"
            lineJoin="round"
          />
        );
      });
    },
    [transform]
  );

  const hasStations = stations.length > 0;
  const stBounds = stationLayout.stationBounds;
  const stTransform = stationLayout.transform;

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950 relative">
      <Stage width={dims.width} height={dims.height}>
        <Layer>
          <Rect x={0} y={0} width={dims.width} height={dims.height} fill="#09090b" />

          {geometry && !hasStations && (
            <>
              {renderSegments(geometry.segments, "#3b82f6", 2.5)}
              {geometry.bendPoints.map((bp, i) => (
                <React.Fragment key={`bp-${i}`}>
                  <Circle
                    x={bp.x * transform.scaleX + transform.offsetX}
                    y={bp.y * transform.scaleY + transform.offsetY}
                    radius={5}
                    fill="#ef4444"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                  <Text
                    x={bp.x * transform.scaleX + transform.offsetX + 8}
                    y={bp.y * transform.scaleY + transform.offsetY - 6}
                    text={`${bp.angle.toFixed(1)}\u00B0`}
                    fontSize={10}
                    fill="#fbbf24"
                  />
                </React.Fragment>
              ))}
            </>
          )}

          {hasStations &&
            stations.map((station, si) => {
              const color = STATION_COLORS[si % STATION_COLORS.length];
              const isSelected = selectedStation === station.stationNumber;
              const opacity = selectedStation === null || isSelected ? 1 : 0.3;
              const sw = isSelected ? 3 : 1.5;
              const xOff = stBounds[si] ? stBounds[si].xOffset : 0;

              const stationSegs = station.segments;

              let labelX = dims.width / 2;
              let labelY = 20;

              if (stationSegs.length > 0) {
                const midIdx = Math.floor(stationSegs.length / 2);
                const midSeg = stationSegs[midIdx];
                labelX = ((midSeg.startX + midSeg.endX) / 2 + xOff) * stTransform.scaleX + stTransform.offsetX;
                labelY = Math.min(
                  ...stationSegs.map(s => Math.min(s.startY, s.endY))
                ) * stTransform.scaleY + stTransform.offsetY - 16;
              }

              return (
                <Group
                  key={station.stationNumber}
                  opacity={opacity}
                  onClick={() =>
                    setSelectedStation(
                      isSelected ? null : station.stationNumber
                    )
                  }
                >
                  {renderSegments(stationSegs, color, sw, xOff, stTransform)}
                  <Text
                    x={labelX - 8}
                    y={labelY}
                    text={station.label}
                    fontSize={11}
                    fill={color}
                    fontStyle="bold"
                    align="center"
                  />
                </Group>
              );
            })}

          {rollTooling.length > 0 &&
            rollTooling.map((rt, ri) => {
              const color = STATION_COLORS[ri % STATION_COLORS.length];
              const isSelected = selectedStation === rt.stationNumber;
              const opacity = selectedStation === null || isSelected ? 0.5 : 0.1;
              if (!isSelected && selectedStation !== null) return null;
              const xOff = stBounds[ri] ? stBounds[ri].xOffset : 0;
              return (
                <Group key={`roll-${rt.stationNumber}`} opacity={opacity}>
                  {rt.rollProfile.upperRoll.map((seg, i) => {
                    const pts = segmentToPoints(seg);
                    return (
                      <Line
                        key={`upper-${i}`}
                        points={pts.map((p, idx) =>
                          idx % 2 === 0
                            ? (p + xOff) * stTransform.scaleX + stTransform.offsetX
                            : p * stTransform.scaleY + stTransform.offsetY
                        )}
                        stroke={color}
                        strokeWidth={1}
                        dash={[4, 3]}
                        lineCap="round"
                      />
                    );
                  })}
                  {rt.rollProfile.lowerRoll.map((seg, i) => {
                    const pts = segmentToPoints(seg);
                    return (
                      <Line
                        key={`lower-${i}`}
                        points={pts.map((p, idx) =>
                          idx % 2 === 0
                            ? (p + xOff) * stTransform.scaleX + stTransform.offsetX
                            : p * stTransform.scaleY + stTransform.offsetY
                        )}
                        stroke={color}
                        strokeWidth={1}
                        dash={[2, 4]}
                        lineCap="round"
                      />
                    );
                  })}
                </Group>
              );
            })}

          {!geometry && (
            <Text
              x={dims.width / 2 - 120}
              y={dims.height / 2 - 10}
              text="Upload a DXF file to view profile"
              fontSize={16}
              fill="#71717a"
            />
          )}
        </Layer>
      </Stage>

      {hasStations && (
        <div className="absolute bottom-3 left-3 bg-zinc-900/90 border border-zinc-700 rounded p-2 max-h-48 overflow-y-auto">
          <div className="text-xs text-zinc-400 font-semibold mb-1">Stations</div>
          {stations.map((s, i) => (
            <div
              key={s.stationNumber}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
                selectedStation === s.stationNumber
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:bg-zinc-800"
              }`}
              onClick={() =>
                setSelectedStation(
                  selectedStation === s.stationNumber ? null : s.stationNumber
                )
              }
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATION_COLORS[i % STATION_COLORS.length] }}
              />
              <span>{s.label}</span>
              <span className="text-zinc-500 ml-auto">{s.totalAngle.toFixed(1)}&deg;</span>
            </div>
          ))}
        </div>
      )}

      {selectedStation !== null && stations.length > 0 && (
        <div className="absolute top-3 right-3 bg-zinc-900/90 border border-zinc-700 rounded p-3 w-56">
          <div className="text-xs text-zinc-200 font-semibold mb-2">
            Station {stations.find((s) => s.stationNumber === selectedStation)?.label}
          </div>
          {(() => {
            const st = stations.find((s) => s.stationNumber === selectedStation);
            if (!st) return null;
            const rt = rollTooling.find((r) => r.stationNumber === selectedStation);
            return (
              <div className="text-xs text-zinc-400 space-y-1">
                <div>Segments: {st.segments.length}</div>
                <div>Total Bend: {st.totalAngle.toFixed(1)}&deg;</div>
                {st.bendAngles.map((a, i) => (
                  <div key={`b-${i}`}>Bend {i + 1}: {a.toFixed(1)}&deg;</div>
                ))}
                {st.segmentLengths && st.segmentLengths.length > 0 && (
                  <div className="border-t border-zinc-600 mt-1 pt-1">
                    <div className="text-zinc-300 font-semibold mb-0.5">Segment Lengths</div>
                    {st.segmentLengths.map((len, i) => (
                      <div key={`l-${i}`}>Seg {i + 1}: {len} mm</div>
                    ))}
                  </div>
                )}
                {rt && (
                  <>
                    <div className="border-t border-zinc-600 mt-2 pt-2 text-zinc-300 font-semibold">Roll Tooling</div>
                    <div>Roll Width: {rt.rollProfile.rollWidth} mm</div>
                    <div>Gap: {rt.rollProfile.gap} mm</div>
                    <div>Roll Dia: {rt.rollProfile.rollDiameter} mm</div>
                    <div>Shaft Dia: {rt.rollProfile.shaftDiameter} mm</div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
