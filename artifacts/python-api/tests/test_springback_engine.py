"""
test_springback_engine.py — Benchmark tests for springback_engine.py
Tests: calculation correctness, all 5 benchmark profiles, edge cases.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.springback_engine import calculate_springback, SPRINGBACK_FACTORS


class TestSpringbackBasic:

    def test_ms_springback_returns_dict(self):
        result = calculate_springback("MS", 90.0, thickness_mm=2.0, bend_radius_mm=6.0)
        assert isinstance(result, dict)
        assert "springback_deg" in result or "status" in result

    def test_gi_springback_less_than_ss(self):
        """GI should always springback less than SS for same angle."""
        gi = calculate_springback("GI", 90.0, thickness_mm=1.5, bend_radius_mm=4.0)
        ss = calculate_springback("SS", 90.0, thickness_mm=1.5, bend_radius_mm=4.0)
        gi_sb = gi.get("springback_deg", 0)
        ss_sb = ss.get("springback_deg", 0)
        assert gi_sb < ss_sb, f"GI springback ({gi_sb}°) should be less than SS ({ss_sb}°)"

    def test_higher_angle_more_springback(self):
        """90° bend should produce more springback than 45°."""
        sb45 = calculate_springback("MS", 45.0, thickness_mm=2.0, bend_radius_mm=6.0)
        sb90 = calculate_springback("MS", 90.0, thickness_mm=2.0, bend_radius_mm=6.0)
        assert sb90.get("springback_deg", 0) >= sb45.get("springback_deg", 0)

    def test_zero_angle_zero_springback(self):
        result = calculate_springback("MS", 0.0, thickness_mm=2.0, bend_radius_mm=6.0)
        sb = result.get("springback_deg", 0)
        assert sb == 0.0 or sb < 0.01

    def test_all_materials_produce_valid_result(self):
        for mat in SPRINGBACK_FACTORS.keys():
            result = calculate_springback(mat, 90.0, thickness_mm=2.0, bend_radius_mm=5.0)
            assert isinstance(result, dict), f"Material {mat} failed"
            sb = result.get("springback_deg", None)
            if sb is not None:
                assert 0 <= sb <= 30, f"Unrealistic springback for {mat}: {sb}°"


class TestSpringbackBenchmarks:

    def test_ms_170x50x3(self, profile_ms_170x50x3):
        p = profile_ms_170x50x3
        result = calculate_springback(p["material"], p["target_angle_deg"],
                                      thickness_mm=p["thickness_mm"], bend_radius_mm=6.0)
        assert isinstance(result, dict)
        sb = result.get("springback_deg", 0)
        assert 0 < sb < 15, f"MS 3mm springback out of range: {sb}°"

    def test_gi_100x40x1_2(self, profile_gi_100x40x1_2):
        p = profile_gi_100x40x1_2
        result = calculate_springback(p["material"], p["target_angle_deg"],
                                      thickness_mm=p["thickness_mm"], bend_radius_mm=3.0)
        sb = result.get("springback_deg", 0)
        assert 0 < sb < 10, f"GI 1.2mm springback out of range: {sb}°"

    def test_ss_250x75x2(self, profile_ss_250x75x2):
        p = profile_ss_250x75x2
        result = calculate_springback(p["material"], p["target_angle_deg"],
                                      thickness_mm=p["thickness_mm"], bend_radius_mm=4.0)
        sb = result.get("springback_deg", 0)
        # SS should have highest springback
        assert sb > 0, f"SS springback should be > 0, got {sb}"

    def test_cr_60x25x0_8(self, profile_cr_60x25x0_8):
        p = profile_cr_60x25x0_8
        result = calculate_springback(p["material"], p["target_angle_deg"],
                                      thickness_mm=p["thickness_mm"], bend_radius_mm=2.0)
        sb = result.get("springback_deg", 0)
        assert 0 < sb < 20, f"CR springback out of range: {sb}°"

    def test_stress_case(self, profile_stress_case):
        p = profile_stress_case
        result = calculate_springback(p["material"], p["target_angle_deg"],
                                      thickness_mm=p["thickness_mm"], bend_radius_mm=8.0)
        assert isinstance(result, dict), "Stress case should not crash"
