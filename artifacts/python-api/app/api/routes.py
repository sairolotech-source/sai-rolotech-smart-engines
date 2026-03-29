"""
routes.py — FastAPI route definitions.

Modes:
  POST /api/auto-mode              — full pipeline from entity list
  POST /api/dxf-upload             — DXF file upload → full pipeline
  POST /api/manual-mode            — pipeline from manual profile dimensions
  POST /api/auto-mode-export-pdf   — auto pipeline + PDF report (JSON response)
  POST /api/manual-mode-export-pdf — manual pipeline + PDF report (JSON response)
  POST /api/manual-mode-download-pdf — manual pipeline → download PDF file
  GET  /api/health                 — server health check
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

from app.api.schemas import AutoModeInput, ManualProfileInput
from app.engines.import_engine import parse_entities, parse_dxf_bytes
from app.engines.geometry_engine import clean_geometry
from app.engines.profile_analysis_engine import analyze_profile
from app.engines.input_engine import validate_inputs
from app.engines.advanced_flower_engine import generate_advanced_flower as generate_flower
from app.engines.station_engine import estimate as estimate_station
from app.engines.roll_logic_engine import generate as generate_roll_logic
from app.engines.shaft_engine import select_shaft
from app.engines.bearing_engine import select_bearing
from app.engines.duty_engine import classify as classify_duty
from app.engines.roll_design_calc_engine import generate_roll_design_calc
from app.engines.report_engine import generate_report
from app.engines.pdf_export_engine import export_report_pdf
from app.engines.consistency_engine import validate_consistency
from app.engines.final_decision_engine import make_final_decision
from app.engines.flange_web_lip_engine import detect_flange_web_lip
from app.engines.machine_layout_engine import generate_machine_layout
from app.engines.debug_test_engine import extract_stage_debug
from app.engines.test_runner_engine import run_all_tests as _run_all_tests
from app.engines.roll_contour_engine import generate_roll_contour
from app.engines.cad_export_engine import generate_cad_export
from app.engines.cam_prep_engine import generate_cam_prep
from app.engines.advanced_roll_engine import generate_advanced_rolls
from app.engines.roll_interference_engine import check_roll_interference
from app.engines.roll_dimension_engine import generate_roll_dimensions
from app.engines.export_dxf_engine import export_rolls_dxf
from app.engines.export_step_engine import export_roll_step
from app.engines.export_pack_engine import build_export_pack
from app.engines.centerline_sheet_converter_arc_engine import (
    convert_centerline_to_sheet_arc_aware,
    is_centerline_geometry,
)
from app.engines.simulation_engine import run_simulation as run_sim_engine

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


def _run_core_engines(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Shared downstream engines:
    flange_web_lip → flower → stations → shaft/bearing/duty/roll
    → machine_layout → roll_contour → cam_prep
    """
    flange_result = detect_flange_web_lip(profile_result)

    flower_result = generate_flower(profile_result, input_result)
    if is_fail(flower_result):
        return fail_at("flower_pattern_engine", flower_result)

    station_result  = estimate_station(profile_result, input_result, flower_result)
    shaft_result    = select_shaft(profile_result, input_result, station_result)
    bearing_result  = select_bearing(shaft_result, input_result)
    duty_result     = classify_duty(profile_result, input_result, station_result, shaft_result)
    roll_logic_result = generate_roll_logic(profile_result, flower_result, station_result)
    roll_calc_result = generate_roll_design_calc(
        profile_result=profile_result,
        input_result=input_result,
        flower_result=flower_result,
        station_result=station_result,
        shaft_result=shaft_result,
    )
    layout_result = generate_machine_layout(
        profile_result=profile_result,
        input_result=input_result,
        station_result=station_result,
        shaft_result=shaft_result,
        bearing_result=bearing_result,
        roll_calc_result=roll_calc_result,
        duty_result=duty_result,
    )

    # ── Roll Contour Engine ────────────────────────────────────────────────
    roll_contour_result = generate_roll_contour(
        profile_result=profile_result,
        input_result=input_result,
        station_result=station_result,
        flower_result=flower_result,
        flange_result=flange_result,
    )

    # ── CAM Prep Engine ────────────────────────────────────────────────────
    cam_prep_result = generate_cam_prep(
        roll_contour_result=roll_contour_result,
        shaft_result=shaft_result,
        roll_calc_result=roll_calc_result,
        input_result=input_result,
        station_result=station_result,
    )

    # ── Advanced Roll Engine ───────────────────────────────────────────────
    advanced_roll_result = generate_advanced_rolls(
        profile_result=profile_result,
        input_result=input_result,
        flower_result=flower_result,
        station_result=station_result,
    )

    # ── Roll Interference Engine ───────────────────────────────────────────
    roll_interference_result = check_roll_interference(advanced_roll_result)

    # ── Roll Dimension Engine ──────────────────────────────────────────────
    roll_dimension_result = generate_roll_dimensions(
        profile_result=profile_result,
        input_result=input_result,
        shaft_result=shaft_result,
    )

    return {
        "status": "pass",
        "flange_web_lip_engine":     flange_result,
        "advanced_flower_engine":    flower_result,
        "station_engine":            station_result,
        "roll_logic_engine":         roll_logic_result,
        "shaft_engine":              shaft_result,
        "bearing_engine":            bearing_result,
        "duty_engine":               duty_result,
        "roll_design_calc_engine":   roll_calc_result,
        "machine_layout_engine":     layout_result,
        "roll_contour_engine":       roll_contour_result,
        "cam_prep_engine":           cam_prep_result,
        "advanced_roll_engine":      advanced_roll_result,
        "roll_interference_engine":  roll_interference_result,
        "roll_dimension_engine":     roll_dimension_result,
    }


