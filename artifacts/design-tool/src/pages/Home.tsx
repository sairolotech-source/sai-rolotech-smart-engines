import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useCncStore, type AppTab } from "../store/useCncStore";
import { useAuthStore } from "../store/useAuthStore";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PanelShimmer } from "../components/ShimmerLoader";
import { toast } from "../hooks/use-toast";
import { useAutoAIMode } from "../hooks/useAutoAIMode";
import { AutoAIModePanel } from "../components/AutoAIModePanel";
import { PersonalAIKeyModal } from "../components/PersonalAIKeyModal";
import { usePersonalAIKey } from "../hooks/usePersonalAIKey";
import {
  Settings, Flower, Wrench, FileCode2, AlertTriangle,
  Save, BookOpen, History, LogOut, ChevronDown, CheckCircle2, Cpu,
  Wifi, WifiOff, LayoutDashboard, Cloud, Box, GraduationCap, Package, Clapperboard, PenLine, Zap, RefreshCw,
  Cog, Monitor, HardDrive, Info, ArrowLeft, Keyboard, FileText, ClipboardList,
  Activity, RotateCcw, Ruler, Target, DollarSign,
  ArrowLeftRight, Database, Flame, ChevronRight, Layers, Brain, Download,
  Circle, Triangle, Wand2, Table, Minus, ScanLine, FolderTree,
  TrendingDown, TrendingUp, ShieldCheck, Shield, Hexagon, Trophy, PlayCircle, Layers2,
  Gauge, Crosshair, Eye, Key,
} from "lucide-react";

