"""Family group invite notifications."""

from __future__ import annotations

from uuid import UUID

from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.application.referral.referral_notification_service import mask_referee_email
from app.infrastructure.persistence.models import User


def _display_name(user: User) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(part for part in parts if part).strip()
    return name or mask_referee_email(user.email)


def notify_family_invite_received(
    *,
    invitee: User,
    inviter: User,
    group_title: str,
    invite_id: UUID,
    invite_token: str,
    intended_role: str,
) -> None:
    schedule_user_notification(
        user_id=invitee.id,
        user_email=invitee.email,
        notification_type=NotificationType.FAMILY_INVITE_RECEIVED,
        title="Family group invitation",
        body=(
            f"{_display_name(inviter)} invited you to join {group_title} as {intended_role}.\n"
            "Open Zynd to accept or decline."
        ),
        metadata={
            "group_title": group_title,
            "inviter_user_id": str(inviter.id),
            "invite_id": str(invite_id),
            "invite_token": invite_token,
            "intended_role": intended_role,
        },
        idempotency_key=f"family.invite.received:{invite_id}",
        email_subject=f"You're invited to join {group_title} on Zynd",
    )


def notify_family_invite_accepted(
    *,
    head: User,
    invitee: User,
    group_title: str,
    invite_id: UUID,
) -> None:
    schedule_user_notification(
        user_id=head.id,
        user_email=head.email,
        notification_type=NotificationType.FAMILY_INVITE_ACCEPTED,
        title="Family invite accepted",
        body=f"{_display_name(invitee)} joined {group_title}.",
        metadata={
            "group_title": group_title,
            "invitee_user_id": str(invitee.id),
            "invite_id": str(invite_id),
        },
        idempotency_key=f"family.invite.accepted:{invite_id}",
        email_subject=f"{_display_name(invitee)} joined your family group",
    )


def notify_family_invite_declined(
    *,
    head: User,
    invitee: User,
    group_title: str,
    invite_id: UUID,
) -> None:
    schedule_user_notification(
        user_id=head.id,
        user_email=head.email,
        notification_type=NotificationType.FAMILY_INVITE_DECLINED,
        title="Family invite declined",
        body=f"{_display_name(invitee)} declined your invitation to {group_title}.",
        metadata={
            "group_title": group_title,
            "invitee_user_id": str(invitee.id),
            "invite_id": str(invite_id),
        },
        idempotency_key=f"family.invite.declined:{invite_id}",
        email_subject=f"Your family group invite was declined",
    )


def notify_family_member_removed(
    *,
    member: User,
    group_title: str,
    group_id: UUID,
    removed_by: User,
) -> None:
    schedule_user_notification(
        user_id=member.id,
        user_email=member.email,
        notification_type=NotificationType.FAMILY_MEMBER_REMOVED,
        title="Removed from family group",
        body=f"You were removed from {group_title} by {_display_name(removed_by)}.",
        metadata={
            "group_id": str(group_id),
            "group_title": group_title,
            "removed_by_user_id": str(removed_by.id),
        },
        idempotency_key=f"family.member.removed:{group_id}:{member.id}",
        email_subject=f"You were removed from {group_title}",
    )


def notify_family_member_role_changed(
    *,
    member: User,
    group_title: str,
    group_id: UUID,
    new_role: str,
) -> None:
    schedule_user_notification(
        user_id=member.id,
        user_email=member.email,
        notification_type=NotificationType.FAMILY_MEMBER_ROLE_CHANGED,
        title="Family group role updated",
        body=f"Your role in {group_title} is now {new_role}.",
        metadata={
            "group_id": str(group_id),
            "group_title": group_title,
            "new_role": new_role,
        },
        idempotency_key=f"family.member.role_changed:{group_id}:{member.id}:{new_role}",
        email_subject=f"Your role in {group_title} was updated",
    )


def notify_family_head_transferred(
    *,
    former_head: User,
    new_head: User,
    group_title: str,
    group_id: UUID,
) -> None:
    schedule_user_notification(
        user_id=new_head.id,
        user_email=new_head.email,
        notification_type=NotificationType.FAMILY_HEAD_TRANSFERRED,
        title="You are now the group head",
        body=f"{_display_name(former_head)} made you head of {group_title}.",
        metadata={
            "group_id": str(group_id),
            "group_title": group_title,
            "former_head_user_id": str(former_head.id),
        },
        idempotency_key=f"family.head.transferred:{group_id}:{new_head.id}",
        email_subject=f"You are now head of {group_title}",
    )


def notify_family_invite_reminder(
    *,
    invitee: User,
    inviter: User,
    group_title: str,
    invite_id: UUID,
    invite_token: str,
    intended_role: str,
) -> None:
    schedule_user_notification(
        user_id=invitee.id,
        user_email=invitee.email,
        notification_type=NotificationType.FAMILY_INVITE_REMINDER,
        title="Family group invitation reminder",
        body=(
            f"Reminder: {_display_name(inviter)} invited you to join {group_title} as {intended_role}.\n"
            "Open Zynd to accept or decline."
        ),
        metadata={
            "group_title": group_title,
            "inviter_user_id": str(inviter.id),
            "invite_id": str(invite_id),
            "invite_token": invite_token,
            "intended_role": intended_role,
        },
        idempotency_key=f"family.invite.reminder:{invite_id}",
        email_subject=f"Reminder: join {group_title} on Zynd",
    )