def _run_accuracy_engines(
    import_result: Dict[str, Any],
    geometry_result: Dict[str, Any],
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    station_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
    bearing_result: Dict[str, Any],
    roll_calc_result: Dict[str, Any],
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    """Run consistency_engine + final_decision_engine and return both results."""
    consistency_result = validate_consistency(
        profile_result=profile_result,
        input_result=input_result,
        flower_result=flower_result,
        station_result=station_result,
        shaft_result=shaft_result,
        bearing_result=bearing_result,
        roll_calc_result=roll_calc_result,
    )
    decision_result = make_final_decision(
        import_result=import_result,
        geometry_result=geometry_result,
        profile_result=profile_result,
        input_result=input_result,
        flower_result=flower_result,
        station_result=station_result,
        shaft_result=shaft_result,
        bearing_result=bearing_result,
        roll_calc_result=roll_calc_result,
        consistency_result=consistency_result,
    )
    return consistency_result, decision_result


_EMPTY = {"status": "pass", "engine": "not_applicable"}


def execute_auto_pipeline(data: AutoModeInput) -> Dict[str, Any]:
    """Full auto-mode pipeline — returns complete pipeline dict."""
    import_result = parse_entities(data.entities or [])
    if is_fail(import_result):
        return fail_at("file_import_engine", import_result)

    geometry_result = clean_geometry(import_result["geometry"])
    if is_fail(geometry_result):
        return fail_at("geometry_engine", geometry_result)

    # ── Centerline Sheet Converter (Arc-Aware) ─────────────────────────────
    raw_entities = import_result.get("geometry") or []
    if isinstance(raw_entities, dict):
        raw_entities = raw_entities.get("entities", [])
    _is_centerline = is_centerline_geometry(raw_entities)
    centerline_result = _EMPTY
    if _is_centerline and data.thickness and data.thickness > 0:
        centerline_result = convert_centerline_to_sheet_arc_aware(
            geometry=raw_entities,
            thickness=data.thickness,
            mode="both",
            arc_segments=24,
        )
        if centerline_result.get("blocking"):
            logger.warning(
                "[centerline] Blocking self-intersection detected — "
                "results included but manual review required"
            )
    # ── End Centerline ─────────────────────────────────────────────────────

    profile_result = analyze_profile(geometry_result)
    if is_fail(profile_result):
        return fail_at("profile_analysis_engine", profile_result)

    input_result = validate_inputs(data.thickness, data.material)
    if is_fail(input_result):
        return fail_at("input_engine", input_result)

    core = _run_core_engines(profile_result, input_result)
    if is_fail(core):
        return core

    consistency_result, decision_result = _run_accuracy_engines(
        import_result=import_result,
        geometry_result=geometry_result,
        profile_result=profile_result,
        input_result=input_result,
        flower_result=core["advanced_flower_engine"],
        station_result=core["station_engine"],
        shaft_result=core["shaft_engine"],
        bearing_result=core["bearing_engine"],
        roll_calc_result=core["roll_design_calc_engine"],
    )

    pipeline = {
        "status": "pass",
        "file_import_engine":                 import_result,
        "geometry_engine":                    geometry_result,
        "centerline_sheet_converter_arc_engine": centerline_result,
        "profile_analysis_engine":            profile_result,
        "input_engine":                       input_result,
        **{k: v for k, v in core.items() if k != "status"},
        "consistency_engine":                 consistency_result,
        "final_decision_engine":              decision_result,
    }

    report_result = generate_report(pipeline)
    pipeline["report_engine"] = report_result
    return pipeline


def execute_manual_pipeline(data: ManualProfileInput) -> Dict[str, Any]:
    """Full manual-mode pipeline — returns complete pipeline dict."""
    from app.utils.engineering_rules import classify_complexity, COMPLEXITY_LABELS

    input_result = validate_inputs(data.thickness, data.material)
    if is_fail(input_result):
        return fail_at("input_engine", input_result)

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

    core = _run_core_engines(profile_result, input_result)
    if is_fail(core):
        return core

    consistency_result, decision_result = _run_accuracy_engines(
        import_result=_EMPTY,
        geometry_result=_EMPTY,
        profile_result=profile_result,
        input_result=input_result,
        flower_result=core["advanced_flower_engine"],
        station_result=core["station_engine"],
        shaft_result=core["shaft_engine"],
        bearing_result=core["bearing_engine"],
        roll_calc_result=core["roll_design_calc_engine"],
    )

    pipeline = {
        "status": "pass",
        "profile_analysis_engine": profile_result,
        "input_engine": input_result,
        **{k: v for k, v in core.items() if k != "status"},
        "consistency_engine": consistency_result,
        "final_decision_engine": decision_result,
    }

    report_result = generate_report(pipeline)
    pipeline["report_engine"] = report_result
    return pipeline


# ─── GET /api/health ──────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {
        "status": "pass",
        "service": "python-fastapi",
        "version": "2.3.0",
        "engines": [
            "file_import", "geometry", "profile_analysis", "input",
            "flange_web_lip", "advanced_flower", "station", "roll_logic",
            "shaft", "bearing", "duty", "roll_design_calc", "machine_layout",
            "consistency", "final_decision",
            "report", "pdf_export",
            "debug_test", "test_runner",
            "roll_contour", "cam_prep", "cad_export",
            "advanced_roll", "roll_interference", "roll_dimension",
            "export_dxf", "export_step", "export_pack",
            "centerline_sheet_converter_arc",
        ],
        "total_engines": 29,
        "endpoints": [
            "GET  /api/health",
            "POST /api/manual-mode",
            "POST /api/manual-mode-debug",
            "POST /api/manual-mode-export-pdf",
            "POST /api/manual-mode-download-pdf",
            "POST /api/semi-auto-confirm",
            "POST /api/auto-mode",
            "POST /api/dxf-upload  (alias: /api/auto-mode-dxf)",
            "POST /api/preview-dxf",
            "GET  /api/run-manual-tests",
            "POST /api/cad-export",
            "GET  /api/download-file",
            "POST /api/manual-mode-export-cad-pack",
            "POST /api/preview-centerline-conversion",
        ],
    }


