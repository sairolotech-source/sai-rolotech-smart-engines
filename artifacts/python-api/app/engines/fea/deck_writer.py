"""
deck_writer.py — FEA Solver Input Deck Writer
Sai Rolotech Smart Engines v2.2.0

Writes complete solver-ready input decks for:
  1. CalculiX (.inp) — open-source, Abaqus-compatible keyword format
  2. Abaqus (.inp)   — commercial Dassault Systèmes format (same keyword syntax)

The deck format is based on the Abaqus keyword input format, which CalculiX
is designed to be compatible with. Both solvers read the same .inp syntax
for the keywords used here.

Deck structure per pass:
  Part A : HEADING, NODE, ELEMENT, NSET/ELSET definitions
  Part B : SHELL SECTION, MATERIAL, ELASTIC, PLASTIC, DENSITY
  Part C : RIGID BODY (roll), SURFACE, CONTACT PAIR, SURFACE INTERACTION, FRICTION
  Part D : INITIAL CONDITIONS (if pass > 1: import prior state)
  Part E : STEP 1 — forming (STATIC, BOUNDARY, OUTPUT)
  Part F : STEP 2 — springback (STATIC, BOUNDARY release roll, OUTPUT)

Node-set ID ranges:
  Strip:     1 – 99,999
  Upper roll: 100,001 – 149,999
  Lower roll: 150,001 – 199,999
"""

import math
import os
from dataclasses import dataclass
from typing import Optional, List

from .mesh_generator import StripMesh, RollSurface, compute_roll_penetration
from .material_cards import FEAMaterialCard
from .contact_setup import ContactSetup


@dataclass
class FEADeckPaths:
    """Paths to generated solver deck files and auxiliary files."""
    backend: str                    # "calculix" or "abaqus"
    deck_path: str                  # main .inp file
    mesh_nodes_path: str            # *NODE data (included from main deck)
    mesh_elements_path: str         # *ELEMENT data (included from main deck)
    output_dir: str                 # directory containing all files
    job_name: str                   # solver job name (used for result file naming)
    run_command: str                # shell command to run solver
    result_files: dict              # expected result file paths
    geometry_summary: dict
    deck_size_bytes: int = 0

    def summary(self) -> dict:
        return {
            "backend": self.backend,
            "deck_path": self.deck_path,
            "job_name": self.job_name,
            "run_command": self.run_command,
            "result_files": self.result_files,
            "geometry_summary": self.geometry_summary,
            "deck_size_bytes": self.deck_size_bytes,
        }


# ---------------------------------------------------------------------------
# Node / element block writers
# ---------------------------------------------------------------------------

def _write_node_block(mesh: StripMesh, upper_roll: RollSurface, lower_roll: Optional[RollSurface]) -> str:
    lines = ["*NODE, NSET=NALL"]
    for node in mesh.nodes:
        lines.append(node.as_inp_line())
    for node in upper_roll.nodes:
        lines.append(node.as_inp_line())
    if lower_roll:
        for node in lower_roll.nodes:
            lines.append(node.as_inp_line())
    return "\n".join(lines)


def _write_element_block(mesh: StripMesh, upper_roll: RollSurface, lower_roll: Optional[RollSurface]) -> str:
    lines = []
    # Strip shell elements
    lines.append("*ELEMENT, TYPE=S4R, ELSET=ESTRIP")
    for elem in mesh.elements:
        lines.append(elem.as_inp_line())
    # Upper roll rigid elements
    lines.append(f"*ELEMENT, TYPE=R3D4, ELSET={upper_roll.element_set}")
    for elem in upper_roll.elements:
        lines.append(elem.as_inp_line())
    if lower_roll:
        lines.append(f"*ELEMENT, TYPE=R3D4, ELSET={lower_roll.element_set}")
        for elem in lower_roll.elements:
            lines.append(elem.as_inp_line())
    return "\n".join(lines)


