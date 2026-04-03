import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface TestCase {
  name: string;
  status: string;
  validation?: string;
  expected_mode?: string | null;
  actual_mode?: string;
  expected_min_confidence?: number;
  actual_confidence?: number;
  stations?: number;
  shaft_mm?: number;
  bearing?: string;
  roll_od_mm?: number;
  line_length_m?: number;
  drive_type?: string;
  complexity?: string;
  selected_mode?: string;
  overall_confidence?: number;
  consistency_status?: string;
  reason?: string;
}

const MODE_COLOR: Record<string, string> = {
  auto_mode:          "#22c55e",
  semi_auto:          "#eab308",
  semi_auto_confirmed:"#60a5fa",
  manual_review:      "#ef4444",
};

const DRIVE_LABEL: Record<string, string> = {
  chain_drive:       "Chain",
  gear_drive:        "Gear",
  tandem_gear_drive: "Tandem",
};

interface TestData {
  status: string;
  total: number;
  passed: number;
  failed: number;
  validation_warnings?: number;
  test_cases: TestCase[];
}

interface Props {
  data: TestData;
}

function ValidationBadge({ v }: { v: string | undefined }) {
  if (v === "pass") return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-700/30 font-semibold">✓ EXPECTED</span>
  );
  if (v === "warning") return (
    <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-700/30 font-semibold">⚠ DIFF</span>
  );
  return null;
}

export function TestResults({ data }: Props) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Test Suite — {data.total} Cases
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{data.passed}/{data.total} passed</span>
          {(data.validation_warnings ?? 0) > 0 && (
            <span className="text-yellow-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{data.validation_warnings} mode diff
            </span>
          )}
          {data.failed > 0 && <span className="text-red-400">{data.failed} failed</span>}
        </div>
      </div>

      <div className="space-y-2">
        {data.test_cases.map((tc, i) => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2 text-xs ${
              tc.status === "pass"
                ? tc.validation === "warning"
                  ? "border-yellow-500/20 bg-yellow-500/5"
                  : "border-emerald-500/15 bg-emerald-500/5"
                : "border-red-500/20 bg-red-500/8"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {tc.status === "pass"
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                <span className="font-medium text-gray-200 text-[11px] truncate">{tc.name}</span>
              </div>
              <ValidationBadge v={tc.validation} />
            </div>

            {tc.status === "pass" ? (
              <div className="space-y-1.5">
                {/* Mode row */}
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-neutral-500">Mode:</span>
                  <span style={{ color: MODE_COLOR[tc.actual_mode ?? ""] ?? "#9ca3af", fontWeight: 600 }}>
                    {(tc.actual_mode ?? "—").replace(/_/g, " ").toUpperCase()}
                  </span>
                  <span className="text-neutral-500">Conf:</span>
                  <span className="text-white font-mono">{tc.actual_confidence ?? tc.overall_confidence}/100</span>
                  {tc.expected_mode && tc.actual_mode !== tc.expected_mode && (
                    <span className="text-yellow-500 text-[9px]">(expected: {tc.expected_mode?.replace(/_/g, " ")})</span>
                  )}
                </div>

                {/* Mechanical row */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                  <span>Stations: <span className="text-gray-300">{tc.stations}</span></span>
                  <span>Shaft: <span className="text-gray-300">{tc.shaft_mm}mm</span></span>
                  <span>Roll OD: <span className="text-gray-300">{tc.roll_od_mm}mm</span></span>
                  <span>Line: <span className="text-gray-300">{tc.line_length_m ?? "—"}m</span></span>
                  <span>Drive: <span className="text-gray-300">{DRIVE_LABEL[tc.drive_type ?? ""] ?? tc.drive_type ?? "—"}</span></span>
                  <span>Consist: <span className={tc.consistency_status === "pass" ? "text-emerald-400" : "text-yellow-400"}>{tc.consistency_status ?? "—"}</span></span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-red-400">{tc.reason ?? "Pipeline failed"}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
