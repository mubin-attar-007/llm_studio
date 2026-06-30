"""SQLite engine + session (chat-history backup)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(f"sqlite:///{settings.db_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


def init_db():
    from app.database import models  # noqa: F401  (registers models on Base)
    Base.metadata.create_all(engine)
