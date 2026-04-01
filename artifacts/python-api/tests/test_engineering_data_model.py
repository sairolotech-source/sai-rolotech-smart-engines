"""
test_engineering_data_model.py — Tests for Central Engineering Data Model

Tests COPRA Criterion I: typed model coverage for all 9 sub-areas.
"""
import pytest
import json
from app.models.engineering_data_model import (
    MaterialSpec, BendSpec, ProfileSpec, FlowerPass, FlowerData,
    StationState, RollStation, RollToolingData, ValidationResults, DefectResult,
    ReportOutput, RFProject,
)


# ─── MaterialSpec ─────────────────────────────────────────────────────────────

class TestMaterialSpec:
    def _gi(self):
        return MaterialSpec(
            code="GI", name="Galvanised Iron", fy_mpa=250, uts_mpa=320,
            e_gpa=200, elongation_pct=28, n_value=0.18, r_value=1.0,
            k_factor=0.44, density_kg_m3=7850,
        )

    def test_fields_present(self):
        m = self._gi()
        assert m.code == "GI"
        assert m.fy_mpa == 250
        assert m.uts_mpa == 320
        assert m.e_gpa == 200
        assert m.elongation_pct == 28
        assert m.n_value == 0.18
        assert m.r_value == 1.0
        assert m.k_factor == 0.44
        assert m.density_kg_m3 == 7850

    def test_json_round_trip(self):
        m = self._gi()
        data = m.model_dump()
        m2 = MaterialSpec(**data)
        assert m2.code == m.code
        assert m2.fy_mpa == m.fy_mpa

    def test_all_material_codes(self):
        for code, fy, uts in [("SS", 310, 620), ("AL", 160, 220), ("HSLA", 420, 530)]:
            m = MaterialSpec(code=code, name=code, fy_mpa=fy, uts_mpa=uts,
                             e_gpa=200, elongation_pct=20, n_value=0.18,
                             r_value=1.0, k_factor=0.44, density_kg_m3=7850)
            assert m.code == code
            assert m.fy_mpa == fy


# ─── BendSpec ────────────────────────────────────────────────────────────────

class TestBendSpec:
    def test_basic_creation(self):
        b = BendSpec(bend_id=1, target_angle_deg=90.0, inner_radius_mm=3.0)
        assert b.bend_id == 1
        assert b.target_angle_deg == 90.0
        assert b.inner_radius_mm == 3.0
        assert b.direction == "up"
        assert not b.is_return_bend

    def test_return_bend(self):
        b = BendSpec(bend_id=2, target_angle_deg=180.0, inner_radius_mm=2.0, is_return_bend=True)
        assert b.is_return_bend

    def test_strain_and_allowance(self):
        b = BendSpec(bend_id=1, target_angle_deg=90.0, inner_radius_mm=3.0,
                     outer_fibre_strain=0.167, bend_allowance_mm=5.74)
        assert abs(b.outer_fibre_strain - 0.167) < 0.01
        assert abs(b.bend_allowance_mm - 5.74) < 0.01


# ─── ProfileSpec ─────────────────────────────────────────────────────────────

class TestProfileSpec:
    def test_basic_lipped_channel(self):
        bends = [BendSpec(bend_id=i+1, target_angle_deg=90.0, inner_radius_mm=3.0) for i in range(4)]
        p = ProfileSpec(
            profile_type="lipped_channel",
            section_width_mm=220, section_height_mm=80,
            bends=bends, flat_blank_mm=151.5, coil_strip_width_mm=153.0,
        )
        assert p.profile_type == "lipped_channel"
        assert p.section_width_mm == 220
        assert p.bend_count == 4
        assert p.flat_blank_mm == 151.5

    def test_segment_lengths(self):
        p = ProfileSpec(
            profile_type="c_channel", section_width_mm=100, section_height_mm=50,
            segment_lengths_mm=[30, 50, 30], bend_angles_deg=[90.0, 90.0],
        )
        assert len(p.segment_lengths_mm) == 3
        assert p.bend_count == 2

    def test_is_symmetric_default(self):
        p = ProfileSpec(profile_type="angle_section", section_width_mm=50, section_height_mm=50)
        assert p.is_symmetric


# ─── FlowerPass ───────────────────────────────────────────────────────────────

class TestFlowerPass:
    def test_basic_pass(self):
        fp = FlowerPass(
            pass_number=3, label="intermediate forming",
            bend_angles_deg=[45.0, 45.0, 45.0], progression_pct=50.0,
        )
        assert fp.pass_number == 3
        assert fp.bend_angles_deg == [45.0, 45.0, 45.0]
        assert fp.progression_pct == 50.0
        assert not fp.is_calibration

    def test_calibration_pass(self):
        fp = FlowerPass(pass_number=9, is_calibration=True, label="final calibration",
                        bend_angles_deg=[91.8, 91.8], progression_pct=100.0)
        assert fp.is_calibration

    def test_centerline_xy(self):
        fp = FlowerPass(
            pass_number=1,
            bend_angles_deg=[30.0],
            centerline_xy=[[0.0, 0.0], [50.0, 0.0], [80.0, 25.0]],
        )
        assert len(fp.centerline_xy) == 3

    def test_centerline_xyz(self):
        fp = FlowerPass(
            pass_number=2,
            bend_angles_deg=[60.0],
            centerline_xyz=[[0.0, 0.0, 300.0], [50.0, 0.0, 300.0], [65.0, 43.3, 300.0]],
        )
        assert fp.centerline_xyz[0][2] == 300.0


