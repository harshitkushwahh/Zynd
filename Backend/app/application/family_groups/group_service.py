from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.documents.document_service import upload_user_document
from app.application.documents.errors import DocumentError
from app.application.family_groups.constants import (
    MAX_FAMILY_GROUP_DESCRIPTION_LENGTH,
    MAX_FAMILY_GROUP_TAG_LENGTH,
    MAX_FAMILY_GROUP_TITLE_LENGTH,
    MAX_FAMILY_GROUPS_PER_USER,
)
from app.application.family_groups.display import (
    MASKED_DETAIL_PLACEHOLDER,
    get_family_group_or_raise,
    group_audit_snapshot,
    mask_member_email,
    mask_member_phone,
    mask_member_zynd_id,
    now_utc,
    require_group_head,
    require_group_member,
    resolve_member_display_name,
    serialize_family_group,
)
from app.application.family_groups.member_insights_service import load_member_insights
from app.application.family_groups.family_group_portfolio_service import (
    load_member_goal_contribution_totals,
    load_member_linked_sip_counts,
)
from app.application.family_groups.errors import FamilyGroupError
from app.application.family_groups.activity_service import record_family_group_activity
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupActivityType,
    FamilyGroupMember,
    FamilyGroupMemberRole,
    FamilyGroupMemberStatus,
    FamilyGroupStatus,
)
from app.infrastructure.persistence.models import AuditEventType, DocumentType, User


async def count_active_groups_created_by_user(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(FamilyGroup)
        .where(
            FamilyGroup.created_by_user_id == user_id,
            FamilyGroup.status == FamilyGroupStatus.active,
        )
    )
    return int(result.scalar_one())


def _validate_title(title: str) -> str:
    trimmed = title.strip()
    if not trimmed:
        raise FamilyGroupError("invalid_title", "Group title is required.")
    if len(trimmed) > MAX_FAMILY_GROUP_TITLE_LENGTH:
        raise FamilyGroupError(
            "invalid_title",
            f"Group title must be at most {MAX_FAMILY_GROUP_TITLE_LENGTH} characters.",
        )
    return trimmed


def _validate_description(description: str | None) -> str | None:
    if description is None:
        return None
    trimmed = description.strip()
    if not trimmed:
        return None
    if len(trimmed) > MAX_FAMILY_GROUP_DESCRIPTION_LENGTH:
        raise FamilyGroupError(
            "invalid_description",
            f"Description must be at most {MAX_FAMILY_GROUP_DESCRIPTION_LENGTH} characters.",
        )
    return trimmed


def _validate_tag(tag: str | None) -> str | None:
    if tag is None:
        return None
    trimmed = tag.strip()
    if not trimmed:
        return None
    if len(trimmed) > MAX_FAMILY_GROUP_TAG_LENGTH:
        raise FamilyGroupError(
            "invalid_tag",
            f"Tag must be at most {MAX_FAMILY_GROUP_TAG_LENGTH} characters.",
        )
    return trimmed


async def create_family_group(
    db: AsyncSession,
    *,
    user: User,
    title: str,
    description: str | None = None,
    tag: str | None = None,
    ip: str | None = None,
) -> dict[str, object]:
    active_count = await count_active_groups_created_by_user(db, user.id)
    if active_count >= MAX_FAMILY_GROUPS_PER_USER:
        raise FamilyGroupError(
            "group_limit_reached",
            f"You can create up to {MAX_FAMILY_GROUPS_PER_USER} active family groups.",
            status_code=409,
        )

    group = FamilyGroup(
        title=_validate_title(title),
        description=_validate_description(description),
        tag=_validate_tag(tag),
        created_by_user_id=user.id,
        status=FamilyGroupStatus.active,
    )
    db.add(group)
    await db.flush()

    member = FamilyGroupMember(
        group_id=group.id,
        user_id=user.id,
        role=FamilyGroupMemberRole.head,
        status=FamilyGroupMemberStatus.active,
    )
    db.add(member)
    await db.flush()

    await write_audit(
        db,
        event_type=AuditEventType.family_group_created,
        user_id=user.id,
        ip=ip,
        metadata={"group": group_audit_snapshot(group)},
    )

    return await serialize_family_group(db, group, viewer_user_id=user.id)


async def list_family_groups_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> list[dict[str, object]]:
    result = await db.execute(
        select(FamilyGroup)
        .join(FamilyGroupMember, FamilyGroupMember.group_id == FamilyGroup.id)
        .where(
            FamilyGroupMember.user_id == user_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
            FamilyGroup.status == FamilyGroupStatus.active,
        )
        .order_by(FamilyGroup.created_at.desc())
    )
    groups = list(result.scalars().unique())
    payload: list[dict[str, object]] = []
    for group in groups:
        payload.append(await serialize_family_group(db, group, viewer_user_id=user_id))
    return payload


async def list_archived_family_groups_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
) -> list[dict[str, object]]:
    result = await db.execute(
        select(FamilyGroup)
        .join(FamilyGroupMember, FamilyGroupMember.group_id == FamilyGroup.id)
        .where(
            FamilyGroupMember.user_id == user_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
            FamilyGroup.status == FamilyGroupStatus.archived,
        )
        .order_by(FamilyGroup.archived_at.desc(), FamilyGroup.updated_at.desc())
    )
    groups = list(result.scalars().unique())
    payload: list[dict[str, object]] = []
    for group in groups:
        payload.append(await serialize_family_group(db, group, viewer_user_id=user_id))
    return payload


