export type MillController = "fanuc" | "haas" | "siemens" | "mazak" | "mitsubishi";

export type MillOpType =
  | "mill_face" | "mill_pocket_zigzag" | "mill_pocket_contour"
  | "mill_contour" | "mill_slot" | "mill_chamfer" | "mill_deburr"
  | "mill_drill_spot" | "mill_drill_peck" | "mill_drill_tap" | "mill_drill_bore" | "mill_drill_bore_stop"
  | "mill_imachining" | "mill_trochoidal" | "mill_manual";

export interface MillTool {
  number: number;
  diameter: number;
  fluteCount: number;
  fluteLength: number;
  totalLength: number;
  cornerRadius: number;
  type: "flat" | "ball" | "bull" | "drill" | "tap" | "chamfer" | "spot";
  material: "carbide" | "hss" | "cobalt" | "ceramic";
}

export interface MillCutting {
  spindleRpm: number;
  feedXY: number;
  feedZ: number;
  coolant: "M08" | "M07" | "M09" | "air";
  stepdown: number;
  stepover: number;
  finishAllowance: number;
}

export interface MillBaseOp {
  id: string;
  type: MillOpType;
  name: string;
  enabled: boolean;
  tool: MillTool;
  cutting: MillCutting;
  notes: string;
  safeZ: number;
  topOfStock: number;
}

export interface MillFaceOp extends MillBaseOp {
  type: "mill_face";
  xMin: number; xMax: number; yMin: number; yMax: number;
  passes: number;
  overlapPct: number;
}

export interface MillPocketZigzagOp extends MillBaseOp {
  type: "mill_pocket_zigzag";
  xMin: number; xMax: number; yMin: number; yMax: number;
  depth: number;
  cornerRadius: number;
  direction: "X" | "Y";
}

export interface MillPocketContourOp extends MillBaseOp {
  type: "mill_pocket_contour";
  xCenter: number; yCenter: number;
  width: number; height: number;
  depth: number;
  cornerRadius: number;
}

export interface MillContourOp extends MillBaseOp {
  type: "mill_contour";
  points: { x: number; y: number }[];
  depth: number;
  compensation: "G41" | "G42" | "none";
  closed: boolean;
}

export interface MillSlotOp extends MillBaseOp {
  type: "mill_slot";
  xStart: number; yStart: number;
  xEnd: number; yEnd: number;
  width: number;
  depth: number;
}

export interface MillChamferOp extends MillBaseOp {
  type: "mill_chamfer";
  xMin: number; xMax: number; yMin: number; yMax: number;
  depth: number;
  chamferAngle: number;
}

export interface MillDeburOp extends MillBaseOp {
  type: "mill_deburr";
  points: { x: number; y: number }[];
  depth: number;
}

export interface MillDrillOp extends MillBaseOp {
  type: "mill_drill_spot" | "mill_drill_peck" | "mill_drill_tap" | "mill_drill_bore" | "mill_drill_bore_stop";
  holes: { x: number; y: number }[];
  depth: number;
  peckDepth: number;
  dwellSec: number;
  pitch: number;
  pattern: "custom" | "grid" | "bolt_circle";
  gridCols: number; gridRows: number; gridSpacingX: number; gridSpacingY: number;
  boltCircleRadius: number; boltCircleCount: number; boltCircleStartAngle: number;
}

export interface MillIMachiningOp extends MillBaseOp {
  type: "mill_imachining";
  xMin: number; xMax: number; yMin: number; yMax: number;
  depth: number;
  cornerRadius: number;
  maxEngagementAngle: number;
  minStepover: number;
  maxStepover: number;
  feedRampFactor: number;
}

export interface MillTrochoidalOp extends MillBaseOp {
  type: "mill_trochoidal";
  xStart: number; yStart: number;
  xEnd: number; yEnd: number;
  slotWidth: number;
  depth: number;
  trochoidalDiameter: number;
  trochoidalStepover: number;
}

export interface MillManualOp extends MillBaseOp {
  type: "mill_manual";
  gcode: string;
}

export type TurnOpType = "turn_rough" | "turn_finish" | "turn_face" | "turn_groove" | "turn_thread";

export interface TurnOperation {
  id: string;
  type: TurnOpType;
  name: string;
  enabled: boolean;
  toolNumber: number;
  toolDesc: string;
  spindleRpm: number;
  cssMode: boolean;
  cssVc: number;
  feedRate: number;
  depthOfCut: number;
  startX: number;
  endX: number;
  startZ: number;
  endZ: number;
  finishAllowance: number;
  pitch?: number;
  grooveWidth?: number;
}

export type MillTurnPlane = "G17" | "G18" | "G19";
export type MillTurnOp =
  | { mode: "milling"; op: MillOperation; plane?: MillTurnPlane }
  | { mode: "turning"; op: TurnOperation; plane?: MillTurnPlane };

export type MillOperation =
  | MillFaceOp | MillPocketZigzagOp | MillPocketContourOp
  | MillContourOp | MillSlotOp | MillChamferOp | MillDeburOp
  | MillDrillOp | MillIMachiningOp | MillTrochoidalOp | MillManualOp;

export interface ToolpathPoint {
  x: number;
  y: number;
  z: number;
  type: "rapid" | "cut" | "arc" | "entry" | "exit" | "plunge";
  feedRate?: number;
}

const MILL_CONTROLLERS: Record<MillController, string> = {
  fanuc: "Fanuc 0i-MF",
  haas: "Haas VF Series",
  siemens: "Siemens 840D",
  mazak: "Mazak Mazatrol",
  mitsubishi: "Mitsubishi M70",
};

function f3(v: number): string { return v.toFixed(3); }

function generateDrillHoles(op: MillDrillOp): { x: number; y: number }[] {
  if (op.pattern === "grid") {
    const holes: { x: number; y: number }[] = [];
    for (let r = 0; r < op.gridRows; r++) {
      for (let c = 0; c < op.gridCols; c++) {
        holes.push({ x: c * op.gridSpacingX, y: r * op.gridSpacingY });
      }
    }
    return holes;
  }
  if (op.pattern === "bolt_circle") {
    const holes: { x: number; y: number }[] = [];
    for (let i = 0; i < op.boltCircleCount; i++) {
      const angle = (op.boltCircleStartAngle + (360 / op.boltCircleCount) * i) * Math.PI / 180;
      holes.push({
        x: op.boltCircleRadius * Math.cos(angle),
        y: op.boltCircleRadius * Math.sin(angle),
      });
    }
    return holes;
  }
  return op.holes;
}

