export interface ToolpathMove {
  x: number;
  z: number;
  type: "rapid" | "cut";
  feedRate?: number;
  spindleRpm?: number;
  strategy?: string;
}

export interface RollProfile {
  stockRadius: number;
  finishRadius: number;
  stockLength: number;
  boreDiameter: number;
  grooves: Array<{ zCenter: number; depth: number; width: number; radius?: number; cornerR?: number }>;
}

export interface CuttingParams {
  material: string;
  vc: number;
  roughFeed: number;
  finishFeed: number;
  groovedFeed: number;
  radialDoc: number;
  axialDoc: number;
  noseRadius: number;
  safeX: number;
  safeZ: number;
}

const MATERIAL_PARAMS: Record<string, { vc: number; roughFeed: number; finishFeed: number; groovedFeed: number; radialDoc: number }> = {
  MS:        { vc: 150, roughFeed: 0.25, finishFeed: 0.08, groovedFeed: 0.05, radialDoc: 2.5 },
  SS:        { vc: 90,  roughFeed: 0.15, finishFeed: 0.06, groovedFeed: 0.03, radialDoc: 1.5 },
  AL:        { vc: 350, roughFeed: 0.30, finishFeed: 0.12, groovedFeed: 0.08, radialDoc: 3.0 },
  GI:        { vc: 120, roughFeed: 0.22, finishFeed: 0.08, groovedFeed: 0.04, radialDoc: 2.0 },
  CR:        { vc: 160, roughFeed: 0.25, finishFeed: 0.08, groovedFeed: 0.05, radialDoc: 2.5 },
  HR:        { vc: 130, roughFeed: 0.25, finishFeed: 0.08, groovedFeed: 0.05, radialDoc: 3.0 },
  TI:        { vc: 50,  roughFeed: 0.08, finishFeed: 0.04, groovedFeed: 0.02, radialDoc: 0.8 },
  CU:        { vc: 250, roughFeed: 0.25, finishFeed: 0.10, groovedFeed: 0.06, radialDoc: 2.5 },
  CAST_IRON: { vc: 100, roughFeed: 0.30, finishFeed: 0.10, groovedFeed: 0.06, radialDoc: 3.5 },
  HSLA:      { vc: 100, roughFeed: 0.18, finishFeed: 0.07, groovedFeed: 0.04, radialDoc: 1.5 },
};

function getRpm(vc: number, diameter: number): number {
  return Math.round((vc * 1000) / (Math.PI * diameter));
}

export function generateAdaptiveRoughingPass(
  profile: RollProfile,
  params: CuttingParams,
  stockRemaining: number[]
): ToolpathMove[] {
  const moves: ToolpathMove[] = [];
  const { stockRadius, finishRadius, stockLength, boreDiameter } = profile;
  const { safeX, safeZ, radialDoc } = params;
  const totalAllowance = stockRadius - finishRadius;
  const passes = Math.ceil(totalAllowance / radialDoc);
  const zStart = -safeZ;
  const zEnd = -stockLength + safeZ;

  moves.push({ x: safeX, z: safeZ, type: "rapid" });

  for (let pass = 0; pass < passes; pass++) {
    const targetR = stockRadius - (pass + 1) * radialDoc;
    const currentR = Math.max(targetR, finishRadius + 0.3);
    const diameter = currentR * 2;
    const rpm = getRpm(params.vc, diameter);

    const adaptiveFeed = params.roughFeed * (1 + pass * 0.02);

    moves.push({
      x: currentR + 1, z: zStart, type: "rapid",
      strategy: "adaptive_rough",
    });
    moves.push({
      x: currentR, z: zStart, type: "cut",
      feedRate: adaptiveFeed, spindleRpm: rpm,
      strategy: "adaptive_rough",
    });

    let z = zStart;
    while (z > zEnd) {
      const grooveHere = profile.grooves.find(g => Math.abs(z - g.zCenter) < g.width / 2 + 2);
      const stepSize = grooveHere ? params.axialDoc * 0.5 : params.axialDoc;
      z = Math.max(z - stepSize, zEnd);

      const zSectorIdx = Math.floor(Math.abs(z) / (stockLength / (stockRemaining.length || 1)));
      const localStock = stockRemaining[Math.min(zSectorIdx, stockRemaining.length - 1)] ?? stockRadius;
      const localR = Math.min(currentR, localStock - 0.05);

      moves.push({
        x: Math.max(localR, finishRadius + 0.2), z,
        type: "cut",
        feedRate: adaptiveFeed,
        spindleRpm: rpm,
        strategy: "adaptive_rough",
      });
    }

    moves.push({ x: currentR + 2, z, type: "rapid" });
  }

  return moves;
}