async def get_family_group_for_user(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> dict[str, object]:
    group, _membership = await require_group_member(db, group_id=group_id, user_id=user_id)
    return await serialize_family_group(db, group, viewer_user_id=user_id)


async def update_family_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    user: User,
    title: str | None = None,
    description: str | None = None,
    tag: str | None = None,
    ip: str | None = None,
) -> dict[str, object]:
    group, _membership = await require_group_head(db, group_id=group_id, user_id=user.id)
    before = group_audit_snapshot(group)

    if title is not None:
        group.title = _validate_title(title)
    if description is not None:
        group.description = _validate_description(description)
    if tag is not None:
        group.tag = _validate_tag(tag)

    await db.flush()
    await db.refresh(group)

    await write_audit(
        db,
        event_type=AuditEventType.family_group_updated,
        user_id=user.id,
        ip=ip,
        metadata={"group_id": str(group.id), "before": before, "after": group_audit_snapshot(group)},
    )

    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.group_updated,
        actor_user_id=user.id,
    )

    return await serialize_family_group(db, group, viewer_user_id=user.id)


async def archive_family_group(
    db: AsyncSession,
    *,
    group_id: UUID,
    user: User,
    ip: str | None = None,
) -> dict[str, object]:
    group, _membership = await require_group_head(db, group_id=group_id, user_id=user.id)
    before = group_audit_snapshot(group)

    group.status = FamilyGroupStatus.archived
    group.archived_at = now_utc()
    await db.flush()
    await db.refresh(group)

    await write_audit(
        db,
        event_type=AuditEventType.family_group_archived,
        user_id=user.id,
        ip=ip,
        metadata={"group_id": str(group.id), "before": before},
    )

    await record_family_group_activity(
        db,
        group_id=group.id,
        event_type=FamilyGroupActivityType.group_archived,
        actor_user_id=user.id,
    )

    return await serialize_family_group(db, group, viewer_user_id=user.id)


async def upload_family_group_avatar(
    db: AsyncSession,
    *,
    group_id: UUID,
    user: User,
    filename: str,
    mime_type: str,
    content: bytes,
    ip: str | None = None,
) -> dict[str, object]:
    group, _membership = await require_group_head(db, group_id=group_id, user_id=user.id)

    try:
        uploaded = await upload_user_document(
            db,
            user=user,
            doc_type=DocumentType.family_group_avatar,
            filename=filename,
            mime_type=mime_type,
            content=content,
            ip=ip,
        )
    except DocumentError as exc:
        raise FamilyGroupError(exc.code, exc.message, status_code=exc.status_code) from exc

    group.avatar_document_id = uploaded["id"]
    await db.flush()
    await db.refresh(group)

    await write_audit(
        db,
        event_type=AuditEventType.family_group_updated,
        user_id=user.id,
        ip=ip,
        metadata={
            "group_id": str(group.id),
            "avatar_document_id": str(uploaded["id"]),
            "action": "avatar_updated",
        },
    )

    return await serialize_family_group(db, group, viewer_user_id=user.id)


async def list_group_members_preview(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
) -> list[dict[str, object]]:
    _group, viewer_membership = await require_group_member(db, group_id=group_id, user_id=user_id)
    can_view_details = viewer_membership.role == FamilyGroupMemberRole.head

    result = await db.execute(
        select(FamilyGroupMember, User)
        .join(User, User.id == FamilyGroupMember.user_id)
        .where(
            FamilyGroupMember.group_id == group_id,
            FamilyGroupMember.status == FamilyGroupMemberStatus.active,
        )
        .order_by(FamilyGroupMember.joined_at.asc())
    )

    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    rows = list(result.all())
    user_ids = [user_row.id for _member, user_row in rows]
    profile_images = await resolve_profile_image_urls_by_user_id(db, user_ids)
    insights = await load_member_insights(db, user_ids)
    contribution_totals = await load_member_goal_contribution_totals(db, group_id=group_id, user_ids=user_ids)
    linked_sip_counts = await load_member_linked_sip_counts(db, group_id=group_id, user_ids=user_ids)

    members: list[dict[str, object]] = []
    for member, user_row in rows:
        display_name = resolve_member_display_name(member, user_row)
        member_insights = insights.get(user_row.id, {"kyc_completed": False, "has_invested": False})
        kyc_completed = bool(member_insights["kyc_completed"])
        has_invested = bool(member_insights["has_invested"])
        if can_view_details:
            email = user_row.email
            phone = user_row.phone
            zynd_id = user_row.client_id
            details_masked = False
            contribution_total = contribution_totals.get(user_row.id, Decimal("0"))
            contribution_amount = float(contribution_total) if contribution_total > 0 else None
            group_sip_count = linked_sip_counts.get(user_row.id, 0)
        else:
            email = mask_member_email(user_row.email) or MASKED_DETAIL_PLACEHOLDER
            phone = mask_member_phone(user_row.phone) or MASKED_DETAIL_PLACEHOLDER
            zynd_id = mask_member_zynd_id(user_row.client_id) or MASKED_DETAIL_PLACEHOLDER
            details_masked = True
            contribution_amount = None
            group_sip_count = None

        members.append(
            {
                "user_id": user_row.id,
                "display_name": display_name,
                "display_nickname": member.display_nickname,
                "role": member.role.value,
                "badge_key": member.badge_key,
                "badge_label": member.badge_label,
                "profile_image_url": profile_images.get(user_row.id),
                "joined_at": member.joined_at,
                "kyc_completed": kyc_completed,
                "has_invested": has_invested,
                "email": email,
                "phone": phone,
                "zynd_id": zynd_id,
                "details_masked": details_masked,
                "contribution_amount": contribution_amount,
                "group_sip_count": group_sip_count,
            }
        )
    return members
