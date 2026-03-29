import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildStationRollProfile } from "../lib/toolingEngine";
import { generateLatheGcode, debugRollProfile, MIN_GCODE_LENGTH } from "../lib/gcodeLathe";

export interface Segment {
  type: "line" | "arc";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
  startAngle?: number;
  endAngle?: number;
  bulge?: number;
}

export interface BendPoint {
  x: number;
  y: number;
  angle: number;
  radius: number;
  segmentIndex: number;
}

export interface DxfDimension {
  type: "linear" | "aligned" | "angular" | "radial" | "diameter" | "ordinate";
  value: number;
  text: string;
  defPoint1: { x: number; y: number };
  defPoint2: { x: number; y: number };
  textPosition: { x: number; y: number };
  layer: string;
  rotation: number;
}

export interface ProfileGeometry {
  segments: Segment[];
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  bendPoints: BendPoint[];
  dimensions?: DxfDimension[];
}

export interface GuardrailProfileMetadata {
  model: string;
  coilWidth: number;
  coverWidth: number;
  thickness: number;
  usage: string;
  pitch?: number;
  waveHeight?: number;
  referenceImage?: string;
}

export type PassZoneLabel = "Light Bending" | "Major Forming" | "Finishing" | "Calibration";

export interface StationProfile {
  stationNumber: number;
  label: string;
  segments: Segment[];
  bendAngles: number[];
  totalAngle: number;
  segmentLengths: number[];
  springbackAngles?: number[];
  // Open-section pass distribution fields
  passZone?: PassZoneLabel;
  isCalibrationPass?: boolean;
  angleIncrementDeg?: number;
  springbackCompensationAngle?: number;
  rollFaceWidth?: number;
}

export interface VerificationWarning {
  type: "gouge" | "clearance" | "collision" | "compensation" | "feed" | "speed";
  severity: "error" | "warning" | "info";
  message: string;
  lineNumber?: number;
}

export interface SurfaceFinishEstimate {
  raValue: number;
  raUnit: string;
  quality: "mirror" | "fine" | "standard" | "rough";
  feedRate: number;
  noseRadius: number;
}

export interface CycleTimeBreakdown {
  cuttingTime: number;
  rapidTime: number;
  toolChangeTime: number;
  dwellTime: number;
  totalTime: number;
  airCuttingReduction: number;
}

export interface GcodeOutput {
  stationNumber: number;
  label: string;
  gcode: string;
  lineCount: number;
  totalPathLength: number;
  estimatedTime: number;
  toolMoves: number;
  arcSegmentCount?: number;
  maxChordError?: number;
  estimatedAccuracy?: string;
  noseRadiusCompVerified?: boolean;
  verificationWarnings?: VerificationWarning[];
  surfaceFinish?: SurfaceFinishEstimate | null;
  cycleTimeBreakdown?: CycleTimeBreakdown;
  restMachiningPasses?: number;
  feedRampingApplied?: boolean;
  dwellInsertions?: number;
  controllerFormat?: string;
}

export type ToolPosition = "left" | "right" | "neutral";

export interface LatheToolConfig {
  toolNumber: number;
  offsetNumber: number;
  position: ToolPosition;
  insertType: string;
  noseRadius: number;
  compensation: "G41" | "G42" | "G40";
  wearOffsetNumber?: number;
}

export interface ModalGroupInfo {
  motionCodes: string[];
  feedCodes: string[];
  unitCodes: string[];
  planeCodes: string[];
  coolantCodes: string[];
  spindleCodes: string[];
  compensationCodes: string[];
}

export interface MachineProfile {
  controllerType: string;
  coordinateFormat: "absolute" | "incremental";
  decimalPrecision: number;
  feedRate: number;
  feedUnit: "mm_rev" | "mm_min";
  spindleSpeed: number;
  maxSpindleSpeed: number;
  spindleMode: "css" | "rpm";
  spindleDirection: "M3" | "M4";
  toolFormat: string;
  xDiameterMode: boolean;
  useG28: boolean;
  coolant: boolean;
  workOffset: string;
  customCodes: string[];
  headerLines: string[];
  footerLines: string[];
  detectedTools: { toolNumber: number; offsetNumber: number; comment: string }[];
  toolChangeSequence: string[];
  modalGroups: ModalGroupInfo;
  arcFormat: "R" | "IK" | "IJK";
  programNumberFormat: string;
  lineNumberFormat: string;
  safetyBlock: string;
  endOfBlockChar: string;
}

export interface BoreClearanceInfo {
  computedGap: number;
  minimumAllowed: number;
  isSafe: boolean;
  warningMessage: string | null;
  formula: string;
}

export interface SideCollar {
  material: string;
  OD: number;
  ID: number;
  width: number;
  hardness: string;
  qty: number;
  notes: string;
}

export interface RollProfile {
  upperRoll: Segment[];
  lowerRoll: Segment[];
  rollDiameter: number;
  shaftDiameter: number;
  rollWidth: number;
  gap: number;
  passLineY: number;
  upperRollCenterY: number;
  lowerRollCenterY: number;
  grooveDepth: number;
  upperRollNumber: number;
  lowerRollNumber: number;
  kFactor: number;
  neutralAxisOffset: number;
  upperLatheGcode: string;
  lowerLatheGcode: string;
  boreClearance?: BoreClearanceInfo;
  sideCollar?: SideCollar;
}

export interface RollGapInfo {
  stationNumber: number;
  label: string;
  nominalGap: number;
  springbackGap: number;
  upperRollZ: number;
  lowerRollZ: number;
  bendAllowances: number[];
}

// ─── STEP 3: Roll Behavior types ─────────────────────────────────────────────
export interface BendBehavior {
  bendNumber: number;
  targetAngle: number;
  bendRadius: number;
  clearanceRec: number;
  springbackRisk: "low" | "medium" | "high";
  surfaceRisk: "low" | "medium" | "high";
}

export interface RollBehavior {
  phase: "ENTRY" | "MAIN" | "FINAL";
  upperRollAction: string;
  lowerRollAction: string;
  supportType: "soft" | "full" | "calibration";
  clearanceRec: number;
  reliefZones: string[];
  bendBehaviors: BendBehavior[];
  formingSpeed: string;
  warnings: string[];
}

// ─── STEP 4: Manufacturing Spec types ────────────────────────────────────────
export interface MfgOperation {
  opNumber: string;
  description: string;
  machine: string;
  tool: string;
  note: string;
}

export interface ManufacturingSpec {
  rollMaterial: string;
  rollHardness: string;
  surfaceTreatment: string;
  blankOD: number;
  blankWidth: number;
  boreSize: number;
  boreFit: string;
  keyway: { required: boolean; width: number; depth: number; length: number } | null;
  rollType: "solid" | "split";
  rollTypReason: string;
  spacerThickness: number;
  spacerMaterial: string;
  toleranceOD: string;
  toleranceFace: string;
  operations: MfgOperation[];
  machinabilityNotes: string[];
}

// ─── STEP 5 CAM Plan Types ────────────────────────────────────────────────────
export interface CamTool {
  toolId: string;
  toolNumber: string;
  offsetNumber: string;
  insertFamily: string;
  insertCode: string;
  holder: string;
  noseRadius: number;
  handOfCut: string;
  purpose: string;
  bestFor: string[];
  caution: string;
}

