import React, { useState, useMemo } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Activity, Play, Download, AlertTriangle, CheckCircle2, XCircle, Cpu } from "lucide-react";

interface BendInput {
  id: string;
  finalAngle: number;
  radius: number;
  type: "right-angle" | "acute" | "obtuse" | "flat";
  side: "left" | "right" | "center";
}

interface StationPass {
  stationNo: number;
  passAngles: { bendId: string; angle: number; delta: number; status: "safe" | "borderline" | "aggressive" }[];
  notes: string;
}

interface PassResult {
  stations: StationPass[];
  totalStations: number;
  progressionType: string;
  strategy: string;
  warnings: string[];
  source: string;
}

const STATUS_COLORS = {
  safe:        { text: "text-emerald-400", bg: "bg-emerald-500/10", label: "Safe" },
  borderline:  { text: "text-amber-400",   bg: "bg-amber-500/10",   label: "Border" },
  aggressive:  { text: "text-red-400",     bg: "bg-red-500/10",     label: "Danger" },
};

export function PassAngleProgressionView() {
  const { stations, materialType, materialThickness, bendRadius } = useCncStore();

  const [result, setResult] = useState<PassResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [stationOverride, setStationOverride] = useState<number | null>(null);

  const derivedBends = useMemo((): BendInput[] => {
    if (!stations || stations.length === 0) return [];
    const allAngles: number[] = [];
    for (const st of stations) {
      for (const angle of st.bendAngles) {
        if (angle > 0) allAngles.push(angle);
      }
    }
    const unique = Array.from(new Set(allAngles));
    return unique.slice(0, 8).map((angle, i) => ({
      id: `B${i + 1}`,
      finalAngle: angle,
      radius: bendRadius ?? 1.5,
      type: angle >= 85 && angle <= 95 ? "right-angle" : angle < 85 ? "acute" : "obtuse",
      side: i % 2 === 0 ? "left" : "right",
    }));
  }, [stations, bendRadius]);

  const handleGenerate = async () => {
    if (derivedBends.length === 0) {
      setError("No profile bends found. Load a profile first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/roll-pass/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialType,
          thickness: materialThickness,
          yieldStrength: 280,
          bends: derivedBends,
          stationCount: stationOverride ?? undefined,
          useAI,
        }),
      });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
      const data = await response.json() as PassResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!result) return;
    const rows: string[] = ["Station,BendID,Angle(°),Delta(°),Status,Notes"];
    for (const st of result.stations) {
      for (const pa of st.passAngles) {
        rows.push(`${st.stationNo},${pa.bendId},${pa.angle},${pa.delta},${pa.status},"${st.notes}"`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pass-progression-${materialType}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bendIds = derivedBends.map(b => b.id);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0f1117] text-white p-4 gap-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
          <Activity className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Pass Angle Progression Engine</h2>
          <p className="text-xs text-gray-400">Station-by-station forming angle schedule — DIN 6935 compliant</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-cyan-300">Gemini Pro + Rule Engine</span>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Material</label>
            <div className="bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono text-cyan-300">
              {materialType} · {materialThickness}mm
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Station Count (auto or manual)</label>
            <input
              type="number"
              min={4} max={30} step={1}
              placeholder={`Auto (${Math.max(6, Math.round(derivedBends.length * 2.2))} stations)`}
              value={stationOverride ?? ""}
              onChange={e => setStationOverride(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAI}
              onChange={e => setUseAI(e.target.checked)}
              className="accent-cyan-500"
            />
            <span className="text-sm text-gray-300">Use Gemini Pro AI optimization</span>
          </label>
          <span className="text-xs text-gray-500">(falls back to rule engine if unavailable)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            Detected bends: <span className="text-white font-mono">{derivedBends.length}</span>
            {derivedBends.map(b => ` ${b.id}:${b.finalAngle}°`).join(",")}
          </span>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || derivedBends.length === 0}
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating...</>
          ) : (
            <><Play className="w-4 h-4" /> Generate Pass Progression</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2 text-red-300 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-1">Strategy</div>
                <div className="text-sm text-gray-300">{result.strategy}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Source: <span className="text-cyan-400 font-mono">{result.source}</span> ·
                  Progression: <span className="text-white font-mono">{result.progressionType}</span> ·
                  Stations: <span className="text-white font-mono">{result.totalStations}</span>
                </div>
              </div>
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 transition-colors flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">Warnings</div>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-300 mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Pass Table */}
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Station</th>
                    {bendIds.map(id => (
                      <th key={id} className="text-center px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {id}
                      </th>
                    ))}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.stations.map((st, si) => (
                    <tr
                      key={st.stationNo}
                      className={`border-b border-white/5 ${si % 2 === 0 ? "" : "bg-white/3"} hover:bg-white/5 transition-colors`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            st.stationNo === result.totalStations ? "bg-purple-500/20 text-purple-300" :
                            st.passAngles.some(p => p.status === "aggressive") ? "bg-red-500/20 text-red-300" :
                            st.passAngles.some(p => p.status === "borderline") ? "bg-amber-500/20 text-amber-300" :
                            "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            {st.stationNo}
                          </div>
                        </div>
                      </td>
                      {bendIds.map(id => {
                        const pa = st.passAngles.find(p => p.bendId === id);
                        if (!pa) return <td key={id} className="px-3 py-3 text-center text-gray-600">—</td>;
                        const sc = STATUS_COLORS[pa.status];
                        return (
                          <td key={id} className="px-3 py-3 text-center">
                            <div className={`inline-flex flex-col items-center px-2 py-1 rounded-lg ${sc.bg}`}>
                              <span className={`font-mono font-bold ${sc.text}`}>{pa.angle.toFixed(1)}°</span>
                              <span className="text-xs text-gray-500 font-mono">+{pa.delta.toFixed(1)}°</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-xs">{st.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Safe increment
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Borderline (85% of max)
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              Aggressive (exceeds DIN 6935 max)
            </div>
            <div className="ml-auto">Angles shown include springback compensation</div>
          </div>
        </>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-400">Engine: </span>
        DIN 6935 max angle increments · Gemini 2.5 Pro (online) · Rule-based engine (offline fallback)
      </div>

    </div>
  );
}
