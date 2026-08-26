from types import SimpleNamespace

from app.application.mf.investment_constraints import fund_allows_sip
from app.application.mf.ondc_sip_eligibility import (
    fund_has_ondc_sip_frequency,
    passes_ondc_sip_gateway_rules,
)


def _fund(**overrides):
    defaults = {
        "scheme_name": "Example Equity Fund",
        "sebi_category": "Equity Scheme - Large Cap Fund",
        "min_sip_amount": None,
        "investment_constraints": {
            "transaction_types": ["purchase", "sip"],
            "sip_options": [{"frequency": "monthly", "min_inr": 500.0}],
        },
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_fund_allows_sip_for_regular_equity_fund() -> None:
    assert fund_allows_sip(_fund()) is True


def test_fund_allows_sip_for_gold_fund_when_scheme_supports_sip() -> None:
    fund = _fund(
        scheme_name="Nippon India Gold Savings Fund - Growth Option",
        sebi_category="Other Scheme - FoF Domestic",
        min_sip_amount=100,
        investment_constraints={
            "transaction_types": ["purchase", "sip"],
            "sip_options": [{"frequency": "monthly", "min_inr": 100.0}],
        },
    )
    assert fund_allows_sip(fund, payment_gateway="ondc") is True


def test_fund_allows_sip_respects_transaction_types() -> None:
    fund = _fund(
        investment_constraints={
            "transaction_types": ["purchase"],
            "sip_options": [],
        }
    )
    assert fund_allows_sip(fund) is False


def test_fund_allows_sip_when_min_sip_amount_is_set() -> None:
    fund = _fund(
        min_sip_amount=500,
        investment_constraints={
            "transaction_types": ["purchase"],
            "sip_options": [],
        },
    )
    assert fund_allows_sip(fund, payment_gateway="ondc") is True


def test_fund_allows_sip_for_liquid_fund_with_min_sip_only() -> None:
    fund = _fund(
        scheme_name="ICICI Prudential Overnight Fund - Growth",
        sebi_category="Debt Scheme - Overnight Fund",
        min_sip_amount=500,
        investment_constraints=None,
    )
    assert fund_allows_sip(fund, payment_gateway="ondc") is True


def test_fund_allows_sip_when_sip_type_present_without_sip_options() -> None:
    fund = _fund(
        investment_constraints={
            "transaction_types": ["purchase", "sip"],
            "sip_options": [],
        }
    )
    assert fund_allows_sip(fund, payment_gateway="ondc") is True


def test_fund_allows_sip_blocks_non_ondc_frequencies_on_ondc() -> None:
    fund = _fund(
        investment_constraints={
            "transaction_types": ["purchase", "sip"],
            "sip_options": [{"frequency": "quarterly", "min_inr": 500.0}],
        }
    )
    assert fund_has_ondc_sip_frequency(fund) is False
    assert passes_ondc_sip_gateway_rules(fund, payment_gateway="ondc") is False
    assert fund_allows_sip(fund, payment_gateway="ondc") is False


def test_fund_allows_sip_ignores_legacy_ondc_sip_metadata() -> None:
    fund = _fund(
        min_sip_amount=500,
        investment_constraints={
            "transaction_types": ["purchase", "sip"],
            "sip_options": [{"frequency": "monthly", "min_inr": 500.0}],
            "ondc_sip": {
                "blocked": True,
                "blocked_at": "2026-01-01T00:00:00+00:00",
                "reason": "scheme not available",
            },
        },
    )
    assert fund_allows_sip(fund, payment_gateway="ondc") is True
