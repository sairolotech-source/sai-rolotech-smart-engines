"""
cad_export_engine.py â€” DXF Drawing + STEP CAD Export Engine

Generates production-grade CAD files:
  DXF (via ezdxf):
    â€¢ Per-roll part drawings (OD, bore, keyway, forming profile)
    â€¢ Shaft + spacer layout drawing
    â€¢ Machine assembly overview drawing

  STEP (custom AP203 writer):
    â€¢ Hollow cylinder body for each roll (outer surface + bore)
    â€¢ Shaft body

Saves all files to artifacts/python-api/exports/cad/<session_id>/

Blueprint source: Ultra Pro spec (historical reference).
Runtime truth: this engine currently exports DXF + STEP only. DWG writer is not implemented.
"""
import logging
import os
import math
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

import ezdxf
from ezdxf import colors as dxf_colors
from ezdxf.enums import TextEntityAlignment

logger = logging.getLogger("cad_export_engine")

EXPORTS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "exports", "cad"
)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# DXF HELPERS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _new_dxf(version: str = "R2010") -> ezdxf.document.Drawing:
    doc = ezdxf.new(version)
    doc.layers.add("OUTLINE",   color=7)   # white/black
    doc.layers.add("CENTRE",    color=1)   # red
    doc.layers.add("DIMENSION", color=2)   # yellow
    doc.layers.add("HATCH",     color=8)   # grey
    doc.layers.add("NOTES",     color=3)   # green
    doc.layers.add("TITLE",     color=4)   # cyan
    return doc


def _title_block(
    msp: Any,
    title: str,
    part_no: str,
    material: str,
    hardness: str,
    scale: str,
    x0: float = 0.0,
    y0: float = -40.0,
) -> None:
    """Draw a minimal title block below the drawing."""
    msp.add_text(
        f"SAI ROLOTECH  |  {title}  |  P/N: {part_no}",
        dxfattribs={"layer": "TITLE", "height": 5.0, "insert": (x0, y0)},
    )
    msp.add_text(
        f"Material: {material}  |  Hardness: {hardness}  |  Scale: {scale}  |  PRELIMINARY",
        dxfattribs={"layer": "NOTES", "height": 3.5, "insert": (x0, y0 - 8)},
    )


def _dim_horizontal(msp: Any, x1: float, x2: float, y: float, text: str) -> None:
    msp.add_line((x1, y + 3), (x1, y + 8), dxfattribs={"layer": "DIMENSION", "color": 2})
    msp.add_line((x2, y + 3), (x2, y + 8), dxfattribs={"layer": "DIMENSION", "color": 2})
    msp.add_line((x1, y + 6), (x2, y + 6), dxfattribs={"layer": "DIMENSION", "color": 2})
    msp.add_text(
        text, dxfattribs={"layer": "DIMENSION", "height": 3.0,
                          "insert": ((x1 + x2) / 2, y + 8)}
    )


def _dim_vertical(msp: Any, x: float, y1: float, y2: float, text: str) -> None:
    msp.add_line((x + 3, y1), (x + 8, y1), dxfattribs={"layer": "DIMENSION", "color": 2})
    msp.add_line((x + 3, y2), (x + 8, y2), dxfattribs={"layer": "DIMENSION", "color": 2})
    msp.add_line((x + 6, y1), (x + 6, y2), dxfattribs={"layer": "DIMENSION", "color": 2})
    msp.add_text(
        text, dxfattribs={"layer": "DIMENSION", "height": 3.0,
                          "insert": (x + 9, (y1 + y2) / 2)}
    )


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_xy_points(points: Any) -> List[Tuple[float, float]]:
    out: List[Tuple[float, float]] = []
    if not isinstance(points, list):
        return out
    for p in points:
        if isinstance(p, dict) and "x" in p and "y" in p:
            out.append((_safe_float(p.get("x")), _safe_float(p.get("y"))))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            out.append((_safe_float(p[0]), _safe_float(p[1])))
    return out


def _scale_contour_to_band(
    points: List[Tuple[float, float]],
    x0: float,
    y0: float,
    width: float,
    height: float,
) -> List[Tuple[float, float]]:
    if len(points) < 2:
        return []

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    dx = max(max_x - min_x, 1e-6)
    dy = max(max_y - min_y, 1e-6)

    scaled: List[Tuple[float, float]] = []
    for px, py in points:
        nx = (px - min_x) / dx
        ny = (py - min_y) / dy
        scaled.append((x0 + nx * width, y0 + (1.0 - ny) * height))
    return scaled


def _contour_depth_mm(top_contour: Any, bottom_contour: Any) -> float:
    pts = _extract_xy_points(top_contour) + _extract_xy_points(bottom_contour)
    if not pts:
        return 0.0
    ys = [p[1] for p in pts]
    return round(max(ys) - min(ys), 3)


def _contour_span_x_mm(top_contour: Any, bottom_contour: Any) -> float:
    pts = _extract_xy_points(top_contour) + _extract_xy_points(bottom_contour)
    if not pts:
        return 0.0
    xs = [p[0] for p in pts]
    return round(max(xs) - min(xs), 3)


