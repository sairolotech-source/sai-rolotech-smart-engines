import React, { useEffect, useState } from "react";
import { Cpu, MonitorSpeaker, MemoryStick, Zap, Activity, Layers, Gauge, CircuitBoard } from "lucide-react";
import { useHardwareEngine, type HardwareEngineState } from "../../hooks/useHardwareEngine";
import { getHardwareCapabilities, getWorkerStats, getMemorySnapshot } from "../../lib/hardware-engine";

function ProgressRing({ value, size = 48, stroke = 4, color }: { value: number; size?: number; stroke?: number; color: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, value) / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-700" />
    </svg>
  );
}

function HWCard({ icon, label, value, sub, accent, children }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl p-3 border ${accent} bg-white/[0.02] flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/[0.05]">
          {icon}
        </div>
        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-bold text-zinc-100">{value}</div>
      {sub && <div className="text-[10px] text-zinc-600">{sub}</div>}
      {children}
    </div>
  );
}

function BarMeter({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-zinc-600 w-16 truncate">{label}</span>
      <div className="flex-1 bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-zinc-500 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

export function HardwareMonitorPanel() {
  const hwState = useHardwareEngine();
  const [liveStats, setLiveStats] = useState({ active: 0, queued: 0, processed: 0, avgMs: 0 });
  const [liveMem, setLiveMem] = useState({ usedMB: 0, percent: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getWorkerStats();
      const mem = getMemorySnapshot();
      setLiveStats({ active: stats.active, queued: stats.queued, processed: stats.totalProcessed, avgMs: stats.avgComputeMs });
      setLiveMem({ usedMB: mem.usedMB, percent: mem.percent });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const caps = hwState.capabilities;
  if (!caps) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
        <Activity className="w-4 h-4 animate-spin mr-2" />
        Detecting hardware...
      </div>
    );
  }

  const cpuScore = Math.min(100, caps.cpu.cores * 12.5);
  const gpuScore = caps.gpu.tier === "ultra" ? 100 : caps.gpu.tier === "high" ? 75 : caps.gpu.tier === "medium" ? 50 : 25;
  const memScore = Math.min(100, caps.memory.deviceMemoryGB * 12.5);
  const overallScore = Math.round((cpuScore + gpuScore + memScore) / 3);

  const qualityColor = {
    ultra: "text-violet-400", high: "text-emerald-400", medium: "text-amber-400", low: "text-red-400"
  }[caps.recommended.simulationQuality];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <CircuitBoard className="w-4 h-4 text-cyan-400" />
            Hardware Acceleration Engine
          </h3>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Maximum power · All processors active · Real-time monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${qualityColor} ${
            caps.recommended.simulationQuality === "ultra" ? "bg-violet-500/10 border-violet-500/25" :
            caps.recommended.simulationQuality === "high" ? "bg-emerald-500/10 border-emerald-500/25" :
            caps.recommended.simulationQuality === "medium" ? "bg-amber-500/10 border-amber-500/25" :
            "bg-red-500/10 border-red-500/25"
          }`}>
            {caps.recommended.simulationQuality.toUpperCase()} Quality
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="relative">
          <ProgressRing value={overallScore} size={56} stroke={5} color={overallScore >= 75 ? "#22c55e" : overallScore >= 50 ? "#eab308" : "#ef4444"} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-zinc-100">{overallScore}</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-zinc-200">Hardware Power Score</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            {caps.cpu.cores} CPU cores · {caps.gpu.tier.toUpperCase()} GPU · {caps.memory.deviceMemoryGB}GB RAM
          </div>
          <div className="flex gap-3 mt-1.5">
            <BarMeter value={cpuScore} max={100} color="bg-blue-500" label="CPU" />
            <BarMeter value={gpuScore} max={100} color="bg-green-500" label="GPU" />
            <BarMeter value={memScore} max={100} color="bg-purple-500" label="RAM" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <HWCard
          icon={<Cpu className="w-3.5 h-3.5 text-blue-400" />}
          label="CPU Cores"
          value={`${caps.cpu.cores} Threads`}
          sub={`Speed: ${caps.cpu.estimatedSpeed} · ${caps.cpu.logicalProcessors} logical`}
          accent="border-blue-500/15"
        >
          <BarMeter value={liveStats.active} max={caps.workers.maxWorkers} color="bg-blue-500" label="Active" />
        </HWCard>

        <HWCard
          icon={<MonitorSpeaker className="w-3.5 h-3.5 text-green-400" />}
          label="GPU"
          value={caps.gpu.tier.toUpperCase()}
          sub={caps.gpu.renderer.length > 30 ? caps.gpu.renderer.substring(0, 30) + "…" : caps.gpu.renderer}
          accent="border-green-500/15"
        >
          <div className="flex flex-wrap gap-1 mt-1">
            {caps.gpu.webgl2 && <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/10 text-green-400">WebGL2</span>}
            {caps.gpu.webgpu && <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500/10 text-violet-400">WebGPU</span>}
            {caps.gpu.floatTextures && <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400">Float32</span>}
            {caps.gpu.instancing && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">Instancing</span>}
          </div>
        </HWCard>

        <HWCard
          icon={<MemoryStick className="w-3.5 h-3.5 text-purple-400" />}
          label="Memory"
          value={`${caps.memory.deviceMemoryGB} GB`}
          sub={`JS Heap: ${liveMem.usedMB}MB / ${caps.memory.jsHeapLimitMB}MB`}
          accent="border-purple-500/15"
        >
          <BarMeter value={liveMem.percent} max={100} color={liveMem.percent > 80 ? "bg-red-500" : "bg-purple-500"} label="Used" />
        </HWCard>

        <HWCard
          icon={<Layers className="w-3.5 h-3.5 text-cyan-400" />}
          label="Worker Pool"
          value={`${caps.workers.maxWorkers} Workers`}
          sub={`Active: ${liveStats.active} · Queue: ${liveStats.queued}`}
          accent="border-cyan-500/15"
        >
          <div className="flex gap-1 mt-1">
            {Array.from({ length: caps.workers.maxWorkers }).map((_, i) => (
              <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i < liveStats.active ? "bg-cyan-400 animate-pulse" : "bg-white/[0.08]"
              }`} />
            ))}
          </div>
        </HWCard>

        <HWCard
          icon={<Zap className="w-3.5 h-3.5 text-amber-400" />}
          label="Compute Stats"
          value={`${liveStats.processed} Tasks`}
          sub={`Avg: ${liveStats.avgMs}ms per task`}
          accent="border-amber-500/15"
        />

        <HWCard
          icon={<Gauge className="w-3.5 h-3.5 text-rose-400" />}
          label="Optimization"
          value={`Mesh: ${caps.recommended.meshDensity}x`}
          sub={`Max triangles: ${(caps.recommended.maxTriangles / 1000).toFixed(0)}K · Batch: ${caps.recommended.batchSize}`}
          accent="border-rose-500/15"
        >
          <div className="flex flex-wrap gap-1 mt-1">
            {caps.workers.supportsSharedArrayBuffer && <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400">SharedMem</span>}
            {caps.workers.supportsOffscreenCanvas && <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400">OffscreenCanvas</span>}
            {caps.workers.supportsTransferable && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400">Transferable</span>}
          </div>
        </HWCard>
      </div>

      <div className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.06]">
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">GPU Capabilities</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Max Texture</span>
            <span className="text-zinc-300">{caps.gpu.maxTextureSize}px</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Draw Buffers</span>
            <span className="text-zinc-300">{caps.gpu.maxDrawBuffers}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Vertex Attribs</span>
            <span className="text-zinc-300">{caps.gpu.maxVertexAttribs}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Pixel Ratio</span>
            <span className="text-zinc-300">{caps.performance.pixelRatio.toFixed(1)}x</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Vendor</span>
            <span className="text-zinc-300 truncate max-w-[120px]">{caps.gpu.vendor}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Connection</span>
            <span className="text-zinc-300">{caps.performance.connectionType}</span>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-zinc-700 text-right">
        All {caps.cpu.cores} CPU cores + {caps.gpu.tier.toUpperCase()} GPU active · Worker pool auto-sized · Real-time refresh
      </p>
    </div>
  );
}
