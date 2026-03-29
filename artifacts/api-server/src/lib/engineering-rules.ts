/**
 * engineering-rules.ts
 * =====================
 * Single source-of-truth for all roll-forming engineering rules.
 * Based on: "ULTRA PRO — ROLL FORMING ENGINEERING RULE BOOK"
 *
 * Every constant, table, and decision function lives here.
 * Both auto-pipeline and test-cases import from this file.
 * DO NOT duplicate logic in route files.
 */

// ─── 1. PROFILE COMPLEXITY CLASSIFICATION ────────────────────────────────────
// Rule: complexity = f(bend_count + return_bends + lip + depth_ratio)
// For detection-based classification, bend_count is the primary signal.

export type Complexity = "SIMPLE" | "MEDIUM" | "COMPLEX" | "VERY_COMPLEX";
export type DutyClass = "LIGHT" | "MEDIUM" | "HEAVY" | "INDUSTRIAL";

export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  SIMPLE:       "Simple (2–4 bends) — U/C channel",
  MEDIUM:       "Medium (4–8 bends) — Lipped channel / purlin",
  COMPLEX:      "Complex (8–12 bends) — Return bends / deep section",
  VERY_COMPLEX: "Very Complex (12+ bends) — Shutter / multi-return / zig-zag",
};

/**
 * Classify profile complexity by bend count.
 * Rule book Section 1:
 *   SIMPLE      → 2–4  bends
 *   MEDIUM      → 4–8  bends
 *   COMPLEX     → 8–12 bends
 *   VERY COMPLEX→ 12+  bends
 */
export function classifyComplexity(bendCount: number): Complexity {
  if (bendCount <= 4)  return "SIMPLE";
  if (bendCount <= 8)  return "MEDIUM";
  if (bendCount <= 12) return "COMPLEX";
  return "VERY_COMPLEX";
}

// ─── 2. STATION COUNT — RULE MATRIX ──────────────────────────────────────────
// Rule book Section 4:
//   stations = bend_count + complexity_correction + thickness_correction + material_correction
//   Minimum: 4 stations (every profile needs at minimum: entry, pre-form, forming, calibration)

// 2a. Complexity station correction
const COMPLEXITY_STATION_CORRECTION: Record<Complexity, number> = {
  SIMPLE:       0,
  MEDIUM:       2,
  COMPLEX:      4,
  VERY_COMPLEX: 6,
};

// 2b. Thickness station correction
// <0.8→+0 | 0.8–1.2→+1 | 1.2–2.0→+2 | >2.0→+3
export function thicknessStationCorrection(t: number): number {
  if (t < 0.8)  return 0;
  if (t < 1.2)  return 1;
  if (t <= 2.0) return 2;
  return 3;
}

// 2c. Material station correction
// Rule book: GI→+0, MS→+1, SS→+2
// Extended table for supported materials (ordered by forming difficulty):
export const MATERIAL_STATION_CORRECTION: Record<string, number> = {
  GI:   0,   // easy — galvanised iron
  CR:   0,   // easy — cold rolled
  AL:   0,   // easy — aluminium
  PP:   0,   // easy — polypropylene (similar to thin CR)
  HR:   1,   // medium — hot rolled
  MS:   1,   // medium — mild steel
  CU:   1,   // medium — copper
  SS:   2,   // hard — stainless steel
  HSLA: 2,   // hard — high-strength low-alloy
  TI:   3,   // very hard — titanium
};

// 2d. Recommended min station count (used as range floor)
// Base rule: 1 bend ≈ 1–1.5 stations, minimum 4 for any profile
export function estimateStationsRuleBook(
  bendCount: number,
  material: string,
  thickness: number,
): {
  complexity: Complexity;
  complexityLabel: string;
  recommended: number;
  minimum: number;
  maximum: number;
  complexityCorrection: number;
  thicknessCorrection: number;
  materialCorrection: number;
  formula: string;
} {
  const complexity = classifyComplexity(bendCount);
  const cc = COMPLEXITY_STATION_CORRECTION[complexity];
  const tc = thicknessStationCorrection(thickness);
  const mc = MATERIAL_STATION_CORRECTION[material.toUpperCase()] ?? 0;

  const base = Math.max(bendCount, 2);     // at minimum bend count, but at least 2
  const recommended = Math.max(4, base + cc + tc + mc);
  const minimum = Math.max(4, bendCount + cc + tc + mc);
  const maximum = Math.max(minimum + 2, minimum + Math.ceil(bendCount * 0.5));

  return {
    complexity,
    complexityLabel: COMPLEXITY_LABELS[complexity],
    recommended,
    minimum,
    maximum,
    complexityCorrection: cc,
    thicknessCorrection: tc,
    materialCorrection: mc,
    formula: `bend_count(${bendCount}) + complexity(+${cc}) + thickness(+${tc}) + material(+${mc}) = ${base + cc + tc + mc} → recommended ${recommended}`,
  };
}

