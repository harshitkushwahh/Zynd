from __future__ import annotations

import pytest

from app.application.mf.mf_fp_review_poll import (
    poll_plan_until_consent_eligible,
    poll_purchase_until_actionable,
    purchase_not_ready_error,
)
from app.infrastructure.kyc.fp_clients import FpClientError


@pytest.mark.asyncio
async def test_purchase_poll_returns_immediately_when_already_pending() -> None:
    async def fetch(_purchase_id: str) -> dict:
        raise AssertionError("should not fetch when the purchase is already pending")

    async def sleep(_seconds: float) -> None:
        raise AssertionError("should not sleep when the purchase is already pending")

    state, payload = await poll_purchase_until_actionable(
        "mfp_ready",
        initial_state="pending",
        initial_payload={"state": "pending", "old_id": 9},
        fetch_purchase=fetch,
        sleep=sleep,
    )
    assert state == "pending"
    assert payload["old_id"] == 9


@pytest.mark.asyncio
async def test_purchase_poll_waits_until_cybrilla_leaves_under_review() -> None:
    calls = {"n": 0}
    sleeps: list[float] = []

    async def fetch(_purchase_id: str) -> dict:
        calls["n"] += 1
        if calls["n"] < 3:
            return {"state": "under_review"}
        return {"state": "pending", "old_id": 42}

    async def sleep(seconds: float) -> None:
        sleeps.append(seconds)

    state, payload = await poll_purchase_until_actionable(
        "mfp_review",
        initial_state="under_review",
        initial_payload={"state": "under_review"},
        fetch_purchase=fetch,
        sleep=sleep,
        max_attempts=6,
        interval_seconds=0.7,
    )
    assert state == "pending"
    assert payload["old_id"] == 42
    assert calls["n"] == 3
    assert sleeps == [0.7, 0.7, 0.7]


@pytest.mark.asyncio
async def test_purchase_poll_stops_at_budget_while_still_under_review() -> None:
    calls = {"n": 0}

    async def fetch(_purchase_id: str) -> dict:
        calls["n"] += 1
        return {"state": "under_review"}

    async def sleep(_seconds: float) -> None:
        return None

    state, _payload = await poll_purchase_until_actionable(
        "mfp_slow",
        initial_state="under_review",
        fetch_purchase=fetch,
        sleep=sleep,
        max_attempts=4,
        interval_seconds=0.1,
    )
    assert state == "under_review"
    assert calls["n"] == 3


@pytest.mark.asyncio
async def test_plan_poll_stops_at_review_completed() -> None:
    calls = {"n": 0}

    async def fetch(_plan_id: str) -> dict:
        calls["n"] += 1
        if calls["n"] == 1:
            return {"state": "under_review"}
        return {"state": "review_completed"}

    async def sleep(_seconds: float) -> None:
        return None

    state, _payload = await poll_plan_until_consent_eligible(
        "mfpp_1",
        initial_state="created",
        fetch_plan=fetch,
        sleep=sleep,
        max_attempts=5,
        interval_seconds=0.1,
    )
    assert state == "review_completed"
    assert calls["n"] == 2


def test_purchase_not_ready_error_matches_cybrilla_review_rejection() -> None:
    ready = FpClientError("validation failed", "fp_client_error", 400)
    reviewing = FpClientError(
        "mf_order_not_in_pending_or_submitted_state",
        "fp_client_error",
        422,
    )
    assert purchase_not_ready_error(ready) is False
    assert purchase_not_ready_error(reviewing) is True
    assert purchase_not_ready_error(RuntimeError("under_review")) is False
