"""
force_engine.py — Forming Force & Power Estimation Engine

Estimates:
  - Forming force per pass (kN)
  - Motor power requirement (kW)
  - Torque at drive shaft (N·m)

Formula basis: F = k × t² × w × Fy / r
  k = 0.8 (roll forming efficiency factor)
  t = thickness (mm)
  w = strip width (mm)
  Fy = yield strength (MPa)
  r = bend radius (mm)
"""
from typing import Dict, Any
from app.utils.response import pass_response, fail_response

MATERIAL_STRENGTH_MPA: Dict[str, float] = {
    "GI": 280,  "GP": 280,  "MS": 350,  "CR": 320,
    "HR": 380,  "SS": 520,  "AL": 180,  "ALUMINIUM": 180,
}

EFFICIENCY = 0.75   # drive train efficiency
ROLL_RADIUS_MM = 80 # typical roll radius (mm) for torque calc


def estimate_forming_force(
    thickness_mm: float,
    width_mm: float,
    material: str,
    bend_radius_mm: float = 2.0,
    strip_speed_mpm: float = 15.0,
) -> Dict[str, Any]:
    """
    Estimate forming force, motor power, and torque per pass.

    Args:
        thickness_mm:   sheet thickness (mm)
        width_mm:       strip width at this pass (mm)
        material:       material code
        bend_radius_mm: inner bend radius (mm)
        strip_speed_mpm: strip speed (m/min) for power calculation

    Returns:
        pass_response with force, power, torque, force_level
    """
    if thickness_mm <= 0:
        return fail_response("force_engine", "Thickness must be > 0")
    if width_mm <= 0:
        return fail_response("force_engine", "Width must be > 0")
    if bend_radius_mm <= 0:
        bend_radius_mm = max(thickness_mm, 1.0)

    mat  = str(material).upper()
    Fy   = MATERIAL_STRENGTH_MPA.get(mat, 300)
    r    = bend_radius_mm

    # Forming force (N) = k × t² × w × Fy / r
    force_n = 0.8 * (thickness_mm ** 2) * width_mm * Fy / r

    # Motor power (kW) = F × v / η
    v_mps   = strip_speed_mpm / 60.0
    power_kw = (force_n * v_mps) / (EFFICIENCY * 1000)

    # Torque at drive shaft (N·m) = F × roll_radius
    torque_nm = force_n * (ROLL_RADIUS_MM / 1000.0)

    force_kn = force_n / 1000.0

    # Classify load level
    if force_kn > 100:
        level = "heavy"
    elif force_kn > 40:
        level = "medium"
    elif force_kn > 10:
        level = "light"
    else:
        level = "very_light"

    return pass_response("force_engine", {
        "estimated_force_n":   round(force_n, 2),
        "estimated_force_kn":  round(force_kn, 4),
        "motor_power_kw":      round(power_kw, 4),
        "torque_nm":           round(torque_nm, 2),
        "force_level":         level,
        "material_strength_mpa": Fy,
        "strip_speed_mpm":     strip_speed_mpm,
        "confidence":          "medium",
        "blocking":            False,
    })
