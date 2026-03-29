import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

interface PersonalGeminiKeyEntry { id: string; key: string; label: string }

const SUGGESTION_CATEGORIES = [
  { id: "ROLL_PROFILE",     label: "Roll Profile Design",     icon: "🔩" },
  { id: "MATERIAL_FORMING", label: "Material & Forming",      icon: "⚙️" },
  { id: "SPRINGBACK",       label: "Springback Compensation", icon: "↩️" },
  { id: "SHAFT_KEYWAY",     label: "Shaft & Keyway Design",   icon: "🔧" },
  { id: "BEARING_STAND",    label: "Bearing & Stand Design",  icon: "🏗️" },
  { id: "LINE_SPEED",       label: "Line Speed & Process",    icon: "⚡" },
  { id: "QUALITY_TOLS",     label: "Quality & Tolerances",    icon: "📏" },
  { id: "ACCURACY",         label: "Accuracy Improvement",    icon: "🎯" },
];

function buildSuggestionPrompt(payload: Record<string, unknown>): string {
  const {
    stationIndex = 1, totalStations = 10,
    materialType = "GI", thickness = 1.5,
    rollOD = 150, shaftDia = 50,
    bendAngle = 20, previousAngle = 0, finalAngle = 90,
    formingForce = 12, lineSpeed = 25, grooveDepth = 0,
    stationLabel = "S02", profileComplexity = "standard",
  } = payload;

  const stationNum = Number(stationIndex) + 1;
  const angleProg = previousAngle !== undefined
    ? `${previousAngle}° → ${bendAngle}° (+${(Number(bendAngle) - Number(previousAngle)).toFixed(1)}°)`
    : `${bendAngle}°`;

  return `You are a senior precision roll forming engineer with 25+ years of experience in industrial roll forming lines, DIN standards, and press tooling.

TASK: Analyze station ${stationNum} of ${totalStations} in a flower pattern design and provide EXACTLY 10 specific, actionable engineering improvement suggestions for EACH of the 8 categories below.

STATION DATA:
- Station: #${stationNum} / ${totalStations} (label: ${stationLabel})
- Material: ${materialType} (Galvanized Iron / CR / HR / SS / AL / MS)
- Thickness: ${thickness}mm
- Bend Angle (this station): ${angleProg}
- Target Final Angle: ${finalAngle}°
- Roll OD: ${rollOD}mm
- Shaft Diameter: Ø${shaftDia}mm
- Forming Force: ${formingForce} kN
- Line Speed: ${lineSpeed} m/min
- Groove Depth: ${grooveDepth}mm
- Profile Complexity: ${profileComplexity}

RULES:
- Each suggestion must be specific to station ${stationNum} data above (mention actual values)
- Each suggestion must be a complete actionable sentence (not vague)
- Reference DIN / ISO / ASME / Shigley's standards where applicable
- Do NOT repeat the same suggestion across categories
- Return ONLY valid JSON, no markdown, no explanation outside JSON

Return this EXACT JSON structure:
{
  "stationNum": ${stationNum},
  "totalStations": ${totalStations},
  "categories": [
    {
      "id": "ROLL_PROFILE",
      "label": "Roll Profile Design",
      "icon": "🔩",
      "suggestions": [
        "Suggestion 1 about roll profile...",
        "Suggestion 2...",
        "Suggestion 3...",
        "Suggestion 4...",
        "Suggestion 5...",
        "Suggestion 6...",
        "Suggestion 7...",
        "Suggestion 8...",
        "Suggestion 9...",
        "Suggestion 10..."
      ]
    },
    {
      "id": "MATERIAL_FORMING",
      "label": "Material & Forming",
      "icon": "⚙️",
      "suggestions": ["...10 suggestions..."]
    },
    {
      "id": "SPRINGBACK",
      "label": "Springback Compensation",
      "icon": "↩️",
      "suggestions": ["...10 suggestions..."]
    },
    {
      "id": "SHAFT_KEYWAY",
      "label": "Shaft & Keyway Design",
      "icon": "🔧",
      "suggestions": ["...10 suggestions..."]
    },
    {
      "id": "BEARING_STAND",
      "label": "Bearing & Stand Design",
      "icon": "🏗️",
      "suggestions": ["...10 suggestions..."]
    },
    {
      "id": "LINE_SPEED",
      "label": "Line Speed & Process",
      "icon": "⚡",
      "suggestions": ["...10 suggestions..."]
    },
    {
      "id": "QUALITY_TOLS",
      "label": "Quality & Tolerances",
      "icon": "📏",
      "suggestions": ["...10 suggestions..."]
    },
    {
      "id": "ACCURACY",
      "label": "Accuracy Improvement",
      "icon": "🎯",
      "suggestions": ["...10 suggestions..."]
    }
  ]
}`;
}

