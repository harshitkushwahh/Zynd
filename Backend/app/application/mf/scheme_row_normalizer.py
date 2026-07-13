from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.application.mf.amc_name_parser import normalize_amc_display_name, parse_amc_from_scheme_name
from app.application.mf.category_mapping import should_exclude_from_catalog


def to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except Exception:
        return None


def unwrap_cybrilla_scheme_payload(raw: dict[str, Any]) -> dict[str, Any]:
    data = raw.get("data")
    if isinstance(data, dict) and data:
        return data
    return raw


def _min_sip_from_frequency_data(scheme: dict[str, Any]) -> Decimal | None:
    direct = to_decimal(scheme.get("min_sip_amount") or scheme.get("sip_minimum_installment_amount"))
    if direct is not None:
        return direct

    freq_data = scheme.get("sip_frequency_specific_data")
    if not isinstance(freq_data, dict):
        return None

    for frequency in ("monthly", "quarterly", "weekly", "daily"):
        block = freq_data.get(frequency)
        if isinstance(block, dict):
            amount = to_decimal(block.get("min_installment_amount"))
            if amount is not None:
                return amount
    return None


def extract_min_amounts_from_scheme(raw: dict[str, Any]) -> dict[str, Decimal | None]:
    scheme = unwrap_cybrilla_scheme_payload(raw)
    return {
        "min_sip_amount": _min_sip_from_frequency_data(scheme),
        "min_lumpsum_amount": to_decimal(
            scheme.get("min_initial_investment") or scheme.get("min_initial_investment_amount")
        ),
    }


def normalize_scheme_row(raw: dict[str, Any]) -> dict[str, Any] | None:
    isin = str(raw.get("isin") or raw.get("isin_growth") or "").strip().upper()
    if not isin.startswith("INF"):
        return None

    amc_block = raw.get("amc") if isinstance(raw.get("amc"), dict) else {}
    plan_type = str(raw.get("plan_type") or raw.get("investment_option") or "").strip() or None
    scheme_name = str(raw.get("name") or raw.get("scheme_name") or isin).strip()

    amc_name = str(
        raw.get("amc_name") or amc_block.get("name") or raw.get("fund_house") or ""
    ).strip()
    if not amc_name or amc_name.lower() == "unknown amc":
        amc_name = parse_amc_from_scheme_name(scheme_name) or "Unknown AMC"
    else:
        amc_name = normalize_amc_display_name(amc_name) or amc_name
    fp_amc_id = str(raw.get("amc_id") or amc_block.get("id") or "").strip() or None

    if should_exclude_from_catalog(scheme_name=scheme_name, plan_type=plan_type):
        return None

    purchase_allowed = raw.get("purchase_allowed")
    if purchase_allowed is None:
        purchase_allowed = raw.get("active")

    min_amounts = extract_min_amounts_from_scheme(raw)

    return {
        "isin_growth": isin,
        "scheme_name": scheme_name,
        "fp_scheme_id": str(raw.get("id") or raw.get("fund_scheme_id") or isin),
        "amc_name": amc_name,
        "fp_amc_id": fp_amc_id,
        "fp_oms_purchase_allowed": bool(purchase_allowed) if purchase_allowed is not None else None,
        "fp_oms_active": bool(raw.get("active")) if raw.get("active") is not None else None,
        "min_sip_amount": min_amounts["min_sip_amount"],
        "min_lumpsum_amount": min_amounts["min_lumpsum_amount"],
        "sebi_category": str(raw.get("fund_category") or raw.get("sebi_category") or "").strip() or None,
        "plan_type": plan_type,
        "option_type": str(raw.get("option_type") or raw.get("option") or "").strip() or None,
        "scheme_code": str(raw.get("scheme_code") or raw.get("amfi_code") or "").strip() or None,
    }


def normalized_for_mongo(normalized: dict[str, Any]) -> dict[str, Any]:
    payload = dict(normalized)
    for key in ("min_sip_amount", "min_lumpsum_amount"):
        value = payload.get(key)
        if isinstance(value, Decimal):
            payload[key] = str(value)
    return payload


def normalized_from_mongo(payload: dict[str, Any]) -> dict[str, Any]:
    result = dict(payload)
    for key in ("min_sip_amount", "min_lumpsum_amount"):
        value = result.get(key)
        if value is not None and not isinstance(value, Decimal):
            result[key] = to_decimal(value)
    return result
