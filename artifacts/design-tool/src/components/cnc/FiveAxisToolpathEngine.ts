export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ToolAxis {
  i: number;
  j: number;
  k: number;
}

export interface FiveAxisMove {
  position: Vec3;
  toolAxis: ToolAxis;
  type: "rapid" | "cut";
  feedRate?: number;
  spindleRpm?: number;
  strategy?: string;
  a?: number;
  b?: number;
  c?: number;
}

export interface WorkPlane {
  aAngleDeg: number;
  bAngleDeg: number;
  origin: Vec3;
  normal: Vec3;
  xDir: Vec3;
  yDir: Vec3;
}

export interface SurfacePoint {
  position: Vec3;
  normal: Vec3;
  u: number;
  v: number;
}

export interface ToolAxisStrategy {
  type:
    | "surface_normal"
    | "lead_tilt"
    | "toward_point"
    | "away_from_point"
    | "toward_line"
    | "away_from_line"
    | "fixed";
  leadAngleDeg?: number;
  tiltAngleDeg?: number;
  guidePoint?: Vec3;
  guideLine?: { start: Vec3; end: Vec3 };
  fixedAxis?: ToolAxis;
}

export interface FiveAxisParams {
  toolDiameter: number;
  cornerRadius: number;
  feedRate: number;
  plungeRate: number;
  spindleRpm: number;
  stepover: number;
  stepdown: number;
  safeHeight: number;
  retractHeight: number;
  stockAllowance: number;
  finishAllowance: number;
}

export type FiveAxisOperationType =
  | "3plus2_positional"
  | "5axis_roughing"
  | "5axis_finishing"
  | "5axis_swarf"
  | "5axis_flowline"
  | "5axis_multiaxis_rough";

export interface FiveAxisOperation {
  type: FiveAxisOperationType;
  params: FiveAxisParams;
  axisStrategy: ToolAxisStrategy;
  workPlane?: WorkPlane;
  surfacePoints?: SurfacePoint[];
  moves: FiveAxisMove[];
  estimatedCycleTimeSec: number;
  operationName: string;
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len < 1e-10) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function rotateVectorAroundAxis(v: Vec3, axis: Vec3, angleDeg: number): Vec3 {
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const k = vec3Normalize(axis);
  const dot = vec3Dot(k, v);
  const cross = vec3Cross(k, v);
  return {
    x: v.x * cos + cross.x * sin + k.x * dot * (1 - cos),
    y: v.y * cos + cross.y * sin + k.y * dot * (1 - cos),
    z: v.z * cos + cross.z * sin + k.z * dot * (1 - cos),
  };
}

export function computeWorkPlane(aAngleDeg: number, bAngleDeg: number, origin: Vec3): WorkPlane {
  let normal: Vec3 = { x: 0, y: 0, z: 1 };
  let xDir: Vec3 = { x: 1, y: 0, z: 0 };

  normal = rotateVectorAroundAxis(normal, { x: 1, y: 0, z: 0 }, aAngleDeg);
  xDir = rotateVectorAroundAxis(xDir, { x: 1, y: 0, z: 0 }, aAngleDeg);

  normal = rotateVectorAroundAxis(normal, { x: 0, y: 1, z: 0 }, bAngleDeg);
  xDir = rotateVectorAroundAxis(xDir, { x: 0, y: 1, z: 0 }, bAngleDeg);

  const yDir = vec3Cross(normal, xDir);

  return {
    aAngleDeg,
    bAngleDeg,
    origin,
    normal: vec3Normalize(normal),
    xDir: vec3Normalize(xDir),
    yDir: vec3Normalize(yDir),
  };
}

function transformToWorkPlane(localX: number, localY: number, localZ: number, wp: WorkPlane): Vec3 {
  return {
    x: wp.origin.x + localX * wp.xDir.x + localY * wp.yDir.x + localZ * wp.normal.x,
    y: wp.origin.y + localX * wp.xDir.y + localY * wp.yDir.y + localZ * wp.normal.y,
    z: wp.origin.z + localX * wp.xDir.z + localY * wp.yDir.z + localZ * wp.normal.z,
  };
}

