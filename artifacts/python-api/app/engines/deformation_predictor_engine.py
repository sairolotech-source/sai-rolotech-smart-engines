"""
deformation_predictor_engine.py — Forming Deformation Predictor
Sai Rolotech Smart Engines v2.4.0

Predicts forming defect tendencies BEFORE they happen, based on:
  - Pass sequence geometry (angle increment, R/t, w/t)
  - Material properties (springback, elongation, yield strength)
  - Profile geometry (symmetry, aspect ratio)

All outputs are EMPIRICAL ESTIMATES — NOT FEA.
Every value is labeled with its computation basis:
  [Formula]  — derived from engineering equation
  [Rule]     — industry rule-of-thumb / empirical limit
  [Estimate] — approximated, use with engineering judgement
  [Table]    — from material / geometry lookup

IMPORTANT: Do not use for structural certification.
Validate all predictions with physical trial runs.
"""

import math
from typing import List, Dict, Any, Optional

# ─── Material Properties ──────────────────────────────────────────────────────

MATERIAL_PROPS: Dict[str, Dict[str, float]] = {
    "GI":  {"Fy": 250, "E": 200000, "nu": 0.30, "elongation_pct": 22, "n": 0.18, "k": 530},
    "GP":  {"Fy": 250, "E": 200000, "nu": 0.30, "elongation_pct": 22, "n": 0.18, "k": 530},
    "MS":  {"Fy": 250, "E": 210000, "nu": 0.30, "elongation_pct": 28, "n": 0.20, "k": 530},
    "CR":  {"Fy": 280, "E": 205000, "nu": 0.30, "elongation_pct": 24, "n": 0.19, "k": 560},
    "HR":  {"Fy": 240, "E": 200000, "nu": 0.30, "elongation_pct": 26, "n": 0.17, "k": 510},
    "SS":  {"Fy": 310, "E": 193000, "nu": 0.28, "elongation_pct": 40, "n": 0.35, "k": 760},
    "AL":  {"Fy": 160, "E": 70000,  "nu": 0.33, "elongation_pct": 12, "n": 0.12, "k": 400},
}

# Springback factors per material [Table]
SPRINGBACK_FACTOR: Dict[str, float] = {
    "GI": 1.5, "GP": 1.5, "MS": 2.5, "CR": 2.5, "HR": 3.0, "SS": 4.0, "AL": 3.5,
}


def _get_mat(material: str) -> Dict[str, float]:
    return MATERIAL_PROPS.get(material.upper(), MATERIAL_PROPS["MS"])


# ─── 1. Bow / Camber Tendency ─────────────────────────────────────────────────

