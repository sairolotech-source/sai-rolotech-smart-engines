import React, { useState, useEffect, useCallback } from "react";
import {
  X, Cpu, HardDrive, Monitor, Wifi, WifiOff,
  Battery, BatteryCharging, RefreshCw, Loader2,
  MemoryStick, Gauge, Server,
} from "lucide-react";

interface SystemInfo {
  hostname: string;
  platform: string;
  osRelease: string;
  arch: string;
  uptime: number;
  cpuUsage: number;
  cpuModel: string;
  cpuCores: number;
  cpuSpeed: number;
  ram: { total: number; used: number; free: number; percent: number };
  gpu: { model: string; vendor: string; vram: number; driver: string; bus: string }[];
  disk: { total: number; used: number; free: number; percent: number; mount: string } | null;
  battery: { hasBattery: boolean; percent: number | null; isCharging: boolean; timeRemaining: number | null };
  network: { isOnline: boolean; interfaceCount: number };
  appMemory: { heapUsed: number; heapTotal: number; rss: number; external: number };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function getApiUrl(path: string): string {
  const base = window.location.origin;
  return `${base}/api${path}`;
}

export function SystemInfoPanel({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/system/info"));
      if (!res.ok) throw new Error("Failed to fetch system info");
      const data = await res.json();
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system info");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, [fetchInfo]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-md pt-8 px-4">
      <div
        className="w-full max-w-2xl bg-[#0F0F1C] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "88vh" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 border border-emerald-500/20 flex items-center justify-center">
              <Server className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">System Information</h2>
              <p className="text-[11px] text-zinc-500">Hardware & resource utilization monitor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInfo}
              disabled={loading}
              className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && !info ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 text-sm">{error}</div>
          ) : info ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">CPU</span>
                  </div>
                  <p className="text-xs text-zinc-200 font-medium truncate">{info.cpuModel}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{info.cpuCores} cores · {info.cpuSpeed} MHz</p>
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                      <span>Usage</span>
                      <span className={info.cpuUsage > 80 ? "text-red-400" : "text-zinc-300"}>{info.cpuUsage}%</span>
                    </div>
                    <ProgressBar value={info.cpuUsage} color={info.cpuUsage > 80 ? "#ef4444" : info.cpuUsage > 50 ? "#f59e0b" : "#22c55e"} />
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MemoryStick className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">RAM</span>
                  </div>
                  <p className="text-xs text-zinc-200 font-medium">{formatBytes(info.ram.used)} / {formatBytes(info.ram.total)}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{formatBytes(info.ram.free)} free</p>
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                      <span>Usage</span>
                      <span className={info.ram.percent > 85 ? "text-red-400" : "text-zinc-300"}>{info.ram.percent}%</span>
                    </div>
                    <ProgressBar value={info.ram.percent} color={info.ram.percent > 85 ? "#ef4444" : info.ram.percent > 60 ? "#f59e0b" : "#22c55e"} />
                  </div>
                </div>
              </div>

              {info.gpu.length > 0 && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Monitor className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">GPU</span>
                  </div>
                  {info.gpu.map((g, i) => (
                    <div key={i} className={i > 0 ? "mt-2 pt-2 border-t border-white/[0.04]" : ""}>
                      <p className="text-xs text-zinc-200 font-medium">{g.model}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {g.vendor} · {g.vram > 0 ? `${g.vram} MB VRAM` : "Shared memory"}
                        {g.driver ? ` · Driver: ${g.driver}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {info.disk && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">Disk ({info.disk.mount})</span>
                  </div>
                  <p className="text-xs text-zinc-200 font-medium">{formatBytes(info.disk.used)} / {formatBytes(info.disk.total)}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{formatBytes(info.disk.free)} free</p>
                  <div className="mt-2">
                    <ProgressBar value={info.disk.percent} color={info.disk.percent > 90 ? "#ef4444" : info.disk.percent > 70 ? "#f59e0b" : "#22c55e"} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {info.network.isOnline ? <Wifi className="w-3.5 h-3.5 text-cyan-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                    <span className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">Network</span>
                  </div>
                  <p className={`text-xs font-medium ${info.network.isOnline ? "text-emerald-400" : "text-red-400"}`}>
                    {info.network.isOnline ? "Online" : "Offline"}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{info.network.interfaceCount} interface{info.network.interfaceCount !== 1 ? "s" : ""}</p>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {info.battery.isCharging ? <BatteryCharging className="w-3.5 h-3.5 text-yellow-400" /> : <Battery className="w-3.5 h-3.5 text-zinc-400" />}
                    <span className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">Battery</span>
                  </div>
                  {info.battery.hasBattery ? (
                    <>
                      <p className="text-xs text-zinc-200 font-medium">{info.battery.percent}%{info.battery.isCharging ? " (Charging)" : ""}</p>
                      {info.battery.timeRemaining != null && info.battery.timeRemaining > 0 && (
                        <p className="text-[10px] text-zinc-500 mt-0.5">{Math.round(info.battery.timeRemaining)} min remaining</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-zinc-500">No battery detected</p>
                  )}
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">App Memory</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-zinc-500">Heap Used</p>
                    <p className="text-xs text-zinc-200 font-medium">{formatBytes(info.appMemory.heapUsed)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">Heap Total</p>
                    <p className="text-xs text-zinc-200 font-medium">{formatBytes(info.appMemory.heapTotal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">RSS</p>
                    <p className="text-xs text-zinc-200 font-medium">{formatBytes(info.appMemory.rss)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500">System Uptime</p>
                    <p className="text-xs text-zinc-200 font-medium">{formatUptime(info.uptime)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
                <p className="text-[10px] text-zinc-600">
                  {info.hostname} · {info.platform} {info.osRelease} · {info.arch}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
