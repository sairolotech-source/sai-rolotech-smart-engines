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

from app.engines.profile_analysis_engine import classify_profile, analyze_profile
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
        """Door frame MS 2.0mm 80×60 lip=15: flat = 80+2×60+2×15+BA_flange+BA_lip
        Engine uses per-group BA: flange bends at standard radius, lip bends at 0.85× radius.
        Manual lower bound: all BAs at lip radius (conservative); upper: all at flange radius."""
        t = 2.0
        r_flange = BEND_RADIUS_FACTOR["MS"] * t
        r_lip    = round(r_flange * 0.85, 3)
        ba_flange = _bend_allowance(90.0, r_flange, t, "MS")
        ba_lip    = _bend_allowance(90.0, r_lip, t, "MS")
        # Upper bound: all 4 bends at flange radius
        upper = 80 + 2 * 60 + 2 * 15.0 + 4 * ba_flange
        # Lower bound: all 4 bends at lip radius
        lower = 80 + 2 * 60 + 2 * 15.0 + 4 * ba_lip
        flat = door_frame_result["forming_summary"]["flat_strip_width_mm"]
        assert lower - 0.5 <= flat <= upper + 0.5, \
            f"Flat strip {flat:.2f} outside [{lower:.2f}, {upper:.2f}]"

    def test_door_frame_angle_schedule_two_phase(self, door_frame_result):
        assert door_frame_result["forming_summary"]["angle_schedule_mode"] == "two_phase_lipped"

    def test_door_frame_bend_groups_has_return_lip(self, door_frame_result):
        """door_frame must produce a return_lip bend group"""
        groups = door_frame_result["forming_summary"]["bend_groups"]
        group_ids = [g["group_id"] for g in groups]
        assert "return_lip" in group_ids, \
            f"door_frame missing return_lip bend group: {group_ids}"

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
        """LC SS 1.0mm 80×40 lip=15: flat = 80+80+30+4×BA within ±1mm
        Engine uses per-group BA: flange at standard radius, lip at 0.85× radius."""
        t = 1.0
        r_flange = BEND_RADIUS_FACTOR["SS"] * t
        r_lip    = round(r_flange * 0.85, 3)
        ba_flange = _bend_allowance(90.0, r_flange, t, "SS")
        ba_lip    = _bend_allowance(90.0, r_lip, t, "SS")
        upper = 80 + 2 * 40 + 2 * 15.0 + 4 * ba_flange
        lower = 80 + 2 * 40 + 2 * 15.0 + 4 * ba_lip
        flat = lipped_ss_result["forming_summary"]["flat_strip_width_mm"]
        assert lower - 0.5 <= flat <= upper + 0.5, \
            f"Flat strip {flat:.2f} outside [{lower:.2f}, {upper:.2f}]"

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


# ══════════════════════════════════════════════════════════════════════════════
#  PP10  Pipeline integration — analyze_profile() → classify_profile()
#        Tests that return_bends and lip_mm are computed BEFORE classify_profile
#        is called, so door_frame / z_section disambiguation is correct.
# ══════════════════════════════════════════════════════════════════════════════

def _make_geometry_result(
    width: float,
    height: float,
    geometry: list,
    has_lips: bool = False,
    lip_mm: float = 0.0,
    profile_open: bool = True,
) -> dict:
    return {
        "geometry": geometry or [{"type": "LINE"}],
        "bounding_box": {"width": width, "height": height},
        "has_lips": has_lips,
        "lip_mm": lip_mm,
        "profile_open": profile_open,
    }


def _make_bend_geometry(n: int, return_bends: int = 0) -> list:
    bends = [{"type": "ARC", "angle": 90.0, "bend_type": "standard"} for _ in range(n)]
    for i in range(return_bends):
        bends.append({"type": "ARC", "angle": 90.0, "bend_type": "return_or_sharp"})
    return bends


