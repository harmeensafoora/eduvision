from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator


class RoadmapNodeOut(BaseModel):
    id: str
    topic_id: str
    topic_name: str
    depth_level: str
    order_index: int
    status: str  # done | current | next | locked
    is_locked: bool
    is_completed: bool
    pdf_section_refs: List[Dict[str, Any]] = []
    external_resources: List[Dict[str, Any]] = []

    model_config = {"from_attributes": True}


class RoadmapOut(BaseModel):
    session_id: str
    depth: str
    goal: Optional[str] = None
    nodes: List[RoadmapNodeOut] = []


class RegenerateRoadmapRequest(BaseModel):
    depth: str = "solid"
    goal: Optional[str] = None

    @field_validator("depth")
    @classmethod
    def validate_depth(cls, v: str) -> str:
        if v not in ("exam", "solid", "expert"):
            raise ValueError("depth must be exam, solid, or expert")
        return v
