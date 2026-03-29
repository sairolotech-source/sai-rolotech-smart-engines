"""
station_engine.py — Station Estimation Engine
Uses Rule Book §4 formula:
  stations = bend_count + complexity_correction + thickness_correction + material_correction
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response
from app.utils.engineering_rules import estimate_stations_rule_book

logger = logging.getLogger("station_engine")


def estimate(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
) -> Dict[str, Any]:
    bend_count = profile_result.get("bend_count", 0)
    thickness = input_result.get("sheet_thickness_mm", 1.0)
    material = input_result.get("material", "GI")

    logger.debug(
        "[station_engine] bends=%d thickness=%.2f material=%s",
        bend_count, thickness, material,
    )

    est = estimate_stations_rule_book(bend_count, material, thickness)

    logger.info(
        "[station_engine] recommended=%d range=%d–%d formula: %s",
        est["recommended"], est["minimum"], est["maximum"], est["formula"],
    )

    return pass_response("station_engine", {
        "recommended_station_count": est["recommended"],
        "min_station_count": est["minimum"],
        "max_station_count": est["maximum"],
        "complexity_tier": est["complexity"],
        "complexity_label": est["complexity_label"],
        "formula": est["formula"],
        "reason_log": est["corrections"],
        "confidence_level": "high",
    })
