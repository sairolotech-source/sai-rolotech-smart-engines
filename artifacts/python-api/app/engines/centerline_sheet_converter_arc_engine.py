"""
centerline_sheet_converter_arc_engine.py — Arc-Aware Centerline Sheet Converter Engine

Converts a centerline geometry (LINE + ARC + LWPOLYLINE/POLYLINE entities)
into a full sheet profile by offsetting equally on both sides by thickness/2.

Key capabilities over a simple line-only converter:
  • ARC entities are approximated into segmented point chains (default 24 segs)
  • All chains are stitched end-to-end into continuous polylines
  • Offset is computed per segment with corner intersection resolution
  • Self-intersection detection after offset (marks blocking if found)
  • Outer profile, inner profile, and closed sheet profile generated

Output fields:
  thickness, offset_each_side, mode, arc_segments,
  converted_profiles (list of chain data), confidence, blocking, warnings

Automation rule:
  • Run AFTER geometry cleaning, BEFORE profile analysis
  • If is_centerline_profile is True (detected from entity types), run this engine
  • If blocking=True → force semi-auto confirmation / manual review
  • Pass converted sheet points as working geometry for profile_analysis_engine

Blueprint source: Arc-Aware Centerline Converter blueprint (ChatGPT session).
"""
import math
from typing import Any, Dict, List, Optional, Tuple

from app.utils.response import pass_response, fail_response

Point = Tuple[float, float]


# ── Centerline detection ───────────────────────────────────────────────────────

def is_centerline_geometry(entities: List[Dict[str, Any]]) -> bool:
    """
    Heuristically detect whether a geometry list represents a centerline drawing
    vs. a full sheet-outline drawing.

    Centerline drawing characteristics:
      • Primarily LINE and ARC entities (no HATCH, no SOLID)
      • Open polylines (not closed)
      • No large closed-boundary loops representing sheet thickness
    """
    if not entities:
        return False

    type_counts: Dict[str, int] = {}
    for e in entities:
        t = str(e.get("type", "")).upper()
        type_counts[t] = type_counts.get(t, 0) + 1

    total = len(entities)
    line_arcs = type_counts.get("LINE", 0) + type_counts.get("ARC", 0)
    has_hatch = type_counts.get("HATCH", 0) > 0
    has_solid = type_counts.get("SOLID", 0) > 0

    if has_hatch or has_solid:
        return False

    # If >50% of entities are LINEs or ARCs with no filled geometry → likely centerline
    return (line_arcs / total) >= 0.5


# ── Arc sampling ───────────────────────────────────────────────────────────────

def sample_arc_points(arc: Dict[str, Any], segments: int = 24) -> List[Point]:
    center = arc.get("center", [0, 0])
    radius = float(arc.get("radius", 0))
    start_angle = float(arc.get("start_angle", 0))
    end_angle = float(arc.get("end_angle", 0))

    if radius <= 0:
        return []

    sweep = end_angle - start_angle
    while sweep < 0:
        sweep += 360.0
    if sweep == 0:
        sweep = 360.0

    pts: List[Point] = []
    for i in range(segments + 1):
        a = math.radians(start_angle + sweep * (i / segments))
        x = center[0] + radius * math.cos(a)
        y = center[1] + radius * math.sin(a)
        pts.append((round(x, 6), round(y, 6)))
    return pts


# ── Chain extraction ───────────────────────────────────────────────────────────

def _to_point(p: Any) -> Point:
    if isinstance(p, dict):
        return (float(p.get("x", p.get(0, 0))), float(p.get("y", p.get(1, 0))))
    return (float(p[0]), float(p[1]))


