# LLM Studio

**A multi-user, ChatGPT-style AI chat SaaS** — sign in, chat with cloud **or** local models, and
your conversations follow you across devices. One shared model key powers everyone, with a fair
per-user daily quota.

🔗 **Live demo:** **https://heisenbergblue-llm-studio.hf.space** — create an account and start chatting.

---

## What it does

- 🔐 **Accounts & sessions** — email + password (Argon2id), HttpOnly session cookies. Your chats are
  private to your account and stored server-side, so they sync across browsers and devices.
- 💬 **Streaming chat** — token-by-token SSE, Markdown + code highlighting + KaTeX math, edit &
  regenerate, copy, auto-titles, searchable date-grouped history, export.
- 🧠 **Many models, one app** — OpenAI-compatible routing to **Cloudflare Workers AI** (default,
  free), Groq, Gemini, Mistral, Z.ai/GLM, NVIDIA, or a **local Ollama**. Each is tagged and the
  reasoning ("thinks") ones are flagged.
- 🆚 **Compare mode** — run a prompt against 2–3 models side-by-side.
- 📎 **Document context** — attach `.txt / .md / .pdf / .docx` (size + type limited) to ground a reply.
- 📊 **Per-user daily quota** — the server holds a shared key; each user gets a daily message budget
  (the first account to register is the admin, unlimited).
- 🎨 Light/dark/system theme, voice input, keyboard shortcuts, friendly error cards.

## Architecture

A layered FastAPI backend serving a dependency-free vanilla-JS frontend — deployed as a single
container.

```
app/
  main.py          FastAPI entry: routers, security headers + CSP, request logging, /healthz
  api/             routes.py (chat/history) · auth_routes.py (register/login/logout/me)
                   dependencies.py (auth + rate limit) · streaming.py (SSE)
  services/        chat_service · history_service · document_service · quota_service
  llm/             client.py (provider routing) · providers/ (glm · ollama · openai) · prompts/
  database/        engine.py (Postgres in prod, SQLite in dev) · models.py · repository.py
  core/            config (pydantic-settings) · security (Argon2 + tokens) · ratelimit · logging
  schemas/         Pydantic request/response models
  templates/ static/  index.html · styles.css · app.js (auth gate, per-user history, quota UI)
```

- **Auth/tenancy:** sessions in the DB; every `/api/*` route requires auth; chats are strictly
  scoped to their owner (no cross-tenant reads or overwrites).
- **Data:** **Neon Postgres** in production (`DATABASE_URL`), SQLite locally and in tests.
- **Hardening:** in-memory rate limiting (login/register/upload), upload size + MIME limits,
  Content-Security-Policy, HSTS in prod, DSN-gated Sentry, structured request logging.

## Run locally

```bash
uv venv --python 3.12 && uv pip install -r requirements.txt
cp .env.example .env          # add a provider key (Cloudflare/Groq/… or Ollama)
.venv/Scripts/python -m app.main      # → http://127.0.0.1:5000
```

No `DATABASE_URL` → it uses a local SQLite file. Set one to use Postgres.

**Tests & lint:** `pytest -q` and `ruff check .` (both gate CI on every push).

## Deploy

Containerized (`Dockerfile`) and deployable to any Docker host. The live demo runs on a **Hugging
Face Docker Space** backed by **Neon Postgres** — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for
the full runbook (Space creation, secrets, and the one-command deploy script).

## Configuration

All via environment / `.env` (see [.env.example](.env.example)). Key settings:

| Var | Default | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | _(empty → SQLite)_ | Postgres connection string in production |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` / `LLM_MODELS` | Cloudflare block | The shared model provider |
| `DAILY_MESSAGE_QUOTA` | `25` | Messages per user per UTC day |
| `APP_ENV` / `COOKIE_SECURE` | `development` / `false` | Set `production` / `true` when deployed (HTTPS) |
| `ALLOW_REGISTRATION` | `true` | Open or closed signups |
| `SENTRY_DSN` | _(empty)_ | Optional error monitoring |

## License

Personal project by [@mubin-attar-007](https://github.com/mubin-attar-007).
