import os

import google.generativeai as genai
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_FILE)

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest"))

response = model.generate_content("Say hello")
print(response.text)