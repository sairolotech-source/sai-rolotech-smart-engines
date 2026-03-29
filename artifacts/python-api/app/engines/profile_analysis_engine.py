"""
profile_analysis_engine.py — Profile Analysis Engine
Real bend detection from line→arc→line transitions and angle changes between consecutive segments.
"""
import logging
import math
from typing import Any, Dict, List

from app.utils.response import pass_response, fail_response
from app.utils.engineering_rules import classify_complexity, COMPLEXITY_LABELS

logger = logging.getLogger("profile_analysis_engine")

MIN_BEND_ANGLE_DEG = 5.0


def _line_angle_deg(seg: Dict[str, Any]) -> float:
    dx = seg["end"][0] - seg["start"][0]
    dy = seg["end"][1] - seg["start"][1]
    return math.degrees(math.atan2(dy, dx))


def _angle_change(a1: float, a2: float) -> float:
    diff = (a2 - a1 + 180) % 360 - 180
    return abs(diff)


def detect_bends(geometry: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detect bends by:
    1. Every ARC entity counts as one bend.
    2. Angle change ≥ MIN_BEND_ANGLE_DEG between consecutive LINE segments counts as one bend.
    """
    bends: List[Dict[str, Any]] = []
    lines = [s for s in geometry if s["type"] == "line"]
    arcs = [s for s in geometry if s["type"] == "arc"]

    for arc in arcs:
        sweep = abs(arc.get("end_angle", 0) - arc.get("start_angle", 0)) % 360
        bends.append({"source": "arc", "angle_deg": round(sweep, 2), "radius_mm": arc.get("radius", 0)})

    for i in range(len(lines) - 1):
        a1 = _line_angle_deg(lines[i])
        a2 = _line_angle_deg(lines[i + 1])
        change = _angle_change(a1, a2)
        if change >= MIN_BEND_ANGLE_DEG:
            bends.append({"source": "line_transition", "angle_deg": round(change, 2), "radius_mm": 0.0})

    logger.debug("[profile_analysis_engine] bends detected: %d", len(bends))
    return bends


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

    bends = detect_bends(geometry)
    bend_count = len(bends)
    complexity = classify_complexity(bend_count)
    profile_type = COMPLEXITY_LABELS[complexity]

    logger.info(
        "[profile_analysis_engine] bends=%d complexity=%s w=%.1f h=%.1f",
        bend_count, complexity, width, height,
    )

    return pass_response("profile_analysis_engine", {
        "bend_count": bend_count,
        "bends": bends,
        "section_width_mm": round(width, 2),
        "section_height_mm": round(height, 2),
        "profile_type": profile_type,
        "complexity_tier": complexity,
        "profile_open": geometry_result.get("profile_open", True),
        "return_bends_count": sum(1 for b in bends if b["angle_deg"] > 90),
        "symmetry_status": "unknown",
    })
