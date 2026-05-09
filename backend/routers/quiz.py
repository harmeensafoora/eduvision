"""
Quiz router.

POST /api/quiz/generate              body: GenerateQuizRequest → questions
POST /api/quiz/submit                body: SubmitQuizRequest   → scored results
GET  /api/quiz/history               user's quiz history
GET  /api/quiz/wrong-answers/{topic_id}  questions the user got wrong (for revision)
"""

import difflib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from backend.database import get_db
from backend.models.pdf_model import PDF
from backend.models.quiz import Quiz
from backend.models.question_state import QuestionState
from backend.models.session_model import Session
from backend.models.topic import Topic
from backend.schemas.quiz import GenerateQuizRequest, QuizResultOut, SubmitQuizRequest
from backend.services.ai_service import ai_service
from backend.utils.auth_utils import get_current_user
from backend.utils.cache import cache
from backend.models.user import User

router = APIRouter(prefix="/quiz", tags=["quiz"])

EXCERPT_CACHE_TTL = 21600   # 6 hours — excerpts rarely change after upload
QUIZ_GEN_CACHE_TTL = 1200   # 20 min — avoids duplicate AI calls on rapid retries


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_wrong_questions(user_id: str, topic_id: str, db: DBSession) -> list[dict]:
    """Collect questions the user previously answered incorrectly on this topic."""
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == user_id, Quiz.topic_id == topic_id, Quiz.completed_at != None)
        .order_by(Quiz.completed_at.desc())
        .all()
    )
    wrong: list[dict] = []
    for qz in quizzes:
        results = qz.per_question_results or []
        for r in results:
            if not r.get("is_correct", True):
                wrong.append({
                    "type": r.get("type", "mcq"),
                    "question": r.get("question", ""),
                    "options": r.get("options", []),
                    "pairs": r.get("pairs", []),
                    "correct_answer": r.get("correct_answer", ""),
                    "explanation": r.get("feedback", ""),
                })
    return wrong


def _get_topic_excerpts(topic: Topic, db: DBSession, max_chars: int = 4000) -> str:
    cache_key = f"excerpts:{topic.id}:{max_chars}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    pdfs = db.query(PDF).filter(PDF.session_id == topic.session_id).all()
    excerpts = []
    for pdf in pdfs:
        if not pdf.chunks:
            continue
        topic_lower = topic.name.lower()
        relevant = [c["text"] for c in pdf.chunks if topic_lower in c["text"].lower()]
        if not relevant:
            relevant = [c["text"] for c in pdf.chunks[:5]]
        excerpts.extend(relevant[:8])
        if sum(len(e) for e in excerpts) > max_chars:
            break
    result = "\n\n---\n\n".join(excerpts)[:max_chars]
    cache.set(cache_key, result, ex=EXCERPT_CACHE_TTL)
    return result


def _evaluate_answer(q: dict, student_answer: Any, excerpts: str) -> dict:
    """Return {is_correct, score, feedback}."""
    qtype = q.get("type", "mcq")
    correct = q.get("correct_answer", "")
    explanation = q.get("explanation", "")

    if qtype in ("mcq", "tf"):
        is_correct = str(student_answer).strip().lower() == str(correct).strip().lower()
        return {
            "is_correct": is_correct,
            "score": 100 if is_correct else 0,
            "feedback": explanation
            if is_correct
            else f"Correct answer: {correct}. {explanation}",
        }

    if qtype == "ow":
        ratio = difflib.SequenceMatcher(
            None, str(correct).lower(), str(student_answer).lower()
        ).ratio()
        if ratio > 0.85:
            return {"is_correct": True, "score": 100, "feedback": explanation}
        try:
            result = ai_service.evaluate_open_answer(
                q.get("question", ""), correct, str(student_answer), excerpts[:500]
            )
            return result
        except Exception:
            score = int(ratio * 100)
            return {
                "is_correct": score >= 70,
                "score": score,
                "feedback": f"Correct: {correct}",
            }

    if qtype == "os":
        try:
            result = ai_service.evaluate_open_answer(
                q.get("question", ""), correct, str(student_answer), excerpts[:500]
            )
            return result
        except Exception:
            return {
                "is_correct": False,
                "score": 0,
                "feedback": f"Could not evaluate. Correct: {correct}",
            }

    if qtype == "match":
        pairs = q.get("pairs", [])
        correct_map = {str(p[0]).lower(): str(p[1]).lower() for p in pairs}
        student_map = {}
        if isinstance(student_answer, list):
            for item in student_answer:
                if isinstance(item, (list, tuple)) and len(item) == 2:
                    student_map[str(item[0]).lower()] = str(item[1]).lower()
        matched = sum(1 for k, v in correct_map.items() if student_map.get(k) == v)
        total = len(correct_map)
        score = int((matched / total) * 100) if total else 0
        return {
            "is_correct": score >= 70,
            "score": score,
            "feedback": f"{matched}/{total} pairs matched. {explanation}",
        }

    return {"is_correct": False, "score": 0, "feedback": "Unknown question type."}


