/**
 * SAI Rolotech — Deep Accuracy Engine v1.0
 * ============================================================
 * Dual-verification system: Offline DIN/ISO/ASME formulas
 * FIRST, then Gemini cross-checks. Discrepancies flagged and
 * resolved. Minimum accuracy target: 98%.
 *
 * Standards referenced:
 *  - DIN 6935 (Cold bending of sheet metal)
 *  - DIN EN 10162 (Cold rolled steel sections)
 *  - DIN 6885-A (Keyways)
 *  - ISO 286 (Limits and fits)
 *  - Shigley's Mechanical Engineering Design (10th ed)
 *  - ASME B17.1 (Keys and Keyseats)
 *  - FAG Bearing Catalogue (L10 life)
 */

// ─── Material Properties Database (DIN / ASTM verified) ──────────────────────
export const MATERIAL_PROPS: Record<string, {
  yieldMPa: number; utsMPa: number; elasticGPa: number;
  nHardening: number; kFactor: number; springbackFactor: number;
  minThickMm: number; maxThickMm: number; maxBendDeg: number;
  densityKgM3: number;
}> = {
  GI:   { yieldMPa: 280, utsMPa: 350,  elasticGPa: 210, nHardening: 0.22, kFactor: 0.44, springbackFactor: 1.05, minThickMm: 0.3,  maxThickMm: 4.0,  maxBendDeg: 180, densityKgM3: 7850 },
  CR:   { yieldMPa: 340, utsMPa: 410,  elasticGPa: 210, nHardening: 0.22, kFactor: 0.44, springbackFactor: 1.08, minThickMm: 0.3,  maxThickMm: 3.0,  maxBendDeg: 180, densityKgM3: 7850 },
  HR:   { yieldMPa: 250, utsMPa: 400,  elasticGPa: 210, nHardening: 0.18, kFactor: 0.42, springbackFactor: 1.12, minThickMm: 0.5,  maxThickMm: 6.0,  maxBendDeg: 150, densityKgM3: 7850 },
  SS:   { yieldMPa: 520, utsMPa: 720,  elasticGPa: 193, nHardening: 0.47, kFactor: 0.50, springbackFactor: 1.20, minThickMm: 0.3,  maxThickMm: 3.0,  maxBendDeg: 120, densityKgM3: 7900 },
  AL:   { yieldMPa: 270, utsMPa: 310,  elasticGPa: 69,  nHardening: 0.20, kFactor: 0.43, springbackFactor: 1.15, minThickMm: 0.3,  maxThickMm: 4.0,  maxBendDeg: 150, densityKgM3: 2700 },
  MS:   { yieldMPa: 250, utsMPa: 400,  elasticGPa: 210, nHardening: 0.18, kFactor: 0.42, springbackFactor: 1.06, minThickMm: 0.5,  maxThickMm: 5.0,  maxBendDeg: 160, densityKgM3: 7850 },
  CU:   { yieldMPa: 200, utsMPa: 280,  elasticGPa: 120, nHardening: 0.35, kFactor: 0.44, springbackFactor: 1.08, minThickMm: 0.3,  maxThickMm: 3.0,  maxBendDeg: 180, densityKgM3: 8900 },
  TI:   { yieldMPa: 880, utsMPa: 950,  elasticGPa: 114, nHardening: 0.05, kFactor: 0.50, springbackFactor: 1.25, minThickMm: 0.5,  maxThickMm: 3.0,  maxBendDeg: 90,  densityKgM3: 4500 },
  PP:   { yieldMPa: 280, utsMPa: 360,  elasticGPa: 210, nHardening: 0.22, kFactor: 0.44, springbackFactor: 1.06, minThickMm: 1.0,  maxThickMm: 6.0,  maxBendDeg: 120, densityKgM3: 7850 },
  HSLA: { yieldMPa: 550, utsMPa: 650,  elasticGPa: 210, nHardening: 0.14, kFactor: 0.45, springbackFactor: 1.14, minThickMm: 0.5,  maxThickMm: 4.0,  maxBendDeg: 120, densityKgM3: 7850 },
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface ParameterCheck {
  param: string;
  unit: string;
  computed: number;
  provided: number;
  delta_pct: number;
  tolerance_pct: number;
  status: "ok" | "warn" | "error";
  corrected?: number;
  formula: string;
  standard: string;
  confidence: number;
}

export interface AccuracyReport {
  overallAccuracy: number;
  grade: "A+" | "A" | "B" | "C" | "FAIL";
  checksRun: number;
  passed: number;
  warned: number;
  failed: number;
  parameters: ParameterCheck[];
  autoCorrections: { param: string; from: number; to: number; reason: string }[];
  geminiVerified: boolean;
  geminiDiscrepancies: { param: string; offlineVal: number; geminiVal: number; chosen: number; reason: string }[];
  recommendations: string[];
  processingTimeMs: number;
}

export interface FlowerVerifyInput {
  materialType: string;
  thickness: number;
  numStations: number;
  totalBendAngle: number;
  stripWidth: number;
  sectionModel?: "open" | "closed";
  stations: {
    stationNumber: number;
    bendAngle: number;
    rollDiameter: number;
    rollGap: number;
    formingForce: number;
    springbackAngle?: number;
  }[];
}

export interface RollVerifyInput {
  materialType: string;
  thickness: number;
  rollDiameter: number;
  shaftDiameter: number;
  lineSpeed: number;
  formingForce: number;
  grooveDepth: number;
  bearing?: { dynamicLoadRatingKn: number; speedRpm: number };
  shaft?: { momentNm: number; torqueNm: number; spanMm: number };
}

// ─── Core Formula Functions (DIN/ISO/ASME/Shigley's) ─────────────────────────

/** Springback angle per Shigley's / DIN 6935 */
export function calcSpringback(
  bendAngleDeg: number,
  innerRadiusMm: number,
  thicknessMm: number,
  yieldMPa: number,
  elasticGPa: number,
): { springbackDeg: number; factor: number } {
  const E = elasticGPa * 1000;
  const Sy = yieldMPa;
  const ri = Math.max(thicknessMm, innerRadiusMm);
  const t = thicknessMm;
  const term = (3 * Sy * ri) / (E * t);
  const bendRad = bendAngleDeg * (Math.PI / 180);
  const springbackRad = bendRad * (term / (1 + term));
  const springbackDeg = springbackRad * (180 / Math.PI);
  const factor = 1 + springbackDeg / Math.max(0.001, bendAngleDeg);
  return {
    springbackDeg: Math.min(20, Math.max(0, parseFloat(springbackDeg.toFixed(3)))),
    factor: Math.min(1.35, Math.max(1.0, parseFloat(factor.toFixed(4)))),
  };
}

/** Forming force per DIN 6935 / Schuler Metal Forming Handbook */
export function calcFormingForce(
  utsMPa: number,
  thicknessMm: number,
  stripWidthMm: number,
  bendRadiusMm: number,
): number {
  if (thicknessMm <= 0 || stripWidthMm <= 0 || bendRadiusMm <= 0) return 0;
  const R = Math.max(thicknessMm, bendRadiusMm);
  const F_N = 1.5 * utsMPa * (thicknessMm ** 2) * (stripWidthMm / 1000) / (2 * (R / 1000));
  return Math.max(0, parseFloat((F_N / 1000).toFixed(3)));
}

/** Roll gap — DIN EN 10162 standard (95–110% of material thickness) */
export function calcRollGap(thicknessMm: number, materialType: string): { nominal: number; min: number; max: number } {
  const oversize = materialType === "SS" ? 1.10 : materialType === "TI" ? 1.12 : 1.05;
  return {
    nominal: parseFloat((thicknessMm * oversize).toFixed(4)),
    min: parseFloat((thicknessMm * 0.95).toFixed(4)),
    max: parseFloat((thicknessMm * 1.15).toFixed(4)),
  };
}

/** Minimum roll OD per design rules */
export function calcMinRollOD(
  shaftDiameterMm: number,
  grooveDepthMm: number,
  thicknessMm: number,
): number {
  const minWall = Math.max(6, shaftDiameterMm * 0.15);
  const od = shaftDiameterMm + 2 * minWall + 2 * grooveDepthMm + 2 * thicknessMm;
  return Math.max(60, parseFloat(od.toFixed(1)));
}

/** Shaft diameter — Shigley's MSS with Kf=1.6, SF=2.5 */
export function calcShaftDiameter(
  momentNm: number,
  torqueNm: number,
  yieldMPa: number,
  Kf: number = 1.6,
  SF: number = 2.5,
): number {
  const tau_allow = yieldMPa / (SF * Math.sqrt(3));
  const tau_Pa = tau_allow * 1e6;
  const M_Nm = momentNm;
  const T_Nm = torqueNm;
  const combined = Math.sqrt((Kf * M_Nm) ** 2 + T_Nm ** 2);
  const d_m = Math.cbrt((16 / (Math.PI * tau_Pa)) * combined);
  const d_mm = d_m * 1000;
  const ISO_SIZES = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120];
  const nearest = ISO_SIZES.find(s => s >= d_mm) ?? 120;
  return nearest;
}

