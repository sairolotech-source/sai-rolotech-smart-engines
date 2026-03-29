/**
 * audit-log.ts — Persistent Audit Log Backend
 * Sai Rolotech Smart Engines v2.4.0
 *
 * File-based JSON audit log with rotation.
 * Max 2000 entries — oldest rotated when limit hit.
 * Never crashes export flow — all errors silently logged.
 */

import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

const router = Router();

const LOG_FILE = path.resolve(__dirname, "../../data/audit-log.json");
const MAX_ENTRIES = 2000;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id:            string;
  timestamp:     string;
  user_id:       string;
  username:      string;
  role:          string;
  action:        AuditAction;
  station_no:    number | null;
  filename:      string;
  drawing_no:    string;
  revision:      string;
  customer_name: string;
  job_no:        string;
  release_state: string;
  success:       boolean;
  message:       string;
  metadata:      Record<string, unknown>;
}

type AuditAction =
  | "svg_export"
  | "dxf_export"
  | "pdf_export"
  | "pdf_all_export"
  | "zip_export"
  | "approval_change"
  | "revision_change"
  | "role_change"
  | "release_attempt_blocked"
  | "login"
  | "logout";

// ─── File helpers ───────────────────────────────────────────────────────────

function ensureDataDir(): void {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, "[]", "utf-8");
  }
}

function readLog(): AuditEntry[] {
  try {
    ensureDataDir();
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    return JSON.parse(raw) as AuditEntry[];
  } catch {
    return [];
  }
}

function writeLog(entries: AuditEntry[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch (e) {
    console.warn("[AuditLog] Write failed (non-fatal):", e);
  }
}

function generateId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── POST /api/audit-log ────────────────────────────────────────────────────

router.post("/", (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<AuditEntry>;
    const entry: AuditEntry = {
      id:            generateId(),
      timestamp:     new Date().toISOString(),
      user_id:       body.user_id     ?? "offline-user",
      username:      body.username    ?? "SAI Engineer",
      role:          body.role        ?? "designer",
      action:        (body.action     ?? "svg_export") as AuditAction,
      station_no:    body.station_no  ?? null,
      filename:      body.filename    ?? "",
      drawing_no:    body.drawing_no  ?? "",
      revision:      body.revision    ?? "R0",
      customer_name: body.customer_name ?? "",
      job_no:        body.job_no      ?? "",
      release_state: body.release_state ?? "draft",
      success:       body.success     !== false,
      message:       body.message     ?? "",
      metadata:      body.metadata    ?? {},
    };

    const entries = readLog();
    entries.unshift(entry); // newest first
    if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES);
    writeLog(entries);

    res.json({ status: "ok", id: entry.id });
  } catch (e) {
    // Never crash — audit failure is non-fatal
    console.warn("[AuditLog] POST error (non-fatal):", e);
    res.json({ status: "ok", id: "noop", warning: "Audit log unavailable" });
  }
});

// ─── GET /api/audit-log?limit=100&action=&role=&username= ─────────────────

router.get("/", (req: Request, res: Response) => {
  try {
    const limit   = Math.min(Number(req.query.limit)  || 100, 500);
    const action  = String(req.query.action  || "");
    const role    = String(req.query.role    || "");
    const username = String(req.query.username || "");
    const station = req.query.station_no !== undefined ? Number(req.query.station_no) : null;

    let entries = readLog();

    if (action)  entries = entries.filter(e => e.action === action);
    if (role)    entries = entries.filter(e => e.role === role);
    if (username) entries = entries.filter(e =>
      e.username.toLowerCase().includes(username.toLowerCase())
    );
    if (station !== null) entries = entries.filter(e => e.station_no === station);

    res.json({
      status: "ok",
      total:  entries.length,
      entries: entries.slice(0, limit),
    });
  } catch (e) {
    res.json({ status: "ok", total: 0, entries: [], warning: "Audit log unavailable" });
  }
});

// ─── DELETE /api/audit-log — admin only ────────────────────────────────────

router.delete("/", (req: Request, res: Response) => {
  try {
    writeLog([]);
    res.json({ status: "ok", message: "Audit log cleared" });
  } catch (e) {
    res.status(500).json({ status: "fail", reason: String(e) });
  }
});

export default router;
