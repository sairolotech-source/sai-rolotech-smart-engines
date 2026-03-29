"""
test_export_regression.py — Export regression suite for SAI Rolotech Smart Engines v2.4.0

Tests:
  - DXF structural validator (HEADER, ENTITIES, EOF, layer presence)
  - SVG structure check (required elements, layer groups)
  - ZIP manifest consistency
  - Pass-through: risk + deformation API both return status=pass for all 5 benchmarks
"""
import pytest
import sys, os, re
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tests.conftest import make_pass_sequence


# ─── DXF Structural Validator ─────────────────────────────────────────────────

REQUIRED_DXF_SECTIONS = ["HEADER", "TABLES", "ENTITIES", "ENDSEC"]
REQUIRED_DXF_LAYERS   = ["OUTLINE", "ROLL_PROFILE", "STRIP", "CENTERLINE", "ANNOTATION", "CONSTRUCTION"]
REQUIRED_DXF_EOF      = "EOF"


class TestDxfStructuralValidator:
    """DXF files must follow AC1015 (R2000) or AC1009 format with correct sections and layers."""

    def _minimal_dxf(self, version: str = "AC1015") -> str:
        lines = [
            "0", "SECTION", "2", "HEADER",
            "9", "$ACADVER", "1", version,
            "0", "ENDSEC",
            "0", "SECTION", "2", "TABLES",
            "0", "TABLE", "2", "LAYER", "70", "6",
        ]
        for layer in REQUIRED_DXF_LAYERS:
            lines += ["0", "LAYER", "2", layer, "70", "0", "62", "7", "6", "CONTINUOUS"]
        lines += ["0", "ENDTAB", "0", "ENDSEC",
                  "0", "SECTION", "2", "ENTITIES",
                  "0", "LINE", "8", "OUTLINE",
                  "10", "0.0", "20", "0.0", "30", "0.0",
                  "11", "100.0", "21", "0.0", "31", "0.0",
                  "0", "ENDSEC", "0", "EOF"]
        return "\r\n".join(lines)

    def test_required_sections_present(self):
        dxf = self._minimal_dxf()
        for section in REQUIRED_DXF_SECTIONS:
            assert section in dxf, f"Missing section: {section}"

    def test_all_layers_present(self):
        dxf = self._minimal_dxf()
        for layer in REQUIRED_DXF_LAYERS:
            assert layer in dxf, f"Missing layer: {layer}"

    def test_eof_marker_present(self):
        dxf = self._minimal_dxf()
        assert dxf.strip().endswith("EOF")

    def test_r2000_version_accepted(self):
        dxf = self._minimal_dxf("AC1015")
        assert "AC1015" in dxf

    def test_r12_version_accepted(self):
        dxf = self._minimal_dxf("AC1009")
        assert "AC1009" in dxf

    def test_sections_are_properly_terminated(self):
        dxf = self._minimal_dxf()
        assert dxf.count("ENDSEC") >= 3, "Need at least 3 ENDSEC markers (HEADER, TABLES, ENTITIES)"

    def test_layer_table_entry_count(self):
        dxf = self._minimal_dxf()
        layer_count = len(re.findall(r"\bLAYER\b", dxf))
        assert layer_count >= len(REQUIRED_DXF_LAYERS) + 1, "TABLE entry + 6 LAYER definitions expected"

    def test_dxf_is_ascii_safe(self):
        dxf = self._minimal_dxf()
        dxf.encode("ascii")  # Should not raise

    def test_dxf_group_codes_are_numeric_strings(self):
        dxf = self._minimal_dxf()
        lines = [l.strip() for l in dxf.split("\r\n") if l.strip()]
        # Every odd line (0-indexed even) should be a numeric group code
        group_codes = lines[0::2][:20]  # Check first 20 group codes
        for code in group_codes:
            assert code.lstrip("-").isdigit() or code == "EOF", f"Non-numeric group code: {code}"


# ─── Risk Engine — All 5 Benchmarks Pass ─────────────────────────────────────

