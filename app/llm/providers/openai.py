"""Generic OpenAI-compatible client factory (used by every provider)."""
from openai import OpenAI


def make_client(api_key: str, base_url: str) -> OpenAI:
    # max_retries=0: our own logic (chat_service) handles retries. Otherwise the
    # SDK's built-in Retry-After backoff on a 429 turns a clear quota error into a
    # long, confusing "Request timed out". timeout caps a slow first token.
    return OpenAI(api_key=api_key, base_url=base_url, max_retries=0, timeout=90.0)
