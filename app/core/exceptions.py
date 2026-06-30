"""Custom exceptions."""


class GLMStudioError(Exception):
    """Base error for the app."""


class NoCloudKeyError(GLMStudioError):
    """Raised when a cloud model is requested but no API key is configured."""
