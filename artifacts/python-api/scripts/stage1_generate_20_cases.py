"""
Stage 1 batch runner: generate 20 hard engineering cases with proof artifacts.

Output root (default):
  artifacts/batch_stage1_20_cases/
    dataset/
    outputs/
    exports/
    previews/
    logs/
    reports/
    failed_cases/
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sys
import time
import traceback
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple


THIS_FILE = Path(__file__).resolve()
PY_API_DIR = THIS_FILE.parents[1]
REPO_ROOT = PY_API_DIR.parents[1]

if str(PY_API_DIR) not in sys.path:
    sys.path.insert(0, str(PY_API_DIR))

from app.api.schemas import ManualProfileInput
from app.api.routes import execute_manual_pipeline
from app.engines.advanced_flower_engine import generate_advanced_flower
from app.engines.advanced_process_simulation import run_advanced_process_simulation
from app.engines.bom_engine import generate_bom
from app.engines.cad_export_engine import generate_cad_export
from app.engines.flower_svg_engine import generate_flower_svg, section_centerline
from app.engines.process_card_engine import generate_process_card, process_card_to_text
from app.engines.roll_groove_svg_engine import generate_roll_groove_svgs
from app.engines.simulation_engine import run_simulation


@dataclass(frozen=True)
class CaseSpec:
    drawing_id: str
    difficulty_tier: str
    description: str
    bend_count: int
    section_width_mm: float
    section_height_mm: float
    thickness: float
    material: str
    profile_type: str
    return_bends_count: int
    lips_present: bool
    lip_mm: float
    n_stations: int


CASES: List[CaseSpec] = [
    CaseSpec("S1-001", "hard", "Shutter slat high-station GI profile", 8, 220, 14, 1.2, "GI", "shutter_slat", 0, False, 0.0, 18),
    CaseSpec("S1-002", "hard", "Wide shutter slat with extra bends", 10, 260, 16, 1.4, "GI", "shutter_slat", 0, False, 0.0, 22),
    CaseSpec("S1-003", "hard", "MS door frame with return bends", 4, 95, 68, 2.5, "MS", "door_frame", 2, False, 0.0, 14),
    CaseSpec("S1-004", "hard", "SS lipped channel thin strip", 5, 120, 45, 1.0, "SS", "lipped_channel", 0, True, 18.0, 16),
    CaseSpec("S1-005", "hard", "HR heavy lipped channel", 6, 140, 60, 3.0, "HR", "lipped_channel", 0, True, 20.0, 22),
    CaseSpec("S1-006", "hard", "CR deep C-channel", 2, 80, 70, 2.0, "CR", "c_channel", 0, False, 0.0, 10),
    CaseSpec("S1-007", "hard", "AL wide hat section", 4, 240, 35, 1.6, "AL", "hat_section", 0, False, 0.0, 14),
    CaseSpec("S1-008", "hard", "HSLA Z section with return bend", 2, 95, 55, 2.8, "HSLA", "z_section", 1, False, 0.0, 12),
    CaseSpec("S1-009", "hard", "TI lipped channel high springback", 4, 110, 50, 1.8, "TI", "lipped_channel", 0, True, 15.0, 18),
    CaseSpec("S1-010", "hard", "CU wide U-channel", 2, 180, 50, 1.2, "CU", "u_channel", 0, False, 0.0, 10),
    CaseSpec("S1-011", "hard", "Complex section with seven bends", 7, 170, 65, 1.0, "GI", "complex_section", 0, True, 10.0, 20),
    CaseSpec("S1-012", "hard", "Thick MS lipped profile", 6, 150, 80, 4.0, "MS", "lipped_channel", 0, True, 22.0, 24),
    CaseSpec("S1-013", "hard", "SS door frame high thickness", 4, 85, 70, 2.2, "SS", "door_frame", 2, False, 0.0, 18),
    CaseSpec("S1-014", "hard", "HR shutter style thick strip", 8, 210, 20, 2.6, "HR", "shutter_slat", 0, False, 0.0, 22),
    CaseSpec("S1-015", "hard", "AL Z profile edge thickness", 2, 120, 45, 0.8, "AL", "z_section", 1, False, 0.0, 9),
    CaseSpec("S1-016", "hard", "PP light channel profile", 2, 70, 40, 2.2, "PP", "c_channel", 0, False, 0.0, 8),
    CaseSpec("S1-017", "hard", "HSLA heavy hat section", 4, 260, 42, 3.2, "HSLA", "hat_section", 0, False, 0.0, 22),
    CaseSpec("S1-018", "hard", "CR lipped channel medium gauge", 5, 130, 55, 1.6, "CR", "lipped_channel", 0, True, 12.0, 16),
    CaseSpec("S1-019", "hard", "GI door frame balanced dimensions", 4, 100, 75, 1.8, "GI", "door_frame", 2, False, 0.0, 16),
    CaseSpec("S1-020", "hard", "SS multi-bend complex section", 9, 190, 90, 2.4, "SS", "complex_section", 0, True, 14.0, 26),
]


def _to_json(obj: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, default=str)


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _copy_export_files(case_id: str, cad_manifest: List[Dict[str, Any]], exports_dir: Path) -> Tuple[List[str], List[str]]:
    copied: List[str] = []
    missing: List[str] = []
    case_export_dir = exports_dir / case_id
    case_export_dir.mkdir(parents=True, exist_ok=True)

    for item in cad_manifest:
        src_str = str(item.get("path", ""))
        src = Path(src_str)
        if not src_str or not src.exists():
            missing.append(src_str)
            continue
        dst = case_export_dir / src.name
        shutil.copy2(src, dst)
        copied.append(str(dst))

    return copied, missing


def _profile_points_from_section(profile_result: Dict[str, Any], lip_mm: float) -> List[Dict[str, float]]:
    ptype = str(profile_result.get("profile_type", "c_channel"))
    web = float(profile_result.get("section_width_mm", 100.0))
    flange = float(profile_result.get("section_height_mm", 40.0))
    pts = section_centerline(ptype, web, flange, 90.0, lip_mm=lip_mm)
    return [{"x": float(x), "y": float(y)} for x, y in pts]


def _status_from_checks(checks: Dict[str, bool], base_status: str) -> str:
    if base_status == "FAILED":
        return "FAILED"
    if all(checks.values()):
        return "VERIFIED"
    return "PARTIAL"


def _case_signature(c: CaseSpec) -> Tuple[Any, ...]:
    return (
        c.bend_count,
        round(c.section_width_mm, 4),
        round(c.section_height_mm, 4),
        round(c.thickness, 4),
        c.material.upper(),
        c.profile_type,
        c.return_bends_count,
        bool(c.lips_present),
        round(c.lip_mm, 4),
        c.n_stations,
    )


def _manifest_row(case: CaseSpec, result: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "drawing_id": case.drawing_id,
        "difficulty_tier": case.difficulty_tier,
        "profile_type": case.profile_type,
        "material": case.material,
        "thickness": case.thickness,
        "dimensions_mm": f"{case.section_width_mm}x{case.section_height_mm}",
        "bend_count": case.bend_count,
        "return_bends_count": case.return_bends_count,
        "generation_status": result.get("generation_status", "FAILED"),
        "export_status": result.get("export_status", "NOT VERIFIED"),
        "validation_status": result.get("validation_status", "NOT VERIFIED"),
        "artifact_paths": "; ".join(result.get("artifact_paths", [])),
        "notes": " | ".join(result.get("notes", [])),
    }


def run_stage1(output_root: Path) -> Dict[str, Any]:
    dirs = {
        "root": output_root,
        "dataset": output_root / "dataset",
        "outputs": output_root / "outputs",
        "exports": output_root / "exports",
        "previews": output_root / "previews",
        "logs": output_root / "logs",
        "reports": output_root / "reports",
        "failed_cases": output_root / "failed_cases",
    }
    for p in dirs.values():
        if isinstance(p, Path):
            p.mkdir(parents=True, exist_ok=True)

    run_start = time.time()
    run_started_at = datetime.now(timezone.utc).isoformat()

    _write_text(
        dirs["logs"] / "COMMAND_TRACE.txt",
        (
            "python artifacts/python-api/scripts/stage1_generate_20_cases.py "
            f"--output-root \"{str(output_root)}\"\n"
        ),
    )

    manifest_rows: List[Dict[str, Any]] = []
    case_ids: List[str] = []
    case_statuses: Dict[str, str] = {}
    case_results: List[Dict[str, Any]] = []

    signatures: Dict[Tuple[Any, ...], List[str]] = defaultdict(list)
    for c in CASES:
        signatures[_case_signature(c)].append(c.drawing_id)

    for case in CASES:
        case_start = time.time()
        case_ids.append(case.drawing_id)
        case_log_lines: List[str] = [f"case={case.drawing_id} start={datetime.now(timezone.utc).isoformat()}"]
        notes: List[str] = []

        input_payload = {
            "bend_count": case.bend_count,
            "section_width_mm": case.section_width_mm,
            "section_height_mm": case.section_height_mm,
            "thickness": case.thickness,
            "material": case.material,
            "profile_type": case.profile_type,
            "return_bends_count": case.return_bends_count,
            "lips_present": case.lips_present,
            "lip_mm": case.lip_mm,
            "n_stations": case.n_stations,
        }
        _to_json(input_payload, dirs["dataset"] / f"{case.drawing_id}_input.json")

        generation_status = "FAILED"
        export_status = "NOT VERIFIED"
        validation_status = "NOT VERIFIED"
        artifact_paths: List[str] = []
        exception_text = ""

        pipeline: Dict[str, Any] = {}
        cad_result: Dict[str, Any] = {}
        flower_svg_result: Dict[str, Any] = {}
        roll_svg_result: Dict[str, Any] = {}
        advanced_flower_result: Dict[str, Any] = {}
        advanced_sim_result: Dict[str, Any] = {}
        simple_sim_result: Dict[str, Any] = {}
        bom_result: Dict[str, Any] = {}
        process_card_result: Dict[str, Any] = {}

        checks = {
            "pipeline_pass": False,
            "cad_export_pass": False,
            "dxf_exists": False,
            "step_exists": False,
            "flower_preview": False,
            "roll_preview": False,
            "advanced_sim_pass": False,
            "simple_sim_pass": False,
        }

        try:
            model = ManualProfileInput(**input_payload)
            pipeline = execute_manual_pipeline(model)
            checks["pipeline_pass"] = pipeline.get("status") == "pass"
            case_log_lines.append(f"pipeline_status={pipeline.get('status')}")

            if checks["pipeline_pass"]:
                cad_result = generate_cad_export(
                    roll_contour_result=pipeline.get("roll_contour_engine", {}),
                    cam_prep_result=pipeline.get("cam_prep_engine", {}),
                    shaft_result=pipeline.get("shaft_engine", {}),
                    bearing_result=pipeline.get("bearing_engine", {}),
                    roll_calc_result=pipeline.get("roll_design_calc_engine", {}),
                    station_result=pipeline.get("station_engine", {}),
                    profile_result=pipeline.get("profile_analysis_engine", {}),
                    machine_layout_result=pipeline.get("machine_layout_engine", {}),
                )
                checks["cad_export_pass"] = cad_result.get("status") == "pass"
                case_log_lines.append(f"cad_export_status={cad_result.get('status')}")

                copied_exports, missing_exports = _copy_export_files(
                    case.drawing_id,
                    cad_result.get("file_manifest", []),
                    dirs["exports"],
                )
                artifact_paths.extend(copied_exports)
                if missing_exports:
                    notes.append(f"Missing exported files: {len(missing_exports)}")
                    case_log_lines.append(f"missing_exports={len(missing_exports)}")

                checks["dxf_exists"] = any(Path(p).suffix.lower() == ".dxf" for p in copied_exports)
                checks["step_exists"] = any(Path(p).suffix.lower() in {".stp", ".step"} for p in copied_exports)

                flower_svg_result = generate_flower_svg(
                    profile_result=pipeline.get("profile_analysis_engine", {}),
                    input_result=pipeline.get("input_engine", {}),
                    roll_contour_result=pipeline.get("roll_contour_engine", {}),
                    station_result=pipeline.get("station_engine", {}),
                )
                if flower_svg_result.get("status") == "pass" and flower_svg_result.get("svg_string"):
                    flower_svg_path = dirs["previews"] / f"{case.drawing_id}_flower.svg"
                    _write_text(flower_svg_path, flower_svg_result["svg_string"])
                    artifact_paths.append(str(flower_svg_path))
                    checks["flower_preview"] = True

                roll_svg_result = generate_roll_groove_svgs(
                    profile_result=pipeline.get("profile_analysis_engine", {}),
                    input_result=pipeline.get("input_engine", {}),
                    roll_contour_result=pipeline.get("roll_contour_engine", {}),
                )
                if roll_svg_result.get("status") == "pass":
                    station_svgs = roll_svg_result.get("station_svgs", [])
                    if station_svgs:
                        first_svg = station_svgs[0].get("svg_string", "")
                        if first_svg:
                            roll_preview_path = dirs["previews"] / f"{case.drawing_id}_roll_station_01.svg"
                            _write_text(roll_preview_path, first_svg)
                            artifact_paths.append(str(roll_preview_path))
                            checks["roll_preview"] = True

                        last_svg = station_svgs[-1].get("svg_string", "")
                        if last_svg:
                            roll_preview_last_path = dirs["previews"] / f"{case.drawing_id}_roll_station_last.svg"
                            _write_text(roll_preview_last_path, last_svg)
                            artifact_paths.append(str(roll_preview_last_path))

                input_result = pipeline.get("input_engine", {})
                profile_result = pipeline.get("profile_analysis_engine", {})
                roll_contour_result = pipeline.get("roll_contour_engine", {})

                advanced_flower_result = generate_advanced_flower(profile_result, input_result)
                if advanced_flower_result.get("status") == "pass":
                    advanced_sim_result = run_advanced_process_simulation(
                        flower_result=advanced_flower_result,
                        input_result=input_result,
                        profile_result=profile_result,
                        roll_od_mm=180.0,
                        face_width_mm=100.0,
                        station_pitch_mm=float(pipeline.get("machine_layout_engine", {}).get("stand_spacing_mm", 300.0)),
                        strip_speed_mpm=12.0,
                    )
                checks["advanced_sim_pass"] = advanced_sim_result.get("status") == "pass"

                lip_mm = float(profile_result.get("lip_mm", 0.0) or 0.0)
                profile_points = _profile_points_from_section(profile_result, lip_mm=lip_mm)

                simple_sim_result = run_simulation(
                    profile_points=profile_points,
                    passes=roll_contour_result.get("passes", []),
                    thickness_mm=float(input_result.get("sheet_thickness_mm", case.thickness)),
                    material=str(input_result.get("material", case.material)),
                    bend_radius_mm=max(float(input_result.get("sheet_thickness_mm", case.thickness)), 0.5),
                    calibration_pass=roll_contour_result.get("calibration_pass"),
                    strip_speed_mpm=15.0,
                )
                checks["simple_sim_pass"] = simple_sim_result.get("status") == "pass"

                bom_result = generate_bom(
                    station_result=pipeline.get("station_engine", {}),
                    shaft_result=pipeline.get("shaft_engine", {}),
                    bearing_result=pipeline.get("bearing_engine", {}),
                    machine_layout_result=pipeline.get("machine_layout_engine", {}),
                    simulation_result=simple_sim_result if simple_sim_result.get("status") == "pass" else None,
                    material=str(input_result.get("material", case.material)),
                    include_spares=True,
                )

                process_card_result = generate_process_card(
                    simulation_result=simple_sim_result,
                    thickness_mm=float(input_result.get("sheet_thickness_mm", case.thickness)),
                    material=str(input_result.get("material", case.material)),
                    bend_radius_mm=max(float(input_result.get("sheet_thickness_mm", case.thickness)), 0.5),
                    project_ref=case.drawing_id,
                )
                if process_card_result.get("status") == "pass":
                    process_card_text = process_card_to_text(process_card_result)
                    pc_path = dirs["outputs"] / f"{case.drawing_id}_process_card.txt"
                    _write_text(pc_path, process_card_text)
                    artifact_paths.append(str(pc_path))

                generation_status = _status_from_checks(checks, base_status="PASS")
                export_status = "VERIFIED" if checks["dxf_exists"] and checks["step_exists"] else "PARTIAL"
                validation_status = "VERIFIED" if generation_status == "VERIFIED" else "PARTIAL"
            else:
                notes.append("Manual pipeline returned fail status")
                generation_status = "FAILED"
                export_status = "FAILED"
                validation_status = "FAILED"

        except Exception as exc:  # noqa: BLE001
            generation_status = "FAILED"
            export_status = "FAILED"
            validation_status = "FAILED"
            exception_text = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
            notes.append(f"Exception: {exc}")
            case_log_lines.append("exception=true")

        runtime_seconds = round(time.time() - case_start, 3)

        engine_statuses = {}
        for engine_key in [
            "profile_analysis_engine",
            "input_engine",
            "advanced_flower_engine",
            "station_engine",
            "roll_logic_engine",
            "shaft_engine",
            "bearing_engine",
            "duty_engine",
            "roll_design_calc_engine",
            "machine_layout_engine",
            "roll_contour_engine",
            "cam_prep_engine",
            "flower_svg_engine",
            "roll_groove_svg_engine",
        ]:
            val = pipeline.get(engine_key)
            if isinstance(val, dict):
                engine_statuses[engine_key] = val.get("status", "unknown")

        output_payload = {
            "drawing_id": case.drawing_id,
            "difficulty_tier": case.difficulty_tier,
            "description": case.description,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "input_parameters": input_payload,
            "material_data": pipeline.get("input_engine", {}),
            "cross_section_dimensions_mm": {
                "section_width_mm": case.section_width_mm,
                "section_height_mm": case.section_height_mm,
            },
            "bend_data": {
                "bend_count": case.bend_count,
                "return_bends_count": case.return_bends_count,
                "lips_present": case.lips_present,
                "lip_mm": case.lip_mm,
            },
            "station_planning_data": {
                "n_stations_requested": case.n_stations,
                "n_stations_recommended": pipeline.get("station_engine", {}).get("recommended_station_count"),
                "passes_generated": len(pipeline.get("roll_contour_engine", {}).get("passes", [])),
            },
            "generated_geometry_output": {
                "profile_type_resolved": pipeline.get("profile_analysis_engine", {}).get("profile_type"),
                "forming_summary": pipeline.get("roll_contour_engine", {}).get("forming_summary", {}),
                "interference_summary": pipeline.get("roll_contour_engine", {}).get("interference_summary", {}),
            },
            "roll_design_output": {
                "status": pipeline.get("roll_contour_engine", {}).get("status"),
                "pass_count": len(pipeline.get("roll_contour_engine", {}).get("passes", [])),
                "calibration_pass_present": bool(pipeline.get("roll_contour_engine", {}).get("calibration_pass")),
            },
            "simulation_precheck_output": {
                "advanced_sim_status": advanced_sim_result.get("status"),
                "advanced_sim_label": advanced_sim_result.get("label"),
                "advanced_sim_process_verdict": advanced_sim_result.get("process_verdict"),
                "advanced_total_passes": advanced_sim_result.get("total_passes"),
                "simple_sim_status": simple_sim_result.get("status"),
                "simple_quality": simple_sim_result.get("quality", {}),
                "simple_total_passes": simple_sim_result.get("total_passes"),
            },
            "bom_output": {
                "status": bom_result.get("status"),
                "total_items": bom_result.get("total_items"),
                "total_weight_kg_estimate": bom_result.get("total_weight_kg_estimate"),
            },
            "process_card_output": {
                "status": process_card_result.get("status"),
                "card_count": process_card_result.get("card_count"),
                "blocking": process_card_result.get("blocking"),
            },
            "cad_export_output": {
                "status": cad_result.get("status"),
                "capabilities": cad_result.get("capabilities", {}),
                "total_files": cad_result.get("total_files"),
                "session_dir": cad_result.get("session_dir"),
                "file_manifest": cad_result.get("file_manifest", []),
            },
            "preview_output": {
                "flower_svg_status": flower_svg_result.get("status"),
                "roll_svg_status": roll_svg_result.get("status"),
            },
            "engine_statuses": engine_statuses,
            "checks": checks,
            "runtime_seconds": runtime_seconds,
            "generation_status": generation_status,
            "export_status": export_status,
            "validation_status": validation_status,
            "artifact_paths": artifact_paths,
            "notes": notes,
            "exception": exception_text,
        }

        output_path = dirs["outputs"] / f"{case.drawing_id}_output.json"
        _to_json(output_payload, output_path)
        artifact_paths.append(str(output_path))

        if generation_status != "VERIFIED":
            failed_copy = dirs["failed_cases"] / f"{case.drawing_id}_output.json"
            shutil.copy2(output_path, failed_copy)

        case_log_lines.append(f"generation_status={generation_status}")
        case_log_lines.append(f"runtime_seconds={runtime_seconds}")
        if notes:
            case_log_lines.append(f"notes={' | '.join(notes)}")
        if exception_text:
            case_log_lines.append("traceback:")
            case_log_lines.append(exception_text)
        _write_text(dirs["logs"] / f"{case.drawing_id}.log", "\n".join(case_log_lines) + "\n")

        case_results.append(output_payload)
        case_statuses[case.drawing_id] = generation_status
        manifest_rows.append(_manifest_row(case, output_payload))

    # Manifest CSV
    manifest_path = dirs["reports"] / "STAGE1_MANIFEST.csv"
    manifest_fields = [
        "drawing_id",
        "difficulty_tier",
        "profile_type",
        "material",
        "thickness",
        "dimensions_mm",
        "bend_count",
        "return_bends_count",
        "generation_status",
        "export_status",
        "validation_status",
        "artifact_paths",
        "notes",
    ]
    with manifest_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=manifest_fields)
        writer.writeheader()
        for row in manifest_rows:
            writer.writerow(row)

    status_counter = Counter(case_statuses.values())
    duplicates = {sig: ids for sig, ids in signatures.items() if len(ids) > 1}
    profile_counter = Counter(c.profile_type for c in CASES)
    material_counter = Counter(c.material for c in CASES)
    thickness_values = [c.thickness for c in CASES]

    total_attempted = len(CASES)
    total_verified = status_counter.get("VERIFIED", 0)
    total_partial = status_counter.get("PARTIAL", 0)
    total_failed = status_counter.get("FAILED", 0)

    if total_attempted < 20:
        final_verdict = "FAILED"
    elif duplicates:
        final_verdict = "FAILED"
    elif total_verified == 20 and total_partial == 0 and total_failed == 0:
        final_verdict = "VERIFIED"
    elif total_failed > 0:
        final_verdict = "FAILED"
    else:
        final_verdict = "PARTIAL"

    run_duration = round(time.time() - run_start, 3)

    uniqueness_report = {
        "status": "pass" if not duplicates else "fail",
        "duplicate_case_groups": list(duplicates.values()),
        "duplicate_group_count": len(duplicates),
        "profile_distribution": dict(profile_counter),
        "material_distribution": dict(material_counter),
        "thickness_min": min(thickness_values) if thickness_values else None,
        "thickness_max": max(thickness_values) if thickness_values else None,
    }
    _to_json(uniqueness_report, dirs["reports"] / "STAGE1_UNIQUENESS_REPORT.json")

    summary = {
        "run_started_at_utc": run_started_at,
        "run_duration_seconds": run_duration,
        "total_attempted": total_attempted,
        "total_verified": total_verified,
        "total_partial": total_partial,
        "total_failed": total_failed,
        "final_verdict": final_verdict,
        "output_root": str(output_root),
        "manifest_csv": str(manifest_path),
    }
    _to_json(summary, dirs["reports"] / "STAGE1_SUMMARY.json")

    # Markdown reports
    execution_md = "\n".join(
        [
            "# Stage 1 Execution Report (20 Hard Cases)",
            "",
            "## Objective",
            "Generate 20 difficult, diverse engineering cases with reproducible inputs, outputs, exports, previews, and logs.",
            "",
            "## Command",
            f"`python artifacts/python-api/scripts/stage1_generate_20_cases.py --output-root \"{str(output_root)}\"`",
            "",
            "## Summary",
            f"- Total attempted: {total_attempted}",
            f"- Verified: {total_verified}",
            f"- Partial: {total_partial}",
            f"- Failed: {total_failed}",
            f"- Final verdict: **{final_verdict}**",
            f"- Run duration (s): {run_duration}",
            "",
            "## Artifacts",
            f"- Manifest: `{str(manifest_path)}`",
            f"- Summary JSON: `{str(dirs['reports'] / 'STAGE1_SUMMARY.json')}`",
            f"- Uniqueness JSON: `{str(dirs['reports'] / 'STAGE1_UNIQUENESS_REPORT.json')}`",
            f"- Dataset dir: `{str(dirs['dataset'])}`",
            f"- Outputs dir: `{str(dirs['outputs'])}`",
            f"- Exports dir: `{str(dirs['exports'])}`",
            f"- Previews dir: `{str(dirs['previews'])}`",
            f"- Logs dir: `{str(dirs['logs'])}`",
            "",
            "## Strict Rule Evaluation",
            "- Rule: if any case is fake or missing required proof, stage fails.",
            f"- Result: {final_verdict}",
        ]
    )
    _write_text(dirs["reports"] / "STAGE1_EXECUTION_REPORT.md", execution_md)

    failed_items = [r for r in case_results if r.get("generation_status") != "VERIFIED"]
    if failed_items:
        lines = [
            "# Stage 1 Failure Analysis",
            "",
            "Cases not VERIFIED are listed below.",
            "",
        ]
        for r in failed_items:
            lines.append(f"## {r.get('drawing_id')}")
            lines.append(f"- Status: {r.get('generation_status')}")
            lines.append(f"- Export status: {r.get('export_status')}")
            lines.append(f"- Validation status: {r.get('validation_status')}")
            lines.append(f"- Notes: {' | '.join(r.get('notes', [])) or 'None'}")
            if r.get("exception"):
                lines.append("- Exception: present in case log and output json")
            lines.append("")
        failure_md = "\n".join(lines)
    else:
        failure_md = "# Stage 1 Failure Analysis\n\nAll 20 cases are VERIFIED. No failed or partial cases.\n"
    _write_text(dirs["reports"] / "STAGE1_FAILURE_ANALYSIS.md", failure_md)

    uniq_lines = [
        "# Stage 1 Uniqueness Report",
        "",
        f"- Duplicate groups: {len(duplicates)}",
        f"- Duplicate groups detail: {list(duplicates.values()) if duplicates else 'None'}",
        f"- Profile distribution: {dict(profile_counter)}",
        f"- Material distribution: {dict(material_counter)}",
        f"- Thickness range (mm): {min(thickness_values)} to {max(thickness_values)}",
    ]
    _write_text(dirs["reports"] / "STAGE1_UNIQUENESS_REPORT.md", "\n".join(uniq_lines) + "\n")

    return {
        "summary": summary,
        "manifest_path": str(manifest_path),
        "output_root": str(output_root),
        "case_ids": case_ids,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 1: generate 20 hard engineering cases with proofs.")
    parser.add_argument(
        "--output-root",
        type=str,
        default=str(REPO_ROOT / "artifacts" / "batch_stage1_20_cases"),
        help="Root folder for Stage 1 artifacts.",
    )
    args = parser.parse_args()

    output_root = Path(args.output_root).resolve()
    result = run_stage1(output_root=output_root)

    print("STAGE1_OUTPUT_ROOT=", result["output_root"])
    print("STAGE1_MANIFEST=", result["manifest_path"])
    print("STAGE1_TOTAL_CASES=", len(result["case_ids"]))
    print("STAGE1_DONE=1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

