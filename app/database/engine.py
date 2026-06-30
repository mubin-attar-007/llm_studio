"""Database engine + session factory.

Uses Postgres when ``DATABASE_URL`` is set (production), otherwise a local
SQLite file (development and tests). Same SQLAlchemy 2.0 sync API either way.
"""
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import settings

_url = settings.database_url
_is_sqlite = _url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}
_engine_kwargs: dict = {} if _is_sqlite else {"pool_pre_ping": True, "pool_recycle": 1800}

engine = create_engine(_url, connect_args=_connect_args, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()


def init_db() -> None:
    from app.database import models  # noqa: F401  (registers models on Base)
    Base.metadata.create_all(engine)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
