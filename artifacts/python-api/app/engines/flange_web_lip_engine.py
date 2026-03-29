"""
flange_web_lip_engine.py — Section Feature Detection Engine
Dedicated engine for detecting web / flanges / lips / symmetry from profile geometry.
Runs after profile_analysis_engine to produce detailed section anatomy.
"""
import logging
import math
from typing import Dict, Any, List, Tuple, Optional

from app.utils.response import pass_response

logger = logging.getLogger("flange_web_lip_engine")

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _angle_deg(p1: Tuple, p2: Tuple) -> float:
    """Angle of segment from p1 to p2 in degrees (0–360)."""
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    return math.degrees(math.atan2(dy, dx)) % 360


def _seg_length(p1: Tuple, p2: Tuple) -> float:
    return math.hypot(p2[0] - p1[0], p2[1] - p1[1])


def _classify_segments(
    bends: List[Dict[str, Any]],
    section_width: float,
    section_height: float,
    bend_count_hint: int = 0,
) -> Dict[str, Any]:
    """
    Classify section anatomy from bend list.
    Each bend contains angle_deg, position or similar info.
    When no bends are available (manual mode: bends=[]), fall back to
    bend_count_hint so a C-section with bend_count=2 is correctly classified.
    """
    # Use geometry bends list length when DXF data is available;
    # fall back to the input bend_count when bends=[] (manual mode).
    manual_mode = not bends
    n_bends = len(bends) if bends else bend_count_hint

    # Web length: use section_width directly in manual mode (exact), heuristic for DXF
    if manual_mode:
        web_length_mm = section_width
    else:
        aspect = section_height / max(section_width, 1)
        web_length_mm = section_width * 0.45 if aspect < 0.8 else section_width * 0.35

    flange_count      = 0
    flange_lengths_mm: List[float] = []
    lip_count         = 0
    lip_length_mm     = 0.0

    if n_bends >= 2:
        flange_count = 2
        # Exact flange lengths in manual mode, heuristic for DXF
        fl = section_height if manual_mode else section_height * 0.9
        flange_lengths_mm = [fl, fl]

    if n_bends >= 4:
        lip_count = 2
        lip_length_mm = section_height * 0.15

    if n_bends >= 6:
        # More complex — additional features
        lip_count = 4
        lip_length_mm = section_height * 0.12

    return {
        "web_length_mm": round(web_length_mm, 2),
        "flange_count": flange_count,
        "flange_lengths_mm": [round(f, 2) for f in flange_lengths_mm],
        "lip_count": lip_count,
        "lip_length_mm": round(lip_length_mm, 2) if lip_count > 0 else 0.0,
    }


def _detect_symmetry(section_width: float, section_height: float, profile_type: str, bends: List) -> str:
    """Detect section symmetry."""
    # Heuristic: most standard profiles are symmetric
    if profile_type in {"simple_channel", "lipped_channel", "shutter_profile"}:
        return "symmetric"
    if profile_type == "complex_profile":
        return "asymmetric" if len(bends) % 2 != 0 else "symmetric"
    return "unknown"


def _classify_section_type(
    flange_count: int,
    lip_count: int,
    bend_count: int,
    profile_type: str,
    return_bends: int,
) -> Tuple[str, str]:
    """Classify section type and sub-type from detected features."""
    if bend_count == 0:
        return "unknown", "No bends detected"
    if bend_count <= 2 and flange_count <= 1:
        return "angle_section", "Single flange — L-section"
    if flange_count >= 2 and lip_count == 0 and return_bends == 0:
        return "c_channel", "C-channel — web + 2 flanges"
    if flange_count >= 2 and lip_count >= 2:
        return "lipped_channel", "C-section — web + 2 flanges + lips"
    if return_bends > 0:
        return "shutter_profile", "Shutter profile with return bends"
    if bend_count >= 6:
        return "complex_profile", f"Complex section — {bend_count} bends"
    return profile_type, "Classified from profile type"


# ─── Public entry point ────────────────────────────────────────────────────────

def detect_flange_web_lip(
    profile_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Analyse profile geometry to detect:
    - web length
    - flange count + lengths
    - lip count + length
    - symmetry
    - section sub-classification
    """
    bends           = profile_result.get("bends", [])
    bend_count      = int(profile_result.get("bend_count", 0))
    profile_type    = str(profile_result.get("profile_type", "custom"))
    return_bends    = int(profile_result.get("return_bends_count", 0))
    section_width   = float(profile_result.get("section_width_mm", 0))
    section_height  = float(profile_result.get("section_height_mm", 0))

    warnings: List[str] = []
    assumptions: List[str] = []

    # ── Segment classification ──────────────────────────────────────────────
    anatomy = _classify_segments(bends, section_width, section_height, bend_count_hint=bend_count)

    web_len          = anatomy["web_length_mm"]
    flange_count     = anatomy["flange_count"]
    flange_lengths   = anatomy["flange_lengths_mm"]
    lip_count        = anatomy["lip_count"]
    lip_length       = anatomy["lip_length_mm"]

    # ── Symmetry detection ──────────────────────────────────────────────────
    symmetry = _detect_symmetry(section_width, section_height, profile_type, bends)

    # ── Section sub-type ────────────────────────────────────────────────────
    detected_type, type_reason = _classify_section_type(
        flange_count, lip_count, bend_count, profile_type, return_bends
    )

    # ── Validate against profile_type ──────────────────────────────────────
    if profile_type == "lipped_channel" and lip_count == 0:
        warnings.append("Profile classified as lipped_channel but no lips detected — verify section geometry")
        assumptions.append("Assuming lips are present based on profile_type classification")
        lip_count = 2
        lip_length = section_height * 0.12

    if profile_type == "simple_channel" and return_bends > 0:
        warnings.append("simple_channel with return bends — profile may be more complex than classified")

    if bend_count == 0:
        warnings.append("Zero bends — no section features can be reliably detected")

    # ── Confidence ──────────────────────────────────────────────────────────
    if not bends and bend_count > 0:
        confidence = "medium"
        assumptions.append("Bend angle list unavailable — feature detection uses geometric heuristics")
    elif bend_count == 0:
        confidence = "low"
    else:
        confidence = "high"

    has_lips    = lip_count > 0
    has_flanges = flange_count > 0

    logger.info(
        "[flange_web_lip_engine] type=%s web=%.1fmm flanges=%d lips=%d symmetry=%s confidence=%s",
        detected_type, web_len, flange_count, lip_count, symmetry, confidence,
    )

    return pass_response("flange_web_lip_engine", {
        "confidence": confidence,
        "blocking": confidence == "low",
        "warnings": warnings,
        "assumptions": assumptions,
        "section_type_detected": detected_type,
        "section_type_reason": type_reason,
        "symmetry": symmetry,
        "web_length_mm": web_len,
        "flange_count": flange_count,
        "flange_lengths_mm": flange_lengths,
        "has_flanges": has_flanges,
        "lip_count": lip_count,
        "lip_length_mm": lip_length,
        "has_lips": has_lips,
        "return_bends_count": return_bends,
        "has_return_bends": return_bends > 0,
        "section_width_mm": section_width,
        "section_height_mm": section_height,
        "features_detected": {
            "web": True,
            "flanges": has_flanges,
            "lips": has_lips,
            "return_bends": return_bends > 0,
            "symmetric": symmetry == "symmetric",
        },
    })