function vecToToolAxis(v: Vec3): ToolAxis {
  const n = vec3Normalize(v);
  return { i: n.x, j: n.y, k: n.z };
}

function computeToolAxis(
  strategy: ToolAxisStrategy,
  surfacePoint: SurfacePoint,
  feedDirection: Vec3
): ToolAxis {
  switch (strategy.type) {
    case "surface_normal":
      return vecToToolAxis(surfacePoint.normal);

    case "lead_tilt": {
      const n = vec3Normalize(surfacePoint.normal);
      const fd = vec3Normalize(feedDirection);
      const side = vec3Normalize(vec3Cross(n, fd));
      let axis = n;
      axis = rotateVectorAroundAxis(axis, side, strategy.leadAngleDeg ?? 0);
      axis = rotateVectorAroundAxis(axis, fd, strategy.tiltAngleDeg ?? 0);
      return vecToToolAxis(axis);
    }

    case "toward_point": {
      const gp = strategy.guidePoint ?? { x: 0, y: 0, z: 0 };
      return vecToToolAxis(vec3Sub(gp, surfacePoint.position));
    }

    case "away_from_point": {
      const gp = strategy.guidePoint ?? { x: 0, y: 0, z: 0 };
      return vecToToolAxis(vec3Sub(surfacePoint.position, gp));
    }

    case "toward_line": {
      const line = strategy.guideLine ?? { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 1 } };
      const lineDir = vec3Normalize(vec3Sub(line.end, line.start));
      const toPoint = vec3Sub(surfacePoint.position, line.start);
      const proj = vec3Scale(lineDir, vec3Dot(toPoint, lineDir));
      const closest = vec3Add(line.start, proj);
      return vecToToolAxis(vec3Sub(closest, surfacePoint.position));
    }

    case "away_from_line": {
      const line = strategy.guideLine ?? { start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 1 } };
      const lineDir = vec3Normalize(vec3Sub(line.end, line.start));
      const toPoint = vec3Sub(surfacePoint.position, line.start);
      const proj = vec3Scale(lineDir, vec3Dot(toPoint, lineDir));
      const closest = vec3Add(line.start, proj);
      return vecToToolAxis(vec3Sub(surfacePoint.position, closest));
    }

    case "fixed":
      return strategy.fixedAxis ?? { i: 0, j: 0, k: 1 };

    default:
      return { i: 0, j: 0, k: 1 };
  }
}

function toolAxisToAB(axis: ToolAxis): { a: number; b: number } {
  const n = vec3Normalize({ x: axis.i, y: axis.j, z: axis.k });
  const b = radToDeg(Math.atan2(n.x, n.z));
  const a = radToDeg(Math.asin(-n.y));
  return { a, b };
}

