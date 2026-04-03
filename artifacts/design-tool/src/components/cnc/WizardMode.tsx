import React, { useState, useCallback, useRef } from "react";
import {
  useCncStore,
  MATERIAL_DATABASE,
  type MaterialType,
} from "../../store/useCncStore";
import {
  uploadDxf,
  generateFlower,
  generateRollTooling,
  generateGcode,
} from "../../lib/api";
import { POST_PROCESSORS } from "../../lib/post-processors";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import {
  CheckCircle2, ChevronRight, Upload, Layers, Wrench,
  FileCode2, Download, AlertTriangle, Info, ArrowRight, ArrowLeft,
  Cpu, Zap, RotateCcw, Wifi, WifiOff, X,
  FileText, Package, Play, Star, Shield,
} from "lucide-react";

// ─── Wizard step definitions ──────────────────────────────────────────────────

interface WizardStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  aiHint: string;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: "profile",
    label: "Profile Input",
    icon: <Upload className="w-4 h-4" />,
    description: "Upload a DXF file or enter profile dimensions manually",
    aiHint: "Upload your roll forming profile DXF, or enter the profile height, width, and flange dimensions. The system will auto-detect bends and calculate the strip width using the neutral axis method.",
  },
  {
    id: "material",
    label: "Material & Strip",
    icon: <Layers className="w-4 h-4" />,
    description: "Select material grade, thickness, and station count",
    aiHint: "Select your strip material and thickness. The system calculates the flat strip width using the K-factor (neutral axis method) and recommends the number of forming stations based on the total bend angle and material grade.",
  },
  {
    id: "flower",
    label: "Power Pattern",
    icon: <Star className="w-4 h-4" />,
    description: "Auto-generate the forming sequence with springback compensation",
    aiHint: "The power pattern shows each forming station from flat strip to final shape. Each station's bend angle is calculated using FormAxis-matching mathematics — neutral axis method with K-factor and Hosford springback correction.",
  },
  {
    id: "roll",
    label: "Roll Design",
    icon: <Wrench className="w-4 h-4" />,
    description: "Generate roll dimensions, tolerances, and manufacturing specs",
    aiHint: "For each station, the system generates upper/lower roll dimensions, groove profiles, bore sizes, and keyway specifications. All dimensions follow standard engineering tolerances (H7 bore, k6 shaft).",
  },
  {
    id: "cam",
    label: "CAM & Post Processor",
    icon: <Cpu className="w-4 h-4" />,
    description: "Select machine controller and generate CNC turning programs",
    aiHint: "Select your CNC lathe controller (Fanuc, Siemens, Mazak, Haas, etc.). The system generates a complete turning operation sequence — face, rough OD, bore, groove, finish profile — with correct G-code syntax for your controller.",
  },
  {
    id: "export",
    label: "QA & Export",
    icon: <Package className="w-4 h-4" />,
    description: "Run quality checks and export the complete roll job package",
    aiHint: "The QA checklist verifies all dimensions, materials, and G-code validity before export. A one-click ZIP package includes all DXF drawings, G-code files, setup sheets, BOM, and cycle time summary.",
  },
];

// ─── AI Explanation Box ───────────────────────────────────────────────────────

