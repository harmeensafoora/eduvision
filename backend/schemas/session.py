from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class SessionOut(BaseModel):
    id: str
    title: str
    pdf_ids: List[str] = []
    status: str = "processing"
    created_at: Optional[datetime] = None
    last_accessed: Optional[datetime] = None
    pdf_count: int = 0

    model_config = {"from_attributes": True}


class SessionStatusOut(BaseModel):
    session_id: str
    status: str  # processing | ready | error
    message: Optional[str] = None
