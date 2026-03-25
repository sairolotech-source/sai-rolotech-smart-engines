export interface ValidationError {
  field: string;
  value: number | string;
  issue: string;
  corrected?: number | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface FlowerInputs {
  thickness: number;
  numStations: number;
  totalBendAngle: number;
  stripWidth: number;
  materialType: string;
}

export interface FlowerOutputs {
  springbackAngle: number;
  compensatedAngle: number;
  bendAngle: number;
  rollGap: number;
  rollDiameter: number;
  formingForce: number;
  stripWidthAtStation: number;
  thickness: number;
}

const VALID_MATERIALS = ["GI", "CR", "HR", "SS", "AL", "MS", "CU", "TI", "PP", "HSLA"];

const MATERIAL_LIMITS: Record<string, { minT: number; maxT: number; maxBend: number }> = {
  GI:   { minT: 0.3, maxT: 4.0,  maxBend: 180 },
  CR:   { minT: 0.3, maxT: 3.0,  maxBend: 180 },
  HR:   { minT: 0.5, maxT: 6.0,  maxBend: 150 },
  SS:   { minT: 0.3, maxT: 3.0,  maxBend: 120 },
  AL:   { minT: 0.3, maxT: 4.0,  maxBend: 150 },
  MS:   { minT: 0.5, maxT: 5.0,  maxBend: 160 },
  CU:   { minT: 0.3, maxT: 3.0,  maxBend: 180 },
  TI:   { minT: 0.5, maxT: 3.0,  maxBend: 90  },
  PP:   { minT: 1.0, maxT: 6.0,  maxBend: 120 },
  HSLA: { minT: 0.5, maxT: 4.0,  maxBend: 120 },
};

export function validateFlowerInputs(inputs: FlowerInputs): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const mat = inputs.materialType.toUpperCase();

  if (!VALID_MATERIALS.includes(mat)) {
    errors.push({ field: "materialType", value: mat, issue: `Unknown material. Valid: ${VALID_MATERIALS.join(", ")}`, corrected: "GI" });
  }

  const limits = MATERIAL_LIMITS[mat] ?? MATERIAL_LIMITS["GI"]!;

  if (isNaN(inputs.thickness) || inputs.thickness <= 0) {
    errors.push({ field: "thickness", value: inputs.thickness, issue: "Thickness must be > 0", corrected: 1.0 });
  } else if (inputs.thickness < limits.minT) {
    warnings.push({ field: "thickness", value: inputs.thickness, issue: `Below minimum ${limits.minT}mm for ${mat}`, corrected: limits.minT });
  } else if (inputs.thickness > limits.maxT) {
    warnings.push({ field: "thickness", value: inputs.thickness, issue: `Exceeds maximum ${limits.maxT}mm for ${mat} — check machine capacity`, corrected: limits.maxT });
  }

  if (!Number.isFinite(inputs.numStations) || !Number.isInteger(inputs.numStations)) {
    errors.push({ field: "numStations", value: inputs.numStations, issue: "Number of stations must be a finite integer", corrected: 5 });
  } else if (inputs.numStations < 2) {
    warnings.push({ field: "numStations", value: inputs.numStations, issue: "Minimum 2 stations recommended for progressive forming" });
  } else if (inputs.numStations > 30) {
    warnings.push({ field: "numStations", value: inputs.numStations, issue: "More than 30 stations — verify machine capacity" });
  }

  if (inputs.totalBendAngle <= 0) {
    errors.push({ field: "totalBendAngle", value: inputs.totalBendAngle, issue: "Total bend angle must be > 0", corrected: inputs.numStations * 15 });
  } else if (inputs.totalBendAngle > limits.maxBend) {
    warnings.push({ field: "totalBendAngle", value: inputs.totalBendAngle, issue: `Exceeds max ${limits.maxBend}° for ${mat} — risk of cracking` });
  }

  if (inputs.stripWidth <= 0) {
    errors.push({ field: "stripWidth", value: inputs.stripWidth, issue: "Strip width must be > 0", corrected: 100 });
  } else if (inputs.stripWidth < inputs.thickness * 3) {
    warnings.push({ field: "stripWidth", value: inputs.stripWidth, issue: "Strip width less than 3× thickness — check geometry" });
  } else if (inputs.stripWidth > 2000) {
    warnings.push({ field: "stripWidth", value: inputs.stripWidth, issue: "Strip width > 2000mm — verify machine capacity" });
  }

  /**
   * FIX: Angle per station check missing from validateFlowerInputs
   * was: no check for angle/station limit — invalid station counts could go unnoticed
   * now: warns if angle per station exceeds material-specific limit (DIN EN 10162)
   */
  if (inputs.numStations > 0 && inputs.totalBendAngle > 0) {
    const anglePerStation = inputs.totalBendAngle / inputs.numStations;
    const maxAngle =
      mat === "TI"   ? 8  :
      mat === "SS" || mat === "HSLA" ? 10 :
      mat === "PP"   ? 12 :
      15;  // GI/CR/HR/MS/AL/CU default
    if (anglePerStation > maxAngle) {
      warnings.push({
        field: "numStations",
        value: inputs.numStations,
        issue: `Angle per station ${anglePerStation.toFixed(1)}° exceeds max ${maxAngle}° for ${mat} — add ${Math.ceil(inputs.totalBendAngle / maxAngle) - inputs.numStations} more station(s)`,
        corrected: Math.ceil(inputs.totalBendAngle / maxAngle),
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateFlowerOutputs(
  outputs: FlowerOutputs,
  inputs: FlowerInputs,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const t = inputs.thickness;

  if (outputs.springbackAngle < 0 || outputs.springbackAngle > 20) {
    warnings.push({ field: "springbackAngle", value: outputs.springbackAngle, issue: "Springback angle out of typical range 0–20°" });
  }

  if (outputs.compensatedAngle < outputs.bendAngle) {
    errors.push({ field: "compensatedAngle", value: outputs.compensatedAngle, issue: "Compensated angle must be >= bend angle (springback not applied)" });
  }

  const minGap = t * 0.95;
  const maxGap = t * 1.15;
  if (outputs.rollGap < minGap) {
    warnings.push({ field: "rollGap", value: outputs.rollGap, issue: `Roll gap ${outputs.rollGap.toFixed(3)}mm < ${minGap.toFixed(3)}mm (95% of thickness) — risk of over-compression`, corrected: minGap });
  } else if (outputs.rollGap > maxGap) {
    warnings.push({ field: "rollGap", value: outputs.rollGap, issue: `Roll gap ${outputs.rollGap.toFixed(3)}mm > ${maxGap.toFixed(3)}mm (115% of thickness) — may slip`, corrected: maxGap });
  }

  if (outputs.rollDiameter < 60) {
    warnings.push({ field: "rollDiameter", value: outputs.rollDiameter, issue: "Roll diameter < 60mm — very small, verify design" });
  } else if (outputs.rollDiameter > 400) {
    warnings.push({ field: "rollDiameter", value: outputs.rollDiameter, issue: "Roll diameter > 400mm — check machine capacity" });
  }

  if (outputs.formingForce <= 0) {
    errors.push({ field: "formingForce", value: outputs.formingForce, issue: "Forming force must be positive" });
  } else if (outputs.formingForce > 5000) {
    warnings.push({ field: "formingForce", value: outputs.formingForce, issue: "Forming force > 5000 kN — verify machine tonnage" });
  }

  if (outputs.stripWidthAtStation > inputs.stripWidth * 1.01) {
    errors.push({ field: "stripWidthAtStation", value: outputs.stripWidthAtStation, issue: "Strip width at station exceeds blank width — impossible geometry" });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function computeNeutralAxisStripWidth(
  bends: { angle: number; innerRadius: number }[],
  flanges: number[],
  kFactor: number,
  thickness: number,
): number {
  let total = 0;

  for (const flange of flanges) {
    total += Math.max(0, flange);
  }

  for (const bend of bends) {
    const ri = Math.max(0, bend.innerRadius);
    const angle = Math.abs(bend.angle) * (Math.PI / 180);
    const rNeutral = ri + kFactor * thickness;
    total += rNeutral * angle;
  }

  return parseFloat(total.toFixed(3));
}

export function computeSpringback(
  bendAngleDeg: number,
  innerRadius: number,
  thickness: number,
  yieldStrength: number,
  elasticModulus: number,
): { springbackAngle: number; springbackFactor: number } {
  if (thickness <= 0 || elasticModulus <= 0 || yieldStrength <= 0) {
    return { springbackAngle: bendAngleDeg * 0.05, springbackFactor: 1.05 };
  }

  const ri = Math.max(thickness, innerRadius);
  const E = elasticModulus;
  const Sy = yieldStrength;
  const bendAngleRad = bendAngleDeg * (Math.PI / 180);

  // FIX: Removed unused variable `Ri_over_t = ri / thickness` — was declared but never used
  const term = (3 * Sy * ri) / (E * thickness);
  const springbackAngleRad = bendAngleRad * (term / (1 + term));
  const springbackAngleDeg = springbackAngleRad * (180 / Math.PI);

  const factor = 1 + (springbackAngleDeg / Math.max(0.001, bendAngleDeg));

  return {
    springbackAngle: parseFloat(Math.min(20, Math.max(0, springbackAngleDeg)).toFixed(3)),
    springbackFactor: parseFloat(Math.min(1.35, Math.max(1.0, factor)).toFixed(4)),
  };
}

export function computeFormingForce(
  uts: number,
  thickness: number,
  stripWidth: number,
  bendRadius: number,
): number {
  if (thickness <= 0 || stripWidth <= 0 || bendRadius <= 0) return 0;

  const R = Math.max(thickness, bendRadius);
  const F_N = 1.5 * uts * (thickness * thickness) * (stripWidth / 1000) / (2 * (R / 1000));
  const F_kN = F_N / 1000;
  return Math.max(0, parseFloat(F_kN.toFixed(2)));
}

export function sanitizeNumber(val: unknown, fallback: number, min?: number, max?: number): number {
  const n = parseFloat(String(val));
  if (!isFinite(n) || isNaN(n)) return fallback;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}
