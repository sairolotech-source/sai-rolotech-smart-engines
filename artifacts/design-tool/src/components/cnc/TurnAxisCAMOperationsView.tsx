import React, { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Play, Settings,
  RotateCw, AlertTriangle, Check, Copy, ArrowUp, ArrowDown,
  Eye, EyeOff, Zap, Layers, Circle, Hash, Scissors, Drill,
  GitBranch, ChevronsRight, RotateCcw, FileCode2, Download,
  RefreshCw, Shield, Target, Wrench, Box, Move, Monitor, Database,
} from "lucide-react";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";
import { useCncStore } from "../../store/useCncStore";
const LatheSimulator3D = lazy(() => import("./LatheSimulator3D").then(m => ({ default: m.LatheSimulator3D })));
const MillingSimulator3D = lazy(() => import("./MillingSimulator3D").then(m => ({ default: m.MillingSimulator3D })));

interface LibToolEntry {
  id: string;
  name: string;
  category: string;
  subType: string;
  isoDesignation?: string;
  noseRadius?: number;
  holderCode?: string;
  gradeCode?: string;
  coatingType?: string;
  diameter?: number;
}

type Controller = "fanuc" | "haas" | "siemens" | "delta2x" | "mazak" | "mitsubishi";
type SpindleMode = "css" | "rpm";
type OperationType =
  | "face" | "od_rough" | "od_finish" | "id_rough" | "id_finish"
  | "groove_od" | "groove_id" | "groove_angled" | "thread_ext" | "thread_int"
  | "thread_whirl" | "drill_center" | "drill_peck" | "drill_multi" | "bore_finish"
  | "cutoff" | "chamfer" | "trochoidal" | "balanced" | "manual" | "reaming" | "tapping"
  | "hdt_freeturn" | "sim_4axis" | "drive_share";

interface CuttingData {
  vc: number; f: number; fFinish: number; doc: number; docFinish: number;
  coolant: "M08" | "M07" | "M09"; spindleMode: SpindleMode;
  maxRpm: number; minRpm: number; cssLimit: number;
}

interface ToolRef {
  position: number; insert: string; holder: string; noseRadius: number;
  cuttingDir: "L" | "R" | "N"; compensation: "G41" | "G42" | "off";
}

interface BaseOp {
  id: string; type: OperationType; name: string; enabled: boolean;
  tool: ToolRef; cutting: CuttingData; notes: string;
}

interface FaceOp extends BaseOp { type: "face"; passes: number; allowanceX: number; allowanceZ: number; }
interface ODRoughOp extends BaseOp { type: "od_rough"; startZ: number; endZ: number; startX: number; endX: number; doc: number; axialDoc: number; allowance: number; g71p: number; g71q: number; }
interface ODFinishOp extends BaseOp { type: "od_finish"; startN: number; endN: number; allowance: number; chamfer: number; }
interface GrooveOp extends BaseOp { type: "groove_od" | "groove_id"; zCenter: number; depth: number; width: number; cornerR: number; stepover: number; pecking: boolean; }
interface ThreadOp extends BaseOp { type: "thread_ext" | "thread_int"; pitch: number; startZ: number; endZ: number; startX: number; depth: number; passes: number; springPasses: number; pullout: boolean; g76Format: "fanuc2" | "haas1"; }
interface DrillOp extends BaseOp { type: "drill_center" | "drill_peck" | "reaming" | "tapping"; diameter: number; depth: number; peckDepth: number; retract: number; dwellSec: number; }
interface BoreOp extends BaseOp { type: "bore_finish" | "id_rough" | "id_finish"; startZ: number; endZ: number; boreDia: number; allowance: number; }
interface CutoffOp extends BaseOp { type: "cutoff"; zPos: number; xStart: number; xFinish: number; bladeWidth: number; }
interface TrochoidalOp extends BaseOp { type: "trochoidal"; zCenter: number; depth: number; width: number; stepAngle: number; }
interface BalancedOp extends BaseOp { type: "balanced"; syncMode: "M3" | "M4" | "sync"; }
interface ManualOp extends BaseOp { type: "manual"; gcode: string; }
interface AngledGrooveOp extends BaseOp { type: "groove_angled"; zCenter: number; depth: number; width: number; angle: number; cornerR: number; }
interface HDTFreeTurnOp extends BaseOp { type: "hdt_freeturn"; startZ: number; endZ: number; startX: number; endX: number; strategy: "rough" | "finish" | "contour" | "face_long"; insertAngle: number; approachAngle: number; }
interface Sim4AxisOp extends BaseOp { type: "sim_4axis"; startZ: number; endZ: number; startX: number; endX: number; bAxisStart: number; bAxisEnd: number; undercut: boolean; }
interface DriveShareOp extends BaseOp { type: "drive_share"; tool2Position: number; syncRpm: number; syncDir: "M3" | "M4"; }
interface ThreadWhirlOp extends BaseOp { type: "thread_whirl"; pitch: number; pitchEnd: number; variablePitch: boolean; startZ: number; endZ: number; nominalDia: number; depth: number; whirlRpm: number; inserts: number; }
interface MultiDepthDrillOp extends BaseOp { type: "drill_multi"; diameter: number; depths: number[]; peckPerDepth: number; retract: number; dwellSec: number; crossHole: boolean; }
interface ChamferOp extends BaseOp { type: "chamfer"; zPos: number; xStart: number; xEnd: number; angle: number; chamferSize: number; }

type Operation = FaceOp | ODRoughOp | ODFinishOp | GrooveOp | ThreadOp | DrillOp | BoreOp | CutoffOp | TrochoidalOp | BalancedOp | ManualOp | AngledGrooveOp | HDTFreeTurnOp | Sim4AxisOp | DriveShareOp | ThreadWhirlOp | MultiDepthDrillOp | ChamferOp;

const OP_META: Record<OperationType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  face:        { label: "Face",             icon: <Layers className="w-3.5 h-3.5" />,      color: "text-blue-400",   desc: "Face the part end (G72 / facing passes)" },
  od_rough:    { label: "OD Rough (G71)",   icon: <Box className="w-3.5 h-3.5" />,         color: "text-orange-400", desc: "Outer diameter stock removal roughing cycle" },
  od_finish:   { label: "OD Finish (G70)",  icon: <Target className="w-3.5 h-3.5" />,      color: "text-green-400",  desc: "Outer diameter finish pass from roughing geometry" },
  id_rough:    { label: "ID Rough",         icon: <Circle className="w-3.5 h-3.5" />,      color: "text-orange-400", desc: "Inner diameter bore roughing" },
  id_finish:   { label: "ID Finish",        icon: <Circle className="w-3.5 h-3.5" />,      color: "text-green-400",  desc: "Inner diameter bore finishing" },
  groove_od:   { label: "OD Groove (G75)",  icon: <Scissors className="w-3.5 h-3.5" />,    color: "text-yellow-400", desc: "Outer diameter groove cutting" },
  groove_id:   { label: "ID Groove",        icon: <Scissors className="w-3.5 h-3.5" />,    color: "text-yellow-400", desc: "Inner diameter groove cutting" },
  thread_ext:  { label: "Thread Ext (G76)", icon: <Hash className="w-3.5 h-3.5" />,        color: "text-purple-400", desc: "External thread cutting cycle G76" },
  thread_int:  { label: "Thread Int",       icon: <Hash className="w-3.5 h-3.5" />,        color: "text-purple-400", desc: "Internal thread cutting" },
  thread_whirl:{ label: "Thread Whirling",  icon: <RotateCcw className="w-3.5 h-3.5" />,   color: "text-fuchsia-400",desc: "High-speed thread whirling with variable pitch (SP2)" },
  drill_center:{ label: "Center Drill",     icon: <Drill className="w-3.5 h-3.5" />,       color: "text-cyan-400",   desc: "Center drill / spotting" },
  drill_peck:  { label: "Peck Drill (G83)", icon: <Drill className="w-3.5 h-3.5" />,       color: "text-cyan-400",   desc: "Deep hole peck drilling" },
  drill_multi: { label: "Multi-Depth Drill",icon: <Drill className="w-3.5 h-3.5" />,       color: "text-cyan-300",   desc: "Enhanced multi-depth drilling — full control at each depth (SP2)" },
  bore_finish: { label: "Bore Finish",      icon: <Circle className="w-3.5 h-3.5" />,      color: "text-green-400",  desc: "Fine bore finishing to exact diameter" },
  cutoff:      { label: "Cutoff / Parting", icon: <Scissors className="w-3.5 h-3.5" />,    color: "text-red-400",    desc: "Part separation / cutoff operation" },
  chamfer:     { label: "Chamfer (Adv)",    icon: <Target className="w-3.5 h-3.5" />,      color: "text-rose-400",   desc: "Advanced chamfer operation — profile/pocket geometry (SP2)" },
  groove_angled:{ label: "Angled Groove",    icon: <Scissors className="w-3.5 h-3.5" />,    color: "text-yellow-300", desc: "Inclined internal/external groove at defined angle" },
  trochoidal:  { label: "Trochoidal Turn",  icon: <RotateCw className="w-3.5 h-3.5" />,    color: "text-pink-400",   desc: "Trochoidal toolpath for hard grooving — constant chip load" },
  balanced:    { label: "Balanced Turn",    icon: <GitBranch className="w-3.5 h-3.5" />,   color: "text-amber-400",  desc: "Simultaneous 2-turret balanced roughing for long parts" },
  hdt_freeturn:{ label: "HDT/FreeTurn",     icon: <Zap className="w-3.5 h-3.5" />,         color: "text-emerald-400",desc: "Ceratizit HDT & FreeTurn — all turning ops with 1 tool, 25% faster" },
  sim_4axis:   { label: "4th Axis Sim",     icon: <Move className="w-3.5 h-3.5" />,        color: "text-sky-400",    desc: "B-axis tilting to machine undercuts in single setup" },
  drive_share: { label: "Drive Sharing",    icon: <ChevronsRight className="w-3.5 h-3.5" />,color: "text-lime-400",  desc: "2 tools on single drive unit, same RPM & direction" },
  manual:      { label: "Manual G-code",    icon: <FileCode2 className="w-3.5 h-3.5" />,   color: "text-zinc-400",   desc: "Custom manual G-code block insertion" },
  reaming:     { label: "Reaming",          icon: <Drill className="w-3.5 h-3.5" />,       color: "text-teal-400",   desc: "Reaming to precise hole size" },
  tapping:     { label: "Tapping (G84)",    icon: <Hash className="w-3.5 h-3.5" />,        color: "text-violet-400", desc: "Tapping / threading holes G84" },
};

