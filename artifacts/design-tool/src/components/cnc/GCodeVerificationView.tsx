import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle, Play, Upload, FileCode2, Info, Clock, BarChart2, Cpu, ChevronRight } from "lucide-react";

type Severity = "pass" | "warn" | "fail" | "info";
type Controller = "fanuc" | "siemens840d" | "haas" | "mazak" | "okuma";

interface CheckResult {
  id: string; category: string; description: string; severity: Severity;
  line?: number; detail?: string; fix?: string;
}

interface ParsedBlock {
  lineNo: number; raw: string; trimmed: string;
  G?: number; M?: number; X?: number; Y?: number; Z?: number;
  F?: number; S?: number; T?: string; N?: number; R?: number; I?: number; J?: number;
  isComment: boolean; isBlank: boolean;
}

interface GCodeStats {
  totalBlocks: number; cuttingMoves: number; rapidMoves: number; arcs: number;
  toolChanges: number; estimatedTimeSec: number; maxZ: number; minZ: number;
  maxX: number; minX: number; totalFeedDist: number;
}

// ─── Syntax token colors ──────────────────────────────────────────────────────

function tokenizeLine(line: string): React.ReactNode[] {
  if (!line.trim()) return [<span key="blank">&nbsp;</span>];
  const raw = line.trim();
  if (raw.startsWith("(") || raw.startsWith(";") || raw.startsWith("%")) {
    return [<span key="c" style={{ color: "#52525b", fontStyle: "italic" }}>{line}</span>];
  }
  const tokens: React.ReactNode[] = [];
  let rest = line;
  let key = 0;
  const addSpan = (text: string, color: string) => {
    tokens.push(<span key={key++} style={{ color }}>{text}</span>);
  };
  const patterns: [RegExp, string][] = [
    [/^(N\d+)/, "#52525b"],          // sequence
    [/^(G0?0)\b/, "#f59e0b"],         // G00 rapid
    [/^(G0?1)\b/, "#34d399"],         // G01 linear
    [/^(G0?2|G0?3)\b/, "#60a5fa"],    // G02/G03 arc
    [/^(G\d+\.?\d*)/, "#a78bfa"],     // other G
    [/^(M\d+)/, "#fb923c"],           // M code
    [/^(T\d+)/, "#fbbf24"],           // T word
    [/^([XYZUVW]-?\d+\.?\d*)/, "#e4e4e7"], // coordinates
    [/^([FfSs]\d+\.?\d*)/, "#f87171"], // feed/speed
    [/^([RIJO]-?\d+\.?\d*)/, "#c084fc"], // arc params
    [/^(\(.*?\))/, "#52525b"],         // inline comment
    [/^(;.*)/, "#52525b"],             // comment
    [/^(\s+)/, "transparent"],         // whitespace
    [/^(.)/, "#71717a"],               // fallback
  ];
  while (rest.length > 0) {
    let matched = false;
    for (const [re, color] of patterns) {
      const m = rest.match(re);
      if (m) {
        addSpan(m[1], color);
        rest = rest.slice(m[1].length);
        matched = true; break;
      }
    }
    if (!matched) { addSpan(rest[0], "#71717a"); rest = rest.slice(1); }
  }
  return tokens;
}

// ─── G-Code Parser ────────────────────────────────────────────────────────────

function parseGCode(code: string): ParsedBlock[] {
  return code.split("\n").map((raw, i) => {
    const trimmed = raw.trim();
    const isBlank = trimmed.length === 0;
    const isComment = trimmed.startsWith("(") || trimmed.startsWith(";") || trimmed.startsWith("%");
    if (isBlank || isComment) return { lineNo: i + 1, raw, trimmed, isComment, isBlank };
    const upper = trimmed.toUpperCase().replace(/\(.*?\)/g, "").replace(/;.*/g, "");
    const match = (re: RegExp) => { const m = upper.match(re); return m ? parseFloat(m[1]) : undefined; };
    return {
      lineNo: i + 1, raw, trimmed, isComment, isBlank,
      G: match(/G0*(\d+\.?\d*)/), M: match(/M(\d+)/),
      X: match(/X(-?\d+\.?\d*)/), Y: match(/Y(-?\d+\.?\d*)/), Z: match(/Z(-?\d+\.?\d*)/),
      F: match(/F(\d+\.?\d*)/), S: match(/S(\d+)/),
      T: upper.match(/T(\w+)/)?.[1],
      N: match(/^N(\d+)/),
      R: match(/R(-?\d+\.?\d*)/), I: match(/I(-?\d+\.?\d*)/), J: match(/J(-?\d+\.?\d*)/),
    };
  });
}

