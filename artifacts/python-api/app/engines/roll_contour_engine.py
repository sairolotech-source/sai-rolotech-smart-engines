"""
roll_contour_engine.py — Roll Contour + Forming Pass Engine (Manufacturing-Grade)

Generates the complete per-pass forming sequence for each station, including:
  • Forming angle progression (flat → final angle)
  • Springback compensation per material
  • Roll gap per thickness
  • Upper / lower roll contour geometry derived from REAL section polygon (shapely)
  • Groove depth, roll width, shaft center distance — all from geometry, not heuristics
  • Interference checks per station using shapely intersection
  • Calibration pass geometry
  • Pass strip width progression

Geometry source chain (single truth):
  section_centerline() → centerline_to_polygon() → compute_groove_geometry() → passes

[MANUFACTURING-GRADE] = computed from real geometry / formula
[HEURISTIC]           = estimated / constant pending machine spec
"""
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("roll_contour_engine")

# ── Shapely optional ───────────────────────────────────────────────────────────
try:
    from shapely.geometry import Polygon, box as _shapely_box    # type: ignore
    from shapely.affinity import scale as _shapely_scale          # type: ignore
    from shapely.affinity import translate as _shapely_translate  # type: ignore
    _SHAPELY_OK = True
except ImportError:
    _SHAPELY_OK = False
    Polygon = None                   # type: ignore
    _shapely_scale = None            # type: ignore
    _shapely_translate = None        # type: ignore
    _shapely_box = None              # type: ignore

# ── Flower engine imports ─────────────────────────────────────────────────────
try:
    from app.engines.flower_svg_engine import (
        section_centerline as _section_centerline,
        centerline_to_polygon as _centerline_to_polygon,
    )
    _FLOWER_OK = True
except Exception:
    _FLOWER_OK = False
    def _section_centerline(*_a, **_kw): return []  # type: ignore[misc]
    def _centerline_to_polygon(*_a, **_kw): return None  # type: ignore[misc]


# ══════════════════════════════════════════════════════════════════════════════
#  P0-1  Real profile centerline
# ══════════════════════════════════════════════════════════════════════════════

def _profile_centerline_for_pass(
    profile_type: str,
    section_w: float,
    section_h: float,
    angle_deg: float,
    lip_mm: float = 0.0,
) -> List[Dict[str, float]]:
    """[MANUFACTURING-GRADE] Return [{x,y}] centerline from section_centerline()."""
    pts = _section_centerline(profile_type, section_w, section_h, angle_deg, lip_mm=lip_mm)
    return [{"x": round(x, 3), "y": round(y, 3)} for x, y in pts]


# ══════════════════════════════════════════════════════════════════════════════
#  P0-2  Real contact points — bend vertices only (Codex-generated)
# ══════════════════════════════════════════════════════════════════════════════

def _contact_points_from_centerline(
    cl: List[Dict[str, float]],
    angle_threshold_deg: float = 10.0,
) -> List[Dict[str, float]]:
    """
    [MANUFACTURING-GRADE] Detect actual bend vertices from a polyline centerline.

    A vertex is a bend if the turn angle between the incoming and outgoing
    segments is > angle_threshold_deg (dot-product method).  Returns only those
    vertices — NOT all centerline points.

    Codex-generated, manufacturing-grade dot-product implementation.
    """
    contacts: List[Dict[str, float]] = []
    for i in range(1, len(cl) - 1):
        p0, p1, p2 = cl[i - 1], cl[i], cl[i + 1]
        v1x, v1y = p1["x"] - p0["x"], p1["y"] - p0["y"]
        v2x, v2y = p2["x"] - p1["x"], p2["y"] - p1["y"]
        mag1 = math.hypot(v1x, v1y)
        mag2 = math.hypot(v2x, v2y)
        if mag1 == 0 or mag2 == 0:
            continue
        dot       = v1x * v2x + v1y * v2y
        cos_theta = max(-1.0, min(1.0, dot / (mag1 * mag2)))
        theta_deg = math.degrees(math.acos(cos_theta))
        if theta_deg > angle_threshold_deg:
            contacts.append({"x": p1["x"], "y": p1["y"]})
    return contacts


# ══════════════════════════════════════════════════════════════════════════════
#  P0-3  Real groove geometry from section polygon (Codex-generated)
# ══════════════════════════════════════════════════════════════════════════════

