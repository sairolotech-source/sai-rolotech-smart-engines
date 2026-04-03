/**
 * engineering-engines.ts — Unified Engineering Engine Routes
 *
 * Provides:
 *   POST /api/dxf/normalize          — Geometry normalization
 *   POST /api/dxf/dimensions         — Auto-dimension extraction
 *   POST /api/dxf/convert-profile    — Centerline/inner/outer conversion
 *   POST /api/roll-pass/springback   — Springback compensation
 *   POST /api/roll-tooling/interference — Roll gap/interference check
 *   POST /api/roll-tooling/validate-stations — Station readiness validation
 *   GET  /api/pipeline/sessions      — List pipeline sessions
 *   GET  /api/pipeline/session/:id   — Get session detail
 *   GET  /api/pipeline/report/:id    — Download debug report
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { normalizeGeometry } from "../lib/geometry-normalizer";
import { extractDimensions } from "../lib/geometry-dimension-engine";
import { convertProfile, type InputType } from "../lib/centerline-converter";
import { calculateSpringback, MATERIAL_DATABASE, type MaterialCode } from "../lib/springback-engine";
import { checkAllStations } from "../lib/roll-interference-engine";
import {
  startSession, logStep, getSession, listSessions, generateDebugReport,
} from "../lib/pipeline-logger";
import type { ProfileGeometry } from "../lib/dxf-parser-util";

const router: IRouter = Router();

// ─── POST /api/dxf/normalize ─────────────────────────────────────────────────
router.post("/dxf/normalize", (req: Request, res: Response) => {
  try {
    const { geometry } = req.body as { geometry: ProfileGeometry };
    if (!geometry) {
      res.status(400).json({ error: "geometry required" });
      return;
    }
    const { geometry: normalized, health } = normalizeGeometry(geometry);
    res.json({ success: true, geometry: normalized, health });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Normalization failed";
    res.status(400).json({ error: msg });
  }
});

// ─── POST /api/dxf/dimensions ────────────────────────────────────────────────
router.post("/dxf/dimensions", (req: Request, res: Response) => {
  try {
    const { geometry, thickness } = req.body as {
      geometry: ProfileGeometry;
      thickness?: number;
    };
    if (!geometry) {
      res.status(400).json({ error: "geometry required" });
      return;
    }
    const { geometry: normalized, health } = normalizeGeometry(geometry);
    if (health.dimensionBlocked) {
      res.status(422).json({
        error: "Dimension extraction blocked by geometry error",
        health,
        blockReason: health.message,
      });
      return;
    }
    const dimensions = extractDimensions(normalized, thickness ?? 0);
    res.json({ success: true, dimensions, health });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Dimension extraction failed";
    res.status(400).json({ error: msg });
  }
});

// ─── POST /api/dxf/convert-profile ──────────────────────────────────────────
router.post("/dxf/convert-profile", (req: Request, res: Response) => {
  try {
    const { geometry, inputType, thicknessMm } = req.body as {
      geometry: ProfileGeometry;
      inputType: InputType;
      thicknessMm: number;
    };
    if (!geometry || !inputType || !thicknessMm) {
      res.status(400).json({
        error: "geometry, inputType (centerline|inner|outer), and thicknessMm are required",
      });
      return;
    }
    if (!["centerline", "inner", "outer"].includes(inputType)) {
      res.status(400).json({ error: "inputType must be: centerline | inner | outer" });
      return;
    }
    const result = convertProfile({ geometry, inputType, thicknessMm });
    res.json({ success: result.success, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Profile conversion failed";
    res.status(400).json({ error: msg });
  }
});

// ─── POST /api/roll-pass/springback ─────────────────────────────────────────
router.post("/roll-pass/springback", (req: Request, res: Response) => {
  try {
    const { material, thicknessMm, bends } = req.body as {
      material: MaterialCode;
      thicknessMm: number;
      bends: { bendIndex: number; targetAngleDeg: number; insideRadiusMm: number }[];
    };

    if (!material || !thicknessMm || !Array.isArray(bends) || bends.length === 0) {
      res.status(400).json({
        error: "material, thicknessMm, and bends[] are required",
        availableMaterials: Object.keys(MATERIAL_DATABASE),
      });
      return;
    }

    if (!MATERIAL_DATABASE[material]) {
      res.status(400).json({
        error: `Unknown material: ${material}`,
        availableMaterials: Object.keys(MATERIAL_DATABASE),
      });
      return;
    }

    const result = calculateSpringback(material, thicknessMm, bends);
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Springback calculation failed";
    res.status(400).json({ error: msg });
  }
});

// ─── GET /api/roll-pass/materials ────────────────────────────────────────────
router.get("/roll-pass/materials", (_req: Request, res: Response) => {
  res.json({
    success: true,
    materials: Object.entries(MATERIAL_DATABASE).map(([code, props]) => ({
      code,
      ...props,
    })),
  });
});

// ─── POST /api/roll-tooling/interference ────────────────────────────────────
router.post("/roll-tooling/interference", (req: Request, res: Response) => {
  try {
    const { stations } = req.body as { stations: Parameters<typeof checkAllStations>[0] };
    if (!Array.isArray(stations) || stations.length === 0) {
      res.status(400).json({ error: "stations[] array required" });
      return;
    }
    const report = checkAllStations(stations);
    res.json({ success: true, report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Interference check failed";
    res.status(400).json({ error: msg });
  }
});

// ─── POST /api/roll-tooling/validate-stations ────────────────────────────────
router.post("/roll-tooling/validate-stations", (req: Request, res: Response) => {
  try {
    const { stations } = req.body as {
      stations: {
        stationNo: number;
        hasRollProfile: boolean;
        upperRollSegments?: number;
        lowerRollSegments?: number;
        bendAngleDeg?: number;
        rollWidthMm?: number;
        outerDiameterMm?: number;
      }[];
    };

    if (!Array.isArray(stations)) {
      res.status(400).json({ error: "stations[] array required" });
      return;
    }

    const results = stations.map(st => {
      const checks: string[] = [];
      let status: "complete" | "incomplete" | "blocked" = "complete";

      if (!st.hasRollProfile) {
        checks.push("rollProfile missing");
        status = "blocked";
      }
      if ((st.upperRollSegments ?? 0) < 2) {
        checks.push("upperRoll has < 2 segments");
        if (status === "complete") status = "incomplete";
      }
      if ((st.lowerRollSegments ?? 0) < 2) {
        checks.push("lowerRoll has < 2 segments");
        if (status === "complete") status = "incomplete";
      }
      if (!st.bendAngleDeg || st.bendAngleDeg <= 0) {
        checks.push("bendAngle not set");
        if (status === "complete") status = "incomplete";
      }
      if (!st.rollWidthMm || st.rollWidthMm <= 0) {
        checks.push("rollWidth not set");
        if (status === "complete") status = "incomplete";
      }
      if (!st.outerDiameterMm || st.outerDiameterMm <= 0) {
        checks.push("outerDiameter not set");
        if (status === "complete") status = "incomplete";
      }

      return {
        stationNo: st.stationNo,
        status,
        badge: status === "complete" ? "green" : status === "incomplete" ? "yellow" : "red",
        failedChecks: checks,
        readinessScore: Math.max(0, Math.round(((6 - checks.length) / 6) * 100)),
      };
    });

    const complete = results.filter(r => r.status === "complete").length;
    const incomplete = results.filter(r => r.status === "incomplete").length;
    const blocked = results.filter(r => r.status === "blocked").length;

    const exportAllowed = blocked === 0 && incomplete === 0;

    res.json({
      success: true,
      results,
      summary: {
        total: stations.length,
        complete,
        incomplete,
        blocked,
        exportAllowed,
        exportBlockReason: !exportAllowed
          ? `${blocked} blocked, ${incomplete} incomplete station(s) — resolve before export`
          : null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Station validation failed";
    res.status(400).json({ error: msg });
  }
});

// ─── Pipeline Audit Routes ────────────────────────────────────────────────────
router.post("/pipeline/start", (_req: Request, res: Response) => {
  const sessionId = startSession();
  res.json({ success: true, sessionId });
});

router.post("/pipeline/log", (req: Request, res: Response) => {
  try {
    const { sessionId, name, status, message, warnings, errors, dataSnapshot } = req.body as {
      sessionId: string;
      name: string;
      status: string;
      message: string;
      warnings?: string[];
      errors?: string[];
      dataSnapshot?: Record<string, unknown>;
    };

    if (!sessionId || !name || !status) {
      res.status(400).json({ error: "sessionId, name, status, message required" });
      return;
    }

    const step = logStep(sessionId, name as any, status as any, message, {
      warnings, errors, dataSnapshot,
    });
    res.json({ success: true, step });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Log step failed";
    res.status(400).json({ error: msg });
  }
});

router.get("/pipeline/sessions", (_req: Request, res: Response) => {
  const sessions = listSessions().slice(0, 20).map(s => ({
    sessionId: s.sessionId,
    startedAt: s.startedAt,
    overallStatus: s.overallStatus,
    summary: s.summary,
    stepCount: s.steps.length,
  }));
  res.json({ success: true, sessions });
});

router.get("/pipeline/session/:id", (req: Request, res: Response) => {
  const session = getSession(req.params["id"] ?? "");
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ success: true, session });
});

router.get("/pipeline/report/:id", (req: Request, res: Response) => {
  const report = generateDebugReport(req.params["id"] ?? "");
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="pipeline-report-${req.params["id"]}.txt"`);
  res.send(report);
});

export default router;
