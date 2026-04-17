from typing import Dict, List, Optional

from pydantic import BaseModel


class TopicOut(BaseModel):
    id: str
    name: str
    session_id: str
    coverage_scores: Dict[str, float] = {}
    best_pdf_id: Optional[str] = None
    roadmap_position: int = 0
    prerequisite_ids: List[str] = []

    model_config = {"from_attributes": True}
