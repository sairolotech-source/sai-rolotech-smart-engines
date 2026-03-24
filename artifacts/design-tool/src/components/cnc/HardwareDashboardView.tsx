import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Cpu, MemoryStick, Monitor, Zap, Activity, Server,
  RefreshCw, PlayCircle, StopCircle, ChevronRight,
  CheckCircle2, AlertTriangle, Layers, Gauge,
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

interface LiveMetrics {
  cpu: {
    cores: number;
    workers: number;
    activeWorkers: number;
    queuedTasks: number;
    totalProcessed: number;
    avgComputeMs: number;
    utilization: number;
  };
  ram: {
    usedMB: number;
    totalMB: number;
    limitMB: number;
    percent: number;
    deviceGB: number;
  };
  gpu: {
    renderer: string;
    vendor: string;
    brand: string;
    model: string;
    tier: string;
    vramGB: number;
    webgl2: boolean;
    webgpu: boolean;
    mode: string;
    dedicated: boolean;
  };
  boostMode: boolean;
  apiProfile: {
    batchSize: number;
    workerCount: number;
    gpuQuality: string;
    meshDensity: number;
    simQuality: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Bar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "rgba(255,255,255,0.06)" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

function StatCard({ icon, title, value, sub, color, children }: {
  icon: React.ReactNode; title: string; value: string; sub?: string; color: string; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}30` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
            {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4", style: { color } })}
          </div>
          <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>{title}</p>
        </div>
        <span className="text-sm font-bold" style={{ color }}>{value}</span>
      </div>
      {sub && <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{sub}</p>}
      {children}
    </div>
  );
}

function WorkerDot({ active, idx }: { active: boolean; idx: number }) {
  return (
    <div
      key={idx}
      className="w-3 h-3 rounded-full transition-all duration-300"
      title={`Worker ${idx + 1}: ${active ? "Busy" : "Idle"}`}
      style={{
        background: active ? "#f59e0b" : "rgba(255,255,255,0.12)",
        boxShadow: active ? "0 0 6px rgba(245,158,11,0.7)" : "none",
        animation: active ? "pulse 1s ease-in-out infinite" : "none",
      }}
    />
  );
}

function TierBadge({ tier }: { tier: string }) {
  const color = tier === "ultra" ? "#a855f7" : tier === "high" ? "#22c55e" : tier === "medium" ? "#f59e0b" : "#ef4444";
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
      {tier}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HardwareDashboardView() {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [boostMode, setBoostMode] = useState(false);
  const [gpuReady, setGpuReady] = useState(false);
  const [benchRunning, setBenchRunning] = useState(false);
  const [benchResult, setBenchResult] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const benchWorkerRef = useRef<Worker | null>(null);

  // ── Build live metrics ──────────────────────────────────────────────────────
  const refreshMetrics = useCallback(() => {
    const caps = getHardwareCapabilities();
    ensureWorkerPool();
    const stats = getWorkerStats();
    const mem = getMemorySnapshot();
    const gpuInfo = getGpuInfo();
    const tier = detectGpuTier();
    const vram = getEstimatedVRAM();

    const utilization = stats.poolSize > 0 ? Math.round((stats.active / stats.poolSize) * 100) : 0;

    const batchSize = boostMode
      ? Math.min(caps.recommended.batchSize * 3, 512)
      : caps.recommended.batchSize;
    const workerCount = boostMode
      ? Math.max(caps.recommended.workerPoolSize, caps.cpu.cores - 1)
      : caps.recommended.workerPoolSize;

    setMetrics({
      cpu: {
        cores: caps.cpu.logicalProcessors,
        workers: stats.poolSize,
        activeWorkers: stats.active,
        queuedTasks: stats.queued,
        totalProcessed: stats.totalProcessed,
        avgComputeMs: Math.round(stats.avgComputeMs),
        utilization,
      },
      ram: {
        usedMB: mem.usedMB,
        totalMB: mem.totalMB,
        limitMB: mem.limitMB,
        percent: mem.percent,
        deviceGB: caps.memory.deviceMemoryGB,
      },
      gpu: {
        renderer: gpuInfo.renderer,
        vendor: gpuInfo.vendor,
        brand: gpuInfo.brand,
        model: gpuInfo.model,
        tier,
        vramGB: vram,
        webgl2: gpuInfo.webgl2,
        webgpu: gpuInfo.webgpu,
        mode: gpuInfo.webgpu ? "WebGPU" : gpuInfo.webgl2 ? "WebGL 2.0" : "WebGL 1.0",
        dedicated: gpuInfo.type === "dedicated",
      },
      boostMode,
      apiProfile: {
        batchSize,
        workerCount,
        gpuQuality: tier === "ultra" || tier === "high" ? "High" : "Standard",
        meshDensity: boostMode ? caps.recommended.meshDensity * 2 : caps.recommended.meshDensity,
        simQuality: boostMode ? "ultra" : caps.recommended.simulationQuality,
      },
    });
    setTick(t => t + 1);
  }, [boostMode]);

  useEffect(() => {
    refreshMetrics();
    intervalRef.current = setInterval(refreshMetrics, 800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [refreshMetrics]);

  // Init GPU compute pipeline once
  useEffect(() => {
    initGPUComputePipeline().then(() => setGpuReady(true)).catch(() => setGpuReady(false));
  }, []);

  // ── CPU Benchmark ─────────────────────────────────────────────────────────
  const runBenchmark = useCallback(() => {
    if (benchRunning) return;
    setBenchRunning(true);
    setBenchResult(null);
    const t0 = performance.now();
    const cores = navigator.hardwareConcurrency || 4;
    let done = 0;
    const results: number[] = [];

    for (let i = 0; i < cores; i++) {
      const code = `
        self.onmessage = function(e) {
          const n = e.data;
          let s = 0;
          for (let i = 0; i < n; i++) s += Math.sqrt(i) * Math.sin(i);
          self.postMessage(s);
        };
      `;
      const blob = new Blob([code], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      const w = new Worker(url);
      w.onmessage = (e) => {
        results.push(e.data);
        w.terminate();
        URL.revokeObjectURL(url);
        done++;
        if (done === cores) {
          const dt = performance.now() - t0;
          const score = Math.round((cores * 2_000_000) / dt);
          setBenchResult(`✅ ${cores} Cores | ${dt.toFixed(0)}ms | Score: ${score.toLocaleString()} ops/sec`);
          setBenchRunning(false);
        }
      };
      w.postMessage(2_000_000);
    }
  }, [benchRunning]);

  if (!metrics) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Hardware scan ho raha hai...</span>
        </div>
      </div>
    );
  }

  const { cpu, ram, gpu, apiProfile } = metrics;
  const ramColor = ram.percent > 80 ? "#ef4444" : ram.percent > 60 ? "#f59e0b" : "#22c55e";
  const cpuColor = cpu.utilization > 80 ? "#ef4444" : cpu.utilization > 40 ? "#f59e0b" : "#06b6d4";

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
            App aapke laptop ka RAM, GPU, CPU dynamically use kar rahi hai
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Live</span>
          <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
        </div>
      </div>

      {/* ── Boost Mode Toggle ──────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover:opacity-90"
        style={{
          background: boostMode ? "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.08))" : "rgba(255,255,255,0.03)",
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
              {boostMode ? `Sab ${cpu.cores} cores + GPU full power pe chal rahe hain` : "Standard mode — battery friendly"}
            </p>
          </div>
        </div>
        <div
          className="w-12 h-6 rounded-full relative transition-all"
          style={{ background: boostMode ? "#f59e0b" : "rgba(255,255,255,0.12)" }}
        >
          <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: boostMode ? "26px" : "2px" }} />
        </div>
      </div>

      {/* ── 3 Resource Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3">

        {/* CPU Card */}
        <StatCard
          icon={<Cpu />}
          title="CPU — Processor"
          value={`${cpu.utilization}% Used`}
          sub={`${cpu.cores} Logical Cores • ${cpu.workers} Web Workers active`}
          color={cpuColor}
        >
          <Bar value={cpu.utilization} color={cpuColor} height={10} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Array.from({ length: Math.min(cpu.cores, 16) }).map((_, i) => (
              <WorkerDot key={i} active={i < cpu.activeWorkers} idx={i} />
            ))}
            {cpu.cores > 16 && <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>+{cpu.cores - 16} more</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { l: "Workers", v: `${cpu.workers}` },
              { l: "Tasks Done", v: cpu.totalProcessed.toLocaleString() },
              { l: "Avg Time", v: `${cpu.avgComputeMs}ms` },
            ].map(({ l, v }) => (
              <div key={l} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-[11px] font-bold" style={{ color: cpuColor }}>{v}</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
              </div>
            ))}
          </div>
        </StatCard>

        {/* RAM Card */}
        <StatCard
          icon={<MemoryStick />}
          title="RAM — Memory"
          value={`${ram.usedMB} MB`}
          sub={`JS Heap: ${ram.usedMB}/${ram.limitMB} MB  •  Device RAM: ${ram.deviceGB} GB`}
          color={ramColor}
        >
          <Bar value={ram.percent} color={ramColor} height={10} />
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { l: "Used", v: `${ram.usedMB} MB` },
              { l: "Available", v: `${ram.limitMB - ram.usedMB} MB` },
              { l: "Device RAM", v: `${ram.deviceGB} GB` },
            ].map(({ l, v }) => (
              <div key={l} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-[11px] font-bold" style={{ color: ramColor }}>{v}</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
              </div>
            ))}
          </div>
        </StatCard>

        {/* GPU Card */}
        <StatCard
          icon={<Monitor />}
          title="GPU — Graphics"
          value={gpu.mode}
          sub={`${gpu.renderer || "Browser GPU"} • ${gpu.vramGB}GB VRAM`}
          color="#a855f7"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <TierBadge tier={gpu.tier} />
            {gpu.dedicated && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>Dedicated</span>}
            {gpu.webgpu && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }}>WebGPU ✓</span>}
            {gpu.webgl2 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)" }}>WebGL2 ✓</span>}
            {gpuReady && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>Compute ✓</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { l: "VRAM", v: `${gpu.vramGB}GB` },
              { l: "Brand", v: gpu.brand.toUpperCase() },
              { l: "Tier", v: gpu.tier.toUpperCase() },
            ].map(({ l, v }) => (
              <div key={l} className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-[11px] font-bold" style={{ color: "#a855f7" }}>{v}</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{l}</p>
              </div>
            ))}
          </div>
        </StatCard>
      </div>

      {/* ── Dynamic API Profile ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.2)" }}>
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4" style={{ color: "#06b6d4" }} />
          <p className="text-xs font-bold" style={{ color: "#06b6d4" }}>Dynamic API Body — Hardware ke Hisaab se Adjust</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Cpu className="w-3.5 h-3.5" />, label: "CPU Workers", value: `${apiProfile.workerCount} threads`, color: cpuColor },
            { icon: <MemoryStick className="w-3.5 h-3.5" />, label: "Batch Size", value: `${apiProfile.batchSize} items`, color: ramColor },
            { icon: <Monitor className="w-3.5 h-3.5" />, label: "GPU Quality", value: apiProfile.gpuQuality, color: "#a855f7" },
            { icon: <Layers className="w-3.5 h-3.5" />, label: "Sim Quality", value: apiProfile.simQuality.toUpperCase(), color: "#f59e0b" },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-2.5 rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="shrink-0" style={{ color }}>{icon}</div>
              <div>
                <p className="text-[11px] font-bold" style={{ color }}>{value}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          {boostMode
            ? "⚡ Boost ON — App maximum hardware use kar raha hai: sab cores + high GPU quality"
            : "💡 Boost OFF karein tab app aapke hardware ke max resources use karega"}
        </p>
      </div>

      {/* ── CPU Benchmark ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4" style={{ color: "#f59e0b" }} />
            <p className="text-xs font-bold text-white">CPU Benchmark Test</p>
          </div>
          <button
            onClick={runBenchmark}
            disabled={benchRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{
              background: benchRunning ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.25)",
              border: "1px solid rgba(245,158,11,0.4)",
              color: "#fcd34d",
              cursor: benchRunning ? "not-allowed" : "pointer",
            }}
          >
            {benchRunning ? <><RefreshCw className="w-3 h-3 animate-spin" /> Test chal raha hai...</> : <><PlayCircle className="w-3 h-3" /> Test Chalao</>}
          </button>
        </div>
        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          Sab {cpu.cores} CPU cores pe parallel calculation chalti hai — actual hardware performance measure karta hai
        </p>
        {benchResult && (
          <div className="rounded-xl p-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <p className="text-xs font-semibold" style={{ color: "#86efac" }}>{benchResult}</p>
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <p className="text-center text-[10px] pb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
        SAI Rolotech Smart Engines — Hardware-Adaptive Compute Engine v2.2.22
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
