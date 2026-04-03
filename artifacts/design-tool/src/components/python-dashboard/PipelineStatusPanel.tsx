import { CheckCircle2, XCircle, Minus } from "lucide-react";

interface StageItem {
  stage: string;
  status: string;
  reason?: string | null;
  selected_mode?: string;
  overall_confidence?: number;
  blocking_reasons?: string[];
  consistency_status?: string;
  blocking?: boolean;
  issues_found?: number;
}

interface Props {
  stageDebug: StageItem[];
  firstFailedStage?: string | null;
  overallStatus?: string;
}

const LABEL: Record<string, string> = {
  profile_analysis_engine:  "Profile Analysis",
  input_engine:             "Input Validation",
  flange_web_lip_engine:    "Flange / Web / Lip",
  advanced_flower_engine:   "Flower Pattern",
  station_engine:           "Station Estimate",
  roll_logic_engine:        "Roll Logic",
  shaft_engine:             "Shaft Selection",
  bearing_engine:           "Bearing Selection",
  duty_engine:              "Duty Classification",
  roll_design_calc_engine:  "Roll Design Calc",
  machine_layout_engine:    "Machine Layout",
  consistency_engine:       "Consistency Check",
  final_decision_engine:    "Final Decision",
  report_engine:            "Report Generation",
  pdf_export_engine:        "PDF Export",
};

const MODE_COLOR: Record<string, string> = {
  auto_mode: "text-emerald-400",
  semi_auto: "text-yellow-400",
  manual_review: "text-red-400",
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
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-300">{LABEL[s.stage] ?? s.stage}</div>
                <div className="text-[10px] text-gray-600 font-mono">{s.stage}</div>
                {s.reason && <div className="text-[10px] text-red-400 mt-0.5">{s.reason}</div>}
                {s.stage === "final_decision_engine" && s.selected_mode && (
                  <div className={`text-[10px] font-semibold mt-0.5 ${MODE_COLOR[s.selected_mode] ?? "text-gray-400"}`}>
                    {s.selected_mode.replace("_", " ").toUpperCase()} — {s.overall_confidence}/100
                  </div>
                )}
                {s.stage === "consistency_engine" && s.consistency_status && (
                  <div className={`text-[10px] font-semibold mt-0.5 ${
                    s.consistency_status === "pass" ? "text-emerald-400"
                    : s.consistency_status === "fail" ? "text-red-400"
                    : "text-yellow-400"
                  }`}>
                    {s.consistency_status.replace("_", " ").toUpperCase()} — {s.issues_found ?? 0} issue{s.issues_found !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
