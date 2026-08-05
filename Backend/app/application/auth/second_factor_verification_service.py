from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth.errors import AuthError
from app.application.auth.mfa_service import verify_user_backup_code, verify_user_totp
from app.application.identity.otp_app_service import verify_otp
from app.application.identity.otp_purposes import OtpPurpose
from app.infrastructure.persistence.models import User

SecondFactorMethod = Literal["totp", "backup", "sms"]


@dataclass(frozen=True, slots=True)
class SecondFactorVerificationResult:
    verified: bool
    method: SecondFactorMethod | None = None


def _count_provided_factors(
    *,
    totp_code: str | None,
    backup_code: str | None,
    sms_otp: str | None,
) -> int:
    provided = 0
    if totp_code and totp_code.strip():
        provided += 1
    if backup_code and backup_code.strip():
        provided += 1
    if sms_otp and sms_otp.strip():
        provided += 1
    return provided


async def verify_second_factor(
    db: AsyncSession,
    *,
    user: User,
    totp_code: str | None = None,
    backup_code: str | None = None,
    sms_otp: str | None = None,
    sms_purpose: OtpPurpose | None = None,
    sms_identifier: str | None = None,
) -> SecondFactorVerificationResult:
    factor_count = _count_provided_factors(
        totp_code=totp_code,
        backup_code=backup_code,
        sms_otp=sms_otp,
    )
    if factor_count == 0:
        raise AuthError(
            "Provide an authenticator code, backup code, or SMS code.",
            "second_factor_required",
            400,
        )
    if factor_count > 1:
        raise AuthError(
            "Provide only one second-factor method at a time.",
            "invalid_second_factor_payload",
            400,
        )

    normalized_totp = totp_code.strip() if totp_code else None
    normalized_backup = backup_code.strip() if backup_code else None
    normalized_sms = sms_otp.strip() if sms_otp else None

    if normalized_totp:
        verified = await verify_user_totp(db, user, normalized_totp)
        return SecondFactorVerificationResult(verified=verified, method="totp" if verified else None)

    if normalized_backup:
        verified = await verify_user_backup_code(db, user, normalized_backup)
        return SecondFactorVerificationResult(
            verified=verified,
            method="backup" if verified else None,
        )

    if normalized_sms:
        if sms_purpose is None:
            raise AuthError("SMS verification purpose is required.", "invalid_second_factor_payload", 400)
        identifier = sms_identifier or str(user.id)
        verified = await verify_otp(sms_purpose, identifier, normalized_sms)
        return SecondFactorVerificationResult(verified=verified, method="sms" if verified else None)

    return SecondFactorVerificationResult(verified=False, method=None)
