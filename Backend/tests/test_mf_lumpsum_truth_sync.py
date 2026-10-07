from __future__ import annotations

from uuid import uuid4

from app.application.mf.mf_lumpsum_reconciliation_service import (
    _purchase_state_ahead_of_payment,
    _target_status_without_payment,
)
from app.infrastructure.mf.fp_payment_client import (
    is_payment_failure_status,
    is_payment_pending_status,
)
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus


def test_is_payment_failure_status() -> None:
    assert is_payment_failure_status("FAILED") is True
    assert is_payment_failure_status("EXPIRED") is True
    assert is_payment_failure_status("PENDING") is False


def test_is_payment_pending_status() -> None:
    assert is_payment_pending_status("PENDING") is True
    assert is_payment_pending_status(None) is True
    assert is_payment_pending_status("FAILED") is False


def test_purchase_state_ahead_of_payment() -> None:
    assert _purchase_state_ahead_of_payment("submitted") is True
    assert _purchase_state_ahead_of_payment("pending") is False


def test_unpaid_submitted_purchase_maps_to_payment_pending() -> None:
    target = _target_status_without_payment(
        fp_state="submitted",
        fp_payment_status="PENDING",
        payment_id=123,
    )
    assert target == MfOrderStatus.payment_pending


def test_unpaid_submitted_purchase_with_failed_payment_maps_to_failed() -> None:
    target = _target_status_without_payment(
        fp_state="submitted",
        fp_payment_status="FAILED",
        payment_id=123,
    )
    assert target == MfOrderStatus.failed


def test_unpaid_submitted_purchase_without_payment_id_stays_payment_pending() -> None:
    target = _target_status_without_payment(
        fp_state="submitted",
        fp_payment_status="PENDING",
        payment_id=None,
    )
    assert target == MfOrderStatus.payment_pending


def test_under_review_without_payment_id_stays_processing() -> None:
    target = _target_status_without_payment(
        fp_state="under_review",
        fp_payment_status=None,
        payment_id=None,
    )
    assert target == MfOrderStatus.processing


def test_unrecognized_payment_status_stays_payment_pending() -> None:
    target = _target_status_without_payment(
        fp_state="submitted",
        fp_payment_status="AUTHORIZED",
        payment_id=123,
    )
    assert target == MfOrderStatus.payment_pending


def test_pending_purchase_state_maps_from_cybrilla() -> None:
    target = _target_status_without_payment(
        fp_state="pending",
        fp_payment_status=None,
        payment_id=None,
    )
    assert target == MfOrderStatus.payment_pending
