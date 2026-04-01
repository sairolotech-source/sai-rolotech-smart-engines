"""
advanced_process_simulation.py
SAI Rolotech Smart Engines v2.2.0

Advanced Process Simulation Precheck — Incremental Mechanics Model

Label: "ADVANCED PROCESS SIMULATION PRECHECK"
NOT finite element analysis. No nodal mesh, no matrix assembly, no convergence loop.
NOT to be called FEA, FEM, or validated simulation.

What this module IS:
  - Incremental 2D plane-strain cross-section mechanics
  - Ramberg–Osgood / Swift power-law isotropic hardening model per material
  - Pass-by-pass cumulative plastic strain state propagation
  - Residual stress tracking via moment-curvature elastic unloading
  - Strip width progression via geometric projection
  - Hertzian contact pressure estimation (cylinder-on-flat)
  - Defect probability scores (0–1, physics-based margins)
  - Forming energy and power per pass

Model assumptions (explicitly stated):
  1. 2D plane-strain cross-section — longitudinal elongation not modelled
  2. Neutral axis = mid-plane (K-factor not applied here — different from bend allowance)
  3. Isotropic hardening only (no kinematic hardening / Bauschinger effect)
  4. Each bend treated independently — no cross-bend coupling
  5. Roll contact simplified to line contact (Hertz cylinder-on-flat)
  6. No friction / roll-strip slip ratio
  7. Springback from elastic moment recovery only (no residual bend coupling)
  8. Strip width: geometric projection (no FEM lateral flow)

vs True FEA:
  - FEA: full mesh (thousands of nodes), plastic strain tensor at every point,
    contact elements with friction, iterative Newton-Raphson solver, 3D deformation
  - This module: analytical per-bend, closed-form plasticity, 10-100x faster,
    suitable for real-time design guidance, NOT for final structural certification

Authors: SAI Rolotech Engineering
"""

import math
from typing import Dict, List, Any, Optional


# ═══════════════════════════════════════════════════════════
# MATERIAL DATABASE — Swift / Ramberg–Osgood Parameters
# ═══════════════════════════════════════════════════════════
# Swift hardening law: σ = K × (ε₀ + εp)ⁿ
# where ε₀ = prestrain at yield = (Fy/K)^(1/n)
# Sources: Metals Handbook ASM, EN 10130/10327/10029, literature fits

MATERIAL_MODELS: Dict[str, Dict[str, float]] = {
    "GI": {
        "E_gpa": 200.0,
        "Fy_mpa": 250.0,
        "K_mpa": 500.0,  # Swift hardening coefficient
        "n": 0.22,        # strain hardening exponent
        "UTS_mpa": 320.0,
        "fracture_strain": 0.28,  # effective fracture strain (outer fibre, roll forming)
        "density_kg_m3": 7850.0,
        "poisson": 0.30,
        "source": "EN 10327 DX51D, Swift fit from tensile test data",
    },
    "MS": {
        "E_gpa": 210.0,
        "Fy_mpa": 275.0,
        "K_mpa": 720.0,
        "n": 0.20,
        "UTS_mpa": 430.0,
        "fracture_strain": 0.22,
        "density_kg_m3": 7850.0,
        "poisson": 0.30,
        "source": "S275JR EN 10025, Swift fit",
    },
    "SS": {
        "E_gpa": 193.0,
        "Fy_mpa": 310.0,
        "K_mpa": 1270.0,
        "n": 0.34,
        "UTS_mpa": 620.0,
        "fracture_strain": 0.40,
        "density_kg_m3": 7930.0,
        "poisson": 0.28,
        "source": "AISI 304 EN 10088, Swift fit from literature",
    },
    "CR": {
        "E_gpa": 205.0,
        "Fy_mpa": 280.0,
        "K_mpa": 540.0,
        "n": 0.23,
        "UTS_mpa": 380.0,
        "fracture_strain": 0.30,
        "density_kg_m3": 7850.0,
        "poisson": 0.30,
        "source": "DC04 EN 10130, Swift fit",
    },
    "HR": {
        "E_gpa": 200.0,
        "Fy_mpa": 240.0,
        "K_mpa": 700.0,
        "n": 0.18,
        "UTS_mpa": 400.0,
        "fracture_strain": 0.25,
        "density_kg_m3": 7850.0,
        "poisson": 0.30,
        "source": "S235JR HR EN 10025, Swift fit",
    },
    "AL": {
        "E_gpa": 70.0,
        "Fy_mpa": 160.0,
        "K_mpa": 430.0,
        "n": 0.19,
        "UTS_mpa": 260.0,
        "fracture_strain": 0.20,
        "density_kg_m3": 2700.0,
        "poisson": 0.33,
        "source": "AA5052-H32 ASTM B209, Swift fit",
    },
    "HSLA": {
        "E_gpa": 210.0,
        "Fy_mpa": 420.0,
        "K_mpa": 900.0,
        "n": 0.16,
        "UTS_mpa": 530.0,
        "fracture_strain": 0.19,
        "density_kg_m3": 7850.0,
        "poisson": 0.30,
        "source": "S420MC EN 10149-2, Swift fit",
    },
    "CU": {
        "E_gpa": 110.0,
        "Fy_mpa": 200.0,
        "K_mpa": 450.0,
        "n": 0.25,
        "UTS_mpa": 300.0,
        "fracture_strain": 0.35,
        "density_kg_m3": 8940.0,
        "poisson": 0.34,
        "source": "C11000 ASTM B187, Swift fit",
    },
    "TI": {
        "E_gpa": 105.0,
        "Fy_mpa": 275.0,
        "K_mpa": 850.0,
        "n": 0.20,
        "UTS_mpa": 380.0,
        "fracture_strain": 0.22,
        "density_kg_m3": 4510.0,
        "poisson": 0.36,
        "source": "Grade 2 ASTM B265, Swift fit",
    },
    "PP": {
        "E_gpa": 1.6,
        "Fy_mpa": 30.0,
        "K_mpa": 50.0,
        "n": 0.12,
        "UTS_mpa": 35.0,
        "fracture_strain": 0.50,
        "density_kg_m3": 905.0,
        "poisson": 0.42,
        "source": "PP-H, ISO 178 approximate",
    },
}

