import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text
from sqlalchemy.types import JSON

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(320), unique=True, nullable=False, index=True)
    google_id = Column(String(128), unique=True, nullable=True)
    name = Column(String(256), nullable=False)
    avatar_url = Column(Text, nullable=True)
    language_pref = Column(String(10), default="en")
    learner_types = Column(JSON, default=list)  # list[str]
    depth_pref = Column(String(16), default="solid")  # exam | solid | expert
    streak_count = Column(Integer, default=0)
    streak_last_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