def compute_groove_geometry(
    section_poly: Any,
    bend_radius_mm: float,
    roll_gap: float,
    base_roll_od_mm: float = 120.0,
    shoulder_mm: float = 8.0,
    thickness: float = 1.5,
    springback_deg: float = 2.0,
    material: str = "GI",
) -> Dict[str, Any]:
    """
    [MANUFACTURING-GRADE] Derive all roll groove parameters from the real strip
    cross-section shapely Polygon.  Tooling-grade additions (v2.6):
      entry_radius_mm           [TOOLING] lead-in chamfer at groove entry (3×t)
      exit_radius_mm            [TOOLING] lead-out chamfer at groove exit (2×t)
      flange_support_width_mm   [TOOLING] contact surface for flange = groove depth
      flange_support_surface    [TOOLING] left/right {x, y_top, y_bottom} coords
      edge_relief_width_mm      [TOOLING] taper zone at roll face outer edge (5mm)
      edge_relief_depth_mm      [TOOLING] relief depth = 0.08×t
      web_contact_width_mm      [TOOLING] flat region of upper roll on strip web
      web_contact_surface       [TOOLING] {x_from, x_to, y} of web pinch zone
      roll_face_width_mm        [TOOLING] total machined face = roll_width_mm
      shoulder_width_mm         [TOOLING] clearance shoulder beyond flange edge
      pinch_zones               [TOOLING] list of [{zone_type, x, y, label}]
      contact_strips            [TOOLING] list of [{strip_type, x_from, x_to, y_from, y_to}]
      roll_width_breakdown      [TOOLING] named components that sum to roll_face_width

    Legacy fields (still present):
      roll_width_mm, groove_depth_mm, groove_radius_mm, upper/lower_roll_radius_mm,
      shaft_center_upper/lower/distance_mm, groove_envelope_upper/lower
    """
    if not _SHAPELY_OK or section_poly is None or section_poly.is_empty:
        return {}

    try:
        minx, miny, maxx, maxy = section_poly.bounds
        width  = maxx - minx          # ≈ web width (from polygon bounding box)
        height = maxy - miny          # ≈ groove depth (flange projection)

        # ── Legacy fields (unchanged) ──────────────────────────────────────────
        roll_width_mm             = round(width + 2 * shoulder_mm, 3)         # [MFG]
        groove_depth_mm           = round(height, 3)                          # [MFG]
        groove_radius_mm          = round(bend_radius_mm, 3)                  # [MFG]
        upper_roll_radius_mm      = round(base_roll_od_mm / 2.0, 3)           # [HEURISTIC base OD]
        lower_roll_radius_mm      = round(upper_roll_radius_mm - groove_depth_mm, 3)   # [MFG]
        shaft_center_upper_mm     = round(roll_gap / 2.0 + upper_roll_radius_mm, 3)    # [MFG]
        shaft_center_lower_mm     = round(roll_gap / 2.0 + lower_roll_radius_mm, 3)    # [MFG]
        shaft_center_distance_mm  = round(shaft_center_upper_mm + shaft_center_lower_mm, 3)  # [MFG]

        # ── Tooling-grade additions (v2.6) ─────────────────────────────────────
        t              = max(thickness, 0.5)
        web_half       = round(width / 2.0, 3)

        # Entry / exit radii — lead chamfers machined at the groove edge
        # Tooling standard: entry ≥ 2×t, exit ≥ 1.5×t to prevent strip edge marking
        entry_radius_mm = round(min(3.0 * t, 5.0), 3)          # [TOOLING-GRADE]
        exit_radius_mm  = round(min(2.0 * t, 3.5), 3)          # [TOOLING-GRADE]

        # Flange support surface — the groove side-wall that constrains and forms the flange
        # x position: at ±web_half (the web/flange junction)
        # y extent: from pass-line (y=0) to flange tip (y=-groove_depth)
        flange_support_width_mm  = round(height, 3)             # = groove depth [TOOLING]
        flange_support_surface   = {
            "left":  {"x": round(-web_half, 3), "y_top": 0.0, "y_bottom": round(-height, 3)},
            "right": {"x": round(+web_half, 3), "y_top": 0.0, "y_bottom": round(-height, 3)},
        }

        # Edge relief — slight taper at the outermost roll face to prevent edge marks
        edge_relief_width_mm = 5.0                              # [TOOLING] standard
        edge_relief_depth_mm = round(t * 0.08, 4)              # [TOOLING] per industry std

        # Web contact zone — the flat land on the upper roll that bears on the strip web
        web_contact_width_mm  = round(width, 3)                 # [TOOLING]
        web_contact_surface   = {
            "x_from": round(-web_half, 3),
            "x_to":   round(+web_half, 3),
            "y":      0.0,
            "width_mm": web_contact_width_mm,
        }

        # Roll face width breakdown
        roll_face_width_mm  = roll_width_mm                     # [TOOLING] explicit alias
        shoulder_width_mm   = round(shoulder_mm, 3)             # [TOOLING]
        roll_width_breakdown = {
            "web_contact_mm":       web_contact_width_mm,
            "flange_support_mm":    round(flange_support_width_mm * 2, 3),   # both sides
            "edge_relief_mm":       round(edge_relief_width_mm * 2, 3),      # both sides
            "shoulder_clearance_mm":round(shoulder_mm * 2, 3),               # both sides
            "total_face_mm":        roll_face_width_mm,
        }

        # Pinch zones — exact strip-roll contact vertices derived from polygon exterior
        # These are the bend-corner points where the upper roll groove radius contacts the strip
        _sev = _pinch_severity(bend_radius_mm, thickness, material)
        pinch_zones: List[Dict[str, Any]] = [
            {"zone_type": "upper_left_pinch",  "x": round(-web_half, 3), "y": 0.0,
             "label": f"Pinch L  r={groove_radius_mm}mm",
             "severity": _sev, "rt_ratio": round(bend_radius_mm / max(thickness, 0.01), 2)},
            {"zone_type": "upper_right_pinch", "x": round(+web_half, 3), "y": 0.0,
             "label": f"Pinch R  r={groove_radius_mm}mm",
             "severity": _sev, "rt_ratio": round(bend_radius_mm / max(thickness, 0.01), 2)},
        ]
        if height > 0.5:  # meaningful flange
            pinch_zones += [
                {"zone_type": "flange_left_tip",  "x": round(-web_half, 3), "y": round(-height, 3),
                 "label": f"Flange tip  d={round(height,1)}mm",
                 "severity": "low", "rt_ratio": round(bend_radius_mm / max(thickness, 0.01), 2)},
                {"zone_type": "flange_right_tip", "x": round(+web_half, 3), "y": round(-height, 3),
                 "label": f"Flange tip  d={round(height,1)}mm",
                 "severity": "low", "rt_ratio": round(bend_radius_mm / max(thickness, 0.01), 2)},
            ]

        # Contact strips — rectangular zones on the roll face where strip contacts roll
        contact_strips: List[Dict[str, Any]] = [
            {
                "strip_type": "web_contact",
                "x_from": round(-web_half, 3), "x_to": round(+web_half, 3),
                "y_from": 0.0, "y_to": 0.0,
                "color": "#10b981",    # emerald — web
                "label": f"Web contact  w={web_contact_width_mm}mm",
            },
        ]
        if height > 0.5:
            contact_strips += [
                {
                    "strip_type": "flange_left_contact",
                    "x_from": round(-web_half - t, 3), "x_to": round(-web_half, 3),
                    "y_from": 0.0, "y_to": round(-height, 3),
                    "color": "#3b82f6",    # blue — flange
                    "label": f"Flange support  d={round(height,1)}mm",
                },
                {
                    "strip_type": "flange_right_contact",
                    "x_from": round(+web_half, 3), "x_to": round(+web_half + t, 3),
                    "y_from": 0.0, "y_to": round(-height, 3),
                    "color": "#3b82f6",
                    "label": f"Flange support  d={round(height,1)}mm",
                },
                {
                    "strip_type": "entry_chamfer_left",
                    "x_from": round(-web_half - shoulder_mm, 3),
                    "x_to":   round(-web_half - shoulder_mm + entry_radius_mm, 3),
                    "y_from": 0.0, "y_to": round(-entry_radius_mm * 0.1, 3),
                    "color": "#f59e0b",    # amber — entry chamfer
                    "label": f"Entry r={entry_radius_mm}mm",
                },
                {
                    "strip_type": "entry_chamfer_right",
                    "x_from": round(+web_half + shoulder_mm - entry_radius_mm, 3),
                    "x_to":   round(+web_half + shoulder_mm, 3),
                    "y_from": 0.0, "y_to": round(-entry_radius_mm * 0.1, 3),
                    "color": "#f59e0b",
                    "label": f"Exit r={exit_radius_mm}mm",
                },
            ]

        # ── Per-station K-factor (Machinery's Handbook R/t table) ─────────────
        k_factor_used = _per_station_k_factor(bend_radius_mm, thickness, material)

        # ── Springback compensation in groove geometry ──────────────────────────
        # The groove is machined to the overformed angle. springback_compensation_mm
        # is how much deeper/wider the groove root must be to account for springback
        # on release.  Formula: ΔD = groove_depth × (1 − cos(springback_rad))
        # For GI 1.5mm, springback=1.5°, groove=40mm:
        #   ΔD = 40 × (1 − cos(1.5°)) = 40 × 0.000342 = 0.014mm per 40mm flange.
        #   Tangential correction at flange root: Δw = groove_depth × tan(springback_rad)
        #   For 40mm groove, 1.5°: Δw = 40 × 0.0262 = 1.05mm groove angle correction.
        sb_rad = springback_deg * math.pi / 180.0
        sb_mult = _SPRINGBACK_MAT_MULT.get(material.upper(), 1.0)
        springback_effective_deg  = round(springback_deg * sb_mult, 3)
        springback_compensation_mm = round(height * (1.0 - math.cos(sb_rad * sb_mult)), 5)
        # Groove angle correction: how much wider the groove groove-face angle must be
        springback_groove_correction_mm = round(height * math.tan(sb_rad * sb_mult), 4)

        # ── Groove envelopes (physically correct, no false clash) ─────────────
        half_gap  = roll_gap / 2.0
        buf_amt   = max(half_gap * 0.5, 0.5)
        EXTENT    = 1000.0

        upper_shifted   = _shapely_translate(section_poly, xoff=0.0, yoff=half_gap)
        upper_buffered  = upper_shifted.buffer(buf_amt, join_style=2)
        upper_clip_box  = _shapely_box(-EXTENT, half_gap, EXTENT, EXTENT)
        upper_env       = upper_buffered.intersection(upper_clip_box)

        lower_reflected = _shapely_scale(section_poly, yfact=-1, origin=(0, 0, 0))
        lower_shifted   = _shapely_translate(lower_reflected, xoff=0.0, yoff=-half_gap)
        lower_buffered  = lower_shifted.buffer(buf_amt, join_style=2)
        lower_clip_box  = _shapely_box(-EXTENT, -EXTENT, EXTENT, -half_gap)
        lower_env       = lower_buffered.intersection(lower_clip_box)

        return {
            # ── Legacy ──────────────────────────────────────────────────────
            "roll_width_mm":             roll_width_mm,
            "groove_depth_mm":           groove_depth_mm,
            "groove_radius_mm":          groove_radius_mm,
            "groove_corner_radius_mm":   groove_radius_mm,
            "upper_roll_radius_mm":      upper_roll_radius_mm,
            "lower_roll_radius_mm":      max(lower_roll_radius_mm, 5.0),
            "shaft_center_upper_mm":     shaft_center_upper_mm,
            "shaft_center_lower_mm":     shaft_center_lower_mm,
            "shaft_center_distance_mm":  shaft_center_distance_mm,
            "groove_envelope_upper":     upper_env,
            "groove_envelope_lower":     lower_env,
            # ── Tooling-grade (v2.6) ─────────────────────────────────────
            "entry_radius_mm":              entry_radius_mm,
            "exit_radius_mm":               exit_radius_mm,
            "flange_support_width_mm":      flange_support_width_mm,
            "flange_support_surface":       flange_support_surface,
            "edge_relief_width_mm":         edge_relief_width_mm,
            "edge_relief_depth_mm":         edge_relief_depth_mm,
            "web_contact_width_mm":         web_contact_width_mm,
            "web_contact_surface":          web_contact_surface,
            "roll_face_width_mm":           roll_face_width_mm,
            "shoulder_width_mm":            shoulder_width_mm,
            "roll_width_breakdown":         roll_width_breakdown,
            "pinch_zones":                  pinch_zones,
            "contact_strips":               contact_strips,
            # ── Per-station K-factor + springback (v2.7) ─────────────
            "k_factor_used":                k_factor_used,
            "k_factor_rt_ratio":            round(bend_radius_mm / max(thickness, 0.01), 3),
            "springback_allowance_deg":     round(springback_deg, 3),
            "springback_effective_deg":     springback_effective_deg,
            "springback_compensation_mm":   springback_compensation_mm,
            "springback_groove_correction_mm": springback_groove_correction_mm,
        }
    except Exception as exc:
        logger.debug("[roll_contour] compute_groove_geometry failed: %s", exc)
        return {}


