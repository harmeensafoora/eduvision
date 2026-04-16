from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class SummarySection(BaseModel):
    title: str
    content: str
    keywords: List[str] = []


class SummaryContent(BaseModel):
    headline: str
    sections: List[SummarySection] = []


class SummaryOut(BaseModel):
    id: str
    topic_id: str
    depth: str
    language: str
    content: Optional[Dict[str, Any]] = None
    keywords: List[str] = []
    created_at: Optional[datetime] = None
    translated: bool = False
    rtl: bool = False

    model_config = {"from_attributes": True}


class TranslateRequest(BaseModel):
    lang: str
