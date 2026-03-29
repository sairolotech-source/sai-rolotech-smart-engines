/**
 * fanucLathePostAdapter.ts — Adapts raw G-code to match machine post conventions.
 *
 * Normalizes any deviations from the target post profile.
 */

import type { PostProfile } from "./postProfileEngine";
import { DEFAULT_POST } from "./postProfileEngine";

export interface AdaptedGcodeResult {
  program:   string;
  lineCount: number;
  extension: string;
  postUsed:  string;
  warnings:  string[];
}

export function adaptGcodeToPost(
  rawGcode: string,
  post:     PostProfile = DEFAULT_POST
): AdaptedGcodeResult {
  const warnings: string[] = [];
  let program = rawGcode;

  // Fix home return format: U0.0 / W0.0 → U0. / W0.
  if (program.includes("U0.0") || program.includes("W0.0")) {
    program = program.replace(/U0\.0\b/g, "U0.");
    program = program.replace(/W0\.0\b/g, "W0.");
    warnings.push("Fixed: G28 U0.0/W0.0 → G28 U0./W0. (trailing dot format)");
  }

  // Fix spindle stop: M05 → M5
  if (/\bM05\b/.test(program)) {
    program = program.replace(/\bM05\b/g, post.spindleStop);
    warnings.push(`Fixed: M05 → ${post.spindleStop}`);
  }

  // Fix spindle direction: M03 → M4 if post uses M4
  if (post.spindleDir === "M4") {
    if (/\bM03\b/.test(program)) {
      program = program.replace(/\bM03\b/g, "M4");
      warnings.push("Fixed: M03 → M4 (CCW spindle per machine convention)");
    }
    if (/\bM3\b(?!\d)/.test(program)) {
      program = program.replace(/\bM3\b(?!\d)/g, "M4");
      warnings.push("Fixed: M3 → M4");
    }
  }

  // Fix spindle mode: G97 → G96 if post uses G96
  if (post.spindleMode === "G96" && program.includes("G97 S")) {
    program = program.replace(/G97\s+S\d+/g, `G96 S${post.cuttingSpeedSm}`);
    warnings.push("Fixed: G97 → G96 CSS mode");
  }

  const extension = post.extension;
  const lineCount = program.split("\n").length;

  return { program, lineCount, extension, postUsed: post.name, warnings };
}