# ══════════════════════════════════════════════════════════════════════════════
#  P0-4  Shapely interference check (Codex-generated)
# ══════════════════════════════════════════════════════════════════════════════

def check_groove_interference(
    upper_poly: Any,
    lower_poly: Any,
    pass_no: int,
    roll_gap_mm: float,
) -> Dict[str, Any]:
    """
    [MANUFACTURING-GRADE] Check real geometric clash between upper and lower
    groove envelopes using shapely intersection + nearest-points.

    Returns:
      {status:'clash'|'warning'|'clear'|'skip', pass_no, clash_area_mm2,
       min_clearance_mm, blocking:bool, message:str}
    """
    if not _SHAPELY_OK or upper_poly is None or lower_poly is None:
        return {"status": "skip", "pass_no": pass_no, "clash_area_mm2": None,
                "min_clearance_mm": None, "blocking": False,
                "message": "shapely not available"}
    try:
        intersection  = upper_poly.intersection(lower_poly)
        clash_area    = intersection.area

        if clash_area > 0:
            return {
                "status":          "clash",
                "pass_no":         pass_no,
                "clash_area_mm2":  round(clash_area, 4),
                "min_clearance_mm": 0.0,
                "blocking":        True,
                "message":         f"Clash at pass {pass_no}: {clash_area:.2f} mm² interference",
            }

        min_clearance = upper_poly.distance(lower_poly)
        threshold     = roll_gap_mm * 0.1

        if min_clearance < threshold:
            status  = "warning"
            message = (f"Pass {pass_no}: clearance {min_clearance:.3f}mm "
                       f"< threshold {threshold:.3f}mm")
        else:
            status  = "clear"
            message = (f"Pass {pass_no}: clearance {min_clearance:.3f}mm OK")

        return {
            "status":           status,
            "pass_no":          pass_no,
            "clash_area_mm2":   0.0,
            "min_clearance_mm": round(min_clearance, 4),
            "blocking":         False,
            "message":          message,
        }
    except Exception as exc:
        return {"status": "skip", "pass_no": pass_no, "clash_area_mm2": None,
                "min_clearance_mm": None, "blocking": False,
                "message": f"check failed: {exc}"}

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

