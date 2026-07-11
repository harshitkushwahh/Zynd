"""Schedule referral milestone notifications for referrers (Phase 4)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.notifications.notification_service import schedule_user_notification
from app.application.notifications.types import NotificationType
from app.infrastructure.persistence.models import User
from app.infrastructure.persistence.referral_models import (
    ReferralAttribution,
    ReferralInvestmentProduct,
)


def mask_referee_email(email: str) -> str:
    local, separator, domain = email.partition("@")
    if not separator or not domain:
        return "***"
    if len(local) <= 1:
        masked_local = f"{local}***" if local else "*"
    else:
        masked_local = f"{local[0]}***"
    return f"{masked_local}@{domain}"


def _referee_label(referee: User) -> str:
    return mask_referee_email(referee.email)


def _schedule_for_referrer(
    *,
    referrer: User,
    notification_type: NotificationType,
    title: str,
    body: str,
    idempotency_key: str,
    email_subject: str,
    metadata: dict[str, str] | None = None,
) -> None:
    schedule_user_notification(
        user_id=referrer.id,
        user_email=referrer.email,
        notification_type=notification_type,
        title=title,
        body=body,
        metadata=metadata,
        idempotency_key=idempotency_key,
        email_subject=email_subject,
    )


async def notify_referrer_signup(
    db: AsyncSession,
    *,
    referrer: User,
    referee: User,
    attribution: ReferralAttribution,
) -> None:
    _schedule_for_referrer(
        referrer=referrer,
        notification_type=NotificationType.REFERRAL_USER_SIGNED_UP,
        title="New referral signup",
        body=(
            f"Someone signed up using your referral link ({_referee_label(referee)}).\n"
            "You'll be notified when they complete KYC."
        ),
        metadata={
            "referee_user_id": str(referee.id),
            "referral_code": attribution.referral_code,
            "attribution_id": str(attribution.id),
        },
        idempotency_key=f"referral.user.signed_up:{attribution.id}",
        email_subject="New signup from your ZYND referral link",
    )


async def notify_referrer_kyc_verified(
    db: AsyncSession,
    *,
    referrer: User,
    referee: User,
    attribution: ReferralAttribution,
) -> None:
    _schedule_for_referrer(
        referrer=referrer,
        notification_type=NotificationType.REFERRAL_KYC_VERIFIED,
        title="Referral completed KYC",
        body=(
            f"{_referee_label(referee)} completed KYC verification through your referral link.\n"
            "You'll be notified when they make their first investment."
        ),
        metadata={
            "referee_user_id": str(referee.id),
            "attribution_id": str(attribution.id),
        },
        idempotency_key=f"referral.kyc.verified:{attribution.id}",
        email_subject="Your referral completed KYC on ZYND",
    )


async def notify_referrer_first_investment(
    db: AsyncSession,
    *,
    referrer: User,
    referee: User,
    attribution: ReferralAttribution,
    product: ReferralInvestmentProduct,
    amount_inr: int,
) -> None:
    product_label = product.value.replace("_", " ")
    _schedule_for_referrer(
        referrer=referrer,
        notification_type=NotificationType.REFERRAL_FIRST_INVESTMENT,
        title="Referral made first investment",
        body=(
            f"{_referee_label(referee)} made their first investment "
            f"({product_label}, ₹{amount_inr:,}) through your referral link.\n"
            "Qualification rewards unlock after the hold period."
        ),
        metadata={
            "referee_user_id": str(referee.id),
            "attribution_id": str(attribution.id),
            "product": product.value,
            "amount_inr": str(amount_inr),
        },
        idempotency_key=f"referral.first_investment:{attribution.id}",
        email_subject="Your referral made their first investment",
    )


async def notify_referrer_qualified(
    db: AsyncSession,
    *,
    referrer: User,
    referee: User,
    attribution: ReferralAttribution,
) -> None:
    _schedule_for_referrer(
        referrer=referrer,
        notification_type=NotificationType.REFERRAL_QUALIFIED,
        title="Referral qualified",
        body=(
            f"{_referee_label(referee)} is now a qualified referral.\n"
            "Any applicable referral rewards will be processed according to program terms."
        ),
        metadata={
            "referee_user_id": str(referee.id),
            "attribution_id": str(attribution.id),
        },
        idempotency_key=f"referral.qualified:{attribution.id}",
        email_subject="Your ZYND referral is now qualified",
    )


async def notify_referrer_engaged(
    db: AsyncSession,
    *,
    referrer: User,
    referee: User,
    attribution: ReferralAttribution,
) -> None:
    _schedule_for_referrer(
        referrer=referrer,
        notification_type=NotificationType.REFERRAL_ENGAGED,
        title="Referral reached engaged status",
        body=(
            f"{_referee_label(referee)} reached engaged status in your referral network.\n"
            "Keep sharing your link to grow your referrals."
        ),
        metadata={
            "referee_user_id": str(referee.id),
            "attribution_id": str(attribution.id),
        },
        idempotency_key=f"referral.engaged:{attribution.id}",
        email_subject="Your ZYND referral is now engaged",
    )


__all__ = [
    "notify_referrer_engaged",
    "notify_referrer_first_investment",
    "notify_referrer_kyc_verified",
    "notify_referrer_qualified",
    "notify_referrer_signup",
]
