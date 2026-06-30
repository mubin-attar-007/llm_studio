# Archived — not needed for normal use

For everyday use you run LLM Studio from `scripts\run.bat` (cloud + local) or
`scripts\run_local.bat` (local-only), which opens it in your browser. **None of the files
here are required for that.** They're kept in case you want them later, grouped by topic:

```
archive/
  desktop/   Native desktop window + one-click .exe + keyring helper
  docker/    Containerized run
  legacy/    Old/superseded files kept for reference
```

## `desktop/` — native window & `.exe`

| File | What it is | To use it again |
|---|---|---|
| `desktop.py` | Native desktop-window wrapper (pywebview) | run from the **project root**: `.venv\Scripts\python.exe archive\desktop\desktop.py` |
| `build_desktop.py` | Builds a one-click `LLM Studio.exe` (PyInstaller) | from the **project root**: `.venv\Scripts\python.exe archive\desktop\build_desktop.py` → `dist\LLM Studio.exe` |
| `make_desktop.bat` | One-click `.exe` build launcher | double-click (it builds via `build_desktop.py`) |
| `set_key.py` | Store the API key in Windows Credential Manager (keyring) | `.venv\Scripts\python.exe archive\desktop\set_key.py` |

> These import the `app` package (`from app.main import app`), so run them with the **project
> root as the working directory** — the `app/` package and `.venv` must be alongside.
> The `.exe` bundles `app/templates` + `app/static`; copy your `.env` next to the built `.exe`.

## `docker/` — container

| File | What it is |
|---|---|
| `Dockerfile` | Image build — entrypoint `uvicorn app.main:app` |
| `docker-compose.yml` | One-command run with env passthrough |
| `.dockerignore` | Build-context excludes |

To run: copy all three to the **project root**, then `docker compose up --build` → <http://localhost:5000>.
See [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md) for details.

## `legacy/`

Superseded files kept only for reference. Safe to ignore.