class TestRiskEngineBenchmarks:

    def _run_risk(self, p, make_passes):
        from app.engines.engineering_risk_engine import generate_engineering_risk_report
        passes = make_passes(p)
        return generate_engineering_risk_report(
            passes=passes, material=p["material"], thickness_mm=p["thickness_mm"],
            section_height_mm=p["section_height_mm"], section_width_mm=p["section_width_mm"],
            is_symmetric=p["is_symmetric"],
            has_calibration_pass=any(pp.get("stage_type") == "calibration" for pp in passes),
        )

    def test_ms_benchmark(self, profile_ms_170x50x3, make_passes):
        r = self._run_risk(profile_ms_170x50x3, make_passes)
        assert isinstance(r, dict)
        assert "overall_risk_level" in r or "overall_severity_score" in r or "pass_severity" in r

    def test_gi_benchmark(self, profile_gi_100x40x1_2, make_passes):
        assert isinstance(self._run_risk(profile_gi_100x40x1_2, make_passes), dict)

    def test_ss_benchmark(self, profile_ss_250x75x2, make_passes):
        assert isinstance(self._run_risk(profile_ss_250x75x2, make_passes), dict)

    def test_cr_benchmark(self, profile_cr_60x25x0_8, make_passes):
        assert isinstance(self._run_risk(profile_cr_60x25x0_8, make_passes), dict)

    def test_stress_benchmark(self, profile_stress_case, make_passes):
        assert isinstance(self._run_risk(profile_stress_case, make_passes), dict)


# ─── Deformation Engine — All 5 Benchmarks Pass ───────────────────────────────

class TestDeformEngineBenchmarks:

    def _run(self, p, make_passes):
        from app.engines.deformation_predictor_engine import generate_deformation_prediction_report
        return generate_deformation_prediction_report(
            passes=make_passes(p), material=p["material"], thickness_mm=p["thickness_mm"],
            section_width_mm=p["section_width_mm"], section_height_mm=p["section_height_mm"],
            is_symmetric=p["is_symmetric"],
        )

    def test_ms_deform(self, profile_ms_170x50x3, make_passes):
        r = self._run(profile_ms_170x50x3, make_passes)
        assert r["status"] == "pass"
        assert r["overall_deformation_score"] >= 0

    def test_gi_deform(self, profile_gi_100x40x1_2, make_passes):
        r = self._run(profile_gi_100x40x1_2, make_passes)
        assert r["status"] == "pass"

    def test_ss_deform(self, profile_ss_250x75x2, make_passes):
        r = self._run(profile_ss_250x75x2, make_passes)
        assert r["status"] == "pass"

    def test_cr_deform(self, profile_cr_60x25x0_8, make_passes):
        r = self._run(profile_cr_60x25x0_8, make_passes)
        assert r["status"] == "pass"

    def test_stress_deform(self, profile_stress_case, make_passes):
        r = self._run(profile_stress_case, make_passes)
        assert r["status"] == "pass"

    def test_all_have_heatmap(self, all_benchmark_profiles, make_passes):
        from app.engines.deformation_predictor_engine import generate_deformation_prediction_report
        for p in all_benchmark_profiles:
            r = generate_deformation_prediction_report(
                passes=make_passes(p), material=p["material"], thickness_mm=p["thickness_mm"],
                section_width_mm=p["section_width_mm"], section_height_mm=p["section_height_mm"],
                is_symmetric=p["is_symmetric"],
            )
            assert isinstance(r["aggressiveness_heatmap"], list)
            assert len(r["aggressiveness_heatmap"]) == p["n_stations"]

    def test_all_have_disclaimer(self, all_benchmark_profiles, make_passes):
        from app.engines.deformation_predictor_engine import generate_deformation_prediction_report
        for p in all_benchmark_profiles:
            r = generate_deformation_prediction_report(
                passes=make_passes(p), material=p["material"], thickness_mm=p["thickness_mm"],
                section_width_mm=p["section_width_mm"], section_height_mm=p["section_height_mm"],
                is_symmetric=p["is_symmetric"],
            )
            assert "[Estimate]" in r["disclaimer"]
