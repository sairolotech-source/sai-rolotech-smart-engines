"""
engineering_risk_engine.py — Advanced Engineering Risk Analysis Engine
Sai Rolotech Smart Engines v2.4.0

Provides per-station and overall forming-sequence risk assessment.
All outputs are labeled with their computation method:
  [Formula]  — derived from engineering equation
  [Rule]     — industry rule-of-thumb or empirical limit
  [Estimate] — approximated value, use with engineering judgement
  [Table]    — from material/process lookup table

IMPORTANT: This engine is NOT an FEM/FEA solver.
Values are engineering approximations for design guidance.
Do not use for structural certification without physical validation.
"""

import math
from typing import List, Dict, Any, Optional, Tuple

# ─── Material Constants ────────────────────────────────────────────────────────

MATERIAL_PROPS: Dict[str, Dict[str, float]] = {
    "GI":  {"Fy_mpa": 250, "E_gpa": 200, "elongation_pct": 22, "n_strain_hardening": 0.18},
    "GP":  {"Fy_mpa": 250, "E_gpa": 200, "elongation_pct": 22, "n_strain_hardening": 0.18},
    "MS":  {"Fy_mpa": 250, "E_gpa": 210, "elongation_pct": 28, "n_strain_hardening": 0.20},
    "CR":  {"Fy_mpa": 280, "E_gpa": 205, "elongation_pct": 24, "n_strain_hardening": 0.19},
    "HR":  {"Fy_mpa": 240, "E_gpa": 200, "elongation_pct": 26, "n_strain_hardening": 0.17},
    "SS":  {"Fy_mpa": 310, "E_gpa": 193, "elongation_pct": 40, "n_strain_hardening": 0.35},
    "AL":  {"Fy_mpa": 160, "E_gpa": 70,  "elongation_pct": 12, "n_strain_hardening": 0.12},
}

# Min bend radius as multiple of thickness [Rule — from BS EN 10130 / roll forming handbooks]
MIN_BEND_RADIUS_FACTOR: Dict[str, float] = {
    "GI": 0.5, "GP": 0.5, "MS": 0.5, "CR": 1.0, "HR": 0.8, "SS": 1.5, "AL": 1.0,
}

# Max recommended angle increment per pass (degrees) [Rule — industry practice]
MAX_ANGLE_INCREMENT_DEG: Dict[str, float] = {
    "GI": 20.0, "GP": 20.0, "MS": 18.0, "CR": 15.0, "HR": 18.0, "SS": 12.0, "AL": 15.0,
}

# Edge buckling width-to-thickness ratio limit [Rule — Stoeckhert / Bhatt]
EDGE_BUCKLING_WT_LIMIT: float = 30.0

# Twist risk aspect ratio (height / width) [Rule — empirical roll forming practice]
TWIST_RISK_ASPECT_RATIO: float = 0.6

# ─── Type helpers ─────────────────────────────────────────────────────────────

RiskLevel = str  # "OK" | "CAUTION" | "WARNING" | "CRITICAL"


def _risk_level(score: float) -> RiskLevel:
    """Map 0-10 severity score to label."""
    if score < 3.0:
        return "OK"
    elif score < 5.5:
        return "CAUTION"
    elif score < 7.5:
        return "WARNING"
    else:
        return "CRITICAL"


# ─── 1. Bend Severity Index ───────────────────────────────────────────────────

