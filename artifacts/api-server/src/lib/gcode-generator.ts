import type { FlowerStation } from "./power-pattern.js";
import type { ProfileGeometry } from "./dxf-parser-util.js";

export interface GcodeConfig {
  controller: string;
  spindleDirection: "M3" | "M4";
  useCSS: boolean;
  useDwell: boolean;
  useCoolant: boolean;
  roughingRpm: number;
  finishingRpm: number;
  roughingSpeed: number;
  finishingSpeed: number;
  roughingFeed: number;
  finishingFeed: number;
  roughingDepth: number;
  finishingDepth: number;
  safeZ: number;
  toolNumber: number;
  material: string;
  maxRpm: number;
  programNumber: number;
}

const DEFAULT_CONFIG: GcodeConfig = {
  controller: "Fanuc",
  spindleDirection: "M3",
  useCSS: true,
  useDwell: true,
  useCoolant: true,
  roughingRpm: 800,
  finishingRpm: 1200,
  roughingSpeed: 200,
  finishingSpeed: 225,
  roughingFeed: 0.3,
  finishingFeed: 0.1,
  roughingDepth: 2.0,
  finishingDepth: 0.3,
  safeZ: 5.0,
  toolNumber: 1,
  material: "GI",
  maxRpm: 2500,
  programNumber: 1001,
};

const DELTA_CONFIG: GcodeConfig = {
  controller: "Delta 2X",
  spindleDirection: "M4",
  useCSS: true,
  useDwell: false,
  useCoolant: false,
  roughingRpm: 500,
  finishingRpm: 500,
  roughingSpeed: 200,
  finishingSpeed: 225,
  roughingFeed: 0.102,
  finishingFeed: 0.051,
  roughingDepth: 2.0,
  finishingDepth: 0.3,
  safeZ: 50.0,
  toolNumber: 4,
  material: "GI",
  maxRpm: 500,
  programNumber: 5000,
};

export function getDefaultConfig(): GcodeConfig { return { ...DEFAULT_CONFIG }; }
export function getDelta2XConfig(): GcodeConfig { return { ...DELTA_CONFIG }; }

export function generateGcode(
  stations: FlowerStation[],
  geometry: ProfileGeometry,
  config: Partial<GcodeConfig> = {},
  stationIndices?: number[]
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const isDelta = cfg.controller === "Delta 2X";
  const lines: string[] = [];

  if (isDelta) {
    lines.push(`O${cfg.programNumber}`);
    lines.push(` (SAI ROLOTECH — ROLL TURNING)`);
    lines.push(`( T${String(cfg.toolNumber).padStart(2, "0")}   )`);
    lines.push(`G0`);
    lines.push(`G53`);
    lines.push(`G28 U0.`);
    lines.push(`G28 W0.`);
    lines.push(`M1`);
  } else {
    lines.push("%");
    lines.push(`O${cfg.programNumber} (SAI ROLOTECH — G-CODE)`);
  }
  lines.push(`(Controller: ${cfg.controller})`);
  lines.push(`(Material: ${cfg.material})`);
  lines.push(`(Generated: ${new Date().toLocaleDateString("en-IN")})`);
  lines.push(`(Stations: ${stations.length})`);
  lines.push("");

  const selectedStations = stationIndices
    ? stations.filter((_, i) => stationIndices.includes(i))
    : stations;

  for (let si = 0; si < selectedStations.length; si++) {
    const station = selectedStations[si];
    const toolN = cfg.toolNumber;
    const tn = String(toolN).padStart(2, "0");
    const rollOD = station.rollDiameter / 2;
    const safeX = (rollOD + 20).toFixed(1);

    if (isDelta) {
      if (si > 0) {
        lines.push(`G0`);
        lines.push(`G53`);
        lines.push(`G28 U0.`);
        lines.push(`G28 W0.`);
        lines.push(`M1`);
      }
      lines.push(`N${toolN}`);
      lines.push(`T${tn}${tn}  ()`);
      lines.push(`G92 S${cfg.maxRpm}`);
      lines.push(`(─────────────────)`);
      lines.push(`(${station.stationId} — ${station.description || "TURN"})`);
      lines.push(`(─────────────────)`);
      lines.push(`G96 S${cfg.roughingSpeed} M4`);
      lines.push(`G90`);
      lines.push(`G0 Z${cfg.safeZ}.`);
      lines.push(`G0 X${safeX} Z2.`);
    } else {
      lines.push(`(Station: ${station.stationId} — ${station.description})`);
      lines.push(`(Bend angle: ${station.bendAngle}° | Roll OD: ${station.rollDiameter}mm | Gap: ${station.rollGap}mm)`);
      lines.push("");
      lines.push(`T${tn}${tn}`);
      if (cfg.useCoolant) lines.push("M8");
      lines.push(`${cfg.spindleDirection} S${cfg.roughingRpm}`);
      if (cfg.useCSS) lines.push(`G96 S${cfg.roughingSpeed}`);
      lines.push(`G0 Z${cfg.safeZ}.`);
      lines.push(`G0 X${(rollOD + 5).toFixed(3)} Z2.`);
    }

    lines.push(`G1 Z0. F${cfg.roughingFeed}`);
    lines.push(`G71 U${cfg.roughingDepth} R0.5`);
    lines.push(`G71 P10 Q20 U${cfg.finishingDepth * 2} W0.05 F${cfg.roughingFeed}`);
    lines.push(`N10 G0 X${(rollOD - station.rollGap).toFixed(3)}`);
    lines.push(`G1 Z-${station.upperRollWidth ?? 30}.`);
    lines.push(`N20 G0 X${(rollOD + 5).toFixed(3)}`);
    lines.push("");

    if (isDelta) {
      lines.push(`(Finishing — ${station.stationId})`);
      lines.push(`G96 S${cfg.finishingSpeed} M4`);
    } else {
      lines.push(`(Finishing pass — ${station.stationId})`);
      lines.push(`${cfg.spindleDirection} S${cfg.finishingRpm}`);
      if (cfg.useCSS) lines.push(`G96 S${cfg.finishingSpeed}`);
    }
    lines.push(`G70 P10 Q20 F${cfg.finishingFeed}`);

    if (cfg.useDwell && !isDelta) lines.push(`G4 P0.5`);

    if (isDelta) {
      lines.push(`G0 X${safeX} Z2.`);
      lines.push(`M5`);
    } else {
      if (cfg.useCoolant) lines.push("M9");
      lines.push("M5");
      lines.push(`G28 U0. W0.`);
    }
    lines.push("");
  }

  if (isDelta) {
    lines.push(`G28 U0.`);
    lines.push(`G28 W0.`);
    lines.push(`M30`);
    lines.push(`%`);
  } else {
    lines.push("M30");
    lines.push("%");
  }

  return lines.join("\n");
}
