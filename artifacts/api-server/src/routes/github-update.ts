import { Router, Router as _Router, type IRouter, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  runMultiSourceUpdate,
  tryGitPull,
  tryGitHubArchive,
  tryGoogleDriveUpdate,
  getDriveManifest,
  uploadUpdateToDrive,
} from "../lib/multi-source-updater";

const router: IRouter = Router();
const execAsync = promisify(exec);

const REPO_ROOT = path.resolve("/home/runner/workspace");
const GITHUB_REPO = "adminsairolotech-bit/sai-rolotech-smart-engines";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;

const AUTO_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let autoUpdateEnabled = true;
let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;
let lastAutoCheck = "";
let lastAutoResult = "";
let autoUpdateLog: { time: string; message: string; type: "info" | "success" | "warn" | "error" }[] = [];

function logAuto(message: string, type: "info" | "success" | "warn" | "error" = "info") {
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  autoUpdateLog.push({ time, message, type });
  if (autoUpdateLog.length > 50) autoUpdateLog = autoUpdateLog.slice(-50);
  console.log(`[auto-update] [${type}] ${message}`);
}

function buildGitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
  };
  if (process.env["REPLIT_SESSION"]) {
    env["REPLIT_SESSION"] = process.env["REPLIT_SESSION"];
    env["REPLIT_ASKPASS_PID2_SESSION"] = process.env["REPLIT_SESSION"];
  }
  if (process.env["GIT_ASKPASS"]) {
    env["GIT_ASKPASS"] = process.env["GIT_ASKPASS"];
  }
  return env;
}

async function runGit(cmd: string): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(`git -C "${REPO_ROOT}" ${cmd}`, {
      timeout: 30000,
      env: buildGitEnv(),
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { stdout: e.stdout?.trim() ?? "", stderr: e.stderr?.trim() ?? e.message ?? "unknown error", ok: false };
  }
}

async function runShell(cmd: string, timeoutMs = 120000): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: timeoutMs,
      cwd: REPO_ROOT,
      env: { ...process.env },
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { stdout: e.stdout?.trim() ?? "", stderr: e.stderr?.trim() ?? e.message ?? "unknown error", ok: false };
  }
}

let restartScheduled = false;

function scheduleServerRestart(delaySec = 4) {
  if (restartScheduled) return;
  restartScheduled = true;
  logAuto(`Server ${delaySec} second mein restart hoga — nayi code load hogi...`, "info");
  setTimeout(() => {
    logAuto("Server restart ho raha hai — auto-update complete!", "success");
    process.exit(0);
  }, delaySec * 1000);
}

const ANTIVIRUS_SAFE_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".html", ".css",
  ".scss", ".svg", ".png", ".jpg", ".env.example", ".gitignore",
  ".gitattributes", ".prettierrc", ".eslintrc", "pnpm-lock.yaml",
];

function isAntivirusSafeFile(filename: string): boolean {
  if (!filename) return true;
  const lower = filename.toLowerCase();
  const dangerous = [".exe", ".dll", ".bat", ".cmd", ".msi", ".ps1", ".vbs", ".scr"];
  return !dangerous.some(ext => lower.endsWith(ext));
}

async function resolveStaleConflict(): Promise<boolean> {
  const lockPath = path.join(REPO_ROOT, ".git", "index.lock");
  if (fs.existsSync(lockPath)) {
    try { fs.unlinkSync(lockPath); logAuto("Stale index.lock removed", "info"); } catch {}
  }

  const isMergeInProgress = fs.existsSync(path.join(REPO_ROOT, ".git", "MERGE_HEAD"));
  const lsRes = await runGit("ls-files -u --name-only");
  const hasConflict = !!lsRes.stdout.trim();

  if (!isMergeInProgress && !hasConflict) return false;

  logAuto(`Stale merge state detected (MERGE_HEAD=${isMergeInProgress}, conflicts=${lsRes.stdout.trim() || "none"}) — aborting merge...`, "warn");

  const abortRes = await runGit("merge --abort");
  if (abortRes.ok) {
    logAuto("Merge aborted successfully — syncing to origin/main...", "info");
  } else {
    logAuto(`Merge abort: ${abortRes.stderr.slice(0, 100)} — attempting reset...`, "warn");
  }

  const fetchRes = await runGit("fetch origin main");
  if (!fetchRes.ok) {
    logAuto(`Fetch fail during conflict resolve: ${fetchRes.stderr.slice(0, 100)}`, "error");
    return false;
  }

  const resetRes = await runGit("reset --hard origin/main");
  if (resetRes.ok) {
    logAuto("Hard reset to origin/main — git state clean!", "success");
    return true;
  }

  logAuto(`Reset fail: ${resetRes.stderr.slice(0, 200)}`, "error");
  return false;
}

