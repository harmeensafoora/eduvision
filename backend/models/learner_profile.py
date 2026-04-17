import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from sqlalchemy.types import JSON

from backend.database import Base


class LearnerProfile(Base):
    __tablename__ = "learner_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    learner_types = Column(JSON, default=list)    # list[str]
    strengths = Column(JSON, default=list)        # list[str] topic names
    weaknesses = Column(JSON, default=list)       # list[str] topic names
    last_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ai_observation = Column(Text, nullable=True)
    last_observation_at = Column(DateTime, nullable=True)
