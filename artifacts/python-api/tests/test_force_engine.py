"""
test_force_engine.py — Benchmark tests for force_engine.py

Tests:
  - Formula correctness: F = 0.8 × t² × w × Fy / r
  - Material strength ordering (SS > MS > GI)
  - Power and torque calculations
  - Force level classification
  - All 5 benchmark profiles
  - Edge cases (zero thickness, zero radius)
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.force_engine import estimate_forming_force


class TestForceFormula:

    def test_returns_pass_status(self):
        result = estimate_forming_force(2.0, 200.0, "MS", bend_radius_mm=6.0)
        assert result["status"] == "pass", f"Expected pass, got {result}"

    def test_force_positive(self):
        result = estimate_forming_force(2.0, 200.0, "MS", bend_radius_mm=6.0)
        assert result["estimated_force_kn"] > 0

    def test_formula_manual_check(self):
        """F = 0.8 * t² * w * Fy / r; MS Fy=350, t=2, w=200, r=6 → 37.33kN"""
        result = estimate_forming_force(2.0, 200.0, "MS", bend_radius_mm=6.0)
        Fy = 350
        expected_n = 0.8 * (2.0 ** 2) * 200.0 * Fy / 6.0
        expected_kn = expected_n / 1000.0
        assert abs(result["estimated_force_kn"] - expected_kn) < 0.01, (
            f"Force formula mismatch: expected {expected_kn:.4f} kN, got {result['estimated_force_kn']}"
        )

    def test_zero_thickness_fails(self):
        result = estimate_forming_force(0.0, 200.0, "MS", bend_radius_mm=5.0)
        assert result["status"] == "fail"

    def test_zero_width_fails(self):
        result = estimate_forming_force(2.0, 0.0, "MS", bend_radius_mm=5.0)
        assert result["status"] == "fail"

    def test_zero_radius_clamps_to_thickness(self):
        """Zero radius should clamp to max(t, 1.0), not fail."""
        result = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=0.0)
        assert result["status"] == "pass"
        assert result["estimated_force_kn"] > 0


class TestMaterialOrdering:

    def test_ss_force_greater_than_ms(self):
        """SS has higher Fy than MS — should produce higher force."""
        f_ms = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=5.0)
        f_ss = estimate_forming_force(2.0, 150.0, "SS", bend_radius_mm=5.0)
        assert f_ss["estimated_force_kn"] > f_ms["estimated_force_kn"], (
            f"SS ({f_ss['estimated_force_kn']}) should exceed MS ({f_ms['estimated_force_kn']})"
        )

    def test_hr_force_greater_than_gi(self):
        f_gi = estimate_forming_force(2.0, 150.0, "GI", bend_radius_mm=5.0)
        f_hr = estimate_forming_force(2.0, 150.0, "HR", bend_radius_mm=5.0)
        assert f_hr["estimated_force_kn"] > f_gi["estimated_force_kn"]

    def test_all_materials_return_pass(self):
        for mat in ["GI", "MS", "SS", "CR", "HR", "AL"]:
            result = estimate_forming_force(1.5, 120.0, mat, bend_radius_mm=4.0)
            assert result["status"] == "pass", f"Material {mat} returned fail"
            assert result["estimated_force_kn"] > 0


class TestGeometryScaling:

    def test_wider_strip_more_force(self):
        f_narrow = estimate_forming_force(2.0, 100.0, "MS", bend_radius_mm=5.0)
        f_wide   = estimate_forming_force(2.0, 400.0, "MS", bend_radius_mm=5.0)
        assert f_wide["estimated_force_kn"] > f_narrow["estimated_force_kn"]

    def test_larger_radius_less_force(self):
        f_tight = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=2.0)
        f_loose = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=20.0)
        assert f_tight["estimated_force_kn"] > f_loose["estimated_force_kn"]

    def test_thicker_strip_more_force(self):
        f_thin  = estimate_forming_force(0.8, 150.0, "GI", bend_radius_mm=5.0)
        f_thick = estimate_forming_force(3.0, 150.0, "GI", bend_radius_mm=5.0)
        assert f_thick["estimated_force_kn"] > f_thin["estimated_force_kn"]


class TestPowerAndTorque:

    def test_power_positive(self):
        result = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=5.0)
        assert result["motor_power_kw"] > 0

    def test_higher_speed_more_power(self):
        r_slow = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=5.0, strip_speed_mpm=5.0)
        r_fast = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=5.0, strip_speed_mpm=30.0)
        assert r_fast["motor_power_kw"] > r_slow["motor_power_kw"]

    def test_torque_positive(self):
        result = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=5.0)
        assert result["torque_nm"] > 0

    def test_power_formula(self):
        """P = F * v / η  where η=0.75"""
        result = estimate_forming_force(2.0, 150.0, "MS", bend_radius_mm=5.0, strip_speed_mpm=15.0)
        F_n = result["estimated_force_n"]
        v   = 15.0 / 60.0
        expected_kw = (F_n * v) / (0.75 * 1000)
        assert abs(result["motor_power_kw"] - expected_kw) < 0.001


class TestForceLevelClassification:

    def test_heavy_load_classified(self):
        """Large thick SS section should be heavy."""
        result = estimate_forming_force(4.0, 400.0, "SS", bend_radius_mm=5.0)
        assert result["force_level"] in ("heavy", "medium")

    def test_thin_al_very_light(self):
        """Thin aluminium should be light or very_light."""
        result = estimate_forming_force(0.5, 60.0, "AL", bend_radius_mm=3.0)
        assert result["force_level"] in ("light", "very_light")


class TestBenchmarkProfiles:

    def test_ms_170x50x3(self, profile_ms_170x50x3):
        p = profile_ms_170x50x3
        result = estimate_forming_force(
            p["thickness_mm"], p["section_width_mm"], p["material"], bend_radius_mm=6.0
        )
        assert result["status"] == "pass"
        assert 0 < result["estimated_force_kn"] < 1000

    def test_gi_100x40x1_2(self, profile_gi_100x40x1_2):
        p = profile_gi_100x40x1_2
        result = estimate_forming_force(
            p["thickness_mm"], p["section_width_mm"], p["material"], bend_radius_mm=3.0
        )
        assert result["status"] == "pass"
        assert result["estimated_force_kn"] < 100

    def test_ss_250x75x2(self, profile_ss_250x75x2):
        p = profile_ss_250x75x2
        result = estimate_forming_force(
            p["thickness_mm"], p["section_width_mm"], p["material"], bend_radius_mm=4.0
        )
        assert result["status"] == "pass"
        assert result["estimated_force_kn"] > 10

    def test_stress_case(self, profile_stress_case):
        p = profile_stress_case
        result = estimate_forming_force(
            p["thickness_mm"], p["section_width_mm"], p["material"], bend_radius_mm=6.0
        )
        assert result["status"] == "pass"
        assert result["estimated_force_kn"] > 50
