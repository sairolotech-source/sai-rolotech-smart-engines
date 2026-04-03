"""
bearing_engine.py — Bearing Selection Engine
Uses Rule Book §7:
  40mm→6208 | 50mm→6210 | 60mm→6212 | 70mm→6214
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response
from app.utils.engineering_rules import select_bearing_for_shaft, MATERIAL_FORMING_DIFFICULTY

logger = logging.getLogger("bearing_engine")


def select_bearing(
    shaft_result: Dict[str, Any],
    input_result: Dict[str, Any],
) -> Dict[str, Any]:
    dia = shaft_result.get("suggested_shaft_diameter_mm", 50)
    material = input_result.get("material", "GI")
    duty = shaft_result.get("duty_class", "MEDIUM")

    bearing = select_bearing_for_shaft(dia)
    forming_diff = MATERIAL_FORMING_DIFFICULTY.get(material, "moderate")

    family = "deep_groove_ball_bearing"
    if forming_diff in ("hard", "very_hard") or dia >= 60:
        family = "taper_roller_bearing"

    logger.info("[bearing_engine] shaft=%dmm bearing=%s family=%s", dia, bearing, family)

    return pass_response("bearing_engine", {
        "suggested_bearing_type": bearing,
        "bearing_family": family,
        "shaft_diameter_mm": dia,
        "duty_class": duty,
        "reason": f"Rule Book §7: {dia}mm shaft → {bearing} ({family})",
        "rule": f"{duty} → {dia}mm → {bearing}",
    })
