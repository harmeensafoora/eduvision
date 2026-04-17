"""
Badge router.

POST /api/badge/award   body: {topic_id, pdf_id}
GET  /api/badge/list    user's earned badges
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from backend.database import get_db
from backend.models.badge import Badge
from backend.models.quiz import Quiz
from backend.models.topic import Topic
from backend.schemas.badge import AwardBadgeRequest, BadgeOut
from backend.utils.auth_utils import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/badge", tags=["badge"])


@router.post("/award", response_model=BadgeOut, summary="Award a badge for 100% topic score")
def award_badge(
    body: AwardBadgeRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    # Verify the user actually scored 100% on this topic
    best_quiz = (
        db.query(Quiz)
        .filter(
            Quiz.user_id == current_user.id,
            Quiz.topic_id == body.topic_id,
            Quiz.score == 100.0,
            Quiz.completed_at != None,
        )
        .first()
    )
    if not best_quiz:
        raise HTTPException(
            status_code=400,
            detail="You must score 100% on a topic quiz to earn this badge.",
        )

    # Check if already earned
    existing = db.query(Badge).filter(
        Badge.user_id == current_user.id,
        Badge.topic_id == body.topic_id,
    ).first()
    if existing:
        topic = db.query(Topic).filter(Topic.id == body.topic_id).first()
        return BadgeOut(
            id=existing.id,
            user_id=existing.user_id,
            topic_id=existing.topic_id,
            topic_name=topic.name if topic else None,
            pdf_id=existing.pdf_id,
            awarded_at=existing.awarded_at,
            badge_type=existing.badge_type,
            is_public=existing.is_public,
        )

    badge = Badge(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        topic_id=body.topic_id,
        pdf_id=body.pdf_id,
        awarded_at=datetime.now(timezone.utc),
        badge_type="star",
        is_public=True,
    )
    db.add(badge)
    db.commit()
    db.refresh(badge)

    topic = db.query(Topic).filter(Topic.id == body.topic_id).first()
    return BadgeOut(
        id=badge.id,
        user_id=badge.user_id,
        topic_id=badge.topic_id,
        topic_name=topic.name if topic else None,
        pdf_id=badge.pdf_id,
        awarded_at=badge.awarded_at,
        badge_type=badge.badge_type,
        is_public=badge.is_public,
    )


@router.get("/list", summary="List user badges")
def list_badges(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    badges = (
        db.query(Badge)
        .filter(Badge.user_id == current_user.id)
        .order_by(Badge.awarded_at.desc())
        .all()
    )
    result = []
    for b in badges:
        topic = db.query(Topic).filter(Topic.id == b.topic_id).first()
        result.append({
            "id": b.id,
            "topic_id": b.topic_id,
            "topic_name": topic.name if topic else "Unknown",
            "awarded_at": b.awarded_at.isoformat() if b.awarded_at else None,
            "badge_type": b.badge_type,
            "is_public": b.is_public,
        })
    return result
