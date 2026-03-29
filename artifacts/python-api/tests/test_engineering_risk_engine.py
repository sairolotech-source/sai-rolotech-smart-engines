"""
test_engineering_risk_engine.py — Tests for the new Engineering Risk Engine
Tests: bend severity, edge buckling, twist risk, calibration need, confidence, full report.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.engineering_risk_engine import (
    calculate_bend_severity_index,
    check_edge_buckling_risk,
    check_twist_risk,
    estimate_calibration_need,
    calculate_deformation_confidence,
    check_over_compression,
    generate_engineering_risk_report,
)
from tests.conftest import make_pass_sequence


class TestBendSeverityIndex:

    def test_returns_score_0_to_10(self):
        result = calculate_bend_severity_index(45.0, 0.0, 2.0, 6.0, "MS", "progressive_forming")
        assert 0.0 <= result["score"] <= 10.0

    def test_small_increment_low_severity(self):
        result = calculate_bend_severity_index(10.0, 0.0, 2.0, 6.0, "MS", "pre_bend")
        assert result["score"] < 5.0, "Small 10° increment should not be high severity"

    def test_over_limit_increment_raises_score(self):
        result = calculate_bend_severity_index(30.0, 0.0, 2.0, 6.0, "MS", "progressive_forming")
        assert result["increment_over_limit"] is True
        assert result["score"] >= 4.0

    def test_ss_stricter_than_ms(self):
        """SS has tighter increment limits — same angle increment is riskier."""
        ms = calculate_bend_severity_index(15.0, 0.0, 2.0, 5.0, "MS", "progressive_forming")
        ss = calculate_bend_severity_index(15.0, 0.0, 2.0, 5.0, "SS", "progressive_forming")
        assert ss["score"] >= ms["score"], "SS should be same or higher risk than MS"

    def test_flat_stage_zero_severity(self):
        result = calculate_bend_severity_index(0.0, 0.0, 2.0, 100.0, "MS", "flat")
        assert result["score"] == 0.0

    def test_method_label_present(self):
        result = calculate_bend_severity_index(20.0, 0.0, 1.5, 4.0, "GI", "initial_bend")
        assert "method" in result
        assert "[" in result["method"]


class TestEdgeBucklingRisk:

    def test_safe_wt_ratio(self):
        result = check_edge_buckling_risk(50.0, 3.0, 30.0, "MS")  # w/t = 16.7 — safe
        assert result["risk_level"] in ("OK", "CAUTION")
        assert result["w_over_t"] == pytest.approx(50/3, rel=0.01)

    def test_risky_wt_ratio(self):
        result = check_edge_buckling_risk(120.0, 2.0, 60.0, "CR")  # w/t = 60 — risky
        assert result["at_risk"] is True
        assert len(result["recommendations"]) > 0

    def test_thin_wide_strip_ss_flagged(self):
        result = check_edge_buckling_risk(200.0, 1.5, 70.0, "SS")  # w/t = 133
        assert result["risk_level"] in ("WARNING", "CRITICAL")


class TestTwistRisk:

    def test_symmetric_low_aspect_ok(self):
        result = check_twist_risk(30.0, 100.0, 45.0, is_symmetric=True)
        assert result["risk_level"] in ("OK", "CAUTION")

    def test_asymmetric_doubles_risk(self):
        """Asymmetric profiles are more risky than symmetric — or both max at 10.0."""
        sym = check_twist_risk(40.0, 80.0, 60.0, is_symmetric=True)
        asym = check_twist_risk(40.0, 80.0, 60.0, is_symmetric=False)
        assert asym["score"] >= sym["score"], "Asymmetric should have same or higher risk than symmetric"
        # Also verify asymmetric multiplier has real effect at moderate aspect ratio
        sym2 = check_twist_risk(25.0, 60.0, 45.0, is_symmetric=True)
        asym2 = check_twist_risk(25.0, 60.0, 45.0, is_symmetric=False)
        assert asym2["score"] > sym2["score"], "At moderate h/w, asymmetric should be clearly riskier"

    def test_high_aspect_flagged(self):
        result = check_twist_risk(80.0, 60.0, 85.0, is_symmetric=False)
        assert result["at_risk"] is True


class TestCalibrationNeed:

    def test_ss_needs_calibration(self):
        result = estimate_calibration_need("SS", 85.0, 2.0, 8, has_calibration_pass=False)
        assert len(result["recommendations"]) > 0
        assert result["urgency_score"] >= 4.0

    def test_gi_thin_low_urgency(self):
        result = estimate_calibration_need("GI", 45.0, 1.2, 6, has_calibration_pass=True)
        assert result["urgency_score"] < 7.0

    def test_urgency_score_range(self):
        for mat in ("GI", "MS", "SS", "CR", "HR"):
            result = estimate_calibration_need(mat, 90.0, 2.0, 8, has_calibration_pass=False)
            assert 0 <= result["urgency_score"] <= 10


class TestDeformationConfidence:

    def test_ms_standard_high_confidence(self):
        result = calculate_deformation_confidence("MS", 2.0, 45.0, 6.0, 8)
        assert result["confidence_pct"] >= 65.0

    def test_thin_ss_low_confidence(self):
        result = calculate_deformation_confidence("SS", 0.7, 88.0, 2.0, 4)
        assert result["confidence_pct"] < 65.0

    def test_confidence_in_range(self):
        for mat in ("GI", "MS", "SS", "CR", "AL"):
            result = calculate_deformation_confidence(mat, 1.5, 70.0, 5.0, 7)
            assert 20 <= result["confidence_pct"] <= 100


class TestOverCompression:

    def test_correct_gap_ok(self):
        result = check_over_compression(2.1, 2.0, "MS")  # 1.05× — OK
        assert result["at_risk"] is False
        assert result["level"] == "OK"

    def test_too_tight_flagged(self):
        result = check_over_compression(1.5, 2.0, "MS")  # 0.75× — too tight
        assert result["too_tight"] is True
        assert result["at_risk"] is True

    def test_too_loose_flagged(self):
        result = check_over_compression(2.5, 2.0, "MS")  # 1.25× — too loose
        assert result["too_loose"] is True


class TestFullRiskReport:

    def test_ms_benchmark_report(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        report = generate_engineering_risk_report(
            passes=passes,
            material=p["material"],
            thickness_mm=p["thickness_mm"],
            section_height_mm=p["section_height_mm"],
            section_width_mm=p["section_width_mm"],
            is_symmetric=p["is_symmetric"],
            has_calibration_pass=True,
        )
        assert "overall_risk_level" in report
        assert report["overall_risk_level"] in ("OK", "CAUTION", "WARNING", "CRITICAL")
        assert len(report["per_pass"]) == p["n_stations"]

    def test_stress_case_triggers_warnings(self, profile_stress_case, make_passes):
        p = profile_stress_case
        passes = make_passes(p)
        report = generate_engineering_risk_report(
            passes=passes,
            material=p["material"],
            thickness_mm=p["thickness_mm"],
            section_height_mm=p["section_height_mm"],
            section_width_mm=p["section_width_mm"],
            is_symmetric=p["is_symmetric"],
            has_calibration_pass=False,
        )
        assert report["overall_risk_level"] in ("WARNING", "CRITICAL", "CAUTION")
        assert len(report["recommendations"]) > 0

    def test_all_five_benchmarks(self, all_benchmark_profiles, make_passes):
        for p in all_benchmark_profiles:
            passes = make_passes(p)
            report = generate_engineering_risk_report(
                passes=passes,
                material=p["material"],
                thickness_mm=p["thickness_mm"],
                section_height_mm=p["section_height_mm"],
                section_width_mm=p["section_width_mm"],
                is_symmetric=p["is_symmetric"],
                has_calibration_pass=(p["n_stations"] >= 7),
            )
            assert "overall_risk_level" in report, f"Report failed for {p['name']}"
            assert "disclaimer" in report, "Disclaimer label must always be present"
            assert "confidence" in report

    def test_disclaimer_always_present(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        report = generate_engineering_risk_report(
            passes=passes, material="MS", thickness_mm=3.0,
            section_height_mm=50, section_width_mm=170,
            is_symmetric=True, has_calibration_pass=True,
        )
        assert "[Estimate]" in report["disclaimer"]

    def test_empty_passes_handled(self):
        report = generate_engineering_risk_report(
            passes=[], material="MS", thickness_mm=2.0,
            section_height_mm=50, section_width_mm=100,
            is_symmetric=True, has_calibration_pass=False,
        )
        assert "error" in report
