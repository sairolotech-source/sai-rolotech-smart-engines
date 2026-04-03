/**
 * SAI Rolotech Smart Engines — AI Pre-Build Code Reviewer
 *
 * Priority:
 *   1. Replit server (Gemini — Replit ke credits, koi key nahi chahiye)
 *   2. Client ki apni Gemini key (optional fallback)
 *   3. Client ki apni DeepSeek key (optional fallback)
 *   4. Sab fail → skip karo, build chalne do
 */

"use strict";
const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");

// ── ANSI Colors ───────────────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  bold:   "\x1b[1m",
  white:  "\x1b[37m",
  blue:   "\x1b[34m",
};
const p = (color, msg) => process.stdout.write(color + msg + C.reset + "\n");
const pass  = msg => p(C.green,        "  [PASS] " + msg);
const fail  = msg => p(C.red,          "  [FAIL] " + msg);
const warn  = msg => p(C.yellow,       "  [WARN] " + msg);
const info  = msg => p(C.cyan,         "  [INFO] " + msg);
const title = msg => p(C.bold+C.white, "\n  ── " + msg + " ──");

// ── Config ────────────────────────────────────────────────────────────────────
const ROOT       = path.resolve(__dirname, "..", "..");
const configPath = path.join(__dirname, "ai-review-config.json");
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(configPath, "utf8")); }
catch { warn("ai-review-config.json nahi mila — defaults use kar raha hai"); }

const REPLIT_URL   = (cfg.replit?.serverUrl  || "").replace(/\/$/, "");
const REPLIT_TOKEN = cfg.replit?.token       || "sai-precheck-2026";
const GEMINI_KEY   = cfg.gemini?.apiKey      || "";
const GEMINI_MODEL = cfg.gemini?.model       || "gemini-2.5-pro";
const DS_KEY       = cfg.deepseek?.apiKey    || "";
const DS_MODEL     = cfg.deepseek?.model     || "deepseek-chat";
const MAX_KB       = cfg.review?.maxFileSizeKB || 50;
const SKIP_ALL     = cfg.review?.skipOnAllFail !== false;

// ── CLI flags ─────────────────────────────────────────────────────────────────
const ONLY_GEMINI   = process.argv.includes("--only-gemini");
const ONLY_DEEPSEEK = process.argv.includes("--only-deepseek");
const ONLY_REPLIT   = process.argv.includes("--only-replit");

// ── Files to review ───────────────────────────────────────────────────────────
const FILES = [
  "artifacts/api-server/src/routes/github-update.ts",
  "artifacts/api-server/src/index.ts",
  "artifacts/desktop/src/main.ts",
  "artifacts/api-server/src/routes/ai-chat.ts",
  "package.json",
  "artifacts/desktop/package.json",
];

function readFile(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, "utf8");
  return raw.length > MAX_KB * 1024
    ? raw.slice(0, MAX_KB * 1024) + "\n\n[...truncated at " + MAX_KB + "KB...]"
    : raw;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpPost(urlStr, headers, body, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const url  = new URL(urlStr);
    const mod  = url.protocol === "https:" ? https : http;
    const data = JSON.stringify(body);
    const req  = mod.request({
      hostname: url.hostname,
      port:     url.port || (url.protocol === "https:" ? 443 : 80),
      path:     url.pathname + url.search,
      method:   "POST",
      headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers },
      timeout:  timeoutMs,
    }, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(data);
    req.end();
  });
}

// ── Prompt ────────────────────────────────────────────────────────────────────
function makePrompt(bundle) {
  return `You are a senior code reviewer for "SAI Rolotech Smart Engines" (Windows Electron + Express.js + React).

Find ONLY real bugs causing:
1. Startup hang/freeze (git ops without ELECTRON check, network timeouts)
2. Windows build failures (NSIS, native modules, paths)
3. Crash-level JS/TS errors
4. Security issues (exposed keys, auth bypass)

Respond EXACTLY:

CRITICAL_ISSUES:
- [file]: [issue]
(or: none)

WARNINGS:
- [file]: [warning]
(or: none)

VERDICT: PASS
REASON: [one line]

FILES:
${bundle}`;
}

// ── Parse AI text ─────────────────────────────────────────────────────────────
function parse(text, src) {
  const verdict  = /VERDICT:\s*(PASS|FAIL)/i.exec(text)?.[1]?.toUpperCase() ?? "UNKNOWN";
  const reason   = /REASON:\s*(.+)/i.exec(text)?.[1]?.trim() ?? "";
  const critBlk  = /CRITICAL_ISSUES:([\s\S]*?)(?:WARNINGS:|VERDICT:)/i.exec(text)?.[1] ?? "";
  const warnBlk  = /WARNINGS:([\s\S]*?)(?:VERDICT:|$)/i.exec(text)?.[1] ?? "";
  const issues   = critBlk.split("\n").map(l=>l.replace(/^[-•*]\s*/,"").trim()).filter(l=>l&&l.toLowerCase()!=="none");
  const warnings = warnBlk.split("\n").map(l=>l.replace(/^[-•*]\s*/,"").trim()).filter(l=>l&&l.toLowerCase()!=="none");
  return { src, verdict, reason, issues, warnings };
}

// ── Print result ──────────────────────────────────────────────────────────────
function printResult(r) {
  const ok = r.verdict === "PASS";
  p(ok ? C.green+C.bold : C.red+C.bold, `\n  ┌── ${r.src}: ${r.verdict} ${"─".repeat(30)}`);
  if (r.reason) info("Reason  : " + r.reason);
  if (r.issues.length)   { p(C.red,    "  Critical:"); r.issues.forEach(i => p(C.red,    "    ✗ " + i)); }
  else                     pass("No critical issues");
  if (r.warnings.length) { p(C.yellow, "  Warnings:"); r.warnings.forEach(w => p(C.yellow,"    ⚠ " + w)); }
  else                     pass("No warnings");
  p(ok ? C.green : C.red, "  └" + "─".repeat(45));
}

