import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.types import JSON

from backend.database import Base


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pdf_id = Column(String(36), ForeignKey("pdfs.id", ondelete="CASCADE"), nullable=True)
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    depth = Column(String(16), nullable=False)   # quick | structured | detailed
    language = Column(String(10), default="en")
    content = Column(JSON, nullable=True)        # {headline, sections:[{title,content,keywords}]}
    keywords = Column(JSON, default=list)        # list[str]
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
