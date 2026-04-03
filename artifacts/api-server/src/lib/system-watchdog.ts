/**
 * SAI Rolotech — System Watchdog
 *
 * Self-managing system:
 * 1. Auto-push to GitHub on startup + every 10 min (Replit → GitHub → Laptop)
 * 2. Auto-pull from GitHub every 5 min (any developer push → auto update here)
 * 3. API health monitor — checks critical routes every 2 min
 * 4. Self-heal — consecutive failures pe process restart
 */

import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import http from "http";

const execAsync = promisify(exec);

const REPO_ROOT = path.resolve(process.cwd());
const WATCHDOG_LOG_FILE = path.join(REPO_ROOT, "data", "watchdog.log");
const WATCHDOG_STATUS_FILE = path.join(REPO_ROOT, "data", "watchdog-status.json");

const AUTO_PUSH_INTERVAL_MS  = 10 * 60 * 1000;  // 10 min
const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000;  // 2 min
const MAX_CONSECUTIVE_FAILURES = 5;               // 5 failures → restart

export interface WatchdogStatus {
  startedAt: string;
  lastHealthCheck: string | null;
  lastGitPush: string | null;
  lastGitPushResult: string | null;
  lastGitPull: string | null;
  lastGitPullResult: string | null;
  gitPullCount: number;
  healthChecksPassed: number;
  healthChecksFailed: number;
  consecutiveFailures: number;
  gitPushCount: number;
  gitPushErrors: number;
  apiPort: number;
  isElectron: boolean;
  logs: WatchdogLogEntry[];
}

export interface WatchdogLogEntry {
  time: string;
  type: "info" | "success" | "warn" | "error";
  message: string;
}

const MAX_LOG_ENTRIES = 200;
let status: WatchdogStatus = {
  startedAt: new Date().toISOString(),
  lastHealthCheck: null,
  lastGitPush: null,
  lastGitPushResult: null,
  lastGitPull: null,
  lastGitPullResult: null,
  gitPullCount: 0,
  healthChecksPassed: 0,
  healthChecksFailed: 0,
  consecutiveFailures: 0,
  gitPushCount: 0,
  gitPushErrors: 0,
  apiPort: parseInt(process.env["PORT"] ?? "8080"),
  isElectron: process.env["ELECTRON"] === "1",
  logs: [],
};

function log(message: string, type: WatchdogLogEntry["type"] = "info") {
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const entry: WatchdogLogEntry = { time, type, message };
  status.logs.push(entry);
  if (status.logs.length > MAX_LOG_ENTRIES) {
    status.logs = status.logs.slice(-MAX_LOG_ENTRIES);
  }
  console.log(`[Watchdog] [${type.toUpperCase()}] ${message}`);

  // Append to log file
  try {
    const dataDir = path.dirname(WATCHDOG_LOG_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.appendFileSync(
      WATCHDOG_LOG_FILE,
      `[${new Date().toISOString()}] [${type.toUpperCase()}] ${message}\n`,
      "utf-8",
    );
  } catch { /* never fail from logging */ }
}

function saveStatus() {
  try {
    const dataDir = path.dirname(WATCHDOG_STATUS_FILE);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(WATCHDOG_STATUS_FILE, JSON.stringify(status, null, 2), "utf-8");
  } catch { /* ignore */ }
}

export function getWatchdogStatus(): WatchdogStatus {
  return status;
}

// ── Git helpers ──────────────────────────────────────────────────────────────

function buildGitEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  if (process.env["REPLIT_SESSION"]) {
    env["REPLIT_SESSION"] = process.env["REPLIT_SESSION"];
    env["REPLIT_ASKPASS_PID2_SESSION"] = process.env["REPLIT_SESSION"];
  }
  if (process.env["GIT_ASKPASS"]) env["GIT_ASKPASS"] = process.env["GIT_ASKPASS"];
  return env;
}

async function runGit(cmd: string): Promise<{ out: string; err: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(`git -C "${REPO_ROOT}" ${cmd}`, {
      timeout: 30000,
      env: buildGitEnv(),
    });
    return { out: stdout.trim(), err: stderr.trim(), ok: true };
  } catch (e: unknown) {
    const er = e as { stdout?: string; stderr?: string; message?: string };
    return { out: er.stdout?.trim() ?? "", err: er.stderr?.trim() ?? er.message ?? "", ok: false };
  }
}

// ── Auto-push to GitHub ──────────────────────────────────────────────────────

let pushInProgress = false;

