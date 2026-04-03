import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, GitBranch, Shield, AlertTriangle,
  CheckCircle, XCircle, Clock, Upload, Activity,
} from "lucide-react";

interface WatchdogLog {
  time: string;
  type: "info" | "success" | "warn" | "error";
  message: string;
}

interface WatchdogData {
  startedAt: string;
  lastHealthCheck: string | null;
  lastGitPush: string | null;
  lastGitPushResult: string | null;
  healthChecksPassed: number;
  healthChecksFailed: number;
  consecutiveFailures: number;
  gitPushCount: number;
  gitPushErrors: number;
  apiPort: number;
  isElectron: boolean;
  logs: WatchdogLog[];
}

const LOG_COLOR: Record<WatchdogLog["type"], string> = {
  info:    "text-zinc-400",
  success: "text-emerald-400",
  warn:    "text-amber-400",
  error:   "text-red-400",
};

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
      ok
        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
        : "bg-red-500/15 text-red-300 border border-red-500/30"
    }`}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

function StatCard({
  icon, label, value, sub, color = "zinc",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: "zinc" | "emerald" | "red" | "amber" | "blue";
}) {
  const colors = {
    zinc:    "border-zinc-700/60 bg-zinc-800/50",
    emerald: "border-emerald-700/40 bg-emerald-900/20",
    red:     "border-red-700/40 bg-red-900/20",
    amber:   "border-amber-700/40 bg-amber-900/20",
    blue:    "border-blue-700/40 bg-blue-900/20",
  };
  const textColors = {
    zinc: "text-zinc-200", emerald: "text-emerald-300",
    red: "text-red-300", amber: "text-amber-300", blue: "text-blue-300",
  };

  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
        {icon} {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${textColors[color]}`}>{value}</div>
      {sub && <div className="text-zinc-500 text-xs mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function WatchdogPanel() {
  const [data, setData] = useState<WatchdogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/watchdog-status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as WatchdogData;
      setData(json);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const t = setInterval(() => { void fetchStatus(); }, 30_000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  const handleManualPush = async () => {
    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch("/api/system/auto-push", { method: "POST" });
      const json = await res.json() as { ok: boolean; message: string };
      setPushResult({ ok: json.ok, msg: json.message });
      await fetchStatus();
    } catch (e: unknown) {
      setPushResult({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    } finally {
      setPushing(false);
    }
  };

  function fmtTime(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch { return iso; }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500 gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading watchdog status...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-red-400 gap-2">
        <AlertTriangle className="w-6 h-6" />
        <span className="text-sm">API se data nahi aa raha: {error}</span>
        <button
          onClick={() => { void fetchStatus(); }}
          className="mt-2 text-xs px-3 py-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300"
        >
          Retry karo
        </button>
      </div>
    );
  }

  if (!data) return null;

  const healthOk = data.consecutiveFailures === 0 && data.healthChecksPassed > 0;
  const gitOk = data.lastGitPushResult?.includes("pushed") || data.lastGitPushResult?.includes("up-to-date");

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-zinc-100 text-base">System Watchdog</h2>
          <Badge ok={healthOk} label={healthOk ? "API Healthy" : "API Issue"} />
          {!data.isElectron && (
            <Badge ok={!!gitOk} label={gitOk ? "GitHub Synced" : "Sync Check"} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void fetchStatus(); }}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {!data.isElectron && (
            <button
              onClick={() => { void handleManualPush(); }}
              disabled={pushing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {pushing
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Pushing...</>
                : <><Upload className="w-3 h-3" /> GitHub Push</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Push result toast */}
      {pushResult && (
        <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
          pushResult.ok
            ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-300"
            : "bg-red-900/20 border-red-700/40 text-red-300"
        }`}>
          {pushResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {pushResult.msg}
          <button onClick={() => setPushResult(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Health Checks OK"
          value={data.healthChecksPassed}
          sub={`Last: ${fmtTime(data.lastHealthCheck)}`}
          color="emerald"
        />
        <StatCard
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          label="Health Failures"
          value={data.healthChecksFailed}
          sub={`Consecutive: ${data.consecutiveFailures}/5`}
          color={data.consecutiveFailures > 0 ? "red" : "zinc"}
        />
        {!data.isElectron && (
          <>
            <StatCard
              icon={<GitBranch className="w-3.5 h-3.5" />}
              label="GitHub Pushes"
              value={data.gitPushCount}
              sub={`Last: ${fmtTime(data.lastGitPush)}`}
              color="blue"
            />
            <StatCard
              icon={<XCircle className="w-3.5 h-3.5" />}
              label="Push Errors"
              value={data.gitPushErrors}
              sub={data.lastGitPushResult?.slice(0, 40) ?? "—"}
              color={data.gitPushErrors > 0 ? "amber" : "zinc"}
            />
          </>
        )}
      </div>

      {/* Git status */}
      {!data.isElectron && (
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
            <GitBranch className="w-3.5 h-3.5" /> GitHub Auto-Sync Status
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-zinc-500">Last Push:</span>
            <span className="text-zinc-300 font-mono">{fmtTime(data.lastGitPush)}</span>
            <span className="text-zinc-500">Result:</span>
            <span className={`font-mono ${
              data.lastGitPushResult?.includes("pushed") ? "text-emerald-400"
              : data.lastGitPushResult?.includes("up-to-date") ? "text-blue-400"
              : data.lastGitPushResult?.includes("failed") ? "text-red-400"
              : "text-zinc-400"
            }`}>
              {data.lastGitPushResult ?? "—"}
            </span>
            <span className="text-zinc-500">Mode:</span>
            <span className="text-zinc-300">Auto-push every 10 min</span>
          </div>
        </div>
      )}

      {/* Server info */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
        <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
          <Activity className="w-3.5 h-3.5" /> Server Info
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-zinc-500">API Port:</span>
          <span className="text-zinc-300 font-mono">{data.apiPort}</span>
          <span className="text-zinc-500">Mode:</span>
          <span className="text-zinc-300">{data.isElectron ? "Desktop (Electron)" : "Cloud (Replit)"}</span>
          <span className="text-zinc-500">Started At:</span>
          <span className="text-zinc-300 font-mono">{fmtTime(data.startedAt)}</span>
        </div>
      </div>

      {/* Recent logs */}
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700/40 text-zinc-400 text-xs">
          <Clock className="w-3.5 h-3.5" /> Recent Activity (last 20)
        </div>
        <div className="overflow-y-auto max-h-48 font-mono text-xs p-2 space-y-0.5">
          {data.logs.length === 0 && (
            <div className="text-zinc-600 py-2 text-center">Koi activity nahi abhi tak...</div>
          )}
          {[...data.logs].reverse().slice(0, 20).map((entry, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-zinc-600 flex-shrink-0">{entry.time}</span>
              <span className={LOG_COLOR[entry.type]}>{entry.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