// ─── 3. THICKNESS CATEGORY ────────────────────────────────────────────────────

export function thicknessCategory(t: number): string {
  if (t < 0.8)  return "< 0.8mm (ultra-thin)";
  if (t < 1.2)  return "0.8–1.2mm (thin)";
  if (t <= 2.0) return "1.2–2.0mm (medium)";
  return "> 2.0mm (heavy)";
}

// ─── 4. MATERIAL FORMING DIFFICULTY ──────────────────────────────────────────

export const MATERIAL_FORMING_DIFFICULTY: Record<string, string> = {
  GI:   "easy",
  CR:   "easy",
  AL:   "easy",
  PP:   "easy",
  HR:   "medium",
  MS:   "medium",
  CU:   "medium",
  SS:   "hard",
  HSLA: "hard",
  TI:   "very-hard",
};

// ─── 5. DUTY CLASS SELECTION ──────────────────────────────────────────────────
// Rule book Section 7:
//   thickness < 0.8 AND SIMPLE → LIGHT
//   thickness 0.8–1.2           → MEDIUM
//   thickness > 1.2 OR COMPLEX  → HEAVY
//   VERY COMPLEX / shutter      → INDUSTRIAL

export function calcDutyClass(
  thickness: number,
  complexity: Complexity,
  material: string,
): DutyClass {
  if (complexity === "VERY_COMPLEX") return "INDUSTRIAL";
  if (complexity === "COMPLEX")       return "HEAVY";
  if (thickness > 1.2)                return "HEAVY";
  if (thickness >= 0.8)               return "MEDIUM";
  // thickness < 0.8
  if (complexity === "SIMPLE")        return "LIGHT";
  return "MEDIUM";
}

// ─── 6. SHAFT DIAMETER SELECTION ─────────────────────────────────────────────
// Rule book Section 5 — Exact table:
//   LIGHT      → 40 mm
//   MEDIUM     → 50 mm
//   HEAVY      → 60 mm
//   INDUSTRIAL → 70 mm

export const SHAFT_DIAMETER_MM: Record<DutyClass, number> = {
  LIGHT:      40,
  MEDIUM:     50,
  HEAVY:      60,
  INDUSTRIAL: 70,
};

// ─── 7. BEARING SELECTION ────────────────────────────────────────────────────
// Rule book Section 6 — Exact mapping by shaft diameter:
//   40 mm → 6208
//   50 mm → 6210
//   60 mm → 6212
//   70 mm → 6214
// Extension for other sizes:
//   30 mm → 6206
//   80 mm → 6216

export const BEARING_BY_SHAFT: Record<number, string> = {
  30: "6206",
  40: "6208",
  50: "6210",
  60: "6212",
  70: "6214",
  80: "6216",
};

export function selectBearingForShaft(shaftDiamMm: number): string {
  // Exact match first
  if (BEARING_BY_SHAFT[shaftDiamMm]) return BEARING_BY_SHAFT[shaftDiamMm]!;
  // Round to nearest standard shaft size
  const standards = Object.keys(BEARING_BY_SHAFT).map(Number).sort((a, b) => a - b);
  const closest = standards.reduce((prev, curr) =>
    Math.abs(curr - shaftDiamMm) < Math.abs(prev - shaftDiamMm) ? curr : prev,
  );
  return BEARING_BY_SHAFT[closest] ?? "6210";
}

// ─── 8. K-FACTORS (DIN 6935 neutral axis) ────────────────────────────────────

export const K_FACTORS: Record<string, number> = {
  GI:   0.44,
  CR:   0.44,
  HR:   0.42,
  SS:   0.50,
  AL:   0.43,
  MS:   0.42,
  CU:   0.44,
  TI:   0.50,
  PP:   0.44,
  HSLA: 0.45,
};

// ─── 9. SPRINGBACK FACTORS ────────────────────────────────────────────────────

export const SPRINGBACK_FACTORS: Record<string, number> = {
  GI:   1.03,
  CR:   1.04,
  HR:   1.05,
  SS:   1.10,
  AL:   1.06,
  MS:   1.05,
  CU:   1.03,
  TI:   1.12,
  PP:   1.02,
  HSLA: 1.08,
};

// ─── 10. SUPPORTED MATERIALS LIST ────────────────────────────────────────────

export const SUPPORTED_MATERIALS = ["GI", "CR", "HR", "SS", "AL", "MS", "CU", "TI", "PP", "HSLA"] as const;
export type SupportedMaterial = typeof SUPPORTED_MATERIALS[number];

// ─── 11. CRITICAL WARNING DETECTORS ──────────────────────────────────────────
// Rule book Section 8 — App MUST detect these conditions.

export interface EngineeringWarning {
  code: string;
  severity: "critical" | "warning" | "info";
  message: string;
}