const CONTROLLERS: Record<Controller, string> = {
  fanuc: "Fanuc 0i/21i",  haas: "Haas SL Series",
  siemens: "Siemens 840D", delta2x: "Delta 2X",
  mazak: "Mazak Mazatrol", mitsubishi: "Mitsubishi M70",
};

function defaultCutting(): CuttingData {
  return { vc: 150, f: 0.25, fFinish: 0.08, doc: 2.5, docFinish: 0.3, coolant: "M08", spindleMode: "css", maxRpm: 3000, minRpm: 50, cssLimit: 3000 };
}
function defaultTool(pos = 1): ToolRef {
  return { position: pos, insert: "CNMG 120408", holder: "PCLNL 2525M", noseRadius: 0.8, cuttingDir: "L", compensation: "G42" };
}

function makeFaceOp(): FaceOp {
  return { id: uid(), type: "face", name: "OP10 Face", enabled: true, tool: defaultTool(1), cutting: defaultCutting(), notes: "", passes: 3, allowanceX: 0.3, allowanceZ: 0.1 };
}
function makeODRoughOp(): ODRoughOp {
  return { id: uid(), type: "od_rough", name: "OP20 OD Rough G71", enabled: true, tool: defaultTool(1), cutting: defaultCutting(), notes: "", startZ: -5, endZ: -130, startX: 95, endX: 78, doc: 2.5, axialDoc: 3, allowance: 0.3, g71p: 100, g71q: 200 };
}
function makeODFinishOp(): ODFinishOp {
  return { id: uid(), type: "od_finish", name: "OP30 OD Finish G70", enabled: true, tool: { ...defaultTool(2), insert: "VNMG 160408", noseRadius: 0.4 }, cutting: { ...defaultCutting(), f: 0.08, vc: 180 }, notes: "", startN: 100, endN: 200, allowance: 0, chamfer: 1 };
}
function makeGrooveOp(): GrooveOp {
  return { id: uid(), type: "groove_od", name: "OP40 OD Groove G75", enabled: true, tool: { ...defaultTool(3), insert: "MGMN 300-G", noseRadius: 0 }, cutting: { ...defaultCutting(), f: 0.05, vc: 80 }, notes: "", zCenter: -65, depth: 10, width: 12, cornerR: 1.5, stepover: 2, pecking: true };
}
function makeThreadOp(): ThreadOp {
  return { id: uid(), type: "thread_ext", name: "OP50 Thread G76", enabled: true, tool: { ...defaultTool(4), insert: "16ER 2.0 ISO", noseRadius: 0 }, cutting: { ...defaultCutting(), f: 2.0, vc: 80, spindleMode: "rpm" }, notes: "", pitch: 2.0, startZ: -5, endZ: -50, startX: 45, depth: 1.23, passes: 6, springPasses: 2, pullout: true, g76Format: "fanuc2" };
}
function makeDrillOp(): DrillOp {
  return { id: uid(), type: "drill_peck", name: "OP60 Peck Drill G83", enabled: true, tool: { ...defaultTool(5), insert: "Ø25 HSS-Co Drill", noseRadius: 0 }, cutting: { ...defaultCutting(), f: 0.12, vc: 60 }, notes: "", diameter: 25, depth: 140, peckDepth: 10, retract: 1, dwellSec: 0 };
}
function makeBoreOp(): BoreOp {
  return { id: uid(), type: "bore_finish", name: "OP70 Bore Finish", enabled: true, tool: { ...defaultTool(6), insert: "CCMT 060204", noseRadius: 0.4, cuttingDir: "R", compensation: "G41" }, cutting: { ...defaultCutting(), f: 0.06, vc: 120 }, notes: "", startZ: 0, endZ: -135, boreDia: 40, allowance: 0 };
}
function makeCutoffOp(): CutoffOp {
  return { id: uid(), type: "cutoff", name: "OP80 Cutoff", enabled: true, tool: { ...defaultTool(7), insert: "MGMN 400 Cutoff", noseRadius: 0 }, cutting: { ...defaultCutting(), f: 0.03, vc: 60 }, notes: "", zPos: -132, xStart: 50, xFinish: 3, bladeWidth: 4 };
}
function makeTrochoidalOp(): TrochoidalOp {
  return { id: uid(), type: "trochoidal", name: "OP41 Trochoidal Groove", enabled: true, tool: { ...defaultTool(3), insert: "MGMN 300-G" }, cutting: { ...defaultCutting(), f: 0.06, vc: 90 }, notes: "", zCenter: -65, depth: 10, width: 12, stepAngle: 15 };
}
function makeManualOp(): ManualOp {
  return { id: uid(), type: "manual", name: "Manual Block", enabled: true, tool: defaultTool(1), cutting: defaultCutting(), notes: "", gcode: "G04 X2.0 (Dwell 2 sec)\nM01 (Optional stop)" };
}
function makeTapOp(): DrillOp {
  return { id: uid(), type: "tapping", name: "OP61 Tapping G84", enabled: true, tool: { ...defaultTool(8), insert: "M8×1.25 Tap" }, cutting: { ...defaultCutting(), f: 1.25, vc: 20 }, notes: "", diameter: 8, depth: 25, peckDepth: 25, retract: 2, dwellSec: 0 };
}
function makeAngledGrooveOp(): AngledGrooveOp {
  return { id: uid(), type: "groove_angled", name: "OP42 Angled Groove", enabled: true, tool: { ...defaultTool(3), insert: "MGMN 300-G" }, cutting: { ...defaultCutting(), f: 0.04, vc: 70 }, notes: "", zCenter: -60, depth: 8, width: 10, angle: 30, cornerR: 1.0 };
}
function makeHDTFreeTurnOp(): HDTFreeTurnOp {
  return { id: uid(), type: "hdt_freeturn", name: "OP90 HDT/FreeTurn", enabled: true, tool: { ...defaultTool(9), insert: "FreeTurn FT XNMU", holder: "Ceratizit HDT Holder", noseRadius: 0.4 }, cutting: { ...defaultCutting(), vc: 200, f: 0.20 }, notes: "Ceratizit FreeTurn — all-directional single tool turning", startZ: -5, endZ: -120, startX: 95, endX: 60, strategy: "rough", insertAngle: 0, approachAngle: 93 };
}
function makeSim4AxisOp(): Sim4AxisOp {
  return { id: uid(), type: "sim_4axis", name: "OP91 4th Axis Undercut", enabled: true, tool: { ...defaultTool(10), insert: "VNMG 160408", holder: "B-axis holder" }, cutting: { ...defaultCutting(), vc: 120, f: 0.10 }, notes: "B-axis tilting for undercut machining", startZ: -20, endZ: -80, startX: 80, endX: 50, bAxisStart: 0, bAxisEnd: 45, undercut: true };
}
function makeDriveShareOp(): DriveShareOp {
  return { id: uid(), type: "drive_share", name: "OP92 Drive Share Rough", enabled: true, tool: defaultTool(1), cutting: defaultCutting(), notes: "Two tools sharing single drive unit", tool2Position: 2, syncRpm: 1500, syncDir: "M3" };
}
function makeThreadWhirlOp(): ThreadWhirlOp {
  return { id: uid(), type: "thread_whirl", name: "OP93 Thread Whirling", enabled: true, tool: { ...defaultTool(11), insert: "Whirl Ring 6-insert", holder: "Thread Whirling Unit" }, cutting: { ...defaultCutting(), vc: 180, f: 0, spindleMode: "rpm" }, notes: "High-speed thread whirling — typically on Swiss-type machines. Variable pitch supported (SP2)", pitch: 2.0, pitchEnd: 2.0, variablePitch: false, startZ: -5, endZ: -60, nominalDia: 12, depth: 1.3, whirlRpm: 8000, inserts: 6 };
}
function makeMultiDepthDrillOp(): MultiDepthDrillOp {
  return { id: uid(), type: "drill_multi", name: "OP62 Multi-Depth Drill", enabled: true, tool: { ...defaultTool(5), insert: "Ø20 Carbide Drill" }, cutting: { ...defaultCutting(), f: 0.15, vc: 80 }, notes: "Enhanced multi-depth drilling with control at each depth stage (SP2)", diameter: 20, depths: [15, 30, 50, 75], peckPerDepth: 5, retract: 1, dwellSec: 0.5, crossHole: false };
}
function makeChamferOp(): ChamferOp {
  return { id: uid(), type: "chamfer", name: "OP35 Chamfer", enabled: true, tool: { ...defaultTool(12), insert: "35° Chamfer Insert", noseRadius: 0.2 }, cutting: { ...defaultCutting(), f: 0.06, vc: 100 }, notes: "Advanced chamfer — uses same geometry as profile/pocket operations (SP2)", zPos: -5, xStart: 50, xEnd: 48, angle: 45, chamferSize: 1.0 };
}

let _uidCounter = 0;
function uid() { return `op_${Date.now()}_${_uidCounter++}`; }

