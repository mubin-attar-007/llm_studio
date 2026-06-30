"""Chat request schemas (validate every payload)."""
from typing import List, Optional

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = ""


class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = None
    max_tokens: Optional[int] = Field(default=None, ge=1, le=32768)
    temperature: Optional[float] = Field(default=None, ge=0, le=2)


class TitleRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = None
