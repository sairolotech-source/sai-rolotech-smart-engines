"""
routes.py — FastAPI route definitions.
Two modes:
  POST /api/auto-mode   — full pipeline from entity list (or DXF upload)
  POST /api/manual-mode — pipeline from manual profile dimensions
  POST /api/dxf-upload  — DXF file upload → full pipeline
  GET  /api/health      — server health check
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.api.schemas import AutoModeInput, ManualProfileInput
from app.engines.import_engine import parse_entities, parse_dxf_bytes
from app.engines.geometry_engine import clean_geometry
from app.engines.profile_analysis_engine import analyze_profile
from app.engines.input_engine import validate_inputs
from app.engines.flower_pattern_engine import generate as generate_flower
from app.engines.station_engine import estimate as estimate_station
from app.engines.roll_logic_engine import generate as generate_roll_logic
from app.engines.shaft_engine import select_shaft
from app.engines.bearing_engine import select_bearing
from app.engines.duty_engine import classify as classify_duty

router = APIRouter(prefix="/api", tags=["roll-forming"])
logger = logging.getLogger("routes")


def is_fail(result: Dict[str, Any]) -> bool:
    return result.get("status") == "fail"


def fail_at(stage: str, result: Dict[str, Any]) -> Dict[str, Any]:
    logger.warning("Pipeline stopped at stage '%s': %s", stage, result.get("reason", ""))
    return {
        "status": "fail",
        "failed_stage": stage,
        "result": result,
    }


def run_pipeline_from_geometry(
    geometry_entities,
    thickness: float,
    material: str,
) -> Dict[str, Any]:
    """Core pipeline shared by auto-mode and dxf-upload."""

    import_result = parse_entities(geometry_entities)
    if is_fail(import_result):
        return fail_at("file_import_engine", import_result)

    geometry_result = clean_geometry(import_result["geometry"])
    if is_fail(geometry_result):
        return fail_at("geometry_engine", geometry_result)

    profile_result = analyze_profile(geometry_result)
    if is_fail(profile_result):
        return fail_at("profile_analysis_engine", profile_result)

    input_result = validate_inputs(thickness, material)
    if is_fail(input_result):
        return fail_at("input_engine", input_result)

    flower_result = generate_flower(profile_result, input_result)
    if is_fail(flower_result):
        return fail_at("flower_pattern_engine", flower_result)

    station_result = estimate_station(profile_result, input_result, flower_result)
    roll_logic_result = generate_roll_logic(profile_result, flower_result, station_result)
    shaft_result = select_shaft(profile_result, input_result, station_result)
    bearing_result = select_bearing(shaft_result, input_result)
    duty_result = classify_duty(profile_result, input_result, station_result, shaft_result)

    return {
        "status": "pass",
        "file_import_engine": import_result,
        "geometry_engine": geometry_result,
        "profile_analysis_engine": profile_result,
        "input_engine": input_result,
        "flower_pattern_engine": flower_result,
        "station_engine": station_result,
        "roll_logic_engine": roll_logic_result,
        "shaft_engine": shaft_result,
        "bearing_engine": bearing_result,
        "duty_engine": duty_result,
    }


# ─── GET /api/health ──────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "pass", "service": "python-fastapi", "version": "2.2.0"}


# ─── POST /api/auto-mode ─────────────────────────────────────────────────────

@router.post("/auto-mode")
def run_auto_mode(data: AutoModeInput):
    logger.info(
        "[auto-mode] thickness=%.2f material=%s entities=%d",
        data.thickness, data.material, len(data.entities or []),
    )
    return run_pipeline_from_geometry(data.entities or [], data.thickness, data.material)


# ─── POST /api/dxf-upload ────────────────────────────────────────────────────

@router.post("/dxf-upload")
async def dxf_upload(
    thickness: float,
    material: str,
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Only .dxf files accepted")

    dxf_bytes = await file.read()
    logger.info("[dxf-upload] file=%s size=%d thickness=%.2f material=%s",
                file.filename, len(dxf_bytes), thickness, material)

    import_result = parse_dxf_bytes(dxf_bytes)
    if is_fail(import_result):
        return fail_at("file_import_engine", import_result)

    geometry_result = clean_geometry(import_result["geometry"])
    if is_fail(geometry_result):
        return fail_at("geometry_engine", geometry_result)

    profile_result = analyze_profile(geometry_result)
    if is_fail(profile_result):
        return fail_at("profile_analysis_engine", profile_result)

    input_result = validate_inputs(thickness, material)
    if is_fail(input_result):
        return fail_at("input_engine", input_result)

    flower_result = generate_flower(profile_result, input_result)
    if is_fail(flower_result):
        return fail_at("flower_pattern_engine", flower_result)

    station_result = estimate_station(profile_result, input_result, flower_result)
    roll_logic_result = generate_roll_logic(profile_result, flower_result, station_result)
    shaft_result = select_shaft(profile_result, input_result, station_result)
    bearing_result = select_bearing(shaft_result, input_result)
    duty_result = classify_duty(profile_result, input_result, station_result, shaft_result)

    return {
        "status": "pass",
        "source_file": file.filename,
        "file_import_engine": import_result,
        "geometry_engine": geometry_result,
        "profile_analysis_engine": profile_result,
        "input_engine": input_result,
        "flower_pattern_engine": flower_result,
        "station_engine": station_result,
        "roll_logic_engine": roll_logic_result,
        "shaft_engine": shaft_result,
        "bearing_engine": bearing_result,
        "duty_engine": duty_result,
    }


# ─── POST /api/manual-mode ───────────────────────────────────────────────────

@router.post("/manual-mode")
def run_manual_mode(data: ManualProfileInput):
    logger.info(
        "[manual-mode] bends=%d w=%.1f h=%.1f thickness=%.2f material=%s",
        data.bend_count, data.section_width_mm, data.section_height_mm,
        data.thickness, data.material,
    )

    input_result = validate_inputs(data.thickness, data.material)
    if is_fail(input_result):
        return fail_at("input_engine", input_result)

    from app.utils.engineering_rules import classify_complexity, COMPLEXITY_LABELS
    complexity = classify_complexity(data.bend_count)

    profile_result = {
        "status": "pass",
        "engine": "profile_analysis_engine",
        "bend_count": data.bend_count,
        "bends": [],
        "section_width_mm": data.section_width_mm,
        "section_height_mm": data.section_height_mm,
        "profile_type": data.profile_type or COMPLEXITY_LABELS[complexity],
        "complexity_tier": complexity,
        "profile_open": True,
        "return_bends_count": 0,
        "symmetry_status": "unknown",
    }

    flower_result = generate_flower(profile_result, input_result)
    if is_fail(flower_result):
        return fail_at("flower_pattern_engine", flower_result)

    station_result = estimate_station(profile_result, input_result, flower_result)
    roll_logic_result = generate_roll_logic(profile_result, flower_result, station_result)
    shaft_result = select_shaft(profile_result, input_result, station_result)
    bearing_result = select_bearing(shaft_result, input_result)
    duty_result = classify_duty(profile_result, input_result, station_result, shaft_result)

    return {
        "status": "pass",
        "profile_analysis_engine": profile_result,
        "input_engine": input_result,
        "flower_pattern_engine": flower_result,
        "station_engine": station_result,
        "roll_logic_engine": roll_logic_result,
        "shaft_engine": shaft_result,
        "bearing_engine": bearing_result,
        "duty_engine": duty_result,
    }
