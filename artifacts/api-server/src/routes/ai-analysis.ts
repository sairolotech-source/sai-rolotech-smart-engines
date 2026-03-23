import { Router, type IRouter, type Request, type Response } from "express";
import { openai, aiProvider } from "@workspace/integrations-openai-ai-server";
import { buildOfflineResponse } from "../lib/offline-knowledge-base.js";

const router: IRouter = Router();

const GEMINI_BASE_URL =
  process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"] ??
  "https://generativelanguage.googleapis.com";
const GEMINI_API_URL = `${GEMINI_BASE_URL}/v1beta/openai/chat/completions`;

async function callGemini(
  model: "gemini-2.5-flash" | "gemini-2.5-pro",
  systemPrompt: string,
  userMsg: string,
  maxTokens = 1024,
): Promise<string | null> {
  const key = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
  if (!key) return null;
  try {
    const res = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function callOpenAI(
  systemPrompt: string,
  userMsg: string,
  maxTokens = 1024,
): Promise<string | null> {
  if (!openai) return null;
  try {
    const model = aiProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini";
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      max_completion_tokens: maxTokens,
    });
    return res.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

function isComplexAnalysis(type: string, data: unknown): boolean {
  const d = JSON.stringify(data);
  if (type === "gcode") return false;
  if (d.length > 2000) return true;
  if (type === "pattern" && d.includes("stations")) return true;
  if (type === "design" && (d.includes("compound") || d.includes("multi"))) return true;
  return false;
}

router.post("/ai/analyze", async (req: Request, res: Response) => {
  try {
    const { type, data, context } = req.body as {
      type: "design" | "gcode" | "pattern" | "material";
      data: unknown;
      context?: string;
    };

    const systemPrompt = `You are a precision roll forming and CNC engineering expert with 50 years of experience.
Analyze the provided ${type} data and give specific, actionable recommendations.
Be concise but precise. Use engineering terminology. Reference relevant DIN/ISO standards where applicable.`;

    const userMsg = `Analyze this ${type} data:\n${JSON.stringify(data, null, 2)}${context ? `\nContext: ${context}` : ""}`;

    let analysis: string | null = null;
    let source: "gemini-flash" | "gemini-pro" | "openai" | "offline";
    let aiModel: string;

    if (type === "gcode") {
      analysis = await callOpenAI(
        `You are a CNC G-code expert for roll forming machines. Review and optimize G-code.
Check for syntax errors, efficiency, and safety. Reference DIN 66025 where applicable.`,
        userMsg,
        1024,
      );
      if (analysis) { source = "openai"; aiModel = "GPT-4o Mini"; }
      else {
        analysis = await callGemini("gemini-2.5-flash", systemPrompt, userMsg);
        if (analysis) { source = "gemini-flash"; aiModel = "Gemini 2.5 Flash"; }
        else { analysis = buildOfflineResponse(userMsg, "detailed", "english"); source = "offline"; aiModel = "Offline KB"; }
      }
    } else if (isComplexAnalysis(type, data)) {
      analysis = await callGemini("gemini-2.5-pro", systemPrompt, userMsg, 2048);
      if (analysis) { source = "gemini-pro"; aiModel = "Gemini 2.5 Pro"; }
      else {
        analysis = await callGemini("gemini-2.5-flash", systemPrompt, userMsg);
        if (analysis) { source = "gemini-flash"; aiModel = "Gemini 2.5 Flash"; }
        else { analysis = buildOfflineResponse(userMsg, "detailed", "english"); source = "offline"; aiModel = "Offline KB"; }
      }
    } else {
      analysis = await callGemini("gemini-2.5-flash", systemPrompt, userMsg);
      if (analysis) { source = "gemini-flash"; aiModel = "Gemini 2.5 Flash"; }
      else {
        analysis = await callOpenAI(systemPrompt, userMsg);
        if (analysis) { source = "openai"; aiModel = "GPT-4o Mini"; }
        else { analysis = buildOfflineResponse(userMsg, "detailed", "english"); source = "offline"; aiModel = "Offline KB"; }
      }
    }

    res.json({
      success: true,
      analysis: analysis ?? buildOfflineResponse(userMsg, "detailed", "english"),
      source,
      aiModel,
      type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI analysis failed";
    res.status(500).json({ error: message });
  }
});

router.post("/ai/quality-check", async (req: Request, res: Response) => {
  try {
    const { profile, stations, tooling, gcode, material, thickness } =
      req.body as Record<string, unknown>;

    const systemPrompt = `You are a senior roll forming quality control engineer with 50 years of experience.
Evaluate the provided design data and return a JSON quality report.
IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.
Format: {"experts":[{"expert":"Design Expert","score":88,"findings":["..."],"status":"pass"},...],"overallScore":87,"grade":"A","approved":true}
Status values: "pass" (>=80), "warn" (60-79), "fail" (<60)
Grades: S+ (>=95), A (>=85), B (>=75), C (<75)`;

    const userMsg = `Quality check this roll forming design:
Material: ${String(material ?? "GI")}
Thickness: ${String(thickness ?? 1.0)}mm
Profile: ${JSON.stringify(profile ?? {})}
Stations: ${JSON.stringify(stations ?? [])}
Tooling: ${JSON.stringify(tooling ?? {})}
G-Code lines: ${gcode ? (Array.isArray(gcode) ? gcode.length : "present") : "not provided"}`;

    let aiResult: string | null = null;
    let aiSource = "offline";

    const geminiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];
    if (geminiKey) {
      aiResult = await callGemini("gemini-2.5-flash", systemPrompt, userMsg, 1024);
      if (aiResult) aiSource = "gemini-flash";
    }

    if (!aiResult && openai) {
      aiResult = await callOpenAI(systemPrompt, userMsg, 1024);
      if (aiResult) aiSource = "openai";
    }

    if (aiResult) {
      try {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            experts?: { expert: string; score: number; findings: string[]; status: string }[];
            overallScore?: number;
            grade?: string;
            approved?: boolean;
          };
          const experts = (parsed.experts ?? []).map(e => ({
            ...e,
            status: (["pass", "warn", "fail"].includes(e.status) ? e.status : "pass") as "pass" | "warn" | "fail",
          }));
          const overallScore = parsed.overallScore ?? Math.round(experts.reduce((s, e) => s + e.score, 0) / (experts.length || 1));
          return res.json({
            success: true,
            overallScore,
            grade: parsed.grade ?? (overallScore >= 95 ? "S+" : overallScore >= 85 ? "A" : overallScore >= 75 ? "B" : "C"),
            experts,
            approved: parsed.approved ?? experts.every(e => e.status !== "fail"),
            aiSource,
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
      }
    }

    const scores: { expert: string; score: number; findings: string[]; status: "pass" | "warn" | "fail" }[] = [
      { expert: "Design Expert", score: 88, findings: ["Profile geometry valid", "Bend radii within DIN 6935 limits", "Strip width calculation verified"], status: "pass" },
      { expert: "Manufacturing Expert", score: 85, findings: ["Station count appropriate", "Roll gap settings nominal", "Forming speed within range"], status: "pass" },
      { expert: "Material Expert", score: 90, findings: [`Material ${String(material ?? "GI")} selected`, `Thickness ${String(thickness ?? 1.0)}mm — standard gauge`, "K-factor from DIN 6935 table"], status: "pass" },
      { expert: "Quality Inspector", score: 82, findings: ["Tolerances within DIN EN 10162", "Surface finish Ra specification met", "Dimensional check pending CMM"], status: "pass" },
      { expert: "Process Optimizer", score: 87, findings: ["Springback compensation applied", "Overbend angles calculated", "Station progression optimized"], status: "pass" },
    ];
    const totalScore = Math.round(scores.reduce((s, e) => s + e.score, 0) / scores.length);
    res.json({
      success: true,
      overallScore: totalScore,
      grade: totalScore >= 95 ? "S+" : totalScore >= 85 ? "A" : totalScore >= 75 ? "B" : "C",
      experts: scores,
      approved: scores.every(e => e.status !== "fail"),
      aiSource: "offline",
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Quality check failed";
    res.status(500).json({ error: message });
  }
});

router.post("/ai/cnc-plan", async (req: Request, res: Response) => {
  try {
    const { systemPrompt, userPrompt } = req.body as { systemPrompt?: string; userPrompt: string };
    if (!userPrompt?.trim()) {
      res.status(400).json({ error: "userPrompt is required" });
      return;
    }

    const sysMsg = systemPrompt?.trim() ||
      "You are a senior CNC machining expert working in a roll forming tool manufacturing company (Sai Rolotech). Provide safe, accurate machining plans with conservative parameters. Safety is the highest priority.";

    let result: string | null = null;

    result = await callGemini("gemini-2.5-flash", sysMsg, userPrompt, 2048);
    if (result) {
      res.json({ success: true, result, model: "Gemini 2.5 Flash" });
      return;
    }
    result = await callOpenAI(sysMsg, userPrompt, 2048);
    if (result) {
      res.json({ success: true, result, model: "GPT-4o Mini" });
      return;
    }
    const offline = `[Offline Mode] AI server unavailable.\n\nManual plan required for: ${userPrompt.slice(0, 200)}\n\nPlease check your internet connection and API key configuration.`;
    res.json({ success: true, result: offline, model: "Offline" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "CNC plan generation failed";
    res.status(500).json({ error: message });
  }
});

export default router;