const LeftPanel = lazy(() => import("../components/cnc/LeftPanel").then(m => ({ default: m.LeftPanel })));
const ProfileCanvas = lazy(() => import("../components/cnc/ProfileCanvas").then(m => ({ default: m.ProfileCanvas })));
const RightPanel = lazy(() => import("../components/cnc/RightPanel").then(m => ({ default: m.RightPanel })));
const ToolpathSimulator = lazy(() => import("../components/cnc/ToolpathSimulator").then(m => ({ default: m.ToolpathSimulator })));
const Troubleshooting = lazy(() => import("../components/cnc/Troubleshooting").then(m => ({ default: m.Troubleshooting })));
const RollToolingView = lazy(() => import("../components/cnc/RollToolingView").then(m => ({ default: m.RollToolingView })));
const FlowerPatternView = lazy(() => import("../components/cnc/FlowerPatternView").then(m => ({ default: m.FlowerPatternView })));
const DigitalTwinView = lazy(() => import("../components/cnc/DigitalTwinView").then(m => ({ default: m.DigitalTwinView })));
const TurningView = lazy(() => import("../components/cnc/TurningView").then(m => ({ default: m.TurningView })));
const GeometryEditPanel = lazy(() => import("../components/cnc/GeometryEditPanel").then(m => ({ default: m.GeometryEditPanel })));
const TurnAxisCAMOperationsView = lazy(() => import("../components/cnc/TurnAxisCAMOperationsView").then(m => ({ default: m.TurnAxisCAMOperationsView })));
const MillingOperationsView = lazy(() => import("../components/cnc/MillingOperationsView").then(m => ({ default: m.MillingOperationsView })));
const FiveAxisCAMPanel = lazy(() => import("../components/cnc/FiveAxisCAMPanel").then(m => ({ default: m.FiveAxisCAMPanel })));
const OfflineAIView = lazy(() => import("../components/cnc/OfflineAIView").then(m => ({ default: m.OfflineAIView })));
const ProfileLibrary = lazy(() => import("../components/cnc/ProfileLibrary").then(m => ({ default: m.ProfileLibrary })));
const DesignHistory = lazy(() => import("../components/cnc/DesignHistory").then(m => ({ default: m.DesignHistory })));
const SaveProjectModal = lazy(() => import("../components/cnc/SaveProjectModal").then(m => ({ default: m.SaveProjectModal })));
const FactoryAIView = lazy(() => import("../components/cnc/FactoryAIView").then(m => ({ default: m.FactoryAIView })));
const UltraDashboard = lazy(() => import("../components/ultra-dashboard/UltraDashboard").then(m => ({ default: m.UltraDashboard })));
const GoogleDrivePanel = lazy(() => import("../components/cnc/GoogleDrivePanel").then(m => ({ default: m.GoogleDrivePanel })));
const SystemInfoPanel = lazy(() => import("../components/cnc/SystemInfoPanel").then(m => ({ default: m.SystemInfoPanel })));
const Studio3DView = lazy(() => import("../components/studio3d/Studio3DView").then(m => ({ default: m.Studio3DView })));
const WizardMode = lazy(() => import("../components/cnc/WizardMode").then(m => ({ default: m.WizardMode })));
const JobPackageExport = lazy(() => import("../components/cnc/JobPackageExport").then(m => ({ default: m.JobPackageExport })));
const ManualDrawingView = lazy(() => import("../components/manual-drawing/ManualDrawingView").then(m => ({ default: m.ManualDrawingView })));
const LoadCalculator = lazy(() => import("../components/cnc/LoadCalculator").then(m => ({ default: m.LoadCalculator })));
const DesignReportGenerator = lazy(() => import("../components/cnc/DesignReportGenerator").then(m => ({ default: m.DesignReportGenerator })));
const GuardrailReportGenerator = lazy(() => import("../components/cnc/GuardrailReportGenerator").then(m => ({ default: m.GuardrailReportGenerator })));
const ExportHistoryPanel = lazy(() => import("../components/cnc/ExportHistoryPanel").then(m => ({ default: m.ExportHistoryPanel })));
const AIChatbotsView = lazy(() => import("../components/cnc/AIChatbotsView").then(m => ({ default: m.AIChatbotsView })));
const DrawingVisionView = lazy(() => import("../components/cnc/DrawingVisionView").then(m => ({ default: m.DrawingVisionView })));
const FormingSimulationView = lazy(() => import("../components/cnc/FormingSimulationView").then(m => ({ default: m.FormingSimulationView })));
const SpringbackView = lazy(() => import("../components/cnc/SpringbackView").then(m => ({ default: m.SpringbackView })));
const StripWidthView = lazy(() => import("../components/cnc/StripWidthView").then(m => ({ default: m.StripWidthView })));
const RollGapView = lazy(() => import("../components/cnc/RollGapView").then(m => ({ default: m.RollGapView })));
const CostEstimatorView = lazy(() => import("../components/cnc/CostEstimatorView").then(m => ({ default: m.CostEstimatorView })));
const CamberPredictionView = lazy(() => import("../components/cnc/CamberPredictionView").then(m => ({ default: m.CamberPredictionView })));
const MaterialDatabaseView = lazy(() => import("../components/cnc/MaterialDatabaseView").then(m => ({ default: m.MaterialDatabaseView })));
const FormingEnergyView = lazy(() => import("../components/cnc/FormingEnergyView").then(m => ({ default: m.FormingEnergyView })));
const SpecificationSheet = lazy(() => import("../components/cnc/SpecificationSheet").then(m => ({ default: m.SpecificationSheet })));
const RFTubesView = lazy(() => import("../components/cnc/RFTubesView").then(m => ({ default: m.RFTubesView })));
const RFTrapezeView = lazy(() => import("../components/cnc/RFTrapezeView").then(m => ({ default: m.RFTrapezeView })));
const SmartRollsView = lazy(() => import("../components/cnc/SmartRollsView").then(m => ({ default: m.SmartRollsView })));
const RFDTMView = lazy(() => import("../components/cnc/RFDTMView").then(m => ({ default: m.RFDTMView })));
const RFSpreadsheetView = lazy(() => import("../components/cnc/RFSpreadsheetView").then(m => ({ default: m.RFSpreadsheetView })));
const DrawingDiesView = lazy(() => import("../components/cnc/DrawingDiesView").then(m => ({ default: m.DrawingDiesView })));
const CageFormingView = lazy(() => import("../components/cnc/CageFormingView").then(m => ({ default: m.CageFormingView })));
const WireRollingView = lazy(() => import("../components/cnc/WireRollingView").then(m => ({ default: m.WireRollingView })));
const ProfileScanView = lazy(() => import("../components/cnc/ProfileScanView").then(m => ({ default: m.ProfileScanView })));
const RollScannerView = lazy(() => import("../components/cnc/RollScannerView").then(m => ({ default: m.RollScannerView })));
const RollLifecycleView = lazy(() => import("../components/cnc/RollLifecycleView").then(m => ({ default: m.RollLifecycleView })));
const CADFinderView = lazy(() => import("../components/cnc/CADFinderView").then(m => ({ default: m.CADFinderView })));
const DownhillFormingView = lazy(() => import("../components/cnc/DownhillFormingView").then(m => ({ default: m.DownhillFormingView })));
const AssemblyCheckView = lazy(() => import("../components/cnc/AssemblyCheckView").then(m => ({ default: m.AssemblyCheckView })));
const ToolLibraryView = lazy(() => import("../components/cnc/ToolLibraryView").then(m => ({ default: m.ToolLibraryView })));
const FormAxisComparisonView = lazy(() => import("../components/cnc/FormAxisComparisonView").then(m => ({ default: m.FormAxisComparisonView })));
const RFClosedSectionView = lazy(() => import("../components/cnc/RFClosedSectionView").then(m => ({ default: m.RFClosedSectionView })));
const DesktopInstallView = lazy(() => import("../components/cnc/DesktopInstallView").then(m => ({ default: m.DesktopInstallView })));
const SystemSetupPanel = lazy(() => import("../components/setup/SystemSetupPanel"));
const RealMukablaView = lazy(() => import("../components/cnc/RealMukablaView").then(m => ({ default: m.RealMukablaView })));
const FEASimulationView = lazy(() => import("../components/cnc/FEASimulationView").then(m => ({ default: m.FEASimulationView })));
const GCodeVerificationView = lazy(() => import("../components/cnc/GCodeVerificationView").then(m => ({ default: m.GCodeVerificationView })));
const AdvancedCAMView = lazy(() => import("../components/cnc/AdvancedCAMView").then(m => ({ default: m.AdvancedCAMView })));
const ERPIntegrationView = lazy(() => import("../components/cnc/ERPIntegrationView").then(m => ({ default: m.ERPIntegrationView })));
const DXFImportView = lazy(() => import("../components/cnc/DXFImportView").then(m => ({ default: m.DXFImportView })));
const GCodeSimulatorView = lazy(() => import("../components/cnc/GCodeSimulatorView").then(m => ({ default: m.GCodeSimulatorView })));
const ProLatheSimulator = lazy(() => import("../components/cnc/ProLatheSimulator").then(m => ({ default: m.ProLatheSimulator })));
const RollToolingCalculator = lazy(() => import("../components/cnc/RollToolingCalculator").then(m => ({ default: m.RollToolingCalculator })));
const RollBlankCalculator = lazy(() => import("../components/cnc/RollBlankCalculator").then(m => ({ default: m.RollBlankCalculator })));
const RollCuttingSafetyCalc = lazy(() => import("../components/cnc/RollCuttingSafetyCalc").then(m => ({ default: m.RollCuttingSafetyCalc })));
const RollToolCollisionCalc = lazy(() => import("../components/cnc/RollToolCollisionCalc").then(m => ({ default: m.RollToolCollisionCalc })));
const SolidCAMToolDB = lazy(() => import("../components/cnc/SolidCAMToolDB").then(m => ({ default: m.SolidCAMToolDB })));
const RollFlowerDesignerView = lazy(() => import("../components/cnc/RollFlowerDesignerView").then(m => ({ default: m.RollFlowerDesignerView })));
const MaterialAnalyzerView = lazy(() => import("../components/cnc/MaterialAnalyzerView").then(m => ({ default: m.MaterialAnalyzerView })));
const SheetMetalView = lazy(() => import("../components/cnc/SheetMetalView").then(m => ({ default: m.SheetMetalView })));
const StationControlPanel = lazy(() => import("../components/station-control/StationControlPanel").then(m => ({ default: m.StationControlPanel })));
const AutoBackupPanel = lazy(() => import("../components/backup/AutoBackupPanel").then(m => ({ default: m.AutoBackupPanel })));
const DemoCChannelPanel = lazy(() => import("../components/demo/DemoCChannelPanel").then(m => ({ default: m.DemoCChannelPanel })));
const TestingEngineView = lazy(() => import("../components/cnc/TestingEngineView").then(m => ({ default: m.TestingEngineView })));
const RollFormingMachineView = lazy(() => import("../components/cnc/RollFormingMachineView").then(m => ({ default: m.RollFormingMachineView })));
const ValidationPipelinePanel = lazy(() => import("../components/cnc/ValidationPipelinePanel").then(m => ({ default: m.ValidationPipelinePanel })));
const MachineBOMPanel = lazy(() => import("../components/cnc/MachineBOMPanel").then(m => ({ default: m.MachineBOMPanel })));
const FlowerPattern3DView = lazy(() => import("../components/cnc/FlowerPattern3DView").then(m => ({ default: m.FlowerPattern3DView })));
const RollToolingExportPanel = lazy(() => import("../components/cnc/RollToolingExportPanel").then(m => ({ default: m.RollToolingExportPanel })));
const AdminDashboard3D = lazy(() => import("../components/cnc/AdminDashboard3D").then(m => ({ default: m.AdminDashboard3D })));
const MasterDesignerChatbot = lazy(() => import("../components/cnc/MasterDesignerChatbot").then(m => ({ default: m.MasterDesignerChatbot })));
const SectionModelSelector = lazy(() => import("../components/cnc/SectionModelSelector").then(m => ({ default: m.SectionModelSelector })));
const DimensionConfirmationPanel = lazy(() => import("../components/cnc/DimensionConfirmationPanel").then(m => ({ default: m.DimensionConfirmationPanel })));

