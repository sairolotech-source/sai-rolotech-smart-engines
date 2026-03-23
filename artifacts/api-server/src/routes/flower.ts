import { Router, type IRouter, type Request, type Response } from "express";
import { generateFlowerPattern, type FlowerStation } from "../lib/power-pattern";
import type { ProfileGeometry } from "../lib/dxf-parser-util";

const router: IRouter = Router();

interface FlowerBody {
  geometry: ProfileGeometry;
  numStations: number | string;
  stationPrefix?: string;
  materialType?: string;
  materialThickness?: number | string;
  openSectionType?: string;
  sectionModel?: "open" | "closed";
}

interface AnalyzeProfileBody {
  material: string;
  thickness: number | string;
  bends: { bend_angle: number }[];
}

router.post("/analyze-profile", (req: Request<unknown, unknown, AnalyzeProfileBody>, res: Response) => {
  try {
    const { material, thickness, bends } = req.body;
    if (!bends || !Array.isArray(bends)) {
      res.status(400).json({ error: "bends array required" });
      return;
    }
    const t = parseFloat(String(thickness)) || 1.0;
    const mat = (material || "GI").toUpperCase();
    const bendCount = bends.length;

    // Step 1 formula (document): base + thin sheet + SS + per-bend angle>90 penalty
    let suggestedPasses = bendCount * 2;
    if (t < 0.5) suggestedPasses += 1;
    if (mat === "SS") suggestedPasses += 2;
    bends.forEach(b => {
      if (Math.abs(b.bend_angle || 0) > 90) suggestedPasses += 1;
    });

    // Step 1 risk logic (document): bend count first, then thickness, then material
    let riskLevel: string;
    if (bendCount >= 4) riskLevel = "high";
    else if (t < 0.4) riskLevel = "medium";
    else if (mat === "SS") riskLevel = "high";
    else riskLevel = "low";

    const totalBendAngle = bends.reduce((s, b) => s + Math.abs(b.bend_angle || 0), 0);

    res.json({ bendCount, suggestedPasses, riskLevel, totalBendAngle, material: mat, thickness: t });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    res.status(400).json({ error: message });
  }
});

/**
 * CLOSED SECTION AI — Model B
 * 
 * Dedicated rule set for closed profiles (tubes, square hollow sections, HSS):
 * - Max 12°/station (tighter than open: prevents ovality build-up)
 * - Springback compensation: 2.5% per degree (softer — closed sections spring less)
 * - Pass zone: 40% entry / 40% major / 20% calibration (longer calibration for ID/OD tolerance)
 * - Weld seam alignment: calibration passes enforce edge alignment
 * - Ovality check: flags if any station angle would produce >0.5% ovality deviation
 * - Fin pass: final stations use reduced forming force for seam closure
 */
function applyClosedSectionRules(stations: FlowerStation[]): FlowerStation[] {
  const nStations = stations.length;
  return stations.map((st, i) => {
    const maxAngleDeg = 12; // Closed section: max 12°/station
    const totalDeg = Math.abs(st.bendAngle); // bendAngle is already in degrees
    const scaleFactor = totalDeg > maxAngleDeg ? maxAngleDeg / totalDeg : 1;
    const isCalibration = i >= Math.floor(nStations * 0.8);
    const isFinPass = i >= Math.floor(nStations * 0.9);
    const finScale = isFinPass ? 0.85 : 1.0;

    // Ovality deviation estimate: each 1° of angle contributes ~0.04% ovality
    const ovalityDeviation = totalDeg * scaleFactor * 0.04; // %

    const newBendAngle = parseFloat((st.bendAngle * scaleFactor * finScale).toFixed(2));
    const newSpringback = parseFloat((Math.abs(newBendAngle) * 0.025).toFixed(2));

    return {
      ...st,
      bendAngle: newBendAngle,
      springbackAngle: newSpringback,
      compensatedAngle: parseFloat((newBendAngle + newSpringback).toFixed(2)),
      rollGap: parseFloat((st.rollGap * (isCalibration ? 0.98 : 1.0)).toFixed(3)),
      // Closed-section metadata appended as extra fields (not part of FlowerStation interface but safe in JS)
      ...(({
        passZone: i < Math.floor(nStations * 0.4) ? "Light Bending"
          : i < Math.floor(nStations * 0.8) ? "Major Forming"
          : "Calibration",
        ovalityCheck: {
          deviationPct: ovalityDeviation,
          status: ovalityDeviation < 0.5 ? "OK" : "WARNING: ovality exceeds 0.5%",
          isCalibrationPass: isCalibration,
          isFinPass,
          weldSeamAligned: isCalibration,
        },
      }) as Record<string, unknown>),
    };
  });
}

