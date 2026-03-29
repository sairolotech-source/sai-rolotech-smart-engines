"""
flower_pattern_engine.py — Flower Pattern Engine
Generates forming pass distribution based on Rule Book complexity.
"""
import logging
from typing import Dict, Any, List

from app.utils.response import pass_response, fail_response
from app.utils.engineering_rules import (
    classify_complexity,
    COMPLEXITY_LABELS,
    COMPLEXITY_CORRECTION,
    thickness_station_correction,
    MATERIAL_STATION_CORRECTION,
)

logger = logging.getLogger("flower_pattern_engine")

PASS_DISTRIBUTION: Dict[str, List[str]] = {
    "SIMPLE": [
        "edge pickup / strip entry guide",
        "pre-form 1st bend (partial angle)",
        "intermediate forming (full angle)",
        "calibration / sizing pass",
    ],
    "MEDIUM": [
        "edge pickup / strip entry guide",
        "pre-form outer edges",
        "lip / return bend progression",
        "intermediate forming 1",
        "intermediate forming 2",
        "calibration / sizing pass",
    ],
    "COMPLEX": [
        "edge pickup / strip entry guide",
        "pre-form outer edges",
        "lip / return bend progression",
        "shape stabilization 1",
        "intermediate forming 1",
        "intermediate forming 2",
        "shape stabilization 2",
        "calibration / sizing pass",
    ],
    "VERY_COMPLEX": [
        "edge pickup / strip entry guide",
        "pre-form outer edges",
        "lip / return bend — stage 1",
        "lip / return bend — stage 2",
        "shape stabilization 1",
        "intermediate forming 1",
        "intermediate forming 2",
        "shape stabilization 2",
        "fine-tuning pass",
        "calibration / sizing pass",
    ],
}


def generate(profile_result: Dict[str, Any], input_result: Dict[str, Any]) -> Dict[str, Any]:
    bend_count = profile_result.get("bend_count", 0)
    thickness = input_result.get("sheet_thickness_mm", 0.0)
    material = input_result.get("material", "GI")

    logger.debug(
        "[flower_pattern_engine] bends=%d thickness=%.2f material=%s",
        bend_count, thickness, material,
    )

    if bend_count <= 0:
        logger.warning("[flower_pattern_engine] No bends detected")
        return fail_response("flower_pattern_engine", "No bends detected — cannot generate flower pattern")

    complexity = classify_complexity(bend_count)
    complexity_corr = COMPLEXITY_CORRECTION[complexity]
    thickness_corr = thickness_station_correction(thickness)
    material_corr = MATERIAL_STATION_CORRECTION.get(material, 0)

    estimated_passes = bend_count + complexity_corr + thickness_corr + material_corr
    estimated_passes = max(4, estimated_passes)

    pass_logic = PASS_DISTRIBUTION[complexity]

    logger.info(
        "[flower_pattern_engine] complexity=%s estimated_passes=%d",
        complexity, estimated_passes,
    )

    return pass_response("flower_pattern_engine", {
        "forming_complexity_class": complexity,
        "complexity_label": COMPLEXITY_LABELS[complexity],
        "estimated_forming_passes": estimated_passes,
        "pass_distribution_logic": pass_logic,
        "corrections": {
            "complexity": complexity_corr,
            "thickness": thickness_corr,
            "material": material_corr,
        },
    })
