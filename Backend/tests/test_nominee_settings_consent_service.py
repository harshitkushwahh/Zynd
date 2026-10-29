from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.application.consent.consent_service import ConsentAcceptContext
from app.application.investor.nominee_settings_consent_service import (
    send_settings_nominee_consent_otp,
    verify_settings_nominee_consent_otp,
)
from app.application.kyc.errors import KycError
from app.domain.consent.keys import KYC_NOMINEE_UPDATE_AUTHORIZATION
from app.infrastructure.persistence.models import User


def _user(*, phone: str | None = "9876543210", verified: bool = True) -> User:
    user = User(id=uuid.uuid4(), email="test@example.com", phone=phone, country_code="IN")
    user.phone_verified_at = datetime.now(timezone.utc) if verified and phone else None
    return user


@pytest.mark.asyncio
async def test_send_settings_nominee_consent_otp_requires_verified_phone() -> None:
    user = _user(phone=None, verified=False)
    with pytest.raises(KycError) as exc:
        await send_settings_nominee_consent_otp(user=user)
    assert exc.value.code == "phone_not_verified"


@pytest.mark.asyncio
async def test_send_settings_nominee_consent_otp_masks_mobile() -> None:
    user = _user()
    with patch(
        "app.application.investor.nominee_settings_consent_service.request_otp",
        new_callable=AsyncMock,
        return_value={"retry_after_seconds": 30, "expires_in": 600},
    ):
        payload = await send_settings_nominee_consent_otp(user=user, ip="127.0.0.1")
    assert payload["masked_mobile"] == "+91 •••• ••3210"
    assert payload["retry_after_seconds"] == 30


@pytest.mark.asyncio
async def test_verify_settings_nominee_consent_otp_rejects_invalid_code() -> None:
    user = _user()
    session = AsyncMock()
    with patch(
        "app.application.investor.nominee_settings_consent_service.verify_otp",
        new_callable=AsyncMock,
        return_value=False,
    ):
        with pytest.raises(KycError) as exc:
            await verify_settings_nominee_consent_otp(
                session,
                user=user,
                otp="000000",
                consent_context=ConsentAcceptContext(source="settings_nominee"),
            )
    assert exc.value.code == "invalid_otp"


@pytest.mark.asyncio
async def test_verify_settings_nominee_consent_otp_records_consent() -> None:
    user = _user()
    session = AsyncMock()
    record_id = uuid.uuid4()
    with patch(
        "app.application.investor.nominee_settings_consent_service.verify_otp",
        new_callable=AsyncMock,
        return_value=True,
    ), patch(
        "app.application.investor.nominee_settings_consent_service.record_acceptance",
        new_callable=AsyncMock,
        return_value=type("Rec", (), {"id": record_id})(),
    ) as record_mock:
        result = await verify_settings_nominee_consent_otp(
            session,
            user=user,
            otp="123456",
            consent_context=ConsentAcceptContext(source="settings_nominee"),
        )
    assert result == record_id
    assert record_mock.await_args.kwargs["definition_key"] == KYC_NOMINEE_UPDATE_AUTHORIZATION
