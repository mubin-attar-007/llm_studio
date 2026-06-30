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
    def uploads_dir(self) -> str:
        d = os.path.join(self.data_dir, "uploads")
        os.makedirs(d, exist_ok=True)
        return d


settings = Settings()
