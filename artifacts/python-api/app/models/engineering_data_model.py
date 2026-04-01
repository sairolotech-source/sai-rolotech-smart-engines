"""
engineering_data_model.py — Central Engineering Data Model

Typed Pydantic dataclasses covering the complete roll-forming engineering pipeline.
Benchmark criterion I (central data/project management) of the COPRA audit.

Model hierarchy:
  RFProject
    ├── MaterialSpec
    ├── ProfileSpec
    │     └── BendSpec[]
    ├── FlowerData
    │     └── FlowerPass[]
    ├── StationState[]
    ├── RollToolingData
    │     └── RollStation[]
    ├── ValidationResults
    └── ReportOutput

All units: mm, degrees, MPa, kN, kJ, kg.
"""
from __future__ import annotations
import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─── MATERIAL ─────────────────────────────────────────────────────────────────

class MaterialSpec(BaseModel):
    """Typed material properties used by all engineering engines."""
    code: str = Field(..., description="Material code: GI, CR, SS, AL, MS, etc.")
    name: str = Field(..., description="Full material name")
    fy_mpa: float = Field(..., description="Yield strength (MPa)")
    uts_mpa: float = Field(..., description="Ultimate tensile strength (MPa)")
    e_gpa: float = Field(..., description="Elastic modulus (GPa)")
    elongation_pct: float = Field(..., description="Elongation at break (%)")
    n_value: float = Field(..., description="Strain hardening exponent")
    r_value: float = Field(..., description="Anisotropy ratio (Lankford r-value)")
    k_factor: float = Field(..., description="K-factor for flat blank (neutral axis offset)")
    density_kg_m3: float = Field(..., description="Material density (kg/m³)")
    source: str = Field(default="", description="Standard/source reference")


# ─── BEND ─────────────────────────────────────────────────────────────────────

class BendSpec(BaseModel):
    """Single bend in a profile cross-section."""
    bend_id: int = Field(..., description="1-indexed bend number")
    target_angle_deg: float = Field(..., description="Target forming angle (deg)")
    inner_radius_mm: float = Field(..., description="Inner bend radius (mm)")
    direction: str = Field(default="up", description="Bend direction: up / down / inward / outward")
    bend_allowance_mm: float = Field(default=0.0, description="Computed DIN 6935 bend allowance (mm)")
    outer_fibre_strain: float = Field(default=0.0, description="ε = t/(2R+t)")
    is_return_bend: bool = Field(default=False, description="Is this a return/hook bend?")


# ─── PROFILE ──────────────────────────────────────────────────────────────────

class ProfileSpec(BaseModel):
    """Complete profile / section definition."""
    profile_type: str = Field(..., description="Section type: lipped_channel, c_channel, z_purlin, hat_section, box_section, angle_section, custom")
    section_width_mm: float = Field(..., description="Overall section width (mm)")
    section_height_mm: float = Field(..., description="Overall section height (mm)")
    segment_lengths_mm: List[float] = Field(default_factory=list, description="Flat segment lengths from strip edge to edge (mm)")
    bend_angles_deg: List[float] = Field(default_factory=list, description="Target forming angles (deg)")
    inner_radius_mm: float = Field(default=3.0, description="Default inner bend radius (mm)")
    bends: List[BendSpec] = Field(default_factory=list, description="Per-bend details")
    flat_blank_mm: float = Field(default=0.0, description="Computed flat blank / coil strip width (mm)")
    coil_strip_width_mm: float = Field(default=0.0, description="Coil strip width + trim allowance (mm)")
    is_symmetric: bool = Field(default=True)
    return_bends_count: int = Field(default=0)

    @property
    def bend_count(self) -> int:
        return len(self.bends) or len(self.bend_angles_deg)


# ─── FLOWER PASS ──────────────────────────────────────────────────────────────

