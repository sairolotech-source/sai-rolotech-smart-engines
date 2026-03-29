import { useState, useCallback, useEffect } from "react";
import { useCncStore } from "@/store/useCncStore";
import { Activity, FlaskConical, Download, FileJson, ArrowLeft, Package } from "lucide-react";
import { InputPanel } from "@/components/python-dashboard/InputPanel";
import { PipelineStatusPanel } from "@/components/python-dashboard/PipelineStatusPanel";
import { SummaryCards } from "@/components/python-dashboard/SummaryCards";
import { EngineDetails } from "@/components/python-dashboard/EngineDetails";
import { WarningPanel } from "@/components/python-dashboard/WarningPanel";
import { ReportPreview } from "@/components/python-dashboard/ReportPreview";
import { TestResults } from "@/components/python-dashboard/TestResults";
import FinalDecisionPanel from "@/components/python-dashboard/FinalDecisionPanel";
import SemiAutoPanel from "@/components/python-dashboard/SemiAutoPanel";
import DxfUploadPanel from "@/components/python-dashboard/DxfUploadPanel";
import CenterlineConversionPreview from "@/components/python-dashboard/CenterlineConversionPreview";
import MachineLayoutPanel from "@/components/python-dashboard/MachineLayoutPanel";
import RollContourPanel from "@/components/python-dashboard/RollContourPanel";
import FlowerSvgPanel from "@/components/python-dashboard/FlowerSvgPanel";
import RollGrooveSvgPanel from "@/components/python-dashboard/RollGrooveSvgPanel";
import CadExportPanel from "@/components/python-dashboard/CadExportPanel";
import RollFormingSimulator from "@/components/python-dashboard/RollFormingSimulator";
import RollDrawingPanel from "@/components/python-dashboard/RollDrawingPanel";
import {
  runManualModeDebug,
  exportManualPdf,
  downloadManualPdf,
  runTests,
  type ManualModePayload,
} from "@/services/pythonApi";

