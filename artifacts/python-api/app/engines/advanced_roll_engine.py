"""
advanced_roll_engine.py — Advanced Roll Contour Engine

Generates bend-wise progressive roll profiles for each station:
  • Pass ratio scheduling (cubic ease with profile-type adjustment)
  • Corner radius handling per pass ratio + thickness
  • Lip-specific pass control (lipped_channel early-pass lip dampening)
  • Return bend clearance (additive offset per return bend count)
  • Upper / lower roll contour split with forming gap
  • Per-stand notes (entry / intermediate / calibration stage labels)

Blueprint source: Advance Roll Engine + Export Engine blueprint.
"""
import math
from typing import Any, Dict, List, Tuple

from app.utils.response import pass_response, fail_response

Point = Tuple[float, float]


# ── Springback compensation ────────────────────────────────────────────────────
def get_springback(material: str) -> float:
    return {
        "GI": 1.5,
        "MS": 2.5,
        "CR": 2.5,
        "SS": 4.0,
        "HR": 3.0,
        "AL": 1.0,
    }.get(material.upper(), 2.0)


# ── Roll gap (forming gap = thickness + clearance) ────────────────────────────
def calculate_gap(thickness: float) -> float:
    if thickness < 1.0:
        return thickness + 0.05
    if thickness < 2.0:
        return thickness + 0.10
    return thickness + 0.15


# ── Final profile geometry ─────────────────────────────────────────────────────
def build_final_profile(
    profile_result: Dict[str, Any],
    section_features: Dict[str, Any],
) -> List[Point]:
    width  = float(profile_result.get("section_width_mm", 100))
    height = float(profile_result.get("section_height_mm", 50))
    ptype  = str(profile_result.get("profile_type", "simple_channel"))

    if ptype == "simple_channel":
        return [(0, 0), (0, height), (width, height), (width, 0)]

    if ptype == "lipped_channel":
        lip = min(12.0, width * 0.1)
        return [
            (0, 0), (0, lip), (0, height),
            (width, height), (width, lip), (width, 0),
        ]

    if ptype == "shutter_profile":
        mid = width / 2
        return [
            (0, 0),
            (0, height * 0.5),
            (mid * 0.5, height),
            (mid, height * 0.7),
            (width, height * 0.5),
            (width, 0),
        ]

    # generic / complex
    return [
        (0, 0), (0, height),
        (width * 0.3, height),
        (width * 0.5, height * 0.85),
        (width * 0.7, height),
        (width, height),
        (width, 0),
    ]


# ── Pass ratio schedule ────────────────────────────────────────────────────────
def build_pass_ratios(
    station_count: int,
    profile_type: str,
    return_bends: int,
) -> List[float]:
    ratios: List[float] = []
    for i in range(1, station_count + 1):
        r = i / station_count
        # complex profiles get a steeper curve (more forming at end)
        if profile_type in {"complex_profile", "complex_section", "shutter_profile"}:
            r = r ** 1.15
        # return bends shift ratios slightly later to reserve clearance room
        if return_bends > 0:
            r = min(1.0, r * 0.98 + 0.02)
        ratios.append(r)
    return ratios


# ── Profile morphing ───────────────────────────────────────────────────────────
def morph_profile(final_profile: List[Point], ratio: float) -> List[Point]:
    return [(round(x, 4), round(y * ratio, 4)) for x, y in final_profile]


def apply_radius_logic(
    profile: List[Point],
    thickness: float,
    ratio: float,
) -> List[Point]:
    smooth = min(1.0, ratio + thickness * 0.05)
    return [(round(x, 4), round(y * smooth, 4)) for x, y in profile]


def apply_lip_logic(profile: List[Point], profile_type: str, ratio: float) -> List[Point]:
    if profile_type != "lipped_channel" or len(profile) < 6:
        return profile
    adjusted = list(profile)
    # early passes: lip is not yet fully formed — dampen outer lip points
    if ratio < 0.5:
        adjusted[1]  = (adjusted[1][0],  round(adjusted[1][1]  * 0.6, 4))
        adjusted[-2] = (adjusted[-2][0], round(adjusted[-2][1] * 0.6, 4))
    return adjusted


def apply_return_bend_clearance(
    profile: List[Point],
    return_bends: int,
    thickness: float,
    ratio: float,
) -> List[Point]:
    if return_bends <= 0:
        return profile
    clearance = thickness * 0.15 * ratio
    return [(round(x, 4), round(y + clearance, 4)) for x, y in profile]


