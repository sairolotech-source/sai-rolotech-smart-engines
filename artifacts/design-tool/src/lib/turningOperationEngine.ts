/**
 * turningOperationEngine.ts — SolidCAM-style Turning Operation Data Model
 *
 * 10-section operation definition matching SolidCAM turning workflow.
 * Each section is a typed interface + validation function.
 */

import type { TurningTool } from "./toolLibraryEngine";
import type { RoughSection } from "./roughStrategyEngine";
import type { FinishSection } from "./finishStrategyEngine";
export type { RoughSection, FinishSection };

// ══ SECTION 1 — GEOMETRY ════════════════════════════════════════════
export interface GeometrySection {
  coordSys:         "machine" | "part" | "custom";
  contourType:      "OD" | "bore" | "face" | "groove";
  partialMachining: boolean;
  zStart:           number;
  zEnd:             number;
  xMin:             number;
  xMax:             number;
  cutterAngleLimit: number;
}

// ══ SECTION 2 — TOOL ═══════════════════════════════════════════════
export interface ToolSection {
  tool:             TurningTool;
  toolOffset:       number;
  spindleDir:       "M3" | "M4";
  turretStation:    number;
  safetyAngleDeg:   number;
  holderSafetyMm:   number;
  xOutputDirection: "positive" | "negative";
  orientation:      number;
}

// ══ SECTION 3 — LEVELS ══════════════════════════════════════════════
export interface LevelsSection {
  safetyDistanceMm: number;
  cutEndSafetyMm:   number;
  xSafetyMm:        number;
  zSafetyMm:        number;
  fixtureClrMm:     number;
  xMinDiaMm:        number;
  xMaxDiaMm:        number;
}

// ══ SECTION 4 — TECHNOLOGY ══════════════════════════════════════════
export type SpindleMode = "RPM" | "CSS";
export type FeedMode    = "mm_per_rev" | "mm_per_min";

export interface TechnologySection {
  feedMode:         FeedMode;
  feedRoughMmRev:   number;
  feedFinishMmRev:  number;
  feedLeadInMmRev:  number;
  feedLeadOutMmRev: number;
  spindleMode:      SpindleMode;
  spindleSpeedVal:  number;
  finishSpeedVal:   number;
  maxSpindleRPM:    number;
  minSpindleRPM:    number;
  cssRefDiaMm:      number;
  coolantOn:        boolean;
  coolantType:      "flood" | "mist" | "air" | "none";
}

// ══ SECTION 5 — FEED POINTS ═════════════════════════════════════════
export interface FeedPoint {
  profileNo:    number;
  xMm:          number;
  zMm:          number;
  deltaMm:      number;
  feedOverride: number;
}

// ══ SECTION 8 — STRATEGIES ══════════════════════════════════════════
export interface StrategiesSection {
  descendingMotion: boolean;
  zSplitting:       boolean;
  constantSlicing:  boolean;
  retractEachSlice: boolean;
  rollInApproach:   boolean;
}

// ══ SECTION 9 — BREAK EDGES ═════════════════════════════════════════
export type BreakEdgeType = "chamfer" | "radius" | "none";
export type BreakEdgeSide = "both" | "top" | "bottom";

export interface BreakEdgesSection {
  type:    BreakEdgeType;
  sizeMm:  number;
  angleDeg: number;
  side:    BreakEdgeSide;
}

// ══ SECTION 10 — LINK / MISC ════════════════════════════════════════
export interface LinkSection {
  approachType: "rapid" | "feed" | "arc";
  retractType:  "rapid" | "feed" | "arc";
  coolantOn:    boolean;
  dwellSec:     number;
  optionalStop: boolean;
  machineNotes: string;
}

// ══ COMPLETE OPERATION ═══════════════════════════════════════════════
export type OperationType = "contour_turning" | "groove" | "bore" | "face" | "thread";

export interface TurningOperation {
  id:            string;
  name:          string;
  operationType: OperationType;
  geometry:      GeometrySection;
  tool:          ToolSection;
  levels:        LevelsSection;
  technology:    TechnologySection;
  feedPoints:    FeedPoint[];
  rough:         RoughSection;
  finish:        FinishSection;
  strategies:    StrategiesSection;
  breakEdges:    BreakEdgesSection;
  link:          LinkSection;
}

// ══ DEFAULTS ═════════════════════════════════════════════════════════
export function defaultLevels(): LevelsSection {
  return {
    safetyDistanceMm: 5.0,
    cutEndSafetyMm:   2.0,
    xSafetyMm:        5.0,
    zSafetyMm:        5.0,
    fixtureClrMm:     10.0,
    xMinDiaMm:        0.0,
    xMaxDiaMm:        999.0,
  };
}