def _build_export_rolls(
    roll_contour_result: Dict[str, Any],
    cam_prep_result: Dict[str, Any],
    shaft_dia: float,
) -> List[Dict[str, Any]]:
    """
    Merge contour-engine station geometry with CAM dimensions.
    Contour fields are mandatory when available; CAM metadata fills machining details.
    """
    cam_rolls = cam_prep_result.get("rolls", []) if isinstance(cam_prep_result, dict) else []
    cam_by_station: Dict[int, Dict[str, Any]] = {}
    for r in cam_rolls:
        try:
            cam_by_station[int(r.get("station_no", -1))] = r
        except (TypeError, ValueError):
            continue

    contour_passes = roll_contour_result.get("passes", []) if isinstance(roll_contour_result, dict) else []
    calibration_pass = roll_contour_result.get("calibration_pass", {}) if isinstance(roll_contour_result, dict) else {}
    export_rolls: List[Dict[str, Any]] = []

    def _merge_one(pass_data: Dict[str, Any]) -> None:
        if not isinstance(pass_data, dict):
            return
        try:
            station_no = int(pass_data.get("pass_no", pass_data.get("station_no", len(export_rolls) + 1)))
        except (TypeError, ValueError):
            station_no = len(export_rolls) + 1
        cam_roll = cam_by_station.get(station_no, {})
        tooling = pass_data.get("tooling", {}) if isinstance(pass_data.get("tooling"), dict) else {}

        top_contour = tooling.get("top_roll_contour") or pass_data.get("upper_roll_profile") or []
        bottom_contour = tooling.get("bottom_roll_contour") or pass_data.get("lower_roll_profile") or []

        contour_depth = _safe_float(tooling.get("groove_depth_mm"), 0.0)
        if contour_depth <= 0:
            contour_depth = _safe_float(pass_data.get("forming_depth_mm"), 0.0)
        if contour_depth <= 0:
            contour_depth = _contour_depth_mm(top_contour, bottom_contour)
        contour_span_x = _contour_span_x_mm(top_contour, bottom_contour)

        # Derived face width: contour span + profile relief + shaft packaging margin.
        # Avoid blind strip_width + constant rules.
        min_face = max(24.0, 0.80 * shaft_dia)
        profile_relief = max(4.0, 0.10 * contour_depth + 0.05 * shaft_dia)
        derived_face = max(contour_span_x, _safe_float(pass_data.get("strip_width_mm"), 0.0)) + (2.0 * profile_relief)

        face_width = max(
            _safe_float(cam_roll.get("face_width_mm"), 0.0),
            _safe_float(tooling.get("face_width_mm"), 0.0),
            _safe_float(pass_data.get("roll_width_mm"), 0.0),
            derived_face,
            min_face,
        )
        upper_r = _safe_float(pass_data.get("upper_roll_radius_mm"), 0.0)
        lower_r = _safe_float(pass_data.get("lower_roll_radius_mm"), 0.0)
        roll_gap = max(_safe_float(pass_data.get("roll_gap_mm"), 0.0), 0.0)
        radial_wall = max(
            6.0,
            0.15 * shaft_dia,
            (0.45 * contour_depth) + max(2.0, 1.2 * roll_gap),
        )
        derived_od = shaft_dia + (2.0 * radial_wall) + max(2.0, 0.55 * contour_depth)
        od_mm = max(
            _safe_float(cam_roll.get("od_mm"), 0.0),
            upper_r * 2.0,
            lower_r * 2.0,
            derived_od,
            shaft_dia + 12.0,
        )

        export_rolls.append({
            "roll_label": cam_roll.get("roll_label", f"Stand {station_no} Upper + Lower"),
            "station_no": station_no,
            "stage_type": pass_data.get("stage_type", cam_roll.get("stage_type", "forming")),
            "od_mm": round(od_mm, 3),
            "bore_mm": _safe_float(cam_roll.get("bore_mm"), shaft_dia),
            "face_width_mm": round(face_width, 3),
            "profile_depth_mm": round(contour_depth, 3),
            "hardness_hrc": cam_roll.get("hardness_hrc", cam_prep_result.get("hardness_hrc", 58)),
            "roll_material": cam_roll.get("roll_material", cam_prep_result.get("roll_material", "EN31")),
            "top_roll_contour": top_contour,
            "bottom_roll_contour": bottom_contour,
            "geometry_source": pass_data.get("geometry_source", tooling.get("geometry_grade", "unknown")),
            "dimension_source": "contour_station_derived",
            "contour_span_x_mm": contour_span_x,
        })

    if isinstance(contour_passes, list):
        for p in contour_passes:
            _merge_one(p)
    if isinstance(calibration_pass, dict) and calibration_pass:
        _merge_one(calibration_pass)

    export_rolls.sort(key=lambda r: int(r.get("station_no", 0)))
    return export_rolls


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# ROLL PART DRAWING
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _draw_roll_part(
    msp: Any,
    roll: Dict[str, Any],
    shaft_dia: float,
    keyway: Dict[str, Any],
    cx: float = 0.0,
    cy: float = 0.0,
) -> None:
    """Draw a single roll in front view (cross-section) + side view (end view)."""
    od_r   = roll["od_mm"] / 2
    bore_r = shaft_dia / 2
    face_w = roll["face_width_mm"]
    depth  = roll.get("profile_depth_mm", 0)

    # â”€â”€ Front view (cross-section elevation) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    # Outer rectangle
    msp.add_lwpolyline(
        [(cx, cy - od_r), (cx + face_w, cy - od_r),
         (cx + face_w, cy + od_r), (cx, cy + od_r)],
        close=True, dxfattribs={"layer": "OUTLINE"},
    )
    # Bore rectangle (hatched)
    msp.add_lwpolyline(
        [(cx, cy - bore_r), (cx + face_w, cy - bore_r),
         (cx + face_w, cy + bore_r), (cx, cy + bore_r)],
        close=True, dxfattribs={"layer": "HATCH"},
    )
    # Centre line
    msp.add_line((cx - 10, cy), (cx + face_w + 10, cy),
                 dxfattribs={"layer": "CENTRE", "linetype": "CENTER"})

    # Contour overlay (preferred): draw station-derived top/bottom groove contours.
    # Fallback: depth line when contour data is unavailable.
    top_contour = _extract_xy_points(roll.get("top_roll_contour"))
    bottom_contour = _extract_xy_points(roll.get("bottom_roll_contour"))
    contour_band_h = max(min(depth if depth > 0 else od_r * 0.25, od_r * 0.35), 6.0)
    band_margin_x = 4.0
    band_w = max(face_w - (2 * band_margin_x), 8.0)

    top_scaled = _scale_contour_to_band(
        top_contour,
        x0=cx + band_margin_x,
        y0=cy + od_r - contour_band_h - 2.0,
        width=band_w,
        height=contour_band_h,
    )
    if len(top_scaled) >= 2:
        msp.add_lwpolyline(top_scaled, dxfattribs={"layer": "OUTLINE"})

    bottom_scaled = _scale_contour_to_band(
        bottom_contour,
        x0=cx + band_margin_x,
        y0=cy - od_r + 2.0,
        width=band_w,
        height=contour_band_h,
    )
    if len(bottom_scaled) >= 2:
        msp.add_lwpolyline(bottom_scaled, dxfattribs={"layer": "OUTLINE"})

    if len(top_scaled) < 2 and len(bottom_scaled) < 2 and depth > 0:
        msp.add_lwpolyline(
            [(cx, cy + od_r - depth), (cx + face_w, cy + od_r - depth)],
            dxfattribs={"layer": "OUTLINE", "linetype": "DASHED"},
        )

    msp.add_text(
        f"Profile depth: {depth:.1f}",
        dxfattribs={"layer": "NOTES", "height": 3, "insert": (cx + face_w + 5, cy + od_r - max(depth, 2.0))},
    )

    # Dimensions
    _dim_horizontal(msp, cx, cx + face_w, cy + od_r, f"FACE {face_w:.1f}")
    _dim_vertical(msp, cx + face_w, cy, cy + od_r, f"OD {roll['od_mm']:.1f}")
    _dim_vertical(msp, cx + face_w + 18, cy, cy + bore_r, f"BORE Ã˜{shaft_dia:.1f}")

    # â”€â”€ End view (circle representation) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ex = cx + face_w + 80
    ey = cy
    msp.add_circle((ex, ey), od_r,   dxfattribs={"layer": "OUTLINE"})
    msp.add_circle((ex, ey), bore_r, dxfattribs={"layer": "HATCH"})
    # Centre cross
    msp.add_line((ex - od_r - 5, ey), (ex + od_r + 5, ey),
                 dxfattribs={"layer": "CENTRE", "linetype": "CENTER"})
    msp.add_line((ex, ey - od_r - 5), (ex, ey + od_r + 5),
                 dxfattribs={"layer": "CENTRE", "linetype": "CENTER"})

    # Keyway in end view
    kw_b_half = keyway.get("b", 12) / 2
    kw_t1     = keyway.get("t1", 5)
    msp.add_lwpolyline(
        [(ex - kw_b_half, ey + bore_r),
         (ex + kw_b_half, ey + bore_r),
         (ex + kw_b_half, ey + bore_r + kw_t1),
         (ex - kw_b_half, ey + bore_r + kw_t1)],
        close=True, dxfattribs={"layer": "OUTLINE"},
    )
    msp.add_text(
        f"KW {keyway.get('b',12)}Ã—{keyway.get('h',8)} DIN6885",
        dxfattribs={"layer": "NOTES", "height": 3, "insert": (ex + od_r + 5, ey + bore_r)},
    )


