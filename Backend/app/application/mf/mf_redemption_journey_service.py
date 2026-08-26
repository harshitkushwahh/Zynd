from __future__ import annotations

import logging
from typing import Any

from app.infrastructure.mf.fp_oms_client import get_mf_payout_details, get_mf_redemption, list_mf_redemptions

logger = logging.getLogger(__name__)

# FinPrim /v2/mf_redemptions `states` filter accepts only these values.
_FP_REDEMPTION_QUERY_STATES = "pending,confirmed,submitted"
_ACTIVE_FP_REDEMPTION_STATES = frozenset({"pending", "confirmed", "submitted"})


def _extract_redemption_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = payload.get("data")
    if isinstance(rows, list):
        return [row for row in rows if isinstance(row, dict)]
    if isinstance(payload, dict) and payload.get("object") == "mf_redemption":
        return [payload]
    return []


def _extract_redemption_isin(redemption: dict[str, Any]) -> str | None:
    scheme = redemption.get("scheme")
    if isinstance(scheme, dict):
        isin = scheme.get("isin") or scheme.get("id")
        if isin:
            return str(isin).upper()
    if isinstance(scheme, str) and scheme.strip():
        return scheme.strip().upper()
    isin = redemption.get("isin")
    return str(isin).upper() if isin else None


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def map_fp_redemption_status(state: str | None) -> str:
    normalized = str(state or "").lower()
    if normalized in {"successful", "succeeded"}:
        return "SUCCEEDED"
    if normalized == "failed":
        return "FAILED"
    if normalized == "cancelled":
        return "CANCELLED"
    if normalized == "submitted":
        return "SUBMITTED"
    if normalized in {"confirmed", "processing", "review"}:
        return "PROCESSING"
    return "PENDING"


def _event(
    *,
    from_status: str | None,
    to_status: str,
    created_at: str | None,
    source: str = "SYSTEM",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "from_status": from_status,
        "to_status": to_status,
        "source": source,
        "created_at": created_at,
        "payload": payload,
    }


def _first_timestamp(*values: Any) -> str | None:
    for value in values:
        if value:
            return str(value)
    return None


