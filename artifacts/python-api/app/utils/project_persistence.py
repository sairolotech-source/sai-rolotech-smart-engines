"""
project_persistence.py — Project Save / Load / Version Control

Implements COPRA audit criterion I:
  - coherent typed model save/load
  - JSON-based file persistence in ./projects/ directory
  - versioning (increment version on each save)
  - project listing with summary
  - project delete

Storage format:  projects/<project_id>/<version>.json
Latest symlink:  projects/<project_id>/latest.json  (copy of latest version)

All projects serialised from app.models.engineering_data_model.RFProject
"""
import json
import os
import shutil
import uuid
import datetime
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.models.engineering_data_model import RFProject

logger = logging.getLogger("project_persistence")

# ── Storage root (relative to this file = python-api/app/utils/) ──────────────
_THIS_DIR = Path(__file__).resolve().parent.parent.parent   # = python-api/
PROJECT_ROOT = _THIS_DIR / "projects"


def _ensure_root() -> None:
    PROJECT_ROOT.mkdir(parents=True, exist_ok=True)


def _project_dir(project_id: str) -> Path:
    return PROJECT_ROOT / project_id


# ─────────────────────────────────────────────────────────────────────────────
# SAVE
# ─────────────────────────────────────────────────────────────────────────────

def save_project(project: RFProject) -> Dict[str, Any]:
    """
    Persist an RFProject to disk.

    If project_id is empty, a new UUID is assigned.
    Version is auto-incremented on each save.

    Returns:
        { status, project_id, version, path }
    """
    _ensure_root()

    # Assign ID if not present
    if not project.project_id:
        project.project_id = str(uuid.uuid4())

    proj_dir = _project_dir(project.project_id)
    proj_dir.mkdir(parents=True, exist_ok=True)

    # Find current max version
    existing = sorted(
        [f.stem for f in proj_dir.glob("v*.json") if f.stem.startswith("v")],
        key=lambda x: int(x[1:]) if x[1:].isdigit() else 0,
    )
    next_ver = int(existing[-1][1:]) + 1 if existing else 1

    project.version = str(next_ver)
    project.updated_at = datetime.datetime.utcnow().isoformat()

    payload = project.model_dump()

    ver_path = proj_dir / f"v{next_ver}.json"
    with open(ver_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)

    # Update latest.json
    latest_path = proj_dir / "latest.json"
    shutil.copy2(ver_path, latest_path)

    logger.info("[save_project] %s v%d → %s", project.project_id, next_ver, ver_path)
    return {
        "status": "saved",
        "project_id": project.project_id,
        "project_name": project.project_name,
        "version": next_ver,
        "path": str(ver_path),
    }


# ─────────────────────────────────────────────────────────────────────────────
# LOAD
# ─────────────────────────────────────────────────────────────────────────────

def load_project(project_id: str, version: Optional[int] = None) -> Optional[RFProject]:
    """
    Load an RFProject by ID.

    Args:
        project_id: project UUID
        version: specific version number; None = latest

    Returns:
        RFProject instance or None if not found
    """
    _ensure_root()
    proj_dir = _project_dir(project_id)
    if not proj_dir.exists():
        return None

    if version is not None:
        target = proj_dir / f"v{version}.json"
    else:
        target = proj_dir / "latest.json"

    if not target.exists():
        return None

    with open(target) as f:
        data = json.load(f)

    return RFProject(**data)


def load_project_raw(project_id: str, version: Optional[int] = None) -> Optional[Dict]:
    """Return the raw JSON dict without Pydantic parsing (for API endpoints)."""
    _ensure_root()
    proj_dir = _project_dir(project_id)
    if not proj_dir.exists():
        return None

    if version is not None:
        target = proj_dir / f"v{version}.json"
    else:
        target = proj_dir / "latest.json"

    if not target.exists():
        return None

    with open(target) as f:
        return json.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# LIST
# ─────────────────────────────────────────────────────────────────────────────

def list_projects() -> List[Dict[str, Any]]:
    """
    Return a list of project summaries (from latest.json of each project).
    """
    _ensure_root()
    summaries = []
    for proj_dir in sorted(PROJECT_ROOT.iterdir()):
        if not proj_dir.is_dir():
            continue
        latest = proj_dir / "latest.json"
        if not latest.exists():
            continue
        try:
            with open(latest) as f:
                data = json.load(f)
            proj = RFProject(**data)
            summaries.append(proj.summary())
        except Exception as e:
            logger.warning("[list_projects] skip %s: %s", proj_dir.name, e)
    return summaries


