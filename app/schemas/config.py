"""Model / config response schemas."""
from typing import List

from pydantic import BaseModel


class ModelInfo(BaseModel):
    id: str
    kind: str   # "cloud" | "local"


class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    default: str
