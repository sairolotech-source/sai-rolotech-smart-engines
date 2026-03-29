"""
profile_analysis_engine.py — Profile Analysis Engine
Uses bend_detection_engine for real angle-based bend detection.
No longer estimates bend count from entity count.
"""
import logging
from typing import Dict, Any, List

from app.utils.response import pass_response, fail_response
from app.engines.bend_detection_engine import detect_bends
from app.utils.engineering_rules import classify_complexity, COMPLEXITY_LABELS

logger = logging.getLogger("profile_analysis_engine")


def analyze_profile(geometry_result: Dict[str, Any]) -> Dict[str, Any]:
    logger.debug("[profile_analysis_engine] analyze_profile called")

    geometry = geometry_result.get("geometry", [])
    if not geometry:
        return fail_response("profile_analysis_engine", "Geometry missing or empty")

    bbox = geometry_result.get("bounding_box", {})
    width = bbox.get("width", 0.0)
    height = bbox.get("height", 0.0)

    if width < 1.0 or height < 1.0:
        return fail_response(
            "profile_analysis_engine",
            f"Dimensions too small: W={width:.2f}mm H={height:.2f}mm — check DXF units"
        )

    bend_result = detect_bends(geometry)
    if bend_result["status"] == "fail":
        return fail_response("profile_analysis_engine", bend_result.get("reason", "Bend detection failed"))

    bend_count = bend_result["bend_count"]
    bend_details = bend_result["bend_details"]

    complexity = classify_complexity(bend_count)
    profile_type = classify_profile(bend_count, width, height)
    return_bends = estimate_return_bends(bend_details)

    logger.info(
        "[profile_analysis_engine] bends=%d complexity=%s return_bends=%d w=%.1f h=%.1f chains=%d",
        bend_count, complexity, return_bends, width, height, bend_result.get("chain_count", 0),
    )

    return pass_response("profile_analysis_engine", {
        "bend_count": bend_count,
        "arc_bend_count": bend_result.get("arc_bend_count", 0),
        "line_bend_count": bend_result.get("line_bend_count", 0),
        "section_width_mm": round(width, 2),
        "section_height_mm": round(height, 2),
        "profile_type": profile_type,
        "complexity_tier": complexity,
        "complexity_label": COMPLEXITY_LABELS[complexity],
        "profile_open": geometry_result.get("profile_open", True),
        "return_bends_count": return_bends,
        "symmetry_status": "unknown",
        "bend_details": bend_details,
        "chain_count": bend_result.get("chain_count", 0),
    })


def classify_profile(bend_count: int, width: float, height: float) -> str:
    if bend_count <= 2:
        return "simple_channel"
    if bend_count <= 6:
        return "lipped_channel"
    if bend_count <= 10:
        return "shutter_profile"
    return "complex_profile"


def estimate_return_bends(bend_details: List[Dict[str, Any]]) -> int:
    return sum(1 for b in bend_details if b.get("bend_type") == "return_or_sharp")
