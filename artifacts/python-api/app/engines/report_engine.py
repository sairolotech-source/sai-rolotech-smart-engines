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

    profile        = pipeline.get("profile_analysis_engine", {})
    inp            = pipeline.get("input_engine", {})
    flower         = pipeline.get("advanced_flower_engine", {})
    station        = pipeline.get("station_engine", {})
    shaft          = pipeline.get("shaft_engine", {})
    bearing        = pipeline.get("bearing_engine", {})
    duty           = pipeline.get("duty_engine", {})
    roll_calc      = pipeline.get("roll_design_calc_engine", {})
    roll_logic     = pipeline.get("roll_logic_engine", {})
    flange_data    = pipeline.get("flange_web_lip_engine", {})
    machine_layout = pipeline.get("machine_layout_engine", {})
    consistency    = pipeline.get("consistency_engine", {})
    decision       = pipeline.get("final_decision_engine", {})

    summary = build_summary(
        profile=profile,
        inp=inp,
        flower=flower,
        station=station,
        shaft=shaft,
        bearing=bearing,
        duty=duty,
        roll_calc=roll_calc,
        machine_layout=machine_layout,
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
        flange_data=flange_data,
        machine_layout=machine_layout,
        consistency=consistency,
        decision=decision,
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
    machine_layout: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    station_count   = station.get("recommended_station_count", "N/A")
    station_min     = station.get("min_station_count",         "N/A")
    station_premium = station.get("premium_station_count",     "N/A")
    shaft_dia       = shaft.get("suggested_shaft_diameter_mm", "N/A")
    ml              = machine_layout or {}

    return {
        "project_type":             "Roll Forming Preliminary Engineering",
        "profile_type":             flower.get("section_type", profile.get("profile_type", "unknown")),
        "section_width_mm":         profile.get("section_width_mm", "N/A"),
        "section_height_mm":        profile.get("section_height_mm", "N/A"),
        "bend_count":               profile.get("bend_count", "N/A"),
        "return_bends_count":       profile.get("return_bends_count", 0),
        "material":                 inp.get("material", "N/A"),
        "sheet_thickness_mm":       inp.get("sheet_thickness_mm", "N/A"),
        "forming_complexity_class": flower.get("forming_complexity_class", "N/A"),
        "complexity_score":         flower.get("complexity_score", "N/A"),
        "estimated_forming_passes": flower.get("estimated_forming_passes", "N/A"),
        "min_station_count":        station_min,
        "recommended_station_count": station_count,
        "premium_station_count":    station_premium,
        "shaft_diameter_mm":        shaft_dia,
        "bearing_type":             bearing.get("suggested_bearing_type", "N/A"),
        "machine_duty_class":       duty.get("duty_class", roll_calc.get("duty_class", "N/A")),
        "estimated_roll_od_mm":     roll_calc.get("estimated_roll_od_mm", "N/A"),
        "estimated_vertical_gap_mm": roll_calc.get("estimated_vertical_gap_mm", "N/A"),
        "estimated_side_clearance_mm": roll_calc.get("estimated_side_clearance_mm", "N/A"),
        # Machine layout summary fields
        "total_line_length_m":      ml.get("total_line_length_m", "N/A"),
        "drive_type":               ml.get("drive_type", "N/A"),
        "motor_label":              ml.get("motor_label", "N/A"),
        "stand_spacing_mm":         ml.get("stand_spacing_mm", "N/A"),
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
    flange_data: Dict[str, Any] | None = None,
    machine_layout: Dict[str, Any] | None = None,
    consistency: Dict[str, Any] | None = None,
    decision: Dict[str, Any] | None = None,
) -> str:
    lines = []
    ml = machine_layout or {}
    fd = flange_data or {}
    cs = consistency or {}
    dc = decision or {}

    lines.append("=" * 70)
    lines.append("  SAI ROLOTECH SMART ENGINES v2.3.0")
    lines.append("  ROLL FORMING PRELIMINARY ENGINEERING REPORT")
    lines.append("  *** FOR ENGINEERING REFERENCE ONLY — NOT FINAL TOOLING DOCUMENT ***")
    lines.append("=" * 70)
    lines.append("")

    # ── Mode line ─────────────────────────────────────────────────────────────
    selected_mode = dc.get("selected_mode", "N/A")
    overall_conf  = dc.get("overall_confidence", "N/A")
    lines.append(f"  Analysis Mode        : {selected_mode.upper().replace('_', ' ')}")
    lines.append(f"  Confidence Score     : {overall_conf}/100")
    lines.append("")

    # ── SECTION 1: PROFILE ────────────────────────────────────────────────────
    lines.append("SECTION 1: PROFILE OVERVIEW")
    lines.append("-" * 40)
    lines.append(f"  Profile Type         : {summary['profile_type']}")
    lines.append(f"  Section Width        : {summary['section_width_mm']} mm")
    lines.append(f"  Section Height       : {summary['section_height_mm']} mm")
    lines.append(f"  Bend Count           : {summary['bend_count']}")
    lines.append(f"  Return Bends         : {summary['return_bends_count']}")
    lines.append(f"  Symmetry Status      : {profile.get('symmetry_status', fd.get('symmetry', 'N/A'))}")
    lines.append("")

    # ── SECTION 2: MATERIAL & INPUT ───────────────────────────────────────────
    lines.append("SECTION 2: MATERIAL & INPUT")
    lines.append("-" * 40)
    lines.append(f"  Material             : {summary['material']}")
    lines.append(f"  Sheet Thickness      : {summary['sheet_thickness_mm']} mm")
    lines.append("")

    # ── SECTION 3: SECTION FEATURES (FLANGE / WEB / LIP) ─────────────────────
    lines.append("SECTION 3: SECTION FEATURES (FLANGE / WEB / LIP)")
    lines.append("-" * 40)
    if fd:
        lines.append(f"  Detected Type        : {fd.get('section_type_detected', 'N/A')}")
        lines.append(f"  Symmetry             : {fd.get('symmetry', 'N/A')}")
        lines.append(f"  Web Length           : {fd.get('web_length_mm', 'N/A')} mm")
        lines.append(f"  Flange Count         : {fd.get('flange_count', 'N/A')}")
        flange_lengths = fd.get("flange_lengths_mm", [])
        if flange_lengths:
            lines.append(f"  Flange Lengths       : {', '.join(str(f) for f in flange_lengths)} mm")
        lines.append(f"  Lip Count            : {fd.get('lip_count', 0)}")
        if fd.get("lip_count", 0) > 0:
            lines.append(f"  Lip Length           : {fd.get('lip_length_mm', 'N/A')} mm")
        lines.append(f"  Has Return Bends     : {'Yes' if fd.get('has_return_bends') else 'No'}")
        for w in fd.get("warnings", []):
            lines.append(f"  Warning              : {w}")
    else:
        lines.append("  Section feature data not available for this pipeline run.")
    lines.append("")

    # ── SECTION 4: FLOWER PATTERN & COMPLEXITY ────────────────────────────────
    lines.append("SECTION 4: FLOWER PATTERN & COMPLEXITY")
    lines.append("-" * 40)
    lines.append(f"  Forming Complexity   : {summary['forming_complexity_class']}  (score: {summary['complexity_score']})")
    lines.append(f"  Estimated Passes     : {summary['estimated_forming_passes']}")
    lines.append(f"  Pass Distribution    : {', '.join(str(x) for x in flower.get('pass_distribution_logic', []))}")
    lines.append("")

    # ── SECTION 5: STATION ESTIMATE ───────────────────────────────────────────
    lines.append("SECTION 5: STATION ESTIMATE")
    lines.append("-" * 40)
    lines.append(f"  Minimum Safe Stations  : {summary.get('min_station_count', 'N/A')}")
    lines.append(f"  Recommended Stations   : {summary['recommended_station_count']}")
    lines.append(f"  Premium / High-Acc.    : {summary.get('premium_station_count', 'N/A')}")
    rl = station.get("reason_log", {})
    if rl:
        lines.append(f"  Passes/Bend            : {rl.get('passes_per_bend', '?')}  "
                     f"(max {rl.get('max_angle_per_pass_deg', '?')}°/pass, "
                     f"{rl.get('thickness_band', '?')} {rl.get('material', '?')})")
    stations_note = station.get("notes", [])
    for n in (stations_note if isinstance(stations_note, list) else [stations_note]):
        if n:
            lines.append(f"  Note                   : {n}")
    lines.append("")

    # ── SECTION 6: SHAFT & BEARING SELECTION ──────────────────────────────────
    lines.append("SECTION 6: SHAFT & BEARING SELECTION")
    lines.append("-" * 40)
    lines.append(f"  Shaft Diameter       : {summary['shaft_diameter_mm']} mm")
    lines.append(f"  Shaft Duty Class     : {shaft.get('duty_class', 'N/A')}")
    lines.append(f"  Bearing Type         : {summary['bearing_type']}")
    lines.append(f"  Bearing Load Class   : {bearing.get('bearing_load_class', 'N/A')}")
    lines.append("")

    # ── SECTION 7: MACHINE DUTY ───────────────────────────────────────────────
    lines.append("SECTION 7: MACHINE DUTY")
    lines.append("-" * 40)
    lines.append(f"  Machine Duty Class   : {summary['machine_duty_class']}")
    lines.append(f"  Duty Reason          : {duty.get('duty_reason', 'N/A')}")
    lines.append("")

    # ── SECTION 8: MACHINE LAYOUT ─────────────────────────────────────────────
    lines.append("SECTION 8: MACHINE LAYOUT")
    lines.append("-" * 40)
    if ml:
        lines.append(f"  Stand Count          : {ml.get('stand_count', 'N/A')}")
        lines.append(f"  Stand Spacing        : {ml.get('stand_spacing_mm', 'N/A')} mm")
        lines.append(f"  Shaft Center Dist.   : {ml.get('shaft_center_distance_mm', 'N/A')} mm")
        lines.append(f"  Drive Type           : {str(ml.get('drive_type', 'N/A')).replace('_', ' ')}")
        lines.append(f"  Motor                : {ml.get('motor_label', 'N/A')}")
        lines.append(f"  Gearbox              : {ml.get('gearbox_label', 'N/A')}")
        lines.append(f"  Entry Guide          : {'Required — ' + ml.get('entry_guide_type','') if ml.get('entry_guide_recommended') else 'Not required'}")
        lines.append(f"  Straightener         : {'Required — ' + ml.get('straightener_type','') if ml.get('straightener_recommended') else 'Not required'}")
        lines.append(f"  Frame Type           : {str(ml.get('frame_type', 'N/A')).replace('_', ' ')}")
        lines.append(f"  Coil Stand           : {str(ml.get('coil_stand_type', 'N/A')).replace('_', ' ')}")
        lines.append(f"  Line Speed           : {ml.get('line_speed_mpm', 'N/A')}")
        ll = ml.get("line_length_summary", {})
        if ll:
            lines.append(f"  Entry Section        : {ll.get('entry_and_straightener_m', 'N/A')} m")
            lines.append(f"  Roll Forming Section : {ll.get('roll_forming_section_m', 'N/A')} m")
            lines.append(f"  Exit Section         : {ll.get('exit_and_cutoff_m', 'N/A')} m")
            lines.append(f"  TOTAL LINE LENGTH    : {ll.get('total_line_length_m', 'N/A')} m")
        for w in ml.get("warnings", []):
            lines.append(f"  Warning              : {w}")
    else:
        lines.append("  Machine layout data not available for this pipeline run.")
    lines.append("")

    # ── SECTION 9: ROLL DESIGN PRELIMINARY CALCULATIONS ──────────────────────
    lines.append("SECTION 9: ROLL DESIGN PRELIMINARY CALCULATIONS")
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

    # ── SECTION 10: PASS GAP PLAN ─────────────────────────────────────────────
    lines.append("SECTION 10: PASS GAP PLAN")
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

    # ── SECTION 11: ROLL LOGIC ────────────────────────────────────────────────
    lines.append("SECTION 11: ROLL LOGIC")
    lines.append("-" * 40)
    for note in roll_logic.get("notes", []):
        lines.append(f"  {note}")
    lines.append("")

    # ── SECTION 12: WARNINGS & ASSUMPTIONS ───────────────────────────────────
    lines.append("SECTION 12: WARNINGS & ASSUMPTIONS")
    lines.append("-" * 40)
    consistency_issues = cs.get("issues", [])
    if consistency_issues:
        lines.append("  Consistency Checks:")
        for iss in consistency_issues:
            lines.append(f"    [{iss.get('severity','?').upper()}] {iss.get('message','')}")
    blocking_reasons = dc.get("blocking_reasons", [])
    if blocking_reasons:
        lines.append("  Blocking Reasons:")
        for br in blocking_reasons:
            lines.append(f"    - {br}")
    for a in roll_calc.get("assumptions", []):
        lines.append(f"  Assumption: {a}")
    lines.append("")

    # ── SECTION 13: DISCLAIMER ────────────────────────────────────────────────
    lines.append("SECTION 13: IMPORTANT PRELIMINARY NOTE")
    lines.append("-" * 40)
    lines.append("  THIS IS A PRELIMINARY ENGINEERING ESTIMATE.")
    lines.append("  All dimensions, shaft sizes, bearing selections, roll ODs, station counts,")
    lines.append("  clearances, and machine layout values are based on rule-book approximations only.")
    lines.append("  Final tooling drawings, bore sizes, keyways, and exact profiles")
    lines.append("  must be verified and approved by a qualified roll forming engineer")
    lines.append("  before manufacture.")
    lines.append("")
    lines.append("  This is a preliminary engineering report.")
    lines.append("  Final roll tooling design and production approval require expert review.")
    lines.append("")
    lines.append("=" * 70)
    lines.append("  GENERATED BY: SAI ROLOTECH SMART ENGINES v2.3.0")
    lines.append("=" * 70)

    return "\n".join(lines)
