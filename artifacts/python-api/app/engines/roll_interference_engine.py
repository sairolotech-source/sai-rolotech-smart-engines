"""
roll_interference_engine.py — Roll Interference Check Engine (Manufacturing-Grade)

Two check levels:
1. check_roll_interference()     — point-by-point Y-coordinate check on advanced_roll stand_data
                                   [HEURISTIC: does not account for groove polygon shape]
2. check_contour_interference()  — reads shapely-based interference results already embedded
                                   in roll_contour_engine passes (geometry_source=shapely)
                                   [MANUFACTURING-GRADE when shapely is available]

Blueprint source: Advance Roll Engine + Export Engine blueprint.
"""
from typing import Any, Dict, List

from app.utils.response import pass_response, fail_response


# ══════════════════════════════════════════════════════════════════════════════
#  Legacy point-by-point check (advanced_roll stand_data)
#  [HEURISTIC — y-comparison only, no real polygon intersection]
# ══════════════════════════════════════════════════════════════════════════════

def check_roll_interference(advanced_roll_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    [HEURISTIC] Returns pass/fail with a list of interference issues per stand.
    blocking=True if any interference is found (production-blocking defect).

    Checks: upper_y <= lower_y at each profile point.
    Note: Does NOT use shapely polygon intersection.
    For real geometry-based checks, see check_contour_interference() below.
    """
    if not advanced_roll_result or advanced_roll_result.get("status") != "pass":
        return fail_response(
            "roll_interference_engine",
            "Advanced roll result missing or invalid",
        )

    issues: List[Dict[str, Any]] = []
    stand_data: List[Dict[str, Any]] = advanced_roll_result.get("stand_data", [])

    for stand in stand_data:
        upper_raw = stand.get("upper_profile", [])
        lower_raw = stand.get("lower_profile", [])

        def _y(pt: Any) -> float:
            return pt["y"] if isinstance(pt, dict) else float(pt[1])

        min_len = min(len(upper_raw), len(lower_raw))
        for i in range(min_len):
            uy = _y(upper_raw[i])
            ly = _y(lower_raw[i])
            if uy <= ly:
                issues.append({
                    "stand_no":    stand.get("stand_no"),
                    "point_index": i,
                    "upper_y":     uy,
                    "lower_y":     ly,
                    "gap_mm":      round(uy - ly, 4),
                    "reason":      "Upper and lower roll overlap or touch",
                    "method":      "heuristic_y_compare",
                })

    has_issues = len(issues) > 0
    return pass_response("roll_interference_engine", {
        "check_method":  "heuristic_y_compare",
        "issue_count":   len(issues),
        "issues":        issues,
        "confidence":    "low" if has_issues else "medium",   # medium not high — heuristic only
        "blocking":      has_issues,
        "warnings":      ["Roll interference detected — tooling review required"] if has_issues else [],
    })


# ══════════════════════════════════════════════════════════════════════════════
#  Manufacturing-grade check — reads pre-computed shapely results from passes
#  [MANUFACTURING-GRADE when roll_contour_engine ran with shapely]
# ══════════════════════════════════════════════════════════════════════════════

def check_contour_interference(roll_contour_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    [MANUFACTURING-GRADE] Reads the per-pass shapely interference results
    already computed by roll_contour_engine (each pass has an 'interference' dict).

    Returns a consolidated report including:
    - clash_stations: list of pass_no with clash
    - warning_stations: list with warning
    - any_blocking: True if any clash found
    - geometry_source: 'manufacturing_grade' | 'heuristic_fallback'
    - confidence: 'high' (shapely) | 'medium' (heuristic) | 'low' (error)
    """
    if not roll_contour_result or roll_contour_result.get("status") != "pass":
        return fail_response(
            "roll_interference_engine",
            "roll_contour_result missing or invalid",
        )

    # Prefer the pre-computed interference_summary from roll_contour_engine
    intf_summary = roll_contour_result.get("interference_summary", {})
    geometry_src = intf_summary.get("geometry_source", "unknown")

    passes     = list(roll_contour_result.get("passes", []))
    calib      = roll_contour_result.get("calibration_pass")
    if calib:
        passes.append(calib)

    clash_stations:   List[int]              = []
    warning_stations: List[int]              = []
    clear_stations:   List[int]              = []
    skip_stations:    List[int]              = []
    station_details:  List[Dict[str, Any]]   = []

    for p in passes:
        intf = p.get("interference", {})
        status  = intf.get("status", "skip")
        pass_no = p.get("pass_no", 0)

        station_details.append({
            "pass_no":          pass_no,
            "station_label":    p.get("station_label", f"Station {pass_no}"),
            "angle_deg":        p.get("target_angle_deg", 0),
            "interference":     intf,
        })

        if status == "clash":
            clash_stations.append(pass_no)
        elif status == "warning":
            warning_stations.append(pass_no)
        elif status == "clear":
            clear_stations.append(pass_no)
        else:
            skip_stations.append(pass_no)

    any_blocking = len(clash_stations) > 0
    confidence = (
        "high"   if geometry_src == "manufacturing_grade" else
        "medium" if geometry_src == "heuristic_fallback"  else
        "low"
    )

    return pass_response("roll_interference_engine", {
        "check_method":       "shapely_polygon_intersection",
        "geometry_source":    geometry_src,
        "confidence":         confidence,
        "any_clash":          any_blocking,
        "any_warning":        len(warning_stations) > 0,
        "blocking":           any_blocking,
        "clash_stations":     clash_stations,
        "warning_stations":   warning_stations,
        "clear_stations":     clear_stations,
        "skip_stations":      skip_stations,
        "station_details":    station_details,
        "total_checked":      len(station_details),
        "warnings": (
            [f"CLASH at station(s) {clash_stations} — tooling redesign required"] if clash_stations else
            [f"Near-miss at station(s) {warning_stations} — clearance review recommended"] if warning_stations else
            []
        ),
    })
