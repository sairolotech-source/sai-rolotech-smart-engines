"""
duty_engine.py — Machine Duty Classification Engine
Consolidates final duty class from all upstream engines.
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response
from app.utils.engineering_rules import calc_duty_class

logger = logging.getLogger("duty_engine")

DUTY_DESCRIPTIONS: Dict[str, str] = {
    "LIGHT": "Light duty — thin gauge / simple profile / GI/CR/AL materials",
    "MEDIUM": "Medium duty — standard production C/Z/lipped channels",
    "HEAVY": "Heavy duty — thick gauge / complex profile / SS/HR materials",
    "INDUSTRIAL": "Industrial duty — ultra-heavy / multi-return / titanium/HSLA",
}

STAND_STRENGTH: Dict[str, str] = {
    "LIGHT": "100–200 kN capacity stand recommended",
    "MEDIUM": "200–400 kN capacity stand recommended",
    "HEAVY": "400–600 kN capacity stand recommended",
    "INDUSTRIAL": "600+ kN capacity industrial stand required",
}


def classify(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    station_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
) -> Dict[str, Any]:
    thickness = input_result.get("sheet_thickness_mm", 1.0)
    material = input_result.get("material", "GI")
    complexity = station_result.get("complexity_tier", "SIMPLE")
    stations = station_result.get("recommended_station_count", 0)
    shaft = shaft_result.get("suggested_shaft_diameter_mm", 50)

    duty = calc_duty_class(thickness, complexity, material)

    logger.info(
        "[duty_engine] duty=%s thickness=%.2f material=%s stations=%d shaft=%d",
        duty, thickness, material, stations, shaft,
    )

    return pass_response("duty_engine", {
        "machine_duty_class": duty,
        "duty_description": DUTY_DESCRIPTIONS[duty],
        "stand_strength_note": STAND_STRENGTH[duty],
        "summary": {
            "thickness_mm": thickness,
            "material": material,
            "stations": stations,
            "shaft_mm": shaft,
            "complexity": complexity,
        },
    })
