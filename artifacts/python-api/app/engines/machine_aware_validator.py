"""
machine_aware_validator.py — Machine-Aware Engineering Validation Engine
════════════════════════════════════════════════════════════════════════
Phase C: Cross-validates a roll forming job against a specific machine config.

Given:
  - profile_result   (from profile_analysis_engine or input)
  - input_result     (material, thickness, strip width)
  - station_result   (required station count)
  - contour_result   (max roll OD from passes)
  - machine_id       (from machine_config_store)

Returns:
  - feasibility decision (pass / partial / reject)
  - per-limit check results
  - adjusted engineering parameters (gap, angle, tension factor)
  - tooling recommendation constrained to machine limits
  - process_constraints dict (for process_card_engine)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.utils.machine_config_store import (
    MACHINE_REGISTRY,
    get_machine,
    validate_profile_on_machine,
    find_capable_machines,
)
from app.utils.tooling_library import get_best_match, query_tooling_library
from app.utils.response import pass_response, fail_response

logger = logging.getLogger("machine_aware_validator")


# ── PUBLIC API ─────────────────────────────────────────────────────────────────

def validate_job_on_machine(
    machine_id: str,
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    station_result: Dict[str, Any],
    contour_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Full machine-aware validation of a roll forming job.

    Args:
        machine_id:      Target machine (from MACHINE_REGISTRY or persisted)
        profile_result:  profile_type, bend_count, section dimensions, lip_mm
        input_result:    sheet_thickness_mm, material, flat_blank_mm
        station_result:  recommended_station_count
        contour_result:  passes[] with upper_roll_radius_mm (optional but gives OD check)

    Returns:
        pass_response with: feasibility, blocking_reasons, warnings,
        adjusted_params, tooling_recommendation, process_constraints
    """
    mc = get_machine(machine_id)
    if not mc:
        return fail_response(
            "machine_aware_validator",
            f"Machine '{machine_id}' not found — use list_machines() to see available IDs",
        )

    profile_type  = str(profile_result.get("profile_type", "c_channel")).lower()
    bend_count    = int(profile_result.get("bend_count", 2))
    thickness_mm  = float(input_result.get("sheet_thickness_mm", 1.5))
    material      = str(input_result.get("material", "GI")).upper()
    flat_blank    = float(input_result.get("flat_blank_mm", 200.0))
    req_stations  = int(station_result.get("recommended_station_count", 8))

    # Estimate strip width from flat blank (strip_width ≈ flat_blank ± 10%)
    strip_width_mm = flat_blank

    # Max roll OD from contour passes
    max_od_mm = 0.0
    if contour_result:
        for p in contour_result.get("passes", []):
            od = p.get("upper_roll_radius_mm", 0) * 2
            if od > max_od_mm:
                max_od_mm = od
        cal = contour_result.get("calibration_pass", {})
        cal_od = cal.get("upper_roll_radius_mm", 0) * 2
        if cal_od > max_od_mm:
            max_od_mm = cal_od

    # ── Core feasibility check ─────────────────────────────────────────────────
    v = validate_profile_on_machine(
        machine_id, profile_type, thickness_mm,
        strip_width_mm, bend_count, material,
        req_stations, max_od_mm,
    )

    # ── Machine-constrained tooling recommendation ─────────────────────────────
    tc = mc.get("tooling_constraints", {})
    shaft_dia = tc.get("shaft_dia_mm", mc.get("shaft_diameter_mm", 50))
    max_od    = tc.get("max_od_mm", mc.get("max_roll_od_mm", 220))

    tooling_rec = _get_machine_constrained_tooling(
        profile_type, material, thickness_mm, shaft_dia, max_od
    )

    # ── Process constraints for process_card_engine ────────────────────────────
    plr = mc.get("pass_limit_rules", {})
    offsets = mc.get("calibration_offsets", {})

    process_constraints = {
        "machine_id":                machine_id,
        "machine_display_name":      mc.get("display_name", machine_id),
        "machine_class":             mc.get("machine_class", "standard"),
        "max_stand_count":           mc["stand_count"],
        "effective_station_count":   v["adjusted_params"].get("station_count", req_stations),
        "roll_gap_correction_mm":    offsets.get("roll_gap_correction_mm", 0.05),
        "angle_correction_deg":      offsets.get("angle_correction_deg", 0.3),
        "strip_tension_factor":      offsets.get("strip_tension_factor", 1.0),
        "max_line_speed_mpm":        mc.get("max_line_speed_mpm", 15.0),
        "motor_power_kw":            mc.get("motor_power_kw", 22.0),
        "min_bend_radius_x_t":       plr.get("min_bend_radius_x_t", 1.2),
        "shaft_diameter_mm":         shaft_dia,
        "bearing_series":            tc.get("bearing_series", "6210"),
        "max_roll_od_mm":            max_od,
        "allow_tube_profiles":       plr.get("allow_tube_profiles", False),
    }

    # ── Feasibility tier ───────────────────────────────────────────────────────
    if not v["feasible"]:
        feasibility = "reject"
    elif v["warnings"]:
        feasibility = "partial"
    else:
        feasibility = "pass"

    # ── Alternative machines if rejected ──────────────────────────────────────
    alternatives: List[Dict] = []
    if feasibility == "reject":
        alt = find_capable_machines(
            profile_type, thickness_mm, strip_width_mm,
            bend_count, material, req_stations, max_od_mm,
        )
        alternatives = [
            {"machine_id": a["machine_id"], "display_name": a.get("machine_display_name", "")}
            for a in alt[:3] if a["feasible"]
        ]

    return pass_response("machine_aware_validator", {
        "feasibility":         feasibility,
        "machine_id":          machine_id,
        "machine_class":       mc.get("machine_class", "standard"),
        "blocking_reasons":    v["blocking_reasons"],
        "warnings":            v["warnings"],
        "adjusted_params":     v["adjusted_params"],
        "machine_utilisation": v["machine_utilisation"],
        "tooling_recommendation": tooling_rec,
        "process_constraints": process_constraints,
        "alternative_machines": alternatives,
        "validation_detail": {
            "profile_type":    profile_type,
            "material":        material,
            "thickness_mm":    thickness_mm,
            "strip_width_mm":  strip_width_mm,
            "bend_count":      bend_count,
            "req_stations":    req_stations,
            "max_od_needed_mm": round(max_od_mm, 1),
        },
    })


