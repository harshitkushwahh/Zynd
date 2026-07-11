from __future__ import annotations

import pytest

from app.infrastructure.kyc.kyckart_client import KyckartError, parse_kyckart_bank_payload, parse_kyckart_pan_payload


def test_parse_kyckart_pan_payload_success_from_response_data() -> None:
    result = parse_kyckart_pan_payload(
        {
            "status": {"statusCode": 200},
            "response": {
                "code": 200,
                "data": {
                    "name": "RAHUL SHARMA",
                    "dateOfBirth": "1992-09-12",
                    "category": "individual",
                },
            },
        }
    )
    assert result["fullName"] == "RAHUL SHARMA"
    assert result["dateOfBirth"] == "1992-09-12"
    assert result["panCategory"] == "individual"


def test_parse_kyckart_pan_payload_invalid_pan_raises() -> None:
    with pytest.raises(KyckartError) as exc:
        parse_kyckart_pan_payload(
            {
                "status": {"statusCode": 200},
                "response": {"code": 400, "message": "Invalid PAN"},
            }
        )
    assert exc.value.code == "kyckart_pan_failed"
    assert exc.value.status_code == 400


def test_parse_kyckart_pan_payload_missing_dob_raises() -> None:
    with pytest.raises(KyckartError) as exc:
        parse_kyckart_pan_payload({"data": {"name": "RAHUL SHARMA"}})
    assert exc.value.code == "kyckart_incomplete"


def test_parse_kyckart_bank_payload_invalid_account_raises() -> None:
    with pytest.raises(KyckartError) as exc:
        parse_kyckart_bank_payload(
            {
                "status": {"statusCode": 200},
                "response": {"code": 400, "message": "INVALID ACCOUNT"},
            }
        )
    assert exc.value.code == "kyckart_bank_failed"
    assert exc.value.status_code == 400


def test_parse_kyckart_bank_payload_success() -> None:
    result = parse_kyckart_bank_payload(
        {
            "status": {"statusCode": 200},
            "response": {
                "code": 200,
                "data": {"accountHolderName": "RAHUL SHARMA"},
            },
        }
    )
    assert result["accountHolderName"] == "RAHUL SHARMA"


def test_parse_kyckart_bank_payload_success_from_nested_name_at_bank() -> None:
    result = parse_kyckart_bank_payload(
        {
            "status": {"statusCode": 200},
            "response": {
                "code": 200,
                "data": {"name_at_bank": "RAHUL SHARMA"},
            },
        }
    )
    assert result["accountHolderName"] == "RAHUL SHARMA"
