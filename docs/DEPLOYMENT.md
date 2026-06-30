# Deployment

LLM Studio ships as a single container (`Dockerfile`). The live demo runs on a **Hugging Face
Docker Space** backed by **Neon Postgres**, but the same image runs on Render, Fly, Railway, or any
Docker host.

## Production architecture

```
  Browser ──HTTPS──►  HF Space (Docker)  ──►  uvicorn / FastAPI  ──►  Neon Postgres
                       app_port 7860            (app.main:app)         (DATABASE_URL)
                                                      │
                                                      └──►  shared LLM provider (Cloudflare/…)
```

The container runs `uvicorn app.main:app --host 0.0.0.0 --port 7860 --proxy-headers`. On startup the
app creates its tables (`init_db`) and reads all config from environment variables (the Space
**secrets**).

## Required secrets

| Secret | Example | Notes |
|--------|---------|-------|
| `DATABASE_URL` | `postgresql://…neon.tech/db?sslmode=require` | Neon pooled connection string |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` / `LLM_MODELS` | Cloudflare block | The shared model key |
| `APP_ENV` | `production` | enables HSTS |
| `COOKIE_SECURE` | `true` | cookies only over HTTPS |
| `ALLOW_REGISTRATION` | `true` | open signups for the demo |
| `DAILY_MESSAGE_QUOTA` | `25` | per-user daily budget |
| `SENTRY_DSN` | _(optional)_ | error monitoring |

> ⚠️ Postgres note: millisecond-epoch columns are `BigInteger` (Postgres `INT4` overflows at ~2.1e9).

## One-command deploy

Secrets live in two **git-ignored** files: `.env.production` (prod config + `DATABASE_URL`) and
`.deploy/hf_token.txt` (a Hugging Face **write** token). `LLM_*` values are read from your local
`.env`. Then:

```bash
.venv/Scripts/python scripts/deploy_space.py
```

This creates/updates the Space (`heisenbergblue/llm_studio`, Docker SDK, public), pushes the Space
secrets, uploads the code (never the secret files — there's a built-in leak check), and writes the
Space `README.md` front-matter (`sdk: docker`, `app_port: 7860`). The Space rebuilds automatically.

## Verify

```bash
curl https://heisenbergblue-llm-studio.hf.space/healthz
# {"ok": true, "db": true, "env": "production", ...}
```

Then open the URL, register the **first** account (it becomes the admin, unlimited quota), and chat.

## Local / self-host

No `DATABASE_URL` → SQLite at `data/runtime/llm_studio.db`; binds `127.0.0.1`. Run with
`scripts\run.bat` (Windows) or `uvicorn app.main:app`. For a self-hosted multi-user instance, set a
`DATABASE_URL`, `COOKIE_SECURE=true`, and serve behind HTTPS.
