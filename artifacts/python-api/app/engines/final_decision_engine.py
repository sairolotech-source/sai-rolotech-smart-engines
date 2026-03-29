"""
final_decision_engine.py — Accuracy Control System
Computes overall confidence score and selects operating mode.

Mode rules:
  85+    → auto_mode
  65–84  → semi_auto
  <65    → manual_review
"""
import logging
from typing import Dict, Any, List

from app.utils.response import pass_response

logger = logging.getLogger("final_decision_engine")

# ─── Confidence subscores ─────────────────────────────────────────────────────

def _import_confidence(
    import_result: Dict[str, Any],
    geometry_result: Dict[str, Any],
) -> int:
    """Max 20 pts — import + geometry quality."""
    score = 0

    if import_result.get("status") == "pass":
        score += 8
        entity_count = import_result.get("entity_count", 0)
        if isinstance(entity_count, (int, float)) and entity_count > 0:
            score += 4

    if geometry_result.get("status") == "pass":
        score += 5
        if geometry_result.get("entities_removed", 0) == 0:
            score += 3  # zero cleanup needed → clean geometry

    return min(score, 20)


def _geometry_confidence(geometry_result: Dict[str, Any]) -> int:
    """Max 20 pts — geometry cleanliness."""
    score = 0
    if geometry_result.get("status") == "pass":
        score += 10
        removed = geometry_result.get("entities_removed", 0)
        if removed == 0:
            score += 10
        elif removed <= 3:
            score += 7
        elif removed <= 8:
            score += 4
    return min(score, 20)


def _bend_confidence(profile_result: Dict[str, Any]) -> int:
    """Max 20 pts — bend detection quality."""
    score = 0
    if profile_result.get("status") == "pass":
        bend_count = int(profile_result.get("bend_count", 0))
        if bend_count > 0:
            score += 10
        if profile_result.get("bends"):
            score += 8
            if all(b.get("angle_deg") for b in profile_result.get("bends", [])):
                score += 2
        elif bend_count > 0:
            score += 4
    return min(score, 20)


def _section_feature_confidence(
    profile_result: Dict[str, Any],
    flower_result: Dict[str, Any],
) -> int:
    """Max 15 pts — section type and feature detection."""
    score = 0
    section_type = str(flower_result.get("section_type", "custom"))

    if section_type not in {"custom", "unknown", ""}:
        score += 6

    if flower_result.get("forming_complexity_class") not in {None, "unknown"}:
        score += 5

    symmetry = profile_result.get("symmetry_status", "unknown")
    if symmetry in {"symmetric", "asymmetric"}:
        score += 4

    return min(score, 15)


def _flower_logic_confidence(flower_result: Dict[str, Any]) -> int:
    """Max 10 pts — flower pattern reliability."""
    score = 0
    if flower_result.get("status") == "pass":
        score += 5
        passes = flower_result.get("estimated_forming_passes", 0)
        if isinstance(passes, (int, float)) and passes > 0:
            score += 3
        if flower_result.get("pass_distribution_logic"):
            score += 2
    return min(score, 10)


def _station_confidence(station_result: Dict[str, Any]) -> int:
    """Max 10 pts — station estimate quality."""
    score = 0
    if station_result.get("status") == "pass":
        count = int(station_result.get("recommended_station_count", 0))
        if count > 0:
            score += 6
        if 3 <= count <= 30:
            score += 4
    return min(score, 10)


def _mechanical_confidence(
    shaft_result: Dict[str, Any],
    bearing_result: Dict[str, Any],
    roll_calc_result: Dict[str, Any],
) -> int:
    """Max 5 pts — shaft/bearing/roll consistency."""
    score = 0
    if shaft_result.get("status") == "pass":
        score += 2
    if bearing_result.get("status") == "pass":
        score += 1
    if roll_calc_result.get("status") == "pass" and not roll_calc_result.get("warnings"):
        score += 2
    elif roll_calc_result.get("status") == "pass":
        score += 1
    return min(score, 5)


