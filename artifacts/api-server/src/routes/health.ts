import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    uptime: Math.round(process.uptime()),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    ts: new Date().toISOString(),
  });
});

/**
 * GET /python-health — Proxy check to the Python FastAPI backend (port 9000).
 * Returns its health payload or a structured error so the frontend never needs
 * to know the internal Python port.
 */
router.get("/python-health", async (_req, res) => {
  const PYTHON_URL = "http://localhost:9000/api/health";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(PYTHON_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) {
      res.status(502).json({ status: "fail", error: `Python API returned HTTP ${r.status}`, pythonUrl: PYTHON_URL });
      return;
    }
    const payload = await r.json() as Record<string, unknown>;
    res.json({ status: "pass", ...payload, checkedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("abort") || msg.includes("AbortError");
    res.status(502).json({
      status: "fail",
      error: isTimeout ? "Python API timeout (>4s)" : `Python API unreachable: ${msg}`,
      pythonUrl: PYTHON_URL,
    });
  }
});

export default router;
