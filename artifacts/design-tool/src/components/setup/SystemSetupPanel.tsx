import { useState, useEffect, useCallback } from "react";
import { Monitor, Cpu, HardDrive, Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle, RefreshCw, Download, Shield, Zap, Server, MemoryStick } from "lucide-react";

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn" | "checking";
  detail: string;
  category: string;
}

interface HardwareInfo {
  cpu: { cores: number; model: string; speed: string };
  gpu: { renderer: string; tier: string; webgl2: boolean; webgpu: boolean; maxTexture: number };
  memory: { deviceGB: number; heapLimitMB: number; heapUsedMB: number };
  workers: { poolSize: number; sharedArrayBuffer: boolean; offscreenCanvas: boolean; transferable: boolean };
  browser: { userAgent: string; language: string; cookiesEnabled: boolean; serviceWorker: boolean; online: boolean };
}

function detectHardware(): HardwareInfo {
  const cores = navigator.hardwareConcurrency || 4;
  const ua = navigator.userAgent;
  const cpuModel = /Apple/.test(ua) ? "Apple Silicon" : /Win64/.test(ua) ? "x64 CPU" : "CPU";

  let renderer = "Unknown";
  let vendor = "Unknown";
  let tier = "medium";
  let webgl2 = false;
  let webgpu = "gpu" in navigator;
  let maxTexture = 4096;

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (gl) {
      webgl2 = true;
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      }
      maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }
    canvas.remove();
  } catch {}

  const r = renderer.toLowerCase();
  const ultraGPU = ["rtx 40", "rtx 50", "rx 7900", "apple m3", "apple m4", "a100", "h100"];
  const highGPU = ["rtx", "rx 6", "rx 7", "radeon pro", "quadro", "gtx 1080", "gtx 1070", "apple m1", "apple m2"];
  const lowGPU = ["swiftshader", "llvmpipe", "mesa", "microsoft basic", "virtualbox", "vmware"];

  if (ultraGPU.some(k => r.includes(k)) && cores >= 8) tier = "ultra";
  else if (highGPU.some(k => r.includes(k))) tier = "high";
  else if (lowGPU.some(k => r.includes(k))) tier = "low";
  else if (maxTexture >= 16384 && cores >= 8 && webgpu) tier = "ultra";
  else if (maxTexture >= 8192 && cores >= 6) tier = "high";
  else if (maxTexture < 2048) tier = "low";

  const deviceMem = (navigator as any).deviceMemory || 4;
  const perfMem = (performance as any).memory;
  const heapLimitMB = perfMem ? Math.round(perfMem.jsHeapSizeLimit / 1048576) : 2048;
  const heapUsedMB = perfMem ? Math.round(perfMem.usedJSHeapSize / 1048576) : 0;

  const poolSize = Math.max(2, Math.min(cores - 1, 8));

  return {
    cpu: { cores, model: cpuModel, speed: cores >= 8 ? "High" : cores >= 4 ? "Medium" : "Low" },
    gpu: { renderer, tier, webgl2, webgpu, maxTexture },
    memory: { deviceGB: deviceMem, heapLimitMB, heapUsedMB },
    workers: {
      poolSize,
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      offscreenCanvas: typeof OffscreenCanvas !== "undefined",
      transferable: typeof MessageChannel !== "undefined",
    },
    browser: {
      userAgent: ua,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      serviceWorker: "serviceWorker" in navigator,
      online: navigator.onLine,
    },
  };
}

