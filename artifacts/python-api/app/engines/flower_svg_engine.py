"""
flower_svg_engine.py — Real Flower Pattern SVG Generator

Uses shapely to compute 2D cross-section polygons per forming station,
then exports a composite flower pattern SVG (all stations overlaid).

Supported profiles (8 production types):
  c_channel, u_channel, simple_channel, simple_angle,
  z_section, lipped_channel, hat_section,
  shutter_slat (+ shutter_profile alias), door_frame.
"""
import io
import math
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("flower_svg_engine")

# ── HTML entity escaping for SVG text content ─────────────────────────────────
def _esc(s: str) -> str:
    """Escape user-supplied strings before embedding in SVG text elements."""
    return (str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#x27;"))

try:
    from shapely.geometry import LineString, Polygon, MultiPolygon
    from shapely.ops import unary_union
    SHAPELY_OK = True
except ImportError:
    SHAPELY_OK = False
    logger.warning("[flower_svg_engine] shapely not available — SVG generation disabled")


# ── Colour palette (flat=grey, early=blue-violet, mid=violet, final=blue, calib=green)
def _station_colour(idx: int, total: int, is_calib: bool) -> Tuple[str, float]:
    if is_calib:
        return "#22c55e", 0.85
    t = idx / max(total - 1, 1)
    if t < 0.15:
        return "#6b7280", 0.55      # flat / near-flat — grey
    if t < 0.45:
        return "#7c3aed", 0.70      # early forming — violet
    if t < 0.80:
        return "#6366f1", 0.80      # mid forming — indigo
    return "#3b82f6", 0.90          # final form — blue


# ── Profile cross-section centerline at angle theta (degrees) ─────────────────
# These functions are exported for use by roll_groove_svg_engine.

def section_centerline(
    profile_type: str,
    web_mm: float,
    flange_mm: float,
    theta_deg: float,
    lip_mm: float = 0.0,
    lip_mm_left: float = 0.0,
    lip_mm_right: float = 0.0,
    n_ribs: int = 4,
) -> List[Tuple[float, float]]:
    """
    Return a polyline (centerline) representing the section cross-section
    at forming angle theta_deg (0=flat, 90=fully formed).
    Coordinates are in mm; web is centred on x=0, y=0.

    Supports all 8 production profile types:
      c_channel, u_channel, simple_channel — symmetric C-shape
      simple_angle           — single bend (right side only)
      z_section              — asymmetric Z (left flange down, right flange up)
      lipped_channel         — C with inward lips; supports asymmetric lips via
                               lip_mm_left / lip_mm_right (falls back to lip_mm)
      hat_section            — same geometry as lipped_channel (symmetric lips)
      shutter_slat           — multi-rib trapezoidal wave
      door_frame             — U with explicit inward return lips
    """
    th = math.radians(min(max(theta_deg, 0), 90))
    hw = web_mm / 2.0

    # Unit vectors for left/right flange at angle theta from web
    # Web goes right (+x).  Left flange bends UP-LEFT: (-cos, +sin) from left end.
    # Right flange bends UP-RIGHT: (+cos, +sin) from right end.
    lx = -math.cos(th)
    ly =  math.sin(th)
    rx =  math.cos(th)
    ry =  math.sin(th)

    pt_web_l = (-hw, 0.0)
    pt_web_r = ( hw, 0.0)
    pt_fl_l  = (-hw + lx * flange_mm,  ly * flange_mm)
    pt_fl_r  = ( hw + rx * flange_mm,  ry * flange_mm)

    if profile_type == "simple_angle":
        # 1 bend: web + single right flange
        return [pt_web_l, pt_web_r, pt_fl_r]

    elif profile_type == "z_section":
        # Asymmetric Z: left flange goes DOWN, right flange goes UP
        pt_fl_l_z = (-hw - math.cos(th) * flange_mm, -math.sin(th) * flange_mm)
        return [pt_fl_l_z, pt_web_l, pt_web_r, pt_fl_r]

    elif profile_type == "u_channel":
        # Wide-web U: same geometry as c_channel — web + symmetric flanges
        # Explicit branch so profile is unambiguously supported
        return [pt_fl_l, pt_web_l, pt_web_r, pt_fl_r]

    elif profile_type in ("lipped_channel", "complex_section", "hat_section"):
        # Resolve per-side lip lengths (asymmetric lip support)
        _lip_l = lip_mm_left  if lip_mm_left  > 0 else lip_mm
        _lip_r = lip_mm_right if lip_mm_right > 0 else lip_mm

        if _lip_l > 0 or _lip_r > 0:
            # Lips at 90° to flanges, turning inward.
            # Left lip: angle = th + 90° (inward = toward +x axis)
            # Right lip: angle = -(th + 90°) (inward = toward -x axis)
            lip_angle_l = th + math.pi / 2
            lip_angle_r = math.pi - th - math.pi / 2

            pts: List[Tuple[float, float]] = []
            if _lip_l > 0:
                lp_lx = math.cos(lip_angle_l) * _lip_l
                lp_ly = math.sin(lip_angle_l) * _lip_l
                pts.append((pt_fl_l[0] + lp_lx, pt_fl_l[1] + lp_ly))
            pts.extend([pt_fl_l, pt_web_l, pt_web_r, pt_fl_r])
            if _lip_r > 0:
                lp_rx = -math.cos(lip_angle_r) * _lip_r
                lp_ry =  math.sin(lip_angle_r) * _lip_r
                pts.append((pt_fl_r[0] + lp_rx, pt_fl_r[1] + lp_ry))
            return pts
        else:
            # No lips — render as plain C-channel
            return [pt_fl_l, pt_web_l, pt_web_r, pt_fl_r]

    elif profile_type in ("shutter_profile", "shutter_slat"):
        # Shutter slat: symmetric multi-rib trapezoidal wave at forming angle theta.
        #
        # The profile is a closed repeating pattern:
        #   base → up-arm (at angle theta from vertical) → flat top → down-arm → base
        #
        # Parameters derived from section dimensions:
        #   web_mm   = total slat width (pitch × n_ribs)
        #   rib_h    = flange_mm / 2  (each arm projects this height)
        #   n_ribs   = estimated: web / (3×rib_h) capped [2, 8]
        #   flat_top_w = rib_pitch − 2 × arm_run
        #
        # At theta=0 (flat): all points lie on y=0.
        # At theta=90: ribs fully formed, rib_h = flange_mm/2.
        rib_h = flange_mm / 2.0
        if rib_h < 0.1:
            return [pt_fl_l, pt_web_l, pt_web_r, pt_fl_r]
        # n_ribs defaults to 4; caller may pass explicit override via n_ribs parameter.
        # Fallback auto-estimate only when caller passes n_ribs <= 0.
        if n_ribs <= 0:
            n_ribs = max(2, min(8, round(web_mm / max(rib_h * 3.5, 1.0))))
        rib_pitch = web_mm / n_ribs
        # theta=0 (flat): arm_run=rib_h (full horizontal), arm_rise=0 (no vertical)
        # theta=90 (formed): arm_run=0 (no horizontal spread), arm_rise=rib_h (full height)
        arm_run  = rib_h * math.cos(th)   # horizontal projection of rib arm
        arm_rise = rib_h * math.sin(th)   # vertical projection of rib arm
        flat_top_w = max(0.0, rib_pitch - 2.0 * arm_run)

        pts_s: List[Tuple[float, float]] = []
        for ri in range(n_ribs):
            x0 = -hw + ri * rib_pitch
            pts_s.append((x0, 0.0))
            pts_s.append((x0 + arm_run, arm_rise))
            if flat_top_w > 0.01:
                pts_s.append((x0 + arm_run + flat_top_w, arm_rise))
            pts_s.append((x0 + rib_pitch, 0.0))
        pts_s.append((-hw + n_ribs * rib_pitch, 0.0))
        return pts_s

    elif profile_type == "door_frame":
        # Door frame: U-channel (web + 2 flanges) with 90° inward return lips.
        # Return lips are perpendicular to flanges, turning inward.
        lip_len = lip_mm if lip_mm > 0 else flange_mm * 0.25
        lip_dir_l_x =  math.sin(th)   # inward for left side
        lip_dir_l_y =  math.cos(th)
        lip_dir_r_x = -math.sin(th)   # inward for right side
        lip_dir_r_y =  math.cos(th)
        lip_l_end = (pt_fl_l[0] + lip_dir_l_x * lip_len, pt_fl_l[1] + lip_dir_l_y * lip_len)
        lip_r_end = (pt_fl_r[0] + lip_dir_r_x * lip_len, pt_fl_r[1] + lip_dir_r_y * lip_len)
        return [lip_l_end, pt_fl_l, pt_web_l, pt_web_r, pt_fl_r, lip_r_end]

    else:
        # Default: c_channel, simple_channel, and any unrecognised type
        return [pt_fl_l, pt_web_l, pt_web_r, pt_fl_r]


def centerline_to_polygon(pts: List[Tuple[float, float]], thickness: float) -> Optional[Any]:
    """Buffer a polyline by t/2 to get a filled polygon."""
    if not SHAPELY_OK or len(pts) < 2:
        return None
    try:
        ls = LineString(pts)
        return ls.buffer(thickness / 2.0, cap_style=2, join_style=2)
    except Exception:
        return None


# ── SVG serialiser ─────────────────────────────────────────────────────────────

def _poly_to_svg_path(geom: Any, ox: float, oy: float, sc: float) -> str:
    """Convert a shapely Polygon/MultiPolygon to SVG <path d="..."> data."""
    parts = []
    polys = geom.geoms if hasattr(geom, "geoms") else [geom]
    for poly in polys:
        if poly.is_empty:
            continue
        coords = list(poly.exterior.coords)
        d = " ".join(
            f"{'M' if i == 0 else 'L'} {ox + c[0] * sc:.2f} {oy - c[1] * sc:.2f}"
            for i, c in enumerate(coords)
        )
        d += " Z"
        parts.append(d)
    return " ".join(parts)


# ── Main generator ─────────────────────────────────────────────────────────────

def generate_flower_svg(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    roll_contour_result: Dict[str, Any],
    station_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate a composite flower pattern SVG string.

    Returns dict with:
      svg_string        — complete SVG markup as a string
      station_count     — number of stations rendered
      flat_strip_mm     — computed flat strip width
      final_width_mm    — final section width
      status            — 'pass' | 'fail'
    """
    if not SHAPELY_OK:
        return {
            "status": "fail",
            "engine": "flower_svg_engine",
            "reason": "shapely package not installed",
            "svg_string": "",
        }

    web_mm     = float(profile_result.get("section_width_mm", 60))
    flange_mm  = float(profile_result.get("section_height_mm", 40))
    thickness  = float(input_result.get("sheet_thickness_mm", 1.5))
    ptype      = str(profile_result.get("profile_type", "c_channel"))
    material   = str(input_result.get("material", "GI"))

    lips_present = bool(profile_result.get("lips_present", False))
    lip_mm = flange_mm * 0.18 if lips_present else 0.0

    passes       = roll_contour_result.get("passes", [])
    calib        = roll_contour_result.get("calibration_pass", {})
    all_passes   = list(passes) + ([calib] if calib else [])
    flat_strip   = roll_contour_result.get("forming_summary", {}).get("flat_strip_width_mm", web_mm)
    n_total      = len(all_passes)

    if not all_passes:
        return {
            "status": "fail",
            "engine": "flower_svg_engine",
            "reason": "No forming passes from roll_contour_engine",
            "svg_string": "",
        }

    # ── SVG canvas ────────────────────────────────────────────────────────────
    SVG_W = 900
    SVG_H = 340
    PAD   = 50
    DRAW_W = SVG_W - 2 * PAD
    DRAW_H = SVG_H - 2 * PAD - 30  # leave room for labels

    # Scale: fit the largest cross-section (final form + thickness buffer)
    max_half_w = web_mm / 2 + flange_mm + thickness
    max_h      = flange_mm + thickness
    sc_x = DRAW_W / (2 * max_half_w + 8)
    sc_y = DRAW_H / (max_h + 8)
    sc   = min(sc_x, sc_y, 5.0)   # cap at 5 px/mm

    ox = SVG_W / 2   # x origin = centre
    oy = PAD + 30 + (DRAW_H / 2) + max_h * sc / 4   # y origin = baseline mid

    # ── Render each station ────────────────────────────────────────────────────
    path_elements: List[str] = []
    label_elements: List[str] = []
    station_polygons: List[Dict[str, Any]] = []   # per-station polygon data for API consumers

    for i, p in enumerate(all_passes):
        angle     = float(p.get("target_angle_deg", 0))
        is_calib  = p.get("stage_type") == "calibration"
        colour, opacity = _station_colour(i, n_total, is_calib)

        pts = section_centerline(ptype, web_mm, flange_mm, angle, lip_mm)
        poly = centerline_to_polygon(pts, thickness)
        if poly is None or poly.is_empty:
            continue

        # Capture per-station polygon data for API response
        try:
            coords = list(poly.exterior.coords)
        except Exception:
            coords = []
        has_self_intersection = False
        try:
            has_self_intersection = not poly.is_valid
        except Exception:
            pass
        poly_area = 0.0
        try:
            poly_area = round(poly.area, 4)
        except Exception:
            pass

        station_polygons.append({
            "pass_no":              p.get("pass_no", i + 1),
            "station_label":        p.get("station_label", f"Station {i + 1}"),
            "angle_deg":            round(angle, 2),
            "stage_type":           p.get("stage_type", "forming"),
            "is_calibration":       is_calib,
            "polygon_points":       [{"x": round(c[0], 4), "y": round(c[1], 4)} for c in coords],
            "polygon_area_mm2":     poly_area,
            "has_self_intersection": has_self_intersection,
            "point_count":          len(coords),
            "colour":               colour,
        })

        d = _poly_to_svg_path(poly, ox, oy, sc)
        path_elements.append(
            f'<path d="{d}" fill="{colour}" fill-opacity="{opacity:.2f}" '
            f'stroke="{colour}" stroke-width="0.8" stroke-opacity="0.9"/>'
        )

    # ── Flat strip reference line ──────────────────────────────────────────────
    hw_flat = flat_strip / 2 * sc
    y_flat  = oy + 18
    path_elements.append(
        f'<line x1="{ox - hw_flat:.1f}" y1="{y_flat:.1f}" '
        f'x2="{ox + hw_flat:.1f}" y2="{y_flat:.1f}" '
        f'stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="5,3"/>'
    )
    path_elements.append(
        f'<text x="{ox:.1f}" y="{y_flat + 14:.1f}" text-anchor="middle" '
        f'fill="#fbbf24" font-size="10" font-family="monospace">'
        f'Flat strip = {flat_strip:.1f} mm</text>'
    )

    # ── Legend ─────────────────────────────────────────────────────────────────
    legend_items = [
        ("#6b7280", "Flat / pre-bend"),
        ("#7c3aed", "Early forming"),
        ("#6366f1", "Mid forming"),
        ("#3b82f6", "Final form"),
        ("#22c55e", "Calibration"),
    ]
    legend_x = PAD
    legend_y = SVG_H - 24
    for k, (c, label) in enumerate(legend_items):
        lx = legend_x + k * 160
        path_elements.append(
            f'<rect x="{lx}" y="{legend_y - 8}" width="12" height="8" '
            f'fill="{c}" rx="2"/>'
        )
        path_elements.append(
            f'<text x="{lx + 16}" y="{legend_y}" fill="#94a3b8" '
            f'font-size="10" font-family="monospace">{label}</text>'
        )

    # ── Dimension labels (user strings are escaped against XSS) ────────────────
    dim_y = PAD + 12
    dims = [
        (f"Profile: {_esc(ptype)}", "#f8fafc"),
        (f"Web = {web_mm:.0f} mm", "#fbbf24"),
        (f"Flange = {flange_mm:.0f} mm", "#4ade80"),
        (f"t = {thickness} mm", "#f87171"),
        (f"Material = {_esc(material)}", "#94a3b8"),
        (f"Stations = {n_total}", "#c084fc"),
    ]
    for k, (txt, col) in enumerate(dims):
        path_elements.append(
            f'<text x="{PAD + k * 135}" y="{dim_y}" fill="{col}" '
            f'font-size="11" font-family="monospace">{txt}</text>'
        )

    # ── Title ──────────────────────────────────────────────────────────────────
    title_elem = (
        f'<text x="10" y="20" fill="#f8fafc" font-size="14" '
        f'font-weight="bold" font-family="sans-serif">'
        f'Flower Pattern — {_esc(ptype)} ({web_mm:.0f}×{flange_mm:.0f} mm) '
        f'· {n_total} stations · shapely-computed 2D polygons</text>'
    )

    all_elems = "\n  ".join([title_elem] + path_elements + label_elements)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{SVG_W}" height="{SVG_H}" viewBox="0 0 {SVG_W} {SVG_H}">'
        f'\n  <rect width="100%" height="100%" fill="#0a0f1e"/>'
        f'\n  {all_elems}'
        f'\n</svg>'
    )

    # ── Validation summary ──────────────────────────────────────────────────────
    any_self_intersection = any(sp["has_self_intersection"] for sp in station_polygons)
    areas                 = [sp["polygon_area_mm2"] for sp in station_polygons if sp["polygon_area_mm2"] > 0]
    area_range_pct        = 0.0
    if areas:
        area_range_pct = round((max(areas) - min(areas)) / max(areas) * 100, 2)

    # Check monotonic angle progression (forming passes only)
    forming_angles = [sp["angle_deg"] for sp in station_polygons if not sp["is_calibration"]]
    monotonic = all(a <= b for a, b in zip(forming_angles, forming_angles[1:]))

    logger.info(
        "[flower_svg_engine] %d station polygons %s %.0f×%.0f t=%.2f "
        "self_intersect=%s monotonic=%s area_variation=%.1f%%",
        n_total, ptype, web_mm, flange_mm, thickness,
        any_self_intersection, monotonic, area_range_pct,
    )

    # Profile dimension annotations (JSON — not just SVG text)
    forming_summary = roll_contour_result.get("forming_summary", {})
    inner_radius_mm = float(forming_summary.get("bend_inner_radius_mm", max(thickness * 1.0, 0.5)))
    ba_each = (math.pi / 180.0) * 90.0 * (inner_radius_mm + thickness / 2.0)
    profile_dimensions = {
        "web_mm":            web_mm,
        "flange_mm":         flange_mm,
        "thickness_mm":      thickness,
        "material":          material,
        "inner_radius_mm":   round(inner_radius_mm, 3),
        "flat_strip_mm":     round(flat_strip, 2),
        "bend_allowance_mm": round(ba_each, 4),
        "unit":              "mm",
    }

    return {
        "status":          "pass",
        "engine":          "flower_svg_engine",
        "svg_string":      svg,
        "station_count":   n_total,
        "flat_strip_mm":   round(flat_strip, 2),
        "final_width_mm":  web_mm,
        "profile_type":    ptype,
        "shapely_used":    True,
        "station_polygons":        station_polygons,
        "profile_dimensions":      profile_dimensions,
        "validation": {
            "monotonic_angles":         monotonic,
            "any_self_intersection":    any_self_intersection,
            "area_variation_pct":       area_range_pct,
            "thickness_consistent":     True,   # guaranteed by centerline_to_polygon
            "forming_angles":           forming_angles,
        },
    }