def extract_arc_aware_chains(
    geometry: List[Dict[str, Any]],
    arc_segments: int = 24,
) -> List[List[Point]]:
    """Extract and classify all geometry into raw point chains."""
    raw: List[List[Point]] = []

    for item in geometry:
        typ = str(item.get("type", "")).lower()

        if typ == "line":
            s = item.get("start", [0, 0])
            e = item.get("end", [0, 0])
            raw.append([_to_point(s), _to_point(e)])

        elif typ in {"lwpolyline", "polyline"}:
            pts = [_to_point(p) for p in item.get("points", [])]
            if len(pts) >= 2:
                raw.append(pts)

        elif typ == "arc":
            pts = sample_arc_points(item, arc_segments)
            if len(pts) >= 2:
                raw.append(pts)

    return stitch_chains(raw)


# ── Chain stitching ────────────────────────────────────────────────────────────

def _points_close(a: Point, b: Point, tol: float = 1e-5) -> bool:
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


def _dedupe_adjacent(points: List[Point], tol: float = 1e-6) -> List[Point]:
    if not points:
        return []
    out = [points[0]]
    for p in points[1:]:
        if not _points_close(out[-1], p, tol):
            out.append(p)
    return out


def stitch_chains(
    chains: List[List[Point]],
    tol: float = 1e-5,
) -> List[List[Point]]:
    """Stitch adjacent chains into continuous polylines by matching endpoints."""
    if not chains:
        return []

    remaining = [list(c) for c in chains]
    output: List[List[Point]] = []

    while remaining:
        current = remaining.pop(0)
        changed = True

        while changed:
            changed = False
            i = 0
            while i < len(remaining):
                other = remaining[i]

                if _points_close(current[-1], other[0], tol):
                    current.extend(other[1:])
                    remaining.pop(i)
                    changed = True
                    continue

                if _points_close(current[-1], other[-1], tol):
                    current.extend(list(reversed(other[:-1])))
                    remaining.pop(i)
                    changed = True
                    continue

                if _points_close(current[0], other[-1], tol):
                    current = other[:-1] + current
                    remaining.pop(i)
                    changed = True
                    continue

                if _points_close(current[0], other[0], tol):
                    current = list(reversed(other[1:])) + current
                    remaining.pop(i)
                    changed = True
                    continue

                i += 1

        output.append(_dedupe_adjacent(current))

    return output


# ── Offset computation ─────────────────────────────────────────────────────────

def _offset_segment(p1: Point, p2: Point, d: float) -> Tuple[Point, Point]:
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = math.hypot(dx, dy)
    if length == 0:
        return p1, p2
    nx = -dy / length
    ny = dx / length
    return (
        (round(p1[0] + nx * d, 6), round(p1[1] + ny * d, 6)),
        (round(p2[0] + nx * d, 6), round(p2[1] + ny * d, 6)),
    )


def _line_intersection(
    a1: Point, a2: Point,
    b1: Point, b2: Point,
) -> Optional[Point]:
    x1, y1 = a1
    x2, y2 = a2
    x3, y3 = b1
    x4, y4 = b2
    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-9:
        return None
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom
    return (round(px, 6), round(py, 6))


def offset_polyline(points: List[Point], offset_dist: float) -> List[Point]:
    """Offset a polyline by offset_dist using per-segment normal vectors."""
    if len(points) < 2:
        return list(points)

    segs = [_offset_segment(points[i], points[i + 1], offset_dist)
            for i in range(len(points) - 1)]

    result: List[Point] = [segs[0][0]]
    for i in range(len(segs) - 1):
        a1, a2 = segs[i]
        b1, b2 = segs[i + 1]
        inter = _line_intersection(a1, a2, b1, b2)
        result.append(inter if inter is not None else a2)
    result.append(segs[-1][1])
    return _dedupe_adjacent(result)


# ── Self-intersection detection ────────────────────────────────────────────────

def _ccw(a: Point, b: Point, c: Point) -> bool:
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])


