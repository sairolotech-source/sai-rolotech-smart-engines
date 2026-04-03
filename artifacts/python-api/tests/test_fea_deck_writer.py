"""
test_fea_deck_writer.py — Tests for FEA deck writer
"""
import os
import pytest
import tempfile
from app.engines.fea.mesh_generator import generate_strip_mesh, generate_roll_rigid_surface
from app.engines.fea.material_cards import build_material_card
from app.engines.fea.contact_setup import build_contact_setup
from app.engines.fea.deck_writer import (
    write_calculix_deck,
    write_abaqus_deck,
    FEADeckPaths,
)


@pytest.fixture
def basic_setup(tmp_path):
    mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=6, n_y=10)
    upper_roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper", n_arc=8, n_face=2)
    mat_card = build_material_card("GI")
    contact = build_contact_setup("GI")
    return mesh, upper_roll, mat_card, contact, str(tmp_path)


class TestWriteCalculixDeck:
    def test_returns_fea_deck_paths(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, pass_number=1, output_dir=outdir)
        assert isinstance(paths, FEADeckPaths)

    def test_deck_file_created(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert os.path.exists(paths.deck_path)

    def test_deck_file_not_empty(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert paths.deck_size_bytes > 0

    def test_deck_has_heading(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*HEADING" in content

    def test_deck_has_node_block(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*NODE" in content

    def test_deck_has_element_block(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*ELEMENT" in content

    def test_deck_has_s4r_elements(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "S4R" in content

    def test_deck_has_r3d4_rigid_elements(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "R3D4" in content

    def test_deck_has_material_block(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*MATERIAL" in content
        assert "*ELASTIC" in content
        assert "*PLASTIC" in content

    def test_deck_has_shell_section(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*SHELL SECTION" in content

    def test_deck_has_rigid_body(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*RIGID BODY" in content

    def test_deck_has_two_steps(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert content.count("*STEP") == 2
        assert content.count("*END STEP") == 2

    def test_deck_has_contact(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*CONTACT PAIR" in content
        assert "*FRICTION" in content

    def test_deck_has_boundary_conditions(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*BOUNDARY" in content

    def test_deck_has_output_requests(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "*EL PRINT" in content or "*NODE PRINT" in content

    def test_run_command_is_ccx(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert paths.run_command.startswith("ccx ")

    def test_backend_is_calculix(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert paths.backend == "calculix"

    def test_result_files_defined(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert "frd" in paths.result_files
        assert "dat" in paths.result_files

    def test_mesh_csv_files_created(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert os.path.exists(paths.mesh_nodes_path)
        assert os.path.exists(paths.mesh_elements_path)

    def test_nlgeom_enabled(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "NLGEOM" in content

    def test_springback_step_releases_roll(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "springback" in content.lower() or "SPRINGBACK" in content

    def test_custom_job_name(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_calculix_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir, job_name="my_job")
        assert "my_job" in paths.deck_path
        assert paths.job_name == "my_job"


class TestWriteAbaqusDeck:
    def test_returns_fea_deck_paths(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_abaqus_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert isinstance(paths, FEADeckPaths)

    def test_deck_file_created(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_abaqus_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert os.path.exists(paths.deck_path)

    def test_backend_is_abaqus(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_abaqus_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert paths.backend == "abaqus"

    def test_run_command_is_abaqus(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_abaqus_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert paths.run_command.startswith("abaqus ")

    def test_result_files_have_odb(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_abaqus_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        assert "odb" in paths.result_files

    def test_abaqus_header_comment(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_abaqus_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        with open(paths.deck_path) as f:
            content = f.read()
        assert "Abaqus" in content or "abaqus" in content.lower()

    def test_deck_summary_has_geometry(self, basic_setup):
        mesh, roll, mat, contact, outdir = basic_setup
        paths = write_abaqus_deck(mesh, roll, mat, contact, 8.18, output_dir=outdir)
        s = paths.summary()
        assert "geometry_summary" in s
        assert s["geometry_summary"]["element_type"] == "S4R"
