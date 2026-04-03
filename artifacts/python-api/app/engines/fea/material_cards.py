"""
material_cards.py — FEA Material Card Generator
Sai Rolotech Smart Engines v2.2.0

Converts the existing Swift/Ramberg-Osgood material database into
solver-ready material definition blocks for both Abaqus and CalculiX.

Material card structure (per Abaqus/CalculiX *MATERIAL block):
  - *ELASTIC     : Young's modulus E, Poisson's ratio nu
  - *PLASTIC     : (true_stress, true_plastic_strain) table
  - *DENSITY     : mass density (for dynamic/inertia effects)
  - *DAMAGE INITIATION (placeholder where fracture strain is available)

All stress values in MPa, strains dimensionless (consistent with E in MPa).
"""

import math
from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# Material database (matches advanced_process_simulation.py exactly)
_MATERIAL_DB = {
    "GI": {
        "name": "GI (DX51D Galvanised, EN 10327)",
        "E_mpa": 200_000.0,
        "nu": 0.30,
        "Fy_mpa": 250.0,
        "UTS_mpa": 330.0,
        "K_mpa": 500.0,
        "n": 0.22,
        "fracture_strain": 0.28,
        "density_kg_mm3": 7.85e-6,
    },
    "SS": {
        "name": "Stainless Steel 304 (AISI 304, EN 10088)",
        "E_mpa": 193_000.0,
        "nu": 0.30,
        "Fy_mpa": 310.0,
        "UTS_mpa": 620.0,
        "K_mpa": 1270.0,
        "n": 0.34,
        "fracture_strain": 0.40,
        "density_kg_mm3": 7.93e-6,
    },
    "AL": {
        "name": "Aluminium 5052-H32 (ASTM B209)",
        "E_mpa": 70_000.0,
        "nu": 0.33,
        "Fy_mpa": 160.0,
        "UTS_mpa": 230.0,
        "K_mpa": 430.0,
        "n": 0.19,
        "fracture_strain": 0.20,
        "density_kg_mm3": 2.68e-6,
    },
    "HSLA": {
        "name": "High Strength Low Alloy S420MC (EN 10149-2)",
        "E_mpa": 210_000.0,
        "nu": 0.29,
        "Fy_mpa": 420.0,
        "UTS_mpa": 520.0,
        "K_mpa": 900.0,
        "n": 0.16,
        "fracture_strain": 0.19,
        "density_kg_mm3": 7.85e-6,
    },
    "MS": {
        "name": "Mild Steel S275JR (EN 10025)",
        "E_mpa": 210_000.0,
        "nu": 0.30,
        "Fy_mpa": 275.0,
        "UTS_mpa": 430.0,
        "K_mpa": 720.0,
        "n": 0.20,
        "fracture_strain": 0.22,
        "density_kg_mm3": 7.85e-6,
    },
    "CR": {
        "name": "Cold Rolled DC04 (EN 10130)",
        "E_mpa": 205_000.0,
        "nu": 0.30,
        "Fy_mpa": 280.0,
        "UTS_mpa": 380.0,
        "K_mpa": 540.0,
        "n": 0.23,
        "fracture_strain": 0.30,
        "density_kg_mm3": 7.85e-6,
    },
    "HR": {
        "name": "Hot Rolled S235JR (EN 10025)",
        "E_mpa": 200_000.0,
        "nu": 0.30,
        "Fy_mpa": 240.0,
        "UTS_mpa": 380.0,
        "K_mpa": 700.0,
        "n": 0.18,
        "fracture_strain": 0.25,
        "density_kg_mm3": 7.85e-6,
    },
    "CU": {
        "name": "Copper C11000 (ASTM B187)",
        "E_mpa": 110_000.0,
        "nu": 0.34,
        "Fy_mpa": 200.0,
        "UTS_mpa": 275.0,
        "K_mpa": 450.0,
        "n": 0.25,
        "fracture_strain": 0.35,
        "density_kg_mm3": 8.96e-6,
    },
    "TI": {
        "name": "Titanium Grade 2 (ASTM B265)",
        "E_mpa": 105_000.0,
        "nu": 0.36,
        "Fy_mpa": 275.0,
        "UTS_mpa": 345.0,
        "K_mpa": 850.0,
        "n": 0.20,
        "fracture_strain": 0.22,
        "density_kg_mm3": 4.51e-6,
    },
    "PP": {
        "name": "Polypropylene Homopolymer PP-H (ISO 178)",
        "E_mpa": 1_600.0,
        "nu": 0.40,
        "Fy_mpa": 30.0,
        "UTS_mpa": 35.0,
        "K_mpa": 50.0,
        "n": 0.12,
        "fracture_strain": 0.50,
        "density_kg_mm3": 0.91e-6,
    },
}


@dataclass
class PlasticPoint:
    true_stress_mpa: float
    true_plastic_strain: float

    def as_inp_line(self) -> str:
        return f"{self.true_stress_mpa:.4f},{self.true_plastic_strain:.6f}"


