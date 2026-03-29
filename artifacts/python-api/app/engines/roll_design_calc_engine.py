from typing import Dict, Any, List
from app.utils.response import pass_response, fail_response


def generate_roll_design_calc(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    station_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
) -> Dict[str, Any]:
    if not profile_result:
        return fail_response("roll_design_calc_engine", "Profile result missing")
    if not input_result:
        return fail_response("roll_design_calc_engine", "Input result missing")
    if not station_result:
        return fail_response("roll_design_calc_engine", "Station result missing")

    thickness = float(input_result.get("sheet_thickness_mm", 0))
    material = str(input_result.get("material", "")).upper()
    width = float(profile_result.get("section_width_mm", 0))
    height = float(profile_result.get("section_height_mm", 0))
    bend_count = int(profile_result.get("bend_count", 0))
    return_bends = int(profile_result.get("return_bends_count", 0))
    section_type = str(
        flower_result.get("section_type", profile_result.get("profile_type", "custom"))
    )
    station_count = int(station_result.get("recommended_station_count", 0))
    shaft_dia = float(shaft_result.get("suggested_shaft_diameter_mm", 0))

    if thickness <= 0:
        return fail_response("roll_design_calc_engine", "Invalid thickness")
    if width <= 0 and height <= 0:
        return fail_response("roll_design_calc_engine", "Invalid section size")

    duty_class = classify_roll_duty(
        thickness=thickness,
        material=material,
        bend_count=bend_count,
        return_bends=return_bends,
        section_type=section_type,
    )

    roll_od = estimate_roll_od(
        thickness=thickness,
        width=width,
        height=height,
        material=material,
        section_type=section_type,
        bend_count=bend_count,
    )

    vertical_gap = estimate_vertical_gap(
        thickness=thickness,
        material=material,
        section_type=section_type,
    )

    side_clearance = estimate_side_clearance(
        thickness=thickness,
        section_type=section_type,
    )

    pass_gaps = build_pass_gap_plan(
        station_count=station_count,
        thickness=thickness,
        section_type=section_type,
        return_bends=return_bends,
    )

    spacer_recommendation = estimate_spacer_logic(
        width=width,
        shaft_dia=shaft_dia,
        station_count=station_count,
    )

    calibration_note = build_calibration_note(
        section_type=section_type,
        station_count=station_count,
        bend_count=bend_count,
    )

    warnings = build_roll_warnings(
        thickness=thickness,
        material=material,
        section_type=section_type,
        return_bends=return_bends,
        shaft_dia=shaft_dia,
        roll_od=roll_od,
    )

    return pass_response("roll_design_calc_engine", {
        "duty_class": duty_class,
        "estimated_roll_od_mm": roll_od,
        "estimated_vertical_gap_mm": vertical_gap,
        "estimated_side_clearance_mm": side_clearance,
        "pass_gap_plan": pass_gaps,
        "spacer_recommendation": spacer_recommendation,
        "calibration_note": calibration_note,
        "warnings": warnings,
        "assumptions": [
            "Preliminary roll calculation rules used",
            "Final roll profile, bore, keyway, and exact clearances need expert tooling review",
        ],
    })


def classify_roll_duty(
    thickness: float,
    material: str,
    bend_count: int,
    return_bends: int,
    section_type: str,
) -> str:
    score = 0

    if thickness >= 2.0:
        score += 3
    elif thickness >= 1.2:
        score += 2
    elif thickness >= 0.8:
        score += 1

    if material in {"SS", "HR"}:
        score += 2
    elif material in {"MS", "CR"}:
        score += 1

    if bend_count >= 8:
        score += 2
    elif bend_count >= 4:
        score += 1

    score += min(return_bends, 2)

    if section_type in {"complex_section", "complex_profile"}:
        score += 2
    elif section_type == "shutter_profile":
        score += 3
    elif section_type == "lipped_channel":
        score += 1

    if score <= 2:
        return "light"
    if score <= 5:
        return "medium"
    if score <= 8:
        return "heavy"
    return "industrial"


