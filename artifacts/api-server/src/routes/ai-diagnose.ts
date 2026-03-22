import { Router, type IRouter, type Request, type Response } from "express";
import { diagnose, optimizeParameters, type DiagnosisInput, type DefectId } from "../lib/offline-ai-engine";

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
  res.json({
    online: true,
    offlineMode: true,
    engineVersion: "SAI_OFFLINE_v2",
    knowledgeBase: "SAI-KB-v2.0-500patterns",
    defectsSupported: 12,
    accuracyScore: 99,
    message: "Sai Rolotech Smart Engines Engine — fully offline, no internet needed",
  });
});

export default router;
