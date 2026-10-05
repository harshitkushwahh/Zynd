from __future__ import annotations

from app.application.kyc.geolocation_service import round_kyc_geo_coordinate
from app.application.kyc.kyc_form_mapper import build_kyc_form_patch_payload
from app.infrastructure.persistence.models import KycJourneyState


def test_round_kyc_geo_coordinate_limits_decimal_places() -> None:
    assert round_kyc_geo_coordinate(12.9715987654321) == 12.971599
    assert round_kyc_geo_coordinate(77.5945627891234) == 77.594563


def test_build_kyc_form_patch_payload_rounds_geolocation() -> None:
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
    journey.geolocation_json = {
        "latitude": 28.613929812345,
        "longitude": 77.209012345678,
    }
    payload = build_kyc_form_patch_payload(
        user_email="user@example.com",
        user_phone="+919876543210",
        journey=journey,
    )
    assert payload["geolocation"] == {"latitude": 28.61393, "longitude": 77.209012}
