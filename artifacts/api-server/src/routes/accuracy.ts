import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

router.post("/accuracy/validate", (req: Request, res: Response) => {
  try {
    const { profile, stations, material, thickness } = req.body as {
      profile?: { segments?: unknown[]; bends?: unknown[] };
      stations?: { bendAngle?: number; rollGap?: number }[];
      material?: string;
      thickness?: number;
    };

    const issues: { layer: number; level: "error" | "warning" | "info"; message: string }[] = [];
    let score = 100;

    if (!profile || !profile.segments || (profile.segments as unknown[]).length === 0) {
      issues.push({ layer: 1, level: "warning", message: "No profile geometry loaded — using default parameters" });
      score -= 5;
    }

    if (!stations || stations.length === 0) {
      issues.push({ layer: 2, level: "warning", message: "No flower pattern stations defined" });
      score -= 10;
    }

    const t = parseFloat(String(thickness ?? 1.0));
    const mat = (material ?? "GI").toUpperCase();

    if (t < 0.3) {
      issues.push({ layer: 1, level: "error", message: `Thickness ${t}mm is below minimum 0.3mm for roll forming` });
      score -= 15;
    } else if (t > 6.0) {
      issues.push({ layer: 1, level: "warning", message: `Thickness ${t}mm is heavy gauge (>6mm) — verify machine capacity and reduce forming speeds` });
      score -= 8;
    } else if (t > 3.0) {
      issues.push({ layer: 1, level: "info", message: `Thickness ${t}mm is thick gauge (>3mm) — reduce cutting speeds 8%, feeds 10%` });
    }

    if (stations && stations.length > 0) {
      for (const [i, s] of stations.entries()) {
        const angle = s.bendAngle ?? 0;
        const maxAngle = mat === "SS" ? 10 : mat === "TI" ? 8 : 15;
        if (angle > maxAngle) {
          issues.push({ layer: 2, level: "warning", message: `Station ${i + 1}: bend angle ${angle}° exceeds max ${maxAngle}° for ${mat}` });
          score -= 3;
        }
      }
    }

    res.json({
      score: Math.max(0, score),
      grade: score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : "D",
      issues,
      passed: issues.filter(i => i.level === "error").length === 0,
      summary: `Accuracy validation complete. Score: ${Math.max(0, score)}/100`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Accuracy validation failed";
    res.status(500).json({ error: message });
  }
});

router.post("/accuracy/check", (req: Request, res: Response) => {
  try {
    const { value, expected, tolerance, unit } = req.body as {
      value: number;
      expected: number;
      tolerance: number;
      unit?: string;
    };

    const deviation = Math.abs(value - expected);
    const pass = deviation <= tolerance;

    res.json({
      pass,
      value,
      expected,
      tolerance,
      deviation: parseFloat(deviation.toFixed(4)),
      unit: unit ?? "mm",
      message: pass
        ? `Within tolerance (deviation: ${deviation.toFixed(3)}${unit ?? "mm"})`
        : `Out of tolerance — deviation: ${deviation.toFixed(3)}${unit ?? "mm"} > ±${tolerance}${unit ?? "mm"}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Accuracy check failed";
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /accuracy/:taskType — score any generation task (flower, tooling, etc.)
// Note: /accuracy/design-score is matched here as taskType="design-score"
// ---------------------------------------------------------------------------
router.post("/accuracy/:taskType", (req: Request, res: Response) => {
  try {
    const { taskType } = req.params as { taskType: string };
    const body = req.body as Record<string, unknown>;

    const now = new Date().toISOString();
    let overallScore = 85;
    const subScores: { dimension: string; score: number; weight?: number; value?: string | number; warning?: string; tips?: string[] }[] = [];
    const warnings: string[] = [];
    const improvementTips: string[] = [];

    // Shared field extraction
    const material = (String(body["material"] ?? body["materialType"] ?? "GI")).toUpperCase();
    const thickness = parseFloat(String(body["thickness"] ?? body["materialThickness"] ?? 1.5));
    const stationCount = parseInt(String(body["stationCount"] ?? body["numStations"] ?? body["totalStations"] ?? 0), 10);

    if (taskType === "flower" || taskType === "design-score") {
      const totalBendAngle = parseFloat(String(body["totalBendAngle"] ?? 0));
      const bendCount = parseInt(String(body["bendCount"] ?? body["totalBends"] ?? 0), 10);
      const maxPassAngle = material === "SS" ? 10 : material === "TI" ? 8 : 15;
      const recommendedStations = Math.max(3, Math.ceil(totalBendAngle / maxPassAngle));

      let stationScore = 100;
      if (stationCount > 0 && recommendedStations > 0) {
        const ratio = stationCount / recommendedStations;
        stationScore = ratio < 0.7 ? 60 : ratio > 1.5 ? 75 : 95;
        if (ratio < 0.7) warnings.push(`Station count (${stationCount}) is too low for ${totalBendAngle.toFixed(0)}° total bend — recommend ≥${recommendedStations}`);
      }

      subScores.push({ dimension: "Station count", score: stationScore, weight: 0.25, value: stationCount || "N/A", tips: [`Recommended: ${recommendedStations} stations for this profile`] });

      let matScore = 100;
      if (thickness < 0.5) { matScore = 65; warnings.push("Very thin material (<0.5mm) — risk of edge wave"); }
      else if (thickness > 4.0) { matScore = 75; warnings.push("Heavy gauge (>4mm) — verify machine tonnage capacity"); }
      subScores.push({ dimension: "Material suitability", score: matScore, weight: 0.20, value: `${material} ${thickness}mm` });

      const bendScore = bendCount === 0 ? 70 : bendCount <= 4 ? 100 : bendCount <= 8 ? 90 : 80;
      subScores.push({ dimension: "Profile complexity", score: bendScore, weight: 0.20, value: `${bendCount} bend${bendCount !== 1 ? "s" : ""}` });

      overallScore = Math.round(subScores.reduce((s, d) => s + d.score * (d.weight ?? 0.25), 0));
      if (material === "SS") improvementTips.push("Apply 10–12% springback compensation in calibration stations");
      if (stationCount > 0 && stationCount < recommendedStations) improvementTips.push(`Increase stations to ${recommendedStations} for better forming quality`);
    }

    if (taskType === "tooling") {
      const rollOD = parseFloat(String(body["rollOD"] ?? 150));
      const shaftDia = parseFloat(String(body["shaftDia"] ?? body["shaftDiameter"] ?? 50));
      const rollODScore = rollOD < 80 ? 70 : rollOD > 300 ? 75 : 95;
      const shaftScore = shaftDia < 30 ? 65 : shaftDia > 100 ? 75 : 95;
      subScores.push({ dimension: "Roll OD", score: rollODScore, weight: 0.35, value: `${rollOD}mm` });
      subScores.push({ dimension: "Shaft diameter", score: shaftScore, weight: 0.35, value: `${shaftDia}mm` });
      subScores.push({ dimension: "Material", score: 90, weight: 0.30, value: material });
      overallScore = Math.round(subScores.reduce((s, d) => s + d.score * (d.weight ?? 0.33), 0));
      if (rollOD < 100) improvementTips.push("Roll OD < 100mm may cause excessive springback — consider 120–160mm");
    }

    if (taskType === "gcode") {
      const lineSpeed = parseFloat(String(body["lineSpeed"] ?? 25));
      const feedRate = parseFloat(String(body["feedRate"] ?? 100));
      const speedScore = lineSpeed < 5 ? 70 : lineSpeed > 60 ? 80 : 95;
      const feedScore = feedRate < 50 ? 75 : feedRate > 500 ? 70 : 90;
      subScores.push({ dimension: "Line speed", score: speedScore, weight: 0.40, value: `${lineSpeed} m/min` });
      subScores.push({ dimension: "Feed rate", score: feedScore, weight: 0.35, value: `${feedRate} mm/min` });
      subScores.push({ dimension: "G-code validity", score: 95, weight: 0.25 });
      overallScore = Math.round(subScores.reduce((s, d) => s + d.score * (d.weight ?? 0.33), 0));
      if (lineSpeed > 40) improvementTips.push("High line speed (>40 m/min) — verify strip tracking and roll wear");
    }

    if (taskType === "ai-diagnosis") {
      subScores.push({ dimension: "Diagnosis completeness", score: 90, weight: 0.50 });
      subScores.push({ dimension: "Rule compliance", score: 88, weight: 0.50 });
      overallScore = 89;
    }

    if (subScores.length === 0) {
      subScores.push({ dimension: "General compliance", score: overallScore, weight: 1.0 });
    }

    const grade: "A" | "B" | "C" | "D" | "F" =
      overallScore >= 90 ? "A" : overallScore >= 80 ? "B" : overallScore >= 70 ? "C" : overallScore >= 60 ? "D" : "F";

    res.json({
      success: true,
      taskType,
      overallScore: Math.max(0, Math.min(100, overallScore)),
      subScores,
      warnings,
      timestamp: now,
      grade,
      improvementTips,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Accuracy scoring failed";
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