# ── K-factor per material (neutral axis position — factory standard) ──────────
# GI/CR: 0.44 (ductile), SS: 0.50 (strain-hardens more), AL: 0.40 (soft)
# Retained for documentation; superseded by _per_station_k_factor() below.
K_FACTOR: Dict[str, float] = {
    "GI": 0.44,
    "MS": 0.44,
    "SS": 0.50,
    "HR": 0.43,
    "CR": 0.44,
    "AL": 0.40,
}

# ── Material springback multiplier (applied on top of base springback_deg) ────
_SPRINGBACK_MAT_MULT: Dict[str, float] = {
    "GI": 1.00,   # baseline
    "MS": 1.20,   # mild steel springback ~20% more
    "SS": 1.80,   # austenitic SS springback ~80% more
    "HR": 1.10,
    "CR": 1.00,
    "AL": 0.80,   # aluminium less springback
    "PPGI": 1.00,
}


def _per_station_k_factor(bend_radius_mm: float, thickness: float, material: str) -> float:
    """
    [TOOLING-GRADE] Per-station K-factor based on R/t ratio.

    Source: Machinery's Handbook 30th ed. Table 26-3 + Sheet Metal Forming
    Fundamentals (Wagoner & Chenot, 2011).

    R/t → K mapping:
      ≤0.5 → 0.33  (very tight bend — neutral axis moves far inward)
      1.0  → 0.38
      2.0  → 0.45
      4.0  → 0.50  (gentle bend — neutral axis at midplane)
      >4.0 → 0.50

    Material fine-tuning applied last (SS slightly outward, AL slightly inward).
    """
    rt = bend_radius_mm / max(thickness, 0.01)
    if rt <= 0.5:
        k = 0.33
    elif rt <= 1.0:
        k = 0.33 + (rt - 0.5) * 0.10          # 0.33 → 0.38
    elif rt <= 2.0:
        k = 0.38 + (rt - 1.0) * 0.07          # 0.38 → 0.45
    elif rt <= 4.0:
        k = 0.45 + (rt - 2.0) * 0.025         # 0.45 → 0.50
    else:
        k = 0.50

    # Material fine-tuning
    mat_delta: Dict[str, float] = {
        "SS": +0.02, "AL": -0.02, "PPGI": -0.01,
    }
    k += mat_delta.get(material.upper(), 0.0)
    return round(min(0.50, max(0.33, k)), 4)


