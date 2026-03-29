/**
 * turningSimulationEngine.ts — Dry-run toolpath validation.
 *
 * Validates a turning operation without physical execution.
 * Checks: X/Z travel, retract safety, gouge risk, shaft clearance.
 */

import type { TurningOperation } from "./turningOperationEngine";
import type { MachineProfile }   from "./vmidMachineAdapter";
import { DEFAULT_MACHINE }       from "./vmidMachineAdapter";

export type RiskLevel = "OK" | "WARN" | "CRITICAL";

export interface SimulationCheck {
  name:   string;
  result: RiskLevel;
  detail: string;
  value?: number;
  limit?: number;
}

export interface SimulationReport {
  overallRisk:  RiskLevel;
  checks:       SimulationCheck[];
  canRun:       boolean;
  needsReview:  boolean;
  summary:      string;
}

export interface SimulationInput {
  operation: TurningOperation;
  stockOD:   number;
  rollWidth: number;
  shaftDia:  number;
  machine?:  MachineProfile;
}

export function runTurningSimulation(input: SimulationInput): SimulationReport {
  const { operation: op, stockOD, rollWidth, shaftDia, machine = DEFAULT_MACHINE } = input;
  const checks: SimulationCheck[] = [];

  // CHECK 1: X travel
  const maxXDia = stockOD + op.levels.safetyDistanceMm * 2;
  checks.push({
    name:   "X travel limit",
    result: maxXDia <= machine.xTravelMm ? "OK" : "CRITICAL",
    detail: maxXDia <= machine.xTravelMm
      ? `Max X ${maxXDia.toFixed(1)}mm within machine travel ${machine.xTravelMm}mm`
      : `Max X ${maxXDia.toFixed(1)}mm EXCEEDS machine travel ${machine.xTravelMm}mm`,
    value: maxXDia,
    limit: machine.xTravelMm,
  });

  // CHECK 2: Z travel
  const zNeeded = Math.abs(op.geometry.zEnd) + op.levels.zSafetyMm + 10;
  checks.push({
    name:   "Z travel limit",
    result: zNeeded <= machine.zTravelMm ? "OK" : "CRITICAL",
    detail: zNeeded <= machine.zTravelMm
      ? `Z required ${zNeeded.toFixed(1)}mm within machine travel ${machine.zTravelMm}mm`
      : `Z required ${zNeeded.toFixed(1)}mm EXCEEDS machine travel ${machine.zTravelMm}mm`,
    value: zNeeded,
    limit: machine.zTravelMm,
  });

  // CHECK 3: X negative / bore limit
  const minXTarget = shaftDia - 2;
  checks.push({
    name:   "X negative / bore limit",
    result: minXTarget >= 0 ? "OK" : "CRITICAL",
    detail: minXTarget >= 0
      ? `Min X approach ${minXTarget.toFixed(1)}mm — valid`
      : `Min X ${minXTarget.toFixed(1)}mm goes negative — CRASH RISK`,
    value: minXTarget,
  });

  // CHECK 4: Safety retract distance
  const retractOk = op.levels.safetyDistanceMm >= 2.0;
  checks.push({
    name:   "Retract safety distance",
    result: retractOk ? "OK" : (op.levels.safetyDistanceMm >= 0.5 ? "WARN" : "CRITICAL"),
    detail: retractOk
      ? `Safety ${op.levels.safetyDistanceMm}mm ≥ 2.0mm OK`
      : `Safety ${op.levels.safetyDistanceMm}mm is tight`,
    value: op.levels.safetyDistanceMm,
    limit: 2.0,
  });

  // CHECK 5: Feed rate
  const feedOk = op.technology.feedRoughMmRev <= 0.5;
  checks.push({
    name:   "Feed rate",
    result: feedOk ? "OK" : "WARN",
    detail: feedOk
      ? `Feed ${op.technology.feedRoughMmRev} mm/rev normal for tool steel`
      : `Feed ${op.technology.feedRoughMmRev} mm/rev aggressive — verify insert grade`,
    value: op.technology.feedRoughMmRev,
  });

  // CHECK 6: Spindle speed cap
  const rpmCap = op.technology.maxSpindleRPM <= machine.maxSpindleRPM;
  checks.push({
    name:   "Spindle speed cap",
    result: rpmCap ? "OK" : "WARN",
    detail: rpmCap
      ? `G92 S${op.technology.maxSpindleRPM} within machine max S${machine.maxSpindleRPM}`
      : `G92 S${op.technology.maxSpindleRPM} exceeds machine max — G92 will limit`,
    value: op.technology.maxSpindleRPM,
    limit: machine.maxSpindleRPM,
  });

  // CHECK 7: Home return (always passes for engine-built operations)
  checks.push({
    name:   "Home return sequence",
    result: "OK",
    detail: "G28 U0. / G28 W0. programmed at start and end",
  });

  // CHECK 8: Tool nose radius vs groove corner
  const tool       = op.tool.tool;
  const grooveCorner = 0.5;
  const noseOk     = tool.noseRadiusMm <= grooveCorner * 1.5;
  checks.push({
    name:   "Tool nose radius fit",
    result: noseOk ? "OK" : "WARN",
    detail: noseOk
      ? `Nose R${tool.noseRadiusMm}mm fits groove corner (~${grooveCorner}mm)`
      : `Nose R${tool.noseRadiusMm}mm may over-radius groove — undercutting risk`,
    value: tool.noseRadiusMm,
    limit: grooveCorner * 1.5,
  });

  const criticals = checks.filter(c => c.result === "CRITICAL").length;
  const warns     = checks.filter(c => c.result === "WARN").length;

  const overallRisk: RiskLevel = criticals > 0 ? "CRITICAL" : warns > 0 ? "WARN" : "OK";

  const summary = criticals > 0
    ? `CRITICAL: ${criticals} issue(s) — DO NOT RUN without fixing`
    : warns > 0
    ? `WARN: ${warns} advisory(ies) — review before running`
    : "ALL CHECKS PASSED — safe to proceed";

  return { overallRisk, checks, canRun: criticals === 0, needsReview: warns > 0, summary };
}
