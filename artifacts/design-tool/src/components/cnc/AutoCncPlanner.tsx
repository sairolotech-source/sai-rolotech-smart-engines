import React, { useState, useRef } from "react";
import {
  Cpu, Wrench, Shield, Play, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Copy, Download, RotateCcw, Zap, Info, Loader2, BookOpen
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type PlanTab = "planner" | "tool-library" | "templates" | "safety" | "prompt-pack";

interface MachinePlan {
  setupPlan: string[];
  toolList: { num: string; type: string; dia: string; use: string; rpm: string; feed: string }[];
  operationSequence: { step: number; op: string; tool: string; depth: string; note: string }[];
  feedsAndSpeeds: string[];
  riskPoints: string[];
  solidCamHints: string[];
  safetyNotes: string[];
}

/* ─── Presets ─────────────────────────────────────────────────────────────── */
const MATERIALS = ["MS (Mild Steel)", "Aluminium 6061", "SS 304", "CR Steel", "GI Sheet", "Brass", "Cast Iron", "Tool Steel D2"];
const OPERATIONS = ["Turning (CNC Lathe)", "Milling (VMC)", "Roll Forming", "Grooving", "Threading", "Boring", "Facing", "Profile Turning"];
const CONTROLLERS = ["Delta 2X (Primary)", "Fanuc 0i-TF", "Siemens 828D", "Fanuc 21i-TB", "Mitsubishi M80"];

const TEMPLATES: { name: string; desc: string; plan: MachinePlan }[] = [
  {
    name: "Roll OD Turning — EN31",
    desc: "Roll blank se final OD + contour — 2-setup turning",
    plan: {
      setupPlan: [
        "Setup 1: Chuck on raw blank. Face both ends. Center drill.",
        "Setup 2: Mount between centers. Rough OD → semi-finish → finish contour.",
        "Check runout ≤ 0.02mm before contour pass.",
      ],
      toolList: [
        { num: "T0208", type: "VNMG 060108 R0.8", dia: "—", use: "Rough turning OD", rpm: "S500 (G92)", feed: "F0.175" },
        { num: "T0606", type: "VNMG 160402 R0.2", dia: "—", use: "Finish OD + contour", rpm: "G96 S225", feed: "F0.08" },
        { num: "T0404", type: "Grooving 3mm", dia: "—", use: "Groove / relief", rpm: "G96 S150", feed: "F0.05" },
      ],
      operationSequence: [
        { step: 1, op: "Face + Center drill", tool: "T0208", depth: "0.5mm/pass", note: "Both ends flat" },
        { step: 2, op: "Rough OD", tool: "T0208", depth: "0.75mm/pass", note: "Leave 0.6 X / 0.2 Z for finish" },
        { step: 3, op: "Semi-finish OD", tool: "T0208", depth: "0.3mm", note: "Clean surface" },
        { step: 4, op: "Finish contour", tool: "T0606", depth: "0.1mm", note: "Final profile — check dim after" },
        { step: 5, op: "Groove (if any)", tool: "T0404", depth: "Full width", note: "Slow feed, coolant ON" },
      ],
      feedsAndSpeeds: [
        "Rough: G96 S200 (CSS), Feed 0.175mm/rev, DOC 0.75mm",
        "Finish: G96 S225, Feed 0.08mm/rev, DOC 0.1mm",
        "Groove: G96 S150, Feed 0.05mm/rev",
        "Safety Z: 2mm clearance above part",
      ],
      riskPoints: [
        "EN31 bar is hard — check insert edge after every 3 parts",
        "Thin contour zones: reduce depth of cut to 0.3mm",
        "Vibration check: if chatter, increase support or reduce RPM 10%",
        "Do NOT exceed G92 S500 — spindle protection",
      ],
      solidCamHints: [
        "Use ISO-Turning operation for finish profile",
        "Set Gear#1 in SolidCAM operation (matches Delta 2X setup)",
        "Safety plane = 2mm above chuck face",
        "Simulation: check contour approach angle — no gouging",
      ],
      safetyNotes: [
        "Dry run at 10% feed override before first part",
        "Z-safe height = 50mm minimum during rapid traverse",
        "Chuck pressure: verify for EN31 weight",
        "Coolant ON for all passes",
      ],
    },
  },
  {
    name: "Aluminium VMC Pocket + Profile",
    desc: "VMC milling — pocket + outer profile, 2-setup",
    plan: {
      setupPlan: [
        "Setup 1: Clamp on vise, datum at bottom-left corner (X0,Y0,Z0=top surface).",
        "Setup 2: Flip part, datum at previously machined face.",
        "Use edge finder for X/Y zero. Z: tool touch-off.",
      ],
      toolList: [
        { num: "T01", type: "Face mill Ø63mm", dia: "63mm", use: "Facing top surface", rpm: "2500", feed: "F800" },
        { num: "T02", type: "End mill Ø12mm 4-flute", dia: "12mm", use: "Pocket roughing", rpm: "4000", feed: "F600" },
        { num: "T03", type: "End mill Ø8mm 4-flute", dia: "8mm", use: "Profile + finish", rpm: "5000", feed: "F400" },
        { num: "T04", type: "Drill Ø6mm", dia: "6mm", use: "Holes", rpm: "2000", feed: "F120" },
      ],
      operationSequence: [
        { step: 1, op: "Face milling", tool: "T01", depth: "0.5mm", note: "Full width pass" },
        { step: 2, op: "Pocket rough", tool: "T02", depth: "3mm/pass", note: "Leave 0.3mm wall/floor" },
        { step: 3, op: "Pocket finish floor", tool: "T02", depth: "0.2mm", note: "Single finish pass" },
        { step: 4, op: "Profile rough", tool: "T03", depth: "5mm/pass", note: "0.2mm finish stock" },
        { step: 5, op: "Profile finish", tool: "T03", depth: "Full depth 1-pass", note: "Climb milling" },
        { step: 6, op: "Drilling", tool: "T04", depth: "Through", note: "Pecking cycle G83" },
      ],
      feedsAndSpeeds: [
        "Facing: RPM 2500, Feed 800mm/min, DOC 0.5mm",
        "Pocket rough: RPM 4000, Feed 600mm/min, DOC 3mm, Stepover 50%",
        "Finish: RPM 5000, Feed 400mm/min, DOC 0.2mm",
        "Drill: RPM 2000, Feed 120mm/min, Peck 3mm",
      ],
      riskPoints: [
        "Aluminium built-up edge on tool — coolant/air blast zaroori",
        "Thin walls (< 3mm): stepdown 1mm, full depth aakhir me",
        "Clamp shadow — check tool path vs clamp position",
        "Zero shift drift — re-check datum every setup change",
      ],
      solidCamHints: [
        "Use Pocket operation with HSS/Aluminium technology wizard",
        "Profile: select outer chain, left offset",
        "Set safe Z = 50mm above part top for rapid",
        "Run machine simulation with vise model",
      ],
      safetyNotes: [
        "First run: single block (G50 / block-by-block)",
        "Feed override 20% on first pocket entry",
        "Chip evacuation: air blast every 2 passes",
        "M01 optional stop at each setup change",
      ],
    },
  },
];

/* ─── Safety System ───────────────────────────────────────────────────────── */
const SAFETY_LOCKS = [
  {
    num: "1", title: "Post Processor Match",
    desc: "Controller se exact match hona chahiye. Delta 2X ke liye Delta post. Galat post = crash.",
    check: "Post processor name CNC controller se verify karo",
    color: "red",
  },
  {
    num: "2", title: "Machine Simulation",
    desc: "Tool + holder + clamp + fixture sab simulate karo. Air cut nahi, real machine simulate karo.",
    check: "SolidCAM simulation me machine model + clamp model include karo",
    color: "amber",
  },
  {
    num: "3", title: "Z-Safe Height",
    desc: "Rapid traverse ke waqt Z height kabhi bhi part ya clamp se neche nahi jaani chahiye.",
    check: "Z safe = minimum 50mm above highest point on part + clamp",
    color: "amber",
  },
  {
    num: "4", title: "Dry Run (Air Cutting)",
    desc: "Pehla run hamesha air me karo. Tool part se door rakh ke. Feed override 10–20%.",
    check: "First program run: no material, verify all moves are correct",
    color: "violet",
  },
  {
    num: "5", title: "Feed Override at Start",
    desc: "Production me bhi pehla pass 10–20% feed override pe start karo. Sound, vibration, load observe karo.",
    check: "Start at 10–20% → gradually increase after 1st pass confirmed OK",
    color: "emerald",
  },
];

const RISK_MATRIX = [
  { system: "AI direct G-code (no SolidCAM)", risk: "HIGH ❌", suitable: "Never" },
  { system: "AI + Manual G-code (verified)", risk: "MEDIUM ⚠", suitable: "Simple ops only" },
  { system: "AI Planning + SolidCAM", risk: "LOW ✅", suitable: "Standard production" },
  { system: "AI + SolidCAM + Simulation", risk: "VERY LOW 🔥", suitable: "All operations" },
];

/* ─── Prompt Pack ─────────────────────────────────────────────────────────── */
const PROMPT_TEMPLATES = [
  {
    name: "Master CNC Planner Prompt",
    prompt: `You are a senior CNC machining expert.
Machine: [MACHINE_TYPE] ([CONTROLLER])
Material: [MATERIAL]
Operation: [OPERATION]
Part description: [PART_DESCRIPTION]

Provide a complete and safe machining plan:
1. Setup plan (how many setups, datum location, clamping)
2. Tool list (number, type, diameter, coating, use case)
3. Operation sequence (step by step, roughing → semi-finish → finish)
4. Feeds & speeds (RPM, feed rate, depth of cut, stepover if milling)
5. Risk points (collision risk, thin walls, tool deflection, material issues)
6. SolidCAM operation hints (which operation type, technology wizard settings)
7. Safety notes (dry run, feed override, coolant requirements)

Priority: SAFETY FIRST. Do not suggest aggressive parameters. Prefer conservative feeds/speeds for first run.`,
  },
  {
    name: "Risk Assessment Prompt",
    prompt: `You are a CNC safety engineer.
Review this machining plan for risks:
[PASTE_PLAN_HERE]

Machine: [MACHINE_TYPE] — Controller: [CONTROLLER]

Identify:
1. Collision risk zones
2. Tool deflection risk (long reach, small diameter)
3. Workholding issues (insufficient clamping, vibration points)
4. Z-height safety issues
5. Feed/speed issues (too aggressive or too slow)
6. Material-specific risks (chip control, built-up edge, work hardening)
7. Post-processor compatibility concerns

Rate each risk: LOW / MEDIUM / HIGH
Provide specific fixes for each HIGH risk.`,
  },
  {
    name: "Tool Selection Prompt",
    prompt: `You are a cutting tool specialist.
Material: [MATERIAL], Hardness: [HARDNESS]
Machine: [MACHINE_TYPE]
Operation: [OPERATION]
Required finish: Ra [VALUE] μm

Recommend:
1. Primary tool (insert grade, geometry, coating)
2. Backup tool option
3. Insert life expectancy (parts per edge)
4. Coolant recommendation
5. Recommended RPM and feed range (safe start values)
6. Warning signs of tool failure to watch for

Machine is a [CONTROLLER] controller. Keep parameters conservative.`,
  },
  {
    name: "SolidCAM Setup Prompt",
    prompt: `You are a SolidCAM programming expert.
Part: [PART_DESCRIPTION]
Operations needed: [OPERATION_LIST]
Machine: [MACHINE], Controller: [CONTROLLER]

Advise on SolidCAM setup:
1. Which SolidCAM operation type to use for each operation
2. Technology wizard settings (material, tool type)
3. Toolpath strategy (climb vs conventional, HSM settings)
4. Safety plane and clearance settings
5. Post processor to select
6. Simulation: what to check before running
7. Any template or iMachining settings if applicable`,
  },
];

/* ─── Standard Tool Library ─────────────────────────────────────────────── */
const TOOL_LIBRARIES: {
  machine: string; note: string;
  tools: { num: string; type: string; size: string; insert?: string; coating: string; use: string; rpm: string; feed: string; coolant: string }[];
}[] = [
  {
    machine: "Delta 2X CNC Lathe (Primary)",
    note: "Yeh tool numbers HAMESHA same rakho — har job mein same T numbers. AI ko bhi yahi list do.",
    tools: [
      { num: "T0208", type: "VNMG 060108 Insert — Roughing", size: "Shank 25×25mm", insert: "VNMG 060108 R0.8", coating: "TiAlN (MS/SS)", use: "OD Rough Turning", rpm: "G96 S200 / G92 S500 max", feed: "F0.175 mm/rev", coolant: "ON" },
      { num: "T0404", type: "Grooving / Parting", size: "Shank 25×25mm, Width 3mm", insert: "3mm Grooving", coating: "TiN", use: "Groove / Neck / Relief / Parting", rpm: "G96 S150", feed: "F0.05 mm/rev", coolant: "ON" },
      { num: "T0606", type: "VNMG 160402 Insert — Finishing", size: "Shank 25×25mm", insert: "VNMG 160402 R0.2", coating: "TiAlN (MS/SS)", use: "OD Finish + Contour", rpm: "G96 S225", feed: "F0.08 mm/rev", coolant: "ON" },
      { num: "T0808", type: "Heavy Rough Turning", size: "Shank 25×25mm", insert: "CNMG 120412 R1.2", coating: "TiAlN", use: "Heavy stock removal (large blanks)", rpm: "G96 S150", feed: "F0.25 mm/rev", coolant: "ON" },
      { num: "T1010", type: "Detail / Fine Groove R0.2", size: "Shank 25×25mm", insert: "2mm R0.2", coating: "TiN", use: "Fine groove / chamfer / neck detail", rpm: "G96 S180", feed: "F0.04 mm/rev", coolant: "ON" },
    ],
  },
  {
    machine: "VMC Milling (Fanuc / Siemens)",
    note: "Standard T numbers — same har job. Geometry select → template apply → 80% kaam khatam.",
    tools: [
      { num: "T01", type: "Face Mill Ø50–63mm", size: "Ø50 or 63mm, 5–6 insert", coating: "TiAlN", use: "Face milling — top surface flat karna", rpm: "2000–3000", feed: "F600–1000 mm/min", coolant: "ON" },
      { num: "T02", type: "End Mill Ø12mm 4-flute", size: "Ø12mm", coating: "TiAlN", use: "Pocket roughing + profile rough", rpm: "3500–4500", feed: "F500–700 mm/min", coolant: "ON" },
      { num: "T03", type: "End Mill Ø8mm 4-flute", size: "Ø8mm", coating: "TiAlN", use: "Pocket / profile finish + small features", rpm: "4500–5500", feed: "F300–500 mm/min", coolant: "ON" },
      { num: "T04", type: "Drill Ø6mm (or per drawing)", size: "Ø6–16mm (standard)", coating: "TiN", use: "Hole drilling (through / blind)", rpm: "1500–2500", feed: "F80–150 mm/min", coolant: "ON" },
      { num: "T05", type: "Chamfer Mill 45°", size: "Ø12mm 45°", coating: "TiN", use: "Edge chamfer + deburr", rpm: "2000–3000", feed: "F200–400 mm/min", coolant: "OFF (air)" },
      { num: "T06", type: "Boring Bar (if holes > Ø20)", size: "Ø20–80mm range", coating: "Uncoated / CBN", use: "Precision bore — post drilling", rpm: "800–2000", feed: "F0.05–0.12 mm/rev", coolant: "ON" },
      { num: "T07", type: "Thread Mill / Tap M6–M20", size: "M6 / M8 / M10 standard", coating: "TiN", use: "Thread cutting in holes", rpm: "500–1500", feed: "Per pitch", coolant: "ON" },
    ],
  },
];

const SOLIDCAM_TEMPLATE_CONFIGS: {
  name: string; color: string; desc: string;
  settings: { key: string; value: string; note: string }[];
  sequence: string[];
}[] = [
  {
    name: "Roughing Template",
    color: "red",
    desc: "Maximum stock removal — conservative stepdown, large stepover",
    settings: [
      { key: "Operation Type", value: "Profile / Pocket 3D Rough", note: "SolidCAM → Profile operation" },
      { key: "Step Down (DOC)", value: "0.75 mm (MS) / 1.5 mm (Alum)", note: "Conservative — no chatter" },
      { key: "Step Over", value: "50% of tool dia", note: "Ø12 tool → 6mm stepover" },
      { key: "Feed Rate", value: "F0.175 mm/rev (Lathe) / F600 (VMC)", note: "Rough feed — not finish speed" },
      { key: "Clearance Plane", value: "Z+50mm above part top", note: "NEVER low — crash risk" },
      { key: "Finish Stock (X)", value: "0.6 mm radial", note: "Leave for finish pass" },
      { key: "Finish Stock (Z)", value: "0.2 mm axial", note: "Leave for finish pass" },
      { key: "Entry Type", value: "Helical / Ramp (no plunge)", note: "Plunge = tool break risk" },
      { key: "Coolant", value: "ON (mandatory)", note: "Heat = insert life down" },
    ],
    sequence: ["Geometry select karo", "Tool T0208 / T02 assign karo", "Template apply karo", "Stepdown verify karo", "Simulate karo"],
  },
  {
    name: "Finishing Template",
    color: "emerald",
    desc: "Final dimension + surface finish — minimum DOC, slow feed",
    settings: [
      { key: "Operation Type", value: "ISO-Turning Finish / Profile Finish", note: "SolidCAM → ISO-Turning for lathe" },
      { key: "Step Down (DOC)", value: "0.1 mm (MS) / 0.2 mm (Alum)", note: "Very light — Ra finish ke liye" },
      { key: "Step Over", value: "10–15% of tool dia", note: "Scallop height control" },
      { key: "Feed Rate", value: "F0.08 mm/rev (Lathe) / F300 (VMC)", note: "Slow = better Ra" },
      { key: "Clearance Plane", value: "Z+50mm (same as rough)", note: "Consistent with roughing setup" },
      { key: "RPM", value: "G96 S225 (lathe CSS) / RPM 5000 (VMC)", note: "Higher speed = better finish" },
      { key: "Entry Type", value: "Tangential approach", note: "Gradual entry — no witness mark" },
      { key: "Coolant", value: "ON — high pressure preferred", note: "Chip evacuation critical" },
      { key: "Retreat", value: "0.2 mm overtravel", note: "Clean end point, no drag" },
    ],
    sequence: ["Rough done + verified karo", "Tool T0606 / T03 assign karo", "Same geometry select karo", "Finish template apply karo", "Dimension check karo after"],
  },
  {
    name: "Pocket Template",
    color: "violet",
    desc: "Closed pocket milling — floor + walls — HSM preferred",
    settings: [
      { key: "Operation Type", value: "SolidCAM Pocket Operation", note: "Select closed chain boundary" },
      { key: "Step Down (DOC)", value: "3 mm rough / 0.2 mm finish", note: "Aluminium: DOC 5mm rough" },
      { key: "Step Over", value: "40–50% rough, 5% finish", note: "Finish: 0.5mm for Ra control" },
      { key: "Feed Rate", value: "F600 rough / F400 finish mm/min", note: "Per VMC recommendation" },
      { key: "Clearance Plane", value: "Z+30mm above part", note: "Must clear all clamps" },
      { key: "Floor Finish", value: "0.2 mm last pass only", note: "Single finish pass = best Ra" },
      { key: "Wall Finish", value: "0.2 mm radial leave in rough", note: "Finish pass removes it" },
      { key: "Corner Strategy", value: "Corner Rounding ON", note: "Sharp corner = tool break" },
      { key: "Entry", value: "Helical into pocket center", note: "NO direct Z plunge" },
    ],
    sequence: ["Pocket boundary select karo", "Tool T02 rough / T03 finish", "Rough template → simulate", "Finish template apply karo", "Probe check after floor"],
  },
  {
    name: "Drilling Template",
    color: "amber",
    desc: "Hole drilling — peck cycle for deep holes — all sizes",
    settings: [
      { key: "Operation Type", value: "Drilling / G83 Peck Cycle", note: "Deep holes: peck = chip break" },
      { key: "Peck Depth", value: "3× drill dia per peck", note: "Ø6 drill → 18mm peck" },
      { key: "Feed Rate", value: "F0.12–0.18 mm/rev", note: "Dia 6mm: F120 mm/min" },
      { key: "RPM", value: "2000 (Ø6) / 1200 (Ø12)", note: "Smaller dia = higher RPM" },
      { key: "Clearance Plane", value: "Z+10mm above part top", note: "Drilling: 10mm enough" },
      { key: "Retract", value: "R-plane = Z+5mm above hole", note: "Peck cycle retract point" },
      { key: "Dwell", value: "0.2 sec at bottom", note: "Clean hole bottom" },
      { key: "Spot Drill First", value: "YES — Ø10mm 90° spot", note: "Accuracy + no walking" },
      { key: "Coolant", value: "Flood ON / or through-coolant", note: "Heat = drill breakage" },
    ],
    sequence: ["Hole positions select karo", "Spot drill T05 pehle", "Drill T04 assign karo", "Peck template apply karo", "Measure dia + depth after"],
  },
];

/* ─── AI Planner using Gemini ──────────────────────────────────────────────── */
async function callGemini(prompt: string): Promise<string> {
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY
    || (import.meta as any).env?.AI_INTEGRATIONS_GEMINI_API_KEY
    || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response";
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export function AutoCncPlanner() {
  const [tab, setTab] = useState<PlanTab>("planner");
  const [material, setMaterial] = useState("MS (Mild Steel)");
  const [operation, setOperation] = useState("Turning (CNC Lathe)");
  const [controller, setController] = useState("Delta 2X (Primary)");
  const [partDesc, setPartDesc] = useState("Roll blank OD turning, EN31 steel, OD 150mm, length 200mm, final contour groove");
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<MachinePlan | null>(null);
  const [safetyChecked, setSafetyChecked] = useState<Record<string, boolean>>({});
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  const [selectedLibMachine, setSelectedLibMachine] = useState(0);
  const [selectedTplCfg, setSelectedTplCfg] = useState(0);

  const TABS = [
    { id: "planner" as PlanTab, label: "AI Process Planner", icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: "tool-library" as PlanTab, label: "Tool Library", icon: <Wrench className="w-3.5 h-3.5" /> },
    { id: "templates" as PlanTab, label: "SolidCAM Templates", icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: "safety" as PlanTab, label: "Safety System", icon: <Shield className="w-3.5 h-3.5" /> },
    { id: "prompt-pack" as PlanTab, label: "AI Prompt Pack", icon: <Zap className="w-3.5 h-3.5" /> },
  ];

  const generatePlan = async () => {
    setLoading(true); setError(""); setAiResponse("");
    try {
      const prompt = `You are a senior CNC machining expert working in a roll forming tool manufacturing company (Sai Rolotech).
Machine: ${operation} — Controller: ${controller}
Material: ${material}
Part: ${partDesc}

Provide a complete, safe machining plan in this exact format:

## SETUP PLAN
(numbered setup steps)

## TOOL LIST
(table format: Tool# | Type | Diameter | Use | RPM | Feed)

## OPERATION SEQUENCE
(numbered steps: Step | Operation | Tool | Depth/Pass | Important Note)

## FEEDS & SPEEDS
(bullet points — conservative safe values)

## RISK POINTS
(bullet points — specific risks for this part/material)

## SOLIDCAM HINTS
(SolidCAM-specific settings and operation types)

## SAFETY NOTES
(mandatory safety steps before running)

Priority: SAFETY FIRST. Use conservative parameters. If ${controller} is Delta 2X lathe, follow SolidCAM Turning conventions (G96, G92 S500 max, Safety 2mm, Gear#1).`;
      const resp = await callGemini(prompt);
      setAiResponse(resp);
      setTimeout(() => responseRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e: any) {
      setError(e.message || "Gemini API error");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  const allSafetyChecked = SAFETY_LOCKS.every(l => safetyChecked[l.num]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="px-4 pt-4 pb-0 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-zinc-200">Auto CNC AI System</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">AI + SolidCAM</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Safety First</span>
        </div>
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg border-t border-x transition-all ${
                tab === t.id
                  ? "bg-zinc-900 border-zinc-700/60 text-emerald-300"
                  : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">

        {/* ── AI PROCESS PLANNER ── */}
        {tab === "planner" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold text-emerald-300">AI Safe Flow: Drawing → AI Plan → SolidCAM → Simulation → Machine</span>
              </div>
              <p className="text-[10px] text-zinc-400">
                AI 100% direct machining nahi karta — AI planning karata hai, SolidCAM machining karata hai.
                Isse 80–90% automation + near-zero crash risk milti hai.
              </p>
            </div>

            {/* Inputs */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-3">
              <div className="text-[10px] font-semibold text-zinc-400 mb-3">Machining Parameters</div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Material</label>
                  <select value={material} onChange={e => setMaterial(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1.5 text-[11px] text-zinc-200">
                    {MATERIALS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">Operation Type</label>
                  <select value={operation} onChange={e => setOperation(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1.5 text-[11px] text-zinc-200">
                    {OPERATIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 block mb-1">CNC Controller</label>
                  <select value={controller} onChange={e => setController(e.target.value)}
                    className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1.5 text-[11px] text-zinc-200">
                    {CONTROLLERS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 block mb-1">Part Description (jitna detail doge, utna better plan)</label>
                <textarea value={partDesc} onChange={e => setPartDesc(e.target.value)} rows={3}
                  className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-1.5 text-[11px] text-zinc-200 resize-none" />
              </div>
              <button onClick={generatePlan} disabled={loading}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {loading ? "AI Plan Generate ho raha hai..." : "AI se Complete Plan Generate Karo"}
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-red-300">AI Error</p>
                  <p className="text-[10px] text-red-400 mt-0.5">{error}</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Check: GEMINI_API_KEY secret set hai? Niche Templates tab me manual templates use karo.</p>
                </div>
              </div>
            )}

            {aiResponse && (
              <div ref={responseRef} className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/40 border-b border-zinc-700/40">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold text-zinc-200">AI Generated Machining Plan</span>
                  <span className="text-[9px] text-zinc-500 ml-1">— Verify before SolidCAM me enter karo</span>
                  <button onClick={() => copyText(aiResponse)}
                    className="ml-auto flex items-center gap-1 text-[9px] px-2 py-1 rounded bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <div className="p-4 text-[11px] text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                  {aiResponse}
                </div>
                <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] text-amber-300">
                    AI ka plan verify karo — Safety tab check karo — Dry run zaroor karo — Phir production chalao
                  </p>
                </div>
              </div>
            )}

            {/* Risk Matrix */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-800/30 border-b border-zinc-800/40">
                <span className="text-[11px] font-bold text-zinc-200">AI + SolidCAM Risk Comparison</span>
              </div>
              <table className="w-full text-[10px]">
                <thead><tr className="bg-zinc-800/20 text-zinc-500 text-[9px]">
                  <th className="px-3 py-1.5 text-left">System</th>
                  <th className="px-3 py-1.5 text-left">Risk Level</th>
                  <th className="px-3 py-1.5 text-left">Suitable For</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-800/30">
                  {RISK_MATRIX.map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-800/20">
                      <td className="px-3 py-1.5 text-zinc-300">{r.system}</td>
                      <td className="px-3 py-1.5 font-semibold">{r.risk}</td>
                      <td className="px-3 py-1.5 text-zinc-400">{r.suitable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TOOL LIBRARY ── */}
        {tab === "tool-library" && (
          <div className="space-y-4">
            {/* Workflow Diagram */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-[10px] font-bold text-emerald-300 mb-2">Factory Level Automation Flow</div>
              <div className="flex items-center gap-1 flex-wrap text-[10px] font-mono">
                {["Drawing/CAD", "→", "AI Plan", "→", "SolidCAM", "→", "Post Processor", "→", "Simulation", "→", "Machine"].map((item, i) => (
                  <span key={i} className={item === "→" ? "text-zinc-600" : "px-2 py-1 rounded bg-zinc-800/60 border border-zinc-700/40 text-zinc-200 font-semibold"}>
                    {item}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-zinc-500 mt-2">
                Rule: Har step complete hone ke baad hi next step jaao. Skip = crash risk.
              </p>
            </div>

            {/* Machine Selector */}
            <div className="flex gap-2">
              {TOOL_LIBRARIES.map((lib, i) => (
                <button key={i} onClick={() => setSelectedLibMachine(i)}
                  className={`flex-1 text-left p-2.5 rounded-lg border text-[10px] font-semibold transition-all ${
                    selectedLibMachine === i
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                      : "border-zinc-800/60 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700"
                  }`}>
                  {lib.machine}
                </button>
              ))}
            </div>

            {/* Note */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-300">{TOOL_LIBRARIES[selectedLibMachine].note}</p>
            </div>

            {/* Tool Table */}
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-800/30 border-b border-zinc-800/40 flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-bold text-zinc-200">Standard Tool Numbers — {TOOL_LIBRARIES[selectedLibMachine].machine}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-zinc-800/30 text-zinc-500 text-[9px]">
                      <th className="px-2 py-2 text-left w-16">T#</th>
                      <th className="px-2 py-2 text-left">Type / Insert</th>
                      <th className="px-2 py-2 text-left">Coating</th>
                      <th className="px-2 py-2 text-left">Use</th>
                      <th className="px-2 py-2 text-left">RPM / Speed</th>
                      <th className="px-2 py-2 text-left">Feed</th>
                      <th className="px-2 py-2 text-left w-16">Coolant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {TOOL_LIBRARIES[selectedLibMachine].tools.map((t, i) => (
                      <tr key={i} className="hover:bg-zinc-800/20">
                        <td className="px-2 py-2 font-mono font-bold text-violet-300">{t.num}</td>
                        <td className="px-2 py-2">
                          <div className="text-zinc-200 font-semibold">{t.type}</div>
                          {t.insert && <div className="text-zinc-500 text-[9px]">{t.insert} — {t.size}</div>}
                          {!t.insert && <div className="text-zinc-500 text-[9px]">{t.size}</div>}
                        </td>
                        <td className="px-2 py-2 text-zinc-400">{t.coating}</td>
                        <td className="px-2 py-2 text-zinc-300">{t.use}</td>
                        <td className="px-2 py-2 font-mono text-amber-300">{t.rpm}</td>
                        <td className="px-2 py-2 font-mono text-cyan-300">{t.feed}</td>
                        <td className="px-2 py-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${t.coolant === "ON" ? "bg-blue-500/20 text-blue-300" : "bg-zinc-700/40 text-zinc-400"}`}>
                            {t.coolant}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SolidCAM Template Configs */}
            <div className="text-[11px] font-bold text-zinc-300 mt-2">SolidCAM Operation Template Configs</div>
            <div className="grid grid-cols-2 gap-2">
              {SOLIDCAM_TEMPLATE_CONFIGS.map((cfg, i) => (
                <button key={i} onClick={() => setSelectedTplCfg(i)}
                  className={`text-left p-2.5 rounded-lg border transition-all ${
                    selectedTplCfg === i
                      ? `border-${cfg.color}-500/50 bg-${cfg.color}-500/10`
                      : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700"
                  }`}>
                  <div className={`text-[11px] font-semibold ${selectedTplCfg === i ? `text-${cfg.color}-300` : "text-zinc-200"}`}>{cfg.name}</div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{cfg.desc}</div>
                </button>
              ))}
            </div>

            {(() => {
              const cfg = SOLIDCAM_TEMPLATE_CONFIGS[selectedTplCfg];
              return (
                <div className="space-y-3">
                  <div className={`rounded-lg border border-${cfg.color}-500/20 bg-${cfg.color}-500/5 overflow-hidden`}>
                    <div className={`px-3 py-2 bg-${cfg.color}-500/10 border-b border-${cfg.color}-500/20`}>
                      <span className={`text-[11px] font-bold text-${cfg.color}-300`}>{cfg.name} — Parameter Settings</span>
                    </div>
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-zinc-800/20 text-zinc-500 text-[9px]">
                          <th className="px-3 py-1.5 text-left w-36">Parameter</th>
                          <th className="px-3 py-1.5 text-left w-40">Value</th>
                          <th className="px-3 py-1.5 text-left">Note / Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/30">
                        {cfg.settings.map((s, si) => (
                          <tr key={si} className="hover:bg-zinc-800/20">
                            <td className="px-3 py-1.5 font-semibold text-zinc-300">{s.key}</td>
                            <td className="px-3 py-1.5 font-mono font-bold text-amber-300">{s.value}</td>
                            <td className="px-3 py-1.5 text-zinc-500">{s.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className={`rounded-lg border border-${cfg.color}-500/20 bg-${cfg.color}-500/5 p-3`}>
                    <div className={`text-[10px] font-bold text-${cfg.color}-300 mb-2`}>Apply Sequence (SolidCAM me step-by-step)</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {cfg.sequence.map((step, si) => (
                        <React.Fragment key={si}>
                          <span className="text-[10px] px-2 py-1 rounded bg-zinc-800/60 border border-zinc-700/40 text-zinc-200">{si + 1}. {step}</span>
                          {si < cfg.sequence.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Rule Box */}
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <div className="text-[10px] font-bold text-violet-300 mb-2">Golden Rule — Automation Ka Secret</div>
              <div className="space-y-1">
                {[
                  "Same Tool Numbers → har job mein same T numbers use karo → confusion zero",
                  "AI ko Tool Library do → AI same numbers mein plan deta hai → SolidCAM auto-link",
                  "Template pehle set karo → geometry baad mein select karo → 80% kaam 1 click",
                  "Simulate hamesha → Crash pehle screen pe, machine pe kabhi nahi",
                ].map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-zinc-300">
                    <span className="text-violet-400 font-bold shrink-0">✓</span> {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SOLIDCAM TEMPLATES ── */}
        {tab === "templates" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map(t => (
                <button key={t.name} onClick={() => setSelectedTemplate(t.plan)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedTemplate === t.plan
                      ? "border-violet-500/50 bg-violet-500/10"
                      : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700"
                  }`}>
                  <div className="text-[11px] font-semibold text-zinc-200 mb-1">{t.name}</div>
                  <div className="text-[10px] text-zinc-500">{t.desc}</div>
                </button>
              ))}
            </div>

            {selectedTemplate && (
              <div className="space-y-3">
                <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                  <div className="px-3 py-2 bg-violet-500/10 border-b border-zinc-800/40">
                    <span className="text-[11px] font-bold text-zinc-200">Setup Plan</span>
                  </div>
                  {selectedTemplate.setupPlan.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-zinc-800/20 last:border-0">
                      <span className="text-[10px] font-mono text-violet-400 shrink-0">{i + 1}.</span>
                      <span className="text-[10px] text-zinc-300">{s}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                  <div className="px-3 py-2 bg-cyan-500/10 border-b border-zinc-800/40">
                    <span className="text-[11px] font-bold text-zinc-200">Tool List</span>
                  </div>
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-zinc-800/20 text-zinc-500 text-[9px]">
                      <th className="px-2 py-1 text-left">T#</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-left">Use</th>
                      <th className="px-2 py-1 text-left">RPM</th>
                      <th className="px-2 py-1 text-left">Feed</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/30">
                      {selectedTemplate.toolList.map((t, i) => (
                        <tr key={i} className="hover:bg-zinc-800/20">
                          <td className="px-2 py-1 font-mono font-bold text-violet-300">{t.num}</td>
                          <td className="px-2 py-1 text-zinc-200">{t.type}</td>
                          <td className="px-2 py-1 text-zinc-400">{t.use}</td>
                          <td className="px-2 py-1 font-mono text-amber-300">{t.rpm}</td>
                          <td className="px-2 py-1 font-mono text-cyan-300">{t.feed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                  <div className="px-3 py-2 bg-emerald-500/10 border-b border-zinc-800/40">
                    <span className="text-[11px] font-bold text-zinc-200">Operation Sequence</span>
                  </div>
                  <table className="w-full text-[10px]">
                    <thead><tr className="bg-zinc-800/20 text-zinc-500 text-[9px]">
                      <th className="px-2 py-1 text-left w-10">Step</th>
                      <th className="px-2 py-1 text-left">Operation</th>
                      <th className="px-2 py-1 text-left w-16">Tool</th>
                      <th className="px-2 py-1 text-left w-24">Depth</th>
                      <th className="px-2 py-1 text-left">Note</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-800/30">
                      {selectedTemplate.operationSequence.map((s) => (
                        <tr key={s.step} className="hover:bg-zinc-800/20">
                          <td className="px-2 py-1 font-mono font-bold text-emerald-400">{s.step}</td>
                          <td className="px-2 py-1 text-zinc-200">{s.op}</td>
                          <td className="px-2 py-1 font-mono text-violet-300">{s.tool}</td>
                          <td className="px-2 py-1 font-mono text-amber-300">{s.depth}</td>
                          <td className="px-2 py-1 text-zinc-400">{s.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {[
                  { title: "Feeds & Speeds", data: selectedTemplate.feedsAndSpeeds, color: "amber" },
                  { title: "Risk Points", data: selectedTemplate.riskPoints, color: "red" },
                  { title: "SolidCAM Hints", data: selectedTemplate.solidCamHints, color: "violet" },
                  { title: "Safety Notes", data: selectedTemplate.safetyNotes, color: "emerald" },
                ].map(section => (
                  <div key={section.title} className={`rounded-lg border border-${section.color}-500/20 bg-${section.color}-500/5 overflow-hidden`}>
                    <div className={`px-3 py-2 bg-${section.color}-500/10 border-b border-${section.color}-500/20`}>
                      <span className={`text-[11px] font-bold text-${section.color}-300`}>{section.title}</span>
                    </div>
                    {section.data.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-zinc-800/20 last:border-0">
                        <span className={`text-${section.color}-500 mt-0.5 shrink-0`}>›</span>
                        <span className="text-[10px] text-zinc-300">{d}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SAFETY SYSTEM ── */}
        {tab === "safety" && (
          <div className="space-y-4">
            <div className={`rounded-lg border p-3 ${allSafetyChecked ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
              <div className="flex items-center gap-2">
                {allSafetyChecked
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                <span className={`text-[12px] font-bold ${allSafetyChecked ? "text-emerald-300" : "text-amber-300"}`}>
                  {allSafetyChecked ? "✅ All 5 Safety Locks Active — Safe to Run" : `⚠ ${5 - Object.values(safetyChecked).filter(Boolean).length} Safety Lock(s) Remaining`}
                </span>
              </div>
            </div>

            {SAFETY_LOCKS.map(lock => (
              <div key={lock.num} className={`rounded-lg border overflow-hidden transition-all ${
                safetyChecked[lock.num] ? "border-emerald-500/30 bg-emerald-500/5" : `border-${lock.color}-500/30 bg-${lock.color}-500/5`
              }`}>
                <div className={`flex items-start gap-3 px-3 py-3 cursor-pointer`}
                  onClick={() => setSafetyChecked(prev => ({ ...prev, [lock.num]: !prev[lock.num] }))}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all ${
                    safetyChecked[lock.num] ? "bg-emerald-500 border-emerald-400" : `border-${lock.color}-500/50 bg-transparent`
                  }`}>
                    {safetyChecked[lock.num]
                      ? <CheckCircle2 className="w-4 h-4 text-white" />
                      : <span className={`text-[11px] font-bold text-${lock.color}-400`}>{lock.num}</span>}
                  </div>
                  <div className="flex-1">
                    <div className={`text-[12px] font-bold mb-1 ${safetyChecked[lock.num] ? "text-emerald-300 line-through opacity-60" : "text-zinc-200"}`}>
                      Safety Lock {lock.num}: {lock.title}
                    </div>
                    <p className="text-[10px] text-zinc-400">{lock.desc}</p>
                    <div className="mt-2 flex items-start gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400 font-semibold shrink-0">CHECK</span>
                      <span className="text-[10px] text-zinc-300">{lock.check}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-red-500/20 bg-red-500/5 overflow-hidden">
              <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20">
                <span className="text-[11px] font-bold text-red-300">KABHI MAT KARO — Absolute Rules</span>
              </div>
              {[
                "AI ka direct G-code bina SolidCAM simulation ke machine me load karna",
                "Post processor change karna bina verify kiye",
                "Z-safe height chhota karna part se bachane ke liye",
                "Dry run skip karna (time bachane ke liye)",
                "Feed override 100% first run me",
                "Same G-code code dusri machine ya controller pe use karna bina post change ke",
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-1.5 border-b border-zinc-800/20 last:border-0">
                  <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                  <span className="text-[10px] text-zinc-300">{r}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setSafetyChecked({})}
              className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded border border-zinc-700/40 text-zinc-500 hover:text-zinc-300">
              <RotateCcw className="w-3 h-3" /> Reset Safety Checklist
            </button>
          </div>
        )}

        {/* ── PROMPT PACK ── */}
        {tab === "prompt-pack" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <p className="text-[10px] text-violet-300">
                Yeh prompts AI ko ek senior CNC engineer ki tarah sochne par majbur karte hain.
                Copy karo → AI chat me paste karo → [BRACKETS] wali values fill karo → Plan lo.
              </p>
            </div>
            {PROMPT_TEMPLATES.map((pt, i) => (
              <div key={i} className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                <button className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-800/20"
                  onClick={() => setExpandedPrompt(expandedPrompt === i ? null : i)}>
                  {expandedPrompt === i ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />}
                  <span className="text-[11px] font-semibold text-zinc-200">{pt.name}</span>
                  <button onClick={e => { e.stopPropagation(); copyText(pt.prompt); }}
                    className="ml-auto flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-400 hover:text-zinc-200">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </button>
                {expandedPrompt === i && (
                  <div className="border-t border-zinc-800/40 p-3 bg-zinc-950/50">
                    <pre className="text-[10px] text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{pt.prompt}</pre>
                  </div>
                )}
              </div>
            ))}

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-[11px] font-bold text-emerald-300 mb-2">Advanced Automation Concept (Future)</div>
              <div className="text-[10px] text-zinc-400 font-mono bg-zinc-900/50 rounded p-2">
                {`AI → JSON Plan → Script → SolidCAM Auto Operations\n\nFlow:\n1. AI generates structured JSON plan\n2. Python/VBA script reads JSON\n3. SolidCAM API auto-creates operations\n4. Post-processor generates G-code\n5. Simulation validates\n6. Machine receives safe code`}
              </div>
              <p className="text-[9px] text-zinc-500 mt-2">Industry high-end factories me yeh system use hota hai. Phase 2 development me include karenge.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
