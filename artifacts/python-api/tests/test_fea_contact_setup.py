"""
test_fea_contact_setup.py — Tests for FEA contact/friction setup
"""
import pytest
from app.engines.fea.contact_setup import (
    build_contact_setup,
    get_friction_coefficient,
    ContactSetup,
    ContactPair,
    SurfaceDefinition,
)


class TestGetFrictionCoefficient:
    def test_gi_friction(self):
        mu, src = get_friction_coefficient("GI")
        assert mu == pytest.approx(0.14)
        assert "GI" in src

    def test_ss_friction(self):
        mu, _ = get_friction_coefficient("SS")
        assert mu == pytest.approx(0.12)

    def test_al_friction(self):
        mu, _ = get_friction_coefficient("AL")
        assert mu == pytest.approx(0.10)

    def test_hsla_friction(self):
        mu, _ = get_friction_coefficient("HSLA")
        assert mu == pytest.approx(0.15)

    def test_unknown_returns_default(self):
        mu, src = get_friction_coefficient("UNKNOWN")
        assert mu == pytest.approx(0.15)
        assert "Default" in src

    def test_lowercase_accepted(self):
        mu1, _ = get_friction_coefficient("GI")
        mu2, _ = get_friction_coefficient("gi")
        assert mu1 == mu2

    def test_all_known_materials_have_friction(self):
        known = ["GI", "SS", "AL", "HSLA", "MS", "CR", "HR", "CU", "TI", "PP"]
        for code in known:
            mu, _ = get_friction_coefficient(code)
            assert 0.0 < mu <= 1.0


class TestBuildContactSetup:
    def test_basic_build(self):
        setup = build_contact_setup("GI")
        assert isinstance(setup, ContactSetup)

    def test_upper_roll_always_present(self):
        setup = build_contact_setup("GI")
        assert setup.upper_roll_present is True

    def test_lower_roll_absent_by_default(self):
        setup = build_contact_setup("GI")
        assert setup.lower_roll_present is False

    def test_lower_roll_present_when_specified(self):
        setup = build_contact_setup("GI", lower_roll_elset="EROLL_LOWER")
        assert setup.lower_roll_present is True

    def test_one_contact_pair_without_lower_roll(self):
        setup = build_contact_setup("GI")
        assert len(setup.contact_pairs) == 1

    def test_two_contact_pairs_with_lower_roll(self):
        setup = build_contact_setup("GI", lower_roll_elset="EROLL_LOWER")
        assert len(setup.contact_pairs) == 2

    def test_friction_matches_material(self):
        setup_gi = build_contact_setup("GI")
        setup_al = build_contact_setup("AL")
        assert setup_gi.friction_coeff != setup_al.friction_coeff
        assert setup_gi.friction_coeff == pytest.approx(0.14)
        assert setup_al.friction_coeff == pytest.approx(0.10)

    def test_friction_override_applied(self):
        setup = build_contact_setup("GI", friction_override=0.20)
        assert setup.friction_coeff == pytest.approx(0.20)

    def test_invalid_friction_override_raises(self):
        with pytest.raises(ValueError, match="friction_override"):
            build_contact_setup("GI", friction_override=1.5)

    def test_negative_friction_override_raises(self):
        with pytest.raises(ValueError, match="friction_override"):
            build_contact_setup("GI", friction_override=-0.1)

    def test_surfaces_defined(self):
        setup = build_contact_setup("GI")
        assert len(setup.surfaces) >= 2

    def test_surfaces_have_correct_names(self):
        setup = build_contact_setup("GI")
        surf_names = [s.name for s in setup.surfaces]
        assert "SURF_ROLL_UPPER" in surf_names
        assert "SURF_STRIP_TOP" in surf_names

    def test_contact_pair_inp_block_format(self):
        pair = ContactPair(
            name="TEST_PAIR",
            master_surface="MASTER",
            slave_surface="SLAVE",
            interaction_name="TEST_INT",
            friction_coeff=0.15,
        )
        block = pair.as_inp_block()
        assert "*SURFACE INTERACTION" in block
        assert "*FRICTION" in block
        assert "*CONTACT PAIR" in block
        assert "MASTER" in block
        assert "SLAVE" in block

    def test_surface_inp_line_format(self):
        surf = SurfaceDefinition("MY_SURF", "ELSET1", "SPOS")
        line = surf.as_inp_line()
        assert "*SURFACE" in line
        assert "MY_SURF" in line
        assert "SPOS" in line

    def test_contact_setup_inp_block_contains_all_parts(self):
        setup = build_contact_setup("GI")
        block = setup.as_inp_block()
        assert "*SURFACE" in block
        assert "*CONTACT PAIR" in block
        assert "*FRICTION" in block

    def test_summary_has_required_keys(self):
        setup = build_contact_setup("GI")
        s = setup.summary()
        for key in ["material_code", "friction_coeff", "n_contact_pairs", "n_surfaces"]:
            assert key in s

    def test_material_code_uppercased_in_setup(self):
        setup = build_contact_setup("gi")
        assert setup.material_code == "GI"

    def test_contact_pair_summary(self):
        setup = build_contact_setup("GI")
        pair_summary = setup.contact_pairs[0].summary()
        for key in ["name", "master_surface", "slave_surface", "friction_coeff"]:
            assert key in pair_summary
