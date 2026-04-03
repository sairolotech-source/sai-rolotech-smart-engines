"""
fea_routes.py — FEA API Endpoints
Sai Rolotech Smart Engines v2.2.0

Endpoints:
  POST /api/fea/prepare       — generate mesh + material card + contact + write deck
  POST /api/fea/run           — run solver if available (or return EXTERNAL_SOLVER_REQUIRED)
  POST /api/fea/import-results — import result files from a prior solver run
  GET  /api/fea/benchmark     — run the standard benchmark case (GI, t=2mm, pass 1)
  GET  /api/fea/architecture  — return architecture diagram and capability statement
  GET  /api/fea/materials     — list all FEA material cards available
  POST /api/fea/material-card — get full material card for one material code
  GET  /api/fea/solver-status — detect available solver binaries
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from .fea_pipeline import run_fea_pipeline, run_benchmark_case, detect_solver, _ARCHITECTURE_DIAGRAM
from .material_cards import build_material_card, list_available_materials
from .mesh_generator import generate_strip_mesh, generate_roll_rigid_surface, strip_mesh_quality_check
from .contact_setup import build_contact_setup, get_friction_coefficient

fea_router = APIRouter(prefix="/api/fea", tags=["FEA"])


# ----------------------------- Request models

class FEAPrepareRequest(BaseModel):
    material_code: str = Field("GI", description="Material code: GI, SS, AL, HSLA, MS, CR, HR, CU, TI, PP")
    flat_blank_mm: float = Field(240.0, gt=0, description="Strip flat blank width (mm)")
    thickness_mm: float = Field(2.0, gt=0, description="Strip thickness (mm)")
    station_pitch_mm: float = Field(600.0, gt=0, description="Roll station pitch (mm)")
    roll_radius_mm: float = Field(90.0, gt=0, description="Roll outer radius (mm)")
    face_width_mm: float = Field(100.0, gt=0, description="Roll face width / model length (mm)")
    pass_angles_deg: List[float] = Field([8.18], description="Cumulative target angles per pass (degrees)")
    backend: str = Field("calculix", description="Solver backend: calculix or abaqus")
    n_x_elements: int = Field(12, ge=2, description="Elements in machine direction")
    n_y_elements: int = Field(20, ge=2, description="Elements in width direction")
    n_arc_roll: int = Field(18, ge=4, description="Arc divisions on roll surface")
    friction_override: Optional[float] = Field(None, description="Override friction coefficient")
    include_lower_roll: bool = Field(False, description="Generate lower roll rigid surface")


class FEARunRequest(BaseModel):
    material_code: str = Field("GI")
    flat_blank_mm: float = Field(240.0, gt=0)
    thickness_mm: float = Field(2.0, gt=0)
    station_pitch_mm: float = Field(600.0, gt=0)
    roll_radius_mm: float = Field(90.0, gt=0)
    face_width_mm: float = Field(100.0, gt=0)
    pass_angles_deg: List[float] = Field([8.18])
    backend: str = Field("calculix")
    output_dir: str = Field("/tmp/sai_rolotech_fea")
    solver_timeout_s: int = Field(600, ge=30)
    n_x_elements: int = Field(12, ge=2)
    n_y_elements: int = Field(20, ge=2)


class FEAImportRequest(BaseModel):
    backend: str = Field("calculix", description="Solver backend used")
    frd_path: Optional[str] = Field(None, description="Path to .frd file (CalculiX)")
    dat_path: Optional[str] = Field(None, description="Path to .dat file")
    rpt_path: Optional[str] = Field(None, description="Path to .rpt report file (Abaqus)")
    pass_number: int = Field(1, ge=1)
    material_code: str = Field("GI")


class MaterialCardRequest(BaseModel):
    code: str = Field("GI", description="Material code")
    n_plastic_points: int = Field(20, ge=5, le=100, description="Rows in *PLASTIC table")


# ----------------------------- Endpoints

@fea_router.get("/architecture")
def get_fea_architecture():
    """Return architecture diagram, capability statement, and separation of concerns."""
    return {
        "status": "pass",
        "label": "SAI ROLOTECH FEA INTEGRATION ARCHITECTURE",
        "capability_statement": (
            "Full FEA integration architecture implemented. "
            "Pipeline covers: S4R shell mesh generation, rigid roll surface (R3D4), "
            "Swift-hardening material cards, Coulomb friction contact, "
            "CalculiX and Abaqus solver adapter, result importers (.frd/.dat/.rpt). "
            "Runtime solving requires external solver binary (ccx or abaqus)."
        ),
        "separation_of_concerns": {
            "heuristic_precheck": {
                "module": "advanced_process_simulation.py",
                "method": "Incremental 2D plane-strain mechanics, Swift hardening, Hertz contact",
                "runtime": "~1ms, instant",
                "label": "NOT FEA — heuristic precheck only",
                "use_for": "design feasibility, go/no-go, parameter screening",
            },
            "solver_backed_fea": {
                "module": "fea_pipeline.py",
                "method": "S4R shell mesh, contact mechanics, Newton-Raphson iteration",
                "runtime": "minutes (external solver binary required)",
                "label": "SOLVER-BACKED FEA",
                "use_for": "stress certification, accurate springback, contact analysis",
            },
        },
        "architecture_diagram": _ARCHITECTURE_DIAGRAM,
        "backends": {
            "calculix": {
                "type": "open-source",
                "binary": "ccx",
                "install": "apt install calculix OR https://www.dhondt.de",
                "input_format": ".inp (Abaqus-compatible keyword format)",
                "output_files": ".frd (nodal), .dat (element), .sta (convergence)",
            },
            "abaqus": {
                "type": "commercial",
                "binary": "abaqus",
                "install": "Dassault Systèmes licence required",
                "input_format": ".inp (same keyword format)",
                "output_files": ".odb (binary), .dat (text), .msg",
            },
        },
    }


@fea_router.get("/solver-status")
def get_solver_status():
    """Check which solver binaries are available on PATH."""
    ccx_avail, ccx_bin, ccx_ver = detect_solver("calculix")
    abq_avail, abq_bin, abq_ver = detect_solver("abaqus")
    return {
        "status": "pass",
        "solvers": {
            "calculix": {
                "available": ccx_avail,
                "binary_path": ccx_bin,
                "version_note": ccx_ver,
                "install_cmd": "sudo apt-get install -y calculix",
            },
            "abaqus": {
                "available": abq_avail,
                "binary_path": abq_bin,
                "version_note": abq_ver,
                "install_cmd": "Commercial licence required from Dassault Systèmes",
            },
        },
        "runtime_verdict": (
            "SOLVER_AVAILABLE" if (ccx_avail or abq_avail) else "EXTERNAL_SOLVER_REQUIRED"
        ),
    }


@fea_router.get("/materials")
def get_fea_materials():
    """List all materials with FEA card parameters."""
    return {
        "status": "pass",
        "materials": list_available_materials(),
        "total": 10,
        "note": "All materials use Swift isotropic hardening: σ = K*(ε₀+εp)^n",
    }


@fea_router.post("/material-card")
def get_material_card(req: MaterialCardRequest):
    """Return complete FEA material card for one material code."""
    try:
        card = build_material_card(req.code, req.n_plastic_points)
        return {
            "status": "pass",
            "material_card": card.summary(),
            "elastic_block": card.elastic_block(),
            "plastic_block": card.plastic_block(),
            "density_block": card.density_block(),
            "full_material_block": card.full_material_block(),
            "plastic_table": [
                {"true_stress_mpa": p.true_stress_mpa, "true_plastic_strain": p.true_plastic_strain}
                for p in card.plastic_table
            ],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@fea_router.post("/prepare")
def fea_prepare(req: FEAPrepareRequest):
    """
    Prepare the full FEA setup: mesh, material card, contact, solver decks.
    Does NOT run the solver. Returns deck paths and run commands.
    """
    try:
        result = run_fea_pipeline(
            material_code=req.material_code,
            flat_blank_mm=req.flat_blank_mm,
            thickness_mm=req.thickness_mm,
            station_pitch_mm=req.station_pitch_mm,
            roll_radius_mm=req.roll_radius_mm,
            face_width_mm=req.face_width_mm,
            pass_angles_deg=req.pass_angles_deg,
            backend=req.backend,
            output_dir="/tmp/sai_rolotech_fea_prepare",
            n_x_elements=req.n_x_elements,
            n_y_elements=req.n_y_elements,
            n_arc_roll=req.n_arc_roll,
            friction_override=req.friction_override,
            include_lower_roll=req.include_lower_roll,
        )
        return {
            "status": "pass",
            "runtime_verdict": result.runtime_verdict,
            "honest_verdict": result.honest_verdict,
            "solver_available": result.solver_available,
            "mesh_summary": result.mesh_summary,
            "material_summary": result.material_summary,
            "contact_summary": result.contact_summary,
            "n_passes": result.n_passes,
            "passes": [
                {
                    "pass_number": p.pass_number,
                    "target_angle_deg": p.target_angle_deg,
                    "roll_penetration_mm": p.roll_penetration_mm,
                    "deck_path": p.deck_paths.deck_path,
                    "run_command": p.deck_paths.run_command,
                    "result_files": p.deck_paths.result_files,
                    "solver_status": p.solver_status,
                }
                for p in result.pass_results
            ],
            "validation_report": result.validation_report,
            "architecture_diagram": result.architecture_diagram,
        }
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))


@fea_router.post("/run")
def fea_run(req: FEARunRequest):
    """
    Attempt to run the solver for all passes.
    If solver not available, returns EXTERNAL_SOLVER_REQUIRED with deck paths.
    """
    try:
        result = run_fea_pipeline(
            material_code=req.material_code,
            flat_blank_mm=req.flat_blank_mm,
            thickness_mm=req.thickness_mm,
            station_pitch_mm=req.station_pitch_mm,
            roll_radius_mm=req.roll_radius_mm,
            face_width_mm=req.face_width_mm,
            pass_angles_deg=req.pass_angles_deg,
            backend=req.backend,
            output_dir=req.output_dir,
            n_x_elements=req.n_x_elements,
            n_y_elements=req.n_y_elements,
            solver_timeout_s=req.solver_timeout_s,
        )
        return {
            "status": "pass",
            "runtime_verdict": result.runtime_verdict,
            "honest_verdict": result.honest_verdict,
            "solver_available": result.solver_available,
            "solver_binary": result.solver_binary,
            "passes": [p.summary() for p in result.pass_results],
            "validation_report": result.validation_report,
        }
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=400, detail=str(e))


@fea_router.get("/benchmark")
def fea_benchmark():
    """
    Run the standard benchmark case:
      Material: GI (DX51D, EN 10327)
      Strip: t=2mm, flat_blank=240mm
      Roll: R=90mm, face=100mm, pitch=600mm
      Pass 1: target_angle=8.18° (first pass of 13-pass lipped channel)

    Returns full pipeline result with deck path, run command, and honest verdict.
    """
    try:
        result = run_benchmark_case(backend="calculix")
        s = result.summary()
        # Add benchmark-specific proof section
        pass1 = result.pass_results[0]
        s["benchmark_proof"] = {
            "case": "GI Lipped Channel, t=2mm, pass 1/13",
            "material": "GI — DX51D EN 10327 (K=500MPa, n=0.22, Fy=250MPa)",
            "mesh": f"{result.mesh_summary['total_nodes']} nodes, {result.mesh_summary['total_elements']} S4R elements",
            "roll_penetration_mm": pass1.roll_penetration_mm,
            "deck_path": pass1.deck_paths.deck_path,
            "deck_size_bytes": pass1.deck_paths.deck_size_bytes,
            "run_command": pass1.deck_paths.run_command,
            "result_files": pass1.deck_paths.result_files,
            "solver_status": pass1.solver_status,
        }
        return {"status": "pass", **s}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@fea_router.post("/import-results")
def fea_import_results(req: FEAImportRequest):
    """
    Import solver result files into the app.
    Use after running the solver externally.
    """
    from .result_importer import import_calculix_results, import_abaqus_odb_text

    try:
        if req.backend == "calculix":
            results = import_calculix_results(
                frd_path=req.frd_path or "",
                dat_path=req.dat_path or "",
                pass_number=req.pass_number,
                material_code=req.material_code,
            )
        elif req.backend == "abaqus":
            results = import_abaqus_odb_text(
                rpt_path=req.rpt_path or "",
                dat_path=req.dat_path or "",
                pass_number=req.pass_number,
                material_code=req.material_code,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown backend: {req.backend}")

        return {
            "status": "pass",
            "import_status": results.status,
            "results_summary": results.summary(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
