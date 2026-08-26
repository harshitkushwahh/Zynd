from __future__ import annotations

from decimal import Decimal

import pytest

from app.application.mf.mf_fp_state import map_fp_redemption_state_to_order
from app.application.mf.mf_redemption_service import (
    _amount_matches_multiple,
    _extract_folio_consent_contacts,
    _mask_email,
    _mask_mobile,
    _normalize_folio_mobile,
    _units_matches_multiple,
    _validate_redemption_amount,
    _validate_redemption_units,
)
from app.application.mf.mf_order_errors import MfOrderError
from app.infrastructure.persistence.mf_transaction_models import MfOrderStatus


def test_map_fp_redemption_state_to_order() -> None:
    assert map_fp_redemption_state_to_order("pending") == MfOrderStatus.payment_pending
    assert map_fp_redemption_state_to_order("confirmed") == MfOrderStatus.processing
    assert map_fp_redemption_state_to_order("submitted") == MfOrderStatus.submitted
    assert map_fp_redemption_state_to_order("successful") == MfOrderStatus.succeeded


def test_extract_folio_consent_contacts() -> None:
    email, mobile = _extract_folio_consent_contacts(
        {
            "data": [
                {
                    "email_addresses": ["investor@example.com"],
                    "mobile_numbers": ["+919876543210"],
                }
            ]
        }
    )
    assert email == "investor@example.com"
    assert mobile == "9876543210"


def test_mask_helpers() -> None:
    assert _mask_email("investor@example.com") == "i•••r@example.com"
    assert _mask_mobile("9876543210").endswith("3210")
    assert _normalize_folio_mobile("+919876543210") == "9876543210"


def test_validate_redemption_amount_bounds() -> None:
    _validate_redemption_amount(
        amount_inr=Decimal("1000"),
        redeemable_amount_inr=5000,
        constraints={"redemption": {"min_inr": 500, "max_inr": 4000, "multiples_inr": 1}},
    )
    with pytest.raises(MfOrderError):
        _validate_redemption_amount(
            amount_inr=Decimal("100"),
            redeemable_amount_inr=5000,
            constraints={"redemption": {"min_inr": 500}},
        )


def test_validate_redemption_units_bounds() -> None:
    _validate_redemption_units(
        units=10.5,
        redeemable_units=100,
        constraints={"redemption": {"min_units": 1, "unit_multiples": 0.001}},
    )
    with pytest.raises(MfOrderError):
        _validate_redemption_units(units=200, redeemable_units=100, constraints=None)


def test_multiple_checks() -> None:
    assert _amount_matches_multiple(Decimal("1000"), 100) is True
    assert _units_matches_multiple(10.001, 0.001) is True
