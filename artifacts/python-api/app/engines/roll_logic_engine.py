"""
roll_logic_engine.py — Roll Logic Engine
Generates preliminary roll design pass breakdown.
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response

logger = logging.getLogger("roll_logic_engine")


def generate(
    profile_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    station_result: Dict[str, Any],
) -> Dict[str, Any]:
    stations = station_result.get("recommended_station_count", 0)
    pass_logic = flower_result.get("pass_distribution_logic", [])
    complexity = flower_result.get("forming_complexity_class", "SIMPLE")

    logger.debug("[roll_logic_engine] stations=%d complexity=%s", stations, complexity)

    roll_groups = []
    for i in range(1, stations + 1):
        idx = (i - 1) % len(pass_logic) if pass_logic else 0
        roll_groups.append({
            "station": i,
            "pass_type": pass_logic[idx] if pass_logic else f"forming pass {i}",
            "roll_pair": f"R{i:02d}U / R{i:02d}L",
        })

    logger.info("[roll_logic_engine] roll_groups generated: %d", len(roll_groups))

    return pass_response("roll_logic_engine", {
        "preliminary_roll_design_status": "generated",
        "roll_group_count_estimate": stations,
        "roll_groups": roll_groups,
        "pass_breakdown_notes": pass_logic,
        "review_required_flag": True,
        "notes": [
            "Preliminary roll design logic only — Rule Book v2.2.0",
            "Final roll dimensions and tolerances require expert review",
            f"Profile complexity: {complexity}",
        ],
    })
