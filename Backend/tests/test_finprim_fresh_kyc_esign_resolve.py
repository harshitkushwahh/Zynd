from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.kyc.finprim_fresh_kyc_service import resolve_fresh_kyc_partner_status
from app.infrastructure.persistence.models import KycOverallStatus


@pytest.mark.asyncio
async def test_resolve_fresh_kyc_marks_submitted_when_esign_complete() -> None:
    journey = SimpleNamespace(
        external_kyc_request_id="kycr_test",
        esign_details_status="pending",
        kyc_partner_external_refs_json=[
            {"kind": "esign", "external_id": "esign_done", "archived": False},
        ],
        pan_draft_json={"panNumber": "ABCDE1234F"},
    )
    status = SimpleNamespace(overall_status=KycOverallStatus.in_progress)
    user = SimpleNamespace(id="user-1", email="u@test.com", phone="+911234567890")
    db = AsyncMock()

    with (
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.get_or_create_status",
            new=AsyncMock(return_value=status),
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.fetch_finprim_esign",
            new=AsyncMock(return_value={"id": "esign_done", "status": "successful"}),
        ),
        patch(
            "app.application.kyc.journey_state_service.mark_kyc_submitted",
            return_value=True,
        ) as mark_submitted,
    ):
        result = await resolve_fresh_kyc_partner_status(db, user=user, journey=journey)

    mark_submitted.assert_called_once()
    assert result["nextAction"] == "submitted"


@pytest.mark.asyncio
async def test_resolve_fresh_kyc_returns_existing_submitted_without_partner_call() -> None:
    journey = SimpleNamespace(
        external_kyc_request_id="kycr_test",
        esign_details_status="successful",
        kyc_partner_external_refs_json=[],
        pan_draft_json={},
    )
    status = SimpleNamespace(overall_status=KycOverallStatus.submitted)
    user = SimpleNamespace(id="user-1", email="u@test.com", phone=None)
    db = AsyncMock()

    with patch(
        "app.application.kyc.finprim_fresh_kyc_service.fetch_finprim_esign",
        new=AsyncMock(),
    ) as fetch_mock:
        with patch(
            "app.application.kyc.finprim_fresh_kyc_service.get_or_create_status",
            new=AsyncMock(return_value=status),
        ):
            result = await resolve_fresh_kyc_partner_status(db, user=user, journey=journey)

    fetch_mock.assert_not_called()
    assert result["nextAction"] == "submitted"
