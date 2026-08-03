from __future__ import annotations

from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.core.config import get_settings
from app.infrastructure.notifications.sms_service import _to_e164, deliver_sms


@pytest.mark.parametrize(
    ("phone", "expected"),
    [
        ("9876543210", "+919876543210"),
        ("+919876543210", "+919876543210"),
        ("919876543210", "+919876543210"),
        ("+1 555 123 4567", "+15551234567"),
    ],
)
def test_to_e164(phone: str, expected: str) -> None:
    assert _to_e164(phone) == expected


@pytest.mark.asyncio
async def test_deliver_sms_dev_log_when_provider_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SMS_PROVIDER", "")
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()

    assert await deliver_sms(to_phone="9876543210", body="123456 is your code") is True


@pytest.mark.asyncio
async def test_deliver_sms_twilio_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMS_PROVIDER", "twilio")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+15017122661")
    monkeypatch.setenv("DEBUG", "true")
    get_settings.cache_clear()

    mock_response = httpx.Response(201, json={"sid": "SM123"})
    mock_post = AsyncMock(return_value=mock_response)

    with patch("app.infrastructure.notifications.sms_service.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.__aexit__.return_value = None
        client.post = mock_post
        client_cls.return_value = client

        ok = await deliver_sms(to_phone="9876543210", body="445566 is your Zynd login code")

    assert ok is True
    mock_post.assert_awaited_once()
    call_kwargs = mock_post.await_args.kwargs
    assert call_kwargs["data"]["To"] == "+919876543210"
    assert call_kwargs["data"]["From"] == "+15017122661"
    assert call_kwargs["auth"] == ("ACtest", "secret")


@pytest.mark.asyncio
async def test_deliver_sms_twilio_missing_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SMS_PROVIDER", "twilio")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "")
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "")
    get_settings.cache_clear()

    assert await deliver_sms(to_phone="9876543210", body="test") is False


@pytest.mark.asyncio
async def test_deliver_sms_twilio_api_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SMS_PROVIDER", "twilio")
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "secret")
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+15017122661")
    get_settings.cache_clear()

    mock_response = httpx.Response(400, text='{"message":"Invalid To Phone Number"}')
    mock_post = AsyncMock(return_value=mock_response)

    with patch("app.infrastructure.notifications.sms_service.httpx.AsyncClient") as client_cls:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.__aexit__.return_value = None
        client.post = mock_post
        client_cls.return_value = client

        ok = await deliver_sms(to_phone="9876543210", body="test")

    assert ok is False
