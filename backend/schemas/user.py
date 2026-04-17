from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    language_pref: str = "en"
    learner_types: List[str] = []
    depth_pref: str = "solid"
    streak_count: int = 0
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    learner_types: Optional[List[str]] = None
    depth_pref: Optional[str] = None
    language_pref: Optional[str] = None
    name: Optional[str] = None