def select_best_machine(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    station_result: Dict[str, Any],
    contour_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Auto-select the best machine from the registry for a given profile.
    Returns the machine with lowest utilisation that can handle the profile.
    """
    profile_type = str(profile_result.get("profile_type", "c_channel")).lower()
    bend_count   = int(profile_result.get("bend_count", 2))
    thickness_mm = float(input_result.get("sheet_thickness_mm", 1.5))
    material     = str(input_result.get("material", "GI")).upper()
    flat_blank   = float(input_result.get("flat_blank_mm", 200.0))
    req_stations = int(station_result.get("recommended_station_count", 8))

    max_od_mm = 0.0
    if contour_result:
        for p in contour_result.get("passes", []):
            od = p.get("upper_roll_radius_mm", 0) * 2
            if od > max_od_mm:
                max_od_mm = od

    ranked = find_capable_machines(
        profile_type, thickness_mm, flat_blank,
        bend_count, material, req_stations, max_od_mm,
    )

    capable = [r for r in ranked if r["feasible"]]
    if not capable:
        return fail_response(
            "machine_aware_validator",
            f"No machine in registry can produce this profile "
            f"(t={thickness_mm}mm, mat={material}, bends={bend_count}, stations={req_stations}). "
            f"Blocking reasons: {ranked[0]['blocking_reasons'] if ranked else 'unknown'}"
        )

    best = capable[0]
    return pass_response("machine_aware_validator", {
        "selected_machine_id":    best["machine_id"],
        "machine_display_name":   best.get("machine_display_name", ""),
        "machine_class":          best.get("machine_class", ""),
        "machine_utilisation":    best["machine_utilisation"],
        "warnings":               best["warnings"],
        "adjusted_params":        best["adjusted_params"],
        "all_capable_machines":   [r["machine_id"] for r in capable],
        "all_incapable_machines": [
            {"machine_id": r["machine_id"], "reasons": r["blocking_reasons"]}
            for r in ranked if not r["feasible"]
        ],
    })


# ── PRIVATE ────────────────────────────────────────────────────────────────────

def _get_machine_constrained_tooling(
    profile_type: str,
    material: str,
    thickness_mm: float,
    shaft_dia_mm: int,
    max_od_mm: float,
) -> Optional[Dict[str, Any]]:
    """Get the best tooling entry that fits within machine constraints."""
    candidate = get_best_match(profile_type, material, thickness_mm)
    if not candidate:
        return None

    # Check shaft dia compatibility
    if candidate.get("shaft_dia_mm", 0) > shaft_dia_mm * 1.1:
        # Try fallback: look for an entry in the same family with smaller shaft
        fallbacks = query_tooling_library(section_type=profile_type, thickness_mm=thickness_mm)
        for fb in fallbacks:
            if fb.get("shaft_dia_mm", 0) <= shaft_dia_mm:
                candidate = fb
                break

    if candidate.get("roll_od_max_mm", 0) > max_od_mm:
        candidate = dict(candidate)
        candidate["_machine_od_warning"] = (
            f"Tooling standard OD {candidate.get('roll_od_max_mm')}mm "
            f"exceeds machine limit {max_od_mm}mm — custom tooling OD required"
        )

    candidate["_machine_shaft_dia_mm"] = shaft_dia_mm
    candidate["_machine_max_od_mm"]    = max_od_mm
    return candidate
