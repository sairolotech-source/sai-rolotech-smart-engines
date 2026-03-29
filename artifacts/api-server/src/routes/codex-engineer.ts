import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are **Codex Engineer** — a specialist AI for roll forming machine design, embedded inside the SAI Rolotech Smart Engines v2.2+ platform.

## Your expertise:
- Roll forming pass sequence design (station layout, angle progression)
- Neutral-axis bend allowance: BA = (π/2) × (R + t/2)
- Flat strip width calculation from profile geometry
- Roll contour design: upper roll OD, lower roll OD, groove depth, roll gap
- Flower pattern (per-station cross-section geometry in 2D)
- Material behavior: GI, CR, HR, SS, AL, HSLA (yield strength, springback)
- Forming force estimation: F = (UTS × t² × w) / (2 × R) per station
- Springback correction: ΔR = 1 − (R × Fy) / (E × t)
- Roll tooling: groove radius, contact angle, roll face width
- Python (shapely, numpy) and TypeScript engineering code

## Platform context:
- 29-engine Python pipeline running FastAPI on port 9000
- Key engines: profile_analysis, station_engine, roll_contour_engine, flower_svg_engine, roll_groove_svg_engine, simulation_engine, ai_optimizer_engine
- React/Vite frontend (port 5000), Node/Express API (port 8080)
- 3D simulation: @react-three/fiber v9.5.0

## Response style:
- Be direct and precise — give numbers, formulas, code
- Use Markdown: headers, bullet points, code blocks
- Mix English and Hindi naturally when the user does (Hinglish is fine)
- For code: prefer Python with shapely/numpy
- Always show the formula before the calculation
- Keep responses concise unless deep analysis is requested

## Current pipeline formula (confirmed correct):
Flat strip width (C 60×40, GI 1.5mm, R=2mm):
  BA = (π/2)(2 + 1.5/2) × 2 bends = 4×4.36 = 147.07mm  ← NOT K-factor

When given pipeline context, analyze it and give actionable engineering insights.`;

router.post("/codex-engineer", async (req: Request, res: Response) => {
  const { question, context } = req.body as {
    question?: string;
    context?: Record<string, unknown>;
  };

  if (!question?.trim()) {
    res.status(400).json({ error: "question required" });
    return;
  }

  if (!openai) {
    res.status(503).json({ error: "OpenRouter / Codex not configured" });
    return;
  }

  // Build user message with optional pipeline context
  let userMsg = question.trim();
  if (context && Object.keys(context).length > 0) {
    const ctxStr = JSON.stringify(context, null, 2);
    userMsg = `## Current Pipeline Context:\n\`\`\`json\n${ctxStr}\n\`\`\`\n\n## Question:\n${userMsg}`;
  }

  // ── Streaming SSE ─────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (data: string) => {
    res.write(`data: ${JSON.stringify({ text: data })}\n\n`);
  };
  const done = () => {
    res.write("data: [DONE]\n\n");
    res.end();
  };

  try {
    const stream = await openai.chat.completions.create({
      model: "o4-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMsg },
      ],
      stream: true,
      max_completion_tokens: 2048,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) send(delta);
    }
    done();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stream error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

// Non-streaming fallback (for contexts where SSE is blocked)
router.post("/codex-engineer/sync", async (req: Request, res: Response) => {
  const { question, context } = req.body as {
    question?: string;
    context?: Record<string, unknown>;
  };

  if (!question?.trim()) {
    res.status(400).json({ error: "question required" });
    return;
  }

  if (!openai) {
    res.status(503).json({ error: "OpenRouter / Codex not configured" });
    return;
  }

  let userMsg = question.trim();
  if (context && Object.keys(context).length > 0) {
    userMsg = `## Current Pipeline Context:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\n## Question:\n${userMsg}`;
  }

  try {
    const res2 = await openai.chat.completions.create({
      model: "o4-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMsg },
      ],
      max_completion_tokens: 2048,
    });
    res.json({ answer: res2.choices?.[0]?.message?.content ?? "" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Codex error";
    res.status(500).json({ error: msg });
  }
});

export default router;
