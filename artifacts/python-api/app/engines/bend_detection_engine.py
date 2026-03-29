from __future__ import annotations

from math import acos, degrees, sqrt
from typing import Any, Dict, List, Tuple

from app.utils.response import pass_response, fail_response


Point = Tuple[float, float]


def detect_bends(geometry: List[Dict[str, Any]], angle_tolerance_deg: float = 8.0) -> Dict[str, Any]:
    """
    Detect bends from imported geometry.

    Logic:
    - Convert geometry into ordered point-chains where possible
    - For each 3 consecutive points, calculate angle change
    - Ignore nearly-straight transitions within tolerance
    - Arc entities count as 1 bend by default
    """

    if not geometry:
        return fail_response("bend_detection_engine", "Geometry missing")

    chains = extract_point_chains(geometry)
    bend_details: List[Dict[str, Any]] = []
    total_bends = 0
    arc_bends = 0

    for chain_index, chain in enumerate(chains):
        if len(chain) < 3:
            continue

        chain_bends = analyze_chain_bends(chain, angle_tolerance_deg)
        for item in chain_bends:
            item["chain_index"] = chain_index
        bend_details.extend(chain_bends)
        total_bends += len(chain_bends)

    for entity in geometry:
        if entity.get("type") == "arc":
            arc_bends += 1
            total_bends += 1
            bend_details.append({
                "chain_index": None,
                "point_index": None,
                "bend_angle_deg": estimate_arc_sweep(entity),
                "bend_type": "arc",
                "notes": "Arc treated as one bend"
            })

    return pass_response("bend_detection_engine", {
        "bend_count": total_bends,
        "arc_bend_count": arc_bends,
        "line_bend_count": total_bends - arc_bends,
        "bend_details": bend_details,
        "chain_count": len(chains)
    })


def extract_point_chains(geometry: List[Dict[str, Any]]) -> List[List[Point]]:
    """
    Extract point chains from lines and polyline-like entities.

    Current behavior:
    - LINE -> 2-point chain
    - LWPOLYLINE/POLYLINE -> direct point chain
    - Multiple lines are greedily stitched if endpoints match
    """

    raw_chains: List[List[Point]] = []

    for entity in geometry:
        etype = entity.get("type")

        if etype == "line":
            start = to_point(entity["start"])
            end = to_point(entity["end"])
            raw_chains.append([start, end])

        elif etype in {"lwpolyline", "polyline"}:
            pts = [to_point(p) for p in entity.get("points", [])]
            if len(pts) >= 2:
                raw_chains.append(pts)

    stitched = stitch_chains(raw_chains)
    return [dedupe_adjacent_points(chain) for chain in stitched if len(chain) >= 2]


def stitch_chains(chains: List[List[Point]], tol: float = 1e-6) -> List[List[Point]]:
    """
    Greedy endpoint-based chain stitching.
    Useful when DXF imports separate profile edges as individual lines.
    """

    if not chains:
        return []

    remaining = [list(c) for c in chains]
    result: List[List[Point]] = []

    while remaining:
        current = remaining.pop(0)
        changed = True

        while changed:
            changed = False
            i = 0
            while i < len(remaining):
                other = remaining[i]

                if points_close(current[-1], other[0], tol):
                    current.extend(other[1:])
                    remaining.pop(i)
                    changed = True
                    continue

                if points_close(current[-1], other[-1], tol):
                    current.extend(list(reversed(other[:-1])))
                    remaining.pop(i)
                    changed = True
                    continue

                if points_close(current[0], other[-1], tol):
                    current = other[:-1] + current
                    remaining.pop(i)
                    changed = True
                    continue

                if points_close(current[0], other[0], tol):
                    current = list(reversed(other[1:])) + current
                    remaining.pop(i)
                    changed = True
                    continue

                i += 1

        result.append(current)

    return result


def analyze_chain_bends(chain: List[Point], angle_tolerance_deg: float) -> List[Dict[str, Any]]:
    bends: List[Dict[str, Any]] = []

    for i in range(1, len(chain) - 1):
        p1 = chain[i - 1]
        p2 = chain[i]
        p3 = chain[i + 1]

        angle_change = calculate_turn_angle(p1, p2, p3)
        if angle_change is None:
            continue

        if angle_change >= angle_tolerance_deg:
            bends.append({
                "point_index": i,
                "bend_angle_deg": round(angle_change, 3),
                "bend_type": classify_bend(angle_change),
                "at_point": [p2[0], p2[1]]
            })

    return bends


def calculate_turn_angle(p1: Point, p2: Point, p3: Point) -> float | None:
    """
    Returns angle change between segments p1->p2 and p2->p3.
    Straight continuation ~ 0°
    Right-angle bend ~ 90°
    Reverse turn ~ 180°
    """

    v1 = (p1[0] - p2[0], p1[1] - p2[1])
    v2 = (p3[0] - p2[0], p3[1] - p2[1])

    mag1 = magnitude(v1)
    mag2 = magnitude(v2)

    if mag1 == 0 or mag2 == 0:
        return None

    dot = v1[0] * v2[0] + v1[1] * v2[1]
    cos_theta = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    inside_angle = degrees(acos(cos_theta))

    # For bend detection we care about direction change from straight path
    angle_change = 180.0 - inside_angle
    return max(0.0, angle_change)


def classify_bend(angle_deg: float) -> str:
    if angle_deg < 20:
        return "minor"
    if angle_deg < 75:
        return "moderate"
    if angle_deg < 120:
        return "major"
    return "return_or_sharp"


def estimate_arc_sweep(entity: Dict[str, Any]) -> float:
    start = float(entity.get("start_angle", 0.0))
    end = float(entity.get("end_angle", 0.0))
    sweep = end - start
    while sweep < 0:
        sweep += 360.0
    while sweep > 360:
        sweep -= 360.0
    return round(sweep, 3)


def dedupe_adjacent_points(chain: List[Point], tol: float = 1e-6) -> List[Point]:
    if not chain:
        return []

    out = [chain[0]]
    for p in chain[1:]:
        if not points_close(p, out[-1], tol):
            out.append(p)
    return out


def to_point(p: Any) -> Point:
    return (float(p[0]), float(p[1]))


def points_close(a: Point, b: Point, tol: float = 1e-6) -> bool:
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


def magnitude(v: Tuple[float, float]) -> float:
    return sqrt(v[0] ** 2 + v[1] ** 2)
