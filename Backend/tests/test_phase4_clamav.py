from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.infrastructure.security.clamav_service import (
    EICAR_TEST_STRING,
    ClamavScanResult,
    scan_bytes_for_malware,
)


@pytest.mark.asyncio
async def test_scan_skipped_when_clamav_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAMAV_ENABLED", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()

    result = await scan_bytes_for_malware(EICAR_TEST_STRING)
    assert result.clean is True

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_scan_quarantines_eicar_when_clamav_reports_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CLAMAV_ENABLED", "true")
    monkeypatch.setenv("CLAMAV_FAIL_OPEN", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()

    mock_client = MagicMock()
    mock_client.scan_stream.return_value = {"stream": ("FOUND", "Eicar-Test-Signature")}

    with patch("app.infrastructure.security.clamav_service.pyclamd.ClamdNetworkSocket", return_value=mock_client):
        result = await scan_bytes_for_malware(EICAR_TEST_STRING)

    assert result.clean is False
    assert result.signature == "Eicar-Test-Signature"

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_scan_allows_clean_file_when_clamav_reports_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAMAV_ENABLED", "true")
    from app.core.config import get_settings

    get_settings.cache_clear()

    mock_client = MagicMock()
    mock_client.scan_stream.return_value = None

    with patch("app.infrastructure.security.clamav_service.pyclamd.ClamdNetworkSocket", return_value=mock_client):
        result = await scan_bytes_for_malware(b"clean-file-bytes")

    assert result.clean is True
    assert result.signature is None

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_scan_fails_closed_when_clamav_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAMAV_ENABLED", "true")
    monkeypatch.setenv("CLAMAV_FAIL_OPEN", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()

    with patch("app.infrastructure.security.clamav_service.pyclamd.ClamdNetworkSocket", side_effect=OSError("connection refused")):
        result = await scan_bytes_for_malware(b"payload")

    assert result.clean is False
    assert result.error is not None

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_scan_fail_open_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLAMAV_ENABLED", "true")
    monkeypatch.setenv("CLAMAV_FAIL_OPEN", "true")
    from app.core.config import get_settings

    get_settings.cache_clear()

    with patch("app.infrastructure.security.clamav_service.pyclamd.ClamdNetworkSocket", side_effect=OSError("connection refused")):
        result = await scan_bytes_for_malware(b"payload")

    assert result.clean is True

    get_settings.cache_clear()
