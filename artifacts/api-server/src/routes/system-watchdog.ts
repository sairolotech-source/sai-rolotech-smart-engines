import { Router, type IRouter, type Request, type Response } from "express";
import {
  getWatchdogStatus,
  autoPushToGitHub,
  startWatchdog,
  stopWatchdog,
} from "../lib/system-watchdog.js";

const router: IRouter = Router();

/**
 * GET /api/system/watchdog-status
 * Pura system status — health, git push history, logs
 */
router.get("/system/watchdog-status", (_req: Request, res: Response) => {
  res.json(getWatchdogStatus());
});

/**
 * POST /api/system/auto-push
 * Manual trigger: abhi GitHub pe push karo
 */
router.post("/system/auto-push", async (_req: Request, res: Response) => {
  try {
    const result = await autoPushToGitHub("manual");
    res.json({
      ok: result.pushed || result.message.includes("up to date"),
      ...result,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * POST /api/system/watchdog-restart
 * Watchdog restart karo
 */
router.post("/system/watchdog-restart", (_req: Request, res: Response) => {
  stopWatchdog();
  startWatchdog();
  res.json({ ok: true, message: "Watchdog restart ho gaya" });
});

/**
 * GET /api/healthz (enhanced)
 * Quick health + sync status
 */
router.get("/system/full-health", (_req: Request, res: Response) => {
  const w = getWatchdogStatus();
  res.json({
    ok: true,
    server: "running",
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    apiPort: w.apiPort,
    isElectron: w.isElectron,
    health: {
      passed: w.healthChecksPassed,
      failed: w.healthChecksFailed,
      consecutiveFailures: w.consecutiveFailures,
      lastCheck: w.lastHealthCheck,
    },
    git: {
      pushCount: w.gitPushCount,
      pushErrors: w.gitPushErrors,
      lastPush: w.lastGitPush,
      lastResult: w.lastGitPushResult,
    },
    recentLogs: w.logs.slice(-20),
  });
});

export default router;
