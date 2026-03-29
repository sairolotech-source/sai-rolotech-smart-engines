import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { geminiRotator } from "@workspace/integrations-openai-ai-server";
import { SAI_CONFIDENTIALITY_RULES } from "../lib/ai-confidentiality";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const GEMINI_BASE_URL =
  process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] ??
  "https://generativelanguage.googleapis.com";
const PYTHON_API = "http://localhost:9000/api";

const DRAWING_SYSTEM = `You are a senior roll forming and CNC engineering expert with 50 years of experience.
You specialize in reading technical engineering drawings, DXF profiles, and manufacturing blueprints.
When analyzing drawings, extract:
1. Profile dimensions — width (mm), height (mm), flange lengths (mm), web height (mm)
2. Bend angles (degrees) — list each bend
3. Inner bend radii (mm)
4. Material thickness (mm)
5. Tolerances (if shown)
6. Surface finish requirements
7. Any text annotations or notes in the drawing
8. Profile type — C-channel, Z-section, U-channel, hat section, angle, sigma, omega, etc.
Always respond in structured format with clear numbered sections.
${SAI_CONFIDENTIALITY_RULES}`;

const DRAWING_PROMPT = `Analyze this engineering drawing and extract all technical specifications:
## 1. Profile Type
## 2. Dimensions (mm)
   - Total width:
   - Total height:
   - Flange 1 length:
   - Flange 2 length:
   - Web height:
## 3. Bend Angles (°)
## 4. Inner Radii (mm)
## 5. Material Thickness (mm)
## 6. Tolerances
## 7. Roll Forming Assessment
   - Suitable for roll forming: Yes/No
   - Estimated stations needed:
   - Recommended material grades:
## 8. Special Notes`;

async function callGeminiVision(
  imageBase64: string,
  mimeType: string,
  question: string,
): Promise<string> {
  const key = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  if (!key) throw new Error("Gemini API key not set — please add AI_INTEGRATIONS_GEMINI_API_KEY to Secrets");

  const prompt = question.trim() || DRAWING_PROMPT;
  const body = {
    system_instruction: { parts: [{ text: DRAWING_SYSTEM }] },
    contents: [{
      role: "user",
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  };

  const res = await fetch(
    `${GEMINI_BASE_URL}/v1beta/models/gemini-2.5-pro:generateContent?key=${key}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Vision error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGeminiText(userMsg: string, question: string): Promise<string> {
  try {
    const text = await geminiRotator.generateContent({
      model: "gemini-2.5-flash",
      contents: `${question.trim() || DRAWING_PROMPT}\n\nDXF Profile Data:\n${userMsg}`,
      config: { systemInstruction: DRAWING_SYSTEM, maxOutputTokens: 2048, temperature: 0.1 },
    });
    return text ?? "";
  } catch {
    const key = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
    if (!key) throw new Error("Gemini API key not set");
    const body = {
      system_instruction: { parts: [{ text: DRAWING_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `${question.trim() || DRAWING_PROMPT}\n\nDXF Profile Data:\n${userMsg}` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    };
    const res = await fetch(
      `${GEMINI_BASE_URL}/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) },
    );
    if (!res.ok) throw new Error(`Gemini text error: ${res.status}`);
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
}

function extractDimensions(text: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const thicknessMatch = text.match(/thickness[:\s*]+([0-9.]+)\s*mm/i);
  if (thicknessMatch) data["thickness"] = parseFloat(thicknessMatch[1]!);
  const widthMatch = text.match(/(?:total\s+)?width[:\s*]+([0-9.]+)\s*mm/i);
  if (widthMatch) data["width"] = parseFloat(widthMatch[1]!);
  const heightMatch = text.match(/(?:total\s+)?height[:\s*]+([0-9.]+)\s*mm/i);
  if (heightMatch) data["height"] = parseFloat(heightMatch[1]!);
  const angles: number[] = [];
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*°/g)) angles.push(parseFloat(m[1]!));
  if (angles.length) data["bendAngles"] = angles;
  const profileMatch = text.match(/(C-channel|Z-section|U-channel|hat\s+section|angle|omega|sigma|lip\s+channel|roll\s+formed)/i);
  if (profileMatch) data["profileType"] = profileMatch[1];
  const stationsMatch = text.match(/(\d+)\s*station/i);
  if (stationsMatch) data["estimatedStations"] = parseInt(stationsMatch[1]!);
  const radiiMatch = text.match(/(?:inner\s+)?radi(?:us|i)[:\s*]+([0-9.]+)\s*mm/i);
  if (radiiMatch) data["innerRadius"] = parseFloat(radiiMatch[1]!);
  return data;
}

