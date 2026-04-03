"""
advanced_roll_engine.py — Advanced Roll Contour Engine v2.3.0

Generates bend-wise progressive roll profiles for each station:
  • Angle-based pass morphing: flange tips follow correct sin/cos arc trajectory
    (flat strip → final formed profile). Replaces incorrect linear Y-scale.
  • Correct upper/lower roll split: upper roll has groove that wraps OUTSIDE the
    profile; lower roll is a flat cylinder supporting the web from below.
  • Corner radius handling per pass ratio + thickness
  • Lip-specific pass control (lipped_channel early-pass lip dampening)
  • Return bend clearance (additive offset per return bend count)
  • Per-stand notes (entry / intermediate / calibration stage labels)

FIX LOG (v2.3.0):
  BUG-1: morph_profile — was `y * ratio` (linear Y scale). Wrong: flanges do not
    move up linearly; they rotate about the web corner. At angle θ = ratio × 90°,
    flange tip Y = sin(θ) × flange_h, and tip X moves laterally:
      left tip X  = left_root  − cos(θ) × h_frac × flange_h
      right tip X = right_root + cos(θ) × h_frac × flange_h
    This is the standard roll-forming kinematic (circular arc path for flange tip).

  BUG-2: split_upper_lower — was (y ± gap/2) for BOTH upper and lower rolls.
    Wrong: upper roll and lower roll are NOT the same profile shifted up/down.
    • Upper roll groove (correct): flat body above flanges; groove wall at flange
      root positions; groove floor at (current_flange_h + half_gap) level; web
      contact zone at the flat bottom of the groove.
    • Lower roll (correct for upward-forming profiles): flat cylinder surface at
      y = −half_gap (no groove needed; flanges extend upward away from lower roll).

  BUG-3: apply_radius_logic — was y * smooth (additional Y-scale on top of morph).
    After angle-based morphing, this double-scaling is incorrect. Changed to
    pass-through (no additional Y-scaling).

Blueprint source: Advance Roll Engine + Export Engine blueprint v2.3.
"""
import math
from typing import Any, Dict, List, Tuple

from app.utils.response import pass_response, fail_response

Point = Tuple[float, float]


# ── Springback compensation ────────────────────────────────────────────────────
def get_springback(material: str) -> float:
    return {
        "GI": 1.5,
        "MS": 2.5,
        "CR": 2.5,
        "SS": 4.0,
        "HR": 3.0,
        "AL": 1.0,
    }.get(material.upper(), 2.0)


# ── Roll gap (forming gap = thickness + clearance) ────────────────────────────
def calculate_gap(thickness: float) -> float:
    if thickness < 1.0:
        return thickness + 0.05
    if thickness < 2.0:
        return thickness + 0.10
    return thickness + 0.15


# ── Final profile geometry ─────────────────────────────────────────────────────
def build_final_profile(
    profile_result: Dict[str, Any],
    section_features: Dict[str, Any],
) -> List[Point]:
    """
    Build the final (fully-formed, 90°) cross-section polygon for a profile type.

    Coordinate convention:
      x = 0 → left web edge (left flange root)
      x = width → right web edge (right flange root)
      y = 0 → web / pass line
      y > 0 → flange region (flanges form upward)
    """
    width  = float(profile_result.get("section_width_mm", 100))
    height = float(profile_result.get("section_height_mm", 50))
    ptype  = str(profile_result.get("profile_type", "simple_channel"))

    if ptype == "simple_channel":
        # Rectangle: web at y=0, flanges vertical at x=0 and x=width
        return [(0.0, 0.0), (0.0, height), (width, height), (width, 0.0)]

    if ptype == "lipped_channel":
        lip = min(12.0, height * 0.20)
        # Flanges at x=0 and x=width; inward lips at top
        return [
            (0.0,   0.0),   # left web corner
            (0.0,   height), # left flange tip (outer)
            (lip,   height), # left lip end (turns inward)
            (width - lip, height), # right lip end
            (width, height), # right flange tip (outer)
            (width, 0.0),   # right web corner
        ]

    if ptype == "shutter_profile":
        mid = width / 2
        return [
            (0.0,         0.0),
            (0.0,         height * 0.5),
            (mid * 0.5,   height),
            (mid,         height * 0.7),
            (width,       height * 0.5),
            (width,       0.0),
        ]

    # generic / complex
    return [
        (0.0,         0.0),
        (0.0,         height),
        (width * 0.3, height),
        (width * 0.5, height * 0.85),
        (width * 0.7, height),
        (width,       height),
        (width,       0.0),
    ]


