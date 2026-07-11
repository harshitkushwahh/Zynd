from __future__ import annotations

import pytest

from app.infrastructure.kyc.date_utils import normalize_kyc_date_of_birth
from app.infrastructure.kyc.fp_clients import FpClientError, _parse_fp_error_message
from app.infrastructure.kyc.kyckart_client import KyckartError, parse_kyckart_pan_payload


def test_normalize_kyc_date_of_birth_iso_passthrough() -> None:
    assert normalize_kyc_date_of_birth("1992-09-12") == "1992-09-12"


def test_normalize_kyc_date_of_birth_from_indian_format() -> None:
    assert normalize_kyc_date_of_birth("12-09-1992") == "1992-09-12"
    assert normalize_kyc_date_of_birth("12/09/1992") == "1992-09-12"


def test_parse_fp_error_message_from_cybrilla_validation_errors() -> None:
    message = _parse_fp_error_message(
        {
            "error": {
                "status": 400,
                "message": "Validation failed. 1 error(s)",
                "errors": [{"field": "date_of_birth", "message": "invalid date of birth"}],
            }
        },
        fallback="fallback",
    )
    assert message == "date_of_birth: invalid date of birth"


def test_parse_kyckart_pan_payload_normalizes_dob_for_poa() -> None:
    result = parse_kyckart_pan_payload(
        {
            "response": {
                "code": 200,
                "data": {
                    "name": "RAHUL SHARMA",
                    "dateOfBirth": "12-09-1992",
                    "category": "individual",
                },
            }
        }
    )
    assert result["dateOfBirth"] == "1992-09-12"


def test_parse_kyckart_pan_payload_invalid_dob_raises() -> None:
    with pytest.raises(KyckartError) as exc:
        parse_kyckart_pan_payload(
            {
                "response": {
                    "code": 200,
                    "data": {
                        "name": "RAHUL SHARMA",
                        "dateOfBirth": "not-a-date",
                        "category": "individual",
                    },
                }
            }
        )
    assert exc.value.code == "kyckart_incomplete"
