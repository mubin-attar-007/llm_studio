"""File helpers."""
import re

_SAFE = re.compile(r"[^A-Za-z0-9._-]")


def safe_filename(name: str) -> str:
    """Sanitize an uploaded filename to a safe basename."""
    return (_SAFE.sub("_", name or "upload")[:80]) or "upload"
