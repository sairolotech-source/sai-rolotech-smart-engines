"""
debug_test_engine.py — Stage-wise Pipeline Debug Engine
Extracts per-engine pass/fail/review status from a pipeline dict and
returns a structured debug breakdown for frontend and API consumers.
"""
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("debug_test_engine")

# Canonical engine order for all 3 pipelines (manual / auto / dxf)
ENGINE_ORDER: List[str] = [
    "file_import_engine",
    "geometry_engine",
    "profile_analysis_engine",
    "input_engine",
    "flange_web_lip_engine",
    "advanced_flower_engine",
    "station_engine",
    "roll_logic_engine",
    "shaft_engine",
    "bearing_engine",
    "duty_engine",
    "roll_design_calc_engine",
    "machine_layout_engine",
    "consistency_engine",
    "final_decision_engine",
    "report_engine",
]

LABEL: Dict[str, str] = {
    "file_import_engine":    "File / Entity Import",
    "geometry_engine":       "Geometry Cleanup",
    "profile_analysis_engine":"Profile Analysis",
    "input_engine":          "Input Validation",
    "flange_web_lip_engine": "Flange / Web / Lip",
    "advanced_flower_engine":"Flower Pattern",
    "station_engine":        "Station Estimate",
    "roll_logic_engine":     "Roll Logic",
    "shaft_engine":          "Shaft Selection",
    "bearing_engine":        "Bearing Selection",
    "duty_engine":           "Duty Classification",
    "roll_design_calc_engine":"Roll Design Calc",
    "machine_layout_engine": "Machine Layout",
    "consistency_engine":    "Consistency Check",
    "final_decision_engine": "Final Decision",
    "report_engine":         "Report Generation",
}


def extract_stage_debug(pipeline: Dict[str, Any]) -> Dict[str, Any]:
    """
    Produce stage-by-stage debug breakdown from a completed pipeline dict.

    Returns:
      {
        "overall_status": "pass" | "fail" | "partial",
        "first_failed_stage": str | None,
        "stage_debug": [ { stage, label, status, reason, ... }, ... ]
      }
    """
    first_failed: Optional[str] = None
    stages: List[Dict[str, Any]] = []

    for key in ENGINE_ORDER:
        eng = pipeline.get(key, {})
        if not isinstance(eng, dict):
            continue

        status = str(eng.get("status", "not_run"))
        reason = eng.get("reason") if status in {"fail", "review_required"} else None

        if status == "fail" and not first_failed:
            first_failed = key

        entry: Dict[str, Any] = {
            "stage":  key,
            "label":  LABEL.get(key, key),
            "status": status,
            "reason": reason,
        }

        # Extra fields per stage
        if key == "consistency_engine":
            entry["consistency_status"] = eng.get("consistency_status")
            entry["blocking"]           = eng.get("blocking")
            entry["issues_found"]       = eng.get("issues_found", 0)
            entry["blocking_reasons"]   = eng.get("blocking_reasons", [])

        if key == "final_decision_engine":
            entry["selected_mode"]       = eng.get("selected_mode")
            entry["overall_confidence"]  = eng.get("overall_confidence")
            entry["blocking_reasons"]    = eng.get("blocking_reasons", [])
            entry["recommended_action"]  = eng.get("recommended_next_action")

        if key == "flange_web_lip_engine":
            entry["section_type_detected"] = eng.get("section_type_detected")
            entry["symmetry"]              = eng.get("symmetry")
            entry["has_lips"]              = eng.get("has_lips")

        if key == "machine_layout_engine":
            entry["drive_type"]        = eng.get("drive_type")
            entry["motor_label"]       = eng.get("motor_label")
            entry["total_line_length_m"] = eng.get("total_line_length_m")

        stages.append(entry)

    if not first_failed and pipeline.get("status") == "fail":
        first_failed = pipeline.get("failed_stage")

    overall_status = pipeline.get("status", "fail")

    logger.debug("[debug_test_engine] overall=%s first_failed=%s stages=%d",
                 overall_status, first_failed, len(stages))

    return {
        "overall_status":    overall_status,
        "first_failed_stage": first_failed,
        "stage_debug":       stages,
    }
