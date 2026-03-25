import React, { useState, useEffect, useCallback } from "react";
import {
  Github, RefreshCw, Download, Upload, CheckCircle2,
  AlertTriangle, Clock, GitBranch, GitCommit, Loader2,
  Wifi, WifiOff, Info, ChevronDown, ChevronRight, Zap,
  CloudUpload, HardDrive, ShieldCheck, Layers, Archive
} from "lucide-react";

interface AutoUpdateInfo {
  enabled: boolean;
  intervalMin: number;
  lastCheck: string;
  lastResult: string;
  logCount: number;
}

interface AutoUpdateStatus {
  ok: boolean;
  enabled: boolean;
  intervalMin: number;
  lastCheck: string;
  lastResult: string;
  log: { time: string; message: string; type: string }[];
}

interface GitStatus {
  ok: boolean;
  local: { commit: string; fullCommit: string; branch: string; recentLogs: string[] };
  github: { commit: string; message: string; date: string; reachable: boolean; repo: string };
  upToDate: boolean;
  updatesAvailable: boolean;
  autoUpdate?: AutoUpdateInfo;
  error?: string;
}

interface PullResult {
  ok: boolean;
  message: string;
  pulled?: boolean;
  newCommit?: string;
  behindCount?: number;
  changes?: string[];
  log?: string;
  output?: string;
  error?: string;
}

interface PushResult {
  ok: boolean;
  message: string;
  pushed?: boolean;
  output?: string;
  error?: string;
}

interface UpdateSource {
  id: string;
  name: string;
  description: string;
  priority: number;
  status: "available" | "unknown" | "no-package";
  detail?: string;
}

interface UpdateSourcesResult {
  ok: boolean;
  summary: string;
  primarySource: string;
  sources: UpdateSource[];
  autoUpdateEnabled: boolean;
  lastCheck: string;
  lastResult: string;
}

interface MultiUpdateResult {
  ok: boolean;
  sourceUsed: string | null;
  attempts: { source: string; ok: boolean; message: string }[];
  message: string;
  willRestart?: boolean;
}

interface DriveManifestResult {
  ok: boolean;
  hasPackage: boolean;
  manifest?: { version: string; timestamp: string; archiveName: string };
  message?: string;
}