router.post("/drawing-vision/analyze", upload.single("image"), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const { question } = req.body as { question?: string };

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const allowedImages = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const isImage = allowedImages.includes(file.mimetype);
    const isDxf = file.originalname.toLowerCase().endsWith(".dxf") ||
      file.mimetype === "application/dxf" ||
      file.mimetype === "application/octet-stream";

    if (!isImage && !isDxf) {
      res.status(400).json({ error: "Only JPG, PNG, WebP, GIF images or DXF CAD files supported" });
      return;
    }

    let analysis = "";
    let model = "";

    if (isImage) {
      const imageBase64 = file.buffer.toString("base64");
      analysis = await callGeminiVision(imageBase64, file.mimetype, question ?? "");
      model = "Gemini 2.5 Pro Vision";
    } else {
      const form = new FormData();
      const blob = new Blob([file.buffer], { type: "application/octet-stream" });
      form.append("file", blob, file.originalname);

      const pyRes = await fetch(`${PYTHON_API}/preview-dxf`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(20000),
      });

      if (!pyRes.ok) {
        const errTxt = await pyRes.text();
        throw new Error(`Python DXF parse failed: ${pyRes.status} — ${errTxt.slice(0, 200)}`);
      }

      const pyData = await pyRes.json() as Record<string, unknown>;

      if (pyData["status"] === "fail") {
        throw new Error(`DXF parse error: ${JSON.stringify(pyData["stage"] ?? pyData).slice(0, 200)}`);
      }

      const profileResult = (pyData["profile_analysis_engine"] ?? {}) as Record<string, unknown>;
      const entitySummary = (pyData["entity_summary"] ?? {}) as Record<string, unknown>;

      const dxfText = `
DXF File: ${file.originalname}
Entities: ${JSON.stringify(entitySummary)}
Profile Analysis:
  - Section width: ${profileResult["section_width_mm"] ?? "N/A"} mm
  - Section height: ${profileResult["section_height_mm"] ?? "N/A"} mm
  - Profile type detected: ${profileResult["profile_type"] ?? "N/A"}
  - Bend count: ${profileResult["bend_count"] ?? "N/A"}
  - Total bend angle: ${profileResult["total_bend_angle_deg"] ?? "N/A"} degrees
  - Detected bend angles: ${JSON.stringify(profileResult["bend_angles_deg"] ?? [])}
  - Flange lengths: ${JSON.stringify(profileResult["flange_lengths_mm"] ?? [])}
  - Web height: ${profileResult["web_height_mm"] ?? "N/A"} mm
  - Symmetry: ${profileResult["is_symmetric"] ?? "N/A"}
  - Raw profile points: ${JSON.stringify((profileResult["profile_points"] ?? []).slice(0, 20))}
`.trim();

      analysis = await callGeminiText(dxfText, question ?? "");
      model = "Gemini 2.5 Flash (DXF Text Analysis)";
    }

    const extractedData = extractDimensions(analysis);

    res.json({
      success: true,
      analysis,
      extractedData,
      model,
      filename: file.originalname,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
      fileType: isImage ? "image" : "dxf",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Drawing analysis failed";
    res.status(500).json({ error: message, success: false });
  }
});

router.post("/drawing-vision/analyze-url", async (req: Request, res: Response) => {
  try {
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
    const analysis = await callGeminiVision(imageBase64, mimeType, question ?? "");
    const extractedData = extractDimensions(analysis);

    res.json({ success: true, analysis, extractedData, model: "Gemini 2.5 Pro Vision" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Drawing URL analysis failed";
    res.status(500).json({ error: message, success: false });
  }
});

export default router;
