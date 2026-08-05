from __future__ import annotations

from datetime import datetime, date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AdminFamilyGroupSummaryResponse(BaseModel):
    id: UUID
    title: str
    tag: Optional[str] = None
    status: str
    member_count: int
    pending_invite_count: int
    head_user_id: Optional[UUID] = None
    head_display_name: Optional[str] = None
    head_email_masked: Optional[str] = None
    created_by_user_id: UUID
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None


class AdminFamilyGroupListResponse(BaseModel):
    items: list[AdminFamilyGroupSummaryResponse]
    limit: int
    offset: int


class AdminFamilyGroupMemberResponse(BaseModel):
    user_id: UUID
    display_name: str
    display_nickname: Optional[str] = None
    email_masked: str
    role: str
    badge_key: Optional[str] = None
    badge_label: Optional[str] = None
    joined_at: datetime


class AdminFamilyGroupInviteResponse(BaseModel):
    id: UUID
    group_id: UUID
    invitee_email: Optional[str] = None
    invitee_user_id: Optional[UUID] = None
    intended_role: str
    intended_badge_key: Optional[str] = None
    intended_badge_label: Optional[str] = None
    status: str
    expires_at: datetime
    created_at: datetime


class AdminFamilyGroupActivityResponse(BaseModel):
    id: UUID
    event_type: str
    message: str
    actor_user_id: Optional[UUID] = None
    target_user_id: Optional[UUID] = None
    created_at: datetime


class AdminFamilyGroupDetailResponse(AdminFamilyGroupSummaryResponse):
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    creator_display_name: Optional[str] = None
    creator_email_masked: Optional[str] = None
    members: list[AdminFamilyGroupMemberResponse]
    invites: list[AdminFamilyGroupInviteResponse]
    activity: list[AdminFamilyGroupActivityResponse]


class AdminFamilyGroupInviteListItemResponse(AdminFamilyGroupInviteResponse):
    group_title: str
    group_status: str


class AdminFamilyGroupInviteListResponse(BaseModel):
    items: list[AdminFamilyGroupInviteListItemResponse]
    limit: int
    offset: int


class AdminFamilyGroupMemberPreviewResponse(BaseModel):
    user_id: UUID
    display_name: str
    role: str
    profile_image_url: Optional[str] = None


class AdminUserFamilyGroupCardResponse(AdminFamilyGroupSummaryResponse):
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    members_preview: list[AdminFamilyGroupMemberPreviewResponse] = Field(default_factory=list)
    active_goals_count: int = 0
    progress_pct: int = 0


class AdminUserFamilyGroupMembershipCardResponse(AdminUserFamilyGroupCardResponse):
    group_id: UUID
    role: str
    badge_label: Optional[str] = None
    joined_at: datetime


class AdminUserFamilyGroupsResponse(BaseModel):
    user_id: UUID
    memberships: list[AdminUserFamilyGroupMembershipCardResponse]
    created_groups: list[AdminUserFamilyGroupCardResponse]


class AdminFamilyGroupAuditLogItemResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    event_type: str
    ip_address: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    created_at: str


class AdminFamilyGroupAuditLogListResponse(BaseModel):
    items: list[AdminFamilyGroupAuditLogItemResponse]
    limit: int
    offset: int


class AdminFamilyGroupActionResponse(BaseModel):
    ok: bool = True


class AdminFamilyGroupPortfolioSliceResponse(BaseModel):
    id: str
    label: str
    amount_inr: float
    value_pct: float


class AdminFamilyGroupPortfolioResponse(BaseModel):
    total_current_value_inr: float
    total_invested_inr: float
    total_returns_inr: float
    active_sips_count: int
    active_goals_count: int
    goal_funded_inr: float
    goal_declared_savings_inr: float = 0
    goal_contributions_inr: float = 0
    has_holdings_data: bool
    slices: list[AdminFamilyGroupPortfolioSliceResponse] = Field(default_factory=list)


class AdminFamilyGroupAnalyticsMemberResponse(BaseModel):
    user_id: UUID
    display_name: str
    display_nickname: Optional[str] = None
    email_masked: str
    role: str
    badge_key: Optional[str] = None
    badge_label: Optional[str] = None
    profile_image_url: Optional[str] = None
    joined_at: datetime
    invested_amount_inr: Optional[float] = None
    goal_contribution_inr: Optional[float] = None
    portfolio_share_pct: float = 0
    linked_sip_count: int = 0


class AdminFamilyGroupContributionChartPointResponse(BaseModel):
    user_id: UUID
    label: str
    full_name: str
    amount_inr: float


class AdminFamilyGroupProgressChartPointResponse(BaseModel):
    period_key: str
    year: int
    label: str
    goal_progress_inr: float
    invested_inr: float


class AdminFamilyGroupSipAddonResponse(BaseModel):
    plan_id: UUID
    user_id: UUID
    member_label: str
    goal_title: Optional[str] = None
    amount_inr: float
    frequency: str
    is_goal_linked: bool = False


class AdminFamilyGroupMfHoldingResponse(BaseModel):
    holding_id: int
    user_id: UUID
    member_label: str
    member_display_name: str
    scheme_name: str
    matched_scheme_name: Optional[str] = None
    folio_number: str
    isin: str
    units: float
    nav_value: Optional[float] = None
    market_value_inr: Optional[float] = None
    as_of_date: Optional[str] = None
    amc_name: Optional[str] = None
    source: str


class AdminFamilyGroupOneTimePaymentResponse(BaseModel):
    contribution_id: UUID
    user_id: UUID
    member_label: str
    member_display_name: str
    goal_title: str
    amount_inr: float
    source_type: str
    contributed_at: Optional[datetime] = None


class AdminFamilyGroupAnalyticsGoalResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: UUID
    title: str
    status: str
    target_amount_inr: Optional[float] = None
    current_amount_inr: Optional[float] = None
    existing_savings_inr: Optional[float] = None
    progress_pct: float = 0
    target_date: Optional[date] = None
    contribution_total_inr: Optional[float] = None
    priority: Optional[int] = None
    tag: Optional[str] = None


class AdminFamilyGroupAnalyticsResponse(AdminFamilyGroupSummaryResponse):
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    creator_display_name: Optional[str] = None
    creator_email_masked: Optional[str] = None
    progress_pct: int = 0
    portfolio: AdminFamilyGroupPortfolioResponse
    members: list[AdminFamilyGroupAnalyticsMemberResponse]
    goals: list[AdminFamilyGroupAnalyticsGoalResponse] = Field(default_factory=list)
    contribution_chart: list[AdminFamilyGroupContributionChartPointResponse] = Field(default_factory=list)
    activity: list[AdminFamilyGroupActivityResponse] = Field(default_factory=list)
    progress_chart: list[AdminFamilyGroupProgressChartPointResponse] = Field(default_factory=list)
    sip_addons: list[AdminFamilyGroupSipAddonResponse] = Field(default_factory=list)
    mf_holdings: list[AdminFamilyGroupMfHoldingResponse] = Field(default_factory=list)
    one_time_payments: list[AdminFamilyGroupOneTimePaymentResponse] = Field(default_factory=list)
