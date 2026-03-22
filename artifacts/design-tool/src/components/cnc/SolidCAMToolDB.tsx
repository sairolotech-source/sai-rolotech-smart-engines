import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Wrench, Search, Plus, Trash2, Copy, Download, ChevronDown, ChevronUp,
  Settings, Cpu, AlertTriangle, CheckCircle, FileText, Eye, Target,
  Layers, ArrowRight, Filter, RotateCcw, Lock, Unlock, Upload,
  Shield, Clock, Package, Hash, Crosshair
} from "lucide-react";

type ToolCategory = "turning" | "milling" | "drilling";
type ISOMatGroup = "P" | "M" | "K" | "N" | "S" | "H";
type AdminTab = "tools" | "crib" | "life" | "compensation" | "settings";

interface ISOInsertParsed {
  shapeCode: string; shapeName: string; shapeAngle: number;
  clearanceCode: string; clearanceAngle: number;
  toleranceCode: string;
  typeCode: string; typeName: string;
  sizeIC: number;
  thickness: number;
  noseRadius: number;
  fullCode: string;
}

const ISO_SHAPES: Record<string, { name: string; angle: number }> = {
  C: { name: "Rhombic 80°", angle: 80 }, D: { name: "Rhombic 55°", angle: 55 },
  E: { name: "Rhombic 75°", angle: 75 }, H: { name: "Hexagonal", angle: 120 },
  K: { name: "Parallelogram 55°", angle: 55 }, L: { name: "Rectangular", angle: 90 },
  M: { name: "Rhombic 86°", angle: 86 }, O: { name: "Octagonal", angle: 135 },
  P: { name: "Pentagonal", angle: 108 }, R: { name: "Round", angle: 360 },
  S: { name: "Square", angle: 90 }, T: { name: "Triangular", angle: 60 },
  V: { name: "Rhombic 35°", angle: 35 }, W: { name: "Trigon 80°", angle: 80 },
};
const ISO_CLEARANCE: Record<string, number> = { A: 3, B: 5, C: 7, D: 15, E: 20, F: 25, G: 30, N: 0, P: 11 };
const ISO_TYPE: Record<string, string> = {
  A: "With hole, no chipbreaker", C: "With hole + chipbreaker both sides",
  G: "With hole + chipbreaker one side", M: "With hole + chipbreaker both sides (precision)",
  N: "Without hole, no chipbreaker", T: "With hole, chipbreaker one side",
  U: "With hole + chipbreaker both sides (precision)", W: "With hole, no chipbreaker (precision)",
};
const ISO_IC_SIZE: Record<string, number> = { "06": 6.35, "08": 8.0, "09": 9.525, "11": 11.0, "12": 12.7, "16": 15.875, "19": 19.05, "22": 22.0, "25": 25.4 };
const ISO_THICKNESS: Record<string, number> = { "01": 1.59, "02": 2.38, "03": 3.18, "04": 4.76, "05": 5.56, "06": 6.35, "07": 7.94, "09": 9.52 };
const ISO_NOSE_R: Record<string, number> = { "00": 0, "02": 0.2, "04": 0.4, "08": 0.8, "12": 1.2, "16": 1.6, "20": 2.0, "24": 2.4, "28": 2.8, "32": 3.2 };

function parseISO1832(code: string): ISOInsertParsed | null {
  const clean = code.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length < 7) return null;
  const shapeCode = clean[0];
  const clearanceCode = clean[1];
  const toleranceCode = clean[2];
  const typeCode = clean[3];
  const shape = ISO_SHAPES[shapeCode];
  if (!shape) return null;
  const numericPart = clean.substring(4);
  const digits = numericPart.replace(/[^0-9]/g, "").substring(0, 10);
  let sizeIC = 12.7, thickness = 4.76, noseRadius = 0.8;
  if (digits.length >= 4) {
    const sizeStr = digits.substring(0, 2);
    sizeIC = ISO_IC_SIZE[sizeStr] || parseFloat(sizeStr) || 12.7;
    let thickIdx = 2;
    if (numericPart[thickIdx] && /[A-Z]/.test(numericPart[thickIdx])) {
      const alphaThick: Record<string, number> = { T: 3.97, S: 5.56, U: 6.35, W: 7.94 };
      thickness = alphaThick[numericPart[thickIdx]] || 4.76;
      thickIdx++;
      const remain = numericPart.substring(thickIdx).replace(/[^0-9]/g, "");
      if (remain.length >= 2) noseRadius = ISO_NOSE_R[remain.substring(0, 2)] || parseFloat(remain.substring(0, 2)) * 0.1 || 0.8;
    } else {
      const thickStr = digits.substring(2, 4);
      thickness = ISO_THICKNESS[thickStr] || parseFloat(thickStr) * 0.1 || 4.76;
      if (digits.length >= 6) noseRadius = ISO_NOSE_R[digits.substring(4, 6)] || parseFloat(digits.substring(4, 6)) * 0.1 || 0.8;
    }
  }
  return { shapeCode, shapeName: shape.name, shapeAngle: shape.angle, clearanceCode, clearanceAngle: ISO_CLEARANCE[clearanceCode] || 0, toleranceCode, typeCode, typeName: ISO_TYPE[typeCode] || "Standard", sizeIC, thickness, noseRadius, fullCode: code };
}

interface CuttingRec { vc: number; feed: number; doc: number; vcFinish: number; feedFinish: number; docFinish: number; }

