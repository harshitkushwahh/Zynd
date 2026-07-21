"""Family groups persistence — Phase 0 foundation."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _pg_enum(enum_cls: type[enum.Enum]):
    return Enum(enum_cls, values_callable=lambda members: [member.value for member in members])


class FamilyGroupStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class FamilyGroupMemberRole(str, enum.Enum):
    head = "head"
    contributor = "contributor"
    viewer = "viewer"


class FamilyGroupMemberStatus(str, enum.Enum):
    active = "active"
    removed = "removed"


class FamilyGroupInviteStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    revoked = "revoked"
    expired = "expired"


class FamilyGroupActivityType(str, enum.Enum):
    member_joined = "member.joined"
    member_left = "member.left"
    member_removed = "member.removed"
    role_changed = "role.changed"
    badge_changed = "badge.changed"
    nickname_changed = "nickname.changed"
    invite_sent = "invite.sent"
    invite_accepted = "invite.accepted"
    invite_declined = "invite.declined"
    invite_revoked = "invite.revoked"
    group_updated = "group.updated"
    group_archived = "group.archived"
    head_transferred = "head.transferred"
    nominee_suggested_from_kyc = "nominee.suggested_from_kyc"
    goal_created = "goal.created"
    goal_updated = "goal.updated"
    goal_contribution_added = "goal.contribution_added"
    goal_archived = "goal.archived"


class FamilyGroupNomineeLinkStatus(str, enum.Enum):
    skipped = "skipped"
    invited = "invited"
    already_member = "already_member"


class FamilyGroup(Base):
    __tablename__ = "family_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tag: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    avatar_document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("user_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[FamilyGroupStatus] = mapped_column(
        Enum(FamilyGroupStatus),
        default=FamilyGroupStatus.active,
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    members: Mapped[list["FamilyGroupMember"]] = relationship(back_populates="group")
    invites: Mapped[list["FamilyGroupInvite"]] = relationship(back_populates="group")
    activities: Mapped[list["FamilyGroupActivity"]] = relationship(back_populates="group")


class FamilyGroupMember(Base):
    __tablename__ = "family_group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_family_group_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[FamilyGroupMemberRole] = mapped_column(
        Enum(FamilyGroupMemberRole),
        nullable=False,
    )
    badge_key: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    badge_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    invited_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[FamilyGroupMemberStatus] = mapped_column(
        Enum(FamilyGroupMemberStatus),
        default=FamilyGroupMemberStatus.active,
        nullable=False,
        index=True,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    display_nickname: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    nickname_set_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    group: Mapped["FamilyGroup"] = relationship(back_populates="members")


class FamilyGroupInvite(Base):
    __tablename__ = "family_group_invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invitee_email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True, index=True)
    invitee_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    intended_role: Mapped[FamilyGroupMemberRole] = mapped_column(
        Enum(FamilyGroupMemberRole),
        nullable=False,
    )
    intended_badge_key: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    intended_badge_label: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[FamilyGroupInviteStatus] = mapped_column(
        Enum(FamilyGroupInviteStatus),
        default=FamilyGroupInviteStatus.pending,
        nullable=False,
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    declined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    reminder_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reminder_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, server_default="0")

    group: Mapped["FamilyGroup"] = relationship(back_populates="invites")


class FamilyGroupActivity(Base):
    __tablename__ = "family_group_activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[FamilyGroupActivityType] = mapped_column(
        _pg_enum(FamilyGroupActivityType),
        nullable=False,
        index=True,
    )
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    target_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    group: Mapped["FamilyGroup"] = relationship(back_populates="activities")


class FamilyGroupNomineeLink(Base):
    __tablename__ = "family_group_nominee_links"
    __table_args__ = (
        UniqueConstraint("user_id", "kyc_nominee_id", name="uq_family_group_nominee_link"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    kyc_nominee_id: Mapped[str] = mapped_column(String(64), nullable=False)
    nominee_email: Mapped[str] = mapped_column(String(254), nullable=False, index=True)
    nominee_name: Mapped[str] = mapped_column(String(128), nullable=False)
    relationship: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[FamilyGroupNomineeLinkStatus] = mapped_column(
        Enum(FamilyGroupNomineeLinkStatus),
        nullable=False,
        index=True,
    )
    invite_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("family_group_invites.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
