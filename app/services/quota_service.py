"""Per-user daily message quota (the shared-key SaaS model).

Each signed-in user gets ``DAILY_MESSAGE_QUOTA`` messages per UTC day on the
server's shared LLM key. Admins (the first registered user) are unlimited.
"""
from datetime import datetime, timezone

from app.core.config import settings
from app.database import repository


def today_key() -> int:
    """Current UTC day as an integer YYYYMMDD (cheap to store/compare)."""
    d = datetime.now(timezone.utc)
    return d.year * 10000 + d.month * 100 + d.day


def is_unlimited(user: dict) -> bool:
    return (user.get("role") or "user") == "admin"


def quota_status(user: dict) -> dict:
    """Read-only quota snapshot for the UI (does not consume)."""
    if is_unlimited(user):
        return {"limit": None, "used": 0, "remaining": None, "unlimited": True}
    limit = settings.DAILY_MESSAGE_QUOTA
    used = repository.usage_today(user["id"], today_key())
    return {"limit": limit, "used": used, "remaining": max(0, limit - used), "unlimited": False}


def consume(user: dict) -> dict:
    """Consume one message. Returns the quota status with an ``allowed`` flag."""
    if is_unlimited(user):
        return {"allowed": True, "unlimited": True, "limit": None, "used": 0, "remaining": None}
    limit = settings.DAILY_MESSAGE_QUOTA
    day = today_key()
    used = repository.usage_today(user["id"], day)
    if used >= limit:
        return {"allowed": False, "unlimited": False, "limit": limit, "used": used, "remaining": 0}
    new_used = repository.usage_increment(user["id"], day)
    return {"allowed": True, "unlimited": False, "limit": limit,
            "used": new_used, "remaining": max(0, limit - new_used)}
