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
from app.engines.roll_contour_engine import PROFILE_CATEGORY

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
        "profile_category": PROFILE_CATEGORY.get(profile_type, "unknown"),
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

    Returned types (in order of evaluation precedence):
      shutter_slat     — 6+ bends AND shallow (height/width ≤ 0.35), no explicit lips
      door_frame       — 4 bends AND return_bends > 0 (return-lip U-channel)
      lipped_channel   — 4-6+ bends with explicit lips or standard lipped geometry
      hat_section      — 4 bends, very wide+shallow (aspect ≤ 0.20), no lips
      z_section        — 2 bends with return-bend direction change
      u_channel        — 2 bends, wide-web (aspect ≤ 0.50, width ≥ 60mm)
      c_channel        — 2 bends, standard channel (height ≥ 5mm)
      simple_angle     — 1 bend only
      simple_channel   — ≤ 2 bends, shallow (height < 5mm)

    Profile category families:
      panel:      shutter_slat
      structural: door_frame, lipped_channel, hat_section, z_section
      channel:    c_channel, u_channel, simple_channel
      flat_open:  simple_angle
    """
    aspect = height / max(width, 1.0)

    # ── 6+ bends ──────────────────────────────────────────────────────────────
    if bend_count >= 6:
        if has_lips or lip_mm > 0:
            return "lipped_channel"
        if aspect <= 0.20:
            return "shutter_slat"
        if aspect <= 0.35 and height < 15.0:
            return "shutter_slat"
        return "lipped_channel"

    # ── 5 bends ───────────────────────────────────────────────────────────────
    if bend_count == 5:
        return "lipped_channel"

    # ── 4 bends ───────────────────────────────────────────────────────────────
    if bend_count == 4:
        # Return bends + 4 bends → door frame (U-channel with inward return lips)
        if return_bends > 0 and not has_lips and lip_mm <= 0:
            return "door_frame"
        if has_lips or lip_mm > 0:
            return "lipped_channel"
        if aspect <= 0.20:
            return "hat_section"
        return "lipped_channel"

    # ── 3 bends ───────────────────────────────────────────────────────────────
    if bend_count == 3:
        return "lipped_channel"

    # ── 1 bend ────────────────────────────────────────────────────────────────
    if bend_count == 1:
        return "simple_angle"

    # ── 2 bends ───────────────────────────────────────────────────────────────
    if bend_count == 2:
        if return_bends > 0:
            return "z_section"
        if height < 5.0:
            return "simple_channel"
        # Distinguish u_channel (wide web, shallow) from c_channel (standard)
        if aspect <= 0.50 and width >= 60.0:
            return "u_channel"
        return "c_channel"

    return "simple_channel"


def estimate_return_bends(bend_details: List[Dict[str, Any]]) -> int:
    return sum(1 for b in bend_details if b.get("bend_type") == "return_or_sharp")
