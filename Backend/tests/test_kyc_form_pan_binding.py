from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.application.kyc.kyc_form_service import (
    _all_known_kyc_form_ids,
    clear_poa_kyc_form_if_verified_pan_changed,
    fetch_journey_kyc_form,
)


@pytest.mark.asyncio
async def test_fetch_journey_kyc_form_clears_wrong_pan(db_session) -> None:
    journey = SimpleNamespace(
        external_kyc_form_id="kycf_other_pan",
        poa_kyc_form_bound_pan="BAUPT7760D",
        pan_draft_json={"panNumber": "AFQPH1947E"},
        kyc_partner_external_refs_json=[],
    )
    wrong_form = {
        "id": "kycf_other_pan",
        "pan": "BAUPT7760D",
        "status": "created",
        "proof_details": {"status": "fetched"},
    }
    with patch(
        "app.application.kyc.kyc_form_service.fetch_kyc_form",
        new=AsyncMock(return_value=wrong_form),
    ), patch(
        "app.application.kyc.kyc_form_service._clear_bound_kyc_form",
        new=AsyncMock(),
    ) as clear_mock:
        loaded = await fetch_journey_kyc_form(db_session, journey, clear_if_missing=True)

    assert loaded is None
    clear_mock.assert_awaited()


def test_all_known_kyc_form_ids_skips_bound_pan_mismatch() -> None:
    journey = SimpleNamespace(
        external_kyc_form_id="kycf_wrong",
        poa_kyc_form_bound_pan="BAUPT7760D",
        kyc_partner_external_refs_json=[],
    )
    ids = _all_known_kyc_form_ids(journey, pan="AFQPH1947E")
    assert "kycf_wrong" not in ids


@pytest.mark.asyncio
async def test_clear_poa_kyc_form_when_pan_changes(db_session) -> None:
    journey = SimpleNamespace(
        external_kyc_form_id="kycf_old",
        poa_kyc_form_bound_pan="BAUPT7760D",
        pan_draft_json={"panNumber": "BAUPT7760D"},
        kyc_partner_external_refs_json=[],
    )
    with patch(
        "app.application.kyc.kyc_form_service._clear_bound_kyc_form",
        new=AsyncMock(),
    ) as clear_mock:
        await clear_poa_kyc_form_if_verified_pan_changed(
            db_session, journey, new_pan="AFQPH1947E"
        )
    clear_mock.assert_awaited()
