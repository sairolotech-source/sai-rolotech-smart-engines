"""
simulation_engine.py — Roll Forming Simulation Engine

Levels:
  1. Visual (kinematic deformation — flower diagram)
  2. Engineering (strain, springback, force)
  3. Defect detection (wrinkling, cracking, edge wave, bow, twist)
  4. Forming quality score

Note: Engineering approximation — NOT an FEM solver.
All outputs are estimated values for design guidance only.
"""
import math
from typing import List, Dict, Any, Optional

SPRINGBACK_FACTORS: Dict[str, float] = {
    "GI": 1.5,
    "MS": 2.5,
    "SS": 4.0,
    "HR": 2.5,
    "CR": 2.0,
    "AL": 3.5,
}

YIELD_STRENGTH_MPA: Dict[str, float] = {
    "GI": 250,
    "MS": 250,
    "SS": 310,
    "HR": 240,
    "CR": 280,
    "AL": 160,
}

ELASTIC_MODULUS_GPA: Dict[str, float] = {
    "GI": 200,
    "MS": 210,
    "SS": 193,
    "HR": 200,
    "CR": 205,
    "AL": 70,
}

STAGE_COLORS: Dict[str, str] = {
    "flat":                "#6b7280",
    "pre_bend":            "#3b82f6",
    "initial_bend":        "#6366f1",
    "progressive_forming": "#8b5cf6",
    "lip_forming":         "#a855f7",
    "calibration":         "#22c55e",
}


# ─────────────────────────────────────────────
# 1. KINEMATIC DEFORMATION
# ─────────────────────────────────────────────

def _compute_segment_data(profile_points: List[Dict]) -> tuple:
    """
    From a list of {x, y} points (formed DXF profile), compute:
    - segment lengths
    - bend angles (direction change in degrees, CCW positive) at each interior point
    """
    pts = [(float(p["x"]), float(p["y"])) for p in profile_points]
    segments = []
    for i in range(1, len(pts)):
        dx = pts[i][0] - pts[i - 1][0]
        dy = pts[i][1] - pts[i - 1][1]
        length = math.hypot(dx, dy)
        angle_deg = math.degrees(math.atan2(dy, dx))
        segments.append((length, angle_deg))

    bend_angles = []
    for i in range(1, len(segments)):
        diff = segments[i][1] - segments[i - 1][1]
        while diff > 180:
            diff -= 360
        while diff < -180:
            diff += 360
        bend_angles.append(round(diff, 4))

    return segments, bend_angles


def profile_at_ratio(profile_points: List[Dict], ratio: float) -> List[Dict]:
    """
    Kinematic chain: deform profile at ratio r (0=flat, 1=fully formed).
    Segment lengths are preserved; only bend angles change.
    Returns [{x, y}, ...] centered on x=0, y flipped for SVG.
    """
    segments, bend_angles = _compute_segment_data(profile_points)
    if not segments:
        return profile_points

    x, y = 0.0, 0.0
    theta = 0.0  # degrees, CCW from +X
    pts = [(x, y)]

    for i, (length, _) in enumerate(segments):
        if i > 0:
            theta += bend_angles[i - 1] * ratio
        dx = length * math.cos(math.radians(theta))
        dy = length * math.sin(math.radians(theta))
        x += dx
        y += dy
        pts.append((x, y))

    all_x = [p[0] for p in pts]
    all_y = [p[1] for p in pts]
    cx = (max(all_x) + min(all_x)) / 2
    max_y = max(all_y) if all_y else 0.0

    return [{"x": round(p[0] - cx, 3), "y": round(max_y - p[1], 3)} for p in pts]


# ─────────────────────────────────────────────
# 2. ENGINEERING CALCULATIONS
# ─────────────────────────────────────────────

def calculate_outer_fiber_strain(thickness_mm: float, bend_radius_mm: float) -> float:
    """Outer-fibre tensile strain at bend (engineering formula)."""
    if bend_radius_mm <= 0:
        return 0.0
    r_neutral = bend_radius_mm + thickness_mm / 2
    return round(thickness_mm / (2 * r_neutral), 5)


