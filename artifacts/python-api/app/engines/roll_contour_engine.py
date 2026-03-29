"""
roll_contour_engine.py — Roll Contour + Forming Pass Engine

Generates the complete per-pass forming sequence for each station, including:
  • Forming angle progression (flat → final angle)
  • Springback compensation per material
  • Roll gap per thickness
  • Upper / lower roll contour point sets
  • Calibration pass geometry
  • Pass strip width progression

Blueprint source: Ultra Pro – Roll Contour Engine spec.
"""
import logging
import math
from typing import Any, Dict, List, Tuple

logger = logging.getLogger("roll_contour_engine")

# ── Springback compensation (degrees added to compensate springback) ───────────
SPRINGBACK_DEG: Dict[str, float] = {
    "GI":  1.5,
    "MS":  2.5,
    "SS":  4.0,
    "HR":  2.0,
    "CR":  2.0,
    "AL":  1.0,
}

# ── Roll gap clearance per thickness band ──────────────────────────────────────
def _gap_clearance(thickness: float) -> float:
    if thickness < 1.0:
        return 0.05
    elif thickness <= 2.0:
        return 0.10
    else:
        return 0.15

# ── Bend radius factor (inner radius ≈ factor × thickness) ────────────────────
BEND_RADIUS_FACTOR: Dict[str, float] = {
    "GI":  1.0,
    "MS":  1.5,
    "SS":  2.0,
    "HR":  1.5,
    "CR":  1.0,
    "AL":  1.0,
}

# ── Pass angle schedule  ──────────────────────────────────────────────────────
# For a required 90° bend, typical industry schedule:
# Station 1: 20° → 2: 45° → 3: 70° → 4: 90° → +1 calibration
# We generalise this with a cubic easing.

def _angle_schedule(target_deg: float, n_passes: int) -> List[float]:
    """
    Generate per-pass angle targets with cubic easing (gradual then steep).
    Returns list of n_passes angles ending at target_deg.
    """
    angles = []
    for i in range(1, n_passes + 1):
        t = i / n_passes
        # Cubic ease-in: slow start, aggressive end
        eased = t ** 2 * (3 - 2 * t)
        angles.append(round(eased * target_deg, 1))
    return angles


def _strip_width_progression(
    final_width_mm: float,
    bend_count: int,
    thickness: float,
    n_passes: int,
) -> List[float]:
    """
    Approximate strip width at each station (strip narrows as bends are formed).
    Flat strip = final_width + (bend_arc_lengths).
    """
    bend_angle_rad = math.pi / 2  # assume 90° bends
    r = thickness * 1.25  # mid-plane radius approx
    arc_per_bend = r * bend_angle_rad
    flat_strip_width = final_width_mm + bend_count * arc_per_bend

    widths = []
    for i in range(1, n_passes + 1):
        t = i / n_passes
        w = flat_strip_width - t * (flat_strip_width - final_width_mm)
        widths.append(round(w, 2))
    return widths


def _upper_lower_roll_contour(
    bend_angle_deg: float,
    section_height_mm: float,
    section_width_mm: float,
    thickness: float,
    gap: float,
    pass_idx: int,
    total_passes: int,
    has_lips: bool,
) -> Dict[str, Any]:
    """
    Generate simplified upper/lower roll contour point sets.
    Returns 2D profile points (x, y) in mm — cross-section of the roll.
    For a lipped/flanged channel: web → flange → lip transition per pass.
    """
    progress = pass_idx / total_passes
    current_flange = round(section_height_mm * progress, 2)
    web_half       = section_width_mm / 2

    # Upper roll: pushes from above — profile inverted
    upper: List[Tuple[float, float]] = [
        (-web_half - 5,   0),
        (-web_half,       0),
        (-web_half + 2,  -current_flange),
        (web_half - 2,   -current_flange),
        (web_half,        0),
        (web_half + 5,    0),
    ]

    # Lower roll: supports from below — includes gap
    lower: List[Tuple[float, float]] = [
        (-web_half - 5,   gap),
        (-web_half,       gap),
        (-web_half + 2,   current_flange + gap),
        (web_half - 2,    current_flange + gap),
        (web_half,        gap),
        (web_half + 5,    gap),
    ]

    # Lip detail on final passes
    if has_lips and progress > 0.6:
        lip_h = round(section_height_mm * 0.15 * (progress - 0.6) / 0.4, 2)
        upper.insert(3, (-web_half + 2, -current_flange - lip_h))
        upper.insert(4, (web_half - 2,  -current_flange - lip_h))
        lower.insert(3, (-web_half + 2,  current_flange + lip_h + gap))
        lower.insert(4, (web_half - 2,   current_flange + lip_h + gap))

    def pts(lst: List[Tuple[float, float]]) -> List[Dict[str, float]]:
        return [{"x": p[0], "y": round(p[1], 3)} for p in lst]

    return {
        "upper_roll_profile": pts(upper),
        "lower_roll_profile": pts(lower),
        "forming_depth_mm":   round(current_flange, 2),
        "pass_progress_pct":  round(progress * 100, 1),
    }


