import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

ENV_FILE = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_FILE)


def _auto_secret(var_name: str) -> str:
    val = os.getenv(var_name)
    if val:
        return val
    val = secrets.token_hex(32)
    with open(ENV_FILE, "a") as f:
        f.write(f"\n{var_name}={val}\n")
    os.environ[var_name] = val
    print(f"[config] Auto-generated {var_name} and saved to .env")
    return val


class Settings:
    # ✅ Gemini AI
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    USE_SQLITE: bool = not bool(DATABASE_URL)
    LOCAL_UPLOAD_DIR: Path = Path(__file__).parent / "uploads"

    # Storage (optional Azure)
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    AZURE_STORAGE_CONTAINER: str = os.getenv("AZURE_STORAGE_CONTAINER", "eduvision-pdfs")
    USE_LOCAL_STORAGE: bool = not bool(AZURE_STORAGE_CONNECTION_STRING)

    # Translation (optional)
    AZURE_TRANSLATOR_KEY: str = os.getenv("AZURE_TRANSLATOR_KEY", "")
    USE_TRANSLATION: bool = bool(AZURE_TRANSLATOR_KEY)

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/callback"
    )

    # JWT
    JWT_SECRET: str = _auto_secret("JWT_SECRET")
    JWT_REFRESH_SECRET: str = _auto_secret("JWT_REFRESH_SECRET")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Dev auth
    ENABLE_DEV_LOGIN: bool = os.getenv("ENABLE_DEV_LOGIN", "").lower() in ("true", "1", "yes")

    # CORS
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # Upload
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "50"))

    @property
    def db_url(self) -> str:
        if self.USE_SQLITE:
            db_path = Path(__file__).parent / "eduvision.db"
            return f"sqlite:///{db_path}"
        return self.DATABASE_URL

    @property
    def ai_ready(self) -> bool:
        return bool(self.GEMINI_API_KEY)


settings = Settings()
settings.LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)