import React from "react";
import { useCncStore } from "@/store/useCncStore";
import { AIChatbotsView } from "./AIChatbotsView";

export function FactoryAIView() {
  const { materialType, materialThickness, numStations } = useCncStore();

  return (
    <div className="flex flex-col h-full bg-[#05060f] text-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <h2 className="text-sm font-semibold tracking-widest uppercase text-amber-400">
          Factory AI
        </h2>
        <span className="ml-auto text-xs text-white/40">
          {materialType} · {materialThickness}mm · {numStations} stations
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <AIChatbotsView />
      </div>
    </div>
  );
}
