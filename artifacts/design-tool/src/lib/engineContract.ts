/**
 * engineContract.ts — Sai Rolotech Smart Engines v2.2.0+
 *
 * Central data-contract / type definitions shared across:
 *  - Store (useCncStore)
 *  - API client (api.ts)
 *  - Backend route handlers (flower.ts, roll-tooling.ts)
 *  - Preflight validator (ExportPreflightModal)
 *
 * RULE: Any new field added to an engine payload must start here.
 */

// ─── Profile Source ────────────────────────────────────────────────────────────

/** How the imported DXF profile was drawn. Determines what offset to apply. */
export type ProfileSourceType =
  | "centerline"    // neutral axis — expand ±t/2 both sides
  | "inner_face"    // inner surface trace — offset outward by t
  | "outer_face"    // outer surface trace — offset inward by t
  | "sheet_profile" // already full sheet — no offset
  | null;

// ─── Thickness Band ────────────────────────────────────────────────────────────

/**
 * Material thickness tolerance band for a specific job.
 * - bandMin → used for strip width calculation (tightest fit)
 * - bandMax → used for roll gap lower bound (conservative)
 * - nominal → the user-specified target thickness
 */
export interface ThicknessBand {
  nominal: number;
  bandMin: number;
  bandMax: number;
}

/** Validate a ThicknessBand — returns array of error strings (empty = valid) */
export function validateThicknessBand(band: ThicknessBand): string[] {
  const errs: string[] = [];
  if (band.nominal <= 0) errs.push("Nominal thickness must be > 0");
  if (band.bandMin <= 0) errs.push("Band min must be > 0");
  if (band.bandMax <= 0) errs.push("Band max must be > 0");
  if (band.bandMin > band.nominal) errs.push(`Band min (${band.bandMin}) is above nominal (${band.nominal})`);
  if (band.bandMax < band.nominal) errs.push(`Band max (${band.bandMax}) is below nominal (${band.nominal})`);
  if (band.bandMax < band.bandMin) errs.push("Band max must be ≥ band min");
  return errs;
}

// ─── Flower Engine Payload ─────────────────────────────────────────────────────

/** Full payload sent to POST /generate-flower */
export interface FlowerPayload {
  geometry: unknown;                 // ProfileGeometry
  numStations: number;
  stationPrefix: string;
  materialType: string;
  materialThickness: number;         // nominal
  thicknessBandMin: number;          // ← NEW: conservative strip width
  thicknessBandMax: number;          // ← NEW: conservative roll gap
  profileSourceType: ProfileSourceType; // ← NEW: what offset was applied upstream
  openSectionType: string;
  sectionModel?: "open" | "closed" | null;
}

// ─── Roll Tooling Payload ──────────────────────────────────────────────────────

/** Full payload sent to POST /generate-roll-tooling */
export interface RollToolingPayload {
  geometry: unknown;
  numStations: number;
  stationPrefix: string;
  materialThickness: number;
  thicknessBandMin: number;          // ← NEW
  thicknessBandMax: number;          // ← NEW
  profileSourceType: ProfileSourceType; // ← NEW
  rollDiameter: number;
  shaftDiameter: number;
  clearance: number;
  materialType: string;
  postProcessorId: string;
  openSectionType: string;
  sectionModel?: "open" | "closed" | null;
}

// ─── Preflight Gate ────────────────────────────────────────────────────────────

export interface PreflightGate {
  key: string;
  label: string;
  pass: boolean;
  warn?: boolean;    // amber warning — does not block export
  detail: string;
}

/** Run all engineering preflight gates. Returns gates + canExport flag. */
export function runPreflightGates(params: {
  hasGeometry: boolean;
  profileSourceType: ProfileSourceType;
  thicknessBand: ThicknessBand;
  flowerGenerated: boolean;
  toolingGenerated: boolean;
  materialType: string | null;
  hasInterferenceCritical: boolean;
  springbackComputed: boolean;
}): { gates: PreflightGate[]; canExport: boolean } {
  const {
    hasGeometry, profileSourceType, thicknessBand,
    flowerGenerated, toolingGenerated, materialType,
    hasInterferenceCritical, springbackComputed,
  } = params;

  const bandErrors = validateThicknessBand(thicknessBand);
  const bandValid = bandErrors.length === 0;

  const gates: PreflightGate[] = [
    {
      key: "geometry",
      label: "Profile Geometry",
      pass: hasGeometry,
      detail: hasGeometry ? "DXF profile loaded and parsed" : "No geometry — upload a DXF profile first",
    },
    {
      key: "profile_source",
      label: "Profile Source Type",
      pass: profileSourceType !== null,
      detail: profileSourceType !== null
        ? `Source: ${profileSourceType} — offset applied upstream`
        : "Profile source not resolved — select type in Project Setup before generating",
    },
    {
      key: "thickness_band",
      label: "Thickness Band",
      pass: bandValid,
      warn: !bandValid,
      detail: bandValid
        ? `Band: ${thicknessBand.bandMin}–${thicknessBand.bandMax} mm (nominal ${thicknessBand.nominal} mm)`
        : `Band invalid: ${bandErrors.join("; ")}`,
    },
    {
      key: "material",
      label: "Material Selected",
      pass: !!materialType,
      detail: materialType ? `Material: ${materialType}` : "No material type selected",
    },
    {
      key: "flower",
      label: "Flower Pattern Generated",
      pass: flowerGenerated,
      detail: flowerGenerated ? "Flower pattern computed for all stations" : "Run Flower Pattern generation first",
    },
    {
      key: "tooling",
      label: "Roll Tooling Generated",
      pass: toolingGenerated,
      detail: toolingGenerated ? "Roll tooling profiles computed" : "Run Generate Roll Tooling first",
    },
    {
      key: "springback",
      label: "Springback Computed",
      pass: springbackComputed,
      detail: springbackComputed ? "Springback angles computed and compensated" : "Springback not computed — re-run flower pattern",
    },
    {
      key: "interference",
      label: "No Critical Interference",
      pass: !hasInterferenceCritical,
      detail: hasInterferenceCritical
        ? "CRITICAL roll interference detected — resolve before export (see Tooling View badges)"
        : "Interference checks passed",
    },
  ];

  // Hard blockers: geometry, profile source, material, tooling, critical interference
  const hardBlockers = gates.filter(g => !g.pass && !g.warn && ["geometry", "material", "tooling", "interference"].includes(g.key));
  const canExport = hardBlockers.length === 0;

  return { gates, canExport };
}
