import React, { useEffect, useState, useCallback } from "react";
import { Cpu, HardDrive, MemoryStick, Battery, Wifi, WifiOff, Clock, Server, RefreshCw } from "lucide-react";
import { authFetch, getApiUrl } from "../../lib/auth-fetch";

interface SystemInfo {
  hostname: string;
  platform: string;
  osRelease: string;
  arch: string;
  uptime: number;
  cpuUsage: number;
  cpuModel: string;
  cpuCores: number;
  ram: { total: number; used: number; free: number; percent: number };
  disk: { total: number; used: number; free: number; percent: number; mount: string } | null;
  battery: { hasBattery: boolean; percent: number | null; isCharging: boolean; timeRemaining: number | null };
  network: { isOnline: boolean };
  workerPool?: { cpuCount: number; poolSize: number; totalProcessed: number; avgComputeMs: number };
  hardwareAcceleration?: { cpuThreads: number; totalMemoryGB: number; freeMemoryGB: number; processUptime: number };
}

function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${b} B`;
}

function fmtUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

function StatCard({
  icon, label, value, sub, percent, color, accent,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  percent?: number; color: string; accent: string;
}) {
  return (
    <div className={`rounded-xl p-3.5 border ${accent} bg-white/[0.02] flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div>
        <div className="text-base font-semibold text-zinc-100 leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
      </div>
      {percent !== undefined && (
        <ProgressBar value={percent} color={
          percent > 85 ? "bg-red-500" : percent > 65 ? "bg-amber-500" : "bg-emerald-500"
        } />
      )}
    </div>
  );
}


export function SystemInfoPanel() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchInfo = useCallback(async () => {
    try {
      const r = await authFetch(getApiUrl("/system/info"), { signal: AbortSignal.timeout(5000) });
      const data = await r.json() as SystemInfo;
      setInfo(data);
      setLastRefresh(new Date());
    } catch { /* keep stale data */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInfo();
    const interval = setInterval(fetchInfo, 5000);
    return () => clearInterval(interval);
  }, [fetchInfo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="flex items-center gap-2 text-zinc-600 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading system info…
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex items-center justify-center h-48 text-red-400 text-sm">
        Failed to load system info
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{info.hostname}</h3>
          <p className="text-[11px] text-zinc-600 mt-0.5">{info.platform} {info.osRelease} · {info.arch} · {info.cpuCores} cores</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            info.network.isOnline
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
              : "bg-red-500/10 border border-red-500/25 text-red-400"
          }`}>
            {info.network.isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            {info.network.isOnline ? "Online" : "Offline"}
          </span>
          <span className="text-[10px] text-zinc-700">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={<Cpu className="w-3.5 h-3.5 text-blue-400" />}
          label="CPU"
          value={`${info.cpuUsage}%`}
          sub={info.cpuModel.split(" ").slice(0, 4).join(" ")}
          percent={info.cpuUsage}
          color="bg-blue-500/15"
          accent="border-blue-500/15"
        />
        <StatCard
          icon={<MemoryStick className="w-3.5 h-3.5 text-purple-400" />}
          label="RAM"
          value={`${info.ram.percent}%`}
          sub={`${fmtBytes(info.ram.used)} / ${fmtBytes(info.ram.total)}`}
          percent={info.ram.percent}
          color="bg-purple-500/15"
          accent="border-purple-500/15"
        />
        {info.disk && (
          <StatCard
            icon={<HardDrive className="w-3.5 h-3.5 text-amber-400" />}
            label="Disk"
            value={`${info.disk.percent}%`}
            sub={`${fmtBytes(info.disk.used)} / ${fmtBytes(info.disk.total)} · ${info.disk.mount}`}
            percent={info.disk.percent}
            color="bg-amber-500/15"
            accent="border-amber-500/15"
          />
        )}
        <StatCard
          icon={<Battery className="w-3.5 h-3.5 text-emerald-400" />}
          label="Battery"
          value={info.battery.hasBattery && info.battery.percent !== null
            ? `${info.battery.percent}%`
            : "N/A"}
          sub={info.battery.hasBattery
            ? info.battery.isCharging ? "Charging" : "On battery"
            : "No battery / AC power"}
          percent={info.battery.hasBattery && info.battery.percent !== null ? info.battery.percent : undefined}
          color="bg-emerald-500/15"
          accent="border-emerald-500/15"
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5 text-zinc-400" />}
          label="Uptime"
          value={fmtUptime(info.uptime)}
          sub="Since last boot"
          color="bg-zinc-500/15"
          accent="border-zinc-500/15"
        />
        <StatCard
          icon={<Server className="w-3.5 h-3.5 text-indigo-400" />}
          label="OS"
          value={info.platform}
          sub={info.osRelease}
          color="bg-indigo-500/15"
          accent="border-indigo-500/15"
        />
      </div>

      {info.workerPool && (
        <div className="rounded-xl p-3.5 border border-cyan-500/15 bg-white/[0.02]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-cyan-500/15">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide">Worker Pool</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between text-[10px]"><span className="text-zinc-500">CPU Threads</span><span className="text-zinc-300">{info.workerPool.cpuCount}</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Pool Size</span><span className="text-zinc-300">{info.workerPool.poolSize}</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Jobs Done</span><span className="text-cyan-400 font-medium">{info.workerPool.totalProcessed}</span></div>
            <div className="flex justify-between text-[10px]"><span className="text-zinc-500">Avg Time</span><span className="text-cyan-400 font-medium">{info.workerPool.avgComputeMs}ms</span></div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 text-right">Auto-refresh every 5 seconds · All processors active</p>
    </div>
  );
}
