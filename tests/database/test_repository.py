"""SQLite repository tests."""
from app.database import repository


def test_repository_roundtrip():
    chat = {"id": "ctest_repo", "title": "Repo test", "messages": [{"role": "user", "content": "x"}],
            "created": 10, "updated": 20, "titled": True}
    repository.upsert_chats([chat])
    rows = repository.list_chats()
    assert any(r["id"] == "ctest_repo" and r["titled"] is True for r in rows)
    repository.delete_chat("ctest_repo")
    assert all(r["id"] != "ctest_repo" for r in repository.list_chats())