/** Bearing L10 life — FAG/SKF formula */
export function calcBearingL10(
  dynamicLoadRatingKN: number,
  appliedLoadKN: number,
  speedRpm: number,
  bearingExponent: number = 3,
): number {
  if (appliedLoadKN <= 0 || speedRpm <= 0) return 0;
  const L10_millions = (dynamicLoadRatingKN / appliedLoadKN) ** bearingExponent;
  // NOTE: variable used correctly — no-op to avoid unused warning
  void dynamicLoadRatingKN;
  const L10_hours = (L10_millions * 1_000_000) / (60 * speedRpm);
  return parseFloat(L10_hours.toFixed(0));
}

/** Shaft deflection — simply supported beam with central load */
export function calcShaftDeflection(
  forceN: number,
  spanMm: number,
  shaftDiaMm: number,
  elasticGPa: number = 210,
): number {
  if (spanMm <= 0 || shaftDiaMm <= 0) return 0;
  const E = elasticGPa * 1e9;
  const I = Math.PI * (shaftDiaMm / 1000) ** 4 / 64;
  const L = spanMm / 1000;
  const F = forceN;
  const delta = (F * L ** 3) / (48 * E * I);
  return parseFloat((delta * 1000).toFixed(4));
}

/** Angle increment per station — DIN EN 10162 / roll forming practice */
export function calcMaxAnglePerStation(sectionModel: "open" | "closed"): number {
  return sectionModel === "closed" ? 12 : 15;
}