class FlowerPass(BaseModel):
    """Single forming pass in the flower pattern."""
    pass_number: int
    label: str = Field(default="forming")
    stage: str = Field(default="progressive_forming", description="Stage: pre_bend / forming / calibration")
    bend_angles_deg: List[float] = Field(default_factory=list, description="Per-bend forming angle at this pass")
    progression_pct: float = Field(default=0.0, description="% of final angle achieved (0–100)")
    roll_gap_mm: float = Field(default=0.0)
    springback_allowance_deg: float = Field(default=0.0)
    is_calibration: bool = Field(default=False)
    centerline_xy: Optional[List[List[float]]] = Field(default=None, description="2D centerline points [(x,y)…] for this pass")
    centerline_xyz: Optional[List[List[float]]] = Field(default=None, description="3D centerline points [(x,y,z)…] for this pass (z = pass index * pitch)")


# ─── FLOWER DATA ──────────────────────────────────────────────────────────────

class FlowerData(BaseModel):
    """Complete parametric flower workflow result."""
    section_type: str
    forming_complexity_class: str
    complexity_score: int
    estimated_forming_passes: int
    pass_plan: List[FlowerPass] = Field(default_factory=list)
    width_progression_mm: List[float] = Field(default_factory=list, description="Strip width at each pass (mm)")
    has_3d_centerline: bool = Field(default=False, description="True if centerline_xyz populated")


# ─── STATION STATE ────────────────────────────────────────────────────────────

class StationState(BaseModel):
    """Per-station engineering parameters."""
    station_no: int
    pass_label: str = Field(default="forming")
    target_angle_deg: float = Field(default=0.0)
    corrected_angle_deg: float = Field(default=0.0, description="Over-bend angle (corrected for springback)")
    springback_deg: float = Field(default=0.0)
    roll_gap_mm: float = Field(default=0.0)
    strip_width_mm: float = Field(default=0.0)
    forming_depth_mm: float = Field(default=0.0)
    estimated_force_kn: float = Field(default=0.0)
    motor_power_kw: float = Field(default=0.0)
    outer_fibre_strain_pct: float = Field(default=0.0)
    defect_risk: str = Field(default="low", description="low / medium / high")
    defect_types: List[str] = Field(default_factory=list)
    operator_notes: str = Field(default="")


# ─── ROLL STATION ─────────────────────────────────────────────────────────────

class RollStation(BaseModel):
    """Per-station roll tooling dimensions."""
    station_no: int
    upper_roll_od_mm: float
    lower_roll_od_mm: float
    upper_bore_mm: float
    lower_bore_mm: float
    face_width_mm: float
    groove_depth_mm: float = Field(default=0.0)
    groove_radius_mm: float = Field(default=0.0)
    keyway_width_mm: float = Field(default=0.0)
    keyway_depth_mm: float = Field(default=0.0)
    shoulder_width_mm: float = Field(default=0.0)
    material_grade: str = Field(default="D2", description="Roll material: D2 / EN31 / H13")
    hardness_hrc: int = Field(default=60)
    contour_type: str = Field(default="cylindrical", description="cylindrical / profiled / grooved")
    interference_status: str = Field(default="clear", description="clear / warning / clash")


# ─── ROLL TOOLING DATA ────────────────────────────────────────────────────────

class RollToolingData(BaseModel):
    """Complete roll/tooling design for a project."""
    shaft_diameter_mm: float
    bearing_type: str = Field(default="6212")
    bearing_family: str = Field(default="deep_groove_ball_bearing")
    roll_material: str = Field(default="D2")
    roll_hardness_hrc: int = Field(default=60)
    stations: List[RollStation] = Field(default_factory=list)
    total_roll_weight_kg: float = Field(default=0.0)
    total_shaft_weight_kg: float = Field(default=0.0)
    geometry_grade: str = Field(default="rule_book", description="rule_book / manufacturing_grade")


# ─── VALIDATION RESULTS ───────────────────────────────────────────────────────

