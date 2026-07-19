from __future__ import annotations

from app.application.mf.mf_fp_state import map_fp_purchase_state
from app.infrastructure.persistence.mf_transaction_models import MfOrderStatus


def test_map_fp_state_success() -> None:
    assert map_fp_purchase_state("successful") == MfOrderStatus.succeeded
    assert map_fp_purchase_state("SUCCEEDED") == MfOrderStatus.succeeded


def test_map_fp_state_failure() -> None:
    assert map_fp_purchase_state("failed") == MfOrderStatus.failed
    assert map_fp_purchase_state("cancelled") == MfOrderStatus.failed


def test_map_fp_state_ondc_flow() -> None:
    assert map_fp_purchase_state("under_review") == MfOrderStatus.processing
    assert map_fp_purchase_state("pending") == MfOrderStatus.payment_pending
    assert map_fp_purchase_state("submitted") == MfOrderStatus.submitted
    assert map_fp_purchase_state("confirmed") == MfOrderStatus.processing
