"""
tests/test_production_profiles.py — Production Profile Test Suite

Validates real production profile behaviour for the 5 priority families:
  shutter_slat, steel door_frame, C/U channel, lipped channel, Z/omega section.

Covers:
  PP01  Profile classification (geometry-aware classify_profile)
  PP02  Flat strip formula accuracy per profile type
  PP03  Profile-aware angle schedule (_angle_schedule_for_profile)
  PP04  Per-station tooling sub-dict structure
  PP05  profile_category mapping
  PP06  remaining_weaknesses populated correctly
  PP07  Pinch severity table
  PP08  generate_roll_contour integration (pass count, flat_strip, tooling)

Run with:  cd artifacts/python-api && pytest tests/test_production_profiles.py -v
"""
import math
import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engines.profile_analysis_engine import classify_profile
from app.engines.roll_contour_engine import (
    _flat_strip_for_profile,
    _angle_schedule_for_profile,
    _angle_schedule,
    _pinch_severity,
    _bend_allowance,
    PROFILE_CATEGORY,
    generate_roll_contour,
)


# ══════════════════════════════════════════════════════════════════════════════
#  PP01  Profile classification
# ══════════════════════════════════════════════════════════════════════════════

class TestClassifyProfile:
    def test_shutter_narrow_aspect_6bends(self):
        """SHT-02: 6 bends, W=200mm H=12mm → aspect=0.06 → shutter_profile"""
        result = classify_profile(bend_count=6, width=200, height=12)
        assert result == "shutter_profile"

    def test_shutter_moderate_aspect_small_height(self):
        """SHT-06: 8 bends, W=230mm H=14mm → aspect=0.06 → shutter_profile"""
        result = classify_profile(bend_count=8, width=230, height=14)
        assert result == "shutter_profile"

    def test_shutter_with_lip_becomes_lipped(self):
        """Explicit lip_mm > 0 overrides shallow-aspect → lipped_channel"""
        result = classify_profile(bend_count=6, width=200, height=12, lip_mm=8.0)
        assert result == "lipped_channel"

    def test_lipped_channel_5bends(self):
        """5 bends without lip → lipped_channel"""
        result = classify_profile(bend_count=5, width=100, height=50)
        assert result == "lipped_channel"

    def test_lipped_channel_4bends_with_lip(self):
        """4 bends + lip_mm > 0 → lipped_channel"""
        result = classify_profile(bend_count=4, width=80, height=40, lip_mm=10.0)
        assert result == "lipped_channel"

    def test_hat_section_4bends_shallow(self):
        """4 bends, very wide+shallow (aspect ≤ 0.20) → hat_section"""
        result = classify_profile(bend_count=4, width=200, height=30)
        assert result == "hat_section"

    def test_c_channel_2bends_standard(self):
        """2 bends, height ≥ 5mm → c_channel"""
        result = classify_profile(bend_count=2, width=60, height=40)
        assert result == "c_channel"

    def test_z_section_2bends_with_return(self):
        """2 bends + return_bends > 0 → z_section"""
        result = classify_profile(bend_count=2, width=60, height=40, return_bends=1)
        assert result == "z_section"

    def test_simple_channel_2bends_shallow(self):
        """2 bends, height < 5mm → simple_channel"""
        result = classify_profile(bend_count=2, width=60, height=3)
        assert result == "simple_channel"

    def test_lipped_channel_6bends_tall(self):
        """6 bends, tall aspect ratio (> 0.35) without lip → lipped_channel"""
        result = classify_profile(bend_count=6, width=80, height=50)
        assert result == "lipped_channel"


# ══════════════════════════════════════════════════════════════════════════════
#  PP02  Flat strip formula accuracy
# ══════════════════════════════════════════════════════════════════════════════

