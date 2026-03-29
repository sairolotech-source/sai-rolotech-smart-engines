/**
 * stationLogicEngine.ts
 * Auto-generates human-readable station explanations + manufacturability warnings
 * for Roll Forming Simulator — Sai Rolotech Smart Engines v2.3.0
 */

export interface StationExplanation {
  purpose:     string;
  forming:     string;
  noteText:    string;
  incremental: string;
  riskLevel:   "ok" | "caution" | "warning";
  riskNote:    string;
}

export interface ManufacturabilityWarning {
  code:     string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title:    string;
  detail:   string;
  station?: number;
}

interface Pass {
  pass_no:          number;
  station_label:    string;
  stage_type:       string;
  target_angle_deg: number;
  roll_gap_mm:      number;
  forming_depth_mm: number;
  pass_progress_pct:number;
  strip_width_mm:   number;
  strain:           number;
  springback_deg:   number;
  defects:          Array<{ severity: string; message: string }>;
}

// ─── Stage purpose templates ──────────────────────────────────────────────────

const STAGE_PURPOSE: Record<string, string> = {
  flat:                "Flat strip feed — no forming. Sets initial width and guides strip entry.",
  pre_bend:            "Pre-forming the strip edge softly before main bending begins. Reduces springback shock on later stations.",
  initial_bend:        "First significant angle is introduced. Material is starting to yield at the bend radius.",
  progressive_forming: "Incrementally increasing the bend angle toward target geometry. Each station adds a controlled increment.",
  lip_forming:         "Forming the lip/return flange. Material is folded inward — requires precise gap control.",
  final_form:          "Angle reaches near-target. Roll geometry is tightest here. Springback compensation applied.",
  calibration:         "Final pass at full angle. Removes springback, improves straightness, and sets final strip width.",
};

const STAGE_RISK_NOTE: Record<string, string> = {
  flat:                "No forming risk — ensure strip tracking is correct.",
  pre_bend:            "Light load. Verify strip does not wander off-centre.",
  initial_bend:        "Watch for edge cracking in hard materials (SS/CR). Radius must be ≥ 2× thickness.",
  progressive_forming: "Monitor strain accumulation. Excessive increments cause buckling.",
  lip_forming:         "High risk of lip twist if gap is not precise. Verify both sides simultaneously.",
  final_form:          "Highest forming force. Roll OD must be rigid — check bearing load ratings.",
  calibration:         "Apply ≤ 0.5° overbend for springback correction. Excess causes reverse camber.",
};

// ─── getStationExplanation ────────────────────────────────────────────────────

export function getStationExplanation(
  cur:      Pass,
  allPasses: Pass[],
  thickness: number,
  material:  string,
): StationExplanation {
  const total   = allPasses.length;
  const idx     = allPasses.findIndex(p => p.pass_no === cur.pass_no);
  const prev    = idx > 0 ? allPasses[idx - 1] : null;
  const next    = idx < total - 1 ? allPasses[idx + 1] : null;

  const angleDelta = prev ? (cur.target_angle_deg - prev.target_angle_deg) : cur.target_angle_deg;
  const isFirst    = idx === 0;
  const isLast     = idx === total - 1;
  const isCal      = cur.stage_type === "calibration";

  // Purpose
  const purpose = STAGE_PURPOSE[cur.stage_type] ?? `${cur.stage_type.replace(/_/g," ")} — forming at ${cur.target_angle_deg}°.`;

  // Forming description
  let forming: string;
  if (isFirst) {
    forming = `Introduces first ${cur.target_angle_deg.toFixed(1)}° of bend. Strip starts at 0° flat.`;
  } else if (isCal) {
    forming = `Final calibration pass. Holds full profile angle and sets final strip width to ${cur.strip_width_mm.toFixed(1)} mm.`;
  } else if (angleDelta <= 0) {
    forming = `No angle increase at this pass. Focus is on width/depth stabilization.`;
  } else {
    forming = `Adds ${angleDelta.toFixed(1)}° to previous ${prev!.target_angle_deg.toFixed(1)}°, reaching ${cur.target_angle_deg.toFixed(1)}°. ` +
      `Forming depth: ${cur.forming_depth_mm.toFixed(1)} mm.`;
  }

  // Incremental note
  let incremental: string;
  if (next && !isCal) {
    const nextDelta = next.target_angle_deg - cur.target_angle_deg;
    incremental = `Next station will add ${nextDelta.toFixed(1)}° more (target ${next.target_angle_deg.toFixed(1)}°).`;
  } else if (isCal) {
    incremental = `This is the final station. No further forming.`;
  } else {
    incremental = `This is the last forming station before calibration.`;
  }

  // Risk
  let riskLevel: "ok" | "caution" | "warning" = "ok";
  let riskNote  = STAGE_RISK_NOTE[cur.stage_type] ?? "";

  if (cur.strain > 0.22) {
    riskLevel = "warning";
    riskNote  = `⚠ High outer fiber strain (${(cur.strain * 100).toFixed(1)}%). Fracture risk for brittle materials. Consider reducing angle increment.`;
  } else if (cur.strain > 0.15) {
    riskLevel = "caution";
    riskNote  = `Moderate strain (${(cur.strain * 100).toFixed(1)}%). Acceptable for ${material}, but monitor for edge cracking.`;
  } else if (angleDelta > 15) {
    riskLevel = "caution";
    riskNote  = `Angle increment ${angleDelta.toFixed(1)}° is large. For ${material} consider splitting into two stations.`;
  }

  if (cur.defects.some(d => d.severity === "HIGH")) {
    riskLevel = "warning";
  } else if (cur.defects.some(d => d.severity === "MEDIUM") && riskLevel === "ok") {
    riskLevel = "caution";
  }

  const noteText = isCal
    ? `Material springback = ${cur.springback_deg.toFixed(2)}°. ` +
      `Roll is pre-compensated by this amount. Strip exits at target profile angle.`
    : `Roll gap = ${cur.roll_gap_mm.toFixed(2)} mm (sheet ${thickness} mm + clearance ${(cur.roll_gap_mm - thickness).toFixed(2)} mm). ` +
      `Springback at this pass: ${cur.springback_deg.toFixed(2)}°.`;

  return { purpose, forming, noteText, incremental, riskLevel, riskNote };
}

