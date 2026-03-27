import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Cpu, MemoryStick, Monitor, Zap, Activity, Server,
  RefreshCw, PlayCircle, Thermometer, Gauge, Layers,
  Wifi, CheckCircle2, AlertCircle, Battery, Signal, Usb, Send, Link,
} from "lucide-react";
import {
  getHardwareCapabilities,
  ensureWorkerPool,
  getWorkerStats,
  getMemorySnapshot,
} from "../../lib/hardware-engine";
import { getGpuInfo, detectGpuTier, getEstimatedVRAM } from "../../lib/gpu-tier";
import { initGPUComputePipeline } from "../../lib/gpu-compute-pipeline";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NvidiaStats {
  available: boolean;
  name: string;
  utilGpu: number;
  memUsed: number;
  memTotal: number;
  tempC: number;
  powerW: number;
  clockMHz: number;
}

interface ElectronHW {
  coreUtils: number[];
  avgCpu: number;
  cpuModel: string;
  cpuCores: number;
  cpuSpeedMHz: number;
  totalRam: number;
  freeRam: number;
  usedRam: number;
  ramPct: number;
  nvidia: NvidiaStats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtGB(bytes: number) { return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB"; }
function fmtMB(bytes: number) { return (bytes / 1024 / 1024).toFixed(0) + " MB"; }

function Bar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span className="text-[11px] font-bold" style={{ color: color ?? "rgba(255,255,255,0.9)" }}>{value}</span>
    </div>
  );
}

