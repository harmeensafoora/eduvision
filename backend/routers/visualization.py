"""
Visualization router.

GET /api/summary/{session_id}/{topic_id}/visualization?mode=labelled|diagram
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from backend.database import get_db
from backend.models.topic import Topic
from backend.models.user import User
from backend.services.visualization_service import visualization_service
from backend.utils.auth_utils import get_current_user

router = APIRouter(prefix="/summary", tags=["visualization"])


@router.get(
    "/{session_id}/{topic_id}/visualization",
    summary="Get visualization for a topic (labelled image or concept map diagram)",
)
def get_visualization(
    session_id: str,
    topic_id: str,
    mode: str = Query("diagram", pattern="^(labelled|diagram)$"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    topic = db.query(Topic).filter(
        Topic.id == topic_id, Topic.session_id == session_id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found.")

    if mode == "labelled":
        return visualization_service.get_labelled(topic, db)
    else:
        return visualization_service.get_diagram(topic, db)