def calculate_bend_severity_index(
    target_angle_deg: float,
    prev_angle_deg: float,
    thickness_mm: float,
    bend_radius_mm: float,
    material: str,
    stage_type: str,
) -> Dict[str, Any]:
    """
    Compute a 0–10 severity score for a single forming pass.

    Considers:
    - Angle increment vs max recommended  [Rule]
    - Outer fibre strain vs elongation    [Formula]
    - Radius-to-thickness ratio           [Rule]
    - Stage aggressiveness                [Rule]

    Returns dict with: score (0-10), level, contributing factors.
    """
    mat = MATERIAL_PROPS.get(material, MATERIAL_PROPS["MS"])
    max_inc = MAX_ANGLE_INCREMENT_DEG.get(material, 18.0)
    min_r_factor = MIN_BEND_RADIUS_FACTOR.get(material, 0.8)
    min_r_mm = min_r_factor * thickness_mm

    angle_increment = abs(target_angle_deg - prev_angle_deg)

    # Factor 1: angle increment ratio [Rule]
    inc_ratio = angle_increment / max_inc  # >1.0 = over-limit
    inc_score = min(10.0, inc_ratio * 6.0)

    # Factor 2: outer fibre strain [Formula: ε = t / (2r + t)]
    if bend_radius_mm > 0:
        strain = thickness_mm / (2 * bend_radius_mm + thickness_mm)
        max_strain = mat["elongation_pct"] / 100 * 0.7  # 70% of elongation = forming limit
        strain_ratio = strain / max_strain if max_strain > 0 else 0
        strain_score = min(10.0, strain_ratio * 8.0)
    else:
        strain = 0.0
        strain_score = 0.0

    # Factor 3: R/t ratio check [Rule — min bend radius limit]
    if bend_radius_mm > 0:
        r_over_t = bend_radius_mm / thickness_mm
        r_limit = min_r_factor
        r_score = max(0.0, min(10.0, (1.0 - r_over_t / max(r_limit, 0.01)) * 10.0))
    else:
        r_over_t = 999.0
        r_score = 0.0

    # Factor 4: stage aggressiveness multiplier [Rule]
    stage_multiplier = {
        "flat": 0.0, "pre_bend": 0.5, "initial_bend": 0.8,
        "progressive_forming": 1.0, "lip_forming": 1.2,
        "final_form": 1.1, "calibration": 0.6,
    }.get(stage_type, 1.0)

    # Weighted aggregate score
    raw_score = (inc_score * 0.40 + strain_score * 0.35 + r_score * 0.25) * stage_multiplier
    final_score = round(min(10.0, max(0.0, raw_score)), 2)

    return {
        "score": final_score,
        "level": _risk_level(final_score),
        "angle_increment_deg": round(angle_increment, 2),
        "max_recommended_increment_deg": max_inc,
        "increment_over_limit": angle_increment > max_inc,
        "outer_fibre_strain": round(strain, 5),
        "strain_score": round(strain_score, 2),
        "bend_radius_mm": bend_radius_mm,
        "min_bend_radius_mm": round(min_r_mm, 2),
        "r_score": round(r_score, 2),
        "stage_type": stage_type,
        "stage_multiplier": stage_multiplier,
        "method": "[Formula + Rule] Weighted severity from angle increment, strain, and R/t checks",
    }


# ─── 2. Edge Buckling Risk ────────────────────────────────────────────────────

