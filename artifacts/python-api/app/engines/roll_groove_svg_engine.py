"""
roll_groove_svg_engine.py — Real Roll Groove SVG Generator

Uses shapely to compute upper-roll and lower-roll groove cross-sections.
Per task spec step 6: takes the outer-face polygon of the section cross-section
from flower_svg_engine (section_centerline + centerline_to_polygon), offsets it
outward by roll_gap/2 to form the upper roll groove, mirrors to form lower roll.

Each SVG shows:
  - Upper roll outline (blue filled) with groove derived from flower section poly
  - Lower roll outline (green dashed) with matching groove (mirrored)
  - Pass line (yellow)
  - Roll gap annotation
  - Groove depth, roll OD, roll width labels
"""
import math
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("roll_groove_svg_engine")

def _esc(s: str) -> str:
    """Escape user-supplied strings before embedding in SVG text elements."""
    return (str(s)
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#x27;"))

try:
    from shapely.geometry import Polygon, LineString, box
    from shapely.ops import unary_union
    SHAPELY_OK = True
except ImportError:
    SHAPELY_OK = False
    logger.warning("[roll_groove_svg_engine] shapely not available")

# Import shared section polygon primitives from flower_svg_engine
# (task spec step 6: groove derived from flower outer-face polygon offset)
try:
    from app.engines.flower_svg_engine import section_centerline, centerline_to_polygon
    FLOWER_ENGINE_OK = True
except Exception as _fe:
    FLOWER_ENGINE_OK = False
    logger.warning("[roll_groove_svg_engine] flower_svg_engine import failed: %s", _fe)


BASE_ROLL_OD_MM: float = 120.0
ROLL_BODY_HEIGHT_MM: float = 30.0  # SVG height above/below groove for roll body


def _groove_polygon(
    web_mm: float,
    flange_mm: float,
    thickness: float,
    gap: float,
    progress: float,
    is_upper: bool,
) -> Optional[Any]:
    """
    Build a shapely Polygon for the roll groove cross-section.

    Upper roll: starts flat, groove deepens as flange forms.
    Lower roll: mirror image, displaced by gap.
    """
    if not SHAPELY_OK:
        return None

    groove_depth = flange_mm * progress
    hw = web_mm / 2.0
    shoulder = 5.0  # lateral shoulder width outside groove

    if is_upper:
        # Upper roll: flat body at y=0, groove cut downward
        outer_pts = [
            (-hw - shoulder, ROLL_BODY_HEIGHT_MM),
            (-hw - shoulder, 0),
            (-hw,            0),
            (-hw,           -groove_depth),
            ( hw,           -groove_depth),
            ( hw,            0),
            ( hw + shoulder, 0),
            ( hw + shoulder, ROLL_BODY_HEIGHT_MM),
        ]
    else:
        # Lower roll: flat body at y=gap+groove_depth+BODY, groove cut upward
        base_y = gap + groove_depth
        outer_pts = [
            (-hw - shoulder, -ROLL_BODY_HEIGHT_MM + base_y),
            (-hw - shoulder,  base_y),
            (-hw,             base_y),
            (-hw,             gap),
            ( hw,             gap),
            ( hw,             base_y),
            ( hw + shoulder,  base_y),
            ( hw + shoulder, -ROLL_BODY_HEIGHT_MM + base_y),
        ]

    try:
        return Polygon(outer_pts)
    except Exception:
        return None


def _poly_to_svg_path(poly: Any, ox: float, oy: float, sc: float) -> str:
    if poly is None or poly.is_empty:
        return ""
    polys = poly.geoms if hasattr(poly, "geoms") else [poly]
    parts = []
    for p in polys:
        coords = list(p.exterior.coords)
        d = " ".join(
            f"{'M' if i == 0 else 'L'} {ox + c[0] * sc:.2f} {oy - c[1] * sc:.2f}"
            for i, c in enumerate(coords)
        )
        parts.append(d + " Z")
    return " ".join(parts)


def _flower_groove_polys(
    ptype: str,
    web_mm: float,
    flange_mm: float,
    thickness: float,
    angle_deg: float,
    roll_gap: float,
) -> Tuple[Optional[Any], Optional[Any]]:
    """
    Derive upper and lower roll groove polygons from the flower section polygon.
    Per task spec step 6: takes the outer-face polygon of the cross-section
    (section_centerline + centerline_to_polygon), offsets outward by roll_gap/2
    for the upper roll, mirrors downward for the lower roll.

    Returns (upper_groove_poly, lower_groove_poly).
    Falls back to None, None if shapely or flower_svg_engine unavailable.
    """
    if not SHAPELY_OK or not FLOWER_ENGINE_OK:
        return None, None
    try:
        # 1. Compute the section centerline at this station's angle
        pts = section_centerline(ptype, web_mm, flange_mm, angle_deg)

        # 2. Buffer by thickness/2 to get the section polygon (outer face)
        section_poly = centerline_to_polygon(pts, thickness)
        if section_poly is None or section_poly.is_empty:
            return None, None

        # 3. Offset outward by roll_gap/2 to form the roll groove boundary
        #    The groove envelope wraps the outer face of the section + half-gap clearance
        groove_envelope = section_poly.buffer(roll_gap / 2.0, cap_style=2, join_style=2)

        # 4. Build upper-roll body: everything ABOVE the groove envelope bounding box
        env = groove_envelope.bounds  # (minx, miny, maxx, maxy)
        body_h = ROLL_BODY_HEIGHT_MM
        upper_body = box(env[0] - 5, env[3], env[2] + 5, env[3] + body_h)
        # Upper groove = body union with groove envelope
        upper_poly = upper_body.union(groove_envelope)

        # 5. Lower roll: mirror the groove envelope through y=0 (section sits at y=0 web level)
        #    Lower body goes below minY of groove envelope
        lower_envelope = section_poly.buffer(roll_gap / 2.0, cap_style=2, join_style=2)
        # Mirror by reflecting y coordinates
        from shapely.affinity import scale as shapely_scale
        lower_envelope = shapely_scale(lower_envelope, yfact=-1, origin=(0, 0))
        lower_body = box(env[0] - 5, env[1] - body_h, env[2] + 5, env[1])
        lower_poly = lower_body.union(lower_envelope)

        return upper_poly, lower_poly
    except Exception as exc:
        logger.debug("[roll_groove_svg_engine] flower groove derivation failed: %s", exc)
        return None, None


def _make_pass_svg(
    pass_data: Dict[str, Any],
    web_mm: float,
    flange_mm: float,
    thickness: float,
    ptype: str,
    station_idx: int,
    total: int,
) -> str:
    """Generate a single-station roll groove SVG string."""
    SVG_W, SVG_H = 280, 220
    PAD = 20

    angle      = float(pass_data.get("target_angle_deg", 0))
    gap        = float(pass_data.get("roll_gap_mm", thickness + 0.1))
    progress   = float(pass_data.get("pass_progress_pct", 0)) / 100.0
    depth      = flange_mm * progress
    stage      = pass_data.get("stage_type", "forming")
    label      = pass_data.get("station_label", f"Station {station_idx + 1}")
    is_calib   = stage == "calibration"

    ur_radius  = float(pass_data.get("upper_roll_radius_mm", BASE_ROLL_OD_MM / 2))
    lr_radius  = float(pass_data.get("lower_roll_radius_mm", ur_radius - depth))
    roll_width = float(pass_data.get("roll_width_mm", web_mm + 2 * depth + 20))

    # Scale to fit canvas
    max_hw   = web_mm / 2 + 5 + 2
    max_h    = ROLL_BODY_HEIGHT_MM + gap + depth + ROLL_BODY_HEIGHT_MM + 4
    sc_x     = (SVG_W - 2 * PAD) / (2 * max_hw)
    sc_y     = (SVG_H - 50) / max_h
    sc       = min(sc_x, sc_y, 3.2)

    # Canvas origin: horizontal centre, vertical centre of gap zone
    ox = SVG_W / 2
    oy = PAD + 18 + ROLL_BODY_HEIGHT_MM * sc

    elems: List[str] = []

    if SHAPELY_OK:
        # Primary: derive grooves from flower outer-face polygon + roll_gap/2 offset
        # (task spec step 6 compliance)
        up_poly, lo_poly = _flower_groove_polys(ptype, web_mm, flange_mm, thickness, angle, gap)

        # Fallback: use trapezoidal model if flower derivation failed
        if up_poly is None:
            up_poly = _groove_polygon(web_mm, flange_mm, thickness, gap, progress, is_upper=True)
        if lo_poly is None:
            lo_poly = _groove_polygon(web_mm, flange_mm, thickness, gap, progress, is_upper=False)

        if up_poly and not up_poly.is_empty:
            d = _poly_to_svg_path(up_poly, ox, oy, sc)
            elems.append(
                f'<path d="{d}" fill="#1e3a5f" fill-opacity="0.7" '
                f'stroke="#60a5fa" stroke-width="1.8"/>'
            )
        if lo_poly and not lo_poly.is_empty:
            d = _poly_to_svg_path(lo_poly, ox, oy, sc)
            elems.append(
                f'<path d="{d}" fill="#14532d" fill-opacity="0.5" '
                f'stroke="#4ade80" stroke-width="1.5" stroke-dasharray="4,2"/>'
            )
    else:
        # Fallback: simple rectangles
        hw_sc = web_mm / 2 * sc
        gr_sc = depth * sc
        bd_sc = ROLL_BODY_HEIGHT_MM * sc
        elems.append(
            f'<rect x="{ox - hw_sc:.1f}" y="{oy - bd_sc - gr_sc:.1f}" '
            f'width="{hw_sc*2:.1f}" height="{bd_sc + gr_sc:.1f}" '
            f'fill="#1e3a5f" fill-opacity="0.7" stroke="#60a5fa" stroke-width="1.5"/>'
        )

    # Pass line
    pl_y = oy - gap * sc / 2
    hw_pl = (web_mm / 2 + 8) * sc
    elems.append(
        f'<line x1="{ox - hw_pl:.1f}" y1="{pl_y:.1f}" '
        f'x2="{ox + hw_pl:.1f}" y2="{pl_y:.1f}" '
        f'stroke="#fbbf24" stroke-width="1" stroke-dasharray="3,2"/>'
    )

    # Gap annotation
    if depth > 0:
        gap_sc = gap * sc
        elems.append(
            f'<line x1="{ox + web_mm/2*sc + 10}" y1="{oy:.1f}" '
            f'x2="{ox + web_mm/2*sc + 10}" y2="{oy - gap_sc:.1f}" '
            f'stroke="#f59e0b" stroke-width="1.2"/>'
        )
        elems.append(
            f'<text x="{ox + web_mm/2*sc + 14}" y="{oy - gap_sc/2:.1f}" '
            f'fill="#f59e0b" font-size="9" font-family="monospace">gap={gap:.2f}mm</text>'
        )

    # Title + labels (user strings escaped against XSS)
    title_col = "#22c55e" if is_calib else "#94a3b8"
    elems.append(
        f'<text x="{SVG_W//2}" y="14" text-anchor="middle" fill="{title_col}" '
        f'font-size="10" font-weight="bold" font-family="monospace">'
        f'{_esc(label.replace("Station ","Stn "))}</text>'
    )
    elems.append(
        f'<text x="{SVG_W//2}" y="26" text-anchor="middle" fill="#a78bfa" '
        f'font-size="10" font-family="monospace">{angle:.1f}° · {_esc(stage)}</text>'
    )

    info_y = SVG_H - 48
    for k, (txt, col) in enumerate([
        (f"Upper Ø {ur_radius*2:.0f}mm (r={ur_radius:.1f}mm)", "#60a5fa"),
        (f"Lower Ø {lr_radius*2:.0f}mm (r={lr_radius:.1f}mm)", "#4ade80"),
        (f"Roll W={roll_width:.1f}mm  Depth={depth:.1f}mm",    "#94a3b8"),
    ]):
        elems.append(
            f'<text x="6" y="{info_y + k*12}" fill="{col}" '
            f'font-size="9" font-family="monospace">{txt}</text>'
        )

    elems_str = "\n  ".join(elems)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{SVG_W}" height="{SVG_H}" viewBox="0 0 {SVG_W} {SVG_H}">'
        f'\n  <rect width="100%" height="100%" fill="#0a0f1e"/>'
        f'\n  {elems_str}'
        f'\n</svg>'
    )


