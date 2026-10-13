from __future__ import annotations

from app.application.mf.mf_lumpsum_reconciliation_service import (
    should_run_ondc_pipeline_advance_on_payment_poll,
)
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus


def _order(**kwargs: object) -> MfOrder:
    order = MfOrder()
    for key, value in kwargs.items():
        setattr(order, key, value)
    return order


def test_payment_poll_still_advances_pending_pipeline() -> None:
    order = _order(status=MfOrderStatus.pending, metadata_={})
    assert should_run_ondc_pipeline_advance_on_payment_poll(order) is True


def test_payment_poll_skips_advance_when_pg_payment_exists() -> None:
    order = _order(
        status=MfOrderStatus.payment_pending,
        metadata_={"ondc": {"payment_created": True, "fp_payment_id": 99}},
    )
    assert should_run_ondc_pipeline_advance_on_payment_poll(order) is False


def test_payment_poll_skips_advance_when_resolved_payment_id_only() -> None:
    order = _order(
        status=MfOrderStatus.submitted,
        metadata_={"ondc": {"fp_payment_id": 12}},
    )
    assert should_run_ondc_pipeline_advance_on_payment_poll(order) is False
