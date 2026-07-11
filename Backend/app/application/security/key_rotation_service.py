from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.infrastructure.persistence.models import UserMfaSecret
from app.infrastructure.security.field_encryption import PIIFieldType, current_key_version, decrypt_field, encrypt_field


async def rotate_mfa_secrets_to_current_version(db: AsyncSession) -> dict[str, int]:
    settings = get_settings()
    target_version = current_key_version(PIIFieldType.mfa_totp)
    result = await db.execute(select(UserMfaSecret))
    rows = list(result.scalars())

    rotated = 0
    skipped = 0
    for row in rows:
        if row.secret_key_version == target_version:
            skipped += 1
            continue

        plaintext = decrypt_field(
            row.secret_ciphertext,
            PIIFieldType.mfa_totp,
            row.secret_key_version,
        )
        ciphertext, version = encrypt_field(
            plaintext,
            PIIFieldType.mfa_totp,
            key_version=target_version,
        )
        row.secret_ciphertext = ciphertext
        row.secret_key_version = version
        rotated += 1

    await db.flush()
    return {
        "target_version": target_version,
        "rotated": rotated,
        "skipped": skipped,
        "total": len(rows),
        "available_versions": sorted(settings.resolved_mfa_encryption_keys),
    }
