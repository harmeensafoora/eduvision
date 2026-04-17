from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import settings

connect_args = {"check_same_thread": False} if settings.USE_SQLITE else {}

engine = create_engine(
    settings.db_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Called on application startup to create all tables."""
    # Import all models so Base knows about them before create_all
    from backend.models import (  # noqa: F401
        user, session_model, pdf_model, topic,
        summary, quiz, badge, roadmap, learner_profile
    )
    Base.metadata.create_all(bind=engine)
    print(f"[db] Tables ready — {'SQLite' if settings.USE_SQLITE else 'PostgreSQL'}")
