import os
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

ENV_FILE = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_FILE)

MODEL_NAME = os.getenv(
    "GEMINI_MODEL",
    "gemini-flash-lite-latest"
)

keys = [
    ("KEY_1", os.getenv("GEMINI_API_KEY_1", "")),
    ("KEY_2", os.getenv("GEMINI_API_KEY_2", "")),
]

for name, key in keys:
    if not key:
        print(f"[{name}] Missing")
        continue

    try:
        print(f"\n--- Testing {name} ---")

        genai.configure(api_key=key)

        model = genai.GenerativeModel(MODEL_NAME)

        response = model.generate_content(
            "Reply with only: Hello from Gemini"
        )

        print(f"[{name}] SUCCESS")
        print(response.text)

    except Exception as exc:
        print(f"[{name}] FAILED")
        print(exc)