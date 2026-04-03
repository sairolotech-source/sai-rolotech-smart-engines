import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Play, Settings,
  Eye, EyeOff, Zap, Layers, Circle, Hash, Scissors,
  FileCode2, Download, Copy, ArrowUp, ArrowDown,
  Drill, Box, Target, RotateCw, Move, Wrench
} from "lucide-react";
import {
  type MillOperation, type MillOpType, type MillController, type MillFaceOp,
  type MillPocketZigzagOp, type MillPocketContourOp, type MillContourOp,
  type MillSlotOp, type MillChamferOp, type MillDeburOp, type MillDrillOp,
  type MillIMachiningOp, type MillTrochoidalOp, type MillManualOp,
  type MillCutting, type MillTool,
  type TurnOperation, type TurnOpType, type MillTurnOp,
  generateMillGcode, generateMillToolpath, generateMillTurnGcode,
  makeMillFaceOp, makeMillPocketZigzagOp, makeMillPocketContourOp,
  makeMillContourOp, makeMillSlotOp, makeMillChamferOp, makeMillDeburOp, makeMillDrillOp,
  makeMillIMachiningOp, makeMillTrochoidalOp, makeMillManualOp,
  makeTurnOperation, millUid,
} from "./MillingGcodeGenerator";
import { MillingToolpathPreview } from "./MillingToolpathPreview";

type CamMode = "milling" | "turning" | "mill_turn";

const OP_META: Record<MillOpType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  mill_face:            { label: "Face Mill",           icon: <Layers className="w-3.5 h-3.5" />,  color: "text-blue-400",   desc: "Face milling — clean top surface" },
  mill_pocket_zigzag:   { label: "Pocket (Zigzag)",     icon: <Box className="w-3.5 h-3.5" />,     color: "text-orange-400", desc: "2.5D pocket with zigzag/raster strategy" },
  mill_pocket_contour:  { label: "Pocket (Contour)",    icon: <Box className="w-3.5 h-3.5" />,     color: "text-amber-400",  desc: "2.5D pocket with contour-parallel strategy" },
  mill_contour:         { label: "Contour/Profile",     icon: <Target className="w-3.5 h-3.5" />,  color: "text-green-400",  desc: "2D profile milling along contour" },
  mill_slot:            { label: "Slot Mill",           icon: <Scissors className="w-3.5 h-3.5" />,color: "text-yellow-400", desc: "Slot milling — keyway, channel" },
  mill_chamfer:         { label: "Chamfer/Deburr",      icon: <Target className="w-3.5 h-3.5" />,  color: "text-rose-400",   desc: "Edge chamfer and deburr" },
  mill_deburr:          { label: "Deburr",              icon: <Wrench className="w-3.5 h-3.5" />,  color: "text-rose-300",   desc: "Deburr edges" },
  mill_drill_spot:      { label: "Spot Drill (G81)",    icon: <Drill className="w-3.5 h-3.5" />,   color: "text-cyan-400",   desc: "Spot/center drill canned cycle" },
  mill_drill_peck:      { label: "Peck Drill (G83)",    icon: <Drill className="w-3.5 h-3.5" />,   color: "text-cyan-400",   desc: "Deep peck drilling canned cycle" },
  mill_drill_tap:       { label: "Tap (G84)",           icon: <Hash className="w-3.5 h-3.5" />,    color: "text-violet-400", desc: "Tapping canned cycle" },
  mill_drill_bore:      { label: "Bore (G85)",          icon: <Circle className="w-3.5 h-3.5" />,  color: "text-green-400",  desc: "Bore with feed retract" },
  mill_drill_bore_stop: { label: "Bore + Stop (G86)",   icon: <Circle className="w-3.5 h-3.5" />,  color: "text-emerald-400",desc: "Bore with spindle stop retract" },
  mill_imachining:      { label: "iMachining",          icon: <Zap className="w-3.5 h-3.5" />,     color: "text-fuchsia-400",desc: "Adaptive roughing — constant engagement angle" },
  mill_trochoidal:      { label: "Trochoidal/HSM",      icon: <RotateCw className="w-3.5 h-3.5" />,color: "text-pink-400",   desc: "Trochoidal milling for hard materials" },
  mill_manual:          { label: "Manual G-code",       icon: <FileCode2 className="w-3.5 h-3.5" />,color: "text-zinc-400",  desc: "Custom G-code block" },
};

const MILL_CONTROLLERS: Record<MillController, string> = {
  fanuc: "Fanuc 0i-MF", haas: "Haas VF Series",
  siemens: "Siemens 840D", mazak: "Mazak Mazatrol",
  mitsubishi: "Mitsubishi M70",
};

const inputCls = "bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 w-full focus:border-blue-500 outline-none";
const labelCls = "text-[10px] text-zinc-500 mb-0.5 block";
const sectionCls = "text-[10px] text-zinc-500 font-semibold uppercase tracking-wider border-b border-zinc-700 pb-1 mb-2";

