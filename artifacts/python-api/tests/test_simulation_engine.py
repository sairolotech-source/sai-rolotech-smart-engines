"""
test_simulation_engine.py — Benchmark tests for simulation_engine.py
Tests: outer fibre strain, forming force, springback angle, full simulation run.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.simulation_engine import (
    calculate_outer_fiber_strain,
    calculate_forming_force_kn,
    calculate_springback_angle,
    profile_at_ratio,
)


class TestOuterFibreStrain:

    def test_formula_correctness(self):
        """ε = t / (2r + t). For t=2, r=6: ε = 2/(12+2) = 0.14286."""
        strain = calculate_outer_fiber_strain(2.0, 6.0)
        assert abs(strain - 0.14286) < 0.001, f"Expected ~0.14286, got {strain}"

    def test_zero_radius_returns_zero(self):
        strain = calculate_outer_fiber_strain(2.0, 0.0)
        assert strain == 0.0

    def test_large_radius_small_strain(self):
        strain = calculate_outer_fiber_strain(1.0, 1000.0)
        assert strain < 0.001

    def test_strain_increases_with_thickness(self):
        s1 = calculate_outer_fiber_strain(1.0, 5.0)
        s2 = calculate_outer_fiber_strain(3.0, 5.0)
        assert s2 > s1

    def test_strain_decreases_with_radius(self):
        s1 = calculate_outer_fiber_strain(2.0, 3.0)
        s2 = calculate_outer_fiber_strain(2.0, 10.0)
        assert s1 > s2


class TestFormingForce:

    def test_returns_positive_float(self):
        force = calculate_forming_force_kn(2.0, 200.0, "MS", 6.0)
        assert isinstance(force, float)
        assert force > 0

    def test_zero_radius_zero_force(self):
        force = calculate_forming_force_kn(2.0, 200.0, "MS", 0.0)
        assert force == 0.0

    def test_ss_higher_force_than_gi(self):
        """SS has higher yield strength — should require more force."""
        f_gi = calculate_forming_force_kn(2.0, 150.0, "GI", 5.0)
        f_ss = calculate_forming_force_kn(2.0, 150.0, "SS", 5.0)
        assert f_ss > f_gi

    def test_wider_strip_more_force(self):
        f_narrow = calculate_forming_force_kn(2.0, 100.0, "MS", 5.0)
        f_wide = calculate_forming_force_kn(2.0, 300.0, "MS", 5.0)
        assert f_wide > f_narrow

    def test_benchmark_ms_170x3(self, profile_ms_170x50x3):
        p = profile_ms_170x50x3
        force = calculate_forming_force_kn(p["thickness_mm"], p["section_width_mm"], p["material"], 6.0)
        assert 0 < force < 500, f"MS 3mm force seems wrong: {force}kN"


class TestSpringbackAngle:

    def test_positive_springback(self):
        sb = calculate_springback_angle("MS", 90.0, 2.0, 6.0)
        assert sb > 0

    def test_ss_more_than_gi(self):
        gi = calculate_springback_angle("GI", 90.0, 1.5, 4.0)
        ss = calculate_springback_angle("SS", 90.0, 1.5, 4.0)
        assert ss > gi

    def test_zero_angle_zero_sb(self):
        sb = calculate_springback_angle("MS", 0.0, 2.0, 5.0)
        assert sb == 0.0 or sb < 0.01

    def test_all_benchmarks_reasonable(self, all_benchmark_profiles):
        for p in all_benchmark_profiles:
            sb = calculate_springback_angle(p["material"], p["target_angle_deg"],
                                            p["thickness_mm"], 5.0)
            assert 0 <= sb <= 25, f"Unrealistic springback for {p['name']}: {sb}°"


class TestProfileAtRatio:

    @pytest.fixture
    def simple_l_profile(self):
        return [
            {"x": 0, "y": 0},
            {"x": 50, "y": 0},
            {"x": 50, "y": 30},
        ]

    def test_ratio_zero_returns_list(self, simple_l_profile):
        result = profile_at_ratio(simple_l_profile, 0.0)
        assert isinstance(result, list)
        assert len(result) == 3

    def test_ratio_one_returns_list(self, simple_l_profile):
        result = profile_at_ratio(simple_l_profile, 1.0)
        assert isinstance(result, list)
        assert len(result) == 3

    def test_points_have_x_y(self, simple_l_profile):
        result = profile_at_ratio(simple_l_profile, 0.5)
        for pt in result:
            assert "x" in pt and "y" in pt

    def test_empty_profile_returns_empty(self):
        result = profile_at_ratio([], 0.5)
        assert result == []
