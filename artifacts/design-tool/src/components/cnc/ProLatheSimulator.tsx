import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, Upload, Download,
  ChevronRight, AlertTriangle, CheckCircle, Settings2, Zap, Activity,
  Calculator, BookOpen, Layers, Box, RefreshCw, Code2, Cpu,
  StopCircle, ChevronDown, ChevronUp, Copy, FileCode, Hash,
  Wrench, Circle, Target, Gauge, Shield, AlertCircle,
} from "lucide-react";
import { LatheSimulator3D, type LatheToolMove } from "./LatheSimulator3D";
import { runFullPreFlightCheck, type WorkpieceGeometry, type ToolGeometry } from "./CollisionEngine3D";

// ─── Types ──────────────────────────────────────────────────────────────────

type Controller = "fanuc" | "siemens" | "haas" | "mazak" | "mitsubishi" | "delta";
type SimPanel = "reference" | "turret" | "calculator" | "verify";
type Material = "GI" | "CR" | "HR" | "SS" | "AL" | "MS" | "CAST_IRON" | "TI";

interface ToolSlot {
  number: number;
  label: string;
  type: "OD_ROUGH" | "OD_FINISH" | "GROOVE" | "THREAD" | "BORE" | "DRILL" | "CUTOFF" | "NONE";
  diameter?: number;
  noseRadius?: number;
  color: string;
}

interface ParsedBlock {
  lineNo: number;
  raw: string;
  type: "G00" | "G01" | "G02" | "G03" | "G28" | "G71" | "G70" | "G76" | "SPINDLE" | "TOOL" | "M" | "OTHER";
  x?: number; z?: number; f?: number; s?: number;
  r?: number; i?: number; k?: number;
  tool?: number; mCode?: number;
  isRapid: boolean;
  comment?: string;
}

// ─── Default G-Code Program ──────────────────────────────────────────────────

const DEFAULT_GCODE = `%
O0001 (ROLL FORMING TOOL - SAI ROLOTECH)
(MATERIAL: GI STEEL | OD: 80mm | LENGTH: 120mm)
N10 G21 G18 G40 G99
N20 G28 U0. W0.
N30 T0101 (OD ROUGH TOOL - CNMG 120408)
N40 G96 S180 M03 (CSS 180 m/min)
N50 G00 X84.0 Z2.0 M08
N60 G71 U2.0 R0.5 (ROUGH TURNING CYCLE)
N70 G71 P80 Q140 U0.4 W0.1 F0.25
N80 G00 X0.0
N90 G01 Z0.0 F0.1
N100 G01 X36.0
N110 G01 X40.0 Z-2.0
N120 G01 Z-45.0
N130 G01 X60.0 Z-50.0
N140 G01 Z-115.0
N150 G28 U0. W0.
N160 T0202 (OD FINISH TOOL - DCMT 11T304)
N170 G96 S250 M03
N180 G00 X84.0 Z2.0
N190 G70 P80 Q140 F0.10 (FINISH PASS)
N200 G28 U0. W0.
N210 T0303 (GROOVE TOOL - 3mm WIDTH)
N220 G97 S600 M03
N230 G00 X84.0 Z-55.0
N240 G75 R1.0
N250 G75 X54.0 Z-58.0 P3000 Q3000 F0.05
N260 G00 X84.0
N270 G28 U0. W0.
N280 T0404 (THREAD TOOL - 60deg)
N290 G97 S500 M03
N300 G00 X44.0 Z4.0
N310 G76 P020060 Q100 R0.1
N320 G76 X37.4 Z-40.0 P1300 Q400 F2.0
N330 G28 U0. W0.
N340 M09
N350 M30
%`;

// ─── Lathe G-Code Parser ─────────────────────────────────────────────────────

