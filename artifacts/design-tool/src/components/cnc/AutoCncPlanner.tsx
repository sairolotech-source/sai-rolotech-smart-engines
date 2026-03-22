import React, { useState, useRef } from "react";
import {
  Cpu, Wrench, Shield, Play, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Copy, Download, RotateCcw, Zap, Info, Loader2, BookOpen
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */
type PlanTab = "planner" | "templates" | "safety" | "prompt-pack";

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

  const TABS = [
    { id: "planner" as PlanTab, label: "AI Process Planner", icon: <Cpu className="w-3.5 h-3.5" /> },
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
