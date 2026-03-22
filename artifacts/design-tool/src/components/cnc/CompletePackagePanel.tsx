import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import { useCncStore, type RollToolingResult, type MachineData, type BomResult } from "../../store/useCncStore";
import { splitGcode } from "../../lib/gcode-split";
import { downloadRollDxf, generateRollDxf } from "../../lib/roll-dxf";
import { BomView } from "./BomView";
import { generateRollTooling as apiGenerateRollTooling } from "../../lib/api";
import { autoDetectProfileType } from "../../store/useCncStore";

// ─── helpers ──────────────────────────────────────────────────────────────────

function downloadBlob(content: string | Blob, filename: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${ok ? "bg-green-950/60 text-green-400 border-green-800/60" : "bg-red-950/60 text-red-400 border-red-800/60"}`}>
      {ok ? "✓" : "⚠"}{label && ` ${label}`}
    </span>
  );
}

// ─── Phase badge ─────────────────────────────────────────────────────────────
function PhaseBadge({ phase }: { phase: "ENTRY" | "MAIN" | "FINAL" }) {
  const map = {
    ENTRY: "bg-blue-950/60 text-blue-400 border-blue-800/60",
    MAIN: "bg-orange-950/60 text-orange-400 border-orange-800/60",
    FINAL: "bg-green-950/60 text-green-400 border-green-800/60",
  };
  return (
    <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded border ${map[phase]}`}>
      {phase}
    </span>
  );
}

