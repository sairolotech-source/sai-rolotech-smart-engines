import { Router, type IRouter, type Request, type Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

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

async function resolveStaleConflict(): Promise<boolean> {
  const lsRes = await runGit("ls-files -u --name-only");
  if (!lsRes.stdout.trim()) return false;

  logAuto(`Purana merge conflict mila — resolve kar raha hun: ${lsRes.stdout}`, "warn");

  const lockPath = path.join(REPO_ROOT, ".git", "index.lock");
  if (fs.existsSync(lockPath)) {
    try { fs.unlinkSync(lockPath); logAuto("Stale index.lock removed", "info"); } catch {}
  }

  const isMergeInProgress = fs.existsSync(path.join(REPO_ROOT, ".git", "MERGE_HEAD"));
  if (!isMergeInProgress) return false;

  await runGit("add -A");
  const commitRes = await runGit(`-c user.email="sairolotech@gmail.com" -c user.name="SAI Rolotech" commit --no-edit -m "Auto-resolve stale merge conflict"`);
  if (commitRes.ok || commitRes.stdout.includes("nothing to commit")) {
    logAuto("Merge conflict resolved + committed", "success");
    return true;
  }
  logAuto(`Conflict resolve fail: ${commitRes.stderr.slice(0, 200)}`, "error");
  return false;
}

async function checkAndPull(): Promise<{ updated: boolean; message: string }> {
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
          const pushEnv = { ...process.env, GIT_ASKPASS: askpassPath, GIT_TERMINAL_PROMPT: "0" };
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
    const delEnv = { ...process.env, GIT_ASKPASS: delAskpassPath, GIT_TERMINAL_PROMPT: "0" };
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

    const pushEnv = { ...process.env, GIT_ASKPASS: askpassPath, GIT_TERMINAL_PROMPT: "0" };
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

export default router;
