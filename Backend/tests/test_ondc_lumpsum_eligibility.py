from types import SimpleNamespace

import pytest

from app.application.mf.catalog_governance_service import is_product_investable
from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.ondc_lumpsum_eligibility import (
    ensure_fund_ondc_lumpsum_allowed,
    fund_allows_ondc_lumpsum,
)
from app.infrastructure.persistence.mf_models import (
    AdminInvestability,
    AdminVisibility,
    ProductLifecycleStatus,
)


def _fund(**overrides):
    defaults = {
        "is_active": True,
        "fp_oms_purchase_allowed": True,
        "fp_oms_active": True,
        "investment_constraints": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_fund_allows_ondc_lumpsum_when_not_blocked() -> None:
    assert fund_allows_ondc_lumpsum(_fund()) is True


def test_fund_blocks_ondc_after_recorded_failure() -> None:
    fund = _fund(
        investment_constraints={
            "gateway_purchase": {"ondc": {"allowed": False, "reason": "scheme_not_available_for_transaction"}},
        }
    )
    assert fund_allows_ondc_lumpsum(fund) is False


def test_ensure_fund_ondc_lumpsum_allowed_raises() -> None:
    fund = _fund(
        investment_constraints={
            "gateway_purchase": {"ondc": {"allowed": False}},
        }
    )
    with pytest.raises(MfOrderError) as exc:
        ensure_fund_ondc_lumpsum_allowed(fund)
    assert exc.value.code == "scheme_not_available"


def test_is_product_investable_respects_ondc_block() -> None:
    product = SimpleNamespace(
        lifecycle_status=ProductLifecycleStatus.active,
        admin_investability=AdminInvestability.auto,
        admin_visibility=AdminVisibility.auto,
    )
    amc = SimpleNamespace(is_active=True, admin_kill_switch=False)
    fund = _fund(
        investment_constraints={
            "gateway_purchase": {"ondc": {"allowed": False}},
        }
    )
    assert is_product_investable(product=product, fund=fund, amc=amc) is False
