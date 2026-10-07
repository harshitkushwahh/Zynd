"""Tight Cybrilla polls so a payment link is ready in the same request.

MultiPlus waits inside the create/consent call until an ONDC purchase leaves
``under_review`` (or a SIP plan reaches ``review_completed``) before it creates
the payment and returns ``token_url``. These helpers do the same wait so Zynd
does not hand the browser an empty payment status and idle on gateway review.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from app.infrastructure.kyc.fp_clients import FpClientError
from app.infrastructure.mf.fp_oms_client import extract_fp_state

logger = logging.getLogger(__name__)

# Purchases sit here until Cybrilla finishes ONDC review. Consent and payment
# creation run once the purchase leaves this set.
PURCHASE_REVIEW_WAIT_STATES = frozenset({"under_review"})

# Consent + PG payment are valid in these states (pending is the usual one;
# review_completed is the SIP-plan equivalent and must not idle).
PURCHASE_PAYMENT_SETUP_STATES = frozenset({"pending", "review_completed"})

PLAN_REVIEW_WAIT_STATES = frozenset({"created", "under_review"})
PLAN_CONSENT_READY_STATES = frozenset(
    {
        "review_completed",
        "active",
        "confirmed",
        "submitted",
        "failed",
        "rejected",
        "expired",
        "cancelled",
        "completed",
    }
)

# One snapshot is already fetched by the caller. Remaining attempts sleep, then GET.
PURCHASE_REVIEW_POLL_ATTEMPTS = 10
PURCHASE_REVIEW_POLL_INTERVAL_SECONDS = 0.7

# Matches MultiPlus awaitPlanConsentEligibleStatus (16 x 650ms).
PLAN_REVIEW_POLL_ATTEMPTS = 16
PLAN_REVIEW_POLL_INTERVAL_SECONDS = 0.65

FetchPurchase = Callable[[str], Awaitable[dict[str, Any]]]
Sleep = Callable[[float], Awaitable[None]]


def purchase_not_ready_error(exc: BaseException) -> bool:
    """True when Cybrilla rejected consent/payment because review is still running."""
    if not isinstance(exc, FpClientError):
        return False
    parts = [exc.message or "", exc.code or ""]
    if exc.response_data is not None:
        parts.append(str(exc.response_data))
    blob = " ".join(parts).lower()
    needles = (
        "not in pending",
        "not_in_pending",
        "under_review",
        "mf_order_not_in_pending",
        "not in pending or submitted",
        "order is not in pending",
    )
    return any(needle in blob for needle in needles)


async def poll_purchase_until_actionable(
    fp_purchase_id: str,
    *,
    initial_state: str | None,
    initial_payload: dict[str, Any] | None = None,
    fetch_purchase: FetchPurchase | None = None,
    sleep: Sleep | None = None,
    max_attempts: int = PURCHASE_REVIEW_POLL_ATTEMPTS,
    interval_seconds: float = PURCHASE_REVIEW_POLL_INTERVAL_SECONDS,
) -> tuple[str, dict[str, Any]]:
    """GET the purchase until it leaves ``under_review`` or the attempt budget ends.

    The caller has already fetched once. Further attempts sleep, then GET, so a
    purchase that is already ``pending`` returns immediately.
    """
    import asyncio

    from app.infrastructure.mf.fp_oms_client import get_mf_purchase

    fetch = fetch_purchase or get_mf_purchase
    pause = sleep or asyncio.sleep
    state = (initial_state or "").strip().lower()
    payload = dict(initial_payload or {})
    if state not in PURCHASE_REVIEW_WAIT_STATES:
        return state, payload

    for attempt in range(1, max_attempts):
        await pause(interval_seconds)
        payload = await fetch(fp_purchase_id)
        state = (extract_fp_state(payload) or state).strip().lower()
        logger.info(
            "MF purchase review poll fp_purchase_id=%s attempt=%s/%s state=%s",
            fp_purchase_id,
            attempt + 1,
            max_attempts,
            state,
        )
        if state not in PURCHASE_REVIEW_WAIT_STATES:
            return state, payload
    return state, payload


async def poll_plan_until_consent_eligible(
    fp_plan_id: str,
    *,
    initial_state: str | None,
    initial_payload: dict[str, Any] | None = None,
    fetch_plan: FetchPurchase | None = None,
    sleep: Sleep | None = None,
    max_attempts: int = PLAN_REVIEW_POLL_ATTEMPTS,
    interval_seconds: float = PLAN_REVIEW_POLL_INTERVAL_SECONDS,
) -> tuple[str, dict[str, Any]]:
    """GET the SIP plan until it can be confirmed, or the attempt budget ends."""
    import asyncio

    from app.infrastructure.mf.fp_oms_client import get_mf_purchase_plan

    fetch = fetch_plan or get_mf_purchase_plan
    pause = sleep or asyncio.sleep
    state = (initial_state or "").strip().lower()
    payload = dict(initial_payload or {})
    if state not in PLAN_REVIEW_WAIT_STATES:
        return state, payload

    for attempt in range(1, max_attempts):
        await pause(interval_seconds)
        payload = await fetch(fp_plan_id)
        state = (extract_fp_state(payload) or state).strip().lower()
        logger.info(
            "SIP plan review poll fp_plan_id=%s attempt=%s/%s state=%s",
            fp_plan_id,
            attempt + 1,
            max_attempts,
            state,
        )
        if state in PLAN_CONSENT_READY_STATES:
            return state, payload
    return state, payload
