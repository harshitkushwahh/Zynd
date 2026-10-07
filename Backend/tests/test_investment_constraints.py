from __future__ import annotations

from app.application.mf.investment_constraints import (
    extract_investment_constraints_from_scheme,
    is_min_amount_fallback_details,
)


def test_extract_investment_constraints_full_payload() -> None:
    payload = extract_investment_constraints_from_scheme(
        {
            "purchase_allowed": True,
            "sip_allowed": True,
            "redemption_allowed": True,
            "stp_allowed": True,
            "swp_allowed": False,
            "switch_in_allowed": True,
            "min_initial_investment": 1000,
            "max_initial_investment": 999999999,
            "initial_investment_multiples": 1,
            "min_additional_investment": 100,
            "max_additional_investment": 999999999,
            "additional_investment_multiples": 1,
            "min_withdrawal_amount": 100,
            "min_withdrawal_units": 0.001,
            "withdrawal_unit_multiples": 0.001,
            "switch_in_min_amt": 500,
            "sip_frequency_specific_data": {
                "monthly": {
                    "min_installment_amount": 500,
                    "max_installment_amount": 999999999,
                    "amount_multiples": 1,
                    "min_installments": 6,
                }
            },
        }
    )
    assert payload is not None
    assert payload["lumpsum"]["min_inr"] == 1000.0
    assert payload["additional"]["min_inr"] == 100.0
    assert payload["redemption"]["min_inr"] == 100.0
    assert payload["redemption"]["min_units"] == 0.001
    assert payload["switch"]["min_in_inr"] == 500.0
    assert payload["sip_options"][0]["frequency"] == "monthly"
    assert payload["sip_options"][0]["min_installments"] == 6
    assert "purchase" in payload["transaction_types"]
    assert "sip" in payload["transaction_types"]
    assert "switch" in payload["transaction_types"]
    assert "swp" not in payload["transaction_types"]


def test_switch_allowed_when_only_switch_out() -> None:
    payload = extract_investment_constraints_from_scheme(
        {
            "switch_in_allowed": False,
            "switch_out_allowed": True,
            "min_switch_out_amount": 100,
        }
    )
    assert payload is not None
    assert "switch" in payload["transaction_types"]


def test_stp_allowed_from_stp_in_or_out_flags() -> None:
    payload = extract_investment_constraints_from_scheme(
        {
            "stp_in_allowed": True,
            "stp_out_allowed": True,
            "purchase_allowed": True,
        }
    )
    assert payload is not None
    assert "stp" in payload["transaction_types"]


def test_extract_investment_constraints_returns_none_when_empty() -> None:
    assert extract_investment_constraints_from_scheme({"name": "Empty Fund"}) is None


def test_is_min_amount_fallback_details() -> None:
    assert is_min_amount_fallback_details({"transaction_types": ["purchase", "sip"], "sip_options": []})
    assert not is_min_amount_fallback_details(
        {
            "transaction_types": ["purchase", "sip", "redemption"],
            "sip_options": [{"frequency": "monthly", "min_installments": 6}],
        }
    )
