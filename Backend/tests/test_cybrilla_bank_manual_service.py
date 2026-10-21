from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.application.kyc.cybrilla_bank_manual_service import request_cybrilla_uncertain_manual_review
from app.infrastructure.core.kyc.fp_clients import FpClientError


@pytest.mark.asyncio
async def test_request_cybrilla_uncertain_manual_review_calls_poa_with_consent() -> None:
    uncertain_manual = AsyncMock(return_value={"id": "pv_manual_2", "status": "completed"})
    with patch(
        "app.application.kyc.cybrilla_bank_manual_service.poa_verify_bank_account_uncertain_manual",
        new=uncertain_manual,
    ):
        result = await request_cybrilla_uncertain_manual_review(
            pan_number="AKHPA4369B",
            account_holder_name="Test User",
            account_number="1234567890",
            ifsc_code="BKID0000912",
            poa_account_type="savings",
            uncertain_preverify_id="pv_uncertain_1",
        )

    assert result is not None
    assert result["id"] == "pv_manual_2"
    uncertain_manual.assert_awaited_once_with(
        pan_number="AKHPA4369B",
        account_holder_name="Test User",
        account_number="1234567890",
        ifsc_code="BKID0000912",
        account_type="savings",
    )


@pytest.mark.asyncio
async def test_request_cybrilla_uncertain_manual_review_skips_nre_without_call() -> None:
    uncertain_manual = AsyncMock()
    with patch(
        "app.application.kyc.cybrilla_bank_manual_service.poa_verify_bank_account_uncertain_manual",
        new=uncertain_manual,
    ):
        result = await request_cybrilla_uncertain_manual_review(
            pan_number="AKHPA4369B",
            account_holder_name="Test User",
            account_number="1234567890",
            ifsc_code="BKID0000912",
            poa_account_type="nre_savings",
            uncertain_preverify_id="pv_uncertain_1",
        )

    assert result is None
    uncertain_manual.assert_not_awaited()


@pytest.mark.asyncio
async def test_request_cybrilla_uncertain_manual_review_returns_none_on_poa_error() -> None:
    with patch(
        "app.application.kyc.cybrilla_bank_manual_service.poa_verify_bank_account_uncertain_manual",
        new=AsyncMock(side_effect=FpClientError("Approval required", "approval_required", 400)),
    ):
        result = await request_cybrilla_uncertain_manual_review(
            pan_number="AKHPA4369B",
            account_holder_name="Test User",
            account_number="1234567890",
            ifsc_code="BKID0000912",
            poa_account_type="savings",
            uncertain_preverify_id="pv_uncertain_1",
        )

    assert result is None
