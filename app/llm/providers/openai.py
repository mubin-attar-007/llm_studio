"""Generic OpenAI-compatible client factory (used by every provider)."""
from openai import OpenAI


def make_client(api_key: str, base_url: str) -> OpenAI:
    return OpenAI(api_key=api_key, base_url=base_url)
