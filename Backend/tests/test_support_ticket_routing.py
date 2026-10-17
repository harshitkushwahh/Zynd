from __future__ import annotations

from app.application.support.ticket_routing_service import compute_ticket_priority, _merge_priority


def test_compute_ticket_priority_risk_profile_is_medium() -> None:
    assert compute_ticket_priority("can u tell me about my risk profile", ("account",)) == "medium"


def test_compute_ticket_priority_payment_failure_is_high() -> None:
    assert compute_ticket_priority("debit failed on my SIP", ("payment",)) == "high"


def test_merge_priority_keeps_highest() -> None:
    assert _merge_priority("low", "medium") == "medium"
    assert _merge_priority("medium", "high") == "high"
    assert _merge_priority("high", "low") == "high"
