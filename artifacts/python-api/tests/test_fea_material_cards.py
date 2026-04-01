"""
test_fea_material_cards.py — Tests for FEA material card generator
"""
import math
import pytest
from app.engines.fea.material_cards import (
    build_material_card,
    list_available_materials,
    FEAMaterialCard,
    PlasticPoint,
)


class TestBuildMaterialCard:
    def test_gi_card_created(self):
        card = build_material_card("GI")
        assert isinstance(card, FEAMaterialCard)
        assert card.code == "GI"

    def test_lowercase_code_accepted(self):
        card = build_material_card("gi")
        assert card.code == "GI"

    def test_all_10_materials_buildable(self):
        for code in ["GI", "SS", "AL", "HSLA", "MS", "CR", "HR", "CU", "TI", "PP"]:
            card = build_material_card(code)
            assert card.code == code

    def test_invalid_code_raises(self):
        with pytest.raises(ValueError, match="Unknown material code"):
            build_material_card("UNOBTANIUM")

    def test_gi_elastic_properties(self):
        card = build_material_card("GI")
        assert card.E_mpa == pytest.approx(200_000.0)
        assert card.nu == pytest.approx(0.30)

    def test_ss_elastic_properties(self):
        card = build_material_card("SS")
        assert card.E_mpa == pytest.approx(193_000.0)

    def test_al_elastic_properties(self):
        card = build_material_card("AL")
        assert card.E_mpa == pytest.approx(70_000.0)
        assert card.nu == pytest.approx(0.33)

    def test_plastic_table_first_row_is_yield(self):
        card = build_material_card("GI")
        first = card.plastic_table[0]
        assert first.true_plastic_strain == pytest.approx(0.0)
        # Flow stress at yield = K * eps_0^n ≈ Fy
        assert first.true_stress_mpa == pytest.approx(250.0, rel=0.02)

    def test_plastic_table_length(self):
        card = build_material_card("GI", n_plastic_points=20)
        assert card.n_plastic_points == 20
        assert len(card.plastic_table) == 20

    def test_plastic_table_custom_length(self):
        card = build_material_card("GI", n_plastic_points=15)
        assert len(card.plastic_table) == 15

    def test_plastic_table_monotone_increasing(self):
        card = build_material_card("GI")
        for i in range(1, len(card.plastic_table)):
            assert card.plastic_table[i].true_plastic_strain >= card.plastic_table[i-1].true_plastic_strain
            assert card.plastic_table[i].true_stress_mpa >= card.plastic_table[i-1].true_stress_mpa

    def test_plastic_table_max_strain_equals_fracture(self):
        card = build_material_card("GI")
        last = card.plastic_table[-1]
        assert last.true_plastic_strain == pytest.approx(card.fracture_strain, rel=1e-5)

    def test_hardening_law_label(self):
        card = build_material_card("GI")
        assert "Swift" in card.hardening_law

    def test_has_damage_placeholder(self):
        card = build_material_card("GI")
        assert card.has_damage_placeholder is True

    def test_eps_0_positive(self):
        card = build_material_card("GI")
        assert card.eps_0 > 0.0

    def test_density_positive(self):
        for code in ["GI", "SS", "AL", "HSLA"]:
            card = build_material_card(code)
            assert card.density_kg_mm3 > 0.0

    def test_elastic_block_format(self):
        card = build_material_card("GI")
        block = card.elastic_block()
        assert block.startswith("*ELASTIC")
        lines = block.split("\n")
        assert len(lines) == 2
        parts = lines[1].split(",")
        assert len(parts) == 2
        assert float(parts[0].strip()) == pytest.approx(200_000.0)

    def test_plastic_block_format(self):
        card = build_material_card("GI")
        block = card.plastic_block()
        assert block.startswith("*PLASTIC")
        lines = block.split("\n")
        assert len(lines) == card.n_plastic_points + 1

    def test_density_block_format(self):
        card = build_material_card("GI")
        block = card.density_block()
        assert block.startswith("*DENSITY")

    def test_damage_block_is_comment(self):
        card = build_material_card("GI")
        block = card.damage_block()
        assert block.startswith("**")

    def test_full_material_block_contains_all_sections(self):
        card = build_material_card("GI")
        block = card.full_material_block()
        assert "*MATERIAL" in block
        assert "*ELASTIC" in block
        assert "*PLASTIC" in block
        assert "*DENSITY" in block

    def test_summary_has_required_keys(self):
        card = build_material_card("GI")
        s = card.summary()
        for key in ["code", "E_mpa", "nu", "Fy_mpa", "K_mpa", "n_exp", "fracture_strain"]:
            assert key in s

    def test_hsla_higher_yield_than_gi(self):
        gi = build_material_card("GI")
        hsla = build_material_card("HSLA")
        assert hsla.Fy_mpa > gi.Fy_mpa

    def test_plastic_point_inp_line(self):
        pt = PlasticPoint(350.0, 0.05)
        line = pt.as_inp_line()
        parts = line.split(",")
        assert len(parts) == 2
        assert float(parts[0]) == pytest.approx(350.0)
        assert float(parts[1]) == pytest.approx(0.05)


class TestListAvailableMaterials:
    def test_returns_10_materials(self):
        mats = list_available_materials()
        assert len(mats) == 10

    def test_all_have_code(self):
        for m in list_available_materials():
            assert "code" in m
            assert len(m["code"]) >= 2

    def test_gi_in_list(self):
        codes = [m["code"] for m in list_available_materials()]
        assert "GI" in codes