// ─── Tab: Rolls ───────────────────────────────────────────────────────────────
function RollsTab({ rollTooling }: { rollTooling: RollToolingResult[] }) {
  const [expandedSt, setExpandedSt] = useState<number | null>(1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1 pb-2 border-b border-white/[0.06]">
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
          {rollTooling.length} Stations · {rollTooling.length * 2} Rolls Total
        </span>
        <span className="text-[10px] text-zinc-600">Each machined separately on CNC Lathe</span>
      </div>

      {/* Compact summary table */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="border-b border-white/[0.05] bg-white/[0.015]">
              {["Stn", "Label", "Phase", "Roll Pair", "OD (mm)", "Bore (mm)", "Width (mm)", "Gap (mm)", "Clearance", "Expand"].map(h => (
                <th key={h} className="px-2.5 py-2 text-left text-[10px] text-zinc-600 font-semibold uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rollTooling.map((rt, idx) => {
              const rp = rt.rollProfile;
              const total = rollTooling.length;
              const pct = total === 1 ? 1 : idx / (total - 1);
              const phase: "ENTRY" | "MAIN" | "FINAL" = pct >= 0.80 ? "FINAL" : pct <= 0.35 ? "ENTRY" : "MAIN";
              const boreOk = rp.boreClearance?.isSafe ?? true;
              const isOpen = expandedSt === rt.stationNumber;

              return (
                <React.Fragment key={rt.stationNumber}>
                  <tr
                    className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors cursor-pointer ${isOpen ? "bg-white/[0.04]" : ""}`}
                    onClick={() => setExpandedSt(isOpen ? null : rt.stationNumber)}
                  >
                    <td className="px-2.5 py-1.5 text-zinc-400 font-bold">{rt.stationNumber}</td>
                    <td className="px-2.5 py-1.5 text-zinc-200">{rt.label}</td>
                    <td className="px-2.5 py-1.5"><PhaseBadge phase={phase} /></td>
                    <td className="px-2.5 py-1.5">
                      <span className="text-blue-400">R{rp.upperRollNumber}</span>
                      <span className="text-zinc-600 mx-1">+</span>
                      <span className="text-orange-400">R{rp.lowerRollNumber}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-zinc-300">{rp.rollDiameter.toFixed(3)}</td>
                    <td className="px-2.5 py-1.5 text-zinc-300">{rp.shaftDiameter.toFixed(3)}</td>
                    <td className="px-2.5 py-1.5 text-zinc-300">{rp.rollWidth.toFixed(3)}</td>
                    <td className="px-2.5 py-1.5 text-emerald-400 font-bold">{rp.gap.toFixed(3)}</td>
                    <td className="px-2.5 py-1.5"><StatusBadge ok={boreOk} label={boreOk ? "OK" : "WARN"} /></td>
                    <td className="px-2.5 py-1.5 text-zinc-600">{isOpen ? "▲" : "▼"}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={10} className="bg-white/[0.02] px-4 py-3 border-b border-white/[0.06]">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {/* Roll Geometry Detail */}
                          <div className="space-y-1.5">
                            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Upper Roll R{rp.upperRollNumber}</div>
                            {[
                              ["OD", `Ø${rp.rollDiameter.toFixed(3)} mm`],
                              ["Bore", `Ø${rp.shaftDiameter.toFixed(3)} mm`],
                              ["Width", `${rp.rollWidth.toFixed(3)} mm`],
                              ["Groove Depth", `${rp.grooveDepth.toFixed(3)} mm`],
                            ].map(([l, v]) => (
                              <div key={l} className="flex justify-between text-[10px] font-mono border-b border-white/[0.04] pb-0.5">
                                <span className="text-zinc-500">{l}</span>
                                <span className="text-blue-300">{v}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5">
                            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Lower Roll R{rp.lowerRollNumber}</div>
                            {[
                              ["OD", `Ø${rp.rollDiameter.toFixed(3)} mm`],
                              ["Bore", `Ø${rp.shaftDiameter.toFixed(3)} mm`],
                              ["Width", `${rp.rollWidth.toFixed(3)} mm`],
                              ["Gap", `${rp.gap.toFixed(3)} mm`],
                            ].map(([l, v]) => (
                              <div key={l} className="flex justify-between text-[10px] font-mono border-b border-white/[0.04] pb-0.5">
                                <span className="text-zinc-500">{l}</span>
                                <span className="text-orange-300">{v}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1.5">
                            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Forming Parameters</div>
                            {[
                              ["K-Factor", `${rp.kFactor}`],
                              ["Neutral Axis", `${rp.neutralAxisOffset.toFixed(3)} mm`],
                              ["Pass Line Y", `${rp.passLineY.toFixed(3)} mm`],
                              ["Phase", phase],
                            ].map(([l, v]) => (
                              <div key={l} className="flex justify-between text-[10px] font-mono border-b border-white/[0.04] pb-0.5">
                                <span className="text-zinc-500">{l}</span>
                                <span className="text-amber-300">{v}</span>
                              </div>
                            ))}
                          </div>
                          {/* Bore Clearance */}
                          <div className="space-y-1.5">
                            <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Bore Clearance Check</div>
                            {rp.boreClearance ? (
                              <>
                                {[
                                  ["Computed Gap", `${rp.boreClearance.computedGap.toFixed(3)} mm`],
                                  ["Min Allowed", `${rp.boreClearance.minimumAllowed.toFixed(3)} mm`],
                                  ["Status", rp.boreClearance.isSafe ? "✓ SAFE" : "⚠ DANGER"],
                                ].map(([l, v]) => (
                                  <div key={l} className="flex justify-between text-[10px] font-mono border-b border-white/[0.04] pb-0.5">
                                    <span className="text-zinc-500">{l}</span>
                                    <span className={rp.boreClearance?.isSafe ? "text-green-400" : "text-red-400"}>{v}</span>
                                  </div>
                                ))}
                                <div className="text-[9px] text-zinc-600 leading-tight mt-1">{rp.boreClearance.formula}</div>
                              </>
                            ) : (
                              <div className="text-[10px] text-zinc-600">No bore data</div>
                            )}
                          </div>
                        </div>
                        {/* Side Collar */}
                        {rp.sideCollar && (
                          <div className="mt-3 border border-purple-900/40 bg-purple-950/20 rounded-lg px-3 py-2">
                            <div className="text-[9px] text-purple-400 font-bold uppercase tracking-wider mb-1.5">Side Collar Recommendation</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
                              {[
                                ["Material", rp.sideCollar.material],
                                ["Dims OD/ID/W", `Ø${rp.sideCollar.OD}/Ø${rp.sideCollar.ID}/${rp.sideCollar.width}mm`],
                                ["Hardness", rp.sideCollar.hardness],
                                ["Qty/Station", `${rp.sideCollar.qty} pcs`],
                              ].map(([l, v]) => (
                                <div key={l}>
                                  <div className="text-zinc-600">{l}</div>
                                  <div className="text-purple-300">{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Behavior warnings */}
                        {rt.behavior?.warnings && rt.behavior.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {rt.behavior.warnings.map((w, i) => (
                              <div key={i} className="text-[10px] text-amber-400/90 bg-amber-950/30 border border-amber-800/40 rounded px-2.5 py-1">⚠ {w}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Machine Setup ───────────────────────────────────────────────────────
function MachineSetupTab({ machineData }: { machineData: MachineData }) {
  return (
    <div className="space-y-4">
      {/* Global parameters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Material", value: machineData.materialType, color: "text-blue-400" },
          { label: "Thickness", value: `${machineData.materialThickness} mm`, color: "text-zinc-200" },
          { label: "Springback", value: machineData.springbackCompensation, color: "text-amber-400" },
          { label: "Pass Line Y", value: `${machineData.passLine} mm`, color: "text-green-400" },
          { label: "Roll Diameter", value: `Ø${machineData.rollDiameter} mm`, color: "text-blue-300" },
          { label: "Shaft Diameter", value: `Ø${machineData.shaftDiameter} mm`, color: "text-orange-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
            <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Forming speeds by phase */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[11px] font-bold text-zinc-200">Forming Speed by Phase</span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
          {[
            { phase: "ENTRY", speed: machineData.formingSpeeds.entry, color: "text-blue-400" },
            { phase: "MAIN",  speed: machineData.formingSpeeds.main,  color: "text-orange-400" },
            { phase: "FINAL", speed: machineData.formingSpeeds.final, color: "text-green-400" },
          ].map(({ phase, speed, color }) => (
            <div key={phase} className="px-4 py-3 text-center">
              <div className={`text-[9px] font-bold uppercase tracking-wider ${color} mb-1`}>{phase}</div>
              <div className={`text-sm font-bold font-mono ${color}`}>{speed}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Lubrication + Surface Risk */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Lubrication</div>
          <div className="text-[11px] text-zinc-300 leading-relaxed">{machineData.lubrication}</div>
        </div>
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Surface Risk</div>
          <div className="text-[11px] text-zinc-300 leading-relaxed">{machineData.surfaceRisk}</div>
        </div>
      </div>

      {/* Insert + Coolant */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Insert Grade (CNC Lathe)</div>
          <div className="text-[11px] text-amber-300 font-mono font-semibold">{machineData.insertGrade}</div>
          {machineData.insertGeometry && (
            <div className="text-[10px] text-zinc-500 mt-1">{machineData.insertGeometry}</div>
          )}
        </div>
        <div className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02]">
          <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold mb-2">Coolant Mode</div>
          <div className={`text-[11px] font-mono font-semibold ${machineData.coolantMode === "M07" ? "text-orange-400" : "text-cyan-400"}`}>
            {machineData.coolantMode} — {machineData.coolantMode === "M08" ? "Flood Coolant" : "Mist Coolant"}
          </div>
        </div>
      </div>

      {/* CNC Lathe Cutting Parameters */}
      {machineData.cncCuttingParams && (
        <div className="border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
            <span className="text-[11px] font-bold text-zinc-200">CNC Lathe Cutting Parameters</span>
            <span className="text-[10px] text-zinc-600 ml-2">For machining roll profiles from tool steel</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            {[
              { label: "Roughing", vc: machineData.cncCuttingParams.vcRoughing, fr: machineData.cncCuttingParams.frRoughing, doc: machineData.cncCuttingParams.docRoughing, color: "text-orange-400" },
              { label: "Semi-Finish", vc: machineData.cncCuttingParams.vcFinishing * 0.85, fr: (machineData.cncCuttingParams.frRoughing + machineData.cncCuttingParams.frFinishing) / 2, doc: machineData.cncCuttingParams.docSemiFinish, color: "text-amber-400" },
              { label: "Finishing", vc: machineData.cncCuttingParams.vcFinishing, fr: machineData.cncCuttingParams.frFinishing, doc: machineData.cncCuttingParams.docFinish, color: "text-emerald-400" },
            ].map(({ label, vc, fr, doc, color }) => (
              <div key={label} className="px-4 py-3">
                <div className={`text-[9px] font-bold uppercase tracking-wider ${color} mb-2`}>{label}</div>
                {[
                  ["Vc (m/min)", `${Math.round(vc)} m/min`],
                  ["Feed (mm/rev)", `${fr.toFixed(2)} mm/rev`],
                  ["DOC (mm)", `${doc} mm`],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-[10px] font-mono border-b border-white/[0.04] py-0.5">
                    <span className="text-zinc-500">{l}</span>
                    <span className={color}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shaft Deflection Analysis */}
      {machineData.shaftDeflection && (
        <div className={`border rounded-xl p-4 ${machineData.shaftDeflection.isSafe ? "border-green-900/50 bg-green-950/20" : "border-red-900/50 bg-red-950/20"}`}>
          <div className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${machineData.shaftDeflection.isSafe ? "text-green-400" : "text-red-400"}`}>
            Shaft Deflection Analysis — {machineData.shaftDeflection.isSafe ? "✓ SAFE" : "⚠ EXCEEDS LIMIT"}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] font-mono">
            {[
              ["Estimated Deflection", `${machineData.shaftDeflection.estimatedMm} mm`],
              ["Limit", machineData.shaftDeflection.limit],
              ["Forming Force", `${machineData.shaftDeflection.formingForceN.toLocaleString()} N`],
              ["Shaft Span", `${machineData.shaftDeflection.shaftSpanMm} mm`],
              ["Model", "Simply-supported beam (δ = FL³/48EI)"],
              ["Status", machineData.shaftDeflection.isSafe ? "Within spec" : "Action required"],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-zinc-600 text-[9px] uppercase mb-0.5">{l}</div>
                <div className={machineData.shaftDeflection.isSafe ? "text-green-300" : "text-red-300"}>{v}</div>
              </div>
            ))}
          </div>
          <div className={`text-[10px] mt-2 leading-relaxed ${machineData.shaftDeflection.isSafe ? "text-green-500/80" : "text-red-400"}`}>
            {machineData.shaftDeflection.note}
          </div>
        </div>
      )}

      {/* Overall warnings */}
      {machineData.overallWarnings.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Critical Warnings</div>
          {machineData.overallWarnings.map((w, i) => (
            <div key={i} className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">⚠ {w}</div>
          ))}
        </div>
      )}

      {/* Per-station setup table */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[11px] font-bold text-zinc-200">Per-Station Machine Setup</span>
          <span className="text-[10px] text-zinc-600 ml-2">Roll gap, speed, CNC feeds, and clearance per station</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.015]">
                {["Stn", "Label", "Phase", "Forming Speed", "Roll Gap", "Clr", "OD", "Bore", "Width", "Vc (m/min)", "Feed (mm/r)", "DOC (mm)", "Bore Clr"].map(h => (
                  <th key={h} className="px-2.5 py-2 text-left text-[10px] text-zinc-600 font-semibold uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machineData.stationSetup.map((st, i) => (
                <tr key={st.stationNumber} className={`border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                  <td className="px-2.5 py-1.5 text-zinc-400 font-bold">{st.stationNumber}</td>
                  <td className="px-2.5 py-1.5 text-zinc-200">{st.label}</td>
                  <td className="px-2.5 py-1.5"><PhaseBadge phase={st.phase} /></td>
                  <td className="px-2.5 py-1.5 text-emerald-400">{st.formingSpeed}</td>
                  <td className="px-2.5 py-1.5 text-blue-300 font-bold">{st.rollGapNominal.toFixed(3)}</td>
                  <td className="px-2.5 py-1.5 text-amber-400">{st.clearanceRec.toFixed(3)}</td>
                  <td className="px-2.5 py-1.5 text-zinc-300">Ø{st.upperRollOD.toFixed(3)}</td>
                  <td className="px-2.5 py-1.5 text-zinc-300">Ø{st.bore.toFixed(3)}</td>
                  <td className="px-2.5 py-1.5 text-zinc-300">{st.width.toFixed(3)}</td>
                  <td className="px-2.5 py-1.5 text-cyan-400">{st.cncVcRec ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-cyan-300">{st.cncFeedRec?.toFixed(2) ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-cyan-300">{st.cncDocRec ?? "—"}</td>
                  <td className="px-2.5 py-1.5"><StatusBadge ok={st.boreClearanceOk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Collar summary */}
      {machineData.sideCollar && (
        <div className="border border-purple-900/50 rounded-xl p-4 bg-purple-950/20">
          <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-3">Side Collar Specification (All Stations)</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
            {[
              ["Material", machineData.sideCollar.material],
              ["OD / ID / Width", `Ø${machineData.sideCollar.OD} / Ø${machineData.sideCollar.ID} / ${machineData.sideCollar.width}mm`],
              ["Hardness", machineData.sideCollar.hardness],
              ["Qty/Station", `${machineData.sideCollar.qty * 2} pcs (${machineData.sideCollar.qty} per shaft × 2)`],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-zinc-600 text-[9px] uppercase mb-0.5">{l}</div>
                <div className="text-purple-300">{v}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{machineData.sideCollar.notes}</div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: BOM ─────────────────────────────────────────────────────────────────
function BomTab({ rollTooling }: { rollTooling: RollToolingResult[] }) {
  return <BomView rollTooling={rollTooling} />;
}

// ─── Tab: Export ─────────────────────────────────────────────────────────────
function ExportTab({ rollTooling, machineData, bomResult }: {
  rollTooling: RollToolingResult[];
  machineData: MachineData | null;
  bomResult: BomResult | null;
}) {
  const { materialType } = useCncStore();
  const [exporting, setExporting] = useState(false);

  const buildSetupSheet = (): string => {
    const DATE = new Date().toISOString().split("T")[0];
    const HR = "═".repeat(90);
    const hr = "─".repeat(90);
    const lines: string[] = [
      HR,
      "  SAI SAI_ROLOTECH_SMART_ENGINES — COMPLETE ROLL TOOLING SETUP SHEET",
      `  Generated: ${DATE}`,
      HR,
      "",
      "  GENERAL PARAMETERS",
      `  Material Type      : ${machineData?.materialType ?? "—"}`,
      `  Material Thickness : ${machineData?.materialThickness ?? "—"} mm`,
      `  Total Stations     : ${rollTooling.length}`,
      `  Total Rolls        : ${rollTooling.length * 2}`,
      `  Pass Line Y        : ${machineData?.passLine ?? "—"} mm`,
      `  Roll OD            : Ø${machineData?.rollDiameter ?? "—"} mm`,
      `  Shaft Diameter     : Ø${machineData?.shaftDiameter ?? "—"} mm`,
      `  Springback         : ${machineData?.springbackCompensation ?? "—"}`,
      `  Lubrication        : ${machineData?.lubrication ?? "—"}`,
      `  Insert Grade       : ${machineData?.insertGrade ?? "—"}`,
      `  Coolant            : ${machineData?.coolantMode ?? "—"}`,
      "",
      "  FORMING SPEEDS",
      `  Entry Phase : ${machineData?.formingSpeeds.entry ?? "—"}`,
      `  Main Phase  : ${machineData?.formingSpeeds.main ?? "—"}`,
      `  Final Phase : ${machineData?.formingSpeeds.final ?? "—"}`,
      "",
      "  SURFACE RISK",
      `  ${machineData?.surfaceRisk ?? "—"}`,
      "",
      hr,
      "  PER-STATION MACHINE SETUP",
      hr,
      `  ${"Stn".padEnd(5)} ${"Label".padEnd(10)} ${"Phase".padEnd(7)} ${"Speed".padEnd(15)} ${"Gap(mm)".padEnd(10)} ${"Clr(mm)".padEnd(10)} ${"OD(mm)".padEnd(12)} ${"Bore".padEnd(10)} ${"Width"}`,
      hr,
      ...(machineData?.stationSetup ?? []).map(st =>
        `  ${String(st.stationNumber).padEnd(5)} ${st.label.padEnd(10)} ${st.phase.padEnd(7)} ${st.formingSpeed.padEnd(15)} ${st.rollGapNominal.toFixed(3).padEnd(10)} ${st.clearanceRec.toFixed(3).padEnd(10)} Ø${st.upperRollOD.toFixed(3).padEnd(11)} Ø${st.bore.toFixed(3).padEnd(9)} ${st.width.toFixed(3)}`
      ),
      "",
      hr,
      "  ROLL SCHEDULE",
      hr,
      `  ${"Stn".padEnd(5)} ${"Label".padEnd(10)} ${"Upper Roll".padEnd(12)} ${"Lower Roll".padEnd(12)} ${"OD(mm)".padEnd(12)} ${"Width".padEnd(10)} ${"Gap"}`,
      hr,
      ...rollTooling.map(rt =>
        `  ${String(rt.stationNumber).padEnd(5)} ${rt.label.padEnd(10)} R${String(rt.rollProfile.upperRollNumber).padStart(3,"0").padEnd(11)} R${String(rt.rollProfile.lowerRollNumber).padStart(3,"0").padEnd(11)} Ø${rt.rollProfile.rollDiameter.toFixed(3).padEnd(11)} ${rt.rollProfile.rollWidth.toFixed(3).padEnd(10)} ${rt.rollProfile.gap.toFixed(3)} mm`
      ),
      "",
      ...(machineData?.overallWarnings.length ? [hr, "  CRITICAL WARNINGS", hr, ...machineData.overallWarnings.map(w => `  ⚠ ${w}`), ""] : []),
      HR,
      "  END OF SETUP SHEET — Sai Rolotech Smart Engines Engineering",
      HR,
    ];
    return lines.join("\n");
  };

  const buildBomText = (): string => {
    if (!bomResult) return "(BOM not available)";
    const hr = "─".repeat(130);
    const lines: string[] = [
      "═".repeat(130),
      "  SAI SAI_ROLOTECH_SMART_ENGINES — BILL OF MATERIALS (BOM)",
      `  Generated: ${new Date().toISOString().split("T")[0]}`,
      `  Total Rolls: ${bomResult.totalRolls}  |  Total Weight: ${bomResult.totalWeightKg.toFixed(1)} kg`,
      `  Roll Material: ${bomResult.rollMaterial}  |  Shaft Material: ${bomResult.shaftMaterial}`,
      "═".repeat(130),
      "",
      `${"#".padEnd(5)} ${"Description".padEnd(42)} ${"P/N".padEnd(20)} ${"Material".padEnd(18)} ${"Qty".padEnd(6)} ${"Dims".padEnd(28)} ${"Wt(kg)".padEnd(8)} Notes`,
      hr,
      ...bomResult.items.map(i =>
        `${String(i.itemNo).padEnd(5)} ${i.description.padEnd(42)} ${i.partNumber.padEnd(20)} ${i.material.padEnd(18)} ${String(i.qty).padEnd(6)} ${i.dimensions.padEnd(28)} ${String(i.weightKg).padEnd(8)} ${i.notes}`
      ),
      hr,
      `TOTAL WEIGHT: ${bomResult.totalWeightKg.toFixed(1)} kg`,
    ];
    return lines.join("\n");
  };

  const isPackageComplete = rollTooling.length > 0 && !!machineData && !!bomResult;

  const handleExportZip = async () => {
    if (!isPackageComplete) {
      alert("Package is incomplete — machine setup or BOM data is missing. Please regenerate the complete package before exporting.");
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      const DATE = new Date().toISOString().split("T")[0];

      // 1. Setup sheet
      zip.file("SETUP_SHEET.txt", buildSetupSheet());

      // 2. BOM
      zip.file("BOM.txt", buildBomText());

      // 3. G-Code files (one per roll)
      const gcodeFolder = zip.folder("GCODE");
      for (const rt of rollTooling) {
        const rp = rt.rollProfile;
        const upperName = `ROLL_${String(rp.upperRollNumber).padStart(3,"0")}_UPPER_${rt.label}.nc`;
        const lowerName = `ROLL_${String(rp.lowerRollNumber).padStart(3,"0")}_LOWER_${rt.label}.nc`;
        gcodeFolder?.file(upperName, rp.upperLatheGcode);
        gcodeFolder?.file(lowerName, rp.lowerLatheGcode);
      }

      // 4. Split G-code (RAW + FINAL)
      const splitFolder = zip.folder("GCODE_SPLIT");
      for (const rt of rollTooling) {
        const rp = rt.rollProfile;
        for (const [gcode, num, side] of [
          [rp.upperLatheGcode, rp.upperRollNumber, "UPPER"],
          [rp.lowerLatheGcode, rp.lowerRollNumber, "LOWER"],
        ] as [string, number, string][]) {
          const result = splitGcode(gcode, num);
          const prefix = `ROLL_${String(num).padStart(3,"0")}_${side}_${rt.label}`;
          splitFolder?.file(`${prefix}_RAW.nc`, result.rawProgram);
          splitFolder?.file(`${prefix}_FINAL.nc`, result.finalProgram);
        }
      }

      // 5. DXF drawings — attempt to get content; fall back to placeholder
      const dxfFolder = zip.folder("DXF");
      for (const rt of rollTooling) {
        const rp = rt.rollProfile;
        for (const [side, num] of [["upper", rp.upperRollNumber], ["lower", rp.lowerRollNumber]] as ["upper"|"lower", number][]) {
          const filename = `ROLL_${String(num).padStart(3,"0")}_${side.toUpperCase()}_${rt.label}.dxf`;
          try {
            const dxfContent = generateRollDxf({
              rollNumber: num, side, stationLabel: rt.label,
              rollDiameter: rp.rollDiameter, boreDiameter: rp.shaftDiameter,
              rollWidth: rp.rollWidth, grooveDepth: rp.grooveDepth,
              gap: rp.gap, materialType: machineData?.materialType ?? materialType,
            });
            dxfFolder?.file(filename, dxfContent);
          } catch {
            dxfFolder?.file(filename, `(DXF generation failed for Roll R${num})`);
          }
        }
      }

      // 6. Machine data JSON
      if (machineData) {
        zip.file("MACHINE_DATA.json", JSON.stringify(machineData, null, 2));
      }

      // 7. BOM JSON
      if (bomResult) {
        zip.file("BOM.json", JSON.stringify(bomResult, null, 2));
      }

      // 8. README
      zip.file("README.txt", [
        "SAI SAI_ROLOTECH_SMART_ENGINES — COMPLETE ROLL TOOLING PACKAGE",
        `Generated: ${DATE}`,
        "",
        "Contents:",
        "  SETUP_SHEET.txt      — Complete machine setup and forming parameters",
        "  BOM.txt              — Bill of Materials (all parts)",
        "  BOM.json             — BOM in JSON format",
        "  MACHINE_DATA.json    — Machine data in JSON format",
        "  GCODE/               — Full G-code programs for all rolls",
        "  GCODE_SPLIT/         — RAW + FINAL split programs for all rolls",
        "  DXF/                 — 2D drawings for all rolls",
        "",
        "Usage:",
        "  1. Load GCODE files on CNC Lathe controller",
        "  2. Use SETUP_SHEET.txt for machine setup reference",
        "  3. Import BOM.txt for procurement",
        "  4. Open DXF files in AutoCAD for drawing reference",
      ].join("\n"));

      // Generate and download
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `SAI_ROLOTECH_SMART_ENGINES_COMPLETE_PACKAGE_${DATE}.zip`);
    } catch (err) {
      console.error("ZIP export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const totalRolls = rollTooling.length * 2;
  const totalGcodeLines = rollTooling.reduce((sum, rt) => {
    return sum + rt.rollProfile.upperLatheGcode.split("\n").length + rt.rollProfile.lowerLatheGcode.split("\n").length;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Incomplete package warning */}
      {!isPackageComplete && (
        <div className="border border-amber-700/50 bg-amber-950/30 rounded-xl px-4 py-3 text-[11px] text-amber-300">
          ⚠ Package is incomplete — machine setup or BOM data is missing from older state. Please click <span className="font-bold">Generate Complete Package</span> to refresh all data before exporting.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Stations", value: String(rollTooling.length) },
          { label: "Rolls", value: String(totalRolls) },
          { label: "G-Code Lines", value: totalGcodeLines.toLocaleString() },
          { label: "BOM Items", value: String(bomResult?.items.length ?? 0) },
        ].map(({ label, value }) => (
          <div key={label} className="border border-white/[0.07] rounded-xl p-3 bg-white/[0.02] text-center">
            <div className="text-2xl font-bold font-mono text-zinc-100">{value}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Main ZIP export */}
      <div className="border border-emerald-900/50 bg-emerald-950/20 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center text-lg">⬇</div>
          <div>
            <div className="text-sm font-bold text-zinc-100">Download Complete Package (ZIP)</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">All G-code files, DXF drawings, setup sheets, and BOM in one ZIP</div>
          </div>
          <button
            onClick={handleExportZip}
            disabled={exporting || !isPackageComplete}
            className={`ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              exporting || !isPackageComplete
                ? "bg-zinc-700 text-zinc-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
            }`}
          >
            {exporting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Packaging...
              </>
            ) : (
              "⬇ Download ZIP"
            )}
          </button>
        </div>

        <div className="space-y-1.5">
          {[
            ["G-Code Files", `${totalRolls} .nc files — Full lathe programs for every roll`],
            ["Split Programs", `${totalRolls * 2} files — RAW (OP1+OP2) + FINAL (OP3) for each roll`],
            ["DXF Drawings", `${totalRolls} .dxf files — 2D cross-section drawings for all rolls`],
            ["Setup Sheet", "SETUP_SHEET.txt — Complete machine setup and forming parameters"],
            ["BOM", "BOM.txt + BOM.json — Bill of Materials for procurement"],
            ["Machine Data", "MACHINE_DATA.json — Forming parameters in machine-readable format"],
          ].map(([name, desc]) => (
            <div key={name} className="flex items-center gap-2 text-[11px]">
              <span className="text-emerald-500 flex-shrink-0">✓</span>
              <span className="text-zinc-300 font-semibold w-32 flex-shrink-0">{name}</span>
              <span className="text-zinc-500">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual downloads */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.05]">
          <span className="text-[11px] font-bold text-zinc-200">Individual Downloads</span>
        </div>
        <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            onClick={() => downloadBlob(buildSetupSheet(), `SETUP_SHEET_${new Date().toISOString().split("T")[0]}.txt`)}
            className="flex items-center gap-2 px-3 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-zinc-300 rounded-xl text-[11px] font-semibold transition-all"
          >
            ⬇ Setup Sheet (.txt)
          </button>
          <button
            onClick={() => downloadBlob(buildBomText(), `BOM_${new Date().toISOString().split("T")[0]}.txt`)}
            className="flex items-center gap-2 px-3 py-2.5 bg-violet-950/60 hover:bg-violet-900/60 border border-violet-700/40 text-violet-300 rounded-xl text-[11px] font-semibold transition-all"
          >
            ⬇ BOM Report (.txt)
          </button>
          <button
            onClick={() => bomResult && downloadBlob(JSON.stringify(bomResult, null, 2), `BOM_${new Date().toISOString().split("T")[0]}.json`)}
            className="flex items-center gap-2 px-3 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-zinc-300 rounded-xl text-[11px] font-semibold transition-all"
          >
            ⬇ BOM JSON
          </button>
          <button
            onClick={() => {
              rollTooling.forEach((rt, si) => {
                const rp = rt.rollProfile;
                setTimeout(() => downloadBlob(rp.upperLatheGcode, `ROLL_${String(rp.upperRollNumber).padStart(3,"0")}_UPPER_${rt.label}.nc`), si * 100);
                setTimeout(() => downloadBlob(rp.lowerLatheGcode, `ROLL_${String(rp.lowerRollNumber).padStart(3,"0")}_LOWER_${rt.label}.nc`), si * 100 + 50);
              });
            }}
            className="flex items-center gap-2 px-3 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 text-zinc-300 rounded-xl text-[11px] font-semibold transition-all"
          >
            ⬇ All G-Code (.nc)
          </button>
          <button
            onClick={() => {
              rollTooling.forEach((rt, si) => {
                const rp = rt.rollProfile;
                for (const [gcode, num, side] of [
                  [rp.upperLatheGcode, rp.upperRollNumber, "UPPER"],
                  [rp.lowerLatheGcode, rp.lowerRollNumber, "LOWER"],
                ] as [string, number, string][]) {
                  const result = splitGcode(gcode, num);
                  const prefix = `ROLL_${String(num).padStart(3,"0")}_${side}_${rt.label}`;
                  setTimeout(() => downloadBlob(result.rawProgram, `${prefix}_RAW.nc`), si * 200);
                  setTimeout(() => downloadBlob(result.finalProgram, `${prefix}_FINAL.nc`), si * 200 + 100);
                }
              });
            }}
            className="flex items-center gap-2 px-3 py-2.5 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/40 text-amber-300 rounded-xl text-[11px] font-semibold transition-all"
          >
            ⬇ All RAW+FINAL Split
          </button>
          <button
            onClick={() => {
              rollTooling.forEach((rt, si) => {
                const rp = rt.rollProfile;
                for (const [side, num] of [["upper", rp.upperRollNumber], ["lower", rp.lowerRollNumber]] as ["upper"|"lower", number][]) {
                  setTimeout(() => downloadRollDxf({ rollNumber: num, side, stationLabel: rt.label, rollDiameter: rp.rollDiameter, boreDiameter: rp.shaftDiameter, rollWidth: rp.rollWidth, grooveDepth: rp.grooveDepth, gap: rp.gap, materialType: machineData?.materialType ?? materialType }), si * 200 + (side === "lower" ? 100 : 0));
                }
              });
            }}
            className="flex items-center gap-2 px-3 py-2.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/40 text-cyan-300 rounded-xl text-[11px] font-semibold transition-all"
          >
            ⬇ All DXF Drawings
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Complete Package Panel ──────────────────────────────────────────────
type PackageTab = "rolls" | "machine" | "bom" | "export";

export function CompletePackagePanel({ autoGenerate = false }: { autoGenerate?: boolean }) {
  const {
    rollTooling, machineData, bomResult,
    geometry, numStations, stationPrefix, materialThickness,
    rollDiameter, shaftDiameter, clearance, materialType, openSectionType,
    postProcessorId,
    setRollTooling, setRollGaps, setStations, setMachineData, setBomResult,
  } = useCncStore();
  const [activeTab, setActiveTab] = useState<PackageTab>("rolls");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const runGeneration = useCallback(async () => {
    if (!geometry || geometry.segments.length === 0) {
      setGenError("No profile geometry loaded — upload a DXF profile first.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const resolvedSection = openSectionType === "Auto" ? autoDetectProfileType(geometry) : openSectionType;
      const result = await apiGenerateRollTooling(
        geometry, numStations, stationPrefix, materialThickness,
        rollDiameter, shaftDiameter, clearance, materialType,
        postProcessorId, resolvedSection
      );
      if (result.stations) setStations(result.stations);
      if (result.rollTooling) setRollTooling(result.rollTooling);
      if (result.rollGaps) setRollGaps(result.rollGaps);
      if (result.machineData) setMachineData(result.machineData);
      if (result.bom) setBomResult(result.bom);
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [geometry, numStations, stationPrefix, materialThickness, rollDiameter, shaftDiameter, clearance, materialType, openSectionType, setStations, setRollTooling, setRollGaps, setMachineData, setBomResult]);

  // Auto-generate on first open if data is missing
  useEffect(() => {
    if (autoGenerate && rollTooling.length === 0 && !generating) {
      runGeneration();
    }
  }, [autoGenerate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show empty/generate state if no tooling data yet
  if (rollTooling.length === 0) {
    return (
      <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-[#07070E] mt-4">
        <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-bold text-zinc-100">Complete Roll Tooling Package</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">Professional Report</span>
        </div>
        <div className="p-8 flex flex-col items-center gap-4 text-center">
          {generating ? (
            <>
              <svg className="w-8 h-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <div className="text-zinc-300 text-sm font-semibold">Running SAI Sai Rolotech Smart Engines Engine…</div>
              <div className="text-zinc-600 text-xs">Generating roll geometry, machine setup, and BOM</div>
            </>
          ) : (
            <>
              <div className="text-3xl">⚙</div>
              <div className="text-zinc-300 text-sm font-semibold">No Roll Tooling Generated Yet</div>
              {genError && <div className="text-red-400 text-[11px] bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 max-w-xs">{genError}</div>}
              <button
                onClick={runGeneration}
                className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-900/30"
              >
                ⚡ Generate Complete Package
              </button>
              <div className="text-zinc-600 text-xs max-w-xs">
                Runs the full SAI Sai Rolotech Smart Engines engine — roll geometry, CNC G-code, machine setup, BOM, and ZIP export
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const tabs: { id: PackageTab; label: string; icon: string; color: string }[] = [
    { id: "rolls",   label: "Rolls",         icon: "⚙",  color: "blue"    },
    { id: "machine", label: "Machine Setup",  icon: "⚡", color: "emerald" },
    { id: "bom",     label: "BOM",           icon: "📋", color: "violet"  },
    { id: "export",  label: "Export",         icon: "⬇",  color: "amber"   },
  ];

  const tabColors: Record<string, string> = {
    blue:    "bg-blue-600/90 text-white",
    emerald: "bg-emerald-600/90 text-white",
    violet:  "bg-violet-600/90 text-white",
    amber:   "bg-amber-600/90 text-white",
  };

  return (
    <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-[#07070E] mt-4">
      {/* Panel header */}
      <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-sm font-bold text-zinc-100">Complete Roll Tooling Package</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">Professional Report</span>
          <div className="ml-auto text-[10px] text-zinc-500">
            {rollTooling.length} stations · {rollTooling.length * 2} rolls · {bomResult?.totalWeightKg?.toFixed(1) ?? "—"} kg total
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.01]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              activeTab === t.id
                ? tabColors[t.color]
                : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200 border border-white/[0.05]"
            }`}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 overflow-y-auto max-h-[70vh]">
        {activeTab === "rolls" && <RollsTab rollTooling={rollTooling} />}
        {activeTab === "machine" && machineData && <MachineSetupTab machineData={machineData} />}
        {activeTab === "machine" && !machineData && (
          <div className="text-center text-zinc-500 py-12">
            <div className="text-2xl mb-2">⚡</div>
            <div>Machine data not available — regenerate roll tooling</div>
          </div>
        )}
        {activeTab === "bom" && <BomTab rollTooling={rollTooling} />}
        {activeTab === "export" && <ExportTab rollTooling={rollTooling} machineData={machineData} bomResult={bomResult} />}
      </div>
    </div>
  );
}
