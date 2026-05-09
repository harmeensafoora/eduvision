"""
Summary router.

GET  /api/summary/{session_id}/{topic_id}?depth=structured&lang=en
POST /api/summary/{summary_id}/translate    body: {lang}
GET  /api/summary/languages                 list of supported languages
"""

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from backend.config import settings
from backend.database import get_db
from backend.models.pdf_model import PDF
from backend.models.summary import Summary
from backend.models.topic import Topic
from backend.schemas.summary import SummaryOut, TranslateRequest
from backend.services.ai_service import ai_service
from backend.services.translation_service import (
    translation_service,
    SUPPORTED_LANGUAGES,
)
from backend.utils.auth_utils import get_current_user
from backend.utils.cache import cache
from backend.models.user import User

router = APIRouter(prefix="/summary", tags=["summary"])

CACHE_TTL = 86400  # 24 hours

_RTL_LANGS = {"ar", "he", "ur", "fa"}


def _get_topic_excerpts(topic: Topic, db: DBSession, max_chars: int = 3000) -> str:
    """Build a representative excerpt string for a topic."""
    pdfs = db.query(PDF).filter(PDF.session_id == topic.session_id).all()
    excerpts = []
    for pdf in pdfs:
        if not pdf.chunks:
            continue
        # Use chunks that mention the topic name (simple heuristic)
        topic_lower = topic.name.lower()
        relevant = [c["text"] for c in pdf.chunks if topic_lower in c["text"].lower()]
        if not relevant:
            # Fall back to first few chunks
            relevant = [c["text"] for c in pdf.chunks[:4]]
        excerpts.extend(relevant[:6])
        if sum(len(e) for e in excerpts) > max_chars:
            break

    combined = "\n\n---\n\n".join(excerpts)
    return combined[:max_chars]


@router.get("/languages", summary="List supported languages")
def get_languages():
    return SUPPORTED_LANGUAGES


@router.get(
    "/{session_id}/{topic_id}",
    response_model=SummaryOut,
    summary="Get or generate summary",
)
def get_summary(
    session_id: str,
    topic_id: str,
    depth: str = Query("structured", pattern="^(quick|structured|detailed)$"),
    lang: str = Query("en"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id, Topic.session_id == session_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found.")

    learner_type = ",".join(current_user.learner_types or []) or "general"

    # Cache key
    cache_key = f"summary:{topic_id}:{depth}:{lang}:{learner_type}:v2"
    cached = cache.get(cache_key)
    if cached:
        data = json.loads(cached)
        return SummaryOut(**data)

    # Check DB
    existing = (
        db.query(Summary)
        .filter(
            Summary.topic_id == topic_id,
            Summary.depth == depth,
            Summary.language == lang,
        )
        .first()
    )
    if existing:
        out = SummaryOut(
            id=existing.id,
            topic_id=existing.topic_id,
            depth=existing.depth,
            language=existing.language,
            content=existing.content,
            keywords=existing.keywords or [],
            created_at=existing.created_at,
            rtl=existing.language in _RTL_LANGS,
        )
        cache.set(cache_key, out.model_dump_json(), ex=CACHE_TTL)
        return out

    # Generate via AI
    excerpts = _get_topic_excerpts(topic, db)
    if not excerpts:
        raise HTTPException(
            status_code=422,
            detail="No content found for this topic in your uploaded PDFs.",
        )

    # Always generate in English first (saves tokens on repeat calls, enables reliable translation)
    if lang != "en":
        en_base = (
            db.query(Summary)
            .filter(Summary.topic_id == topic_id, Summary.depth == depth, Summary.language == "en")
            .first()
        )
        if en_base:
            en_content = en_base.content
        else:
            en_content = ai_service.generate_summary(topic.name, excerpts, depth, learner_type, "en")
            en_kws = list({kw for s in en_content.get("sections", []) for kw in s.get("keywords", [])})
            db.add(Summary(
                id=str(uuid.uuid4()), topic_id=topic_id, pdf_id=topic.best_pdf_id,
                depth=depth, language="en", content=en_content, keywords=en_kws,
            ))
            db.flush()
        content = translation_service.translate_summary(en_content, lang)
    else:
        content = ai_service.generate_summary(topic.name, excerpts, depth, learner_type, "en")

    keywords = list({kw for s in content.get("sections", []) for kw in s.get("keywords", [])})

    summary = Summary(
        id=str(uuid.uuid4()),
        topic_id=topic_id,
        pdf_id=topic.best_pdf_id,
        depth=depth,
        language=lang,
        content=content,
        keywords=keywords,
    )
    db.add(summary)
    db.commit()
    db.refresh(summary)

    out = SummaryOut(
        id=summary.id,
        topic_id=summary.topic_id,
        depth=summary.depth,
        language=summary.language,
        content=summary.content,
        keywords=summary.keywords or [],
        created_at=summary.created_at,
        rtl=summary.language in _RTL_LANGS,
    )
    cache.set(cache_key, out.model_dump_json(), ex=CACHE_TTL)
    return out


@router.post("/{summary_id}/translate", summary="Translate an existing summary")
def translate_summary(
    summary_id: str,
    body: TranslateRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    summary = db.query(Summary).filter(Summary.id == summary_id).first()
    if not summary:
        raise HTTPException(status_code=404, detail="Summary not found.")

    if summary.language == body.lang:
        return {
            "id": summary.id,
            "content": summary.content,
            "language": summary.language,
            "translated": False,
            "rtl": body.lang in _RTL_LANGS,
            "keywords": summary.keywords or [],
        }

    translated_content = translation_service.translate_summary(
        summary.content, body.lang
    )
    rtl = body.lang in _RTL_LANGS

    # Translate keywords list
    translated_keywords = []
    for kw in summary.keywords or []:
        result = translation_service.translate_text(kw, body.lang)
        translated_keywords.append(result["text"])

    return {
        "id": summary.id,
        "content": translated_content,
        "language": body.lang,
        "translated": settings.USE_TRANSLATION,
        "rtl": rtl,
        "keywords": translated_keywords,
    }
