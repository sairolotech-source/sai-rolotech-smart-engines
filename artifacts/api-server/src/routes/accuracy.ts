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

    if (t < 0.3 || t > 10) {
      issues.push({ layer: 1, level: "error", message: `Thickness ${t}mm is outside recommended range 0.3–10mm` });
      score -= 15;
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

export default router;
