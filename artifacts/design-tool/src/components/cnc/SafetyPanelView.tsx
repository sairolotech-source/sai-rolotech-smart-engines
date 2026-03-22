import React, { useState } from "react";
import { Shield, FileCode, ClipboardList } from "lucide-react";
import { GcodeSafetyChecker } from "./GcodeSafetyChecker";
import { PreRunChecklist } from "./PreRunChecklist";

type Tab = "checker" | "checklist";

export function SafetyPanelView() {
  const [tab, setTab] = useState<Tab>("checklist");

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="px-4 pt-4 pb-0 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-zinc-200">Safety Panel</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Delta 2X</span>
        </div>
        <div className="flex gap-1 pb-0">
          <button
            onClick={() => setTab("checklist")}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg border-t border-x transition-all ${
              tab === "checklist"
                ? "bg-zinc-900 border-zinc-700/60 text-emerald-300"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" /> Pre-Run Checklist
          </button>
          <button
            onClick={() => setTab("checker")}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg border-t border-x transition-all ${
              tab === "checker"
                ? "bg-zinc-900 border-zinc-700/60 text-cyan-300"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> G-Code Safety Check
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === "checklist" && (
          <div>
            <p className="text-[10px] text-zinc-500 mb-3">
              Machine chalane se pehle har cheez check karo — machine ready ho tab chalao.
              Red (!) items critical hain — inhe skip mat karo.
            </p>
            <PreRunChecklist />
          </div>
        )}

        {tab === "checker" && (
          <div>
            <p className="text-[10px] text-zinc-500 mb-3">
              Apna <span className="text-cyan-400 font-semibold">.TAP / .NC</span> file drop karo —
              system automatically Delta 2X safety rules ke against check karega.
              Real files (D1, D3, D8) se rules banaye gaye hain.
            </p>
            <GcodeSafetyChecker />
          </div>
        )}
      </div>
    </div>
  );
}
