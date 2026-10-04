from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.kyc.journey_state_service import get_or_create_journey
from app.application.kyc.pan_verification_service import verify_pan
from app.infrastructure.persistence.models import User, UserRole, UserStatus
from app.infrastructure.security.passwords import hash_password


@pytest.mark.asyncio
async def test_get_or_create_journey_does_not_notify(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    notified: list[str] = []

    def _capture(*, user: User) -> None:
        notified.append(user.email)

    monkeypatch.setattr(
        "app.application.kyc.kyc_notification_service.notify_kyc_initiated",
        _capture,
    )

    user = User(
        email=f"journey-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db_session.add(user)
    await db_session.flush()

    journey = await get_or_create_journey(db_session, user.id)

    assert journey.user_id == user.id
    assert notified == []


@pytest.mark.asyncio
async def test_verify_pan_notifies_when_user_starts_kyc(
    db_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    notified: list[str] = []

    def _capture(*, user: User) -> None:
        notified.append(user.email)

    monkeypatch.setattr(
        "app.application.kyc.pan_verification_service.notify_kyc_initiated",
        _capture,
    )
    async def _allow_pan(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.application.kyc.pan_verification_service.assert_pan_not_used_by_other_user",
        _allow_pan,
    )
    async def _readiness(_pan):
        return {
            "id": "readiness-1",
            "readiness": {"status": "failed", "code": "kyc_unavailable", "reason": "Fresh KYC"},
        }

    async def _validate(**_kwargs):
        return {
            "id": "pan-1",
            "pan": {"status": "verified"},
            "name": {"status": "verified"},
            "date_of_birth": {"status": "verified"},
        }

    monkeypatch.setattr(
        "app.application.kyc.pan_verification_service.poa_check_readiness",
        _readiness,
    )
    monkeypatch.setattr(
        "app.application.kyc.pan_verification_service.poa_validate_pan_name_dob",
        _validate,
    )

    user = User(
        email=f"verify-pan-{uuid4()}@example.com",
        password_hash=hash_password("Password1!"),
        role=UserRole.user,
        status=UserStatus.active,
        phone="9999999999",
    )
    db_session.add(user)
    await db_session.flush()

    result = await verify_pan(
        db_session,
        user=user,
        pan_number="ABCDE1234F",
        first_name="Test",
        last_name="User",
        date_of_birth="1990-01-01",
    )

    assert result["success"] is True
    assert notified == [user.email]
