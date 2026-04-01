"""
test_fea_pipeline.py — Tests for FEA pipeline orchestrator
"""
import os
import pytest
from app.engines.fea.fea_pipeline import (
    run_fea_pipeline,
    run_benchmark_case,
    detect_solver,
    FEAPipelineResult,
    FEAPassResult,
    _ARCHITECTURE_DIAGRAM,
)


@pytest.fixture
def benchmark_result(tmp_path):
    result = run_benchmark_case(output_dir=str(tmp_path))
    return result


class TestDetectSolver:
    def test_returns_tuple_of_three(self):
        avail, binary, note = detect_solver("calculix")
        assert isinstance(avail, bool)
        assert isinstance(binary, str)
        assert isinstance(note, str)

    def test_abaqus_not_available_in_ci(self):
        avail, binary, note = detect_solver("abaqus")
        # Abaqus is commercial — not available in test environment
        assert isinstance(avail, bool)

    def test_invalid_backend_raises(self):
        with pytest.raises(ValueError, match="Unknown backend"):
            detect_solver("fluent")

    def test_calculix_binary_name_in_result(self):
        _, binary, _ = detect_solver("calculix")
        assert "ccx" in binary


class TestRunFEAPipeline:
    def test_returns_pipeline_result(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI",
            flat_blank_mm=240.0,
            thickness_mm=2.0,
            station_pitch_mm=600.0,
            roll_radius_mm=90.0,
            face_width_mm=100.0,
            pass_angles_deg=[8.18],
            output_dir=str(tmp_path),
        )
        assert isinstance(result, FEAPipelineResult)

    def test_correct_n_passes(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI",
            flat_blank_mm=240.0, thickness_mm=2.0, station_pitch_mm=600.0,
            roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18, 16.36, 24.54],
            output_dir=str(tmp_path),
        )
        assert result.n_passes == 3

    def test_one_pass_result_per_angle(self, tmp_path):
        angles = [5.0, 10.0, 15.0]
        result = run_fea_pipeline(
            material_code="MS",
            flat_blank_mm=200.0, thickness_mm=1.5, station_pitch_mm=500.0,
            roll_radius_mm=80.0, face_width_mm=80.0,
            pass_angles_deg=angles,
            output_dir=str(tmp_path),
        )
        assert len(result.pass_results) == len(angles)

    def test_all_materials_accepted(self, tmp_path):
        for code in ["GI", "SS", "AL", "HSLA", "MS"]:
            result = run_fea_pipeline(
                material_code=code,
                flat_blank_mm=200.0, thickness_mm=2.0, station_pitch_mm=400.0,
                roll_radius_mm=80.0, face_width_mm=80.0,
                pass_angles_deg=[5.0],
                output_dir=str(tmp_path / code),
            )
            assert result.material_code == code

    def test_mesh_summary_populated(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        assert "total_nodes" in result.mesh_summary
        assert "total_elements" in result.mesh_summary

    def test_material_summary_populated(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        assert "E_mpa" in result.material_summary
        assert "Fy_mpa" in result.material_summary

    def test_contact_summary_populated(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        assert "friction_coeff" in result.contact_summary

    def test_deck_written_for_each_pass(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18, 16.36],
            output_dir=str(tmp_path),
        )
        for p in result.pass_results:
            assert os.path.exists(p.deck_paths.deck_path)

    def test_solver_status_set(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        for p in result.pass_results:
            assert p.solver_status in ("SOLVED", "EXTERNAL_SOLVER_REQUIRED", "SOLVER_FAILED")

    def test_roll_penetration_positive(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        assert result.pass_results[0].roll_penetration_mm > 0.0

    def test_honest_verdict_populated(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        assert len(result.honest_verdict) > 20

    def test_external_solver_required_verdict_when_no_solver(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        if not result.solver_available:
            assert result.runtime_verdict == "EXTERNAL_SOLVER_REQUIRED"

    def test_architecture_diagram_present(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        assert len(result.architecture_diagram) > 100

    def test_validation_report_populated(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        vr = result.validation_report
        assert "total_checks" in vr
        assert "checks" in vr
        assert vr["total_checks"] > 0

    def test_empty_pass_angles_raises(self, tmp_path):
        with pytest.raises(ValueError, match="pass_angles_deg"):
            run_fea_pipeline(
                material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
                station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
                pass_angles_deg=[],
                output_dir=str(tmp_path),
            )

    def test_summary_has_all_required_keys(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
        )
        s = result.summary()
        for key in ["label", "backend", "solver_available", "runtime_verdict", "honest_verdict",
                    "material_code", "n_passes", "mesh_summary", "material_summary", "passes"]:
            assert key in s

    def test_friction_override_applied(self, tmp_path):
        result = run_fea_pipeline(
            material_code="GI", flat_blank_mm=240.0, thickness_mm=2.0,
            station_pitch_mm=600.0, roll_radius_mm=90.0, face_width_mm=100.0,
            pass_angles_deg=[8.18], output_dir=str(tmp_path),
            friction_override=0.20,
        )
        assert result.contact_summary["friction_coeff"] == pytest.approx(0.20)


class TestRunBenchmarkCase:
    def test_returns_pipeline_result(self, benchmark_result):
        assert isinstance(benchmark_result, FEAPipelineResult)

    def test_material_is_gi(self, benchmark_result):
        assert benchmark_result.material_code == "GI"

    def test_one_pass(self, benchmark_result):
        assert benchmark_result.n_passes == 1

    def test_pass_angle_is_8_18(self, benchmark_result):
        assert benchmark_result.pass_results[0].target_angle_deg == pytest.approx(8.18)

    def test_deck_exists(self, benchmark_result):
        p = benchmark_result.pass_results[0]
        assert os.path.exists(p.deck_paths.deck_path)

    def test_run_command_is_ccx(self, benchmark_result):
        p = benchmark_result.pass_results[0]
        assert "ccx" in p.deck_paths.run_command

    def test_result_files_defined(self, benchmark_result):
        p = benchmark_result.pass_results[0]
        assert "frd" in p.deck_paths.result_files
        assert "dat" in p.deck_paths.result_files


class TestArchitectureDiagram:
    def test_diagram_is_string(self):
        assert isinstance(_ARCHITECTURE_DIAGRAM, str)

    def test_diagram_has_fea_pipeline(self):
        assert "FEA PIPELINE" in _ARCHITECTURE_DIAGRAM

    def test_diagram_has_calculix(self):
        assert "CalculiX" in _ARCHITECTURE_DIAGRAM or "calculix" in _ARCHITECTURE_DIAGRAM.lower()

    def test_diagram_has_abaqus(self):
        assert "Abaqus" in _ARCHITECTURE_DIAGRAM or "abaqus" in _ARCHITECTURE_DIAGRAM.lower()

    def test_diagram_separates_heuristic_from_fea(self):
        assert "heuristic" in _ARCHITECTURE_DIAGRAM.lower() or "HEURISTIC" in _ARCHITECTURE_DIAGRAM

    def test_diagram_has_not_fea_label(self):
        assert "NOT FEA" in _ARCHITECTURE_DIAGRAM

    def test_diagram_has_s4r(self):
        assert "S4R" in _ARCHITECTURE_DIAGRAM
