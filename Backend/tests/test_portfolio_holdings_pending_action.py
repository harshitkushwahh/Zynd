from __future__ import annotations

from types import SimpleNamespace

from app.application.mf.mf_fp_state import FP_FAILURE_STATES
from app.application.mf.portfolio_holdings_service import _order_blocks_holding_actions
from app.infrastructure.persistence.mf_transaction_models import MfOrderStatus


def test_order_blocks_holding_false_when_status_failed() -> None:
    order = SimpleNamespace(status=MfOrderStatus.failed, fp_state="submitted")
    assert _order_blocks_holding_actions(order) is False


def test_order_blocks_holding_false_when_fp_state_failed() -> None:
    for fp_state in FP_FAILURE_STATES:
        order = SimpleNamespace(status=MfOrderStatus.processing, fp_state=fp_state)
        assert _order_blocks_holding_actions(order) is False


def test_order_blocks_holding_true_when_in_flight() -> None:
    order = SimpleNamespace(status=MfOrderStatus.processing, fp_state="confirmed")
    assert _order_blocks_holding_actions(order) is True
