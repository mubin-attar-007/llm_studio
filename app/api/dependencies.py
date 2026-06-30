"""FastAPI dependencies — settings + auth."""
from fastapi import HTTPException, Request, status

from app.core.config import Settings, settings
from app.database import repository


def get_settings() -> Settings:
    return settings


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
