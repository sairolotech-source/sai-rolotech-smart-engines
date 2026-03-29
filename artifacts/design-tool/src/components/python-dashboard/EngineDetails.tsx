import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  result: Record<string, unknown>;
}

const SKIP = new Set(["status", "failed_stage", "result"]);

function EngineBlock({ name, data }: { name: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  const status = (data as Record<string, unknown>)?.status as string | undefined;
  const borderColor =
    status === "pass" ? "border-emerald-500/20" : status === "fail" ? "border-red-500/25" : "border-gray-700/40";

  return (
    <div className={`rounded-lg border ${borderColor} bg-gray-800/40`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex-1 text-xs font-medium text-gray-300 font-mono">{name}</span>
        {status && (
          <span className={`text-[10px] font-bold ${status === "pass" ? "text-emerald-400" : "text-red-400"}`}>
            {status.toUpperCase()}
          </span>
        )}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-600" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
      </button>
      {open && (
        <pre className="px-3 pb-3 text-[10.5px] text-gray-400 font-mono overflow-auto whitespace-pre-wrap max-h-64 border-t border-gray-700/30">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function EngineDetails({ result }: Props) {
  const entries = Object.entries(result || {}).filter(([k]) => !SKIP.has(k));

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Engine Details</div>
        <div className="text-xs text-gray-600">No engine data yet.</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/60 p-4 space-y-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Engine Details</div>
      {entries.map(([key, val]) => (
        <EngineBlock key={key} name={key} data={val} />
      ))}
    </div>
  );
}
