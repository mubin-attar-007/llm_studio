# Architecture

GLM Studio is a single-user, local-first chat app. The backend is a **layered FastAPI
package** (`app/`); the frontend is vanilla HTML/CSS/JS served by the same process. The
same OpenAI-compatible client talks to **cloud** (Cloudflare Workers AI) or **local**
(Ollama) models — chosen per request from the model picker.

## Layers

Requests flow top-down; each layer depends only on the ones below it.

```
Browser (templates/ + static/)
        │  HTTP / SSE
        ▼
app/api/         ── HTTP layer: routing, request parsing, SSE framing
        │            routes.py · streaming.py · dependencies.py
        ▼
app/services/    ── Business logic: orchestration, retries, no FastAPI/HTTP details
        │            chat_service.py · history_service.py · document_service.py
        ▼
app/llm/         ── Provider routing + IO            app/database/  ── Persistence
   client.py (cloud vs local)                           sqlite.py (engine/session)
   providers/ (glm · ollama · openai)                   models.py  (ORM tables)
   prompts/ · document_loader · tokenizer               repository.py (queries)
        ▼                                                    ▼
app/core/  ── config (pydantic-settings) · logging · constants · exceptions
app/schemas/ ── Pydantic request/response models       app/utils/ ── pure helpers
```

**Dependency rule:** `api → services → {llm, database} → core`. `core`, `schemas`, and
`utils` are leaf modules (no inward imports), which keeps the graph acyclic and the units
independently testable.

## Request lifecycle — a chat message

1. **`POST /api/chat`** hits [app/api/routes.py](../app/api/routes.py). FastAPI validates the
   body against `ChatRequest` ([app/schemas/chat.py](../app/schemas/chat.py)) — bad roles,
   out-of-range temperature, or missing messages are rejected with `422` before any logic runs.
2. The route calls `chat_service.stream_chat(...)`
   ([app/services/chat_service.py](../app/services/chat_service.py)), a **generator** that
   yields event dicts.
3. `chat_service` asks `llm.client_for(model)` ([app/llm/client.py](../app/llm/client.py)) for
   an OpenAI client pointed at the right base URL (Cloudflare for cloud models, `localhost:11434`
   for local Ollama models) and whether the model needs `thinking` disabled.
4. It streams the completion, yielding `{"thinking": …}`, `{"token": …}`, then `{"done": true}`.
   It **retries once** on an empty/dropped response and backs off up to 3× on transient errors
   (`is_transient`), and maps known failures to friendly messages (no-text, needs-credit, interrupted).
5. [app/api/streaming.py](../app/api/streaming.py) wraps those dicts as SSE frames
   (`data: {json}\n\n`) in a `StreamingResponse`. The browser renders tokens live.

## Provider routing

One OpenAI-compatible client library serves every backend — only the **base URL + key + model
name** change:

| Kind | Base URL | Key source | Notes |
|---|---|---|---|
| ☁️ cloud | Cloudflare Workers AI gateway | `.env` / keyring | 24 free models; default `llama-3.3-70b` |
| 🔒 local | `http://localhost:11434/v1` (Ollama) | none | private + offline; models discovered via `/api/tags` |

`client_for(model)` decides by matching the model id against the locally-installed Ollama tags;
anything else routes to cloud. `list_models()` merges the configured cloud list with the live
local list and tags each `cloud`/`local` for the picker. **Reasoning models** (GLM, QwQ,
DeepSeek-R1, Qwen3) emit a hidden "thinking" stream — surfaced separately so the UI can show it
collapsed.

## Persistence

History lives in the **browser's localStorage** (offline-first, instant). The app also
best-effort syncs chats to SQLite via `POST /api/chats` so they survive a cache clear.
[app/database/repository.py](../app/database/repository.py) does an upsert (`session.merge`);
the DB file is `data/runtime/glm_studio.db` (override with `GLM_DB_PATH`).

## Why this shape

It mirrors **Open WebUI** (FastAPI + SQLite + a JS frontend), the gold-standard local AI chat
app. The layering keeps the streaming/retry logic out of the HTTP handlers, lets each provider
be added in one small file under `llm/providers/`, and makes the suite fast — API tests use a
`TestClient`, service/LLM/db tests import their module directly with no server.