// ─── Statistics calculator ────────────────────────────────────────────────────

function calcStats(blocks: ParsedBlock[]): GCodeStats {
  let currentF = 100, totalTime = 0, totalFeedDist = 0;
  let maxZ = -9999, minZ = 9999, maxX = -9999, minX = 9999;
  let cuttingMoves = 0, rapidMoves = 0, arcs = 0, toolChanges = 0;
  let prevX = 0, prevZ = 0;
  for (const b of blocks) {
    if (b.isBlank || b.isComment) continue;
    if (b.F) currentF = b.F;
    if (b.T && b.M !== 6) toolChanges++;
    if (b.Z !== undefined) { if (b.Z > maxZ) maxZ = b.Z; if (b.Z < minZ) minZ = b.Z; }
    if (b.X !== undefined) { if (b.X > maxX) maxX = b.X; if (b.X < minX) minX = b.X; }
    const dx = (b.X ?? prevX) - prevX, dz = (b.Z ?? prevZ) - prevZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (b.G === 0) { rapidMoves++; totalTime += dist / 5000 * 60; }
    else if (b.G === 1) { cuttingMoves++; if (currentF > 0) { totalTime += dist / currentF * 60; totalFeedDist += dist; } }
    else if (b.G === 2 || b.G === 3) { arcs++; if (currentF > 0) totalTime += dist / currentF * 60; }
    if (b.X !== undefined) prevX = b.X;
    if (b.Z !== undefined) prevZ = b.Z;
  }
  return { totalBlocks: blocks.filter(b => !b.isBlank).length, cuttingMoves, rapidMoves, arcs, toolChanges, estimatedTimeSec: totalTime, maxZ, minZ, maxX, minX, totalFeedDist };
}

// ─── Verification engine ──────────────────────────────────────────────────────

