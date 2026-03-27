import { Router, Request, Response } from "express";

const router = Router();

let SerialPortClass: any = null;
let ReadlineParserClass: any = null;
let serialAvailable = false;

try {
  SerialPortClass = require("serialport").SerialPort;
  ReadlineParserClass = require("@serialport/parser-readline").ReadlineParser;
  serialAvailable = true;
  console.log("[serial] SerialPort library loaded OK");
} catch {
  console.log("[serial] SerialPort not available — hardware routes disabled (normal on cloud/Replit)");
}

const activeConnections: Map<string, { port: any; parser: any; buffer: string[] }> = new Map();

function requireSerial(_req: Request, res: Response): boolean {
  if (!serialAvailable) {
    res.status(503).json({
      success: false,
      error: "SerialPort library not available. Yeh feature sirf Windows Desktop App (.exe) mein kaam karta hai.",
      hint: "GitHub Releases se .exe download karo: https://github.com/adminsairolotech-bit/sai-rolotech-smart-engines/releases"
    });
    return false;
  }
  return true;
}

router.get("/serial/ports", async (_req: Request, res: Response) => {
  if (!requireSerial(_req, res)) return;
  try {
    const ports = await SerialPortClass.list();
    res.json({
      success: true,
      ports: ports.map((p: any) => ({
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

router.post("/serial/connect", (req: Request, res: Response) => {
  if (!requireSerial(req, res)) return;
  const { path, baudRate = 115200, dataBits = 8, parity = "none", stopBits = 1 } = req.body;
  if (!path) { res.status(400).json({ success: false, error: "COM port path required" }); return; }
  if (activeConnections.has(path)) { res.json({ success: true, message: "Already connected", path }); return; }

  try {
    const port = new SerialPortClass({ path, baudRate: Number(baudRate), dataBits, parity, stopBits, autoOpen: false });
    const parser = port.pipe(new ReadlineParserClass({ delimiter: "\n" }));
    const buffer: string[] = [];

    port.open((err: any) => {
      if (err) { res.status(500).json({ success: false, error: `Port open failed: ${err.message}` }); return; }

      parser.on("data", (line: string) => {
        buffer.push(`[RX] ${line.trim()}`);
        if (buffer.length > 500) buffer.shift();
      });
      port.on("error", (e: any) => { console.error(`[serial] Error on ${path}:`, e.message); activeConnections.delete(path); });
      port.on("close", () => { console.log(`[serial] Port ${path} closed`); activeConnections.delete(path); });

      activeConnections.set(path, { port, parser, buffer });
      console.log(`[serial] Connected to ${path} @ ${baudRate} baud`);
      res.json({ success: true, message: `Connected to ${path}`, path, baudRate });
    });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.post("/serial/disconnect", (req: Request, res: Response) => {
  if (!requireSerial(req, res)) return;
  const { path } = req.body;
  const conn = activeConnections.get(path);
  if (!conn) { res.json({ success: true, message: "Not connected" }); return; }

  conn.port.close((err: any) => {
    activeConnections.delete(path);
    if (err) { res.status(500).json({ success: false, error: String(err) }); return; }
    res.json({ success: true, message: `Disconnected from ${path}` });
  });
});

router.post("/serial/send", (req: Request, res: Response) => {
  if (!requireSerial(req, res)) return;
  const { path, command } = req.body;
  const conn = activeConnections.get(path);
  if (!conn) { res.status(400).json({ success: false, error: "Not connected to this port" }); return; }
  if (!command) { res.status(400).json({ success: false, error: "Command required" }); return; }

  const cmd = command.trim() + "\n";
  conn.port.write(cmd, (err: any) => {
    if (err) { res.status(500).json({ success: false, error: String(err) }); return; }
    conn.buffer.push(`[TX] ${command.trim()}`);
    res.json({ success: true, sent: command.trim() });
  });
});

router.post("/serial/send-gcode", async (req: Request, res: Response) => {
  if (!requireSerial(req, res)) return;
  const { path, lines, delayMs = 100 } = req.body;
  const conn = activeConnections.get(path);
  if (!conn) { res.status(400).json({ success: false, error: "Not connected to this port" }); return; }
  if (!Array.isArray(lines) || lines.length === 0) { res.status(400).json({ success: false, error: "G-Code lines required" }); return; }

  res.json({ success: true, message: `Sending ${lines.length} lines to ${path}...`, total: lines.length });

  for (const line of lines) {
    const clean = (line as string).trim();
    if (!clean || clean.startsWith(";")) continue;
    await new Promise<void>((resolve, reject) => {
      conn.port.write(clean + "\n", (err: any) => {
        if (err) reject(err);
        else { conn.buffer.push(`[TX] ${clean}`); setTimeout(resolve, Number(delayMs)); }
      });
    }).catch(() => {});
  }
});

router.post("/serial/buffer", (req: Request, res: Response) => {
  if (!requireSerial(req, res)) return;
  const { path } = req.body;
  if (!path) { res.status(400).json({ success: false, error: "Path required" }); return; }
  const conn = activeConnections.get(path);
  if (!conn) { res.status(400).json({ success: false, error: "Not connected" }); return; }
  const lines = [...conn.buffer];
  conn.buffer.length = 0;
  res.json({ success: true, lines });
});

router.get("/serial/status", (_req: Request, res: Response) => {
  const connections = Array.from(activeConnections.entries()).map(([path, conn]) => ({
    path,
    isOpen: conn.port?.isOpen ?? false,
    baudRate: conn.port?.baudRate ?? 0,
  }));
  res.json({ success: true, available: serialAvailable, connections });
});

export default router;
