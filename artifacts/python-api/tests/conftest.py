"""
conftest.py — Pytest fixtures for SAI Rolotech Smart Engines
5 benchmark profiles covering full material/thickness range.
"""
import pytest


# ─── Benchmark Profiles ───────────────────────────────────────────────────────

@pytest.fixture
def profile_ms_170x50x3():
    """170×50×3 MS — Standard C-channel, most common industrial profile."""
    return {
        "name": "170x50x3_MS_C_channel",
        "material": "MS",
        "thickness_mm": 3.0,
        "section_width_mm": 170.0,
        "section_height_mm": 50.0,
        "target_angle_deg": 90.0,
        "n_stations": 8,
        "is_symmetric": True,
        "profile_type": "C_channel",
    }


@pytest.fixture
def profile_gi_100x40x1_2():
    """100×40×1.2 GI — Typical purlins/small sections, thin galvanized."""
    return {
        "name": "100x40x1.2_GI_Z_section",
        "material": "GI",
        "thickness_mm": 1.2,
        "section_width_mm": 100.0,
        "section_height_mm": 40.0,
        "target_angle_deg": 90.0,
        "n_stations": 7,
        "is_symmetric": False,
        "profile_type": "Z_section",
    }


@pytest.fixture
def profile_ss_250x75x2():
    """250×75×2 SS — Wide stainless section, high springback, challenging."""
    return {
        "name": "250x75x2_SS_hat_section",
        "material": "SS",
        "thickness_mm": 2.0,
        "section_width_mm": 250.0,
        "section_height_mm": 75.0,
        "target_angle_deg": 85.0,
        "n_stations": 10,
        "is_symmetric": True,
        "profile_type": "hat_section",
    }


@pytest.fixture
def profile_cr_60x25x0_8():
    """60×25×0.8 CR — Thin cold-rolled, tight tolerances, high precision."""
    return {
        "name": "60x25x0.8_CR_lipped_channel",
        "material": "CR",
        "thickness_mm": 0.8,
        "section_width_mm": 60.0,
        "section_height_mm": 25.0,
        "target_angle_deg": 90.0,
        "n_stations": 6,
        "is_symmetric": True,
        "profile_type": "lipped_channel",
    }


@pytest.fixture
def profile_stress_case():
    """Stress case — max dimensions, high strength SS, near-90° — designed to trigger all warnings."""
    return {
        "name": "stress_case_300x100x4_SS",
        "material": "SS",
        "thickness_mm": 4.0,
        "section_width_mm": 300.0,
        "section_height_mm": 100.0,
        "target_angle_deg": 88.0,
        "n_stations": 12,
        "is_symmetric": False,
        "profile_type": "omega_section",
    }


@pytest.fixture
def all_benchmark_profiles(
    profile_ms_170x50x3,
    profile_gi_100x40x1_2,
    profile_ss_250x75x2,
    profile_cr_60x25x0_8,
    profile_stress_case,
):
    return [
        profile_ms_170x50x3,
        profile_gi_100x40x1_2,
        profile_ss_250x75x2,
        profile_cr_60x25x0_8,
        profile_stress_case,
    ]


# ─── Simple pass sequence generator ──────────────────────────────────────────

def make_pass_sequence(profile: dict) -> list:
    """Generate a realistic pass sequence for a benchmark profile."""
    n = profile["n_stations"]
    target = profile["target_angle_deg"]
    thickness = profile["thickness_mm"]
    material = profile["material"]

    # Stage assignment
    stages = ["flat"] + ["pre_bend"] + \
             ["progressive_forming"] * (n - 4) + \
             ["final_form"] + ["calibration"]
    stages = stages[:n]

    passes = []
    for i in range(n):
        ratio = i / max(n - 1, 1)
        angle = round(target * ratio, 1)
        gap = round(thickness * (1.0 - 0.02 * ratio), 3)
        width = round(profile["section_width_mm"] * 2 + profile["section_height_mm"] * 2.2 - i * 4.5, 1)
        passes.append({
            "pass_no": i + 1,
            "stage_type": stages[i],
            "target_angle_deg": angle,
            "roll_gap_mm": gap,
            "strip_width_mm": max(width, profile["section_width_mm"] + 10),
            "forming_depth_mm": round(profile["section_height_mm"] * ratio * 0.9, 2),
        })
    return passes


@pytest.fixture
def make_passes():
    return make_pass_sequence
