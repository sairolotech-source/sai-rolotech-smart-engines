import React, { useState } from "react";
import { useCncStore, MATERIAL_DATABASE } from "../../store/useCncStore";
import { saveJobPackage } from "../../lib/api";
import { Package, CheckCircle2, XCircle, AlertTriangle, Download, FolderTree, HardDrive } from "lucide-react";

interface QualityCheck {
  id: number;
  category: string;
  label: string;
  passed: boolean | null;
  severity: "critical" | "warning";
  detail: string;
}

function runQualityChecks(store: ReturnType<typeof useCncStore.getState>): QualityCheck[] {
  const {
    geometry, stations, rollTooling, gcodeOutputs, materialType,
    materialThickness, profileName, rollDiameter, shaftDiameter,
  } = store;

  const checks: QualityCheck[] = [
    {
      id: 1, category: "Profile",
      label: "Profile geometry loaded",
      passed: geometry !== null,
      severity: "critical",
      detail: geometry ? `${(geometry.segments ?? []).length} segments, ${(geometry.bendPoints ?? []).length} bend points` : "No profile loaded — upload DXF first",
    },
    {
      id: 2, category: "Profile",
      label: "Profile is symmetric (bow check)",
      passed: geometry !== null ? (() => {
        const safeSegs = geometry.segments ?? [];
        if (!safeSegs.length) return false;
        const xs = safeSegs.flatMap(s => [s.startX ?? 0, s.endX ?? 0]);
        const xMid = (Math.min(...xs) + Math.max(...xs)) / 2;
        const leftSegs = safeSegs.filter(s => ((s.startX ?? 0) + (s.endX ?? 0)) / 2 < xMid).length;
        const rightSegs = safeSegs.filter(s => ((s.startX ?? 0) + (s.endX ?? 0)) / 2 >= xMid).length;
        return Math.abs(leftSegs - rightSegs) <= 2;
      })() : null,
      severity: "warning",
      detail: "Profile segment distribution checked for left/right symmetry",
    },
    {
      id: 3, category: "Material",
      label: "Material grade selected",
      passed: ["GI", "CR", "HR", "SS", "AL", "MS"].includes(materialType),
      severity: "critical",
      detail: `Material: ${materialType} | Thickness: ${materialThickness} mm`,
    },
    {
      id: 4, category: "Material",
      label: "Strip thickness in valid range",
      passed: materialThickness > 0.3 && materialThickness < 6.0,
      severity: "critical",
      detail: materialThickness > 0 ? `${materialThickness} mm — ${materialThickness > 0.3 && materialThickness < 6.0 ? "within range (0.3–6.0 mm)" : "OUT OF RANGE"}` : "No thickness set",
    },
    {
      id: 5, category: "Flower",
      label: "Power pattern stations generated",
      passed: stations.length > 0,
      severity: "critical",
      detail: stations.length > 0 ? `${stations.length} stations generated` : "Generate power pattern first",
    },
    {
      id: 6, category: "Flower",
      label: "Minimum 3 forming stations",
      passed: stations.length >= 3,
      severity: "warning",
      detail: stations.length >= 3 ? `${stations.length} stations — sufficient` : `Only ${stations.length} stations — minimum 3 recommended for quality forming`,
    },
    {
      id: 7, category: "Flower",
      label: "Angle progression is continuous",
      passed: stations.length > 1 ? (() => {
        for (let i = 1; i < stations.length; i++) {
          const prev = Math.abs(stations[i - 1].totalAngle);
          const curr = Math.abs(stations[i].totalAngle);
          if (curr < prev - 0.01) return false;
        }
        return true;
      })() : stations.length === 1 ? true : null,
      severity: "critical",
      detail: "Checks that bend angles increase monotonically from entry to final station",
    },
    {
      id: 8, category: "Rolls",
      label: "Roll tooling generated",
      passed: rollTooling.length > 0,
      severity: "critical",
      detail: rollTooling.length > 0 ? `${rollTooling.length} stations × 2 rolls = ${rollTooling.length * 2} rolls total` : "Generate roll tooling first",
    },
    {
      id: 9, category: "Rolls",
      label: "Roll dimensions valid",
      passed: rollDiameter > 30 && shaftDiameter > 10 && shaftDiameter < rollDiameter,
      severity: "critical",
      detail: `OD: Ø${rollDiameter}mm, Bore: Ø${shaftDiameter}mm ${shaftDiameter < rollDiameter ? "✓" : "INVALID — bore > OD"}`,
    },
    {
      id: 10, category: "Rolls",
      label: "All stations have roll data",
      passed: rollTooling.length > 0 && rollTooling.every(rt => (rt.rollProfile?.rollDiameter ?? 0) > 0),
      severity: "critical",
      detail: rollTooling.length > 0 ? `${rollTooling.filter(rt => (rt.rollProfile?.rollDiameter ?? 0) > 0).length}/${rollTooling.length} stations valid` : "No roll data",
    },
    {
      id: 11, category: "G-Code",
      label: "G-code programs generated",
      passed: gcodeOutputs.length > 0,
      severity: "critical",
      detail: gcodeOutputs.length > 0 ? `${gcodeOutputs.length} programs, total ${gcodeOutputs.reduce((s, g) => s + g.lineCount, 0)} lines` : "Generate G-code first",
    },
    {
      id: 12, category: "G-Code",
      label: "All G-code programs have M30 end",
      passed: gcodeOutputs.length > 0 ? gcodeOutputs.every(go => go.gcode.includes("M30")) : null,
      severity: "critical",
      detail: gcodeOutputs.length > 0
        ? `${gcodeOutputs.filter(g => g.gcode.includes("M30")).length}/${gcodeOutputs.length} programs have M30`
        : "No G-code to check",
    },
    {
      id: 13, category: "G-Code",
      label: "All G-code programs have spindle start",
      passed: gcodeOutputs.length > 0 ? gcodeOutputs.every(go => /M0[34]/.test(go.gcode)) : null,
      severity: "critical",
      detail: gcodeOutputs.length > 0
        ? `${gcodeOutputs.filter(g => /M0[34]/.test(g.gcode)).length}/${gcodeOutputs.length} programs have M03/M04`
        : "No G-code to check",
    },
    {
      id: 14, category: "Safety",
      label: "Material-specific coolant check",
      passed: materialType !== "SS" ? true : gcodeOutputs.some(go => go.gcode.includes("M08") || go.gcode.includes("M07")),
      severity: materialType === "SS" ? "critical" : "warning",
      detail: materialType === "SS" ? "SS: Flood coolant (M08) is mandatory — dry cutting will destroy insert" : `${materialType}: coolant recommended but not critical`,
    },
    {
      id: 15, category: "Safety",
      label: "Profile name set for documentation",
      passed: Boolean(profileName && profileName.length > 0),
      severity: "warning",
      detail: profileName ? `Profile name: "${profileName}"` : "No profile name — add for job tracking",
    },
    {
      id: 16, category: "Data",
      label: "Station count matches roll count",
      passed: stations.length === rollTooling.length || rollTooling.length === 0,
      severity: "warning",
      detail: `Stations: ${stations.length} | Roll tooling entries: ${rollTooling.length}`,
    },
    {
      id: 17, category: "Data",
      label: "No zero-length segments in final station",
      passed: stations.length > 0 ? (() => {
        const last = stations[stations.length - 1];
        return !last.segmentLengths.some(l => l < 0.1);
      })() : null,
      severity: "critical",
      detail: stations.length > 0 ? `Final station segment lengths checked for degenerate geometry` : "No stations",
    },
    {
      id: 18, category: "Export",
      label: "All required data present for export",
      passed: geometry !== null && stations.length > 0 && rollTooling.length > 0 && gcodeOutputs.length > 0,
      severity: "critical",
      detail: [
        geometry ? "✓ DXF" : "✗ DXF",
        stations.length > 0 ? "✓ Flower" : "✗ Flower",
        rollTooling.length > 0 ? "✓ Rolls" : "✗ Rolls",
        gcodeOutputs.length > 0 ? "✓ G-Code" : "✗ G-Code",
      ].join(" | "),
    },
  ];

  return checks;
}