function runChecks(hw: HardwareInfo): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push({
    name: "CPU Cores",
    status: hw.cpu.cores >= 4 ? "pass" : hw.cpu.cores >= 2 ? "warn" : "fail",
    detail: `${hw.cpu.cores} cores detected — Worker pool: ${hw.workers.poolSize} threads`,
    category: "Hardware",
  });

  checks.push({
    name: "GPU Rendering",
    status: hw.gpu.tier === "ultra" || hw.gpu.tier === "high" ? "pass" : hw.gpu.tier === "medium" ? "pass" : "warn",
    detail: `${hw.gpu.renderer} — ${hw.gpu.tier.toUpperCase()} tier`,
    category: "Hardware",
  });

  checks.push({
    name: "WebGL 2.0",
    status: hw.gpu.webgl2 ? "pass" : "fail",
    detail: hw.gpu.webgl2 ? "WebGL 2.0 supported — full 3D rendering" : "WebGL 2.0 NOT supported — 3D features limited",
    category: "Hardware",
  });

  checks.push({
    name: "WebGPU",
    status: hw.gpu.webgpu ? "pass" : "warn",
    detail: hw.gpu.webgpu ? "WebGPU available — next-gen GPU compute" : "WebGPU not available — using WebGL fallback",
    category: "Hardware",
  });

  checks.push({
    name: "System Memory",
    status: hw.memory.deviceGB >= 8 ? "pass" : hw.memory.deviceGB >= 4 ? "warn" : "fail",
    detail: `${hw.memory.deviceGB} GB detected — Heap limit: ${hw.memory.heapLimitMB} MB`,
    category: "Hardware",
  });

  checks.push({
    name: "Max Texture Size",
    status: hw.gpu.maxTexture >= 8192 ? "pass" : hw.gpu.maxTexture >= 4096 ? "warn" : "fail",
    detail: `${hw.gpu.maxTexture}px — ${hw.gpu.maxTexture >= 8192 ? "Full resolution textures" : "Limited texture resolution"}`,
    category: "Hardware",
  });

  checks.push({
    name: "Web Workers",
    status: typeof Worker !== "undefined" ? "pass" : "fail",
    detail: typeof Worker !== "undefined" ? `Web Workers supported — ${hw.workers.poolSize} parallel threads` : "Web Workers NOT supported",
    category: "Compute",
  });

  checks.push({
    name: "SharedArrayBuffer",
    status: hw.workers.sharedArrayBuffer ? "pass" : "warn",
    detail: hw.workers.sharedArrayBuffer ? "Shared memory available — zero-copy data transfer" : "Not available — using message passing (slower)",
    category: "Compute",
  });

  checks.push({
    name: "OffscreenCanvas",
    status: hw.workers.offscreenCanvas ? "pass" : "warn",
    detail: hw.workers.offscreenCanvas ? "OffscreenCanvas supported — background rendering" : "Not available — main thread rendering only",
    category: "Compute",
  });

  checks.push({
    name: "Service Worker",
    status: hw.browser.serviceWorker ? "pass" : "warn",
    detail: hw.browser.serviceWorker ? "Service Worker ready — offline caching enabled" : "Service Worker not available",
    category: "Offline",
  });

  checks.push({
    name: "Network Status",
    status: hw.browser.online ? "pass" : "warn",
    detail: hw.browser.online ? "Online — cloud features available, hardware mode primary" : "Offline — full hardware mode, AI uses CPU fallback",
    category: "Offline",
  });

  checks.push({
    name: "LocalStorage",
    status: (() => { try { localStorage.setItem("_test", "1"); localStorage.removeItem("_test"); return true; } catch { return false; } })() ? "pass" : "fail",
    detail: "Project data persistence",
    category: "Offline",
  });

  checks.push({
    name: "IndexedDB",
    status: typeof indexedDB !== "undefined" ? "pass" : "warn",
    detail: typeof indexedDB !== "undefined" ? "IndexedDB available — large file caching" : "IndexedDB not available",
    category: "Offline",
  });

  checks.push({
    name: "Cookies",
    status: hw.browser.cookiesEnabled ? "pass" : "warn",
    detail: hw.browser.cookiesEnabled ? "Cookies enabled — session management OK" : "Cookies disabled — auth may not work",
    category: "Security",
  });

  checks.push({
    name: "Secure Context (HTTPS)",
    status: window.isSecureContext ? "pass" : "warn",
    detail: window.isSecureContext ? "Running in secure context — all APIs available" : "Not secure — some APIs restricted",
    category: "Security",
  });

  return checks;
}

const tierColors: Record<string, string> = {
  ultra: "#a855f7",
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#ef4444",
};

const tierLabels: Record<string, string> = {
  ultra: "ULTRA — Maximum Performance",
  high: "HIGH — Full 3D + Parallel Compute",
  medium: "MEDIUM — Standard Performance",
  low: "LOW — Basic Mode",
};

const categoryIcons: Record<string, React.ReactNode> = {
  Hardware: <Cpu className="w-4 h-4" />,
  Compute: <Zap className="w-4 h-4" />,
  Offline: <HardDrive className="w-4 h-4" />,
  Security: <Shield className="w-4 h-4" />,
};

