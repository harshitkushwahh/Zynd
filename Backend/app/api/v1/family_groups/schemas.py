from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class FamilyGroupMemberPreviewResponse(BaseModel):
    user_id: UUID
    display_name: str
    display_nickname: Optional[str] = None
    role: str
    badge_key: Optional[str] = None
    badge_label: Optional[str] = None
    profile_image_url: Optional[str] = None
    joined_at: datetime
    kyc_completed: bool = False
    has_invested: bool = False
    email: Optional[str] = None
    phone: Optional[str] = None
    zynd_id: Optional[str] = None
    details_masked: bool = False
    contribution_amount: Optional[float] = None
    group_sip_count: Optional[int] = None


class FamilyGroupResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    tag: Optional[str] = None
    status: str
    created_by_user_id: UUID
    avatar_url: Optional[str] = None
    member_count: int
    pending_invite_count: int = 0
    member_limit: int = 12
    my_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None


class FamilyGroupListResponse(BaseModel):
    items: list[FamilyGroupResponse]
    limit: int
    active_count: int


class CreateFamilyGroupRequest(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    tag: Optional[str] = Field(default=None, max_length=32)


class UpdateFamilyGroupRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=500)
    tag: Optional[str] = Field(default=None, max_length=32)


class FamilyGroupInviteResponse(BaseModel):
    id: UUID
    group_id: UUID
    invitee_email: Optional[str] = None
    invitee_user_id: Optional[UUID] = None
    intended_role: str
    intended_badge_key: Optional[str] = None
    intended_badge_label: Optional[str] = None
    status: str
    expires_at: datetime
    share_url: Optional[str] = None
    created_at: datetime


class CreateFamilyGroupInviteRequest(BaseModel):
    invitee_email: EmailStr
    intended_role: Literal["contributor", "viewer"] = "viewer"
    intended_badge_key: Optional[str] = Field(default=None, max_length=32)
    intended_badge_label: Optional[str] = Field(default=None, max_length=64)


class FamilyGroupInvitePreviewResponse(BaseModel):
    group_id: UUID
    group_title: str
    inviter_name: str
    intended_role: str
    intended_badge_key: Optional[str] = None
    intended_badge_label: Optional[str] = None
    expires_at: datetime
    invitee_email_masked: Optional[str] = None


class PendingFamilyGroupInviteResponse(BaseModel):
    id: UUID
    group_id: UUID
    group_title: str
    inviter_name: str
    intended_role: str
    intended_badge_key: Optional[str] = None
    intended_badge_label: Optional[str] = None
    expires_at: datetime
    created_at: datetime


class PendingFamilyGroupInviteListResponse(BaseModel):
    items: list[PendingFamilyGroupInviteResponse]


class FamilyGroupInviteActionRequest(BaseModel):
    token: str = Field(min_length=8, max_length=256)


class FamilyGroupBadgePresetResponse(BaseModel):
    key: str
    label: str


class FamilyGroupBadgePresetListResponse(BaseModel):
    items: list[FamilyGroupBadgePresetResponse]


class FamilyGroupInviteListResponse(BaseModel):
    items: list[FamilyGroupInviteResponse]


class FamilyGroupDetailResponse(FamilyGroupResponse):
    members: list[FamilyGroupMemberPreviewResponse] = Field(default_factory=list)
    invites: list[FamilyGroupInviteResponse] = Field(default_factory=list)
    active_goals_count: int = 0
    active_sips_count: int = 0
    total_invested_inr: float = 0
    total_current_value_inr: float = 0


class FamilyGroupPortfolioSliceResponse(BaseModel):
    id: str
    label: str
    amount_inr: float
    value_pct: float


class FamilyGroupPortfolioResponse(BaseModel):
    total_current_value_inr: float
    total_invested_inr: float
    active_sips_count: int
    active_goals_count: int
    goal_funded_inr: float
    has_holdings_data: bool
    slices: list[FamilyGroupPortfolioSliceResponse] = Field(default_factory=list)


class UpdateFamilyGroupMemberRequest(BaseModel):
    role: Optional[Literal["contributor", "viewer"]] = None
    badge_key: Optional[str] = Field(default=None, max_length=32)
    badge_label: Optional[str] = Field(default=None, max_length=64)
    clear_badge: bool = False
    display_nickname: Optional[str] = Field(default=None, max_length=64)
    clear_nickname: bool = False


class FamilyGroupActivityResponse(BaseModel):
    id: UUID
    event_type: str
    message: str
    actor_user_id: Optional[UUID] = None
    target_user_id: Optional[UUID] = None
    actor_display_name: Optional[str] = None
    actor_profile_image_url: Optional[str] = None
    actor_role: Optional[str] = None
    metadata: dict[str, object] = Field(default_factory=dict)
    created_at: datetime


class FamilyGroupActivityListResponse(BaseModel):
    items: list[FamilyGroupActivityResponse]
    next_cursor: Optional[str] = None
    has_more: bool = False


class TransferFamilyGroupHeadRequest(BaseModel):
    new_head_user_id: UUID


class LeaveFamilyGroupResponse(BaseModel):
    ok: bool
    group_archived: bool = False


class NomineeFamilyGroupPreviewRequest(BaseModel):
    nominee_email: EmailStr
    nominee_name: str = Field(min_length=1, max_length=128)
    relationship: str = Field(min_length=1, max_length=32)
    kyc_nominee_id: str = Field(min_length=1, max_length=64)
    group_id: Optional[UUID] = None


class NomineeFamilyGroupPreviewResponse(BaseModel):
    status: str
    message: str
    groups: list[FamilyGroupResponse] = Field(default_factory=list)
    group_id: Optional[UUID] = None
    suggested_badge_key: Optional[str] = None
    suggested_badge_label: Optional[str] = None
    invitee_email_masked: Optional[str] = None
    existing_status: Optional[str] = None


class NomineeFamilyGroupAddRequest(BaseModel):
    nominee_email: EmailStr
    nominee_name: str = Field(min_length=1, max_length=128)
    relationship: str = Field(min_length=1, max_length=32)
    kyc_nominee_id: str = Field(min_length=1, max_length=64)
    group_id: Optional[UUID] = None
    create_group_title: Optional[str] = Field(default=None, min_length=1, max_length=80)
    action: Literal["invite", "skip"] = "invite"


class NomineeFamilyGroupAddResponse(BaseModel):
    ok: bool
    action: str
    group: Optional[FamilyGroupResponse] = None
    invite: Optional[FamilyGroupInviteResponse] = None
