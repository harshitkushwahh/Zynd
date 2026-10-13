"""ONDC lumpsum availability (Finprim may reject schemes Cybrilla marks purchase_allowed)."""

from __future__ import annotations

from typing import Any

from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.ondc_sip_eligibility import ondc_sip_gateway_active
from app.infrastructure.persistence.mf_models import MutualFund

GATEWAY_PURCHASE_KEY = "gateway_purchase"
ONDC_LUMPSUM_BLOCK_REASON = "scheme_not_available_for_transaction"


def _gateway_purchase_block(constraints: dict[str, Any] | None, *, gateway: str) -> bool:
    if not isinstance(constraints, dict):
        return False
    gateway_map = constraints.get(GATEWAY_PURCHASE_KEY)
    if not isinstance(gateway_map, dict):
        return False
    entry = gateway_map.get(gateway)
    if not isinstance(entry, dict):
        return False
    return entry.get("allowed") is False


def fund_allows_ondc_lumpsum(fund: MutualFund, *, payment_gateway: str | None = None) -> bool:
    if not ondc_sip_gateway_active(payment_gateway=payment_gateway):
        return True
    return not _gateway_purchase_block(fund.investment_constraints, gateway="ondc")


def ensure_fund_ondc_lumpsum_allowed(fund: MutualFund, *, payment_gateway: str | None = None) -> None:
    if fund_allows_ondc_lumpsum(fund, payment_gateway=payment_gateway):
        return
    raise MfOrderError(
        code="scheme_not_available",
        message=(
            "This fund is not available to buy through ONDC for your account right now. "
            "Try another fund or check back later."
        ),
        status_code=409,
    )


async def record_ondc_lumpsum_scheme_unavailable(session, fund: MutualFund | None) -> None:
    if fund is None:
        return
    constraints = dict(fund.investment_constraints or {})
    gateway_map = dict(constraints.get(GATEWAY_PURCHASE_KEY) or {})
    gateway_map["ondc"] = {
        "allowed": False,
        "reason": ONDC_LUMPSUM_BLOCK_REASON,
    }
    constraints[GATEWAY_PURCHASE_KEY] = gateway_map
    fund.investment_constraints = constraints
    await session.flush()
    if fund.product_id is not None:
        from app.application.mf.invest_catalog_cache import invalidate_invest_fund_detail_cache

        await invalidate_invest_fund_detail_cache(str(fund.product_id))
