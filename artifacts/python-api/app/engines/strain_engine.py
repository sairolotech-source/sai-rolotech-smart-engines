"""
strain_engine.py — Bend Strain Calculation Engine

Calculates outer-fibre tensile strain at each bend zone.
Uses the standard engineering formula: ε = t / (2R + t)
where R = inner bend radius, t = sheet thickness.
"""
from typing import Dict, Any
from app.utils.response import pass_response, fail_response

MATERIAL_FRACTURE_STRAIN: Dict[str, float] = {
    "GI": 0.40,   # Hot-dip galvanised — elongation ~28%, effective limit ~40%
    "GP": 0.40,
    "MS": 0.38,   # Mild steel
    "CR": 0.38,   # Cold-rolled steel
    "HR": 0.35,   # Hot-rolled
    "SS": 0.32,   # Stainless — work-hardens quickly
    "AL": 0.28,   # Aluminium alloys
    "ALUMINIUM": 0.28,
}


def calculate_strain(
    radius_mm: float,
    thickness_mm: float,
    material: str = "GI",
) -> Dict[str, Any]:
    """
    Calculate outer-fibre strain at a bend.

    Args:
        radius_mm:   inner bend radius (mm)
        thickness_mm: sheet thickness (mm)
        material:    material code for fracture-strain threshold lookup

    Returns:
        pass_response with strain_value, severity, r_over_t, blocking
    """
    if radius_mm <= 0:
        return fail_response("strain_engine", "Bend radius must be > 0")
    if thickness_mm <= 0:
        return fail_response("strain_engine", "Thickness must be > 0")

    strain = thickness_mm / (2.0 * radius_mm + thickness_mm)
    r_over_t = radius_mm / thickness_mm
    mat = str(material).upper()
    fracture = MATERIAL_FRACTURE_STRAIN.get(mat, 0.38)

    # Severity thresholds as fraction of fracture limit
    if strain >= fracture:
        severity = "high"
        blocking = True
        note = f"Strain {strain:.1%} ≥ fracture limit {fracture:.0%} — cracking probable"
    elif strain >= fracture * 0.75:
        severity = "medium"
        blocking = False
        note = f"Strain {strain:.1%} at 75–100% of fracture limit — monitor bend zone"
    elif strain >= fracture * 0.50:
        severity = "low_medium"
        blocking = False
        note = f"Strain {strain:.1%} at 50–75% of fracture limit — acceptable"
    else:
        severity = "low"
        blocking = False
        note = f"Strain {strain:.1%} — well within safe range"

    return pass_response("strain_engine", {
        "strain_value":          round(strain, 6),
        "strain_pct":            round(strain * 100, 3),
        "r_over_t":              round(r_over_t, 3),
        "fracture_strain_limit": fracture,
        "severity":              severity,
        "note":                  note,
        "confidence":            "high",
        "blocking":              blocking,
    })
