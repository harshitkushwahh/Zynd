from unittest.mock import AsyncMock, patch

import pytest

from app.infrastructure.mf.fp_oms_client import (
    _parse_client_fp_user_ip,
    fetch_host_public_ip,
    normalize_fp_user_ip,
    resolve_fp_user_ip,
)


def test_parse_client_fp_user_ip_rejects_loopback() -> None:
    assert _parse_client_fp_user_ip("::1") is None
    assert _parse_client_fp_user_ip("127.0.0.1") is None
    assert _parse_client_fp_user_ip("192.168.1.4") is None


def test_parse_client_fp_user_ip_keeps_public_ipv4() -> None:
    assert _parse_client_fp_user_ip("49.36.120.15") == "49.36.120.15"
    assert _parse_client_fp_user_ip("::ffff:192.0.2.1") is None


def test_parse_client_fp_user_ip_rejects_documentation_blocks() -> None:
    assert _parse_client_fp_user_ip("203.0.113.10") is None
    assert _parse_client_fp_user_ip("192.0.2.1") is None


def test_normalize_fp_user_ip_does_not_use_documentation_fallback() -> None:
    assert normalize_fp_user_ip("::1") is None
    assert normalize_fp_user_ip(None) is None


@pytest.mark.asyncio
async def test_resolve_fp_user_ip_fetches_public_ip_in_development() -> None:
    with patch(
        "app.infrastructure.mf.fp_oms_client.fetch_host_public_ip",
        new=AsyncMock(return_value="49.36.120.15"),
    ):
        resolved = await resolve_fp_user_ip("::1")
    assert resolved == "49.36.120.15"


@pytest.mark.asyncio
async def test_fetch_host_public_ip_caches_result() -> None:
    import app.infrastructure.mf.fp_oms_client as fp_module

    fp_module._public_ip_cache = None
    mock_response = AsyncMock()
    mock_response.raise_for_status = lambda: None
    mock_response.text = "49.36.120.15"

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get = AsyncMock(return_value=mock_response)

    with patch("app.infrastructure.mf.fp_oms_client.httpx.AsyncClient", return_value=mock_client):
        first = await fetch_host_public_ip()
        second = await fetch_host_public_ip()

    assert first == "49.36.120.15"
    assert second == "49.36.120.15"
    mock_client.get.assert_awaited_once()
