import React, { useState } from "react";
import { useCncStore } from "../../store/useCncStore";
import { ChevronRight, Lock, Unlock, Layers, CircleDot } from "lucide-react";

export type SectionModelType = "open" | "closed";

interface SectionModelSelectorProps {
  onSelect: (model: SectionModelType) => void;
  selected: SectionModelType | null;
  mandatory?: boolean;
}

export function SectionModelSelector({ onSelect, selected, mandatory = false }: SectionModelSelectorProps) {
  const { openSectionType } = useCncStore();

  const models = [
    {
      id: "open" as SectionModelType,
      label: "Open Section",
      badge: "AI Model A",
      icon: "⊓",
      desc: "C, U, Z, L, Hat, Angle, and all open profiles with exposed flanges",
      examples: ["C-Channel", "U-Track", "Z-Purlin", "L-Angle", "Hat/Omega", "Shutter Patti"],
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.08)",
      border: "rgba(245,158,11,0.22)",
      rules: [
        "Max 15° bend per station",
        "Springback compensation applied",
        "Open-end geometry checks",
        "Flare/twist risk monitoring",
      ],
    },
    {
      id: "closed" as SectionModelType,
      label: "Closed Section",
      badge: "AI Model B",
      icon: "□",
      desc: "Tubes, square/rectangular hollow sections, roll-welded closed profiles",
      examples: ["Square Tube", "Round Tube", "Rectangular HSS", "Oval Tube", "Custom Closed"],
      color: "#6366f1",
      bg: "rgba(99,102,241,0.08)",
      border: "rgba(99,102,241,0.22)",
      rules: [
        "Weld seam position control",
        "Ovality correction passes",
        "ID/OD tolerance management",
        "Closed-seam alignment check",
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={mandatory ? undefined : (e) => { if (e.target === e.currentTarget && selected) onSelect(selected); }}>
      <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0d0d1a 0%, #050510 100%)" }}>

        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">Select AI Design Model</div>
              <div className="text-xs text-zinc-500">Choose the correct model for your profile type before proceeding</div>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {models.map((m) => {
            const isSelected = selected === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="group text-left rounded-xl border p-5 transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: isSelected ? m.bg : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isSelected ? m.color : "rgba(255,255,255,0.07)"}`,
                  boxShadow: isSelected ? `0 0 20px ${m.color}25` : "none",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl font-black"
                      style={{ background: `${m.color}18`, border: `1px solid ${m.color}35`, color: m.color }}>
                      {m.icon}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{m.label}</div>
                      <div className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 inline-block"
                        style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}30` }}>
                        {m.badge}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: m.color }}>
                      <CircleDot className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-zinc-400 mb-3 leading-relaxed">{m.desc}</p>

                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">Examples</div>
                  <div className="flex flex-wrap gap-1">
                    {m.examples.map(ex => (
                      <span key={ex} className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#71717a" }}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-1.5">AI Rules</div>
                  {m.rules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: m.color }} />
                      <span className="text-[10px] text-zinc-500">{rule}</span>
                    </div>
                  ))}
                </div>

                {isSelected && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-1.5"
                    style={{ borderColor: `${m.color}25` }}>
                    <Unlock className="w-3 h-3" style={{ color: m.color }} />
                    <span className="text-[11px] font-semibold" style={{ color: m.color }}>
                      Model selected — continue below
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: selected === "open"
                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                : selected === "closed"
                ? "linear-gradient(135deg, #6366f1, #4f46e5)"
                : "rgba(255,255,255,0.05)",
              color: selected ? "white" : "#52525b",
            }}
          >
            Continue with {selected === "open" ? "Open Section AI" : selected === "closed" ? "Closed Section AI" : "Selected Model"}
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-center text-[10px] text-zinc-600 mt-2">
            <Lock className="w-2.5 h-2.5 inline mr-1" />
            You must select a model to proceed. This routes your project to the correct AI engine.
          </p>
        </div>
      </div>
    </div>
  );
}