# ─── POST /api/auto-mode ─────────────────────────────────────────────────────

@router.post("/auto-mode")
def run_auto_mode(data: AutoModeInput):
    logger.info(
        "[auto-mode] thickness=%.2f material=%s entities=%d",
        data.thickness, data.material, len(data.entities or []),
    )
    return execute_auto_pipeline(data)


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

    core = _run_core_engines(profile_result, input_result)
    if is_fail(core):
        return core

    consistency_result, decision_result = _run_accuracy_engines(
        import_result=import_result,
        geometry_result=geometry_result,
        profile_result=profile_result,
        input_result=input_result,
        flower_result=core["advanced_flower_engine"],
        station_result=core["station_engine"],
        shaft_result=core["shaft_engine"],
        bearing_result=core["bearing_engine"],
        roll_calc_result=core["roll_design_calc_engine"],
    )

    pipeline = {
        "status": "pass",
        "source_file": file.filename,
        "file_import_engine": import_result,
        "geometry_engine": geometry_result,
        "profile_analysis_engine": profile_result,
        "input_engine": input_result,
        **{k: v for k, v in core.items() if k != "status"},
        "consistency_engine": consistency_result,
        "final_decision_engine": decision_result,
    }

    pipeline["report_engine"] = generate_report(pipeline)
    return pipeline


# ─── POST /api/manual-mode ───────────────────────────────────────────────────

@router.post("/manual-mode")
def run_manual_mode(data: ManualProfileInput):
    logger.info(
        "[manual-mode] bends=%d w=%.1f h=%.1f thickness=%.2f material=%s",
        data.bend_count, data.section_width_mm, data.section_height_mm,
        data.thickness, data.material,
    )
    return execute_manual_pipeline(data)


# ─── GET /api/run-tests ──────────────────────────────────────────────────────