def calculate_forming_force_kn(
    thickness_mm: float,
    strip_width_mm: float,
    material: str,
    bend_radius_mm: float,
) -> float:
    """
    Estimated forming force (kN) per pass.
    F ≈ 0.8 * t² * w * Fy / r   (simplified bending force)
    """
    Fy = YIELD_STRENGTH_MPA.get(material, 250)
    if bend_radius_mm <= 0 or thickness_mm <= 0:
        return 0.0
    force_n = 0.8 * (thickness_mm ** 2) * strip_width_mm * Fy / bend_radius_mm
    return round(force_n / 1000, 3)


def calculate_springback_angle(
    material: str,
    target_angle_deg: float,
    thickness_mm: float,
    bend_radius_mm: float,
) -> float:
    """
    Springback angle (degrees) using simplified R/t ratio correction.
    δ ≈ factor * (R/t) * target_angle / 90
    """
    Fy = YIELD_STRENGTH_MPA.get(material, 250)
    E_mpa = ELASTIC_MODULUS_GPA.get(material, 200) * 1000
    if thickness_mm <= 0 or bend_radius_mm <= 0:
        factor = SPRINGBACK_FACTORS.get(material, 2.0)
        return round(factor * (target_angle_deg / 90), 2)
    R_over_t = bend_radius_mm / thickness_mm
    sb = (Fy / (3 * E_mpa)) * R_over_t * target_angle_deg
    base = SPRINGBACK_FACTORS.get(material, 2.0)
    return round(max(base * (target_angle_deg / 90), sb), 3)


def calculate_motor_power_kw(
    forming_force_kn: float,
    strip_speed_mpm: float = 15.0,
    efficiency: float = 0.75,
) -> float:
    """Estimate motor power. P = F * v / η (approximate)."""
    speed_mps = strip_speed_mpm / 60
    power_kw = (forming_force_kn * 1000 * speed_mps) / (efficiency * 1000)
    return round(power_kw, 2)


# ─────────────────────────────────────────────
# 3. DEFECT DETECTION
# ─────────────────────────────────────────────

def detect_defects(
    strain: float,
    ratio: float,
    thickness_mm: float,
    angle_deg: float,
    strip_width_mm: float,
    material: str,
) -> List[Dict]:
    """
    Detect forming defects.
    Thresholds calibrated for real roll-forming industry practice:
    - R/t = 1.0 is typical for GI/CR; strain at outer fibre ≈ 25-33% is normal
    - Edge wave threshold based on unsupported web width, not total strip width
    """
    issues = []
    Fy = YIELD_STRENGTH_MPA.get(material, 250)

    # Fracture strain thresholds (industry-calibrated for roll forming R/t ≥ 1)
    # GI, MS: elongation ~28%, effective fracture strain ~40%
    # SS: elongation ~40%, effective fracture strain ~35%
    # CR: elongation ~30%, effective fracture strain ~38%
    fracture_map = {"GI": 0.40, "MS": 0.38, "SS": 0.32, "HR": 0.38, "CR": 0.38, "AL": 0.30}
    fracture_strain = fracture_map.get(material, 0.38)

    if strain > fracture_strain:
        issues.append({
            "type": "cracking_risk",
            "severity": "HIGH",
            "icon": "💥",
            "message": f"Outer-fibre strain {strain:.1%} exceeds {fracture_strain:.0%} fracture limit — cracking risk",
        })
    elif strain > fracture_strain * 0.75:
        issues.append({
            "type": "cracking_risk",
            "severity": "MEDIUM",
            "icon": "⚠️",
            "message": f"Strain {strain:.1%} at {fracture_strain * 0.75:.0%}–{fracture_strain:.0%} range — monitor bend zone",
        })

    # Edge wave: use free-span estimate ≈ strip_width * 0.4 (unsupported between rolls)
    free_span = strip_width_mm * 0.4
    slenderness = free_span / thickness_mm if thickness_mm > 0 else 0
    if ratio > 0.70 and slenderness > 120:
        issues.append({
            "type": "edge_wave",
            "severity": "MEDIUM",
            "icon": "🌊",
            "message": f"Free-span slenderness {slenderness:.0f} — edge wave risk; check inter-roll strip tension",
        })

    # Wrinkling: thin material at late pass
    if ratio > 0.80 and thickness_mm < 0.6:
        issues.append({
            "type": "wrinkling",
            "severity": "HIGH",
            "icon": "〰️",
            "message": f"Thin strip ({thickness_mm}mm) at late forming — wrinkling risk; verify roll gap",
        })

    # Longitudinal bow
    if 0.30 < ratio < 0.70 and angle_deg > 35 and slenderness > 90:
        issues.append({
            "type": "bow",
            "severity": "LOW",
            "icon": "🏹",
            "message": "Longitudinal bow possible — verify roll bearing alignment and strip entry guide",
        })

    # Springback alert for high-strength materials at final pass
    if ratio > 0.92 and Fy > 300 and angle_deg > 85:
        issues.append({
            "type": "springback_excess",
            "severity": "MEDIUM",
            "icon": "↩️",
            "message": f"High-strength material (Fy={Fy}MPa) near final pass — verify springback over-bend",
        })

    return issues


