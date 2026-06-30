"""Authentication routes — register, login, logout, me."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.security import hash_password, new_id, new_token, now_ms, verify_password
from app.database import repository
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services import quota_service

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"],
            "display_name": u.get("display_name", ""), "role": u.get("role", "user")}


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.COOKIE_NAME, value=token, httponly=True,
        secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE,
        max_age=settings.SESSION_TTL_DAYS * 86400, path="/",
    )


def _issue_session(response: Response, user_id: str) -> None:
    token = new_token()
    expires = now_ms() + settings.SESSION_TTL_DAYS * 86400 * 1000
    repository.create_session(token, user_id, expires)
    _set_session_cookie(response, token)


@auth_router.post("/register", status_code=201)
def register(req: RegisterRequest, response: Response):
    if not settings.ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    if repository.get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    uid = new_id()
    # the very first account becomes the admin (unlimited quota)
    role = "admin" if repository.count_users() == 0 else "user"
    repository.create_user(uid, req.email, hash_password(req.password), req.display_name.strip(), role)
    _issue_session(response, uid)
    user = repository.get_user_by_id(uid)
    return {**_public_user(user), "quota": quota_service.quota_status(user)}


@auth_router.post("/login")
def login(req: LoginRequest, response: Response):
    user = repository.get_user_by_email(req.email)
    if not user or not verify_password(user["password_hash"], req.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is disabled")
    _issue_session(response, user["id"])
    return {**_public_user(user), "quota": quota_service.quota_status(user)}


@auth_router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(settings.COOKIE_NAME)
    if token:
        repository.delete_session(token)
    response.delete_cookie(settings.COOKIE_NAME, path="/")
    return {"ok": True}


@auth_router.get("/me")
def me(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {**_public_user(user), "quota": quota_service.quota_status(user)}
