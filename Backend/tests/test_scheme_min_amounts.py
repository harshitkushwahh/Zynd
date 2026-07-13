from __future__ import annotations

from decimal import Decimal

from app.application.mf.scheme_row_normalizer import extract_min_amounts_from_scheme


def test_extract_min_amounts_from_scheme_flat_payload() -> None:
    amounts = extract_min_amounts_from_scheme(
        {
            "sip_minimum_installment_amount": "500",
            "min_initial_investment": "5000",
        }
    )
    assert amounts["min_sip_amount"] == Decimal("500")
    assert amounts["min_lumpsum_amount"] == Decimal("5000")


def test_extract_min_amounts_from_scheme_nested_data_payload() -> None:
    amounts = extract_min_amounts_from_scheme(
        {
            "data": {
                "min_sip_amount": 100,
                "min_initial_investment_amount": 1000,
            }
        }
    )
    assert amounts["min_sip_amount"] == Decimal("100")
    assert amounts["min_lumpsum_amount"] == Decimal("1000")


def test_extract_min_amounts_from_scheme_returns_none_when_missing() -> None:
    amounts = extract_min_amounts_from_scheme({"name": "Some Fund"})
    assert amounts["min_sip_amount"] is None
    assert amounts["min_lumpsum_amount"] is None


def test_extract_min_amounts_from_sip_frequency_specific_data() -> None:
    amounts = extract_min_amounts_from_scheme(
        {
            "sip_allowed": True,
            "min_initial_investment": 5000,
            "sip_frequency_specific_data": {
                "monthly": {"min_installment_amount": 500.0},
                "quarterly": {"min_installment_amount": 1500.0},
            },
        }
    )
    assert amounts["min_sip_amount"] == Decimal("500")
    assert amounts["min_lumpsum_amount"] == Decimal("5000")
