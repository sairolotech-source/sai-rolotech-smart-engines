import React, { useCallback, useEffect, useState } from "react";
import {
  useCncStore,
  type LatheToolConfig,
  type MaterialType,
  type OpenSectionType,
  MATERIAL_DATABASE,
  OPEN_SECTION_OPTIONS,
  getKeywaySizeForShaft,
  autoDetectProfileType,
} from "../../store/useCncStore";
import { uploadDxf, generateFlower, generateGcode, generateRollTooling, calcStripWidth } from "../../lib/api";
import { PipelineDebugPanel } from "../PipelineDebugPanel";
import TestCasesPanel from "../TestCasesPanel";
import { toast } from "../../hooks/use-toast";
import { StripWidthCalculator } from "./StripWidthCalculator";
import { MachineSizingCalculator } from "./MachineSizingCalculator";
import { GearboxCalculator } from "./GearboxCalculator";
import { Upload, Settings, Play, RefreshCw, Plus, Trash2, Wrench, ChevronDown, ChevronRight, AlertTriangle, X, PenLine, Zap, ZapOff, Loader2, CheckCircle2, XCircle, Layers, ArrowUp, ArrowDown, ChevronsUpDown, RotateCcw, FlaskConical } from "lucide-react";
import { useAccuracyScoring } from "../../hooks/useAccuracyScoring";
import { POST_PROCESSORS, type PostProcessorPreset } from "../../lib/post-processors";
import { useAutoAIMode } from "../../hooks/useAutoAIMode";
import { validateRollFormingInputs } from "../../lib/inputValidation";
import { EngineLogger } from "../../lib/engineLogger";
import { CenterLineConversionModal } from "./CenterLineConversionModal";
import { detectProfileSourceType } from "../../lib/centerLineConverter";

function SectionHeader({
  title,
  icon,
  expanded,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between group"
    >
      <span className="rt-section-header-label">
        <span style={{ color: "#3f3f46" }}>
          {icon}
        </span>
        {title}
      </span>
      <span className="w-4 h-4 rounded flex items-center justify-center transition-colors"
        style={{ color: expanded ? "#71717a" : "#3f3f46" }}>
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </span>
    </button>
  );
}

