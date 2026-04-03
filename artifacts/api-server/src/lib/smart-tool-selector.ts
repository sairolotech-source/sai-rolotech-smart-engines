import type { FlowerStation } from "./power-pattern.js";
import type { ProfileGeometry } from "./dxf-parser-util.js";

export type ProfileType =
  | "C-Channel"
  | "Z-Section"
  | "Hat-Section"
  | "U-Channel"
  | "Angle"
  | "Omega"
  | "T-Section"
  | "Custom";

export interface ProfileAnalysis {
  profileType: ProfileType;
  totalBendAngle: number;
  maxBendAngle: number;
  numBends: number;
  flangeCount: number;
  webHeight: number;
  maxFlangeLength: number;
  symmetrical: boolean;
  complexity: "simple" | "medium" | "complex";
  description: string;
}

export interface Delta2XTool {
  toolNumber: string;
  insertCode: string;
  toolHolder: string;
  operation: string;
  purpose: string;
  spindleSpeed: number;
  feedRate: number;
  depthOfCut: number;
  noseRadius: number;
  coolant: boolean;
  requiredFor: string[];
}

export interface StationToolAssignment {
  stationId: string;
  stationIndex: number;
  rollFeatures: string[];
  assignedTools: Delta2XTool[];
  sequenceOrder: string[];
  estimatedCycleTime: number;
  notes: string[];
}

export interface SmartToolSelectionResult {
  profileAnalysis: ProfileAnalysis;
  selectedTools: Delta2XTool[];
  stationAssignments: StationToolAssignment[];
  totalTools: number;
  toolChangeCount: number;
  estimatedTotalTime: number;
  delta2xGcodeHeader: string[];
  warnings: string[];
  recommendations: string[];
}

const DELTA2X_TOOL_LIBRARY: Delta2XTool[] = [
  {
    toolNumber: "T0208",
    insertCode: "VNMG 060108",
    toolHolder: "Ext. Turning — Square 25×25mm, Straight Shank",
    operation: "OD_ROUGHING",
    purpose: "Contour rough turning — TR_contour primary tool, V35° insert R0.8",
    spindleSpeed: 454,
    feedRate: 0.175,
    depthOfCut: 0.75,
    noseRadius: 0.8,
    coolant: true,
    requiredFor: ["OD_ROUGHING", "PROFILE_GROOVE", "CONTOUR_ROUGH"],
  },
  {
    toolNumber: "T0404",
    insertCode: "Groove Insert",
    toolHolder: "Ext. Grooving",
    operation: "GROOVING",
    purpose: "Relief groove, undercut, parting — external grooving tool",
    spindleSpeed: 280,
    feedRate: 0.05,
    depthOfCut: 0.8,
    noseRadius: 0.15,
    coolant: true,
    requiredFor: ["RELIEF_GROOVE", "UNDERCUT", "PARTING", "GROOVING"],
  },
  {
    toolNumber: "T0606",
    insertCode: "VNMG 160402",
    toolHolder: "Ext. Turning — Square 25×25mm, Straight Shank",
    operation: "OD_FINISHING",
    purpose: "Finish contour turning — V35° insert R0.2, tight tolerance profiles",
    spindleSpeed: 511,
    feedRate: 0.175,
    depthOfCut: 0.3,
    noseRadius: 0.2,
    coolant: true,
    requiredFor: ["OD_FINISHING", "CONTOUR_FINISH", "TAPER", "FLANGE_ANGLE"],
  },
  {
    toolNumber: "T0808",
    insertCode: "VNMG 060108",
    toolHolder: "Ext. Turning — Square 25×25mm, Straight Shank",
    operation: "HEAVY_ROUGHING",
    purpose: "Heavy rough turning — same insert as T2 but heavier cuts, V35° R0.8",
    spindleSpeed: 454,
    feedRate: 0.175,
    depthOfCut: 1.5,
    noseRadius: 0.8,
    coolant: true,
    requiredFor: ["HEAVY_ROUGHING", "OD_ROUGHING", "FACING", "CHAMFER"],
  },
  {
    toolNumber: "T1010",
    insertCode: "V 35° R0.2 Profile",
    toolHolder: "Ext. Grooving — Square 25×25mm",
    operation: "DETAIL_FINISH",
    purpose: "Detail finish + groove profiles — L-insert 95°, fine detail work R0.2",
    spindleSpeed: 400,
    feedRate: 0.08,
    depthOfCut: 0.3,
    noseRadius: 0.2,
    coolant: false,
    requiredFor: ["NARROW_GROOVE", "KEYWAY", "ORING_GROOVE", "DETAIL_FINISH", "BEND_ANGLE"],
  },
];

