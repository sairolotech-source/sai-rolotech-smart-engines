/**
 * toolLibraryEngine.ts — CNC Turning Tool Library
 *
 * Tool database for roll forming lathe operations.
 * Based on real tooling used in SAI Rolotech machine setup.
 */

export type InsertShape = "D" | "V" | "C" | "T" | "S" | "R";
export type ToolType = "profile" | "groove" | "cutoff" | "boring" | "thread";
export type CuttingDirection = "right" | "left" | "neutral";
export type ToolOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type XOutputDirection = "positive" | "negative";

export interface TurningTool {
  toolNo:            number;
  description:       string;
  toolType:          ToolType;
  insertShape:       InsertShape;
  leadAngleDeg:      number;
  noseRadiusMm:      number;
  insertThicknessMm: number;
  cuttingDirection:  CuttingDirection;
  orientation:       ToolOrientation;
  xOutputDirection:  XOutputDirection;
  holderStyle:       string;
  shankWidthMm:      number;
  shankHeightMm:     number;
  toolLengthMm:      number;
  maxDepthMm:        number;
  minRadiusMm:       number;
  turretPosition:    number;
  recommended:       string[];
  estimated:         boolean;
  notes:             string[];
}

export const TOOL_LIBRARY: TurningTool[] = [
  {
    toolNo:            1,
    description:       "PROFILE ROUGH — 35° Diamond R0.8",
    toolType:          "profile",
    insertShape:       "V",
    leadAngleDeg:      35,
    noseRadiusMm:      0.8,
    insertThicknessMm: 4.76,
    cuttingDirection:  "right",
    orientation:       1,
    xOutputDirection:  "negative",
    holderStyle:       "PVVBN 2525 M16",
    shankWidthMm:      25,
    shankHeightMm:     25,
    toolLengthMm:      150,
    maxDepthMm:        8.0,
    minRadiusMm:       1.2,
    turretPosition:    1,
    recommended:       ["OD rough turning", "profile contour rough"],
    estimated:         false,
    notes:             ["Primary OD rough tool", "Good for D2 tool steel"],
  },
  {
    toolNo:            2,
    description:       "PROFILE FINISH — 35° Diamond R0.4",
    toolType:          "profile",
    insertShape:       "V",
    leadAngleDeg:      35,
    noseRadiusMm:      0.4,
    insertThicknessMm: 4.76,
    cuttingDirection:  "right",
    orientation:       1,
    xOutputDirection:  "negative",
    holderStyle:       "PVVBN 2525 M16",
    shankWidthMm:      25,
    shankHeightMm:     25,
    toolLengthMm:      150,
    maxDepthMm:        4.0,
    minRadiusMm:       0.8,
    turretPosition:    2,
    recommended:       ["OD finish turning", "groove contour finish"],
    estimated:         false,
    notes:             ["Finish pass after roughing", "R0.4 matches typical groove corners"],
  },
  {
    toolNo:            4,
    description:       "GROOVE — 4mm width parting/groove tool",
    toolType:          "groove",
    insertShape:       "S",
    leadAngleDeg:      90,
    noseRadiusMm:      0.2,
    insertThicknessMm: 4.0,
    cuttingDirection:  "neutral",
    orientation:       3,
    xOutputDirection:  "negative",
    holderStyle:       "MGIVR 2525-4",
    shankWidthMm:      25,
    shankHeightMm:     25,
    toolLengthMm:      150,
    maxDepthMm:        20.0,
    minRadiusMm:       0.2,
    turretPosition:    4,
    recommended:       ["groove plunge", "web bottom flat"],
    estimated:         false,
    notes:             ["4mm wide groove insert", "Use for initial plunge in roll grooves"],
  },
  {
    toolNo:            6,
    description:       "BORING BAR — CCMT 09 finish bore",
    toolType:          "boring",
    insertShape:       "C",
    leadAngleDeg:      80,
    noseRadiusMm:      0.8,
    insertThicknessMm: 3.18,
    cuttingDirection:  "left",
    orientation:       2,
    xOutputDirection:  "positive",
    holderStyle:       "A25R-SCLCR09",
    shankWidthMm:      25,
    shankHeightMm:     25,
    toolLengthMm:      250,
    maxDepthMm:        6.0,
    minRadiusMm:       0.0,
    turretPosition:    6,
    recommended:       ["bore finishing", "shaft bore"],
    estimated:         false,
    notes:             ["Internal boring — shaft bore finish", "CCMT 09 insert"],
  },
  {
    toolNo:            8,
    description:       "CUTOFF — 3mm parting tool",
    toolType:          "cutoff",
    insertShape:       "S",
    leadAngleDeg:      90,
    noseRadiusMm:      0.1,
    insertThicknessMm: 3.0,
    cuttingDirection:  "neutral",
    orientation:       3,
    xOutputDirection:  "negative",
    holderStyle:       "MGIVR 2020-3",
    shankWidthMm:      20,
    shankHeightMm:     20,
    toolLengthMm:      120,
    maxDepthMm:        40.0,
    minRadiusMm:       0.0,
    turretPosition:    8,
    recommended:       ["cutoff", "parting"],
    estimated:         true,
    notes:             ["3mm parting blade — estimated entry", "Verify actual blade width"],
  },
];

export function getToolByNumber(toolNo: number): TurningTool | undefined {
  return TOOL_LIBRARY.find(t => t.toolNo === toolNo);
}

export function getToolsByType(type: ToolType): TurningTool[] {
  return TOOL_LIBRARY.filter(t => t.toolType === type);
}

export function getTurretAssignment(): Map<number, TurningTool> {
  const m = new Map<number, TurningTool>();
  for (const t of TOOL_LIBRARY) {
    m.set(t.turretPosition, t);
  }
  return m;
}
