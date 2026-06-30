"""Misc helpers."""


def truncate(text: str, limit: int = 60) -> str:
    return (text or "").strip()[:limit]


def first_line(text: str) -> str:
    text = (text or "").strip()
    return text.splitlines()[0].strip() if text else ""
