import type { FiveAxisMove, FiveAxisOperation } from "./FiveAxisToolpathEngine";

export type PostProcessorType = "siemens_840d" | "fanuc_30i" | "heidenhain_tnc";

export interface PostProcessorConfig {
  type: PostProcessorType;
  programNumber: number;
  programName: string;
  unitSystem: "metric" | "inch";
  coolantType: "flood" | "mist" | "through_spindle" | "off";
  useToolLengthComp: boolean;
  safetyBlock: boolean;
  maxFeedRate: number;
  rotaryAxisConfig: "ab" | "ac" | "bc";
  tcpmEnabled: boolean;
  linearizeMaxAngle: number;
}

export interface PostProcessorOutput {
  controller: PostProcessorType;
  programName: string;
  gcode: string;
  lineCount: number;
  estimatedCycleTimeSec: number;
  warnings: string[];
}

function formatCoord(val: number, decimals: number = 3): string {
  return val.toFixed(decimals);
}

function formatFeed(val: number): string {
  return Math.round(val).toString();
}

function generateSiemens840D(
  operation: FiveAxisOperation,
  config: PostProcessorConfig
): PostProcessorOutput {
  const lines: string[] = [];
  const warnings: string[] = [];

  lines.push(`; ${config.programName}`);
  lines.push(`; Siemens 840D - 5-Axis Post Processor`);
  lines.push(`; Operation: ${operation.operationName}`);
  lines.push(`; Tool: D${operation.params.toolDiameter} R${operation.params.cornerRadius}`);
  lines.push(`; Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push(`%_N_${config.programName.replace(/\s+/g, "_").toUpperCase()}_MPF`);
  lines.push("");

  if (config.safetyBlock) {
    lines.push("N10 G40 G60 G90 G94 G17");
    lines.push("N20 DIAMOF");
  }

  lines.push(config.unitSystem === "metric" ? "N30 G71" : "N30 G70");
  lines.push(`N40 T1 D1`);
  lines.push(`N50 M06`);
  lines.push(`N60 S${operation.params.spindleRpm} M03`);

  if (config.coolantType !== "off") {
    const coolantCode = config.coolantType === "through_spindle" ? "M08" :
      config.coolantType === "mist" ? "M07" : "M08";
    lines.push(`N70 ${coolantCode}`);
  }

  lines.push("");

  if (config.tcpmEnabled) {
    lines.push("N100 TRAORI(1)");
    lines.push("N110 TCARR=1");
    lines.push("");
  }

  let lineNum = 200;
  let lastA: number | undefined;
  let lastB: number | undefined;
  let lastFeed: number | undefined;

  for (const move of operation.moves) {
    const parts: string[] = [`N${lineNum}`];

    if (move.type === "rapid") {
      parts.push("G00");
    } else {
      parts.push("G01");
    }

    parts.push(`X${formatCoord(move.position.x)}`);
    parts.push(`Y${formatCoord(move.position.y)}`);
    parts.push(`Z${formatCoord(move.position.z)}`);

    if (move.a !== undefined && move.a !== lastA) {
      parts.push(`A=${formatCoord(move.a, 3)}`);
      lastA = move.a;
    }
    if (move.b !== undefined && move.b !== lastB) {
      parts.push(`B=${formatCoord(move.b, 3)}`);
      lastB = move.b;
    }

    if (move.type === "cut" && move.feedRate && move.feedRate !== lastFeed) {
      const feed = Math.min(move.feedRate, config.maxFeedRate);
      parts.push(`F${formatFeed(feed)}`);
      lastFeed = move.feedRate;
    }

    lines.push(parts.join(" "));
    lineNum += 10;
  }

  lines.push("");

  if (config.tcpmEnabled) {
    lines.push(`N${lineNum} TRAFOOF`);
    lineNum += 10;
  }

  lines.push(`N${lineNum} M05`);
  lineNum += 10;
  lines.push(`N${lineNum} M09`);
  lineNum += 10;
  lines.push(`N${lineNum} G00 Z${formatCoord(operation.params.safeHeight)}`);
  lineNum += 10;
  lines.push(`N${lineNum} G00 A0 B0`);
  lineNum += 10;
  lines.push(`N${lineNum} M30`);
  lines.push("");

  if (operation.moves.some(m => (m.a ?? 0) > 90 || (m.a ?? 0) < -90)) {
    warnings.push("A-axis exceeds ±90° — verify machine travel limits");
  }
  if (operation.moves.some(m => (m.b ?? 0) > 180 || (m.b ?? 0) < -180)) {
    warnings.push("B-axis exceeds ±180° — verify machine travel limits");
  }

  return {
    controller: "siemens_840d",
    programName: config.programName,
    gcode: lines.join("\n"),
    lineCount: lines.length,
    estimatedCycleTimeSec: operation.estimatedCycleTimeSec,
    warnings,
  };
}

function generateFanuc30i(
  operation: FiveAxisOperation,
  config: PostProcessorConfig
): PostProcessorOutput {
  const lines: string[] = [];
  const warnings: string[] = [];

  lines.push(`O${config.programNumber.toString().padStart(4, "0")}`);
  lines.push(`(${config.programName})`);
  lines.push(`(FANUC 30i - 5-AXIS POST)`);
  lines.push(`(OPERATION: ${operation.operationName})`);
  lines.push(`(TOOL: D${operation.params.toolDiameter} R${operation.params.cornerRadius})`);
  lines.push("");

  if (config.safetyBlock) {
    lines.push("G40 G49 G80 G90");
  }
  lines.push(config.unitSystem === "metric" ? "G21" : "G20");
  lines.push("G17");
  lines.push(`T01 M06`);
  lines.push(`S${operation.params.spindleRpm} M03`);

  if (config.coolantType !== "off") {
    lines.push(config.coolantType === "mist" ? "M07" : "M08");
  }

  if (config.useToolLengthComp) {
    lines.push(`G43 H01 Z${formatCoord(operation.params.safeHeight)}`);
  }

  lines.push("");

  if (config.tcpmEnabled) {
    lines.push("G43.4 H01");
    lines.push("");
  }

  let lastA: number | undefined;
  let lastB: number | undefined;
  let lastC: number | undefined;

  for (const move of operation.moves) {
    const parts: string[] = [];

    parts.push(move.type === "rapid" ? "G00" : "G01");
    parts.push(`X${formatCoord(move.position.x)}`);
    parts.push(`Y${formatCoord(move.position.y)}`);
    parts.push(`Z${formatCoord(move.position.z)}`);

    if (config.rotaryAxisConfig === "ab" || config.rotaryAxisConfig === "ac") {
      if (move.a !== undefined && move.a !== lastA) {
        parts.push(`A${formatCoord(move.a, 3)}`);
        lastA = move.a;
      }
    }
    if (config.rotaryAxisConfig === "ab" || config.rotaryAxisConfig === "bc") {
      if (move.b !== undefined && move.b !== lastB) {
        parts.push(`B${formatCoord(move.b, 3)}`);
        lastB = move.b;
      }
    }
    if (config.rotaryAxisConfig === "ac" || config.rotaryAxisConfig === "bc") {
      if (move.c !== undefined && move.c !== lastC) {
        parts.push(`C${formatCoord(move.c, 3)}`);
        lastC = move.c;
      }
    }

    if (move.type === "cut" && move.feedRate) {
      const feed = Math.min(move.feedRate, config.maxFeedRate);
      parts.push(`F${formatFeed(feed)}`);
    }

    lines.push(parts.join(" "));
  }

  lines.push("");

  if (config.tcpmEnabled) {
    lines.push("G49");
  }

  lines.push("M05");
  lines.push("M09");
  lines.push(`G91 G28 Z0`);
  lines.push(`G91 G28 X0 Y0`);
  lines.push("G90");
  lines.push("M30");
  lines.push("%");

  if (!config.tcpmEnabled && operation.type !== "3plus2_positional") {
    warnings.push("G43.4 (TCPM) not enabled — may cause gouging in simultaneous 5-axis");
  }

  return {
    controller: "fanuc_30i",
    programName: `O${config.programNumber}`,
    gcode: lines.join("\n"),
    lineCount: lines.length,
    estimatedCycleTimeSec: operation.estimatedCycleTimeSec,
    warnings,
  };
}

function generateHeidenhainTNC(
  operation: FiveAxisOperation,
  config: PostProcessorConfig
): PostProcessorOutput {
  const lines: string[] = [];
  const warnings: string[] = [];
  let blockNum = 0;
  const bn = () => (blockNum++).toString();

  lines.push(`BEGIN PGM ${config.programName} ${config.unitSystem === "metric" ? "MM" : "INCH"}`);
  lines.push(`; Heidenhain TNC 530/640 - 5-Axis Post`);
  lines.push(`; Operation: ${operation.operationName}`);
  lines.push(`; Tool: D${operation.params.toolDiameter} R${operation.params.cornerRadius}`);
  lines.push("");

  lines.push(`${bn()} BLK FORM 0.1 Z X-100 Y-100 Z-100`);
  lines.push(`${bn()} BLK FORM 0.2 X+100 Y+100 Z+0`);
  lines.push("");

  lines.push(`${bn()} TOOL CALL 1 Z S${operation.params.spindleRpm}`);
  lines.push("");

  if (operation.type === "3plus2_positional" && operation.workPlane) {
    const wp = operation.workPlane;
    lines.push(`${bn()} PLANE SPATIAL SPA${formatCoord(wp.aAngleDeg, 3)} SPB${formatCoord(wp.bAngleDeg, 3)} SPC+0 TURN MB MAX FMAX`);
    lines.push(`${bn()} FUNCTION TCPM F TCP AXIS SPAT PATHCTRL AXIS`);
    lines.push("");
  } else if (config.tcpmEnabled) {
    lines.push(`${bn()} FUNCTION TCPM F TCP AXIS SPAT PATHCTRL AXIS`);
    lines.push("");
  }

  if (config.coolantType !== "off") {
    lines.push(`${bn()} M08`);
  }

  lines.push("");

  for (const move of operation.moves) {
    if (move.type === "rapid") {
      const parts = [bn(), "L"];
      parts.push(`X${formatCoord(move.position.x, 4)}`);
      parts.push(`Y${formatCoord(move.position.y, 4)}`);
      parts.push(`Z${formatCoord(move.position.z, 4)}`);

      if (move.a !== undefined) parts.push(`A${formatCoord(move.a, 3)}`);
      if (move.b !== undefined) parts.push(`B${formatCoord(move.b, 3)}`);
      if (move.c !== undefined) parts.push(`C${formatCoord(move.c, 3)}`);

      parts.push("FMAX");
      parts.push("M03");
      lines.push(parts.join(" "));
    } else {
      const parts = [bn(), "L"];
      parts.push(`X${formatCoord(move.position.x, 4)}`);
      parts.push(`Y${formatCoord(move.position.y, 4)}`);
      parts.push(`Z${formatCoord(move.position.z, 4)}`);

      if (move.a !== undefined) parts.push(`A${formatCoord(move.a, 3)}`);
      if (move.b !== undefined) parts.push(`B${formatCoord(move.b, 3)}`);
      if (move.c !== undefined) parts.push(`C${formatCoord(move.c, 3)}`);

      if (move.feedRate) {
        const feed = Math.min(move.feedRate, config.maxFeedRate);
        parts.push(`F${formatFeed(feed)}`);
      }
      lines.push(parts.join(" "));
    }
  }

  lines.push("");

  if (config.tcpmEnabled || operation.type === "3plus2_positional") {
    lines.push(`${bn()} FUNCTION TCPM RESET`);
    if (operation.type === "3plus2_positional") {
      lines.push(`${bn()} PLANE RESET TURN MB MAX FMAX`);
    }
  }

  lines.push(`${bn()} L Z+${formatCoord(operation.params.safeHeight)} FMAX M09`);
  lines.push(`${bn()} L X+0 Y+0 FMAX M05`);
  lines.push(`${bn()} M30`);
  lines.push(`END PGM ${config.programName} ${config.unitSystem === "metric" ? "MM" : "INCH"}`);

  if (operation.moves.length > 9999) {
    warnings.push("Program exceeds 9999 blocks — consider splitting for older TNC controllers");
  }

  return {
    controller: "heidenhain_tnc",
    programName: config.programName,
    gcode: lines.join("\n"),
    lineCount: lines.length,
    estimatedCycleTimeSec: operation.estimatedCycleTimeSec,
    warnings,
  };
}

export function postProcess(
  operation: FiveAxisOperation,
  config: PostProcessorConfig
): PostProcessorOutput {
  switch (config.type) {
    case "siemens_840d":
      return generateSiemens840D(operation, config);
    case "fanuc_30i":
      return generateFanuc30i(operation, config);
    case "heidenhain_tnc":
      return generateHeidenhainTNC(operation, config);
    default:
      return generateFanuc30i(operation, config);
  }
}

export function getDefaultPostProcessorConfig(): PostProcessorConfig {
  return {
    type: "siemens_840d",
    programNumber: 1001,
    programName: "5AXIS_OP1",
    unitSystem: "metric",
    coolantType: "flood",
    useToolLengthComp: true,
    safetyBlock: true,
    maxFeedRate: 15000,
    rotaryAxisConfig: "ab",
    tcpmEnabled: true,
    linearizeMaxAngle: 5,
  };
}

export function getControllerDisplayName(type: PostProcessorType): string {
  switch (type) {
    case "siemens_840d": return "Siemens 840D (TRAORI)";
    case "fanuc_30i": return "Fanuc 30i/31i (G43.4)";
    case "heidenhain_tnc": return "Heidenhain TNC 530/640";
    default: return type;
  }
}
