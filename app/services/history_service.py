"""Chat-history service (wraps the repository, always per-user)."""
from app.database import repository


def all_chats(owner_id: str):
    return repository.list_chats(owner_id)


def save_chats(owner_id: str, chats) -> int:
    repository.upsert_chats(owner_id, chats)
    return len(chats)


def remove_chat(owner_id: str, cid):
    repository.delete_chat(owner_id, cid)
