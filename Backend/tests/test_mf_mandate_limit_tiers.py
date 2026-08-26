from decimal import Decimal

from app.application.mf.mf_mandate_service import compute_mandate_limit_inr


def test_compute_mandate_limit_tier1_below_15000() -> None:
    assert compute_mandate_limit_inr(Decimal("5000")) == 15_000
    assert compute_mandate_limit_inr(Decimal("14999")) == 15_000


def test_compute_mandate_limit_tier2_from_15000_to_49999() -> None:
    assert compute_mandate_limit_inr(Decimal("15000")) == 50_000
    assert compute_mandate_limit_inr(Decimal("49999")) == 50_000


def test_compute_mandate_limit_tier3_from_50000() -> None:
    assert compute_mandate_limit_inr(Decimal("50000")) == 100_000
    assert compute_mandate_limit_inr(Decimal("75000")) == 100_000
