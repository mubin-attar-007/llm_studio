"""Authentication routes — register, login, logout, me."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.dependencies import get_current_user, rate_limit
from app.core.config import settings
from app.core.email import send_email
from app.core.security import hash_password, new_id, new_token, now_ms, verify_password
from app.database import repository
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
)
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


@auth_router.post("/register", status_code=201, dependencies=[Depends(rate_limit("auth", 15, 60))])
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


@auth_router.post("/login", dependencies=[Depends(rate_limit("auth", 15, 60))])
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


@auth_router.post("/change-password", dependencies=[Depends(rate_limit("auth", 15, 60))])
def change_password(req: ChangePasswordRequest, user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    full = repository.get_user_by_email(user["email"])
    if not full or not verify_password(full["password_hash"], req.current_password):
        raise HTTPException(status_code=400, detail="Your current password is incorrect")
    repository.update_user_password(user["id"], hash_password(req.new_password))
    return {"ok": True}


@auth_router.post("/delete", dependencies=[Depends(rate_limit("auth", 15, 60))])
def delete_account(
    req: DeleteAccountRequest, request: Request, response: Response,
    user=Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    full = repository.get_user_by_email(user["email"])
    if not full or not verify_password(full["password_hash"], req.password):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    repository.delete_user(user["id"])
    token = request.cookies.get(settings.COOKIE_NAME)
    if token:
        repository.delete_session(token)
    response.delete_cookie(settings.COOKIE_NAME, path="/")
    return {"ok": True}


@auth_router.post("/password-reset", dependencies=[Depends(rate_limit("auth", 10, 300))])
def password_reset(req: PasswordResetRequest, request: Request):
    """Start a reset. Always a generic 200 (no account enumeration); emails a link when real."""
    user = repository.get_user_by_email(req.email)
    if user and user["is_active"]:
        token = new_token()
        repository.create_reset_token(token, user["id"], now_ms() + 30 * 60 * 1000)
        base = str(request.base_url).rstrip("/")
        reset_url = f"{base}/?reset_token={token}"
        send_email(
            user["email"],
            "Reset your LLM Studio password",
            "Reset your LLM Studio password with this link (expires in 30 minutes):\n\n"
            f"{reset_url}\n\nIf you didn't request this, you can safely ignore this email.",
        )
    return {"ok": True}


@auth_router.post("/password-reset-confirm", dependencies=[Depends(rate_limit("auth", 10, 300))])
def password_reset_confirm(req: PasswordResetConfirm):
    user_id = repository.consume_reset_token(req.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired")
    repository.update_user_password(user_id, hash_password(req.new_password))
    return {"ok": True}