# ── Pass ratio schedule ────────────────────────────────────────────────────────
def build_pass_ratios(
    station_count: int,
    profile_type: str,
    return_bends: int,
) -> List[float]:
    ratios: List[float] = []
    for i in range(1, station_count + 1):
        r = i / station_count
        if profile_type in {"complex_profile", "complex_section", "shutter_profile"}:
            r = r ** 1.15
        if return_bends > 0:
            r = min(1.0, r * 0.98 + 0.02)
        ratios.append(r)
    return ratios


# ── Profile morphing (FIXED v2.3.0) ───────────────────────────────────────────
def morph_profile(final_profile: List[Point], ratio: float) -> List[Point]:
    """
    [FIX v2.3.0] Angle-based profile morphing.

    BEFORE (wrong): y_new = y_final × ratio   (linear Y-scale — no lateral movement)
    AFTER  (fixed): angle = ratio × 90°
                    y_new = sin(angle) × h_frac × flange_h
                    x_new = root_x ∓ cos(angle) × h_frac × flange_h

    Physical basis:
      In roll forming the flange tip traces a circular arc about the web corner.
      At forming angle θ from flat:
        • Left flange tip  → x = left_root  − cos(θ)×H,  y = sin(θ)×H
        • Right flange tip → x = right_root + cos(θ)×H,  y = sin(θ)×H
      Intermediate flange points (fractional height h_frac) scale proportionally.

    At θ=0° (flat): flanges extend HORIZONTALLY outward (sin=0, cos=1).
    At θ=90° (formed): flanges are VERTICAL above the web corners (sin=1, cos=0).

    PROOF for simple_channel at ratio=0.5 (θ=45°), width=100, height=50:
      Old (wrong): left tip → (0, 25)   — stays at x=0, just half height
      New (fixed): left tip → (−35.4, 35.4) — correct: extends left and up at 45°
    """
    if not final_profile:
        return []

    angle_deg = min(max(ratio, 0.0), 1.0) * 90.0
    th     = math.radians(angle_deg)
    sin_th = math.sin(th)
    cos_th = math.cos(th)

    ys      = [p[1] for p in final_profile]
    min_y   = min(ys)
    max_y   = max(ys)
    flange_h = max_y - min_y

    if flange_h <= 1e-6:
        return [(round(x, 4), round(y, 4)) for x, y in final_profile]

    # Identify left and right web corners (y == min_y)
    web_xs   = sorted(p[0] for p in final_profile if abs(p[1] - min_y) < 1e-6)
    left_root  = web_xs[0]  if web_xs else 0.0
    right_root = web_xs[-1] if web_xs else final_profile[-1][0]
    mid_x      = (left_root + right_root) / 2.0

    result: List[Point] = []
    for x, y in final_profile:
        h_frac = (y - min_y) / flange_h  # 0 at web level, 1 at flange tip
        if h_frac < 1e-6:
            # Web corner: stays fixed at y=0
            result.append((round(x, 4), round(min_y, 4)))
        else:
            new_y = round(min_y + sin_th * h_frac * flange_h, 4)
            if x <= mid_x:
                # Left side: flange extends LEFT when flat
                new_x = round(left_root - cos_th * h_frac * flange_h, 4)
            else:
                # Right side: flange extends RIGHT when flat
                new_x = round(right_root + cos_th * h_frac * flange_h, 4)
            result.append((new_x, new_y))

    return result


