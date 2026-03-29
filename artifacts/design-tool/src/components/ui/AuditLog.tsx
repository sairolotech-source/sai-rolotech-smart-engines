/**
 * AuditLog.tsx — In-app audit log for engineering actions
 * v2.4.0: Backend persistence with sessionStorage fallback.
 * Backend: POST /api/audit-log, GET /api/audit-log
 * Never crashes export flow — all errors silently handled.
 */
import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, ChevronDown, ChevronUp, Download,
  CheckCircle, Edit3, Lock, Shield, Trash2, Cloud, WifiOff,
} from "lucide-react";

export type AuditAction =
  | "export_svg"
  | "export_dxf"
  | "export_pdf"
  | "export_pdf_all"
  | "export_zip"
  | "release_change"
  | "profile_change"
  | "station_change"
  | "simulation_run"
  | "risk_analysis";

export interface AuditEntry {
  id:         string;
  timestamp:  string;
  action:     AuditAction;
  label:      string;
  detail?:    string;
  user?:      string;
  role?:      string;
  station?:   number;
  drawingNo?: string;
  revision?:  string;
  customer?:  string;
  jobNo?:     string;
  synced?:    boolean;
}

const STORAGE_KEY = "sai_rolotech_audit_log";
const MAX_LOCAL   = 200;

// ─── Backend sync (fire-and-forget — never throws) ──────────────────────────