def predict_bow_camber(
    passes: List[Dict[str, Any]],
    material: str,
    thickness_mm: float,
    section_width_mm: float,
    is_symmetric: bool,
    strip_speed_mpm: float = 15.0,
) -> Dict[str, Any]:
    """
    Estimate longitudinal bow and camber tendency.

    Bow (longitudinal curl in vertical plane) and camber (horizontal sweep)
    arise from unequal springback across the cross-section.

    Factors considered:
    - Differential springback between upper/lower fibres   [Formula]
    - Profile asymmetry (asymmetric = more camber risk)    [Rule]
    - Strip speed effect on forming stability               [Rule]
    - Total angle change across sequence                    [Rule]

    Returns:
        bow_tendency   (0-10 score, where 10 = severe)
        camber_tendency (0-10 score)
        recommendations []
    """
    mat = _get_mat(material)
    sb_factor = SPRINGBACK_FACTOR.get(material.upper(), 2.5)
    final_angle = passes[-1].get("target_angle_deg", 0.0) if passes else 0.0
    n_passes = len(passes)

    # Bow tendency: high final angle + high springback + few passes = more bow [Rule]
    angle_contribution = min(10.0, (final_angle / 90.0) * 5.0)
    springback_contribution = min(10.0, sb_factor / 4.0 * 6.0)
    pass_distribution = max(0.0, 3.0 - (n_passes / 4.0))  # fewer passes = more bow [Rule]

    # Speed contribution: higher speed = less time to set = more bow [Rule]
    speed_factor = 1.0 + max(0.0, (strip_speed_mpm - 20.0) / 40.0) * 0.4

    bow_score = min(10.0, (angle_contribution * 0.5 + springback_contribution * 0.4 + pass_distribution * 0.1) * speed_factor)

    # Camber tendency: asymmetric profile is major driver [Rule]
    symmetry_multiplier = 1.8 if not is_symmetric else 1.0
    width_factor = 1.0 + max(0.0, (section_width_mm - 100) / 200.0) * 0.5  # wider = more camber [Rule]
    camber_score = min(10.0, bow_score * 0.7 * symmetry_multiplier * width_factor)

    # Estimate bow magnitude [Estimate]
    bow_mm_per_meter = round(sb_factor * (final_angle / 90.0) * (thickness_mm / 2.0) * 0.4, 2)
    camber_mm_per_meter = round(bow_mm_per_meter * (1.5 if not is_symmetric else 0.6), 2)

    recs = []
    if bow_score >= 6.0:
        recs.append(f"High bow tendency — add straightening/leveling section after calibration pass.")
    if bow_score >= 4.0 and sb_factor >= 3.5:
        recs.append(f"{material} has high springback ({sb_factor}°) — overbend calibration must be precise (±0.2°).")
    if camber_score >= 5.0 and not is_symmetric:
        recs.append("Asymmetric profile: add side anti-camber rolls or use camber correction shims.")
    if strip_speed_mpm > 25:
        recs.append(f"Strip speed {strip_speed_mpm} m/min is high — reduce to ≤20 m/min for first production run.")

    return {
        "bow_tendency_score": round(bow_score, 2),
        "camber_tendency_score": round(camber_score, 2),
        "bow_level": _level(bow_score),
        "camber_level": _level(camber_score),
        "bow_estimate_mm_per_m": bow_mm_per_meter,
        "camber_estimate_mm_per_m": camber_mm_per_meter,
        "is_symmetric": is_symmetric,
        "final_angle_deg": final_angle,
        "springback_factor": sb_factor,
        "recommendations": recs,
        "method": "[Formula + Rule] Differential springback and symmetry-based bow/camber tendency estimator. [Estimate] Magnitude values are approximate.",
    }


# ─── 2. Edge Wave / Buckling Tendency ────────────────────────────────────────

def predict_edge_wave_risk(
    passes: List[Dict[str, Any]],
    material: str,
    thickness_mm: float,
    section_width_mm: float,
) -> Dict[str, Any]:
    """
    Predict edge wave formation tendency.

    Edge wave occurs when compressive longitudinal stresses at the strip edge
    exceed the critical buckling stress for the unsupported flange.

    Based on:
    - Critical buckling stress σcr = π²E(t/w)² / 12(1-ν²)   [Formula — plate buckling]
    - Angle increment aggressiveness vs critical strain        [Rule]
    - Material compressive strength                            [Table]

    Returns:
        edge_wave_score (0-10)
        critical_strip_width_mm (theoretical limit)
        recommendations []
    """
    mat = _get_mat(material)
    E = mat["E"]  # MPa
    nu = mat["nu"]
    Fy = mat["Fy"]
    n_passes = len(passes)

    # Critical buckling width [Formula — plate buckling theory: σcr = k·π²E/(12(1-ν²))·(t/w)²]
    # k=0.43 for free edge under uniform compression
    k_buckling = 0.43
    if thickness_mm > 0:
        # w_crit = t * sqrt(k·π²·E / (12(1-ν²)·Fy))
        w_crit = thickness_mm * math.sqrt(k_buckling * math.pi**2 * E / (12 * (1 - nu**2) * Fy))
    else:
        w_crit = 1000.0

    w_over_wcrit = section_width_mm / max(w_crit, 1.0)

    # Score from width ratio [Rule]
    width_score = min(10.0, max(0.0, (w_over_wcrit - 0.6) / 0.4 * 7.0))

    # Per-pass angle aggressiveness contribution [Rule]
    aggressive_passes = 0
    for i, p in enumerate(passes):
        prev_angle = passes[i - 1].get("target_angle_deg", 0.0) if i > 0 else 0.0
        if p.get("target_angle_deg", 0) - prev_angle > 15:
            aggressive_passes += 1
    aggressiveness_score = min(3.0, aggressive_passes * 1.0)

    final_score = min(10.0, width_score + aggressiveness_score)

    recs = []
    if section_width_mm > w_crit:
        recs.append(f"Strip width {section_width_mm:.0f}mm exceeds theoretical buckling limit ({w_crit:.0f}mm). Edge wave risk is high.")
    if aggressive_passes > 0:
        recs.append(f"{aggressive_passes} stations have angle increments >15°. Split these to reduce compressive edge stress.")
    if final_score >= 5.0 and material in ("CR", "HR"):
        recs.append("Work-hardened material — compressive edge stress is harder to predict. Monitor edge condition in trial run.")

    return {
        "edge_wave_score": round(final_score, 2),
        "edge_wave_level": _level(final_score),
        "critical_width_mm": round(w_crit, 1),
        "actual_width_mm": section_width_mm,
        "width_over_critical": round(w_over_wcrit, 3),
        "aggressive_passes": aggressive_passes,
        "at_risk": final_score >= 5.0,
        "recommendations": recs,
        "method": "[Formula] Plate buckling: σcr = 0.43·π²E/(12(1-ν²))·(t/w)². [Rule] Aggressiveness check per pass. [Estimate] Simplified 2D model, actual edge conditions affect result.",
    }


