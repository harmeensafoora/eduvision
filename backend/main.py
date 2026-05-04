"""
EduVision FastAPI application entry point.

Starts with: python start.py   (or: uvicorn backend.main:app --reload)
Swagger UI:  http://localhost:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.database import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_tables()
    print(f"[main] EduVision backend ready")
    print(f"[main] Storage: {'Local filesystem' if settings.USE_LOCAL_STORAGE else 'Azure Blob'}")
    print(f"[main] Database: {'SQLite' if settings.USE_SQLITE else 'PostgreSQL'}")
    print(f"[main] Translation: {'Azure Translator' if settings.USE_TRANSLATION else 'Disabled (passthrough)'}")
    print(f"[main] AI: {'Ready' if settings.ai_ready else 'NOT CONFIGURED — set GEMINI_API_KEY'}")
    yield
    # Shutdown (nothing to clean up)


app = FastAPI(
    title="EduVision API",
    description="AI-powered adaptive learning platform backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Use allow_origins=["*"] so that every origin is accepted — including the
# literal "null" origin that browsers send for file:// URLs.
# allow_credentials must be False when allow_origins=["*"] (CORS spec
# forbids the combination); this is fine because our auth uses the
# Authorization header, not cookies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files (local PDF storage) ─────────────────────────────────────────
app.mount(
    "/static/uploads",
    StaticFiles(directory=str(settings.LOCAL_UPLOAD_DIR)),
    name="uploads",
)

# ── Routers ───────────────────────────────────────────────────────────────────
from backend.routers import auth, session, summary, quiz, roadmap, badge, dashboard, user
from backend.routers.visualization import router as visualization_router

app.include_router(auth.router, prefix="/api")
app.include_router(session.router, prefix="/api")
app.include_router(summary.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(roadmap.router, prefix="/api")
app.include_router(badge.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(visualization_router, prefix="/api")

# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
    )


@app.get("/", include_in_schema=False)
def root():
    return {
        "service": "EduVision API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "ok",
    }


@app.get("/health", include_in_schema=False)
def health():
    return {
        "status": "ok",
        "ai_ready": settings.ai_ready,
        "db": "sqlite" if settings.USE_SQLITE else "postgresql",
        "storage": "local" if settings.USE_LOCAL_STORAGE else "azure",
        "translation": settings.USE_TRANSLATION,
    }