def _write_nset_block(mesh: StripMesh, upper_roll: RollSurface, lower_roll: Optional[RollSurface]) -> str:
    lines = []
    for name, nset in mesh.node_sets.items():
        lines.append(f"*NSET, NSET={name}")
        # Write 8 node IDs per line (Abaqus/CalculiX convention)
        ids = nset.node_ids
        for i in range(0, len(ids), 8):
            lines.append(",".join(str(n) for n in ids[i:i+8]))
    # Roll reference node sets
    lines.append(f"*NSET, NSET={upper_roll.ref_node_set}")
    lines.append(str(upper_roll.ref_node.nid))
    if lower_roll:
        lines.append(f"*NSET, NSET={lower_roll.ref_node_set}")
        lines.append(str(lower_roll.ref_node.nid))
    return "\n".join(lines)


def _write_elset_block(mesh: StripMesh, upper_roll: RollSurface, lower_roll: Optional[RollSurface]) -> str:
    lines = []
    for name, elset in mesh.element_sets.items():
        lines.append(f"*ELSET, ELSET={name}")
        ids = elset.element_ids
        for i in range(0, len(ids), 8):
            lines.append(",".join(str(e) for e in ids[i:i+8]))
    lines.append(f"*ELSET, ELSET={upper_roll.element_set}")
    ids = [e.eid for e in upper_roll.elements]
    for i in range(0, len(ids), 8):
        lines.append(",".join(str(e) for e in ids[i:i+8]))
    if lower_roll:
        lines.append(f"*ELSET, ELSET={lower_roll.element_set}")
        ids = [e.eid for e in lower_roll.elements]
        for i in range(0, len(ids), 8):
            lines.append(",".join(str(e) for e in ids[i:i+8]))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main deck assemblers
# ---------------------------------------------------------------------------

