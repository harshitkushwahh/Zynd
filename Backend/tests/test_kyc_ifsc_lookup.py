from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.infrastructure.kyc.fp_clients import FpClientError, lookup_ifsc


@pytest.mark.asyncio
async def test_lookup_ifsc_falls_back_when_gateway_ifsc_route_unavailable() -> None:
    with patch("app.infrastructure.kyc.fp_clients.get_settings") as settings_mock:
        settings_mock.return_value.resolved_kyc_provider_live = True
        with patch(
            "app.infrastructure.kyc.fp_clients.fp_get",
            new=AsyncMock(
                side_effect=FpClientError(
                    "Gateway: URL not available. Please contact administrator",
                    status_code=404,
                )
            ),
        ):
            result = await lookup_ifsc("HDFC0001234")

    assert result["ifsc_code"] == "HDFC0001234"
    assert result["bank_name"] == ""
    assert result["branch"] == ""
    assert result["lookup_fallback"] is True


@pytest.mark.asyncio
async def test_lookup_ifsc_raises_when_ifsc_code_not_found() -> None:
    with patch("app.infrastructure.kyc.fp_clients.get_settings") as settings_mock:
        settings_mock.return_value.resolved_kyc_provider_live = True
        with patch(
            "app.infrastructure.kyc.fp_clients.fp_get",
            new=AsyncMock(
                side_effect=FpClientError(
                    "IFSC code not found.",
                    status_code=404,
                )
            ),
        ):
            with pytest.raises(FpClientError) as exc_info:
                await lookup_ifsc("KKBK0000591")

    assert exc_info.value.code == "invalid_ifsc"
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_lookup_ifsc_uses_ifsc_codes_route() -> None:
    with patch("app.infrastructure.kyc.fp_clients.get_settings") as settings_mock:
        settings_mock.return_value.resolved_kyc_provider_live = True
        fp_get = AsyncMock(
            return_value={
                "ifsc_code": "HDFC0001234",
                "bank_name": "HDFC BANK",
                "branch_name": "PARK STREET",
            }
        )
        with patch("app.infrastructure.kyc.fp_clients.fp_get", new=fp_get):
            result = await lookup_ifsc("HDFC0001234")

    fp_get.assert_awaited_once_with("/api/onb/ifsc_codes/HDFC0001234")
    assert result["bank_name"] == "HDFC BANK"
    assert result["branch"] == "PARK STREET"

@pytest.mark.asyncio
async def test_lookup_ifsc_raises_for_other_fp_errors() -> None:
    with patch("app.infrastructure.kyc.fp_clients.get_settings") as settings_mock:
        settings_mock.return_value.resolved_kyc_provider_live = True
        with patch(
            "app.infrastructure.kyc.fp_clients.fp_get",
            new=AsyncMock(side_effect=FpClientError("Unauthorized", status_code=401)),
        ):
            with pytest.raises(FpClientError):
                await lookup_ifsc("HDFC0001234")