export function generateTrochoidalGrooving(
  groove: { zCenter: number; depth: number; width: number; radius?: number },
  finishRadius: number,
  params: CuttingParams,
  material: string
): ToolpathMove[] {
  const moves: ToolpathMove[] = [];
  const mParams = MATERIAL_PARAMS[material] || MATERIAL_PARAMS.MS;
  const grooveFloor = finishRadius - groove.depth;
  const grooveWidth = groove.width;
  const cornerR = groove.radius ?? 1;

  const steps = Math.ceil(groove.depth / 1.0);
  const diameter = finishRadius * 2;
  const rpm = getRpm(mParams.vc * 0.7, diameter);

  moves.push({ x: finishRadius + params.safeX * 0.5, z: groove.zCenter + grooveWidth * 0.6, type: "rapid" });

  for (let step = 1; step <= steps; step++) {
    const targetX = finishRadius - (step / steps) * groove.depth;
    const currentX = Math.max(targetX, grooveFloor + 0.05);

    for (let side = -1; side <= 1; side += 2) {
      const startZ = groove.zCenter + side * grooveWidth * 0.45;
      const endZ = groove.zCenter - side * grooveWidth * 0.45;

      moves.push({ x: currentX + 0.5, z: startZ, type: "rapid" });
      moves.push({
        x: currentX, z: startZ,
        type: "cut", feedRate: mParams.groovedFeed, spindleRpm: rpm,
        strategy: "trochoidal_groove",
      });

      const trochoidSteps = 8;
      for (let t = 0; t <= trochoidSteps; t++) {
        const tFrac = t / trochoidSteps;
        const tZ = startZ + (endZ - startZ) * tFrac;
        const oscillation = Math.sin(tFrac * Math.PI * 3) * 0.3;
        moves.push({
          x: currentX + oscillation, z: tZ,
          type: "cut", feedRate: mParams.groovedFeed * 1.2, spindleRpm: rpm,
          strategy: "trochoidal_groove",
        });
      }

      moves.push({ x: currentX + 1, z: endZ, type: "rapid" });
    }

    if (cornerR > 0 && step === steps) {
      const arcSteps = 6;
      for (let arc = 0; arc <= arcSteps; arc++) {
        const angle = (arc / arcSteps) * (Math.PI / 2);
        const zOff = cornerR * Math.sin(angle);
        const xOff = cornerR * (1 - Math.cos(angle));
        moves.push({
          x: grooveFloor + xOff, z: groove.zCenter - grooveWidth / 2 + zOff,
          type: "cut", feedRate: mParams.groovedFeed * 0.7, spindleRpm: rpm,
          strategy: "corner_blend",
        });
      }
    }
  }

  return moves;
}

export function generateFinishPass(
  profile: RollProfile,
  params: CuttingParams,
  material: string
): ToolpathMove[] {
  const moves: ToolpathMove[] = [];
  const mParams = MATERIAL_PARAMS[material] || MATERIAL_PARAMS.MS;
  const { finishRadius, stockLength, grooves } = profile;
  const zStart = -params.safeZ;
  const zEnd = -stockLength + params.safeZ;
  const rpm = getRpm(mParams.vc * 1.1, finishRadius * 2);

  moves.push({ x: finishRadius + 2, z: zStart, type: "rapid" });
  moves.push({
    x: finishRadius, z: zStart,
    type: "cut", feedRate: mParams.finishFeed, spindleRpm: rpm,
    strategy: "finish_g70",
  });

  const zPoints: number[] = [zStart];
  for (const g of grooves.sort((a, b) => a.zCenter - b.zCenter)) {
    zPoints.push(g.zCenter + g.width / 2 + 0.5);
    zPoints.push(g.zCenter - g.width / 2 - 0.5);
  }
  zPoints.push(zEnd);

  for (let i = 1; i < zPoints.length; i++) {
    const z = zPoints[i];
    const inGroove = grooves.find(g => Math.abs(z - g.zCenter) < g.width / 2);
    const targetX = inGroove ? finishRadius - inGroove.depth : finishRadius;

    if (inGroove) {
      const gSteps = 4;
      for (let s = 0; s <= gSteps; s++) {
        const tZ = zPoints[i - 1] + (z - zPoints[i - 1]) * (s / gSteps);
        const tX = finishRadius + (targetX - finishRadius) * (s / gSteps);
        moves.push({
          x: tX, z: tZ,
          type: "cut", feedRate: mParams.groovedFeed, spindleRpm: rpm,
          strategy: "finish_groove_blend",
        });
      }
    } else {
      moves.push({
        x: targetX, z,
        type: "cut", feedRate: mParams.finishFeed, spindleRpm: rpm,
        strategy: "finish_g70",
      });
    }
  }

  moves.push({ x: finishRadius + params.safeX, z: zEnd, type: "rapid" });

  return moves;
}