async function pushToBackend(entry: AuditEntry): Promise<boolean> {
  try {
    const actionMap: Partial<Record<AuditAction, string>> = {
      export_svg:     "svg_export",
      export_dxf:     "dxf_export",
      export_pdf:     "pdf_export",
      export_pdf_all: "pdf_all_export",
      export_zip:     "zip_export",
      release_change: "approval_change",
    };
    const res = await fetch("/api/audit-log", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer offline-sai-rolotech-local",
      },
      body: JSON.stringify({
        username:      entry.user    ?? "SAI Engineer",
        role:          entry.role    ?? "designer",
        action:        actionMap[entry.action] ?? entry.action,
        station_no:    entry.station ?? null,
        filename:      entry.label,
        drawing_no:    entry.drawingNo ?? "",
        revision:      entry.revision  ?? "R0",
        customer_name: entry.customer  ?? "",
        job_no:        entry.jobNo     ?? "",
        release_state: "draft",
        success:       true,
        message:       entry.detail ?? "",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Hook: useAuditLog ─────────────────────────────────────────────────────

export function useAuditLog() {
  const loadEntries = (): AuditEntry[] => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const [entries,     setEntries]     = useState<AuditEntry[]>(loadEntries);
  const [backendOk,   setBackendOk]   = useState(true);

  const addEntry = useCallback((
    action:    AuditAction,
    label:     string,
    detail?:   string,
    station?:  number,
    extra?:    Pick<AuditEntry, "drawingNo" | "revision" | "customer" | "jobNo" | "role">,
  ) => {
    const entry: AuditEntry = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      label,
      detail,
      station,
      user:      "SAI Engineer",
      role:      extra?.role ?? "designer",
      drawingNo: extra?.drawingNo,
      revision:  extra?.revision,
      customer:  extra?.customer,
      jobNo:     extra?.jobNo,
      synced:    false,
    };

    // Local first
    setEntries(prev => {
      const next = [entry, ...prev].slice(0, MAX_LOCAL);
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });

    // Backend async (fire-and-forget)
    pushToBackend(entry).then(ok => {
      setBackendOk(ok);
      if (ok) {
        setEntries(prev =>
          prev.map(e => e.id === entry.id ? { ...e, synced: true } : e)
        );
      }
    });
  }, []);

  const clearLog = useCallback(() => {
    setEntries([]);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  // Load backend history on mount (augment local with backend)
  useEffect(() => {
    fetch("/api/audit-log?limit=50", {
      headers: { "Authorization": "Bearer offline-sai-rolotech-local" },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.entries?.length > 0) {
          setBackendOk(true);
          // Merge backend entries (avoid duplicates by id)
          setEntries(prev => {
            const localIds = new Set(prev.map((e: AuditEntry) => e.id));
            const backendEntries = data.entries
              .filter((e: AuditEntry) => !localIds.has(e.id))
              .map((e: AuditEntry) => ({ ...e, synced: true, action: _mapBackendAction(e.action) }));
            return [...prev, ...backendEntries].slice(0, MAX_LOCAL);
          });
        }
      })
      .catch(() => setBackendOk(false));
  }, []);

  return { entries, addEntry, clearLog, backendOk };
}

function _mapBackendAction(action: string): AuditAction {
  const map: Record<string, AuditAction> = {
    svg_export:      "export_svg",
    dxf_export:      "export_dxf",
    pdf_export:      "export_pdf",
    pdf_all_export:  "export_pdf_all",
    zip_export:      "export_zip",
    approval_change: "release_change",
  };
  return (map[action] ?? "simulation_run") as AuditAction;
}

// ─── AuditLogPanel component ───────────────────────────────────────────────

const ACTION_ICON: Record<AuditAction, React.ReactNode> = {
  export_svg:      <Download size={11} className="text-blue-400" />,
  export_dxf:      <Download size={11} className="text-green-400" />,
  export_pdf:      <Download size={11} className="text-red-400" />,
  export_pdf_all:  <Download size={11} className="text-orange-400" />,
  export_zip:      <Download size={11} className="text-amber-400" />,
  release_change:  <Lock size={11} className="text-purple-400" />,
  profile_change:  <Edit3 size={11} className="text-sky-400" />,
  station_change:  <Edit3 size={11} className="text-indigo-400" />,
  simulation_run:  <CheckCircle size={11} className="text-emerald-400" />,
  risk_analysis:   <Shield size={11} className="text-yellow-400" />,
};

const ACTION_COLOR: Record<AuditAction, string> = {
  export_svg:      "border-blue-800/50",
  export_dxf:      "border-green-800/50",
  export_pdf:      "border-red-800/50",
  export_pdf_all:  "border-orange-800/50",
  export_zip:      "border-amber-800/50",
  release_change:  "border-purple-800/50",
  profile_change:  "border-sky-800/50",
  station_change:  "border-indigo-800/50",
  simulation_run:  "border-emerald-800/50",
  risk_analysis:   "border-yellow-800/50",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

interface AuditLogPanelProps {
  entries:    AuditEntry[];
  onClear:    () => void;
  backendOk?: boolean;
  className?: string;
}

export function AuditLogPanel({ entries, onClear, backendOk = true, className = "" }: AuditLogPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border border-slate-700/60 rounded-lg bg-slate-900/60 ${className}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-slate-300 hover:text-white"
      >
        <div className="flex items-center gap-2 text-xs font-semibold">
          <ClipboardList size={13} className="text-slate-400" />
          Activity Log
          {entries.length > 0 && (
            <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-slate-300">
              {entries.length}
            </span>
          )}
          {backendOk
            ? <span title="Synced to server"><Cloud size={10} className="text-green-500" /></span>
            : <span title="Local only — server unavailable"><WifiOff size={10} className="text-yellow-500" /></span>
          }
        </div>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="border-t border-slate-700/60">
          {entries.length === 0 ? (
            <div className="px-3 py-4 text-center text-slate-500 text-xs">
              No actions recorded yet.
            </div>
          ) : (
            <>
              <div className="max-h-52 overflow-y-auto">
                {entries.map(e => (
                  <div
                    key={e.id}
                    className={`flex items-start gap-2 px-3 py-1.5 border-b border-slate-800/80 ${ACTION_COLOR[e.action]}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{ACTION_ICON[e.action]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white font-medium truncate">{e.label}</span>
                        {e.station !== undefined && (
                          <span className="text-[10px] text-slate-500">St.{e.station}</span>
                        )}
                        {e.synced && <span title="Saved to server"><Cloud size={9} className="text-green-600 shrink-0" /></span>}
                      </div>
                      {e.detail && (
                        <div className="text-[10px] text-slate-400 truncate">{e.detail}</div>
                      )}
                      {(e.customer || e.jobNo) && (
                        <div className="text-[9px] text-slate-500">
                          {e.customer && `Customer: ${e.customer}`}
                          {e.customer && e.jobNo && " · "}
                          {e.jobNo && `Job: ${e.jobNo}`}
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-600 flex-shrink-0 font-mono mt-0.5">
                      {formatTime(e.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 flex justify-between items-center">
                <span className="text-[9px] text-slate-600">
                  {backendOk ? "✓ Server persistence active" : "⚠ Local only"}
                </span>
                <button
                  onClick={onClear}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={10} /> Clear log
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
