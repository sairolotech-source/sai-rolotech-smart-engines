"""
station_engine.py — Station Estimation Engine  v2.1  (machine-aware)

v2.0: Passes-per-bend formula replacing incorrect bend_count base.
v2.1: Optional machine_config — clamps station count to machine stand_count,
      applies calibration offsets, rejects profiles that exceed machine limits.
"""
import math
import logging
from typing import Any, Dict, Optional

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
    machine_config: Optional[Dict[str, Any]] = None,
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

    # For shutter/ribbed profiles all ribs form simultaneously in the same set
    # of passes — only need ppb × ceil(bend_count/4) forming passes, not ppb × bend_count.
    if section_type in ("shutter_profile", "shutter_slat"):
        forming_passes = ppb * max(2, math.ceil(bend_count / 4))
    else:
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

    # ── Machine-aware clamping (v2.1) ─────────────────────────────────────────
    machine_id      = None
    machine_warnings: list = []
    machine_blocking: list = []
    machine_clamped  = False

    if machine_config:
        machine_id  = machine_config.get("machine_id", "UNKNOWN")
        stand_limit = int(machine_config.get("stand_count", 9999))
        plr         = machine_config.get("pass_limit_rules", {})
        max_bends   = int(plr.get("max_bends_per_profile", 9999))
        t_min       = float(machine_config.get("thickness_min_mm", 0))
        t_max       = float(machine_config.get("thickness_max_mm", 9999))
        supp_mats   = [m.upper() for m in machine_config.get("supported_materials", [])]

        if thickness < t_min or thickness > t_max:
            machine_blocking.append(
                f"Thickness {thickness}mm out of machine range [{t_min}–{t_max}mm]"
            )
        if supp_mats and material not in supp_mats:
            machine_blocking.append(
                f"Material {material} not supported (machine supports: {supp_mats})"
            )
        if bend_count > max_bends:
            machine_blocking.append(
                f"Profile has {bend_count} bends > machine limit {max_bends}"
            )
        if recommended > stand_limit:
            machine_warnings.append(
                f"Computed {recommended} stations exceeds machine stand_count {stand_limit}; "
                f"clamped to {stand_limit}"
            )
            recommended  = stand_limit
            premium      = min(premium, stand_limit)
            minimum      = min(minimum, stand_limit)
            machine_clamped = True
        elif recommended > stand_limit * 0.90:
            machine_warnings.append(
                f"Station utilisation {recommended}/{stand_limit} = "
                f"{recommended/stand_limit*100:.0f}% — near machine capacity"
            )

        offsets = machine_config.get("calibration_offsets", {})
        reason_log["machine_gap_correction_mm"]   = offsets.get("roll_gap_correction_mm", 0)
        reason_log["machine_angle_correction_deg"] = offsets.get("angle_correction_deg", 0)

    logger.info(
        "[station_engine v2.1] bends=%d mat=%s t=%.2f ppb=%d forming=%d "
        "→ min=%d recommended=%d premium=%d machine=%s",
        bend_count, material, thickness, ppb, forming_passes, minimum, recommended, premium,
        machine_id or "none",
    )

    result = {
        "min_station_count":         minimum,
        "recommended_station_count": recommended,
        "premium_station_count":     premium,
        "complexity_tier":           flower_result.get("forming_complexity_class", "SIMPLE"),
        "section_type":              section_type,
        "reason_log":                reason_log,
        "confidence_level":          "high",
    }
    if machine_id:
        result["machine_id"]           = machine_id
        result["machine_clamped"]      = machine_clamped
        result["machine_warnings"]     = machine_warnings
        result["machine_blocking"]     = machine_blocking
        result["machine_feasible"]     = len(machine_blocking) == 0

    return pass_response("station_engine", result)
