from __future__ import annotations

from uuid import uuid4

from app.application.mf.mf_order_service import order_payment_completed
from app.infrastructure.persistence.mf_transaction_models import MfOrder, MfOrderStatus, MfOrderType


def test_order_payment_completed_requires_payment_success_flag() -> None:
    order = MfOrder(
        id=uuid4(),
        user_id=uuid4(),
        product_id=uuid4(),
        fund_id=1,
        amount_inr=100,
        status=MfOrderStatus.submitted,
        metadata_={
            "ondc": {
                "payment_created": True,
                "purchase_confirmed": True,
            }
        },
    )
    assert order_payment_completed(order) is False


def test_redemption_is_not_treated_as_unpaid() -> None:
    order = MfOrder(
        id=uuid4(),
        user_id=uuid4(),
        product_id=uuid4(),
        fund_id=1,
        amount_inr=97.39,
        order_type=MfOrderType.redemption,
        status=MfOrderStatus.submitted,
        fp_state="submitted",
    )
    assert order_payment_completed(order) is True


def test_order_payment_completed_when_payment_success_recorded() -> None:
    order = MfOrder(
        id=uuid4(),
        user_id=uuid4(),
        product_id=uuid4(),
        fund_id=1,
        amount_inr=100,
        status=MfOrderStatus.submitted,
        metadata_={"ondc": {"payment_success": True}},
    )
    assert order_payment_completed(order) is True