function parseLatheGCode(code: string): { blocks: ParsedBlock[]; moves: LatheToolMove[]; alarms: string[] } {
  const lines = code.split("\n");
  const blocks: ParsedBlock[] = [];
  const moves: LatheToolMove[] = [];
  const alarms: string[] = [];
  let cx = 42, cz = 2, cf = 0.25, cs = 1000, modal: "G00" | "G01" = "G00";
  let currentTool = 1;
  let cssMode = false;
  let diameter = 80;

  const num = (upper: string, re: RegExp): number | undefined => {
    const m = upper.match(re);
    return m ? parseFloat(m[1]) : undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw === "%" || raw.match(/^O\d+/i)) continue;

    const commentMatch = raw.match(/\(([^)]*)\)/);
    const comment = commentMatch ? commentMatch[1] : undefined;
    const upper = raw.toUpperCase().replace(/\(.*?\)/g, "").replace(/;.*/g, "").trim();
    if (!upper) continue;

    const allG = [...upper.matchAll(/G0*(\d+\.?\d*)/g)].map(m => parseFloat(m[1]));
    const xv = num(upper, /X(-?\d+\.?\d*)/);
    const zv = num(upper, /Z(-?\d+\.?\d*)/);
    const fv = num(upper, /F(\d+\.?\d*)/);
    const sv = num(upper, /S(\d+)/);
    const rv = num(upper, /R(-?\d+\.?\d*)/);
    const iv = num(upper, /I(-?\d+\.?\d*)/);
    const kv = num(upper, /K(-?\d+\.?\d*)/);
    const tv = num(upper, /T(\d+)/);
    const mv = num(upper, /M(\d+)/);
    const pv = num(upper, /P(\d+)/);
    const qv = num(upper, /Q(\d+)/);

    if (fv !== undefined) cf = fv;
    if (sv !== undefined) {
      cs = sv;
      if (cssMode) {
        const r = (xv !== undefined ? xv / 2 : cx);
        cs = r > 0 ? Math.round((sv * 1000) / (Math.PI * r * 2)) : sv;
      }
    }
    if (tv !== undefined) {
      currentTool = Math.floor(tv / 100) || Math.floor(tv / 10) || tv;
      if (currentTool === 0) currentTool = 1;
    }

    for (const gn of allG) {
      if (gn === 0) modal = "G00";
      else if (gn === 1) modal = "G01";
      else if (gn === 96) cssMode = true;
      else if (gn === 97) cssMode = false;
    }

    let blockType: ParsedBlock["type"] = "OTHER";
    let isRapid = false;

    if (allG.includes(28)) {
      blockType = "G28";
      moves.push({ x: diameter / 2 + 15, z: 5, type: "rapid", gcodeLine: raw });
      cx = diameter / 2 + 15; cz = 5;
    } else if (allG.includes(71) || allG.includes(72)) {
      blockType = "G71";
      if (xv !== undefined || zv !== undefined) {
        if (xv !== undefined) { cx = xv / 2; diameter = xv; }
        if (zv !== undefined) cz = zv;
      }
    } else if (allG.includes(70)) {
      blockType = "G70";
    } else if (allG.includes(75) || allG.includes(76)) {
      blockType = allG.includes(76) ? "G76" : "OTHER";
      if (xv !== undefined && zv !== undefined) {
        const targetX = xv / 2;
        moves.push({ x: cx, z: zv, type: "rapid", gcodeLine: raw, spindleRpm: cs });
        moves.push({ x: targetX, z: zv, type: "cut", feedRate: cf, spindleRpm: cs, gcodeLine: raw });
        moves.push({ x: cx + 5, z: zv, type: "rapid" });
        cz = zv;
      }
    } else if (allG.includes(0) || (modal === "G00" && (xv !== undefined || zv !== undefined) && !allG.some(g => g === 1))) {
      blockType = "G00";
      isRapid = true;
      const nx = xv !== undefined ? xv / 2 : cx;
      const nz = zv !== undefined ? zv : cz;
      moves.push({ x: nx, z: nz, type: "rapid", spindleRpm: cs, gcodeLine: raw });
      cx = nx; cz = nz;
    } else if (allG.includes(1) || (modal === "G01" && (xv !== undefined || zv !== undefined))) {
      blockType = "G01";
      const nx = xv !== undefined ? xv / 2 : cx;
      const nz = zv !== undefined ? zv : cz;
      moves.push({ x: nx, z: nz, type: "cut", feedRate: cf, spindleRpm: cs, gcodeLine: raw });
      cx = nx; cz = nz;
    } else if (mv !== undefined) {
      blockType = "SPINDLE";
    } else if (tv !== undefined) {
      blockType = "TOOL";
    }

    if (xv !== undefined && xv < 0) {
      alarms.push(`Line ${i + 1}: Negative X value — check diameter (${raw.slice(0, 40)})`);
    }

    blocks.push({ lineNo: i + 1, raw, type: blockType, x: xv, z: zv, f: fv, s: sv, r: rv, i: iv, k: kv, tool: tv, mCode: mv, isRapid, comment });
  }

  if (moves.length === 0) alarms.push("No valid motion found. Check G-code format.");

  return { blocks, moves, alarms };
}

// ─── Post-Processor ──────────────────────────────────────────────────────────

const CONTROLLER_INFO: Record<Controller, { label: string; desc: string; color: string }> = {
  fanuc:      { label: "Fanuc 0i/30i",         desc: "Standard ISO G-code — most common",          color: "#f59e0b" },
  siemens:    { label: "Siemens Sinumerik 840D",desc: "European industrial standard — CYCLE calls", color: "#3b82f6" },
  haas:       { label: "HAAS SL Series",        desc: "American lathe — Fanuc-compatible",          color: "#22c55e" },
  mazak:      { label: "Mazak EIA/ISO",         desc: "Japanese — Mazatrol compatible",             color: "#8b5cf6" },
  mitsubishi: { label: "Mitsubishi M700",       desc: "Japanese precision — M700 series",           color: "#ef4444" },
  delta:      { label: "Delta CNC",             desc: "SAI Rolotech integrated post-processor",     color: "#f97316" },
};