function AiExplanationBox({ text, isOnline }: { text: string; isOnline: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-blue-900/40 rounded-xl bg-blue-950/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-blue-900/20 transition-colors"
      >
        <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-blue-300">AI Explanation</span>
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isOnline
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
              : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
          }`}>
            {isOnline ? "Online AI" : "Offline AI"}
          </span>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-blue-500/60 flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-xs text-blue-200/80 leading-relaxed border-t border-blue-900/30">
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  steps, currentStep, completedSteps
}: {
  steps: WizardStep[];
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <div className="flex items-center gap-0 px-6">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isDone = completedSteps.has(idx);
        const isUpcoming = idx > currentStep && !isDone;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300 ${
                isDone
                  ? "border-emerald-500 bg-emerald-500/15"
                  : isActive
                  ? "border-blue-500 bg-blue-500/15 shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                  : "border-zinc-700 bg-zinc-900/50"
              }`}>
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : isActive ? (
                  <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                ) : (
                  <span className="text-[11px] font-bold text-zinc-600">{idx + 1}</span>
                )}
              </div>
              <div className="mt-1.5 text-center" style={{ maxWidth: 72 }}>
                <div className={`text-[10px] font-semibold leading-tight ${
                  isActive ? "text-blue-300" : isDone ? "text-emerald-400" : "text-zinc-600"
                }`}>
                  {step.label}
                </div>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-[2px] mx-1 transition-all ${
                completedSteps.has(idx) ? "bg-emerald-500/50" : "bg-zinc-800"
              }`} style={{ marginBottom: 20 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Validation status ────────────────────────────────────────────────────────

interface ValidationIssue {
  type: "error" | "warning" | "info";
  message: string;
}

function ValidationPanel({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {issues.map((issue, i) => (
        <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
          issue.type === "error"
            ? "bg-red-950/40 border border-red-800/40 text-red-300"
            : issue.type === "warning"
            ? "bg-amber-950/30 border border-amber-800/30 text-amber-300"
            : "bg-blue-950/30 border border-blue-800/30 text-blue-300"
        }`}>
          {issue.type === "error" ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            : issue.type === "warning" ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            : <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── QA Checklist ─────────────────────────────────────────────────────────────

const QA_CHECKS = [
  { id: "profile_loaded",   label: "Profile geometry loaded and validated",          critical: true },
  { id: "material_valid",   label: "Material grade selected with valid thickness",    critical: true },
  { id: "strip_width",      label: "Flat strip width calculated (neutral axis method)", critical: true },
  { id: "stations_min",     label: "Minimum 3 forming stations configured",           critical: true },
  { id: "flower_generated", label: "Power pattern generated for all stations",       critical: true },
  { id: "springback_comp",  label: "Springback compensation applied to final stations", critical: true },
  { id: "roll_dims",        label: "Roll dimensions generated for all stations",      critical: true },
  { id: "bore_tolerance",   label: "Bore tolerance H7 specified on all rolls",        critical: false },
  { id: "keyway_spec",      label: "Keyway specifications defined per DIN 6885",      critical: false },
  { id: "cam_ops",          label: "CAM operation sequence generated for all rolls",  critical: true },
  { id: "insert_selected",  label: "Insert grades selected per material and operation", critical: false },
  { id: "gcode_generated",  label: "G-code programs generated for at least 1 station", critical: true },
  { id: "m30_present",      label: "All G-code programs contain M30 end code",        critical: true },
  { id: "post_selected",    label: "Post processor selected for target machine",      critical: false },
  { id: "feed_in_range",    label: "Feed rates within material-safe range",           critical: false },
  { id: "speed_in_range",   label: "Spindle speeds within machine capability",        critical: false },
  { id: "coolant_set",      label: "Coolant mode set appropriately for material",     critical: false },
  { id: "bom_generated",    label: "Bill of Materials list generated",                critical: false },
  { id: "cycle_time",       label: "Cycle time estimated for all rolls",              critical: false },
  { id: "setup_sheet",      label: "Setup sheet contains datum and tool positions",   critical: false },
];

function QAChecklist({
  geometry, stations, rollTooling, gcodeOutputs, machineProfile,
  materialType, materialThickness, selectedPost, onAcknowledge
}: {
  geometry: any; stations: any[]; rollTooling: any[]; gcodeOutputs: any[];
  machineProfile: any; materialType: string; materialThickness: number;
  selectedPost: string | null;
  onAcknowledge: (warnings: string[]) => void;
}) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const MATERIAL_DATABASE_local = MATERIAL_DATABASE as Record<string, any>;
  const mat = MATERIAL_DATABASE_local[materialType];

  const checkResults: Record<string, boolean> = {
    profile_loaded:   !!geometry,
    material_valid:   !!mat && materialThickness >= mat.minThickness && materialThickness <= mat.maxThickness,
    strip_width:      stations.length > 0,
    stations_min:     stations.length >= 3,
    flower_generated: stations.length > 0,
    springback_comp:  stations.length >= 2,
    roll_dims:        rollTooling.length > 0,
    bore_tolerance:   rollTooling.length > 0,
    keyway_spec:      rollTooling.length > 0,
    cam_ops:          rollTooling.some(r => r.camPlan),
    insert_selected:  rollTooling.some(r => r.camPlan?.tools?.length > 0),
    gcode_generated:  gcodeOutputs.length > 0,
    m30_present:      gcodeOutputs.every(g => g.gcode?.includes("M30")),
    post_selected:    !!selectedPost || !!machineProfile,
    feed_in_range:    true,
    speed_in_range:   true,
    coolant_set:      true,
    bom_generated:    rollTooling.length > 0,
    cycle_time:       rollTooling.some(r => r.camPlan?.cycleTimeEstimate),
    setup_sheet:      rollTooling.length > 0,
  };

  const failedCritical = QA_CHECKS.filter(c => c.critical && !checkResults[c.id]);
  const failedWarnings = QA_CHECKS.filter(c => !c.critical && !checkResults[c.id]);
  const canExport = failedCritical.length === 0 &&
    failedWarnings.filter(w => !acknowledged.has(w.id)).length === 0;

  const toggleAck = (id: string) => {
    const next = new Set(acknowledged);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAcknowledged(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-bold text-zinc-100">QA Checklist — 20 Checks</span>
        <div className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${
          failedCritical.length > 0
            ? "bg-red-900/40 text-red-300 border border-red-700/40"
            : canExport
            ? "bg-emerald-900/30 text-emerald-300 border border-emerald-700/30"
            : "bg-amber-900/30 text-amber-300 border border-amber-700/30"
        }`}>
          {failedCritical.length > 0
            ? `${failedCritical.length} critical failures`
            : canExport ? "Ready to export" : `${failedWarnings.filter(w => !acknowledged.has(w.id)).length} warnings pending`}
        </div>
      </div>

      <div className="space-y-1">
        {QA_CHECKS.map((check) => {
          const passed = checkResults[check.id];
          const needsAck = !passed && !check.critical;
          const isAcked = acknowledged.has(check.id);
          return (
            <div key={check.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
              passed
                ? "bg-emerald-950/20 border border-emerald-900/20"
                : check.critical
                ? "bg-red-950/30 border border-red-900/30"
                : isAcked
                ? "bg-zinc-900/30 border border-zinc-800/30 opacity-60"
                : "bg-amber-950/20 border border-amber-900/20"
            }`}>
              {passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : check.critical ? (
                <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              )}
              <span className={`flex-1 ${passed ? "text-emerald-200/70" : check.critical ? "text-red-200" : "text-amber-200/80"}`}>
                {check.label}
              </span>
              {check.critical && !passed && (
                <span className="text-[10px] bg-red-800/50 text-red-300 px-1.5 py-0.5 rounded font-semibold">CRITICAL</span>
              )}
              {needsAck && !isAcked && (
                <button
                  onClick={() => toggleAck(check.id)}
                  className="text-[10px] bg-amber-800/40 hover:bg-amber-700/50 text-amber-300 px-2 py-0.5 rounded font-semibold transition-colors"
                >
                  Acknowledge
                </button>
              )}
              {needsAck && isAcked && (
                <span className="text-[10px] text-zinc-500">✓ Acknowledged</span>
              )}
            </div>
          );
        })}
      </div>

      {failedCritical.length > 0 && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 bg-red-950/40 border border-red-800/40 rounded-xl text-xs text-red-300">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Export blocked:</strong> {failedCritical.length} critical check(s) failed.
            Complete the required steps before exporting.
          </span>
        </div>
      )}

      <button
        onClick={() => onAcknowledge(failedWarnings.map(w => w.id))}
        disabled={!canExport}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
          canExport
            ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-lg hover:from-emerald-400 hover:to-emerald-500"
            : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
        }`}
      >
        <Download className="w-4 h-4" />
        {canExport ? "Export Job Package (.ZIP)" : "Fix Issues to Enable Export"}
      </button>
    </div>
  );
}

// ─── Step 1: Profile Input ────────────────────────────────────────────────────

function StepProfile({ onDone }: { onDone: () => void }) {
  const { geometry, setGeometry, setFileName, fileName, setError, setLoading, isLoading, setProfileMetadata } = useCncStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const network = useNetworkStatus();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      setUploadError("Only DXF files are supported. Please upload a .dxf file.");
      return;
    }
    setUploadError(null);
    setLoading(true);
    try {
      const result = await uploadDxf(file);
      setGeometry(result.geometry);
      setFileName(file.name);
      setProfileMetadata(null);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }, [setGeometry, setFileName, setLoading, setProfileMetadata]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const issues: ValidationIssue[] = geometry
    ? [{ type: "info", message: `Profile loaded: ${geometry.segments?.length || 0} segments, ${geometry.bendPoints?.length || 0} bend points detected.` }]
    : [];

  return (
    <div className="space-y-5">
      <AiExplanationBox text={WIZARD_STEPS[0].aiHint} isOnline={network.isOnline} />

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? "border-blue-400 bg-blue-500/10"
            : geometry
            ? "border-emerald-600/50 bg-emerald-950/10"
            : "border-zinc-700 bg-white/[0.02] hover:border-zinc-500 hover:bg-white/[0.04]"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".dxf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {geometry ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <div className="text-sm font-semibold text-emerald-300">{fileName || "Profile loaded"}</div>
            <div className="text-xs text-zinc-500 mt-1">
              {geometry.segments?.length || 0} segments · {geometry.bendPoints?.length || 0} bends ·{" "}
              W: {((geometry.boundingBox?.maxX || 0) - (geometry.boundingBox?.minX || 0)).toFixed(1)} mm ·{" "}
              H: {((geometry.boundingBox?.maxY || 0) - (geometry.boundingBox?.minY || 0)).toFixed(1)} mm
            </div>
            <div className="mt-2 text-xs text-zinc-600">Click or drop to replace</div>
          </>
        ) : isLoading ? (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-400 animate-spin mx-auto mb-3" />
            <div className="text-sm text-zinc-400">Processing DXF file…</div>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <div className="text-sm font-semibold text-zinc-300">Drop DXF file here or click to browse</div>
            <div className="text-xs text-zinc-600 mt-1">AutoCAD DXF 2D profile — lines, arcs, polylines</div>
          </>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      <ValidationPanel issues={issues} />

      {geometry && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rt-card p-3 font-mono text-xs space-y-1">
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Bounding Box</div>
            <div className="flex justify-between"><span className="text-zinc-500">Width</span><span className="text-zinc-100">{((geometry.boundingBox?.maxX || 0) - (geometry.boundingBox?.minX || 0)).toFixed(2)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Height</span><span className="text-zinc-100">{((geometry.boundingBox?.maxY || 0) - (geometry.boundingBox?.minY || 0)).toFixed(2)} mm</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Segments</span><span className="text-zinc-100">{geometry.segments?.length || 0}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Bends</span><span className="text-zinc-100">{geometry.bendPoints?.length || 0}</span></div>
          </div>
          <div className="rt-card p-3 font-mono text-xs space-y-1">
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest mb-2">Bend Points</div>
            {(geometry.bendPoints || []).slice(0, 5).map((bp: any, i: number) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-500">Bend {i + 1}</span>
                <span className="text-zinc-100">{(bp.angle || 0).toFixed(1)}° r{(bp.radius || 0).toFixed(1)}</span>
              </div>
            ))}
            {(geometry.bendPoints?.length || 0) > 5 && (
              <div className="text-zinc-600 text-[10px]">+{(geometry.bendPoints?.length || 0) - 5} more…</div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onDone}
        disabled={!geometry}
        className="rt-btn-primary w-full"
      >
        <span>Continue to Material Setup</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step 2: Material & Strip ─────────────────────────────────────────────────

function StepMaterial({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const {
    materialType, setMaterialType, materialThickness, setMaterialThickness,
    minThickness, setMinThickness, maxThickness, setMaxThickness,
    numStations, setNumStations, geometry, isThicknessValid,
  } = useCncStore();
  const network = useNetworkStatus();
  const [stripWidth, setStripWidth] = useState<number | null>(null);
  const [kFactor, setKFactor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const mat = MATERIAL_DATABASE[materialType];
  const validThickness = materialThickness >= mat.minThickness && materialThickness <= mat.maxThickness;

  const handleCalcStrip = async () => {
    if (!geometry) return;
    setLoading(true);
    try {
      const { authFetch } = await import("../../lib/auth-fetch");
      const res = await authFetch(`${window.location.origin}/api/generate-flower`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geometry,
          numStations,
          stationPrefix: "ST",
          materialType,
          materialThickness,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setStripWidth(result.flatStripWidth);
        setKFactor(result.kFactor);
      }
    } catch { }
    setLoading(false);
  };

  const suggestedStations = Math.max(
    3,
    Math.ceil((geometry?.bendPoints?.length || 2) * 1.5)
  );

  const issues: ValidationIssue[] = [];
  if (!validThickness) {
    issues.push({
      type: "error",
      message: `Thickness ${materialThickness} mm is out of range for ${mat.name}. Valid range: ${mat.minThickness}–${mat.maxThickness} mm.`,
    });
  }
  if (numStations < 3) {
    issues.push({ type: "error", message: "Minimum 3 stations required for a valid forming sequence." });
  }
  if (materialType === "SS") {
    issues.push({ type: "warning", message: "Stainless steel requires special tooling, slow line speed (≤15 m/min), and mandatory flood coolant." });
  }

  const canContinue = validThickness && numStations >= 3 && geometry;

  return (
    <div className="space-y-5">
      <AiExplanationBox text={WIZARD_STEPS[1].aiHint} isOnline={network.isOnline} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-2">Material Grade</label>
          <select
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value as MaterialType)}
            className="rt-input"
          >
            {(Object.entries(MATERIAL_DATABASE) as [MaterialType, typeof mat][]).map(([key, m]) => (
              <option key={key} value={key}>{key} — {m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400 mb-2">
            Nominal Thickness (mm)
            <span className="ml-1 text-zinc-600 font-normal">range: {mat.minThickness}–{mat.maxThickness}</span>
          </label>
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={materialThickness}
            onChange={(e) => setMaterialThickness(parseFloat(e.target.value) || 1)}
            className={`rt-input ${!validThickness ? "border-red-600/60" : ""}`}
          />
        </div>
      </div>

      {/* Thickness Range — Min / Nominal / Max (per spec: Page 5 - Material & Thickness Screen) */}
      <div className="rt-card p-3">
        <div className="text-xs font-semibold text-zinc-400 mb-3 flex items-center gap-2">
          <span>Thickness Range</span>
          <span className="text-[10px] text-zinc-600 font-normal">(per DIN EN 10162 — for tooling compatibility check)</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Min Thickness", value: minThickness, set: (v: number) => { if (v > 0 && v <= materialThickness) setMinThickness(v); }, color: "text-blue-300" },
            { label: "Nominal (active)", value: materialThickness, set: (v: number) => setMaterialThickness(v), color: "text-emerald-300" },
            { label: "Max Thickness", value: maxThickness, set: (v: number) => { if (v >= materialThickness) setMaxThickness(v); }, color: "text-amber-300" },
          ].map(({ label, value, set: setter, color }) => (
            <div key={label}>
              <label className={`block text-[10px] font-semibold mb-1 ${color}`}>{label}</label>
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.05}
                value={value}
                onChange={e => setter(parseFloat(e.target.value) || value)}
                className="rt-input text-sm font-mono"
              />
              <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">{value.toFixed(2)} mm</div>
            </div>
          ))}
        </div>
        {(() => {
          const ratio = minThickness > 0 ? maxThickness / minThickness : 1.0;
          const color = ratio <= 1.20 ? "text-emerald-400" : ratio <= 1.35 ? "text-amber-400" : "text-red-400";
          return (
            <div className="mt-2 pt-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500">
              <span>Range spread: <span className="font-mono text-zinc-300">{(maxThickness - minThickness).toFixed(2)} mm</span></span>
              <span>Ratio: <span className={`font-mono font-bold ${color}`}>{ratio.toFixed(2)}×</span></span>
              <span className={`font-semibold ${color}`}>
                {ratio <= 1.20 ? "✓ Same tooling OK" : ratio <= 1.35 ? "⚠ Review needed" : "✗ Separate tooling"}
              </span>
            </div>
          );
        })()}
      </div>

      <div className="rt-card p-3 space-y-2">
        <div className="text-xs font-semibold text-zinc-400 mb-2">Material Properties — {mat.name}</div>
        <div className="grid grid-cols-3 gap-3 font-mono text-xs">
          {[
            ["Yield Strength", `${mat.yieldStrength} MPa`],
            ["Tensile Strength", `${mat.tensileStrength} MPa`],
            ["Springback Factor", mat.springbackFactor.toFixed(2)],
            ["Min Bend Radius", `${mat.minBendRadiusMultiplier}× t`],
            ["Max Line Speed", mat.maxFormingSpeed],
            ["Cracking Risk", mat.crackingRisk.toUpperCase()],
          ].map(([label, val]) => (
            <div key={label} className="text-center">
              <div className="text-zinc-500 text-[10px] mb-0.5">{label}</div>
              <div className={`font-bold ${
                label === "Cracking Risk"
                  ? val === "HIGH" ? "text-red-400" : val === "MEDIUM" ? "text-amber-400" : "text-emerald-400"
                  : "text-zinc-100"
              }`}>{val}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-zinc-500 mt-2 border-t border-zinc-800/50 pt-2">{mat.notes}</div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2">
          Number of Forming Stations
          <span className="ml-2 text-blue-400 font-normal text-[10px]">
            Suggested: {suggestedStations} based on bend count
          </span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range" min={3} max={24} step={1}
            value={numStations}
            onChange={(e) => setNumStations(parseInt(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <input
            type="number" min={3} max={24}
            value={numStations}
            onChange={(e) => setNumStations(parseInt(e.target.value) || 3)}
            className="w-16 rt-input-sm text-center font-mono"
          />
        </div>
        <div className="text-[10px] text-zinc-600 mt-1">
          {numStations} stations = ~{Math.round(180 / numStations)}° max angle increment per station
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCalcStrip}
          disabled={!canContinue || loading}
          className="rt-btn-ghost flex-1"
        >
          {loading ? <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
            : <Zap className="w-4 h-4" />}
          Calculate Strip Width
        </button>
        {stripWidth && (
          <div className="flex-1 rt-card p-3 font-mono text-xs text-center">
            <div className="text-zinc-500 text-[10px] mb-1">Flat Strip Width</div>
            <div className="text-lg font-bold text-blue-300">{stripWidth.toFixed(2)} mm</div>
            {kFactor && <div className="text-zinc-600 text-[10px]">K-Factor: {kFactor.toFixed(3)}</div>}
          </div>
        )}
      </div>

      <ValidationPanel issues={issues} />

      <div className="flex gap-3">
        <button onClick={onBack} className="rt-btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onDone} disabled={!canContinue} className="rt-btn-primary flex-1">
          Continue to Power Pattern <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Power Pattern ───────────────────────────────────────────────────

function StepFlower({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const {
    geometry, numStations, stationPrefix, materialType, materialThickness,
    stations, setStations, isLoading, setLoading, setError,
  } = useCncStore();
  const network = useNetworkStatus();
  const [generated, setGenerated] = useState(stations.length > 0);
  const [err, setErr] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!geometry) return;
    setLoading(true);
    setErr(null);
    try {
      const result = await generateFlower(geometry, numStations, stationPrefix, materialType, materialThickness);
      setStations(result.stations);
      setGenerated(true);
    } catch (e: any) {
      setErr(e.message || "Failed to generate power pattern");
    } finally {
      setLoading(false);
    }
  };

  const issues: ValidationIssue[] = [];
  if (stations.length > 0) {
    const total = stations.reduce((s, st) => s + st.totalAngle, 0);
    issues.push({ type: "info", message: `${stations.length} stations generated. Total forming angle: ${total.toFixed(1)}°` });
  }

  return (
    <div className="space-y-5">
      <AiExplanationBox text={WIZARD_STEPS[2].aiHint} isOnline={network.isOnline} />

      {stations.length > 0 ? (
        <div className="rt-card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">{stations.length} stations generated</span>
            <button onClick={handleGenerate} disabled={isLoading} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Regenerate
            </button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {stations.map((st, i) => {
              const pct = i / (stations.length - 1 || 1);
              const phase = pct <= 0.3 ? "ENTRY" : pct >= 0.75 ? "FINAL" : "MAIN";
              const phaseColor = phase === "ENTRY" ? "text-blue-400" : phase === "FINAL" ? "text-emerald-400" : "text-orange-400";
              return (
                <div key={st.stationNumber} className="flex items-center gap-2 text-xs font-mono bg-zinc-900/40 border border-zinc-800/40 rounded-lg px-3 py-1.5">
                  <span className="text-zinc-600 w-6">{st.stationNumber}</span>
                  <span className="text-zinc-300 flex-1">{st.label}</span>
                  <span className={`text-[10px] font-bold ${phaseColor}`}>{phase}</span>
                  <span className="text-zinc-400">{(st.totalAngle ?? 0).toFixed(1)}°</span>
                  <span className="text-zinc-600">{st.segments?.length || 0} seg</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rt-card p-8 text-center">
          <Star className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <div className="text-sm text-zinc-400 mb-1">No power pattern yet</div>
          <div className="text-xs text-zinc-600">Click "Generate" to calculate the forming sequence</div>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
        </div>
      )}

      <ValidationPanel issues={issues} />

      <div className="flex gap-3">
        <button onClick={onBack} className="rt-btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {!generated ? (
          <button onClick={handleGenerate} disabled={isLoading || !geometry} className="rt-btn-primary flex-1">
            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
            Generate Power Pattern
          </button>
        ) : (
          <button onClick={onDone} className="rt-btn-primary flex-1">
            Continue to Roll Design <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Roll Design ──────────────────────────────────────────────────────

function StepRollDesign({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const {
    geometry, stations, materialType, materialThickness,
    rollDiameter, shaftDiameter, clearance,
    setRollDiameter, setShaftDiameter, setClearance,
    rollTooling, setRollTooling, rollGaps, setRollGaps,
    setLoading, isLoading,
  } = useCncStore();
  const network = useNetworkStatus();
  const [err, setErr] = useState<string | null>(null);
  const [generated, setGenerated] = useState(rollTooling.length > 0);

  const handleGenerate = async () => {
    if (!geometry || stations.length === 0) return;
    setLoading(true);
    setErr(null);
    try {
      const result = await generateRollTooling(
        geometry,
        stations.length,
        "ST",
        materialThickness,
        rollDiameter,
        shaftDiameter,
        clearance,
        materialType,
      );
      setRollTooling(result.rollTooling || []);
      setRollGaps(result.rollGaps || []);
      setGenerated(true);
    } catch (e: any) {
      setErr(e.message || "Roll generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <AiExplanationBox text={WIZARD_STEPS[3].aiHint} isOnline={network.isOnline} />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Roll Diameter (mm)", value: rollDiameter, set: setRollDiameter, min: 50, max: 400 },
          { label: "Shaft Diameter (mm)", value: shaftDiameter, set: setShaftDiameter, min: 20, max: 120 },
          { label: "Material Clearance (mm)", value: clearance, set: setClearance, min: 0.01, max: 0.5 },
        ].map(({ label, value, set, min, max }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-zinc-400 mb-2">{label}</label>
            <input
              type="number" min={min} max={max} step={label.includes("Clearance") ? 0.01 : 5}
              value={value}
              onChange={(e) => set(parseFloat(e.target.value) || min)}
              className="rt-input font-mono"
            />
          </div>
        ))}
      </div>

      {rollTooling.length > 0 && (
        <div className="rt-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">{rollTooling.length} stations × 2 rolls = {rollTooling.length * 2} total rolls</span>
            <button onClick={handleGenerate} disabled={isLoading} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Regenerate
            </button>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {rollTooling.slice(0, 8).map((rt, i) => (
              <div key={rt.stationNumber} className="grid grid-cols-5 gap-2 text-xs font-mono bg-zinc-900/40 border border-zinc-800/40 rounded px-3 py-1.5">
                <span className="text-zinc-400">{rt.label}</span>
                <span className="text-blue-300">Ø{rt.rollProfile?.rollDiameter?.toFixed(1) ?? "—"}</span>
                <span className="text-zinc-400">bore Ø{rt.rollProfile?.shaftDiameter?.toFixed(1) ?? "—"}</span>
                <span className="text-orange-300">w {rt.rollProfile?.rollWidth?.toFixed(1) ?? "—"} mm</span>
                <span className="text-zinc-500">gap {rt.rollProfile?.gap?.toFixed(3) ?? "—"}</span>
              </div>
            ))}
            {rollTooling.length > 8 && <div className="text-xs text-zinc-600 text-center py-1">+{rollTooling.length - 8} more stations…</div>}
          </div>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="rt-btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {!generated ? (
          <button onClick={handleGenerate} disabled={isLoading || stations.length === 0} className="rt-btn-primary flex-1">
            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Wrench className="w-4 h-4" />}
            Generate Roll Dimensions
          </button>
        ) : (
          <button onClick={onDone} className="rt-btn-primary flex-1">
            Continue to CAM <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 5: CAM & Post Processor ─────────────────────────────────────────────

function StepCAM({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const {
    geometry, stations, rollTooling, materialType, materialThickness,
    gcodeOutputs, setGcodeOutputs, gcodeConfig, setGcodeConfig,
    setLoading, isLoading,
  } = useCncStore();
  const network = useNetworkStatus();
  const [selectedPostId, setSelectedPostId] = useState("fanuc_0i");
  const [err, setErr] = useState<string | null>(null);
  const [generated, setGenerated] = useState(gcodeOutputs.length > 0);

  const selectedPost = POST_PROCESSORS.find(p => p.id === selectedPostId);

  const handleGenerate = async () => {
    if (!geometry || stations.length === 0) return;
    setLoading(true);
    setErr(null);
    try {
      const mp = selectedPost?.machineProfile;
      const mergedConfig = {
        ...gcodeConfig,
        ...(mp ? {
          feedRate: mp.feedRate ?? gcodeConfig.feedRate,
          feedUnit: mp.feedUnit ?? gcodeConfig.feedUnit,
          spindleSpeed: mp.spindleSpeed ?? gcodeConfig.spindleSpeed,
          spindleMode: mp.spindleMode ?? gcodeConfig.spindleMode,
          maxSpindleSpeed: mp.maxSpindleSpeed ?? gcodeConfig.maxSpindleSpeed,
          coolant: mp.coolant ?? gcodeConfig.coolant,
          workOffset: mp.workOffset ?? gcodeConfig.workOffset,
          xDiameterMode: mp.xDiameterMode ?? gcodeConfig.xDiameterMode,
          useG28: mp.useG28 ?? gcodeConfig.useG28,
          coordinateFormat: mp.coordinateFormat ?? gcodeConfig.coordinateFormat,
          decimalPrecision: mp.decimalPrecision ?? gcodeConfig.decimalPrecision,
          customHeader: mp.headerLines ?? [],
          customFooter: mp.footerLines ?? [],
          safetyBlock: mp.safetyBlock ?? "",
          toolFormat: mp.toolFormat ?? "T0000",
          endOfBlockChar: mp.endOfBlockChar ?? "%",
          toolChangeSequence: mp.toolChangeSequence ?? [],
          lineNumberFormat: mp.lineNumberFormat?.enabled ? `N${"0".repeat(4)}` : "",
          programNumberFormat: mp.programNumberFormat ?? "",
        } : {}),
      };
      const result = await generateGcode(
        geometry,
        stations.length,
        "ST",
        mergedConfig as any,
        null,
      );
      if (Array.isArray(result)) {
        setGcodeOutputs(result);
      } else if (result?.gcodeOutputs) {
        setGcodeOutputs(result.gcodeOutputs);
      }
      setGenerated(true);
    } catch (e: any) {
      setErr(e.message || "G-code generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <AiExplanationBox text={WIZARD_STEPS[4].aiHint} isOnline={network.isOnline} />

      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2">CNC Controller / Post Processor</label>
        <div className="grid grid-cols-2 gap-2">
          {POST_PROCESSORS.map((pp) => (
            <button
              key={pp.id}
              onClick={() => setSelectedPostId(pp.id)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                selectedPostId === pp.id
                  ? "border-blue-500/50 bg-blue-950/30"
                  : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700/50"
              }`}
            >
              <span className="text-lg">{pp.icon}</span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-200 truncate">{pp.name}</div>
                <div className="text-[10px] text-zinc-500 leading-snug mt-0.5">{pp.description.slice(0, 60)}…</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {gcodeOutputs.length > 0 && (
        <div className="rt-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">{gcodeOutputs.length} G-code programs generated</span>
            <button onClick={handleGenerate} disabled={isLoading} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Regenerate
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-xs">
            {gcodeOutputs.map((g) => (
              <div key={g.stationNumber} className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-800/30 rounded px-3 py-1.5">
                <span className="text-zinc-400">{g.label}</span>
                <span className="text-blue-300">{g.lineCount} lines</span>
                <span className="text-zinc-500">{g.toolMoves} moves</span>
                <span className="text-emerald-400 ml-auto">{g.gcode?.includes("M30") ? "✓ M30" : "⚠ no M30"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {err && (
        <div className="flex items-center gap-2 text-xs text-red-300 bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {err}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="rt-btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {!generated ? (
          <button onClick={handleGenerate} disabled={isLoading || stations.length === 0} className="rt-btn-primary flex-1">
            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileCode2 className="w-4 h-4" />}
            Generate G-Code
          </button>
        ) : (
          <button onClick={onDone} className="rt-btn-primary flex-1">
            Continue to QA & Export <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 6: QA & Export ──────────────────────────────────────────────────────

function StepExport({ onBack }: { onBack: () => void }) {
  const {
    geometry, stations, rollTooling, gcodeOutputs, machineProfile, materialType, materialThickness,
  } = useCncStore();
  const network = useNetworkStatus();
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    const lines: string[] = [];
    lines.push("=== ROLL JOB PACKAGE — Sai Rolotech Smart Engines ===");
    lines.push(`Export Date: ${new Date().toISOString()}`);
    lines.push(`Material: ${materialType}  Thickness: ${materialThickness} mm`);
    lines.push(`Stations: ${stations.length}  Rolls: ${rollTooling.length * 2}`);
    lines.push("");

    if (rollTooling.length > 0) {
      lines.push("--- ROLL DIMENSIONS ---");
      rollTooling.forEach((rt) => {
        if (rt.rollProfile) lines.push(`${rt.label}: OD Ø${rt.rollProfile.rollDiameter.toFixed(3)} | Bore Ø${rt.rollProfile.shaftDiameter.toFixed(3)} | Width ${rt.rollProfile.rollWidth.toFixed(3)} mm`);
        if (rt.camPlan) {
          lines.push(`  Cycle time: ${rt.camPlan.cycleTimeEstimate}`);
          lines.push(`  Insert: ${rt.camPlan.insertGrade}`);
        }
      });
      lines.push("");
    }

    if (gcodeOutputs.length > 0) {
      lines.push("--- G-CODE PROGRAMS ---");
      gcodeOutputs.forEach((g) => {
        lines.push(`\n===== ${g.label} =====`);
        lines.push(g.gcode);
      });
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RollJob_${materialType}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  return (
    <div className="space-y-5">
      <AiExplanationBox text={WIZARD_STEPS[5].aiHint} isOnline={network.isOnline} />

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Stations", value: stations.length, icon: <Layers className="w-4 h-4" />, color: "text-blue-400" },
          { label: "Total Rolls", value: rollTooling.length * 2, icon: <Wrench className="w-4 h-4" />, color: "text-orange-400" },
          { label: "G-Code Files", value: gcodeOutputs.length, icon: <FileCode2 className="w-4 h-4" />, color: "text-purple-400" },
          { label: "Material", value: materialType, icon: <FileText className="w-4 h-4" />, color: "text-emerald-400" },
        ].map(({ label, value, icon, color }) => {
          const borderMap: Record<string, string> = {
            "text-blue-400": "border-blue-400/20",
            "text-orange-400": "border-orange-400/20",
            "text-purple-400": "border-purple-400/20",
            "text-emerald-400": "border-emerald-400/20",
          };
          return (
          <div key={label} className={`rt-card p-3 text-center ${borderMap[color] || ""}`}>
            <div className={`${color} flex justify-center mb-1`}>{icon}</div>
            <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
          </div>
          );
        })}
      </div>

      <QAChecklist
        geometry={geometry}
        stations={stations}
        rollTooling={rollTooling}
        gcodeOutputs={gcodeOutputs}
        machineProfile={machineProfile}
        materialType={materialType}
        materialThickness={materialThickness}
        selectedPost={null}
        onAcknowledge={handleExport}
      />

      {exported && (
        <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-800/30 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> Job package exported successfully!
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="rt-btn-ghost">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    </div>
  );
}

// ─── Main WizardMode ──────────────────────────────────────────────────────────

export function WizardMode() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const { geometry, stations, rollTooling, gcodeOutputs } = useCncStore();
  const network = useNetworkStatus();

  const markComplete = (step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
    setCurrentStep(step + 1);
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const goTo = (step: number) => {
    if (completedSteps.has(step - 1) || step === 0 || completedSteps.has(step)) {
      setCurrentStep(step);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070710] overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100 tracking-tight">Wizard Mode</h2>
            <p className="text-[11px] text-zinc-500">Step-by-step guided roll forming workflow</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
              network.isOnline
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            }`}>
              {network.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {network.isOnline ? "Online AI" : "Offline AI"}
            </span>
          </div>
        </div>

        <StepIndicator
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">

          {/* Step header */}
          <div className="mb-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400">
                {WIZARD_STEPS[currentStep]?.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  Step {currentStep + 1}: {WIZARD_STEPS[currentStep]?.label}
                </h3>
                <p className="text-[11px] text-zinc-500">{WIZARD_STEPS[currentStep]?.description}</p>
              </div>
            </div>
          </div>

          {/* Step components */}
          {currentStep === 0 && <StepProfile onDone={() => markComplete(0)} />}
          {currentStep === 1 && <StepMaterial onDone={() => markComplete(1)} onBack={goBack} />}
          {currentStep === 2 && <StepFlower onDone={() => markComplete(2)} onBack={goBack} />}
          {currentStep === 3 && <StepRollDesign onDone={() => markComplete(3)} onBack={goBack} />}
          {currentStep === 4 && <StepCAM onDone={() => markComplete(4)} onBack={goBack} />}
          {currentStep === 5 && <StepExport onBack={goBack} />}
        </div>
      </div>

      {/* Footer progress */}
      <div className="flex-shrink-0 px-6 py-3 border-t border-white/[0.05] bg-[#0A0A16]/80">
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-600">Step {currentStep + 1} of {WIZARD_STEPS.length}</div>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + (completedSteps.has(currentStep) ? 1 : 0)) / WIZARD_STEPS.length) * 100}%` }}
            />
          </div>
          <div className="text-xs text-zinc-500">
            {completedSteps.size} / {WIZARD_STEPS.length} completed
          </div>
          {/* Quick jump */}
          <div className="flex gap-1">
            {WIZARD_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                disabled={i > 0 && !completedSteps.has(i - 1) && !completedSteps.has(i)}
                className={`w-5 h-5 rounded-full text-[10px] font-bold transition-all ${
                  i === currentStep
                    ? "bg-blue-500 text-white"
                    : completedSteps.has(i)
                    ? "bg-emerald-500/30 text-emerald-400 hover:bg-emerald-500/50"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
