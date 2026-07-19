from __future__ import annotations

from app.application.mf.mf_order_service import _derive_next_action


def test_derive_next_action_pay_upi() -> None:
    assert _derive_next_action(status="SUBMITTED", payment_url="upi://pay") == "pay_upi"


def test_derive_next_action_wait_review() -> None:
    assert _derive_next_action(status="PROCESSING", payment_url=None) == "wait_review"


def test_derive_next_action_complete() -> None:
    assert _derive_next_action(status="SUCCEEDED", payment_url=None) == "complete"