function postProcess(gcode: string, controller: Controller): string {
  const lines = gcode.split("\n");
  const now = new Date().toLocaleDateString("en-GB");

  const header: Record<Controller, string[]> = {
    fanuc:      [`%`, `O0001 (SAI ROLOTECH — FANUC 0i)`, `(DATE: ${now})`, `G21 G18 G40 G99`],
    siemens:    [`; SAI ROLOTECH — SIEMENS SINUMERIK 840D`, `; DATE: ${now}`, `G71 G18 G40 G95`, `LIMS=3000`],
    haas:       [`%`, `O0001 (SAI ROLOTECH — HAAS SL)`, `(DATE: ${now})`, `G21 G18 G40 G99`],
    mazak:      [`%`, `O0001 (SAI ROLOTECH — MAZAK EIA)`, `(DATE: ${now})`, `G21 G18 G40 G99`],
    mitsubishi: [`(SAI ROLOTECH — MITSUBISHI M700)`, `(DATE: ${now})`, `G21 G18 G40 G95`],
    delta:      [`%`, `(SAI ROLOTECH — DELTA CNC)`, `(DATE: ${now})`, `G21 G18 G40 G99`],
  };

  const footer: Record<Controller, string[]> = {
    fanuc:      [`G28 U0. W0.`, `M09`, `M30`, `%`],
    siemens:    [`G74 X0 Z0`, `M09`, `M30`],
    haas:       [`G28 U0. W0.`, `M09`, `G103`, `M30`, `%`],
    mazak:      [`G28 U0. W0.`, `M09`, `M02`, `%`],
    mitsubishi: [`G28 U0. W0.`, `M09`, `M02`],
    delta:      [`G28 U0. W0.`, `M09`, `M30`, `%`],
  };

  const transformLine = (raw: string, ctrl: Controller): string => {
    if (!raw.trim() || raw.trim() === "%" || raw.trim().match(/^O\d+/i)) return "";
    let line = raw.trim();

    if (ctrl === "siemens") {
      line = line.replace(/G28\s+U0\.\s+W0\./gi, "G74 X0 Z0");
      line = line.replace(/G71\s+U([\d.]+)\s+R([\d.]+)/gi, (_m, u, r) => `CYCLE95("CONTOUR", ${u}, 0, 0.1, 0, ${r}, 0, 0.25, 1)`);
      line = line.replace(/G70\s+P\d+\s+Q\d+/gi, `CYCLE95("CONTOUR", 0.1, 0, 0.05, 0, 0, 0, 0.1, 4)`);
      line = line.replace(/G76\s+P(\d+)\s+Q(\d+)/gi, (_m, p, q) => `CYCLE97(${(parseInt(q)/1000).toFixed(3)}, 0, 0, ${(parseInt(p)/10000).toFixed(4)}, 2, 0.1)`);
      line = line.replace(/G96/gi, "G96 (CSS)");
      line = line.replace(/G97/gi, "G97 (RPM)");
      line = line.replace(/T(\d{4})/gi, (_m, t) => `T${parseInt(t.slice(0,2))} D${parseInt(t.slice(2,4))}`);
    }

    if (ctrl === "haas") {
      line = line.replace(/G71\s+U([\d.]+)\s+R([\d.]+)/gi, (_m, u, r) => `G71 U${u} R${r} (HAAS ROUGH CYCLE)`);
      line = line.replace(/M08/gi, "M08 (COOLANT ON)");
      line = line.replace(/M09/gi, "M09 (COOLANT OFF)");
      line = line.replace(/M30/gi, "M30 (END — RESET)");
    }

    if (ctrl === "mazak") {
      line = line.replace(/G28\s+U0\.\s+W0\./gi, "G30 U0. W0. (2ND HOME)");
      line = line.replace(/M03/gi, "M03 S (CW SPINDLE)");
      line = line.replace(/M30/gi, "M02 (PROGRAM END)");
    }

    if (ctrl === "mitsubishi") {
      line = line.replace(/G28\s+U0\.\s+W0\./gi, "G28 X0. Z0.");
      line = line.replace(/G71/gi, "G1071 (M700 ROUGH)");
      line = line.replace(/G70/gi, "G1070 (M700 FINISH)");
      line = line.replace(/G99/gi, "G95 (FEED/REV)");
    }

    if (ctrl === "delta") {
      line = line.replace(/G96/gi, "G96 (DELTA CSS)");
      line = line.replace(/G97/gi, "G97 (DELTA RPM)");
      line = line.replace(/M08/gi, "M08 (COOLANT)");
    }

    return line;
  };

  const processed = lines
    .map(l => transformLine(l, controller))
    .filter(l => l !== "" && !l.match(/^%$/) && !l.match(/^O\d+/i));

  return [...header[controller], "", ...processed, "", ...footer[controller]].join("\n");
}

// ─── G-Code Reference Table ──────────────────────────────────────────────────

const GCODE_REF = [
  { code: "G00", type: "G", desc: "Rapid positioning", example: "G00 X50.0 Z2.0" },
  { code: "G01", type: "G", desc: "Linear interpolation (feed)", example: "G01 X40.0 Z-50.0 F0.2" },
  { code: "G02", type: "G", desc: "Circular CW interpolation", example: "G02 X50.0 Z-5.0 R5.0" },
  { code: "G03", type: "G", desc: "Circular CCW interpolation", example: "G03 X50.0 Z-5.0 R5.0" },
  { code: "G04", type: "G", desc: "Dwell (pause)", example: "G04 X1.5 (1.5 sec)" },
  { code: "G21", type: "G", desc: "Metric mode (mm)", example: "G21" },
  { code: "G28", type: "G", desc: "Return to home position", example: "G28 U0. W0." },
  { code: "G40", type: "G", desc: "Tool radius cancel", example: "G40" },
  { code: "G70", type: "G", desc: "Finish turning cycle", example: "G70 P10 Q100 F0.1" },
  { code: "G71", type: "G", desc: "Rough turning cycle OD", example: "G71 U2.0 R0.5" },
  { code: "G75", type: "G", desc: "Grooving/peck drill cycle", example: "G75 X30.0 Z-20.0 P2000 Q2000 F0.05" },
  { code: "G76", type: "G", desc: "Multi-pass threading cycle", example: "G76 P020060 Q100 R0.1" },
  { code: "G96", type: "G", desc: "Constant surface speed", example: "G96 S180 M03" },
  { code: "G97", type: "G", desc: "Constant spindle RPM", example: "G97 S800 M03" },
  { code: "G99", type: "G", desc: "Feed per revolution mm/rev", example: "G99 F0.2" },
  { code: "M03", type: "M", desc: "Spindle CW (forward)", example: "M03" },
  { code: "M04", type: "M", desc: "Spindle CCW (reverse)", example: "M04" },
  { code: "M05", type: "M", desc: "Spindle stop", example: "M05" },
  { code: "M08", type: "M", desc: "Coolant ON", example: "M08" },
  { code: "M09", type: "M", desc: "Coolant OFF", example: "M09" },
  { code: "M30", type: "M", desc: "Program end & rewind", example: "M30" },
];

