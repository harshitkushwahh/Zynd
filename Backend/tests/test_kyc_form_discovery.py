from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.kyc.kyc_form_service import (
    _discovered_form_has_failed_proof_shell,
    _try_bind_usable_kyc_form,
)


def test_discovered_form_has_failed_proof_shell() -> None:
    assert _discovered_form_has_failed_proof_shell(
        {"status": "created", "proof_details": {"status": "failed"}}
    )
    assert not _discovered_form_has_failed_proof_shell(
        {"status": "created", "proof_details": {"status": "fetched"}}
    )
    assert not _discovered_form_has_failed_proof_shell(
        {"status": "failed", "proof_details": {"status": "failed"}}
    )


@pytest.mark.asyncio
async def test_try_bind_reuses_form_and_retries_failed_proof(db_session) -> None:
    journey = SimpleNamespace(
        external_kyc_form_id=None,
        kyc_partner_external_refs_json=[],
        user_id=None,
        pan_draft_json={"panNumber": "KYCFS1234A"},
        proof_details_status=None,
        kyc_form_status=None,
        kyc_form_type=None,
        kyc_form_failure_reason=None,
        esign_details_status=None,
    )
    form_failed = {
        "id": "kycf_stale_proof",
        "status": "created",
        "pan": "KYCFS1234A",
        "proof_details": {"status": "failed"},
    }
    form_pending = {
        "id": "kycf_stale_proof",
        "status": "created",
        "pan": "KYCFS1234A",
        "proof_details": {"status": "pending", "fetch_url": "https://proof.example/fetch"},
    }
    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=form_failed),
    ), patch(
        "app.application.kyc.kyc_form_service.retry_kyc_form_proof_fetch",
        new=AsyncMock(return_value=form_pending),
    ) as retry_mock:
        bound = await _try_bind_usable_kyc_form(
            db_session, journey, "kycf_stale_proof", expected_pan="KYCFS1234A"
        )
    assert bound is form_pending
    retry_mock.assert_awaited_once_with("kycf_stale_proof")
    assert journey.external_kyc_form_id == "kycf_stale_proof"


@pytest.mark.asyncio
async def test_try_bind_rejects_other_pan_form(db_session) -> None:
    journey = SimpleNamespace(
        external_kyc_form_id=None,
        kyc_partner_external_refs_json=[],
        user_id=None,
        pan_draft_json={"panNumber": "AFQPH1947E"},
        proof_details_status=None,
        kyc_form_status=None,
        kyc_form_type=None,
        kyc_form_failure_reason=None,
        esign_details_status=None,
    )
    wrong_pan_form = {
        "id": "kycf_other_user",
        "status": "created",
        "pan": "BAUPT7760D",
        "proof_details": {"status": "failed"},
    }
    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=wrong_pan_form),
    ):
        bound = await _try_bind_usable_kyc_form(
            db_session, journey, "kycf_other_user", expected_pan="AFQPH1947E"
        )
    assert bound is None
