import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.types import JSON

from backend.database import Base


class RoadmapNode(Base):
    __tablename__ = "roadmap_nodes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    depth_level = Column(String(16), default="solid")   # exam | solid | expert
    order_index = Column(Integer, default=0)
    pdf_section_refs = Column(JSON, default=list)        # [{pdf_id, page, excerpt}]
    external_resources = Column(JSON, default=list)      # [{title, url}]
    is_locked = Column(Boolean, default=False)
    is_completed = Column(Boolean, default=False)
    status = Column(String(16), default="next")          # done | current | next | locked
