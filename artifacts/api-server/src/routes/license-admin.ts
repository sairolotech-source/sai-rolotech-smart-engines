import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const REGISTRY_PATH = path.resolve("/home/runner/workspace/data/license-registry.json");
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] || "SAIRTECH-ADMIN-2026";

const VALID_LICENSE_KEYS = new Set([
  "SAIR-2026-ROLL-FORM",
  "SAIR-2026-ENGI-NEER",
  "SAIR-2026-PREM-IUMS",
  "SAIR-PRO-2026-MSTR",
  "SAIR-DEMO-2026-TRIAL",
]);

interface LicenseEntry {
  id: string;
  name: string;
  mobile: string;
  key: string;
  hwId: string;
  systemInfo: Record<string, string>;
  token: string;
  activatedAt: string;
  lastSeenAt: string;
  blocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  ipAddress: string;
}

function loadRegistry(): LicenseEntry[] {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
      fs.writeFileSync(REGISTRY_PATH, "[]", "utf8");
      return [];
    }
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8")) as LicenseEntry[];
  } catch {
    return [];
  }
}

function saveRegistry(data: LicenseEntry[]): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

function generateToken(hwId: string, name: string): string {
  const rand = crypto.randomBytes(12).toString("hex");
  const hash = crypto.createHash("sha256").update(`${hwId}|${name}|${rand}|SAITECH2026`).digest("hex").slice(0, 16);
  return `SAI-${hash.toUpperCase().slice(0, 4)}-${hash.slice(4, 8).toUpperCase()}-${rand.slice(0, 8).toUpperCase()}`;
}

function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function requireAdmin(req: Request, res: Response): boolean {
  const pwd = (req.headers["x-admin-password"] as string | undefined)
    || (req.query["pwd"] as string | undefined);
  if (pwd !== ADMIN_PASSWORD) {
    res.status(401).json({ ok: false, error: "Unauthorized — admin password galat hai" });
    return false;
  }
  return true;
}

// ── Public License Router (mounted at /license in apiRouter) ──────────────────
export const licenseRouter: IRouter = Router();

// POST /api/license/register
licenseRouter.post("/register", (req: Request, res: Response) => {
  const { key, name, mobile, hwId, systemInfo } = req.body as {
    key?: string; name?: string; mobile?: string;
    hwId?: string; systemInfo?: Record<string, string>;
  };

  if (!key || !name || !mobile || !hwId) {
    res.status(400).json({ ok: false, error: "key, name, mobile, hwId — sab zarori hain" });
    return;
  }

  const cleanKey = (key ?? "").trim().toUpperCase();
  if (!VALID_LICENSE_KEYS.has(cleanKey)) {
    res.status(403).json({ ok: false, error: "Invalid license key — sahi key daalo" });
    return;
  }

  const registry = loadRegistry();
  const existing = registry.find(e => e.hwId === hwId);

  if (existing) {
    if (existing.blocked) {
      res.status(403).json({
        ok: false, blocked: true,
        error: "Is system ka access admin ne band kar diya hai. SAI Rolotech se contact karein.",
      });
      return;
    }
    existing.lastSeenAt = new Date().toISOString();
    existing.name = name.trim();
    existing.mobile = mobile.trim();
    if (systemInfo) existing.systemInfo = systemInfo;
    saveRegistry(registry);
    res.json({ ok: true, token: existing.token, message: "Device already registered — token refreshed" });
    return;
  }

  const token = generateToken(hwId, name);
  const ip = ((req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "")
    .split(",")[0]?.trim() || "unknown";

  const entry: LicenseEntry = {
    id: generateId(),
    name: name.trim(),
    mobile: mobile.trim(),
    key: cleanKey,
    hwId,
    systemInfo: systemInfo ?? {},
    token,
    activatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    blocked: false,
    blockedAt: null,
    blockedReason: null,
    ipAddress: ip,
  };

  registry.push(entry);
  saveRegistry(registry);

  console.log(`[License] New registration: ${name} | ${mobile} | HW: ${hwId.slice(0, 8)}...`);
  res.json({ ok: true, token, message: `Welcome ${name}! Software activate ho gaya.` });
});

// GET /api/license/verify?token=xxx&hwId=yyy
licenseRouter.get("/verify", (req: Request, res: Response) => {
  const { token, hwId } = req.query as { token?: string; hwId?: string };

  if (!token || !hwId) {
    res.status(400).json({ active: false, reason: "token aur hwId dono chahiye" });
    return;
  }

  const registry = loadRegistry();
  const entry = registry.find(e => e.token === token && e.hwId === hwId);

  if (!entry) {
    res.json({ active: false, reason: "Token not found — please re-register" });
    return;
  }

  if (entry.blocked) {
    res.json({
      active: false, blocked: true,
      reason: entry.blockedReason || "Admin ne access band kar diya hai",
    });
    return;
  }

  entry.lastSeenAt = new Date().toISOString();
  saveRegistry(registry);
  res.json({ active: true, name: entry.name });
});

// ── Admin Router (mounted at /admin in apiRouter) ─────────────────────────────
export const adminRouter: IRouter = Router();

// GET /api/admin/users
adminRouter.get("/users", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const registry = loadRegistry();
  res.json({ ok: true, users: registry, total: registry.length });
});

// GET /api/admin/stats
adminRouter.get("/stats", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const registry = loadRegistry();
  const total = registry.length;
  const blocked = registry.filter(e => e.blocked).length;
  const active = total - blocked;
  const today = new Date().toDateString();
  const todayNew = registry.filter(e => new Date(e.activatedAt).toDateString() === today).length;
  res.json({ ok: true, total, active, blocked, todayNew });
});

// POST /api/admin/users/:id/block
adminRouter.post("/users/:id/block", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };
  const registry = loadRegistry();
  const entry = registry.find(e => e.id === id);
  if (!entry) { res.status(404).json({ ok: false, error: "User not found" }); return; }
  entry.blocked = true;
  entry.blockedAt = new Date().toISOString();
  entry.blockedReason = reason || "Admin ne block kiya";
  saveRegistry(registry);
  console.log(`[Admin] Blocked: ${entry.name} | ${entry.mobile}`);
  res.json({ ok: true, message: `${entry.name} ka access band kar diya gaya` });
});

// POST /api/admin/users/:id/unblock
adminRouter.post("/users/:id/unblock", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const registry = loadRegistry();
  const entry = registry.find(e => e.id === id);
  if (!entry) { res.status(404).json({ ok: false, error: "User not found" }); return; }
  entry.blocked = false;
  entry.blockedAt = null;
  entry.blockedReason = null;
  saveRegistry(registry);
  console.log(`[Admin] Unblocked: ${entry.name} | ${entry.mobile}`);
  res.json({ ok: true, message: `${entry.name} ka access restore kar diya gaya` });
});

// DELETE /api/admin/users/:id
adminRouter.delete("/users/:id", (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.params;
  const registry = loadRegistry();
  const idx = registry.findIndex(e => e.id === id);
  if (idx === -1) { res.status(404).json({ ok: false, error: "User not found" }); return; }
  const removed = registry.splice(idx, 1)[0];
  saveRegistry(registry);
  res.json({ ok: true, message: `${removed?.name} ka record delete kar diya gaya` });
});

console.log("[License] License + Admin routes loaded OK");
