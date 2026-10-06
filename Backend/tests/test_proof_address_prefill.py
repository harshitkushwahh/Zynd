import pytest

from app.application.kyc.proof_address_prefill import (
    apply_kra_update_proof_address,
    contact_draft_from_kyc_form,
    proof_contact_snapshot,
)
from app.infrastructure.persistence.models import KycJourneyState


def test_contact_draft_from_kyc_form_address() -> None:
    draft = contact_draft_from_kyc_form(
        {
            "proof_details": {"status": "fetched"},
            "address": {
                "line_1": "12 MG Road",
                "city": "Bengaluru",
                "pincode": "560001",
                "state": "Karnataka",
                "country": "in",
            },
        }
    )
    assert draft is not None
    assert draft["permanent"]["line1"] == "12 MG Road"
    assert draft["permanent"]["pincode"] == "560001"
    assert draft["permanent"]["country"] == "India"
    assert draft["sameAsPermanent"] is True


def test_contact_draft_falls_back_to_proof_details_address() -> None:
    draft = contact_draft_from_kyc_form(
        {
            "proof_details": {
                "status": "successful",
                "address": {"line1": "1 Residency Road", "pincode": "400001"},
            }
        }
    )
    assert draft is not None
    assert draft["permanent"]["line1"] == "1 Residency Road"


def test_proof_snapshot_keeps_street_lines_and_marks_source() -> None:
    draft = proof_contact_snapshot(
        {
            "proof_details": {"status": "fetched"},
            "address": {
                "proof_type": "aadhaar",
                "line_1": "12 MG Road",
                "city": "Bengaluru",
                "pincode": "560001",
            },
        }
    )
    assert draft is not None
    assert draft["source"] == "proof_details"
    assert draft["proofType"] == "aadhaar"
    assert draft["permanent"]["line1"] == "12 MG Road"
    assert draft["correspondence"]["line1"] == "12 MG Road"
    assert draft["sameAsPermanent"] is True


def test_proof_snapshot_is_empty_when_partner_returns_only_proof_type() -> None:
    assert (
        proof_contact_snapshot(
            {
                "proof_details": {"status": "successful"},
                "address": {"proof_type": "aadhaar"},
            }
        )
        is None
    )


def test_proof_snapshot_waits_until_digilocker_finishes() -> None:
    assert (
        proof_contact_snapshot(
            {
                "proof_details": {"status": "pending"},
                "address": {"line_1": "12 MG Road"},
            }
        )
        is None
    )


def _onhold_journey() -> KycJourneyState:
    journey = KycJourneyState(user_id=None)
    journey.readiness_code = "kyc_onhold"
    journey.personal_draft_json = {}
    return journey


@pytest.mark.asyncio
async def test_apply_keeps_a_typed_address(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _enrich(draft: dict) -> dict:
        return draft

    monkeypatch.setattr(
        "app.application.kyc.proof_address_prefill.enrich_digilocker_address_prefill",
        _enrich,
    )
    journey = _onhold_journey()
    journey.contact_draft_json = {
        "source": "user",
        "sameAsPermanent": True,
        "permanent": {"line1": "typed street"},
    }
    applied = await apply_kra_update_proof_address(
        journey,
        {
            "proof_details": {"status": "successful"},
            "address": {
                "proof_type": "aadhaar",
                "line_1": "Aadhaar lane",
                "city": "Pune",
                "pincode": "411001",
            },
        },
    )
    assert applied is False
    contact = journey.contact_draft_json
    assert isinstance(contact, dict)
    assert contact["source"] == "user"
    assert contact["permanent"]["line1"] == "typed street"


@pytest.mark.asyncio
async def test_apply_prefills_when_the_user_has_not_typed_an_address(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _enrich(draft: dict) -> dict:
        return draft

    monkeypatch.setattr(
        "app.application.kyc.proof_address_prefill.enrich_digilocker_address_prefill",
        _enrich,
    )
    journey = _onhold_journey()
    journey.contact_draft_json = None
    applied = await apply_kra_update_proof_address(
        journey,
        {
            "proof_details": {"status": "fetched"},
            "address": {"line_1": "Aadhaar lane", "city": "Pune", "pincode": "411001"},
        },
    )
    assert applied is True
    contact = journey.contact_draft_json
    assert isinstance(contact, dict)
    assert contact["permanent"]["line1"] == "Aadhaar lane"


@pytest.mark.asyncio
async def test_apply_does_not_store_a_blank_address_when_proof_has_no_lines() -> None:
    journey = _onhold_journey()
    journey.contact_draft_json = None
    applied = await apply_kra_update_proof_address(
        journey,
        {
            "proof_details": {"status": "fetched"},
            "address": {"proof_type": "aadhaar"},
        },
    )
    assert applied is False
    assert journey.contact_draft_json is None


@pytest.mark.asyncio
async def test_apply_keeps_proof_street_lines_when_a_later_poll_has_none() -> None:
    journey = _onhold_journey()
    journey.contact_draft_json = {
        "source": "proof_details",
        "sameAsPermanent": True,
        "permanent": {"line1": "Aadhaar lane"},
    }
    applied = await apply_kra_update_proof_address(
        journey,
        {
            "proof_details": {"status": "fetched"},
            "address": {"proof_type": "aadhaar"},
        },
    )
    assert applied is False
    contact = journey.contact_draft_json
    assert isinstance(contact, dict)
    assert contact["permanent"]["line1"] == "Aadhaar lane"
