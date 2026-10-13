from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.mf.mf_consent_contact_mask import mask_mf_consent_email, mask_mf_consent_mobile
from app.application.mf.mf_transaction_consent_service import (
    merge_platform_consent_metadata,
    send_mf_transaction_consent_otp,
    verify_mf_transaction_consent_otp,
)
from app.domain.consent.keys import MF_TRANSACTION_AUTHORIZATION
from app.infrastructure.persistence.models import User


def test_mask_contacts() -> None:
    assert mask_mf_consent_email("investor@example.com") == "i•••r@example.com"
    assert mask_mf_consent_mobile("9876543210").endswith("3210")


@pytest.mark.asyncio
async def test_send_mf_transaction_consent_otp_masks_and_delivers() -> None:
    with patch(
        "app.application.mf.mf_transaction_consent_service.request_otp_mobile_and_email",
        new=AsyncMock(return_value={"retry_after_seconds": 30, "expires_in": 90}),
    ):
        payload = await send_mf_transaction_consent_otp(
            identifier="order-1",
            email="investor@example.com",
            mobile="9876543210",
        )
    assert payload["masked_mobile"].endswith("3210")
    assert payload["masked_email"] == "i•••r@example.com"
    assert payload["retry_after_seconds"] == 30
    assert payload["expires_in"] == 90


@pytest.mark.asyncio
async def test_verify_records_platform_consent(db_session) -> None:
    user = User(email=f"mf-consent-{uuid4()}@example.com", first_name="Test", last_name="User")
    db_session.add(user)
    await db_session.flush()

    subject_id = uuid4()
    expected_record_id = uuid4()
    fake_record = type("Rec", (), {"id": expected_record_id})()

    with (
        patch(
            "app.application.mf.mf_transaction_consent_service.verify_otp",
            new=AsyncMock(return_value=True),
        ),
        patch(
            "app.application.mf.mf_transaction_consent_service.record_acceptance",
            new=AsyncMock(return_value=fake_record),
        ) as record_mock,
    ):
        record_id = await verify_mf_transaction_consent_otp(
            db_session,
            user=user,
            identifier=str(subject_id),
            otp="123456",
            transaction_kind="redemption",
            subject_id=subject_id,
            ip="127.0.0.1",
            user_agent="pytest",
        )
    record_mock.assert_awaited_once()
    call_kwargs = record_mock.await_args.kwargs
    assert call_kwargs["definition_key"] == MF_TRANSACTION_AUTHORIZATION
    assert call_kwargs["context"].source == "mf_transaction"
    assert call_kwargs["context"].metadata["transaction_kind"] == "redemption"
    assert record_id == expected_record_id
    meta = merge_platform_consent_metadata({}, consent_record_id=record_id)
    assert meta["platform_consent_key"] == MF_TRANSACTION_AUTHORIZATION
    assert meta["platform_consent_record_id"] == str(record_id)
