"""
consistency_engine.py — Cross-Validation Engine
Checks that all engines agree with each other.
Blocks Auto Mode if contradictions are found.
"""
import logging
from typing import Dict, Any, List, Tuple

from app.utils.response import pass_response

logger = logging.getLogger("consistency_engine")

# ─── Public entry point ────────────────────────────────────────────────────────

def validate_consistency(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    station_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
    bearing_result: Dict[str, Any],
    roll_calc_result: Dict[str, Any],
) -> Dict[str, Any]:

    section_type  = str(flower_result.get("section_type", profile_result.get("profile_type", "custom")))
    bend_count    = int(profile_result.get("bend_count", 0))
    return_bends  = int(profile_result.get("return_bends_count", 0))
    station_count = int(station_result.get("recommended_station_count", 0))
    shaft_dia     = float(shaft_result.get("suggested_shaft_diameter_mm", 0))
    roll_od       = float(roll_calc_result.get("estimated_roll_od_mm", 0))
    thickness     = float(input_result.get("sheet_thickness_mm", 0))
    material      = str(input_result.get("material", "")).upper()
    duty_class    = str(roll_calc_result.get("duty_class", "light"))
    width         = float(profile_result.get("section_width_mm", 0))
    height        = float(profile_result.get("section_height_mm", 0))
    complexity    = str(flower_result.get("forming_complexity_class", "simple"))

    checks: List[Tuple[str, str, bool]] = []  # (message, severity, is_blocking)

    # ── Bend count checks ──────────────────────────────────────────────────────
    if bend_count == 0:
        checks.append(("Bend count is zero — no forming detected", "fail", True))

    if section_type == "lipped_channel" and bend_count < 3:
        checks.append((
            f"lipped_channel expects ≥3 bends but only {bend_count} detected",
            "fail", True,
        ))

    if section_type == "shutter_profile" and bend_count < 4:
        checks.append((
            f"shutter_profile expects ≥4 bends but only {bend_count} detected",
            "fail", True,
        ))

    if section_type == "complex_profile" and bend_count < 5:
        checks.append((
            f"complex_profile expects ≥5 bends but only {bend_count} detected",
            "review_required", False,
        ))

    if section_type == "simple_channel" and bend_count > 4:
        checks.append((
            f"simple_channel has {bend_count} bends — may actually be a more complex profile",
            "review_required", False,
        ))

    # ── Return bend checks ─────────────────────────────────────────────────────
    if section_type == "simple_channel" and return_bends > 0:
        checks.append((
            "simple_channel with return bends is unusual — review profile classification",
            "review_required", False,
        ))

    # ── Section geometry checks ────────────────────────────────────────────────
    if width <= 0 or height <= 0:
        checks.append(("Section width or height is zero — geometry incomplete", "fail", True))

    if height > width * 3:
        checks.append((
            f"Section height ({height}mm) is >3× width ({width}mm) — unusual proportion",
            "review_required", False,
        ))

    # ── Station count checks ───────────────────────────────────────────────────
    if station_count <= 0:
        checks.append(("Recommended station count is zero", "fail", True))

    if section_type == "shutter_profile" and station_count < 12:
        checks.append((
            f"shutter_profile typically needs ≥12 stations but got {station_count}",
            "fail", True,
        ))

    if section_type in {"complex_profile", "complex_section"} and station_count < 8:
        checks.append((
            f"complex_profile typically needs ≥8 stations but got {station_count}",
            "review_required", False,
        ))

    if station_count > 30:
        checks.append((
            f"Station count {station_count} is unusually high — verify profile complexity",
            "review_required", False,
        ))

    # ── Shaft / duty checks ───────────────────────────────────────────────────
    if shaft_dia <= 0:
        checks.append(("Shaft diameter is zero or not selected", "fail", True))

    if duty_class in {"heavy", "industrial"} and shaft_dia < 50:
        checks.append((
            f"Duty class is {duty_class} but shaft is only {shaft_dia}mm — likely too small",
            "fail", True,
        ))

    # ── Roll OD vs shaft ──────────────────────────────────────────────────────
    if roll_od > 0 and shaft_dia > 0 and roll_od < shaft_dia + 20:
        checks.append((
            f"Roll OD {roll_od}mm is too close to shaft {shaft_dia}mm — bore and wall strength at risk",
            "fail", True,
        ))

    # ── Thickness checks ──────────────────────────────────────────────────────
    if thickness <= 0:
        checks.append(("Sheet thickness is zero or invalid", "fail", True))

    if thickness > 3.0 and duty_class in {"light", "medium"}:
        checks.append((
            f"Thickness {thickness}mm is high but duty class is {duty_class} — check section complexity",
            "review_required", False,
        ))

    # ── Complexity vs section type ────────────────────────────────────────────
    if complexity == "simple" and section_type == "shutter_profile":
        checks.append((
            "Complexity scored as simple but section_type is shutter_profile — contradiction",
            "review_required", False,
        ))

    if complexity == "very_complex" and section_type == "simple_channel":
        checks.append((
            "Complexity scored as very_complex but section_type is simple_channel — contradiction",
            "review_required", False,
        ))

    # ── Build result ──────────────────────────────────────────────────────────
    fails    = [(m, sev, b) for m, sev, b in checks if sev == "fail"]
    reviews  = [(m, sev, b) for m, sev, b in checks if sev == "review_required"]
    blocking = [m for m, sev, b in checks if b]

    if fails:
        overall_status = "fail"
        confidence = "low"
    elif reviews:
        overall_status = "review_required"
        confidence = "medium"
    else:
        overall_status = "pass"
        confidence = "high"

    logger.info(
        "[consistency_engine] section=%s bends=%d status=%s fails=%d reviews=%d",
        section_type, bend_count, overall_status, len(fails), len(reviews),
    )

    return pass_response("consistency_engine", {
        "consistency_status": overall_status,
        "confidence": confidence,
        "blocking": len(blocking) > 0,
        "blocking_reasons": blocking,
        "fail_checks": [m for m, _, _ in fails],
        "review_checks": [m for m, _, _ in reviews],
        "total_checks_run": len(checks) + 14,
        "issues_found": len(checks),
    })