@router.get("/run-tests")
@router.get("/run-manual-tests")
def run_tests():
    """
    Run 8 standard test cases via test_runner_engine.
    TC-01: simple channel | TC-02: lipped channel | TC-03: shutter profile
    TC-04: invalid thickness | TC-05: empty DXF | TC-06: unsupported entities
    TC-07: contradiction case | TC-08: heavy duty mismatch
    """
    from app.api.schemas import ManualProfileInput as MPI, AutoModeInput as AMI
    return _run_all_tests(
        execute_manual_pipeline=execute_manual_pipeline,
        execute_auto_pipeline=execute_auto_pipeline,
        ManualProfileInput=MPI,
        AutoModeInput=AMI,
    )


# ─── POST /api/manual-mode-debug ─────────────────────────────────────────────

@router.post("/manual-mode-debug")
def run_manual_mode_debug(data: ManualProfileInput):
    """Manual mode pipeline with per-engine stage debug breakdown (via debug_test_engine)."""
    logger.info("[manual-mode-debug] bends=%d material=%s", data.bend_count, data.material)
    pipeline = execute_manual_pipeline(data)
    debug = extract_stage_debug(pipeline)
    return {
        "status": pipeline.get("status"),
        "pipeline_result": pipeline,
        "debug_result": debug,
    }


# ─── POST /api/auto-mode-export-pdf ──────────────────────────────────────────

@router.post("/auto-mode-export-pdf")
def run_auto_mode_export_pdf(data: AutoModeInput):
    logger.info("[auto-mode-export-pdf] thickness=%.2f material=%s", data.thickness, data.material)
    result = execute_auto_pipeline(data)
    if is_fail(result):
        return result

    report_result = result.get("report_engine", {})
    if is_fail(report_result):
        return fail_at("report_engine", report_result)

    pdf_result = export_report_pdf(report_result)
    return {
        "status": pdf_result.get("status"),
        "report_engine": report_result,
        "pdf_export_engine": pdf_result,
    }


# ─── POST /api/manual-mode-export-pdf ────────────────────────────────────────

@router.post("/manual-mode-export-pdf")
def run_manual_mode_export_pdf(data: ManualProfileInput):
    logger.info("[manual-mode-export-pdf] bends=%d material=%s", data.bend_count, data.material)
    result = execute_manual_pipeline(data)
    if is_fail(result):
        return result

    report_result = result.get("report_engine", {})
    if is_fail(report_result):
        return fail_at("report_engine", report_result)

    pdf_result = export_report_pdf(report_result)
    return {
        "status": pdf_result.get("status"),
        "report_engine": report_result,
        "pdf_export_engine": pdf_result,
    }


# ─── POST /api/manual-mode-download-pdf ──────────────────────────────────────

@router.post("/manual-mode-download-pdf")
def run_manual_mode_download_pdf(data: ManualProfileInput):
    logger.info("[manual-mode-download-pdf] bends=%d material=%s", data.bend_count, data.material)
    result = execute_manual_pipeline(data)
    if is_fail(result):
        return result

    report_result = result.get("report_engine", {})
    if is_fail(report_result):
        return fail_at("report_engine", report_result)

    pdf_result = export_report_pdf(report_result)
    if pdf_result.get("status") != "pass":
        return pdf_result

    return FileResponse(
        path=pdf_result["file_path"],
        filename=pdf_result["filename"],
        media_type="application/pdf",
    )


# ─── POST /api/auto-mode-dxf (alias for /api/dxf-upload) ─────────────────────

