import React, { useRef, useState, useCallback } from "react";
import { use3DStudioStore } from "./use3DStudioStore";
import type { SketchShapeType } from "./use3DStudioStore";

interface DrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function SketchCanvas() {
  const { sketchShapes, activeSketchTool, addSketchShape, clearSketchShapes, extrudeSketch, setActiveSketchTool, setMode } = use3DStudioStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [draw, setDraw] = useState<DrawState>({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [extrudeDepth, setExtrudeDepth] = useState(2);

  const getSVGPoint = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeSketchTool === "select") return;
    const { x, y } = getSVGPoint(e);
    setDraw({ isDrawing: true, startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draw.isDrawing) return;
    const { x, y } = getSVGPoint(e);
    setDraw((d) => ({ ...d, currentX: x, currentY: y }));
  };

  const handleMouseUp = () => {
    if (!draw.isDrawing) return;
    const { startX, startY, currentX, currentY } = draw;
    const w = currentX - startX;
    const h = currentY - startY;

    if (activeSketchTool === "rect" && (Math.abs(w) > 5 || Math.abs(h) > 5)) {
      addSketchShape({
        type: "rect",
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(w),
        height: Math.abs(h),
      });
    } else if (activeSketchTool === "circle") {
      const r = Math.sqrt(w * w + h * h) / 2;
      if (r > 3) {
        addSketchShape({
          type: "circle",
          x: startX,
          y: startY,
          radius: r,
        });
      }
    } else if (activeSketchTool === "line" && (Math.abs(w) > 3 || Math.abs(h) > 3)) {
      addSketchShape({
        type: "line",
        x: startX,
        y: startY,
        x2: currentX,
        y2: currentY,
      });
    }

    setDraw({ isDrawing: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });
  };

  const renderPreview = () => {
    if (!draw.isDrawing) return null;
    const { startX, startY, currentX, currentY } = draw;
    const w = currentX - startX;
    const h = currentY - startY;

    if (activeSketchTool === "rect") {
      return (
        <rect
          x={Math.min(startX, currentX)}
          y={Math.min(startY, currentY)}
          width={Math.abs(w)}
          height={Math.abs(h)}
          fill="rgba(68,136,255,0.15)"
          stroke="#4488ff"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      );
    }
    if (activeSketchTool === "circle") {
      const r = Math.sqrt(w * w + h * h) / 2;
      return (
        <circle
          cx={startX}
          cy={startY}
          r={r}
          fill="rgba(68,136,255,0.15)"
          stroke="#4488ff"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      );
    }
    if (activeSketchTool === "line") {
      return (
        <line
          x1={startX}
          y1={startY}
          x2={currentX}
          y2={currentY}
          stroke="#4488ff"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      );
    }
    return null;
  };

  const TOOLS: { id: SketchShapeType | "select"; label: string }[] = [
    { id: "select", label: "Select" },
    { id: "rect", label: "Rectangle" },
    { id: "circle", label: "Circle" },
    { id: "line", label: "Line" },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a16]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#0d0d1e] flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-400 mr-1">Sketch Mode (XY Plane)</span>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveSketchTool(t.id)}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all border ${
              activeSketchTool === t.id
                ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={clearSketchShapes}
          className="px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
        >
          Clear
        </button>
        <button
          onClick={() => setMode("3d")}
          className="px-2.5 py-1 rounded text-[11px] font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-all"
        >
          Cancel
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className="flex-1 cursor-crosshair"
          style={{ userSelect: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="sketchGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1a2e" strokeWidth="0.5" />
            </pattern>
            <pattern id="sketchGrid5" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#sketchGrid)" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#2a2a44" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sketchGrid5)" />

          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#ff444466" strokeWidth="0.5" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#44ff4466" strokeWidth="0.5" />

          {sketchShapes.map((s) => {
            if (s.type === "rect") {
              return (
                <rect
                  key={s.id}
                  x={s.x}
                  y={s.y}
                  width={s.width}
                  height={s.height}
                  fill="rgba(68,136,255,0.1)"
                  stroke="#4488ff"
                  strokeWidth={1.5}
                />
              );
            }
            if (s.type === "circle") {
              return (
                <circle
                  key={s.id}
                  cx={s.x}
                  cy={s.y}
                  r={s.radius}
                  fill="rgba(68,136,255,0.1)"
                  stroke="#4488ff"
                  strokeWidth={1.5}
                />
              );
            }
            if (s.type === "line") {
              return (
                <line
                  key={s.id}
                  x1={s.x}
                  y1={s.y}
                  x2={s.x2}
                  y2={s.y2}
                  stroke="#4488ff"
                  strokeWidth={1.5}
                />
              );
            }
            return null;
          })}

          {renderPreview()}
        </svg>

        <div className="w-48 flex-shrink-0 bg-[#0d0d1e] border-l border-white/[0.06] p-3 flex flex-col gap-3">
          <div className="text-[11px] font-semibold text-zinc-400 mb-1">Extrude</div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Depth (mm)</label>
            <input
              type="number"
              value={extrudeDepth}
              onChange={(e) => setExtrudeDepth(parseFloat(e.target.value) || 1)}
              min={0.1}
              max={100}
              step={0.5}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <button
            onClick={() => extrudeSketch(extrudeDepth)}
            disabled={sketchShapes.length === 0}
            className="w-full py-2 rounded-lg text-[11px] font-semibold bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Extrude to 3D
          </button>
          <div className="text-[10px] text-zinc-600 mt-1">
            {sketchShapes.length} shape{sketchShapes.length !== 1 ? "s" : ""}
          </div>
          <div className="flex-1" />
          <div className="text-[10px] text-zinc-700 leading-relaxed">
            Draw shapes on the XY plane, then click Extrude to create a 3D solid.
          </div>
        </div>
      </div>
    </div>
  );
}
