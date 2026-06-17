import json
from datetime import datetime

from pydantic import BaseModel, field_validator


class StrategyCreate(BaseModel):
    name: str
    description: str = ""
    code: str = ""
    language: str = "python"
    tags: list[str] = []


class StrategyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    code: str | None = None
    language: str | None = None
    status: str | None = None
    tags: list[str] | None = None


class StrategyOut(BaseModel):
    id: int
    name: str
    description: str
    code: str
    language: str
    status: str
    tags: list[str] = []
    created_at: datetime
    updated_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else []
        return v

    model_config = {"from_attributes": True}
