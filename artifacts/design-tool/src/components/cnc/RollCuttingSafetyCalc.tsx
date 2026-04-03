import React, { useState, useMemo, useCallback } from "react";
import { Shield, Download, Ruler, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle, FileText, Layers, Cpu } from "lucide-react";

type CNCController = "delta2x" | "fanuc";

interface ControllerProfile {
  name: string;
  spindleCW: string;
  spindleStop: string;
  maxRpmCode: string;
  maxRpm: number;
  safeZ: number;
  homeSequence: string[];
  toolFormat: (t: number) => string;
  safetyBlock: string[];
  coolantOn: string;
  coolantOff: string;
  cssCode: string;
  rpmCode: string;
}

const CONTROLLERS: Record<CNCController, ControllerProfile> = {
  delta2x: {
    name: "Delta CNC 2X (SAI Rolotech)",
    spindleCW: "M4",
    spindleStop: "M5",
    maxRpmCode: "G92",
    maxRpm: 500,
    safeZ: 50,
    homeSequence: ["G28 U0.", "G28 W0."],
    toolFormat: (t: number) => `T${String(t).padStart(2,"0")}${String(t).padStart(2,"0")} ()`,
    safetyBlock: ["G0", "G53", "G28 U0.", "G28 W0.", "M1"],
    coolantOn: "",
    coolantOff: "",
    cssCode: "G96",
    rpmCode: "G97",
  },
  fanuc: {
    name: "Fanuc 0i-TF",
    spindleCW: "M3",
    spindleStop: "M5",
    maxRpmCode: "G50",
    maxRpm: 3000,
    safeZ: 100,
    homeSequence: ["G28 U0 W0"],
    toolFormat: (t: number) => `T${String(t).padStart(2,"0")}${String(t).padStart(2,"0")}`,
    safetyBlock: ["G28 U0 W0", "M1"],
    coolantOn: "M8",
    coolantOff: "M9",
    cssCode: "G96",
    rpmCode: "G97",
  },
};

const STANDARD_OD = [80,90,100,110,120,130,140,150,160,170,180,200,220,250,280,300,350,400];
const STANDARD_LEN = [100,120,150,180,200,220,250,280,300,350,400,450,500];

interface CalcResult {
  rawOD: number;
  stdRawOD: number;
  rawLength: number;
  stdRawLength: number;
  approachX: number;
  approachZ: number;
  retractX: number;
  retractZ: number;
  safeRapidX: number;
  safeRapidZ: number;
  faceStartZ: number;
  faceEndZ: number;
  cuttingStartX: number;
  cuttingEndX: number;
  turnAllowance: number;
  finishAllowance: number;
  facingStock: number;
  preCutClearance: number;
  postCutClearance: number;
  totalZTravel: number;
  totalXTravel: number;
  weight: number;
}

function nextStd(val: number, arr: number[]): number {
  for (const s of arr) if (s >= val) return s;
  const last = arr[arr.length - 1];
  return Math.ceil(val / 10) * 10;
}

