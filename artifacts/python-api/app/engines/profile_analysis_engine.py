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


def classify_profile(
    bend_count: int,
    width: float,
    height: float,
    has_lips: bool = False,
    return_bends: int = 0,
    lip_mm: float = 0.0,
) -> str:
    """
    Classify profile type from geometry and bend structure.

    Hierarchy (in order of precedence):
      shutter_profile  — 6+ bends AND relatively shallow (height/width ≤ 0.35)
      lipped_channel   — 4-5 bends OR 4 bends with lips present
      hat_section      — 4 bends, very wide+shallow (height/width ≤ 0.20)
      z_section        — 2 bends, return_bends > 0 OR width/height aspect suggests Z
      c_channel        — 2-4 bends, standard
      simple_channel   — ≤ 2 bends, shallow
    """
    aspect = height / max(width, 1.0)

    if bend_count >= 6:
        if aspect <= 0.35:
            return "shutter_profile"
        return "lipped_channel"

    if bend_count == 5:
        return "lipped_channel"

    if bend_count == 4:
        if has_lips or lip_mm > 0 or return_bends > 0:
            return "lipped_channel"
        if aspect <= 0.20:
            return "hat_section"
        return "lipped_channel"

    if bend_count == 3:
        return "lipped_channel"

    if bend_count == 2:
        if return_bends > 0:
            return "z_section"
        if height >= 5.0:
            return "c_channel"
        return "simple_channel"

    return "simple_channel"


def estimate_return_bends(bend_details: List[Dict[str, Any]]) -> int:
    return sum(1 for b in bend_details if b.get("bend_type") == "return_or_sharp")