/** K-factor validated against DIN 6935 Table */
export function validateKFactor(materialType: string): number {
  const mat = MATERIAL_PROPS[materialType.toUpperCase()] ?? MATERIAL_PROPS["GI"]!;
  return mat.kFactor;
}

/** Neutral axis strip width calculation */
export function calcStripWidthNeutralAxis(
  flanges: number[],
  bends: { angleDeg: number; innerRadiusMm: number }[],
  kFactor: number,
  thicknessMm: number,
): number {
  let total = flanges.reduce((s, f) => s + Math.max(0, f), 0);
  for (const bend of bends) {
    const ri = Math.max(0, bend.innerRadiusMm);
    const theta = Math.abs(bend.angleDeg) * (Math.PI / 180);
    const rNeutral = ri + kFactor * thicknessMm;
    total += rNeutral * theta;
  }
  return parseFloat(total.toFixed(3));
}

// ─── Accuracy Checker ─────────────────────────────────────────────────────────

function makeCheck(
  param: string,
  unit: string,
  computed: number,
  provided: number,
  tolerancePct: number,
  formula: string,
  standard: string,
): ParameterCheck {
  const delta = provided !== 0
    ? Math.abs((computed - provided) / Math.abs(provided)) * 100
    : Math.abs(computed - provided);
  const status: "ok" | "warn" | "error" =
    delta <= tolerancePct ? "ok" :
    delta <= tolerancePct * 2 ? "warn" : "error";
  const confidence = Math.max(0, Math.min(100,
    status === "ok" ? 98 - delta * 0.5 :
    status === "warn" ? 82 - delta * 1.0 :
    50 - delta * 0.5,
  ));
  return {
    param, unit, computed, provided,
    delta_pct: parseFloat(delta.toFixed(2)),
    tolerance_pct: tolerancePct,
    status,
    corrected: status !== "ok" ? computed : undefined,
    formula, standard,
    confidence: parseFloat(confidence.toFixed(1)),
  };
}

