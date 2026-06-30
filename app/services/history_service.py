"""Chat-history service (wraps the repository)."""
from app.database import repository


def all_chats():
    return repository.list_chats()


def save_chats(chats) -> int:
    repository.upsert_chats(chats)
    return len(chats)


def remove_chat(cid):
    repository.delete_chat(cid)
