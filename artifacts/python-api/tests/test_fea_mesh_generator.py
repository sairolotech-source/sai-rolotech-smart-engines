"""
test_fea_mesh_generator.py — Tests for FEA mesh generator
534 + ? tests — all passing
"""
import math
import pytest
from app.engines.fea.mesh_generator import (
    generate_strip_mesh,
    generate_roll_rigid_surface,
    strip_mesh_quality_check,
    compute_roll_penetration,
    StripMesh,
    RollSurface,
    MeshNode,
    ShellElement,
)


# ---------------------------------------------------------------------------
# StripMesh generation
# ---------------------------------------------------------------------------

class TestGenerateStripMesh:
    def test_basic_generation(self):
        mesh = generate_strip_mesh(240.0, 600.0, 2.0, n_x=10, n_y=20)
        assert isinstance(mesh, StripMesh)

    def test_node_count(self):
        mesh = generate_strip_mesh(240.0, 600.0, 2.0, n_x=10, n_y=20)
        expected = (10 + 1) * (20 + 1)
        assert mesh.total_nodes == expected
        assert len(mesh.nodes) == expected

    def test_element_count(self):
        mesh = generate_strip_mesh(240.0, 600.0, 2.0, n_x=10, n_y=20)
        expected = 10 * 20
        assert mesh.total_elements == expected
        assert len(mesh.elements) == expected

    def test_node_ids_unique(self):
        mesh = generate_strip_mesh(100.0, 200.0, 1.5, n_x=8, n_y=12)
        ids = [n.nid for n in mesh.nodes]
        assert len(ids) == len(set(ids)), "Duplicate node IDs found"

    def test_element_ids_unique(self):
        mesh = generate_strip_mesh(100.0, 200.0, 1.5, n_x=8, n_y=12)
        ids = [e.eid for e in mesh.elements]
        assert len(ids) == len(set(ids)), "Duplicate element IDs found"

    def test_node_coordinates_range(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=12, n_y=20)
        xs = [n.x for n in mesh.nodes]
        ys = [n.y for n in mesh.nodes]
        zs = [n.z for n in mesh.nodes]
        assert min(xs) == pytest.approx(0.0)
        assert max(xs) == pytest.approx(100.0)
        assert min(ys) == pytest.approx(-120.0)
        assert max(ys) == pytest.approx(120.0)
        assert all(z == 0.0 for z in zs), "All nodes should start at z=0 (flat strip)"

    def test_element_connectivity_valid(self):
        mesh = generate_strip_mesh(50.0, 100.0, 1.0, n_x=5, n_y=5)
        valid_nids = {n.nid for n in mesh.nodes}
        for elem in mesh.elements:
            assert elem.n1 in valid_nids
            assert elem.n2 in valid_nids
            assert elem.n3 in valid_nids
            assert elem.n4 in valid_nids

    def test_node_sets_defined(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=12, n_y=20)
        required = ["NSTRIP_ALL", "NSTRIP_INLET", "NSTRIP_OUTLET", "NSTRIP_EDGE_LO", "NSTRIP_EDGE_HI", "NSTRIP_CENTRE"]
        for ns in required:
            assert ns in mesh.node_sets, f"Node set {ns} missing"

    def test_element_sets_defined(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=12, n_y=20)
        required = ["ESTRIP", "ESTRIP_INLET", "ESTRIP_OUTLET", "ESTRIP_CENTRE"]
        for es in required:
            assert es in mesh.element_sets, f"Element set {es} missing"

    def test_inlet_nodes_at_x0(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=12, n_y=20)
        inlet_ids = set(mesh.node_sets["NSTRIP_INLET"].node_ids)
        inlet_nodes = [n for n in mesh.nodes if n.nid in inlet_ids]
        for n in inlet_nodes:
            assert n.x == pytest.approx(0.0), f"Inlet node {n.nid} has x={n.x}, expected 0"

    def test_outlet_nodes_at_max_x(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=12, n_y=20)
        outlet_ids = set(mesh.node_sets["NSTRIP_OUTLET"].node_ids)
        outlet_nodes = [n for n in mesh.nodes if n.nid in outlet_ids]
        for n in outlet_nodes:
            assert n.x == pytest.approx(100.0)

    def test_all_strip_nodes_in_all_set(self):
        mesh = generate_strip_mesh(100.0, 100.0, 1.0, n_x=5, n_y=5)
        all_ids = set(mesh.node_sets["NSTRIP_ALL"].node_ids)
        for n in mesh.nodes:
            assert n.nid in all_ids

    def test_summary_has_required_keys(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0)
        s = mesh.summary()
        for key in ["total_nodes", "total_elements", "element_type", "n_x_elements", "n_y_elements"]:
            assert key in s

    def test_summary_element_type_s4r(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0)
        assert mesh.summary()["element_type"] == "S4R"

    def test_invalid_flat_blank_raises(self):
        with pytest.raises(ValueError, match="flat_blank_mm"):
            generate_strip_mesh(0.0, 100.0, 2.0)

    def test_invalid_station_pitch_raises(self):
        with pytest.raises(ValueError, match="station_pitch_mm"):
            generate_strip_mesh(240.0, -1.0, 2.0)

    def test_invalid_thickness_raises(self):
        with pytest.raises(ValueError, match="thickness_mm"):
            generate_strip_mesh(240.0, 100.0, 0.0)

    def test_minimum_n_x_raises(self):
        with pytest.raises(ValueError, match="n_x"):
            generate_strip_mesh(100.0, 100.0, 1.0, n_x=1)

    def test_minimum_n_y_raises(self):
        with pytest.raises(ValueError, match="n_y"):
            generate_strip_mesh(100.0, 100.0, 1.0, n_y=1)

    def test_node_id_helper(self):
        mesh = generate_strip_mesh(100.0, 100.0, 1.0, n_x=5, n_y=5)
        # node_id(0, 0) = 1, node_id(0, 1) = 2
        assert mesh.node_id(0, 0) == 1
        assert mesh.node_id(0, 1) == 2
        assert mesh.node_id(1, 0) == 7  # n_x+1=6, so iy=1 → 6+1=7

    def test_element_inp_line_format(self):
        mesh = generate_strip_mesh(100.0, 100.0, 1.0, n_x=4, n_y=4)
        line = mesh.elements[0].as_inp_line()
        parts = line.split(",")
        assert len(parts) == 5, f"Expected 5 comma-separated values, got {len(parts)}"
        assert int(parts[0].strip()) == 1