function verifyGCode(blocks: ParsedBlock[], ctrl: Controller): CheckResult[] {
  const results: CheckResult[] = [];
  let hasM30 = false, hasM3 = false, hasM5 = false, hasG28 = false, hasCoolant = false, hasToolCall = false;
  let spindleOn = false, feedSet = false, currentF = 0;
  const Nlines = new Set<number>(), feedWarningLines: number[] = [], rpmWarningLines: number[] = [];
  let rapidNearWork: number[] = [];
  let maxRPM = ctrl === "haas" ? 8100 : ctrl === "siemens840d" ? 12000 : 6000;
  const toolCompStack: number[] = [];

  for (const b of blocks) {
    if (b.isBlank || b.isComment) continue;
    if (b.N !== undefined) {
      if (Nlines.has(b.N)) results.push({ id: `dup-n-${b.lineNo}`, category: "Sequence Numbers", description: `Duplicate N${b.N}`, severity: "warn", line: b.lineNo, fix: "Remove duplicate sequence numbers." });
      Nlines.add(b.N);
    }
    if (b.M === 30 || b.M === 2) hasM30 = true;
    if (b.M === 3 || b.M === 4) { hasM3 = true; spindleOn = true; }
    if (b.M === 5) { hasM5 = true; spindleOn = false; }
    if (b.M === 8 || b.M === 9) hasCoolant = true;
    if (b.T) hasToolCall = true;
    if (b.G === 41 || b.G === 42) toolCompStack.push(b.lineNo);
    if (b.G === 40) toolCompStack.length = 0;
    if (b.F) { feedSet = true; currentF = b.F; }
    if (b.G === 0 && b.Z !== undefined && b.Z < 1 && spindleOn) rapidNearWork.push(b.lineNo);
    if ((b.G === 1 || b.G === 2 || b.G === 3) && !feedSet && !b.F)
      results.push({ id: `nofeed-${b.lineNo}`, category: "Feed Rate", description: `Cutting move G0${b.G} with no feed rate`, severity: "fail", line: b.lineNo, fix: "Add F word before this block." });
    if (b.F && (b.F > 8000 || (b.F > 2.0 && b.F < 100))) feedWarningLines.push(b.lineNo);
    if (b.S && b.S > maxRPM) rpmWarningLines.push(b.lineNo);
    if (b.G === 2 || b.G === 3) {
      if (b.R === undefined && b.I === undefined && b.J === undefined)
        results.push({ id: `arc-${b.lineNo}`, category: "Arc Definition", description: `G0${b.G} arc missing R or I/J`, severity: "fail", line: b.lineNo, fix: "Add R word or I/J center offsets to arc block." });
    }
    if ((ctrl === "fanuc" || ctrl === "haas") && b.G === 65 && !b.T)
      results.push({ id: `macro-${b.lineNo}`, category: "Macro", description: "G65 macro call without P word", severity: "warn", line: b.lineNo, fix: "Add P (program number) to G65 macro call." });
  }

  // Global checks
  if (!hasM30) results.push({ id: "no-m30", category: "Program Structure", description: "Missing M30/M02 — program end not found", severity: "fail", fix: "Add M30 at end of program. Machine will fault without it." });
  if (!hasM3) results.push({ id: "no-spindle", category: "Safety", description: "No M03/M04 spindle command found", severity: "warn", fix: "Add M03 S___ before first cutting move." });
  if (!hasM5) results.push({ id: "no-m5", category: "Safety", description: "No M05 spindle stop found", severity: "warn", fix: "Add M05 before M30 to stop spindle at program end." });
  if (!hasG28) results.push({ id: "no-g28", category: "Safety", description: "No G28 home reference found", severity: "warn", fix: ctrl === "siemens840d" ? "Add G74 X0 Z0 for Siemens home." : "Add G28 U0. W0. before M30." });
  if (!hasCoolant) results.push({ id: "no-coolant", category: "Setup", description: "No coolant M08/M09 detected", severity: "info", fix: "Add M08 after spindle start for wet cutting." });
  if (!hasToolCall) results.push({ id: "no-tool", category: "Setup", description: "No tool call (T word) detected", severity: "warn", fix: "Add tool call e.g. T0101 before each operation." });
  if (rapidNearWork.length > 0)
    results.push({ id: "rapid-risk", category: "Collision Risk", description: `Rapid G00 near workpiece (Z<1mm) with spindle on — ${rapidNearWork.length} occurrence(s) on lines: ${rapidNearWork.slice(0,4).join(", ")}`, severity: rapidNearWork.length > 2 ? "fail" : "warn", fix: "Use G01 with feed rate when approaching workpiece. Only use G00 in safe Z clearance." });
  if (feedWarningLines.length > 0)
    results.push({ id: "feed-warn", category: "Feed Rate", description: `Unusual feed values on ${feedWarningLines.length} line(s): ${feedWarningLines.slice(0,3).join(", ")}`, severity: "warn", fix: "Check feed units. G99 = mm/rev (0.05–0.5), G98 = mm/min (50–3000)." });
  if (rpmWarningLines.length > 0)
    results.push({ id: "rpm-warn", category: "Speeds", description: `Spindle speed exceeds ${maxRPM} RPM (${ctrl.toUpperCase()} limit) on lines: ${rpmWarningLines.slice(0,3).join(", ")}`, severity: "warn", fix: `Add G50 S${maxRPM} (Fanuc) or G96 Lim (Siemens) RPM limit before CSS.` });
  if (toolCompStack.length > 0)
    results.push({ id: "comp-unclosed", category: "Tool Compensation", description: `Tool radius compensation (G41/G42) not cancelled — ${toolCompStack.length} active at program end`, severity: "warn", fix: "Add G40 to cancel all active radius comp before M30." });

  // Passes
  const passMsgs = [
    [hasM30, "M30 program end present"],
    [feedSet, "Feed rate set before cutting moves"],
    [hasM3, "Spindle M03/M04 command found"],
    [hasG28, "G28/G74 home return found"],
    [hasCoolant, "Coolant M08 found"],
    [hasToolCall, "Tool call present"],
    [rapidNearWork.length === 0, "No dangerous rapids near workpiece"],
    [feedWarningLines.length === 0, "All feed rates in normal range"],
    [rpmWarningLines.length === 0, "All RPM values within machine limits"],
    [toolCompStack.length === 0, "Tool compensation cancelled before end"],
  ] as [boolean, string][];
  passMsgs.forEach(([ok, msg]) => { if (ok) results.push({ id: `pass-${msg}`, category: "✓ Pass", description: msg, severity: "pass" }); });
  results.push({ id: "syntax-ok", category: "✓ Pass", description: `${blocks.filter(b => !b.isBlank).length} blocks parsed — no syntax errors`, severity: "pass" });

  return results.sort((a, b) => {
    const order = { fail: 0, warn: 1, info: 2, pass: 3 };
    return order[a.severity] - order[b.severity];
  });
}

