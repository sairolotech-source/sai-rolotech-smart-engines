import React, { useMemo, useState } from "react";
import { useCncStore } from "../../store/useCncStore";
import { ShieldCheck, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

const MATERIAL_DATABASE_RULES: Record<string, {
  minBendRadiusMultiplier: number;
  crackRisk: "low" | "medium" | "high";
  maxPassAngle: number;
  twistProne: boolean;
  flangeCollapseRatio: number;
  springbackFactor: number;
  yieldStrength: number;
  tensileStrength: number;
}> = {
  GI:   { minBendRadiusMultiplier: 1.0, crackRisk: "low",    maxPassAngle: 20, twistProne: false, flangeCollapseRatio: 8.0,  springbackFactor: 1.05, yieldStrength: 280, tensileStrength: 380 },
  CR:   { minBendRadiusMultiplier: 0.8, crackRisk: "low",    maxPassAngle: 22, twistProne: false, flangeCollapseRatio: 7.0,  springbackFactor: 1.08, yieldStrength: 340, tensileStrength: 440 },
  HR:   { minBendRadiusMultiplier: 1.5, crackRisk: "medium", maxPassAngle: 15, twistProne: true,  flangeCollapseRatio: 6.0,  springbackFactor: 1.12, yieldStrength: 250, tensileStrength: 420 },
  SS:   { minBendRadiusMultiplier: 2.0, crackRisk: "high",   maxPassAngle: 12, twistProne: true,  flangeCollapseRatio: 10.0, springbackFactor: 1.20, yieldStrength: 310, tensileStrength: 620 },
  AL:   { minBendRadiusMultiplier: 1.5, crackRisk: "medium", maxPassAngle: 14, twistProne: false, flangeCollapseRatio: 12.0, springbackFactor: 1.15, yieldStrength: 270, tensileStrength: 310 },
  MS:   { minBendRadiusMultiplier: 1.0, crackRisk: "low",    maxPassAngle: 22, twistProne: false, flangeCollapseRatio: 7.0,  springbackFactor: 1.06, yieldStrength: 250, tensileStrength: 410 },
  CU:   { minBendRadiusMultiplier: 1.0, crackRisk: "low",    maxPassAngle: 18, twistProne: false, flangeCollapseRatio: 10.0, springbackFactor: 1.08, yieldStrength: 200, tensileStrength: 300 },
  TI:   { minBendRadiusMultiplier: 3.0, crackRisk: "high",   maxPassAngle: 8,  twistProne: true,  flangeCollapseRatio: 15.0, springbackFactor: 1.25, yieldStrength: 880, tensileStrength: 950 },
  PP:   { minBendRadiusMultiplier: 1.0, crackRisk: "low",    maxPassAngle: 20, twistProne: false, flangeCollapseRatio: 8.0,  springbackFactor: 1.06, yieldStrength: 280, tensileStrength: 380 },
  HSLA: { minBendRadiusMultiplier: 2.0, crackRisk: "medium", maxPassAngle: 12, twistProne: true,  flangeCollapseRatio: 9.0,  springbackFactor: 1.14, yieldStrength: 550, tensileStrength: 650 },
};

type Severity = "pass" | "info" | "warning" | "critical" | "fail";

interface RuleResult {
  id: string;
  category: string;
  rule: string;
  severity: Severity;
  message: string;
  value?: string;
  threshold?: string;
  recommendation?: string;
}

function evaluateRules(
  materialType: string,
  thickness: number,
  minThickness: number,
  maxThickness: number,
  bendRadius: number,
  stations: any[],
  numStations: number,
): RuleResult[] {
  const mat = MATERIAL_DATABASE_RULES[materialType] ?? MATERIAL_DATABASE_RULES["GI"];
  const results: RuleResult[] = [];

  const minBendR = mat.minBendRadiusMultiplier * thickness;
  if (bendRadius < minBendR) {
    results.push({
      id: "R001", category: "Bend Radius", rule: "Minimum Bend Radius Check",
      severity: "critical",
      message: `Bend radius ${bendRadius.toFixed(2)}mm is BELOW minimum ${minBendR.toFixed(2)}mm for ${materialType}`,
      value: `${bendRadius.toFixed(2)} mm`, threshold: `≥ ${minBendR.toFixed(2)} mm`,
      recommendation: `Increase bend radius to at least ${minBendR.toFixed(1)}mm (${mat.minBendRadiusMultiplier}× thickness). Consider annealing or pre-grooving for tighter bends.`,
    });
  } else if (bendRadius < minBendR * 1.2) {
    results.push({
      id: "R001", category: "Bend Radius", rule: "Minimum Bend Radius Check",
      severity: "warning",
      message: `Bend radius ${bendRadius.toFixed(2)}mm is close to minimum ${minBendR.toFixed(2)}mm — within 20% margin`,
      value: `${bendRadius.toFixed(2)} mm`, threshold: `≥ ${minBendR.toFixed(2)} mm`,
      recommendation: `Safe but tight. Monitor for cracking on production runs. Consider 1.5× minimum for safety margin.`,
    });
  } else {
    results.push({
      id: "R001", category: "Bend Radius", rule: "Minimum Bend Radius Check",
      severity: "pass",
      message: `Bend radius ${bendRadius.toFixed(2)}mm is safe (min: ${minBendR.toFixed(2)}mm)`,
      value: `${bendRadius.toFixed(2)} mm`, threshold: `≥ ${minBendR.toFixed(2)} mm`,
    });
  }

  if (mat.crackRisk === "high") {
    results.push({
      id: "R002", category: "Material Risk", rule: "High Tensile Crack Risk",
      severity: "critical",
      message: `${materialType} (UTS: ${mat.tensileStrength} MPa) has HIGH cracking risk during cold forming`,
      value: `${mat.tensileStrength} MPa UTS`, threshold: "< 500 MPa for safe cold forming",
      recommendation: `Use reduced pass angles (max ${mat.maxPassAngle}°/station), larger bend radii, and consider intermediate annealing. Grain direction alignment is critical.`,
    });
  } else if (mat.crackRisk === "medium") {
    results.push({
      id: "R002", category: "Material Risk", rule: "Tensile Crack Risk",
      severity: "warning",
      message: `${materialType} has moderate cracking risk — monitor edge quality`,
      value: mat.crackRisk.toUpperCase(), threshold: "LOW preferred",
      recommendation: `Ensure burr-free edges. Keep pass angles ≤ ${mat.maxPassAngle}°. Use lubricant on bend zones.`,
    });
  } else {
    results.push({
      id: "R002", category: "Material Risk", rule: "Tensile Crack Risk",
      severity: "pass",
      message: `${materialType} has low cracking risk — good for roll forming`,
      value: mat.crackRisk.toUpperCase(),
    });
  }

  if (mat.twistProne) {
    results.push({
      id: "R003", category: "Twist Risk", rule: "Asymmetric Twist Risk",
      severity: "warning",
      message: `${materialType} is prone to twist defect due to high springback (${mat.springbackFactor}×)`,
      value: `SB: ${mat.springbackFactor}×`, threshold: "< 1.10× preferred",
      recommendation: `Use symmetric forming sequence. Add twist correction rolls at exit. Balance left-right forming angles precisely.`,
    });
  } else {
    results.push({
      id: "R003", category: "Twist Risk", rule: "Asymmetric Twist Risk",
      severity: "pass",
      message: `${materialType} has low twist tendency`,
      value: `SB: ${mat.springbackFactor}×`,
    });
  }

  const thicknessRatio = minThickness > 0 ? maxThickness / minThickness : 1.0;
  if (thicknessRatio > 1.35) {
    results.push({
      id: "R004", category: "Thickness", rule: "Thickness Range Compatibility",
      severity: "critical",
      message: `Thickness ratio ${thicknessRatio.toFixed(2)}× exceeds 1.35× limit — separate tooling required`,
      value: `${thicknessRatio.toFixed(2)}×`, threshold: "≤ 1.20× same tooling",
      recommendation: `Split into two tooling sets: Set A for ${minThickness}–${thickness.toFixed(2)}mm, Set B for ${thickness.toFixed(2)}–${maxThickness}mm.`,
    });
  } else if (thicknessRatio > 1.20) {
    results.push({
      id: "R004", category: "Thickness", rule: "Thickness Range Compatibility",
      severity: "warning",
      message: `Thickness ratio ${thicknessRatio.toFixed(2)}× requires tooling review`,
      value: `${thicknessRatio.toFixed(2)}×`, threshold: "≤ 1.20× same tooling",
      recommendation: `Shim-based adjustment may work. Verify roll gap at both extremes. Document shim sizes per station.`,
    });
  } else {
    results.push({
      id: "R004", category: "Thickness", rule: "Thickness Range Compatibility",
      severity: "pass",
      message: `Thickness ratio ${thicknessRatio.toFixed(2)}× — same tooling set can run full range`,
      value: `${thicknessRatio.toFixed(2)}×`, threshold: "≤ 1.20×",
    });
  }

  if (numStations < 4) {
    results.push({
      id: "R005", category: "Station Count", rule: "Minimum Station Count",
      severity: "fail",
      message: `${numStations} stations is too few — minimum 4 required for any profile`,
      value: `${numStations}`, threshold: "≥ 4",
      recommendation: `Increase station count. For ${materialType}, recommended minimum is ${Math.max(6, Math.round(4 + mat.maxPassAngle * 0.3))} stations.`,
    });
  } else {
    results.push({
      id: "R005", category: "Station Count", rule: "Minimum Station Count",
      severity: "pass",
      message: `${numStations} stations — adequate for forming`,
      value: `${numStations}`, threshold: "≥ 4",
    });
  }

  const maxAnglePerPass = 90 / Math.max(numStations - 1, 1);
  if (maxAnglePerPass > mat.maxPassAngle) {
    results.push({
      id: "R006", category: "Pass Progression", rule: "Aggressive Pass Angle Warning",
      severity: "warning",
      message: `Average ${maxAnglePerPass.toFixed(1)}°/pass exceeds ${materialType} safe limit of ${mat.maxPassAngle}°/pass`,
      value: `${maxAnglePerPass.toFixed(1)}°/pass`, threshold: `≤ ${mat.maxPassAngle}°/pass`,
      recommendation: `Add ${Math.ceil((90 / mat.maxPassAngle) - numStations + 1)} more stations, or reduce total bend angle. Use soft progression (slow start).`,
    });
  } else {
    results.push({
      id: "R006", category: "Pass Progression", rule: "Pass Angle Progression",
      severity: "pass",
      message: `Average ${maxAnglePerPass.toFixed(1)}°/pass — within ${materialType} limit of ${mat.maxPassAngle}°/pass`,
      value: `${maxAnglePerPass.toFixed(1)}°/pass`, threshold: `≤ ${mat.maxPassAngle}°/pass`,
    });
  }

  const flangeRatio = 50 / thickness;
  if (flangeRatio > mat.flangeCollapseRatio * 1.5) {
    results.push({
      id: "R007", category: "Flange", rule: "Flange Collapse Risk",
      severity: "critical",
      message: `Flange height/thickness ratio (~${flangeRatio.toFixed(0)}:1) far exceeds safe limit (${mat.flangeCollapseRatio}:1)`,
      value: `${flangeRatio.toFixed(0)}:1`, threshold: `≤ ${mat.flangeCollapseRatio}:1`,
      recommendation: `Reduce flange height, increase thickness, or add intermediate support rolls. Consider edge stiffener or hemming.`,
    });
  } else if (flangeRatio > mat.flangeCollapseRatio) {
    results.push({
      id: "R007", category: "Flange", rule: "Flange Collapse Risk",
      severity: "warning",
      message: `Flange ratio (~${flangeRatio.toFixed(0)}:1) exceeds recommended limit (${mat.flangeCollapseRatio}:1) for ${materialType}`,
      value: `${flangeRatio.toFixed(0)}:1`, threshold: `≤ ${mat.flangeCollapseRatio}:1`,
      recommendation: `Monitor for buckling. Use side guide rolls. Consider edge stiffening feature.`,
    });
  } else {
    results.push({
      id: "R007", category: "Flange", rule: "Flange Collapse Risk",
      severity: "pass",
      message: `Flange ratio safe for ${materialType}`,
      value: `${flangeRatio.toFixed(0)}:1`, threshold: `≤ ${mat.flangeCollapseRatio}:1`,
    });
  }

  if (mat.springbackFactor >= 1.15) {
    results.push({
      id: "R008", category: "Springback", rule: "High Springback Compensation",
      severity: "warning",
      message: `${materialType} springback ${mat.springbackFactor}× — requires overbend compensation at every station`,
      value: `${mat.springbackFactor}×`, threshold: "< 1.15× preferred",
      recommendation: `Apply ${((mat.springbackFactor - 1) * 100).toFixed(0)}% overbend at each station. Use measured springback data from trial runs for final adjustment.`,
    });
  } else {
    results.push({
      id: "R008", category: "Springback", rule: "Springback Check",
      severity: "pass",
      message: `${materialType} springback ${mat.springbackFactor}× — manageable`,
      value: `${mat.springbackFactor}×`,
    });
  }

  if (thickness < 0.3) {
    results.push({
      id: "R009", category: "Thickness", rule: "Ultra-Thin Material Warning",
      severity: "critical",
      message: `${thickness}mm is extremely thin — high risk of wrinkling, oil-canning, and handling damage`,
      value: `${thickness} mm`, threshold: "≥ 0.4 mm recommended",
      recommendation: `Use precision rolls with very tight gaps. Consider vacuum handling. Reduce line speed. Add tension control.`,
    });
  } else if (thickness > 6.0) {
    results.push({
      id: "R009", category: "Thickness", rule: "Heavy Gauge Warning",
      severity: "warning",
      message: `${thickness}mm is heavy gauge — verify machine capacity (motor HP, shaft strength)`,
      value: `${thickness} mm`, threshold: "≤ 6.0 mm for standard machines",
      recommendation: `Check forming force requirement. Verify motor HP is sufficient. Use heavy-duty tooling material (D2 or equivalent).`,
    });
  }

  return results;
}

const SEVERITY_CONFIG: Record<Severity, { icon: React.ReactNode; bg: string; border: string; text: string; label: string }> = {
  pass:     { icon: <CheckCircle2 className="w-4 h-4" />, bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", label: "PASS" },
  info:     { icon: <Info className="w-4 h-4" />,         bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    label: "INFO" },
  warning:  { icon: <AlertTriangle className="w-4 h-4" />,bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   label: "WARNING" },
  critical: { icon: <XCircle className="w-4 h-4" />,      bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-400",     label: "CRITICAL" },
  fail:     { icon: <XCircle className="w-4 h-4" />,      bg: "bg-red-600/15",     border: "border-red-600/40",     text: "text-red-300",     label: "FAIL" },
};

function RuleCard({ result }: { result: RuleResult }) {
  const [open, setOpen] = useState(result.severity !== "pass");
  const cfg = SEVERITY_CONFIG[result.severity];

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors">
        <span className={cfg.text}>{cfg.icon}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />}
        <span className="flex-1 text-sm text-white font-medium">{result.rule}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>{cfg.label}</span>
        <span className="text-xs text-gray-500 font-mono">{result.id}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/5 space-y-2 pt-3">
          <p className="text-sm text-gray-300">{result.message}</p>
          {(result.value || result.threshold) && (
            <div className="flex gap-4 text-xs">
              {result.value && <span className="text-gray-400">Value: <span className="font-mono text-white">{result.value}</span></span>}
              {result.threshold && <span className="text-gray-400">Threshold: <span className="font-mono text-amber-300">{result.threshold}</span></span>}
            </div>
          )}
          {result.recommendation && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-gray-400">
              <span className="font-semibold text-gray-300">Recommendation: </span>{result.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DesignRuleEngine() {
  const { materialType, materialThickness, minThickness, maxThickness, bendRadius, stations, numStations } = useCncStore();

  const results = useMemo(() =>
    evaluateRules(materialType, materialThickness, minThickness, maxThickness, bendRadius, stations, numStations),
    [materialType, materialThickness, minThickness, maxThickness, bendRadius, stations, numStations]
  );

  const counts = useMemo(() => {
    const c = { pass: 0, info: 0, warning: 0, critical: 0, fail: 0 };
    results.forEach(r => c[r.severity]++);
    return c;
  }, [results]);

  const overallStatus: Severity = counts.fail > 0 ? "fail" : counts.critical > 0 ? "critical" : counts.warning > 0 ? "warning" : "pass";
  const overallCfg = SEVERITY_CONFIG[overallStatus];

  const [filterSev, setFilterSev] = useState<Severity | "all">("all");
  const filtered = filterSev === "all" ? results : results.filter(r => r.severity === filterSev);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1117] text-white p-4 gap-4">

      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${overallCfg.bg} border ${overallCfg.border} flex items-center justify-center`}>
          <ShieldCheck className={`w-5 h-5 ${overallCfg.text}`} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Design Rule Engine</h2>
          <p className="text-xs text-gray-400">Engineering safety validation — {results.length} rules checked</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">{materialType}</span>
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">T={materialThickness}mm</span>
          <span className="px-2 py-1 rounded-full bg-white/10 text-xs text-gray-300 font-mono">R={bendRadius}mm</span>
        </div>
      </div>

      <div className={`rounded-xl border ${overallCfg.border} ${overallCfg.bg} p-4 flex items-center gap-4`}>
        <div className={`text-3xl font-bold ${overallCfg.text}`}>{overallCfg.label}</div>
        <div className="flex-1">
          <div className="text-sm text-gray-300">
            {overallStatus === "pass" ? "All checks passed — design is engineering-safe" :
             overallStatus === "warning" ? "Design has warnings — review recommended before production" :
             overallStatus === "critical" ? "CRITICAL issues found — must resolve before production" :
             "FAIL — design cannot proceed to production"}
          </div>
          <div className="flex gap-4 mt-2 text-xs">
            {counts.pass > 0 && <span className="text-emerald-400">{counts.pass} passed</span>}
            {counts.warning > 0 && <span className="text-amber-400">{counts.warning} warnings</span>}
            {counts.critical > 0 && <span className="text-red-400">{counts.critical} critical</span>}
            {counts.fail > 0 && <span className="text-red-300">{counts.fail} failed</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "fail", "critical", "warning", "pass"] as const).map(sev => (
          <button
            key={sev}
            onClick={() => setFilterSev(sev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterSev === sev ? "bg-white/15 text-white" : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {sev === "all" ? `All (${results.length})` :
             `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${counts[sev]})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((r, i) => <RuleCard key={`${r.id}-${i}`} result={r} />)}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">Standards: </span>
        DIN 6935 (cold bending) · DIN EN 10162 (roll formed sections) · IS 2062 (structural steel) ·
        Rule database: {results.length} active rules · Material: {materialType} · Auto-evaluated on parameter change
      </div>
    </div>
  );
}
