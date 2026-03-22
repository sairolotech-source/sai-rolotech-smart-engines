export interface Vec3 { x: number; y: number; z: number; }

export interface ToolGeometry {
  holderWidth: number;
  holderHeight: number;
  holderLength: number;
  insertNoseRadius: number;
  insertLength: number;
  insertAngleDeg: number;
}

export interface WorkpieceGeometry {
  stockRadius: number;
  stockLength: number;
  boreDiameter: number;
  chuckLength: number;
  finishRadius: number;
  grooves: Array<{ zCenter: number; depth: number; width: number; radius?: number }>;
}

export interface CollisionResult {
  hasCollision: boolean;
  severity: "none" | "warning" | "critical";
  description: string;
  position?: Vec3;
  type?: "chuck" | "stock" | "bore" | "holder" | "insert_gouge";
}

export function check3DCollision(
  toolPos: Vec3,
  toolGeo: ToolGeometry,
  workpiece: WorkpieceGeometry,
  isRapid: boolean
): CollisionResult {
  const { x, z } = toolPos;
  const { stockRadius, stockLength, boreDiameter, chuckLength, finishRadius, grooves } = workpiece;

  if (x > 0 && z > 0 && z < chuckLength) {
    if (x < stockRadius + toolGeo.holderWidth / 2) {
      return {
        hasCollision: true,
        severity: "critical",
        type: "chuck",
        description: `CRITICAL: Tool holder collision with chuck at Z=${z.toFixed(2)}, X=${x.toFixed(2)}`,
        position: toolPos,
      };
    }
  }

  if (z < 0 && z > -stockLength && x < stockRadius) {
    const radAtZ = getWorkpieceRadiusAtZ(z, workpiece);
    if (x < radAtZ - toolGeo.insertNoseRadius * 0.5 && isRapid) {
      return {
        hasCollision: true,
        severity: "critical",
        type: "stock",
        description: `CRITICAL: Rapid move into stock material at Z=${z.toFixed(2)}, X=${x.toFixed(2)}`,
        position: toolPos,
      };
    }
  }

  if (x < boreDiameter / 2 + toolGeo.insertNoseRadius) {
    return {
      hasCollision: true,
      severity: "critical",
      type: "bore",
      description: `CRITICAL: Tool insert below bore diameter at X=${x.toFixed(2)} (bore⌀=${boreDiameter.toFixed(2)})`,
      position: toolPos,
    };
  }

  for (const g of grooves) {
    const inGrooveZ = Math.abs(z - g.zCenter) <= g.width / 2;
    if (inGrooveZ) {
      const grooveFloor = finishRadius - g.depth;
      if (x < grooveFloor - toolGeo.insertNoseRadius * 0.3) {
        return {
          hasCollision: true,
          severity: "critical",
          type: "insert_gouge",
          description: `CRITICAL: Insert gouge — over-cut in groove at Z=${g.zCenter.toFixed(1)} by ${(grooveFloor - x).toFixed(2)}mm`,
          position: toolPos,
        };
      }
      if (x < grooveFloor + 0.5) {
        return {
          hasCollision: true,
          severity: "warning",
          type: "insert_gouge",
          description: `WARNING: Insert approaching groove floor limit (${(x - grooveFloor).toFixed(2)}mm clearance)`,
          position: toolPos,
        };
      }
    }
  }

  const holderClearanceX = x + toolGeo.holderWidth;
  if (holderClearanceX < stockRadius + 2) {
    return {
      hasCollision: true,
      severity: "warning",
      type: "holder",
      description: `WARNING: Holder body close to workpiece — only ${(holderClearanceX - stockRadius).toFixed(1)}mm clearance`,
      position: toolPos,
    };
  }

  if (toolGeo.insertNoseRadius > 0) {
    const minAllowedLength = Math.sqrt(
      Math.pow(toolGeo.insertNoseRadius, 2) -
      Math.pow(Math.min(toolGeo.insertNoseRadius, 0.5), 2)
    );
    if (minAllowedLength > toolGeo.insertLength * 0.8) {
      return {
        hasCollision: true,
        severity: "warning",
        type: "insert_gouge",
        description: `WARNING: Segment length may cause nose radius gouge — consider smaller nose radius`,
        position: toolPos,
      };
    }
  }

  return { hasCollision: false, severity: "none", description: "OK" };
}

export function getWorkpieceRadiusAtZ(
  z: number,
  workpiece: WorkpieceGeometry
): number {
  let r = workpiece.finishRadius;
  for (const g of workpiece.grooves) {
    const dist = Math.abs(z - g.zCenter);
    if (dist <= g.width / 2) {
      const blend = g.radius ? Math.max(0, 1 - (g.width / 2 - dist) / g.radius) : 1;
      r = Math.min(r, workpiece.finishRadius - g.depth * (1 - blend));
    }
  }
  return Math.max(r, workpiece.boreDiameter / 2);
}

