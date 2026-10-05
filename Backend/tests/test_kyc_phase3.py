from __future__ import annotations

import pytest

from app.application.kyc.journey_gate_service import require_phase2_complete
from app.application.kyc.journey_state_service import _step_index
from app.application.kyc.kyc_form_mapper import build_kyc_form_patch_payload, data_url_to_file
from app.application.kyc.errors import KycError
from app.infrastructure.persistence.models import KycJourneyState, User


def test_step_index_includes_phase3_steps() -> None:
    assert _step_index("bank") == 5
    assert _step_index("signature") == 6
    assert _step_index("review") == 6


def test_data_url_to_file_decodes_png() -> None:
    content, filename, content_type = data_url_to_file(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    assert filename == "signature.png"
    assert content_type == "image/png"
    assert len(content) > 0


def test_build_kyc_form_patch_payload_maps_personal_fields() -> None:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = {
        "gender": "male",
        "maritalStatus": "unmarried",
        "occupation": "private_sector",
        "incomeSlab": "above_1lakh_upto_5lakh",
        "pepExposed": "not_applicable",
        "nationality": "India",
        "placeOfBirth": "Bengaluru",
        "fathersName": "Rajesh Gupta",
        "spouseName": "Should be ignored",
    }
    journey.contact_draft_json = {
        "permanent": {
            "line1": "12 MG Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
            "country": "India",
        },
        "sameAsPermanent": True,
    }
    journey.nominee_draft_json = [
        {
            "core": {
                "fullName": "Nominee One",
                "relationship": "spouse",
                "sharePercent": "100",
                "dateOfBirth": "1990-05-01",
            }
        }
    ]
    payload = build_kyc_form_patch_payload(
        user_email="user@example.com",
        user_phone="+919876543210",
        journey=journey,
    )
    assert payload["gender"] == "male"
    assert payload["occupation_type"] == "private_sector_service"
    assert payload["pep_details"] == "no_exposure"
    assert payload["non_indian_tax_residency_1"] is None
    assert payload["father_name"] == "Rajesh Gupta"
    assert "spouse_name" not in payload
    assert "permanent_address" not in payload
    assert "nominees" not in payload
    journey.geolocation_json = {"latitude": 12.9716, "longitude": 77.5946}
    payload_with_geo = build_kyc_form_patch_payload(
        user_email="user@example.com",
        user_phone="+919876543210",
        journey=journey,
    )
    assert payload_with_geo["geolocation"] == {"latitude": 12.9716, "longitude": 77.5946}


def test_build_kyc_form_patch_payload_includes_spouse_name_when_married() -> None:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = {
        "gender": "male",
        "maritalStatus": "married",
        "occupation": "business",
        "incomeSlab": "upto_1lakh",
        "pepExposed": "not_applicable",
        "nationality": "India",
        "placeOfBirth": "Indore",
        "fathersName": "Rajesh Gupta",
        "spouseName": "Anita Gupta",
    }
    journey.contact_draft_json = {
        "permanent": {
            "line1": "12 MG Road",
            "city": "Indore",
            "state": "Madhya Pradesh",
            "pincode": "452001",
            "country": "India",
        },
        "sameAsPermanent": True,
    }
    payload = build_kyc_form_patch_payload(
        user_email="user@example.com",
        user_phone="+919876543210",
        journey=journey,
    )
    assert payload["marital_status"] == "married"
    assert payload["spouse_name"] == "Anita Gupta"


def test_build_kyc_form_patch_payload_fathers_name_from_contact_care_of() -> None:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = {
        "gender": "male",
        "maritalStatus": "unmarried",
        "occupation": "others",
        "incomeSlab": "upto_1lakh",
        "pepExposed": "not_applicable",
        "nationality": "India",
        "placeOfBirth": "Bengaluru",
    }
    journey.contact_draft_json = {
        "permanent": {"city": "Bengaluru", "pincode": "560001", "country": "India"},
        "careOf": "S/o Ramesh Kumar",
    }
    payload = build_kyc_form_patch_payload(
        user_email="user@example.com",
        user_phone="+919876543210",
        journey=journey,
    )
    assert payload["father_name"] == "Ramesh Kumar"


def test_require_phase2_complete_requires_verified_bank() -> None:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = {"gender": "male"}
    journey.last_completed_step = "bank"
    journey.bank_draft_json = {"accountNumber": "1234567890"}
    journey.bank_verification_status = "pending"
    with pytest.raises(KycError) as exc:
        require_phase2_complete(journey)
    assert exc.value.code == "phase2_incomplete"
