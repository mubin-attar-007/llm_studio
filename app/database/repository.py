"""Data access — users, sessions, daily usage, and per-user chat history."""
import json

from app.core.security import now_ms
from app.database.engine import SessionLocal
from app.database.models import Chat, UsageDaily, User
from app.database.models import Session as SessionRow


# ---------- users ----------
def _user_dict(u: User) -> dict:
    return {"id": u.id, "email": u.email, "display_name": u.display_name or "",
            "role": u.role or "user", "is_active": bool(u.is_active), "created": u.created}


def create_user(uid: str, email: str, password_hash: str, display_name: str = "", role: str = "user") -> dict:
    with SessionLocal() as s:
        u = User(id=uid, email=email.lower().strip(), password_hash=password_hash,
                 display_name=display_name, role=role, is_active=1, created=now_ms())
        s.add(u)
        s.commit()
        return _user_dict(u)


def get_user_by_email(email: str) -> dict | None:
    with SessionLocal() as s:
        u = s.query(User).filter(User.email == email.lower().strip()).first()
        if not u:
            return None
        d = _user_dict(u)
        d["password_hash"] = u.password_hash   # only the email lookup exposes the hash (for login)
        return d


def get_user_by_id(uid: str) -> dict | None:
    with SessionLocal() as s:
        u = s.get(User, uid)
        return _user_dict(u) if u else None


def count_users() -> int:
    with SessionLocal() as s:
        return s.query(User).count()


# ---------- sessions ----------
def create_session(token: str, user_id: str, expires: int) -> None:
    with SessionLocal() as s:
        s.add(SessionRow(id=token, user_id=user_id, created=now_ms(), expires=expires, last_seen=now_ms()))
        s.commit()


def get_session_user(token: str | None) -> dict | None:
    """Return the user for a valid (unexpired, active) session, else None."""
    if not token:
        return None
    with SessionLocal() as s:
        row = s.get(SessionRow, token)
        if not row:
            return None
        if row.expires and row.expires < now_ms():
            s.delete(row)
            s.commit()
            return None
        u = s.get(User, row.user_id)
        if not u or not u.is_active:
            return None
        row.last_seen = now_ms()
        s.commit()
        return _user_dict(u)


def delete_session(token: str) -> None:
    with SessionLocal() as s:
        row = s.get(SessionRow, token)
        if row:
            s.delete(row)
            s.commit()


# ---------- usage / quota ----------
def usage_today(user_id: str, day: int) -> int:
    with SessionLocal() as s:
        row = s.get(UsageDaily, (user_id, day))
        return row.count if row else 0


def usage_increment(user_id: str, day: int) -> int:
    with SessionLocal() as s:
        row = s.get(UsageDaily, (user_id, day))
        if row:
            row.count += 1
        else:
            row = UsageDaily(user_id=user_id, day=day, count=1)
            s.add(row)
        s.commit()
        return row.count


# ---------- chats (always scoped to an owner) ----------
def list_chats(owner_id: str) -> list[dict]:
    with SessionLocal() as s:
        rows = (s.query(Chat).filter(Chat.owner_id == owner_id)
                .order_by(Chat.updated.desc()).all())
        return [{"id": r.id, "title": r.title, "messages": json.loads(r.messages or "[]"),
                 "created": r.created, "updated": r.updated, "titled": bool(r.titled)} for r in rows]


def upsert_chats(owner_id: str, chats) -> None:
    with SessionLocal() as s:
        for c in chats:
            cid = str(c.get("id") or "")
            if not cid:
                continue
            existing = s.get(Chat, cid)
            if existing is not None and existing.owner_id not in (None, owner_id):
                continue   # never touch another user's chat
            s.merge(Chat(
                id=cid,
                owner_id=owner_id,
                title=c.get("title", "New chat"),
                messages=json.dumps(c.get("messages", [])),
                created=int(c.get("created") or 0),
                updated=int(c.get("updated") or 0),
                titled=1 if c.get("titled") else 0,
            ))
        s.commit()


def delete_chat(owner_id: str, cid: str) -> None:
    with SessionLocal() as s:
        row = s.get(Chat, str(cid))
        if row and row.owner_id in (None, owner_id):
            s.delete(row)
            s.commit()