# ─────────────────────────────────────────────
# 4. QUALITY SCORE
# ─────────────────────────────────────────────

def compute_quality_score(all_passes: List[Dict]) -> Dict:
    """
    Compute an overall forming quality score (0–100).
    Deduplicates defect types across stations so a recurring structural issue
    (like strain near limit) counts once, not once per station.
    """
    score = 100
    unique_high: set = set()
    unique_med:  set = set()
    total_high = 0
    total_med  = 0
    for p in all_passes:
        for d in p.get("defects", []):
            if d["severity"] == "HIGH":
                total_high += 1
                unique_high.add(d["type"])
            elif d["severity"] == "MEDIUM":
                total_med += 1
                unique_med.add(d["type"])

    score -= len(unique_high) * 15
    score -= len(unique_med)  * 5
    max_strain = max((p.get("strain", 0) for p in all_passes), default=0)
    if max_strain > 0.35:
        score -= 10
    score = max(0, min(100, score))
    label = (
        "EXCELLENT"  if score >= 90 else
        "GOOD"       if score >= 75 else
        "ACCEPTABLE" if score >= 55 else "POOR"
    )
    return {
        "score": score,
        "label": label,
        "high_defects": total_high,
        "med_defects":  total_med,
        "unique_high_types": list(unique_high),
        "unique_med_types":  list(unique_med),
    }


# ─────────────────────────────────────────────
# 5. MAIN SIMULATION RUNNER
# ─────────────────────────────────────────────