export function generate3Plus2Milling(
  workPlane: WorkPlane,
  params: FiveAxisParams,
  stockWidth: number,
  stockHeight: number,
  stockDepth: number
): FiveAxisOperation {
  const moves: FiveAxisMove[] = [];
  const { a, b } = { a: workPlane.aAngleDeg, b: workPlane.bAngleDeg };
  const toolAxis: ToolAxis = vecToToolAxis(workPlane.normal);

  moves.push({
    position: transformToWorkPlane(0, 0, params.safeHeight, workPlane),
    toolAxis,
    type: "rapid",
    a,
    b,
    strategy: "3plus2_rapid_to_safe",
  });

  const passCount = Math.ceil(stockDepth / params.stepdown);
  const rowCount = Math.ceil(stockWidth / params.stepover);

  for (let pass = 1; pass <= passCount; pass++) {
    const z = -pass * params.stepdown;

    moves.push({
      position: transformToWorkPlane(-stockWidth / 2 - 5, -stockHeight / 2 - 5, params.retractHeight, workPlane),
      toolAxis,
      type: "rapid",
      a,
      b,
      strategy: "3plus2_retract",
    });

    for (let row = 0; row <= rowCount; row++) {
      const y = -stockHeight / 2 + row * params.stepover;
      const clampedY = Math.min(y, stockHeight / 2);
      const xStart = row % 2 === 0 ? -stockWidth / 2 : stockWidth / 2;
      const xEnd = row % 2 === 0 ? stockWidth / 2 : -stockWidth / 2;

      moves.push({
        position: transformToWorkPlane(xStart, clampedY, params.retractHeight, workPlane),
        toolAxis,
        type: "rapid",
        a,
        b,
        strategy: "3plus2_approach",
      });

      moves.push({
        position: transformToWorkPlane(xStart, clampedY, z, workPlane),
        toolAxis,
        type: "cut",
        feedRate: params.plungeRate,
        spindleRpm: params.spindleRpm,
        a,
        b,
        strategy: "3plus2_plunge",
      });

      moves.push({
        position: transformToWorkPlane(xEnd, clampedY, z, workPlane),
        toolAxis,
        type: "cut",
        feedRate: params.feedRate,
        spindleRpm: params.spindleRpm,
        a,
        b,
        strategy: "3plus2_cut",
      });
    }
  }

  moves.push({
    position: transformToWorkPlane(0, 0, params.safeHeight, workPlane),
    toolAxis,
    type: "rapid",
    a,
    b,
    strategy: "3plus2_retract_final",
  });

  const totalCutDist = moves.reduce((acc, m, i) => {
    if (i === 0 || m.type !== "cut") return acc;
    const prev = moves[i - 1];
    return acc + vec3Length(vec3Sub(m.position, prev.position));
  }, 0);
  const estimatedCycleTimeSec = (totalCutDist / params.feedRate) * 60 + moves.filter(m => m.type === "rapid").length * 0.5;

  return {
    type: "3plus2_positional",
    params,
    axisStrategy: { type: "fixed", fixedAxis: toolAxis },
    workPlane,
    moves,
    estimatedCycleTimeSec,
    operationName: `3+2 Positional (A${a.toFixed(1)}° B${b.toFixed(1)}°)`,
  };
}

function generateSampleSurface(
  uCount: number,
  vCount: number,
  width: number,
  height: number,
  curvatureAmplitude: number
): SurfacePoint[] {
  const points: SurfacePoint[] = [];
  for (let ui = 0; ui <= uCount; ui++) {
    for (let vi = 0; vi <= vCount; vi++) {
      const u = ui / uCount;
      const v = vi / vCount;
      const x = (u - 0.5) * width;
      const y = (v - 0.5) * height;
      const z = curvatureAmplitude * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);

      const dzdx = curvatureAmplitude * Math.PI / width * Math.cos(u * Math.PI) * Math.sin(v * Math.PI);
      const dzdy = curvatureAmplitude * Math.PI / height * Math.sin(u * Math.PI) * Math.cos(v * Math.PI);
      const normal = vec3Normalize({ x: -dzdx, y: -dzdy, z: 1 });

      points.push({ position: { x, y, z }, normal, u, v });
    }
  }
  return points;
}