function generateGcode(ops: Operation[], controller: Controller, stockDia: number, stockLen: number): string {
  const lines: string[] = [];
  const isFanuc = controller === "fanuc" || controller === "delta2x";
  const isHaas = controller === "haas";
  const isSiemens = controller === "siemens";

  lines.push(`%`);
  lines.push(`(${CONTROLLERS[controller]} — Sai Rolotech Smart Engines CAM)`);
  lines.push(`(Stock: Ø${stockDia} × ${stockLen} mm)`);
  lines.push(`(Generated: ${new Date().toISOString()})`);
  lines.push(``);
  lines.push(isSiemens ? `WORKPIECE(,,"",CYLINDER,0,${-stockLen},0,${stockDia/2})` : `G21 G18 G40 G80 G99`);
  lines.push(isSiemens ? `G90 G95` : `G50 S${ops[0]?.cutting?.maxRpm ?? 3000}`);
  lines.push(``);

  const enabledOps = ops.filter(o => o.enabled);

  for (const op of enabledOps) {
    lines.push(`(--- ${op.name.toUpperCase()} ---)`);
    const c = op.cutting;
    const t = op.tool;

    if (isSiemens) {
      lines.push(`T${t.position} D1`);
    } else {
      lines.push(`T0${t.position}0${t.position}`);
    }

    if (c.spindleMode === "css") {
      lines.push(isSiemens
        ? `G96 S${c.vc} LIMS=${c.maxRpm}`
        : `G96 S${c.vc} G50 S${c.maxRpm}`);
    } else {
      lines.push(`G97 S${c.maxRpm}`);
    }

    if (op.type !== "drive_share") {
      lines.push(`M03`);
    }
    lines.push(c.coolant);

    if (op.type === "face") {
      const fo = op as FaceOp;
      const step = 1.5;
      for (let pass = 0; pass < fo.passes; pass++) {
        const z = -pass * step;
        lines.push(`G00 X${(stockDia / 2 + 5).toFixed(3)} Z${z.toFixed(3)}`);
        lines.push(`G01 X-1.600 F${c.f.toFixed(4)}`);
        lines.push(`G00 X${(stockDia / 2 + 5).toFixed(3)}`);
      }
    }

    if (op.type === "od_rough") {
      const ro = op as ODRoughOp;
      if (isFanuc || isHaas) {
        lines.push(`G00 X${(ro.startX + 5).toFixed(3)} Z${(ro.startZ + 2).toFixed(3)}`);
        lines.push(`G71 U${ro.doc.toFixed(1)} R0.500`);
        lines.push(`G71 P${ro.g71p} Q${ro.g71q} U${ro.allowance.toFixed(3)} W0.100 F${c.f.toFixed(4)}`);
        lines.push(`N${ro.g71p} G00 X${ro.endX.toFixed(3)}`);
        lines.push(`G01 Z${ro.endZ.toFixed(3)} F${c.f.toFixed(4)}`);
        lines.push(`N${ro.g71q} X${(ro.startX + 2).toFixed(3)}`);
      } else if (isSiemens) {
        lines.push(`CYCLE952(${ro.startX.toFixed(3)},${ro.endX.toFixed(3)},${ro.startZ.toFixed(3)},${ro.endZ.toFixed(3)},${ro.doc.toFixed(1)},${ro.allowance.toFixed(3)},${c.f.toFixed(4)},${c.f.toFixed(4)},12,0,0,0,0,0,0,1,0)`);
      }
    }

    if (op.type === "od_finish") {
      const fo = op as ODFinishOp;
      if (isFanuc || isHaas) {
        lines.push(`G70 P${fo.startN} Q${fo.endN} F${c.fFinish.toFixed(4)}`);
      } else if (isSiemens) {
        lines.push(`CYCLE952(,,,,0,0,${c.fFinish.toFixed(4)},${c.fFinish.toFixed(4)},13,0,0,0,0,0,0,1,0)`);
      }
    }

    if (op.type === "groove_od" || op.type === "groove_id") {
      const go = op as GrooveOp;
      const baseX = go.type === "groove_od" ? (stockDia / 2 - 0.5) : (go.depth + 20);
      if (isFanuc || isHaas) {
        lines.push(`G00 X${(baseX + 3).toFixed(3)} Z${go.zCenter.toFixed(3)}`);
        lines.push(`G75 R0.500`);
        lines.push(`G75 X${(baseX - go.depth).toFixed(3)} Z${(go.zCenter - go.width / 2).toFixed(3)} P${Math.round(go.stepover * 1000)} Q${Math.round(go.width * 1000 / 2)} R0.000 F${c.f.toFixed(4)}`);
        if (go.pecking) {
          lines.push(`(Pecking enabled — Q parameter active)`);
        }
      } else if (isSiemens) {
        lines.push(`CYCLE930(${go.zCenter.toFixed(3)},${(go.zCenter - go.width / 2).toFixed(3)},${baseX.toFixed(3)},${(baseX - go.depth).toFixed(3)},${go.cornerR.toFixed(2)},${go.cornerR.toFixed(2)},0,${c.f.toFixed(4)},${c.f.toFixed(4)},0,0)`);
      }
    }

    if (op.type === "thread_ext" || op.type === "thread_int") {
      const th = op as ThreadOp;
      if (th.g76Format === "fanuc2") {
        lines.push(`G00 X${(th.startX + 5).toFixed(3)} Z${(th.startZ + 3).toFixed(3)}`);
        lines.push(`G76 P0${th.springPasses}1060 Q100 R0.050`);
        lines.push(`G76 X${(th.startX - th.depth * 2).toFixed(3)} Z${th.endZ.toFixed(3)} P${Math.round(th.depth * 1000)} Q${Math.round(th.depth * 1000 / th.passes)} F${th.pitch.toFixed(4)}`);
        if (th.pullout) lines.push(`(G76 pullout enabled)`);
      } else {
        lines.push(`G76 X${(th.startX - th.depth * 2).toFixed(3)} Z${th.endZ.toFixed(3)} K${th.depth.toFixed(3)} D${(th.depth / th.passes).toFixed(3)} F${th.pitch.toFixed(4)} A60`);
      }
    }

    if (op.type === "drill_peck" || op.type === "drill_center") {
      const dr = op as DrillOp;
      lines.push(`G00 X0.000 Z5.000`);
      if (op.type === "drill_peck") {
        lines.push(isSiemens
          ? `CYCLE83(5,0,2,${-dr.depth},0,0,${dr.peckDepth},${dr.peckDepth},0,0,0.5,0,1,${c.f.toFixed(4)},0,1)`
          : `G83 Z${-dr.depth} R2.000 Q${Math.round(dr.peckDepth * 1000)} F${c.f.toFixed(4)}`);
      } else {
        lines.push(`G81 Z-5.000 R2.000 F${c.f.toFixed(4)} (Center drill)`);
      }
      if (dr.dwellSec > 0) lines.push(`G04 X${dr.dwellSec.toFixed(1)}`);
      lines.push(isSiemens ? `G80` : `G80`);
    }

    if (op.type === "tapping") {
      const tr = op as DrillOp;
      lines.push(`G00 X0.000 Z5.000`);
      lines.push(isSiemens
        ? `CYCLE84(5,0,2,${-tr.depth},0,0,${c.f},${c.f},${c.maxRpm},${c.maxRpm},0,1)`
        : `G84 Z${-tr.depth} R2.000 F${c.f.toFixed(4)}`);
      lines.push(`G80`);
    }

    if (op.type === "bore_finish" || op.type === "id_rough" || op.type === "id_finish") {
      const bo = op as BoreOp;
      lines.push(`G00 X${(bo.boreDia - 5).toFixed(3)} Z5.000`);
      lines.push(`G01 X${bo.boreDia.toFixed(3)} Z2.000 F${c.f.toFixed(4)}`);
      lines.push(`G01 Z${bo.endZ.toFixed(3)} F${c.f.toFixed(4)}`);
      lines.push(`G04 X0.200`);
      lines.push(`G01 Z5.000 F${(c.f * 1.5).toFixed(4)}`);
    }

    if (op.type === "cutoff") {
      const co = op as CutoffOp;
      lines.push(`G00 X${(co.xStart + 3).toFixed(3)} Z${co.zPos.toFixed(3)}`);
      lines.push(`G01 X${co.xFinish.toFixed(3)} F${c.f.toFixed(4)}`);
      if (co.xFinish <= 0) lines.push(`(Part separation)`);
    }

    if (op.type === "trochoidal") {
      const tr = op as TrochoidalOp;
      const baseX = stockDia / 2;
      lines.push(`(Trochoidal path — ${tr.stepAngle}° step angle, constant chip load)`);
      const steps = Math.ceil(360 / tr.stepAngle);
      lines.push(`G00 X${(baseX + 2).toFixed(3)} Z${tr.zCenter.toFixed(3)}`);
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * 2 * Math.PI;
        const xOff = Math.cos(angle) * tr.width * 0.4;
        const zOff = Math.sin(angle) * tr.width * 0.4;
        lines.push(`G01 X${(baseX - tr.depth * 0.5 + xOff).toFixed(3)} Z${(tr.zCenter + zOff).toFixed(3)} F${c.f.toFixed(4)}`);
      }
    }

    if (op.type === "groove_angled") {
      const ag = op as AngledGrooveOp;
      const baseX = stockDia / 2;
      const radAngle = ag.angle * Math.PI / 180;
      lines.push(`(Angled groove — ${ag.angle}° incline)`);
      lines.push(`G00 X${(baseX + 3).toFixed(3)} Z${ag.zCenter.toFixed(3)}`);
      const zTravel = Math.sin(radAngle) * ag.depth;
      const xTravel = Math.cos(radAngle) * ag.depth;
      lines.push(`G01 X${(baseX - xTravel).toFixed(3)} Z${(ag.zCenter - zTravel).toFixed(3)} F${c.f.toFixed(4)}`);
      if (ag.cornerR > 0) lines.push(`(Corner R${ag.cornerR.toFixed(1)} applied)`);
      lines.push(`G01 X${(baseX + 1).toFixed(3)} F${(c.f * 1.5).toFixed(4)}`);
    }

    if (op.type === "hdt_freeturn") {
      const hdt = op as HDTFreeTurnOp;
      const pN = 500 + Math.floor(Math.random() * 100);
      const qN = pN + 100;
      lines.push(`(Ceratizit HDT/FreeTurn — ${hdt.strategy} strategy)`);
      lines.push(`(Insert angle: ${hdt.insertAngle}°, Approach: ${hdt.approachAngle}°)`);
      lines.push(`(All-directional turning — roughing, finishing, facing with single tool)`);
      lines.push(`G00 X${(hdt.startX + 5).toFixed(3)} Z${(hdt.startZ + 2).toFixed(3)}`);
      if (hdt.strategy === "rough" || hdt.strategy === "finish") {
        if (isFanuc || isHaas) {
          lines.push(`G71 U${c.doc.toFixed(1)} R0.500`);
          lines.push(`G71 P${pN} Q${qN} U0.300 W0.100 F${c.f.toFixed(4)}`);
          lines.push(`N${pN} G00 X${hdt.endX.toFixed(3)}`);
          lines.push(`G01 Z${hdt.endZ.toFixed(3)} F${(hdt.strategy === "finish" ? c.fFinish : c.f).toFixed(4)}`);
          lines.push(`N${qN} X${(hdt.startX + 2).toFixed(3)}`);
          if (hdt.strategy === "finish") {
            lines.push(`G70 P${pN} Q${qN} F${c.fFinish.toFixed(4)}`);
          }
        } else if (isSiemens) {
          const mode = hdt.strategy === "finish" ? 13 : 12;
          lines.push(`CYCLE952(${hdt.startX.toFixed(3)},${hdt.endX.toFixed(3)},${hdt.startZ.toFixed(3)},${hdt.endZ.toFixed(3)},${c.doc.toFixed(1)},0.3,${c.f.toFixed(4)},${c.fFinish.toFixed(4)},${mode},0,0,0,0,0,0,1,0)`);
        }
      } else if (hdt.strategy === "contour") {
        lines.push(`G01 X${hdt.endX.toFixed(3)} Z${hdt.startZ.toFixed(3)} F${c.f.toFixed(4)}`);
        lines.push(`G01 Z${hdt.endZ.toFixed(3)} F${c.f.toFixed(4)}`);
        lines.push(`G01 X${(hdt.startX + 2).toFixed(3)} F${c.f.toFixed(4)}`);
      } else {
        lines.push(`G00 X${(hdt.startX + 5).toFixed(3)} Z0.500`);
        lines.push(`G01 X-1.600 F${c.f.toFixed(4)} (Face)`);
        lines.push(`G00 X${(hdt.startX + 5).toFixed(3)}`);
        lines.push(`G01 Z${hdt.endZ.toFixed(3)} F${c.f.toFixed(4)} (Longitudinal)`);
      }
      lines.push(`(HDT reduces cycle time by ~25%)`);
    }

    if (op.type === "sim_4axis") {
      const s4 = op as Sim4AxisOp;
      lines.push(`(WARNING: 4th Axis requires B-axis capable mill-turn machine)`);
      lines.push(`(Verify machine supports B-axis interpolation before running)`);
      lines.push(`(4th Axis Simultaneous — B-axis ${s4.bAxisStart}° to ${s4.bAxisEnd}°)`);
      lines.push(`(${s4.undercut ? "Undercut machining enabled" : "Standard contour"})`);
      lines.push(`G00 X${(s4.startX + 5).toFixed(3)} Z${(s4.startZ + 2).toFixed(3)} B${s4.bAxisStart.toFixed(1)}`);
      const bSteps = 5;
      const bInc = (s4.bAxisEnd - s4.bAxisStart) / bSteps;
      const zInc = (s4.endZ - s4.startZ) / bSteps;
      const xInc = (s4.endX - s4.startX) / bSteps;
      for (let i = 0; i <= bSteps; i++) {
        const bAngle = s4.bAxisStart + bInc * i;
        const zPos = s4.startZ + zInc * i;
        const xPos = s4.startX + xInc * i;
        lines.push(`G01 X${xPos.toFixed(3)} Z${zPos.toFixed(3)} B${bAngle.toFixed(1)} F${c.f.toFixed(4)}`);
      }
      lines.push(`(Single setup — no repositioning needed)`);
    }

    if (op.type === "balanced") {
      const bl = op as BalancedOp;
      lines.push(`(Balanced roughing — 2 turrets ${bl.syncMode})`);
      lines.push(`(Upper turret: T0${t.position}, Lower turret trailing)`);
      lines.push(`G00 X${(stockDia / 2 + 5).toFixed(3)} Z2.000`);
      lines.push(`G71 U${c.doc.toFixed(1)} R0.500`);
      lines.push(`G71 P100 Q200 U0.300 W0.100 F${c.f.toFixed(4)}`);
      lines.push(`N100 G00 X${(stockDia / 2 - 20).toFixed(3)}`);
      lines.push(`G01 Z-100.000 F${c.f.toFixed(4)}`);
      lines.push(`N200 X${(stockDia / 2 + 2).toFixed(3)}`);
      lines.push(`(Second turret follows with offset — reduces deflection on long parts)`);
    }

    if (op.type === "thread_whirl") {
      const tw = op as ThreadWhirlOp;
      lines.push(`(Thread Whirling — ${tw.inserts}-insert whirl ring)`);
      lines.push(`(Whirl head RPM: ${tw.whirlRpm}, Workpiece low RPM for feed)`);
      if (tw.variablePitch) {
        lines.push(`(Variable pitch: ${tw.pitch}mm → ${tw.pitchEnd}mm)`);
      } else {
        lines.push(`(Constant pitch: ${tw.pitch}mm)`);
      }
      lines.push(`G00 X${(tw.nominalDia + 5).toFixed(3)} Z${(tw.startZ + 3).toFixed(3)}`);
      lines.push(`(Engage whirl head)`);
      lines.push(`M51 (Whirl spindle ON — ${tw.whirlRpm} RPM)`);
      lines.push(`G97 S${Math.round(tw.whirlRpm / tw.inserts / Math.PI * tw.pitch)} (Workpiece RPM for feed)`);
      if (tw.variablePitch) {
        const totalLen = Math.abs(tw.endZ - tw.startZ);
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
          const frac = i / steps;
          const zPos = tw.startZ + (tw.endZ - tw.startZ) * frac;
          const curPitch = tw.pitch + (tw.pitchEnd - tw.pitch) * frac;
          lines.push(`G01 X${(tw.nominalDia - tw.depth * 2).toFixed(3)} Z${zPos.toFixed(3)} F${curPitch.toFixed(4)} (Pitch ${curPitch.toFixed(3)}mm)`);
        }
      } else {
        lines.push(`G32 X${(tw.nominalDia - tw.depth * 2).toFixed(3)} Z${tw.endZ.toFixed(3)} F${tw.pitch.toFixed(4)}`);
      }
      lines.push(`M52 (Whirl spindle OFF)`);
      lines.push(`(Thread whirling complete — superior surface finish vs single-point threading)`);
    }

    if (op.type === "drill_multi") {
      const md = op as MultiDepthDrillOp;
      lines.push(`(Multi-Depth Drilling — ${md.depths.length} depth stages)`);
      lines.push(`(${md.crossHole ? "Cross-hole drilling enabled — reduced feed at breakthrough" : "Standard multi-depth sequence"})`);
      lines.push(`G00 X0.000 Z5.000`);
      for (let i = 0; i < md.depths.length; i++) {
        const depth = md.depths[i];
        const isLast = i === md.depths.length - 1;
        lines.push(`(--- Depth stage ${i + 1}: Z=${-depth}mm ---)`);
        if (isSiemens) {
          lines.push(`CYCLE83(5,0,${md.retract},${-depth},0,0,${md.peckPerDepth},${md.peckPerDepth},0,0,${md.dwellSec},0,1,${c.f.toFixed(4)},0,1)`);
        } else {
          lines.push(`G83 Z${(-depth).toFixed(3)} R${md.retract.toFixed(3)} Q${Math.round(md.peckPerDepth * 1000)} F${(md.crossHole && isLast ? c.f * 0.5 : c.f).toFixed(4)}`);
          if (md.dwellSec > 0) lines.push(`G04 X${md.dwellSec.toFixed(1)}`);
          lines.push(`G80`);
        }
        if (!isLast) lines.push(`G00 Z5.000 (Retract between stages)`);
      }
    }

    if (op.type === "chamfer") {
      const ch = op as ChamferOp;
      const radAngle = ch.angle * Math.PI / 180;
      const zTravel = ch.chamferSize * Math.sin(radAngle);
      lines.push(`(Advanced Chamfer — ${ch.angle}° × ${ch.chamferSize}mm, X${ch.xStart}→X${ch.xEnd})`);
      lines.push(`G00 X${(ch.xStart + 3).toFixed(3)} Z${ch.zPos.toFixed(3)}`);
      lines.push(`G01 X${ch.xStart.toFixed(3)} Z${ch.zPos.toFixed(3)} F${c.f.toFixed(4)}`);
      lines.push(`G01 X${ch.xEnd.toFixed(3)} Z${(ch.zPos - zTravel).toFixed(3)} F${c.f.toFixed(4)}`);
      lines.push(`G00 X${(ch.xStart + 3).toFixed(3)}`);
    }

    if (op.type === "drive_share") {
      const ds = op as DriveShareOp;
      lines.push(`(Drive Unit Sharing — T0${t.position} + T0${ds.tool2Position} simultaneous)`);
      lines.push(`(Sync RPM: ${ds.syncRpm}, Direction: ${ds.syncDir})`);
      lines.push(`T0${t.position}0${t.position}`);
      lines.push(`T0${ds.tool2Position}0${ds.tool2Position}`);
      lines.push(`G97 S${ds.syncRpm}`);
      lines.push(`${ds.syncDir}`);
      lines.push(`(Both tools cutting simultaneously on single drive unit)`);
      lines.push(`G01 X${(stockDia / 2 - 20).toFixed(3)} Z-50.000 F${c.f.toFixed(4)}`);
      lines.push(`G01 Z-100.000 F${c.f.toFixed(4)}`);
    }

    if (op.type === "manual") {
      const mo = op as ManualOp;
      mo.gcode.split("\n").forEach(l => lines.push(l));
    }

    lines.push(`G00 X${(stockDia / 2 + 20).toFixed(3)} Z50.000`);
    lines.push(`M09`);
    lines.push(`M05`);
    lines.push(``);
  }

  lines.push(`M30`);
  lines.push(`%`);
  return lines.join("\n");
}

