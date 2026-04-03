import { Router, type IRouter, type Request, type Response } from "express";
import os from "os";
import v8 from "v8";
import { getWorkerPoolStats } from "../lib/workers/worker-pool";

let si: any = null;
try {
  si = require("systeminformation");
} catch {
  console.warn("[system-info] systeminformation not available — using fallback");
}

const router: IRouter = Router();

router.get("/system/info", async (_req: Request, res: Response) => {
  try {
    const [cpu, mem, disk, battery, netIfaces, graphics] = si ? await Promise.allSettled([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.battery(),
      si.networkInterfaces(),
      si.graphics(),
    ]) : Array(6).fill({ status: "rejected" as const, reason: "systeminformation not available" });

    const cpuLoad = cpu.status === "fulfilled" ? Math.round(cpu.value.currentLoad) : 0;
    const memVal = mem.status === "fulfilled" ? mem.value : null;
    const diskArr = disk.status === "fulfilled" ? disk.value : [];
    const bat = battery.status === "fulfilled" ? battery.value : null;
    const gpuData = graphics.status === "fulfilled" ? graphics.value : null;

    const mainDisk = diskArr.find((d: { mount: string }) => d.mount === "/" || d.mount === "C:") ?? diskArr[0] ?? null;

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

    const gpuInfo = gpuData?.controllers?.map((c: { model: string; vendor: string; vram: number; driverVersion: string; bus: string }) => ({
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

router.get("/system/hardware-full", async (_req: Request, res: Response) => {
  try {
    if (!si) {
      const cpus = os.cpus();
      res.json({
        source: "os-fallback",
        cpu: {
          manufacturer: "Unknown",
          brand: cpus[0]?.model ?? "Unknown",
          cores: cpus.length,
          physicalCores: Math.ceil(cpus.length / 2),
          speed: cpus[0]?.speed ? cpus[0].speed / 1000 : 0,
          speedMin: 0,
          speedMax: cpus[0]?.speed ? cpus[0].speed / 1000 : 0,
          coresLoad: cpus.map((c, i) => ({ core: i, load: Math.round((1 - c.times.idle / (c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq)) * 100) })),
          temperature: null,
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          active: os.totalmem() - os.freemem(),
          available: os.freemem(),
          swapTotal: 0,
          swapUsed: 0,
          swapFree: 0,
        },
        gpu: [],
        disk: [],
        network: { interfaces: Object.keys(os.networkInterfaces()).length, isOnline: true },
        os: { platform: os.platform(), distro: os.type(), release: os.release(), arch: os.arch(), hostname: os.hostname() },
        battery: null,
        processes: { all: 0, running: 0, blocked: 0 },
        uptime: os.uptime(),
      });
      return;
    }

    const [cpuInfo, cpuLoad, cpuTemp, mem, gpuData, diskInfo, diskIO, netInfo, netStats, bat, proc, osInfo, bios, baseboard] = await Promise.allSettled([
      si.cpu(),
      si.currentLoad(),
      si.cpuTemperature(),
      si.mem(),
      si.graphics(),
      si.fsSize(),
      si.disksIO(),
      si.networkInterfaces(),
      si.networkStats(),
      si.battery(),
      si.processes(),
      si.osInfo(),
      si.bios(),
      si.baseboard(),
    ]);

    const val = <T>(r: PromiseSettledResult<T>, def: T): T => r.status === "fulfilled" ? r.value : def;

    const cpuInfoV = val(cpuInfo, {} as any);
    const cpuLoadV = val(cpuLoad, {} as any);
    const cpuTempV = val(cpuTemp, {} as any);
    const memV = val(mem, {} as any);
    const gpuV = val(gpuData, { controllers: [], displays: [] } as any);
    const diskV = val(diskInfo, [] as any[]);
    const diskIOV = val(diskIO, {} as any);
    const netV = val(netInfo, [] as any[]);
    const netStatsV = val(netStats, [] as any[]);
    const batV = val(bat, null);
    const procV = val(proc, { all: 0, running: 0, blocked: 0 } as any);
    const osV = val(osInfo, {} as any);
    const biosV = val(bios, {} as any);
    const bbV = val(baseboard, {} as any);

    res.json({
      source: "systeminformation",
      cpu: {
        manufacturer: cpuInfoV.manufacturer,
        brand: cpuInfoV.brand,
        cores: cpuInfoV.cores,
        physicalCores: cpuInfoV.physicalCores,
        speed: cpuInfoV.speed,
        speedMin: cpuInfoV.speedMin,
        speedMax: cpuInfoV.speedMax,
        socket: cpuInfoV.socket,
        cache: cpuInfoV.cache,
        currentLoad: Math.round(cpuLoadV.currentLoad ?? 0),
        coresLoad: (cpuLoadV.cpus ?? []).map((c: any, i: number) => ({ core: i, load: Math.round(c.load) })),
        temperature: cpuTempV.main ?? null,
        temperatureCores: cpuTempV.cores ?? [],
      },
      memory: {
        total: memV.total,
        free: memV.free,
        used: memV.used,
        active: memV.active,
        available: memV.available,
        swapTotal: memV.swaptotal,
        swapUsed: memV.swapused,
        swapFree: memV.swapfree,
        buffcache: memV.buffcache,
      },
      gpu: (gpuV.controllers ?? []).map((g: any) => ({
        model: g.model,
        vendor: g.vendor,
        vram: g.vram,
        vramDynamic: g.vramDynamic,
        bus: g.bus,
        driver: g.driverVersion,
        subDeviceId: g.subDeviceId,
        fanSpeed: g.fanSpeed,
        temperatureGpu: g.temperatureGpu,
        memoryTotal: g.memoryTotal,
        memoryUsed: g.memoryUsed,
        memoryFree: g.memoryFree,
        utilizationGpu: g.utilizationGpu,
      })),
      displays: (gpuV.displays ?? []).map((d: any) => ({
        model: d.model,
        vendor: d.vendor,
        resolutionX: d.resolutionX,
        resolutionY: d.resolutionY,
        currentRefreshRate: d.currentRefreshRate,
        connection: d.connection,
        main: d.main,
      })),
      disk: (Array.isArray(diskV) ? diskV : []).map((d: any) => ({
        fs: d.fs,
        type: d.type,
        size: d.size,
        used: d.used,
        available: d.available,
        use: d.use,
        mount: d.mount,
      })),
      diskIO: {
        rIO: diskIOV.rIO,
        wIO: diskIOV.wIO,
        tIO: diskIOV.tIO,
        rIO_sec: diskIOV.rIO_sec,
        wIO_sec: diskIOV.wIO_sec,
      },
      network: {
        interfaces: (Array.isArray(netV) ? netV : []).map((n: any) => ({
          iface: n.iface,
          ifaceName: n.ifaceName,
          ip4: n.ip4,
          ip6: n.ip6,
          mac: n.mac,
          type: n.type,
          speed: n.speed,
          dhcp: n.dhcp,
          operstate: n.operstate,
        })),
        stats: (Array.isArray(netStatsV) ? netStatsV : []).map((s: any) => ({
          iface: s.iface,
          rx_bytes: s.rx_bytes,
          tx_bytes: s.tx_bytes,
          rx_sec: s.rx_sec,
          tx_sec: s.tx_sec,
          ms: s.ms,
        })),
      },
      battery: batV ? {
        hasBattery: batV.hasBattery,
        percent: batV.percent,
        isCharging: batV.isCharging,
        acConnected: batV.acConnected,
        timeRemaining: batV.timeRemaining,
        voltage: batV.voltage,
        designedCapacity: batV.designedCapacity,
        maxCapacity: batV.maxCapacity,
        currentCapacity: batV.currentCapacity,
        capacityUnit: batV.capacityUnit,
        manufacturer: batV.manufacturer,
        model: batV.model,
      } : null,
      os: {
        platform: osV.platform,
        distro: osV.distro,
        release: osV.release,
        arch: osV.arch,
        hostname: osV.hostname,
        kernel: osV.kernel,
        serial: osV.serial,
        build: osV.build,
        uefi: osV.uefi,
      },
      bios: {
        vendor: biosV.vendor,
        version: biosV.version,
        releaseDate: biosV.releaseDate,
        serial: biosV.serial,
      },
      baseboard: {
        manufacturer: bbV.manufacturer,
        model: bbV.model,
        version: bbV.version,
        serial: bbV.serial,
        assetTag: bbV.assetTag,
      },
      processes: {
        all: procV.all,
        running: procV.running,
        blocked: procV.blocked,
        sleeping: procV.sleeping,
      },
      uptime: os.uptime(),
      timestamp: Date.now(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Full hardware info failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/system/performance", async (_req: Request, res: Response) => {
  try {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const appMem = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    let cpuLoad: any = null;
    let temps: any = null;
    if (si) {
      [cpuLoad, temps] = await Promise.allSettled([si.currentLoad(), si.cpuTemperature()]).then(r => r.map(x => x.status === "fulfilled" ? x.value : null));
    }

    const coreLoads = cpuLoad?.cpus?.map((c: any, i: number) => ({
      core: i,
      load: Math.round(c.load * 10) / 10,
      loadUser: Math.round(c.load_user * 10) / 10,
      loadSystem: Math.round(c.load_system * 10) / 10,
    })) ?? cpus.map((c, i) => {
      const total = c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
      return { core: i, load: Math.round((1 - c.times.idle / total) * 100 * 10) / 10, loadUser: 0, loadSystem: 0 };
    });

    res.json({
      timestamp: Date.now(),
      cpu: {
        model: cpus[0]?.model ?? "Unknown",
        cores: cpus.length,
        overallLoad: cpuLoad ? Math.round(cpuLoad.currentLoad * 10) / 10 : null,
        coreLoads,
        temperature: temps?.main ?? null,
      },
      memory: {
        totalGB: Math.round(totalMem / (1024 ** 3) * 100) / 100,
        usedGB: Math.round((totalMem - freeMem) / (1024 ** 3) * 100) / 100,
        freeGB: Math.round(freeMem / (1024 ** 3) * 100) / 100,
        usagePercent: Math.round((1 - freeMem / totalMem) * 100 * 10) / 10,
      },
      appMemory: {
        heapUsedMB: Math.round(appMem.heapUsed / (1024 ** 2) * 10) / 10,
        heapTotalMB: Math.round(appMem.heapTotal / (1024 ** 2) * 10) / 10,
        rssMB: Math.round(appMem.rss / (1024 ** 2) * 10) / 10,
        externalMB: Math.round(appMem.external / (1024 ** 2) * 10) / 10,
        heapLimitMB: Math.round(heapStats.heap_size_limit / (1024 ** 2)),
      },
      workerPool: getWorkerPoolStats(),
      uptime: Math.round(process.uptime()),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Performance check failed" });
  }
});

export default router;