# ─── FlowerData ───────────────────────────────────────────────────────────────

class TestFlowerData:
    def test_basic(self):
        passes = [
            FlowerPass(pass_number=i+1, bend_angles_deg=[30*i for _ in range(2)])
            for i in range(5)
        ]
        fd = FlowerData(
            section_type="lipped_channel",
            forming_complexity_class="complex",
            complexity_score=9,
            estimated_forming_passes=5,
            pass_plan=passes,
        )
        assert fd.estimated_forming_passes == 5
        assert len(fd.pass_plan) == 5
        assert not fd.has_3d_centerline


# ─── StationState ─────────────────────────────────────────────────────────────

class TestStationState:
    def test_all_fields(self):
        ss = StationState(
            station_no=5,
            pass_label="intermediate forming",
            target_angle_deg=60.0,
            corrected_angle_deg=62.0,
            springback_deg=2.0,
            roll_gap_mm=2.1,
            strip_width_mm=280.0,
            forming_depth_mm=15.3,
            estimated_force_kn=25.5,
            motor_power_kw=7.0,
            outer_fibre_strain_pct=12.5,
            defect_risk="low",
            defect_types=[],
            operator_notes="Monitor edge quality",
        )
        assert ss.station_no == 5
        assert ss.corrected_angle_deg == 62.0
        assert ss.springback_deg == 2.0
        assert ss.motor_power_kw == 7.0


# ─── RollStation ─────────────────────────────────────────────────────────────

class TestRollStation:
    def test_basic(self):
        rs = RollStation(
            station_no=1,
            upper_roll_od_mm=180.0,
            lower_roll_od_mm=170.0,
            upper_bore_mm=50.0,
            lower_bore_mm=50.0,
            face_width_mm=100.0,
            groove_depth_mm=5.0,
            roll_gap_mm=0.0,
        )
        assert rs.upper_roll_od_mm == 180.0
        assert rs.lower_roll_od_mm == 170.0
        assert rs.material_grade == "D2"
        assert rs.hardness_hrc == 60


# ─── ValidationResults ────────────────────────────────────────────────────────

class TestValidationResults:
    def test_validation_type(self):
        vr = ValidationResults(
            springback_deg=1.5,
            corrected_angle_deg=91.5,
            forming_force_n=37333.0,
            forming_force_kn=37.3,
            motor_power_kw=9.9,
            validation_type="heuristic_precheck",
        )
        assert vr.validation_type == "heuristic_precheck"
        assert vr.forming_force_n == 37333.0
        assert not vr.interference_clash_passes

    def test_defect_results(self):
        vr = ValidationResults(
            defects=[
                DefectResult(defect_type="cracking", severity="HIGH",
                             description="Outer fibre strain exceeds fracture limit", blocking=True)
            ],
            blocking_defects=1,
        )
        assert len(vr.defects) == 1
        assert vr.defects[0].blocking
        assert vr.blocking_defects == 1


# ─── RFProject (root model) ───────────────────────────────────────────────────

class TestRFProject:
    def _make_project(self):
        mat = MaterialSpec(code="GI", name="GI", fy_mpa=250, uts_mpa=320,
                           e_gpa=200, elongation_pct=28, n_value=0.18,
                           r_value=1.0, k_factor=0.44, density_kg_m3=7850)
        bends = [BendSpec(bend_id=i+1, target_angle_deg=90.0, inner_radius_mm=3.0) for i in range(4)]
        profile = ProfileSpec(profile_type="lipped_channel", section_width_mm=220,
                              section_height_mm=80, bends=bends)
        return RFProject(
            project_name="Test LC GI 2mm",
            project_ref="SAI-2026-001",
            material=mat, thickness_mm=2.0, profile=profile,
            station_count_recommended=24, station_count_min=22, station_count_premium=29,
            tags=["proof", "GI"],
        )

    def test_project_creation(self):
        proj = self._make_project()
        assert proj.project_name == "Test LC GI 2mm"
        assert proj.material.code == "GI"
        assert proj.profile.profile_type == "lipped_channel"
        assert proj.station_count_recommended == 24

    def test_schema_version(self):
        proj = self._make_project()
        assert proj.schema_version == "2.2.0"

    def test_summary(self):
        proj = self._make_project()
        s = proj.summary()
        assert s["project_name"] == "Test LC GI 2mm"
        assert s["material_code"] == "GI"
        assert s["profile_type"] == "lipped_channel"
        assert s["station_count"] == 24
        assert "proof" in s["tags"]

    def test_json_round_trip(self):
        proj = self._make_project()
        data = proj.model_dump()
        proj2 = RFProject(**data)
        assert proj2.project_name == proj.project_name
        assert proj2.material.fy_mpa == proj.material.fy_mpa
        assert proj2.profile.bend_count == proj.profile.bend_count

    def test_all_optional_fields_none_by_default(self):
        proj = RFProject(project_name="Minimal")
        assert proj.material is None
        assert proj.profile is None
        assert proj.flower is None
        assert proj.tooling is None
        assert proj.validation is None
        assert proj.report is None

    def test_json_serialisable(self):
        proj = self._make_project()
        data = proj.model_dump()
        json_str = json.dumps(data, default=str)
        assert "lipped_channel" in json_str
        assert "GI" in json_str
