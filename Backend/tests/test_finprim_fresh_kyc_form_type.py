from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.application.kyc.finprim_fresh_kyc_service import submit_fresh_kyc_via_finprim


@pytest.mark.asyncio
async def test_submit_fresh_kyc_persists_form_type_while_awaiting_esign() -> None:
    journey = SimpleNamespace(
        external_kyc_request_id="kycr_test",
        kyc_form_type=None,
        kyc_form_status=None,
        esign_details_status=None,
        signature_draft_json={"dataUrl": "data:image/png;base64,abc"},
        pan_draft_json={"panNumber": "ABCDE1234F"},
        readiness_code="kyc_underprocess",
        kyc_already_registered=False,
        kyc_partner_external_refs_json=[],
    )
    user = SimpleNamespace(id="user-1", email="u@test.com", phone="+911234567890")
    db = AsyncMock()
    status = SimpleNamespace(
        overall_status="in_progress",
        review_step_status=None,
        signature_step_status=None,
    )

    with (
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.resolve_fresh_kyc_partner_status",
            new=AsyncMock(return_value={"nextAction": "continue"}),
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.get_or_create_status",
            new=AsyncMock(return_value=status),
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.data_url_to_file",
            return_value=(b"x", "sig.png", "image/png"),
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.upload_finprim_kyc_file",
            new=AsyncMock(return_value={"id": "file_1"}),
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service._sync_finprim_kyc_request_from_journey",
            new=AsyncMock(return_value=({}, "esign_required")),
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.create_finprim_esign",
            new=AsyncMock(
                return_value={
                    "id": "esign_1",
                    "status": "pending",
                    "redirect": {"url": "https://esign.example/start"},
                }
            ),
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.finprim_esign_redirect_url",
            return_value="https://esign.example/start",
        ),
        patch(
            "app.application.kyc.finprim_fresh_kyc_service.finprim_esign_complete",
            return_value=False,
        ),
    ):
        result = await submit_fresh_kyc_via_finprim(db, user=user, journey=journey)

    assert result["nextAction"] == "esign_redirect"
    assert journey.kyc_form_type == "fresh"
    assert journey.kyc_form_status == "awaiting_esign"
    kyc_request_refs = [
        r
        for r in journey.kyc_partner_external_refs_json
        if r.get("kind") == "kyc_request"
    ]
    assert kyc_request_refs and kyc_request_refs[-1].get("form_type") == "fresh"
