"""
import_engine.py — File Import Engine
Accepts DXF file bytes or raw entity list. Uses ezdxf for real parsing.
"""
import io
import logging
from typing import Any, Dict, List, Optional

from app.utils.response import pass_response, fail_response

logger = logging.getLogger("import_engine")


def parse_entities(entities: Optional[List[Dict[str, Any]]]) -> Dict[str, Any]:
    """Accept pre-parsed entity list (from manual or auto mode)."""
    logger.debug("[import_engine] parse_entities called, count=%s", len(entities) if entities else 0)

    if not entities:
        logger.warning("[import_engine] No entities received")
        return fail_response("file_import_engine", "No geometry/entities received")

    return pass_response("file_import_engine", {
        "notes": ["Entities accepted"],
        "geometry": entities,
        "entity_count": len(entities),
    })


def parse_dxf_bytes(dxf_bytes: bytes) -> Dict[str, Any]:
    """Parse raw DXF bytes using ezdxf and extract LINE + ARC entities."""
    logger.debug("[import_engine] parse_dxf_bytes called, size=%d bytes", len(dxf_bytes))
    try:
        import ezdxf
        doc = ezdxf.read(io.StringIO(dxf_bytes.decode("utf-8", errors="replace")))
        msp = doc.modelspace()
        entities: List[Dict[str, Any]] = []

        for e in msp:
            if e.dxftype() == "LINE":
                s = e.dxf.start
                en = e.dxf.end
                entities.append({
                    "type": "line",
                    "start": [round(s.x, 4), round(s.y, 4)],
                    "end": [round(en.x, 4), round(en.y, 4)],
                })
            elif e.dxftype() == "ARC":
                c = e.dxf.center
                entities.append({
                    "type": "arc",
                    "center": [round(c.x, 4), round(c.y, 4)],
                    "radius": round(e.dxf.radius, 4),
                    "start_angle": round(e.dxf.start_angle, 4),
                    "end_angle": round(e.dxf.end_angle, 4),
                })
            elif e.dxftype() == "LWPOLYLINE":
                pts = list(e.get_points())
                for i in range(len(pts) - 1):
                    entities.append({
                        "type": "line",
                        "start": [round(pts[i][0], 4), round(pts[i][1], 4)],
                        "end": [round(pts[i + 1][0], 4), round(pts[i + 1][1], 4)],
                    })
                if e.closed and len(pts) > 1:
                    entities.append({
                        "type": "line",
                        "start": [round(pts[-1][0], 4), round(pts[-1][1], 4)],
                        "end": [round(pts[0][0], 4), round(pts[0][1], 4)],
                    })

        if not entities:
            logger.warning("[import_engine] DXF parsed but no usable entities found")
            return fail_response("file_import_engine", "DXF parsed but no LINE/ARC/LWPOLYLINE entities found")

        logger.info("[import_engine] DXF parsed: %d entities", len(entities))
        return pass_response("file_import_engine", {
            "notes": ["DXF parsed via ezdxf"],
            "geometry": entities,
            "entity_count": len(entities),
        })
    except Exception as exc:
        logger.error("[import_engine] DXF parse error: %s", exc)
        return fail_response("file_import_engine", f"DXF parse failed: {exc}")
