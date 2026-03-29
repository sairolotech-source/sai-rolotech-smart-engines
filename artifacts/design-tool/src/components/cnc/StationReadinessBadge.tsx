import React from "react";
import {
  validateStationProfiles,
  type RollToolingResult,
  type StationProfileStatus,
} from "../../store/useCncStore";

// ─── Status config ────────────────────────────────────────────────────────────

interface BadgeConfig {
  label: string;
  dot: string;
  ring: string;
  text: string;
  bg: string;
  icon: string;
}

const STATUS_CONFIG: Record<StationProfileStatus | "BLOCKED", BadgeConfig> = {
  VALID: {
    label: "Complete",
    dot: "bg-green-500",
    ring: "border-green-700/60",
    text: "text-green-400",
    bg: "bg-green-950/50",
    icon: "✓",
  },
  BASIC: {
    label: "Incomplete",
    dot: "bg-amber-400",
    ring: "border-amber-700/60",
    text: "text-amber-400",
    bg: "bg-amber-950/40",
    icon: "⚠",
  },
  MISSING_PROFILE: {
    label: "No Profile",
    dot: "bg-red-500",
    ring: "border-red-800/60",
    text: "text-red-400",
    bg: "bg-red-950/40",
    icon: "✕",
  },
  BLOCKED: {
    label: "Blocked",
    dot: "bg-red-600",
    ring: "border-red-700/60",
    text: "text-red-400",
    bg: "bg-red-950/50",
    icon: "⊘",
  },
};

// ─── Single-station badge ─────────────────────────────────────────────────────

export interface StationReadinessProps {
  rt: RollToolingResult;
  showReason?: boolean;
  size?: "xs" | "sm";
}

export function StationReadinessBadge({ rt, showReason = false, size = "xs" }: StationReadinessProps) {
  const [validations] = React.useMemo(
    () => [validateStationProfiles([rt])],
    [rt]
  );
  const v = validations[0];
  const status: StationProfileStatus | "BLOCKED" = v?.status ?? "MISSING_PROFILE";
  const cfg = STATUS_CONFIG[status];

  const textSize = size === "sm" ? "text-[11px]" : "text-[9px]";
  const padSize  = size === "sm" ? "px-2 py-0.5" : "px-1.5 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded border ${textSize} ${padSize} ${cfg.text} ${cfg.bg} ${cfg.ring}`}
      title={v?.reason ?? ""}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.icon} {cfg.label}
      {showReason && v?.reason && (
        <span className="font-normal opacity-70 ml-1 max-w-[180px] truncate">{v.reason}</span>
      )}
    </span>
  );
}

// ─── Summary panel (for export preflight / station overview) ─────────────────

export interface StationReadinessSummaryProps {
  rollTooling: RollToolingResult[];
  compact?: boolean;
}

export function StationReadinessSummary({ rollTooling, compact = false }: StationReadinessSummaryProps) {
  const validations = React.useMemo(
    () => validateStationProfiles(rollTooling),
    [rollTooling]
  );

  const counts = React.useMemo(() => {
    const c = { VALID: 0, BASIC: 0, MISSING_PROFILE: 0, BLOCKED: 0 };
    validations.forEach(v => { c[v.status as keyof typeof c] = (c[v.status as keyof typeof c] ?? 0) + 1; });
    return c;
  }, [validations]);

  const allComplete = counts.VALID === rollTooling.length && rollTooling.length > 0;
  const hasIssues   = counts.MISSING_PROFILE > 0 || counts.BASIC > 0 || counts.BLOCKED > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {rollTooling.length === 0 ? (
          <span className="text-[9px] text-zinc-600">No stations generated</span>
        ) : (
          <>
            {counts.VALID > 0     && <span className="text-[9px] font-bold text-green-400">✓ {counts.VALID} Complete</span>}
            {counts.BASIC > 0     && <span className="text-[9px] font-bold text-amber-400">⚠ {counts.BASIC} Incomplete</span>}
            {counts.MISSING_PROFILE > 0 && <span className="text-[9px] font-bold text-red-400">✕ {counts.MISSING_PROFILE} No Profile</span>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${allComplete ? "bg-green-950/20 border-green-700/30" : hasIssues ? "bg-red-950/15 border-red-800/30" : "bg-zinc-900 border-zinc-700"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          Station Readiness — {rollTooling.length} Stations
        </span>
        {allComplete && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-green-900/60 border border-green-700/50 text-green-400">
            ✓ All Ready
          </span>
        )}
        {hasIssues && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-900/60 border border-red-700/50 text-red-400">
            ⚠ Export Blocked
          </span>
        )}
      </div>

      {/* Count chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const n = counts[key as keyof typeof counts] ?? 0;
          if (n === 0) return null;
          return (
            <span key={key} className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.text} ${cfg.bg} ${cfg.ring}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {n} {cfg.label}
            </span>
          );
        })}
      </div>

      {/* Incomplete station list */}
      {hasIssues && (
        <div className="space-y-1 mt-1">
          {validations
            .filter(v => v.status !== "VALID")
            .map(v => {
              const cfg = STATUS_CONFIG[v.status as StationProfileStatus | "BLOCKED"];
              return (
                <div key={v.stationNumber} className="flex items-start gap-2 text-[9px]">
                  <span className={`font-bold ${cfg.text} flex-shrink-0 w-16`}>
                    {cfg.icon} Stn {v.stationNumber}
                  </span>
                  <span className={`${cfg.label === "Incomplete" ? "text-amber-500/80" : "text-red-400/80"} leading-tight`}>
                    {v.reason}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ─── Export preflight check (returns blocking info) ───────────────────────────

export interface PreflightResult {
  canExport: boolean;
  blockers: string[];
  warnings: string[];
  incompleteCount: number;
  missingCount: number;
}

export function runExportPreflight(
  rollTooling: RollToolingResult[],
  options?: { requireGeometry?: boolean; requireGcode?: boolean }
): PreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (rollTooling.length === 0) {
    blockers.push("No stations generated — run Generate Roll Tooling first");
    return { canExport: false, blockers, warnings, incompleteCount: 0, missingCount: 0 };
  }

  const validations = validateStationProfiles(rollTooling);
  const missing   = validations.filter(v => v.status === "MISSING_PROFILE");
  const basic     = validations.filter(v => v.status === "BASIC");
  const missingCount  = missing.length;
  const incompleteCount = basic.length;

  if (missing.length > 0) {
    blockers.push(
      `${missing.length} station${missing.length > 1 ? "s" : ""} missing roll profile: Stn ${missing.map(v => v.stationNumber).join(", ")}`
    );
  }

  if (basic.length > 0) {
    warnings.push(
      `${basic.length} station${basic.length > 1 ? "s" : ""} have incomplete profile (no geometry/G-code): Stn ${basic.map(v => v.stationNumber).join(", ")}`
    );
  }

  const noProfile = rollTooling.filter(rt => !rt.rollProfile);
  if (noProfile.length > 0 && missing.length === 0) {
    blockers.push(`${noProfile.length} station(s) have no roll profile object`);
  }

  return {
    canExport: blockers.length === 0,
    blockers,
    warnings,
    incompleteCount,
    missingCount,
  };
}