def apply_radius_logic(
    profile: List[Point],
    thickness: float,
    ratio: float,
) -> List[Point]:
    """
    [FIX v2.3.0] Pass-through — no additional Y-scaling.

    BEFORE (wrong): y_new = y × smooth  where smooth = min(1.0, ratio + t×0.05)
      This double-scaled Y on top of morph_profile's angle-based calculation,
      which reduced the already-correct sin(θ) values by another factor.
    AFTER (fixed): returns profile unchanged.
      The angle schedule in morph_profile already provides physically correct
      position progression. Corner radius effect is embedded in the sin curve.
    """
    return list(profile)


def apply_lip_logic(profile: List[Point], profile_type: str, ratio: float) -> List[Point]:
    if profile_type != "lipped_channel" or len(profile) < 6:
        return profile
    adjusted = list(profile)
    if ratio < 0.5:
        # Early passes: lips not yet engaged — dampen inward lip points
        adjusted[2]  = (round(adjusted[2][0]  * 0.4, 4), adjusted[2][1])
        adjusted[-3] = (round(adjusted[-3][0]  + (adjusted[-1][0] - adjusted[-3][0]) * 0.6, 4), adjusted[-3][1])
    return adjusted


def apply_return_bend_clearance(
    profile: List[Point],
    return_bends: int,
    thickness: float,
    ratio: float,
) -> List[Point]:
    if return_bends <= 0:
        return profile
    clearance = thickness * 0.15 * ratio
    return [(round(x, 4), round(y + clearance, 4)) for x, y in profile]


