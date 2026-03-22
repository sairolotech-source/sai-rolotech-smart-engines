import React from "react";
import {
  Bot,
  CheckCircle2,
  Loader2,
  XCircle,
  Zap,
  ZapOff,
  FlowerIcon,
  Cog,
  Code2,
  Wrench,
  Brain,
  BarChart3,
} from "lucide-react";
import type { AutoAIStatus } from "../hooks/useAutoAIMode";

interface AutoAIModePanelProps {
  enabled: boolean;
  status: AutoAIStatus;
  onToggle: () => void;
}

const STEP_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "ai-pre-analysis": {
    label: "Smart Analysis",
    icon: <Brain className="w-2.5 h-2.5" />,
    color: "text-purple-400",
  },
  flower: {
    label: "Flower",
    icon: <FlowerIcon className="w-2.5 h-2.5" />,
    color: "text-violet-400",
  },
  "ai-design-check": {
    label: "Mfg Check",
    icon: <BarChart3 className="w-2.5 h-2.5" />,
    color: "text-sky-400",
  },
  "roll-tooling": {
    label: "Roll Tooling",
    icon: <Cog className="w-2.5 h-2.5" />,
    color: "text-blue-400",
  },
  "ai-tools": {
    label: "Smart Tools",
    icon: <Wrench className="w-2.5 h-2.5" />,
    color: "text-cyan-400",
  },
  gcode: {
    label: "G-Code",
    icon: <Code2 className="w-2.5 h-2.5" />,
    color: "text-amber-400",
  },
  done: {
    label: "Done",
    icon: <CheckCircle2 className="w-2.5 h-2.5" />,
    color: "text-emerald-400",
  },
  error: {
    label: "Error",
    icon: <XCircle className="w-2.5 h-2.5" />,
    color: "text-red-400",
  },
  idle: { label: "", icon: null, color: "" },
};

const RUNNING_STEPS = ["ai-pre-analysis", "flower", "ai-design-check", "roll-tooling", "ai-tools", "gcode"];

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
    : score >= 60 ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-red-400 border-red-500/30 bg-red-500/10";
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${color}`}>
      {score}/100
    </span>
  );
}

export function AutoAIModePanel({ enabled, status, onToggle }: AutoAIModePanelProps) {
  const isRunning = RUNNING_STEPS.includes(status.step);
  const isDone = status.step === "done";
  const isError = status.step === "error";
  const showBar = isRunning || isDone || isError;
  const meta = STEP_META[status.step] ?? STEP_META.idle;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        title={enabled ? "Auto Mode ON (6 modules) — click to disable" : "Auto Mode — click to enable (6 smart calls)"}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
          enabled
            ? "bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
            : "bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
        }`}
      >
        {enabled ? (
          <Zap className="w-3 h-3 text-violet-400" />
        ) : (
          <ZapOff className="w-3 h-3" />
        )}
        <span className="hidden sm:inline">Auto Mode</span>
        {enabled && (
          <span className="hidden lg:inline text-[8px] text-violet-500 ml-0.5 font-medium">6-API</span>
        )}
      </button>

      {enabled && status.step !== "idle" && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-medium border transition-all ${
            isDone
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : isError
              ? "bg-red-500/10 border-red-500/25 text-red-300"
              : "bg-violet-500/10 border-violet-500/25 text-violet-300"
          }`}
        >
          {isRunning ? (
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
          ) : (
            <span className={`flex-shrink-0 ${meta.color}`}>{meta.icon}</span>
          )}

          <span className={`font-bold flex-shrink-0 ${meta.color}`}>{meta.label}</span>

          {isRunning && (
            <div className="hidden md:flex items-center gap-1">
              <span className="text-zinc-400 truncate max-w-[100px]">{status.message.split("—")[0].trim()}</span>
              <span className="text-violet-300 font-bold">{status.progress}%</span>
            </div>
          )}

          {(isDone || isRunning) && status.manufacturabilityScore !== undefined && (
            <ScoreBadge score={status.manufacturabilityScore} />
          )}

          {isDone && status.recommendedStations !== undefined && (
            <span className="hidden lg:inline text-[8px] text-sky-400 border border-sky-500/30 bg-sky-500/10 px-1 py-0.5 rounded">
              AI: {status.recommendedStations}st
            </span>
          )}

          {isError && status.error && (
            <span
              className="text-red-300 hidden md:inline max-w-[120px] overflow-hidden line-clamp-2 cursor-help"
              title={status.error}
            >
              {status.error}
            </span>
          )}
        </div>
      )}

      {enabled && showBar && (
        <div className="hidden lg:flex items-center gap-0.5 h-1.5 rounded-full overflow-hidden bg-white/[0.06] w-16 flex-shrink-0">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDone ? "bg-emerald-500" : isError ? "bg-red-500" : "bg-violet-500"
            }`}
            style={{ width: `${status.progress}%` }}
          />
        </div>
      )}

      {enabled && status.step === "idle" && (
        <span className="hidden md:flex items-center gap-1 text-[9px] text-violet-500 font-medium">
          <Bot className="w-3 h-3" />
          <span className="hidden lg:inline">6 modules ready — profile load karo</span>
          <span className="lg:hidden">Ready</span>
        </span>
      )}
    </div>
  );
}
