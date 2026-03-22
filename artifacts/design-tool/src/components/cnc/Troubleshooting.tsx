import React, { useState, useMemo, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle, ChevronRight, Wrench, Settings, Zap, Brain, WifiOff, Wifi, Loader2 } from "lucide-react";
import { useCncStore } from "../../store/useCncStore";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useAccuracyScoring } from "../../hooks/useAccuracyScoring";
import { AccuracyBadge } from "./AccuracyBadge";
import { authFetch } from "../../lib/auth-fetch";

interface Defect {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Cause {
  cause: string;
  probability: "high" | "medium" | "low";
  fix: string;
  stand?: string;
}

interface Diagnosis {
  rootCauses: Cause[];
  immediateActions: string[];
  preventionTips: string[];
  rollAdjustment: string;
  processChange: string;
}

const DEFECTS: Defect[] = [
  { id: "twist", name: "Twist", description: "Profile rotating along length axis", icon: "🔄" },
  { id: "camber", name: "Camber (Curve)", description: "Profile bending sideways / curving in horizontal plane", icon: "↪" },
  { id: "flare", name: "End Flare", description: "Profile opening up at entry or exit end", icon: "📐" },
  { id: "wrinkle", name: "Wrinkle / Buckle", description: "Surface wrinkles especially near bends", icon: "〰" },
  { id: "edge_wave", name: "Edge Wave", description: "Wavy edges running along the length", icon: "🌊" },
  { id: "size_mismatch", name: "Profile Size Mismatch", description: "Final profile dimensions not matching drawing", icon: "📏" },
  { id: "twist_entry", name: "Entry Twist", description: "Material twisting just after entry guide", icon: "↩" },
  { id: "crack", name: "Cracking at Bend", description: "Material cracking or breaking at bend zones", icon: "⚡" },
  { id: "surface_scratch", name: "Surface Scratches", description: "Scratch marks on profile surface", icon: "〃" },
  { id: "bow", name: "Bow / Longitudinal Camber", description: "Profile bowing up or down along length", icon: "⌒" },
  { id: "os_twist", name: "Open Sect. — Twist", description: "C/Z/U profile twisting — open section specific causes", icon: "🔄" },
  { id: "os_bow", name: "Open Sect. — Bow", description: "C/Z/Hat profile bowing — web buckling or pass line error", icon: "⌒" },
  { id: "os_edge_wave", name: "Open Sect. — Edge Wave", description: "Flange edge wave on open section (C-channel / Z-purlin)", icon: "🌊" },
  { id: "os_crack", name: "Open Sect. — Cracking", description: "Crack at flange bend — open section tight-radius failure", icon: "⚡" },
];

const DIAGNOSIS_DATABASE: Record<string, Diagnosis> = {
  twist: {
    rootCauses: [
      { cause: "Asymmetric forming forces on left/right sides", probability: "high", fix: "Re-check roll gap on both sides using feeler gauge. Ensure equal gap left & right.", stand: "All stands" },
      { cause: "Guide misalignment at entry", probability: "high", fix: "Re-center entry guide. Check strip tracking from coil to first pass.", stand: "Entry" },
      { cause: "Unequal roll wear", probability: "medium", fix: "Measure roll diameters. Replace worn roll or regrind to match.", stand: "Stands 2-4" },
      { cause: "Coil set not removed (strip has pre-existing bow)", probability: "medium", fix: "Use straightener/flattener before entry. Increase back tension.", stand: "Before Stand 1" },
      { cause: "Over-forming in one pass causing residual stress", probability: "low", fix: "Reduce bend angle increment for problematic pass. Add intermediate station.", stand: "Stand 3-4" },
    ],
    immediateActions: [
      "Stop line and check entry strip alignment",
      "Measure roll gap on both sides at each stand",
      "Check if twist is consistent or intermittent",
      "Verify coil set direction matches machine setup",
    ],
    preventionTips: [
      "Use coil straightener before forming",
      "Check roll gap every 4 hours during long runs",
      "Mark roll position during setup for repeatable alignment",
      "Use side guide rollers between stands for asymmetric profiles",
    ],
    rollAdjustment: "Check side roll clearance. Side roll pressure should be equal on both sides. Worn side rolls cause twist.",
    processChange: "Reduce line speed by 20% to stabilize forming. Check material coil tension.",
  },
  camber: {
    rootCauses: [
      { cause: "Unequal forming on left vs right edge of strip", probability: "high", fix: "Check if strip width is uniform. Measure strip width at entry and exit.", stand: "All stands" },
      { cause: "Roll wear on one side only", probability: "high", fix: "Inspect upper and lower rolls for uneven wear. Regrind or replace.", stand: "Most active stands" },
      { cause: "Strip edge damage or uneven slit edges", probability: "medium", fix: "Check slit quality. Uneven edges cause differential elongation.", stand: "N/A" },
      { cause: "Temperature differential (one side heating more)", probability: "low", fix: "Check coolant flow. Ensure lubricant applied evenly.", stand: "High-load stands" },
    ],
    immediateActions: [
      "Measure camber over 2 meter length (max 2mm/2m for most profiles)",
      "Check strip width consistency",
      "Check if camber is consistent direction or alternating",
      "Inspect roll surface for wear patterns",
    ],
    preventionTips: [
      "Use quality-slit coils with consistent width tolerance",
      "Rotate rolls periodically for even wear",
      "Apply uniform lubrication across full strip width",
      "Add final straightening roll at exit",
    ],
    rollAdjustment: "Add or adjust final leveling/straightening pass. Slight differential in last stand can correct camber.",
    processChange: "Reduce forming speed if camber appears at high speed but not slow speed.",
  },
  flare: {
    rootCauses: [
      { cause: "Over-forming in pre-finish stations (springback not compensated enough)", probability: "high", fix: "Add calibration station at end. Increase over-forming in last 2 stations.", stand: "Last 2 stations" },
      { cause: "Insufficient calibration pass", probability: "high", fix: "Add a sizing/calibration station with closed profile.", stand: "Final station" },
      { cause: "Residual stress release at cut-off", probability: "medium", fix: "Adjust cut-off timing. Flying cut vs stop-cut makes difference.", stand: "Cut-off" },
      { cause: "Springback not calculated correctly for material", probability: "medium", fix: "Increase over-bending by 5-8° in final pass for SS. 2-3° for GI.", stand: "Finish station" },
    ],
    immediateActions: [
      "Measure flare angle at profile end",
      "Check if flare is at entry end, exit end, or both",
      "Verify final station roll gap matches drawing",
      "Check spring back by forming short piece at low speed",
    ],
    preventionTips: [
      "Always include calibration/sizing station in design",
      "Compensate springback in design: SS +15-20%, GI +5%, CR +8%",
      "Check profile 30 seconds after forming to measure actual springback",
    ],
    rollAdjustment: "Close calibration roll gap by 0.1-0.2mm increments until flare is eliminated.",
    processChange: "Reduce line speed. Higher speed = more flare due to dynamic effects.",
  },
  wrinkle: {
    rootCauses: [
      { cause: "Too rapid angle progression — over-forming per station", probability: "high", fix: "Reduce bend angle increment. Add 1-2 intermediate stations.", stand: "Stands 2-4" },
      { cause: "Edge elongation (material stretching at outer edge)", probability: "high", fix: "Reduce forming speed. Check material YS vs forming forces.", stand: "All forming stands" },
      { cause: "Material is too soft for forming speed", probability: "medium", fix: "Reduce line speed. Soft materials need gentler progression.", stand: "N/A" },
      { cause: "Roll gap too tight — squeezing material into wrinkle", probability: "medium", fix: "Open roll gap slightly. Gap should be thickness + clearance.", stand: "Problem stand" },
    ],
    immediateActions: [
      "Identify exact station where wrinkle starts forming",
      "Reduce line speed immediately",
      "Check roll gap at wrinkle station — may be too tight",
      "Check if wrinkle is at bend zone or flat zone",
    ],
    preventionTips: [
      "Max 15-20° bend per station for standard profiles",
      "Use more stations for high-strength materials",
      "Ensure material thickness is within ±5% tolerance",
      "Apply proper lubrication to reduce friction",
    ],
    rollAdjustment: "Open roll gap slightly at problem station. Add edge-forming rolls if available.",
    processChange: "Reduce line speed to 50% and observe. Gradually increase speed after eliminating wrinkle.",
  },
  edge_wave: {
    rootCauses: [
      { cause: "Strip off-center — not tracking properly", probability: "high", fix: "Re-center entry guide. Check coil centering on mandrel.", stand: "Entry" },
      { cause: "Edge elongation due to over-forming", probability: "high", fix: "Reduce forming speed. Check bend progression is gradual.", stand: "Forming stands" },
      { cause: "Strip width exceeds roll face width at edge", probability: "medium", fix: "Check strip width vs roll face width. Edge should be contained.", stand: "All stands" },
      { cause: "Insufficient back tension on uncoiler", probability: "low", fix: "Increase uncoiler brake tension for better strip control.", stand: "Before Stand 1" },
    ],
    immediateActions: [
      "Check strip centerline tracking through all stands",
      "Measure edge wave amplitude and frequency",
      "Check if edge wave appears only at starts/stops or continuously",
      "Inspect side guide settings",
    ],
    preventionTips: [
      "Use side roll guides between stands",
      "Consistent strip width is critical — use quality slit coils",
      "Proper uncoiler tension prevents flutter and edge wave",
    ],
    rollAdjustment: "Add edge-containment rolls. Adjust side guide pressure to lightly touch strip edges.",
    processChange: "Reduce speed. Check coil tension settings on uncoiler.",
  },
  size_mismatch: {
    rootCauses: [
      { cause: "Springback not compensated in roll design", probability: "high", fix: "Increase over-bending. For GI add 3-5%, for SS add 15-20% over-bending.", stand: "Final station" },
      { cause: "Material thickness different from design assumption", probability: "high", fix: "Re-measure material thickness. Adjust roll gap if thickness changed.", stand: "All stands" },
      { cause: "Roll wear reducing forming accuracy", probability: "medium", fix: "Measure roll profile. Regrind or replace worn rolls.", stand: "Worn stands" },
      { cause: "Calibration stand not closing fully", probability: "medium", fix: "Check calibration roll gap. Close incrementally until size is correct.", stand: "Final stand" },
    ],
    immediateActions: [
      "Measure profile at 5 points along length",
      "Measure at multiple cross-section locations",
      "Check material thickness with micrometer",
      "Compare with design drawing dimensions",
    ],
    preventionTips: [
      "Set up with trial piece before production run",
      "Measure and document roll gap settings for each material lot",
      "Use go/no-go gauges for quick size verification",
      "Keep material thickness tolerances within ±0.05mm",
    ],
    rollAdjustment: "Close or open specific stand gaps systematically. One stand at a time. Document changes.",
    processChange: "Run at slow speed for setup. Speed affects final size slightly due to dynamic effects.",
  },
  twist_entry: {
    rootCauses: [
      { cause: "Entry guide too far from first roll stand", probability: "high", fix: "Move entry guide closer to Stand 1. Max gap 200-300mm for thin material.", stand: "Entry to Stand 1" },
      { cause: "Entry guide not centered with roll centerline", probability: "high", fix: "Align entry guide precisely with roll center using laser or string.", stand: "Entry" },
      { cause: "Coil set in material causing twist before forming", probability: "medium", fix: "Use straightener. Increase straightener roller pressure.", stand: "Before entry" },
    ],
    immediateActions: [
      "Check entry guide position and alignment",
      "Verify guide gap is correct for strip width",
      "Check if coil set is causing initial twist",
    ],
    preventionTips: [
      "Entry guide should be adjustable for center and height",
      "Use 3-roll straightener before entry for coiled material",
      "Mark center on machine table as reference",
    ],
    rollAdjustment: "No roll adjustment needed — entry guide alignment is primary fix.",
    processChange: "Run at 30% speed to observe entry behavior. Adjust guides while running slowly.",
  },
  crack: {
    rootCauses: [
      { cause: "Bend radius too small for material", probability: "high", fix: "Increase bend radius in roll design. Min radius = 1-2x material thickness.", stand: "Tight bend stands" },
      { cause: "Material work-hardened from previous process", probability: "high", fix: "Check if material was cold-worked. Use annealed material if possible.", stand: "N/A" },
      { cause: "SS / high-strength material forming too fast", probability: "medium", fix: "Reduce line speed significantly. For SS max 10-15 m/min.", stand: "All stands" },
      { cause: "Sharp corner on roll surface causing stress concentration", probability: "medium", fix: "Add small chamfer/radius on roll edge at crack location.", stand: "Problem stand" },
    ],
    immediateActions: [
      "Stop production immediately",
      "Examine crack location — is it outer radius or inner radius?",
      "Check material certification for yield strength",
      "Check minimum bend radius vs design radius",
    ],
    preventionTips: [
      "Always verify minimum bend radius before design",
      "For SS: min radius = 2x thickness",
      "For GI/CR: min radius = 0.5-1x thickness",
      "Anneal material if required for tight bends",
      "Use lubricant on all forming surfaces",
    ],
    rollAdjustment: "Increase bend radius in problem stand rolls. Cannot fix without new rolls.",
    processChange: "Reduce forming speed. Apply generous lubrication at crack location.",
  },
  surface_scratch: {
    rootCauses: [
      { cause: "Metal particles on roll surface (buildup)", probability: "high", fix: "Clean roll surface with solvent and soft cloth. Remove all particles.", stand: "Problem stand" },
      { cause: "Roll surface finish too rough", probability: "high", fix: "Polish roll surface with fine abrasive. Target Ra 0.4-0.8 for GI/Al.", stand: "Problem stand" },
      { cause: "No lubrication or insufficient lubrication", probability: "medium", fix: "Apply forming oil. Aluminum needs oil on both surfaces.", stand: "All stands" },
      { cause: "Hard particle in material (inclusion)", probability: "low", fix: "Check material quality. Filter forming oil.", stand: "N/A" },
    ],
    immediateActions: [
      "Identify which roll/stand is causing scratch",
      "Clean roll surface and inspect",
      "Check lubrication flow at problem area",
    ],
    preventionTips: [
      "Use roll forming oil for aluminum and stainless steel always",
      "Clean rolls before every production run",
      "Polish roll surface if Ra > 1.6 micron",
      "Keep forming oil filtered and clean",
    ],
    rollAdjustment: "Polish roll surface at scratch location. Do not remove more than 0.1mm.",
    processChange: "Apply lubricant oil before problem stand. Reduce speed to allow oil film to form.",
  },
  bow: {
    rootCauses: [
      { cause: "Vertical roll alignment error — upper rolls tilted", probability: "high", fix: "Check parallelism of upper and lower roll shafts. Shim if needed.", stand: "All stands" },
      { cause: "Unequal draft (forming) in upper vs lower roll", probability: "high", fix: "Redesign rolls so upper and lower form equally. Check roll drawing.", stand: "Problem stands" },
      { cause: "Exit table not aligned with roll centerline height", probability: "medium", fix: "Adjust exit table height to match roll center height.", stand: "Exit" },
    ],
    immediateActions: [
      "Measure bow magnitude — place profile on flat surface",
      "Check if bow is consistent or varies along length",
      "Verify roll shaft parallelism with dial gauge",
    ],
    preventionTips: [
      "Check shaft alignment every 6 months",
      "Use precision level for roll shaft alignment",
      "Design rolls with equal upper/lower forming contribution",
    ],
    rollAdjustment: "Tilt upper shaft slightly to introduce correction. 0.1mm tilt per meter of shaft.",
    processChange: "Reduce speed. Bow often appears more at higher speeds due to vibration.",
  },

  os_twist: {
    rootCauses: [
      { cause: "Non-symmetric bending force on C/Z open flange — one flange over-formed", probability: "high", fix: "Re-check forming angle symmetry between top & bottom flanges. For Z-purlin, left and right must form at equal rates.", stand: "All forming stands" },
      { cause: "Roll shaft not parallel — horizontal misalignment >0.05mm/m causes helical twist", probability: "high", fix: "Level all lower roll shafts to pass line ±0.05mm/m using precision straight-edge.", stand: "Stands 3–7" },
      { cause: "Open section has no closing wall — torsional rigidity low until last passes", probability: "medium", fix: "Add side guide roll between stands 5 and 7 to restrain rotation. Keep guide clearance = strip thickness + 0.1mm.", stand: "Stands 5–7" },
      { cause: "Springback not equally compensated on both flanges of C/Z section", probability: "medium", fix: "Over-bend both flanges equally. SS: +6° over-bend, GI: +3.5°. If asymmetric over-bend, twist will result.", stand: "Finishing stands" },
      { cause: "Too-large angle increment in Major Forming zone (>15°/pass on open section)", probability: "low", fix: "Reduce angle increment to max 12°/pass. Add intermediate pass if needed.", stand: "Stands 3–5" },
    ],
    immediateActions: [
      "Place profile on flat table — measure twist with angle gauge every 500mm",
      "Acceptable twist: ≤1°/m for structural C/Z purlins",
      "Check symmetry of both flanges with caliper — width difference indicates asymmetric forming",
      "Reduce line speed to 50% and observe if twist reduces",
    ],
    preventionTips: [
      "For open sections: use side guide rolls at every 3rd stand minimum",
      "Level lower shaft pass line before each production run",
      "For C-channel: ensure both flanges reach 90° simultaneously at calibration pass",
      "Z-purlin: top and bottom flanges must have equal but mirrored forming angles",
    ],
    rollAdjustment: "Check side roll guide clearance — should be t+0.1mm. Increase side roll pressure if twist is inward. Reduce if twist is outward.",
    processChange: "Reduce speed to 10 m/min for open section startup. Check twist after 3m. Increase speed only after twist is within 1°/m.",
  },

  os_bow: {
    rootCauses: [
      { cause: "Web of C/Z section buckles under longitudinal compression — too many passes without support", probability: "high", fix: "Add center web support roll (idle roll contacting web flat face) at mid-machine. Web support prevents buckling.", stand: "Stands 4–6" },
      { cause: "Pass line height different from exit table height — profile sags between stands", probability: "high", fix: "Set all lower roll centers to identical height. Use precision level. Adjust exit conveyor to match.", stand: "All stands + exit" },
      { cause: "Entry strip has coil set bow — not straightened before forming", probability: "medium", fix: "Use 3-roll straightener before first forming stand. For heavy coil set, add heated straightener.", stand: "Before Stand 1" },
      { cause: "Over-forming in bottom roll causes concave bow", probability: "medium", fix: "Reduce lower roll forming contribution. Upper and lower should form equally on web surface.", stand: "Middle stands" },
    ],
    immediateActions: [
      "Measure bow over 2m length — place on flat surface. Max bow: 2mm/2m for structural sections",
      "Check if bow is upward (concave) or downward (convex) — direction indicates which roll set to adjust",
      "Check exit table alignment — profile drooping at exit causes apparent bow",
      "Verify entry strip flatness before forming",
    ],
    preventionTips: [
      "Use coil straightener for all open section production",
      "Web support rolls are essential for C/Z with web height >80mm",
      "Align pass line laser before every setup change",
      "For Z-purlin: both flanges must be in same horizontal plane at exit",
    ],
    rollAdjustment: "Add idle web support roll (non-driven). Set gap = web thickness. This constrains the web and prevents longitudinal buckling.",
    processChange: "Reduce speed by 30%. High-speed forming increases dynamic bow in open sections. Check bow at slow speed first.",
  },

  os_edge_wave: {
    rootCauses: [
      { cause: "Roll gap too tight on flange — squeezing material and causing it to buckle outward", probability: "high", fix: "Open flange roll gap by +0.1mm increments. Gap should be t+0.05mm (not t+0). Open sections need clearance.", stand: "Flange stands 4–8" },
      { cause: "Angle increment >15°/pass in Major Forming zone — material elongates at outer edge faster than inner", probability: "high", fix: "Reduce angle increment to max 12°/pass for CR/GI and 10°/pass for SS/HR. Add intermediate station.", stand: "Stands 3–5" },
      { cause: "Flange too wide (>80mm) without edge-containment rolls", probability: "medium", fix: "Add edge containment roll touching outer edge of flange lightly. Containment roll clearance = 0mm (touch).", stand: "Forming stands" },
      { cause: "Material grain direction perpendicular to bend — causes ripple at outer fiber", probability: "low", fix: "Check coil grain direction. Bend line should be perpendicular to grain. If not, reduce angle increment.", stand: "N/A" },
    ],
    immediateActions: [
      "Check wave frequency — high frequency (short wave) = local buckle, reduce gap. Low frequency (long wave) = elongation, reduce speed",
      "Measure flange width at problem stand — excessive elongation widens the flange",
      "Check side guide clearance — too loose allows flange to wander and wave",
      "Verify material thickness is consistent across width",
    ],
    preventionTips: [
      "Open sections: roll face width = strip width + 3mm edge clearance",
      "Never exceed 15°/pass in Major Forming zone for flanges >50mm",
      "Use edge-containment rolls for flanges >80mm",
      "For SS/HR: max 10°/pass in forming zone to prevent edge work-hardening wave",
    ],
    rollAdjustment: "Open flange gap to t+0.05mm. Touch edge-containment roll to flange edge (0 clearance). Do not allow roll to squeeze flange.",
    processChange: "Reduce line speed to 15 m/min. Edge wave increases with speed on open sections. Apply forming oil on flange bends.",
  },

  os_crack: {
    rootCauses: [
      { cause: "Inner bend radius < 1× material thickness — stress exceeds tensile elongation at outer fiber", probability: "high", fix: "Increase inner bend radius to minimum 1×t (CR/GI) or 1.5×t (SS/HR). Redesign rolls with larger corner radius.", stand: "Flange bend stands" },
      { cause: "Too few passes for 90° flange — angle jump too large per pass in Major Forming zone", probability: "high", fix: "Add intermediate passes. Max 15°/pass for CR/GI, 10°/pass for SS/HR. Open section needs gentler progression.", stand: "Stands 3–5" },
      { cause: "Material work-hardened at slitted edge — reduced ductility at bend line start", probability: "medium", fix: "Use deburring tool on slit edge. Or shift strip width by 1mm to move crack zone off edge.", stand: "N/A" },
      { cause: "Stainless steel (SS316/SS304) without lubrication — high friction increases tensile stress at outer bend", probability: "high", fix: "Apply forming oil at all SS bend contacts. Use EP (extreme pressure) oil for SS304. Run at ≤15 m/min.", stand: "All SS forming stands" },
      { cause: "Cold weather operation — material ductility reduced below 5°C", probability: "low", fix: "Warm material before forming. Pre-heat to >15°C. SS/HR especially brittle in cold.", stand: "N/A" },
    ],
    immediateActions: [
      "STOP PRODUCTION immediately — cracking causes safety and quality failure",
      "Examine crack: outer radius crack = radius too small. Inner radius crack = over-bending. Edge crack = slit quality.",
      "Check material certificate — verify elongation ≥20% for forming. If <15%, material may be wrong grade.",
      "Check bend radius with radius gauge on problem roll",
    ],
    preventionTips: [
      "Open section rule: min bend radius = 1×t for CR/GI, 1.5×t for SS304, 2×t for SS316/HR",
      "For C-channel flange corners: use rolls with r=1.5mm groove radius at minimum",
      "Apply forming oil to all flanges — especially at 45°–90° forming range",
      "For SS: reduce speed to 10–15 m/min maximum. Higher speed = less lubrication time = more cracking",
    ],
    rollAdjustment: "Regrind rolls to increase corner radius at crack location. Cannot fix cracking by adjusting gap — only radius change helps.",
    processChange: "Reduce speed to 10 m/min. Apply EP forming oil liberally. For SS: oil at every forming stand. For CR/GI: oil at first and middle stands.",
  },
};

// Map frontend defect IDs → backend offline-AI defect IDs
const DEFECT_ID_MAP: Record<string, string> = {
  twist:         "twist",
  twist_entry:   "twist",
  camber:        "bow_camber",
  bow:           "bow_camber",
  longitudinal_bow: "longitudinal_bow",
  flare:         "flare",
  edge_wave:     "edge_wave",
  crack:         "cracking",
  surface_scratch: "surface_scratch",
  wrinkle:       "oil_canning",
  size_mismatch: "gap_variation",
  springback:    "springback",
  roll_marking:  "roll_marking",
  strip_tracking: "strip_tracking",
  os_twist:      "twist",
  os_bow:        "bow_camber",
  os_edge_wave:  "edge_wave",
  os_crack:      "cracking",
};

interface AiEngineResult {
  defectName: string;
  severity: string;
  engineVersion: string;
  offlineMode: boolean;
  immediateActions: string[];
  rootCauses: { cause: string; probability: string; fix: string; stand?: string }[];
  rollAdjustment: string;
  preventionTips: string[];
  numericCorrections: { station: string; action: string; value: string; priority: string }[];
  summary: string;
  confidenceScore: number;
  knowledgeBaseVersion: string;
}

export function Troubleshooting() {
  const [selectedDefect, setSelectedDefect] = useState<string | null>(null);
  const [expandedCause, setExpandedCause] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<AiEngineResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scoredRef = useRef<string | null>(null);

  const network = useNetworkStatus();
  const { scoreTask } = useAccuracyScoring();

  const diagnosis = selectedDefect ? DIAGNOSIS_DATABASE[selectedDefect] : null;
  const defect = selectedDefect ? DEFECTS.find((d) => d.id === selectedDefect) : null;

  const { rollTooling, rollGaps, stations, materialType, materialThickness, lineSpeed, accuracyLog, accuracyThreshold } = useCncStore();
  const latestDiagnosisScore = [...accuracyLog].reverse().find(e => e.taskType === "ai-diagnosis");

  // Call backend offline AI engine when defect is selected
  useEffect(() => {
    if (!selectedDefect) { setAiResult(null); return; }
    const backendId = DEFECT_ID_MAP[selectedDefect];
    if (!backendId) { setAiResult(null); return; }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAiLoading(true);
    setAiResult(null);
    scoredRef.current = null;

    const stationData = stations.map((st, i) => ({
      stationNumber: i + 1,
      bendAngles: st.bendAngles ?? [],
      rollGap: rollGaps[i]?.springbackGap ?? rollTooling[i]?.rollProfile?.gap ?? undefined,
    }));

    authFetch("/api/ai/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defectId: backendId,
        materialType: materialType ?? "GI",
        thickness: materialThickness ?? 1.5,
        numStations: stations.length || rollTooling.length || 5,
        lineSpeed: lineSpeed ?? 20,
        stationData: stationData.length > 0 ? stationData : undefined,
      }),
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (data.success !== false) {
          setAiResult(data as AiEngineResult);
          if (scoredRef.current !== selectedDefect) {
            scoredRef.current = selectedDefect;
            scoreTask("ai-diagnosis", `AI Diagnosis — ${data.defectName ?? selectedDefect}`, {
              confidenceScore: data.confidenceScore,
              rootCauses: data.rootCauses,
              immediateActions: data.immediateActions,
              numericCorrections: data.numericCorrections,
              defectName: data.defectName,
              severity: data.severity,
            });
          }
        }
      })
      .catch(() => { /* offline — no problem, local DB still shown */ })
      .finally(() => setAiLoading(false));