function NumInput({ label, value, onChange, step = 1, unit, min }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; unit?: string; min?: number;
}) {
  return (
    <div>
      <label className={labelCls}>{label}{unit ? ` (${unit})` : ""}</label>
      <input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        step={step} min={min} className={inputCls} />
    </div>
  );
}

const MILL_OP_FACTORIES: Record<string, () => MillOperation> = {
  mill_face: makeMillFaceOp,
  mill_pocket_zigzag: makeMillPocketZigzagOp,
  mill_pocket_contour: makeMillPocketContourOp,
  mill_contour: makeMillContourOp,
  mill_slot: makeMillSlotOp,
  mill_chamfer: makeMillChamferOp,
  mill_deburr: makeMillDeburOp,
  mill_drill_spot: () => makeMillDrillOp("mill_drill_spot"),
  mill_drill_peck: () => makeMillDrillOp("mill_drill_peck"),
  mill_drill_tap: () => makeMillDrillOp("mill_drill_tap"),
  mill_drill_bore: () => makeMillDrillOp("mill_drill_bore"),
  mill_drill_bore_stop: () => makeMillDrillOp("mill_drill_bore_stop"),
  mill_imachining: makeMillIMachiningOp,
  mill_trochoidal: makeMillTrochoidalOp,
  mill_manual: makeMillManualOp,
};

const DEFAULT_MILL_OPS: MillOperation[] = [makeMillFaceOp(), makeMillPocketZigzagOp(), makeMillContourOp()];

