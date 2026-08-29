from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.infrastructure.persistence.notification_models import NotificationCategory


class NotificationType(str, Enum):
    AUTH_LOGIN_SUCCEEDED = "auth.login.succeeded"
    AUTH_LOGIN_FAILED = "auth.login.failed"
    AUTH_NEW_DEVICE = "auth.new_device"
    AUTH_PASSWORD_CHANGED = "auth.password.changed"
    AUTH_EMAIL_CHANGED = "auth.email.changed"
    AUTH_MFA_ENABLED = "auth.mfa.enabled"
    AUTH_MFA_DISABLED = "auth.mfa.disabled"
    AUTH_DEVICE_REVOKED = "auth.device.revoked"
    AUTH_EMAIL_CHANGE_REQUESTED = "auth.email_change.requested"
    AUTH_REFRESH_REUSE = "auth.refresh_reuse.detected"
    AUTH_PIN_SET = "auth.pin.set"
    AUTH_PIN_RESET = "auth.pin.reset"
    KYC_INITIATED = "kyc.initiated"
    KYC_UNDER_REVIEW = "kyc.under_review"
    KYC_COMPLETED = "kyc.completed"
    KYC_REJECTED = "kyc.rejected"
    REFERRAL_USER_SIGNED_UP = "referral.user.signed_up"
    REFERRAL_KYC_VERIFIED = "referral.kyc.verified"
    REFERRAL_FIRST_INVESTMENT = "referral.first_investment"
    REFERRAL_QUALIFIED = "referral.qualified"
    REFERRAL_ENGAGED = "referral.engaged"
    ACCOUNT_SETTINGS_CHANGED = "account.settings.changed"
    ACCOUNT_PROFILE_IMAGE_UPDATED = "account.profile_image.updated"
    INVEST_RISK_PROFILE_COMPLETED = "invest.risk_profile.completed"
    INVEST_RISK_PROFILE_UNLOCK_OTP = "invest.risk_profile.unlock_otp"
    INVEST_MITRA_TXN_RECOMMENDATION = "invest.mitra_txn_recommendation"
    FAMILY_INVITE_RECEIVED = "family.invite.received"
    FAMILY_INVITE_ACCEPTED = "family.invite.accepted"
    FAMILY_INVITE_DECLINED = "family.invite.declined"
    FAMILY_MEMBER_REMOVED = "family.member.removed"
    FAMILY_MEMBER_ROLE_CHANGED = "family.member.role_changed"
    FAMILY_HEAD_TRANSFERRED = "family.head.transferred"
    FAMILY_INVITE_REMINDER = "family.invite.reminder"


@dataclass(frozen=True, slots=True)
class NotificationDefinition:
    notification_type: NotificationType
    category: NotificationCategory
    default_email: bool
    default_in_app: bool
    email_required: bool = False