_FALLBACK_MATERIAL = MATERIAL_MODELS["GI"]


def _get_material(code: str) -> Dict[str, float]:
    return MATERIAL_MODELS.get(code.upper(), _FALLBACK_MATERIAL)


# ═══════════════════════════════════════════════════════════
# PHYSICS FUNCTIONS
# ═══════════════════════════════════════════════════════════

def swift_flow_stress(mat: Dict, eps_plastic: float) -> float:
    """
    Swift isotropic hardening: σ_flow = K × (ε₀ + εp)ⁿ
    ε₀ = (Fy/K)^(1/n)  — prestrain at yield onset
    Returns flow stress in MPa.
    """
    K = mat["K_mpa"]
    n = mat["n"]
    Fy = mat["Fy_mpa"]
    eps_0 = (Fy / K) ** (1.0 / n)
    sigma = K * (eps_0 + max(0.0, eps_plastic)) ** n
    return round(sigma, 4)


def elastic_plastic_curvature(
    target_angle_deg: float,
    bend_radius_mm: float,
    thickness_mm: float,
) -> float:
    """
    Target curvature κ = 1 / R_neutral (mm⁻¹)
    R_neutral = bend_radius + t/2 (neutral axis at mid-plane)
    Returns 0 if bend_radius_mm <= 0 (no bending).
    """
    if bend_radius_mm <= 0.0:
        return 0.0
    r_neutral = bend_radius_mm + thickness_mm / 2.0
    return 1.0 / r_neutral if r_neutral > 0 else 0.0


def bending_moment_per_unit_width(
    mat: Dict,
    curvature: float,
    thickness_mm: float,
    cumulative_eps_plastic: float,
) -> float:
    """
    Bending moment per unit width M (N·mm/mm) using bilinear elastic-plastic:
      - Elastic zone depth: y_e = ε_y / κ  where ε_y = Fy/E
      - If y_e >= t/2 → fully elastic: M = E×I×κ  (I = t³/12)
      - If y_e < t/2 → elastic core + plastic wing:
          M = (2×σ_y × y_e²/2) + (2×σ_flow × (t/2 - y_e) × (y_e + (t/2-y_e)/2))
        simplified to rectangular plastic zone approximation:
          M ≈ σ_y × t²/6 + σ_flow × (t/2-y_e) × t (per unit width)

    This is an engineering approximation — not true curved-beam FEA.
    """
    E_mpa = mat["E_gpa"] * 1000.0
    Fy = mat["Fy_mpa"]
    sigma_flow = swift_flow_stress(mat, cumulative_eps_plastic)
    t = thickness_mm

    if curvature <= 0.0:
        return 0.0

    # Elastic zone depth
    eps_y = Fy / E_mpa
    y_e = eps_y / curvature  # depth at which strain = Fy/E

    I = (t ** 3) / 12.0  # per unit width
    M_elastic = E_mpa * I * curvature

    if y_e >= t / 2.0:
        # Fully elastic
        return round(M_elastic, 4)

    # Elastic core moment
    M_core = Fy * y_e**2 / (t / 2.0)  # elastic core contribution (per unit width, symmetric)
    # Plastic wing moment (symmetric, both sides)
    y_plastic = t / 2.0 - y_e
    M_plastic = sigma_flow * y_plastic * (y_e + y_plastic / 2.0) * 2.0
    M_total = M_core + M_plastic

    # For plastic bending, M_total is the actual moment (< E×I×κ which is hypothetical elastic)
    return round(M_total, 4)


