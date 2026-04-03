import React, { useState, useEffect, useCallback, useRef } from "react";
import { useCncStore } from "../../store/useCncStore";
import { runAllLayers, saveReport, loadReport, type TestingReport, type LayerResult, type TestSeverity } from "../../lib/testing-engine";
import { ShieldCheck, Play, RotateCcw, CheckCircle2, AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, Download, Zap, Trophy } from "lucide-react";

const LAYER_ICONS = ["🔬", "📐", "🔗", "📏", "🧪", "📊", "📈", "🔄", "📋", "⚡", "🔩", "⚙", "💻", "🏭", "🎯", "🏗", "⚡", "✨", "📦", "🏆"];

const SEVERITY_STYLE: Record<TestSeverity, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  pass:     { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" /> },
  warning:  { bg: "bg-amber-500/10",   border: "border-amber-500/20",   text: "text-amber-400",   icon: <AlertTriangle className="w-3 h-3 text-amber-400" /> },
  fail:     { bg: "bg-red-500/10",     border: "border-red-500/20",     text: "text-red-400",     icon: <XCircle className="w-3 h-3 text-red-400" /> },
  critical: { bg: "bg-red-600/15",     border: "border-red-600/30",     text: "text-red-300",     icon: <XCircle className="w-3.5 h-3.5 text-red-300" /> },
};

const GRADE_COLORS: Record<string, string> = {
  "S+": "from-amber-400 to-yellow-300", S: "from-amber-500 to-orange-400", A: "from-emerald-400 to-green-300",
  B: "from-blue-400 to-cyan-300", C: "from-purple-400 to-violet-300", D: "from-zinc-400 to-zinc-300", F: "from-red-500 to-red-400",
};

