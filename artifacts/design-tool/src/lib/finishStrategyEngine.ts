/**
 * finishStrategyEngine.ts — Finish turning pass calculation.
 *
 * Computes finish passes, Ra estimate, spring passes.
 */

import type { TurningTool } from "./toolLibraryEngine";

export type FinishMethod = "single_pass" | "multi_pass" | "rest_material";
export type CompensationType = "wear" | "geometry" | "off";

export interface FinishSection {
  enabled:          boolean;
  semiFinishFirst:  boolean;
  method:           FinishMethod;
  restMaterialOnly: boolean;
  passes:           number;
  stepOverMm:       number;
  compensation:     CompensationType;
  springPassCount:  number;
}

export function defaultFinish(): FinishSection {
  return {
    enabled:          true,
    semiFinishFirst:  false,
    method:           "single_pass",
    restMaterialOnly: false,
    passes:           1,
    stepOverMm:       0.0,
    compensation:     "wear",
    springPassCount:  0,
  };
}

export interface FinishPass {
  passNo:      number;
  xTargetDia:  number;
  feedMmRev:   number;
  speedMmin:   number;
  isSpring:    boolean;
  note:        string;
}

export interface FinishPassPlan {
  passList:         FinishPass[];
  surfaceRoughness: number;
  springPasses:     number;
  finalAllowance:   number;
  warnings:         string[];
}

export interface FinishPlanInput {
  targetOD:      number;
  allowanceLeft: number;
  rollWidthMm:   number;
  finish:        FinishSection;
  tool:          TurningTool;
  feedMmRev:     number;
  speedMmin:     number;
}

export function computeFinishPassPlan(input: FinishPlanInput): FinishPassPlan {
  const { targetOD, allowanceLeft, finish, tool, feedMmRev, speedMmin } = input;
  const warnings: string[] = [];

  if (!finish.enabled) {
    return { passList: [], surfaceRoughness: 0, springPasses: 0, finalAllowance: allowanceLeft, warnings };
  }

  const passList: FinishPass[] = [];
  let remaining = allowanceLeft;

  // Semi-finish pass
  if (finish.semiFinishFirst && finish.passes > 1) {
    const semiDepth = remaining * 0.5;
    passList.push({
      passNo:     1,
      xTargetDia: targetOD + (remaining - semiDepth) * 2,
      feedMmRev:  feedMmRev * 1.5,
      speedMmin:  speedMmin * 0.85,
      isSpring:   false,
      note:       "Semi-finish pass",
    });
    remaining -= semiDepth;
  }

  // Main finish passes
  for (let i = 0; i < Math.max(1, finish.passes); i++) {
    passList.push({
      passNo:     passList.length + 1,
      xTargetDia: targetOD,
      feedMmRev,
      speedMmin,
      isSpring:   false,
      note:       `Finish pass ${i + 1}`,
    });
  }

  // Spring passes
  for (let s = 0; s < finish.springPassCount; s++) {
    passList.push({
      passNo:     passList.length + 1,
      xTargetDia: targetOD,
      feedMmRev:  feedMmRev * 0.8,
      speedMmin,
      isSpring:   true,
      note:       `Spring pass ${s + 1} — dimensional accuracy`,
    });
  }

  // Ra ≈ f² / (8r) × 1000 µm
  const Ra = (feedMmRev ** 2) / (8 * tool.noseRadiusMm) * 1000;
  if (Ra > 3.2) {
    warnings.push(`Estimated Ra ${Ra.toFixed(1)}µm > 3.2µm — reduce feed or increase nose radius`);
  }
  if (tool.noseRadiusMm > 0.8) {
    warnings.push(`Nose radius R${tool.noseRadiusMm}mm — may leave scallop on finish surface`);
  }

  return {
    passList,
    surfaceRoughness: parseFloat(Ra.toFixed(2)),
    springPasses:     finish.springPassCount,
    finalAllowance:   0,
    warnings,
  };
}
