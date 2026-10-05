from __future__ import annotations

from app.application.kyc.kyc_form_mapper import (
    build_kyc_form_patch_payload,
    filter_kyc_form_patch_for_requirements,
    kyc_form_needs_demographic_patch,
)
from app.infrastructure.persistence.models import KycJourneyState


def _journey_with_personal() -> KycJourneyState:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = {
        "gender": "male",
        "maritalStatus": "unmarried",
        "occupation": "business",
        "incomeSlab": "upto_1lakh",
        "pepExposed": "not_applicable",
        "nationality": "India",
        "placeOfBirth": "Indore",
        "fathersName": "Rajesh Gupta",
    }
    journey.contact_draft_json = {"permanent": {"city": "Indore"}}
    return journey


def test_filter_skips_patch_when_only_proof_fields_needed() -> None:
    journey = _journey_with_personal()
    payload = build_kyc_form_patch_payload(
        user_email="user@example.com",
        user_phone="+919876543210",
        journey=journey,
    )
    form = {
        "email_address": "user@example.com",
        "phone_number": {"isd": "+91", "number": "9876543210"},
        "gender": "male",
        "marital_status": "unmarried",
        "occupation_type": "business",
        "income_slab": "upto_1lakh",
        "pep_details": "no_exposure",
        "country_of_birth": "in",
        "place_of_birth": "Indore",
        "nationality_country": "in",
        "requirements": {"fields_needed": ["identity_proof", "address", "signature"]},
    }
    assert filter_kyc_form_patch_for_requirements(form, payload) == {}
    assert kyc_form_needs_demographic_patch(form, payload) is False


def test_filter_allows_full_patch_when_form_missing_demographics() -> None:
    journey = _journey_with_personal()
    payload = build_kyc_form_patch_payload(
        user_email="user@example.com",
        user_phone="+919876543210",
        journey=journey,
    )
    form = {
        "requirements": {"fields_needed": ["identity_proof", "address", "signature"]},
    }
    assert filter_kyc_form_patch_for_requirements(form, payload) == {}
    assert kyc_form_needs_demographic_patch(form, payload) is True
