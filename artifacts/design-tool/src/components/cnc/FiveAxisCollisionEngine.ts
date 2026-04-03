import type { Vec3, ToolAxis, FiveAxisMove, FiveAxisOperation, SurfacePoint } from "./FiveAxisToolpathEngine";

export interface ToolAssembly {
  cutterDiameter: number;
  cutterLength: number;
  cornerRadius: number;
  shankDiameter: number;
  shankLength: number;
  holderDiameter: number;
  holderLength: number;
  gaugeLengthFromSpindle: number;
}

export interface FixtureGeometry {
  type: "box" | "cylinder" | "vise";
  position: Vec3;
  dimensions: Vec3;
  rotation?: Vec3;
}

export interface PartBoundingBox {
  min: Vec3;
  max: Vec3;
}

export interface CollisionZone {
  startIndex: number;
  endIndex: number;
  severity: "gouge" | "holder_collision" | "shank_collision" | "fixture_collision" | "axis_limit";
  description: string;
  maxPenetration: number;
  position: Vec3;
}

export interface FiveAxisCollisionResult {
  totalMoves: number;
  checkedMoves: number;
  collisionCount: number;
  gougeCount: number;
  holderCollisionCount: number;
  fixtureCollisionCount: number;
  axisLimitViolations: number;
  collisionZones: CollisionZone[];
  minClearance: number;
  overallStatus: "safe" | "warning" | "critical";
  summary: string;
}

function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len < 1e-10) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function pointToLineDistance(point: Vec3, lineStart: Vec3, lineDir: Vec3, lineLength: number): { distance: number; t: number } {
  const toPoint = vec3Sub(point, lineStart);
  const t = Math.max(0, Math.min(lineLength, vec3Dot(toPoint, lineDir)));
  const closestOnLine = vec3Add(lineStart, vec3Scale(lineDir, t));
  return { distance: vec3Length(vec3Sub(point, closestOnLine)), t };
}

function checkCutterGougeAgainstSurface(
  toolTipPos: Vec3,
  toolAxis: ToolAxis,
  tool: ToolAssembly,
  surfacePoints: SurfacePoint[]
): { isGouging: boolean; penetration: number; position: Vec3 } {
  const cutterRadius = tool.cutterDiameter / 2;
  const axis = vec3Normalize({ x: toolAxis.i, y: toolAxis.j, z: toolAxis.k });
  let maxPenetration = 0;
  let gougePos: Vec3 = toolTipPos;

  for (const sp of surfacePoints) {
    const toSurface = vec3Sub(sp.position, toolTipPos);
    const axialDist = vec3Dot(toSurface, axis);

    if (axialDist < -0.5 || axialDist > tool.cutterLength) continue;

    const axialComponent = vec3Scale(axis, axialDist);
    const radialVec = vec3Sub(toSurface, axialComponent);
    const radialDist = vec3Length(radialVec);

    let effectiveRadius = cutterRadius;
    if (tool.cornerRadius > 0 && axialDist < tool.cornerRadius) {
      const cornerCenter = tool.cornerRadius;
      const dz = cornerCenter - axialDist;
      if (dz > 0) {
        effectiveRadius = cutterRadius - tool.cornerRadius + Math.sqrt(Math.max(0, tool.cornerRadius * tool.cornerRadius - dz * dz));
      }
    }

    if (radialDist < effectiveRadius) {
      const penetration = effectiveRadius - radialDist;
      if (penetration > maxPenetration) {
        maxPenetration = penetration;
        gougePos = sp.position;
      }
    }
  }

  return {
    isGouging: maxPenetration > 0.01,
    penetration: maxPenetration,
    position: gougePos,
  };
}

