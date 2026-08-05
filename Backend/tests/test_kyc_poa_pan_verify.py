from __future__ import annotations

import time

import pytest

from app.infrastructure.kyc.date_utils import normalize_kyc_date_of_birth
from app.infrastructure.kyc.fp_clients import (
    FpClientError,
    _CachedToken,
    _is_auth_token_error,
    _is_token_still_valid,
    _jwt_expires_at,
    _parse_fp_error_message,
    _token_expires_at,
)
from app.infrastructure.kyc.kyckart_client import KyckartError, parse_kyckart_pan_payload


def test_normalize_kyc_date_of_birth_iso_passthrough() -> None:
    assert normalize_kyc_date_of_birth("1992-09-12") == "1992-09-12"


def test_normalize_kyc_date_of_birth_from_indian_format() -> None:
    assert normalize_kyc_date_of_birth("12-09-1992") == "1992-09-12"
    assert normalize_kyc_date_of_birth("12/09/1992") == "1992-09-12"


def test_jwt_expires_at_reads_exp_claim() -> None:
    import base64
    import json

    payload = base64.urlsafe_b64encode(json.dumps({"exp": 1_899_999_999}).encode()).decode().rstrip("=")
    token = f"header.{payload}.signature"
    assert _jwt_expires_at(token) == 1_899_999_999.0


def test_is_token_still_valid_honors_refresh_buffer() -> None:
    cached = _CachedToken(value="token", expires_at=time.time() + 30)
    assert _is_token_still_valid(cached) is False

    cached = _CachedToken(value="token", expires_at=time.time() + 120)
    assert _is_token_still_valid(cached) is True


def test_token_expires_at_prefers_jwt_exp() -> None:
    import base64
    import json

    payload = base64.urlsafe_b64encode(json.dumps({"exp": 1_900_000_000}).encode()).decode().rstrip("=")
    token = f"header.{payload}.signature"
    assert _token_expires_at(token, 60) == 1_900_000_000.0


def test_is_auth_token_error_detects_jwt_expired() -> None:
    exc = FpClientError(
        "Invalid token: An error occurred while attempting to decode the Jwt: Jwt expired at 2026-08-04T08:22:27Z",
        status_code=401,
    )
    assert _is_auth_token_error(exc) is True


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
