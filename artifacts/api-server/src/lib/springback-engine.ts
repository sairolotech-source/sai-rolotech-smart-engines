/**
 * springback-engine.ts — P1.G Springback Compensation Engine
 *
 * Calculates springback for each bend based on:
 *   - Material yield strength (fy) and elastic modulus (E)
 *   - Sheet thickness (t)
 *   - Inside bend radius (ri)
 *   - Target bend angle
 *
 * Springback index: K = 1 - (3 × fy × ri) / (E × t)
 * Required overbend angle: θ_commanded = θ_target / K
 *
 * Reference: Hosford & Caddell, Metal Forming, 4th Ed.
 */

export type MaterialCode = "GI" | "CR" | "HR" | "SS" | "AL" | "MS" | "CU" | "BR";

export interface MaterialProps {
  name: string;
  yieldStrengthMpa: number;
  elasticModulusGpa: number;
  strainHardeningN: number;
  elongationPct: number;
  minBendRadiusFactor: number;
  springbackTypical: string;
}

export const MATERIAL_DATABASE: Record<MaterialCode, MaterialProps> = {
  GI: {
    name: "Galvanized Iron (GI)",
    yieldStrengthMpa: 250,
    elasticModulusGpa: 200,
    strainHardeningN: 0.18,
    elongationPct: 28,
    minBendRadiusFactor: 0.5,
    springbackTypical: "3–6°",
  },
  CR: {
    name: "Cold Rolled Steel (CR)",
    yieldStrengthMpa: 280,
    elasticModulusGpa: 200,
    strainHardeningN: 0.22,
    elongationPct: 32,
    minBendRadiusFactor: 0.5,
    springbackTypical: "4–7°",
  },
  HR: {
    name: "Hot Rolled Steel (HR)",
    yieldStrengthMpa: 250,
    elasticModulusGpa: 195,
    strainHardeningN: 0.15,
    elongationPct: 25,
    minBendRadiusFactor: 1.0,
    springbackTypical: "3–5°",
  },
  SS: {
    name: "Stainless Steel (SS)",
    yieldStrengthMpa: 310,
    elasticModulusGpa: 193,
    strainHardeningN: 0.45,
    elongationPct: 40,
    minBendRadiusFactor: 1.5,
    springbackTypical: "8–15°",
  },
  AL: {
    name: "Aluminium (AL)",
    yieldStrengthMpa: 110,
    elasticModulusGpa: 70,
    strainHardeningN: 0.20,
    elongationPct: 20,
    minBendRadiusFactor: 0.5,
    springbackTypical: "5–10°",
  },
  MS: {
    name: "Mild Steel (MS)",
    yieldStrengthMpa: 250,
    elasticModulusGpa: 200,
    strainHardeningN: 0.20,
    elongationPct: 30,
    minBendRadiusFactor: 0.5,
    springbackTypical: "3–6°",
  },
  CU: {
    name: "Copper (CU)",
    yieldStrengthMpa: 70,
    elasticModulusGpa: 110,
    strainHardeningN: 0.35,
    elongationPct: 45,
    minBendRadiusFactor: 0.3,
    springbackTypical: "2–5°",
  },
  BR: {
    name: "Brass (BR)",
    yieldStrengthMpa: 100,
    elasticModulusGpa: 100,
    strainHardeningN: 0.30,
    elongationPct: 35,
    minBendRadiusFactor: 0.4,
    springbackTypical: "3–6°",
  },
};

export interface BendSpringback {
  bendIndex: number;
  targetAngleDeg: number;
  insideRadiusMm: number;
  springbackAngleDeg: number;
  commandedAngleDeg: number;
  springbackIndexK: number;
  warning?: string;
}

export interface SpringbackResult {
  material: MaterialCode;
  materialProps: MaterialProps;
  thicknessMm: number;
  bends: BendSpringback[];
  overallSpringbackRisk: "low" | "medium" | "high" | "very-high";
  recommendations: string[];
  toleranceNote: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function calculateSpringback(
  material: MaterialCode,
  thicknessMm: number,
  bends: { bendIndex: number; targetAngleDeg: number; insideRadiusMm: number }[],
): SpringbackResult {
  const props = MATERIAL_DATABASE[material] ?? MATERIAL_DATABASE["GI"]!;
  const fy = props.yieldStrengthMpa;
  const E = props.elasticModulusGpa * 1000; // Convert GPa → MPa
  const t = thicknessMm;

  const bendResults: BendSpringback[] = bends.map(b => {
    const ri = Math.max(0.1, b.insideRadiusMm);

    // Springback index: K = 4(fy*ri/E*t)^3 - 3(fy*ri/E*t) + 1  (Wahl-Springborn formula)
    const ratio = (fy * ri) / (E * t);
    const K = clamp(4 * ratio ** 3 - 3 * ratio + 1, 0.5, 0.99);

    // Springback angle
    const θTarget = b.targetAngleDeg;
    const θCommanded = θTarget > 0 ? θTarget / K : 0;
    const springbackAngle = θCommanded - θTarget;

    const warning = ri < props.minBendRadiusFactor * t
      ? `Inside radius ${ri.toFixed(2)} mm < min recommended ${(props.minBendRadiusFactor * t).toFixed(2)} mm — risk of cracking`
      : undefined;

    return {
      bendIndex: b.bendIndex,
      targetAngleDeg: parseFloat(θTarget.toFixed(2)),
      insideRadiusMm: parseFloat(ri.toFixed(3)),
      springbackAngleDeg: parseFloat(springbackAngle.toFixed(2)),
      commandedAngleDeg: parseFloat(θCommanded.toFixed(2)),
      springbackIndexK: parseFloat(K.toFixed(4)),
      warning,
    };
  });

  const maxSpringback = Math.max(...bendResults.map(b => b.springbackAngleDeg), 0);
  let overallRisk: SpringbackResult["overallSpringbackRisk"];
  if (maxSpringback < 3) overallRisk = "low";
  else if (maxSpringback < 7) overallRisk = "medium";
  else if (maxSpringback < 12) overallRisk = "high";
  else overallRisk = "very-high";

  const recommendations: string[] = [];
  if (material === "SS") {
    recommendations.push("SS springback is high — consider dedicated calibration pass");
    recommendations.push("Use overbend + downstream tension to control springback");
  }
  if (material === "AL") {
    recommendations.push("Aluminium springback can vary by temper — verify with trial run");
  }
  if (thicknessMm > 2.0) {
    recommendations.push("Heavy gauge: add extra stabilization passes before calibration");
  }
  if (maxSpringback > 8) {
    recommendations.push("Very high springback — consider die geometry compensation or roll diameter adjustment");
  }
  if (bendResults.some(b => b.warning)) {
    recommendations.push("One or more bends have inside radius below minimum — risk of surface cracking");
  }

  return {
    material,
    materialProps: props,
    thicknessMm,
    bends: bendResults,
    overallSpringbackRisk: overallRisk,
    recommendations,
    toleranceNote: `Typical springback for ${props.name}: ${props.springbackTypical}`,
  };
}
