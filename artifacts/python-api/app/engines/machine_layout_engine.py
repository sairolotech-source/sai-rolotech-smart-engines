"""
machine_layout_engine.py — Machine Layout Engine
Generates complete roll forming machine layout specifications:
  stand_spacing, shaft_center_distance, drive_type, motor_kW,
  gearbox_ratio, entry_guide, straightener, frame, line_length_m
"""
import logging
from typing import Dict, Any, List

from app.utils.response import pass_response

logger = logging.getLogger("machine_layout_engine")

# ─── Rule tables ──────────────────────────────────────────────────────────────

STAND_SPACING: Dict[str, int] = {
    "light":      400,
    "medium":     500,
    "heavy":      600,
    "industrial": 700,
}

MOTOR_KW: Dict[str, float] = {
    "light":      3.7,
    "medium":     7.5,
    "heavy":      15.0,
    "industrial": 22.0,
}

MOTOR_LABEL: Dict[str, str] = {
    "light":      "3.7 kW (5 HP)",
    "medium":     "7.5 kW (10 HP)",
    "heavy":      "15 kW (20 HP)",
    "industrial": "22 kW (30 HP)",
}

FRAME_TYPE: Dict[str, str] = {
    "light":      "welded_mild_steel_frame",
    "medium":     "welded_mild_steel_frame",
    "heavy":      "heavy_welded_steel_frame",
    "industrial": "heavy_welded_steel_frame",
}

COIL_STAND_TYPE: Dict[str, str] = {
    "light":      "manual_decoiler",
    "medium":     "powered_decoiler",
    "heavy":      "powered_decoiler_with_cradle",
    "industrial": "double_head_powered_decoiler",
}

ENTRY_SECTION_MM  = 1500    # entry guide + straightener section
EXIT_SECTION_MM   = 1000    # cut-off + exit conveyor section
GEARBOX_RATIO     = 10      # standard ratio 10:1
CLEARANCE_MM      = 40      # shaft bore + bearing housing wall allowance

STRAIGHTENER_MATERIALS = {"SS", "HR", "HARDOX", "STAINLESS"}

# ─── Public entry point ────────────────────────────────────────────────────────