function generateBomText(store: ReturnType<typeof useCncStore.getState>): string {
  const { profileName, materialType, materialThickness, rollDiameter, shaftDiameter, rollTooling, gcodeOutputs } = store;
  const date = new Date().toISOString().split("T")[0];
  let bom = `MATERIAL & TOOLING BILL OF MATERIALS\n`;
  bom += `Job: ${profileName || "Roll Forming Job"} | Date: ${date}\n`;
  bom += `Material: ${materialType} | Thickness: ${materialThickness} mm\n\n`;
  bom += `ROLL TOOLING:\n`;
  rollTooling.forEach((rt) => {
    const rp = rt.rollProfile;
    if (!rp) return;
    bom += `  Station ${rt.stationNumber} (${rt.label}): Upper + Lower Roll\n`;
    bom += `    OD: Ø${rp.rollDiameter.toFixed(3)}mm | Bore: Ø${rp.shaftDiameter.toFixed(3)}mm | Width: ${rp.rollWidth.toFixed(3)}mm\n`;
  });
  bom += `\nCNC PROGRAMS:\n`;
  gcodeOutputs.forEach(go => {
    bom += `  ${go.label}: ${go.lineCount} lines, ${go.totalPathLength}mm toolpath\n`;
  });
  return bom;
}

function generateSetupSheetForExport(store: ReturnType<typeof useCncStore.getState>): string {
  const { profileName, materialType, materialThickness, numStations, rollDiameter, shaftDiameter } = store;
  return `SETUP SHEET — ${profileName || "Job"}\nMaterial: ${materialType} ${materialThickness}mm | Roll OD: Ø${rollDiameter}mm | Bore: Ø${shaftDiameter}mm | Stations: ${numStations}\nZ0=Front Face | X0=Spindle Center | G54 Work Offset\n`;
}