function buildOfflineSuggestions(payload: Record<string, unknown>) {
  const stationNum = Number(payload.stationIndex ?? 1) + 1;
  const mat = String(payload.materialType ?? "GI");
  const thk = Number(payload.thickness ?? 1.5);
  const rollOD = Number(payload.rollOD ?? 150);
  const shaft = Number(payload.shaftDia ?? 50);
  const angle = Number(payload.bendAngle ?? 20);
  const force = Number(payload.formingForce ?? 12);
  const speed = Number(payload.lineSpeed ?? 25);
  const prevAngle = Number(payload.previousAngle ?? 0);
  const delta = angle - prevAngle;

  return {
    stationNum,
    categories: [
      {
        id: "ROLL_PROFILE", label: "Roll Profile Design", icon: "🔩",
        suggestions: [
          `Station ${stationNum}: Verify roll OD ${rollOD}mm with groove depth = ${(rollOD * 0.12).toFixed(1)}mm (12% OD rule) for ${thk}mm material.`,
          `Use radius ratio ID/OD ≥ 0.55 for station ${stationNum} roll to avoid stress concentration on ${mat} material.`,
          `Apply DIN 6935 bend radius ≥ 1.5t = ${(1.5 * thk).toFixed(2)}mm at station ${stationNum} groove root.`,
          `Station ${stationNum}: Groove angle = ${angle}° + springback ${mat === "GI" ? "5°" : mat === "SS" ? "18°" : "8°"} → use ${(angle * (mat === "SS" ? 1.20 : 1.08)).toFixed(1)}° groove.`,
          `Roll face width for station ${stationNum} = profile contact width × 1.15 safety margin.`,
          `Use D2 tool steel (62 HRC) or EN31 for station ${stationNum} rolls with ${thk}mm ${mat} material.`,
          `Station ${stationNum}: Upper/lower roll nip angle must be symmetric within ±0.5° for uniform forming.`,
          `Station ${stationNum}: Groove land width = ${(thk * 3).toFixed(2)}mm to prevent material edge marking.`,
          `Apply 0.2° draft angle on groove sidewalls at station ${stationNum} to reduce material drag and galling.`,
          `Station ${stationNum}: Verify roll gap = ${(thk * 1.05).toFixed(3)}mm (5% clearance) for ${mat} ${thk}mm stock.`,
        ],
      },
      {
        id: "MATERIAL_FORMING", label: "Material & Forming", icon: "⚙️",
        suggestions: [
          `${mat} at ${thk}mm: Yield strength = ${mat === "GI" ? "280" : mat === "SS" ? "520" : mat === "CR" ? "340" : mat === "HR" ? "250" : mat === "AL" ? "270" : mat === "HSLA" ? "550" : mat === "CU" ? "200" : mat === "TI" ? "880" : "250"}MPa — verify forming force ${force}kN ≥ calculated minimum at station ${stationNum}.`,
          `Station ${stationNum}: K-factor = ${mat === "GI" ? "0.44" : mat === "SS" ? "0.50" : mat === "HR" ? "0.42" : mat === "AL" ? "0.43" : mat === "HSLA" ? "0.45" : mat === "TI" ? "0.50" : "0.44"} for ${mat} — use in blank width calculation.`,
          `${mat} elongation = ${mat === "GI" ? "22" : mat === "SS" ? "40" : "18"}% — adequate for ${delta.toFixed(1)}° forming at station ${stationNum}.`,
          `Station ${stationNum}: Apply ${mat === "SS" ? "chlorine-free" : "standard EP"} roll forming oil at ${speed}m/min line speed.`,
          `Coil temper: Use 1/4H for ${mat} to balance formability vs spring control at station ${stationNum} ${angle}° bend.`,
          `Station ${stationNum}: Check minimum bend radius = ${(thk * (mat === "SS" ? 2.0 : 1.5)).toFixed(2)}mm (${mat} per DIN EN 10130).`,
          `${mat} ${thk}mm: Forming force at station ${stationNum} = σ_y × t² / (Ri + t/2) = ${force}kN — verify press capacity.`,
          `Station ${stationNum}: ${mat} work hardening index n = ${mat === "SS" ? "0.47" : "0.22"} — include in multi-pass simulation.`,
          `Apply anti-galling coating (TiN/TiCN) on station ${stationNum} rolls for ${mat} forming > 1000 m/shift output.`,
          `Station ${stationNum}: Verify ${mat} material certificate tensile, yield, and elongation per EN 10025-2.`,
        ],
      },
      {
        id: "SPRINGBACK", label: "Springback Compensation", icon: "↩️",
        suggestions: [
          `Station ${stationNum}: ${mat} springback factor = ${mat === "GI" ? "1.05" : mat === "SS" ? "1.20" : mat === "CR" ? "1.08" : "1.06"} → overbend to ${(angle * (mat === "SS" ? 1.20 : 1.08)).toFixed(1)}°.`,
          `Station ${stationNum}: Use 2.5% springback rule — overbend = target ${angle}° × 1.025 = ${(angle * 1.025).toFixed(1)}°.`,
          `Add calibration/sizing pass after station ${stationNum} if bend tolerance < ±0.5° required per DIN EN 10162.`,
          `Station ${stationNum}: Springback increases with t = ${thk}mm and Ri — reduce groove radius by ${(thk * 0.15).toFixed(2)}mm compensation.`,
          `Use FEA (COPRA RF or AutoForm) to simulate station ${stationNum} springback for ${mat} at exact ${thk}mm thickness.`,
          `Station ${stationNum}: Include overbend angle in roll groove CAD drawing — tolerance ±0.25° on springback comp.`,
          `For ${mat} at ${thk}mm — verify springback with sample run and measure actual angle vs target ${angle}°.`,
          `Station ${stationNum}: Higher line tension (back tension) reduces springback by 15-20% — set web tension.`,
          `Station ${stationNum}: Lower the die temperature (controlled cooling) to reduce elastic recovery in ${mat}.`,
          `Station ${stationNum}: Multi-bend compensation — if prior station at ${prevAngle}° springback = X, adjust station ${stationNum} by cumulative error.`,
        ],
      },
      {
        id: "SHAFT_KEYWAY", label: "Shaft & Keyway Design", icon: "🔧",
        suggestions: [
          `Station ${stationNum}: Shaft Ø${shaft}mm — verify Shigley's SF = σ_yield / σ_eq ≥ 2.5 under ${force}kN forming force.`,
          `Station ${stationNum}: Use DIN 6885-A keyway for Ø${shaft}mm shaft = b×h = ${shaft >= 50 && shaft < 58 ? "14×9" : shaft >= 58 && shaft < 65 ? "16×10" : shaft >= 65 && shaft < 75 ? "18×11" : "20×12"}mm.`,
          `Station ${stationNum}: Key length L_key = 1.5 × Ø${shaft} = ${(1.5 * shaft).toFixed(0)}mm minimum per DIN 6885-A.`,
          `Station ${stationNum}: Shaft ISO fit = h6 (${shaft}h6), Roll bore = H7 (${shaft}H7) — precision interference.`,
          `Apply Ra ≤ 0.8µm surface finish on shaft journal at station ${stationNum} for rolling contact fatigue life.`,
          `Station ${stationNum}: Use DIN 981 locknut M${shaft}×1.5 + tab washer to secure roll axially.`,
          `Verify shaft deflection at station ${stationNum} under ${force}kN load — max deflection ≤ L/1500 = ${((rollOD * 2) / 1500).toFixed(3)}mm.`,
          `Station ${stationNum}: Use 42CrMo4 (EN19) shaft material — σ_yield = 900MPa at QT-condition for Ø${shaft}mm.`,
          `Station ${stationNum}: Apply induction hardening on shaft journal (55-60 HRC, depth 1.5-2mm) for wear resistance.`,
          `Station ${stationNum}: Keyway stress concentration Kf = 1.6 (ASME end-mill) — include in fatigue life calculation.`,
        ],
      },
      {
        id: "BEARING_STAND", label: "Bearing & Stand Design", icon: "🏗️",
        suggestions: [
          `Station ${stationNum}: Select FAG/SKF 6300 series deep groove ball bearing for radial load from ${force}kN forming force.`,
          `Station ${stationNum}: Bearing dynamic load rating C ≥ ${(force * 3.5).toFixed(0)}kN for L₁₀ = 20,000 hours at ${speed}m/min.`,
          `Station ${stationNum}: Use sealed bearing (2RS) to prevent roll oil contamination ingress at Ø${shaft}mm bore.`,
          `Station ${stationNum}: Stand pitch (center-to-center) = Roll OD ${rollOD}mm + clearance 40mm = ${rollOD + 40}mm minimum.`,
          `Station ${stationNum}: Use self-aligning bearing (1200 series) if shaft deflection > ${((rollOD * 2) / 1000).toFixed(2)}mm to prevent edge loading.`,
          `Station ${stationNum}: Stand material = GG25 cast iron or fabricated steel (S355) — FEA verify 3× forming load.`,
          `Station ${stationNum}: Adjustable upper roll housing with fine-pitch screw M20×2 for roll gap setting.`,
          `Station ${stationNum}: Apply ISO VG 220 gear oil (or NLGI #2 grease) to bearings — relubricate every 500 hours.`,
          `Station ${stationNum}: Bearing temperature limit = 80°C — install PT100 sensor on critical station housings.`,
          `Station ${stationNum}: Stand alignment to pass line ±0.05mm — use precision ground mounting pads on mill bed.`,
        ],
      },
      {
        id: "LINE_SPEED", label: "Line Speed & Process", icon: "⚡",
        suggestions: [
          `Station ${stationNum}: Current speed ${speed}m/min — max recommended for ${mat} at ${thk}mm = ${Math.round(Math.min(40, speed * 1.3))}m/min.`,
          `Station ${stationNum}: Motor torque at ${speed}m/min = ${(force * rollOD / 2 / 1000).toFixed(2)}kNm — verify gearbox output.`,
          `Station ${stationNum}: Lubrication flow rate = ${(thk * speed * 0.012).toFixed(2)} L/min for ${mat} forming at ${speed}m/min.`,
          `Station ${stationNum}: Forming power = F × v = ${force}kN × ${(speed / 60).toFixed(2)}m/s = ${(force * speed / 60).toFixed(1)}kW — include 15% drive losses.`,
          `Station ${stationNum}: Check strip tension between stations — max tension < 20% of material yield force.`,
          `Station ${stationNum}: At ${speed}m/min, surface speed of Ø${rollOD}mm roll = ${(Math.PI * rollOD * speed / (Math.PI * rollOD)).toFixed(2)} rev/s — verify no resonance.`,
          `Station ${stationNum}: Apply coolant mist (not flood) for ${mat === "SS" ? "SS stainless" : mat} forming to prevent heat buildup.`,
          `Station ${stationNum}: Reduce speed to ${Math.round(speed * 0.7)}m/min for first 500m production run to set roll gap properly.`,
          `Station ${stationNum}: Monitor station ${stationNum} forming force continuously — ±15% variation triggers line stop.`,
          `Station ${stationNum}: Synchronize drive speed within ±0.5% across all ${Number(payload.totalStations ?? 10)} stations to prevent strip buckling.`,
        ],
      },
      {
        id: "QUALITY_TOLS", label: "Quality & Tolerances", icon: "📏",
        suggestions: [
          `Station ${stationNum}: Bend angle tolerance = ±${angle > 60 ? "1.0" : "0.5"}° per DIN EN 10162 Table 6.`,
          `Station ${stationNum}: Profile dimensional tolerance = ±0.3mm on critical dimensions ≤ 50mm (DIN EN 10162).`,
          `Station ${stationNum}: Measure station ${stationNum} sample every 500m of production using optical CMM or profile projector.`,
          `Station ${stationNum}: Roll surface hardness inspection every 6 months — min 58 HRC for D2 steel rolls.`,
          `Station ${stationNum}: Verify surface finish Ra ≤ ${mat === "SS" ? "0.4" : "0.8"}µm on formed surface — avoid tooling marks.`,
          `Station ${stationNum}: Straightness tolerance = 1mm per 1000mm length for formed section (DIN EN 10162 Clause 7).`,
          `Station ${stationNum}: Twist tolerance ≤ 1°/m — check with precision level on 2m sample from station ${stationNum}.`,
          `Station ${stationNum}: Roll gap measurement with dial gauge — accuracy ±0.01mm, record on QC sheet each shift.`,
          `Station ${stationNum}: Establish SPC chart for station ${stationNum} angle — Cpk target ≥ 1.33 for Ppk ≥ 1.0.`,
          `Station ${stationNum}: Include go/no-go gauge for critical profile dimension at station ${stationNum} in process control plan.`,
        ],
      },
      {
        id: "ACCURACY", label: "Accuracy Improvement", icon: "🎯",
        suggestions: [
          `Station ${stationNum}: Re-check forming sequence — delta angle ${delta.toFixed(1)}°/station is ${delta > 15 ? "HIGH (>15°), consider splitting into 2 sub-passes" : "within 10-15° recommended range"}.`,
          `Station ${stationNum}: Laser alignment of upper/lower roll centerlines — parallelism ≤ 0.02mm/100mm.`,
          `Station ${stationNum}: After ${mat} springback (factor ${mat === "SS" ? "1.20" : "1.08"}), final angle = ${(angle / (mat === "SS" ? 1.20 : 1.08)).toFixed(1)}° — add overbend in groove.`,
          `Station ${stationNum}: Use Faro arm or optical CMM to verify roll profile matches drawing — ±0.025mm.`,
          `Station ${stationNum}: Check strip entry guide alignment — misalignment >0.2mm causes ${stationNum < 4 ? "early" : "mid"}-line deformation.`,
          `Station ${stationNum}: Roll runout check — max TIR ≤ 0.02mm for Ø${rollOD}mm at station ${stationNum}.`,
          `Station ${stationNum}: Implement real-time laser profile scanner after station ${stationNum} — feedback to servo gap control.`,
          `Station ${stationNum}: Recalibrate roll gap weekly using master gauge block — compensation ±0.005mm.`,
          `Station ${stationNum}: Verify bearing clearance — if >0.03mm, replace bearing to eliminate pass-line variation.`,
          `Station ${stationNum}: Document all station ${stationNum} roll gap settings in setup sheet — reproducible within 0.02mm shift to shift.`,
        ],
      },
    ],
  };
}

