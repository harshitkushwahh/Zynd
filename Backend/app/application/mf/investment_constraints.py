from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.application.mf.mf_order_errors import MfOrderError
from app.application.mf.ondc_sip_eligibility import passes_ondc_sip_gateway_rules
from app.application.mf.scheme_row_normalizer import to_decimal, unwrap_cybrilla_scheme_payload
from app.infrastructure.persistence.mf_models import MutualFund

SIP_FREQUENCY_MONTHLY = "monthly"
SIP_FREQUENCY_DAILY = "daily"
SUPPORTED_SIP_FREQUENCIES = frozenset({SIP_FREQUENCY_MONTHLY, SIP_FREQUENCY_DAILY})

SIP_FREQUENCY_ORDER = ("monthly", "quarterly", "weekly", "daily", "calendar_day_daily")
SIP_FREQUENCY_ALIASES = frozenset({"calendar_day_daily"})
TRANSACTION_TYPE_FIELDS = (
    ("purchase", ("purchase_allowed", "active")),
    ("sip", ("sip_allowed",)),
    ("redemption", ("redemption_allowed",)),
    ("switch", ("switch_in_allowed", "switch_out_allowed")),
    ("swp", ("swp_allowed",)),
    ("stp", ("stp_allowed", "stp_in_allowed", "stp_out_allowed")),
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
    """True when any listed Cybrilla flag is explicitly true (e.g. switch in OR out)."""
    values = [scheme.get(key) for key in keys if scheme.get(key) is not None]
    if not values:
        return False
    return any(bool(value) for value in values)


def _extract_sip_options(scheme: dict[str, Any]) -> list[dict[str, Any]]:
    freq_data = scheme.get("sip_frequency_specific_data")
    if not isinstance(freq_data, dict):
        return []

    options: list[dict[str, Any]] = []
    seen_frequencies: set[str] = set()
    for frequency in SIP_FREQUENCY_ORDER:
        if frequency in SIP_FREQUENCY_ALIASES:
            continue
        block = freq_data.get(frequency)
        if not isinstance(block, dict):
            continue
        min_inr = _to_api_amount(block.get("min_installment_amount"))
        max_inr = _to_api_amount(block.get("max_installment_amount"))
        multiples_inr = _to_api_amount(block.get("amount_multiples"))
        min_installments = _to_api_int(block.get("min_installments"))
        if min_inr is None and max_inr is None and min_installments is None:
            continue
        if frequency in seen_frequencies:
            continue
        seen_frequencies.add(frequency)
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


def investment_details_from_min_amounts(
    *,
    min_sip_inr: Any = None,
    min_lumpsum_inr: Any = None,
) -> dict[str, Any] | None:
    """Minimal investment details from catalog min columns when OMS JSON was not backfilled yet."""
    lumpsum_min = _to_api_amount(min_lumpsum_inr)
    sip_min = _to_api_amount(min_sip_inr)
    if lumpsum_min is None and sip_min is None:
        return None

    sip_options: list[dict[str, Any]] = []
    if sip_min is not None:
        sip_options.append({"frequency": SIP_FREQUENCY_MONTHLY, "min_inr": sip_min})

    transaction_types: list[str] = []
    if lumpsum_min is not None:
        transaction_types.append("purchase")
    if sip_min is not None:
        transaction_types.append("sip")

    return {
        "lumpsum": {"min_inr": lumpsum_min, "max_inr": None, "multiples_inr": None}
        if lumpsum_min is not None
        else None,
        "additional": None,
        "redemption": None,
        "switch": None,
        "sip_options": sip_options,
        "transaction_types": transaction_types,
    }


def build_fallback_investment_details_from_fund(fund: MutualFund) -> dict[str, Any] | None:
    return investment_details_from_min_amounts(
        min_sip_inr=fund.min_sip_amount,
        min_lumpsum_inr=fund.min_lumpsum_amount,
    )


def is_min_amount_fallback_details(details: dict[str, Any] | None) -> bool:
    """True for catalog-min fallback payloads, not full Cybrilla investment_constraints."""
    if not isinstance(details, dict):
        return True
    if details.get("redemption") or details.get("switch"):
        return False
    tx = details.get("transaction_types")
    if isinstance(tx, list) and any(t not in {"purchase", "sip"} for t in tx):
        return False
    for opt in details.get("sip_options") or []:
        if isinstance(opt, dict) and opt.get("min_installments") is not None:
            return False
    return True


def ensure_investment_details_on_fund_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Fill investment_details on fund detail payloads (incl. stale Redis cache entries)."""
    existing = payload.get("investment_details")
    if existing and not is_min_amount_fallback_details(existing):
        return payload
    details = investment_details_from_min_amounts(
        min_sip_inr=payload.get("min_sip_amount_inr"),
        min_lumpsum_inr=payload.get("min_lumpsum_amount_inr"),
    )
    if not details:
        return payload
    merged = dict(payload)
    merged["investment_details"] = details
    return merged


def investment_details_for_fund(fund: MutualFund) -> dict[str, Any] | None:
    """Full OMS snapshot when present; otherwise min SIP/lumpsum fallback for fund detail UI."""
    stored = serialize_investment_constraints_for_api(fund.investment_constraints)
    if stored:
        return stored
    return build_fallback_investment_details_from_fund(fund)


async def resolve_investment_details_for_fund(
    session: Any,
    fund: MutualFund,
) -> dict[str, Any] | None:
    """Prefer stored OMS JSON; on miss, fetch Cybrilla once and persist for fund detail UI."""
    stored = serialize_investment_constraints_for_api(fund.investment_constraints)
    if stored and not is_min_amount_fallback_details(stored):
        return stored

    from app.core.config import get_settings
    from app.infrastructure.mf.fp_oms_client import get_fund_scheme_by_isin

    settings = get_settings()
    if settings.resolved_fp_enabled and fund.isin_growth:
        try:
            raw = await get_fund_scheme_by_isin(fund.isin_growth)
            constraints = extract_investment_constraints_from_scheme(raw)
            if constraints:
                fund.investment_constraints = constraints
                await session.flush()
                if fund.product_id is not None:
                    from app.application.mf.invest_catalog_cache import invalidate_invest_fund_detail_cache

                    await invalidate_invest_fund_detail_cache(str(fund.product_id))
                return constraints
        except Exception:
            pass

    return build_fallback_investment_details_from_fund(fund)


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


def normalize_sip_frequency(frequency: str | None) -> str:
    normalized = (frequency or SIP_FREQUENCY_MONTHLY).strip().lower()
    if normalized not in SUPPORTED_SIP_FREQUENCIES:
        raise MfOrderError(
            code="invalid_frequency",
            message="Only monthly and daily SIP frequencies are supported",
        )
    return normalized


def _sip_options_list(fund: MutualFund) -> list[dict[str, Any]]:
    constraints = fund.investment_constraints
    if not isinstance(constraints, dict):
        return []
    raw = constraints.get("sip_options")
    if not isinstance(raw, list):
        return []
    return [option for option in raw if isinstance(option, dict)]


def sip_option_for_frequency(fund: MutualFund, frequency: str) -> dict[str, Any] | None:
    normalized = normalize_sip_frequency(frequency)
    for option in _sip_options_list(fund):
        if str(option.get("frequency") or "").strip().lower() == normalized:
            return option
    return None


def assert_sip_frequency_allowed(fund: MutualFund, frequency: str) -> dict[str, Any] | None:
    """Return the OMS sip_options block for frequency, or None when falling back to fund-level mins."""
    normalized = normalize_sip_frequency(frequency)
    option = sip_option_for_frequency(fund, normalized)
    options = _sip_options_list(fund)
    if normalized == SIP_FREQUENCY_DAILY and options and option is None:
        raise MfOrderError(
            code="daily_sip_not_available",
            message="Daily SIP is not available for this fund.",
        )
    return option


def resolve_min_sip_amount_for_frequency(
    fund: MutualFund,
    frequency: str,
    *,
    option: dict[str, Any] | None = None,
) -> Decimal | None:
    normalized = normalize_sip_frequency(frequency)
    block = option if option is not None else sip_option_for_frequency(fund, normalized)
    if block is not None and block.get("min_inr") is not None:
        return to_decimal(block.get("min_inr"))
    if normalized == SIP_FREQUENCY_MONTHLY and fund.min_sip_amount is not None:
        return fund.min_sip_amount
    return None


def resolve_min_installments_for_frequency(
    fund: MutualFund,
    frequency: str,
    *,
    option: dict[str, Any] | None = None,
) -> int | None:
    normalized = normalize_sip_frequency(frequency)
    block = option if option is not None else sip_option_for_frequency(fund, normalized)
    if block is None:
        return None
    return _to_api_int(block.get("min_installments"))


def validate_sip_amount_for_frequency(
    fund: MutualFund,
    *,
    frequency: str,
    amount_inr: Decimal,
    option: dict[str, Any] | None = None,
) -> Decimal | None:
    """Validate amount against OMS frequency block; returns resolved min for API responses."""
    block = assert_sip_frequency_allowed(fund, frequency)
    min_amount = resolve_min_sip_amount_for_frequency(fund, frequency, option=block or option)
    if min_amount is not None and amount_inr < min_amount:
        raise MfOrderError(
            code="below_minimum",
            message=f"Minimum SIP amount is INR {min_amount}",
        )
    resolved_option = block or option or sip_option_for_frequency(fund, frequency)
    if resolved_option is not None:
        max_amount = to_decimal(resolved_option.get("max_inr"))
        if max_amount is not None and amount_inr > max_amount:
            raise MfOrderError(
                code="above_maximum",
                message=f"Maximum SIP amount is INR {max_amount}",
            )
        multiples = to_decimal(resolved_option.get("multiples_inr"))
        if multiples is not None and multiples > 0:
            remainder = amount_inr % multiples
            if remainder != 0:
                raise MfOrderError(
                    code="invalid_amount_multiple",
                    message=f"SIP amount must be in multiples of INR {multiples}",
                )
    return min_amount