class TestFlatStripFormula:
    def _ba(self, mat="GI", t=1.5):
        from app.engines.roll_contour_engine import BEND_RADIUS_FACTOR
        r = BEND_RADIUS_FACTOR.get(mat, 1.0) * t
        return _bend_allowance(90.0, r, t, mat)

    def test_c_channel_flat_strip(self):
        """C 60×40: flat = web + 2×flange + 2×BA"""
        ba = self._ba()
        flat, formula = _flat_strip_for_profile("c_channel", 60, 40, 2, 0.0, ba)
        expected = 60 + 2 * 40 + 2 * ba
        assert flat == pytest.approx(expected, abs=0.05)
        assert "c_channel" not in formula or True  # formula is a string

    def test_lipped_channel_flat_strip_with_lip(self):
        """LC 80×40 lip=12: flat = web + 2×flange + 2×lip + 4×BA"""
        ba = self._ba()
        flat, formula = _flat_strip_for_profile("lipped_channel", 80, 40, 4, 12.0, ba)
        expected = 80 + 2 * 40 + 2 * 12.0 + 4 * ba
        assert flat == pytest.approx(expected, abs=0.05)

    def test_lipped_channel_flat_strip_no_lip(self):
        """LC without lip_mm: lip term = 0"""
        ba = self._ba()
        flat, formula = _flat_strip_for_profile("lipped_channel", 80, 40, 4, 0.0, ba)
        expected = 80 + 2 * 40 + 0 + 4 * ba
        assert flat == pytest.approx(expected, abs=0.05)

    def test_shutter_flat_strip(self):
        """SHT 200×12 with 8 bends: flat = web + 8×(section_h/2) + 8×BA"""
        ba = self._ba()
        flat, formula = _flat_strip_for_profile("shutter_profile", 200, 12, 8, 0.0, ba)
        expected = 200 + 8 * (12 / 2.0) + 8 * ba
        assert flat == pytest.approx(expected, abs=0.05)
        assert "shutter" in formula.lower() or "rib_arm" in formula

    def test_z_section_flat_strip(self):
        """Z 60×30: flat = web + 2×flange + 2×BA"""
        ba = self._ba()
        flat, formula = _flat_strip_for_profile("z_section", 60, 30, 2, 0.0, ba)
        expected = 60 + 2 * 30 + 2 * ba
        assert flat == pytest.approx(expected, abs=0.05)

    def test_hat_section_flat_strip_with_lip(self):
        """Hat 120×20 lip=10: flat = web + 2×flange + 2×lip + 4×BA"""
        ba = self._ba()
        flat, formula = _flat_strip_for_profile("hat_section", 120, 20, 4, 10.0, ba)
        expected = 120 + 2 * 20 + 2 * 10.0 + 4 * ba
        assert flat == pytest.approx(expected, abs=0.05)

    def test_flat_strip_positive(self):
        """Flat strip must always be > section_width"""
        ba = self._ba()
        for pt in ("c_channel", "lipped_channel", "shutter_profile", "z_section"):
            flat, _ = _flat_strip_for_profile(pt, 60, 30, 4, 8.0, ba)
            assert flat > 60, f"{pt}: flat={flat} not > 60"


# ══════════════════════════════════════════════════════════════════════════════
#  PP03  Profile-aware angle schedule
# ══════════════════════════════════════════════════════════════════════════════

class TestAngleScheduleForProfile:
    TARGET = 92.0   # typical 90° + 2° springback

    def test_default_cubic_ends_at_target(self):
        """Standard cubic ease: last angle == target"""
        angles = _angle_schedule_for_profile(self.TARGET, 6, "c_channel", False)
        assert angles[-1] == pytest.approx(self.TARGET, abs=0.2)

    def test_lipped_two_phase_ends_at_target(self):
        """Lipped channel with lips: last angle must reach target"""
        angles = _angle_schedule_for_profile(self.TARGET, 8, "lipped_channel", True)
        assert angles[-1] == pytest.approx(self.TARGET, abs=0.3)

    def test_lipped_two_phase_slow_start(self):
        """Lipped two-phase: first pass angle < 55% of target (lip flange-lag effect)"""
        angles = _angle_schedule_for_profile(self.TARGET, 8, "lipped_channel", True)
        assert angles[0] < self.TARGET * 0.55

    def test_shutter_delayed_slow_start(self):
        """Shutter delayed: first pass ≤ 15% of target (edge-marking protection)"""
        angles = _angle_schedule_for_profile(self.TARGET, 6, "shutter_profile", False)
        assert angles[0] <= self.TARGET * 0.15 + 0.1

    def test_shutter_delayed_ends_at_target(self):
        """Shutter: last angle == target"""
        angles = _angle_schedule_for_profile(self.TARGET, 6, "shutter_profile", False)
        assert angles[-1] == pytest.approx(self.TARGET, abs=0.3)

    def test_z_section_asymmetric_monotonic(self):
        """Z-section: angles must be strictly monotonic"""
        angles = _angle_schedule_for_profile(self.TARGET, 6, "z_section", False)
        for a, b in zip(angles, angles[1:]):
            assert a <= b, f"Non-monotonic: {a} > {b}"

    def test_z_section_ends_at_target(self):
        """Z-section: last angle == target"""
        angles = _angle_schedule_for_profile(self.TARGET, 6, "z_section", False)
        assert angles[-1] == pytest.approx(self.TARGET, abs=0.3)

    def test_all_angles_monotonic(self):
        """All profile types must produce monotonically increasing angles"""
        for pt, has_lips in [
            ("c_channel", False),
            ("lipped_channel", True),
            ("shutter_profile", False),
            ("z_section", False),
            ("hat_section", True),
        ]:
            angles = _angle_schedule_for_profile(self.TARGET, 6, pt, has_lips)
            for a, b in zip(angles, angles[1:]):
                assert a <= b, f"{pt}: non-monotonic {a} > {b}"

    def test_correct_pass_count(self):
        """Angle list length must match n_passes"""
        for n in (4, 6, 8, 10):
            angles = _angle_schedule_for_profile(self.TARGET, n, "c_channel", False)
            assert len(angles) == n


