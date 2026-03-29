"""
export_dxf_engine.py — Advanced Roll DXF Export Engine

Creates a 2D roll drawing pack as a DXF file using ezdxf.
Each stand gets its own upper + lower roll profile polylines
with stand number, OD, face width, and gap annotations.

Output:
  exports/advanced_rolls/<session_id>/roll_set_<id>.dxf

PRELIMINARY CAD/CAM HANDOFF FILE — pending tooling verification.
Blueprint source: Advance Roll Engine + Export Engine blueprint.
"""
import logging
import os
import uuid
from typing import Any, Dict, List, Tuple

import ezdxf

from app.utils.response import pass_response, fail_response

logger = logging.getLogger("export_dxf_engine")

Point = Tuple[float, float]
EXPORT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "exports", "advanced_rolls"
)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _shift_points(points: List[Any], dx: float, dy: float) -> List[Tuple[float, float]]:
    """Accept both dict-points {x,y} and tuple-points (x,y)."""
    out = []
    for p in points:
        if isinstance(p, dict):
            out.append((p["x"] + dx, p["y"] + dy))
        else:
            out.append((p[0] + dx, p[1] + dy))
    return out


def _draw_polyline(msp: Any, points: List[Tuple[float, float]], layer: str = "PROFILE") -> None:
    if len(points) >= 2:
        msp.add_lwpolyline(points, dxfattribs={"layer": layer})


def export_rolls_dxf(
    advanced_roll_result: Dict[str, Any],
    roll_dimension_result: Dict[str, Any],
    session_id: str | None = None,
    filename_prefix: str = "roll_set",
) -> Dict[str, Any]:
    """
    Generate DXF with upper + lower roll profiles for every stand.
    """
    if not advanced_roll_result or advanced_roll_result.get("status") != "pass":
        return fail_response("export_dxf_engine", "Advanced roll result invalid")

    _ensure_dir(EXPORT_DIR)
    sid      = session_id or uuid.uuid4().hex[:8]
    session_dir = os.path.join(EXPORT_DIR, sid)
    _ensure_dir(session_dir)

    file_id  = uuid.uuid4().hex[:8]
    filepath = os.path.join(session_dir, f"{filename_prefix}_{file_id}.dxf")

    try:
        doc = ezdxf.new("R2010")
        doc.layers.add("PROFILE",    color=7)   # white
        doc.layers.add("UPPER",      color=5)   # blue
        doc.layers.add("LOWER",      color=3)   # green
        doc.layers.add("CENTRE",     color=1)   # red
        doc.layers.add("ANNOTATION", color=2)   # yellow
        msp = doc.modelspace()

        stand_data  = advanced_roll_result.get("stand_data", [])
        roll_od     = float(roll_dimension_result.get("estimated_roll_od_mm", 100))
        face_width  = float(roll_dimension_result.get("face_width_mm", 120))
        forming_gap = float(advanced_roll_result.get("forming_gap_mm", 1.1))
        springback  = float(advanced_roll_result.get("springback_deg", 2.0))

        Y_STEP = 120.0  # vertical spacing between stands
        y_offset = 0.0

        for stand in stand_data:
            sno  = stand.get("stand_no", "?")
            upper_pts = _shift_points(stand.get("upper_profile", []), 0.0, y_offset)
            lower_pts = _shift_points(stand.get("lower_profile", []), 0.0, y_offset)

            _draw_polyline(msp, upper_pts, layer="UPPER")
            _draw_polyline(msp, lower_pts, layer="LOWER")

            # Centre line between profiles
            if upper_pts and lower_pts:
                cx = (upper_pts[0][0] + upper_pts[-1][0]) / 2
                msp.add_line(
                    (cx - 10, y_offset), (cx + 10, y_offset),
                    dxfattribs={"layer": "CENTRE", "linetype": "CENTER"},
                )

            # Annotations
            msp.add_text(
                f"Stand {sno}  |  OD={roll_od:.0f} mm  |  Face={face_width:.0f} mm",
                dxfattribs={"layer": "ANNOTATION", "height": 4.5},
            ).set_placement((0, y_offset + 55))

            msp.add_text(
                f"Gap={forming_gap:.3f} mm  |  Springback={springback}°  |  Ratio={stand.get('pass_ratio',0):.3f}",
                dxfattribs={"layer": "ANNOTATION", "height": 3.5},
            ).set_placement((0, y_offset + 47))

            for i, note in enumerate(stand.get("profile_notes", [])[:2]):
                msp.add_text(
                    note,
                    dxfattribs={"layer": "ANNOTATION", "height": 3.0},
                ).set_placement((0, y_offset + 38 - i * 6))

            y_offset += Y_STEP

        # Title block
        msp.add_text(
            "SAI ROLOTECH SMART ENGINES v2.3.0 — ADVANCED ROLL DXF PACK",
            dxfattribs={"layer": "ANNOTATION", "height": 6},
        ).set_placement((0, y_offset + 20))
        msp.add_text(
            "PRELIMINARY CAD/CAM HANDOFF FILE — NOT PRODUCTION APPROVED",
            dxfattribs={"layer": "ANNOTATION", "height": 4},
        ).set_placement((0, y_offset + 10))

        doc.saveas(filepath)
        logger.info("[export_dxf] saved %s (%d stands)", filepath, len(stand_data))

        return pass_response("export_dxf_engine", {
            "file_path":   filepath,
            "filename":    os.path.basename(filepath),
            "session_id":  sid,
            "stand_count": len(stand_data),
            "confidence":  "high",
            "blocking":    False,
            "notes": ["PRELIMINARY DXF — upper/lower profile polylines per stand"],
        })
    except Exception as e:
        logger.exception("[export_dxf] failed: %s", e)
        return fail_response("export_dxf_engine", f"DXF export failed: {e}")
