import React, { useState, useEffect, useCallback, useRef } from "react";
import { useCncStore } from "@/store/useCncStore";
import {
  HelpCircle, X, ChevronRight, Bot, Lightbulb,
  AlertCircle, CheckCircle2, ArrowRight, Sparkles,
  ChevronDown, ChevronUp, RefreshCw, Zap, PlayCircle,
  BookOpen, Loader2, SkipForward, StopCircle, CheckCheck,
} from "lucide-react";

// ─── Autopilot Pipeline ───────────────────────────────────────────────────────

type GuideMode = "manual" | "semi" | "auto";

interface PipelineStep {
  tab: string;
  label: string;
  desc: string;
  waitForUser?: boolean;
}

const AUTOPILOT_PIPELINE: PipelineStep[] = [
  { tab: "drawing-vision",       label: "Drawing Analysis",    desc: "AI drawing se specs extract karega (Image ya DXF upload karein)" },
  { tab: "dimension-confirm",    label: "Dimension Confirm",   desc: "Extracted dimensions verify aur confirm honge" },
  { tab: "auto-profile-converter", label: "Profile Convert",  desc: "Profile inner/outer layers aur flat width calculate hogi" },
  { tab: "sheet-metal",          label: "Sheet Metal",         desc: "Final sheet specification aur unfold pattern ready hogi" },
];

const AUTO_STEP_DELAY = 3500;

// ─── Tab Guidance Database ────────────────────────────────────────────────────

interface StepGuide {
  title: string;
  what: string;
  steps: string[];
  tips: string[];
  nextTab?: string;
  nextTabLabel?: string;
  warning?: string;
}

