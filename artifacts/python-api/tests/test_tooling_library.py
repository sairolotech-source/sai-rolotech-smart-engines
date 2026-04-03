"""
test_tooling_library.py — Tests for Reusable Roll Tooling Library

Tests COPRA Criterion I: reusable tooling library with indexed entries.
"""
import pytest
from app.utils.tooling_library import (
    query_tooling_library, get_tooling_entry, get_best_match,
    list_all_section_types, library_summary, TOOLING_LIBRARY,
)


class TestLibrarySummary:
    def test_total_entries(self):
        summary = library_summary()
        assert summary["total_entries"] == len(TOOLING_LIBRARY)
        assert summary["total_entries"] >= 10

    def test_section_types_present(self):
        summary = library_summary()
        types = summary["section_types"]
        assert "lipped_channel" in types
        assert "c_channel" in types
        assert "angle_section" in types
        assert "z_purlin" in types
        assert "hat_section" in types
        assert "box_section" in types

    def test_material_families(self):
        summary = library_summary()
        fams = summary["material_families"]
        assert "mild_steel_family" in fams
        assert "stainless_family" in fams
        assert "aluminium_family" in fams

    def test_thickness_range(self):
        summary = library_summary()
        tr = summary["thickness_range_mm"]
        assert tr["min"] <= 0.5
        assert tr["max"] >= 4.0

    def test_shaft_diameter_range(self):
        summary = library_summary()
        sd = summary["shaft_diameter_range_mm"]
        assert sd["min"] >= 30
        assert sd["max"] <= 100


class TestLibraryEntryStructure:
    def test_all_entries_have_required_fields(self):
        required = [
            "id", "section_type", "material_family", "thickness_min_mm", "thickness_max_mm",
            "description", "shaft_dia_mm", "roll_od_min_mm", "roll_od_max_mm",
            "bearing_type", "roll_material", "roll_hardness_hrc",
            "station_pitch_mm", "station_count_min", "station_count_max",
            "keyway_standard", "typical_face_width_mm", "notes",
        ]
        for entry in TOOLING_LIBRARY:
            for field in required:
                assert field in entry, f"Missing '{field}' in entry {entry.get('id')}"

    def test_unique_ids(self):
        ids = [e["id"] for e in TOOLING_LIBRARY]
        assert len(ids) == len(set(ids)), "Duplicate IDs in tooling library"

    def test_thickness_range_valid(self):
        for entry in TOOLING_LIBRARY:
            assert entry["thickness_min_mm"] < entry["thickness_max_mm"], f"Invalid thickness range in {entry['id']}"

    def test_station_count_range_valid(self):
        for entry in TOOLING_LIBRARY:
            assert entry["station_count_min"] <= entry["station_count_max"], f"Invalid station range in {entry['id']}"

    def test_roll_od_range_valid(self):
        for entry in TOOLING_LIBRARY:
            assert entry["roll_od_min_mm"] <= entry["roll_od_max_mm"], f"Invalid OD range in {entry['id']}"


class TestQueryToolingLibrary:
    def test_no_filter_returns_all(self):
        results = query_tooling_library()
        assert len(results) == len(TOOLING_LIBRARY)

    def test_filter_by_section_type(self):
        results = query_tooling_library(section_type="lipped_channel")
        assert len(results) >= 3
        for r in results:
            assert r["section_type"] == "lipped_channel"

    def test_filter_by_material_gi(self):
        results = query_tooling_library(material_code="GI")
        for r in results:
            assert r["material_family"] == "mild_steel_family"

    def test_filter_by_material_ss(self):
        results = query_tooling_library(material_code="SS")
        for r in results:
            assert r["material_family"] == "stainless_family"

    def test_filter_by_material_al(self):
        results = query_tooling_library(material_code="AL")
        for r in results:
            assert r["material_family"] == "aluminium_family"

    def test_filter_by_thickness(self):
        results = query_tooling_library(thickness_mm=2.0)
        for r in results:
            assert r["thickness_min_mm"] <= 2.0 <= r["thickness_max_mm"]

    def test_filter_heavy_thickness(self):
        results = query_tooling_library(thickness_mm=4.5)
        for r in results:
            assert r["thickness_min_mm"] <= 4.5 <= r["thickness_max_mm"]

    def test_filter_combined(self):
        results = query_tooling_library("lipped_channel", "GI", 2.0)
        assert len(results) >= 1
        for r in results:
            assert r["section_type"] == "lipped_channel"
            assert r["material_family"] == "mild_steel_family"
            assert r["thickness_min_mm"] <= 2.0 <= r["thickness_max_mm"]

    def test_no_match_returns_empty(self):
        results = query_tooling_library(section_type="nonexistent_section")
        assert results == []