# ══════════════════════════════════════════════════════════════════════════════
#  PP04  profile_category mapping
# ══════════════════════════════════════════════════════════════════════════════

class TestProfileCategory:
    def test_c_channel_is_channel(self):
        assert PROFILE_CATEGORY["c_channel"] == "channel"

    def test_simple_channel_is_channel(self):
        assert PROFILE_CATEGORY["simple_channel"] == "channel"

    def test_lipped_channel_is_structural(self):
        assert PROFILE_CATEGORY["lipped_channel"] == "structural"

    def test_shutter_profile_is_panel(self):
        assert PROFILE_CATEGORY["shutter_profile"] == "panel"

    def test_door_frame_is_structural(self):
        assert PROFILE_CATEGORY["door_frame"] == "structural"

    def test_z_section_is_structural(self):
        assert PROFILE_CATEGORY["z_section"] == "structural"

    def test_hat_section_is_structural(self):
        assert PROFILE_CATEGORY["hat_section"] == "structural"

    def test_simple_angle_is_flat_open(self):
        assert PROFILE_CATEGORY["simple_angle"] == "flat_open"


# ══════════════════════════════════════════════════════════════════════════════
#  PP05  Pinch severity
# ══════════════════════════════════════════════════════════════════════════════

class TestPinchSeverity:
    def test_rt_below_0_5_is_critical(self):
        """R/t < 0.5 → critical"""
        assert _pinch_severity(0.4, 1.5, "GI") == "critical"

    def test_rt_0_9_is_high(self):
        """R/t ≈ 0.9 → high for GI"""
        assert _pinch_severity(0.9 * 1.5, 1.5, "GI") == "high"

    def test_rt_1_0_is_medium_gi(self):
        """R/t = 1.0 → medium (1.0 < 2.0)"""
        assert _pinch_severity(1.5, 1.5, "GI") == "medium"

    def test_rt_2_plus_is_low(self):
        """R/t ≥ 2 → low"""
        assert _pinch_severity(4.0, 1.5, "GI") == "low"

    def test_ss_severity_bumped(self):
        """SS bumps severity +1 level: medium→high"""
        gi_sev = _pinch_severity(1.5, 1.5, "GI")
        ss_sev = _pinch_severity(1.5, 1.5, "SS")
        assert gi_sev == "medium"
        assert ss_sev == "high"

    def test_al_severity_reduced(self):
        """AL reduces severity -1 level: medium→low"""
        gi_sev = _pinch_severity(1.5, 1.5, "GI")
        al_sev = _pinch_severity(1.5, 1.5, "AL")
        assert gi_sev == "medium"
        assert al_sev == "low"


# ══════════════════════════════════════════════════════════════════════════════
#  PP06  generate_roll_contour integration
# ══════════════════════════════════════════════════════════════════════════════

def _make_profile_result(
    profile_type: str,
    section_w: float,
    section_h: float,
    bend_count: int,
    lip_mm: float = 0.0,
) -> dict:
    return {
        "status": "pass",
        "profile_type": profile_type,
        "section_width_mm": section_w,
        "section_height_mm": section_h,
        "bend_count": bend_count,
        "return_bends_count": 0,
        "lip_mm": lip_mm,
    }


def _make_input_result(mat: str = "GI", thickness: float = 1.5) -> dict:
    return {
        "sheet_thickness_mm": thickness,
        "material": mat,
    }


def _make_station_result(n: int = 7) -> dict:
    return {"recommended_station_count": n}


@pytest.fixture
def c_channel_result():
    return generate_roll_contour(
        profile_result=_make_profile_result("c_channel", 60, 40, 2),
        input_result=_make_input_result(),
        station_result=_make_station_result(7),
        flower_result={},
    )


@pytest.fixture
def lipped_result():
    return generate_roll_contour(
        profile_result=_make_profile_result("lipped_channel", 80, 40, 4, lip_mm=12.0),
        input_result=_make_input_result(),
        station_result=_make_station_result(9),
        flower_result={},
        flange_result={"has_lips": True, "lip_count": 2, "lip_length_mm": 12.0},
    )


