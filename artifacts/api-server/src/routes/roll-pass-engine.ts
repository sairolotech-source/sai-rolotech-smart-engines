/**
 * Roll Pass Angle Progression Engine
 * Gemini Pro powered + rule-based fallback
 * Per DIN 6935 forming angle increments
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { openai, aiProvider } from "@workspace/integrations-openai-ai-server";
import { ULTRA_VALIDATION_RULES } from "../lib/validation-rules";

const router: IRouter = Router();

interface BendInput {
  id: string;
  finalAngle: number;
  radius: number;
  type: "right-angle" | "acute" | "obtuse" | "flat";
  side: "left" | "right" | "center";
}

interface StationPass {
  stationNo: number;
  passAngles: { bendId: string; angle: number; delta: number; status: "safe" | "borderline" | "aggressive" }[];
  notes: string;
}

interface PassEngineOutput {
  stations: StationPass[];
  totalStations: number;
  progressionType: "linear" | "progressive" | "soft" | "aggressive";
  strategy: string;
  warnings: string[];
}

const MAX_ANGLES_PER_PASS: Record<string, Record<string, number>> = {
  GI:   { "right-angle": 15, "acute": 10, "obtuse": 18, "flat": 20 },
  CR:   { "right-angle": 15, "acute": 10, "obtuse": 18, "flat": 20 },
  HR:   { "right-angle": 12, "acute":  8, "obtuse": 15, "flat": 18 },
  SS:   { "right-angle":  8, "acute":  6, "obtuse": 10, "flat": 12 },
  AL:   { "right-angle": 14, "acute":  9, "obtuse": 16, "flat": 20 },
  MS:   { "right-angle": 15, "acute": 10, "obtuse": 18, "flat": 20 },
  CU:   { "right-angle": 12, "acute":  8, "obtuse": 14, "flat": 18 },
  TI:   { "right-angle":  6, "acute":  4, "obtuse":  8, "flat": 10 },
  PP:   { "right-angle": 14, "acute":  9, "obtuse": 16, "flat": 18 },
  HSLA: { "right-angle": 10, "acute":  7, "obtuse": 12, "flat": 15 },
};

const SPRINGBACK: Record<string, number> = {
  GI: 1.05, CR: 1.08, HR: 1.12, SS: 1.20, AL: 1.15,
  MS: 1.06, CU: 1.08, TI: 1.25, PP: 1.06, HSLA: 1.14,
};

function generateRuleBasedProgression(
  bends: BendInput[],
  materialType: string,
  stationCount: number,
  progressionType: "linear" | "progressive" | "soft" | "aggressive"
): PassEngineOutput {
  const maxPerPass = MAX_ANGLES_PER_PASS[materialType] ?? MAX_ANGLES_PER_PASS["GI"]!;
  const sbFactor = SPRINGBACK[materialType] ?? 1.05;
  const warnings: string[] = [];

  const targetAngles: Record<string, number> = {};
  for (const b of bends) {
    targetAngles[b.id] = b.finalAngle * sbFactor;
    if (sbFactor > 1.15) {
      warnings.push(`${materialType} has high springback (${sbFactor}×). Target angles increased by ${((sbFactor - 1) * 100).toFixed(0)}% for compensation.`);
    }
  }

  const stations: StationPass[] = [];
  for (let s = 1; s <= stationCount; s++) {
    const progress = s / stationCount;
    let progressFactor: number;

    switch (progressionType) {
      case "linear":      progressFactor = progress; break;
      case "progressive": progressFactor = Math.pow(progress, 0.7); break;
      case "soft":        progressFactor = Math.pow(progress, 1.4); break;
      case "aggressive":  progressFactor = Math.pow(progress, 0.5); break;
      default:            progressFactor = progress;
    }

    const prevProgress = s > 1 ? (function() {
      const pp = (s - 1) / stationCount;
      switch (progressionType) {
        case "linear":      return pp;
        case "progressive": return Math.pow(pp, 0.7);
        case "soft":        return Math.pow(pp, 1.4);
        case "aggressive":  return Math.pow(pp, 0.5);
        default:            return pp;
      }
    })() : 0;

    const passAngles: StationPass["passAngles"] = [];
    for (const b of bends) {
      const target = targetAngles[b.id] ?? b.finalAngle;
      const currentAngle = target * progressFactor;
      const prevAngle = target * prevProgress;
      const delta = currentAngle - prevAngle;
      const maxDelta = maxPerPass[b.type] ?? 12;

      let status: "safe" | "borderline" | "aggressive" = "safe";
      if (delta > maxDelta) {
        status = "aggressive";
        warnings.push(`Station ${s}, Bend ${b.id}: Delta ${delta.toFixed(1)}° exceeds max ${maxDelta}° for ${materialType}/${b.type}`);
      } else if (delta > maxDelta * 0.85) {
        status = "borderline";
      }

      passAngles.push({ bendId: b.id, angle: parseFloat(currentAngle.toFixed(2)), delta: parseFloat(delta.toFixed(2)), status });
    }

    const hasAggressive = passAngles.some(p => p.status === "aggressive");
    const hasBorderline = passAngles.some(p => p.status === "borderline");

    stations.push({
      stationNo: s,
      passAngles,
      notes: s === stationCount
        ? "Calibration / sizing station — final dimension check"
        : hasAggressive ? "WARNING: Aggressive increment — reduce or add station"
        : hasBorderline ? "Borderline — monitor closely during setup"
        : s <= 2 ? "Entry station — gentle forming for strip stability"
        : "",
    });
  }

  const strategy = `${progressionType.charAt(0).toUpperCase() + progressionType.slice(1)} progression for ${materialType} with ${stationCount} stations. ` +
    `Springback compensation: ${((sbFactor - 1) * 100).toFixed(0)}%. ` +
    `Max increment: ${bends.map(b => `${maxPerPass[b.type] ?? 12}° (${b.type})`).join(", ")}.`;

  return { stations, totalStations: stationCount, progressionType, strategy, warnings };
}

function chooseProgressionType(materialType: string, bendCount: number): "linear" | "progressive" | "soft" | "aggressive" {
  if (["TI", "SS"].includes(materialType)) return "soft";
  if (["GI", "CR", "AL"].includes(materialType) && bendCount <= 4) return "aggressive";
  if (bendCount >= 8) return "progressive";
  return "linear";
}

router.post("/roll-pass/generate", async (req: Request, res: Response) => {
  try {
    const {
      materialType = "GI",
      thickness = 1.5,
      yieldStrength = 280,
      springback,
      bends = [] as BendInput[],
      stationCount,
      useAI = true,
    } = req.body as {
      materialType?: string;
      thickness?: number;
      yieldStrength?: number;
      springback?: number;
      bends?: BendInput[];
      stationCount?: number;
      useAI?: boolean;
    };

    if (!Array.isArray(bends) || bends.length === 0) {
      res.status(400).json({ error: "bends array required with at least one bend" });
      return;
    }

    const progressionType = chooseProgressionType(materialType, bends.length);
    const autoStationCount = stationCount ?? Math.max(6, Math.round(bends.length * 2.2));

    if (!useAI || aiProvider === "none") {
      const result = generateRuleBasedProgression(bends, materialType, autoStationCount, progressionType);
      res.json({ ...result, source: "rule-engine" });
      return;
    }

    const systemPrompt = `${ULTRA_VALIDATION_RULES}
You are an expert roll forming engineer with 40 years of experience.
Generate a precise pass angle progression schedule per DIN 6935 standard.
Return ONLY valid JSON matching this structure exactly:
{
  "stations": [{"stationNo": 1, "passAngles": [{"bendId": "B1", "angle": 12.5, "delta": 12.5, "status": "safe"}], "notes": ""}],
  "totalStations": 8,
  "progressionType": "progressive",
  "strategy": "...",
  "warnings": []
}
Status values: "safe" (ok), "borderline" (near max), "aggressive" (exceeds max per DIN 6935).`;

    const userMsg = `Generate roll forming pass progression for:
Material: ${materialType} | Thickness: ${thickness}mm | Yield: ${yieldStrength} MPa | Springback: ${springback ?? SPRINGBACK[materialType] ?? 1.05}×
Bends: ${JSON.stringify(bends)}
Station count: ${autoStationCount}
Max angle per pass per DIN 6935: GI/CR/MS=15°, SS=8°, TI=6°, AL=14°, HSLA=10°
Return ONLY the JSON, no explanation.`;

    let aiResult: string | null = null;
    try {
      if (openai) {
        const response = await openai.chat.completions.create({
          model: "o4-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMsg },
          ],
          max_completion_tokens: 4096,
        });
        aiResult = response.choices?.[0]?.message?.content ?? null;
      }
    } catch {
      aiResult = null;
    }

    if (aiResult) {
      try {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as PassEngineOutput;
          res.json({ ...parsed, source: "o4-mini" });
          return;
        }
      } catch {
        /* fall through to rule engine */
      }
    }

    const fallback = generateRuleBasedProgression(bends, materialType, autoStationCount, progressionType);
    res.json({ ...fallback, source: "rule-engine-fallback" });

  } catch (err) {
    console.error("[roll-pass-engine]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