export function defaultTechnology(): TechnologySection {
  return {
    feedMode:         "mm_per_rev",
    feedRoughMmRev:   0.25,
    feedFinishMmRev:  0.08,
    feedLeadInMmRev:  0.15,
    feedLeadOutMmRev: 0.15,
    spindleMode:      "CSS",
    spindleSpeedVal:  200,
    finishSpeedVal:   250,
    maxSpindleRPM:    2500,
    minSpindleRPM:    100,
    cssRefDiaMm:      100.0,
    coolantOn:        true,
    coolantType:      "flood",
  };
}

// ══ VALIDATION ═══════════════════════════════════════════════════════
export interface OperationValidationResult {
  ok:       boolean;
  errors:   string[];
  warnings: string[];
}

export function validateOperation(op: TurningOperation): OperationValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  if (op.geometry.zEnd >= op.geometry.zStart)
    errors.push("zEnd must be less than zStart (Z negative into part)");
  if (op.geometry.xMin < 0)
    errors.push("xMin cannot be negative");
  if (op.levels.safetyDistanceMm < 0)
    errors.push("safetyDistance cannot be negative");
  if (op.levels.safetyDistanceMm < 0.5)
    warnings.push("safetyDistance < 0.5mm is very tight — crash risk");
  if (op.technology.feedRoughMmRev > 0.5)
    warnings.push("Feed > 0.5 mm/rev is aggressive for tool steel");
  if (op.technology.feedFinishMmRev > op.technology.feedRoughMmRev)
    errors.push("Finish feed cannot be higher than rough feed");
  if (op.technology.maxSpindleRPM < op.technology.minSpindleRPM)
    errors.push("maxSpindleRPM cannot be less than minSpindleRPM");
  if (op.rough.stepDownX <= 0)
    errors.push("Rough step down X must be positive");
  if (op.rough.stepDownX > op.tool.tool.maxDepthMm)
    warnings.push(`Step down ${op.rough.stepDownX}mm exceeds tool maxDepth ${op.tool.tool.maxDepthMm}mm`);
  if (op.finish.enabled && op.finish.passes < 1)
    errors.push("Finish enabled but passes < 1");

  return { ok: errors.length === 0, errors, warnings };
}

function _defaultRough(): RoughSection {
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

function _defaultFinish(): FinishSection {
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

/** Build a default operation for a given roll and station */
export function buildDefaultOperation(params: {
  stationLabel: string;
  side:         "upper" | "lower";
  rollNo:       number;
  tool:         TurningTool;
  rollOD:       number;
  rollWidth:    number;
  grooveDepth:  number;
}): TurningOperation {
  const { stationLabel, side, rollNo, tool, rollOD, rollWidth, grooveDepth } = params;

  return {
    id:            `${stationLabel}-${side.toUpperCase()}-R${rollNo}`,
    name:          `STN${stationLabel} ${side.toUpperCase()} GROOVE`,
    operationType: "contour_turning",
    geometry: {
      coordSys:         "machine",
      contourType:      "groove",
      partialMachining: false,
      zStart:           0,
      zEnd:             -rollWidth,
      xMin:             0,
      xMax:             rollOD + 10,
      cutterAngleLimit: 88,
    },
    tool: {
      tool,
      toolOffset:       tool.toolNo,
      spindleDir:       "M4",
      turretStation:    tool.turretPosition,
      safetyAngleDeg:   5,
      holderSafetyMm:   3.0,
      xOutputDirection: tool.xOutputDirection,
      orientation:      tool.orientation,
    },
    levels:     defaultLevels(),
    technology: defaultTechnology(),
    feedPoints: [],
    rough:      _defaultRough(),
    finish:     _defaultFinish(),
    strategies: {
      descendingMotion: false,
      zSplitting:       false,
      constantSlicing:  true,
      retractEachSlice: false,
      rollInApproach:   true,
    },
    breakEdges: {
      type:    "radius",
      sizeMm:  0.3,
      angleDeg: 45,
      side:    "both",
    },
    link: {
      approachType: "arc",
      retractType:  "rapid",
      coolantOn:    true,
      dwellSec:     0.3,
      optionalStop: true,
      machineNotes: `D2 tool steel. Inspect groove depth ${grooveDepth.toFixed(2)}mm after finishing.`,
    },
  };
}
