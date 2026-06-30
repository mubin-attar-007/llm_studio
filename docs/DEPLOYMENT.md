# Deployment & running

GLM Studio is designed to run **on one machine for one user**, bound to `127.0.0.1`. Pick the
launch method that fits; all of them serve the same app at <http://127.0.0.1:5000>.

## 1. Windows launchers (easiest)

Double-click from `scripts\`:

- **`scripts\run.bat`** — cloud + local models in one picker (default).
- **`scripts\run_local.bat`** — forces local Ollama only (fully offline). Sets `LLM_*` env
  vars to `llama3.2:3b` before starting.

Both `cd` to the project root and run `python -m app.main`. Keep the window open; close it to stop.

## 2. From a terminal

```bat
:: from the project root, with the venv created and deps installed
.venv\Scripts\python.exe -m app.main
```

`app.main:main()` starts Uvicorn and opens your browser. For a bare server (e.g. behind your
own process manager) skip the browser-open with:

```bat
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 5000
```

## 3. Docker (archived)

Files live in [../archive/docker/](../archive/docker/). Copy the three files to the project
root, then:

```bash
docker compose up --build      # → http://localhost:5000
```

The image entrypoint is `uvicorn app.main:app`; `/healthz` is the container healthcheck. Pass
provider config via env or a `.env` beside the compose file. To reach a host-side Ollama from
the container, the compose maps `OLLAMA_BASE_URL=http://host.docker.internal:11434/v1`.

## 4. Desktop `.exe` (archived)

[../archive/desktop/](../archive/desktop/) builds a native-window single file with PyInstaller +
pywebview. Build from the project root: `.venv\Scripts\python.exe archive\desktop\build_desktop.py`
→ `dist\GLM Studio.exe`. **Copy your `.env` next to the `.exe`** (a frozen build reads config
from the exe's folder).

## Configuration (`.env`)

Loaded by [app/core/config.py](../app/core/config.py) (`pydantic-settings`). Key vars:

| Var | Default | Purpose |
|---|---|---|
| `HOST` / `PORT` | `127.0.0.1` / `5000` | Bind address. Keep host local for single-user. |
| `LLM_API_KEY` | — | Cloud key (Cloudflare). May instead live in OS keyring (`set_key.py`). |
| `LLM_BASE_URL` | Cloudflare gateway | OpenAI-compatible base URL for cloud. |
| `LLM_MODEL` | `llama-3.3-70b…` | Default cloud model. |
| `LLM_MODELS` | 24-model list | Comma-separated cloud picker list. |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Local provider. |
| `MAX_TOKENS` | `2048` | Default reply cap. |
| `LOG_LEVEL` | `info` | Uvicorn/app log level. |
| `GLM_DB_PATH` | `data/runtime/glm_studio.db` | SQLite location (tests set a throwaway path). |

`.env.example` ships ready-to-paste blocks for **Cloudflare, Groq, Google Gemini, Z.ai,
Mistral, NVIDIA, Ollama** — the app is OpenAI-compatible, so switching provider is just
changing these four `LLM_*` values.

> **Secrets:** `.env` and `*.key` are git-ignored. Never commit keys. The keyring option
> (`archive/desktop/set_key.py`) stores the key encrypted in Windows Credential Manager so you
> can delete `LLM_API_KEY` from `.env` entirely.

## Data & state

- `data/runtime/` — SQLite DB (chat backups). Git-ignored; safe to delete to reset history.
- `data/uploads/` — transient extraction scratch (files are removed right after reading).
- Primary chat history is the **browser's localStorage**, not the server.

## Health & docs

- Liveness: `GET /healthz` → `{"ok": true, …}`.
- API docs: `/docs` (Swagger) and `/redoc`.