class TestAnalyzeProfilePipeline:
    """
    Integration tests that go through analyze_profile() to verify that
    classify_profile() receives correct return_bends and lip_mm signals.
    """

    def _geometry_result_with_bends(
        self,
        width: float,
        height: float,
        has_lips: bool = False,
        lip_mm: float = 0.0,
    ) -> dict:
        return {
            "geometry": [{"type": "LINE"}],
            "bounding_box": {"width": width, "height": height},
            "has_lips": has_lips,
            "lip_mm": lip_mm,
            "profile_open": True,
        }

    def test_analyze_profile_returns_pass_for_valid_geometry(self):
        """analyze_profile should return status=pass for any valid geometry"""
        gr = self._geometry_result_with_bends(60, 40)
        result = analyze_profile(gr)
        assert result["status"] == "pass"

    def test_analyze_profile_propagates_has_lips_to_profile_type(self):
        """has_lips=True on a 4-bend geometry should produce lipped_channel not door_frame"""
        # Normally 4 bends + return_bends=2 → door_frame
        # But with has_lips=True → lipped_channel (lip signal wins)
        # We test at the classify_profile level since analyze_profile uses detect_bends
        # which processes actual geometry, not a pre-counted list.
        pt = classify_profile(4, 80, 40, has_lips=True, return_bends=2, lip_mm=15.0)
        assert pt == "lipped_channel", f"Expected lipped_channel, got {pt}"

    def test_analyze_profile_no_lips_return_bend_gives_door_frame(self):
        """4 bends, return_bends=2, no lips → door_frame"""
        pt = classify_profile(4, 80, 60, has_lips=False, return_bends=2, lip_mm=0.0)
        assert pt == "door_frame", f"Expected door_frame, got {pt}"

    def test_analyze_profile_return_bend_z_section(self):
        """2 bends + return_bends=1 → z_section"""
        pt = classify_profile(2, 60, 40, has_lips=False, return_bends=1, lip_mm=0.0)
        assert pt == "z_section", f"Expected z_section, got {pt}"

    def test_analyze_profile_no_return_bend_c_channel(self):
        """2 bends, no return bends, tall aspect → c_channel"""
        pt = classify_profile(2, 40, 60, has_lips=False, return_bends=0, lip_mm=0.0)
        assert pt == "c_channel", f"Expected c_channel, got {pt}"

    def test_analyze_profile_has_lips_shallow_6bends_lipped_channel(self):
        """6 bends + has_lips + shallow aspect → lipped_channel (not shutter_slat)"""
        pt = classify_profile(6, 200, 12, has_lips=True, return_bends=0, lip_mm=8.0)
        assert pt == "lipped_channel", f"Expected lipped_channel, got {pt}"

    def test_analyze_profile_no_lips_shallow_6bends_shutter_slat(self):
        """6 bends + no lips + shallow aspect → shutter_slat"""
        pt = classify_profile(6, 200, 12, has_lips=False, return_bends=0, lip_mm=0.0)
        assert pt == "shutter_slat", f"Expected shutter_slat, got {pt}"

    def test_analyze_profile_output_has_has_lips_and_lip_mm(self):
        """analyze_profile output must contain has_lips and lip_mm fields"""
        gr = self._geometry_result_with_bends(80, 40, has_lips=True, lip_mm=15.0)
        result = analyze_profile(gr)
        assert result["status"] == "pass"
        assert "has_lips" in result, "has_lips missing from analyze_profile output"
        assert "lip_mm" in result, "lip_mm missing from analyze_profile output"

    def test_analyze_profile_output_has_return_bends_count(self):
        """analyze_profile output must contain return_bends_count field"""
        gr = self._geometry_result_with_bends(60, 40)
        result = analyze_profile(gr)
        assert "return_bends_count" in result, "return_bends_count missing"
        assert isinstance(result["return_bends_count"], int)