const TAB_GUIDES: Record<string, StepGuide> = {
  setup: {
    title: "Profile Setup",
    what: "Yahan aap apni roll forming machine ki basic settings aur material define karte hain.",
    steps: [
      "Material type select karein — GI, GP, SS, ya Aluminium",
      "Material thickness enter karein (mm mein)",
      "Profile type choose karein — Open ya Closed section",
      "Roll diameter aur shaft diameter enter karein",
      "Stations ki taadaad set karein",
      "Sab bharne ke baad 'Next' ya 'Flower' tab pe jayein",
    ],
    tips: [
      "GP/GI ke liye K-factor 0.33 rakkhein",
      "Thickness 0.3–3.0mm ke beech honi chahiye",
      "Roll diameter typical: 100–200mm",
    ],
    nextTab: "flower",
    nextTabLabel: "Flower Pattern banao",
  },
  flower: {
    title: "Flower Pattern (Bend Progression)",
    what: "Flower pattern dikhata hai ke har station pe strip ka angle kitna hoga — flat se final shape tak.",
    steps: [
      "Pehle Profile Setup (Setup tab) complete karein",
      "'Generate Flower' button dabayein",
      "Stations ki progression check karein",
      "Springback compensation values review karein",
      "Agar angles galat lagein — material ya thickness adjust karein",
      "Flower approve ho jaye to Roll Tooling tab pe jayein",
    ],
    tips: [
      "Total angle = profile ke sab bends ka sum",
      "Springback GP/GI ke liye 2–5° hoti hai",
      "Station 1 mein light bending honi chahiye",
    ],
    nextTab: "roll",
    nextTabLabel: "Roll Tooling design karo",
  },
  roll: {
    title: "Roll Tooling Design",
    what: "Har station ke upper (punch) aur lower (die) rolls ki dimensions aur groove design.",
    steps: [
      "Flower pattern pehle generate kar lein",
      "Upper roll aur lower roll OD enter karein",
      "'Generate Roll Tooling' button dabayein",
      "Har station ke groove width, depth check karein",
      "Roll gap (material + clearance) verify karein",
      "DXF export ya G-Code ke liye aage jayein",
    ],
    tips: [
      "Upper roll OD: typically 100–160mm",
      "Roll gap = material thickness + 0.02mm clearance",
      "D2 tool steel HRC 58–62 recommended",
    ],
    nextTab: "gcode",
    nextTabLabel: "G-Code generate karo",
    warning: "Roll tooling ke bina G-code generate nahi hoga",
  },
  gcode: {
    title: "CNC G-Code Generation",
    what: "Roll tooling ke dimensions se Delta 2X / Fanuc / Haas CNC ke liye G-code generate hota hai.",
    steps: [
      "Roll tooling pehle complete karein",
      "CNC controller select karein (Delta 2X, Fanuc, etc.)",
      "'Generate G-Code' button dabayein",
      "G-code preview mein dekho — T04, G92, G96 commands",
      "RAW aur FINAL split G-code download karein",
      "Machine pe load karne se pehle simulator mein test karein",
    ],
    tips: [
      "Delta 2X ke liye: G0→G53→G28→M1→T0404",
      "Feed rate GP 0.3mm ke liye: F0.08–F0.12",
      "G96 S200 M4 = CSS mode 200 m/min",
    ],
    nextTab: "gcode-simulator",
    nextTabLabel: "G-Code simulator mein test karo",
  },
  troubleshoot: {
    title: "AI Defect Diagnosis",
    what: "Roll forming mein jo bhi defect aa rahi hai — yahan AI uska cause aur fix batata hai.",
    steps: [
      "Jo defect dikh rahi hai uski category select karein",
      "Defect ka description enter karein",
      "Machine parameters bhi batao (speed, gap, etc.)",
      "AI ka analysis padho",
      "Suggested corrections apply karein",
      "Adjustments ke baad dobarah test run karein",
    ],
    tips: [
      "Bow/Camber: usually roll gap asymmetry",
      "Twist: shaft alignment ya overforming",
      "Springback: K-factor adjust karo",
      "Wave edge: strip tension ya edge trim",
    ],
  },
  twin: {
    title: "Digital Twin Visualization",
    what: "Machine ka live 2D animation — strip flow, rolls, aur station details.",
    steps: [
      "Flower pattern generate ho toh twin automatically update hota hai",
      "Station par click karo detail dekhne ke liye",
      "Play button se animated strip flow dekho",
      "Pass line aur roll position verify karo",
    ],
    tips: [
      "Digital twin validation ke liye use karo",
      "Agar strip path wrong lag raha ho — flower revisit karo",
    ],
  },
  "tool-library": {
    title: "CNC Tool Library",
    what: "SolidCAM TOOLKIT ke tools — inserts, holders, cutting data sab yahan manage hote hain.",
    steps: [
      "Factory tools already loaded hain (T02, T04, T06, T08, T10)",
      "Naya tool add karne ke liye 'Add Tool' button dabao",
      "ISO designation enter karo (e.g. VNMG 160408)",
      "Cutting data — RPM, feed rate set karo",
      "Tool lock karo production ke liye",
    ],
    tips: [
      "T04 VNMG 060108: Grooving ke liye",
      "T02 VNMG 160408: External turning ke liye",
      "HRC 62+ inserts thin GP ke liye better",
    ],
  },
  "master-designer": {
    title: "Master Designer AI Chatbot",
    what: "Full AI assistant jo aapke project ka context samjhta hai aur technical sawalon ka jawab deta hai.",
    steps: [
      "Apna sawaal type karo — Urdu/Hindi/English sab chalega",
      "AI automatically aapka current project dekh ke jawab dega",
      "Roll design, G-code, material — kuch bhi pucho",
      "Online mode mein GPT-4o se, offline mein local AI se jawab milega",
    ],
    tips: [
      "'Mera flower pattern galat kyon hai?' — seedha puchho",
      "'Station 3 ka roll gap kitna hona chahiye?' — context-aware answer milega",
      "Offline mode mein bhi kaam karta hai",
    ],
  },
  "offline-ai": {
    title: "Offline AI Engine",
    what: "No internet required — local AI engine 500+ engineering patterns se jawab deta hai.",
    steps: [
      "Apna sawaal type karo",
      "AI turant answer dega — zero internet",
      "Roll forming, G-code, material science sab covered hai",
    ],
    tips: [
      "1625 engineering patterns loaded",
      "12 defect types covered",
      "99% accuracy on known patterns",
    ],
  },
  "gcode-simulator": {
    title: "Pro CNC Lathe Simulator",
    what: "G-code machine pe load karne se pehle iska simulation dekho — errors pakad lein.",
    steps: [
      "G-Code tab se code generate karo",
      "Simulator mein paste karo ya auto-load hoga",
      "Play button dabao — tool path animate hoga",
      "Collision ya error warnings check karo",
      "Sab theek ho to machine pe chalao",
    ],
    tips: [
      "Rapids (G0) blue rang mein dikhenge",
      "Feeds (G1/G2/G3) green mein",
      "Collisions red highlight honge",
    ],
  },
  "auto-backup": {
    title: "Auto Backup System",
    what: "Aapka project har 5 minute mein automatically save hota hai — 50 backup slots.",
    steps: [
      "Backups automatically chal rahe hain (startup pe start hota hai)",
      "Kisi bhi purane backup pe click karo restore ke liye",
      "Manual backup ke liye 'Save Now' button",
      "Export karo JSON file ke taur pe",
    ],
    tips: [
      "Max 50 backups — purane automatically delete hote hain",
      "Browser close karne se pehle manual backup le lein",
    ],
  },
  "system-setup": {
    title: "System Setup Check",
    what: "App ki hardware aur software requirements verify karta hai.",
    steps: [
      "Auto-check chal raha hoga — results green/yellow/red mein",
      "Red items: zaroori fix karni hain",
      "Yellow items: optional but recommended",
      "Green: sab theek hai",
    ],
    tips: [
      "GPU: WebGL 2 zaroori hai 3D views ke liye",
      "RAM: 4GB minimum, 8GB recommended",
      "Offline storage: IndexedDB enabled hona chahiye",
    ],
  },
};

