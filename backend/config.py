import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

ENV_FILE = Path(__file__).parent / ".env"


def _auto_secret(var_name: str) -> str:
    """Return env var value, auto-generating and persisting it if missing."""
    val = os.getenv(var_name)
    if val:
        return val
    val = secrets.token_hex(32)
    # Append to .env so it persists across restarts
    with open(ENV_FILE, "a") as f:
        f.write(f"\n{var_name}={val}\n")
    os.environ[var_name] = val
    print(f"[config] Auto-generated {var_name} and saved to .env")
    return val


class Settings:
    # Azure OpenAI — required for AI features
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_DEPLOYMENT: str = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
    AZURE_OPENAI_API_VERSION: str = os.getenv(
        "AZURE_OPENAI_API_VERSION", "2024-12-01-preview"
    )

    # Database — SQLite fallback
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    USE_SQLITE: bool = not bool(os.getenv("DATABASE_URL", ""))

    # Storage — local filesystem fallback
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv(
        "AZURE_STORAGE_CONNECTION_STRING", ""
    )
    AZURE_STORAGE_CONTAINER: str = os.getenv(
        "AZURE_STORAGE_CONTAINER", "eduvision-pdfs"
    )
    USE_LOCAL_STORAGE: bool = not bool(os.getenv("AZURE_STORAGE_CONNECTION_STRING", ""))
    LOCAL_UPLOAD_DIR: Path = Path(__file__).parent / "uploads"

    # Translation — disabled if no key
    AZURE_TRANSLATOR_KEY: str = os.getenv("AZURE_TRANSLATOR_KEY", "")
    AZURE_TRANSLATOR_ENDPOINT: str = os.getenv(
        "AZURE_TRANSLATOR_ENDPOINT", "https://api.cognitive.microsofttranslator.com"
    )
    USE_TRANSLATION: bool = bool(os.getenv("AZURE_TRANSLATOR_KEY", ""))

    # Google OAuth — optional (dev-login works without)
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback"
    )

    # JWT — auto-generated if absent
    JWT_SECRET: str = _auto_secret("JWT_SECRET")
    JWT_REFRESH_SECRET: str = _auto_secret("JWT_REFRESH_SECRET")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Dev authentication — must be explicitly enabled
    ENABLE_DEV_LOGIN: bool = os.getenv("ENABLE_DEV_LOGIN", "").lower() in (
        "true",
        "1",
        "yes",
    )

    # CORS
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    @property
    def db_url(self) -> str:
        if self.USE_SQLITE:
            db_path = Path(__file__).parent / "eduvision.db"
            return f"sqlite:///{db_path}"
        return self.DATABASE_URL

    @property
    def ai_ready(self) -> bool:
        return bool(self.AZURE_OPENAI_ENDPOINT and self.AZURE_OPENAI_API_KEY)


settings = Settings()

# Ensure upload dir exists
settings.LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