export function generate5AxisSimultaneousRoughing(
  params: FiveAxisParams,
  axisStrategy: ToolAxisStrategy,
  surfaceWidth: number,
  surfaceHeight: number,
  curvatureAmplitude: number,
  stockDepthAboveSurface: number
): FiveAxisOperation {
  const moves: FiveAxisMove[] = [];
  const uSteps = Math.ceil(surfaceWidth / params.stepover);
  const vSteps = Math.ceil(surfaceHeight / params.stepover);
  const surface = generateSampleSurface(uSteps, vSteps, surfaceWidth, surfaceHeight, curvatureAmplitude);
  const getPoint = (ui: number, vi: number) => surface[ui * (vSteps + 1) + vi];

  const passCount = Math.ceil(stockDepthAboveSurface / params.stepdown);

  moves.push({
    position: { x: 0, y: 0, z: params.safeHeight },
    toolAxis: { i: 0, j: 0, k: 1 },
    type: "rapid",
    strategy: "5axis_rough_safe",
  });

  for (let pass = 1; pass <= passCount; pass++) {
    const depthOffset = stockDepthAboveSurface - pass * params.stepdown + params.stockAllowance;
    const zOffset = Math.max(depthOffset, params.stockAllowance);

    for (let ui = 0; ui <= uSteps; ui++) {
      const forward = ui % 2 === 0;
      for (let vj = 0; vj <= vSteps; vj++) {
        const vi = forward ? vj : vSteps - vj;
        const sp = getPoint(ui, vi);
        if (!sp) continue;

        const feedDir: Vec3 = forward
          ? { x: 0, y: 1, z: 0 }
          : { x: 0, y: -1, z: 0 };

        const tAxis = computeToolAxis(axisStrategy, sp, feedDir);
        const { a, b } = toolAxisToAB(tAxis);
        const pos = vec3Add(sp.position, vec3Scale(sp.normal, zOffset));

        moves.push({
          position: pos,
          toolAxis: tAxis,
          type: "cut",
          feedRate: params.feedRate * 0.7,
          spindleRpm: params.spindleRpm,
          a,
          b,
          strategy: "5axis_rough_cut",
        });
      }

      moves.push({
        position: {
          x: (ui / uSteps - 0.5) * surfaceWidth,
          y: 0,
          z: params.retractHeight + curvatureAmplitude,
        },
        toolAxis: { i: 0, j: 0, k: 1 },
        type: "rapid",
        strategy: "5axis_rough_retract",
      });
    }
  }

  const totalCutDist = moves.reduce((acc, m, i) => {
    if (i === 0 || m.type !== "cut") return acc;
    const prev = moves[i - 1];
    return acc + vec3Length(vec3Sub(m.position, prev.position));
  }, 0);

  return {
    type: "5axis_multiaxis_rough",
    params,
    axisStrategy,
    surfacePoints: surface,
    moves,
    estimatedCycleTimeSec: (totalCutDist / (params.feedRate * 0.7)) * 60,
    operationName: "5-Axis Simultaneous Roughing",
  };
}

export function generate5AxisFinishing(
  params: FiveAxisParams,
  axisStrategy: ToolAxisStrategy,
  surfaceWidth: number,
  surfaceHeight: number,
  curvatureAmplitude: number
): FiveAxisOperation {
  const moves: FiveAxisMove[] = [];
  const uSteps = Math.ceil(surfaceWidth / (params.stepover * 0.5));
  const vSteps = Math.ceil(surfaceHeight / (params.stepover * 0.5));
  const surface = generateSampleSurface(uSteps, vSteps, surfaceWidth, surfaceHeight, curvatureAmplitude);
  const getPoint = (ui: number, vi: number) => surface[ui * (vSteps + 1) + vi];

  moves.push({
    position: { x: 0, y: 0, z: params.safeHeight },
    toolAxis: { i: 0, j: 0, k: 1 },
    type: "rapid",
    strategy: "5axis_finish_safe",
  });

  for (let ui = 0; ui <= uSteps; ui++) {
    const forward = ui % 2 === 0;
    for (let vj = 0; vj <= vSteps; vj++) {
      const vi = forward ? vj : vSteps - vj;
      const sp = getPoint(ui, vi);
      if (!sp) continue;

      const feedDir: Vec3 = forward ? { x: 0, y: 1, z: 0 } : { x: 0, y: -1, z: 0 };
      const tAxis = computeToolAxis(axisStrategy, sp, feedDir);
      const { a, b } = toolAxisToAB(tAxis);

      const pos = vec3Add(sp.position, vec3Scale(sp.normal, params.finishAllowance));

      moves.push({
        position: pos,
        toolAxis: tAxis,
        type: "cut",
        feedRate: params.feedRate,
        spindleRpm: params.spindleRpm,
        a,
        b,
        strategy: "5axis_finish_cut",
      });
    }
  }

  moves.push({
    position: { x: 0, y: 0, z: params.safeHeight },
    toolAxis: { i: 0, j: 0, k: 1 },
    type: "rapid",
    strategy: "5axis_finish_retract",
  });

  const totalCutDist = moves.reduce((acc, m, i) => {
    if (i === 0 || m.type !== "cut") return acc;
    const prev = moves[i - 1];
    return acc + vec3Length(vec3Sub(m.position, prev.position));
  }, 0);

  return {
    type: "5axis_finishing",
    params,
    axisStrategy,
    surfacePoints: surface,
    moves,
    estimatedCycleTimeSec: (totalCutDist / params.feedRate) * 60,
    operationName: "5-Axis Flow-Line Finishing",
  };
}