function calcSafety(
  finalOD: number, boreOD: number, faceWidth: number,
  shaftLen: number, process: string, material: string
): CalcResult & { oversized: boolean } {
  const turnAllow = process === "turn_only" ? 8 : process === "turn_grind" ? 12 : 9;
  const finishAllow = process === "turn_only" ? 0 : process === "turn_grind" ? 2 : 1;
  const facingStock = process === "turn_grind" ? 4 : 3;

  const rawOD = finalOD + turnAllow;
  const stdRawOD = nextStd(rawOD, STANDARD_OD);
  const rawLength = faceWidth + (2 * shaftLen) + (2 * facingStock);
  const stdRawLength = nextStd(rawLength, STANDARD_LEN);
  const oversized = stdRawOD > STANDARD_OD[STANDARD_OD.length - 1] || stdRawLength > STANDARD_LEN[STANDARD_LEN.length - 1];

  const preCutClearance = 5;
  const postCutClearance = 10;

  const safeRapidX = stdRawOD + 20;
  const safeRapidZ = preCutClearance + 5;
  const approachX = stdRawOD + preCutClearance;
  const approachZ = preCutClearance;
  const retractX = stdRawOD + postCutClearance;
  const retractZ = safeRapidZ;

  const faceStartZ = 0;
  const faceEndZ = -(faceWidth + 2 * facingStock);
  const cuttingStartX = boreOD > 0 ? boreOD : 0;
  const cuttingEndX = finalOD;

  const totalZTravel = Math.abs(faceEndZ) + safeRapidZ + approachZ;
  const totalXTravel = (safeRapidX - cuttingStartX) * 2;

  const density = material === "D2" ? 7.70 : material === "H13" ? 7.76 : 7.85;
  const vol = (Math.PI / 4) * (stdRawOD / 1000) ** 2 * (stdRawLength / 1000);
  const weight = vol * density * 1000;

  return {
    rawOD, stdRawOD, rawLength, stdRawLength,
    approachX, approachZ, retractX, retractZ,
    safeRapidX, safeRapidZ, faceStartZ, faceEndZ,
    cuttingStartX, cuttingEndX,
    turnAllowance: turnAllow, finishAllowance: finishAllow, facingStock,
    preCutClearance, postCutClearance,
    totalZTravel, totalXTravel, weight, oversized,
  };
}

function SafetyDiagram({ r, finalOD, boreOD, faceWidth }: { r: CalcResult; finalOD: number; boreOD: number; faceWidth: number }) {
  const W = 700, H = 340, cx = W / 2, cy = H / 2;
  const scale = Math.min(280 / r.stdRawOD, 200 / r.stdRawLength) * 0.9;
  const rw = r.stdRawLength * scale;
  const rh = r.stdRawOD * scale;
  const fh = finalOD * scale;
  const bh = boreOD * scale;
  const fw = faceWidth * scale;
  const rx = cx - rw / 2;
  const ry = cy - rh / 2;

  const apX = cx - rw / 2 - r.approachZ * scale;
  const rtX = cx + rw / 2 + r.postCutClearance * scale;
  const safeY = cy - (r.safeRapidX / 2) * scale;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[340px] bg-zinc-950 rounded-lg border border-white/10">
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#555" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect x={rx} y={ry} width={rw} height={rh} fill="url(#hatch)" stroke="#666" strokeWidth="1" strokeDasharray="4 2" />
      <text x={rx + rw / 2} y={ry - 8} textAnchor="middle" fill="#888" fontSize="9">Raw Stock: {r.stdRawOD}mm x {r.stdRawLength}mm</text>

      <rect x={cx - fw / 2} y={cy - fh / 2} width={fw} height={fh} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      <text x={cx} y={cy - fh / 2 - 6} textAnchor="middle" fill="#f59e0b" fontSize="9">Final: {finalOD}mm x {faceWidth}mm</text>

      {boreOD > 0 && (
        <>
          <rect x={cx - fw / 2} y={cy - bh / 2} width={fw} height={bh} fill="#1a1a2e" stroke="#60a5fa" strokeWidth="1" strokeDasharray="3 2" />
          <text x={cx} y={cy + 2} textAnchor="middle" fill="#60a5fa" fontSize="8">Bore: {boreOD}mm</text>
        </>
      )}

      <line x1={apX} y1={safeY} x2={apX} y2={cy + rh / 2 + 10} stroke="#22c55e" strokeWidth="1" strokeDasharray="4 2" />
      <text x={apX} y={safeY - 4} textAnchor="middle" fill="#22c55e" fontSize="8">Approach Z+{r.approachZ}</text>

      <line x1={rtX} y1={safeY} x2={rtX} y2={cy + rh / 2 + 10} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" />
      <text x={rtX} y={safeY - 4} textAnchor="middle" fill="#ef4444" fontSize="8">Retract +{r.postCutClearance}</text>

      <line x1={rx - 15} y1={cy - rh / 2 - 15} x2={rtX + 20} y2={cy - rh / 2 - 15} stroke="#a78bfa" strokeWidth="0.8" strokeDasharray="6 3" />
      <text x={(rx - 15 + rtX + 20) / 2} y={cy - rh / 2 - 20} textAnchor="middle" fill="#a78bfa" fontSize="8">Safe Rapid Zone: X{r.safeRapidX}mm above centerline</text>

      <rect x={rx - 20} y={ry - 3} width={rw + 40} height={rh + 6} fill="none" stroke="#22c55e" strokeWidth="0.8" strokeDasharray="2 4" rx="4" />

      <line x1={rx} y1={cy + rh / 2 + 20} x2={rx + rw} y2={cy + rh / 2 + 20} stroke="#ccc" strokeWidth="0.5" />
      <line x1={rx} y1={cy + rh / 2 + 16} x2={rx} y2={cy + rh / 2 + 24} stroke="#ccc" strokeWidth="0.5" />
      <line x1={rx + rw} y1={cy + rh / 2 + 16} x2={rx + rw} y2={cy + rh / 2 + 24} stroke="#ccc" strokeWidth="0.5" />
      <text x={cx} y={cy + rh / 2 + 30} textAnchor="middle" fill="#ccc" fontSize="8">{r.stdRawLength}mm (raw length)</text>

      <line x1={rx - 25} y1={ry} x2={rx - 25} y2={ry + rh} stroke="#ccc" strokeWidth="0.5" />
      <line x1={rx - 21} y1={ry} x2={rx - 29} y2={ry} stroke="#ccc" strokeWidth="0.5" />
      <line x1={rx - 21} y1={ry + rh} x2={rx - 29} y2={ry + rh} stroke="#ccc" strokeWidth="0.5" />
      <text x={rx - 30} y={cy + 3} textAnchor="middle" fill="#ccc" fontSize="8" transform={`rotate(-90,${rx - 30},${cy})`}>{r.stdRawOD}mm</text>

      <rect x={10} y={H - 55} width={12} height={12} fill="none" stroke="#666" strokeDasharray="4 2" />
      <text x={26} y={H - 45} fill="#888" fontSize="8">Raw Stock</text>
      <rect x={10} y={H - 40} width={12} height={12} fill="none" stroke="#f59e0b" />
      <text x={26} y={H - 30} fill="#f59e0b" fontSize="8">Final Profile</text>
      <line x1={10} y1={H - 20} x2={22} y2={H - 20} stroke="#22c55e" strokeDasharray="4 2" />
      <text x={26} y={H - 16} fill="#22c55e" fontSize="8">Safety Zone</text>

      <rect x={W - 180} y={H - 55} width={170} height={48} fill="#111" stroke="#333" rx="4" />
      <text x={W - 170} y={H - 40} fill="#f59e0b" fontSize="9" fontWeight="bold">SAI ROLOTECH SMART ENGINES</text>
      <text x={W - 170} y={H - 28} fill="#888" fontSize="8">Roll Cutting Safety Drawing</text>
      <text x={W - 170} y={H - 16} fill="#666" fontSize="7">Weight: {r.weight.toFixed(2)} kg | {new Date().toLocaleDateString("en-IN")}</text>
    </svg>
  );
}