function checkHolderCollisionAgainstPart(
  toolTipPos: Vec3,
  toolAxis: ToolAxis,
  tool: ToolAssembly,
  partBounds: PartBoundingBox
): { hasCollision: boolean; penetration: number; position: Vec3; component: "shank" | "holder" } {
  const axis = vec3Normalize({ x: toolAxis.i, y: toolAxis.j, z: toolAxis.k });

  const shankStart = vec3Add(toolTipPos, vec3Scale(axis, tool.cutterLength));
  const shankEnd = vec3Add(shankStart, vec3Scale(axis, tool.shankLength));
  const holderStart = shankEnd;
  const holderEnd = vec3Add(holderStart, vec3Scale(axis, tool.holderLength));

  const checkPoints = [
    { pos: shankStart, radius: tool.shankDiameter / 2, component: "shank" as const },
    { pos: vec3Scale(vec3Add(shankStart, shankEnd), 0.5), radius: tool.shankDiameter / 2, component: "shank" as const },
    { pos: shankEnd, radius: tool.shankDiameter / 2, component: "shank" as const },
    { pos: holderStart, radius: tool.holderDiameter / 2, component: "holder" as const },
    { pos: vec3Scale(vec3Add(holderStart, holderEnd), 0.5), radius: tool.holderDiameter / 2, component: "holder" as const },
    { pos: holderEnd, radius: tool.holderDiameter / 2, component: "holder" as const },
  ];

  let maxPenetration = 0;
  let collisionPos: Vec3 = toolTipPos;
  let collisionComponent: "shank" | "holder" = "shank";

  for (const cp of checkPoints) {
    const insideX = cp.pos.x + cp.radius > partBounds.min.x && cp.pos.x - cp.radius < partBounds.max.x;
    const insideY = cp.pos.y + cp.radius > partBounds.min.y && cp.pos.y - cp.radius < partBounds.max.y;
    const insideZ = cp.pos.z + cp.radius > partBounds.min.z && cp.pos.z - cp.radius < partBounds.max.z;

    if (insideX && insideY && insideZ) {
      const overlapX = Math.min(
        cp.pos.x + cp.radius - partBounds.min.x,
        partBounds.max.x - cp.pos.x + cp.radius
      );
      const overlapY = Math.min(
        cp.pos.y + cp.radius - partBounds.min.y,
        partBounds.max.y - cp.pos.y + cp.radius
      );
      const overlapZ = Math.min(
        cp.pos.z + cp.radius - partBounds.min.z,
        partBounds.max.z - cp.pos.z + cp.radius
      );
      const penetration = Math.min(overlapX, overlapY, overlapZ);
      if (penetration > maxPenetration) {
        maxPenetration = penetration;
        collisionPos = cp.pos;
        collisionComponent = cp.component;
      }
    }
  }

  return {
    hasCollision: maxPenetration > 0.1,
    penetration: maxPenetration,
    position: collisionPos,
    component: collisionComponent,
  };
}

