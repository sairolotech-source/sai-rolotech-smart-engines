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

async function runGit(cmd: string): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(`git -C "${REPO_ROOT}" ${cmd}`, {
      timeout: 30000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
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

async function checkAndPull(): Promise<{ updated: boolean; message: string }> {
  lastAutoCheck = new Date().toISOString();

  try {
    const localRes = await runGit("rev-parse HEAD");
    const localCommit = localRes.stdout.slice(0, 10);

    let githubCommit = "";
    try {
      const ghRes = await fetch(GITHUB_API, {
        headers: { "User-Agent": "SaiRolotech-AutoUpdate/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (ghRes.ok) {
        const ghData = await ghRes.json() as { sha: string };
        githubCommit = ghData.sha?.slice(0, 10) ?? "";
      }
    } catch {
      logAuto("GitHub reach nahi ho raha — internet check karo", "warn");
      lastAutoResult = "GitHub unreachable";
      return { updated: false, message: "GitHub unreachable" };
    }

    if (!githubCommit || localCommit === githubCommit) {
      logAuto(`Up to date — Local: ${localCommit} = GitHub: ${githubCommit}`, "info");
      lastAutoResult = "Up to date";
      return { updated: false, message: "Already up to date" };
    }

    logAuto(`Update milgaya! Local: ${localCommit} → GitHub: ${githubCommit} — Pulling...`, "info");

    const fetchRes = await runGit("fetch origin main --prune");
    if (!fetchRes.ok) {
      logAuto(`Fetch fail: ${fetchRes.stderr}`, "error");
      lastAutoResult = "Fetch failed";
      return { updated: false, message: `Fetch failed: ${fetchRes.stderr}` };
    }

    const pullRes = await runGit("pull origin main --no-rebase");
    if (!pullRes.ok) {
      logAuto(`Pull fail: ${pullRes.stderr}`, "error");
      lastAutoResult = "Pull failed";
      return { updated: false, message: `Pull failed: ${pullRes.stderr}` };
    }

    logAuto("Git pull complete — ab pnpm install chala rahe hain...", "info");

    const installRes = await runShell("pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1", 120000);
    if (installRes.ok) {
      logAuto("pnpm install complete!", "success");
    } else {
      logAuto(`pnpm install warning: ${installRes.stderr.slice(0, 200)}`, "warn");
    }

    const newCommitRes = await runGit("rev-parse HEAD");
    const newCommit = newCommitRes.stdout.slice(0, 10);

    const changedFilesRes = await runGit("diff --name-only HEAD~1 HEAD");
    const changes = changedFilesRes.stdout.split("\n").filter(Boolean);

    logAuto(`AUTO-UPDATE DONE! ${localCommit} → ${newCommit} | ${changes.length} files changed`, "success");
    lastAutoResult = `Updated: ${localCommit} → ${newCommit} (${changes.length} files)`;

    return { updated: true, message: `Updated to ${newCommit} — ${changes.length} files changed` };
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
    const fetchRes = await runGit("fetch origin main --prune");
    if (!fetchRes.ok) {
      res.status(500).json({ ok: false, error: `Fetch failed: ${fetchRes.stderr}` });
      return;
    }

    const diffRes = await runGit("rev-list HEAD..origin/main --count");
    const behindCount = parseInt(diffRes.stdout) || 0;

    if (behindCount === 0) {
      res.json({ ok: true, message: "Already up to date — koi naya update nahi", pulled: false, changes: [] });
      return;
    }

    const pullRes = await runGit("pull origin main --no-rebase");
    if (!pullRes.ok) {
      res.status(500).json({ ok: false, error: `Pull failed: ${pullRes.stderr}`, stdout: pullRes.stdout });
      return;
    }

    logAuto("Manual pull ke baad pnpm install chala rahe hain...", "info");
    const installRes = await runShell("pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1", 120000);
    if (installRes.ok) {
      logAuto("pnpm install complete after manual pull!", "success");
    }

    const changedFilesRes = await runGit("diff --name-only HEAD~1 HEAD");
    const changes = changedFilesRes.stdout.split("\n").filter(Boolean);

    const newCommitRes = await runGit("rev-parse HEAD");
    const newCommit = newCommitRes.stdout.slice(0, 10);

    const logRes = await runGit("log --oneline -3");

    res.json({
      ok: true,
      message: `✅ ${behindCount} commit(s) pull ho gaye! pnpm install bhi ho gaya!`,
      pulled: true,
      newCommit,
      behindCount,
      changes,
      log: logRes.stdout,
      output: pullRes.stdout,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Git pull failed";
    res.status(500).json({ ok: false, error: message });
  }
});

router.post("/system/git-push", async (req: Request, res: Response) => {
  try {
    const { message: commitMsg } = req.body as { message?: string };
    const msg = commitMsg?.trim() || `Auto-update: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

    const statusRes = await runGit("status --porcelain");
    if (!statusRes.stdout) {
      res.json({ ok: true, message: "Koi nayi changes nahi — nothing to push", pushed: false });
      return;
    }

    const addRes = await runGit("add -A");
    if (!addRes.ok) {
      res.status(500).json({ ok: false, error: `git add failed: ${addRes.stderr}` });
      return;
    }

    const commitRes = await runGit(`commit -m "${msg.replace(/"/g, "'")}"`);
    if (!commitRes.ok && !commitRes.stdout.includes("nothing to commit")) {
      res.status(500).json({ ok: false, error: `Commit failed: ${commitRes.stderr}` });
      return;
    }

    const pushRes = await runGit("push origin main");
    if (!pushRes.ok) {
      res.status(500).json({ ok: false, error: `Push failed: ${pushRes.stderr}` });
      return;
    }

    res.json({ ok: true, message: `✅ GitHub pe push ho gaya! Commit: "${msg}"`, pushed: true, output: pushRes.stdout });
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