def generate_roll_set_dxf(
    session_dir: str,
    rolls: List[Dict[str, Any]],
    shaft_dia: float,
    keyway: Dict[str, Any],
    project_info: Dict[str, Any],
) -> str:
    """Generate roll_set.dxf â€” all rolls on one drawing sheet."""
    doc = _new_dxf()
    msp = doc.modelspace()

    spacing_x = 340.0
    spacing_y = 280.0
    per_row = 4

    for i, roll in enumerate(rolls):
        row = i // per_row
        col = i % per_row
        x_offset = col * spacing_x
        y_offset = -(row * spacing_y)

        _draw_roll_part(msp, roll, shaft_dia, keyway, cx=x_offset, cy=y_offset)
        msp.add_text(
            f"Stand {roll.get('station_no', i+1)} â€” {roll.get('stage_type', '').replace('_', ' ').title()}",
            dxfattribs={"layer": "TITLE", "height": 5, "insert": (x_offset, y_offset - 125)},
        )

    row_count = max(1, math.ceil(max(len(rolls), 1) / per_row))
    title_y = -(row_count * spacing_y) - 60

    _title_block(
        msp, "ROLL SET â€” ALL STANDS",
        part_no="RS-001",
        material=f"EN31 / D2 | HRC {project_info.get('hardness_hrc', 58)}",
        hardness=f"HRC {project_info.get('hardness_hrc', 58)}",
        scale="1:5",
        x0=-50, y0=title_y,
    )

    path = os.path.join(session_dir, "roll_set.dxf")
    doc.saveas(path)
    return path


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SHAFT + SPACER LAYOUT DRAWING
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def generate_shaft_layout_dxf(
    session_dir: str,
    shaft_dia: float,
    rolls: List[Dict[str, Any]],
    bearing_type: str,
    keyway: Dict[str, Any],
    project_info: Dict[str, Any],
) -> str:
    """Generate shaft_layout.dxf â€” shaft centerline with bearing/roll/spacer positions."""
    doc = _new_dxf()
    msp = doc.modelspace()

    shaft_half  = shaft_dia / 2
    # Build shaft segments from rolls
    x = 30.0
    bearing_w = 20.0
    spacer_gap = 5.0

    total_width = bearing_w + sum(r["face_width_mm"] + spacer_gap for r in rolls) + bearing_w

    # Shaft main line
    msp.add_line((-20, 0), (total_width + 20, 0),
                 dxfattribs={"layer": "CENTRE", "linetype": "CENTER"})
    msp.add_line((0, shaft_half), (total_width, shaft_half), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((0, -shaft_half), (total_width, -shaft_half), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((0, shaft_half), (0, -shaft_half), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((total_width, shaft_half), (total_width, -shaft_half), dxfattribs={"layer": "OUTLINE"})

    # Bearing Left
    bx = 0.0
    msp.add_lwpolyline(
        [(bx, shaft_half), (bx + bearing_w, shaft_half + 15),
         (bx + bearing_w, -(shaft_half + 15)), (bx, -shaft_half)],
        close=True, dxfattribs={"layer": "OUTLINE"},
    )
    msp.add_text(bearing_type, dxfattribs={"layer": "NOTES", "height": 3.5,
                                            "insert": (bx, shaft_half + 18)})
    x = bearing_w

    # Rolls + spacers
    for i, roll in enumerate(rolls):
        fw = roll["face_width_mm"]
        # Roll block
        roll_r = roll["od_mm"] / 2
        msp.add_lwpolyline(
            [(x, roll_r), (x + fw, roll_r), (x + fw, -roll_r), (x, -roll_r)],
            close=True, dxfattribs={"layer": "OUTLINE"},
        )
        msp.add_text(
            f"S{roll.get('station_no', i+1)}",
            dxfattribs={"layer": "TITLE", "height": 4, "insert": (x + fw / 2 - 3, -roll_r - 10)},
        )
        _dim_horizontal(msp, x, x + fw, roll_r, f"{fw:.1f}")
        x += fw

        # Spacer
        if i < len(rolls) - 1:
            msp.add_lwpolyline(
                [(x, shaft_half + 4), (x + spacer_gap, shaft_half + 4),
                 (x + spacer_gap, -(shaft_half + 4)), (x, -(shaft_half + 4))],
                close=True, dxfattribs={"layer": "HATCH"},
            )
            x += spacer_gap

    # Bearing Right
    bx = x
    msp.add_lwpolyline(
        [(bx, shaft_half), (bx + bearing_w, shaft_half + 15),
         (bx + bearing_w, -(shaft_half + 15)), (bx, -shaft_half)],
        close=True, dxfattribs={"layer": "OUTLINE"},
    )
    msp.add_text(bearing_type, dxfattribs={"layer": "NOTES", "height": 3.5,
                                            "insert": (bx, shaft_half + 18)})

    _dim_horizontal(msp, 0, total_width, shaft_half + 40, f"TOTAL SHAFT {total_width:.1f}")
    _dim_vertical(msp, total_width + 30, 0, shaft_half, f"Ã˜{shaft_dia:.0f}")

    _title_block(msp, "SHAFT + SPACER LAYOUT", "SH-001",
                 material="EN19 / C45 Steel", hardness="HRC 28-32",
                 scale="1:2", x0=-20, y0=-80)

    path = os.path.join(session_dir, "shaft_layout.dxf")
    doc.saveas(path)
    return path


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# MACHINE ASSEMBLY OVERVIEW DXF
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def generate_assembly_dxf(
    session_dir: str,
    n_stations: int,
    stand_spacing_mm: float,
    section_w: float,
    section_h: float,
    layout: Dict[str, Any],
) -> str:
    """Generate assembly.dxf â€” top-view machine layout plan."""
    doc = _new_dxf()
    msp = doc.modelspace()

    stand_w = 80.0   # stand footprint width
    stand_h = 200.0  # stand footprint depth
    spacing = stand_spacing_mm

    total_len = n_stations * spacing + stand_w

    # Floor line
    msp.add_line((-50, 0), (total_len + 50, 0), dxfattribs={"layer": "CENTRE"})

    # Entry guide
    msp.add_lwpolyline(
        [(-80, 20), (-20, 20), (-20, 80), (-80, 80)],
        close=True, dxfattribs={"layer": "OUTLINE"},
    )
    msp.add_text("ENTRY GUIDE", dxfattribs={"layer": "NOTES", "height": 4, "insert": (-80, 85)})

    # Stands
    for i in range(n_stations):
        sx = i * spacing + 10
        msp.add_lwpolyline(
            [(sx, 0), (sx + stand_w, 0), (sx + stand_w, stand_h), (sx, stand_h)],
            close=True, dxfattribs={"layer": "OUTLINE"},
        )
        msp.add_text(
            f"S{i+1}", dxfattribs={"layer": "TITLE", "height": 6, "insert": (sx + 15, stand_h / 2)},
        )
        # Roll indication
        msp.add_circle((sx + stand_w / 2, stand_h / 2), stand_w * 0.4,
                        dxfattribs={"layer": "HATCH"})
        # Stand spacing dim
        if i < n_stations - 1:
            _dim_horizontal(msp, sx + stand_w / 2, sx + spacing + stand_w / 2,
                            stand_h + 10, f"{spacing:.0f}")

    # Drive indication
    drive_type = layout.get("drive_type", "chain_drive")
    msp.add_text(
        f"DRIVE: {drive_type.replace('_', ' ').upper()}",
        dxfattribs={"layer": "NOTES", "height": 5, "insert": (0, stand_h + 50)},
    )
    msp.add_text(
        f"MOTOR: {layout.get('motor_label', 'N/A')}  |  LINE: {layout.get('total_line_length_m', 'N/A')} m",
        dxfattribs={"layer": "NOTES", "height": 4, "insert": (0, stand_h + 40)},
    )

    # Exit cutoff
    ex = n_stations * spacing + 30
    msp.add_lwpolyline(
        [(ex, 20), (ex + 60, 20), (ex + 60, 80), (ex, 80)],
        close=True, dxfattribs={"layer": "OUTLINE"},
    )
    msp.add_text("CUTOFF", dxfattribs={"layer": "NOTES", "height": 4, "insert": (ex, 85)})

    _title_block(msp, "MACHINE ASSEMBLY â€” PLAN VIEW", "ASM-001",
                 material="N/A", hardness="N/A", scale="1:20",
                 x0=-50, y0=-50)

    path = os.path.join(session_dir, "assembly.dxf")
    doc.saveas(path)
    return path


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# STEP FILE WRITER (Custom AP203)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def _step_hollow_cylinder(
    entity_id_start: int,
    od_mm: float,
    bore_mm: float,
    length_mm: float,
    part_name: str,
) -> tuple[str, int]:
    """
    Generate STEP AP203 text for a hollow cylinder (roll body).
    Returns (step_data_section_text, next_entity_id).
    
    AP203 geometry:
      - Two cartesian points for axis origin + direction
      - Outer cylindrical surface + inner cylindrical surface
      - Two flat face surfaces (top + bottom)
      - Closed shell â†’ manifold solid
    """
    i = entity_id_start
    od_r  = od_mm / 2.0
    id_r  = bore_mm / 2.0
    lines: List[str] = []

    # Geometric context
    lines.append(f"#{i} = GEOMETRIC_REPRESENTATION_CONTEXT(3);")
    ctx = i; i += 1

    # Axis placement (origin)
    lines.append(f"#{i} = CARTESIAN_POINT('',(0.,0.,0.));")
    origin = i; i += 1
    lines.append(f"#{i} = DIRECTION('',(0.,0.,1.));")
    z_dir = i; i += 1
    lines.append(f"#{i} = DIRECTION('',(1.,0.,0.));")
    x_dir = i; i += 1
    lines.append(f"#{i} = AXIS2_PLACEMENT_3D('',#{origin},#{z_dir},#{x_dir});")
    axis = i; i += 1

    # Outer cylindrical surface
    lines.append(f"#{i} = CYLINDRICAL_SURFACE('OUTER',#{axis},{od_r:.4f});")
    outer_surf = i; i += 1

    # Inner cylindrical surface
    lines.append(f"#{i} = CYLINDRICAL_SURFACE('BORE',#{axis},{id_r:.4f});")
    inner_surf = i; i += 1

    # Top plane (z = length_mm)
    lines.append(f"#{i} = CARTESIAN_POINT('',(0.,0.,{length_mm:.4f}));")
    top_origin = i; i += 1
    lines.append(f"#{i} = AXIS2_PLACEMENT_3D('TOP',#{top_origin},#{z_dir},#{x_dir});")
    top_axis = i; i += 1
    lines.append(f"#{i} = PLANE('TOP_FACE',#{top_axis});")
    top_plane = i; i += 1

    # Bottom plane (z=0)
    lines.append(f"#{i} = PLANE('BOT_FACE',#{axis});")
    bot_plane = i; i += 1

    # Outer edge circles
    lines.append(f"#{i} = CIRCLE('OD_TOP',#{top_axis},{od_r:.4f});")
    od_top = i; i += 1
    lines.append(f"#{i} = CIRCLE('OD_BOT',#{axis},{od_r:.4f});")
    od_bot = i; i += 1

    # Inner edge circles
    lines.append(f"#{i} = CIRCLE('ID_TOP',#{top_axis},{id_r:.4f});")
    id_top = i; i += 1
    lines.append(f"#{i} = CIRCLE('ID_BOT',#{axis},{id_r:.4f});")
    id_bot = i; i += 1

    # Edge curves (outer)
    lines.append(f"#{i} = EDGE_CURVE('',#{od_top},#{od_top},#{outer_surf},.T.);")
    outer_edge_top = i; i += 1
    lines.append(f"#{i} = EDGE_CURVE('',#{od_bot},#{od_bot},#{outer_surf},.T.);")
    outer_edge_bot = i; i += 1

    # Simplified product / shape representation
    lines.append(f"#{i} = PRODUCT('{part_name}','{part_name}','Roll tooling',(#1));")
    prod = i; i += 1
    lines.append(f"#{i} = PRODUCT_DEFINITION_FORMATION('','',#{prod});")
    pdf = i; i += 1
    lines.append(f"#{i} = PRODUCT_DEFINITION('design','',#{pdf},#2);")
    pd = i; i += 1
    lines.append(f"#{i} = PRODUCT_DEFINITION_SHAPE('','',#{pd});")
    pds = i; i += 1

    # Shape representation with key dimensions noted in description
    lines.append(
        f"#{i} = SHAPE_REPRESENTATION('{part_name}',"
        f"(#{axis},#{outer_surf},#{inner_surf},#{top_plane},#{bot_plane}),"
        f"#{ctx});"
    )
    shape_rep = i; i += 1

    lines.append(f"#{i} = SHAPE_DEFINITION_REPRESENTATION(#{pds},#{shape_rep});")
    i += 1

    return "\n".join(lines), i


def _export_roll_step_with_cadquery(roll: Dict[str, Any], fpath: str) -> tuple[bool, str]:
    """
    Try contour-driven STEP export via CadQuery.
    Returns (used_cadquery, reason).
    """
    try:
        import cadquery as cq  # type: ignore
        from cadquery import exporters as cq_exporters  # type: ignore
    except Exception as e:
        return False, f"cadquery_unavailable: {e}"

    top = _extract_xy_points(roll.get("top_roll_contour"))
    bottom = _extract_xy_points(roll.get("bottom_roll_contour"))
    if len(top) < 2 or len(bottom) < 2:
        return False, "missing_contour_profiles"

    # Build closed 2D profile from top and bottom contours.
    profile_2d = top + list(reversed(bottom))
    if len(profile_2d) < 3:
        return False, "insufficient_profile_points"

    # Remove accidental consecutive duplicates (can break polyline->wire).
    cleaned: List[Tuple[float, float]] = []
    for pt in profile_2d:
        if not cleaned or (abs(cleaned[-1][0] - pt[0]) > 1e-9 or abs(cleaned[-1][1] - pt[1]) > 1e-9):
            cleaned.append(pt)
    if len(cleaned) < 3:
        return False, "degenerate_profile_after_cleanup"

    face_w = max(_safe_float(roll.get("face_width_mm"), 0.0), 1.0)
    bore = max(_safe_float(roll.get("bore_mm"), 0.0), 0.0)

    try:
        solid = cq.Workplane("XY").polyline(cleaned).close().extrude(face_w)
        if bore > 0:
            solid = solid.faces(">Z").workplane().circle(bore / 2.0).cutThruAll()
        cq_exporters.export(solid, fpath)
        return True, "contour_step_generated"
    except Exception as e:
        return False, f"cadquery_export_failed: {e}"


def generate_step_files(
    session_dir: str,
    rolls: List[Dict[str, Any]],
    shaft_dia: float,
    shaft_length_mm: float,
    project_info: Dict[str, Any],
) -> Dict[str, Any]:
    """Generate one STEP file per roll + one shaft STEP file."""
    paths: List[str] = []
    step_warnings: List[str] = []
    mode_counts: Dict[str, int] = {
        "contour_exported": 0,
        "contour_missing_or_failed": 0,
        "shaft_exported": 0,
    }

    # Standard STEP header
    def _header(part_name: str) -> str:
        return (
            "ISO-10303-21;\n"
            "HEADER;\n"
            "FILE_DESCRIPTION(('SAI ROLOTECH ROLL TOOLING'),'2;1');\n"
            f"FILE_NAME('{part_name}.stp','2026-01-01',('SAI ROLOTECH'),(''),\n"
            "  'SAI ROLOTECH SMART ENGINES v2.3.0','','');\n"
            "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\n"
            "ENDSEC;\n"
        )

    def _application_context() -> str:
        return (
            "DATA;\n"
            "#1 = APPLICATION_CONTEXT('automotive design');\n"
            "#2 = PRODUCT_CONTEXT('',#1,'mechanical');\n"
        )

    for roll in rolls:
        sno  = roll.get("station_no", 1)
        fname = f"roll_s{sno:02d}.stp"
        fpath = os.path.join(session_dir, fname)

        used_cq, reason = _export_roll_step_with_cadquery(roll, fpath)
        if used_cq:
            mode_counts["contour_exported"] += 1
            paths.append(fpath)
            continue
        mode_counts["contour_missing_or_failed"] += 1
        step_warnings.append(
            f"roll_s{sno:02d}: contour STEP not generated ({reason}); "
            "placeholder cylinder fallback disabled."
        )

    # Shaft STEP
    shaft_part = "SHAFT_ASSEMBLY"
    shaft_body, _ = _step_hollow_cylinder(
        3, shaft_dia + 0.001, shaft_dia * 0.2, shaft_length_mm, shaft_part
    )
    shaft_content = (
        _header(shaft_part)
        + _application_context()
        + shaft_body + "\n"
        + "ENDSEC;\nEND-ISO-10303-21;\n"
    )
    shaft_path = os.path.join(session_dir, "shaft.stp")
    with open(shaft_path, "w") as f:
        f.write(shaft_content)
    paths.append(shaft_path)
    mode_counts["shaft_exported"] += 1

    return {
        "paths": paths,
        "mode_counts": mode_counts,
        "warnings": step_warnings,
    }


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# MAIN ENGINE ENTRY POINT
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def generate_cad_export(
    roll_contour_result: Dict[str, Any],
    cam_prep_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
    bearing_result: Dict[str, Any],
    roll_calc_result: Dict[str, Any],
    station_result: Dict[str, Any],
    profile_result: Dict[str, Any],
    machine_layout_result: Dict[str, Any],
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate complete CAD export pack:
      - roll_set.dxf
      - shaft_layout.dxf
      - assembly.dxf
      - roll_s01.stp ... roll_sNN.stp
      - shaft.stp
    """
    if not session_id:
        session_id = f"{int(time.time())}_{uuid.uuid4().hex[:6]}"

    session_dir = os.path.join(EXPORTS_DIR, session_id)
    _ensure_dir(session_dir)

    shaft_dia     = float(shaft_result.get("suggested_shaft_diameter_mm", 50))
    n_stations    = int(station_result.get("recommended_station_count", 6))
    section_w     = float(profile_result.get("section_width_mm", 100))
    section_h     = float(profile_result.get("section_height_mm", 40))
    stand_spacing = float(machine_layout_result.get("stand_spacing_mm", 500))
    bearing_type  = bearing_result.get("suggested_bearing_type", "6210")

    rolls = _build_export_rolls(
        roll_contour_result=roll_contour_result,
        cam_prep_result=cam_prep_result,
        shaft_dia=shaft_dia,
    )
    keyway     = cam_prep_result.get("keyway", {})
    hardness   = cam_prep_result.get("hardness_hrc", 58)
    roll_mat   = cam_prep_result.get("roll_material", "EN31")

    project_info = {
        "hardness_hrc": hardness,
        "roll_material": roll_mat,
        "shaft_dia": shaft_dia,
    }

    # Total shaft length estimate
    shaft_length = sum(r.get("face_width_mm", 40) for r in rolls) + 2 * 30  # +2 bearing seats

    files: Dict[str, Any] = {}
    errors: List[str] = []
    step_mode_counts: Dict[str, int] = {"contour_exported": 0, "contour_missing_or_failed": 0, "shaft_exported": 0}
    step_warnings: List[str] = []
    contour_warnings: List[str] = []

    if not rolls:
        errors.append("No contour-derived roll stations available for CAD export.")

    exported_station_set = sorted({
        int(r.get("station_no", -1))
        for r in rolls
        if isinstance(r.get("station_no"), (int, float)) and int(r.get("station_no", -1)) > 0
    })
    expected_station_set = list(range(1, max(n_stations, 0) + 1))
    missing_station_set = [s for s in expected_station_set if s not in exported_station_set]
    if missing_station_set:
        errors.append(
            f"Contour-derived station coverage incomplete. Missing stations: {missing_station_set}"
        )

    missing_contour_stations: List[int] = []
    for r in rolls:
        if r.get("top_roll_contour") or r.get("bottom_roll_contour"):
            continue
        try:
            sno = int(r.get("station_no", -1))
        except (TypeError, ValueError):
            continue
        if sno > 0:
            missing_contour_stations.append(sno)
    missing_contour_stations = sorted(set(missing_contour_stations))
    if missing_contour_stations:
        contour_warnings.append(
            f"Missing top/bottom contour payload for station(s): {missing_contour_stations}"
        )

    # â”€â”€ DXF: Roll set â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        files["roll_set_dxf"] = generate_roll_set_dxf(
            session_dir, rolls, shaft_dia, keyway, project_info
        )
    except Exception as e:
        errors.append(f"roll_set.dxf: {e}")
        logger.exception("[cad_export] roll_set.dxf failed: %s", e)

    # â”€â”€ DXF: Shaft layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        files["shaft_layout_dxf"] = generate_shaft_layout_dxf(
            session_dir, shaft_dia, rolls, bearing_type, keyway, project_info
        )
    except Exception as e:
        errors.append(f"shaft_layout.dxf: {e}")
        logger.exception("[cad_export] shaft_layout.dxf failed: %s", e)

    # â”€â”€ DXF: Assembly â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        files["assembly_dxf"] = generate_assembly_dxf(
            session_dir, n_stations, stand_spacing, section_w, section_h,
            machine_layout_result,
        )
    except Exception as e:
        errors.append(f"assembly.dxf: {e}")
        logger.exception("[cad_export] assembly.dxf failed: %s", e)

    # â”€â”€ STEP files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        step_result = generate_step_files(
            session_dir, rolls, shaft_dia, shaft_length, project_info
        )
        files["step_files"] = step_result.get("paths", [])
        step_mode_counts = step_result.get("mode_counts", step_mode_counts)
        step_warnings = step_result.get("warnings", [])
        missing_roll_steps = max(0, len(rolls) - step_mode_counts.get("contour_exported", 0))
        if missing_roll_steps > 0:
            errors.append(
                f"STEP contour export incomplete: {missing_roll_steps} roll station(s) have no contour STEP file."
            )
    except Exception as e:
        errors.append(f"STEP: {e}")
        logger.exception("[cad_export] STEP failed: %s", e)

    # Build file manifest
    manifest: List[Dict[str, str]] = []
    for key, val in files.items():
        if key == "step_files":
            for sp in (val if isinstance(val, list) else []):
                manifest.append({
                    "type":     "STEP",
                    "filename": os.path.basename(sp),
                    "path":     sp,
                    "purpose":  "SolidWorks / SolidCAM import",
                })
        else:
            manifest.append({
                "type":     "DXF",
                "filename": os.path.basename(val),
                "path":     val,
                "purpose":  {"roll_set_dxf": "Roll part drawings",
                             "shaft_layout_dxf": "Shaft + spacer layout",
                             "assembly_dxf": "Machine assembly plan"}.get(key, ""),
            })

    logger.info(
        "[cad_export] session=%s files=%d errors=%d",
        session_id, len(manifest), len(errors),
    )

    return {
        "status":      "pass" if not errors else "partial",
        "engine":      "cad_export_engine",
        "session_id":  session_id,
        "session_dir": session_dir,
        "total_files": len(manifest),
        "file_manifest": manifest,
        "errors":      errors,
        "warnings": contour_warnings + step_warnings,
        "summary": {
            "dxf_files": sum(1 for m in manifest if m["type"] == "DXF"),
            "step_files": sum(1 for m in manifest if m["type"] == "STEP"),
            "roll_count": len(rolls),
            "contour_driven_rolls": sum(1 for r in rolls if r.get("top_roll_contour") or r.get("bottom_roll_contour")),
            "step_contour_export_count": step_mode_counts.get("contour_exported", 0),
            "step_contour_missing_count": step_mode_counts.get("contour_missing_or_failed", 0),
            "step_shaft_export_count": step_mode_counts.get("shaft_exported", 0),
            "shaft_dia_mm": shaft_dia,
            "stand_count": n_stations,
            "exported_station_set": exported_station_set,
            "missing_station_set": missing_station_set,
        },
        "capabilities": {
            "dxf_export_supported": True,
            "step_export_supported": True,
            "step_export_mode": "contour_required_no_placeholder_fallback",
            "step_roll_export_complete": step_mode_counts.get("contour_exported", 0) == len(rolls),
            "dwg_export_supported": False,
            "dwg_export_note": "Native DWG writer not implemented in cad_export_engine (DXF + STEP only).",
        },
    }

