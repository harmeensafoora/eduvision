"""
Session router — PDF upload and session management.

POST /api/session/upload      multipart file(s) → triggers background processing
GET  /api/session/list        user's sessions
GET  /api/session/{id}        session detail + topics
GET  /api/session/{id}/status polling endpoint (processing | ready | error)
"""

import hashlib
import io
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _find_cached_pdf(file_hash: str, db: DBSession) -> PDF | None:
    """Return the most recent fully-processed PDF with this content hash, if any."""
    return (
        db.query(PDF)
        .filter(PDF.file_hash == file_hash, PDF.parsed_at != None)
        .order_by(PDF.parsed_at.desc())
        .first()
    )


# ── Background processing ─────────────────────────────────────────────────────


def _process_session(session_id: str, pdf_ids: list[str], db_factory):
    """Run full PDF pipeline in a background thread.

    For each PDF:
      - If the PDF already has a file_hash AND another fully-processed PDF with
        the same hash exists, copy its chunks/embeddings (cache hit — no AI tokens).
      - Otherwise run the full parse + embed pipeline (cache miss).
    """
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

        all_chunks: list[dict] = []
        all_embeddings: list[list[float]] = []

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

                # ── Cache lookup ──────────────────────────────────────────────
                cached = None
                if pdf.file_hash:
                    # Look for a DIFFERENT pdf row (already processed) with the same hash
                    cached = (
                        db.query(PDF)
                        .filter(
                            PDF.file_hash == pdf.file_hash,
                            PDF.parsed_at != None,
                            PDF.id != pdf_id,
                        )
                        .order_by(PDF.parsed_at.desc())
                        .first()
                    )

                if cached and cached.chunks and cached.embeddings:
                    print(f"[session] PDF {pdf_id} — cache HIT (hash {pdf.file_hash[:8]}…), reusing parsed data")
                    chunks = cached.chunks
                    embeddings = json.loads(cached.embeddings)
                    pdf.page_count = cached.page_count
                    pdf.chunks = chunks
                    pdf.embeddings = cached.embeddings  # already serialised string
                    pdf.parsed_at = datetime.now(timezone.utc)
                    db.commit()
                else:
                    # ── Full parse (cache miss) ───────────────────────────────
                    print(f"[session] PDF {pdf_id} — cache MISS, running full pipeline")
                    result = process_pdf(file_path)
                    chunks = result["chunks"]
                    embeddings = result["embeddings"]
                    pdf.page_count = result["page_count"]
                    pdf.chunks = chunks
                    pdf.embeddings = json.dumps(embeddings)
                    pdf.parsed_at = datetime.now(timezone.utc)
                    db.commit()

                all_chunks.extend(chunks)
                all_embeddings.extend(embeddings)

            except Exception as exc:
                print(f"[session] PDF {pdf_id} parse error: {exc}")

        if not all_chunks:
            session.status = "error"
            db.commit()
            return

        # Cluster and name topics
        n_desired = max(
            len(pdf_ids) + 1,
            min(10, max(3, len(all_chunks) // 5)),
        )
        labels = cluster_topics(all_embeddings, n_topics=n_desired)
        topic_names = name_topics(all_chunks, labels)

        # Create Topic records
        created_topics: dict[int, Topic] = {}
        for cluster_id, name in topic_names.items():
            cluster_embs = [
                emb for emb, lbl in zip(all_embeddings, labels) if lbl == cluster_id
            ]
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
        for pdf_id in pdf_ids:
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
            sorted_topics = sorted(cov_scores.items(), key=lambda x: x[1], reverse=True)
            pdf.strong_topics = [t for t, s in sorted_topics if s >= 0.6]
            pdf.weak_topics = [t for t, s in sorted_topics if s < 0.3]

        # Set best_pdf_id per topic
        for cluster_id, topic in created_topics.items():
            best_pdf_id = None
            best_score = -1.0
            coverage_map: dict[str, float] = {}
            for pdf_id_iter in pdf_ids:
                pdf_obj = db.query(PDF).filter(PDF.id == pdf_id_iter).first()
                if pdf_obj and pdf_obj.coverage_scores:
                    score = pdf_obj.coverage_scores.get(topic.id, 0.0)
                    coverage_map[pdf_id_iter] = score
                    if score > best_score:
                        best_score = score
                        best_pdf_id = pdf_id_iter
            topic.best_pdf_id = best_pdf_id
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

    # Read all file bytes once so we can hash them and check for duplicates
    file_contents = []
    for upload in pdf_files:
        content = await upload.read()
        file_contents.append((upload, content))

    # Compute per-file hashes and build a canonical session fingerprint
    incoming_hashes = sorted(_sha256(content) for _, content in file_contents)

    # Check whether the user already has a ready session with this exact PDF set.
    # Single query to avoid N+1 blocking the event loop.
    existing_ready = (
        db.query(Session)
        .filter(Session.user_id == current_user.id, Session.status == "ready")
        .all()
    )
    candidate_ids = [
        s.id for s in existing_ready
        if s.pdf_ids and len(s.pdf_ids) == len(pdf_files)
    ]
    if candidate_ids:
        from collections import defaultdict
        rows = (
            db.query(PDF.session_id, PDF.file_hash)
            .filter(PDF.session_id.in_(candidate_ids), PDF.file_hash.isnot(None))
            .all()
        )
        hashes_by_session: dict[str, list[str]] = defaultdict(list)
        for sid, fhash in rows:
            hashes_by_session[sid].append(fhash)
        for sess in existing_ready:
            if sess.id not in hashes_by_session:
                continue
            if sorted(hashes_by_session[sess.id]) == incoming_hashes:
                sess.last_accessed = datetime.now(timezone.utc)
                db.commit()
                return {
                    "session_id": sess.id,
                    "status": "ready",
                    "pdf_count": len(sess.pdf_ids),
                    "reused": True,
                }

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
    for upload, content in file_contents:
        pdf_id = str(uuid.uuid4())
        file_hash = _sha256(content)

        try:
            url = storage_service.save(
                io.BytesIO(content), upload.filename or f"{pdf_id}.pdf", current_user.id
            )
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        pdf = PDF(
            id=pdf_id,
            session_id=session_id,
            filename=upload.filename or f"{pdf_id}.pdf",
            blob_url=url,
            file_hash=file_hash,
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


@router.get(
    "/{session_id}/pdf/{pdf_id}/url",
    summary="Get a fresh URL for a PDF in the session",
)
def get_pdf_url(
    session_id: str,
    pdf_id: str,
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

    pdf = db.query(PDF).filter(
        PDF.id == pdf_id, PDF.session_id == session_id
    ).first()
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found.")

    return {"url": pdf.blob_url, "filename": pdf.filename}


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

    session.last_accessed = datetime.now(timezone.utc)
    db.commit()

    topics = db.query(Topic).filter(Topic.session_id == session_id).all()
    pdfs = db.query(PDF).filter(PDF.session_id == session_id).all()

    topic_list = []
    for t in topics:
        scores = t.coverage_scores or {}
        best_cov = max(scores.values()) if scores else 0.0
        topic_list.append({
            "id": t.id,
            "name": t.name,
            "coverage": round(best_cov * 100),
            "best_pdf_id": t.best_pdf_id,
            "coverage_by_pdf": {pid: round(cov * 100) for pid, cov in scores.items()},
        })

    pdf_list = []
    for p in pdfs:
        pdf_list.append({
            "id": p.id,
            "filename": p.filename,
            "page_count": p.page_count,
            "blob_url": p.blob_url,
        })

    return {
        "id": session.id,
        "title": session.title,
        "status": session.status,
        "topics": topic_list,
        "pdfs": pdf_list,
        "created_at": session.created_at.isoformat() if session.created_at else None,
    }