def check_edge_buckling_risk(
    strip_width_mm: float,
    thickness_mm: float,
    target_angle_deg: float,
    material: str,
) -> Dict[str, Any]:
    """
    Assess risk of edge buckling / edge wave.

    Based on:
    - Width-to-thickness ratio (w/t)            [Rule — industry limit ~30]
    - Forming angle at this stage                [Rule]
    - Material elongation capacity               [Table]

    Returns risk assessment with risk level and recommendation.
    """
    if thickness_mm <= 0:
        return {"risk_level": "OK", "w_over_t": 0.0, "note": "Invalid thickness"}

    mat = MATERIAL_PROPS.get(material, MATERIAL_PROPS["MS"])
    w_over_t = strip_width_mm / thickness_mm

    # Base risk from w/t ratio [Rule]
    wt_score = min(10.0, max(0.0, (w_over_t - 15.0) / (EDGE_BUCKLING_WT_LIMIT - 15.0) * 7.0))

    # Angle contribution — higher angles at wide strips are more risky [Rule]
    angle_factor = 1.0 + (target_angle_deg / 180.0) * 0.5

    # Material ductility correction (higher elongation = lower risk) [Table]
    ductility_factor = 1.0 - (mat["elongation_pct"] - 12) / 60.0
    ductility_factor = max(0.5, min(1.3, ductility_factor))

    score = min(10.0, wt_score * angle_factor * ductility_factor)

    recommendations = []
    if w_over_t > EDGE_BUCKLING_WT_LIMIT:
        recommendations.append(f"w/t = {w_over_t:.1f} exceeds limit of {EDGE_BUCKLING_WT_LIMIT}. Add edge guide rolls or reduce forming angle increment.")
    if w_over_t > 20 and material in ("CR", "SS"):
        recommendations.append(f"{material} material with high w/t — consider pre-slitting or intermediate annealing.")

    return {
        "risk_level": _risk_level(score),
        "score": round(score, 2),
        "w_over_t": round(w_over_t, 2),
        "w_over_t_limit": EDGE_BUCKLING_WT_LIMIT,
        "at_risk": w_over_t > EDGE_BUCKLING_WT_LIMIT or score >= 5.5,
        "recommendations": recommendations,
        "method": "[Rule] Width-to-thickness ratio check per Stoeckhert/Bhatt forming limits",
    }


# ─── 3. Twist Risk ────────────────────────────────────────────────────────────

def check_twist_risk(
    section_height_mm: float,
    section_width_mm: float,
    target_angle_deg: float,
    is_symmetric: bool,
) -> Dict[str, Any]:
    """
    Estimate risk of profile twisting / torsional instability.

    Based on:
    - Height-to-width aspect ratio (h/w)  [Rule — empirical limit ~0.6 for asymmetric]
    - Profile symmetry                    [Rule]
    - Forming angle                       [Rule]

    Returns twist risk assessment.
    """
    if section_width_mm <= 0:
        return {"risk_level": "OK", "aspect_ratio": 0.0}

    aspect_ratio = section_height_mm / section_width_mm

    # Asymmetric profiles are 1.8× more likely to twist [Rule — roll forming practice]
    symmetry_factor = 1.0 if is_symmetric else 1.8

    # Base score from aspect ratio [Rule]
    base_score = min(10.0, max(0.0, (aspect_ratio - 0.3) / (TWIST_RISK_ASPECT_RATIO - 0.3) * 6.0))

    # Higher forming angle increases torsional tendency [Rule]
    angle_factor = 1.0 + (target_angle_deg / 90.0) * 0.3

    score = min(10.0, base_score * symmetry_factor * angle_factor)

    recommendations = []
    if not is_symmetric and score >= 5.0:
        recommendations.append("Asymmetric profile — add anti-twist side rolls at forming stations.")
    if aspect_ratio > 0.7:
        recommendations.append(f"High aspect ratio ({aspect_ratio:.2f}) — consider reducing forming speed and adding straightening rolls.")
    if score >= 7.5:
        recommendations.append("CRITICAL: Profile geometry prone to twist. Redesign forming sequence or add dedicated de-twist station.")

    return {
        "risk_level": _risk_level(score),
        "score": round(score, 2),
        "aspect_ratio": round(aspect_ratio, 3),
        "aspect_ratio_limit": TWIST_RISK_ASPECT_RATIO,
        "is_symmetric": is_symmetric,
        "at_risk": score >= 5.5,
        "recommendations": recommendations,
        "method": "[Rule] Aspect ratio + symmetry check per roll forming torsional instability criteria",
    }


# ─── 4. Calibration Need Estimator ────────────────────────────────────────────

