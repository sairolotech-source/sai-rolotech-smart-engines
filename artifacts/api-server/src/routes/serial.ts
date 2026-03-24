import { Router, Request, Response } from "express";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const router = Router();

// Active connections store
const activeConnections: Map<string, { port: SerialPort; parser: ReadlineParser; buffer: string[] }> = new Map();

// ── List available COM ports ──────────────────────────────────────────────────
router.get("/serial/ports", async (_req: Request, res: Response) => {
  try {
    const ports = await SerialPort.list();
    res.json({
      success: true,
      ports: ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || "Unknown",
        serialNumber: p.serialNumber || "",
        vendorId: p.vendorId || "",
        productId: p.productId || "",
        friendlyName: p.friendlyName || p.path,
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ── Connect to a COM port ─────────────────────────────────────────────────────
router.post("/serial/connect", (req: Request, res: Response) => {
  const { path, baudRate = 115200, dataBits = 8, parity = "none", stopBits = 1 } = req.body;

  if (!path) return res.status(400).json({ success: false, error: "COM port path required" });

  if (activeConnections.has(path)) {
    return res.json({ success: true, message: "Already connected", path });
  }

  try {
    const port = new SerialPort({ path, baudRate: Number(baudRate), dataBits, parity, stopBits, autoOpen: false });
    const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
    const buffer: string[] = [];

    port.open((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: `Port open failed: ${err.message}` });
      }

      parser.on("data", (line: string) => {
        buffer.push(`[RX] ${line.trim()}`);
        if (buffer.length > 500) buffer.shift();
      });

      port.on("error", (e) => {
        console.error(`[serial] Error on ${path}:`, e.message);
        activeConnections.delete(path);
      });

      port.on("close", () => {
        console.log(`[serial] Port ${path} closed`);
        activeConnections.delete(path);
      });

      activeConnections.set(path, { port, parser, buffer });
      console.log(`[serial] Connected to ${path} @ ${baudRate} baud`);
      res.json({ success: true, message: `Connected to ${path}`, path, baudRate });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

// ── Disconnect from a COM port ────────────────────────────────────────────────
router.post("/serial/disconnect", (req: Request, res: Response) => {
  const { path } = req.body;
  const conn = activeConnections.get(path);
  if (!conn) return res.json({ success: true, message: "Not connected" });

  conn.port.close((err) => {
    activeConnections.delete(path);
    if (err) return res.status(500).json({ success: false, error: String(err) });
    res.json({ success: true, message: `Disconnected from ${path}` });
  });
});

// ── Send G-Code command ───────────────────────────────────────────────────────
router.post("/serial/send", (req: Request, res: Response) => {
  const { path, command } = req.body;
  const conn = activeConnections.get(path);

  if (!conn) return res.status(400).json({ success: false, error: "Not connected to this port" });
  if (!command) return res.status(400).json({ success: false, error: "Command required" });

  const cmd = command.trim() + "\n";
  conn.port.write(cmd, (err) => {
    if (err) return res.status(500).json({ success: false, error: String(err) });
    conn.buffer.push(`[TX] ${command.trim()}`);
    res.json({ success: true, sent: command.trim() });
  });
});

// ── Send full G-Code file (line by line with delay) ───────────────────────────
router.post("/serial/send-gcode", async (req: Request, res: Response) => {
  const { path, lines, delayMs = 100 } = req.body;
  const conn = activeConnections.get(path);

  if (!conn) return res.status(400).json({ success: false, error: "Not connected to this port" });
  if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ success: false, error: "G-Code lines required" });

  res.json({ success: true, message: `Sending ${lines.length} lines to ${path}...`, total: lines.length });

  for (const line of lines) {
    const clean = line.trim();
    if (!clean || clean.startsWith(";")) continue;
    await new Promise<void>((resolve, reject) => {
      conn.port.write(clean + "\n", (err) => {
        if (err) reject(err);
        else {
          conn.buffer.push(`[TX] ${clean}`);
          setTimeout(resolve, Number(delayMs));
        }
      });
    }).catch(() => {});
  }
});

// ── Read received data buffer ─────────────────────────────────────────────────
router.post("/serial/buffer", (req: Request, res: Response) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ success: false, error: "Path required" });
  const conn = activeConnections.get(path);
  if (!conn) return res.status(400).json({ success: false, error: "Not connected" });
  const lines = [...conn.buffer];
  conn.buffer.length = 0;
  res.json({ success: true, lines });
});

// ── Status of all connections ─────────────────────────────────────────────────
router.get("/serial/status", (_req: Request, res: Response) => {
  const connections = Array.from(activeConnections.entries()).map(([path, conn]) => ({
    path,
    isOpen: conn.port.isOpen,
    baudRate: (conn.port as any).baudRate,
  }));
  res.json({ success: true, connections });
});

export default router;