function LazyFallback() {
  return <PanelShimmer />;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  tools: { id: AppTab | string; label: string; icon: React.ReactNode; desc: string; action?: () => void }[];
}

const TAB_TO_CAT: Record<string, string> = {
  setup: "design", "manual-drawing": "design", flower: "design", roll: "design", specs: "design",
  "smart-rolls": "design", "rf-spreadsheet": "design", "downhill-forming": "design", "assembly-check": "design",
  gcode: "manufacturing", turner: "manufacturing", "geometry-edit": "manufacturing", "cam-operations": "manufacturing", "milling-operations": "manufacturing", "5axis-cam": "manufacturing", "load-calc": "manufacturing", "tool-library": "manufacturing",
  "forming-sim": "analysis", springback: "analysis", "strip-width": "analysis",
  "roll-gap": "analysis", "cost-estimator": "analysis", camber: "analysis",
  "forming-energy": "analysis", "material-db": "analysis", "rf-dtm": "analysis",
  twin: "simulation", studio3d: "simulation",
  "rf-tubes": "formaxis-modules", "rf-trapeze": "formaxis-modules", "drawing-dies": "formaxis-modules",
  "cage-forming": "formaxis-modules", "wire-rolling": "formaxis-modules",
  "rf-closed-section": "formaxis-modules", "formaxis-compare": "formaxis-modules", "sheet-metal": "formaxis-modules",
  "profile-scan": "quality", "roll-scanner": "quality", "roll-lifecycle": "quality", "cad-finder": "quality",
  "drawing-vision": "ai", troubleshoot: "ai", factory: "ai", ultra: "ai", wizard: "ai", "ai-chatbots": "ai", "offline-ai": "ai",
  "master-designer": "ai", "admin-dashboard": "ai", "desktop-install": "ai", "real-mukabla": "ai",
  "fea-simulation": "ai", "gcode-verify": "ai", "advanced-cam": "ai", "erp-integration": "ai",
  "dxf-import": "ai", "gcode-simulator": "ai", "roll-flower-designer": "ai", "material-analyzer": "ai",
  "station-control": "ai", "rf-machine": "simulation",
  "validation-pipeline": "quality", "testing-engine": "quality", "machine-bom": "quality", "dimension-confirm": "design",
  "flower-3d": "simulation", "roll-export": "manufacturing",
  report: "project",
};

interface HomeProps {
  onBackToDashboard?: () => void;
}

// Tabs that require validation pipeline approval before proceeding
// These tabs represent final outputs that require full validation approval (all 5 layers at 100%)
const VALIDATION_GATED_TABS = new Set<AppTab>([
  "roll-export",       // CAM export — final manufacturing output
  "report",            // PDF report — final design deliverable
  "machine-bom",       // BOM — requires validated tooling data
  "flower-3d",         // 3D visualization — final design confirmation
  "admin-dashboard",   // Admin dashboard — production pipeline review
]);

function ValidationGateBanner({ onGoToValidation }: { onGoToValidation: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#080812] gap-4 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center">
        <ShieldCheck className="w-7 h-7 text-white" />
      </div>
      <div>
        <div className="text-lg font-bold text-white mb-1">Validation Required</div>
        <div className="text-sm text-zinc-400 max-w-sm">
          This section requires all 5 validation layers to reach 100% before access is granted. Run the Validation Pipeline and fix all issues first.
        </div>
      </div>
      <button
        onClick={onGoToValidation}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "white" }}
      >
        <ShieldCheck className="w-4 h-4" />
        Go to Validation Pipeline
      </button>
    </div>
  );
}