function checkFixtureCollision(
  toolTipPos: Vec3,
  toolAxis: ToolAxis,
  tool: ToolAssembly,
  fixture: FixtureGeometry
): { hasCollision: boolean; penetration: number; position: Vec3 } {
  const axis = vec3Normalize({ x: toolAxis.i, y: toolAxis.j, z: toolAxis.k });
  const totalLength = tool.cutterLength + tool.shankLength + tool.holderLength;

  const fMin: Vec3 = {
    x: fixture.position.x - fixture.dimensions.x / 2,
    y: fixture.position.y - fixture.dimensions.y / 2,
    z: fixture.position.z - fixture.dimensions.z / 2,
  };
  const fMax: Vec3 = {
    x: fixture.position.x + fixture.dimensions.x / 2,
    y: fixture.position.y + fixture.dimensions.y / 2,
    z: fixture.position.z + fixture.dimensions.z / 2,
  };

  const testPoints = 10;
  let maxPenetration = 0;
  let collisionPos: Vec3 = toolTipPos;

  for (let i = 0; i <= testPoints; i++) {
    const t = (i / testPoints) * totalLength;
    const pos = vec3Add(toolTipPos, vec3Scale(axis, t));

    let radius: number;
    if (t < tool.cutterLength) {
      radius = tool.cutterDiameter / 2;
    } else if (t < tool.cutterLength + tool.shankLength) {
      radius = tool.shankDiameter / 2;
    } else {
      radius = tool.holderDiameter / 2;
    }

    const insideX = pos.x + radius > fMin.x && pos.x - radius < fMax.x;
    const insideY = pos.y + radius > fMin.y && pos.y - radius < fMax.y;
    const insideZ = pos.z + radius > fMin.z && pos.z - radius < fMax.z;

    if (insideX && insideY && insideZ) {
      const overlapX = Math.min(pos.x + radius - fMin.x, fMax.x - pos.x + radius);
      const overlapY = Math.min(pos.y + radius - fMin.y, fMax.y - pos.y + radius);
      const overlapZ = Math.min(pos.z + radius - fMin.z, fMax.z - pos.z + radius);
      const penetration = Math.min(overlapX, overlapY, overlapZ);
      if (penetration > maxPenetration) {
        maxPenetration = penetration;
        collisionPos = { ...pos };
      }
    }
  }

  return {
    hasCollision: maxPenetration > 0.05,
    penetration: maxPenetration,
    position: collisionPos,
  };
}

function checkAxisLimits(
  move: FiveAxisMove,
  aLimits: { min: number; max: number },
  bLimits: { min: number; max: number }
): { violation: boolean; description: string } {
  const a = move.a ?? 0;
  const b = move.b ?? 0;

  if (a < aLimits.min || a > aLimits.max) {
    return { violation: true, description: `A-axis ${a.toFixed(1)}° exceeds limits [${aLimits.min}°, ${aLimits.max}°]` };
  }
  if (b < bLimits.min || b > bLimits.max) {
    return { violation: true, description: `B-axis ${b.toFixed(1)}° exceeds limits [${bLimits.min}°, ${bLimits.max}°]` };
  }
  return { violation: false, description: "" };
}