function ToolConfig({
  tool,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  tool: LatheToolConfig;
  index: number;
  onUpdate: (index: number, t: Partial<LatheToolConfig>) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-lg p-2.5 space-y-2 bg-white/[0.025] border border-white/[0.07]">
      <div className="flex items-center justify-between">
        <span className="text-xs text-blue-300 font-bold font-mono">
          T{tool.toolNumber.toString().padStart(2, "0")}{tool.offsetNumber.toString().padStart(2, "0")}
        </span>
        {canRemove && (
          <button onClick={() => onRemove(index)} className="text-zinc-600 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-[10px] text-zinc-500 block">Tool #</label>
          <input
            type="number" min={1} max={99} value={tool.toolNumber}
            onChange={(e) => onUpdate(index, { toolNumber: parseInt(e.target.value) || 1 })}
            className="w-full bg-zinc-900 border border-zinc-600 rounded px-1.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block">Offset #</label>
          <input
            type="number" min={1} max={99} value={tool.offsetNumber}
            onChange={(e) => onUpdate(index, { offsetNumber: parseInt(e.target.value) || 1 })}
            className="w-full bg-zinc-900 border border-zinc-600 rounded px-1.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-zinc-500 block">Position</label>
        <select
          value={tool.position}
          onChange={(e) => onUpdate(index, { position: e.target.value as "left" | "right" | "neutral" })}
          className="w-full bg-zinc-900 border border-zinc-600 rounded px-1.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="left">Left Tool</option>
          <option value="right">Right Tool</option>
          <option value="neutral">Neutral Tool</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-[10px] text-zinc-500 block">Insert</label>
          <select
            value={tool.insertType}
            onChange={(e) => onUpdate(index, { insertType: e.target.value })}
            className="w-full bg-zinc-900 border border-zinc-600 rounded px-1.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
          >
            <option value="CNMG">CNMG (Rough)</option>
            <option value="DNMG">DNMG (Medium)</option>
            <option value="VNMG">VNMG (Finish)</option>
            <option value="WNMG">WNMG</option>
            <option value="TNMG">TNMG</option>
            <option value="CCMT">CCMT</option>
            <option value="DCMT">DCMT</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 block">Nose R</label>
          <select
            value={tool.noseRadius}
            onChange={(e) => onUpdate(index, { noseRadius: parseFloat(e.target.value) })}
            className="w-full bg-zinc-900 border border-zinc-600 rounded px-1.5 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
          >
            <option value={0.4}>0.4 mm</option>
            <option value={0.8}>0.8 mm</option>
            <option value={1.2}>1.2 mm</option>
            <option value={1.6}>1.6 mm</option>
          </select>
        </div>
      </div>
    </div>
  );
}

const MATERIAL_COLORS: Record<MaterialType, string> = {
  GI: "bg-blue-900 border-blue-700 text-blue-300",
  CR: "bg-purple-900 border-purple-700 text-purple-300",
  HR: "bg-orange-900 border-orange-700 text-orange-300",
  SS: "bg-red-900 border-red-700 text-red-300",
  AL: "bg-cyan-900 border-cyan-700 text-cyan-300",
  MS: "bg-zinc-800 border-zinc-600 text-zinc-300",
  CU: "bg-amber-900 border-amber-700 text-amber-300",
  TI: "bg-slate-800 border-slate-600 text-slate-300",
  PP: "bg-green-900 border-green-700 text-green-300",
  HSLA: "bg-rose-900 border-rose-700 text-rose-300",
};

const RISK_COLORS = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-red-400",
};

/**
 * Analyzes profile geometry to auto-detect whether it is an open or closed section.
 * Heuristic: if first and last segment endpoints are within 1% of profile width apart,
 * the profile is considered closed (tube/round/hollow). Otherwise, open (C/Z/U/hat).
 */
function detectSectionModel(geometry: { segments: Array<{ startX: number; startY: number; endX: number; endY: number }>; boundingBox: { minX: number; maxX: number; minY: number; maxY: number } }): "open" | "closed" {
  const segs = geometry.segments;
  if (!segs || segs.length < 3) return "open";

  const first = segs[0];
  const last = segs[segs.length - 1];

  // Check if profile endpoints are connected (closed loop)
  const dx = first.startX - last.endX;
  const dy = first.startY - last.endY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bb = geometry.boundingBox;
  const profileSpan = Math.max(Math.abs(bb.maxX - bb.minX), Math.abs(bb.maxY - bb.minY), 1);

  // If gap between start and end points < 2% of profile span → closed
  if (dist / profileSpan < 0.02) return "closed";

  // Also check via segment count: circular/tube profiles tend to have many short uniform segments
  const segLengths = segs.map(s => {
    const sdx = s.endX - s.startX;
    const sdy = s.endY - s.startY;
    return Math.sqrt(sdx * sdx + sdy * sdy);
  });
  const avgLen = segLengths.reduce((a, b) => a + b, 0) / segLengths.length;
  const variance = segLengths.reduce((a, b) => a + (b - avgLen) ** 2, 0) / segLengths.length;
  // Low variance + many segments = circular/closed
  if (segs.length > 12 && Math.sqrt(variance) / avgLen < 0.2) return "closed";

  return "open";
}

export function LeftPanel() {
  const {
    fileName, geometry, numStations, stationPrefix, materialThickness,
    bendAllowanceMethod, gcodeConfig, machineProfile, rollDiameter,
    shaftDiameter, clearance, isLoading, error,
    profileName, materialType, lineSpeed, arborLength, spacerLimit,
    isThicknessValid, openSectionType,
    setFileName, setGeometry, setNumStations, setStationPrefix,
    setMaterialThickness, setBendAllowanceMethod, setStations, setGcodeOutputs,
    setGcodeConfig, updateTool, addTool, removeTool, setRollTooling, setRollGaps,
    setMachineData, setMotorCalc, setBomResult,
    setRollDiameter, setShaftDiameter, setClearance, setLoading, setError, reset,
    setProfileName, setMaterialType, setLineSpeed, setArborLength, setSpacerLimit,
    setOpenSectionType, applyShutterPreset, applyPopAnglePreset, setActiveTab,
    setProfileMetadata, setPostProcessorId,
    setDxfDimensions,
    dxfDimensions,
    confirmedDimensions,
    sectionModel, setSectionModel,
    profileSourceType, setProfileSourceType,
    flowerGenerateTrigger,
    leftPanelScrollTarget, setLeftPanelScrollTarget,
    validationResults, validationApproved,
    setValidationResults, setValidationApproved,
  } = useCncStore();

  const [showConversionModal, setShowConversionModal] = useState(false);

  // Section model gate: section model must be selected before any generation
  const sectionModelRequired = sectionModel === null;

  // Validation gate: if validation was run and not approved, warn before generating downstream artifacts
  const validationWasRun = validationResults.length > 0;
  const validationFailed = validationWasRun && !validationApproved;

  // DXF dimension gate: if a file was uploaded (fileName is set), ALL available dimensions
  // must be confirmed (or overridden) before generation can proceed.
  // "All confirmed" means every entry in confirmedDimensions has confirmed=true.
  // Only applies to file uploads — manual profiles drawn via wizard do not require confirmation.
  const dxfHasAnyDims = confirmedDimensions.length > 0;
  const dxfAllConfirmed = dxfHasAnyDims && confirmedDimensions.every(d => d.confirmed);
  const dxfNeedsConfirmation = !!fileName && !!geometry && !dxfAllConfirmed;

  const { scoreTask } = useAccuracyScoring();
  const autoAI = useAutoAIMode();

  const [sections, setSections] = useState({
    project: true,
    material: true,
    profileType: true,
    upload: true,
    analysis: true,
    station: false,
    machine: false,
    sizingCalc: false,
    tools: false,
    postproc: false,
    gcode: false,
    roll: false,
    stripCalc: false,
    pipeline: false,
    testCases: false,
  });

  const toggleSection = (key: keyof typeof sections) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));

  const postProcessorId = useCncStore(state => state.postProcessorId);
  const localSetPostProcessorId = setPostProcessorId;
  const [confirmDeleteFile, setConfirmDeleteFile] = useState(false);

  // ── Line-to-Sheet offset ──────────────────────────────────────────────────
  type OffsetMode = "both" | "up" | "down";
  const [sheetOffsetMode, setSheetOffsetMode] = useState<OffsetMode>("both");
  const [sheetOffsetValue, setSheetOffsetValue] = useState<number>(materialThickness || 1.5);
  const originalGeometryRef = React.useRef<typeof geometry | null>(null);

  const applySheetOffset = React.useCallback(() => {
    if (!geometry) return;
    if (!originalGeometryRef.current) {
      originalGeometryRef.current = JSON.parse(JSON.stringify(geometry));
    }
    const base = originalGeometryRef.current!;
    const t = sheetOffsetValue;

    const computeNormal = (sx: number, sy: number, ex: number, ey: number) => {
      const dx = ex - sx; const dy = ey - sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-9) return { nx: 0, ny: 1 };
      return { nx: -dy / len, ny: dx / len };
    };

    const shifted = (d: number) =>
      base.segments.map((seg) => {
        const { nx, ny } = computeNormal(seg.startX, seg.startY, seg.endX, seg.endY);
        return {
          ...seg,
          startX: seg.startX + nx * d,
          startY: seg.startY + ny * d,
          endX: seg.endX + nx * d,
          endY: seg.endY + ny * d,
          centerX: seg.centerX !== undefined ? seg.centerX + nx * d : undefined,
          centerY: seg.centerY !== undefined ? seg.centerY + ny * d : undefined,
        };
      });

    let newSegments: typeof geometry.segments;
    if (sheetOffsetMode === "both") {
      newSegments = [...shifted(+t / 2), ...shifted(-t / 2)];
    } else if (sheetOffsetMode === "up") {
      newSegments = shifted(+t);
    } else {
      newSegments = shifted(-t);
    }

    const allX = newSegments.flatMap((s) => [s.startX, s.endX]);
    const allY = newSegments.flatMap((s) => [s.startY, s.endY]);
    const newGeo = {
      ...base,
      segments: newSegments,
      boundingBox: {
        minX: Math.min(...allX), maxX: Math.max(...allX),
        minY: Math.min(...allY), maxY: Math.max(...allY),
      },
    };
    setGeometry(newGeo);
    toast({ title: "Sheet Offset Applied", description: `Mode: ${sheetOffsetMode === "both" ? "Both Sides ±" + (t / 2).toFixed(2) : sheetOffsetMode === "up" ? "Single Up +" + t : "Single Down -" + t} mm` });
  }, [geometry, sheetOffsetMode, sheetOffsetValue, setGeometry]);

  const resetSheetOffset = React.useCallback(() => {
    if (originalGeometryRef.current) {
      setGeometry(originalGeometryRef.current);
      originalGeometryRef.current = null;
      toast({ title: "Offset Reset", description: "Original geometry restored" });
    }
  }, [setGeometry]);

  const [stripCalcResult, setStripCalcResult] = useState<{
    totalFlatWidth: number; straightLength: number; bendAllowanceTotal: number;
    bendCount: number; kFactor: number; insideBendRadius: number; notes: string[];
  } | null>(null);
  const [stripBendRadius, setStripBendRadius] = useState(0);
  const [stripLoading, setStripLoading] = useState(false);
  const [confidenceIntervals, setConfidenceIntervals] = useState<{
    stripWidth?: { nominal: number; low: number; high: number; unit: string; method?: string };
    springback?: { nominal: number; low: number; high: number; unit: string; method?: string };
    formingForce?: { nominal: number; low: number; high: number; unit: string; method?: string };
    thinningRatio?: { nominal: number; low: number; high: number; unit: string; method?: string };
    rollDiameter?: { nominal: number; low: number; high: number; unit: string; method?: string };
  } | null>(null);

  const selectedPP = POST_PROCESSORS.find(p => p.id === postProcessorId) ?? POST_PROCESSORS[0];

  const handleApplyPostProcessor = useCallback(() => {
    if (selectedPP) {
      setGcodeConfig({
        spindleMode: selectedPP.machineProfile.spindleMode,
        spindleDirection: selectedPP.machineProfile.spindleDirection,
        feedRate: selectedPP.machineProfile.feedRate,
        feedUnit: selectedPP.machineProfile.feedUnit,
        spindleSpeed: selectedPP.machineProfile.spindleSpeed,
        maxSpindleSpeed: selectedPP.machineProfile.maxSpindleSpeed,
        safeZ: selectedPP.machineProfile.safeZ,
        xDiameterMode: selectedPP.machineProfile.xDiameterMode,
        useG28: selectedPP.machineProfile.useG28,
        decimalPrecision: selectedPP.machineProfile.decimalPrecision,
        coolant: selectedPP.machineProfile.coolant,
        workOffset: selectedPP.machineProfile.workOffset,
        maxAcceleration: selectedPP.machineProfile.maxAcceleration,
        exactStopMode: selectedPP.machineProfile.exactStopMode,
      });
      setError(`✅ Post Processor: ${selectedPP.name} applied — saZ=${selectedPP.machineProfile.safeZ} | ${selectedPP.machineProfile.spindleDirection} | ${selectedPP.machineProfile.feedUnit}`);
    }
  }, [selectedPP, setGcodeConfig, setError]);

  const handleCalcStripWidth = useCallback(async () => {
    if (!geometry || !geometry.segments || geometry.segments.length === 0) {
      setError("Strip width ke liye pehle DXF upload karein");
      return;
    }
    setStripLoading(true);
    try {
      const result = await calcStripWidth({
        segments: geometry.segments,
        materialThickness,
        materialType,
        insideBendRadius: stripBendRadius > 0 ? stripBendRadius : undefined,
      });
      setStripCalcResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Strip width calc failed");
    } finally {
      setStripLoading(false);
    }
  }, [geometry, materialThickness, materialType, stripBendRadius, setError]);

  // ── Auto Shaft Diameter Calculation ──────────────────────────────────────────
  // Based on Roll OD ratio rule: shaft = 25–30% of roll OD (industry standard)
  const [autoShaft, setAutoShaft] = useState(true);

  function calcAutoShaftFromProfile(rollOD: number, stripW: number): number {
    const STD = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120];
    const rollBased = rollOD * 0.28;
    const stripBased = stripW * 0.22;
    const estimate = Math.max(rollBased, stripBased, 25);
    return STD.find(s => s >= estimate) ?? 100;
  }

  const profileWidth = geometry
    ? (geometry.boundingBox.maxX - geometry.boundingBox.minX)
    : 150;
  const autoShaftValue = calcAutoShaftFromProfile(rollDiameter, profileWidth);

  useEffect(() => {
    if (autoShaft) {
      setShaftDiameter(autoShaftValue);
    }
  }, [autoShaft, autoShaftValue, setShaftDiameter]);

  const matProps = MATERIAL_DATABASE[materialType];
  const keyway = getKeywaySizeForShaft(shaftDiameter);
  const minBendRadius = matProps.minBendRadiusMultiplier * materialThickness;

  const calcRecommendedStations = useCallback((geo: typeof geometry) => {
    if (!geo) return null;
    const safeBendPoints = geo.bendPoints ?? [];
    const bendCount = safeBendPoints.length;
    const totalBendDeg = safeBendPoints.reduce((sum, bp) => sum + Math.abs(bp.angle ?? 0), 0) || bendCount * 30;
    const springbackBonus = matProps.springbackFactor > 1.10 ? 2 : matProps.springbackFactor > 1.07 ? 1 : 0;
    const rec = Math.max(3, Math.min(20, Math.ceil(totalBendDeg / 15) + springbackBonus));
    return { recommended: rec, bendCount, totalBendDeg };
  }, [matProps]);

  const stationSuggestion = calcRecommendedStations(geometry);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext !== "dxf" && ext !== "dwg") {
        setError("Please upload a DXF or DWG file");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const result = await uploadDxf(file);
        setFileName(file.name);
        setGeometry(result.geometry);
        setProfileMetadata(null);
        setStations([]);
        setGcodeOutputs([]);
        setRollTooling([]);
        // Store extracted DXF dimensions for the Dimension Confirmation Panel
        if (result.geometry?.dimensions?.length) {
          setDxfDimensions(result.geometry.dimensions);
        } else {
          setDxfDimensions([]);
        }

        // Auto-detect open vs closed section from geometry and apply to sectionModel
        if (result.geometry?.segments?.length) {
          const detectedModel = detectSectionModel(result.geometry);
          setSectionModel(detectedModel);

          // Detect center-line vs sheet and auto-open conversion modal
          const srcType = detectProfileSourceType(result.geometry.segments);
          setProfileSourceType(srcType === "unknown" ? null : srcType);
          setShowConversionModal(true);

          setError(
            `✅ Profile loaded — AI auto-detected: ${detectedModel === "closed" ? "Closed Section (Model B — tube/hollow)" : "Open Section (Model A — C/Z/U/hat)"}. You may override via the Section Model selector.`
          );
        }

        if (result.convertedFrom === "dwg") {
          setError("✅ DWG converted to DXF! Profile loaded and section type auto-detected.");
        }

        const geo = result.geometry;
        const bendCount = geo.bendPoints?.length || 0;
        const totalBendDeg = geo.bendPoints?.reduce((s: number, bp: { angle: number }) => s + Math.abs(bp.angle), 0) || bendCount * 30;
        const springbackBonus = matProps.springbackFactor > 1.10 ? 2 : matProps.springbackFactor > 1.07 ? 1 : 0;
        const rec = Math.max(3, Math.min(20, Math.ceil(totalBendDeg / 15) + springbackBonus));
        setNumStations(rec);

        setSections((s) => ({ ...s, upload: true, station: true }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
      } finally {
        setLoading(false);
      }
    },
    [setFileName, setGeometry, setStations, setGcodeOutputs, setLoading, setError, setRollTooling, setNumStations, matProps, setDxfDimensions, setSectionModel]
  );

  const handleClearFile = useCallback(() => {
    setFileName("");
    setGeometry(null);
    setProfileMetadata(null);
    setStations([]);
    setGcodeOutputs([]);
    setRollTooling([]);
    setError(null);
  }, [setFileName, setGeometry, setProfileMetadata, setStations, setGcodeOutputs, setError, setRollTooling]);

  const handleGenerateFlower = useCallback(async () => {
    if (!geometry) return;
    const validation = validateRollFormingInputs({
      thickness: materialThickness,
      materialType,
      numStations,
      geometryLoaded: !!(geometry.segments?.length),
    });
    if (!validation.valid) {
      const msg = validation.errors[0] ?? "Invalid inputs — check material and thickness.";
      EngineLogger.warn("Flower", "Validation blocked calculation", validation);
      setError(msg);
      toast({ title: "Input Validation Failed", description: msg, variant: "destructive" });
      return;
    }
    if (validation.warnings.length > 0) {
      EngineLogger.warn("Flower", "Validation warnings", validation.warnings);
    }
    setLoading(true);
    setError(null);
    try {
      const resolvedSection = openSectionType === "Auto" ? autoDetectProfileType(geometry) : openSectionType;
      const result = await generateFlower(geometry, numStations, stationPrefix, materialType, materialThickness, resolvedSection, sectionModel);
      setStations(result.stations);
      setRollTooling([]);
      setGcodeOutputs([]);

      if (result.materialWarnings && result.materialWarnings.length > 0) {
        setError("⚠ Warnings: " + result.materialWarnings.join(" | "));
      }

      scoreTask("flower", `Power Pattern — ${materialType} ${materialThickness}mm × ${numStations} stations`, {
        stations: result.stations,
        totalBends: result.totalBends,
        recommendedStations: result.recommendedStations,
        materialType,
        kFactor: result.kFactor,
        maxThinningRatio: result.maxThinningRatio,
        accuracyScore: result.accuracyScore,
        confidenceIntervals: result.confidenceIntervals,
      });

      if (result.confidenceIntervals) {
        setConfidenceIntervals(result.confidenceIntervals);
      }

      toast({ title: "Power Pattern Generated", description: `${result.stations.length} stations created for ${materialType} ${materialThickness}mm` });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate power pattern";
      setError(msg);
      toast({ title: "Generation Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [geometry, numStations, stationPrefix, materialType, materialThickness, openSectionType, setStations, setLoading, setError, setRollTooling, setGcodeOutputs, scoreTask]);

  // Remote-trigger: FlowerPatternView can call requestFlowerGeneration() to start generation from outside LeftPanel
  useEffect(() => {
    if (flowerGenerateTrigger === 0) return;
    handleGenerateFlower();
  }, [flowerGenerateTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remote scroll: FlowerPatternView can call setLeftPanelScrollTarget("station") to open + scroll to that section
  const leftPanelRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!leftPanelScrollTarget) return;
    const key = leftPanelScrollTarget as keyof typeof sections;
    setSections((s) => ({ ...s, [key]: true }));
    setTimeout(() => {
      const el = leftPanelRef.current?.querySelector(`[data-section="${leftPanelScrollTarget}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setLeftPanelScrollTarget(null);
    }, 120);
  }, [leftPanelScrollTarget, setLeftPanelScrollTarget]);

  const handleGenerateGcode = useCallback(async () => {
    if (!geometry) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateGcode(geometry, numStations, stationPrefix, gcodeConfig, machineProfile);
      setGcodeOutputs(result.gcodeOutputs);

      if (result.gcodeOutputs && result.gcodeOutputs.length > 0) {
        const first = result.gcodeOutputs[0];
        scoreTask("gcode", `G-Code — ${numStations} stations`, {
          feedRate: gcodeConfig.feedRate,
          feedUnit: gcodeConfig.feedUnit,
          spindleSpeed: gcodeConfig.spindleSpeed,
          maxSpindleSpeed: gcodeConfig.maxSpindleSpeed,
          totalPathLength: result.gcodeOutputs.reduce((s: number, o: typeof first) => s + o.totalPathLength, 0),
          estimatedTime: result.gcodeOutputs.reduce((s: number, o: typeof first) => s + o.estimatedTime, 0),
          toolMoves: result.gcodeOutputs.reduce((s: number, o: typeof first) => s + o.toolMoves, 0),
          lineCount: result.gcodeOutputs.reduce((s: number, o: typeof first) => s + o.lineCount, 0),
        });
        toast({ title: "G-Code Generated", description: `${result.gcodeOutputs.length} programs ready for download` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate G-code";
      setError(msg);
      toast({ title: "G-Code Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [geometry, numStations, stationPrefix, gcodeConfig, machineProfile, setGcodeOutputs, setLoading, setError, scoreTask]);

  const handleGenerateRollTooling = useCallback(async () => {
    if (!geometry) return;
    const validation = validateRollFormingInputs({
      thickness: materialThickness,
      materialType,
      numStations,
      rollDiameter,
      geometryLoaded: !!(geometry.segments?.length),
    });
    if (!validation.valid) {
      const msg = validation.errors[0] ?? "Invalid inputs — check roll diameter and thickness.";
      EngineLogger.warn("RollTooling", "Validation blocked calculation", validation);
      setError(msg);
      toast({ title: "Input Validation Failed", description: msg, variant: "destructive" });
      return;
    }
    if (validation.warnings.length > 0) {
      EngineLogger.warn("RollTooling", "Validation warnings", validation.warnings);
    }
    setLoading(true);
    setError(null);
    try {
      const resolvedSection = openSectionType === "Auto" ? autoDetectProfileType(geometry) : openSectionType;
      const result = await generateRollTooling(geometry, numStations, stationPrefix, materialThickness, rollDiameter, shaftDiameter, clearance, materialType, postProcessorId, resolvedSection, sectionModel);
      setStations(result.stations);
      setRollTooling(result.rollTooling);
      if (result.rollGaps) setRollGaps(result.rollGaps);
      if (result.machineData) setMachineData(result.machineData);
      if (result.motorCalc) setMotorCalc(result.motorCalc);
      if (result.bom) setBomResult(result.bom);

      if (result.rollTooling && result.rollTooling.length > 0) {
        const firstRoll = result.rollTooling[0];
        scoreTask("tooling", `Roll Tooling — ${materialType} ${numStations} stations`, {
          rollProfile: firstRoll.rollProfile,
          materialType,
          stationNumber: firstRoll.stationNumber,
          rollGap: result.rollGaps?.[0],
        });
        toast({ title: "Roll Tooling Generated", description: `${result.rollTooling.length} roll sets created` });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate roll tooling";
      setError(msg);
      toast({ title: "Roll Tooling Failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [geometry, numStations, stationPrefix, materialThickness, rollDiameter, shaftDiameter, clearance, materialType, postProcessorId, openSectionType, setStations, setRollTooling, setRollGaps, setMachineData, setMotorCalc, setBomResult, setLoading, setError, scoreTask]);

  const inputCls = "rt-input";
  const inputSmCls = "rt-input-sm";

  return (
    <>
    <CenterLineConversionModal
      open={showConversionModal}
      onClose={() => setShowConversionModal(false)}
      onConverted={(bendCount, devLength) => {
        toast({
          title: "Sheet Profile Ready",
          description: `${bendCount} bends detected · Developed length: ${devLength.toFixed(1)}mm. Now configure stations and generate Power Pattern.`,
        });
      }}
    />

    <div ref={leftPanelRef} className="w-72 flex flex-col overflow-y-auto flex-shrink-0"
      style={{ background: "rgba(9, 10, 24, 0.6)", backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", borderRight: "1px solid rgba(255,255,255,0.08)" }}>

      {/* ── AUTO AI MODE BUTTON ── */}
      <div className="p-3 border-b border-white/[0.05]">
        <button
          onClick={autoAI.toggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
            autoAI.enabled
              ? "bg-gradient-to-r from-violet-600/30 to-purple-600/20 border-violet-500/50 text-violet-200 shadow-[0_0_18px_rgba(139,92,246,0.35)]"
              : "bg-white/[0.03] border-white/[0.10] text-zinc-400 hover:text-zinc-100 hover:bg-violet-500/10 hover:border-violet-500/30"
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            autoAI.enabled ? "bg-violet-500/30" : "bg-white/[0.05]"
          }`}>
            {autoAI.enabled && (autoAI.status.step !== "idle" && autoAI.status.step !== "done" && autoAI.status.step !== "error")
              ? <Loader2 className="w-4 h-4 text-violet-300 animate-spin" />
              : autoAI.enabled && autoAI.status.step === "done"
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : autoAI.enabled && autoAI.status.step === "error"
              ? <XCircle className="w-4 h-4 text-red-400" />
              : autoAI.enabled
              ? <Zap className="w-4 h-4 text-violet-300" />
              : <ZapOff className="w-4 h-4 text-zinc-500" />
            }
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-1.5">
              <span>{autoAI.enabled ? "Auto AI Mode ON" : "Auto AI Mode"}</span>
              {autoAI.enabled && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-300 border border-violet-500/30 font-bold">6-API</span>
              )}
            </div>
            <div className="text-[10px] font-normal mt-0.5 truncate">
              {autoAI.enabled
                ? autoAI.status.step === "idle"
                  ? "Profile load karo — auto run hoga"
                  : autoAI.status.step === "done"
                  ? `Complete — Score: ${autoAI.status.manufacturabilityScore !== undefined ? autoAI.status.manufacturabilityScore + "/100" : "✓"}`
                  : autoAI.status.step === "error"
                  ? autoAI.status.error ?? "Error aaya"
                  : autoAI.status.message
                : "AI-powered full pipeline: Flower → Tooling → G-Code"
              }
            </div>
          </div>
          {autoAI.enabled && autoAI.status.step !== "idle" && (
            <span className={`text-[10px] font-bold flex-shrink-0 ${
              autoAI.status.step === "done" ? "text-emerald-400"
              : autoAI.status.step === "error" ? "text-red-400"
              : "text-violet-300"
            }`}>
              {autoAI.status.step === "done" ? "100%" : autoAI.status.step === "error" ? "Err" : `${autoAI.status.progress}%`}
            </span>
          )}
        </button>

        {/* Progress bar */}
        {autoAI.enabled && autoAI.status.step !== "idle" && (
          <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                autoAI.status.step === "done" ? "bg-emerald-500"
                : autoAI.status.step === "error" ? "bg-red-500"
                : "bg-gradient-to-r from-violet-500 to-purple-400"
              }`}
              style={{ width: `${autoAI.status.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* ── FILE UPLOAD QUICK ACCESS ── */}
      <div className="p-3 border-b border-white/[0.05]">
        {fileName && geometry ? (
          /* File loaded — status + actions */
          <div className="space-y-2">
            {/* File info row */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-emerald-300 truncate">{fileName}</p>
                <p className="text-[9px] text-emerald-600">
                  {(geometry.segments ?? []).length} seg · {(geometry.bendPoints ?? []).length} bends ·{" "}
                  {(geometry.boundingBox.maxX - geometry.boundingBox.minX).toFixed(1)} mm wide
                </p>
              </div>
            </div>

            {/* Action buttons row */}
            {confirmDeleteFile ? (
              /* Confirmation prompt */
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 space-y-2">
                <p className="text-[11px] text-red-300 font-semibold text-center">
                  Delete this file?
                </p>
                <p className="text-[9px] text-red-400/70 text-center">
                  Geometry, flower, roll data sab clear ho jayega
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { handleClearFile(); setConfirmDeleteFile(false); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Haan, Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteFile(false)}
                    className="flex-1 py-1.5 rounded-lg border border-white/[0.10] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] text-[11px] font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* Replace / Upload New */}
                <label className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-white/[0.10] bg-white/[0.03] hover:bg-blue-500/10 hover:border-blue-500/30 text-zinc-400 hover:text-blue-300 cursor-pointer text-[11px] font-medium transition-all">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replace
                  <input type="file" accept=".dxf,.dwg" className="hidden" onChange={handleFileUpload} />
                </label>
                {/* Delete */}
                <button
                  onClick={() => setConfirmDeleteFile(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/50 text-red-400 hover:text-red-300 text-[11px] font-semibold transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          /* No file — big drag-and-drop upload area */
          <label className="flex flex-col items-center justify-center gap-2 w-full py-5 border-2 border-dashed border-white/[0.10] rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/[0.05] transition-all group">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:bg-blue-500/15 group-hover:border-blue-500/30 transition-all">
              <Upload className="w-5 h-5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-zinc-300 group-hover:text-blue-300 transition-colors">
                DXF / DWG Upload
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                Click to browse or drag & drop
              </p>
            </div>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[9px] text-zinc-500">
              .dxf &nbsp;·&nbsp; .dwg &nbsp; supported
            </span>
            <input type="file" accept=".dxf,.dwg" className="hidden" onChange={handleFileUpload} />
          </label>
        )}
      </div>

      {/* ── AUTOCAD EDITOR QUICK LAUNCH ── */}
      <div className="p-3 border-b border-white/[0.05]">
        <button
          onClick={() => setActiveTab("manual-drawing")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-orange-500/25 bg-orange-500/8 hover:bg-orange-500/15 hover:border-orange-500/45 transition-all group"
        >
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/25 transition-all">
            <PenLine className="w-4.5 h-4.5 text-orange-400" />
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-orange-200 group-hover:text-orange-100">AutoCAD Editor</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold">2D</span>
            </div>
            <p className="text-[10px] text-zinc-500 group-hover:text-zinc-400 mt-0.5">
              LINE · CIRCLE · ARC · POLYLINE · OFFSET · TRIM
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-orange-500/50 group-hover:text-orange-400 flex-shrink-0 transition-colors" />
        </button>

        {/* Sub-buttons row: Open with file / Draw from scratch */}
        <div className="flex gap-2 mt-2">
          {geometry && (
            <button
              onClick={() => setActiveTab("manual-drawing")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-orange-500/10 hover:border-orange-500/25 text-zinc-500 hover:text-orange-300 text-[10px] font-medium transition-all"
            >
              <Upload className="w-3 h-3" />
              Open Loaded File
            </button>
          )}
          <button
            onClick={() => { setActiveTab("manual-drawing"); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-zinc-500 hover:text-zinc-200 text-[10px] font-medium transition-all"
          >
            <PenLine className="w-3 h-3" />
            Draw from Scratch
          </button>
        </div>
      </div>

      {/* PROJECT SETUP */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Project Setup" icon={<Settings className="w-4 h-4" />} expanded={sections.project} onToggle={() => toggleSection("project")} />
        {sections.project && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">Profile Name</label>
              <input
                type="text"
                placeholder="e.g. Shutter Patti 82mm"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Thickness (mm)</label>
                <input
                  type="number" step={0.05}
                  min={matProps.minThickness}
                  max={matProps.maxThickness}
                  value={materialThickness}
                  onChange={(e) => setMaterialThickness(parseFloat(e.target.value) || 1)}
                  className={`${inputCls} ${!isThicknessValid ? "border-red-500 focus:border-red-500" : ""}`}
                />
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Range: {matProps.minThickness} – {matProps.maxThickness} mm
                </div>
                {!isThicknessValid && (
                  <div className="flex items-start gap-1 mt-1 text-[10px] text-red-400">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {materialType} ke liye max {matProps.maxThickness} mm aur min {matProps.minThickness} mm hai
                  </div>
                )}
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Line Speed (m/min)</label>
                <input
                  type="number" step={1} min={1}
                  value={lineSpeed}
                  onChange={(e) => setLineSpeed(parseFloat(e.target.value) || 20)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MATERIAL INTELLIGENCE */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Material Intelligence" icon={<span className="text-sm">🧪</span>} expanded={sections.material} onToggle={() => toggleSection("material")} />
        {sections.material && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Material Type</label>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(MATERIAL_DATABASE) as MaterialType[]).map((mat) => (
                  <button
                    key={mat}
                    onClick={() => setMaterialType(mat)}
                    className={`py-1.5 rounded text-xs font-bold border transition-all ${
                      materialType === mat
                        ? MATERIAL_COLORS[mat] + " ring-1 ring-offset-0 ring-blue-500"
                        : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    }`}
                  >
                    {mat}
                  </button>
                ))}
              </div>
            </div>

            <div className={`rounded-lg border p-2.5 space-y-1.5 ${MATERIAL_COLORS[materialType]}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{matProps.name}</div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="opacity-60">Springback:</span>
                  <span className="font-semibold">+{((matProps.springbackFactor - 1) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Min Bend R:</span>
                  <span className="font-semibold">{minBendRadius.toFixed(2)} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Crack Risk:</span>
                  <span className={`font-bold capitalize ${RISK_COLORS[matProps.crackingRisk]}`}>{matProps.crackingRisk}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">Max Speed:</span>
                  <span className="font-semibold">{matProps.maxFormingSpeed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">YS (MPa):</span>
                  <span className="font-semibold">{matProps.yieldStrength}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-60">UTS (MPa):</span>
                  <span className="font-semibold">{matProps.tensileStrength}</span>
                </div>
              </div>
              <div className="text-[10px] opacity-70 leading-tight border-t border-current/20 pt-1.5 mt-1.5">
                {matProps.notes}
              </div>
            </div>

            {confidenceIntervals && (
              <div className="rounded-lg border border-amber-800/30 bg-amber-950/20 p-2.5 space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Confidence Intervals (±95%)
                </div>
                {[
                  { key: "stripWidth", label: "Strip Width" },
                  { key: "springback", label: "Springback" },
                  { key: "formingForce", label: "Force" },
                  { key: "thinningRatio", label: "Thinning" },
                  { key: "rollDiameter", label: "Roll Width" },
                ].map(({ key, label }) => {
                  const ci = confidenceIntervals[key as keyof typeof confidenceIntervals];
                  if (!ci) return null;
                  return (
                    <div key={key} className="flex justify-between text-[9px]" title={ci.method || ""}>
                      <span className="text-zinc-500">{label}</span>
                      <span className="text-amber-300 font-mono">{ci.low}–{ci.high} {ci.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {lineSpeed > parseFloat(matProps.maxFormingSpeed) && (
              <div className="flex items-start gap-1.5 bg-yellow-950 border border-yellow-800 rounded p-2 text-[10px] text-yellow-300">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                Line speed {lineSpeed} m/min exceeds recommended {matProps.maxFormingSpeed} for {materialType}
              </div>
            )}

            {/* 6mm heavy gauge warning */}
            {materialThickness >= 5.0 && (
              <div className="flex items-start gap-1.5 bg-orange-950 border border-orange-800 rounded p-2 text-[10px] text-orange-300">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Heavy Gauge ≥ 5mm</div>
                  <div className="opacity-80">Use roll OD ≥ 200mm, EN31/D2 rolls, slow speed &lt; 15 m/min. Calibration stand mandatory.</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* OPEN SECTION PROFILE TYPE */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Profile Type" icon={<span className="text-sm">◧</span>} expanded={sections.profileType ?? true} onToggle={() => toggleSection("profileType" as keyof typeof sections)} />
        <div className="mt-3 space-y-2">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Open Section Type</label>
            <select
              value={openSectionType}
              onChange={(e) => setOpenSectionType(e.target.value as OpenSectionType)}
              className="w-full bg-zinc-900 border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50"
            >
              {OPEN_SECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const isAuto = openSectionType === "Auto";
            const detectedType = isAuto && geometry ? autoDetectProfileType(geometry) : null;
            const displayType = isAuto ? (detectedType || "C-Section") : openSectionType;
            const sel = OPEN_SECTION_OPTIONS.find(o => o.value === displayType);
            if (!sel && !isAuto) return null;

            if (isAuto) {
              return (
                <div className="rounded-lg border p-2.5 text-[10px] space-y-1.5 bg-orange-950 border-orange-800 text-orange-300">
                  <div className="font-bold text-[11px] flex items-center gap-1.5">
                    <span>⚡</span> Auto Detection
                  </div>
                  {geometry && detectedType ? (
                    <>
                      <div className="flex items-center gap-2 bg-orange-900/40 rounded px-2 py-1.5 border border-orange-700/50">
                        <span className="text-lg">{OPEN_SECTION_OPTIONS.find(o => o.value === detectedType)?.icon}</span>
                        <div>
                          <div className="font-bold text-orange-200 text-[11px]">{detectedType}</div>
                          <div className="text-orange-400 text-[9px]">{OPEN_SECTION_OPTIONS.find(o => o.value === detectedType)?.desc}</div>
                        </div>
                      </div>
                      <div className="text-[9px] text-orange-500">
                        Detected from {geometry.bendPoints.length} bends, {geometry.segments.length} segments
                      </div>
                    </>
                  ) : (
                    <div className="opacity-80">DXF file upload karein — profile type automatically detect hoga</div>
                  )}
                </div>
              );
            }

            const isPopSection = displayType === "Pop/Embossed";
            const isHeavyAngle = displayType === "Angle" || displayType === "L-Angle";
            return (
              <div className={`rounded-lg border p-2.5 text-[10px] space-y-1 ${
                isPopSection ? "bg-amber-950 border-amber-800 text-amber-300" :
                isHeavyAngle ? "bg-emerald-950 border-emerald-800 text-emerald-300" :
                "bg-blue-950 border-blue-800 text-blue-300"
              }`}>
                <div className="font-bold text-[11px]">{sel?.icon} {sel?.label}</div>
                <div className="opacity-80">{sel?.desc}</div>
                {isPopSection && (
                  <div className="border-t border-amber-800 pt-1 font-semibold">
                    ▲ Pop/Embossed: Bend angle 90–120° — springback ×1.15 applied
                  </div>
                )}
              </div>
            );
          })()}

          {/* Factory Presets */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Factory Presets</div>
            <button
              onClick={applyShutterPreset}
              className="w-full text-left px-3 py-2 rounded-lg border border-blue-800 bg-blue-950 hover:bg-blue-900 hover:border-blue-600 text-[11px] text-blue-300 transition-all"
            >
              <div className="font-bold">🏭 Shutter Plant Preset</div>
              <div className="text-[10px] text-blue-500 mt-0.5">GI 2mm · C-Section · Ø150 roll · 40mm shaft · 14 stations · 30 m/min</div>
            </button>
            <button
              onClick={applyPopAnglePreset}
              className="w-full text-left px-3 py-2 rounded-lg border border-amber-800 bg-amber-950 hover:bg-amber-900 hover:border-amber-600 text-[11px] text-amber-300 transition-all"
            >
              <div className="font-bold">▲ Pop / Angle Preset</div>
              <div className="text-[10px] text-amber-500 mt-0.5">MS 2mm · Pop/Embossed · Ø160 roll · 40mm shaft · 18 stations · springback ×1.15</div>
            </button>
          </div>
        </div>
      </div>

      {/* DXF UPLOAD */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Drawing Upload" icon={<Upload className="w-4 h-4" />} expanded={sections.upload} onToggle={() => toggleSection("upload")} />
        {sections.upload && (
          <div className="mt-3 space-y-2">
            {/* File loaded state */}
            {fileName && geometry ? (
              <div className="border border-green-700 bg-green-950 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded bg-green-800 flex items-center justify-center flex-shrink-0">
                      <Upload className="w-3.5 h-3.5 text-green-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-green-300 truncate">{fileName}</p>
                      <p className="text-[10px] text-green-500">File loaded successfully</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearFile}
                    title="Remove file and upload a new one"
                    className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center bg-red-900/60 hover:bg-red-700 border border-red-700 hover:border-red-500 text-red-300 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2.5 text-[10px] text-zinc-400 border-t border-green-800 pt-2 space-y-1">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <span>Width: <strong className="text-white font-mono">{(geometry.boundingBox.maxX - geometry.boundingBox.minX).toFixed(3)} mm</strong></span>
                    <span>Height: <strong className="text-white font-mono">{(geometry.boundingBox.maxY - geometry.boundingBox.minY).toFixed(3)} mm</strong></span>
                    <span>Min X: <strong className="text-zinc-300 font-mono">{geometry.boundingBox.minX.toFixed(3)} mm</strong></span>
                    <span>Max X: <strong className="text-zinc-300 font-mono">{geometry.boundingBox.maxX.toFixed(3)} mm</strong></span>
                    <span>Min Y: <strong className="text-zinc-300 font-mono">{geometry.boundingBox.minY.toFixed(3)} mm</strong></span>
                    <span>Max Y: <strong className="text-zinc-300 font-mono">{geometry.boundingBox.maxY.toFixed(3)} mm</strong></span>
                    <span>Segments: <strong className="text-zinc-300 font-mono">{(geometry.segments ?? []).length}</strong></span>
                    <span>Bends: <strong className="text-zinc-300 font-mono">{(geometry.bendPoints ?? []).length}</strong></span>
                  </div>
                  {(geometry.bendPoints ?? []).length > 0 && (
                    <div className="border-t border-green-900 pt-1 mt-1">
                      <span className="text-zinc-500">Bend angles: </span>
                      <strong className="text-yellow-300 font-mono">
                        {(geometry.bendPoints ?? []).map(bp => `${(bp.angle ?? 0).toFixed(3)}°`).join(" | ")}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Re-upload button */}
                <label className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 rounded border border-zinc-600 hover:border-blue-500 hover:bg-zinc-800 cursor-pointer transition-colors text-[10px] text-zinc-400 hover:text-blue-300">
                  <RefreshCw className="w-3 h-3" />
                  Replace with different file
                  <input type="file" accept=".dxf,.dwg" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            ) : (
              <div className="flex gap-2">
                <label className="flex-1 flex flex-col items-center justify-center h-24 border-2 border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/[0.04] transition-all group">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-2 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">
                    <Upload className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <span className="text-xs text-zinc-400 text-center px-2">
                    Upload DXF / DWG
                  </span>
                  <input type="file" accept=".dxf,.dwg" className="hidden" onChange={handleFileUpload} />
                </label>
                <button
                  onClick={() => setActiveTab("manual-drawing")}
                  className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-white/[0.08] rounded-xl hover:border-orange-500/40 hover:bg-orange-500/[0.04] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-2 group-hover:bg-orange-500/10 group-hover:border-orange-500/20 transition-all">
                    <PenLine className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 transition-colors" />
                  </div>
                  <span className="text-[10px] text-zinc-400 text-center group-hover:text-orange-300 transition-colors">
                    AutoCAD Mode
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ANALYSIS RESULTS */}
      {geometry && (() => {
        const safeBP = geometry.bendPoints ?? [];
        const bendCount = safeBP.length;
        // Step 1 pass formula (document): base + thin sheet + SS + per-bend penalties
        let suggestedPasses = bendCount * 2;
        if (materialThickness < 0.5) suggestedPasses += 1;
        if (materialType === "SS") suggestedPasses += 2;
        safeBP.forEach(bp => {
          if ((bp.radius ?? 0) > 0 && bp.radius < 1) suggestedPasses += 1; // tight radius per bend
          if (Math.abs(bp.angle ?? 0) > 90) suggestedPasses += 1;          // high angle per bend
        });
        // Step 1 risk logic (document): bend count → thickness → material
        let riskLevel: string;
        if (bendCount >= 4) riskLevel = "high";
        else if (materialThickness < 0.4) riskLevel = "medium";
        else if (materialType === "SS") riskLevel = "high";
        else riskLevel = matProps.crackingRisk; // fallback to material default
        const totalBendDeg = safeBP.reduce((s, bp) => s + Math.abs(bp.angle ?? 0), 0);
        return (
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
            <SectionHeader
              title="Analysis Results"
              icon={<span className="text-sm">📊</span>}
              expanded={sections.analysis}
              onToggle={() => toggleSection("analysis")}
            />
            {sections.analysis && (
              <div className="mt-3 space-y-2">
                <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-2.5 space-y-1.5 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Bend Count:</span>
                    <span className="font-bold text-white">{bendCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Total Bend Angle:</span>
                    <span className="font-bold text-yellow-300">{totalBendDeg.toFixed(1)}°</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-zinc-700 pt-1.5">
                    <span className="text-zinc-400">Suggested Passes:</span>
                    <span className="font-bold text-blue-300 text-sm">{suggestedPasses}</span>
                  </div>
                  <div className="text-[9px] text-zinc-500 leading-tight">
                    Formula: bends×2{materialThickness <= 0.5 ? " +1 (thin sheet)" : ""}{materialType === "SS" ? " +2 (SS springback)" : ""}
                  </div>
                </div>
                <div className={`rounded-lg border p-2.5 text-[10px] ${
                  riskLevel === "low" ? "bg-green-950 border-green-800" :
                  riskLevel === "medium" ? "bg-yellow-950 border-yellow-800" :
                  "bg-red-950 border-red-800"
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Risk Level:</span>
                    <span className={`font-bold capitalize text-sm ${RISK_COLORS[riskLevel as keyof typeof RISK_COLORS] ?? "text-zinc-400"}`}>{riskLevel}</span>
                  </div>
                  <div className="text-[9px] text-zinc-500 mt-1 leading-tight">
                    {riskLevel === "low" && "Good formability — standard process applies"}
                    {riskLevel === "medium" && "Monitor closely — reduce forming speed if needed"}
                    {riskLevel === "high" && "High cracking risk — large radius, slow speed required"}
                  </div>
                </div>
                {/* File 05 Rules: Tight radius + High angle warnings */}
                {bendCount > 0 && (() => {
                  const tightBends = safeBP.filter(bp => (bp.radius ?? 0) > 0 && bp.radius < 2 * materialThickness);
                  const highAngleBends = safeBP.filter(bp => Math.abs(bp.angle ?? 0) > 90);
                  return (
                    <div className="space-y-1.5">
                      {tightBends.length > 0 && (
                        <div className="text-[10px] bg-orange-950 border border-orange-800 rounded p-2 space-y-0.5">
                          <div className="font-bold text-orange-300">⚠ Tight Radius Detected</div>
                          <div className="text-orange-400">{tightBends.length} bend(s) with R &lt; 2×t — More passes needed</div>
                          <div className="text-zinc-500">Rule: Tight radius → increase stations to reduce forming stress</div>
                        </div>
                      )}
                      {highAngleBends.length > 0 && (
                        <div className="text-[10px] bg-red-950 border border-red-800 rounded p-2 space-y-0.5">
                          <div className="font-bold text-red-300">↑ High Angle — Overbend Required</div>
                          <div className="text-red-400">{highAngleBends.length} bend(s) &gt; 90° — Springback over-form applied</div>
                          <div className="text-zinc-500">
                            Over-form factor: +{((matProps.springbackFactor - 1) * 100).toFixed(0)}% ({materialType})
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {bendCount === 0 && (
                  <div className="text-[10px] text-amber-400 bg-amber-950 border border-amber-800 rounded p-2">
                    ⚠ No bend points detected. Upload a profile with bends for full analysis.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* PIPELINE DEBUG */}
      {geometry && (
        <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
          <SectionHeader
            title="Auto Pipeline Debug"
            icon={<Play className="w-4 h-4" />}
            expanded={sections.pipeline}
            onToggle={() => toggleSection("pipeline")}
          />
          {sections.pipeline && (
            <div className="mt-3">
              <PipelineDebugPanel
                geometry={geometry}
                thickness={materialThickness}
                material={materialType}
                sectionModel={sectionModel ?? "open"}
                onFlowerStationsReady={(stations) => {
                  setStations(stations as Parameters<typeof setStations>[0]);
                  toast({ title: "Pipeline Complete", description: `${stations.length} flower stations generated from full pipeline.` });
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* MANDATORY TEST SUITE */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader
          title="Engineering Test Suite"
          icon={<FlaskConical className="w-4 h-4" />}
          expanded={sections.testCases}
          onToggle={() => toggleSection("testCases")}
        />
        {sections.testCases && (
          <div className="mt-3">
            <TestCasesPanel />
          </div>
        )}
      </div>

      {/* STATION CONFIG */}
      <div data-section="station" className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Station Config" icon={<Settings className="w-4 h-4" />} expanded={sections.station} onToggle={() => toggleSection("station")} />
        {sections.station && (
          <div className="mt-3 space-y-2">
            {stationSuggestion && (
              <div className="bg-blue-950 border border-blue-700 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">🤖</span>
                  <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">AI Recommendation</span>
                </div>
                <div className="text-[10px] text-blue-200 space-y-0.5 mb-2">
                  <div>Bends detected: <strong>{stationSuggestion.bendCount}</strong></div>
                  <div>Total bend angle: <strong className="font-mono">{stationSuggestion.totalBendDeg.toFixed(3)}°</strong></div>
                  <div>Material ({materialType}) springback bonus: <strong>+{matProps.springbackFactor > 1.10 ? 2 : matProps.springbackFactor > 1.07 ? 1 : 0} stations</strong></div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-100 text-xs font-bold">
                    Recommended: <span className="text-xl text-white">{stationSuggestion.recommended}</span> stations
                  </span>
                  <button
                    onClick={() => setNumStations(stationSuggestion.recommended)}
                    className={`ml-auto text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                      numStations === stationSuggestion.recommended
                        ? "bg-green-700 text-green-100"
                        : "bg-blue-600 hover:bg-blue-500 text-white"
                    }`}
                  >
                    {numStations === stationSuggestion.recommended ? "✓ Applied" : "Apply"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">
                  No. of Stations
                  {stationSuggestion && numStations !== stationSuggestion.recommended && (
                    <span className="ml-1 text-yellow-400">(Rec: {stationSuggestion.recommended})</span>
                  )}
                </label>
                <input
                  type="number" min={1} max={30} value={numStations}
                  onChange={(e) => setNumStations(parseInt(e.target.value) || 1)}
                  className={`${inputCls} ${stationSuggestion && numStations === stationSuggestion.recommended ? "border-green-600" : ""}`}
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Prefix</label>
                <input
                  type="text" value={stationPrefix}
                  onChange={(e) => setStationPrefix(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">Bend Method</label>
              <select
                value={bendAllowanceMethod}
                onChange={(e) => setBendAllowanceMethod(e.target.value as "inside_radius" | "neutral_axis")}
                className={inputCls}
              >
                <option value="inside_radius">Inside Radius</option>
                <option value="neutral_axis">Neutral Axis</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* MACHINE SPECS */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Machine Specs" icon={<span className="text-sm">🏭</span>} expanded={sections.machine} onToggle={() => toggleSection("machine")} />
        {sections.machine && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Roll Dia (mm)</label>
                <input type="number" value={rollDiameter} onChange={(e) => setRollDiameter(parseFloat(e.target.value) || 150)} className={inputCls} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="text-[10px] text-zinc-500">Shaft Dia (mm)</label>
                  <button
                    onClick={() => setAutoShaft(!autoShaft)}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-semibold border transition-colors ${autoShaft ? "bg-green-700 hover:bg-green-600 text-green-100 border-green-600" : "bg-zinc-700 hover:bg-zinc-600 text-zinc-300 border-zinc-600"}`}
                    title={autoShaft ? "Auto mode: shaft calculated from Roll OD (28% rule). Click to override manually." : "Manual mode. Click to switch to auto."}
                  >
                    {autoShaft ? "AUTO" : "Manual"}
                  </button>
                </div>
                {autoShaft ? (
                  <div className="relative">
                    <input
                      type="number"
                      value={shaftDiameter}
                      readOnly
                      className={`${inputCls} opacity-70 cursor-not-allowed bg-green-950/40 border-green-700/50 text-green-300`}
                    />
                    <div className="text-[9px] text-green-500 mt-0.5">
                      Ø{rollDiameter}×28% = {(rollDiameter*0.28).toFixed(0)}mm → ISO Ø{shaftDiameter}
                    </div>
                  </div>
                ) : (
                  <input
                    type="number"
                    value={shaftDiameter}
                    onChange={(e) => setShaftDiameter(parseFloat(e.target.value) || 40)}
                    className={inputCls}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Arbor Length (mm)</label>
                <input type="number" value={arborLength} onChange={(e) => setArborLength(parseFloat(e.target.value) || 300)} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Spacer Limit (mm)</label>
                <input type="number" value={spacerLimit} onChange={(e) => setSpacerLimit(parseFloat(e.target.value) || 50)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">Clearance (mm)</label>
              <div className="flex gap-1">
                <input type="number" step="0.01" value={clearance} onChange={(e) => setClearance(parseFloat(e.target.value) || 0.05)} className={`${inputCls} flex-1`} />
                <button
                  title={`Auto clearance: thickness × 0.1 = ${(materialThickness * 0.1).toFixed(3)} mm`}
                  onClick={() => setClearance(parseFloat((materialThickness * 0.1).toFixed(3)))}
                  className="px-2 py-1 text-[10px] rounded bg-blue-800 hover:bg-blue-700 text-blue-200 border border-blue-600 font-semibold flex-shrink-0 transition-colors"
                >
                  Auto
                </button>
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Formula: t×0.1 = {(materialThickness * 0.1).toFixed(3)} mm &nbsp;|&nbsp; Gap = t×1.1
              </div>
            </div>
            <div className="bg-zinc-800 rounded p-2 border border-zinc-700 text-[10px] text-zinc-400 space-y-1">
              <div className="text-zinc-300 font-semibold mb-1">Auto-Calculated Values</div>
              <div className="flex justify-between">
                <span>Shaft Dia (ISO):</span>
                <span className="text-green-300 font-bold">Ø{shaftDiameter} mm {autoShaft ? "(auto)" : "(manual)"}</span>
              </div>
              <div className="flex justify-between">
                <span>Keyway (DIN 6885-A):</span>
                <span className="text-yellow-300 font-medium">{keyway.width}×{keyway.height} mm</span>
              </div>
              <div className="flex justify-between">
                <span>ISO Fit Shaft / Bore:</span>
                <span className="text-cyan-300 font-medium">h6 / H7</span>
              </div>
              <div className="flex justify-between">
                <span>Roll Gap:</span>
                <span className="text-zinc-200 font-medium">{(materialThickness + clearance).toFixed(3)} mm</span>
              </div>
              <div className="flex justify-between">
                <span>Surface (bearing seat):</span>
                <span className="text-zinc-300 font-medium">Ra 0.8 µm</span>
              </div>
              <div className="text-[9px] text-zinc-600 pt-1 border-t border-zinc-700">
                Full keyway + locknut + tolerance → Generate Roll Tooling
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MACHINE SIZING CALCULATOR */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Machine Sizing Calculator" icon={<span className="text-sm">🧮</span>} expanded={sections.sizingCalc} onToggle={() => toggleSection("sizingCalc")} />
        {sections.sizingCalc && (
          <div className="mt-3">
            <MachineSizingCalculator />
          </div>
        )}
      </div>

      {/* LATHE TOOLS */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Lathe Tools" icon={<Wrench className="w-4 h-4" />} expanded={sections.tools} onToggle={() => toggleSection("tools")} />
        {sections.tools && (
          <div className="mt-3">
            <div className="space-y-2 mb-2">
              {gcodeConfig.tools.map((tool, i) => (
                <ToolConfig key={i} tool={tool} index={i} onUpdate={updateTool} onRemove={removeTool} canRemove={gcodeConfig.tools.length > 1} />
              ))}
            </div>
            <button
              onClick={addTool}
              className="rt-btn-ghost w-full text-xs py-1.5"
            >
              <Plus className="w-3 h-3" /> Add Tool
            </button>
          </div>
        )}
      </div>

      {/* POST PROCESSOR */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Post Processor" icon={<span className="text-sm">🖨</span>} expanded={sections.postproc} onToggle={() => toggleSection("postproc")} />
        {sections.postproc && (
          <div className="mt-3 space-y-2.5">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">CNC Controller</label>
              <select
                value={postProcessorId}
                onChange={e => localSetPostProcessorId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50"
              >
                {POST_PROCESSORS.map(pp => (
                  <option key={pp.id} value={pp.id}>{pp.icon} {pp.name}</option>
                ))}
              </select>
            </div>
            {selectedPP && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 text-[10px] text-zinc-500 space-y-2">
                <div className="text-zinc-300 font-semibold text-[11px]">{selectedPP.icon} {selectedPP.brand} — {selectedPP.name}</div>
                <div>{selectedPP.description}</div>
                {selectedPP.id === "delta_2x" && (
                  <div className="mt-1 bg-amber-950/40 border border-amber-700/40 rounded p-2 space-y-1">
                    <div className="text-amber-400 font-bold text-[10px] mb-1">⬛ Delta 2X — 4 Machine Commands</div>
                    {[
                      { old: "M3",   newCmd: "M4",    desc: "Spindle direction — CCW rotation" },
                      { old: "G50",  newCmd: "G92",   desc: "Max RPM limit command" },
                      { old: "Z100", newCmd: "Z50",   desc: "Safe Z return height (50 mm)" },
                      { old: "—",    newCmd: "G0 G53\nG28 U0. G28 W0. M1", desc: "Safety block at every tool change" },
                    ].map(d => (
                      <div key={d.newCmd} className="flex items-start gap-2">
                        <span className="text-zinc-700 font-mono line-through w-8 flex-shrink-0">{d.old}</span>
                        <span className="text-amber-300 font-mono font-bold flex-shrink-0">{d.newCmd}</span>
                        <span className="text-zinc-500">{d.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1 text-zinc-600 pt-1">
                  {[
                    ["Direction", selectedPP.machineProfile.spindleDirection],
                    ["Feed Unit", selectedPP.machineProfile.feedUnit],
                    ["Tool Format", selectedPP.machineProfile.toolFormat],
                    ["End Code", selectedPP.machineProfile.footerLines.at(-1) ?? "M30"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <span className="text-zinc-700">{l}: </span>
                      <span className="text-amber-400 font-mono font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={handleApplyPostProcessor}
              className="rt-btn-primary w-full text-xs py-1.5"
            >
              <Settings className="w-3 h-3" />
              Apply Post Processor Settings
            </button>
          </div>
        )}
      </div>

      {/* G-CODE SETTINGS */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="G-Code Settings" icon={<span className="text-sm">📄</span>} expanded={sections.gcode} onToggle={() => toggleSection("gcode")} />
        {sections.gcode && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Spindle Mode</label>
                <select value={gcodeConfig.spindleMode} onChange={(e) => setGcodeConfig({ spindleMode: e.target.value as "css" | "rpm" })} className={inputSmCls}>
                  <option value="css">G96 CSS</option>
                  <option value="rpm">G97 RPM</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Speed</label>
                <input type="number" value={gcodeConfig.spindleSpeed} onChange={(e) => setGcodeConfig({ spindleSpeed: parseInt(e.target.value) || 200 })} className={inputSmCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Max RPM (G92)</label>
                <input type="number" value={gcodeConfig.maxSpindleSpeed} onChange={(e) => setGcodeConfig({ maxSpindleSpeed: parseInt(e.target.value) || 500 })} className={inputSmCls} />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Direction</label>
                <select value={gcodeConfig.spindleDirection} onChange={(e) => setGcodeConfig({ spindleDirection: e.target.value as "M3" | "M4" })} className={inputSmCls}>
                  <option value="M3">M3 (CW)</option>
                  <option value="M4">M4 (CCW)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Feed Rate</label>
                <input type="number" step={0.001} value={gcodeConfig.feedRate} onChange={(e) => setGcodeConfig({ feedRate: parseFloat(e.target.value) || 0.102 })} className={inputSmCls} />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Feed Unit</label>
                <select value={gcodeConfig.feedUnit} onChange={(e) => setGcodeConfig({ feedUnit: e.target.value as "mm_rev" | "mm_min" })} className={inputSmCls}>
                  <option value="mm_rev">mm/rev</option>
                  <option value="mm_min">mm/min</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Safe Z</label>
                <input type="number" step={1} value={gcodeConfig.safeZ} onChange={(e) => setGcodeConfig({ safeZ: parseFloat(e.target.value) || 50 })} className={inputSmCls} />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Safe X (dia)</label>
                <input type="number" step={1} value={gcodeConfig.safeX} onChange={(e) => setGcodeConfig({ safeX: parseFloat(e.target.value) || 135 })} className={inputSmCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Program #</label>
                <input type="number" value={gcodeConfig.programNumber} onChange={(e) => setGcodeConfig({ programNumber: parseInt(e.target.value) || 5000 })} className={inputSmCls} />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Precision</label>
                <select value={gcodeConfig.decimalPrecision} onChange={(e) => setGcodeConfig({ decimalPrecision: parseInt(e.target.value) })} className={inputSmCls}>
                  <option value={1}>1 decimal</option>
                  <option value={2}>2 decimals</option>
                  <option value={3}>3 decimals</option>
                  <option value={4}>4 decimals</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-xs text-zinc-400">
                <input type="checkbox" checked={gcodeConfig.xDiameterMode} onChange={(e) => setGcodeConfig({ xDiameterMode: e.target.checked })} className="rounded bg-zinc-800 border-zinc-600" />
                X Diameter
              </label>
              <label className="flex items-center gap-1 text-xs text-zinc-400">
                <input type="checkbox" checked={gcodeConfig.useG28} onChange={(e) => setGcodeConfig({ useG28: e.target.checked })} className="rounded bg-zinc-800 border-zinc-600" />
                G28 Home
              </label>
              <label className="flex items-center gap-1 text-xs text-zinc-400">
                <input type="checkbox" checked={gcodeConfig.coolant} onChange={(e) => setGcodeConfig({ coolant: e.target.checked })} className="rounded bg-zinc-800 border-zinc-600" />
                Coolant
              </label>
            </div>
          </div>
        )}
      </div>

      {/* WORKFLOW BUTTONS */}
      <div className="p-4 space-y-2.5">
        <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-3">Workflow Steps</p>

        {/* Section model gate — must be selected at workflow start */}
        {sectionModelRequired && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[10px] text-violet-300 border border-violet-600/30 bg-violet-950/30 mb-1">
            <span className="text-violet-400 mt-0.5">⚠</span>
            <span>Select an AI Section Model (Open or Closed) in the Profile Settings before generating. This selection configures the dedicated forming model for your workflow.</span>
          </div>
        )}

        {/* DXF dimension confirmation gate — blocks generation until ALL dimensions confirmed */}
        {dxfNeedsConfirmation && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[10px] text-amber-300 border border-amber-600/30 bg-amber-950/30 mb-1">
            <span className="text-amber-400 mt-0.5">⚠</span>
            <span>
              {!dxfHasAnyDims
                ? "DXF uploaded. Go to Dimension Confirm tab and confirm all extracted/synthesized dimensions before generating."
                : `${confirmedDimensions.filter(d => !d.confirmed).length} dimension(s) unconfirmed. Confirm ALL dimensions in the Dimension Confirm tab to proceed.`
              }
            </span>
          </div>
        )}

        {/* Validation gate — blocks ALL generation when validation has failed */}
        {validationFailed && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[10px] text-red-300 border border-red-600/30 bg-red-950/30 mb-1">
            <span className="text-red-400 mt-0.5">⚠</span>
            <div className="flex-1">
              <span>Validation pipeline failed. All generation is locked until all 5 layers pass at 100%. Adjust parameters, then use Reset Validation to clear results and regenerate.</span>
              <button
                onClick={() => { setValidationResults([]); setValidationApproved(false); }}
                className="mt-1 flex items-center gap-1 text-[9px] text-red-400 hover:text-red-300 underline underline-offset-2"
              >
                Reset Validation (unlock generation)
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleGenerateFlower}
          disabled={!geometry || isLoading || sectionModelRequired || dxfNeedsConfirmation || validationFailed}
          className="rt-btn-primary w-full text-[12px]"
        >
          <Play className="w-3.5 h-3.5" />
          1. Power Pattern
          <span className="ml-1 text-blue-300 font-mono text-[10px]">({materialType} ×{MATERIAL_DATABASE[materialType].springbackFactor})</span>
        </button>
        <button
          onClick={handleGenerateRollTooling}
          disabled={!geometry || isLoading || sectionModelRequired || dxfNeedsConfirmation || validationFailed}
          className="rt-btn-amber w-full text-[12px]"
        >
          <Wrench className="w-3.5 h-3.5" />
          2. Roll Tooling Design
        </button>
        <button
          onClick={handleGenerateGcode}
          disabled={!geometry || isLoading || sectionModelRequired || dxfNeedsConfirmation || validationFailed}
          className="rt-btn-green w-full text-[12px]"
        >
          <Play className="w-3.5 h-3.5" />
          3. Generate G-Code
        </button>
        <button
          onClick={reset}
          className="rt-btn-ghost w-full text-[12px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset All
        </button>
      </div>

      {/* STRIP WIDTH CALCULATOR */}
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <SectionHeader title="Strip Width Calculator" icon={<span className="text-sm">📐</span>} expanded={sections.stripCalc} onToggle={() => toggleSection("stripCalc")} />
        {sections.stripCalc && (
          <div className="mt-3 space-y-2.5">
            <div className="text-[10px] text-zinc-600 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2">
              Profile cross-section se flat blank width calculate karta hai (K-factor + bend allowance method).
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Material Type</label>
                <div className="text-[11px] font-semibold text-zinc-300 px-2 py-1.5 bg-zinc-900 border border-white/[0.06] rounded-lg">{materialType}</div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Thickness (mm)</label>
                <div className="text-[11px] font-semibold text-zinc-300 px-2 py-1.5 bg-zinc-900 border border-white/[0.06] rounded-lg">{materialThickness}</div>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-0.5">
                Inside Bend Radius (mm) — <span className="text-zinc-700">0 = auto (1.5×t)</span>
              </label>
              <input
                type="number" step={0.1} min={0} value={stripBendRadius}
                onChange={e => setStripBendRadius(parseFloat(e.target.value) || 0)}
                className="w-full bg-zinc-900 border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500/50"
                placeholder="0 = auto"
              />
            </div>
            <button
              onClick={handleCalcStripWidth}
              disabled={!geometry || stripLoading}
              className="rt-btn-primary w-full text-xs py-1.5"
            >
              {stripLoading ? (
                <><div className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />Calculating...</>
              ) : (
                <><span>📐</span> Calculate Strip Width</>
              )}
            </button>
            {stripCalcResult && (
              <div className="space-y-1.5">
                {/* Main result */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <div className="text-[10px] text-blue-400 uppercase tracking-wide mb-1">Flat Blank Width</div>
                  <div className="text-2xl font-bold font-mono text-blue-300">
                    {stripCalcResult.totalFlatWidth.toFixed(2)} <span className="text-sm text-blue-500">mm</span>
                  </div>
                  <div className="text-[10px] text-blue-600 mt-1">
                    Add 2–3 mm trim allowance → Order {Math.ceil(stripCalcResult.totalFlatWidth + 3)} mm strip coil
                  </div>
                </div>
                {/* Breakdown */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 space-y-1 text-[10px] font-mono">
                  {[
                    ["Straight Sections", `${stripCalcResult.straightLength.toFixed(2)} mm`, "text-zinc-300"],
                    ["Bend Allowance", `${stripCalcResult.bendAllowanceTotal.toFixed(2)} mm`, "text-amber-400"],
                    ["Bends Detected", `${stripCalcResult.bendCount}`, "text-violet-400"],
                    ["K-Factor", `${stripCalcResult.kFactor} (${materialType})`, "text-blue-400"],
                    ["Inside Radius Ri", `${stripCalcResult.insideBendRadius.toFixed(2)} mm`, "text-emerald-400"],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className="flex justify-between">
                      <span className="text-zinc-600">{l}:</span>
                      <span className={c as string}>{v}</span>
                    </div>
                  ))}
                </div>
                {/* Notes */}
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-2 space-y-0.5">
                  {stripCalcResult.notes.map((note, i) => (
                    <div key={i} className="text-[10px] text-amber-700/80 flex gap-1">
                      <span>•</span><span>{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enhanced Strip Width Calculator */}
      <div className="px-4 pb-3">
        <StripWidthCalculator />
      </div>

      {/* Drive System Calculator */}
      <div className="px-4 pb-3">
        <GearboxCalculator />
      </div>

      {/* Status messages */}
      {error && (
        <div className={`mx-4 mb-4 p-3 rounded-lg text-xs border flex items-start gap-2 ${
          error.startsWith("✅")
            ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
            : error.startsWith("⚠")
            ? "bg-amber-500/8 border-amber-500/20 text-amber-300"
            : "bg-red-500/8 border-red-500/20 text-red-300"
        }`}>
          <span className="flex-shrink-0 mt-0.5">{error.startsWith("✅") ? "✅" : error.startsWith("⚠") ? "⚠" : "✗"}</span>
          <span>{error.replace(/^(✅|⚠)\s*/, "")}</span>
        </div>
      )}

      {isLoading && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-blue-500/8 border border-blue-500/20 text-xs text-blue-300 text-center rt-loading flex items-center justify-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          Processing...
        </div>
      )}
    </div>
    </>
  );
}
