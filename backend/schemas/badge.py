from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AwardBadgeRequest(BaseModel):
    topic_id: str
    pdf_id: Optional[str] = None


class BadgeOut(BaseModel):
    id: str
    user_id: str
    topic_id: str
    topic_name: Optional[str] = None
    pdf_id: Optional[str] = None
    awarded_at: Optional[datetime] = None
    badge_type: str = "star"
    is_public: bool = True

    model_config = {"from_attributes": True}