# ─── Public entry point ────────────────────────────────────────────────────────

def make_final_decision(
    import_result: Dict[str, Any],
    geometry_result: Dict[str, Any],
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    station_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
    bearing_result: Dict[str, Any],
    roll_calc_result: Dict[str, Any],
    consistency_result: Dict[str, Any],
) -> Dict[str, Any]:

    # ── Subscores ──────────────────────────────────────────────────────────────
    sc_import   = _import_confidence(import_result, geometry_result)
    sc_geometry = _geometry_confidence(geometry_result)
    sc_bend     = _bend_confidence(profile_result)
    sc_section  = _section_feature_confidence(profile_result, flower_result)
    sc_flower   = _flower_logic_confidence(flower_result)
    sc_station  = _station_confidence(station_result)
    sc_mech     = _mechanical_confidence(shaft_result, bearing_result, roll_calc_result)

    overall = sc_import + sc_geometry + sc_bend + sc_section + sc_flower + sc_station + sc_mech

    # ── Collect blocking reasons ───────────────────────────────────────────────
    blocking_reasons: List[str] = []

    cons_blocking = consistency_result.get("blocking_reasons", [])
    blocking_reasons.extend(cons_blocking)

    if sc_import < 8:
        blocking_reasons.append("Import confidence low — geometry may be incomplete or invalid")
    if sc_geometry < 8:
        blocking_reasons.append("Geometry confidence low — excessive entities removed during cleanup")
    if sc_bend < 10:
        blocking_reasons.append("Bend detection confidence low — bend count or angles uncertain")
    if sc_section < 8:
        blocking_reasons.append("Section feature confidence low — profile type uncertain")

    if consistency_result.get("consistency_status") == "fail":
        blocking_reasons.append("Consistency check failed — engine outputs contradict each other")
    elif consistency_result.get("consistency_status") == "review_required":
        blocking_reasons.append("Consistency check requires review — some outputs need confirmation")

    is_blocked = consistency_result.get("blocking", False)

    # ── Mode selection ────────────────────────────────────────────────────────
    if overall >= 85 and not is_blocked and consistency_result.get("consistency_status") == "pass":
        selected_mode = "auto_mode"
        next_action = "Pipeline can proceed automatically — all engines agree with high confidence"
    elif overall >= 65 or (overall < 65 and not is_blocked):
        selected_mode = "semi_auto"
        next_action = (
            "User confirmation required for key values before final station and roll recommendations"
        )
    else:
        selected_mode = "manual_review"
        next_action = (
            "Manual review required — confidence too low or critical contradictions found. "
            "Do not generate final tooling recommendations without engineer verification."
        )

    if is_blocked and selected_mode == "auto_mode":
        selected_mode = "semi_auto"
        next_action = (
            "Auto mode blocked due to consistency failures — user confirmation required"
        )

    logger.info(
        "[final_decision_engine] mode=%s score=%d blocking=%s",
        selected_mode, overall, is_blocked,
    )

    return pass_response("final_decision_engine", {
        "selected_mode": selected_mode,
        "overall_confidence": overall,
        "confidence_subscores": {
            "import_confidence_20": sc_import,
            "geometry_confidence_20": sc_geometry,
            "bend_detection_confidence_20": sc_bend,
            "section_feature_confidence_15": sc_section,
            "flower_logic_confidence_10": sc_flower,
            "station_confidence_10": sc_station,
            "mechanical_confidence_5": sc_mech,
        },
        "blocking": is_blocked,
        "blocking_reasons": list(dict.fromkeys(blocking_reasons)),
        "recommended_next_action": next_action,
        "mode_thresholds": {
            "auto_mode": "score ≥85 AND no blocking AND consistency pass",
            "semi_auto": "score 65–84 OR low-risk blocking",
            "manual_review": "score <65 OR critical blocking failure",
        },
    })
