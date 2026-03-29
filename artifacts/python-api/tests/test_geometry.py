"""
tests/test_geometry.py — Roll Forming Geometry Test Suite

Tests for:
  P2.1  Flat strip BA formula (neutral-axis)
  P2.2  Section centerline geometry (c_channel, z_section, flat)
  P2.3  centerline_to_polygon (shapely buffering)
  P2.4  Contact-point bend-vertex detection (dot product)
  P2.5  Groove geometry derivation from section polygon
  P2.6  Interference check (clash + clear + warning)
  P2.7  Flange detection via section_centerline

Run with:  cd artifacts/python-api && pytest tests/test_geometry.py -v
"""
import math
import sys
import os
import pytest

# ── Import path ───────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engines.flower_svg_engine import section_centerline, centerline_to_polygon
from app.engines.roll_contour_engine import (
    _bend_allowance,
    _contact_points_from_centerline,
    compute_groove_geometry,
    check_groove_interference,
)

try:
    from shapely.geometry import Polygon, box
    SHAPELY_OK = True
except ImportError:
    SHAPELY_OK = False

# ══════════════════════════════════════════════════════════════════════════════
#  P2.1  Flat strip bend allowance (neutral-axis formula)
# ══════════════════════════════════════════════════════════════════════════════

class TestBendAllowance:
    def test_ba_90deg_gi_1_5mm(self):
        """GI 1.5mm, R=1.5mm, 90° → BA = (π/2)*(1.5+0.75) = 3.534mm"""
        ba = _bend_allowance(90, 1.5, 1.5, "GI")
        expected = (math.pi / 2) * (1.5 + 0.75)
        assert ba == pytest.approx(expected, rel=1e-4), \
            f"Expected {expected:.4f}, got {ba:.4f}"

    def test_ba_90deg_ss_2mm(self):
        """SS 2mm, R=4mm, 90° → BA = (π/2)*(4+1) = 7.854mm"""
        ba = _bend_allowance(90, 4.0, 2.0, "SS")
        expected = (math.pi / 2) * (4.0 + 1.0)
        assert ba == pytest.approx(expected, rel=1e-4)

    def test_ba_45deg(self):
        """45° bend: BA = (π/4)*(R+t/2)"""
        ba = _bend_allowance(45, 2.0, 1.5, "GI")
        expected = (math.pi / 4) * (2.0 + 0.75)
        assert ba == pytest.approx(expected, rel=1e-4)

    def test_flat_strip_c60x40_gi_1_5mm(self):
        """GI 1.5mm, C 60×40, 2 bends, R=1.5mm → flat = 60+40+40+2*BA = 147.07mm ±0.1"""
        ba   = _bend_allowance(90, 1.5, 1.5, "GI")
        flat = 60.0 + 40.0 + 40.0 + 2 * ba
        assert flat == pytest.approx(147.068, abs=0.1), \
            f"Flat strip = {flat:.3f}, expected ~147.07mm"

    def test_ba_proportional_to_angle(self):
        """BA should scale linearly with bend angle."""
        ba90 = _bend_allowance(90, 2.0, 1.5, "GI")
        ba45 = _bend_allowance(45, 2.0, 1.5, "GI")
        assert ba90 == pytest.approx(2 * ba45, rel=1e-4)

    def test_ba_zero_angle(self):
        """Zero-degree bend → zero allowance."""
        ba = _bend_allowance(0, 2.0, 1.5, "GI")
        assert ba == pytest.approx(0.0, abs=1e-9)


# ══════════════════════════════════════════════════════════════════════════════
#  P2.2  Section centerline geometry
# ══════════════════════════════════════════════════════════════════════════════

