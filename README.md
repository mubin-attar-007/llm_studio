# LLM Studio

A local, **ChatGPT-style** chat app with **two modes**:

- ☁️ **Cloud** (`scripts\run.bat`) — fast models on **Cloudflare's free** US cloud. **24 models** to pick from (Llama, OpenAI gpt-oss, Mistral, Gemma, GLM, Qwen, and more).
- 🔒 **Local** (`scripts\run_local.bat`) — runs **on your PC** via **Ollama**. Fully private, works **offline**, no quotas.

The app window runs on your PC; in cloud mode the model runs on Cloudflare, in local mode it runs on your machine.

## Run

**Just double-click `scripts\run.bat`** → opens <http://127.0.0.1:5000>. The model picker (top-left) lists
**both cloud and local models in one place**, each tagged **cloud** or **local**. Pick any — the app
routes to the right place automatically, no restart needed.

- ☁️ **cloud** = runs on Cloudflare (fast, needs internet).
- 🔒 **local** = runs on your PC via Ollama (private + offline; first reply ~25–40s while the model loads).

*Optional:* `scripts\run_local.bat` opens a **local-only** picker (hides cloud) for fully offline use.
Run one launcher at a time (same port). If a tab is already open, hard-refresh with **Ctrl+F5**.

## Picking a model (top-left dropdown)

Every model shows a **cloud** or **local** tag, plus **"thinks"** for slow *reasoning* models.

**Cloud (Cloudflare) — default `llama-3.3-70b` is fast + smart.** The **"thinks"** ones (GLM, QwQ, DeepSeek-R1, Qwen3) are reasoning models: smarter but pause ~10–20s first and use more of the daily free quota. The 120B ones (gpt-oss-120b, nemotron, kimi) are heavier. For speed, use **llama / mistral / gemma / gpt-oss-20b**.

**Local (Ollama, on your PC):** `phi4-mini` (best), `llama3.2:3b` (balanced), `llama3.2:1b` (fastest). Pull more anytime with `ollama pull <name>` — they appear in the picker automatically.

## Why some models are slow or "fail"

`max_tokens` is a cap on reply length — **not** related to model size. **Reasoning models** ("thinks" tag) write a long *hidden* thinking section before the answer, which can eat the token budget and occasionally return nothing. The app now **auto-retries** and shows a clear message if so. **Instant models** (Llama, Mistral, Gemma) don't do this — they reply immediately.

## Features

Streaming chat · searchable + date-grouped history (Ctrl+K) · rename/delete/export chats ·
edit & regenerate messages · copy message/code · Markdown + code highlighting + KaTeX math ·
attach files (+, drag-&-drop, paste) · auto chat titles · light/dark/system theme · keyboard shortcuts.

**Plus:**
- 🆚 **Compare mode** (off by default — toggle it on to pit **2–3 models side-by-side** on one prompt).
- ⚙️ **Settings** (gear icon): **reply length**, **creativity** (temperature), and a custom **persona** (system prompt).
- 🏷️ **Per-answer model badge** (which model wrote it) + an expandable **"thinking"** view for reasoning models.
- 🎙️ **Voice input** (mic button), and friendly **error cards** with Retry / Switch-model buttons.

## Switching cloud provider

The app is **OpenAI-compatible**, so it works with any provider. `.env` (cloud mode) holds the
Cloudflare config; `.env.example` has ready blocks for **Groq, Google Gemini, Z.ai, Mistral, NVIDIA, Ollama**.
Change `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_MODELS` to switch.

## Structure

A layered package (`app/`) separates the API, business logic, LLM providers, and storage —
see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full walkthrough.

```
app/
  main.py            FastAPI entry point (python -m app.main): mounts static, routes, /healthz, /docs
  api/               HTTP layer — routes.py, streaming.py (SSE), dependencies.py
  services/          Business logic — chat_service (stream + retry), history_service, document_service
  llm/               Provider routing — client.py, providers/ (glm, ollama, openai), prompts/, document_loader
  database/          SQLite — sqlite.py (engine), models.py, repository.py
  schemas/           Pydantic request/response models (chat, config, common)
  core/              config (pydantic-settings), logging, constants, exceptions
  utils/             small pure helpers
  templates/ static/ Frontend (index.html + marked/DOMPurify/highlight.js/KaTeX, styles.css, app.js)
data/                Runtime SQLite DB, uploads, documents (gitignored, kept via .gitkeep)
scripts/             run.bat (cloud + local) · run_local.bat (local-only) · maintenance/
tests/               pytest — api/ · llm/ · database/ (conftest spins up a TestClient)
docs/                ARCHITECTURE · API · DEPLOYMENT · DEVELOPMENT · PROJECT_OVERVIEW
archive/             Optional extras — desktop/ (.exe) · docker/ · legacy/ — not needed for browser use
.github/             CI (ruff + pytest + pip-audit) + Dependabot
.env / .env.example  Config           requirements.txt / requirements-dev.txt
```

## Architecture & development (industry-grade)

- **Backend:** FastAPI + Uvicorn (async streaming). Auto API docs at **`/docs`**. Pydantic validates every
  request; structured logging; binds to `127.0.0.1` (private, single-user). Mirrors **Open WebUI**'s stack
  (FastAPI + SQLite), the gold-standard local AI chat app.
- **Run:** `scripts\run.bat` (or `.venv\Scripts\python.exe -m app.main`) — opens in your browser.
- **Tests + lint:** `pytest` and `ruff check .` — both run in CI on every push (`.github/workflows/ci.yml`).
- **Dev deps:** `pip install -r requirements-dev.txt`.

## Optional extras (in `archive/`)

Not needed for everyday browser/terminal use — see [archive/README.md](archive/README.md) to restore any of them:
- **Desktop `.exe`** (`archive/desktop/`) — native-window build (PyInstaller + pywebview).
- **Docker** (`archive/docker/`) — containerized run.
- **Keyring** (`archive/desktop/set_key.py`) — store the API key in Windows Credential Manager instead of `.env`.
