from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AdminSearchGroupResponse(BaseModel):
    scope: str
    total: int
    items: list[dict[str, Any]] = Field(default_factory=list)


class AdminSearchResponse(BaseModel):
    query: str
    scope: str | None = None
    total: int
    limit: int
    offset: int
    took_ms: int
    cached: bool = False
    items: list[dict[str, Any]] = Field(default_factory=list)
    groups: list[AdminSearchGroupResponse] | None = None