def estimate_calibration_need(
    material: str,
    target_angle_deg: float,
    thickness_mm: float,
    n_passes: int,
    has_calibration_pass: bool,
) -> Dict[str, Any]:
    """
    Estimate how much calibration (final sizing) is needed.

    Based on:
    - Material springback factor   [Table]
    - Target angle severity        [Rule]
    - Number of forming passes     [Rule — more passes = more cumulative error]
    - Whether calibration exists   [Rule]

    Returns calibration urgency score and recommended actions.
    """
    from app.engines.springback_engine import SPRINGBACK_FACTORS
    springback_factor = SPRINGBACK_FACTORS.get(material, 2.5)

    # Springback severity contribution [Table]
    sb_score = min(10.0, (springback_factor / 4.0) * 7.0)

    # Angle contribution — deep bends need more calibration [Rule]
    angle_score = min(10.0, (target_angle_deg / 90.0) * 5.0)

    # Pass count contribution — cumulative springback error [Rule]
    pass_score = min(10.0, (n_passes / 12.0) * 4.0)

    urgency_score = (sb_score * 0.45 + angle_score * 0.35 + pass_score * 0.20)
    urgency_score = round(min(10.0, urgency_score), 2)

    recommendations = []
    if not has_calibration_pass and urgency_score >= 5.0:
        recommendations.append("Calibration pass recommended — add final sizing station.")
    if springback_factor >= 3.5:
        recommendations.append(f"{material} has high springback ({springback_factor}°/90°). Use 0.5–1.0° overbend in calibration pass.")
    if target_angle_deg >= 80 and material in ("SS", "AL"):
        recommendations.append("Near-90° angle on high-springback material — consider 2-step calibration (pre-cal + final-cal).")
    if n_passes < 4 and urgency_score >= 6.0:
        recommendations.append("Too few passes for this angle/material combination — add intermediate passes to reduce per-pass strain.")

    return {
        "urgency_score": urgency_score,
        "level": _risk_level(urgency_score),
        "springback_factor": springback_factor,
        "has_calibration_pass": has_calibration_pass,
        "recommendations": recommendations,
        "method": "[Table + Rule] Springback factor, angle, and pass-count calibration urgency estimator",
    }


# ─── 5. Deformation Confidence Score ─────────────────────────────────────────

def calculate_deformation_confidence(
    material: str,
    thickness_mm: float,
    target_angle_deg: float,
    bend_radius_mm: float,
    n_passes: int,
) -> Dict[str, Any]:
    """
    Estimate the reliability/confidence of the engineering calculations.

    Confidence is reduced by:
    - Thin material (more sensitive to variation)   [Rule]
    - Extreme angles (>80°)                         [Rule]
    - Very tight radii (R/t < 1)                    [Rule]
    - Few passes (coarse approximation)             [Rule]

    Returns 0–100% confidence score with explanation.
    """
    score = 100.0

    # Thin material penalty [Rule]
    if thickness_mm < 0.8:
        score -= 20.0
    elif thickness_mm < 1.2:
        score -= 10.0

    # Extreme angle penalty [Rule]
    if target_angle_deg > 85:
        score -= 15.0
    elif target_angle_deg > 75:
        score -= 8.0

    # Tight radius penalty [Rule]
    if bend_radius_mm > 0:
        r_over_t = bend_radius_mm / thickness_mm
        if r_over_t < 0.8:
            score -= 20.0
        elif r_over_t < 1.5:
            score -= 10.0

    # Few passes = coarser approximation [Rule]
    if n_passes < 4:
        score -= 12.0
    elif n_passes < 6:
        score -= 5.0

    # Material-specific confidence [Rule — SS and AL are less predictable empirically]
    if material in ("SS", "AL"):
        score -= 8.0
    elif material in ("CR",):
        score -= 5.0

    confidence_pct = round(max(20.0, min(100.0, score)), 1)

    level = "HIGH" if confidence_pct >= 75 else "MEDIUM" if confidence_pct >= 50 else "LOW"

    notes = []
    if confidence_pct < 75:
        notes.append("Empirical model accuracy is reduced — validate with physical trial run.")
    if material == "SS":
        notes.append("SS springback prediction carries ±20% uncertainty. Physical springback test recommended.")
    if thickness_mm < 1.0:
        notes.append("Thin gauge material — small variations in coil properties cause larger deviations.")

    return {
        "confidence_pct": confidence_pct,
        "confidence_level": level,
        "notes": notes,
        "method": "[Estimate] Empirical confidence scoring — NOT a validated FEA accuracy measure",
    }