function CoreGrid({ utils }: { utils: number[] }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(utils.length, 8)}, 1fr)` }}>
      {utils.map((u, i) => {
        const color = u > 80 ? "#ef4444" : u > 50 ? "#f59e0b" : "#22c55e";
        return (
          <div key={i} className="rounded flex flex-col items-center gap-0.5 p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="w-full rounded" style={{ height: 24, background: "rgba(255,255,255,0.06)", position: "relative" }}>
              <div className="absolute bottom-0 w-full rounded transition-all duration-500" style={{ height: `${u}%`, background: color }} />
            </div>
            <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.35)" }}>C{i}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HardwareDashboardView() {
  const isElectron = !!(window as any).electronAPI?.isElectron;
  const [elHW, setElHW] = useState<ElectronHW | null>(null);
  const [boostMode, setBoostMode] = useState(false);
  const [gpuReady, setGpuReady] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResult, setBenchResult] = useState<string | null>(null);
  const [workerStats, setWorkerStats] = useState({ poolSize: 0, active: 0, queued: 0, totalProcessed: 0, avgComputeMs: 0 });
  const [browserGpu, setBrowserGpu] = useState({ renderer: "", tier: "medium", vramGB: 0, webgl2: false, webgpu: false, brand: "unknown" });
  const [jsHeap, setJsHeap] = useState({ usedMB: 0, limitMB: 0, percent: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Battery ─────────────────────────────────────────────────────────────────
  const [battery, setBattery] = useState<{ level: number; charging: boolean; timeLeft: number } | null>(null);

  // ── Screen ──────────────────────────────────────────────────────────────────
  const [screenInfo] = useState({
    width: screen.width,
    height: screen.height,
    pixelRatio: window.devicePixelRatio,
    colorDepth: screen.colorDepth,
  });

  // ── Network ─────────────────────────────────────────────────────────────────
  const [network, setNetwork] = useState({ online: navigator.onLine, type: "unknown", speed: "" });

  // ── WebSerial CNC ───────────────────────────────────────────────────────────
  const webSerialSupported = "serial" in navigator;
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialPort, setSerialPort] = useState<any>(null);
  const [serialLog, setSerialLog] = useState<string[]>(["CNC connect karo..."]);
  const [gcodeInput, setGcodeInput] = useState("G28\nG1 X10 Y10 F1000\nM114");
  const [sendingGcode, setSendingGcode] = useState(false);
  const serialLogRef = useRef<HTMLDivElement>(null);

  // ── Electron native polling ──────────────────────────────────────────────
  const pollElectron = useCallback(async () => {
    try {
      const hw = await (window as any).electronAPI.getLiveHardware();
      setElHW(hw);
    } catch (e) { /* ignore */ }
  }, []);

  // ── Browser fallback polling ─────────────────────────────────────────────
  const pollBrowser = useCallback(() => {
    ensureWorkerPool();
    setWorkerStats(getWorkerStats());
    const mem = getMemorySnapshot();
    setJsHeap({ usedMB: mem.usedMB, limitMB: mem.limitMB, percent: mem.percent });
    const gpuInfo = getGpuInfo();
    setBrowserGpu({
      renderer: gpuInfo.renderer,
      tier: detectGpuTier(),
      vramGB: getEstimatedVRAM(),
      webgl2: gpuInfo.webgl2,
      webgpu: gpuInfo.webgpu,
      brand: gpuInfo.brand,
    });
  }, []);

  useEffect(() => {
    initGPUComputePipeline().then(() => setGpuReady(true)).catch(() => {});
    if (isElectron) {
      pollElectron();
      intervalRef.current = setInterval(pollElectron, 1000);
    } else {
      pollBrowser();
      intervalRef.current = setInterval(pollBrowser, 800);
    }

    // Battery API
    if ("getBattery" in navigator) {
      (navigator as any).getBattery().then((bat: any) => {
        const update = () => setBattery({ level: Math.round(bat.level * 100), charging: bat.charging, timeLeft: bat.dischargingTime });
        update();
        bat.addEventListener("levelchange", update);
        bat.addEventListener("chargingchange", update);
      }).catch(() => {});
    }

    // Network API
    const conn = (navigator as any).connection || (navigator as any).mozConnection || null;
    if (conn) {
      const updateNet = () => setNetwork({ online: navigator.onLine, type: conn.effectiveType || conn.type || "unknown", speed: conn.downlink ? `${conn.downlink} Mbps` : "" });
      updateNet();
      conn.addEventListener("change", updateNet);
    }
    window.addEventListener("online", () => setNetwork(n => ({ ...n, online: true })));
    window.addEventListener("offline", () => setNetwork(n => ({ ...n, online: false })));

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isElectron, pollElectron, pollBrowser]);

  // ── Serial Log scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (serialLogRef.current) serialLogRef.current.scrollTop = serialLogRef.current.scrollHeight;
  }, [serialLog]);

  const addSerialLog = (msg: string) => {
    const t = new Date().toLocaleTimeString("en-IN", { hour12: false });
    setSerialLog(prev => [...prev.slice(-80), `[${t}] ${msg}`]);
  };

  const connectSerial = async () => {
    try {
      addSerialLog("⏳ CNC machine se connect ho raha hai...");
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      setSerialPort(port); setSerialConnected(true);
      addSerialLog("✅ CNC Connected! Baudrate: 115200");
      const reader = port.readable?.getReader();
      if (reader) {
        const dec = new TextDecoder();
        (async () => { try { while (true) { const { value, done } = await reader.read(); if (done) break; addSerialLog(`← ${dec.decode(value).trim()}`); } } catch {} })();
      }
    } catch (e: any) { addSerialLog(`❌ ${e.message}`); }
  };

  const disconnectSerial = async () => {
    try { if (serialPort) { await serialPort.close(); setSerialPort(null); setSerialConnected(false); addSerialLog("🔌 Disconnected"); } } catch {}
  };

  const sendGcode = async () => {
    if (!serialPort || !gcodeInput.trim()) return;
    setSendingGcode(true);
    try {
      const writer = serialPort.writable.getWriter();
      const enc = new TextEncoder();
      const lines = gcodeInput.split("\n").map((l: string) => l.trim()).filter((l: string) => l && !l.startsWith(";"));
      for (const line of lines) { await writer.write(enc.encode(line + "\n")); addSerialLog(`→ ${line}`); await new Promise(r => setTimeout(r, 60)); }
      writer.releaseLock();
      addSerialLog(`✅ ${lines.length} commands bheje!`);
    } catch (e: any) { addSerialLog(`❌ Send error: ${e.message}`); }
    setSendingGcode(false);
  };

  // ── CPU Benchmark ─────────────────────────────────────────────────────────
  const runBenchmark = useCallback(() => {
    if (benchRunning) return;
    setBenchRunning(true);
    setBenchResult(null);
    const cores = navigator.hardwareConcurrency || 4;
    const t0 = performance.now();
    let done = 0;
    for (let i = 0; i < cores; i++) {
      const code = `self.onmessage=function(e){let s=0,n=e.data;for(let i=0;i<n;i++)s+=Math.sqrt(i)*Math.sin(i);self.postMessage(s);}`;
      const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
      const w = new Worker(url);
      w.onmessage = () => {
        w.terminate(); URL.revokeObjectURL(url); done++;
        if (done === cores) {
          const dt = performance.now() - t0;
          const score = Math.round((cores * 2_000_000) / dt);
          setBenchResult(`${cores} cores | ${dt.toFixed(0)}ms | ${score.toLocaleString()} ops/sec`);
          setBenchRunning(false);
        }
      };
      w.postMessage(2_000_000);
    }
  }, [benchRunning]);

  // ─── NVIDIA GPU Card ───────────────────────────────────────────────────────
  const NvidiaCard = ({ nv }: { nv: NvidiaStats }) => {
    const utilColor = nv.utilGpu > 80 ? "#ef4444" : nv.utilGpu > 50 ? "#f59e0b" : "#22c55e";
    const vramPct = nv.memTotal > 0 ? Math.round((nv.memUsed / nv.memTotal) * 100) : 0;
    const tempColor = nv.tempC > 85 ? "#ef4444" : nv.tempC > 70 ? "#f59e0b" : "#22c55e";
    return (
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.25)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
              <Monitor className="w-4 h-4" style={{ color: "#22c55e" }} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">NVIDIA GPU</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{nv.name || "Detecting..."}</p>
            </div>
          </div>
          <span className="text-sm font-bold" style={{ color: utilColor }}>{nv.utilGpu}%</span>
        </div>

        {/* GPU Utilization */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>GPU Utilization</span>
            <span style={{ color: utilColor }}>{nv.utilGpu}%</span>
          </div>
          <Bar value={nv.utilGpu} color={utilColor} height={10} />
        </div>

        {/* VRAM */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>VRAM</span>
            <span style={{ color: "#a855f7" }}>{nv.memUsed} / {nv.memTotal} MB ({vramPct}%)</span>
          </div>
          <Bar value={vramPct} color="#a855f7" height={10} />
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { l: "Temp", v: `${nv.tempC}°C`, c: tempColor, icon: <Thermometer className="w-3 h-3" /> },
            { l: "Power", v: `${nv.powerW.toFixed(0)}W`, c: "#f59e0b", icon: <Zap className="w-3 h-3" /> },
            { l: "Clock", v: `${nv.clockMHz}MHz`, c: "#06b6d4", icon: <Gauge className="w-3 h-3" /> },
          ].map(({ l, v, c, icon }) => (
            <div key={l} className="rounded-xl p-2 text-center space-y-1" style={{ background: "rgba(255,255,255,0.04)" }}>
              <div className="flex justify-center" style={{ color: c }}>{icon}</div>
              <p className="text-[11px] font-bold" style={{ color: c }}>{v}</p>
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── RAM Card (Electron = real system RAM) ─────────────────────────────────
  const RamCard = () => {
    const totalBytes = elHW?.totalRam ?? 0;
    const usedBytes = elHW?.usedRam ?? 0;
    const pct = elHW?.ramPct ?? jsHeap.percent;
    const color = pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#22c55e";
    return (
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(34,197,94,0.15)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
              <MemoryStick className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">RAM — System Memory</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                {isElectron ? "Real system RAM (native)" : "JS Heap (browser)"}
              </p>
            </div>
          </div>
          <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
        </div>
        <Bar value={pct} color={color} height={12} />
        <div className="grid grid-cols-3 gap-2">
          {(isElectron ? [
            { l: "Used", v: fmtGB(usedBytes) },
            { l: "Free", v: fmtGB(totalBytes - usedBytes) },
            { l: "Total", v: fmtGB(totalBytes) },
          ] : [
            { l: "Used", v: `${jsHeap.usedMB} MB` },
            { l: "Free", v: `${jsHeap.limitMB - jsHeap.usedMB} MB` },
            { l: "Limit", v: `${jsHeap.limitMB} MB` },
          ]).map(({ l, v }) => (
            <div key={l} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-[11px] font-bold" style={{ color }}>{v}</p>
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── CPU Card (Electron = real % per core) ────────────────────────────────
  const CpuCard = () => {
    const avgCpu = elHW?.avgCpu ?? workerStats.active;
    const cores = elHW?.cpuCores ?? navigator.hardwareConcurrency ?? 4;
    const coreUtils = elHW?.coreUtils ?? [];
    const cpuColor = avgCpu > 80 ? "#ef4444" : avgCpu > 50 ? "#f59e0b" : "#06b6d4";
    const model = elHW?.cpuModel ?? "CPU";
    const speedGHz = elHW ? (elHW.cpuSpeedMHz / 1000).toFixed(1) + " GHz" : "";
    return (
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(6,182,212,0.2)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(6,182,212,0.12)" }}>
              <Cpu className="w-4 h-4" style={{ color: "#06b6d4" }} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">CPU — Processor</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                {model.length > 32 ? model.slice(0, 32) + "…" : model} {speedGHz && `• ${speedGHz}`}
              </p>
            </div>
          </div>
          <span className="text-sm font-bold" style={{ color: cpuColor }}>{avgCpu}%</span>
        </div>
        <Bar value={avgCpu} color={cpuColor} height={12} />

        {/* Per-core bars when in Electron */}
        {isElectron && coreUtils.length > 0 && (
          <div>
            <p className="text-[10px] mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
              Per Core Utilization ({cores} cores)
            </p>
            <CoreGrid utils={coreUtils} />
          </div>
        )}

        {/* Worker pool when browser */}
        {!isElectron && (
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.min(cores, 16) }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full transition-all duration-300"
                style={{
                  background: i < workerStats.active ? "#f59e0b" : "rgba(255,255,255,0.12)",
                  boxShadow: i < workerStats.active ? "0 0 6px rgba(245,158,11,0.7)" : "none",
                }}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "Cores", v: `${cores}` },
            { l: isElectron ? "Avg CPU" : "Workers", v: isElectron ? `${avgCpu}%` : `${workerStats.poolSize}` },
            { l: isElectron ? "Speed" : "Tasks Done", v: isElectron ? speedGHz : workerStats.totalProcessed.toLocaleString() },
          ].map(({ l, v }) => (
            <div key={l} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="text-[11px] font-bold" style={{ color: "#06b6d4" }}>{v}</p>
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: "#04060e", scrollbarWidth: "thin", scrollbarColor: "rgba(245,158,11,0.2) transparent" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "#f59e0b" }} />
            Hardware Dashboard
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {isElectron
              ? "Laptop ka actual NVIDIA GPU, CPU, RAM live dekh rahe ho"
              : "Browser mode — WebGL GPU + JS workers"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isElectron ? (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
              <CheckCircle2 className="w-3 h-3" /> Native Mode
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
              <Wifi className="w-3 h-3" /> Browser Mode
            </span>
          )}
          <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
      </div>

      {/* ── Boost Mode Toggle ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:opacity-90"
        style={{
          background: boostMode
            ? "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))"
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${boostMode ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
        }}
        onClick={() => setBoostMode(b => !b)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: boostMode ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.06)" }}>
            <Zap className="w-5 h-5" style={{ color: boostMode ? "#f59e0b" : "rgba(255,255,255,0.3)" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: boostMode ? "#f59e0b" : "rgba(255,255,255,0.7)" }}>
              Hardware Boost Mode
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              {boostMode
                ? isElectron
                  ? `NVIDIA GPU + sab ${elHW?.cpuCores ?? navigator.hardwareConcurrency} cores full power`
                  : "All workers + WebGL max quality"
                : "Standard mode — battery friendly"}
            </p>
          </div>
        </div>
        <div className="w-12 h-6 rounded-full relative transition-all" style={{ background: boostMode ? "#f59e0b" : "rgba(255,255,255,0.12)" }}>
          <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: boostMode ? "26px" : "2px" }} />
        </div>
      </div>

      {/* ── NVIDIA Card (Electron only) ───────────────────────────────────── */}
      {isElectron && elHW?.nvidia?.available && (
        <NvidiaCard nv={elHW.nvidia} />
      )}

      {/* No NVIDIA GPU message */}
      {isElectron && elHW && !elHW.nvidia.available && (
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <AlertCircle className="w-5 h-5 shrink-0" style={{ color: "#f59e0b" }} />
          <div>
            <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>NVIDIA GPU nahi mila</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              AMD / Intel GPU hai ya `nvidia-smi` installed nahi — CPU + RAM stats normal chal rahe hain
            </p>
          </div>
        </div>
      )}

      {/* Browser GPU info (non-Electron) */}
      {!isElectron && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.15)" }}>
                <Monitor className="w-4 h-4" style={{ color: "#a855f7" }} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">GPU — WebGL</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{browserGpu.renderer || "Detecting..."}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { l: "Tier", v: browserGpu.tier.toUpperCase(), c: "#a855f7" },
              { l: "VRAM", v: `${browserGpu.vramGB}GB`, c: "#06b6d4" },
              { l: "WebGL2", v: browserGpu.webgl2 ? "Yes" : "No", c: browserGpu.webgl2 ? "#22c55e" : "#ef4444" },
              { l: "Compute", v: gpuReady ? "Ready" : "N/A", c: gpuReady ? "#22c55e" : "#f59e0b" },
            ].map(({ l, v, c }) => (
              <div key={l} className="rounded-lg px-3 py-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-bold" style={{ color: c }}>{v}</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CPU Card ─────────────────────────────────────────────────────── */}
      <CpuCard />

      {/* ── RAM Card ─────────────────────────────────────────────────────── */}
      <RamCard />

      {/* ── Benchmark ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4" style={{ color: "#f59e0b" }} />
            <p className="text-xs font-bold text-white">CPU Benchmark Test</p>
          </div>
          <button
            onClick={runBenchmark}
            disabled={benchRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: "rgba(245,158,11,0.2)",
              border: "1px solid rgba(245,158,11,0.4)",
              color: "#fcd34d",
              cursor: benchRunning ? "not-allowed" : "pointer",
              opacity: benchRunning ? 0.6 : 1,
            }}
          >
            {benchRunning
              ? <><RefreshCw className="w-3 h-3 animate-spin" /> Running...</>
              : <><PlayCircle className="w-3 h-3" /> Test Chalao</>}
          </button>
        </div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          Sab {elHW?.cpuCores ?? navigator.hardwareConcurrency ?? 4} cores pe parallel calculation
        </p>
        {benchResult && (
          <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <p className="text-xs font-bold" style={{ color: "#86efac" }}>✅ {benchResult}</p>
          </div>
        )}
      </div>

      {/* ── Dynamic API Profile ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.2)" }}>
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4" style={{ color: "#06b6d4" }} />
          <p className="text-xs font-bold" style={{ color: "#06b6d4" }}>Dynamic API Body — Hardware Ke Hisaab Se</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: "CPU Threads", v: `${boostMode ? (elHW?.cpuCores ?? navigator.hardwareConcurrency ?? 4) : Math.ceil((elHW?.cpuCores ?? 4) / 2)} threads` },
            { l: "Batch Size", v: boostMode ? "512 items" : "128 items" },
            { l: "GPU Quality", v: isElectron && elHW?.nvidia.available ? (boostMode ? "NVIDIA Max" : "NVIDIA Std") : (boostMode ? "WebGL High" : "WebGL Std") },
            { l: "Sim Quality", v: boostMode ? "ULTRA" : "HIGH" },
          ].map(({ l, v }) => (
            <div key={l} className="flex items-center gap-2 rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div>
                <p className="text-[11px] font-bold text-white">{v}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Battery Card ─────────────────────────────────────────────────── */}
      {battery && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: battery.charging ? "rgba(34,197,94,0.05)" : battery.level < 20 ? "rgba(239,68,68,0.05)" : "rgba(245,158,11,0.05)", border: `1px solid ${battery.charging ? "rgba(34,197,94,0.25)" : battery.level < 20 ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: battery.charging ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)" }}>
                <Battery className="w-4 h-4" style={{ color: battery.charging ? "#22c55e" : battery.level < 20 ? "#ef4444" : "#f59e0b" }} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Battery</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{battery.charging ? "⚡ Charging" : "🔋 On Battery"}</p>
              </div>
            </div>
            <span className="text-lg font-bold" style={{ color: battery.charging ? "#22c55e" : battery.level < 20 ? "#ef4444" : "#f59e0b" }}>{battery.level}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${battery.level}%`, background: battery.charging ? "#22c55e" : battery.level < 20 ? "#ef4444" : "#f59e0b" }} />
          </div>
          {!battery.charging && battery.timeLeft < Infinity && battery.timeLeft > 0 && (
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Time remaining: ~{Math.round(battery.timeLeft / 60)} min</p>
          )}
        </div>
      )}

      {/* ── Screen Resolution Card ───────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.2)" }}>
        <div className="flex items-center gap-2 mb-2">
          <Monitor className="w-4 h-4" style={{ color: "#06b6d4" }} />
          <p className="text-xs font-bold" style={{ color: "#06b6d4" }}>Screen / Display</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { l: "Resolution", v: `${screenInfo.width} × ${screenInfo.height}` },
            { l: "Pixel Ratio", v: `${screenInfo.pixelRatio}x` },
            { l: "Color Depth", v: `${screenInfo.colorDepth}-bit` },
            { l: "Viewport", v: `${window.innerWidth} × ${window.innerHeight}` },
          ].map(({ l, v }) => (
            <div key={l} className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[11px] font-bold text-white">{v}</p>
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Network Card ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Signal className="w-4 h-4" style={{ color: "#a855f7" }} />
            <p className="text-xs font-bold" style={{ color: "#a855f7" }}>Network Connection</p>
          </div>
          <span style={{ background: network.online ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: network.online ? "#22c55e" : "#ef4444", border: `1px solid ${network.online ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
            {network.online ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[11px] font-bold text-white">{network.type.toUpperCase() || "Unknown"}</p>
            <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>Connection Type</p>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[11px] font-bold text-white">{network.speed || "N/A"}</p>
            <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>Speed</p>
          </div>
        </div>
      </div>

      {/* ── WebSerial CNC Connection ─────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: serialConnected ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)", border: `1px solid ${serialConnected ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Usb className="w-4 h-4" style={{ color: serialConnected ? "#22c55e" : "rgba(255,255,255,0.4)" }} />
            <div>
              <p className="text-xs font-bold" style={{ color: serialConnected ? "#22c55e" : "rgba(255,255,255,0.7)" }}>CNC Machine — USB Serial</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{webSerialSupported ? "WebSerial ready — Chrome/Edge" : "⚠️ Chrome/Edge browser use karo"}</p>
            </div>
          </div>
          {webSerialSupported && (
            serialConnected
              ? <button onClick={disconnectSerial} className="text-[11px] px-3 py-1.5 rounded-lg font-semibold" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", cursor: "pointer" }}>Disconnect</button>
              : <button onClick={connectSerial} className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-semibold" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#86efac", cursor: "pointer" }}>
                  <Link className="w-3 h-3" /> Connect CNC
                </button>
          )}
        </div>
        {serialConnected && (
          <div className="space-y-2">
            <textarea
              value={gcodeInput}
              onChange={e => setGcodeInput(e.target.value)}
              rows={3}
              placeholder="G-code..."
              style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff", padding: "6px 8px", fontSize: 11, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }}
            />
            <div className="flex gap-2">
              <button onClick={sendGcode} disabled={sendingGcode} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex-1" style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd", cursor: sendingGcode ? "not-allowed" : "pointer" }}>
                <Send className="w-3 h-3" />{sendingGcode ? "Bhejna..." : "G-Code Bhejo"}
              </button>
              <button onClick={() => setSerialLog(["Log cleared"])} className="px-3 py-1.5 rounded-lg text-[11px]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Clear</button>
            </div>
          </div>
        )}
        <div ref={serialLogRef} style={{ height: 80, overflowY: "auto", background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: "6px 8px", fontSize: 10, color: "#86efac", fontFamily: "monospace" }}>
          {serialLog.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      <p className="text-center text-[10px] pb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
        SAI Rolotech Smart Engines — Hardware-Adaptive v2.2.22 {isElectron ? "• Electron Native" : "• Browser Mode"}
      </p>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}