# ── Upper / lower split ────────────────────────────────────────────────────────
def split_upper_lower(
    profile: List[Point],
    gap: float,
) -> Tuple[List[Point], List[Point]]:
    upper = [(round(x, 4), round(y + gap / 2, 4)) for x, y in profile]
    lower = [(round(x, 4), round(y - gap / 2, 4)) for x, y in profile]
    return upper, lower


# ── Stand notes ────────────────────────────────────────────────────────────────
def build_stand_notes(
    stand_no: int,
    station_count: int,
    profile_type: str,
    return_bends: int,
) -> List[str]:
    notes: List[str] = []
    if stand_no <= 2:
        notes.append("Entry / pre-form stage")
    elif stand_no >= station_count - 1:
        notes.append("Calibration stage — final sizing")
    else:
        notes.append("Intermediate progressive forming stage")

    if profile_type == "lipped_channel":
        notes.append("Lip forming control required")
    if profile_type in {"shutter_profile", "complex_profile", "complex_section"}:
        notes.append("Complex contour — verify with profile projector")
    if return_bends > 0:
        notes.append("Return bend clearance check required at this stand")
    return notes


# ── Main entry point ───────────────────────────────────────────────────────────
def generate_advanced_rolls(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    station_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate pass-wise upper/lower roll profiles for every station.
    """
    if not profile_result:
        return fail_response("advanced_roll_engine", "Profile result missing")
    if not input_result:
        return fail_response("advanced_roll_engine", "Input result missing")
    if not flower_result:
        return fail_response("advanced_roll_engine", "Flower result missing")
    if not station_result:
        return fail_response("advanced_roll_engine", "Station result missing")

    thickness     = float(input_result.get("sheet_thickness_mm", 0))
    material      = str(input_result.get("material", "GI")).upper()
    section_w     = float(profile_result.get("section_width_mm", 0))
    section_h     = float(profile_result.get("section_height_mm", 0))
    bend_count    = int(profile_result.get("bend_count", 0))
    return_bends  = int(profile_result.get("return_bends_count", 0))
    profile_type  = str(profile_result.get("profile_type", "custom"))
    station_count = int(station_result.get("recommended_station_count", 0))
    section_features = profile_result.get("section_features", {}) or {}

    if thickness <= 0:
        return fail_response("advanced_roll_engine", "Invalid thickness")
    if section_w <= 0 and section_h <= 0:
        return fail_response("advanced_roll_engine", "Invalid profile dimensions")
    if station_count <= 0:
        return fail_response("advanced_roll_engine", "Invalid station count")

    springback   = get_springback(material)
    forming_gap  = calculate_gap(thickness)
    final_profile = build_final_profile(profile_result, section_features)

    stand_data: List[Dict[str, Any]] = []
    pass_ratios = build_pass_ratios(station_count, profile_type, return_bends)

    for idx, ratio in enumerate(pass_ratios, start=1):
        p = morph_profile(final_profile, ratio)
        p = apply_radius_logic(p, thickness, ratio)
        p = apply_lip_logic(p, profile_type, ratio)
        p = apply_return_bend_clearance(p, return_bends, thickness, ratio)

        upper, lower = split_upper_lower(p, forming_gap)

        stand_data.append({
            "stand_no":       idx,
            "pass_ratio":     round(ratio, 4),
            "target_gap_mm":  round(forming_gap, 4),
            "springback_deg": springback,
            "upper_profile":  [{"x": pt[0], "y": pt[1]} for pt in upper],
            "lower_profile":  [{"x": pt[0], "y": pt[1]} for pt in lower],
            "profile_notes":  build_stand_notes(idx, station_count, profile_type, return_bends),
        })

    warnings: List[str] = []
    if return_bends > 0:
        warnings.append("Return bends require manual clearance verification")
    if profile_type in {"complex_profile", "complex_section", "shutter_profile"}:
        warnings.append("Complex contour requires expert tooling verification")
    if material == "SS":
        warnings.append("SS: tighter springback review required")

    confidence = "medium" if profile_type in {"complex_profile", "complex_section", "shutter_profile"} else "high"

    return pass_response("advanced_roll_engine", {
        "profile_type":   profile_type,
        "station_count":  station_count,
        "forming_gap_mm": round(forming_gap, 4),
        "springback_deg": springback,
        "stand_data":     stand_data,
        "confidence":     confidence,
        "blocking":       False,
        "warnings":       warnings,
        "assumptions": [
            "Rule-based roll contour generation used",
            "Final production roll contour requires tooling approval",
        ],
    })
