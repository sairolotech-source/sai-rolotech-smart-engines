/**
 * HelpTooltip.tsx — Inline engineering help tooltip
 * Shows "?" button; on hover/click reveals definition, range, method label.
 * Sai Rolotech Smart Engines v2.4.0
 */
import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

export type MethodLabel = "Formula" | "Rule" | "Estimate" | "Table" | "User Override";

interface HelpTooltipProps {
  title: string;
  body: string;
  method?: MethodLabel;
  range?: string;
  example?: string;
  size?: "sm" | "md";
  side?: "top" | "bottom" | "left" | "right";
}

const METHOD_COLORS: Record<MethodLabel, string> = {
  "Formula":       "bg-blue-900/80 text-blue-300 border-blue-700",
  "Rule":          "bg-amber-900/80 text-amber-300 border-amber-700",
  "Estimate":      "bg-purple-900/80 text-purple-300 border-purple-700",
  "Table":         "bg-green-900/80 text-green-300 border-green-700",
  "User Override": "bg-slate-800 text-slate-300 border-slate-600",
};

export function HelpTooltip({
  title,
  body,
  method,
  range,
  example,
  size = "sm",
  side = "top",
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const iconSize = size === "sm" ? 12 : 14;

  const posClass: Record<string, string> = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-slate-500 hover:text-slate-300 transition-colors ml-1 flex-shrink-0"
        aria-label={`Help: ${title}`}
        type="button"
      >
        <HelpCircle size={iconSize} />
      </button>

      {open && (
        <div
          className={`
            absolute z-50 w-64 rounded-lg border border-slate-700
            bg-slate-900/98 shadow-2xl p-3 text-left pointer-events-none
            ${posClass[side]}
          `}
          style={{ backdropFilter: "blur(8px)" }}
        >
          <div className="font-semibold text-white text-xs mb-1">{title}</div>
          <div className="text-slate-300 text-xs leading-relaxed mb-2">{body}</div>

          {range && (
            <div className="text-slate-400 text-[10px] mb-1">
              <span className="text-slate-500">Range: </span>{range}
            </div>
          )}
          {example && (
            <div className="text-slate-400 text-[10px] mb-1">
              <span className="text-slate-500">Example: </span>{example}
            </div>
          )}
          {method && (
            <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border font-mono mt-1 ${METHOD_COLORS[method]}`}>
              [{method}]
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HelpTooltip;
