from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DistributorClientListItemResponse(BaseModel):
    user_id: UUID
    client_id: str | None = None
    display_name: str
    email_masked: str
    phone_masked: str | None = None
    pan_masked: str
    status: str
    kyc_compliant: bool
    has_invested: bool
    onboarding_status: str
    compliance_status: str
    investment_status: str
    investor_type: str
    aum: float | None = None
    created_at: datetime | None = None


class DistributorClientListResponse(BaseModel):
    items: list[DistributorClientListItemResponse]


class DistributorClientReferralsResponse(BaseModel):
    total_referrals: int
    kyc_verified: int
    first_investment: int
    qualified: int
    referral_code: str


class DistributorClientRiskProfileResponse(BaseModel):
    label: str
    tier: str | None = None
    score: int | None = None
    display_score: int | None = None


class DistributorClientFamilyMemberResponse(BaseModel):
    user_id: UUID
    display_name: str | None = None
    email_masked: str | None = None
    role: str | None = None
    badge_label: str | None = None
    profile_image_url: str | None = None


class DistributorClientFamilyGroupResponse(BaseModel):
    group_id: UUID
    name: str | None = None
    tag: str | None = None
    description: str | None = None
    avatar_url: str | None = None
    head_user_id: UUID | None = None
    head_display_name: str | None = None
    client_role: str
    member_count: int
    status: str | None = None
    members: list[DistributorClientFamilyMemberResponse] = Field(default_factory=list)


class DistributorClientFamilyGroupDetailResponse(DistributorClientFamilyGroupResponse):
    client_user_id: UUID
    client_display_name: str


class DistributorClientSessionResponse(BaseModel):
    id: str
    device_label: str
    os: str
    browser: str
    last_active_at: datetime | None = None
    is_current: bool


class DistributorClientDetailResponse(BaseModel):
    summary: DistributorClientListItemResponse
    display_name: str
    email_masked: str
    email_display: str
    phone_masked: str | None = None
    pan_masked: str
    risk_profile_label: str
    risk_profile: DistributorClientRiskProfileResponse | None = None
    mfa_enabled: bool
    profile_image_url: str | None = None
    kyc_overall_status: str
    kyc: dict[str, Any] | None = None
    connected_accounts: dict[str, Any] | None = None
    investments: dict[str, Any] | None = None
    goals: list[dict[str, Any]] = Field(default_factory=list)
    family_groups: list[DistributorClientFamilyGroupResponse] = Field(default_factory=list)
    referrals: DistributorClientReferralsResponse
    sessions: list[DistributorClientSessionResponse] = Field(default_factory=list)
    created_at: datetime | None = None