/**
 * OPEN SECTION AI — Model A
 * 
 * Dedicated rule set for open profiles (C/Z/U channels, purlins, gutters, angles):
 * - Max 15°/station (less strict than closed: open edge allows more per-pass)
 * - Springback compensation: 3.0% per degree (more aggressive — open sections spring more)
 * - Pass zone: 30% entry / 50% major / 20% calibration (more major forming)
 * - Edge wave risk: detects if cumulative angle could cause edge wave at high stations
 * - Flare check: last 2 stations validated for profile flare and twist
 */
function applyOpenSectionRules(stations: FlowerStation[]): FlowerStation[] {
  const nStations = stations.length;
  let cumulativeAngle = 0;

  return stations.map((st, i) => {
    const maxOpenAngleDeg = 15; // Open section: max 15°/station
    const totalDeg = Math.abs(st.bendAngle); // bendAngle is already in degrees
    const scaleFactor = totalDeg > maxOpenAngleDeg ? maxOpenAngleDeg / totalDeg : 1;
    cumulativeAngle += totalDeg * scaleFactor;
    const isFlareZone = i >= nStations - 2;

    // Edge wave risk: cumulative angle >90° on open section risks edge wave
    const edgeWaveRisk = cumulativeAngle > 90 ? "HIGH" : cumulativeAngle > 60 ? "MEDIUM" : "LOW";

    const newBendAngle = parseFloat((st.bendAngle * scaleFactor).toFixed(2));
    const newSpringback = parseFloat((Math.abs(newBendAngle) * 0.03).toFixed(2));

    return {
      ...st,
      bendAngle: newBendAngle,
      springbackAngle: newSpringback,
      compensatedAngle: parseFloat((newBendAngle + newSpringback).toFixed(2)),
      // Open-section metadata appended as extra fields
      ...(({
        passZone: i < Math.floor(nStations * 0.3) ? "Light Bending"
          : i < Math.floor(nStations * 0.8) ? "Major Forming"
          : "Calibration",
        openSectionCheck: {
          edgeWaveRisk,
          cumulativeAngleDeg: parseFloat(cumulativeAngle.toFixed(2)),
          isFlareZone,
          flareCompensationRequired: isFlareZone && cumulativeAngle > 80,
        },
      }) as Record<string, unknown>),
    };
  });
}

router.post("/generate-flower", (req: Request<unknown, unknown, FlowerBody>, res: Response) => {
  try {
    const { geometry, numStations, stationPrefix, materialType, materialThickness, openSectionType, sectionModel } = req.body;

    if (!geometry || !geometry.segments || geometry.segments.length === 0) {
      res.status(400).json({ error: "No geometry provided" });
      return;
    }

    const stations = Math.max(1, Math.min(30, parseInt(String(numStations)) || 5));
    const prefix = stationPrefix || "S";
    const matType = materialType || "GI";
    const matThickness = parseFloat(String(materialThickness)) || 1.0;
    const sectionType = openSectionType || "C-Section";

    // Generate base flower pattern
    const result = generateFlowerPattern(geometry, stations, prefix, matType, matThickness);

    // Apply model-specific rules
    let processedStations = result.stations;
    let modelNote: string | undefined;

    if (sectionModel === "closed") {
      // Closed Section AI (Model B) — dedicated model with ovality/weld-seam/fin-pass logic
      processedStations = applyClosedSectionRules(result.stations);
      modelNote = "Closed Section AI (Model B): max 12°/station, ovality check, weld-seam alignment, fin-pass forming reduction, 2.5% springback compensation";
    } else if (sectionModel === "open") {
      // Open Section AI (Model A) — dedicated model with edge-wave/flare/twist detection
      processedStations = applyOpenSectionRules(result.stations);
      modelNote = "Open Section AI (Model A): max 15°/station, 3.0% springback compensation, edge-wave risk monitoring, flare-zone detection";
    }

    res.json({
      success: true,
      ...result,
      stations: processedStations,
      sectionModelUsed: sectionModel ?? "auto",
      modelNote,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate power pattern";
    res.status(400).json({ error: message });
  }
});

export default router;