export function generateFullRollCamProgram(
  profile: RollProfile,
  material: string,
  noseRadius: number = 0.8,
  safeX: number = 10,
  safeZ: number = 5
): { moves: ToolpathMove[]; estimatedCycleTimeSec: number; operations: string[] } {
  const mParams = MATERIAL_PARAMS[material] || MATERIAL_PARAMS.MS;
  const params: CuttingParams = {
    material,
    vc: mParams.vc,
    roughFeed: mParams.roughFeed,
    finishFeed: mParams.finishFeed,
    groovedFeed: mParams.groovedFeed,
    radialDoc: mParams.radialDoc,
    axialDoc: mParams.vc > 200 ? 5 : 3,
    noseRadius,
    safeX,
    safeZ,
  };

  const emptyStock = Array(200).fill(profile.stockRadius);
  const allMoves: ToolpathMove[] = [];
  const operations: string[] = [];

  allMoves.push({ x: safeX + profile.stockRadius, z: safeZ, type: "rapid" });

  const faceSteps = 3;
  const rpm0 = getRpm(mParams.vc, profile.stockRadius * 2);
  operations.push("OP10: Face");
  for (let f = 0; f <= faceSteps; f++) {
    const fZ = -f * 1.5;
    allMoves.push({ x: profile.stockRadius + 2, z: fZ, type: f === 0 ? "rapid" : "cut", feedRate: mParams.roughFeed * 1.2, spindleRpm: rpm0, strategy: "face" });
    allMoves.push({ x: 0, z: fZ, type: "cut", feedRate: mParams.roughFeed * 1.2, spindleRpm: rpm0, strategy: "face" });
    allMoves.push({ x: profile.stockRadius + 2, z: fZ, type: "rapid" });
  }

  operations.push("OP20: OD Adaptive Roughing");
  const roughMoves = generateAdaptiveRoughingPass(profile, params, emptyStock);
  allMoves.push(...roughMoves);

  operations.push("OP30: Trochoidal Grooving");
  for (const g of profile.grooves) {
    const grooveMoves = generateTrochoidalGrooving(g, profile.finishRadius, params, material);
    allMoves.push(...grooveMoves);
  }

  operations.push("OP40: OD Finish (G70)");
  const finishMoves = generateFinishPass(profile, params, material);
  allMoves.push(...finishMoves);

  if (profile.boreDiameter > 20) {
    operations.push("OP50: Bore Finish");
    const boreRpm = getRpm(mParams.vc * 0.8, profile.boreDiameter);
    allMoves.push({ x: profile.boreDiameter / 2 + 2, z: safeZ, type: "rapid" });
    allMoves.push({ x: profile.boreDiameter / 2, z: safeZ, type: "cut", feedRate: mParams.finishFeed * 0.8, spindleRpm: boreRpm, strategy: "bore" });
    allMoves.push({ x: profile.boreDiameter / 2, z: -profile.stockLength + safeZ, type: "cut", feedRate: mParams.finishFeed * 0.8, spindleRpm: boreRpm, strategy: "bore" });
    allMoves.push({ x: profile.boreDiameter / 2 + 2, z: -profile.stockLength + safeZ, type: "rapid" });
  }

  allMoves.push({ x: safeX + profile.stockRadius + 20, z: safeZ + 10, type: "rapid" });

  const totalCutLength = allMoves.reduce((acc, m, i) => {
    if (i === 0 || m.type !== "cut") return acc;
    const prev = allMoves[i - 1];
    const dist = Math.sqrt(Math.pow(m.x - prev.x, 2) + Math.pow(m.z - prev.z, 2));
    return acc + dist;
  }, 0);

  const estimatedCycleTimeSec = totalCutLength / (mParams.roughFeed * 300) * 60;

  return { moves: allMoves, estimatedCycleTimeSec, operations };
}

export function getMaterialParams(material: string) {
  return MATERIAL_PARAMS[material] || MATERIAL_PARAMS.MS;
}