const DEFAULT_GUIDE: StepGuide = {
  title: "AI Guide",
  what: "Is section ka guide load ho raha hai...",
  steps: [
    "Pehle Profile Setup tab mein material aur machine settings karein",
    "Phir Flower Pattern generate karein",
    "Phir Roll Tooling design karein",
    "Aakhir mein G-Code generate karein",
  ],
  tips: [
    "Kisi bhi tab pe '?' button dabao guide ke liye",
    "Master Designer AI se kuch bhi puchho",
  ],
};

// ─── Contextual State Checker ─────────────────────────────────────────────────

function getContextualWarnings(store: ReturnType<typeof useCncStore.getState>): string[] {
  const warnings: string[] = [];
  if (!store.materialType) warnings.push("⚠️ Material type select nahi hua");
  if (!store.materialThickness || store.materialThickness <= 0) warnings.push("⚠️ Material thickness enter nahi ki");
  if (!store.geometry && store.stations.length === 0) warnings.push("⚠️ Profile geometry ya stations nahi hain — Setup se shuru karein");
  if (store.stations.length > 0 && store.rollTooling.length === 0) warnings.push("💡 Flower pattern hai — Roll Tooling generate karein");
  if (store.rollTooling.length > 0 && store.gcodeOutputs.length === 0) warnings.push("💡 Roll tooling ready hai — G-Code generate karein");
  return warnings;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function ContextualGuide() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");
  const [pulse, setPulse] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── 3-Mode system ──────────────────────────────────────────────────────────
  const [guideMode, setGuideMode] = useState<GuideMode>("manual");
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStep, setAutoStep] = useState(-1);           // current pipeline step index
  const [semiStep, setSemiStep] = useState(-1);           // semi-auto current step
  const [semiWaiting, setSemiWaiting] = useState(false);  // waiting for user confirm
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAbortRef = useRef(false);

  const store = useCncStore();
  const { activeTab, setActiveTab } = store;

  const guide = TAB_GUIDES[activeTab] ?? DEFAULT_GUIDE;
  const warnings = getContextualWarnings(store);

  // ── Pipeline helpers ───────────────────────────────────────────────────────
  const stopPipeline = useCallback(() => {
    autoAbortRef.current = true;
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setAutoRunning(false);
    setAutoStep(-1);
    setSemiStep(-1);
    setSemiWaiting(false);
  }, []);

  const resetPipeline = useCallback(() => {
    stopPipeline();
    setCompletedSteps([]);
    autoAbortRef.current = false;
  }, [stopPipeline]);

  // Auto mode: run all steps automatically with delay
  const runAutoPipeline = useCallback(async () => {
    resetPipeline();
    autoAbortRef.current = false;
    setAutoRunning(true);
    setOpen(true);
    setMinimized(false);

    for (let i = 0; i < AUTOPILOT_PIPELINE.length; i++) {
      if (autoAbortRef.current) break;
      setAutoStep(i);
      setActiveTab(AUTOPILOT_PIPELINE[i]!.tab as any);
      await new Promise<void>(resolve => {
        autoTimerRef.current = setTimeout(resolve, AUTO_STEP_DELAY);
      });
      if (!autoAbortRef.current) setCompletedSteps(prev => [...prev, i]);
    }
    if (!autoAbortRef.current) {
      setAutoStep(-1);
      setAutoRunning(false);
    }
  }, [resetPipeline, setActiveTab]);

  // Semi-auto: start pipeline, pause at each step for user confirm
  const startSemiPipeline = useCallback(() => {
    resetPipeline();
    setSemiStep(0);
    setSemiWaiting(true);
    setOpen(true);
    setMinimized(false);
    setActiveTab(AUTOPILOT_PIPELINE[0]!.tab as any);
  }, [resetPipeline, setActiveTab]);

  const semiConfirm = useCallback(() => {
    const nextStep = semiStep + 1;
    setCompletedSteps(prev => [...prev, semiStep]);
    if (nextStep >= AUTOPILOT_PIPELINE.length) {
      setSemiStep(-1);
      setSemiWaiting(false);
    } else {
      setSemiStep(nextStep);
      setSemiWaiting(true);
      setActiveTab(AUTOPILOT_PIPELINE[nextStep]!.tab as any);
    }
  }, [semiStep, setActiveTab]);

  const semiSkip = useCallback(() => {
    const nextStep = semiStep + 1;
    if (nextStep >= AUTOPILOT_PIPELINE.length) {
      setSemiStep(-1);
      setSemiWaiting(false);
    } else {
      setSemiStep(nextStep);
      setSemiWaiting(true);
      setActiveTab(AUTOPILOT_PIPELINE[nextStep]!.tab as any);
    }
  }, [semiStep, setActiveTab]);

  // Pending start signal — avoids race between stopPipeline abort flag + runAutoPipeline
  const pendingStartRef = useRef<GuideMode | null>(null);

  // Mode switcher — only updates state here, pipeline starts via useEffect below
  const switchMode = useCallback((mode: GuideMode) => {
    stopPipeline();
    pendingStartRef.current = mode;
    setGuideMode(mode);
    setCompletedSteps([]);
    setAiResponse(null);
  }, [stopPipeline]);

  // Pipeline launcher — runs AFTER React re-render so abort flag is already cleared
  useEffect(() => {
    const pending = pendingStartRef.current;
    if (!pending) return;
    pendingStartRef.current = null;
    autoAbortRef.current = false;
    if (pending === "auto")  runAutoPipeline();
    if (pending === "semi")  startSemiPipeline();
  }, [guideMode, runAutoPipeline, startSemiPipeline]);

  // Pulse animation when tab changes to draw attention
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 2000);
    return () => clearTimeout(t);
  }, [activeTab]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = document.getElementById("guide-float-btn");
        if (btn && btn.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Cleanup on unmount
  useEffect(() => () => { autoAbortRef.current = true; if (autoTimerRef.current) clearTimeout(autoTimerRef.current); }, []);

  // Ask AI for deeper help
  const askAI = useCallback(async () => {
    if (!userQuestion.trim()) return;

    // ── Keyword detection for mode switching ─────────────────────────────────
    const q = userQuestion.trim().toLowerCase();
    if (q.includes("auto mode") || q.includes("auto pilot") || q.includes("autopilot")) {
      setUserQuestion("");
      setAiResponse("✅ Auto Mode shuru ho gaya! Sab steps automatically chal rahe hain — Drawing → Dimensions → Profile → Sheet Metal.");
      switchMode("auto");
      return;
    }
    if (q.includes("semi auto") || q.includes("semi-auto") || q.includes("confirm karo") || q.includes("ek ek step")) {
      setUserQuestion("");
      setAiResponse("✅ Semi Auto Mode shuru! Har step pe main rukuunga aur aapki permission ke baad aage baThunga.");
      switchMode("semi");
      return;
    }
    if (q.includes("manual mode") || q.includes("khud karunga") || q.includes("band karo auto")) {
      setUserQuestion("");
      setAiResponse("✅ Manual Mode — Aap khud steps follow kar sakte hain. Guides aur tips neeche hain.");
      switchMode("manual");
      return;
    }

    setAiLoading(true);
    setAiResponse(null);

    const offlineToken = "offline-sai-rolotech-local";
    const ctx = {
      activeTab,
      materialType: store.materialType,
      materialThickness: store.materialThickness,
      stations: store.stations.length,
      hasGeometry: !!store.geometry,
      hasRollTooling: store.rollTooling.length > 0,
      hasGcode: store.gcodeOutputs.length > 0,
    };

    const prompt = `User current tab: "${activeTab}"\nProject state: ${JSON.stringify(ctx)}\nUser ka sawaal: ${userQuestion}\nUrdu/Hindi mein short aur helpful jawab do.`;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${offlineToken}`,
        },
        body: JSON.stringify({
          message: prompt,
          forceOffline: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.response ?? data.reply ?? data.message ?? "AI ne koi jawab nahi diya.");
      } else {
        // Fallback to tab guide tips
        setAiResponse(
          `Is section ke liye tips:\n• ${guide.tips.join("\n• ")}\n\nNext step: ${guide.steps[0]}`
        );
      }
    } catch {
      setAiResponse(
        `Is section ke liye tips:\n• ${guide.tips.join("\n• ")}\n\nNext step: ${guide.steps[0]}`
      );
    } finally {
      setAiLoading(false);
    }
  }, [userQuestion, activeTab, store, guide]);

  return (
    <>
      {/* ── Floating Button ─────────────────────────────────────────────── */}
      <button
        id="guide-float-btn"
        onClick={() => { setOpen(o => !o); setMinimized(false); }}
        className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 px-3 py-2.5 rounded-2xl shadow-xl transition-all duration-300 select-none group"
        style={{
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          boxShadow: open
            ? "0 0 0 3px rgba(245,158,11,0.4), 0 8px 32px rgba(0,0,0,0.5)"
            : pulse
            ? "0 0 0 4px rgba(245,158,11,0.5), 0 8px 24px rgba(0,0,0,0.4)"
            : "0 4px 24px rgba(0,0,0,0.4)",
        }}
        title="AI Guide — Auto / Semi / Manual Mode"
      >
        {guideMode === "auto" ? <Zap className="w-4 h-4 text-white" /> : guideMode === "semi" ? <PlayCircle className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
        <span className="text-white text-xs font-semibold tracking-wide hidden sm:inline">
          {guideMode === "auto" ? "Auto" : guideMode === "semi" ? "Semi" : "AI Guide"}
        </span>
        {warnings.length > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: "#ef4444" }}
          >
            {warnings.length}
          </span>
        )}
      </button>

      {/* ── Guide Panel ─────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-6 z-[9989] w-80 max-h-[80vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
          style={{
            background: "linear-gradient(180deg, #0d0e1a 0%, #090a13 100%)",
            border: "1px solid rgba(245,158,11,0.3)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.15)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid rgba(245,158,11,0.15)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: guideMode === "auto" ? "rgba(245,158,11,0.35)" : guideMode === "semi" ? "rgba(6,182,212,0.25)" : "rgba(245,158,11,0.2)" }}>
                {guideMode === "auto" ? <Zap className="w-4 h-4" style={{ color: "#f59e0b" }} /> : guideMode === "semi" ? <PlayCircle className="w-4 h-4" style={{ color: "#06b6d4" }} /> : <Bot className="w-4 h-4" style={{ color: "#f59e0b" }} />}
              </div>
              <div>
                <p className="text-white text-xs font-bold leading-none">AI Guide</p>
                <p className="text-xs leading-none mt-0.5" style={{ color: guideMode === "auto" ? "#f59e0b" : guideMode === "semi" ? "#06b6d4" : "rgba(245,158,11,0.8)" }}>
                  {guideMode === "auto" ? (autoRunning ? "Auto Mode — Chal raha hai..." : "Auto Mode") : guideMode === "semi" ? "Semi Auto Mode" : guide.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(m => !m)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10">
                {minimized ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="overflow-y-auto flex-1 p-3 space-y-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(245,158,11,0.3) transparent" }}>

              {/* ── MODE SELECTOR ────────────────────────────────────────────── */}
              <div className="rounded-xl p-1 flex gap-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {([
                  { id: "auto" as GuideMode,   icon: <Zap className="w-3 h-3" />,        label: "Auto",   color: "#f59e0b", activeBg: "rgba(245,158,11,0.2)", activeBorder: "rgba(245,158,11,0.5)" },
                  { id: "semi" as GuideMode,   icon: <PlayCircle className="w-3 h-3" />, label: "Semi",   color: "#06b6d4", activeBg: "rgba(6,182,212,0.15)",  activeBorder: "rgba(6,182,212,0.4)" },
                  { id: "manual" as GuideMode, icon: <BookOpen className="w-3 h-3" />,   label: "Manual", color: "#a78bfa", activeBg: "rgba(139,92,246,0.15)", activeBorder: "rgba(139,92,246,0.4)" },
                ] as const).map(m => (
                  <button
                    key={m.id}
                    onClick={() => switchMode(m.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition-all"
                    style={{
                      color: guideMode === m.id ? m.color : "rgba(255,255,255,0.4)",
                      background: guideMode === m.id ? m.activeBg : "transparent",
                      border: `1px solid ${guideMode === m.id ? m.activeBorder : "transparent"}`,
                    }}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              {/* ── AUTO MODE UI ─────────────────────────────────────────────── */}
              {guideMode === "auto" && (
                <div className="space-y-2">
                  <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: "#f59e0b" }}>
                      {autoRunning ? "⚡ Pipeline chal rahi hai..." : completedSteps.length === AUTOPILOT_PIPELINE.length ? "✅ Sab steps complete ho gaye!" : "Auto Pilot Pipeline"}
                    </p>
                    <div className="space-y-1.5">
                      {AUTOPILOT_PIPELINE.map((step, i) => {
                        const isDone = completedSteps.includes(i);
                        const isActive = autoStep === i;
                        return (
                          <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-all" style={{ background: isActive ? "rgba(245,158,11,0.12)" : "transparent" }}>
                            <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: isDone ? "rgba(34,197,94,0.2)" : isActive ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)" }}>
                              {isDone ? <CheckCircle2 className="w-3 h-3" style={{ color: "#22c55e" }} /> : isActive ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#f59e0b" }} /> : <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>{i + 1}</span>}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold truncate" style={{ color: isDone ? "#22c55e" : isActive ? "#f59e0b" : "rgba(255,255,255,0.5)" }}>{step.label}</p>
                              {isActive && <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{step.desc}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {autoRunning ? (
                    <button onClick={() => { stopPipeline(); setGuideMode("manual"); }} className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                      <StopCircle className="w-3.5 h-3.5" /> Band Karo
                    </button>
                  ) : (
                    <button onClick={runAutoPipeline} className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.4), rgba(245,158,11,0.2))", border: "1px solid rgba(245,158,11,0.4)", color: "#fcd34d" }}>
                      <Zap className="w-3.5 h-3.5" /> Dobara Chalao
                    </button>
                  )}
                </div>
              )}

              {/* ── SEMI AUTO MODE UI ────────────────────────────────────────── */}
              {guideMode === "semi" && (
                <div className="space-y-2">
                  <div className="rounded-xl p-3" style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)" }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: "#06b6d4" }}>
                      {semiStep < 0 && completedSteps.length === 0 ? "Pipeline shuru karne ke liye dabao" : semiStep < 0 ? "✅ Pipeline complete ho gayi!" : `Step ${semiStep + 1} / ${AUTOPILOT_PIPELINE.length}`}
                    </p>
                    <div className="space-y-1.5">
                      {AUTOPILOT_PIPELINE.map((step, i) => {
                        const isDone = completedSteps.includes(i);
                        const isActive = semiStep === i;
                        return (
                          <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5" style={{ background: isActive ? "rgba(6,182,212,0.1)" : "transparent" }}>
                            <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: isDone ? "rgba(34,197,94,0.2)" : isActive ? "rgba(6,182,212,0.3)" : "rgba(255,255,255,0.08)" }}>
                              {isDone ? <CheckCircle2 className="w-3 h-3" style={{ color: "#22c55e" }} /> : isActive ? <PlayCircle className="w-3 h-3" style={{ color: "#06b6d4" }} /> : <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>{i + 1}</span>}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold" style={{ color: isDone ? "#22c55e" : isActive ? "#06b6d4" : "rgba(255,255,255,0.45)" }}>{step.label}</p>
                              {isActive && <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{step.desc}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confirm / Skip / Stop buttons */}
                  {semiStep >= 0 && semiWaiting && (
                    <div className="rounded-xl p-2.5 space-y-2" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)" }}>
                      <p className="text-[11px] font-semibold text-center" style={{ color: "#06b6d4" }}>
                        "{AUTOPILOT_PIPELINE[semiStep]?.label}" tab khul gayi — kya aage baThuun?
                      </p>
                      <div className="flex gap-1.5">
                        <button onClick={semiConfirm} className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-all hover:opacity-90" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "#86efac" }}>
                          <CheckCheck className="w-3 h-3" /> Haan, Aage
                        </button>
                        <button onClick={semiSkip} className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", color: "#fcd34d" }}>
                          <SkipForward className="w-3 h-3" /> Skip
                        </button>
                        <button onClick={() => { stopPipeline(); }} className="flex items-center justify-center px-2 rounded-lg py-1.5" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                          <StopCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {semiStep < 0 && (
                    <button onClick={startSemiPipeline} className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.3), rgba(6,182,212,0.15))", border: "1px solid rgba(6,182,212,0.35)", color: "#67e8f9" }}>
                      <PlayCircle className="w-3.5 h-3.5" /> {completedSteps.length > 0 ? "Dobara Chalao" : "Shuru Karo"}
                    </button>
                  )}
                </div>
              )}

              {/* ── MANUAL MODE UI ───────────────────────────────────────────── */}
              {guideMode === "manual" && (
                <>
                  {/* What is this section */}
                  <div className="rounded-xl p-3" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <span className="font-semibold" style={{ color: "#06b6d4" }}>Is section mein:</span>{" "}
                      {guide.what}
                    </p>
                  </div>

                  {/* Contextual Warnings */}
                  {warnings.length > 0 && (
                    <div className="space-y-1.5">
                      {warnings.map((w, i) => (
                        <div key={i} className="rounded-lg px-3 py-2 text-xs" style={{ background: w.startsWith("⚠️") ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${w.startsWith("⚠️") ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`, color: w.startsWith("⚠️") ? "#fca5a5" : "#fcd34d" }}>
                          {w}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warning box */}
                  {guide.warning && (
                    <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                      <p className="text-xs" style={{ color: "#fca5a5" }}>{guide.warning}</p>
                    </div>
                  )}

                  {/* Steps */}
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
                      <ChevronRight className="w-3 h-3" /> Yeh Steps Follow Karein
                    </p>
                    <div className="space-y-1.5">
                      {guide.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold mt-0.5" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>{i + 1}</span>
                          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)" }}>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
                      <Lightbulb className="w-3 h-3" /> Pro Tips
                    </p>
                    <ul className="space-y-1">
                      {guide.tips.map((tip, i) => (
                        <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: "rgba(255,255,255,0.65)" }}>
                          <span style={{ color: "#f59e0b" }}>•</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Next step suggestion */}
                  {guide.nextTab && (
                    <button
                      onClick={() => { useCncStore.getState().setActiveTab(guide.nextTab as any); setOpen(false); }}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))", border: "1px solid rgba(245,158,11,0.3)" }}
                    >
                      <span className="text-xs font-semibold" style={{ color: "#fcd34d" }}>Next: {guide.nextTabLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" style={{ color: "#f59e0b" }} />
                    </button>
                  )}
                </>
              )}

              {/* Ask AI Section */}
              <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "#a78bfa" }}>
                  <Sparkles className="w-3 h-3" /> Aur kuch puchna hai?
                </p>
                <textarea
                  className="w-full text-xs rounded-lg px-3 py-2 resize-none outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.85)",
                    minHeight: "60px",
                  }}
                  placeholder={'Sawaal type karein... ya likho:\n"auto mode" / "semi auto" / "manual mode"'}
                  value={userQuestion}
                  onChange={e => setUserQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAI(); } }}
                />
                <button
                  onClick={askAI}
                  disabled={aiLoading || !userQuestion.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all"
                  style={{
                    background: aiLoading || !userQuestion.trim() ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.6)",
                    color: "#e9d5ff",
                    cursor: aiLoading || !userQuestion.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {aiLoading ? <><RefreshCw className="w-3 h-3 animate-spin" /> AI soch raha hai...</> : <><Bot className="w-3 h-3" /> AI se Puchho</>}
                </button>

                {aiResponse && (
                  <div className="rounded-lg p-2.5 text-xs leading-relaxed whitespace-pre-line" style={{ background: "rgba(139,92,246,0.1)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(139,92,246,0.15)" }}>
                    {aiResponse}
                  </div>
                )}
              </div>

              {/* Footer */}
              <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                SAI Rolotech AI Guide • Offline Mode Active
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