export interface CamOperation {
  opId: string;
  opType: string;
  description: string;
  toolId: string;
  insertFamily: string;
  rpmMode: "G96" | "G97";
  cuttingSpeedVc: number;
  rpmValue: number;
  maxRpm: number;
  feedPerRev: number;
  depthOfCut: number;
  stockToLeave: number;
  clearanceX: number;
  clearanceZ: number;
  coolantMode: "M08" | "M07" | "M09";
  gcodeHint: string;
  cautionText: string;
}

export interface CamSafetyPlan {
  maxSpindleRpm: number;
  safeRetractX: number;
  safeRetractZ: number;
  clearancePlaneX: number;
  clearancePlaneZ: number;
  chuckNote: string;
  tailstockNote: string;
  workOffsetNote: string;
  proveOutSteps: string[];
  inspectionChecklist: string[];
  defectsGuide: { defect: string; cause: string; fix: string }[];
}

export interface CamPlan {
  partClass: string;
  machine: string;
  controller: string;
  workOffset: string;
  z0Reference: string;
  x0Reference: string;
  tools: CamTool[];
  operations: CamOperation[];
  safetyPlan: CamSafetyPlan;
  speedFeedTable: { op: string; Vc: number; fn: number; DOC: number; RPM: number; note: string }[];
  cycleTimeEstimate: string;
  camNotes: string[];
  insertGrade: string;
  coolantMode: string;
}

export interface KeywaySpec {
  widthMm: number;
  heightMm: number;
  shaftDepthT1Mm: number;
  hubDepthT2Mm: number;
  standard: string;
  length: string;
}

export interface ShaftCalcResult {
  requiredDiaMm: number;
  selectedDiaMm: number;
  bendingMomentNm: number;
  torqueNm: number;
  combinedStressMpa: number;
  safetyFactor: number;
  deflectionMm: number;
  keyway?: KeywaySpec;
  toleranceFit?: { shaft: string; bore: string; interference: string };
  surfaceFinish?: { bearingSeat: string; keywaySurface: string; rollBody: string };
  recommendedMaterial?: string;
  locknuts?: string;
  stressConcentrationKf?: number;
  shaftYieldMpa?: number;
}

export interface BearingSpec {
  designation: string;
  boreMm: number;
  odMm: number;
  widthMm: number;
  C_kN: number;
  C0_kN: number;
  massKg: number;
}

export interface RollODCalcResult {
  upperOD: number;
  lowerOD: number;
  profileDepth: number;
  minWallThickness: number;
  formula: string;
}

export interface StandPitchResult {
  pitchMm: number;
  rollWidthMm: number;
  bearingWidthMm: number;
  locknuts: number;
  housingClearance: number;
  formula: string;
}

export type RollTypeCode = "GUIDE" | "BREAKDOWN" | "FORMING" | "GROOVE" | "FINPASS" | "SIZING" | "SIDE";

export interface RollTypeInfo {
  code: RollTypeCode;
  name: string;
  description: string;
  grooveShape: "flat" | "shallow-v" | "v-groove" | "u-groove" | "deep-groove" | "fin";
  grooveAngleDeg: number;
  grooveDepthFraction: number;
  filletRadiusMm: number;
  phase: "ENTRY" | "FORMING" | "CLOSING" | "SIZING";
  color: string;
}

export interface RollMaterialRec {
  toolSteel: string;
  hardnessHRC: string;
  surfaceTreatment: string;
  treatmentNote: string;
  alternativeMaterial: string;
  lubricantRecommended: string;
  lifeHrs: number;
}

export interface RollToolingResult {
  stationId: string;
  stationIndex: number;
  stationNumber: number;
  label: string;
  upperRollOD: number;
  upperRollID: number;
  upperRollWidth: number;
  lowerRollOD: number;
  lowerRollID: number;
  lowerRollWidth: number;
  rollGap: number;
  passLineHeight: number;
  kFactor: number;
  neutralAxis: number;
  deflection: number;
  concentricityTolerance: number;
  material?: string;
  description?: string;
  profileDepthMm?: number;
  shaftCalc?: ShaftCalcResult;
  bearing?: BearingSpec;
  rollODCalc?: RollODCalcResult;
  standPitch?: StandPitchResult;
  rollProfile?: RollProfile; // optional — present after tooling generation, absent on stale localStorage
  behavior?: RollBehavior;
  mfgSpec?: ManufacturingSpec;
  camPlan?: CamPlan;
  rollType?: RollTypeInfo;
  rollMaterial?: RollMaterialRec;
  // Runtime-populated by API response — may be present if backend fills them
  bendAngles?: number[];
}

// ─── Station Profile Status ────────────────────────────────────────────────────
// Describes how complete a station's data is at any point in the pipeline.
export type StationProfileStatus =
  | "VALID"                  // rollProfile present, has geometry points and G-code
  | "BASIC"                  // rollProfile present but synthesised from flat fields (no geometry/gcode)
  | "MISSING_PROFILE"        // rollProfile field absent — stale localStorage not yet migrated
  | "TOOLING_NOT_GENERATED"; // rollTooling array is empty (user hasn't clicked Generate yet)

export interface StationValidation {
  stationNumber: number;
  label: string;
  status: StationProfileStatus;
  reason: string;        // human-readable diagnostic
  migratedFromFlat: boolean;
}

/** Classify each station in the rollTooling array and return a validation report. */
export function validateStationProfiles(rollTooling: RollToolingResult[]): StationValidation[] {
  if (rollTooling.length === 0) {
    return []; // caller should check length and show TOOLING_NOT_GENERATED
  }
  return rollTooling.map((rt) => {
    const rp = rt.rollProfile as (RollProfile & { _migratedFromFlat?: boolean }) | undefined;
    const migratedFromFlat = !!(rp as unknown as Record<string, unknown>)?._migratedFromFlat;

    if (!rp) {
      return {
        stationNumber: rt.stationNumber,
        label: rt.label,
        status: "MISSING_PROFILE" as StationProfileStatus,
        reason: "rollProfile field absent — station loaded from stale localStorage before v5 migration",
        migratedFromFlat: false,
      };
    }
    const hasGeometry = Array.isArray(rp.upperRoll) && rp.upperRoll.length > 0;
    // C5 FIX: use MIN_GCODE_LENGTH constant (20) — was inconsistently hardcoded as 10 here
    const hasGcode    = typeof rp.upperLatheGcode === "string" && rp.upperLatheGcode.trim().length > MIN_GCODE_LENGTH;

    if (hasGeometry && hasGcode) {
      return {
        stationNumber: rt.stationNumber,
        label: rt.label,
        status: "VALID" as StationProfileStatus,
        reason: "rollProfile present with geometry points and G-code",
        migratedFromFlat,
      };
    }
    return {
      stationNumber: rt.stationNumber,
      label: rt.label,
      status: "BASIC" as StationProfileStatus,
      reason: `rollProfile synthesised from flat API fields — upperRoll.length=${rp.upperRoll?.length ?? 0}, gcode=${hasGcode ? "yes" : "empty"}. API server does not yet return roll groove geometry or CNC G-code.`,
      migratedFromFlat,
    };
  });
}

