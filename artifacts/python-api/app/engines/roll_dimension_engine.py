"""
roll_dimension_engine.py - Roll Dimension Engine

Derives manufacturable roll part dimensions from profile + shaft data:
  - Roll OD from profile envelope + bend complexity + shaft packaging
  - Face width from contour relief allowance
  - Bore diameter from shaft diameter
  - Keyway from DIN 6885 table
  - Spacer width from shaft and contour relief constraints
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

    width = float(profile_result.get("section_width_mm", 0))
    height = float(profile_result.get("section_height_mm", 0))
    thickness = float(input_result.get("sheet_thickness_mm", 0))
    shaft_dia = float(shaft_result.get("suggested_shaft_diameter_mm", 50))
    bend_count = int(profile_result.get("bend_count", 2))

    if width <= 0 and height <= 0:
        return fail_response("roll_dimension_engine", "Invalid profile dimensions")

    width = max(width, 1.0)
    height = max(height, 1.0)
    thickness = max(thickness, 0.1)
    bend_count = max(1, bend_count)

    envelope_diag = (width**2 + height**2) ** 0.5
    contour_depth_proxy = max(height * 0.35, thickness * (0.8 * bend_count))
    radial_wall = max(
        6.0,
        0.16 * shaft_dia,
        (0.42 * contour_depth_proxy) + max(2.0, thickness * 1.5),
    )

    roll_od = max(
        shaft_dia + 12.0,
        shaft_dia + (2.0 * radial_wall) + max(2.0, 0.50 * contour_depth_proxy),
        envelope_diag * 0.55,
    )

    contour_relief = max(4.0, 0.08 * envelope_diag + 0.16 * thickness * bend_count)
    face_width = max(24.0, width + (2.0 * contour_relief))

    bore_dia = shaft_dia
    keyway_width = _keyway_for(shaft_dia)
    spacer_width = round(max(4.0, shaft_dia * 0.07, 0.12 * contour_relief), 1)

    return pass_response("roll_dimension_engine", {
        "estimated_roll_od_mm": round(roll_od, 2),
        "face_width_mm": round(face_width, 2),
        "bore_dia_mm": round(bore_dia, 2),
        "keyway_width_mm": keyway_width,
        "spacer_width_mm": spacer_width,
        "shaft_dia_mm": shaft_dia,
        "dimension_source": "geometry_constraint_derived",
        "confidence": "medium",
        "blocking": False,
        "notes": [
            "OD and face width are derived from profile envelope, bend complexity, and shaft packaging constraints",
            f"Envelope diag considered: {round(envelope_diag, 2)} mm",
            f"Contour depth proxy considered: {round(contour_depth_proxy, 2)} mm",
            f"Keyway per DIN 6885: b={keyway_width} mm",
            "Tolerance: OD h6, Bore H7",
        ],
    })

