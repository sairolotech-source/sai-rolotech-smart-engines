import React, { useState, useMemo, useCallback } from "react";
import {
  Settings, Package, Wrench, ChevronDown, ChevronRight, Calculator,
  AlertTriangle, Zap, Layers, Scissors, GitBranch, Circle, Hash,
  ChevronsRight, Drill, Eye, Shield, RotateCw, Box, Monitor,
} from "lucide-react";
import { LatheSimulator, type LatheToolMove } from "./LatheSimulator";
import { LatheSimulator3D } from "./LatheSimulator3D";
import { generateFullRollCamProgram } from "./AdaptiveToolpath";
import { runFullPreFlightCheck, type WorkpieceGeometry, type ToolGeometry } from "./CollisionEngine3D";

type TurningMaterial = "GI" | "CR" | "HR" | "SS" | "AL" | "MS" | "CU" | "TI" | "PP" | "HSLA" | "CAST_IRON" | "TITANIUM";

const MATERIAL_VC: Record<TurningMaterial, { vc: number; f: number; doc: number; label: string }> = {
  GI:        { vc: 120, f: 0.20, doc: 2.0, label: "Galvanized / Mild Steel" },
  CR:        { vc: 160, f: 0.25, doc: 2.5, label: "Cold Rolled Steel" },
  HR:        { vc: 130, f: 0.25, doc: 3.0, label: "Hot Rolled Steel" },
  SS:        { vc: 90,  f: 0.12, doc: 1.5, label: "Stainless Steel (304)" },
  AL:        { vc: 350, f: 0.20, doc: 3.0, label: "Aluminium (6061)" },
  MS:        { vc: 150, f: 0.25, doc: 2.5, label: "Mild Steel" },
  CU:        { vc: 250, f: 0.20, doc: 2.5, label: "Copper" },
  TI:        { vc: 50,  f: 0.08, doc: 0.8, label: "Titanium" },
  PP:        { vc: 140, f: 0.20, doc: 2.0, label: "Pre-Painted Steel" },
  HSLA:      { vc: 100, f: 0.15, doc: 1.5, label: "High-Strength Low-Alloy" },
  CAST_IRON: { vc: 100, f: 0.30, doc: 3.5, label: "Cast Iron" },
  TITANIUM:  { vc: 50,  f: 0.08, doc: 0.8, label: "Titanium (Ti-6Al-4V)" },
};

const INSERT_SHAPES: Record<string, { deg: number; label: string; color: string }> = {
  C: { deg: 80, label: "C (80°)", color: "#f59e0b" },
  D: { deg: 55, label: "D (55°)", color: "#3b82f6" },
  V: { deg: 35, label: "V (35°)", color: "#22c55e" },
  T: { deg: 60, label: "T (60°)", color: "#8b5cf6" },
  S: { deg: 90, label: "S (90°)", color: "#ef4444" },
  W: { deg: 80, label: "W (80° trig.)", color: "#ec4899" },
  R: { deg: 0,  label: "R (Round)", color: "#06b6d4" },
};

const CLEARANCE_ANGLES: Record<string, string> = {
  A: "3°", B: "5°", C: "7°", D: "15°", E: "20°", F: "25°", G: "30°",
  N: "0° (Negative)", P: "11°",
};

const TOLERANCE_CLASSES: Record<string, string> = {
  C: "d=±0.025", E: "d=±0.025, t=±0.025", G: "d=±0.025, t=±0.13",
  H: "d=±0.013", J: "d=±0.005, t=±0.025", K: "d=±0.013, t=±0.025",
  L: "d=±0.025, t=±0.025", M: "d=±0.05-0.15", N: "d=±0.025, t=±0.025",
  U: "d=±0.08-0.18",
};

const CROSS_SECTIONS: Record<string, string> = {
  A: "with hole, no chipbreaker", F: "no hole, flat top",
  G: "with hole, double-sided chipbreaker", M: "with hole, one-sided chipbreaker",
  N: "no hole, no chipbreaker", R: "no hole, one-sided chipbreaker",
  T: "with hole, single-sided flat top", W: "with hole, wiper geometry",
};

const IC_DIAMETERS: { code: string; mm: number }[] = [
  { code: "04", mm: 2.38 }, { code: "05", mm: 3.18 }, { code: "06", mm: 3.97 },
  { code: "08", mm: 4.76 }, { code: "09", mm: 6.35 }, { code: "12", mm: 7.94 },
  { code: "16", mm: 9.52 }, { code: "19", mm: 12.70 }, { code: "22", mm: 15.88 },
  { code: "25", mm: 19.05 },
];

const INSERT_THICKNESSES: { code: string; mm: number }[] = [
  { code: "01", mm: 1.59 }, { code: "02", mm: 2.38 }, { code: "03", mm: 3.18 },
  { code: "04", mm: 4.76 }, { code: "05", mm: 5.56 }, { code: "06", mm: 6.35 },
  { code: "07", mm: 7.94 }, { code: "09", mm: 9.52 },
];

const CORNER_RADII: { code: string; mm: number }[] = [
  { code: "00", mm: 0 }, { code: "02", mm: 0.2 }, { code: "04", mm: 0.4 },
  { code: "08", mm: 0.8 }, { code: "12", mm: 1.2 }, { code: "16", mm: 1.6 },
  { code: "20", mm: 2.0 }, { code: "24", mm: 2.4 },
];

const CUTTING_EDGES: Record<string, string> = {
  E: "Sharp edge, honed", F: "Sharp cutting edge",
  K: "Double-sided chipbreaker", M: "Both sides ground",
  N: "Un-ground", P: "Precision ground",
  S: "Sintered, un-ground", T: "Ground with wiper",
};

const HOLDER_SHAPES: string[] = ["Square", "Round", "Rectangular", "Custom"];
const SHANK_TYPES: string[] = ["Straight", "Offset right", "Offset left", "Bent"];
const CLAMPING_TYPES: Record<string, string> = {
  C: "Top clamp", M: "Multi-lock (pin+clamp)", P: "Lever pin", S: "Screw-on",
};
const LEAD_ANGLES: { code: string; deg: number }[] = [
  { code: "A", deg: 90 }, { code: "B", deg: 75 }, { code: "C", deg: 45 },
  { code: "D", deg: 45 }, { code: "F", deg: 0 }, { code: "J", deg: -3 },
  { code: "K", deg: 15 }, { code: "L", deg: 95 }, { code: "S", deg: 45 },
];

interface ISOInsertData {
  insertShape: string;
  clearanceAngle: string;
  toleranceClass: string;
  crossSection: string;
  icDiameterCode: string;
  thicknessCode: string;
  cornerRadiusCode: string;
  cuttingEdge: string;
}

