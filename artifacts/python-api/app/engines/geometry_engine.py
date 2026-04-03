"""
geometry_engine.py — Geometry Engine
Cleans geometry, detects open/closed profile, computes bounding box.
"""
import logging
import math
from typing import Any, Dict, List

from app.utils.response import pass_response, fail_response

logger = logging.getLogger("geometry_engine")


def _seg_length(seg: Dict[str, Any]) -> float:
    if seg["type"] == "line":
        dx = seg["end"][0] - seg["start"][0]
        dy = seg["end"][1] - seg["start"][1]
        return math.hypot(dx, dy)
    if seg["type"] == "arc":
        r = seg.get("radius", 0.0)
        da = abs(seg.get("end_angle", 0) - seg.get("start_angle", 0)) % 360
        return r * math.radians(da)
    return 0.0


def clean_geometry(geometry: List[Dict[str, Any]]) -> Dict[str, Any]:
    logger.debug("[geometry_engine] clean_geometry called, entities=%d", len(geometry))

    if not geometry:
        logger.warning("[geometry_engine] Empty geometry")
        return fail_response("geometry_engine", "Empty geometry")

    # Filter very short degenerate segments (<0.01 mm)
    cleaned = [seg for seg in geometry if _seg_length(seg) >= 0.01]
    removed = len(geometry) - len(cleaned)
    warnings = []
    if removed:
        warnings.append(f"Removed {removed} degenerate segment(s) shorter than 0.01 mm")

    # Bounding box from line endpoints
    xs, ys = [], []
    for seg in cleaned:
        if seg["type"] == "line":
            xs += [seg["start"][0], seg["end"][0]]
            ys += [seg["start"][1], seg["end"][1]]
        elif seg["type"] == "arc":
            cx, cy, r = seg["center"][0], seg["center"][1], seg.get("radius", 0)
            xs += [cx - r, cx + r]
            ys += [cy - r, cy + r]

    if not xs:
        return fail_response("geometry_engine", "No valid coordinate data in geometry")

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    width = round(max_x - min_x, 4)
    height = round(max_y - min_y, 4)

    # Open/closed profile: check if last endpoint ≈ first endpoint
    lines = [s for s in cleaned if s["type"] == "line"]
    profile_open = True
    if len(lines) >= 2:
        first_start = lines[0]["start"]
        last_end = lines[-1]["end"]
        dist = math.hypot(last_end[0] - first_start[0], last_end[1] - first_start[1])
        profile_open = dist > 1.0

    total_length = round(sum(_seg_length(s) for s in cleaned), 4)

    logger.info(
        "[geometry_engine] bbox=%.1fx%.1f open=%s total_length=%.1f",
        width, height, profile_open, total_length,
    )

    return pass_response("geometry_engine", {
        "geometry": cleaned,
        "cleaned_entity_count": len(cleaned),
        "bounding_box": {"min_x": min_x, "min_y": min_y, "max_x": max_x, "max_y": max_y, "width": width, "height": height},
        "profile_open": profile_open,
        "total_length_mm": total_length,
        "warnings": warnings,
    })