function generateFaceToolpath(op: MillFaceOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const toolR = op.tool.diameter / 2;
  const stepover = op.tool.diameter * (op.overlapPct / 100);
  const zPerPass = op.cutting.stepdown;
  const totalDepth = zPerPass * op.passes;

  for (let pass = 0; pass < op.passes; pass++) {
    const z = op.topOfStock - (pass + 1) * zPerPass;
    let y = op.yMin - toolR;
    let dir = 1;
    pts.push({ x: op.xMin - toolR - 5, y, z: op.safeZ, type: "rapid" });
    pts.push({ x: op.xMin - toolR - 5, y, z: z + 2, type: "rapid" });
    pts.push({ x: op.xMin - toolR - 5, y, z, type: "plunge", feedRate: op.cutting.feedZ });

    while (y <= op.yMax + toolR) {
      const xStart = dir > 0 ? op.xMin - toolR - 5 : op.xMax + toolR + 5;
      const xEnd = dir > 0 ? op.xMax + toolR + 5 : op.xMin - toolR - 5;
      pts.push({ x: xStart, y, z, type: "cut", feedRate: op.cutting.feedXY });
      pts.push({ x: xEnd, y, z, type: "cut", feedRate: op.cutting.feedXY });
      y += stepover;
      dir *= -1;
      if (y <= op.yMax + toolR) {
        pts.push({ x: pts[pts.length - 1].x, y, z, type: "cut", feedRate: op.cutting.feedXY });
      }
    }
    pts.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

function generatePocketZigzagToolpath(op: MillPocketZigzagOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const toolR = op.tool.diameter / 2;
  const stepover = op.tool.diameter * (op.cutting.stepover / 100);
  const depthPasses = Math.ceil(op.depth / op.cutting.stepdown);

  for (let dp = 0; dp < depthPasses; dp++) {
    const z = op.topOfStock - Math.min((dp + 1) * op.cutting.stepdown, op.depth);
    const xMin = op.xMin + toolR;
    const xMax = op.xMax - toolR;
    const yMin = op.yMin + toolR;
    const yMax = op.yMax - toolR;

    pts.push({ x: xMin, y: yMin, z: op.safeZ, type: "rapid" });
    pts.push({ x: xMin, y: yMin, z: z + 2, type: "rapid" });

    const helixSteps = 8;
    for (let h = 0; h < helixSteps; h++) {
      const angle = (h / helixSteps) * Math.PI * 2;
      const hz = z + 2 - (2 * (h + 1) / helixSteps);
      pts.push({
        x: xMin + (toolR * 0.3) * Math.cos(angle),
        y: yMin + (toolR * 0.3) * Math.sin(angle),
        z: hz, type: "entry", feedRate: op.cutting.feedZ * 0.5,
      });
    }

    if (op.direction === "X") {
      let y = yMin;
      let dir = 1;
      while (y <= yMax) {
        const xs = dir > 0 ? xMin : xMax;
        const xe = dir > 0 ? xMax : xMin;
        pts.push({ x: xs, y, z, type: "cut", feedRate: op.cutting.feedXY });
        pts.push({ x: xe, y, z, type: "cut", feedRate: op.cutting.feedXY });
        y += stepover;
        dir *= -1;
        if (y <= yMax) {
          pts.push({ x: pts[pts.length - 1].x, y, z, type: "cut", feedRate: op.cutting.feedXY });
        }
      }
    } else {
      let x = xMin;
      let dir = 1;
      while (x <= xMax) {
        const ys = dir > 0 ? yMin : yMax;
        const ye = dir > 0 ? yMax : yMin;
        pts.push({ x, y: ys, z, type: "cut", feedRate: op.cutting.feedXY });
        pts.push({ x, y: ye, z, type: "cut", feedRate: op.cutting.feedXY });
        x += stepover;
        dir *= -1;
        if (x <= xMax) {
          pts.push({ x, y: pts[pts.length - 1].y, z, type: "cut", feedRate: op.cutting.feedXY });
        }
      }
    }
    pts.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

function generatePocketContourToolpath(op: MillPocketContourOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const toolR = op.tool.diameter / 2;
  const stepover = op.tool.diameter * (op.cutting.stepover / 100);
  const depthPasses = Math.ceil(op.depth / op.cutting.stepdown);
  const hw = op.width / 2;
  const hh = op.height / 2;

  for (let dp = 0; dp < depthPasses; dp++) {
    const z = op.topOfStock - Math.min((dp + 1) * op.cutting.stepdown, op.depth);

    pts.push({ x: op.xCenter, y: op.yCenter, z: op.safeZ, type: "rapid" });
    pts.push({ x: op.xCenter, y: op.yCenter, z: z + 2, type: "rapid" });

    const helixSteps = 8;
    for (let h = 0; h < helixSteps; h++) {
      const angle = (h / helixSteps) * Math.PI * 2;
      const hz = z + 2 - (2 * (h + 1) / helixSteps);
      pts.push({
        x: op.xCenter + (toolR * 0.3) * Math.cos(angle),
        y: op.yCenter + (toolR * 0.3) * Math.sin(angle),
        z: hz, type: "entry", feedRate: op.cutting.feedZ * 0.5,
      });
    }

    let offsetX = toolR;
    let offsetY = toolR;
    while (offsetX < hw && offsetY < hh) {
      const x1 = op.xCenter - hw + offsetX;
      const x2 = op.xCenter + hw - offsetX;
      const y1 = op.yCenter - hh + offsetY;
      const y2 = op.yCenter + hh - offsetY;
      const cr = Math.min(op.cornerRadius, (x2 - x1) / 2, (y2 - y1) / 2);

      pts.push({ x: x1 + cr, y: y1, z, type: "cut", feedRate: op.cutting.feedXY });
      pts.push({ x: x2 - cr, y: y1, z, type: "cut", feedRate: op.cutting.feedXY });
      if (cr > 0) {
        for (let a = 0; a <= 4; a++) {
          const ang = -Math.PI / 2 + (Math.PI / 2) * (a / 4);
          pts.push({ x: x2 - cr + cr * Math.cos(ang), y: y1 + cr + cr * Math.sin(ang), z, type: "arc", feedRate: op.cutting.feedXY });
        }
      }
      pts.push({ x: x2, y: y2 - cr, z, type: "cut", feedRate: op.cutting.feedXY });
      if (cr > 0) {
        for (let a = 0; a <= 4; a++) {
          const ang = 0 + (Math.PI / 2) * (a / 4);
          pts.push({ x: x2 - cr + cr * Math.cos(ang), y: y2 - cr + cr * Math.sin(ang), z, type: "arc", feedRate: op.cutting.feedXY });
        }
      }
      pts.push({ x: x1 + cr, y: y2, z, type: "cut", feedRate: op.cutting.feedXY });
      if (cr > 0) {
        for (let a = 0; a <= 4; a++) {
          const ang = Math.PI / 2 + (Math.PI / 2) * (a / 4);
          pts.push({ x: x1 + cr + cr * Math.cos(ang), y: y2 - cr + cr * Math.sin(ang), z, type: "arc", feedRate: op.cutting.feedXY });
        }
      }
      pts.push({ x: x1, y: y1 + cr, z, type: "cut", feedRate: op.cutting.feedXY });
      if (cr > 0) {
        for (let a = 0; a <= 4; a++) {
          const ang = Math.PI + (Math.PI / 2) * (a / 4);
          pts.push({ x: x1 + cr + cr * Math.cos(ang), y: y1 + cr + cr * Math.sin(ang), z, type: "arc", feedRate: op.cutting.feedXY });
        }
      }

      offsetX += stepover;
      offsetY += stepover;
    }
    pts.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

function generateContourToolpath(op: MillContourOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  if (op.points.length < 2) return pts;
  const depthPasses = Math.ceil(op.depth / op.cutting.stepdown);

  for (let dp = 0; dp < depthPasses; dp++) {
    const z = op.topOfStock - Math.min((dp + 1) * op.cutting.stepdown, op.depth);
    const first = op.points[0];
    pts.push({ x: first.x, y: first.y, z: op.safeZ, type: "rapid" });
    pts.push({ x: first.x, y: first.y, z: z + 2, type: "rapid" });
    pts.push({ x: first.x, y: first.y, z, type: "plunge", feedRate: op.cutting.feedZ });

    for (let i = 1; i < op.points.length; i++) {
      pts.push({ x: op.points[i].x, y: op.points[i].y, z, type: "cut", feedRate: op.cutting.feedXY });
    }
    if (op.closed) {
      pts.push({ x: first.x, y: first.y, z, type: "cut", feedRate: op.cutting.feedXY });
    }
    pts.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

function generateSlotToolpath(op: MillSlotOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const depthPasses = Math.ceil(op.depth / op.cutting.stepdown);
  const dx = op.xEnd - op.xStart;
  const dy = op.yEnd - op.yStart;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return pts;

  for (let dp = 0; dp < depthPasses; dp++) {
    const z = op.topOfStock - Math.min((dp + 1) * op.cutting.stepdown, op.depth);
    pts.push({ x: op.xStart, y: op.yStart, z: op.safeZ, type: "rapid" });
    pts.push({ x: op.xStart, y: op.yStart, z: z + 2, type: "rapid" });

    const helixSteps = 6;
    const toolR = op.tool.diameter / 2;
    for (let h = 0; h < helixSteps; h++) {
      const angle = (h / helixSteps) * Math.PI * 2;
      const hz = z + 2 - (2 * (h + 1) / helixSteps);
      pts.push({
        x: op.xStart + (toolR * 0.3) * Math.cos(angle),
        y: op.yStart + (toolR * 0.3) * Math.sin(angle),
        z: hz, type: "entry", feedRate: op.cutting.feedZ * 0.5,
      });
    }

    pts.push({ x: op.xStart, y: op.yStart, z, type: "cut", feedRate: op.cutting.feedXY });
    pts.push({ x: op.xEnd, y: op.yEnd, z, type: "cut", feedRate: op.cutting.feedXY });
    pts.push({ x: op.xStart, y: op.yStart, z, type: "cut", feedRate: op.cutting.feedXY });
    pts.push({ x: op.xStart, y: op.yStart, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

function generateIMachiningToolpath(op: MillIMachiningOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const toolR = op.tool.diameter / 2;
  const depthPasses = Math.ceil(op.depth / op.cutting.stepdown);
  const xMin = op.xMin + toolR;
  const xMax = op.xMax - toolR;
  const yMin = op.yMin + toolR;
  const yMax = op.yMax - toolR;

  for (let dp = 0; dp < depthPasses; dp++) {
    const z = op.topOfStock - Math.min((dp + 1) * op.cutting.stepdown, op.depth);

    pts.push({ x: (xMin + xMax) / 2, y: (yMin + yMax) / 2, z: op.safeZ, type: "rapid" });
    pts.push({ x: (xMin + xMax) / 2, y: (yMin + yMax) / 2, z: z + 2, type: "rapid" });

    const helixSteps = 12;
    for (let h = 0; h < helixSteps; h++) {
      const angle = (h / helixSteps) * Math.PI * 2;
      const hz = z + 2 - (2 * (h + 1) / helixSteps);
      const r = toolR * 0.4 * (h / helixSteps);
      pts.push({
        x: (xMin + xMax) / 2 + r * Math.cos(angle),
        y: (yMin + yMax) / 2 + r * Math.sin(angle),
        z: hz, type: "entry", feedRate: op.cutting.feedZ * 0.3,
      });
    }

    const maxRDOC = op.tool.diameter * (op.maxStepover / 100);
    const minRDOC = op.tool.diameter * (op.minStepover / 100);
    let offsetX = toolR;
    let offsetY = toolR;
    const maxEngRad = op.maxEngagementAngle * Math.PI / 180;
    const pocketW = (xMax - xMin);
    const pocketH = (yMax - yMin);

    while (offsetX < pocketW / 2 && offsetY < pocketH / 2) {
      const cx = (xMin + xMax) / 2;
      const cy = (yMin + yMax) / 2;
      const rx = offsetX;
      const ry = offsetY;

      const perimSteps = 24;
      for (let i = 0; i <= perimSteps; i++) {
        const angle = (i / perimSteps) * Math.PI * 2;
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);

        const distToCorner = Math.min(
          Math.abs(px - xMin), Math.abs(px - xMax),
          Math.abs(py - yMin), Math.abs(py - yMax)
        );
        const cornerProximity = 1 - Math.min(distToCorner / (op.tool.diameter * 2), 1);
        const localEngagement = Math.min(maxEngRad * (0.3 + 0.7 * cornerProximity), Math.PI);
        const engagementRatio = localEngagement / Math.PI;
        const localFeed = op.cutting.feedXY * (1 + (op.feedRampFactor - 1) * (1 - engagementRatio));

        pts.push({ x: px, y: py, z, type: "cut", feedRate: localFeed });
      }

      const avgCornerProx = Math.min(1, Math.max(0, 1 - Math.min(offsetX, offsetY) / (op.tool.diameter * 3)));
      const localEng = Math.min(maxEngRad * (0.3 + 0.7 * avgCornerProx), Math.PI);
      const adaptiveStep = minRDOC + (maxRDOC - minRDOC) * (1 - localEng / Math.PI);
      offsetX += Math.max(adaptiveStep, minRDOC * 0.5);
      offsetY += Math.max(adaptiveStep, minRDOC * 0.5);
    }

    pts.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

function generateTrochoidalToolpath(op: MillTrochoidalOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const depthPasses = Math.ceil(op.depth / op.cutting.stepdown);
  const dx = op.xEnd - op.xStart;
  const dy = op.yEnd - op.yStart;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return pts;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const trochR = op.trochoidalDiameter / 2;
  const toolR = op.tool.diameter / 2;
  const slotHalfW = op.slotWidth / 2;
  const maxLateralR = Math.max(0, slotHalfW - toolR);
  const effectiveTrochR = Math.min(trochR, maxLateralR);
  const lateralPasses = effectiveTrochR > 0 ? Math.max(1, Math.ceil(maxLateralR / effectiveTrochR)) : 1;

  for (let dp = 0; dp < depthPasses; dp++) {
    const z = op.topOfStock - Math.min((dp + 1) * op.cutting.stepdown, op.depth);
    pts.push({ x: op.xStart, y: op.yStart, z: op.safeZ, type: "rapid" });
    pts.push({ x: op.xStart, y: op.yStart, z: z + 2, type: "rapid" });
    pts.push({ x: op.xStart, y: op.yStart, z, type: "plunge", feedRate: op.cutting.feedZ });

    for (let lp = 0; lp < lateralPasses; lp++) {
      const lateralOffset = lateralPasses > 1 ? (lp / (lateralPasses - 1)) * maxLateralR : 0;
      const currentR = Math.max(effectiveTrochR * 0.3, effectiveTrochR);

      let dist = 0;
      while (dist < len) {
        const cx = op.xStart + ux * dist + nx * lateralOffset;
        const cy = op.yStart + uy * dist + ny * lateralOffset;
        const arcSteps = 12;
        for (let a = 0; a <= arcSteps; a++) {
          const angle = (a / arcSteps) * Math.PI * 2;
          const rawX = cx + currentR * (Math.cos(angle) * nx + Math.sin(angle) * ux);
          const rawY = cy + currentR * (Math.cos(angle) * ny + Math.sin(angle) * uy);

          const lateralDist = (rawX - op.xStart) * nx + (rawY - op.yStart) * ny;
          const clampedLateral = Math.max(-maxLateralR, Math.min(maxLateralR, lateralDist));
          const scale = Math.abs(lateralDist) > 0.001 ? clampedLateral / lateralDist : 1;
          const clampedX = cx + (rawX - cx) * Math.abs(scale);
          const clampedY = cy + (rawY - cy) * Math.abs(scale);

          pts.push({ x: clampedX, y: clampedY, z, type: "cut", feedRate: op.cutting.feedXY });
        }
        dist += op.trochoidalStepover;
      }
    }

    pts.push({ x: op.xEnd, y: op.yEnd, z, type: "cut", feedRate: op.cutting.feedXY });
    pts.push({ x: op.xEnd, y: op.yEnd, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

function generateChamferToolpath(op: MillChamferOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const z = op.topOfStock - op.depth;
  const toolR = op.tool.diameter / 2;

  pts.push({ x: op.xMin - toolR, y: op.yMin, z: op.safeZ, type: "rapid" });
  pts.push({ x: op.xMin - toolR, y: op.yMin, z: z + 2, type: "rapid" });
  pts.push({ x: op.xMin, y: op.yMin, z, type: "plunge", feedRate: op.cutting.feedZ });

  pts.push({ x: op.xMax, y: op.yMin, z, type: "cut", feedRate: op.cutting.feedXY });
  pts.push({ x: op.xMax, y: op.yMax, z, type: "cut", feedRate: op.cutting.feedXY });
  pts.push({ x: op.xMin, y: op.yMax, z, type: "cut", feedRate: op.cutting.feedXY });
  pts.push({ x: op.xMin, y: op.yMin, z, type: "cut", feedRate: op.cutting.feedXY });

  pts.push({ x: op.xMin, y: op.yMin, z: op.safeZ, type: "rapid" });
  return pts;
}

function generateDeburToolpath(op: MillDeburOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  if (op.points.length < 2) return pts;
  const z = op.topOfStock - op.depth;
  const first = op.points[0];

  pts.push({ x: first.x, y: first.y, z: op.safeZ, type: "rapid" });
  pts.push({ x: first.x, y: first.y, z: z + 2, type: "rapid" });
  pts.push({ x: first.x, y: first.y, z, type: "plunge", feedRate: op.cutting.feedZ });

  for (let i = 1; i < op.points.length; i++) {
    pts.push({ x: op.points[i].x, y: op.points[i].y, z, type: "cut", feedRate: op.cutting.feedXY });
  }
  pts.push({ x: first.x, y: first.y, z, type: "cut", feedRate: op.cutting.feedXY });
  pts.push({ x: first.x, y: first.y, z: op.safeZ, type: "rapid" });
  return pts;
}

function generateDrillToolpath(op: MillDrillOp): ToolpathPoint[] {
  const pts: ToolpathPoint[] = [];
  const holes = generateDrillHoles(op);

  for (const hole of holes) {
    pts.push({ x: hole.x, y: hole.y, z: op.safeZ, type: "rapid" });
    pts.push({ x: hole.x, y: hole.y, z: op.topOfStock + 2, type: "rapid" });

    if (op.type === "mill_drill_peck") {
      let currentDepth = 0;
      while (currentDepth < op.depth) {
        const nextDepth = Math.min(currentDepth + op.peckDepth, op.depth);
        pts.push({ x: hole.x, y: hole.y, z: op.topOfStock - nextDepth, type: "plunge", feedRate: op.cutting.feedZ });
        pts.push({ x: hole.x, y: hole.y, z: op.topOfStock + 2, type: "rapid" });
        currentDepth = nextDepth;
      }
    } else {
      pts.push({ x: hole.x, y: hole.y, z: op.topOfStock - op.depth, type: "plunge", feedRate: op.cutting.feedZ });
    }

    pts.push({ x: hole.x, y: hole.y, z: op.safeZ, type: "rapid" });
  }
  return pts;
}

export function generateMillToolpath(op: MillOperation): ToolpathPoint[] {
  switch (op.type) {
    case "mill_face": return generateFaceToolpath(op);
    case "mill_pocket_zigzag": return generatePocketZigzagToolpath(op);
    case "mill_pocket_contour": return generatePocketContourToolpath(op);
    case "mill_contour": return generateContourToolpath(op);
    case "mill_slot": return generateSlotToolpath(op);
    case "mill_chamfer": return generateChamferToolpath(op as MillChamferOp);
    case "mill_deburr": return generateDeburToolpath(op as MillDeburOp);
    case "mill_imachining": return generateIMachiningToolpath(op);
    case "mill_trochoidal": return generateTrochoidalToolpath(op);
    case "mill_drill_spot":
    case "mill_drill_peck":
    case "mill_drill_tap":
    case "mill_drill_bore":
    case "mill_drill_bore_stop":
      return generateDrillToolpath(op as MillDrillOp);
    default: return [];
  }
}

export function generateMillGcode(
  ops: MillOperation[],
  controller: MillController,
  stockX: number,
  stockY: number,
  stockZ: number
): string {
  const lines: string[] = [];
  const isFanuc = controller === "fanuc" || controller === "haas";
  const isSiemens = controller === "siemens";
  const isMazak = controller === "mazak";

  lines.push(`%`);
  lines.push(`(${MILL_CONTROLLERS[controller]} — Milling CAM)`);
  lines.push(`(Stock: ${stockX} × ${stockY} × ${stockZ} mm)`);
  lines.push(`(Generated: ${new Date().toISOString()})`);
  lines.push(``);

  if (isSiemens) {
    lines.push(`G90 G17 G40 G49 G80`);
    lines.push(`G71`);
  } else {
    lines.push(`G90 G17 G21 G40 G49 G80`);
  }
  lines.push(``);

  const enabledOps = ops.filter(o => o.enabled);

  for (const op of enabledOps) {
    lines.push(`(--- ${op.name.toUpperCase()} ---)`);
    const t = op.tool;
    const c = op.cutting;

    if (isSiemens) {
      lines.push(`T${t.number} D1`);
      lines.push(`M6`);
    } else if (isMazak) {
      lines.push(`T${t.number < 10 ? "0" + t.number : t.number} M6 (${t.type} D${f3(t.diameter)})`);
    } else {
      lines.push(`T${t.number} M6`);
    }

    if (isSiemens) {
      lines.push(`D${t.number}`);
    } else {
      lines.push(`G43 H${t.number}`);
    }
    lines.push(`S${c.spindleRpm} M3`);
    if (c.coolant !== "M09" && c.coolant !== "air") {
      lines.push(c.coolant);
    }

    if (op.type === "mill_manual") {
      lines.push((op as MillManualOp).gcode);
      lines.push(``);
      continue;
    }

    if (op.type === "mill_drill_spot") {
      const dr = op as MillDrillOp;
      const holes = generateDrillHoles(dr);
      for (const h of holes) {
        lines.push(`G00 X${f3(h.x)} Y${f3(h.y)}`);
        lines.push(`G00 Z${f3(dr.safeZ)}`);
        lines.push(isSiemens
          ? `CYCLE81(${f3(dr.topOfStock + 2)},0,2,${f3(dr.topOfStock - dr.depth)})`
          : `G81 Z${f3(dr.topOfStock - dr.depth)} R${f3(dr.topOfStock + 2)} F${f3(c.feedZ)}`);
      }
      lines.push(`G80`);
    } else if (op.type === "mill_drill_peck") {
      const dr = op as MillDrillOp;
      const holes = generateDrillHoles(dr);
      for (const h of holes) {
        lines.push(`G00 X${f3(h.x)} Y${f3(h.y)}`);
        lines.push(`G00 Z${f3(dr.safeZ)}`);
        lines.push(isSiemens
          ? `CYCLE83(${f3(dr.topOfStock + 2)},0,2,${f3(dr.topOfStock - dr.depth)},0,0,${f3(dr.peckDepth)},${f3(dr.peckDepth)},0,0,0.5,0,1,${f3(c.feedZ)},0,1)`
          : `G83 Z${f3(dr.topOfStock - dr.depth)} R${f3(dr.topOfStock + 2)} Q${f3(dr.peckDepth)} F${f3(c.feedZ)}`);
      }
      lines.push(`G80`);
    } else if (op.type === "mill_drill_tap") {
      const dr = op as MillDrillOp;
      const holes = generateDrillHoles(dr);
      if (!isSiemens) {
        lines.push(`G95 (Feed per revolution for tapping)`);
      }
      for (const h of holes) {
        lines.push(`G00 X${f3(h.x)} Y${f3(h.y)}`);
        lines.push(`G00 Z${f3(dr.safeZ)}`);
        lines.push(isSiemens
          ? `CYCLE84(${f3(dr.topOfStock + 2)},0,2,${f3(dr.topOfStock - dr.depth)},0,0,${f3(dr.pitch)},${f3(dr.pitch)},${c.spindleRpm},${c.spindleRpm},0,1)`
          : `G84 Z${f3(dr.topOfStock - dr.depth)} R${f3(dr.topOfStock + 2)} F${f3(dr.pitch)}`);
      }
      lines.push(`G80`);
      if (!isSiemens) {
        lines.push(`G94 (Return to feed per minute)`);
      }
    } else if (op.type === "mill_drill_bore") {
      const dr = op as MillDrillOp;
      const holes = generateDrillHoles(dr);
      for (const h of holes) {
        lines.push(`G00 X${f3(h.x)} Y${f3(h.y)}`);
        lines.push(`G00 Z${f3(dr.safeZ)}`);
        lines.push(`G85 Z${f3(dr.topOfStock - dr.depth)} R${f3(dr.topOfStock + 2)} F${f3(c.feedZ)}`);
      }
      lines.push(`G80`);
    } else if (op.type === "mill_drill_bore_stop") {
      const dr = op as MillDrillOp;
      const holes = generateDrillHoles(dr);
      for (const h of holes) {
        lines.push(`G00 X${f3(h.x)} Y${f3(h.y)}`);
        lines.push(`G00 Z${f3(dr.safeZ)}`);
        lines.push(`G86 Z${f3(dr.topOfStock - dr.depth)} R${f3(dr.topOfStock + 2)} F${f3(c.feedZ)}`);
      }
      lines.push(`G80`);
    } else {
      const toolpath = generateMillToolpath(op);
      let lastType: ToolpathPoint["type"] = "rapid";

      if (op.type === "mill_contour" && (op as MillContourOp).compensation !== "none") {
        const comp = (op as MillContourOp).compensation;
        lines.push(`${comp} D${t.number}`);
      }

      for (const pt of toolpath) {
        if (pt.type === "rapid") {
          lines.push(`G00 X${f3(pt.x)} Y${f3(pt.y)} Z${f3(pt.z)}`);
        } else if (pt.type === "plunge" || pt.type === "entry") {
          lines.push(`G01 X${f3(pt.x)} Y${f3(pt.y)} Z${f3(pt.z)} F${f3(pt.feedRate || c.feedZ)}`);
        } else if (pt.type === "arc") {
          if (lastType === "rapid" || lastType === "plunge" || lastType === "entry") {
            lines.push(`G01 X${f3(pt.x)} Y${f3(pt.y)} Z${f3(pt.z)} F${f3(pt.feedRate || c.feedXY)}`);
          } else {
            lines.push(`G01 X${f3(pt.x)} Y${f3(pt.y)} Z${f3(pt.z)}`);
          }
        } else if (pt.type === "cut" || pt.type === "exit") {
          if (lastType === "rapid" || lastType === "plunge" || lastType === "entry") {
            lines.push(`G01 X${f3(pt.x)} Y${f3(pt.y)} Z${f3(pt.z)} F${f3(pt.feedRate || c.feedXY)}`);
          } else {
            lines.push(`X${f3(pt.x)} Y${f3(pt.y)} Z${f3(pt.z)}`);
          }
        }
        lastType = pt.type;
      }

      if (op.type === "mill_contour" && (op as MillContourOp).compensation !== "none") {
        lines.push(`G40`);
      }
    }

    lines.push(`G00 Z${f3(op.safeZ)}`);
    lines.push(`M09`);
    lines.push(``);
  }

  lines.push(`G91 G28 Z0`);
  lines.push(`G28 X0 Y0`);
  lines.push(`M30`);
  lines.push(`%`);

  return lines.join("\n");
}

let _millUid = 0;
export function millUid(): string { return `mill_${Date.now()}_${_millUid++}`; }

export function defaultMillTool(num = 1): MillTool {
  return {
    number: num, diameter: 10, fluteCount: 4, fluteLength: 25,
    totalLength: 75, cornerRadius: 0, type: "flat", material: "carbide",
  };
}

export function defaultMillCutting(): MillCutting {
  return {
    spindleRpm: 6000, feedXY: 800, feedZ: 200,
    coolant: "M08", stepdown: 2, stepover: 40, finishAllowance: 0.1,
  };
}

export function makeMillFaceOp(): MillFaceOp {
  return {
    id: millUid(), type: "mill_face", name: "OP10 Face Mill", enabled: true,
    tool: { ...defaultMillTool(1), diameter: 50, type: "flat", fluteCount: 5 },
    cutting: { ...defaultMillCutting(), spindleRpm: 3000, feedXY: 1200, stepdown: 1.0 },
    notes: "", safeZ: 25, topOfStock: 0,
    xMin: -60, xMax: 60, yMin: -40, yMax: 40, passes: 1, overlapPct: 60,
  };
}

export function makeMillPocketZigzagOp(): MillPocketZigzagOp {
  return {
    id: millUid(), type: "mill_pocket_zigzag", name: "OP20 Pocket (Zigzag)", enabled: true,
    tool: defaultMillTool(2),
    cutting: defaultMillCutting(),
    notes: "", safeZ: 25, topOfStock: 0,
    xMin: -30, xMax: 30, yMin: -20, yMax: 20, depth: 10, cornerRadius: 3, direction: "X",
  };
}

export function makeMillPocketContourOp(): MillPocketContourOp {
  return {
    id: millUid(), type: "mill_pocket_contour", name: "OP20 Pocket (Contour)", enabled: true,
    tool: defaultMillTool(2),
    cutting: defaultMillCutting(),
    notes: "", safeZ: 25, topOfStock: 0,
    xCenter: 0, yCenter: 0, width: 60, height: 40, depth: 10, cornerRadius: 5,
  };
}

export function makeMillContourOp(): MillContourOp {
  return {
    id: millUid(), type: "mill_contour", name: "OP30 Contour", enabled: true,
    tool: defaultMillTool(3),
    cutting: { ...defaultMillCutting(), feedXY: 600 },
    notes: "", safeZ: 25, topOfStock: 0,
    points: [
      { x: -30, y: -20 }, { x: 30, y: -20 }, { x: 30, y: 20 },
      { x: -30, y: 20 },
    ],
    depth: 5, compensation: "G41", closed: true,
  };
}

export function makeMillSlotOp(): MillSlotOp {
  return {
    id: millUid(), type: "mill_slot", name: "OP40 Slot", enabled: true,
    tool: { ...defaultMillTool(4), diameter: 8 },
    cutting: { ...defaultMillCutting(), feedXY: 500 },
    notes: "", safeZ: 25, topOfStock: 0,
    xStart: -25, yStart: 0, xEnd: 25, yEnd: 0, width: 8, depth: 6,
  };
}

export function makeMillChamferOp(): MillChamferOp {
  return {
    id: millUid(), type: "mill_chamfer", name: "OP50 Chamfer/Deburr", enabled: true,
    tool: { ...defaultMillTool(5), type: "chamfer", diameter: 12, cornerRadius: 0 },
    cutting: { ...defaultMillCutting(), spindleRpm: 4000, feedXY: 400, feedZ: 100 },
    notes: "", safeZ: 25, topOfStock: 0,
    xMin: -30, xMax: 30, yMin: -20, yMax: 20, depth: 1.5, chamferAngle: 45,
  };
}

export function makeMillDeburOp(): MillDeburOp {
  return {
    id: millUid(), type: "mill_deburr", name: "OP55 Deburr Edges", enabled: true,
    tool: { ...defaultMillTool(5), type: "chamfer", diameter: 10, cornerRadius: 0 },
    cutting: { ...defaultMillCutting(), spindleRpm: 5000, feedXY: 500, feedZ: 120 },
    notes: "", safeZ: 25, topOfStock: 0,
    points: [{ x: -30, y: -20 }, { x: 30, y: -20 }, { x: 30, y: 20 }, { x: -30, y: 20 }],
    depth: 0.5,
  };
}

export function makeMillDrillOp(drillType: MillDrillOp["type"] = "mill_drill_peck"): MillDrillOp {
  const labels: Record<string, string> = {
    mill_drill_spot: "OP60 Spot Drill (G81)",
    mill_drill_peck: "OP60 Peck Drill (G83)",
    mill_drill_tap: "OP60 Tap (G84)",
    mill_drill_bore: "OP60 Bore (G85)",
    mill_drill_bore_stop: "OP60 Bore w/ Stop (G86)",
  };
  return {
    id: millUid(), type: drillType, name: labels[drillType] || "OP60 Drill", enabled: true,
    tool: { ...defaultMillTool(6), type: drillType === "mill_drill_tap" ? "tap" : "drill", diameter: 10 },
    cutting: { ...defaultMillCutting(), spindleRpm: 2000, feedXY: 0, feedZ: 150 },
    notes: "", safeZ: 25, topOfStock: 0,
    holes: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
    depth: 15, peckDepth: 3, dwellSec: 0, pitch: 1.5,
    pattern: "custom",
    gridCols: 3, gridRows: 3, gridSpacingX: 15, gridSpacingY: 15,
    boltCircleRadius: 25, boltCircleCount: 6, boltCircleStartAngle: 0,
  };
}

export function makeMillIMachiningOp(): MillIMachiningOp {
  return {
    id: millUid(), type: "mill_imachining", name: "OP70 iMachining Adaptive", enabled: true,
    tool: defaultMillTool(7),
    cutting: { ...defaultMillCutting(), feedXY: 1000, stepdown: 3 },
    notes: "", safeZ: 25, topOfStock: 0,
    xMin: -30, xMax: 30, yMin: -20, yMax: 20, depth: 15, cornerRadius: 3,
    maxEngagementAngle: 90, minStepover: 10, maxStepover: 50, feedRampFactor: 1.5,
  };
}

export function makeMillTrochoidalOp(): MillTrochoidalOp {
  return {
    id: millUid(), type: "mill_trochoidal", name: "OP80 Trochoidal/HSM", enabled: true,
    tool: { ...defaultMillTool(8), diameter: 10 },
    cutting: { ...defaultMillCutting(), spindleRpm: 8000, feedXY: 1500, stepdown: 1.5 },
    notes: "", safeZ: 25, topOfStock: 0,
    xStart: -30, yStart: 0, xEnd: 30, yEnd: 0,
    slotWidth: 14, depth: 8, trochoidalDiameter: 12, trochoidalStepover: 2,
  };
}

export function makeMillManualOp(): MillManualOp {
  return {
    id: millUid(), type: "mill_manual", name: "Manual G-code", enabled: true,
    tool: defaultMillTool(1), cutting: defaultMillCutting(),
    notes: "", safeZ: 25, topOfStock: 0,
    gcode: "G04 P2000 (Dwell 2 sec)\nM01 (Optional stop)",
  };
}

export function makeTurnOperation(type: TurnOpType = "turn_rough"): TurnOperation {
  const labels: Record<TurnOpType, string> = {
    turn_rough: "Turning Roughing (G71)",
    turn_finish: "Turning Finishing (G70)",
    turn_face: "Facing",
    turn_groove: "Grooving",
    turn_thread: "Threading (G76)",
  };
  return {
    id: millUid(), type, name: labels[type], enabled: true,
    toolNumber: type === "turn_groove" ? 5 : type === "turn_thread" ? 6 : 1,
    toolDesc: type === "turn_groove" ? "Grooving Insert" : type === "turn_thread" ? "60° Thread Insert" : "CNMG 80° Roughing Insert",
    spindleRpm: 1200, cssMode: true, cssVc: 180,
    feedRate: type === "turn_finish" ? 0.08 : 0.2,
    depthOfCut: type === "turn_finish" ? 0.25 : 2.0,
    startX: 50, endX: 30, startZ: 0, endZ: -40,
    finishAllowance: type === "turn_rough" ? 0.3 : 0,
    pitch: type === "turn_thread" ? 1.5 : undefined,
    grooveWidth: type === "turn_groove" ? 3 : undefined,
  };
}

function generateTurnGcode(op: TurnOperation, controller: MillController, isSiemens: boolean): string[] {
  const lines: string[] = [];
  lines.push(`(${op.name})`);
  lines.push(`T0${op.toolNumber}0${op.toolNumber} (${op.toolDesc})`);

  if (op.cssMode) {
    lines.push(isSiemens ? `G96 S${f3(op.cssVc)} LIMS=${op.spindleRpm}` : `G96 S${f3(op.cssVc)}`);
    if (!isSiemens) lines.push(`G50 S${op.spindleRpm}`);
  } else {
    lines.push(`G97 S${op.spindleRpm}`);
  }
  lines.push(`M03`);
  lines.push(`M08`);

  const safeX = op.startX + 5;
  const safeZ = op.startZ + 5;

  switch (op.type) {
    case "turn_rough": {
      lines.push(`G00 X${f3(safeX)} Z${f3(safeZ)}`);
      if (isSiemens) {
        lines.push(`CYCLE95("FINISH_CONTOUR",${f3(op.depthOfCut)},${f3(op.finishAllowance)},${f3(op.finishAllowance)},${f3(op.feedRate)},0,0,0,0,0,1)`);
      } else {
        const passes = Math.ceil((op.startX - op.endX) / 2 / op.depthOfCut);
        for (let p = 0; p < passes; p++) {
          const x = op.startX - (p + 1) * op.depthOfCut * 2;
          const cutX = Math.max(x, op.endX + op.finishAllowance * 2);
          lines.push(`G00 X${f3(cutX)} Z${f3(op.startZ + 1)}`);
          lines.push(`G01 Z${f3(op.endZ)} F${f3(op.feedRate)}`);
          lines.push(`G01 X${f3(cutX + 1)} F${f3(op.feedRate * 2)}`);
          lines.push(`G00 Z${f3(op.startZ + 1)}`);
        }
      }
      break;
    }
    case "turn_finish": {
      lines.push(`G00 X${f3(safeX)} Z${f3(safeZ)}`);
      lines.push(`G00 X${f3(op.startX)} Z${f3(op.startZ + 1)}`);
      lines.push(`G01 Z${f3(op.startZ)} F${f3(op.feedRate)}`);
      lines.push(`G01 X${f3(op.endX)} Z${f3(op.endZ)} F${f3(op.feedRate)}`);
      lines.push(`G01 X${f3(op.endX + 2)} F${f3(op.feedRate * 2)}`);
      lines.push(`G00 Z${f3(safeZ)}`);
      break;
    }
    case "turn_face": {
      lines.push(`G00 X${f3(safeX)} Z${f3(safeZ)}`);
      const passes = Math.ceil(Math.abs(op.startZ - op.endZ) / op.depthOfCut);
      for (let p = 0; p < passes; p++) {
        const z = op.startZ - (p + 1) * op.depthOfCut;
        const cutZ = Math.max(z, op.endZ);
        lines.push(`G00 X${f3(op.startX + 2)} Z${f3(cutZ)}`);
        lines.push(`G01 X${f3(op.endX)} F${f3(op.feedRate)}`);
        lines.push(`G00 X${f3(op.startX + 2)}`);
      }
      break;
    }
    case "turn_groove": {
      const gw = op.grooveWidth || 3;
      lines.push(`G00 X${f3(safeX)} Z${f3(safeZ)}`);
      lines.push(`G00 X${f3(op.startX + 2)} Z${f3(op.startZ)}`);
      const plunges = Math.ceil(gw / op.depthOfCut);
      for (let p = 0; p < plunges; p++) {
        const zOff = p * op.depthOfCut;
        lines.push(`G00 Z${f3(op.startZ - zOff)}`);
        lines.push(`G01 X${f3(op.endX)} F${f3(op.feedRate * 0.5)}`);
        lines.push(`G04 P500`);
        lines.push(`G00 X${f3(op.startX + 2)}`);
      }
      break;
    }
    case "turn_thread": {
      const pitch = op.pitch || 1.5;
      lines.push(`G00 X${f3(safeX)} Z${f3(safeZ)}`);
      if (isSiemens) {
        lines.push(`CYCLE97(${f3(pitch)},0,${f3(op.startZ)},${f3(op.endZ)},${f3(op.startX / 2)},${f3(op.endX / 2)},1,6,0,0,0,0,${f3(op.feedRate)})`);
      } else {
        lines.push(`G00 X${f3(op.startX)} Z${f3(op.startZ + 5)}`);
        const threadDepth = (op.startX - op.endX) / 2;
        const springPasses = 2;
        const passes = 6 + springPasses;
        for (let p = 0; p < passes; p++) {
          const infeed = p < passes - springPasses ? threadDepth * Math.sqrt((p + 1) / (passes - springPasses)) : threadDepth;
          const cutDia = op.startX - infeed * 2;
          lines.push(`G76 X${f3(cutDia)} Z${f3(op.endZ)} P${f3(infeed * 1000)} Q${f3(op.depthOfCut * 1000)} F${f3(pitch)}`);
        }
      }
      break;
    }
  }

  lines.push(`M09`);
  lines.push(`G28 U0 W0`);
  lines.push(``);
  return lines;
}

export function generateMillTurnGcode(
  millTurnOps: MillTurnOp[],
  controller: MillController,
  stockX: number,
  stockY: number,
  stockZ: number
): string {
  const lines: string[] = [];
  const isSiemens = controller === "siemens";

  lines.push(`%`);
  lines.push(`(${MILL_CONTROLLERS[controller]} — Mill-Turn Combined Program)`);
  lines.push(`(Stock: ${stockX} × ${stockY} × ${stockZ} mm)`);
  lines.push(`(Generated: ${new Date().toISOString()})`);
  lines.push(``);

  if (isSiemens) {
    lines.push(`G90 G18 G40 G49 G80`);
  } else {
    lines.push(`G90 G18 G40 G49 G80`);
  }
  lines.push(``);

  let currentMode: "milling" | "turning" | null = null;
  let currentPlane: MillTurnPlane = "G18";

  const PLANE_LABELS: Record<MillTurnPlane, string> = {
    G17: "XY plane",
    G18: "XZ plane",
    G19: "YZ plane",
  };

  for (const mto of millTurnOps) {
    if (mto.mode === "turning") {
      if (!mto.op.enabled) continue;
      const plane = mto.plane || "G18";
      if (currentMode !== "turning" || currentPlane !== plane) {
        lines.push(`(=== SWITCHING TO TURNING MODE ===)`);
        lines.push(`${plane} (${PLANE_LABELS[plane]} — turning mode)`);
        if (currentMode === "milling") {
          lines.push(`M05 (Stop milling spindle)`);
          lines.push(`G28 Z0 (Retract Z)`);
        }
        currentMode = "turning";
        currentPlane = plane;
        lines.push(``);
      }
      const turnLines = generateTurnGcode(mto.op, controller, isSiemens);
      lines.push(...turnLines);
    } else {
      if (!mto.op.enabled) continue;
      const plane = mto.plane || "G17";
      if (currentMode !== "milling" || currentPlane !== plane) {
        lines.push(`(=== SWITCHING TO MILLING MODE ===)`);
        lines.push(`${plane} (${PLANE_LABELS[plane]} — milling mode)`);
        lines.push(`M19 C0 (C-axis orient for milling)`);
        if (currentMode === "turning") {
          lines.push(`M05 (Stop main spindle)`);
        }
        if (isSiemens) {
          lines.push(`D1`);
        } else {
          lines.push(`G43 H1 (Tool length comp ON)`);
        }
        currentMode = "milling";
        currentPlane = plane;
        lines.push(``);
      }
      const singleOpGcode = generateMillGcode([mto.op], controller, stockX, stockY, stockZ);
      const opLines = singleOpGcode.split("\n");
      const startIdx = opLines.findIndex(l =>
        l.startsWith("(---") || l.startsWith("T") || l.startsWith("(Manual")
      );
      const endIdx = opLines.findLastIndex(l => l === "M09");
      if (startIdx >= 0 && endIdx >= 0) {
        lines.push(...opLines.slice(startIdx, endIdx + 1));
        lines.push(``);
      } else {
        const headerEnd = opLines.findIndex(l => l === "") + 1;
        const footerStart = opLines.findIndex(l => l.startsWith("G91 G28") || l === "M30" || l === "%");
        const bodyStart = Math.max(headerEnd, 0);
        const bodyEnd = footerStart > bodyStart ? footerStart : opLines.length;
        const body = opLines.slice(bodyStart, bodyEnd).filter(l => l.trim() !== "");
        if (body.length > 0) {
          lines.push(...body);
          lines.push(``);
        }
      }
    }
  }

  lines.push(`(=== PROGRAM END ===)`);
  lines.push(`G18 (Return to turning plane)`);
  lines.push(`G28 U0 W0`);
  lines.push(`M30`);
  lines.push(`%`);

  return lines.join("\n");
}