def _assemble_deck(
    heading: str,
    mesh: StripMesh,
    upper_roll: RollSurface,
    lower_roll: Optional[RollSurface],
    material: FEAMaterialCard,
    contact: ContactSetup,
    target_angle_deg: float,
    pass_number: int,
    backend: str,
) -> str:
    """Assemble the complete .inp deck as a string."""

    delta_z = compute_roll_penetration(
        target_angle_deg,
        upper_roll.roll_radius_mm,
        mesh.station_pitch_mm,
        mesh.thickness_mm,
    )

    # Roll ref node IDs for boundary conditions
    upper_rp = upper_roll.ref_node.nid
    lower_rp = lower_roll.ref_node.nid if lower_roll else None

    sep = "**" + "-" * 70

    # ----------------------------- HEADING
    deck_lines = [
        f"*HEADING",
        f"Sai Rolotech Smart Engines v2.2.0 — FEA Roll Forming",
        f"Material: {material.code} ({material.name})",
        f"Pass {pass_number} — Target angle: {target_angle_deg}°",
        f"Backend: {backend.upper()}",
        f"Generator: deck_writer.py",
        sep,
        "",
    ]

    # ----------------------------- NODE & ELEMENT DATA
    deck_lines += [
        "** ===== NODES =====",
        _write_node_block(mesh, upper_roll, lower_roll),
        "",
        "** ===== ELEMENTS =====",
        _write_element_block(mesh, upper_roll, lower_roll),
        "",
        "** ===== NODE SETS =====",
        _write_nset_block(mesh, upper_roll, lower_roll),
        "",
        "** ===== ELEMENT SETS =====",
        _write_elset_block(mesh, upper_roll, lower_roll),
        "",
        sep,
        "",
    ]

    # ----------------------------- SHELL SECTION
    deck_lines += [
        "** ===== SECTION DEFINITION =====",
        f"*SHELL SECTION, ELSET=ESTRIP, MATERIAL={material.code}",
        f"{mesh.thickness_mm:.4f},",
        "",
    ]

    # ----------------------------- MATERIAL
    deck_lines += [
        "** ===== MATERIAL DEFINITION =====",
        material.full_material_block(backend=backend),
        "",
        sep,
        "",
    ]

    # ----------------------------- RIGID BODY
    deck_lines += [
        "** ===== RIGID BODY DEFINITIONS =====",
        f"*RIGID BODY, NSET={upper_roll.ref_node_set}, ELSET={upper_roll.element_set}",
    ]
    if lower_roll:
        deck_lines.append(
            f"*RIGID BODY, NSET={lower_roll.ref_node_set}, ELSET={lower_roll.element_set}"
        )
    deck_lines += ["", sep, ""]

    # ----------------------------- CONTACT
    deck_lines += [
        "** ===== CONTACT SETUP =====",
        contact.as_inp_block(backend=backend),
        sep,
        "",
    ]

    # ----------------------------- INITIAL CONDITIONS
    deck_lines += [
        "** ===== INITIAL CONDITIONS =====",
        f"*INITIAL CONDITIONS, TYPE=STRESS",
        f"** (no pre-stress for pass 1; import STATE from prior pass for pass > 1)",
        "",
    ]

    # ----------------------------- STEP 1: FORMING
    deck_lines += [
        sep,
        f"** ===== STEP 1: FORMING (Pass {pass_number}) =====",
        f"*STEP, INC=200, NLGEOM=YES",
        f"**   NLGEOM=YES enables geometric nonlinearity (large deformation)",
        f"*STATIC",
        f"0.01, 1.0, 1.0E-5, 0.1",
        f"**   (initial_inc, total_time, min_inc, max_inc)",
        "",
        "** --- Boundary conditions: Strip inlet (X=0 face) fixed in all DOF",
        f"*BOUNDARY",
        f"NSTRIP_INLET, 1, 6, 0.0",
        f"**   DOF 1=Ux, 2=Uy, 3=Uz, 4=ROTx, 5=ROTy, 6=ROTz",
        "",
        "** --- Upper roll RP: constrain all DOF except Uz (vertical forming direction)",
        f"*BOUNDARY",
        f"{upper_rp}, 1, 1, 0.0",
        f"** Ux fixed (no lateral drift)",
        f"{upper_rp}, 2, 2, 0.0",
        f"** Uy fixed (no width-direction movement)",
        f"{upper_rp}, 4, 6, 0.0",
        f"** All rotations fixed (rigid roll, no spin in static step)",
        f"*BOUNDARY, TYPE=DISPLACEMENT",
        f"** Prescribed vertical displacement (downward = -Z for upper roll):",
        f"** delta_z = {delta_z:.4f} mm  (from target angle {target_angle_deg}°, R_roll={upper_roll.roll_radius_mm}mm)",
        f"{upper_rp}, 3, 3, {-delta_z:.6f}",
        "",
    ]

    if lower_rp:
        deck_lines += [
            f"** --- Lower roll RP: fully fixed (acts as flat anvil in this pass)",
            f"*BOUNDARY",
            f"{lower_rp}, 1, 6, 0.0",
            "",
        ]

    # --- Output requests (STEP 1)
    deck_lines += [
        "** --- Output requests: STEP 1 (forming)",
        f"*NODE PRINT, NSET=NSTRIP_OUTLET, FREQUENCY=10",
        f"U",
        f"*NODE PRINT, NSET=NSTRIP_CENTRE, FREQUENCY=10",
        f"U",
        f"*EL PRINT, ELSET=ESTRIP, FREQUENCY=10",
        f"S",
        f"** S = stress tensor (S11, S22, S33, S12, S13, S23)",
        f"PE",
        f"** PE = plastic strain tensor",
        f"PEEQ",
        f"** PEEQ = equivalent plastic strain",
        f"CPRESS",
        f"** CPRESS = contact pressure (requires contact output)",
        f"*NODE FILE",
        f"U, RF",
        f"*EL FILE",
        f"S, PE, PEEQ",
        f"*END STEP",
        "",
    ]

    # ----------------------------- STEP 2: SPRINGBACK (UNLOAD)
    deck_lines += [
        sep,
        f"** ===== STEP 2: SPRINGBACK / ELASTIC UNLOADING =====",
        f"*STEP, INC=100, NLGEOM=YES",
        f"*STATIC",
        f"0.01, 1.0, 1.0E-5, 0.1",
        "",
        f"** --- Remove roll displacement: release upper roll Uz DOF",
        f"*BOUNDARY, OP=NEW",
        f"** All strip inlet BCs maintained to prevent rigid body motion",
        f"NSTRIP_INLET, 1, 6, 0.0",
        f"** Upper roll: release vertical (springback step)",
        f"{upper_rp}, 1, 2, 0.0",
        f"{upper_rp}, 4, 6, 0.0",
        f"** Roll vertical DOF released — strip springs back to elastic equilibrium",
        "",
        "** --- Output requests: STEP 2 (springback)",
        f"*NODE PRINT, NSET=NSTRIP_OUTLET, FREQUENCY=1",
        f"U",
        f"*NODE PRINT, NSET=NSTRIP_CENTRE, FREQUENCY=1",
        f"U",
        f"*EL PRINT, ELSET=ESTRIP, FREQUENCY=1",
        f"S",
        f"PEEQ",
        f"*NODE FILE",
        f"U",
        f"*EL FILE",
        f"S, PEEQ",
        f"*END STEP",
        "",
        sep,
        f"** END OF INPUT DECK",
        f"** Job: {heading}",
        f"** Generated by Sai Rolotech Smart Engines v2.2.0 — deck_writer.py",
    ]

    return "\n".join(deck_lines)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def write_calculix_deck(
    mesh: StripMesh,
    upper_roll: RollSurface,
    material: FEAMaterialCard,
    contact: ContactSetup,
    target_angle_deg: float,
    pass_number: int = 1,
    output_dir: str = "/tmp/sai_rolotech_fea",
    lower_roll: Optional[RollSurface] = None,
    job_name: Optional[str] = None,
) -> FEADeckPaths:
    """
    Write a complete CalculiX input deck (.inp) for one roll-forming pass.

    CalculiX run command:
      ccx <job_name>
    Result files:
      <job_name>.frd  — nodal results (deformation, stress, PEEQ)
      <job_name>.dat  — printed output (element results)

    Returns FEADeckPaths with all file paths and run command.
    """
    os.makedirs(output_dir, exist_ok=True)

    if job_name is None:
        job_name = f"rf_pass{pass_number:02d}_{material.code.lower()}"

    heading = f"RF_PASS_{pass_number:02d}_{material.code}"
    deck_text = _assemble_deck(
        heading=heading,
        mesh=mesh,
        upper_roll=upper_roll,
        lower_roll=lower_roll,
        material=material,
        contact=contact,
        target_angle_deg=target_angle_deg,
        pass_number=pass_number,
        backend="calculix",
    )

    deck_path = os.path.join(output_dir, f"{job_name}.inp")
    with open(deck_path, "w") as f:
        f.write(deck_text)

    deck_size = os.path.getsize(deck_path)

    # Separate mesh files (for reference / re-use)
    nodes_path = os.path.join(output_dir, f"{job_name}_nodes.csv")
    elems_path = os.path.join(output_dir, f"{job_name}_elements.csv")
    with open(nodes_path, "w") as f:
        f.write("nid,x,y,z\n")
        for n in mesh.nodes:
            f.write(f"{n.nid},{n.x:.6f},{n.y:.6f},{n.z:.6f}\n")
    with open(elems_path, "w") as f:
        f.write("eid,n1,n2,n3,n4\n")
        for e in mesh.elements:
            f.write(f"{e.eid},{e.n1},{e.n2},{e.n3},{e.n4}\n")

    result_files = {
        "frd": os.path.join(output_dir, f"{job_name}.frd"),
        "dat": os.path.join(output_dir, f"{job_name}.dat"),
        "cvg": os.path.join(output_dir, f"{job_name}.cvg"),
        "sta": os.path.join(output_dir, f"{job_name}.sta"),
    }

    return FEADeckPaths(
        backend="calculix",
        deck_path=deck_path,
        mesh_nodes_path=nodes_path,
        mesh_elements_path=elems_path,
        output_dir=output_dir,
        job_name=job_name,
        run_command=f"ccx {job_name}",
        result_files=result_files,
        geometry_summary=mesh.summary(),
        deck_size_bytes=deck_size,
    )