/**
 * repairOrSynthesizeRollProfile — ensures every RollToolingResult has
 * a complete RollProfile with real geometry (upperRoll, lowerRoll) and
 * real CNC G-code (upperLatheGcode, lowerLatheGcode).
 *
 * Called from:
 *   1. migrate() — repairs stale localStorage data on load
 *   2. setRollTooling() — ensures fresh API results are always fully populated
 *
 * A station is VALID only when both conditions are true:
 *   - upperRoll.length > 1 && lowerRoll.length > 1
 *   - upperLatheGcode.length > 20 && lowerLatheGcode.length > 20
 */
export function repairOrSynthesizeRollProfile(
  rt: RollToolingResult,
  thickness = 1.5,
): RollToolingResult {
  const existing = rt.rollProfile;
  const hasGeometry =
    Array.isArray(existing?.upperRoll) && existing.upperRoll.length > 1 &&
    Array.isArray(existing?.lowerRoll) && existing.lowerRoll.length > 1;
  const hasGcode =
    typeof existing?.upperLatheGcode === "string" && existing.upperLatheGcode.length > 20 &&
    typeof existing?.lowerLatheGcode === "string" && existing.lowerLatheGcode.length > 20;

  // Only short-circuit if ALL three are present: geometry, gcode, AND passLineY.
  // A rollProfile with passLineY === undefined (stale localStorage) must be re-synthesized.
  if (hasGeometry && hasGcode && existing?.passLineY != null && isFinite(existing.passLineY)) return rt;

  const upperOD  = rt.upperRollOD  ?? 100;
  const lowerOD  = rt.lowerRollOD  ?? upperOD;
  const gap      = rt.rollGap      ?? 1.0;
  const passLineY = rt.passLineHeight ?? (lowerOD / 2 + gap / 2);
  const shaftDia  = rt.shaftCalc?.selectedDiaMm ?? (rt.upperRollID ? rt.upperRollID - 2 : 40);
  const rollWidth = rt.upperRollWidth ?? 50;
  // Apply same floor as synthesizeGroove so stored grooveDepth matches actual geometry
  const grooveDepth = Math.max(rt.profileDepthMm ?? 0, thickness * 1.5, 2.0);
  const bendAngleDeg = rt.rollType?.grooveAngleDeg ?? 30;
  const stIdx    = rt.stationIndex ?? 1;
  const upperRollNumber = stIdx * 2 - 1;
  const lowerRollNumber = stIdx * 2;

  const geo = !hasGeometry
    ? buildStationRollProfile({
        rollWidth,
        grooveDepth,
        bendAngleDeg,
        thickness,
        upperRollOD: upperOD,
        lowerRollOD: lowerOD,
      })
    : { upperRoll: existing!.upperRoll, lowerRoll: existing!.lowerRoll };

  const gcodeParams = {
    rollDiameter:  upperOD,
    shaftDiameter: shaftDia,
    rollWidth,
    grooveDepth,
    bendAngleDeg,
    thickness,
    stationLabel: rt.label,
    stationIndex: stIdx,
  };

  const upperGcode = !hasGcode
    ? generateLatheGcode({ ...gcodeParams, rollNumber: upperRollNumber, side: "upper" })
    : existing!.upperLatheGcode;

  const lowerGcode = !hasGcode
    ? generateLatheGcode({
        ...gcodeParams,
        rollDiameter: lowerOD,
        rollNumber: lowerRollNumber,
        side: "lower",
      })
    : existing!.lowerLatheGcode;

  const kFactor          = rt.kFactor ?? 0.44;
  const neutralAxisOffset = rt.neutralAxis ?? 0;

  const repairedProfile: RollProfile = {
    ...(existing ?? {}),
    upperRoll: geo.upperRoll,
    lowerRoll: geo.lowerRoll,
    rollDiameter:      upperOD,
    shaftDiameter:     shaftDia,
    rollWidth,
    gap,
    passLineY,
    upperRollCenterY:  passLineY + gap / 2 + upperOD / 2,
    lowerRollCenterY:  passLineY - gap / 2 - lowerOD / 2,
    grooveDepth,
    upperRollNumber,
    lowerRollNumber,
    kFactor,
    neutralAxisOffset,
    upperLatheGcode:   upperGcode,
    lowerLatheGcode:   lowerGcode,
  };

  debugRollProfile({
    stationNumber:    rt.stationNumber,
    label:            rt.label,
    upperRollLength:  geo.upperRoll.length,
    lowerRollLength:  geo.lowerRoll.length,
    upperGcodeLength: upperGcode.length,
    lowerGcodeLength: lowerGcode.length,
  });

  return { ...rt, rollProfile: repairedProfile };
}

// ─── Machine Data (forming parameters summary) ────────────────────────────────
export interface StationMachineSetup {
  stationNumber: number;
  label: string;
  phase: "ENTRY" | "MAIN" | "FINAL";
  formingSpeed: string;
  rollGapNominal: number;
  clearanceRec: number;
  upperRollOD: number;
  lowerRollOD: number;
  bore: number;
  width: number;
  boreClearanceOk: boolean;
  cncVcRec: number;
  cncFeedRec: number;
  cncDocRec: number;
  insertGrade: string;
  insertGeometry: string;
}

export interface ShaftDeflection {
  estimatedMm: number;
  isSafe: boolean;
  limit: string;
  formingForceN: number;
  shaftSpanMm: number;
  note: string;
}

export interface CncCuttingParams {
  vcRoughing: number;
  vcFinishing: number;
  frRoughing: number;
  frFinishing: number;
  docRoughing: number;
  docSemiFinish: number;
  docFinish: number;
}

export interface MotorCalcResult {
  deformationPowerKw: number;
  frictionPowerKw: number;
  shaftPowerKw: number;
  totalRequiredKw: number;
  selectedMotorKw: number;
  motorFrame: string;
  motorRpm: number;
  motorTorqueNm: number;
  driveEfficiency: number;
  serviceFactor: number;
  gearboxRatioRequired: number;
  recommendedGearboxRatio: number;
  outputShaftRpm: number;
  lineSpeedTargetMpm: number;
  lineSpeedActualMpm: number;
  rollCircumferenceMm: number;
  vfdRecommended: boolean;
  powerDensityKwPerStation: number;
  warnings: string[];
}

export interface MachineData {
  materialType: string;
  materialThickness: number;
  springbackFactor: number;
  springbackCompensation: string;
  lubrication: string;
  surfaceRisk: string;
  formingSpeeds: { entry: string; main: string; final: string };
  passLine: number;
  shaftDiameter: number;
  rollDiameter: number;
  totalStations: number;
  totalRolls: number;
  stationSetup: StationMachineSetup[];
  insertGrade: string;
  insertGeometry: string;
  coolantMode: string;
  cncCuttingParams: CncCuttingParams;
  shaftDeflection: ShaftDeflection;
  sideCollar: SideCollar | null;
  overallWarnings: string[];
}

// ─── BOM types ────────────────────────────────────────────────────────────────
export interface BomItem {
  itemNo: number;
  description: string;
  partNumber: string;
  material: string;
  qty: number;
  unit: string;
  dimensions: string;
  weightKg: number;
  category: string;
  notes: string;
}