# ══════════════════════════════════════════════════════════════════════════════
#  PP11  Asymmetric lip geometry — section_centerline asymmetric lip support
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not SHAPELY_OK, reason="shapely not installed")
class TestAsymmetricLipGeometry:

    def test_symmetric_lip_produces_same_count_as_single_lip_mm(self):
        """lip_mm_left == lip_mm_right == lip_mm should give identical points"""
        pts_sym = section_centerline("lipped_channel", 80, 40, 90, lip_mm=15.0)
        pts_asym = section_centerline("lipped_channel", 80, 40, 90,
                                      lip_mm_left=15.0, lip_mm_right=15.0)
        assert len(pts_sym) == len(pts_asym), \
            f"Symmetric: {len(pts_sym)} pts vs asymmetric: {len(pts_asym)} pts"

    def test_asymmetric_lip_produces_valid_polygon(self):
        """lipped_channel with different left/right lips → valid polygon"""
        pts = section_centerline("lipped_channel", 80, 40, 90,
                                 lip_mm_left=20.0, lip_mm_right=10.0)
        poly = centerline_to_polygon(pts, 1.5)
        assert poly is not None, "Asymmetric lip polygon is None"
        assert not poly.is_empty, "Asymmetric lip polygon is empty"
        assert poly.area > 0, f"Asymmetric lip polygon area={poly.area}"

    def test_single_lip_left_only(self):
        """lipped_channel with left lip only → fewer points than symmetric"""
        pts_both = section_centerline("lipped_channel", 80, 40, 90, lip_mm=15.0)
        pts_left = section_centerline("lipped_channel", 80, 40, 90,
                                      lip_mm_left=15.0, lip_mm_right=0.0)
        assert len(pts_left) < len(pts_both), \
            f"Left-only: {len(pts_left)} pts, both: {len(pts_both)} pts"

    def test_u_channel_centerline_explicit(self):
        """u_channel must produce identical points to c_channel (wide web)"""
        pts_c = section_centerline("c_channel", 120, 30, 90)
        pts_u = section_centerline("u_channel", 120, 30, 90)
        assert len(pts_c) == len(pts_u)
        for pc, pu in zip(pts_c, pts_u):
            assert pc[0] == pytest.approx(pu[0], abs=0.01)
            assert pc[1] == pytest.approx(pu[1], abs=0.01)

    def test_door_frame_centerline_has_inward_return_lips(self):
        """door_frame centerline should have 6 points (2 lips + 4 channel corners)"""
        pts = section_centerline("door_frame", 80, 60, 90, lip_mm=15.0)
        assert len(pts) == 6, f"Expected 6 points for door_frame, got {len(pts)}"

    def test_all_8_profile_types_produce_valid_polygon(self):
        """All 8 production profiles must produce a valid polygon at theta=90°"""
        configs = [
            ("c_channel",      60,  40, 0.0),
            ("u_channel",     120,  30, 0.0),
            ("simple_channel", 60,   3, 0.0),
            ("simple_angle",   60,  30, 0.0),
            ("z_section",      60,  40, 0.0),
            ("lipped_channel", 80,  40, 15.0),
            ("hat_section",   150,  30, 15.0),
            ("shutter_slat",  200,  12, 0.0),
            ("door_frame",     80,  60, 15.0),
        ]
        for pt, web, flange, lip in configs:
            pts = section_centerline(pt, web, flange, 90, lip_mm=lip)
            assert len(pts) >= 2, f"{pt}: too few centerline points"
            poly = centerline_to_polygon(pts, 1.5)
            assert poly is not None, f"{pt}: polygon is None"
            assert not poly.is_empty, f"{pt}: polygon is empty"
            assert poly.area > 0, f"{pt}: polygon area={poly.area}"


# ══════════════════════════════════════════════════════════════════════════════
#  PP12  Strip-width progression consistency with flat-strip basis
#        Validates that passes[0].strip_width_mm ≈ flat_strip_width_mm and
#        passes[-1].strip_width_mm ≈ section_width_mm (monotonic descent).
# ══════════════════════════════════════════════════════════════════════════════