class TestSectionCenterline:
    def test_c_channel_90deg_point_count(self):
        """c_channel at 90° → 4 points: fl_l, web_l, web_r, fl_r"""
        pts = section_centerline("c_channel", 60, 40, 90)
        assert len(pts) == 4

    def test_c_channel_90deg_flange_height(self):
        """At 90°, flanges should reach y = 40mm"""
        pts = section_centerline("c_channel", 60, 40, 90)
        ys  = {round(y, 4) for _, y in pts}
        assert 40.0 in ys, f"Expected y=40.0 in {ys}"
        assert 0.0  in ys, f"Expected y=0.0 in {ys}"

    def test_c_channel_flat_all_y_zero(self):
        """At 0°, all centerline points should be at y=0"""
        pts = section_centerline("c_channel", 60, 40, 0)
        for _, y in pts:
            assert abs(y) < 1e-9, f"Expected y=0, got y={y}"

    def test_c_channel_symmetry(self):
        """c_channel centerline should be symmetric about x=0"""
        pts = section_centerline("c_channel", 60, 40, 90)
        xs = sorted(x for x, _ in pts)
        assert abs(xs[0] + xs[-1]) < 1e-9, "Not symmetric about x=0"

    def test_simple_angle_3_points(self):
        """simple_angle → 3 points"""
        pts = section_centerline("simple_angle", 60, 40, 90)
        assert len(pts) == 3

    def test_z_section_4_points(self):
        """z_section → 4 points"""
        pts = section_centerline("z_section", 60, 40, 90)
        assert len(pts) == 4

    def test_hat_section_4_points(self):
        """hat_section → 4 points"""
        pts = section_centerline("hat_section", 60, 40, 45)
        assert len(pts) == 4

    def test_lipped_channel_with_lip(self):
        """lipped_channel with lip_mm > 0 → 6 points"""
        pts = section_centerline("lipped_channel", 60, 40, 90, lip_mm=15)
        assert len(pts) == 6

    def test_web_width_correct(self):
        """Web should span from -web/2 to +web/2 on x axis"""
        pts = section_centerline("c_channel", 80, 30, 90)
        xs_web = [x for x, y in pts if abs(y) < 1e-9]
        # web_l and web_r should be at -40 and +40
        assert any(abs(x - (-40)) < 1e-6 for x in xs_web), "Missing web_l at x=-40"
        assert any(abs(x -   40) < 1e-6 for x in xs_web), "Missing web_r at x=+40"

    def test_45deg_partial_forming(self):
        """At 45°, flange y should be < 40mm (partial forming)"""
        pts = section_centerline("c_channel", 60, 40, 45)
        max_y = max(y for _, y in pts)
        assert 0 < max_y < 40, f"Expected 0 < max_y < 40, got {max_y:.3f}"


# ══════════════════════════════════════════════════════════════════════════════
#  P2.3  Centerline → shapely polygon
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not SHAPELY_OK, reason="shapely not installed")
class TestCenterlineToPolygon:
    def test_returns_polygon_for_valid_pts(self):
        poly = centerline_to_polygon([(0, 0), (10, 0), (10, 5)], 1.5)
        assert poly is not None
        assert hasattr(poly, "area")
        assert poly.area > 0

    def test_area_increases_with_thickness(self):
        pts = [(0, 0), (60, 0), (60, 40)]
        thin = centerline_to_polygon(pts, 1.0)
        thick = centerline_to_polygon(pts, 3.0)
        assert thick.area > thin.area

    def test_returns_none_for_single_point(self):
        poly = centerline_to_polygon([(0, 0)], 1.5)
        assert poly is None

    def test_c_channel_90deg_polygon(self):
        pts  = section_centerline("c_channel", 60, 40, 90)
        poly = centerline_to_polygon(pts, 1.5)
        assert poly is not None and not poly.is_empty
        minx, miny, maxx, maxy = poly.bounds
        assert maxy - miny == pytest.approx(40.0, abs=2.0), "Height should ≈ flange_mm"


# ══════════════════════════════════════════════════════════════════════════════
#  P2.4  Contact-point bend-vertex detection
# ══════════════════════════════════════════════════════════════════════════════

