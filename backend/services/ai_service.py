"""
All LLM calls go through this module:
  - Retry logic (3 attempts, exponential backoff)
  - Structured JSON responses
  - Summary, quiz generation, quiz evaluation, AI observation, roadmap generation, topic naming
"""
import hashlib
import json
import time
from typing import Any

from backend.config import settings
from backend.services.gemini_router import router as gemini_router


class AIService:
    def __init__(self):
        pass

    def _call(
        self,
        messages: list[dict],
        max_tokens: int = 1500,
        json_mode: bool = False,
    ) -> str:
        system_parts = [m["content"] for m in messages if m["role"] == "system"]
        user_parts = [m["content"] for m in messages if m["role"] == "user"]

        system_instruction = "\n\n".join(system_parts).strip() if system_parts else None
        prompt = "\n\n".join(user_parts).strip()

        if json_mode:
            prompt += "\n\nReturn only valid JSON. Do not use markdown fences."

        for attempt in range(3):
            try:
                return gemini_router.generate_text(
                    prompt=prompt,
                    system_instruction=system_instruction,
                )
            except Exception as exc:
                if attempt == 2:
                    raise
                wait = 2 ** attempt
                print(f"[ai] Attempt {attempt + 1} failed ({exc}), retrying in {wait}s…")
                time.sleep(wait)

        return ""

    def complete(self, prompt: str, max_tokens: int = 200) -> str:
        return self._call([{"role": "user", "content": prompt}], max_tokens=max_tokens)

    def _parse_json(self, raw: str) -> Any:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1]
            raw = raw.rsplit("```", 1)[0]
        return json.loads(raw)

    # ── Summary generation ────────────────────────────────────────────────────

    def generate_summary(
        self,
        topic_name: str,
        excerpts: str,
        depth: str,
        learner_type: str = "general",
        lang: str = "en",
    ) -> dict:
        depth_desc = {
            "quick": "1–3 sentences covering only the core idea",
            "structured": (
                "exactly 3 or more sections. Required sections: "
                "(1) 'Key Concepts' — core terms and definitions with keywords array populated, "
                "(2) 'How It Works' — mechanism or process with keywords array populated, "
                "(3) a practical application or example section with keywords array populated. "
                "Every section MUST have a non-empty keywords array with at least 2 terms."
            ),
            "detailed": "concept-by-concept with mechanisms, examples, and cross-references",
        }.get(depth, "structured")

        system = (
            f"You are an expert educational summariser. Only use information from the provided "
            f"document excerpts. Do not add external information. "
            f"The learner type is: {learner_type}. Depth level: {depth} ({depth_desc}). "
            f"Respond in language: {lang}. "
            f"Return a JSON object with this exact schema: "
            f'{{ "headline": "...", "sections": [{{ "title": "...", "content": "...", "keywords": ["..."] }}] }}'
        )
        user = f'Here are the document excerpts for the topic "{topic_name}":\n\n{excerpts}\n\nGenerate a {depth} summary.'

        raw = self._call(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=1800,
            json_mode=True,
        )
        try:
            return self._parse_json(raw)
        except Exception:
            return {"headline": topic_name, "sections": [{"title": "Summary", "content": raw, "keywords": []}]}

    # ── Quiz generation ───────────────────────────────────────────────────────

    def generate_quiz(
        self,
        topic_name: str,
        excerpts: str,
        count: int,
        types: list[str],
        difficulty: str,
        lang: str = "en",
        previous_questions: list[str] | None = None,
    ) -> list[dict]:
        type_desc = ", ".join(types)
        dedup_note = ""
        if previous_questions:
            dedup_note = (
                f"\nDo not generate questions similar to these previous ones:\n"
                + "\n".join(f"- {q}" for q in previous_questions[:20])
            )

        system = (
            f"Generate exactly {count} quiz questions of type(s) [{type_desc}] at difficulty "
            f"'{difficulty}' about the topic \"{topic_name}\" using ONLY the following document "
            f"excerpts. Each question must be answerable from the excerpts. "
            f"Respond in language: {lang}. "
            f"Return a JSON array of objects with this schema: "
            f'[{{ "type": "mcq|tf|ow|os|match", "question": "...", "options": ["A...","B...","C...","D..."], '
            f'"correct_answer": "...", "explanation": "...", "source_chunk_id": 0 }}]\n'
            f"For 'match' type use: {{ \"pairs\": [[\"left\",\"right\"], ...] }} instead of options.\n"
            f"For 'tf' type options must be [\"True\", \"False\"].\n"
            f"For 'ow' and 'os' types omit options.{dedup_note}"
        )
        user = f"Document excerpts:\n\n{excerpts}"

        raw = self._call(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=3000,
            json_mode=True,
        )
        try:
            result = self._parse_json(raw)
            # Handle both array and {"questions": [...]} responses
            if isinstance(result, dict):
                result = result.get("questions", result.get("items", []))
            return result if isinstance(result, list) else []
        except Exception:
            return []

    # ── Quiz evaluation ───────────────────────────────────────────────────────

    def evaluate_open_answer(
        self, question: str, correct_answer: str, student_answer: str, excerpt: str
    ) -> dict:
        system = (
            "Evaluate this student answer against the correct answer and source text. "
            "Score 0–100. Return JSON: { \"score\": 0-100, \"is_correct\": true/false (score>=70), \"feedback\": \"...\" }"
        )
        user = (
            f"Question: {question}\n"
            f"Correct answer: {correct_answer}\n"
            f"Student answer: {student_answer}\n"
            f"Source: {excerpt}"
        )
        raw = self._call(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=300,
            json_mode=True,
        )
        try:
            return self._parse_json(raw)
        except Exception:
            # Fuzzy fallback
            import difflib
            ratio = difflib.SequenceMatcher(None, correct_answer.lower(), student_answer.lower()).ratio()
            score = int(ratio * 100)
            return {"score": score, "is_correct": score >= 70, "feedback": "Evaluated by similarity match."}

    # ── AI observation ────────────────────────────────────────────────────────

    def generate_observation(self, quiz_history: list[dict]) -> dict:
        history_str = json.dumps(quiz_history[-30:], indent=2)
        system = (
            "You are a learning coach. Analyse this learner quiz history and generate:\n"
            "1. One strength (topic they consistently score well on)\n"
            "2. One weakness (topic they consistently struggle with)\n"
            "3. One personalised observation (2–3 sentences, encouraging tone)\n"
            'Return JSON: { "strength": "...", "weakness": "...", "observation": "..." }'
        )
        raw = self._call(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Quiz history:\n{history_str}"},
            ],
            max_tokens=400,
            json_mode=True,
        )
        try:
            return self._parse_json(raw)
        except Exception:
            return {"strength": "—", "weakness": "—", "observation": raw}

    # ── Roadmap generation ────────────────────────────────────────────────────

    def generate_roadmap(
        self, topics: list[str], depth: str, goal: str | None = None
    ) -> list[dict]:
        goal_note = f" The learner's stated goal is: {goal}." if goal else ""
        system = (
            f"You are an expert curriculum designer. Given a list of academic topics, "
            f"arrange them into a logical learning roadmap at depth level '{depth}'.{goal_note}\n"
            f"Return a JSON array of steps in order, each with: "
            f'{{ "topic": "...", "subtitle": "Why this comes here", "is_locked": false, '
            f'"external_resources": [{{"title": "...", "url": ""}}] }}\n'
            f"Mark is_locked: true for advanced steps that require prerequisites. "
            f"External resources only for 'expert' depth."
        )
        raw = self._call(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": f"Topics: {json.dumps(topics)}"},
            ],
            max_tokens=2000,
            json_mode=True,
        )
        try:
            result = self._parse_json(raw)
            if isinstance(result, dict):
                result = result.get("steps", result.get("roadmap", list(result.values())[0] if result else []))
            return result if isinstance(result, list) else []
        except Exception:
            # Fallback: sequential unlocked roadmap
            return [{"topic": t, "subtitle": "", "is_locked": False, "external_resources": []} for t in topics]

    # ── Question hash (for deduplication) ────────────────────────────────────

    @staticmethod
    def question_hash(topic_id: str, question_text: str) -> str:
        return hashlib.sha256(f"{topic_id}:{question_text}".encode()).hexdigest()

    # ── Visualization: concept map diagram ───────────────────────────────────

    def generate_diagram(self, topic_name: str, excerpts: str) -> dict:
        """Generate a concept map (nodes + edges) for a topic from PDF excerpts.
        Returns: {nodes: [{id, label, type}], edges: [{from, to, label}]}
        """
        system = (
            f"You are an expert educational diagram designer. "
            f"Given document excerpts about '{topic_name}', create a concept map. "
            f"Return a JSON object with exactly this schema: "
            f'{{ "nodes": [{{"id": "n1", "label": "...", "type": "core|concept|example"}}], '
            f'"edges": [{{"from": "n1", "to": "n2", "label": "..."}}] }}. '
            f"Constraints: maximum 12 nodes, maximum 18 edges. "
            f"Node types: 'core' for the central topic, 'concept' for key ideas, 'example' for instances. "
            f"Use only information from the excerpts. Do not fabricate connections."
        )
        user = f"Document excerpts for '{topic_name}':\n\n{excerpts}"
        raw = self._call(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=1500,
            json_mode=True,
        )
        try:
            result = self._parse_json(raw)
            nodes = result.get("nodes", [])[:12]
            edges = result.get("edges", [])[:18]
            return {"nodes": nodes, "edges": edges}
        except Exception:
            return {"nodes": [], "edges": []}

    # ── Visualization: image annotations ─────────────────────────────────────

    def generate_image_annotations(
        self, topic_name: str, image_description: str, excerpts: str
    ) -> list[dict]:
        """Generate annotation labels for an extracted PDF image.
        Returns: [{label, x, y, description}] where x,y are 0.0-1.0 relative coordinates.
        """
        system = (
            f"You are an expert educational annotator. "
            f"Given a description of a diagram/image from a PDF about '{topic_name}', "
            f"generate annotation labels for the key elements visible. "
            f"Return a JSON array: "
            f'[{{"label": "...", "x": 0.5, "y": 0.3, "description": "..."}}]. '
            f"x and y are relative coordinates (0.0 = left/top, 1.0 = right/bottom). "
            f"Maximum 8 annotations. Use only information from the excerpts and image description."
        )
        user = (
            f"Image description: {image_description}\n\n"
            f"Document excerpts:\n{excerpts[:1500]}"
        )
        raw = self._call(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=800,
            json_mode=True,
        )
        try:
            result = self._parse_json(raw)
            if isinstance(result, dict):
                result = result.get("annotations", list(result.values())[0] if result else [])
            return result[:8] if isinstance(result, list) else []
        except Exception:
            return []


ai_service = AIService()
