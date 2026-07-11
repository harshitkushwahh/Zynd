from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.compliance.retention_service import can_delete_on_request
from app.infrastructure.persistence.models import EncryptedPIIRecord, PIIFieldTypeEnum
from app.infrastructure.security.field_encryption import PIIFieldType, current_key_version, decrypt_field, encrypt_field


def _to_enum(field_type: PIIFieldType) -> PIIFieldTypeEnum:
    return PIIFieldTypeEnum(field_type.value)


async def store_encrypted_pii(
    db: AsyncSession,
    *,
    user_id: UUID,
    field_type: PIIFieldType,
    plaintext: str,
) -> dict[str, str | int]:
    ciphertext, version = encrypt_field(plaintext, field_type)
    result = await db.execute(
        select(EncryptedPIIRecord).where(
            EncryptedPIIRecord.user_id == user_id,
            EncryptedPIIRecord.field_type == _to_enum(field_type),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.ciphertext = ciphertext
        existing.key_version = version
    else:
        db.add(
            EncryptedPIIRecord(
                user_id=user_id,
                field_type=_to_enum(field_type),
                ciphertext=ciphertext,
                key_version=version,
            )
        )
    await db.flush()
    return {"field_type": field_type.value, "key_version": version}


async def read_encrypted_pii(
    db: AsyncSession,
    *,
    user_id: UUID,
    field_type: PIIFieldType,
) -> str | None:
    result = await db.execute(
        select(EncryptedPIIRecord).where(
            EncryptedPIIRecord.user_id == user_id,
            EncryptedPIIRecord.field_type == _to_enum(field_type),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    return decrypt_field(row.ciphertext, field_type, row.key_version)


async def list_encrypted_pii_metadata(db: AsyncSession, *, user_id: UUID) -> list[dict[str, str | int]]:
    result = await db.execute(
        select(EncryptedPIIRecord).where(EncryptedPIIRecord.user_id == user_id)
    )
    return [
        {
            "field_type": row.field_type.value,
            "key_version": row.key_version,
        }
        for row in result.scalars()
    ]


async def delete_encrypted_pii_fields(
    db: AsyncSession,
    *,
    user_id: UUID,
    field_types: list[PIIFieldType],
) -> int:
    if not field_types:
        return 0
    enums = [_to_enum(field_type) for field_type in field_types]
    result = await db.execute(
        delete(EncryptedPIIRecord).where(
            EncryptedPIIRecord.user_id == user_id,
            EncryptedPIIRecord.field_type.in_(enums),
        )
    )
    await db.flush()
    return result.rowcount or 0


async def delete_all_encrypted_pii(db: AsyncSession, *, user_id: UUID) -> int:
    result = await db.execute(delete(EncryptedPIIRecord).where(EncryptedPIIRecord.user_id == user_id))
    await db.flush()
    return result.rowcount or 0


async def apply_pii_vault_deletion_policy(db: AsyncSession, *, user_id: UUID) -> dict[str, int]:
    kyc_deletable = await can_delete_on_request(db, "kyc_documents")
    profile_deletable = await can_delete_on_request(db, "profile_pii")

    if kyc_deletable and profile_deletable:
        deleted = await delete_all_encrypted_pii(db, user_id=user_id)
        return {"deleted_records": deleted, "retained_records": 0}

    if profile_deletable:
        deleted = await delete_encrypted_pii_fields(
            db,
            user_id=user_id,
            field_types=[PIIFieldType.bank_account],
        )
        return {"deleted_records": deleted, "retained_records": await _count_retained_pii(db, user_id)}

    return {"deleted_records": 0, "retained_records": await _count_retained_pii(db, user_id)}


async def _count_retained_pii(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(EncryptedPIIRecord).where(EncryptedPIIRecord.user_id == user_id)
    )
    return len(list(result.scalars()))
