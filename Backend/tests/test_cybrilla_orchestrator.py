from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.infrastructure.core.channels import CybrillaChannel
from app.infrastructure.core.errors import CybrillaClientError
from app.infrastructure.core.orchestrator import CybrillaHttpOrchestrator, is_auth_token_error
from app.infrastructure.core.tokens import CybrillaTokenService


def test_is_auth_token_error_matches_jwt_expired() -> None:
    exc = CybrillaClientError("JWT expired", status_code=401)
    assert is_auth_token_error(exc) is True


@pytest.mark.asyncio
async def test_request_json_success(monkeypatch: pytest.MonkeyPatch) -> None:
    tokens = CybrillaTokenService()
    orchestrator = CybrillaHttpOrchestrator(tokens=tokens)

    async def fake_get_token(channel: CybrillaChannel, *, force_refresh: bool = False) -> str:
        assert channel == CybrillaChannel.finprim_kyc
        return "token-abc"

    monkeypatch.setattr(tokens, "get_token", fake_get_token)

    mock_response = MagicMock()
    mock_response.is_error = False
    mock_response.status_code = 200
    mock_response.content = b'{"ok": true}'
    mock_response.json.return_value = {"ok": True}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.infrastructure.core.orchestrator.httpx.AsyncClient", return_value=mock_client):
        with patch("app.infrastructure.core.orchestrator.record_provider_api_log", new=AsyncMock()):
            payload = await orchestrator.request_json("GET", "/api/onb/states")

    assert payload == {"ok": True}


@pytest.mark.asyncio
async def test_request_json_retries_on_auth_error(monkeypatch: pytest.MonkeyPatch) -> None:
    tokens = CybrillaTokenService()
    orchestrator = CybrillaHttpOrchestrator(tokens=tokens)
    calls = {"n": 0}

    async def fake_get_token(channel: CybrillaChannel, *, force_refresh: bool = False) -> str:
        calls["n"] += 1
        return f"token-{calls['n']}"

    monkeypatch.setattr(tokens, "get_token", fake_get_token)

    unauthorized = MagicMock()
    unauthorized.is_error = True
    unauthorized.status_code = 401
    unauthorized.content = b'{"error":{"message":"JWT expired"}}'
    unauthorized.json.return_value = {"error": {"message": "JWT expired"}}
    unauthorized.request = MagicMock(url="http://test", method="GET")
    unauthorized.text = ""

    ok = MagicMock()
    ok.is_error = False
    ok.status_code = 200
    ok.content = b'{"states":[]}'
    ok.json.return_value = {"states": []}

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=[unauthorized, ok])
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.infrastructure.core.orchestrator.httpx.AsyncClient", return_value=mock_client):
        with patch("app.infrastructure.core.orchestrator.record_provider_api_log", new=AsyncMock()):
            payload = await orchestrator.request_json("GET", "/api/onb/states")

    assert payload == {"states": []}
    assert calls["n"] == 2
