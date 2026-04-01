"""
test_flower_3d_centerline.py — Tests for 3D Flower Wire Centerline

Tests COPRA Criterion B/C: 3D wire/transition representation in flower engine.
"""
import math
import pytest
from app.engines.advanced_flower_engine import (
    compute_2d_centerline, compute_3d_flower_centerline, generate_advanced_flower,
)


class TestCompute2DCenterline:
    def test_flat_strip_no_bends(self):
        pts = compute_2d_centerline([100.0], [])
        assert len(pts) == 2
        assert pts[0] == (0.0, 0.0)
        assert pts[1] == (100.0, 0.0)  # straight horizontal

    def test_single_90deg_bend(self):
        # [50mm flat] 90deg turn [50mm up]
        pts = compute_2d_centerline([50.0, 50.0], [90.0])
        assert len(pts) == 3
        # First segment goes right
        assert abs(pts[1][0] - 50.0) < 0.01
        assert abs(pts[1][1] - 0.0) < 0.01
        # After 90deg turn, goes straight up
        assert abs(pts[2][0] - 50.0) < 0.01
        assert abs(pts[2][1] - 50.0) < 0.01

    def test_two_90deg_bends_c_section(self):
        # C-section: [30] 90° [50] 90° [30]
        pts = compute_2d_centerline([30.0, 50.0, 30.0], [90.0, 90.0])
        assert len(pts) == 4
        # pt0 = (0, 0)
        assert pts[0] == (0.0, 0.0)
        # pt1 = (30, 0) after first segment
        assert abs(pts[1][0] - 30.0) < 0.01
        assert abs(pts[1][1] - 0.0) < 0.01
        # pt2 = (30, 50) after 90° turn and 50mm up
        assert abs(pts[2][0] - 30.0) < 0.01
        assert abs(pts[2][1] - 50.0) < 0.01
        # pt3 = (0, 50) after 90° turn and 30mm left... heading = 180°
        # x = 30 + 30*cos(180) = 30 - 30 = 0
        # y = 50 + 30*sin(180) = 50 + 0 = 50
        assert abs(pts[3][0]) < 0.01  # ≈ 0
        assert abs(pts[3][1] - 50.0) < 0.01

    def test_four_bend_lipped_channel(self):
        # Lipped channel: [50, 80, 40, 80, 50] with bends [90, 90, 90, 90]
        segs = [50.0, 80.0, 40.0, 80.0, 50.0]
        angles = [90.0, 90.0, 90.0, 90.0]
        pts = compute_2d_centerline(segs, angles)
        assert len(pts) == 6  # 5 segments = 6 points
        # First point is origin
        assert pts[0] == (0.0, 0.0)

    def test_partial_angles_early_pass(self):
        # Early forming pass — partial angles (not yet 90°)
        pts = compute_2d_centerline([50.0, 80.0, 50.0], [30.0, 30.0])
        assert len(pts) == 4
        # All points should differ from flat strip
        assert pts[2][1] != 0.0  # strip is no longer flat

    def test_zero_angle_is_flat(self):
        pts = compute_2d_centerline([50.0, 50.0], [0.0])
        # No bend: all points on horizontal line
        for pt in pts:
            assert abs(pt[1]) < 0.01  # y should be 0

    def test_point_count(self):
        n_segs = 5
        n_bends = n_segs - 1
        segs = [40.0] * n_segs
        angles = [90.0] * n_bends
        pts = compute_2d_centerline(segs, angles)
        assert len(pts) == n_segs + 1  # one extra for starting point

    def test_empty_returns_origin(self):
        pts = compute_2d_centerline([], [])
        assert pts == [(0.0, 0.0)]

    def test_segment_length_preserved(self):
        seg_len = 100.0
        pts = compute_2d_centerline([seg_len], [])
        dist = math.sqrt((pts[1][0] - pts[0][0])**2 + (pts[1][1] - pts[0][1])**2)
        assert abs(dist - seg_len) < 0.01


