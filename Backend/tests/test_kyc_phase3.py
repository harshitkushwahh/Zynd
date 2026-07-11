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
    assert payload["father_name"] == "Rajesh Gupta"
    assert payload["permanent_address"]["city"] == "Bengaluru"
    assert payload["nominees"][0]["name"] == "Nominee One"


def test_require_phase2_complete_requires_verified_bank() -> None:
    journey = KycJourneyState(user_id=None)  # type: ignore[arg-type]
    journey.personal_draft_json = {"gender": "male"}
    journey.last_completed_step = "bank"
    journey.bank_draft_json = {"accountNumber": "1234567890"}
    journey.bank_verification_status = "pending"
    with pytest.raises(KycError) as exc:
        require_phase2_complete(journey)
    assert exc.value.code == "phase2_incomplete"
