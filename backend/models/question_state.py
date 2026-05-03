import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from backend.database import Base


class QuestionState(Base):
    """Tracks spaced repetition state per question per user per topic."""

    __tablename__ = "question_states"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id = Column(
        String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False
    )
    question_hash = Column(String(64), nullable=False)  # SHA256 of question text
    state = Column(String(16), default="due")  # "due" | "retired"
    attempts = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    last_attempted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