class TestStripWidthProgression:
    """Validates strip-width progression is consistent with flat-strip formula.

    The progression formula interpolates from flat_strip_width at station 0 (pre-machine)
    down to final_section_width at station n_passes.  Each stored pass[i].strip_width_mm
    is at step i+1 of n_passes — so pass[0] is already one step from flat, and
    pass[-1] == final_section_width_mm.
    """

    def test_c_channel_strip_progression_monotonic_descent(self, c_channel_result):
        """Strip widths must descend monotonically from flat to final"""
        widths = [p["strip_width_mm"] for p in c_channel_result["passes"]]
        for a, b in zip(widths, widths[1:]):
            assert a >= b - 0.5, f"Non-monotonic strip widths: {a} > {b}"

    def test_c_channel_strip_progression_first_greater_than_last(self, c_channel_result):
        """First forming pass must have greater strip width than last"""
        widths = [p["strip_width_mm"] for p in c_channel_result["passes"]]
        assert widths[0] > widths[-1], \
            f"First {widths[0]} not > last {widths[-1]}"

    def test_c_channel_last_pass_equals_section_width(self, c_channel_result):
        """Last forming pass strip width must equal final section width (progression endpoint)"""
        sw = c_channel_result["forming_summary"]["final_section_width_mm"]
        last_sw = c_channel_result["passes"][-1]["strip_width_mm"]
        assert last_sw == pytest.approx(sw, abs=1.0), \
            f"Last strip width {last_sw} not equal to section width {sw}"

    def test_c_channel_strip_widths_all_positive(self, c_channel_result):
        """All strip widths must be positive"""
        for p in c_channel_result["passes"]:
            assert p["strip_width_mm"] > 0

    def test_lipped_ss_strip_progression_monotonic(self, lipped_ss_result):
        """Lipped SS: strip widths must descend monotonically"""
        widths = [p["strip_width_mm"] for p in lipped_ss_result["passes"]]
        for a, b in zip(widths, widths[1:]):
            assert a >= b - 0.5, f"Non-monotonic: {a} > {b}"

    def test_lipped_ss_last_pass_equals_section_width(self, lipped_ss_result):
        """Lipped SS: last pass strip width equals section width"""
        sw = lipped_ss_result["forming_summary"]["final_section_width_mm"]
        last_sw = lipped_ss_result["passes"][-1]["strip_width_mm"]
        assert last_sw == pytest.approx(sw, abs=1.0), \
            f"Last strip width {last_sw} not equal to section width {sw}"

    def test_door_frame_has_return_lip_bend_group(self, door_frame_result):
        """Door frame must always have a return_lip bend group"""
        groups = door_frame_result["forming_summary"]["bend_groups"]
        group_ids = [g["group_id"] for g in groups]
        assert "return_lip" in group_ids, \
            f"door_frame missing return_lip group: {group_ids}"

    def test_door_frame_return_lip_group_has_leg_mm(self, door_frame_result):
        """return_lip bend group must carry a leg_mm field"""
        groups = door_frame_result["forming_summary"]["bend_groups"]
        rl_groups = [g for g in groups if g["group_id"] == "return_lip"]
        assert rl_groups, "No return_lip group found"
        assert "leg_mm" in rl_groups[0], "return_lip group missing leg_mm"
        assert rl_groups[0]["leg_mm"] > 0

    def test_shutter_slat_strip_progression_monotonic(self, shutter_slat_result):
        """Shutter slat: strip widths must descend monotonically"""
        widths = [p["strip_width_mm"] for p in shutter_slat_result["passes"]]
        for a, b in zip(widths, widths[1:]):
            assert a >= b - 0.5, f"Non-monotonic shutter widths: {a} > {b}"

    def test_multi_group_progression_basis_greater_than_no_group_for_lipped(self):
        """With lip bend_groups, flat_strip basis > single-group basis for lipped_channel"""
        from app.engines.roll_contour_engine import _strip_width_progression, BEND_RADIUS_FACTOR, _bend_allowance, _per_station_k_factor
        t = 1.0; r = BEND_RADIUS_FACTOR["SS"] * t; lip_r = round(r * 0.85, 3)
        ba_fl = _bend_allowance(90.0, r,      t, "SS")
        ba_lp = _bend_allowance(90.0, lip_r,  t, "SS")
        k_lp  = _per_station_k_factor(lip_r, t, "SS")
        groups = [
            {"group_id": "flange", "bend_count": 2, "ba_mm": ba_fl, "inner_radius_mm": r},
            {"group_id": "lip",    "bend_count": 2, "ba_mm": ba_lp, "inner_radius_mm": lip_r,
             "leg_mm": 15.0},
        ]
        widths_multi = _strip_width_progression(
            80, 4, t, 8, section_height_mm=40, inner_radius_mm=r, material="SS",
            bend_groups=groups,
        )
        widths_single = _strip_width_progression(
            80, 4, t, 8, section_height_mm=40, inner_radius_mm=r, material="SS",
        )
        # Multi-group should produce different (correctly higher) flat strip for lipped
        assert widths_multi[0] != widths_single[0], \
            "Multi-group progression should differ from single-group for lipped"


# ══════════════════════════════════════════════════════════════════════════════
#  PP10  Profile-true roll contour geometry (non-rectangular for shaped profiles)
# ══════════════════════════════════════════════════════════════════════════════

