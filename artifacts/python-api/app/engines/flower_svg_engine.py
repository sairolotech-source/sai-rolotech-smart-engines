"""
flower_svg_engine.py — Real Flower Pattern SVG Generator

Uses shapely to compute 2D cross-section polygons per forming station,
then exports a composite flower pattern SVG (all stations overlaid).

Supported profiles: c_channel, z_section, lipped_channel, hat_section,
                    simple_angle, complex_section.
"""
import io
import math
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("flower_svg_engine")

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

def _section_centerline(
    profile_type: str,
    web_mm: float,
    flange_mm: float,
    theta_deg: float,
    lip_mm: float = 0.0,
) -> List[Tuple[float, float]]:
    """
    Return a polyline (centerline) representing the section cross-section
    at forming angle theta_deg (0=flat, 90=fully formed).
    Coordinates are in mm; web is centred on x=0, y=0.
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
        return [pt_web_l, pt_web_r, pt_fl_r]

    elif profile_type == "z_section":
        # Left flange bends DOWN, right flange bends UP
        pt_fl_l_z = (-hw - math.cos(th) * flange_mm, -math.sin(th) * flange_mm)
        return [pt_fl_l_z, pt_web_l, pt_web_r, pt_fl_r]

    elif profile_type in ("lipped_channel", "complex_section") and lip_mm > 0:
        # Lips at 90° to flanges (inward-turning)
        lip_angle_l = th + math.pi / 2
        lip_angle_r = math.pi - th - math.pi / 2
        lp_lx = math.cos(lip_angle_l) * lip_mm
        lp_ly = math.sin(lip_angle_l) * lip_mm
        lp_rx = -math.cos(lip_angle_r) * lip_mm
        lp_ry =  math.sin(lip_angle_r) * lip_mm
        return [
            (pt_fl_l[0] + lp_lx, pt_fl_l[1] + lp_ly),
            pt_fl_l,
            pt_web_l, pt_web_r,
            pt_fl_r,
            (pt_fl_r[0] + lp_rx, pt_fl_r[1] + lp_ry),
        ]

    elif profile_type == "hat_section":
        # Hat: outer flanges go down (theta), inner web raised
        pt_fl_l_hat = (-hw - math.cos(th) * flange_mm,  math.sin(th) * flange_mm)
        pt_fl_r_hat = ( hw + math.cos(th) * flange_mm,  math.sin(th) * flange_mm)
        return [pt_fl_l_hat, pt_web_l, pt_web_r, pt_fl_r_hat]

    else:
        # Default: c_channel / simple_channel
        return [pt_fl_l, pt_web_l, pt_web_r, pt_fl_r]


def _centerline_to_polygon(pts: List[Tuple[float, float]], thickness: float) -> Optional[Any]:
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

    for i, p in enumerate(all_passes):
        angle     = float(p.get("target_angle_deg", 0))
        is_calib  = p.get("stage_type") == "calibration"
        colour, opacity = _station_colour(i, n_total, is_calib)

        pts = _section_centerline(ptype, web_mm, flange_mm, angle, lip_mm)
        poly = _centerline_to_polygon(pts, thickness)
        if poly is None or poly.is_empty:
            continue

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

    # ── Dimension labels ───────────────────────────────────────────────────────
    dim_y = PAD + 12
    dims = [
        (f"Profile: {ptype}", "#f8fafc"),
        (f"Web = {web_mm:.0f} mm", "#fbbf24"),
        (f"Flange = {flange_mm:.0f} mm", "#4ade80"),
        (f"t = {thickness} mm", "#f87171"),
        (f"Material = {material}", "#94a3b8"),
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
        f'Flower Pattern — {ptype} ({web_mm:.0f}×{flange_mm:.0f} mm) '
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

    logger.info(
        "[flower_svg_engine] generated %d station polygons for %s %.0f×%.0f t=%.2f",
        n_total, ptype, web_mm, flange_mm, thickness,
    )

    return {
        "status": "pass",
        "engine": "flower_svg_engine",
        "svg_string": svg,
        "station_count": n_total,
        "flat_strip_mm": round(flat_strip, 2),
        "final_width_mm": web_mm,
        "profile_type": ptype,
        "shapely_used": True,
    }
