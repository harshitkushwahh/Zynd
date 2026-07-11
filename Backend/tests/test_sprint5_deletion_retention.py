from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.compliance.anonymization import build_anonymized_email
from app.application.compliance.deletion_executor_service import (
    execute_account_deletion,
    fetch_due_deletion_users,
    run_deletion_executor,
)
from app.application.compliance.retention_service import (
    can_delete_on_request,
    ensure_retention_seed,
    list_retention_policies,
)
from app.application.security.pii_vault_service import read_encrypted_pii, store_encrypted_pii
from app.infrastructure.persistence.models import (
    DeletionEventType,
    DeletionLedger,
    Device,
    OAuthAccount,
    OAuthProvider,
    Session,
    User,
    UserBackupCode,
    UserMfaSecret,
    UserRole,
    UserStatus,
)
from app.infrastructure.security.field_encryption import PIIFieldType
from app.infrastructure.security.mfa_crypto import encrypt_secret
from app.infrastructure.security.passwords import hash_password
from app.infrastructure.security.tokens import hash_token


def _now() -> datetime:
    return datetime.now(timezone.utc)


@pytest.mark.asyncio
async def test_retention_schedule_is_seeded(db_session: AsyncSession) -> None:
    await ensure_retention_seed(db_session)
    policies = await list_retention_policies(db_session)
    classes = {policy["data_class"] for policy in policies}
    assert "auth_credentials" in classes
    assert "kyc_documents" in classes
    assert await can_delete_on_request(db_session, "profile_pii") is True
    assert await can_delete_on_request(db_session, "kyc_documents") is False


@pytest.mark.asyncio
async def test_fetch_due_deletion_users(db_session: AsyncSession) -> None:
    due_user = User(
        email=f"due-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() - timedelta(days=1),
    )
    future_user = User(
        email=f"future-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() + timedelta(days=10),
    )
    db_session.add_all([due_user, future_user])
    await db_session.flush()

    due = await fetch_due_deletion_users(db_session)
    assert len(due) == 1
    assert due[0].id == due_user.id


@pytest.mark.asyncio
async def test_execute_account_deletion_anonymizes_and_purges(db_session: AsyncSession) -> None:
    await ensure_retention_seed(db_session)
    email = f"delete-{uuid4()}@example.com"
    user = User(
        email=email,
        phone="9999999999",
        password_hash=hash_password("Password1!"),
        first_name="Pat",
        last_name="Lee",
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_requested_at=_now() - timedelta(days=31),
        deletion_scheduled_at=_now() - timedelta(minutes=5),
        mfa_enrolled_at=_now(),
    )
    db_session.add(user)
    await db_session.flush()

    device = Device(user_id=user.id, fingerprint_hash=f"fp-{uuid4()}", os="macOS", browser="Safari")
    session = Session(
        user_id=user.id,
        device_id=None,
        refresh_token_hash=hash_token("refresh"),
        expires_at=_now() + timedelta(days=1),
    )
    ciphertext, version = encrypt_secret("JBSWY3DPEHPK3PXP")
    mfa_secret = UserMfaSecret(user_id=user.id, secret_ciphertext=ciphertext, secret_key_version=version)
    backup_code = UserBackupCode(user_id=user.id, code_hash=hash_password("BACKUP-CODE"))
    oauth = OAuthAccount(
        user_id=user.id,
        provider=OAuthProvider.google,
        provider_user_id="google-123",
        email=email,
    )
    db_session.add_all([device, session, mfa_secret, backup_code, oauth])
    await db_session.flush()
    session.device_id = device.id

    await store_encrypted_pii(
        db_session,
        user_id=user.id,
        field_type=PIIFieldType.bank_account,
        plaintext="123456789012",
    )
    await store_encrypted_pii(
        db_session,
        user_id=user.id,
        field_type=PIIFieldType.pan,
        plaintext="ABCDE1234F",
    )

    result = await execute_account_deletion(db_session, user=user, notify_email=email)
    await db_session.flush()

    assert user.status == UserStatus.deleted
    assert user.deleted_at is not None
    assert user.email == build_anonymized_email(user.id)
    assert user.password_hash is None
    assert user.first_name is None
    assert result["anonymized_email"] == user.email

    assert (await db_session.execute(select(Session).where(Session.user_id == user.id))).scalars().all() == []
    assert (await db_session.execute(select(UserMfaSecret).where(UserMfaSecret.user_id == user.id))).scalar_one_or_none() is None
    assert (await db_session.execute(select(OAuthAccount).where(OAuthAccount.user_id == user.id))).scalar_one_or_none() is None

    assert await read_encrypted_pii(db_session, user_id=user.id, field_type=PIIFieldType.bank_account) is None
    assert await read_encrypted_pii(db_session, user_id=user.id, field_type=PIIFieldType.pan) == "ABCDE1234F"

    ledger = list(
        (
            await db_session.execute(
                select(DeletionLedger).where(
                    DeletionLedger.user_id == user.id,
                    DeletionLedger.event_type == DeletionEventType.deletion_executed,
                )
            )
        ).scalars()
    )
    assert len(ledger) == 1


@pytest.mark.asyncio
async def test_run_deletion_executor_processes_due_users(db_session: AsyncSession) -> None:
    await ensure_retention_seed(db_session)
    user = User(
        email=f"batch-{uuid4()}@example.com",
        password_hash="hash",
        role=UserRole.user,
        status=UserStatus.deletion_pending,
        deletion_scheduled_at=_now() - timedelta(hours=1),
    )
    db_session.add(user)
    await db_session.flush()

    result = await run_deletion_executor(db_session)
    assert result["executed"] == 1
    assert result["failed"] == 0
    assert user.status == UserStatus.deleted
