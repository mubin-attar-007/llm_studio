"""App configuration via pydantic-settings (reads .env + OS env)."""
import os
import sys

from pydantic_settings import BaseSettings, SettingsConfigDict

_PKG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # .../app
ROOT = os.path.dirname(_PKG)                                          # repo root
_ENV = (os.path.join(os.path.dirname(sys.executable), ".env")
        if getattr(sys, "frozen", False) else os.path.join(ROOT, ".env"))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV, env_file_encoding="utf-8", extra="ignore", case_sensitive=False)

    # server
    HOST: str = "127.0.0.1"
    PORT: int = 5000
    LOG_LEVEL: str = "info"
    MAX_TOKENS: int = 4096

    # app / environment
    APP_ENV: str = "development"          # "development" | "production"
    APP_NAME: str = "GLM Studio"

    # database — Postgres in production (DATABASE_URL), SQLite locally / in tests
    DATABASE_URL: str = ""

    # auth / sessions
    SESSION_TTL_DAYS: int = 30
    COOKIE_NAME: str = "session"
    COOKIE_SECURE: bool = False           # set True in production (HTTPS)
    COOKIE_SAMESITE: str = "lax"
    ALLOW_REGISTRATION: bool = True

    # per-user daily message quota (shared-key SaaS model)
    DAILY_MESSAGE_QUOTA: int = 25

    # uploads / document context
    MAX_UPLOAD_MB: int = 10
    MAX_DOC_CHARS: int = 200_000

    # abuse protection (in-memory rate limiting; disable in tests)
    RATE_LIMIT_ENABLED: bool = True

    # observability (optional)
    SENTRY_DSN: str = ""

    # LLM provider (cloud)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.z.ai/api/paas/v4"
    LLM_MODEL: str = "glm-4.7-flash"
    LLM_MODELS: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434/v1"

    # backward-compatible aliases
    ZAI_API_KEY: str = ""
    GLM_MODEL: str = ""
    DB_PATH: str = ""

    @property
    def data_dir(self) -> str:
        return os.path.join(ROOT, "data")

    @property
    def db_path(self) -> str:
        p = os.getenv("GLM_DB_PATH") or self.DB_PATH
        if p:
            return p
        d = os.path.join(self.data_dir, "runtime")
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, "glm_studio.db")

    @property
    def database_url(self) -> str:
        """SQLAlchemy URL — Postgres when configured, else a local SQLite file."""
        raw = (self.DATABASE_URL or "").strip()
        if raw:
            if raw.startswith("postgres://"):
                raw = "postgresql+psycopg://" + raw[len("postgres://"):]
            elif raw.startswith("postgresql://") and "+psycopg" not in raw:
                raw = "postgresql+psycopg://" + raw[len("postgresql://"):]
            return raw
        return f"sqlite:///{self.db_path}"

    @property
    def uploads_dir(self) -> str:
        d = os.path.join(self.data_dir, "uploads")
        os.makedirs(d, exist_ok=True)
        return d

    @property
    def is_prod(self) -> bool:
        return self.APP_ENV.strip().lower() in ("prod", "production")


settings = Settings()
