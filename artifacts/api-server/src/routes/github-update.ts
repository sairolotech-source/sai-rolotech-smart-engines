import { Router, type IRouter, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const router: IRouter = Router();
const execAsync = promisify(exec);

const REPO_ROOT = path.resolve("/home/runner/workspace");
const GITHUB_REPO = "sairolotech-source/sai-rolotech-smart-engines";
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

async function checkAndPull(): Promise<{ updated: boolean; message: string }> {
  lastAutoCheck = new Date().toISOString();

  try {
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

    const pullRes = await runGit("pull origin main --ff-only");
    if (!pullRes.ok) {
      logAuto(`FF pull fail — trying merge...`, "warn");
      const mergeRes = await runGit("pull origin main --no-rebase -X theirs");
      if (!mergeRes.ok) {
        logAuto(`Pull fail: ${mergeRes.stderr}`, "error");
        lastAutoResult = "Pull failed";
        return { updated: false, message: `Pull failed: ${mergeRes.stderr}` };
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

router.post("/system/git-push", async (req: Request, res: Response) => {
  try {
    const { message: commitMsg } = req.body as { message?: string };
    const msg = commitMsg?.trim() || `SAI Rolotech update: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

    await runGit(`config user.email "sairolotech@gmail.com"`);
    await runGit(`config user.name "SAI Rolotech"`);

    const statusRes = await runGit("status --porcelain");
    if (statusRes.stdout) {
      await runGit("add -A");
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
    const pushRes = await runGit("push origin main");
    if (!pushRes.ok) {
      res.status(500).json({ ok: false, error: `Push failed: ${pushRes.stderr}`, hint: "GitHub token/access check karo" });
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

export default router;