class TestCompute3DFlowerCenterline:
    def _make_pass_plan(self, n_passes=3, n_bends=4, final_angle=90.0):
        plan = []
        for i in range(n_passes):
            prog = (i + 1) / n_passes
            angles = [round(final_angle * prog, 2)] * n_bends
            plan.append({
                "pass": i + 1,
                "label": "calibration" if i == n_passes - 1 else "forming",
                "bend_angles_deg": angles,
                "progression_pct": round(100 * prog, 1),
                "is_calibration": i == n_passes - 1,
            })
        return plan

    def test_basic_3d_output(self):
        plan = self._make_pass_plan(3, 2)
        segs = [50.0, 80.0, 50.0]
        result = compute_3d_flower_centerline(plan, segs, 300.0)
        assert len(result) == 3
        for i, pp in enumerate(result):
            assert "centerline_xy" in pp
            assert "centerline_xyz" in pp

    def test_z_increments_by_pitch(self):
        plan = self._make_pass_plan(5, 2)
        pitch = 300.0
        result = compute_3d_flower_centerline(plan, [50.0, 80.0, 50.0], pitch)
        for i, pp in enumerate(result):
            z_values = [pt[2] for pt in pp["centerline_xyz"]]
            # All points in a pass have same z
            assert all(abs(z - i * pitch) < 0.01 for z in z_values), f"z mismatch at pass {i+1}"

    def test_z_0_for_first_pass(self):
        plan = self._make_pass_plan(3, 2)
        result = compute_3d_flower_centerline(plan, [50.0, 80.0, 50.0], 300.0)
        assert result[0]["centerline_xyz"][0][2] == 0.0

    def test_z_increases_with_pass(self):
        plan = self._make_pass_plan(4, 2)
        result = compute_3d_flower_centerline(plan, [50.0, 80.0, 50.0], 300.0)
        z_values = [pp["centerline_xyz"][0][2] for pp in result]
        for i in range(1, len(z_values)):
            assert z_values[i] > z_values[i - 1]

    def test_xy_length_correct(self):
        n_segs = 4
        plan = self._make_pass_plan(3, n_segs - 1)
        segs = [50.0] * n_segs
        result = compute_3d_flower_centerline(plan, segs, 300.0)
        for pp in result:
            assert len(pp["centerline_xy"]) == n_segs + 1
            assert len(pp["centerline_xyz"]) == n_segs + 1

    def test_xyz_has_3_coords(self):
        plan = self._make_pass_plan(2, 2)
        result = compute_3d_flower_centerline(plan, [50.0, 80.0, 50.0], 300.0)
        for pp in result:
            for pt in pp["centerline_xyz"]:
                assert len(pt) == 3

    def test_flat_first_pass(self):
        # With 0° angles, first pass should be near-flat (y ≈ 0)
        plan = [{"pass": 1, "bend_angles_deg": [0.0, 0.0], "label": "edge pickup", "progression_pct": 0}]
        result = compute_3d_flower_centerline(plan, [50.0, 80.0, 50.0], 300.0)
        xy = result[0]["centerline_xy"]
        for pt in xy:
            assert abs(pt[1]) < 0.01  # y ≈ 0 for flat strip

    def test_empty_plan_returns_empty(self):
        result = compute_3d_flower_centerline([], [50.0], 300.0)
        assert result == []

    def test_no_segment_lengths_uses_defaults(self):
        plan = self._make_pass_plan(2, 2)
        result = compute_3d_flower_centerline(plan, None, 300.0)
        assert all("centerline_xy" in pp for pp in result)

    def test_original_fields_preserved(self):
        plan = [{"pass": 1, "bend_angles_deg": [45.0], "label": "test", "progression_pct": 50.0, "is_calibration": False}]
        result = compute_3d_flower_centerline(plan, [60.0, 60.0], 300.0)
        assert result[0]["label"] == "test"
        assert result[0]["progression_pct"] == 50.0
        assert result[0]["is_calibration"] == False


class TestFlowerEngineWith3D:
    """Integration test: generate_advanced_flower should include 3D centerlines."""

    def _profile_result(self, section_type="lipped_channel", bend_count=4):
        return {
            "bend_count": bend_count,
            "profile_type": section_type,
            "return_bends_count": 0,
            "section_features": {
                "section_type": section_type,
                "symmetry": "symmetric",
                "flanges": [{"length": 80}] * 2,
                "lips": [{"length": 20}] * 2,
                "web": {"length": 120},
            },
            "section_width_mm": 220,
            "section_height_mm": 80,
            "segment_lengths_mm": [20, 60, 80, 60, 20],
        }

    def test_pass_plan_has_centerline_xy(self):
        result = generate_advanced_flower(
            self._profile_result(), {"sheet_thickness_mm": 2.0, "material": "GI"}
        )
        assert result["status"] == "pass"
        for pp in result["pass_plan"]:
            assert "centerline_xy" in pp, f"Pass {pp.get('pass')} missing centerline_xy"

    def test_pass_plan_has_centerline_xyz(self):
        result = generate_advanced_flower(
            self._profile_result(), {"sheet_thickness_mm": 2.0, "material": "GI"}
        )
        assert result["status"] == "pass"
        for pp in result["pass_plan"]:
            assert "centerline_xyz" in pp, f"Pass {pp.get('pass')} missing centerline_xyz"

    def test_z_increases_across_passes(self):
        result = generate_advanced_flower(
            self._profile_result(), {"sheet_thickness_mm": 2.0, "material": "GI"}
        )
        z_values = [pp["centerline_xyz"][0][2] for pp in result["pass_plan"]]
        for i in range(1, len(z_values)):
            assert z_values[i] >= z_values[i - 1]

    def test_c_channel_also_has_3d(self):
        result = generate_advanced_flower(
            {"bend_count": 2, "profile_type": "c_channel", "return_bends_count": 0,
             "section_features": {"section_type": "c_channel", "symmetry": "symmetric",
                                  "flanges": [], "lips": [], "web": {"length": 80}},
             "section_width_mm": 100, "section_height_mm": 50,
             "segment_lengths_mm": [30, 50, 30]},
            {"sheet_thickness_mm": 1.5, "material": "CR"}
        )
        assert result["status"] == "pass"
        for pp in result["pass_plan"]:
            assert "centerline_xyz" in pp
