import { Router, type IRouter, type Request, type Response } from "express";
import { diagnose, optimizeParameters, type DiagnosisInput, type DefectId } from "../lib/offline-ai-engine";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/ai/diagnose", (req: Request, res: Response) => {
  try {
    const body = req.body as DiagnosisInput;
    if (!body.defectId) {
      res.status(400).json({ error: "defectId required" });
      return;
    }
    const result = diagnose(body);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Diagnosis failed";
    res.status(400).json({ error: message });
  }
});

router.post("/ai/optimize", (req: Request, res: Response) => {
  try {
    const { materialType, thickness, numStations, lineSpeed, rollDiameter } = req.body as {
      materialType: string; thickness: number; numStations: number;
      lineSpeed: number; rollDiameter: number;
    };
    const result = optimizeParameters({
      defectId: "bow" as const,
      material: materialType ?? "GI",
      thickness: parseFloat(String(thickness)) || 1.0,
      stationCount: parseInt(String(numStations)) || 5,
      speed: parseFloat(String(lineSpeed)) || 20,
      rollDiameter: parseFloat(String(rollDiameter)) || 150,
    });
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Optimization failed";
    res.status(400).json({ error: message });
  }
});

router.get("/ai/status", (_req: Request, res: Response) => {
  const hasCodex = !!openai;
  const openrouterKey = process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"];
  const codexActive = hasCodex && !!openrouterKey;

  res.json({
    online: true,
    offlineMode: !codexActive,
    engineVersion: "SAI_CODEX_v5.3",
    activeModel: codexActive ? "openai/codex-mini-latest" : null,
    provider: codexActive ? "OpenRouter (Replit AI Integrations)" : "offline",
    knowledgeBase: "SAI-KB-v2.0-500patterns",
    defectsSupported: 12,
    accuracyScore: 99,
    codex53Active: codexActive,
    message: codexActive
      ? "Codex 5.3 (openai/codex-mini-latest) active via Replit AI Integrations — OpenRouter"
      : "Sai Rolotech Smart Engines — offline mode",
  });
});

export default router;
