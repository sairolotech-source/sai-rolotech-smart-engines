import React, { useState } from "react";
import { useCncStore, type StationProfile } from "../../store/useCncStore";
import { FileText, Download, Loader2 } from "lucide-react";

interface ExtendedStationProfile extends StationProfile {
  flatStripWidth?: number;
  rollGapRecommended?: number;
}

interface GuardrailProfile {
  model: string;
  coilWidth: number;
  coverWidth: number;
  thickness: number;
  usage: string;
  pitch: number;
  waveHeight: number;
  bends: number;
  segments: { x1: number; y1: number; x2: number; y2: number }[];
}

const CR310: GuardrailProfile = {
  model: "CR-310",
  coilWidth: 482,
  coverWidth: 310,
  thickness: 3.0,
  usage: "Guardrail",
  pitch: 193,
  waveHeight: 83,
  bends: 6,
  segments: [
    { x1: 0, y1: 0, x2: 28, y2: 83 },
    { x1: 28, y1: 83, x2: 89, y2: 83 },
    { x1: 89, y1: 83, x2: 117, y2: 0 },
    { x1: 117, y1: 0, x2: 193, y2: 0 },
    { x1: 193, y1: 0, x2: 221, y2: 83 },
    { x1: 221, y1: 83, x2: 282, y2: 83 },
    { x1: 282, y1: 83, x2: 310, y2: 0 },
  ],
};

const CR194: GuardrailProfile = {
  model: "CR-194",
  coilWidth: 748,
  coverWidth: 506,
  thickness: 3.0,
  usage: "Guardrail",
  pitch: 194,
  waveHeight: 83,
  bends: 10,
  segments: [
    { x1: 0, y1: 0, x2: 29, y2: 83 },
    { x1: 29, y1: 83, x2: 89, y2: 83 },
    { x1: 89, y1: 83, x2: 118, y2: 0 },
    { x1: 118, y1: 0, x2: 194, y2: 0 },
    { x1: 194, y1: 0, x2: 223, y2: 83 },
    { x1: 223, y1: 83, x2: 283, y2: 83 },
    { x1: 283, y1: 83, x2: 312, y2: 0 },
    { x1: 312, y1: 0, x2: 388, y2: 0 },
    { x1: 388, y1: 0, x2: 417, y2: 83 },
    { x1: 417, y1: 83, x2: 477, y2: 83 },
    { x1: 477, y1: 83, x2: 506, y2: 0 },
  ],
};

function generateFlowerStations(profile: GuardrailProfile, numStations: number) {
  const stations = [];
  for (let i = 1; i <= numStations; i++) {
    const fraction = i / numStations;
    const maxBendAngle = 55 * fraction;
    const stripWidth = profile.coilWidth - (profile.coilWidth - profile.coverWidth) * fraction * 0.3;
    let passZone: string;
    if (fraction <= 0.3) passZone = "Light Bending";
    else if (fraction <= 0.7) passZone = "Major Forming";
    else if (i >= numStations - 1) passZone = "Calibration";
    else passZone = "Finishing";

    const increment = i === 1 ? maxBendAngle : 55 * (1 / numStations);
    const rollGap = profile.thickness + 0.15 + (1 - fraction) * 0.2;

    stations.push({
      station: i,
      label: `S${i}`,
      totalAngle: parseFloat(maxBendAngle.toFixed(1)),
      bendAngle: parseFloat((maxBendAngle / profile.bends).toFixed(1)),
      stripWidth: parseFloat(stripWidth.toFixed(1)),
      passZone,
      increment: parseFloat(increment.toFixed(1)),
      rollGap: parseFloat(rollGap.toFixed(2)),
    });
  }
  return stations;
}

