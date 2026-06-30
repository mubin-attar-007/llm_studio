"""Local Ollama provider specifics."""
import httpx


def is_ollama_base(base_url: str) -> bool:
    return "11434" in base_url


def tags_url(base_url: str) -> str:
    return base_url.replace("/v1", "").rstrip("/") + "/api/tags"


def list_installed(base_url: str) -> list:
    """Models installed in a running Ollama (empty list if it isn't running)."""
    try:
        r = httpx.get(tags_url(base_url), timeout=2.0)
        if r.status_code == 200:
            return [m["name"] for m in r.json().get("models", [])]
    except Exception:
        pass
    return []
