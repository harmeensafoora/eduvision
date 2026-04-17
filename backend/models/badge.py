import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String

from backend.database import Base


class Badge(Base):
    __tablename__ = "badges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    pdf_id = Column(String(36), nullable=True)
    awarded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    badge_type = Column(String(32), default="star")
    is_public = Column(Boolean, default=True)
