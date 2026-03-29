"""
springback_engine.py — Springback Prediction Engine

Estimates springback angle using two models:
  1. Simple material factor (fast, rule-based)
  2. Elastic-plastic R/t model (more accurate when R and t are known)

Springback compensation is the EXTRA over-bend needed so the part
springs back to the correct final angle.
"""
import math
from typing import Dict, Any, Optional
from app.utils.response import pass_response, fail_response

SPRINGBACK_FACTORS: Dict[str, float] = {
    "GI": 1.5,
    "GP": 1.5,
    "MS": 2.5,
    "CR": 2.5,
    "HR": 3.0,
    "SS": 4.0,
    "AL": 3.0,
    "ALUMINIUM": 3.0,
}

YIELD_STRENGTH_MPA: Dict[str, float] = {
    "GI": 250, "GP": 250, "MS": 250, "CR": 280,
    "HR": 240, "SS": 310, "AL": 160, "ALUMINIUM": 160,
}

ELASTIC_MODULUS_GPA: Dict[str, float] = {
    "GI": 200, "GP": 200, "MS": 210, "CR": 205,
    "HR": 200, "SS": 193, "AL": 70, "ALUMINIUM": 70,
}


def calculate_springback(
    material: str,
    target_angle_deg: float,
    thickness_mm: Optional[float] = None,
    bend_radius_mm: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Predict springback and give the corrected (over-bend) angle.

    If thickness_mm and bend_radius_mm are provided, uses the elastic-plastic
    R/t model (more accurate). Otherwise falls back to simple material factor.

    Args:
        material:        material code
        target_angle_deg: desired final bend angle (°)
        thickness_mm:    sheet thickness (optional, for R/t model)
        bend_radius_mm:  inner bend radius (optional, for R/t model)

    Returns:
        pass_response with springback_deg, corrected_angle_deg, model_used
    """
    if target_angle_deg < 0 or target_angle_deg > 180:
        return fail_response("springback_engine", f"Angle must be 0–180°, got {target_angle_deg}")

    mat = str(material).upper()
    base_factor = SPRINGBACK_FACTORS.get(mat, 2.0)
    Fy  = YIELD_STRENGTH_MPA.get(mat, 250)        # MPa
    E   = ELASTIC_MODULUS_GPA.get(mat, 200) * 1000  # MPa

    model_used = "material_factor"
    springback_deg = base_factor * (target_angle_deg / 90.0)

    # Better model if geometry is available
    if thickness_mm and bend_radius_mm and thickness_mm > 0 and bend_radius_mm > 0:
        r_over_t = bend_radius_mm / thickness_mm
        # Elastic-plastic springback: δ = (Fy / E) * R/t * θ  (simplified)
        sb_ep = (Fy / E) * r_over_t * target_angle_deg
        # Take the larger of the two estimates (conservative)
        springback_deg = max(springback_deg, sb_ep)
        model_used = "elastic_plastic_r_over_t"

    corrected = target_angle_deg + springback_deg

    return pass_response("springback_engine", {
        "target_angle_deg":           round(target_angle_deg, 3),
        "springback_deg":             round(springback_deg, 3),
        "corrected_angle_deg":        round(corrected, 3),
        "springback_compensation_deg": round(springback_deg, 3),
        "model_used":                 model_used,
        "confidence":                 "high" if model_used == "elastic_plastic_r_over_t" else "medium",
        "blocking":                   False,
    })