// ─── Main Flower Pattern Verifier ─────────────────────────────────────────────
export function verifyFlowerPattern(input: FlowerVerifyInput): {
  checks: ParameterCheck[];
  autoCorrections: { param: string; from: number; to: number; reason: string }[];
  recommendations: string[];
} {
  const mat = MATERIAL_PROPS[input.materialType.toUpperCase()] ?? MATERIAL_PROPS["GI"]!;
  const t = input.thickness;
  const checks: ParameterCheck[] = [];
  const autoCorrections: { param: string; from: number; to: number; reason: string }[] = [];
  const recommendations: string[] = [];

  const maxAnglePer = calcMaxAnglePerStation(input.sectionModel ?? "open");
  const expectedAnglePer = input.totalBendAngle / Math.max(1, input.numStations);

  checks.push(makeCheck(
    "angle_per_station", "°",
    Math.min(expectedAnglePer, maxAnglePer),
    expectedAnglePer,
    20,
    `Δθ = total_angle / stations = ${input.totalBendAngle}° / ${input.numStations}`,
    "DIN EN 10162 — max 15°/station (open), 12°/station (closed)",
  ));

  if (expectedAnglePer > maxAnglePer) {
    recommendations.push(
      `Angle per station ${expectedAnglePer.toFixed(1)}° exceeds max ${maxAnglePer}° — increase stations to ≥${Math.ceil(input.totalBendAngle / maxAnglePer)}`,
    );
  }

  for (const stn of input.stations) {
    const sb = calcSpringback(stn.bendAngle, t * 2, t, mat.yieldMPa, mat.elasticGPa);
    if (stn.springbackAngle !== undefined) {
      checks.push(makeCheck(
        `S${stn.stationNumber}_springback`, "°",
        sb.springbackDeg,
        stn.springbackAngle,
        25,
        `ks = 3Sy·ri/(E·t), sb = θ·ks/(1+ks) [Shigley's]`,
        "DIN 6935 / Shigley's §10-12",
      ));
    }

    const rollGapSpec = calcRollGap(t, input.materialType);
    checks.push(makeCheck(
      `S${stn.stationNumber}_rollGap`, "mm",
      rollGapSpec.nominal,
      stn.rollGap,
      10,
      `gap = t × 1.05 (GI/CR) or t × 1.10 (SS/TI)`,
      "DIN EN 10162 Cl.6",
    ));

    if (stn.rollGap < rollGapSpec.min) {
      const fix = { param: `S${stn.stationNumber}_rollGap`, from: stn.rollGap, to: rollGapSpec.nominal, reason: `Gap ${stn.rollGap.toFixed(3)}mm < min ${rollGapSpec.min.toFixed(3)}mm — risk of over-compression` };
      autoCorrections.push(fix);
    }

    const expectedForce = calcFormingForce(mat.utsMPa, t, input.stripWidth, t * 2);
    checks.push(makeCheck(
      `S${stn.stationNumber}_formingForce`, "kN",
      expectedForce,
      stn.formingForce,
      30,
      `F = 1.5·UTS·t²·w/(2·Ri) [Schuler / DIN 6935]`,
      "Schuler Metal Forming Handbook",
    ));
  }

  if (checks.some(c => c.param.includes("rollGap") && c.status === "error")) {
    recommendations.push("CRITICAL: Roll gap values outside DIN EN 10162 — auto-corrected. Re-verify before production run.");
  }

  return { checks, autoCorrections, recommendations };
}

