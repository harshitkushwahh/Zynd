from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.documents.document_cdn_service import build_cdn_asset_url
from app.application.documents.profile_image_url_service import build_profile_image_public_url
from app.application.family_groups.constants import MAX_FAMILY_GROUP_MEMBERS
from app.application.shared.datetime_utils import utcnow
from app.core.config import get_settings
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupMember,
    FamilyGroupMemberRole,
    FamilyGroupMemberStatus,
    FamilyGroupStatus,
)
from app.infrastructure.persistence.models import DocumentStatus, DocumentType, User, UserDocument
from app.application.referral.referral_notification_service import mask_referee_email

MASKED_DETAIL_PLACEHOLDER = "••••••••"


def mask_member_email(email: str | None) -> str | None:
    if not email:
        return None
    local, separator, domain = email.partition("@")
    if not separator or not domain:
        return MASKED_DETAIL_PLACEHOLDER
    if len(local) <= 1:
        masked_local = f"{local}***" if local else "***"
    elif len(local) <= 3:
        masked_local = f"{local[0]}***{local[-1]}"
    else:
        masked_local = f"{local[:2]}***{local[-2:]}"
    return f"{masked_local}@{domain}"


def mask_member_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) <= 4:
        return MASKED_DETAIL_PLACEHOLDER
    if len(digits) <= 6:
        return f"{digits[:1]}***{digits[-2:]}"
    return f"{digits[:2]}***{digits[-4:]}"


def mask_member_zynd_id(zynd_id: str | None) -> str | None:
    if not zynd_id:
        return None
    value = zynd_id.strip()
    if len(value) <= 4:
        return MASKED_DETAIL_PLACEHOLDER
    if len(value) <= 6:
        return f"{value[:1]}••••{value[-1:]}"
    return f"{value[:2]}••••{value[-2:]}"


def _group_snapshot(group: FamilyGroup) -> dict[str, object]:
    return {
        "id": str(group.id),
        "title": group.title,
        "description": group.description,
        "tag": group.tag,
        "status": group.status.value,
        "created_by_user_id": str(group.created_by_user_id),
        "avatar_document_id": str(group.avatar_document_id) if group.avatar_document_id else None,
    }


async def resolve_family_group_avatar_url(
    db: AsyncSession,
    *,
    avatar_document_id: UUID | None,
) -> str | None:
    if not avatar_document_id:
        return None

    document = await db.get(UserDocument, avatar_document_id)
    if not document or document.status != DocumentStatus.active:
        return None
    if document.doc_type not in {DocumentType.profile_image, DocumentType.family_group_avatar}:
        return None

    settings = get_settings()
    if document.doc_type == DocumentType.family_group_avatar:
        cdn_url = build_cdn_asset_url(document, settings)
        if cdn_url:
            return cdn_url
        prefix = settings.api_prefix.rstrip("/")
        return f"{prefix}/documents/public/{document.id}?v={document.version}"

    return build_profile_image_public_url(document, settings)


async def count_active_members(db: AsyncSession, group_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(FamilyGroupMember)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
    )
    return int(result.scalar_one())


async def serialize_family_group(
    db: AsyncSession,
    group: FamilyGroup,
    *,
    viewer_user_id: UUID,
) -> dict[str, object]:
    membership = await get_active_membership(db, group_id=group.id, user_id=viewer_user_id)
    member_count = await count_active_members(db, group.id)
    from app.application.family_groups.invite_service import count_pending_invites

    pending_invite_count = await count_pending_invites(db, group.id)
    avatar_url = await resolve_family_group_avatar_url(db, avatar_document_id=group.avatar_document_id)

    return {
        "id": group.id,
        "title": group.title,
        "description": group.description,
        "tag": group.tag,
        "status": group.status.value,
        "created_by_user_id": group.created_by_user_id,
        "avatar_url": avatar_url,
        "member_count": member_count,
        "pending_invite_count": pending_invite_count,
        "member_limit": MAX_FAMILY_GROUP_MEMBERS,
        "my_role": membership.role.value if membership else None,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
        "archived_at": group.archived_at,
    }


async def get_active_membership(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> FamilyGroupMember | None:
    result = await db.execute(
        select(FamilyGroupMember).where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.user_id == user_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
    )
    return result.scalar_one_or_none()


async def get_family_group_or_raise(
    db: AsyncSession,
    group_id: UUID,
) -> FamilyGroup:
    from app.application.family_groups.errors import FamilyGroupError

    group = await db.get(FamilyGroup, group_id)
    if not group or group.status != FamilyGroupStatus.active:
        raise FamilyGroupError("group_not_found", "Family group not found.", status_code=404)
    return group


async def require_group_head(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> tuple[FamilyGroup, FamilyGroupMember]:
    from app.application.family_groups.errors import FamilyGroupError

    group = await get_family_group_or_raise(db, group_id)
    membership = await get_active_membership(db, group_id=group_id, user_id=user_id)
    if not membership or membership.role != FamilyGroupMemberRole.head:
        raise FamilyGroupError(
            "forbidden",
            "Only the group head can perform this action.",
            status_code=403,
        )
    return group, membership


async def require_group_member(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> tuple[FamilyGroup, FamilyGroupMember]:
    from app.application.family_groups.errors import FamilyGroupError

    group = await get_family_group_or_raise(db, group_id)
    membership = await get_active_membership(db, group_id=group_id, user_id=user_id)
    if not membership:
        raise FamilyGroupError(
            "forbidden",
            "You are not a member of this family group.",
            status_code=403,
        )
    return group, membership


def group_audit_snapshot(group: FamilyGroup) -> dict[str, object]:
    return _group_snapshot(group)


def now_utc():
    return utcnow()


def resolve_member_display_name(member: FamilyGroupMember, user: User) -> str:
    nickname = (member.display_nickname or "").strip()
    if nickname:
        return nickname
    parts = [user.first_name, user.last_name]
    name = " ".join(part for part in parts if part).strip()
    return name or mask_referee_email(user.email)