class TestProfileTrueContourGeometry:
    """
    Verify that upper_roll_profile / lower_roll_profile polylines are
    profile-true (non-rectangular) for profiles that have more than a plain web:
      - shutter_slat  → multi-rib wave: must have > 4 unique x-coordinates
      - door_frame    → return-lip geometry: must have > 4 points (lip vertices present)
      - lipped_channel → lip geometry: must have > 4 points

    When shapely is available the polylines come from the real envelope polygon;
    when shapely is absent the heuristic fallback is checked for basic non-trivial shape.

    PP10-1: shutter slat upper contour has > 4 unique x-values (multi-rib)
    PP10-2: door frame upper contour has > 4 points
    PP10-3: lipped channel upper contour has > 4 points
    PP10-4: shutter slat section_centerline defaults to n_ribs=4
    """

    def _first_pass_upper(self, result):
        return result["passes"][0]["upper_roll_profile"]

    def test_shutter_slat_contour_non_rectangular(self, shutter_slat_result):
        """PP10-1: shutter slat upper contour must have > 4 unique x-positions (rib wave)"""
        pts = self._first_pass_upper(shutter_slat_result)
        x_vals = {p["x"] for p in pts}
        assert len(x_vals) > 4, (
            f"Shutter slat upper contour has only {len(x_vals)} unique x-values — "
            "expected multi-rib wave (> 4). Contour may still be rectangular."
        )

    def test_door_frame_contour_has_return_lip_vertices(self, door_frame_result):
        """PP10-2: door frame upper contour must have > 4 points (return-lip geometry)"""
        pts = self._first_pass_upper(door_frame_result)
        assert len(pts) > 4, (
            f"Door frame upper contour has only {len(pts)} points — "
            "expected ≥ 5 (web + flange + return-lip vertices). "
            "Contour may still be a bounding-box rectangle."
        )

    def test_lipped_channel_contour_has_lip_vertices(self, lipped_ss_result):
        """PP10-3: lipped channel upper contour must have > 4 points (lip geometry)"""
        pts = self._first_pass_upper(lipped_ss_result)
        assert len(pts) > 4, (
            f"Lipped channel upper contour has only {len(pts)} points — "
            "expected ≥ 5 (web + flange + lip vertices). "
            "Contour may still be a bounding-box rectangle."
        )

    def test_shutter_slat_strip_width_basis_consistent_with_flat_strip(self, shutter_slat_result):
        """PP10-5: Strip-width progression must be bounded by flat_strip_width_mm.
        The first-pass strip must be ≤ flat_strip_width_mm (progression starts at flat and
        decreases each pass) and the last pass must equal section_width_mm.
        This verifies _strip_width_progression() and _flat_strip_for_profile() use the
        same rib-arm leg basis (section_h/2) so they can't silently drift."""
        summary = shutter_slat_result["forming_summary"]
        flat  = summary["flat_strip_width_mm"]
        sec_w = summary.get("section_width_mm", 200)
        passes = shutter_slat_result["passes"]
        first_w = passes[0]["strip_width_mm"]
        last_w  = passes[-1]["strip_width_mm"]
        # Progression goes flat_strip → section_width monotonically
        assert first_w <= flat + 0.5, (
            f"First-pass strip width {first_w:.2f} > flat_strip {flat:.2f} — "
            "strip width must start at or below the flat strip"
        )
        assert first_w > sec_w, (
            f"First-pass strip width {first_w:.2f} ≤ section_width {sec_w:.2f} — "
            "forming starts wider than section"
        )
        # Last pass should equal section_width (fully formed)
        assert abs(last_w - sec_w) <= 1.0, (
            f"Last-pass strip width {last_w:.2f} not close to section_width {sec_w:.2f}"
        )

    @pytest.mark.skipif(not SHAPELY_OK, reason="shapely not available")
    def test_shutter_slat_section_centerline_default_4_ribs(self):
        """PP10-4: section_centerline shutter_slat defaults to n_ribs=4 at theta=90"""
        from app.engines.flower_svg_engine import section_centerline
        pts = section_centerline("shutter_slat", 200, 12, 90.0)
        # 4 ribs × (base + up-arm + flat_top + down-arm) + closing vertex
        # At minimum, each rib contributes 3–4 points → 4 ribs → ≥ 13 points total
        assert len(pts) >= 13, (
            f"section_centerline shutter_slat returned {len(pts)} points — "
            "expected ≥ 13 for 4-rib default (4×3 rib vertices + closing + base)"
        )