@router.post("/generate", summary="Generate quiz questions")
def generate_quiz(
    body: GenerateQuizRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    topic = (
        db.query(Topic)
        .filter(Topic.id == body.topic_id, Topic.session_id == body.session_id)
        .first()
    )
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found.")

    session = (
        db.query(Session)
        .filter(Session.id == body.session_id, Session.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=403, detail="Not your session.")

    # ── Revision mode: pull questions the user previously got wrong ────────────
    if body.mode == "revision":
        wrong_questions = _get_wrong_questions(current_user.id, topic.id, db)
        if not wrong_questions:
            raise HTTPException(
                status_code=404,
                detail="No wrong answers found for this topic yet. Take a normal quiz first!",
            )
        # Sample up to `count` wrong questions (prefer most recent mistakes)
        selected = wrong_questions[: body.count]
        for q in selected:
            q["hash"] = ai_service.question_hash(topic.id, q.get("question", ""))

        quiz = Quiz(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            topic_id=topic.id,
            session_id=body.session_id,
            question_types=list({q.get("type", "mcq") for q in selected}),
            difficulty=body.difficulty,
            language=body.lang,
            questions=selected,
            question_hashes=[q["hash"] for q in selected],
        )
        db.add(quiz)
        db.commit()
        db.refresh(quiz)

        return {
            "quiz_id": quiz.id,
            "topic_id": topic.id,
            "topic_name": topic.name,
            "questions": selected,
            "count": len(selected),
            "mode": "revision",
        }

    # ── Normal mode ────────────────────────────────────────────────────────────
    excerpts = _get_topic_excerpts(topic, db)
    if not excerpts:
        raise HTTPException(
            status_code=422,
            detail="No content found for this topic. Ensure PDFs have been processed.",
        )

    # Full deduplication: collect ALL previous questions for this user + topic
    all_prev_quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == current_user.id, Quiz.topic_id == topic.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    prev_questions: list[str] = []
    seen_hashes: set[str] = set()
    for pq in all_prev_quizzes:
        for h in (pq.question_hashes or []):
            seen_hashes.add(h)
        for q in (pq.questions or []):
            prev_questions.append(q.get("question", ""))

    # If the user has exhausted the question pool (seen many), let the AI know it's OK to vary
    exhausted = len(seen_hashes) >= 40

    types_key = "_".join(sorted(body.types))
    completed_count = sum(1 for q in all_prev_quizzes if q.completed_at)
    quiz_cache_key = f"quiz_gen:{current_user.id}:{topic.id}:{types_key}:{body.difficulty}:{body.lang}:{body.count}:{completed_count}"
    cached_qs = cache.get(quiz_cache_key)
    if cached_qs and not exhausted:
        questions = json.loads(cached_qs)
    else:
        questions = ai_service.generate_quiz(
            topic_name=topic.name,
            excerpts=excerpts,
            count=body.count,
            types=body.types,
            difficulty=body.difficulty,
            lang=body.lang,
            previous_questions=prev_questions if not exhausted else [],
        )
        if questions:
            cache.set(quiz_cache_key, json.dumps(questions), ex=QUIZ_GEN_CACHE_TTL)

    if not questions:
        raise HTTPException(
            status_code=500, detail="Quiz generation failed. Check AI configuration."
        )

    for q in questions:
        q["hash"] = ai_service.question_hash(topic.id, q.get("question", ""))

    quiz = Quiz(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        topic_id=topic.id,
        session_id=body.session_id,
        question_types=body.types,
        difficulty=body.difficulty,
        language=body.lang,
        questions=questions,
        question_hashes=[q["hash"] for q in questions],
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    return {
        "quiz_id": quiz.id,
        "topic_id": topic.id,
        "topic_name": topic.name,
        "questions": questions,
        "count": len(questions),
        "mode": "normal",
    }


@router.post(
    "/submit", response_model=QuizResultOut, summary="Submit answers and get results"
)
def submit_quiz(
    body: SubmitQuizRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    quiz = (
        db.query(Quiz)
        .filter(Quiz.id == body.quiz_id, Quiz.user_id == current_user.id)
        .first()
    )
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    if quiz.completed_at:
        raise HTTPException(status_code=400, detail="Quiz already submitted.")

    questions = quiz.questions or []
    answers = body.answers

    if len(answers) != len(questions):
        raise HTTPException(
            status_code=400,
            detail=f"Expected {len(questions)} answers, got {len(answers)}.",
        )

    topic = db.query(Topic).filter(Topic.id == quiz.topic_id).first()
    excerpts = _get_topic_excerpts(topic, db) if topic else ""

    per_question = []
    total_score = 0.0

    for i, (q, student_ans) in enumerate(zip(questions, answers)):
        result = _evaluate_answer(q, student_ans, excerpts)
        per_question.append(
            {
                "index": i,
                "question": q.get("question"),
                "type": q.get("type"),
                "options": q.get("options", []),
                "pairs": q.get("pairs", []),
                "student_answer": student_ans,
                "correct_answer": q.get("correct_answer"),
                **result,
            }
        )
        total_score += result.get("score", 0)

    final_score = round(total_score / len(questions)) if questions else 0

    mastered = [quiz.topic_id] if final_score >= 80 else []
    needs_work = [quiz.topic_id] if final_score < 50 else []
    light_revision = [quiz.topic_id] if 50 <= final_score < 80 else []

    quiz.answers = answers
    quiz.score = final_score
    quiz.topic_scores = {quiz.topic_id: final_score}
    quiz.per_question_results = per_question   # persist for revision mode
    quiz.completed_at = datetime.now(timezone.utc)
    db.commit()

    _update_streak(current_user, db)

    # ── Update spaced repetition (SRS) state ─────────────────────────────
    for i, (q, student_ans) in enumerate(zip(questions, answers)):
        q_hash = q.get("hash") or ai_service.question_hash(quiz.topic_id, q.get("question", ""))
        result = per_question[i]
        is_correct = result.get("is_correct", False)

        qs = (
            db.query(QuestionState)
            .filter(
                QuestionState.user_id == current_user.id,
                QuestionState.topic_id == quiz.topic_id,
                QuestionState.question_hash == q_hash,
            )
            .first()
        )
        if not qs:
            qs = QuestionState(
                user_id=current_user.id,
                topic_id=quiz.topic_id,
                question_hash=q_hash,
                attempts=0,
                correct_count=0,
            )
            db.add(qs)
        qs.attempts += 1
        if is_correct:
            qs.correct_count += 1
            if qs.correct_count >= 3:
                qs.state = "retired"
        else:
            qs.state = "due"
        qs.last_attempted_at = datetime.now(timezone.utc)

    db.commit()

    return QuizResultOut(
        quiz_id=quiz.id,
        score=final_score,
        topic_scores={quiz.topic_id: final_score},
        per_question=per_question,
        mastered_topics=mastered,
        needs_work=needs_work,
        light_revision=light_revision,
        badge_awarded=False,
    )


# ── History & wrong-answers endpoints ─────────────────────────────────────────


@router.get("/history", summary="User's quiz history")
def quiz_history(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == current_user.id, Quiz.completed_at != None)
        .order_by(Quiz.completed_at.desc())
        .limit(50)
        .all()
    )
    result = []
    for q in quizzes:
        topic = db.query(Topic).filter(Topic.id == q.topic_id).first()
        result.append({
            "id": q.id,
            "topic_id": q.topic_id,
            "topic_name": topic.name if topic else "Unknown",
            "score": q.score,
            "difficulty": q.difficulty,
            "mode": q.question_types[0] if q.question_types else "normal",
            "completed_at": q.completed_at.isoformat() if q.completed_at else None,
        })
    return result


@router.get("/wrong-answers/{topic_id}", summary="Wrong answers for a topic")
def get_wrong_answers(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    wrong = _get_wrong_questions(current_user.id, topic_id, db)
    return {"wrong_count": len(wrong), "questions": wrong}