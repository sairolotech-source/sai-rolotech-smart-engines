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
import RollForming3DPanel from "@/components/python-dashboard/RollForming3DPanel";
import CodexEngineerPanel from "@/components/python-dashboard/CodexEngineerPanel";
import ProfileAnnotationPanel from "@/components/python-dashboard/ProfileAnnotationPanel";
import {
  runManualModeDebug,
  exportManualPdf,
  downloadManualPdf,
  runTests,
  type ManualModePayload,
} from "@/services/pythonApi";
import { buildStationRollProfile } from "@/lib/toolingEngine";
import type { RollGapInfo } from "@/store/useCncStore";

// ─── Remaining Weaknesses collapsible card ────────────────────────────────────
function RemainingWeaknessesCard({ weaknesses }: { weaknesses: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-500/8 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Known Limitations</span>
          <span className="text-[10px] font-mono text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
            {weaknesses.length}
          </span>
        </div>
        <span className="text-amber-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {weaknesses.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-amber-200/80">
              <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
              <span className="leading-snug">{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PythonDashboard() {
  const setNumStations       = useCncStore(s => s.setNumStations);
  const setMaterialType      = useCncStore(s => s.setMaterialType);
  const setMaterialThickness = useCncStore(s => s.setMaterialThickness);
  const setRollTooling       = useCncStore(s => s.setRollTooling);
  const setRollGaps               = useCncStore(s => s.setRollGaps);
  const setPythonPipelineSyncedAt = useCncStore(s => s.setPythonPipelineSyncedAt);
  const setProfileCategory        = useCncStore(s => s.setProfileCategory);
  const setRemainingWeaknesses    = useCncStore(s => s.setRemainingWeaknesses);
  const remainingWeaknesses       = useCncStore(s => s.remainingWeaknesses);
  const profileCategory           = useCncStore(s => s.profileCategory);

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
  const [svgTab, setSvgTab] = useState<'flower' | 'roll_groove'>('flower');
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
    const stEng   = pipelineResult.station_engine      as Record<string, unknown> | undefined;
    const inEng   = pipelineResult.input_engine        as Record<string, unknown> | undefined;
    const rollCt  = pipelineResult.roll_contour_engine as Record<string, unknown> | undefined;
    const intfEng = pipelineResult.roll_contour_interference as Record<string, unknown> | undefined;

    // ── Basic field sync ─────────────────────────────────────────────────────
    const rec   = stEng?.recommended_station_count;
    const mat   = inEng?.material as string | undefined;
    const thick = (inEng?.sheet_thickness_mm as number | undefined) ?? 1.5;
    if (typeof rec === "number" && rec > 0) setNumStations(rec);
    if (mat)   setMaterialType(mat as Parameters<typeof setMaterialType>[0]);
    if (thick) setMaterialThickness(thick);

    // ── Assemble all passes (forming + calibration) ──────────────────────────
    const allPasses = [
      ...((rollCt?.passes as unknown[]) ?? []),
      rollCt?.calibration_pass,
    ].filter(Boolean) as Record<string, unknown>[];
    if (allPasses.length === 0) return;

    // ── Per-station interference lookup (shapely-grade results) ──────────────
    const intfStations = ((intfEng?.stations as unknown[]) ?? []) as Record<string, unknown>[];

    // ── Build RollToolingResult[] with real rollProfile geometry ─────────────
    // P0: Python pipeline → single source of truth for LeftPanel, RollToolingView,
    //     DigitalTwinView. Each pass gets a proper rollProfile built from the
    //     Python-computed dimensions via buildStationRollProfile().
    const mapped = allPasses.map((p, i) => {
      const rollWidth     = (p.roll_width_mm      as number) ?? 76;
      const grooveDepth   = (p.groove_depth_mm    as number) ?? 0;
      const bendAngleDeg  = (p.target_angle_deg   as number) ?? 0;
      const upperRollOD   = ((p.upper_roll_radius_mm as number) ?? 60) * 2;
      const lowerRollOD   = ((p.lower_roll_radius_mm as number) ?? 40) * 2;
      const nominalGap    = (p.roll_gap_mm         as number) ?? 1.6;
      const kFactor       = (p.k_factor            as number) ?? 0.44;

      // Build real Segment[] geometry from Python dimensions
      const { upperRoll, lowerRoll } = buildStationRollProfile({
        rollWidth,
        grooveDepth,
        bendAngleDeg,
        thickness: thick,
        upperRollOD,
        lowerRollOD,
      });

      // Compute pass-line Y and roll center Y from Python shaft-centre data
      const upperCenterY  = (p.shaft_center_upper_mm as number) ?? (upperRollOD / 2 + nominalGap / 2);
      const lowerCenterY  = -((p.shaft_center_lower_mm as number) ?? (lowerRollOD / 2 + nominalGap / 2));
      const isCalibration = (p.stage_type as string) === "calibration";

      // Read pass.tooling sub-dict (production-profile v2.2+)
      const toolingRaw = p.tooling as Record<string, unknown> | undefined;
      const tooling = toolingRaw ? {
        top_roll_contour:    toolingRaw.top_roll_contour    as Array<{ x: number; y: number }> | undefined,
        bottom_roll_contour: toolingRaw.bottom_roll_contour as Array<{ x: number; y: number }> | undefined,
        face_width_mm:       toolingRaw.face_width_mm       as number | undefined,
        groove_width_mm:     toolingRaw.groove_width_mm     as number | undefined,
        groove_depth_mm:     toolingRaw.groove_depth_mm     as number | undefined,
        relief_width_mm:     toolingRaw.relief_width_mm     as number | undefined,
        relief_depth_mm:     toolingRaw.relief_depth_mm     as number | undefined,
        shoulder_left_mm:    toolingRaw.shoulder_left_mm    as number | undefined,
        shoulder_right_mm:   toolingRaw.shoulder_right_mm   as number | undefined,
        clash_risk_markers:  toolingRaw.clash_risk_markers  as Array<{ x: number; y: number; severity: string; label?: string }> | undefined,
        geometry_grade:      toolingRaw.geometry_grade      as string | undefined,
      } : undefined;

      return {
        stationId:              `python-s${(p.pass_no as number) ?? i + 1}`,
        stationIndex:           i,
        stationNumber:          (p.pass_no    as number) ?? i + 1,
        label:                  (p.station_label as string) ?? `Station ${i + 1}`,
        upperRollOD,
        upperRollID:            40,
        upperRollWidth:         rollWidth,
        lowerRollOD,
        lowerRollID:            40,
        lowerRollWidth:         rollWidth,
        rollGap:                nominalGap,
        passLineHeight:         0,
        kFactor,
        neutralAxis:            kFactor,
        deflection:             0,
        concentricityTolerance: 0.05,
        description:            (p.stage_type as string) ?? "forming",
        profileDepthMm:         grooveDepth,
        bendAngles:             [bendAngleDeg],
        material:               mat,
        tooling,
        rollProfile: {
          upperRoll,
          lowerRoll,
          rollDiameter:      upperRollOD,
          shaftDiameter:     40,
          rollWidth,
          gap:               nominalGap,
          passLineY:         0,
          upperRollCenterY:  upperCenterY,
          lowerRollCenterY:  lowerCenterY,
          grooveDepth,
          upperRollNumber:   (p.pass_no as number) ?? i + 1,
          lowerRollNumber:   (p.pass_no as number) ?? i + 1,
          kFactor,
          neutralAxisOffset: kFactor,
          upperLatheGcode:   "",
          lowerLatheGcode:   "",
        },
      };
    });
    setRollTooling(mapped);

    // ── Map interference results → RollGapInfo[] (drives DigitalTwinView) ───
    // springbackGap uses the shapely-computed gap_mm when available, otherwise
    // estimates springback effect as nominal × (1 − springback_ratio).
    const summarySpringbackDeg = (rollCt?.forming_summary as Record<string, unknown> | undefined)
      ?.springback_effective_deg as number | undefined ?? 2.0;
    const springbackRatio = Math.sin(summarySpringbackDeg * Math.PI / 180);

    const rollGaps: RollGapInfo[] = allPasses.map((p, i) => {
      const passNo     = (p.pass_no as number) ?? i + 1;
      const nominalGap = (p.roll_gap_mm as number) ?? 1.6;
      const grooveDep  = (p.groove_depth_mm as number) ?? 1;

      // Try to find a shapely interference result for this pass
      const intfSt    = intfStations.find(s => (s.pass_no as number) === passNo);
      const intfGapMm = (intfSt as Record<string, unknown> | undefined)
        ?.interference as Record<string, unknown> | undefined;
      const shapely_gap = intfGapMm?.gap_mm as number | undefined;

      // springbackGap: how much gap remains after springback-induced roll closure
      const springbackGap = typeof shapely_gap === "number"
        ? shapely_gap
        : Math.max(0, nominalGap - springbackRatio * grooveDep * 0.05);

      const passToolingRaw = p.tooling as Record<string, unknown> | undefined;
      const clashRiskMarkers = passToolingRaw?.clash_risk_markers as
        Array<{ x: number; y: number; severity: string; label?: string }> | undefined;

      return {
        stationNumber:  passNo,
        label:          (p.station_label as string) ?? `Station ${passNo}`,
        nominalGap,
        springbackGap:  Math.round(springbackGap * 10000) / 10000,
        upperRollZ:     0,
        lowerRollZ:     0,
        bendAllowances: [(p.target_angle_deg as number) ?? 0],
        clashRiskMarkers,
      };
    });
    setRollGaps(rollGaps);

    // ── Profile category + remaining weaknesses from forming_summary ─────────
    const formingSummary = rollCt?.forming_summary as Record<string, unknown> | undefined;
    setProfileCategory((formingSummary?.profile_category as string | undefined) ?? null);
    setRemainingWeaknesses((formingSummary?.remaining_weaknesses as string[] | undefined) ?? []);

    setPythonPipelineSyncedAt(new Date().toISOString());

  }, [pipelineResult, setNumStations, setMaterialType, setMaterialThickness, setRollTooling, setRollGaps, setPythonPipelineSyncedAt, setProfileCategory, setRemainingWeaknesses]);

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
  const rollDimension         = (pipelineResult?.roll_dimension_engine ?? null) as Record<string, unknown> | null;
  const camPrep               = (pipelineResult?.cam_prep_engine ?? null) as Record<string, unknown> | null;
  const flowerSvgEngine       = (pipelineResult?.flower_svg_engine ?? null) as Record<string, unknown> | null;
  const rollContourInterf     = (pipelineResult?.roll_contour_interference ?? null) as Record<string, unknown> | null;
  const cadExportData         = (cadExportResult?.cad_export ?? null) as Record<string, unknown> | null;
  const cadCamPrep      = (cadExportResult?.cam_prep ?? camPrep) as Record<string, unknown> | null;

  const profEng   = (pipelineResult?.profile_analysis_engine ?? (pipelineResult ? {} : null)) as Record<string, unknown> | null;
  const inputEng  = (pipelineResult?.input_engine ?? (pipelineResult ? {} : null)) as Record<string, unknown> | null;
  const stEng     = (pipelineResult?.station_engine ?? (pipelineResult ? {} : null)) as Record<string, unknown> | null;
  const shEng     = (pipelineResult?.shaft_engine ?? {}) as Record<string, unknown>;
  const brEng     = (pipelineResult?.bearing_engine ?? {}) as Record<string, unknown>;

  const selectedMode = (finalDecision?.selected_mode as string) ?? "auto_mode";
  const showSemiAutoPanel = pipelineResult && (selectedMode === "semi_auto" || selectedMode === "manual_review");

  // ── T004: Honest grade report — what's real vs idealized ─────────────────
  const gradeReport = pipelineResult ? (() => {
    const rc   = (pipelineResult.roll_contour_engine ?? {}) as Record<string, unknown>;
    const fs   = (rc.forming_summary ?? {}) as Record<string, unknown>;
    const geoSrc = ((rc.passes as Record<string, unknown>[] | undefined)?.[0]?.geometry_source as string) ?? "heuristic_fallback";
    const kFactor = (fs.k_factor as number) ?? 0.5;
    const kSrc   = (fs.k_factor_source as string) ?? "fixed_K=0.5";
    const sbMult = (fs.springback_material_mult as number) ?? 1.0;
    const shapelySources = (pipelineResult.shapely_sources as string[]) ?? [];

    const items: { label: string; grade: "A" | "B" | "C" | "D"; note: string }[] = [
      {
        label: "Groove geometry",
        grade: geoSrc === "shapely_section_polygon" ? "A" : "C",
        note: geoSrc === "shapely_section_polygon"
          ? "Real Shapely polygon — pinch zones, contact strips, entry/exit radii computed"
          : "Heuristic fallback — Shapely not available or polygon failed",
      },
      {
        label: "K-factor / neutral axis",
        grade: kFactor !== 0.5 ? "A" : "C",
        note: kFactor !== 0.5
          ? `Per-station K=${kFactor.toFixed(4)} from ${kSrc}`
          : "Fixed K=0.5 (R/t table not applied — check bend_radius_mm input)",
      },
      {
        label: "Springback compensation",
        grade: sbMult !== 1.0 ? "A" : "B",
        note: sbMult !== 1.0
          ? `Material multiplier ×${sbMult} applied — groove over-formed correctly`
          : "Base springback applied; material-specific multiplier = 1.0 (GI/PPGI/default)",
      },
      {
        label: "Interference check",
        grade: shapelySources.length > 0 ? "A" : "B",
        note: shapelySources.length > 0
          ? "Shapely envelope intersection — exact clash/warning detection"
          : "Heuristic gap estimate — install Shapely for exact interference",
      },
      {
        label: "Flat strip width",
        grade: kFactor !== 0.5 ? "A" : "B",
        note: kFactor !== 0.5
          ? `BA = (π/180)×θ×(R + K×t) — Machinery's Handbook neutral-axis formula`
          : "BA = (π/180)×θ×(R + 0.5t) — mid-plane approximation",
      },
      {
        label: "Roll profile geometry",
        grade: "B",
        note: "Groove cross-section from synthesizeGroove() — CNC lathe G-code ready; shaft/bearing dims from Python",
      },
    ];

    const gradeScore: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
    const avg = items.reduce((s, it) => s + gradeScore[it.grade], 0) / items.length;
    const overallGrade = avg >= 3.8 ? "A" : avg >= 3.0 ? "B" : avg >= 2.0 ? "C" : "D";
    const scoreLabel = `${(avg * 2.5).toFixed(1)}/10`;  // rescale 1–4 → 1–10

    return { items, overallGrade, scoreLabel };
  })() : null;

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

            {/* ── 3D Roll Forming Simulation ────────────────────────────── */}
            <RollForming3DPanel
              rollContour={rollContour as any}
              webMm={(payload?.section_height_mm as number) ?? (detectedValues.section_height_mm as number) ?? 60}
              flangeMm={(payload?.section_width_mm as number) ?? (detectedValues.section_width_mm as number) ?? 40}
              thicknessMm={(payload?.thickness as number) ?? 1.5}
              material={(payload?.material as string) ?? "GI"}
            />

            {/* ── 2D Profile Annotation Panel ───────────────────────────── */}
            <ProfileAnnotationPanel
              rollContour={rollContour as any}
              webMm={(payload?.section_height_mm as number) ?? (detectedValues.section_height_mm as number) ?? 60}
              flangeMm={(payload?.section_width_mm as number) ?? (detectedValues.section_width_mm as number) ?? 40}
              thicknessMm={(payload?.thickness as number) ?? 1.5}
              profileCategory={profileCategory}
            />

            {/* ── Codex Engineer AI ─────────────────────────────────────── */}
            <CodexEngineerPanel
              pipelineResult={pipelineResult ?? undefined}
              payload={payload as unknown as Record<string, unknown> | undefined}
            />

            {/* ── T004: Honest Grade Report ─────────────────────────────── */}
            {gradeReport && (
              <div className="rounded-xl border border-gray-700/40 bg-[#0d1117] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-100 tracking-wide uppercase">Engineering Grade Report</span>
                    <span className="text-[10px] text-gray-500">— Tooling Codex Score v2.7</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">Overall:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                      gradeReport.overallGrade === "A" ? "bg-emerald-700/50 text-emerald-300" :
                      gradeReport.overallGrade === "B" ? "bg-blue-700/50 text-blue-300" :
                      gradeReport.overallGrade === "C" ? "bg-amber-700/50 text-amber-300" :
                      "bg-red-700/50 text-red-300"
                    }`}>{gradeReport.overallGrade}</span>
                    <span className="text-xs font-mono text-gray-400">{gradeReport.scoreLabel}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {gradeReport.items.map((item) => (
                    <div key={item.label} className="flex items-start gap-3 py-1.5 px-2 rounded bg-gray-800/30 border border-gray-700/20">
                      <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                        item.grade === "A" ? "bg-emerald-700/60 text-emerald-300" :
                        item.grade === "B" ? "bg-blue-700/60 text-blue-300" :
                        item.grade === "C" ? "bg-amber-700/60 text-amber-300" :
                        "bg-red-700/60 text-red-300"
                      }`}>{item.grade}</span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-gray-200">{item.label}</div>
                        <div className="text-[10px] text-gray-500 leading-snug mt-0.5">{item.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-gray-600 border-t border-gray-700/30 pt-2">
                  Grade A = manufacturing-grade (Shapely + Machinery's Handbook) · B = validated approximation · C = heuristic fallback · D = placeholder
                </div>
              </div>
            )}

            {/* ── Remaining Weaknesses Card ─────────────────────────────── */}
            {remainingWeaknesses.length > 0 && (
              <RemainingWeaknessesCard weaknesses={remainingWeaknesses} />
            )}

            {/* ── SVG Engineering Tabs ──────────────────────────────────── */}
            <div className="rounded-xl border border-gray-700/40 bg-[#0d1117] overflow-hidden">
              <div className="flex border-b border-gray-700/50">
                {([['flower', 'Flower Pattern'], ['roll_groove', 'Roll Groove']] as const).map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setSvgTab(tab)}
                    className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      svgTab === tab
                        ? 'border-violet-400 text-violet-300 bg-violet-500/5'
                        : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="p-3">
                {svgTab === 'flower' && <FlowerSvgPanel payload={payload} pipelineData={flowerSvgEngine as any} />}
                {svgTab === 'roll_groove' && <RollGrooveSvgPanel payload={payload} />}
              </div>
            </div>
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
              shapelyInterference={rollContourInterf as any}
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
