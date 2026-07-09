"""Rebuild-only deploy for LLM Studio (free-tier friendly).

`deploy_space.py` calls `create_repo` first, which now returns 402 on a free HF
account ("Docker Spaces on free cpu-basic require PRO"). This script skips that:
it uploads the code to the ALREADY-EXISTING Space and lets it rebuild, and it does
NOT touch secrets (they're already set on the running Space). Use it when the Space
exists and you only changed code.

  .venv/Scripts/python scripts/deploy_space_rebuild.py

Reads the HF write token from the git-ignored .deploy/hf_token.txt (never printed).
NOTE: the Space rebuild happens on HF's side; on a free account HF may still gate
the rebuild. If it does, the previous build keeps serving. For a guaranteed deploy,
put HF PRO on the account and use scripts/deploy_space.py.
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
emoji: \U0001F916
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


def main() -> None:
    token = (ROOT / ".deploy/hf_token.txt").read_text(encoding="utf-8").strip()
    api = HfApi(token=token)

    info = api.space_info(REPO_ID)  # verify it exists — do NOT create
    print(f"target Space: {info.id} (exists) — uploading code, no create/secrets")

    api.upload_folder(
        repo_id=REPO_ID, repo_type="space", folder_path=str(ROOT),
        ignore_patterns=IGNORE,
        commit_message="Rebuild: fix stacked auth forms + rAF streaming + model-picker badges",
    )
    api.upload_file(
        path_or_fileobj=SPACE_README.encode(), path_in_repo="README.md",
        repo_id=REPO_ID, repo_type="space", commit_message="Space README",
    )

    files = api.list_repo_files(repo_id=REPO_ID, repo_type="space")
    leaked = [f for f in files if f in (".env", ".env.production") or f.startswith(".deploy")]
    print("LEAK CHECK:", "CLEAN" if not leaked else f"!! LEAKED {leaked}")
    print("uploaded — the Space will rebuild. Verify: "
          "curl https://heisenbergblue-llm-studio.hf.space/healthz")


if __name__ == "__main__":
    main()
