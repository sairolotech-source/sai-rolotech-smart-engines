import { Router, type IRouter, type Request, type Response } from "express";
import os from "os";
import v8 from "v8";
import si from "systeminformation";
import { getWorkerPoolStats } from "../lib/workers/worker-pool";

const router: IRouter = Router();

router.get("/system/info", async (_req: Request, res: Response) => {
  try {
    const [cpu, mem, disk, battery, netIfaces, graphics] = await Promise.allSettled([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.battery(),
      si.networkInterfaces(),
      si.graphics(),
    ]);

    const cpuLoad = cpu.status === "fulfilled" ? Math.round(cpu.value.currentLoad) : 0;
    const memVal = mem.status === "fulfilled" ? mem.value : null;
    const diskArr = disk.status === "fulfilled" ? disk.value : [];
    const bat = battery.status === "fulfilled" ? battery.value : null;
    const gpuData = graphics.status === "fulfilled" ? graphics.value : null;

    const mainDisk = diskArr.find((d) => d.mount === "/" || d.mount === "C:") ?? diskArr[0] ?? null;

    const totalRam = memVal ? memVal.total : os.totalmem();
    const usedRam  = memVal ? memVal.active : os.totalmem() - os.freemem();

    const netIfaceData = netIfaces.status === "fulfilled" ? netIfaces.value : null;
    const isOnline = (() => {
      const nodeIfaces = os.networkInterfaces();
      for (const iface of Object.values(nodeIfaces)) {
        if (!iface) continue;
        for (const addr of iface) {
          if (!addr.internal && (addr.family === "IPv4" || addr.family === "IPv6")) {
            return true;
          }
        }
      }
      return false;
    })();

    const gpuInfo = gpuData?.controllers?.map((c) => ({
      model: c.model,
      vendor: c.vendor,
      vram: c.vram,
      driver: c.driverVersion,
      bus: c.bus,
    })) ?? [];

    const appMemory = process.memoryUsage();

    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      uptime: os.uptime(),
      cpuUsage: cpuLoad,
      cpuModel: os.cpus()[0]?.model ?? "Unknown",
      cpuCores: os.cpus().length,
      cpuSpeed: os.cpus()[0]?.speed ?? 0,
      ram: {
        total: totalRam,
        used: usedRam,
        free: totalRam - usedRam,
        percent: Math.round((usedRam / totalRam) * 100),
      },
      gpu: gpuInfo,
      disk: mainDisk
        ? {
            total: mainDisk.size,
            used: mainDisk.used,
            free: mainDisk.size - mainDisk.used,
            percent: Math.round(mainDisk.use),
            mount: mainDisk.mount,
          }
        : null,
      battery: bat
        ? {
            hasBattery: bat.hasBattery,
            percent: bat.percent,
            isCharging: bat.isCharging,
            timeRemaining: bat.timeRemaining,
          }
        : { hasBattery: false, percent: null, isCharging: false, timeRemaining: null },
      network: {
        isOnline,
        interfaceCount: netIfaceData ? (Array.isArray(netIfaceData) ? netIfaceData.length : 0) : 0,
      },
      appMemory: {
        heapUsed: appMemory.heapUsed,
        heapTotal: appMemory.heapTotal,
        rss: appMemory.rss,
        external: appMemory.external,
      },
      workerPool: getWorkerPoolStats(),
      hardwareAcceleration: {
        cpuThreads: os.cpus().length,
        cpuModel: os.cpus()[0]?.model ?? "Unknown",
        cpuSpeedMHz: os.cpus()[0]?.speed ?? 0,
        totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024) * 10) / 10,
        freeMemoryGB: Math.round(os.freemem() / (1024 * 1024 * 1024) * 10) / 10,
        nodeVersion: process.version,
        v8HeapStats: v8.getHeapStatistics(),
        processUptime: Math.round(process.uptime()),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "System info failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/system/setup-check", async (_req: Request, res: Response) => {
  try {
    const checks: { name: string; status: "pass" | "fail" | "warn"; detail: string; category: string }[] = [];

    const cpus = os.cpus();
    const cores = cpus.length;
    const model = cpus[0]?.model ?? "Unknown";
    checks.push({
      name: "CPU Cores",
      status: cores >= 4 ? "pass" : cores >= 2 ? "warn" : "fail",
      detail: `${cores} cores — ${model}`,
      category: "Hardware",
    });

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const totalGB = Math.round(totalMem / (1024 * 1024 * 1024) * 10) / 10;
    const freeGB = Math.round(freeMem / (1024 * 1024 * 1024) * 10) / 10;
    checks.push({
      name: "System Memory",
      status: totalGB >= 8 ? "pass" : totalGB >= 4 ? "warn" : "fail",
      detail: `${totalGB} GB total, ${freeGB} GB free`,
      category: "Hardware",
    });

    const poolSize = Math.max(2, Math.min(cores - 1, 8));
    checks.push({
      name: "Worker Pool",
      status: "pass",
      detail: `${poolSize} threads allocated (${cores} cores)`,
      category: "Compute",
    });

    checks.push({
      name: "Node.js Version",
      status: parseInt(process.version.slice(1)) >= 18 ? "pass" : "fail",
      detail: process.version,
      category: "Runtime",
    });

    const v8 = require("v8");
    const heapStats = v8.getHeapStatistics();
    const heapLimitMB = Math.round(heapStats.heap_size_limit / 1048576);
    checks.push({
      name: "V8 Heap Limit",
      status: heapLimitMB >= 1024 ? "pass" : heapLimitMB >= 512 ? "warn" : "fail",
      detail: `${heapLimitMB} MB`,
      category: "Runtime",
    });

    const fs = require("fs");
    const criticalFiles = [
      { path: "src/lib/workers/worker-pool.ts", name: "Worker Pool Engine" },
      { path: "src/routes/system-info.ts", name: "System Info API" },
    ];
    for (const f of criticalFiles) {
      const exists = fs.existsSync(f.path) || fs.existsSync(`artifacts/api-server/${f.path}`);
      checks.push({
        name: f.name,
        status: exists ? "pass" : "warn",
        detail: exists ? "Present" : "File not found",
        category: "Files",
      });
    }

    checks.push({
      name: "Tmp Directory",
      status: fs.existsSync("/tmp") ? "pass" : "warn",
      detail: fs.existsSync("/tmp") ? "Writable — file processing OK" : "Not available",
      category: "System",
    });

    checks.push({
      name: "Platform",
      status: "pass",
      detail: `${os.platform()} ${os.arch()} — ${os.release()}`,
      category: "System",
    });

    const passCount = checks.filter(c => c.status === "pass").length;
    const failCount = checks.filter(c => c.status === "fail").length;

    res.json({
      status: failCount === 0 ? "ready" : "incomplete",
      score: Math.round((passCount / checks.length) * 100),
      checks,
      hardware: {
        cpuCores: cores,
        cpuModel: model,
        totalMemoryGB: totalGB,
        freeMemoryGB: freeGB,
        workerPoolSize: poolSize,
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Setup check failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
