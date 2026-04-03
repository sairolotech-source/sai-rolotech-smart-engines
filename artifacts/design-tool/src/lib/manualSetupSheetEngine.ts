/**
 * manualSetupSheetEngine.ts — Printable operator/machinist setup sheets.
 *
 * Generates plain-text setup instructions a machine operator can follow
 * without needing to read G-code.
 */

import type { TurningOperation } from "./turningOperationEngine";
import type { RoughPassPlan } from "./roughStrategyEngine";
import type { FinishPassPlan } from "./finishStrategyEngine";

export interface SetupSheetOptions {
  includeToolSetup:   boolean;
  includeRoughSheet:  boolean;
  includeFinishSheet: boolean;
  includeChecklist:   boolean;
  includeWarnings:    boolean;
}

const DEFAULT_OPTIONS: SetupSheetOptions = {
  includeToolSetup:   true,
  includeRoughSheet:  true,
  includeFinishSheet: true,
  includeChecklist:   true,
  includeWarnings:    true,
};

export function generateSetupSheet(params: {
  operation:  TurningOperation;
  roughPlan:  RoughPassPlan;
  finishPlan: FinishPassPlan;
  rollOD:     number;
  rollID:     number;
  material:   string;
  options?:   SetupSheetOptions;
}): string {
  const { operation: op, roughPlan, finishPlan, rollOD, rollID, material } = params;
  const opt = params.options ?? DEFAULT_OPTIONS;

  const D  = "─".repeat(60);
  const TT = "═".repeat(60);
  const L: string[] = [];

  L.push(TT);
  L.push("SAI ROLOTECH SMART ENGINE — MACHINIST SETUP SHEET");
  L.push(TT);
  L.push(`OPERATION : ${op.name}`);
  L.push(`PART      : Roll ${op.id}`);
  L.push(`MATERIAL  : ${material}`);
  L.push(`OD        : ${rollOD.toFixed(1)} mm`);
  L.push(`BORE      : ${rollID.toFixed(1)} mm`);
  L.push(D);

  if (opt.includeToolSetup) {
    const t = op.tool.tool;
    const tNum = String(t.toolNo).padStart(2, "0");
    L.push("TOOL SETUP");
    L.push(D);
    L.push(`  Tool No.       : T${tNum}${tNum}`);
    L.push(`  Description    : ${t.description}`);
    L.push(`  Type           : ${t.toolType.toUpperCase()}`);
    L.push(`  Holder         : ${t.holderStyle}`);
    L.push(`  Insert shape   : ${t.insertShape} — ${t.leadAngleDeg}° lead angle`);
    L.push(`  Nose radius    : R${t.noseRadiusMm} mm`);
    L.push(`  Cutting dir    : ${t.cuttingDirection.toUpperCase()}`);
    L.push(`  X output dir   : ${t.xOutputDirection.toUpperCase()}`);
    L.push(`  Turret pos     : Station ${t.turretPosition}`);
    L.push(`  Tool offset    : H${String(op.tool.toolOffset).padStart(2, "0")}`);
    L.push("  NOTE           : Verify insert clearance before first run");
    L.push(D);
  }

  const tech = op.technology;
  L.push("SPEEDS AND FEEDS");
  L.push(D);
  L.push(`  Spindle mode   : ${tech.spindleMode === "CSS" ? `G96 CSS — ${tech.spindleSpeedVal} m/min` : `G97 RPM — ${tech.spindleSpeedVal}`}`);
  L.push(`  Max spindle    : G92 S${tech.maxSpindleRPM}`);
  L.push(`  Rough feed     : ${tech.feedRoughMmRev} mm/rev`);
  L.push(`  Finish feed    : ${tech.feedFinishMmRev} mm/rev`);
  L.push(`  Coolant        : ${tech.coolantOn ? tech.coolantType.toUpperCase() : "OFF"}`);
  L.push(`  Spindle dir    : ${op.tool.spindleDir} (${op.tool.spindleDir === "M4" ? "CCW" : "CW"})`);
  L.push(D);

  const lv = op.levels;
  L.push("SAFETY DISTANCES");
  L.push(D);
  L.push(`  Safety clear   : ${lv.safetyDistanceMm.toFixed(1)} mm`);
  L.push(`  Z safe         : ${lv.zSafetyMm.toFixed(1)} mm`);
  L.push(`  X clearance    : ${lv.xSafetyMm.toFixed(1)} mm`);
  L.push("  Home return    : G28 U0. / G28 W0. after each operation");
  L.push(D);

  if (opt.includeRoughSheet && roughPlan.totalPasses > 0) {
    L.push(`ROUGH PASSES (${roughPlan.totalPasses} total)`);
    L.push(D);
    L.push(`  Total removal  : ${roughPlan.totalRemovalMm.toFixed(2)} mm (diameter)`);
    L.push(`  Approx time    : ${roughPlan.estimatedTimeSec.toFixed(0)} seconds`);
    L.push(`  Step down X    : ${op.rough.stepDownX.toFixed(2)} mm/pass`);
    L.push(`  Retract        : ${op.rough.retractDistMm.toFixed(1)} mm`);
    L.push(`  Leave X        : ${op.rough.leaveAllowanceX.toFixed(2)} mm for finish`);
    L.push("  Passes:");
    for (const pass of roughPlan.passList) {
      L.push(
        `    Pass ${String(pass.passNo).padStart(2)} : ` +
        `X ${pass.xStartDia.toFixed(1)}→${pass.xEndDia.toFixed(1)} mm  ` +
        `ap=${pass.stepDownMm.toFixed(2)}mm  F${pass.feedMmRev}mm/rev` +
        (pass.isLastPass ? "  ← LAST" : "")
      );
    }
    L.push(D);
  }

  if (opt.includeFinishSheet && finishPlan.passList.length > 0) {
    L.push(`FINISH PASSES (${finishPlan.passList.length} total)`);
    L.push(D);
    L.push(`  Surface Ra est : ${finishPlan.surfaceRoughness.toFixed(2)} µm`);
    L.push(`  Spring passes  : ${finishPlan.springPasses}`);
    for (const pass of finishPlan.passList) {
      L.push(
        `    Pass ${String(pass.passNo).padStart(2)} : ` +
        `X ${pass.xTargetDia.toFixed(3)} mm  ` +
        `F${pass.feedMmRev}mm/rev  ${pass.speedMmin}m/min` +
        (pass.isSpring ? "  [SPRING]" : "")
      );
    }
    L.push(D);
  }

  if (opt.includeChecklist) {
    const hNum = String(op.tool.toolOffset).padStart(2, "0");
    L.push("PRE-RUN CHECKLIST");
    L.push(D);
    L.push("  [ ] Insert secure in holder — torque to spec");
    L.push(`  [ ] Tool offset H${hNum} entered in controller`);
    L.push("  [ ] Work zero set on face");
    L.push(`  [ ] Spindle direction ${op.tool.spindleDir} confirmed`);
    L.push("  [ ] Coolant line clear and pressure OK");
    L.push("  [ ] Home return G28 U0. W0. verified");
    L.push("  [ ] Dry run simulation complete before first cut");
    L.push("  [ ] Safety door closed");
    L.push(D);
  }

  if (opt.includeWarnings) {
    const allWarnings = [
      ...finishPlan.warnings,
      ...(op.rough.stepDownX > op.tool.tool.maxDepthMm
        ? [`WARN: step down ${op.rough.stepDownX}mm exceeds tool maxDepth ${op.tool.tool.maxDepthMm}mm`]
        : []),
    ];
    if (allWarnings.length > 0) {
      L.push("WARNINGS");
      L.push(D);
      for (const w of allWarnings) L.push(`  ! ${w}`);
      L.push(D);
    }
  }

  L.push("OPERATOR NOTES");
  L.push(D);
  L.push("  * Profile side — start cut from face side");
  L.push(`  * Groove bottom — use slow feed (F${op.technology.feedFinishMmRev} mm/rev)`);
  L.push("  * Finish pass — remove rough offset before running");
  L.push("  * Check insert clearance at groove wall sides");
  L.push(`  * ${op.link.machineNotes}`);
  L.push(D);
  L.push(`END OF SETUP SHEET — ${op.name}`);
  L.push(TT);

  return L.join("\n");
}

export function generateQuickCard(op: TurningOperation, rollOD: number): string {
  const t    = op.tool.tool;
  const tech = op.technology;
  const tNum = String(t.toolNo).padStart(2, "0");
  const desc = t.description.slice(0, 35).padEnd(35);
  return [
    `+${"─".repeat(50)}+`,
    `| ${op.name.slice(0, 48).padEnd(48)} |`,
    `| TOOL: T${tNum}  ${desc} |`,
    `| SPINDLE: ${tech.spindleMode} ${tech.spindleSpeedVal}${tech.spindleMode === "CSS" ? "m/min" : "RPM"}  DIR: ${op.tool.spindleDir}              |`,
    `| FEED R: ${tech.feedRoughMmRev}mm/rev  FEED F: ${tech.feedFinishMmRev}mm/rev        |`,
    `| SAFETY: ${op.levels.safetyDistanceMm}mm  OD: ${rollOD.toFixed(1)}mm                      |`,
    `| HOME: G28 U0. / G28 W0.                       |`,
    `+${"─".repeat(50)}+`,
  ].join("\n");
}
