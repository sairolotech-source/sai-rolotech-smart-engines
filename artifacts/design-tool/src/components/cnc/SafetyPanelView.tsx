import React, { useState, useEffect } from "react";
import { Shield, FileCode, ClipboardList, Settings2, Loader2 } from "lucide-react";
import { GcodeSafetyChecker } from "./GcodeSafetyChecker";
import { PreRunChecklist } from "./PreRunChecklist";

type Tab = "checklist" | "checker" | "reference";

interface SolidCAMRef {
  machine: string;
  toolType: string;
  toolNumber: number;
  toolOffset: number;
  toolCode: string;
  orientation: string;
  spinDirection: string;
  feedNormal: number;
  feedFinish: number;
  spinRoughV: number;
  spinRoughRpm: number;
  spinFinishV: number;
  spinFinishRpm: number;
  maxSpin: number;
  referenceDia: number;
  safetyDistance: number;
  stepDown: number;
  roughOffsetX: number;
  roughOffsetZ: number;
  retreatDistance: number;
  roughType: string;
  finishMethod: string;
  gearRange: string;
}

export function SafetyPanelView() {
  const [tab, setTab] = useState<Tab>("checklist");
  const [ref, setRef] = useState<SolidCAMRef | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);

  useEffect(() => {
    if (tab === "reference" && !ref) {
      setLoadingRef(true);
      fetch("/api/solidcam-reference")
        .then(r => r.json())
        .then(d => { if (d.success) setRef(d.reference); })
        .catch(() => {})
        .finally(() => setLoadingRef(false));
    }
  }, [tab, ref]);

  const refRows: { label: string; key: keyof SolidCAMRef; unit?: string; color?: string }[] = [
    { label: "Machine", key: "machine", color: "text-emerald-400" },
    { label: "Tool Type", key: "toolType" },
    { label: "Tool Code (G-Code)", key: "toolCode", color: "text-cyan-400" },
    { label: "Tool Number", key: "toolNumber" },
    { label: "Tool Offset", key: "toolOffset" },
    { label: "Orientation", key: "orientation" },
    { label: "Spin Direction", key: "spinDirection" },
    { label: "Feed Normal", key: "feedNormal", unit: "mm/rev" },
    { label: "Feed Finish", key: "feedFinish", unit: "mm/rev" },
    { label: "Spin Rough (CSS)", key: "spinRoughV", unit: "m/min" },
    { label: "Spin Rough (RPM)", key: "spinRoughRpm", unit: "RPM" },
    { label: "Spin Finish (CSS)", key: "spinFinishV", unit: "m/min" },
    { label: "Spin Finish (RPM)", key: "spinFinishRpm", unit: "RPM" },
    { label: "Max Spindle", key: "maxSpin", unit: "RPM", color: "text-red-400" },
    { label: "Reference Diameter", key: "referenceDia", unit: "mm" },
    { label: "Safety Distance", key: "safetyDistance", unit: "mm" },
    { label: "Step Down", key: "stepDown", unit: "mm" },
    { label: "Rough Offset X", key: "roughOffsetX", unit: "mm" },
    { label: "Rough Offset Z", key: "roughOffsetZ", unit: "mm" },
    { label: "Retreat Distance", key: "retreatDistance", unit: "mm" },
    { label: "Rough Type", key: "roughType" },
    { label: "Finish Method", key: "finishMethod", color: "text-amber-400" },
    { label: "Gear Range", key: "gearRange" },
  ];

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
          <button
            onClick={() => setTab("reference")}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg border-t border-x transition-all ${
              tab === "reference"
                ? "bg-zinc-900 border-zinc-700/60 text-amber-300"
                : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" /> SolidCAM Reference
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

        {tab === "reference" && (
          <div>
            <p className="text-[10px] text-zinc-500 mb-3">
              Aapke actual <span className="text-amber-400 font-semibold">SolidCAM 2024</span> ke Delta 2X settings —
              TR_contour operation, Part5_TurningBD se extract kiye gaye.
            </p>
            {loadingRef ? (
              <div className="flex items-center gap-2 py-8 justify-center text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : ref ? (
              <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                <div className="px-3 py-2 bg-zinc-800/30 border-b border-zinc-800/40 flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold text-zinc-200">SolidCAM Delta 2X — TR_contour Parameters</span>
                </div>
                <div className="divide-y divide-zinc-800/30">
                  {refRows.map(row => (
                    <div key={row.key} className="flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800/20">
                      <span className="text-[10px] text-zinc-400">{row.label}</span>
                      <span className={`text-[11px] font-mono font-semibold ${row.color || "text-zinc-200"}`}>
                        {String(ref[row.key])}{row.unit ? <span className="text-zinc-500 ml-1 text-[9px]">{row.unit}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 bg-zinc-800/20 border-t border-zinc-800/40">
                  <p className="text-[9px] text-zinc-600">
                    Source: SolidCAM 2024 SP0.1 / SolidWorks Premium 2024 SP0.1 — Part5 (Part5_TurningBD)
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-[11px]">
                Reference data load nahi hua — server check karein
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