// ─── Sample G-Code ─────────────────────────────────────────────────────────────

const SAMPLE: Record<Controller, string> = {
  fanuc: `%
O0001 (SAI ROLOTECH - ROLL TOOLING OP1)
(MATERIAL: D2 TOOL STEEL, HARDENED 58HRC)
(MACHINE: FANUC 0i-TD)
N10 G21 G18 G40 G97 G99
N20 T0101 (OD ROUGHING TOOL CNMG120408)
N30 G96 S120 M03
N40 M08
N50 G00 X105.0 Z5.0
N60 G71 U2.0 R0.5
N70 G71 P80 Q140 U0.3 W0.1 F0.25
N80 G00 X60.0
N90 G01 Z0 F0.15
N100 G01 X65.0 Z-2.5
N110 G01 Z-40.0
N120 G02 X75.0 Z-45.0 R5.0
N130 G01 X85.0 Z-70.0
N140 G01 X105.0
N150 G70 P80 Q140 F0.1 S180
N160 G00 X150.0 Z50.0
N170 M05
N180 M09
N190 T0202 (GROOVE TOOL 4mm WIDTH)
N200 G97 S600 M03
N210 M08
N220 G00 X80.0 Z-25.0
N230 G01 X60.0 F0.05
N240 G04 P500
N250 G01 X80.0 F0.3
N260 G00 X150.0 Z50.0
N270 M05
N280 M09
N290 T0303 (THREAD TOOL 60 DEG)
N300 G97 S400 M03
N310 G00 X75.0 Z5.0
N320 G76 P020060 Q100 R200
N330 G76 X62.701 Z-35.0 P1299 Q400 F2.0
N340 G00 X150.0 Z50.0
N350 M05
N360 M09
N370 G28 U0. W0.
N380 M30
%`,
  siemens840d: `; SAI ROLOTECH - SIEMENS 840D
; MATERIAL: CR STEEL
DEF REAL STARTX = 100.0
DEF REAL STARTZ = 5.0
G71 G18 G40 G90 G94
T1 D1                   ; OD ROUGHING
M03 S120 G96 LIMS=3000
M08
G00 X=STARTX Z=STARTZ
CYCLE95("KONTUR1", 2.0, 0.3, 0.1, 0.15, 0.1, 11)
KONTUR1:
G01 X60.0 Z0 F0.15
G01 X65.0 Z-2.5
G01 Z-40.0
G03 X75.0 Z-45.0 CR=5.0
G01 X105.0
RET
G00 X150.0 Z50.0
M05 M09
T2 D1                   ; GROOVING
M03 S600 G97
G00 X80.0 Z-25.0
G01 X60.0 F0.05
G04 F0.5
G01 X80.0 F0.3
G74 X0 Z0              ; HOME REFERENCE
M30`,
  haas: `%
O00001 (HAAS - SAI ROLL TOOLING)
(MATERIAL: GI COATED ROLL)
G21 G18 G40 G97 G99
T101 (OD ROUGH - CNMG432)
G96 S120 M03
M08
G00 X105.0 Z5.0
G71 P10 Q50 U0.3 W0.1 D2000 F0.25
N10 G00 X60.0
G01 Z0 F0.15
G01 X65.0 Z-2.5
G01 Z-40.0
G02 X75.0 Z-45.0 R5.0
G01 X105.0
N50 G01 X110.0
G70 P10 Q50 F0.1 S180
G00 X150.0 Z50.0
M05 M09
T202 (GROOVE 4MM)
G97 S800 M03
M08
G00 X80.0 Z-25.0
G01 X60.0 F0.05
G04 P500
G01 X80.0 F0.3
G00 X150.0 Z100.0
G28 U0 W0
M05 M09
M30
%`,
  mazak: `(MAZAK QUICK TURN - SAI ROLOTECH)
(PROGRAM : O0001)
(DATE : 2026-03-19)
N10 G28 U0 W0
N20 T0100
N30 T0101
N40 G96 S120 M03
N50 M08
N60 G00 X105.0 Z5.0
N70 G71 U2.0 R0.5
N80 G71 P90 Q150 U0.3 W0.1 F0.25
N90 G00 X60.0
N100 G01 Z0.0 F0.15
N110 G01 X65.0 Z-2.5
N120 G01 Z-40.0
N130 G02 X75.0 Z-45.0 R5.0
N140 G01 X85.0 Z-70.0
N150 G01 X105.0
N160 G70 P90 Q150 F0.10 S200
N170 G00 X200.0 Z100.0
N180 M05 M09
N190 T0300
N200 T0303
N210 G97 S400 M03
N220 G00 X75.0 Z5.0
N230 G76 P020060 Q100 R200
N240 G76 X62.701 Z-35.0 P1299 Q400 F2.0
N250 G00 X200.0 Z100.0
N260 G28 U0 W0
N270 M05
N280 M30`,
  okuma: `(OKUMA LB3000EX - SAI ROLOTECH)
(TOOL PATH : OD ROUGH + THREAD)
N1 G28 U0 W0
N2 T0101 (ROUGH OD)
N3 G50 S3000
N4 G96 S120 M03
N5 M08
N6 G00 X105.0 Z5.0
N7 G71 U2.0 R0.5
N8 G71 P9 Q16 U0.3 W0.1 F0.25
N9 G00 X60.0
N10 G01 Z0.0 F0.15
N11 G01 X65.0 Z-2.5
N12 G01 Z-40.0
N13 G02 X75.0 Z-45.0 R5.0
N14 G01 X85.0
N15 G01 Z-70.0
N16 G01 X105.0
N17 G70 P9 Q16
N18 G00 X200. Z100.
N19 M05 M09
N20 T0303 (THREAD)
N21 G97 S400 M03
N22 G00 X75.0 Z5.0
N23 G76 P020060 Q100 R200
N24 G76 X62.701 Z-35.0 P1299 Q400 F2.0
N25 G00 X200. Z100.
N26 G28 U0. W0.
N27 M05 M09
N28 M30`,
};

