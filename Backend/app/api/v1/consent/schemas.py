from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ConsentCurrentVersionResponse(BaseModel):
    consent_key: str
    title: str
    description: Optional[str] = None
    acceptance_mode: str
    reaccept_policy: str
    consent_version_id: UUID
    version_label: str
    summary_text: Optional[str] = None
    body_markdown: Optional[str] = None
    document_url: Optional[str] = None


class ConsentAcceptRequest(BaseModel):
    consent_keys: list[str] = Field(default_factory=list)
    consent_key: Optional[str] = None
    consent_version_id: Optional[UUID] = None


class ConsentRevokeRequest(BaseModel):
    consent_key: str


class ConsentRequiredResponse(BaseModel):
    items: list[ConsentCurrentVersionResponse]


class ConsentAcceptResponse(BaseModel):
    success: bool = True
    accepted_count: int


class ConsentRevokeResponse(BaseModel):
    success: bool = True


class UserConsentRecordResponse(BaseModel):
    id: UUID
    consent_key: Optional[str] = None
    consent_title: Optional[str] = None
    version_label: Optional[str] = None
    consent_version_id: UUID
    action: str
    source: str
    ip_address: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None
    created_at: datetime