function CuttingEditor({ c, onChange }: { c: MillCutting; onChange: (c: MillCutting) => void }) {
  const up = (k: keyof MillCutting, v: unknown) => onChange({ ...c, [k]: v });
  return (
    <div className="space-y-2">
      <div className={sectionCls}>Cutting Data</div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumInput label="Spindle RPM" value={c.spindleRpm} onChange={v => up("spindleRpm", v)} step={100} />
        <NumInput label="Feed XY" value={c.feedXY} onChange={v => up("feedXY", v)} step={50} unit="mm/min" />
        <NumInput label="Feed Z" value={c.feedZ} onChange={v => up("feedZ", v)} step={10} unit="mm/min" />
        <NumInput label="Stepdown" value={c.stepdown} onChange={v => up("stepdown", v)} step={0.5} unit="mm" />
        <NumInput label="Stepover %" value={c.stepover} onChange={v => up("stepover", v)} step={5} unit="%" />
        <NumInput label="Finish Allow." value={c.finishAllowance} onChange={v => up("finishAllowance", v)} step={0.02} unit="mm" />
        <div>
          <label className={labelCls}>Coolant</label>
          <select value={c.coolant} onChange={e => up("coolant", e.target.value as MillCutting["coolant"])} className={inputCls}>
            <option value="M08">M08 — Flood</option>
            <option value="M07">M07 — Mist</option>
            <option value="M09">M09 — OFF</option>
            <option value="air">Air blast</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ToolEditor({ t, onChange }: { t: MillTool; onChange: (t: MillTool) => void }) {
  const up = (k: keyof MillTool, v: unknown) => onChange({ ...t, [k]: v });
  return (
    <div className="space-y-2">
      <div className={sectionCls}>Tool Setup</div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className={labelCls}>Tool Number</label>
          <select value={t.number} onChange={e => up("number", parseInt(e.target.value))} className={inputCls}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>T{n < 10 ? "0" : ""}{n}</option>
            ))}
          </select>
        </div>
        <NumInput label="Diameter" value={t.diameter} onChange={v => up("diameter", v)} step={0.5} unit="mm" />
        <NumInput label="Flute Count" value={t.fluteCount} onChange={v => up("fluteCount", v)} step={1} min={1} />
        <NumInput label="Flute Length" value={t.fluteLength} onChange={v => up("fluteLength", v)} step={1} unit="mm" />
        <NumInput label="Total Length" value={t.totalLength} onChange={v => up("totalLength", v)} step={1} unit="mm" />
        <NumInput label="Corner Radius" value={t.cornerRadius} onChange={v => up("cornerRadius", v)} step={0.5} unit="mm" />
        <div>
          <label className={labelCls}>Tool Type</label>
          <select value={t.type} onChange={e => up("type", e.target.value)} className={inputCls}>
            <option value="flat">Flat End Mill</option>
            <option value="ball">Ball Nose</option>
            <option value="bull">Bull Nose</option>
            <option value="drill">Drill</option>
            <option value="tap">Tap</option>
            <option value="chamfer">Chamfer Mill</option>
            <option value="spot">Spot Drill</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Material</label>
          <select value={t.material} onChange={e => up("material", e.target.value as MillTool["material"])} className={inputCls}>
            <option value="carbide">Carbide</option>
            <option value="hss">HSS</option>
            <option value="cobalt">Cobalt</option>
            <option value="ceramic">Ceramic</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function MillOpParamsEditor({ op, onChange }: { op: MillOperation; onChange: (o: MillOperation) => void }) {
  const up = (k: string, v: unknown) => onChange({ ...op, [k]: v } as MillOperation);

  switch (op.type) {
    case "mill_face": {
      const o = op as MillFaceOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="X Min" value={o.xMin} onChange={v => up("xMin", v)} step={1} unit="mm" />
          <NumInput label="X Max" value={o.xMax} onChange={v => up("xMax", v)} step={1} unit="mm" />
          <NumInput label="Y Min" value={o.yMin} onChange={v => up("yMin", v)} step={1} unit="mm" />
          <NumInput label="Y Max" value={o.yMax} onChange={v => up("yMax", v)} step={1} unit="mm" />
          <NumInput label="Passes" value={o.passes} onChange={v => up("passes", v)} step={1} min={1} />
          <NumInput label="Overlap %" value={o.overlapPct} onChange={v => up("overlapPct", v)} step={5} unit="%" />
        </div>
      );
    }
    case "mill_pocket_zigzag": {
      const o = op as MillPocketZigzagOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="X Min" value={o.xMin} onChange={v => up("xMin", v)} step={1} unit="mm" />
            <NumInput label="X Max" value={o.xMax} onChange={v => up("xMax", v)} step={1} unit="mm" />
            <NumInput label="Y Min" value={o.yMin} onChange={v => up("yMin", v)} step={1} unit="mm" />
            <NumInput label="Y Max" value={o.yMax} onChange={v => up("yMax", v)} step={1} unit="mm" />
            <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
            <NumInput label="Corner R" value={o.cornerRadius} onChange={v => up("cornerRadius", v)} step={0.5} unit="mm" />
          </div>
          <div>
            <label className={labelCls}>Direction</label>
            <select value={o.direction} onChange={e => up("direction", e.target.value)} className={inputCls}>
              <option value="X">Along X (raster)</option>
              <option value="Y">Along Y (raster)</option>
            </select>
          </div>
        </div>
      );
    }
    case "mill_pocket_contour": {
      const o = op as MillPocketContourOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Center X" value={o.xCenter} onChange={v => up("xCenter", v)} step={1} unit="mm" />
          <NumInput label="Center Y" value={o.yCenter} onChange={v => up("yCenter", v)} step={1} unit="mm" />
          <NumInput label="Width" value={o.width} onChange={v => up("width", v)} step={1} unit="mm" />
          <NumInput label="Height" value={o.height} onChange={v => up("height", v)} step={1} unit="mm" />
          <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
          <NumInput label="Corner R" value={o.cornerRadius} onChange={v => up("cornerRadius", v)} step={0.5} unit="mm" />
        </div>
      );
    }
    case "mill_contour": {
      const o = op as MillContourOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
            <div>
              <label className={labelCls}>Compensation</label>
              <select value={o.compensation} onChange={e => up("compensation", e.target.value)} className={inputCls}>
                <option value="G41">G41 — Left</option>
                <option value="G42">G42 — Right</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={o.closed} onChange={e => up("closed", e.target.checked)} className="accent-green-500" />
            <label className="text-[11px] text-zinc-400">Closed contour</label>
          </div>
          <div>
            <label className={labelCls}>Points (X,Y per line)</label>
            <textarea
              value={o.points.map(p => `${p.x}, ${p.y}`).join("\n")}
              onChange={e => up("points", e.target.value.split("\n").map(l => {
                const [x, y] = l.split(",").map(s => parseFloat(s.trim()));
                return { x: x || 0, y: y || 0 };
              }).filter(p => !isNaN(p.x) && !isNaN(p.y)))}
              className={`${inputCls} h-20 resize-none font-mono`}
              placeholder="-30, -20&#10;30, -20&#10;30, 20&#10;-30, 20"
            />
          </div>
        </div>
      );
    }
    case "mill_slot": {
      const o = op as MillSlotOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="X Start" value={o.xStart} onChange={v => up("xStart", v)} step={1} unit="mm" />
          <NumInput label="Y Start" value={o.yStart} onChange={v => up("yStart", v)} step={1} unit="mm" />
          <NumInput label="X End" value={o.xEnd} onChange={v => up("xEnd", v)} step={1} unit="mm" />
          <NumInput label="Y End" value={o.yEnd} onChange={v => up("yEnd", v)} step={1} unit="mm" />
          <NumInput label="Width" value={o.width} onChange={v => up("width", v)} step={0.5} unit="mm" />
          <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
        </div>
      );
    }
    case "mill_chamfer": {
      const o = op as MillChamferOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="X Min" value={o.xMin} onChange={v => up("xMin", v)} step={1} unit="mm" />
          <NumInput label="X Max" value={o.xMax} onChange={v => up("xMax", v)} step={1} unit="mm" />
          <NumInput label="Y Min" value={o.yMin} onChange={v => up("yMin", v)} step={1} unit="mm" />
          <NumInput label="Y Max" value={o.yMax} onChange={v => up("yMax", v)} step={1} unit="mm" />
          <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.25} unit="mm" />
          <NumInput label="Chamfer Angle" value={o.chamferAngle} onChange={v => up("chamferAngle", v)} step={5} unit="°" />
        </div>
      );
    }
    case "mill_deburr": {
      const o = op as MillDeburOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.1} unit="mm" />
          </div>
          <div className={sectionCls}>Edge Points</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {o.points.map((pt, i) => (
              <div key={i} className="flex gap-1 items-center">
                <NumInput label={`X${i + 1}`} value={pt.x} onChange={v => { const pts = [...o.points]; pts[i] = { ...pts[i], x: v }; up("points", pts); }} step={1} unit="mm" />
                <NumInput label={`Y${i + 1}`} value={pt.y} onChange={v => { const pts = [...o.points]; pts[i] = { ...pts[i], y: v }; up("points", pts); }} step={1} unit="mm" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "mill_drill_spot": case "mill_drill_peck":
    case "mill_drill_tap": case "mill_drill_bore": case "mill_drill_bore_stop": {
      const o = op as MillDrillOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={1} unit="mm" />
            {(op.type === "mill_drill_peck") && (
              <NumInput label="Peck Depth (Q)" value={o.peckDepth} onChange={v => up("peckDepth", v)} step={1} unit="mm" />
            )}
            {(op.type === "mill_drill_tap") && (
              <NumInput label="Pitch" value={o.pitch} onChange={v => up("pitch", v)} step={0.25} unit="mm" />
            )}
            <NumInput label="Dwell (sec)" value={o.dwellSec} onChange={v => up("dwellSec", v)} step={0.1} />
          </div>
          <div>
            <label className={labelCls}>Hole Pattern</label>
            <select value={o.pattern} onChange={e => up("pattern", e.target.value)} className={inputCls}>
              <option value="custom">Custom (manual XY)</option>
              <option value="grid">Grid Pattern</option>
              <option value="bolt_circle">Bolt Circle</option>
            </select>
          </div>
          {o.pattern === "grid" && (
            <div className="grid grid-cols-2 gap-1.5">
              <NumInput label="Columns" value={o.gridCols} onChange={v => up("gridCols", v)} step={1} min={1} />
              <NumInput label="Rows" value={o.gridRows} onChange={v => up("gridRows", v)} step={1} min={1} />
              <NumInput label="Spacing X" value={o.gridSpacingX} onChange={v => up("gridSpacingX", v)} step={1} unit="mm" />
              <NumInput label="Spacing Y" value={o.gridSpacingY} onChange={v => up("gridSpacingY", v)} step={1} unit="mm" />
            </div>
          )}
          {o.pattern === "bolt_circle" && (
            <div className="grid grid-cols-2 gap-1.5">
              <NumInput label="Radius" value={o.boltCircleRadius} onChange={v => up("boltCircleRadius", v)} step={1} unit="mm" />
              <NumInput label="Count" value={o.boltCircleCount} onChange={v => up("boltCircleCount", v)} step={1} min={2} />
              <NumInput label="Start Angle" value={o.boltCircleStartAngle} onChange={v => up("boltCircleStartAngle", v)} step={15} unit="°" />
            </div>
          )}
          {o.pattern === "custom" && (
            <div>
              <label className={labelCls}>Holes (X,Y per line)</label>
              <textarea
                value={o.holes.map(h => `${h.x}, ${h.y}`).join("\n")}
                onChange={e => up("holes", e.target.value.split("\n").map(l => {
                  const [x, y] = l.split(",").map(s => parseFloat(s.trim()));
                  return { x: x || 0, y: y || 0 };
                }).filter(p => !isNaN(p.x) && !isNaN(p.y)))}
                className={`${inputCls} h-16 resize-none font-mono`}
                placeholder="0, 0&#10;20, 0&#10;20, 20"
              />
            </div>
          )}
        </div>
      );
    }
    case "mill_imachining": {
      const o = op as MillIMachiningOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="X Min" value={o.xMin} onChange={v => up("xMin", v)} step={1} unit="mm" />
            <NumInput label="X Max" value={o.xMax} onChange={v => up("xMax", v)} step={1} unit="mm" />
            <NumInput label="Y Min" value={o.yMin} onChange={v => up("yMin", v)} step={1} unit="mm" />
            <NumInput label="Y Max" value={o.yMax} onChange={v => up("yMax", v)} step={1} unit="mm" />
            <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={1} unit="mm" />
            <NumInput label="Corner R" value={o.cornerRadius} onChange={v => up("cornerRadius", v)} step={0.5} unit="mm" />
            <NumInput label="Max Eng. Angle" value={o.maxEngagementAngle} onChange={v => up("maxEngagementAngle", v)} step={5} unit="°" />
            <NumInput label="Min Stepover %" value={o.minStepover} onChange={v => up("minStepover", v)} step={5} unit="%" />
            <NumInput label="Max Stepover %" value={o.maxStepover} onChange={v => up("maxStepover", v)} step={5} unit="%" />
            <NumInput label="Feed Ramp Factor" value={o.feedRampFactor} onChange={v => up("feedRampFactor", v)} step={0.1} />
          </div>
          <div className="text-[9px] text-fuchsia-400/70 bg-fuchsia-500/10 rounded px-2 py-1.5 border border-fuchsia-500/20">
            iMachining: Adaptive roughing that maintains constant tool engagement angle. Variable stepover and feed ramping based on radial depth of cut. Up to 70% cycle time reduction.
          </div>
        </div>
      );
    }
    case "mill_trochoidal": {
      const o = op as MillTrochoidalOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="X Start" value={o.xStart} onChange={v => up("xStart", v)} step={1} unit="mm" />
            <NumInput label="Y Start" value={o.yStart} onChange={v => up("yStart", v)} step={1} unit="mm" />
            <NumInput label="X End" value={o.xEnd} onChange={v => up("xEnd", v)} step={1} unit="mm" />
            <NumInput label="Y End" value={o.yEnd} onChange={v => up("yEnd", v)} step={1} unit="mm" />
            <NumInput label="Slot Width" value={o.slotWidth} onChange={v => up("slotWidth", v)} step={0.5} unit="mm" />
            <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
            <NumInput label="Trochoidal Dia" value={o.trochoidalDiameter} onChange={v => up("trochoidalDiameter", v)} step={0.5} unit="mm" />
            <NumInput label="Trochoidal Step" value={o.trochoidalStepover} onChange={v => up("trochoidalStepover", v)} step={0.5} unit="mm" />
          </div>
          <div className="text-[9px] text-pink-400/70 bg-pink-500/10 rounded px-2 py-1.5 border border-pink-500/20">
            Trochoidal/HSM milling: circular arc movements along the toolpath. Ideal for hard materials (D2, Inconel, titanium). Reduces heat buildup and extends tool life 3-5x.
          </div>
        </div>
      );
    }
    case "mill_manual": {
      const o = op as MillManualOp;
      return (
        <div>
          <label className={labelCls}>G-code Block</label>
          <textarea value={o.gcode} onChange={e => up("gcode", e.target.value)}
            className={`${inputCls} h-28 resize-none font-mono`} />
        </div>
      );
    }
    default: return null;
  }
}

