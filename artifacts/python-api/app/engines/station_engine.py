"""
station_engine.py — Station Estimation Engine  v2.0

Root-cause fix (v2.0): Previous formula used bend_count as direct base,
giving unrealistically low counts (e.g. 4 for GI 1.5mm 2-bend C-section).

This version computes stations from passes_per_bend × bend_count, where
passes_per_bend = ceil(primary_bend_angle / max_angle_per_pass) and
max_angle_per_pass is material + thickness specific.

Before/After for GI 1.5mm C-section (2 bends, 90°):
  v1.0: base=2 + complexity=0 + thickness=2 + material=0 = 4  ← wrong
  v2.0: ppb=ceil(90/25)=4, forming=4×2=8, +entry+calib = 10, min=8  ← correct
"""
import math
import logging
from typing import Dict, Any

from app.utils.response import pass_response

logger = logging.getLogger("station_engine")

# ── Springback degrees per material ───────────────────────────────────────────
_SPRINGBACK_DEG: Dict[str, float] = {
    "GI":   1.5, "CR": 1.5, "AL": 1.0, "CU": 1.5, "PP": 1.0,
    "HR":   2.5, "MS": 2.5,
    "SS":   4.0, "HSLA": 3.5,
    "TI":   5.0,
}

# ── Max forming angle per pass (degrees) ──────────────────────────────────────
# Lower value = more passes needed per bend = more stations
# Bands: thin <0.8mm | standard 0.8–1.2mm | medium_heavy 1.2–2.0mm | heavy ≥2.0mm
_MAX_ANGLE: Dict[str, Dict[str, float]] = {
    "GI":   {"thin": 30, "standard": 28, "medium_heavy": 25, "heavy": 20},
    "CR":   {"thin": 30, "standard": 28, "medium_heavy": 25, "heavy": 20},
    "AL":   {"thin": 35, "standard": 32, "medium_heavy": 28, "heavy": 24},
    "CU":   {"thin": 32, "standard": 28, "medium_heavy": 25, "heavy": 20},
    "PP":   {"thin": 28, "standard": 25, "medium_heavy": 22, "heavy": 18},
    "HR":   {"thin": 25, "standard": 22, "medium_heavy": 20, "heavy": 16},
    "MS":   {"thin": 25, "standard": 22, "medium_heavy": 20, "heavy": 16},
    "SS":   {"thin": 18, "standard": 15, "medium_heavy": 13, "heavy": 10},
    "HSLA": {"thin": 20, "standard": 18, "medium_heavy": 15, "heavy": 12},
    "TI":   {"thin": 14, "standard": 12, "medium_heavy": 10, "heavy": 8},
}
_FALLBACK_ANGLE: Dict[str, float] = {
    "thin": 28, "standard": 25, "medium_heavy": 22, "heavy": 18,
}

# ── Section type → additional stations ────────────────────────────────────────
_SECTION_EXTRA: Dict[str, int] = {
    "simple_channel": 0, "c_channel": 0, "angle_section": 0,
    "z_purlin": 1, "hat_section": 1,
    "lipped_channel": 2,
    "box_section": 2,
    "complex_section": 4, "complex_profile": 4,
    "shutter_profile": 5,
}


def _thickness_band(t: float) -> str:
    if t < 0.8:  return "thin"
    if t < 1.2:  return "standard"
    if t < 2.0:  return "medium_heavy"
    return "heavy"


def _max_angle_per_pass(material: str, thickness: float) -> float:
    band = _thickness_band(thickness)
    mat = _MAX_ANGLE.get(material.upper())
    return mat[band] if mat else _FALLBACK_ANGLE[band]


def _passes_per_bend(target_angle_deg: float, material: str, thickness: float) -> int:
    """How many forming passes are needed per 90° bend (excluding calibration)."""
    max_a = _max_angle_per_pass(material, thickness)
    return max(2, math.ceil(target_angle_deg / max_a))


def estimate(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
) -> Dict[str, Any]:
    bend_count   = max(1, int(profile_result.get("bend_count", 1)))
    thickness    = float(input_result.get("sheet_thickness_mm", 1.0))
    material     = str(input_result.get("material", "GI")).upper()
    return_bends = int(profile_result.get("return_bends_count", 0))

    section_type = (
        flower_result.get("section_type")
        or profile_result.get("profile_type", "simple_channel")
        or "simple_channel"
    ).lower().replace(" ", "_").replace("/", "_")

    PRIMARY_ANGLE = 90.0

    ppb           = _passes_per_bend(PRIMARY_ANGLE, material, thickness)
    forming_passes = ppb * bend_count

    entry_stations       = 1
    calibration_stations = 2 if material in {"SS", "HSLA", "TI"} else 1

    section_extra  = _SECTION_EXTRA.get(section_type, 1)
    return_extra   = min(return_bends, 5) * 2

    springback_deg   = _SPRINGBACK_DEG.get(material, 2.0)
    springback_extra = 1 if springback_deg >= 2.0 else 0

    recommended = (
        entry_stations
        + forming_passes
        + calibration_stations
        + section_extra
        + return_extra
        + springback_extra
    )

    recommended = max(recommended, bend_count + 3)
    recommended = min(recommended, 30)
    minimum     = max(bend_count + 2, recommended - 2)

    # ── Premium / high-accuracy tier ──────────────────────────────────────────
    # Extra intermediate straightening passes (≈20% more forming passes)
    # + 1 extra calibration pass for all materials
    # + 1 more for hard materials (SS, HSLA, TI) needing tighter sizing
    extra_intermediate = max(1, math.ceil(forming_passes * 0.20))
    extra_calib_premium = 2 if material in {"SS", "HSLA", "TI"} else 1
    premium = min(recommended + extra_intermediate + extra_calib_premium, 36)

    reason_log = {
        "passes_per_bend":           ppb,
        "forming_passes":            forming_passes,
        "entry_stations":            entry_stations,
        "calibration_stations":      calibration_stations,
        "section_extra":             section_extra,
        "return_extra":              return_extra,
        "springback_extra":          springback_extra,
        "max_angle_per_pass_deg":    _max_angle_per_pass(material, thickness),
        "primary_bend_angle_deg":    PRIMARY_ANGLE,
        "material":                  material,
        "thickness_band":            _thickness_band(thickness),
        "premium_extra_intermediate": extra_intermediate,
        "premium_extra_calib":       extra_calib_premium,
    }

    logger.info(
        "[station_engine v2.0] bends=%d mat=%s t=%.2f ppb=%d forming=%d "
        "→ min=%d recommended=%d premium=%d",
        bend_count, material, thickness, ppb, forming_passes, minimum, recommended, premium,
    )

    return pass_response("station_engine", {
        "min_station_count":         minimum,
        "recommended_station_count": recommended,
        "premium_station_count":     premium,
        "complexity_tier":           flower_result.get("forming_complexity_class", "SIMPLE"),
        "section_type":              section_type,
        "reason_log":                reason_log,
        "confidence_level":          "high",
    })
