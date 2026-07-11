from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.infrastructure.kyc.poa_client import poa_verify_bank_account


@pytest.mark.asyncio
async def test_poa_verify_bank_account_uses_bank_accounts_array() -> None:
    fp_post = AsyncMock(return_value={"id": "pv_test"})
    poll = AsyncMock(
        return_value={
            "id": "pv_test",
            "status": "completed",
            "bank_accounts": [{"status": "verified", "code": None, "reason": None}],
        }
    )
    with patch("app.infrastructure.kyc.poa_client.get_settings") as settings_mock:
        settings_mock.return_value.resolved_kyc_provider_live = True
        with patch("app.infrastructure.kyc.poa_client.fp_post", new=fp_post), patch(
            "app.infrastructure.kyc.poa_client.poll_poa_preverification",
            new=poll,
        ):
            result = await poa_verify_bank_account(
                pan_number="ABCPA3753D",
                account_holder_name="RAHUL SHARMA",
                account_number="1234567890",
                ifsc_code="HDFC0001234",
                account_type="savings",
            )

    fp_post.assert_awaited_once()
    body = fp_post.await_args.args[1]
    assert "bank_account" not in body
    assert body["name"] == {"value": "RAHUL SHARMA"}
    assert body["bank_accounts"] == [
        {
            "value": {
                "account_number": "1234567890",
                "ifsc_code": "HDFC0001234",
                "account_type": "savings",
            }
        }
    ]
    assert result["bank_accounts"][0]["status"] == "verified"
