"""Common response schemas."""
from pydantic import BaseModel


class Health(BaseModel):
    ok: bool = True
    default_model: str = ""


class ErrorResponse(BaseModel):
    error: str
