import React, { useState, useCallback } from "react";
import { useCncStore } from "../../store/useCncStore";
import { Shield, ChevronDown, ChevronRight, AlertTriangle, XCircle, Info, RefreshCw } from "lucide-react";

interface GcodeIssue {
  line: number;
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  fix: string;
}

interface GcodeVerifyResult {
  programLabel: string;
  totalLines: number;
  issues: GcodeIssue[];
  passed: boolean;
  errorCount: number;
  warnCount: number;
  hasSpindle: boolean;
  hasM30: boolean;
  hasToolChange: boolean;
  hasCoolant: boolean;
}

function verifyGcode(gcode: string, label: string): GcodeVerifyResult {
  const lines = gcode.split("\n");
  const issues: GcodeIssue[] = [];
  let hasSpindle = false;
  let hasM30 = false;
  let hasToolChange = false;
  let hasCoolant = false;
  let spindleStartLine = -1;
  let lastX = 0;
  let lastZ = 0;
  let inRapid = false;
  let lastToolLine = -1;
  const toolCalls: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("(") || raw.startsWith("%") || raw.startsWith("O")) continue;

    const upper = raw.toUpperCase();

    // Check for spindle start
    if (/M0[34]/.test(upper)) {
      hasSpindle = true;
      spindleStartLine = i + 1;
    }

    // Check M30
    if (upper.includes("M30")) hasM30 = true;

    // Check coolant
    if (upper.includes("M8") || upper.includes("M07") || upper.includes("M08")) hasCoolant = true;

    // Check tool change (T followed by 2+ digits)
    if (/T\d{2,4}/.test(upper)) {
      hasToolChange = true;
      toolCalls.push(i + 1);
      lastToolLine = i + 1;
    }

    // Check for rapid moves
    if (upper.startsWith("G0 ") || upper.startsWith("G00 ")) {
      inRapid = true;

      // Extract X and Z values
      const xMatch = upper.match(/X(-?[\d.]+)/);
      const zMatch = upper.match(/Z(-?[\d.]+)/);
      if (xMatch) lastX = parseFloat(xMatch[1]);
      if (zMatch) lastZ = parseFloat(zMatch[1]);
    }

    // Check for feed move after rapid without safe retract
    if ((upper.startsWith("G1 ") || upper.startsWith("G01 ")) && spindleStartLine < 0) {
      issues.push({
        line: i + 1, severity: "error", code: "E001",
        message: `Line ${i + 1}: G01 feed move before spindle start (M03/M04) — spindle not running`,
        fix: "Add M03 or M04 (spindle start) before first G01 feed move",
      });
    }

    // Check for G1 without F word (missing feed rate)
    if ((upper.startsWith("G1 ") || upper.startsWith("G01 ")) && !/F\d/.test(upper)) {
      const hasEarlierF = lines.slice(Math.max(0, i - 15), i).some(l => /F\d/i.test(l));
      if (!hasEarlierF) {
        issues.push({
          line: i + 1, severity: "warning", code: "W001",
          message: `Line ${i + 1}: G01 with no F word (no feed rate) — may use last modal feed`,
          fix: "Add feed rate: G01 X... Z... F0.2 — always explicit feed on critical moves",
        });
      }
    }

    // Check for rapid into cut — G00 followed by immediate G01 with no safe retract
    if (upper.startsWith("G0") && !upper.startsWith("G02") && !upper.startsWith("G03")) {
      const xm = upper.match(/X(-?[\d.]+)/);
      const zm = upper.match(/Z(-?[\d.]+)/);
      if (xm && zm) {
        const px = parseFloat(xm[1]);
        const pz = parseFloat(zm[1]);
        if (pz < -200) {
          issues.push({
            line: i + 1, severity: "warning", code: "W002",
            message: `Line ${i + 1}: G00 rapid to Z${pz} — verify clearance (long Z move on rapid)`,
            fix: "Ensure no material in path during rapid. Use G00 Z[safe] first, then X, then approach",
          });
        }
      }
    }

    // Check for missing safe retract between tool changes
    if (/T\d{2,4}/.test(upper) && lastToolLine > 0 && i + 1 !== lastToolLine) {
      const prevLines = lines.slice(lastToolLine - 1, i);
      const hasRetract = prevLines.some(l => {
        const u = l.toUpperCase();
        return (u.includes("G28") || (u.match(/G0.*Z\d{2,}/) !== null) || (u.match(/G0.*X\d{3,}/) !== null));
      });
      if (!hasRetract) {
        issues.push({
          line: i + 1, severity: "warning", code: "W003",
          message: `Line ${i + 1}: Tool change without visible safe retract before — collision risk`,
          fix: "Add G0 X[safe] then G28 U0. W0. before tool change Txxxx",
        });
      }
    }

    // Check for missing M05 spindle stop
    if (upper.includes("M30") && !lines.slice(Math.max(0, i - 10), i).some(l => l.toUpperCase().includes("M5") || l.toUpperCase().includes("M05"))) {
      issues.push({
        line: i + 1, severity: "warning", code: "W004",
        message: `Line ${i + 1}: M30 (program end) without M05 (spindle stop) before it`,
        fix: "Add M05 and M09 before M30 to ensure proper spindle stop and coolant off",
      });
    }

    // Check for very large coordinates (possible units error)
    const bigCoord = upper.match(/[XZ](-?[\d]{4,}\.)/);
    if (bigCoord) {
      issues.push({
        line: i + 1, severity: "warning", code: "W005",
        message: `Line ${i + 1}: Very large coordinate ${bigCoord[0]} — verify units (mm vs inches?) and work offset`,
        fix: "Check G20/G21 (inch/metric mode) and verify work offset G54 is set correctly",
      });
    }

    // Check for deprecated or unsafe codes
    if (upper.includes("G92") && upper.match(/X|Z/)) {
      issues.push({
        line: i + 1, severity: "info", code: "I001",
        message: `Line ${i + 1}: G92 with axis — note: G92 sets RPM limit (Fanuc), not coordinate shift. Verify intent`,
        fix: "If coordinate shift intended: use G52 or re-datum. If RPM limit: G92 S[maxRPM] is correct",
      });
    }
  }

  // Global checks
  if (!hasM30) {
    issues.push({
      line: lines.length, severity: "error", code: "E002",
      message: `Program missing M30 — controller will not reset after end of program`,
      fix: "Add M30 as the final line of every program",
    });
  }

  if (!hasSpindle) {
    issues.push({
      line: 1, severity: "error", code: "E003",
      message: `No spindle start code (M03/M04) found in program`,
      fix: "Add G97 S[RPM] M03 or G96 S[Vc] M04 before first cutting move",
    });
  }

  if (!hasCoolant) {
    issues.push({
      line: 1, severity: "info", code: "I002",
      message: `No coolant code (M08/M07) found — verify coolant requirement for material`,
      fix: "Add M08 after spindle start for most materials (SS requires flood coolant — mandatory)",
    });
  }

  if (toolCalls.length > 1) {
    const uniqueTools = new Set(toolCalls.map(l => {
      const u = lines[l - 1]?.toUpperCase() ?? "";
      const m = u.match(/T(\d{2,4})/);
      return m ? m[1] : "";
    }).filter(Boolean));
    if (uniqueTools.size < toolCalls.length) {
      issues.push({
        line: 1, severity: "info", code: "I003",
        message: `Duplicate tool calls detected — same tool called multiple times (may be intentional)`,
        fix: "Verify each duplicate call is intentional. Unnecessary tool changes add cycle time",
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warnCount = issues.filter(i => i.severity === "warning").length;

  return {
    programLabel: label,
    totalLines: lines.length,
    issues,
    passed: errorCount === 0,
    errorCount,
    warnCount,
    hasSpindle,
    hasM30,
    hasToolChange,
    hasCoolant,
  };
}

export function GcodeStepVerifier() {
  const { gcodeOutputs } = useCncStore();
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState<GcodeVerifyResult[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (gcodeOutputs.length === 0) return null;

  const runVerification = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const res = gcodeOutputs.map(go => verifyGcode(go.gcode, go.label));
      setResults(res);
      setRunning(false);
    }, 400);
  }, [gcodeOutputs]);

  const totalErrors = results.reduce((s, r) => s + r.errorCount, 0);
  const totalWarns = results.reduce((s, r) => s + r.warnCount, 0);
  const allPassed = results.length > 0 && totalErrors === 0;

  const selectedResult = results[selectedIdx];

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <Shield className="w-3.5 h-3.5 text-rose-400" />
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">G-Code Step Verifier</span>
        {results.length > 0 && (
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${allPassed ? "bg-emerald-900/30 text-emerald-300" : "bg-red-900/30 text-red-300"}`}>
            {allPassed ? "All OK" : `${totalErrors}E ${totalWarns}W`}
          </span>
        )}
        <span className="ml-auto">{expanded ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.06] space-y-3 pt-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(parseInt(e.target.value))}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-rose-500 focus:outline-none"
            >
              {gcodeOutputs.map((go, idx) => (
                <option key={idx} value={idx}>
                  {go.label} ({go.lineCount} lines)
                  {results[idx] ? (results[idx].passed ? " ✓" : ` ✗ ${results[idx].errorCount}E`) : ""}
                </option>
              ))}
            </select>
            <button
              onClick={runVerification}
              disabled={running}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-900/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${running ? "animate-spin" : ""}`} />
              {running ? "Verifying..." : "Verify All"}
            </button>
          </div>

          {results.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {results.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors
                    ${selectedIdx === idx ? "ring-1 ring-rose-400/50" : ""}
                    ${r.passed ? "bg-emerald-900/20 text-emerald-300 border-emerald-500/15" : "bg-red-900/30 text-red-300 border-red-500/20"}`}
                >
                  {r.programLabel} {r.passed ? "✓" : `✗${r.errorCount}E`}
                </button>
              ))}
            </div>
          )}

          {selectedResult && (
            <div className="space-y-2">
              <div className={`p-2 rounded-lg border flex items-center gap-2 ${selectedResult.passed ? "bg-emerald-950/20 border-emerald-500/20" : "bg-red-950/20 border-red-500/20"}`}>
                <div className="text-xs text-zinc-300 flex-1">
                  <span className="font-mono text-amber-300">{selectedResult.programLabel}</span>
                  {" — "}{selectedResult.totalLines} lines
                  {" | "}
                  <span className={selectedResult.hasSpindle ? "text-emerald-400" : "text-red-400"}>Spindle {selectedResult.hasSpindle ? "✓" : "✗"}</span>
                  {" | "}
                  <span className={selectedResult.hasM30 ? "text-emerald-400" : "text-red-400"}>M30 {selectedResult.hasM30 ? "✓" : "✗"}</span>
                  {" | "}
                  <span className={selectedResult.hasCoolant ? "text-emerald-400" : "text-zinc-500"}>Coolant {selectedResult.hasCoolant ? "✓" : "—"}</span>
                </div>
                <span className={`text-sm font-black font-mono ${selectedResult.passed ? "text-emerald-400" : "text-red-400"}`}>
                  {selectedResult.passed ? "PASS" : "FAIL"}
                </span>
              </div>

              {selectedResult.issues.length === 0 && (
                <div className="text-center text-xs text-emerald-400 py-2">
                  ✅ No issues found — program is clean and ready for machine
                </div>
              )}

              {selectedResult.issues.map((issue, i) => (
                <div key={i} className={`p-2 rounded-lg border text-[10px] space-y-1
                  ${issue.severity === "error" ? "bg-red-950/20 border-red-500/20" :
                    issue.severity === "warning" ? "bg-amber-950/20 border-amber-500/20" :
                    "bg-blue-950/20 border-blue-500/20"}`}>
                  <div className="flex items-start gap-1.5">
                    {issue.severity === "error"
                      ? <XCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                      : issue.severity === "warning"
                      ? <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      : <Info className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />}
                    <div>
                      <span className={`font-semibold ${issue.severity === "error" ? "text-red-300" : issue.severity === "warning" ? "text-amber-300" : "text-blue-300"}`}>
                        [{issue.code}] Line {issue.line}
                      </span>
                      <div className="text-zinc-300 mt-0.5">{issue.message}</div>
                      <div className="text-emerald-300/80 italic mt-0.5">Fix: {issue.fix}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
