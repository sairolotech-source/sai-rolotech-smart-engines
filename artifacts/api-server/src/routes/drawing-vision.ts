import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const GEMINI_BASE_URL =
  process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] ??
  "https://generativelanguage.googleapis.com";

async function analyzeDrawingWithGeminiPro(
  imageBase64: string,
  mimeType: string,
  userQuestion: string,
): Promise<{ analysis: string; extractedData: Record<string, unknown> }> {
  const key = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  if (!key) throw new Error("Gemini API key not configured");

  const systemInstruction = `You are a senior roll forming and CNC engineering expert with 50 years of experience.
You specialize in reading technical engineering drawings, DXF profiles, and manufacturing blueprints.
When analyzing drawings, extract:
1. Profile dimensions (width, height, flange lengths, web height)
2. Bend angles (in degrees)
3. Inner bend radii
4. Material thickness
5. Tolerances (if shown)
6. Surface finish requirements
7. Any notes or annotations
8. Profile type (C-channel, Z-section, U-channel, hat section, etc.)
Always respond in structured format with clear sections.`;

  const prompt = userQuestion || `Analyze this engineering drawing and extract all technical specifications:
- Profile type and name
- All dimensions (mm)
- Bend angles (degrees)
- Inner radii (mm)
- Material thickness (mm)
- Tolerances
- Any special notes
Also identify: is this suitable for roll forming? How many stations approximately needed?`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(
    `${GEMINI_BASE_URL}/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Pro Vision error: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const extractedData: Record<string, unknown> = {};

  const thicknessMatch = text.match(/thickness[:\s]+([0-9.]+)\s*mm/i);
  if (thicknessMatch) extractedData["thickness"] = parseFloat(thicknessMatch[1]!);

  const angleMatches = text.matchAll(/(\d+(?:\.\d+)?)\s*°/g);
  const angles: number[] = [];
  for (const m of angleMatches) angles.push(parseFloat(m[1]!));
  if (angles.length > 0) extractedData["bendAngles"] = angles;

  const profileMatch = text.match(/(C-channel|Z-section|U-channel|hat section|angle|omega|sigma)/i);
  if (profileMatch) extractedData["profileType"] = profileMatch[1];

  const stationsMatch = text.match(/(\d+)\s*station/i);
  if (stationsMatch) extractedData["estimatedStations"] = parseInt(stationsMatch[1]!);

  return { analysis: text, extractedData };
}

router.post("/drawing-vision/analyze", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const key = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
    if (!key) {
      res.status(503).json({ error: "Gemini API key not set. Please add AI_INTEGRATIONS_GEMINI_API_KEY to secrets." });
      return;
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    const { question } = req.body as { question?: string };

    if (!file) {
      res.status(400).json({ error: "No image file uploaded" });
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      res.status(400).json({ error: "Only JPG, PNG, WebP, GIF images supported" });
      return;
    }

    const imageBase64 = file.buffer.toString("base64");
    const result = await analyzeDrawingWithGeminiPro(imageBase64, file.mimetype, question ?? "");

    res.json({
      success: true,
      analysis: result.analysis,
      extractedData: result.extractedData,
      model: "Gemini 2.5 Pro Vision",
      filename: file.originalname,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Drawing analysis failed";
    res.status(500).json({ error: message });
  }
});

router.post("/drawing-vision/analyze-url", async (req: Request, res: Response) => {
  try {
    const key = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
    if (!key) {
      res.status(503).json({ error: "Gemini API key not set" });
      return;
    }

    const { imageUrl, question } = req.body as { imageUrl?: string; question?: string };
    if (!imageUrl) {
      res.status(400).json({ error: "imageUrl required" });
      return;
    }

    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) {
      res.status(400).json({ error: "Could not fetch image from URL" });
      return;
    }

    const buffer = await imgRes.arrayBuffer();
    const imageBase64 = Buffer.from(buffer).toString("base64");
    const mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const result = await analyzeDrawingWithGeminiPro(imageBase64, mimeType, question ?? "");

    res.json({
      success: true,
      analysis: result.analysis,
      extractedData: result.extractedData,
      model: "Gemini 2.5 Pro Vision",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Drawing URL analysis failed";
    res.status(500).json({ error: message });
  }
});

export default router;
