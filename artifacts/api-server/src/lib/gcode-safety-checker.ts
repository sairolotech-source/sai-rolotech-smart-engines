export interface SafetyIssue {
  line: number;
  code: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  fix: string;
}

export interface SafetyCheckResult {
  passed: boolean;
  score: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: SafetyIssue[];
  summary: string[];
  stats: {
    programNumber: string;
    toolsUsed: string[];
    maxSpindleFound: number;
    maxFeedFound: number;
    safeZFound: number;
    hasM30: boolean;
    hasG28: boolean;
    hasM1: boolean;
    lineCount: number;
  };
}

const DELTA2X_LIMITS = {
  maxSpindleRpm: 500,
  maxSurfaceSpeed: 350,
  maxFeedRate: 0.5,
  minFeedRate: 0.01,
  minSafeZ: 50.0,
  approachZ: 5.0,
  maxDepthOfCut: 5.0,
  maxRapidFeedZ: 2.8,
};

export const SOLIDCAM_REFERENCE = {
  machine: "2X_DELTA2",
  toolType: "Profile",
  toolNumber: 2,
  toolOffset: 8,
  toolCode: "T0208",
  orientation: "Right",
  spinDirection: "CW",
  feedNormal: 0.175,
  feedFinish: 0.175,
  spinRoughV: 200,
  spinRoughRpm: 454.73,
  spinFinishV: 225,
  spinFinishRpm: 511.58,
  maxSpin: 500,
  referenceDia: 139.997,
  safetyDistance: 2,
  stepDown: 0.75,
  roughOffsetX: 0.6,
  roughOffsetZ: 0.2,
  retreatDistance: 0.2,
  roughType: "Smooth",
  finishMethod: "ISO-Turning",
  gearRange: "Gear#1 (0-5000rpm, 15kW)",
};

function parseNumber(token: string): number | null {
  const n = parseFloat(token);
  return isNaN(n) ? null : n;
}

function extractValue(line: string, code: string): number | null {
  const regex = new RegExp(`${code}([+-]?\\d*\\.?\\d+)`, "i");
  const m = line.match(regex);
  if (!m) return null;
  return parseNumber(m[1]!);
}

