/**
 * SAI Rolotech — Deep Verify API Route
 * POST /api/deep-verify — Runs offline formula engine + Gemini
 * to cross-check any flower/roll calculation before it reaches
 * the user. Returns AccuracyReport with corrections + 98% target.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import {
  verifyFlowerPattern,
  verifyRollTooling,
  runGeminiVerification,
  buildAccuracyReport,
  type FlowerVerifyInput,
  type RollVerifyInput,
  type GeminiVerifyPayload,
} from "../lib/deep-accuracy-engine";

const router: IRouter = Router();

interface PersonalKey { id: string; key: string; label: string }

router.post("/deep-verify", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const {
      mode = "flower",
      flower,
      roll,
      personalGeminiKeys = [],
      personalDeepseekKey,
    } = req.body as {
      mode?: "flower" | "roll" | "both";
      flower?: FlowerVerifyInput;
      roll?: RollVerifyInput;
      personalGeminiKeys?: PersonalKey[];
      personalDeepseekKey?: string;
    };

    let allChecks: ReturnType<typeof verifyFlowerPattern>["checks"] = [];
    let allCorrections: ReturnType<typeof verifyFlowerPattern>["autoCorrections"] = [];
    let allRecs: string[] = [];

    if ((mode === "flower" || mode === "both") && flower) {
      const fr = verifyFlowerPattern(flower);
      allChecks = [...allChecks, ...fr.checks];
      allCorrections = [...allCorrections, ...fr.autoCorrections];
      allRecs = [...allRecs, ...fr.recommendations];
    }

    if ((mode === "roll" || mode === "both") && roll) {
      const rr = verifyRollTooling(roll);
      allChecks = [...allChecks, ...rr.checks];
      allCorrections = [...allCorrections, ...rr.autoCorrections];
      allRecs = [...allRecs, ...rr.recommendations];
    }

    if (allChecks.length === 0) {
      res.status(400).json({ ok: false, error: "No verifiable data provided. Send flower{} or roll{} payload." });
      return;
    }

    const keys = Array.isArray(personalGeminiKeys) ? personalGeminiKeys : [];
    const dsKey = typeof personalDeepseekKey === "string" && personalDeepseekKey ? personalDeepseekKey : undefined;

    const geminiPayload: GeminiVerifyPayload = {
      materialType: flower?.materialType ?? roll?.materialType ?? "GI",
      thickness: flower?.thickness ?? roll?.thickness ?? 1.5,
      numStations: flower?.numStations ?? 1,
      offlineResults: allChecks,
      personalGeminiKeys: keys,
      personalDeepseekKey: dsKey,
    };

    let geminiResult: Awaited<ReturnType<typeof runGeminiVerification>>;
    if (keys.length > 0 || dsKey) {
      geminiResult = await runGeminiVerification(geminiPayload);
    } else {
      geminiResult = { verified: false, discrepancies: [], geminiAccuracyScore: 0 };
    }

    const report = buildAccuracyReport(allChecks, allCorrections, allRecs, geminiResult, Date.now() - t0);
    console.log(`[deep-verify] mode=${mode} checks=${report.checksRun} accuracy=${report.overallAccuracy}% grade=${report.grade} gemini=${report.geminiVerified} time=${report.processingTimeMs}ms`);

    res.json({ ok: true, report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[deep-verify] Error:", msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