const inputCls = "w-full bg-[#13131f] border border-white/10 rounded px-2 py-1 text-[11px] text-zinc-200 focus:border-amber-500/50 focus:outline-none";
const labelCls = "text-[10px] text-zinc-500 block mb-0.5";
const sectionCls = "text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2 mt-3 first:mt-0";

function NumInput({ label, value, onChange, step = 0.01, min, unit }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; unit?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}{unit ? ` (${unit})` : ""}</label>
      <input type="number" value={value} step={step} min={min} onChange={e => onChange(parseFloat(e.target.value) || 0)} className={inputCls} />
    </div>
  );
}

function CuttingDataEditor({ c, onChange }: { c: CuttingData; onChange: (c: CuttingData) => void }) {
  const up = (k: keyof CuttingData, v: unknown) => onChange({ ...c, [k]: v });
  return (
    <div className="space-y-2">
      <div className={sectionCls}>Cutting Parameters</div>
      <div className="grid grid-cols-2 gap-1.5">
        <NumInput label="Vc (m/min)" value={c.vc} onChange={v => up("vc", v)} step={5} unit="m/min" />
        <NumInput label="Feed Rough" value={c.f} onChange={v => up("f", v)} step={0.01} unit="mm/rev" />
        <NumInput label="Feed Finish" value={c.fFinish} onChange={v => up("fFinish", v)} step={0.005} unit="mm/rev" />
        <NumInput label="DOC Rough" value={c.doc} onChange={v => up("doc", v)} step={0.1} unit="mm" />
        <NumInput label="DOC Finish" value={c.docFinish} onChange={v => up("docFinish", v)} step={0.05} unit="mm" />
        <NumInput label="Max RPM" value={c.maxRpm} onChange={v => up("maxRpm", v)} step={50} />
        <NumInput label="CSS Limit" value={c.cssLimit} onChange={v => up("cssLimit", v)} step={50} />
        <div>
          <label className={labelCls}>Spindle Mode</label>
          <select value={c.spindleMode} onChange={e => up("spindleMode", e.target.value)} className={inputCls}>
            <option value="css">G96 — Constant Surface Speed</option>
            <option value="rpm">G97 — Constant RPM</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Coolant</label>
          <select value={c.coolant} onChange={e => up("coolant", e.target.value as CuttingData["coolant"])} className={inputCls}>
            <option value="M08">M08 — Flood</option>
            <option value="M07">M07 — Mist</option>
            <option value="M09">M09 — OFF</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ToolEditor({ t, onChange, onCuttingDataUpdate }: { t: ToolRef; onChange: (t: ToolRef) => void; onCuttingDataUpdate?: (cutting: Partial<CuttingData>) => void }) {
  const up = (k: keyof ToolRef, v: unknown) => onChange({ ...t, [k]: v });
  const [libraryTools, setLibraryTools] = useState<LibToolEntry[]>([]);
  const [libLoaded, setLibLoaded] = useState(false);
  const materialType = useCncStore(s => s.materialType);

  useEffect(() => {
    if (libLoaded) return;
    authFetch(getApiUrl("/tools"))
      .then(r => r.json())
      .then(data => {
        if (data.success) setLibraryTools(data.tools);
        setLibLoaded(true);
      })
      .catch(() => setLibLoaded(true));
  }, [libLoaded]);

  const selectFromLibrary = async (toolId: string) => {
    const lt = libraryTools.find(t => t.id === toolId);
    if (!lt) return;
    onChange({
      ...t,
      insert: lt.isoDesignation || lt.name,
      holder: lt.holderCode || t.holder,
      noseRadius: lt.noseRadius ?? t.noseRadius,
    });
    if (onCuttingDataUpdate) {
      try {
        const res = await authFetch(getApiUrl(`/tools/${toolId}/cutting-data`));
        const data = await res.json();
        if (data.success && data.cuttingData.length > 0) {
          const allCd = data.cuttingData as Array<{ materialId?: string; vcRough?: number; feedRough?: number; feedFinish?: number; docRough?: number; docFinish?: number; coolant?: string; maxRpm?: number }>;

          let matRes: Response | null = null;
          try { matRes = await authFetch(getApiUrl("/materials")); } catch {}
          const matData = matRes ? await matRes.json() : { success: false };
          let matchedCd = allCd[0];
          if (matData.success && matData.materials.length > 0) {
            const matCodeMap: Record<string, string> = {};
            for (const m of matData.materials) matCodeMap[m.id] = m.code;
            const materialMatch = allCd.find(cd => {
              if (!cd.materialId) return false;
              const code = matCodeMap[cd.materialId];
              return code && (code === materialType || code.startsWith(materialType));
            });
            if (materialMatch) matchedCd = materialMatch;
            else {
              const generalMatch = allCd.find(cd => !cd.materialId);
              if (generalMatch) matchedCd = generalMatch;
            }
          }

          const cd = matchedCd;
          onCuttingDataUpdate({
            ...(cd.vcRough != null && { vc: cd.vcRough }),
            ...(cd.feedRough != null && { f: cd.feedRough }),
            ...(cd.feedFinish != null && { fFinish: cd.feedFinish }),
            ...(cd.docRough != null && { doc: cd.docRough }),
            ...(cd.docFinish != null && { docFinish: cd.docFinish }),
            ...(cd.coolant && { coolant: cd.coolant as CuttingData["coolant"] }),
            ...(cd.maxRpm != null && { maxRpm: cd.maxRpm }),
          });
        }
      } catch {}
    }
  };

  return (
    <div className="space-y-2">
      <div className={sectionCls}>Tool Setup</div>
      {libraryTools.length > 0 && (
        <div className="mb-2">
          <label className={labelCls}><Database className="w-3 h-3 inline mr-1" />Select from Library</label>
          <select
            value=""
            onChange={e => { if (e.target.value) selectFromLibrary(e.target.value); }}
            className={inputCls}
          >
            <option value="">— Choose from your tool library —</option>
            {libraryTools.map(lt => (
              <option key={lt.id} value={lt.id}>
                {lt.name} ({lt.subType.replace(/_/g, " ")})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className={labelCls}>Turret Position</label>
          <select value={t.position} onChange={e => up("position", parseInt(e.target.value))} className={inputCls}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>T0{n < 10 ? "0" : ""}{n} — Position {n}</option>
            ))}
          </select>
        </div>
        <NumInput label="Nose Radius" value={t.noseRadius} onChange={v => up("noseRadius", v)} step={0.1} unit="mm" />
        <div className="col-span-2">
          <label className={labelCls}>Insert</label>
          <input value={t.insert} onChange={e => up("insert", e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Holder</label>
          <input value={t.holder} onChange={e => up("holder", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Cutting Direction</label>
          <select value={t.cuttingDir} onChange={e => up("cuttingDir", e.target.value)} className={inputCls}>
            <option value="L">L — Left (standard OD)</option>
            <option value="R">R — Right (boring)</option>
            <option value="N">N — Neutral</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Radius Compensation</label>
          <select value={t.compensation} onChange={e => up("compensation", e.target.value)} className={inputCls}>
            <option value="G42">G42 — Right (OD)</option>
            <option value="G41">G41 — Left (ID)</option>
            <option value="off">OFF</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function OpParamsEditor({ op, onChange }: { op: Operation; onChange: (o: Operation) => void }) {
  const up = (k: string, v: unknown) => onChange({ ...op, [k]: v } as Operation);

  switch (op.type) {
    case "face": {
      const o = op as FaceOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Passes" value={o.passes} onChange={v => up("passes", v)} step={1} min={1} />
          <NumInput label="X Allowance" value={o.allowanceX} onChange={v => up("allowanceX", v)} step={0.05} unit="mm" />
          <NumInput label="Z Allowance" value={o.allowanceZ} onChange={v => up("allowanceZ", v)} step={0.05} unit="mm" />
        </div>
      );
    }
    case "od_rough": {
      const o = op as ODRoughOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Start Z" value={o.startZ} onChange={v => up("startZ", v)} step={1} unit="mm" />
          <NumInput label="End Z" value={o.endZ} onChange={v => up("endZ", v)} step={1} unit="mm" />
          <NumInput label="Start X (radius)" value={o.startX} onChange={v => up("startX", v)} step={0.5} unit="mm" />
          <NumInput label="End X (radius)" value={o.endX} onChange={v => up("endX", v)} step={0.5} unit="mm" />
          <NumInput label="G71 DOC (U)" value={o.doc} onChange={v => up("doc", v)} step={0.1} unit="mm" />
          <NumInput label="Allowance (U)" value={o.allowance} onChange={v => up("allowance", v)} step={0.05} unit="mm" />
          <NumInput label="Profile Start N" value={o.g71p} onChange={v => up("g71p", v)} step={10} />
          <NumInput label="Profile End N" value={o.g71q} onChange={v => up("g71q", v)} step={10} />
        </div>
      );
    }
    case "od_finish": {
      const o = op as ODFinishOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Profile Start N" value={o.startN} onChange={v => up("startN", v)} step={10} />
          <NumInput label="Profile End N" value={o.endN} onChange={v => up("endN", v)} step={10} />
          <NumInput label="Chamfer" value={o.chamfer} onChange={v => up("chamfer", v)} step={0.5} unit="mm" />
          <NumInput label="Allowance" value={o.allowance} onChange={v => up("allowance", v)} step={0.05} unit="mm" />
        </div>
      );
    }
    case "groove_od": case "groove_id": {
      const o = op as GrooveOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Z Center" value={o.zCenter} onChange={v => up("zCenter", v)} step={1} unit="mm" />
          <NumInput label="Groove Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
          <NumInput label="Groove Width" value={o.width} onChange={v => up("width", v)} step={0.5} unit="mm" />
          <NumInput label="Corner Radius" value={o.cornerR} onChange={v => up("cornerR", v)} step={0.1} unit="mm" />
          <NumInput label="Stepover (P)" value={o.stepover} onChange={v => up("stepover", v)} step={0.5} unit="mm" />
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" id="peck" checked={o.pecking} onChange={e => up("pecking", e.target.checked)} className="accent-amber-500" />
            <label htmlFor="peck" className="text-[11px] text-zinc-400">Enable pecking (Q)</label>
          </div>
        </div>
      );
    }
    case "thread_ext": case "thread_int": {
      const o = op as ThreadOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Pitch" value={o.pitch} onChange={v => up("pitch", v)} step={0.25} unit="mm" />
          <NumInput label="Start Z" value={o.startZ} onChange={v => up("startZ", v)} step={1} unit="mm" />
          <NumInput label="End Z" value={o.endZ} onChange={v => up("endZ", v)} step={1} unit="mm" />
          <NumInput label="Nominal Dia" value={o.startX} onChange={v => up("startX", v)} step={0.5} unit="mm" />
          <NumInput label="Thread Depth (P)" value={o.depth} onChange={v => up("depth", v)} step={0.05} unit="mm" />
          <NumInput label="Cut Passes" value={o.passes} onChange={v => up("passes", v)} step={1} min={1} />
          <NumInput label="Spring Passes" value={o.springPasses} onChange={v => up("springPasses", v)} step={1} min={0} />
          <div>
            <label className={labelCls}>G76 Format</label>
            <select value={o.g76Format} onChange={e => up("g76Format", e.target.value)} className={inputCls}>
              <option value="fanuc2">Fanuc 2-block</option>
              <option value="haas1">Haas 1-block</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" id="pullout" checked={o.pullout} onChange={e => up("pullout", e.target.checked)} className="accent-amber-500" />
            <label htmlFor="pullout" className="text-[11px] text-zinc-400">Pullout at end</label>
          </div>
        </div>
      );
    }
    case "drill_peck": case "drill_center": case "reaming": case "tapping": {
      const o = op as DrillOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Drill Diameter" value={o.diameter} onChange={v => up("diameter", v)} step={0.5} unit="mm" />
          <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={1} unit="mm" />
          {op.type === "drill_peck" && <NumInput label="Peck Depth (Q)" value={o.peckDepth} onChange={v => up("peckDepth", v)} step={1} unit="mm" />}
          <NumInput label="Retract (R)" value={o.retract} onChange={v => up("retract", v)} step={0.5} unit="mm" />
          <NumInput label="Dwell (sec)" value={o.dwellSec} onChange={v => up("dwellSec", v)} step={0.1} />
        </div>
      );
    }
    case "bore_finish": case "id_rough": case "id_finish": {
      const o = op as BoreOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Bore Diameter" value={o.boreDia} onChange={v => up("boreDia", v)} step={0.1} unit="mm" />
          <NumInput label="Start Z" value={o.startZ} onChange={v => up("startZ", v)} step={1} unit="mm" />
          <NumInput label="End Z" value={o.endZ} onChange={v => up("endZ", v)} step={1} unit="mm" />
          <NumInput label="Allowance" value={o.allowance} onChange={v => up("allowance", v)} step={0.02} unit="mm" />
        </div>
      );
    }
    case "cutoff": {
      const o = op as CutoffOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Z Position" value={o.zPos} onChange={v => up("zPos", v)} step={0.5} unit="mm" />
          <NumInput label="X Start" value={o.xStart} onChange={v => up("xStart", v)} step={0.5} unit="mm" />
          <NumInput label="X Finish" value={o.xFinish} onChange={v => up("xFinish", v)} step={0.5} unit="mm" />
          <NumInput label="Blade Width" value={o.bladeWidth} onChange={v => up("bladeWidth", v)} step={0.5} unit="mm" />
        </div>
      );
    }
    case "trochoidal": {
      const o = op as TrochoidalOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Z Center" value={o.zCenter} onChange={v => up("zCenter", v)} step={1} unit="mm" />
          <NumInput label="Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
          <NumInput label="Width" value={o.width} onChange={v => up("width", v)} step={0.5} unit="mm" />
          <NumInput label="Step Angle" value={o.stepAngle} onChange={v => up("stepAngle", v)} step={5} unit="°" />
        </div>
      );
    }
    case "thread_whirl": {
      const o = op as ThreadWhirlOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Pitch (start)" value={o.pitch} onChange={v => up("pitch", v)} step={0.25} unit="mm" />
            {o.variablePitch && <NumInput label="Pitch (end)" value={o.pitchEnd} onChange={v => up("pitchEnd", v)} step={0.25} unit="mm" />}
            <NumInput label="Start Z" value={o.startZ} onChange={v => up("startZ", v)} step={1} unit="mm" />
            <NumInput label="End Z" value={o.endZ} onChange={v => up("endZ", v)} step={1} unit="mm" />
            <NumInput label="Nominal Dia" value={o.nominalDia} onChange={v => up("nominalDia", v)} step={0.5} unit="mm" />
            <NumInput label="Thread Depth" value={o.depth} onChange={v => up("depth", v)} step={0.05} unit="mm" />
            <NumInput label="Whirl RPM" value={o.whirlRpm} onChange={v => up("whirlRpm", v)} step={500} />
            <NumInput label="Inserts" value={o.inserts} onChange={v => up("inserts", v)} step={1} min={1} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" id="varPitch" checked={o.variablePitch} onChange={e => up("variablePitch", e.target.checked)} className="accent-fuchsia-500" />
            <label htmlFor="varPitch" className="text-[11px] text-zinc-400">Variable pitch (SP2 feature)</label>
          </div>
          <div className="text-[9px] text-fuchsia-400/70 bg-fuchsia-500/10 rounded px-2 py-1.5 border border-fuchsia-500/20">
            Thread whirling uses a rotating cutting ring around the workpiece. 5-10x faster than single-point threading. Ideal for bone screws, lead screws, worm gears on Swiss-type machines.
          </div>
        </div>
      );
    }
    case "drill_multi": {
      const o = op as MultiDepthDrillOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Drill Diameter" value={o.diameter} onChange={v => up("diameter", v)} step={0.5} unit="mm" />
            <NumInput label="Peck per Depth" value={o.peckPerDepth} onChange={v => up("peckPerDepth", v)} step={1} unit="mm" />
            <NumInput label="Retract" value={o.retract} onChange={v => up("retract", v)} step={0.5} unit="mm" />
            <NumInput label="Dwell (sec)" value={o.dwellSec} onChange={v => up("dwellSec", v)} step={0.1} />
          </div>
          <div>
            <label className={labelCls}>Depth Stages (mm, comma-separated)</label>
            <input
              value={o.depths.join(", ")}
              onChange={e => up("depths", e.target.value.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n)))}
              className={inputCls}
              placeholder="15, 30, 50, 75"
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" id="crossHole" checked={o.crossHole} onChange={e => up("crossHole", e.target.checked)} className="accent-cyan-500" />
            <label htmlFor="crossHole" className="text-[11px] text-zinc-400">Cross-hole drilling (reduce feed at breakthrough)</label>
          </div>
          <div className="text-[9px] text-cyan-400/70 bg-cyan-500/10 rounded px-2 py-1.5 border border-cyan-500/20">
            SP2 multi-depth: full control at each drilling depth stage. Better chip evacuation, reduced tool breakage on deep holes.
          </div>
        </div>
      );
    }
    case "chamfer": {
      const o = op as ChamferOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Z Position" value={o.zPos} onChange={v => up("zPos", v)} step={0.5} unit="mm" />
          <NumInput label="X Start (dia)" value={o.xStart} onChange={v => up("xStart", v)} step={0.5} unit="mm" />
          <NumInput label="X End (dia)" value={o.xEnd} onChange={v => up("xEnd", v)} step={0.5} unit="mm" />
          <NumInput label="Chamfer Angle" value={o.angle} onChange={v => up("angle", v)} step={5} unit="°" />
          <NumInput label="Chamfer Size" value={o.chamferSize} onChange={v => up("chamferSize", v)} step={0.25} unit="mm" />
        </div>
      );
    }
    case "groove_angled": {
      const o = op as AngledGrooveOp;
      return (
        <div className="grid grid-cols-2 gap-1.5">
          <NumInput label="Z Center" value={o.zCenter} onChange={v => up("zCenter", v)} step={1} unit="mm" />
          <NumInput label="Groove Depth" value={o.depth} onChange={v => up("depth", v)} step={0.5} unit="mm" />
          <NumInput label="Groove Width" value={o.width} onChange={v => up("width", v)} step={0.5} unit="mm" />
          <NumInput label="Incline Angle" value={o.angle} onChange={v => up("angle", v)} step={5} unit="°" />
          <NumInput label="Corner Radius" value={o.cornerR} onChange={v => up("cornerR", v)} step={0.1} unit="mm" />
        </div>
      );
    }
    case "hdt_freeturn": {
      const o = op as HDTFreeTurnOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Start Z" value={o.startZ} onChange={v => up("startZ", v)} step={1} unit="mm" />
            <NumInput label="End Z" value={o.endZ} onChange={v => up("endZ", v)} step={1} unit="mm" />
            <NumInput label="Start X" value={o.startX} onChange={v => up("startX", v)} step={0.5} unit="mm" />
            <NumInput label="End X" value={o.endX} onChange={v => up("endX", v)} step={0.5} unit="mm" />
            <NumInput label="Insert Angle" value={o.insertAngle} onChange={v => up("insertAngle", v)} step={1} unit="°" />
            <NumInput label="Approach Angle" value={o.approachAngle} onChange={v => up("approachAngle", v)} step={1} unit="°" />
          </div>
          <div>
            <label className={labelCls}>HDT Strategy</label>
            <select value={o.strategy} onChange={e => up("strategy", e.target.value)} className={inputCls}>
              <option value="rough">Roughing — Stock removal with HDT</option>
              <option value="finish">Finishing — Fine finish pass</option>
              <option value="contour">Contour — Profile turning</option>
              <option value="face_long">Face + Longitudinal — Combined ops</option>
            </select>
          </div>
          <div className="text-[9px] text-emerald-400/70 bg-emerald-500/10 rounded px-2 py-1.5 border border-emerald-500/20">
            Ceratizit FreeTurn: All turning operations (rough, finish, face, longitudinal) with a single tool. Cuts machining time by ~25%.
          </div>
        </div>
      );
    }
    case "sim_4axis": {
      const o = op as Sim4AxisOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Start Z" value={o.startZ} onChange={v => up("startZ", v)} step={1} unit="mm" />
            <NumInput label="End Z" value={o.endZ} onChange={v => up("endZ", v)} step={1} unit="mm" />
            <NumInput label="Start X" value={o.startX} onChange={v => up("startX", v)} step={0.5} unit="mm" />
            <NumInput label="End X" value={o.endX} onChange={v => up("endX", v)} step={0.5} unit="mm" />
            <NumInput label="B-axis Start" value={o.bAxisStart} onChange={v => up("bAxisStart", v)} step={5} unit="°" />
            <NumInput label="B-axis End" value={o.bAxisEnd} onChange={v => up("bAxisEnd", v)} step={5} unit="°" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input type="checkbox" id="undercut" checked={o.undercut} onChange={e => up("undercut", e.target.checked)} className="accent-sky-500" />
            <label htmlFor="undercut" className="text-[11px] text-zinc-400">Undercut machining (requires B-axis)</label>
          </div>
          <div className="text-[9px] text-sky-400/70 bg-sky-500/10 rounded px-2 py-1.5 border border-sky-500/20">
            B-axis tilting machines curved profiles and undercuts in a single setup — no repositioning needed.
          </div>
        </div>
      );
    }
    case "balanced": {
      const o = op as BalancedOp;
      return (
        <div className="space-y-2">
          <div>
            <label className={labelCls}>Sync Mode</label>
            <select value={o.syncMode} onChange={e => up("syncMode", e.target.value)} className={inputCls}>
              <option value="sync">Sync — Both turrets synchronized</option>
              <option value="M3">M3 — Primary forward</option>
              <option value="M4">M4 — Primary reverse</option>
            </select>
          </div>
          <div className="text-[9px] text-amber-400/70 bg-amber-500/10 rounded px-2 py-1.5 border border-amber-500/20">
            Two turning tools work simultaneously or trailing to rough long/large parts. Reduces deflection and cycle time.
          </div>
        </div>
      );
    }
    case "drive_share": {
      const o = op as DriveShareOp;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <NumInput label="Tool 2 Position" value={o.tool2Position} onChange={v => up("tool2Position", v)} step={1} min={1} />
            <NumInput label="Sync RPM" value={o.syncRpm} onChange={v => up("syncRpm", v)} step={50} />
            <div>
              <label className={labelCls}>Sync Direction</label>
              <select value={o.syncDir} onChange={e => up("syncDir", e.target.value)} className={inputCls}>
                <option value="M3">M3 — Forward</option>
                <option value="M4">M4 — Reverse</option>
              </select>
            </div>
          </div>
          <div className="text-[9px] text-lime-400/70 bg-lime-500/10 rounded px-2 py-1.5 border border-lime-500/20">
            Two tools sharing a single drive unit rotate at same RPM and direction for simultaneous cutting.
          </div>
        </div>
      );
    }
    case "manual": {
      const o = op as ManualOp;
      return (
        <div>
          <label className={labelCls}>G-code Block</label>
          <textarea
            value={o.gcode}
            onChange={e => up("gcode", e.target.value)}
            className={`${inputCls} h-28 resize-none font-mono`}
          />
        </div>
      );
    }
    default: return null;
  }
}

