import React, { useState } from "react";
import { useCncStore } from "../../store/useCncStore";
import { FileText, Printer, ChevronDown, ChevronRight } from "lucide-react";

function esc(str: string | number): string {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function generateSetupSheetHTML(store: ReturnType<typeof useCncStore.getState>): string {
  const {
    profileName, materialType, materialThickness, rollDiameter, shaftDiameter,
    numStations, stations, rollTooling, gcodeOutputs,
  } = store;

  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const rollRows = rollTooling.map((rt) => {
    const rp = rt.rollProfile;
    return `
      <tr>
        <td>${esc(rt.stationNumber)}</td>
        <td>${esc(rt.label)}</td>
        <td>&Oslash;${esc(rp.rollDiameter.toFixed(3))}</td>
        <td>&Oslash;${esc(rp.shaftDiameter.toFixed(3))}</td>
        <td>${esc(rp.rollWidth.toFixed(3))}</td>
        <td>${esc(rp.grooveDepth.toFixed(3))}</td>
        <td>${esc(rp.gap.toFixed(3))}</td>
        <td>Upper: G54Z${esc(rp.upperRollCenterY.toFixed(3))}<br/>Lower: G54Z${esc(rp.lowerRollCenterY.toFixed(3))}</td>
      </tr>`;
  }).join("");

  const gcodeRows = gcodeOutputs.map((go) => `
    <tr>
      <td>${esc(go.stationNumber)}</td>
      <td>${esc(go.label)}</td>
      <td>${esc(go.lineCount)}</td>
      <td>${esc(go.totalPathLength.toFixed(2))} mm</td>
      <td>${go.estimatedTime > 0 ? esc(go.estimatedTime.toFixed(2)) + " min" : "&mdash;"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Setup Sheet — ${esc(profileName || "Roll Forming Job")}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
  .logo { font-size: 22px; font-weight: 900; color: #1e40af; letter-spacing: -1px; }
  .logo span { color: #dc2626; }
  .job-title { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #1e40af; color: #fff; padding: 5px 8px; text-align: left; font-size: 10px; font-weight: 600; }
  td { border: 1px solid #e2e8f0; padding: 4px 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .section-title { font-size: 12px; font-weight: 700; color: #1e40af; border-left: 3px solid #1e40af; padding-left: 8px; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .info-card { border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; }
  .info-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 14px; font-weight: 700; color: #1e293b; font-family: monospace; }
  .warn { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 8px; margin-bottom: 10px; font-size: 10px; }
  .checklist { columns: 2; margin-bottom: 14px; }
  .checklist li { list-style: none; padding: 2px 0; }
  .checklist li::before { content: "☐ "; color: #6366f1; }
  .signature { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
  .sig-box { border-bottom: 1px solid #94a3b8; padding-bottom: 24px; font-size: 9px; color: #64748b; }
  .datum-box { background: #f0fdf4; border: 1px solid #22c55e; border-radius: 4px; padding: 10px; margin-bottom: 14px; }
  .red { color: #dc2626; font-weight: 600; }
  @media print { body { padding: 10px; } button { display: none !important; } }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">Rolo<span>Tech</span> AI</div>
    <div style="font-size:9px;color:#94a3b8;margin-top:2px;">SAI Roll Forming Intelligence Engine</div>
  </div>
  <div style="text-align:right">
    <div class="job-title">${esc(profileName || "Roll Forming Job")} — Setup Sheet</div>
    <div class="meta">Generated: ${esc(date)} at ${esc(time)}</div>
    <div class="meta">Material: ${esc(materialType)} | Thickness: ${esc(materialThickness)} mm | Stations: ${esc(numStations)}</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-card">
    <div class="info-label">Profile</div>
    <div class="info-value">${esc(profileName || "—")}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Material Grade</div>
    <div class="info-value">${materialType}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Thickness</div>
    <div class="info-value">${materialThickness} mm</div>
  </div>
  <div class="info-card">
    <div class="info-label">Roll Stations</div>
    <div class="info-value">${numStations}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Roll OD</div>
    <div class="info-value">Ø${rollDiameter} mm</div>
  </div>
  <div class="info-card">
    <div class="info-label">Shaft (Arbor) OD</div>
    <div class="info-value">Ø${shaftDiameter} mm</div>
  </div>
  <div class="info-card">
    <div class="info-label">Roll Pairs</div>
    <div class="info-value">${rollTooling.length} pairs</div>
  </div>
  <div class="info-card">
    <div class="info-label">G-Code Programs</div>
    <div class="info-value">${gcodeOutputs.length} files</div>
  </div>
</div>

<div class="datum-box">
  <strong>Work Coordinate System (Datum Reference)</strong><br/>
  <span style="font-family:monospace">X0 = Spindle Centerline (CNC Turning — Diameter Mode G7)</span><br/>
  <span style="font-family:monospace">Z0 = Front Face of Roll (Datum Face — touch-off point)</span><br/>
  <span style="font-family:monospace">Work Offset: G54 | Diameter Mode: ON | G92 S-limit per program</span>
</div>

${rollTooling.length > 0 ? `
<div class="section-title">Roll Tooling — Dimensions & Offsets</div>
<table>
  <thead>
    <tr>
      <th>Stn</th><th>Label</th><th>OD (Ø mm)</th><th>Bore ID (Ø mm)</th>
      <th>Width (mm)</th><th>Groove Depth</th><th>Roll Gap</th><th>Z-Offset Reference</th>
    </tr>
  </thead>
  <tbody>${rollRows}</tbody>
</table>` : ""}

${gcodeOutputs.length > 0 ? `
<div class="section-title">G-Code Program Summary</div>
<table>
  <thead>
    <tr><th>Stn</th><th>Program Label</th><th>Lines</th><th>Toolpath Length</th><th>Est. Time</th></tr>
  </thead>
  <tbody>${gcodeRows}</tbody>
</table>` : ""}

<div class="section-title">Pre-Run Safety Checklist</div>
<ul class="checklist">
  <li>Chuck jaws tightened — correct torque per chuck spec</li>
  <li>Tool offsets verified — all tools touched off on datum face</li>
  <li>Coolant nozzle aimed at cutting zone</li>
  <li>Emergency stop accessible and tested</li>
  <li>Single-block mode ON for first part</li>
  <li>Feed override at 25% for dry run</li>
  <li>Z0 datum confirmed — dial indicator on front face</li>
  <li>Stock OD and length measured and confirmed</li>
  <li>Bore diameter confirmed before finish turning</li>
  <li>G92 RPM limit set in program header</li>
  <li>TurnAxis CAM simulation approved — no collisions</li>
  <li>Pair matching: upper and lower OD within ±0.01 mm</li>
</ul>

${materialType === "SS" ? `<div class="warn"><strong>⚠ SS CRITICAL:</strong> Stainless Steel — FLOOD COOLANT MANDATORY. No dwell. No dry cutting. Work hardening will destroy insert if coolant interrupted.</div>` : ""}
${materialType === "HR" ? `<div class="warn"><strong>⚠ HR NOTE:</strong> Hot Rolled surface scale — reduce first roughing pass Vc by 20%. Use scale-breaking cut on first pass.</div>` : ""}

<div class="section-title">Dimensional Inspection Requirements</div>
<table>
  <thead>
    <tr><th>Dimension</th><th>Nominal</th><th>Tolerance</th><th>Method</th><th>Frequency</th></tr>
  </thead>
  <tbody>
    <tr><td>Roll OD</td><td>Ø${rollDiameter.toFixed(3)} mm</td><td>±0.010 mm</td><td>Micrometer / CMM</td><td>Each roll</td></tr>
    <tr><td>Bore (ID) H7</td><td>Ø${shaftDiameter.toFixed(3)} mm</td><td>+0.000/+0.025</td><td>Bore gauge</td><td>Each roll</td></tr>
    <tr><td>Face Width</td><td>Per drawing</td><td>±0.050 mm</td><td>Vernier / Micrometer</td><td>Each roll</td></tr>
    <tr><td>OD Runout (TIR)</td><td>0.000</td><td>≤ 0.015 mm</td><td>Dial indicator on mandrel</td><td>Each roll</td></tr>
    <tr><td>Surface Ra</td><td>0.8 μm</td><td>≤ 0.8 μm</td><td>Profilometer</td><td>First article + spot</td></tr>
    <tr><td>Pair OD match</td><td>Upper = Lower</td><td>±0.010 mm</td><td>Micrometer</td><td>Every pair</td></tr>
  </tbody>
</table>

<div class="signature">
  <div class="sig-box">Prepared by: ____________________<br/>Date: ___________</div>
  <div class="sig-box">Approved by: ____________________<br/>Date: ___________</div>
  <div class="sig-box">Operator: ______________________<br/>Date: ___________</div>
</div>

</body>
</html>`;
}

export function SetupSheetGenerator() {
  const store = useCncStore();
  const { rollTooling, gcodeOutputs } = store;
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState(false);

  const html = generateSetupSheetHTML(store);

  const openPrint = () => {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const downloadHtml = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `setup-sheet-${store.profileName || "job"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (rollTooling.length === 0 && gcodeOutputs.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <FileText className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Setup Sheet Generator</span>
        <span className="ml-auto">{expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">
          <p className="text-[10px] text-zinc-400">
            Generates a complete machine operator setup sheet with tool positions, offsets, datum points, clamping instructions, and QC dimensions.
          </p>

          <div className="flex gap-2">
            <button
              onClick={openPrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={downloadHtml}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
            >
              ⬇ Download HTML
            </button>
          </div>

          <button
            onClick={() => setPreview(!preview)}
            className="w-full text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {preview ? "▲ Hide Preview" : "▼ Preview Setup Sheet"}
          </button>

          {preview && (
            <div className="border border-zinc-700/50 rounded-lg overflow-hidden" style={{ height: 400 }}>
              <iframe
                srcDoc={html}
                className="w-full h-full"
                title="Setup Sheet Preview"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
