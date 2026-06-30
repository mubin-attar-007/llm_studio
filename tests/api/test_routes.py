"""API route tests — no live LLM calls (CI-safe)."""


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_index_serves_html(anon_client):
    r = anon_client.get("/")
    assert r.status_code == 200
    assert "GLM Studio" in r.text


def test_models_shape(client):
    data = client.get("/api/models").json()
    assert "models" in data and "default" in data
    for m in data["models"]:
        assert "id" in m and m["kind"] in ("cloud", "local")


def test_openapi_docs(client):
    assert client.get("/openapi.json").status_code == 200


def test_favicon(client):
    assert client.get("/favicon.ico").status_code == 204


def test_chat_rejects_bad_role(client):
    r = client.post("/api/chat", json={"messages": [{"role": "spam", "content": "x"}]})
    assert r.status_code == 422


def test_chat_requires_messages(client):
    assert client.post("/api/chat", json={}).status_code == 422


def test_chat_rejects_out_of_range_temperature(client):
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}], "temperature": 9})
    assert r.status_code == 422


def test_chats_api_roundtrip(client):
    chat = {"id": "ctest_api", "title": "Test", "messages": [{"role": "user", "content": "hi"}],
            "created": 1, "updated": 2, "titled": False}
    assert client.post("/api/chats", json=[chat]).status_code == 200
    got = client.get("/api/chats").json()["chats"]
    assert any(c["id"] == "ctest_api" for c in got)
    assert client.delete("/api/chats/ctest_api").status_code == 200


# ---- auth / access control ----
def test_api_requires_auth(anon_client):
    assert anon_client.get("/api/chats").status_code == 401
    assert anon_client.get("/api/models").status_code == 401
    assert anon_client.post("/api/chat", json={"messages": []}).status_code == 401


def test_me_requires_auth(anon_client):
    assert anon_client.get("/api/auth/me").status_code == 401


def test_register_login_me_flow(anon_client):
    email = "flow@example.com"
    r = anon_client.post("/api/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == email and "quota" in body
    me = anon_client.get("/api/auth/me")
    assert me.status_code == 200 and me.json()["email"] == email
    assert anon_client.post("/api/auth/logout").status_code == 200
    assert anon_client.get("/api/auth/me").status_code == 401


def test_register_rejects_duplicate_and_short_password(anon_client):
    anon_client.post("/api/auth/register", json={"email": "dupe@example.com", "password": "password123"})
    again = anon_client.post("/api/auth/register", json={"email": "dupe@example.com", "password": "password123"})
    assert again.status_code == 409
    short = anon_client.post("/api/auth/register", json={"email": "short@example.com", "password": "abc"})
    assert short.status_code == 422


def test_login_rejects_bad_password(anon_client):
    anon_client.post("/api/auth/register", json={"email": "lp@example.com", "password": "password123"})
    bad = anon_client.post("/api/auth/login", json={"email": "lp@example.com", "password": "wrongpass1"})
    assert bad.status_code == 401


def _authed_client(email):
    """A freshly-registered, authenticated client for a given email."""
    from fastapi.testclient import TestClient

    from app.main import app
    c = TestClient(app)
    c.post("/api/auth/register", json={"email": email, "password": "password123"})
    return c


def test_chats_are_isolated_per_user():
    a = _authed_client("iso_a@example.com")
    b = _authed_client("iso_b@example.com")
    a.post("/api/chats", json=[{"id": "iso_a_chat", "title": "A", "messages": [],
                                "created": 1, "updated": 1, "titled": False}])
    # B must not see A's chat
    b_ids = [c["id"] for c in b.get("/api/chats").json()["chats"]]
    assert "iso_a_chat" not in b_ids
