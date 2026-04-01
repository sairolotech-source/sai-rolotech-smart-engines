"""
bend_allowance_engine.py — Flat Blank & Bend Allowance Calculator

Calculates the developed (flat blank) length of a roll formed profile
using the DIN 6935 neutral axis / K-factor method.

Formula:
  Bend Allowance (BA) = (π/180) × (R + k × t) × θ
  where:
    R = inner bend radius (mm)
    t = sheet thickness (mm)
    k = K-factor (neutral axis ratio, material-dependent, 0.4–0.5)
    θ = bend angle (degrees)

  Flat Blank Length = Σ straight segments + Σ bend allowances

Reference:
  DIN 6935:1975 — Cold Bending of Flat Rolled Steel
  Machinery's Handbook 30th Ed. §Sheet Metal
"""
import math
from typing import Any, Dict, List, Optional

from app.utils.response import pass_response, fail_response
from app.utils.material_database import get_property

_DEFAULT_K = 0.44


def _k_factor(material: str) -> float:
    return get_property(material, "k_factor", _DEFAULT_K)


def bend_allowance(
    radius_mm: float,
    thickness_mm: float,
    angle_deg: float,
    material: str = "GI",
) -> float:
    """
    Single bend allowance (mm).

    Args:
        radius_mm:   inner bend radius (mm)
        thickness_mm: sheet thickness (mm)
        angle_deg:   bend angle (degrees, 0–180)
        material:    material code for K-factor lookup

    Returns:
        Bend allowance in mm
    """
    k = _k_factor(material)
    r_neutral = radius_mm + k * thickness_mm
    ba = (math.pi / 180.0) * r_neutral * abs(angle_deg)
    return round(ba, 4)


def calculate_flat_blank(
    segments_mm: List[float],
    bend_angles_deg: List[float],
    thickness_mm: float,
    bend_radius_mm: float,
    material: str = "GI",
) -> Dict[str, Any]:
    """
    Calculate total flat blank length for a multi-bend profile.

    The profile is described as alternating segments and bend angles:
      segment[0] — bend[0] — segment[1] — bend[1] — ... — segment[n]

    So len(segments_mm) == len(bend_angles_deg) + 1

    Args:
        segments_mm:     List of straight segment lengths (mm) between bends
        bend_angles_deg: List of bend angles (degrees) at each bend
        thickness_mm:    Sheet thickness (mm)
        bend_radius_mm:  Inner bend radius at all bends (mm); can be overridden per-bend
        material:        Material code

    Returns:
        pass_response with flat_blank_mm, bend_allowances, k_factor, etc.
    """
    if thickness_mm <= 0:
        return fail_response("bend_allowance_engine", "Thickness must be > 0 mm")
    if bend_radius_mm < 0:
        return fail_response("bend_allowance_engine", "Bend radius must be ≥ 0 mm")
    if len(segments_mm) != len(bend_angles_deg) + 1:
        return fail_response(
            "bend_allowance_engine",
            f"segments count ({len(segments_mm)}) must equal bend_angles count + 1 ({len(bend_angles_deg) + 1})"
        )

    k = _k_factor(material)
    bend_allocs = []
    total_ba = 0.0

    for i, angle in enumerate(bend_angles_deg):
        if angle < 0 or angle > 180:
            return fail_response(
                "bend_allowance_engine",
                f"Bend angle[{i}] = {angle}° out of range (0–180°)"
            )
        ba = bend_allowance(bend_radius_mm, thickness_mm, angle, material)
        bend_allocs.append({
            "bend_index": i + 1,
            "angle_deg": angle,
            "radius_mm": bend_radius_mm,
            "k_factor": k,
            "bend_allowance_mm": ba,
        })
        total_ba += ba

    total_segments = sum(segments_mm)
    flat_blank = round(total_segments + total_ba, 3)

    # Minimum inner bend radius check (from material database)
    min_r_x_t = get_property(material, "min_bend_radius_x_t", 0.5)
    min_r_mm = min_r_x_t * thickness_mm
    r_warnings = []
    if bend_radius_mm < min_r_mm:
        r_warnings.append(
            f"Inner radius {bend_radius_mm}mm < minimum {min_r_mm:.1f}mm "
            f"({min_r_x_t}×t) for {material} — cracking risk"
        )

    return pass_response("bend_allowance_engine", {
        "flat_blank_mm": flat_blank,
        "total_segment_length_mm": round(total_segments, 3),
        "total_bend_allowance_mm": round(total_ba, 3),
        "bend_count": len(bend_angles_deg),
        "k_factor": k,
        "material": material.upper(),
        "thickness_mm": thickness_mm,
        "bend_radius_mm": bend_radius_mm,
        "bend_allowances": bend_allocs,
        "method": "DIN_6935_K_factor",
        "confidence": "high",
        "blocking": len(r_warnings) > 0,
        "warnings": r_warnings,
    })


def flat_blank_from_profile(
    profile_segments_mm: List[float],
    profile_bend_angles_deg: List[float],
    thickness_mm: float,
    bend_radius_mm: float,
    material: str = "GI",
    coil_width_tolerance_mm: float = 1.5,
) -> Dict[str, Any]:
    """
    Full flat blank report including coil strip width recommendation.

    Includes:
    - Developed flat blank width
    - Recommended coil strip width (+ edge trim tolerance)
    - Weight per meter (kg/m) estimate

    Args:
        profile_segments_mm:     Profile segment lengths (mm)
        profile_bend_angles_deg: Bend angles (degrees)
        thickness_mm:            Sheet thickness
        bend_radius_mm:          Inner bend radius
        material:                Material code
        coil_width_tolerance_mm: Edge trim + tolerance to add to flat blank (default 1.5mm)

    Returns:
        Extended pass_response with coil strip width and weight/m
    """
    result = calculate_flat_blank(
        profile_segments_mm, profile_bend_angles_deg,
        thickness_mm, bend_radius_mm, material
    )
    if result.get("status") != "pass":
        return result

    flat_blank = result["flat_blank_mm"]
    coil_width = round(flat_blank + coil_width_tolerance_mm, 1)

    # Weight per meter: kg/m = cross-section_area_m² × density_kg/m³ × 1 m length
    # cross_section = (blank_width_m) × (thickness_m) = (flat_blank/1000) × (thickness_mm/1000)
    density = get_property(material, "density_kg_m3", 7850)
    weight_kg_per_m = round((flat_blank / 1000.0) * (thickness_mm / 1000.0) * density, 3)

    result.update({
        "coil_strip_width_mm": coil_width,
        "coil_width_tolerance_mm": coil_width_tolerance_mm,
        "weight_kg_per_m": weight_kg_per_m,
        "density_kg_m3": density,
    })
    return result
