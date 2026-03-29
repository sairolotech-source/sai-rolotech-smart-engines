"""
roll_dimension_engine.py — Roll Dimension Engine

Derives manufactureable roll part dimensions from profile + shaft data:
  • Roll OD — based on section width + thickness class
  • Face width — section width + clearance stock
  • Bore diameter — matches selected shaft diameter
  • Keyway — DIN 6885 key size by shaft diameter
  • Spacer width estimate

Blueprint source: Advance Roll Engine + Export Engine blueprint.
"""
from typing import Any, Dict

from app.utils.response import pass_response, fail_response

# DIN 6885 keyway width by shaft diameter
_KEYWAY_WIDTH: Dict[int, int] = {
    40: 12,
    50: 14,
    60: 18,
    70: 20,
    80: 22,
    90: 25,
}


def _keyway_for(shaft_dia: float) -> int:
    for dia, kw in sorted(_KEYWAY_WIDTH.items()):
        if shaft_dia <= dia:
            return kw
    return max(_KEYWAY_WIDTH.values())


def generate_roll_dimensions(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Calculate roll OD, face width, bore, keyway, and spacer estimate.
    """
    if not profile_result:
        return fail_response("roll_dimension_engine", "Profile result missing")

    width     = float(profile_result.get("section_width_mm", 0))
    height    = float(profile_result.get("section_height_mm", 0))
    thickness = float(input_result.get("sheet_thickness_mm", 0))
    shaft_dia = float(shaft_result.get("suggested_shaft_diameter_mm", 50))

    if width <= 0 and height <= 0:
        return fail_response("roll_dimension_engine", "Invalid profile dimensions")

    # Roll OD: base on section width × 1.2, minimum 80 mm; bump for thick material
    roll_od = max(80.0, width * 1.2)
    if thickness >= 0.8:
        roll_od += 10.0
    if thickness >= 1.2:
        roll_od += 10.0
    if thickness >= 2.0:
        roll_od += 15.0

    face_width   = width + 20.0
    bore_dia     = shaft_dia
    keyway_width = _keyway_for(shaft_dia)
    spacer_width = round(max(5.0, shaft_dia * 0.08), 1)

    return pass_response("roll_dimension_engine", {
        "estimated_roll_od_mm": round(roll_od, 2),
        "face_width_mm":        round(face_width, 2),
        "bore_dia_mm":          round(bore_dia, 2),
        "keyway_width_mm":      keyway_width,
        "spacer_width_mm":      spacer_width,
        "shaft_dia_mm":         shaft_dia,
        "confidence":           "medium",
        "blocking":             False,
        "notes": [
            "OD estimate based on rule book — final OD from roll design calc engine",
            f"Keyway per DIN 6885: b={keyway_width} mm",
            "Tolerance: OD h6, Bore H7",
        ],
    })
