"""Chat persistence (data access)."""
import json

from app.database.models import Chat
from app.database.sqlite import SessionLocal


def list_chats():
    with SessionLocal() as s:
        rows = s.query(Chat).order_by(Chat.updated.desc()).all()
        return [{"id": r.id, "title": r.title, "messages": json.loads(r.messages or "[]"),
                 "created": r.created, "updated": r.updated, "titled": bool(r.titled)} for r in rows]


def upsert_chats(chats):
    with SessionLocal() as s:
        for c in chats:
            if not c.get("id"):
                continue
            s.merge(Chat(
                id=str(c["id"]),
                title=c.get("title", "New chat"),
                messages=json.dumps(c.get("messages", [])),
                created=int(c.get("created") or 0),
                updated=int(c.get("updated") or 0),
                titled=1 if c.get("titled") else 0,
            ))
        s.commit()


def delete_chat(cid):
    with SessionLocal() as s:
        row = s.get(Chat, str(cid))
        if row:
            s.delete(row)
            s.commit()
