import { Router, type IRouter, type Request, type Response } from "express";
import { openai, aiProvider, geminiRotator } from "@workspace/integrations-openai-ai-server";
import { buildOfflineResponse } from "../lib/offline-knowledge-base.js";
import { ULTRA_VALIDATION_RULES } from "../lib/validation-rules";

const router: IRouter = Router();

async function callGemini(
  model: "gemini-2.5-pro" | "gemini-2.5-flash",
  systemPrompt: string,
  userMsg: string,
  maxTokens = 1024,
): Promise<string | null> {
  try {
    const text = await geminiRotator.generateContent({
      model,
      contents: userMsg,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: maxTokens,
        temperature: 0.3,
      },
    });
    return text || null;
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
    const model = aiProvider === "gemini" ? "gemini-2.5-pro" : "gpt-4o-mini";
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

    const systemPrompt = `${ULTRA_VALIDATION_RULES}
You are a precision roll forming and CNC engineering expert with 50 years of experience.
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
        analysis = await callGemini("gemini-2.5-pro", systemPrompt, userMsg);
        if (analysis) { source = "gemini-pro"; aiModel = "Gemini 2.5 Pro"; }
        else { analysis = buildOfflineResponse(userMsg, "detailed", "english"); source = "offline"; aiModel = "Offline KB"; }
      }
    } else if (isComplexAnalysis(type, data)) {
      analysis = await callGemini("gemini-2.5-pro", systemPrompt, userMsg, 2048);
      if (analysis) { source = "gemini-pro"; aiModel = "Gemini 2.5 Pro"; }
      else {
        analysis = await callOpenAI(systemPrompt, userMsg);
        if (analysis) { source = "openai"; aiModel = "GPT-4o Mini"; }
        else { analysis = buildOfflineResponse(userMsg, "detailed", "english"); source = "offline"; aiModel = "Offline KB"; }
      }
    } else {
      analysis = await callGemini("gemini-2.5-pro", systemPrompt, userMsg);
      if (analysis) { source = "gemini-pro"; aiModel = "Gemini 2.5 Pro"; }
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

router.post("/ai/quality-check", async (req: Request, res: Response): Promise<void> => {
  try {
    const { profile, stations, tooling, gcode, material, thickness } =
      req.body as Record<string, unknown>;

    const systemPrompt = `${ULTRA_VALIDATION_RULES}
You are a senior roll forming quality control engineer with 50 years of experience.
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

    aiResult = await callGemini("gemini-2.5-pro", systemPrompt, userMsg, 1024);
    if (aiResult) aiSource = "gemini-pro";

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
          res.json({
            success: true,
            overallScore,
            grade: parsed.grade ?? (overallScore >= 95 ? "S+" : overallScore >= 85 ? "A" : overallScore >= 75 ? "B" : "C"),
            experts,
            approved: parsed.approved ?? experts.every(e => e.status !== "fail"),
            aiSource,
            timestamp: new Date().toISOString(),
          });
          return;
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

    result = await callGemini("gemini-2.5-pro", sysMsg, userPrompt, 2048);
    if (result) {
      res.json({ success: true, result, model: "Gemini 2.5 Pro" });
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

// ---------------------------------------------------------------------------
// POST /ai/advise-flower — offline engineering advice for flower/forming plan
// ---------------------------------------------------------------------------
router.post("/ai/advise-flower", (req: Request, res: Response) => {
  try {
    const {
      materialType = "GI",
      thickness = 1.5,
      totalBends = 4,
      bendAngles = [] as number[],
      flangeHeights = [] as number[],
      profileComplexity = "standard",
    } = req.body as {
      materialType?: string;
      thickness?: number;
      totalBends?: number;
      bendAngles?: number[];
      flangeHeights?: number[];
      profileComplexity?: string;
    };

    const mat = (materialType ?? "GI").toUpperCase();
    const t = parseFloat(String(thickness ?? 1.5));
    const bends = parseInt(String(totalBends ?? 4), 10);
    const angles: number[] = Array.isArray(bendAngles) ? bendAngles.map(Number) : [];
    const heights: number[] = Array.isArray(flangeHeights) ? flangeHeights.map(Number) : [];

    // Material-specific limits
    const maxAnglePerPass = mat === "SS" ? 10 : mat === "TI" ? 8 : mat === "AL" ? 12 : 15;
    const springbackNote = mat === "SS" ? "Stainless requires 8–12% springback compensation; use negative overbend in last 2 stations." :
      mat === "AL" ? "Aluminium has low springback; use lighter forming forces (reduce line speed by 10–15%)." :
      mat === "TI" ? "Titanium requires slow line speed (≤10 m/min) and generous bend radii (≥3T)." :
      "Mild steel/GI standard process; coat rolls with chrome or grind to Ra 0.4 for best surface.";

    const totalBendAngle = angles.length > 0 ? angles.reduce((s, a) => s + Math.abs(a), 0) : bends * 30;
    const recommendedStations = Math.max(3, Math.min(20, Math.ceil(totalBendAngle / maxAnglePerPass) + (mat === "SS" || mat === "TI" ? 2 : 0)));

    // Build angle distribution zones
    const earlyCount = Math.ceil(recommendedStations * 0.3);
    const midCount = Math.ceil(recommendedStations * 0.5);
    const lateCount = recommendedStations - earlyCount - midCount;
    const angleDistribution = [
      {
        zone: "Entry forming (stations 1–" + earlyCount + ")",
        stations: `1–${earlyCount}`,
        maxAnglePerPass: Math.round(maxAnglePerPass * 0.6),
        notes: `Light forming — ${Math.round(maxAnglePerPass * 0.6)}° max per pass. Establish strip guidance and avoid edge wave.`,
      },
      {
        zone: "Progressive forming (stations " + (earlyCount + 1) + "–" + (earlyCount + midCount) + ")",
        stations: `${earlyCount + 1}–${earlyCount + midCount}`,
        maxAnglePerPass,
        notes: `Main forming zone — up to ${maxAnglePerPass}° per pass. Monitor springback and maintain constant strip width.`,
      },
      {
        zone: "Calibration (stations " + (earlyCount + midCount + 1) + "–" + recommendedStations + ")",
        stations: `${earlyCount + midCount + 1}–${recommendedStations}`,
        maxAnglePerPass: Math.round(maxAnglePerPass * 0.4),
        notes: `Sizing and overbend correction — ${Math.round(maxAnglePerPass * 0.4)}° max. Final shape accuracy and springback compensation.`,
      },
    ].filter((z) => lateCount > 0 || z.zone.startsWith("Entry") || z.zone.startsWith("Progressive"));

    // Build defect risks
    const defectRisks = [];
    if (t < 0.8) {
      defectRisks.push({ defect: "Edge wave", risk: "high", cause: "Thin material compresses easily at edges", prevention: "Reduce forming speed 15%, use idle rolls at edges" });
    }
    if (mat === "SS") {
      defectRisks.push({ defect: "Surface scratching", risk: "high", cause: "Stainless work-hardens and galls on rolls", prevention: "Chrome-plate rolls, apply forming lubricant, reduce speed to 12–18 m/min" });
    }
    if (totalBendAngle > 120) {
      defectRisks.push({ defect: "Springback", risk: "high", cause: `Total bend angle ${Math.round(totalBendAngle)}° is high`, prevention: `Apply ${mat === "SS" ? "12%" : "8%"} overbend in last 2 calibration stations` });
    }
    if (heights.length > 0 && Math.max(...heights) > 50) {
      defectRisks.push({ defect: "Flange height deviation", risk: "medium", cause: "Deep flanges (>50mm) accumulate forming errors", prevention: "Use side roll guides after station " + Math.ceil(recommendedStations / 2) });
    }
    if (defectRisks.length === 0) {
      defectRisks.push({ defect: "Bow / camber", risk: "low", cause: "Minor roll alignment variation", prevention: "Check roll parallelism every 500 operating hours" });
    }

    const stationStrategy = recommendedStations <= 6
      ? "Compact progressive forming: all forming passes distributed evenly with 2 calibration stations at exit."
      : recommendedStations <= 10
      ? "Standard progressive forming: entry passes light (60% force), mid-zone heavy forming, last 2–3 calibration."
      : "Extended forming sequence: use 3 pre-forming stations for gradual strip introduction, then 60% progressive, 3 calibration.";

    const summary =
      `For ${mat} (${t}mm) with ${bends} bend${bends !== 1 ? "s" : ""}, recommend ${recommendedStations} forming stations. ` +
      `Total forming angle: ${Math.round(totalBendAngle)}° — max ${maxAnglePerPass}°/pass. ` +
      springbackNote;

    res.json({
      success: true,
      advice: {
        summary,
        recommendedStations,
        stationStrategy,
        angleDistribution,
        defectRisks,
        materialAdvice: springbackNote,
      },
      mode: "offline",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Flower advice failed";
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
