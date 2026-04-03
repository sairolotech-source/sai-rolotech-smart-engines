"""
test_bend_allowance_engine.py — Benchmark tests for bend_allowance_engine.py

Tests:
  - Single bend allowance formula: BA = (π/180) × (R + k×t) × θ
  - Flat blank = sum(segments) + sum(bend_allowances)
  - K-factor lookup per material
  - Minimum bend radius warning
  - Input validation (segment/angle count mismatch, negative radius)
  - Flat blank from profile (coil width + weight/m)
  - All 5 benchmark profiles
"""
import pytest
import math
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.bend_allowance_engine import (
    bend_allowance,
    calculate_flat_blank,
    flat_blank_from_profile,
)
from app.utils.material_database import get_property


class TestSingleBendAllowance:

    def test_formula_correctness_gi(self):
        """BA = (π/180) × (R + k×t) × θ; GI k=0.44, R=5, t=1.5, θ=90°."""
        k = get_property("GI", "k_factor", 0.44)
        R, t, theta = 5.0, 1.5, 90.0
        expected = (math.pi / 180.0) * (R + k * t) * theta
        result = bend_allowance(R, t, theta, material="GI")
        assert abs(result - expected) < 0.001, (
            f"Expected {expected:.4f}, got {result}"
        )

    def test_zero_angle_zero_ba(self):
        result = bend_allowance(5.0, 1.5, 0.0, "GI")
        assert result == 0.0

    def test_larger_radius_larger_ba(self):
        ba_small = bend_allowance(2.0, 1.5, 90.0, "GI")
        ba_large = bend_allowance(20.0, 1.5, 90.0, "GI")
        assert ba_large > ba_small

    def test_larger_angle_larger_ba(self):
        ba_45  = bend_allowance(5.0, 1.5, 45.0, "GI")
        ba_180 = bend_allowance(5.0, 1.5, 180.0, "GI")
        assert ba_180 > ba_45

    def test_ss_vs_gi_k_factor(self):
        """SS k=0.50, GI k=0.44 — SS should have larger BA for same geometry."""
        ba_gi = bend_allowance(5.0, 1.5, 90.0, "GI")
        ba_ss = bend_allowance(5.0, 1.5, 90.0, "SS")
        assert ba_ss > ba_gi, f"SS BA ({ba_ss}) should exceed GI BA ({ba_gi})"


class TestFlatBlankCalculation:

    def test_returns_pass(self):
        result = calculate_flat_blank([50.0, 30.0, 50.0], [90.0, 90.0], 1.5, 3.0, "GI")
        assert result["status"] == "pass"

    def test_flat_blank_exceeds_sum_of_segments(self):
        """Total flat blank must be greater than sum of segments (due to bend allowance)."""
        segs = [50.0, 30.0, 50.0]
        result = calculate_flat_blank(segs, [90.0, 90.0], 1.5, 3.0, "GI")
        assert result["flat_blank_mm"] > sum(segs)

    def test_flat_blank_components_sum(self):
        """flat_blank = total_segment_length + total_bend_allowance."""
        result = calculate_flat_blank([60.0, 40.0, 60.0], [90.0, 90.0], 1.5, 4.0, "MS")
        assert abs(
            result["flat_blank_mm"] -
            result["total_segment_length_mm"] -
            result["total_bend_allowance_mm"]
        ) < 0.001

    def test_segment_count_mismatch_fails(self):
        """2 segments for 2 bends — should fail (need 3 segments for 2 bends)."""
        result = calculate_flat_blank([50.0, 50.0], [90.0, 90.0], 1.5, 3.0, "GI")
        assert result["status"] == "fail"

    def test_single_bend_c_section(self):
        """Simple L-section: 2 segments, 1 bend at 90°."""
        result = calculate_flat_blank([40.0, 60.0], [90.0], 1.5, 3.0, "GI")
        assert result["status"] == "pass"
        assert result["bend_count"] == 1
        assert result["flat_blank_mm"] > 100.0  # 40 + 60 + BA

    def test_negative_radius_fails(self):
        result = calculate_flat_blank([50.0, 50.0, 50.0], [90.0, 90.0], 1.5, -1.0, "GI")
        assert result["status"] == "fail"

    def test_minimum_radius_warning(self):
        """Radius below min R/t × t should produce a warning."""
        # GI min_bend_radius_x_t = 0.5, so for t=2.0: min_r = 1.0mm; use r=0.3
        result = calculate_flat_blank([50.0, 30.0, 50.0], [90.0, 90.0], 2.0, 0.3, "GI")
        assert result["status"] == "pass"   # not a fatal error
        assert len(result.get("warnings", [])) > 0
        assert result["blocking"] is True

    def test_k_factor_in_response(self):
        result = calculate_flat_blank([50.0, 30.0, 50.0], [90.0, 90.0], 1.5, 3.0, "SS")
        k_expected = get_property("SS", "k_factor", 0.50)
        assert abs(result["k_factor"] - k_expected) < 0.001

    def test_method_is_din6935(self):
        result = calculate_flat_blank([50.0, 30.0, 50.0], [90.0, 90.0], 1.5, 3.0, "GI")
        assert "DIN" in result.get("method", "")


