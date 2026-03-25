import React, { useMemo, useState } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Cog, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronRight, Settings } from "lucide-react";

interface MachineSpec {
  name: string;
  shaftDia: number;
  maxRollOD: number;
  standSpacing: number;
  maxStations: number;
  motorHP: number;
  maxThickness: number;
  maxWidth: number;
  maxLineSpeed: number;
}

const MACHINE_PRESETS: MachineSpec[] = [
  { name: "Light Duty (RF-100)", shaftDia: 40, maxRollOD: 100, standSpacing: 250, maxStations: 12, motorHP: 5, maxThickness: 1.5, maxWidth: 200, maxLineSpeed: 30 },
  { name: "Medium Duty (RF-200)", shaftDia: 60, maxRollOD: 140, standSpacing: 300, maxStations: 16, motorHP: 10, maxThickness: 3.0, maxWidth: 350, maxLineSpeed: 25 },
  { name: "Standard (RF-300)", shaftDia: 75, maxRollOD: 180, standSpacing: 350, maxStations: 20, motorHP: 15, maxThickness: 4.0, maxWidth: 500, maxLineSpeed: 20 },
  { name: "Heavy Duty (RF-500)", shaftDia: 100, maxRollOD: 220, standSpacing: 400, maxStations: 24, motorHP: 25, maxThickness: 6.0, maxWidth: 650, maxLineSpeed: 15 },
  { name: "Extra Heavy (RF-800)", shaftDia: 120, maxRollOD: 280, standSpacing: 500, maxStations: 30, motorHP: 40, maxThickness: 8.0, maxWidth: 800, maxLineSpeed: 12 },
];

const YIELD_MAP: Record<string, number> = {
  GI: 280, CR: 340, HR: 250, SS: 310, AL: 270,
  MS: 250, CU: 200, TI: 880, PP: 280, HSLA: 550,
};

type CheckStatus = "pass" | "warning" | "fail";

interface FitmentCheck {
  id: string;
  category: string;
  check: string;
  status: CheckStatus;
  actual: string;
  limit: string;
  detail: string;
  fix?: string;
}