// ── Method 1: Replit server ───────────────────────────────────────────────────
async function reviewViaReplit(bundle) {
  if (!REPLIT_URL) throw new Error("Replit URL not configured");
  const res = await httpPost(
    REPLIT_URL + "/api/ai-review",
    {},
    { files: [{ path: "bundle", content: bundle }], token: REPLIT_TOKEN },
    45000
  );
  if (res.status !== 200) throw new Error("Replit server HTTP " + res.status + ": " + JSON.stringify(res.body).slice(0,100));
  if (!res.body?.ok)      throw new Error(res.body?.error || "Replit server error");
  const b = res.body;
  return {
    src: "Replit Gemini (Server)",
    verdict:  (b.verdict || "UNKNOWN").toUpperCase(),
    reason:   b.reason   || "",
    issues:   b.issues   || [],
    warnings: b.warnings || [],
  };
}

// ── Method 2: Client's own Gemini ─────────────────────────────────────────────
async function reviewViaGemini(prompt) {
  if (!GEMINI_KEY) throw new Error("Gemini key not set");
  const res = await httpPost(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {},
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 1024 } },
    60000
  );
  if (res.status !== 200) throw new Error("Gemini HTTP " + res.status);
  const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini empty response");
  return parse(text, "Gemini (Client Key)");
}

// ── Method 3: Client's own DeepSeek ───────────────────────────────────────────
async function reviewViaDeepSeek(prompt) {
  if (!DS_KEY) throw new Error("DeepSeek key not set");
  const res = await httpPost(
    "https://api.deepseek.com/v1/chat/completions",
    { Authorization: "Bearer " + DS_KEY },
    { model: DS_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 1024 },
    60000
  );
  if (res.status !== 200) throw new Error("DeepSeek HTTP " + res.status);
  const text = res.body?.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek empty response");
  return parse(text, "DeepSeek (Client Key)");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  p(C.bold+C.cyan, "\n  ╔═══════════════════════════════════════════════╗");
  p(C.bold+C.cyan, "  ║   SAI Rolotech — AI Pre-Build Code Reviewer   ║");
  p(C.bold+C.cyan, "  ║   Gemini (Replit) → Gemini (Own) → DeepSeek  ║");
  p(C.bold+C.cyan, "  ╚═══════════════════════════════════════════════╝");

  // Load files
  title("Source files load ho rahe hain");
  let bundle = "";
  for (const f of FILES) {
    const c = readFile(f);
    if (c) { bundle += `\n========== ${f} ==========\n${c}`; pass(f); }
    else     warn(f + " — not found, skip");
  }

  const prompt  = makePrompt(bundle);
  const results = [];
  let   anyFail = false;

  // ── Try 1: Replit Server ────────────────────────────────────────────────
  if (!ONLY_GEMINI && !ONLY_DEEPSEEK) {
    title("Method 1: Replit Server (Gemini — no key needed)");
    try {
      const r = await reviewViaReplit(bundle);
      results.push(r);
      printResult(r);
      if (r.verdict === "FAIL") anyFail = true;
      if (!anyFail) { printFinal(results, anyFail); return; }
    } catch (e) {
      warn("Replit server unavailable: " + e.message);
      warn("Next method try kar raha hai...");
    }
  }

  // ── Try 2: Client's Gemini ──────────────────────────────────────────────
  if (!ONLY_DEEPSEEK && !ONLY_REPLIT && GEMINI_KEY) {
    title("Method 2: Gemini (Client Key)");
    try {
      const r = await reviewViaGemini(prompt);
      results.push(r);
      printResult(r);
      if (r.verdict === "FAIL") anyFail = true;
    } catch (e) {
      warn("Gemini (client) fail: " + e.message);
    }
  }

  // ── Try 3: Client's DeepSeek ────────────────────────────────────────────
  if (!ONLY_GEMINI && !ONLY_REPLIT && DS_KEY) {
    title("Method 3: DeepSeek (Client Key)");
    try {
      const r = await reviewViaDeepSeek(prompt);
      results.push(r);
      printResult(r);
      if (r.verdict === "FAIL") anyFail = true;
    } catch (e) {
      warn("DeepSeek (client) fail: " + e.message);
    }
  }

  printFinal(results, anyFail);
}

function printFinal(results, anyFail) {
  p(C.bold, "\n  ══════════════ FINAL VERDICT ══════════════");
  if (results.length === 0) {
    if (SKIP_ALL) {
      warn("Koi AI review complete nahi hua — build proceed");
      process.exit(0);
    } else {
      fail("AI review required lekin koi kaam nahi aaya!");
      process.exit(1);
    }
  }
  const passes = results.filter(r => r.verdict === "PASS").length;
  const fails  = results.filter(r => r.verdict === "FAIL").length;
  if (anyFail) {
    p(C.red+C.bold, `  ✗ ${fails}/${results.length} AI ne FAIL kaha — build rok diya!`);
    p(C.red,        "  Upar wale issues fix karo, phir dobara PRECHECK.bat chalao.\n");
    process.exit(1);
  } else {
    p(C.green+C.bold, `  ✓ ${passes}/${results.length} AI ne PASS diya — code safe hai!`);
    p(C.green,        "  BUILD.bat ab chal sakti hai.\n");
    process.exit(0);
  }
}

main().catch(e => { warn("Unexpected: " + e.message); process.exit(0); });