def elastic_springback_curvature(M: float, E_gpa: float, thickness_mm: float) -> float:
    """
    Elastic springback curvature recovery:
      Δκ = M / (E × I)  where I = t³/12 per unit width
    Returns springback curvature (mm⁻¹).
    """
    E_mpa = E_gpa * 1000.0
    I = (thickness_mm ** 3) / 12.0
    if E_mpa * I == 0:
        return 0.0
    return round(M / (E_mpa * I), 8)


def residual_curvature(kappa_applied: float, kappa_springback: float) -> float:
    """κ_residual = κ_applied - Δκ_spring (≥ 0)"""
    return round(max(0.0, kappa_applied - kappa_springback), 8)


def outer_fibre_plastic_strain(curvature: float, thickness_mm: float) -> float:
    """
    Outer fibre total strain at applied curvature:
    ε_outer = κ × (t/2)
    Plastic strain ≈ ε_outer - Fy/E (subtracting elastic yield strain)
    """
    return round(curvature * thickness_mm / 2.0, 6)


def hertz_contact_pressure_mpa(
    forming_force_n: float,
    roll_od_mm: float,
    face_width_mm: float,
    mat_E_gpa: float,
    roll_E_gpa: float = 210.0,
    mat_poisson: float = 0.30,
    roll_poisson: float = 0.30,
) -> Dict[str, float]:
    """
    Hertzian contact: cylinder (roll) on flat (strip surface).
    Combined modulus: 1/E* = (1-ν₁²)/E₁ + (1-ν₂²)/E₂
    Contact half-width: b = sqrt(4×F×R/(π×E*×L))
    Peak pressure: p₀ = 2F/(π×b×L)

    Returns: half_contact_width_mm, peak_contact_pressure_mpa
    """
    E1 = mat_E_gpa * 1000.0    # strip (MPa)
    E2 = roll_E_gpa * 1000.0   # roll, assume EN31/D2 = 210 GPa
    nu1 = mat_poisson
    nu2 = roll_poisson
    R = roll_od_mm / 2.0       # roll radius mm
    L = face_width_mm          # contact length mm

    # Combined modulus
    E_star = 1.0 / ((1 - nu1**2) / E1 + (1 - nu2**2) / E2)

    if E_star <= 0 or R <= 0 or L <= 0 or forming_force_n <= 0:
        return {"half_contact_width_mm": 0.0, "peak_contact_pressure_mpa": 0.0}

    b = math.sqrt(4.0 * forming_force_n * R / (math.pi * E_star * L))
    p0 = 2.0 * forming_force_n / (math.pi * b * L)

    return {
        "half_contact_width_mm": round(b, 4),
        "peak_contact_pressure_mpa": round(p0, 2),
    }


def strip_width_progression(
    flat_width_mm: float,
    segment_lengths_mm: List[float],
    bend_angles_deg: List[float],
) -> float:
    """
    Geometric projected width of the formed cross-section.
    Walks the centerline and sums horizontal (X) projections.
    The arc length (flat strip width) is conserved; projected width varies.
    """
    if not segment_lengths_mm:
        return flat_width_mm

    heading = 0.0
    x_total = 0.0
    for i, length in enumerate(segment_lengths_mm):
        dx = abs(length * math.cos(math.radians(heading)))
        x_total += dx
        if i < len(bend_angles_deg):
            heading += bend_angles_deg[i]

    return round(max(flat_width_mm * 0.85, x_total), 2)  # clamp at 85% min (real roll forming)