export async function autoPushToGitHub(reason = "auto"): Promise<{
  pushed: boolean; message: string; commit?: string;
}> {
  if (pushInProgress) {
    return { pushed: false, message: "Push already in progress — skipping" };
  }

  // Electron mode mein git push nahi karte
  if (status.isElectron) {
    return { pushed: false, message: "Electron mode — git push disabled" };
  }

  // GitHub token check
  const ghToken = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? "";
  if (!ghToken) {
    return { pushed: false, message: "GITHUB_PERSONAL_ACCESS_TOKEN set nahi hai — push skip" };
  }

  pushInProgress = true;
  try {
    // Git config set karo
    await runGit(`config user.email "sairolotech@gmail.com"`);
    await runGit(`config user.name "SAI Rolotech"`);

    // Stale lock file hata do
    const lockPath = path.join(REPO_ROOT, ".git", "index.lock");
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
    }

    // Uncommitted changes check karo
    const statusRes = await runGit("status --porcelain");
    const hasUncommitted = !!statusRes.out.trim();

    if (hasUncommitted) {
      log(`[${reason}] Uncommitted changes mili — commit kar raha hai...`, "info");
      await runGit("add -A");
      await runGit("reset HEAD .github/").catch(() => {});
      const commitMsg = `SAI Rolotech auto-sync: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
      const commitRes = await runGit(`commit -m "${commitMsg}"`);
      if (!commitRes.ok && !commitRes.out.includes("nothing to commit")) {
        log(`Commit warning: ${commitRes.err.slice(0, 100)}`, "warn");
      }
    }

    // Unpushed commits check karo
    const aheadRes = await runGit("rev-list origin/main..HEAD --count");
    const aheadCount = parseInt(aheadRes.out) || 0;

    if (aheadCount === 0 && !hasUncommitted) {
      log(`[${reason}] Sab sync hai — GitHub up to date`, "info");
      status.lastGitPush = new Date().toISOString();
      status.lastGitPushResult = "up-to-date";
      saveStatus();
      return { pushed: false, message: "Already up to date" };
    }

    log(`[${reason}] ${aheadCount} commit(s) push ho rahe hain GitHub pe...`, "info");

    // askpass script se token use karo
    const askpassPath = `/tmp/sai-watchdog-askpass-${process.pid}.sh`;
    const safeToken = ghToken.replace(/'/g, "'\\''");
    fs.writeFileSync(
      askpassPath,
      `#!/bin/sh\ncase "$1" in\n  *[Uu]sername*) echo "x-access-token";;\n  *) echo '${safeToken}';;\nesac\n`,
      { mode: 0o700 },
    );

    const pushResult = await new Promise<{ ok: boolean; msg: string }>((resolve) => {
      const pushEnv: Record<string, string | undefined> = {
        ...process.env,
        GIT_ASKPASS: askpassPath,
        GIT_TERMINAL_PROMPT: "0",
      };
      delete pushEnv["REPLIT_SESSION"];
      delete pushEnv["REPLIT_ASKPASS_PID2_SESSION"];

      const cmd = `git -C "${REPO_ROOT}" -c core.askpass="${askpassPath}" -c credential.helper= push origin main`;
      exec(cmd, { timeout: 30000, env: pushEnv }, (err, stdout, stderr) => {
        if (err) resolve({ ok: false, msg: stderr?.trim() ?? err.message });
        else resolve({ ok: true, msg: stdout?.trim() || stderr?.trim() || "pushed" });
      });
    });

    try { fs.unlinkSync(askpassPath); } catch { /* ignore */ }

    const newHeadRes = await runGit("rev-parse HEAD");
    const newCommit = newHeadRes.out.slice(0, 10);

    if (pushResult.ok) {
      status.gitPushCount++;
      status.lastGitPush = new Date().toISOString();
      status.lastGitPushResult = `pushed → ${newCommit}`;
      log(`GitHub push DONE! ${aheadCount} commit(s) — HEAD: ${newCommit}`, "success");
      saveStatus();
      return { pushed: true, message: `${aheadCount} commit(s) pushed`, commit: newCommit };
    } else {
      status.gitPushErrors++;
      status.lastGitPushResult = `failed: ${pushResult.msg.slice(0, 80)}`;
      log(`GitHub push FAIL: ${pushResult.msg.slice(0, 150)}`, "error");
      saveStatus();
      return { pushed: false, message: `Push failed: ${pushResult.msg}` };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Push error";
    status.gitPushErrors++;
    log(`Auto-push error: ${msg}`, "error");
    saveStatus();
    return { pushed: false, message: msg };
  } finally {
    pushInProgress = false;
  }
}

// ── API Health Check ─────────────────────────────────────────────────────────

function checkApiHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const port = status.apiPort;
    const req = http.get(`http://localhost:${port}/api/healthz`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

// ── Watchdog start ───────────────────────────────────────────────────────────

let healthTimer: ReturnType<typeof setInterval> | null = null;
let pushTimer: ReturnType<typeof setInterval> | null = null;
let watchdogStarted = false;

export function startWatchdog() {
  if (watchdogStarted) return;
  watchdogStarted = true;

  log("Watchdog SHURU — auto-push + health monitor active", "success");
  saveStatus();

  // ── Startup pe pehla auto-push (10s delay) ──────────────────────────────
  if (!status.isElectron) {
    setTimeout(async () => {
      log("Startup auto-push check kar raha hai...", "info");
      const result = await autoPushToGitHub("startup");
      if (result.pushed) {
        log(`Startup push: ${result.message}`, "success");
      }
    }, 10_000);
  }

  // ── Health check every 2 min ─────────────────────────────────────────────
  healthTimer = setInterval(async () => {
    try {
      const healthy = await checkApiHealth();
      status.lastHealthCheck = new Date().toISOString();

      if (healthy) {
        status.healthChecksPassed++;
        status.consecutiveFailures = 0;
        log("Health: API OK", "info");
      } else {
        status.healthChecksFailed++;
        status.consecutiveFailures++;
        log(`Health: API FAIL (consecutive: ${status.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`, "warn");

        if (status.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          log("Bahut zyada failures — server restart ho raha hai (self-heal)", "error");
          saveStatus();
          // Graceful restart
          setTimeout(() => process.exit(1), 500);
        }
      }
      saveStatus();
    } catch (e: unknown) {
      log(`Health check error: ${e instanceof Error ? e.message : String(e)}`, "warn");
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  // ── Auto-push every 10 min ───────────────────────────────────────────────
  if (!status.isElectron) {
    pushTimer = setInterval(async () => {
      await autoPushToGitHub("scheduled");
    }, AUTO_PUSH_INTERVAL_MS);
  }

}

export function stopWatchdog() {
  if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
  if (pushTimer)   { clearInterval(pushTimer);   pushTimer   = null; }
  watchdogStarted = false;
  log("Watchdog BAND kiya", "warn");
}
