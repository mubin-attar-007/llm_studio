"""Logging setup."""
import logging

from app.core.config import settings

log = logging.getLogger("llmstudio")


def setup_logging():
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
    return log