class DefectResult(BaseModel):
    defect_type: str
    severity: str
    description: str
    blocking: bool = False


class ValidationResults(BaseModel):
    """Aggregated validation / engineering precheck results."""
    springback_deg: float = Field(default=0.0)
    corrected_angle_deg: float = Field(default=0.0)
    springback_model_used: str = Field(default="")

    strain_max: float = Field(default=0.0)
    strain_severity: str = Field(default="low")

    forming_force_n: float = Field(default=0.0)
    forming_force_kn: float = Field(default=0.0)
    motor_power_kw: float = Field(default=0.0)
    torque_nm: float = Field(default=0.0)

    defects: List[DefectResult] = Field(default_factory=list)
    blocking_defects: int = Field(default=0)
    interference_clear: bool = Field(default=True)
    interference_clash_passes: List[int] = Field(default_factory=list)

    overall_quality_score: float = Field(default=0.0, description="0–100 forming quality score")
    validation_type: str = Field(default="heuristic_precheck", description="Always heuristic_precheck — not FEA")
    warnings: List[str] = Field(default_factory=list)


# ─── REPORT OUTPUT ────────────────────────────────────────────────────────────

class ReportOutput(BaseModel):
    """Structured engineering report payload."""
    report_type: str = Field(default="preliminary_engineering_estimate")
    generated_at: str = Field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    disclaimer: str = Field(
        default="PRELIMINARY ENGINEERING ESTIMATE — NOT FINAL TOOLING DOCUMENT. "
                "All values must be verified by a qualified roll forming engineer before production."
    )
    readable_text: str = Field(default="")
    engineering_summary: Dict[str, Any] = Field(default_factory=dict)
    bom_summary: Dict[str, Any] = Field(default_factory=dict)
    process_card_lines: List[Dict[str, Any]] = Field(default_factory=list)
    export_files: List[str] = Field(default_factory=list, description="Absolute paths to generated export files")


# ─── PROJECT ROOT ─────────────────────────────────────────────────────────────

class RFProject(BaseModel):
    """
    Root data model for a Roll Forming engineering project.
    Implements COPRA audit criterion I — central engineering data model.
    """
    project_id: str = Field(default="", description="Unique project identifier")
    project_name: str = Field(default="Untitled Project")
    project_ref: str = Field(default="", description="Customer/job reference")
    created_at: str = Field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.datetime.utcnow().isoformat())
    version: str = Field(default="1")
    schema_version: str = Field(default="2.2.0")

    material: Optional[MaterialSpec] = None
    thickness_mm: float = Field(default=0.0)
    profile: Optional[ProfileSpec] = None
    flower: Optional[FlowerData] = None

    station_states: List[StationState] = Field(default_factory=list)
    station_count_recommended: int = Field(default=0)
    station_count_min: int = Field(default=0)
    station_count_premium: int = Field(default=0)

    tooling: Optional[RollToolingData] = None
    validation: Optional[ValidationResults] = None
    report: Optional[ReportOutput] = None

    tags: List[str] = Field(default_factory=list)
    notes: str = Field(default="")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "project_name": "Lipped Channel LC80x40x2",
                "project_ref": "SAI-2026-001",
                "material": {"code": "GI", "fy_mpa": 250},
                "thickness_mm": 2.0,
            }
        }
    )

    def summary(self) -> Dict[str, Any]:
        """Return a compact summary dict suitable for project listings."""
        return {
            "project_id": self.project_id,
            "project_name": self.project_name,
            "project_ref": self.project_ref,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "version": self.version,
            "material_code": self.material.code if self.material else None,
            "thickness_mm": self.thickness_mm,
            "profile_type": self.profile.profile_type if self.profile else None,
            "station_count": self.station_count_recommended,
            "has_flower": self.flower is not None,
            "has_tooling": self.tooling is not None,
            "has_report": self.report is not None,
            "tags": self.tags,
        }