function generateSafetyDxf(r: CalcResult, finalOD: number, boreOD: number, faceWidth: number, label: string): string {
  const g = (c: number, v: string | number) => `  ${c}\n${v}`;
  const dxfLine = (x1: number, y1: number, x2: number, y2: number, layer: string) =>
    [g(0,"LINE"),g(8,layer),g(10,x1.toFixed(4)),g(20,y1.toFixed(4)),g(30,"0"),g(11,x2.toFixed(4)),g(21,y2.toFixed(4)),g(31,"0")].join("\n");
  const dxfText = (x: number, y: number, h: number, txt: string, layer: string) =>
    [g(0,"TEXT"),g(8,layer),g(10,x.toFixed(4)),g(20,y.toFixed(4)),g(30,"0"),g(40,h.toFixed(4)),g(1,txt)].join("\n");

  const entities: string[] = [];
  const ro = r.stdRawOD / 2, fo = finalOD / 2, bo = boreOD / 2;
  const rl = r.stdRawLength, fl = faceWidth;

  entities.push(dxfLine(0, -ro, rl, -ro, "RAW_STOCK"));
  entities.push(dxfLine(0, ro, rl, ro, "RAW_STOCK"));
  entities.push(dxfLine(0, -ro, 0, ro, "RAW_STOCK"));
  entities.push(dxfLine(rl, -ro, rl, ro, "RAW_STOCK"));

  const fStart = (rl - fl) / 2;
  entities.push(dxfLine(fStart, -fo, fStart + fl, -fo, "FINAL_PROFILE"));
  entities.push(dxfLine(fStart, fo, fStart + fl, fo, "FINAL_PROFILE"));
  entities.push(dxfLine(fStart, -fo, fStart, fo, "FINAL_PROFILE"));
  entities.push(dxfLine(fStart + fl, -fo, fStart + fl, fo, "FINAL_PROFILE"));

  if (boreOD > 0) {
    entities.push(dxfLine(fStart, -bo, fStart + fl, -bo, "BORE"));
    entities.push(dxfLine(fStart, bo, fStart + fl, bo, "BORE"));
    entities.push(dxfLine(fStart, -bo, fStart, bo, "BORE"));
    entities.push(dxfLine(fStart + fl, -bo, fStart + fl, bo, "BORE"));
  }

  entities.push(dxfLine(-r.approachZ, -ro - 10, -r.approachZ, ro + 10, "SAFETY_APPROACH"));
  entities.push(dxfLine(rl + r.postCutClearance, -ro - 10, rl + r.postCutClearance, ro + 10, "SAFETY_RETRACT"));

  entities.push(dxfLine(-r.safeRapidZ, -r.safeRapidX / 2, rl + r.safeRapidZ, -r.safeRapidX / 2, "SAFE_RAPID"));
  entities.push(dxfLine(-r.safeRapidZ, r.safeRapidX / 2, rl + r.safeRapidZ, r.safeRapidX / 2, "SAFE_RAPID"));

  entities.push(dxfText(0, ro + 20, 5, `Raw: ${r.stdRawOD}x${r.stdRawLength}mm`, "DIMENSIONS"));
  entities.push(dxfText(fStart, -fo - 15, 4, `Final: ${finalOD}x${faceWidth}mm`, "DIMENSIONS"));
  entities.push(dxfText(-r.approachZ - 5, -ro - 20, 3, `Approach: Z+${r.approachZ}`, "DIMENSIONS"));
  entities.push(dxfText(rl + 5, -ro - 20, 3, `Retract: +${r.postCutClearance}`, "DIMENSIONS"));
  entities.push(dxfText(0, ro + 35, 3, `Weight: ${r.weight.toFixed(2)} kg`, "DIMENSIONS"));
  entities.push(dxfText(0, ro + 45, 4, `SAI ROLOTECH — ${label}`, "TITLE"));

  const header = [
    g(0,"SECTION"),g(2,"HEADER"),
    g(9,"$ACADVER"),g(1,"AC1027"),
    g(9,"$INSUNITS"),g(70,4),
    g(0,"ENDSEC"),
  ].join("\n");
  const ent = [g(0,"SECTION"),g(2,"ENTITIES"), ...entities, g(0,"ENDSEC")].join("\n");
  return `${header}\n${ent}\n${g(0,"EOF")}`;
}

