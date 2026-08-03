from __future__ import annotations

import secrets
from datetime import datetime, timezone
from uuid import UUID

import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.infrastructure.persistence.models import User, UserBackupCode, UserMfaSecret
from app.infrastructure.security.mfa_crypto import decrypt_secret, encrypt_secret
from app.infrastructure.security.passwords import hash_password, verify_password
from app.infrastructure.security.pending_auth import generate_backup_codes


def _now() -> datetime:
    return datetime.now(timezone.utc)


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def build_provisioning_uri(secret: str, email: str, issuer: str = "ZYND") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)


def verify_totp_code(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code.strip(), valid_window=1)


async def get_user_totp_secret(db: AsyncSession, user_id: UUID) -> str | None:
    result = await db.execute(select(UserMfaSecret).where(UserMfaSecret.user_id == user_id))
    row = result.scalar_one_or_none()
    if not row:
        return None
    return decrypt_secret(row.secret_ciphertext, row.secret_key_version)


async def save_pending_mfa_enrollment(
    db: AsyncSession,
    *,
    user_id: UUID,
    secret: str,
) -> None:
    result = await db.execute(select(UserMfaSecret).where(UserMfaSecret.user_id == user_id))
    existing = result.scalar_one_or_none()
    ciphertext, version = encrypt_secret(secret)
    if existing:
        existing.secret_ciphertext = ciphertext
        existing.secret_key_version = version
    else:
        db.add(
            UserMfaSecret(
                user_id=user_id,
                secret_ciphertext=ciphertext,
                secret_key_version=version,
            )
        )


async def issue_backup_codes(db: AsyncSession, *, user_id: UUID) -> list[str]:
    await db.execute(
        UserBackupCode.__table__.delete().where(UserBackupCode.user_id == user_id)
    )
    plain_codes = generate_backup_codes()
    for code in plain_codes:
        db.add(UserBackupCode(user_id=user_id, code_hash=hash_password(code)))
    await db.flush()
    return plain_codes


async def confirm_mfa_enrollment(
    db: AsyncSession,
    *,
    user: User,
    secret: str,
    totp_code: str,
) -> list[str]:
    if not verify_totp_code(secret, totp_code):
        raise ValueError("invalid_totp")

    await save_pending_mfa_enrollment(db, user_id=user.id, secret=secret)
    user.mfa_enrolled_at = _now()
    return await issue_backup_codes(db, user_id=user.id)


async def get_backup_codes_status(db: AsyncSession, user_id: UUID) -> dict[str, int]:
    result = await db.execute(
        select(UserBackupCode).where(UserBackupCode.user_id == user_id)
    )
    rows = list(result.scalars())
    remaining = sum(1 for row in rows if row.used_at is None)
    total = len(rows)
    return {"total": total, "remaining": remaining, "used": total - remaining}


async def regenerate_backup_codes(db: AsyncSession, user: User) -> list[str]:
    if not user_has_mfa(user):
        raise ValueError("mfa_not_enrolled")
    return await issue_backup_codes(db, user_id=user.id)


async def rotate_mfa_enrollment(
    db: AsyncSession,
    *,
    user: User,
    secret: str,
    totp_code: str,
) -> list[str]:
    if not verify_totp_code(secret, totp_code):
        raise ValueError("invalid_totp")

    await save_pending_mfa_enrollment(db, user_id=user.id, secret=secret)
    user.mfa_enrolled_at = _now()
    return await issue_backup_codes(db, user_id=user.id)


async def verify_user_totp(db: AsyncSession, user: User, code: str) -> bool:
    secret = await get_user_totp_secret(db, user.id)
    if not secret:
        return False
    return verify_totp_code(secret, code)


async def verify_user_backup_code(db: AsyncSession, user: User, code: str) -> bool:
    normalized = code.strip().upper().replace("-", "")
    result = await db.execute(
        select(UserBackupCode).where(
            UserBackupCode.user_id == user.id,
            UserBackupCode.used_at.is_(None),
        )
    )
    for row in result.scalars():
        if verify_password(row.code_hash, normalized):
            row.used_at = _now()
            return True
    return False


def user_has_mfa(user: User) -> bool:
    return user.mfa_enrolled_at is not None


def user_fund_eligible(user: User) -> bool:
    from app.application.auth.fund_movement_policy_service import (
        evaluate_fund_eligibility_with_policy,
    )

    result = evaluate_fund_eligibility_with_policy(
        user,
        require_mfa=False,
        require_pin=False,
    )
    return result["eligible"]