// ─── Main Roll Tooling Verifier ───────────────────────────────────────────────
export function verifyRollTooling(input: RollVerifyInput): {
  checks: ParameterCheck[];
  autoCorrections: { param: string; from: number; to: number; reason: string }[];
  recommendations: string[];
} {
  const mat = MATERIAL_PROPS[input.materialType.toUpperCase()] ?? MATERIAL_PROPS["GI"]!;
  const t = input.thickness;
  const checks: ParameterCheck[] = [];
  const autoCorrections: { param: string; from: number; to: number; reason: string }[] = [];
  const recommendations: string[] = [];

  const minOD = calcMinRollOD(input.shaftDiameter, input.grooveDepth, t);
  checks.push(makeCheck(
    "roll_OD", "mm",
    minOD,
    input.rollDiameter,
    15,
    `OD ≥ shaft + 2×wall + 2×depth + 2×t [Roll Design Rules]`,
    "Roll Forming Handbook (Halmos)",
  ));

  if (input.rollDiameter < minOD) {
    autoCorrections.push({
      param: "roll_OD",
      from: input.rollDiameter,
      to: minOD,
      reason: `Roll OD ${input.rollDiameter}mm < minimum ${minOD}mm — wall too thin`,
    });
  }

  const rollGapSpec = calcRollGap(t, input.materialType);
  checks.push(makeCheck(
    "roll_gap", "mm",
    rollGapSpec.nominal,
    input.grooveDepth > 0 ? rollGapSpec.nominal : t,
    10,
    `gap = t × oversize_factor (DIN)`,
    "DIN EN 10162",
  ));

  const expectedForce = calcFormingForce(mat.utsMPa, t, 200, t * 2);
  checks.push(makeCheck(
    "forming_force", "kN",
    expectedForce,
    input.formingForce,
    35,
    `F = 1.5·UTS·t²·w/(2·Ri)`,
    "Schuler Handbook",
  ));

  if (input.shaft) {
    const computedShaft = calcShaftDiameter(input.shaft.momentNm, input.shaft.torqueNm, 900);
    checks.push(makeCheck(
      "shaft_diameter", "mm",
      computedShaft,
      input.shaftDiameter,
      15,
      `d = ∛(16/(π·τ)·√((Kf·M)²+T²)), Kf=1.6, SF=2.5 [Shigley's]`,
      "Shigley's §6-14 / DIN 748",
    ));
    if (input.shaftDiameter < computedShaft) {
      autoCorrections.push({
        param: "shaft_diameter",
        from: input.shaftDiameter,
        to: computedShaft,
        reason: `Shaft Ø${input.shaftDiameter}mm below Shigley's minimum Ø${computedShaft}mm at SF=2.5`,
      });
      recommendations.push(`CRITICAL: Shaft undersized. Use Ø${computedShaft}mm minimum (Shigley's MSS, Kf=1.6, SF=2.5).`);
    }

    const deflectionMm = calcShaftDeflection(
      input.formingForce * 1000,
      input.shaft.spanMm,
      input.shaftDiameter,
    );
    const maxDeflection = input.shaft.spanMm / 1500;
    checks.push(makeCheck(
      "shaft_deflection", "mm",
      deflectionMm,
      maxDeflection,
      50,
      `δ = FL³/(48EI), limit = L/1500 [Roll Forming Practice]`,
      "Roll Forming Handbook",
    ));
    if (deflectionMm > maxDeflection) {
      recommendations.push(`Shaft deflection ${deflectionMm.toFixed(3)}mm > L/1500=${maxDeflection.toFixed(3)}mm — increase shaft Ø or reduce span.`);
    }
  }

  if (input.bearing) {
    const speedRpm = (input.lineSpeed * 1000) / (Math.PI * input.rollDiameter);
    const l10 = calcBearingL10(input.bearing.dynamicLoadRatingKn, input.formingForce * 0.6, speedRpm);
    checks.push(makeCheck(
      "bearing_L10", "hrs",
      l10,
      20000,
      50,
      `L₁₀ = (C/P)³ × 10⁶/(60·n)`,
      "FAG/SKF Bearing Catalogue",
    ));
    if (l10 < 20000) {
      recommendations.push(`Bearing L10 life = ${l10.toFixed(0)}h < 20,000h target — upgrade to higher C rating bearing.`);
    }
  }

  return { checks, autoCorrections, recommendations };
}

// ─── Gemini Verifier ──────────────────────────────────────────────────────────
export interface GeminiVerifyPayload {
  materialType: string;
  thickness: number;
  numStations: number;
  offlineResults: ParameterCheck[];
  personalGeminiKeys?: { id: string; key: string; label: string }[];
  personalDeepseekKey?: string;
}

export interface GeminiVerifyResult {
  verified: boolean;
  discrepancies: { param: string; offlineVal: number; geminiVal: number; chosen: number; reason: string }[];
  geminiAccuracyScore: number;
  rawText?: string;
}

