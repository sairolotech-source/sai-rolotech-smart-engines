"""
test_project_persistence.py — Tests for Project Save/Load/Version/Delete

Tests COPRA Criterion I: project persistence and data management.
"""
import pytest
import json
from app.models.engineering_data_model import RFProject, MaterialSpec, ProfileSpec, BendSpec
from app.utils.project_persistence import (
    save_project, load_project_raw, list_projects,
    list_project_versions, delete_project, pipeline_to_project,
)


def _make_project(name="Test Project", ref="REF-001", thickness=2.0, material_code="GI"):
    mat = MaterialSpec(
        code=material_code, name=material_code, fy_mpa=250, uts_mpa=320,
        e_gpa=200, elongation_pct=28, n_value=0.18, r_value=1.0,
        k_factor=0.44, density_kg_m3=7850,
    )
    bends = [BendSpec(bend_id=i+1, target_angle_deg=90.0, inner_radius_mm=3.0) for i in range(4)]
    profile = ProfileSpec(
        profile_type="lipped_channel", section_width_mm=220, section_height_mm=80, bends=bends
    )
    return RFProject(
        project_name=name, project_ref=ref,
        material=mat, thickness_mm=thickness, profile=profile,
        station_count_recommended=24, station_count_min=22, station_count_premium=29,
        tags=["test"], notes="Unit test project",
    )


class TestProjectSave:
    def test_save_returns_project_id(self):
        proj = _make_project()
        result = save_project(proj)
        assert result["status"] == "saved"
        assert result["project_id"]
        assert result["version"] == 1
        delete_project(result["project_id"])

    def test_save_assigns_uuid(self):
        proj = _make_project()
        assert not proj.project_id  # empty before save
        result = save_project(proj)
        assert result["project_id"]  # assigned
        delete_project(result["project_id"])

    def test_save_creates_file(self):
        import os
        proj = _make_project()
        result = save_project(proj)
        assert os.path.exists(result["path"])
        delete_project(result["project_id"])

    def test_save_increments_version(self):
        proj = _make_project()
        r1 = save_project(proj)
        pid = r1["project_id"]
        r2 = save_project(proj)
        r3 = save_project(proj)
        assert r2["version"] == 2
        assert r3["version"] == 3
        delete_project(pid)

    def test_save_project_name_preserved(self):
        proj = _make_project(name="My Special Project")
        result = save_project(proj)
        assert result["project_name"] == "My Special Project"
        delete_project(result["project_id"])


class TestProjectLoad:
    def test_load_latest(self):
        proj = _make_project(name="Load Test")
        result = save_project(proj)
        pid = result["project_id"]
        loaded = load_project_raw(pid)
        assert loaded is not None
        assert loaded["project_name"] == "Load Test"
        delete_project(pid)

    def test_load_material_preserved(self):
        proj = _make_project(material_code="SS")
        result = save_project(proj)
        pid = result["project_id"]
        loaded = load_project_raw(pid)
        assert loaded["material"]["code"] == "SS"
        assert loaded["material"]["fy_mpa"] == 250
        delete_project(pid)

    def test_load_profile_preserved(self):
        proj = _make_project()
        result = save_project(proj)
        pid = result["project_id"]
        loaded = load_project_raw(pid)
        assert loaded["profile"]["profile_type"] == "lipped_channel"
        assert loaded["profile"]["section_width_mm"] == 220
        assert len(loaded["profile"]["bends"]) == 4
        delete_project(pid)

    def test_load_specific_version(self):
        proj = _make_project()
        r1 = save_project(proj)
        pid = r1["project_id"]
        proj.project_name = "Updated Name"
        save_project(proj)  # version 2
        v1_data = load_project_raw(pid, version=1)
        v2_data = load_project_raw(pid, version=2)
        # v1 should have original name
        assert v1_data["version"] == "1"
        assert v2_data["version"] == "2"
        delete_project(pid)

    def test_load_nonexistent_returns_none(self):
        loaded = load_project_raw("nonexistent-id-12345")
        assert loaded is None

    def test_load_preserves_tags(self):
        proj = _make_project()
        proj.tags = ["lipped_channel", "GI", "audit"]
        result = save_project(proj)
        loaded = load_project_raw(result["project_id"])
        assert "GI" in loaded["tags"]
        delete_project(result["project_id"])

    def test_load_preserves_station_counts(self):
        proj = _make_project()
        result = save_project(proj)
        loaded = load_project_raw(result["project_id"])
        assert loaded["station_count_recommended"] == 24
        assert loaded["station_count_min"] == 22
        assert loaded["station_count_premium"] == 29
        delete_project(result["project_id"])