function LayerCard({ layer, index, expanded, onToggle }: {
  layer: LayerResult; index: number; expanded: boolean; onToggle: () => void;
}) {
  const pct = layer.maxScore > 0 ? (layer.score / layer.maxScore) * 100 : 0;
  const passCount = layer.tests.filter(t => t.severity === "pass").length;
  const failCount = layer.tests.filter(t => t.severity === "fail" || t.severity === "critical").length;
  const warnCount = layer.tests.filter(t => t.severity === "warning").length;

  return (
    <div className={`rounded-xl border transition-all duration-300 ${
      pct === 100 ? "border-emerald-500/20 bg-emerald-500/[0.03]" :
      pct >= 70 ? "border-amber-500/20 bg-amber-500/[0.03]" :
      "border-red-500/20 bg-red-500/[0.03]"
    }`}>
      <button onClick={onToggle} className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left">
        <span className="text-lg">{LAYER_ICONS[index] || "🔍"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">L{String(index + 1).padStart(2, "0")}</span>
            <span className="text-xs font-semibold text-zinc-200 truncate">{layer.nameHi}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: pct === 100 ? "linear-gradient(90deg, #22c55e, #10b981)" :
                    pct >= 70 ? "linear-gradient(90deg, #f59e0b, #eab308)" :
                    "linear-gradient(90deg, #ef4444, #dc2626)"
                }} />
            </div>
            <span className={`text-[10px] font-bold ${pct === 100 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400"}`}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] shrink-0">
          {passCount > 0 && <span className="text-emerald-400">{passCount}✓</span>}
          {warnCount > 0 && <span className="text-amber-400">{warnCount}⚠</span>}
          {failCount > 0 && <span className="text-red-400">{failCount}✗</span>}
        </div>
        <span className="text-[9px] text-zinc-600 shrink-0">{layer.durationMs.toFixed(0)}ms</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1 border-t border-white/[0.05] pt-2">
          {layer.tests.map(test => {
            const style = SEVERITY_STYLE[test.severity];
            return (
              <div key={test.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border ${style.bg} ${style.border}`}>
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold ${style.text}`}>{test.name}</p>
                  <p className="text-[9px] text-zinc-400 leading-snug">{test.message}</p>
                  {test.expected && <p className="text-[8px] text-zinc-600 mt-0.5">Expected: {test.expected} | Actual: {test.actual}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TestingEngineView() {
  const store = useCncStore();
  const rawGeometry = store.geometry;
  const stations = store.stations;
  const materialType = store.materialType;
  const thickness = store.materialThickness;
  const rollTooling = store.rollTooling;
  const rawGcodeOutputs = store.gcodeOutputs;
  const profileType = store.openSectionType ?? "Custom";
  const geometry = rawGeometry ?? { segments: [], bendPoints: [], boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  const gcodeStrings = (rawGcodeOutputs ?? []).map((g) => typeof g === "string" ? g : (g as { gcode?: string })?.gcode ?? "");
  const [report, setReport] = useState<TestingReport | null>(() => loadReport());
  const [running, setRunning] = useState(false);
  const [currentLayer, setCurrentLayer] = useState(-1);
  const [expandedLayers, setExpandedLayers] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const toggleLayer = useCallback((idx: number) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const runTests = useCallback(() => {
    setRunning(true);
    setCurrentLayer(0);
    setExpandedLayers(new Set());
    setReport(null);

    const layers: LayerResult[] = [];
    let layerIdx = 0;

    const input = {
      geometry,
      stations,
      materialType,
      thickness,
      rollTooling: rollTooling ?? [],
      gcodeOutputs: gcodeStrings,
      profileType,
    };

    const runNext = () => {
      if (layerIdx >= 20) {
        const finalReport = runAllLayers(input);
        setReport(finalReport);
        saveReport(finalReport);
        setRunning(false);
        setCurrentLayer(-1);
        const failedIdxs = new Set(finalReport.layers.map((l, i) => l.tests.some(t => t.severity === "fail" || t.severity === "critical") ? i : -1).filter(i => i >= 0));
        setExpandedLayers(failedIdxs);
        return;
      }
      setCurrentLayer(layerIdx);
      layerIdx++;
      setTimeout(runNext, 80);
    };

    setTimeout(runNext, 200);
  }, [geometry, stations, materialType, thickness, rollTooling, gcodeStrings, profileType]);

  const exportReport = useCallback(() => {
    if (!report) return;
    const lines: string[] = [
      "═══════════════════════════════════════════════════════",
      "  SAI ROLOTECH SMART ENGINES — 20-LAYER TESTING REPORT",
      "═══════════════════════════════════════════════════════",
      "",
      `Date: ${new Date(report.timestamp).toLocaleString()}`,
      `Grade: ${report.grade}`,
      `Score: ${report.totalScore}/${report.maxPossibleScore} (${report.pct.toFixed(1)}%)`,
      `Bugs: ${report.bugCount} | Warnings: ${report.warningCount} | Pass: ${report.passCount}`,
      "",
    ];
    report.layers.forEach(l => {
      const pct = l.maxScore > 0 ? ((l.score / l.maxScore) * 100).toFixed(0) : "0";
      lines.push(`── Layer ${String(l.layerId).padStart(2, "0")}: ${l.nameHi} — ${pct}% (${l.score}/${l.maxScore}) ──`);
      l.tests.forEach(t => {
        const icon = t.severity === "pass" ? "✓" : t.severity === "warning" ? "⚠" : "✗";
        lines.push(`  ${icon} [${t.severity.toUpperCase()}] ${t.name}: ${t.message}`);
      });
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `testing-report-${report.grade}-${report.pct.toFixed(0)}pct.txt`;
    a.click();
  }, [report]);

  return (
    <div className="flex flex-col h-full bg-[#070710]">
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-3">
        <ShieldCheck className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">20-Layer Testing Engine</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Offline · Full Validation
        </span>
        <div className="flex-1" />

        {report && (
          <>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black bg-gradient-to-r ${GRADE_COLORS[report.grade] || GRADE_COLORS.F} text-black`}>
              {report.grade}
            </span>
            <span className="text-[10px] text-zinc-400">{report.pct.toFixed(1)}%</span>
            <button onClick={exportReport} className="p-1 rounded hover:bg-white/[0.06] text-zinc-500" title="Export Report">
              <Download className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <button
          onClick={runTests}
          disabled={running}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
            running ? "bg-amber-500/20 text-amber-400 cursor-wait" : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20"
          }`}
        >
          {running ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {running ? `Testing L${String(currentLayer + 1).padStart(2, "0")}...` : "RUN ALL 20 LAYERS"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {running && !report && (
            <div className="space-y-2">
              {Array.from({ length: 20 }, (_, i) => {
                const isDone = i < currentLayer;
                const isActive = i === currentLayer;
                return (
                  <div key={i} className={`rounded-xl border px-3 py-2.5 flex items-center gap-2.5 transition-all duration-300 ${
                    isDone ? "border-emerald-500/20 bg-emerald-500/[0.03]" :
                    isActive ? "border-amber-500/30 bg-amber-500/[0.05] animate-pulse" :
                    "border-white/[0.04] bg-white/[0.01] opacity-40"
                  }`}>
                    <span className="text-lg">{LAYER_ICONS[i]}</span>
                    <span className="text-[10px] font-bold text-zinc-500">L{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-xs text-zinc-300 flex-1">
                      {["Data Integrity", "Geometry Validation", "Profile Continuity", "Bend Point Accuracy",
                        "Material Compatibility", "Bend Angle Limits", "Station Progression", "Springback Compensation",
                        "Strip Width Accuracy", "Edge Strain", "Thinning Check", "Roll Tooling",
                        "G-Code Safety", "Machine Feasibility", "DIN/ISO Tolerances", "Profile-Type Rules",
                        "Forming Energy", "Surface Quality", "Production Readiness", "Final Certification"][i]}
                    </span>
                    {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {isActive && <Zap className="w-4 h-4 text-amber-400 animate-bounce" />}
                  </div>
                );
              })}
            </div>
          )}

          {report && (
            <>
              <div className={`rounded-2xl border p-4 flex items-center gap-4 mb-4 ${
                report.grade === "S+" || report.grade === "S" ? "border-amber-500/30 bg-gradient-to-r from-amber-500/[0.05] to-yellow-500/[0.05]" :
                report.grade === "A" ? "border-emerald-500/30 bg-emerald-500/[0.05]" :
                report.grade === "B" ? "border-blue-500/30 bg-blue-500/[0.05]" :
                "border-red-500/30 bg-red-500/[0.05]"
              }`}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black bg-gradient-to-br ${GRADE_COLORS[report.grade]} text-black shadow-lg`}>
                  {report.grade}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-extrabold text-white">{report.pct.toFixed(1)}% Score</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{report.totalScore}/{report.maxPossibleScore} points</div>
                  <div className="flex gap-3 mt-1.5 text-[10px]">
                    <span className="text-emerald-400">{report.passCount} passed</span>
                    <span className="text-amber-400">{report.warningCount} warnings</span>
                    <span className="text-red-400">{report.bugCount} bugs</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] text-zinc-600">{new Date(report.timestamp).toLocaleString()}</div>
                  <div className={`text-xs font-bold mt-1 ${
                    report.grade === "S+" || report.grade === "S" || report.grade === "A" ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {report.grade === "S+" || report.grade === "S" || report.grade === "A" ? "CERTIFIED ✓" : "NOT CERTIFIED ✗"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">All 20 Layers</span>
                <button onClick={() => {
                  if (showAll) setExpandedLayers(new Set());
                  else setExpandedLayers(new Set(Array.from({ length: 20 }, (_, i) => i)));
                  setShowAll(!showAll);
                }} className="text-[9px] text-amber-400 hover:text-amber-300">
                  {showAll ? "Collapse All" : "Expand All"}
                </button>
              </div>

              {report.layers.map((layer, i) => (
                <LayerCard key={i} layer={layer} index={i} expanded={expandedLayers.has(i)} onToggle={() => toggleLayer(i)} />
              ))}
            </>
          )}

          {!running && !report && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">20-Layer Testing Engine</h2>
                <p className="text-sm text-zinc-500 mt-2 max-w-md">
                  Duniya ka sabse comprehensive roll forming validation system.
                  Har profile, har material, har machine ke liye 20 alag levels pe check hota hai.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 max-w-lg">
                {["Data Integrity", "Geometry", "Continuity", "Bend Accuracy",
                  "Material", "Angle Limits", "Progression", "Springback",
                  "Strip Width", "Edge Strain", "Thinning", "Roll Tooling",
                  "G-Code", "Machine", "DIN/ISO", "Profile Rules",
                  "Energy", "Surface", "Production", "Certification"
                ].map((name, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <span className="text-sm">{LAYER_ICONS[i]}</span>
                    <span className="text-[8px] text-zinc-400 leading-tight">{name}</span>
                  </div>
                ))}
              </div>
              <button onClick={runTests} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-amber-400 font-bold transition-all">
                <Play className="w-4 h-4" />
                RUN ALL 20 LAYERS
              </button>
              <p className="text-[9px] text-zinc-600">Results localStorage me save hote hai — laptop band ho to bhi wahi se shuru</p>
            </div>
          )}
        </div>

        {report && (
          <div className="w-56 flex-shrink-0 border-l border-white/[0.07] bg-[#0c0c1a] p-3 space-y-3 overflow-y-auto">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Layer Summary</div>
            <div className="space-y-1">
              {report.layers.map((l, i) => {
                const pct = l.maxScore > 0 ? (l.score / l.maxScore) * 100 : 0;
                return (
                  <button key={i} onClick={() => toggleLayer(i)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-left transition-all ${
                      expandedLayers.has(i) ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}>
                    <span className="text-[10px]">{LAYER_ICONS[i]}</span>
                    <span className="text-[9px] text-zinc-500 w-5">L{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex-1 h-1 rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full" style={{
                        width: `${pct}%`,
                        background: pct === 100 ? "#22c55e" : pct >= 70 ? "#f59e0b" : "#ef4444"
                      }} />
                    </div>
                    <span className={`text-[8px] font-bold w-7 text-right ${pct === 100 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400"}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/[0.07] pt-3">
              <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Stats</div>
              <div className="space-y-1.5">
                <div className="bg-white/[0.03] rounded-lg p-2 flex justify-between">
                  <span className="text-[9px] text-zinc-500">Total Tests</span>
                  <span className="text-[10px] text-zinc-300 font-bold">{report.passCount + report.warningCount + report.bugCount}</span>
                </div>
                <div className="bg-emerald-500/[0.05] rounded-lg p-2 flex justify-between">
                  <span className="text-[9px] text-emerald-400">Passed</span>
                  <span className="text-[10px] text-emerald-400 font-bold">{report.passCount}</span>
                </div>
                <div className="bg-amber-500/[0.05] rounded-lg p-2 flex justify-between">
                  <span className="text-[9px] text-amber-400">Warnings</span>
                  <span className="text-[10px] text-amber-400 font-bold">{report.warningCount}</span>
                </div>
                <div className="bg-red-500/[0.05] rounded-lg p-2 flex justify-between">
                  <span className="text-[9px] text-red-400">Bugs / Fails</span>
                  <span className="text-[10px] text-red-400 font-bold">{report.bugCount}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-3">
              <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Profile Info</div>
              <div className="space-y-1 text-[9px]">
                <div className="flex justify-between"><span className="text-zinc-500">Material</span><span className="text-zinc-300">{materialType}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Thickness</span><span className="text-zinc-300">{thickness}mm</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Segments</span><span className="text-zinc-300">{(geometry.segments ?? []).length}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Bends</span><span className="text-zinc-300">{(geometry.bendPoints ?? []).length}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Stations</span><span className="text-zinc-300">{stations.length}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
