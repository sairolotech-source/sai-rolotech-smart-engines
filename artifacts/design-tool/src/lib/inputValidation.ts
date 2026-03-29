/**
 * SAI Rolotech — Engineering Input Validation (Phase 5)
 * Real-world roll forming constraints applied before any calculation.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RollFormingInputs {
  thickness?: number;
  materialType?: string;
  bendAngles?: number[];
  numStations?: number;
  rollDiameter?: number;
  lineSpeed?: number;
  geometryLoaded?: boolean;
  bendCount?: number;
  profileWidth?: number;
}

const VALID_MATERIALS = ["GI", "CR", "HR", "SS", "AL", "MS", "CU", "TI", "PP", "HSLA"];

const MIN_RADIUS_FACTOR: Record<string, number> = {
  GI: 1.0, CR: 1.2, HR: 0.8, SS: 1.5, AL: 0.5, MS: 0.8,
  CU: 0.5, TI: 2.0, PP: 1.0, HSLA: 1.5,
};

/** Validate all inputs before sending to calculation engines. */
export function validateRollFormingInputs(inputs: RollFormingInputs): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Thickness
  if (inputs.thickness === undefined || inputs.thickness === null) {
    errors.push("Material thickness is required.");
  } else if (inputs.thickness <= 0) {
    errors.push("Material thickness must be greater than 0 mm.");
  } else if (inputs.thickness < 0.3) {
    warnings.push(`Thickness ${inputs.thickness}mm is very thin — check material spec.`);
  } else if (inputs.thickness > 12) {
    warnings.push(`Thickness ${inputs.thickness}mm is heavy gauge — verify roll capacity.`);
  }

  // Material
  if (!inputs.materialType) {
    errors.push("Material type must be selected.");
  } else if (!VALID_MATERIALS.includes(inputs.materialType)) {
    errors.push(`Unknown material "${inputs.materialType}". Select from: ${VALID_MATERIALS.join(", ")}.`);
  }

  // Geometry
  if (!inputs.geometryLoaded) {
    errors.push("No profile geometry loaded. Upload a DXF file or draw a profile first.");
  }

  // Bend angles
  if (Array.isArray(inputs.bendAngles)) {
    inputs.bendAngles.forEach((angle, i) => {
      if (isNaN(angle)) {
        errors.push(`Bend #${i + 1}: angle is not a valid number.`);
      } else if (angle < 0 || angle > 180) {
        errors.push(`Bend #${i + 1}: angle ${angle}° is out of range (0–180°).`);
      } else if (angle > 135) {
        warnings.push(`Bend #${i + 1}: angle ${angle}° is extreme — consider splitting into two passes.`);
      }
    });
  }

  // Stations
  if (inputs.numStations !== undefined) {
    if (inputs.numStations < 2) {
      errors.push("Minimum 2 forming stations required.");
    } else if (inputs.numStations > 32) {
      warnings.push(`${inputs.numStations} stations is unusually high — verify machine capacity.`);
    }

    // Gradual bending check — no more than 30° per station
    if (Array.isArray(inputs.bendAngles) && inputs.numStations > 0) {
      const totalAngle = inputs.bendAngles.reduce((s, a) => s + Math.abs(a), 0);
      const anglePerStation = totalAngle / inputs.numStations;
      if (anglePerStation > 30) {
        warnings.push(`Average ${anglePerStation.toFixed(1)}°/station — gradual bending (≤30°/station) is recommended.`);
      }
    }
  }

  // Roll diameter
  if (inputs.rollDiameter !== undefined) {
    if (inputs.rollDiameter < 50) {
      errors.push("Roll diameter too small — minimum 50mm.");
    } else if (inputs.rollDiameter > 500) {
      warnings.push(`Roll diameter ${inputs.rollDiameter}mm is very large — check machine spec.`);
    }

    // Min radius vs thickness
    if (inputs.thickness && inputs.materialType) {
      const factor = MIN_RADIUS_FACTOR[inputs.materialType] ?? 1.0;
      const minRadius = factor * inputs.thickness;
      const rollRadius = inputs.rollDiameter / 2;
      if (rollRadius < minRadius) {
        errors.push(
          `Roll radius ${rollRadius.toFixed(1)}mm is below minimum bend radius ${minRadius.toFixed(1)}mm for ${inputs.materialType} at ${inputs.thickness}mm. Risk of cracking.`
        );
      }
    }
  }

  // Line speed
  if (inputs.lineSpeed !== undefined) {
    if (inputs.lineSpeed <= 0) {
      errors.push("Line speed must be greater than 0 m/min.");
    } else if (inputs.lineSpeed > 60) {
      warnings.push(`Line speed ${inputs.lineSpeed} m/min is very high — verify coil brake and straightener capacity.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/** Validate that geometry has not degenerated (all zero-length segments, etc.) */
export function validateGeometryIntegrity(segments: { startX: number; startY: number; endX: number; endY: number }[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!segments || segments.length === 0) {
    errors.push("Profile has no segments — geometry is empty.");
    return { valid: false, errors, warnings };
  }

  let zeroLengthCount = 0;
  for (const seg of segments) {
    const len = Math.hypot(seg.endX - seg.startX, seg.endY - seg.startY);
    if (len < 0.001) zeroLengthCount++;
  }

  if (zeroLengthCount === segments.length) {
    errors.push("All segments have zero length — profile is degenerate.");
  } else if (zeroLengthCount > 0) {
    warnings.push(`${zeroLengthCount} zero-length segment(s) detected — may affect calculations.`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
