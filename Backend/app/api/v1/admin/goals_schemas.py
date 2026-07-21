from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AdminGoalTemplateResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: Optional[str] = None
    icon_key: str
    default_tenure_months: int
    suggested_return_pct: Optional[float] = None
    is_active: bool
    sort_order: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AdminGoalTemplateListResponse(BaseModel):
    items: list[AdminGoalTemplateResponse]


class UpdateAdminGoalTemplateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    description: Optional[str] = None
    icon_key: Optional[str] = Field(default=None, min_length=1, max_length=32)
    default_tenure_months: Optional[int] = Field(default=None, ge=1)
    suggested_return_pct: Optional[float] = Field(default=None, ge=0, le=100)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