export interface BomResult {
  items: BomItem[];
  totalRolls: number;
  totalWeightKg: number;
  rollMaterial: string;
  shaftMaterial: string;
  summary: { category: string; qty: number; weightKg: number }[];
}

export type ControllerType = "fanuc" | "siemens_840d" | "haas" | "mitsubishi_m70" | "generic";
export type OperationType = "roughing" | "semi_finishing" | "finishing" | "grooving";

export interface GcodeConfig {
  feedRate: number;
  feedUnit: "mm_rev" | "mm_min";
  spindleSpeed: number;
  spindleMode: "css" | "rpm";
  maxSpindleSpeed: number;
  spindleDirection: "M3" | "M4";
  tools: LatheToolConfig[];
  workOffset: string;
  safeZ: number;
  safeX: number;
  cutDepth: number;
  coordinateFormat: "absolute" | "incremental";
  decimalPrecision: number;
  coolant: boolean;
  xDiameterMode: boolean;
  programNumber: number;
  useG28: boolean;
  customHeader?: string[];
  customFooter?: string[];
  arcFormat?: "R" | "IK" | "IJK";
  endOfBlockChar?: string;
  safetyBlock?: string;
  toolFormat?: string;
  lineNumberFormat?: string;
  programNumberFormat?: string;
  toolChangeSequence?: string[];
  arcChordError?: number;
  arcSubSegments?: number;
  verifyNoseRadiusComp?: boolean;
  controllerType?: ControllerType;
  materialType?: string;
  operationType?: OperationType;
  enableFeedRamping?: boolean;
  feedRampAngleThreshold?: number;
  feedRampFactor?: number;
  enableDwellInsertion?: boolean;
  dwellTime?: number;
  enableRestMachining?: boolean;
  roughingStockAllowance?: number;
  enableGrooveCycle?: boolean;
  grooveDepth?: number;
  grooveWidth?: number;
  groovePeckDepth?: number;
  enableG71Cycle?: boolean;
  g71DepthOfCut?: number;
  g71RetractAmount?: number;
  enableToolpathOptimization?: boolean;
  rapidTraverseRate?: number;
  accelerationRate?: number;
  maxAcceleration?: number;
  exactStopMode?: "G61" | "G64" | "auto";
  toolChangeTime?: number;
  workpieceDiameter?: number;
}

export type MaterialType = "GI" | "CR" | "HR" | "SS" | "AL" | "MS" | "CU" | "TI" | "PP" | "HSLA";

export interface MaterialProperties {
  name: string;
  springbackFactor: number;
  minBendRadiusMultiplier: number;
  crackingRisk: "low" | "medium" | "high";
  yieldStrength: number;
  tensileStrength: number;
  maxFormingSpeed: string;
  notes: string;
  minThickness: number;
  maxThickness: number;
}

export const MATERIAL_DATABASE: Record<MaterialType, MaterialProperties> = {
  GI: {
    name: "Galvanized Iron (GI)",
    springbackFactor: 1.05,
    minBendRadiusMultiplier: 1.0,
    crackingRisk: "low",
    yieldStrength: 280,   // FIX: 250→280 MPa (IS 277 Z275)
    tensileStrength: 380, // FIX: 350→380 MPa
    maxFormingSpeed: "30 m/min",
    notes: "Standard shutter/roofing material. Good formability. Zinc coating may flake at tight bends. At 3mm+ use larger roll OD.",
    minThickness: 0.3,
    maxThickness: 3.5,
  },
  CR: {
    name: "Cold Rolled Steel (CR)",
    springbackFactor: 1.08,
    minBendRadiusMultiplier: 0.5,
    crackingRisk: "low",
    yieldStrength: 340,   // FIX: 280→340 MPa (IS 513 CR4)
    tensileStrength: 440, // FIX: 400→440 MPa
    maxFormingSpeed: "40 m/min",
    notes: "Excellent surface finish. Good for false ceiling channels. Low springback compared to HR. Above 3mm: calibration stand recommended.",
    minThickness: 0.3,
    maxThickness: 3.5,
  },
  HR: {
    name: "Hot Rolled Steel (HR)",
    springbackFactor: 1.12,
    minBendRadiusMultiplier: 1.5,
    crackingRisk: "medium",
    yieldStrength: 250,
    tensileStrength: 420,
    maxFormingSpeed: "25 m/min",
    notes: "Higher springback. Requires calibration stand. Not suitable for tight bend radii. Heavy gauge: descale before forming.",
    minThickness: 1.2,
    maxThickness: 8.0,
  },
  SS: {
    name: "Stainless Steel (SS)",
    springbackFactor: 1.20,
    minBendRadiusMultiplier: 2.0,
    crackingRisk: "high",
    yieldStrength: 310,
    tensileStrength: 620,
    maxFormingSpeed: "15 m/min",
    notes: "Very high springback. Needs significant over-forming. Work hardening can cause cracking. Slow line speed required. At 3mm+: split roll mandatory.",
    minThickness: 0.5,
    maxThickness: 6.0,
  },
  AL: {
    name: "Aluminium (AL)",
    springbackFactor: 1.15,
    minBendRadiusMultiplier: 1.0,
    crackingRisk: "medium",
    yieldStrength: 270,   // FIX: 130→270 MPa (6061-T4; was Al1050 annealed value)
    tensileStrength: 310, // FIX: 220→310 MPa
    maxFormingSpeed: "20 m/min",
    notes: "Soft material but springback is significant. Low forming forces needed. Watch for surface scratches. Typical grades: 3003, 5052.",
    minThickness: 0.5,
    maxThickness: 6.0,
  },
  MS: {
    name: "Mild Steel (MS)",
    springbackFactor: 1.06,
    minBendRadiusMultiplier: 0.8,
    crackingRisk: "low",
    yieldStrength: 250,
    tensileStrength: 410,
    maxFormingSpeed: "35 m/min",
    notes: "Most common roll forming material. Predictable behavior. Good for general purpose profiles. At 6mm: heavy-duty roll OD 200+ recommended.",
    minThickness: 0.8,
    maxThickness: 8.0,
  },
  CU: {
    name: "Copper (CU)",
    springbackFactor: 1.08,
    minBendRadiusMultiplier: 0.5,
    crackingRisk: "low",
    yieldStrength: 200,   // FIX: 70→200 MPa (C110 H02 half-hard roll forming grade; 70 is dead-soft/annealed)
    tensileStrength: 300, // FIX: 220→300 MPa
    maxFormingSpeed: "25 m/min",
    notes: "Very soft, excellent formability. Low springback. Surface scratching risk — use polished rolls. Common grades: C11000, C12200.",
    minThickness: 0.3,
    maxThickness: 4.0,
  },
  TI: {
    name: "Titanium (TI)",
    springbackFactor: 1.25,
    minBendRadiusMultiplier: 3.0,
    crackingRisk: "high",
    yieldStrength: 880,
    tensileStrength: 950,
    maxFormingSpeed: "8 m/min",
    notes: "CRITICAL: Very high springback, reactive at high temp. Slow speed, flood coolant. Grades: Ti-6Al-4V, CP Grade 2. Large bend radii required.",
    minThickness: 0.5,
    maxThickness: 4.0,
  },
  PP: {
    name: "Pre-Painted Steel (PP)",
    springbackFactor: 1.06,
    minBendRadiusMultiplier: 1.5,
    crackingRisk: "medium",
    yieldStrength: 280,   // FIX: 250→280 MPa (Pre-Painted = GI substrate IS 277 Z275)
    tensileStrength: 370,
    maxFormingSpeed: "20 m/min",
    notes: "Coating protection critical — no sharp edges, large radii, protective film during forming. Common for roofing/cladding.",
    minThickness: 0.3,
    maxThickness: 1.2,
  },
  HSLA: {
    name: "High-Strength Low-Alloy (HSLA)",
    springbackFactor: 1.14,
    minBendRadiusMultiplier: 2.0,
    crackingRisk: "medium",
    yieldStrength: 550,   // FIX: 450→550 MPa (HSLA 550 per IS 8500/EN 10025-4 S550)
    tensileStrength: 650, // FIX: 550→650 MPa
    maxFormingSpeed: "18 m/min",
    notes: "High strength requires more forming force and stations. Significant springback. Grades: S355, S420, S460. Calibration stands essential.",
    minThickness: 1.0,
    maxThickness: 8.0,
  },
};

