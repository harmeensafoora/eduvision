"""
Session router — PDF upload and session management.

POST /api/session/upload      multipart file(s) → triggers background processing
GET  /api/session/list        user's sessions
GET  /api/session/{id}        session detail + topics
GET  /api/session/{id}/status polling endpoint (processing | ready | error)
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session as DBSession

from backend.database import get_db
from backend.models.pdf_model import PDF
from backend.models.session_model import Session
from backend.models.topic import Topic
from backend.schemas.session import SessionOut, SessionStatusOut
from backend.schemas.topic import TopicOut
from backend.services.storage_service import storage_service
from backend.utils.auth_utils import get_current_user
from backend.models.user import User

router = APIRouter(prefix="/session", tags=["session"])


# ── Background processing ─────────────────────────────────────────────────────


def _process_session(session_id: str, pdf_ids: list[str], db_factory):
    """Run full PDF pipeline in a background thread."""
    db: DBSession = db_factory()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return

        from backend.services.pdf_service import (
            process_pdf,
            cluster_topics,
            name_topics,
            score_coverage,
            embed_chunks,
        )
        from backend.services.storage_service import storage_service
        from backend.services.ai_service import ai_service
        import numpy as np

        all_chunks = []
        all_embeddings = []
        pdf_chunk_ranges: list[
            tuple[int, int]
        ] = []  # (start, end) indices into all_chunks

        for pdf_id in pdf_ids:
            pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
            if not pdf or not pdf.blob_url:
                continue
            try:
                file_path = (
                    storage_service.local_path(pdf.blob_url)
                    if pdf.blob_url.startswith("/static")
                    else pdf.blob_url
                )
                result = process_pdf(file_path)
                start = len(all_chunks)
                all_chunks.extend(result["chunks"])
                all_embeddings.extend(result["embeddings"])
                end = len(all_chunks)
                pdf_chunk_ranges.append((start, end))

                pdf.page_count = result["page_count"]
                pdf.chunks = result["chunks"]
                pdf.embeddings = json.dumps(result["embeddings"])
                pdf.parsed_at = datetime.now(timezone.utc)
                db.commit()
            except Exception as exc:
                print(f"[session] PDF {pdf_id} parse error: {exc}")

        if not all_chunks:
            session.status = "error"
            db.commit()
            return

        # Cluster and name topics
        labels = cluster_topics(all_embeddings)
        topic_names = name_topics(all_chunks, labels)

        # Create Topic records
        created_topics: dict[int, Topic] = {}
        for cluster_id, name in topic_names.items():
            # Collect embeddings for this cluster
            cluster_embs = [
                emb for emb, lbl in zip(all_embeddings, labels) if lbl == cluster_id
            ]
            # Centroid embedding
            centroid = np.mean(cluster_embs, axis=0).tolist() if cluster_embs else []

            topic = Topic(
                id=str(uuid.uuid4()),
                session_id=session_id,
                name=name,
                roadmap_position=cluster_id,
                embedding=json.dumps(centroid),
            )
            db.add(topic)
            db.flush()
            created_topics[cluster_id] = topic

        # Score each PDF's coverage per topic
        for i, pdf_id in enumerate(pdf_ids):
            pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
            if not pdf or not pdf.embeddings:
                continue
            pdf_embs = json.loads(pdf.embeddings)
            cov_scores = {}
            for cluster_id, topic in created_topics.items():
                topic_emb = json.loads(topic.embedding) if topic.embedding else []
                score = score_coverage(topic_emb, pdf_embs)
                cov_scores[topic.id] = round(score, 4)
            pdf.coverage_scores = cov_scores
            # Determine strong/weak topics
            sorted_topics = sorted(cov_scores.items(), key=lambda x: x[1], reverse=True)
            pdf.strong_topics = [t for t, s in sorted_topics if s >= 0.6]
            pdf.weak_topics = [t for t, s in sorted_topics if s < 0.3]

        # Set best_pdf_id per topic
        for cluster_id, topic in created_topics.items():
            best_pdf_id = None
            best_score = -1.0
            for pdf_id in pdf_ids:
                pdf = db.query(PDF).filter(PDF.id == pdf_id).first()
                if pdf and pdf.coverage_scores:
                    score = pdf.coverage_scores.get(topic.id, 0.0)
                    if score > best_score:
                        best_score = score
                        best_pdf_id = pdf_id
            topic.best_pdf_id = best_pdf_id
            coverage_map = {}
            for pdf_id_iter in pdf_ids:
                pdf_obj = db.query(PDF).filter(PDF.id == pdf_id_iter).first()
                if pdf_obj and pdf_obj.coverage_scores:
                    coverage_map[pdf_id_iter] = pdf_obj.coverage_scores.get(
                        topic.id, 0.0
                    )
            topic.coverage_scores = coverage_map

        session.status = "ready"
        db.commit()
        print(f"[session] {session_id} processed — {len(created_topics)} topics")

    except Exception as exc:
        print(f"[session] Background processing failed: {exc}")
        session = db.query(Session).filter(Session.id == session_id).first()
        if session:
            session.status = "error"
            db.commit()
    finally:
        db.close()


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/upload", summary="Upload PDFs and start analysis")
async def upload_pdfs(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    pdf_files = [
        f
        for f in files
        if f.content_type in ("application/pdf", "application/octet-stream")
        or (f.filename or "").endswith(".pdf")
    ]
    if not pdf_files:
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Derive session title from first filename
    title = (
        Path(pdf_files[0].filename or "Untitled")
        .stem.replace("_", " ")
        .replace("-", " ")
        .title()
    )
    if len(pdf_files) > 1:
        title += f" + {len(pdf_files) - 1} more"

    session_id = str(uuid.uuid4())
    session = Session(
        id=session_id,
        user_id=current_user.id,
        title=title,
        status="processing",
    )
    db.add(session)

    pdf_ids = []
    for upload in pdf_files:
        pdf_id = str(uuid.uuid4())
        content = await upload.read()
        import io

        url = storage_service.save(
            io.BytesIO(content), upload.filename or f"{pdf_id}.pdf", current_user.id
        )
        pdf = PDF(
            id=pdf_id,
            session_id=session_id,
            filename=upload.filename or f"{pdf_id}.pdf",
            blob_url=url,
        )
        db.add(pdf)
        pdf_ids.append(pdf_id)

    session.pdf_ids = pdf_ids
    db.commit()

    from backend.database import SessionLocal

    background_tasks.add_task(_process_session, session_id, pdf_ids, SessionLocal)

    return {"session_id": session_id, "status": "processing", "pdf_count": len(pdf_ids)}


@router.get("/list", summary="List user sessions")
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    sessions = (
        db.query(Session)
        .filter(Session.user_id == current_user.id)
        .order_by(Session.last_accessed.desc())
        .limit(20)
        .all()
    )
    result = []
    for s in sessions:
        result.append(
            {
                "id": s.id,
                "title": s.title,
                "pdf_count": len(s.pdf_ids or []),
                "status": s.status,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "last_accessed": s.last_accessed.isoformat()
                if s.last_accessed
                else None,
            }
        )
    return result


@router.get(
    "/{session_id}/status",
    response_model=SessionStatusOut,
    summary="Poll processing status",
)
def session_status(
    session_id: str,
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
    return SessionStatusOut(session_id=session_id, status=session.status)


@router.get("/{session_id}", summary="Session detail with topics")
def get_session(
    session_id: str,
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

    # Update last accessed
    session.last_accessed = datetime.now(timezone.utc)
    db.commit()

    topics = db.query(Topic).filter(Topic.session_id == session_id).all()
    pdfs = db.query(PDF).filter(PDF.session_id == session_id).all()

    topic_list = []
    for t in topics:
        best_cov = max(t.coverage_scores.values()) if t.coverage_scores else 0.0
        topic_list.append(
            {
                "id": t.id,
                "name": t.name,
                "coverage": round(best_cov * 100),
                "best_pdf_id": t.best_pdf_id,
            }
        )

    pdf_list = []
    for p in pdfs:
        pdf_list.append(
            {
                "id": p.id,
                "filename": p.filename,
                "page_count": p.page_count,
                "blob_path": p.blob_url,  # Store path; get fresh URL via /pdf/{pdf_id}/url
            }
        )

    return {
        "id": session.id,
        "title": session.title,
        "status": session.status,
        "topics": topic_list,
        "pdfs": pdf_list,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }


@router.get("/{session_id}/pdf/{pdf_id}/url", summary="Get a fresh read URL for a PDF")
def get_pdf_url(
    session_id: str,
    pdf_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """Generate a fresh read URL (with SAS token for Azure) for a PDF.
    Call this endpoint when you need to display/download a PDF in the frontend."""
    session = (
        db.query(Session)
        .filter(Session.id == session_id, Session.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    pdf = db.query(PDF).filter(PDF.id == pdf_id, PDF.session_id == session_id).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found.")

    # Generate fresh URL (SAS token refreshed on each request)
    read_url = storage_service.get_read_url(pdf.blob_url)
    return {"pdf_id": pdf_id, "url": read_url}