def estimate_roll_od(
    thickness: float,
    width: float,
    height: float,
    material: str,
    section_type: str,
    bend_count: int,
) -> float:
    od = 70.0

    if thickness >= 0.8:
        od += 10
    if thickness >= 1.2:
        od += 10
    if thickness >= 2.0:
        od += 15

    if width >= 100:
        od += 10
    if width >= 200:
        od += 10

    if height >= 50:
        od += 5
    if height >= 100:
        od += 10

    if material in {"SS", "HR"}:
        od += 5

    if section_type == "lipped_channel":
        od += 5
    elif section_type in {"complex_section", "complex_profile"}:
        od += 10
    elif section_type == "shutter_profile":
        od += 15

    if bend_count >= 8:
        od += 5

    return round(od, 3)


def estimate_vertical_gap(
    thickness: float,
    material: str,
    section_type: str,
) -> float:
    base_gap = thickness + 0.05

    if material == "SS":
        base_gap += 0.03
    elif material in {"MS", "CR", "HR"}:
        base_gap += 0.02

    if section_type in {"complex_section", "complex_profile", "shutter_profile"}:
        base_gap += 0.03

    return round(base_gap, 3)


def estimate_side_clearance(
    thickness: float,
    section_type: str,
) -> float:
    clearance = max(0.15, thickness * 0.2)

    if section_type == "lipped_channel":
        clearance += 0.05
    elif section_type in {"complex_section", "complex_profile", "shutter_profile"}:
        clearance += 0.1

    return round(clearance, 3)


def build_pass_gap_plan(
    station_count: int,
    thickness: float,
    section_type: str,
    return_bends: int,
) -> List[Dict[str, Any]]:
    plan = []

    if station_count <= 0:
        return plan

    for i in range(1, station_count + 1):
        stage_type = "forming"
        gap_factor = 1.0

        if i <= 2:
            stage_type = "entry/pre-form"
            gap_factor = 1.08
        elif i >= station_count - 1:
            stage_type = "calibration"
            gap_factor = 1.01
        elif section_type in {"complex_section", "complex_profile", "shutter_profile"} and i > station_count // 2:
            stage_type = "stabilization/forming"
            gap_factor = 1.03

        if return_bends > 0 and i in {max(2, station_count // 2), max(3, station_count // 2 + 1)}:
            stage_type = "return-bend control"
            gap_factor = 1.04

        plan.append({
            "station_no": i,
            "stage_type": stage_type,
            "target_gap_mm": round(thickness * gap_factor, 3),
        })

    return plan


def estimate_spacer_logic(
    width: float,
    shaft_dia: float,
    station_count: int,
) -> Dict[str, Any]:
    if shaft_dia <= 0:
        shaft_dia = 50

    working_face = max(width + 20, 40)
    spacer_total = max(20.0, working_face * 0.2)
    per_side = spacer_total / 2

    return {
        "suggested_working_face_mm": round(working_face, 3),
        "suggested_total_spacer_mm": round(spacer_total, 3),
        "suggested_spacer_each_side_mm": round(per_side, 3),
        "notes": [
            f"Based on section width {width} mm",
            f"Shaft dia considered {shaft_dia} mm",
            f"Station count considered {station_count}",
        ],
    }


def build_calibration_note(
    section_type: str,
    station_count: int,
    bend_count: int,
) -> str:
    if station_count <= 2:
        return "Insufficient stations for proper calibration review"
    if section_type == "simple_channel":
        return "Keep last 1-2 stations for final angle correction and sizing"
    if section_type == "lipped_channel":
        return "Reserve final 2 stations for lip stabilization and calibration"
    if section_type in {"complex_section", "complex_profile"}:
        return "Reserve final 2-3 stations for profile stabilization and calibration"
    if section_type == "shutter_profile":
        return "Reserve final 3 stations for sequential closure control and calibration"
    return f"Use final stations for bend correction and dimensional control; bend count considered {bend_count}"


def build_roll_warnings(
    thickness: float,
    material: str,
    section_type: str,
    return_bends: int,
    shaft_dia: float,
    roll_od: float,
) -> List[str]:
    warnings = []

    if thickness > 1.2:
        warnings.append("Higher thickness may require stronger stands and careful gap control")
    if material == "SS":
        warnings.append("SS may need tighter springback review and calibration control")
    if return_bends > 0:
        warnings.append("Return bends increase risk of marking and sequence instability")
    if section_type == "shutter_profile":
        warnings.append("Shutter-like sections usually need more controlled pass progression")
    if roll_od < shaft_dia + 20:
        warnings.append("Roll OD appears tight relative to shaft diameter; review bore and strength margin")

    return warnings
