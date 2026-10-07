from __future__ import annotations

from app.application.mf.mf_lumpsum_reconciliation_service import classify_order_payment_outcome
from app.application.mf.mf_order_service import _derive_next_action
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus, MfOrderType


def test_derive_next_action_pay_upi() -> None:
    assert _derive_next_action(status="SUBMITTED", payment_url="upi://pay") == "pay_upi"


def test_derive_next_action_wait_review() -> None:
    assert _derive_next_action(status="PROCESSING", payment_url=None) == "wait_review"


def test_derive_next_action_payment_pending_with_url() -> None:
    assert _derive_next_action(status="PAYMENT_PENDING", payment_url="https://pay.example/1") == "pay_upi"


def test_derive_next_action_processing_with_url() -> None:
    assert _derive_next_action(status="PROCESSING", payment_url="https://pay.example/1") == "pay_upi"


def test_derive_next_action_url_redirects_even_while_pending() -> None:
    assert _derive_next_action(status="PENDING", payment_url="https://pay.example/1") == "pay_upi"


def test_derive_next_action_complete() -> None:
    assert _derive_next_action(status="SUCCEEDED", payment_url=None) == "complete"


def test_classify_payment_outcome_success_after_gateway_while_processing() -> None:
    order = MfOrder(
        status=MfOrderStatus.processing,
        order_type=MfOrderType.lumpsum,
        metadata_={"ondc": {"payment_success": True, "fp_payment_status": "SUCCESS"}},
    )
    assert (
        classify_order_payment_outcome(order, fp_payment_status="SUCCESS", repaired=False) == "success"
    )

    order_no_flag = MfOrder(
        status=MfOrderStatus.submitted,
        order_type=MfOrderType.lumpsum,
        metadata_={"ondc": {"fp_payment_status": "SUCCESS"}},
    )
    assert (
        classify_order_payment_outcome(order_no_flag, fp_payment_status="SUCCESS", repaired=False)
        == "success"
    )
