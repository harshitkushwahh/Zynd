from __future__ import annotations

from decimal import Decimal

import pytest

from app.application.mf.investment_constraints import (
    assert_sip_frequency_allowed,
    build_fallback_investment_details_from_fund,
    ensure_investment_details_on_fund_payload,
    investment_details_for_fund,
    normalize_sip_frequency,
    validate_sip_amount_for_frequency,
)
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.mf_sip_plan_service import (
    _validate_installment_day,
    validate_sip_cart_line,
)
from app.infrastructure.persistence.mf_models import MutualFund


def _fund(**kwargs) -> MutualFund:
    fund = MutualFund()
    for key, value in kwargs.items():
        setattr(fund, key, value)
    return fund


def test_normalize_sip_frequency_defaults_monthly() -> None:
    assert normalize_sip_frequency(None) == "monthly"
    assert normalize_sip_frequency("") == "monthly"
    assert normalize_sip_frequency("daily") == "daily"


def test_normalize_sip_frequency_rejects_unknown() -> None:
    with pytest.raises(MfOrderError) as exc:
        normalize_sip_frequency("weekly")
    assert exc.value.code == "invalid_frequency"


def test_daily_sip_not_available_when_oms_has_no_daily_bucket() -> None:
    fund = _fund(
        min_sip_amount=Decimal("500"),
        investment_constraints={
            "sip_options": [{"frequency": "monthly", "min_inr": 500.0}],
        },
    )
    with pytest.raises(MfOrderError) as exc:
        assert_sip_frequency_allowed(fund, "daily")
    assert exc.value.code == "daily_sip_not_available"


def test_daily_min_amount_from_sip_options() -> None:
    fund = _fund(
        min_sip_amount=Decimal("500"),
        investment_constraints={
            "sip_options": [
                {"frequency": "monthly", "min_inr": 500.0},
                {"frequency": "daily", "min_inr": 100.0},
            ],
        },
    )
    validate_sip_amount_for_frequency(fund, frequency="daily", amount_inr=Decimal("100"))
    with pytest.raises(MfOrderError) as exc:
        validate_sip_amount_for_frequency(fund, frequency="daily", amount_inr=Decimal("50"))
    assert exc.value.code == "below_minimum"


def test_installment_day_ignored_for_daily() -> None:
    assert _validate_installment_day(frequency="daily", installment_day=15) is None


def test_installment_day_required_for_monthly() -> None:
    with pytest.raises(MfOrderError) as exc:
        _validate_installment_day(frequency="monthly", installment_day=None)
    assert exc.value.code == "installment_day_required"


def test_investment_details_fallback_from_min_columns() -> None:
    fund = _fund(min_sip_amount=Decimal("500"), min_lumpsum_amount=Decimal("5000"))
    assert fund.investment_constraints is None
    payload = investment_details_for_fund(fund)
    assert payload is not None
    assert payload["lumpsum"]["min_inr"] == 5000.0
    assert payload["sip_options"][0]["min_inr"] == 500.0
    assert "sip" in payload["transaction_types"]


def test_investment_details_prefers_stored_constraints() -> None:
    stored = {
        "lumpsum": {"min_inr": 100.0},
        "sip_options": [{"frequency": "daily", "min_inr": 50.0}],
        "transaction_types": ["sip"],
    }
    fund = _fund(min_sip_amount=Decimal("500"), investment_constraints=stored)
    payload = investment_details_for_fund(fund)
    assert payload == stored


def test_ensure_investment_details_on_cached_fund_payload() -> None:
    patched = ensure_investment_details_on_fund_payload(
        {"min_sip_amount_inr": 100.0, "min_lumpsum_amount_inr": 5000.0}
    )
    assert patched["investment_details"]["lumpsum"]["min_inr"] == 5000.0
    assert patched["investment_details"]["sip_options"][0]["min_inr"] == 100.0


def test_build_fallback_returns_none_without_mins() -> None:
    fund = _fund()
    assert build_fallback_investment_details_from_fund(fund) is None


def test_validate_sip_cart_line_daily() -> None:
    fund = _fund(
        min_sip_amount=Decimal("500"),
        investment_constraints={
            "sip_options": [
                {"frequency": "monthly", "min_inr": 500.0},
                {"frequency": "daily", "min_inr": 100.0, "min_installments": 10},
            ],
        },
    )
    frequency, day, installments = validate_sip_cart_line(
        fund,
        amount_inr=Decimal("100"),
        frequency="daily",
        installment_day=20,
        number_of_installments=30,
    )
    assert frequency == "daily"
    assert day is None
    assert installments == 30