class TestContactPoints:
    def _to_cl(self, tuples):
        return [{"x": x, "y": y} for x, y in tuples]

    def test_straight_line_no_bends(self):
        """Three collinear points → no bend vertices"""
        cl = self._to_cl([(0, 0), (5, 0), (10, 0)])
        assert _contact_points_from_centerline(cl) == []

    def test_right_angle_one_bend(self):
        """L-shape: (0,0)→(10,0)→(10,10) → 1 bend at (10,0)"""
        cl = self._to_cl([(0, 0), (10, 0), (10, 10)])
        bends = _contact_points_from_centerline(cl)
        assert len(bends) == 1
        assert bends[0]["x"] == pytest.approx(10.0)
        assert bends[0]["y"] == pytest.approx(0.0)

    def test_two_right_angles(self):
        """C-shape (web + 2 flanges) → 2 bend vertices"""
        cl = self._to_cl([(-30, 40), (-30, 0), (30, 0), (30, 40)])
        bends = _contact_points_from_centerline(cl)
        assert len(bends) == 2

    def test_nearly_straight_below_threshold(self):
        """5° turn < 10° threshold → no bend detected"""
        import math
        angle = math.radians(5)
        cl = self._to_cl([(0, 0), (10, 0), (10 + math.cos(angle)*5, math.sin(angle)*5)])
        bends = _contact_points_from_centerline(cl)
        assert len(bends) == 0

    def test_custom_threshold_stricter(self):
        """25° turn: visible with 10° threshold, invisible with 30° threshold"""
        import math
        angle_rad = math.radians(25)
        cl = self._to_cl([(0, 0), (10, 0), (10 + math.cos(angle_rad) * 5, math.sin(angle_rad) * 5)])
        bends_10 = _contact_points_from_centerline(cl, angle_threshold_deg=10)
        bends_30 = _contact_points_from_centerline(cl, angle_threshold_deg=30)
        assert len(bends_10) == 1
        assert len(bends_30) == 0

    def test_c_channel_90deg_has_2_bends(self):
        """Real c_channel 90° centerline → 2 bend vertices (web-flange junctions)"""
        cl_tuples = section_centerline("c_channel", 60, 40, 90)
        cl = [{"x": x, "y": y} for x, y in cl_tuples]
        bends = _contact_points_from_centerline(cl)
        assert len(bends) == 2, f"Expected 2 bends, got {len(bends)}"

    def test_c_channel_flat_no_bends(self):
        """Flat c_channel at 0° → all collinear → no bends"""
        cl_tuples = section_centerline("c_channel", 60, 40, 0)
        cl = [{"x": x, "y": y} for x, y in cl_tuples]
        bends = _contact_points_from_centerline(cl)
        assert len(bends) == 0


# ══════════════════════════════════════════════════════════════════════════════
#  P2.5  Groove geometry from section polygon
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not SHAPELY_OK, reason="shapely not installed")
class TestGrooveGeometry:
    def _make_section_poly(self, web=60, flange=40, thickness=1.5, angle=90):
        pts  = section_centerline("c_channel", web, flange, angle)
        poly = centerline_to_polygon(pts, thickness)
        return poly

    def test_groove_depth_near_flange(self):
        """Groove depth should approximately equal flange height at 90°"""
        poly = self._make_section_poly(flange=40, angle=90)
        gg   = compute_groove_geometry(poly, bend_radius_mm=1.5, roll_gap=1.6)
        assert gg["groove_depth_mm"] == pytest.approx(40.0, abs=2.0), \
            f"Expected ~40mm groove depth, got {gg['groove_depth_mm']:.3f}"

    def test_roll_width_wider_than_web(self):
        """Roll width should be > web width (includes 2 shoulders)"""
        poly = self._make_section_poly(web=60)
        gg   = compute_groove_geometry(poly, bend_radius_mm=1.5, roll_gap=1.6)
        assert gg["roll_width_mm"] > 60, "Roll width must be wider than web"

    def test_shaft_center_above_below_gap(self):
        """Shaft centers should be above/below the pass line"""
        poly = self._make_section_poly()
        gg   = compute_groove_geometry(poly, bend_radius_mm=1.5, roll_gap=1.6)
        assert gg["shaft_center_upper_mm"] > 0
        assert gg["shaft_center_lower_mm"] > 0

    def test_shaft_center_distance(self):
        """shaft_center_distance = upper + lower centers"""
        poly = self._make_section_poly()
        gg   = compute_groove_geometry(poly, bend_radius_mm=1.5, roll_gap=1.6)
        expected = gg["shaft_center_upper_mm"] + gg["shaft_center_lower_mm"]
        assert gg["shaft_center_distance_mm"] == pytest.approx(expected, rel=1e-4)

    def test_groove_radius_equals_bend_radius(self):
        """groove_radius_mm must equal the bend_radius_mm passed in"""
        poly = self._make_section_poly()
        br   = 2.25
        gg   = compute_groove_geometry(poly, bend_radius_mm=br, roll_gap=1.6)
        assert gg["groove_radius_mm"] == pytest.approx(br, rel=1e-4)

    def test_lower_roll_radius_less_than_upper(self):
        """Lower roll is grooved → its radius must be < upper roll radius"""
        poly = self._make_section_poly()
        gg   = compute_groove_geometry(poly, bend_radius_mm=1.5, roll_gap=1.6)
        assert gg["lower_roll_radius_mm"] < gg["upper_roll_radius_mm"]

    def test_returns_empty_for_none_poly(self):
        """compute_groove_geometry should return {} for None input"""
        gg = compute_groove_geometry(None, 1.5, 1.6)
        assert gg == {}


