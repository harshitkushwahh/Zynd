from __future__ import annotations

from cryptography.hazmat.primitives.asymmetric import rsa

from app.application.mf.cas_import_service import normalize_cas_mobile, parse_cas_date, parse_cas_schemes
from app.application.mf.portfolio_holdings_service import (
    combined_invested_inr,
    hide_external_until_allotted,
    portfolio_has_platform_units,
)
from app.infrastructure.mf.mf_central_crypto import (
    decrypt_api_payload,
    encrypt_api_payload,
    encrypt_launch_payload,
    sign_detached,
    verify_detached,
)


def test_api_payload_round_trip() -> None:
    payload = {"clientRefNo": "abc", "pan": "ABCDE1234F", "mobile": "+919876543210"}
    ciphertext = encrypt_api_payload(payload, encryption_key="test-shared-key", iv="globalaesvectors")
    assert decrypt_api_payload(ciphertext, encryption_key="test-shared-key", iv="globalaesvectors") == payload


def test_detached_jws_round_trip() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    payload = "encrypted-body"
    signature = sign_detached(payload, private_key=private_key, kid="test-kid")
    assert signature.split(".")[1] == ""
    verify_detached(signature, payload, public_key=private_key.public_key())


def test_launch_payload_is_url_encoded() -> None:
    encoded = encrypt_launch_payload(
        {"reqId": "1", "otpRef": "otp"},
        url_key="odLZvcdVAhq+Re8UstN8u928xRQTE6ym",
    )
    assert ":" not in encoded
    assert "%" in encoded


def test_parse_summary_and_detailed_schemes() -> None:
    summary = parse_cas_schemes(
        {
            "data": [
                {
                    "schemes": [
                        {
                            "isin": "inf789f01513",
                            "schemeName": "UTI Flexi Cap Fund - Regular Plan",
                            "folio": "599366447236",
                            "closingBalance": "16.521",
                            "nav": "321.7826",
                            "navDate": "01-Jan-2026",
                            "currentMktValue": "5316.17",
                            "costValue": "4999.75",
                            "amcName": "UTI MUTUAL FUND",
                            "bank": {"accountNo": "068001510540"},
                        }
                    ]
                }
            ]
        }
    )
    assert summary[0]["isin"] == "INF789F01513"
    assert summary[0]["folio_number"] == "599366447236"
    assert summary[0]["units"] == "16.521"
    assert summary[0]["cost_value_inr"] == "4999.75"
    assert "bank" not in summary[0]
    assert parse_cas_date("11-JUL-2024") is not None
    assert parse_cas_date("11-JUL-2024").isoformat() == "2024-07-11"

    detailed = parse_cas_schemes(
        {
            "data": [
                {
                    "dtSummary": [
                        {
                            "isin": "INF179K01608",
                            "schemeName": "HDFC Flexi Cap Fund",
                            "folio": "17064219",
                            "closingBalance": "43.614",
                            "nav": "150.000",
                            "lastNavDate": "11-JUL-2024",
                            "marketValue": "6542.10",
                            "costValue": "38000",
                            "amcName": "MFHMF Test Fund",
                        }
                    ]
                }
            ]
        }
    )
    assert detailed[0]["market_value_inr"] == "6542.10"
    assert detailed[0]["folio_number"] == "17064219"


def test_parse_cas_schemes_skips_amc_summary_without_isin() -> None:
    rows = parse_cas_schemes({"data": [{"summary": [{"amcName": "UTI", "currentMktValue": 1}]}]})
    assert rows == []


def test_normalize_cas_mobile() -> None:
    assert normalize_cas_mobile("9876543210") == "+919876543210"
    assert normalize_cas_mobile("+919876543210") == "+919876543210"
    assert normalize_cas_mobile("") == ""


def test_external_holdings_stay_hidden_until_platform_allotment() -> None:
    rows = [
        {"source": "zynd", "units": 0, "isin": "INF1"},
        {"source": "external", "units": 10, "isin": "INF2"},
    ]
    assert portfolio_has_platform_units(rows) is False
    assert hide_external_until_allotted(rows, allotted=False) == [rows[0]]
    assert portfolio_has_platform_units([{"source": "zynd", "units": 1.2}]) is True
    assert hide_external_until_allotted(rows, allotted=True) == rows


def test_combined_invested_adds_external_cost() -> None:
    invested = combined_invested_inr(
        fp_invested=1000,
        holdings=[
            {"source": "zynd", "invested_inr": 1000, "current_value_inr": 1100},
            {"source": "external", "invested_inr": 400, "current_value_inr": 500},
        ],
    )
    assert invested == 1400


def test_signature_rejects_tampered_payload() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    signature = sign_detached("original", private_key=private_key, kid="kid")
    try:
        verify_detached(signature, "tampered", public_key=private_key.public_key())
    except Exception as exc:
        assert "verification failed" in str(exc)
    else:
        raise AssertionError("tampered payload was accepted")