async function callCodexForSuggestions(prompt: string): Promise<string | null> {
  const orKey = process.env["AI_INTEGRATIONS_OPENROUTER_API_KEY"]
    ?? process.env["OPENROUTER_API_KEY_"]
    ?? process.env["OPENROUTER_API_KEY"];
  if (!orKey) return null;
  const orUrl = `${process.env["AI_INTEGRATIONS_OPENROUTER_BASE_URL"] ?? "https://openrouter.ai"}/chat/completions`;
  try {
    const res = await fetch(orUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${orKey}` },
      body: JSON.stringify({
        model: "o4-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 8192,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices: { message: { content: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (text) { console.log("[flower-suggestions] OpenRouter Codex Mini ok"); return text; }
  } catch (e) {
    console.warn("[flower-suggestions] OpenRouter Codex Mini failed:", e);
  }
  return null;
}

router.post("/flower-suggestions", async (req: Request, res: Response) => {
  try {
    const {
      stationIndex = 1,
      totalStations = 10,
      materialType = "GI",
      thickness = 1.5,
      rollOD = 150,
      shaftDia = 50,
      bendAngle = 20,
      previousAngle = 0,
      finalAngle = 90,
      formingForce = 12,
      lineSpeed = 25,
      grooveDepth = 0,
      stationLabel = "S02",
      profileComplexity = "standard",
      personalGeminiKeys = [],
      personalDeepseekKey,
    } = req.body as Record<string, unknown> & {
      personalGeminiKeys?: PersonalGeminiKeyEntry[];
      personalDeepseekKey?: string;
    };

    const payload = {
      stationIndex, totalStations, materialType, thickness, rollOD, shaftDia,
      bendAngle, previousAngle, finalAngle, formingForce, lineSpeed,
      grooveDepth, stationLabel, profileComplexity,
    };

    let aiText: string | null = null;
    let usedAI = false;

    const prompt = buildSuggestionPrompt(payload);
    aiText = await callCodexForSuggestions(prompt);

    if (aiText) {
      try {
        const cleaned = aiText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned) as { categories: { id: string; label: string; icon: string; suggestions: string[] }[]; stationNum?: number };
        if (parsed.categories && Array.isArray(parsed.categories)) {
          usedAI = true;
          const stNum = Number(stationIndex) + 1;
          res.json({ ok: true, usedAI: true, stationNum: stNum, categories: parsed.categories });
          console.log(`[flower-suggestions] AI success — ${parsed.categories.length} categories`);
          return;
        }
      } catch (e) {
        console.warn("[flower-suggestions] AI JSON parse failed, using offline:", e);
      }
    }

    const offline = buildOfflineSuggestions(payload);
    res.json({ ok: true, usedAI, ...offline });
    console.log(`[flower-suggestions] Offline fallback — station ${offline.stationNum}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[flower-suggestions] Error:", msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

export default router;