export function getKeywaySizeForShaft(shaftDia: number): { width: number; height: number } {
  if (shaftDia <= 22) return { width: 6, height: 6 };
  if (shaftDia <= 30) return { width: 8, height: 7 };
  if (shaftDia <= 38) return { width: 10, height: 8 };
  if (shaftDia <= 44) return { width: 12, height: 8 };
  if (shaftDia <= 50) return { width: 14, height: 9 };
  if (shaftDia <= 58) return { width: 16, height: 10 };
  if (shaftDia <= 65) return { width: 18, height: 11 };
  if (shaftDia <= 75) return { width: 20, height: 12 };
  return { width: 22, height: 14 };
}

export type AppTab = "wizard" | "setup" | "flower" | "roll" | "gcode" | "troubleshoot" | "twin" | "factory" | "ultra" | "studio3d" | "turner" | "manual-drawing" | "load-calc" | "report" | "ai-chatbots" | "forming-sim" | "springback" | "strip-width" | "roll-gap" | "cost-estimator" | "camber" | "material-db" | "forming-energy" | "specs" | "rf-tubes" | "rf-trapeze" | "smart-rolls" | "rf-dtm" | "rf-spreadsheet" | "drawing-dies" | "cage-forming" | "wire-rolling" | "profile-scan" | "roll-scanner" | "roll-lifecycle" | "cad-finder" | "downhill-forming" | "assembly-check" | "tool-library" | "geometry-edit" | "cam-operations" | "milling-operations" | "offline-ai" | "5axis-cam" | "formaxis-compare" | "rf-closed-section" | "sheet-metal" | "validation-pipeline" | "machine-bom" | "flower-3d" | "roll-export" | "admin-dashboard" | "master-designer" | "dimension-confirm" | "system-setup" | "desktop-install" | "real-mukabla" | "fea-simulation" | "gcode-verify" | "advanced-cam" | "erp-integration" | "dxf-import" | "gcode-simulator" | "roll-flower-designer" | "material-analyzer" | "auto-backup" | "demo-c-channel" | "station-control" | "testing-engine" | "rf-machine" | "pro-lathe-sim" | "roll-tooling-calc" | "roll-tooling-drawing" | "roll-blank-size" | "roll-cutting-safety" | "roll-tool-collision" | "solidcam-tooldb" | "drawing-vision" | "safety-panel" | "roll-design-suite" | "roll-knowledge-hub" | "auto-profile-converter" | "auto-cnc-planner" | "github-update" | "flower-combined" | "autocad-engineering-drawing" | "machine-load-calc" | "roll-data-files" | "buddy-crm" | "demo-videos" | "roll-forming-sim" | "hardware-dashboard" | "laptop-hardware" | "thickness-range" | "geometry-recognition" | "pass-angle-engine" | "formula-calculator" | "design-rule-engine" | "defect-prediction" | "machine-fitment";

// ─── Open Section Profile Types ───────────────────────────────────────────────
export type OpenSectionType =
  | "Auto"
  | "C-Section"
  | "U-Section"
  | "Z-Section"
  | "L-Angle"
  | "Hat/Omega"
  | "Angle"
  | "Pop/Embossed"
  | "Custom";

export const OPEN_SECTION_OPTIONS: { value: OpenSectionType; label: string; icon: string; desc: string }[] = [
  { value: "Auto",        label: "Auto Detect",  icon: "⚡", desc: "Automatically detect profile type from DXF geometry" },
  { value: "C-Section",   label: "C-Section",   icon: "C",  desc: "Open C profile — shutter, purlin, stud" },
  { value: "U-Section",   label: "U-Section",   icon: "U",  desc: "Open U channel — track, guide rail" },
  { value: "Z-Section",   label: "Z-Section",   icon: "Z",  desc: "Z purlin — roof, floor, secondary steel" },
  { value: "L-Angle",     label: "L-Angle",     icon: "L",  desc: "Single angle, corner trim" },
  { value: "Hat/Omega",   label: "Hat/Omega",   icon: "⌢",  desc: "Hat / Omega profile — framing, furring" },
  { value: "Angle",       label: "Angle",       icon: "∠",  desc: "Equal / unequal angle section" },
  { value: "Pop/Embossed", label: "Pop Profile", icon: "▲", desc: "Raised embossed panel — high bend angle 90–120°" },
  { value: "Custom",      label: "Custom",      icon: "✦",  desc: "Custom / non-standard open section" },
];

export function autoDetectProfileType(geometry: ProfileGeometry): OpenSectionType {
  const bends = Array.isArray(geometry.bendPoints) ? geometry.bendPoints : [];
  const bendCount = bends.length;
  const angles = bends.map(b => Math.abs(b.angle));
  const hasHighAngle = angles.some(a => a >= 85 && a <= 130);
  const allNear90 = angles.every(a => a >= 75 && a <= 105);

  if (bendCount === 0) return "Custom";

  if (bendCount === 1) {
    return "L-Angle";
  }

  if (bendCount === 2) {
    if (allNear90) {
      const seg = geometry.segments;
      if (seg.length >= 3) {
        const firstLen = Math.hypot(seg[0].endX - seg[0].startX, seg[0].endY - seg[0].startY);
        const lastLen = Math.hypot(seg[seg.length-1].endX - seg[seg.length-1].startX, seg[seg.length-1].endY - seg[seg.length-1].startY);
        const ratio = Math.min(firstLen, lastLen) / Math.max(firstLen, lastLen);
        if (ratio > 0.7) return "U-Section";
        return "Angle";
      }
      return "U-Section";
    }
    if (angles.some(a => a >= 85 && a <= 130)) return "Pop/Embossed";
    return "Angle";
  }

  if (bendCount >= 3 && bendCount <= 5) {
    if (allNear90 && bendCount === 4) {
      const directions = bends.map(b => b.angle > 0 ? 1 : -1);
      const sameDir = directions.every(d => d === directions[0]);
      if (!sameDir) return "Z-Section";
      return "C-Section";
    }
    if (allNear90 && bendCount === 3) return "C-Section";
    if (bendCount >= 4 && hasHighAngle) return "Hat/Omega";
    return "C-Section";
  }

  if (bendCount >= 6) {
    if (hasHighAngle) return "Hat/Omega";
    return "Custom";
  }

  return "Custom";
}

