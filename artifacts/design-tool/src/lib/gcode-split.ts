/**
 * Sai Rolotech Smart Engines — G-Code Splitter
 *
 * Splits a full lathe roll-machining G-code program into:
 *   RAW PROGRAM   = OP1 (Face + OD Rough) + OP2 (Bore)
 *   FINAL PROGRAM = OP3 (Profile Contour + G71/G70 Finish)
 *
 * Pure client-side — no server call, works fully offline.
 */

export interface SplitGcodeResult {
  rawProgram: string;
  finalProgram: string;
  rawLineCount: number;
  finalLineCount: number;
  programNumber: string;
}

/**
 * Split a full lathe G-code into RAW and FINAL sub-programs.
 */
export function splitGcode(fullGcode: string, rollNumber: number): SplitGcodeResult {
  const lines = fullGcode.split("\n");
  const pNum = String(rollNumber).padStart(4, "0");

  // Find the split point: OP3 marker separates RAW from FINAL
  const finalStartMarkers = [
    "(*** OP3:",
    "(OP3",
    "(OP40",
    "(OD_SEMI_FINISH",
    "(PROFILE CONTOUR",
  ];

  let splitIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim().toUpperCase();
    if (finalStartMarkers.some(m => l.startsWith(m.toUpperCase()))) {
      splitIdx = i;
      break;
    }
  }

  // Program header lines (before first operation)
  const headerEnd = findFirstOpLine(lines);

  // If no split point found, put everything in RAW
  if (splitIdx < 0) {
    return buildSingleResult(lines, pNum);
  }

  const rawLines   = lines.slice(0, splitIdx);
  const finalLines = lines.slice(splitIdx);

  // Inject proper program headers and footers
  const rawHeader  = buildProgramHeader("RAW",   rollNumber, "OP1+OP2: Face, OD Rough, Bore");
  const finalHeader = buildProgramHeader("FINAL", rollNumber, "OP3: Profile Contour + Finish");
  const footer      = buildProgramFooter();

  const rawProgram   = rawHeader   + "\n" + rawLines.join("\n")   + "\n" + footer;
  const finalProgram = finalHeader + "\n" + finalLines.join("\n") + "\n" + footer;

  return {
    rawProgram,
    finalProgram,
    rawLineCount: rawProgram.split("\n").length,
    finalLineCount: finalProgram.split("\n").length,
    programNumber: `O${pNum}`,
  };
}

function findFirstOpLine(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("(***")) return i;
  }
  return Math.min(8, lines.length);
}

function buildSingleResult(lines: string[], pNum: string): SplitGcodeResult {
  const prog = lines.join("\n");
  return {
    rawProgram: prog,
    finalProgram: buildProgramHeader("FINAL", parseInt(pNum), "Full Program (no split)") + "\n(SEE RAW PROGRAM)\n" + buildProgramFooter(),
    rawLineCount: lines.length,
    finalLineCount: 3,
    programNumber: `O${pNum}`,
  };
}

function buildProgramHeader(type: "RAW" | "FINAL", rollNumber: number, desc: string): string {
  const typeCode = type === "RAW" ? "R" : "F";
  const pNum = String(rollNumber).padStart(4, "0");
  const date = new Date().toISOString().split("T")[0];
  return [
    `%`,
    `O${pNum}${typeCode}                 (${type} PROGRAM — ROLL #${rollNumber})`,
    `(${desc})`,
    `(Generated: Sai Rolotech Smart Engines — ${date})`,
    `(*** ${type} PROGRAM — DO NOT MIX WITH ${type === "RAW" ? "FINAL" : "RAW"} PROGRAM ***)`,
    `(Safety: Single-block mode ON for first run. Feed override 25%)`,
  ].join("\n");
}

function buildProgramFooter(): string {
  return [
    ``,
    `(END OF ${new Date().toISOString().split("T")[0]} PROGRAM)`,
    `M09               (COOLANT OFF)`,
    `M05               (SPINDLE OFF)`,
    `G00 X200.000 Z200.000  (SAFE PARK)`,
    `M30               (END OF PROGRAM + REWIND)`,
    `%`,
  ].join("\n");
}

/**
 * Download split G-code programs for a roll
 */
export function downloadSplitGcode(
  fullGcode: string,
  rollNumber: number,
  side: "upper" | "lower",
  stationLabel: string
): void {
  const result = splitGcode(fullGcode, rollNumber);
  const safeName = stationLabel.replace(/[^a-zA-Z0-9_-]/g, "_");

  // Download RAW program
  const rawBlob = new Blob([result.rawProgram], { type: "text/plain" });
  const rawUrl  = URL.createObjectURL(rawBlob);
  const rawA    = document.createElement("a");
  rawA.href     = rawUrl;
  rawA.download = `ROLL_${String(rollNumber).padStart(3,"0")}_${side.toUpperCase()}_${safeName}_RAW.nc`;
  rawA.click();
  URL.revokeObjectURL(rawUrl);

  // Short delay before downloading FINAL
  setTimeout(() => {
    const finBlob = new Blob([result.finalProgram], { type: "text/plain" });
    const finUrl  = URL.createObjectURL(finBlob);
    const finA    = document.createElement("a");
    finA.href     = finUrl;
    finA.download = `ROLL_${String(rollNumber).padStart(3,"0")}_${side.toUpperCase()}_${safeName}_FINAL.nc`;
    finA.click();
    URL.revokeObjectURL(finUrl);
  }, 300);
}

/**
 * Download both RAW and FINAL + DXF in one click (all files for a roll)
 */
export function downloadAllRollFiles(
  fullGcode: string,
  rollNumber: number,
  side: "upper" | "lower",
  stationLabel: string
): SplitGcodeResult {
  const result = splitGcode(fullGcode, rollNumber);
  const safeName = stationLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
  const prefix = `ROLL_${String(rollNumber).padStart(3,"0")}_${side.toUpperCase()}_${safeName}`;

  const files = [
    { name: `${prefix}_RAW.nc`,    content: result.rawProgram },
    { name: `${prefix}_FINAL.nc`,  content: result.finalProgram },
  ];

  files.forEach((f, i) => {
    setTimeout(() => {
      const blob = new Blob([f.content], { type: "text/plain" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(url);
    }, i * 350);
  });

  return result;
}
