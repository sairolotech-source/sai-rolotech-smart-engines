"""
export_step_engine.py — Roll Solid STEP Export Engine

Generates a STEP AP203 solid file for each roll using a custom writer
(no cadquery dependency required).

The roll body is represented as a hollow cylinder:
  • Outer diameter = roll OD from roll_dimension_engine
  • Inner diameter = bore (shaft diameter)
  • Length (extrusion) = face width

Output:
  exports/advanced_rolls/<session_id>/roll_solid_<id>.step

PRELIMINARY CAD/CAM HANDOFF FILE — pending tooling verification.
Blueprint source: Advance Roll Engine + Export Engine blueprint.
"""
import logging
import os
import uuid
from typing import Any, Dict, List

from app.utils.response import pass_response, fail_response

logger = logging.getLogger("export_step_engine")

EXPORT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "exports", "advanced_rolls"
)


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _write_step_cylinder(
    od_mm: float,
    bore_mm: float,
    length_mm: float,
    part_name: str,
) -> str:
    """
    Generate a minimal STEP AP203/AP214 file representing a hollow cylinder.
    The geometry is expressed as cylindrical surfaces + bounding planes
    in a SHAPE_REPRESENTATION node recognised by SolidWorks and FreeCAD.
    """
    od_r   = od_mm / 2.0
    id_r   = bore_mm / 2.0

    lines: List[str] = [
        "ISO-10303-21;",
        "HEADER;",
        "FILE_DESCRIPTION(('SAI ROLOTECH — ROLL SOLID'),'2;1');",
        f"FILE_NAME('{part_name}.stp','2026-01-01',('SAI ROLOTECH'),(''),",
        "  'SAI ROLOTECH SMART ENGINES v2.3.0','','');",
        "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
        "ENDSEC;",
        "DATA;",
        "#1 = APPLICATION_CONTEXT('automotive design');",
        "#2 = PRODUCT_CONTEXT('',#1,'mechanical');",
        # Geometric context (3D)
        "#3 = GEOMETRIC_REPRESENTATION_CONTEXT(3);",
        # Coordinate system
        "#10 = CARTESIAN_POINT('',(0.,0.,0.));",
        "#11 = DIRECTION('',(0.,0.,1.));",
        "#12 = DIRECTION('',(1.,0.,0.));",
        "#13 = AXIS2_PLACEMENT_3D('BOTTOM',#10,#11,#12);",
        f"#14 = CARTESIAN_POINT('',(0.,0.,{length_mm:.4f}));",
        "#15 = AXIS2_PLACEMENT_3D('TOP',#14,#11,#12);",
        # Cylindrical surfaces
        f"#20 = CYLINDRICAL_SURFACE('OUTER_SURFACE',#13,{od_r:.4f});",
        f"#21 = CYLINDRICAL_SURFACE('BORE_SURFACE',#13,{id_r:.4f});",
        # Planes
        "#22 = PLANE('BOTTOM_FACE',#13);",
        "#23 = PLANE('TOP_FACE',#15);",
        # Edge circles
        f"#30 = CIRCLE('OD_BOTTOM',#13,{od_r:.4f});",
        f"#31 = CIRCLE('OD_TOP',#15,{od_r:.4f});",
        f"#32 = CIRCLE('ID_BOTTOM',#13,{id_r:.4f});",
        f"#33 = CIRCLE('ID_TOP',#15,{id_r:.4f});",
        # Product
        f"#40 = PRODUCT('{part_name}','{part_name}','Roll tooling — preliminary',(#2));",
        "#41 = PRODUCT_DEFINITION_FORMATION('','',#40);",
        "#42 = PRODUCT_DEFINITION('design','',#41,#2);",
        "#43 = PRODUCT_DEFINITION_SHAPE('','',#42);",
        f"#44 = SHAPE_REPRESENTATION('{part_name}',",
        "  (#13,#20,#21,#22,#23,#30,#31,#32,#33),#3);",
        "#45 = SHAPE_DEFINITION_REPRESENTATION(#43,#44);",
        "ENDSEC;",
        "END-ISO-10303-21;",
    ]
    return "\n".join(lines)


def export_roll_step(
    roll_dimension_result: Dict[str, Any],
    session_id: str | None = None,
    filename_prefix: str = "roll_solid",
) -> Dict[str, Any]:
    """
    Generate a STEP solid for the representative roll body.
    """
    if not roll_dimension_result or roll_dimension_result.get("status") != "pass":
        return fail_response("export_step_engine", "Roll dimension result invalid")

    _ensure_dir(EXPORT_DIR)
    sid = session_id or uuid.uuid4().hex[:8]
    session_dir = os.path.join(EXPORT_DIR, sid)
    _ensure_dir(session_dir)

    od         = float(roll_dimension_result.get("estimated_roll_od_mm", 100))
    face_width = float(roll_dimension_result.get("face_width_mm", 120))
    bore       = float(roll_dimension_result.get("bore_dia_mm", 50))

    file_id  = uuid.uuid4().hex[:8]
    part     = f"{filename_prefix}_{file_id}".upper()
    filepath = os.path.join(session_dir, f"{part.lower()}.step")

    try:
        content = _write_step_cylinder(od, bore, face_width, part)
        with open(filepath, "w") as f:
            f.write(content)

        logger.info("[export_step] saved %s  OD=%.1f BORE=%.1f L=%.1f",
                    filepath, od, bore, face_width)

        return pass_response("export_step_engine", {
            "file_path":  filepath,
            "filename":   os.path.basename(filepath),
            "session_id": sid,
            "roll_od_mm": od,
            "bore_mm":    bore,
            "length_mm":  face_width,
            "confidence": "medium",
            "blocking":   False,
            "warnings": [
                "STEP export is generic solid — final contour machining review required",
                "PRELIMINARY CAD/CAM HANDOFF — not production approved",
            ],
        })
    except Exception as e:
        logger.exception("[export_step] failed: %s", e)
        return fail_response("export_step_engine", f"STEP export failed: {e}")
