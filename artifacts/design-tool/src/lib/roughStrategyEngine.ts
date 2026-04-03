/**
 * roughStrategyEngine.ts — Rough turning pass calculation.
 *
 * Given material geometry, computes rough pass count, depths, and toolpath plan.
 */

export type RoughType = "parallel" | "adaptive" | "plunge";
export type RoughDir  = "right_to_left" | "left_to_right" | "bidirectional";

export interface RoughSection {
  roughType:         RoughType;
  equalSteps:        boolean;
  adaptiveStepDown:  boolean;
  stepDownX:         number;
  stepOverZ:         number;
  retractDistMm:     number;
  smoothing:         boolean;
  direction:         RoughDir;
  finishOnRough:     boolean;
  leaveAllowanceX:   number;
  leaveAllowanceZ:   number;
}

export function defaultRough(): RoughSection {
  return {
    roughType:         "parallel",
    equalSteps:        true,
    adaptiveStepDown:  false,
    stepDownX:         2.0,
    stepOverZ:         0.0,
    retractDistMm:     1.5,
    smoothing:         false,
    direction:         "right_to_left",
    finishOnRough:     false,
    leaveAllowanceX:   0.3,
    leaveAllowanceZ:   0.1,
  };
}

export interface RoughPass {
  passNo:      number;
  xStartDia:   number;
  xEndDia:     number;
  stepDownMm:  number;
  isLastPass:  boolean;
  feedMmRev:   number;
  note:        string;
}

export interface RoughPassPlan {
  passList:          RoughPass[];
  totalPasses:       number;
  totalRemovalMm:    number;
  estimatedTimeSec:  number;
}

export interface RoughPlanInput {
  stockOD:         number;
  targetOD:        number;
  rollWidthMm:     number;
  leaveAllowance:  number;
  rough:           RoughSection;
  feedMmRev:       number;
  spindleSpeedRPM: number;
}

export function computeRoughPassPlan(input: RoughPlanInput): RoughPassPlan {
  const { stockOD, targetOD, rollWidthMm, leaveAllowance, rough, feedMmRev, spindleSpeedRPM } = input;

  const targetWithAllowance = targetOD + leaveAllowance * 2;
  const totalRemoval        = stockOD - targetWithAllowance;

  if (totalRemoval <= 0) {
    return { passList: [], totalPasses: 0, totalRemovalMm: 0, estimatedTimeSec: 0 };
  }

  const nominalStep = rough.stepDownX;
  const numPasses   = Math.ceil(totalRemoval / (nominalStep * 2));

  const passList: RoughPass[] = [];
  let currentDia = stockOD;

  for (let i = 0; i < numPasses; i++) {
    const remaining  = currentDia - targetWithAllowance;
    const thisCut    = Math.min(nominalStep * 2, remaining);
    const actualStep = thisCut / 2;
    const nextDia    = currentDia - thisCut;
    const isLast     = i === numPasses - 1;

    passList.push({
      passNo:     i + 1,
      xStartDia:  parseFloat(currentDia.toFixed(3)),
      xEndDia:    parseFloat((currentDia - thisCut).toFixed(3)),
      stepDownMm: parseFloat(actualStep.toFixed(3)),
      isLastPass: isLast,
      feedMmRev,
      note:       isLast
        ? `Last rough — leaves ${leaveAllowance.toFixed(2)}mm allowance`
        : `Rough pass ${i + 1}/${numPasses}`,
    });

    currentDia = nextDia;
  }

  const feedMmMin        = feedMmRev * spindleSpeedRPM;
  const timePerPass      = feedMmMin > 0 ? (rollWidthMm / feedMmMin) * 60 : 0;
  const estimatedTimeSec = parseFloat((passList.length * timePerPass).toFixed(1));

  return { passList, totalPasses: passList.length, totalRemovalMm: parseFloat(totalRemoval.toFixed(3)), estimatedTimeSec };
}