def defect_probability(
    cumulative_plastic_strain: float,
    fracture_strain: float,
    residual_stress_mpa: float,
    Fy_mpa: float,
    sigma_compress_mpa: float,
    sigma_buckle_mpa: float,
    angle_deg: float,
    strip_width_mm: float,
    thickness_mm: float,
) -> Dict[str, float]:
    """
    Graduated defect probability scores (0.0 = safe, 1.0 = certain defect).
    Physics-based margins, NOT binary threshold rules.

    P_cracking    — outer fibre strain approaching fracture strain
    P_wrinkling   — compressive stress approaching buckling critical
    P_springback  — residual stress / yield ratio
    P_edge_wave   — web slenderness in lateral compression
    P_bow_camber  — asymmetric springback risk
    """

    # Cracking: onset above 60% of fracture strain, quadratic to 1.0 at fracture
    # Calibrated from roll forming industry practice:
    #   <60% εf → P=0 (safe), 80% εf → P≈0.25 (medium), 95% εf → P≈0.76 (high)
    # max(0, ratio-0.60) ensures onset threshold — do NOT square the clamped value directly
    strain_ratio = cumulative_plastic_strain / fracture_strain if fracture_strain > 0 else 0.0
    onset = max(0.0, strain_ratio - 0.60) / 0.40  # 0 below 60%, rises to 1.0 at fracture
    P_crack = round(min(1.0, onset ** 2), 4)

    # Wrinkling: compressive stress vs buckling critical
    buckle_ratio = sigma_compress_mpa / sigma_buckle_mpa if sigma_buckle_mpa > 0 else 0.0
    P_wrinkle = round(max(0.0, (buckle_ratio - 0.7) / 0.3) ** 2, 4)
    P_wrinkle = min(1.0, P_wrinkle)

    # Springback severity
    P_springback = round(min(1.0, residual_stress_mpa / Fy_mpa), 4)

    # Edge wave: web slenderness ratio
    slenderness = strip_width_mm / thickness_mm if thickness_mm > 0 else 0.0
    edge_wave_onset = 120.0  # typical onset slenderness
    P_edge_wave = round(min(1.0, max(0.0, (slenderness - edge_wave_onset) / 60.0)), 4)

    # Bow/camber: severe at high angles + moderate slenderness
    if angle_deg > 45 and 80 < slenderness < 150:
        P_bow = round(min(1.0, (angle_deg - 45) / 45 * 0.6), 4)
    else:
        P_bow = 0.0

    return {
        "P_cracking": P_crack,
        "P_wrinkling": P_wrinkle,
        "P_springback": P_springback,
        "P_edge_wave": P_edge_wave,
        "P_bow_camber": P_bow,
        "dominant_risk": _dominant_risk(P_crack, P_wrinkle, P_springback, P_edge_wave, P_bow),
    }


def _dominant_risk(Pc: float, Pw: float, Ps: float, Pe: float, Pb: float) -> str:
    risks = {"cracking": Pc, "wrinkling": Pw, "springback": Ps, "edge_wave": Pe, "bow_camber": Pb}
    return max(risks, key=risks.get)


def buckling_critical_stress(E_gpa: float, thickness_mm: float, width_mm: float) -> float:
    """
    σ_critical (Euler plate buckling, simply supported edges):
    σ_cr = π² × E × (t/b)² / 12 / (1 - ν²)  per unit width
    Simplified: σ_cr = π² × E × (t/b)² / 10.92
    """
    E_mpa = E_gpa * 1000.0
    if width_mm <= 0 or thickness_mm <= 0:
        return 9999.0
    return round(math.pi ** 2 * E_mpa * (thickness_mm / width_mm) ** 2 / 10.92, 2)


# ═══════════════════════════════════════════════════════════
# PASS-BY-PASS STATE PROPAGATION
# ═══════════════════════════════════════════════════════════

class BendState:
    """Accumulated mechanical state for a single bend, after a single pass."""
    def __init__(self):
        self.cumulative_plastic_strain: float = 0.0
        self.curvature_applied: float = 0.0
        self.curvature_residual: float = 0.0
        self.residual_stress_mpa: float = 0.0
        self.flow_stress_mpa: float = 0.0
        self.bending_moment_nmm_mm: float = 0.0
        self.springback_curvature: float = 0.0
        self.angle_achieved_deg: float = 0.0
        self.defect_probs: Dict[str, float] = {}