// ─── Default Tool Slots ──────────────────────────────────────────────────────

const DEFAULT_TOOLS: ToolSlot[] = [
  { number: 1,  label: "OD Rough CNMG", type: "OD_ROUGH",  diameter: 25, noseRadius: 0.8, color: "#f59e0b" },
  { number: 2,  label: "OD Finish DCMT", type: "OD_FINISH", diameter: 16, noseRadius: 0.4, color: "#22c55e" },
  { number: 3,  label: "Groove 3mm",    type: "GROOVE",    diameter: 20, noseRadius: 0.1, color: "#3b82f6" },
  { number: 4,  label: "Thread 60°",    type: "THREAD",    diameter: 20, noseRadius: 0.1, color: "#8b5cf6" },
  { number: 5,  label: "Bore Bar ID",   type: "BORE",      diameter: 16, noseRadius: 0.4, color: "#06b6d4" },
  { number: 6,  label: "Drill Ø20",     type: "DRILL",     diameter: 20, noseRadius: 0,   color: "#ef4444" },
  { number: 7,  label: "Cutoff 2mm",    type: "CUTOFF",    diameter: 16, noseRadius: 0.1, color: "#f97316" },
  { number: 8,  label: "ID Groove",     type: "GROOVE",    diameter: 16, noseRadius: 0.1, color: "#84cc16" },
  { number: 9,  label: "(Empty)",       type: "NONE",       color: "#374151" },
  { number: 10, label: "(Empty)",       type: "NONE",       color: "#374151" },
  { number: 11, label: "(Empty)",       type: "NONE",       color: "#374151" },
  { number: 12, label: "(Empty)",       type: "NONE",       color: "#374151" },
];

