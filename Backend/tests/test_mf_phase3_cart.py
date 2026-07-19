from __future__ import annotations

from app.application.mf.mf_order_service import _derive_next_action
from app.infrastructure.mf.fp_oms_client import create_mf_purchases_batch, update_mf_purchases_batch


def test_derive_next_action_cart_checkout_pay_upi() -> None:
    assert _derive_next_action(status="SUBMITTED", payment_url="upi://pay") == "pay_upi"


async def test_create_mf_purchases_batch_stub() -> None:
    results = await create_mf_purchases_batch(
        purchases=[
            {
                "fp_mfia_id": "mfia_test",
                "scheme": "INF109K01RT3",
                "amount_inr": 1000,
                "source_ref_id": "order-1",
            },
            {
                "fp_mfia_id": "mfia_test",
                "scheme": "INF173K01FE6",
                "amount_inr": 2000,
                "source_ref_id": "order-2",
            },
        ],
        user_ip="127.0.0.1",
    )
    assert len(results) == 2
    assert results[0]["source_ref_id"] == "order-1"
    assert results[1]["fp_purchase_old_id"] == 2


async def test_update_mf_purchases_batch_stub() -> None:
    results = await update_mf_purchases_batch(
        updates=[
            {"id": "mfp_1", "state": "confirmed"},
            {"id": "mfp_2", "state": "confirmed"},
        ]
    )
    assert len(results) == 2
    assert results[0]["state"] == "confirmed"