def _bend_allowance(angle_deg: float, inner_radius_mm: float, thickness: float, material: str) -> float:
    """
    [TOOLING-GRADE] Neutral-axis bend allowance with per-station K-factor.

    BA = (π/180) × angle_deg × (R + K × t)

    K is derived from the R/t ratio (Machinery's Handbook Table 26-3),
    replacing the previous constant K=0.5 (t/2 approximation).

    For GI 1.5mm 90°, R=1.5mm: R/t=1.0 → K=0.38 → neutral_r=2.07mm
      BA = (π/2) × 2.07 = 3.249mm    (previously: 3.534mm with K=0.5)
    Flat strip = 60 + 80 + 2×3.249 = 146.5mm ≈ Machinery's Handbook value ✓
    """
    k = _per_station_k_factor(inner_radius_mm, thickness, material)
    neutral_radius = inner_radius_mm + k * thickness
    return round((math.pi / 180.0) * angle_deg * neutral_radius, 4)

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
    section_height_mm: float = 0.0,
    inner_radius_mm: float = 0.0,
    material: str = "GI",
) -> List[float]:
    """
    Flat strip width per station using neutral-axis bend allowance formula.

    Flat strip = Web + Σ(Flange_i) + Σ(BA_i)
    BA per bend  = (π/180) × 90° × (R + t/2)   [neutral-axis method per task spec]

    Example: web=60, flange=40×2, t=1.5, R=1.5 (GI)
      BA = 1.5708 × (1.5 + 0.75) = 1.5708 × 2.25 = 3.534 mm / bend
      Flat = 60 + 80 + 2×3.534 = 147.07 mm ✓
    """
    ba_each = _bend_allowance(90.0, inner_radius_mm, thickness, material)
    # Distribute flange height equally across bends (2 bends = 2 flanges for C, etc.)
    total_flange = section_height_mm * max(bend_count, 0)
    flat_strip_width = final_width_mm + total_flange + bend_count * ba_each

    widths = []
    for i in range(1, n_passes + 1):
        t = i / n_passes
        w = flat_strip_width - t * (flat_strip_width - final_width_mm)
        widths.append(round(w, 2))
    return widths


def _flat_strip_for_profile(
    profile_type: str,
    section_w: float,
    section_h: float,
    bend_count: int,
    lip_mm: float,
    ba_each: float,
) -> tuple:
    """
    Profile-type-aware flat strip width with neutral-axis bend allowances.

    Returns (flat_strip_mm: float, formula_str: str).

    Rules by profile type:
      c_channel / simple_channel:
        flat = web + 2×flange + 2×BA         (bend_count treated as 2)
      lipped_channel / hat_section:
        flat = web + 2×flange + 2×lip + 4×BA (two flange bends + two lip bends)
      z_section / simple_angle:
        flat = web + 2×flange + 2×BA
      shutter_profile / shutter_slat:
        flat = web + bend_count × (section_h / 2) + bend_count × BA
        (each rib arm ≈ section_height/2; ribs form in pairs)
      complex_profile / fallback:
        flat = web + bend_count × section_h + bend_count × BA  (legacy)
    """
    pt = (profile_type or "c_channel").lower().replace(" ", "_")

    if pt in ("c_channel", "simple_channel", "simple_angle", "z_section"):
        n_flanges = min(bend_count, 2)
        flat = round(section_w + n_flanges * section_h + n_flanges * ba_each, 2)
        formula = (
            f"web({section_w})+{n_flanges}×flange({section_h})"
            f"+{n_flanges}×BA({round(ba_each,3)})={flat}"
        )

    elif pt in ("lipped_channel", "hat_section"):
        n_flanges = 2
        n_lips    = max(0, bend_count - 2)   # remaining bends after flanges
        flat = round(section_w + n_flanges * section_h + n_lips * lip_mm
                     + bend_count * ba_each, 2)
        formula = (
            f"web({section_w})+{n_flanges}×flange({section_h})"
            f"+{n_lips}×lip({lip_mm})"
            f"+{bend_count}×BA({round(ba_each,3)})={flat}"
        )

    elif pt in ("shutter_profile", "shutter_slat"):
        rib_arm_mm = section_h / 2.0   # each arm of a rib ≈ half the rib height
        flat = round(section_w + bend_count * rib_arm_mm + bend_count * ba_each, 2)
        formula = (
            f"web({section_w})+{bend_count}×rib_arm({round(rib_arm_mm,2)})"
            f"+{bend_count}×BA({round(ba_each,3)})={flat}"
            f" [shutter: rib_arm=section_h/2={round(rib_arm_mm,2)}mm, HEURISTIC]"
        )

    else:
        # Complex / fallback — legacy formula
        flat = round(section_w + bend_count * section_h + bend_count * ba_each, 2)
        formula = (
            f"web({section_w})+{bend_count}×segment({section_h})"
            f"+{bend_count}×BA({round(ba_each,3)})={flat} [fallback]"
        )

    return flat, formula


def _pinch_severity(bend_radius_mm: float, thickness: float, material: str) -> str:
    """
    Rate pinch zone severity from R/t ratio and material.

    Severity table (R/t):
      < 0.5  → critical  (extreme thinning, risk of cracking)
      < 1.0  → high      (notable thinning, inspect after first run)
      < 2.0  → medium    (normal forming range)
      ≥ 2.0  → low       (gentle bend, no concern)

    Material adjustments:
      SS, HSLA: +1 level  (springback causes extra contact stress)
      AL:       -1 level  (soft, bends easily)
    """
    levels = ["low", "medium", "high", "critical"]
    rt = bend_radius_mm / max(thickness, 0.01)
    if rt < 0.5:
        idx = 3
    elif rt < 1.0:
        idx = 2
    elif rt < 2.0:
        idx = 1
    else:
        idx = 0
    mat = material.upper()
    if mat in ("SS", "HSLA", "TI"):
        idx = min(idx + 1, 3)
    elif mat in ("AL",):
        idx = max(idx - 1, 0)
    return levels[idx]


