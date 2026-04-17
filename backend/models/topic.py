import uuid

from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.types import JSON

from backend.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(512), nullable=False)
    prerequisite_ids = Column(JSON, default=list)   # list[str]
    roadmap_position = Column(Integer, default=0)
    coverage_scores = Column(JSON, default=dict)    # {pdf_id: float}
    best_pdf_id = Column(String(36), nullable=True)
    embedding = Column(String, nullable=True)       # JSON-serialised list[float]
