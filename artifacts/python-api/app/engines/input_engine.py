"""
input_engine.py — Input Validation Engine
Validates thickness and material against the Rule Book.
"""
import logging
from typing import Dict, Any

from app.utils.response import pass_response, fail_response
from app.utils.engineering_rules import (
    SUPPORTED_MATERIALS,
    K_FACTORS,
    SPRINGBACK_FACTORS,
    MATERIAL_FORMING_DIFFICULTY,
    thickness_category,
)

logger = logging.getLogger("input_engine")


def validate_inputs(thickness: float, material: str) -> Dict[str, Any]:
    logger.debug("[input_engine] thickness=%.3f material=%s", thickness, material)

    if thickness is None:
        return fail_response("input_engine", "Thickness missing")

    if thickness <= 0:
        return fail_response("input_engine", f"Invalid thickness: {thickness}. Must be a positive number in mm.")

    if thickness > 20.0:
        return fail_response("input_engine", f"Thickness {thickness}mm exceeds roll forming limit of 20mm")

    if not material:
        return fail_response("input_engine", "Material missing")

    mat = material.upper().strip()
    if mat not in SUPPORTED_MATERIALS:
        return fail_response(
            "input_engine",
            f"Unsupported material '{mat}'. Supported: {', '.join(SUPPORTED_MATERIALS)}"
        )

    logger.info("[input_engine] valid: thickness=%.3f material=%s", thickness, mat)

    return pass_response("input_engine", {
        "sheet_thickness_mm": thickness,
        "material": mat,
        "thickness_category": thickness_category(thickness),
        "k_factor": K_FACTORS.get(mat, 0.44),
        "springback_factor": SPRINGBACK_FACTORS.get(mat, 1.03),
        "forming_difficulty": MATERIAL_FORMING_DIFFICULTY.get(mat, "moderate"),
    })