class TestProjectVersions:
    def test_version_list(self):
        proj = _make_project()
        r = save_project(proj)
        pid = r["project_id"]
        save_project(proj)
        save_project(proj)
        versions = list_project_versions(pid)
        assert len(versions) == 3
        assert versions[0]["version"] == 1
        assert versions[2]["version"] == 3
        delete_project(pid)

    def test_version_has_metadata(self):
        proj = _make_project()
        r = save_project(proj)
        pid = r["project_id"]
        versions = list_project_versions(pid)
        assert "file" in versions[0]
        assert "size_bytes" in versions[0]
        assert "saved_at" in versions[0]
        delete_project(pid)

    def test_version_nonexistent(self):
        versions = list_project_versions("nonexistent-id-xyz")
        assert versions == []


class TestProjectList:
    def test_list_returns_list(self):
        projects = list_projects()
        assert isinstance(projects, list)

    def test_list_includes_saved_project(self):
        proj = _make_project(name="Listed Project")
        result = save_project(proj)
        pid = result["project_id"]
        projects = list_projects()
        found = [p for p in projects if p["project_id"] == pid]
        assert len(found) == 1
        assert found[0]["project_name"] == "Listed Project"
        delete_project(pid)

    def test_list_summary_fields(self):
        proj = _make_project()
        result = save_project(proj)
        pid = result["project_id"]
        projects = list_projects()
        found = next(p for p in projects if p["project_id"] == pid)
        assert "material_code" in found
        assert "profile_type" in found
        assert "station_count" in found
        assert "has_flower" in found
        delete_project(pid)


class TestProjectDelete:
    def test_delete_removes_project(self):
        proj = _make_project()
        result = save_project(proj)
        pid = result["project_id"]
        deleted = delete_project(pid)
        assert deleted
        loaded = load_project_raw(pid)
        assert loaded is None

    def test_delete_nonexistent_returns_false(self):
        result = delete_project("nonexistent-id-abc123")
        assert not result


class TestPipelineToProject:
    def test_basic_conversion(self):
        pipeline = {
            "input_engine": {"material": "GI", "sheet_thickness_mm": 2.0},
            "profile_analysis_engine": {
                "profile_type": "lipped_channel",
                "section_width_mm": 220, "section_height_mm": 80,
                "bend_count": 4, "return_bends_count": 0, "is_symmetric": True,
            },
            "advanced_flower_engine": {
                "section_type": "lipped_channel",
                "forming_complexity_class": "complex",
                "complexity_score": 9,
                "estimated_forming_passes": 13,
                "pass_plan": [],
            },
            "station_engine": {
                "recommended_station_count": 24,
                "min_station_count": 22,
                "premium_station_count": 29,
            },
            "shaft_engine": {"suggested_shaft_diameter_mm": 60},
            "bearing_engine": {"suggested_bearing_type": "6212"},
            "springback_engine": {"springback_deg": 1.5, "corrected_angle_deg": 91.5, "model_used": "elastic_plastic"},
            "force_engine": {"estimated_force_n": 37333, "estimated_force_kn": 37.3, "motor_power_kw": 9.9, "torque_nm": 2987},
        }
        proj = pipeline_to_project(pipeline, "GI LC Project", "SAI-2026-001")
        assert proj.material.code == "GI"
        assert proj.thickness_mm == 2.0
        assert proj.profile.profile_type == "lipped_channel"
        assert proj.station_count_recommended == 24
        assert proj.validation.springback_deg == 1.5
        assert proj.validation.forming_force_kn == 37.3
        assert proj.validation.validation_type == "heuristic_precheck"

    def test_conversion_preserves_name(self):
        pipeline = {
            "input_engine": {"material": "SS", "sheet_thickness_mm": 1.5},
            "profile_analysis_engine": {"profile_type": "c_channel", "bend_count": 2},
            "advanced_flower_engine": {"section_type": "c_channel", "forming_complexity_class": "simple", "complexity_score": 4, "estimated_forming_passes": 8, "pass_plan": []},
            "station_engine": {"recommended_station_count": 12, "min_station_count": 10, "premium_station_count": 15},
            "shaft_engine": {}, "bearing_engine": {}, "springback_engine": {}, "force_engine": {},
        }
        proj = pipeline_to_project(pipeline, "SS C-Channel", "REF-SS-001")
        assert proj.project_name == "SS C-Channel"
        assert proj.project_ref == "REF-SS-001"
