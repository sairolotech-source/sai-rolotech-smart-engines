"""
test_deformation_predictor.py — Tests for deformation_predictor_engine.py
Tests: bow/camber, edge wave, wrinkling, aggressiveness heatmap, full report.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.deformation_predictor_engine import (
    predict_bow_camber,
    predict_edge_wave_risk,
    predict_wrinkling_risk,
    calculate_station_aggressiveness,
    generate_deformation_prediction_report,
)
from tests.conftest import make_pass_sequence


class TestBowCamber:

    def test_returns_dict_with_required_keys(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        result = predict_bow_camber(passes, p["material"], p["thickness_mm"],
                                    p["section_width_mm"], p["is_symmetric"])
        assert "bow_tendency_score" in result
        assert "camber_tendency_score" in result
        assert "bow_level" in result
        assert "method" in result

    def test_scores_in_range(self, all_benchmark_profiles, make_passes):
        for p in all_benchmark_profiles:
            passes = make_passes(p)
            r = predict_bow_camber(passes, p["material"], p["thickness_mm"],
                                   p["section_width_mm"], p["is_symmetric"])
            assert 0 <= r["bow_tendency_score"] <= 10
            assert 0 <= r["camber_tendency_score"] <= 10

    def test_asymmetric_higher_camber(self, profile_gi_100x40x1_2, make_passes):
        p = profile_gi_100x40x1_2
        passes = make_passes(p)
        asym = predict_bow_camber(passes, p["material"], p["thickness_mm"],
                                  p["section_width_mm"], is_symmetric=False)
        sym = predict_bow_camber(passes, p["material"], p["thickness_mm"],
                                 p["section_width_mm"], is_symmetric=True)
        assert asym["camber_tendency_score"] >= sym["camber_tendency_score"]

    def test_ss_higher_bow_than_gi(self, profile_gi_100x40x1_2, profile_ss_250x75x2, make_passes):
        gi_passes = make_passes(profile_gi_100x40x1_2)
        ss_passes = make_passes(profile_ss_250x75x2)
        gi_r = predict_bow_camber(gi_passes, "GI", 1.2, 100.0, True)
        ss_r = predict_bow_camber(ss_passes, "SS", 2.0, 250.0, True)
        assert ss_r["bow_tendency_score"] >= gi_r["bow_tendency_score"]

    def test_method_label_present(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        r = predict_bow_camber(passes, "MS", 3.0, 170.0, True)
        assert "[Formula" in r["method"] or "[Rule" in r["method"] or "[Estimate" in r["method"]


class TestEdgeWaveRisk:

    def test_safe_profile_low_risk(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        r = predict_edge_wave_risk(passes, "MS", 3.0, 50.0)  # narrow section
        assert r["edge_wave_score"] < 7.0

    def test_wide_thin_high_risk(self, make_passes, profile_gi_100x40x1_2):
        passes = make_passes(profile_gi_100x40x1_2)
        r = predict_edge_wave_risk(passes, "GI", 0.8, 400.0)  # very wide, thin
        assert r["at_risk"] is True

    def test_critical_width_positive(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        r = predict_edge_wave_risk(passes, "MS", 2.0, 100.0)
        assert r["critical_width_mm"] > 0

    def test_all_benchmarks_no_crash(self, all_benchmark_profiles, make_passes):
        for p in all_benchmark_profiles:
            passes = make_passes(p)
            r = predict_edge_wave_risk(passes, p["material"], p["thickness_mm"], p["section_width_mm"])
            assert isinstance(r, dict)
            assert "edge_wave_score" in r


class TestWrinklingRisk:

    def test_flat_profile_low_risk(self, make_passes, profile_cr_60x25x0_8):
        p = profile_cr_60x25x0_8
        passes = make_passes(p)
        # Narrow profile — lower wrinkling
        r = predict_wrinkling_risk(passes, "CR", 0.8, 30.0)
        assert r["wrinkling_score"] < 8.0

    def test_deep_wide_high_risk(self, make_passes, profile_ss_250x75x2):
        p = profile_ss_250x75x2
        passes = make_passes(p)
        r = predict_wrinkling_risk(passes, "SS", 1.0, 250.0, bend_radius_mm=1.5)
        assert r["wrinkling_score"] >= 3.0

    def test_risky_zones_list(self, make_passes, profile_ms_170x50x3):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        r = predict_wrinkling_risk(passes, "MS", 3.0, 170.0)
        assert isinstance(r["risky_zones"], list)

    def test_score_in_range(self, all_benchmark_profiles, make_passes):
        for p in all_benchmark_profiles:
            passes = make_passes(p)
            r = predict_wrinkling_risk(passes, p["material"], p["thickness_mm"], p["section_width_mm"])
            assert 0 <= r["wrinkling_score"] <= 10


class TestStationAggressiveness:

    def test_returns_list_same_length_as_passes(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        result = calculate_station_aggressiveness(passes, "MS", 3.0)
        assert len(result) == len(passes)

    def test_each_entry_has_score(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        result = calculate_station_aggressiveness(passes, "MS", 3.0)
        for entry in result:
            assert "aggressiveness_score" in entry
            assert 0 <= entry["aggressiveness_score"] <= 10

    def test_flat_pass_lowest_score(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        result = calculate_station_aggressiveness(passes, "MS", 3.0)
        flat_scores = [r["aggressiveness_score"] for r in result if r["stage_type"] == "flat"]
        other_scores = [r["aggressiveness_score"] for r in result if r["stage_type"] != "flat"]
        if flat_scores and other_scores:
            assert min(flat_scores) <= max(other_scores)

    def test_method_label_present(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        result = calculate_station_aggressiveness(passes, "MS", 3.0)
        assert all("method" in r for r in result)


class TestFullDeformationReport:

    def test_all_five_benchmarks(self, all_benchmark_profiles, make_passes):
        for p in all_benchmark_profiles:
            passes = make_passes(p)
            report = generate_deformation_prediction_report(
                passes=passes,
                material=p["material"],
                thickness_mm=p["thickness_mm"],
                section_width_mm=p["section_width_mm"],
                section_height_mm=p["section_height_mm"],
                is_symmetric=p["is_symmetric"],
            )
            assert report["status"] == "pass", f"Failed for {p['name']}"
            assert "overall_deformation_score" in report
            assert "bow_camber" in report
            assert "edge_wave" in report
            assert "wrinkling" in report
            assert "aggressiveness_heatmap" in report

    def test_disclaimer_always_present(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        report = generate_deformation_prediction_report(
            passes=passes, material="MS", thickness_mm=3.0,
            section_width_mm=170.0, section_height_mm=50.0, is_symmetric=True,
        )
        assert "[Estimate]" in report["disclaimer"]

    def test_stress_case_has_recommendations(self, profile_stress_case, make_passes):
        p = profile_stress_case
        passes = make_passes(p)
        report = generate_deformation_prediction_report(
            passes=passes, material=p["material"], thickness_mm=p["thickness_mm"],
            section_width_mm=p["section_width_mm"], section_height_mm=p["section_height_mm"],
            is_symmetric=p["is_symmetric"],
        )
        assert len(report["all_recommendations"]) > 0

    def test_empty_passes_handled(self):
        report = generate_deformation_prediction_report(
            passes=[], material="MS", thickness_mm=2.0,
            section_width_mm=100.0, section_height_mm=50.0, is_symmetric=True,
        )
        assert "error" in report

    def test_worst_mode_is_valid(self, profile_ms_170x50x3, make_passes):
        p = profile_ms_170x50x3
        passes = make_passes(p)
        report = generate_deformation_prediction_report(
            passes=passes, material="MS", thickness_mm=3.0,
            section_width_mm=170.0, section_height_mm=50.0, is_symmetric=True,
        )
        assert report["worst_mode"] in ("Bow", "Camber", "Edge Wave", "Wrinkling")