// ─── getManufacturabilityWarnings ─────────────────────────────────────────────

export function getManufacturabilityWarnings(
  allPasses: Pass[],
  rollOD:    number,
  bore:      number,
  faceWidth: number,
  thickness: number,
  material:  string,
): ManufacturabilityWarning[] {
  const warnings: ManufacturabilityWarning[] = [];

  // Roll wall thickness
  const wall = (rollOD - bore) / 2;
  if (wall < 15) {
    warnings.push({
      code: "THIN_WALL",
      severity: "HIGH",
      title: "Thin Roll Wall",
      detail: `Wall = ${wall.toFixed(1)} mm (OD ${rollOD} − Bore ${bore}). Min 15 mm recommended for rigidity. Risk of roll deflection under forming load.`,
    });
  } else if (wall < 20) {
    warnings.push({
      code: "WALL_CAUTION",
      severity: "MEDIUM",
      title: "Marginal Roll Wall",
      detail: `Wall = ${wall.toFixed(1)} mm. Acceptable but marginal. Ensure EN31 or D2 material with 60+ HRC.`,
    });
  }

  // Per-station checks
  for (const p of allPasses) {
    const idx = allPasses.indexOf(p);
    const prev = idx > 0 ? allPasses[idx - 1] : null;
    const angleDelta = prev ? p.target_angle_deg - prev.target_angle_deg : p.target_angle_deg;

    // Gap too tight
    if (p.roll_gap_mm < thickness * 0.65) {
      warnings.push({
        code: "GAP_TOO_TIGHT",
        severity: "HIGH",
        title: "Roll Gap Too Tight",
        station: p.pass_no,
        detail: `Station ${p.pass_no}: Gap ${p.roll_gap_mm.toFixed(2)} mm < 65% of ${thickness} mm thickness. Strip pinching risk — material may seize or gall roll surface.`,
      });
    }

    // Gap too loose
    if (p.roll_gap_mm > thickness * 3.0 && p.stage_type !== "flat") {
      warnings.push({
        code: "GAP_TOO_LOOSE",
        severity: "LOW",
        title: "Roll Gap Excessively Large",
        station: p.pass_no,
        detail: `Station ${p.pass_no}: Gap ${p.roll_gap_mm.toFixed(2)} mm > 3× thickness. Roll may not control strip properly.`,
      });
    }

    // Excessive angle increment
    if (angleDelta > 18 && p.stage_type !== "calibration") {
      warnings.push({
        code: "LARGE_INCREMENT",
        severity: "MEDIUM",
        title: "Large Angle Increment",
        station: p.pass_no,
        detail: `Station ${p.pass_no}: Δangle = ${angleDelta.toFixed(1)}° in one pass. Recommended max ≤ 15°. Risk of buckling or edge waviness for ${material}.`,
      });
    }

    // Excessive forming depth ratio
    if (p.forming_depth_mm > p.strip_width_mm * 0.5 && p.stage_type !== "calibration") {
      warnings.push({
        code: "EXCESSIVE_DEPTH",
        severity: "MEDIUM",
        title: "Excessive Groove Depth Ratio",
        station: p.pass_no,
        detail: `Station ${p.pass_no}: Depth ${p.forming_depth_mm.toFixed(1)} mm is ${((p.forming_depth_mm/p.strip_width_mm)*100).toFixed(0)}% of strip width. Roll groove may be too narrow — machining difficulty.`,
      });
    }

    // High strain
    if (p.strain > 0.25) {
      warnings.push({
        code: "HIGH_STRAIN",
        severity: "HIGH",
        title: "Near-Fracture Strain",
        station: p.pass_no,
        detail: `Station ${p.pass_no}: Outer fiber strain ${(p.strain*100).toFixed(1)}% > 25%. For ${material} — risk of micro-cracking. Increase bend radius or split pass.`,
      });
    }
  }

  // Face width check
  if (faceWidth < 30) {
    warnings.push({
      code: "NARROW_FACE",
      severity: "MEDIUM",
      title: "Narrow Roll Face Width",
      detail: `Face width = ${faceWidth} mm. If strip is wider, rolls will not cover profile edge. Verify face width ≥ strip width.`,
    });
  }

  // Angle jump between any two consecutive passes
  for (let i = 1; i < allPasses.length; i++) {
    const delta = allPasses[i].target_angle_deg - allPasses[i-1].target_angle_deg;
    if (delta < -5) {
      warnings.push({
        code: "ANGLE_REVERSAL",
        severity: "HIGH",
        title: "Angle Reversal Detected",
        station: allPasses[i].pass_no,
        detail: `Station ${allPasses[i].pass_no}: Angle drops ${Math.abs(delta).toFixed(1)}° from previous pass. Reverse bending — impossible in single-direction roll forming. Check station order.`,
      });
    }
  }

  // Remove duplicates by code+station
  const seen = new Set<string>();
  return warnings.filter(w => {
    const key = `${w.code}-${w.station ?? "global"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