interface HolderData {
  shape: string;
  shankType: string;
  insertClamping: string;
  insertLeadAngle: string;
  cuttingDirection: "L" | "R" | "N";
  shankThickness: number;
  shankWidth: number;
  toolLength: number;
}

interface TurningOpData {
  feedUnit: "mm_rev" | "mm_min";
  feedNormal: number;
  feedFinish: number;
  feedLeadIn: number;
  feedLeadOut: number;
  spinMode: "rpm" | "css";
  spinRateVc: number;
  spinRateRpm: number;
  spinFinishVc: number;
  spinFinishRpm: number;
  gearRange: string;
  gearPower: number;
  maxSpindleRpm: number;
  autoGearSwitching: boolean;
  referenceDia: number;
  minSpinRpm: number;
  maxSpinRpm: number;
  safetyAngle: number;
  holderProtection: boolean;
  holderSafety: number;
}

interface TurretTool {
  position: number;
  name: string;
  toolType: "Profile" | "Groove" | "Thread" | "Drill" | "Boring" | "Parting";
  isoInsert: ISOInsertData;
  holder: HolderData;
  opData: TurningOpData;
}

interface MachineSetup {
  machineType: "flatbed" | "slanedbed" | "swiss";
  machineName: string;
  chuck: "3jaw" | "4jaw" | "collet";
  turret: "8pos" | "12pos" | "vdi40";
  z0Ref: "face" | "chuck";
  x0Ref: "centerline";
  maxSpindleRpm: number;
}

interface StockDef {
  form: "bar" | "tube";
  outerDiameter: number;
  innerDiameter: number;
  length: number;
  allowanceX: number;
  allowanceZ: number;
}

function makeDefaultInsert(): ISOInsertData {
  return {
    insertShape: "V", clearanceAngle: "N", toleranceClass: "M",
    crossSection: "G", icDiameterCode: "16", thicknessCode: "04",
    cornerRadiusCode: "08", cuttingEdge: "E",
  };
}

function makeDefaultHolder(): HolderData {
  return {
    shape: "Square", shankType: "Straight", insertClamping: "C",
    insertLeadAngle: "L", cuttingDirection: "L",
    shankThickness: 25, shankWidth: 25, toolLength: 150,
  };
}

function makeDefaultOpData(refDia: number): TurningOpData {
  const rpmRough = Math.round((200 * 1000) / (Math.PI * refDia));
  const rpmFinish = Math.round((225 * 1000) / (Math.PI * refDia));
  return {
    feedUnit: "mm_rev", feedNormal: 0.1016, feedFinish: 0.0508,
    feedLeadIn: 0.0508, feedLeadOut: 0.0508,
    spinMode: "css", spinRateVc: 200, spinRateRpm: rpmRough,
    spinFinishVc: 225, spinFinishRpm: rpmFinish,
    gearRange: "Gear#1", gearPower: 15, maxSpindleRpm: 5000,
    autoGearSwitching: true, referenceDia: refDia,
    minSpinRpm: 0, maxSpinRpm: 500,
    safetyAngle: 0, holderProtection: true, holderSafety: 0,
  };
}

function makeDefaultTurretTools(): TurretTool[] {
  const tools: TurretTool[] = [];
  const configs: { name: string; shape: string; type: TurretTool["toolType"]; ic: string; thick: string; cr: string }[] = [
    { name: "CNMG 120408", shape: "C", type: "Profile", ic: "12", thick: "04", cr: "08" },
    { name: "VNMG 160408", shape: "V", type: "Profile", ic: "16", thick: "04", cr: "08" },
    { name: "DNMG 110408", shape: "D", type: "Profile", ic: "12", thick: "04", cr: "08" },
    { name: "VNMG 060108", shape: "V", type: "Profile", ic: "06", thick: "01", cr: "08" },
    { name: "CCMT 060204", shape: "C", type: "Boring",  ic: "06", thick: "02", cr: "04" },
    { name: "WNMG 080408", shape: "W", type: "Profile", ic: "08", thick: "04", cr: "08" },
    { name: "TNMG 160408", shape: "T", type: "Profile", ic: "16", thick: "04", cr: "08" },
    { name: "DCMT 070208", shape: "D", type: "Profile", ic: "08", thick: "02", cr: "08" },
    { name: "MGMN 300-G",  shape: "R", type: "Groove",  ic: "06", thick: "03", cr: "00" },
    { name: "SNMG 120408", shape: "S", type: "Profile", ic: "12", thick: "04", cr: "08" },
  ];
  for (let i = 0; i < configs.length; i++) {
    const c = configs[i];
    tools.push({
      position: i + 1, name: c.name, toolType: c.type,
      isoInsert: { ...makeDefaultInsert(), insertShape: c.shape, icDiameterCode: c.ic, thicknessCode: c.thick, cornerRadiusCode: c.cr },
      holder: makeDefaultHolder(),
      opData: makeDefaultOpData(95),
    });
  }
  return tools;
}

function getInsertISOCode(ins: ISOInsertData): string {
  const ic = IC_DIAMETERS.find(d => d.code === ins.icDiameterCode);
  const th = INSERT_THICKNESSES.find(d => d.code === ins.thicknessCode);
  return `${ins.insertShape}${ins.clearanceAngle}${ins.toleranceClass}${ins.crossSection} ${ins.icDiameterCode}${ins.thicknessCode}${ins.cornerRadiusCode}`;
}