def propagate_pass_state(
    prev_bend_states: List[BendState],
    target_angles_deg: List[float],
    segment_lengths_mm: List[float],
    bend_radius_mm: float,
    thickness_mm: float,
    mat: Dict,
    roll_od_mm: float,
    face_width_mm: float,
    strip_width_mm: float,
) -> List[BendState]:
    """
    Propagate mechanics state for one pass across all bends.
    Each bend inherits previous cumulative plastic strain from prev_bend_states.
    Returns updated BendState list.
    """
    E_gpa = mat["E_gpa"]
    Fy = mat["Fy_mpa"]
    fracture_strain = mat["fracture_strain"]

    new_states: List[BendState] = []

    for i, target_angle in enumerate(target_angles_deg):
        prev = prev_bend_states[i] if i < len(prev_bend_states) else BendState()
        bs = BendState()

        # Curvature from target angle
        angle_rad = math.radians(abs(target_angle))
        R_applied = bend_radius_mm
        kappa = elastic_plastic_curvature(target_angle, R_applied, thickness_mm)

        # Incremental curvature from previous pass residual (not cumulative addition)
        # In roll forming, each station bends from the residual state of the prior station
        kappa_prev = prev.curvature_applied  # curvature at which prev pass was applied
        delta_kappa = max(0.0, kappa - kappa_prev)  # additional bending this pass

        # Incremental plastic strain = incremental curvature × t/2 − elastic yield strain
        eps_y = Fy / (E_gpa * 1000.0)
        delta_plastic = max(0.0, delta_kappa * thickness_mm / 2.0 - eps_y)
        bs.cumulative_plastic_strain = round(prev.cumulative_plastic_strain + delta_plastic, 6)
        bs.curvature_applied = round(kappa, 8)

        # Flow stress under accumulated strain (hardening from total history)
        bs.flow_stress_mpa = swift_flow_stress(mat, bs.cumulative_plastic_strain)

        # Bending moment (plastic if y_e << t/2)
        M = bending_moment_per_unit_width(mat, kappa, thickness_mm, bs.cumulative_plastic_strain)
        bs.bending_moment_nmm_mm = M

        # Elastic springback curvature: Δκ_spring = M / (E×I)
        delta_kappa_spring = elastic_springback_curvature(M, E_gpa, thickness_mm)
        bs.springback_curvature = round(delta_kappa_spring, 8)
        bs.curvature_residual = residual_curvature(kappa, delta_kappa_spring)

        # Residual outer-fibre stress: σ_res = σ_flow − M × c / I  (elastic-plastic bending result)
        I_per_width = (thickness_mm ** 3) / 12.0
        c = thickness_mm / 2.0
        sigma_unload = M * c / I_per_width  # elastic stress removed during springback
        bs.residual_stress_mpa = round(max(0.0, abs(bs.flow_stress_mpa - sigma_unload)), 2)

        # Angle actually achieved (accounting for springback)
        # springback angle = springback_curvature × arc_length_of_bend
        arc_len = angle_rad * (R_applied + thickness_mm / 2.0)
        springback_angle_deg = math.degrees(delta_kappa_spring * arc_len)
        bs.angle_achieved_deg = round(max(0.0, target_angle - springback_angle_deg), 3)

        # Hertz contact pressure (forming force per bend)
        forming_force_n = 0.8 * (thickness_mm ** 2) * face_width_mm * Fy / R_applied
        hz = hertz_contact_pressure_mpa(
            forming_force_n, roll_od_mm, face_width_mm, mat["E_gpa"], 210.0,
            mat.get("poisson", 0.30), 0.30
        )

        # Compressive stress in web/flange during forming
        sigma_compress = bs.flow_stress_mpa * 0.3  # approximate in-plane compression
        sigma_cr = buckling_critical_stress(E_gpa, thickness_mm, strip_width_mm)

        # Defect probabilities
        bs.defect_probs = defect_probability(
            cumulative_plastic_strain=bs.cumulative_plastic_strain,
            fracture_strain=fracture_strain,
            residual_stress_mpa=bs.residual_stress_mpa,
            Fy_mpa=Fy,
            sigma_compress_mpa=sigma_compress,
            sigma_buckle_mpa=sigma_cr,
            angle_deg=abs(target_angle),
            strip_width_mm=strip_width_mm,
            thickness_mm=thickness_mm,
        )
        bs.defect_probs["half_contact_width_mm"] = hz["half_contact_width_mm"]
        bs.defect_probs["contact_pressure_mpa"] = hz["peak_contact_pressure_mpa"]

        new_states.append(bs)

    return new_states


# ═══════════════════════════════════════════════════════════
# MAIN SIMULATION RUNNER
# ═══════════════════════════════════════════════════════════