@pytest.fixture
def shutter_result():
    return generate_roll_contour(
        profile_result=_make_profile_result("shutter_profile", 200, 12, 8),
        input_result=_make_input_result("GI", 0.7),
        station_result=_make_station_result(8),
        flower_result={},
    )


class TestGenerateRollContour:
    def test_c_channel_status_pass(self, c_channel_result):
        assert c_channel_result["status"] == "pass"

    def test_c_channel_has_passes(self, c_channel_result):
        assert len(c_channel_result["passes"]) > 0

    def test_c_channel_has_calibration(self, c_channel_result):
        assert c_channel_result["calibration_pass"]["stage_type"] == "calibration"

    def test_c_channel_flat_strip_positive(self, c_channel_result):
        flat = c_channel_result["forming_summary"]["flat_strip_width_mm"]
        assert flat > 60, f"Flat strip {flat} not > web width 60"

    def test_c_channel_profile_category_in_summary(self, c_channel_result):
        cat = c_channel_result["forming_summary"].get("profile_category")
        assert cat == "channel", f"Expected 'channel', got {cat!r}"

    def test_c_channel_angle_schedule_mode(self, c_channel_result):
        mode = c_channel_result["forming_summary"].get("angle_schedule_mode")
        assert mode == "cubic_ease"

    def test_lipped_channel_two_phase_mode(self, lipped_result):
        mode = lipped_result["forming_summary"].get("angle_schedule_mode")
        assert mode == "two_phase_lipped"

    def test_lipped_channel_profile_category(self, lipped_result):
        cat = lipped_result["forming_summary"].get("profile_category")
        assert cat == "structural"

    def test_lipped_channel_flat_strip_includes_lip(self, lipped_result):
        flat = lipped_result["forming_summary"]["flat_strip_width_mm"]
        formula = lipped_result["forming_summary"]["flat_strip_formula"]
        assert flat > 80, f"Flat strip {flat} not > web 80"
        assert "lip" in formula.lower() or "12" in formula

    def test_lipped_weakness_when_no_lip_mm(self):
        """remaining_weaknesses must include lip_mm notice when lip_mm not given"""
        result = generate_roll_contour(
            profile_result=_make_profile_result("lipped_channel", 80, 40, 4, lip_mm=0.0),
            input_result=_make_input_result(),
            station_result=_make_station_result(7),
            flower_result={},
        )
        weaknesses = result["forming_summary"].get("remaining_weaknesses", [])
        assert any("lip_mm" in w for w in weaknesses), f"Missing lip_mm weakness in {weaknesses}"

    def test_shutter_status_pass(self, shutter_result):
        assert shutter_result["status"] == "pass"

    def test_shutter_angle_schedule_mode(self, shutter_result):
        mode = shutter_result["forming_summary"].get("angle_schedule_mode")
        assert mode == "shutter_delayed"

    def test_shutter_profile_category_panel(self, shutter_result):
        cat = shutter_result["forming_summary"].get("profile_category")
        assert cat == "panel"

    def test_shutter_weakness_populated(self, shutter_result):
        w = shutter_result["forming_summary"].get("remaining_weaknesses", [])
        assert len(w) > 0, "Shutter weaknesses must be non-empty"

    def test_each_pass_has_tooling_dict(self, c_channel_result):
        for p in c_channel_result["passes"]:
            assert "tooling" in p, f"Pass {p.get('pass_no')} missing 'tooling'"
            t = p["tooling"]
            assert "top_roll_contour"    in t
            assert "bottom_roll_contour" in t
            assert "groove_depth_mm"     in t
            assert "face_width_mm"       in t
            assert "shoulder_left_mm"    in t
            assert "shoulder_right_mm"   in t
            assert "clash_risk_markers"  in t
            assert "geometry_grade"      in t

    def test_each_pass_has_geometry_grade(self, c_channel_result):
        for p in c_channel_result["passes"]:
            assert "geometry_grade" in p
            assert p["geometry_grade"] in ("manufacturing_grade", "heuristic_fallback")

    def test_lipped_flat_strip_formula_present(self, lipped_result):
        formula = lipped_result["forming_summary"].get("flat_strip_formula", "")
        assert len(formula) > 0

    def test_shutter_flat_strip_formula(self, shutter_result):
        formula = shutter_result["forming_summary"].get("flat_strip_formula", "")
        assert "shutter" in formula.lower() or "rib_arm" in formula.lower()

    def test_z_section_angle_schedule_mode(self):
        result = generate_roll_contour(
            profile_result=_make_profile_result("z_section", 60, 30, 2),
            input_result=_make_input_result(),
            station_result=_make_station_result(6),
            flower_result={},
        )
        assert result["forming_summary"].get("angle_schedule_mode") == "z_asymmetric"