class TestFlatBlankFromProfile:

    def test_coil_width_exceeds_blank(self):
        result = flat_blank_from_profile([50.0, 30.0, 50.0], [90.0, 90.0], 1.5, 3.0, "GI")
        assert result["status"] == "pass"
        assert result["coil_strip_width_mm"] > result["flat_blank_mm"]

    def test_weight_per_meter_positive(self):
        result = flat_blank_from_profile([60.0, 40.0, 60.0], [90.0, 90.0], 2.0, 4.0, "MS")
        assert result["weight_kg_per_m"] > 0

    def test_al_lighter_than_ms(self):
        """Aluminium density is ~2700 vs MS ~7850 kg/m³ — same geometry should be lighter."""
        r_ms = flat_blank_from_profile([60.0, 40.0, 60.0], [90.0, 90.0], 2.0, 4.0, "MS")
        r_al = flat_blank_from_profile([60.0, 40.0, 60.0], [90.0, 90.0], 2.0, 4.0, "AL")
        assert r_al["weight_kg_per_m"] < r_ms["weight_kg_per_m"]

    def test_tolerance_applied_correctly(self):
        tol = 3.0
        result = flat_blank_from_profile([50.0, 30.0, 50.0], [90.0, 90.0], 1.5, 3.0, "GI",
                                         coil_width_tolerance_mm=tol)
        assert abs(result["coil_strip_width_mm"] - result["flat_blank_mm"] - tol) < 0.1


class TestBenchmarkProfiles:

    def test_ms_170x50x3_blank(self, profile_ms_170x50x3):
        """C-channel 170×50×3 MS — 2 flanges + 1 web = 3 segs, 2 bends."""
        p = profile_ms_170x50x3
        segments = [p["section_height_mm"], p["section_width_mm"], p["section_height_mm"]]
        bends = [90.0, 90.0]
        result = calculate_flat_blank(segments, bends, p["thickness_mm"], 6.0, p["material"])
        assert result["status"] == "pass"
        # Blank should be roughly section_width + 2×height + 2×bend_allowance
        assert result["flat_blank_mm"] > p["section_width_mm"] + 2 * p["section_height_mm"]
        assert result["flat_blank_mm"] < p["section_width_mm"] + 2 * p["section_height_mm"] + 50

    def test_gi_100x40x1_2(self, profile_gi_100x40x1_2):
        p = profile_gi_100x40x1_2
        segments = [p["section_height_mm"], p["section_width_mm"], p["section_height_mm"]]
        bends = [90.0, 90.0]
        result = calculate_flat_blank(segments, bends, p["thickness_mm"], 2.5, p["material"])
        assert result["status"] == "pass"
        assert result["bend_count"] == 2

    def test_all_benchmarks_pass(self, all_benchmark_profiles):
        for p in all_benchmark_profiles:
            segments = [p["section_height_mm"], p["section_width_mm"], p["section_height_mm"]]
            bends = [90.0, 90.0]
            result = calculate_flat_blank(segments, bends, p["thickness_mm"], 4.0, p["material"])
            assert result["status"] == "pass", (
                f"Profile {p['name']} failed: {result.get('reason')}"
            )
            assert result["flat_blank_mm"] > 50
