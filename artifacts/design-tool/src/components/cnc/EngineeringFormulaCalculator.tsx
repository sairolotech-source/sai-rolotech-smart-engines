import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Calculator, ChevronDown, ChevronRight, Copy, CheckCircle2 } from "lucide-react";

const K_FACTORS: Record<string, number> = {
  GI: 0.44, CR: 0.44, HR: 0.42, SS: 0.50, AL: 0.43,
  MS: 0.44, CU: 0.44, TI: 0.50, PP: 0.44, HSLA: 0.45,
};

const SPRINGBACK: Record<string, number> = {
  GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15,
  MS: 1.06, CU: 1.08, TI: 1.25, PP: 1.06, HSLA: 1.14,
};

const MATERIAL_BONUS: Record<string, number> = {
  GI: 0, CR: 0, HR: 1, SS: 3, AL: 0,
  MS: 0, CU: 1, TI: 4, PP: 0, HSLA: 2,
};

interface SectionProps {
  title: string;
  formula: string;
  standard?: string;
  color: string;
  children: React.ReactNode;
}

function Section({ title, formula, standard, color, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(formula).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`rounded-xl border ${color} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <span className="font-semibold text-sm text-white flex-1">{title}</span>
        {standard && <span className="text-xs text-gray-500">{standard}</span>}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/5">
          <div className="flex items-center gap-2 mt-3 mb-4">
            <code className="flex-1 text-xs bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-amber-300 font-mono">
              {formula}
            </code>
            <button onClick={copy} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

function ResultBadge({ label, value, unit, color = "text-white" }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>
        {typeof value === "number" ? value.toFixed(3) : value}
      </div>
      {unit && <div className="text-xs text-gray-500 mt-0.5">{unit}</div>}
    </div>
  );
}

export function EngineeringFormulaCalculator() {
  const { materialType, materialThickness, minThickness, maxThickness, geometry } = useCncStore();

  const kFactor = K_FACTORS[materialType] ?? 0.44;
  const springback = SPRINGBACK[materialType] ?? 1.05;

  // BA / BD inputs
  const [baAngle, setBaAngle] = useState(90);
  const [baRadius, setBaRadius] = useState(1.5);
  const [baThickness, setBaThickness] = useState(materialThickness);

  // Station count inputs
  const [scBendCount, setScBendCount] = useState(geometry?.bendPoints?.length ?? 4);
  const [scComplexity, setScComplexity] = useState<"simple" | "medium" | "complex">("medium");

  // Springback inputs
  const [sbDesiredAngle, setSbDesiredAngle] = useState(90);

  // Roll OD inputs
  const [rodProfileDepth, setRodProfileDepth] = useState(50);
  const [rodShaftDia, setRodShaftDia] = useState(60);

  // Face Width inputs
  const [fwContactWidth, setFwContactWidth] = useState(80);
  const [fwRelief, setFwRelief] = useState(5);
  const [fwMargin, setFwMargin] = useState(3);

  // Spacer inputs
  const [spShaftSpace, setSpShaftSpace] = useState(400);
  const [spRollFaceWidth, setSpRollFaceWidth] = useState(200);
  const [spClearance, setSpClearance] = useState(10);

  // Pass angle progression
  const [papFinalAngle, setPapFinalAngle] = useState(90);
  const [papStations, setPapStations] = useState(6);
  const [papType, setPapType] = useState<"linear" | "soft" | "aggressive">("soft");

  // Calculations
  const ba = useMemo(() => {
    const rad = (baAngle * Math.PI) / 180;
    return rad * (baRadius + kFactor * baThickness);
  }, [baAngle, baRadius, baThickness, kFactor]);

  const setback = useMemo(() => {
    const half = (baAngle * Math.PI) / 360;
    return (baRadius + baThickness) * Math.tan(half);
  }, [baAngle, baRadius, baThickness]);

  const bd = useMemo(() => 2 * setback - ba, [setback, ba]);

  const naRadius = useMemo(() => baRadius + kFactor * baThickness, [baRadius, baThickness, kFactor]);

  const stationCount = useMemo(() => {
    const complexityBonus = { simple: 0, medium: 2, complex: 5 }[scComplexity];
    const matBonus = MATERIAL_BONUS[materialType] ?? 0;
    return Math.round(4 + scBendCount * 0.8 + complexityBonus + matBonus);
  }, [scBendCount, scComplexity, materialType]);

  const compensatedAngle = useMemo(() => sbDesiredAngle * springback, [sbDesiredAngle, springback]);

  const rollOD = useMemo(() => {
    const base = rodShaftDia + 2 * 10 + rodProfileDepth;
    return Math.ceil(base / 5) * 5;
  }, [rodProfileDepth, rodShaftDia]);

  const faceWidth = useMemo(() => fwContactWidth + fwRelief + 2 * fwMargin, [fwContactWidth, fwRelief, fwMargin]);

  const spacer = useMemo(() => spShaftSpace - spRollFaceWidth - spClearance, [spShaftSpace, spRollFaceWidth, spClearance]);

  const passAngles = useMemo(() => {
    const angles: number[] = [];
    const target = papFinalAngle * springback;
    for (let s = 1; s <= papStations; s++) {
      const progress = s / papStations;
      let f: number;
      if (papType === "linear") f = progress;
      else if (papType === "soft") f = Math.pow(progress, 1.5);
      else f = Math.pow(progress, 0.6);
      angles.push(parseFloat((target * f).toFixed(1)));
    }
    return angles;
  }, [papFinalAngle, papStations, papType, springback]);

  const rollGapNom = materialThickness * 1.02;
  const rollGapMin = minThickness * 1.01;
  const rollGapMax = maxThickness * 1.03;

  const NumberInput = ({ value, set, min = 0.1, max = 999, step = 0.1, label }: {
    value: number; set: (v: number) => void; min?: number; max?: number; step?: number; label: string;
  }) => (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        min={min} max={max} step={step}
        value={value}
        onChange={e => set(parseFloat(e.target.value) || value)}
        className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm font-mono text-white"
      />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1117] text-white p-4 gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Engineering Formula Calculator</h2>
          <p className="text-xs text-gray-400">All key roll forming formulas — interactive, DIN 6935 / IS 2062 standard</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">{materialType}</span>
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">K={kFactor}</span>
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">SB={springback}×</span>
        </div>
      </div>

      {/* A. Bend Allowance + Bend Deduction */}
      <Section
        title="A. Bend Allowance (BA) & Bend Deduction (BD)"
        formula="BA = (π/180) × Angle × (R + K × T)   |   BD = 2 × Setback − BA"
        standard="DIN 6935"
        color="border-blue-500/20 bg-blue-500/5"
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <NumberInput label="Bend Angle (°)" value={baAngle} set={setBaAngle} min={1} max={180} step={1} />
          <NumberInput label="Inside Radius R (mm)" value={baRadius} set={setBaRadius} min={0.1} max={50} step={0.1} />
          <NumberInput label="Thickness T (mm)" value={baThickness} set={setBaThickness} min={0.1} max={10} step={0.05} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <ResultBadge label="K-Factor" value={kFactor} color="text-amber-300" />
          <ResultBadge label="Neutral Axis R" value={naRadius} unit="mm" color="text-purple-300" />
          <ResultBadge label="Bend Allowance" value={ba} unit="mm" color="text-emerald-300" />
          <ResultBadge label="Bend Deduction" value={bd} unit="mm" color="text-blue-300" />
        </div>
        <div className="mt-3 text-xs text-gray-500">
          Setback = {setback.toFixed(3)} mm · BA for flat blank: subtract BD from each bend location
        </div>
      </Section>

      {/* B. Neutral Axis */}
      <Section
        title="B. Neutral Axis Radius"
        formula="NA_Radius = R + (K × T)"
        standard="DIN 6935"
        color="border-purple-500/20 bg-purple-500/5"
      >
        <div className="grid grid-cols-3 gap-2">
          <ResultBadge label="Inside Radius R" value={baRadius} unit="mm" />
          <ResultBadge label="K × T" value={kFactor * baThickness} unit="mm" color="text-amber-300" />
          <ResultBadge label="Neutral Axis Radius" value={naRadius} unit="mm" color="text-purple-300" />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Material shift: NA is not at midpoint (T/2). For {materialType}, K={kFactor} means NA shifts {((kFactor - 0.5) * 100).toFixed(0)}% from center.
        </p>
      </Section>

      {/* C. Station Count Estimation */}
      <Section
        title="C. Station Count Estimation"
        formula="Stations = 4 + (bendCount × 0.8) + complexityBonus + materialBonus"
        color="border-cyan-500/20 bg-cyan-500/5"
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <NumberInput label="Bend Count" value={scBendCount} set={setScBendCount} min={1} max={20} step={1} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Profile Complexity</label>
            <select
              value={scComplexity}
              onChange={e => setScComplexity(e.target.value as "simple" | "medium" | "complex")}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm text-white"
            >
              <option value="simple">Simple (+0)</option>
              <option value="medium">Medium (+2)</option>
              <option value="complex">Complex (+5)</option>
            </select>
          </div>
          <div className="text-center bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Recommended</div>
            <div className="text-3xl font-bold font-mono text-cyan-300">{stationCount}</div>
            <div className="text-xs text-gray-500">stations</div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          Material bonus ({materialType}): +{MATERIAL_BONUS[materialType] ?? 0} · Base: 4 · Bend: {scBendCount}×0.8={( scBendCount * 0.8).toFixed(1)} · Complexity: +{{ simple: 0, medium: 2, complex: 5 }[scComplexity]}
        </div>
      </Section>

      {/* D. Springback Compensation */}
      <Section
        title="D. Springback Compensation"
        formula="Target_Angle = Desired_Angle × Springback_Factor"
        color="border-orange-500/20 bg-orange-500/5"
      >
        <div className="grid grid-cols-2 gap-3 mb-4">
          <NumberInput label="Desired Final Angle (°)" value={sbDesiredAngle} set={setSbDesiredAngle} min={1} max={180} step={1} />
          <div className="text-center bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Form to (with SB comp.)</div>
            <div className="text-2xl font-bold font-mono text-orange-300">{compensatedAngle.toFixed(1)}°</div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {materialType} springback = {springback}× · Over-bend by {((springback - 1) * sbDesiredAngle).toFixed(1)}° to get {sbDesiredAngle}° final
        </div>
      </Section>

      {/* E. Pass Angle Progression */}
      <Section
        title="E. Pass Angle Progression"
        formula="Linear: angle = finalAngle × (station/total)   |   Soft: angle = finalAngle × (s/n)^1.5"
        color="border-emerald-500/20 bg-emerald-500/5"
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <NumberInput label="Final Angle (°)" value={papFinalAngle} set={setPapFinalAngle} min={1} max={180} step={1} />
          <NumberInput label="No. of Stations" value={papStations} set={setPapStations} min={3} max={20} step={1} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Progression Type</label>
            <select
              value={papType}
              onChange={e => setPapType(e.target.value as "linear" | "soft" | "aggressive")}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-sm text-white"
            >
              <option value="linear">Linear (uniform)</option>
              <option value="soft">Soft (slow start)</option>
              <option value="aggressive">Aggressive (fast start)</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {passAngles.map((angle, i) => (
            <div key={i} className="text-center bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-500">Pass {i + 1}</div>
              <div className="text-sm font-bold font-mono text-emerald-300">{angle}°</div>
              {i > 0 && <div className="text-[10px] text-gray-600">+{(angle - (passAngles[i-1] ?? 0)).toFixed(1)}°</div>}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Angles include {springback}× springback compensation. Tool to {passAngles[passAngles.length - 1] ?? papFinalAngle}° to achieve {papFinalAngle}° final.
        </p>
      </Section>

      {/* F. Roll Gap */}
      <Section
        title="F. Roll Gap Calculation"
        formula="Roll Gap ≈ Thickness × 1.01~1.03 (clearance factor)"
        standard="DIN EN 10162"
        color="border-rose-500/20 bg-rose-500/5"
      >
        <div className="grid grid-cols-3 gap-2">
          <ResultBadge label={`Gap @ Min (${minThickness}mm)`} value={rollGapMin} unit="mm" color="text-blue-300" />
          <ResultBadge label={`Gap @ Nominal (${materialThickness}mm)`} value={rollGapNom} unit="mm" color="text-emerald-300" />
          <ResultBadge label={`Gap @ Max (${maxThickness}mm)`} value={rollGapMax} unit="mm" color="text-amber-300" />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Total gap adjustment: {(rollGapMax - rollGapMin).toFixed(3)}mm · Shim required: {(maxThickness - minThickness).toFixed(2)}mm
        </p>
      </Section>

      {/* G. Roll OD Estimation */}
      <Section
        title="G. Roll OD Estimation"
        formula="Roll OD ≈ ShaftDia + 2×BoreWall + ProfileDepth (rounded up to 5mm)"
        color="border-teal-500/20 bg-teal-500/5"
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <NumberInput label="Profile Depth (mm)" value={rodProfileDepth} set={setRodProfileDepth} min={5} max={300} step={5} />
          <NumberInput label="Shaft Diameter (mm)" value={rodShaftDia} set={setRodShaftDia} min={30} max={150} step={5} />
          <ResultBadge label="Estimated Roll OD" value={rollOD} unit="mm" color="text-teal-300" />
        </div>
        <p className="text-xs text-gray-500">
          Bore wall = 10mm (per side) · Small profiles: 60–90mm · Medium: 90–140mm · Heavy: 140–220mm
        </p>
      </Section>

      {/* H. Face Width */}
      <Section
        title="H. Face Width Calculation"
        formula="Face Width = Contact Width + Relief Allowance + 2 × Side Margin"
        color="border-violet-500/20 bg-violet-500/5"
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <NumberInput label="Contact Width (mm)" value={fwContactWidth} set={setFwContactWidth} min={10} max={500} step={5} />
          <NumberInput label="Relief Allowance (mm)" value={fwRelief} set={setFwRelief} min={0} max={50} step={1} />
          <NumberInput label="Side Margin (mm)" value={fwMargin} set={setFwMargin} min={0} max={20} step={1} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ResultBadge label="Face Width" value={faceWidth} unit="mm" color="text-violet-300" />
          <ResultBadge label="Margins (both sides)" value={2 * fwMargin} unit="mm" color="text-gray-400" />
        </div>
      </Section>

      {/* I. Spacer Width */}
      <Section
        title="I. Spacer Width Calculation"
        formula="Spacer Width = Total Shaft Space − Roll Face Width − Clearance"
        color="border-pink-500/20 bg-pink-500/5"
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <NumberInput label="Total Shaft Space (mm)" value={spShaftSpace} set={setSpShaftSpace} min={100} max={2000} step={10} />
          <NumberInput label="Roll Face Width (mm)" value={spRollFaceWidth} set={setSpRollFaceWidth} min={50} max={1000} step={5} />
          <NumberInput label="Clearance (mm)" value={spClearance} set={setSpClearance} min={0} max={50} step={1} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ResultBadge label="Spacer Width" value={spacer} unit="mm" color={spacer > 0 ? "text-pink-300" : "text-red-400"} />
          {spacer <= 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
              ⚠ Spacer negative — increase shaft space or reduce roll face width
            </div>
          )}
        </div>
      </Section>

      {/* Standards Reference */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">Standards Referenced: </span>
        DIN 6935 (cold bending, K-factor, BA) · DIN EN 10162 (roll formed sections, tolerances) ·
        IS 2062 (structural steel) · ASTM A240 (SS) · ASTM A653 (GI) ·
        Industry-standard roll forming formulas (Prof. D. Bhattacharya, 2019)
      </div>

    </div>
  );
}
