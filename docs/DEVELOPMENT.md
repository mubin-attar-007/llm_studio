# Development guide

## Setup

```bat
:: from the project root
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
```

Copy `.env.example` → `.env` and fill in a provider (or run local-only with Ollama). Then:

```bat
.venv\Scripts\python.exe -m app.main      :: http://127.0.0.1:5000  (docs at /docs)
```

## Layout at a glance

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture. The dependency rule is
`api → services → {llm, database} → core`; `schemas`, `core`, and `utils` import nothing inward.

| You want to… | Edit |
|---|---|
| Add/change an endpoint | `app/api/routes.py` (+ a schema in `app/schemas/`) |
| Change streaming/retry/title logic | `app/services/chat_service.py` |
| Add a model provider | `app/llm/providers/<name>.py` + wire into `app/llm/client.py` |
| Change cloud model list / defaults | `.env` (`LLM_MODELS`, `LLM_MODEL`) or `app/core/config.py` defaults |
| Change DB schema | `app/database/models.py` + `repository.py` |
| Frontend | `app/templates/index.html`, `app/static/js/app.js`, `app/static/css/styles.css` |

## Tests

```bat
.venv\Scripts\python.exe -m pytest          :: all
.venv\Scripts\python.exe -m pytest tests/api
```

- `tests/conftest.py` sets a throwaway `GLM_DB_PATH` **before** importing `app`, then exposes a
  `client` fixture (FastAPI `TestClient`). Import `app` only after that — hence the `# noqa: E402`.
- `tests/api/` — HTTP behavior via `TestClient` (validation, routes, chats roundtrip). No live LLM.
- `tests/llm/` — provider routing (`client_for`, `is_transient`, `list_models`) + document loading.
- `tests/database/` — repository upsert/list/delete roundtrip.
- `tests/services/`, `tests/fixtures/` — placeholders (`.gitkeep`) for future tests/sample files.

`pyproject.toml` sets `pythonpath = ["."]` so `from app.main import app` resolves from the repo root.

Tests must stay **offline-safe** — never assert on a live model reply (cloud quota / network).
Assert on validation, routing, and shapes instead.

## Lint

```bat
.venv\Scripts\python.exe -m ruff check .          :: lint
.venv\Scripts\python.exe -m ruff check . --fix    :: autofix imports/format nits
```

Ruff config is in `pyproject.toml` (rules `E,F,W,I`; line-length 120; `archive/` excluded). CI
runs ruff + pytest + `pip-audit` on every push — see `.github/workflows/ci.yml`. Dependabot keeps
deps current.

## Adding a provider (example)

1. Create `app/llm/providers/foo.py` with a small helper (e.g. `is_foo_base(url)`, any
   request tweaks). Mirror `providers/ollama.py` / `providers/glm.py`.
2. In `app/llm/client.py`, route to it inside `client_for(model)` and include its models in
   `list_models()`.
3. Add a config block to `.env.example`.
4. Add a routing unit test in `tests/llm/test_client.py` (offline — assert base URL / flags only).

## Conventions

- Keep HTTP concerns in `api/`, logic in `services/`. A service function returns data or yields
  events — it never touches `Request`/`Response`.
- Surface user-facing error strings from `app/core/constants.py` (don't hardcode in routes).
- Prefer small pure helpers in `app/utils/` so they're trivially testable.
- Run `ruff check .` and `pytest` before committing.
