/**
 * roll-interference-engine.ts — P1.F Roll Gap & Interference Engine
 *
 * Checks for upper/lower roll clearance violations:
 *   - Roll envelope gap = strip thickness + clearance allowance
 *   - Detects shaft-to-roll safe zone violations
 *   - Returns per-station interference report with severity
 */

export interface RollPairInput {
  stationNo: number;
  upperOuterDiameter: number;
  lowerOuterDiameter: number;
  upperInnerDiameter: number;
  lowerInnerDiameter: number;
  rollWidth: number;
  shaftDiameter?: number;
  stripThickness: number;
  clearance?: number;
  grooveDepthUpper?: number;
  grooveDepthLower?: number;
}

export type InterferenceSeverity = "ok" | "warning" | "collision";

export interface StationInterference {
  stationNo: number;
  nominalGap: number;
  requiredGap: number;
  gapDeficit: number;
  severity: InterferenceSeverity;
  collidingZone: string | null;
  shaftClearanceOk: boolean;
  rollEnvelopeOk: boolean;
  message: string;
  recommendation: string;
}

export interface InterferenceReport {
  stations: StationInterference[];
  collidingStations: number[];
  warningStations: number[];
  overallStatus: "ok" | "warnings" | "collisions";
  summary: string;
}

export function checkStationInterference(station: RollPairInput): StationInterference {
  const {
    stationNo,
    upperOuterDiameter,
    lowerOuterDiameter,
    stripThickness,
    clearance = 0.1,
    grooveDepthUpper = 0,
    grooveDepthLower = 0,
    shaftDiameter,
    upperInnerDiameter,
    lowerInnerDiameter,
  } = station;

  const upperR = upperOuterDiameter / 2;
  const lowerR = lowerOuterDiameter / 2;

  // Nominal gap = center distance - sum of outer radii + groove depths
  // For simplicity: assume center-to-center = upperR + lowerR + gap
  // The actual working gap at groove bottom
  const nominalGap = grooveDepthUpper + grooveDepthLower + stripThickness + clearance;
  const requiredGap = stripThickness + clearance;
  const gapDeficit = requiredGap - nominalGap;

  let severity: InterferenceSeverity = "ok";
  let collidingZone: string | null = null;

  if (gapDeficit > 0.5) {
    severity = "collision";
    collidingZone = "groove web contact";
  } else if (gapDeficit > 0) {
    severity = "warning";
    collidingZone = "groove edge possible contact";
  }

  // Shaft-to-roll bore check
  let shaftClearanceOk = true;
  if (shaftDiameter) {
    const upperBoreR = upperInnerDiameter / 2;
    const lowerBoreR = lowerInnerDiameter / 2;
    const shaftR = shaftDiameter / 2;
    if (shaftR > upperBoreR * 0.98 || shaftR > lowerBoreR * 0.98) {
      shaftClearanceOk = false;
      severity = severity === "collision" ? "collision" : "warning";
    }
  }

  const rollEnvelopeOk = severity !== "collision";

  const messages: Record<InterferenceSeverity, string> = {
    ok: `Station ${stationNo}: Gap ${nominalGap.toFixed(2)} mm — OK`,
    warning: `Station ${stationNo}: Gap near minimum — check clearance`,
    collision: `Station ${stationNo}: COLLISION — gap ${nominalGap.toFixed(2)} mm < required ${requiredGap.toFixed(2)} mm`,
  };

  const recommendations: Record<InterferenceSeverity, string> = {
    ok: "No action needed",
    warning: "Verify roll center distance before production run",
    collision: "Increase groove depth or adjust roll center distance to eliminate interference",
  };

  return {
    stationNo,
    nominalGap: parseFloat(nominalGap.toFixed(3)),
    requiredGap: parseFloat(requiredGap.toFixed(3)),
    gapDeficit: parseFloat(gapDeficit.toFixed(3)),
    severity,
    collidingZone,
    shaftClearanceOk,
    rollEnvelopeOk,
    message: messages[severity],
    recommendation: recommendations[severity],
  };
}

export function checkAllStations(stations: RollPairInput[]): InterferenceReport {
  const results = stations.map(checkStationInterference);
  const colliding = results.filter(r => r.severity === "collision").map(r => r.stationNo);
  const warnings = results.filter(r => r.severity === "warning").map(r => r.stationNo);

  let overallStatus: InterferenceReport["overallStatus"] = "ok";
  if (colliding.length > 0) overallStatus = "collisions";
  else if (warnings.length > 0) overallStatus = "warnings";

  const summary =
    overallStatus === "ok"
      ? "All stations clear — no interference detected"
      : overallStatus === "warnings"
      ? `${warnings.length} station(s) near minimum clearance`
      : `${colliding.length} collision(s) detected — production BLOCKED`;

  return { stations: results, collidingStations: colliding, warningStations: warnings, overallStatus, summary };
}