def run_simulation(
    profile_points: List[Dict],
    passes: List[Dict],
    thickness_mm: float,
    material: str,
    bend_radius_mm: float = 1.5,
    calibration_pass: Optional[Dict] = None,
    strip_speed_mpm: float = 15.0,
) -> Dict:
    """
    Run full pass-by-pass simulation.

    Args:
        profile_points: DXF profile [{x, y}, ...] in formed state
        passes:         roll_contour_engine passes list
        thickness_mm:   material thickness
        material:       material code (GI, MS, SS, HR, CR, AL)
        bend_radius_mm: inner bend radius
        calibration_pass: optional final calibration pass dict
        strip_speed_mpm: strip speed in m/min (for power estimate)

    Returns:
        dict with full simulation data per pass
    """
    sb_factor = SPRINGBACK_FACTORS.get(material, 2.0)
    sim_passes = []

    # Station 0 — flat strip
    flat_profile = profile_at_ratio(profile_points, 0.0)
    first_width = passes[0]["strip_width_mm"] if passes else 166.0
    sim_passes.append({
        "pass_no": 0,
        "station_label": "Flat Strip (Entry)",
        "stage_type": "flat",
        "stage_color": STAGE_COLORS["flat"],
        "pass_progress_pct": 0.0,
        "target_angle_deg": 0.0,
        "springback_deg": 0.0,
        "corrected_angle_deg": 0.0,
        "strain": 0.0,
        "forming_force_kn": 0.0,
        "motor_power_kw": 0.0,
        "strip_width_mm": first_width,
        "roll_gap_mm": thickness_mm + 0.1,
        "forming_depth_mm": 0.0,
        "defects": [],
        "profile_points": flat_profile,
        "upper_roll_profile": None,
        "lower_roll_profile": None,
    })

    # Forming passes
    for p in passes:
        ratio = p["pass_progress_pct"] / 100.0
        angle = p["target_angle_deg"]
        strip_w = p.get("strip_width_mm", 166.0)
        roll_gap = p.get("roll_gap_mm", thickness_mm + 0.1)
        forming_depth = p.get("forming_depth_mm", 0.0)
        stage = p.get("stage_type", "progressive_forming")

        deformed = profile_at_ratio(profile_points, ratio)
        strain = calculate_outer_fiber_strain(thickness_mm, bend_radius_mm)
        force = calculate_forming_force_kn(thickness_mm, strip_w, material, bend_radius_mm)
        springback = calculate_springback_angle(material, angle, thickness_mm, bend_radius_mm)
        power = calculate_motor_power_kw(force, strip_speed_mpm)
        defects = detect_defects(strain, ratio, thickness_mm, angle, strip_w, material)

        sim_passes.append({
            "pass_no": p["pass_no"],
            "station_label": p["station_label"],
            "stage_type": stage,
            "stage_color": STAGE_COLORS.get(stage, "#8b5cf6"),
            "pass_progress_pct": p["pass_progress_pct"],
            "target_angle_deg": round(angle, 2),
            "springback_deg": round(springback, 2),
            "corrected_angle_deg": round(angle - springback, 2),
            "strain": strain,
            "forming_force_kn": force,
            "motor_power_kw": power,
            "strip_width_mm": strip_w,
            "roll_gap_mm": roll_gap,
            "forming_depth_mm": forming_depth,
            "defects": defects,
            "profile_points": deformed,
            "upper_roll_profile": p.get("upper_roll_profile"),
            "lower_roll_profile": p.get("lower_roll_profile"),
        })

    # Calibration pass
    if calibration_pass:
        last_w = passes[-1]["strip_width_mm"] if passes else 156.0
        calib_force = calculate_forming_force_kn(thickness_mm, last_w, material, bend_radius_mm) * 0.4
        sim_passes.append({
            "pass_no": calibration_pass.get("pass_no", len(passes) + 1),
            "station_label": calibration_pass.get("station_label", "Calibration"),
            "stage_type": "calibration",
            "stage_color": STAGE_COLORS["calibration"],
            "pass_progress_pct": 100.0,
            "target_angle_deg": 90.0,
            "springback_deg": 0.0,
            "corrected_angle_deg": 90.0,
            "strain": calculate_outer_fiber_strain(thickness_mm, bend_radius_mm),
            "forming_force_kn": round(calib_force, 3),
            "motor_power_kw": calculate_motor_power_kw(calib_force, strip_speed_mpm),
            "strip_width_mm": last_w,
            "roll_gap_mm": thickness_mm,
            "forming_depth_mm": calibration_pass.get("forming_depth_mm", 0.0),
            "defects": [],
            "profile_points": profile_at_ratio(profile_points, 1.0),
            "upper_roll_profile": calibration_pass.get("upper_roll_profile"),
            "lower_roll_profile": calibration_pass.get("lower_roll_profile"),
        })

    quality = compute_quality_score(sim_passes)

    return {
        "status": "pass",
        "engine": "simulation_engine",
        "note": "Engineering approximation — not FEM. Use for design guidance only.",
        "material": material,
        "thickness_mm": thickness_mm,
        "bend_radius_mm": bend_radius_mm,
        "springback_factor": sb_factor,
        "strip_speed_mpm": strip_speed_mpm,
        "total_passes": len(sim_passes),
        "quality": quality,
        "simulation_passes": sim_passes,
    }
