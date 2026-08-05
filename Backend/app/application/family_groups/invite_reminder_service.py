from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.family_groups.constants import FAMILY_INVITE_REMINDER_HOURS
from app.application.family_groups.display import now_utc
from app.application.family_groups.family_notification_service import notify_family_invite_reminder
from app.application.family_groups.invite_service import _send_invite_email
from app.infrastructure.persistence.family_group_models import (
    FamilyGroup,
    FamilyGroupInvite,
    FamilyGroupInviteStatus,
)
from app.infrastructure.persistence.family_invite_token_store import create_family_invite_token
from app.infrastructure.persistence.models import User


async def run_family_invite_reminder_batch(
    db: AsyncSession,
    *,
    limit: int = 100,
) -> dict[str, int]:
    now = now_utc()
    reminder_cutoff = now - timedelta(hours=FAMILY_INVITE_REMINDER_HOURS)
    bounded_limit = max(1, min(limit, 500))

    result = await db.execute(
        select(FamilyGroupInvite, FamilyGroup, User)
        .join(FamilyGroup, FamilyGroup.id == FamilyGroupInvite.group_id)
        .join(User, User.id == FamilyGroupInvite.invited_by_user_id)
        .where(
            FamilyGroupInvite.status == FamilyGroupInviteStatus.pending,
            FamilyGroupInvite.reminder_count == 0,
            FamilyGroupInvite.created_at <= reminder_cutoff,
            FamilyGroupInvite.expires_at > now,
        )
        .order_by(FamilyGroupInvite.created_at.asc())
        .limit(bounded_limit)
    )

    sent = 0
    skipped = 0
    for invite, group, inviter in result.all():
        invitee_user = (
            await db.get(User, invite.invitee_user_id) if invite.invitee_user_id else None
        )
        token = await create_family_invite_token(str(invite.id))

        if invitee_user:
            notify_family_invite_reminder(
                invitee=invitee_user,
                inviter=inviter,
                group_title=group.title,
                invite_id=invite.id,
                invite_token=token,
                intended_role=invite.intended_role.value,
            )
        elif invite.invitee_email:
            await _send_invite_email(
                invite=invite,
                token=token,
                group=group,
                inviter=inviter,
                subject_prefix="Reminder: ",
            )
        else:
            skipped += 1
            continue

        invite.reminder_count = 1
        invite.reminder_sent_at = now
        invite.updated_at = now
        sent += 1

    await db.flush()
    return {"sent": sent, "skipped": skipped, "evaluated": sent + skipped}
