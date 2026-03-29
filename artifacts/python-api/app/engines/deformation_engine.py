"""
deformation_engine.py — Strip Profile Deformation Engine

Progressive kinematic deformation from flat to fully formed.
Two strategies:
  1. simple_scale   — Y-axis scaling (fast, for basic visualisation)
  2. kinematic_fold — constant segment lengths, angle interpolation (accurate)
"""
import math
from typing import List, Tuple, Dict, Any

from app.utils.response import pass_response, fail_response

Point = Tuple[float, float]


# ─── STRATEGY 1: Simple Scale ────────────────────────────────────────────────

def deform_profile_simple(profile: List[Point], pass_ratio: float) -> List[Point]:
    """
    Fast Y-axis progressive deformation.
    pass_ratio: 0.0 (flat) → 1.0 (fully formed)
    """
    r = max(0.0, min(1.0, pass_ratio))
    return [(round(x, 4), round(y * r, 4)) for x, y in profile]


# ─── STRATEGY 2: Kinematic Fold ──────────────────────────────────────────────

def _segment_data(pts: List[Point]) -> tuple:
    """
    Return (segment_lengths, bend_angles) for a polyline.
    bend_angles[i] = direction change (CCW °) at interior point i+1.
    """
    n = len(pts)
    lengths, directions = [], []
    for i in range(1, n):
        dx = pts[i][0] - pts[i - 1][0]
        dy = pts[i][1] - pts[i - 1][1]
        lengths.append(math.hypot(dx, dy))
        directions.append(math.degrees(math.atan2(dy, dx)))

    bends = []
    for i in range(1, len(directions)):
        b = directions[i] - directions[i - 1]
        while b >  180: b -= 360
        while b < -180: b += 360
        bends.append(round(b, 4))

    return lengths, bends


def deform_profile_kinematic(profile: List[Point], pass_ratio: float) -> List[Point]:
    """
    Kinematic chain deformation.
    Segment lengths are constant; bend angles scale with pass_ratio.
    """
    r   = max(0.0, min(1.0, pass_ratio))
    pts = profile
    if len(pts) < 2:
        return pts

    lengths, bends = _segment_data(pts)

    x, y, theta = 0.0, 0.0, 0.0
    out = [(x, y)]
    for i, length in enumerate(lengths):
        if i > 0:
            theta += bends[i - 1] * r
        x += length * math.cos(math.radians(theta))
        y += length * math.sin(math.radians(theta))
        out.append((round(x, 4), round(y, 4)))

    # Centre on X axis
    all_x = [p[0] for p in out]
    cx = (max(all_x) + min(all_x)) / 2
    max_y = max(p[1] for p in out)
    return [(round(p[0] - cx, 4), round(max_y - p[1], 4)) for p in out]


# ─── ENGINE ENTRY POINT ───────────────────────────────────────────────────────

def deform_profile(
    profile: List[Point],
    pass_ratio: float,
    strategy: str = "kinematic",
) -> Dict[str, Any]:
    """
    Deform a strip profile at a given pass ratio.

    Args:
        profile:    list of (x, y) tuples — final formed profile
        pass_ratio: 0.0=flat, 1.0=formed
        strategy:   "kinematic" (default) | "simple"

    Returns:
        pass_response with deformed_profile, strategy, pass_ratio
    """
    if not profile or len(profile) < 2:
        return fail_response("deformation_engine", "Profile must have at least 2 points")
    if not 0.0 <= pass_ratio <= 1.0:
        return fail_response("deformation_engine", f"pass_ratio must be 0–1, got {pass_ratio}")

    if strategy == "kinematic":
        result = deform_profile_kinematic(profile, pass_ratio)
    else:
        result = deform_profile_simple(profile, pass_ratio)

    return pass_response("deformation_engine", {
        "deformed_profile": [{"x": p[0], "y": p[1]} for p in result],
        "point_count":      len(result),
        "pass_ratio":       round(pass_ratio, 4),
        "strategy":         strategy,
    })