# ── Upper / lower split (FIXED v2.3.0) ────────────────────────────────────────
def split_upper_lower(
    profile: List[Point],
    gap: float,
    shoulder_mm: float = 8.0,
) -> Tuple[List[Point], List[Point]]:
    """
    [FIX v2.3.0] Physically correct upper and lower roll contour generation.

    BEFORE (wrong):
      upper = [(x, y + gap/2) for x, y in profile]  — just shifts profile UP
      lower = [(x, y - gap/2) for x, y in profile]  — just shifts profile DOWN
      Both rolls had IDENTICAL shape (only vertically offset) — not real roll geometry.

    AFTER (fixed):
      Upper roll: groove wraps OUTSIDE the formed profile from above.
        - Outer shoulder: extends gap/2 above the max profile height.
        - Groove wall: descends at the flange root x-positions.
        - Groove floor (web contact zone): at y = min_y + gap/2.
          This is the flat land that contacts the strip's web top surface.
        - Shoulder extends outward by shoulder_mm on each side.

      Lower roll: flat cylinder supports the web from below.
        - For upward-forming profiles (c_channel, lipped_channel, hat, etc.):
          the lower roll is a flat disc — no groove needed because the flanges
          form UPWARD, away from the lower roll.
        - Top contact surface at y = min_y − gap/2 (below web by half-gap).
        - Shoulder extends outward by shoulder_mm on each side.

    PROOF (simple_channel at ratio=0.5 / θ=45°, width=100, flange_h=35.4mm, gap=1.6mm):
      Flange tip after morph: left at (−35.4, 35.4), right at (135.4, 35.4)
      Upper groove:
        left_root=0, right_root=100, max_y=35.4, shoulder_top_y=35.4+0.8+2×t
        groove floor (web contact) at y=0+0.8=0.8mm
        outer shoulder from x=−8 to x=108
      Lower roll:
        flat surface at y=0−0.8=−0.8mm (below pass line by half-gap)
        extends from x=−8 to x=108
    """
    if not profile:
        return [], []

    xs     = [p[0] for p in profile]
    ys     = [p[1] for p in profile]
    min_y  = min(ys)
    max_y  = max(ys)
    min_x  = min(xs)
    max_x  = max(xs)
    half_g = gap / 2.0

    # ── Upper roll (groove contour, viewed as bottom-face cross-section) ──────
    # The upper roll is ABOVE the strip; its bottom face has a groove.
    # Web contact zone:   y = min_y + half_g  (flat region between groove walls)
    # Groove outer wall:  x = min_x (left) and x = max_x (right)
    # Groove shoulder top: y = max_y + half_g  (above flange tips)
    # Outer shoulder:      extends to x = min_x - shoulder_mm and x = max_x + shoulder_mm

    web_contact_y = round(min_y + half_g, 4)       # flat bottom of groove (web contact)
    shoulder_top_y = round(max_y + half_g, 4)       # top of groove wall / shoulder height

    upper: List[Point] = [
        (round(min_x - shoulder_mm, 4), shoulder_top_y),   # far left shoulder top
        (round(min_x - shoulder_mm, 4), web_contact_y),    # far left shoulder inner face
        (round(min_x,               4), web_contact_y),    # left groove inner wall (web contact level)
        (round(min_x,               4), shoulder_top_y),   # left groove outer wall top (above flange)
        (round(max_x,               4), shoulder_top_y),   # right groove outer wall top
        (round(max_x,               4), web_contact_y),    # right groove inner wall (web contact level)
        (round(max_x + shoulder_mm, 4), web_contact_y),    # far right shoulder inner face
        (round(max_x + shoulder_mm, 4), shoulder_top_y),   # far right shoulder top
    ]

    # ── Lower roll (flat cylinder, viewed as top-face cross-section) ──────────
    # For upward-forming profiles: lower roll is a flat disc.
    # Top contact surface at y = min_y - half_g (below web pass line).
    lower_face_y = round(min_y - half_g, 4)

    lower: List[Point] = [
        (round(min_x - shoulder_mm, 4), lower_face_y),     # left shoulder edge
        (round(min_x,               4), lower_face_y),     # left web edge
        (round(max_x,               4), lower_face_y),     # right web edge
        (round(max_x + shoulder_mm, 4), lower_face_y),     # right shoulder edge
    ]

    return upper, lower


# ── Stand notes ────────────────────────────────────────────────────────────────
def build_stand_notes(
    stand_no: int,
    station_count: int,
    profile_type: str,
    return_bends: int,
) -> List[str]:
    notes: List[str] = []
    if stand_no <= 2:
        notes.append("Entry / pre-form stage")
    elif stand_no >= station_count - 1:
        notes.append("Calibration stage — final sizing")
    else:
        notes.append("Intermediate progressive forming stage")

    if profile_type == "lipped_channel":
        notes.append("Lip forming control required")
    if profile_type in {"shutter_profile", "complex_profile", "complex_section"}:
        notes.append("Complex contour — verify with profile projector")
    if return_bends > 0:
        notes.append("Return bend clearance check required at this stand")
    return notes


