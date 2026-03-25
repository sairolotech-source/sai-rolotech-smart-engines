import { Router, type IRouter, type Request, type Response } from "express";
import { openai, aiProvider } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const REVIEW_PROMPT = (codeBundle: string) => `You are a senior code reviewer for "SAI Rolotech Smart Engines" — a Windows Electron desktop app with Express.js API and React frontend.

Review these source files and find ONLY real bugs that would cause:
1. Application hang/freeze on startup (git ops, network timeouts in Electron)
2. Windows build failures (NSIS, native modules, paths)
3. Crash-causing JS/TS errors
4. Security issues (exposed keys, auth bypass)
5. Missing ELECTRON env checks in packaged builds

Respond in this EXACT format (no extra text):

CRITICAL_ISSUES:
- [filename]: [issue]
(or write: none)

WARNINGS:
- [filename]: [warning]
(or write: none)

VERDICT: PASS
REASON: [one sentence why]

OR if critical issues found:

VERDICT: FAIL
REASON: [one sentence why]

Files:
${codeBundle}`;

router.post("/api/ai-review", async (req: Request, res: Response) => {
  try {
    const { files, token } = req.body as {
      files?: { path: string; content: string }[];
      token?: string;
    };

    if (token !== "sai-precheck-2026") {
      res.status(401).json({ ok: false, error: "Invalid precheck token" });
      return;
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ ok: false, error: "files[] required" });
      return;
    }

    if (aiProvider !== "gemini" || !openai) {
      res.status(503).json({ ok: false, error: "Gemini AI not available on this server" });
      return;
    }

    const codeBundle = files
      .map(f => `\n========== FILE: ${f.path} ==========\n${f.content.slice(0, 40000)}`)
      .join("\n");

    const completion = await openai.chat.completions.create({
      model: "gemini-2.5-pro",
      messages: [{ role: "user", content: REVIEW_PROMPT(codeBundle) }],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content ?? "";

    // Parse response
    const verdict = /VERDICT:\s*(PASS|FAIL)/i.exec(text)?.[1]?.toUpperCase() ?? "UNKNOWN";
    const reason  = /REASON:\s*(.+)/i.exec(text)?.[1]?.trim() ?? "";

    const critBlock = /CRITICAL_ISSUES:([\s\S]*?)(?:WARNINGS:|VERDICT:)/i.exec(text)?.[1] ?? "";
    const warnBlock = /WARNINGS:([\s\S]*?)(?:VERDICT:|$)/i.exec(text)?.[1] ?? "";

    const issues = critBlock.split("\n")
      .map(l => l.replace(/^[-•*]\s*/, "").trim())
      .filter(l => l && l.toLowerCase() !== "none");

    const warnings = warnBlock.split("\n")
      .map(l => l.replace(/^[-•*]\s*/, "").trim())
      .filter(l => l && l.toLowerCase() !== "none");

    res.json({ ok: true, verdict, reason, issues, warnings, rawText: text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