const TURN_OP_META: Record<TurnOpType, { label: string; color: string }> = {
  turn_rough: { label: "Turning Rough", color: "text-blue-400" },
  turn_finish: { label: "Turning Finish", color: "text-emerald-400" },
  turn_face: { label: "Facing", color: "text-amber-400" },
  turn_groove: { label: "Grooving", color: "text-purple-400" },
  turn_thread: { label: "Threading", color: "text-rose-400" },
};

export function MillingOperationsView() {
  const [mode, setMode] = useState<CamMode>("milling");
  const [ops, setOps] = useState<MillOperation[]>(DEFAULT_MILL_OPS);
  const [turnOps, setTurnOps] = useState<TurnOperation[]>([]);
  const [millTurnSeq, setMillTurnSeq] = useState<{ mode: "milling" | "turning"; opId: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string>(ops[0]?.id);
  const [controller, setController] = useState<MillController>("fanuc");
  const [stockX, setStockX] = useState(120);
  const [stockY, setStockY] = useState(80);
  const [stockZ, setStockZ] = useState(30);
  const [showGcode, setShowGcode] = useState(false);
  const [activeTab, setActiveTab] = useState<"params" | "tool" | "cutting" | "notes">("params");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const selectedOp = ops.find(o => o.id === selectedId);

  const updateOp = useCallback((id: string, updated: MillOperation) => {
    setOps(prev => prev.map(o => o.id === id ? updated : o));
  }, []);

  const addOp = useCallback((type: string) => {
    const factory = MILL_OP_FACTORIES[type];
    if (!factory) return;
    const newOp = factory();
    setOps(prev => [...prev, newOp]);
    setSelectedId(newOp.id);
    setAddMenuOpen(false);
  }, []);

  const addTurnOp = useCallback((type: TurnOpType) => {
    const newOp = makeTurnOperation(type);
    setTurnOps(prev => [...prev, newOp]);
    if (mode === "mill_turn") {
      setMillTurnSeq(prev => [...prev, { mode: "turning", opId: newOp.id }]);
    }
    setAddMenuOpen(false);
  }, [mode]);

  const addMillOpToSequence = useCallback((type: string) => {
    const factory = MILL_OP_FACTORIES[type];
    if (!factory) return;
    const newOp = factory();
    setOps(prev => [...prev, newOp]);
    setMillTurnSeq(prev => [...prev, { mode: "milling", opId: newOp.id }]);
    setSelectedId(newOp.id);
    setAddMenuOpen(false);
  }, []);

  const removeOp = useCallback((id: string) => {
    setOps(prev => {
      const next = prev.filter(o => o.id !== id);
      if (selectedId === id && next.length > 0) setSelectedId(next[0].id);
      return next;
    });
    setTurnOps(prev => prev.filter(o => o.id !== id));
    setMillTurnSeq(prev => prev.filter(mto => mto.opId !== id));
  }, [selectedId]);

  const moveOp = useCallback((id: string, dir: -1 | 1) => {
    setOps(prev => {
      const idx = prev.findIndex(o => o.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }, []);

  const moveMillTurnOp = useCallback((idx: number, dir: -1 | 1) => {
    setMillTurnSeq(prev => {
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }, []);

  const updateTurnOp = useCallback((id: string, updates: Partial<TurnOperation>) => {
    setTurnOps(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }, []);

  const resolvedMillTurnOps = useMemo((): MillTurnOp[] => {
    return millTurnSeq.map(entry => {
      if (entry.mode === "milling") {
        const op = ops.find(o => o.id === entry.opId);
        return op ? { mode: "milling" as const, op } : null;
      } else {
        const op = turnOps.find(o => o.id === entry.opId);
        return op ? { mode: "turning" as const, op } : null;
      }
    }).filter((x): x is MillTurnOp => x !== null);
  }, [millTurnSeq, ops, turnOps]);

  const gcode = useMemo(() => {
    if (mode === "mill_turn") {
      if (resolvedMillTurnOps.length === 0) return "";
      return generateMillTurnGcode(resolvedMillTurnOps, controller, stockX, stockY, stockZ);
    }

    const enabledOps = ops.filter(o => o.enabled);
    if (enabledOps.length === 0) return "";
    return generateMillGcode(enabledOps, controller, stockX, stockY, stockZ);
  }, [ops, turnOps, resolvedMillTurnOps, controller, stockX, stockY, stockZ, mode]);

  const activeToolpath = useMemo(() => {
    if (!selectedOp || !selectedOp.enabled) return [];
    return generateMillToolpath(selectedOp);
  }, [selectedOp]);

  const copyGcode = useCallback(() => {
    navigator.clipboard.writeText(gcode);
  }, [gcode]);

  const downloadGcode = useCallback(() => {
    const blob = new Blob([gcode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milling_program_${controller}.nc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [gcode, controller]);

  const opGroups = useMemo(() => {
    const groups: { label: string; types: MillOpType[] }[] = [
      { label: "Milling", types: ["mill_face", "mill_pocket_zigzag", "mill_pocket_contour", "mill_contour", "mill_slot", "mill_chamfer", "mill_deburr"] },
      { label: "Drilling", types: ["mill_drill_spot", "mill_drill_peck", "mill_drill_tap", "mill_drill_bore", "mill_drill_bore_stop"] },
      { label: "Advanced", types: ["mill_imachining", "mill_trochoidal"] },
      { label: "Other", types: ["mill_manual"] },
    ];
    return groups;
  }, []);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-200">
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700">
        <div className="flex gap-1 bg-zinc-800 rounded p-0.5">
          <button onClick={() => setMode("milling")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${mode === "milling" ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
            Milling
          </button>
          <button onClick={() => setMode("turning")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${mode === "turning" ? "bg-orange-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
            Turning
          </button>
          <button onClick={() => setMode("mill_turn")}
            className={`px-3 py-1 rounded text-xs font-medium transition ${mode === "mill_turn" ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
            Mill-Turn
          </button>
        </div>
        {mode === "turning" && (
          <span className="text-[10px] text-orange-400 ml-2">Use "CAM Operations" view for turning</span>
        )}
        {mode === "mill_turn" && (
          <span className="text-[10px] text-purple-400 ml-2">Combined turning + milling (G17/G18 switching)</span>
        )}
        <div className="flex-1" />
        <select value={controller} onChange={e => setController(e.target.value as MillController)}
          className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-300">
          {Object.entries(MILL_CONTROLLERS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {mode === "turning" ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          <div className="text-center">
            <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <div>Switch to the <span className="text-orange-400 font-semibold">CAM Operations</span> tab for turning ops</div>
            <div className="text-[10px] mt-1">Or use <span className="text-purple-400 font-semibold">Mill-Turn</span> mode to combine both</div>
          </div>
        </div>
      ) : mode === "mill_turn" ? (
        <div className="flex-1 flex min-h-0">
          <div className="w-72 border-r border-zinc-700 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Mill-Turn Sequence</span>
              <div className="relative">
                <button onClick={() => setAddMenuOpen(!addMenuOpen)}
                  className="p-1 rounded bg-purple-600 hover:bg-purple-500 text-white">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {addMenuOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                    <div className="px-3 py-1 text-[9px] text-zinc-500 font-semibold uppercase tracking-wider bg-zinc-900/50">Turning</div>
                    {(Object.keys(TURN_OP_META) as TurnOpType[]).map(type => (
                      <button key={type} onClick={() => addTurnOp(type)}
                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-700 text-left">
                        <span className={TURN_OP_META[type].color}><RotateCw className="w-3.5 h-3.5" /></span>
                        <div className="text-xs text-zinc-200">{TURN_OP_META[type].label}</div>
                      </button>
                    ))}
                    {opGroups.map(group => (
                      <div key={group.label}>
                        <div className="px-3 py-1 text-[9px] text-zinc-500 font-semibold uppercase tracking-wider bg-zinc-900/50">
                          {group.label}
                        </div>
                        {group.types.map(type => {
                          const meta = OP_META[type];
                          if (!meta) return null;
                          return (
                            <button key={type} onClick={() => addMillOpToSequence(type)}
                              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-700 text-left">
                              <span className={meta.color}>{meta.icon}</span>
                              <div className="text-xs text-zinc-200">{meta.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {millTurnSeq.map((entry, idx) => {
                const isTurn = entry.mode === "turning";
                const resolvedOp = isTurn
                  ? turnOps.find(o => o.id === entry.opId)
                  : ops.find(o => o.id === entry.opId);
                const label = resolvedOp?.name || "(removed)";
                const modeTag = isTurn ? "TURN" : "MILL";
                const tagColor = isTurn ? "bg-orange-700" : "bg-blue-700";
                return (
                  <div key={entry.opId + "_" + idx}
                    className="flex items-center gap-1.5 px-2 py-1.5 border-l-2 border-transparent hover:bg-zinc-800/50">
                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${tagColor} text-white`}>{modeTag}</span>
                    <span className="text-[11px] text-zinc-300 flex-1 truncate">{label}</span>
                    <button onClick={() => moveMillTurnOp(idx, -1)} className="p-0.5 hover:text-zinc-200 text-zinc-500"><ArrowUp className="w-3 h-3" /></button>
                    <button onClick={() => moveMillTurnOp(idx, 1)} className="p-0.5 hover:text-zinc-200 text-zinc-500"><ArrowDown className="w-3 h-3" /></button>
                    <button onClick={() => removeOp(entry.opId)} className="p-0.5 hover:text-red-400 text-zinc-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                );
              })}
              {millTurnSeq.length === 0 && (
                <div className="p-4 text-center text-zinc-500 text-xs">
                  Add turning & milling operations to build your mill-turn sequence
                </div>
              )}
            </div>
            {turnOps.length > 0 && (
              <div className="border-t border-zinc-700 p-2">
                <div className="text-[9px] text-zinc-500 mb-1">Turning Parameters</div>
                {turnOps.map(to => (
                  <div key={to.id} className="mb-2 bg-zinc-900 rounded p-2">
                    <div className="text-[10px] text-orange-400 font-medium mb-1">{to.name}</div>
                    <div className="grid grid-cols-2 gap-1">
                      <NumInput label="Start X (dia)" value={to.startX} onChange={v => updateTurnOp(to.id, { startX: v })} step={1} unit="mm" />
                      <NumInput label="End X (dia)" value={to.endX} onChange={v => updateTurnOp(to.id, { endX: v })} step={1} unit="mm" />
                      <NumInput label="Start Z" value={to.startZ} onChange={v => updateTurnOp(to.id, { startZ: v })} step={1} unit="mm" />
                      <NumInput label="End Z" value={to.endZ} onChange={v => updateTurnOp(to.id, { endZ: v })} step={1} unit="mm" />
                      <NumInput label="Feed" value={to.feedRate} onChange={v => updateTurnOp(to.id, { feedRate: v })} step={0.01} unit="mm/rev" />
                      <NumInput label="DoC" value={to.depthOfCut} onChange={v => updateTurnOp(to.id, { depthOfCut: v })} step={0.25} unit="mm" />
                      <NumInput label="RPM" value={to.spindleRpm} onChange={v => updateTurnOp(to.id, { spindleRpm: v })} step={50} />
                      <NumInput label="Vc (CSS)" value={to.cssVc} onChange={v => updateTurnOp(to.id, { cssVc: v })} step={10} unit="m/min" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col p-3 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => setShowGcode(!showGcode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300">
                <FileCode2 className="w-3.5 h-3.5" /> {showGcode ? "Hide G-code" : "Show G-code"}
              </button>
              {showGcode && (
                <>
                  <button onClick={copyGcode} className="flex items-center gap-1 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button onClick={downloadGcode} className="flex items-center gap-1 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-400">
                    <Download className="w-3 h-3" /> Download
                  </button>
                </>
              )}
              <span className="ml-auto text-[10px] text-zinc-500">{millTurnSeq.length} ops in sequence</span>
            </div>
            {showGcode ? (
              <textarea ref={textRef} readOnly value={gcode}
                className="flex-1 bg-zinc-950 text-green-400 font-mono text-[10px] p-3 rounded border border-zinc-700 resize-none" />
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <div className="text-sm">Mill-Turn Sequence Builder</div>
                  <div className="text-[10px] mt-1">Add turning & milling ops, reorder, then generate G-code</div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="w-64 border-r border-zinc-700 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Operations</span>
              <div className="relative">
                <button onClick={() => setAddMenuOpen(!addMenuOpen)}
                  className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {addMenuOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-zinc-800 border border-zinc-600 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto">
                    {opGroups.map(group => (
                      <div key={group.label}>
                        <div className="px-3 py-1 text-[9px] text-zinc-500 font-semibold uppercase tracking-wider bg-zinc-900/50">
                          {group.label}
                        </div>
                        {group.types.map(type => {
                          const meta = OP_META[type];
                          if (!meta) return null;
                          return (
                            <button key={type} onClick={() => addOp(type)}
                              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-700 text-left">
                              <span className={meta.color}>{meta.icon}</span>
                              <div>
                                <div className="text-xs text-zinc-200">{meta.label}</div>
                                <div className="text-[9px] text-zinc-500">{meta.desc}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {ops.map((op, idx) => {
                const meta = OP_META[op.type];
                const isSel = op.id === selectedId;
                return (
                  <div key={op.id}
                    className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer border-l-2 transition ${
                      isSel ? "bg-zinc-800 border-blue-500" : "border-transparent hover:bg-zinc-800/50"
                    } ${!op.enabled ? "opacity-40" : ""}`}
                    onClick={() => setSelectedId(op.id)}>
                    <span className={meta?.color || "text-zinc-400"}>{meta?.icon}</span>
                    <span className="flex-1 text-xs truncate">{op.name}</span>
                    <button onClick={e => { e.stopPropagation(); updateOp(op.id, { ...op, enabled: !op.enabled } as MillOperation); }}
                      className="p-0.5 rounded hover:bg-zinc-600">
                      {op.enabled ? <Eye className="w-3 h-3 text-zinc-400" /> : <EyeOff className="w-3 h-3 text-zinc-500" />}
                    </button>
                    <button onClick={e => { e.stopPropagation(); moveOp(op.id, -1); }}
                      className="p-0.5 rounded hover:bg-zinc-600" disabled={idx === 0}>
                      <ArrowUp className="w-3 h-3 text-zinc-500" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); moveOp(op.id, 1); }}
                      className="p-0.5 rounded hover:bg-zinc-600" disabled={idx === ops.length - 1}>
                      <ArrowDown className="w-3 h-3 text-zinc-500" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeOp(op.id); }}
                      className="p-0.5 rounded hover:bg-red-900/50">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-zinc-700 px-3 py-2 space-y-1.5 bg-zinc-900/50">
              <div className={sectionCls}>Stock</div>
              <div className="grid grid-cols-3 gap-1">
                <NumInput label="X" value={stockX} onChange={setStockX} step={5} unit="mm" />
                <NumInput label="Y" value={stockY} onChange={setStockY} step={5} unit="mm" />
                <NumInput label="Z" value={stockZ} onChange={setStockZ} step={5} unit="mm" />
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            {selectedOp ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900/50 border-b border-zinc-700">
                  <span className={OP_META[selectedOp.type]?.color}>{OP_META[selectedOp.type]?.icon}</span>
                  <input value={selectedOp.name}
                    onChange={e => updateOp(selectedOp.id, { ...selectedOp, name: e.target.value } as MillOperation)}
                    className="bg-transparent text-sm font-semibold text-zinc-200 border-none outline-none flex-1" />
                  <div className="flex gap-1">
                    {(["params", "tool", "cutting", "notes"] as const).map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          activeTab === tab ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                        }`}>
                        {tab === "params" ? "Parameters" : tab === "tool" ? "Tool" : tab === "cutting" ? "Cutting" : "Notes"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-1 min-h-0">
                  <div className="w-80 overflow-y-auto p-3 border-r border-zinc-700">
                    {activeTab === "params" && <MillOpParamsEditor op={selectedOp} onChange={o => updateOp(selectedOp.id, o)} />}
                    {activeTab === "tool" && <ToolEditor t={selectedOp.tool} onChange={t => updateOp(selectedOp.id, { ...selectedOp, tool: t } as MillOperation)} />}
                    {activeTab === "cutting" && <CuttingEditor c={selectedOp.cutting} onChange={c => updateOp(selectedOp.id, { ...selectedOp, cutting: c } as MillOperation)} />}
                    {activeTab === "notes" && (
                      <div>
                        <label className={labelCls}>Notes</label>
                        <textarea value={selectedOp.notes}
                          onChange={e => updateOp(selectedOp.id, { ...selectedOp, notes: e.target.value } as MillOperation)}
                          className={`${inputCls} h-32 resize-none`} />
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button onClick={() => setShowGcode(!showGcode)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 text-xs font-medium">
                        <Play className="w-3.5 h-3.5" />
                        {showGcode ? "Hide G-code" : "Generate G-code"}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-w-0">
                    {showGcode ? (
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-700">
                          <span className="text-[10px] text-zinc-400 font-semibold">G-CODE OUTPUT</span>
                          <div className="flex-1" />
                          <button onClick={copyGcode} className="p-1 rounded hover:bg-zinc-700 text-zinc-400" title="Copy">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={downloadGcode} className="p-1 rounded hover:bg-zinc-700 text-zinc-400" title="Download .NC">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[9px] text-zinc-500">{gcode.split("\n").length} lines</span>
                        </div>
                        <textarea ref={textRef} readOnly value={gcode}
                          className="flex-1 bg-zinc-950 text-green-400 font-mono text-xs p-3 resize-none border-none outline-none" />
                      </div>
                    ) : (
                      <MillingToolpathPreview toolpath={activeToolpath} toolDiameter={selectedOp.tool.diameter} />
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                <div className="text-center">
                  <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <div>Select an operation or add a new one</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
