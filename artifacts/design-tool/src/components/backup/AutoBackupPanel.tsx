import { useState, useEffect } from "react";
import {
  getBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  exportBackupAsFile,
  importBackupFromFile,
  getStorageUsage,
} from "../../lib/auto-backup";

export function AutoBackupPanel() {
  const [backups, setBackups] = useState(getBackups());
  const [usage, setUsage] = useState(getStorageUsage());
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const refresh = () => {
    setBackups(getBackups());
    setUsage(getStorageUsage());
  };

  useEffect(() => {
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, []);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleManualBackup = () => {
    const entry = createBackup(true);
    if (entry) {
      showMsg(`Manual backup saved — ${entry.date} (${entry.sizeKB} KB)`, "success");
      refresh();
    } else {
      showMsg("Backup failed — no project data found", "error");
    }
  };

  const handleRestore = (id: string) => {
    if (restoreId === id) {
      const ok = restoreBackup(id);
      if (ok) {
        showMsg("Backup restored! Reloading...", "success");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showMsg("Restore failed — backup data may be corrupted", "error");
      }
      setRestoreId(null);
    } else {
      setRestoreId(id);
      setTimeout(() => setRestoreId(null), 5000);
    }
  };

  const handleDelete = (id: string) => {
    deleteBackup(id);
    showMsg("Backup deleted", "success");
    refresh();
  };

  const handleExport = (id: string) => {
    exportBackupAsFile(id);
    showMsg("Backup file downloaded", "success");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await importBackupFromFile(file);
    if (ok) {
      showMsg("File imported! Reloading...", "success");
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showMsg("Import failed — invalid backup file", "error");
    }
    e.target.value = "";
  };

  return (
    <div className="h-full overflow-auto bg-[#0a0b14] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400">💾</span>
              Auto Backup System
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              Har 5 minute me auto-save — laptop band ho ya charging khatam, kuch nahi jayega
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Active — Every 5 min
            </span>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#12131f] border border-white/5 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Total Backups</p>
            <p className="text-2xl font-bold text-white">{usage.backupCount}</p>
            <p className="text-zinc-600 text-xs">Max {50} kept</p>
          </div>
          <div className="bg-[#12131f] border border-white/5 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Backup Size</p>
            <p className="text-2xl font-bold text-amber-400">{usage.totalBackupKB} KB</p>
            <p className="text-zinc-600 text-xs">localStorage</p>
          </div>
          <div className="bg-[#12131f] border border-white/5 rounded-xl p-4">
            <p className="text-zinc-500 text-xs mb-1">Total Storage Used</p>
            <p className="text-2xl font-bold text-cyan-400">{usage.usedKB} KB</p>
            <p className="text-zinc-600 text-xs">All app data</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleManualBackup}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-400 text-sm font-medium transition-colors"
          >
            💾 Manual Backup Now
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm font-medium transition-colors cursor-pointer">
            📂 Import Backup File
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>

        <div className="bg-[#12131f] border border-white/5 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Backup History</h3>
            <p className="text-zinc-600 text-xs mt-0.5">Click restore to load — double-click to confirm</p>
          </div>

          {backups.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">
              No backups yet — first auto-backup will save in a few minutes
            </div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
              {backups.map((bk) => (
                <div key={bk.id} className="p-3 px-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${bk.auto ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
                    {bk.auto ? "A" : "M"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{bk.profileName || "Untitled"}</span>
                      <span className="text-zinc-600 text-xs">•</span>
                      <span className="text-zinc-500 text-xs">{bk.materialType}</span>
                      {bk.stations > 0 && (
                        <>
                          <span className="text-zinc-600 text-xs">•</span>
                          <span className="text-zinc-500 text-xs">{bk.stations} stations</span>
                        </>
                      )}
                    </div>
                    <div className="text-zinc-600 text-xs mt-0.5">
                      {bk.date} — {bk.sizeKB} KB — Tab: {bk.tab}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleRestore(bk.id)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${restoreId === bk.id ? "bg-green-500 text-white" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}
                    >
                      {restoreId === bk.id ? "Confirm?" : "Restore"}
                    </button>
                    <button
                      onClick={() => handleExport(bk.id)}
                      className="px-3 py-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs font-medium transition-colors"
                    >
                      Export
                    </button>
                    <button
                      onClick={() => handleDelete(bk.id)}
                      className="px-3 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#12131f] border border-white/5 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Backup Protection Features</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: "⏰", title: "Auto-Save Every 5 Minutes", desc: "Background save — no manual action needed" },
              { icon: "🔋", title: "Battery/Close Protection", desc: "Saves when browser tab closes or hides" },
              { icon: "🔄", title: "Smart Detection", desc: "Only saves when data actually changes" },
              { icon: "📦", title: "50 Backup Slots", desc: "Keeps last 50 backups, auto-rotates oldest" },
              { icon: "💾", title: "Export to File", desc: "Download .json file for permanent safe storage" },
              { icon: "📂", title: "Import from File", desc: "Load backup from any saved .json file" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg">
                <span className="text-lg">{f.icon}</span>
                <div>
                  <p className="text-white text-xs font-medium">{f.title}</p>
                  <p className="text-zinc-600 text-[10px] mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