@dataclass
class FEAMaterialCard:
    """Complete FEA material card for one material."""
    code: str
    name: str
    E_mpa: float
    nu: float
    Fy_mpa: float
    UTS_mpa: float
    density_kg_mm3: float
    hardening_law: str
    K_mpa: float
    n_exp: float
    eps_0: float
    fracture_strain: float
    plastic_table: List[PlasticPoint]
    n_plastic_points: int
    has_damage_placeholder: bool
    source_standard: str

    def elastic_block(self) -> str:
        return f"*ELASTIC\n{self.E_mpa:.1f},{self.nu:.3f}"

    def plastic_block(self) -> str:
        lines = ["*PLASTIC"]
        for pt in self.plastic_table:
            lines.append(pt.as_inp_line())
        return "\n".join(lines)

    def density_block(self) -> str:
        return f"*DENSITY\n{self.density_kg_mm3:.4e}"

    def damage_block(self) -> str:
        if not self.has_damage_placeholder:
            return ""
        return (
            f"** Damage initiation placeholder — fracture strain = {self.fracture_strain:.4f}\n"
            f"** Activate *DAMAGE INITIATION, CRITERION=DUCTILE when solver licence permits\n"
            f"**   {self.fracture_strain:.4f},0.333,1.0"
        )

    def full_material_block(self, backend: str = "calculix") -> str:
        """
        Return complete material block as solver input text.
        backend: 'calculix' or 'abaqus' (syntax is identical for these keywords)
        """
        lines = [
            f"*MATERIAL, NAME={self.code}",
            self.elastic_block(),
            self.plastic_block(),
            self.density_block(),
        ]
        dmg = self.damage_block()
        if dmg:
            lines.append(dmg)
        return "\n".join(lines)

    def summary(self) -> dict:
        return {
            "code": self.code,
            "name": self.name,
            "E_mpa": self.E_mpa,
            "nu": self.nu,
            "Fy_mpa": self.Fy_mpa,
            "UTS_mpa": self.UTS_mpa,
            "K_mpa": self.K_mpa,
            "n_exp": self.n_exp,
            "eps_0_prestrain": round(self.eps_0, 6),
            "fracture_strain": self.fracture_strain,
            "hardening_law": self.hardening_law,
            "n_plastic_points": self.n_plastic_points,
            "has_damage_placeholder": self.has_damage_placeholder,
        }


def _swift_true_stress(K: float, eps_0: float, n: float, eps_p: float) -> float:
    """Swift hardening: σ = K*(ε₀ + εp)^n"""
    return K * (eps_0 + eps_p) ** n


def _build_plastic_table(
    E_mpa: float,
    Fy_mpa: float,
    K_mpa: float,
    n: float,
    fracture_strain: float,
    n_points: int = 20,
) -> Tuple[float, List[PlasticPoint]]:
    """
    Build (true_stress, true_plastic_strain) hardening table via Swift law.
    The first row is (Fy, 0.0) — onset of yield.
    Subsequent rows cover 0 to fracture_strain.

    Returns (eps_0, [PlasticPoint, ...])
    """
    eps_0 = (Fy_mpa / K_mpa) ** (1.0 / n)
    points: List[PlasticPoint] = []

    # First point: yield onset
    sigma_yield = _swift_true_stress(K_mpa, eps_0, n, 0.0)
    points.append(PlasticPoint(round(sigma_yield, 4), 0.0))

    # Distribute remaining points geometrically for better resolution at low strain
    for i in range(1, n_points):
        # Geometric spacing: more points at small strains where gradient is steep
        t = (i / (n_points - 1)) ** 1.5
        eps_p = t * fracture_strain
        sigma = _swift_true_stress(K_mpa, eps_0, n, eps_p)
        points.append(PlasticPoint(round(sigma, 4), round(eps_p, 6)))

    return eps_0, points


def build_material_card(code: str, n_plastic_points: int = 20) -> FEAMaterialCard:
    """
    Build a complete FEA material card from the material database.

    Parameters
    ----------
    code             : material code (GI, SS, AL, HSLA, MS, CR, HR, CU, TI, PP)
    n_plastic_points : number of rows in the *PLASTIC hardening table (default 20)

    Returns
    -------
    FEAMaterialCard with elastic, plastic, density, damage placeholder data.
    """
    code = code.upper()
    if code not in _MATERIAL_DB:
        available = sorted(_MATERIAL_DB.keys())
        raise ValueError(f"Unknown material code {code!r}. Available: {available}")

    mat = _MATERIAL_DB[code]
    E = mat["E_mpa"]
    nu = mat["nu"]
    Fy = mat["Fy_mpa"]
    UTS = mat["UTS_mpa"]
    K = mat["K_mpa"]
    n = mat["n"]
    ef = mat["fracture_strain"]
    rho = mat["density_kg_mm3"]
    name = mat["name"]

    eps_0, plastic_table = _build_plastic_table(E, Fy, K, n, ef, n_plastic_points)

    # Source standard (embedded in name string)
    source_standard = name.split("(")[-1].rstrip(")") if "(" in name else "N/A"

    return FEAMaterialCard(
        code=code,
        name=name,
        E_mpa=E,
        nu=nu,
        Fy_mpa=Fy,
        UTS_mpa=UTS,
        density_kg_mm3=rho,
        hardening_law="Swift: σ = K*(ε₀+εp)^n",
        K_mpa=K,
        n_exp=n,
        eps_0=round(eps_0, 8),
        fracture_strain=ef,
        plastic_table=plastic_table,
        n_plastic_points=len(plastic_table),
        has_damage_placeholder=True,
        source_standard=source_standard,
    )


def list_available_materials() -> List[dict]:
    """Return list of all material codes with basic properties."""
    result = []
    for code, mat in _MATERIAL_DB.items():
        result.append({
            "code": code,
            "name": mat["name"],
            "E_mpa": mat["E_mpa"],
            "Fy_mpa": mat["Fy_mpa"],
            "K_mpa": mat["K_mpa"],
            "n": mat["n"],
            "fracture_strain": mat["fracture_strain"],
        })
    return result
