"""FastAPI dependencies — settings, auth, and rate limiting."""
from collections.abc import Callable

from fastapi import HTTPException, Request, status

from app.core import ratelimit
from app.core.config import Settings, settings
from app.database import repository


def get_settings() -> Settings:
    return settings


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(bucket: str, limit: int, window_s: float) -> Callable:
    """Build a dependency that limits `limit` requests per `window_s` per client IP."""
    def dep(request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        key = f"{bucket}:{_client_ip(request)}"
        if not ratelimit.allow(key, limit, window_s):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                                detail="Too many requests. Please slow down and try again.")
    return dep


def get_current_user(request: Request) -> dict | None:
    """Return the signed-in user dict from the session cookie, or None."""
    token = request.cookies.get(settings.COOKIE_NAME)
    return repository.get_session_user(token)


def require_user(request: Request) -> dict:
    """Like get_current_user but raises 401 when not authenticated."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return user