@router.post("/auto-mode-dxf")
async def auto_mode_dxf(
    thickness: float,
    material: str,
    file: UploadFile = File(...),
):
    """Alias for /api/dxf-upload — canonical blueprint name."""
    if not file.filename or not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Only .dxf files accepted")

    dxf_bytes = await file.read()
    logger.info("[auto-mode-dxf] file=%s size=%d thickness=%.2f material=%s",
                file.filename, len(dxf_bytes), thickness, material)

    import_result = parse_dxf_bytes(dxf_bytes)
    if is_fail(import_result):
        return fail_at("file_import_engine", import_result)

    geometry_result = clean_geometry(import_result["geometry"])
    if is_fail(geometry_result):
        return fail_at("geometry_engine", geometry_result)

    # ── Centerline Sheet Converter (Arc-Aware) ─────────────────────────────
    raw_entities = import_result.get("geometry") or []
    if isinstance(raw_entities, dict):
        raw_entities = raw_entities.get("entities", [])
    _is_centerline = is_centerline_geometry(raw_entities)
    centerline_result = _EMPTY
    if _is_centerline and thickness and thickness > 0:
        centerline_result = convert_centerline_to_sheet_arc_aware(
            geometry=raw_entities,
            thickness=thickness,
            mode="both",
            arc_segments=24,
        )
        if centerline_result.get("blocking"):
            logger.warning(
                "[centerline/dxf] Blocking self-intersection — manual review required"
            )
    # ── End Centerline ─────────────────────────────────────────────────────

    profile_result = analyze_profile(geometry_result)
    if is_fail(profile_result):
        return fail_at("profile_analysis_engine", profile_result)

    input_result = validate_inputs(thickness, material)
    if is_fail(input_result):
        return fail_at("input_engine", input_result)

    core = _run_core_engines(profile_result, input_result)
    if is_fail(core):
        return core

    consistency_result, decision_result = _run_accuracy_engines(
        import_result=import_result,
        geometry_result=geometry_result,
        profile_result=profile_result,
        input_result=input_result,
        flower_result=core["advanced_flower_engine"],
        station_result=core["station_engine"],
        shaft_result=core["shaft_engine"],
        bearing_result=core["bearing_engine"],
        roll_calc_result=core["roll_design_calc_engine"],
    )

    pipeline = {
        "status": "pass",
        "source_file": file.filename,
        "file_import_engine": import_result,
        "geometry_engine": geometry_result,
        "centerline_sheet_converter_arc_engine": centerline_result,
        "profile_analysis_engine": profile_result,
        "input_engine": input_result,
        **{k: v for k, v in core.items() if k != "status"},
        "consistency_engine": consistency_result,
        "final_decision_engine": decision_result,
    }

    pipeline["report_engine"] = generate_report(pipeline)
    return pipeline


# ─── POST /api/preview-dxf ────────────────────────────────────────────────────

@router.post("/preview-dxf")
async def preview_dxf(
    file: UploadFile = File(...),
):
    """
    Lightweight DXF preview — runs import + geometry + profile_analysis only.
    Returns geometry stats without full pipeline or accuracy engines.
    Useful for confirming DXF is readable before committing to full pipeline run.
    """
    if not file.filename or not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Only .dxf files accepted")

    dxf_bytes = await file.read()
    logger.info("[preview-dxf] file=%s size=%d bytes", file.filename, len(dxf_bytes))

    import_result = parse_dxf_bytes(dxf_bytes)
    if is_fail(import_result):
        return {
            "status": "fail",
            "stage": "file_import_engine",
            "preview_available": False,
            "file_import_engine": import_result,
        }

    geometry_result = clean_geometry(import_result["geometry"])
    if is_fail(geometry_result):
        return {
            "status": "fail",
            "stage": "geometry_engine",
            "preview_available": False,
            "file_import_engine": import_result,
            "geometry_engine": geometry_result,
        }

    profile_result = analyze_profile(geometry_result)

    raw_geo = import_result.get("geometry") or []
    if isinstance(raw_geo, dict):
        raw_geo = raw_geo.get("entities", [])
    entity_counts = {
        "total_entities": len(raw_geo),
        "lines":     sum(1 for e in raw_geo if e.get("type","").upper() in {"LINE"}),
        "arcs":      sum(1 for e in raw_geo if e.get("type","").upper() in {"ARC"}),
        "polylines": sum(1 for e in raw_geo if e.get("type","").upper() in {"LWPOLYLINE", "POLYLINE"}),
    }

    return {
        "status": "pass",
        "preview_available": True,
        "source_file": file.filename,
        "file_size_bytes": len(dxf_bytes),
        "entity_summary": entity_counts,
        "geometry_engine": {
            "status": geometry_result.get("status"),
            "entity_count": geometry_result.get("cleaned_entity_count", geometry_result.get("entity_count")),
            "bounding_box": geometry_result.get("bounding_box"),
            "warnings": geometry_result.get("warnings", []),
        },
        "profile_preview": {
            "status": profile_result.get("status"),
            "section_width_mm": profile_result.get("section_width_mm"),
            "section_height_mm": profile_result.get("section_height_mm"),
            "bend_count": profile_result.get("bend_count"),
            "profile_type": profile_result.get("profile_type"),
            "return_bends_count": profile_result.get("return_bends_count"),
            "warnings": profile_result.get("warnings", []),
        },
        "ready_for_full_pipeline": profile_result.get("status") == "pass",
        "note": "This is a preview only — run /api/auto-mode-dxf for full engineering analysis.",
    }


# ─── POST /api/preview-centerline-conversion ─────────────────────────────────

