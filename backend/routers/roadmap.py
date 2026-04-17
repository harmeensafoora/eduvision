"""
Roadmap router.

GET  /api/roadmap/{session_id}?depth=solid
POST /api/roadmap/{session_id}/regenerate   body: {depth, goal}
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from backend.database import get_db
from backend.models.roadmap import RoadmapNode
from backend.models.session_model import Session
from backend.models.topic import Topic
from backend.schemas.roadmap import RegenerateRoadmapRequest, RoadmapNodeOut, RoadmapOut
from backend.services.ai_service import ai_service
from backend.utils.auth_utils import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


def _build_roadmap(
    session_id: str, depth: str, goal: str | None, db: DBSession
) -> list[RoadmapNode]:
    """Generate or regenerate roadmap nodes for a session."""
    topics = (
        db.query(Topic)
        .filter(Topic.session_id == session_id)
        .order_by(Topic.roadmap_position)
        .all()
    )
    if not topics:
        return []

    topic_names = [t.name for t in topics]
    ordered_steps = ai_service.generate_roadmap(topic_names, depth, goal)

    # Delete existing nodes for this session + depth
    db.query(RoadmapNode).filter(
        RoadmapNode.session_id == session_id,
        RoadmapNode.depth_level == depth,
    ).delete()

    # Map step topic names back to topic records
    name_to_topic = {t.name.lower(): t for t in topics}

    nodes = []
    for i, step in enumerate(ordered_steps):
        step_topic_name = step.get("topic", "")
        topic = name_to_topic.get(step_topic_name.lower())
        if topic is None:
            # Best-effort fuzzy match
            from difflib import get_close_matches

            matches = get_close_matches(
                step_topic_name.lower(), name_to_topic.keys(), n=1, cutoff=0.5
            )
            topic = name_to_topic[matches[0]] if matches else topics[i % len(topics)]

        is_locked = step.get("is_locked", False)
        status = "locked" if is_locked else ("current" if i == 0 else "next")

        # Find a PDF excerpt for this topic
        pdf_section_refs = []
        if topic.best_pdf_id:
            from backend.models.pdf_model import PDF

            pdf = db.query(PDF).filter(PDF.id == topic.best_pdf_id).first()
            if pdf and pdf.chunks:
                chunk = next(
                    (c for c in pdf.chunks if topic.name.lower() in c["text"].lower()),
                    pdf.chunks[0] if pdf.chunks else None,
                )
                if chunk:
                    pdf_section_refs = [
                        {
                            "pdf_id": topic.best_pdf_id,
                            "page": chunk["page"],
                            "excerpt": chunk["text"][:300],
                        }
                    ]

        node = RoadmapNode(
            id=str(uuid.uuid4()),
            session_id=session_id,
            topic_id=topic.id,
            depth_level=depth,
            order_index=i,
            pdf_section_refs=pdf_section_refs,
            external_resources=step.get("external_resources", [])
            if depth == "expert"
            else [],
            is_locked=is_locked,
            is_completed=False,
            status=status,
        )
        db.add(node)
        nodes.append(node)

    db.commit()
    return nodes


def _nodes_to_out(nodes: list[RoadmapNode], db: DBSession) -> list[RoadmapNodeOut]:
    result = []
    for node in sorted(nodes, key=lambda n: n.order_index):
        topic = db.query(Topic).filter(Topic.id == node.topic_id).first()
        result.append(
            RoadmapNodeOut(
                id=node.id,
                topic_id=node.topic_id,
                topic_name=topic.name if topic else "Unknown",
                depth_level=node.depth_level,
                order_index=node.order_index,
                status=node.status,
                is_locked=node.is_locked,
                is_completed=node.is_completed,
                pdf_section_refs=node.pdf_section_refs or [],
                external_resources=node.external_resources or [],
            )
        )
    return result


@router.get(
    "/{session_id}", response_model=RoadmapOut, summary="Get or generate roadmap"
)
def get_roadmap(
    session_id: str,
    depth: str = Query("solid", regex="^(exam|solid|expert)$"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    session = (
        db.query(Session)
        .filter(Session.id == session_id, Session.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    nodes = (
        db.query(RoadmapNode)
        .filter(RoadmapNode.session_id == session_id, RoadmapNode.depth_level == depth)
        .order_by(RoadmapNode.order_index)
        .all()
    )

    if not nodes:
        nodes = _build_roadmap(session_id, depth, None, db)

    return RoadmapOut(
        session_id=session_id,
        depth=depth,
        nodes=_nodes_to_out(nodes, db),
    )


@router.post(
    "/{session_id}/regenerate", response_model=RoadmapOut, summary="Regenerate roadmap"
)
def regenerate_roadmap(
    session_id: str,
    body: RegenerateRoadmapRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    session = (
        db.query(Session)
        .filter(Session.id == session_id, Session.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    nodes = _build_roadmap(session_id, body.depth, body.goal, db)

    return RoadmapOut(
        session_id=session_id,
        depth=body.depth,
        goal=body.goal,
        nodes=_nodes_to_out(nodes, db),
    )


@router.patch(
    "/{session_id}/node/{node_id}/complete", summary="Mark roadmap node as complete"
)
def complete_node(
    session_id: str,
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    # Verify the session belongs to the authenticated user
    session = (
        db.query(Session)
        .filter(Session.id == session_id, Session.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    node = (
        db.query(RoadmapNode)
        .filter(RoadmapNode.id == node_id, RoadmapNode.session_id == session_id)
        .first()
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found.")
    node.is_completed = True
    node.status = "done"
    # Unlock the next node
    next_node = (
        db.query(RoadmapNode)
        .filter(
            RoadmapNode.session_id == session_id,
            RoadmapNode.depth_level == node.depth_level,
            RoadmapNode.order_index == node.order_index + 1,
        )
        .first()
    )
    if next_node and next_node.status == "locked":
        next_node.status = "next"
        next_node.is_locked = False
    db.commit()
    return {"message": "Node marked complete."}
