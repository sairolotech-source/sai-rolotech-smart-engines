import { AlertTriangle, Info } from "lucide-react";

interface Props {
  warnings: string[];
  assumptions: string[];
}

export function WarningPanel({ warnings, assumptions }: Props) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
          <AlertTriangle className="w-3.5 h-3.5" /> Warnings
        </div>
        {warnings.length === 0 ? (
          <div className="text-xs text-gray-600">No warnings</div>
        ) : (
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-amber-300/80">
                <span className="shrink-0 mt-px text-amber-500">•</span>{w}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 uppercase tracking-wider">
          <Info className="w-3.5 h-3.5" /> Assumptions
        </div>
        {assumptions.length === 0 ? (
          <div className="text-xs text-gray-600">No assumptions listed</div>
        ) : (
          <ul className="space-y-1.5">
            {assumptions.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-blue-300/80">
                <span className="shrink-0 mt-px text-blue-500">•</span>{a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
