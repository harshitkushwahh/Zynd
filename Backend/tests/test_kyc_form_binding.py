from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.kyc.kyc_form_service import fetch_journey_kyc_form
from app.infrastructure.kyc.fp_clients import FpClientError


@pytest.mark.asyncio
async def test_fetch_journey_kyc_form_clears_missing_partner_form(db_session) -> None:
    journey = SimpleNamespace(
        external_kyc_form_id="kycf_missing_partner",
        kyc_form_status="created",
        kyc_form_type="fresh",
        kyc_form_failure_reason=None,
        proof_details_status=None,
        esign_details_status=None,
        pan_draft_json={"panNumber": "ABCDE1234F"},
        kyc_partner_external_refs_json=None,
    )
    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(
            side_effect=FpClientError(
                "get.id: KYC form not found",
                status_code=400,
            )
        ),
    ):
        form = await fetch_journey_kyc_form(db_session, journey, clear_if_missing=True)

    assert form is None
    assert journey.external_kyc_form_id is None
