"""
backend/app/database/db.py

SQLAlchemy database engine and session management.

Uses standard SQLite engine for reliable, high-performance local database access
without threadpool deadlocks on Windows.
"""

from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Normalise URL: if configured with sqlite+aiosqlite, convert to sqlite:///
_db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")

engine = create_engine(
    _db_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False} if "sqlite" in _db_url else {},
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

class Base(DeclarativeBase):
    pass

def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a thread-safe database session.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def create_all_tables() -> None:
    """
    Creates all tables defined in ORM models.
    """
    import app.database.models  # ensure models are registered
    Base.metadata.create_all(bind=engine)
