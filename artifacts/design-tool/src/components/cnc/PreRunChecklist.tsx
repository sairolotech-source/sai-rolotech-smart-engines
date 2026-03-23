import React, { useState, useCallback } from "react";
import { CheckSquare, Square, AlertTriangle, CheckCircle, RotateCcw, Printer, ChevronDown, ChevronRight } from "lucide-react";

interface CheckItem {
  id: string;
  category: string;
  text: string;
  critical: boolean;
  detail?: string;
}

const CHECKLIST_ITEMS: CheckItem[] = [
  { id: "c1",  category: "Machine",  critical: true,  text: "Emergency stop button test kar liya", detail: "Machine on karne se pehle E-stop dabayin aur release karein — light bujh aur jalein" },
  { id: "c2",  category: "Machine",  critical: true,  text: "Chuck properly tighten hai (3-jaw / 4-jaw)", detail: "Chuck key se properly tighten karein — dhila ho to roll fly kar sakta hai" },
  { id: "c3",  category: "Machine",  critical: false, text: "Coolant level check kiya (agar zarurat ho)", detail: "Delta 2X ke rolls pe coolant optional hai — lekin tank empty nahi hona chahiye" },
  { id: "c4",  category: "Machine",  critical: false, text: "Chip tray saaf ki — chips jam nahi hongi", detail: "Zyada chips hone se tool path block ho sakti hai" },
  { id: "c5",  category: "Machine",  critical: true,  text: "Guard / door properly band hai", detail: "Machine chalte waqt door band hona zaroori — flying chip se bachao" },

  { id: "t1",  category: "Tooling",  critical: true,  text: "Correct tool number carousel mein confirm kiya", detail: "T0202 position 2 pe, T0404 position 4 pe — ghalat tool se crash hoga" },
  { id: "t2",  category: "Tooling",  critical: true,  text: "Insert condition dekha — worn ya chipped nahi", detail: "Puraani insert se surface finish kharab aur tool break hone ka risk" },
  { id: "t3",  category: "Tooling",  critical: true,  text: "Tool length offset set aur verify kiya (G43)", detail: "Ghalat offset se Z zero shift ho jaata hai — roll ka profile galat banega" },
  { id: "t4",  category: "Tooling",  critical: false, text: "Tool holder properly clamp hai — loose nahi", detail: "Loose holder se vibration aur chatter — surface kharab" },
  { id: "t5",  category: "Tooling",  critical: false, text: "Custom profile insert (T0303) grind verify kiya", detail: "Custom ground insert ka angle drawing se match karna chahiye" },

  { id: "w1",  category: "Workpiece", critical: true,  text: "Roll blank ka OD measuring tape se check kiya", detail: "Stock OD program ke start X value se zyada hona chahiye (clearance)" },
  { id: "w2",  category: "Workpiece", critical: true,  text: "Roll bore properly indicate kiya — runout < 0.02mm", detail: "High runout se OD eccentric banegi — roll forming mein irregular gap" },
  { id: "w3",  category: "Workpiece", critical: true,  text: "Z zero set kiya — roll ka face", detail: "Z0 = roll ka front face. Ghalat Z zero se poora program offset ho jaata hai" },
  { id: "w4",  category: "Workpiece", critical: false, text: "Roll material grade confirm kiya (D2, H13, etc.)", detail: "Material grade se cutting speed milti hai — ghalat speed pe insert jaldi toot ta hai" },
  { id: "w5",  category: "Workpiece", critical: false, text: "Roll length / width dimension drawing se match kiya", detail: "Width galat ho to roll ka flange profile cut short ho ga" },

  { id: "p1",  category: "Program",  critical: true,  text: "Correct program number machine mein load kiya (O5000)", detail: "Ghalat program number se kisi dusre part ka G-code chalega" },
  { id: "p2",  category: "Program",  critical: true,  text: "Single block mode (SBN) on kiya — pehla run", detail: "Pehli dafa chalane se pehle single block on karein — har line pe ruk ke check karein" },
  { id: "p3",  category: "Program",  critical: true,  text: "Feed override 0% pe set kiya — phir slowly badhao", detail: "100% feed pe seedha chalana dangerous — 0% se start, 30%, 60%, 100% step karo" },
  { id: "p4",  category: "Program",  critical: false, text: "Dry run (machine lock) se path verify kiya", detail: "Machine lock mode mein spindle aur feed run karein — koi actual cut nahi, sirf path dekho" },
  { id: "p5",  category: "Program",  critical: false, text: "G-code safety check app se pass kiya", detail: "Is app ka Safety Checker tab use karein — CRITICAL issues nahi honni chahiyen" },

  { id: "s1",  category: "Safety",   critical: true,  text: "Spindle area mein koi auzaar / rag nahi", detail: "Spindle start pe koi bhi loose cheez fly kar sakti hai" },
  { id: "s2",  category: "Safety",   critical: true,  text: "Operator safety glasses pehne hain", detail: "Chips se aankhon ki safety zaroori" },
  { id: "s3",  category: "Safety",   critical: false, text: "Koi doosra banda machine ke paas nahi khara", detail: "Machining ke waqt sirf operator hi paas ho" },
  { id: "s4",  category: "Safety",   critical: false, text: "Fire extinguisher check kiya — in reach hai", detail: "Coolant fire rare lekin possible — extinguisher paas hona chahiye" },
];