function evaluateFitment(
  machine: MachineSpec,
  materialType: string,
  thickness: number,
  maxT: number,
  bendRadius: number,
  numStations: number,
  profileWidth: number,
  profileDepth: number,
): FitmentCheck[] {
  const checks: FitmentCheck[] = [];
  const yld = YIELD_MAP[materialType] ?? 280;

  const estimatedRollOD = machine.shaftDia + 20 + profileDepth;
  const rollODOk = estimatedRollOD <= machine.maxRollOD;
  const rollODWarn = estimatedRollOD > machine.maxRollOD * 0.85;
  checks.push({
    id: "MF01", category: "Roll OD", check: "Maximum Roll OD Check",
    status: rollODOk ? (rollODWarn ? "warning" : "pass") : "fail",
    actual: `${estimatedRollOD} mm`, limit: `≤ ${machine.maxRollOD} mm`,
    detail: `Estimated roll OD = Shaft(${machine.shaftDia}) + Bore(20) + Depth(${profileDepth}) = ${estimatedRollOD}mm`,
    fix: !rollODOk ? `Profile too deep for this machine. Need machine with max OD ≥ ${estimatedRollOD}mm, or reduce profile depth.` : undefined,
  });

  checks.push({
    id: "MF02", category: "Shaft", check: "Shaft Diameter Suitability",
    status: machine.shaftDia >= 40 && thickness <= machine.maxThickness ? "pass" :
            thickness > machine.maxThickness ? "fail" : "warning",
    actual: `${machine.shaftDia} mm shaft`,
    limit: `Suitable for T ≤ ${machine.maxThickness} mm`,
    detail: `Shaft ${machine.shaftDia}mm handles forming loads for ${materialType} at ${thickness}mm`,
    fix: thickness > machine.maxThickness ? `Thickness ${thickness}mm exceeds machine capacity ${machine.maxThickness}mm. Use heavier machine.` : undefined,
  });

  checks.push({
    id: "MF03", category: "Stations", check: "Station Count Capacity",
    status: numStations <= machine.maxStations ? "pass" : "fail",
    actual: `${numStations} stations required`,
    limit: `≤ ${machine.maxStations} stations available`,
    detail: `Machine has ${machine.maxStations} station positions. Design needs ${numStations}.`,
    fix: numStations > machine.maxStations ? `Need ${numStations - machine.maxStations} more stations. Consider: (a) larger machine, (b) reducing station count by using more aggressive passes, (c) tandem forming (2 machines in line).` : undefined,
  });

  const spacerWidth = machine.standSpacing - profileWidth - 20;
  checks.push({
    id: "MF04", category: "Spacer", check: "Spacer Feasibility",
    status: spacerWidth >= 10 ? "pass" : spacerWidth >= 0 ? "warning" : "fail",
    actual: `${spacerWidth.toFixed(0)} mm available`,
    limit: `≥ 10 mm minimum spacer width`,
    detail: `Stand spacing(${machine.standSpacing}) − Profile width(${profileWidth}) − Clearance(20) = ${spacerWidth.toFixed(0)}mm`,
    fix: spacerWidth < 10 ? `Profile too wide for stand spacing. Need wider machine or split the profile into two passes.` : undefined,
  });

  checks.push({
    id: "MF05", category: "Width", check: "Profile Width vs Machine Width",
    status: profileWidth <= machine.maxWidth ? "pass" : "fail",
    actual: `${profileWidth} mm`,
    limit: `≤ ${machine.maxWidth} mm max`,
    detail: `Profile developed width ${profileWidth}mm vs machine max forming width ${machine.maxWidth}mm`,
    fix: profileWidth > machine.maxWidth ? `Profile exceeds machine width by ${profileWidth - machine.maxWidth}mm. Need wider machine.` : undefined,
  });

  const formingForce = 0.5 * yld * thickness * thickness * numStations * 0.001;
  const motorCapacity = machine.motorHP * 0.746;
  const forceOk = formingForce < motorCapacity * 50;
  checks.push({
    id: "MF06", category: "Motor", check: "Motor Power Check",
    status: forceOk ? "pass" : "warning",
    actual: `~${formingForce.toFixed(1)} kN total`,
    limit: `Motor: ${machine.motorHP} HP (${(motorCapacity).toFixed(1)} kW)`,
    detail: `Estimated total forming force for ${materialType} at ${thickness}mm across ${numStations} stations = ${formingForce.toFixed(1)} kN. Motor capacity ~${(motorCapacity * 50).toFixed(0)} kN·m/s.`,
    fix: !forceOk ? `Motor may be undersized. Consider upgrading to ${Math.ceil(formingForce / 50 / 0.746 * 1.3)} HP motor.` : undefined,
  });

  const upperRollOD = estimatedRollOD;
  const lowerRollOD = estimatedRollOD - 10;
  const clearanceBetween = machine.standSpacing - (upperRollOD / 2 + lowerRollOD / 2 + thickness);
  const interferenceOk = clearanceBetween > 5;
  checks.push({
    id: "MF07", category: "Interference", check: "Upper/Lower Roll Interference",
    status: interferenceOk ? "pass" : clearanceBetween > 0 ? "warning" : "fail",
    actual: `${clearanceBetween.toFixed(1)} mm clearance`,
    limit: `≥ 5 mm minimum gap`,
    detail: `Upper OD(${upperRollOD}) + Lower OD(${lowerRollOD}) + Strip(${thickness}) = ${(upperRollOD / 2 + lowerRollOD / 2 + thickness).toFixed(0)}mm vs stand height`,
    fix: !interferenceOk ? `Rolls too large for this machine. Reduce profile depth or use machine with larger daylight.` : undefined,
  });

  checks.push({
    id: "MF08", category: "Assembly", check: "Assembly Sequence Feasibility",
    status: spacerWidth >= 5 && rollODOk ? "pass" : "warning",
    actual: rollODOk && spacerWidth >= 5 ? "Standard assembly possible" : "Custom assembly needed",
    limit: "Standard: slide-on from side",
    detail: `Roll assembly sequence: spacer → lower roll → strip guide → upper roll → lock nut. Spacer: ${spacerWidth.toFixed(0)}mm, Roll OD: ${estimatedRollOD}mm`,
    fix: spacerWidth < 5 ? "Tight spacer makes roll changes difficult. Consider split spacer design." : undefined,
  });

  const maxT_check = maxT <= machine.maxThickness;
  checks.push({
    id: "MF09", category: "Thickness", check: "Max Thickness vs Machine Capacity",
    status: maxT_check ? "pass" : "fail",
    actual: `Max T = ${maxT} mm`,
    limit: `Machine max: ${machine.maxThickness} mm`,
    detail: `Your max thickness range (${maxT}mm) must fit within machine capacity (${machine.maxThickness}mm)`,
    fix: !maxT_check ? `Max thickness exceeds machine limit by ${(maxT - machine.maxThickness).toFixed(1)}mm. Use heavier machine or reduce thickness range.` : undefined,
  });

  return checks;
}