@router.post("/preview-centerline-conversion")
async def preview_centerline_conversion(
    file: UploadFile = File(...),
    thickness: float = Form(...),
):
    """
    Standalone centerline-to-sheet conversion preview.
    Parses the DXF, runs the arc-aware centerline converter, and returns the
    full profile output (centerline, outer, inner, sheet) for SVG rendering.
    """
    if not file.filename or not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Only .dxf files accepted")
    if thickness <= 0:
        raise HTTPException(status_code=422, detail="thickness must be > 0")

    dxf_bytes = await file.read()
    logger.info(
        "[preview-centerline-conversion] file=%s size=%d bytes thickness=%.3f",
        file.filename, len(dxf_bytes), thickness,
    )

    import_result = parse_dxf_bytes(dxf_bytes)
    if is_fail(import_result):
        return {
            "status": "fail",
            "failed_stage": "file_import_engine",
            "result": import_result,
        }

    raw_entities = import_result.get("geometry") or []
    if isinstance(raw_entities, dict):
        raw_entities = raw_entities.get("entities", [])

    if not is_centerline_geometry(raw_entities):
        return {
            "status": "fail",
            "failed_stage": "centerline_detection",
            "result": {
                "reason": "DXF does not appear to be a centerline drawing. "
                          "Expected mostly LINE/ARC entities without HATCH/SOLID.",
                "entity_count": len(raw_entities),
            },
        }

    conversion_result = convert_centerline_to_sheet_arc_aware(
        geometry=raw_entities,
        thickness=thickness,
        mode="both",
        arc_segments=24,
    )

    if is_fail(conversion_result):
        return {
            "status": "fail",
            "failed_stage": "centerline_sheet_converter_arc_engine",
            "result": conversion_result,
        }

    return {
        "status": "pass",
        "source_file": file.filename,
        "file_size_bytes": len(dxf_bytes),
        "entity_count": len(raw_entities),
        "centerline_converter_engine": conversion_result,
    }


# ─── POST /api/semi-auto-confirm ─────────────────────────────────────────────