export function analyzeProfile(
  geometry: ProfileGeometry,
  stations: FlowerStation[],
): ProfileAnalysis {
  const bends = geometry.bends ?? [];
  const segments = geometry.segments ?? [];

  const numBends = bends.length;
  const totalBendAngle = bends.reduce((s, b) => s + Math.abs(b.angle || 0), 0);
  const maxBendAngle = bends.length > 0 ? Math.max(...bends.map(b => Math.abs(b.angle || 0))) : (stations[0]?.bendAngle ?? 0) * stations.length;
  const flangeCount = segments.length > 0 ? segments.length - 1 : numBends;
  const webHeight = segments.length > 0 ? Math.max(...segments.map(s => s.length ?? 0)) : 50;
  const maxFlangeLength = segments.length > 1 ? Math.max(...segments.slice(1).map(s => s.length ?? 0)) : webHeight * 0.5;

  const bendAngles = bends.map(b => Math.abs(b.angle || 0));
  const symmetrical = numBends >= 2 && Math.abs(bendAngles[0]! - (bendAngles[bendAngles.length - 1] ?? 0)) < 5;

  let profileType: ProfileType = "Custom";
  let description = "";

  if (numBends === 0 || totalBendAngle === 0) {
    profileType = "Custom";
    description = "Flat profile — no bends detected";
  } else if (numBends === 1) {
    profileType = "Angle";
    description = `Single bend ${maxBendAngle.toFixed(1)}° — L-Angle profile`;
  } else if (numBends === 2 && symmetrical && maxBendAngle >= 85 && maxBendAngle <= 95) {
    profileType = "C-Channel";
    description = `C-Channel — ${flangeCount} flanges at 90°, web height ~${webHeight.toFixed(1)}mm`;
  } else if (numBends === 2 && !symmetrical) {
    profileType = "Z-Section";
    description = `Z-Section — asymmetric bends ${bendAngles[0]?.toFixed(1)}°/${bendAngles[1]?.toFixed(1)}°`;
  } else if (numBends === 2 && symmetrical && maxBendAngle < 85) {
    profileType = "U-Channel";
    description = `U-Channel — open ${maxBendAngle.toFixed(1)}° bends, rounded bottom`;
  } else if (numBends === 4 && symmetrical) {
    profileType = "Hat-Section";
    description = `Hat Section — 4 bends, flanges outward, web ~${webHeight.toFixed(1)}mm`;
  } else if (numBends === 3) {
    profileType = "Omega";
    description = `Omega/T-Section — 3 bends, complex forming`;
  } else {
    profileType = "Custom";
    description = `Custom profile — ${numBends} bends, ${totalBendAngle.toFixed(1)}° total`;
  }

  const complexity: "simple" | "medium" | "complex" =
    numBends <= 1 ? "simple" : numBends <= 3 ? "medium" : "complex";

  return {
    profileType,
    totalBendAngle,
    maxBendAngle,
    numBends,
    flangeCount,
    webHeight,
    maxFlangeLength,
    symmetrical,
    complexity,
    description,
  };
}

function requiredOperations(
  analysis: ProfileAnalysis,
  station: FlowerStation,
  stationIndex: number,
  totalStations: number,
): string[] {
  const ops: string[] = ["FACING", "BORING", "OD_ROUGHING", "OD_FINISHING"];
  const progress = stationIndex / totalStations;

  if (analysis.maxBendAngle > 5) ops.push("PROFILE_GROOVE");
  if (station.bendAngle > 30) ops.push("TAPER", "FLANGE_ANGLE");
  if (analysis.maxBendAngle > 60) ops.push("TAPER");

  if (progress > 0.8) ops.push("CHAMFER", "RELIEF_GROOVE");
  else if (progress > 0.5) ops.push("RELIEF_GROOVE");

  if (analysis.profileType === "Hat-Section" || analysis.profileType === "Omega") {
    ops.push("NARROW_GROOVE");
  }

  return [...new Set(ops)];
}

function selectToolsForOps(ops: string[]): Delta2XTool[] {
  const selected: Delta2XTool[] = [];
  const added = new Set<string>();

  const opOrder = [
    "FACING", "BORING", "OD_ROUGHING", "TAPER", "FLANGE_ANGLE",
    "PROFILE_GROOVE", "BEND_ANGLE", "GROOVING", "RELIEF_GROOVE",
    "UNDERCUT", "KEYWAY", "ORING_GROOVE", "OD_FINISHING", "CHAMFER",
  ];

  for (const op of opOrder) {
    if (!ops.includes(op)) continue;
    const tool = DELTA2X_TOOL_LIBRARY.find(t => t.requiredFor.includes(op) && !added.has(t.toolNumber));
    if (tool) {
      selected.push(tool);
      added.add(tool.toolNumber);
    }
  }

  return selected;
}

