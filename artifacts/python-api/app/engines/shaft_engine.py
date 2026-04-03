"""
shaft_engine.py — Shaft Selection Engine
Uses Rule Book §5 duty-class table:
  LIGHT→40mm | MEDIUM→50mm | HEAVY→60mm | INDUSTRIAL→70mm
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response
from app.utils.engineering_rules import (
    calc_duty_class,
    SHAFT_DIAMETER_MM,
    MATERIAL_FORMING_DIFFICULTY,
)

logger = logging.getLogger("shaft_engine")


def select_shaft(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    station_result: Dict[str, Any],
) -> Dict[str, Any]:
    thickness = input_result.get("sheet_thickness_mm", 1.0)
    material = input_result.get("material", "GI")
    complexity = station_result.get("complexity_tier", "SIMPLE")

    duty = calc_duty_class(thickness, complexity, material)
    dia = SHAFT_DIAMETER_MM[duty]
    forming_diff = MATERIAL_FORMING_DIFFICULTY.get(material, "moderate")

    reason = (
        f"Thickness={thickness}mm ({input_result.get('thickness_category','std')}) + "
        f"complexity={complexity} + material={material} ({forming_diff}) → {duty} duty"
    )

    logger.info("[shaft_engine] duty=%s shaft=%dmm", duty, dia)

    return pass_response("shaft_engine", {
        "suggested_shaft_diameter_mm": dia,
        "duty_class": duty,
        "shaft_selection_reason": reason,
        "rule": f"{duty} → {dia}mm (Rule Book §6)",
    })
