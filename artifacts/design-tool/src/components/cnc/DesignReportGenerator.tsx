import React, { useState } from "react";
import { useCncStore, MATERIAL_DATABASE } from "../../store/useCncStore";
import type { RollToolingResult } from "../../store/useCncStore";
import { buildShaftElevationSVGString } from "./AssemblyDrawingView";
import { generateBOM } from "./MachineBOMPanel";
import { FileText, Download, Loader2, Mail } from "lucide-react";

interface ReportSections {
  profileGeometry: boolean;
  flowerPattern: boolean;
  rollTooling: boolean;
  materialProperties: boolean;
  gcodePrograms: boolean;
  qualityScore: boolean;
  proAnalysis: boolean;
  validationPipeline: boolean;
  confirmedDimensions: boolean;
  machineBOM: boolean;
}

function captureCanvasFromContainer(captureId: string): string | null {
  try {
    const container = document.querySelector(`[data-capture-id="${captureId}"]`);
    if (!container) return null;
    const canvas = container.querySelector("canvas");
    if (canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0) {
      return canvas.toDataURL("image/png");
    }
    return null;
  } catch {
    return null;
  }
}

function svgStringToImage(svgString: string, width: number, height: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
        ctx.fillStyle = "#06060E";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

async function buildAssemblyDrawingImages(rollTooling: RollToolingResult[]): Promise<{ upper: string | null; lower: string | null }> {
  if (rollTooling.length === 0) return { upper: null, lower: null };
  const upperSvg = buildShaftElevationSVGString(rollTooling, "upper");
  const lowerSvg = buildShaftElevationSVGString(rollTooling, "lower");
  const svgW = Math.max(800, rollTooling.reduce((s, rt) => {
    const rp = rt.rollProfile;
    if (!rp) return s + 10;
    const spec = rt.mfgSpec;
    return s + rp.rollWidth + (spec ? spec.spacerThickness : 10);
  }, 0) * 1.2 + 200);
  const [upper, lower] = await Promise.all([
    svgStringToImage(upperSvg, svgW, 220),
    svgStringToImage(lowerSvg, svgW, 220),
  ]);
  return { upper, lower };
}

async function captureAllCanvasImages(rollTooling: RollToolingResult[]): Promise<{ profile: string | null; flower: string | null; assemblyUpper: string | null; assemblyLower: string | null }> {
  const assemblyImages = await buildAssemblyDrawingImages(rollTooling);
  return {
    profile: captureCanvasFromContainer("profile-canvas"),
    flower: captureCanvasFromContainer("power-pattern"),
    assemblyUpper: assemblyImages.upper,
    assemblyLower: assemblyImages.lower,
  };
}

function buildEmailSummary(store: ReturnType<typeof useCncStore.getState>): string {
  const { profileName, materialType, materialThickness, numStations, stations, rollTooling, gcodeOutputs, designScore } = store;
  let summary = `Sai Rolotech Smart Engines — Design Report Summary\n\n`;
  summary += `Profile: ${profileName || "Untitled"}\n`;
  summary += `Material: ${materialType} | Thickness: ${materialThickness}mm\n`;
  summary += `Stations: ${numStations} | Roll Sets: ${rollTooling.length}\n`;
  summary += `G-Code Programs: ${gcodeOutputs.length}\n`;
  if (designScore && designScore.overallScore >= 0) {
    summary += `Quality Score: ${designScore.overallScore}/100\n`;
  }
  if (stations.length > 0) {
    summary += `\nStation Summary:\n`;
    stations.forEach(st => {
      summary += `  Station ${st.stationNumber}: ${st.label} — ${st.totalAngle.toFixed(1)}°\n`;
    });
  }
  summary += `\nGenerated: ${new Date().toISOString().slice(0, 10)}\n`;
  summary += `Software: Sai Rolotech Smart Engines v3.0\n`;
  return summary;
}

export function DesignReportGenerator({ onClose }: { onClose: () => void }) {
  const store = useCncStore();
  const {
    profileName, materialType, materialThickness, rollDiameter, shaftDiameter,
    numStations, geometry, stations, rollTooling, gcodeOutputs, designScore,
    openSectionType, lineSpeed, fileName,
    sectionModel, validationResults, validationApproved, confirmedDimensions,
  } = store;

  const [sections, setSections] = useState<ReportSections>({
    profileGeometry: true,
    flowerPattern: true,
    rollTooling: true,
    materialProperties: true,
    gcodePrograms: true,
    qualityScore: true,
    proAnalysis: true,
    validationPipeline: true,
    confirmedDimensions: true,
    machineBOM: true,
  });
  const [engineerName, setEngineerName] = useState("");
  const [generating, setGenerating] = useState(false);

  const toggleSection = (key: keyof ReportSections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const matProps = MATERIAL_DATABASE[materialType] || {
    name: materialType, springbackFactor: 1.0, minBendRadiusMultiplier: 1.0,
    crackingRisk: "low" as const, yieldStrength: 0, tensileStrength: 0,
    maxFormingSpeed: "—", notes: "", minThickness: 0, maxThickness: 10,
  };
  const date = new Date();
  const dateStr = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const jspdfModule = await import("jspdf");
      const JsPDFConstructor = jspdfModule.jsPDF || jspdfModule.default;
      const doc = new JsPDFConstructor({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      let pageNum = 1;

      const addHeader = () => {
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, pageWidth, 28, "F");
        doc.setFillColor(220, 38, 38);
        doc.rect(0, 28, pageWidth, 1.5, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text("Sai Rolotech Smart Engines", margin, 12);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 200, 255);
        doc.text("Roll Forming Intelligence Engine — Design Report", margin, 18);

        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`${dateStr} at ${timeStr}`, pageWidth - margin, 12, { align: "right" });
        if (engineerName) {
          doc.text(`Engineer: ${engineerName}`, pageWidth - margin, 18, { align: "right" });
        }
        doc.text(`Profile: ${profileName || "Roll Forming Job"}`, pageWidth - margin, 24, { align: "right" });
      };

      const addFooter = () => {
        doc.setFillColor(240, 240, 245);
        doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 140);
        doc.setFont("helvetica", "normal");
        doc.text("Sai Rolotech Smart Engines — Confidential Design Report", margin, pageHeight - 5);
        doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 5, { align: "right" });
        doc.text(`Generated: ${date.toISOString()}`, pageWidth / 2, pageHeight - 5, { align: "center" });
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 20) {
          addFooter();
          doc.addPage();
          pageNum++;
          addHeader();
          y = 36;
        }
      };

      const sectionTitle = (title: string) => {
        ensureSpace(14);
        doc.setFillColor(30, 64, 175);
        doc.rect(margin, y, 3, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(title.toUpperCase(), margin + 6, y + 6);
        y += 12;
      };

      const keyValue = (label: string, value: string, col = 0) => {
        const xBase = margin + col * (contentWidth / 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 150);
        doc.text(label, xBase, y);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 50);
        doc.text(value, xBase + 45, y);
      };

      addHeader();
      y = 36;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(profileName || "Roll Forming Design Report", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Material: ${materialType} | Thickness: ${materialThickness}mm | Stations: ${numStations} | Section Type: ${openSectionType}`, margin, y);
      y += 10;

      const canvasImages = await captureAllCanvasImages(rollTooling);

      if (sections.profileGeometry && geometry) {
        sectionTitle("Profile Geometry Summary");

        keyValue("Source File", fileName || "—"); y += 5;
        keyValue("Segments", `${(geometry.segments ?? []).length}`); y += 5;
        keyValue("Bend Points", `${(geometry.bendPoints ?? []).length}`); y += 5;

        const bb = geometry.boundingBox;
        keyValue("Bounding Box", `${(bb.maxX - bb.minX).toFixed(2)} × ${(bb.maxY - bb.minY).toFixed(2)} mm`); y += 5;

        if ((geometry.bendPoints ?? []).length > 0) {
          y += 3;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(30, 64, 175);
          doc.text("Bend Points Detail:", margin, y);
          y += 5;

          ensureSpace((geometry.bendPoints ?? []).length * 5 + 8);
          doc.setFillColor(30, 64, 175);
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.rect(margin, y - 3, contentWidth, 5, "F");
          doc.text("Bend #", margin + 2, y);
          doc.text("X (mm)", margin + 25, y);
          doc.text("Y (mm)", margin + 50, y);
          doc.text("Angle (°)", margin + 75, y);
          doc.text("Radius (mm)", margin + 100, y);
          y += 5;

          doc.setTextColor(30, 30, 50);
          doc.setFont("helvetica", "normal");
          (geometry.bendPoints ?? []).forEach((bp, i) => {
            ensureSpace(5);
            if (i % 2 === 0) {
              doc.setFillColor(248, 250, 252);
              doc.rect(margin, y - 3, contentWidth, 5, "F");
            }
            doc.text(`${i + 1}`, margin + 2, y);
            doc.text(`${bp.x.toFixed(3)}`, margin + 25, y);
            doc.text(`${bp.y.toFixed(3)}`, margin + 50, y);
            doc.text(`${bp.angle.toFixed(1)}`, margin + 75, y);
            doc.text(`${bp.radius.toFixed(3)}`, margin + 100, y);
            y += 5;
          });
        }

        if (canvasImages.profile) {
          ensureSpace(65);
          y += 3;
          try {
            doc.addImage(canvasImages.profile, "PNG", margin, y, contentWidth, 55);
            y += 58;
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 150);
            doc.text("Profile Geometry Diagram (captured from canvas)", margin, y);
            y += 5;
          } catch {
            y += 2;
          }
        }
        y += 5;
      }

      if (sections.materialProperties) {
        sectionTitle("Material Properties");

        keyValue("Material Grade", `${materialType} — ${matProps.name}`); y += 5;
        keyValue("Thickness", `${materialThickness} mm`); y += 5;
        keyValue("Yield Strength", `${matProps.yieldStrength} MPa`); y += 5;
        keyValue("Tensile Strength", `${matProps.tensileStrength} MPa`); y += 5;
        keyValue("Springback Factor", `${matProps.springbackFactor}`); y += 5;
        keyValue("Min Bend Radius", `${matProps.minBendRadiusMultiplier}× thickness`); y += 5;
        keyValue("Cracking Risk", matProps.crackingRisk.toUpperCase()); y += 5;
        keyValue("Max Forming Speed", matProps.maxFormingSpeed); y += 5;
        keyValue("Line Speed (Set)", `${lineSpeed} m/min`); y += 5;

        if (matProps.notes) {
          ensureSpace(12);
          doc.setFillColor(254, 243, 199);
          doc.rect(margin, y, contentWidth, 10, "F");
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7);
          doc.setTextColor(120, 83, 9);
          const noteLines = doc.splitTextToSize(`Note: ${matProps.notes}`, contentWidth - 6);
          doc.text(noteLines, margin + 3, y + 4);
          y += Math.max(10, noteLines.length * 4 + 4);
        }
        y += 5;
      }

      if (sections.flowerPattern && stations.length > 0) {
        sectionTitle("Power Pattern — Station Breakdown");

        ensureSpace(stations.length * 5 + 10);
        doc.setFillColor(30, 64, 175);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.rect(margin, y - 3, contentWidth, 5, "F");
        doc.text("Station", margin + 2, y);
        doc.text("Label", margin + 22, y);
        doc.text("Total Angle", margin + 55, y);
        doc.text("Bends", margin + 85, y);
        doc.text("Pass Zone", margin + 105, y);
        doc.text("Increment", margin + 140, y);
        y += 5;

        doc.setTextColor(30, 30, 50);
        doc.setFont("helvetica", "normal");
        stations.forEach((st, i) => {
          ensureSpace(5);
          if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 3, contentWidth, 5, "F");
          }
          doc.text(`${st.stationNumber}`, margin + 2, y);
          doc.text(st.label, margin + 22, y);
          doc.text(`${st.totalAngle.toFixed(1)}°`, margin + 55, y);
          doc.text(`${st.bendAngles.length}`, margin + 85, y);
          doc.text(st.passZone || "—", margin + 105, y);
          doc.text(st.angleIncrementDeg !== undefined ? `+${st.angleIncrementDeg.toFixed(1)}°` : "—", margin + 140, y);
          y += 5;
        });

        if (canvasImages.flower) {
          ensureSpace(65);
          y += 3;
          try {
            doc.addImage(canvasImages.flower, "PNG", margin, y, contentWidth, 55);
            y += 58;
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 150);
            doc.text("Power Pattern Diagram — Station Forming Progression", margin, y);
            y += 5;
          } catch {
            y += 2;
          }
        }
        y += 5;
      }

      if (sections.rollTooling && rollTooling.length > 0) {
        sectionTitle("Roll Tooling Specifications");

        keyValue("Roll OD", `Ø${rollDiameter} mm`); y += 5;
        keyValue("Shaft (Arbor) OD", `Ø${shaftDiameter} mm`); y += 5;
        keyValue("Total Roll Pairs", `${rollTooling.length}`); y += 8;

        ensureSpace(rollTooling.length * 5 + 10);
        doc.setFillColor(30, 64, 175);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.rect(margin, y - 3, contentWidth, 5, "F");
        doc.text("Stn", margin + 2, y);
        doc.text("Label", margin + 14, y);
        doc.text("OD (mm)", margin + 45, y);
        doc.text("Bore (mm)", margin + 70, y);
        doc.text("Width (mm)", margin + 95, y);
        doc.text("Groove", margin + 120, y);
        doc.text("Gap (mm)", margin + 145, y);
        y += 5;

        doc.setTextColor(30, 30, 50);
        doc.setFont("helvetica", "normal");
        rollTooling.forEach((rt, i) => {
          ensureSpace(5);
          const rp = rt.rollProfile;
          if (!rp) { y += 5; return; }
          if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 3, contentWidth, 5, "F");
          }
          doc.text(`${rt.stationNumber}`, margin + 2, y);
          doc.text(rt.label, margin + 14, y);
          doc.text(`Ø${rp.rollDiameter.toFixed(3)}`, margin + 45, y);
          doc.text(`Ø${rp.shaftDiameter.toFixed(3)}`, margin + 70, y);
          doc.text(`${rp.rollWidth.toFixed(3)}`, margin + 95, y);
          doc.text(`${rp.grooveDepth.toFixed(3)}`, margin + 120, y);
          doc.text(`${rp.gap.toFixed(3)}`, margin + 145, y);
          y += 5;
        });

        if (canvasImages.assemblyUpper) {
          ensureSpace(58);
          y += 3;
          try {
            doc.addImage(canvasImages.assemblyUpper, "PNG", margin, y, contentWidth, 48);
            y += 51;
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 150);
            doc.text("Upper Shaft Assembly — Elevation View", margin, y);
            y += 5;
          } catch {
            y += 2;
          }
        }
        if (canvasImages.assemblyLower) {
          ensureSpace(58);
          y += 3;
          try {
            doc.addImage(canvasImages.assemblyLower, "PNG", margin, y, contentWidth, 48);
            y += 51;
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 150);
            doc.text("Lower Shaft Assembly — Elevation View", margin, y);
            y += 5;
          } catch {
            y += 2;
          }
        }
        y += 5;
      }

      if (sections.gcodePrograms && gcodeOutputs.length > 0) {
        sectionTitle("G-Code Program Summary");

        const totalLines = gcodeOutputs.reduce((s, g) => s + g.lineCount, 0);
        const totalPath = gcodeOutputs.reduce((s, g) => s + g.totalPathLength, 0);
        keyValue("Total Programs", `${gcodeOutputs.length}`); y += 5;
        keyValue("Total Lines", `${totalLines}`); y += 5;
        keyValue("Total Toolpath", `${totalPath.toFixed(2)} mm`); y += 8;

        ensureSpace(gcodeOutputs.length * 5 + 10);
        doc.setFillColor(30, 64, 175);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.rect(margin, y - 3, contentWidth, 5, "F");
        doc.text("Stn", margin + 2, y);
        doc.text("Program", margin + 14, y);
        doc.text("Lines", margin + 60, y);
        doc.text("Toolpath (mm)", margin + 85, y);
        doc.text("Est. Time", margin + 120, y);
        doc.text("Moves", margin + 150, y);
        y += 5;

        doc.setTextColor(30, 30, 50);
        doc.setFont("helvetica", "normal");
        gcodeOutputs.forEach((go, i) => {
          ensureSpace(5);
          if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y - 3, contentWidth, 5, "F");
          }
          doc.text(`${go.stationNumber}`, margin + 2, y);
          doc.text(go.label, margin + 14, y);
          doc.text(`${go.lineCount}`, margin + 60, y);
          doc.text(`${go.totalPathLength.toFixed(2)}`, margin + 85, y);
          doc.text(go.estimatedTime > 0 ? `${go.estimatedTime.toFixed(2)} min` : "—", margin + 120, y);
          doc.text(`${go.toolMoves}`, margin + 150, y);
          y += 5;
        });
        y += 5;
      }

      if (sections.qualityScore && designScore && designScore.overallScore >= 0) {
        sectionTitle("AI Design Quality Score");

        const score = designScore.overallScore;
        const grade = designScore.grade;
        const gradeColor: Record<string, [number, number, number]> = {
          A: [34, 197, 94], B: [59, 130, 246], C: [245, 158, 11], D: [239, 68, 68], F: [220, 38, 38],
        };
        const [r, g, b] = gradeColor[grade] || [100, 100, 100];

        ensureSpace(20);
        doc.setFillColor(r, g, b);
        doc.roundedRect(margin, y, 30, 14, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text(grade, margin + 6, y + 10);
        doc.setFontSize(10);
        doc.text(`${score}%`, margin + 16, y + 10);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 50);
        doc.text("Overall Design Quality Score", margin + 35, y + 7);
        y += 18;

        if (designScore.subScores.length > 0) {
          designScore.subScores.forEach(sub => {
            ensureSpace(8);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 120);
            doc.text(`${sub.dimension}:`, margin + 4, y);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 30, 50);
            doc.text(`${sub.score}%`, margin + 60, y);
            if (sub.value) {
              doc.setFont("helvetica", "normal");
              doc.setTextColor(100, 100, 120);
              doc.text(`${sub.value}`, margin + 80, y);
            }
            y += 5;
          });
        }

        if (designScore.warnings.length > 0) {
          y += 3;
          ensureSpace(designScore.warnings.length * 5 + 5);
          doc.setFillColor(254, 243, 199);
          const warnHeight = designScore.warnings.length * 5 + 4;
          doc.rect(margin, y - 2, contentWidth, warnHeight, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(161, 98, 7);
          doc.text("WARNINGS:", margin + 3, y + 2);
          y += 5;
          doc.setFont("helvetica", "normal");
          designScore.warnings.forEach(w => {
            doc.text(`• ${w}`, margin + 5, y + 2);
            y += 4;
          });
          y += 3;
        }
        y += 5;
      }

      if (sections.proAnalysis && stations.length > 0) {
        sectionTitle("Professional-Grade Forming Analysis");

        const safeT = Math.max(materialThickness, 0.1);
        const matYield = matProps.yieldStrength || 280;
        const matE = matYield > 500 ? 193000 : matYield < 150 ? 69000 : 200000;

        const allXCoords = geometry ? geometry.segments.flatMap(s => [s.startX, s.endX]) : [];
        const profWidth = allXCoords.length > 1 ? Math.max(...allXCoords) - Math.min(...allXCoords) : 100;

        let peakStress = 0;
        let maxThinning = 0;
        let totalEnergy = 0;

        stations.forEach((st, idx) => {
          const fp = (idx + 1) / stations.length;
          const maxAngle = Math.max(...(st.bendAngles.length ? st.bendAngles : [0]));
          const bRad = Math.max(safeT * 2, 1);
          const strain = (safeT / (2 * bRad + safeT)) * (maxAngle * Math.PI / 180) * fp;
          const stress = Math.min((strain * matE) / matYield, 1.5);
          if (stress > peakStress) peakStress = stress;
          const thinPct = 0.05 * fp * (maxAngle / 90);
          if (thinPct > maxThinning) maxThinning = thinPct;
          totalEnergy += matYield * strain * strain * safeT * Math.PI / 4 * 0.001;
        });

        const peakForce = matYield * safeT * profWidth * 0.001;

        keyValue("Peak Stress / σ_y", `${(peakStress * 100).toFixed(1)}%`); y += 5;
        keyValue("Max Thinning", `${(maxThinning * 100).toFixed(1)}%`); y += 5;
        keyValue("Total Forming Energy", `${totalEnergy.toFixed(4)} kJ/m`); y += 5;
        keyValue("Estimated Forming Force", `${peakForce.toFixed(1)} kN`); y += 5;
        keyValue("Profile Width", `${profWidth.toFixed(1)} mm`); y += 5;

        const verdict = peakStress > 1.0 ? "YIELD EXCEEDED — Risk of cracking" : peakStress > 0.7 ? "HIGH STRESS — Monitor for springback" : "SAFE — Within forming limits";
        const verdictColor: [number, number, number] = peakStress > 1.0 ? [220, 38, 38] : peakStress > 0.7 ? [245, 158, 11] : [34, 197, 94];

        ensureSpace(14);
        doc.setFillColor(...verdictColor);
        doc.roundedRect(margin, y, contentWidth, 10, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(255, 255, 255);
        doc.text(`Forming Verdict: ${verdict}`, margin + 5, y + 7);
        y += 14;

        if (geometry && (geometry.bendPoints ?? []).length > 0) {
          y += 3;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(30, 64, 175);
          doc.text("Springback & Thinning per Station:", margin, y);
          y += 5;

          ensureSpace(Math.min(stations.length, 20) * 5 + 8);
          doc.setFillColor(30, 64, 175);
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.rect(margin, y - 3, contentWidth, 5, "F");
          doc.text("Station", margin + 2, y);
          doc.text("Max Angle", margin + 25, y);
          doc.text("Stress %σ_y", margin + 55, y);
          doc.text("Thinning", margin + 85, y);
          doc.text("Energy (kJ/m)", margin + 115, y);
          doc.text("Verdict", margin + 150, y);
          y += 5;

          doc.setTextColor(30, 30, 50);
          doc.setFont("helvetica", "normal");
          stations.slice(0, 20).forEach((st, i) => {
            ensureSpace(5);
            const fp = (i + 1) / stations.length;
            const maxAngle = Math.max(...(st.bendAngles.length ? st.bendAngles : [0]));
            const bRad = Math.max(safeT * 2, 1);
            const strain = (safeT / (2 * bRad + safeT)) * (maxAngle * Math.PI / 180) * fp;
            const stress = Math.min((strain * matE) / matYield, 1.5);
            const thinPct = 0.05 * fp * (maxAngle / 90) * 100;
            const stEnergy = matYield * strain * strain * safeT * Math.PI / 4 * 0.001;

            if (i % 2 === 0) {
              doc.setFillColor(248, 250, 252);
              doc.rect(margin, y - 3, contentWidth, 5, "F");
            }
            doc.text(`${st.stationNumber}`, margin + 2, y);
            doc.text(`${maxAngle.toFixed(1)}°`, margin + 25, y);
            doc.text(`${(stress * 100).toFixed(1)}%`, margin + 55, y);
            doc.text(`${thinPct.toFixed(1)}%`, margin + 85, y);
            doc.text(`${stEnergy.toFixed(5)}`, margin + 115, y);
            doc.text(stress > 1 ? "FAIL" : stress > 0.7 ? "WARN" : "OK", margin + 150, y);
            y += 5;
          });
        }
        y += 5;
      }

      // === SECTION MODEL ===
      ensureSpace(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(99, 102, 241);
      doc.text(`AI Section Model: ${sectionModel === "open" ? "Open Section AI (Model A) — C/Z/U profiles, springback & flare monitoring" : sectionModel === "closed" ? "Closed Section AI (Model B) — Tube/round/hollow, weld seam & ovality control" : "Not Selected"}`, margin, y);
      y += 7;

      // === VALIDATION PIPELINE ===
      if (sections.validationPipeline && validationResults.length > 0) {
        sectionTitle("5-Layer Validation Pipeline Results");

        const LAYER_NAMES: Record<number, string> = {
          1: "Geometry & Profile Check",
          2: "Flower Pattern & Bend Progression",
          3: "Roll Tooling Clearance & Stress",
          4: "G-code Safety & Toolpath Verification",
          5: "Final AI Review",
        };

        const statusColors: Record<string, [number, number, number]> = {
          pass: [34, 197, 94], warn: [245, 158, 11], fail: [239, 68, 68], idle: [100, 100, 120],
        };

        ensureSpace(validationResults.length * 8 + 14);

        doc.setFillColor(validationApproved ? 240 : 254, validationApproved ? 253 : 226, validationApproved ? 244 : 226);
        doc.rect(margin, y - 2, contentWidth, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(validationApproved ? 21 : 185, validationApproved ? 128 : 28, validationApproved ? 61 : 26);
        doc.text(
          validationApproved ? "VALIDATION APPROVED — All 5 layers passed (100%)" : "VALIDATION NOT APPROVED — Review issues below",
          margin + 2, y + 3
        );
        y += 9;

        // Header row
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 100);
        doc.text("Layer Name", margin + 8, y);
        doc.text("Status", margin + 110, y);
        doc.text("Score", margin + 140, y);
        y += 5;
        doc.setDrawColor(200, 200, 220);
        doc.line(margin, y - 1, margin + contentWidth, y - 1);

        validationResults.forEach(layer => {
          ensureSpace(8);
          const [lr, lg, lb] = statusColors[layer.status] || [100, 100, 120];
          doc.setFillColor(lr, lg, lb);
          doc.circle(margin + 4, y + 1, 1.5, "F");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(30, 30, 50);
          const lName = LAYER_NAMES[layer.layerId] || `Layer ${layer.layerId}`;
          doc.text(lName, margin + 8, y + 2);
          doc.setTextColor(lr, lg, lb);
          doc.setFont("helvetica", "bold");
          doc.text(layer.status.toUpperCase(), margin + 110, y + 2);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 30, 50);
          doc.text(`${layer.score}%`, margin + 140, y + 2);
          y += 6;
        });
        y += 4;
      }

      // === CONFIRMED DIMENSIONS ===
      if (sections.confirmedDimensions && confirmedDimensions.length > 0) {
        const confirmedOnly = confirmedDimensions.filter(d => d.confirmed);
        if (confirmedOnly.length > 0) {
          sectionTitle("Confirmed DXF Dimensions");

          ensureSpace(confirmedOnly.length * 6 + 10);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(80, 80, 100);
          doc.text("Label", margin + 2, y);
          doc.text("Type", margin + 70, y);
          doc.text("Value", margin + 100, y);
          doc.text("Override", margin + 130, y);
          y += 5;
          doc.setDrawColor(200, 200, 220);
          doc.line(margin, y - 1, margin + contentWidth, y - 1);

          confirmedOnly.forEach(dim => {
            ensureSpace(7);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(30, 30, 50);
            const label = dim.text || "—";
            doc.text(label.length > 30 ? label.slice(0, 27) + "..." : label, margin + 2, y + 2);
            doc.setTextColor(80, 80, 100);
            doc.text(dim.type, margin + 70, y + 2);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 30, 50);
            doc.text(`${dim.value.toFixed(2)} mm`, margin + 100, y + 2);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(80, 80, 100);
            doc.text(dim.override !== undefined ? `${dim.override.toFixed(2)} mm` : "—", margin + 130, y + 2);
            y += 5;
          });
          y += 4;
        }
      }

      // === MACHINE BOM ===
      if (sections.machineBOM) {
        sectionTitle("Machine Bill of Materials (BOM)");

        // Use the same BOM generator as MachineBOMPanel for consistency
        const bomData = generateBOM(useCncStore.getState());
        const bomItems = bomData.map(item => ({
          item: item.description,
          qty: `${item.qty} ${item.unit}`,
          material: item.material,
          notes: item.spec.length > 35 ? item.spec.slice(0, 32) + "..." : item.spec,
        }));

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 100);
        doc.text("#", margin + 2, y);
        doc.text("Line Item", margin + 10, y);
        doc.text("Qty", margin + 90, y);
        doc.text("Material", margin + 105, y);
        doc.text("Notes", margin + 145, y);
        y += 5;
        doc.setDrawColor(200, 200, 220);
        doc.line(margin, y - 1, margin + contentWidth, y - 1);

        bomItems.forEach((row, idx) => {
          ensureSpace(7);
          if (idx % 2 === 0) {
            doc.setFillColor(248, 248, 252);
            doc.rect(margin, y - 1, contentWidth, 5.5, "F");
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(80, 80, 100);
          doc.text(`${idx + 1}`, margin + 4, y + 2, { align: "right" });
          doc.setTextColor(30, 30, 50);
          doc.text(row.item, margin + 10, y + 2);
          doc.text(row.qty, margin + 90, y + 2);
          doc.setTextColor(80, 80, 100);
          doc.text(row.material, margin + 105, y + 2);
          doc.text(row.notes, margin + 145, y + 2);
          y += 5;
        });
        y += 5;
      }

      // AI Providers Section
      sectionTitle("AI Technology — Powered By");

      const aiProviders: { badge: string; name: string; model: string; role: string; badgeColor: [number, number, number] }[] = [
        {
          badge: "SAM",
          name: "SambaNova Systems",
          model: "Meta-Llama-3.1-8B-Instruct",
          role: "High-Speed Inference Engine — Expert Q&A & Design Analysis",
          badgeColor: [220, 38, 38],
        },
        {
          badge: "GEM",
          name: "Google Gemini",
          model: "gemini-2.5-pro",
          role: "Primary Reasoning — Forming Calculations & Report Insights",
          badgeColor: [37, 99, 235],
        },
        {
          badge: "CLN",
          name: "Anthropic Claude",
          model: "claude-haiku-4-5",
          role: "Quality Analysis & Process Optimization Assistant",
          badgeColor: [124, 58, 237],
        },
        {
          badge: "OR",
          name: "OpenRouter",
          model: "meta-llama/llama-3.1-8b-instruct",
          role: "Fallback Inference — Material & Process Expert",
          badgeColor: [16, 185, 129],
        },
      ];

      ensureSpace(aiProviders.length * 14 + 10);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Sai Rolotech Smart Engines uses a multi-provider AI stack for expert engineering assistance, design analysis, and quality checking.",
        margin, y
      );
      y += 6;

      aiProviders.forEach((prov) => {
        ensureSpace(14);
        const rowH = 11;

        // Badge
        doc.setFillColor(...prov.badgeColor);
        doc.roundedRect(margin, y - 1, 10, rowH - 1, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(prov.badge, margin + 5, y + 5.5, { align: "center" });

        // Provider name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(prov.name, margin + 13, y + 4);

        // Model
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Model: ${prov.model}`, margin + 13, y + 9);

        // Role
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(prov.role, margin + 90, y + 6.5);

        y += rowH + 2;
      });

      // SambaNova highlight box
      ensureSpace(18);
      y += 2;
      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(220, 38, 38);
      doc.roundedRect(margin, y, contentWidth, 13, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(185, 28, 28);
      doc.text("SAM  (SambaNova)", margin + 5, y + 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(107, 33, 168);
      doc.text(
        "SambaNova RDU — Purpose-built AI hardware for ultra-low-latency inference at scale. Model: Meta-Llama-3.1-8B-Instruct.",
        margin + 5, y + 10, { maxWidth: contentWidth - 10 }
      );
      y += 17;

      addFooter();

      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `design-report-${profileName || "roll-forming"}-${date.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      const exportHistoryRaw = localStorage.getItem("sai-rolotech-smart-engines-export-history");
      const history = exportHistoryRaw ? JSON.parse(exportHistoryRaw) : [];
      history.unshift({
        id: `exp-${Date.now()}`,
        type: "PDF Report",
        fileName: a.download,
        timestamp: date.toISOString(),
        sections: Object.entries(sections).filter(([, v]) => v).map(([k]) => k),
        profileName: profileName || "Roll Forming Job",
      });
      localStorage.setItem("sai-rolotech-smart-engines-export-history", JSON.stringify(history.slice(0, 50)));

    } catch (err) {
      console.error("PDF generation failed:", err);
    }
    setGenerating(false);
  };

  const sectionOptions: { key: keyof ReportSections; label: string; available: boolean }[] = [
    { key: "profileGeometry", label: "Profile Geometry & Dimensions", available: geometry !== null },
    { key: "flowerPattern", label: "Power Pattern Stations", available: stations.length > 0 },
    { key: "rollTooling", label: "Roll Tooling Specifications", available: rollTooling.length > 0 },
    { key: "materialProperties", label: "Material Properties", available: true },
    { key: "gcodePrograms", label: "G-Code Program Summary", available: gcodeOutputs.length > 0 },
    { key: "qualityScore", label: "AI Design Quality Score", available: designScore !== null && designScore.overallScore >= 0 },
    { key: "proAnalysis", label: "Professional Forming Analysis (Stress/Energy/Thinning)", available: stations.length > 0 },
    { key: "validationPipeline", label: "5-Layer Validation Pipeline Results", available: validationResults.length > 0 },
    { key: "confirmedDimensions", label: "Confirmed DXF Dimensions", available: confirmedDimensions.filter(d => d.confirmed).length > 0 },
    { key: "machineBOM", label: "Machine Bill of Materials (BOM)", available: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0F0F1C] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Generate Design Report</h2>
              <p className="text-xs text-blue-300/70">Professional PDF with Sai Rolotech Smart Engines branding</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Engineer Name (optional)</label>
            <input
              type="text"
              value={engineerName}
              onChange={e => setEngineerName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 block">Report Sections</label>
            <div className="space-y-1.5">
              {sectionOptions.map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    sections[opt.key] && opt.available
                      ? "bg-blue-500/10 border-blue-500/25"
                      : "bg-white/[0.02] border-white/[0.06]"
                  } ${!opt.available ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={sections[opt.key] && opt.available}
                    onChange={() => opt.available && toggleSection(opt.key)}
                    disabled={!opt.available}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-zinc-300">{opt.label}</span>
                  {!opt.available && <span className="text-[9px] text-zinc-600 ml-auto">No data</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-[10px] text-zinc-500 space-y-1">
            <div><strong className="text-zinc-400">Profile:</strong> {profileName || "—"}</div>
            <div><strong className="text-zinc-400">Material:</strong> {materialType} {materialThickness}mm</div>
            <div><strong className="text-zinc-400">Stations:</strong> {stations.length} | <strong className="text-zinc-400">Rolls:</strong> {rollTooling.length} | <strong className="text-zinc-400">G-Code:</strong> {gcodeOutputs.length} programs</div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] space-y-2">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generatePDF}
              disabled={generating}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-4 h-4" /> Generate PDF</>
              )}
            </button>
          </div>
          <button
            onClick={() => {
              const subject = encodeURIComponent(`Design Report: ${profileName || "Roll Forming Job"}`);
              const body = encodeURIComponent(buildEmailSummary(store));
              window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
            }}
            className="w-full py-2 rounded-lg text-xs font-semibold bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/20 text-emerald-400 transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-3.5 h-3.5" />
            Quick Share via Email
          </button>
        </div>
      </div>
    </div>
  );
}