function InsertShapeSVG({ shape, size = 64 }: { shape: string; size?: number }) {
  const info = INSERT_SHAPES[shape];
  if (!info) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.35;
  const col = info.color;

  if (shape === "R") {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill={col} fillOpacity={0.3} stroke={col} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={2} fill={col} />
      </svg>
    );
  }

  const deg = info.deg;
  const halfAngle = (deg / 2) * (Math.PI / 180);
  const pts: [number, number][] = [];
  const sides = deg <= 55 ? 4 : deg <= 60 ? 3 : deg <= 80 ? 4 : 4;

  if (deg === 35) {
    pts.push([cx, cy - r]);
    pts.push([cx + r * Math.sin(halfAngle), cy + r * Math.cos(halfAngle) * 0.3]);
    pts.push([cx, cy + r * 0.7]);
    pts.push([cx - r * Math.sin(halfAngle), cy + r * Math.cos(halfAngle) * 0.3]);
  } else if (deg === 55) {
    pts.push([cx, cy - r]);
    pts.push([cx + r * 0.55, cy + r * 0.2]);
    pts.push([cx, cy + r * 0.65]);
    pts.push([cx - r * 0.55, cy + r * 0.2]);
  } else if (deg === 60) {
    const h = r * Math.sqrt(3) / 2;
    pts.push([cx, cy - r * 0.85]);
    pts.push([cx + h * 0.8, cy + r * 0.45]);
    pts.push([cx - h * 0.8, cy + r * 0.45]);
  } else if (deg === 80) {
    pts.push([cx, cy - r]);
    pts.push([cx + r * 0.7, cy]);
    pts.push([cx, cy + r]);
    pts.push([cx - r * 0.7, cy]);
  } else if (deg === 90) {
    pts.push([cx - r * 0.7, cy - r * 0.7]);
    pts.push([cx + r * 0.7, cy - r * 0.7]);
    pts.push([cx + r * 0.7, cy + r * 0.7]);
    pts.push([cx - r * 0.7, cy + r * 0.7]);
  }

  const pointsStr = pts.map(p => `${p[0]},${p[1]}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pointsStr} fill={col} fillOpacity={0.25} stroke={col} strokeWidth={1.5} strokeDasharray="3,2" />
      <polygon points={pointsStr} fill={col} fillOpacity={0.15} />
      <circle cx={cx} cy={cy} r={2.5} fill={col} />
    </svg>
  );
}

const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none";
const selectCls = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none";
const labelCls = "text-[10px] text-zinc-500 block mb-0.5";

function NumInput({ label, value, onChange, min, max, step, unit }:
  { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}{unit ? ` (${unit})` : ""}</label>
      <input type="number" value={value} step={step ?? 0.01} min={min} max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={inputCls} />
    </div>
  );
}

type OpSubTab = "tool" | "data" | "feedpoints" | "origin" | "coolant" | "toolchange";

const TURRET_ICONS: Record<TurretTool["toolType"], { icon: string; color: string }> = {
  Profile: { icon: "▬", color: "#3b82f6" },
  Groove: { icon: "◆", color: "#f59e0b" },
  Thread: { icon: "▲", color: "#8b5cf6" },
  Drill: { icon: "●", color: "#22c55e" },
  Boring: { icon: "◼", color: "#ef4444" },
  Parting: { icon: "◗", color: "#ec4899" },
};

function buildSimMoves(stock: StockDef): LatheToolMove[] {
  const moves: LatheToolMove[] = [];
  const stockR = stock.outerDiameter / 2;
  const zStart = -stock.allowanceZ;
  const zEnd = -(stock.length - stock.allowanceZ);
  const targetR = stockR - stock.allowanceX;

  moves.push({ x: stockR + 8, z: 5, type: "rapid" });
  for (let i = 1; i <= 3; i++) {
    moves.push({ x: stockR + 2, z: -i * 0.5, type: "rapid" });
    moves.push({ x: 0, z: -i * 0.5, type: "cut" });
    moves.push({ x: stockR + 2, z: -i * 0.5, type: "rapid" });
  }
  const passes = Math.ceil(stock.allowanceX / 2.0);
  for (let p = 0; p < passes; p++) {
    const r = stockR - p * 2.0;
    if (r < targetR) break;
    moves.push({ x: r + 2, z: zStart, type: "rapid" });
    moves.push({ x: r, z: zStart, type: "rapid" });
    moves.push({ x: r, z: zEnd, type: "cut" });
    moves.push({ x: r + 2, z: zEnd, type: "rapid" });
  }
  moves.push({ x: targetR, z: zStart, type: "rapid" });
  moves.push({ x: targetR, z: zEnd, type: "cut" });
  const gZ = zEnd * 0.45;
  moves.push({ x: targetR + 3, z: gZ, type: "rapid" });
  moves.push({ x: targetR - 5, z: gZ, type: "cut" });
  moves.push({ x: targetR + 3, z: gZ, type: "rapid" });
  moves.push({ x: stockR + 8, z: 5, type: "rapid" });
  return moves;
}

function estimateCycleTime(moves: LatheToolMove[], feedMmMin: number): number {
  let total = 0;
  for (let i = 1; i < moves.length; i++) {
    const dx = moves[i].x - moves[i - 1].x;
    const dz = moves[i].z - moves[i - 1].z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const rate = moves[i].type === "rapid" ? 3000 : (feedMmMin > 0 ? feedMmMin : 150);
    total += (dist / rate) * 60;
  }
  return total;
}

export function TurningView() {
  const [machine, setMachine] = useState<MachineSetup>({
    machineType: "slanedbed", machineName: "2X_DELTA2",
    chuck: "3jaw", turret: "12pos", z0Ref: "face", x0Ref: "centerline", maxSpindleRpm: 5000,
  });

  const [stock, setStock] = useState<StockDef>({
    form: "bar", outerDiameter: 150, innerDiameter: 0, length: 120, allowanceX: 5, allowanceZ: 1,
  });

  const [turretTools, setTurretTools] = useState<TurretTool[]>(makeDefaultTurretTools);
  const [selectedToolPos, setSelectedToolPos] = useState(1);
  const [activePanel, setActivePanel] = useState<string>("turret");
  const [opSubTab, setOpSubTab] = useState<OpSubTab>("tool");
  const [calcMaterial, setCalcMaterial] = useState<TurningMaterial>("MS");
  const [calcDiameter, setCalcDiameter] = useState(60);

  const selectedTool = turretTools.find(t => t.position === selectedToolPos) || turretTools[0];

  const updateTool = useCallback((pos: number, updates: Partial<TurretTool>) => {
    setTurretTools(prev => prev.map(t => t.position === pos ? { ...t, ...updates } : t));
  }, []);

  const updateInsert = useCallback((pos: number, updates: Partial<ISOInsertData>) => {
    setTurretTools(prev => prev.map(t =>
      t.position === pos ? { ...t, isoInsert: { ...t.isoInsert, ...updates } } : t
    ));
  }, []);

  const updateHolder = useCallback((pos: number, updates: Partial<HolderData>) => {
    setTurretTools(prev => prev.map(t =>
      t.position === pos ? { ...t, holder: { ...t.holder, ...updates } } : t
    ));
  }, []);

  const updateOpData = useCallback((pos: number, updates: Partial<TurningOpData>) => {
    setTurretTools(prev => prev.map(t => {
      if (t.position !== pos) return t;
      const newOp = { ...t.opData, ...updates };
      if (updates.spinRateVc !== undefined || updates.referenceDia !== undefined) {
        newOp.spinRateRpm = Math.round((newOp.spinRateVc * 1000) / (Math.PI * newOp.referenceDia));
      }
      if (updates.spinFinishVc !== undefined || updates.referenceDia !== undefined) {
        newOp.spinFinishRpm = Math.round((newOp.spinFinishVc * 1000) / (Math.PI * newOp.referenceDia));
      }
      return { ...t, opData: newOp };
    }));
  }, []);

  const calcResult = useMemo(() => {
    const mat = MATERIAL_VC[calcMaterial];
    const rpm = Math.round((mat.vc * 1000) / (Math.PI * calcDiameter));
    const feedMmMin = mat.f * rpm;
    const raUm = (mat.f * mat.f) / (8 * 0.8) * 1000;
    return { rpm, feedMmMin, vc: mat.vc, f: mat.f, doc: mat.doc, raUm: raUm.toFixed(2) };
  }, [calcMaterial, calcDiameter]);

  const selectedIC = IC_DIAMETERS.find(d => d.code === selectedTool.isoInsert.icDiameterCode);
  const selectedThickness = INSERT_THICKNESSES.find(d => d.code === selectedTool.isoInsert.thicknessCode);
  const selectedCR = CORNER_RADII.find(d => d.code === selectedTool.isoInsert.cornerRadiusCode);

  const [view3D, setView3D] = useState(true);
  const [useAdaptive, setUseAdaptive] = useState(true);

  const defaultGrooves = useMemo(() => [
    { zCenter: -(stock.length * 0.25), depth: stock.outerDiameter * 0.06, width: stock.outerDiameter * 0.08, radius: 2 },
    { zCenter: -(stock.length * 0.50), depth: stock.outerDiameter * 0.10, width: stock.outerDiameter * 0.11, radius: 3 },
    { zCenter: -(stock.length * 0.75), depth: stock.outerDiameter * 0.06, width: stock.outerDiameter * 0.08, radius: 2 },
  ], [stock.length, stock.outerDiameter]);

  const adaptiveResult = useMemo(() => {
    if (!useAdaptive) return null;
    return generateFullRollCamProgram(
      {
        stockRadius: stock.outerDiameter / 2,
        finishRadius: stock.outerDiameter / 2 * 0.82,
        stockLength: stock.length,
        boreDiameter: stock.innerDiameter || stock.outerDiameter * 0.35,
        grooves: defaultGrooves,
      },
      calcMaterial,
      selectedCR?.mm ?? 0.8,
      12,
      5
    );
  }, [useAdaptive, stock, calcMaterial, defaultGrooves]);

  const simMoves = useMemo(() => {
    if (useAdaptive && adaptiveResult) {
      return adaptiveResult.moves.map(m => ({ x: m.x, z: m.z, type: m.type }));
    }
    return buildSimMoves(stock);
  }, [stock, useAdaptive, adaptiveResult]);

  const feedMmMin = useMemo(() => {
    const rpmEst = Math.round((150 * 1000) / (Math.PI * stock.outerDiameter));
    return 0.25 * rpmEst;
  }, [stock.outerDiameter]);

  const cycleTimeSec = useMemo(() => {
    if (useAdaptive && adaptiveResult) return adaptiveResult.estimatedCycleTimeSec;
    return estimateCycleTime(simMoves, feedMmMin);
  }, [simMoves, feedMmMin, useAdaptive, adaptiveResult]);

  const collisionResults = useMemo(() => {
    const toolGeo: ToolGeometry = {
      holderWidth: selectedTool.holder.shankWidth,
      holderHeight: selectedTool.holder.shankThickness,
      holderLength: selectedTool.holder.toolLength,
      insertNoseRadius: selectedCR?.mm ?? 0.8,
      insertLength: selectedIC?.mm ?? 9.52,
      insertAngleDeg: INSERT_SHAPES[selectedTool.isoInsert.insertShape]?.deg ?? 55,
    };
    const workpiece: WorkpieceGeometry = {
      stockRadius: stock.outerDiameter / 2,
      stockLength: stock.length,
      boreDiameter: stock.innerDiameter || stock.outerDiameter * 0.35,
      chuckLength: 50,
      finishRadius: stock.outerDiameter / 2 * 0.82,
      grooves: defaultGrooves,
    };
    return runFullPreFlightCheck(simMoves, toolGeo, workpiece);
  }, [simMoves, selectedTool, stock, defaultGrooves, selectedCR, selectedIC]);

  const opRibbon: { id: string; label: string }[] = [
    { id: "Face", label: "Face" },
    { id: "Turning", label: "Turning" },
    { id: "Drilling", label: "Drilling" },
    { id: "Threading", label: "Threading" },
    { id: "Grooving", label: "Grooving" },
    { id: "AngledGrooving", label: "Angled Grooving" },
    { id: "Cutoff", label: "Cutoff" },
    { id: "ManualTurning", label: "Manual Turning" },
    { id: "Trochoidal", label: "Trochoidal" },
    { id: "BalancedRough", label: "Balanced Rough" },
    { id: "SimTilted", label: "Sim. tilted" },
    { id: "MCO", label: "MCO" },
  ];
  const [activeOp, setActiveOp] = useState("Turning");

  const sections: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: "turret",   label: "Turret & Tools",      icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: "insert",   label: "Insert Data (ISO)",    icon: <Eye className="w-3.5 h-3.5" /> },
    { id: "holder",   label: "Tool Holder",          icon: <Package className="w-3.5 h-3.5" /> },
    { id: "opdata",   label: "Turning Operation",    icon: <RotateCw className="w-3.5 h-3.5" /> },
    { id: "machine",  label: "Machine Setup",        icon: <Settings className="w-3.5 h-3.5" /> },
    { id: "stock",    label: "Stock Definition",     icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "calc",     label: "Cutting Calc",         icon: <Calculator className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-[#070710] text-zinc-100">

      <div className="w-[340px] flex-shrink-0 border-r border-white/[0.06] bg-[#0B0B18] flex flex-col overflow-hidden">

        <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-amber-400 tracking-widest uppercase">TurnAxis CAM Turning</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">Machine: {machine.machineName}</div>
            </div>
            <div className="text-[9px] text-zinc-600 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
              Tool [{selectedToolPos}] ({selectedTool.toolType} {INSERT_SHAPES[selectedTool.isoInsert.insertShape]?.deg}° R{selectedCR?.mm})
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 overflow-x-auto no-scrollbar border-b border-white/[0.05]">
          <div className="flex gap-0.5 px-2 py-1.5 min-w-max">
            {opRibbon.map(op => (
              <button key={op.id} onClick={() => setActiveOp(op.id)}
                className={`px-2 py-1 text-[9px] font-medium rounded transition-all whitespace-nowrap ${
                  activeOp === op.id
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "text-zinc-600 hover:text-zinc-400 border border-transparent"
                }`}>
                {op.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 flex overflow-x-auto no-scrollbar gap-1 px-2 py-1.5 border-b border-white/[0.05]">
          {sections.map(s => (
            <button key={s.id} onClick={() => setActivePanel(s.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium transition-all border ${
                activePanel === s.id
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
              }`}>
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">

          {activePanel === "turret" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-300">Turret — {machine.machineName}</div>
              <div className="grid grid-cols-5 gap-1.5">
                {turretTools.map(tool => {
                  const tIcon = TURRET_ICONS[tool.toolType];
                  const isSelected = tool.position === selectedToolPos;
                  return (
                    <button key={tool.position} onClick={() => setSelectedToolPos(tool.position)}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-blue-500/15 border-blue-500/40 ring-1 ring-blue-500/20"
                          : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-600"
                      }`}>
                      <span className="text-[10px] font-bold" style={{ color: tIcon.color }}>{tIcon.icon}</span>
                      <span className={`text-[9px] font-mono ${isSelected ? "text-white" : "text-zinc-500"}`}>{tool.position}</span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-400 font-mono">
                    T{selectedToolPos.toString().padStart(2, "0")} — {selectedTool.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded text-xs" style={{ color: TURRET_ICONS[selectedTool.toolType].color, background: TURRET_ICONS[selectedTool.toolType].color + "15" }}>
                    {selectedTool.toolType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Tool Type</label>
                    <select value={selectedTool.toolType} onChange={e => updateTool(selectedToolPos, { toolType: e.target.value as any })} className={selectCls}>
                      <option value="Profile">Profile</option>
                      <option value="Groove">Groove</option>
                      <option value="Thread">Thread</option>
                      <option value="Drill">Drill</option>
                      <option value="Boring">Boring</option>
                      <option value="Parting">Parting</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Insert Name</label>
                    <input value={selectedTool.name} onChange={e => updateTool(selectedToolPos, { name: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div className="text-[9px] text-zinc-600 font-mono">ISO: {getInsertISOCode(selectedTool.isoInsert)}</div>
              </div>

              <div className="space-y-1">
                {turretTools.map(tool => (
                  <button key={tool.position} onClick={() => setSelectedToolPos(tool.position)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-all ${
                      tool.position === selectedToolPos ? "bg-blue-500/10 border-blue-500/30 border" : "hover:bg-zinc-900"
                    }`}>
                    <span className="w-5 text-center text-[10px] font-bold" style={{ color: TURRET_ICONS[tool.toolType].color }}>{tool.position}</span>
                    <span className="text-[10px] font-mono text-zinc-400 flex-1">{tool.name}</span>
                    <span className="text-[9px] text-zinc-600">{tool.toolType}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activePanel === "insert" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-300">Insert Parameter Data (ISO)</div>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                  <label className="flex items-center gap-1"><input type="radio" name="unit" defaultChecked className="accent-amber-500" /> mm</label>
                  <label className="flex items-center gap-1"><input type="radio" name="unit" className="accent-amber-500" /> inch</label>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input value={selectedTool.name} onChange={e => updateTool(selectedToolPos, { name: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Insert Shape</label>
                    <select value={selectedTool.isoInsert.insertShape} onChange={e => updateInsert(selectedToolPos, { insertShape: e.target.value })} className={selectCls}>
                      {Object.entries(INSERT_SHAPES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Clearance angle (β)</label>
                    <select value={selectedTool.isoInsert.clearanceAngle} onChange={e => updateInsert(selectedToolPos, { clearanceAngle: e.target.value })} className={selectCls}>
                      {Object.entries(CLEARANCE_ANGLES).map(([k, v]) => (
                        <option key={k} value={k}>{k} — {v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tolerance</label>
                    <select value={selectedTool.isoInsert.toleranceClass} onChange={e => updateInsert(selectedToolPos, { toleranceClass: e.target.value })} className={selectCls}>
                      {Object.entries(TOLERANCE_CLASSES).map(([k, v]) => (
                        <option key={k} value={k}>{k} — {v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Cross Section</label>
                    <select value={selectedTool.isoInsert.crossSection} onChange={e => updateInsert(selectedToolPos, { crossSection: e.target.value })} className={selectCls}>
                      {Object.entries(CROSS_SECTIONS).map(([k, v]) => (
                        <option key={k} value={k}>{k} — {v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>IC Diameter (D)</label>
                    <select value={selectedTool.isoInsert.icDiameterCode} onChange={e => updateInsert(selectedToolPos, { icDiameterCode: e.target.value })} className={selectCls}>
                      {IC_DIAMETERS.map(d => (
                        <option key={d.code} value={d.code}>{d.code} ({d.mm}mm)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Thickness (T)</label>
                    <select value={selectedTool.isoInsert.thicknessCode} onChange={e => updateInsert(selectedToolPos, { thicknessCode: e.target.value })} className={selectCls}>
                      {INSERT_THICKNESSES.map(d => (
                        <option key={d.code} value={d.code}>{d.code} ({d.mm}mm)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Corner radius (R)</label>
                    <select value={selectedTool.isoInsert.cornerRadiusCode} onChange={e => updateInsert(selectedToolPos, { cornerRadiusCode: e.target.value })} className={selectCls}>
                      {CORNER_RADII.map(d => (
                        <option key={d.code} value={d.code}>{d.code} ({d.mm}mm)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Cutting edge formation</label>
                    <select value={selectedTool.isoInsert.cuttingEdge} onChange={e => updateInsert(selectedToolPos, { cuttingEdge: e.target.value })} className={selectCls}>
                      {Object.entries(CUTTING_EDGES).map(([k, v]) => (
                        <option key={k} value={k}>{k} — {v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 min-w-[90px]">
                  <div className="text-[9px] text-zinc-500 text-center">Top View</div>
                  <InsertShapeSVG shape={selectedTool.isoInsert.insertShape} size={80} />
                  <div className="text-[8px] text-zinc-600 space-y-0.5 text-center">
                    <div style={{ color: "#3b82f6" }}>R = {selectedCR?.mm ?? 0}mm</div>
                    <div style={{ color: "#22c55e" }}>D = {selectedIC?.mm ?? 0}mm</div>
                    <div style={{ color: "#f59e0b" }}>T = {selectedThickness?.mm ?? 0}mm</div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/60 rounded-lg p-2 text-[10px] text-zinc-500 border border-zinc-800 font-mono text-center">
                ISO Code: <span className="text-amber-400 font-bold">{getInsertISOCode(selectedTool.isoInsert)}</span>
              </div>
            </div>
          )}

          {activePanel === "holder" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-300">Tool Holder — T{selectedToolPos.toString().padStart(2, "0")}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Shape</label>
                  <select value={selectedTool.holder.shape} onChange={e => updateHolder(selectedToolPos, { shape: e.target.value })} className={selectCls}>
                    {HOLDER_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Shank Type</label>
                  <select value={selectedTool.holder.shankType} onChange={e => updateHolder(selectedToolPos, { shankType: e.target.value })} className={selectCls}>
                    {SHANK_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Insert Clamping</label>
                  <select value={selectedTool.holder.insertClamping} onChange={e => updateHolder(selectedToolPos, { insertClamping: e.target.value })} className={selectCls}>
                    {Object.entries(CLAMPING_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{k} — {v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Insert Shape</label>
                  <select value={selectedTool.isoInsert.insertShape} disabled className={selectCls + " opacity-60"}>
                    {Object.entries(INSERT_SHAPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Insert Lead Angle</label>
                  <select value={selectedTool.holder.insertLeadAngle} onChange={e => updateHolder(selectedToolPos, { insertLeadAngle: e.target.value })} className={selectCls}>
                    {LEAD_ANGLES.map(a => <option key={a.code} value={a.code}>{a.code} ({a.deg}°)</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Cutting Direction</label>
                  <select value={selectedTool.holder.cuttingDirection} onChange={e => updateHolder(selectedToolPos, { cuttingDirection: e.target.value as any })} className={selectCls}>
                    <option value="L">L — Left</option>
                    <option value="R">R — Right</option>
                    <option value="N">N — Neutral</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <NumInput label="Shank Thickness" unit="mm" value={selectedTool.holder.shankThickness} onChange={v => updateHolder(selectedToolPos, { shankThickness: v })} step={1} min={10} />
                <NumInput label="Shank Width (A)" unit="mm" value={selectedTool.holder.shankWidth} onChange={v => updateHolder(selectedToolPos, { shankWidth: v })} step={1} min={10} />
                <NumInput label="Tool Length (L)" unit="mm" value={selectedTool.holder.toolLength} onChange={v => updateHolder(selectedToolPos, { toolLength: v })} step={10} min={50} />
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center justify-center">
                <svg width={160} height={80} viewBox="0 0 160 80">
                  <rect x={10} y={15} width={80} height={50} fill="#334155" stroke="#64748b" strokeWidth={1} rx={2} />
                  <polygon points="90,25 130,35 130,45 90,55" fill="#f59e0b" fillOpacity={0.4} stroke="#f59e0b" strokeWidth={1} />
                  <line x1={80} y1={10} x2={80} y2={70} stroke="#94a3b8" strokeWidth={0.5} strokeDasharray="2,2" />
                  <text x={45} y={45} textAnchor="middle" fontSize={7} fill="#94a3b8">A</text>
                  <text x={45} y={12} textAnchor="middle" fontSize={6} fill="#64748b">{selectedTool.holder.shankWidth}mm</text>
                  <line x1={10} y1={8} x2={90} y2={8} stroke="#64748b" strokeWidth={0.5} markerEnd="url(#arrow)" />
                  <text x={115} y={55} textAnchor="middle" fontSize={6} fill="#f59e0b">{INSERT_SHAPES[selectedTool.isoInsert.insertShape]?.deg}°</text>
                  <text x={140} y={45} fontSize={6} fill="#94a3b8">N {LEAD_ANGLES.find(a => a.code === selectedTool.holder.insertLeadAngle)?.deg ?? 95}°</text>
                </svg>
              </div>
            </div>
          )}

          {activePanel === "opdata" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-300">Turning Operation — {activeOp}</div>
              <div className="text-[10px] text-zinc-600">Operation: TR_contour | Template: MY MACHINE</div>

              <div className="flex gap-0.5 border-b border-zinc-800 pb-1">
                {(["tool", "data", "feedpoints", "origin", "coolant", "toolchange"] as OpSubTab[]).map(tab => (
                  <button key={tab} onClick={() => setOpSubTab(tab)}
                    className={`px-2 py-1 text-[9px] font-medium rounded-t transition-all capitalize ${
                      opSubTab === tab ? "bg-zinc-800 text-amber-400 border border-b-0 border-zinc-700" : "text-zinc-600 hover:text-zinc-400"
                    }`}>
                    {tab === "feedpoints" ? "Feed Points" : tab === "toolchange" ? "Tool change position" : tab === "origin" ? "Origin position" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {opSubTab === "tool" && (
                <div className="space-y-2">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-center">
                    <InsertShapeSVG shape={selectedTool.isoInsert.insertShape} size={90} />
                    <div className="text-[10px] text-amber-400 font-mono mt-1">{selectedTool.name}</div>
                    <div className="text-[9px] text-zinc-500">R={selectedCR?.mm}mm | IC={selectedIC?.mm}mm | T={selectedThickness?.mm}mm</div>
                  </div>
                </div>
              )}

              {opSubTab === "data" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Feed</div>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-500 mb-1">
                        <label className="flex items-center gap-1">
                          <input type="radio" name="feedunit" checked={selectedTool.opData.feedUnit === "mm_min"} onChange={() => updateOpData(selectedToolPos, { feedUnit: "mm_min" })} className="accent-amber-500" /> F (mm/min)
                        </label>
                        <label className="flex items-center gap-1">
                          <input type="radio" name="feedunit" checked={selectedTool.opData.feedUnit === "mm_rev"} onChange={() => updateOpData(selectedToolPos, { feedUnit: "mm_rev" })} className="accent-amber-500" /> F (mm/rev)
                        </label>
                      </div>
                      <NumInput label="Feed normal" value={selectedTool.opData.feedNormal} onChange={v => updateOpData(selectedToolPos, { feedNormal: v })} step={0.001} min={0.001} />
                      <NumInput label="Feed finish" value={selectedTool.opData.feedFinish} onChange={v => updateOpData(selectedToolPos, { feedFinish: v })} step={0.001} min={0.001} />
                      <div>
                        <label className={labelCls}>Feed lead in</label>
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] text-zinc-600 flex items-center gap-0.5"><input type="radio" name="leadin" className="accent-amber-500" /> %</label>
                          <label className="text-[9px] text-zinc-600 flex items-center gap-0.5"><input type="radio" name="leadin" defaultChecked className="accent-amber-500" /> Value</label>
                          <input type="number" value={selectedTool.opData.feedLeadIn} step={0.001}
                            onChange={e => updateOpData(selectedToolPos, { feedLeadIn: parseFloat(e.target.value) || 0 })}
                            className={inputCls + " w-20"} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Feed lead out</label>
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] text-zinc-600 flex items-center gap-0.5"><input type="radio" name="leadout" className="accent-amber-500" /> %</label>
                          <label className="text-[9px] text-zinc-600 flex items-center gap-0.5"><input type="radio" name="leadout" defaultChecked className="accent-amber-500" /> Value</label>
                          <input type="number" value={selectedTool.opData.feedLeadOut} step={0.001}
                            onChange={e => updateOpData(selectedToolPos, { feedLeadOut: parseFloat(e.target.value) || 0 })}
                            className={inputCls + " w-20"} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Spin</div>
                      <div className="space-y-1.5">
                        <div className="text-[9px] text-zinc-500 font-medium">Spin rate</div>
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] text-zinc-600 flex items-center gap-0.5"><input type="radio" name="spinmode" checked={selectedTool.opData.spinMode === "rpm"} onChange={() => updateOpData(selectedToolPos, { spinMode: "rpm" })} className="accent-amber-500" /> S (rpm)</label>
                          <label className="text-[9px] text-zinc-600 flex items-center gap-0.5"><input type="radio" name="spinmode" checked={selectedTool.opData.spinMode === "css"} onChange={() => updateOpData(selectedToolPos, { spinMode: "css" })} className="accent-amber-500" /> V (m/min)</label>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <input type="number" value={selectedTool.opData.spinRateRpm} className={inputCls + " text-[10px]"} readOnly />
                            <span className="text-[8px] text-zinc-600">rpm</span>
                          </div>
                          <div>
                            <input type="number" value={selectedTool.opData.spinRateVc} step={5}
                              onChange={e => updateOpData(selectedToolPos, { spinRateVc: parseFloat(e.target.value) || 200 })}
                              className={inputCls + " text-[10px]"} />
                            <span className="text-[8px] text-zinc-600">m/min</span>
                          </div>
                        </div>
                        <div className="text-[8px] text-zinc-600 bg-zinc-900 rounded px-1.5 py-0.5 border border-zinc-800">
                          {selectedTool.opData.gearRange}(0- {selectedTool.opData.maxSpindleRpm}rpm, {selectedTool.opData.gearPower}kW)
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[9px] text-zinc-500 font-medium">Spin finish</div>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <input type="number" value={selectedTool.opData.spinFinishRpm} className={inputCls + " text-[10px]"} readOnly />
                            <span className="text-[8px] text-zinc-600">rpm</span>
                          </div>
                          <div>
                            <input type="number" value={selectedTool.opData.spinFinishVc} step={5}
                              onChange={e => updateOpData(selectedToolPos, { spinFinishVc: parseFloat(e.target.value) || 225 })}
                              className={inputCls + " text-[10px]"} />
                            <span className="text-[8px] text-zinc-600">m/min</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <input type="checkbox" checked={selectedTool.opData.autoGearSwitching}
                          onChange={e => updateOpData(selectedToolPos, { autoGearSwitching: e.target.checked })}
                          className="accent-amber-500" />
                        <span className="text-[10px] text-zinc-400">Auto Gear-switching</span>
                      </div>
                      <NumInput label="Reference" value={selectedTool.opData.referenceDia} onChange={v => updateOpData(selectedToolPos, { referenceDia: v })} step={0.1} />
                      <div className="grid grid-cols-2 gap-1">
                        <NumInput label="Min. Spin (rpm)" value={selectedTool.opData.minSpinRpm} onChange={v => updateOpData(selectedToolPos, { minSpinRpm: v })} step={10} min={0} />
                        <NumInput label="Max. Spin" value={selectedTool.opData.maxSpinRpm} onChange={v => updateOpData(selectedToolPos, { maxSpinRpm: v })} step={10} min={100} />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-3 space-y-2">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Safety parameters
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <NumInput label="Safety angle" value={selectedTool.opData.safetyAngle} onChange={v => updateOpData(selectedToolPos, { safetyAngle: v })} step={1} min={0} />
                      <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <input type="checkbox" checked={selectedTool.opData.holderProtection}
                            onChange={e => updateOpData(selectedToolPos, { holderProtection: e.target.checked })}
                            className="accent-amber-500" />
                          Holder protection
                        </label>
                      </div>
                      <NumInput label="Holder safety" value={selectedTool.opData.holderSafety} onChange={v => updateOpData(selectedToolPos, { holderSafety: v })} step={0.5} min={0} />
                    </div>
                  </div>
                </div>
              )}

              {opSubTab === "coolant" && (
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-400 font-bold">Coolant Settings</div>
                  <div className="space-y-1.5">
                    {["M08 — Flood Coolant", "M07 — Mist Coolant", "M09 — Coolant OFF"].map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-[10px] text-zinc-400 cursor-pointer">
                        <input type="radio" name="coolant" defaultChecked={opt.startsWith("M08")} className="accent-amber-500" /> {opt}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {opSubTab === "origin" && (
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-400 font-bold">Origin Position</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Work Offset</label>
                      <select className={selectCls}>
                        <option>G54</option><option>G55</option><option>G56</option><option>G57</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Z0 Reference</label>
                      <select className={selectCls}>
                        <option>Part Face</option><option>Chuck Face</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {opSubTab === "toolchange" && (
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-400 font-bold">Tool Change Position</div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="Safe X" unit="mm" value={135} onChange={() => {}} step={5} />
                    <NumInput label="Safe Z" unit="mm" value={50} onChange={() => {}} step={5} />
                  </div>
                  <div className="bg-zinc-900/60 rounded p-2 text-[9px] text-zinc-500 border border-zinc-800">
                    G28 U0. W0. (Home position before tool change)
                  </div>
                </div>
              )}

              {opSubTab === "feedpoints" && (
                <div className="space-y-2">
                  <div className="text-[10px] text-zinc-400 font-bold">Feed Points</div>
                  <div className="bg-zinc-900/60 rounded p-2 text-[9px] text-zinc-500 border border-zinc-800 space-y-1">
                    <div>Start point: Approach from safe position</div>
                    <div>Entry: Linear approach at feed lead-in rate</div>
                    <div>Cutting: Main feed normal rate</div>
                    <div>Exit: Linear retract at feed lead-out rate</div>
                    <div>End point: Return to safe position (rapid)</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activePanel === "machine" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-300 mb-2">Machine Setup</div>
              <div>
                <label className={labelCls}>Machine Name</label>
                <input value={machine.machineName} onChange={e => setMachine({ ...machine, machineName: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Machine Type</label>
                <select value={machine.machineType} onChange={e => setMachine({ ...machine, machineType: e.target.value as any })} className={selectCls}>
                  <option value="flatbed">Flatbed Lathe</option>
                  <option value="slanedbed">Slant-bed CNC Lathe</option>
                  <option value="swiss">Swiss-type Lathe</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Chuck Type</label>
                  <select value={machine.chuck} onChange={e => setMachine({ ...machine, chuck: e.target.value as any })} className={selectCls}>
                    <option value="3jaw">3-Jaw Self-Centering</option>
                    <option value="4jaw">4-Jaw Independent</option>
                    <option value="collet">Collet Chuck</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Turret</label>
                  <select value={machine.turret} onChange={e => setMachine({ ...machine, turret: e.target.value as any })} className={selectCls}>
                    <option value="8pos">8-Position</option>
                    <option value="12pos">12-Position</option>
                    <option value="vdi40">VDI-40</option>
                  </select>
                </div>
                <NumInput label="Max Spindle RPM" value={machine.maxSpindleRpm} onChange={v => setMachine({ ...machine, maxSpindleRpm: v })} step={100} min={100} />
              </div>
            </div>
          )}

          {activePanel === "stock" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-zinc-300 mb-2">Stock Definition</div>
              <div>
                <label className={labelCls}>Stock Form</label>
                <select value={stock.form} onChange={e => setStock({ ...stock, form: e.target.value as any })} className={selectCls}>
                  <option value="bar">Round Bar</option>
                  <option value="tube">Tube / Hollow</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="Outer Diameter" unit="mm" value={stock.outerDiameter} onChange={v => setStock({ ...stock, outerDiameter: v })} step={1} min={5} />
                {stock.form === "tube" && <NumInput label="Inner Diameter" unit="mm" value={stock.innerDiameter} onChange={v => setStock({ ...stock, innerDiameter: v })} step={1} min={0} />}
                <NumInput label="Length" unit="mm" value={stock.length} onChange={v => setStock({ ...stock, length: v })} step={1} min={5} />
                <NumInput label="X Allowance" unit="mm" value={stock.allowanceX} onChange={v => setStock({ ...stock, allowanceX: v })} step={0.1} min={0} />
                <NumInput label="Z Allowance" unit="mm" value={stock.allowanceZ} onChange={v => setStock({ ...stock, allowanceZ: v })} step={0.1} min={0} />
              </div>
            </div>
          )}

          {activePanel === "calc" && (
            <div className="space-y-4">
              <div className="text-xs font-bold text-zinc-300 mb-2">Cutting Parameter Calculator</div>
              <div>
                <label className={labelCls}>Work Material</label>
                <select value={calcMaterial} onChange={e => setCalcMaterial(e.target.value as TurningMaterial)} className={selectCls}>
                  {(Object.entries(MATERIAL_VC) as [TurningMaterial, typeof MATERIAL_VC[TurningMaterial]][]).map(([k, v]) => (
                    <option key={k} value={k}>{k} — {v.label}</option>
                  ))}
                </select>
              </div>
              <NumInput label="Workpiece Diameter" unit="mm" value={calcDiameter} onChange={setCalcDiameter} step={1} min={1} />
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-2.5 text-center">
                  <div className="text-[9px] text-blue-400 mb-0.5">Spindle RPM</div>
                  <div className="text-xl font-bold text-blue-300">{calcResult.rpm.toLocaleString()}</div>
                  <div className="text-[8px] text-zinc-600">Vc = {calcResult.vc} m/min</div>
                </div>
                <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-2.5 text-center">
                  <div className="text-[9px] text-green-400 mb-0.5">Feed Rate</div>
                  <div className="text-xl font-bold text-green-300">{calcResult.f}</div>
                  <div className="text-[8px] text-zinc-600">mm/rev = {calcResult.feedMmMin.toFixed(0)} mm/min</div>
                </div>
                <div className="bg-amber-900/30 border border-amber-700/40 rounded-xl p-2.5 text-center">
                  <div className="text-[9px] text-amber-400 mb-0.5">Depth of Cut</div>
                  <div className="text-xl font-bold text-amber-300">{calcResult.doc}</div>
                  <div className="text-[8px] text-zinc-600">mm (rough)</div>
                </div>
                <div className="bg-purple-900/30 border border-purple-700/40 rounded-xl p-2.5 text-center">
                  <div className="text-[9px] text-purple-400 mb-0.5">Surface Ra</div>
                  <div className="text-xl font-bold text-purple-300">{calcResult.raUm}</div>
                  <div className="text-[8px] text-zinc-600">µm (r=0.8mm)</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#0B0B18]/80 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-300">
              {view3D ? "3D CNC Turning Simulation" : "2D Lathe Simulation (XZ Plane)"}
            </span>
            <span className="text-[10px] text-zinc-600">Ø{stock.outerDiameter} × {stock.length} mm</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {collisionResults.filter(r => r.hasCollision).length > 0 && (
              <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {collisionResults.filter(r => r.severity === "critical").length} critical,{" "}
                {collisionResults.filter(r => r.severity === "warning").length} warnings
              </span>
            )}
            {collisionResults.filter(r => r.hasCollision).length === 0 && simMoves.length > 1 && (
              <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded-full">
                ✓ No collisions
              </span>
            )}
            {useAdaptive && (
              <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/25 px-2 py-0.5 rounded-full">
                Adaptive + Trochoidal
              </span>
            )}
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {simMoves.length} moves · Cycle ≈ {cycleTimeSec.toFixed(1)}s
            </span>
            <button
              onClick={() => setUseAdaptive(v => !v)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${useAdaptive
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}
            >
              {useAdaptive ? "Adaptive ON" : "Adaptive OFF"}
            </button>
            <div className="flex items-center bg-zinc-900 border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => setView3D(false)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] transition-colors ${!view3D
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-white/5"}`}
              >
                <Monitor className="w-3 h-3" /> 2D
              </button>
              <button
                onClick={() => setView3D(true)}
                className={`flex items-center gap-1 px-2 py-1 text-[10px] transition-colors ${view3D
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-white/5"}`}
              >
                <Box className="w-3 h-3" /> 3D
              </button>
            </div>
          </div>
        </div>

        {collisionResults.filter(r => r.hasCollision && r.severity === "critical").length > 0 && (
          <div className="flex-shrink-0 bg-red-950/50 border-b border-red-700/30 px-4 py-2 space-y-0.5 max-h-20 overflow-y-auto">
            {collisionResults.filter(r => r.severity === "critical").slice(0, 3).map((c, i) => (
              <div key={i} className="text-[10px] text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 text-red-500" />
                {c.description}
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {view3D ? (
            <LatheSimulator3D
              moves={adaptiveResult?.moves ?? simMoves}
              stockDiameter={stock.outerDiameter}
              stockLength={stock.length}
              chuckLength={50}
              cycleTimeSec={cycleTimeSec}
              grooves={defaultGrooves}
              finishDiameter={stock.outerDiameter * 0.82}
              boreDiameter={stock.innerDiameter || stock.outerDiameter * 0.35}
            />
          ) : (
            <LatheSimulator
              moves={simMoves}
              stockDiameter={stock.outerDiameter}
              stockLength={stock.length}
              chuckLength={50}
              cycleTimeSec={cycleTimeSec}
            />
          )}
        </div>
      </div>
    </div>
  );
}
