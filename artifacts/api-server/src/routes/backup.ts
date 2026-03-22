import { Router, type IRouter, type Request, type Response } from "express";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const MEMORY_FILE = path.join(DATA_DIR, "ai-memory.json");
const BACKUPS_DIR = path.join(DATA_DIR, "backups");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

export function createBackup(): string {
  ensureDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `ai-memory-${timestamp}.json`;
  const dest = path.join(BACKUPS_DIR, filename);
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      fs.copyFileSync(MEMORY_FILE, dest);
    } else {
      fs.writeFileSync(dest, "[]", "utf-8");
    }
    return dest;
  } catch {
    return "";
  }
}

let backupTimer: ReturnType<typeof setInterval> | null = null;
let exitHandlersRegistered = false;

export function startAutoBackup(intervalSeconds = 60) {
  if (backupTimer) clearInterval(backupTimer);
  backupTimer = setInterval(() => {
    createBackup();
  }, intervalSeconds * 1000);

  if (!exitHandlersRegistered) {
    exitHandlersRegistered = true;
    process.on("exit", () => createBackup());
    process.on("SIGTERM", () => { createBackup(); process.exit(0); });
    process.on("SIGINT", () => { createBackup(); process.exit(0); });
  }
}

export function setBackupInterval(intervalSeconds: number) {
  startAutoBackup(Math.max(10, intervalSeconds));
}

const router: IRouter = Router();

router.get("/backup/list", (_req: Request, res: Response) => {
  ensureDirs();
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const p = path.join(BACKUPS_DIR, f);
        const stat = fs.statSync(p);
        return { name: f, path: p, size: stat.size, created: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.created.localeCompare(a.created));
    res.json({ backups: files, count: files.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/backup/create", (_req: Request, res: Response) => {
  const dest = createBackup();
  if (dest) {
    res.json({ success: true, path: dest });
  } else {
    res.status(500).json({ error: "Backup failed" });
  }
});

router.post("/backup/restore", (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) {
      res.status(400).json({ error: "name required" });
      return;
    }
    const src = path.join(BACKUPS_DIR, path.basename(name));
    if (!fs.existsSync(src)) {
      res.status(404).json({ error: "Backup not found" });
      return;
    }
    ensureDirs();
    fs.copyFileSync(src, MEMORY_FILE);
    res.json({ success: true, message: `Restored from ${name}` });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