function generateRollTooling(profile: GuardrailProfile, numStations: number, rollDiameter: number, shaftDiameter: number) {
  const rolls = [];
  for (let i = 1; i <= numStations; i++) {
    const fraction = i / numStations;
    const grooveDepth = profile.waveHeight * fraction * 0.8;
    const rollWidth = profile.coverWidth + 20;
    const gap = profile.thickness + 0.15;
    rolls.push({
      station: i,
      label: `S${i}`,
      od: rollDiameter,
      bore: shaftDiameter,
      width: parseFloat(rollWidth.toFixed(1)),
      grooveDepth: parseFloat(grooveDepth.toFixed(2)),
      gap: parseFloat(gap.toFixed(2)),
    });
  }
  return rolls;
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function GuardrailReportGenerator({ onClose }: { onClose: () => void }) {
  const store = useCncStore();
  const { stations, rollTooling, rollDiameter, shaftDiameter, numStations } = store;
  const [generating, setGenerating] = useState(false);
  const [engineerName, setEngineerName] = useState("");

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

      const date = new Date();
      const dateStr = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      const addHeader = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 30, "F");
        doc.setFillColor(234, 88, 12);
        doc.rect(0, 30, pageWidth, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.text("Sai Rolotech Smart Engines Engine", margin, 14);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(180, 180, 210);
        doc.text("Corrugated Guardrail Profile — Power Pattern & Roll Tooling Report", margin, 21);

        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${dateStr} at ${timeStr}`, pageWidth - margin, 12, { align: "right" });
        if (engineerName) {
          doc.text(`Engineer: ${engineerName}`, pageWidth - margin, 18, { align: "right" });
        }
        doc.text(`Page ${pageNum}`, pageWidth - margin, 24, { align: "right" });
      };

      const addFooter = () => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
        doc.setFontSize(7);
        doc.setTextColor(140, 140, 170);
        doc.setFont("helvetica", "normal");
        doc.text("Sai Rolotech Smart Engines Engine — Confidential Guardrail Specification Report", margin, pageHeight - 5);
        doc.text(`Generated: ${date.toISOString().slice(0, 10)}`, pageWidth - margin, pageHeight - 5, { align: "right" });
      };

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 20) {
          addFooter();
          doc.addPage();
          pageNum++;
          addHeader();
          y = 38;
        }
      };

      const sectionTitle = (title: string) => {
        ensureSpace(14);
        doc.setFillColor(234, 88, 12);
        doc.rect(margin, y, 3, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text(title.toUpperCase(), margin + 6, y + 6);
        y += 12;
      };

      const drawProfileDiagram = (profile: GuardrailProfile, diagramWidth: number, diagramHeight: number) => {
        const xOffset = margin + 5;
        const yOffset = y + 5;
        const maxX = Math.max(...profile.segments.map(s => Math.max(s.x2)));
        const maxY = profile.waveHeight;
        const scaleX = (diagramWidth - 10) / maxX;
        const scaleY = (diagramHeight - 20) / maxY;

        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.6);
        for (const seg of profile.segments) {
          doc.line(
            xOffset + seg.x1 * scaleX,
            yOffset + diagramHeight - 10 - seg.y1 * scaleY,
            xOffset + seg.x2 * scaleX,
            yOffset + diagramHeight - 10 - seg.y2 * scaleY
          );
        }

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(234, 88, 12);

        const pitchStartX = xOffset + profile.segments[0].x2 * scaleX;
        const pitchEndX = xOffset + (profile.segments[3]?.x2 ?? profile.pitch) * scaleX;
        const pitchY = yOffset + 3;
        doc.setDrawColor(234, 88, 12);
        doc.setLineWidth(0.3);
        doc.line(pitchStartX, pitchY, pitchEndX, pitchY);
        doc.text(`${profile.pitch}mm`, (pitchStartX + pitchEndX) / 2, pitchY - 1, { align: "center" });

        const waveTopY = yOffset + diagramHeight - 10 - maxY * scaleY;
        const waveBottomY = yOffset + diagramHeight - 10;
        const waveX = xOffset + 15;
        doc.line(waveX, waveTopY, waveX, waveBottomY);
        doc.text(`${profile.waveHeight}mm`, waveX + 2, (waveTopY + waveBottomY) / 2);

        const coverStartX = xOffset;
        const coverEndX = xOffset + profile.coverWidth * scaleX;
        const coverY = yOffset + diagramHeight - 3;
        doc.line(coverStartX, coverY, coverEndX, coverY);
        doc.text(`${profile.coverWidth}mm`, (coverStartX + coverEndX) / 2, coverY + 3, { align: "center" });
      };

      const drawSpecTable = (profile: GuardrailProfile) => {
        const colWidths = [30, 35, 35, 30, 30];
        const headers = ["Model", "Coil Width", "Cover Width", "Thickness", "Usage"];
        const values = [profile.model, `${profile.coilWidth}mm`, `${profile.coverWidth}mm`, `${profile.thickness}mm`, profile.usage];

        doc.setFillColor(15, 23, 42);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        let xPos = margin;
        for (let i = 0; i < headers.length; i++) {
          doc.rect(xPos, y, colWidths[i], 7, "F");
          doc.text(headers[i], xPos + colWidths[i] / 2, y + 5, { align: "center" });
          xPos += colWidths[i];
        }
        y += 7;

        doc.setFillColor(248, 250, 252);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "normal");
        xPos = margin;
        for (let i = 0; i < values.length; i++) {
          doc.rect(xPos, y, colWidths[i], 7, "F");
          doc.setDrawColor(200, 200, 210);
          doc.rect(xPos, y, colWidths[i], 7, "S");
          doc.text(values[i], xPos + colWidths[i] / 2, y + 5, { align: "center" });
          xPos += colWidths[i];
        }
        y += 10;
      };

      addHeader();
      y = 38;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("Corrugated Guardrail — Profile Specification Report", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Complete forming data for CR-310 & CR-194 highway guardrail profiles", margin, y);
      y += 4;
      doc.text("Material: HR / GI / MS  |  Thickness: 3.0mm  |  Application: Highway Safety Barrier", margin, y);
      y += 10;

      sectionTitle("CR-310 Guardrail Profile");
      ensureSpace(55);
      drawProfileDiagram(CR310, contentWidth, 40);
      y += 45;
      ensureSpace(20);
      drawSpecTable(CR310);

      ensureSpace(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 64, 175);
      doc.text("CR-310 Key Dimensions:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 70);
      const cr310dims = [
        `Pitch: ${CR310.pitch}mm  |  Wave Height: ${CR310.waveHeight}mm  |  Cover Width: ${CR310.coverWidth}mm`,
        `Coil Width: ${CR310.coilWidth}mm  |  Thickness: ${CR310.thickness}mm  |  Bends: ${CR310.bends}`,
      ];
      cr310dims.forEach(line => { doc.text(line, margin, y); y += 4; });
      y += 5;

      sectionTitle("CR-194 Guardrail Profile");
      ensureSpace(55);
      drawProfileDiagram(CR194, contentWidth, 40);
      y += 45;
      ensureSpace(20);
      drawSpecTable(CR194);

      ensureSpace(25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 64, 175);
      doc.text("CR-194 Key Dimensions:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 70);
      const cr194dims = [
        `Pitch: ${CR194.pitch}mm  |  Wave Height: ${CR194.waveHeight}mm  |  Cover Width: ${CR194.coverWidth}mm`,
        `Coil Width: ${CR194.coilWidth}mm  |  Thickness: ${CR194.thickness}mm  |  Bends: ${CR194.bends}`,
      ];
      cr194dims.forEach(line => { doc.text(line, margin, y); y += 4; });
      y += 5;

      const stationCount = stations.length > 0 ? stations.length : (numStations || 12);

      sectionTitle("CR-310 — Power Pattern (Station-by-Station Forming)");
      const cr310Stations = stations.length > 0 && store.profileMetadata?.model === "CR-310"
        ? (stations as ExtendedStationProfile[]).map((st, i) => ({
            station: st.stationNumber,
            label: st.label,
            totalAngle: parseFloat(st.totalAngle.toFixed(1)),
            bendAngle: parseFloat((st.totalAngle / CR310.bends).toFixed(1)),
            stripWidth: parseFloat((st.flatStripWidth ?? CR310.coilWidth - i * 5).toFixed(1)),
            passZone: st.passZone || "—",
            increment: st.angleIncrementDeg !== undefined ? parseFloat(st.angleIncrementDeg.toFixed(1)) : parseFloat((55 / stationCount).toFixed(1)),
            rollGap: st.rollGapRecommended ?? parseFloat((CR310.thickness + 0.15).toFixed(2)),
          }))
        : generateFlowerStations(CR310, stationCount);

      ensureSpace(cr310Stations.length * 5 + 12);
      const flowerHeaders = ["Stn", "Label", "Total Angle", "Bend/Angle", "Strip Width", "Pass Zone", "Increment", "Roll Gap"];
      const flowerColW = [12, 15, 22, 22, 24, 28, 22, 22];
      doc.setFillColor(15, 23, 42);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      let xPos = margin;
      for (let i = 0; i < flowerHeaders.length; i++) {
        doc.rect(xPos, y - 3, flowerColW[i], 6, "F");
        doc.text(flowerHeaders[i], xPos + 1, y);
        xPos += flowerColW[i];
      }
      y += 5;

      doc.setTextColor(30, 30, 50);
      doc.setFont("helvetica", "normal");
      cr310Stations.forEach((st, i) => {
        ensureSpace(5);
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 3, contentWidth, 5, "F");
        }
        xPos = margin;
        const vals = [`${st.station}`, st.label, `${st.totalAngle}°`, `${st.bendAngle}°`, `${st.stripWidth}mm`, `${st.passZone}`, `+${st.increment}°`, `${st.rollGap}mm`];
        for (let j = 0; j < vals.length; j++) {
          doc.text(vals[j], xPos + 1, y);
          xPos += flowerColW[j];
        }
        y += 5;
      });
      y += 5;

      sectionTitle("CR-194 — Power Pattern (Station-by-Station Forming)");
      const cr194Stations = stations.length > 0 && store.profileMetadata?.model === "CR-194"
        ? (stations as ExtendedStationProfile[]).map((st, i) => ({
            station: st.stationNumber,
            label: st.label,
            totalAngle: parseFloat(st.totalAngle.toFixed(1)),
            bendAngle: parseFloat((st.totalAngle / CR194.bends).toFixed(1)),
            stripWidth: parseFloat((st.flatStripWidth ?? CR194.coilWidth - i * 5).toFixed(1)),
            passZone: st.passZone || "—",
            increment: st.angleIncrementDeg !== undefined ? parseFloat(st.angleIncrementDeg.toFixed(1)) : parseFloat((55 / stationCount).toFixed(1)),
            rollGap: st.rollGapRecommended ?? parseFloat((CR194.thickness + 0.15).toFixed(2)),
          }))
        : generateFlowerStations(CR194, stationCount);

      ensureSpace(cr194Stations.length * 5 + 12);
      doc.setFillColor(15, 23, 42);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      xPos = margin;
      for (let i = 0; i < flowerHeaders.length; i++) {
        doc.rect(xPos, y - 3, flowerColW[i], 6, "F");
        doc.text(flowerHeaders[i], xPos + 1, y);
        xPos += flowerColW[i];
      }
      y += 5;

      doc.setTextColor(30, 30, 50);
      doc.setFont("helvetica", "normal");
      cr194Stations.forEach((st, i) => {
        ensureSpace(5);
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 3, contentWidth, 5, "F");
        }
        xPos = margin;
        const vals = [`${st.station}`, st.label, `${st.totalAngle}°`, `${st.bendAngle}°`, `${st.stripWidth}mm`, `${st.passZone}`, `+${st.increment}°`, `${st.rollGap}mm`];
        for (let j = 0; j < vals.length; j++) {
          doc.text(vals[j], xPos + 1, y);
          xPos += flowerColW[j];
        }
        y += 5;
      });
      y += 5;

      const rdOD = rollDiameter || 150;
      const rdShaft = shaftDiameter || 50;

      sectionTitle("CR-310 — Roll Tooling Summary");
      const cr310Rolls = rollTooling.length > 0 && store.profileMetadata?.model === "CR-310"
        ? rollTooling.map(rt => ({
            station: rt.stationNumber,
            label: rt.label,
            od: rt.rollProfile.rollDiameter,
            bore: rt.rollProfile.shaftDiameter,
            width: parseFloat(rt.rollProfile.rollWidth.toFixed(1)),
            grooveDepth: parseFloat(rt.rollProfile.grooveDepth.toFixed(2)),
            gap: parseFloat(rt.rollProfile.gap.toFixed(2)),
          }))
        : generateRollTooling(CR310, stationCount, rdOD, rdShaft);

      ensureSpace(cr310Rolls.length * 5 + 12);
      const rollHeaders = ["Stn", "Label", "OD (mm)", "Bore (mm)", "Width (mm)", "Groove Depth", "Gap (mm)"];
      const rollColW = [14, 18, 24, 24, 26, 28, 24];
      doc.setFillColor(15, 23, 42);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      xPos = margin;
      for (let i = 0; i < rollHeaders.length; i++) {
        doc.rect(xPos, y - 3, rollColW[i], 6, "F");
        doc.text(rollHeaders[i], xPos + 1, y);
        xPos += rollColW[i];
      }
      y += 5;

      doc.setTextColor(30, 30, 50);
      doc.setFont("helvetica", "normal");
      cr310Rolls.forEach((rt, i) => {
        ensureSpace(5);
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 3, contentWidth, 5, "F");
        }
        xPos = margin;
        const vals = [`${rt.station}`, rt.label, `Ø${rt.od}`, `Ø${rt.bore}`, `${rt.width}`, `${rt.grooveDepth}`, `${rt.gap}`];
        for (let j = 0; j < vals.length; j++) {
          doc.text(vals[j], xPos + 1, y);
          xPos += rollColW[j];
        }
        y += 5;
      });
      y += 5;

      sectionTitle("CR-194 — Roll Tooling Summary");
      const cr194Rolls = rollTooling.length > 0 && store.profileMetadata?.model === "CR-194"
        ? rollTooling.map(rt => ({
            station: rt.stationNumber,
            label: rt.label,
            od: rt.rollProfile.rollDiameter,
            bore: rt.rollProfile.shaftDiameter,
            width: parseFloat(rt.rollProfile.rollWidth.toFixed(1)),
            grooveDepth: parseFloat(rt.rollProfile.grooveDepth.toFixed(2)),
            gap: parseFloat(rt.rollProfile.gap.toFixed(2)),
          }))
        : generateRollTooling(CR194, stationCount, rdOD, rdShaft);

      ensureSpace(cr194Rolls.length * 5 + 12);
      doc.setFillColor(15, 23, 42);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      xPos = margin;
      for (let i = 0; i < rollHeaders.length; i++) {
        doc.rect(xPos, y - 3, rollColW[i], 6, "F");
        doc.text(rollHeaders[i], xPos + 1, y);
        xPos += rollColW[i];
      }
      y += 5;

      doc.setTextColor(30, 30, 50);
      doc.setFont("helvetica", "normal");
      cr194Rolls.forEach((rt, i) => {
        ensureSpace(5);
        if (i % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 3, contentWidth, 5, "F");
        }
        xPos = margin;
        const vals = [`${rt.station}`, rt.label, `Ø${rt.od}`, `Ø${rt.bore}`, `${rt.width}`, `${rt.grooveDepth}`, `${rt.gap}`];
        for (let j = 0; j < vals.length; j++) {
          doc.text(vals[j], xPos + 1, y);
          xPos += rollColW[j];
        }
        y += 5;
      });
      y += 5;

      sectionTitle("Machine Parameters Summary");
      ensureSpace(50);
      const machineData = [
        ["Roll Outer Diameter", `Ø${rdOD} mm`],
        ["Shaft (Arbor) Diameter", `Ø${rdShaft} mm`],
        ["Material Thickness", "3.0 mm"],
        ["Recommended Roll Gap", "3.15 mm (thickness + 0.15mm clearance)"],
        ["Number of Forming Stations", `${stationCount}`],
        ["Pass Sequence", "Light Bending → Major Forming → Finishing → Calibration"],
        ["Recommended Line Speed", "15–25 m/min (HR/GI/MS at 3mm)"],
        ["Springback Compensation", "2–3° over-bend per station (material dependent)"],
      ];
      machineData.forEach(([label, value]) => {
        ensureSpace(6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 120);
        doc.text(label, margin, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 50);
        doc.text(value, margin + 65, y);
        y += 5;
      });
      y += 5;

      sectionTitle("Reference Drawing");
      const refImageUrl = `${import.meta.env.BASE_URL}guardrail-profiles-reference.jpeg`;
      const refImageData = await loadImageAsDataUrl(refImageUrl);
      if (refImageData) {
        ensureSpace(100);
        try {
          doc.addImage(refImageData, "JPEG", margin, y, contentWidth, 90);
          y += 93;
          doc.setFontSize(7);
          doc.setTextColor(130, 130, 150);
          doc.text("Sai Rolotech Smart Engines Engine — Corrugated Guardrail Profile Reference Drawing (CR-310 & CR-194)", margin, y);
          y += 5;
        } catch {
          doc.setFontSize(8);
          doc.setTextColor(200, 60, 60);
          doc.text("Reference image could not be embedded.", margin, y);
          y += 5;
        }
      }

      addFooter();

      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sai Rolotech Smart Engines-Engine-Guardrail-Report-${date.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      const exportHistoryRaw = localStorage.getItem("sai-rolotech-smart-engines-export-history");
      const history = exportHistoryRaw ? JSON.parse(exportHistoryRaw) : [];
      history.unshift({
        id: `exp-${Date.now()}`,
        type: "Guardrail PDF (Sai Rolotech Smart Engines Engine)",
        fileName: a.download,
        timestamp: date.toISOString(),
        sections: ["CR-310", "CR-194", "Power Pattern", "Roll Tooling", "Reference Image"],
        profileName: "Guardrail CR-310 / CR-194",
      });
      localStorage.setItem("sai-rolotech-smart-engines-export-history", JSON.stringify(history.slice(0, 50)));

    } catch (err) {
      console.error("Guardrail PDF generation failed:", err);
    }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0F0F1C] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-orange-900/60 to-amber-900/60 border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sai Rolotech Smart Engines Engine — Guardrail Report</h2>
              <p className="text-xs text-orange-300/70">CR-310 & CR-194 Power Pattern + Roll Tooling PDF</p>
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
              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500/50"
            />
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 space-y-2">
            <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Report Contents</div>
            <div className="space-y-1 text-xs text-zinc-400">
              <div className="flex items-center gap-2"><span className="text-green-400">✓</span> CR-310 Profile Diagram & Specifications</div>
              <div className="flex items-center gap-2"><span className="text-green-400">✓</span> CR-194 Profile Diagram & Specifications</div>
              <div className="flex items-center gap-2"><span className="text-green-400">✓</span> Power Pattern — Station-by-Station Forming Data</div>
              <div className="flex items-center gap-2"><span className="text-green-400">✓</span> Roll Tooling Summary (OD, Bore, Width, Gap)</div>
              <div className="flex items-center gap-2"><span className="text-green-400">✓</span> Machine Parameters & Recommendations</div>
              <div className="flex items-center gap-2"><span className="text-green-400">✓</span> Reference Drawing (Embedded Image)</div>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-[10px] text-zinc-500 space-y-1">
            <div><strong className="text-zinc-400">Profiles:</strong> CR-310, CR-194</div>
            <div><strong className="text-zinc-400">Material:</strong> 3.0mm (HR / GI / MS)</div>
            <div><strong className="text-zinc-400">Stations:</strong> {stations.length > 0 ? stations.length : numStations || 12} | <strong className="text-zinc-400">Rolls:</strong> {rollTooling.length > 0 ? rollTooling.length : (numStations || 12)}</div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={generatePDF}
            disabled={generating}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="w-4 h-4" /> Download PDF</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
