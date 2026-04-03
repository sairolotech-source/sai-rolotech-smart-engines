import React, { useState, useEffect } from "react";
import { History, FileText, Package, Trash2, X, RefreshCw } from "lucide-react";

interface ExportRecord {
  id: string;
  type: string;
  fileName: string;
  timestamp: string;
  sections?: string[];
  profileName?: string;
}

interface ExportHistoryPanelProps {
  onClose: () => void;
  onRegeneratePdf?: () => void;
  onRegenerateZip?: () => void;
}

export function ExportHistoryPanel({ onClose, onRegeneratePdf, onRegenerateZip }: ExportHistoryPanelProps) {
  const [history, setHistory] = useState<ExportRecord[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sai-rolotech-smart-engines-export-history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("sai-rolotech-smart-engines-export-history");
    setHistory([]);
  };

  const removeItem = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem("sai-rolotech-smart-engines-export-history", JSON.stringify(updated));
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
        " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const typeIcon = (type: string) => {
    if (type.includes("PDF")) return <FileText className="w-4 h-4 text-red-400" />;
    if (type.includes("ZIP") || type.includes("Package")) return <Package className="w-4 h-4 text-blue-400" />;
    return <FileText className="w-4 h-4 text-zinc-400" />;
  };

  const isPdf = (type: string) => type.includes("PDF");
  const isZip = (type: string) => type.includes("ZIP") || type.includes("Package");

  const handleRegenerate = (record: ExportRecord) => {
    onClose();
    if (isPdf(record.type) && onRegeneratePdf) {
      onRegeneratePdf();
    } else if (isZip(record.type) && onRegenerateZip) {
      onRegenerateZip();
    } else if (onRegeneratePdf) {
      onRegeneratePdf();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-lg bg-[#0F0F1C] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Export History</h2>
                <p className="text-xs text-amber-300/70">{history.length} export{history.length !== 1 ? "s" : ""} recorded</p>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {history.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <History className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500 font-medium">No exports yet</p>
              <p className="text-xs text-zinc-600 mt-1">Generated reports and job packages will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {history.map(record => (
                <div key={record.id} className="px-6 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{typeIcon(record.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-200 truncate">{record.fileName}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 flex-shrink-0">
                          {record.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {formatDate(record.timestamp)}
                        {record.profileName && <span> · {record.profileName}</span>}
                      </div>
                      {record.sections && record.sections.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {record.sections.map(s => (
                            <span key={s} className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {s.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-1.5">
                        <button
                          onClick={() => handleRegenerate(record)}
                          className="text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                          title={isPdf(record.type) ? "Open PDF Report generator with current data" : "Open Job Package export with current data"}
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          {isPdf(record.type) ? "Regenerate PDF" : isZip(record.type) ? "Regenerate Package" : "Regenerate"}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(record.id)}
                      className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-white/[0.06] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Close
          </button>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="py-2 px-4 rounded-lg text-sm font-semibold bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/20 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
