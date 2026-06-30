"""Unified LLM client — routes each model to the cloud or local Ollama."""
from app.core.config import settings
from app.core.constants import BALANCE_ERROR, SERVICE_NAME, TRANSIENT_MARKERS
from app.core.exceptions import NoCloudKeyError
from app.llm.providers import glm, ollama
from app.llm.providers.openai import make_client


def _resolve_key() -> str:
    """API key from env/.env first, else the OS keyring (Windows Credential Manager)."""
    k = (settings.LLM_API_KEY or settings.ZAI_API_KEY or "").strip()
    if k:
        return k
    try:
        import keyring
        return (keyring.get_password(SERVICE_NAME, "LLM_API_KEY") or "").strip()
    except Exception:
        return ""


CLOUD_KEY = _resolve_key()
CLOUD_BASE = settings.LLM_BASE_URL.strip()
DEFAULT_MODEL = (settings.LLM_MODEL or settings.GLM_MODEL or "glm-4.7-flash").strip()
CLOUD_MODELS = [m.strip() for m in settings.LLM_MODELS.split(",") if m.strip()] or [DEFAULT_MODEL]
LOCAL_BASE = settings.OLLAMA_BASE_URL.strip()
CLOUD_THINKING = glm.is_glm_base(CLOUD_BASE)
_CLOUD_IS_OLLAMA = ollama.is_ollama_base(CLOUD_BASE)


def is_transient(err) -> bool:
    """True for retryable errors (overload/timeout); False for balance (1113)."""
    s = str(err)
    if BALANCE_ERROR in s:
        return False
    return any(k in s for k in TRANSIENT_MARKERS)


def list_models():
    """Unified picker list: cloud models + local Ollama models, each tagged."""
    cloud = [] if _CLOUD_IS_OLLAMA else list(CLOUD_MODELS)
    seen, models = set(), []
    for m in cloud:
        if m not in seen:
            seen.add(m)
            models.append({"id": m, "kind": "cloud"})
    for m in ollama.list_installed(LOCAL_BASE):
        if m not in seen:
            seen.add(m)
            models.append({"id": m, "kind": "local"})
    if not models:
        models = [{"id": DEFAULT_MODEL, "kind": "local" if _CLOUD_IS_OLLAMA else "cloud"}]
    default = DEFAULT_MODEL if any(x["id"] == DEFAULT_MODEL for x in models) else models[0]["id"]
    return models, default


def client_for(model: str):
    """Return (OpenAI client, supports_thinking) routed to the right provider."""
    if (model in set(CLOUD_MODELS)) and not _CLOUD_IS_OLLAMA:
        if not CLOUD_KEY or CLOUD_KEY == "paste-your-key-here":
            raise NoCloudKeyError("No cloud API key set in .env")
        return make_client(CLOUD_KEY, CLOUD_BASE), CLOUD_THINKING
    return make_client("ollama", LOCAL_BASE), False
