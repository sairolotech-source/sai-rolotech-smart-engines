import React, { useState, useEffect, useCallback } from "react";
import {
  Cloud, CloudOff, HardDriveDownload, RefreshCw,
  CheckCircle2, AlertCircle, Trash2, RotateCcw,
  X, ExternalLink, ToggleLeft, ToggleRight, Loader2, FileSpreadsheet,
} from "lucide-react";
import {
  getDriveStatus,
  backupProjectToDrive,
  listDriveBackups,
  restoreFromDrive,
  disconnectDrive,
  listProjects,
  exportToSheets,
} from "../../lib/api";
import { useAuthStore } from "../../store/useAuthStore";

const AUTO_BACKUP_KEY = "roll_form_ai_drive_auto_backup";

interface DriveUser {
  displayName?: string;
  emailAddress?: string;
}

interface DriveBackup {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  description?: string;
}

interface Project {
  id: string;
  projectName: string;
  updatedAt: string | null;
}

function formatSize(bytes: string | number): string {
  const n = Number(bytes);
  if (isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface GoogleDrivePanelProps {
  onClose: () => void;
}

export function GoogleDrivePanel({ onClose }: GoogleDrivePanelProps) {
  const { user } = useAuthStore();

  const [status, setStatus] = useState<{ connected: boolean; user?: DriveUser } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [backups, setBackups] = useState<DriveBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backingUp, setBackingUp] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [autoBackup, setAutoBackup] = useState(() => {
    try { return localStorage.getItem(AUTO_BACKUP_KEY) === "true"; } catch { return false; }
  });
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [exportingSheets, setExportingSheets] = useState<string | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const checkStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const s = await getDriveStatus();
      setStatus(s);
    } catch {
      setStatus({ connected: false });
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    try {
      const data = await listProjects(user.uid);
      setProjects(data.projects || []);
    } catch { /* ignore */ }
  }, [user]);

  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const data = await listDriveBackups();
      setBackups(data.backups || []);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to load backups");
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    fetchProjects();
  }, [checkStatus, fetchProjects]);

  useEffect(() => {
    if (status?.connected) {
      fetchBackups();
    }
  }, [status?.connected, fetchBackups]);

  const handleBackup = async (projectId: string) => {
    setBackingUp(projectId);
    try {
      const result = await backupProjectToDrive(projectId);
      showToast("success", `Backed up: ${result.file.name}`);
      fetchBackups();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBackingUp(null);
    }
  };

  const handleRestore = async (fileId: string, fileName: string) => {
    if (!confirm(`Restore "${fileName}"? A new project copy will be created.`)) return;
    setRestoring(fileId);
    try {
      await restoreFromDrive(fileId);
      showToast("success", "Project restored successfully!");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Drive? Your backups will remain in Drive.")) return;
    setDisconnecting(true);
    try {
      await disconnectDrive();
      setStatus({ connected: false });
      showToast("success", "Disconnected from Google Drive");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleExportToSheets = async (projectId: string) => {
    setExportingSheets(projectId);
    try {
      const result = await exportToSheets(projectId);
      showToast("success", `Exported to Google Sheets: ${result.name}`);
      if (result.spreadsheetUrl) {
        window.open(result.spreadsheetUrl, "_blank");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Export to Sheets failed");
    } finally {
      setExportingSheets(null);
    }
  };

  const handleAutoBackupToggle = () => {
    const next = !autoBackup;
    setAutoBackup(next);
    try { localStorage.setItem(AUTO_BACKUP_KEY, String(next)); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-md pt-8 px-4">
      <div
        className="w-full max-w-2xl bg-[#0F0F1C] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center">
              <Cloud className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Google Drive Sync</h2>
              <p className="text-[11px] text-zinc-500">Back up and restore your roll-forming projects</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Toast */}
          {toast && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}>
              {toast.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
              {toast.msg}
            </div>
          )}

          {/* Connection Status */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <p className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider mb-3">Connection</p>
            {checkingStatus ? (
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking connection...
              </div>
            ) : status?.connected ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Connected</p>
                    {status.user?.emailAddress && (
                      <p className="text-[11px] text-zinc-500">{status.user.emailAddress}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/8 border border-red-500/15 hover:bg-red-500/15 transition-all disabled:opacity-50"
                >
                  {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudOff className="w-3 h-3" />}
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-500/10 border border-zinc-500/20 flex items-center justify-center">
                  <CloudOff className="w-4 h-4 text-zinc-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-100">Not Connected</p>
                  <p className="text-[11px] text-zinc-500">Google Drive is not available in this environment</p>
                </div>
              </div>
            )}
          </div>

          {status?.connected && (
            <>
              {/* Auto-backup Toggle */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Auto-backup on save</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Automatically sync to Drive after every project save</p>
                  </div>
                  <button
                    onClick={handleAutoBackupToggle}
                    className={`flex items-center gap-1.5 transition-colors ${autoBackup ? "text-blue-400" : "text-zinc-600 hover:text-zinc-400"}`}
                  >
                    {autoBackup
                      ? <ToggleRight className="w-8 h-8" />
                      : <ToggleLeft className="w-8 h-8" />}
                  </button>
                </div>
                {autoBackup && (
                  <p className="text-[10px] text-blue-400/70 mt-2 bg-blue-500/5 rounded px-2 py-1 border border-blue-500/10">
                    Auto-backup is ON — projects will sync to Drive automatically when saved
                  </p>
                )}
              </div>

              {/* Backup Projects */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <p className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider mb-3">Backup Projects</p>
                {projects.length === 0 ? (
                  <p className="text-xs text-zinc-500">No saved projects found. Save a project first.</p>
                ) : (
                  <div className="space-y-2">
                    {projects.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                      >
                        <div>
                          <p className="text-xs font-medium text-zinc-200">{p.projectName}</p>
                          {p.updatedAt && (
                            <p className="text-[10px] text-zinc-600">{formatDate(p.updatedAt)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleExportToSheets(p.id)}
                            disabled={exportingSheets === p.id}
                            title="Export to Google Sheets"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                                       text-green-400 bg-green-500/8 border border-green-500/15
                                       hover:bg-green-500/15 transition-all disabled:opacity-50"
                          >
                            {exportingSheets === p.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <FileSpreadsheet className="w-3 h-3" />}
                            Sheets
                          </button>
                          <button
                            onClick={() => handleBackup(p.id)}
                            disabled={backingUp === p.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
                                       text-blue-400 bg-blue-500/8 border border-blue-500/15
                                       hover:bg-blue-500/15 transition-all disabled:opacity-50"
                          >
                            {backingUp === p.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <HardDriveDownload className="w-3 h-3" />}
                            {backingUp === p.id ? "Backing up..." : "Backup"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Backup History */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-zinc-500 uppercase font-semibold tracking-wider">Backup History</p>
                  <button
                    onClick={fetchBackups}
                    disabled={loadingBackups}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingBackups ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                {loadingBackups ? (
                  <div className="flex items-center gap-2 text-zinc-500 text-xs py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading backups...
                  </div>
                ) : backups.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2 text-center">No backups yet. Back up a project above.</p>
                ) : (
                  <div className="space-y-2">
                    {backups.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <p className="text-xs font-medium text-zinc-200 truncate">{b.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-zinc-600">{formatDate(b.createdTime)}</span>
                            <span className="text-[10px] text-zinc-700">·</span>
                            <span className="text-[10px] text-zinc-600">{formatSize(b.size)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => handleRestore(b.id, b.name)}
                            disabled={restoring === b.id}
                            title="Restore this backup"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                                       text-emerald-400 bg-emerald-500/8 border border-emerald-500/15
                                       hover:bg-emerald-500/15 transition-all disabled:opacity-50"
                          >
                            {restoring === b.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RotateCcw className="w-3 h-3" />}
                            {restoring === b.id ? "Restoring..." : "Restore"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!status?.connected && !checkingStatus && (
            <div className="text-center py-6 text-zinc-600 text-sm space-y-1">
              <p>Google Drive is connected at the platform level.</p>
              <p className="text-xs">The connection will be available automatically when the server restarts.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex-shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">
            Backups stored in <span className="text-zinc-500 font-medium">Roll Form AI Backups</span> folder in your Drive
          </p>
          <a
            href="https://drive.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open Drive
          </a>
        </div>
      </div>
    </div>
  );
}