    return () => ctrl.abort();
  }, [selectedDefect, materialType, materialThickness, lineSpeed]);

  // Smart numeric corrections based on actual machine data
  const smartCorrections = useMemo(() => {
    if (!selectedDefect || rollTooling.length === 0) return null;
    const n = rollTooling.length;
    const gapAt = (i: number) => rollGaps[i]?.springbackGap ?? rollTooling[i]?.rollProfile.gap ?? 0;
    const stationLabel = (i: number) => rollTooling[i]?.label ?? `Station ${i + 1}`;

    if (selectedDefect === "twist") {
      // Find station with highest asymmetric load (middle stations)
      const problemIdx = Math.floor(n * 0.3);
      const problemIdx2 = Math.floor(n * 0.6);
      return {
        title: "Twist — Numeric Correction",
        color: "purple",
        steps: [
          { station: stationLabel(0), action: "Entry guide", value: "Re-center ±0 mm (zero tolerance)", priority: "CRITICAL" },
          { station: stationLabel(problemIdx), action: "Left side gap", value: `${gapAt(problemIdx).toFixed(4)} mm → match right side exactly`, priority: "HIGH" },
          { station: stationLabel(problemIdx2), action: "Right side gap", value: `${gapAt(problemIdx2).toFixed(4)} mm → use feeler gauge`, priority: "HIGH" },
          { station: "All stands", action: "Line speed", value: `Reduce from ${lineSpeed} to ${Math.round(lineSpeed * 0.7)} m/min`, priority: "MEDIUM" },
          { station: "Coiler", action: "Back tension", value: "Increase uncoiler brake by 10–15%", priority: "MEDIUM" },
        ],
        summary: `For ${materialType} ${materialThickness}mm: check roll gap symmetry at ${stationLabel(problemIdx)} and ${stationLabel(problemIdx2)} — most common twist sources in ${n}-station machines.`,
      };
    }
    if (selectedDefect === "bow") {
      const lastIdx = n - 1;
      const midIdx = Math.floor(n / 2);
      const overformAngle = materialType === "SS" ? 18 : materialType === "HR" ? 12 : materialType === "AL" ? 15 : 5;
      return {
        title: "Bow — Numeric Correction",
        color: "amber",
        steps: [
          { station: stationLabel(midIdx), action: "Roll pressure", value: `Open gap +0.05 mm (current: ${gapAt(midIdx).toFixed(4)} mm)`, priority: "HIGH" },
          { station: stationLabel(lastIdx), action: "Calibration gap", value: `Close gap −0.10 mm (current: ${gapAt(lastIdx).toFixed(4)} mm)`, priority: "HIGH" },
          { station: "Straightener", action: "Leveling rolls", value: "Add 2–3 leveling rolls at exit", priority: "MEDIUM" },
          { station: "All stations", action: "Over-form angle", value: `Increase by +${overformAngle}% for ${materialType}`, priority: "MEDIUM" },
          { station: "Line", action: "Speed", value: `Reduce to ${Math.round(lineSpeed * 0.8)} m/min`, priority: "LOW" },
        ],
        summary: `${materialType} bow correction: close calibration gap at last station ${stationLabel(lastIdx)} by 0.10 mm. Springback factor for ${materialType} = ${materialType === "SS" ? "1.20" : materialType === "HR" ? "1.12" : materialType === "AL" ? "1.15" : "1.05"}.`,
      };
    }
    if (selectedDefect === "camber") {
      const wornIdx = Math.floor(n * 0.4);
      return {
        title: "Camber — Numeric Correction",
        color: "orange",
        steps: [
          { station: stationLabel(wornIdx), action: "Left roll OD", value: `Measure vs nominal ${rollTooling[wornIdx]?.rollProfile.rollDiameter.toFixed(3)} mm — max wear 0.15 mm`, priority: "HIGH" },
          { station: stationLabel(wornIdx), action: "Right roll OD", value: `Measure vs nominal ${rollTooling[wornIdx]?.rollProfile.rollDiameter.toFixed(3)} mm — left/right must match`, priority: "HIGH" },
          { station: "Entry", action: "Strip width check", value: `Verify strip width = design width ±0.3 mm`, priority: "HIGH" },
          { station: "All stands", action: "Lubrication", value: "Apply uniform lube across full strip width", priority: "MEDIUM" },
          { station: stationLabel(n - 1), action: "Straightener", value: "Add differential roll pressure 0.2 mm opposite to camber", priority: "MEDIUM" },
        ],
        summary: `Camber check: measure roll diameter at ${stationLabel(wornIdx)} — most active forming station. If wear > 0.15 mm, regrind. Current nominal OD: ${rollTooling[wornIdx]?.rollProfile.rollDiameter.toFixed(3) ?? "—"} mm.`,
      };
    }
    if (selectedDefect === "size_mismatch") {
      const finalIdx = n - 1;
      const sbFactor = materialType === "SS" ? 1.20 : materialType === "HR" ? 1.12 : materialType === "AL" ? 1.15 : materialType === "CR" ? 1.08 : 1.05;
      const nomGap = gapAt(finalIdx);
      const targetGap = nomGap / sbFactor;
      return {
        title: "Size Mismatch — Numeric Correction",
        color: "blue",
        steps: [
          { station: stationLabel(finalIdx), action: "Current gap", value: `${nomGap.toFixed(4)} mm → target: ${targetGap.toFixed(4)} mm`, priority: "CRITICAL" },
          { station: stationLabel(finalIdx), action: "Close gap by", value: `${(nomGap - targetGap).toFixed(4)} mm increments (0.05 mm per trial)`, priority: "CRITICAL" },
          { station: "Material", action: "Thickness check", value: `Measure with micrometer — design: ${materialThickness} mm, tolerance ±0.05 mm`, priority: "HIGH" },
          { station: "All stations", action: "Springback factor", value: `${materialType} = ${sbFactor} (over-form by ${((sbFactor - 1) * 100).toFixed(0)}%)`, priority: "MEDIUM" },
        ],
        summary: `For ${materialType}: springback factor ${sbFactor}. Final station ${stationLabel(finalIdx)} gap should be ${targetGap.toFixed(4)} mm (currently ${nomGap.toFixed(4)} mm). Close by ${(nomGap - targetGap).toFixed(4)} mm.`,
      };
    }
    if (selectedDefect === "wrinkle") {
      const earlyIdx = Math.floor(n * 0.25);
      const maxBendPerStation = materialType === "SS" ? 12 : materialType === "HR" ? 10 : 15;
      const st = stations[earlyIdx];
      const avgBend = st && st.bendAngles.length > 0 ? st.bendAngles.reduce((a, b) => a + b, 0) / st.bendAngles.length : 0;
      return {
        title: "Wrinkle — Numeric Correction",
        color: "red",
        steps: [
          { station: stationLabel(earlyIdx), action: "Bend angle per pass", value: `Current avg: ${avgBend.toFixed(1)}° → max allowed: ${maxBendPerStation}° for ${materialType}`, priority: avgBend > maxBendPerStation ? "CRITICAL" : "MEDIUM" },
          { station: stationLabel(earlyIdx), action: "Roll gap", value: `Open by +0.08 mm (current: ${gapAt(earlyIdx).toFixed(4)} mm)`, priority: "HIGH" },
          { station: "Line speed", action: "Reduce to", value: `${Math.round(lineSpeed * 0.5)} m/min immediately`, priority: "CRITICAL" },
          { station: "All stands", action: "Lubrication", value: "Apply forming oil — reduces edge stress by 20–30%", priority: "HIGH" },
          { station: "Material", action: "Thickness", value: `${materialThickness} mm — verify within ±5% tolerance`, priority: "MEDIUM" },
        ],
        summary: `Wrinkle start location: likely at ${stationLabel(earlyIdx)}. For ${materialType} max ${maxBendPerStation}°/station. Reduce speed from ${lineSpeed} to ${Math.round(lineSpeed * 0.5)} m/min immediately.`,
      };
    }
    if (selectedDefect === "crack") {
      const bendHeavyIdx = stations.reduce((bestI, st, i) => {
        const totalBend = st.bendAngles.reduce((a, b) => a + b, 0);
        const bestSt = stations[bestI];
        const bestTotal = bestSt ? bestSt.bendAngles.reduce((a, b) => a + b, 0) : 0;
        return totalBend > bestTotal ? i : bestI;
      }, 0);
      const rBend = rollTooling[bendHeavyIdx]?.rollProfile;
      return {
        title: "Crack at Bend — Numeric Correction",
        color: "red",
        steps: [
          { station: stationLabel(bendHeavyIdx), action: "Bend radius", value: `Increase inner radius from ${materialThickness * 1}×t to ${materialThickness * 2}×t (${(materialThickness * 2).toFixed(2)} mm)`, priority: "CRITICAL" },
          { station: stationLabel(bendHeavyIdx), action: "Roll groove radius", value: `Current: ${rBend?.rollDiameter.toFixed(1) ?? "—"} mm OD — groove must match bend radius`, priority: "HIGH" },
          { station: "Line speed", action: "Reduce to", value: `${Math.round(lineSpeed * 0.4)} m/min at crack station`, priority: "CRITICAL" },
          { station: "Material", action: "Direction", value: `Roll forming direction vs grain direction — 90° to grain is preferred for ${materialType}`, priority: "HIGH" },
          { station: "Lubrication", action: "Increase", value: "Apply heavy forming oil at bend zone — reduces stress by 40%", priority: "HIGH" },
        ],
        summary: `Crack at ${stationLabel(bendHeavyIdx)} (highest total bend angle). For ${materialType} ${materialThickness}mm: minimum bend radius = ${(materialThickness * (materialType === "SS" ? 2 : 1.5)).toFixed(2)} mm. Check roll groove profile.`,
      };
    }
    if (selectedDefect === "edge_wave") {
      return {
        title: "Edge Wave — Numeric Correction",
        color: "cyan",
        steps: [
          { station: "Entry guide", action: "Centering", value: "Strip must be centered ±0.3 mm — check with dial indicator", priority: "CRITICAL" },
          { station: stationLabel(0), action: "Side roll gap", value: "Side rolls: touch strip edge lightly — not pressing (0 N lateral force)", priority: "HIGH" },
          { station: "Uncoiler", action: "Back tension", value: `Increase brake tension to ${Math.round(materialThickness * 15)} kg for ${materialThickness}mm ${materialType}`, priority: "HIGH" },
          { station: "Line speed", action: "Reduce to", value: `${Math.round(lineSpeed * 0.6)} m/min`, priority: "MEDIUM" },
          { station: "All stands", action: "Roll face width", value: `Check: roll face ≥ strip width + 2mm margin (both sides)`, priority: "MEDIUM" },
        ],
        summary: `Edge wave: strip tracking issue. Entry guide misalignment by even 1 mm causes edge elongation. Increase uncoiler tension to ~${Math.round(materialThickness * 15)} kg for ${materialThickness}mm ${materialType}.`,
      };
    }
    if (selectedDefect === "flare") {
      const lastIdx = n - 1;
      const sbFactor = materialType === "SS" ? 1.20 : materialType === "HR" ? 1.12 : materialType === "AL" ? 1.15 : materialType === "CR" ? 1.08 : 1.05;
      const overBend = Math.round((sbFactor - 1) * 100);
      return {
        title: "End Flare — Numeric Correction",
        color: "yellow",
        steps: [
          { station: stationLabel(lastIdx - 1), action: "Over-bend angle", value: `Increase by +${overBend}% for ${materialType} springback`, priority: "CRITICAL" },
          { station: stationLabel(lastIdx), action: "Calibration gap", value: `Close by 0.10–0.20 mm (current: ${gapAt(lastIdx).toFixed(4)} mm)`, priority: "CRITICAL" },
          { station: "Cut-off", action: "Timing", value: "Use flying cut — stop-cut releases residual stress causing flare", priority: "HIGH" },
          { station: stationLabel(lastIdx), action: "Sizing rolls", value: "Add sizing/calibration roll — fully enclose profile cross-section", priority: "MEDIUM" },
          { station: "Line speed", action: "Reduce to", value: `${Math.round(lineSpeed * 0.75)} m/min — dynamic flare increases with speed`, priority: "MEDIUM" },
        ],
        summary: `${materialType} flare: springback = ${sbFactor}. Over-form last 2 stations by +${overBend}%. Close calibration gap at ${stationLabel(lastIdx)} by 0.10–0.20 mm. Use flying cut-off.`,
      };
    }
    return null;
  }, [selectedDefect, rollTooling, rollGaps, stations, materialType, materialThickness, lineSpeed]);

  const probabilityColor = (prob: Cause["probability"]) => {
    if (prob === "high") return "text-red-400 bg-red-950 border-red-800";
    if (prob === "medium") return "text-yellow-400 bg-yellow-950 border-yellow-800";
    return "text-zinc-400 bg-zinc-800 border-zinc-700";
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-zinc-700 bg-zinc-900">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <h2 className="text-sm font-semibold text-zinc-200">Production Troubleshooting</h2>
          {/* Offline AI Engine Badge */}
          <span className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold select-none
            ${network.isOnline
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
              : "bg-amber-500/12 border border-amber-500/30 text-amber-400"}`}>
            <Brain className="w-2.5 h-2.5" />
            SAI AI v2 —{" "}
            {network.isOnline
              ? <><Wifi className="w-2 h-2 inline" /> Online</>
              : <><WifiOff className="w-2 h-2 inline" /> Offline ✓</>}
          </span>
          {latestDiagnosisScore && (
            <AccuracyBadge score={latestDiagnosisScore.overallScore} threshold={accuracyThreshold} size="sm" />
          )}
          {aiLoading && (
            <span className="flex items-center gap-1 text-[9px] text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" /> AI thinking…
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          AI engine runs <span className="text-emerald-400 font-medium">locally on this device</span> — internet nahi chahiye
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-zinc-700 overflow-y-auto bg-zinc-950 flex-shrink-0">
          {DEFECTS.map((defect, idx) => (
            <React.Fragment key={defect.id}>
              {idx === 10 && (
                <div className="px-3 py-1.5 bg-zinc-900/80 border-y border-zinc-700">
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">Open Section Defects (C/Z/U/Hat)</span>
                </div>
              )}
              <button
                onClick={() => { setSelectedDefect(defect.id); setExpandedCause(null); }}
                className={`w-full text-left px-3 py-3 border-b border-zinc-800 hover:bg-zinc-800 transition-colors flex items-start gap-2 ${
                  selectedDefect === defect.id ? "bg-blue-950 border-l-2 border-l-blue-500" : ""
                } ${idx >= 10 ? "bg-cyan-950/10" : ""}`}
              >
                <span className="text-lg leading-none mt-0.5">{defect.icon}</span>
                <div>
                  <div className="text-xs font-semibold text-zinc-200">{defect.name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{defect.description}</div>
                </div>
                <ChevronRight className="w-3 h-3 text-zinc-600 ml-auto mt-1 flex-shrink-0" />
              </button>
            </React.Fragment>
          ))}

          {/* Open Section Quick Reference */}
          <div className="px-3 py-2 border-t border-zinc-700 mt-1">
            <div className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">Open Section Quick Ref</div>
            {[
              { label: "Twist", icon: "🔄", color: "text-red-400", shortCause: "Asymmetric bending", shortFix: "Check roll shaft parallelism ±0.05mm/m" },
              { label: "Bow", icon: "⌒", color: "text-amber-400", shortCause: "Uneven roll pressure", shortFix: "Level all lower rolls ±0.1mm pass line" },
              { label: "Edge Wave", icon: "🌊", color: "text-blue-400", shortCause: "Gap too tight / >15°/pass", shortFix: "Open gap +0.1mm, reduce increment" },
              { label: "Crack", icon: "⚡", color: "text-orange-400", shortCause: "r < t / too few passes", shortFix: "Increase radius, add passes (r≥t)" },
            ].map(d => (
              <div key={d.label} className="mb-2 bg-zinc-900 rounded px-2 py-1.5 border border-zinc-800">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">{d.icon}</span>
                  <span className={`text-[10px] font-bold ${d.color}`}>{d.label}</span>
                </div>
                <div className="text-[9px] text-zinc-500">Cause: {d.shortCause}</div>
                <div className="text-[9px] text-zinc-400">Fix: {d.shortFix}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedDefect && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertTriangle className="w-12 h-12 text-zinc-700 mb-3" />
              <p className="text-zinc-500 text-sm">Select a defect from the left panel</p>
              <p className="text-zinc-600 text-xs mt-1">AI-based diagnosis will appear here</p>
            </div>
          )}

          {diagnosis && defect && (
            <>
              <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{defect.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">{defect.name}</h3>
                    <p className="text-xs text-zinc-400">{defect.description}</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-950 border border-red-800 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-red-300 mb-2 uppercase tracking-wider">
                  ⚡ Immediate Actions
                </h4>
                <ul className="space-y-1">
                  {diagnosis.immediateActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-red-200">
                      <span className="text-red-400 font-bold mt-0.5">{i + 1}.</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                  Root Causes Analysis
                </h4>
                <div className="space-y-2">
                  {diagnosis.rootCauses.map((cause, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border overflow-hidden cursor-pointer ${probabilityColor(cause.probability)}`}
                      onClick={() => setExpandedCause(expandedCause === i ? null : i)}
                    >
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          cause.probability === "high" ? "bg-red-800 text-red-200" :
                          cause.probability === "medium" ? "bg-yellow-800 text-yellow-200" :
                          "bg-zinc-700 text-zinc-300"
                        }`}>
                          {cause.probability}
                        </span>
                        <span className="text-xs font-medium flex-1">{cause.cause}</span>
                        {cause.stand && (
                          <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded">{cause.stand}</span>
                        )}
                        <ChevronRight className={`w-3 h-3 transition-transform ${expandedCause === i ? "rotate-90" : ""}`} />
                      </div>
                      {expandedCause === i && (
                        <div className="px-3 pb-3 pt-1 bg-black/20">
                          <div className="flex items-start gap-1.5">
                            <Wrench className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            <p className="text-xs leading-relaxed">{cause.fix}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">
                  <Settings className="w-3 h-3 inline mr-1" />
                  Roll Adjustment
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">{diagnosis.rollAdjustment}</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-amber-400 mb-2 uppercase tracking-wider">
                  Process Change
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">{diagnosis.processChange}</p>
              </div>

              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  Prevention Tips
                </h4>
                <ul className="space-y-1">
                  {diagnosis.preventionTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-300">
                      <span className="text-green-500 mt-0.5">✓</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Smart Numeric AI Corrections — uses real machine data */}
              {smartCorrections ? (
                <div className="bg-violet-950 border border-violet-700 rounded-lg p-3">
                  <h4 className="text-xs font-semibold text-violet-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />
                    Smart AI — Station-Specific Numeric Fix
                  </h4>
                  <div className="text-[10px] text-violet-200/80 mb-2 leading-relaxed bg-black/20 rounded px-2 py-1.5">
                    {smartCorrections.summary}
                  </div>
                  <div className="space-y-1.5">
                    {smartCorrections.steps.map((step, i) => (
                      <div key={i} className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                        step.priority === "CRITICAL" ? "bg-red-950/60 border border-red-800/50" :
                        step.priority === "HIGH" ? "bg-orange-950/60 border border-orange-800/50" :
                        "bg-zinc-900/60 border border-zinc-700/50"
                      }`}>
                        <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                          step.priority === "CRITICAL" ? "bg-red-800 text-red-200" :
                          step.priority === "HIGH" ? "bg-orange-800 text-orange-200" :
                          step.priority === "MEDIUM" ? "bg-yellow-800/80 text-yellow-200" :
                          "bg-zinc-700 text-zinc-300"
                        }`}>{step.priority}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-zinc-200">{step.station}</div>
                          <div className="text-zinc-400">{step.action}: <span className="text-amber-300 font-mono">{step.value}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : rollTooling.length === 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-center">
                  <Zap className="w-4 h-4 text-zinc-600 mx-auto mb-1" />
                  <p className="text-xs text-zinc-500">Generate Roll Tooling first to see station-specific numeric corrections based on your actual machine data.</p>
                </div>
              )}

              {/* ── SAI Offline AI Engine Panel ── */}
              {aiLoading && (
                <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-blue-300">SAI AI Engine — Processing…</p>
                    <p className="text-[10px] text-blue-400/70">500+ engineering rules loading…</p>
                  </div>
                </div>
              )}

              {aiResult && !aiLoading && (
                <div className="bg-indigo-950/50 border border-indigo-700/50 rounded-lg p-3 space-y-2">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-indigo-300 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-indigo-200 uppercase tracking-wide">SAI AI Engine — Offline Diagnosis</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-indigo-400/80">{aiResult.engineVersion}</span>
                        <span className="text-[9px] text-indigo-400/60">·</span>
                        <span className="text-[9px] text-indigo-400/80">{aiResult.knowledgeBaseVersion}</span>
                        <span className="text-[9px] text-indigo-400/60">·</span>
                        <span className="text-[9px] font-bold text-emerald-400">
                          Confidence: {aiResult.confidenceScore}%
                        </span>
                        <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full
                          ${aiResult.offlineMode
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"}`}>
                          {aiResult.offlineMode ? "⚡ Offline" : "🌐 Online"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="text-[10px] text-indigo-200/80 bg-black/20 rounded px-2 py-1.5 leading-relaxed">
                    {aiResult.summary}
                  </div>

                  {/* Numeric Corrections from AI */}
                  {aiResult.numericCorrections.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-indigo-300 mb-1.5 uppercase tracking-wider">AI Numeric Corrections</p>
                      <div className="space-y-1">
                        {aiResult.numericCorrections.map((corr, i) => (
                          <div key={i} className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs
                            ${corr.priority === "CRITICAL" ? "bg-red-950/60 border border-red-800/50" :
                              corr.priority === "HIGH" ? "bg-orange-950/60 border border-orange-800/50" :
                              "bg-zinc-900/60 border border-zinc-700/50"}`}>
                            <span className={`font-bold text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5
                              ${corr.priority === "CRITICAL" ? "bg-red-800 text-red-200" :
                                corr.priority === "HIGH" ? "bg-orange-800 text-orange-200" :
                                corr.priority === "MEDIUM" ? "bg-yellow-800/80 text-yellow-200" :
                                "bg-zinc-700 text-zinc-300"}`}>{corr.priority}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-zinc-200">{corr.station}</div>
                              <div className="text-zinc-400">{corr.action}: <span className="text-amber-300 font-mono">{corr.value}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
