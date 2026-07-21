from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.display import require_group_member, resolve_member_display_name
from app.application.referral.referral_notification_service import mask_referee_email
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupActivity,
    FamilyGroupActivityType,
    FamilyGroupInvite,
    FamilyGroupMember,
    FamilyGroupMemberRole,
    FamilyGroupMemberStatus,
)
from app.infrastructure.persistence.models import User


def _format_role_label(role: str) -> str:
    return role.replace("_", " ").capitalize()


async def _user_label(db: AsyncSession, user_id: UUID | None) -> str | None:
    if not user_id:
        return None
    user = await db.get(User, user_id)
    if not user:
        return None
    parts = [user.first_name, user.last_name]
    name = " ".join(part for part in parts if part).strip()
    return name or mask_referee_email(user.email)


def build_activity_message(
    event_type: FamilyGroupActivityType,
    *,
    actor_label: str | None = None,
    target_label: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str:
    metadata = metadata or {}
    actor = actor_label or "Someone"
    target = target_label or "A member"

    if event_type == FamilyGroupActivityType.member_joined:
        role = _format_role_label(str(metadata.get("role", "member")))
        return f"{target} joined as {role}"
    if event_type == FamilyGroupActivityType.member_left:
        return f"{target} left the group"
    if event_type == FamilyGroupActivityType.member_removed:
        return f"{actor} removed {target}"
    if event_type == FamilyGroupActivityType.role_changed:
        role = _format_role_label(str(metadata.get("role", "member")))
        return f"{actor} changed {target}'s role to {role}"
    if event_type == FamilyGroupActivityType.badge_changed:
        badge = metadata.get("badge_label") or metadata.get("badge_key") or "updated"
        return f"{actor} updated {target}'s badge to {badge}"
    if event_type == FamilyGroupActivityType.nickname_changed:
        nickname = metadata.get("nickname") or target
        if actor_label and target_label and actor_label == target_label:
            return f"{target} updated their nickname to {nickname}"
        return f"{actor} set {target}'s nickname to {nickname}"
    if event_type == FamilyGroupActivityType.invite_sent:
        email = (
            metadata.get("invitee_email")
            or metadata.get("invitee_email_masked")
            or "someone"
        )
        role = _format_role_label(str(metadata.get("role", "viewer")))
        return f"{actor} invited {email} as {role}"
    if event_type == FamilyGroupActivityType.invite_accepted:
        return f"{target} accepted the invitation"
    if event_type == FamilyGroupActivityType.invite_declined:
        return f"{target} declined the invitation"
    if event_type == FamilyGroupActivityType.invite_revoked:
        email = (
            metadata.get("invitee_email")
            or metadata.get("invitee_email_masked")
            or "a pending invite"
        )
        return f"{actor} withdrew the invitation for {email}"
    if event_type == FamilyGroupActivityType.group_updated:
        return f"{actor} updated group details"
    if event_type == FamilyGroupActivityType.group_archived:
        return f"{actor} archived the group"
    if event_type == FamilyGroupActivityType.head_transferred:
        return f"{actor} made {target} the group head"
    if event_type == FamilyGroupActivityType.nominee_suggested_from_kyc:
        name = metadata.get("nominee_name") or target_label or "a nominee"
        return f"{actor} invited KYC nominee {name} to the group"
    if event_type == FamilyGroupActivityType.goal_created:
        title = metadata.get("goal_title") or "a family goal"
        return f"{actor} created family goal {title}"
    if event_type == FamilyGroupActivityType.goal_updated:
        title = metadata.get("goal_title") or "a family goal"
        return f"{actor} updated family goal {title}"
    if event_type == FamilyGroupActivityType.goal_contribution_added:
        title = metadata.get("goal_title") or "a family goal"
        amount = metadata.get("amount_inr")
        amount_label = f"₹{amount:,.0f}" if isinstance(amount, (int, float)) else "a contribution"
        return f"{actor} contributed {amount_label} to {title}"
    if event_type == FamilyGroupActivityType.goal_archived:
        title = metadata.get("goal_title") or "a family goal"
        return f"{actor} archived family goal {title}"
    return "Group activity updated"


TARGET_SUBJECT_EVENTS = frozenset(
    {
        FamilyGroupActivityType.member_joined,
        FamilyGroupActivityType.invite_accepted,
        FamilyGroupActivityType.invite_declined,
    }
)


def _activity_subject_user_id(activity: FamilyGroupActivity) -> UUID | None:
    if activity.event_type in TARGET_SUBJECT_EVENTS:
        return activity.target_user_id or activity.actor_user_id
    return activity.actor_user_id or activity.target_user_id


async def record_family_group_activity(
    db: AsyncSession,
    *,
    group_id: UUID,
    event_type: FamilyGroupActivityType,
    actor_user_id: UUID | None = None,
    target_user_id: UUID | None = None,
    metadata: dict[str, Any] | None = None,
    message: str | None = None,
) -> FamilyGroupActivity:
    actor_label = await _user_label(db, actor_user_id)
    target_label = await _user_label(db, target_user_id)
    resolved_message = message or build_activity_message(
        event_type,
        actor_label=actor_label,
        target_label=target_label,
        metadata=metadata,
    )
    activity = FamilyGroupActivity(
        group_id=group_id,
        event_type=event_type,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        message=resolved_message,
        metadata_json=metadata,
    )
    db.add(activity)
    await db.flush()
    return activity


async def _resolve_activity_actor_previews(
    db: AsyncSession,
    *,
    group_id: UUID,
    activities: list[FamilyGroupActivity],
) -> dict[UUID, dict[str, object | None]]:
    from app.application.documents.profile_image_url_service import resolve_profile_image_urls_by_user_id

    user_ids: set[UUID] = set()
    for activity in activities:
        if activity.actor_user_id:
            user_ids.add(activity.actor_user_id)
        if activity.target_user_id:
            user_ids.add(activity.target_user_id)
    if not user_ids:
        return {}

    profile_images = await resolve_profile_image_urls_by_user_id(db, list(user_ids))
    member_rows = list(
        (
            await db.execute(
                select(FamilyGroupMember, User)
                .join(User, User.id == FamilyGroupMember.user_id)
                .where(
                    FamilyGroupMember.group_id == group_id,
                    FamilyGroupMember.user_id.in_(user_ids),
                    FamilyGroupMember.status == FamilyGroupMemberStatus.active,
                )
            )
        ).all()
    )
    member_by_user = {user_row.id: (member, user_row) for member, user_row in member_rows}

    previews: dict[UUID, dict[str, object | None]] = {}
    for user_id in user_ids:
        member_entry = member_by_user.get(user_id)
        if member_entry:
            member, user_row = member_entry
            display_name = resolve_member_display_name(member, user_row)
        else:
            display_name = await _user_label(db, user_id)
        previews[user_id] = {
            "display_name": display_name,
            "profile_image_url": profile_images.get(user_id),
            "role": member.role.value if member_entry else None,
        }
    return previews


async def _resolve_invite_emails(
    db: AsyncSession,
    *,
    activities: list[FamilyGroupActivity],
) -> dict[str, str | None]:
    invite_ids: list[UUID] = []
    for activity in activities:
        metadata = activity.metadata_json or {}
        invite_id = metadata.get("invite_id")
        if not invite_id:
            continue
        try:
            invite_ids.append(UUID(str(invite_id)))
        except ValueError:
            continue
    if not invite_ids:
        return {}

    result = await db.execute(select(FamilyGroupInvite).where(FamilyGroupInvite.id.in_(invite_ids)))
    return {str(invite.id): invite.invitee_email for invite in result.scalars().all()}


def _viewer_activity_message(
    activity: FamilyGroupActivity,
    *,
    actor_label: str | None,
    target_label: str | None,
    invite_emails: dict[str, str | None],
    is_head: bool,
) -> str:
    metadata = dict(activity.metadata_json or {})
    invite_id = metadata.get("invite_id")
    if is_head and invite_id:
        full_email = invite_emails.get(str(invite_id))
        if full_email:
            metadata["invitee_email"] = full_email
    else:
        metadata.pop("invitee_email", None)
    return build_activity_message(
        activity.event_type,
        actor_label=actor_label,
        target_label=target_label,
        metadata=metadata,
    )


def _viewer_activity_metadata(
    activity: FamilyGroupActivity,
    *,
    invite_emails: dict[str, str | None],
    is_head: bool,
) -> dict[str, Any]:
    metadata = dict(activity.metadata_json or {})
    invite_id = metadata.get("invite_id")
    if is_head and invite_id:
        full_email = invite_emails.get(str(invite_id))
        if full_email:
            metadata["invitee_email"] = full_email
    else:
        metadata.pop("invitee_email", None)
    return metadata


async def list_family_group_activity(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
    cursor: UUID | None = None,
    limit: int = 20,
) -> dict[str, object]:
    _, membership = await require_group_member(db, group_id=group_id, user_id=user_id)
    is_head = membership.role == FamilyGroupMemberRole.head

    bounded_limit = max(1, min(limit, 50))
    query = (
        select(FamilyGroupActivity)
        .where(FamilyGroupActivity.group_id == group_id)
        .order_by(FamilyGroupActivity.created_at.desc(), FamilyGroupActivity.id.desc())
        .limit(bounded_limit + 1)
    )

    if cursor is not None:
        anchor = await db.get(FamilyGroupActivity, cursor)
        if anchor and anchor.group_id == group_id:
            query = query.where(
                or_(
                    FamilyGroupActivity.created_at < anchor.created_at,
                    and_(
                        FamilyGroupActivity.created_at == anchor.created_at,
                        FamilyGroupActivity.id < anchor.id,
                    ),
                )
            )

    rows = list((await db.execute(query)).scalars().all())
    has_more = len(rows) > bounded_limit
    items = rows[:bounded_limit]
    actor_previews = await _resolve_activity_actor_previews(db, group_id=group_id, activities=items)
    invite_emails = await _resolve_invite_emails(db, activities=items) if is_head else {}

    payload: list[dict[str, object]] = []
    for activity in items:
        actor_preview = actor_previews.get(activity.actor_user_id) if activity.actor_user_id else None
        target_preview = actor_previews.get(activity.target_user_id) if activity.target_user_id else None
        subject_user_id = _activity_subject_user_id(activity)
        subject_preview = actor_previews.get(subject_user_id) if subject_user_id else None
        metadata = _viewer_activity_metadata(activity, invite_emails=invite_emails, is_head=is_head)
        payload.append(
            {
                "id": activity.id,
                "event_type": activity.event_type.value,
                "message": _viewer_activity_message(
                    activity,
                    actor_label=actor_preview["display_name"] if actor_preview else None,
                    target_label=target_preview["display_name"] if target_preview else None,
                    invite_emails=invite_emails,
                    is_head=is_head,
                ),
                "actor_user_id": activity.actor_user_id,
                "target_user_id": activity.target_user_id,
                "actor_display_name": subject_preview["display_name"] if subject_preview else None,
                "actor_profile_image_url": subject_preview["profile_image_url"] if subject_preview else None,
                "actor_role": subject_preview["role"] if subject_preview else None,
                "metadata": metadata,
                "created_at": activity.created_at,
            }
        )

    return {
        "items": payload,
        "next_cursor": str(items[-1].id) if has_more and items else None,
        "has_more": has_more,
    }
