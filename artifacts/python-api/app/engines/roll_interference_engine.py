"""
roll_interference_engine.py — Roll Interference Check Engine

Scans every stand in the advanced_roll_result for upper/lower profile overlap.
A point is flagged when upper_y <= lower_y (rolls touching or crossing).

Blueprint source: Advance Roll Engine + Export Engine blueprint.
"""
from typing import Any, Dict, List

from app.utils.response import pass_response, fail_response


def check_roll_interference(advanced_roll_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns pass/fail with a list of interference issues per stand.
    blocking=True if any interference is found (production-blocking defect).
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

        # normalise — accept both [{"x":..,"y":..}] and [(x,y)] formats
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
                })

    has_issues = len(issues) > 0
    return pass_response("roll_interference_engine", {
        "issue_count":  len(issues),
        "issues":       issues,
        "confidence":   "low" if has_issues else "high",
        "blocking":     has_issues,
        "warnings":     ["Roll interference detected — tooling review required"] if has_issues else [],
    })
