"""Gemini routing helper for EduVision.

- reads multiple Gemini API keys from env
- tracks a small per-key RPM window in memory
- skips a key when its local limit is reached
- falls back to the next key on quota/rate-limit errors

Recommended .env format:
    GEMINI_API_KEY_1=...
    GEMINI_API_KEY_2=...
    GEMINI_MODEL=gemini-flash-lite-latest
    GEMINI_RPM_1=6
    GEMINI_RPM_2=6
"""

from __future__ import annotations

import os
import time
from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from typing import Any, Deque, Iterable, List, Optional

import google.generativeai as genai

# Gemini can surface rate/quota failures in different shapes depending on SDK
# version and transport. Keep the matcher broad on purpose.
RATE_LIMIT_HINTS = (
    "RESOURCE_EXHAUSTED",
    "429",
    "rate limit",
    "quota",
    "too many requests",
)


@dataclass
class GeminiProject:
    name: str
    api_key: str
    model: str
    rpm: int = 6
    request_timestamps: Deque[float] = field(default_factory=deque)
    disabled_until: float = 0.0

    def available(self) -> bool:
        now = time.time()

        while self.request_timestamps and now - self.request_timestamps[0] > 60:
            self.request_timestamps.popleft()

        if now < self.disabled_until:
            return False

        return len(self.request_timestamps) < self.rpm

    def reserve(self) -> None:
        self.request_timestamps.append(time.time())

    def backoff(self, seconds: int = 60) -> None:
        self.disabled_until = max(self.disabled_until, time.time() + seconds)


class GeminiRouter:
    """Pick the next available Gemini project and fail over on quota errors."""

    def __init__(self, projects: Iterable[GeminiProject]):
        self._projects: List[GeminiProject] = list(projects)
        self._lock = Lock()
        if not self._projects:
            raise ValueError("No Gemini projects configured")

    @classmethod
    def from_env(cls) -> "GeminiRouter":
        default_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
        default_rpm = int(os.getenv("GEMINI_RPM", "6"))

        projects: List[GeminiProject] = []

        # Preferred: numbered keys, e.g. GEMINI_API_KEY_1, GEMINI_API_KEY_2 ...
        for idx in range(1, 20):
            api_key = os.getenv(f"GEMINI_API_KEY_{idx}", "").strip()
            if not api_key:
                continue

            model = os.getenv(f"GEMINI_MODEL_{idx}", default_model).strip() or default_model
            rpm = int(os.getenv(f"GEMINI_RPM_{idx}", str(default_rpm)))

            projects.append(
                GeminiProject(
                    name=f"gemini_project_{idx}",
                    api_key=api_key,
                    model=model,
                    rpm=rpm,
                )
            )

        # Backward compatibility: single key support if numbered keys are absent.
        if not projects:
            single_key = os.getenv("GEMINI_API_KEY", "").strip()
            if single_key:
                projects.append(
                    GeminiProject(
                        name="gemini_project_1",
                        api_key=single_key,
                        model=default_model,
                        rpm=default_rpm,
                    )
                )

        return cls(projects)

    def _pick_project(self) -> GeminiProject:
        with self._lock:
            for project in self._projects:
                if project.available():
                    project.reserve()
                    return project

        raise RuntimeError("All Gemini projects are rate-limited locally")

    @staticmethod
    def _looks_rate_limited(exc: Exception) -> bool:
        text = f"{type(exc).__name__}: {exc}".lower()
        return any(hint.lower() in text for hint in RATE_LIMIT_HINTS)

    def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        generation_config: Optional[dict[str, Any]] = None,
        max_attempts: Optional[int] = None,
    ) -> str:
        """Generate text with automatic failover."""
        attempts = 0
        max_attempts = max_attempts or len(self._projects)
        last_error: Optional[Exception] = None

        while attempts < max_attempts:
            attempts += 1
            project = self._pick_project()

            try:
                print(f"[gemini] using {project.name} | model={project.model}")
                genai.configure(api_key=project.api_key)
                model = genai.GenerativeModel(
                    model_name=project.model,
                    system_instruction=system_instruction,
                )
                response = model.generate_content(
                    prompt,
                    generation_config=generation_config,
                )

                text = getattr(response, "text", None)
                if text:
                    return text
                return str(response)

            except Exception as exc:  # noqa: BLE001
                last_error = exc

                if self._looks_rate_limited(exc):
                    project.backoff(seconds=60)
                    print(f"[gemini] {project.name} hit quota/rate limit; backing off")
                    continue

                raise

        if last_error is not None:
            raise last_error
        raise RuntimeError("Gemini generation failed")


# Convenience singleton for simple use.
router = GeminiRouter.from_env()