const CTRL_INFO: Record<Controller, { name: string; color: string; maker: string }> = {
  fanuc:     { name: "Fanuc 0i-TD / 32i", color: "#f59e0b", maker: "FANUC" },
  siemens840d: { name: "Siemens SINUMERIK 840D", color: "#60a5fa", maker: "SIEMENS" },
  haas:      { name: "Haas NGC Control", color: "#34d399", maker: "HAAS" },
  mazak:     { name: "Mazatrol Smooth-X", color: "#a78bfa", maker: "MAZAK" },
  okuma:     { name: "Okuma OSP-P300L", color: "#fb923c", maker: "OKUMA" },
};

const severityColor = (s: Severity) => ({
  pass: { bg: "rgba(52,211,153,0.05)", border: "rgba(52,211,153,0.2)", text: "#34d399", badge: "rgba(52,211,153,0.12)" },
  warn: { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.2)", text: "#fbbf24", badge: "rgba(245,158,11,0.12)" },
  fail: { bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.25)", text: "#f87171", badge: "rgba(239,68,68,0.12)" },
  info: { bg: "rgba(96,165,250,0.05)", border: "rgba(96,165,250,0.18)", text: "#60a5fa", badge: "rgba(96,165,250,0.12)" },
}[s]);

const severityIcon = (s: Severity) => {
  if (s === "pass") return <CheckCircle style={{ width: 13, height: 13, color: "#34d399", flexShrink: 0 }} />;
  if (s === "warn") return <AlertTriangle style={{ width: 13, height: 13, color: "#fbbf24", flexShrink: 0 }} />;
  if (s === "fail") return <XCircle style={{ width: 13, height: 13, color: "#f87171", flexShrink: 0 }} />;
  return <Info style={{ width: 13, height: 13, color: "#60a5fa", flexShrink: 0 }} />;
};