export function runFullPreFlightCheck(
  moves: Array<{ x: number; z: number; type: "rapid" | "cut" }>,
  toolGeo: ToolGeometry,
  workpiece: WorkpieceGeometry
): CollisionResult[] {
  const results: CollisionResult[] = [];

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const result = check3DCollision(
      { x: m.x, y: 0, z: m.z },
      toolGeo,
      workpiece,
      m.type === "rapid"
    );
    if (result.hasCollision) {
      results.push({ ...result, description: `Move ${i + 1}: ${result.description}` });
    }
  }

  const cutMoves = moves.filter(m => m.type === "cut");
  if (cutMoves.length > 0) {
    const zPositions = cutMoves.map(m => m.z);
    const minZ = Math.min(...zPositions);
    const maxZ = Math.max(...zPositions);
    const coverage = (maxZ - minZ) / workpiece.stockLength * 100;
    if (coverage < 40) {
      results.push({
        hasCollision: false,
        severity: "warning",
        description: `WARNING: Toolpath only covers ${coverage.toFixed(0)}% of stock length — verify full machining coverage`,
      });
    }
  }

  const rapidIntoStock = moves.filter(m => {
    if (m.type !== "rapid") return false;
    if (m.z < 0 && m.z > -workpiece.stockLength) {
      return m.x < workpiece.stockRadius;
    }
    return false;
  });

  if (rapidIntoStock.length > 0) {
    results.push({
      hasCollision: true,
      severity: "critical",
      type: "stock",
      description: `CRITICAL: ${rapidIntoStock.length} rapid move(s) pass through stock — immediate crash risk`,
    });
  }

  return results;
}

export function computeRestMachiningStock(
  moves: Array<{ x: number; z: number; type: "rapid" | "cut" }>,
  workpiece: WorkpieceGeometry,
  numSectors: number = 200
): number[] {
  const stock = Array(numSectors).fill(workpiece.stockRadius);
  const dZ = workpiece.stockLength / numSectors;

  for (const m of moves) {
    if (m.type !== "cut") continue;
    const sector = Math.floor(Math.abs(m.z) / dZ);
    if (sector >= 0 && sector < numSectors) {
      stock[sector] = Math.min(stock[sector], Math.max(m.x, workpiece.boreDiameter / 2));
    }
  }

  for (let i = 1; i < numSectors - 1; i++) {
    stock[i] = Math.min(stock[i], (stock[i - 1] + stock[i] + stock[i + 1]) / 3 + 0.2);
  }

  return stock;
}

export interface MillingToolGeometry {
  toolDiameter: number;
  fluteLength: number;
  overallLength: number;
  holderDiameter: number;
  holderLength: number;
  shankDiameter: number;
  toolType: "end_mill" | "face_mill" | "ball_nose" | "drill";
  cornerRadius?: number;
}

export interface MillingStockGeometry {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  originX: number;
  originY: number;
  originZ: number;
}

