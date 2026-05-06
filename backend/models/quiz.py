import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.types import JSON

from backend.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    question_types = Column(JSON, default=list)  # list[str]
    difficulty = Column(String(16), default="intermediate")
    language = Column(String(10), default="en")
    questions = Column(JSON, default=list)       # list[question objects]
    answers = Column(JSON, default=list)         # list[student answers]
    score = Column(Float, nullable=True)
    topic_scores = Column(JSON, default=dict)    # {topic_id: float}
    completed_at = Column(DateTime, nullable=True)
    question_hashes = Column(JSON, default=list) # list[str] for deduplication
    per_question_results = Column(JSON, default=list)  # [{question, correct, score, feedback}]