const STATUS_CFG = {
  pass:    { icon: <CheckCircle2 className="w-4 h-4" />, bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", label: "PASS" },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-400",  label: "WARN" },
  fail:    { icon: <XCircle className="w-4 h-4" />,       bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-400",    label: "FAIL" },
};

function CheckCard({ check }: { check: FitmentCheck }) {
  const [open, setOpen] = useState(check.status !== "pass");
  const cfg = STATUS_CFG[check.status];

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <span className={cfg.text}>{cfg.icon}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
        <span className="flex-1 text-sm text-white font-medium">{check.check}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{cfg.label}</span>
        <span className="text-xs text-gray-500 font-mono">{check.id}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
          <p className="text-sm text-gray-300">{check.detail}</p>
          <div className="flex gap-4 text-xs">
            <span className="text-gray-400">Actual: <span className="font-mono text-white">{check.actual}</span></span>
            <span className="text-gray-400">Limit: <span className="font-mono text-amber-300">{check.limit}</span></span>
          </div>
          {check.fix && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-gray-400">
              <span className="font-semibold text-gray-300">Fix: </span>{check.fix}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MachineFitmentEngine() {
  const { materialType, materialThickness, maxThickness, bendRadius, numStations } = useCncStore();

  const [selectedMachine, setSelectedMachine] = useState(2);
  const [profileWidth, setProfileWidth] = useState(200);
  const [profileDepth, setProfileDepth] = useState(50);

  const machine = MACHINE_PRESETS[selectedMachine];

  const checks = useMemo(() =>
    evaluateFitment(machine, materialType, materialThickness, maxThickness, bendRadius, numStations, profileWidth, profileDepth),
    [machine, materialType, materialThickness, maxThickness, bendRadius, numStations, profileWidth, profileDepth]
  );

  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.status === "fail").length;
  const warnCount = checks.filter(c => c.status === "warning").length;
  const overallPass = failCount === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1117] text-white p-4 gap-4">

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${overallPass ? "bg-emerald-600/20 border-emerald-500/30" : "bg-red-600/20 border-red-500/30"} border flex items-center justify-center`}>
          <Cog className={`w-5 h-5 ${overallPass ? "text-emerald-400" : "text-red-400"}`} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Machine Fitment Engine</h2>
          <p className="text-xs text-gray-400">Production machine compatibility — {checks.length} checks</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">{materialType}</span>
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">T={materialThickness}mm</span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Machine Selection & Profile Inputs
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <label className="block text-xs text-gray-400 mb-1">Machine Model</label>
            <select
              value={selectedMachine}
              onChange={e => setSelectedMachine(Number(e.target.value))}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
            >
              {MACHINE_PRESETS.map((m, i) => (
                <option key={i} value={i}>
                  {m.name} — Shaft: {m.shaftDia}mm · Max OD: {m.maxRollOD}mm · {m.motorHP}HP · {m.maxStations} stations
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Profile Width (mm)</label>
            <input
              type="number" min={10} max={1000} step={10}
              value={profileWidth}
              onChange={e => setProfileWidth(Number(e.target.value) || 200)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm font-mono text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Profile Depth (mm)</label>
            <input
              type="number" min={5} max={300} step={5}
              value={profileDepth}
              onChange={e => setProfileDepth(Number(e.target.value) || 50)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm font-mono text-white"
            />
          </div>
          <div className="flex flex-col justify-center text-center">
            <div className="text-[10px] text-gray-500">Using from store</div>
            <div className="text-xs font-mono text-gray-300">{numStations} stations · R={bendRadius}mm</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xs text-gray-400">Shaft</div>
          <div className="text-xl font-bold font-mono text-white">{machine.shaftDia}</div>
          <div className="text-xs text-gray-500">mm</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xs text-gray-400">Max OD</div>
          <div className="text-xl font-bold font-mono text-white">{machine.maxRollOD}</div>
          <div className="text-xs text-gray-500">mm</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
          <div className="text-xs text-gray-400">Motor</div>
          <div className="text-xl font-bold font-mono text-white">{machine.motorHP}</div>
          <div className="text-xs text-gray-500">HP</div>
        </div>
        <div className={`rounded-xl border ${overallPass ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10"} p-3 text-center`}>
          <div className="text-xs text-gray-400">Verdict</div>
          <div className={`text-xl font-bold ${overallPass ? "text-emerald-400" : "text-red-400"}`}>
            {overallPass ? "FIT" : "NO FIT"}
          </div>
          <div className="text-xs text-gray-500">{passCount}✓ {warnCount}⚠ {failCount}✗</div>
        </div>
      </div>

      <div className="space-y-3">
        {checks.map(c => <CheckCard key={c.id} check={c} />)}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">Machine Presets: </span>
        5 standard configurations. For custom machines, values can be adjusted.
        All checks are indicative — verify with actual machine specifications from manufacturer datasheet.
      </div>
    </div>
  );
}