export function runFiveAxisCollisionCheck(
  operation: FiveAxisOperation,
  tool: ToolAssembly,
  partBounds: PartBoundingBox,
  fixtures: FixtureGeometry[],
  axisLimits?: { aMin: number; aMax: number; bMin: number; bMax: number }
): FiveAxisCollisionResult {
  const collisionZones: CollisionZone[] = [];
  let gougeCount = 0;
  let holderCollisionCount = 0;
  let fixtureCollisionCount = 0;
  let axisLimitViolations = 0;
  let minClearance = Infinity;
  const surfacePoints = operation.surfacePoints ?? [];
  const aLimits = { min: axisLimits?.aMin ?? -120, max: axisLimits?.aMax ?? 120 };
  const bLimits = { min: axisLimits?.bMin ?? -360, max: axisLimits?.bMax ?? 360 };

  for (let i = 0; i < operation.moves.length; i++) {
    const move = operation.moves[i];
    if (move.type === "rapid") continue;

    if (surfacePoints.length > 0) {
      const gougeResult = checkCutterGougeAgainstSurface(
        move.position, move.toolAxis, tool, surfacePoints
      );
      if (gougeResult.isGouging) {
        gougeCount++;
        collisionZones.push({
          startIndex: i,
          endIndex: i,
          severity: "gouge",
          description: `Tool gouge at move ${i}: penetration ${gougeResult.penetration.toFixed(3)}mm`,
          maxPenetration: gougeResult.penetration,
          position: gougeResult.position,
        });
      }
      const clearance = tool.cutterDiameter / 2 - gougeResult.penetration;
      if (clearance < minClearance) minClearance = clearance;
    }

    const holderResult = checkHolderCollisionAgainstPart(
      move.position, move.toolAxis, tool, partBounds
    );
    if (holderResult.hasCollision) {
      holderCollisionCount++;
      collisionZones.push({
        startIndex: i,
        endIndex: i,
        severity: holderResult.component === "holder" ? "holder_collision" : "shank_collision",
        description: `${holderResult.component} collision at move ${i}: ${holderResult.penetration.toFixed(2)}mm penetration`,
        maxPenetration: holderResult.penetration,
        position: holderResult.position,
      });
    }

    for (const fixture of fixtures) {
      const fixtureResult = checkFixtureCollision(
        move.position, move.toolAxis, tool, fixture
      );
      if (fixtureResult.hasCollision) {
        fixtureCollisionCount++;
        collisionZones.push({
          startIndex: i,
          endIndex: i,
          severity: "fixture_collision",
          description: `Fixture collision at move ${i}: ${fixtureResult.penetration.toFixed(2)}mm`,
          maxPenetration: fixtureResult.penetration,
          position: fixtureResult.position,
        });
      }
    }

    const axisCheck = checkAxisLimits(move, aLimits, bLimits);
    if (axisCheck.violation) {
      axisLimitViolations++;
      collisionZones.push({
        startIndex: i,
        endIndex: i,
        severity: "axis_limit",
        description: axisCheck.description,
        maxPenetration: 0,
        position: move.position,
      });
    }
  }

  const mergedZones = mergeAdjacentZones(collisionZones);
  const totalCollisions = gougeCount + holderCollisionCount + fixtureCollisionCount + axisLimitViolations;
  const overallStatus: "safe" | "warning" | "critical" =
    gougeCount > 0 || holderCollisionCount > 0 ? "critical" :
    fixtureCollisionCount > 0 || axisLimitViolations > 0 ? "warning" : "safe";

  const summaryParts: string[] = [];
  if (totalCollisions === 0) {
    summaryParts.push("No collisions detected — toolpath is safe");
  } else {
    if (gougeCount > 0) summaryParts.push(`${gougeCount} gouge(s)`);
    if (holderCollisionCount > 0) summaryParts.push(`${holderCollisionCount} holder collision(s)`);
    if (fixtureCollisionCount > 0) summaryParts.push(`${fixtureCollisionCount} fixture collision(s)`);
    if (axisLimitViolations > 0) summaryParts.push(`${axisLimitViolations} axis limit violation(s)`);
  }

  return {
    totalMoves: operation.moves.length,
    checkedMoves: operation.moves.filter(m => m.type === "cut").length,
    collisionCount: totalCollisions,
    gougeCount,
    holderCollisionCount,
    fixtureCollisionCount,
    axisLimitViolations,
    collisionZones: mergedZones,
    minClearance: minClearance === Infinity ? tool.cutterDiameter / 2 : minClearance,
    overallStatus,
    summary: summaryParts.join(", "),
  };
}

function mergeAdjacentZones(zones: CollisionZone[]): CollisionZone[] {
  if (zones.length <= 1) return zones;

  const sorted = [...zones].sort((a, b) => a.startIndex - b.startIndex);
  const merged: CollisionZone[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.severity === last.severity && curr.startIndex - last.endIndex <= 3) {
      last.endIndex = curr.endIndex;
      last.maxPenetration = Math.max(last.maxPenetration, curr.maxPenetration);
      last.description = `${last.severity}: moves ${last.startIndex}-${last.endIndex} (max penetration ${last.maxPenetration.toFixed(3)}mm)`;
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

export function getDefaultToolAssembly(): ToolAssembly {
  return {
    cutterDiameter: 10,
    cutterLength: 25,
    cornerRadius: 0,
    shankDiameter: 10,
    shankLength: 40,
    holderDiameter: 40,
    holderLength: 60,
    gaugeLengthFromSpindle: 125,
  };
}

export function getDefaultPartBounds(): PartBoundingBox {
  return {
    min: { x: -50, y: -50, z: -30 },
    max: { x: 50, y: 50, z: 0 },
  };
}
