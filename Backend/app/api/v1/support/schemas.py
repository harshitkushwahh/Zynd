from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.api.v1.distributor.schemas import DistributorClientListItemResponse


class SupportMessageOut(BaseModel):
    id: str
    role: Literal["user", "bot", "agent", "system"]
    body: str
    created_at: datetime
    sender_name: str | None = None
    visibility: Literal["customer", "internal"] = "customer"
    kind: Literal["text", "resolution_prompt"] = "text"
    attachment_document_id: str | None = None
    attachment_filename: str | None = None
    resolution_active: bool = False


class ConversationOut(BaseModel):
    id: str | None
    status: str
    handler: Literal["bot", "human"]
    participant: Literal["bot", "human"] = "bot"
    ticket_id: str | None
    ticket_status: Literal["open", "pending", "resolved"] | None = None
    assignee_name: str | None = None
    agent_presence: Literal["online", "away"] | None = None
    resolution_open: bool = False
    messages: list[SupportMessageOut]


class PostMessageRequest(BaseModel):
    body: str = ""
    has_attachment: bool = False


class TicketOut(BaseModel):
    id: str
    subject: str
    description: str
    topic: str
    status: str
    priority: str
    user_id: str
    assignee_id: str | None = None
    assignee_name: str | None = None
    created_at: datetime
    updated_at: datetime
    channel: str
    handled_by: Literal["bot", "human"]
    escalation_reason: str | None = None
    messages: list[SupportMessageOut] = Field(default_factory=list)
    attachments: list[dict] = Field(default_factory=list)


class TicketListOut(BaseModel):
    items: list[TicketOut]


class CustomerTicketListOut(BaseModel):
    items: list[TicketOut]
    has_more: bool = False
    next_offset: int = 0


class SupportConsoleUserListOut(BaseModel):
    items: list[DistributorClientListItemResponse]
    has_more: bool = False
    next_offset: int = 0


class SupportKycRegistryFieldOut(BaseModel):
    label: str
    value: str | None = None


class SupportKycRegistryRecordVariantOut(BaseModel):
    id: str
    label: str
    updated_at: str
    summary_fields: list[SupportKycRegistryFieldOut]
    partner_response: dict[str, Any] = Field(default_factory=dict)
    system_stored: dict[str, Any] = Field(default_factory=dict)


class SupportKycRegistryRecordOut(BaseModel):
    id: Literal["mf_investment_account", "nominee", "investor_profile"]
    title: str
    variants: list[SupportKycRegistryRecordVariantOut]


class SupportKycRegistrySnapshotOut(BaseModel):
    records: list[SupportKycRegistryRecordOut]


class CustomerSnapshotOut(BaseModel):
    display_name: str
    email_masked: str
    mobile_masked: str
    pan_masked: str
    aadhaar_masked: str
    kyc_status_label: str
    kyc_compliant: bool
    client_type: str
    onboarding_date: datetime | None = None


class DomainFieldOut(BaseModel):
    label: str
    value: str


class DomainOut(BaseModel):
    title: str
    view_in_href: str | None = None
    view_in_label: str | None = None
    status_label: str
    status_variant: str | None = None
    fields: list[DomainFieldOut]


class TicketDetailOut(BaseModel):
    ticket: TicketOut
    customer: CustomerSnapshotOut
    domain: DomainOut | None = None
    recent_tickets: list[TicketOut]


class AgentMessageRequest(BaseModel):
    body: str = ""
    visibility: Literal["customer", "internal"] = "customer"
    resolution_prompt: bool = False


class UpdateTicketRequest(BaseModel):
    status: Literal["open", "pending", "resolved"] | None = None
    assign_to_self: bool = False


class ResolutionChoiceRequest(BaseModel):
    choice: Literal["yes", "no"]


class HelpBotStatusOut(BaseModel):
    ollama: Literal["connected", "unavailable"]
    model: str
