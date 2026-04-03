import React, { useState, useMemo, useCallback } from "react";
import { Shield, AlertTriangle, CheckCircle, FileText, Wrench, Eye, Cpu, Crosshair, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

type InsertShape = "CNMG" | "VNMG" | "DNMG" | "TNMG" | "WNMG" | "SNMG" | "RCMT";
type ToolRole = "roughing" | "finishing" | "grooving";

interface InsertSpec {
  shape: InsertShape;
  noseAngle: number;
  reliefAngle: number;
  icDia: number;
  thickness: number;
  noseRadius: number;
  desc: string;
}

interface HolderSpec {
  code: string;
  shankW: number;
  shankH: number;
  reach: number;
  overhang: number;
  approach: number;
}

interface ToolSlot {
  role: ToolRole;
  turretPos: number;
  insert: InsertSpec;
  holder: HolderSpec;
  depthOfCut: number;
  feed: number;
  speed: number;
  enabled: boolean;
}

interface CollisionZone {
  name: string;
  severity: "safe" | "warning" | "critical";
  desc: string;
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

const INSERT_DB: Record<InsertShape, Omit<InsertSpec, "noseRadius">> = {
  CNMG: { shape: "CNMG", noseAngle: 80, reliefAngle: 0, icDia: 12.7, thickness: 4.76, desc: "80° Diamond — OD Roughing/General" },
  VNMG: { shape: "VNMG", noseAngle: 35, reliefAngle: 0, icDia: 9.525, thickness: 4.76, desc: "35° Diamond — Finishing/Profiling" },
  DNMG: { shape: "DNMG", noseAngle: 55, reliefAngle: 0, icDia: 12.7, thickness: 4.76, desc: "55° Diamond — Semi-Finish/Copy" },
  TNMG: { shape: "TNMG", noseAngle: 60, reliefAngle: 0, icDia: 11.0, thickness: 4.76, desc: "60° Triangle — General Purpose" },
  WNMG: { shape: "WNMG", noseAngle: 80, reliefAngle: 0, icDia: 12.7, thickness: 4.76, desc: "80° Trigon — Heavy Roughing" },
  SNMG: { shape: "SNMG", noseAngle: 90, reliefAngle: 0, icDia: 12.7, thickness: 4.76, desc: "90° Square — Facing/Shoulder" },
  RCMT: { shape: "RCMT", noseAngle: 360, reliefAngle: 7, icDia: 10.0, thickness: 3.18, desc: "Round — Profiling/Grooving" },
};

const NOSE_RADII = [0.2, 0.4, 0.8, 1.2, 1.6, 2.0];

const HOLDER_DB: Record<string, HolderSpec> = {
  "PCLNL-2525M12": { code: "PCLNL-2525M12", shankW: 25, shankH: 25, reach: 150, overhang: 40, approach: 95 },
  "PVJNL-2525M16": { code: "PVJNL-2525M16", shankW: 25, shankH: 25, reach: 150, overhang: 45, approach: 93 },
  "PDJNL-2525M15": { code: "PDJNL-2525M15", shankW: 25, shankH: 25, reach: 150, overhang: 42, approach: 93 },
  "PTGNL-2525M16": { code: "PTGNL-2525M16", shankW: 25, shankH: 25, reach: 150, overhang: 38, approach: 90 },
  "SVJBL-2525M16": { code: "SVJBL-2525M16", shankW: 25, shankH: 25, reach: 170, overhang: 50, approach: 93 },
  "GER-2525-3": { code: "GER-2525-3", shankW: 25, shankH: 25, reach: 150, overhang: 35, approach: 90 },
};

function defaultTool(role: ToolRole, pos: number): ToolSlot {
  if (role === "roughing") {
    return {
      role, turretPos: pos, enabled: true,
      insert: { ...INSERT_DB.CNMG, noseRadius: 0.8 },
      holder: HOLDER_DB["PCLNL-2525M12"],
      depthOfCut: 2.0, feed: 0.28, speed: 180,
    };
  }
  if (role === "finishing") {
    return {
      role, turretPos: pos, enabled: true,
      insert: { ...INSERT_DB.VNMG, noseRadius: 0.4 },
      holder: HOLDER_DB["PVJNL-2525M16"],
      depthOfCut: 0.3, feed: 0.10, speed: 220,
    };
  }
  return {
    role, turretPos: pos, enabled: true,
    insert: { ...INSERT_DB.RCMT, noseRadius: 0.4 },
    holder: HOLDER_DB["GER-2525-3"],
    depthOfCut: 3.0, feed: 0.08, speed: 120,
  };
}

function checkToolCollisions(
  tool: ToolSlot, rawOD: number, boreOD: number, faceWidth: number, chuckLen: number
): CollisionZone[] {
  const zones: CollisionZone[] = [];
  const rawR = rawOD / 2;
  const boreR = boreOD / 2;
  const holderR = tool.holder.shankH / 2;
  const holderOverhang = tool.holder.overhang;

  const chuckClearance = rawR - holderR;
  if (chuckClearance < 5) {
    zones.push({
      name: `T${tool.turretPos} Chuck Collision`,
      severity: chuckClearance < 0 ? "critical" : "warning",
      desc: `Holder ${tool.holder.code} clearance to chuck: ${chuckClearance.toFixed(1)}mm (min 5mm required)`,
      xMin: 0, xMax: rawR + holderR, zMin: 0, zMax: chuckLen,
    });
  }

  if (tool.role === "grooving") {
    const grooveReach = tool.holder.reach - holderOverhang;
    if (grooveReach < faceWidth) {
      zones.push({
        name: `T${tool.turretPos} Reach Limit`,
        severity: "warning",
        desc: `Groove tool reach ${grooveReach.toFixed(0)}mm < face width ${faceWidth}mm — may not reach full profile`,
        xMin: 0, xMax: rawR, zMin: -grooveReach, zMax: 0,
      });
    }
  }

  if (tool.role === "finishing" && tool.insert.noseAngle < 55) {
    const profileAngle = Math.atan2(rawR - boreR, faceWidth) * 180 / Math.PI;
    if (profileAngle > tool.insert.noseAngle / 2) {
      zones.push({
        name: `T${tool.turretPos} Clearance Angle`,
        severity: "warning",
        desc: `Insert nose angle ${tool.insert.noseAngle}° may interfere with profile wall angle ${profileAngle.toFixed(1)}°`,
        xMin: boreR, xMax: rawR, zMin: -faceWidth, zMax: 0,
      });
    }
  }

  const maxDoc = tool.depthOfCut;
  const totalStock = (rawOD - (boreOD > 0 ? boreOD : 0)) / 2;
  if (tool.role === "roughing" && maxDoc > 0) {
    const passes = Math.ceil(totalStock / maxDoc);
    if (passes > 20) {
      zones.push({
        name: `T${tool.turretPos} Excessive Passes`,
        severity: "warning",
        desc: `${passes} passes needed at ${maxDoc}mm DOC — time badh jayega. DOC badhao ya heavy-duty insert lagao`,
        xMin: boreR, xMax: rawR, zMin: -faceWidth, zMax: 0,
      });
    }
  }

  const holderZone = rawR + holderOverhang;
  const insertTip = rawR - totalStock;
  if (holderOverhang > totalStock + 10) {
    zones.push({
      name: `T${tool.turretPos} Holder-Workpiece`,
      severity: holderOverhang > totalStock + rawR * 0.3 ? "critical" : "warning",
      desc: `Holder overhang ${holderOverhang}mm may contact workpiece surface — holder change ya shorter holder use karo`,
      xMin: insertTip, xMax: holderZone, zMin: -faceWidth, zMax: 0,
    });
  }

  if (zones.length === 0) {
    zones.push({
      name: `T${tool.turretPos} Safe`,
      severity: "safe",
      desc: `Tool T${tool.turretPos} (${tool.insert.shape}) — all clearances OK`,
      xMin: 0, xMax: 0, zMin: 0, zMax: 0,
    });
  }
  return zones;
}

function ToolSlotCard({ tool, onChange, index }: {
  tool: ToolSlot; onChange: (t: ToolSlot) => void; index: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const roleColors = { roughing: "text-red-400", finishing: "text-green-400", grooving: "text-blue-400" };
  const roleLabels = { roughing: "Roughing (Khurdura)", finishing: "Finishing (Chikna)", grooving: "Grooving (Nali)" };
  const roleBg = { roughing: "border-red-600/20", finishing: "border-green-600/20", grooving: "border-blue-600/20" };

  return (
    <div className={`bg-zinc-900/80 border ${roleBg[tool.role]} rounded-lg overflow-hidden`}>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5">
        <Wrench className={`w-3.5 h-3.5 ${roleColors[tool.role]}`} />
        <span className={`text-[11px] font-bold ${roleColors[tool.role]}`}>
          T{tool.turretPos.toString().padStart(2,"0")} — {roleLabels[tool.role]}
        </span>
        <span className="text-[10px] text-zinc-500 ml-auto mr-1">{tool.insert.shape} {tool.insert.noseRadius}R</span>
        {expanded ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-zinc-500 block">Insert Shape</label>
              <select value={tool.insert.shape}
                onChange={e => {
                  const shape = e.target.value as InsertShape;
                  const spec = INSERT_DB[shape];
                  onChange({ ...tool, insert: { ...spec, noseRadius: tool.insert.noseRadius } });
                }}
                className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-[10px] text-zinc-200 outline-none">
                {Object.keys(INSERT_DB).map(k => (
                  <option key={k} value={k}>{k} — {INSERT_DB[k as InsertShape].desc.split("—")[0]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block">Nose Radius (mm)</label>
              <select value={tool.insert.noseRadius}
                onChange={e => onChange({ ...tool, insert: { ...tool.insert, noseRadius: +e.target.value } })}
                className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-[10px] text-zinc-200 outline-none">
                {NOSE_RADII.map(r => <option key={r} value={r}>{r}mm</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block">Holder</label>
              <select value={tool.holder.code}
                onChange={e => onChange({ ...tool, holder: HOLDER_DB[e.target.value] })}
                className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-[10px] text-zinc-200 outline-none">
                {Object.keys(HOLDER_DB).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block">DOC (mm)</label>
              <input type="number" step="0.1" value={tool.depthOfCut}
                onChange={e => onChange({ ...tool, depthOfCut: +e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-[10px] text-zinc-200 outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block">Feed (mm/rev)</label>
              <input type="number" step="0.01" value={tool.feed}
                onChange={e => onChange({ ...tool, feed: +e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-[10px] text-zinc-200 outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-zinc-500 block">Speed (m/min)</label>
              <input type="number" value={tool.speed}
                onChange={e => onChange({ ...tool, speed: +e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded px-1.5 py-1 text-[10px] text-zinc-200 outline-none" />
            </div>
          </div>
          <div className="bg-black/20 rounded p-1.5 text-[9px] text-zinc-500 space-y-0.5">
            <div>Insert: {tool.insert.desc}</div>
            <div>Nose: {tool.insert.noseAngle}° | IC: {tool.insert.icDia}mm | Thickness: {tool.insert.thickness}mm</div>
            <div>Holder: {tool.holder.shankW}×{tool.holder.shankH}mm shank | Reach: {tool.holder.reach}mm | Overhang: {tool.holder.overhang}mm</div>
            <div>Ra (theoretical): ≈{(tool.feed * tool.feed / (8 * tool.insert.noseRadius) * 1000).toFixed(1)} µm</div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollisionDiagram({ tools, rawOD, boreOD, faceWidth, chuckLen, allZones }: {
  tools: ToolSlot[]; rawOD: number; boreOD: number; faceWidth: number; chuckLen: number; allZones: CollisionZone[][];
}) {
  const W = 700, H = 300;
  const maxDim = Math.max(rawOD, faceWidth + chuckLen + 40);
  const scale = (W - 100) / (faceWidth + chuckLen + 60) * 0.8;
  const cx = W / 2 + 30;
  const cy = H / 2;
  const rawR = rawOD / 2 * scale;
  const boreR = boreOD / 2 * scale;
  const fw = faceWidth * scale;
  const cl = chuckLen * scale;

  const criticals = allZones.flat().filter(z => z.severity === "critical");
  const warnings = allZones.flat().filter(z => z.severity === "warning");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[300px] bg-zinc-950 rounded-lg border border-white/10">
      <rect x={cx} y={cy - rawR - 10} width={cl} height={rawR * 2 + 20} fill="#1a1a3e" stroke="#4444aa" strokeWidth="1" strokeDasharray="3 2" rx="3" />
      <text x={cx + cl / 2} y={cy - rawR - 15} textAnchor="middle" fill="#6666cc" fontSize="8">Chuck</text>

      <rect x={cx - fw} y={cy - rawR} width={fw} height={rawR * 2} fill="none" stroke="#666" strokeWidth="1" strokeDasharray="4 2" />
      <text x={cx - fw / 2} y={cy - rawR - 6} textAnchor="middle" fill="#888" fontSize="8">Raw: {rawOD}mm × {faceWidth}mm</text>

      {boreOD > 0 && (
        <rect x={cx - fw} y={cy - boreR} width={fw} height={boreR * 2} fill="#0a0a1a" stroke="#60a5fa" strokeWidth="0.8" strokeDasharray="2 2" />
      )}

      {tools.filter(t => t.enabled).map((t, i) => {
        const yOffset = (i - 1) * (rawR * 0.6);
        const toolX = cx - fw - 15 - i * 15;
        const tipY = cy + yOffset;
        const holderW = t.holder.shankW * scale * 0.6;
        const holderH = t.holder.shankH * scale * 0.5;
        const roleColor = t.role === "roughing" ? "#ef4444" : t.role === "finishing" ? "#22c55e" : "#3b82f6";
        const hasCollision = allZones[i]?.some(z => z.severity === "critical");

        return (
          <g key={i}>
            <line x1={toolX - 30} y1={tipY} x2={toolX} y2={tipY} stroke={roleColor} strokeWidth="2" />
            <rect x={toolX - 30 - holderW} y={tipY - holderH / 2} width={holderW} height={holderH}
              fill={hasCollision ? "#ff000030" : "#33333380"} stroke={roleColor} strokeWidth="1" rx="2" />
            <polygon points={`${toolX},${tipY} ${toolX - 8},${tipY - 4} ${toolX - 8},${tipY + 4}`}
              fill={roleColor} stroke={roleColor} />
            {hasCollision && (
              <circle cx={toolX} cy={tipY} r="6" fill="none" stroke="#ff0000" strokeWidth="1.5">
                <animate attributeName="r" values="4;8;4" dur="1s" repeatCount="indefinite" />
              </circle>
            )}
            <text x={toolX - 35 - holderW} y={tipY + 3} fill={roleColor} fontSize="8" textAnchor="end">
              T{t.turretPos.toString().padStart(2, "0")} {t.insert.shape}
            </text>
          </g>
        );
      })}

      <rect x={10} y={H - 60} width={180} height={50} fill="#111" stroke="#333" rx="4" />
      <text x={20} y={H - 46} fill="#f59e0b" fontSize="9" fontWeight="bold">Tool Collision Map</text>
      <text x={20} y={H - 34} fill={criticals.length > 0 ? "#ef4444" : "#22c55e"} fontSize="8">
        {criticals.length > 0 ? `${criticals.length} CRITICAL collision(s)` : "No critical collisions"}
      </text>
      <text x={20} y={H - 22} fill={warnings.length > 0 ? "#f59e0b" : "#22c55e"} fontSize="8">
        {warnings.length > 0 ? `${warnings.length} warning(s)` : "All clearances safe"}
      </text>

      <text x={W - 10} y={H - 10} textAnchor="end" fill="#444" fontSize="7">SAI ROLOTECH SMART ENGINES</text>
    </svg>
  );
}

export function RollToolCollisionCalc() {
  const [rawOD, setRawOD] = useState(180);
  const [boreOD, setBoreOD] = useState(50);
  const [faceWidth, setFaceWidth] = useState(80);
  const [chuckLen, setChuckLen] = useState(30);

  const [tools, setTools] = useState<ToolSlot[]>([
    defaultTool("roughing", 1),
    defaultTool("finishing", 2),
    defaultTool("grooving", 3),
  ]);

  const updateTool = useCallback((idx: number, t: ToolSlot) => {
    setTools(prev => { const n = [...prev]; n[idx] = t; return n; });
  }, []);

  const allZones = useMemo(() =>
    tools.map(t => t.enabled ? checkToolCollisions(t, rawOD, boreOD, faceWidth, chuckLen) : []),
    [tools, rawOD, boreOD, faceWidth, chuckLen]
  );

  const hasCritical = allZones.flat().some(z => z.severity === "critical");
  const hasWarning = allZones.flat().some(z => z.severity === "warning");

  const totalStock = (rawOD - (boreOD > 0 ? boreOD : 0)) / 2;
  const roughPasses = tools[0].enabled ? Math.ceil(totalStock / tools[0].depthOfCut) : 0;
  const roughTime = roughPasses > 0 ? (roughPasses * faceWidth) / (tools[0].feed * (tools[0].speed * 1000 / (Math.PI * rawOD))) : 0;

  const exportGcode = useCallback(() => {
    const lines: string[] = [
      `(SAI ROLOTECH — Roll Tool Sequence)`,
      `(Raw: ${rawOD}mm x ${faceWidth}mm | Bore: ${boreOD}mm)`,
      `(Generated: ${new Date().toLocaleDateString("en-IN")})`,
      ``,
      `G0`,
      `G53`,
      `G28 U0.`,
      `G28 W0.`,
      ``,
    ];

    tools.filter(t => t.enabled).forEach((t, idx) => {
      const tn = t.turretPos.toString().padStart(2, "0");
      const rpm = Math.min(500, Math.round(t.speed * 1000 / (Math.PI * rawOD)));
      lines.push(`(─── T${tn} ${t.role.toUpperCase()} — ${t.insert.shape} ${t.insert.noseRadius}R ───)`);
      lines.push(`G0`);
      lines.push(`G53`);
      lines.push(`G28 U0.`);
      lines.push(`G28 W0.`);
      lines.push(`M1`);
      lines.push(`N${t.turretPos}`);
      lines.push(`T${tn}${tn}  ()`);
      lines.push(`G92 S${Math.min(500, rpm)}`);
      lines.push(`G96 S${t.speed} M4`);
      lines.push(`G00 X${rawOD + 20}. Z50.`);

      if (t.role === "roughing") {
        lines.push(`G00 X${rawOD + 5}. Z${5}.`);
        lines.push(`G71 U${t.depthOfCut.toFixed(1)} R0.5`);
        lines.push(`G71 P${100 + idx * 100} Q${200 + idx * 100} U0.4 W0.1 F${t.feed}`);
        lines.push(`N${100 + idx * 100} G00 X${boreOD > 0 ? boreOD : 0}.`);
        lines.push(`N${110 + idx * 100} G01 Z0. F${t.feed}`);
        lines.push(`(... profile blocks ...)`);
        lines.push(`N${200 + idx * 100} X${rawOD + 5}.`);
      } else if (t.role === "finishing") {
        lines.push(`G00 X${rawOD + 5}. Z${5}.`);
        lines.push(`G70 P100 Q200 F${t.feed}`);
      } else {
        lines.push(`G00 X${rawOD + 5}. Z-${(faceWidth * 0.3).toFixed(0)}.`);
        lines.push(`G01 X${boreOD > 0 ? boreOD + 2 : rawOD * 0.3}. F${t.feed}`);
        lines.push(`G00 X${rawOD + 5}.`);
      }

      lines.push(`G00 X${rawOD + 20}. Z50.`);
      lines.push(`M5`);
      lines.push(``);
    });

    lines.push(`G28 U0.`);
    lines.push(`G28 W0.`);
    lines.push(`M30`);

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Roll_MultiTool_Delta2X.nc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tools, rawOD, boreOD, faceWidth]);

  const exportReport = useCallback(() => {
    const lines = [
      `SAI ROLOTECH — Roll Tool Setup & Collision Report`,
      `══════════════════════════════════════════════`,
      `Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Raw OD: ${rawOD}mm | Bore: ${boreOD}mm | Face: ${faceWidth}mm | Chuck: ${chuckLen}mm`,
      `Total Stock: ${totalStock.toFixed(1)}mm radial`,
      ``,
    ];

    tools.filter(t => t.enabled).forEach((t, i) => {
      lines.push(`─── T${t.turretPos.toString().padStart(2,"0")} — ${t.role.toUpperCase()} ───`);
      lines.push(`Insert: ${t.insert.shape} | Nose: ${t.insert.noseAngle}° | R: ${t.insert.noseRadius}mm`);
      lines.push(`IC Dia: ${t.insert.icDia}mm | Thickness: ${t.insert.thickness}mm`);
      lines.push(`Holder: ${t.holder.code} | Shank: ${t.holder.shankW}×${t.holder.shankH}mm`);
      lines.push(`Reach: ${t.holder.reach}mm | Overhang: ${t.holder.overhang}mm`);
      lines.push(`DOC: ${t.depthOfCut}mm | Feed: ${t.feed}mm/rev | Vc: ${t.speed}m/min`);
      lines.push(`Ra (est): ${(t.feed * t.feed / (8 * t.insert.noseRadius) * 1000).toFixed(1)} µm`);

      const zones = allZones[i] || [];
      zones.forEach(z => {
        const icon = z.severity === "safe" ? "✓" : z.severity === "warning" ? "⚠" : "✗";
        lines.push(`  ${icon} ${z.name}: ${z.desc}`);
      });
      lines.push(``);
    });

    if (roughPasses > 0) {
      lines.push(`─── MACHINING ESTIMATE ───`);
      lines.push(`Roughing passes: ${roughPasses}`);
      lines.push(`Est. rough cycle: ${(roughTime / 60).toFixed(1)} min`);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Roll_Tool_Collision_Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tools, rawOD, boreOD, faceWidth, chuckLen, allZones, totalStock, roughPasses, roughTime]);

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-zinc-900/80 shrink-0">
        <Crosshair className="w-5 h-5 text-amber-500" />
        <h1 className="text-sm font-bold tracking-wide text-amber-400">Roll Tool Setup & Collision Check</h1>
        <span className="text-[10px] text-zinc-500 ml-auto">Tool Select | Insert/Holder | Collision Detect | Multi-Tool G-Code</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Raw OD (mm)</label>
            <input type="number" value={rawOD} onChange={e => setRawOD(+e.target.value)}
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
            <label className="text-[10px] text-zinc-500 block mb-0.5">Chuck Length (mm)</label>
            <input type="number" value={chuckLen} onChange={e => setChuckLen(+e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-200 outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {tools.map((t, i) => (
            <ToolSlotCard key={i} tool={t} onChange={v => updateTool(i, v)} index={i} />
          ))}
        </div>

        <CollisionDiagram tools={tools} rawOD={rawOD} boreOD={boreOD} faceWidth={faceWidth}
          chuckLen={chuckLen} allZones={allZones} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-400">Collision Check Results</span>
            </div>
            <div className="space-y-1">
              {allZones.flat().map((z, i) => (
                <div key={i} className={`flex items-start gap-1.5 text-[10px] ${
                  z.severity === "critical" ? "text-red-400" :
                  z.severity === "warning" ? "text-amber-400" : "text-green-400"
                }`}>
                  {z.severity === "critical" ? <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> :
                   z.severity === "warning" ? <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> :
                   <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" />}
                  <div>
                    <div className="font-bold">{z.name}</div>
                    <div className="text-zinc-400">{z.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-blue-400">Tool Sequence (Delta 2X)</span>
            </div>
            <div className="space-y-0.5 text-[10px] font-mono bg-black/30 rounded p-2 border border-white/5 max-h-48 overflow-y-auto">
              {tools.filter(t => t.enabled).map((t, i) => {
                const tn = t.turretPos.toString().padStart(2, "0");
                const rpm = Math.min(500, Math.round(t.speed * 1000 / (Math.PI * rawOD)));
                const roleColor = t.role === "roughing" ? "text-red-400" : t.role === "finishing" ? "text-green-400" : "text-blue-400";
                return (
                  <div key={i} className="mb-1">
                    <div className={`${roleColor} font-bold`}>({t.role.toUpperCase()})</div>
                    <div className="text-zinc-400">G28 U0.</div>
                    <div className="text-zinc-400">G28 W0.</div>
                    <div className="text-cyan-400">T{tn}{tn} ()</div>
                    <div className="text-cyan-400">G92 S{rpm}</div>
                    <div className="text-cyan-400">G97 S{rpm} M4</div>
                    <div className="text-purple-400">G00 X{rawOD + 20}. Z50.</div>
                    {t.role === "roughing" && <>
                      <div className="text-amber-400">G71 U{t.depthOfCut.toFixed(1)} R0.5</div>
                      <div className="text-amber-400">G71 P{100+i*100} Q{200+i*100} U0.4 W0.1 F{t.feed}</div>
                    </>}
                    {t.role === "finishing" && <div className="text-amber-400">G70 P100 Q200 F{t.feed}</div>}
                    {t.role === "grooving" && <div className="text-amber-400">G01 X{boreOD > 0 ? boreOD + 2 : Math.round(rawOD * 0.3)}. F{t.feed}</div>}
                    <div className="text-red-400">G00 X{rawOD + 20}. Z50.</div>
                  </div>
                );
              })}
              <div className="text-zinc-300">G28 U0.</div>
              <div className="text-zinc-300">G28 W0.</div>
              <div className="text-zinc-300">M30</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="bg-zinc-900/80 border border-white/10 rounded-lg p-2">
            <div className="text-[10px] text-zinc-500 mb-1">Machining Summary</div>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span className="text-zinc-400">Total Stock (radial):</span><span>{totalStock.toFixed(1)}mm</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Roughing Passes:</span><span className="text-red-400">{roughPasses}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Est. Rough Time:</span><span>{(roughTime / 60).toFixed(1)} min</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Finish Ra (est):</span><span className="text-green-400">{tools[1].enabled ? (tools[1].feed * tools[1].feed / (8 * tools[1].insert.noseRadius) * 1000).toFixed(1) : "—"} µm</span></div>
            </div>
          </div>
          <div className="flex items-end gap-1">
            <button onClick={exportGcode}
              className="flex-1 flex items-center justify-center gap-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 rounded px-2 py-2 text-[10px] text-amber-400 font-bold">
              <FileText className="w-3 h-3" /> Export G-Code (.NC)
            </button>
          </div>
          <div className="flex items-end gap-1">
            <button onClick={exportReport}
              className="flex-1 flex items-center justify-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded px-2 py-2 text-[10px] text-blue-400 font-bold">
              <FileText className="w-3 h-3" /> Export Report (.TXT)
            </button>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-amber-600/20 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">Tool Selection Rules — Roll Cutting</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-zinc-400">
            <div>1. <span className="text-red-400 font-bold">T01 Roughing:</span> CNMG/WNMG 0.8R — heavy stock removal, G71 cycle</div>
            <div>2. <span className="text-green-400 font-bold">T02 Finishing:</span> VNMG/DNMG 0.4R — profile finish, G70 cycle, low Ra</div>
            <div>3. <span className="text-blue-400 font-bold">T03 Grooving:</span> RCMT/GER — nali/groove cutting, plunge + side</div>
            <div>4. Nose angle chhota = zyada access lekin kamzor (VNMG 35° best finish)</div>
            <div>5. Nose angle bada = strong lekin tight corners nahi cut hota (SNMG 90°)</div>
            <div>6. Holder overhang check karo — workpiece se takraana nahi chahiye</div>
            <div>7. Chuck clearance minimum 5mm rakhein — holder chuck se dur ho</div>
            <div>8. Finishing ke liye: Feed↓ + NoseR↑ = better surface finish (Ra)</div>
            <div>9. Grooving tool reach check karo — poori face width tak pahunchna chahiye</div>
            <div>10. Delta 2X: M4 spindle, G92 S500 max RPM, safe Z=50mm</div>
          </div>
        </div>
      </div>
    </div>
  );
}
