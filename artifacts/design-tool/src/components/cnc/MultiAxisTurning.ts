import type { Vec3, ToolAxis, FiveAxisMove } from "./FiveAxisToolpathEngine";

export interface MultiAxisTurningParams {
  stockDiameter: number;
  stockLength: number;
  boreDiameter: number;
  spindleRpm: number;
  feedRate: number;
  finishFeed: number;
  safeX: number;
  safeZ: number;
  cAxisEnabled: boolean;
  yAxisEnabled: boolean;
  bAxisEnabled: boolean;
}

export interface YAxisMillingParams {
  featureX: number;
  featureY: number;
  featureZ: number;
  featureWidth: number;
  featureDepth: number;
  featureLength: number;
  toolDiameter: number;
  feedRate: number;
  spindleRpm: number;
  stepover: number;
  stepdown: number;
}

export interface BAxisDrillingParams {
  holeX: number;
  holeZ: number;
  holeDiameter: number;
  holeDepth: number;
  bAngleDeg: number;
  drillFeed: number;
  drillRpm: number;
  peckDepth: number;
}

export interface CAxisPolarParams {
  features: PolarFeature[];
  toolDiameter: number;
  feedRate: number;
  spindleRpm: number;
  stepdown: number;
}

export interface PolarFeature {
  type: "hole" | "slot" | "pocket";
  cAngleDeg: number;
  radialPosition: number;
  zPosition: number;
  diameter?: number;
  depth: number;
  width?: number;
  length?: number;
}

export interface MultiAxisTurningOperation {
  name: string;
  type: "y_axis_milling" | "b_axis_drilling" | "c_axis_polar" | "combined_mill_turn";
  moves: FiveAxisMove[];
  estimatedCycleTimeSec: number;
  gcode: string[];
}

function makeMove(
  x: number, y: number, z: number,
  type: "rapid" | "cut",
  strategy: string,
  feedRate?: number,
  spindleRpm?: number,
  a?: number, b?: number, c?: number
): FiveAxisMove {
  return {
    position: { x, y, z },
    toolAxis: { i: 0, j: 0, k: 1 },
    type,
    feedRate,
    spindleRpm,
    strategy,
    a,
    b,
    c,
  };
}

