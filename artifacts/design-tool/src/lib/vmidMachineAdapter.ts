/**
 * vmidMachineAdapter.ts — Machine Profile from VMID definitions
 *
 * Based on NEW_DELTA.vmid and 2X_DELTA2.vmid analysis.
 */

export interface MachineProfile {
  name:              string;
  type:              "lathe" | "mill" | "turning-center";
  controller:        "fanuc" | "siemens" | "mazak" | "haas" | "generic";
  fileExtension:     string;
  arcSupport:        boolean;
  compensationCancel: "G40";
  homePattern:       "G28_UW_DOT";
  maxSpindleRPM:     number;
  maxFeedRateMmMin:  number;
  xTravelMm:         number;
  zTravelMm:         number;
  simulationNotes:   string[];
}

export const NEW_DELTA_MACHINE: MachineProfile = {
  name:              "NEW_DELTA",
  type:              "lathe",
  controller:        "fanuc",
  fileExtension:     "TAP",
  arcSupport:        true,
  compensationCancel: "G40",
  homePattern:       "G28_UW_DOT",
  maxSpindleRPM:     3000,
  maxFeedRateMmMin:  3000,
  xTravelMm:         400,
  zTravelMm:         1000,
  simulationNotes: [
    "NEW_DELTA.vmid: Fanuc lathe with turning/threading capability",
    "Arc support confirmed (G2/G3)",
    "Home: G28 U0. W0. (trailing dot)",
    "File ext: TAP",
  ],
};

export const DEFAULT_MACHINE = NEW_DELTA_MACHINE;

/** Validate emitted G-code against machine profile rules */
export function validateGcodeAgainstMachine(
  gcode:   string,
  machine: MachineProfile = DEFAULT_MACHINE
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!gcode.includes("G28"))
    issues.push("Missing home return (G28)");
  if (!gcode.includes("M30"))
    issues.push("Missing M30 program end");
  if (!gcode.includes("G40"))
    issues.push("Missing G40 comp cancel");
  if (!gcode.includes("G28 U0."))
    issues.push("Machine requires G28 U0. (dot format) — not found");
  if (!gcode.includes("G28 W0."))
    issues.push("Machine requires G28 W0. (dot format) — not found");
  if (!gcode.includes("G53"))
    issues.push("Machine startup requires G53 machine coord system");
  if (!gcode.includes("M5") && !gcode.includes("M05"))
    issues.push("Missing spindle stop before M30");

  if (gcode.includes("G28 U0.0"))
    issues.push("Found G28 U0.0 — should be G28 U0. (trailing dot, no zero)");
  if (gcode.includes("G28 W0.0"))
    issues.push("Found G28 W0.0 — should be G28 W0. (trailing dot, no zero)");
  if (/\bM05\b/.test(gcode))
    issues.push("Found M05 — should be M5 per machine post");

  const xMatches = [...gcode.matchAll(/\bX([\d.]+)/g)];
  for (const m of xMatches) {
    const xDia = parseFloat(m[1] ?? "0");
    if (xDia > machine.xTravelMm)
      issues.push(`X${xDia} exceeds machine X travel ${machine.xTravelMm}mm`);
  }

  return { ok: issues.length === 0, issues };
}
