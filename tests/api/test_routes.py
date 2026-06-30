"""API route tests — no live LLM calls (CI-safe)."""


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_index_serves_html(client):
    r = client.get("/")
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
