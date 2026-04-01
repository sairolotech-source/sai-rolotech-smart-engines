"""
contact_setup.py — FEA Contact and Friction Setup
Sai Rolotech Smart Engines v2.2.0

Defines the contact pair definitions for roll-strip interaction.

Contact model:
  - Master surface: roll rigid surface (SURF_ROLL_UPPER / SURF_ROLL_LOWER)
  - Slave surface : strip shell mid-surface (top/bottom face)
  - Formulation  : surface-to-surface, finite sliding (standard Abaqus/CalculiX)
  - Normal        : hard contact (no penetration)
  - Tangential    : Coulomb friction (coefficient μ)

Friction coefficients by material (from roll forming literature):
  - Steel on hardened roll steel: μ = 0.10 – 0.15 (with lubrication)
  - Galvanised steel on roll   : μ = 0.12 – 0.18
  - Aluminium on roll          : μ = 0.08 – 0.12
  - Stainless steel on roll    : μ = 0.10 – 0.15
  - Default (unlubricated)     : μ = 0.20
"""

from dataclasses import dataclass, field
from typing import List, Optional


# Friction coefficients by material code
_FRICTION_COEFFS = {
    "GI":   0.14,   # galvanised steel + mineral oil
    "SS":   0.12,   # stainless steel + emulsion
    "AL":   0.10,   # aluminium + drawing oil
    "HSLA": 0.15,   # HSLA + mineral oil
    "MS":   0.15,   # mild steel + mineral oil
    "CR":   0.12,   # cold-rolled + clean room oil
    "HR":   0.18,   # hot-rolled, rougher surface
    "CU":   0.12,   # copper + emulsion
    "TI":   0.18,   # titanium, dry forming
    "PP":   0.25,   # polymer, dry
}

_DEFAULT_FRICTION = 0.15


@dataclass
class ContactPair:
    """One master–slave contact pair."""
    name: str
    master_surface: str
    slave_surface: str
    interaction_name: str
    friction_coeff: float
    normal_model: str = "HARD"
    formulation: str = "SURFACE TO SURFACE"
    sliding: str = "FINITE"

    def as_inp_block(self, backend: str = "calculix") -> str:
        """
        Return the solver input block for this contact pair.
        backend: 'calculix' or 'abaqus' (syntax is compatible).
        """
        lines = [
            f"** Contact pair: {self.name}",
            f"*SURFACE INTERACTION, NAME={self.interaction_name}",
            f"*SURFACE BEHAVIOR, PRESSURE-OVERCLOSURE={self.normal_model}",
            f"*FRICTION",
            f"{self.friction_coeff:.4f},",
            f"*CONTACT PAIR, INTERACTION={self.interaction_name}, TYPE={self.formulation}",
            f"{self.slave_surface},{self.master_surface}",
        ]
        return "\n".join(lines)

    def summary(self) -> dict:
        return {
            "name": self.name,
            "master_surface": self.master_surface,
            "slave_surface": self.slave_surface,
            "interaction_name": self.interaction_name,
            "friction_coeff": self.friction_coeff,
            "normal_model": self.normal_model,
            "formulation": self.formulation,
            "sliding": self.sliding,
        }


@dataclass
class SurfaceDefinition:
    """Named surface (ELEMENT-based shell face)."""
    name: str
    element_set: str
    face: str   # S1..S6 for solid, SPOS/SNEG for shell

    def as_inp_line(self) -> str:
        return f"*SURFACE, NAME={self.name}, TYPE=ELEMENT\n{self.element_set},{self.face}"


@dataclass
class ContactSetup:
    """Complete contact setup for a roll-strip forming simulation."""
    material_code: str
    friction_coeff: float
    contact_pairs: List[ContactPair]
    surfaces: List[SurfaceDefinition]
    n_rolls: int
    upper_roll_present: bool
    lower_roll_present: bool
    friction_source: str

    def as_inp_block(self, backend: str = "calculix") -> str:
        lines = ["** ===== SURFACE DEFINITIONS ====="]
        for surf in self.surfaces:
            lines.append(surf.as_inp_line())
        lines.append("")
        lines.append("** ===== CONTACT PAIRS =====")
        for pair in self.contact_pairs:
            lines.append(pair.as_inp_block(backend))
            lines.append("")
        return "\n".join(lines)

    def summary(self) -> dict:
        return {
            "material_code": self.material_code,
            "friction_coeff": self.friction_coeff,
            "friction_source": self.friction_source,
            "n_contact_pairs": len(self.contact_pairs),
            "n_surfaces": len(self.surfaces),
            "upper_roll_present": self.upper_roll_present,
            "lower_roll_present": self.lower_roll_present,
            "pairs": [p.summary() for p in self.contact_pairs],
        }


