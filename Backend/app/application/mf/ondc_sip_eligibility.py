"""ONDC-specific SIP frequency rules."""

from __future__ import annotations

from app.core.config import get_settings
from app.infrastructure.persistence.mf_models import MutualFund

ONDC_SUPPORTED_SIP_FREQUENCIES = frozenset({"monthly", "daily"})


def fund_has_ondc_sip_frequency(fund: MutualFund) -> bool:
    """ONDC SIP plans only support daily and monthly frequencies."""
    constraints = fund.investment_constraints
    if not isinstance(constraints, dict):
        return True
    sip_options = constraints.get("sip_options")
    if not isinstance(sip_options, list) or not sip_options:
        return True
    for option in sip_options:
        if not isinstance(option, dict):
            continue
        frequency = str(option.get("frequency") or "").strip().lower()
        if frequency in ONDC_SUPPORTED_SIP_FREQUENCIES:
            return True
    return False


def ondc_sip_gateway_active(*, payment_gateway: str | None = None) -> bool:
    gateway = (payment_gateway or get_settings().zynd_mf_order_payment_gateway).strip().lower()
    return gateway == "ondc"


def passes_ondc_sip_gateway_rules(fund: MutualFund, *, payment_gateway: str | None = None) -> bool:
    if not ondc_sip_gateway_active(payment_gateway=payment_gateway):
        return True
    return fund_has_ondc_sip_frequency(fund)
