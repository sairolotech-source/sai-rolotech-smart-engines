"""
oss_cad_stack_engine.py - Open-source CAD stack capability mapper.

Purpose:
  - Detect runtime availability of approved OSS CAD/mesh/preview dependencies.
  - Expose architecture mapping for Flower -> Contour -> Solid -> Export -> Preview -> Validation.
  - Keep DWG truth explicit (no fake native DWG claim).
"""
from __future__ import annotations

import importlib.util
from typing import Any, Dict

from app.utils.response import pass_response


def _module_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def get_cad_stack_architecture_map() -> Dict[str, Any]:
    return {
        "pipeline": [
            "flower_pass_plan",
            "roll_contour_geometry",
            "parametric_solid_generation",
            "2d_drawing_export",
            "step_export",
            "preview_and_section_validation",
            "mesh_quality_validation",
        ],
        "layer_owners": {
            "cad_kernel_brep": "Open CASCADE via CadQuery/OCP runtime",
            "parametric_modeling": "CadQuery",
            "dxf_2d": "ezdxf",
            "preview_3d": "PyVista/VTK",
            "mesh_checks": "trimesh",
            "meshing_solver_prep_optional": "Gmsh (license review required)",
        },
        "dwg_policy": {
            "native_dwg_supported": False,
            "policy": "DXF is primary. DWG must remain unsupported unless a proven backend is added.",
        },
    }


def detect_oss_cad_stack_status() -> Dict[str, Any]:
    modules = {
        "cadquery": _module_available("cadquery"),
        "OCP": _module_available("OCP"),
        "ezdxf": _module_available("ezdxf"),
        "pyvista": _module_available("pyvista"),
        "vtk": _module_available("vtk"),
        "trimesh": _module_available("trimesh"),
        "gmsh": _module_available("gmsh"),
    }

    license_notes = [
        {
            "library": "Open CASCADE (via OCP/CadQuery)",
            "license_note": "OCCT licensing requires compliance review for redistribution.",
            "risk_level": "review_required",
        },
        {
            "library": "CadQuery",
            "license_note": "Open-source parametric CAD layer; verify transitive dependencies in distribution.",
            "risk_level": "review_required",
        },
        {
            "library": "ezdxf",
            "license_note": "DXF path is open-source and suitable for primary 2D export.",
            "risk_level": "low",
        },
        {
            "library": "PyVista/VTK",
            "license_note": "Open-source visualization stack; suitable for preview and sections.",
            "risk_level": "low",
        },
        {
            "library": "trimesh",
            "license_note": "Open-source mesh utility stack for slicing and checks.",
            "risk_level": "low",
        },
        {
            "library": "Gmsh",
            "license_note": "Treat as optional; review license impact before closed-source distribution.",
            "risk_level": "high_review_required",
        },
    ]

    core_ready = modules["cadquery"] and modules["ezdxf"]
    preview_ready = modules["pyvista"] and modules["vtk"]
    mesh_ready = modules["trimesh"]

    return pass_response("oss_cad_stack_engine", {
        "stack_status": {
            "core_cad_ready": core_ready,
            "preview_ready": preview_ready,
            "mesh_validation_ready": mesh_ready,
            "gmsh_ready_optional": modules["gmsh"],
        },
        "runtime_modules": modules,
        "architecture": get_cad_stack_architecture_map(),
        "license_notes": license_notes,
        "truth_controls": {
            "no_fake_dwg_claim": True,
            "dxf_step_first_class": True,
            "contour_driven_tooling_required": True,
        },
    })

