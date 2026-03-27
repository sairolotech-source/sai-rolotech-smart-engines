import { Router } from "express";
import { geminiRotator } from "@workspace/integrations-openai-ai-server";

const router = Router();

// GET /api/gemini-keys/status — check all key statuses
router.get("/status", (_req, res) => {
  res.json({
    totalKeys: geminiRotator.totalKeys,
    activeKeys: geminiRotator.activeKeys,
    model: "gemini-2.5-pro",
    keys: geminiRotator.getStatus(),
  });
});

// POST /api/gemini-keys/test — test current active key
router.post("/test", async (_req, res) => {
  try {
    const result = await geminiRotator.generateContent({
      model: "gemini-2.5-pro",
      contents: "Say 'SAI Rolotech key working!' in exactly 5 words.",
    });
    res.json({ success: true, response: result, activeKeys: geminiRotator.activeKeys });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