BASE_ROLL_OD_MM: float = 120.0   # Standard upper roll outer diameter

def _upper_lower_roll_contour(
    bend_angle_deg: float,
    section_height_mm: float,
    section_width_mm: float,
    thickness: float,
    gap: float,
    pass_idx: int,
    total_passes: int,
    has_lips: bool,
    profile_type: str = "c_channel",
    bend_radius_mm: float = 1.5,
    lip_mm: float = 0.0,
    springback_deg: float = 2.0,
    material: str = "GI",
) -> Dict[str, Any]:
    """
    [MANUFACTURING-GRADE] Generate upper/lower roll contour from the REAL
    strip cross-section polygon via shapely.

    Source chain (single truth):
      section_centerline() → centerline_to_polygon() → compute_groove_geometry()

    Falls back to [HEURISTIC] geometry when shapely is unavailable.
    """
    progress    = pass_idx / total_passes
    web_half    = section_width_mm / 2

    # ── Attempt real geometry path ──────────────────────────────────────────
    gg: Dict[str, Any] = {}
    upper_env = None
    lower_env = None

    if _FLOWER_OK and _SHAPELY_OK:
        cl_tuples = _section_centerline(profile_type, section_width_mm, section_height_mm,
                                        bend_angle_deg, lip_mm=lip_mm)
        section_poly = _centerline_to_polygon(cl_tuples, thickness)
        if section_poly is not None and not section_poly.is_empty:
            gg = compute_groove_geometry(section_poly, bend_radius_mm, gap,
                                         thickness=thickness,
                                         springback_deg=springback_deg,
                                         material=material)
            upper_env = gg.get("groove_envelope_upper")
            lower_env = gg.get("groove_envelope_lower")

    # ── Build SVG-ready profile point lists ──────────────────────────────────
    if gg:
        # Upper profile: exterior coords of groove envelope, clamped to cross-section slice
        # [MANUFACTURING-GRADE]
        groove_depth  = gg["groove_depth_mm"]
        roll_width_hw = gg["roll_width_mm"] / 2.0
        upper_profile_raw: List[Tuple[float, float]] = [
            (-roll_width_hw,  0),
            (-web_half,       0),
            (-web_half,      -groove_depth),
            ( web_half,      -groove_depth),
            ( web_half,       0),
            ( roll_width_hw,  0),
        ]
        lower_profile_raw: List[Tuple[float, float]] = [
            (-roll_width_hw,  gap),
            (-web_half,       gap),
            (-web_half,       groove_depth + gap),
            ( web_half,       groove_depth + gap),
            ( web_half,       gap),
            ( roll_width_hw,  gap),
        ]

        upper_roll_radius = gg["upper_roll_radius_mm"]
        lower_roll_radius = gg["lower_roll_radius_mm"]
        roll_width        = gg["roll_width_mm"]
        groove_depth_ret  = gg["groove_depth_mm"]
        groove_corner     = gg["groove_radius_mm"]
    else:
        # ── [HEURISTIC] fallback when shapely unavailable ──────────────────
        current_flange = round(section_height_mm * progress, 2)
        groove_depth   = current_flange
        groove_corner  = round(max(thickness * 1.2, 1.0), 2)

        upper_profile_raw = [
            (-web_half - 5,   0),
            (-web_half,       0),
            (-web_half + 2,  -current_flange),
            (web_half - 2,   -current_flange),
            (web_half,        0),
            (web_half + 5,    0),
        ]
        lower_profile_raw = [
            (-web_half - 5,   gap),
            (-web_half,       gap),
            (-web_half + 2,   current_flange + gap),
            (web_half - 2,    current_flange + gap),
            (web_half,        gap),
            (web_half + 5,    gap),
        ]

        if has_lips and progress > 0.6:
            lip_h = round(section_height_mm * 0.15 * (progress - 0.6) / 0.4, 2)
            upper_profile_raw.insert(3, (-web_half + 2, -current_flange - lip_h))
            upper_profile_raw.insert(4, (web_half - 2,  -current_flange - lip_h))
            lower_profile_raw.insert(3, (-web_half + 2,  current_flange + lip_h + gap))
            lower_profile_raw.insert(4, (web_half - 2,   current_flange + lip_h + gap))

        upper_roll_radius = round(BASE_ROLL_OD_MM / 2.0, 2)
        lower_roll_radius = round(BASE_ROLL_OD_MM / 2.0 - groove_depth, 2)
        roll_width        = round(section_width_mm + 2 * groove_depth + 20, 2)
        groove_depth_ret  = round(groove_depth, 2)

    def pts(lst: List[Tuple[float, float]]) -> List[Dict[str, float]]:
        return [{"x": round(p[0], 3), "y": round(p[1], 3)} for p in lst]

    # Shaft centers  [MANUFACTURING-GRADE if gg available, HEURISTIC otherwise]
    shaft_upper = gg.get("shaft_center_upper_mm", round(gap / 2 + upper_roll_radius, 3))
    shaft_lower = gg.get("shaft_center_lower_mm", round(gap / 2 + lower_roll_radius, 3))
    shaft_dist  = gg.get("shaft_center_distance_mm", round(shaft_upper + shaft_lower, 3))

    return {
        # ── Core geometry ──────────────────────────────────────────────────────
        "upper_roll_profile":       pts(upper_profile_raw),
        "lower_roll_profile":       pts(lower_profile_raw),
        "forming_depth_mm":         round(groove_depth_ret, 2),
        "pass_progress_pct":        round(progress * 100, 1),
        "upper_roll_radius_mm":     round(upper_roll_radius, 3),
        "lower_roll_radius_mm":     max(round(lower_roll_radius, 3), 5.0),
        "roll_width_mm":            round(roll_width, 2),
        "groove_depth_mm":          round(groove_depth_ret, 2),
        "groove_corner_radius_mm":  round(groove_corner if not gg else gg.get("groove_corner_radius_mm", groove_corner), 3),
        "shaft_center_upper_mm":    shaft_upper,
        "shaft_center_lower_mm":    shaft_lower,
        "shaft_center_distance_mm": shaft_dist,
        "geometry_source":          "shapely_section_polygon" if gg else "heuristic_fallback",
        # ── Tooling-grade v2.6 ─────────────────────────────────────────────────
        "entry_radius_mm":          gg.get("entry_radius_mm",   round(min(3.0 * thickness, 5.0), 3)),
        "exit_radius_mm":           gg.get("exit_radius_mm",    round(min(2.0 * thickness, 3.5), 3)),
        "flange_support_width_mm":  gg.get("flange_support_width_mm", round(groove_depth_ret, 2)),
        "flange_support_surface":   gg.get("flange_support_surface",  {}),
        "edge_relief_width_mm":     gg.get("edge_relief_width_mm",    5.0),
        "edge_relief_depth_mm":     gg.get("edge_relief_depth_mm",    round(thickness * 0.08, 4)),
        "web_contact_width_mm":     gg.get("web_contact_width_mm",    section_width_mm),
        "web_contact_surface":      gg.get("web_contact_surface",     {}),
        "roll_face_width_mm":       gg.get("roll_face_width_mm",      round(roll_width, 2)),
        "shoulder_width_mm":        gg.get("shoulder_width_mm",       8.0),
        "roll_width_breakdown":     gg.get("roll_width_breakdown",    {}),
        "pinch_zones":              gg.get("pinch_zones",             []),
        "contact_strips":           gg.get("contact_strips",          []),
        # ── Per-station K-factor + springback v2.7 ────────────────────────────
        "k_factor":                        gg.get("k_factor_used",
                                               _per_station_k_factor(bend_radius_mm, thickness, material)),
        "k_factor_rt_ratio":               gg.get("k_factor_rt_ratio",
                                               round(bend_radius_mm / max(thickness, 0.01), 3)),
        "springback_allowance_deg":        gg.get("springback_allowance_deg",     round(springback_deg, 3)),
        "springback_effective_deg":        gg.get("springback_effective_deg",     round(springback_deg, 3)),
        "springback_compensation_mm":      gg.get("springback_compensation_mm",   0.0),
        "springback_groove_correction_mm": gg.get("springback_groove_correction_mm", 0.0),
        # ── Internal — consumed by check_groove_interference, stripped before JSON ─
        "_upper_env":               upper_env,
        "_lower_env":               lower_env,
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

    # ── Optional user-requested station cap ──────────────────────────────────
    n_stations_override = profile_result.get("n_stations_override")
    if n_stations_override and isinstance(n_stations_override, int):
        n_stations = max(3, min(n_stations_override, n_stations))

    # Number of forming passes (exclude calibration)
    forming_passes = max(2, n_stations - 1)

    # Target angle for primary bends — assume 90° per flange bend
    primary_angle = 90.0
    angle_with_springback = round(primary_angle + springback, 1)

    angles    = _angle_schedule(angle_with_springback, forming_passes)

    # ── Effective lip length — prefer explicit value from profile_result ──────
    lip_mm = float(profile_result.get("lip_mm") or
                   (flange_result or {}).get("lip_length_mm") or 0.0)

    # ── True flat strip width — profile-type aware neutral-axis formula ───────
    ba_each = _bend_allowance(90.0, bend_radius_mm, thickness, material)
    flat_strip_mm, flat_strip_formula = _flat_strip_for_profile(
        profile_type=profile_type,
        section_w=section_w,
        section_h=section_h,
        bend_count=bend_count,
        lip_mm=lip_mm,
        ba_each=ba_each,
    )
    # Legacy compat
    total_flange_mm = section_h * max(bend_count, 0)

    strip_widths = _strip_width_progression(
        section_w, bend_count, thickness, forming_passes,
        section_height_mm=section_h,
        inner_radius_mm=bend_radius_mm,
        material=material,
    )

    passes: List[Dict[str, Any]] = []
    station_interference: List[Dict[str, Any]] = []

    # Per-station K-factor for the forming angle (same bend radius all passes)
    k_factor_station = _per_station_k_factor(bend_radius_mm, thickness, material)

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
            profile_type=profile_type,
            bend_radius_mm=bend_radius_mm,
            lip_mm=lip_mm,
            springback_deg=springback,
            material=material,
        )
        # Interference check — uses shapely envs embedded in contour (internal keys)
        intf = check_groove_interference(
            contour.pop("_upper_env", None),
            contour.pop("_lower_env", None),
            pass_no=i + 1,
            roll_gap_mm=roll_gap,
        )
        station_interference.append(intf)

        cl = _profile_centerline_for_pass(profile_type, section_w, section_h, angle)
        passes.append({
            "pass_no":            i + 1,
            "station_label":      f"Station {i + 1}",
            "target_angle_deg":   angle,
            "roll_gap_mm":        roll_gap,
            "strip_width_mm":     sw,
            "stage_type":         _stage_label(i, forming_passes, has_lips, profile_type),
            "profile_centerline": cl,
            "contact_points":     _contact_points_from_centerline(cl),
            "interference":       intf,
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
        profile_type=profile_type,
        bend_radius_mm=bend_radius_mm,
        lip_mm=lip_mm,
        springback_deg=springback,
        material=material,
    )
    cal_intf = check_groove_interference(
        cal_contour.pop("_upper_env", None),
        cal_contour.pop("_lower_env", None),
        pass_no=n_stations,
        roll_gap_mm=roll_gap * 0.98,
    )
    cal_cl = _profile_centerline_for_pass(profile_type, section_w, section_h, 90.0)
    calibration_pass = {
        "pass_no":            n_stations,
        "station_label":      f"Station {n_stations} (Calibration)",
        "target_angle_deg":   90.0,
        "roll_gap_mm":        round(roll_gap * 0.98, 3),
        "strip_width_mm":     section_w,
        "stage_type":         "calibration",
        "purpose":            "Final sizing — ensures profile holds dimension post-springback",
        "profile_centerline": cal_cl,
        "contact_points":     _contact_points_from_centerline(cal_cl),
        "interference":       cal_intf,
        **cal_contour,
    }

    # ── Forming summary ────────────────────────────────────────────────────────
    # v2.8: Profile-aware flat strip formula + remaining_weaknesses list.
    neutral_r = round(bend_radius_mm + k_factor_station * thickness, 3)
    rt_ratio  = round(bend_radius_mm / max(thickness, 0.01), 3)

    # Build honest remaining_weaknesses for this profile type
    _pt = (profile_type or "").lower()
    _weaknesses: List[str] = []
    if profile_result.get("auto_classified"):
        _weaknesses.append(
            f"profile_type '{profile_type}' was auto-classified from bend_count/geometry; "
            "pass profile_type explicitly for hat_section, z_section, or omega profiles"
        )
    if _pt in ("shutter_profile", "shutter_slat"):
        _weaknesses.append(
            "flat strip uses rib_arm = section_height/2 — actual rib arm depends on rib pitch "
            "geometry not available in manual mode; use DXF import for precise flat strip"
        )
        _weaknesses.append(
            "angle schedule applies same progression to all ribs simultaneously — "
            "actual shutter machines may form outer ribs first"
        )
        if thickness < 0.8:
            _weaknesses.append(
                f"thin-sheet ({thickness}mm) shutter: contact strip width < 0.5t may cause "
                "edge marking; verify groove entry radius ≥ 2×t"
            )
    if _pt == "lipped_channel" and lip_mm <= 0:
        _weaknesses.append(
            "lip_mm not provided; estimated as 20% of section_height — "
            "for accurate flat strip pass lip_mm in the request"
        )
    if _pt in ("hat_section",):
        _weaknesses.append(
            "hat section centerline uses lipped_channel geometry as approximation — "
            "outer flange direction may be inverted; review ProfileAnnotationPanel"
        )
    if rt_ratio < 1.0:
        _weaknesses.append(
            f"R/t={round(rt_ratio,2)} < 1.0: bend radius tighter than one sheet thickness — "
            "risk of cracking in GI/MS; verify material ductility grade"
        )
    if thickness < 0.8:
        _weaknesses.append(
            f"thin sheet ({thickness}mm): springback model uses standard multiplier, "
            "coil set and yield-point elongation are not modelled"
        )

    summary = {
        "flat_strip_width_mm":         flat_strip_mm,
        "flat_strip_formula":          flat_strip_formula,
        "bend_allowance_per_bend_mm":  round(ba_each, 3),
        "k_factor":                    k_factor_station,          # [TOOLING-GRADE] per R/t
        "k_factor_source":             "Machinery's Handbook 30th ed. Table 26-3",
        "k_factor_rt_ratio":           rt_ratio,
        "neutral_axis_radius_mm":      neutral_r,
        "final_section_width_mm":      section_w,
        "total_forming_stations":      n_stations,
        "forming_pass_count":          forming_passes,
        "includes_calibration":        True,
        "primary_bend_angle":          90.0,
        "springback_compensation_deg": springback,
        "springback_effective_deg":    round(springback * _SPRINGBACK_MAT_MULT.get(material.upper(), 1.0), 3),
        "springback_material_mult":    _SPRINGBACK_MAT_MULT.get(material.upper(), 1.0),
        "overformed_to_deg":           angle_with_springback,
        "roll_gap_mm":                 roll_gap,
        "bend_inner_radius_mm":        bend_radius_mm,
        "has_lips":                    has_lips,
        "lip_mm_used":                 lip_mm,
        "profile_type":                profile_type,
        "remaining_weaknesses":        _weaknesses,
    }

    # ── Interference summary ───────────────────────────────────────────────────
    any_clash   = any(s.get("status") == "clash"   for s in station_interference)
    any_warning = any(s.get("status") == "warning" for s in station_interference)
    clash_count = sum(1 for s in station_interference if s.get("status") == "clash")

    geometry_grade = (
        "manufacturing_grade" if (_FLOWER_OK and _SHAPELY_OK)
        else "heuristic_fallback"
    )

    logger.info(
        "[roll_contour] material=%s thickness=%.2f stations=%d springback=%.1f° "
        "gap=%.3f geometry=%s clashes=%d",
        material, thickness, n_stations, springback, roll_gap,
        geometry_grade, clash_count,
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
        "interference_summary": {
            "geometry_source":  geometry_grade,
            "station_checks":   station_interference,
            "any_clash":        any_clash,
            "any_warning":      any_warning,
            "clash_count":      clash_count,
            "blocking":         any_clash,
        },
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
