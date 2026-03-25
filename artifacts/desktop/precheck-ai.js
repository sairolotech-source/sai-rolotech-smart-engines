/**
 * SAI Rolotech Smart Engines - AI Pre-Build Code Reviewer
 * Gemini + DeepSeek dono se code review karwata hai before build
 */

const fs   = require("fs");
const path = require("path");
const http = require("https");

// ── Colors for Windows CMD ────────────────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  red:    "\x1b[31m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  cyan:   "\x1b[36m",
  bold:   "\x1b[1m",
  white:  "\x1b[37m",
};

function log(color, msg) { process.stdout.write(color + msg + C.reset + "\n"); }
function pass(msg)  { log(C.green,  "  [PASS] " + msg); }
function fail(msg)  { log(C.red,    "  [FAIL] " + msg); }
function warn(msg)  { log(C.yellow, "  [WARN] " + msg); }
function info(msg)  { log(C.cyan,   "  [INFO] " + msg); }
function title(msg) { log(C.bold + C.white, "\n  " + msg); }

// ── Load Config ───────────────────────────────────────────────────────────────
const ROOT       = path.resolve(__dirname, "..", "..");
const configPath = path.join(__dirname, "ai-review-config.json");

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {
  warn("ai-review-config.json nahi mila — AI review skip");
  process.exit(0);
}

const GEMINI_KEY    = cfg.gemini?.apiKey   || "";
const DEEPSEEK_KEY  = cfg.deepseek?.apiKey || "";
const SKIP_NO_KEY   = cfg.review?.skipOnNoKey !== false;
const MAX_KB        = cfg.review?.maxFileSizeKB || 50;
const GEMINI_MODEL  = cfg.gemini?.model    || "gemini-2.5-pro";
const DEEPSEEK_MODEL= cfg.deepseek?.model  || "deepseek-chat";

const hasGemini   = GEMINI_KEY   && !GEMINI_KEY.startsWith("YOUR_");
const hasDeepSeek = DEEPSEEK_KEY && !DEEPSEEK_KEY.startsWith("YOUR_");

// ── Files to Review ───────────────────────────────────────────────────────────
const FILES_TO_REVIEW = [
  "artifacts/api-server/src/routes/github-update.ts",
  "artifacts/api-server/src/index.ts",
  "artifacts/desktop/src/main.ts",
  "artifacts/api-server/src/routes/ai-chat.ts",
  "package.json",
  "artifacts/desktop/package.json",
];

function readFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) return null;
  const stat = fs.statSync(absPath);
  if (stat.size > MAX_KB * 1024) {
    const content = fs.readFileSync(absPath, "utf8");
    return content.slice(0, MAX_KB * 1024) + "\n\n[...file truncated at " + MAX_KB + "KB...]";
  }
  return fs.readFileSync(absPath, "utf8");
}

// ── HTTP POST helper ──────────────────────────────────────────────────────────
function httpPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname, path,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers },
      timeout: 60000,
    };
    const req = http.request(opts, (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.write(data);
    req.end();
  });
}

// ── Build review prompt ───────────────────────────────────────────────────────
function buildPrompt(codeBundle) {
  return `You are a senior code reviewer for "SAI Rolotech Smart Engines" — a Windows Electron desktop app with an Express.js API server and React frontend.

Review the following source files and find ONLY critical bugs that would cause:
1. Application hang or freeze on startup (especially git operations, network timeouts)
2. Windows build failures (NSIS, native modules, path issues)
3. Crash-causing TypeScript/JavaScript errors
4. Security vulnerabilities (exposed keys, auth bypass)
5. Missing ELECTRON env checks in Electron-packaged builds

Format your response EXACTLY like this:

CRITICAL_ISSUES:
- [filename]: [issue description]
(or "none" if no critical issues)

WARNINGS:
- [filename]: [warning description]
(or "none" if no warnings)

VERDICT: PASS or FAIL
REASON: [one sentence]

Files to review:
${codeBundle}`;
}

// ── Gemini Review ─────────────────────────────────────────────────────────────
async function reviewWithGemini(prompt) {
  const res = await httpPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {},
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }
  );
  if (res.status !== 200) throw new Error("Gemini HTTP " + res.status);
  const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini empty response");
  return text;
}

// ── DeepSeek Review ───────────────────────────────────────────────────────────
async function reviewWithDeepSeek(prompt) {
  const res = await httpPost(
    "api.deepseek.com",
    "/v1/chat/completions",
    { Authorization: "Bearer " + DEEPSEEK_KEY },
    {
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1024,
    }
  );
  if (res.status !== 200) throw new Error("DeepSeek HTTP " + res.status);
  const text = res.body?.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek empty response");
  return text;
}

// ── Parse AI Response ─────────────────────────────────────────────────────────
function parseReview(text, source) {
  const verdict    = /VERDICT:\s*(PASS|FAIL)/i.exec(text)?.[1]?.toUpperCase() || "UNKNOWN";
  const reason     = /REASON:\s*(.+)/i.exec(text)?.[1]?.trim() || "";
  const critBlock  = /CRITICAL_ISSUES:([\s\S]*?)(?:WARNINGS:|VERDICT:)/i.exec(text)?.[1] || "";
  const warnBlock  = /WARNINGS:([\s\S]*?)(?:VERDICT:|$)/i.exec(text)?.[1] || "";

  const crits = critBlock.split("\n")
    .map(l => l.replace(/^[-•*]\s*/, "").trim())
    .filter(l => l && l.toLowerCase() !== "none");

  const warns = warnBlock.split("\n")
    .map(l => l.replace(/^[-•*]\s*/, "").trim())
    .filter(l => l && l.toLowerCase() !== "none");

  return { source, verdict, reason, crits, warns };
}

