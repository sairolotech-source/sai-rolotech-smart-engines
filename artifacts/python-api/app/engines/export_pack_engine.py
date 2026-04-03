"""
export_pack_engine.py — CAD/CAM Export Pack Bundler Engine

Bundles the outputs from export_dxf_engine, export_step_engine,
and optionally pdf_export_engine into a single file manifest.

PRELIMINARY CAD/CAM HANDOFF PACK — pending tooling verification.
Blueprint source: Advance Roll Engine + Export Engine blueprint.
"""
from typing import Any, Dict, List, Optional

from app.utils.response import pass_response, fail_response


def build_export_pack(
    dxf_result: Dict[str, Any],
    step_result: Dict[str, Any],
    pdf_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Bundle DXF + STEP (+ optional PDF) into a single export pack manifest.
    Fails if either the DXF or STEP result is missing / failed.
    """
    if not dxf_result or dxf_result.get("status") != "pass":
        return fail_response("export_pack_engine", "DXF export missing or failed")
    if not step_result or step_result.get("status") != "pass":
        return fail_response("export_pack_engine", "STEP export missing or failed")

    files: List[Dict[str, Any]] = [
        {
            "type":      "DXF",
            "filename":  dxf_result.get("filename"),
            "file_path": dxf_result.get("file_path"),
            "purpose":   "2D roll drawing pack — upper/lower profiles per stand",
        },
        {
            "type":      "STEP",
            "filename":  step_result.get("filename"),
            "file_path": step_result.get("file_path"),
            "purpose":   "3D roll solid for SolidWorks / SolidCAM import",
        },
    ]

    if pdf_result and pdf_result.get("status") == "pass":
        files.append({
            "type":      "PDF",
            "filename":  pdf_result.get("filename"),
            "file_path": pdf_result.get("file_path"),
            "purpose":   "Preliminary engineering report",
        })

    all_warnings: List[str] = []
    for r in [dxf_result, step_result, pdf_result or {}]:
        all_warnings.extend(r.get("warnings", []))
    all_warnings.append(
        "Export pack is preliminary pending final tooling verification"
    )

    return pass_response("export_pack_engine", {
        "files":       files,
        "file_count":  len(files),
        "session_id":  dxf_result.get("session_id") or step_result.get("session_id"),
        "confidence":  "medium",
        "blocking":    False,
        "warnings":    list(dict.fromkeys(all_warnings)),   # deduplicate
    })