export default function SystemSetupPanel() {
  const [hw, setHw] = useState<HardwareInfo | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  const runSetup = useCallback(() => {
    setRunning(true);
    setSetupComplete(false);
    setTimeout(() => {
      const hardware = detectHardware();
      setHw(hardware);
      const results = runChecks(hardware);
      setChecks(results);
      setRunning(false);
      setSetupComplete(true);
    }, 800);
  }, []);

  useEffect(() => {
    fetch("/api/system/info")
      .then(r => r.json())
      .then(data => setServerInfo(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    runSetup();
  }, [runSetup]);

  const passCount = checks.filter(c => c.status === "pass").length;
  const failCount = checks.filter(c => c.status === "fail").length;
  const warnCount = checks.filter(c => c.status === "warn").length;
  const totalCount = checks.length;
  const scorePercent = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  const categories = [...new Set(checks.map(c => c.category))];

  const statusIcon = (status: string) => {
    switch (status) {
      case "pass": return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "fail": return <XCircle className="w-4 h-4 text-red-400" />;
      case "warn": return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      default: return <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />;
    }
  };

  const downloadSetupScript = () => {
    const isWindows = navigator.userAgent.includes("Win");
    const filename = isWindows ? "setup.bat" : "setup.sh";
    fetch(`/${filename}`)
      .then(r => r.text())
      .then(text => {
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        alert(`Setup script "${filename}" — copy from project root folder`);
      });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#05060f] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Monitor className="w-7 h-7 text-amber-400" />
              System Setup & Hardware Check
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              One-click hardware detection — CPU, GPU, RAM, Workers sab check karo
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={downloadSetupScript}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1b2e] border border-white/10 text-gray-300 hover:bg-[#252640] transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download Setup Script
            </button>
            <button
              onClick={runSetup}
              disabled={running}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
              {running ? "Checking..." : "Run Setup"}
            </button>
          </div>
        </div>

        {/* Score Card */}
        {setupComplete && hw && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Overall Score */}
            <div className="bg-[#0d0e1a] border border-white/10 rounded-xl p-5 flex flex-col items-center justify-center">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#1a1b2e" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={scorePercent >= 80 ? "#22c55e" : scorePercent >= 60 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${scorePercent * 2.64} 264`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{scorePercent}%</span>
                </div>
              </div>
              <span className="text-sm text-gray-400 mt-2">System Score</span>
              <span className="text-xs mt-1">
                <span className="text-green-400">{passCount}</span> /
                <span className="text-yellow-400 ml-1">{warnCount}</span> /
                <span className="text-red-400 ml-1">{failCount}</span>
              </span>
            </div>

            {/* CPU */}
            <div className="bg-[#0d0e1a] border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-semibold text-gray-300">CPU</span>
              </div>
              <div className="text-3xl font-bold text-white">{hw.cpu.cores}</div>
              <div className="text-xs text-gray-500">Cores / Threads</div>
              <div className="mt-2 text-xs text-amber-400">Worker Pool: {hw.workers.poolSize} threads</div>
              <div className="text-xs text-gray-500 mt-1">{hw.cpu.model}</div>
            </div>

            {/* GPU */}
            <div className="bg-[#0d0e1a] border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-5 h-5 text-purple-400" />
                <span className="text-sm font-semibold text-gray-300">GPU</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: tierColors[hw.gpu.tier] + "22", color: tierColors[hw.gpu.tier] }}
                >
                  {hw.gpu.tier.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-2 line-clamp-2" title={hw.gpu.renderer}>
                {hw.gpu.renderer.length > 40 ? hw.gpu.renderer.substring(0, 40) + "..." : hw.gpu.renderer}
              </div>
              <div className="flex gap-2 mt-2">
                {hw.gpu.webgl2 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">WebGL2</span>}
                {hw.gpu.webgpu && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">WebGPU</span>}
              </div>
            </div>

            {/* Memory */}
            <div className="bg-[#0d0e1a] border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <MemoryStick className="w-5 h-5 text-green-400" />
                <span className="text-sm font-semibold text-gray-300">Memory</span>
              </div>
              <div className="text-3xl font-bold text-white">{hw.memory.deviceGB} <span className="text-base text-gray-500">GB</span></div>
              <div className="text-xs text-gray-500">System RAM</div>
              {hw.memory.heapUsedMB > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Heap: {hw.memory.heapUsedMB} MB</span>
                    <span>{hw.memory.heapLimitMB} MB</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1a1b2e] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${Math.min((hw.memory.heapUsedMB / hw.memory.heapLimitMB) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hardware Tier Banner */}
        {setupComplete && hw && (
          <div
            className="rounded-xl p-4 border flex items-center justify-between"
            style={{
              background: `${tierColors[hw.gpu.tier]}08`,
              borderColor: `${tierColors[hw.gpu.tier]}33`,
            }}
          >
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6" style={{ color: tierColors[hw.gpu.tier] }} />
              <div>
                <div className="font-semibold text-white">{tierLabels[hw.gpu.tier]}</div>
                <div className="text-xs text-gray-400">
                  {hw.cpu.cores} CPU cores, {hw.gpu.tier === "ultra" || hw.gpu.tier === "high" ? "GPU-accelerated" : "CPU-powered"} rendering,{" "}
                  {hw.workers.poolSize} worker threads, {hw.memory.deviceGB}GB RAM
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hw.browser.online ? (
                <span className="flex items-center gap-1 text-xs text-green-400"><Wifi className="w-3 h-3" /> Online</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-400"><WifiOff className="w-3 h-3" /> Offline</span>
              )}
              <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400 font-medium">Hardware Mode</span>
            </div>
          </div>
        )}

        {/* Checks by Category */}
        {setupComplete && (
          <div className="space-y-4">
            {categories.map(cat => (
              <div key={cat} className="bg-[#0d0e1a] border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-[#0a0b14]">
                  {categoryIcons[cat]}
                  <span className="text-sm font-semibold text-gray-300">{cat}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    {checks.filter(c => c.category === cat && c.status === "pass").length}/{checks.filter(c => c.category === cat).length} passed
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {checks
                    .filter(c => c.category === cat)
                    .map((check, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                        {statusIcon(check.status)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">{check.name}</div>
                          <div className="text-xs text-gray-500 truncate">{check.detail}</div>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                          style={{
                            background: check.status === "pass" ? "#22c55e22" : check.status === "warn" ? "#f59e0b22" : "#ef444422",
                            color: check.status === "pass" ? "#22c55e" : check.status === "warn" ? "#f59e0b" : "#ef4444",
                          }}
                        >
                          {check.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Server Info */}
        {serverInfo && (
          <div className="bg-[#0d0e1a] border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-[#0a0b14]">
              <Server className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-gray-300">Backend Server</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
              <div>
                <div className="text-xs text-gray-500">CPU Model</div>
                <div className="text-sm text-white truncate">{serverInfo.cpuModel || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">CPU Cores</div>
                <div className="text-sm text-white">{serverInfo.cpuCores || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">RAM Used</div>
                <div className="text-sm text-white">
                  {serverInfo.ram ? `${Math.round(serverInfo.ram.used / 1073741824)}/${Math.round(serverInfo.ram.total / 1073741824)} GB` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Worker Pool</div>
                <div className="text-sm text-white">
                  {serverInfo.workerPool ? `${serverInfo.workerPool.maxConcurrent || serverInfo.workerPool.poolSize || 0} threads (${serverInfo.workerPool.mode || "on-demand"})` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">CPU Usage</div>
                <div className="text-sm text-white">{serverInfo.cpuUsage ?? "—"}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Platform</div>
                <div className="text-sm text-white">{serverInfo.platform || "—"} / {serverInfo.arch || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Node Version</div>
                <div className="text-sm text-white">{serverInfo.hardwareAcceleration?.nodeVersion || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Uptime</div>
                <div className="text-sm text-white">
                  {serverInfo.hardwareAcceleration?.processUptime
                    ? `${Math.floor(serverInfo.hardwareAcceleration.processUptime / 60)}m ${serverInfo.hardwareAcceleration.processUptime % 60}s`
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Setup Script Instructions */}
        <div className="bg-[#0d0e1a] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Local Machine Setup (Optional)
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Apne laptop par software chalane ke liye neeche ka script download karein aur run karein.
            Ye automatically sab dependencies install kar dega aur hardware check kar lega.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#05060f] rounded-lg p-4 border border-white/5">
              <div className="text-xs font-bold text-green-400 mb-2">Linux / macOS</div>
              <code className="text-xs text-gray-300 block font-mono">
                chmod +x setup.sh<br />
                ./setup.sh
              </code>
            </div>
            <div className="bg-[#05060f] rounded-lg p-4 border border-white/5">
              <div className="text-xs font-bold text-blue-400 mb-2">Windows</div>
              <code className="text-xs text-gray-300 block font-mono">
                Double-click setup.bat<br />
                <span className="text-gray-500">ya Command Prompt mein: setup.bat</span>
              </code>
            </div>
          </div>
        </div>

        {/* Features Enabled */}
        {setupComplete && (
          <div className="bg-[#0d0e1a] border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Features Enabled by Hardware</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { name: "Web Worker Pool", enabled: typeof Worker !== "undefined", desc: "Parallel FEA/springback computation" },
                { name: "GPU 3D Rendering", enabled: hw?.gpu.webgl2 ?? false, desc: "Three.js hardware-accelerated 3D" },
                { name: "Offline AI (CPU)", enabled: true, desc: "11-domain knowledge base, no internet needed" },
                { name: "WebLLM (GPU)", enabled: hw?.gpu.webgpu ?? false, desc: "Phi-3.5 mini on-device AI model" },
                { name: "Mesh Caching", enabled: true, desc: "LRU cache for computed FEA meshes" },
                { name: "Hardware Monitor", enabled: true, desc: "Real-time CPU/GPU/RAM dashboard" },
                { name: "DXF Processing", enabled: true, desc: "Profile import & dimension extraction" },
                { name: "G-Code Generation", enabled: true, desc: "Multi-controller post-processing" },
                { name: "Batch Export", enabled: true, desc: "ZIP download of all rolls" },
              ].map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 rounded-lg bg-[#05060f] border border-white/5"
                >
                  {f.enabled ? (
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-medium text-white">{f.name}</div>
                    <div className="text-[10px] text-gray-500">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
