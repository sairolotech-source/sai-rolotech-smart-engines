export type DefectId =
  | "bow" | "twist" | "camber" | "edge_wave" | "oil_can" | "springback"
  | "surface_scratch" | "flange_crack" | "roll_wear" | "strip_break"
  | "poor_weld" | "dimensional";

export interface DiagnosisInput {
  defectId: DefectId;
  material?: string;
  thickness?: number;
  speed?: number;
  station?: number;
  stationCount?: number;
  rollDiameter?: number;
}

export interface DiagnosisResult {
  defectId: DefectId;
  defectName: string;
  rootCauses: string[];
  corrections: { action: string; station?: number; adjustment: string; priority: "critical" | "major" | "minor" }[];
  preventionTips: string[];
  accuracyScore: number;
}

const DEFECT_DB: Record<DefectId, { name: string; causes: string[]; tips: string[] }> = {
  bow: {
    name: "Longitudinal Bow",
    causes: ["Pass line misalignment", "Uneven roll pressure", "Inconsistent material thickness", "Asymmetric forming forces"],
    tips: ["Use laser alignment tools", "Check roll concentricity monthly", "Verify strip tension uniformity"],
  },
  twist: {
    name: "Profile Twist",
    causes: ["Roll asymmetry", "Bearing preload mismatch", "Side guide misalignment", "Material width variation"],
    tips: ["Check roll symmetry with CMM", "Replace worn bearings", "Align side guides precisely"],
  },
  camber: {
    name: "Horizontal Camber",
    causes: ["Unequal left/right forming forces", "Material edge stress differential", "Worn side guides"],
    tips: ["Balance roll pressures", "Check material coil camber", "Adjust forming symmetry"],
  },
  edge_wave: {
    name: "Edge Wave / Flare",
    causes: ["Excessive edge strain", "Forming speed too high", "Insufficient strip tension", "Edge conditioning needed"],
    tips: ["Reduce line speed by 10-15%", "Add pre-notch or edge conditioning", "Check strip tension"],
  },
  oil_can: {
    name: "Oil Canning / Buckle",
    causes: ["Thin material web buckling", "Insufficient cross-sectional stiffness", "High compressive stress"],
    tips: ["Add longitudinal ribs", "Use higher material grade", "Reduce web flat area"],
  },
  springback: {
    name: "Excessive Springback",
    causes: ["Insufficient overbend compensation", "Wrong K-factor", "Material variation", "Worn tooling"],
    tips: ["Increase overbend by 5-8°", "Recalculate K-factor from coupon test", "Check tooling wear"],
  },
  surface_scratch: {
    name: "Surface Scratch / Mark",
    causes: ["Contaminated rolls", "Sharp roll edges", "Inadequate lubrication", "Roll surface roughness"],
    tips: ["Clean rolls every shift", "Polish roll edges to R0.5", "Use proper forming lubricant"],
  },
  flange_crack: {
    name: "Flange Cracking",
    causes: ["Excessive bend angle per station", "Material brittleness", "Small bend radius", "Low temperature forming"],
    tips: ["Reduce angle per station below 12°", "Increase bend radius", "Warm form if <10°C"],
  },
  roll_wear: {
    name: "Roll Tooling Wear",
    causes: ["Abrasive material", "Insufficient lubrication", "Improper roll hardness", "Overloading"],
    tips: ["Use D2 or D3 tool steel", "Apply TiN coating", "Check roll gap settings"],
  },
  strip_break: {
    name: "Strip Break / Fracture",
    causes: ["Material defect", "Excessive forming force", "Sharp tool edge", "Material end not chamfered"],
    tips: ["Inspect coil quality", "Reduce forming speed at entry", "Chamfer strip edges"],
  },
  poor_weld: {
    name: "Poor Weld Seam (HF/ERW)",
    causes: ["Incorrect fin pass pressure", "Weld frequency mismatch", "Fin angle error", "Speed variation"],
    tips: ["Calibrate fin pass rolls", "Maintain constant weld frequency", "Monitor line speed"],
  },
  dimensional: {
    name: "Dimensional Out-of-Tolerance",
    causes: ["Thermal expansion", "Roll wear", "Incorrect roll gap", "Strip width variation"],
    tips: ["Measure at operating temperature", "Adjust roll gap every 4 hours", "Verify strip width"],
  },
};

export function diagnose(input: DiagnosisInput): DiagnosisResult {
  const defect = DEFECT_DB[input.defectId];
  if (!defect) throw new Error(`Unknown defect ID: ${input.defectId}`);

  const mat = (input.material ?? "GI").toUpperCase();
  const station = input.station ?? 1;
  const stationCount = input.stationCount ?? 8;

  const corrections: DiagnosisResult["corrections"] = [
    {
      action: `Inspect station ${station} roll alignment`,
      station,
      adjustment: "Re-align using laser tool, tolerance ±0.05mm",
      priority: "critical",
    },
    {
      action: `Check forming angle at station ${station}`,
      station,
      adjustment: mat === "SS" ? "Reduce to max 10°/station" : "Reduce to max 15°/station",
      priority: "major",
    },
    {
      action: `Review material ${mat} springback factor`,
      adjustment: mat === "SS" ? "Apply 20% overbend" : mat === "AL" ? "Apply 15% overbend" : "Apply 6-8% overbend",
      priority: "minor",
    },
  ];

  return {
    defectId: input.defectId,
    defectName: defect.name,
    rootCauses: defect.causes,
    corrections,
    preventionTips: defect.tips,
    accuracyScore: 99,
  };
}

export function optimizeParameters(input: DiagnosisInput): Record<string, number | string> {
  const mat = (input.material ?? "GI").toUpperCase();
  const t = input.thickness ?? 1.0;

  return {
    recommendedSpeed: mat === "SS" ? "10-15 m/min" : mat === "AL" ? "20-25 m/min" : "20-30 m/min",
    maxAnglePerStation: mat === "SS" ? 10 : mat === "TI" ? 8 : 15,
    springbackFactor: mat === "SS" ? 1.20 : mat === "AL" ? 1.15 : 1.06,
    rollGap: parseFloat((t + 0.05).toFixed(3)),
    rollDiameter: Math.max(80, t * 60),
    overbendDegrees: mat === "SS" ? 20 : mat === "AL" ? 15 : 6,
  };
}
