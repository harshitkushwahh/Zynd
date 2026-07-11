from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.admin.rbac_service import ensure_rbac_seed, get_user_permission_keys, user_has_permission
from app.application.security.key_rotation_service import rotate_mfa_secrets_to_current_version
from app.application.security.pii_vault_service import read_encrypted_pii, store_encrypted_pii
from app.core.config import get_settings
from app.infrastructure.persistence.models import User, UserMfaSecret, UserRole, UserStatus
from app.infrastructure.security.field_encryption import PIIFieldType, decrypt_field, encrypt_field
from app.infrastructure.security.mfa_crypto import decrypt_secret, encrypt_secret


def test_field_encryption_roundtrip() -> None:
    ciphertext, version = encrypt_field("4111111111111111", PIIFieldType.pan)
    assert version == get_settings().current_pii_key_version
    assert decrypt_field(ciphertext, PIIFieldType.pan, version) == "4111111111111111"


def test_mfa_encryption_tracks_key_version() -> None:
    ciphertext, version = encrypt_secret("JBSWY3DPEHPK3PXP")
    assert decrypt_secret(ciphertext, version) == "JBSWY3DPEHPK3PXP"


@pytest.mark.asyncio
async def test_pii_vault_store_and_read(db_session: AsyncSession) -> None:
    user = User(
        email=f"pii-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    await store_encrypted_pii(
        db_session,
        user_id=user.id,
        field_type=PIIFieldType.bank_account,
        plaintext="123456789012",
    )
    value = await read_encrypted_pii(
        db_session,
        user_id=user.id,
        field_type=PIIFieldType.bank_account,
    )
    assert value == "123456789012"


@pytest.mark.asyncio
async def test_rbac_seed_assigns_super_admin_permissions(db_session: AsyncSession) -> None:
    admin = User(
        email=f"admin-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.admin,
        status=UserStatus.active,
    )
    db_session.add(admin)
    await db_session.flush()

    await ensure_rbac_seed(db_session)
    permissions = await get_user_permission_keys(db_session, admin.id)
    assert "security_reviews.read" in permissions
    assert "rbac.manage" in permissions
    assert await user_has_permission(db_session, admin.id, "encryption.rotate")


@pytest.mark.asyncio
async def test_rotate_mfa_secrets_to_current_version(db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "MFA_ENCRYPTION_KEYS",
        '{"1":"legacy-mfa-key-one","2":"legacy-mfa-key-two"}',
    )
    monkeypatch.setenv("CURRENT_MFA_KEY_VERSION", "2")
    get_settings.cache_clear()

    user = User(
        email=f"rotate-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    ciphertext_v1, _ = encrypt_secret("JBSWY3DPEHPK3PXP", key_version=1)
    db_session.add(
        UserMfaSecret(
            user_id=user.id,
            secret_ciphertext=ciphertext_v1,
            secret_key_version=1,
        )
    )
    await db_session.flush()

    result = await rotate_mfa_secrets_to_current_version(db_session)
    assert result["rotated"] == 1
    assert result["target_version"] == 2

    row = (
        await db_session.execute(
            UserMfaSecret.__table__.select().where(UserMfaSecret.user_id == user.id)
        )
    ).one()
    assert row.secret_key_version == 2
    assert decrypt_secret(row.secret_ciphertext, 2) == "JBSWY3DPEHPK3PXP"

    monkeypatch.delenv("MFA_ENCRYPTION_KEYS", raising=False)
    monkeypatch.delenv("CURRENT_MFA_KEY_VERSION", raising=False)
    get_settings.cache_clear()