function estimateCycleTime(tools: Delta2XTool[], rollDiameter: number, rollWidth: number): number {
  let total = 0;
  for (const t of tools) {
    const passes = Math.ceil(rollDiameter / (t.depthOfCut * 2));
    const length = rollWidth + 5;
    const timeMin = (passes * length) / (t.feedRate * t.spindleSpeed) * 2;
    total += timeMin + 0.5;
  }
  return Math.round(total * 10) / 10;
}

export function selectToolsForDelta2X(
  geometry: ProfileGeometry,
  stations: FlowerStation[],
  materialType = "GI",
): SmartToolSelectionResult {
  const profileAnalysis = analyzeProfile(geometry, stations);
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (profileAnalysis.complexity === "complex") {
    warnings.push("Complex profile — use T0606 (R0.2 finish) + T1010 (detail) combination");
  }
  if (materialType === "SS") {
    warnings.push("Stainless Steel — reduce speeds by 30%, use coated inserts");
    recommendations.push("Use TiAlN coated inserts for SS material");
  }
  if (materialType === "TI") {
    warnings.push("Titanium — reduce speeds by 50%, flood coolant mandatory");
    recommendations.push("Use PCD or uncoated carbide for Titanium");
  }
  if (profileAnalysis.maxBendAngle > 120) {
    warnings.push("High bend angle >120° — multi-pass profile groove required");
    recommendations.push("Consider 2-pass profile groove: rough then finish");
  }

  const allOps = new Set<string>();
  const stationAssignments: StationToolAssignment[] = [];

  for (let i = 0; i < stations.length; i++) {
    const station = stations[i]!;
    const ops = requiredOperations(profileAnalysis, station, i, stations.length);
    ops.forEach(op => allOps.add(op));
    const tools = selectToolsForOps(ops);
    const cycleTime = estimateCycleTime(tools, station.rollDiameter, station.stripWidth * 0.3);

    const rollFeatures: string[] = [];
    if (ops.includes("PROFILE_GROOVE")) rollFeatures.push(`Profile groove ${station.compensatedAngle.toFixed(1)}°`);
    if (ops.includes("TAPER")) rollFeatures.push(`Taper flange ${station.bendAngle.toFixed(1)}°`);
    if (ops.includes("RELIEF_GROOVE")) rollFeatures.push("Relief groove (roll edge)");
    if (ops.includes("CHAMFER")) rollFeatures.push("Entry/exit chamfer");
    rollFeatures.push(`OD = ${station.rollDiameter.toFixed(1)}mm`);
    rollFeatures.push(`Gap = ${station.rollGap.toFixed(3)}mm`);

    const notes: string[] = [];
    if (i === 0) notes.push("Entry station — light forming, wider gap");
    if (i === stations.length - 1) notes.push("Final station — tight tolerances, verify OD after machining");
    if (station.springbackAngle > 5) notes.push(`Springback ${station.springbackAngle.toFixed(1)}° — compensated angle ${station.compensatedAngle.toFixed(1)}°`);

    stationAssignments.push({
      stationId: station.stationId,
      stationIndex: i + 1,
      rollFeatures,
      assignedTools: tools,
      sequenceOrder: tools.map(t => t.toolNumber),
      estimatedCycleTime: cycleTime,
      notes,
    });
  }

  const masterOps = [...allOps];
  const selectedTools = selectToolsForOps(masterOps);
  const toolChangeCount = stationAssignments.reduce((s, a) => s + Math.max(0, a.assignedTools.length - 1), 0);
  const estimatedTotalTime = stationAssignments.reduce((s, a) => s + a.estimatedCycleTime, 0);

  const delta2xGcodeHeader: string[] = [
    `( SAI ROLOTECH — SMART TOOL SELECTION — DELTA 2X )`,
    `( PROFILE TYPE: ${profileAnalysis.profileType} )`,
    `( PROFILE: ${profileAnalysis.description} )`,
    `( TOTAL STATIONS: ${stations.length} )`,
    `( MATERIAL: ${materialType} )`,
    `( TOOLS REQUIRED: ${selectedTools.map(t => t.toolNumber).join(", ")} )`,
    `( EST. TOTAL TIME: ${estimatedTotalTime.toFixed(1)} min )`,
    `( COMPLEXITY: ${profileAnalysis.complexity.toUpperCase()} )`,
    `( ------------------------------------------- )`,
    ...selectedTools.map(t => `( ${t.toolNumber}: ${t.insertCode} — ${t.purpose} )`),
  ];

  recommendations.push(
    `${profileAnalysis.profileType} ke liye ${selectedTools.length} tools required`,
    `Station 1 pe light forming — gap ${stations[0]?.rollGap.toFixed(3) ?? "N/A"}mm`,
    `Final station pe OD verify karein +/- 0.01mm`,
  );

  return {
    profileAnalysis,
    selectedTools,
    stationAssignments,
    totalTools: selectedTools.length,
    toolChangeCount,
    estimatedTotalTime,
    delta2xGcodeHeader,
    warnings,
    recommendations,
  };
}