const MATERIAL_DATA: Record<Material, { label: string; vc: number; f: number; doc: number }> = {
  GI:         { label: "Galvanized Steel",  vc: 120, f: 0.20, doc: 2.0 },
  CR:         { label: "Cold Rolled Steel", vc: 160, f: 0.25, doc: 2.5 },
  HR:         { label: "Hot Rolled Steel",  vc: 130, f: 0.25, doc: 3.0 },
  SS:         { label: "Stainless 304",     vc: 90,  f: 0.12, doc: 1.5 },
  AL:         { label: "Aluminium 6061",    vc: 350, f: 0.20, doc: 3.0 },
  MS:         { label: "Mild Steel",        vc: 150, f: 0.25, doc: 2.5 },
  CAST_IRON:  { label: "Cast Iron",         vc: 100, f: 0.30, doc: 3.5 },
  TI:         { label: "Titanium",          vc: 50,  f: 0.08, doc: 0.8 },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProLatheSimulator() {
  const [gcodeText, setGcodeText]         = useState(DEFAULT_GCODE);
  const [controller, setController]       = useState<Controller>("fanuc");
  const [postOutput, setPostOutput]       = useState("");
  const [showPost, setShowPost]           = useState(false);
  const [rightPanel, setRightPanel]       = useState<SimPanel>("turret");
  const [activeToolSlot, setActiveToolSlot] = useState(1);
  const [tools, setTools]                 = useState<ToolSlot[]>(DEFAULT_TOOLS);
  const [stockDia, setStockDia]           = useState(80);
  const [stockLen, setStockLen]           = useState(120);
  const [material, setMaterial]           = useState<Material>("GI");
  const [calcDia, setCalcDia]             = useState(80);
  const [calcVc, setCalcVc]               = useState(120);
  const [calcFeed, setCalcFeed]           = useState(0.2);
  const [calcDoc, setCalcDoc]             = useState(2.0);   // depth of cut mm
  const [calcLen, setCalcLen]             = useState(100);   // cutting length mm
  const [calcNose, setCalcNose]           = useState(0.8);   // insert nose radius mm
  const [refSearch, setRefSearch]         = useState("");
  const [copied, setCopied]               = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [highlightedLine, setHighlightedLine] = useState(0);

  const { blocks, moves, alarms } = useMemo(() => parseLatheGCode(gcodeText), [gcodeText]);

  const activeTool = tools.find(t => t.number === activeToolSlot) ?? tools[0];

  // ── Cutting Calculator — 100% accurate engineering formulas ──────────────
  // RPM:  N = (1000 × Vc) / (π × D)          [ISO/Fanuc standard]
  // MRR:  = Vc × 1000 × f × ap  (mm³/min)    [ap = depth of cut]
  // Ra:   = f² / (8 × re)  (mm → µm × 1000)  [theoretical surface roughness]
  // Tc:   = L / (N × f)  (min → sec × 60)    [cutting time, 1 pass]
  const calcRPM    = useMemo(() => Math.round((calcVc * 1000) / (Math.PI * calcDia)), [calcVc, calcDia]);
  const calcMRR    = useMemo(() => calcVc * 1000 * calcFeed * calcDoc, [calcVc, calcFeed, calcDoc]);
  const calcRa     = useMemo(() => (calcFeed * calcFeed) / (8 * Math.max(calcNose, 0.01)) * 1000, [calcFeed, calcNose]);
  const calcTcSec  = useMemo(() => calcRPM > 0 ? (calcLen / (calcRPM * calcFeed)) * 60 : 0, [calcLen, calcRPM, calcFeed]);
  const cycleEst   = useMemo(() => moves.filter(m => m.type === "cut").length * 0.8, [moves]);

  const toolGeo: ToolGeometry = useMemo(() => ({
    holderWidth: 12, holderHeight: 12, holderLength: 40,
    insertNoseRadius: activeTool.noseRadius ?? 0.8,
    insertLength: 16, insertAngleDeg: 55,
  }), [activeTool]);

  const workpiece: WorkpieceGeometry = useMemo(() => ({
    stockRadius: stockDia / 2, stockLength: stockLen,
    boreDiameter: stockDia * 0.35, chuckLength: 50,
    finishRadius: stockDia * 0.4,
    grooves: [
      { zCenter: -stockLen * 0.45, depth: stockDia * 0.08, width: stockDia * 0.1, radius: 2 },
      { zCenter: -stockLen * 0.7,  depth: stockDia * 0.1,  width: stockDia * 0.12, radius: 3 },
    ],
  }), [stockDia, stockLen]);

  const preFlightIssues = useMemo(() => {
    if (moves.length < 2) return [];
    return runFullPreFlightCheck(
      moves.map(m => ({ x: m.x, z: m.z, type: m.type })),
      toolGeo, workpiece
    );
  }, [moves, toolGeo, workpiece]);

  const criticals = preFlightIssues.filter(r => r.severity === "critical").length;
  const warnings  = preFlightIssues.filter(r => r.severity === "warning").length;

  const handleRunPost = useCallback(() => {
    const output = postProcess(gcodeText, controller);
    setPostOutput(output);
    setShowPost(true);
  }, [gcodeText, controller]);

  const handleCopyPost = useCallback(async () => {
    await navigator.clipboard.writeText(postOutput).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [postOutput]);

  const handleDownloadPost = useCallback(() => {
    const blob = new Blob([postOutput], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `program_${controller.toUpperCase()}.nc`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [postOutput, controller]);

  const handleImportGcode = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".nc,.txt,.gcode,.tap,.cnc";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { setGcodeText(ev.target?.result as string ?? ""); };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const filteredRef = useMemo(() => {
    const q = refSearch.toLowerCase();
    return GCODE_REF.filter(r => !q || r.code.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q));
  }, [refSearch]);

  const lineCount = gcodeText.split("\n").length;

  return (
    <div className="flex flex-col h-full bg-[#060810] text-white overflow-hidden">

      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#080c14] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">Pro CNC Lathe Simulator</h1>
            <p className="text-[10px] text-zinc-500">3D Simulation · Post-Processor · Collision Verify · G-Code Reference</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Workpiece setup */}
          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-zinc-500">⌀</span>
            <input
              type="number" value={stockDia} onChange={e => setStockDia(+e.target.value)}
              className="w-12 bg-transparent text-xs text-cyan-400 text-right focus:outline-none"
              min={10} max={300}
            />
            <span className="text-[10px] text-zinc-600">mm ×</span>
            <input
              type="number" value={stockLen} onChange={e => setStockLen(+e.target.value)}
              className="w-14 bg-transparent text-xs text-cyan-400 text-right focus:outline-none"
              min={20} max={500}
            />
            <span className="text-[10px] text-zinc-600">mm</span>
          </div>

          <select
            value={material}
            onChange={e => { setMaterial(e.target.value as Material); setCalcVc(MATERIAL_DATA[e.target.value as Material].vc); setCalcFeed(MATERIAL_DATA[e.target.value as Material].f); }}
            className="h-8 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 text-xs text-zinc-300 focus:outline-none"
          >
            {Object.entries(MATERIAL_DATA).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {/* Status badges */}
          <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border ${criticals > 0 ? "bg-red-900/20 border-red-500/30 text-red-400" : warnings > 0 ? "bg-yellow-900/20 border-yellow-500/30 text-yellow-400" : "bg-green-900/20 border-green-500/30 text-green-400"}`}>
            {criticals > 0 ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
            {criticals > 0 ? `${criticals} CRITICAL` : warnings > 0 ? `${warnings} WARN` : "VERIFIED"}
          </div>

          <div className="text-[10px] text-zinc-600 px-2">{moves.length} moves · {lineCount} lines</div>
        </div>
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: G-Code Editor + Post-Processor ─────────────────────── */}
        <div className="flex flex-col border-r border-white/[0.06] bg-[#070b12]" style={{ width: editorCollapsed ? 40 : 360 }}>

          {editorCollapsed ? (
            <button onClick={() => setEditorCollapsed(false)}
              className="flex-1 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {/* Editor header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[11px] font-semibold text-zinc-300">G-Code Editor</span>
                  {alarms.length > 0 && (
                    <span className="bg-yellow-900/30 text-yellow-400 text-[9px] px-1.5 py-0.5 rounded border border-yellow-500/20">
                      {alarms.length} WARN
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={handleImportGcode} title="Import file"
                    className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditorCollapsed(true)}
                    className="p-1 text-zinc-600 hover:text-zinc-400 transition-colors">
                    <ChevronDown className="w-3.5 h-3.5 rotate-90" />
                  </button>
                </div>
              </div>

              {/* Alarms */}
              {alarms.length > 0 && (
                <div className="px-3 py-1.5 bg-yellow-900/10 border-b border-yellow-500/10">
                  {alarms.slice(0, 2).map((a, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[9px] text-yellow-400">
                      <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span className="truncate">{a}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Editor textarea with line numbers */}
              <div className="flex flex-1 overflow-hidden min-h-0">
                <div className="flex-shrink-0 w-8 py-1 bg-[#050810] border-r border-white/[0.04] text-right overflow-hidden select-none">
                  {gcodeText.split("\n").map((_, i) => (
                    <div key={i} className={`px-1.5 text-[9px] font-mono leading-[18px] ${i + 1 === highlightedLine ? "text-orange-400" : "text-zinc-700"}`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  value={gcodeText}
                  onChange={e => setGcodeText(e.target.value)}
                  onKeyDown={e => {
                    const pos = (e.target as HTMLTextAreaElement).selectionStart;
                    const line = gcodeText.slice(0, pos).split("\n").length;
                    setHighlightedLine(line);
                  }}
                  onClick={e => {
                    const pos = (e.target as HTMLTextAreaElement).selectionStart;
                    const line = gcodeText.slice(0, pos).split("\n").length;
                    setHighlightedLine(line);
                  }}
                  spellCheck={false}
                  className="flex-1 bg-transparent text-[11px] font-mono text-zinc-300 resize-none focus:outline-none px-2 py-1 leading-[18px] overflow-auto"
                  style={{ lineHeight: "18px" }}
                />
              </div>

              {/* ── Post-Processor Panel ──────────────────────────── */}
              <div className="border-t border-white/[0.06] flex-shrink-0">
                <div className="px-3 py-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Code2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-semibold text-zinc-300">Post-Processor</span>
                  </div>

                  {/* Controller selector */}
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {(Object.entries(CONTROLLER_INFO) as [Controller, typeof CONTROLLER_INFO[Controller]][]).map(([key, info]) => (
                      <button key={key}
                        onClick={() => setController(key)}
                        className={`text-left px-2 py-1.5 rounded-lg border text-[9px] transition-all ${controller === key ? "border-orange-500/40 bg-orange-500/10 text-orange-300" : "border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-300 hover:border-white/10"}`}
                      >
                        <div className="font-semibold truncate" style={{ color: controller === key ? info.color : undefined }}>{info.label}</div>
                        <div className="text-zinc-600 truncate mt-0.5">{info.desc.split("—")[0]}</div>
                      </button>
                    ))}
                  </div>

                  <button onClick={handleRunPost}
                    className="w-full h-8 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all">
                    <Zap className="w-3.5 h-3.5" /> Generate Post Output
                  </button>
                </div>

                {showPost && postOutput && (
                  <div className="max-h-[180px] flex flex-col">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.04]">
                      <span className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider">
                        {CONTROLLER_INFO[controller].label} Output
                      </span>
                      <div className="flex items-center gap-1">
                        <button onClick={handleCopyPost}
                          className={`text-[9px] px-2 py-0.5 rounded border transition-all ${copied ? "border-green-500/40 text-green-400" : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"}`}>
                          {copied ? "✓ Copied" : <><Copy className="w-2.5 h-2.5 inline mr-0.5" />Copy</>}
                        </button>
                        <button onClick={handleDownloadPost}
                          className="text-[9px] px-2 py-0.5 rounded border border-white/[0.06] text-zinc-500 hover:text-zinc-300 transition-all">
                          <Download className="w-2.5 h-2.5 inline mr-0.5" />.NC
                        </button>
                        <button onClick={() => setShowPost(false)} className="text-zinc-600 hover:text-zinc-400 ml-1">✕</button>
                      </div>
                    </div>
                    <pre className="flex-1 overflow-auto px-3 py-1.5 text-[9px] font-mono text-emerald-300 leading-relaxed bg-[#040608]">
                      {postOutput}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── CENTER: 3D Simulation ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <LatheSimulator3D
            moves={moves.length > 1 ? moves : []}
            stockDiameter={stockDia}
            stockLength={stockLen}
            chuckLength={50}
            gcodeLines={moves.map(m => m.gcodeLine ?? "")}
          />
        </div>

        {/* ── RIGHT: Tools / Reference / Calculator / Verify ────────────── */}
        <div className="flex flex-col border-l border-white/[0.06] bg-[#070b12] w-[280px] flex-shrink-0">

          {/* Right panel tab bar */}
          <div className="flex border-b border-white/[0.06] flex-shrink-0">
            {([
              { id: "turret",     icon: <Layers className="w-3 h-3" />,     label: "Turret" },
              { id: "calculator", icon: <Calculator className="w-3 h-3" />, label: "Calc" },
              { id: "reference",  icon: <BookOpen className="w-3 h-3" />,   label: "Ref" },
              { id: "verify",     icon: <Shield className="w-3 h-3" />,     label: "Verify" },
            ] as { id: SimPanel; icon: React.ReactNode; label: string }[]).map(tab => (
              <button key={tab.id}
                onClick={() => setRightPanel(tab.id)}
                className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-[9px] transition-all border-b-2 ${rightPanel === tab.id ? "text-orange-400 border-orange-500" : "text-zinc-600 border-transparent hover:text-zinc-400"}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Turret Panel ─────────────────────────────────── */}
          {rightPanel === "turret" && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center">
                  <Wrench className="w-3 h-3 text-orange-400" />
                </div>
                <span className="text-[11px] font-semibold text-zinc-300">12-Position Turret</span>
              </div>

              {/* Turret visual */}
              <div className="relative w-40 h-40 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-zinc-700 bg-[#0d1520]" />
                <div className="absolute inset-4 rounded-full border border-zinc-800 bg-[#080c14]" />
                {tools.map((tool, i) => {
                  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
                  const r = 52;
                  const x = 80 + r * Math.cos(angle);
                  const y = 80 + r * Math.sin(angle);
                  const isActive = tool.number === activeToolSlot;
                  return (
                    <button key={tool.number}
                      onClick={() => setActiveToolSlot(tool.number)}
                      title={`T${String(tool.number).padStart(2, "0")} — ${tool.label}`}
                      style={{ left: x - 12, top: y - 12 }}
                      className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold transition-all border ${isActive ? "scale-125 shadow-lg border-orange-400 text-orange-300" : "border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"}`}
                    >
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: tool.color + (isActive ? "33" : "11") }} />
                      <span className="relative">{tool.number}</span>
                    </button>
                  );
                })}
                {/* Center label */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-orange-400">T{String(activeToolSlot).padStart(2, "0")}</div>
                    <div className="text-[8px] text-zinc-600">Active</div>
                  </div>
                </div>
              </div>

              {/* Tool list */}
              <div className="space-y-1">
                {tools.map(tool => (
                  <button key={tool.number}
                    onClick={() => setActiveToolSlot(tool.number)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all text-left ${activeToolSlot === tool.number ? "border-orange-500/30 bg-orange-500/8" : "border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02]"}`}
                  >
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tool.color }} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-[10px] font-semibold truncate ${activeToolSlot === tool.number ? "text-orange-300" : "text-zinc-400"}`}>
                        T{String(tool.number).padStart(2, "0")} {tool.label}
                      </div>
                      {tool.type !== "NONE" && (
                        <div className="text-[9px] text-zinc-600">
                          {tool.type.replace("_", " ")} {tool.noseRadius ? `· R${tool.noseRadius}` : ""}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Cutting Calculator ──────────────────────────── */}
          {rightPanel === "calculator" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-cyan-400" />
                <span className="text-[11px] font-semibold text-zinc-300">Cutting Parameters</span>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-[10px] text-zinc-500 mb-1 block">Workpiece Diameter (mm)</span>
                  <input type="range" min={10} max={300} value={calcDia} onChange={e => setCalcDia(+e.target.value)}
                    className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                    <span>10</span><span className="text-cyan-400 font-bold">{calcDia} mm</span><span>300</span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] text-zinc-500 mb-1 block">Cutting Speed Vc (m/min)</span>
                  <input type="range" min={10} max={500} value={calcVc} onChange={e => setCalcVc(+e.target.value)}
                    className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                    <span>10</span><span className="text-cyan-400 font-bold">{calcVc} m/min</span><span>500</span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] text-zinc-500 mb-1 block">Feed Rate f (mm/rev)</span>
                  <input type="range" min={0.01} max={1.0} step={0.01} value={calcFeed} onChange={e => setCalcFeed(+e.target.value)}
                    className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                    <span>0.01</span><span className="text-cyan-400 font-bold">{calcFeed.toFixed(2)} mm/rev</span><span>1.0</span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] text-zinc-500 mb-1 block">Depth of Cut ap (mm)</span>
                  <input type="range" min={0.1} max={10} step={0.1} value={calcDoc} onChange={e => setCalcDoc(+e.target.value)}
                    className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                    <span>0.1</span><span className="text-cyan-400 font-bold">{calcDoc.toFixed(1)} mm</span><span>10</span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] text-zinc-500 mb-1 block">Insert Nose Radius re (mm)</span>
                  <input type="range" min={0.2} max={2.4} step={0.2} value={calcNose} onChange={e => setCalcNose(+e.target.value)}
                    className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                    <span>0.2</span><span className="text-cyan-400 font-bold">r{calcNose.toFixed(1)}</span><span>2.4</span>
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] text-zinc-500 mb-1 block">Cutting Length L (mm)</span>
                  <input type="range" min={10} max={500} step={5} value={calcLen} onChange={e => setCalcLen(+e.target.value)}
                    className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
                    <span>10</span><span className="text-cyan-400 font-bold">{calcLen} mm</span><span>500</span>
                  </div>
                </label>
              </div>

              {/* Results */}
              <div className="space-y-2 bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <div className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-2">Calculated Results</div>
                {[
                  { label: "Spindle RPM  [N = 1000Vc / πD]", value: `${calcRPM} rpm`, color: "text-amber-400" },
                  { label: "Feed Rate  [F = N × f]", value: `${(calcRPM * calcFeed).toFixed(0)} mm/min`, color: "text-orange-400" },
                  { label: "Chip Load", value: `${calcFeed.toFixed(3)} mm/rev`, color: "text-cyan-400" },
                  { label: "Surface Speed Vc", value: `${calcVc} m/min`, color: "text-green-400" },
                  { label: "MRR  [Vc×1000×f×ap]", value: `${(calcMRR / 1000).toFixed(1)} cm³/min`, color: "text-purple-400" },
                  { label: "Ra  [f²/(8×re)]", value: `${calcRa.toFixed(2)} µm`, color: "text-pink-400" },
                  { label: "Cutting Time  [L/(N×f)]", value: `${calcTcSec.toFixed(1)} sec`, color: "text-sky-400" },
                ].map(r => (
                  <div key={r.label} className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500">{r.label}</span>
                    <span className={`text-[11px] font-bold font-mono tabular-nums ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Material recommendation */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <div className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-2">
                  Recommended for {MATERIAL_DATA[material].label}
                </div>
                {[
                  { label: "Vc",   value: `${MATERIAL_DATA[material].vc} m/min` },
                  { label: "Feed", value: `${MATERIAL_DATA[material].f} mm/rev` },
                  { label: "DoC",  value: `${MATERIAL_DATA[material].doc} mm` },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-[10px] text-zinc-500">{r.label}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">{r.value}</span>
                  </div>
                ))}
              </div>

              {/* G-code snippet */}
              <div className="bg-[#040608] border border-white/[0.06] rounded-xl p-2.5">
                <div className="text-[9px] text-zinc-600 mb-1.5 uppercase tracking-wider">G-Code Snippet</div>
                <pre className="text-[9px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap">
{`G96 S${calcVc} M03
G00 X${calcDia + 4}.0 Z2.0
G01 Z-${stockLen * 0.9}.0 F${calcFeed.toFixed(2)}
G00 X${calcDia + 10}.0
G28 U0. W0.`}
                </pre>
              </div>
            </div>
          )}

          {/* ── G-Code Reference ─────────────────────────────── */}
          {rightPanel === "reference" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-3 pt-3 pb-2 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span className="text-[11px] font-semibold text-zinc-300">G/M Code Reference</span>
                </div>
                <input
                  type="text"
                  placeholder="Search codes..."
                  value={refSearch}
                  onChange={e => setRefSearch(e.target.value)}
                  className="w-full h-7 px-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-white/20"
                />
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                {filteredRef.map(r => (
                  <div key={r.code}
                    className={`p-2 rounded-lg border cursor-pointer hover:border-white/10 transition-all ${r.type === "G" ? "border-cyan-900/30 bg-cyan-900/5" : "border-purple-900/30 bg-purple-900/5"}`}
                    onClick={() => setGcodeText(prev => prev + "\n" + r.example)}
                    title="Click to insert"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[11px] font-bold font-mono ${r.type === "G" ? "text-cyan-400" : "text-purple-400"}`}>{r.code}</span>
                      <span className="text-[8px] text-zinc-700 bg-white/[0.04] px-1 rounded">{r.type}-code</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">{r.desc}</div>
                    <div className="text-[9px] text-zinc-600 font-mono mt-0.5 truncate">{r.example}</div>
                  </div>
                ))}
                {filteredRef.length === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-xs">No codes found</div>
                )}
              </div>
              <div className="px-3 pb-2 text-[9px] text-zinc-700 text-center flex-shrink-0">
                Click any code to insert at cursor
              </div>
            </div>
          )}

          {/* ── Pre-Flight Verify ─────────────────────────────── */}
          {rightPanel === "verify" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-[11px] font-semibold text-zinc-300">Pre-Flight Check</span>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Moves", val: moves.length, color: "text-cyan-400" },
                  { label: "Critical", val: criticals, color: criticals > 0 ? "text-red-400" : "text-green-400" },
                  { label: "Warnings", val: warnings, color: warnings > 0 ? "text-yellow-400" : "text-green-400" },
                ].map(s => (
                  <div key={s.label} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-2 text-center">
                    <div className={`text-lg font-bold tabular-nums ${s.color}`}>{s.val}</div>
                    <div className="text-[9px] text-zinc-600">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Parse alarms */}
              {alarms.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-yellow-400/70 font-bold">Parse Alarms</div>
                  {alarms.map((a, i) => (
                    <div key={i} className="flex items-start gap-1.5 bg-yellow-900/10 border border-yellow-500/10 rounded-lg p-2">
                      <AlertCircle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-[9px] text-yellow-300">{a}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Collision results */}
              {preFlightIssues.length > 0 ? (
                <div className="space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-red-400/70 font-bold">Collision / Travel Issues</div>
                  {preFlightIssues.slice(0, 15).map((r, i) => (
                    <div key={i} className={`flex items-start gap-1.5 rounded-lg p-2 border ${r.severity === "critical" ? "bg-red-900/10 border-red-500/20" : "bg-yellow-900/10 border-yellow-500/10"}`}>
                      <AlertTriangle className={`w-3 h-3 flex-shrink-0 mt-0.5 ${r.severity === "critical" ? "text-red-400" : "text-yellow-400"}`} />
                      <div className="min-w-0">
                        <div className={`text-[9px] font-semibold ${r.severity === "critical" ? "text-red-300" : "text-yellow-300"}`}>
                          {r.severity.toUpperCase()}
                        </div>
                        <div className="text-[9px] text-zinc-500 truncate">{r.description}</div>
                      </div>
                    </div>
                  ))}
                  {preFlightIssues.length > 15 && (
                    <div className="text-[9px] text-zinc-600 text-center">+{preFlightIssues.length - 15} more…</div>
                  )}
                </div>
              ) : moves.length > 1 ? (
                <div className="flex items-center gap-2 bg-green-900/10 border border-green-500/20 rounded-xl p-3">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <div>
                    <div className="text-[11px] font-semibold text-green-300">All Clear</div>
                    <div className="text-[9px] text-zinc-500">No collisions or over-travel detected</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-600 text-xs">
                  Enter G-code and run simulation to verify
                </div>
              )}

              {/* Program stats */}
              {moves.length > 1 && (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 space-y-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-zinc-600 font-bold mb-2">Program Stats</div>
                  {[
                    { label: "Total Moves",     val: moves.length },
                    { label: "Cut Moves",        val: moves.filter(m => m.type === "cut").length },
                    { label: "Rapid Moves",      val: moves.filter(m => m.type === "rapid").length },
                    { label: "G-Code Lines",     val: lineCount },
                    { label: "Est. Cycle Time",  val: `~${cycleEst.toFixed(1)}s` },
                  ].map(s => (
                    <div key={s.label} className="flex justify-between">
                      <span className="text-[10px] text-zinc-500">{s.label}</span>
                      <span className="text-[10px] text-zinc-300 font-mono">{s.val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
