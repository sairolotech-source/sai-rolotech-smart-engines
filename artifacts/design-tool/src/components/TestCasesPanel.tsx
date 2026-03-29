import { useState } from "react";
import { runTestCases } from "../lib/api";
import { CheckCircle2, XCircle, AlertTriangle, FlaskConical, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

type Verdict = "PASS" | "FAIL";
type StageStatus = "pass" | "fail" | "warn" | "skip";

interface Stage {
  id: string;
  label: string;
  status: StageStatus;
  reason?: string;
  data?: Record<string, unknown>;
}

interface TCResult {
  id: string;
  name: string;
  description: string;
  input: { thickness: number; material: string; bendCount: number; sectionWidth: number; sectionHeight: number };
  expectedStatus: "pass" | "fail";
  expectedFailStage?: string;
  actualStatus: "pass" | "fail";
  stages: Stage[];
  verdict: Verdict;
  verdictReason: string;
  enginesSummary: Record<string, unknown>;
}

interface SuiteResult {
  test_suite: string;
  total: number;
  passed: number;
  failed: number;
  overall: "ALL_PASS" | "ALL_FAIL" | "PARTIAL";
  run_at: string;
  results: TCResult[];
}

const STATUS_ICON: Record<StageStatus, JSX.Element> = {
  pass: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  fail: <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  skip: <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 inline-block" />,
};

function StageRow({ stage }: { stage: Stage }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      {STATUS_ICON[stage.status]}
      <div className="flex-1 min-w-0">
        <span className="text-white/70 text-xs">{stage.label}</span>
        {stage.reason && (
          <span className="ml-1.5 text-xs" style={{ color: stage.status === "fail" ? "#f87171" : "#fbbf24" }}>— {stage.reason}</span>
        )}
        {stage.data && stage.status === "pass" && (
          <span className="ml-1.5 text-white/40 text-xs">
            {Object.entries(stage.data).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" | ")}
          </span>
        )}
      </div>
    </div>
  );
}

function TestCaseCard({ tc }: { tc: TCResult }) {
  const [open, setOpen] = useState(false);
  const isPass = tc.verdict === "PASS";

  const borderColor = isPass ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)";
  const bgColor = isPass ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.07)";

  return (
    <div className="rounded-lg border mb-2.5 overflow-hidden" style={{ borderColor, backgroundColor: bgColor }}>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {isPass
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ background: isPass ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: isPass ? "#6ee7b7" : "#fca5a5" }}>
              {tc.id}
            </span>
            <span className="text-white/90 text-sm font-medium truncate">{tc.name}</span>
            <span className="ml-auto shrink-0 text-xs font-bold" style={{ color: isPass ? "#34d399" : "#f87171" }}>{tc.verdict}</span>
          </div>
          <p className="text-white/40 text-xs mt-0.5 truncate">{tc.verdictReason}</p>
        </div>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-white/50 text-xs mt-2 leading-relaxed">{tc.description}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {[
              ["Material", tc.input.material],
              ["Thickness", `${tc.input.thickness}mm`],
              ["Bends", String(tc.input.bendCount)],
              ["Profile", `${tc.input.sectionWidth}×${tc.input.sectionHeight}mm`],
              ["Expected", tc.expectedStatus.toUpperCase()],
              ["Actual", tc.actualStatus.toUpperCase()],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-1.5 text-xs">
                <span className="text-white/35">{k}:</span>
                <span className="text-white/70">{v}</span>
              </div>
            ))}
          </div>

          {Object.keys(tc.enginesSummary).length > 0 && (
            <div>
              <p className="text-white/35 text-[10px] uppercase tracking-wide mb-1">Engine Output</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {Object.entries(tc.enginesSummary).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 text-xs">
                    <span className="text-white/35">{k}:</span>
                    <span className="text-amber-300/80">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-white/35 text-[10px] uppercase tracking-wide mb-1.5">Stage-by-Stage</p>
            <div className="space-y-0.5">
              {tc.stages.map(s => <StageRow key={s.id} stage={s} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TestCasesPanel() {
  const [suite, setSuite] = useState<SuiteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runTestCases();
      setSuite(result as SuiteResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test run failed");
    } finally {
      setLoading(false);
    }
  };

  const overallColor = suite?.overall === "ALL_PASS" ? "#34d399" : suite?.overall === "ALL_FAIL" ? "#f87171" : "#fbbf24";

  return (
    <div className="space-y-3">
      <button
        onClick={runAll}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all"
        style={{
          background: loading ? "rgba(251,191,36,0.1)" : "rgba(251,191,36,0.12)",
          border: "1px solid rgba(251,191,36,0.3)",
          color: "#fbbf24",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Running 5 test cases…</>
          : <><FlaskConical className="w-4 h-4" /> Run Mandatory Test Suite</>
        }
      </button>

      {error && (
        <div className="rounded-lg p-3 text-sm text-red-300" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
          <XCircle className="w-3.5 h-3.5 inline mr-1.5" />
          {error}
        </div>
      )}

      {suite && (
        <div className="space-y-3">
          <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-xs font-medium uppercase tracking-wide">Test Suite Summary</span>
              <span className="text-xs font-bold" style={{ color: overallColor }}>{suite.overall}</span>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-emerald-400">{suite.passed}</div>
                <div className="text-[10px] text-white/40 uppercase">Passed</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-red-400">{suite.failed}</div>
                <div className="text-[10px] text-white/40 uppercase">Failed</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-white/70">{suite.total}</div>
                <div className="text-[10px] text-white/40 uppercase">Total</div>
              </div>
            </div>
            <p className="text-white/25 text-[10px] mt-2 text-right">
              Run at {new Date(suite.run_at).toLocaleTimeString()}
            </p>
          </div>

          {suite.results.map(tc => <TestCaseCard key={tc.id} tc={tc} />)}
        </div>
      )}
    </div>
  );
}