async function checkAndPull(): Promise<{ updated: boolean; message: string }> {
  if (process.env["ELECTRON"] === "1") {
    return { updated: false, message: "Packaged Electron app — git update disabled" };
  }
  lastAutoCheck = new Date().toISOString();

  try {
    await resolveStaleConflict();

    const localRes = await runGit("rev-parse HEAD");
    const localCommit = localRes.stdout.slice(0, 10);

    const fetchRes = await runGit("fetch origin main --prune");
    if (!fetchRes.ok) {
      logAuto(`Fetch fail (internet check karo): ${fetchRes.stderr}`, "warn");
      lastAutoResult = "Fetch failed";
      return { updated: false, message: `Fetch failed: ${fetchRes.stderr}` };
    }

    const behindRes = await runGit("rev-list HEAD..origin/main --count");
    const behindCount = parseInt(behindRes.stdout) || 0;

    const remoteCommitRes = await runGit("rev-parse origin/main");
    const remoteCommit = remoteCommitRes.stdout.slice(0, 10);

    if (behindCount === 0) {
      logAuto(`Up to date — Local: ${localCommit} = GitHub: ${remoteCommit}`, "info");
      lastAutoResult = "Up to date";
      return { updated: false, message: "Already up to date" };
    }

    logAuto(`${behindCount} naya commit milga! Local: ${localCommit} → GitHub: ${remoteCommit} — Pulling...`, "info");

    const pendingFilesRes = await runGit("diff --name-only HEAD..origin/main");
    const pendingFiles = pendingFilesRes.stdout.split("\n").filter(Boolean);

    const blockedFiles = pendingFiles.filter(f => !isAntivirusSafeFile(f));
    if (blockedFiles.length > 0) {
      logAuto(`Antivirus Warning: ye files skip ki gayi (blocked): ${blockedFiles.join(", ")}`, "warn");
    }

    const localChangesRes = await runGit("diff --name-only");
    const stagedChangesRes = await runGit("diff --cached --name-only");
    const hasLocalChanges = !!(localChangesRes.stdout.trim() || stagedChangesRes.stdout.trim());

    if (hasLocalChanges) {
      logAuto(`Local uncommitted changes detected (${localChangesRes.stdout.trim().split("\n").filter(Boolean).join(", ")}) — using hard reset to sync`, "warn");
      const resetRes = await runGit("reset --hard origin/main");
      if (resetRes.ok) {
        logAuto("Hard reset complete — local synced to origin/main", "success");
      } else {
        logAuto(`Hard reset fail: ${resetRes.stderr.slice(0, 150)} — trying stash+pull...`, "warn");
        await runGit("stash");
        const pullRes2 = await runGit("pull origin main --ff-only");
        if (!pullRes2.ok) {
          logAuto(`Pull after stash fail: ${pullRes2.stderr.slice(0, 150)}`, "error");
          lastAutoResult = "Pull failed";
          return { updated: false, message: `Pull failed: ${pullRes2.stderr}` };
        }
      }
    } else {
      const pullRes = await runGit("pull origin main --ff-only");
      if (!pullRes.ok) {
        logAuto(`FF pull fail — trying hard reset...`, "warn");
        const resetRes = await runGit("reset --hard origin/main");
        if (!resetRes.ok) {
          logAuto(`Pull fail: ${resetRes.stderr.slice(0, 150)}`, "error");
          lastAutoResult = "Pull failed";
          return { updated: false, message: `Pull failed: ${resetRes.stderr}` };
        }
      }
    }

    logAuto("Git pull complete — ab pnpm install chala rahe hain...", "info");

    const installRes = await runShell(
      "pnpm install --prefer-frozen-lockfile 2>&1 || pnpm install --no-frozen-lockfile 2>&1",
      120000,
    );
    if (installRes.ok) {
      logAuto("pnpm install complete!", "success");
    } else {
      logAuto(`pnpm install warning: ${installRes.stderr.slice(0, 300)}`, "warn");
    }

    const newCommitRes = await runGit("rev-parse HEAD");
    const newCommit = newCommitRes.stdout.slice(0, 10);

    const safeChanges = pendingFiles.filter(f =>
      ANTIVIRUS_SAFE_EXTENSIONS.some(ext => f.endsWith(ext)) || !f.includes(".")
    );

    logAuto(
      `AUTO-UPDATE DONE! ${localCommit} → ${newCommit} | ${pendingFiles.length} files (${safeChanges.length} safe, ${blockedFiles.length} antivirus-blocked)`,
      "success",
    );
    lastAutoResult = `Updated: ${localCommit} → ${newCommit} (${pendingFiles.length} files changed)`;

    if (newCommit !== localCommit) {
      scheduleServerRestart(4);
    }

    return { updated: true, message: `Updated to ${newCommit} — ${pendingFiles.length} files changed` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logAuto(`Auto-update error: ${message}`, "error");
    lastAutoResult = `Error: ${message}`;
    return { updated: false, message };
  }
}

export function startAutoUpdate() {
  if (process.env["ELECTRON"] === "1") {
    logAuto("Packaged Electron app — auto-update (git) disabled", "info");
    return;
  }
  if (autoUpdateTimer) return;
  autoUpdateEnabled = true;
  logAuto(`Auto-update SHURU — har ${AUTO_CHECK_INTERVAL_MS / 60000} min mein check karega`, "success");

  setTimeout(() => {
    checkAndPull().catch(() => {});
  }, 10000);

  autoUpdateTimer = setInterval(() => {
    if (autoUpdateEnabled) {
      checkAndPull().catch(() => {});
    }
  }, AUTO_CHECK_INTERVAL_MS);
}

export function stopAutoUpdate() {
  if (autoUpdateTimer) {
    clearInterval(autoUpdateTimer);
    autoUpdateTimer = null;
  }
  autoUpdateEnabled = false;
  logAuto("Auto-update BAND kiya", "warn");
}

router.get("/system/git-status", async (_req: Request, res: Response) => {
  if (process.env["ELECTRON"] === "1") {
    res.json({ isElectron: true, message: "Git status not available in packaged app", localCommit: "N/A", githubCommit: "N/A", upToDate: true });
    return;
  }
  try {
    const [localRes, logRes, remoteRes] = await Promise.all([
      runGit("rev-parse HEAD"),
      runGit("log --oneline -5"),
      runGit("rev-parse --abbrev-ref HEAD"),
    ]);

    const localCommit = localRes.stdout.slice(0, 10);
    const branch = remoteRes.stdout || "main";
    const recentLogs = logRes.stdout.split("\n").map(l => l.trim()).filter(Boolean);

    let githubCommit = "";
    let githubMessage = "";
    let githubDate = "";
    let canReach = false;
    try {
      const ghRes = await fetch(GITHUB_API, {
        headers: { "User-Agent": "SaiRolotech-AutoUpdate/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (ghRes.ok) {
        const ghData = await ghRes.json() as {
          sha: string;
          commit: { message: string; committer: { date: string } };
        };
        githubCommit = ghData.sha?.slice(0, 10) ?? "";
        githubMessage = ghData.commit?.message?.split("\n")[0] ?? "";
        githubDate = ghData.commit?.committer?.date ?? "";
        canReach = true;
      }
    } catch { /* GitHub not reachable */ }

    const upToDate = githubCommit === "" || localCommit === githubCommit;

    res.json({
      ok: true,
      local: {
        commit: localCommit,
        fullCommit: localRes.stdout,
        branch,
        recentLogs,
      },
      github: {
        commit: githubCommit,
        message: githubMessage,
        date: githubDate,
        reachable: canReach,
        repo: GITHUB_REPO,
      },
      upToDate,
      updatesAvailable: canReach && !upToDate,
      autoUpdate: {
        enabled: autoUpdateEnabled,
        intervalMin: AUTO_CHECK_INTERVAL_MS / 60000,
        lastCheck: lastAutoCheck,
        lastResult: lastAutoResult,
        logCount: autoUpdateLog.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Status check failed";
    res.status(500).json({ ok: false, error: message });
  }
});

router.post("/system/git-pull", async (_req: Request, res: Response) => {
  try {
    await resolveStaleConflict();

    const localCommitRes = await runGit("rev-parse HEAD");
    const localCommit = localCommitRes.stdout.slice(0, 10);

    const fetchRes = await runGit("fetch origin main --prune");
    if (!fetchRes.ok) {
      res.status(500).json({ ok: false, error: `Fetch failed: ${fetchRes.stderr}` });
      return;
    }

    const behindRes = await runGit("rev-list HEAD..origin/main --count");
    const behindCount = parseInt(behindRes.stdout) || 0;

    if (behindCount === 0) {
      res.json({ ok: true, message: "Already up to date — koi naya update nahi", pulled: false, changes: [] });
      return;
    }

    const pendingFilesRes = await runGit("diff --name-only HEAD..origin/main");
    const pendingFiles = pendingFilesRes.stdout.split("\n").filter(Boolean);
    const blockedFiles = pendingFiles.filter(f => !isAntivirusSafeFile(f));

    const pullRes = await runGit("pull origin main --ff-only");
    if (!pullRes.ok) {
      const mergeRes = await runGit("pull origin main --no-rebase -X theirs");
      if (!mergeRes.ok) {
        res.status(500).json({ ok: false, error: `Pull failed: ${mergeRes.stderr}` });
        return;
      }
    }

    logAuto("Manual pull ke baad pnpm install chala rahe hain...", "info");
    const installRes = await runShell(
      "pnpm install --prefer-frozen-lockfile 2>&1 || pnpm install --no-frozen-lockfile 2>&1",
      120000,
    );
    if (installRes.ok) logAuto("pnpm install complete after manual pull!", "success");

    const newCommitRes = await runGit("rev-parse HEAD");
    const newCommit = newCommitRes.stdout.slice(0, 10);
    const logRes = await runGit("log --oneline -3");

    res.json({
      ok: true,
      message: `✅ ${behindCount} commit(s) pull ho gaye! Server restart hoga...`,
      pulled: true,
      newCommit,
      behindCount,
      changes: pendingFiles,
      antivirusBlocked: blockedFiles,
      log: logRes.stdout,
      output: pullRes.stdout,
    });

    if (newCommit !== localCommit) {
      scheduleServerRestart(3);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Git pull failed";
    res.status(500).json({ ok: false, error: message });
  }
});

// ── GitHub Webhook — instant auto-update when GitHub gets a push ─────────────
// GitHub → Settings → Webhooks → Add webhook
// URL: https://YOUR-DOMAIN/api/system/github-webhook
// Content-Type: application/json  |  Events: push  |  Secret: GITHUB_WEBHOOK_SECRET
router.post("/system/github-webhook", async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env["GITHUB_WEBHOOK_SECRET"] ?? "";
    const signature = req.headers["x-hub-signature-256"] as string ?? "";
    const event = req.headers["x-github-event"] as string ?? "";

    // HMAC verification (if secret is set)
    if (webhookSecret) {
      const rawBody = JSON.stringify(req.body);
      const expected = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        logAuto("Webhook rejected — invalid signature", "warn");
        res.status(401).json({ ok: false, error: "Invalid webhook signature" });
        return;
      }
    }

    // Only handle push events to main branch
    if (event !== "push") {
      res.json({ ok: true, message: `Event '${event}' ignored — only 'push' handled` });
      return;
    }

    const payload = req.body as { ref?: string; pusher?: { name?: string }; head_commit?: { id?: string; message?: string } };
    const ref = payload.ref ?? "";
    if (!ref.endsWith("/main") && ref !== "refs/heads/main") {
      res.json({ ok: true, message: `Branch '${ref}' ignored — only main branch handled` });
      return;
    }

    const pusher = payload.pusher?.name ?? "unknown";
    const commitId = payload.head_commit?.id?.slice(0, 10) ?? "?";
    const commitMsg = payload.head_commit?.message?.split("\n")[0]?.slice(0, 60) ?? "";
    logAuto(`Webhook received! Push by '${pusher}' — commit: ${commitId} "${commitMsg}" — auto-pull shuru...`, "success");

    // Respond immediately to GitHub (don't wait for pull to finish)
    res.json({ ok: true, message: "Webhook received — pulling latest code...", commit: commitId, pusher });

    // Pull in background — 2 sec delay (git needs to fully process on GitHub)
    setTimeout(async () => {
      try {
        const result = await checkAndPull();
        logAuto(`Webhook pull result: ${result.message}`, result.updated ? "success" : "info");
      } catch (e: unknown) {
        logAuto(`Webhook pull error: ${e instanceof Error ? e.message : String(e)}`, "error");
      }
    }, 2000);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    logAuto(`Webhook error: ${message}`, "error");
    res.status(500).json({ ok: false, error: message });
  }
});

// ── Webhook setup info ────────────────────────────────────────────────────────
router.get("/system/github-webhook", (_req: Request, res: Response) => {
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? process.env["REPLIT_DOMAIN"] ?? "your-domain";
  const webhookSecret = process.env["GITHUB_WEBHOOK_SECRET"];
  res.json({
    ok: true,
    webhookUrl: `https://${domain}/api/system/github-webhook`,
    instructions: {
      step1: "GitHub repo → Settings → Webhooks → Add webhook",
      step2: `Payload URL: https://${domain}/api/system/github-webhook`,
      step3: "Content type: application/json",
      step4: "Which events: Just the push event",
      step5: webhookSecret ? "Secret: GITHUB_WEBHOOK_SECRET (already set ✅)" : "Secret: Set GITHUB_WEBHOOK_SECRET in Replit Secrets (optional but recommended)",
    },
    secretConfigured: !!webhookSecret,
    autoUpdateInterval: "5 min (fallback — webhook ke baad instant update hoga)",
  });
});

router.post("/system/git-push", async (req: Request, res: Response) => {
  try {
    const { message: commitMsg } = req.body as { message?: string };
    const msg = commitMsg?.trim() || `SAI Rolotech update: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

    // Clean up stale git lock files before any git operation
    const gitLockPath = path.join(REPO_ROOT, ".git", "index.lock");
    if (fs.existsSync(gitLockPath)) {
      try { fs.unlinkSync(gitLockPath); logAuto("Stale git index.lock removed", "info"); } catch {}
    }

    await runGit(`config user.email "sairolotech@gmail.com"`);
    await runGit(`config user.name "SAI Rolotech"`);

    const statusRes = await runGit("status --porcelain");
    if (statusRes.stdout) {
      // Stage all files EXCEPT .github/workflows/ (workflow pushes need 'workflow' PAT scope)
      await runGit("add -A");
      await runGit("reset HEAD .github/").catch(() => {}); // unstage .github/ if any
      const commitRes = await runGit(`commit -m "${msg.replace(/"/g, "'")}"`);
      if (!commitRes.ok && !commitRes.stdout.includes("nothing to commit")) {
        logAuto(`Commit warning: ${commitRes.stderr.slice(0, 100)}`, "warn");
      }
    }

    const aheadRes = await runGit("rev-list origin/main..HEAD --count");
    const aheadCount = parseInt(aheadRes.stdout) || 0;

    if (aheadCount === 0) {
      res.json({ ok: true, message: "GitHub already up to date — koi nayi commits nahi hain", pushed: false, aheadCount: 0 });
      return;
    }

    logAuto(`GitHub pe ${aheadCount} unpushed commit(s) push ho rahe hain...`, "info");

    const ghToken = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] || process.env["GITHUB_TOKEN"] || "";
    let pushRes;
    const askpassPath = `/tmp/sai-askpass-${process.pid}.sh`;
    let cleanedUp = false;
    const cleanupAskpass = () => {
      if (!cleanedUp && fs.existsSync(askpassPath)) {
        try { fs.unlinkSync(askpassPath); } catch {}
        cleanedUp = true;
      }
    };

    try {
      if (ghToken) {
        const safeToken = ghToken.replace(/'/g, "'\\''");
        fs.writeFileSync(
          askpassPath,
          `#!/bin/sh\ncase "$1" in\n  *[Uu]sername*) echo "x-access-token";;\n  *) echo '${safeToken}';;\nesac\n`,
          { mode: 0o700 }
        );
        pushRes = await new Promise<{ stdout: string; stderr: string; ok: boolean }>((resolve) => {
          const pushEnv: Record<string, string | undefined> = { ...process.env, GIT_ASKPASS: askpassPath, GIT_TERMINAL_PROMPT: "0" };
          delete pushEnv["REPLIT_SESSION"];
          delete pushEnv["REPLIT_ASKPASS_PID2_SESSION"];
          const cmd = `git -C "${REPO_ROOT}" -c core.askpass="${askpassPath}" -c credential.helper= push origin main`;
          exec(cmd, { timeout: 30000, env: pushEnv }, (err, stdout, stderr) => {
            if (err) resolve({ stdout: stdout?.trim() ?? "", stderr: stderr?.trim() ?? err.message, ok: false });
            else resolve({ stdout: stdout?.trim() ?? "", stderr: stderr?.trim() ?? "", ok: true });
          });
        });
        cleanupAskpass();
      } else {
        pushRes = await runGit("push origin main");
      }
    } catch (e) {
      cleanupAskpass();
      throw e;
    }
    cleanupAskpass();

    if (!pushRes.ok) {
      res.status(500).json({ ok: false, error: `Push failed: ${pushRes.stderr}`, hint: "GITHUB_PERSONAL_ACCESS_TOKEN aur repo access check karo" });
      return;
    }

    const newHeadRes = await runGit("rev-parse HEAD");
    const newCommit = newHeadRes.stdout.slice(0, 10);
    logAuto(`GitHub push done! ${aheadCount} commits pushed — HEAD: ${newCommit}`, "success");

    res.json({
      ok: true,
      message: `✅ GitHub pe ${aheadCount} commit(s) push ho gaye! Commit: ${newCommit}`,
      pushed: true,
      aheadCount,
      newCommit,
      output: pushRes.stdout || pushRes.stderr,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Git push failed";
    res.status(500).json({ ok: false, error: message });
  }
});

// ── Push specific files to GitHub via REST API (bypasses git push + workflow scope) ──
router.post("/system/github-files-push", async (req: Request, res: Response) => {
  try {
    const { files, message: commitMsg } = req.body as { files?: string[]; message?: string };
    if (!files || !Array.isArray(files) || files.length === 0) {
      res.status(400).json({ ok: false, error: "files[] array required" });
      return;
    }

    const ghToken = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] || process.env["GITHUB_TOKEN"] || "";
    if (!ghToken) {
      res.status(500).json({ ok: false, error: "GITHUB_PERSONAL_ACCESS_TOKEN not set" });
      return;
    }

    const msg = commitMsg?.trim() || `SAI Rolotech update: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const headers = {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
    const baseUrl = `https://api.github.com/repos/${GITHUB_REPO}`;

    // 1. Get current HEAD commit SHA on GitHub
    const refRes = await fetch(`${baseUrl}/git/ref/heads/main`, { headers });
    if (!refRes.ok) throw new Error(`Get ref failed: ${refRes.status} ${await refRes.text()}`);
    const refData = await refRes.json() as { object: { sha: string } };
    const baseSha = refData.object.sha;
    logAuto(`GitHub base SHA: ${baseSha.slice(0, 10)}`, "info");

    // 2. Get base tree SHA from the commit
    const baseCommitRes = await fetch(`${baseUrl}/git/commits/${baseSha}`, { headers });
    if (!baseCommitRes.ok) throw new Error(`Get commit failed: ${baseCommitRes.status}`);
    const baseCommitData = await baseCommitRes.json() as { tree: { sha: string } };
    const baseTreeSha = baseCommitData.tree.sha;

    // 3. Create blobs for each file
    const treeItems: { path: string; mode: string; type: string; sha: string }[] = [];
    for (const filePath of files) {
      const absPath = path.join(REPO_ROOT, filePath);
      if (!fs.existsSync(absPath)) {
        logAuto(`File not found, skipping: ${filePath}`, "warn");
        continue;
      }
      const content = fs.readFileSync(absPath, "utf-8");
      const blobRes = await fetch(`${baseUrl}/git/blobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content, encoding: "utf-8" }),
      });
      if (!blobRes.ok) throw new Error(`Blob create failed for ${filePath}: ${blobRes.status}`);
      const blobData = await blobRes.json() as { sha: string };
      treeItems.push({ path: filePath, mode: "100644", type: "blob", sha: blobData.sha });
      logAuto(`Blob created for ${filePath}: ${blobData.sha.slice(0, 10)}`, "info");
    }

    if (treeItems.length === 0) {
      res.json({ ok: false, error: "No valid files found to push" });
      return;
    }

    // 4. Create new tree
    const newTreeRes = await fetch(`${baseUrl}/git/trees`, {
      method: "POST",
      headers,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
    });
    if (!newTreeRes.ok) throw new Error(`Tree create failed: ${newTreeRes.status} ${await newTreeRes.text()}`);
    const newTreeData = await newTreeRes.json() as { sha: string };
    logAuto(`New tree created: ${newTreeData.sha.slice(0, 10)}`, "info");

    // 5. Create commit
    const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: msg,
        tree: newTreeData.sha,
        parents: [baseSha],
        author: { name: "SAI Rolotech", email: "sairolotech@gmail.com", date: new Date().toISOString() },
      }),
    });
    if (!newCommitRes.ok) throw new Error(`Commit create failed: ${newCommitRes.status} ${await newCommitRes.text()}`);
    const newCommitData = await newCommitRes.json() as { sha: string };
    logAuto(`Commit created: ${newCommitData.sha.slice(0, 10)}`, "info");

    // 6. Update refs/heads/main
    const updateRefRes = await fetch(`${baseUrl}/git/refs/heads/main`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ sha: newCommitData.sha, force: false }),
    });
    if (!updateRefRes.ok) throw new Error(`Update ref failed: ${updateRefRes.status} ${await updateRefRes.text()}`);

    logAuto(`GitHub files push done! Commit: ${newCommitData.sha.slice(0, 10)} — ${files.length} file(s)`, "success");
    res.json({
      ok: true,
      message: `✅ ${files.length} file(s) GitHub pe push ho gaye! Commit: ${newCommitData.sha.slice(0, 10)}`,
      pushed: true,
      commitSha: newCommitData.sha,
      files: treeItems.map(t => t.path),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "GitHub files push failed";
    logAuto(`github-files-push error: ${message}`, "error");
    res.status(500).json({ ok: false, error: message });
  }
});

// ── Create/update GitHub tag via REST API (no git push needed) ────────────────
router.post("/system/github-tag", async (req: Request, res: Response) => {
  try {
    const { tag, sha: customSha, message: tagMsg } = req.body as { tag?: string; sha?: string; message?: string };
    if (!tag || !/^v\d+\.\d+\.\d+/.test(tag)) {
      res.status(400).json({ ok: false, error: "tag required — format: v2.2.2" });
      return;
    }

    const ghToken = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] || process.env["GITHUB_TOKEN"] || "";
    if (!ghToken) {
      res.status(500).json({ ok: false, error: "GITHUB_PERSONAL_ACCESS_TOKEN not set" });
      return;
    }

    const msg = tagMsg?.trim() || `SAI Rolotech Smart Engines ${tag}`;

    // Get latest commit SHA from GitHub (or use provided sha)
    let sha = customSha;
    if (!sha) {
      const mainRes = await execAsync(
        `curl -sf -H "Authorization: Bearer ${ghToken}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/main`,
        { timeout: 10000 }
      );
      const mainData = JSON.parse(mainRes.stdout) as { object?: { sha?: string } };
      sha = mainData.object?.sha;
    }

    if (!sha) {
      res.status(500).json({ ok: false, error: "Could not get latest commit SHA from GitHub" });
      return;
    }

    logAuto(`Using commit SHA: ${sha.slice(0, 10)}`, "info");

    // Delete existing tag on GitHub (if exists)
    await execAsync(
      `curl -sf -X DELETE -H "Authorization: Bearer ${ghToken}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/repos/${GITHUB_REPO}/git/refs/tags/${tag}`,
      { timeout: 10000 }
    ).catch(() => {}); // ignore if tag doesn't exist

    logAuto(`Old tag ${tag} deleted (if existed)`, "info");

    // Create annotated tag object
    const taggerDate = new Date().toISOString();
    const tagObjBody = JSON.stringify({
      tag,
      message: msg,
      object: sha,
      type: "commit",
      tagger: { name: "SAI Rolotech", email: "sairolotech@gmail.com", date: taggerDate }
    });

    const tagObjRes = await execAsync(
      `curl -sf -X POST -H "Authorization: Bearer ${ghToken}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" -H "Content-Type: application/json" -d '${tagObjBody.replace(/'/g, "\\'")}' https://api.github.com/repos/${GITHUB_REPO}/git/tags`,
      { timeout: 15000 }
    );
    const tagObj = JSON.parse(tagObjRes.stdout) as { sha?: string; message?: string };
    if (!tagObj.sha) {
      res.status(500).json({ ok: false, error: `Tag object creation failed: ${tagObjRes.stdout.slice(0, 200)}` });
      return;
    }

    logAuto(`Tag object created: ${tagObj.sha.slice(0, 10)}`, "info");

    // Create tag reference
    const refBody = JSON.stringify({ ref: `refs/tags/${tag}`, sha: tagObj.sha });
    const refRes = await execAsync(
      `curl -sf -X POST -H "Authorization: Bearer ${ghToken}" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" -H "Content-Type: application/json" -d '${refBody}' https://api.github.com/repos/${GITHUB_REPO}/git/refs`,
      { timeout: 15000 }
    );
    const refData = JSON.parse(refRes.stdout) as { ref?: string; message?: string };

    if (!refData.ref) {
      res.status(500).json({ ok: false, error: `Ref creation failed: ${refRes.stdout.slice(0, 200)}` });
      return;
    }

    logAuto(`✅ Tag ${tag} pushed via GitHub API → Actions build SHURU!`, "success");
    res.json({
      ok: true,
      tag,
      ref: refData.ref,
      commitSha: sha,
      message: `✅ Tag ${tag} GitHub pe create ho gaya! GitHub Actions ab Windows installer build karega.`,
      actionsUrl: `https://github.com/${GITHUB_REPO}/actions`,
      releaseUrl: `https://github.com/${GITHUB_REPO}/releases/tag/${tag}`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── Push a version tag → triggers GitHub Actions build ───────────────────────
router.post("/system/git-tag", async (req: Request, res: Response) => {
  try {
    const { tag, message: tagMsg } = req.body as { tag?: string; message?: string };
    if (!tag || !/^v\d+\.\d+\.\d+/.test(tag)) {
      res.status(400).json({ ok: false, error: "tag required — format: v2.2.2" });
      return;
    }

    const msg = tagMsg?.trim() || `SAI Rolotech Smart Engines ${tag}`;
    const ghToken = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] || process.env["GITHUB_TOKEN"] || "";
    if (!ghToken) {
      res.status(500).json({ ok: false, error: "GITHUB_PERSONAL_ACCESS_TOKEN not set" });
      return;
    }

    // Clean stale lock
    const gitLockPath = path.join(REPO_ROOT, ".git", "index.lock");
    if (fs.existsSync(gitLockPath)) {
      try { fs.unlinkSync(gitLockPath); } catch {}
    }

    // Delete existing tag (local + remote) if exists — avoid conflict
    await runGit(`tag -d ${tag}`).catch(() => {});
    // Delete remote tag too (using askpass for auth)
    const delAskpassPath = `/tmp/sai-askpass-deltag-${process.pid}.sh`;
    fs.writeFileSync(delAskpassPath, `#!/bin/sh\necho "${ghToken}"\n`, { mode: 0o700 });
    const delEnv: Record<string, string | undefined> = { ...process.env, GIT_ASKPASS: delAskpassPath, GIT_TERMINAL_PROMPT: "0" };
    delete delEnv["REPLIT_SESSION"];
    delete delEnv["REPLIT_ASKPASS_PID2_SESSION"];
    await new Promise<void>((resolve) => {
      const cmd = `git -C "${REPO_ROOT}" -c core.askpass="${delAskpassPath}" -c credential.helper= push origin --delete ${tag}`;
      exec(cmd, { timeout: 15000, env: delEnv }, () => {
        try { fs.unlinkSync(delAskpassPath); } catch {}
        resolve();
      });
    });

    // Create annotated tag
    const tagRes = await runGit(`tag -a ${tag} -m "${msg.replace(/"/g, "'")}"`);
    if (!tagRes.ok) {
      res.status(500).json({ ok: false, error: `Tag create failed: ${tagRes.stderr}` });
      return;
    }

    // Push tag using askpass
    const askpassPath = `/tmp/sai-askpass-tag-${process.pid}.sh`;
    fs.writeFileSync(askpassPath, `#!/bin/sh\necho "${ghToken}"\n`, { mode: 0o700 });

    const pushEnv: Record<string, string | undefined> = { ...process.env, GIT_ASKPASS: askpassPath, GIT_TERMINAL_PROMPT: "0" };
    delete pushEnv["REPLIT_SESSION"];
    delete pushEnv["REPLIT_ASKPASS_PID2_SESSION"];

    const pushResult = await new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
      const cmd = `git -C "${REPO_ROOT}" -c core.askpass="${askpassPath}" -c credential.helper= push origin ${tag}`;
      exec(cmd, { timeout: 30000, env: pushEnv }, (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: stdout.trim(), stderr: stderr.trim() });
        try { fs.unlinkSync(askpassPath); } catch {}
      });
    });

    if (!pushResult.ok) {
      res.status(500).json({ ok: false, error: `Tag push failed: ${pushResult.stderr}` });
      return;
    }

    logAuto(`Version tag ${tag} pushed → GitHub Actions build SHURU ho gaya!`, "success");
    res.json({
      ok: true,
      tag,
      message: `✅ Tag ${tag} GitHub pe push ho gaya! GitHub Actions ab Windows installer build karega.`,
      actionsUrl: `https://github.com/${GITHUB_REPO}/actions`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

router.post("/system/auto-update/start", async (_req: Request, res: Response) => {
  startAutoUpdate();
  res.json({ ok: true, message: "Auto-update CHALU — har 5 min mein GitHub check karega aur khud pull karega", enabled: true });
});

router.post("/system/auto-update/stop", async (_req: Request, res: Response) => {
  stopAutoUpdate();
  res.json({ ok: true, message: "Auto-update BAND kiya", enabled: false });
});

router.post("/system/auto-update/check-now", async (_req: Request, res: Response) => {
  const result = await checkAndPull();
  res.json({ ok: true, ...result });
});

// ── Special Windows Install Script API ──
// User runs: irm https://<api>/api/system/install | iex
router.get("/system/install", async (_req: Request, res: Response) => {
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "SAI-Rolotech-UpdateAgent/1.0" }
    });
    const release = await ghRes.json() as { tag_name: string; assets: { name: string; browser_download_url: string; size: number }[] };
    const tag = release.tag_name ?? "v2.2.11";
    const asset = release.assets?.find((a) => a.name.endsWith(".exe") && !a.name.endsWith(".blockmap"));
    const url = asset?.browser_download_url ?? `https://github.com/${GITHUB_REPO}/releases/download/${tag}/SAI-Rolotech-Smart-Engines-Setup-${tag.replace("v","")}.exe`;
    const sizeMB = asset ? Math.round(asset.size / 1024 / 1024) : 83;

    const ps1 = `
# SAI Rolotech Smart Engines — Auto Update Script
# Latest: ${tag}
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SAI Rolotech Smart Engines Update      " -ForegroundColor Cyan
Write-Host "  Version: ${tag}                        " -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill old processes
Write-Host "[1/4] Purani app band kar raha hun..." -ForegroundColor Yellow
$procs = @("SAI Rolotech Smart Engines","Sai Rolotech Smart Engines","SaiRolotech-SmartEngines","electron")
foreach ($p in $procs) { Get-Process -Name $p -EA SilentlyContinue | Stop-Process -Force }
Start-Sleep -Seconds 2

# Step 2: Remove old Desktop installer files
Write-Host "[2/4] Purane installer files saaf kar raha hun..." -ForegroundColor Yellow
Get-ChildItem "$env:USERPROFILE\\Desktop" -Filter "SAI*.exe" -EA SilentlyContinue | Remove-Item -Force
Get-ChildItem "$env:USERPROFILE\\Desktop" -Filter "SAI-*.exe" -EA SilentlyContinue | Remove-Item -Force

# Step 3: Download latest
Write-Host "[3/4] ${tag} download ho raha hai (~${sizeMB}MB)..." -ForegroundColor Yellow
$installer = "$env:TEMP\\SAI-Latest-${tag}.exe"
Invoke-WebRequest "${url}" -OutFile $installer -UseBasicParsing
Write-Host "      Download complete!" -ForegroundColor Green

# Step 4: Install
Write-Host "[4/4] Install ho raha hai..." -ForegroundColor Yellow
Start-Process $installer -Wait
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  ${tag} install complete!              " -ForegroundColor Green
Write-Host "  Desktop shortcut se app kholen        " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
`;

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=sai-update.ps1");
    res.send(ps1.trim());
  } catch (err) {
    res.status(500).send(`Write-Host "Update fetch failed: ${err}" -ForegroundColor Red`);
  }
});

// JSON version info for the latest release
router.get("/system/install/info", async (_req: Request, res: Response) => {
  try {
    const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "User-Agent": "SAI-Rolotech-UpdateAgent/1.0" }
    });
    const release = await ghRes.json() as { tag_name: string; name: string; published_at: string; assets: { name: string; browser_download_url: string; size: number }[] };
    const asset = release.assets?.find((a) => a.name.endsWith(".exe") && !a.name.endsWith(".blockmap"));
    res.json({
      version: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
      downloadUrl: asset?.browser_download_url,
      sizeMB: asset ? Math.round(asset.size / 1024 / 1024) : null,
      installCommand: `irm ${process.env.API_BASE_URL ?? "https://api-url"}/api/system/install | iex`
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/system/auto-update/status", async (_req: Request, res: Response) => {
  res.json({
    ok: true,
    enabled: autoUpdateEnabled,
    intervalMin: AUTO_CHECK_INTERVAL_MS / 60000,
    lastCheck: lastAutoCheck,
    lastResult: lastAutoResult,
    log: autoUpdateLog.slice(-20),
  });
});

// ── Multi-Source Update Endpoints ─────────────────────────────────────────────

/**
 * GET /api/system/update-sources
 * Sabhi update sources ka status — GitHub, Archive, Google Drive
 */
router.get("/system/update-sources", async (_req: Request, res: Response) => {
  try {
    const sources: {
      id: string;
      name: string;
      description: string;
      priority: number;
      status: "available" | "unknown" | "no-package";
      detail?: string;
    }[] = [];

    // Source 1: GitHub git pull
    let githubStatus: "available" | "unknown" = "unknown";
    let githubDetail = "";
    try {
      const ghRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
        headers: { "User-Agent": "SaiRolotech/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (ghRes.ok) {
        const data = await ghRes.json() as { sha?: string };
        githubStatus = "available";
        githubDetail = `Latest: ${data.sha?.slice(0, 10) ?? "?"}`;
      } else {
        githubDetail = `HTTP ${ghRes.status}`;
      }
    } catch (err) {
      githubDetail = `Not reachable: ${String(err).slice(0, 60)}`;
    }
    sources.push({
      id: "git-pull",
      name: "GitHub (git pull)",
      description: "Standard git fetch + pull from adminsairolotech-bit/sai-rolotech-smart-engines",
      priority: 1,
      status: githubStatus,
      detail: githubDetail,
    });

    // Source 2: GitHub Archive ZIP
    let archiveStatus: "available" | "unknown" = "unknown";
    let archiveDetail = "";
    try {
      const archiveUrl = `https://codeload.github.com/${GITHUB_REPO}/zip/refs/heads/main`;
      const headRes = await fetch(archiveUrl, {
        method: "HEAD",
        headers: { "User-Agent": "SaiRolotech/1.0" },
        signal: AbortSignal.timeout(6000),
      });
      archiveStatus = headRes.ok || headRes.status === 302 ? "available" : "unknown";
      archiveDetail = headRes.ok ? "Archive endpoint reachable" : `HTTP ${headRes.status}`;
    } catch (err) {
      archiveDetail = `Not reachable: ${String(err).slice(0, 60)}`;
    }
    sources.push({
      id: "github-archive",
      name: "GitHub Archive ZIP",
      description: "Direct HTTPS ZIP download of main branch — bypasses git protocol issues",
      priority: 2,
      status: archiveStatus,
      detail: archiveDetail,
    });

    // Source 3: Google Drive
    let driveStatus: "available" | "no-package" | "unknown" = "unknown";
    let driveDetail = "";
    try {
      const manifest = await getDriveManifest();
      if (manifest) {
        driveStatus = "available";
        driveDetail = `Package: v${manifest.version} — ${manifest.archiveName} (${new Date(manifest.timestamp).toLocaleDateString("en-IN")})`;
      } else {
        driveStatus = "no-package";
        driveDetail = "Drive connected but no update package uploaded yet";
      }
    } catch (err) {
      driveDetail = `Drive error: ${String(err).slice(0, 80)}`;
    }
    sources.push({
      id: "google-drive",
      name: "Google Drive Archive",
      description: "Update package stored in Google Drive 'SAI-Rolotech-Updates' folder",
      priority: 3,
      status: driveStatus as "available" | "unknown" | "no-package",
      detail: driveDetail,
    });

    const available = sources.filter(s => s.status === "available").length;

    res.json({
      ok: true,
      summary: `${available}/${sources.length} sources available`,
      primarySource: sources.find(s => s.status === "available")?.id ?? "none",
      sources,
      autoUpdateEnabled,
      lastCheck: lastAutoCheck,
      lastResult: lastAutoResult,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * POST /api/system/multi-update
 * Manually trigger multi-source update (tries all sources in order)
 */
router.post("/system/multi-update", async (req: Request, res: Response) => {
  if (process.env["ELECTRON"] === "1") {
    res.json({ ok: false, message: "Git update disabled in packaged Electron app" });
    return;
  }
  try {
    const { skipGit, skipArchive, skipDrive, forceDrive } = req.body ?? {};

    logAuto("Manual multi-source update triggered...", "info");
    const result = await runMultiSourceUpdate({ skipGit, skipArchive, skipDrive, forceDrive });

    if (result.updated && result.sourceUsed !== "git-pull") {
      logAuto(`Multi-update: ${result.finalMessage}`, "success");
      // Run pnpm install if not already done
      await runShell(
        "pnpm install --prefer-frozen-lockfile 2>&1 || pnpm install --no-frozen-lockfile 2>&1",
        120000,
      );
    }

    logAuto(
      result.updated
        ? `UPDATE SUCCESS via ${result.sourceUsed}: ${result.finalMessage}`
        : `UPDATE FAILED: ${result.finalMessage}`,
      result.updated ? "success" : "error",
    );

    if (result.updated) {
      scheduleServerRestart(5);
    }

    res.json({
      ok: result.updated,
      sourceUsed: result.sourceUsed,
      attempts: result.attempts,
      message: result.finalMessage,
      willRestart: result.updated,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * POST /api/system/push-to-drive
 * Current code ka snapshot Google Drive pe upload karo (future fallback ke liye)
 */
router.post("/system/push-to-drive", async (req: Request, res: Response) => {
  try {
    const version: string = (req.body?.version as string) || `manual-${new Date().toISOString().slice(0, 10)}`;
    logAuto(`Google Drive pe update package upload ho raha — v${version}`, "info");

    const result = await uploadUpdateToDrive(version);

    logAuto(
      result.ok ? `Drive upload done: ${result.message}` : `Drive upload fail: ${result.message}`,
      result.ok ? "success" : "error",
    );

    res.json({ ok: result.ok, message: result.message, fileId: result.fileId });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * POST /api/system/test-sources
 * Test each source individually without updating
 */
router.post("/system/test-sources", async (_req: Request, res: Response) => {
  try {
    const results = await Promise.allSettled([
      tryGitPull(),
      tryGitHubArchive(),
      tryGoogleDriveUpdate(),
    ]);

    res.json({
      ok: true,
      note: "Test only — no files were changed (git-pull actually ran but archive/drive were simulated)",
      results: results.map((r) => r.status === "fulfilled" ? r.value : { ok: false, message: String(r.reason) }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

/**
 * GET /api/system/drive-manifest
 * Google Drive pe stored latest update package info
 */
router.get("/system/drive-manifest", async (_req: Request, res: Response) => {
  try {
    const manifest = await getDriveManifest();
    if (!manifest) {
      res.json({ ok: true, hasPackage: false, message: "Koi update package Drive pe nahi hai — push-to-drive se upload karo" });
      return;
    }
    res.json({ ok: true, hasPackage: true, manifest });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Public webhook router (no auth — GitHub directly calls this) ──────────────
export const githubWebhookPublicRouter: IRouter = _Router();

githubWebhookPublicRouter.post("/system/github-webhook", async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env["GITHUB_WEBHOOK_SECRET"] ?? "";
    const signature = req.headers["x-hub-signature-256"] as string ?? "";
    const event = req.headers["x-github-event"] as string ?? "";

    if (webhookSecret && signature) {
      const rawBody = JSON.stringify(req.body);
      const expected = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
      try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          logAuto("Webhook rejected — invalid signature", "warn");
          res.status(401).json({ ok: false, error: "Invalid webhook signature" });
          return;
        }
      } catch {
        res.status(401).json({ ok: false, error: "Signature verification error" });
        return;
      }
    }

    if (event !== "push") {
      res.json({ ok: true, message: `Event '${event}' ignored — only push handled` });
      return;
    }

    const payload = req.body as { ref?: string; pusher?: { name?: string }; head_commit?: { id?: string; message?: string } };
    const ref = payload.ref ?? "";
    if (!ref.endsWith("/main") && ref !== "refs/heads/main") {
      res.json({ ok: true, message: `Branch '${ref}' ignored` });
      return;
    }

    const pusher = payload.pusher?.name ?? "unknown";
    const commitId = payload.head_commit?.id?.slice(0, 10) ?? "?";
    const commitMsg = payload.head_commit?.message?.split("\n")[0]?.slice(0, 60) ?? "";
    logAuto(`[WEBHOOK] '${pusher}' ne push kiya — commit: ${commitId} "${commitMsg}" — auto-pull shuru!`, "success");

    res.json({ ok: true, message: "Webhook received — server updating...", commit: commitId, pusher });

    setTimeout(async () => {
      try {
        const result = await checkAndPull();
        logAuto(`[WEBHOOK] Pull result: ${result.message}`, result.updated ? "success" : "info");
      } catch (e: unknown) {
        logAuto(`[WEBHOOK] Pull error: ${e instanceof Error ? e.message : String(e)}`, "error");
      }
    }, 2000);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    res.status(500).json({ ok: false, error: message });
  }
});

githubWebhookPublicRouter.get("/system/github-webhook-info", (_req: Request, res: Response) => {
  const domain = process.env["REPLIT_DEV_DOMAIN"] ?? process.env["REPLIT_DOMAIN"] ?? "your-replit-domain";
  res.json({
    ok: true,
    webhookUrl: `https://${domain}/api/system/github-webhook`,
    secretConfigured: !!process.env["GITHUB_WEBHOOK_SECRET"],
    howTo: {
      step1: "GitHub repo kholo → Settings → Webhooks → Add webhook",
      step2: `Payload URL: https://${domain}/api/system/github-webhook`,
      step3: "Content type: application/json",
      step4: "Events: Just the push event ✓",
      step5: "Secret: GITHUB_WEBHOOK_SECRET (Replit Secrets mein set karo — optional)",
    },
  });
});

export default router;