@router.post("/semi-auto-confirm")
def semi_auto_confirm(data: Dict[str, Any]):
    """
    Semi-auto confirmation — takes user-confirmed values (corrected from detected),
    re-runs full manual pipeline, and marks result as semi_auto_confirmed.
    Expects:
      confirmed: { bend_count, section_width_mm, section_height_mm, thickness,
                   material, profile_type, return_bends_count?, station_count? }
      original:  { ...detected values for audit trail }
    """
    confirmed = data.get("confirmed", {})
    original  = data.get("original", {})

    if not confirmed:
        raise HTTPException(status_code=400, detail="'confirmed' block is required")

    required_fields = ["bend_count", "section_width_mm", "section_height_mm", "thickness", "material"]
    missing = [f for f in required_fields if f not in confirmed]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required confirmed fields: {missing}")

    try:
        manual_input = ManualProfileInput(
            bend_count=int(confirmed["bend_count"]),
            section_width_mm=float(confirmed["section_width_mm"]),
            section_height_mm=float(confirmed["section_height_mm"]),
            thickness=float(confirmed["thickness"]),
            material=str(confirmed["material"]),
            profile_type=confirmed.get("profile_type", "custom"),
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid confirmed values: {e}")

    logger.info(
        "[semi-auto-confirm] confirmed bends=%d w=%.1f h=%.1f thickness=%.2f material=%s",
        manual_input.bend_count, manual_input.section_width_mm,
        manual_input.section_height_mm, manual_input.thickness, manual_input.material,
    )

    result = execute_manual_pipeline(manual_input)

    # Override mode to semi_auto_confirmed regardless of final decision
    if result.get("final_decision_engine"):
        result["final_decision_engine"]["selected_mode"] = "semi_auto_confirmed"
        result["final_decision_engine"]["semi_auto_note"] = (
            "Values confirmed by engineer — pipeline re-run with user-corrected inputs"
        )

    result["semi_auto_metadata"] = {
        "mode": "semi_auto_confirmed",
        "confirmed_by": "user",
        "confirmed_values": confirmed,
        "original_detected_values": original,
        "fields_changed": [
            k for k in confirmed
            if str(confirmed.get(k)) != str(original.get(k))
        ],
    }

    return result


# ─── POST /api/cad-export ─────────────────────────────────────────────────────

@router.post("/cad-export")
def run_cad_export(data: ManualProfileInput):
    """
    Run full manual pipeline + generate CAD export pack.
    Returns file manifest with paths for roll_set.dxf, shaft_layout.dxf,
    assembly.dxf, and per-roll STEP files.
    """
    logger.info("[cad-export] bends=%d material=%s", data.bend_count, data.material)
    pipeline = execute_manual_pipeline(data)
    if is_fail(pipeline):
        return pipeline

    cad_result = generate_cad_export(
        roll_contour_result   = pipeline.get("roll_contour_engine", {}),
        cam_prep_result       = pipeline.get("cam_prep_engine", {}),
        shaft_result          = pipeline.get("shaft_engine", {}),
        bearing_result        = pipeline.get("bearing_engine", {}),
        roll_calc_result      = pipeline.get("roll_design_calc_engine", {}),
        station_result        = pipeline.get("station_engine", {}),
        profile_result        = pipeline.get("profile_analysis_engine", {}),
        machine_layout_result = pipeline.get("machine_layout_engine", {}),
    )

    return {
        "status":          pipeline.get("status"),
        "cad_export":      cad_result,
        "roll_contour":    pipeline.get("roll_contour_engine", {}),
        "cam_prep":        pipeline.get("cam_prep_engine", {}),
        "engineering_summary": pipeline.get("report_engine", {}).get("engineering_summary", {}),
    }


# ─── GET /api/download-file ───────────────────────────────────────────────────

@router.get("/download-file")
def download_file(path: str):
    """
    Download a generated file by its absolute path (from cad_export file_manifest).
    Supports .dxf, .stp, .pdf files in the exports directory.
    """
    import os as _os
    from app.engines.cad_export_engine import EXPORTS_DIR as _EXPORTS_DIR
    from app.engines.pdf_export_engine import EXPORTS_DIR as _PDF_DIR

    # Security: only serve files inside known export directories
    safe_roots = [
        _os.path.realpath(_EXPORTS_DIR),
        _os.path.realpath(_PDF_DIR),
    ]
    real_path = _os.path.realpath(path)
    allowed = any(real_path.startswith(root) for root in safe_roots)

    if not allowed or not _os.path.isfile(real_path):
        raise HTTPException(status_code=404, detail="File not found or not accessible")

    ext = _os.path.splitext(real_path)[1].lower()
    media_map = {
        ".dxf":  "application/dxf",
        ".stp":  "application/step",
        ".step": "application/step",
        ".pdf":  "application/pdf",
    }
    media_type = media_map.get(ext, "application/octet-stream")
    return FileResponse(real_path, media_type=media_type,
                        filename=_os.path.basename(real_path))


# ─── POST /api/manual-mode-export-cad-pack ───────────────────────────────────

@router.post("/manual-mode-export-cad-pack")
def run_manual_mode_export_cad_pack(data: ManualProfileInput):
    """
    Run full manual pipeline → generate advanced roll profiles → DXF + STEP export pack.

    Returns:
      • advanced_roll_engine   — pass-wise upper/lower roll profiles per stand
      • roll_interference_engine — interference check result
      • roll_dimension_engine  — roll OD, face width, bore, keyway
      • export_dxf_engine      — 2D roll drawing pack (DXF)
      • export_step_engine     — 3D roll solid (STEP AP203)
      • export_pack_engine     — bundled file manifest (DXF + STEP + PDF)
      • pdf_export_engine      — engineering report PDF

    PRELIMINARY CAD/CAM HANDOFF — pending tooling verification.
    """
    logger.info(
        "[manual-mode-export-cad-pack] bends=%d material=%s",
        data.bend_count, data.material,
    )

    pipeline = execute_manual_pipeline(data)
    if is_fail(pipeline):
        return pipeline

    profile_result  = pipeline.get("profile_analysis_engine", {})
    input_result    = pipeline.get("input_engine", {})
    flower_result   = pipeline.get("advanced_flower_engine", {})
    station_result  = pipeline.get("station_engine", {})
    shaft_result    = pipeline.get("shaft_engine", {})
    report_result   = pipeline.get("report_engine", {})

    # Advanced roll engines
    advanced_roll_result = generate_advanced_rolls(
        profile_result=profile_result,
        input_result=input_result,
        flower_result=flower_result,
        station_result=station_result,
    )
    roll_interference_result = check_roll_interference(advanced_roll_result)
    roll_dimension_result = generate_roll_dimensions(
        profile_result=profile_result,
        input_result=input_result,
        shaft_result=shaft_result,
    )

    # Generate a shared session ID so DXF and STEP land in the same folder
    import uuid as _uuid
    import time as _time
    session_id = f"{int(_time.time())}_{_uuid.uuid4().hex[:6]}"

    dxf_result  = export_rolls_dxf(advanced_roll_result, roll_dimension_result, session_id=session_id)
    step_result = export_roll_step(roll_dimension_result, session_id=session_id)
    pdf_result  = export_report_pdf(report_result)

    export_pack_result = build_export_pack(dxf_result, step_result, pdf_result)

    return {
        "status": "pass",
        "session_id":               session_id,
        "advanced_roll_engine":     advanced_roll_result,
        "roll_interference_engine": roll_interference_result,
        "roll_dimension_engine":    roll_dimension_result,
        "export_dxf_engine":        dxf_result,
        "export_step_engine":       step_result,
        "pdf_export_engine":        pdf_result,
        "export_pack_engine":       export_pack_result,
    }


# ═══════════════════════════════════════════════════════════════
# POST /api/simulate
# ═══════════════════════════════════════════════════════════════

@router.post("/simulate")
async def simulate_roll_forming(
    file: UploadFile = File(...),
    thickness: float = Form(1.5),
    material: str   = Form("GI"),
    bend_radius: float = Form(1.5),
    strip_speed: float = Form(15.0),
):
    """
    Run a full roll-forming simulation from a DXF file.

    Steps:
      1. Parse DXF → geometry
      2. Profile analysis → get segment dimensions
      3. Roll contour engine → per-station pass data
      4. Simulation engine → per-pass deformation, strain, force, defects

    Returns: simulation_engine result with all passes.
    """
    raw = await file.read()

    # ── Import ──────────────────────────────────────────────────
    import_result = parse_dxf_bytes(raw)
    if import_result.get("status") != "pass":
        return {"status": "fail", "reason": "DXF import failed", "import_engine": import_result}

    raw_geo = import_result.get("geometry") or []
    if isinstance(raw_geo, dict):
        raw_geo = raw_geo.get("entities", [])

    # ── Clean geometry ───────────────────────────────────────────
    geometry_result = clean_geometry(raw_geo)
    cleaned_entities = geometry_result.get("entities") or []

    # ── Profile analysis ─────────────────────────────────────────
    profile_result = analyze_profile(geometry_result)

    # ── Validate inputs ──────────────────────────────────────────
    input_result = validate_inputs(thickness, material)

    # ── Core engines (flower → station → shaft → roll contour) ───
    core = _run_core_engines(profile_result, input_result)
    roll_contour_result = core.get("roll_contour_engine", {})

    passes = roll_contour_result.get("passes", [])
    calib  = roll_contour_result.get("calibration_pass")

    # ── Build DXF profile points ─────────────────────────────────
    # Use actual DXF entities as profile points (centred, Y-up)
    profile_points: list = []
    if cleaned_entities:
        # Build polyline from line entities
        pts_map: dict = {}
        for e in cleaned_entities:
            if e.get("type", "").lower() == "line":
                s = e.get("start") or {}
                en = e.get("end") or {}
                key_s = (round(s.get("x", 0), 3), round(s.get("y", 0), 3))
                key_e = (round(en.get("x", 0), 3), round(en.get("y", 0), 3))
                pts_map[key_s] = key_e

        # Walk the chain
        if pts_map:
            start = min(pts_map.keys(), key=lambda k: k[0])
            chain = [start]
            visited = {start}
            cur = start
            for _ in range(len(pts_map)):
                nxt = pts_map.get(cur)
                if nxt is None or nxt in visited:
                    break
                chain.append(nxt)
                visited.add(nxt)
                cur = nxt
            profile_points = [{"x": p[0], "y": p[1]} for p in chain]

    # Fallback: derive from profile dimensions
    if len(profile_points) < 3:
        w = profile_result.get("section_width_mm", 156)
        h = profile_result.get("section_height_mm", 50)
        bend_details = profile_result.get("bend_details", [])
        if bend_details and len(bend_details) >= 4:
            # Use bend_details at_points to reconstruct
            pts = [(0.0, 0.0)]
            for bd in bend_details:
                ap = bd.get("at_point", [0, 0])
                pts.append((float(ap[0]), float(ap[1])))
            # final tip
            last_bd = bend_details[-1].get("at_point", [w, 0])
            pts.append((float(last_bd[0]) + (w - float(last_bd[0])), float(last_bd[1])))
            profile_points = [{"x": p[0], "y": p[1]} for p in pts]
        else:
            profile_points = [
                {"x": 0.0,   "y": 0.0},
                {"x": w,     "y": 0.0},
            ]

    # ── Run simulation ────────────────────────────────────────────
    simulation_result = run_sim_engine(
        profile_points=profile_points,
        passes=passes,
        thickness_mm=thickness,
        material=material,
        bend_radius_mm=bend_radius,
        calibration_pass=calib,
        strip_speed_mpm=strip_speed,
    )

    return {
        "status": "pass",
        "profile_analysis_engine": profile_result,
        "roll_contour_engine":     roll_contour_result,
        "simulation_engine":       simulation_result,
    }
