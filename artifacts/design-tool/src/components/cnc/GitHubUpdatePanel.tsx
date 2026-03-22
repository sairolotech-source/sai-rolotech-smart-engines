import React, { useState, useEffect, useCallback } from "react";
import {
  Github, RefreshCw, Download, Upload, CheckCircle2,
  AlertTriangle, Clock, GitBranch, GitCommit, Loader2,
  Wifi, WifiOff, Info, ChevronDown, ChevronRight, Zap
} from "lucide-react";

interface GitStatus {
  ok: boolean;
  local: { commit: string; fullCommit: string; branch: string; recentLogs: string[] };
  github: { commit: string; message: string; date: string; reachable: boolean; repo: string };
  upToDate: boolean;
  updatesAvailable: boolean;
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

  useEffect(() => { void checkStatus(); }, [checkStatus]);

  useEffect(() => {
    if (!autoCheck) return;
    const interval = setInterval(() => { void checkStatus(); }, 60_000);
    return () => clearInterval(interval);
  }, [autoCheck, checkStatus]);

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

        {/* Auto Check Toggle */}
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3 flex items-center gap-3">
          <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-zinc-300">Auto-Check (har 1 minute)</div>
            <div className="text-[9px] text-zinc-500">GitHub se automatically update check karo</div>
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
            { step: "1", text: "GitHub pe code push kiya → Replit mein \"GitHub se Latest Pull Karo\" button dabao", color: "emerald" },
            { step: "2", text: "Pull complete hone ke baad → Workflow \"Restart\" karo → Naye changes live ho jayenge", color: "amber" },
            { step: "3", text: "Replit mein code change kiya → Commit message likho → \"GitHub pe Push Karo\" dabao", color: "violet" },
            { step: "4", text: "Auto-Check ON karo → Har minute GitHub check hoga → Agar update ho to banner dikhayi dega", color: "cyan" },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-2 px-3 py-2 border-b border-zinc-800/20 last:border-0">
              <span className={`w-5 h-5 rounded-full bg-${item.color}-500/20 border border-${item.color}-500/30 flex items-center justify-center text-[9px] font-bold text-${item.color}-400 shrink-0 mt-0.5`}>{item.step}</span>
              <span className="text-[10px] text-zinc-300">{item.text}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
