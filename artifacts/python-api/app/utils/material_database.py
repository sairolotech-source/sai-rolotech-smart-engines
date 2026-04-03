"""
material_database.py — Full Material Property Database

COPRA-class material data for all 10 supported roll forming materials.
Sources: EN 10327, EN 10130, EN 10029, ASTM A606, DIN 6935.

Properties per material:
  Fy_mpa      : Yield strength (MPa)
  Uts_mpa     : Ultimate tensile strength (MPa)
  E_gpa       : Elastic modulus (GPa)
  elongation_pct: Minimum elongation % (A80 gauge)
  n_value     : Strain hardening exponent (Hollomon power law σ = K·εⁿ)
  r_value     : Anisotropy (Lankford coefficient, average)
  k_factor    : DIN 6935 neutral axis factor (for bend allowance)
  density_kg_m3: Density (kg/m³) for weight / BOM calculations
  min_bend_radius_x_t: Minimum inner bend radius as multiple of thickness
  max_thickness_mm: Practical maximum thickness for roll forming
  notes       : Application context
"""
from typing import Dict, Any

MATERIAL_DB: Dict[str, Dict[str, Any]] = {
    "GI": {
        "name": "Hot-Dip Galvanized (GI)",
        "standard": "EN 10327 / DX51D+Z",
        "Fy_mpa": 250,
        "Uts_mpa": 320,
        "E_gpa": 200,
        "elongation_pct": 28,
        "n_value": 0.18,
        "r_value": 1.6,
        "k_factor": 0.44,
        "density_kg_m3": 7850,
        "min_bend_radius_x_t": 0.5,
        "max_thickness_mm": 3.0,
        "fracture_strain": 0.40,
        "forming_difficulty": "easy",
        "notes": "Most common roll forming material; excellent formability, zinc coating requires larger R/t",
    },
    "CR": {
        "name": "Cold Rolled Steel (CR)",
        "standard": "EN 10130 / DC01–DC05",
        "Fy_mpa": 280,
        "Uts_mpa": 370,
        "E_gpa": 205,
        "elongation_pct": 30,
        "n_value": 0.20,
        "r_value": 1.8,
        "k_factor": 0.44,
        "density_kg_m3": 7850,
        "min_bend_radius_x_t": 0.5,
        "max_thickness_mm": 3.0,
        "fracture_strain": 0.38,
        "forming_difficulty": "easy",
        "notes": "High surface quality; tight tolerances; excellent for precision sections",
    },
    "HR": {
        "name": "Hot Rolled Steel (HR)",
        "standard": "EN 10051 / S235–S355",
        "Fy_mpa": 240,
        "Uts_mpa": 360,
        "E_gpa": 200,
        "elongation_pct": 22,
        "n_value": 0.14,
        "r_value": 1.0,
        "k_factor": 0.42,
        "density_kg_m3": 7850,
        "min_bend_radius_x_t": 1.0,
        "max_thickness_mm": 8.0,
        "fracture_strain": 0.35,
        "forming_difficulty": "moderate",
        "notes": "Structural applications; scale surface; less formable than CR; used for heavy sections",
    },
    "SS": {
        "name": "Stainless Steel Austenitic (SS)",
        "standard": "EN 10088 / 1.4301 (304) / 1.4401 (316)",
        "Fy_mpa": 310,
        "Uts_mpa": 620,
        "E_gpa": 193,
        "elongation_pct": 40,
        "n_value": 0.30,
        "r_value": 1.0,
        "k_factor": 0.50,
        "density_kg_m3": 7930,
        "min_bend_radius_x_t": 1.0,
        "max_thickness_mm": 4.0,
        "fracture_strain": 0.32,
        "forming_difficulty": "hard",
        "notes": "High work-hardening; high springback; requires more stations; galling risk on tooling",
    },
    "AL": {
        "name": "Aluminium Alloy (AL)",
        "standard": "EN 573 / 3003 / 5052 / 6061-T4",
        "Fy_mpa": 160,
        "Uts_mpa": 220,
        "E_gpa": 70,
        "elongation_pct": 12,
        "n_value": 0.20,
        "r_value": 0.7,
        "k_factor": 0.43,
        "density_kg_m3": 2700,
        "min_bend_radius_x_t": 1.0,
        "max_thickness_mm": 4.0,
        "fracture_strain": 0.28,
        "forming_difficulty": "moderate",
        "notes": "Low density; low spring-back force but moderate spring-back angle; prone to surface marking",
    },
    "MS": {
        "name": "Mild Steel (MS)",
        "standard": "IS 513 / IS 2062 Grade E250",
        "Fy_mpa": 250,
        "Uts_mpa": 410,
        "E_gpa": 210,
        "elongation_pct": 23,
        "n_value": 0.16,
        "r_value": 1.2,
        "k_factor": 0.42,
        "density_kg_m3": 7850,
        "min_bend_radius_x_t": 0.8,
        "max_thickness_mm": 6.0,
        "fracture_strain": 0.38,
        "forming_difficulty": "moderate",
        "notes": "Standard structural grade; widely used in Indian roll forming industry",
    },
    "CU": {
        "name": "Copper (CU)",
        "standard": "EN 13600 / CW004A",
        "Fy_mpa": 70,
        "Uts_mpa": 220,
        "E_gpa": 117,
        "elongation_pct": 40,
        "n_value": 0.35,
        "r_value": 0.9,
        "k_factor": 0.44,
        "density_kg_m3": 8960,
        "min_bend_radius_x_t": 0.5,
        "max_thickness_mm": 3.0,
        "fracture_strain": 0.45,
        "forming_difficulty": "moderate",
        "notes": "High conductivity; excellent formability; high density; tooling must avoid contamination",
    },
    "TI": {
        "name": "Titanium (TI)",
        "standard": "ASTM B265 / Grade 2",
        "Fy_mpa": 275,
        "Uts_mpa": 345,
        "E_gpa": 105,
        "elongation_pct": 20,
        "n_value": 0.12,
        "r_value": 3.5,
        "k_factor": 0.50,
        "density_kg_m3": 4510,
        "min_bend_radius_x_t": 2.0,
        "max_thickness_mm": 2.0,
        "fracture_strain": 0.22,
        "forming_difficulty": "very_hard",
        "notes": "Very high springback; must be warm-formed above 1.5mm; dedicated tooling required",
    },
    "PP": {
        "name": "Polypropylene (PP) / Polymer Sheet",
        "standard": "ISO 1873",
        "Fy_mpa": 25,
        "Uts_mpa": 30,
        "E_gpa": 1.4,
        "elongation_pct": 150,
        "n_value": 0.30,
        "r_value": 1.0,
        "k_factor": 0.44,
        "density_kg_m3": 920,
        "min_bend_radius_x_t": 3.0,
        "max_thickness_mm": 5.0,
        "fracture_strain": 0.60,
        "forming_difficulty": "easy",
        "notes": "Very low forces; temperature-sensitive; large spring-back; pre-heat may be required",
    },
    "HSLA": {
        "name": "High-Strength Low-Alloy Steel (HSLA)",
        "standard": "EN 10149-2 / S420MC–S700MC",
        "Fy_mpa": 420,
        "Uts_mpa": 530,
        "E_gpa": 210,
        "elongation_pct": 19,
        "n_value": 0.10,
        "r_value": 1.1,
        "k_factor": 0.45,
        "density_kg_m3": 7850,
        "min_bend_radius_x_t": 2.0,
        "max_thickness_mm": 6.0,
        "fracture_strain": 0.25,
        "forming_difficulty": "hard",
        "notes": "Advanced high-strength; low ductility; very high springback; requires pre-calculated over-bend",
    },
}


def get_material(material_code: str) -> Dict[str, Any]:
    """Return full property dict for a material code. Returns GI as fallback."""
    return MATERIAL_DB.get(material_code.upper(), MATERIAL_DB["GI"])


def list_materials() -> list:
    """Return list of all supported material codes."""
    return list(MATERIAL_DB.keys())


def get_property(material_code: str, prop: str, default: Any = None) -> Any:
    """Return a single property for a material."""
    mat = MATERIAL_DB.get(material_code.upper(), {})
    return mat.get(prop, default)
