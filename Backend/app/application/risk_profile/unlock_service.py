from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.audit_service import write_audit
from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.application.risk_profile.attempt_service import grant_additional_attempts
from app.application.risk_profile.constants import (
    RISK_PROFILE_UNLOCK_BONUS_ATTEMPTS,
    RISK_PROFILE_UNLOCK_OTP_PURPOSE,
)
from app.application.risk_profile.errors import RiskProfileError
from app.infrastructure.otp.service import OtpCooldownError, OtpRateLimitError, generate_otp, verify_otp
from app.infrastructure.persistence.models import AuditEventType, User
from app.infrastructure.persistence.risk_profile_models import RiskProfileUnlockGrant


async def request_unlock_otp(
    db: AsyncSession,
    *,
    target_user: User,
    admin: User,
    ip: str | None,
) -> dict[str, int]:
    identifier = str(target_user.id)
    try:
        code = await generate_otp(RISK_PROFILE_UNLOCK_OTP_PURPOSE, identifier, ip=ip)
    except OtpCooldownError as exc:
        raise RiskProfileError("otp_cooldown", exc.args[0], status_code=429) from exc
    except OtpRateLimitError as exc:
        raise RiskProfileError("otp_rate_limited", str(exc), status_code=429) from exc

    schedule_user_notification(
        user_id=target_user.id,
        user_email=target_user.email,
        notification_type=NotificationType.INVEST_RISK_PROFILE_UNLOCK_OTP,
        title="Risk profile unlock code",
        body=(
            f"An administrator requested to unlock your risk profile attempts. "
            f"Share this code with them: {code}. It expires in 10 minutes."
        ),
        metadata={
            "admin_id": str(admin.id),
            "purpose": RISK_PROFILE_UNLOCK_OTP_PURPOSE,
        },
        idempotency_key=f"invest.risk_profile.unlock_otp:{target_user.id}:{admin.id}",
        email_subject=None,
    )

    await write_audit(
        db,
        event_type=AuditEventType.admin_action_requested,
        user_id=target_user.id,
        ip=ip,
        metadata={
            "action": "risk_profile_unlock_otp_requested",
            "admin_id": str(admin.id),
            "target_user_id": str(target_user.id),
        },
    )

    return {"expires_in": 600}


async def confirm_unlock_otp(
    db: AsyncSession,
    *,
    target_user: User,
    admin: User,
    code: str,
    ip: str | None,
) -> dict[str, object]:
    identifier = str(target_user.id)
    verified = await verify_otp(RISK_PROFILE_UNLOCK_OTP_PURPOSE, identifier, code)
    if not verified:
        await write_audit(
            db,
            event_type=AuditEventType.admin_action_requested,
            user_id=target_user.id,
            ip=ip,
            metadata={
                "action": "risk_profile_unlock_otp_failed",
                "admin_id": str(admin.id),
                "target_user_id": str(target_user.id),
            },
        )
        await db.flush()
        raise RiskProfileError("invalid_unlock_otp", "The unlock code is invalid or expired.", status_code=400)

    attempts = RISK_PROFILE_UNLOCK_BONUS_ATTEMPTS
    attempt_state = await grant_additional_attempts(db, user_id=target_user.id, attempts=attempts)
    db.add(
        RiskProfileUnlockGrant(
            user_id=target_user.id,
            admin_id=admin.id,
            attempts_granted=attempts,
        )
    )
    await db.flush()

    await write_audit(
        db,
        event_type=AuditEventType.risk_profile_unlock_granted,
        user_id=target_user.id,
        ip=ip,
        metadata={
            "admin_id": str(admin.id),
            "attempts_granted": attempts,
            "granted_attempts": attempt_state["granted_attempts"],
            "attempts_remaining": attempt_state["attempts_remaining"],
        },
    )

    return attempt_state