def run_advanced_process_simulation(
    flower_result: Dict[str, Any],
    input_result: Dict[str, Any],
    profile_result: Optional[Dict[str, Any]] = None,
    roll_od_mm: float = 180.0,
    face_width_mm: float = 100.0,
    station_pitch_mm: float = 300.0,
    strip_speed_mpm: float = 12.0,
) -> Dict[str, Any]:
    """
    Run the full pass-by-pass advanced process simulation.

    Inputs:
      flower_result: from generate_advanced_flower()
      input_result:  {'sheet_thickness_mm': float, 'material': str, ...}
      roll_od_mm:    forming roll outer diameter (mm), default 180mm
      face_width_mm: roll face width (mm), default 100mm

    Returns:
      Full pass-by-pass simulation state with physics metrics.
    """
    thickness_mm = float(input_result.get("sheet_thickness_mm", 2.0))
    material_code = str(input_result.get("material", "GI")).upper()
    mat = _get_material(material_code)
    E_gpa = mat["E_gpa"]
    Fy = mat["Fy_mpa"]
    fracture_strain = mat["fracture_strain"]

    pass_plan = flower_result.get("pass_plan", [])
    if not pass_plan:
        return {
            "status": "fail",
            "engine": "advanced_process_simulation",
            "reason": "No pass_plan in flower_result",
        }

    segment_lengths_mm = flower_result.get("segment_lengths_mm", [50.0, 80.0, 50.0])
    n_bends = len(pass_plan[0].get("bend_angles_deg", [1.0]))
    flat_width_mm = float(input_result.get("flat_blank_mm", sum(segment_lengths_mm)))

    # Initial state: all bends at zero strain
    bend_states: List[BendState] = [BendState() for _ in range(n_bends)]

    sim_passes = []
    cumulative_energy_j_m = 0.0

    for pass_idx, flower_pass in enumerate(pass_plan):
        target_angles = flower_pass.get("bend_angles_deg", [0.0] * n_bends)
        pass_no = flower_pass.get("pass_no", pass_idx + 1)
        station_label = flower_pass.get("station_label", f"Pass {pass_no}")

        # Current strip width (geometric projection at this stage)
        strip_w = strip_width_progression(flat_width_mm, segment_lengths_mm, target_angles)

        # Effective bend radius: using R = t × (E/Fy) × correction for this pass
        # Typical in roll forming: R ≈ 1–3 × t. We use 1.5×t as baseline and scale by angle.
        max_angle = max(abs(a) for a in target_angles) if target_angles else 1.0
        R_eff = max(thickness_mm * 1.5, thickness_mm * (3.0 - max_angle / 45.0))

        # Propagate bend states for this pass
        new_bend_states = propagate_pass_state(
            prev_bend_states=bend_states,
            target_angles_deg=target_angles,
            segment_lengths_mm=segment_lengths_mm,
            bend_radius_mm=R_eff,
            thickness_mm=thickness_mm,
            mat=mat,
            roll_od_mm=roll_od_mm,
            face_width_mm=face_width_mm,
            strip_width_mm=strip_w,
        )

        # Aggregate pass metrics
        max_eps_plastic = max(bs.cumulative_plastic_strain for bs in new_bend_states)
        max_residual_stress = max(bs.residual_stress_mpa for bs in new_bend_states)
        avg_flow_stress = sum(bs.flow_stress_mpa for bs in new_bend_states) / len(new_bend_states)
        total_M = sum(bs.bending_moment_nmm_mm for bs in new_bend_states)
        total_springback_deg = sum(
            math.degrees(bs.springback_curvature * (
                math.radians(abs(target_angles[i])) * (R_eff + thickness_mm / 2.0)
            ))
            for i, bs in enumerate(new_bend_states)
        )

        # Forming force (N): sum across bends
        forming_force_n = sum(
            0.8 * thickness_mm**2 * face_width_mm * Fy / R_eff
            for _ in new_bend_states
        )

        # Power (kW): P = F × v / η
        speed_mps = strip_speed_mpm / 60.0
        power_kw = (forming_force_n * speed_mps) / (0.75 * 1000.0)

        # Energy per metre (J/m)
        energy_j_m = forming_force_n * 1.0  # F × 1m travel
        cumulative_energy_j_m += energy_j_m

        # Defect probability across all bends (max)
        max_P_crack = max(bs.defect_probs.get("P_cracking", 0.0) for bs in new_bend_states)
        max_P_wrinkle = max(bs.defect_probs.get("P_wrinkling", 0.0) for bs in new_bend_states)
        max_P_spring = max(bs.defect_probs.get("P_springback", 0.0) for bs in new_bend_states)
        max_P_edge = max(bs.defect_probs.get("P_edge_wave", 0.0) for bs in new_bend_states)
        max_P_bow = max(bs.defect_probs.get("P_bow_camber", 0.0) for bs in new_bend_states)

        # Risk tier
        max_defect_prob = max(max_P_crack, max_P_wrinkle, max_P_spring)
        if max_defect_prob >= 0.70:
            risk_tier = "HIGH"
        elif max_defect_prob >= 0.40:
            risk_tier = "MEDIUM"
        elif max_defect_prob >= 0.15:
            risk_tier = "LOW"
        else:
            risk_tier = "SAFE"

        # Hertz contact (from first bend as representative)
        hz0 = new_bend_states[0].defect_probs
        contact_pressure = hz0.get("contact_pressure_mpa", 0.0)
        half_contact_w = hz0.get("half_contact_width_mm", 0.0)

        # Per-bend detail
        bend_details = []
        for i, bs in enumerate(new_bend_states):
            bend_details.append({
                "bend_no": i + 1,
                "target_angle_deg": round(target_angles[i], 3),
                "angle_achieved_deg": bs.angle_achieved_deg,
                "cumulative_plastic_strain": bs.cumulative_plastic_strain,
                "flow_stress_mpa": bs.flow_stress_mpa,
                "bending_moment_nmm_mm": bs.bending_moment_nmm_mm,
                "residual_curvature_mm_inv": bs.curvature_residual,
                "residual_stress_mpa": bs.residual_stress_mpa,
                "springback_curvature_mm_inv": bs.springback_curvature,
                "defect_probabilities": {
                    "P_cracking": bs.defect_probs.get("P_cracking", 0.0),
                    "P_wrinkling": bs.defect_probs.get("P_wrinkling", 0.0),
                    "P_springback": bs.defect_probs.get("P_springback", 0.0),
                    "P_edge_wave": bs.defect_probs.get("P_edge_wave", 0.0),
                    "P_bow_camber": bs.defect_probs.get("P_bow_camber", 0.0),
                    "dominant_risk": bs.defect_probs.get("dominant_risk", "springback"),
                },
            })

        sim_passes.append({
            "pass_no": pass_no,
            "station_label": station_label,
            "stage_type": flower_pass.get("stage_type", "forming"),
            "target_angles_deg": [round(a, 3) for a in target_angles],
            "effective_bend_radius_mm": round(R_eff, 3),
            "strip_width_mm": strip_w,
            "roll_gap_mm": round(thickness_mm + 0.05, 3),
            "forming_force_n": round(forming_force_n, 2),
            "motor_power_kw": round(power_kw, 4),
            "forming_energy_j_per_m": round(energy_j_m, 2),
            "cumulative_energy_j_per_m": round(cumulative_energy_j_m, 2),
            "max_cumulative_plastic_strain": round(max_eps_plastic, 6),
            "max_residual_stress_mpa": round(max_residual_stress, 2),
            "avg_flow_stress_mpa": round(avg_flow_stress, 2),
            "total_springback_deg": round(total_springback_deg, 3),
            "hertz_contact_pressure_mpa": contact_pressure,
            "hertz_half_contact_width_mm": half_contact_w,
            "defect_probabilities": {
                "P_cracking": round(max_P_crack, 4),
                "P_wrinkling": round(max_P_wrinkle, 4),
                "P_springback": round(max_P_spring, 4),
                "P_edge_wave": round(max_P_edge, 4),
                "P_bow_camber": round(max_P_bow, 4),
            },
            "risk_tier": risk_tier,
            "bend_details": bend_details,
        })

        bend_states = new_bend_states

    # Final state summary
    final_eps = [bs.cumulative_plastic_strain for bs in bend_states]
    final_residual = [bs.residual_stress_mpa for bs in bend_states]
    final_flow = [bs.flow_stress_mpa for bs in bend_states]

    # Formability index: safety margin from fracture (negative = exceeded fracture limit)
    formability_index = round(
        (fracture_strain - max(final_eps)) / fracture_strain * 100, 1
    ) if fracture_strain > 0 else 100.0
    # Clamp to [-100, 100] for display; negative means fracture strain exceeded
    formability_index = max(-100.0, min(100.0, formability_index))

    # Overall process verdict
    critical_passes = [p for p in sim_passes if p["risk_tier"] in ("HIGH",)]
    warning_passes = [p for p in sim_passes if p["risk_tier"] == "MEDIUM"]

    if critical_passes:
        verdict = "CRITICAL"
        verdict_detail = f"{len(critical_passes)} HIGH-risk pass(es) — forming may fail"
    elif len(warning_passes) > 2:
        verdict = "WARNING"
        verdict_detail = f"{len(warning_passes)} MEDIUM-risk pass(es) — review parameters"
    elif formability_index < 20.0:
        verdict = "WARNING"
        verdict_detail = f"Low formability safety margin: {formability_index:.1f}%"
    else:
        verdict = "PASS"
        verdict_detail = f"Formability safety margin {formability_index:.1f}% — process feasible"

    return {
        "status": "pass",
        "engine": "advanced_process_simulation",
        "label": "ADVANCED PROCESS SIMULATION PRECHECK — NOT FEA",
        "model": "Incremental 2D plane-strain, Swift isotropic hardening, Hertzian contact",
        "material": material_code,
        "material_model": {
            "E_gpa": mat["E_gpa"],
            "Fy_mpa": mat["Fy_mpa"],
            "K_mpa": mat["K_mpa"],
            "n": mat["n"],
            "fracture_strain": fracture_strain,
            "source": mat.get("source", ""),
        },
        "thickness_mm": thickness_mm,
        "roll_od_mm": roll_od_mm,
        "face_width_mm": face_width_mm,
        "station_pitch_mm": station_pitch_mm,
        "strip_speed_mpm": strip_speed_mpm,
        "total_passes": len(sim_passes),
        "process_verdict": verdict,
        "verdict_detail": verdict_detail,
        "formability_index_pct": formability_index,
        "total_forming_energy_j_per_m": round(cumulative_energy_j_m, 2),
        "final_state": {
            "cumulative_plastic_strain_per_bend": [round(e, 6) for e in final_eps],
            "residual_stress_mpa_per_bend": [round(s, 2) for s in final_residual],
            "flow_stress_mpa_per_bend": [round(f, 2) for f in final_flow],
            "max_cumulative_plastic_strain": round(max(final_eps), 6),
            "max_residual_stress_mpa": round(max(final_residual), 2),
            "hardening_ratio": round(max(final_flow) / mat["Fy_mpa"], 4),
        },
        "critical_passes": [p["pass_no"] for p in critical_passes],
        "warning_passes": [p["pass_no"] for p in warning_passes],
        "simulation_passes": sim_passes,
        "model_assumptions": [
            "2D plane-strain — longitudinal elongation not modelled",
            "Neutral axis at mid-plane (K-factor not applied)",
            "Isotropic hardening only (no Bauschinger effect)",
            "Each bend independent — no cross-bend coupling",
            "Roll contact: Hertzian cylinder-on-flat (line contact)",
            "No friction / roll-strip slip ratio",
            "Strip width: geometric projection (no FEM lateral flow)",
            "Springback from elastic moment recovery only",
        ],
        "vs_true_fea": [
            "FEA: full nodal mesh, plastic strain tensor at every node",
            "FEA: contact elements with friction, iterative Newton-Raphson solver",
            "FEA: 3D deformation, longitudinal stress, lateral flow",
            "This engine: analytical per-bend, closed-form, ~1000x faster than FEA",
            "Use for: design feasibility, go/no-go, process parameter screening",
            "Do not use for: structural certification, failure analysis, tool certification",
        ],
    }