def build_redemption_journey_events(
    redemption: dict[str, Any],
    *,
    payout_details: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    created_at = _first_timestamp(redemption.get("created_at"))
    confirmed_at = _first_timestamp(redemption.get("confirmed_at"))
    submitted_at = _first_timestamp(redemption.get("submitted_at"))
    succeeded_at = _first_timestamp(redemption.get("succeeded_at"))
    redeemed_nav = _safe_float(redemption.get("redeemed_price") or redemption.get("nav"))
    redeemed_at = _first_timestamp(
        redemption.get("redeemed_at"),
        redemption.get("redeemed_nav_date"),
        succeeded_at,
    )

    if created_at:
        events.append(
            _event(
                from_status=None,
                to_status="PENDING",
                created_at=created_at,
                source="USER",
                payload={"reason": "redemption_placed"},
            )
        )

    processing_at = confirmed_at or (created_at if not confirmed_at and not submitted_at else None)
    if processing_at:
        events.append(
            _event(
                from_status="PENDING",
                to_status="PROCESSING",
                created_at=processing_at,
            )
        )

    if submitted_at:
        events.append(
            _event(
                from_status="PROCESSING",
                to_status="SUBMITTED",
                created_at=submitted_at,
                payload={"stage": "amc_submitted"},
            )
        )

    if redeemed_at and (_safe_float(redemption.get("redeemed_units")) or _safe_float(redemption.get("units"))):
        events.append(
            _event(
                from_status="SUBMITTED",
                to_status="PROCESSING",
                created_at=redeemed_at,
                source="WORKER",
                payload={
                    "stage": "units_redeemed",
                    **({"nav": redeemed_nav} if redeemed_nav is not None else {}),
                },
            )
        )

    payout_rows = payout_details or []
    payout_processed_at = None
    for row in payout_rows:
        if not isinstance(row, dict):
            continue
        payout_processed_at = _first_timestamp(row.get("payout_processed_at"), row.get("processed_at"))
        if payout_processed_at:
            break

    if payout_processed_at:
        events.append(
            _event(
                from_status="PROCESSING",
                to_status="SUBMITTED",
                created_at=payout_processed_at,
                source="WORKER",
                payload={"stage": "payout_initiated"},
            )
        )

    final_status = map_fp_redemption_status(redemption.get("state"))
    if final_status == "SUCCEEDED" and succeeded_at:
        events.append(
            _event(
                from_status="SUBMITTED",
                to_status="SUCCEEDED",
                created_at=succeeded_at,
                source="WORKER",
                payload={"stage": "payout_credited"},
            )
        )
    elif final_status == "FAILED":
        events.append(
            _event(
                from_status=events[-1]["to_status"] if events else "PROCESSING",
                to_status="FAILED",
                created_at=succeeded_at or submitted_at or processing_at or created_at,
            )
        )
    elif final_status == "CANCELLED":
        events.append(
            _event(
                from_status=events[-1]["to_status"] if events else "PENDING",
                to_status="CANCELLED",
                created_at=succeeded_at or submitted_at or processing_at or created_at,
            )
        )

    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str | None, str, str | None]] = set()
    for event in events:
        key = (event.get("from_status"), event["to_status"], event.get("created_at"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(event)
    return deduped


def serialize_active_redemption(redemption: dict[str, Any]) -> dict[str, Any]:
    amount = _safe_float(redemption.get("amount") or redemption.get("redeemed_amount")) or 0.0
    units = _safe_float(redemption.get("units") or redemption.get("redeemed_units")) or 0.0
    return {
        "fp_redemption_id": str(redemption.get("id") or ""),
        "status": map_fp_redemption_status(redemption.get("state")),
        "amount_inr": amount,
        "units": units,
        "placed_at": _first_timestamp(redemption.get("created_at")),
        "folio_number": str(redemption.get("folio_number") or ""),
        "isin": _extract_redemption_isin(redemption),
    }


def index_active_redemptions(redemptions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    indexed: dict[str, dict[str, Any]] = {}
    for redemption in redemptions:
        folio = str(redemption.get("folio_number") or "").strip()
        isin = _extract_redemption_isin(redemption)
        if not folio or not isin:
            continue
        state = str(redemption.get("state") or "").lower()
        if state not in _ACTIVE_FP_REDEMPTION_STATES:
            continue
        key = f"{folio}::{isin}"
        existing = indexed.get(key)
        if existing is None or (redemption.get("created_at") or "") > (existing.get("placed_at") or ""):
            indexed[key] = serialize_active_redemption(redemption)
    return indexed


async def list_fp_redemptions_for_mfia(
    *,
    fp_mfia_id: str,
    states: str | None = _FP_REDEMPTION_QUERY_STATES,
) -> list[dict[str, Any]]:
    payload = await list_mf_redemptions(fp_mfia_id=fp_mfia_id, states=states)
    return _extract_redemption_rows(payload)


async def get_fp_redemption_journey(fp_redemption_id: str) -> dict[str, Any] | None:
    redemption = await get_mf_redemption(fp_redemption_id)
    if not isinstance(redemption, dict) or not redemption.get("id"):
        return None

    payout_payload = await get_mf_payout_details(fp_redemption_id=fp_redemption_id)
    payout_rows = payout_payload.get("data")
    payout_details = payout_rows if isinstance(payout_rows, list) else []

    amount = _safe_float(redemption.get("amount") or redemption.get("redeemed_amount")) or 0.0
    units = _safe_float(redemption.get("units") or redemption.get("redeemed_units")) or 0.0
    placed_at = _first_timestamp(redemption.get("created_at")) or ""

    return {
        "order_id": str(redemption.get("id")),
        "status": map_fp_redemption_status(redemption.get("state")),
        "amount_inr": amount,
        "units": units,
        "placed_at": placed_at,
        "folio_number": str(redemption.get("folio_number") or ""),
        "isin": _extract_redemption_isin(redemption),
        "events": build_redemption_journey_events(redemption, payout_details=payout_details),
    }
