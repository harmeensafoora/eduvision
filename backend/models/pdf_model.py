import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.types import JSON

from backend.database import Base


class PDF(Base):
    __tablename__ = "pdfs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    blob_url = Column(Text, nullable=True)
    page_count = Column(Integer, default=0)
    parsed_at = Column(DateTime, nullable=True)
    topics = Column(JSON, default=dict)          # {topic_name: coverage_score}
    coverage_scores = Column(JSON, default=dict) # {topic_id: float}
    strong_topics = Column(JSON, default=list)   # list[str]
    weak_topics = Column(JSON, default=list)     # list[str]
    chunks = Column(JSON, default=list)          # list[{text, page}] — stored for AI use
    embeddings = Column(Text, nullable=True)     # JSON-serialised list[list[float]]
    file_hash = Column(String(64), nullable=True, index=True)  # SHA-256 of fi