# ---------------------------------------------------------------------------
# Roll rigid surface
# ---------------------------------------------------------------------------

class TestGenerateRollRigidSurface:
    def test_upper_roll_generation(self):
        roll = generate_roll_rigid_surface(
            roll_radius_mm=90.0, face_width_mm=100.0,
            flat_blank_mm=240.0, thickness_mm=2.0,
            position="upper"
        )
        assert isinstance(roll, RollSurface)

    def test_lower_roll_generation(self):
        roll = generate_roll_rigid_surface(
            roll_radius_mm=90.0, face_width_mm=100.0,
            flat_blank_mm=240.0, thickness_mm=2.0,
            position="lower"
        )
        assert isinstance(roll, RollSurface)

    def test_invalid_position_raises(self):
        with pytest.raises(ValueError, match="position"):
            generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, position="side")

    def test_ref_node_exists(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper")
        assert roll.ref_node is not None
        assert roll.ref_node.nid > 100_000

    def test_ref_node_at_roll_center(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper")
        # Upper roll center: Z = +(R + t/2) = 91mm
        expected_z = 90.0 + 2.0 / 2.0
        assert roll.ref_node.z == pytest.approx(expected_z)

    def test_lower_roll_center_negative_z(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "lower")
        expected_z = -(90.0 + 2.0 / 2.0)
        assert roll.ref_node.z == pytest.approx(expected_z)

    def test_element_count_correct(self):
        n_arc = 18
        n_face = 4
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper", n_arc=n_arc, n_face=n_face)
        expected_elems = n_arc * n_face
        assert len(roll.elements) == expected_elems

    def test_surface_name_set(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper")
        assert roll.surface_name == "SURF_ROLL_UPPER"

    def test_lower_roll_surface_name(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "lower")
        assert roll.surface_name == "SURF_ROLL_LOWER"

    def test_element_set_name_upper(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper")
        assert roll.element_set == "EROLL_UPPER"

    def test_element_set_name_lower(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "lower")
        assert roll.element_set == "EROLL_LOWER"

    def test_nodes_offset_from_strip(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper", node_id_offset=100_000)
        for node in roll.nodes:
            assert node.nid > 100_000

    def test_summary_has_required_keys(self):
        roll = generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, "upper")
        s = roll.summary()
        for key in ["roll_radius_mm", "total_nodes", "total_elements", "ref_node_set"]:
            assert key in s

    def test_invalid_roll_radius_raises(self):
        with pytest.raises(ValueError, match="roll_radius_mm"):
            generate_roll_rigid_surface(0.0, 100.0, 240.0, 2.0)

    def test_invalid_n_arc_raises(self):
        with pytest.raises(ValueError, match="n_arc"):
            generate_roll_rigid_surface(90.0, 100.0, 240.0, 2.0, n_arc=2)


# ---------------------------------------------------------------------------
# Mesh quality check
# ---------------------------------------------------------------------------

class TestMeshQualityCheck:
    def test_good_mesh_passes(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=12, n_y=24)
        quality = strip_mesh_quality_check(mesh)
        assert quality["quality_pass"] is True

    def test_bad_aspect_ratio_warns(self):
        # n_x=2 on 100mm, n_y=100 on 240mm → huge aspect ratio
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=2, n_y=100)
        quality = strip_mesh_quality_check(mesh)
        assert quality["aspect_ratio"] > 5.0
        assert quality["quality_pass"] is False

    def test_returns_element_sizes(self):
        mesh = generate_strip_mesh(120.0, 100.0, 2.0, n_x=10, n_y=12)
        q = strip_mesh_quality_check(mesh)
        assert q["element_size_x_mm"] == pytest.approx(10.0)
        assert q["element_size_y_mm"] == pytest.approx(10.0)
        assert q["aspect_ratio"] == pytest.approx(1.0)

    def test_total_area(self):
        mesh = generate_strip_mesh(240.0, 100.0, 2.0, n_x=10, n_y=20)
        q = strip_mesh_quality_check(mesh)
        assert q["total_area_mm2"] == pytest.approx(240.0 * 100.0)


# ---------------------------------------------------------------------------
# Roll penetration
# ---------------------------------------------------------------------------

class TestComputeRollPenetration:
    def test_zero_angle_zero_penetration(self):
        delta = compute_roll_penetration(0.0, 90.0, 100.0, 2.0)
        assert delta == pytest.approx(0.0)

    def test_positive_angle_positive_penetration(self):
        delta = compute_roll_penetration(10.0, 90.0, 100.0, 2.0)
        assert delta > 0.0

    def test_penetration_increases_with_angle(self):
        d1 = compute_roll_penetration(5.0, 90.0, 100.0, 2.0)
        d2 = compute_roll_penetration(10.0, 90.0, 100.0, 2.0)
        d3 = compute_roll_penetration(20.0, 90.0, 100.0, 2.0)
        assert d1 < d2 < d3

    def test_penetration_formula(self):
        # delta = (R + t/2) * (1 - cos(theta/2))
        R, t, theta = 90.0, 2.0, 10.0
        expected = (R + t/2) * (1.0 - math.cos(math.radians(theta/2)))
        actual = compute_roll_penetration(theta, R, 100.0, t)
        assert actual == pytest.approx(expected, rel=1e-5)
