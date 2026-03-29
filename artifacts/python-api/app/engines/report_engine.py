"""
report_engine.py — Engineering Report Generator
Aggregates all pipeline engine outputs into a human-readable engineering summary.
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response, fail_response

logger = logging.getLogger("report_engine")


def generate_report(pipeline: Dict[str, Any]) -> Dict[str, Any]:
    if not pipeline or pipeline.get("status") != "pass":
        return fail_response("report_engine", "Pipeline did not pass — cannot generate report")

    profile = pipeline.get("profile_analysis_engine", {})
    inp = pipeline.get("input_engine", {})
    flower = pipeline.get("advanced_flower_engine", {})
    station = pipeline.get("station_engine", {})
    shaft = pipeline.get("shaft_engine", {})
    bearing = pipeline.get("bearing_engine", {})
    duty = pipeline.get("duty_engine", {})
    roll_calc = pipeline.get("roll_design_calc_engine", {})
    roll_logic = pipeline.get("roll_logic_engine", {})

    summary = build_summary(
        profile=profile,
        inp=inp,
        flower=flower,
        station=station,
        shaft=shaft,
        bearing=bearing,
        duty=duty,
        roll_calc=roll_calc,
    )

    readable = build_readable_report(
        summary=summary,
        profile=profile,
        flower=flower,
        station=station,
        shaft=shaft,
        bearing=bearing,
        duty=duty,
        roll_calc=roll_calc,
        roll_logic=roll_logic,
    )

    logger.info(
        "[report_engine] profile=%s complexity=%s stations=%s",
        summary.get("profile_type"),
        summary.get("forming_complexity_class"),
        summary.get("recommended_station_count"),
    )

    return pass_response("report_engine", {
        "engineering_summary": summary,
        "readable_report": readable,
    })


def build_summary(
    profile: Dict[str, Any],
    inp: Dict[str, Any],
    flower: Dict[str, Any],
    station: Dict[str, Any],
    shaft: Dict[str, Any],
    bearing: Dict[str, Any],
    duty: Dict[str, Any],
    roll_calc: Dict[str, Any],
) -> Dict[str, Any]:
    station_count = station.get("recommended_station_count", "N/A")
    shaft_dia = shaft.get("suggested_shaft_diameter_mm", "N/A")

    line_length = None
    if isinstance(station_count, (int, float)) and isinstance(shaft_dia, (int, float)):
        line_length = round(station_count * 600, 0)

    return {
        "project_type": "Roll Forming Preliminary Engineering",
        "profile_type": flower.get("section_type", profile.get("profile_type", "unknown")),
        "section_width_mm": profile.get("section_width_mm", "N/A"),
        "section_height_mm": profile.get("section_height_mm", "N/A"),
        "bend_count": profile.get("bend_count", "N/A"),
        "return_bends_count": profile.get("return_bends_count", 0),
        "material": inp.get("material", "N/A"),
        "sheet_thickness_mm": inp.get("sheet_thickness_mm", "N/A"),
        "forming_complexity_class": flower.get("forming_complexity_class", "N/A"),
        "complexity_score": flower.get("complexity_score", "N/A"),
        "estimated_forming_passes": flower.get("estimated_forming_passes", "N/A"),
        "recommended_station_count": station_count,
        "shaft_diameter_mm": shaft_dia,
        "bearing_type": bearing.get("suggested_bearing_type", "N/A"),
        "machine_duty_class": duty.get("duty_class", roll_calc.get("duty_class", "N/A")),
        "estimated_roll_od_mm": roll_calc.get("estimated_roll_od_mm", "N/A"),
        "estimated_vertical_gap_mm": roll_calc.get("estimated_vertical_gap_mm", "N/A"),
        "estimated_side_clearance_mm": roll_calc.get("estimated_side_clearance_mm", "N/A"),
        "estimated_line_length_mm": line_length,
    }


def build_readable_report(
    summary: Dict[str, Any],
    profile: Dict[str, Any],
    flower: Dict[str, Any],
    station: Dict[str, Any],
    shaft: Dict[str, Any],
    bearing: Dict[str, Any],
    duty: Dict[str, Any],
    roll_calc: Dict[str, Any],
    roll_logic: Dict[str, Any],
) -> str:
    lines = []

    lines.append("=" * 70)
    lines.append("  SAI ROLOTECH SMART ENGINES v2.2.0")
    lines.append("  ROLL FORMING PRELIMINARY ENGINEERING REPORT")
    lines.append("  *** FOR ENGINEERING REFERENCE ONLY — NOT FINAL TOOLING DOCUMENT ***")
    lines.append("=" * 70)
    lines.append("")

    lines.append("SECTION 1: PROFILE OVERVIEW")
    lines.append("-" * 40)
    lines.append(f"  Profile Type         : {summary['profile_type']}")
    lines.append(f"  Section Width        : {summary['section_width_mm']} mm")
    lines.append(f"  Section Height       : {summary['section_height_mm']} mm")
    lines.append(f"  Bend Count           : {summary['bend_count']}")
    lines.append(f"  Return Bends         : {summary['return_bends_count']}")
    lines.append(f"  Symmetry Status      : {profile.get('symmetry_status', 'N/A')}")
    lines.append("")

    lines.append("SECTION 2: MATERIAL & INPUT")
    lines.append("-" * 40)
    lines.append(f"  Material             : {summary['material']}")
    lines.append(f"  Sheet Thickness      : {summary['sheet_thickness_mm']} mm")
    lines.append("")

    lines.append("SECTION 3: FLOWER PATTERN & COMPLEXITY")
    lines.append("-" * 40)
    lines.append(f"  Forming Complexity   : {summary['forming_complexity_class']}  (score: {summary['complexity_score']})")
    lines.append(f"  Estimated Passes     : {summary['estimated_forming_passes']}")
    lines.append(f"  Pass Distribution    : {', '.join(str(x) for x in flower.get('pass_distribution_logic', []))}")
    lines.append("")

    lines.append("SECTION 4: STATION ESTIMATE")
    lines.append("-" * 40)
    lines.append(f"  Recommended Stations : {summary['recommended_station_count']}")
    lines.append(f"  Est. Line Length     : {summary['estimated_line_length_mm']} mm")
    stations_note = station.get("notes", [])
    for n in (stations_note if isinstance(stations_note, list) else [stations_note]):
        lines.append(f"  Note : {n}")
    lines.append("")

    lines.append("SECTION 5: SHAFT & BEARING SELECTION")
    lines.append("-" * 40)
    lines.append(f"  Shaft Diameter       : {summary['shaft_diameter_mm']} mm")
    lines.append(f"  Shaft Duty Class     : {shaft.get('duty_class', 'N/A')}")
    lines.append(f"  Bearing Type         : {summary['bearing_type']}")
    lines.append(f"  Bearing Load Class   : {bearing.get('bearing_load_class', 'N/A')}")
    lines.append("")

    lines.append("SECTION 6: MACHINE DUTY")
    lines.append("-" * 40)
    lines.append(f"  Machine Duty Class   : {summary['machine_duty_class']}")
    lines.append(f"  Duty Reason          : {duty.get('duty_reason', 'N/A')}")
    lines.append("")

    lines.append("SECTION 7: ROLL DESIGN PRELIMINARY CALCULATIONS")
    lines.append("-" * 40)
    lines.append(f"  Roll Duty Class      : {roll_calc.get('duty_class', 'N/A')}")
    lines.append(f"  Estimated Roll OD    : {summary['estimated_roll_od_mm']} mm")
    lines.append(f"  Vertical Gap         : {summary['estimated_vertical_gap_mm']} mm")
    lines.append(f"  Side Clearance       : {summary['estimated_side_clearance_mm']} mm")
    lines.append(f"  Calibration Note     : {roll_calc.get('calibration_note', 'N/A')}")

    spacer = roll_calc.get("spacer_recommendation", {})
    if spacer:
        lines.append(f"  Working Face         : {spacer.get('suggested_working_face_mm')} mm")
        lines.append(f"  Total Spacer         : {spacer.get('suggested_total_spacer_mm')} mm")
        lines.append(f"  Spacer Per Side      : {spacer.get('suggested_spacer_each_side_mm')} mm")

    roll_warnings = roll_calc.get("warnings", [])
    if roll_warnings:
        lines.append("  Roll Warnings:")
        for w in roll_warnings:
            lines.append(f"    - {w}")
    lines.append("")

    lines.append("SECTION 8: PASS GAP PLAN")
    lines.append("-" * 40)
    pass_plan = roll_calc.get("pass_gap_plan", [])
    if pass_plan:
        lines.append(f"  {'Station':<10} {'Stage Type':<30} {'Gap (mm)'}")
        lines.append(f"  {'-'*8:<10} {'-'*28:<30} {'-'*8}")
        for p in pass_plan:
            lines.append(f"  {str(p['station_no']):<10} {p['stage_type']:<30} {p['target_gap_mm']}")
    else:
        lines.append("  No pass gap plan generated.")
    lines.append("")

    lines.append("SECTION 9: ROLL LOGIC")
    lines.append("-" * 40)
    for note in roll_logic.get("notes", []):
        lines.append(f"  {note}")
    lines.append("")

    lines.append("SECTION 10: ASSUMPTIONS & DISCLAIMER")
    lines.append("-" * 40)
    for a in roll_calc.get("assumptions", []):
        lines.append(f"  - {a}")
    lines.append("")
    lines.append("  THIS IS A PRELIMINARY ENGINEERING ESTIMATE.")
    lines.append("  All dimensions, shaft sizes, bearing selections, roll ODs, station counts,")
    lines.append("  and clearances are based on rule-book approximations only.")
    lines.append("  Final tooling drawings, bore sizes, keyways, and exact profiles")
    lines.append("  must be verified and approved by a qualified roll forming engineer")
    lines.append("  before manufacture.")
    lines.append("")
    lines.append("=" * 70)
    lines.append("  GENERATED BY: SAI ROLOTECH SMART ENGINES v2.2.0")
    lines.append("=" * 70)

    return "\n".join(lines)