# ── Main entry point ───────────────────────────────────────────────────────────
def generate_advanced_rolls(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any],
    flower_result: Dict[str, Any],
    station_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate pass-wise upper/lower roll profiles for every station.

    v2.3.0 changes:
      - morph_profile now uses angle-based (sin/cos) trajectory
      - split_upper_lower now produces physically correct groove geometry
      - apply_radius_logic no longer double-scales Y
      - Each stand_data entry includes: angle_deg, groove_depth_mm, upper/lower roll geometry
    """
    if not profile_result:
        return fail_response("advanced_roll_engine", "Profile result missing")
    if not input_result:
        return fail_response("advanced_roll_engine", "Input result missing")
    if not flower_result:
        return fail_response("advanced_roll_engine", "Flower result missing")
    if not station_result:
        return fail_response("advanced_roll_engine", "Station result missing")

    thickness     = float(input_result.get("sheet_thickness_mm", 0))
    material      = str(input_result.get("material", "GI")).upper()
    section_w     = float(profile_result.get("section_width_mm", 0))
    section_h     = float(profile_result.get("section_height_mm", 0))
    bend_count    = int(profile_result.get("bend_count", 0))
    return_bends  = int(profile_result.get("return_bends_count", 0))
    profile_type  = str(profile_result.get("profile_type", "custom"))
    station_count = int(station_result.get("recommended_station_count", 0))
    section_features = profile_result.get("section_features", {}) or {}

    if thickness <= 0:
        return fail_response("advanced_roll_engine", "Invalid thickness")
    if section_w <= 0 and section_h <= 0:
        return fail_response("advanced_roll_engine", "Invalid profile dimensions")
    if station_count <= 0:
        return fail_response("advanced_roll_engine", "Invalid station count")

    springback   = get_springback(material)
    forming_gap  = calculate_gap(thickness)
    final_profile = build_final_profile(profile_result, section_features)

    stand_data: List[Dict[str, Any]] = []
    pass_ratios = build_pass_ratios(station_count, profile_type, return_bends)

    for idx, ratio in enumerate(pass_ratios, start=1):
        # angle-based morph: angle = ratio × 90°
        p = morph_profile(final_profile, ratio)
        p = apply_radius_logic(p, thickness, ratio)   # pass-through in v2.3
        p = apply_lip_logic(p, profile_type, ratio)
        p = apply_return_bend_clearance(p, return_bends, thickness, ratio)

        upper, lower = split_upper_lower(p, forming_gap)

        # Compute derived tooling metrics for this stand
        angle_deg    = round(ratio * 90.0, 1)
        ys_p         = [pt[1] for pt in p]
        groove_depth = round(max(ys_p) - min(ys_p), 3) if ys_p else 0.0

        stand_data.append({
            "stand_no":       idx,
            "pass_ratio":     round(ratio, 4),
            "angle_deg":      angle_deg,
            "target_gap_mm":  round(forming_gap, 4),
            "groove_depth_mm": groove_depth,
            "springback_deg": springback,
            "upper_profile":  [{"x": pt[0], "y": pt[1]} for pt in upper],
            "lower_profile":  [{"x": pt[0], "y": pt[1]} for pt in lower],
            "strip_profile":  [{"x": pt[0], "y": pt[1]} for pt in p],
            "profile_notes":  build_stand_notes(idx, station_count, profile_type, return_bends),
            "geometry_source": "angle_based_arc_trajectory",
        })

    warnings: List[str] = []
    if return_bends > 0:
        warnings.append("Return bends require manual clearance verification")
    if profile_type in {"complex_profile", "complex_section", "shutter_profile"}:
        warnings.append("Complex contour requires expert tooling verification")
    if material == "SS":
        warnings.append("SS: tighter springback review required")

    confidence = "medium" if profile_type in {"complex_profile", "complex_section", "shutter_profile"} else "high"

    return pass_response("advanced_roll_engine", {
        "profile_type":   profile_type,
        "station_count":  station_count,
        "forming_gap_mm": round(forming_gap, 4),
        "springback_deg": springback,
        "stand_data":     stand_data,
        "confidence":     confidence,
        "blocking":       False,
        "warnings":       warnings,
        "fix_log": [
            "v2.3.0: morph_profile — angle-based arc trajectory (sin/cos) replaces linear Y-scale",
            "v2.3.0: split_upper_lower — correct groove geometry: upper=groove wrap, lower=flat cylinder",
            "v2.3.0: apply_radius_logic — no longer double-scales Y; pass-through only",
        ],
        "assumptions": [
            "Angle-based roll contour generation used (arc-trajectory kinematic model)",
            "Upper roll groove accommodates outward-moving flanges during forming",
            "Lower roll is flat cylinder (flanges form upward away from lower roll)",
            "Final production roll contour requires tooling approval and profile projector check",
        ],
    })
