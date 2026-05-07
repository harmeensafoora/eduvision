"""Test Gemini failover between two keys/projects.

What it does:
- sends 7 requests in a row
- with GEMINI_RPM_1=6, the first 6 should use key 1/project 1
- the 7th should automatically use key 2/project 2

Place this file at the project root, or run it from anywhere as long as
Python can import backend.services.gemini_router.

Required .env example:
    GEMINI_API_KEY_1=...
    GEMINI_API_KEY_2=...
    GEMINI_MODEL=gemini-2.5-flash-lite
    GEMINI_RPM_1=6
    GEMINI_RPM_2=6
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root if this file is placed somewhere inside the repo.
ENV_FILE = Path(__file__).resolve().parent / ".env"
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE)
else:
    load_dotenv()

from services.gemini_router import GeminiRouter  # noqa: E402


def main() -> None:
    router = GeminiRouter.from_env()

    if len(router._projects) < 2:  # noqa: SLF001
        raise RuntimeError("Need at least 2 Gemini keys/projects in .env to test failover")

    print(f"Configured projects: {len(router._projects)}")  # noqa: SLF001

    for i in range(1, 8):
        print(f"\n--- Request {i} ---")
        try:
            text = router.generate_text(
                prompt=f"Reply with exactly: request {i}",
                system_instruction="Reply with a very short plain text answer.",
            )
            print(f"Result: {text.strip()}")
        except Exception as exc:
            print(f"Request {i} failed: {exc}")


if __name__ == "__main__":
    main()
