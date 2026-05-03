from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class GenerateQuizRequest(BaseModel):
    session_id: str
    topic_id: str
    types: List[str] = ["mcq"]
    difficulty: str = "intermediate"
    count: int = 10
    lang: str = "en"
    mode: str = "normal"  # "normal" | "revision"


class SubmitQuizRequest(BaseModel):
    quiz_id: str
    answers: List[Any]  # list of student answers (strings or dicts for match)


class QuizResultOut(BaseModel):
    quiz_id: str
    score: float
    topic_scores: Dict[str, float] = {}
    per_question: List[Dict[str, Any]] = []
    mastered_topics: List[str] = []
    needs_work: List[str] = []
    light_revision: List[str] = []
    badge_awarded: bool = False


class QuizOut(BaseModel):
    id: str
    topic_id: str
    session_id: str
    difficulty: str
    language: str
    questions: List[Dict[str, Any]] = []
    created_at: Optional[datetime] = N