const CUTTING_DATA: Record<ISOMatGroup, Record<string, CuttingRec>> = {
  P: { label: "Steel (Mild/Carbon/Alloy)", color: "#3b82f6", CNMG: { vc: 220, feed: 0.28, doc: 2.5, vcFinish: 280, feedFinish: 0.10, docFinish: 0.3 }, VNMG: { vc: 250, feed: 0.15, doc: 1.0, vcFinish: 300, feedFinish: 0.08, docFinish: 0.2 }, DNMG: { vc: 230, feed: 0.20, doc: 1.5, vcFinish: 280, feedFinish: 0.10, docFinish: 0.3 }, TNMG: { vc: 200, feed: 0.25, doc: 2.0, vcFinish: 260, feedFinish: 0.12, docFinish: 0.4 }, WNMG: { vc: 180, feed: 0.35, doc: 3.0, vcFinish: 240, feedFinish: 0.15, docFinish: 0.5 }, SNMG: { vc: 200, feed: 0.30, doc: 2.5, vcFinish: 250, feedFinish: 0.12, docFinish: 0.4 }, CCMT: { vc: 200, feed: 0.12, doc: 1.0, vcFinish: 260, feedFinish: 0.06, docFinish: 0.15 }, DCMT: { vc: 210, feed: 0.15, doc: 1.2, vcFinish: 270, feedFinish: 0.08, docFinish: 0.2 }, VCMT: { vc: 240, feed: 0.12, doc: 0.8, vcFinish: 300, feedFinish: 0.06, docFinish: 0.15 }, TCMT: { vc: 190, feed: 0.18, doc: 1.5, vcFinish: 250, feedFinish: 0.08, docFinish: 0.2 }, SCMT: { vc: 190, feed: 0.22, doc: 2.0, vcFinish: 240, feedFinish: 0.10, docFinish: 0.3 }, RCMT: { vc: 180, feed: 0.15, doc: 1.0, vcFinish: 230, feedFinish: 0.08, docFinish: 0.2 } } as any,
  M: { label: "Stainless Steel", color: "#f59e0b", CNMG: { vc: 160, feed: 0.22, doc: 2.0, vcFinish: 200, feedFinish: 0.08, docFinish: 0.2 }, VNMG: { vc: 180, feed: 0.12, doc: 0.8, vcFinish: 220, feedFinish: 0.06, docFinish: 0.15 }, DNMG: { vc: 170, feed: 0.18, doc: 1.2, vcFinish: 210, feedFinish: 0.08, docFinish: 0.2 }, TNMG: { vc: 150, feed: 0.20, doc: 1.5, vcFinish: 190, feedFinish: 0.10, docFinish: 0.3 }, WNMG: { vc: 140, feed: 0.28, doc: 2.5, vcFinish: 180, feedFinish: 0.12, docFinish: 0.4 }, SNMG: { vc: 150, feed: 0.25, doc: 2.0, vcFinish: 190, feedFinish: 0.10, docFinish: 0.3 }, CCMT: { vc: 150, feed: 0.10, doc: 0.8, vcFinish: 200, feedFinish: 0.05, docFinish: 0.12 }, DCMT: { vc: 160, feed: 0.12, doc: 1.0, vcFinish: 210, feedFinish: 0.06, docFinish: 0.15 }, VCMT: { vc: 170, feed: 0.10, doc: 0.6, vcFinish: 220, feedFinish: 0.05, docFinish: 0.1 }, TCMT: { vc: 140, feed: 0.15, doc: 1.2, vcFinish: 180, feedFinish: 0.06, docFinish: 0.15 }, SCMT: { vc: 140, feed: 0.18, doc: 1.5, vcFinish: 180, feedFinish: 0.08, docFinish: 0.2 }, RCMT: { vc: 130, feed: 0.12, doc: 0.8, vcFinish: 170, feedFinish: 0.06, docFinish: 0.15 } } as any,
  K: { label: "Cast Iron", color: "#ef4444", CNMG: { vc: 250, feed: 0.30, doc: 3.0, vcFinish: 320, feedFinish: 0.12, docFinish: 0.3 }, VNMG: { vc: 280, feed: 0.18, doc: 1.5, vcFinish: 350, feedFinish: 0.08, docFinish: 0.2 }, DNMG: { vc: 260, feed: 0.22, doc: 2.0, vcFinish: 330, feedFinish: 0.10, docFinish: 0.3 }, TNMG: { vc: 230, feed: 0.28, doc: 2.5, vcFinish: 300, feedFinish: 0.12, docFinish: 0.4 }, WNMG: { vc: 200, feed: 0.35, doc: 3.5, vcFinish: 270, feedFinish: 0.15, docFinish: 0.5 }, SNMG: { vc: 230, feed: 0.30, doc: 3.0, vcFinish: 300, feedFinish: 0.12, docFinish: 0.4 }, CCMT: { vc: 230, feed: 0.15, doc: 1.5, vcFinish: 300, feedFinish: 0.08, docFinish: 0.2 }, DCMT: { vc: 240, feed: 0.18, doc: 1.8, vcFinish: 310, feedFinish: 0.08, docFinish: 0.2 }, VCMT: { vc: 260, feed: 0.15, doc: 1.2, vcFinish: 330, feedFinish: 0.06, docFinish: 0.15 }, TCMT: { vc: 220, feed: 0.22, doc: 2.0, vcFinish: 280, feedFinish: 0.10, docFinish: 0.3 }, SCMT: { vc: 220, feed: 0.25, doc: 2.5, vcFinish: 280, feedFinish: 0.10, docFinish: 0.3 }, RCMT: { vc: 210, feed: 0.18, doc: 1.5, vcFinish: 270, feedFinish: 0.08, docFinish: 0.2 } } as any,
  N: { label: "Aluminium / Non-Ferrous", color: "#22c55e", CNMG: { vc: 500, feed: 0.30, doc: 3.0, vcFinish: 700, feedFinish: 0.12, docFinish: 0.3 }, VNMG: { vc: 600, feed: 0.20, doc: 1.5, vcFinish: 800, feedFinish: 0.08, docFinish: 0.2 }, DNMG: { vc: 550, feed: 0.25, doc: 2.0, vcFinish: 750, feedFinish: 0.10, docFinish: 0.3 }, TNMG: { vc: 450, feed: 0.30, doc: 2.5, vcFinish: 650, feedFinish: 0.12, docFinish: 0.4 }, WNMG: { vc: 400, feed: 0.35, doc: 3.5, vcFinish: 600, feedFinish: 0.15, docFinish: 0.5 }, SNMG: { vc: 450, feed: 0.30, doc: 3.0, vcFinish: 650, feedFinish: 0.12, docFinish: 0.4 }, CCMT: { vc: 450, feed: 0.15, doc: 1.5, vcFinish: 650, feedFinish: 0.08, docFinish: 0.2 }, DCMT: { vc: 500, feed: 0.18, doc: 2.0, vcFinish: 700, feedFinish: 0.08, docFinish: 0.2 }, VCMT: { vc: 550, feed: 0.15, doc: 1.2, vcFinish: 750, feedFinish: 0.06, docFinish: 0.15 }, TCMT: { vc: 400, feed: 0.22, doc: 2.0, vcFinish: 600, feedFinish: 0.10, docFinish: 0.3 }, SCMT: { vc: 400, feed: 0.25, doc: 2.5, vcFinish: 600, feedFinish: 0.10, docFinish: 0.3 }, RCMT: { vc: 380, feed: 0.18, doc: 1.5, vcFinish: 550, feedFinish: 0.08, docFinish: 0.2 } } as any,
  S: { label: "Super Alloys (Ti/Ni/Inconel)", color: "#a855f7", CNMG: { vc: 45, feed: 0.15, doc: 1.5, vcFinish: 60, feedFinish: 0.06, docFinish: 0.15 }, VNMG: { vc: 55, feed: 0.10, doc: 0.5, vcFinish: 70, feedFinish: 0.05, docFinish: 0.1 }, DNMG: { vc: 50, feed: 0.12, doc: 0.8, vcFinish: 65, feedFinish: 0.06, docFinish: 0.12 }, TNMG: { vc: 40, feed: 0.15, doc: 1.0, vcFinish: 55, feedFinish: 0.08, docFinish: 0.2 }, WNMG: { vc: 35, feed: 0.20, doc: 2.0, vcFinish: 50, feedFinish: 0.10, docFinish: 0.3 }, SNMG: { vc: 40, feed: 0.18, doc: 1.5, vcFinish: 55, feedFinish: 0.08, docFinish: 0.2 }, CCMT: { vc: 40, feed: 0.08, doc: 0.5, vcFinish: 55, feedFinish: 0.04, docFinish: 0.1 }, DCMT: { vc: 45, feed: 0.10, doc: 0.6, vcFinish: 60, feedFinish: 0.05, docFinish: 0.1 }, VCMT: { vc: 50, feed: 0.08, doc: 0.4, vcFinish: 65, feedFinish: 0.04, docFinish: 0.08 }, TCMT: { vc: 35, feed: 0.12, doc: 0.8, vcFinish: 50, feedFinish: 0.06, docFinish: 0.12 }, SCMT: { vc: 35, feed: 0.15, doc: 1.0, vcFinish: 50, feedFinish: 0.06, docFinish: 0.12 }, RCMT: { vc: 30, feed: 0.10, doc: 0.5, vcFinish: 45, feedFinish: 0.05, docFinish: 0.1 } } as any,
  H: { label: "Hardened Steel (HRC 45-65)", color: "#f43f5e", CNMG: { vc: 120, feed: 0.10, doc: 0.3, vcFinish: 160, feedFinish: 0.05, docFinish: 0.1 }, VNMG: { vc: 140, feed: 0.08, doc: 0.2, vcFinish: 180, feedFinish: 0.04, docFinish: 0.08 }, DNMG: { vc: 130, feed: 0.08, doc: 0.25, vcFinish: 170, feedFinish: 0.04, docFinish: 0.1 }, TNMG: { vc: 110, feed: 0.10, doc: 0.3, vcFinish: 150, feedFinish: 0.06, docFinish: 0.12 }, WNMG: { vc: 100, feed: 0.12, doc: 0.5, vcFinish: 140, feedFinish: 0.08, docFinish: 0.15 }, SNMG: { vc: 110, feed: 0.10, doc: 0.3, vcFinish: 150, feedFinish: 0.06, docFinish: 0.12 }, CCMT: { vc: 110, feed: 0.06, doc: 0.15, vcFinish: 150, feedFinish: 0.03, docFinish: 0.05 }, DCMT: { vc: 120, feed: 0.06, doc: 0.2, vcFinish: 160, feedFinish: 0.04, docFinish: 0.08 }, VCMT: { vc: 130, feed: 0.06, doc: 0.15, vcFinish: 170, feedFinish: 0.03, docFinish: 0.05 }, TCMT: { vc: 100, feed: 0.08, doc: 0.2, vcFinish: 140, feedFinish: 0.05, docFinish: 0.08 }, SCMT: { vc: 100, feed: 0.08, doc: 0.25, vcFinish: 140, feedFinish: 0.05, docFinish: 0.1 }, RCMT: { vc: 90, feed: 0.06, doc: 0.15, vcFinish: 130, feedFinish: 0.04, docFinish: 0.08 } } as any,
};