const OP_FACTORIES: Record<string, () => Operation> = {
  face: makeFaceOp, od_rough: makeODRoughOp, od_finish: makeODFinishOp,
  groove_od: makeGrooveOp, thread_ext: makeThreadOp, drill_peck: makeDrillOp,
  bore_finish: makeBoreOp, cutoff: makeCutoffOp, trochoidal: makeTrochoidalOp,
  manual: makeManualOp, tapping: makeTapOp, groove_angled: makeAngledGrooveOp,
  hdt_freeturn: makeHDTFreeTurnOp, sim_4axis: makeSim4AxisOp, drive_share: makeDriveShareOp,
  thread_whirl: makeThreadWhirlOp, drill_multi: makeMultiDepthDrillOp, chamfer: makeChamferOp,
  groove_id: () => ({ ...makeGrooveOp(), type: "groove_id" as const, name: "ID Groove" }),
  thread_int: () => ({ ...makeThreadOp(), type: "thread_int" as const, name: "Internal Thread" }),
  drill_center: () => ({ ...makeDrillOp(), type: "drill_center" as const, name: "Center Drill" }),
  id_rough: () => ({ ...makeBoreOp(), type: "id_rough" as const, name: "ID Rough" }),
  id_finish: () => ({ ...makeBoreOp(), type: "id_finish" as const, name: "ID Finish" }),
  balanced: () => ({ id: uid(), type: "balanced" as const, name: "Balanced Turning", enabled: true, tool: defaultTool(1), cutting: defaultCutting(), notes: "", syncMode: "sync" } as BalancedOp),
  reaming: () => ({ ...makeDrillOp(), type: "reaming" as const, name: "Reaming" }),
};

