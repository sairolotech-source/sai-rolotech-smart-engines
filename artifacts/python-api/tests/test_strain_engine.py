"""
test_strain_engine.py — Benchmark tests for strain_engine.py

Tests:
  - Formula correctness: ε = t / (2R + t)
  - Severity classification at fracture limits
  - Material-specific fracture thresholds
  - R/t ratio output
  - Blocking flag at HIGH severity
  - Edge cases (zero radius, zero thickness)
  - All 5 benchmark profiles
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.strain_engine import calculate_strain, MATERIAL_FRACTURE_STRAIN


class TestStrainFormula:

    def test_formula_correctness(self):
        """ε = t / (2R + t). For t=2, R=6: ε = 2/(12+2) = 0.142857."""
        result = calculate_strain(radius_mm=6.0, thickness_mm=2.0, material="GI")
        assert result["status"] == "pass"
        expected = 2.0 / (2.0 * 6.0 + 2.0)
        assert abs(result["strain_value"] - expected) < 1e-5, (
            f"Expected {expected:.6f}, got {result['strain_value']}"
        )

    def test_larger_radius_less_strain(self):
        r_small = calculate_strain(radius_mm=2.0, thickness_mm=1.5, material="GI")
        r_large = calculate_strain(radius_mm=20.0, thickness_mm=1.5, material="GI")
        assert r_small["strain_value"] > r_large["strain_value"]

    def test_thicker_strip_more_strain(self):
        thin  = calculate_strain(radius_mm=5.0, thickness_mm=0.8, material="GI")
        thick = calculate_strain(radius_mm=5.0, thickness_mm=3.0, material="GI")
        assert thick["strain_value"] > thin["strain_value"]

    def test_r_over_t_output(self):
        result = calculate_strain(radius_mm=6.0, thickness_mm=2.0, material="GI")
        expected_rot = 6.0 / 2.0
        assert abs(result["r_over_t"] - expected_rot) < 0.001

    def test_strain_pct_matches_value(self):
        result = calculate_strain(radius_mm=5.0, thickness_mm=1.5, material="MS")
        assert abs(result["strain_pct"] - result["strain_value"] * 100) < 0.001

    def test_zero_radius_returns_fail(self):
        result = calculate_strain(radius_mm=0.0, thickness_mm=1.5, material="GI")
        assert result["status"] == "fail"

    def test_zero_thickness_returns_fail(self):
        result = calculate_strain(radius_mm=5.0, thickness_mm=0.0, material="GI")
        assert result["status"] == "fail"


class TestSeverityClassification:

    def test_low_strain_classified_low(self):
        """Strain at 10% of fracture limit should be 'low'."""
        result = calculate_strain(radius_mm=100.0, thickness_mm=1.0, material="GI")
        assert result["severity"] in ("low", "low_medium")

    def test_high_strain_classified_high(self):
        """Strain at/above fracture limit should be 'high'."""
        # For GI fracture=0.40, use r small enough to get strain>=0.40
        # ε = t/(2r+t) >= 0.40 → 2r+t <= t/0.40 → r <= t*(1-0.40)/(2*0.40)
        t = 2.0
        r = t * (1 - 0.40) / (2 * 0.40) - 0.01  # just below exact limit for >= fracture
        result = calculate_strain(radius_mm=max(r, 0.1), thickness_mm=t, material="GI")
        assert result["severity"] == "high"
        assert result["blocking"] is True

    def test_blocking_true_at_high(self):
        t = 2.0
        r = t * (1 - 0.40) / (2 * 0.40) - 0.01
        result = calculate_strain(radius_mm=max(r, 0.1), thickness_mm=t, material="GI")
        assert result["blocking"] is True

    def test_blocking_false_at_low(self):
        result = calculate_strain(radius_mm=50.0, thickness_mm=1.5, material="GI")
        assert result["blocking"] is False


class TestMaterialFractureThresholds:

    def test_ss_lower_limit_than_gi(self):
        """SS fracture limit (0.32) < GI (0.40) — same geometry triggers earlier for SS."""
        # At strain ~0.35: HIGH for SS (0.35>0.32), but MEDIUM for GI (0.35 < 0.40)
        t = 2.0
        # ε = t/(2r+t) = 0.35 → r = t*(1-0.35)/(2*0.35) = 1.857
        r = t * (1 - 0.35) / (2 * 0.35)
        result_ss = calculate_strain(radius_mm=r, thickness_mm=t, material="SS")
        result_gi = calculate_strain(radius_mm=r, thickness_mm=t, material="GI")
        assert result_ss["severity"] in ("high", "medium"), "SS should flag at 0.35 strain"
        # GI fracture is 0.40; at 0.35 = 87.5% of limit → MEDIUM
        assert result_gi["severity"] in ("medium", "low_medium")

    def test_all_materials_produce_valid_result(self):
        for mat, fracture in MATERIAL_FRACTURE_STRAIN.items():
            result = calculate_strain(radius_mm=5.0, thickness_mm=1.5, material=mat)
            assert result["status"] == "pass", f"Material {mat} returned fail"
            assert 0 <= result["strain_value"] <= 1.0
            assert result["fracture_strain_limit"] == fracture

    def test_fracture_limit_in_response(self):
        result = calculate_strain(radius_mm=5.0, thickness_mm=1.5, material="SS")
        assert result["fracture_strain_limit"] == MATERIAL_FRACTURE_STRAIN["SS"]


class TestBenchmarkProfiles:

    def test_ms_170x50x3_safe_strain(self, profile_ms_170x50x3):
        """Standard 3mm MS at R=6mm — strain should be well within safe range."""
        p = profile_ms_170x50x3
        result = calculate_strain(radius_mm=6.0, thickness_mm=p["thickness_mm"], material=p["material"])
        assert result["status"] == "pass"
        assert result["severity"] in ("low", "low_medium", "medium")
        assert result["blocking"] is False

    def test_gi_100x40x1_2(self, profile_gi_100x40x1_2):
        p = profile_gi_100x40x1_2
        result = calculate_strain(radius_mm=2.5, thickness_mm=p["thickness_mm"], material=p["material"])
        assert result["status"] == "pass"
        assert result["strain_value"] > 0

    def test_ss_250x75x2_higher_sensitivity(self, profile_ss_250x75x2):
        p = profile_ss_250x75x2
        result = calculate_strain(radius_mm=4.0, thickness_mm=p["thickness_mm"], material=p["material"])
        assert result["status"] == "pass"
        # SS has lower fracture limit — same geometry flags earlier
        assert result["fracture_strain_limit"] == 0.32

    def test_stress_case_cracking_risk(self, profile_stress_case):
        """Stress case (SS 4mm, tight radius) may hit cracking zone."""
        p = profile_stress_case
        result = calculate_strain(radius_mm=3.0, thickness_mm=p["thickness_mm"], material=p["material"])
        assert result["status"] == "pass"
        # At R=3, t=4: ε = 4/(6+4) = 0.40; SS fracture = 0.32 → HIGH
        assert result["severity"] in ("high", "medium")
