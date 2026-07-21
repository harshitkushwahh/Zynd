from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.display import require_group_member
from app.application.referral.referral_notification_service import mask_referee_email
from app.infrastructure.persistence.family_group_models import (
    FamilyGroupActivity,
    FamilyGroupActivityType,
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
        email = metadata.get("invitee_email_masked") or "someone"
        role = _format_role_label(str(metadata.get("role", "viewer")))
        return f"{actor} invited {email} as {role}"
    if event_type == FamilyGroupActivityType.invite_accepted:
        return f"{target} accepted the invitation"
    if event_type == FamilyGroupActivityType.invite_declined:
        return f"{target} declined the invitation"
    if event_type == FamilyGroupActivityType.invite_revoked:
        email = metadata.get("invitee_email_masked") or "a pending invite"
        return f"{actor} revoked the invitation for {email}"
    if event_type == FamilyGroupActivityType.group_updated:
        return f"{actor} updated group details"
    if event_type == FamilyGroupActivityType.group_archived:
        return f"{actor} archived the group"
    if event_type == FamilyGroupActivityType.head_transferred:
        return f"{actor} made {target} the group head"
    if event_type == FamilyGroupActivityType.nominee_suggested_from_kyc:
        name = metadata.get("nominee_name") or target_label or "a nominee"
        return f"{actor} invited KYC nominee {name} to the group"
    return "Group activity updated"


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


async def list_family_group_activity(
    db: AsyncSession,
    *,
    group_id: UUID,
    user_id: UUID,
    cursor: UUID | None = None,
    limit: int = 20,
) -> dict[str, object]:
    await require_group_member(db, group_id=group_id, user_id=user_id)

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

    payload: list[dict[str, object]] = []
    for activity in items:
        payload.append(
            {
                "id": activity.id,
                "event_type": activity.event_type.value,
                "message": activity.message,
                "actor_user_id": activity.actor_user_id,
                "target_user_id": activity.target_user_id,
                "metadata": activity.metadata_json or {},
                "created_at": activity.created_at,
            }
        )

    return {
        "items": payload,
        "next_cursor": str(items[-1].id) if has_more and items else None,
        "has_more": has_more,
    }
