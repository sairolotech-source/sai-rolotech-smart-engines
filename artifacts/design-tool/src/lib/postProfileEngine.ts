/**
 * postProfileEngine.ts — CNC Post Processor Profile Definitions
 *
 * Source of truth for machine/post conventions.
 * Based on real .TAP.nc programs from SAI Rolotech machines.
 * Reference: NEW_DELTA.gpp, 2X_DELTA2.gpp conventions.
 */

export type PostOutputExtension = "TAP" | "nc" | "gcode" | "txt";
export type SpindleMode = "G97" | "G96";
export type SpindleDir  = "M3" | "M4";

export interface PostProfile {
  name:              string;
  extension:         PostOutputExtension;
  spindleMode:       SpindleMode;
  spindleDir:        SpindleDir;
  cuttingSpeedSm:    number;
  maxSpindleRPM:     number;
  feedRoughMmRev:    number;
  feedFinishMmRev:   number;
  cornerRadiusMm:    number;
  homeReturn:        "G28_UW_DOT";
  spindleStop:       "M5" | "M05";
  programEnd:        "M30";
  optionalStop:      "M1" | "M0" | null;
  machineCoordSys:   "G53" | null;
  useDiameter:       boolean;
  outputTrailingDot: boolean;
  notes:             string[];
}

/** Primary profile — matches real .TAP.nc programs from SAI Rolotech machine */
export const REAL_TAP_POST: PostProfile = {
  name:              "REAL_TAP",
  extension:         "TAP",
  spindleMode:       "G96",
  spindleDir:        "M4",
  cuttingSpeedSm:    200,
  maxSpindleRPM:     500,
  feedRoughMmRev:    0.25,
  feedFinishMmRev:   0.08,
  cornerRadiusMm:    0.8,
  homeReturn:        "G28_UW_DOT",
  spindleStop:       "M5",
  programEnd:        "M30",
  optionalStop:      "M1",
  machineCoordSys:   "G53",
  useDiameter:       true,
  outputTrailingDot: true,
  notes: [
    "Matches real .TAP.nc programs from SAI Rolotech machine",
    "G96 CSS mode S200 M4 (CCW spindle)",
    "G92 S500 max RPM limiter before G96",
    "Home: G28 U0. / G28 W0. (trailing dot format)",
    "File extension: .TAP",
    "Corner arcs: G3 R0.8",
    "Optional stop M1 after home on startup",
  ],
};

export const NEW_DELTA_POST = REAL_TAP_POST;
export const DEFAULT_POST   = REAL_TAP_POST;

export function getPostProfile(name: string): PostProfile {
  const map: Record<string, PostProfile> = {
    "REAL_TAP":  REAL_TAP_POST,
    "NEW_DELTA": REAL_TAP_POST,
  };
  return map[name] ?? DEFAULT_POST;
}

/** Format a number with trailing dot convention: 50 → "50.", 50.5 → "50.500" */
export function fmtDot(n: number, dec = 3): string {
  if (Math.abs(n - Math.round(n)) < 0.0005) {
    return `${Math.round(n)}.`;
  }
  return n.toFixed(dec);
}