function generateCoverPageHTML(store: ReturnType<typeof useCncStore.getState>, checks: QualityCheck[]): string {
  const { profileName, materialType, materialThickness, numStations, rollDiameter, shaftDiameter, rollTooling, gcodeOutputs, stations, openSectionType } = store;
  const matProps = MATERIAL_DATABASE[materialType] || { name: materialType };
  const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const passedCount = checks.filter(c => c.passed === true).length;
  const totalChecks = checks.length;
  const scorePercent = totalChecks > 0 ? Math.round((passedCount / totalChecks) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Job Package — ${profileName || "Roll Forming"}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, sans-serif; background: #fff; color: #1a1a1a; }
.cover { min-height: 100vh; display: flex; flex-direction: column; }
.header-band { background: #1e40af; padding: 40px; }
.header-band .logo { font-size: 32px; font-weight: 900; color: #fff; letter-spacing: -1px; }
.header-band .logo span { color: #fbbf24; }
.header-band .subtitle { color: #93c5fd; font-size: 12px; margin-top: 4px; }
.red-line { height: 4px; background: #dc2626; }
.main { flex: 1; padding: 50px 40px; }
.job-title { font-size: 28px; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
.job-subtitle { font-size: 14px; color: #64748b; margin-bottom: 30px; }
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
.info-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
.info-box .label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
.info-box .value { font-size: 20px; font-weight: 700; color: #1e293b; margin-top: 4px; font-family: monospace; }
.toc { margin-top: 30px; }
.toc h3 { font-size: 14px; color: #1e40af; border-left: 3px solid #1e40af; padding-left: 10px; margin-bottom: 10px; text-transform: uppercase; }
.toc ul { list-style: none; padding-left: 14px; }
.toc li { padding: 6px 0; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
.toc li::before { content: "📁 "; }
.score-badge { display: inline-block; background: ${scorePercent >= 80 ? "#22c55e" : scorePercent >= 50 ? "#f59e0b" : "#ef4444"}; color: #fff; font-weight: 700; font-size: 14px; padding: 6px 16px; border-radius: 20px; margin-top: 20px; }
.footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; font-size: 10px; color: #94a3b8; }
.footer .conf { color: #ef4444; font-weight: 600; }
@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="cover">
<div class="header-band">
  <div class="logo">SAI Rolo<span>Tech</span> AI</div>
  <div class="subtitle">Roll Forming Intelligence Engine — Full Job Package</div>
</div>
<div class="red-line"></div>
<div class="main">
  <div class="job-title">${profileName || "Roll Forming Job Package"}</div>
  <div class="job-subtitle">Generated: ${date} at ${time} | Material: ${materialType} — ${matProps?.name || materialType} | Section: ${openSectionType}</div>
  <div class="info-grid">
    <div class="info-box"><div class="label">Material / Thickness</div><div class="value">${materialType} ${materialThickness}mm</div></div>
    <div class="info-box"><div class="label">Forming Stations</div><div class="value">${numStations}</div></div>
    <div class="info-box"><div class="label">Roll OD / Bore</div><div class="value">&Oslash;${rollDiameter} / &Oslash;${shaftDiameter}</div></div>
    <div class="info-box"><div class="label">Roll Pairs</div><div class="value">${rollTooling.length}</div></div>
    <div class="info-box"><div class="label">G-Code Programs</div><div class="value">${gcodeOutputs.length}</div></div>
    <div class="info-box"><div class="label">Quality Score</div><div class="value">${scorePercent}%</div></div>
  </div>
  <div class="toc">
    <h3>Package Contents — Organized Folder Structure</h3>
    <ul>
      <li>cover-page.html — This cover page</li>
      ${stations.length > 0 ? "<li>power-pattern/ — Power pattern stages (flower-stations.json, flower-progression.csv)</li>" : ""}
      ${rollTooling.length > 0 ? "<li>rolls/top/ — Top roll drawing/data files (one file per station)</li>" : ""}
      ${rollTooling.length > 0 ? "<li>rolls/bottom/ — Bottom roll drawing/data files (one file per station)</li>" : ""}
      ${gcodeOutputs.length > 0 ? "<li>cnc-code/ — CNC G-code files per roll station (top_stnN_roll.nc, bottom_stnN_roll.nc)</li>" : ""}
      <li>profile-geometry.json — Parsed DXF profile geometry</li>
      <li>materials-tooling-bom.txt — Material &amp; tooling bill of materials</li>
      <li>setup-sheet.txt — Machine operator setup sheet</li>
      ${checks.length > 0 ? "<li>quality-checklist.txt — AI pre-export validation results</li>" : ""}
      <li>README.txt — Package description &amp; folder tree</li>
    </ul>
  </div>
  <div class="score-badge">Quality: ${passedCount}/${totalChecks} checks passed (${scorePercent}%)</div>
</div>
<div class="footer">
  <span class="conf">CONFIDENTIAL</span> — This document is proprietary to the project owner. Generated by Sai Rolotech Smart Engines.
</div>
</div></body></html>`;
}

export function sanitizeJobFolderName(name: string): string {
  return (name || "roll-forming-job").trim().replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

export function buildFolderTree(profileName: string, numStations: number): string {
  const folder = sanitizeJobFolderName(profileName);
  const lines: string[] = [`${folder}/`];
  lines.push(`  power-pattern/`);
  lines.push(`    flower-stations.json`);
  lines.push(`    flower-progression.csv`);
  lines.push(`  rolls/`);
  lines.push(`    top/`);
  for (let i = 1; i <= numStations; i++) lines.push(`      top_stn${i}_roll.json`);
  lines.push(`    bottom/`);
  for (let i = 1; i <= numStations; i++) lines.push(`      bottom_stn${i}_roll.json`);
  lines.push(`  cnc-code/`);
  for (let i = 1; i <= numStations; i++) {
    lines.push(`    top_stn${i}_roll.nc`);
    lines.push(`    bottom_stn${i}_roll.nc`);
  }
  lines.push(`  profile-geometry.json`);
  lines.push(`  materials-tooling-bom.txt`);
  lines.push(`  setup-sheet.txt`);
  lines.push(`  quality-checklist.txt`);
  lines.push(`  cover-page.html`);
  lines.push(`  README.txt`);
  return lines.join("\n");
}

export function JobPackageExport() {
  const store = useCncStore();
  const { geometry, stations, rollTooling, gcodeOutputs } = store;
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingToDisk, setSavingToDisk] = useState(false);
  const [diskSaveResult, setDiskSaveResult] = useState<{ success: boolean; projectRoot?: string; fileCount?: number; error?: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [showFolderTree, setShowFolderTree] = useState(false);

  const hasMinimumData = geometry !== null && stations.length > 0;
  const numStations = Math.max(stations.length, rollTooling.length);

  const runChecks = () => {
    setRunning(true);
    setTimeout(() => {
      const result = runQualityChecks(store);
      setChecks(result);
      setShowChecklist(true);
      setAcknowledged(false);
      setRunning(false);
    }, 600);
  };

  const criticalFails = checks.filter(c => c.severity === "critical" && c.passed === false);
  const warnings = checks.filter(c => c.severity === "warning" && c.passed === false);
  const passed = checks.filter(c => c.passed === true);
  const allCriticalPass = criticalFails.length === 0;

  const buildZipStructure = async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    const profileName = store.profileName || "roll-forming-job";
    const bomText = generateBomText(store);
    const setupSheetText = generateSetupSheetForExport(store);
    const coverPageHtml = generateCoverPageHTML(store, checks);

    const qualityChecklistText = checks.length > 0
      ? `AI QUALITY CHECKLIST\n${"=".repeat(60)}\n\n` + checks.map(c =>
          `[${c.passed === true ? "PASS" : c.passed === false ? "FAIL" : "SKIP"}] [${c.severity.toUpperCase()}] ${c.label}\n  ${c.detail}`
        ).join("\n\n")
      : "";

    const folderTree = buildFolderTree(profileName, numStations);
    const folderName = sanitizeJobFolderName(profileName);

    const readmeText = `Sai Rolotech Smart Engines — Full Job Package\nGenerated: ${new Date().toISOString()}\nProfile: ${profileName}\nMaterial: ${store.materialType} ${store.materialThickness}mm\n\nFolder Structure:\n${folderTree}\n`;

    const rootFolder = zip.folder(folderName)!;
    const flowerFolder = rootFolder.folder("power-pattern");
    if (stations.length > 0) {
      flowerFolder?.file("flower-stations.json", JSON.stringify(stations, null, 2));
      const csvRows = ["station_number,label,total_angle_deg,flat_strip_width_mm,pass_zone"];
      for (const s of stations as Array<{
        stationNumber?: number; label?: string; totalAngle?: number;
        flatStripWidth?: number; passZone?: string;
      }>) {
        csvRows.push([
          s.stationNumber ?? "",
          `"${(s.label ?? "").replace(/"/g, '""')}"`,
          typeof s.totalAngle === "number" ? s.totalAngle.toFixed(4) : "",
          typeof s.flatStripWidth === "number" ? s.flatStripWidth.toFixed(4) : "",
          `"${(s.passZone ?? "").replace(/"/g, '""')}"`,
        ].join(","));
      }
      flowerFolder?.file("flower-progression.csv", csvRows.join("\n"));
    }

    const rollsTopFolder = rootFolder.folder("rolls/top");
    const rollsBottomFolder = rootFolder.folder("rolls/bottom");
    const cncFolder = rootFolder.folder("cnc-code");

    if (rollTooling.length > 0) {
      rollTooling.forEach((rt) => {
        const stn = rt.stationNumber;
        const rp = rt.rollProfile;
        if (!rp) return;
        rollsTopFolder?.file(
          `top_stn${stn}_roll.json`,
          JSON.stringify({ stationNumber: stn, label: rt.label, roll: rp.upperRoll, rollProfile: rp }, null, 2)
        );
        rollsBottomFolder?.file(
          `bottom_stn${stn}_roll.json`,
          JSON.stringify({ stationNumber: stn, label: rt.label, roll: rp.lowerRoll, rollProfile: rp }, null, 2)
        );
        if (rp.upperLatheGcode) {
          cncFolder?.file(`top_stn${stn}_roll.nc`, rp.upperLatheGcode);
        }
        if (rp.lowerLatheGcode) {
          cncFolder?.file(`bottom_stn${stn}_roll.nc`, rp.lowerLatheGcode);
        }
      });
    }

    const savedNcNames = new Set<string>();
    gcodeOutputs.forEach((go) => {
      const stationNum = go.stationNumber ?? 0;
      const label = (go.label || "").toLowerCase();
      let position: "top" | "bottom" = "top";
      if (label.includes("bottom") || label.includes("lower")) position = "bottom";

      let ncName: string;
      if (stationNum > 0) {
        ncName = `${position}_stn${stationNum}_roll.nc`;
      } else {
        ncName = (go.label || `program_${gcodeOutputs.indexOf(go) + 1}`).replace(/[^a-zA-Z0-9._-]/g, "_") + ".nc";
      }
      if (!savedNcNames.has(ncName)) {
        savedNcNames.add(ncName);
        cncFolder?.file(ncName, go.gcode);
      }
    });

    if (geometry) rootFolder.file("profile-geometry.json", JSON.stringify(geometry, null, 2));
    rootFolder.file("materials-tooling-bom.txt", bomText);
    rootFolder.file("setup-sheet.txt", setupSheetText);
    if (qualityChecklistText) rootFolder.file("quality-checklist.txt", qualityChecklistText);
    rootFolder.file("cover-page.html", coverPageHtml);
    rootFolder.file("README.txt", readmeText);

    return zip;
  };

  const exportPackage = async () => {
    setExporting(true);
    try {
      const zip = await buildZipStructure();
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const downloadName = `job-package-${store.profileName || "roll-forming"}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(url);

      const exportHistoryRaw = localStorage.getItem("sai-rolotech-smart-engines-export-history");
      const history = exportHistoryRaw ? JSON.parse(exportHistoryRaw) : [];
      history.unshift({
        id: `exp-${Date.now()}`,
        type: "Job Package ZIP",
        fileName: downloadName,
        timestamp: new Date().toISOString(),
        profileName: store.profileName || "Roll Forming Job",
      });
      localStorage.setItem("sai-rolotech-smart-engines-export-history", JSON.stringify(history.slice(0, 50)));
    } catch (err) {
      console.error("Export failed:", err);
    }
    setExporting(false);
  };

  const saveToDisk = async () => {
    setSavingToDisk(true);
    setDiskSaveResult(null);
    try {
      const bomText = generateBomText(store);
      const setupSheetText = generateSetupSheetForExport(store);
      const coverPageHtml = generateCoverPageHTML(store, checks);
      const qualityChecklistText = checks.length > 0
        ? `AI QUALITY CHECKLIST\n${"=".repeat(60)}\n\n` + checks.map(c =>
            `[${c.passed === true ? "PASS" : c.passed === false ? "FAIL" : "SKIP"}] [${c.severity.toUpperCase()}] ${c.label}\n  ${c.detail}`
          ).join("\n\n")
        : undefined;

      const result = await saveJobPackage({
        profileName: store.profileName || "roll-forming-job",
        geometry: store.geometry ?? undefined,
        stations: stations.length > 0 ? (stations as unknown[]) : undefined,
        rollTooling: rollTooling.length > 0 ? (rollTooling as unknown as import("../../lib/api").RollToolingPayload[]) : undefined,
        gcodeOutputs: gcodeOutputs.length > 0 ? gcodeOutputs : undefined,
        bomText,
        setupSheetText,
        qualityChecklistText,
        coverPageHtml,
      });
      setDiskSaveResult({ success: true, projectRoot: result.projectRoot, fileCount: result.fileCount });
    } catch (err) {
      setDiskSaveResult({ success: false, error: err instanceof Error ? err.message : "Save failed" });
    }
    setSavingToDisk(false);
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06]">
        <Package className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-widest">Full Job Package Export</span>
      </div>

      <div className="px-3 py-3 space-y-3">
        <p className="text-[10px] text-zinc-400">
          Exports everything in one ZIP with organized sub-folders: power-pattern/, rolls/top/, rolls/bottom/, cnc-code/ — each file named by station and position.
        </p>

        {hasMinimumData && (
          <button
            onClick={() => setShowFolderTree(v => !v)}
            className="w-full py-1.5 rounded text-[10px] font-semibold border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center justify-center gap-1.5"
          >
            <FolderTree className="w-3 h-3" />
            {showFolderTree ? "Hide" : "Preview"} Folder Structure
          </button>
        )}

        {showFolderTree && hasMinimumData && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 overflow-x-auto">
            <pre className="text-[9px] font-mono text-emerald-300 whitespace-pre leading-relaxed">
              {buildFolderTree(store.profileName || "roll-forming-job", numStations)}
            </pre>
          </div>
        )}

        {!showChecklist ? (
          <button
            onClick={runChecks}
            disabled={!hasMinimumData || running}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {running ? (
              <><span className="animate-spin">◐</span> Running 18 Quality Checks...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Run AI Quality Checklist</>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div className="text-center p-2 rounded bg-emerald-900/20 border border-emerald-500/20">
                <div className="text-emerald-400 font-bold text-lg font-mono">{passed.length}</div>
                <div className="text-zinc-400">Passed</div>
              </div>
              <div className="text-center p-2 rounded bg-amber-900/20 border border-amber-500/20">
                <div className="text-amber-400 font-bold text-lg font-mono">{warnings.length}</div>
                <div className="text-zinc-400">Warnings</div>
              </div>
              <div className="text-center p-2 rounded bg-red-900/20 border border-red-500/20">
                <div className="text-red-400 font-bold text-lg font-mono">{criticalFails.length}</div>
                <div className="text-zinc-400">Errors</div>
              </div>
            </div>

            {/* Check list */}
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {checks.map((check) => (
                <div key={check.id} className={`flex items-start gap-2 p-1.5 rounded text-[10px] border
                  ${check.passed === true ? "bg-emerald-950/10 border-emerald-900/30" :
                    check.passed === false && check.severity === "critical" ? "bg-red-950/20 border-red-500/20" :
                    check.passed === false ? "bg-amber-950/15 border-amber-500/20" :
                    "bg-zinc-900/30 border-zinc-700/30"}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {check.passed === true
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      : check.passed === false && check.severity === "critical"
                      ? <XCircle className="w-3 h-3 text-red-400" />
                      : check.passed === false
                      ? <AlertTriangle className="w-3 h-3 text-amber-400" />
                      : <div className="w-3 h-3 rounded-full bg-zinc-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-[9px] px-1 rounded ${check.severity === "critical" ? "bg-red-900/40 text-red-300" : "bg-amber-900/30 text-amber-300"}`}>
                        {check.id}. {check.category}
                      </span>
                      <span className={`font-semibold ${check.passed === true ? "text-zinc-200" : check.severity === "critical" ? "text-red-300" : "text-amber-300"}`}>
                        {check.label}
                      </span>
                    </div>
                    <div className="text-zinc-500 mt-0.5 truncate">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Acknowledgement for warnings */}
            {!allCriticalPass ? (
              <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/30 text-[10px] text-red-300">
                <XCircle className="w-3.5 h-3.5 inline mr-1.5" />
                <strong>{criticalFails.length} critical error(s) must be fixed before export.</strong>
                {" "}Fix the issues listed above and regenerate the relevant outputs.
              </div>
            ) : warnings.length > 0 && !acknowledged ? (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/20 text-[10px] text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
                  <strong>{warnings.length} warning(s) found.</strong> Review the issues above before proceeding.
                </div>
                <button
                  onClick={() => setAcknowledged(true)}
                  className="w-full py-1.5 rounded text-xs font-semibold bg-amber-700 hover:bg-amber-600 text-white transition-colors"
                >
                  I Acknowledge the Warnings — Proceed to Export
                </button>
              </div>
            ) : null}

            {(allCriticalPass && (acknowledged || warnings.length === 0)) && (
              <div className="space-y-2">
                <button
                  onClick={exportPackage}
                  disabled={exporting}
                  className="w-full py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {exporting ? "Packaging..." : "Download Full Job ZIP"}
                </button>

                <button
                  onClick={saveToDisk}
                  disabled={savingToDisk}
                  className="w-full py-2 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  {savingToDisk ? "Saving to Server..." : "Save to Server Disk (Organized Folders)"}
                </button>

                {diskSaveResult && (
                  <div className={`text-[10px] rounded p-2 border ${diskSaveResult.success ? "bg-emerald-950/30 border-emerald-700/40 text-emerald-300" : "bg-red-950/30 border-red-700/40 text-red-300"}`}>
                    {diskSaveResult.success
                      ? <>
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Saved {diskSaveResult.fileCount} files to:<br />
                          <span className="font-mono text-[9px] break-all">{diskSaveResult.projectRoot}</span>
                        </>
                      : <>
                          <XCircle className="w-3 h-3 inline mr-1" />
                          {diskSaveResult.error}
                        </>
                    }
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => { setShowChecklist(false); setChecks([]); setDiskSaveResult(null); }}
              className="w-full text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              ← Re-run Checks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
