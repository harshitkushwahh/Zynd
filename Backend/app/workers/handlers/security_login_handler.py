from __future__ import annotations

from app.application.auth.security_review_service import create_security_review_item
from app.application.notifications.notification_service import enqueue_user_notification
from app.application.notifications.types import NotificationType
from app.core.database import AsyncSessionLocal
from app.domain.auth.events import (
    LoginFailedPayload,
    LoginSucceededPayload,
    RefreshReuseDetectedPayload,
    SecurityReviewFlaggedPayload,
)
from app.domain.shared.event_factory import parse_event_payload
from app.domain.shared.events import DomainEvent
from app.infrastructure.persistence.models import SecurityReviewReason
from app.infrastructure.persistence.repositories.user_repository import SqlAlchemyUserRepository
from app.workers.handlers.email_handler import deliver_security_email


async def handle_login_failed(event: DomainEvent) -> None:
    payload = parse_event_payload(event, LoginFailedPayload)
    if not payload.user_id:
        return

    ip_label = payload.ip or "Unknown"
    await enqueue_user_notification(
        user_id=payload.user_id,
        user_email=payload.email,
        notification_type=NotificationType.AUTH_LOGIN_FAILED,
        title="Failed sign-in attempt",
        body=(
            f"A failed sign-in attempt was made on your ZYND account.\n\n"
            f"IP address: {ip_label}\n\n"
            "If this wasn't you, change your password and review active sessions in Settings."
        ),
        metadata={"ip": payload.ip, "reason": payload.reason},
        idempotency_key=f"auth.login.failed:{event.event_id}",
        email_subject="Failed sign-in attempt on your ZYND account",
    )


async def handle_login_succeeded(event: DomainEvent) -> None:
    payload = parse_event_payload(event, LoginSucceededPayload)
    user_id = payload.user_id
    is_new_device = payload.is_new_device
    velocity_flag = payload.velocity_flag
    ip = payload.ip
    device_label = payload.device_label or "Unknown device"
    to_email = payload.email

    if is_new_device or velocity_flag:
        async with AsyncSessionLocal() as db:
            user = await SqlAlchemyUserRepository(db).get_by_id(user_id)
            if not user:
                return
            to_email = to_email or user.email

            if is_new_device:
                await create_security_review_item(
                    db,
                    user_id=user.id,
                    reason=SecurityReviewReason.new_device_login,
                    metadata={
                        "device_id": str(payload.device_id),
                        "device_label": device_label,
                        "ip": ip,
                    },
                )

            if velocity_flag:
                await create_security_review_item(
                    db,
                    user_id=user.id,
                    reason=SecurityReviewReason.login_velocity_flagged,
                    metadata=velocity_flag,
                )
            await db.commit()

        if is_new_device:
            await deliver_security_email(
                to_email=to_email,
                subject="New sign-in to your ZYND account",
                body=(
                    f"A new device signed in to your ZYND account.\n\n"
                    f"Device: {device_label}\n"
                    f"IP address: {ip or 'Unknown'}\n\n"
                    f"If this wasn't you, change your password and review active sessions in Settings."
                ),
            )

        if velocity_flag:
            await deliver_security_email(
                to_email=to_email,
                subject="Unusual sign-in activity on your ZYND account",
                body=(
                    "We detected a sign-in that looks geographically unusual for your account.\n\n"
                    f"Distance: {velocity_flag.get('distance_km')} km in "
                    f"{velocity_flag.get('elapsed_minutes')} minutes "
                    f"({velocity_flag.get('speed_kmh')} km/h).\n"
                    f"From: {velocity_flag.get('previous_country') or 'Unknown'} "
                    f"({velocity_flag.get('previous_ip') or 'Unknown'})\n"
                    f"To: {velocity_flag.get('current_country') or 'Unknown'} "
                    f"({velocity_flag.get('current_ip') or 'Unknown'})\n\n"
                    "If this wasn't you, secure your account immediately."
                ),
            )
    elif not to_email:
        async with AsyncSessionLocal() as db:
            user = await SqlAlchemyUserRepository(db).get_by_id(user_id)
            if user:
                to_email = user.email

    notification_type = NotificationType.AUTH_NEW_DEVICE if is_new_device else NotificationType.AUTH_LOGIN_SUCCEEDED
    title = "New device signed in" if is_new_device else "Signed in to ZYND"
    method_label = {
        "sms": "mobile verification code",
        "authenticator": "authenticator app",
        "backup": "backup code",
        "oauth": "linked sign-in provider",
    }.get(payload.login_method or "", "password")
    body = (
        f"A new device signed in to your ZYND account using {method_label}.\n\n"
        f"Device: {device_label}\nIP address: {ip or 'Unknown'}"
        if is_new_device
        else f"You signed in to ZYND from {device_label} using {method_label}.\nIP address: {ip or 'Unknown'}"
    )
    await enqueue_user_notification(
        user_id=user_id,
        user_email=to_email or "",
        notification_type=notification_type,
        title=title,
        body=body,
        metadata={
            "device_id": str(payload.device_id),
            "device_label": device_label,
            "ip": ip,
            "is_new_device": is_new_device,
            "login_method": payload.login_method,
        },
        idempotency_key=f"{notification_type.value}:{event.event_id}",
    )


async def handle_security_review_flagged(event: DomainEvent) -> None:
    payload = parse_event_payload(event, SecurityReviewFlaggedPayload)
    reason = SecurityReviewReason(payload.reason)

    async with AsyncSessionLocal() as db:
        await create_security_review_item(
            db,
            user_id=payload.user_id,
            reason=reason,
            metadata=payload.metadata,
        )
        await db.commit()


async def handle_refresh_reuse_detected(event: DomainEvent) -> None:
    payload = parse_event_payload(event, RefreshReuseDetectedPayload)
    to_email = payload.email
    if not to_email or to_email.startswith("deleted+"):
        return

    body = (
        "We detected a reused sign-in session token and revoked active sessions "
        "linked to that device chain for your protection.\n\n"
        "If this wasn't you, sign in again and change your password immediately."
    )
    await enqueue_user_notification(
        user_id=payload.user_id,
        user_email=to_email,
        notification_type=NotificationType.AUTH_REFRESH_REUSE,
        title="Security alert: session reuse detected",
        body=body,
        idempotency_key=f"auth.refresh_reuse:{event.event_id}",
        email_subject="ZYND security alert: sign-in activity",
    )
