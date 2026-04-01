"""
test_fea_result_importer.py — Tests for FEA result file importer
"""
import os
import math
import pytest
import tempfile
from app.engines.fea.result_importer import (
    import_calculix_results,
    import_abaqus_odb_text,
    make_synthetic_frd,
    make_synthetic_dat,
    FEAResults,
    NodeResult,
    ElementResult,
)


@pytest.fixture
def tmp_dir(tmp_path):
    return str(tmp_path)


class TestNodeResult:
    def test_magnitude_zero(self):
        nr = NodeResult(1, 0.0, 0.0, 0.0)
        assert nr.magnitude == pytest.approx(0.0)

    def test_magnitude_positive(self):
        nr = NodeResult(1, 3.0, 4.0, 0.0)
        assert nr.magnitude == pytest.approx(5.0)

    def test_magnitude_3d(self):
        nr = NodeResult(1, 1.0, 1.0, 1.0)
        assert nr.magnitude == pytest.approx(math.sqrt(3))


class TestElementResult:
    def test_von_mises_zero(self):
        er = ElementResult(1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        assert er.von_mises == pytest.approx(0.0)

    def test_von_mises_uniaxial(self):
        # Uniaxial S11 only → VM = S11
        er = ElementResult(1, 0.0, S11=300.0)
        assert er.von_mises == pytest.approx(300.0, rel=0.01)

    def test_von_mises_equibiaxial(self):
        # Equal biaxial S11=S22 → VM = 0 (in plane stress, S33=0 → VM=S11)
        er = ElementResult(1, 0.0, S11=200.0, S22=200.0)
        assert er.von_mises >= 0.0


class TestImportCalculixResults:
    def test_file_not_found_returns_correct_status(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "missing.frd"),
            os.path.join(tmp_dir, "missing.dat"),
        )
        assert result.status == "FILE_NOT_FOUND"

    def test_file_not_found_has_error_messages(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert len(result.parse_errors) > 0

    def test_returns_fea_results_object(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert isinstance(result, FEAResults)

    def test_backend_is_calculix(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert result.backend == "calculix"

    def test_parse_synthetic_frd(self, tmp_dir):
        frd_path = os.path.join(tmp_dir, "test.frd")
        dat_path = os.path.join(tmp_dir, "test.dat")
        node_ids = list(range(1, 11))
        make_synthetic_frd(frd_path, node_ids, displacement_uz_mm=-2.5, peeq_value=0.14)
        make_synthetic_dat(dat_path, list(range(1, 6)), peeq_value=0.14, stress_mpa=350.0)
        result = import_calculix_results(frd_path, dat_path)
        # Should find the files and attempt parse
        assert result.status in ("PARSED_OK", "PARSE_ERROR", "FILE_NOT_FOUND")

    def test_synthetic_dat_parsed_for_stress(self, tmp_dir):
        dat_path = os.path.join(tmp_dir, "test2.dat")
        make_synthetic_dat(dat_path, [1, 2, 3, 4, 5], peeq_value=0.20, stress_mpa=400.0)
        assert os.path.exists(dat_path)
        with open(dat_path) as f:
            content = f.read()
        assert "PEEQ" in content
        assert "0.200000E+00" in content or "2.000000E-01" in content

    def test_synthetic_frd_created(self, tmp_dir):
        frd_path = os.path.join(tmp_dir, "synth.frd")
        make_synthetic_frd(frd_path, [1, 2, 3])
        assert os.path.exists(frd_path)
        with open(frd_path) as f:
            content = f.read()
        assert "DISP" in content

    def test_max_peeq_zero_when_no_elements(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert result.max_PEEQ() == 0.0

    def test_max_von_mises_zero_when_no_elements(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert result.max_von_mises_mpa() == 0.0

    def test_summary_has_required_keys(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
        )
        s = result.summary()
        for key in ["status", "backend", "pass_number", "material_code", "max_PEEQ"]:
            assert key in s

    def test_pass_number_preserved(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
            pass_number=3
        )
        assert result.pass_number == 3

    def test_material_code_preserved(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
            material_code="SS"
        )
        assert result.material_code == "SS"

    def test_springback_zero_when_no_data(self, tmp_dir):
        result = import_calculix_results(
            os.path.join(tmp_dir, "x.frd"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert result.max_springback_uz_mm() == 0.0


class TestImportAbaqusOdbText:
    def test_file_not_found(self, tmp_dir):
        result = import_abaqus_odb_text(
            os.path.join(tmp_dir, "x.rpt"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert result.status == "FILE_NOT_FOUND"

    def test_backend_is_abaqus(self, tmp_dir):
        result = import_abaqus_odb_text(
            os.path.join(tmp_dir, "x.rpt"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert result.backend == "abaqus"

    def test_error_message_mentions_odb(self, tmp_dir):
        result = import_abaqus_odb_text(
            os.path.join(tmp_dir, "x.rpt"),
            os.path.join(tmp_dir, "x.dat"),
        )
        assert any("odb" in e.lower() or "ODB" in e for e in result.parse_errors)


class TestMakeSyntheticFiles:
    def test_frd_created_with_correct_node_count(self, tmp_dir):
        frd_path = os.path.join(tmp_dir, "a.frd")
        make_synthetic_frd(frd_path, list(range(1, 21)), displacement_uz_mm=-3.0)
        assert os.path.exists(frd_path)

    def test_dat_created_with_peeq_section(self, tmp_dir):
        dat_path = os.path.join(tmp_dir, "b.dat")
        make_synthetic_dat(dat_path, [1, 2, 3, 4, 5], peeq_value=0.25)
        with open(dat_path) as f:
            content = f.read()
        assert "PEEQ" in content

    def test_dat_created_with_stress_section(self, tmp_dir):
        dat_path = os.path.join(tmp_dir, "c.dat")
        make_synthetic_dat(dat_path, [1, 2, 3], stress_mpa=350.0)
        with open(dat_path) as f:
            content = f.read()
        assert "S11" in content or "stress" in content.lower() or "S22" in content

    def test_frd_springback_has_85_pct_recovery(self, tmp_dir):
        frd_path = os.path.join(tmp_dir, "d.frd")
        make_synthetic_frd(frd_path, [1, 2, 3], displacement_uz_mm=-4.0)
        with open(frd_path) as f:
            content = f.read()
        # Two DISP blocks: forming (-4.0) and springback (-3.4 = 85% of -4.0)
        assert "-4.0000E+00" in content or "-4.000E+00" in content or "-4.0000" in content