const DEFAULT_OPS: Operation[] = [makeFaceOp(), makeODRoughOp(), makeODFinishOp(), makeGrooveOp(), makeBoreOp()];

export function TurnAxisCAMOperationsView() {
  const [ops, setOps] = useState<Operation[]>(DEFAULT_OPS);
  const [selectedId, setSelectedId] = useState<string>(ops[0]?.id);
  const [controller, setController] = useState<Controller>("fanuc");
  const [stockDia, setStockDia] = useState(95);
  const [stockLen, setStockLen] = useState(150);
  const [showGcode, setShowGcode] = useState(false);
  const [show3DSim, setShow3DSim] = useState(false);
  const [show3DMillingSim, setShow3DMillingSim] = useState(false);
  const [activeTab, setActiveTab] = useState<"params" | "tool" | "cutting" | "notes">("params");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const selectedOp = ops.find(o => o.id === selectedId);

  const updateOp = useCallback((id: string, updated: Operation) => {
    setOps(prev => prev.map(o => o.id === id ? updated : o));
  }, []);

  const addOp = useCallback((type: string) => {
    const factory = OP_FACTORIES[type];
    if (!factory) return;
    const newOp = factory();
    setOps(prev => [...prev, newOp]);
    setSelectedId(newOp.id);
    setAddMenuOpen(false);
  }, []);

  const removeOp = useCallback((id: string) => {
    setOps(prev => {
      const next = prev.filter(o => o.id !== id);
      if (selectedId === id && next.length > 0) setSelectedId(next[0].id);
      return next;
    });
  }, [selectedId]);

  const moveOp = useCallback((id: string, dir: -1 | 1) => {
    setOps(prev => {
      const idx = prev.findIndex(o => o.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  const gcode = useMemo(() => generateGcode(ops, controller, stockDia, stockLen), [ops, controller, stockDia, stockLen]);

  const totalEnabledOps = ops.filter(o => o.enabled).length;
  const gcodeLinesArr = useMemo(() => gcode.split("\n"), [gcode]);
  const gcodeLines = gcodeLinesArr.length;

  const simMoves = useMemo(() => {
    const moves: { x: number; z: number; type: "rapid" | "cut"; feedRate?: number; spindleRpm?: number; gcodeLine?: string }[] = [];
    let curX = stockDia / 2 + 20;
    let curZ = 5;
    let curF = 0.2;
    let curRpm = 1000;
    for (const line of gcodeLinesArr) {
      const trimmed = line.replace(/\(.*?\)/g, "").trim();
      if (!trimmed || trimmed.startsWith("(") || trimmed.startsWith("%") || trimmed.startsWith("O") || trimmed.startsWith("N")) continue;
      const isRapid = /G0?0\b/.test(trimmed) && !/G0?1/.test(trimmed);
      const isCut = /G0?1\b/.test(trimmed) || /G32\b/.test(trimmed);
      const xMatch = trimmed.match(/X(-?[\d.]+)/);
      const zMatch = trimmed.match(/Z(-?[\d.]+)/);
      const fMatch = trimmed.match(/F(-?[\d.]+)/);
      const sMatch = trimmed.match(/S(\d+)/);
      if (fMatch) curF = parseFloat(fMatch[1]);
      if (sMatch) curRpm = parseInt(sMatch[1]);
      if (xMatch || zMatch) {
        if (xMatch) curX = Math.abs(parseFloat(xMatch[1])) / 2;
        if (zMatch) curZ = parseFloat(zMatch[1]);
        moves.push({ x: curX, z: curZ, type: isRapid ? "rapid" : "cut", feedRate: isCut ? curF : undefined, spindleRpm: curRpm, gcodeLine: trimmed });
      }
    }
    if (moves.length === 0) moves.push({ x: stockDia / 2 + 10, z: 5, type: "rapid" });
    return moves;
  }, [gcodeLinesArr, stockDia]);

  return (
    <div className="flex h-full bg-[#09090f] text-zinc-300 overflow-hidden">
      <div className="w-[230px] flex-shrink-0 border-r border-white/[0.07] flex flex-col bg-[#0c0c1a] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-white/[0.07]">
          <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 mb-2">
            <Settings className="w-3.5 h-3.5 text-amber-500" />
            Operation Manager
          </div>
          <div className="grid grid-cols-2 gap-1 mb-1.5">
            <div>
              <label className={labelCls}>Controller</label>
              <select value={controller} onChange={e => setController(e.target.value as Controller)} className={inputCls}>
                {Object.entries(CONTROLLERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Stock Ø (mm)</label>
              <input type="number" value={stockDia} onChange={e => setStockDia(parseFloat(e.target.value) || 95)} step={1} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Stock Length (mm)</label>
            <input type="number" value={stockLen} onChange={e => setStockLen(parseFloat(e.target.value) || 150)} step={5} className={inputCls} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1.5">
          {ops.map((op, idx) => {
            const meta = OP_META[op.type];
            const isSelected = op.id === selectedId;
            return (
              <div
                key={op.id}
                onClick={() => setSelectedId(op.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded mb-0.5 cursor-pointer text-[11px] transition-all
                  ${isSelected ? "bg-amber-500/15 border border-amber-500/30" : "hover:bg-white/[0.04] border border-transparent"}
                  ${!op.enabled ? "opacity-40" : ""}`}
              >
                <button onClick={e => { e.stopPropagation(); setOps(prev => prev.map(o => o.id === op.id ? { ...o, enabled: !o.enabled } : o)); }}
                  className="flex-shrink-0 text-zinc-600 hover:text-zinc-300">
                  {op.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <span className={`flex-shrink-0 ${meta.color}`}>{meta.icon}</span>
                <span className="flex-1 truncate text-zinc-300">{op.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
                  <button onClick={e => { e.stopPropagation(); moveOp(op.id, -1); }}
                    className="p-0.5 hover:text-zinc-200 text-zinc-600"><ArrowUp className="w-2.5 h-2.5" /></button>
                  <button onClick={e => { e.stopPropagation(); moveOp(op.id, 1); }}
                    className="p-0.5 hover:text-zinc-200 text-zinc-600"><ArrowDown className="w-2.5 h-2.5" /></button>
                  <button onClick={e => { e.stopPropagation(); removeOp(op.id); }}
                    className="p-0.5 hover:text-red-400 text-zinc-600"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-2 py-2 border-t border-white/[0.07] space-y-1.5">
          <div className="relative">
            <button onClick={() => setAddMenuOpen(v => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[11px]
                         bg-amber-600/20 border border-amber-600/30 text-amber-400 hover:bg-amber-600/30 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Operation
            </button>
            {addMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#15152a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                {(Object.entries(OP_META) as [OperationType, typeof OP_META[OperationType]][]).map(([type, meta]) => (
                  OP_FACTORIES[type] ? (
                    <button key={type} onClick={() => addOp(type)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-white/[0.06] transition-colors text-left">
                      <span className={meta.color}>{meta.icon}</span>
                      <div>
                        <div className="text-zinc-300">{meta.label}</div>
                        <div className="text-zinc-600 text-[9px]">{meta.desc}</div>
                      </div>
                    </button>
                  ) : null
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
            <Check className="w-3 h-3 text-green-500" />
            <span>{totalEnabledOps}/{ops.length} ops active · {gcodeLines} lines</span>
          </div>
        </div>
      </div>

      <div className="w-[300px] flex-shrink-0 border-r border-white/[0.07] flex flex-col bg-[#0a0a18] overflow-hidden">
        {selectedOp ? (
          <>
            <div className="px-3 py-2 border-b border-white/[0.07]">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`${OP_META[selectedOp.type].color}`}>{OP_META[selectedOp.type].icon}</span>
                <input
                  value={selectedOp.name}
                  onChange={e => updateOp(selectedOp.id, { ...selectedOp, name: e.target.value } as Operation)}
                  className="flex-1 bg-transparent text-[12px] font-bold text-zinc-200 focus:outline-none border-b border-transparent focus:border-amber-500/40"
                />
              </div>
              <div className="text-[9px] text-zinc-600">{OP_META[selectedOp.type].desc}</div>
            </div>

            <div className="flex border-b border-white/[0.07]">
              {(["params", "tool", "cutting", "notes"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-[10px] capitalize transition-colors
                    ${activeTab === tab ? "border-b-2 border-amber-500 text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {activeTab === "params" && <OpParamsEditor op={selectedOp} onChange={o => updateOp(selectedOp.id, o)} />}
              {activeTab === "tool" && <ToolEditor t={selectedOp.tool} onChange={t => updateOp(selectedOp.id, { ...selectedOp, tool: t } as Operation)} onCuttingDataUpdate={partial => updateOp(selectedOp.id, { ...selectedOp, cutting: { ...selectedOp.cutting, ...partial } } as Operation)} />}
              {activeTab === "cutting" && <CuttingDataEditor c={selectedOp.cutting} onChange={c => updateOp(selectedOp.id, { ...selectedOp, cutting: c } as Operation)} />}
              {activeTab === "notes" && (
                <div>
                  <label className={labelCls}>Operation Notes</label>
                  <textarea
                    value={selectedOp.notes}
                    onChange={e => updateOp(selectedOp.id, { ...selectedOp, notes: e.target.value } as Operation)}
                    placeholder="Add notes, warnings, setup instructions..."
                    className={`${inputCls} h-32 resize-none`}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs">
            Select an operation to edit
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#0b0b18]">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-zinc-300">G-Code Output</span>
            <span className="text-[10px] text-zinc-600">{CONTROLLERS[controller]} · {gcodeLines} lines</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShow3DSim(v => !v); if (!show3DSim) { setShowGcode(false); setShow3DMillingSim(false); } }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] border transition-colors
                ${show3DSim ? "bg-violet-600/20 border-violet-600/30 text-violet-400" : "bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08]"}`}
            >
              <Monitor className="w-3.5 h-3.5" />
              {show3DSim ? "Lathe Sim Active" : "3D Lathe Sim"}
            </button>
            <button
              onClick={() => { setShow3DMillingSim(v => !v); if (!show3DMillingSim) { setShowGcode(false); setShow3DSim(false); } }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] border transition-colors
                ${show3DMillingSim ? "bg-blue-600/20 border-blue-600/30 text-blue-400" : "bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08]"}`}
            >
              <Box className="w-3.5 h-3.5" />
              {show3DMillingSim ? "Milling Sim Active" : "3D Milling Sim"}
            </button>
            <button
              onClick={() => { setShowGcode(v => !v); if (!showGcode) { setShow3DSim(false); setShow3DMillingSim(false); } }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] border transition-colors
                ${showGcode ? "bg-green-600/20 border-green-600/30 text-green-400" : "bg-white/[0.04] border-white/[0.08] text-zinc-400 hover:bg-white/[0.08]"}`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              {showGcode ? "G-Code Visible" : "Show G-Code"}
            </button>
            <button
              onClick={() => {
                const blob = new Blob([gcode], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `roll_program_${controller}.nc`;
                a.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/30 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export .nc
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {show3DSim ? (
            <div className="flex-1 relative">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full bg-[#06060f]">
                  <div className="text-zinc-500 text-sm">Loading 3D Lathe Simulation...</div>
                </div>
              }>
                <LatheSimulator3D
                  moves={simMoves}
                  stockDiameter={stockDia}
                  stockLength={stockLen}
                  gcodeLines={gcodeLinesArr.filter(l => l.trim() && !l.trim().startsWith("("))}
                />
              </Suspense>
            </div>
          ) : show3DMillingSim ? (
            <div className="flex-1 relative">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full bg-[#06060f]">
                  <div className="text-zinc-500 text-sm">Loading 3D Milling Simulation...</div>
                </div>
              }>
                <MillingSimulator3D
                  stockSizeX={stockLen}
                  stockSizeY={stockDia / 3}
                  stockSizeZ={stockLen * 0.8}
                />
              </Suspense>
            </div>
          ) : (
          <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {ops.map((op, idx) => {
              const meta = OP_META[op.type];
              return (
                <div key={op.id}
                  className={`rounded-xl border ${op.enabled ? "border-white/[0.07] bg-white/[0.02]" : "border-white/[0.03] bg-transparent opacity-40"}
                    ${selectedId === op.id ? "ring-1 ring-amber-500/30" : ""}`}>
                  <div
                    onClick={() => setSelectedId(op.id)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                  >
                    <span className="text-[10px] font-mono text-zinc-600 w-4 text-right">{idx + 1}</span>
                    <span className={meta.color}>{meta.icon}</span>
                    <span className="text-[11px] font-semibold text-zinc-200 flex-1">{op.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${op.enabled
                      ? "text-green-400 bg-green-500/10 border-green-500/20"
                      : "text-zinc-600 bg-zinc-800 border-zinc-700"}`}>
                      {op.enabled ? "ON" : "OFF"}
                    </span>
                    <span className="text-[9px] text-zinc-600">T0{op.tool.position}0{op.tool.position}</span>
                    <span className="text-[9px] text-zinc-600">{op.cutting.spindleMode === "css" ? `G96 ${op.cutting.vc}m/min` : `G97 ${op.cutting.maxRpm}rpm`}</span>
                    <span className="text-[9px] text-zinc-600">{op.cutting.f}mm/rev</span>
                  </div>

                  <div className="flex gap-1 px-3 pb-2">
                    {[
                      { label: `Vc=${op.cutting.vc}`, color: "text-blue-400" },
                      { label: `f=${op.cutting.f}`, color: "text-green-400" },
                      { label: `DOC=${op.cutting.doc}`, color: "text-orange-400" },
                      { label: op.cutting.coolant, color: "text-cyan-400" },
                      { label: op.tool.insert.split(" ")[0], color: "text-purple-400" },
                    ].map((tag, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] ${tag.color}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {showGcode && (
            <div className="w-[420px] flex-shrink-0 border-l border-white/[0.07] flex flex-col">
              <div className="px-3 py-2 border-b border-white/[0.07] flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400">Live G-Code — {CONTROLLERS[controller]}</span>
                <button onClick={() => navigator.clipboard?.writeText(gcode)}
                  className="text-[9px] flex items-center gap-1 text-zinc-600 hover:text-zinc-300">
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-3 text-[9px] font-mono text-green-400 leading-relaxed whitespace-pre-wrap">
                {gcode}
              </pre>
            </div>
          )}
          </>
          )}
        </div>

        <div className="flex-shrink-0 px-4 py-2 border-t border-white/[0.06] bg-[#0b0b18] flex items-center gap-4 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-green-500" />{totalEnabledOps} operations</span>
          <span className="flex items-center gap-1.5"><FileCode2 className="w-3 h-3" />{gcodeLines} G-code lines</span>
          <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-blue-500" />Pre-flight ready</span>
          <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-500" />{controller.toUpperCase()} post-processor</span>
          <span className="ml-auto">Ø{stockDia} × {stockLen}mm stock</span>
        </div>
      </div>
    </div>
  );
}
