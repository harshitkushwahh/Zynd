from __future__ import annotations

from typing import Any

from app.application.mf.ondc_sip_eligibility import passes_ondc_sip_gateway_rules
from app.application.mf.scheme_row_normalizer import to_decimal, unwrap_cybrilla_scheme_payload
from app.infrastructure.persistence.mf_models import MutualFund

SIP_FREQUENCY_ORDER = ("monthly", "quarterly", "weekly", "daily")
TRANSACTION_TYPE_FIELDS = (
    ("purchase", ("purchase_allowed", "active")),
    ("sip", ("sip_allowed",)),
    ("redemption", ("redemption_allowed",)),
    ("switch", ("switch_in_allowed", "switch_out_allowed")),
    ("swp", ("swp_allowed",)),
    ("stp", ("stp_allowed",)),
)


def _to_api_amount(value: Any) -> float | None:
    decimal_value = to_decimal(value)
    if decimal_value is None:
        return None
    return float(decimal_value)


def _to_api_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _scheme_flag(scheme: dict[str, Any], *keys: str) -> bool:
    for key in keys:
        value = scheme.get(key)
        if value is not None:
            return bool(value)
    return False


def _extract_sip_options(scheme: dict[str, Any]) -> list[dict[str, Any]]:
    freq_data = scheme.get("sip_frequency_specific_data")
    if not isinstance(freq_data, dict):
        return []

    options: list[dict[str, Any]] = []
    for frequency in SIP_FREQUENCY_ORDER:
        block = freq_data.get(frequency)
        if not isinstance(block, dict):
            continue
        min_inr = _to_api_amount(block.get("min_installment_amount"))
        max_inr = _to_api_amount(block.get("max_installment_amount"))
        multiples_inr = _to_api_amount(block.get("amount_multiples"))
        min_installments = _to_api_int(block.get("min_installments"))
        if min_inr is None and max_inr is None and min_installments is None:
            continue
        options.append(
            {
                "frequency": frequency,
                "min_inr": min_inr,
                "max_inr": max_inr,
                "multiples_inr": multiples_inr,
                "min_installments": min_installments,
            }
        )
    return options


def _extract_transaction_types(scheme: dict[str, Any]) -> list[str]:
    types: list[str] = []
    for label, keys in TRANSACTION_TYPE_FIELDS:
        if _scheme_flag(scheme, *keys):
            types.append(label)
    return types


def extract_investment_constraints_from_scheme(raw: dict[str, Any]) -> dict[str, Any] | None:
    scheme = unwrap_cybrilla_scheme_payload(raw)

    lumpsum = {
        "min_inr": _to_api_amount(
            scheme.get("min_initial_investment") or scheme.get("min_initial_investment_amount")
        ),
        "max_inr": _to_api_amount(
            scheme.get("max_initial_investment") or scheme.get("max_initial_investment_amount")
        ),
        "multiples_inr": _to_api_amount(scheme.get("initial_investment_multiples")),
    }
    additional = {
        "min_inr": _to_api_amount(scheme.get("min_additional_investment")),
        "max_inr": _to_api_amount(scheme.get("max_additional_investment")),
        "multiples_inr": _to_api_amount(scheme.get("additional_investment_multiples")),
    }
    redemption = {
        "min_inr": _to_api_amount(scheme.get("min_withdrawal_amount")),
        "max_inr": _to_api_amount(scheme.get("max_withdrawal_amount")),
        "multiples_inr": _to_api_amount(scheme.get("withdrawal_multiples")),
        "min_units": _to_api_amount(scheme.get("min_withdrawal_units")),
        "unit_multiples": _to_api_amount(scheme.get("withdrawal_unit_multiples")),
    }
    switch_constraints = {
        "min_in_inr": _to_api_amount(
            scheme.get("switch_in_min_amt") or scheme.get("min_switch_in_amount")
        ),
        "min_out_inr": _to_api_amount(scheme.get("min_switch_out_amount")),
        "min_out_units": _to_api_amount(scheme.get("min_switch_out_units")),
    }
    sip_options = _extract_sip_options(scheme)
    transaction_types = _extract_transaction_types(scheme)

    has_data = any(
        [
            lumpsum["min_inr"],
            lumpsum["max_inr"],
            additional["min_inr"],
            redemption["min_inr"],
            redemption["min_units"],
            sip_options,
            transaction_types,
        ]
    )
    if not has_data:
        return None

    return {
        "lumpsum": lumpsum,
        "additional": additional,
        "redemption": redemption,
        "switch": switch_constraints,
        "sip_options": sip_options,
        "transaction_types": transaction_types,
    }


def serialize_investment_constraints_for_api(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not payload:
        return None
    return payload


def fund_allows_sip(fund: MutualFund, *, payment_gateway: str | None = None) -> bool:
    """Whether SIP can be offered for this fund on the configured order/payment network."""
    if fund.min_sip_amount is not None:
        return passes_ondc_sip_gateway_rules(fund, payment_gateway=payment_gateway)

    constraints = fund.investment_constraints
    if not isinstance(constraints, dict):
        return passes_ondc_sip_gateway_rules(fund, payment_gateway=payment_gateway)

    transaction_types = constraints.get("transaction_types")
    if isinstance(transaction_types, list) and transaction_types and "sip" not in transaction_types:
        return False

    sip_options = constraints.get("sip_options")
    if isinstance(sip_options, list) and not sip_options:
        has_sip_type = isinstance(transaction_types, list) and "sip" in transaction_types
        if not has_sip_type:
            return False

    return passes_ondc_sip_gateway_rules(fund, payment_gateway=payment_gateway)
