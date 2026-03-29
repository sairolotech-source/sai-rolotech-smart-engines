"""
station_engine.py — Station Estimation Engine
Uses bend_count, complexity, section_type, and return_bends for a more accurate estimate.
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response

logger = logging.getLogger("station_engine")


def estimate(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
) -> Dict[str, Any]:
    bend_count = int(profile_result.get("bend_count", 0))
    thickness = float(input_result.get("sheet_thickness_mm", 1.0))
    material = input_result.get("material", "GI")
    complexity = flower_result.get("forming_complexity_class", "simple")
    section_type = flower_result.get("section_type", profile_result.get("profile_type", "custom"))
    return_bends = int(profile_result.get("return_bends_count", 0))

    base = bend_count

    complexity_factor = {
        "simple": 0,
        "medium": 2,
        "complex": 4,
        "very_complex": 6,
    }.get(complexity, 0)

    thickness_factor = 0
    if 0.8 <= thickness < 1.2:
        thickness_factor = 1
    elif 1.2 <= thickness < 2.0:
        thickness_factor = 2
    elif thickness >= 2.0:
        thickness_factor = 3

    material_factor = 0
    if material in {"MS", "CR"}:
        material_factor = 1
    elif material in {"SS", "HR"}:
        material_factor = 2

    section_factor = 0
    if section_type == "lipped_channel":
        section_factor = 1
    elif section_type in {"complex_section", "complex_profile"}:
        section_factor = 3
    elif section_type == "shutter_profile":
        section_factor = 4

    return_bend_factor = min(return_bends, 3)

    recommended = (
        base
        + complexity_factor
        + thickness_factor
        + material_factor
        + section_factor
        + return_bend_factor
    )
    recommended = max(recommended, 4)
    minimum = max(recommended - 2, bend_count)

    logger.info(
        "[station_engine] bends=%d complexity=%s section=%s recommended=%d",
        bend_count, complexity, section_type, recommended,
    )

    return pass_response("station_engine", {
        "recommended_station_count": recommended,
        "min_station_count": minimum,
        "complexity_tier": complexity,
        "section_type": section_type,
        "reason_log": {
            "base": base,
            "complexity_factor": complexity_factor,
            "thickness_factor": thickness_factor,
            "material_factor": material_factor,
            "section_factor": section_factor,
            "return_bend_factor": return_bend_factor,
        },
        "confidence_level": "medium",
    })