NOTIFICATION_DEFINITIONS: dict[NotificationType, NotificationDefinition] = {
    NotificationType.AUTH_LOGIN_SUCCEEDED: NotificationDefinition(
        notification_type=NotificationType.AUTH_LOGIN_SUCCEEDED,
        category=NotificationCategory.security,
        default_email=False,
        default_in_app=True,
    ),
    NotificationType.AUTH_LOGIN_FAILED: NotificationDefinition(
        notification_type=NotificationType.AUTH_LOGIN_FAILED,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_NEW_DEVICE: NotificationDefinition(
        notification_type=NotificationType.AUTH_NEW_DEVICE,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=False,
    ),
    NotificationType.AUTH_PASSWORD_CHANGED: NotificationDefinition(
        notification_type=NotificationType.AUTH_PASSWORD_CHANGED,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_EMAIL_CHANGED: NotificationDefinition(
        notification_type=NotificationType.AUTH_EMAIL_CHANGED,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_MFA_ENABLED: NotificationDefinition(
        notification_type=NotificationType.AUTH_MFA_ENABLED,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_MFA_DISABLED: NotificationDefinition(
        notification_type=NotificationType.AUTH_MFA_DISABLED,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_DEVICE_REVOKED: NotificationDefinition(
        notification_type=NotificationType.AUTH_DEVICE_REVOKED,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_EMAIL_CHANGE_REQUESTED: NotificationDefinition(
        notification_type=NotificationType.AUTH_EMAIL_CHANGE_REQUESTED,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_REFRESH_REUSE: NotificationDefinition(
        notification_type=NotificationType.AUTH_REFRESH_REUSE,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.AUTH_PIN_SET: NotificationDefinition(
        notification_type=NotificationType.AUTH_PIN_SET,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=False,
    ),
    NotificationType.AUTH_PIN_RESET: NotificationDefinition(
        notification_type=NotificationType.AUTH_PIN_RESET,
        category=NotificationCategory.security,
        default_email=True,
        default_in_app=True,
        email_required=True,
    ),
    NotificationType.KYC_INITIATED: NotificationDefinition(
        notification_type=NotificationType.KYC_INITIATED,
        category=NotificationCategory.kyc,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.KYC_UNDER_REVIEW: NotificationDefinition(
        notification_type=NotificationType.KYC_UNDER_REVIEW,
        category=NotificationCategory.kyc,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.KYC_COMPLETED: NotificationDefinition(
        notification_type=NotificationType.KYC_COMPLETED,
        category=NotificationCategory.kyc,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.KYC_REJECTED: NotificationDefinition(
        notification_type=NotificationType.KYC_REJECTED,
        category=NotificationCategory.kyc,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.REFERRAL_USER_SIGNED_UP: NotificationDefinition(
        notification_type=NotificationType.REFERRAL_USER_SIGNED_UP,
        category=NotificationCategory.referral,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.REFERRAL_KYC_VERIFIED: NotificationDefinition(
        notification_type=NotificationType.REFERRAL_KYC_VERIFIED,
        category=NotificationCategory.referral,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.REFERRAL_FIRST_INVESTMENT: NotificationDefinition(
        notification_type=NotificationType.REFERRAL_FIRST_INVESTMENT,
        category=NotificationCategory.referral,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.REFERRAL_QUALIFIED: NotificationDefinition(
        notification_type=NotificationType.REFERRAL_QUALIFIED,
        category=NotificationCategory.referral,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.REFERRAL_ENGAGED: NotificationDefinition(
        notification_type=NotificationType.REFERRAL_ENGAGED,
        category=NotificationCategory.referral,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.ACCOUNT_SETTINGS_CHANGED: NotificationDefinition(
        notification_type=NotificationType.ACCOUNT_SETTINGS_CHANGED,
        category=NotificationCategory.account,
        default_email=False,
        default_in_app=True,
    ),
    NotificationType.ACCOUNT_PROFILE_IMAGE_UPDATED: NotificationDefinition(
        notification_type=NotificationType.ACCOUNT_PROFILE_IMAGE_UPDATED,
        category=NotificationCategory.account,
        default_email=False,
        default_in_app=True,
    ),
    NotificationType.INVEST_RISK_PROFILE_COMPLETED: NotificationDefinition(
        notification_type=NotificationType.INVEST_RISK_PROFILE_COMPLETED,
        category=NotificationCategory.account,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.INVEST_RISK_PROFILE_UNLOCK_OTP: NotificationDefinition(
        notification_type=NotificationType.INVEST_RISK_PROFILE_UNLOCK_OTP,
        category=NotificationCategory.security,
        default_email=False,
        default_in_app=True,
    ),
    NotificationType.INVEST_MITRA_TXN_RECOMMENDATION: NotificationDefinition(
        notification_type=NotificationType.INVEST_MITRA_TXN_RECOMMENDATION,
        category=NotificationCategory.account,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.FAMILY_INVITE_RECEIVED: NotificationDefinition(
        notification_type=NotificationType.FAMILY_INVITE_RECEIVED,
        category=NotificationCategory.family,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.FAMILY_INVITE_ACCEPTED: NotificationDefinition(
        notification_type=NotificationType.FAMILY_INVITE_ACCEPTED,
        category=NotificationCategory.family,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.FAMILY_INVITE_DECLINED: NotificationDefinition(
        notification_type=NotificationType.FAMILY_INVITE_DECLINED,
        category=NotificationCategory.family,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.FAMILY_MEMBER_REMOVED: NotificationDefinition(
        notification_type=NotificationType.FAMILY_MEMBER_REMOVED,
        category=NotificationCategory.family,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.FAMILY_MEMBER_ROLE_CHANGED: NotificationDefinition(
        notification_type=NotificationType.FAMILY_MEMBER_ROLE_CHANGED,
        category=NotificationCategory.family,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.FAMILY_HEAD_TRANSFERRED: NotificationDefinition(
        notification_type=NotificationType.FAMILY_HEAD_TRANSFERRED,
        category=NotificationCategory.family,
        default_email=True,
        default_in_app=True,
    ),
    NotificationType.FAMILY_INVITE_REMINDER: NotificationDefinition(
        notification_type=NotificationType.FAMILY_INVITE_REMINDER,
        category=NotificationCategory.family,
        default_email=True,
        default_in_app=True,
    ),
}


DEFAULT_PREFERENCE_CATEGORIES = (
    NotificationCategory.security,
    NotificationCategory.kyc,
    NotificationCategory.referral,
    NotificationCategory.account,
    NotificationCategory.family,
)