def get_friction_coefficient(material_code: str) -> tuple:
    """
    Return (friction_coeff, source_note) for the given material.
    """
    code = material_code.upper()
    mu = _FRICTION_COEFFS.get(code, _DEFAULT_FRICTION)
    if code in _FRICTION_COEFFS:
        source = f"Literature value for {code} on hardened roll steel with lubrication"
    else:
        source = f"Default friction coefficient (material {code!r} not in database)"
    return mu, source


def build_contact_setup(
    material_code: str,
    upper_roll_elset: str = "EROLL_UPPER",
    lower_roll_elset: Optional[str] = None,
    strip_top_elset: str = "ESTRIP",
    strip_bot_elset: str = "ESTRIP",
    friction_override: Optional[float] = None,
) -> ContactSetup:
    """
    Build complete contact setup for roll-strip forming simulation.

    Parameters
    ----------
    material_code      : material code (GI, SS, AL, etc.)
    upper_roll_elset   : element set name for upper roll rigid mesh
    lower_roll_elset   : element set name for lower roll (None = lower roll absent/flat)
    strip_top_elset    : element set for strip top surface
    strip_bot_elset    : element set for strip bottom surface
    friction_override  : override friction coefficient (None = use database value)

    Returns
    -------
    ContactSetup with contact pairs and surface definitions.
    """
    if friction_override is not None:
        if friction_override < 0.0 or friction_override > 1.0:
            raise ValueError(f"friction_override must be in [0, 1], got {friction_override}")
        mu = friction_override
        friction_source = f"User override: μ = {friction_override}"
    else:
        mu, friction_source = get_friction_coefficient(material_code)

    surfaces: List[SurfaceDefinition] = []
    contact_pairs: List[ContactPair] = []

    # Upper roll surface (rigid R3D4 elements, outer face)
    upper_roll_surf = SurfaceDefinition(
        name="SURF_ROLL_UPPER",
        element_set=upper_roll_elset,
        face="SPOS",
    )
    surfaces.append(upper_roll_surf)

    # Strip top surface (SPOS = positive normal face of shell)
    strip_top_surf = SurfaceDefinition(
        name="SURF_STRIP_TOP",
        element_set=strip_top_elset,
        face="SPOS",
    )
    surfaces.append(strip_top_surf)

    # Upper roll contacts strip top
    pair_upper = ContactPair(
        name="UPPER_ROLL_STRIP",
        master_surface="SURF_ROLL_UPPER",
        slave_surface="SURF_STRIP_TOP",
        interaction_name=f"INTERACT_UPPER",
        friction_coeff=mu,
    )
    contact_pairs.append(pair_upper)

    lower_roll_present = lower_roll_elset is not None
    if lower_roll_present:
        lower_roll_surf = SurfaceDefinition(
            name="SURF_ROLL_LOWER",
            element_set=lower_roll_elset,
            face="SNEG",
        )
        surfaces.append(lower_roll_surf)

        strip_bot_surf = SurfaceDefinition(
            name="SURF_STRIP_BOT",
            element_set=strip_bot_elset,
            face="SNEG",
        )
        surfaces.append(strip_bot_surf)

        pair_lower = ContactPair(
            name="LOWER_ROLL_STRIP",
            master_surface="SURF_ROLL_LOWER",
            slave_surface="SURF_STRIP_BOT",
            interaction_name="INTERACT_LOWER",
            friction_coeff=mu,
        )
        contact_pairs.append(pair_lower)

    return ContactSetup(
        material_code=material_code.upper(),
        friction_coeff=mu,
        contact_pairs=contact_pairs,
        surfaces=surfaces,
        n_rolls=1 + int(lower_roll_present),
        upper_roll_present=True,
        lower_roll_present=lower_roll_present,
        friction_source=friction_source,
    )