# ─── 6. Over-Compression Warning ─────────────────────────────────────────────

def check_over_compression(
    roll_gap_mm: float,
    thickness_mm: float,
    material: str,
) -> Dict[str, Any]:
    """
    Detect if roll gap is too tight, risking over-compression.

    Roll gap should be 90–110% of thickness for most materials.
    [Rule — standard roll forming practice]
    """
    if thickness_mm <= 0:
        return {"at_risk": False, "ratio": 0.0, "level": "OK"}

    gap_ratio = roll_gap_mm / thickness_mm

    # Material-specific gap tolerance [Rule]
    min_ratio = {"GI": 0.85, "MS": 0.88, "SS": 0.90, "CR": 0.90, "HR": 0.85, "AL": 0.88}.get(material, 0.88)
    max_ratio = {"GI": 1.15, "MS": 1.12, "SS": 1.10, "CR": 1.10, "HR": 1.12, "AL": 1.10}.get(material, 1.12)

    at_risk = gap_ratio < min_ratio or gap_ratio > max_ratio
    too_tight = gap_ratio < min_ratio
    too_loose = gap_ratio > max_ratio

    score = 0.0
    if too_tight:
        score = min(10.0, (min_ratio - gap_ratio) / min_ratio * 20.0)
    elif too_loose:
        score = min(6.0, (gap_ratio - max_ratio) / max_ratio * 10.0)

    note = ""
    if too_tight:
        note = f"Gap {roll_gap_mm:.2f}mm is too tight ({gap_ratio:.2f}× thickness). Risk: over-compression, tool damage, strip marking."
    elif too_loose:
        note = f"Gap {roll_gap_mm:.2f}mm is too wide ({gap_ratio:.2f}× thickness). Risk: inadequate forming, springback not corrected."
    else:
        note = f"Gap {roll_gap_mm:.2f}mm = {gap_ratio:.2f}× thickness. Within accepted range [{min_ratio:.2f}–{max_ratio:.2f}×]."

    return {
        "at_risk": at_risk,
        "too_tight": too_tight,
        "too_loose": too_loose,
        "gap_ratio": round(gap_ratio, 3),
        "min_ratio": min_ratio,
        "max_ratio": max_ratio,
        "score": round(score, 2),
        "level": _risk_level(score),
        "note": note,
        "method": "[Rule] Roll gap-to-thickness ratio check per standard roll forming practice",
    }


# ─── 7. Full Risk Report (per sequence) ──────────────────────────────────────

