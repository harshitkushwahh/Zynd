from __future__ import annotations

import pytest

from app.application.identity.otp_app_service import request_otp, verify_otp
from app.application.identity.otp_purposes import (
    OtpPurpose,
    get_purpose_definition,
    resolve_purpose,
)
from app.application.messaging.streams import EVENT_AUTH_OTP_REQUESTED
from app.application.messaging.scheduled_events import begin_event_batch, take_scheduled_events
from app.core.config import get_settings
from app.workers.handlers.otp_delivery_handler import handle_otp_requested


@pytest.mark.parametrize(
    ("legacy_key", "purpose"),
    [
        ("email", OtpPurpose.signup_email),
        ("mobile", OtpPurpose.signup_mobile),
        ("email_change", OtpPurpose.email_change),
        ("oauth_link", OtpPurpose.oauth_link),
    ],
)
def test_resolve_legacy_storage_keys(legacy_key: str, purpose: OtpPurpose) -> None:
    assert resolve_purpose(legacy_key) == purpose
    assert get_purpose_definition(purpose).storage_key == legacy_key


@pytest.mark.asyncio
async def test_request_otp_schedules_delivery_event(
    fake_redis: dict[str, str],
) -> None:
    _ = fake_redis
    begin_event_batch()
    meta = await request_otp(OtpPurpose.signup_email, "user@example.com", ip="127.0.0.1")
    batch = take_scheduled_events()

    assert meta["retry_after_seconds"] >= 30
    assert len(batch) == 1
    _stream, event = batch[0]
    assert event.event_type == EVENT_AUTH_OTP_REQUESTED
    assert event.payload["destination"] == "user@example.com"
    assert event.payload["channel"] == "email"
    assert "code" not in event.payload


@pytest.mark.asyncio
async def test_otp_delivery_handler_reads_code_from_redis(
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    delivered: list[str] = []

    async def fake_email(*, to_email: str, subject: str, body: str) -> bool:
        delivered.append(body)
        return True

    monkeypatch.setattr(
        "app.workers.handlers.otp_delivery_handler.deliver_security_email",
        fake_email,
    )

    await request_otp(OtpPurpose.signup_email, "deliver@example.com", ip="127.0.0.1")
    batch = take_scheduled_events()
    _stream, event = batch[0]
    await handle_otp_requested(event)

    assert len(delivered) == 1
    assert "verification code is" in delivered[0]


@pytest.mark.asyncio
async def test_verify_otp_accepts_legacy_storage_alias(
    fake_redis: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = fake_redis
    monkeypatch.setenv("DEV_OTP", "123456")
    get_settings.cache_clear()

    await request_otp("email", "legacy@example.com", ip="127.0.0.1")
    take_scheduled_events()
    assert await verify_otp("email", "legacy@example.com", "123456") is True
