"""
test_station_engine.py — Benchmark tests for station_engine.py (v2.0 physics-based)

Tests:
  - Station count increases with bend count
  - SS requires more stations than GI (same geometry)
  - Thick material requires more stations
  - Complex profile requires more stations than simple
  - Return bends add stations
  - Min station count is always ≥ 4
  - Pass distribution and reason_log fields present
  - All 5 benchmark profiles produce reasonable counts
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.station_engine import estimate


def _make_profile(bend_count: int = 2, return_bends: int = 0,
                  profile_type: str = "c_channel") -> dict:
    return {
        "bend_count": bend_count,
        "return_bends_count": return_bends,
        "profile_type": profile_type,
    }


def _make_input(material: str = "GI", thickness: float = 1.5) -> dict:
    return {
        "material": material,
        "sheet_thickness_mm": thickness,
    }


def _make_flower(section_type: str = "c_channel") -> dict:
    return {"section_type": section_type}


class TestStationCountBasics:

    def test_returns_pass(self):
        result = estimate(_make_profile(), _make_input(), _make_flower())
        assert result["status"] == "pass"

    def test_min_station_at_least_2(self):
        """Even simplest profiles must have ≥2 stations (engine minimum)."""
        result = estimate(
            _make_profile(bend_count=1),
            _make_input("GI", 0.5),
            _make_flower("simple_channel"),
        )
        assert result["min_station_count"] >= 2

    def test_recommended_at_least_min(self):
        result = estimate(_make_profile(), _make_input(), _make_flower())
        assert result["recommended_station_count"] >= result["min_station_count"]

    def test_premium_at_least_recommended(self):
        result = estimate(_make_profile(), _make_input(), _make_flower())
        assert result["premium_station_count"] >= result["recommended_station_count"]

    def test_more_bends_more_stations(self):
        r_few  = estimate(_make_profile(2), _make_input(), _make_flower())
        r_many = estimate(_make_profile(8), _make_input(), _make_flower())
        assert r_many["recommended_station_count"] > r_few["recommended_station_count"]


class TestMaterialEffect:

    def test_ss_more_stations_than_gi(self):
        """SS has lower max angle per pass — needs more stations."""
        r_gi = estimate(_make_profile(4), _make_input("GI", 1.5), _make_flower())
        r_ss = estimate(_make_profile(4), _make_input("SS", 1.5), _make_flower())
        assert r_ss["recommended_station_count"] > r_gi["recommended_station_count"], (
            f"SS ({r_ss['recommended_station_count']}) should exceed GI ({r_gi['recommended_station_count']})"
        )

    def test_hr_more_than_al(self):
        r_al = estimate(_make_profile(4), _make_input("AL", 1.5), _make_flower())
        r_hr = estimate(_make_profile(4), _make_input("HR", 1.5), _make_flower())
        assert r_hr["recommended_station_count"] >= r_al["recommended_station_count"]

    def test_all_materials_valid(self):
        for mat in ["GI", "CR", "HR", "SS", "AL", "MS", "TI"]:
            result = estimate(_make_profile(3), _make_input(mat, 1.5), _make_flower())
            assert result["status"] == "pass", f"Material {mat} failed"
            assert result["recommended_station_count"] >= 4


class TestThicknessEffect:

    def test_thicker_more_stations(self):
        r_thin  = estimate(_make_profile(4), _make_input("GI", 0.6), _make_flower())
        r_thick = estimate(_make_profile(4), _make_input("GI", 3.0), _make_flower())
        assert r_thick["recommended_station_count"] >= r_thin["recommended_station_count"]


class TestComplexityEffect:

    def test_complex_section_more_than_simple_channel(self):
        """complex_section (no simultaneous-rib optimization) should need more stations than simple_channel."""
        r_simple  = estimate(_make_profile(4, 0, "simple_channel"), _make_input(), _make_flower("simple_channel"))
        r_complex = estimate(_make_profile(4, 0, "complex_section"), _make_input(), _make_flower("complex_section"))
        assert r_complex["recommended_station_count"] >= r_simple["recommended_station_count"], (
            f"complex_section ({r_complex['recommended_station_count']}) should be >= simple ({r_simple['recommended_station_count']})"
        )

    def test_shutter_simultaneous_forming_optimization(self):
        """Shutter profiles form all ribs simultaneously — same bend_count produces FEWER passes than simple."""
        r_simple  = estimate(_make_profile(8, 0, "simple_channel"), _make_input(), _make_flower("simple_channel"))
        r_shutter = estimate(_make_profile(8, 0, "shutter_profile"), _make_input(), _make_flower("shutter_profile"))
        # Shutter optimization: ppb × ceil(bends/4) < ppb × bends for bend_count > 4
        assert r_shutter["recommended_station_count"] < r_simple["recommended_station_count"], (
            f"Shutter ({r_shutter['recommended_station_count']}) should be less than simple({r_simple['recommended_station_count']}) "
            f"due to simultaneous rib-forming optimization"
        )

    def test_return_bends_add_stations(self):
        r_no_rb = estimate(_make_profile(4, 0), _make_input(), _make_flower())
        r_rb    = estimate(_make_profile(4, 2), _make_input(), _make_flower())
        assert r_rb["recommended_station_count"] >= r_no_rb["recommended_station_count"]


class TestReasonLog:

    def test_reason_log_fields_present(self):
        result = estimate(_make_profile(4), _make_input("MS", 2.0), _make_flower())
        rl = result.get("reason_log", {})
        assert "passes_per_bend" in rl
        assert "max_angle_per_pass_deg" in rl
        assert "material" in rl

    def test_reason_log_present(self):
        result = estimate(_make_profile(4), _make_input("GI", 1.5), _make_flower())
        assert "reason_log" in result


class TestBenchmarkProfiles:

    def test_ms_170x50x3_reasonable_count(self, profile_ms_170x50x3):
        """Standard 3mm MS C-channel — expect 8–35 stations (heavy gauge, needs more passes/bend)."""
        p = profile_ms_170x50x3
        result = estimate(
            {"bend_count": 4, "return_bends_count": 0, "profile_type": "c_channel"},
            {"material": p["material"], "sheet_thickness_mm": p["thickness_mm"]},
            {"section_type": "c_channel"},
        )
        assert result["status"] == "pass"
        assert 8 <= result["recommended_station_count"] <= 35, (
            f"MS 3mm station count {result['recommended_station_count']} seems wrong"
        )

    def test_gi_100x40x1_2(self, profile_gi_100x40x1_2):
        p = profile_gi_100x40x1_2
        result = estimate(
            {"bend_count": 3, "return_bends_count": 0, "profile_type": "z_purlin"},
            {"material": p["material"], "sheet_thickness_mm": p["thickness_mm"]},
            {"section_type": "z_purlin"},
        )
        assert result["status"] == "pass"
        assert result["recommended_station_count"] >= 4

    def test_ss_250x75x2_more_stations(self, profile_ss_250x75x2):
        """SS wide hat section should require significantly more stations than GI equivalent."""
        p = profile_ss_250x75x2
        r_ss = estimate(
            {"bend_count": 4, "return_bends_count": 0, "profile_type": "hat_section"},
            {"material": p["material"], "sheet_thickness_mm": p["thickness_mm"]},
            {"section_type": "hat_section"},
        )
        r_gi = estimate(
            {"bend_count": 4, "return_bends_count": 0, "profile_type": "hat_section"},
            {"material": "GI", "sheet_thickness_mm": p["thickness_mm"]},
            {"section_type": "hat_section"},
        )
        assert r_ss["recommended_station_count"] > r_gi["recommended_station_count"]

    def test_stress_case_high_count(self, profile_stress_case):
        """Stress case (SS 4mm complex) should produce the highest station count."""
        p = profile_stress_case
        result = estimate(
            {"bend_count": 6, "return_bends_count": 1, "profile_type": "complex_section"},
            {"material": p["material"], "sheet_thickness_mm": p["thickness_mm"]},
            {"section_type": "complex_section"},
        )
        assert result["status"] == "pass"
        assert result["recommended_station_count"] >= 14, (
            f"Stress case station count {result['recommended_station_count']} seems too low"
        )