# ═══════════════════════════════════════════════════════════
# CONVENIENCE: MATERIAL MODEL QUERY
# ═══════════════════════════════════════════════════════════

def get_material_model(material_code: str) -> Dict[str, Any]:
    """Return full Swift/Ramberg-Osgood material model for a material code."""
    mat = _get_material(material_code)
    eps_0 = (mat["Fy_mpa"] / mat["K_mpa"]) ** (1.0 / mat["n"])
    return {
        "material_code": material_code.upper(),
        "E_gpa": mat["E_gpa"],
        "Fy_mpa": mat["Fy_mpa"],
        "UTS_mpa": mat["UTS_mpa"],
        "K_mpa": mat["K_mpa"],
        "n": mat["n"],
        "eps_0_prestrain": round(eps_0, 6),
        "fracture_strain": mat["fracture_strain"],
        "density_kg_m3": mat["density_kg_m3"],
        "poisson": mat.get("poisson", 0.30),
        "hardening_law": "Swift: σ = K × (ε₀ + εp)ⁿ",
        "source": mat.get("source", ""),
        "stress_strain_points": _compute_stress_strain_curve(mat),
    }


def _compute_stress_strain_curve(mat: Dict, n_points: int = 20) -> List[Dict[str, float]]:
    """Return discrete (ε, σ) points on the Swift stress-strain curve for plotting."""
    E_mpa = mat["E_gpa"] * 1000.0
    Fy = mat["Fy_mpa"]
    eps_y = Fy / E_mpa
    fracture = mat["fracture_strain"]
    points = []
    for i in range(n_points + 1):
        eps = fracture * i / n_points
        if eps <= eps_y:
            sigma = E_mpa * eps
        else:
            sigma = swift_flow_stress(mat, eps - eps_y)
        points.append({"strain": round(eps, 5), "stress_mpa": round(sigma, 2)})
    return points