export function generateYAxisMilling(
  turningParams: MultiAxisTurningParams,
  millingParams: YAxisMillingParams
): MultiAxisTurningOperation {
  const moves: FiveAxisMove[] = [];
  const gcode: string[] = [];
  const { featureX, featureY, featureZ, featureWidth, featureDepth, featureLength } = millingParams;
  const { toolDiameter, feedRate, spindleRpm, stepover, stepdown } = millingParams;

  gcode.push("(Y-AXIS CROSS MILLING)");
  gcode.push("G28 H0");
  gcode.push("T0505 (LIVE TOOL - Y AXIS END MILL)");
  gcode.push(`M03 S${spindleRpm}`);
  gcode.push("G97");
  gcode.push("M19 (SPINDLE ORIENT - C AXIS LOCK)");

  moves.push(makeMove(turningParams.safeX, 0, turningParams.safeZ, "rapid", "y_mill_safe"));

  const passCount = Math.ceil(featureDepth / stepdown);
  const rowCount = Math.ceil(featureWidth / stepover);

  gcode.push(`G00 X${(turningParams.safeX * 2).toFixed(3)} Y0 Z${turningParams.safeZ.toFixed(3)}`);

  for (let pass = 1; pass <= passCount; pass++) {
    const xDepth = featureX - pass * stepdown;
    gcode.push(`(PASS ${pass} OF ${passCount})`);

    for (let row = 0; row <= rowCount; row++) {
      const yPos = featureY - featureWidth / 2 + row * stepover;
      const clampedY = Math.min(yPos, featureY + featureWidth / 2);
      const zStart = row % 2 === 0 ? featureZ : featureZ - featureLength;
      const zEnd = row % 2 === 0 ? featureZ - featureLength : featureZ;

      moves.push(makeMove(xDepth + 2, clampedY, zStart, "rapid", "y_mill_approach"));

      gcode.push(`G00 X${(xDepth * 2 + 4).toFixed(3)} Y${clampedY.toFixed(3)} Z${zStart.toFixed(3)}`);

      moves.push(makeMove(xDepth, clampedY, zStart, "cut", "y_mill_plunge", feedRate * 0.3, spindleRpm));

      gcode.push(`G01 X${(xDepth * 2).toFixed(3)} F${(feedRate * 0.3).toFixed(0)}`);

      moves.push(makeMove(xDepth, clampedY, zEnd, "cut", "y_mill_cut", feedRate, spindleRpm));

      gcode.push(`G01 Z${zEnd.toFixed(3)} F${feedRate.toFixed(0)}`);
    }

    moves.push(makeMove(turningParams.safeX, featureY, featureZ, "rapid", "y_mill_retract"));
    gcode.push(`G00 X${(turningParams.safeX * 2).toFixed(3)}`);
  }

  gcode.push(`G00 X${(turningParams.safeX * 2).toFixed(3)} Y0 Z${turningParams.safeZ.toFixed(3)}`);
  gcode.push("M05");
  gcode.push("M30");

  const totalCutDist = moves.reduce((acc, m, i) => {
    if (i === 0 || m.type !== "cut") return acc;
    const prev = moves[i - 1];
    const dx = m.position.x - prev.position.x;
    const dy = m.position.y - prev.position.y;
    const dz = m.position.z - prev.position.z;
    return acc + Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, 0);

  return {
    name: "Y-Axis Cross Milling",
    type: "y_axis_milling",
    moves,
    estimatedCycleTimeSec: (totalCutDist / feedRate) * 60 + moves.filter(m => m.type === "rapid").length * 0.3,
    gcode,
  };
}

export function generateBAxisDrilling(
  turningParams: MultiAxisTurningParams,
  drillingParams: BAxisDrillingParams
): MultiAxisTurningOperation {
  const moves: FiveAxisMove[] = [];
  const gcode: string[] = [];
  const { holeX, holeZ, holeDiameter, holeDepth, bAngleDeg, drillFeed, drillRpm, peckDepth } = drillingParams;

  const bRad = (bAngleDeg * Math.PI) / 180;
  const drillAxisX = Math.sin(bRad);
  const drillAxisZ = Math.cos(bRad);

  gcode.push("(B-AXIS ANGLED DRILLING)");
  gcode.push("G28 H0");
  gcode.push(`T0707 (LIVE TOOL - DRILL D${holeDiameter.toFixed(1)})`);
  gcode.push(`M03 S${drillRpm}`);
  gcode.push("G97");
  gcode.push("M19 (SPINDLE ORIENT)");
  gcode.push(`G00 B${bAngleDeg.toFixed(1)}`);

  moves.push(makeMove(turningParams.safeX, 0, turningParams.safeZ, "rapid", "b_drill_safe", undefined, undefined, 0, bAngleDeg));

  const approachX = holeX + drillAxisX * 5;
  const approachZ = holeZ + drillAxisZ * 5;

  moves.push(makeMove(approachX, 0, approachZ, "rapid", "b_drill_approach", undefined, undefined, 0, bAngleDeg));
  gcode.push(`G00 X${(approachX * 2).toFixed(3)} Z${approachZ.toFixed(3)}`);

  const pecks = Math.ceil(holeDepth / peckDepth);
  gcode.push(`G83 X${(holeX * 2).toFixed(3)} Z${holeZ.toFixed(3)} R${(5).toFixed(1)} Q${peckDepth.toFixed(3)} F${drillFeed.toFixed(0)}`);

  for (let peck = 1; peck <= pecks; peck++) {
    const depth = Math.min(peck * peckDepth, holeDepth);
    const drillX = holeX - drillAxisX * depth;
    const drillZ = holeZ - drillAxisZ * depth;

    moves.push(makeMove(drillX, 0, drillZ, "cut", "b_drill_peck", drillFeed, drillRpm, 0, bAngleDeg));

    if (peck < pecks) {
      moves.push(makeMove(approachX, 0, approachZ, "rapid", "b_drill_retract", undefined, undefined, 0, bAngleDeg));
    }
  }

  moves.push(makeMove(approachX, 0, approachZ, "rapid", "b_drill_exit", undefined, undefined, 0, bAngleDeg));
  gcode.push("G80");

  moves.push(makeMove(turningParams.safeX, 0, turningParams.safeZ, "rapid", "b_drill_home", undefined, undefined, 0, 0));
  gcode.push(`G00 B0`);
  gcode.push(`G00 X${(turningParams.safeX * 2).toFixed(3)} Z${turningParams.safeZ.toFixed(3)}`);
  gcode.push("M05");

  return {
    name: `B-Axis Drilling (${bAngleDeg}°)`,
    type: "b_axis_drilling",
    moves,
    estimatedCycleTimeSec: pecks * (peckDepth / drillFeed) * 60 + pecks * 0.5 + 3,
    gcode,
  };
}

export function generateCAxisPolarInterpolation(
  turningParams: MultiAxisTurningParams,
  polarParams: CAxisPolarParams
): MultiAxisTurningOperation {
  const moves: FiveAxisMove[] = [];
  const gcode: string[] = [];

  gcode.push("(C-AXIS POLAR INTERPOLATION)");
  gcode.push("G28 H0");
  gcode.push(`T0909 (LIVE TOOL - END MILL D${polarParams.toolDiameter.toFixed(1)})`);
  gcode.push(`M03 S${polarParams.spindleRpm}`);
  gcode.push("G97");
  gcode.push("G12.1 (POLAR INTERPOLATION ON)");

  moves.push(makeMove(turningParams.safeX, 0, turningParams.safeZ, "rapid", "polar_safe"));
  gcode.push(`G00 X${(turningParams.safeX * 2).toFixed(3)} Z${turningParams.safeZ.toFixed(3)}`);

  for (const feature of polarParams.features) {
    const cRad = (feature.cAngleDeg * Math.PI) / 180;
    const featureX = feature.radialPosition * Math.cos(cRad);
    const featureY = feature.radialPosition * Math.sin(cRad);

    gcode.push(`(FEATURE AT C=${feature.cAngleDeg.toFixed(1)} R=${feature.radialPosition.toFixed(2)})`);

    if (feature.type === "hole") {
      const dia = feature.diameter ?? polarParams.toolDiameter;
      moves.push(makeMove(featureX, featureY, feature.zPosition + 2, "rapid", "polar_hole_approach",
        undefined, undefined, undefined, undefined, feature.cAngleDeg));
      gcode.push(`G00 C${feature.cAngleDeg.toFixed(3)} X${(feature.radialPosition * 2).toFixed(3)} Z${(feature.zPosition + 2).toFixed(3)}`);

      const pecks = Math.ceil(feature.depth / polarParams.stepdown);
      for (let p = 1; p <= pecks; p++) {
        const zDepth = feature.zPosition - Math.min(p * polarParams.stepdown, feature.depth);
        moves.push(makeMove(featureX, featureY, zDepth, "cut", "polar_hole_peck",
          polarParams.feedRate * 0.5, polarParams.spindleRpm, undefined, undefined, feature.cAngleDeg));
        gcode.push(`G01 Z${zDepth.toFixed(3)} F${(polarParams.feedRate * 0.5).toFixed(0)}`);

        if (dia > polarParams.toolDiameter) {
          const helixR = (dia - polarParams.toolDiameter) / 2;
          const helixSteps = 8;
          for (let h = 0; h <= helixSteps; h++) {
            const angle = (h / helixSteps) * Math.PI * 2;
            const hx = featureX + helixR * Math.cos(angle);
            const hy = featureY + helixR * Math.sin(angle);
            moves.push(makeMove(hx, hy, zDepth, "cut", "polar_hole_helix",
              polarParams.feedRate * 0.4, polarParams.spindleRpm));
          }
          moves.push(makeMove(featureX, featureY, zDepth, "cut", "polar_hole_center",
            polarParams.feedRate * 0.4, polarParams.spindleRpm));
        }
      }

      moves.push(makeMove(featureX, featureY, feature.zPosition + 2, "rapid", "polar_hole_retract"));
      gcode.push(`G00 Z${(feature.zPosition + 2).toFixed(3)}`);

    } else if (feature.type === "slot") {
      const slotLen = feature.length ?? 10;
      const passCount = Math.ceil(feature.depth / polarParams.stepdown);
      const slotDir = cRad;

      for (let pass = 1; pass <= passCount; pass++) {
        const zDepth = feature.zPosition - Math.min(pass * polarParams.stepdown, feature.depth);

        const startX = featureX - (slotLen / 2) * Math.cos(slotDir);
        const startY = featureY - (slotLen / 2) * Math.sin(slotDir);
        const endX = featureX + (slotLen / 2) * Math.cos(slotDir);
        const endY = featureY + (slotLen / 2) * Math.sin(slotDir);

        moves.push(makeMove(startX, startY, zDepth + 2, "rapid", "polar_slot_approach"));
        moves.push(makeMove(startX, startY, zDepth, "cut", "polar_slot_plunge",
          polarParams.feedRate * 0.3, polarParams.spindleRpm, undefined, undefined, feature.cAngleDeg));
        moves.push(makeMove(endX, endY, zDepth, "cut", "polar_slot_cut",
          polarParams.feedRate, polarParams.spindleRpm, undefined, undefined, feature.cAngleDeg));
      }

      moves.push(makeMove(featureX, featureY, feature.zPosition + 5, "rapid", "polar_slot_retract"));

    } else if (feature.type === "pocket") {
      const pWidth = feature.width ?? 10;
      const pLength = feature.length ?? 10;
      const passCount = Math.ceil(feature.depth / polarParams.stepdown);

      for (let pass = 1; pass <= passCount; pass++) {
        const zDepth = feature.zPosition - Math.min(pass * polarParams.stepdown, feature.depth);
        const rows = Math.ceil(pWidth / (polarParams.toolDiameter * 0.6));

        for (let row = 0; row <= rows; row++) {
          const rowOffset = -pWidth / 2 + row * (polarParams.toolDiameter * 0.6);
          const clampedOffset = Math.min(rowOffset, pWidth / 2);
          const perpX = -Math.sin(cRad) * clampedOffset;
          const perpY = Math.cos(cRad) * clampedOffset;

          const sx = featureX + perpX - (pLength / 2) * Math.cos(cRad);
          const sy = featureY + perpY - (pLength / 2) * Math.sin(cRad);
          const ex = featureX + perpX + (pLength / 2) * Math.cos(cRad);
          const ey = featureY + perpY + (pLength / 2) * Math.sin(cRad);

          const fromX = row % 2 === 0 ? sx : ex;
          const fromY = row % 2 === 0 ? sy : ey;
          const toX = row % 2 === 0 ? ex : sx;
          const toY = row % 2 === 0 ? ey : sy;

          if (row === 0 && pass === 1) {
            moves.push(makeMove(fromX, fromY, zDepth + 2, "rapid", "polar_pocket_approach"));
          }
          moves.push(makeMove(fromX, fromY, zDepth, "cut", "polar_pocket_plunge",
            polarParams.feedRate * 0.3, polarParams.spindleRpm));
          moves.push(makeMove(toX, toY, zDepth, "cut", "polar_pocket_cut",
            polarParams.feedRate, polarParams.spindleRpm));
        }
      }

      moves.push(makeMove(featureX, featureY, feature.zPosition + 5, "rapid", "polar_pocket_retract"));
    }
  }

  gcode.push("G13.1 (POLAR INTERPOLATION OFF)");
  gcode.push(`G00 X${(turningParams.safeX * 2).toFixed(3)} Z${turningParams.safeZ.toFixed(3)}`);
  gcode.push("M05");
  gcode.push("M30");

  const totalCutDist = moves.reduce((acc, m, i) => {
    if (i === 0 || m.type !== "cut") return acc;
    const prev = moves[i - 1];
    const dx = m.position.x - prev.position.x;
    const dy = m.position.y - prev.position.y;
    const dz = m.position.z - prev.position.z;
    return acc + Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, 0);

  return {
    name: "C-Axis Polar Interpolation",
    type: "c_axis_polar",
    moves,
    estimatedCycleTimeSec: (totalCutDist / polarParams.feedRate) * 60 + moves.filter(m => m.type === "rapid").length * 0.3,
    gcode,
  };
}

export function getDefaultMultiAxisTurningParams(): MultiAxisTurningParams {
  return {
    stockDiameter: 80,
    stockLength: 150,
    boreDiameter: 20,
    spindleRpm: 2000,
    feedRate: 0.2,
    finishFeed: 0.08,
    safeX: 50,
    safeZ: 5,
    cAxisEnabled: true,
    yAxisEnabled: true,
    bAxisEnabled: true,
  };
}

export function getDefaultYAxisMillingParams(): YAxisMillingParams {
  return {
    featureX: 35,
    featureY: 0,
    featureZ: -20,
    featureWidth: 15,
    featureDepth: 8,
    featureLength: 30,
    toolDiameter: 8,
    feedRate: 800,
    spindleRpm: 6000,
    stepover: 3,
    stepdown: 2,
  };
}

export function getDefaultBAxisDrillingParams(): BAxisDrillingParams {
  return {
    holeX: 30,
    holeZ: -40,
    holeDiameter: 8,
    holeDepth: 15,
    bAngleDeg: 45,
    drillFeed: 100,
    drillRpm: 3000,
    peckDepth: 3,
  };
}

export function getDefaultCAxisPolarParams(): CAxisPolarParams {
  return {
    features: [
      { type: "hole", cAngleDeg: 0, radialPosition: 25, zPosition: -30, diameter: 6, depth: 10 },
      { type: "hole", cAngleDeg: 90, radialPosition: 25, zPosition: -30, diameter: 6, depth: 10 },
      { type: "hole", cAngleDeg: 180, radialPosition: 25, zPosition: -30, diameter: 6, depth: 10 },
      { type: "hole", cAngleDeg: 270, radialPosition: 25, zPosition: -30, diameter: 6, depth: 10 },
      { type: "slot", cAngleDeg: 45, radialPosition: 20, zPosition: -60, depth: 5, length: 15 },
      { type: "pocket", cAngleDeg: 135, radialPosition: 20, zPosition: -60, depth: 4, width: 10, length: 12 },
    ],
    toolDiameter: 6,
    feedRate: 600,
    spindleRpm: 5000,
    stepdown: 2,
  };
}