const HOLDER_FULL_DB = [
  { code: "PCLNL-2525M12", type: "External", clamp: "P-Clamp", insert: "CN", shank: "25×25", reach: 150, overhang: 40, approach: 95, leadAngle: -5 },
  { code: "PCLNR-2525M12", type: "External", clamp: "P-Clamp", insert: "CN", shank: "25×25", reach: 150, overhang: 40, approach: 95, leadAngle: 5 },
  { code: "PVJNL-2525M16", type: "External", clamp: "P-Clamp", insert: "VN", shank: "25×25", reach: 150, overhang: 45, approach: 93, leadAngle: -5 },
  { code: "PVJNR-2525M16", type: "External", clamp: "P-Clamp", insert: "VN", shank: "25×25", reach: 150, overhang: 45, approach: 93, leadAngle: 5 },
  { code: "PDJNL-2525M15", type: "External", clamp: "P-Clamp", insert: "DN", shank: "25×25", reach: 150, overhang: 42, approach: 93, leadAngle: -5 },
  { code: "PDJNR-2525M15", type: "External", clamp: "P-Clamp", insert: "DN", shank: "25×25", reach: 150, overhang: 42, approach: 93, leadAngle: 5 },
  { code: "PTGNL-2525M16", type: "External", clamp: "P-Clamp", insert: "TN", shank: "25×25", reach: 150, overhang: 38, approach: 90, leadAngle: 0 },
  { code: "MWLNL-2525M08", type: "External", clamp: "M-Clamp", insert: "WN", shank: "25×25", reach: 150, overhang: 36, approach: 95, leadAngle: -5 },
  { code: "MWLNR-2525M08", type: "External", clamp: "M-Clamp", insert: "WN", shank: "25×25", reach: 150, overhang: 36, approach: 95, leadAngle: 5 },
  { code: "MCLNL-2525M12", type: "External", clamp: "M-Clamp", insert: "CN", shank: "25×25", reach: 150, overhang: 40, approach: 95, leadAngle: -5 },
  { code: "MCLNR-2525M12", type: "External", clamp: "M-Clamp", insert: "CN", shank: "25×25", reach: 150, overhang: 40, approach: 95, leadAngle: 5 },
  { code: "SVJBL-2525M16", type: "Internal", clamp: "Screw", insert: "VN", shank: "25×25", reach: 170, overhang: 50, approach: 93, leadAngle: -5 },
  { code: "S20S-SCLCL09", type: "Internal Bore", clamp: "Screw", insert: "CC", shank: "20Ø", reach: 180, overhang: 50, approach: 95, leadAngle: -5 },
  { code: "S25S-SCLCL09", type: "Internal Bore", clamp: "Screw", insert: "CC", shank: "25Ø", reach: 200, overhang: 60, approach: 95, leadAngle: -5 },
  { code: "S32S-SCLCR09", type: "Internal Bore", clamp: "Screw", insert: "CC", shank: "32Ø", reach: 250, overhang: 80, approach: 95, leadAngle: 5 },
  { code: "S40S-SCLCR12", type: "Internal Bore", clamp: "Screw", insert: "CC", shank: "40Ø", reach: 300, overhang: 100, approach: 95, leadAngle: 5 },
  { code: "GER-2020-2", type: "Grooving", clamp: "Self-Grip", insert: "GER", shank: "20×20", reach: 120, overhang: 28, approach: 90, leadAngle: 0 },
  { code: "GER-2525-3", type: "Grooving", clamp: "Self-Grip", insert: "GER", shank: "25×25", reach: 150, overhang: 35, approach: 90, leadAngle: 0 },
  { code: "MGEHR-2020-2", type: "Grooving/Cutoff", clamp: "Self-Grip", insert: "MGEHR", shank: "20×20", reach: 120, overhang: 26, approach: 90, leadAngle: 0 },
  { code: "MGEHR-2525-3", type: "Grooving/Cutoff", clamp: "Self-Grip", insert: "MGEHR", shank: "25×25", reach: 150, overhang: 32, approach: 90, leadAngle: 0 },
  { code: "SER-2020M16", type: "Threading Ext", clamp: "Screw", insert: "16ER", shank: "20×20", reach: 120, overhang: 32, approach: 90, leadAngle: 0 },
  { code: "SER-2525M16", type: "Threading Ext", clamp: "Screw", insert: "16ER", shank: "25×25", reach: 150, overhang: 38, approach: 90, leadAngle: 0 },
  { code: "SIR-2525M16", type: "Threading Int", clamp: "Screw", insert: "16IR", shank: "25×25", reach: 150, overhang: 40, approach: 90, leadAngle: 0 },
];

const GRADE_DB = [
  { code: "GC4325", iso: "P25", coating: "CVD TiCN+Al2O3+TiN", desc: "Steel general — Sandvik", hardness: "1550 HV", matGroups: ["P"] },
  { code: "GC4315", iso: "P15", coating: "CVD TiCN+Al2O3", desc: "Steel finishing — Sandvik", hardness: "1600 HV", matGroups: ["P"] },
  { code: "GC4335", iso: "P35", coating: "CVD MT-TiCN+Al2O3", desc: "Steel heavy rough — Sandvik", hardness: "1450 HV", matGroups: ["P"] },
  { code: "GC2220", iso: "M20", coating: "PVD TiAlN", desc: "Stainless — Sandvik", hardness: "3200 HV", matGroups: ["M"] },
  { code: "GC2015", iso: "M15", coating: "PVD TiAlN+Al2O3", desc: "Stainless finishing — Sandvik", hardness: "3300 HV", matGroups: ["M"] },
  { code: "GC3210", iso: "K10", coating: "CVD Al2O3", desc: "Cast Iron — Sandvik", hardness: "1400 HV", matGroups: ["K"] },
  { code: "H13A", iso: "N10", coating: "Uncoated Carbide", desc: "Aluminium — Sandvik", hardness: "1400 HV", matGroups: ["N"] },
  { code: "H10F", iso: "N05", coating: "Uncoated Submicron", desc: "Aluminium finish — Sandvik", hardness: "1550 HV", matGroups: ["N"] },
  { code: "GC1105", iso: "S05", coating: "PVD TiAlN", desc: "Super Alloy — Sandvik", hardness: "3200 HV", matGroups: ["S"] },
  { code: "GC1115", iso: "S15", coating: "PVD TiAlN", desc: "Super Alloy medium — Sandvik", hardness: "3100 HV", matGroups: ["S"] },
  { code: "CB7015", iso: "H05", coating: "CBN", desc: "Hardened Steel — Sandvik", hardness: "3500 HV", matGroups: ["H"] },
  { code: "CB7025", iso: "H15", coating: "CBN+TiN", desc: "Hardened Steel interrupted — Sandvik", hardness: "3400 HV", matGroups: ["H"] },
  { code: "IC8150", iso: "P30", coating: "CVD MT-TiCN+Al2O3", desc: "Steel heavy — Iscar", hardness: "1500 HV", matGroups: ["P"] },
  { code: "IC328", iso: "M15", coating: "PVD TiAlN", desc: "Stainless finish — Iscar", hardness: "3100 HV", matGroups: ["M"] },
  { code: "IC907", iso: "S10", coating: "PVD TiAlN", desc: "Super Alloy — Iscar", hardness: "3200 HV", matGroups: ["S"] },
  { code: "TTK20", iso: "P20", coating: "TiN", desc: "General — Taegutec", hardness: "2500 HV", matGroups: ["P", "M"] },
  { code: "TTX25", iso: "P25", coating: "TiCN", desc: "Steel medium — Taegutec", hardness: "2800 HV", matGroups: ["P"] },
];

interface ToolEntry {
  id: string;
  name: string;
  category: ToolCategory;
  subType: string;
  isoCode: string;
  parsed: ISOInsertParsed | null;
  holderCode: string;
  gradeCode: string;
  turretPos: number;
  matGroup: ISOMatGroup;
  cuttingData: CuttingRec | null;
  notes: string;
  locked: boolean;
  isDefault: boolean;
  compDir: "G41" | "G42" | "off";
  wearOffsetX: number;
  wearOffsetZ: number;
  geoOffsetX: number;
  geoOffsetZ: number;
  toolLifeMax: number;
  toolLifeUsed: number;
  toolLifePieces: number;
  stockQty: number;
  stockMin: number;
  stockLocation: string;
  lastChanged: string;
  changedBy: string;
}

function calcFormulas(tool: ToolEntry, dia: number) {
  const cd = tool.cuttingData;
  if (!cd || dia <= 0) return null;
  const nr = tool.parsed?.noseRadius || 0.8;
  const rpm = Math.round(cd.vc * 1000 / (Math.PI * dia));
  const rpmFinish = Math.round(cd.vcFinish * 1000 / (Math.PI * dia));
  const mrrRough = cd.vc * cd.feed * cd.doc * 1000;
  const mrrFinish = cd.vcFinish * cd.feedFinish * cd.docFinish * 1000;
  const raRough = nr > 0 ? (cd.feed ** 2) / (32 * nr) * 1000 : 0;
  const raFinish = nr > 0 ? (cd.feedFinish ** 2) / (32 * nr) * 1000 : 0;
  const kc = tool.matGroup === "P" ? 2000 : tool.matGroup === "M" ? 2500 : tool.matGroup === "K" ? 1200 : tool.matGroup === "N" ? 800 : tool.matGroup === "S" ? 3000 : 3500;
  const powerRough = (cd.vc * cd.feed * cd.doc * kc) / (60 * 1000);
  const torqueRough = rpm > 0 ? (9550 * powerRough) / rpm : 0;
  const cuttingForce = kc * cd.feed * cd.doc;
  const passes = cd.doc > 0 ? Math.ceil((dia / 2) / cd.doc) : 0;
  const toolLifeRemain = tool.toolLifeMax > 0 ? Math.max(0, tool.toolLifeMax - tool.toolLifeUsed) : 0;
  const toolLifePct = tool.toolLifeMax > 0 ? Math.round((tool.toolLifeUsed / tool.toolLifeMax) * 100) : 0;
  return { rpm, rpmFinish, mrrRough, mrrFinish, raRough, raFinish, powerRough, torqueRough, cuttingForce, kc, passes, toolLifeRemain, toolLifePct };
}

let nextId = 1;
function makeId() { return `tool-${nextId++}`; }

const LS_KEY = "sai_solidcam_tooldb";
const LS_ADMIN = "sai_solidcam_admin";

