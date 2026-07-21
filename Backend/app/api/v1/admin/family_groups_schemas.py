from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


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


class AdminUserFamilyGroupMembershipResponse(BaseModel):
    group_id: UUID
    title: str
    tag: Optional[str] = None
    status: str
    role: str
    badge_label: Optional[str] = None
    member_count: int
    joined_at: datetime


class AdminUserFamilyGroupsResponse(BaseModel):
    user_id: UUID
    memberships: list[AdminUserFamilyGroupMembershipResponse]
    created_groups: list[AdminFamilyGroupSummaryResponse]


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
