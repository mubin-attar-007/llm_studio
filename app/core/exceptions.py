"""Custom exceptions."""


class LLMStudioError(Exception):
    """Base error for the app."""


class NoCloudKeyError(LLMStudioError):
    """Raised when a cloud model is requested but no API key is configured."""