# ─── 3. Wrinkling Risk ───────────────────────────────────────────────────────

def predict_wrinkling_risk(
    passes: List[Dict[str, Any]],
    material: str,
    thickness_mm: float,
    section_width_mm: float,
    bend_radius_mm: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Estimate wrinkling (compression instability) risk in forming zones.

    Wrinkling occurs when forming compressive stresses exceed the sheet's
    bending resistance per unit width.

    Based on:
    - Ratio of forming depth to strip width                   [Rule]
    - Flange w/t ratio under compression                      [Rule]
    - Material resistance to wrinkle (higher n = more resistant) [Table]
    - Bend radius severity                                     [Rule]

    Returns:
        wrinkling_score (0-10)
        risk zones list
    """
    mat = _get_mat(material)
    n = mat["n"]  # strain hardening exponent — higher n = more wrinkle resistant [Table]
    r_mm = bend_radius_mm if bend_radius_mm else max(1.5 * thickness_mm, 3.0)

    # Depth-to-width ratio [Rule]
    max_depth = max((p.get("forming_depth_mm", 0) for p in passes), default=0.0)
    if section_width_mm > 0 and max_depth > 0:
        depth_ratio = max_depth / section_width_mm
        depth_score = min(10.0, (depth_ratio - 0.1) / 0.4 * 7.0) if depth_ratio > 0.1 else 0.0
    else:
        depth_ratio = 0.0
        depth_score = 0.0

    # w/t ratio risk [Rule]
    w_over_t = section_width_mm / max(thickness_mm, 0.01)
    wt_score = min(10.0, max(0.0, (w_over_t - 20) / 15.0 * 4.0))

    # R/t ratio risk — sharper bend = more wrinkling in adjacent zone [Rule]
    r_over_t = r_mm / max(thickness_mm, 0.01)
    rt_score = min(5.0, max(0.0, (2.0 - r_over_t) / 1.5 * 5.0))

    # Material correction (higher n = more resistant) [Table]
    material_factor = 1.0 - (n - 0.12) / 0.40 * 0.35
    material_factor = max(0.65, min(1.2, material_factor))

    final_score = min(10.0, (depth_score * 0.45 + wt_score * 0.35 + rt_score * 0.20) * material_factor)

    # Identify risky pass zones
    risky_zones = []
    for i, p in enumerate(passes):
        depth = p.get("forming_depth_mm", 0)
        ratio = depth / max(section_width_mm, 1.0)
        if ratio > 0.3:
            risky_zones.append({
                "pass_no": p.get("pass_no", i + 1),
                "stage": p.get("stage_type", "unknown"),
                "depth_ratio": round(ratio, 3),
                "risk": "HIGH" if ratio > 0.45 else "MEDIUM",
            })

    recs = []
    if final_score >= 6.0:
        recs.append("High wrinkling risk — add blank holder pressure simulation check or reduce forming depth per station.")
    if depth_ratio > 0.4:
        recs.append(f"Forming depth ({max_depth:.1f}mm) is {depth_ratio:.0%} of section width — increase number of forming stations.")
    if r_over_t < 1.5:
        recs.append(f"Tight bend radius (R/t = {r_over_t:.2f}) can cause wrinkling in the bend zone — increase to R/t ≥ 1.5.")
    if material in ("AL",) and final_score >= 4.0:
        recs.append("Aluminium has low elongation — wrinkling tendency is harder to reverse. Consider annealing between stages.")

    return {
        "wrinkling_score": round(final_score, 2),
        "wrinkling_level": _level(final_score),
        "depth_ratio": round(depth_ratio, 3),
        "max_depth_mm": round(max_depth, 2),
        "r_over_t": round(r_over_t, 3),
        "risky_zones": risky_zones,
        "at_risk": final_score >= 5.0,
        "recommendations": recs,
        "method": "[Rule] Depth/width ratio, w/t, and R/t checks. [Table] Material n-factor wrinkle resistance. [Estimate] Simplified 2D — actual tooling clamping conditions affect result.",
    }


# ─── 4. Station Aggressiveness Heatmap ───────────────────────────────────────

def calculate_station_aggressiveness(
    passes: List[Dict[str, Any]],
    material: str,
    thickness_mm: float,
) -> List[Dict[str, Any]]:
    """
    Calculate normalized aggressiveness index (0-10) for each pass.

    Aggressiveness = f(angle_increment, strain, depth_change, gap_ratio)
    Higher score = more aggressive forming at this station.

    Useful for:
    - Identifying overloaded stations
    - Optimizing forming sequence
    - Targeting where to split passes

    All values: [Formula + Rule]
    """
    from app.engines.engineering_risk_engine import (
        MAX_ANGLE_INCREMENT_DEG, MIN_BEND_RADIUS_FACTOR
    )

    max_inc = MAX_ANGLE_INCREMENT_DEG.get(material.upper(), 18.0)
    r_mm = max(1.5 * thickness_mm, 3.0)

    results = []
    for i, p in enumerate(passes):
        prev = passes[i - 1] if i > 0 else None
        cur_angle = p.get("target_angle_deg", 0.0)
        prev_angle = prev.get("target_angle_deg", 0.0) if prev else 0.0
        angle_inc = abs(cur_angle - prev_angle)

        gap_mm = p.get("roll_gap_mm", thickness_mm)
        depth = p.get("forming_depth_mm", 0.0)
        prev_depth = prev.get("forming_depth_mm", 0.0) if prev else 0.0
        depth_change = abs(depth - prev_depth)

        # Strain at this pass [Formula]
        if r_mm > 0 and thickness_mm > 0:
            strain = thickness_mm / (2 * r_mm + thickness_mm)
        else:
            strain = 0.0

        # Component scores [Rule]
        angle_score = min(10.0, (angle_inc / max_inc) * 8.0)
        strain_score = min(10.0, (strain / 0.15) * 7.0)  # 15% strain = moderate limit
        depth_score = min(10.0, (depth_change / 20.0) * 5.0)  # 20mm depth change per station
        gap_score = 0.0
        if thickness_mm > 0:
            gap_ratio = gap_mm / thickness_mm
            gap_score = max(0.0, min(5.0, abs(gap_ratio - 1.0) * 10.0))

        agg_score = (angle_score * 0.45 + strain_score * 0.30 + depth_score * 0.15 + gap_score * 0.10)
        agg_score = round(min(10.0, agg_score), 2)

        results.append({
            "pass_no": p.get("pass_no", i + 1),
            "stage_type": p.get("stage_type", "unknown"),
            "target_angle_deg": cur_angle,
            "angle_increment_deg": round(angle_inc, 2),
            "aggressiveness_score": agg_score,
            "aggressiveness_level": _level(agg_score),
            "strain_pct": round(strain * 100, 3),
            "depth_change_mm": round(depth_change, 2),
            "gap_ratio": round(gap_mm / max(thickness_mm, 0.01), 3),
            "components": {
                "angle": round(angle_score, 2),
                "strain": round(strain_score, 2),
                "depth": round(depth_score, 2),
                "gap": round(gap_score, 2),
            },
            "method": "[Formula] Outer-fibre strain ε=t/(2r+t). [Rule] Angle increment vs material limit. [Rule] Depth change and gap ratio.",
        })

    return results


# ─── 5. Full Deformation Prediction Report ───────────────────────────────────

def generate_deformation_prediction_report(
    passes: List[Dict[str, Any]],
    material: str,
    thickness_mm: float,
    section_width_mm: float,
    section_height_mm: float,
    is_symmetric: bool,
    bend_radius_mm: Optional[float] = None,
    strip_speed_mpm: float = 15.0,
) -> Dict[str, Any]:
    """
    Full forming deformation prediction.

    Runs all predictors and aggregates into a comprehensive report.

    Args:
        passes:          pass sequence with target_angle_deg, roll_gap_mm, forming_depth_mm
        material:        material code
        thickness_mm:    sheet thickness
        section_width_mm: finished width
        section_height_mm: finished height
        is_symmetric:    profile symmetry
        bend_radius_mm:  effective bend radius (estimated if None)
        strip_speed_mpm: forming line speed

    Returns:
        Full report with all deformation tendencies, heatmap, and recommendations.
    """
    if not passes:
        return {"error": "No passes provided", "status": "fail"}

    r_mm = bend_radius_mm if bend_radius_mm else max(1.5 * thickness_mm, 3.0)

    bow_camber = predict_bow_camber(passes, material, thickness_mm, section_width_mm, is_symmetric, strip_speed_mpm)
    edge_wave  = predict_edge_wave_risk(passes, material, thickness_mm, section_width_mm)
    wrinkling  = predict_wrinkling_risk(passes, material, thickness_mm, section_width_mm, r_mm)
    heatmap    = calculate_station_aggressiveness(passes, material, thickness_mm)

    # Overall deformation severity
    scores = [bow_camber["bow_tendency_score"], bow_camber["camber_tendency_score"],
              edge_wave["edge_wave_score"], wrinkling["wrinkling_score"]]
    overall_score = round(max(scores), 2)
    worst_mode = ["Bow", "Camber", "Edge Wave", "Wrinkling"][scores.index(max(scores))]

    # Top aggressiveness passes
    top_aggressive = sorted(heatmap, key=lambda x: x["aggressiveness_score"], reverse=True)[:3]

    # Aggregate all recommendations
    all_recs: List[str] = []
    for src in [bow_camber, edge_wave, wrinkling]:
        all_recs.extend(src.get("recommendations", []))
    all_recs = list(dict.fromkeys([r for r in all_recs if r.strip()]))  # dedup

    # Confidence level
    confidence = "HIGH" if thickness_mm >= 1.5 and is_symmetric else \
                 "MEDIUM" if thickness_mm >= 0.8 else "LOW"

    return {
        "status": "pass",
        "overall_deformation_score": overall_score,
        "overall_level": _level(overall_score),
        "worst_mode": worst_mode,
        "bow_camber": bow_camber,
        "edge_wave": edge_wave,
        "wrinkling": wrinkling,
        "aggressiveness_heatmap": heatmap,
        "top_aggressive_stations": top_aggressive,
        "summary": {
            "total_passes": len(passes),
            "material": material,
            "thickness_mm": thickness_mm,
            "section_width_mm": section_width_mm,
            "is_symmetric": is_symmetric,
            "strip_speed_mpm": strip_speed_mpm,
            "effective_bend_radius_mm": r_mm,
        },
        "all_recommendations": all_recs,
        "confidence_level": confidence,
        "disclaimer": (
            "[Estimate] All deformation tendency values are empirical approximations for design guidance only. "
            "NOT FEA. Validate with physical trial runs before production release."
        ),
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _level(score: float) -> str:
    if score < 3.0:   return "LOW"
    elif score < 5.5: return "MODERATE"
    elif score < 7.5: return "HIGH"
    else:             return "SEVERE"
