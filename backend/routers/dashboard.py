"""
Dashboard router.

GET /api/dashboard              aggregated stats + strengths/weaknesses
GET /api/dashboard/observation  AI observation (max once per 24h)
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from backend.database import get_db
from backend.models.badge import Badge
from backend.models.pdf_model import PDF
from backend.models.quiz import Quiz
from backend.models.session_model import Session
from backend.models.topic import Topic
from backend.utils.auth_utils import get_current_user
from backend.utils.cache import cache
from backend.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", summary="Aggregated dashboard stats")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    # Total PDFs
    sessions = db.query(Session).filter(Session.user_id == current_user.id).all()
    session_ids = [s.id for s in sessions]
    pdf_count = db.query(PDF).filter(PDF.session_id.in_(session_ids)).count() if session_ids else 0

    # All completed quizzes
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == current_user.id, Quiz.completed_at != None)
        .all()
    )
    avg_score = round(sum(q.score or 0 for q in quizzes) / len(quizzes)) if quizzes else 0

    # Topics mastered (score >= 80 at least once)
    mastered_topic_ids: set[str] = set()
    needs_work_topic_ids: set[str] = set()
    topic_best_scores: dict[str, float] = {}

    for q in quizzes:
        current_best = topic_best_scores.get(q.topic_id, 0.0)
        if (q.score or 0) > current_best:
            topic_best_scores[q.topic_id] = q.score or 0

    for tid, score in topic_best_scores.items():
        if score >= 80:
            mastered_topic_ids.add(tid)
        elif score < 50:
            needs_work_topic_ids.add(tid)

    # Total topics across user's sessions
    all_topics = db.query(Topic).filter(Topic.session_id.in_(session_ids)).all() if session_ids else []
    total_topics = len(all_topics)

    # Strengths and weaknesses
    strengths = []
    weaknesses = []
    for topic in all_topics:
        score = topic_best_scores.get(topic.id)
        if score is None:
            continue
        if score >= 80:
            strengths.append({"topic_id": topic.id, "topic_name": topic.name, "score": score})
        elif score < 50:
            weaknesses.append({"topic_id": topic.id, "topic_name": topic.name, "score": score})

    strengths.sort(key=lambda x: x["score"], reverse=True)
    weaknesses.sort(key=lambda x: x["score"])

    # Concept map nodes
    concept_map = []
    for topic in all_topics:
        score = topic_best_scores.get(topic.id)
        if score is None:
            status = "not_started"
        elif score >= 80:
            status = "mastered"
        else:
            status = "in_progress"
        concept_map.append({
            "topic_id": topic.id,
            "topic_name": topic.name,
            "status": status,
            "score": score,
        })

    # Badges
    badges = db.query(Badge).filter(Badge.user_id == current_user.id).all()
    badge_count = len(badges)

    return {
        "stats": {
            "topics_mastered": len(mastered_topic_ids),
            "total_topics": total_topics,
            "avg_quiz_score": avg_score,
            "streak_count": current_user.streak_count,
            "pdfs_analysed": pdf_count,
            "badges_earned": badge_count,
        },
        "strengths": strengths[:5],
        "weaknesses": weaknesses[:5],
        "concept_map": concept_map,
        "user": {
            "name": current_user.name,
            "avatar_url": current_user.avatar_url,
            "learner_types": current_user.learner_types or [],
            "streak_count": current_user.streak_count,
            "member_since": current_user.created_at.isoformat() if current_user.created_at else None,
        },
    }


@router.get("/observation", summary="AI-generated learner observation (max once per 24h)")
def get_observation(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    cache_key = f"observation:{current_user.id}"
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    from backend.models.learner_profile import LearnerProfile
    profile = db.query(LearnerProfile).filter(LearnerProfile.user_id == current_user.id).first()

    # Check if we generated one recently (within 24h)
    if profile and profile.last_observation_at:
        age = (datetime.now(timezone.utc) - profile.last_observation_at.replace(tzinfo=timezone.utc)).total_seconds()
        if age < 86400 and profile.ai_observation:
            result = json.loads(profile.ai_observation) if profile.ai_observation.startswith("{") else {
                "strength": "—", "weakness": "—", "observation": profile.ai_observation
            }
            cache.set(cache_key, json.dumps(result), ex=int(86400 - age))
            return result

    # Build history for GPT
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == current_user.id, Quiz.completed_at != None)
        .order_by(Quiz.completed_at.desc())
        .limit(30)
        .all()
    )
    if not quizzes:
        return {"strength": "—", "weakness": "—", "observation": "Complete some quizzes to receive a personalised observation."}

    history = []
    for q in quizzes:
        topic = db.query(Topic).filter(Topic.id == q.topic_id).first()
        history.append({
            "topic": topic.name if topic else "Unknown",
            "score": q.score,
            "difficulty": q.difficulty,
            "completed_at": q.completed_at.isoformat() if q.completed_at else None,
        })

    from backend.services.ai_service import ai_service
    try:
        result = ai_service.generate_observation(history)
    except Exception as exc:
        return {"strength": "—", "weakness": "—", "observation": f"Could not generate observation: {exc}"}

    result_str = json.dumps(result)

    # Persist
    if not profile:
        from backend.models.learner_profile import LearnerProfile
        profile = LearnerProfile(
            user_id=current_user.id,
            ai_observation=result_str,
            last_observation_at=datetime.now(timezone.utc),
        )
        db.add(profile)
    else:
        profile.ai_observation = result_str
        profile.last_observation_at = datetime.now(timezone.utc)
    db.commit()

    cache.set(cache_key, result_str, ex=86400)
    return result