const CATEGORIES = ["Machine", "Tooling", "Workpiece", "Program", "Safety"] as const;

const CAT_COLORS: Record<string, string> = {
  Machine:   "text-cyan-400 bg-cyan-900/20 border-cyan-500/25",
  Tooling:   "text-violet-400 bg-violet-900/20 border-violet-500/25",
  Workpiece: "text-amber-400 bg-amber-900/20 border-amber-500/25",
  Program:   "text-blue-400 bg-blue-900/15 border-blue-500/20",
  Safety:    "text-red-400 bg-red-900/15 border-red-500/20",
};

export function PreRunChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const reset = useCallback(() => {
    setChecked(new Set());
    setShowDetail(null);
  }, []);

  const total = CHECKLIST_ITEMS.length;
  const done = checked.size;
  const criticalItems = CHECKLIST_ITEMS.filter(i => i.critical);
  const criticalDone = criticalItems.filter(i => checked.has(i.id)).length;
  const allCriticalDone = criticalDone === criticalItems.length;
  const progressPct = Math.round((done / total) * 100);

  const readyToRun = allCriticalDone;

  return (
    <div className="space-y-3">
      <div className={`p-3 rounded-xl border ${readyToRun ? "bg-emerald-950/20 border-emerald-500/30" : "bg-zinc-900/50 border-zinc-700/30"}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className={`text-[12px] font-bold ${readyToRun ? "text-emerald-300" : "text-zinc-300"}`}>
              {readyToRun ? "MACHINE READY — RUN KAR SAKTE HO" : "PRE-RUN CHECKLIST"}
            </div>
            <div className="text-[10px] text-zinc-500">
              {done}/{total} complete — Critical: {criticalDone}/{criticalItems.length}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-black font-mono ${readyToRun ? "text-emerald-400" : "text-zinc-400"}`}>{progressPct}%</div>
          </div>
        </div>

        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${readyToRun ? "bg-emerald-500" : allCriticalDone ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {!allCriticalDone && (
          <div className="text-[10px] text-red-400 flex items-center gap-1.5 mt-2">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {criticalItems.length - criticalDone} critical items baaki hain — machine mat chalao
          </div>
        )}
      </div>

      {CATEGORIES.map(cat => {
        const items = CHECKLIST_ITEMS.filter(i => i.category === cat);
        const catDone = items.filter(i => checked.has(i.id)).length;
        const catColor = CAT_COLORS[cat] ?? "";

        return (
          <div key={cat} className="rounded-xl border border-zinc-700/25 overflow-hidden">
            <div className={`px-3 py-2 flex items-center justify-between border-b border-zinc-700/25 ${catColor.split(" ").slice(1).join(" ")}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${catColor.split(" ")[0]}`}>{cat}</span>
              <span className="text-[9px] text-zinc-500">{catDone}/{items.length}</span>
            </div>

            <div className="divide-y divide-zinc-800/50">
              {items.map(item => {
                const isChecked = checked.has(item.id);
                const isExpanded = showDetail === item.id;
                return (
                  <div key={item.id} className={`transition-colors ${isChecked ? "bg-zinc-900/30" : "bg-zinc-900/50"}`}>
                    <div className="flex items-start gap-2.5 px-2.5 py-2">
                      <button
                        onClick={() => toggle(item.id)}
                        className="mt-0.5 shrink-0 transition-colors"
                      >
                        {isChecked
                          ? <CheckSquare className="w-4 h-4 text-emerald-400" />
                          : <Square className={`w-4 h-4 ${item.critical ? "text-red-400/70" : "text-zinc-600"}`} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.critical && !isChecked && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-500/25 font-bold shrink-0">!</span>
                          )}
                          <span className={`text-[11px] leading-tight ${isChecked ? "line-through text-zinc-600" : "text-zinc-200"}`}>
                            {item.text}
                          </span>
                        </div>
                        {item.detail && (
                          <button
                            onClick={() => setShowDetail(isExpanded ? null : item.id)}
                            className="text-[9px] text-zinc-600 hover:text-zinc-400 mt-0.5 flex items-center gap-0.5 transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                            Detail
                          </button>
                        )}
                        {isExpanded && item.detail && (
                          <div className="text-[10px] text-amber-300/80 mt-1.5 p-2 rounded-lg bg-amber-900/10 border border-amber-500/15 leading-relaxed">
                            {item.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex gap-2">
        <button
          onClick={reset}
          className="flex-1 py-2 rounded-lg text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 border border-zinc-700/40 hover:border-zinc-600/60 transition-colors flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3" /> Reset Checklist
        </button>
        <button
          onClick={() => window.print()}
          className="flex-1 py-2 rounded-lg text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 border border-zinc-700/40 hover:border-zinc-600/60 transition-colors flex items-center justify-center gap-1.5"
        >
          <Printer className="w-3 h-3" /> Print
        </button>
      </div>
    </div>
  );
}