// ─── Accuracy Monitoring Types ────────────────────────────────────────────────

export interface AccuracySubScore {
  dimension: string;
  score: number;
  weight?: number;
  value?: string | number;
  warning?: string;
  tips?: string[];
}

export interface AccuracyEntry {
  id: string;
  taskType: "flower" | "tooling" | "gcode" | "ai-diagnosis" | "design-score";
  taskLabel: string;
  overallScore: number;
  subScores: AccuracySubScore[];
  warnings: string[];
  timestamp: string;
}

export interface DesignScoreSubScore extends AccuracySubScore {
  weight?: number;
  tips?: string[];
}

export interface DesignScore {
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  subScores: DesignScoreSubScore[];
  warnings: string[];
  improvementTips: string[];
  timestamp: string;
  isLoading: boolean;
}

interface CncState {
  activeTab: AppTab;

  profileName: string;
  profileMetadata: GuardrailProfileMetadata | null;
  materialType: MaterialType;
  lineSpeed: number;
  arborLength: number;
  spacerLimit: number;
  openSectionType: OpenSectionType;
  motorRPM: number;
  motorPower: number;
  surfaceFinish: string;
  kFactor: number | null;

  fileName: string | null;
  geometry: ProfileGeometry | null;
  numStations: number;
  stationPrefix: string;
  materialThickness: number;
  minThickness: number;
  maxThickness: number;
  bendRadius: number;
  bendAllowanceMethod: "inside_radius" | "neutral_axis";

  stations: StationProfile[];
  selectedStation: number | null;

  gcodeOutputs: GcodeOutput[];
  gcodeConfig: GcodeConfig;

  rollTooling: RollToolingResult[];
  rollGaps: RollGapInfo[];
  machineData: MachineData | null;
  motorCalc: MotorCalcResult | null;
  bomResult: BomResult | null;
  rollDiameter: number;
  shaftDiameter: number;
  clearance: number;
  postProcessorId: string;

  machineProfile: MachineProfile | null;
  referenceFileName: string | null;

  isLoading: boolean;
  error: string | null;

  isThicknessValid: boolean;

  accuracyLog: AccuracyEntry[];
  accuracyThreshold: number;

  sectionModel: "open" | "closed" | null;
  setSectionModel: (m: "open" | "closed" | null) => void;

  profileSourceType: "centerline" | "inner_face" | "outer_face" | "sheet_profile" | null;
  setProfileSourceType: (t: "centerline" | "inner_face" | "outer_face" | "sheet_profile" | null) => void;
  profileSourceConfidence: number;           // 0–1 auto-detect confidence
  setProfileSourceConfidence: (c: number) => void;

  // ── Thickness band (user job-specific, separate from material database range) ──
  thicknessBandMin: number;                  // min tolerance of actual sheet (e.g. 0.75)
  thicknessBandMax: number;                  // max tolerance of actual sheet (e.g. 0.85)
  setThicknessBandMin: (t: number) => void;
  setThicknessBandMax: (t: number) => void;

  flowerGenerateTrigger: number;
  requestFlowerGeneration: () => void;

  leftPanelScrollTarget: string | null;
  setLeftPanelScrollTarget: (t: string | null) => void;

  dxfDimensions: DxfDimension[];
  setDxfDimensions: (dims: DxfDimension[]) => void;
  confirmedDimensions: (DxfDimension & { confirmed: boolean; override?: number })[];
  setConfirmedDimensions: (dims: (DxfDimension & { confirmed: boolean; override?: number })[]) => void;

  validationResults: { layerId: number; score: number; status: "idle" | "running" | "pass" | "fail" }[];
  setValidationResults: (results: { layerId: number; score: number; status: "idle" | "running" | "pass" | "fail" }[]) => void;
  validationApproved: boolean;
  setValidationApproved: (v: boolean) => void;

  designScore: DesignScore | null;
  setDesignScore: (ds: DesignScore | null) => void;
  setDesignScoreLoading: (loading: boolean) => void;

  aiPipelineResults: {
    flowerAdvice: Record<string, unknown> | null;
    designAnalysis: Record<string, unknown> | null;
    toolRecommendation: Record<string, unknown> | null;
    gcodeOptimization: Record<string, unknown> | null;
    modes: { flowerAdvice?: string; designAnalysis?: string; toolRecommendation?: string; gcodeOptimization?: string };
  };
  setAiPipelineResults: (results: Partial<CncState["aiPipelineResults"]>) => void;

  setActiveTab: (tab: AppTab) => void;
  setProfileName: (name: string) => void;
  setProfileMetadata: (meta: GuardrailProfileMetadata | null) => void;
  setMaterialType: (m: MaterialType) => void;
  setLineSpeed: (s: number) => void;
  setArborLength: (l: number) => void;
  setSpacerLimit: (l: number) => void;
  setOpenSectionType: (t: OpenSectionType) => void;
  setMotorRPM: (r: number) => void;
  setMotorPower: (p: number) => void;
  setSurfaceFinish: (s: string) => void;
  setKFactor: (k: number | null) => void;
  applyShutterPreset: () => void;
  applyPopAnglePreset: () => void;

  setFileName: (name: string | null) => void;
  setGeometry: (geo: ProfileGeometry | null) => void;
  setNumStations: (n: number) => void;
  setStationPrefix: (p: string) => void;
  setMaterialThickness: (t: number) => void;
  setMinThickness: (t: number) => void;
  setMaxThickness: (t: number) => void;
  setBendAllowanceMethod: (m: "inside_radius" | "neutral_axis") => void;
  setStations: (s: StationProfile[]) => void;
  setSelectedStation: (n: number | null) => void;
  setGcodeOutputs: (o: GcodeOutput[]) => void;
  setGcodeConfig: (c: Partial<GcodeConfig>) => void;
  updateTool: (index: number, t: Partial<LatheToolConfig>) => void;
  addTool: () => void;
  removeTool: (index: number) => void;
  setRollTooling: (r: RollToolingResult[]) => void;
  setRollGaps: (g: RollGapInfo[]) => void;
  setMachineData: (m: MachineData | null) => void;
  setMotorCalc: (m: MotorCalcResult | null) => void;
  setBomResult: (b: BomResult | null) => void;
  setPostProcessorId: (id: string) => void;
  setRollDiameter: (d: number) => void;
  setShaftDiameter: (d: number) => void;
  setClearance: (c: number) => void;
  setMachineProfile: (p: MachineProfile | null) => void;
  setReferenceFileName: (name: string | null) => void;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;

  addAccuracyEntry: (entry: Omit<AccuracyEntry, "id">) => void;
  clearAccuracyLog: () => void;
  setAccuracyThreshold: (t: number) => void;
}

const defaultTool: LatheToolConfig = {
  toolNumber: 2,
  offsetNumber: 2,
  position: "right",
  insertType: "CNMG",
  noseRadius: 0.8,
  compensation: "G40",
};