class TestGetBestMatch:
    def test_lipped_channel_gi_std(self):
        entry = get_best_match("lipped_channel", "GI", 2.0)
        assert entry is not None
        assert entry["section_type"] == "lipped_channel"
        assert entry["thickness_min_mm"] <= 2.0 <= entry["thickness_max_mm"]

    def test_lipped_channel_ss(self):
        entry = get_best_match("lipped_channel", "SS", 1.5)
        assert entry is not None
        assert entry["material_family"] == "stainless_family"

    def test_lipped_channel_al(self):
        entry = get_best_match("lipped_channel", "AL", 2.0)
        assert entry is not None
        assert entry["material_family"] == "aluminium_family"

    def test_c_channel_standard(self):
        entry = get_best_match("c_channel", "GI", 1.5)
        assert entry is not None
        assert entry["section_type"] == "c_channel"

    def test_c_channel_heavy(self):
        entry = get_best_match("c_channel", "MS", 4.0)
        assert entry is not None
        assert entry["thickness_max_mm"] >= 4.0

    def test_angle_section(self):
        entry = get_best_match("angle_section", "GI", 1.5)
        assert entry is not None
        assert entry["section_type"] == "angle_section"

    def test_z_purlin(self):
        entry = get_best_match("z_purlin", "GI", 2.0)
        assert entry is not None

    def test_hat_section(self):
        entry = get_best_match("hat_section", "CR", 1.2)
        assert entry is not None

    def test_box_section(self):
        entry = get_best_match("box_section", "HR", 3.0)
        assert entry is not None

    def test_nonexistent_returns_none(self):
        entry = get_best_match("nonexistent_profile", "GI", 2.0)
        assert entry is None

    def test_recommended_shaft_diameter(self):
        entry = get_best_match("lipped_channel", "GI", 2.0)
        assert entry["shaft_dia_mm"] >= 40
        assert entry["shaft_dia_mm"] <= 100

    def test_roll_material_grade(self):
        # Heavy gauge should recommend D2 for harder material
        entry = get_best_match("lipped_channel", "GI", 5.0)
        assert entry["roll_material"] in ("D2", "EN31", "H13")

    def test_bearing_type_format(self):
        entry = get_best_match("c_channel", "GI", 2.0)
        assert entry["bearing_type"].startswith("62"), f"Expected 62xx bearing, got {entry['bearing_type']}"

    def test_keyway_standard(self):
        entry = get_best_match("lipped_channel", "GI", 2.0)
        assert "DIN" in entry["keyway_standard"] or "ISO" in entry["keyway_standard"]


class TestGetToolingEntry:
    def test_valid_id(self):
        entry = get_tooling_entry("LC-STD-MS")
        assert entry is not None
        assert entry["id"] == "LC-STD-MS"
        assert entry["section_type"] == "lipped_channel"

    def test_invalid_id_returns_none(self):
        entry = get_tooling_entry("NONEXISTENT-ID")
        assert entry is None

    def test_all_entries_retrievable(self):
        for entry in TOOLING_LIBRARY:
            retrieved = get_tooling_entry(entry["id"])
            assert retrieved is not None
            assert retrieved["id"] == entry["id"]


class TestListAllSectionTypes:
    def test_returns_sorted_list(self):
        types = list_all_section_types()
        assert types == sorted(types)
        assert len(types) >= 5
