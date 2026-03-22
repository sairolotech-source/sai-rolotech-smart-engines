import React from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

interface AccuracyBadgeProps {
  score: number;
  threshold?: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  label?: string;
}

function getColor(score: number): { text: string; bg: string; border: string; dot: string } {
  if (score >= 85) return {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  };
  if (score >= 70) return {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  };
  return {
    text: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-400",
  };
}

function getIcon(score: number, cls: string) {
  if (score >= 85) return <ShieldCheck className={cls} />;
  if (score >= 70) return <ShieldAlert className={cls} />;
  return <ShieldX className={cls} />;
}

export function AccuracyBadge({ score, threshold = 80, size = "md", showIcon = true, label }: AccuracyBadgeProps) {
  const c = getColor(score);
  const isLow = score < threshold;

  const sizeClasses = {
    sm: { wrapper: "px-1.5 py-0.5 gap-1 rounded-md", text: "text-[10px]", icon: "w-3 h-3", dot: "w-1.5 h-1.5" },
    md: { wrapper: "px-2 py-1 gap-1.5 rounded-lg", text: "text-xs", icon: "w-3.5 h-3.5", dot: "w-2 h-2" },
    lg: { wrapper: "px-3 py-1.5 gap-2 rounded-xl", text: "text-sm", icon: "w-4 h-4", dot: "w-2.5 h-2.5" },
  }[size];

  return (
    <span
      className={`inline-flex items-center font-semibold border select-none
        ${c.bg} ${c.border} ${c.text}
        ${sizeClasses.wrapper}
        ${isLow ? "animate-pulse-slow" : ""}`}
      title={`Accuracy: ${score}%${isLow ? " — below threshold" : ""}`}
    >
      {showIcon && getIcon(score, `${sizeClasses.icon} flex-shrink-0`)}
      <span className={sizeClasses.text}>
        {label ? `${label}: ` : ""}Accuracy: {score}%
      </span>
      <span className={`rounded-full flex-shrink-0 ${c.dot} ${sizeClasses.dot}`} />
    </span>
  );
}