export default function Home({ onBackToDashboard }: HomeProps) {
  const { activeTab, setActiveTab, gcodeOutputs, geometry, stations, rollTooling, sectionModel: storeSectionModel, setSectionModel, validationApproved } = useCncStore();
  const { user, logout } = useAuthStore();
  const network = useNetworkStatus();
  const autoMode = useAutoAIMode();
  const [showLibrary, setShowLibrary]         = useState(false);
  const [showHistory, setShowHistory]         = useState(false);
  const [showSaveProject, setShowSaveProject] = useState(false);
  const [showUserMenu, setShowUserMenu]       = useState(false);
  const [showDrive, setShowDrive]             = useState(false);
  const [showWizard, setShowWizard]           = useState(false);
  const [showSystemInfo, setShowSystemInfo]   = useState(false);
  const [showAbout, setShowAbout]             = useState(false);
  const [showReport, setShowReport]           = useState(false);
  const [showGuardrailReport, setShowGuardrailReport] = useState(false);
  const [showExportHistory, setShowExportHistory] = useState(false);
  const [showAIKeyModal, setShowAIKeyModal] = useState(false);
  const { hasKey: hasPersonalKey } = usePersonalAIKey();
  const [activeCatId, setActiveCatId] = useState(() => TAB_TO_CAT[activeTab] ?? "design");
  // sectionModel is now driven from the store (persisted across sessions)
  const sectionModel = storeSectionModel;
  const [showSectionSelector, setShowSectionSelector] = useState(
    // Show mandatory selector on first load if model not yet chosen
    () => !storeSectionModel
  );

  useEffect(() => {
    const cat = TAB_TO_CAT[activeTab];
    if (cat) setActiveCatId(cat);
  }, [activeTab]);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out", description: "You have been logged out successfully." });
  };

  const prevAutoAIStep = useRef(autoMode.status.step);
  useEffect(() => {
    const step = autoMode.status.step;
    if (step === prevAutoAIStep.current) return;
    prevAutoAIStep.current = step;
    if (step === "done") {
      toast({ title: "Auto Mode", description: "Sab calculations complete ho gayi! Flower, Roll Tooling & G-Code ready hai." });
    } else if (step === "error") {
      toast({ title: "Auto Mode Error", description: autoMode.status.error || "Calculation mein problem aaya." });
    }
  }, [autoMode.status.step, autoMode.status.error]);

  const hasGcode = gcodeOutputs.length > 0;

  const navCategories: NavCategory[] = [
    {
      id: "design",
      label: "Design",
      icon: <Layers className="w-[18px] h-[18px]" />,
      tools: [
        { id: "setup", label: "Setup", icon: <Settings className="w-4 h-4" />, desc: "Profile & machine configuration" },
        { id: "dimension-confirm", label: "Dim Confirm", icon: <Ruler className="w-4 h-4" />, desc: "Auto-extracted DXF dimension review & override" },
        { id: "manual-drawing", label: "AutoCAD Draw", icon: <PenLine className="w-4 h-4" />, desc: "LINE, CIRCLE, ARC, POLYLINE drawing" },
        { id: "flower", label: "Power Pattern", icon: <Flower className="w-4 h-4" />, desc: "Multi-pass forming sequence" },
        { id: "roll", label: "Roll Tooling", icon: <Wrench className="w-4 h-4" />, desc: "CNC roll design & manufacturing" },
        { id: "smart-rolls", label: "SmartRolls", icon: <Wand2 className="w-4 h-4" />, desc: "Auto-generate roll designs from profile" },
        { id: "rf-spreadsheet", label: "RF Spreadsheet", icon: <Table className="w-4 h-4" />, desc: "Parametric flower design table editor" },
        { id: "downhill-forming", label: "Down-Hill", icon: <TrendingDown className="w-4 h-4" />, desc: "Edge path optimization (ITA award)" },
        { id: "assembly-check", label: "AssemblyCheck", icon: <ShieldCheck className="w-4 h-4" />, desc: "Real-time design validation" },
        { id: "specs", label: "Specs", icon: <ClipboardList className="w-4 h-4" />, desc: "Per-station specification sheet" },
      ],
    },
    {
      id: "manufacturing",
      label: "Manufacturing",
      icon: <FileCode2 className="w-[18px] h-[18px]" />,
      tools: [
        { id: "gcode", label: "G-Code", icon: <FileCode2 className="w-4 h-4" />, desc: "CNC program output" },
        { id: "turner", label: "Turning / Lathe", icon: <Clapperboard className="w-4 h-4" />, desc: "TurnAxis CAM 3D lathe simulation + adaptive toolpaths" },
        { id: "pro-lathe-sim", label: "Pro Lathe Simulator", icon: <Cpu className="w-4 h-4" />, desc: "Professional CNC Lathe — G-Code Editor, Post-Processor (Fanuc/Siemens/HAAS/Mazak), 12-pos Turret, 3D Sim, Collision Verify" },
        { id: "roll-tooling-calc", label: "Roll Tooling Calculator", icon: <Gauge className="w-4 h-4" />, desc: "Bearing size · Bore size · Roll OD/Width · Roll Material — Manual / Semi-Auto / Fully Auto mode with L10 life, keyway, heat treatment" },
        { id: "roll-blank-size", label: "Roll Blank Size Calculator", icon: <Ruler className="w-4 h-4" />, desc: "Raw OD (raf size) · Final OD · Raw Length · Side margin for profile · Material + weight + cost — per roll blank purchase sizing" },
        { id: "roll-cutting-safety", label: "Roll Cutting Safety", icon: <Shield className="w-4 h-4" />, desc: "Cutting approach · Retract distance · Raw size · Safety zones · G-code positions · DXF export for CAD editing" },
        { id: "roll-tool-collision", label: "Roll Tool Setup & Collision", icon: <Crosshair className="w-4 h-4" />, desc: "3-tool setup (Rough/Finish/Groove) · Insert & holder select · Collision detect · Multi-tool G-code · Delta 2X" },
        { id: "solidcam-tooldb", label: "SolidCAM Tool Database", icon: <Wrench className="w-4 h-4" />, desc: "ISO 1832 parser · Insert/Holder/Grade DB · Cutting data per material (P/M/K/N/S/H) · RPM/Feed/MRR/Ra/Power formulas · 12-pos turret map" },
        { id: "geometry-edit", label: "Geometry Edit", icon: <Layers className="w-4 h-4" />, desc: "TurnAxis CAM-style profile chain editor" },
        { id: "cam-operations", label: "CAM Operations", icon: <Settings className="w-4 h-4" />, desc: "Full TurnAxis CAM Turning — Face/OD/ID/Groove/Thread/Drill/Bore/Cutoff" },
        { id: "milling-operations", label: "Milling CAM", icon: <Box className="w-4 h-4" />, desc: "2.5D milling — Pocket/Contour/Face/Slot/iMachining/HSM/Drilling/Mill-Turn" },
        { id: "5axis-cam", label: "5-Axis CAM", icon: <Settings className="w-4 h-4" />, desc: "5-axis simultaneous milling, multi-axis turning, 5-axis post-processors" },
        { id: "tool-library" as AppTab, label: "Tool Library", icon: <Wrench className="w-4 h-4" />, desc: "Persistent CNC tool & holder inventory" },
        { id: "load-calc", label: "Load Calculator", icon: <Zap className="w-4 h-4" />, desc: "Bending force, motor power, torque" },
        { id: "roll-export", label: "Roll Export", icon: <Download className="w-4 h-4" />, desc: "Copra RF / SolidWorks / SolidCAM export" },
      ],
    },
    {
      id: "analysis",
      label: "Analysis",
      icon: <Activity className="w-[18px] h-[18px]" />,
      tools: [
        { id: "forming-sim", label: "FEA Simulation", icon: <Activity className="w-4 h-4" />, desc: "Stress/strain forming analysis" },
        { id: "springback", label: "Springback", icon: <RotateCcw className="w-4 h-4" />, desc: "Springback prediction & compensation" },
        { id: "strip-width", label: "Strip Width", icon: <Ruler className="w-4 h-4" />, desc: "Flat pattern & bend deduction" },
        { id: "roll-gap", label: "Roll Gap", icon: <Target className="w-4 h-4" />, desc: "Gap analysis & optimization" },
        { id: "cost-estimator", label: "Cost Estimator", icon: <DollarSign className="w-4 h-4" />, desc: "Production cost calculation" },
        { id: "camber", label: "Camber", icon: <ArrowLeftRight className="w-4 h-4" />, desc: "Strip bow / camber prediction" },
        { id: "forming-energy", label: "Energy", icon: <Flame className="w-4 h-4" />, desc: "Forming energy & force charts" },
        { id: "material-db", label: "Materials", icon: <Database className="w-4 h-4" />, desc: "Material property database" },
        { id: "rf-dtm", label: "DTM Strain", icon: <Activity className="w-4 h-4" />, desc: "Dynamic Deformation Technology — real-time strain" },
      ],
    },
    {
      id: "formaxis-modules",
      label: "FormAxis Modules",
      icon: <Hexagon className="w-[18px] h-[18px]" />,
      tools: [
        { id: "rf-tubes", label: "RF Tubes", icon: <Circle className="w-4 h-4" />, desc: "Round, rectangular & shaped tube mill design" },
        { id: "rf-trapeze", label: "Trapeze/Corrugated", icon: <Triangle className="w-4 h-4" />, desc: "Trapezoidal & corrugated profile forming" },
        { id: "drawing-dies", label: "Drawing Dies", icon: <Circle className="w-4 h-4" />, desc: "Round-to-rectangular tube transition" },
        { id: "cage-forming", label: "CageForming", icon: <Box className="w-4 h-4" />, desc: "Linear cage forming tube mill" },
        { id: "wire-rolling", label: "WireRolling", icon: <Minus className="w-4 h-4" />, desc: "Profile wire forming (round → complex)" },
        { id: "rf-closed-section", label: "RF Closed-Section", icon: <Hexagon className="w-4 h-4" />, desc: "#9 — FormAxis RF Closed-Section Tube Mill — 100% Feature Parity" },
        { id: "sheet-metal", label: "Sheet Metal", icon: <Layers className="w-4 h-4" />, desc: "#7 — Base/edge/miter flanges, hems, flat pattern unfold, DXF export" },
        { id: "formaxis-compare", label: "FormAxis vs SAI", icon: <ArrowLeftRight className="w-4 h-4" />, desc: "#10 — Full Comparison Suite with Advanced Graphics" },
      ],
    },
    {
      id: "quality",
      label: "Quality / RLM",
      icon: <ScanLine className="w-[18px] h-[18px]" />,
      tools: [
        { id: "profile-scan", label: "ProfileScan", icon: <ScanLine className="w-4 h-4" />, desc: "Contactless cross-section measurement" },
        { id: "roll-scanner", label: "RollScanner", icon: <ScanLine className="w-4 h-4" />, desc: "Roll contour inspection & wear tracking" },
        { id: "roll-lifecycle", label: "Roll Lifecycle", icon: <Database className="w-4 h-4" />, desc: "RLM — SmartSearch, regrind, similarity" },
        { id: "cad-finder", label: "CADFinder", icon: <FolderTree className="w-4 h-4" />, desc: "Document management & project navigator" },
        { id: "validation-pipeline", label: "Validation (10-Layer)", icon: <ShieldCheck className="w-4 h-4" />, desc: "10-layer accuracy pipeline — Material, Springback, Strain, Machine, BOM, AI Certification" },
        { id: "testing-engine", label: "20-Layer Testing", icon: <Trophy className="w-4 h-4" />, desc: "20-layer deep validation — S+/S/A/B/C/D/F grading, localStorage save" },
        { id: "machine-bom", label: "Machine BOM", icon: <Package className="w-4 h-4" />, desc: "Full machine bill of materials" },
      ],
    },
    {
      id: "simulation",
      label: "3D / Sim",
      icon: <Box className="w-[18px] h-[18px]" />,
      tools: [
        { id: "twin", label: "Digital Twin", icon: <Monitor className="w-4 h-4" />, desc: "Machine simulation & visualization" },
        { id: "studio3d", label: "3D Studio", icon: <Box className="w-4 h-4" />, desc: "3D CAD + CAM + Smart" },
        { id: "flower-3d", label: "3D Flower", icon: <Layers className="w-4 h-4" />, desc: "Station-by-station 3D flower animation" },
        { id: "admin-dashboard", label: "Admin Pipeline", icon: <Monitor className="w-4 h-4" />, desc: "3D animated admin pipeline dashboard" },
      ],
    },
    {
      id: "ai",
      label: "Smart Tools",
      icon: <Cpu className="w-[18px] h-[18px]" />,
      tools: [
        { id: "troubleshoot", label: "Smart Diagnose", icon: <AlertTriangle className="w-4 h-4" />, desc: "Smart defect analysis & diagnosis" },
        { id: "factory", label: "Factory Smart", icon: <Cpu className="w-4 h-4" />, desc: "8-module factory intelligence" },
        { id: "offline-ai", label: "Offline AI + Laptop", icon: <Brain className="w-4 h-4" />, desc: "Offline AI engine, hardware scan, auto-backup" },
        { id: "ultra", label: "Smart Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, desc: "System, chat, files, memory" },
        { id: "wizard", label: "Wizard Mode", icon: <GraduationCap className="w-4 h-4" />, desc: "Step-by-step guided workflow" },
        { id: "ai-chatbots", label: "5 Smart Experts", icon: <Cpu className="w-4 h-4" />, desc: "5 experts + quality check" },
        { id: "master-designer", label: "Master Designer", icon: <Brain className="w-4 h-4" />, desc: "50-year veteran AI chatbot with project context" },
        { id: "auto-backup", label: "Auto Backup (5 min)", icon: <Save className="w-4 h-4" />, desc: "Auto-save har 5 min — laptop band ho to bhi kuch nahi jayega" },
        { id: "demo-c-channel", label: "Demo C-Channel Program", icon: <Layers className="w-4 h-4" />, desc: "Complete C-channel — stations, rolls, bearings, motor, BOM" },
        { id: "rf-machine", label: "🏭 Roll Forming Machine (Animated)", icon: <Activity className="w-4 h-4" />, desc: "Live animated roll forming machine — 9 stations, spinning rollers, C-channel forming, cut-off press" },
        { id: "station-control", label: "Station Control (3-Mode)", icon: <Gauge className="w-4 h-4" />, desc: "Fully Auto / Semi Auto / Manual — per station mix & match control" },
        { id: "system-setup", label: "System Setup", icon: <Monitor className="w-4 h-4" />, desc: "One-click setup — hardware check, permissions, dependencies install" },
        { id: "desktop-install", label: "Laptop Install Guide", icon: <Download className="w-4 h-4" />, desc: "Windows .exe installer — laptop ka hardware ka poora use" },
        { id: "real-mukabla", label: "Asli Mukabla — Score Card", icon: <Trophy className="w-4 h-4" />, desc: "AutoCAD+COPRA+SolidCAM vs SAI — 20 categories, real scores" },
        { id: "fea-simulation", label: "FEA Simulation (SolidWorks-style)", icon: <Activity className="w-4 h-4" />, desc: "FLD, Springback FEA, Stress Distribution, Tube Mill FEA" },
        { id: "gcode-verify", label: "G-Code Verification (SolidVerify)", icon: <ShieldCheck className="w-4 h-4" />, desc: "Collision, feed rate, safety, structure — 15+ checks" },
        { id: "advanced-cam", label: "Advanced CAM (iMachining-style)", icon: <Cpu className="w-4 h-4" />, desc: "Adaptive, Trochoidal, HSM, Z-Level, G71/G76 turning" },
        { id: "erp-integration", label: "ERP Integration (Tally/SAP/ERPNext)", icon: <Database className="w-4 h-4" />, desc: "BOM builder, PO export, Tally XML, ERPNext JSON, SAP CSV" },
        { id: "dxf-import", label: "DXF CAD Viewer (AutoCAD Native)", icon: <FileCode2 className="w-4 h-4" />, desc: "Parse & display DXF — LINE, ARC, CIRCLE, LWPOLYLINE, TEXT, Layers" },
        { id: "gcode-simulator", label: "G-Code Toolpath Simulator", icon: <PlayCircle className="w-4 h-4" />, desc: "Animated XZ turning simulation — rapid/cut color, speed control" },
        { id: "roll-flower-designer", label: "Roll Flower Designer (COPRA RF-style)", icon: <Layers2 className="w-4 h-4" />, desc: "Multi-station forming flower, neutral axis, bend allowance, SVG export" },
        { id: "material-analyzer", label: "Material Stress-Strain Analyzer", icon: <TrendingUp className="w-4 h-4" />, desc: "σ-ε curves, FLD, power hardening law — 10 materials comparison" },
        { id: "drawing-vision", label: "Drawing Vision (Gemini Pro)", icon: <Eye className="w-4 h-4" />, desc: "Drawing image upload karein — Gemini 2.5 Pro dimensions, angles, profile type nikaale" },
      ],
    },
    {
      id: "project",
      label: "Project",
      icon: <Save className="w-[18px] h-[18px]" />,
      tools: [
        { id: "_save", label: "Save Project", icon: <Save className="w-4 h-4" />, desc: "Save / load projects", action: () => { setShowSaveProject(true); toast({ title: "Save Project", description: "Opening project save dialog..." }); } },
        { id: "_report", label: "Design Report", icon: <FileText className="w-4 h-4" />, desc: "Professional PDF design report", action: () => {
            if (!validationApproved) {
              toast({ title: "Validation Required", description: "All 5 validation layers must pass at 100% before generating the design report.", variant: "destructive" });
              setActiveTab("validation-pipeline");
            } else {
              setShowReport(true);
            }
          }
        },
        { id: "_guardrail_report", label: "Guardrail PDF", icon: <FileText className="w-4 h-4" />, desc: "Sai Rolotech Smart Engines Engine guardrail report", action: () => setShowGuardrailReport(true) },
        { id: "_library", label: "Profile Library", icon: <BookOpen className="w-4 h-4" />, desc: "Standard profile database", action: () => setShowLibrary(true) },
        { id: "_history", label: "History", icon: <History className="w-4 h-4" />, desc: "Design version history", action: () => setShowHistory(true) },
        { id: "_exports", label: "Export Log", icon: <ClipboardList className="w-4 h-4" />, desc: "View export history", action: () => setShowExportHistory(true) },
        { id: "_drive", label: "Google Drive", icon: <Cloud className="w-4 h-4" />, desc: "Cloud backup & sync", action: () => setShowDrive(true) },
        { id: "_system", label: "System Info", icon: <HardDrive className="w-4 h-4" />, desc: "GPU, RAM, CPU monitor", action: () => setShowSystemInfo(true) },
      ],
    },
  ];

  const activeCat = navCategories.find(c => c.id === activeCatId) || navCategories[0];

  const renderContent = () => {
    // Global validation gate: block certain downstream tabs until validation pipeline passes
    if (VALIDATION_GATED_TABS.has(activeTab) && !validationApproved) {
      return <div className="flex-1 overflow-hidden"><ValidationGateBanner onGoToValidation={() => setActiveTab("validation-pipeline")} /></div>;
    }

    switch (activeTab) {
      case "drawing-vision": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DrawingVisionView /></div></Suspense>;
      case "ai-chatbots": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><AIChatbotsView /></div></Suspense>;
      case "forming-sim": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><FormingSimulationView /></div></Suspense>;
      case "springback": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><SpringbackView /></div></Suspense>;
      case "strip-width": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><StripWidthView /></div></Suspense>;
      case "roll-gap": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollGapView /></div></Suspense>;
      case "cost-estimator": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><CostEstimatorView /></div></Suspense>;
      case "camber": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><CamberPredictionView /></div></Suspense>;
      case "material-db": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><MaterialDatabaseView /></div></Suspense>;
      case "tool-library": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><ToolLibraryView /></div></Suspense>;
      case "forming-energy": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><FormingEnergyView /></div></Suspense>;
      case "specs": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><SpecificationSheet /></div></Suspense>;
      case "load-calc": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden flex flex-col animate-fade-slide-in"><LoadCalculator /></div></Suspense>;
      case "rf-tubes": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RFTubesView /></div></Suspense>;
      case "rf-trapeze": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RFTrapezeView /></div></Suspense>;
      case "smart-rolls": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><SmartRollsView /></div></Suspense>;
      case "rf-dtm": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RFDTMView /></div></Suspense>;
      case "rf-spreadsheet": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RFSpreadsheetView /></div></Suspense>;
      case "drawing-dies": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DrawingDiesView /></div></Suspense>;
      case "cage-forming": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><CageFormingView /></div></Suspense>;
      case "wire-rolling": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><WireRollingView /></div></Suspense>;
      case "profile-scan": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><ProfileScanView /></div></Suspense>;
      case "roll-scanner": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollScannerView /></div></Suspense>;
      case "roll-lifecycle": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollLifecycleView /></div></Suspense>;
      case "cad-finder": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><CADFinderView /></div></Suspense>;
      case "downhill-forming": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DownhillFormingView /></div></Suspense>;
      case "assembly-check": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><AssemblyCheckView /></div></Suspense>;
      case "rf-closed-section": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RFClosedSectionView /></div></Suspense>;
      case "sheet-metal": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><SheetMetalView /></div></Suspense>;
      case "formaxis-compare": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><FormAxisComparisonView /></div></Suspense>;
      case "dimension-confirm": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DimensionConfirmationPanel /></div></Suspense>;
      case "validation-pipeline": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><ValidationPipelinePanel /></div></Suspense>;
      case "machine-bom": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><MachineBOMPanel /></div></Suspense>;
      case "flower-3d": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><FlowerPattern3DView /></div></Suspense>;
      case "roll-export": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollToolingExportPanel /></div></Suspense>;
      case "admin-dashboard": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><AdminDashboard3D /></div></Suspense>;
      case "master-designer": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><MasterDesignerChatbot /></div></Suspense>;
      case "system-setup": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><SystemSetupPanel /></div></Suspense>;
      case "auto-backup": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><AutoBackupPanel /></div></Suspense>;
      case "demo-c-channel": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DemoCChannelPanel /></div></Suspense>;
      case "rf-machine": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollFormingMachineView /></div></Suspense>;
      case "station-control": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><StationControlPanel /></div></Suspense>;
      case "testing-engine": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><TestingEngineView /></div></Suspense>;
      case "desktop-install": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DesktopInstallView /></div></Suspense>;
      case "real-mukabla": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RealMukablaView /></div></Suspense>;
      case "fea-simulation": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><FEASimulationView /></div></Suspense>;
      case "gcode-verify": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><GCodeVerificationView /></div></Suspense>;
      case "advanced-cam": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><AdvancedCAMView /></div></Suspense>;
      case "erp-integration": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><ERPIntegrationView /></div></Suspense>;
      case "dxf-import": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DXFImportView /></div></Suspense>;
      case "gcode-simulator": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><GCodeSimulatorView /></div></Suspense>;
      case "roll-flower-designer": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollFlowerDesignerView /></div></Suspense>;
      case "material-analyzer": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><MaterialAnalyzerView /></div></Suspense>;
      case "wizard": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><WizardMode /></div></Suspense>;
      case "manual-drawing": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><ManualDrawingView /></div></Suspense>;
      case "turner": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><TurningView /></div></Suspense>;
      case "pro-lathe-sim": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><ProLatheSimulator /></div></Suspense>;
      case "roll-tooling-calc": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollToolingCalculator /></div></Suspense>;
      case "roll-blank-size": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollBlankCalculator /></div></Suspense>;
      case "roll-cutting-safety": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollCuttingSafetyCalc /></div></Suspense>;
      case "roll-tool-collision": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollToolCollisionCalc /></div></Suspense>;
      case "solidcam-tooldb": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><SolidCAMToolDB /></div></Suspense>;
      case "geometry-edit": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><GeometryEditPanel /></div></Suspense>;
      case "cam-operations": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><TurnAxisCAMOperationsView /></div></Suspense>;
      case "milling-operations": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><MillingOperationsView /></div></Suspense>;
      case "5axis-cam": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><FiveAxisCAMPanel /></div></Suspense>;
      case "studio3d": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><Studio3DView /></div></Suspense>;
      case "ultra": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><UltraDashboard /></div></Suspense>;
      case "factory": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><FactoryAIView /></div></Suspense>;
      case "troubleshoot": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><Troubleshooting /></div></Suspense>;
      case "offline-ai": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><OfflineAIView /></div></Suspense>;
      case "roll": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><RollToolingView /></div></Suspense>;
      case "flower": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in" data-capture-id="power-pattern"><FlowerPatternView /></div></Suspense>;
      case "twin": return <Suspense fallback={<LazyFallback />}><div className="flex-1 overflow-hidden animate-fade-slide-in"><DigitalTwinView /></div></Suspense>;
      case "gcode":
        return (
          <Suspense fallback={<LazyFallback />}>
            <div className="flex flex-1 overflow-hidden animate-fade-slide-in">
              <LeftPanel />
              <div className="flex-1 relative" data-capture-id="profile-canvas">
                <ProfileCanvas />
                {hasGcode && <ToolpathSimulator />}
              </div>
              <div className="w-80 flex-shrink-0 overflow-y-auto p-4 space-y-3"
                style={{ background: "rgba(9,10,24,0.6)", backdropFilter: "blur(28px) saturate(1.6)", WebkitBackdropFilter: "blur(28px) saturate(1.6)", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2"
                  style={{ color: "#52525b" }}>
                  <Package className="w-3 h-3" style={{ color: "#f59e0b" }} />
                  G-Code & Export
                </div>
                <JobPackageExport />
              </div>
            </div>
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<LazyFallback />}>
            <div className="flex flex-1 overflow-hidden animate-fade-slide-in">
              <LeftPanel />
              <div className="flex-1 relative" data-capture-id="profile-canvas">
                <ProfileCanvas />
                {hasGcode && <ToolpathSimulator />}
              </div>
              <RightPanel />
            </div>
          </Suspense>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-sans" style={{ background: "#05060f", color: "#f4f4f5" }}>

      {/* ══════════════════════════════════════════════════════
          TOP BAR  — 44px slim bar with logo + status + user
      ══════════════════════════════════════════════════════ */}
      <header className="rt-topbar" style={{ zIndex: 20 }}>

        {/* Logo + Back */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              title="Back to Dashboard"
              className="rt-icon-sidebar-btn"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex items-center gap-2 select-none">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-lg" style={{ background: "rgba(245,158,11,0.2)", filter: "blur(10px)" }} />
              <div className="relative w-7 h-7 rounded-lg flex items-center justify-center shadow-lg"
                style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
                <Cog className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="hidden sm:block leading-none">
              <div className="text-xs font-bold text-white tracking-tight">Sai Rolotech Smart Engines</div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-5 w-px flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)" }} />

        {/* Active category + tool breadcrumb */}
        <div className="flex items-center gap-1.5 text-[10px] flex-shrink-0" style={{ color: "#52525b" }}>
          <span style={{ color: "#f59e0b" }}>{activeCat.icon}</span>
          <span className="font-medium" style={{ color: "#a1a1aa" }}>{activeCat.label}</span>
          <ChevronRight className="w-3 h-3" style={{ color: "#3f3f46" }} />
          <span className="font-semibold capitalize" style={{ color: "#d4d4d8" }}>
            {activeTab.replace(/-/g, " ")}
          </span>
        </div>

        {/* Flex spacer */}
        <div className="flex-1" />

        {/* Status Badges — hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
          <span
            title={network.isOnline ? "Online" : "Offline — works fully offline"}
            className="rt-status-badge"
            style={network.isOnline
              ? { background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.2)", color: "#34d399" }
              : { background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)", color: "#fbbf24" }}
          >
            {network.isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            {network.isOnline ? "Online" : "Offline"}
          </span>
          {geometry && (
            <span className="rt-status-badge" style={{ background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.18)", color: "#34d399" }}>
              <CheckCircle2 className="w-2.5 h-2.5" /> Profile
            </span>
          )}
          {stations.length > 0 && (
            <span className="rt-status-badge" style={{ background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.18)", color: "#60a5fa" }}>
              {stations.length} Stations
            </span>
          )}
          {hasGcode && (
            <span className="rt-status-badge" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.18)", color: "#fbbf24" }}>
              G-Code
            </span>
          )}
          <button
            onClick={() => setShowAIKeyModal(true)}
            className="rt-status-badge cursor-pointer hover:brightness-125 transition-all"
            title="Personal Gemini API Key — Replit ke baghair bhi AI use karo"
            style={hasPersonalKey
              ? { background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)", color: "#fbbf24" }
              : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "#71717a" }}
          >
            <Key className="w-2.5 h-2.5" />
            {hasPersonalKey ? "AI Key ✓" : "AI Key"}
          </button>
          <button
            onClick={() => setShowSectionSelector(true)}
            className="rt-status-badge cursor-pointer hover:brightness-125 transition-all"
            title="Switch AI section model"
            style={sectionModel
              ? sectionModel === "open"
                ? { background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.2)", color: "#f59e0b" }
                : { background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)", color: "#818cf8" }
              : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)", color: "#52525b" }}
          >
            {sectionModel ? (sectionModel === "open" ? "Open AI" : "Closed AI") : "Set Model"}
          </button>
        </div>

        {/* Auto Mode toggle */}
        <AutoAIModePanel
          enabled={autoMode.enabled}
          status={autoMode.status}
          onToggle={autoMode.toggle}
        />

        {/* Keyboard shortcut */}
        <button
          title="Keyboard Shortcuts (?)"
          className="rt-icon-sidebar-btn hidden md:flex flex-shrink-0"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }))}
        >
          <Keyboard className="w-3.5 h-3.5" />
        </button>

        {/* User menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#a1a1aa",
            }}
          >
            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
              <span className="text-white text-[9px] font-bold">{(user?.email?.[0] || "U").toUpperCase()}</span>
            </div>
            <ChevronDown className="w-3 h-3" style={{ color: "#52525b" }} />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl py-1 shadow-2xl animate-fade-slide-in"
                style={{ background: "#0f1020", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
                <div className="px-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px]" style={{ color: "#52525b" }}>Signed in as</p>
                  <p className="text-xs font-semibold truncate" style={{ color: "#e4e4e7" }}>{user?.email || "User"}</p>
                </div>

                {((): { label: string; icon: React.ReactNode; color: string; onClick: () => void }[] => {
                  const items: { label: string; icon: React.ReactNode; color: string; onClick: () => void }[] = [];
                  if (onBackToDashboard) {
                    items.push({
                      label: "Dashboard", icon: <LayoutDashboard className="w-3.5 h-3.5" />, color: "#a1a1aa",
                      onClick: () => { setShowUserMenu(false); onBackToDashboard(); }
                    });
                  }
                  items.push({
                    label: "Check for Updates", icon: <RefreshCw className="w-3.5 h-3.5" />, color: "#fbbf24",
                    onClick: async () => {
                      setShowUserMenu(false);
                      toast({ title: "Checking for updates...", description: "Looking for the latest version." });
                      try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.update(); } catch {}
                    }
                  });
                  items.push({
                    label: "About", icon: <Info className="w-3.5 h-3.5" />, color: "#a1a1aa",
                    onClick: () => { setShowUserMenu(false); setShowAbout(true); }
                  });
                  return items;
                })().map((item, i) => (
                  <button key={i} onClick={item.onClick}
                    className="rt-user-menu-btn"
                    style={{ color: item.color }}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 4 }} />
                <button
                  onClick={() => { setShowUserMenu(false); handleLogout(); }}
                  className="rt-user-menu-btn danger"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MAIN BODY = slim icon sidebar + tool panel + content
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Slim Icon Sidebar ──────────────────────────────── */}
        {/* 52px wide. Each icon = one nav category. Click → reveals tool panel. */}
        <aside className="rt-icon-sidebar" aria-label="Navigation">
          {/* Logo spacer — small brand mark */}
          <div className="mb-2 pb-2 w-full flex justify-center"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)", boxShadow: "0 0 12px rgba(245,158,11,0.3)" }}>
              <Cog className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* Category nav icons */}
          {navCategories.map((cat) => {
            const isActive = activeCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCatId(cat.id)}
                className={`rt-icon-sidebar-btn group ${isActive ? "active" : ""}`}
                title={cat.label}
              >
                {cat.icon}
              </button>
            );
          })}

          {/* Spacer + bottom utility icons */}
          <div className="flex-1" />
          <div className="pt-2 w-full flex flex-col items-center gap-1"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="rt-icon-sidebar-btn"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </aside>

        {/* ── Category Tool Panel ────────────────────────────── */}
        {/* Shows all tools for the active nav category. ~180px wide. */}
        <nav
          aria-label={`${activeCat.label} tools`}
          className="flex flex-col flex-shrink-0 overflow-y-auto"
          style={{
            width: 160,
            background: "rgba(7, 8, 16, 0.98)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Category heading */}
          <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1.5">
              <span style={{ color: "#f59e0b" }}>{activeCat.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#52525b" }}>
                {activeCat.label}
              </span>
            </div>
          </div>

          {/* Tool list */}
          <div className="flex-1 py-2 px-2">
            {activeCat.tools.map((tool) => {
              const isActive = !tool.action && activeTab === (tool.id as AppTab);
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (tool.action) {
                      tool.action();
                    } else {
                      setActiveTab(tool.id as AppTab);
                    }
                  }}
                  title={tool.desc}
                  className={`rt-tool-panel-btn${isActive ? " active" : ""}`}
                >
                  <span className="flex-shrink-0">{tool.icon}</span>
                  <span className="leading-tight truncate">{tool.label}</span>
                  {isActive && (
                    <div className="ml-auto flex-shrink-0 w-1 h-1 rounded-full" style={{ background: "#f59e0b" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active indicator strip at bottom */}
          <div className="px-3 py-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="text-[9px] uppercase tracking-widest truncate" style={{ color: "#3f3f46" }}>
              {activeTab.replace(/-/g, " ")}
            </div>
          </div>
        </nav>

        {/* ── Main Content Area ──────────────────────────────── */}
        <ErrorBoundary fallbackTitle={`Error in ${activeTab} view`}>
          <div className="flex flex-1 overflow-hidden">
            {renderContent()}
          </div>
        </ErrorBoundary>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}
      <Suspense fallback={null}>
        {showSaveProject && <SaveProjectModal onClose={() => setShowSaveProject(false)} />}
        <PersonalAIKeyModal open={showAIKeyModal} onClose={() => setShowAIKeyModal(false)} />
        {showDrive && <GoogleDrivePanel onClose={() => setShowDrive(false)} />}
        {showSystemInfo && <SystemInfoPanel onClose={() => setShowSystemInfo(false)} />}
        {showReport && <DesignReportGenerator onClose={() => setShowReport(false)} />}
        {showGuardrailReport && <GuardrailReportGenerator onClose={() => setShowGuardrailReport(false)} />}
        {showExportHistory && <ExportHistoryPanel onClose={() => setShowExportHistory(false)} onRegeneratePdf={() => setShowReport(true)} />}
        {showWizard && activeTab !== "wizard" && <WizardMode />}
        {showSectionSelector && (
          <SectionModelSelector
            selected={sectionModel}
            mandatory={!sectionModel}
            onSelect={(model) => {
              setSectionModel(model);
              setShowSectionSelector(false);
            }}
          />
        )}
      </Suspense>

      {showLibrary && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 animate-fade-slide-in"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
          <div className="w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "85vh", background: "#0f1020", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Suspense fallback={<LazyFallback />}><ProfileLibrary onClose={() => setShowLibrary(false)} /></Suspense>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 animate-fade-slide-in"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "85vh", background: "#0f1020", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Suspense fallback={<LazyFallback />}><DesignHistory onClose={() => setShowHistory(false)} /></Suspense>
          </div>
        </div>
      )}

      {showAbout && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }} onClick={() => setShowAbout(false)} />
          <div className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden animate-fade-slide-in"
            style={{ background: "#0f1020", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="p-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl blur-md" style={{ background: "rgba(245,158,11,0.25)" }} />
                  <div className="relative w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
                    <Cog className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Sai Rolotech Smart Engines</h2>
              <p className="text-xs font-medium tracking-widest uppercase mb-4" style={{ color: "#52525b" }}>Smart Engines Platform</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
                style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa" }}>
                Version 2.1.0
              </div>

              <div className="space-y-3 text-left rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>Changelog</h3>
                <div className="space-y-2">
                  {[
                    { ver: "2.1.0", title: "Figma-Level Premium UI Redesign", desc: "Sidebar navigation, glassmorphism panels, premium dark theme" },
                    { ver: "2.0.0", title: "Commercial UI/UX Overhaul", desc: "Landing page, dashboard, polished workspace" },
                    { ver: "1.9.0", title: "3D Studio & Digital Twin", desc: "Full 3D CAD/CAM with machine visualization" },
                    { ver: "1.8.0", title: "Factory Smart Modules", desc: "8 smart modules for smart manufacturing" },
                  ].map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 py-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 mt-0.5"
                        style={{ background: "rgba(255,255,255,0.06)", color: "#a1a1aa" }}>{entry.ver}</span>
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">{entry.title}</div>
                        <div className="text-[11px]" style={{ color: "#52525b" }}>{entry.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowAbout(false)}
                className="rt-ghost-btn mt-5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
