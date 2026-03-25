import React, { useCallback, useRef } from "react";
import { useCncStore } from "../../store/useCncStore";
import { uploadReference, uploadReferences } from "../../lib/api";
import { toast } from "../../hooks/use-toast";
import { Download, Upload, FileText, Clock, Ruler, Wrench } from "lucide-react";
import JSZip from "jszip";
import { AccuracyBadge } from "./AccuracyBadge";
import { AccuracyMonitor } from "./AccuracyMonitor";
import { AIDesignScore } from "./AIDesignScore";
import { AIDesignAnalyzer } from "./AIDesignAnalyzer";
import { AIGcodeOptimizer } from "./AIGcodeOptimizer";
import { DeepAccuracyShield } from "./DeepAccuracyShield";

const GCODE_KEYWORDS = /\b(G[0-9]+|M[0-9]+|T[0-9]+|S[0-9]+|F[0-9]+)\b/g;
const GCODE_COORDS = /([XYZIJKR]-?[0-9]+\.?[0-9]*)/g;
const GCODE_COMMENTS = /\(.*?\)/g;

function highlightGcode(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const allMatches: Array<{ index: number; length: number; text: string; type: string }> = [];

  let match;
  const commentRegex = /\(.*?\)/g;
  while ((match = commentRegex.exec(line)) !== null) {
    allMatches.push({ index: match.index, length: match[0].length, text: match[0], type: "comment" });
  }
  const kwRegex = /\b(G[0-9]+|M[0-9]+|T[0-9]+)\b/g;
  while ((match = kwRegex.exec(line)) !== null) {
    if (!allMatches.some(m => match!.index >= m.index && match!.index < m.index + m.length)) {
      allMatches.push({ index: match.index, length: match[0].length, text: match[0], type: "keyword" });
    }
  }
  const coordRegex = /([XYZIJKR]-?[0-9]+\.?[0-9]*)/g;
  while ((match = coordRegex.exec(line)) !== null) {
    if (!allMatches.some(m => match!.index >= m.index && match!.index < m.index + m.length)) {
      allMatches.push({ index: match.index, length: match[0].length, text: match[0], type: "coord" });
    }
  }
  const feedRegex = /([SF][0-9]+\.?[0-9]*)/g;
  while ((match = feedRegex.exec(line)) !== null) {
    if (!allMatches.some(m => match!.index >= m.index && match!.index < m.index + m.length)) {
      allMatches.push({ index: match.index, length: match[0].length, text: match[0], type: "feed" });
    }
  }

  allMatches.sort((a, b) => a.index - b.index);

  for (const m of allMatches) {
    if (m.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{line.slice(lastIndex, m.index)}</span>);
    }
    const colorClass =
      m.type === "comment" ? "text-green-400" :
      m.type === "keyword" ? "text-blue-400 font-bold" :
      m.type === "coord" ? "text-yellow-300" :
      "text-orange-400";
    parts.push(<span key={`m-${m.index}`} className={colorClass}>{m.text}</span>);
    lastIndex = m.index + m.length;
  }
  if (lastIndex < line.length) {
    parts.push(<span key={`e-${lastIndex}`}>{line.slice(lastIndex)}</span>);
  }
  return parts;
}

