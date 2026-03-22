import { Router, type IRouter, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const router: IRouter = Router();
const execAsync = promisify(exec);

const REPO_ROOT = path.resolve("/home/runner/workspace");
const GITHUB_REPO = "sairolotech-source/sai-rolotech-smart-engines";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/commits/main`;

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

    const changedFilesRes = await runGit("diff --name-only HEAD~1 HEAD");
    const changes = changedFilesRes.stdout.split("\n").filter(Boolean);

    const newCommitRes = await runGit("rev-parse HEAD");
    const newCommit = newCommitRes.stdout.slice(0, 10);

    const logRes = await runGit("log --oneline -3");

    res.json({
      ok: true,
      message: `✅ ${behindCount} commit(s) pull ho gaye!`,
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

export default router;
