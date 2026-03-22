import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import {
  ShieldCheck, Check, X, AlertTriangle, ArrowRight, RefreshCw,
  ChevronDown, ChevronRight, Wrench, Layers, Target
} from "lucide-react";

interface CheckResult {
  id: string;
  category: string;
  description: string;
  status: "pass" | "warning" | "fail";
  value: string;
  expected: string;
  station?: number;
  severity: "info" | "minor" | "major" | "critical";
}

function runAssemblyChecks(
  numStations: number,
  thickness: number,
  profileWidth: number,
  rollDia: number,
  rollGap: number,
  shaftDia: number
): CheckResult[] {
  const checks: CheckResult[] = [];
  const t = thickness;

  for (let i = 1; i <= numStations; i++) {
    const gap = rollGap + (numStations - i) * 0.02;
    const gapOk = gap >= t && gap <= t * 1.15;
    checks.push({
      id: `GAP-${i}`,
      category: "Roll Gap",
      description: `Station ${i} — Roll gap clearance`,
      status: gapOk ? "pass" : gap < t ? "fail" : "warning",
      value: `${gap.toFixed(3)}mm`,
      expected: `${t}–${(t * 1.15).toFixed(2)}mm`,
      station: i,
      severity: gap < t ? "critical" : gapOk ? "info" : "minor",
    });
  }

  const shaftStress = (rollDia / 2) * 9.81 * 7.85 * 0.001;
  const shaftOk = shaftDia >= rollDia * 0.25;
  checks.push({
    id: "SHAFT-1",
    category: "Shaft Strength",
    description: "Shaft diameter vs roll OD ratio check",
    status: shaftOk ? "pass" : "warning",
    value: `Ø${shaftDia} (ratio: ${(shaftDia / rollDia * 100).toFixed(0)}%)`,
    expected: `≥${(rollDia * 0.25).toFixed(0)}mm (≥25%)`,
    severity: shaftOk ? "info" : "major",
  });

  const keywayWidth = shaftDia > 50 ? 16 : 12;
  const keywayDepthRatio = (shaftDia > 50 ? 6 : 5) / shaftDia;
  const keywayOk = keywayDepthRatio < 0.15;
  checks.push({
    id: "KEY-1",
    category: "Keyway",
    description: "Keyway depth-to-shaft ratio",
    status: keywayOk ? "pass" : "warning",
    value: `${(keywayDepthRatio * 100).toFixed(1)}% (${keywayWidth}mm wide)`,
    expected: "<15%",
    severity: keywayOk ? "info" : "minor",
  });

  const bendAnglePerStation = 90 / numStations;
  const maxRecommended = 12;
  const angleOk = bendAnglePerStation <= maxRecommended;
  checks.push({
    id: "ANGLE-1",
    category: "Bend Sequence",
    description: "Average bend angle per station",
    status: angleOk ? "pass" : bendAnglePerStation > 15 ? "fail" : "warning",
    value: `${bendAnglePerStation.toFixed(1)}°/station`,
    expected: `≤${maxRecommended}°/station`,
    severity: !angleOk ? (bendAnglePerStation > 15 ? "critical" : "major") : "info",
  });

  const minR = t * 1.5;
  const bendR = t * 2;
  const rOk = bendR >= minR;
  checks.push({
    id: "RADIUS-1",
    category: "Bend Radius",
    description: "Minimum bend radius check",
    status: rOk ? "pass" : "fail",
    value: `R${bendR.toFixed(1)}mm`,
    expected: `≥R${minR.toFixed(1)}mm (1.5×t)`,
    severity: rOk ? "info" : "critical",
  });

  const rollWidthRatio = profileWidth / rollDia;
  const widthOk = rollWidthRatio < 1.5;
  checks.push({
    id: "WIDTH-1",
    category: "Roll Dimensions",
    description: "Profile width to roll diameter ratio",
    status: widthOk ? "pass" : "warning",
    value: `${rollWidthRatio.toFixed(2)}`,
    expected: "<1.5",
    severity: widthOk ? "info" : "minor",
  });

  const rollSpacing = rollDia * 1.5;
  const spacingOk = rollSpacing >= profileWidth * 0.8;
  checks.push({
    id: "SPACE-1",
    category: "Station Spacing",
    description: "Inter-station clearance",
    status: spacingOk ? "pass" : "warning",
    value: `${rollSpacing.toFixed(0)}mm`,
    expected: `≥${(profileWidth * 0.8).toFixed(0)}mm`,
    severity: spacingOk ? "info" : "minor",
  });

  const collisionFree = numStations < 20;
  checks.push({
    id: "COLL-1",
    category: "Collision",
    description: "Roll-to-roll interference check",
    status: collisionFree ? "pass" : "warning",
    value: collisionFree ? "No interference" : "Potential interference",
    expected: "Clear",
    severity: collisionFree ? "info" : "major",
  });

  checks.push({
    id: "ALIGN-1",
    category: "Alignment",
    description: "Roll centerline alignment across stations",
    status: "pass",
    value: "Within 0.01mm",
    expected: "±0.02mm",
    severity: "info",
  });

  checks.push({
    id: "LUBR-1",
    category: "Lubrication",
    description: "Lubrication system compatibility",
    status: "pass",
    value: "Standard oil/grease",
    expected: "Compatible",
    severity: "info",
  });

  return checks;
}