export function checkGcodeSafety(gcodeText: string): SafetyCheckResult {
  const lines = gcodeText.split("\n");
  const issues: SafetyIssue[] = [];

  let programNumber = "Unknown";
  const toolsUsed: string[] = [];
  let maxSpindleFound = 0;
  let maxFeedFound = 0;
  let safeZFound = 0;
  let hasM30 = false;
  let hasG28U = false;
  let hasG28W = false;
  let hasM1 = false;
  let lastToolLine = -1;
  let lastG28Line = -1;
  let inToolChange = false;
  let currentTool = "";
  let prevWasG0 = false;
  let prevG0X: number | null = null;
  let prevG0Z: number | null = null;
  let hasG90 = false;
  let hasG53 = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const lineNum = i + 1;
    const line = raw.trim().toUpperCase();

    if (!line || line.startsWith("(") || line.startsWith("%")) {
      if (line.startsWith("(") && line.includes("(TR") && !line.includes("O5000")) {
        // comment, skip
      }
      if (raw.trim().startsWith("O") && /^O\d+/.test(raw.trim())) {
        programNumber = raw.trim().match(/^(O\d+)/)?.[1] ?? "Unknown";
      }
      continue;
    }

    if (/^O\d+/.test(line)) {
      programNumber = line.match(/^(O\d+)/)?.[1] ?? "Unknown";
      continue;
    }

    if (line.includes("M30")) hasM30 = true;
    if (line.includes("M1") && !line.includes("M10") && !line.includes("M13")) hasM1 = true;
    if (line.includes("G90")) hasG90 = true;
    if (line.includes("G53")) hasG53 = true;

    if (line.includes("G28") && line.includes("U")) {
      hasG28U = true;
      lastG28Line = lineNum;
    }
    if (line.includes("G28") && line.includes("W")) {
      hasG28W = true;
      lastG28Line = lineNum;
    }

    // --- G92 Spindle Limit ---
    if (line.includes("G92") && line.includes("S")) {
      const s = extractValue(line, "S");
      if (s !== null) {
        if (s > DELTA2X_LIMITS.maxSpindleRpm) {
          issues.push({
            line: lineNum, code: "SPIN-001", severity: "CRITICAL",
            message: `G92 S${s} — Spindle limit ${s}RPM > Delta 2X max ${DELTA2X_LIMITS.maxSpindleRpm}RPM`,
            fix: `Change to G92 S${DELTA2X_LIMITS.maxSpindleRpm}`,
          });
        }
        if (s > maxSpindleFound) maxSpindleFound = s;
      }
    }

    // --- G96 Surface Speed ---
    if (line.includes("G96") && line.includes("S")) {
      const s = extractValue(line, "S");
      if (s !== null) {
        if (s > DELTA2X_LIMITS.maxSurfaceSpeed) {
          issues.push({
            line: lineNum, code: "SPIN-002", severity: "WARNING",
            message: `G96 S${s} — Surface speed ${s}m/min is high for roll steel`,
            fix: `Reduce to S200 (roughing) or S225 (finishing) for GI/CR rolls`,
          });
        }
        if (s > maxSpindleFound) maxSpindleFound = s;
      }
    }

    // --- Feed Rate ---
    if (line.includes("F")) {
      const f = extractValue(line, "F");
      if (f !== null) {
        if (f > DELTA2X_LIMITS.maxFeedRate) {
          issues.push({
            line: lineNum, code: "FEED-001", severity: "CRITICAL",
            message: `F${f} — Feed rate ${f}mm/rev too high (max ${DELTA2X_LIMITS.maxFeedRate}mm/rev)`,
            fix: `Use F0.102-0.175 for roughing, F0.051-0.175 for finishing (SolidCAM default: 0.175)`,
          });
        }
        if (f < DELTA2X_LIMITS.minFeedRate && f > 0) {
          issues.push({
            line: lineNum, code: "FEED-002", severity: "WARNING",
            message: `F${f} — Feed rate ${f}mm/rev too low — tool rubbing risk`,
            fix: `Minimum feed F0.03 recommended for carbide inserts`,
          });
        }
        if (f > maxFeedFound) maxFeedFound = f;
      }
    }

    // --- Tool Change Sequence ---
    const toolMatch = line.match(/T(\d{2})(\d{2})/);
    if (toolMatch) {
      const tNum = `T${toolMatch[1]}${toolMatch[2]}`;
      if (!toolsUsed.includes(tNum)) toolsUsed.push(tNum);
      currentTool = tNum;
      lastToolLine = lineNum;

      if (lastG28Line < 0 || lastToolLine - lastG28Line > 15) {
        issues.push({
          line: lineNum, code: "TOOL-001", severity: "WARNING",
          message: `${tNum} — Tool call without preceding G28 home within 15 lines`,
          fix: `Add G28 U0. / G28 W0. before tool change (see your .TAP format)`,
        });
      }

      const toolNum = parseInt(toolMatch[1]!, 10);
      const offsetNum = parseInt(toolMatch[2]!, 10);
      if (toolNum === 0 || offsetNum === 0) {
        issues.push({
          line: lineNum, code: "TOOL-002", severity: "CRITICAL",
          message: `${tNum} — Tool or offset number is zero`,
          fix: `Tool/offset must be non-zero (e.g., T0202 or T0208)`,
        });
      }
      if (offsetNum > 32) {
        issues.push({
          line: lineNum, code: "TOOL-003", severity: "WARNING",
          message: `${tNum} — Offset ${offsetNum} is very high — verify offset exists on Delta 2X`,
          fix: `Delta 2X standard offsets: 1-8 for matching, SolidCAM allows mixed (e.g., T0208)`,
        });
      }
    }

    // --- Safe Z for tool change retract ---
    if (line.startsWith("G0") && line.includes("Z")) {
      const z = extractValue(line, "Z");
      if (z !== null) {
        if (z >= 50) safeZFound = Math.max(safeZFound, z);

        if (inToolChange && z < DELTA2X_LIMITS.minSafeZ) {
          issues.push({
            line: lineNum, code: "SAFE-001", severity: "CRITICAL",
            message: `G0 Z${z} — Safe retract Z${z} < minimum Z${DELTA2X_LIMITS.minSafeZ} before/after tool change`,
            fix: `Change to G0 Z50. as per Delta 2X standard (see your .TAP files)`,
          });
        }
      }
    }

    // --- Rapid into material check ---
    if (line.startsWith("G0")) {
      const x = extractValue(line, "X");
      const z = extractValue(line, "Z");
      prevWasG0 = true;
      prevG0X = x;
      prevG0Z = z;
    } else if (line.startsWith("G1") && prevWasG0) {
      const z = extractValue(line, "Z");
      if (z !== null && prevG0Z !== null && prevG0Z > 0 && z < 0) {
        // G0 was at positive Z, now G1 going negative — check if X is large (in material)
        const x = extractValue(line, "X");
        if (x !== null && prevG0X !== null && prevG0X < 200) {
          // This is normal cutting, no issue
        }
      }
      prevWasG0 = false;
    } else {
      prevWasG0 = false;
    }

    // --- M4 direction check for Delta 2X ---
    if ((line.includes("M3") && !line.includes("M30") && !line.includes("M31"))) {
      issues.push({
        line: lineNum, code: "SPIN-003", severity: "CRITICAL",
        message: `M3 (forward) detected — Delta 2X roll forming uses M4 (reverse)`,
        fix: `Change M3 to M4 for correct Delta 2X spindle direction`,
      });
    }

    // --- Missing M1 optional stop ---
    if (line.match(/^N\d+$/) && !hasM1 && i > 5) {
      inToolChange = true;
    }

    // --- G2/G3 arc with zero or negative radius ---
    if ((line.includes("G2") || line.includes("G3")) && line.includes("R")) {
      const r = extractValue(line, "R");
      if (r !== null && r <= 0) {
        issues.push({
          line: lineNum, code: "ARC-001", severity: "CRITICAL",
          message: `Arc R${r} — Zero or negative radius on G${line.includes("G2") ? "2" : "3"} arc`,
          fix: `Check arc radius — must be positive value matching roll profile geometry`,
        });
      }
      if (r !== null && r > 500) {
        issues.push({
          line: lineNum, code: "ARC-002", severity: "WARNING",
          message: `Arc R${r} — Very large radius ${r}mm — verify this matches roll profile`,
          fix: `Check DXF drawing — large radii may indicate geometry error`,
        });
      }
    }

    // --- X diameter mode: X values must not be negative on OD turning ---
    if ((line.includes("G1") || line.includes("G0")) && line.includes("X")) {
      const x = extractValue(line, "X");
      if (x !== null && x < 0) {
        issues.push({
          line: lineNum, code: "COORD-001", severity: "CRITICAL",
          message: `X${x} — Negative X coordinate in OD turning — tool crash risk`,
          fix: `X must be positive in diameter mode for OD roll turning`,
        });
      }
    }
  }

  if (!hasM30) {
    issues.push({
      line: lines.length, code: "END-001", severity: "CRITICAL",
      message: "M30 missing — Program has no end/rewind command",
      fix: "Add M30 at end of program (required for Delta 2X)",
    });
  }

  if (!hasG28U || !hasG28W) {
    issues.push({
      line: 1, code: "HOME-001", severity: "WARNING",
      message: `G28 home missing (U:${hasG28U ? "OK" : "MISSING"}, W:${hasG28W ? "OK" : "MISSING"})`,
      fix: "Add G28 U0. and G28 W0. before tool calls and at program end",
    });
  }

  if (!hasM1) {
    issues.push({
      line: 1, code: "SAFE-002", severity: "INFO",
      message: "M1 optional stop not found — Machinist cannot check tool before cutting",
      fix: "Add M1 after G28 W0. at start — allows operator to verify setup",
    });
  }

  if (!hasG90) {
    issues.push({
      line: 1, code: "MODE-001", severity: "WARNING",
      message: "G90 absolute mode not declared",
      fix: "Add G90 at start of program to ensure absolute positioning",
    });
  }

  if (safeZFound < DELTA2X_LIMITS.minSafeZ && safeZFound > 0) {
    issues.push({
      line: 1, code: "SAFE-003", severity: "WARNING",
      message: `Safe Z retract found: Z${safeZFound} — less than recommended Z50`,
      fix: "Use G0 Z50. for safe retract on Delta 2X (as in your .TAP files)",
    });
  }

  const criticalCount = issues.filter(i => i.severity === "CRITICAL").length;
  const warningCount = issues.filter(i => i.severity === "WARNING").length;
  const infoCount = issues.filter(i => i.severity === "INFO").length;

  const score = Math.max(0, 100 - (criticalCount * 25) - (warningCount * 8) - (infoCount * 2));
  const passed = criticalCount === 0;

  const summary: string[] = [
    `Program: ${programNumber}`,
    `Tools: ${toolsUsed.join(", ") || "None detected"}`,
    `Max Spindle: ${maxSpindleFound}rpm (limit: ${DELTA2X_LIMITS.maxSpindleRpm}rpm)`,
    `Max Feed: ${maxFeedFound}mm/rev`,
    `Safe Z: ${safeZFound > 0 ? `Z${safeZFound}` : "Not detected"}`,
    `M30 End: ${hasM30 ? "Present" : "MISSING"}`,
    `G28 Home: ${hasG28U && hasG28W ? "Present" : "Check needed"}`,
    `Safety Score: ${score}/100`,
  ];

  return {
    passed,
    score,
    criticalCount,
    warningCount,
    infoCount,
    issues,
    summary,
    stats: {
      programNumber,
      toolsUsed,
      maxSpindleFound,
      maxFeedFound,
      safeZFound,
      hasM30,
      hasG28: hasG28U && hasG28W,
      hasM1,
      lineCount: lines.length,
    },
  };
}
