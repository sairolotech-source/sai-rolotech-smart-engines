from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class AutoModeInput(BaseModel):
    thickness: float = Field(..., gt=0, description="Sheet thickness in mm")
    material: str = Field(..., description="Material code e.g. GI, SS, CR, HR, AL, MS")
    entities: Optional[List[Dict[str, Any]]] = Field(
        None, description="Pre-parsed geometry entities (LINE/ARC dicts)"
    )


class ManualProfileInput(BaseModel):
    bend_count: int = Field(2, ge=0, description="Number of bends in the profile (default 2 for C-section)")
    section_width_mm: float = Field(..., gt=0, description="Profile width in mm")
    section_height_mm: float = Field(..., gt=0, description="Profile height in mm")
    thickness: float = Field(..., gt=0, description="Sheet thickness in mm")
    material: str = Field(..., description="Material code")
    profile_type: Optional[str] = Field("custom", description="Profile label override")
    return_bends_count: int = Field(0, ge=0, description="Number of return/hem bends")
    lips_present: bool = Field(False, description="Whether lips/stiffeners are present")