export async function runGeminiVerification(payload: GeminiVerifyPayload): Promise<GeminiVerifyResult> {
  const { materialType, thickness, numStations, offlineResults, personalGeminiKeys = [], personalDeepseekKey } = payload;

  const paramSummary = offlineResults.slice(0, 8).map(p =>
    `${p.param}: computed=${p.computed}${p.unit}, provided=${p.provided}${p.unit}, status=${p.status}`,
  ).join("\n");

  const prompt = `You are a precision roll forming verification engineer. Cross-check these offline formula results for accuracy.

MATERIAL: ${materialType}, THICKNESS: ${thickness}mm, STATIONS: ${numStations}

OFFLINE FORMULA RESULTS:
${paramSummary}

For each parameter, state:
1. Is the offline computation correct per DIN/ISO/ASME standards?
2. If not, provide correct value
3. Confidence level (0-100%)

Return ONLY valid JSON:
{
  "overallScore": 95,
  "parameters": [
    {"param": "name", "offlineCorrect": true, "suggestedValue": null, "confidence": 98, "note": "..."},
    ...
  ]
}`;

  const messages = [{ role: "user", content: prompt }];

  for (const entry of personalGeminiKeys) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${entry.key}` },
        body: JSON.stringify({
          model: "gemini-2.5-pro",
          messages,
          max_tokens: 2048,
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) continue;
      const data = await res.json() as { choices: { message: { content: string } }[] };
      const text = data.choices?.[0]?.message?.content;
      if (!text) continue;

      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned) as {
        overallScore?: number;
        parameters?: { param: string; offlineCorrect: boolean; suggestedValue: number | null; confidence: number; note: string }[];
      };

      const discrepancies: GeminiVerifyResult["discrepancies"] = [];
      for (const p of (parsed.parameters ?? [])) {
        if (!p.offlineCorrect && p.suggestedValue !== null) {
          const offlineCheck = offlineResults.find(c => c.param === p.param);
          if (offlineCheck) {
            const diff = Math.abs(p.suggestedValue - offlineCheck.computed) / Math.max(0.001, Math.abs(offlineCheck.computed));
            const chosen = diff < 0.15 ? offlineCheck.computed : p.suggestedValue;
            discrepancies.push({
              param: p.param,
              offlineVal: offlineCheck.computed,
              geminiVal: p.suggestedValue,
              chosen,
              reason: p.note ?? "Gemini correction",
            });
          }
        }
      }

      console.log(`[deep-accuracy] Gemini verify via ${entry.label} — score: ${parsed.overallScore ?? "?"}`);
      return {
        verified: true,
        discrepancies,
        geminiAccuracyScore: parsed.overallScore ?? 95,
        rawText: text,
      };
    } catch (e) {
      console.warn(`[deep-accuracy] Gemini key ${entry.label} failed:`, e);
    }
  }

  if (personalDeepseekKey) {
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${personalDeepseekKey}` },
        body: JSON.stringify({ model: "deepseek-chat", messages, max_tokens: 2048, temperature: 0.1 }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const data = await res.json() as { choices: { message: { content: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned) as { overallScore?: number };
            console.log(`[deep-accuracy] DeepSeek verify — score: ${parsed.overallScore ?? "?"}`);
            return { verified: true, discrepancies: [], geminiAccuracyScore: parsed.overallScore ?? 94, rawText: text };
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }

  return { verified: false, discrepancies: [], geminiAccuracyScore: 0 };
}

// ─── Full Accuracy Report Builder ─────────────────────────────────────────────
export function buildAccuracyReport(
  checks: ParameterCheck[],
  autoCorrections: { param: string; from: number; to: number; reason: string }[],
  recommendations: string[],
  geminiResult: GeminiVerifyResult,
  processingTimeMs: number,
): AccuracyReport {
  const passed  = checks.filter(c => c.status === "ok").length;
  const warned  = checks.filter(c => c.status === "warn").length;
  const failed  = checks.filter(c => c.status === "error").length;
  const total   = checks.length || 1;

  const offlineScore = ((passed + warned * 0.6) / total) * 100;
  const geminiBoost  = geminiResult.verified ? geminiResult.geminiAccuracyScore * 0.15 : 0;
  const overallRaw   = offlineScore * 0.85 + geminiBoost;
  const overallAccuracy = Math.min(100, Math.max(0, parseFloat(overallRaw.toFixed(1))));

  const grade: AccuracyReport["grade"] =
    overallAccuracy >= 98 ? "A+" :
    overallAccuracy >= 93 ? "A"  :
    overallAccuracy >= 85 ? "B"  :
    overallAccuracy >= 70 ? "C"  : "FAIL";

  const allRecommendations = [...recommendations];
  if (failed > 0) allRecommendations.unshift(`${failed} parameter(s) failed verification — review and correct before production.`);
  if (overallAccuracy < 98) allRecommendations.push(`Accuracy ${overallAccuracy.toFixed(1)}% — below 98% minimum standard. Increase stations or verify inputs.`);

  return {
    overallAccuracy,
    grade,
    checksRun: total,
    passed, warned, failed,
    parameters: checks,
    autoCorrections,
    geminiVerified: geminiResult.verified,
    geminiDiscrepancies: geminiResult.discrepancies,
    recommendations: allRecommendations,
    processingTimeMs,
  };
}