def generate_roll_contour(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    station_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    flange_result: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Main entry point — generate complete roll contour plan.

    Returns:
      {
        status, engine,
        material, thickness, springback_deg, roll_gap_mm,
        target_angle_deg, final_angle_with_springback,
        passes: [ {pass_no, target_angle, roll_gap, strip_width, upper_roll_profile, lower_roll_profile, ...} ],
        calibration_pass: { ... },
        forming_summary: { ... }
      }
    """
    material  = input_result.get("material", "GI")
    thickness = input_result.get("sheet_thickness_mm", 1.0)
    n_stations = station_result.get("recommended_station_count", 6)
    section_w  = profile_result.get("section_width_mm", 100)
    section_h  = profile_result.get("section_height_mm", 40)
    bend_count = profile_result.get("bend_count", 2)
    has_lips   = (flange_result or {}).get("has_lips", False) or (flange_result or {}).get("lip_count", 0) > 0
    profile_type = profile_result.get("profile_type", "simple_channel")

    springback     = SPRINGBACK_DEG.get(material, 2.0)
    clearance      = _gap_clearance(thickness)
    roll_gap       = round(thickness + clearance, 3)
    bend_radius_mm = round(BEND_RADIUS_FACTOR.get(material, 1.5) * thickness, 2)

    # Number of forming passes (exclude calibration)
    forming_passes = max(2, n_stations - 1)

    # Target angle for primary bends — assume 90° per flange bend
    primary_angle = 90.0
    angle_with_springback = round(primary_angle + springback, 1)

    angles    = _angle_schedule(angle_with_springback, forming_passes)
    strip_widths = _strip_width_progression(section_w, bend_count, thickness, forming_passes)

    passes: List[Dict[str, Any]] = []
    for i, (angle, sw) in enumerate(zip(angles, strip_widths)):
        contour = _upper_lower_roll_contour(
            bend_angle_deg=angle,
            section_height_mm=section_h,
            section_width_mm=section_w,
            thickness=thickness,
            gap=roll_gap,
            pass_idx=i + 1,
            total_passes=forming_passes,
            has_lips=has_lips,
        )
        passes.append({
            "pass_no":          i + 1,
            "station_label":    f"Station {i + 1}",
            "target_angle_deg": angle,
            "roll_gap_mm":      roll_gap,
            "strip_width_mm":   sw,
            "stage_type":       _stage_label(i, forming_passes, has_lips, profile_type),
            **contour,
        })

    # ── Calibration pass ──────────────────────────────────────────────────────
    cal_contour = _upper_lower_roll_contour(
        bend_angle_deg=90.0,
        section_height_mm=section_h,
        section_width_mm=section_w,
        thickness=thickness,
        gap=roll_gap * 0.98,   # tighter gap for calibration
        pass_idx=forming_passes,
        total_passes=forming_passes,
        has_lips=has_lips,
    )
    calibration_pass = {
        "pass_no":          n_stations,
        "station_label":    f"Station {n_stations} (Calibration)",
        "target_angle_deg": 90.0,
        "roll_gap_mm":      round(roll_gap * 0.98, 3),
        "strip_width_mm":   section_w,
        "stage_type":       "calibration",
        "purpose":          "Final sizing — ensures profile holds dimension post-springback",
        **cal_contour,
    }

    # ── Forming summary ────────────────────────────────────────────────────────
    flat_width = strip_widths[0] if strip_widths else section_w
    summary = {
        "flat_strip_width_mm":    round(flat_width, 2),
        "final_section_width_mm": section_w,
        "total_forming_stations": n_stations,
        "forming_pass_count":     forming_passes,
        "includes_calibration":   True,
        "primary_bend_angle":     90.0,
        "springback_compensation_deg": springback,
        "overformed_to_deg":      angle_with_springback,
        "roll_gap_mm":            roll_gap,
        "bend_inner_radius_mm":   bend_radius_mm,
        "has_lips":               has_lips,
    }

    logger.info(
        "[roll_contour] material=%s thickness=%.2f stations=%d springback=%.1f° gap=%.3f",
        material, thickness, n_stations, springback, roll_gap,
    )

    return {
        "status":            "pass",
        "engine":            "roll_contour_engine",
        "material":          material,
        "thickness_mm":      thickness,
        "springback_deg":    springback,
        "roll_gap_mm":       roll_gap,
        "bend_radius_mm":    bend_radius_mm,
        "target_angle_deg":  primary_angle,
        "formed_to_deg":     angle_with_springback,
        "passes":            passes,
        "calibration_pass":  calibration_pass,
        "forming_summary":   summary,
    }


def _stage_label(
    idx: int,
    total: int,
    has_lips: bool,
    profile_type: str,
) -> str:
    if idx == 0:
        return "pre_bend"
    if has_lips and idx >= total - 2:
        return "lip_forming"
    quarter = total // 4
    if idx < quarter:
        return "initial_bend"
    elif idx < total - 1:
        return "progressive_forming"
    else:
        return "final_form"