export function RollCuttingSafetyCalc() {
  const [finalOD, setFinalOD] = useState(160);
  const [boreOD, setBoreOD] = useState(50);
  const [faceWidth, setFaceWidth] = useState(80);
  const [shaftLen, setShaftLen] = useState(40);
  const [process, setProcess] = useState("turn_grind");
  const [material, setMaterial] = useState("D2");
  const [controller, setController] = useState<CNCController>("delta2x");
  const [label, setLabel] = useState("Upper Roll ST-1");

  const ctrl = CONTROLLERS[controller];

  const r = useMemo(() =>
    calcSafety(finalOD, boreOD, faceWidth, shaftLen, process, material),
    [finalOD, boreOD, faceWidth, shaftLen, process, material]
  );

  const exportDxf = useCallback(() => {
    const dxf = generateSafetyDxf(r, finalOD, boreOD, faceWidth, label);
    const blob = new Blob([dxf], { type: "application/dxf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/\s+/g, "_")}_Safety.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [r, finalOD, boreOD, faceWidth, label]);

  const exportReport = useCallback(() => {
    const txt = [
      `SAI ROLOTECH SMART ENGINES — Roll Cutting Safety Report`,
      `═══════════════════════════════════════════════════`,
      `Roll: ${label}`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      ``,
      `─── INPUT ───`,
      `Final OD: ${finalOD}mm | Bore: ${boreOD}mm | Face Width: ${faceWidth}mm`,
      `Shaft Length: ${shaftLen}mm/side | Process: ${process} | Material: ${material}`,
      ``,
      `─── RAW STOCK ───`,
      `Raw OD (calculated): ${r.rawOD}mm`,
      `Standard Raw OD: ${r.stdRawOD}mm`,
      `Raw Length (calc): ${r.rawLength}mm`,
      `Standard Raw Length: ${r.stdRawLength}mm`,
      `Turning Allowance: ${r.turnAllowance}mm on dia`,
      `Finishing Allowance: ${r.finishAllowance}mm on dia`,
      `Facing Stock: ${r.facingStock}mm per side`,
      `Weight: ${r.weight.toFixed(2)} kg`,
      ``,
      `─── SAFETY DISTANCES ───`,
      `Safe Rapid Position X: ${r.safeRapidX}mm (above raw OD + 20mm)`,
      `Safe Rapid Position Z: +${r.safeRapidZ}mm (before face start)`,
      `Approach Position X: ${r.approachX}mm (raw OD + 5mm)`,
      `Approach Position Z: +${r.approachZ}mm (before face)`,
      `Pre-Cut Clearance: ${r.preCutClearance}mm`,
      `Post-Cut Clearance: ${r.postCutClearance}mm`,
      `Retract Position X: ${r.retractX}mm`,
      `Retract Position Z: +${r.retractZ}mm`,
      ``,
      `─── G-CODE REFERENCE (${ctrl.name}) ───`,
      `(Controller: ${ctrl.name})`,
      `(Spindle: ${ctrl.spindleCW} | Max RPM: ${ctrl.maxRpmCode} S${ctrl.maxRpm})`,
      ``,
      ...(ctrl.safetyBlock.map(b => `${b}                              (Safety Block)`)),
      `${ctrl.toolFormat(1)}                     (Tool Call)`,
      `${ctrl.maxRpmCode} S${ctrl.maxRpm}                        (Max RPM Limit)`,
      `${ctrl.rpmCode} S400 ${ctrl.spindleCW}                   (Spindle ON)`,
      `G00 X${r.safeRapidX}.0 Z${ctrl.safeZ}.   (Safe Rapid)`,
      `G00 X${r.approachX}.0 Z${r.approachZ}.0     (Approach)`,
      `G71 U2.0 R0.5                   (Roughing)`,
      `G71 P100 Q200 U0.4 W0.1 F0.28   (Profile)`,
      `N100 G00 X${r.cuttingStartX}.0`,
      `N110 G01 Z${r.faceStartZ}.0 F0.15`,
      `...profile blocks...`,
      `N200 X${r.cuttingEndX + 5}.0`,
      `G70 P100 Q200 F0.10             (Finish)`,
      `G00 X${r.retractX}.0 Z${r.retractZ}.0  (Safe Retract)`,
      ...(ctrl.homeSequence.map(h => `${h}                              (Home)`)),
      `${ctrl.spindleStop}                                (Spindle Stop)`,
      `M30                              (Program End)`,
      ``,
      `─── CUTTING ZONE ───`,
      `Face Start Z: ${r.faceStartZ}mm (Z zero = face datum)`,
      `Face End Z: ${r.faceEndZ}mm`,
      `Cutting Start X: ${r.cuttingStartX}mm (bore/center)`,
      `Cutting End X: ${r.cuttingEndX}mm (final OD)`,
      `Total Z Travel: ${r.totalZTravel.toFixed(1)}mm`,
      `Total X Travel: ${r.totalXTravel.toFixed(1)}mm`,
    ].join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/\s+/g, "_")}_Safety_Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [r, finalOD, boreOD, faceWidth, shaftLen, process, material, label, ctrl]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-zinc-900/80 shrink-0">
        <Shield className="w-5 h-5 text-amber-500" />
        <h1 className="text-sm font-bold tracking-wide text-amber-400">Roll Cutting Safety Calculator</h1>
        <span className="text-[10px] text-zinc-500 ml-auto">Raw Size | Approach | Retract | Safety Zones | CAD Export</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Roll Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Final OD (mm)</label>
            <input type="number" value={finalOD} onChange={e => setFinalOD(+e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Bore OD (mm)</label>
            <input type="number" value={boreOD} onChange={e => setBoreOD(+e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Face Width (mm)</label>
            <input type="number" value={faceWidth} onChange={e => setFaceWidth(+e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Shaft Length/Side (mm)</label>
            <input type="number" value={shaftLen} onChange={e => setShaftLen(+e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Machining Process</label>
            <select value={process} onChange={e => setProcess(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none">
              <option value="turn_only">CNC Turn Only</option>
              <option value="turn_grind">CNC Turn + Grind</option>
              <option value="turn_hardturn">CNC Turn + Hard Turn</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Roll Material</label>
            <select value={material} onChange={e => setMaterial(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500/50 outline-none">
              <option value="D2">D2 Tool Steel (HRC 58-62)</option>
              <option value="H13">H13 Hot Work (HRC 44-50)</option>
              <option value="A2">A2 Tool Steel (HRC 57-62)</option>
              <option value="EN31">EN31 Bearing Steel</option>
              <option value="CI">Cast Iron GG25</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">CNC Controller</label>
            <select value={controller} onChange={e => setController(e.target.value as CNCController)}
              className="w-full bg-zinc-900 border border-amber-600/30 rounded px-2 py-1.5 text-xs text-amber-400 font-bold focus:border-amber-500/50 outline-none">
              <option value="delta2x">Delta CNC 2X (SAI Rolotech)</option>
              <option value="fanuc">Fanuc 0i-TF</option>
            </select>
          </div>
          <div className="flex items-end gap-1">
            <button onClick={exportDxf} className="flex-1 flex items-center justify-center gap-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 rounded px-2 py-1.5 text-[10px] text-amber-400 font-bold">
              <Layers className="w-3 h-3" /> DXF (CAD)
            </button>
            <button onClick={exportReport} className="flex-1 flex items-center justify-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded px-2 py-1.5 text-[10px] text-blue-400 font-bold">
              <FileText className="w-3 h-3" /> Report
            </button>
          </div>
        </div>

        {r.oversized && (
          <div className="bg-red-900/30 border border-red-600/30 rounded-lg p-2 flex items-center gap-2 text-[11px] text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Standard size se bada hai — custom bar order ya forging ki zarurat hogi. Raw OD: {r.stdRawOD}mm, Length: {r.stdRawLength}mm</span>
          </div>
        )}

        <SafetyDiagram r={r} finalOD={finalOD} boreOD={boreOD} faceWidth={faceWidth} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-400">Raw Stock (Raf Size)</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-zinc-400">Calculated OD:</span><span>{r.rawOD}mm</span></div>
              <div className="flex justify-between font-bold"><span className="text-zinc-400">Standard Raw OD:</span><span className="text-amber-400">{r.stdRawOD}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Calculated Length:</span><span>{r.rawLength}mm</span></div>
              <div className="flex justify-between font-bold"><span className="text-zinc-400">Standard Raw Length:</span><span className="text-amber-400">{r.stdRawLength}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Turn Allowance:</span><span>+{r.turnAllowance}mm dia</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Finish Allowance:</span><span>+{r.finishAllowance}mm dia</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Facing Stock:</span><span>{r.facingStock}mm/side</span></div>
              <div className="flex justify-between border-t border-white/10 pt-1 mt-1"><span className="text-zinc-400">Weight:</span><span className="font-bold">{r.weight.toFixed(2)} kg</span></div>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowRight className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[11px] font-bold text-green-400">Safety Distances</span>
            </div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between"><span className="text-zinc-400">Pre-Cut Clearance:</span><span className="text-green-400">{r.preCutClearance}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Post-Cut Clearance:</span><span className="text-red-400">{r.postCutClearance}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Approach X:</span><span>X{r.approachX}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Approach Z:</span><span>Z+{r.approachZ}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Retract X:</span><span>X{r.retractX}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Retract Z:</span><span>Z+{r.retractZ}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Safe Rapid X:</span><span className="font-bold text-purple-400">X{r.safeRapidX}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Safe Rapid Z:</span><span className="font-bold text-purple-400">Z+{r.safeRapidZ}mm</span></div>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-400">{ctrl.name}</span>
            </div>
            <div className="space-y-0.5 text-[10px] font-mono bg-black/30 rounded p-2 border border-white/5">
              <div className="text-zinc-600">(Safety Block)</div>
              {ctrl.safetyBlock.map((b, i) => <div key={i} className="text-zinc-400">{b}</div>)}
              <div className="text-zinc-600">(Tool + Spindle)</div>
              <div className="text-cyan-400">{ctrl.toolFormat(1)}</div>
              <div className="text-cyan-400">{ctrl.maxRpmCode} S{ctrl.maxRpm}</div>
              <div className="text-cyan-400">{ctrl.rpmCode} S400 {ctrl.spindleCW}</div>
              <div className="text-zinc-600">(Safe Rapid)</div>
              <div className="text-purple-400">G00 X{r.safeRapidX}. Z{ctrl.safeZ}.</div>
              <div className="text-zinc-600">(Approach)</div>
              <div className="text-green-400">G00 X{r.approachX}. Z{r.approachZ}.</div>
              <div className="text-zinc-600">(Roughing)</div>
              <div className="text-amber-400">G71 U2.0 R0.5</div>
              <div className="text-amber-400">G71 P100 Q200 U0.4 W0.1 F0.28</div>
              <div className="text-zinc-600">(Finishing)</div>
              <div className="text-amber-400">G70 P100 Q200 F0.10</div>
              <div className="text-zinc-600">(Retract)</div>
              <div className="text-red-400">G00 X{r.retractX}. Z{r.retractZ}.</div>
              <div className="text-zinc-600">(Home)</div>
              {ctrl.homeSequence.map((h, i) => <div key={i} className="text-zinc-300">{h}</div>)}
              <div className="text-zinc-300">{ctrl.spindleStop}</div>
              <div className="text-zinc-300">M30</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-amber-600/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">Safety Rules — CNC Roll Cutting</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-zinc-400">
            <div>1. Cutting START se pehle: Z+{r.approachZ}mm clearance rakhein</div>
            <div>2. Cutting END ke baad: +{r.postCutClearance}mm aage ja kar retract karein</div>
            <div>3. Rapid move SIRF X{r.safeRapidX}mm ya usse upar karein</div>
            <div>4. Raw OD ({r.stdRawOD}mm) se neeche rapid NAHI — feed mode use karein</div>
            <div>5. Face START = Z0 (datum), Face END = Z{r.faceEndZ}mm</div>
            <div>6. Bore se bahar X{r.cuttingStartX}mm se shuru karein, X{r.cuttingEndX}mm tak jaayein</div>
            {controller === "delta2x" && <>
              <div className="text-amber-400 font-bold">7. Delta 2X: Spindle M4 use karein (M3 NAHI!)</div>
              <div className="text-amber-400 font-bold">8. Delta 2X: Max RPM G92 S{ctrl.maxRpm} (G50 NAHI!)</div>
              <div className="text-amber-400">9. Delta 2X: Home = G28 U0. aur G28 W0. ALAG lines pe</div>
              <div className="text-amber-400">10. Delta 2X: Safe Z = {ctrl.safeZ}mm | Coolant M8/M9 use MAT KARO</div>
            </>}
            {controller === "fanuc" && <>
              <div>7. Fanuc: Spindle M3 | Max RPM G50 S{ctrl.maxRpm}</div>
              <div>8. Fanuc: Home = G28 U0 W0 ek line mein</div>
            </>}
            <div>{controller === "delta2x" ? "11" : "9"}. DXF file ko AutoCAD/SolidWorks mein open karke modify kar sakte hain</div>
          </div>
        </div>
      </div>
    </div>
  );
}
