"""
User router.

GET    /api/user/me          current user profile
POST   /api/user/profile     update learner prefs
GET    /api/user/export      ZIP of all user data
DELETE /api/user/me          account deletion (cascade)
"""
import io
import json
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as DBSession

from backend.database import get_db
from backend.models.badge import Badge
from backend.models.quiz import Quiz
from backend.models.session_model import Session
from backend.schemas.user import UpdateProfileRequest, UserProfile
from backend.utils.auth_utils import get_current_user, cache
from backend.models.user import User

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/me", response_model=UserProfile, summary="Get current user profile")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/profile", response_model=UserProfile, summary="Update learner profile")
def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if body.learner_types is not None:
        current_user.learner_types = body.learner_types
    if body.depth_pref is not None:
        current_user.depth_pref = body.depth_pref
    if body.language_pref is not None:
        current_user.language_pref = body.language_pref
    if body.name is not None:
        current_user.name = body.name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/export", summary="Export all user data as ZIP")
def export_data(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # User record
        user_data = {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "language_pref": current_user.language_pref,
            "learner_types": current_user.learner_types,
            "depth_pref": current_user.depth_pref,
            "streak_count": current_user.streak_count,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        }
        zf.writestr("user.json", json.dumps(user_data, indent=2))

        # Sessions
        sessions = db.query(Session).filter(Session.user_id == current_user.id).all()
        sessions_data = [
            {"id": s.id, "title": s.title, "created_at": s.created_at.isoformat() if s.created_at else None}
            for s in sessions
        ]
        zf.writestr("sessions.json", json.dumps(sessions_data, indent=2))

        # Quizzes
        quizzes = db.query(Quiz).filter(Quiz.user_id == current_user.id).all()
        quizzes_data = [
            {
                "id": q.id,
                "topic_id": q.topic_id,
                "score": q.score,
                "difficulty": q.difficulty,
                "completed_at": q.completed_at.isoformat() if q.completed_at else None,
            }
            for q in quizzes
        ]
        zf.writestr("quizzes.json", json.dumps(quizzes_data, indent=2))

        # Badges
        badges = db.query(Badge).filter(Badge.user_id == current_user.id).all()
        badges_data = [
            {"id": b.id, "topic_id": b.topic_id, "awarded_at": b.awarded_at.isoformat() if b.awarded_at else None}
            for b in badges
        ]
        zf.writestr("badges.json", json.dumps(badges_data, indent=2))

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=eduvision_export_{current_user.id}.zip"},
    )


@router.delete("/me", summary="Delete account and all data")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    user_id = current_user.id
    # Cascade handled by FK ondelete=CASCADE in models; just delete the user
    cache.delete(f"refresh:{user_id}")
    db.delete(current_user)
    db.commit()
    return {"message": "Account and all associated data have been deleted."}