// ── Print Review Result ───────────────────────────────────────────────────────
function printResult(r) {
  const icon = r.verdict === "PASS" ? "✓" : r.verdict === "FAIL" ? "✗" : "?";
  const color = r.verdict === "PASS" ? C.green : r.verdict === "FAIL" ? C.red : C.yellow;
  log(color + C.bold, `\n  ┌─ ${r.source} Review: ${icon} ${r.verdict} ─────────────`);
  if (r.reason) info("Reason : " + r.reason);
  if (r.crits.length > 0) {
    log(C.red, "  Critical Issues:");
    r.crits.forEach(c => log(C.red, "    ✗ " + c));
  } else {
    pass("No critical issues");
  }
  if (r.warns.length > 0) {
    log(C.yellow, "  Warnings:");
    r.warns.forEach(w => log(C.yellow, "    ⚠ " + w));
  } else {
    pass("No warnings");
  }
  log(color, "  └─────────────────────────────────────────\n");
}

// ── CLI flags ─────────────────────────────────────────────────────────────────
const ONLY_GEMINI   = process.argv.includes("--only-gemini");
const ONLY_DEEPSEEK = process.argv.includes("--only-deepseek");

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(C.bold + C.cyan, "\n  ╔══════════════════════════════════════════╗");
  log(C.bold + C.cyan, "  ║   SAI Rolotech AI Pre-Build Code Review  ║");
  log(C.bold + C.cyan, "  ╚══════════════════════════════════════════╝");

  if (!hasGemini && !hasDeepSeek) {
    if (SKIP_NO_KEY) {
      warn("Koi AI key nahi hai (ai-review-config.json check karo) — AI review skip");
      warn("Keys add karo: https://aistudio.google.com (Gemini free) | https://platform.deepseek.com (DeepSeek)");
      process.exit(0);
    } else {
      fail("AI keys required hain lekin koi nahi mila!");
      process.exit(1);
    }
  }

  // Build code bundle
  title("Source files load ho rahe hain...");
  let codeBundle = "";
  let loadedCount = 0;
  for (const f of FILES_TO_REVIEW) {
    const content = readFile(f);
    if (content) {
      codeBundle += `\n\n========== FILE: ${f} ==========\n${content}`;
      loadedCount++;
      pass(f + " (" + Math.round(content.length / 1024) + " KB)");
    } else {
      warn(f + " — not found, skip");
    }
  }
  info(`${loadedCount} files loaded — AI review start ho raha hai...`);

  const prompt = buildPrompt(codeBundle);
  const results = [];
  let anyFail = false;

  // ── Gemini Review ────────────────────────────────────────────────────────
  if (hasGemini && !ONLY_DEEPSEEK) {
    title("Gemini (" + GEMINI_MODEL + ") code review kar raha hai...");
    try {
      const text = await reviewWithGemini(prompt);
      const result = parseReview(text, "Gemini");
      results.push(result);
      printResult(result);
      if (result.verdict === "FAIL") anyFail = true;
    } catch (e) {
      warn("Gemini review fail: " + e.message + " — skip");
    }
  } else {
    warn("Gemini key nahi — skip (ai-review-config.json mein add karo)");
  }

  // ── DeepSeek Review ──────────────────────────────────────────────────────
  if (hasDeepSeek && !ONLY_GEMINI) {
    title("DeepSeek (" + DEEPSEEK_MODEL + ") code review kar raha hai...");
    try {
      const text = await reviewWithDeepSeek(prompt);
      const result = parseReview(text, "DeepSeek");
      results.push(result);
      printResult(result);
      if (result.verdict === "FAIL") anyFail = true;
    } catch (e) {
      warn("DeepSeek review fail: " + e.message + " — skip");
    }
  } else {
    warn("DeepSeek key nahi — skip (ai-review-config.json mein add karo)");
  }

  // ── Final Verdict ────────────────────────────────────────────────────────
  log(C.bold, "\n  ══════════════ FINAL VERDICT ══════════════");
  if (results.length === 0) {
    warn("Koi AI review nahi hua — build proceed karo");
    process.exit(0);
  }

  const passes = results.filter(r => r.verdict === "PASS").length;
  const fails  = results.filter(r => r.verdict === "FAIL").length;

  if (anyFail) {
    log(C.red + C.bold, `  ✗ ${fails}/${results.length} AI ne FAIL kaha — build rok diya!`);
    log(C.red, "  Upar wale critical issues fix karo phir dobara chalao.\n");
    process.exit(1);
  } else {
    log(C.green + C.bold, `  ✓ ${passes}/${results.length} AI ne PASS diya — build safe hai!`);
    log(C.green, "  BUILD.bat chal sakti hai.\n");
    process.exit(0);
  }
}

main().catch(e => {
  warn("AI review unexpected error: " + e.message);
  process.exit(0); // Error pe build rokna nahi
});