export function detectEngineeringWarnings(params: {
  bendCount: number;
  thickness: number;
  material: string;
  sectionWidth: number;
  sectionHeight: number;
  isOpen: boolean;
}): EngineeringWarning[] {
  const warnings: EngineeringWarning[] = [];
  const { bendCount, thickness, material, sectionWidth, sectionHeight } = params;

  if (bendCount === 0) {
    warnings.push({ code: "NO_BENDS", severity: "critical", message: "Bend count = 0 — flower pattern cannot be derived. Profile may be a flat strip." });
  }
  if (params.isOpen) {
    warnings.push({ code: "OPEN_PROFILE", severity: "warning", message: "Profile detected as open section. Verify this is intentional for roll-forming." });
  }
  if (!SUPPORTED_MATERIALS.includes(material as SupportedMaterial)) {
    warnings.push({ code: "UNKNOWN_MATERIAL", severity: "critical", message: `Material '${material}' not in supported list. Engineering results may be incorrect.` });
  }
  if (thickness <= 0) {
    warnings.push({ code: "INVALID_THICKNESS", severity: "critical", message: `Thickness ${thickness}mm is invalid. Must be a positive value.` });
  }
  if (thickness < 0.3) {
    warnings.push({ code: "THICKNESS_TOO_THIN", severity: "warning", message: `Thickness ${thickness}mm is below minimum 0.3mm for standard roll-forming tooling.` });
  }
  if (thickness > 6.0) {
    warnings.push({ code: "THICKNESS_TOO_THICK", severity: "warning", message: `Thickness ${thickness}mm exceeds typical 6.0mm roll-forming limit. Structural press-braking may be required.` });
  }
  if (sectionWidth < 1 || sectionHeight < 1) {
    warnings.push({ code: "DIMENSIONS_TOO_SMALL", severity: "critical", message: `Profile dimensions W=${sectionWidth}mm, H=${sectionHeight}mm are too small. Check DXF units — may need scaling.` });
  }
  const depthRatio = sectionHeight / Math.max(sectionWidth, 1);
  if (depthRatio > 1.5) {
    warnings.push({ code: "DEEP_SECTION", severity: "warning", message: `Section depth ratio ${depthRatio.toFixed(2)} is high — may require additional guide stations.` });
  }
  if (sectionWidth > 0 && bendCount > 0) {
    const avgFlangeWidth = sectionWidth / bendCount;
    if (avgFlangeWidth < 10) {
      warnings.push({ code: "NARROW_FLANGES", severity: "warning", message: `Narrow flanges detected (avg ${avgFlangeWidth.toFixed(1)}mm per bend) — may cause springback and roll gap issues.` });
    }
  }

  return warnings;
}

// ─── 12. FULL ENGINEERING SUMMARY BUILDER ─────────────────────────────────────
// Builds the complete engineering output from rule book inputs.

export interface EngineeringSummary {
  complexity: Complexity;
  complexity_label: string;
  bend_count: number;
  flower_passes: number;
  recommended_stations: number;
  minimum_stations: number;
  maximum_stations: number;
  station_formula: string;
  duty_class: DutyClass;
  shaft_diameter_mm: number;
  bearing: string;
  thickness_category: string;
  forming_difficulty: string;
  warnings: EngineeringWarning[];
  assumptions: string[];
}

export function buildEngineeringSummary(params: {
  bendCount: number;
  thickness: number;
  material: string;
  sectionWidth: number;
  sectionHeight: number;
  isOpen: boolean;
  flowerPasses?: number;
}): EngineeringSummary {
  const { bendCount, thickness, material, sectionWidth, sectionHeight, isOpen } = params;
  const mat = material.toUpperCase();

  const stEst = estimateStationsRuleBook(bendCount, mat, thickness);
  const duty = calcDutyClass(thickness, stEst.complexity, mat);
  const shaft = SHAFT_DIAMETER_MM[duty];
  const bearing = selectBearingForShaft(shaft);
  const warnings = detectEngineeringWarnings({ bendCount, thickness, material: mat, sectionWidth, sectionHeight, isOpen });

  return {
    complexity: stEst.complexity,
    complexity_label: stEst.complexityLabel,
    bend_count: bendCount,
    flower_passes: params.flowerPasses ?? stEst.recommended,
    recommended_stations: stEst.recommended,
    minimum_stations: stEst.minimum,
    maximum_stations: stEst.maximum,
    station_formula: stEst.formula,
    duty_class: duty,
    shaft_diameter_mm: shaft,
    bearing,
    thickness_category: thicknessCategory(thickness),
    forming_difficulty: MATERIAL_FORMING_DIFFICULTY[mat] ?? "medium",
    warnings,
    assumptions: [
      "Preliminary engineering logic — expert review required before production",
      `Station formula: ${stEst.formula}`,
      `Duty class '${duty}' → shaft ${shaft}mm → bearing ${bearing}`,
      "Strip width per DIN 6935 K-factor neutral axis method",
      "Shigley's MSS method used for secondary shaft strength verification",
    ],
  };
}