def generate_machine_layout(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    station_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
    bearing_result: Dict[str, Any],
    roll_calc_result: Dict[str, Any],
    duty_result: Dict[str, Any],
) -> Dict[str, Any]:

    duty_class    = str(duty_result.get("duty_class", "medium")).lower()
    station_count = int(station_result.get("recommended_station_count", 6))
    shaft_dia     = float(shaft_result.get("suggested_shaft_diameter_mm", 50))
    roll_od       = float(roll_calc_result.get("estimated_roll_od_mm", 100))
    section_width = float(profile_result.get("section_width_mm", 100))
    bend_count    = int(profile_result.get("bend_count", 4))
    material      = str(input_result.get("material", "CR")).upper()
    complexity    = str(profile_result.get("complexity_tier", "medium"))

    warnings: List[str] = []
    assumptions: List[str] = []

    # ── Stand spacing ─────────────────────────────────────────────────────────
    stand_spacing_mm = STAND_SPACING.get(duty_class, 500)

    # Widen spacing for complex profiles (more roll diameter needed)
    if complexity in {"complex", "very_complex"}:
        stand_spacing_mm += 50
        assumptions.append("Stand spacing increased +50mm for complex profile clearance")

    # ── Shaft center distance (top shaft to bottom shaft) ─────────────────────
    # = top roll OD/2 + pass_gap + bottom roll OD/2
    # Simplified: roll_od + vertical_gap + clearance
    vert_gap = float(roll_calc_result.get("estimated_vertical_gap_mm", 3.0))
    shaft_center_distance_mm = round(roll_od + vert_gap + CLEARANCE_MM, 1)

    # ── Drive type ────────────────────────────────────────────────────────────
    if station_count <= 8:
        drive_type = "chain_drive"
        drive_note = "Chain drive suitable for ≤8 stations"
    elif station_count <= 16:
        drive_type = "gear_drive"
        drive_note = "Gear drive recommended for 9–16 stations"
    else:
        drive_type = "tandem_gear_drive"
        drive_note = "Tandem gear drive required for >16 stations"

    # ── Motor ─────────────────────────────────────────────────────────────────
    motor_kw     = MOTOR_KW.get(duty_class, 7.5)
    motor_label  = MOTOR_LABEL.get(duty_class, "7.5 kW (10 HP)")

    # ── Gearbox ───────────────────────────────────────────────────────────────
    gearbox_ratio   = GEARBOX_RATIO
    gearbox_label   = f"{gearbox_ratio}:1 helical gearbox"

    # ── Entry guide ───────────────────────────────────────────────────────────
    entry_guide_recommended = bend_count >= 2
    entry_guide_type = "adjustable_side_roller_guide" if bend_count >= 2 else "fixed_guide"
    if entry_guide_recommended:
        entry_guide_note = "Adjustable entry guide roller set recommended for accurate strip alignment"
    else:
        entry_guide_note = "Basic fixed entry guide sufficient"

    # ── Straightener ──────────────────────────────────────────────────────────
    straightener_recommended = material in STRAIGHTENER_MATERIALS
    if straightener_recommended:
        straightener_type = "7-roller_straightener"
        straightener_note = f"{material} material — straightener required to control springback and coil set"
    else:
        straightener_type = "not_required"
        straightener_note = "Straightener not required for this material grade"

    # ── Frame ─────────────────────────────────────────────────────────────────
    frame_type   = FRAME_TYPE.get(duty_class, "welded_mild_steel_frame")
    frame_note   = "Stress-relieved welded frame with base plate" if duty_class in {"heavy", "industrial"} else "Standard welded frame"

    # ── Coil stand ────────────────────────────────────────────────────────────
    coil_stand   = COIL_STAND_TYPE.get(duty_class, "powered_decoiler")
    if section_width >= 400:
        coil_stand = "double_head_powered_decoiler"
        assumptions.append("Section width ≥400mm — double-head decoiler recommended")

    # ── Line length ───────────────────────────────────────────────────────────
    machine_section_mm = station_count * stand_spacing_mm
    total_line_mm      = machine_section_mm + ENTRY_SECTION_MM + EXIT_SECTION_MM
    total_line_m       = round(total_line_mm / 1000.0, 2)
    machine_section_m  = round(machine_section_mm / 1000.0, 2)

    # ── Production speed ──────────────────────────────────────────────────────
    if duty_class == "light":
        line_speed_mpm = "10–20 m/min"
    elif duty_class == "medium":
        line_speed_mpm = "15–25 m/min"
    elif duty_class == "heavy":
        line_speed_mpm = "8–18 m/min"
    else:
        line_speed_mpm = "6–15 m/min"

    # ── Warnings ──────────────────────────────────────────────────────────────
    if roll_od < shaft_dia + 20:
        warnings.append("Roll OD very close to shaft diameter — verify bore and wall thickness")

    if station_count > 25:
        warnings.append("High station count — consider tandem machine or split line configuration")

    if section_width > 500:
        warnings.append("Wide section — verify straightener and entry guide lateral capacity")

    logger.info(
        "[machine_layout_engine] duty=%s stations=%d spacing=%dmm length=%.2fm drive=%s motor=%s",
        duty_class, station_count, stand_spacing_mm, total_line_m, drive_type, motor_label,
    )

    return pass_response("machine_layout_engine", {
        "confidence": "high",
        "blocking": False,
        "warnings": warnings,
        "assumptions": assumptions,
        "duty_class": duty_class,
        "stand_count": station_count,
        "stand_spacing_mm": stand_spacing_mm,
        "shaft_center_distance_mm": shaft_center_distance_mm,
        "drive_type": drive_type,
        "drive_note": drive_note,
        "motor_kw": motor_kw,
        "motor_label": motor_label,
        "gearbox_ratio": gearbox_ratio,
        "gearbox_label": gearbox_label,
        "entry_guide_recommended": entry_guide_recommended,
        "entry_guide_type": entry_guide_type,
        "entry_guide_note": entry_guide_note,
        "straightener_recommended": straightener_recommended,
        "straightener_type": straightener_type,
        "straightener_note": straightener_note,
        "frame_type": frame_type,
        "frame_note": frame_note,
        "coil_stand_type": coil_stand,
        "line_speed_mpm": line_speed_mpm,
        "line_length_summary": {
            "entry_and_straightener_m": round(ENTRY_SECTION_MM / 1000.0, 2),
            "roll_forming_section_m": machine_section_m,
            "exit_and_cutoff_m": round(EXIT_SECTION_MM / 1000.0, 2),
            "total_line_length_m": total_line_m,
        },
        "total_line_length_m": total_line_m,
    })