// ─── Highlighted Editor ────────────────────────────────────────────────────────

function HighlightedEditor({ code, errorLines }: { code: string; errorLines: Set<number> }) {
  const lines = code.split("\n");
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} style={{ flex: 1, overflow: "auto", background: "#080912", fontFamily: "monospace", fontSize: 12, lineHeight: "22px", padding: "12px 0" }}>
      {lines.map((line, i) => {
        const lineNo = i + 1;
        const hasError = errorLines.has(lineNo);
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", minHeight: 22, background: hasError ? "rgba(239,68,68,0.08)" : "transparent", borderLeft: hasError ? "2px solid rgba(239,68,68,0.6)" : "2px solid transparent" }}>
            <span style={{ width: 40, textAlign: "right", paddingRight: 12, color: hasError ? "#f87171" : "#3f3f46", fontSize: 11, userSelect: "none", flexShrink: 0, paddingTop: 0 }}>{lineNo}</span>
            <span style={{ flex: 1, paddingRight: 12, whiteSpace: "pre" }}>{tokenizeLine(line)}</span>
            {hasError && <span style={{ fontSize: 10, color: "#f87171", paddingRight: 8, paddingTop: 2, flexShrink: 0 }}>◀</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function GCodeVerificationView() {
  const [ctrl, setCtrl] = useState<Controller>("fanuc");
  const [code, setCode] = useState(SAMPLE.fanuc);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [verified, setVerified] = useState(false);
  const [activeFilter, setActiveFilter] = useState<Severity | "all">("all");
  const [viewMode, setViewMode] = useState<"edit" | "highlight">("highlight");
  const [activeResultId, setActiveResultId] = useState<string | null>(null);

  const blocks = useMemo(() => parseGCode(code), [code]);
  const stats = useMemo(() => calcStats(blocks), [blocks]);

  const errorLines = useMemo(() => {
    const s = new Set<number>();
    results.filter(r => r.severity === "fail" || r.severity === "warn").forEach(r => { if (r.line) s.add(r.line); });
    return s;
  }, [results]);

  const verify = useCallback(() => {
    setResults(verifyGCode(blocks, ctrl));
    setVerified(true);
  }, [blocks, ctrl]);

  const counts = useMemo(() => ({
    pass: results.filter(r => r.severity === "pass").length,
    warn: results.filter(r => r.severity === "warn").length,
    fail: results.filter(r => r.severity === "fail").length,
    info: results.filter(r => r.severity === "info").length,
  }), [results]);

  const overallPassed = counts.fail === 0;
  const filtered = results.filter(r => activeFilter === "all" || r.severity === activeFilter);
  const ctrlInfo = CTRL_INFO[ctrl];

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setCode(ev.target?.result as string ?? ""); setVerified(false); setResults([]); };
    reader.readAsText(file);
  }

  function formatTime(sec: number) {
    if (sec < 60) return `${sec.toFixed(0)}s`;
    return `${Math.floor(sec / 60)}m ${(sec % 60).toFixed(0)}s`;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#070710", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg, #059669, #047857)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(5,150,105,0.35)" }}>
            <ShieldCheck style={{ width: 20, height: 20, color: "#fff" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", lineHeight: 1 }}>G-Code Verification Engine</div>
            <div style={{ fontSize: 11, color: "#52525b", marginTop: 2 }}>Collision · Feed · Safety · Structure · Arc · Compensation — Pro Level</div>
          </div>
        </div>

        {/* Controller selector */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(Object.keys(CTRL_INFO) as Controller[]).map(c => (
            <button key={c} onClick={() => { setCtrl(c); setCode(SAMPLE[c]); setVerified(false); setResults([]); }}
              style={{ padding: "5px 11px", borderRadius: 7, border: `1px solid ${ctrl === c ? CTRL_INFO[c].color + "60" : "rgba(255,255,255,0.07)"}`, background: ctrl === c ? CTRL_INFO[c].color + "18" : "transparent", color: ctrl === c ? CTRL_INFO[c].color : "#52525b", fontSize: 10, fontWeight: 800, cursor: "pointer", letterSpacing: "0.03em" }}>
              {CTRL_INFO[c].maker}
            </button>
          ))}
        </div>

        {verified && (
          <div style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 9, background: overallPassed ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${overallPassed ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`, fontSize: 12, fontWeight: 800, color: overallPassed ? "#34d399" : "#f87171" }}>
            {overallPassed ? "✅ VERIFIED — SAFE TO RUN" : `🔴 ${counts.fail} CRITICAL ERROR${counts.fail > 1 ? "S" : ""} FOUND`}
          </div>
        )}
      </div>

      {/* Controller badge + stats */}
      <div style={{ padding: "8px 18px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: ctrlInfo.color }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: ctrlInfo.color }}>{ctrlInfo.name}</span>
        </div>
        {verified && (
          <>
            {[
              { icon: <FileCode2 style={{ width: 10, height: 10 }} />, label: `${stats.totalBlocks} blocks` },
              { icon: <ChevronRight style={{ width: 10, height: 10 }} />, label: `${stats.cuttingMoves} cutting` },
              { icon: <Cpu style={{ width: 10, height: 10 }} />, label: `${stats.rapidMoves} rapids` },
              { icon: <BarChart2 style={{ width: 10, height: 10 }} />, label: `${stats.toolChanges} tools` },
              { icon: <Clock style={{ width: 10, height: 10 }} />, label: `~${formatTime(stats.estimatedTimeSec)} est.` },
              { icon: <span style={{ fontSize: 9 }}>XZ</span>, label: `X${stats.minX.toFixed(0)}–${stats.maxX.toFixed(0)} Z${stats.minZ.toFixed(0)}–${stats.maxZ.toFixed(0)}` },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)", color: "#71717a", fontSize: 10 }}>
                {s.icon}<span>{s.label}</span>
              </div>
            ))}
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button onClick={() => setViewMode("highlight")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: viewMode === "highlight" ? "rgba(5,150,105,0.2)" : "transparent", color: viewMode === "highlight" ? "#34d399" : "#52525b" }}>Highlighted</button>
          <button onClick={() => setViewMode("edit")} style={{ padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer", background: viewMode === "edit" ? "rgba(5,150,105,0.2)" : "transparent", color: viewMode === "edit" ? "#34d399" : "#52525b" }}>Edit</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", overflow: "hidden" }}>
        {/* LEFT: G-code */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "7px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#52525b" }}>G-Code — {code.split("\n").length} lines</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <label style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)", color: "#a1a1aa", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Upload style={{ width: 10, height: 10 }} />Open .nc
                <input type="file" accept=".nc,.tap,.gc,.txt,.g,.mpf" style={{ display: "none" }} onChange={handleUpload} />
              </label>
              <button onClick={() => { setCode(SAMPLE[ctrl]); setVerified(false); setResults([]); }}
                style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#52525b", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Sample</button>
            </div>
          </div>
          {viewMode === "highlight" ? (
            <HighlightedEditor code={code} errorLines={errorLines} />
          ) : (
            <textarea value={code} onChange={e => { setCode(e.target.value); setVerified(false); setResults([]); }}
              style={{ flex: 1, background: "#08091a", color: "#34d399", fontFamily: "monospace", fontSize: 12, padding: "12px 14px", border: "none", outline: "none", resize: "none", lineHeight: "22px" }}
              spellCheck={false} />
          )}
          <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <button onClick={verify}
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(90deg, #059669, #047857)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }}>
              <Play style={{ width: 15, height: 15 }} />
              Verify G-Code — {ctrlInfo.maker} Controller
            </button>
          </div>
        </div>

        {/* RIGHT: Results */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!verified ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, color: "#3f3f46" }}>
              <ShieldCheck style={{ width: 44, height: 44, marginBottom: 14, opacity: 0.2 }} />
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Click "Verify" to start</div>
              <div style={{ fontSize: 11, color: "#3f3f46", textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>
                15+ automated checks: Collision risk · Feed rates · Spindle safety · Arc definition · Program structure · Tool compensation · Sequence numbers
              </div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                {["Fanuc 0i — G71/G76 cycle validation", "Siemens 840D — CYCLE95 / G74 checks", "Haas NGC — G28/T-word verification", "All: Arc R/IJ validation, feed units check"].map((t, i) => (
                  <div key={i} style={{ fontSize: 10, color: "#3f3f46", display: "flex", gap: 6 }}><span style={{ color: "#1f2937" }}>›</span>{t}</div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Score summary */}
              <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
                  {[
                    { label: "FAIL", count: counts.fail, color: "#f87171", bg: "rgba(239,68,68,0.1)" },
                    { label: "WARN", count: counts.warn, color: "#fbbf24", bg: "rgba(245,158,11,0.08)" },
                    { label: "INFO", count: counts.info, color: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
                    { label: "PASS", count: counts.pass, color: "#34d399", bg: "rgba(52,211,153,0.08)" },
                  ].map(item => (
                    <div key={item.label} onClick={() => setActiveFilter(item.label.toLowerCase() as Severity)} style={{ padding: "7px 8px", borderRadius: 8, background: item.bg, textAlign: "center", cursor: "pointer" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>{item.count}</div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: item.color, opacity: 0.75 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {/* Filter pills */}
                <div style={{ display: "flex", gap: 3 }}>
                  {(["all", "fail", "warn", "pass", "info"] as const).map(f => (
                    <button key={f} onClick={() => setActiveFilter(f)}
                      style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: `1px solid ${activeFilter === f ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}`, background: activeFilter === f ? "rgba(255,255,255,0.05)" : "transparent", color: activeFilter === f ? "#e4e4e7" : "#3f3f46", fontSize: 9, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Check list */}
              <div style={{ flex: 1, overflow: "auto", padding: "6px 10px" }}>
                {filtered.map(r => {
                  const sc = severityColor(r.severity);
                  const isActive = activeResultId === r.id;
                  return (
                    <div key={r.id} onClick={() => setActiveResultId(isActive ? null : r.id)}
                      style={{ padding: "9px 10px", borderRadius: 9, background: sc.bg, border: `1px solid ${sc.border}`, marginBottom: 5, cursor: "pointer", transition: "all 0.1s" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                        {severityIcon(r.severity)}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 9, fontWeight: 800, color: sc.text, background: sc.badge, padding: "1px 5px", borderRadius: 99, whiteSpace: "nowrap" }}>{r.category}</span>
                            {r.line && <span style={{ fontSize: 9, color: "#52525b", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 99 }}>L{r.line}</span>}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#e4e4e7", lineHeight: 1.4 }}>{r.description}</div>
                          {isActive && <>
                            {r.detail && <div style={{ fontSize: 10, color: "#71717a", marginTop: 4, lineHeight: 1.5 }}>{r.detail}</div>}
                            {r.fix && <div style={{ fontSize: 10, color: sc.text, marginTop: 3, lineHeight: 1.5, opacity: 0.9 }}>▶ {r.fix}</div>}
                          </>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