export interface FixtureZone {
  id: string;
  label: string;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export type MillingCollisionType =
  | "holder_workpiece"
  | "holder_fixture"
  | "tool_fixture"
  | "rapid_interference"
  | "plunge_warning"
  | "depth_exceeded"
  | "table_collision";

export interface MillingCollisionResult {
  hasCollision: boolean;
  severity: "none" | "warning" | "critical";
  description: string;
  position?: Vec3;
  type?: MillingCollisionType;
}

export function checkMillingCollision(
  toolPos: Vec3,
  toolGeo: MillingToolGeometry,
  stock: MillingStockGeometry,
  heightmap: Float32Array | null,
  hmResolution: number,
  fixtures: FixtureZone[],
  isRapid: boolean,
  prevPos?: Vec3
): MillingCollisionResult {
  const { x, y, z } = toolPos;
  const toolR = toolGeo.toolDiameter / 2;
  const holderR = toolGeo.holderDiameter / 2;

  const stockMinX = stock.originX;
  const stockMaxX = stock.originX + stock.sizeX;
  const stockMinZ = stock.originZ;
  const stockMaxZ = stock.originZ + stock.sizeZ;
  const stockTop = stock.originY + stock.sizeY;

  if (y < stock.originY - toolGeo.fluteLength) {
    return {
      hasCollision: true,
      severity: "critical",
      type: "table_collision",
      description: `CRITICAL: Tool below machine table at Y=${y.toFixed(2)}`,
      position: toolPos,
    };
  }

  if (
    isRapid &&
    x >= stockMinX - toolR &&
    x <= stockMaxX + toolR &&
    z >= stockMinZ - toolR &&
    z <= stockMaxZ + toolR
  ) {
    const stockH = heightmap ? getHeightmapValueAt(heightmap, hmResolution, stock, x, z) : stockTop;

    if (y < stockH) {
      return {
        hasCollision: true,
        severity: "critical",
        type: "rapid_interference",
        description: `CRITICAL: Rapid move into material at X=${x.toFixed(2)} Y=${y.toFixed(2)} Z=${z.toFixed(2)} (surface at Y=${stockH.toFixed(2)})`,
        position: toolPos,
      };
    }
  }

  const holderBottomY = y + toolGeo.fluteLength + (toolGeo.overallLength - toolGeo.fluteLength);
  const holderTopY = holderBottomY + toolGeo.holderLength;

  if (
    x >= stockMinX - holderR &&
    x <= stockMaxX + holderR &&
    z >= stockMinZ - holderR &&
    z <= stockMaxZ + holderR
  ) {
    const stockH = heightmap ? getHeightmapValueAt(heightmap, hmResolution, stock, x, z) : stockTop;
    const holderClearance = (y + toolGeo.overallLength - toolGeo.fluteLength) - stockH;
    if (holderClearance < 0) {
      return {
        hasCollision: true,
        severity: "critical",
        type: "holder_workpiece",
        description: `CRITICAL: Holder collision with workpiece (${Math.abs(holderClearance).toFixed(1)}mm penetration)`,
        position: toolPos,
      };
    }
    if (holderClearance < 3) {
      return {
        hasCollision: true,
        severity: "warning",
        type: "holder_workpiece",
        description: `WARNING: Holder close to workpiece — only ${holderClearance.toFixed(1)}mm clearance`,
        position: toolPos,
      };
    }
  }

  for (const fix of fixtures) {
    const withinFixX = x + toolR >= fix.minX && x - toolR <= fix.maxX;
    const withinFixZ = z + toolR >= fix.minZ && z - toolR <= fix.maxZ;
    const withinFixY = y <= fix.maxY && y + toolGeo.fluteLength >= fix.minY;

    if (withinFixX && withinFixZ && withinFixY) {
      return {
        hasCollision: true,
        severity: "critical",
        type: "tool_fixture",
        description: `CRITICAL: Tool collision with fixture "${fix.label}" at X=${x.toFixed(1)} Z=${z.toFixed(1)}`,
        position: toolPos,
      };
    }

    const holderInFixX = x + holderR >= fix.minX && x - holderR <= fix.maxX;
    const holderInFixZ = z + holderR >= fix.minZ && z - holderR <= fix.maxZ;
    const holderInFixY =
      holderBottomY <= fix.maxY && holderTopY >= fix.minY;

    if (holderInFixX && holderInFixZ && holderInFixY) {
      return {
        hasCollision: true,
        severity: "critical",
        type: "holder_fixture",
        description: `CRITICAL: Holder collision with fixture "${fix.label}"`,
        position: toolPos,
      };
    }
  }

  if (
    prevPos &&
    !isRapid &&
    Math.abs(x - prevPos.x) < 0.01 &&
    Math.abs(z - prevPos.z) < 0.01 &&
    y < prevPos.y
  ) {
    const plungeDepth = prevPos.y - y;
    if (plungeDepth > toolGeo.toolDiameter * 2 && toolGeo.toolType !== "drill") {
      return {
        hasCollision: true,
        severity: "warning",
        type: "plunge_warning",
        description: `WARNING: Deep plunge (${plungeDepth.toFixed(1)}mm) with ${toolGeo.toolType} — consider ramping or helical entry`,
        position: toolPos,
      };
    }
  }

  return { hasCollision: false, severity: "none", description: "OK" };
}

function getHeightmapValueAt(
  heightmap: Float32Array,
  resolution: number,
  stock: MillingStockGeometry,
  worldX: number,
  worldZ: number
): number {
  const u = (worldX - stock.originX) / stock.sizeX;
  const v = (worldZ - stock.originZ) / stock.sizeZ;
  const ix = Math.floor(u * (resolution - 1));
  const iz = Math.floor(v * (resolution - 1));

  if (ix < 0 || ix >= resolution || iz < 0 || iz >= resolution) {
    return stock.originY;
  }

  return heightmap[iz * resolution + ix];
}

export function runMillingPreFlightCheck(
  moves: Array<{ x: number; y: number; z: number; type: "rapid" | "cut" }>,
  toolGeo: MillingToolGeometry,
  stock: MillingStockGeometry,
  fixtures: FixtureZone[]
): MillingCollisionResult[] {
  const results: MillingCollisionResult[] = [];

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const prev = i > 0 ? moves[i - 1] : undefined;
    const result = checkMillingCollision(
      { x: m.x, y: m.y, z: m.z },
      toolGeo,
      stock,
      null,
      0,
      fixtures,
      m.type === "rapid",
      prev ? { x: prev.x, y: prev.y, z: prev.z } : undefined
    );
    if (result.hasCollision) {
      results.push({
        ...result,
        description: `Move ${i + 1}: ${result.description}`,
      });
    }
  }

  const rapidMoves = moves.filter((m) => m.type === "rapid");
  const dangerousRapids = rapidMoves.filter((m) => {
    return (
      m.x >= stock.originX &&
      m.x <= stock.originX + stock.sizeX &&
      m.z >= stock.originZ &&
      m.z <= stock.originZ + stock.sizeZ &&
      m.y < stock.originY + stock.sizeY
    );
  });

  if (dangerousRapids.length > 0) {
    results.push({
      hasCollision: true,
      severity: "critical",
      type: "rapid_interference",
      description: `CRITICAL: ${dangerousRapids.length} rapid move(s) pass through stock envelope — crash risk`,
    });
  }

  return results;
}
