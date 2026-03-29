"""
tests/test_production_profiles.py — Production Profile Test Suite v2

Validates the four mandated production profile families:
  1. GI shutter slat   — 8-rib, 1.2mm
  2. MS door frame     — 2.0mm, 4-bend with return lips
  3. C-channel 60×40   — GI 1.5mm (standard)
  4. Lipped channel    — SS 1.0mm with 15mm lips

Test sections:
  PP01  Profile classification (taxonomy contract)
  PP02  Flat strip formula accuracy per profile type
  PP03  Profile-aware angle schedule (_angle_schedule_for_profile)
  PP04  profile_category mapping
  PP05  Pinch severity with pressure-angle component
  PP06  generate_roll_contour integration — 4-profile acceptance tests
  PP07  Per-station tooling sub-dict structure
  PP08  bend_groups[] in forming_summary
  PP09  Contact strips count per profile type

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
    _per_station_k_factor,
    PROFILE_CATEGORY,
    generate_roll_contour,
    compute_groove_geometry,
    BEND_RADIUS_FACTOR,
)

try:
    from shapely.geometry import Polygon
    from app.engines.flower_svg_engine import section_centerline, centerline_to_polygon
    SHAPELY_OK = True
except ImportError:
    SHAPELY_OK = False


# ══════════════════════════════════════════════════════════════════════════════
#  Helpers
# ══════════════════════════════════════════════════════════════════════════════

def _ba(mat="GI", t=1.5):
    r = BEND_RADIUS_FACTOR.get(mat, 1.0) * t
    return _bend_allowance(90.0, r, t, mat)


def _make_profile_result(
    profile_type: str,
    section_w: float,
    section_h: float,
    bend_count: int,
    lip_mm: float = 0.0,
    return_bends: int = 0,
) -> dict:
    return {
        "status": "pass",
        "profile_type": profile_type,
        "section_width_mm": section_w,
        "section_height_mm": section_h,
        "bend_count": bend_count,
        "return_bends_count": return_bends,
        "lip_mm": lip_mm,
    }


def _make_input_result(mat: str = "GI", thickness: float = 1.5) -> dict:
    return {"sheet_thickness_mm": thickness, "material": mat}


def _make_station_result(n: int = 7) -> dict:
    return {"recommended_station_count": n}


# ══════════════════════════════════════════════════════════════════════════════
#  PP01  Profile classification — taxonomy contract
# ══════════════════════════════════════════════════════════════════════════════

class TestClassifyProfile:
    def test_shutter_slat_narrow_6bends(self):
        """6 bends, W=200 H=12 (aspect=0.06) → shutter_slat"""
        assert classify_profile(6, 200, 12) == "shutter_slat"

    def test_shutter_slat_8bends_shallow(self):
        """8 bends, W=230 H=14 → shutter_slat"""
        assert classify_profile(8, 230, 14) == "shutter_slat"

    def test_shutter_slat_explicit_lip_overrides_to_lipped(self):
        """lip_mm > 0 overrides shallow-aspect: shutter → lipped_channel"""
        assert classify_profile(6, 200, 12, lip_mm=8.0) == "lipped_channel"

    def test_door_frame_4bends_with_return(self):
        """4 bends + return_bends=2 (no lip) → door_frame"""
        assert classify_profile(4, 80, 60, return_bends=2) == "door_frame"

    def test_lipped_channel_4bends_with_lip(self):
        """4 bends + lip_mm > 0 → lipped_channel (not door_frame)"""
        assert classify_profile(4, 80, 40, lip_mm=15.0) == "lipped_channel"

    def test_lipped_channel_5bends(self):
        """5 bends without lip → lipped_channel"""
        assert classify_profile(5, 100, 50) == "lipped_channel"

    def test_hat_section_4bends_shallow(self):
        """4 bends, very wide (aspect ≤ 0.20) → hat_section"""
        assert classify_profile(4, 200, 30) == "hat_section"

    def test_u_channel_wide_web_2bends(self):
        """2 bends, W=120 H=40 (aspect=0.33 ≤ 0.50, W ≥ 60) → u_channel"""
        assert classify_profile(2, 120, 40) == "u_channel"

    def test_c_channel_narrow_aspect_2bends(self):
        """2 bends, W=40 H=60 (aspect=1.5 > 0.50) → c_channel"""
        assert classify_profile(2, 40, 60) == "c_channel"

    def test_z_section_2bends_with_return(self):
        """2 bends + return_bends=1 → z_section"""
        assert classify_profile(2, 60, 40, return_bends=1) == "z_section"

    def test_simple_channel_shallow(self):
        """2 bends, height < 5mm → simple_channel"""
        assert classify_profile(2, 60, 3) == "simple_channel"

    def test_simple_angle_1bend(self):
        """1 bend → simple_angle"""
        assert classify_profile(1, 60, 30) == "simple_angle"

    def test_lipped_channel_6bends_tall(self):
        """6 bends, aspect > 0.35 → lipped_channel (not shutter)"""
        assert classify_profile(6, 80, 50) == "lipped_channel"


# ══════════════════════════════════════════════════════════════════════════════
#  PP02  Flat strip formula accuracy
# ══════════════════════════════════════════════════════════════════════════════

class TestFlatStripFormula:
    def test_c_channel_flat_strip_gi_1_5mm(self):
        """C 60×40 GI 1.5mm: flat = 60 + 2×40 + 2×BA, within ±1mm of manual calc"""
        ba = _ba("GI", 1.5)
        flat, _ = _flat_strip_for_profile("c_channel", 60, 40, 2, 0.0, ba)
        expected = 60 + 2 * 40 + 2 * ba
        assert flat == pytest.approx(expected, abs=0.05)

    def test_u_channel_same_formula_as_c_channel(self):
        """u_channel uses same formula as c_channel"""
        ba = _ba("GI", 1.5)
        flat_c, _ = _flat_strip_for_profile("c_channel", 100, 30, 2, 0.0, ba)
        flat_u, _ = _flat_strip_for_profile("u_channel", 100, 30, 2, 0.0, ba)
        assert flat_c == flat_u

    def test_lipped_channel_flat_strip_ss_1mm_15mm_lips(self):
        """LC SS 1.0mm 80×40 lip=15: flat = web + 2×flange + 2×lip + 4×BA"""
        ba = _ba("SS", 1.0)
        flat, formula = _flat_strip_for_profile("lipped_channel", 80, 40, 4, 15.0, ba)
        expected = 80 + 2 * 40 + 2 * 15.0 + 4 * ba
        assert flat == pytest.approx(expected, abs=0.05)
        assert "lip" in formula.lower()

    def test_shutter_slat_flat_strip_gi_1_2mm(self):
        """SHT GI 1.2mm 200×12 8 bends: flat = 200 + 8×(12/2) + 8×BA"""
        ba = _ba("GI", 1.2)
        flat, formula = _flat_strip_for_profile("shutter_slat", 200, 12, 8, 0.0, ba)
        expected = 200 + 8 * (12 / 2.0) + 8 * ba
        assert flat == pytest.approx(expected, abs=0.05)
        assert "shutter" in formula.lower() or "rib_arm" in formula.lower()

    def test_door_frame_flat_strip_ms_2mm(self):
        """Door frame MS 2.0mm 80×60 4bends return_lip=15mm:
           flat = web + 2×flange + 2×return_lip + 4×BA"""
        ba = _ba("MS", 2.0)
        flat, formula = _flat_strip_for_profile("door_frame", 80, 60, 4, 15.0, ba)
        expected = 80 + 2 * 60 + 2 * 15.0 + 4 * ba
        assert flat == pytest.approx(expected, abs=0.05)
        assert "door_frame" in formula.lower() or "return_lip" in formula.lower()

    def test_flat_strip_greater_than_web_all_profiles(self):
        """Flat strip must be > section_width for all profile types"""
        ba = _ba()
        for pt in ("c_channel", "u_channel", "lipped_channel", "shutter_slat",
                   "door_frame", "z_section", "hat_section"):
            flat, _ = _flat_strip_for_profile(pt, 60, 30, 4, 10.0, ba)
            assert flat > 60, f"{pt}: flat={flat} not > 60mm"

    def test_flat_strip_within_1mm_c_channel_manual_calc(self):
        """GI 1.5mm C 60×40: flat within ±1mm of 60+80+2×BA (Machinery's Handbook)"""
        t = 1.5
        r = BEND_RADIUS_FACTOR["GI"] * t   # 1.5mm
        k = _per_station_k_factor(r, t, "GI")
        ba = (math.pi / 2) * (r + k * t)
        flat, _ = _flat_strip_for_profile("c_channel", 60, 40, 2, 0.0, ba)
        manual = 60 + 80 + 2 * ba
        assert flat == pytest.approx(manual, abs=1.0), \
            f"Flat strip {flat:.2f} not within 1mm of manual {manual:.2f}"


# ══════════════════════════════════════════════════════════════════════════════
#  PP03  Profile-aware angle schedule
# ══════════════════════════════════════════════════════════════════════════════

class TestAngleScheduleForProfile:
    TARGET = 92.0   # 90° + 2° springback

    def test_all_schedules_monotonic(self):
        """All profile types must produce strictly non-decreasing angles"""
        configs = [
            ("c_channel", False),
            ("u_channel", False),
            ("lipped_channel", True),
            ("shutter_slat", False),
            ("door_frame", True),
            ("z_section", False),
            ("hat_section", True),
        ]
        for pt, has_lips in configs:
            angles = _angle_schedule_for_profile(self.TARGET, 8, pt, has_lips)
            for a, b in zip(angles, angles[1:]):
                assert a <= b, f"{pt}: non-monotonic {a} > {b}"

    def test_all_schedules_end_at_target(self):
        """Last angle must reach target for all profile types"""
        configs = [
            ("c_channel", False), ("u_channel", False),
            ("lipped_channel", True), ("shutter_slat", False),
            ("door_frame", True), ("z_section", False),
        ]
        for pt, has_lips in configs:
            angles = _angle_schedule_for_profile(self.TARGET, 8, pt, has_lips)
            assert angles[-1] == pytest.approx(self.TARGET, abs=0.3), \
                f"{pt}: last angle {angles[-1]} ≠ target {self.TARGET}"

    def test_shutter_slat_slow_start(self):
        """Shutter slat: first pass ≤ 30% of target (outer-rib-first forming)"""
        angles = _angle_schedule_for_profile(self.TARGET, 8, "shutter_slat", False)
        assert angles[0] <= self.TARGET * 0.30 + 0.5

    def test_lipped_channel_two_phase_early_angles_below_60pct(self):
        """Lipped channel: first pass < 60% of target (flange-lag before lips)"""
        angles = _angle_schedule_for_profile(self.TARGET, 8, "lipped_channel", True)
        assert angles[0] < self.TARGET * 0.60

    def test_door_frame_two_phase_early_angles_below_60pct(self):
        """Door frame: first pass < 60% of target (flange-first forming)"""
        angles = _angle_schedule_for_profile(self.TARGET, 8, "door_frame", True)
        assert angles[0] < self.TARGET * 0.60

    def test_pass_count_matches_n_passes(self):
        """Angle list length must match n_passes for all types"""
        for n in (4, 6, 8, 10):
            for pt in ("c_channel", "shutter_slat", "lipped_channel"):
                angles = _angle_schedule_for_profile(self.TARGET, n, pt, True)
                assert len(angles) == n, f"{pt} n={n}: got {len(angles)} angles"


# ══════════════════════════════════════════════════════════════════════════════
#  PP04  profile_category mapping
# ══════════════════════════════════════════════════════════════════════════════

class TestProfileCategory:
    def test_c_channel_channel(self):
        assert PROFILE_CATEGORY["c_channel"] == "channel"

    def test_u_channel_channel(self):
        assert PROFILE_CATEGORY["u_channel"] == "channel"

    def test_simple_channel_channel(self):
        assert PROFILE_CATEGORY["simple_channel"] == "channel"

    def test_lipped_channel_structural(self):
        assert PROFILE_CATEGORY["lipped_channel"] == "structural"

    def test_shutter_slat_panel(self):
        assert PROFILE_CATEGORY["shutter_slat"] == "panel"

    def test_door_frame_structural(self):
        assert PROFILE_CATEGORY["door_frame"] == "structural"

    def test_z_section_structural(self):
        assert PROFILE_CATEGORY["z_section"] == "structural"

    def test_hat_section_structural(self):
        assert PROFILE_CATEGORY["hat_section"] == "structural"

    def test_simple_angle_flat_open(self):
        assert PROFILE_CATEGORY["simple_angle"] == "flat_open"


# ══════════════════════════════════════════════════════════════════════════════
#  PP05  Pinch severity with pressure-angle component
# ══════════════════════════════════════════════════════════════════════════════

class TestPinchSeverity:
    def test_rt_below_0_5_critical(self):
        assert _pinch_severity(0.4, 1.5, "GI") == "critical"

    def test_rt_0_9_high_gi(self):
        """R/t ≈ 0.9 (< 1.0) → high for GI"""
        assert _pinch_severity(0.9 * 1.5, 1.5, "GI") == "high"

    def test_rt_1_0_medium_gi(self):
        """R/t = 1.0 (1.0 < 2.0) → medium for GI"""
        assert _pinch_severity(1.5, 1.5, "GI") == "medium"

    def test_rt_2_plus_low(self):
        assert _pinch_severity(4.0, 1.5, "GI") == "low"

    def test_ss_bumps_severity(self):
        """SS bumps +1 level: medium→high"""
        gi = _pinch_severity(1.5, 1.5, "GI")
        ss = _pinch_severity(1.5, 1.5, "SS")
        assert gi == "medium"
        assert ss == "high"

    def test_al_reduces_severity(self):
        """AL reduces -1 level: medium→low"""
        gi = _pinch_severity(1.5, 1.5, "GI")
        al = _pinch_severity(1.5, 1.5, "AL")
        assert gi == "medium"
        assert al == "low"

    def test_high_pressure_angle_bumps_severity(self):
        """pressure_angle_deg > 60° bumps severity +1"""
        low_pa = _pinch_severity(4.0, 1.5, "GI", pressure_angle_deg=20.0)
        high_pa = _pinch_severity(4.0, 1.5, "GI", pressure_angle_deg=65.0)
        severity_levels = ["low", "medium", "high", "critical"]
        assert severity_levels.index(high_pa) > severity_levels.index(low_pa)

    def test_low_pressure_angle_reduces_severity(self):
        """pressure_angle_deg ≤ 30° reduces severity -1"""
        no_pa = _pinch_severity(1.5, 1.5, "GI", pressure_angle_deg=0.0)
        low_pa = _pinch_severity(1.5, 1.5, "GI", pressure_angle_deg=25.0)
        severity_levels = ["low", "medium", "high", "critical"]
        assert severity_levels.index(low_pa) <= severity_levels.index(no_pa)

    def test_shutter_standard_rt_not_critical(self):
        """GI 1.2mm shutter, R/t=1.0 → not critical (medium or below with pressure angle)"""
        sev = _pinch_severity(1.2, 1.2, "GI", pressure_angle_deg=55.0)
        assert sev != "critical", f"Expected non-critical, got {sev}"


# ══════════════════════════════════════════════════════════════════════════════
#  PP06  generate_roll_contour — 4-profile acceptance tests
# ══════════════════════════════════════════════════════════════════════════════

# ── Profile 1: GI shutter slat 8-rib 1.2mm ──────────────────────────────────
@pytest.fixture(scope="module")
def shutter_slat_result():
    return generate_roll_contour(
        profile_result=_make_profile_result("shutter_slat", 200, 12, 8),
        input_result=_make_input_result("GI", 1.2),
        station_result=_make_station_result(8),
        flower_result={},
    )


# ── Profile 2: MS door frame 2.0mm 4-bend ───────────────────────────────────
@pytest.fixture(scope="module")
def door_frame_result():
    return generate_roll_contour(
        profile_result=_make_profile_result("door_frame", 80, 60, 4, lip_mm=15.0, return_bends=2),
        input_result=_make_input_result("MS", 2.0),
        station_result=_make_station_result(7),
        flower_result={},
        flange_result={"has_lips": False, "lip_count": 0, "lip_length_mm": 0},
    )


# ── Profile 3: C-channel 60×40 GI 1.5mm ─────────────────────────────────────
@pytest.fixture(scope="module")
def c_channel_result():
    return generate_roll_contour(
        profile_result=_make_profile_result("c_channel", 60, 40, 2),
        input_result=_make_input_result("GI", 1.5),
        station_result=_make_station_result(7),
        flower_result={},
    )


# ── Profile 4: Lipped channel SS 1.0mm lip=15mm ─────────────────────────────
@pytest.fixture(scope="module")
def lipped_ss_result():
    return generate_roll_contour(
        profile_result=_make_profile_result("lipped_channel", 80, 40, 4, lip_mm=15.0),
        input_result=_make_input_result("SS", 1.0),
        station_result=_make_station_result(9),
        flower_result={},
        flange_result={"has_lips": True, "lip_count": 2, "lip_length_mm": 15.0},
    )


class TestFourProfileAcceptance:
    # ── Shutter slat ─────────────────────────────────────────────────────────
    def test_shutter_slat_status_pass(self, shutter_slat_result):
        assert shutter_slat_result["status"] == "pass"

    def test_shutter_slat_no_interference_clash(self, shutter_slat_result):
        clashes = shutter_slat_result["interference_summary"]["clash_count"]
        assert clashes == 0, f"Shutter slat has {clashes} interference clashes"

    def test_shutter_slat_profile_category_panel(self, shutter_slat_result):
        assert shutter_slat_result["forming_summary"]["profile_category"] == "panel"

    def test_shutter_slat_flat_strip_within_1mm(self, shutter_slat_result):
        """Flat strip within ±1mm of manual: 200 + 8×(12/2) + 8×BA"""
        t = 1.2
        r = BEND_RADIUS_FACTOR["GI"] * t
        ba = _bend_allowance(90.0, r, t, "GI")
        manual = 200 + 8 * 6.0 + 8 * ba
        flat = shutter_slat_result["forming_summary"]["flat_strip_width_mm"]
        assert flat == pytest.approx(manual, abs=1.0), \
            f"Flat strip {flat:.2f} vs manual {manual:.2f}"

    def test_shutter_slat_angle_schedule_shutter_delayed(self, shutter_slat_result):
        assert shutter_slat_result["forming_summary"]["angle_schedule_mode"] == "shutter_delayed"

    def test_shutter_slat_bend_groups_has_rib_arms(self, shutter_slat_result):
        groups = shutter_slat_result["forming_summary"]["bend_groups"]
        group_ids = [g["group_id"] for g in groups]
        assert "rib_arms" in group_ids, f"Missing rib_arms group: {group_ids}"

    # ── Door frame ───────────────────────────────────────────────────────────
    def test_door_frame_status_pass(self, door_frame_result):
        assert door_frame_result["status"] == "pass"

    def test_door_frame_no_interference_clash(self, door_frame_result):
        clashes = door_frame_result["interference_summary"]["clash_count"]
        assert clashes == 0, f"Door frame has {clashes} interference clashes"

    def test_door_frame_profile_category_structural(self, door_frame_result):
        assert door_frame_result["forming_summary"]["profile_category"] == "structural"

    def test_door_frame_flat_strip_within_1mm(self, door_frame_result):
        """Door frame MS 2.0mm 80×60 lip=15: flat = 80+2×60+2×15+4×BA"""
        t = 2.0
        r = BEND_RADIUS_FACTOR["MS"] * t
        ba = _bend_allowance(90.0, r, t, "MS")
        manual = 80 + 2 * 60 + 2 * 15.0 + 4 * ba
        flat = door_frame_result["forming_summary"]["flat_strip_width_mm"]
        assert flat == pytest.approx(manual, abs=1.0), \
            f"Flat strip {flat:.2f} vs manual {manual:.2f}"

    def test_door_frame_angle_schedule_two_phase(self, door_frame_result):
        assert door_frame_result["forming_summary"]["angle_schedule_mode"] == "two_phase_lipped"

    def test_door_frame_bend_groups_has_flange(self, door_frame_result):
        groups = door_frame_result["forming_summary"]["bend_groups"]
        group_ids = [g["group_id"] for g in groups]
        assert "flange" in group_ids or "rib_arms" in group_ids, \
            f"Missing flange group: {group_ids}"

    # ── C-channel ────────────────────────────────────────────────────────────
    def test_c_channel_status_pass(self, c_channel_result):
        assert c_channel_result["status"] == "pass"

    def test_c_channel_no_interference_clash(self, c_channel_result):
        clashes = c_channel_result["interference_summary"]["clash_count"]
        assert clashes == 0, f"C-channel has {clashes} interference clashes"

    def test_c_channel_profile_category_channel(self, c_channel_result):
        assert c_channel_result["forming_summary"]["profile_category"] == "channel"

    def test_c_channel_flat_strip_within_1mm(self, c_channel_result):
        """C 60×40 GI 1.5mm: flat = 60+80+2×BA within ±1mm"""
        t = 1.5
        r = BEND_RADIUS_FACTOR["GI"] * t
        ba = _bend_allowance(90.0, r, t, "GI")
        manual = 60 + 80 + 2 * ba
        flat = c_channel_result["forming_summary"]["flat_strip_width_mm"]
        assert flat == pytest.approx(manual, abs=1.0), \
            f"Flat strip {flat:.2f} vs manual {manual:.2f}"

    def test_c_channel_groove_depth_in_range(self, c_channel_result):
        """All passes: groove depth should be in plausible range [1mm, 120mm]"""
        for p in c_channel_result["passes"]:
            gd = p.get("groove_depth_mm", p.get("forming_depth_mm", 0))
            assert 0 <= gd <= 120, f"Pass {p['pass_no']}: groove_depth {gd} out of range"

    def test_c_channel_angle_schedule_cubic_ease(self, c_channel_result):
        assert c_channel_result["forming_summary"]["angle_schedule_mode"] == "cubic_ease"

    # ── Lipped channel SS 1.0mm ───────────────────────────────────────────────
    def test_lipped_ss_status_pass(self, lipped_ss_result):
        assert lipped_ss_result["status"] == "pass"

    def test_lipped_ss_no_interference_clash(self, lipped_ss_result):
        clashes = lipped_ss_result["interference_summary"]["clash_count"]
        assert clashes == 0, f"Lipped SS has {clashes} interference clashes"

    def test_lipped_ss_profile_category_structural(self, lipped_ss_result):
        assert lipped_ss_result["forming_summary"]["profile_category"] == "structural"

    def test_lipped_ss_flat_strip_within_1mm(self, lipped_ss_result):
        """LC SS 1.0mm 80×40 lip=15: flat = 80+80+30+4×BA within ±1mm"""
        t = 1.0
        r = BEND_RADIUS_FACTOR["SS"] * t
        ba = _bend_allowance(90.0, r, t, "SS")
        manual = 80 + 2 * 40 + 2 * 15.0 + 4 * ba
        flat = lipped_ss_result["forming_summary"]["flat_strip_width_mm"]
        assert flat == pytest.approx(manual, abs=1.0), \
            f"Flat strip {flat:.2f} vs manual {manual:.2f}"

    def test_lipped_ss_pinch_severity_not_critical(self, lipped_ss_result):
        """SS 1.0mm: R/t=2.0 for SS → severity should not be critical"""
        t = 1.0
        r = BEND_RADIUS_FACTOR["SS"] * t
        sev = _pinch_severity(r, t, "SS")
        assert sev != "critical", f"Unexpected critical pinch: R/t={r/t:.2f}"

    def test_lipped_ss_angle_schedule_two_phase(self, lipped_ss_result):
        assert lipped_ss_result["forming_summary"]["angle_schedule_mode"] == "two_phase_lipped"

    def test_lipped_ss_bend_groups_has_lip_group(self, lipped_ss_result):
        groups = lipped_ss_result["forming_summary"]["bend_groups"]
        group_ids = [g["group_id"] for g in groups]
        assert "lip" in group_ids, f"Missing lip bend group: {group_ids}"


# ══════════════════════════════════════════════════════════════════════════════
#  PP07  Per-station tooling sub-dict structure
# ══════════════════════════════════════════════════════════════════════════════

class TestToolingSubDict:
    def test_all_passes_have_tooling_dict(self, c_channel_result):
        for p in c_channel_result["passes"]:
            assert "tooling" in p, f"Pass {p.get('pass_no')} missing tooling"

    def test_tooling_has_required_keys(self, c_channel_result):
        required = {
            "top_roll_contour", "bottom_roll_contour", "face_width_mm",
            "groove_width_mm", "groove_depth_mm", "relief_width_mm", "relief_depth_mm",
            "shoulder_left_mm", "shoulder_right_mm", "support_surfaces",
            "roll_width_breakdown", "clash_risk_markers", "geometry_grade",
        }
        for p in c_channel_result["passes"]:
            t = p.get("tooling", {})
            missing = required - set(t.keys())
            assert not missing, f"Pass {p.get('pass_no')} tooling missing keys: {missing}"

    def test_geometry_grade_valid_values(self, c_channel_result):
        for p in c_channel_result["passes"]:
            gg = p.get("geometry_grade")
            assert gg in ("manufacturing_grade", "heuristic_fallback"), \
                f"Pass {p.get('pass_no')}: invalid geometry_grade={gg!r}"

    def test_groove_depth_nonnegative(self, c_channel_result):
        for p in c_channel_result["passes"]:
            gd = p["tooling"]["groove_depth_mm"]
            assert gd >= 0, f"Pass {p['pass_no']}: groove_depth_mm={gd} < 0"

    def test_shoulder_dimensions_positive(self, c_channel_result):
        for p in c_channel_result["passes"]:
            t = p["tooling"]
            assert t["shoulder_left_mm"] > 0
            assert t["shoulder_right_mm"] > 0


# ══════════════════════════════════════════════════════════════════════════════
#  PP08  bend_groups[] in forming_summary
# ══════════════════════════════════════════════════════════════════════════════

class TestBendGroups:
    def test_c_channel_has_flange_bend_group(self, c_channel_result):
        groups = c_channel_result["forming_summary"]["bend_groups"]
        assert len(groups) >= 1
        assert groups[0]["group_id"] in ("flange", "rib_arms")

    def test_lipped_has_two_bend_groups(self, lipped_ss_result):
        """Lipped channel should have flange + lip bend groups"""
        groups = lipped_ss_result["forming_summary"]["bend_groups"]
        assert len(groups) >= 2

    def test_bend_group_has_required_fields(self, c_channel_result):
        required = {"group_id", "bend_count", "inner_radius_mm", "k_factor", "ba_mm",
                    "forming_start_pass", "forming_end_pass"}
        for g in c_channel_result["forming_summary"]["bend_groups"]:
            missing = required - set(g.keys())
            assert not missing, f"Bend group missing fields: {missing}"

    def test_shutter_slat_has_rib_inner_group(self, shutter_slat_result):
        groups = shutter_slat_result["forming_summary"]["bend_groups"]
        group_ids = [g["group_id"] for g in groups]
        assert "rib_inner" in group_ids, f"Shutter missing rib_inner group: {group_ids}"

    def test_bend_group_ba_mm_positive(self, c_channel_result):
        for g in c_channel_result["forming_summary"]["bend_groups"]:
            assert g["ba_mm"] > 0, f"Group {g['group_id']}: ba_mm={g['ba_mm']} ≤ 0"


# ══════════════════════════════════════════════════════════════════════════════
#  PP09  Contact strips count per profile type
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not SHAPELY_OK, reason="shapely not installed")
class TestContactStrips:
    def _compute_strips(self, profile_type, web, flange, t, mat, angle=90.0, lip_mm=0.0):
        pts = section_centerline(profile_type, web, flange, angle, lip_mm=lip_mm)
        poly = centerline_to_polygon(pts, t)
        if poly is None or poly.is_empty:
            return []
        r = BEND_RADIUS_FACTOR.get(mat, 1.0) * t
        gg = compute_groove_geometry(
            poly, bend_radius_mm=r, roll_gap=t + 0.1,
            thickness=t, material=mat, profile_type=profile_type
        )
        return gg.get("contact_strips", [])

    def test_c_channel_has_web_and_flange_strips(self):
        strips = self._compute_strips("c_channel", 60, 40, 1.5, "GI")
        types = [s["strip_type"] for s in strips]
        assert any("web_contact" in st for st in types)
        assert any("flange" in st for st in types)

    def test_shutter_slat_has_rib_root_strips(self):
        """Shutter slat must include rib_root contact strips"""
        strips = self._compute_strips("shutter_slat", 200, 12, 1.2, "GI")
        types = [s["strip_type"] for s in strips]
        rib_strips = [st for st in types if "rib_root" in st]
        assert len(rib_strips) >= 2, f"Expected ≥2 rib_root strips, got: {types}"

    def test_door_frame_has_return_lip_strips(self):
        """Door frame must include return_lip contact strips"""
        strips = self._compute_strips("door_frame", 80, 60, 2.0, "MS", lip_mm=15.0)
        types = [s["strip_type"] for s in strips]
        rl_strips = [st for st in types if "return_lip" in st]
        assert len(rl_strips) >= 2, f"Expected ≥2 return_lip strips, got: {types}"

    def test_lipped_channel_has_lip_contact_strips(self):
        """Lipped channel must include inward lip contact strips"""
        strips = self._compute_strips("lipped_channel", 80, 40, 1.0, "SS", lip_mm=15.0)
        types = [s["strip_type"] for s in strips]
        lip_strips = [st for st in types if "lip" in st.lower()]
        assert len(lip_strips) >= 1, f"Expected ≥1 lip contact strip, got: {types}"

    def test_pinch_zones_have_pressure_angle_field(self):
        """All pinch zones must carry pressure_angle_deg field"""
        pts = section_centerline("c_channel", 60, 40, 90)
        poly = centerline_to_polygon(pts, 1.5)
        gg = compute_groove_geometry(
            poly, bend_radius_mm=1.5, roll_gap=1.6,
            thickness=1.5, material="GI", profile_type="c_channel"
        )
        for pz in gg.get("pinch_zones", []):
            assert "pressure_angle_deg" in pz, f"Pinch zone missing pressure_angle_deg: {pz}"
            assert "severity" in pz
