import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Cog, ChevronDown, ChevronRight, AlertTriangle, Info, CheckCircle } from "lucide-react";

function InfoPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-white/[0.07] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors"
      >
        <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Industry Tips</span>
        <span className="ml-auto">{open ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] space-y-1.5">
          {[
            { icon: "⚡", tip: "VFD Recommended — Variable Frequency Drive allows smooth speed control and soft start, reducing mechanical shock on gearbox." },
            { icon: "🔒", tip: "Safety Oversize — Select gearbox rated for 1.5× calculated torque to handle peak load spikes during strip entry." },
            { icon: "🛡", tip: "Overload Protection — Install a torque limiter or shear pin coupling between gearbox and roll shaft to prevent roll damage on jams." },
            { icon: "🌡", tip: "Thermal Check — Gearbox oil temperature should stay below 80°C. Add forced cooling for continuous runs above 30 min." },
            { icon: "📐", tip: "Gear Ratio 10–50:1 is the practical range for roll forming. Below 10:1 risks roll over-speed; above 50:1 causes excessive torque build-up." },
          ].map(({ icon, tip }) => (
            <div key={icon} className="flex items-start gap-2 text-[10px] text-zinc-400">
              <span className="flex-shrink-0 text-sm leading-none mt-0.5">{icon}</span>
              <span className="leading-tight">{tip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GearboxCalculator() {
  const {
    lineSpeed,
    rollDiameter,
    motorRPM,
    motorPower,
    setLineSpeed,
    setRollDiameter,
    setMotorRPM,
    setMotorPower,
  } = useCncStore();

  const [expanded, setExpanded] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  const results = useMemo(() => {
    const rollRPM = (1000 * lineSpeed) / (Math.PI * rollDiameter);
    const gearRatio = motorRPM / rollRPM;
    const outputTorque = (9550 * motorPower) / rollRPM;

    let ratioStatus: "ok" | "low" | "high" = "ok";
    if (gearRatio < 10) ratioStatus = "low";
    else if (gearRatio > 50) ratioStatus = "high";

    return {
      rollRPM: isFinite(rollRPM) ? rollRPM : 0,
      gearRatio: isFinite(gearRatio) ? gearRatio : 0,
      outputTorque: isFinite(outputTorque) ? outputTorque : 0,
      ratioStatus,
    };
  }, [lineSpeed, rollDiameter, motorRPM, motorPower]);

  const inputCls = "w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none";

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Cog className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Drive System</span>
        <span className="ml-auto">{expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/[0.06]">

          {/* Inputs */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Line Speed (m/min)</label>
              <input
                type="number" min={1} step={1} value={lineSpeed}
                onChange={(e) => setLineSpeed(parseFloat(e.target.value) || 1)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Roll Diameter (mm)</label>
              <input
                type="number" min={10} step={5} value={rollDiameter}
                onChange={(e) => setRollDiameter(parseFloat(e.target.value) || 150)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Motor Power (kW)</label>
              <input
                type="number" min={0.5} step={0.5} value={motorPower}
                onChange={(e) => setMotorPower(parseFloat(e.target.value) || 15)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Motor RPM</label>
              <input
                type="number" min={100} step={60} value={motorRPM}
                onChange={(e) => setMotorRPM(parseFloat(e.target.value) || 1440)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Formula reference */}
          <div className="text-[9px] text-zinc-600 space-y-0.5 bg-zinc-900/50 rounded p-2 border border-zinc-800">
            <div>Roll RPM = (1000 × Speed) ÷ (π × Roll Dia)</div>
            <div>Gear Ratio = Motor RPM ÷ Roll RPM</div>
            <div>Output Torque = (9550 × Power) ÷ Roll RPM</div>
          </div>

          {/* Results */}
          <div className="space-y-2">
            {/* Roll RPM */}
            <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-700/60 rounded-lg px-3 py-2">
              <span className="text-[10px] text-zinc-400">Roll RPM</span>
              <span className="text-sm font-bold text-violet-300 font-mono">{results.rollRPM.toFixed(2)} <span className="text-[10px] font-normal text-zinc-500">rpm</span></span>
            </div>

            {/* Gear Ratio */}
            <div className={`flex items-center justify-between border rounded-lg px-3 py-2 ${
              results.ratioStatus === "ok"
                ? "bg-emerald-950/30 border-emerald-700/40"
                : "bg-red-950/40 border-red-700/50"
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-400">Gear Ratio</span>
                {results.ratioStatus === "ok"
                  ? <CheckCircle className="w-3 h-3 text-emerald-400" />
                  : <AlertTriangle className="w-3 h-3 text-red-400" />
                }
              </div>
              <span className={`text-sm font-bold font-mono ${results.ratioStatus === "ok" ? "text-emerald-300" : "text-red-300"}`}>
                {results.gearRatio.toFixed(1)}<span className="text-[10px] font-normal text-zinc-500">:1</span>
              </span>
            </div>

            {/* Gear ratio alert */}
            {results.ratioStatus !== "ok" && (
              <div className="flex items-start gap-1.5 bg-red-950/40 border border-red-700/40 rounded p-2 text-[10px] text-red-300">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-red-400" />
                <div>
                  <div className="font-semibold">
                    {results.ratioStatus === "low" ? "Gear ratio too low (< 10:1)" : "Gear ratio too high (> 50:1)"}
                  </div>
                  <div className="text-red-400/70 mt-0.5">
                    {results.ratioStatus === "low"
                      ? "Roll over-speed risk. Increase motor RPM or decrease roll diameter."
                      : "Excessive torque build-up. Reduce motor RPM or increase roll diameter."}
                  </div>
                </div>
              </div>
            )}

            {/* Output Torque */}
            <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-700/60 rounded-lg px-3 py-2">
              <span className="text-[10px] text-zinc-400">Output Torque</span>
              <span className="text-sm font-bold text-amber-300 font-mono">{results.outputTorque.toFixed(1)} <span className="text-[10px] font-normal text-zinc-500">N·m</span></span>
            </div>
          </div>

          {/* Summary Card */}
          <div className="rounded-lg border border-violet-500/20 bg-violet-950/20 p-2.5 space-y-1.5">
            <div className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">Recommended Drive Setup</div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex justify-between border-b border-violet-900/50 pb-1">
                <span className="text-zinc-400">Motor</span>
                <span className="text-zinc-200 font-mono">{motorPower} kW / {motorRPM} rpm</span>
              </div>
              <div className="flex justify-between border-b border-violet-900/50 pb-1">
                <span className="text-zinc-400">Roll RPM</span>
                <span className="text-zinc-200 font-mono">{results.rollRPM.toFixed(2)} rpm</span>
              </div>
              <div className="flex justify-between border-b border-violet-900/50 pb-1">
                <span className="text-zinc-400">Gearbox</span>
                <span className={`font-mono font-bold ${results.ratioStatus === "ok" ? "text-emerald-300" : "text-red-300"}`}>{results.gearRatio.toFixed(1)}:1</span>
              </div>
              <div className="flex justify-between border-b border-violet-900/50 pb-1">
                <span className="text-zinc-400">Torque</span>
                <span className="text-amber-300 font-mono">{results.outputTorque.toFixed(1)} N·m</span>
              </div>
              <div className="col-span-2 flex justify-between pt-0.5">
                <span className="text-zinc-400">Safe Gearbox Rating</span>
                <span className="text-zinc-200 font-mono">{(results.outputTorque * 1.5).toFixed(0)} N·m (×1.5)</span>
              </div>
            </div>
          </div>

          {/* Industry Tips */}
          <InfoPanel open={tipsOpen} onToggle={() => setTipsOpen(!tipsOpen)} />
        </div>
      )}
    </div>
  );
}