function createDefaultTools(): ToolEntry[] {
  const base = { locked: false, isDefault: true, compDir: "G42" as const, wearOffsetX: 0, wearOffsetZ: 0, geoOffsetX: 0, geoOffsetZ: 0, toolLifeMax: 30, toolLifeUsed: 0, toolLifePieces: 0, stockQty: 5, stockMin: 2, stockLocation: "Turret", lastChanged: new Date().toLocaleDateString("en-IN"), changedBy: "Admin" };
  return [
    { ...base, id: makeId(), name: "T02 Neutral Tool (VNMG 16)", category: "turning", subType: "od_rough", isoCode: "VNMG 160408", parsed: parseISO1832("VNMG160408"), holderCode: "PVJNL-2525M16", gradeCode: "GC4325", turretPos: 2, matGroup: "P", cuttingData: { vc: 200, feed: 0.175, doc: 0.75, vcFinish: 225, feedFinish: 0.175, docFinish: 0.2 }, notes: "Delta 2X Station_2 — NEUTRAL TOOL (Profile type, Right orientation, CW spin, X+ output). SolidCAM: Offset 2-8, Feed 0.175 mm/rev (all), Vc 200 m/min (454 RPM), Vc finish 225 m/min (511 RPM), Max Spin 500, Ref 139.997. Rough: Smooth, Step 0.75, Adaptive, Offset X=0.6 Z=0.2, Retreat 0.2, One way. Finish: ISO-Turning method, Rest material only, 1 pass. Safety dist 2mm. Gear 0-5000rpm 15kW. VNMG 160408-E R, IC 9.52mm, Nose R 0.8mm, 4 edges. Tool numbers always 2x station.", stockLocation: "Turret Stn 2" },
    { ...base, id: makeId(), name: "T04 Ext. Grooving", category: "turning", subType: "groove_od", isoCode: "VNMG 060108", parsed: parseISO1832("VNMG060108"), holderCode: "Ext. Grooving Holder", gradeCode: "GC4315", turretPos: 4, matGroup: "P", cuttingData: { vc: 200, feed: 0.102, doc: 0.6, vcFinish: 225, feedFinish: 0.051, docFinish: 0.15 }, notes: "Delta 2X Station 4 — GROOVE type (Ext. Grooving holder). VNMG 060108-E R, V(35deg), IC 3.97mm, Th 1.59mm, Nose R 0.8mm, Lead A(90deg), Dir R, Clamp C, Shank 25x25mm, Length M(150mm). Used for contour grooving (DOWN_2, DOWN_9, NEWD4TR). G96 S200 M4 rough F0.102, G96 S225 M4 finish F0.051, G92 S500.", compDir: "G42", stockLocation: "Turret Stn 4" },
    { ...base, id: makeId(), name: "T06 Profile Finish (R0.2)", category: "turning", subType: "od_finish", isoCode: "VNMG 160402", parsed: parseISO1832("VNMG160402"), holderCode: "PVJNL-2525M16", gradeCode: "GC4315", turretPos: 6, matGroup: "P", cuttingData: { vc: 200, feed: 0.08, doc: 0.5, vcFinish: 225, feedFinish: 0.04, docFinish: 0.1 }, notes: "Delta 2X Station 6 — Profile type (Ext. Turning holder). VNMG 160402-E L, V(35deg), IC 9.52mm (16), Th 4.76mm (04), Nose R 0.2mm (02), Lead J(93deg), Dir L, Clamp C, Shank 25x25mm, Length M(150mm), M=32 N=45. Fine finishing with small R0.2 for sharp corners.", compDir: "G42", stockLocation: "Turret Stn 6" },
    { ...base, id: makeId(), name: "T08 Profile Contour (R0.8)", category: "turning", subType: "od_finish", isoCode: "VNMG 060108", parsed: parseISO1832("VNMG060108"), holderCode: "PVJNL-2020K06", gradeCode: "GC4315", turretPos: 8, matGroup: "P", cuttingData: { vc: 200, feed: 0.102, doc: 0.6, vcFinish: 225, feedFinish: 0.051, docFinish: 0.15 }, notes: "Delta 2X Station 8 — Profile type (Ext. Turning holder). VNMG 060108-E R, V(35deg), IC 3.97mm (06), Th 1.59mm (01), Nose R 0.8mm (08), Lead A(90deg), Dir R, Clamp C, Shank 25x25mm, Length M(150mm), M=25 N=25. Secondary contour (DOWN_2_T08, NEWD4TR8). G96 S200 M4 rough, G96 S225 M4 finish.", compDir: "G42", stockLocation: "Turret Stn 8" },
    { ...base, id: makeId(), name: "T10 Profile (Ext. Grooving R0.2)", category: "turning", subType: "od_finish", isoCode: "VNMG 160402", parsed: parseISO1832("VNMG160402"), holderCode: "Ext. Grooving Holder", gradeCode: "IC8150", turretPos: 10, matGroup: "P", cuttingData: { vc: 200, feed: 2.5, doc: 3.0, vcFinish: 225, feedFinish: 1.25, docFinish: 1.0 }, notes: "Delta 2X Station 10 — Profile type (Ext. Grooving holder). VNMG 160402, V(35deg), IC 9.52mm (16), Th 4.76mm (04), Nose R 0.2mm (02), Lead L(95deg), Dir L, Clamp C, Shank 25x25mm, Length M(150mm), M=32 N=23. Grooving/profiling (DOWN_9_T10). G96 S200 M4 rough F2.5, G96 S225 M4 finish F1.25.", compDir: "off", stockLocation: "Turret Stn 10" },
  ];
}

function loadTools(): ToolEntry[] {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) { const arr = JSON.parse(s); if (Array.isArray(arr) && arr.length > 0) return arr; }
  } catch { /* ignore */ }
  return createDefaultTools();
}

function saveTools(tools: ToolEntry[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(tools)); } catch { /* ignore */ }
}