def list_project_versions(project_id: str) -> List[Dict[str, Any]]:
    """Return all saved versions for a given project."""
    _ensure_root()
    proj_dir = _project_dir(project_id)
    if not proj_dir.exists():
        return []

    versions = []
    for f in sorted(proj_dir.glob("v*.json"), key=lambda x: int(x.stem[1:]) if x.stem[1:].isdigit() else 0):
        stat = f.stat()
        versions.append({
            "version": int(f.stem[1:]),
            "file": str(f),
            "size_bytes": stat.st_size,
            "saved_at": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return versions


# ─────────────────────────────────────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────────────────────────────────────

def delete_project(project_id: str) -> bool:
    """Delete all versions of a project. Returns True if deleted."""
    _ensure_root()
    proj_dir = _project_dir(project_id)
    if not proj_dir.exists():
        return False
    shutil.rmtree(proj_dir)
    logger.info("[delete_project] removed %s", project_id)
    return True


# ─────────────────────────────────────────────────────────────────────────────
# PIPELINE → PROJECT CONVERSION
# ─────────────────────────────────────────────────────────────────────────────

def pipeline_to_project(pipeline: Dict[str, Any], project_name: str = "", project_ref: str = "") -> RFProject:
    """
    Convert a full simulation pipeline dict (from routes.py) into an RFProject.
    This bridges the existing stateless API pipeline to the typed data model.
    """
    from app.models.engineering_data_model import (
        MaterialSpec, ProfileSpec, BendSpec, FlowerData, FlowerPass,
        StationState, RollToolingData, ValidationResults, DefectResult, ReportOutput,
    )
    from app.utils.material_database import get_material

    input_r   = pipeline.get("input_engine", {})
    profile_r = pipeline.get("profile_analysis_engine", {})
    flower_r  = pipeline.get("advanced_flower_engine", {})
    station_r = pipeline.get("station_engine", {})
    shaft_r   = pipeline.get("shaft_engine", {})
    bearing_r = pipeline.get("bearing_engine", {})
    spring_r  = pipeline.get("springback_engine", {})
    force_r   = pipeline.get("force_engine", {})
    report_r  = pipeline.get("report_engine", {})

    material_code = str(input_r.get("material", "GI")).upper()
    thickness_mm  = float(input_r.get("sheet_thickness_mm", 0.0))

    # ── Material ──
    mat_db = get_material(material_code) or {}
    material = MaterialSpec(
        code=material_code,
        name=mat_db.get("name", material_code),
        fy_mpa=mat_db.get("Fy_mpa", 250),
        uts_mpa=mat_db.get("Uts_mpa", 320),
        e_gpa=mat_db.get("E_gpa", 200),
        elongation_pct=mat_db.get("elongation_pct", 25),
        n_value=mat_db.get("n_value", 0.18),
        r_value=mat_db.get("r_value", 1.0),
        k_factor=mat_db.get("k_factor", 0.44),
        density_kg_m3=mat_db.get("density_kg_m3", 7850),
        source=mat_db.get("source", ""),
    )

    # ── Profile ──
    bend_count = int(profile_r.get("bend_count", 0))
    bends = []
    for i in range(bend_count):
        bends.append(BendSpec(
            bend_id=i + 1,
            target_angle_deg=90.0,
            inner_radius_mm=float(input_r.get("bend_radius_mm", 3.0)),
        ))

    profile = ProfileSpec(
        profile_type=str(profile_r.get("profile_type", "custom")),
        section_width_mm=float(profile_r.get("section_width_mm", 0)),
        section_height_mm=float(profile_r.get("section_height_mm", 0)),
        bends=bends,
        is_symmetric=bool(profile_r.get("is_symmetric", True)),
        return_bends_count=int(profile_r.get("return_bends_count", 0)),
    )

    # ── Flower ──
    pass_plan_raw = flower_r.get("pass_plan", [])
    flower_passes = []
    for pp in pass_plan_raw:
        flower_passes.append(FlowerPass(
            pass_number=pp.get("pass", 0),
            label=pp.get("label", "forming"),
            stage=pp.get("stage", "forming"),
            bend_angles_deg=pp.get("bend_angles_deg", []),
            progression_pct=pp.get("progression_pct", 0.0),
            is_calibration=pp.get("is_calibration", False),
        ))

    flower = FlowerData(
        section_type=str(flower_r.get("section_type", "")),
        forming_complexity_class=str(flower_r.get("forming_complexity_class", "")),
        complexity_score=int(flower_r.get("complexity_score", 0)),
        estimated_forming_passes=int(flower_r.get("estimated_forming_passes", 0)),
        pass_plan=flower_passes,
    )

    # ── Validation ──
    validation = ValidationResults(
        springback_deg=float(spring_r.get("springback_deg", 0)),
        corrected_angle_deg=float(spring_r.get("corrected_angle_deg", 0)),
        springback_model_used=str(spring_r.get("model_used", "")),
        forming_force_n=float(force_r.get("estimated_force_n", 0)),
        forming_force_kn=float(force_r.get("estimated_force_kn", 0)),
        motor_power_kw=float(force_r.get("motor_power_kw", 0)),
        torque_nm=float(force_r.get("torque_nm", 0)),
        validation_type="heuristic_precheck",
    )

    # ── Report ──
    report = ReportOutput(
        readable_text=str(report_r.get("readable_report", "")),
        engineering_summary=report_r.get("engineering_summary", {}),
    ) if report_r else None

    return RFProject(
        project_name=project_name or f"{material_code} {profile.profile_type} t={thickness_mm}mm",
        project_ref=project_ref,
        material=material,
        thickness_mm=thickness_mm,
        profile=profile,
        flower=flower,
        station_count_recommended=int(station_r.get("recommended_station_count", 0)),
        station_count_min=int(station_r.get("min_station_count", 0)),
        station_count_premium=int(station_r.get("premium_station_count", 0)),
        validation=validation,
        report=report,
        schema_version="2.2.0",
    )
