"""
FEA Integration Package — Sai Rolotech Smart Engines v2.2.0
Architecture: mesh generation → material cards → contact setup → solver deck → result import

Solver backends:
  - calculix : open-source (ccx), Abaqus-compatible .inp format
  - abaqus   : commercial Abaqus (Dassault Systèmes), same .inp format

Runtime status:
  If neither solver binary is found on PATH, the pipeline returns
  EXTERNAL_SOLVER_REQUIRED with all decks pre-written and ready to run.
"""

from .mesh_generator import StripMesh, RollSurface, generate_strip_mesh, generate_roll_rigid_surface
from .material_cards import FEAMaterialCard, build_material_card
from .contact_setup import ContactSetup, build_contact_setup
from .deck_writer import write_calculix_deck, write_abaqus_deck, FEADeckPaths
from .result_importer import import_calculix_results, import_abaqus_odb_text, FEAResults
from .fea_pipeline import run_fea_pipeline, FEAPipelineResult

__all__ = [
    "StripMesh", "RollSurface", "generate_strip_mesh", "generate_roll_rigid_surface",
    "FEAMaterialCard", "build_material_card",
    "ContactSetup", "build_contact_setup",
    "write_calculix_deck", "write_abaqus_deck", "FEADeckPaths",
    "import_calculix_results", "import_abaqus_odb_text", "FEAResults",
    "run_fea_pipeline", "FEAPipelineResult",
]