def write_abaqus_deck(
    mesh: StripMesh,
    upper_roll: RollSurface,
    material: FEAMaterialCard,
    contact: ContactSetup,
    target_angle_deg: float,
    pass_number: int = 1,
    output_dir: str = "/tmp/sai_rolotech_fea",
    lower_roll: Optional[RollSurface] = None,
    job_name: Optional[str] = None,
) -> FEADeckPaths:
    """
    Write a complete Abaqus input deck (.inp) for one roll-forming pass.

    Abaqus run command:
      abaqus job=<job_name> input=<job_name>.inp interactive

    Result files:
      <job_name>.odb  — output database (binary, requires Abaqus or odbAccess)
      <job_name>.dat  — text printed output

    Returns FEADeckPaths with all file paths and run command.
    """
    os.makedirs(output_dir, exist_ok=True)

    if job_name is None:
        job_name = f"rf_pass{pass_number:02d}_{material.code.lower()}_abq"

    heading = f"RF_PASS_{pass_number:02d}_{material.code}_ABAQUS"
    deck_text = _assemble_deck(
        heading=heading,
        mesh=mesh,
        upper_roll=upper_roll,
        lower_roll=lower_roll,
        material=material,
        contact=contact,
        target_angle_deg=target_angle_deg,
        pass_number=pass_number,
        backend="abaqus",
    )

    # Add Abaqus-specific output (ODB) requests in header comment
    abaqus_header = (
        "** Abaqus note: add *OUTPUT, FIELD / HISTORY blocks for ODB output.\n"
        "** *OUTPUT, FIELD, FREQUENCY=10\n"
        "** *NODE OUTPUT\n** U, RF\n"
        "** *ELEMENT OUTPUT, ELSET=ESTRIP\n** S, PE, PEEQ, CPRESS\n"
    )
    deck_text = abaqus_header + "\n" + deck_text

    deck_path = os.path.join(output_dir, f"{job_name}.inp")
    with open(deck_path, "w") as f:
        f.write(deck_text)

    deck_size = os.path.getsize(deck_path)

    nodes_path = os.path.join(output_dir, f"{job_name}_nodes.csv")
    elems_path = os.path.join(output_dir, f"{job_name}_elements.csv")
    with open(nodes_path, "w") as f:
        f.write("nid,x,y,z\n")
        for n in mesh.nodes:
            f.write(f"{n.nid},{n.x:.6f},{n.y:.6f},{n.z:.6f}\n")
    with open(elems_path, "w") as f:
        f.write("eid,n1,n2,n3,n4\n")
        for e in mesh.elements:
            f.write(f"{e.eid},{e.n1},{e.n2},{e.n3},{e.n4}\n")

    result_files = {
        "odb": os.path.join(output_dir, f"{job_name}.odb"),
        "dat": os.path.join(output_dir, f"{job_name}.dat"),
        "msg": os.path.join(output_dir, f"{job_name}.msg"),
        "log": os.path.join(output_dir, f"{job_name}.log"),
    }

    return FEADeckPaths(
        backend="abaqus",
        deck_path=deck_path,
        mesh_nodes_path=nodes_path,
        mesh_elements_path=elems_path,
        output_dir=output_dir,
        job_name=job_name,
        run_command=f"abaqus job={job_name} input={job_name}.inp interactive",
        result_files=result_files,
        geometry_summary=mesh.summary(),
        deck_size_bytes=deck_size,
    )
