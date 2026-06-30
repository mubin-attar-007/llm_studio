"""Repository tests — per-user chat scoping + usage quota."""
from app.database import repository


def test_repository_roundtrip():
    owner = "u_test_repo"
    chat = {"id": "ctest_repo", "title": "Repo test", "messages": [{"role": "user", "content": "x"}],
            "created": 10, "updated": 20, "titled": True}
    repository.upsert_chats(owner, [chat])
    rows = repository.list_chats(owner)
    assert any(r["id"] == "ctest_repo" and r["titled"] is True for r in rows)
    repository.delete_chat(owner, "ctest_repo")
    assert all(r["id"] != "ctest_repo" for r in repository.list_chats(owner))


def test_chats_scoped_by_owner():
    a, b = "owner_a", "owner_b"
    repository.upsert_chats(a, [{"id": "scoped_chat", "title": "A", "messages": [],
                                 "created": 1, "updated": 1, "titled": False}])
    assert all(r["id"] != "scoped_chat" for r in repository.list_chats(b))
    # B cannot clobber A's chat by reusing the id
    repository.upsert_chats(b, [{"id": "scoped_chat", "title": "HIJACK", "messages": [],
                                 "created": 2, "updated": 2, "titled": False}])
    a_rows = {r["id"]: r for r in repository.list_chats(a)}
    assert a_rows["scoped_chat"]["title"] == "A"
    repository.delete_chat(a, "scoped_chat")


def test_epoch_columns_are_64bit():
    """ms-epoch columns must be BigInteger — Postgres INT4 overflows at ~2.1e9."""
    from sqlalchemy import BigInteger

    from app.database.models import Chat, Session, User
    for col in (User.__table__.c.created, Session.__table__.c.expires,
                Session.__table__.c.created, Chat.__table__.c.created, Chat.__table__.c.updated):
        assert isinstance(col.type, BigInteger), f"{col} must be BigInteger"


def test_usage_increment():
    uid, day = "usage_user", 20260101
    start = repository.usage_today(uid, day)
    assert repository.usage_increment(uid, day) == start + 1
    assert repository.usage_increment(uid, day) == start + 2
    assert repository.usage_today(uid, day) == start + 2
