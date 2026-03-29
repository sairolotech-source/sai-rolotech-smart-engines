import React, { useMemo } from "react";
import { X, AlertTriangle, CheckCircle, XCircle, RefreshCw, FileDown, Info, Shield } from "lucide-react";
import {
  validateStationProfiles,
  type RollToolingResult,
  type StationProfileStatus,
} from "../../store/useCncStore";

// ─── Root-cause checks ────────────────────────────────────────────────────────

interface RootCause {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

function getStationRootCauses(rt: RollToolingResult): RootCause[] {
  const rp = rt.rollProfile;
  const causes: RootCause[] = [];

  causes.push({
    key: "profile_present",
    label: "Roll Profile Object",
    pass: !!rp,
    detail: rp ? "rollProfile object present" : "rollProfile is null — re-run Generate Roll Tooling",
  });

  causes.push({
    key: "geometry_present",
    label: "Geometry Synthesis",
    pass: !!rp?.upperProfile?.length || !!rp?.geometry,
    detail: rp?.upperProfile?.length
      ? `${rp.upperProfile.length} upper-profile points`
      : rp?.geometry
      ? "geometry object present"
      : "upperProfile/geometry absent — geometry synthesis failed",
  });

  const bendExtracted = Array.isArray(rt.bendAngles) && rt.bendAngles.length > 0;
  causes.push({
    key: "bend_extraction",
    label: "Bend Extraction",
    pass: bendExtracted,
    detail: bendExtracted
      ? `${rt.bendAngles.length} bend angle(s): ${rt.bendAngles.map((a) => `${a.toFixed(1)}°`).join(", ")}`
      : "bendAngles array empty — DXF arc detection may have failed",
  });

  const hasFlower = !!rp?.formingAngles?.length || !!rp?.passDistribution?.length;
  causes.push({
    key: "flower_pass",
    label: "Flower Pass Data",
    pass: hasFlower,
    detail: hasFlower
      ? `${rp?.formingAngles?.length ?? rp?.passDistribution?.length} passes computed`
      : "No forming angles / pass distribution — run Flower Pattern first",
  });

  const hasCalib = !!rp?.calibrationPasses || (Array.isArray(rp?.notes) && rp.notes.some((n: string) => n?.toLowerCase().includes("calibr")));
  causes.push({
    key: "calibration",
    label: "Calibration Data",
    pass: hasCalib,
    detail: hasCalib ? "Calibration pass data present" : "No calibration pass — final-station accuracy may be lower",
  });

  const gcode = rp?.gcode || rp?.gcodeOutput || rt.gcodeOutput;
  const hasGcode = typeof gcode === "string" && gcode.trim().length > 10;
  causes.push({
    key: "gcode",
    label: "G-Code Output",
    pass: hasGcode,
    detail: hasGcode
      ? `${gcode.split("\n").length} G-code lines`
      : "G-code absent or empty — run Generate G-Code",
  });

  return causes;
}

// ─── Status styling ───────────────────────────────────────────────────────────

const STATUS_STYLE: Record<StationProfileStatus | "BLOCKED", { text: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  VALID:           { text: "text-green-400",  bg: "bg-green-950/40",  border: "border-green-700/40",  icon: <CheckCircle className="w-3.5 h-3.5 text-green-400" />,  label: "Complete"   },
  BASIC:           { text: "text-amber-400",  bg: "bg-amber-950/30",  border: "border-amber-700/40",  icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />, label: "Incomplete" },
  MISSING_PROFILE: { text: "text-red-400",    bg: "bg-red-950/40",    border: "border-red-800/40",    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,         label: "No Profile" },
  BLOCKED:         { text: "text-red-400",    bg: "bg-red-950/50",    border: "border-red-700/40",    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,         label: "Blocked"    },
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ExportPreflightModalProps {
  rollTooling: RollToolingResult[];
  onClose: () => void;
  onExport: () => void;
  onRegenerateIncomplete: () => void;
  projectName?: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ExportPreflightModal({
  rollTooling,
  onClose,
  onExport,
  onRegenerateIncomplete,
  projectName = "Roll Package",
}: ExportPreflightModalProps) {
  const validations = useMemo(() => validateStationProfiles(rollTooling), [rollTooling]);

  const counts = useMemo(() => {
    const c = { VALID: 0, BASIC: 0, MISSING_PROFILE: 0, BLOCKED: 0 };
    validations.forEach((v) => { (c as Record<string, number>)[v.status] = ((c as Record<string, number>)[v.status] ?? 0) + 1; });
    return c;
  }, [validations]);

  const blockers = validations.filter((v) => v.status === "MISSING_PROFILE" || v.status === "BLOCKED");
  const warnings = validations.filter((v) => v.status === "BASIC");
  const canExport = blockers.length === 0;
  const canExportWithWarnings = blockers.length === 0;

  const [expandedStation, setExpandedStation] = React.useState<number | null>(null);

  const totalGcodeLines = useMemo(() => {
    let n = 0;
    for (const rt of rollTooling) {
      const rp = rt.rollProfile;
      const g = rp?.gcode || rp?.gcodeOutput || rt.gcodeOutput;
      if (typeof g === "string") n += g.split("\n").length;
    }
    return n;
  }, [rollTooling]);

  const totalBends = useMemo(() => {
    let n = 0;
    for (const rt of rollTooling) n += (rt.bendAngles?.length ?? 0);
    return n;
  }, [rollTooling]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${canExport ? "bg-green-900/40 border border-green-700/40" : "bg-red-900/40 border border-red-700/40"}`}>
            <Shield className={`w-5 h-5 ${canExport ? "text-green-400" : "text-red-400"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[14px] font-bold text-white">Export Preflight Report</h2>
            <p className="text-[10px] text-zinc-500">{projectName} · {rollTooling.length} stations · {new Date().toLocaleString()}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Score Summary ── */}
        <div className="px-5 py-3 border-b border-white/8 flex-shrink-0">
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Total",    val: rollTooling.length, color: "text-zinc-300",  bg: "bg-zinc-800/60",    border: "border-zinc-700" },
              { label: "Complete", val: counts.VALID,        color: "text-green-400", bg: "bg-green-950/40",   border: "border-green-700/40" },
              { label: "Incomplete",val: counts.BASIC,       color: "text-amber-400", bg: "bg-amber-950/30",   border: "border-amber-700/40" },
              { label: "No Profile",val: counts.MISSING_PROFILE, color: "text-red-400", bg: "bg-red-950/40",  border: "border-red-800/40" },
              { label: "Blocked",  val: counts.BLOCKED,     color: "text-red-400",   bg: "bg-red-950/40",     border: "border-red-700/40" },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg border ${item.bg} ${item.border} px-2 py-2 text-center`}>
                <div className={`text-lg font-black font-mono ${item.color}`}>{item.val}</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Additional stats */}
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-zinc-500">
            <span>Total bends: <strong className="text-zinc-300 font-mono">{totalBends}</strong></span>
            <span>Total G-code lines: <strong className="text-zinc-300 font-mono">{totalGcodeLines}</strong></span>
            <span>Export status: <strong className={canExport ? "text-green-400" : "text-red-400"}>{canExport ? "READY" : "BLOCKED"}</strong></span>
          </div>
        </div>

        {/* ── Blockers + Warnings banners ── */}
        {(blockers.length > 0 || warnings.length > 0) && (
          <div className="px-5 pt-3 space-y-2 flex-shrink-0">
            {blockers.length > 0 && (
              <div className="rounded-lg border border-red-700/40 bg-red-950/20 px-3 py-2 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-red-300">
                  <strong>{blockers.length} BLOCKER{blockers.length > 1 ? "S" : ""}:</strong>{" "}
                  Stations {blockers.map((v) => v.stationNumber).join(", ")} missing roll profiles — export not allowed.
                </div>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-700/40 bg-amber-950/15 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-300">
                  <strong>{warnings.length} WARNING{warnings.length > 1 ? "S" : ""}:</strong>{" "}
                  Stations {warnings.map((v) => v.stationNumber).join(", ")} have incomplete profiles — G-code or geometry missing.
                </div>
              </div>
            )}
          </div>
        )}

        {canExport && blockers.length === 0 && warnings.length === 0 && (
          <div className="px-5 pt-3 flex-shrink-0">
            <div className="rounded-lg border border-green-700/40 bg-green-950/20 px-3 py-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
              <div className="text-[11px] text-green-300 font-semibold">All {rollTooling.length} stations complete — export ready</div>
            </div>
          </div>
        )}

        {/* ── Station Table ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
            Per-Station Health Report
          </div>

          {rollTooling.map((rt, idx) => {
            const v = validations[idx];
            if (!v) return null;
            const style = STATUS_STYLE[v.status as keyof typeof STATUS_STYLE] ?? STATUS_STYLE.MISSING_PROFILE;
            const isExpanded = expandedStation === rt.stationNumber;
            const causes = getStationRootCauses(rt);
            const failedCauses = causes.filter((c) => !c.pass);

            return (
              <div key={rt.stationNumber} className={`rounded-lg border overflow-hidden ${style.border} ${style.bg}`}>
                <button
                  onClick={() => setExpandedStation(isExpanded ? null : rt.stationNumber)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
                >
                  {style.icon}
                  <span className="text-[11px] font-bold text-zinc-200 w-24 shrink-0">{rt.label}</span>
                  <span className={`text-[10px] font-semibold ${style.text}`}>{style.label}</span>
                  <span className="text-[10px] text-zinc-500 ml-auto truncate max-w-[180px]">{v.reason}</span>
                  {failedCauses.length > 0 && (
                    <span className="text-[9px] font-bold text-red-400 ml-2 shrink-0">{failedCauses.length} issue{failedCauses.length > 1 ? "s" : ""}</span>
                  )}
                  <span className="text-[9px] text-zinc-600 ml-2 shrink-0">{isExpanded ? "▲" : "▼"}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-white/[0.05] px-3 py-2 space-y-1">
                    {causes.map((c) => (
                      <div key={c.key} className="flex items-start gap-2 text-[10px]">
                        {c.pass
                          ? <CheckCircle className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                          : <XCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                        }
                        <span className={`font-semibold w-32 shrink-0 ${c.pass ? "text-zinc-400" : "text-red-300"}`}>{c.label}</span>
                        <span className={c.pass ? "text-zinc-500" : "text-red-400/80"}>{c.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer actions ── */}
        <div className="px-5 py-4 border-t border-white/8 flex items-center gap-3 flex-shrink-0">
          {(blockers.length > 0 || warnings.length > 0) && (
            <button
              onClick={onRegenerateIncomplete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-900/40 hover:bg-amber-900/60 border border-amber-700/50 text-amber-300 text-[11px] font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate Incomplete
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[11px] font-semibold transition-colors"
          >
            Close
          </button>
          {canExportWithWarnings && (
            <button
              onClick={() => { onExport(); onClose(); }}
              disabled={!canExport}
              title={!canExport ? "Fix blockers before exporting" : "Export complete package ZIP"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-600 text-white text-[11px] font-semibold transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              {canExport ? "Export Package" : "Export Blocked"}
            </button>
          )}
          {!canExport && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-400">
              <Info className="w-3.5 h-3.5" />
              Fix {blockers.length} blocker{blockers.length > 1 ? "s" : ""} to enable export
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
