from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.application.kyc.bank_verification_core import (
    BankVerificationError,
    resolve_ifsc_details,
    run_hybrid_bank_verification,
)


@pytest.mark.asyncio
async def test_resolve_ifsc_details_rejects_unknown_ifsc() -> None:
    with patch(
        "app.application.kyc.bank_verification_core.lookup_ifsc",
        new=AsyncMock(return_value={"ifsc_code": "KKBK0000591", "bank_name": "", "branch": ""}),
    ):
        with pytest.raises(BankVerificationError) as exc_info:
            await resolve_ifsc_details("KKBK0000591")

    assert exc_info.value.code == "invalid_ifsc"


@pytest.mark.asyncio
async def test_resolve_ifsc_details_rejects_invalid_format() -> None:
    with pytest.raises(BankVerificationError) as exc_info:
        await resolve_ifsc_details("KKBK00059")

    assert exc_info.value.code == "invalid_ifsc"


@pytest.mark.asyncio
async def test_run_hybrid_bank_verification_rejects_unknown_ifsc_before_poa() -> None:
    poa_verify = AsyncMock()
    with patch(
        "app.application.kyc.bank_verification_core.lookup_ifsc",
        new=AsyncMock(return_value={"ifsc_code": "KKBK0000591", "bank_name": "", "branch": ""}),
    ), patch(
        "app.application.kyc.bank_verification_core.poa_verify_bank_account",
        new=poa_verify,
    ):
        with pytest.raises(BankVerificationError) as exc_info:
            await run_hybrid_bank_verification(
                pan_draft={"fullName": "HARSHIT KUSHWAH"},
                pan_number="ABCPA3753D",
                account_number="0846929725",
                account_type="Savings",
                ifsc_code="KKBK0000591",
                kyc_already_registered=True,
            )

    assert exc_info.value.code == "invalid_ifsc"
    poa_verify.assert_not_awaited()