def generate_engineering_risk_report(
    passes: List[Dict[str, Any]],
    material: str,
    thickness_mm: float,
    section_height_mm: float,
    section_width_mm: float,
    is_symmetric: bool,
    has_calibration_pass: bool,
    bend_radius_mm: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Full forming-sequence risk analysis.

    Runs all risk checks per-pass and aggregates into an overall report.

    Args:
        passes:              list of pass dicts with target_angle_deg, roll_gap_mm, strip_width_mm, stage_type
        material:            material code
        thickness_mm:        strip/sheet thickness
        section_height_mm:   finished profile height
        section_width_mm:    finished profile width
        is_symmetric:        whether profile is symmetric left/right
        has_calibration_pass: whether a calibration/sizing pass is present
        bend_radius_mm:      effective bend radius (optional, estimated if None)

    Returns:
        Full risk report dict with per-pass and summary data.
    """
    n_passes = len(passes)
    if n_passes == 0:
        return {"error": "No passes provided", "overall_risk": "UNKNOWN"}

    final_angle = passes[-1].get("target_angle_deg", 0.0) if passes else 0.0
    r_mm = bend_radius_mm if bend_radius_mm else max(1.5 * thickness_mm, 3.0)

    per_pass_results = []
    for i, p in enumerate(passes):
        prev_angle = passes[i - 1]["target_angle_deg"] if i > 0 else 0.0
        cur_angle = p.get("target_angle_deg", 0.0)
        gap_mm = p.get("roll_gap_mm", thickness_mm)
        strip_w = p.get("strip_width_mm", section_width_mm * 3)
        stage = p.get("stage_type", "progressive_forming")
        pass_no = p.get("pass_no", i + 1)

        severity = calculate_bend_severity_index(
            target_angle_deg=cur_angle,
            prev_angle_deg=prev_angle,
            thickness_mm=thickness_mm,
            bend_radius_mm=r_mm,
            material=material,
            stage_type=stage,
        )
        buckling = check_edge_buckling_risk(strip_w, thickness_mm, cur_angle, material)
        compression = check_over_compression(gap_mm, thickness_mm, material)

        per_pass_results.append({
            "pass_no": pass_no,
            "stage_type": stage,
            "target_angle_deg": cur_angle,
            "severity": severity,
            "edge_buckling": buckling,
            "over_compression": compression,
            "pass_risk_level": _risk_level(max(
                severity["score"],
                buckling["score"],
                compression["score"],
            )),
        })

    twist = check_twist_risk(section_height_mm, section_width_mm, final_angle, is_symmetric)
    cal_need = estimate_calibration_need(material, final_angle, thickness_mm, n_passes, has_calibration_pass)
    confidence = calculate_deformation_confidence(material, thickness_mm, final_angle, r_mm, n_passes)

    # Overall risk = worst individual pass risk or sequence-level risk
    pass_scores = [max(
        r["severity"]["score"],
        r["edge_buckling"]["score"],
        r["over_compression"]["score"],
    ) for r in per_pass_results]
    overall_score = max(max(pass_scores) if pass_scores else 0.0, twist["score"] * 0.8)

    # Count warnings by severity
    critical_count = sum(1 for r in per_pass_results if r["pass_risk_level"] == "CRITICAL")
    warning_count  = sum(1 for r in per_pass_results if r["pass_risk_level"] == "WARNING")
    caution_count  = sum(1 for r in per_pass_results if r["pass_risk_level"] == "CAUTION")

    # Aggregate all recommendations
    all_recommendations: List[str] = []
    for r in per_pass_results:
        all_recommendations.extend(r["edge_buckling"].get("recommendations", []))
        all_recommendations.extend(r["over_compression"].get("note", "").split(". ") if r["over_compression"]["at_risk"] else [])
    all_recommendations.extend(twist.get("recommendations", []))
    all_recommendations.extend(cal_need.get("recommendations", []))
    all_recommendations.extend(confidence.get("notes", []))
    all_recommendations = list(dict.fromkeys([r for r in all_recommendations if r.strip()]))  # dedup

    return {
        "overall_risk_level": _risk_level(overall_score),
        "overall_score": round(overall_score, 2),
        "confidence": confidence,
        "per_pass": per_pass_results,
        "twist_risk": twist,
        "calibration_need": cal_need,
        "summary": {
            "total_passes": n_passes,
            "critical_passes": critical_count,
            "warning_passes": warning_count,
            "caution_passes": caution_count,
            "material": material,
            "thickness_mm": thickness_mm,
            "final_angle_deg": final_angle,
            "is_symmetric": is_symmetric,
        },
        "recommendations": all_recommendations,
        "disclaimer": (
            "[Estimate] All values are empirical approximations for design guidance only. "
            "Validate critical profiles with physical trial runs before production."
        ),
    }