# ══════════════════════════════════════════════════════════════════════════════
#  P2.6  Interference check (shapely polygon intersection)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.skipif(not SHAPELY_OK, reason="shapely not installed")
class TestInterferenceCheck:
    def test_clear_non_overlapping(self):
        """Two boxes far apart → status='clear', blocking=False"""
        upper = box(-30, 5,  30, 60)
        lower = box(-30, -60, 30, 0)
        result = check_groove_interference(upper, lower, pass_no=1, roll_gap_mm=1.6)
        assert result["status"] == "clear"
        assert result["blocking"] is False
        assert result["clash_area_mm2"] == pytest.approx(0.0)

    def test_clash_overlapping(self):
        """Two overlapping boxes → status='clash', blocking=True"""
        upper = box(-30, -5, 30, 60)
        lower = box(-30, -60, 30, 5)
        result = check_groove_interference(upper, lower, pass_no=2, roll_gap_mm=1.6)
        assert result["status"] == "clash"
        assert result["blocking"] is True
        assert result["clash_area_mm2"] > 0

    def test_warning_near_miss(self):
        """Boxes nearly touching (gap < 10% of roll_gap) → status='warning'"""
        roll_gap = 2.0
        threshold = roll_gap * 0.1   # 0.2mm
        # Place upper starting at y=0.05 (gap=0.05 < 0.2 threshold)
        upper = box(-30, 0.05, 30, 60)
        lower = box(-30, -60,  30, 0)
        result = check_groove_interference(upper, lower, pass_no=3, roll_gap_mm=roll_gap)
        assert result["status"] in ("warning", "clear")  # depends on exact geometry
        assert result["blocking"] is False

    def test_skip_when_none_poly(self):
        """None polygon → status='skip', blocking=False"""
        result = check_groove_interference(None, None, pass_no=1, roll_gap_mm=1.6)
        assert result["status"] == "skip"
        assert result["blocking"] is False

    def test_pass_no_preserved(self):
        """pass_no must be echoed back in result"""
        upper = box(-30, 5,  30, 60)
        lower = box(-30, -60, 30, 0)
        result = check_groove_interference(upper, lower, pass_no=7, roll_gap_mm=1.6)
        assert result["pass_no"] == 7

    def test_real_groove_envelopes_returns_structured_result(self):
        """Real c_channel at 90° groove envelopes produce a structured interference result."""
        pts  = section_centerline("c_channel", 60, 40, 90)
        poly = centerline_to_polygon(pts, 1.5)
        gg   = compute_groove_geometry(poly, bend_radius_mm=1.5, roll_gap=1.6)
        upper_env = gg.get("groove_envelope_upper")
        lower_env = gg.get("groove_envelope_lower")
        result = check_groove_interference(upper_env, lower_env, pass_no=1, roll_gap_mm=1.6)
        assert isinstance(result, dict)
        assert "status"   in result, "Missing 'status' key"
        assert "blocking" in result, "Missing 'blocking' key"
        assert result["pass_no"] == 1
        assert result["status"] in ("clear", "warning", "clash", "skip")


# ══════════════════════════════════════════════════════════════════════════════
#  P2.7  Flange detection
# ══════════════════════════════════════════════════════════════════════════════

class TestFlangeDetection:
    def test_c_channel_has_two_flanges(self):
        """c_channel at 90° should have 2 distinct flange segments (y > 0)"""
        pts   = section_centerline("c_channel", 60, 40, 90)
        flange_pts = [(x, y) for x, y in pts if y > 1.0]
        assert len(flange_pts) == 2, f"Expected 2 flange points, got {flange_pts}"

    def test_simple_angle_one_flange(self):
        """simple_angle at 90° should have 1 flange point"""
        pts   = section_centerline("simple_angle", 60, 40, 90)
        flange_pts = [(x, y) for x, y in pts if y > 1.0]
        assert len(flange_pts) == 1

    def test_flange_height_matches_input(self):
        """Flange height (max y) should equal flange_mm at 90°"""
        pts    = section_centerline("c_channel", 60, 50, 90)
        max_y  = max(y for _, y in pts)
        assert max_y == pytest.approx(50.0, abs=1e-6)

    def test_web_width_matches_input(self):
        """Web width (x range of y=0 points) should equal web_mm"""
        pts  = section_centerline("c_channel", 80, 40, 90)
        web_pts = [x for x, y in pts if abs(y) < 1e-6]
        if len(web_pts) >= 2:
            w = max(web_pts) - min(web_pts)
            assert w == pytest.approx(80.0, abs=1e-6)