const defaultConfig: GcodeConfig = {
  feedRate: 0.102,
  feedUnit: "mm_rev",
  spindleSpeed: 200,
  spindleMode: "css",
  maxSpindleSpeed: 500,
  spindleDirection: "M4",
  tools: [{ ...defaultTool }],
  workOffset: "G90",
  safeZ: 50,
  safeX: 135,
  cutDepth: 2.0,
  coordinateFormat: "absolute",
  decimalPrecision: 3,
  coolant: false,
  xDiameterMode: true,
  programNumber: 5000,
  useG28: true,
};

export const useCncStore = create<CncState>()(persist((set) => ({
  activeTab: "setup",

  profileName: "",
  profileMetadata: null,
  materialType: "GI",
  lineSpeed: 20,
  arborLength: 300,
  spacerLimit: 50,
  openSectionType: "C-Section" as OpenSectionType,
  motorRPM: 1440,
  motorPower: 15,
  surfaceFinish: "",
  kFactor: null,

  fileName: null,
  geometry: null,
  numStations: 5,
  stationPrefix: "S",
  materialThickness: 1.0,
  minThickness: 0.9,
  maxThickness: 1.1,
  bendRadius: 1.5,
  bendAllowanceMethod: "inside_radius",
  stations: [],
  selectedStation: null,
  gcodeOutputs: [],
  gcodeConfig: { ...defaultConfig },
  rollTooling: [],
  rollGaps: [],
  machineData: null,
  motorCalc: null,
  bomResult: null,
  rollDiameter: 150,
  shaftDiameter: 40,
  clearance: 0.05,
  postProcessorId: "delta_2x",
  machineProfile: null,
  referenceFileName: null,
  isLoading: false,
  error: null,

  isThicknessValid: true,

  accuracyLog: [],
  accuracyThreshold: 80,

  sectionModel: null,
  setSectionModel: (m) => set({ sectionModel: m }),

  profileSourceType: null,
  setProfileSourceType: (t) => set({ profileSourceType: t }),
  profileSourceConfidence: 0,
  setProfileSourceConfidence: (c) => set({ profileSourceConfidence: c }),

  thicknessBandMin: 0.9,
  thicknessBandMax: 1.1,
  setThicknessBandMin: (t) => set({ thicknessBandMin: Math.max(0.1, t) }),
  setThicknessBandMax: (t) => set({ thicknessBandMax: Math.max(0.1, t) }),

  flowerGenerateTrigger: 0,
  requestFlowerGeneration: () => set((s) => ({ flowerGenerateTrigger: s.flowerGenerateTrigger + 1 })),

  leftPanelScrollTarget: null,
  setLeftPanelScrollTarget: (t) => set({ leftPanelScrollTarget: t }),

  dxfDimensions: [],
  setDxfDimensions: (dims) => set({ dxfDimensions: dims }),
  confirmedDimensions: [],
  setConfirmedDimensions: (dims) => set({ confirmedDimensions: dims }),

  validationResults: [],
  setValidationResults: (results) => set({ validationResults: results }),
  validationApproved: false,
  setValidationApproved: (v) => set({ validationApproved: v }),

  designScore: null,
  setDesignScore: (ds) => set({ designScore: ds }),
  setDesignScoreLoading: (loading) =>
    set((state) => ({
      designScore: state.designScore
        ? { ...state.designScore, isLoading: loading }
        : loading
          ? { overallScore: -1, grade: "F" as const, subScores: [], warnings: [], improvementTips: [], timestamp: new Date().toISOString(), isLoading: true }
          : null,
    })),

  aiPipelineResults: {
    flowerAdvice: null,
    designAnalysis: null,
    toolRecommendation: null,
    gcodeOptimization: null,
    modes: {},
  },
  setAiPipelineResults: (results) =>
    set((state) => ({
      aiPipelineResults: { ...state.aiPipelineResults, ...results },
    })),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setProfileName: (name) => set({ profileName: name }),
  setProfileMetadata: (meta) => set({ profileMetadata: meta }),
  setMaterialType: (m) => set((state) => {
    const mat = MATERIAL_DATABASE[m];
    const isThicknessValid = state.materialThickness >= mat.minThickness && state.materialThickness <= mat.maxThickness;
    return { materialType: m, isThicknessValid };
  }),
  setLineSpeed: (s) => set({ lineSpeed: s }),
  setArborLength: (l) => set({ arborLength: l }),
  setSpacerLimit: (l) => set({ spacerLimit: l }),
  setOpenSectionType: (openSectionType) => set({ openSectionType }),
  setMotorRPM: (r) => set({ motorRPM: r }),
  setMotorPower: (p) => set({ motorPower: p }),
  setSurfaceFinish: (s) => set({ surfaceFinish: s }),
  setKFactor: (k) => set({ kFactor: k }),

  // Shutter Plant Preset: GI 2mm, C-Section, rollDia 150, shaftDia 40, 14 stations, 30 m/min
  applyShutterPreset: () => set({
    materialType: "GI" as MaterialType,
    materialThickness: 2.0,
    openSectionType: "C-Section" as OpenSectionType,
    rollDiameter: 150,
    shaftDiameter: 40,
    lineSpeed: 30,
    numStations: 14,
    stationPrefix: "SH",
    profileName: "Shutter Plant — GI C-Section 2mm",
    bendAllowanceMethod: "neutral_axis" as const,
    clearance: 0.2,
    isThicknessValid: true,
  }),

  // Pop/Angle Preset: MS 2mm, Pop/Embossed, 120° overbend, higher springback
  applyPopAnglePreset: () => set({
    materialType: "MS" as MaterialType,
    materialThickness: 2.0,
    openSectionType: "Pop/Embossed" as OpenSectionType,
    rollDiameter: 160,
    shaftDiameter: 40,
    lineSpeed: 20,
    numStations: 18,
    stationPrefix: "PO",
    profileName: "Pop/Angle Profile — MS 2mm",
    bendAllowanceMethod: "neutral_axis" as const,
    clearance: 0.2,
    isThicknessValid: true,
  }),

  setFileName: (name) => set({ fileName: name }),
  setGeometry: (geo) => set({ geometry: geo }),
  setNumStations: (n) => set({ numStations: Math.max(1, Math.min(30, n)) }),
  setStationPrefix: (p) => set({ stationPrefix: p }),
  setMaterialThickness: (t) => set((state) => {
    const mat = MATERIAL_DATABASE[state.materialType];
    const isThicknessValid = t >= mat.minThickness && t <= mat.maxThickness;
    return {
      materialThickness: t,
      isThicknessValid,
      minThickness: parseFloat((t * 0.9).toFixed(2)),
      maxThickness: parseFloat((t * 1.1).toFixed(2)),
    };
  }),
  setMinThickness: (t) => set({ minThickness: Math.max(0.1, t) }),
  setMaxThickness: (t) => set({ maxThickness: Math.max(0.1, t) }),
  setBendAllowanceMethod: (m) => set({ bendAllowanceMethod: m }),
  setStations: (s) => set({ stations: s }),
  setSelectedStation: (n) => set({ selectedStation: n }),
  setGcodeOutputs: (o) => set({ gcodeOutputs: o }),
  setRollTooling: (r) => set((state) => {
    const thickness = state.materialThickness ?? 1.5;
    const repaired = r.map(rt => repairOrSynthesizeRollProfile(rt, thickness));
    return { rollTooling: repaired };
  }),
  setRollGaps: (g) => set({ rollGaps: g }),
  setMachineData: (m) => set({ machineData: m }),
  setMotorCalc: (m) => set({ motorCalc: m }),
  setBomResult: (b) => set({ bomResult: b }),
  setPostProcessorId: (id) => set({ postProcessorId: id }),
  setRollDiameter: (d) => set({ rollDiameter: d }),
  setShaftDiameter: (d) => set({ shaftDiameter: d }),
  setClearance: (c) => set({ clearance: c }),
  setGcodeConfig: (c) =>
    set((state) => ({ gcodeConfig: { ...state.gcodeConfig, ...c } })),
  updateTool: (index, t) =>
    set((state) => {
      const tools = [...state.gcodeConfig.tools];
      if (tools[index]) {
        tools[index] = { ...tools[index], ...t };
      }
      return { gcodeConfig: { ...state.gcodeConfig, tools } };
    }),
  addTool: () =>
    set((state) => {
      const nextNum = state.gcodeConfig.tools.length + 1;
      return {
        gcodeConfig: {
          ...state.gcodeConfig,
          tools: [
            ...state.gcodeConfig.tools,
            { ...defaultTool, toolNumber: nextNum, offsetNumber: nextNum },
          ],
        },
      };
    }),
  removeTool: (index) =>
    set((state) => {
      const tools = state.gcodeConfig.tools.filter((_, i) => i !== index);
      return { gcodeConfig: { ...state.gcodeConfig, tools: tools.length > 0 ? tools : [{ ...defaultTool }] } };
    }),
  setMachineProfile: (p) => set({ machineProfile: p }),
  setReferenceFileName: (name) => set({ referenceFileName: name }),
  setLoading: (l) => set({ isLoading: l }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      fileName: null,
      geometry: null,
      profileMetadata: null,
      stations: [],
      selectedStation: null,
      gcodeOutputs: [],
      rollTooling: [],
      rollGaps: [],
      machineData: null,
      motorCalc: null,
      bomResult: null,
      postProcessorId: "delta_2x",
      machineProfile: null,
      referenceFileName: null,
      error: null,
      // Reset section model so user must re-select at start of every new workflow
      sectionModel: null,
      profileSourceType: null,
      profileSourceConfidence: 0,
      thicknessBandMin: 0.9,
      thicknessBandMax: 1.1,
      flowerGenerateTrigger: 0,
      leftPanelScrollTarget: null,
      // Reset validation and dimension confirmation state for new workflow
      validationResults: [],
      validationApproved: false,
      confirmedDimensions: [],
      dxfDimensions: [],
    }),

  addAccuracyEntry: (entry) =>
    set((state) => ({
      accuracyLog: [
        ...state.accuracyLog,
        { ...entry, id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      ].slice(-50),
    })),
  clearAccuracyLog: () => set({ accuracyLog: [] }),
  setAccuracyThreshold: (t) => set({ accuracyThreshold: t }),
}), {
  name: "sai-rolotech-smart-enginesai-cnc-v3",
  storage: createJSONStorage(() => localStorage),
  version: 5,
  migrate: (persistedState: unknown, fromVersion: number) => {
    const s = (persistedState ?? {}) as Record<string, unknown>;
    if (fromVersion < 4) {
      const geo = s.geometry as Record<string, unknown> | null | undefined;
      if (geo && typeof geo === "object") {
        const rawSegs: unknown[] = Array.isArray(geo.segments) ? geo.segments : [];
        geo.segments = rawSegs.map((seg: unknown) => {
          const sg = seg as Record<string, unknown>;
          return {
            ...sg,
            startX: sg.startX ?? sg.x1 ?? 0,
            startY: sg.startY ?? sg.y1 ?? 0,
            endX:   sg.endX   ?? sg.x2 ?? 0,
            endY:   sg.endY   ?? sg.y2 ?? 0,
          };
        });
        const rawBends: unknown[] = Array.isArray(geo.bendPoints)
          ? geo.bendPoints
          : Array.isArray((geo as Record<string, unknown>).bends)
          ? (geo as Record<string, unknown>).bends as unknown[]
          : [];
        geo.bendPoints = rawBends.map((b: unknown, idx: number) => {
          const bp = b as Record<string, unknown>;
          return { angle: 0, radius: 2, segmentIndex: idx, ...bp };
        });
      }
      const rawStations: unknown[] = Array.isArray(s.stations) ? s.stations : [];
      s.stations = rawStations.map((st: unknown) => {
        const station = st as Record<string, unknown>;
        return {
          ...station,
          bendAngles: Array.isArray(station.bendAngles) ? station.bendAngles : [],
          segmentLengths: Array.isArray(station.segmentLengths) ? station.segmentLengths : [],
          springbackAngles: Array.isArray(station.springbackAngles) ? station.springbackAngles : [],
          totalAngle: station.totalAngle ?? 0,
        };
      });
      s.accuracyLog = Array.isArray(s.accuracyLog) ? s.accuracyLog : [];
    }

    // v5 migration: repair rollTooling items that are missing the rollProfile sub-object.
    // Root cause: the API server (roll-tooling.ts) returns flat fields only (no rollProfile).
    // LeftPanel.tsx synthesises rollProfile on every fresh generation, but stale localStorage
    // data (saved before the synthesis was added, or from an older schema) loads without it.
    // This migration applies the same synthesis so every page load is safe regardless of age.
    if (fromVersion < 5) {
      const rawRt: unknown[] = Array.isArray(s.rollTooling) ? s.rollTooling : [];
      const thickness: number = (s as Record<string, unknown>).materialThickness as number ?? 1.5;
      s.rollTooling = rawRt.map((item: unknown) => {
        const rt = item as RollToolingResult;
        return repairOrSynthesizeRollProfile(rt, thickness);
      });
    }

    return s;
  },
  partialize: (state) => ({
    activeTab: state.activeTab,
    profileName: state.profileName,
    materialType: state.materialType,
    lineSpeed: state.lineSpeed,
    arborLength: state.arborLength,
    spacerLimit: state.spacerLimit,
    openSectionType: state.openSectionType,
    motorRPM: state.motorRPM,
    motorPower: state.motorPower,
    fileName: state.fileName,
    geometry: state.geometry,
    numStations: state.numStations,
    stationPrefix: state.stationPrefix,
    materialThickness: state.materialThickness,
    bendAllowanceMethod: state.bendAllowanceMethod,
    stations: state.stations,
    gcodeOutputs: state.gcodeOutputs,
    gcodeConfig: state.gcodeConfig,
    rollTooling: state.rollTooling,
    rollGaps: state.rollGaps,
    rollDiameter: state.rollDiameter,
    shaftDiameter: state.shaftDiameter,
    clearance: state.clearance,
    machineProfile: state.machineProfile,
    referenceFileName: state.referenceFileName,
    profileMetadata: state.profileMetadata,
    surfaceFinish: state.surfaceFinish,
    kFactor: state.kFactor,
    accuracyLog: state.accuracyLog,
    accuracyThreshold: state.accuracyThreshold,
    sectionModel: state.sectionModel,
    validationResults: state.validationResults,
    validationApproved: state.validationApproved,
    dxfDimensions: state.dxfDimensions,
    confirmedDimensions: state.confirmedDimensions,
  }),
}));