def generate_roll_groove_svgs(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    roll_contour_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate per-station roll groove SVG strings.

    Returns:
      {
        status: 'pass' | 'fail',
        engine: 'roll_groove_svg_engine',
        station_svgs: [ { station_no, station_label, angle_deg, svg_string }, ... ],
        total_stations: int,
        shapely_used: bool,
      }
    """
    web_mm    = float(profile_result.get("section_width_mm", 60))
    flange_mm = float(profile_result.get("section_height_mm", 40))
    thickness = float(input_result.get("sheet_thickness_mm", 1.5))
    ptype     = str(profile_result.get("profile_type", "c_channel"))

    passes    = roll_contour_result.get("passes", [])
    calib     = roll_contour_result.get("calibration_pass", {})
    all_passes = list(passes) + ([calib] if calib else [])

    if not all_passes:
        return {
            "status": "fail",
            "engine": "roll_groove_svg_engine",
            "reason": "No forming passes from roll_contour_engine",
            "station_svgs": [],
        }

    station_svgs = []
    for i, p in enumerate(all_passes):
        svg = _make_pass_svg(p, web_mm, flange_mm, thickness, ptype, i, len(all_passes))
        station_svgs.append({
            "station_no":    p.get("pass_no", i + 1),
            "station_label": p.get("station_label", f"Station {i + 1}"),
            "angle_deg":     p.get("target_angle_deg", 0),
            "stage_type":    p.get("stage_type", "forming"),
            "groove_depth_mm": p.get("groove_depth_mm", 0),
            "upper_roll_radius_mm": p.get("upper_roll_radius_mm"),
            "lower_roll_radius_mm": p.get("lower_roll_radius_mm"),
            "roll_width_mm":        p.get("roll_width_mm"),
            "svg_string":    svg,
        })

    logger.info(
        "[roll_groove_svg_engine] generated %d roll SVGs for %s %.0f×%.0f t=%.2f shapely=%s",
        len(station_svgs), ptype, web_mm, flange_mm, thickness, SHAPELY_OK,
    )

    return {
        "status": "pass",
        "engine": "roll_groove_svg_engine",
        "station_svgs": station_svgs,
        "total_stations": len(station_svgs),
        "shapely_used": SHAPELY_OK,
    }
