"""Deploy LLM Studio to a Hugging Face Docker Space.

Reads secrets from git-ignored files (never prints their values):
  - .env.production       prod config + DATABASE_URL
  - .env                  LLM_* provider settings
  - .deploy/hf_token.txt  a Hugging Face *write* token

Usage:  python scripts/deploy_space.py
"""
import pathlib

from huggingface_hub import HfApi

ROOT = pathlib.Path(__file__).resolve().parent.parent
REPO_ID = "heisenbergblue/llm_studio"

IGNORE = [
    ".git", ".git/*", "**/.git/*", ".gitattributes",
    ".venv/*", "venv/*", "**/__pycache__/*", "*.pyc",
    ".pytest_cache/*", ".ruff_cache/*",
    ".env", ".env.production", ".deploy/*", "*.key",
    "data/runtime/*", "data/uploads/*", "data/documents/*", "*.db",
    "archive/*", "tests/*", "node_modules/*", "README.md",
]

SPACE_README = """---
title: LLM Studio
emoji: 🤖
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
short_description: Multi-user AI chat (cloud + local models)
---

# LLM Studio

A multi-user, ChatGPT-style AI chat SaaS — cloud + local models, per-user accounts,
server-side chat history, and a daily message quota on a shared key.

Source: https://github.com/mubin-attar-007/llm_studio
"""


def parse_env(fp: pathlib.Path) -> dict:
    out = {}
    if not fp.exists():
        return out
    for line in fp.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def main() -> None:
    token = (ROOT / ".deploy/hf_token.txt").read_text(encoding="utf-8").strip()
    prod, local = parse_env(ROOT / ".env.production"), parse_env(ROOT / ".env")

    secrets = {}
    for k in ("APP_ENV", "APP_NAME", "COOKIE_SECURE", "ALLOW_REGISTRATION",
              "DAILY_MESSAGE_QUOTA", "RATE_LIMIT_ENABLED", "DATABASE_URL", "SENTRY_DSN"):
        if prod.get(k):
            secrets[k] = prod[k]
    for k in ("LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_MODELS"):
        v = prod.get(k) or local.get(k)   # prod (.env.production) wins over local .env
        if v:
            secrets[k] = v

    api = HfApi(token=token)
    api.create_repo(REPO_ID, repo_type="space", space_sdk="docker", private=False, exist_ok=True)
    for key in secrets:
        api.add_space_secret(repo_id=REPO_ID, key=key, value=secrets[key])
    print(f"secrets set: {len(secrets)} (LLM key present: {'LLM_API_KEY' in secrets})")

    api.upload_folder(repo_id=REPO_ID, repo_type="space", folder_path=str(ROOT),
                      ignore_patterns=IGNORE, commit_message="Deploy LLM Studio")
    api.upload_file(path_or_fileobj=SPACE_README.encode(), path_in_repo="README.md",
                    repo_id=REPO_ID, repo_type="space", commit_message="Space README")

    files = api.list_repo_files(repo_id=REPO_ID, repo_type="space")
    leaked = [f for f in files if f in (".env", ".env.production") or f.startswith(".deploy")]
    print("LEAK CHECK:", "CLEAN" if not leaked else f"!! LEAKED {leaked}")
    print("URL: https://huggingface.co/spaces/" + REPO_ID)


if __name__ == "__main__":
    main()