def _segments_intersect(p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
    return (
        _ccw(p1, p3, p4) != _ccw(p2, p3, p4) and
        _ccw(p1, p2, p3) != _ccw(p1, p2, p4)
    )


def has_self_intersection(points: List[Point]) -> bool:
    if len(points) < 4:
        return False
    for i in range(len(points) - 1):
        a1, a2 = points[i], points[i + 1]
        for j in range(i + 2, len(points) - 1):
            if i == 0 and j == len(points) - 2:
                continue
            b1, b2 = points[j], points[j + 1]
            if _segments_intersect(a1, a2, b1, b2):
                return True
    return False


# ── Sheet profile builder ──────────────────────────────────────────────────────

def _build_sheet_profile(left: List[Point], right: List[Point]) -> List[Point]:
    """Build a closed sheet polygon: left side → reversed right side → back to start."""
    if not left or not right:
        return []
    return left + list(reversed(right)) + [left[0]]


# ── Main entry point ───────────────────────────────────────────────────────────

def convert_centerline_to_sheet_arc_aware(
    geometry: List[Dict[str, Any]],
    thickness: float,
    mode: str = "both",
    arc_segments: int = 24,
) -> Dict[str, Any]:
    """
    Convert arc-aware centerline geometry into full sheet profiles.

    Parameters
    ----------
    geometry   : list of entity dicts from geometry_engine (type, start, end, points, center…)
    thickness  : sheet metal thickness in mm
    mode       : "both" | "outer" | "inner"
    arc_segments: number of segments used to approximate each ARC entity

    Returns
    -------
    pass_response with:
      converted_profiles — list of {chain_no, centerline, outer_profile, inner_profile, sheet_profile}
      confidence, blocking, warnings, assumptions
    """
    if not geometry:
        return fail_response(
            "centerline_sheet_converter_arc_engine", "Geometry missing"
        )
    if thickness <= 0:
        return fail_response(
            "centerline_sheet_converter_arc_engine", "Invalid thickness"
        )

    chains = extract_arc_aware_chains(geometry, arc_segments=arc_segments)
    if not chains:
        return fail_response(
            "centerline_sheet_converter_arc_engine",
            "No valid chains extracted from geometry",
        )

    half_t = thickness / 2.0
    converted: List[Dict[str, Any]] = []
    warnings: List[str] = []
    confidence = "high"

    for idx, chain in enumerate(chains, start=1):
        if len(chain) < 2:
            continue

        outer = offset_polyline(chain, +half_t)
        inner = offset_polyline(chain, -half_t)

        if has_self_intersection(outer) or has_self_intersection(inner):
            warnings.append(f"Chain {idx}: offset self-intersection detected")
            confidence = "low"

        sheet = _build_sheet_profile(outer, inner)

        converted.append({
            "chain_no":      idx,
            "point_count":   len(chain),
            "centerline":    [{"x": p[0], "y": p[1]} for p in chain],
            "outer_profile": [{"x": p[0], "y": p[1]} for p in outer]  if mode in {"both", "outer"} else [],
            "inner_profile": [{"x": p[0], "y": p[1]} for p in inner]  if mode in {"both", "inner"} else [],
            "sheet_profile": [{"x": p[0], "y": p[1]} for p in sheet]  if mode == "both" else [],
        })

    if not converted:
        return fail_response(
            "centerline_sheet_converter_arc_engine",
            "No converted profiles generated",
        )

    if warnings and confidence == "high":
        confidence = "medium"

    blocking = confidence == "low"

    return pass_response("centerline_sheet_converter_arc_engine", {
        "thickness":          thickness,
        "offset_each_side":   half_t,
        "mode":               mode,
        "arc_segments":       arc_segments,
        "chain_count":        len(converted),
        "converted_profiles": converted,
        "confidence":         confidence,
        "blocking":           blocking,
        "warnings": warnings + [
            "Arc conversion uses segmented approximation",
            "Tight radii and complex returns should be manually reviewed",
        ],
        "assumptions": [
            "Centerline treated as neutral reference axis",
            "Sheet thickness distributed equally on both sides (thickness/2)",
            "Arcs approximated into small line segments for offset computation",
        ],
    })