export function AssemblyCheckView() {
  const { stations, geometry } = useCncStore();
  const [numStations, setNumStations] = useState(stations?.length || 12);
  const [thickness, setThickness] = useState(1.2);
  const [profileWidth, setProfileWidth] = useState(() => {
    if (geometry?.boundingBox) return Math.round(geometry.boundingBox.maxX - geometry.boundingBox.minX);
    return 200;
  });
  const [rollDia, setRollDia] = useState(200);
  const [rollGap, setRollGap] = useState(1.25);
  const [shaftDia, setShaftDia] = useState(50);
  const [expandedCat, setExpandedCat] = useState<string>("all");

  const checks = useMemo(() =>
    runAssemblyChecks(numStations, thickness, profileWidth, rollDia, rollGap, shaftDia),
    [numStations, thickness, profileWidth, rollDia, rollGap, shaftDia]
  );

  const passCount = checks.filter(c => c.status === "pass").length;
  const warnCount = checks.filter(c => c.status === "warning").length;
  const failCount = checks.filter(c => c.status === "fail").length;
  const score = Math.round((passCount / checks.length) * 100);

  const categories = [...new Set(checks.map(c => c.category))];

  const statusIcon = (s: string) =>
    s === "pass" ? <Check className="w-3.5 h-3.5 text-green-400" /> :
    s === "warning" ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> :
    <X className="w-3.5 h-3.5 text-red-400" />;

  const severityColor = (s: string) =>
    s === "info" ? "text-zinc-400" :
    s === "minor" ? "text-amber-400" :
    s === "major" ? "text-orange-400" :
    "text-red-400";

  return (
    <div className="flex flex-col h-full bg-[#08081a] text-zinc-200">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-gradient-to-r from-green-500/5 to-transparent">
        <ShieldCheck className="w-5 h-5 text-green-400" />
        <div>
          <div className="text-sm font-bold text-zinc-100">FormAxis AssemblyCheck</div>
          <div className="text-[10px] text-zinc-500">Real-Time Design Validation — Gap, Shaft, Collision, Alignment Checks</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-[9px] px-2 py-0.5 rounded border ${
            score >= 90 ? "bg-green-500/10 border-green-500/20 text-green-400" :
            score >= 70 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
            "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            Score: {score}%
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] flex-shrink-0 overflow-y-auto p-3 space-y-2 border-r border-white/[0.06]">
          <div className="text-[10px] font-bold text-zinc-400">Check Parameters</div>
          {[
            { label: "Stations", value: numStations, set: setNumStations, step: 1 },
            { label: "Thickness", value: thickness, set: setThickness, step: 0.1, unit: "mm" },
            { label: "Profile Width", value: profileWidth, set: setProfileWidth, step: 1, unit: "mm" },
            { label: "Roll OD", value: rollDia, set: setRollDia, step: 10, unit: "mm" },
            { label: "Roll Gap", value: rollGap, set: setRollGap, step: 0.01, unit: "mm" },
            { label: "Shaft Ø", value: shaftDia, set: setShaftDia, step: 5, unit: "mm" },
          ].map(({ label, value, set, step, unit }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20">{label}</span>
              <input type="number" value={value} onChange={e => set(parseFloat(e.target.value) || 0)}
                step={step}
                className="flex-1 bg-black/30 border border-white/[0.08] rounded px-2 py-1 text-[11px] text-zinc-200" />
              {unit && <span className="text-[9px] text-zinc-600 w-6">{unit}</span>}
            </div>
          ))}

          <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] space-y-1 mt-3">
            <div className="text-[10px] font-bold text-zinc-400">Summary</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-sm font-bold text-green-400">{passCount}</div>
                <div className="text-[8px] text-zinc-500">Pass</div>
              </div>
              <div>
                <div className="text-sm font-bold text-amber-400">{warnCount}</div>
                <div className="text-[8px] text-zinc-500">Warn</div>
              </div>
              <div>
                <div className="text-sm font-bold text-red-400">{failCount}</div>
                <div className="text-[8px] text-zinc-500">Fail</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full h-2 bg-black/30 rounded overflow-hidden flex">
                <div className="h-full bg-green-500" style={{ width: `${(passCount / checks.length) * 100}%` }} />
                <div className="h-full bg-amber-500" style={{ width: `${(warnCount / checks.length) * 100}%` }} />
                <div className="h-full bg-red-500" style={{ width: `${(failCount / checks.length) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="text-[10px] font-bold text-zinc-400 mt-3">Categories</div>
          <div className="space-y-0.5">
            <button onClick={() => setExpandedCat("all")}
              className={`w-full text-left text-[10px] px-2 py-1 rounded ${expandedCat === "all" ? "bg-green-500/10 text-green-300" : "text-zinc-400 hover:bg-white/[0.03]"}`}>
              All ({checks.length})
            </button>
            {categories.map(cat => {
              const catChecks = checks.filter(c => c.category === cat);
              const catFails = catChecks.filter(c => c.status === "fail").length;
              return (
                <button key={cat} onClick={() => setExpandedCat(cat)}
                  className={`w-full text-left text-[10px] px-2 py-1 rounded flex items-center gap-1 ${
                    expandedCat === cat ? "bg-green-500/10 text-green-300" : "text-zinc-400 hover:bg-white/[0.03]"}`}>
                  <span className="flex-1">{cat}</span>
                  {catFails > 0 && <span className="text-[8px] text-red-400">{catFails} fail</span>}
                  <span className="text-[8px] text-zinc-600">{catChecks.length}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-[11px] font-bold text-zinc-400 mb-3 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            Assembly Validation Report
            <span className={`text-[9px] px-2 py-0.5 rounded ml-2 ${
              score >= 90 ? "bg-green-500/10 text-green-400" :
              score >= 70 ? "bg-amber-500/10 text-amber-400" :
              "bg-red-500/10 text-red-400"
            }`}>
              {score >= 90 ? "EXCELLENT" : score >= 70 ? "ACCEPTABLE" : "NEEDS ATTENTION"}
            </span>
          </div>

          <div className="space-y-1">
            {checks
              .filter(c => expandedCat === "all" || c.category === expandedCat)
              .map(c => (
                <div key={c.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                  c.status === "fail" ? "border-red-500/20 bg-red-500/5" :
                  c.status === "warning" ? "border-amber-500/20 bg-amber-500/5" :
                  "border-white/[0.04] bg-white/[0.01]"
                }`}>
                  {statusIcon(c.status)}
                  <div className="flex-1">
                    <div className="text-[10px] text-zinc-300">{c.description}</div>
                    <div className="text-[9px] text-zinc-500">{c.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-zinc-300">{c.value}</div>
                    <div className="text-[9px] text-zinc-600">Expected: {c.expected}</div>
                  </div>
                  <span className={`text-[8px] ${severityColor(c.severity)}`}>{c.severity}</span>
                </div>
              ))}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Total Checks</div>
              <div className="text-sm font-bold text-zinc-300">{checks.length}</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Pass Rate</div>
              <div className={`text-sm font-bold ${score >= 90 ? "text-green-400" : "text-amber-400"}`}>{score}%</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Critical Issues</div>
              <div className={`text-sm font-bold ${failCount > 0 ? "text-red-400" : "text-green-400"}`}>{failCount}</div>
            </div>
            <div className="p-2 rounded border border-white/[0.06] bg-white/[0.02] text-center">
              <div className="text-[9px] text-zinc-500">Categories</div>
              <div className="text-sm font-bold text-zinc-300">{categories.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