export default function PythonDashboard() {
  const setNumStations     = useCncStore(s => s.setNumStations);
  const setMaterialType    = useCncStore(s => s.setMaterialType);
  const setMaterialThickness = useCncStore(s => s.setMaterialThickness);

  const [loading, setLoading] = useState(false);
  const [semiAutoLoading, setSemiAutoLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [cadLoading, setCadLoading] = useState(false);
  const [cadExportResult, setCadExportResult] = useState<Record<string, unknown> | null>(null);
  const [centerlinePreviewData, setCenterlinePreviewData] = useState<Record<string, unknown> | null>(null);
  const [centerlinePreviewLoading, setCenterlinePreviewLoading] = useState(false);
  const [simulationData, setSimulationData] = useState<Record<string, unknown> | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [payload, setPayload] = useState<ManualModePayload | null>(null);
  const [pipelineResult, setPipelineResult] = useState<Record<string, unknown> | null>(null);
  const [debugResult, setDebugResult] = useState<{
    first_failed_stage?: string;
    stage_debug: Array<{ stage: string; status: string; reason?: string | null; selected_mode?: string; overall_confidence?: number; consistency_status?: string; blocking?: boolean; issues_found?: number }>;
  } | null>(null);
  const [testData, setTestData] = useState<Record<string, unknown> | null>(null);
  const [pdfResult, setPdfResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedNote, setConfirmedNote] = useState<string | null>(null);

  useEffect(() => {
    if (!pipelineResult) return;
    const stEng  = pipelineResult.station_engine as Record<string, unknown> | undefined;
    const inEng  = pipelineResult.input_engine   as Record<string, unknown> | undefined;
    const rec    = stEng?.recommended_station_count;
    const mat    = inEng?.material as string | undefined;
    const thick  = inEng?.sheet_thickness_mm as number | undefined;
    if (typeof rec === "number" && rec > 0) setNumStations(rec);
    if (mat)   setMaterialType(mat as Parameters<typeof setMaterialType>[0]);
    if (thick) setMaterialThickness(thick);
  }, [pipelineResult, setNumStations, setMaterialType, setMaterialThickness]);

  const runDebug = useCallback(async (form: ManualModePayload, isSemiConfirm = false) => {
    if (isSemiConfirm) setSemiAutoLoading(true);
    else setLoading(true);
    setPdfResult(null);
    setError(null);
    setConfirmedNote(null);
    try {
      const data = await runManualModeDebug(form);
      setPipelineResult(data.pipeline_result ?? null);
      setDebugResult(data.debug_result ?? null);
      if (isSemiConfirm) setConfirmedNote("Pipeline re-run with confirmed values.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pipeline call failed");
    } finally {
      if (isSemiConfirm) setSemiAutoLoading(false);
      else setLoading(false);
    }
  }, []);

  const handleRun = useCallback((form: ManualModePayload) => {
    setPayload(form);
    runDebug(form, false);
  }, [runDebug]);

  const handleDxfPipelineResult = useCallback((result: Record<string, unknown>) => {
    setPipelineResult(result);
    setPdfResult(null);
    setError(null);
    setConfirmedNote(null);
    // Build a synthetic stage_debug list from the pipeline result for PipelineStatusPanel
    const ENGINE_ORDER = [
      "profile_analysis_engine", "input_engine", "flange_web_lip_engine",
      "advanced_flower_engine", "station_engine", "roll_logic_engine",
      "shaft_engine", "bearing_engine", "duty_engine", "roll_design_calc_engine",
      "machine_layout_engine", "consistency_engine", "final_decision_engine", "report_engine",
    ];
    const stages = ENGINE_ORDER.map((k) => {
      const eng = (result[k] ?? {}) as Record<string, unknown>;
      return {
        stage: k,
        status: (eng.status as string) ?? "not_run",
        reason: eng.reason as string | undefined,
        selected_mode: eng.selected_mode as string | undefined,
        overall_confidence: eng.overall_confidence as number | undefined,
        consistency_status: eng.consistency_status as string | undefined,
        blocking: eng.blocking as boolean | undefined,
        issues_found: eng.issues_found as number | undefined,
      };
    });
    setDebugResult({ stage_debug: stages, first_failed_stage: result.failed_stage as string | undefined });
  }, []);

  const handleSemiAutoConfirm = useCallback((vals: {
    bend_count: number;
    section_width_mm: number;
    section_height_mm: number;
    profile_type: string;
    thickness: number;
    material: string;
    return_bends: number;
    lips_present: boolean;
    flanges_present: boolean;
    station_count: number;
    shaft_mm: number;
    bearing: string;
  }) => {
    const confirmed: ManualModePayload = {
      bend_count: vals.bend_count,
      section_width_mm: vals.section_width_mm,
      section_height_mm: vals.section_height_mm,
      thickness: vals.thickness,
      material: vals.material,
      profile_type: vals.profile_type,
    };
    setPayload(confirmed);
    runDebug(confirmed, true);
  }, [runDebug]);

  const handleRunSimulation = useCallback(async (file: File, thickness: number, material: string) => {
    setSimulationLoading(true);
    setSimulationData(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("thickness", String(thickness));
      form.append("material", material);
      form.append("bend_radius", String(Math.max(thickness * 1.5, 2.0)));
      form.append("strip_speed", "15");
      const resp = await fetch("/papi/api/simulate", { method: "POST", body: form });
      const data = await resp.json();
      setSimulationData(data);
    } catch (e) {
      setSimulationData({ status: "fail", reason: e instanceof Error ? e.message : "Simulation failed" });
    } finally {
      setSimulationLoading(false);
    }
  }, []);

  const handleCenterlinePreview = useCallback(async (file: File, thickness: number) => {
    setCenterlinePreviewLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("thickness", String(thickness));
      const resp = await fetch("/papi/api/preview-centerline-conversion", {
        method: "POST",
        body: form,
      });
      const data = await resp.json();
      setCenterlinePreviewData(data);
    } catch (e) {
      setCenterlinePreviewData({ status: "fail", reason: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setCenterlinePreviewLoading(false);
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

  const handleCadExport = useCallback(async () => {
    if (!payload) return;
    setCadLoading(true);
    setError(null);
    try {
      const resp = await fetch("/papi/api/cad-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      setCadExportResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CAD export failed");
    } finally {
      setCadLoading(false);
    }
  }, [payload]);

  const reportEngine    = (pipelineResult?.report_engine ?? {}) as Record<string, unknown>;
  const summary         = (reportEngine?.engineering_summary ?? {}) as Record<string, unknown>;
  const readableReport  = (reportEngine?.readable_report as string) ?? "";
  const rollCalc        = (pipelineResult?.roll_design_calc_engine ?? {}) as Record<string, unknown>;
  const warnings        = (rollCalc?.warnings as string[]) ?? [];
  const assumptions     = (rollCalc?.assumptions as string[]) ?? [];
  const finalDecision   = (pipelineResult?.final_decision_engine ?? null) as Record<string, unknown> | null;
  const consistency     = (pipelineResult?.consistency_engine ?? null) as Record<string, unknown> | null;
  const machineLayout   = (pipelineResult?.machine_layout_engine ?? null) as Record<string, unknown> | null;
  const rollContour     = (pipelineResult?.roll_contour_engine ?? simulationData?.roll_contour_engine ?? null) as Record<string, unknown> | null;
  const rollDimension   = (pipelineResult?.roll_dimension_engine ?? null) as Record<string, unknown> | null;
  const camPrep         = (pipelineResult?.cam_prep_engine ?? null) as Record<string, unknown> | null;
  const cadExportData   = (cadExportResult?.cad_export ?? null) as Record<string, unknown> | null;
  const cadCamPrep      = (cadExportResult?.cam_prep ?? camPrep) as Record<string, unknown> | null;

  const profEng   = (pipelineResult?.profile_analysis_engine ?? (pipelineResult ? {} : null)) as Record<string, unknown> | null;
  const inputEng  = (pipelineResult?.input_engine ?? (pipelineResult ? {} : null)) as Record<string, unknown> | null;
  const stEng     = (pipelineResult?.station_engine ?? (pipelineResult ? {} : null)) as Record<string, unknown> | null;
  const shEng     = (pipelineResult?.shaft_engine ?? {}) as Record<string, unknown>;
  const brEng     = (pipelineResult?.bearing_engine ?? {}) as Record<string, unknown>;

  const selectedMode = (finalDecision?.selected_mode as string) ?? "auto_mode";
  const showSemiAutoPanel = pipelineResult && (selectedMode === "semi_auto" || selectedMode === "manual_review");

  const detectedValues = {
    bend_count: profEng?.bend_count as number | undefined,
    section_width_mm: profEng?.section_width_mm as number | undefined,
    section_height_mm: profEng?.section_height_mm as number | undefined,
    profile_type: (profEng?.profile_type as string) ?? payload?.profile_type,
    thickness: inputEng?.sheet_thickness_mm as number | undefined,
    material: inputEng?.material as string | undefined,
    return_bends: profEng?.return_bends_count as number | undefined,
    lips_present: (profEng?.profile_type as string) === "lipped_channel",
    flanges_present: true,
    station_count: stEng?.recommended_station_count as number | undefined,
    shaft_mm: shEng.suggested_shaft_diameter_mm as number | undefined,
    bearing: brEng.suggested_bearing_type as string | undefined,
  };

  return (
    <div className="min-h-screen bg-[#08090f] text-gray-200 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" />
            <div>
              <div className="text-lg font-bold text-gray-100">Sai Rolotech Smart Engines</div>
              <div className="text-[10px] text-gray-500">v2.3.0 — 29 Engines — Roll Forming Automation Suite</div>
            </div>
          </div>
          <a href="/" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </a>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-red-300 text-sm">{error}</div>
        )}

        {confirmedNote && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-emerald-300 text-sm">
            ✓ {confirmedNote}
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

          {/* LEFT COLUMN */}
          <div className="lg:col-span-1 space-y-4">
            <InputPanel onRun={handleRun} loading={loading} />
            <DxfUploadPanel
              onPipelineResult={handleDxfPipelineResult}
              onCenterlinePreview={handleCenterlinePreview}
              onSimulationReady={handleRunSimulation}
            />

            <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={handleRunTests}
                  disabled={testLoading}
                  className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs font-medium py-2 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  {testLoading ? "Running Tests…" : "Run 8 Test Cases"}
                </button>
                <button
                  onClick={handleExportPdf}
                  disabled={!payload || loading || selectedMode === "semi_auto" || selectedMode === "manual_review"}
                  className="flex items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-40 text-violet-300 text-xs font-medium py-2 transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Export PDF (JSON result)
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={!payload || loading || selectedMode === "semi_auto" || selectedMode === "manual_review"}
                  className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:opacity-40 text-emerald-300 text-xs font-medium py-2 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF File
                </button>
                <button
                  onClick={handleCadExport}
                  disabled={!payload || cadLoading}
                  className="flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 text-cyan-300 text-xs font-medium py-2 transition-colors"
                >
                  <Package className="w-3.5 h-3.5" />
                  {cadLoading ? "Generating CAD Pack…" : "Generate CAD/STEP Pack"}
                </button>
                {(selectedMode === "semi_auto" || selectedMode === "manual_review") && (
                  <div className="text-[10px] text-yellow-500/80 text-center px-2">
                    PDF locked until confirmation is complete
                  </div>
                )}
              </div>
            </div>

            <PipelineStatusPanel
              stageDebug={debugResult?.stage_debug ?? []}
              firstFailedStage={debugResult?.first_failed_stage}
              overallStatus={pipelineResult?.status as string | undefined}
            />
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-2 space-y-4">
            {(centerlinePreviewData || centerlinePreviewLoading) && (
              <CenterlineConversionPreview data={centerlinePreviewLoading ? null : centerlinePreviewData as any} />
            )}
            <FinalDecisionPanel finalDecision={finalDecision as any} consistency={consistency as any} />

            {showSemiAutoPanel && (
              <SemiAutoPanel
                selectedMode={selectedMode}
                overallConfidence={(finalDecision?.overall_confidence as number) ?? 0}
                blockingReasons={(finalDecision?.blocking_reasons as string[]) ?? []}
                recommendedAction={(finalDecision?.recommended_next_action as string) ?? ""}
                detectedValues={detectedValues}
                onConfirm={handleSemiAutoConfirm}
                loading={semiAutoLoading}
              />
            )}

            <SummaryCards summary={summary} />
            {machineLayout && <MachineLayoutPanel data={machineLayout as any} />}
            <RollContourPanel data={rollContour as any} />
            <FlowerSvgPanel
              profileResult={profEng as Record<string, unknown> | null}
              inputResult={inputEng as Record<string, unknown> | null}
              rollContourResult={rollContour as Record<string, unknown> | null}
              stationResult={stEng as Record<string, unknown> | null}
            />
            <RollGrooveSvgPanel
              profileResult={profEng as Record<string, unknown> | null}
              inputResult={inputEng as Record<string, unknown> | null}
              rollContourResult={rollContour as Record<string, unknown> | null}
            />
            <RollDrawingPanel
              rollContour={rollContour as any}
              rollDimensions={rollDimension as any}
              profileType={
                (detectedValues.profile_type as string)
                ?? payload?.profile_type
                ?? ""
              }
              springbackDeg={
                (rollContour?.springback_deg as number) ?? 0
              }
              interferenceResult={
                (pipelineResult?.roll_interference_engine ?? null) as any
              }
            />
            <RollFormingSimulator
              data={(simulationData?.simulation_engine ?? null) as any}
              optimizerData={(simulationData?.ai_optimizer_engine ?? null) as any}
              decisionData={(simulationData?.simulation_decision_engine ?? null) as any}
              loading={simulationLoading}
            />
            <CadExportPanel
              cadExport={cadExportData as any}
              camPrep={cadCamPrep as any}
              isLoading={cadLoading}
              onRequestExport={payload ? handleCadExport : undefined}
            />
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