export function GitHubUpdatePanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pullResult, setPullResult] = useState<PullResult | null>(null);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [autoCheck, setAutoCheck] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<AutoUpdateStatus | null>(null);
  const [autoUpdateLoading, setAutoUpdateLoading] = useState(false);
  const [showAutoLog, setShowAutoLog] = useState(false);

  // Multi-source update state
  const [updateSources, setUpdateSources] = useState<UpdateSourcesResult | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [multiUpdating, setMultiUpdating] = useState(false);
  const [multiUpdateResult, setMultiUpdateResult] = useState<MultiUpdateResult | null>(null);
  const [drivePushing, setDrivePushing] = useState(false);
  const [drivePushResult, setDrivePushResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [driveManifest, setDriveManifest] = useState<DriveManifestResult | null>(null);
  const [showSourcesExpanded, setShowSourcesExpanded] = useState(false);

  const token = localStorage.getItem("cnc_token") ?? "";

  const checkStatus = useCallback(async () => {
    setLoadingStatus(true);
    setPullResult(null);
    setPushResult(null);
    try {
      const res = await fetch("/api/system/git-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as GitStatus;
      setStatus(data);
      setLastChecked(new Date());
    } catch {
      setStatus({ ok: false, error: "Server se connect nahi hua", local: { commit: "", fullCommit: "", branch: "", recentLogs: [] }, github: { commit: "", message: "", date: "", reachable: false, repo: "" }, upToDate: true, updatesAvailable: false });
    } finally {
      setLoadingStatus(false);
    }
  }, [token]);

  const doPull = async () => {
    setPulling(true);
    setPullResult(null);
    try {
      const res = await fetch("/api/system/git-pull", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as PullResult;
      setPullResult(data);
      if (data.ok) await checkStatus();
    } catch {
      setPullResult({ ok: false, message: "Pull request fail hua — server check karo" });
    } finally {
      setPulling(false);
    }
  };

  const doPush = async () => {
    if (!commitMsg.trim()) return;
    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch("/api/system/git-push", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMsg }),
      });
      const data = await res.json() as PushResult;
      setPushResult(data);
      if (data.ok) { setCommitMsg(""); await checkStatus(); }
    } catch {
      setPushResult({ ok: false, message: "Push request fail hua — server check karo" });
    } finally {
      setPushing(false);
    }
  };

  const fetchAutoStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/auto-update/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as AutoUpdateStatus;
      setAutoUpdateStatus(data);
    } catch { /* ignore */ }
  }, [token]);

  const toggleAutoUpdate = async (enable: boolean) => {
    setAutoUpdateLoading(true);
    try {
      const endpoint = enable ? "/api/system/auto-update/start" : "/api/system/auto-update/stop";
      await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      await fetchAutoStatus();
    } catch { /* ignore */ }
    setAutoUpdateLoading(false);
  };

  const forceAutoCheck = async () => {
    setAutoUpdateLoading(true);
    try {
      await fetch("/api/system/auto-update/check-now", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      await fetchAutoStatus();
      await checkStatus();
    } catch { /* ignore */ }
    setAutoUpdateLoading(false);
  };

  // ── Multi-Source Update Functions ──────────────────────────────────────────

  const checkUpdateSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const [sourcesRes, manifestRes] = await Promise.all([
        fetch("/api/system/update-sources", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/system/drive-manifest", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const sourcesData = await sourcesRes.json() as UpdateSourcesResult;
      const manifestData = await manifestRes.json() as DriveManifestResult;
      setUpdateSources(sourcesData);
      setDriveManifest(manifestData);
    } catch { /* ignore */ }
    setLoadingSources(false);
  }, [token]);

  const runMultiUpdate = async () => {
    setMultiUpdating(true);
    setMultiUpdateResult(null);
    try {
      const res = await fetch("/api/system/multi-update", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json() as MultiUpdateResult;
      setMultiUpdateResult(data);
      if (data.ok) { await checkStatus(); await checkUpdateSources(); }
    } catch {
      setMultiUpdateResult({ ok: false, sourceUsed: null, attempts: [], message: "Multi-update request fail hua" });
    }
    setMultiUpdating(false);
  };

  const pushToDrive = async () => {
    setDrivePushing(true);
    setDrivePushResult(null);
    try {
      const version = `v${new Date().toISOString().slice(0, 10)}-manual`;
      const res = await fetch("/api/system/push-to-drive", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setDrivePushResult(data);
      if (data.ok) await checkUpdateSources();
    } catch {
      setDrivePushResult({ ok: false, message: "Drive push fail hua" });
    }
    setDrivePushing(false);
  };

  useEffect(() => { void checkStatus(); void fetchAutoStatus(); void checkUpdateSources(); }, [checkStatus, fetchAutoStatus, checkUpdateSources]);

  useEffect(() => {
    if (!autoCheck) return;
    const interval = setInterval(() => { void checkStatus(); }, 60_000);
    return () => clearInterval(interval);
  }, [autoCheck, checkStatus]);

  useEffect(() => {
    const interval = setInterval(() => { void fetchAutoStatus(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchAutoStatus]);

  const formatDate = (iso: string) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-600/30 flex items-center justify-center">
          <Github className="w-4 h-4 text-zinc-200" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-zinc-200">GitHub Auto-Update System</h2>
          <p className="text-[10px] text-zinc-500">GitHub se latest code pull karo — ya local changes push karo</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {lastChecked && (
            <span className="text-[9px] text-zinc-600">
              <Clock className="w-3 h-3 inline mr-0.5" />
              {lastChecked.toLocaleTimeString("en-IN")}
            </span>
          )}
          <button onClick={() => void checkStatus()} disabled={loadingStatus}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 text-[10px] font-semibold hover:bg-zinc-700/60 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Repo Info Banner */}
        <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/50 p-3 flex items-center gap-3">
          <Github className="w-4 h-4 text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-zinc-200 truncate">
              github.com/sairolotech-source/sai-rolotech-smart-engines
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">Branch: main</div>
          </div>
          {status?.github.reachable
            ? <div className="flex items-center gap-1 text-[9px] text-emerald-400"><Wifi className="w-3 h-3" /> Connected</div>
            : <div className="flex items-center gap-1 text-[9px] text-red-400"><WifiOff className="w-3 h-3" /> Offline</div>}
        </div>

        {/* Status Cards */}
        {loadingStatus && !status && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 p-4">
            <Loader2 className="w-4 h-4 animate-spin" /> GitHub status check ho raha hai...
          </div>
        )}

        {status && (
          <>
            {/* Update Status Banner */}
            <div className={`rounded-lg border p-3 ${
              status.updatesAvailable
                ? "border-amber-500/30 bg-amber-500/10"
                : status.upToDate && status.github.reachable
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-zinc-700/40 bg-zinc-900/40"
            }`}>
              <div className="flex items-center gap-2">
                {status.updatesAvailable
                  ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                <span className={`text-[12px] font-bold ${status.updatesAvailable ? "text-amber-300" : "text-emerald-300"}`}>
                  {status.updatesAvailable
                    ? "⚡ GitHub pe naye updates hain — Pull karo!"
                    : status.github.reachable
                      ? "✅ App fully up to date hai"
                      : "⚠ GitHub reach nahi ho raha — local status only"}
                </span>
              </div>
              {status.github.message && (
                <p className="text-[10px] text-zinc-400 mt-1 ml-6">Latest: "{status.github.message}"</p>
              )}
            </div>

            {/* Two column status */}
            <div className="grid grid-cols-2 gap-3">
              {/* Local */}
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[10px] font-bold text-zinc-300">Local (Replit)</span>
                </div>
                <div className="font-mono text-[12px] font-bold text-cyan-300 mb-1">{status.local.commit || "—"}</div>
                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                  <GitBranch className="w-3 h-3" /> {status.local.branch}
                </div>
              </div>

              {/* GitHub */}
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Github className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[10px] font-bold text-zinc-300">GitHub (Remote)</span>
                </div>
                <div className={`font-mono text-[12px] font-bold mb-1 ${
                  status.updatesAvailable ? "text-amber-300" : "text-violet-300"
                }`}>{status.github.commit || (status.github.reachable ? "—" : "Offline")}</div>
                <div className="text-[9px] text-zinc-500">{formatDate(status.github.date)}</div>
              </div>
            </div>

            {/* Recent Logs */}
            {status.local.recentLogs.length > 0 && (
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                <button onClick={() => setShowLogs(!showLogs)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/20 text-left">
                  {showLogs ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                  <span className="text-[11px] font-semibold text-zinc-300">Recent Commits (Local)</span>
                </button>
                {showLogs && (
                  <div className="border-t border-zinc-800/40">
                    {status.local.recentLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-zinc-800/20 last:border-0 hover:bg-zinc-800/10">
                        <GitCommit className="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
                        <span className="text-[10px] font-mono text-zinc-400">{log}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* PULL Section */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
          <div className="px-3 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-300">GitHub → Replit (Pull Updates)</span>
            {status?.updatesAvailable && (
              <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                UPDATE AVAILABLE
              </span>
            )}
          </div>
          <div className="p-3">
            <p className="text-[10px] text-zinc-400 mb-3">
              GitHub pe jo latest code hai use Replit mein pull karo. Isse aapka Replit project GitHub se sync ho jayega.
            </p>
            <button onClick={() => void doPull()} disabled={pulling || loadingStatus}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50 w-full justify-center">
              {pulling
                ? <><Loader2 className="w-4 h-4 animate-spin" /> GitHub se Pull ho raha hai...</>
                : <><Download className="w-4 h-4" /> GitHub se Latest Pull Karo</>}
            </button>

            {pullResult && (
              <div className={`mt-3 rounded-lg border p-3 ${pullResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {pullResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <span className={`text-[11px] font-bold ${pullResult.ok ? "text-emerald-300" : "text-red-300"}`}>{pullResult.message}</span>
                </div>
                {pullResult.pulled && pullResult.changes && pullResult.changes.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] text-zinc-500 mb-1">Changed files ({pullResult.changes.length}):</p>
                    <div className="max-h-32 overflow-y-auto space-y-0.5">
                      {pullResult.changes.map((f, i) => (
                        <div key={i} className="text-[10px] font-mono text-zinc-300 px-2 py-0.5 bg-zinc-800/40 rounded">{f}</div>
                      ))}
                    </div>
                  </div>
                )}
                {pullResult.ok && pullResult.pulled && (
                  <div className="mt-2 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                    <p className="text-[10px] text-amber-300">
                      <Zap className="w-3 h-3 inline mr-1" />
                      App restart karo taake naye changes apply ho sakein — workflow me "Restart" button dabao
                    </p>
                  </div>
                )}
                {!pullResult.ok && pullResult.error && (
                  <p className="text-[10px] text-red-400 mt-1 font-mono">{pullResult.error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PUSH Section */}
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 overflow-hidden">
          <div className="px-3 py-2.5 bg-violet-500/10 border-b border-violet-500/20 flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-bold text-violet-300">Replit → GitHub (Push Changes)</span>
          </div>
          <div className="p-3">
            <p className="text-[10px] text-zinc-400 mb-3">
              Replit mein jo naye changes hain unhe GitHub pe push karo. Commit message likhna zaroori hai.
            </p>
            <input
              type="text"
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              placeholder="Commit message likho (e.g., Add roll forming feature)"
              className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2.5 py-2 text-[11px] text-zinc-200 placeholder-zinc-600 mb-2"
              onKeyDown={e => { if (e.key === "Enter" && commitMsg.trim()) void doPush(); }}
            />
            <button onClick={() => void doPush()} disabled={pushing || !commitMsg.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-300 text-[11px] font-semibold hover:bg-violet-500/30 transition-colors disabled:opacity-50 w-full justify-center">
              {pushing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> GitHub pe Push ho raha hai...</>
                : <><Upload className="w-4 h-4" /> GitHub pe Push Karo</>}
            </button>

            {pushResult && (
              <div className={`mt-3 rounded-lg border p-3 ${pushResult.ok ? "border-violet-500/30 bg-violet-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className="flex items-center gap-2">
                  {pushResult.ok ? <CheckCircle2 className="w-4 h-4 text-violet-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <span className={`text-[11px] font-bold ${pushResult.ok ? "text-violet-300" : "text-red-300"}`}>{pushResult.message}</span>
                </div>
                {!pushResult.ok && pushResult.error && (
                  <p className="text-[10px] text-red-400 mt-1 font-mono">{pushResult.error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SERVER-SIDE AUTO-UPDATE */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 overflow-hidden">
          <div className="px-3 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold text-amber-300">Auto-Update System (Server-Side)</span>
            <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded border font-bold ${
              autoUpdateStatus?.enabled
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-zinc-700/40 text-zinc-500 border-zinc-600/30"
            }`}>
              {autoUpdateStatus?.enabled ? "✅ CHALU" : "⏸ BAND"}
            </span>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-[10px] text-zinc-400">
              Server har <b className="text-amber-300">5 minute</b> mein GitHub check karega — naya update milega to khud pull + pnpm install karega.
              <b className="text-emerald-300"> Bina command chalaye!</b>
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => void toggleAutoUpdate(!autoUpdateStatus?.enabled)} disabled={autoUpdateLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all disabled:opacity-50 ${
                  autoUpdateStatus?.enabled
                    ? "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25"
                    : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                }`}>
                {autoUpdateLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : autoUpdateStatus?.enabled ? "⏸ Band Karo" : "▶ Chalu Karo"}
              </button>
              <button onClick={() => void forceAutoCheck()} disabled={autoUpdateLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold hover:bg-cyan-500/25 transition-all disabled:opacity-50">
                {autoUpdateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Abhi Check Karo
              </button>
            </div>

            {autoUpdateStatus && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-zinc-800/40 rounded px-2 py-1.5">
                  <div className="text-[8px] text-zinc-600 uppercase">Last Check</div>
                  <div className="text-[10px] text-zinc-300">{autoUpdateStatus.lastCheck ? formatDate(autoUpdateStatus.lastCheck) : "Abhi tak nahi"}</div>
                </div>
                <div className="bg-zinc-800/40 rounded px-2 py-1.5">
                  <div className="text-[8px] text-zinc-600 uppercase">Result</div>
                  <div className="text-[10px] text-zinc-300 truncate">{autoUpdateStatus.lastResult || "—"}</div>
                </div>
              </div>
            )}

            {/* Auto-update activity log */}
            {autoUpdateStatus?.log && autoUpdateStatus.log.length > 0 && (
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                <button onClick={() => setShowAutoLog(!showAutoLog)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/20 text-left">
                  {showAutoLog ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                  <span className="text-[10px] font-semibold text-zinc-300">Auto-Update Log ({autoUpdateStatus.log.length})</span>
                </button>
                {showAutoLog && (
                  <div className="border-t border-zinc-800/40 max-h-48 overflow-y-auto">
                    {[...autoUpdateStatus.log].reverse().map((l, i) => (
                      <div key={i} className={`flex items-start gap-2 px-3 py-1.5 border-b border-zinc-800/20 last:border-0 text-[9px] ${
                        l.type === "success" ? "text-emerald-400" : l.type === "warn" ? "text-amber-400" : l.type === "error" ? "text-red-400" : "text-zinc-400"
                      }`}>
                        <span className="text-zinc-600 shrink-0">{l.time}</span>
                        <span>{l.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── MULTI-SOURCE FALLBACK UPDATE ──────────────────────────────── */}
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 overflow-hidden">
          <div className="px-3 py-2.5 bg-sky-500/10 border-b border-sky-500/20 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] font-bold text-sky-300">Multi-Source Fallback Update</span>
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
              3 SOURCES
            </span>
          </div>

          <div className="p-3 space-y-3">
            <p className="text-[10px] text-zinc-400">
              <b className="text-sky-300">Agar GitHub fail ho tab bhi update milega!</b>{" "}
              Teen sources ek ke baad ek try hote hain — pehla kaam karne wala use hota hai.
            </p>

            {/* Source Status Cards */}
            <div>
              <button
                onClick={() => setShowSourcesExpanded(p => !p)}
                className="flex items-center gap-2 text-[10px] text-zinc-400 hover:text-zinc-200 mb-2 transition-colors"
              >
                {showSourcesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Layers className="w-3 h-3" />
                Update Sources Status
                {updateSources && <span className="text-sky-400 ml-1">({updateSources.summary})</span>}
                {loadingSources && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
              </button>

              {showSourcesExpanded && updateSources && (
                <div className="space-y-1.5">
                  {updateSources.sources.map((src) => (
                    <div key={src.id} className={`flex items-start gap-2 p-2 rounded-lg border text-[10px] ${
                      src.status === "available"
                        ? "border-emerald-500/25 bg-emerald-500/5"
                        : src.status === "no-package"
                          ? "border-amber-500/25 bg-amber-500/5"
                          : "border-zinc-700/30 bg-zinc-900/30"
                    }`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                        src.status === "available" ? "bg-emerald-500/20 text-emerald-400"
                          : src.status === "no-package" ? "bg-amber-500/20 text-amber-400"
                          : "bg-zinc-700/30 text-zinc-500"
                      }`}>{src.priority}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {src.id === "git-pull" && <Github className="w-3 h-3 text-zinc-400" />}
                          {src.id === "github-archive" && <Archive className="w-3 h-3 text-blue-400" />}
                          {src.id === "google-drive" && <HardDrive className="w-3 h-3 text-green-400" />}
                          <span className="font-semibold text-zinc-200">{src.name}</span>
                          <span className={`text-[8px] px-1 py-0.5 rounded font-bold ml-auto ${
                            src.status === "available" ? "bg-emerald-500/20 text-emerald-400"
                              : src.status === "no-package" ? "bg-amber-500/20 text-amber-400"
                              : "bg-zinc-700/40 text-zinc-500"
                          }`}>
                            {src.status === "available" ? "✅ READY" : src.status === "no-package" ? "⚠ NO PKG" : "❓ UNKNOWN"}
                          </span>
                        </div>
                        {src.detail && <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{src.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Multi-Source Update Button */}
            <button
              onClick={() => void runMultiUpdate()}
              disabled={multiUpdating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[11px] font-semibold hover:bg-sky-500/30 transition-colors disabled:opacity-50 w-full justify-center"
            >
              {multiUpdating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Multi-Source Update ho raha hai...</>
                : <><ShieldCheck className="w-4 h-4" /> Multi-Source Update Chalao (Fallback Safe)</>}
            </button>

            {multiUpdateResult && (
              <div className={`rounded-lg border p-3 ${multiUpdateResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {multiUpdateResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <span className={`text-[11px] font-bold ${multiUpdateResult.ok ? "text-emerald-300" : "text-red-300"}`}>
                    {multiUpdateResult.ok
                      ? `✅ Update ho gaya via: ${multiUpdateResult.sourceUsed ?? "?"}`
                      : "❌ Sabhi sources fail ho gaye"}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mb-2">{multiUpdateResult.message}</p>
                {multiUpdateResult.attempts.length > 0 && (
                  <div className="space-y-1">
                    {multiUpdateResult.attempts.map((a, i) => (
                      <div key={i} className={`flex items-center gap-1.5 text-[9px] ${a.ok ? "text-emerald-400" : "text-zinc-500"}`}>
                        {a.ok ? "✅" : "❌"} <span className="font-mono">{a.source}</span>: {a.message.slice(0, 70)}
                      </div>
                    ))}
                  </div>
                )}
                {multiUpdateResult.ok && multiUpdateResult.willRestart && (
                  <div className="mt-2 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                    <p className="text-[10px] text-amber-300">
                      <Zap className="w-3 h-3 inline mr-1" />
                      Server restart ho raha hai — thoda wait karo, phir refresh karo
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Drive Backup Section */}
            <div className="border-t border-sky-500/10 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-3 h-3 text-green-400" />
                <span className="text-[10px] font-bold text-zinc-300">Google Drive Backup (Source 3)</span>
                {driveManifest?.hasPackage && driveManifest.manifest && (
                  <span className="ml-auto text-[8px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                    v{driveManifest.manifest.version}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-zinc-500 mb-2">
                Current code ka snapshot Drive pe save karo — agar GitHub kabhi bhi down ho to Drive se update milega.
              </p>
              {driveManifest && !driveManifest.hasPackage && (
                <p className="text-[9px] text-amber-400 mb-2 bg-amber-500/10 px-2 py-1.5 rounded border border-amber-500/20">
                  ⚠ Drive pe abhi koi backup nahi — "Push to Drive" dabao ek backup banane ke liye
                </p>
              )}
              {driveManifest?.hasPackage && driveManifest.manifest && (
                <p className="text-[9px] text-green-400 mb-2 bg-green-500/10 px-2 py-1.5 rounded border border-green-500/20">
                  ✅ Drive backup ready — {new Date(driveManifest.manifest.timestamp).toLocaleDateString("en-IN")} ko upload hua
                </p>
              )}
              <button
                onClick={() => void pushToDrive()}
                disabled={drivePushing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 text-[10px] font-semibold hover:bg-green-500/25 transition-colors disabled:opacity-50 w-full justify-center"
              >
                {drivePushing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Drive pe upload ho raha hai...</>
                  : <><CloudUpload className="w-3.5 h-3.5" /> Current Code Push to Drive (Backup)</>}
              </button>
              {drivePushResult && (
                <div className={`mt-2 text-[10px] rounded px-2 py-1.5 border ${drivePushResult.ok ? "text-green-300 border-green-500/20 bg-green-500/5" : "text-red-300 border-red-500/20 bg-red-500/5"}`}>
                  {drivePushResult.ok ? "✅" : "❌"} {drivePushResult.message}
                </div>
              )}
            </div>

            {/* Refresh sources button */}
            <button
              onClick={() => void checkUpdateSources()}
              disabled={loadingSources}
              className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {loadingSources ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Sources refresh karo
            </button>
          </div>
        </div>

        {/* Auto Check Toggle (Frontend) */}
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3 flex items-center gap-3">
          <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-zinc-300">Frontend Auto-Check (har 1 minute)</div>
            <div className="text-[9px] text-zinc-500">Browser mein bhi auto-check (extra safety)</div>
          </div>
          <button onClick={() => setAutoCheck(p => !p)}
            className={`relative w-10 h-5 rounded-full transition-colors ${autoCheck ? "bg-emerald-500" : "bg-zinc-700"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoCheck ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
          <div className="px-3 py-2 bg-zinc-800/20 border-b border-zinc-800/40">
            <span className="text-[10px] font-bold text-zinc-400">GitHub Auto-Update Kaise Use Karo</span>
          </div>
          {[
            { step: "1", text: "GitHub pe code push kiya → Replit mein \"GitHub se Latest Pull Karo\" button dabao", cls: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" },
            { step: "2", text: "Pull complete hone ke baad → Workflow \"Restart\" karo → Naye changes live ho jayenge", cls: "bg-amber-500/20 border-amber-500/30 text-amber-400" },
            { step: "3", text: "Replit mein code change kiya → Commit message likho → \"GitHub pe Push Karo\" dabao", cls: "bg-violet-500/20 border-violet-500/30 text-violet-400" },
            { step: "4", text: "Auto-Check ON karo → Har minute GitHub check hoga → Agar update ho to banner dikhayi dega", cls: "bg-cyan-500/20 border-cyan-500/30 text-cyan-400" },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-2 px-3 py-2 border-b border-zinc-800/20 last:border-0">
              <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 ${item.cls}`}>{item.step}</span>
              <span className="text-[10px] text-zinc-300">{item.text}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