export function generate5AxisSwarfCutting(
  params: FiveAxisParams,
  wallHeight: number,
  wallCurvePoints: Vec3[],
  wallNormals: Vec3[]
): FiveAxisOperation {
  const moves: FiveAxisMove[] = [];

  if (wallCurvePoints.length < 2) {
    const defaultPoints: Vec3[] = [];
    const defaultNormals: Vec3[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * Math.PI * 0.5;
      defaultPoints.push({
        x: 50 * Math.cos(angle),
        y: 50 * Math.sin(angle),
        z: 0,
      });
      defaultNormals.push(vec3Normalize({
        x: Math.cos(angle),
        y: Math.sin(angle),
        z: 0,
      }));
    }
    wallCurvePoints = defaultPoints;
    wallNormals = defaultNormals;
  }

  moves.push({
    position: { x: 0, y: 0, z: params.safeHeight },
    toolAxis: { i: 0, j: 0, k: 1 },
    type: "rapid",
    strategy: "swarf_safe",
  });

  const passCount = Math.ceil(wallHeight / params.stepdown);

  for (let pass = 0; pass < passCount; pass++) {
    const zBottom = -pass * params.stepdown;
    const zTop = zBottom + Math.min(wallHeight, params.toolDiameter * 0.8);

    for (let i = 0; i < wallCurvePoints.length; i++) {
      const pt = wallCurvePoints[i];
      const n = wallNormals[i] || { x: 1, y: 0, z: 0 };

      const offset = params.toolDiameter / 2 + params.stockAllowance;
      const bottomPos: Vec3 = {
        x: pt.x + n.x * offset,
        y: pt.y + n.y * offset,
        z: zBottom,
      };

      const toolDir = vecToToolAxis({
        x: n.x * 0.1,
        y: n.y * 0.1,
        z: 1,
      });

      const { a, b } = toolAxisToAB(toolDir);

      moves.push({
        position: bottomPos,
        toolAxis: toolDir,
        type: i === 0 && pass === 0 ? "rapid" : "cut",
        feedRate: params.feedRate * 0.8,
        spindleRpm: params.spindleRpm,
        a,
        b,
        strategy: "swarf_wall_cut",
      });
    }

    moves.push({
      position: {
        x: wallCurvePoints[wallCurvePoints.length - 1].x,
        y: wallCurvePoints[wallCurvePoints.length - 1].y,
        z: params.retractHeight,
      },
      toolAxis: { i: 0, j: 0, k: 1 },
      type: "rapid",
      strategy: "swarf_retract",
    });
  }

  moves.push({
    position: { x: 0, y: 0, z: params.safeHeight },
    toolAxis: { i: 0, j: 0, k: 1 },
    type: "rapid",
    strategy: "swarf_final_retract",
  });

  const totalCutDist = moves.reduce((acc, m, i) => {
    if (i === 0 || m.type !== "cut") return acc;
    const prev = moves[i - 1];
    return acc + vec3Length(vec3Sub(m.position, prev.position));
  }, 0);

  return {
    type: "5axis_swarf",
    params,
    axisStrategy: { type: "surface_normal" },
    moves,
    estimatedCycleTimeSec: (totalCutDist / (params.feedRate * 0.8)) * 60,
    operationName: "5-Axis Swarf Cutting",
  };
}

export function getDefaultFiveAxisParams(): FiveAxisParams {
  return {
    toolDiameter: 10,
    cornerRadius: 0,
    feedRate: 2000,
    plungeRate: 500,
    spindleRpm: 12000,
    stepover: 3,
    stepdown: 2,
    safeHeight: 50,
    retractHeight: 10,
    stockAllowance: 0.3,
    finishAllowance: 0.05,
  };
}
