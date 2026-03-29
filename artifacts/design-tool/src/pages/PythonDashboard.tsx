import { useState, useCallback } from "react";
import { Activity, FlaskConical, Download, FileJson, ArrowLeft } from "lucide-react";
import { InputPanel } from "@/components/python-dashboard/InputPanel";
import { PipelineStatusPanel } from "@/components/python-dashboard/PipelineStatusPanel";
import { SummaryCards } from "@/components/python-dashboard/SummaryCards";
import { EngineDetails } from "@/components/python-dashboard/EngineDetails";
import { WarningPanel } from "@/components/python-dashboard/WarningPanel";
import { ReportPreview } from "@/components/python-dashboard/ReportPreview";
import { TestResults } from "@/components/python-dashboard/TestResults";
import FinalDecisionPanel from "@/components/python-dashboard/FinalDecisionPanel";
import {
  runManualModeDebug,
  exportManualPdf,
  downloadManualPdf,
  runTests,
  type ManualModePayload,
} from "@/services/pythonApi";

export default function PythonDashboard() {
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [payload, setPayload] = useState<ManualModePayload | null>(null);
  const [pipelineResult, setPipelineResult] = useState<Record<string, unknown> | null>(null);
  const [debugResult, setDebugResult] = useState<{
    first_failed_stage?: string;
    stage_debug: Array<{ stage: string; status: string; reason?: string | null }>;
  } | null>(null);
  const [testData, setTestData] = useState<Record<string, unknown> | null>(null);
  const [pdfResult, setPdfResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async (form: ManualModePayload) => {
    setLoading(true);
    setPayload(form);
    setPdfResult(null);
    setError(null);
    try {
      const data = await runManualModeDebug(form);
      setPipelineResult(data.pipeline_result ?? null);
      setDebugResult(data.debug_result ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline call failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRunTests = useCallback(async () => {
    setTestLoading(true);
    try {
      const data = await runTests();
      setTestData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test run failed");
    } finally {
      setTestLoading(false);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!payload) return;
    setLoading(true);
    try {
      const data = await exportManualPdf(payload);
      setPdfResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setLoading(false);
    }
  }, [payload]);

  const handleDownloadPdf = useCallback(async () => {
    if (!payload) return;
    setLoading(true);
    try {
      const blob = await downloadManualPdf(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `roll_forming_report_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setLoading(false);
    }
  }, [payload]);

  const reportEngine = (pipelineResult?.report_engine ?? {}) as Record<string, unknown>;
  const summary = (reportEngine?.engineering_summary ?? {}) as Record<string, unknown>;
  const readableReport = (reportEngine?.readable_report as string) ?? "";
  const rollCalc = (pipelineResult?.roll_design_calc_engine ?? {}) as Record<string, unknown>;
  const warnings = (rollCalc?.warnings as string[]) ?? [];
  const assumptions = (rollCalc?.assumptions as string[]) ?? [];
  const finalDecision = (pipelineResult?.final_decision_engine ?? null) as Record<string, unknown> | null;
  const consistency = (pipelineResult?.consistency_engine ?? null) as Record<string, unknown> | null;

  return (
    <div className="min-h-screen bg-[#08090f] text-gray-200 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" />
            <div>
              <div className="text-lg font-bold text-gray-100">Python API Debug Dashboard</div>
              <div className="text-[10px] text-gray-500">Sai Rolotech Smart Engines v2.2.0 — FastAPI on port 9000</div>
            </div>
          </div>
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </a>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {pipelineResult?.status === "fail" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
            <div className="font-semibold text-red-400 mb-1">Pipeline Failed</div>
            <div className="text-red-300 text-xs font-mono">
              Stage: {(pipelineResult as any)?.failed_stage ?? "unknown"} — {(pipelineResult as any)?.result?.reason ?? ""}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <InputPanel onRun={handleRun} loading={loading} />

            <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleRunTests}
                  disabled={testLoading}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs font-medium py-2 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  {testLoading ? "Running Tests…" : "Run 5 Test Cases"}
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={!payload || loading}
                  className="flex items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 text-violet-300 text-xs font-medium py-2 transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Export PDF (JSON result)
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={!payload || loading}
                  className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 text-emerald-300 text-xs font-medium py-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF File
                </button>
              </div>
            </div>

            <PipelineStatusPanel
              stageDebug={debugResult?.stage_debug ?? []}
              firstFailedStage={debugResult?.first_failed_stage}
              overallStatus={pipelineResult?.status as string | undefined}
            />
          </div>

          <div className="lg:col-span-2 space-y-4">
            <FinalDecisionPanel finalDecision={finalDecision as any} consistency={consistency as any} />
            <SummaryCards summary={summary} />
            <WarningPanel warnings={warnings} assumptions={assumptions} />

            {pdfResult && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-2">
                <div className="text-xs font-semibold text-violet-400 uppercase tracking-wider">PDF Export Result</div>
                <pre className="text-[10.5px] text-gray-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(pdfResult, null, 2)}
                </pre>
              </div>
            )}

            {testData && <TestResults data={testData as any} />}
            <ReportPreview reportText={readableReport} />
            {pipelineResult && <EngineDetails result={pipelineResult} />}
          </div>
        </div>
      </div>
    </div>
  );
}
