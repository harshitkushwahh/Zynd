from __future__ import annotations

from typing import Any

from app.infrastructure.persistence.notification_models import NotificationCategory

SECURITY_SETTINGS_SECTION = "security"
NOTIFICATIONS_SETTINGS_SECTION = "notifications"

NOTIFICATION_TYPE_ROUTES: dict[str, tuple[str, str | None]] = {
    "auth.login.succeeded": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "auth.login.failed": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "auth.new_device": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "auth.password.changed": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "auth.email.changed": ("/dashboard/settings", "email"),
    "auth.email_change.requested": ("/dashboard/settings", "email"),
    "auth.mfa.enabled": ("/dashboard/settings", "mfa"),
    "auth.mfa.disabled": ("/dashboard/settings", "mfa"),
    "auth.device.revoked": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "auth.refresh_reuse.detected": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "auth.pin.set": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "auth.pin.reset": ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    "kyc.initiated": ("/dashboard/kyc", None),
    "kyc.under_review": ("/dashboard/kyc", None),
    "kyc.completed": ("/dashboard/kyc", None),
    "kyc.rejected": ("/dashboard/kyc", None),
    "referral.user.signed_up": ("/dashboard/referral/referrals", None),
    "referral.kyc.verified": ("/dashboard/referral/referrals", None),
    "referral.first_investment": ("/dashboard/referral/referrals", None),
    "referral.qualified": ("/dashboard/referral", None),
    "referral.engaged": ("/dashboard/referral", None),
    "account.settings.changed": ("/dashboard/settings", NOTIFICATIONS_SETTINGS_SECTION),
    "account.profile_image.updated": ("/dashboard/settings", "personal-details"),
    "invest.risk_profile.completed": ("/dashboard/risk-profile", None),
    "invest.risk_profile.unlock_otp": ("/dashboard/notifications", None),
    "invest.mitra_txn_recommendation": ("/dashboard/mutual-funds/recommendation", None),
    "family.invite.received": ("/dashboard/family", None),
    "family.invite.accepted": ("/dashboard/family", None),
    "family.invite.declined": ("/dashboard/family", None),
    "family.member.removed": ("/dashboard/family", None),
    "family.member.role_changed": ("/dashboard/family", None),
    "family.head.transferred": ("/dashboard/family", None),
    "family.invite.reminder": ("/dashboard/family", None),
}

CATEGORY_FALLBACK_ROUTES: dict[NotificationCategory, tuple[str, str | None]] = {
    NotificationCategory.security: ("/dashboard/settings", SECURITY_SETTINGS_SECTION),
    NotificationCategory.kyc: ("/dashboard/kyc", None),
    NotificationCategory.referral: ("/dashboard/referral", None),
    NotificationCategory.account: ("/dashboard/settings", NOTIFICATIONS_SETTINGS_SECTION),
    NotificationCategory.family: ("/dashboard/family", None),
}


def resolve_notification_deep_link_path(
    *,
    notification_type: str,
    category: NotificationCategory,
) -> tuple[str, str | None]:
    explicit = NOTIFICATION_TYPE_ROUTES.get(notification_type)
    if explicit:
        return explicit
    return CATEGORY_FALLBACK_ROUTES.get(category, ("/dashboard/notifications", None))


def build_notification_web_url(
    *,
    frontend_url: str,
    notification_id: str,
    notification_type: str,
    category: NotificationCategory,
    metadata: dict[str, Any] | None = None,
) -> str:
    recommendation_token = (metadata or {}).get("recommendation_token")
    if notification_type == "invest.mitra_txn_recommendation" and recommendation_token:
        base = frontend_url.rstrip("/")
        return (
            f"{base}/dashboard/mutual-funds/recommendation/{recommendation_token}"
            f"?notification_id={notification_id}&notification_type={notification_type}"
        )

    path, settings_section = resolve_notification_deep_link_path(
        notification_type=notification_type,
        category=category,
    )
    base = frontend_url.rstrip("/")
    query_parts = [f"notification_id={notification_id}", f"notification_type={notification_type}"]
    if settings_section:
        query_parts.append(f"section={settings_section}")
    return f"{base}{path}?{'&'.join(query_parts)}"
