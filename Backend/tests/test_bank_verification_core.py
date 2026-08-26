from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.application.kyc.bank_verification_core import (
    BankVerificationError,
    format_bank_verification_failure,
    resolve_ifsc_details,
    resolve_poa_pan_status_for_display,
    resolve_poa_readiness_status_for_display,
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
async def test_run_hybrid_bank_verification_calls_poa_when_ifsc_lookup_has_no_bank_name() -> None:
    poa_verify = AsyncMock(
        return_value={
            "id": "pv_test",
            "status": "completed",
            "pan": {"status": "verified"},
            "bank_accounts": [
                {
                    "status": "verified",
                    "value": {
                        "bank_name": "Kotak Mahindra Bank",
                        "branch_name": "Mumbai Main",
                    },
                }
            ],
        }
    )
    with patch(
        "app.application.kyc.bank_verification_core.lookup_ifsc",
        new=AsyncMock(return_value={"ifsc_code": "KKBK0000591", "bank_name": "", "branch": ""}),
    ), patch(
        "app.application.kyc.bank_verification_core.poa_verify_bank_account",
        new=poa_verify,
    ), patch(
        "app.application.kyc.bank_verification_core.kyckart_bank_account_holder_name",
        new=AsyncMock(return_value={"accountHolderName": "HARSHIT KUSHWAH"}),
    ):
        outcome = await run_hybrid_bank_verification(
            pan_draft={"fullName": "HARSHIT KUSHWAH"},
            pan_number="ABCPA3753D",
            account_number="0846929725",
            account_type="Savings",
            ifsc_code="KKBK0000591",
            kyc_already_registered=True,
        )

    poa_verify.assert_awaited_once()
    assert outcome.bank_verified is True
    assert outcome.kyckart_holder_name == "HARSHIT KUSHWAH"
    assert outcome.bank_name == "Kotak Mahindra Bank"
    assert outcome.branch == "Mumbai Main"


def test_format_bank_verification_failure_low_confidence_uses_cybrilla_message() -> None:
    failure = format_bank_verification_failure(
        bank_result={"code": "low_confidence", "reason": ""},
        pan_verified=True,
    )

    assert failure["code"] == "low_confidence"
    assert "cannot be used for transactions" in failure["reason"]


def test_resolve_poa_pan_status_uses_pan_step_when_bank_poa_omits_pan() -> None:
    status = resolve_poa_pan_status_for_display({}, pan_step_verified=True)
    assert status["status"] == "verified"


def test_resolve_poa_readiness_status_uses_journey_when_bank_poa_omits_readiness() -> None:
    status = resolve_poa_readiness_status_for_display(
        {},
        kyc_already_registered=True,
        readiness_code=None,
        readiness_reason=None,
    )
    assert status["status"] == "verified"


def test_resolve_poa_readiness_status_hydrates_kyc_incomplete_from_pan_step() -> None:
    status = resolve_poa_readiness_status_for_display(
        {},
        kyc_already_registered=False,
        readiness_code="kyc_incomplete",
        readiness_reason="KYC incomplete at KRA.",
    )
    assert status["status"] == "failed"
    assert status["code"] == "kyc_incomplete"


def test_format_bank_verification_failure_pan_not_verified() -> None:
    failure = format_bank_verification_failure(
        bank_result={"code": "verification_failed", "reason": ""},
        pan_result={"code": "mismatch", "reason": ""},
        pan_verified=False,
    )

    assert failure["field"] == "pan"
    assert "PAN name does not match" in failure["reason"]
