"""
roll_logic_engine.py — Roll Logic Engine
Generates preliminary roll design pass breakdown with section-aware notes.
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
    section_type = flower_result.get("section_type", profile_result.get("profile_type", "custom"))
    stations = station_result.get("recommended_station_count", 0)
    pass_logic = flower_result.get("pass_distribution_logic", [])

    notes = [
        "Preliminary roll logic only — Rule Book v2.2.0",
        "Final contour matching and tooling profile still needs expert review",
    ]

    if section_type == "lipped_channel":
        notes.append("Include lip support during later forming stages")
    elif section_type in {"complex_section", "complex_profile"}:
        notes.append("Use gradual feature pickup across more stations")
    elif section_type == "shutter_profile":
        notes.append("Use sequential multi-feature forming and tighter calibration control")

    roll_groups = []
    for i in range(1, stations + 1):
        idx = (i - 1) % len(pass_logic) if pass_logic else 0
        roll_groups.append({
            "station": i,
            "pass_type": pass_logic[idx] if pass_logic else f"forming pass {i}",
            "roll_pair": f"R{i:02d}U / R{i:02d}L",
        })

    logger.info("[roll_logic_engine] section=%s stations=%d", section_type, stations)

    return pass_response("roll_logic_engine", {
        "preliminary_roll_design_status": "generated",
        "roll_group_count_estimate": stations,
        "roll_groups": roll_groups,
        "pass_breakdown_notes": pass_logic,
        "review_required_flag": True,
        "notes": notes,
    })
