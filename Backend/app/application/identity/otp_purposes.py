from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Literal


class OtpPurpose(str, Enum):
    signup_email = "signup_email"
    signup_mobile = "signup_mobile"
    email_change = "email_change"
    oauth_link = "oauth_link"
    pin_reset = "pin_reset"
    login_second_factor = "login_second_factor"
    step_up_sms = "step_up_sms"
    fund_confirmation = "fund_confirmation"
    partner_onboarding_email = "partner_onboarding_email"
    partner_onboarding_mobile = "partner_onboarding_mobile"
    client_onboarding_email = "client_onboarding_email"
    client_onboarding_mobile = "client_onboarding_mobile"


OtpChannel = Literal["email", "sms"]


@dataclass(frozen=True, slots=True)
class OtpPurposeDefinition:
    purpose: OtpPurpose
    storage_key: str
    channel: OtpChannel
    email_subject: str


OTP_PURPOSE_REGISTRY: dict[OtpPurpose, OtpPurposeDefinition] = {
    OtpPurpose.signup_email: OtpPurposeDefinition(
        purpose=OtpPurpose.signup_email,
        storage_key="email",
        channel="email",
        email_subject="Your ZYND verification code",
    ),
    OtpPurpose.signup_mobile: OtpPurposeDefinition(
        purpose=OtpPurpose.signup_mobile,
        storage_key="mobile",
        channel="sms",
        email_subject="Your ZYND verification code",
    ),
    OtpPurpose.email_change: OtpPurposeDefinition(
        purpose=OtpPurpose.email_change,
        storage_key="email_change",
        channel="email",
        email_subject="Verify your new ZYND email address",
    ),
    OtpPurpose.oauth_link: OtpPurposeDefinition(
        purpose=OtpPurpose.oauth_link,
        storage_key="oauth_link",
        channel="email",
        email_subject="Verify linking your sign-in provider",
    ),
    OtpPurpose.pin_reset: OtpPurposeDefinition(
        purpose=OtpPurpose.pin_reset,
        storage_key="pin_reset",
        channel="email",
        email_subject="Reset your ZYND PIN",
    ),
    OtpPurpose.login_second_factor: OtpPurposeDefinition(
        purpose=OtpPurpose.login_second_factor,
        storage_key="login_second_factor",
        channel="sms",
        email_subject="Your ZYND sign-in code",
    ),
    OtpPurpose.step_up_sms: OtpPurposeDefinition(
        purpose=OtpPurpose.step_up_sms,
        storage_key="step_up_sms",
        channel="sms",
        email_subject="Your ZYND verification code",
    ),
    OtpPurpose.fund_confirmation: OtpPurposeDefinition(
        purpose=OtpPurpose.fund_confirmation,
        storage_key="fund_confirmation",
        channel="sms",
        email_subject="Confirm your ZYND transaction",
    ),
    OtpPurpose.partner_onboarding_email: OtpPurposeDefinition(
        purpose=OtpPurpose.partner_onboarding_email,
        storage_key="partner_onboarding_email",
        channel="email",
        email_subject="Verify Zynd Mitra work email",
    ),
    OtpPurpose.partner_onboarding_mobile: OtpPurposeDefinition(
        purpose=OtpPurpose.partner_onboarding_mobile,
        storage_key="partner_onboarding_mobile",
        channel="sms",
        email_subject="Verify Zynd Mitra mobile",
    ),
    OtpPurpose.client_onboarding_email: OtpPurposeDefinition(
        purpose=OtpPurpose.client_onboarding_email,
        storage_key="client_onboarding_email",
        channel="email",
        email_subject="Verify investor email for Zynd",
    ),
    OtpPurpose.client_onboarding_mobile: OtpPurposeDefinition(
        purpose=OtpPurpose.client_onboarding_mobile,
        storage_key="client_onboarding_mobile",
        channel="sms",
        email_subject="Verify investor mobile for Zynd",
    ),
}

# Backward-compatible storage-key aliases used before Phase 4.
LEGACY_STORAGE_KEY_TO_PURPOSE: dict[str, OtpPurpose] = {
    definition.storage_key: purpose for purpose, definition in OTP_PURPOSE_REGISTRY.items()
}


def get_purpose_definition(purpose: OtpPurpose) -> OtpPurposeDefinition:
    try:
        return OTP_PURPOSE_REGISTRY[purpose]
    except KeyError as exc:
        raise ValueError(f"Unknown OTP purpose: {purpose}") from exc


def resolve_purpose(value: str | OtpPurpose) -> OtpPurpose:
    if isinstance(value, OtpPurpose):
        return value
    if value in LEGACY_STORAGE_KEY_TO_PURPOSE:
        return LEGACY_STORAGE_KEY_TO_PURPOSE[value]
    return OtpPurpose(value)


def build_otp_message(*, purpose: OtpPurpose, code: str) -> str:
    if purpose == OtpPurpose.signup_email:
        return f"Your ZYND email verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.signup_mobile:
        return f"Your ZYND mobile verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.email_change:
        return f"Your ZYND email change verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.oauth_link:
        return f"Your ZYND provider link verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.pin_reset:
        return f"Your ZYND PIN reset code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.login_second_factor:
        return f"Your ZYND sign-in code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.step_up_sms:
        return f"Your ZYND verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.fund_confirmation:
        return f"Your ZYND transaction confirmation code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.partner_onboarding_email:
        return f"Your Zynd Mitra work email verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.partner_onboarding_mobile:
        return f"Your Zynd Mitra mobile verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.client_onboarding_email:
        return f"Your Zynd investor email verification code is {code}. It expires in 10 minutes."
    if purpose == OtpPurpose.client_onboarding_mobile:
        return f"Your Zynd investor mobile verification code is {code}. It expires in 10 minutes."
    return f"Your ZYND verification code is {code}. It expires in 10 minutes."