export function RightPanel() {
  const {
    gcodeOutputs,
    machineProfile,
    referenceFileName,
    setMachineProfile,
    setReferenceFileName,
    setLoading,
    setError,
    selectedStation,
    accuracyLog,
    accuracyThreshold,
  } = useCncStore();
  const latestGcodeScore = [...accuracyLog].reverse().find(e => e.taskType === "gcode");

  const refInputRef = useRef<HTMLInputElement>(null);

  const handleRefUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setLoading(true);
      setError(null);
      try {
        let result;
        if (files.length === 1) {
          result = await uploadReference(files[0]);
          setReferenceFileName(files[0].name);
        } else {
          result = await uploadReferences(Array.from(files));
          setReferenceFileName(`${files.length} files loaded`);
        }
        setMachineProfile(result.machineProfile);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to parse reference file";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [setMachineProfile, setReferenceFileName, setLoading, setError]
  );

  const handleDownloadSingle = useCallback((output: typeof gcodeOutputs[0]) => {
    const blob = new Blob([output.gcode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${output.label}_station${output.stationNumber}.nc`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `${output.label} station ${output.stationNumber} exported` });
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (gcodeOutputs.length === 0) return;
    const zip = new JSZip();
    for (const output of gcodeOutputs) {
      zip.file(`${output.label}_station${output.stationNumber}.nc`, output.gcode);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gcode_all_stations.zip";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "ZIP Exported", description: `${gcodeOutputs.length} G-Code programs packaged` });
  }, [gcodeOutputs]);

  const activeOutput = selectedStation
    ? gcodeOutputs.find((o) => o.stationNumber === selectedStation)
    : gcodeOutputs[0];

  return (
    <div className="w-80 flex flex-col overflow-hidden flex-shrink-0"
      style={{ background: "#090a18", borderLeft: "1px solid rgba(255,255,255,0.055)" }}>
      <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
        <h2 className="text-[10px] font-semibold uppercase tracking-widest mb-3 flex items-center gap-2"
          style={{ color: "#52525b" }}>
          <Upload className="w-3.5 h-3.5" style={{ color: "#3f3f46" }} />
          Reference G-Code
        </h2>
        <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-white/[0.07] rounded-xl cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] transition-all group">
          <div className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mb-1.5 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
            <Upload className="w-3.5 h-3.5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
          </div>
          <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors text-center px-2">
            {referenceFileName || "Upload machine reference .nc"}
          </span>
          <input
            ref={refInputRef}
            type="file"
            accept=".nc,.gcode,.tap,.ngc,.txt"
            multiple
            className="hidden"
            onChange={handleRefUpload}
          />
        </label>
        {machineProfile && (
          <div className="mt-2 text-xs text-zinc-500 space-y-1 bg-white/[0.025] border border-white/[0.07] rounded-lg p-2.5">
            <div className="text-zinc-300 font-semibold mb-1.5 text-[11px]">Machine Profile Learned:</div>
            <div>Controller: {machineProfile.controllerType}</div>
            <div>Mode: {machineProfile.spindleMode === "css" ? "G96 CSS" : "G97 RPM"}</div>
            <div>Speed: S{machineProfile.spindleSpeed} {machineProfile.spindleDirection}</div>
            <div>Max RPM: S{machineProfile.maxSpindleSpeed}</div>
            <div>Feed: F{machineProfile.feedRate} {machineProfile.feedUnit}</div>
            <div>X Mode: {machineProfile.xDiameterMode ? "Diameter" : "Radius"}</div>
            <div>Format: {machineProfile.coordinateFormat}</div>
            <div>Precision: {machineProfile.decimalPrecision} dec</div>
            <div>G28: {machineProfile.useG28 ? "Yes" : "No"}</div>
            <div>Tool Format: {machineProfile.toolFormat}</div>
            {machineProfile.detectedTools.length > 0 && (
              <div className="mt-1 pt-1 border-t border-zinc-700">
                <div className="text-zinc-300 font-semibold mb-0.5">Detected Tools:</div>
                {machineProfile.detectedTools.map((t: { toolNumber: number; offsetNumber: number; comment: string }, i: number) => (
                  <div key={i}>T{t.toolNumber.toString().padStart(2,"0")}{t.offsetNumber.toString().padStart(2,"0")} {t.comment}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {gcodeOutputs.length > 0 && (
        <>
          <div className="p-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.045)" }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#52525b" }}>
                  G-Code Summary
                </h2>
                {latestGcodeScore && (
                  <AccuracyBadge score={latestGcodeScore.overallScore} threshold={accuracyThreshold} size="sm" />
                )}
              </div>
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 text-emerald-400 text-[10px] font-semibold py-1 px-2.5 rounded-lg transition-all"
              >
                <Download className="w-3 h-3" />
                Download ZIP
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-zinc-600 border-b border-white/[0.05]">
                    <th className="text-left py-1.5 pr-2 font-medium">#</th>
                    <th className="text-left py-1.5 pr-2 font-medium">Station</th>
                    <th className="text-right py-1.5 pr-2 font-medium">Path</th>
                    <th className="text-right py-1.5 pr-2 font-medium">Time</th>
                    <th className="text-right py-1.5 font-medium">Moves</th>
                  </tr>
                </thead>
                <tbody>
                  {gcodeOutputs.map((o) => (
                    <tr
                      key={o.stationNumber}
                      className={`border-b border-white/[0.04] cursor-pointer transition-colors ${
                        activeOutput?.stationNumber === o.stationNumber
                          ? "bg-blue-500/8 text-zinc-200"
                          : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                      }`}
                      onClick={() => useCncStore.getState().setSelectedStation(o.stationNumber)}
                    >
                      <td className="py-1.5 pr-2 font-mono">{o.stationNumber}</td>
                      <td className="py-1.5 pr-2">{o.label}</td>
                      <td className="text-right py-1.5 pr-2 font-mono">{o.totalPathLength}</td>
                      <td className="text-right py-1.5 pr-2 font-mono">{o.estimatedTime}</td>
                      <td className="text-right py-1.5 font-mono">{o.toolMoves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05]">
              <div className="text-[11px] text-zinc-300 font-semibold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                {activeOutput
                  ? `${activeOutput.label} · ${activeOutput.lineCount} lines`
                  : "G-Code"}
              </div>
              {activeOutput && (
                <button
                  onClick={() => handleDownloadSingle(activeOutput)}
                  className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 hover:text-zinc-200 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] px-2 py-1 rounded-md transition-all"
                >
                  <Download className="w-3 h-3" />
                  .nc
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-[#07070E] font-mono text-xs leading-5">
              {activeOutput ? (
                activeOutput.gcode.split("\n").map((line, i) => (
                  <div key={i} className="flex hover:bg-white/[0.02] transition-colors">
                    <span className="w-10 text-right pr-2 text-zinc-700 select-none flex-shrink-0 border-r border-white/[0.04]">
                      {i + 1}
                    </span>
                    <span className="pl-2 text-zinc-400 whitespace-pre">
                      {highlightGcode(line)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-zinc-600 text-center text-xs">
                  Generate G-code to view output
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {gcodeOutputs.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-[220px]">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.08] flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Wrench className="w-7 h-7 text-zinc-600" />
            </div>
            <div className="text-sm font-semibold text-zinc-400 mb-1">No G-Code Yet</div>
            <div className="text-xs text-zinc-600 leading-relaxed mb-4">
              Upload a DXF profile file and generate G-Code to see your CNC program output here.
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <div className="w-5 h-5 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[9px] font-bold text-orange-400">1</div>
                <span>Upload DXF profile</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[9px] font-bold text-blue-400">2</div>
                <span>Generate power pattern</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[9px] font-bold text-emerald-400">3</div>
                <span>Generate G-Code output</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deep Accuracy Shield — offline formula + Gemini cross-verification, target ≥98% */}
      <DeepAccuracyShield />

      {/* AI Design Score — holistic design quality gauge */}
      <AIDesignScore />

      {/* AI Design Analyzer — GPT-powered manufacturability analysis */}
      <AIDesignAnalyzer />

      {/* AI G-Code Optimizer — GPT-powered G-code review */}
      <AIGcodeOptimizer />

      {/* Accuracy Monitor — collapsible panel at bottom of right panel */}
      <AccuracyMonitor />
    </div>
  );
}
