from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class AutoModeInput(BaseModel):
    thickness: float = Field(..., gt=0, description="Sheet thickness in mm")
    material: str = Field(..., description="Material code e.g. GI, SS, CR, HR, AL, MS")
    entities: Optional[List[Dict[str, Any]]] = Field(
        None, description="Pre-parsed geometry entities (LINE/ARC dicts)"
    )


class ManualProfileInput(BaseModel):
    bend_count: int = Field(..., ge=0, description="Number of bends in the profile")
    section_width_mm: float = Field(..., gt=0, description="Profile width in mm")
    section_height_mm: float = Field(..., gt=0, description="Profile height in mm")
    thickness: float = Field(..., gt=0, description="Sheet thickness in mm")
    material: str = Field(..., description="Material code")
    profile_type: Optional[str] = Field("custom", description="Profile label override")
    return_bends_count: int = Field(0, ge=0, description="Number of return/hem bends")
    lips_present: bool = Field(False, description="Whether lips/stiffeners are present")


class SvgProfileInput(BaseModel):
    """Simplified input schema for SVG generation endpoints — bend_count is inferred from profile_type."""
    section_width_mm: float = Field(..., gt=0, description="Profile width in mm")
    section_height_mm: float = Field(..., gt=0, description="Profile height in mm")
    thickness: float = Field(..., gt=0, description="Sheet thickness in mm")
    material: str = Field("GI", description="Material code")
    profile_type: Optional[str] = Field("c_channel", description="Profile label override")
    bend_count: int = Field(2, ge=0, description="Number of bends (default 2 for c-channel)")
    return_bends_count: int = Field(0, ge=0, description="Number of return/hem bends")
    lips_present: bool = Field(False, description="Whether lips/stiffeners are present")
    num_stations: Optional[int] = Field(None, ge=1, le=30, description="Override number of forming stations")

    def to_manual_profile_input(self) -> "ManualProfileInput":
        return ManualProfileInput(
            bend_count=self.bend_count,
            section_width_mm=self.section_width_mm,
            section_height_mm=self.section_height_mm,
            thickness=self.thickness,
            material=self.material,
            profile_type=self.profile_type,
            return_bends_count=self.return_bends_count,
            lips_present=self.lips_present,
        )