function InsertSVG({ parsed, size = 60 }: { parsed: ISOInsertParsed | null; size?: number }) {
  if (!parsed) return <div className="w-full h-full bg-zinc-800 rounded flex items-center justify-center text-[8px] text-zinc-600">N/A</div>;
  const cx = size / 2, cy = size / 2, r = size * 0.35;
  const sides = parsed.shapeCode === "T" ? 3 : parsed.shapeCode === "S" ? 4 : parsed.shapeCode === "R" ? 0 :
    parsed.shapeCode === "D" || parsed.shapeCode === "V" || parsed.shapeCode === "C" || parsed.shapeCode === "E" || parsed.shapeCode === "M" || parsed.shapeCode === "W" ? 4 :
    parsed.shapeCode === "P" ? 5 : parsed.shapeCode === "H" ? 6 : parsed.shapeCode === "O" ? 8 : 4;
  if (sides === 0) {
    return (<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth={1.5} /><circle cx={cx} cy={cy - r} r={2} fill="#ef4444" /><text x={cx} y={size - 2} textAnchor="middle" fill="#71717a" fontSize={7}>{parsed.shapeCode}</text></svg>);
  }
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (Math.PI * 2 * i / sides) - Math.PI / 2;
    const rr = (sides === 4 && (parsed.shapeCode === "D" || parsed.shapeCode === "V")) ? (i % 2 === 0 ? r : r * 0.65) : r;
    pts.push(`${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pts.join(" ")} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={2.5} fill="#f59e0b" opacity={0.3} />
      <circle cx={parseFloat(pts[0].split(",")[0])} cy={parseFloat(pts[0].split(",")[1])} r={parsed.noseRadius * 3 || 2} fill="none" stroke="#ef4444" strokeWidth={1} />
      <text x={cx} y={size - 2} textAnchor="middle" fill="#71717a" fontSize={7}>{parsed.shapeCode} R{parsed.noseRadius}</text>
    </svg>
  );
}

export function SolidCAMToolDB() {
  const [tools, setTools] = useState<ToolEntry[]>(loadTools);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<ToolCategory | "all">("all");
  const [workDia, setWorkDia] = useState(160);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem(LS_ADMIN) === "true");
  const [adminTab, setAdminTab] = useState<AdminTab>("tools");
  const [isoInput, setIsoInput] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ISOInsertParsed | null>(null);

  useEffect(() => { saveTools(tools); }, [tools]);

  const selected = tools.find(t => t.id === selectedId) || null;
  const canEdit = isAdmin || (selected && !selected.locked);

  const filtered = useMemo(() => {
    return tools.filter(t => {
      if (filterCat !== "all" && t.category !== filterCat) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.isoCode.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tools, filterCat, search]);

  const updateTool = useCallback((id: string, updates: Partial<ToolEntry>) => {
    setTools(prev => prev.map(t => t.id === id ? { ...t, ...updates, lastChanged: new Date().toLocaleDateString("en-IN"), changedBy: isAdmin ? "Admin" : "Operator" } : t));
  }, [isAdmin]);

  const addTool = useCallback(() => {
    const usedPos = new Set(tools.map(t => t.turretPos));
    let np = 1; while (usedPos.has(np) && np <= 12) np++; if (np > 12) np = 12;
    const newTool: ToolEntry = {
      id: makeId(), name: "New Tool", category: "turning", subType: "od_rough", isoCode: "CNMG 120408", parsed: parseISO1832("CNMG120408"), holderCode: "PCLNL-2525M12", gradeCode: "GC4325", turretPos: np, matGroup: "P", cuttingData: (CUTTING_DATA.P as any).CNMG, notes: "", locked: false, isDefault: false, compDir: "G42", wearOffsetX: 0, wearOffsetZ: 0, geoOffsetX: 0, geoOffsetZ: 0, toolLifeMax: 30, toolLifeUsed: 0, toolLifePieces: 0, stockQty: 5, stockMin: 2, stockLocation: "", lastChanged: new Date().toLocaleDateString("en-IN"), changedBy: isAdmin ? "Admin" : "Operator",
    };
    setTools(prev => [...prev, newTool]);
    setSelectedId(newTool.id);
  }, [tools, isAdmin]);

  const cloneTool = useCallback((id: string) => {
    const src = tools.find(t => t.id === id);
    if (!src) return;
    const usedPos = new Set(tools.map(t => t.turretPos));
    let np = 1; while (usedPos.has(np) && np <= 12) np++; if (np > 12) np = 12;
    const clone: ToolEntry = { ...src, id: makeId(), name: src.name + " (Copy)", turretPos: np, locked: false, isDefault: false, lastChanged: new Date().toLocaleDateString("en-IN"), changedBy: isAdmin ? "Admin" : "Operator" };
    setTools(prev => [...prev, clone]);
    setSelectedId(clone.id);
  }, [tools, isAdmin]);

  const deleteTool = useCallback((id: string) => {
    const t = tools.find(x => x.id === id);
    if (t?.locked && !isAdmin) return;
    setTools(prev => prev.filter(x => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId, tools, isAdmin]);

  const formulas = useMemo(() => selected ? calcFormulas(selected, workDia) : null, [selected, workDia]);

  const toggleAdmin = useCallback(() => {
    const next = !isAdmin;
    setIsAdmin(next);
    localStorage.setItem(LS_ADMIN, String(next));
  }, [isAdmin]);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(tools, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "SolidCAM_ToolDB.json"; a.click();
    URL.revokeObjectURL(url);
  }, [tools]);

  const importJSON = useCallback(() => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json";
    inp.onchange = (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { const arr = JSON.parse(ev.target?.result as string); if (Array.isArray(arr)) setTools(arr); } catch { /* ignore */ }
      };
      reader.readAsText(file);
    };
    inp.click();
  }, []);

  const exportToolList = useCallback(() => {
    const lines = ["SAI ROLOTECH SMART ENGINES — SolidCAM Tool Database Export", `Date: ${new Date().toLocaleDateString("en-IN")}`, `Total Tools: ${tools.length}`, `Work Diameter: ${workDia}mm`, ""];
    tools.forEach(t => {
      const f = calcFormulas(t, workDia);
      lines.push(`═══ T${t.turretPos.toString().padStart(2, "0")} — ${t.name} ${t.locked ? "🔒" : ""} ${t.isDefault ? "★" : ""} ═══`);
      lines.push(`ISO Code: ${t.isoCode} | Grade: ${t.gradeCode} | Holder: ${t.holderCode}`);
      lines.push(`Material: ISO ${t.matGroup} | Comp: ${t.compDir} | Wear X:${t.wearOffsetX} Z:${t.wearOffsetZ}`);
      if (t.parsed) lines.push(`Insert: ${t.parsed.shapeName} | IC: ${t.parsed.sizeIC}mm | Nose R: ${t.parsed.noseRadius}mm | Clearance: ${t.parsed.clearanceAngle}°`);
      if (t.cuttingData && f) {
        lines.push(`Rough: Vc=${t.cuttingData.vc} m/min | F=${t.cuttingData.feed} mm/rev | DOC=${t.cuttingData.doc}mm | RPM=${f.rpm}`);
        lines.push(`Finish: Vc=${t.cuttingData.vcFinish} m/min | F=${t.cuttingData.feedFinish} mm/rev | DOC=${t.cuttingData.docFinish}mm | RPM=${f.rpmFinish}`);
        lines.push(`Ra rough: ${f.raRough.toFixed(1)}µm | Ra finish: ${f.raFinish.toFixed(1)}µm | Power: ${f.powerRough.toFixed(2)} kW`);
      }
      lines.push(`Tool Life: ${t.toolLifeUsed}/${t.toolLifeMax} min | Pieces: ${t.toolLifePieces} | Stock: ${t.stockQty} (min ${t.stockMin}) | Location: ${t.stockLocation}`);
      lines.push(`Last Changed: ${t.lastChanged} by ${t.changedBy}`);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "SolidCAM_ToolDB_Report.txt"; a.click();
    URL.revokeObjectURL(url);
  }, [tools, workDia]);

  const lowStock = tools.filter(t => t.stockQty <= t.stockMin);
  const expiredLife = tools.filter(t => t.toolLifeMax > 0 && t.toolLifeUsed >= t.toolLifeMax);

  const adminTabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "tools", label: "Tools", icon: <Wrench className="w-3 h-3" /> },
    { id: "compensation", label: "Compensation", icon: <Crosshair className="w-3 h-3" /> },
    { id: "life", label: "Tool Life", icon: <Clock className="w-3 h-3" /> },
    { id: "crib", label: "Tool Crib", icon: <Package className="w-3 h-3" /> },
    { id: "settings", label: "Admin", icon: <Shield className="w-3 h-3" /> },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-zinc-900/80 shrink-0">
        <Wrench className="w-5 h-5 text-amber-500" />
        <h1 className="text-sm font-bold tracking-wide text-amber-400">SolidCAM Tool Database</h1>
        <div className="flex items-center gap-1 ml-2">
          {adminTabs.map(at => (
            <button key={at.id} onClick={() => setAdminTab(at.id)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-all ${adminTab === at.id ? "bg-amber-600/20 text-amber-400 border border-amber-600/30" : "text-zinc-500 hover:text-zinc-300 border border-transparent"}`}>
              {at.icon} {at.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {(lowStock.length > 0 || expiredLife.length > 0) && (
            <div className="flex items-center gap-1 mr-2">
              {lowStock.length > 0 && <span className="text-[9px] bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded font-bold">{lowStock.length} Low Stock</span>}
              {expiredLife.length > 0 && <span className="text-[9px] bg-orange-600/20 text-orange-400 px-1.5 py-0.5 rounded font-bold">{expiredLife.length} Life Expired</span>}
            </div>
          )}
          <button onClick={toggleAdmin}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${isAdmin ? "bg-red-600/20 text-red-400 border-red-600/30" : "bg-zinc-800 text-zinc-500 border-white/10"}`}>
            {isAdmin ? <><Unlock className="w-3 h-3" /> ADMIN MODE</> : <><Lock className="w-3 h-3" /> OPERATOR</>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-white/10 flex flex-col shrink-0">
          <div className="p-2 space-y-1 border-b border-white/10">
            <div className="flex gap-1">
              <div className="flex-1 relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools..."
                  className="w-full bg-zinc-900 border border-white/10 rounded pl-7 pr-2 py-1 text-[10px] text-zinc-200 outline-none" />
              </div>
              {(isAdmin || true) && (
                <button onClick={addTool} className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 rounded px-2 text-amber-400" title="Add Tool">
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex gap-0.5">
              {(["all", "turning", "milling", "drilling"] as const).map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={`flex-1 text-[9px] py-0.5 rounded ${filterCat === c ? "bg-amber-600/20 text-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}>
                  {c === "all" ? "Sab" : c === "turning" ? "Turning" : c === "milling" ? "Milling" : "Drilling"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {filtered.map(t => (
              <div key={t.id} onClick={() => setSelectedId(t.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer border transition-all ${t.id === selectedId ? "bg-amber-600/10 border-amber-600/30" : "bg-zinc-900/50 border-transparent hover:border-white/10"}`}>
                <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[9px] font-mono font-bold text-amber-400">
                  T{t.turretPos.toString().padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-zinc-200 truncate">{t.name}</span>
                    {t.locked && <Lock className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                    {t.isDefault && <span className="text-[7px] text-amber-500 shrink-0">★</span>}
                    {t.toolLifeMax > 0 && t.toolLifeUsed >= t.toolLifeMax && <AlertTriangle className="w-2.5 h-2.5 text-orange-400 shrink-0" />}
                    {t.stockQty <= t.stockMin && <Package className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                  </div>
                  <div className="text-[8px] text-zinc-500 truncate">{t.isoCode} | {t.holderCode}</div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={e => { e.stopPropagation(); cloneTool(t.id); }} className="text-zinc-600 hover:text-blue-400 p-0.5" title="Clone"><Copy className="w-2.5 h-2.5" /></button>
                  {(isAdmin || !t.locked) && <button onClick={e => { e.stopPropagation(); deleteTool(t.id); }} className="text-zinc-600 hover:text-red-400 p-0.5" title="Delete"><Trash2 className="w-2.5 h-2.5" /></button>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-[10px] text-zinc-600 text-center py-4">Koi tool nahi mila</div>}
          </div>

          <div className="p-2 border-t border-white/10 space-y-1">
            <div className="flex gap-1 items-center">
              <span className="text-[9px] text-zinc-500">Work Ø:</span>
              <input type="number" value={workDia} onChange={e => setWorkDia(+e.target.value)}
                className="w-14 bg-zinc-900 border border-white/10 rounded px-1 py-0.5 text-[10px] text-zinc-200 outline-none" />
              <span className="text-[9px] text-zinc-500">mm</span>
            </div>
            <div className="flex gap-1">
              <button onClick={exportToolList} className="flex-1 flex items-center justify-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded py-1 text-[8px] text-blue-400 font-bold">
                <Download className="w-2.5 h-2.5" /> Report
              </button>
              <button onClick={exportJSON} className="flex-1 flex items-center justify-center gap-1 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded py-1 text-[8px] text-green-400 font-bold">
                <Download className="w-2.5 h-2.5" /> JSON
              </button>
              {isAdmin && (
                <button onClick={importJSON} className="flex-1 flex items-center justify-center gap-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 rounded py-1 text-[8px] text-purple-400 font-bold">
                  <Upload className="w-2.5 h-2.5" /> Import
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-600">
              <Wrench className="w-12 h-12 mb-2 opacity-20" />
              <div className="text-sm">Left side se tool select karein</div>
              <div className="text-[10px] mt-1">{isAdmin ? "Admin Mode — sab edit kar sakte hain" : "Operator Mode — locked tools sirf dekhne ke liye"}</div>
            </div>
          ) : (
            <>
              {selected.locked && !isAdmin && (
                <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] text-red-400 font-bold">Ye tool Admin ne LOCK kiya hai — sirf dekhne ke liye hai. Edit karne ke liye Admin Mode ON karein.</span>
                </div>
              )}

              {adminTab === "tools" && (
                <>
                  <div className="flex gap-3">
                    <div className="w-16 h-16 shrink-0 bg-zinc-900 rounded-lg border border-white/10 flex items-center justify-center">
                      <InsertSVG parsed={selected.parsed} size={56} />
                    </div>
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Tool Name</label>
                        <input value={selected.name} onChange={e => canEdit && updateTool(selected.id, { name: e.target.value })} readOnly={!canEdit}
                          className={`w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] outline-none ${canEdit ? "text-zinc-200" : "text-zinc-500"}`} />
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">ISO Insert Code</label>
                        <input value={selected.isoCode} onChange={e => {
                          if (!canEdit) return;
                          const parsed = parseISO1832(e.target.value);
                          const family = parsed ? parsed.shapeCode + (parsed.typeCode === "N" || parsed.typeCode === "M" || parsed.typeCode === "G" ? "NMG" : "CMT") : "";
                          const cd = (CUTTING_DATA[selected.matGroup] as any)?.[family] || (CUTTING_DATA[selected.matGroup] as any)?.[parsed?.shapeCode + "NMG"] || (CUTTING_DATA[selected.matGroup] as any)?.[parsed?.shapeCode + "CMT"] || selected.cuttingData;
                          updateTool(selected.id, { isoCode: e.target.value, parsed, cuttingData: cd || selected.cuttingData });
                        }} readOnly={!canEdit}
                          className={`w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] font-mono outline-none ${canEdit ? "text-amber-400" : "text-amber-400/50"}`} />
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Turret Position</label>
                        <input type="number" min={1} max={12} value={selected.turretPos} onChange={e => canEdit && updateTool(selected.id, { turretPos: Math.min(12, Math.max(1, +e.target.value)) })} readOnly={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Operation Type</label>
                        <select value={selected.subType} onChange={e => canEdit && updateTool(selected.id, { subType: e.target.value })} disabled={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none">
                          <optgroup label="Turning"><option value="od_rough">OD Roughing (G71)</option><option value="od_finish">OD Finishing (G70)</option><option value="od_profile">OD Profiling</option><option value="face">Facing</option><option value="id_rough">ID Roughing</option><option value="id_finish">ID Finishing</option><option value="id_bore">Boring</option></optgroup>
                          <optgroup label="Groove/Cutoff"><option value="groove_od">OD Grooving (G75)</option><option value="groove_id">ID Grooving</option><option value="groove_face">Face Grooving</option><option value="cutoff">Cutoff/Parting</option></optgroup>
                          <optgroup label="Threading"><option value="thread_ext">External Thread (G76)</option><option value="thread_int">Internal Thread</option></optgroup>
                          <optgroup label="Other"><option value="chamfer">Chamfering</option><option value="center_drill">Center Drill</option><option value="hdt_freeturn">HDT / FreeTurn</option></optgroup>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">Holder</label>
                      <select value={selected.holderCode} onChange={e => canEdit && updateTool(selected.id, { holderCode: e.target.value })} disabled={!canEdit}
                        className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none">
                        {HOLDER_FULL_DB.map(h => <option key={h.code} value={h.code}>{h.code} ({h.type})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">Grade</label>
                      <select value={selected.gradeCode} onChange={e => canEdit && updateTool(selected.id, { gradeCode: e.target.value })} disabled={!canEdit}
                        className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none">
                        {GRADE_DB.map(g => <option key={g.code} value={g.code}>{g.code} ({g.iso}) — {g.desc}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">ISO Material Group</label>
                      <select value={selected.matGroup} onChange={e => {
                        if (!canEdit) return;
                        const mg = e.target.value as ISOMatGroup;
                        const shape = selected.parsed?.shapeCode || "C";
                        const cd = (CUTTING_DATA[mg] as any)?.[shape + "NMG"] || (CUTTING_DATA[mg] as any)?.[shape + "CMT"] || selected.cuttingData;
                        updateTool(selected.id, { matGroup: mg, cuttingData: cd });
                      }} disabled={!canEdit}
                        className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none">
                        {(Object.keys(CUTTING_DATA) as ISOMatGroup[]).map(k => (<option key={k} value={k}>ISO {k} — {(CUTTING_DATA[k] as any).label}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-0.5">Notes</label>
                      <input value={selected.notes} onChange={e => canEdit && updateTool(selected.id, { notes: e.target.value })} readOnly={!canEdit}
                        className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => updateTool(selected.id, { locked: !selected.locked })}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-[9px] font-bold border ${selected.locked ? "bg-red-600/20 text-red-400 border-red-600/30" : "bg-green-600/20 text-green-400 border-green-600/30"}`}>
                        {selected.locked ? <><Lock className="w-3 h-3" /> LOCKED — Unlock karein</> : <><Unlock className="w-3 h-3" /> UNLOCKED — Lock karein</>}
                      </button>
                      <button onClick={() => updateTool(selected.id, { isDefault: !selected.isDefault })}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-[9px] font-bold border ${selected.isDefault ? "bg-amber-600/20 text-amber-400 border-amber-600/30" : "bg-zinc-800 text-zinc-500 border-white/10"}`}>
                        {selected.isDefault ? "★ Default Tool" : "☆ Set as Default"}
                      </button>
                    </div>
                  )}

                  {selected.parsed && (
                    <div className="bg-zinc-900/80 border border-amber-600/20 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[11px] font-bold text-amber-400">ISO 1832 Insert — {selected.isoCode}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                        <div><span className="text-zinc-500">Shape:</span> <span className="text-amber-400">{selected.parsed.shapeCode} — {selected.parsed.shapeName}</span></div>
                        <div><span className="text-zinc-500">Nose Angle:</span> {selected.parsed.shapeAngle}°</div>
                        <div><span className="text-zinc-500">Clearance:</span> {selected.parsed.clearanceCode} = {selected.parsed.clearanceAngle}°</div>
                        <div><span className="text-zinc-500">Type:</span> {selected.parsed.typeCode} — {selected.parsed.typeName}</div>
                        <div><span className="text-zinc-500">IC Ø:</span> <span className="font-bold">{selected.parsed.sizeIC}mm</span></div>
                        <div><span className="text-zinc-500">Thickness:</span> {selected.parsed.thickness}mm</div>
                        <div><span className="text-zinc-500">Nose R:</span> <span className="font-bold text-green-400">{selected.parsed.noseRadius}mm</span></div>
                        <div><span className="text-zinc-500">Tolerance:</span> {selected.parsed.toleranceCode}</div>
                      </div>
                    </div>
                  )}

                  {selected.cuttingData && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-2"><Settings className="w-3.5 h-3.5 text-red-400" /><span className="text-[11px] font-bold text-red-400">Cutting Data — Roughing</span></div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="text-center"><div className="text-zinc-500">Vc</div><div className="text-lg font-bold">{selected.cuttingData.vc}</div><div className="text-[8px] text-zinc-600">m/min</div></div>
                          <div className="text-center"><div className="text-zinc-500">Feed</div><div className="text-lg font-bold">{selected.cuttingData.feed}</div><div className="text-[8px] text-zinc-600">mm/rev</div></div>
                          <div className="text-center"><div className="text-zinc-500">DOC</div><div className="text-lg font-bold">{selected.cuttingData.doc}</div><div className="text-[8px] text-zinc-600">mm</div></div>
                        </div>
                      </div>
                      <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-2"><Settings className="w-3.5 h-3.5 text-green-400" /><span className="text-[11px] font-bold text-green-400">Cutting Data — Finishing</span></div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="text-center"><div className="text-zinc-500">Vc</div><div className="text-lg font-bold">{selected.cuttingData.vcFinish}</div><div className="text-[8px] text-zinc-600">m/min</div></div>
                          <div className="text-center"><div className="text-zinc-500">Feed</div><div className="text-lg font-bold">{selected.cuttingData.feedFinish}</div><div className="text-[8px] text-zinc-600">mm/rev</div></div>
                          <div className="text-center"><div className="text-zinc-500">DOC</div><div className="text-lg font-bold">{selected.cuttingData.docFinish}</div><div className="text-[8px] text-zinc-600">mm</div></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {formulas && (
                    <div className="bg-zinc-900/80 border border-blue-600/20 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2"><Cpu className="w-3.5 h-3.5 text-blue-400" /><span className="text-[11px] font-bold text-blue-400">Calculated @ Ø{workDia}mm</span></div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
                        {[
                          { label: "RPM rough", value: formulas.rpm, color: "text-red-400", formula: "Vc×1000/πD" },
                          { label: "RPM finish", value: formulas.rpmFinish, color: "text-green-400", formula: "Vc×1000/πD" },
                          { label: "Ra rough", value: formulas.raRough.toFixed(1) + "µm", color: "text-amber-400", formula: "f²/(32Rε)×1000" },
                          { label: "Ra finish", value: formulas.raFinish.toFixed(1) + "µm", color: "text-green-400", formula: "f²/(32Rε)×1000" },
                          { label: "Power", value: formulas.powerRough.toFixed(2) + " kW", color: "text-purple-400", formula: "Vc×f×ap×kc/60K" },
                          { label: "Torque", value: formulas.torqueRough.toFixed(2) + " Nm", color: "text-cyan-400", formula: "9550×P/n" },
                          { label: "MRR", value: formulas.mrrRough.toFixed(0) + " mm³/min", color: "text-red-400", formula: "Vc×f×ap×1000" },
                          { label: "Force", value: formulas.cuttingForce.toFixed(0) + " N", color: "text-orange-400", formula: "kc×f×ap" },
                          { label: "kc", value: formulas.kc + " N/mm²", color: "text-zinc-300", formula: "ISO " + selected.matGroup },
                          { label: "Passes", value: formulas.passes, color: "text-amber-400", formula: "ceil(D/2/ap)" },
                        ].map((f, i) => (
                          <div key={i} className="text-center bg-black/20 rounded p-1.5">
                            <div className="text-zinc-500 text-[9px]">{f.label}</div>
                            <div className={`text-base font-bold ${f.color}`}>{f.value}</div>
                            <div className="text-[7px] text-zinc-600">{f.formula}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const holder = HOLDER_FULL_DB.find(h => h.code === selected.holderCode);
                    const grade = GRADE_DB.find(g => g.code === selected.gradeCode);
                    if (!holder && !grade) return null;
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {holder && (
                          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                            <div className="text-[11px] font-bold text-cyan-400 mb-1">Holder: {holder.code}</div>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div><span className="text-zinc-500">Type:</span> {holder.type}</div>
                              <div><span className="text-zinc-500">Clamp:</span> {holder.clamp}</div>
                              <div><span className="text-zinc-500">Shank:</span> {holder.shank}</div>
                              <div><span className="text-zinc-500">Reach:</span> {holder.reach}mm</div>
                              <div><span className="text-zinc-500">Overhang:</span> {holder.overhang}mm</div>
                              <div><span className="text-zinc-500">Approach:</span> {holder.approach}°</div>
                              <div><span className="text-zinc-500">Lead Angle:</span> {holder.leadAngle}°</div>
                              <div><span className="text-zinc-500">Insert Family:</span> {holder.insert}</div>
                            </div>
                          </div>
                        )}
                        {grade && (
                          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                            <div className="text-[11px] font-bold text-purple-400 mb-1">Grade: {grade.code} (ISO {grade.iso})</div>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div><span className="text-zinc-500">Coating:</span> {grade.coating}</div>
                              <div><span className="text-zinc-500">Hardness:</span> {grade.hardness}</div>
                              <div className="col-span-2"><span className="text-zinc-500">Application:</span> {grade.desc}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {adminTab === "compensation" && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 border border-cyan-600/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2"><Crosshair className="w-3.5 h-3.5 text-cyan-400" /><span className="text-[11px] font-bold text-cyan-400">Tool Nose Compensation — T{selected.turretPos.toString().padStart(2, "0")}</span></div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {(["G41", "G42", "off"] as const).map(d => (
                        <button key={d} onClick={() => canEdit && updateTool(selected.id, { compDir: d })}
                          className={`py-2 rounded text-[10px] font-bold border transition-all ${selected.compDir === d ? "bg-cyan-600/20 text-cyan-400 border-cyan-600/30" : "bg-zinc-800 text-zinc-500 border-white/10"}`}>
                          {d === "G41" ? "G41 — Left (ID)" : d === "G42" ? "G42 — Right (OD)" : "OFF — No Comp"}
                        </button>
                      ))}
                    </div>
                    <div className="text-[9px] text-zinc-500 mb-3">
                      {selected.compDir === "G41" ? "G41 = Tool Left side — ID Boring, Left-hand turning ke liye" : selected.compDir === "G42" ? "G42 = Tool Right side — OD Turning, standard right-hand cut" : "Compensation OFF — Grooving, Threading, Cutoff ke liye"}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                      <div className="text-[11px] font-bold text-amber-400 mb-2">Geometry Offset (G-code register)</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[9px] text-zinc-500 block">Geo Offset X (mm)</label>
                          <input type="number" step={0.001} value={selected.geoOffsetX} onChange={e => canEdit && updateTool(selected.id, { geoOffsetX: +e.target.value })} readOnly={!canEdit}
                            className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none font-mono" /></div>
                        <div><label className="text-[9px] text-zinc-500 block">Geo Offset Z (mm)</label>
                          <input type="number" step={0.001} value={selected.geoOffsetZ} onChange={e => canEdit && updateTool(selected.id, { geoOffsetZ: +e.target.value })} readOnly={!canEdit}
                            className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none font-mono" /></div>
                      </div>
                    </div>
                    <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                      <div className="text-[11px] font-bold text-red-400 mb-2">Wear Offset (Runtime adjustment)</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[9px] text-zinc-500 block">Wear X (mm)</label>
                          <input type="number" step={0.001} value={selected.wearOffsetX} onChange={e => canEdit && updateTool(selected.id, { wearOffsetX: +e.target.value })} readOnly={!canEdit}
                            className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none font-mono" /></div>
                        <div><label className="text-[9px] text-zinc-500 block">Wear Z (mm)</label>
                          <input type="number" step={0.001} value={selected.wearOffsetZ} onChange={e => canEdit && updateTool(selected.id, { wearOffsetZ: +e.target.value })} readOnly={!canEdit}
                            className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none font-mono" /></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] font-bold text-zinc-400 mb-2">Compensation Summary (G-code output)</div>
                    <pre className="text-[9px] text-green-400 font-mono bg-black/30 p-2 rounded">
{`T${selected.turretPos.toString().padStart(2,"0")}${selected.turretPos.toString().padStart(2,"0")} (${selected.name})
${selected.compDir !== "off" ? selected.compDir + " " : ""}G96 S${selected.cuttingData?.vc || 200} M4
G00 X${(workDia + 2).toFixed(1)} Z5.0
${selected.compDir !== "off" ? `(NOSE R = ${selected.parsed?.noseRadius || 0.8}mm | COMP = ${selected.compDir})` : "(NO COMPENSATION)"}
(GEO OFFSET X=${selected.geoOffsetX} Z=${selected.geoOffsetZ})
(WEAR OFFSET X=${selected.wearOffsetX} Z=${selected.wearOffsetZ})`}
                    </pre>
                  </div>
                </div>
              )}

              {adminTab === "life" && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 border border-orange-600/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2"><Clock className="w-3.5 h-3.5 text-orange-400" /><span className="text-[11px] font-bold text-orange-400">Tool Life Management — T{selected.turretPos.toString().padStart(2, "0")}</span></div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Max Life (min)</label>
                        <input type="number" value={selected.toolLifeMax} onChange={e => canEdit && updateTool(selected.id, { toolLifeMax: +e.target.value })} readOnly={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Used (min)</label>
                        <input type="number" value={selected.toolLifeUsed} onChange={e => canEdit && updateTool(selected.id, { toolLifeUsed: +e.target.value })} readOnly={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Pieces Made</label>
                        <input type="number" value={selected.toolLifePieces} onChange={e => canEdit && updateTool(selected.id, { toolLifePieces: +e.target.value })} readOnly={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                      </div>
                    </div>
                    {formulas && selected.toolLifeMax > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-[9px] mb-1">
                          <span className="text-zinc-500">Tool Life: {selected.toolLifeUsed}/{selected.toolLifeMax} min ({formulas.toolLifePct}%)</span>
                          <span className={formulas.toolLifePct >= 100 ? "text-red-400 font-bold" : formulas.toolLifePct >= 80 ? "text-orange-400" : "text-green-400"}>
                            {formulas.toolLifePct >= 100 ? "EXPIRED — Insert badlein!" : formulas.toolLifePct >= 80 ? "Jaldi khatam hoga" : "OK"}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${formulas.toolLifePct >= 100 ? "bg-red-500" : formulas.toolLifePct >= 80 ? "bg-orange-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(100, formulas.toolLifePct)}%` }} />
                        </div>
                      </div>
                    )}
                    {isAdmin && (
                      <button onClick={() => updateTool(selected.id, { toolLifeUsed: 0, toolLifePieces: 0 })}
                        className="mt-2 flex items-center gap-1 px-3 py-1 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded text-[9px] text-green-400 font-bold">
                        <RotateCcw className="w-3 h-3" /> Reset Life (Naya Insert)
                      </button>
                    )}
                  </div>
                  <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] font-bold text-zinc-400 mb-2">All Tools — Life Status</div>
                    <div className="space-y-1">
                      {tools.map(t => {
                        const pct = t.toolLifeMax > 0 ? Math.round((t.toolLifeUsed / t.toolLifeMax) * 100) : 0;
                        return (
                          <div key={t.id} className="flex items-center gap-2 text-[9px]">
                            <span className="w-8 text-zinc-500 font-mono">T{t.turretPos.toString().padStart(2, "0")}</span>
                            <span className="w-24 text-zinc-300 truncate">{t.name}</span>
                            <div className="flex-1 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className={`w-10 text-right ${pct >= 100 ? "text-red-400" : "text-zinc-500"}`}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === "crib" && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 border border-purple-600/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2"><Package className="w-3.5 h-3.5 text-purple-400" /><span className="text-[11px] font-bold text-purple-400">Tool Crib / Stock — T{selected.turretPos.toString().padStart(2, "0")}</span></div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Stock Qty</label>
                        <input type="number" value={selected.stockQty} onChange={e => canEdit && updateTool(selected.id, { stockQty: +e.target.value })} readOnly={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Min Stock (Alert)</label>
                        <input type="number" value={selected.stockMin} onChange={e => canEdit && updateTool(selected.id, { stockMin: +e.target.value })} readOnly={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                      </div>
                      <div>
                        <label className="text-[9px] text-zinc-500 block mb-0.5">Location</label>
                        <input value={selected.stockLocation} onChange={e => canEdit && updateTool(selected.id, { stockLocation: e.target.value })} readOnly={!canEdit}
                          className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1 text-[10px] text-zinc-200 outline-none" />
                      </div>
                    </div>
                    {selected.stockQty <= selected.stockMin && (
                      <div className="bg-red-600/10 border border-red-600/30 rounded p-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-[10px] text-red-400 font-bold">LOW STOCK! Sirf {selected.stockQty} bachein hain (minimum {selected.stockMin} chahiye) — Order karein: {selected.isoCode}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] font-bold text-zinc-400 mb-2">All Tools — Stock Status</div>
                    <div className="grid grid-cols-1 gap-1">
                      {tools.map(t => (
                        <div key={t.id} className={`flex items-center gap-2 text-[9px] px-2 py-1 rounded ${t.stockQty <= t.stockMin ? "bg-red-600/5 border border-red-600/20" : "border border-transparent"}`}>
                          <span className="w-8 text-zinc-500 font-mono">T{t.turretPos.toString().padStart(2, "0")}</span>
                          <span className="w-24 text-zinc-300 truncate">{t.name}</span>
                          <span className="w-28 text-zinc-500 truncate">{t.isoCode}</span>
                          <span className={`w-12 text-right font-bold ${t.stockQty <= t.stockMin ? "text-red-400" : "text-green-400"}`}>{t.stockQty} pcs</span>
                          <span className="w-12 text-zinc-600 text-right">min {t.stockMin}</span>
                          <span className="flex-1 text-zinc-600 truncate">{t.stockLocation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === "settings" && (
                <div className="space-y-3">
                  <div className="bg-zinc-900/80 border border-red-600/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2"><Shield className="w-3.5 h-3.5 text-red-400" /><span className="text-[11px] font-bold text-red-400">Admin Control Panel</span></div>
                    <div className="space-y-2">
                      <div className="bg-black/20 rounded p-2">
                        <div className="text-[10px] text-zinc-300 font-bold mb-1">Current Mode: {isAdmin ? "ADMIN — Sab kuch edit/lock/delete kar sakte hain" : "OPERATOR — Sirf unlocked tools edit kar sakte hain"}</div>
                        <div className="text-[9px] text-zinc-500">Admin Mode mein:</div>
                        <ul className="text-[9px] text-zinc-500 list-disc ml-4">
                          <li>Tools ko Lock/Unlock kar sakte hain</li>
                          <li>Default tools set kar sakte hain</li>
                          <li>Tool Life reset kar sakte hain</li>
                          <li>Stock quantity aur location manage kar sakte hain</li>
                          <li>Cutting data change kar sakte hain</li>
                          <li>Tool database Import/Export kar sakte hain</li>
                          <li>Koi bhi tool delete kar sakte hain</li>
                        </ul>
                      </div>
                      <div className="bg-black/20 rounded p-2">
                        <div className="text-[10px] text-zinc-300 font-bold mb-1">Tool Summary</div>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="text-center"><div className="text-zinc-500">Total Tools</div><div className="text-lg font-bold text-amber-400">{tools.length}</div></div>
                          <div className="text-center"><div className="text-zinc-500">Locked</div><div className="text-lg font-bold text-red-400">{tools.filter(t => t.locked).length}</div></div>
                          <div className="text-center"><div className="text-zinc-500">Default</div><div className="text-lg font-bold text-green-400">{tools.filter(t => t.isDefault).length}</div></div>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button onClick={() => setTools(prev => prev.map(t => ({ ...t, locked: true })))}
                            className="flex-1 flex items-center justify-center gap-1 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded py-1.5 text-[9px] text-red-400 font-bold">
                            <Lock className="w-3 h-3" /> Lock All
                          </button>
                          <button onClick={() => setTools(prev => prev.map(t => ({ ...t, locked: false })))}
                            className="flex-1 flex items-center justify-center gap-1 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded py-1.5 text-[9px] text-green-400 font-bold">
                            <Unlock className="w-3 h-3" /> Unlock All
                          </button>
                          <button onClick={() => { if (confirm("Sab tools reset karein? Sab custom tools delete ho jayenge!")) { setTools(createDefaultTools()); setSelectedId(null); } }}
                            className="flex-1 flex items-center justify-center gap-1 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-600/30 rounded py-1.5 text-[9px] text-orange-400 font-bold">
                            <RotateCcw className="w-3 h-3" /> Factory Reset
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
                    <div className="text-[11px] font-bold text-zinc-400 mb-2">Change Log</div>
                    <div className="space-y-1">
                      {tools.sort((a, b) => b.lastChanged.localeCompare(a.lastChanged)).map(t => (
                        <div key={t.id} className="flex items-center gap-2 text-[9px] text-zinc-500">
                          <span className="w-8 font-mono">T{t.turretPos.toString().padStart(2, "0")}</span>
                          <span className="w-24 truncate text-zinc-300">{t.name}</span>
                          <span className="w-20">{t.lastChanged}</span>
                          <span className={t.changedBy === "Admin" ? "text-red-400" : "text-blue-400"}>{t.changedBy}</span>
                          {t.locked && <Lock className="w-2.5 h-2.5 text-red-400" />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2"><Target className="w-3.5 h-3.5 text-amber-400" /><span className="text-[11px] font-bold text-amber-400">ISO 1832 Insert Code Parser</span></div>
            <div className="flex gap-2 items-end">
              <input value={isoInput} onChange={e => setIsoInput(e.target.value)} placeholder="ISO code daalen: CNMG 120408, CCMT09T304..."
                className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-amber-400 font-mono outline-none" />
              <button onClick={() => setParsedPreview(parseISO1832(isoInput))}
                className="bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 rounded px-3 py-1.5 text-[10px] text-amber-400 font-bold">Parse</button>
            </div>
            {parsedPreview && (
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] bg-black/20 rounded p-2">
                <div><span className="text-zinc-500">{parsedPreview.shapeCode}:</span> <span className="text-amber-400">{parsedPreview.shapeName} ({parsedPreview.shapeAngle}°)</span></div>
                <div><span className="text-zinc-500">Clearance:</span> {parsedPreview.clearanceAngle}°</div>
                <div><span className="text-zinc-500">IC:</span> <span className="font-bold">{parsedPreview.sizeIC}mm</span></div>
                <div><span className="text-zinc-500">Nose R:</span> <span className="font-bold text-green-400">{parsedPreview.noseRadius}mm</span></div>
              </div>
            )}
          </div>

          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2"><Layers className="w-3.5 h-3.5 text-amber-400" /><span className="text-[11px] font-bold text-amber-400">Turret Map — {tools.length} Tools</span></div>
            <div className="grid grid-cols-6 gap-1">
              {Array.from({ length: 12 }, (_, i) => {
                const t = tools.find(tool => tool.turretPos === i + 1);
                return (
                  <div key={i} onClick={() => t && setSelectedId(t.id)}
                    className={`rounded p-1.5 text-center cursor-pointer border transition-all ${t ? (t.id === selectedId ? "bg-amber-600/20 border-amber-600/30" : "bg-zinc-800 border-white/10 hover:border-amber-600/20") : "bg-zinc-900/30 border-zinc-800"}`}>
                    <div className="text-[9px] font-mono font-bold text-zinc-400">T{(i + 1).toString().padStart(2, "0")}</div>
                    {t ? (
                      <>
                        <div className="flex items-center justify-center gap-0.5">
                          <span className="text-[7px] text-amber-400 truncate">{t.name}</span>
                          {t.locked && <Lock className="w-2 h-2 text-red-400" />}
                        </div>
                        <div className="text-[6px] text-zinc-500 truncate">{t.isoCode}</div>
                      </>
                    ) : (<div className="text-[8px] text-zinc-700">Empty</div>)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
