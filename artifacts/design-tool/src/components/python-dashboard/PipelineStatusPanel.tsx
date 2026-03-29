import { CheckCircle2, XCircle, Minus } from "lucide-react";

interface StageItem {
  stage: string;
  status: string;
  reason?: string | null;
}

interface Props {
  stageDebug: StageItem[];
  firstFailedStage?: string | null;
  overallStatus?: string;
}

const LABEL: Record<string, string> = {
  profile_analysis_engine: "Profile Analysis",
  input_engine: "Input Validation",
  advanced_flower_engine: "Flower Pattern",
  station_engine: "Station Estimate",
  roll_logic_engine: "Roll Logic",
  shaft_engine: "Shaft Selection",
  bearing_engine: "Bearing Selection",
  duty_engine: "Duty Classification",
  roll_design_calc_engine: "Roll Design Calc",
  report_engine: "Report Generation",
  pdf_export_engine: "PDF Export",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "pass") return (
    <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
      <CheckCircle2 className="w-3.5 h-3.5" /> PASS
    </span>
  );
  if (status === "fail") return (
    <span className="flex items-center gap-1 text-red-400 text-[10px] font-semibold">
      <XCircle className="w-3.5 h-3.5" /> FAIL
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-gray-600 text-[10px]">
      <Minus className="w-3.5 h-3.5" /> {status}
    </span>
  );
}

export function PipelineStatusPanel({ stageDebug, firstFailedStage, overallStatus }: Props) {
  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pipeline Status</div>
        {overallStatus && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
            overallStatus === "pass"
              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
              : "text-red-400 border-red-500/30 bg-red-500/10"
          }`}>
            {overallStatus.toUpperCase()}
          </span>
        )}
      </div>

      {firstFailedStage && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2 text-red-300 text-xs">
          <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>First failed stage: <span className="font-mono font-semibold">{firstFailedStage}</span></span>
        </div>
      )}

      {stageDebug.length === 0 ? (
        <div className="text-xs text-gray-600 py-2">No pipeline result yet. Run the pipeline above.</div>
      ) : (
        <div className="space-y-1.5">
          {stageDebug.map(s => (
            <div
              key={s.stage}
              className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                s.status === "pass"
                  ? "border-emerald-500/15 bg-emerald-500/5"
                  : s.status === "fail"
                  ? "border-red-500/20 bg-red-500/8"
                  : "border-gray-700/30 bg-gray-800/30"
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-300">{LABEL[s.stage] ?? s.stage}</div>
                <div className="text-[10px] text-gray-600 font-mono">{s.stage}</div>
                {s.reason && <div className="text-[10px] text-red-400 mt-0.5">{s.reason}</div>}
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
